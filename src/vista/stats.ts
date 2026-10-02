// Brief 014 §1 — el panel «Match stats», funciones puras sobre la capa micro del 013 (la de lo
// visto: en el replay, el prefijo). Mismas reglas que los hechos del Analista (posesión por
// pases intentados, avances por canal, pérdidas en la zona de salida, regates exitosos por
// pareja) y los MISMOS umbrales importados para los destacados: nada repetido a mano.
// El relato jugada a jugada (rev 1.1) convierte micro-eventos en líneas legibles.

import { CANAL_AVANCES_MIN, CANAL_MIN, DOMINIO_MIN, DOMINIO_PASES_MIN, DUELO_MIN, PERDIDAS_MIN } from "../analista/umbrales";
import { CANALES, type Canal } from "../sim/limites";
import { micro, type MicroEvento, type MicroPartido } from "../sim/micro";
import type { Evento, Lado, Partido } from "../sim/tipos";
import { fmtMinuto } from "./evidencia";

const LADOS: readonly Lado[] = ["local", "visita"];
const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a * 100) / b));

export interface PeriodoPosesion {
  periodo: 1 | 2;
  pases: Record<Lado, number>;
  porcentaje: Record<Lado, number>;
}

export interface StatsPartido {
  /** Micro-eventos sobre los que se calcula todo (lo visto). */
  total: number;
  posesion: { pases: Record<Lado, number>; porcentaje: Record<Lado, number>; porPeriodo: PeriodoPosesion[]; destacado?: Lado };
  canales: Record<Lado, { avances: number; por: Record<Canal, { n: number; porcentaje: number }>; destacado?: Canal }>;
  /** Regates exitosos por pareja (atacante → defensor), de mayor a menor (top 3, con al menos 2). */
  duelos: { lado: Lado; jugador: string; rival: string; n: number; ids: string[]; destacado: boolean }[];
  /** Pérdidas en la zona de salida (defensa) por equipo y canal. */
  perdidas: Record<Lado, Record<Canal, { n: number; ids: string[]; destacado: boolean }>>;
}

/** Periodo de un micro-evento: el de su ancla macro (2 a partir del segundo inicio_periodo). */
function periodoDe(p: Partido): (ancla: string) => 1 | 2 {
  const segundo = p.eventos.findIndex((e, i) => e.tipo === "inicio_periodo" && i > 0);
  const idx = new Map(p.eventos.map((e, i) => [e.id, i] as const));
  return (ancla) => (segundo >= 0 && (idx.get(ancla) ?? 0) >= segundo ? 2 : 1);
}

export function estadisticas(p: Partido, m: MicroPartido = micro(p)): StatsPartido {
  const per = periodoDe(p);
  const pases = m.eventos.filter((x) => x.tipo === "pase");
  const cuenta = (xs: MicroEvento[]) => ({ local: xs.filter((x) => x.equipo === "local").length, visita: xs.filter((x) => x.equipo === "visita").length });
  const pc = cuenta(pases);
  const posPct = { local: pct(pc.local, pases.length), visita: pct(pc.visita, pases.length) };
  const porPeriodo: PeriodoPosesion[] = ([1, 2] as const).flatMap((n) => {
    const xs = pases.filter((x) => per(x.ancla) === n);
    if (xs.length === 0) return [];
    const c = cuenta(xs);
    return [{ periodo: n, pases: c, porcentaje: { local: pct(c.local, xs.length), visita: pct(c.visita, xs.length) } }];
  });
  const posDest = pases.length >= DOMINIO_PASES_MIN ? LADOS.find((l) => posPct[l] >= DOMINIO_MIN) : undefined;

  const canales = {} as StatsPartido["canales"];
  for (const l of LADOS) {
    const av = m.posesiones.filter((x) => x.equipo === l && x.avance);
    const por = {} as Record<Canal, { n: number; porcentaje: number }>;
    for (const c of CANALES) {
      const n = av.filter((x) => x.canal === c).length;
      por[c] = { n, porcentaje: pct(n, av.length) };
    }
    let top: Canal = "banda_izquierda";
    for (const c of CANALES) if (por[c].n > por[top].n) top = c;
    canales[l] = { avances: av.length, por, ...(av.length >= CANAL_AVANCES_MIN && por[top].porcentaje >= CANAL_MIN ? { destacado: top } : {}) };
  }

  const pares = new Map<string, MicroEvento[]>();
  for (const x of m.eventos) {
    if (x.tipo !== "regate" || x.exito !== true || !x.rival) continue;
    const k = `${x.equipo}|${x.jugador}|${x.rival}`;
    pares.set(k, [...(pares.get(k) ?? []), x]);
  }
  const duelos = [...pares.values()]
    .filter((xs) => xs.length >= 2)
    .sort((a, b) => b.length - a.length || (a[0]?.minuto ?? 0) - (b[0]?.minuto ?? 0))
    .slice(0, 3)
    .map((xs) => {
      const x = xs[0] as MicroEvento;
      return { lado: x.equipo, jugador: x.jugador, rival: x.rival as string, n: xs.length, ids: xs.map((y) => y.id), destacado: xs.length >= DUELO_MIN };
    });

  const perdidas = {} as StatsPartido["perdidas"];
  for (const l of LADOS) {
    perdidas[l] = {} as Record<Canal, { n: number; ids: string[]; destacado: boolean }>;
    for (const c of CANALES) {
      const ids = m.eventos.filter((x) => x.tipo === "perdida" && x.equipo === l && x.zona === "defensa" && x.canal === c).map((x) => x.id);
      perdidas[l][c] = { n: ids.length, ids, destacado: ids.length >= PERDIDAS_MIN };
    }
  }

  return { total: m.eventos.length, posesion: { pases: pc, porcentaje: posPct, porPeriodo, ...(posDest ? { destacado: posDest } : {}) }, canales, duelos, perdidas };
}

// ---------------------------------------------------------------------------------
// Relato jugada a jugada (rev 1.1): una línea por evento — minuto, actor, acción, magnitud.
// ---------------------------------------------------------------------------------

export const CANAL_TXT: Record<Canal, string> = { banda_izquierda: "left flank", centro: "middle", banda_derecha: "right flank" };
const ZONA_TXT: Record<string, string> = { defensa: "playing out", medio: "in midfield", ataque: "in the final third" };
const ALTURA_TXT: Record<string, string> = { raso: "low", media: "mid-height", alta: "high" };
const DESTINO_TXT: Record<string, string> = { palo_izquierdo: "left post", palo_derecho: "right post", centro_del_arco: "centre of goal" };
const PORTERO_TXT: Record<string, string> = { su_izquierda: "to his left", su_derecha: "to his right", centro: "down the middle" };

export interface LineaRelato {
  id: string;
  minuto: string;
  texto: string;
  /** ¿Es uno de los eventos citados (la evidencia), o contexto de su jugada? */
  citado: boolean;
}

export function lineaMicro(x: MicroEvento): string {
  switch (x.tipo) {
    case "pase":
      return x.completado
        ? `${x.jugador} passes to ${x.receptor} · ${CANAL_TXT[x.canal]} · ${x.distanciaM} m`
        : `${x.jugador}'s pass to ${x.receptor} goes astray · ${CANAL_TXT[x.canal]} · ${x.distanciaM} m`;
    case "conduccion":
      return `${x.jugador} carries the ball ${x.distanciaM} m · ${CANAL_TXT[x.canal]}`;
    case "regate":
      return x.exito ? `${x.jugador} beats ${x.rival} on the dribble · ${CANAL_TXT[x.canal]}` : `${x.jugador} is stopped by ${x.rival} · ${CANAL_TXT[x.canal]}`;
    case "duelo":
      return x.exito ? `${x.jugador} wins a duel against ${x.rival}` : `${x.jugador} loses a duel to ${x.rival}`;
    case "perdida":
      return `${x.jugador} loses the ball ${ZONA_TXT[x.zona]} · ${CANAL_TXT[x.canal]}`;
    case "recuperacion":
      return `${x.jugador} wins the ball back · ${CANAL_TXT[x.canal]}`;
  }
}

/** La línea del remate macro con el que termina una jugada (brief 011: zona, palo, altura, portero). */
export function lineaRemate(p: Partido, tiro: Evento, fx: (xg: number) => string = (x) => `xG ${x.toFixed(2)}`): string {
  const desenlace = p.eventos.find((e) => e.relacionadoCon === tiro.id && (e.tipo === "gol" || e.tipo === "atajada"));
  const destino = tiro.destino ? ` → ${DESTINO_TXT[tiro.destino]}${tiro.altura ? `, ${ALTURA_TXT[tiro.altura]}` : ""}` : "";
  const fin =
    desenlace?.tipo === "gol" ? " — goal" : desenlace?.tipo === "atajada" ? ` — saved${desenlace.ladoPortero ? ` (keeper dives ${PORTERO_TXT[desenlace.ladoPortero]})` : ""}` : " — off target";
  const magnitudes = `${tiro.distanciaM !== undefined ? ` · ${tiro.distanciaM} m` : ""}${tiro.velocidadKmh !== undefined ? ` · ${tiro.velocidadKmh} km/h` : ""}`;
  return `${tiro.jugador} shoots${magnitudes}${tiro.xg !== undefined ? ` · ${fx(tiro.xg)}` : ""}${destino}${fin}`;
}

/**
 * Relato de la evidencia: cada evento citado con hasta `contexto` eventos previos de SU
 * posesión (lo que la preparó) y, si esa jugada terminó en un remate, el remate.
 */
export function relato(p: Partido, m: MicroPartido, ids: string[], contexto = 2, fx?: (xg: number) => string): LineaRelato[] {
  const citados = new Set(ids);
  const idx = new Map(m.eventos.map((x, i) => [x.id, i] as const));
  const incluidos = new Set<number>();
  const out: LineaRelato[] = [];
  const remates = new Set<string>();
  for (const id of ids) {
    const i = idx.get(id);
    if (i === undefined) continue;
    const x = m.eventos[i] as MicroEvento;
    for (let k = Math.max(0, i - contexto); k <= i; k++) {
      const y = m.eventos[k] as MicroEvento;
      if (y.posesion !== x.posesion || incluidos.has(k)) continue;
      incluidos.add(k);
      out.push({ id: y.id, minuto: fmtMinuto(y.minuto), texto: lineaMicro(y), citado: citados.has(y.id) });
    }
    const ps = m.posesiones.find((q) => q.n === x.posesion);
    const ancla = ps && ps.termina === "ancla" ? p.eventos.find((e) => e.id === ps.ancla) : undefined;
    if (ancla?.tipo === "tiro" && !remates.has(ancla.id) && (ps?.eventos[ps.eventos.length - 1] === id || ps?.eventos.slice(-3).includes(id))) {
      remates.add(ancla.id);
      out.push({ id: ancla.id, minuto: fmtMinuto(ancla.minuto), texto: lineaRemate(p, ancla, fx), citado: false });
    }
  }
  return out;
}
