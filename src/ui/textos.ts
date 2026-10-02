// Textos del chrome de la UI (en inglés: el jurado es internacional, brief 004).
// La crónica en sí alterna ES/EN; esto es solo la interfaz.

import type { Regla } from "../cadena/tipos";
import type { Evento, Lado } from "../sim/tipos";

export const NOMBRE_EVENTO: Record<Evento["tipo"], string> = {
  inicio_periodo: "Kick-off",
  fin_periodo: "End of half",
  pase_clave: "Key pass",
  tiro: "Shot",
  gol: "Goal",
  atajada: "Saved",
  falta: "Foul",
  tarjeta_amarilla: "Yellow card",
  tarjeta_roja: "Red card",
  corner: "Corner",
  fuera_de_juego: "Offside",
  cambio: "Substitution",
};

/** Brief 010: rótulo corto del chip de cada evento en la línea de tiempo (se muestra en versalitas). */
export const CHIP_EVENTO: Record<Evento["tipo"], string> = {
  inicio_periodo: "Kick-off",
  fin_periodo: "End",
  pase_clave: "Key pass",
  tiro: "Shot",
  gol: "Goal",
  atajada: "Save",
  falta: "Foul",
  tarjeta_amarilla: "Yellow",
  tarjeta_roja: "Red",
  corner: "Corner",
  fuera_de_juego: "Offside",
  cambio: "Sub",
};

/** Qué rechaza cada regla del Verificador, en palabras (006: «la regla con su explicación»). */
export const REGLA_EN: Record<Regla, string> = {
  V1: "The writer's output was not valid JSON in the required shape.",
  V2: "The sentence cites a fact that does not exist, or none at all.",
  V3: "A number, score, margin or period that its fact does not state.",
  V4: "A name that is not in its fact, or a word the verifier does not allow.",
  V5: "A required fact is not narrated, or the sentence does not narrate its fact.",
  V6: "Spanish and English disagree on the figures, or one of them is empty.",
  V7: "It asserts an absence; no fact records absences.",
  V8: "A judgement, result verb or claim that its fact does not support.",
};

/** Descripción corta de un evento para la línea de tiempo. */
export function describirEvento(e: Evento): string {
  const quien = e.jugador ?? "";
  switch (e.tipo) {
    case "tiro":
      return `${NOMBRE_EVENTO.tiro}${e.penal ? " (penalty)" : ""} · ${quien} · xG ${(e.xg ?? 0).toFixed(2)}`;
    case "gol":
      return `${NOMBRE_EVENTO.gol} · ${quien}`;
    case "atajada":
      return "Shot saved";
    case "cambio":
      return `On ${quien}${e.sale ? `, off ${e.sale}` : ""}`;
    default:
      return quien ? `${NOMBRE_EVENTO[e.tipo]} · ${quien}` : NOMBRE_EVENTO[e.tipo];
  }
}

export const siglas = (nombre: string) =>
  nombre
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

export const ladoTexto = (l: Lado) => (l === "local" ? "home" : "away");

/** Brief 009: motivo de cada delta del desglose de una nota. */
export const MOTIVO_VALORACION_EN: Record<string, string> = {
  gol: "Goal",
  gol_dificil: "Difficult finish (low xG)",
  tiro_atajado: "Shot on target (saved)",
  pase_clave: "Key pass",
  corner: "Corner",
  amarilla: "Yellow card",
  roja: "Red card",
  falta: "Foul",
  fuera_de_juego: "Offside",
  atajada: "Save",
  xg_atajado: "xG of the saved shot",
  gol_recibido: "Goal conceded",
};

export const POSICION_EN: Record<string, string> = { POR: "GK", DEF: "DF", MED: "MF", DEL: "FW" };
