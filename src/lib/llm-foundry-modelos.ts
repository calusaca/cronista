// Brief 052 — quinto backend de la costura: Foundry Models sold by Azure (Azure AI Model
// Inference API), para dirigir equipos de la arena con modelos de otras familias. Mismo
// contrato que los demás: devuelve un `Llm`; todo error (HTTP, respuesta malformada,
// truncada, filtrada, vacía) LANZA con su motivo y sin reintentos propios; la corrección
// con el mensaje del validador es del controlador y es idéntica para todos los adaptadores.
//
//   POST {FOUNDRY_MODELOS_ENDPOINT}/models/chat/completions?api-version={FOUNDRY_MODELOS_API_VERSION}
//   cabecera api-key: {FOUNDRY_MODELOS_API_KEY}   (la misma clave del recurso)
//   cuerpo: { model: deployment, messages, max_tokens, response_format?, reasoning_effort? } — sin
//   temperature; reasoning_effort solo con FOUNDRY_MODELOS_ESFUERZO_RAZONAMIENTO (v1.2, coordinador).
//
// El razonamiento nunca vuelve al historial: se descarta `reasoning_content` y se recorta la
// envoltura <think>…</think> con una gramática cerrada (v1.1 §1); lo devuelto es lo que el
// controlador reinyecta como assistant. Lanzan solo transporte/proveedor, `length`,
// `content_filter`, vacío y razonamiento sin cerrar o fuera de la envoltura (v1.1 §2); el
// texto del modelo sin JSON se devuelve limpio para que el validador pida la corrección.

import { z } from "zod";
import type { Llm, Mensaje, OpcionesLlm, UsoLlm } from "./llm";

// ---- configuración del cliente (no son umbrales del simulador) ----
/** api-version documentada de la Model Inference API (probada el 22 oct, ver evidencia 052). */
export const API_VERSION_FOUNDRY_MODELOS = "2024-05-01-preview";
/** Techo por defecto de tokens de salida (incluye razonamiento si el modelo razona). */
export const MAX_TOKENS_FOUNDRY_MODELOS = 4000;
/** Presupuesto máximo aceptado, el mismo que Azure OpenAI con razonamiento. */
export const MAX_TOKENS_TOPE_FOUNDRY_MODELOS = 16_000;
export const FORMATOS_JSON_FOUNDRY_MODELOS = ["json_schema", "json_object", "texto"] as const;
export type FormatoJsonFoundryModelos = (typeof FORMATOS_JSON_FOUNDRY_MODELOS)[number];
/** v1.2 (coordinador, 22 oct): esfuerzo de razonamiento opcional por modelo. Ausente por defecto
 * (no se envía); solo los valores que grok-4.7 aceptó en la sonda («none» devuelve 400). */
export const ESFUERZOS_FOUNDRY_MODELOS = ["low", "minimal"] as const;
export type EsfuerzoFoundryModelos = (typeof ESFUERZOS_FOUNDRY_MODELOS)[number];

export interface ConfigFoundryModelos {
  apiKey: string;
  /** Host de Foundry, p. ej. https://<recurso>.services.ai.azure.com */
  endpoint: string;
  /** Nombre del deployment; va en `model`. */
  deployment: string;
  /** Por defecto "json_object". */
  formatoJson?: FormatoJsonFoundryModelos;
  /** Por defecto API_VERSION_FOUNDRY_MODELOS. */
  apiVersion?: string;
  /** v1.2: se envía como reasoning_effort solo si está configurado. */
  esfuerzoRazonamiento?: EsfuerzoFoundryModelos;
  /** Solo para pruebas: transporte HTTP inyectado. */
  fetch?: typeof fetch;
}

const esquemaRespuesta = z.object({
  choices: z
    .array(
      z.object({
        // reasoning_content se tolera (passthrough implícito de zod) y se descarta.
        message: z.object({ content: z.string().nullable() }),
        finish_reason: z.string().nullable(),
      }),
    )
    .min(1),
});

const esquemaUso = z.object({
  usage: z.object({
    prompt_tokens: z.number().nonnegative(),
    completion_tokens: z.number().nonnegative(),
    total_tokens: z.number().nonnegative().optional(),
    prompt_tokens_details: z.object({ cached_tokens: z.number().nonnegative().optional() }).nullish(),
    completion_tokens_details: z.object({ reasoning_tokens: z.number().nonnegative().optional() }).nullish(),
  }),
});

/** Salida facturable de una respuesta. Lo normal (OpenAI, DeepSeek) es que reasoning_tokens
 * vaya DENTRO de completion_tokens y no se sume aparte. Decisión de implementación del 22 oct
 * (smoke 052): grok-4.7 lo informa FUERA (total_tokens = prompt + completion + reasoning, p. ej.
 * 44 + 9 + 75 = 128); solo en ese caso, detectado por total_tokens, se suma a la salida para
 * no subestimar el consumo. No se crea un campo nuevo en UsoLlm. */
export function salidaFacturable(usage: z.infer<typeof esquemaUso>["usage"]): number {
  const razonamiento = usage.completion_tokens_details?.reasoning_tokens ?? 0;
  const fuera = razonamiento > 0 && usage.total_tokens !== undefined && usage.total_tokens === usage.prompt_tokens + usage.completion_tokens + razonamiento;
  return usage.completion_tokens + (fuera ? razonamiento : 0);
}

export function urlFoundryModelos(cfg: Pick<ConfigFoundryModelos, "endpoint" | "apiVersion">): string {
  const base = cfg.endpoint.replace(/\/+$/, "");
  return `${base}/models/chat/completions?api-version=${encodeURIComponent(cfg.apiVersion ?? API_VERSION_FOUNDRY_MODELOS)}`;
}

const ABRE = "<think>", CIERRA = "</think>";

/** Gramática cerrada de la envoltura de razonamiento (brief 052 v1.1 §1). Solo se reconoce
 * la envoltura inicial; nunca se borra texto dentro del resto, así que una cadena legítima
 * del JSON no se altera.
 * - `(<think>…</think>)+ resto` (bloques completos al inicio) ⇒ `resto` recortado.
 * - `… </think> resto` sin ninguna apertura ⇒ se descarta hasta el ÚLTIMO `</think>`.
 * - `<think>` sin cierre posterior, en cualquier posición ⇒ lanza (equivale a truncado).
 * - marcadores después del inicio del resto ⇒ lanza.
 * - sin marcadores ⇒ idéntico (recortado). */
export function limpiarRespuestaModelo(texto: string): string {
  if (texto.lastIndexOf(ABRE) >= 0 && texto.lastIndexOf(ABRE) > texto.lastIndexOf(CIERRA)) throw new Error("Foundry Models: razonamiento sin cerrar");
  let resto = texto.trimStart();
  if (!texto.includes(ABRE)) {
    if (texto.includes(CIERRA)) resto = texto.slice(texto.lastIndexOf(CIERRA) + CIERRA.length);
  } else {
    while (resto.startsWith(ABRE)) {
      const fin = resto.indexOf(CIERRA);
      if (fin < 0) throw new Error("Foundry Models: razonamiento sin cerrar");
      resto = resto.slice(fin + CIERRA.length).trimStart();
    }
  }
  if (resto.includes(ABRE) || resto.includes(CIERRA)) throw new Error("Foundry Models: marcadores de razonamiento fuera de la envoltura");
  return resto.trim();
}

/** Modo `texto` (brief 052 v1.1 §1–2): si hay una valla ```json … ``` devuelve el contenido
 * de la primera; si no, el ÚLTIMO objeto `{…}` balanceado de nivel superior (contando llaves
 * fuera de cadenas: la respuesta final va al final y un ejemplo previo no gana). Sin objeto
 * devuelve el texto tal cual: no lanza, para que el reintento del controlador lo corrija igual
 * que una cadena JSON inválida de Azure OpenAI. No repara JSON. */
export function extraerObjetoJson(texto: string): string {
  const valla = texto.match(/```(?:json)?[ \t]*\r?\n?([\s\S]*?)```/i);
  if (valla) return valla[1]!.trim();
  let ultimo: string | undefined, inicio = -1, profundidad = 0, enCadena = false, escape = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (profundidad > 0 && enCadena) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') enCadena = false;
      continue;
    }
    if (c === "{") { if (profundidad++ === 0) inicio = i; }
    else if (profundidad > 0 && c === '"') enCadena = true;
    else if (profundidad > 0 && c === "}" && --profundidad === 0) ultimo = texto.slice(inicio, i + 1);
  }
  return ultimo ?? texto;
}

function formatoRespuesta(formato: FormatoJsonFoundryModelos, esquema: OpcionesLlm["esquema"]): Record<string, unknown> | undefined {
  if (formato === "texto") return undefined;
  if (formato === "json_schema" && esquema) return { type: "json_schema", json_schema: { name: esquema.nombre, strict: true, schema: esquema.json } };
  return { type: "json_object" };
}

export function crearLlmFoundryModelos(cfg: ConfigFoundryModelos): Llm {
  const transporte = cfg.fetch ?? fetch;
  const formato = cfg.formatoJson ?? "json_object";
  const uso: UsoLlm = { llamadas: 0, respuestasConUso: 0, entrada: 0, salida: 0, cache: 0 };
  return {
    id: `foundry-modelos:${cfg.deployment}${cfg.esfuerzoRazonamiento ? `:reasoning-${cfg.esfuerzoRazonamiento}` : ""}`,
    uso: () => ({ ...uso }),
    async completar(system: string, mensajes: Mensaje[], opciones?: OpcionesLlm): Promise<string> {
      uso.llamadas++;
      if (opciones?.maxTokens !== undefined && (!Number.isInteger(opciones.maxTokens) || opciones.maxTokens < 1 || opciones.maxTokens > MAX_TOKENS_TOPE_FOUNDRY_MODELOS)) throw new Error("Presupuesto de salida inválido");
      const responseFormat = formatoRespuesta(formato, opciones?.esquema);
      const r = await transporte(urlFoundryModelos(cfg), {
        method: "POST",
        headers: { "content-type": "application/json", "api-key": cfg.apiKey },
        ...(opciones?.signal ? { signal: opciones.signal } : {}),
        body: JSON.stringify({
          model: cfg.deployment,
          messages: [{ role: "system", content: system }, ...mensajes.map((m) => ({ role: m.rol, content: m.contenido }))],
          max_tokens: opciones?.maxTokens ?? MAX_TOKENS_FOUNDRY_MODELOS,
          ...(cfg.esfuerzoRazonamiento ? { reasoning_effort: cfg.esfuerzoRazonamiento } : {}),
          ...(responseFormat ? { response_format: responseFormat } : {}),
        }),
      });
      if (!r.ok) {
        // Redacción con la clave efectiva ANTES de recortar (brief 052 v1.1 §7).
        const detalle = (await r.text().catch(() => "")).split(cfg.apiKey).join("[REDACTED]");
        const motivo = r.status === 401 ? "clave rechazada" : r.status === 429 ? "cuota o límite de tasa" : r.status >= 500 ? "error del servicio" : "petición rechazada";
        throw new Error(`Foundry Models ${r.status} (${motivo})${detalle ? `: ${detalle.slice(0, 200)}` : ""}`);
      }
      let json: unknown;
      try {
        json = await r.json();
      } catch {
        throw new Error("Foundry Models: la respuesta no es JSON");
      }
      const consumo = esquemaUso.safeParse(json);
      if (consumo.success) {
        uso.respuestasConUso++;
        uso.entrada += consumo.data.usage.prompt_tokens;
        uso.salida += salidaFacturable(consumo.data.usage);
        uso.cache += consumo.data.usage.prompt_tokens_details?.cached_tokens ?? 0;
      }
      const v = esquemaRespuesta.safeParse(json);
      if (!v.success) throw new Error(`Foundry Models: respuesta malformada (${v.error.issues.map((i) => i.path.join(".") || "(raíz)").join(", ")})`);
      const eleccion = v.data.choices[0] as z.infer<typeof esquemaRespuesta>["choices"][number];
      if (eleccion.finish_reason === "length") throw new Error("Foundry Models: respuesta truncada (finish_reason = length)");
      if (eleccion.finish_reason === "content_filter") throw new Error("Foundry Models: respuesta bloqueada por el filtro de contenido");
      if (eleccion.message.content === null || eleccion.message.content.trim() === "") throw new Error("Foundry Models: respuesta vacía");
      const limpio = limpiarRespuestaModelo(eleccion.message.content);
      if (limpio === "") throw new Error("Foundry Models: respuesta vacía");
      return formato === "texto" ? extraerObjetoJson(limpio) : limpio;
    },
  };
}
