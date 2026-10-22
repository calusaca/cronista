// La costura LLM (brief 003): TODO acceso a un modelo de lenguaje pasa por aquí.
// La cadena solo conoce la interfaz `Llm`; la implementación se elige por env
// CRONISTA_LLM=stub|foundry|azure-openai|foundry-modelos|ensayo (stub por defecto: $0, offline, determinista).
//
// Agregar una implementación nueva (p. ej. Azure OpenAI para el bake-off con
// GPT-6.1 Sol) es: un archivo `llm-<nombre>.ts` que devuelva un `Llm`, y un `case`
// en `crearLlmDesdeEnv`. La cadena no cambia una línea.

import { crearLlmAzureOpenAI, ESFUERZOS_AZURE_OPENAI, type EsfuerzoAzureOpenAI } from "./llm-azure-openai";
import { crearLlmEnsayo } from "./llm-ensayo";
import { crearLlmFoundry } from "./llm-foundry";
import { crearLlmFoundryModelos, ESFUERZOS_FOUNDRY_MODELOS, FORMATOS_JSON_FOUNDRY_MODELOS, type EsfuerzoFoundryModelos, type FormatoJsonFoundryModelos } from "./llm-foundry-modelos";
import { crearLlmStub } from "./llm-stub";

export interface Mensaje {
  rol: "user" | "assistant";
  contenido: string;
}

export interface Llm {
  /**
   * Identidad estable del modelo para la caché `(seed, deployment, modo)`:
   * "stub", "foundry:<deployment>", "azure-openai:<deployment>" o
   * "foundry-modelos:<deployment>". Cambiar de backend o de
   * deployment invalida la caché sola.
   */
  readonly id: string;
  /** Consumo comunicado por el proveedor, sin estimar costos. */
  uso?: () => UsoLlm;
  completar(system: string, mensajes: Mensaje[], opciones?: OpcionesLlm): Promise<string>;
}
export interface OpcionesLlm { signal?: AbortSignal; esquema?: { nombre: string; json: Record<string, unknown> }; maxTokens?: number }
export interface UsoLlm { llamadas: number; respuestasConUso: number; entrada: number; salida: number; cache: number }

export type TipoLlm = "stub" | "foundry" | "azure-openai" | "foundry-modelos" | "ensayo";
/** "ensayo" es un fixture de pruebas (e2e de la UI): jamás alimenta la demo. */
export const TIPOS_LLM: readonly TipoLlm[] = ["stub", "foundry", "azure-openai", "foundry-modelos", "ensayo"];

/** Brief 052: variables que un catálogo (`ARENA_<ID>_…`) o un lado de la arena
 * (`ARENA_<LADO>_…`) puede sobreescribir por prefijo. Única lista para ambos usos. */
export const CLAVES_LLM_POR_PREFIJO = [
  "FOUNDRY_API_KEY", "FOUNDRY_BASE_URL", "FOUNDRY_DEPLOYMENT",
  "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_DEPLOYMENT", "AZURE_OPENAI_API_VERSION", "AZURE_OPENAI_REASONING_EFFORT",
  "FOUNDRY_MODELOS_ENDPOINT", "FOUNDRY_MODELOS_API_KEY", "FOUNDRY_MODELOS_DEPLOYMENT", "FOUNDRY_MODELOS_FORMATO_JSON", "FOUNDRY_MODELOS_API_VERSION", "FOUNDRY_MODELOS_ESFUERZO_RAZONAMIENTO",
] as const;

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
    case "foundry-modelos": {
      const formatoJson = opcional(env, "FOUNDRY_MODELOS_FORMATO_JSON");
      if (formatoJson && !(FORMATOS_JSON_FOUNDRY_MODELOS as readonly string[]).includes(formatoJson)) {
        throw new Error(`FOUNDRY_MODELOS_FORMATO_JSON debe ser ${FORMATOS_JSON_FOUNDRY_MODELOS.join(" | ")}`);
      }
      const apiVersion = opcional(env, "FOUNDRY_MODELOS_API_VERSION");
      const esfuerzo = opcional(env, "FOUNDRY_MODELOS_ESFUERZO_RAZONAMIENTO");
      if (esfuerzo && !(ESFUERZOS_FOUNDRY_MODELOS as readonly string[]).includes(esfuerzo)) {
        throw new Error(`FOUNDRY_MODELOS_ESFUERZO_RAZONAMIENTO debe ser ${ESFUERZOS_FOUNDRY_MODELOS.join(" | ")}`);
      }
      return crearLlmFoundryModelos({
        apiKey: requerida(env, "FOUNDRY_MODELOS_API_KEY", "foundry-modelos"),
        endpoint: requerida(env, "FOUNDRY_MODELOS_ENDPOINT", "foundry-modelos"),
        deployment: requerida(env, "FOUNDRY_MODELOS_DEPLOYMENT", "foundry-modelos"),
        ...(formatoJson ? { formatoJson: formatoJson as FormatoJsonFoundryModelos } : {}),
        ...(apiVersion ? { apiVersion } : {}),
        ...(esfuerzo ? { esfuerzoRazonamiento: esfuerzo as EsfuerzoFoundryModelos } : {}),
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
  for (const key of CLAVES_LLM_POR_PREFIJO) {
    if (env[prefijo + key] !== undefined) configuracion[key] = env[prefijo + key];
  }
  configuracion.CRONISTA_LLM = (env[prefijo + "LLM"] ?? env.CRONISTA_LLM ?? "stub").trim();
  if (!["foundry", "azure-openai", "foundry-modelos"].includes(configuracion.CRONISTA_LLM)) {
    throw new Error("Arena LLM necesita azure-openai, foundry o foundry-modelos; el modo programado se elige por separado");
  }
  return crearLlmDesdeEnv(configuracion, { maxRetries: 0 });
}

/** Brief 045 v3.1 · Presupuesto de llamadas compartido: cuenta cada invocación de
 * `completar` (también las que agotan plazo o fallan) y, al alcanzar `max`, lanza sin
 * llamar al modelo. Delega `id` y `uso`. Cuenta llamadas, no tokens ni coste. */
export function conPresupuesto(llm: Llm, max: number): Llm {
  let llamadas = 0;
  return {
    id: llm.id,
    ...(llm.uso ? { uso: () => llm.uso!() } : {}),
    async completar(system, mensajes, opciones) {
      if (llamadas >= max) throw new Error("Presupuesto de llamadas agotado");
      llamadas++;
      return llm.completar(system, mensajes, opciones);
    },
  };
}

let porDefecto: Llm | undefined;

/** API del brief: `completar(system, mensajes)` con el LLM que elija el entorno. */
export function completar(system: string, mensajes: Mensaje[]): Promise<string> {
  porDefecto ??= crearLlmDesdeEnv();
  return porDefecto.completar(system, mensajes);
}
