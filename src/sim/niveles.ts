// Brief 024 — el nivel de cada jugador (1–100), DERIVADO y puro: prngDerivado por (nombre del
// equipo, índice en el plantel) — el patrón de las reservas del 019. Jamás toca el stream con que
// se generaron los equipos: el mundo del 016 no cambia ni una letra.
//
// Tope de plantel: tras el sorteo, una corrección determinista deja el promedio de los 16
// (titulares + banco) EXACTAMENTE en la media (ataque + defensa) / 2 del equipo — presupuesto
// auditable: nadie compra cracks gratis. Los jugadores extra (reservas del 019) se sortean igual,
// fuera del tope (no son del plantel de 16).

import { NIVEL } from "./limites";
import { NIVELES } from "./parametros";
import { prngDerivado } from "./prng";
import { SUPLENTES, TITULARES, type Equipo, type Jugador } from "./tipos";

/** La media de nivel del equipo: (ataque + defensa) / 2 (puede terminar en ,5). */
export const mediaDeEquipo = (e: Pick<Equipo, "ataque" | "defensa">) => (e.ataque + e.defensa) / 2;

/** delta del jugador dentro de su equipo: (nivel − media) / 100 (0 si no tiene nivel). */
export const deltaNivel = (j: Pick<Jugador, "nivel"> | undefined, e: Pick<Equipo, "ataque" | "defensa">) =>
  j?.nivel === undefined ? 0 : (j.nivel - mediaDeEquipo(e)) / 100;

function sorteo(equipo: Equipo, i: number, lo: number, hi: number): number {
  const z = prngDerivado(0, `nivel:${equipo.nombre}:${i}`).normal();
  return Math.min(hi, Math.max(lo, Math.round(mediaDeEquipo(equipo) + NIVELES.sigma * z)));
}

/** Niveles del plantel de 16 (con tope exacto) y de los `extra` (sin tope), por nombre. */
export function nivelesDe(equipo: Equipo, extra: readonly Jugador[] = []): Map<string, number> {
  const media = mediaDeEquipo(equipo);
  const lo = Math.max(NIVEL.min, Math.ceil(media - NIVELES.recorte));
  const hi = Math.min(NIVEL.max, Math.floor(media + NIVELES.recorte));
  const plantel = equipo.jugadores.slice(0, TITULARES + SUPLENTES);
  const niveles = plantel.map((_, i) => sorteo(equipo, i, lo, hi));
  // El tope: la suma de los 16 tiene que ser 16 × media (entero: la media es x o x,5).
  const objetivo = Math.round(plantel.length * media);
  let suma = niveles.reduce((a, b) => a + b, 0);
  let k = 0;
  while (suma !== objetivo) {
    const i = k % niveles.length;
    const v = niveles[i] as number;
    if (suma < objetivo && v < hi) {
      niveles[i] = v + 1;
      suma++;
    } else if (suma > objetivo && v > lo) {
      niveles[i] = v - 1;
      suma--;
    }
    k++;
  }
  const out = new Map<string, number>();
  plantel.forEach((j, i) => out.set(j.nombre, niveles[i] as number));
  extra.forEach((j, i) => out.set(j.nombre, sorteo(equipo, plantel.length + i, lo, hi)));
  return out;
}

/** El equipo con el nivel puesto en cada jugador (copia; el original no cambia). */
export function conNiveles(equipo: Equipo, niveles: ReadonlyMap<string, number>): Equipo {
  return { ...equipo, jugadores: equipo.jugadores.map((j) => (niveles.has(j.nombre) ? { ...j, nivel: niveles.get(j.nombre) as number } : { ...j })) };
}
