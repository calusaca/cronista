// Modo Analista (brief 007): la MISMA crónica con los datos duros expuestos — xG por frase,
// citas de eventos expandidas y los hechos que la crónica no usó. Funciones puras sobre lo
// que ya está en la página: cero llamadas al LLM (lo prueba un espía sobre la costura).

import type { Hecho } from "../analista/tipos";
import type { CronicaVerificada } from "../cadena/tipos";
import { hechosDeOracion } from "./evidencia";

export interface DatoDuro {
  clave: string;
  etiqueta: string; // en inglés: es chrome
  valor: string;
  esXg: boolean;
}

/** Valores internos del Analista ⇒ palabras del chrome (en inglés). Las cifras no se tocan. */
const LEGIBLE: Record<string, string> = {
  doble_amarilla: "second yellow",
  roja_directa: "straight red",
  victoria: "win",
  empate: "draw",
  si: "yes",
  no: "no",
};
/** Brief 013: el canal en el chrome (inglés). */
const CANAL_EN: Record<string, string> = { banda_izquierda: "left flank", centro: "middle", banda_derecha: "right flank" };
const fmt = (v: string | number) => (typeof v === "number" ? String(v) : (LEGIBLE[v] ?? v));

/** Datos duros del hecho principal de una frase, en el orden en que un analista los lee. */
export function datosDuros(h: Hecho): DatoDuro[] {
  const d = h.datos;
  const out: DatoDuro[] = [];
  const add = (clave: string, etiqueta: string, esXg = false) => {
    const v = d[clave];
    if (v !== undefined && v !== "") out.push({ clave, etiqueta, valor: fmt(v), esXg });
  };
  add("minuto", "Minute");
  add("xg", "xG", true);
  if (d.xg_local !== undefined) out.push({ clave: "xg_local", etiqueta: `xG ${String(d.local ?? "home")}`, valor: fmt(d.xg_local), esXg: true });
  if (d.xg_visita !== undefined) out.push({ clave: "xg_visita", etiqueta: `xG ${String(d.visita ?? "away")}`, valor: fmt(d.xg_visita), esXg: true });
  add("xg_atajado", "xG saved", true);
  add("penal", "Penalty");
  add("atajadas", "Saves");
  add("tiros", "Shots");
  // Brief 013: el mismo campo significa cosas distintas según el hecho.
  add("porcentaje", h.tipo === "dominio_global" ? "Possession % (by passes)" : h.tipo === "dominio_por_canal" ? "Share of attacks %" : "Share of attacking actions %");
  // Brief 013 — desglose recomputable de los hechos de la capa micro.
  add("regates", "Successful dribbles");
  add("perdidas", "Losses playing out");
  if (d.canal !== undefined) out.push({ clave: "canal", etiqueta: "Channel", valor: CANAL_EN[String(d.canal)] ?? String(d.canal), esXg: false });
  add("pases_equipo", "Passes (team)");
  add("pases_total", "Passes (both)");
  add("pases_equipo_p1", "Passes 1st half (team)");
  add("pases_total_p1", "Passes 1st half (both)");
  add("pases_equipo_p2", "Passes 2nd half (team)");
  add("pases_total_p2", "Passes 2nd half (both)");
  add("avances_izquierda", "Attacks left");
  add("avances_centro", "Attacks centre");
  add("avances_derecha", "Attacks right");
  add("avances_total", "Attacks total");
  add("amarillas", "Yellow cards");
  add("goles", "Goals");
  add("motivo", "Sending-off");
  add("desenlace", "Outcome");
  return out;
}

/** Hechos del Analista que la crónica no usó (ni como principal ni como apoyo). */
export function hechosNoUsados(cronica: CronicaVerificada, hechos: Hecho[]): Hecho[] {
  const usados = new Set(cronica.oraciones.flatMap(hechosDeOracion));
  return hechos.filter((h) => !usados.has(h.id));
}
