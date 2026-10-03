// Momentos clave y análisis incremental (brief 008). El 002 no se toca: los hechos «hasta
// el minuto M» salen de llamar `analizar` sobre el PREFIJO de eventos.

import { analizar } from "../analista/analista";
import type { Hecho } from "../analista/tipos";
import type { Evento, Partido } from "../sim/tipos";
import { hechoEnVivo } from "./enVivo";
import { HECHO_DEL_MOMENTO, HECHOS_DE_CIERRE, type TipoMomento } from "./umbrales";

export interface Momento {
  /** Estable y legible: «gol-e010», «roja-e077», «descanso-e058», «final-e118». */
  id: string;
  tipo: TipoMomento;
  /** Evento que lo dispara y su posición en el stream: el prefijo es eventos[0..indice]. */
  eventoId: string;
  indice: number;
  minuto: number;
}

/** Los momentos clave del partido, en orden del stream. */
export function detectarMomentos(partido: Partido): Momento[] {
  const out: Momento[] = [];
  let fines = 0;
  partido.eventos.forEach((e: Evento, indice) => {
    let tipo: TipoMomento | undefined;
    if (e.tipo === "gol") tipo = "gol";
    else if (e.tipo === "tarjeta_roja") tipo = "roja";
    else if (e.tipo === "fin_periodo") tipo = ++fines === 1 ? "descanso" : "final";
    if (tipo) out.push({ id: `${tipo}-${e.id}`, tipo, eventoId: e.id, indice, minuto: e.minuto });
  });
  return out;
}

/** El partido tal como se conoce en ese momento: eventos[0..indice]. */
export function prefijo(partido: Partido, momento: Momento): Partido {
  return { config: partido.config, eventos: partido.eventos.slice(0, momento.indice + 1) };
}

/**
 * Hechos que el Cronista puede usar en ese momento: el análisis del prefijo, sin los hechos
 * de cierre antes del final, sin dominio de un periodo no terminado, y sin hechos vacíos.
 * Todo hecho devuelto cita solo eventos del prefijo (minuto ≤ M): sin clarividencia.
 */
export function hechosDelMomento(partido: Partido, momento: Momento): Hecho[] {
  const pre = prefijo(partido, momento);
  const finesHechos = pre.eventos.filter((e) => e.tipo === "fin_periodo").length;
  const hechos = analizar(pre).filter((h) => {
    if (h.eventos.length === 0) return false;
    if (momento.tipo !== "final" && HECHOS_DE_CIERRE.includes(h.tipo)) return false;
    if (h.tipo === "dominio_periodo" && Number(h.datos.periodo) > finesHechos) return false;
    return true;
  });
  // F1: antes del final, sin balances posteriores dentro de los hechos (ver enVivo.ts).
  return momento.tipo === "final" ? hechos : hechos.map((h) => hechoEnVivo(h, pre));
}

/** El hecho que el momento narra como principal (en los hechos de ese momento). */
export function hechoDeMomento(momento: Momento, hechos: Hecho[]): Hecho | undefined {
  const tipo = HECHO_DEL_MOMENTO[momento.tipo];
  if (momento.tipo === "descanso") return hechos.find((h) => h.tipo === tipo && h.datos.periodo === 1);
  if (momento.tipo === "final") return hechos.find((h) => h.tipo === tipo);
  // Brief 020: el gol en propia puerta se narra con su hecho `autogol`.
  return hechos.find((h) => (h.tipo === tipo || (momento.tipo === "gol" && h.tipo === "autogol")) && h.eventos.includes(momento.eventoId));
}
