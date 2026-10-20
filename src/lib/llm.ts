// La costura LLM (brief 003): TODO acceso a un modelo de lenguaje pasa por aquí.
// La cadena solo conoce la interfaz `Llm`; la implementación se elige por env
// CRONISTA_LLM=stub|foundry|azure-openai|ensayo (stub por defecto: $0, offline, determinista).
//
// Agregar una implementación nueva (p. ej. Azure OpenAI para el bake-off con
// GPT-6.1 Sol) es: un archivo `llm-<nombre>.ts` que devuelva un `Llm`, y un `case`
// en `crearLlmDesdeEnv`. La cadena no cambia una línea.

import { crearLlmAzureOpenAI, ESFUERZOS_AZURE_OPENAI, type EsfuerzoAzureOpenAI } from "./llm-azure-openai";
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
  /** Consumo comunicado por el proveedor, sin estimar costos. */
  uso?: () => UsoLlm;
  completar(system: string, mensajes: Mensaje[], opciones?: OpcionesLlm): Promise<string>;
}
export interface OpcionesLlm { signal?: AbortSignal; esquema?: { nombre: string; json: Record<string, unknown> }; maxTokens?: number }
export interface UsoLlm { llamadas: number; respuestasConUso: number; entrada: number; salida: number; cache: number }

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
export function crearLlmDesdeEnv(env: Env = process.env, opciones: { maxRetries?: number } = {}): Llm {
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
        ...(opciones.maxRetries !== undefined ? { maxRetries: opciones.maxRetries } : {}),
      });
    case "azure-openai": {
      const apiVersion = opcional(env, "AZURE_OPENAI_API_VERSION");
      const reasoningEffort = opcional(env, "AZURE_OPENAI_REASONING_EFFORT");
      if (reasoningEffort && !(ESFUERZOS_AZURE_OPENAI as readonly string[]).includes(reasoningEffort)) {
        throw new Error(`AZURE_OPENAI_REASONING_EFFORT debe ser ${ESFUERZOS_AZURE_OPENAI.join(" | ")}`);
      }
      return crearLlmAzureOpenAI({
        apiKey: requerida(env, "AZURE_OPENAI_API_KEY", "azure-openai"),
        endpoint: requerida(env, "AZURE_OPENAI_ENDPOINT", "azure-openai"),
        deployment: requerida(env, "AZURE_OPENAI_DEPLOYMENT", "azure-openai"),
        ...(apiVersion ? { apiVersion } : {}),
        ...(reasoningEffort ? { reasoningEffort: reasoningEffort as EsfuerzoAzureOpenAI } : {}),
      });
    }
    default:
      throw new Error(`CRONISTA_LLM="${tipo}" no existe; valores válidos: ${TIPOS_LLM.join(", ")}`);
  }
}

/** Brief 034: instancias separadas, mismas credenciales por defecto. Sobreescribir
 * ARENA_LOCAL_LLM / ARENA_VISITA_LLM y ARENA_<LADO>_<VARIABLE_ORIGINAL> para otro
 * proveedor/deployment. No modifica process.env ni el Writer. */
export function crearLlmEquipoDesdeEnv(lado: "local" | "visita", env: Env = process.env): Llm {
  const prefijo = `ARENA_${lado.toUpperCase()}_`;
  const configuracion = { ...env };
  for (const key of ["FOUNDRY_API_KEY", "FOUNDRY_BASE_URL", "FOUNDRY_DEPLOYMENT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_DEPLOYMENT", "AZURE_OPENAI_API_VERSION", "AZURE_OPENAI_REASONING_EFFORT"]) {
    if (env[prefijo + key] !== undefined) configuracion[key] = env[prefijo + key];
  }
  configuracion.CRONISTA_LLM = (env[prefijo + "LLM"] ?? env.CRONISTA_LLM ?? "stub").trim();
  if (configuracion.CRONISTA_LLM !== "foundry" && configuracion.CRONISTA_LLM !== "azure-openai") {
    throw new Error("Arena LLM necesita azure-openai o foundry; el modo programado se elige por separado");
  }
  return crearLlmDesdeEnv(configuracion, { maxRetries: 0 });
}

let porDefecto: Llm | undefined;

/** API del brief: `completar(system, mensajes)` con el LLM que elija el entorno. */
export function completar(system: string, mensajes: Mensaje[]): Promise<string> {
  porDefecto ??= crearLlmDesdeEnv();
  return porDefecto.completar(system, mensajes);
}
