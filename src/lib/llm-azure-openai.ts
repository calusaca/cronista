// Brief 023 — cuarto backend de la costura: Azure OpenAI (chat completions), para el bake-off del
// 6 oct (GPT-6.1 Sol con el crédito de Azure vs Claude en Foundry). Mismo contrato que los demás:
// devuelve un `Llm`; todo error (HTTP, respuesta malformada, truncada) LANZA con su motivo, y la
// cadena lo registra como intento fallido (V1) hasta caer al acta si no se recupera.
//
//   POST {AZURE_OPENAI_ENDPOINT}/openai/deployments/{AZURE_OPENAI_DEPLOYMENT}/chat/completions
//        ?api-version={AZURE_OPENAI_API_VERSION, por defecto API_VERSION_AZURE_OPENAI}
//   cabecera api-key: {AZURE_OPENAI_API_KEY}
//
// Sin cuenta todavía: se prueba OFFLINE con `fetch` inyectado (el patrón de llm-foundry.ts). La
// clave llega por env y jamás sale del servidor.

import { z } from "zod";
import type { Llm, Mensaje } from "./llm";

// ---- umbrales del backend (config del cliente, no del simulador) ----
/** api-version por defecto (la GA de chat completions; se sobreescribe con AZURE_OPENAI_API_VERSION). */
export const API_VERSION_AZURE_OPENAI = "2024-10-21";
/**
 * Temperatura EXPLÍCITA. A diferencia de Claude 5.x en Foundry (que rechaza `temperature`), GPT en
 * Azure OpenAI la admite: baja, porque el Cronista redacta desde hechos y el Verificador castiga la
 * invención; no cero, para que los reintentos con feedback no repitan el mismo texto.
 */
export const TEMPERATURA_AZURE_OPENAI = 0.3;
/** Techo de tokens de salida (una crónica completa con su JSON). */
export const MAX_TOKENS_AZURE_OPENAI = 4000;

export interface ConfigAzureOpenAI {
  apiKey: string;
  /** p. ej. https://<recurso>.openai.azure.com */
  endpoint: string;
  /** Nombre del deployment (p. ej. gpt-6.1-sol). */
  deployment: string;
  /** Por defecto API_VERSION_AZURE_OPENAI. */
  apiVersion?: string;
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
  return {
    id: `azure-openai:${cfg.deployment}`,
    async completar(system: string, mensajes: Mensaje[]): Promise<string> {
      const r = await transporte(urlAzureOpenAI(cfg), {
        method: "POST",
        headers: { "content-type": "application/json", "api-key": cfg.apiKey },
        body: JSON.stringify({
          messages: [{ role: "system", content: system }, ...mensajes.map((m) => ({ role: m.rol, content: m.contenido }))],
          temperature: TEMPERATURA_AZURE_OPENAI,
          max_completion_tokens: MAX_TOKENS_AZURE_OPENAI,
          // El prompt del 003 exige «únicamente un objeto JSON válido»: se le pide al servicio.
          response_format: { type: "json_object" },
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
      if (!v.success) throw new Error(`Azure OpenAI: respuesta malformada (${v.error.issues.map((i) => i.path.join(".") || "(raíz)").join(", ")})`);
      const eleccion = v.data.choices[0] as z.infer<typeof esquemaRespuesta>["choices"][number];
      if (eleccion.finish_reason === "length") throw new Error("Azure OpenAI: respuesta truncada (finish_reason = length)");
      if (eleccion.finish_reason === "content_filter") throw new Error("Azure OpenAI: respuesta bloqueada por el filtro de contenido");
      if (eleccion.message.content === null || eleccion.message.content === "") throw new Error("Azure OpenAI: respuesta vacía");
      return eleccion.message.content;
    },
  };
}
