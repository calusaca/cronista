// Brief 016 §4 — datos de la liga para la UI (solo servidor). La UI muestra UNA liga (la
// primera del mundo); las demás existen y esperan. La temporada se simula una vez por proceso.

import { LIGA_DESTACADA, TEMPORADA_ACTUAL } from "../analista/umbrales";
import { mundo } from "../mundo/mundo";
import { configDePartidoLiga, jornadasDe, partidosPorJornada, simularTemporada } from "../mundo/temporada";
import type { Liga, Temporada } from "../mundo/tipos";
import { type DatosPartido, type Perspectiva, cargarOverlayDeConfig, cargarPartidoDeConfig } from "./servidor";

export interface RefPartido {
  jornada: number;
  indice: number;
}

export interface ContextoLiga {
  liga: string;
  pais: string;
  jornada: number;
  indice: number;
  anterior?: RefPartido;
  siguiente?: RefPartido;
}

/** La liga que muestra la UI: LIGA_DESTACADA (las demás existen y esperan). */
export function ligaVisible(): Liga {
  const l = mundo().ligas.find((x) => x.id === LIGA_DESTACADA);
  if (!l) throw new Error(`LIGA_DESTACADA «${LIGA_DESTACADA}» no existe en el mundo`);
  return l;
}

let temporadaCache: Temporada | undefined;
export function temporadaVisible(): Temporada {
  temporadaCache ??= simularTemporada(ligaVisible(), TEMPORADA_ACTUAL);
  return temporadaCache;
}

export const rutaPartidoLiga = (r: RefPartido) => `/liga/${r.jornada}/${r.indice}`;

/** Valida jornada/índice del texto de la URL (1-based). */
export function leerRefPartido(jornada: string, indice: string, liga: Liga = ligaVisible()): RefPartido | undefined {
  if (!/^[0-9]{1,3}$/.test(jornada) || !/^[0-9]{1,3}$/.test(indice)) return undefined;
  const j = Number(jornada);
  const i = Number(indice);
  if (j < 1 || j > jornadasDe(liga) || i < 1 || i > partidosPorJornada(liga)) return undefined;
  return { jornada: j, indice: i };
}

/** Anterior y siguiente en el orden del calendario (jornada, luego índice). Pura. */
export function vecinos(r: RefPartido, jornadas: number, porJornada: number): { anterior?: RefPartido; siguiente?: RefPartido } {
  const n = (r.jornada - 1) * porJornada + (r.indice - 1);
  const ref = (k: number): RefPartido => ({ jornada: Math.floor(k / porJornada) + 1, indice: (k % porJornada) + 1 });
  return {
    ...(n > 0 ? { anterior: ref(n - 1) } : {}),
    ...(n < jornadas * porJornada - 1 ? { siguiente: ref(n + 1) } : {}),
  };
}

export function contextoDe(r: RefPartido): ContextoLiga {
  const liga = ligaVisible();
  const pais = mundo().paises.find((p) => p.id === liga.pais);
  return {
    liga: liga.nombre,
    pais: pais?.nombre ?? "",
    jornada: r.jornada,
    indice: r.indice,
    ...vecinos(r, jornadasDe(liga), partidosPorJornada(liga)),
  };
}

export async function cargarPartidoLiga(r: RefPartido, perspectiva: Perspectiva = "neutral"): Promise<DatosPartido> {
  return cargarPartidoDeConfig(configDePartidoLiga(ligaVisible(), TEMPORADA_ACTUAL, r.jornada, r.indice), perspectiva);
}

export async function cargarOverlayLiga(r: RefPartido, perspectiva: Perspectiva = "neutral") {
  return cargarOverlayDeConfig(configDePartidoLiga(ligaVisible(), TEMPORADA_ACTUAL, r.jornada, r.indice), perspectiva);
}
