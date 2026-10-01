// LLMs falsos para los fixtures del 003 (a)–(g), inyectados por la costura `Llm`.
// Parten de la salida CORRECTA (la del stub) y la corrompen de una forma concreta.
// Solo para pruebas: jamás alimentan la demo (regla de honestidad del 006).

import type { Hecho } from "../../analista/tipos";
import type { Llm, Mensaje } from "../../lib/llm";
import { borradorDesdeHechos } from "../../lib/llm-stub";
import type { CronicaDraft } from "../tipos";

export type Corruptor = (d: CronicaDraft, hechos: Hecho[]) => CronicaDraft | string;

/** Copia profunda para que cada corruptor trabaje sobre su propio borrador. */
const copia = (d: CronicaDraft): CronicaDraft => JSON.parse(JSON.stringify(d)) as CronicaDraft;

export interface LlmGuionado extends Llm {
  /** Conversaciones recibidas, una por llamada. */
  llamadas: Mensaje[][];
}

/**
 * Un LLM que en la llamada k aplica el guion[k] (o el último, si hay más llamadas):
 * - un Corruptor ⇒ toma el borrador correcto y lo corrompe;
 * - "ok" ⇒ devuelve el borrador correcto;
 * - un Error ⇒ la llamada falla (red, cuota…).
 */
export function llmGuionado(guion: (Corruptor | "ok" | Error)[], id = "falso"): LlmGuionado {
  const llamadas: Mensaje[][] = [];
  return {
    id,
    llamadas,
    async completar(_system: string, mensajes: Mensaje[]): Promise<string> {
      llamadas.push(mensajes.map((m) => ({ ...m })));
      const paso = guion[Math.min(llamadas.length - 1, guion.length - 1)];
      const inicial = mensajes.find((m) => m.rol === "user")?.contenido ?? "";
      const correcto = borradorDesdeHechos(inicial);
      if (paso instanceof Error) throw paso;
      if (paso === "ok" || paso === undefined) return JSON.stringify(correcto);
      const hechos = JSON.parse(inicial.slice(inicial.indexOf("<hechos>") + 8, inicial.indexOf("</hechos>"))) as Hecho[];
      const r = paso(copia(correcto), hechos);
      return typeof r === "string" ? r : JSON.stringify(r);
    },
  };
}

/** Índice de la oración cuyo hecho principal es el primer hecho del tipo dado. */
export function indiceDe(d: CronicaDraft, hechos: Hecho[], tipo: string): number {
  const id = hechos.find((h) => h.tipo === tipo)?.id;
  const i = d.oraciones.findIndex((o) => id !== undefined && o.hecho === id);
  if (i < 0) throw new Error(`fixture: no hay oración que narre un ${tipo}`);
  return i;
}

/** Índice de la oración cuyo hecho principal tiene este id. */
export function indiceDeId(d: CronicaDraft, id: string): number {
  const i = d.oraciones.findIndex((o) => o.hecho === id);
  if (i < 0) throw new Error(`fixture: no hay oración que narre ${id}`);
  return i;
}

// ---- corruptores (uno por regla) ----

/** (b) número inventado en una oración (mismo número en ES y EN: solo V3, no V6). */
export const NUMERO_INVENTADO = 37;
export const numeroInventado =
  (tipo = "gol_anotado"): Corruptor =>
  (d, hechos) => {
    const o = d.oraciones[indiceDe(d, hechos, tipo)]!;
    o.texto_es += ` Hubo ${NUMERO_INVENTADO} remates en esa jugada.`;
    o.texto_en += ` There were ${NUMERO_INVENTADO} shots in that move.`;
    return d;
  };

/** (c) jugador fantasma: un nombre que no está en ningún hecho. */
export const FANTASMA = "Rodrigo Fantasmín";
export const jugadorFantasma: Corruptor = (d, hechos) => {
  const o = d.oraciones[indiceDe(d, hechos, "gol_anotado")]!;
  o.texto_es += ` La jugada la armó ${FANTASMA}.`;
  o.texto_en += ` The move was set up by ${FANTASMA}.`;
  return d;
};

/** (d) una oración sin hecho principal. */
export const oracionSinCita: Corruptor = (d, hechos) => {
  d.oraciones[indiceDe(d, hechos, "justicia_xg")]!.hecho = "";
  return d;
};

/** (e) cobertura incompleta: se cae la oración de un gol (relevancia ≥ COBERTURA). */
export const sinUnGol: Corruptor = (d, hechos) => {
  d.oraciones.splice(indiceDe(d, hechos, "gol_anotado"), 1);
  return d;
};

/** (f) JSON roto. */
export const jsonRoto: Corruptor = (d) => JSON.stringify(d).slice(0, -12);
