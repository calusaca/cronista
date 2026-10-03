// Brief 019 §3 — el rating general de temporada: por jugador, la MEDIA de sus notas de partido
// (las del brief 009, ya auditadas), ponderada simple por partidos jugados, a un decimal. Nada de
// opinión: es la agregación de lo que cada partido ya explica. Funciones puras de la temporada.

import { valorar } from "../analista/valoracion";
import { simular } from "../sim/motor";
import type { Partido, Posicion } from "../sim/tipos";
import type { Temporada } from "./tipos";

export interface NotaDePartido {
  jornada: number;
  indice: number;
  nota: number;
  rival: string;
}

export interface RatingJugador {
  jugador: string;
  equipo: string;
  posicion: Posicion;
  partidos: number;
  /** Media de las notas, un decimal (en décimas enteras para no arrastrar coma flotante). */
  rating: number;
  notas: NotaDePartido[];
}

/** Los partidos de la temporada, re-simulados desde sus configs (deterministas). */
export function partidosDeTemporada(t: Temporada): Partido[] {
  return t.configs.map((c) => simular(c));
}

/** Rating de todos los jugadores con al menos un partido valorado. */
export function ratingsDeTemporada(t: Temporada, partidos: Partido[] = partidosDeTemporada(t)): RatingJugador[] {
  const por = new Map<string, RatingJugador>();
  partidos.forEach((p, k) => {
    const ref = t.partidos[k] as Temporada["partidos"][number];
    for (const v of valorar(p)) {
      const clave = `${v.equipo}|${v.jugador}`;
      const r = por.get(clave) ?? { jugador: v.jugador, equipo: v.equipo, posicion: v.posicion, partidos: 0, rating: 0, notas: [] };
      r.notas.push({ jornada: ref.jornada, indice: ref.indice, nota: v.nota, rival: v.lado === "local" ? ref.visita : ref.local });
      por.set(clave, r);
    }
  });
  for (const r of por.values()) {
    r.partidos = r.notas.length;
    const decimas = r.notas.reduce((s, n) => s + Math.round(n.nota * 10), 0);
    r.rating = Math.round(decimas / r.partidos) / 10;
  }
  return [...por.values()];
}

/** El top: mínimo de partidos, rating descendente; desempata más partidos y luego el nombre. */
export function topRating(rs: readonly RatingJugador[], minPartidos: number, n: number): RatingJugador[] {
  return rs
    .filter((r) => r.partidos >= minPartidos)
    .sort((a, b) => b.rating - a.rating || b.partidos - a.partidos || a.jugador.localeCompare(b.jugador))
    .slice(0, n);
}

export interface TarjetasJugador {
  jugador: string;
  equipo: string;
  amarillas: number;
  rojas: number;
}

/** Tarjetas por jugador en la temporada (la segunda amarilla llega como roja, contrato 001). */
export function tarjetasDeTemporada(partidos: Partido[]): TarjetasJugador[] {
  const por = new Map<string, TarjetasJugador>();
  for (const p of partidos) {
    for (const e of p.eventos) {
      if ((e.tipo !== "tarjeta_amarilla" && e.tipo !== "tarjeta_roja") || !e.jugador) continue;
      const equipo = p.config[e.equipo].nombre;
      const k = `${equipo}|${e.jugador}`;
      const x = por.get(k) ?? { jugador: e.jugador, equipo, amarillas: 0, rojas: 0 };
      if (e.tipo === "tarjeta_amarilla") x.amarillas++;
      else x.rojas++;
      por.set(k, x);
    }
  }
  return [...por.values()].sort((a, b) => b.rojas - a.rojas || b.amarillas - a.amarillas || a.jugador.localeCompare(b.jugador));
}
