// Brief 016 §2 — la temporada: cada partido de liga ES un partido normal. Su semilla sale de
// `semillaDePartido` (hash determinista) y su config es la estándar { seed, local, visita }
// con los equipos del mundo; se simula con el `simular` de siempre.

import { simular } from "../sim/motor";
import type { Partido, SimConfig } from "../sim/tipos";
import { calendarioCirculo } from "./calendario";
import { goleadores, tablaDePosiciones } from "./tabla";
import type { Calendario, Cruce, Liga, PartidoLiga, Temporada } from "./tipos";

/**
 * Semilla de un partido de liga: FNV-1a de 32 bits sobre la clave, con un mezclado final
 * (avalancha) para que jornadas o índices vecinos no den semillas vecinas. Jornada e índice
 * son 1-based, como en la UI.
 */
export function semillaDePartido(liga: string, temporada: number, jornada: number, indice: number): number {
  const clave = `liga:${liga}|temporada:${temporada}|jornada:${jornada}|partido:${indice}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < clave.length; i++) {
    h ^= clave.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

const calendarios = new Map<number, Calendario>();
export function calendarioDeLiga(liga: Liga): Calendario {
  const n = liga.equipos.length;
  let c = calendarios.get(n);
  if (!c) {
    c = calendarioCirculo(n);
    calendarios.set(n, c);
  }
  return c;
}

export const jornadasDe = (liga: Liga) => calendarioDeLiga(liga).length;
export const partidosPorJornada = (liga: Liga) => liga.equipos.length / 2;

/** El cruce (jornada e índice 1-based) o undefined si no existe. */
export function cruceDe(liga: Liga, jornada: number, indice: number): Cruce | undefined {
  return calendarioDeLiga(liga)[jornada - 1]?.[indice - 1];
}

/** La config estándar de un partido de liga (el 018 le sumará condiciones). */
export function configDePartidoLiga(liga: Liga, temporada: number, jornada: number, indice: number): SimConfig {
  const c = cruceDe(liga, jornada, indice);
  if (!c) throw new Error(`partido inexistente: ${liga.id} jornada ${jornada} partido ${indice}`);
  return {
    seed: semillaDePartido(liga.id, temporada, jornada, indice),
    local: (liga.equipos[c.local] as Liga["equipos"][number]).equipo,
    visita: (liga.equipos[c.visita] as Liga["equipos"][number]).equipo,
  };
}

/** Resultado de liga de un partido simulado. */
export function resultadoDe(partido: Partido, jornada: number, indice: number): PartidoLiga {
  const { local, visita } = partido.config;
  const nombre = { local: local.nombre, visita: visita.nombre };
  const goles = partido.eventos
    .filter((e) => e.tipo === "gol")
    .map((e) => ({ jugador: e.jugador ?? "", equipo: nombre[e.equipo], minuto: e.minuto }));
  return {
    jornada,
    indice,
    seed: partido.config.seed,
    local: local.nombre,
    visita: visita.nombre,
    golesLocal: goles.filter((g) => g.equipo === local.nombre).length,
    golesVisita: goles.filter((g) => g.equipo === visita.nombre).length,
    goles,
  };
}

/** La temporada completa de una liga: 18 jornadas × 5 partidos, tabla y goleadores. */
export function simularTemporada(liga: Liga, temporada: number): Temporada {
  const partidos: PartidoLiga[] = [];
  const cal = calendarioDeLiga(liga);
  cal.forEach((jornada, j) =>
    jornada.forEach((_, i) => {
      partidos.push(resultadoDe(simular(configDePartidoLiga(liga, temporada, j + 1, i + 1)), j + 1, i + 1));
    }),
  );
  return {
    liga: liga.id,
    temporada,
    partidos,
    tabla: tablaDePosiciones(
      liga.equipos.map((e) => e.equipo.nombre),
      partidos,
    ),
    goleadores: goleadores(partidos),
  };
}
