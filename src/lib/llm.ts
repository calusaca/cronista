// La costura LLM (brief 003): TODO acceso a un modelo de lenguaje pasa por aquí.
// La cadena solo conoce la interfaz `Llm`; la implementación se elige por env
// CRONISTA_LLM=stub|foundry|azure-openai|ensayo (stub por defecto: $0, offline, determinista).
//
// Agregar una implementación nueva (p. ej. Azure OpenAI para el bake-off con
// GPT-6.1 Sol) es: un archivo `llm-<nombre>.ts` que devuelva un `Llm`, y un `case`
// en `crearLlmDesdeEnv`. La cadena no cambia una línea.

import { crearLlmAzureOpenAI } from "./llm-azure-openai";
import { crearLlmEnsayo } from "./llm-ensayo";
import { crearLlmFoundry } from "./llm-foundry";
import { crearLlmStub } from "./llm-stub";

export interface Mensaje {
  rol: "user" | "assistant";
  contenido: string;
}

export interface Llm {
  /**
   * Identidad estable del modelo para la caché `(seed, deployment, modo)`:
   * "stub", "foundry:<deployment>" o "azure-openai:<deployment>". Cambiar de backend o de
   * deployment invalida la caché sola.
   */
  readonly id: string;
  completar(system: string, mensajes: Mensaje[]): Promise<string>;
}

export type TipoLlm = "stub" | "foundry" | "azure-openai" | "ensayo";
/** "ensayo" es un fixture de pruebas (e2e de la UI): jamás alimenta la demo. */
export const TIPOS_LLM: readonly TipoLlm[] = ["stub", "foundry", "azure-openai", "ensayo"];

type Env = Record<string, string | undefined>;

function requerida(env: Env, nombre: string, tipo: TipoLlm = "foundry"): string {
  const v = env[nombre];
  if (v === undefined || v.trim() === "") {
    throw new Error(`CRONISTA_LLM=${tipo} necesita la variable ${nombre} (ver .env.example)`);
  }
  return v.trim();
}

/** Brief 023: opcional (con default documentado en el backend); vacía cuenta como ausente. */
const opcional = (env: Env, nombre: string): string | undefined => (env[nombre]?.trim() ? (env[nombre] as string).trim() : undefined);

/** Construye el LLM que pide el entorno. Lanza con un mensaje claro si falta config. */
export function crearLlmDesdeEnv(env: Env = process.env): Llm {
  const tipo = (env.CRONISTA_LLM ?? "stub").trim() || "stub";
  switch (tipo) {
    case "stub":
      return crearLlmStub();
    case "ensayo":
      return crearLlmEnsayo();
    case "foundry":
      return crearLlmFoundry({
        apiKey: requerida(env, "FOUNDRY_API_KEY"),
        baseURL: requerida(env, "FOUNDRY_BASE_URL"),
        deployment: requerida(env, "FOUNDRY_DEPLOYMENT"),
      });
    case "azure-openai": {
      const apiVersion = opcional(env, "AZURE_OPENAI_API_VERSION");
      return crearLlmAzureOpenAI({
        apiKey: requerida(env, "AZURE_OPENAI_API_KEY", "azure-openai"),
        endpoint: requerida(env, "AZURE_OPENAI_ENDPOINT", "azure-openai"),
        deployment: requerida(env, "AZURE_OPENAI_DEPLOYMENT", "azure-openai"),
        ...(apiVersion ? { apiVersion } : {}),
      });
    }
    default:
      throw new Error(`CRONISTA_LLM="${tipo}" no existe; valores válidos: ${TIPOS_LLM.join(", ")}`);
  }
}

let porDefecto: Llm | undefined;

/** API del brief: `completar(system, mensajes)` con el LLM que elija el entorno. */
export function completar(system: string, mensajes: Mensaje[]): Promise<string> {
  porDefecto ??= crearLlmDesdeEnv();
  return porDefecto.completar(system, mensajes);
}
