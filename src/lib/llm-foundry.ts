// Implementación real: Claude vía Microsoft Foundry (brief 003).
// - SDK @anthropic-ai/foundry-sdk ^0.5, endpoint https://<recurso>.services.ai.azure.com/anthropic
// - apiVersion "2023-06-01" (cabecera anthropic-version, fijada explícitamente)
// - modelo = NOMBRE DEL DEPLOYMENT (FOUNDRY_DEPLOYMENT), no el id del modelo
// - PROHIBIDO enviar `temperature` o `top_k`: Foundry los rechaza en Claude 5.x
// - thinking: { type: "adaptive" }
// La clave llega por env y jamás sale del servidor.
//
// Sin cuenta de Azure todavía: esta implementación está escrita completa y se prueba
// OFFLINE inyectando `fetch` (forma de la petición, cabeceras, parámetros prohibidos).
// El smoke real está documentado en docs/smoke-foundry.md.

import { AnthropicFoundry } from "@anthropic-ai/foundry-sdk";
import type { Llm, Mensaje } from "./llm";

/** Techo de tokens de salida (incluye el pensamiento adaptativo). Config del cliente, no un umbral. */
export const MAX_TOKENS_FOUNDRY = 16_000;
export const API_VERSION_FOUNDRY = "2023-06-01";

export interface ConfigFoundry {
  apiKey: string;
  /** p. ej. https://<recurso>.services.ai.azure.com/anthropic */
  baseURL: string;
  /** Nombre del deployment en Foundry (p. ej. claude-sonnet-5). */
  deployment: string;
  /** Solo para pruebas: transporte HTTP inyectado. */
  fetch?: typeof fetch;
  maxRetries?: number;
}

export function crearLlmFoundry(cfg: ConfigFoundry): Llm {
  const cliente = new AnthropicFoundry({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
    defaultHeaders: { "anthropic-version": API_VERSION_FOUNDRY },
    ...(cfg.fetch ? { fetch: cfg.fetch } : {}),
    ...(cfg.maxRetries !== undefined ? { maxRetries: cfg.maxRetries } : {}),
  });
  return {
    id: `foundry:${cfg.deployment}`,
    async completar(system: string, mensajes: Mensaje[], opciones?: { signal?: AbortSignal }): Promise<string> {
      const respuesta = await cliente.messages.create({
        model: cfg.deployment,
        max_tokens: MAX_TOKENS_FOUNDRY,
        system,
        thinking: { type: "adaptive" },
        messages: mensajes.map((m) => ({ role: m.rol, content: m.contenido })),
        // Sin temperature ni top_k: Foundry los rechaza (brief 003).
      }, opciones?.signal ? { signal: opciones.signal } : undefined);
      return respuesta.content
        .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("");
    },
  };
}
