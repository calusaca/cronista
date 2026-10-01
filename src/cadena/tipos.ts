// Contrato de la cadena Cronista ⇄ Verificador — brief 003 (+ campo `audit` del 006).
// Los nombres y propiedades de este archivo NO se cambian sin actualizar el brief.

/** Revisión 3.1: una oración narra UN hecho (el principal); el apoyo solo amplía el resaltado en la UI. */
export interface Oracion {
  texto_es: string;
  texto_en: string;
  hecho: string; // EL hecho que esta oración narra (exactamente uno)
  apoyo?: string[]; // hechos de contexto; no habilitan cifras, nombres ni juicios
}

export interface CronicaDraft {
  titulo_es: string;
  titulo_en: string;
  oraciones: Oracion[];
}

export type Regla = "V1" | "V2" | "V3" | "V4" | "V5" | "V6" | "V7" | "V8";

/**
 * Motivo de rechazo. `oracion` es el índice (desde 0) de la oración rechazada;
 * convención del implementador: −1 cuando el motivo no es de una oración concreta
 * (V1 salida ilegible, V5 cobertura, o un problema del TÍTULO, que el detalle nombra).
 */
export type Motivo = { oracion: number; regla: Regla; detalle: string };

/** Brief 006 §1: el pipeline guarda su propia historia. */
export interface IntentoAudit {
  n: 1 | 2 | 3;
  borrador: CronicaDraft; // lo que el Cronista entregó (vacío si no parseaba: ver `crudo`)
  veredicto: Motivo[]; // vacío = aprobado
  feedback?: string; // lo que se le devolvió al Cronista
  /** Extensión del implementador: la salida tal cual, SOLO cuando no se pudo leer como CronicaDraft (V1). */
  crudo?: string;
}

export interface CronicaVerificada extends CronicaDraft {
  intentos: number; // 1–3 (0 solo en el acta forzada por el usuario, sin llamar al LLM)
  frasesOmitidas: number; // rechazadas sin reemplazo válido
  modo: "llm" | "acta"; // "acta" = fallback sin LLM
  audit: IntentoAudit[]; // 006: SIEMPRE presente, también con 1 intento
}

/**
 * Personalización del 007 que entra en la clave de caché (seed, deployment, modo):
 * la crónica neutral, o la de «mi equipo» contada para la afición del local o la visita.
 * Se llama `ModoPersonalizacion` para no confundirlo con `CronicaVerificada.modo`
 * ("llm" | "acta"), que es otra cosa.
 */
export type ModoPersonalizacion = "neutral" | "equipo:local" | "equipo:visita";

export const MODOS_PERSONALIZACION: readonly ModoPersonalizacion[] = ["neutral", "equipo:local", "equipo:visita"];
