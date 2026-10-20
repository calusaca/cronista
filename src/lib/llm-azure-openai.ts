// Brief 023 — cuarto backend de la costura: Azure OpenAI (chat completions), para el bake-off del
// 6 oct (GPT-6.1 Sol con el crédito de Azure vs Claude en Foundry). Mismo contrato que los demás:
// devuelve un `Llm`; todo error (HTTP, respuesta malformada, truncada) LANZA con su motivo, y la
// cadena lo registra como intento fallido (V1) hasta caer al acta si no se recupera.
//
//   POST {AZURE_OPENAI_ENDPOINT}/openai/deployments/{AZURE_OPENAI_DEPLOYMENT}/chat/completions
//        ?api-version={AZURE_OPENAI_API_VERSION, por defecto API_VERSION_AZURE_OPENAI}
//   cabecera api-key: {AZURE_OPENAI_API_KEY}
//
// Transporte probado offline con `fetch` inyectado y smoke real con GPT-6.1 Sol en
// docs/evidencia/primera-corrida-azure-openai.json. La clave llega por env y queda en el servidor.

import { z } from "zod";
import type { Llm, Mensaje, OpcionesLlm, UsoLlm } from "./llm";

// ---- umbrales del backend (config del cliente, no del simulador) ----
/** api-version por defecto (la GA de chat completions; se sobreescribe con AZURE_OPENAI_API_VERSION). */
export const API_VERSION_AZURE_OPENAI = "2024-10-21";
/** Solo para modelos sin razonamiento configurado; GPT-6.1 Sol no acepta esta temperatura. */
export const TEMPERATURA_AZURE_OPENAI = 0.3;
/** Techo de tokens de salida (una crónica completa con su JSON). */
export const MAX_TOKENS_AZURE_OPENAI = 4000;
/** Mismo techo que Foundry: incluye razonamiento y el JSON bilingüe de salida. */
export const MAX_TOKENS_RAZONAMIENTO_AZURE_OPENAI = 16_000;
export const ESFUERZOS_AZURE_OPENAI = ["low", "medium", "high", "xhigh", "max"] as const;
export type EsfuerzoAzureOpenAI = (typeof ESFUERZOS_AZURE_OPENAI)[number];

export interface ConfigAzureOpenAI {
  apiKey: string;
  /** p. ej. https://<recurso>.openai.azure.com */
  endpoint: string;
  /** Nombre del deployment (p. ej. gpt-6.1-sol). */
  deployment: string;
  /** Por defecto API_VERSION_AZURE_OPENAI. */
  apiVersion?: string;
  /** Configurar para GPT-6.1 Sol; omite temperature y envía reasoning_effort. */
  reasoningEffort?: EsfuerzoAzureOpenAI;
  /** Solo para pruebas: transporte HTTP inyectado. */
  fetch?: typeof fetch;
}

/** La respuesta que se acepta (zod): lo que no cumpla esto es una respuesta malformada. */
export const esquemaRespuesta = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable() }),
        finish_reason: z.string().nullable(),
      }),
    )
    .min(1),
});

export function urlAzureOpenAI(cfg: Pick<ConfigAzureOpenAI, "endpoint" | "deployment" | "apiVersion">): string {
  const base = cfg.endpoint.replace(/\/+$/, "");
  return `${base}/openai/deployments/${encodeURIComponent(cfg.deployment)}/chat/completions?api-version=${encodeURIComponent(cfg.apiVersion ?? API_VERSION_AZURE_OPENAI)}`;
}

export function crearLlmAzureOpenAI(cfg: ConfigAzureOpenAI): Llm {
  const transporte = cfg.fetch ?? fetch;
  const uso: UsoLlm = { llamadas: 0, respuestasConUso: 0, entrada: 0, salida: 0, cache: 0 };
  return {
    id: `azure-openai:${cfg.deployment}${cfg.reasoningEffort ? `:reasoning-${cfg.reasoningEffort}` : ""}`,
    uso: () => ({ ...uso }),
    async completar(system: string, mensajes: Mensaje[], opciones?: OpcionesLlm): Promise<string> {
      uso.llamadas++;
      if (opciones?.maxTokens !== undefined && (!Number.isInteger(opciones.maxTokens) || opciones.maxTokens < 1 || opciones.maxTokens > MAX_TOKENS_RAZONAMIENTO_AZURE_OPENAI)) throw new Error("Presupuesto de salida inválido");
      const r = await transporte(urlAzureOpenAI(cfg), {
        method: "POST",
        headers: { "content-type": "application/json", "api-key": cfg.apiKey },
        ...(opciones?.signal ? { signal: opciones.signal } : {}),
        body: JSON.stringify({
          messages: [{ role: "system", content: system }, ...mensajes.map((m) => ({ role: m.rol, content: m.contenido }))],
          ...(cfg.reasoningEffort
            ? { reasoning_effort: cfg.reasoningEffort, max_completion_tokens: opciones?.maxTokens ?? MAX_TOKENS_RAZONAMIENTO_AZURE_OPENAI }
            : { temperature: TEMPERATURA_AZURE_OPENAI, max_completion_tokens: opciones?.maxTokens ?? MAX_TOKENS_AZURE_OPENAI }),
          // El prompt del 003 exige «únicamente un objeto JSON válido»: se le pide al servicio.
          response_format: opciones?.esquema ? { type: "json_schema", json_schema: { name: opciones.esquema.nombre, strict: true, schema: opciones.esquema.json } } : { type: "json_object" },
        }),
      });
      if (!r.ok) {
        const detalle = await r.text().catch(() => "");
        const motivo = r.status === 401 ? "clave rechazada" : r.status === 429 ? "cuota o límite de tasa" : r.status >= 500 ? "error del servicio" : "petición rechazada";
        throw new Error(`Azure OpenAI ${r.status} (${motivo})${detalle ? `: ${detalle.slice(0, 200)}` : ""}`);
      }
      let json: unknown;
      try {
        json = await r.json();
      } catch {
        throw new Error("Azure OpenAI: la respuesta no es JSON");
      }
      const v = esquemaRespuesta.safeParse(json);
      const consumo = z.object({ usage: z.object({ prompt_tokens: z.number().nonnegative(), completion_tokens: z.number().nonnegative(), prompt_tokens_details: z.object({ cached_tokens: z.number().nonnegative().optional() }).optional() }) }).safeParse(json);
      if (consumo.success) { uso.respuestasConUso++; uso.entrada += consumo.data.usage.prompt_tokens; uso.salida += consumo.data.usage.completion_tokens; uso.cache += consumo.data.usage.prompt_tokens_details?.cached_tokens ?? 0; }
      if (!v.success) throw new Error(`Azure OpenAI: respuesta malformada (${v.error.issues.map((i) => i.path.join(".") || "(raíz)").join(", ")})`);
      const eleccion = v.data.choices[0] as z.infer<typeof esquemaRespuesta>["choices"][number];
      if (eleccion.finish_reason === "length") throw new Error("Azure OpenAI: respuesta truncada (finish_reason = length)");
      if (eleccion.finish_reason === "content_filter") throw new Error("Azure OpenAI: respuesta bloqueada por el filtro de contenido");
      if (eleccion.message.content === null || eleccion.message.content === "") throw new Error("Azure OpenAI: respuesta vacía");
      return eleccion.message.content;
    },
  };
}
