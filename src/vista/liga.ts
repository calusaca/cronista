// Brief 016 §4 — datos de la liga para la UI (solo servidor). La UI muestra UNA liga (la
// primera del mundo); las demás existen y esperan. La temporada se simula una vez por proceso.

import { LIGA_DESTACADA, RATING_PARTIDOS_MIN, RATING_TOP, TEMPORADA_ACTUAL } from "../analista/umbrales";
import { mundo } from "../mundo/mundo";
import { partidosDeTemporada, ratingsDeTemporada, tarjetasDeTemporada, topRating, type RatingJugador, type TarjetasJugador } from "../mundo/rating";
import { configDePartidoLiga, jornadasDe, partidosPorJornada, temporadaDe } from "../mundo/temporada";
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

/** Brief 019: la temporada con su registro, memorizada (la misma de las configs de cada partido). */
export function temporadaVisible(): Temporada {
  return temporadaDe(ligaVisible(), TEMPORADA_ACTUAL);
}

export interface JugadoresLiga {
  top: RatingJugador[];
  tarjetas: TarjetasJugador[];
  minPartidos: number;
}

let jugadoresCache: JugadoresLiga | undefined;
/** Brief 019 §3: la pestaña Players (top del rating con sus notas, tarjetas). */
export function jugadoresVisibles(): JugadoresLiga {
  if (jugadoresCache) return jugadoresCache;
  const t = temporadaVisible();
  const ps = partidosDeTemporada(t);
  jugadoresCache = { top: topRating(ratingsDeTemporada(t, ps), RATING_PARTIDOS_MIN, RATING_TOP), tarjetas: tarjetasDeTemporada(ps), minPartidos: RATING_PARTIDOS_MIN };
  return jugadoresCache;
}

export interface BajaVisible {
  equipo: string;
  jugador: string;
  motivo: "suspension" | "lesion";
  jornadas: number;
}

/** Brief 019: quiénes no juegan la jornada j (las bajas con que se armaron sus alineaciones). */
export function bajasDeJornada(j: number): BajaVisible[] {
  const t = temporadaVisible();
  const out: BajaVisible[] = [];
  t.partidos.forEach((p, k) => {
    if (p.jornada !== j) return;
    const c = t.configs[k];
    for (const lado of ["local", "visita"] as const) for (const b of c?.bajas?.[lado] ?? []) out.push({ equipo: lado === "local" ? p.local : p.visita, ...b });
  });
  return out;
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
