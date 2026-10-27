// Brief 070 (reinicios-v11) · tiro libre y penal: colocación, tiro directo, ejecutor y desenlace del penal. Funciones
// puras; el motor (`prepararSaque`/`ejecutarSaque`) las usa solo bajo v11. Las cifras viven en limites.ts
// (ARENA.distanciaSaqueLibreM, LIBRE_ARENA, PENAL_ARENA).
import { ARENA, LIBRE_ARENA as LI, PENAL_ARENA as PE } from "../sim/limites";
import { prngDerivado } from "../sim/prng";
import type { Lado } from "../sim/tipos";
import { transformar } from "./catalogo";
import { distancia, enCancha, limitar } from "./geometria";
import type { AtributosJugador, JugadorArena, Punto } from "./tipos";

/** Holgura numérica (no es un umbral): el empuje deja al jugador a `minimo × (1 + HOLGURA)` para que el redondeo de
 * coma flotante nunca lo deje a 9,1499999… m. */
const HOLGURA = 1e-9;
const MEDIO_Y = ARENA.anchoM / 2;

/** § 2.A · El empuje de `prepararSaque` en los otros saques (hacia el centro de la cancha, a `minimo` del punto), sin
 * dejar al jugador fuera de la cancha. Si el punto es exactamente el centro (sin dirección), se aparta en la línea
 * punto→jugador (o hacia +x si coinciden). */
export function apartarDelSaque(jugador: Punto, punto: Punto, minimo: number): Punto {
  let dx = ARENA.largoM / 2 - punto.x, dy = MEDIO_Y - punto.y, d = Math.hypot(dx, dy);
  if (!d) { dx = jugador.x - punto.x; dy = jugador.y - punto.y; d = Math.hypot(dx, dy); if (!d) { dx = 1; dy = 0; d = 1; } }
  const m = minimo * (1 + HOLGURA);
  return enCancha({ x: punto.x + dx / d * m, y: punto.y + dy / d * m });
}

/** § 2.A · ¿El punto de la falta admite tiro directo del `lado` que ataca? A ≤ directoMaxM del centro del arco rival y
 * en el pasillo central (|y − anchoM/2| ≤ pasilloM). */
export function opcionDirecto(punto: Punto, lado: Lado, c: { directoMaxM: number; pasilloM: number } = LI): boolean {
  const o = transformar(punto, lado);
  return Math.hypot(ARENA.largoM - o.x, o.y - MEDIO_Y) <= c.directoMaxM && Math.abs(o.y - MEDIO_Y) <= c.pasilloM;
}

/** § 2.B · Punto penal del `lado` que ataca: a PENAL_ARENA.puntoM de la línea de fondo rival, en el centro. */
export const puntoPenal = (lado: Lado, puntoM: number = PE.puntoM): Punto => transformar({ x: ARENA.largoM - puntoM, y: MEDIO_Y }, lado);

/** § 2.B · Colocación de un jugador en el penal (salvo el ejecutor): el portero de `defiende` en su línea, en el centro
 * del arco; el resto fuera del área de `defiende` (a margenAreaMetaM de su borde) y a ≥ distanciaSaqueLibreM del punto
 * (radialmente desde el punto; fuera del área la x orientada sólo crece, así que sigue fuera). */
export function colocacionPenal(j: Pick<JugadorArena, "lado" | "puesto" | "posicion">, defiende: Lado, minimo: number = ARENA.distanciaSaqueLibreM, puntoM: number = PE.puntoM): Punto {
  if (j.lado === defiende && j.puesto === "POR") return transformar({ x: 0, y: MEDIO_Y }, defiende);
  const o = transformar(j.posicion, defiende), punto = { x: puntoM, y: MEDIO_Y };
  if (o.x <= ARENA.areaLargoM && Math.abs(o.y - MEDIO_Y) <= ARENA.areaAnchoM / 2) o.x = ARENA.areaLargoM + ARENA.margenAreaMetaM;
  const d = distancia(o, punto);
  if (d < minimo) {
    const m = minimo * (1 + HOLGURA), ux = d ? (o.x - punto.x) / d : 1, uy = d ? (o.y - punto.y) / d : 0;
    o.x = punto.x + ux * m; o.y = punto.y + uy * m;
  }
  return enCancha(transformar(o, defiende));
}

/** § 2.B · Ejecutor del penal cuando el que recibió la falta ya no está: el compañero de campo con el atributo
 * `potencia` más alto; desempata el nivel (y, para ser determinista, el id). */
export function ejecutorPenal(candidatos: readonly JugadorArena[], atributos: (id: string) => AtributosJugador | undefined): JugadorArena | undefined {
  const potencia = (j: JugadorArena) => atributos(j.id)?.potencia ?? 0;
  return candidatos.filter(j => j.puesto !== "POR").sort((a, b) => potencia(b) - potencia(a) || b.nivel - a.nivel || a.id.localeCompare(b.id))[0];
}

/** § 2.B · Probabilidad de gol del penal: conversion ± ajusteMax según (potencia del ejecutor − nivel del portero) /
 * diferenciaPlena, acotado a [−1, 1]. Sin atributos o sin portero, sin ajuste (sin portero, desenlacePenal no ataja). */
export function probabilidadPenal(potencia: number | undefined, nivelPortero: number | undefined, c: { conversion: number; ajusteMax: number; diferenciaPlena: number } = PE): number {
  if (potencia === undefined || nivelPortero === undefined) return c.conversion;
  return c.conversion + c.ajusteMax * limitar((potencia - nivelPortero) / c.diferenciaPlena, -1, 1);
}

export type DesenlacePenal = "gol" | "atajada" | "fuera";
/** § 2.B · Desenlace y destino del penal, deterministas con `prngDerivado(seed, "penal:{tick}:{ejecutor}")`: gol con
 * probabilidad `p`; si no, atajada (fracción atajadaFraccion, solo con portero) o fuera. Destino (absoluto): en el gol,
 * dentro de los palos a colocacionM del centro y remateTrasLineaM detrás de la línea; fuera, a fueraM por fuera del palo;
 * en la atajada, la posición del portero. */
export function desenlacePenal(o: { seed: number; tick: number; ejecutor: string; lado: Lado; p: number; portero: Punto | null }): { desenlace: DesenlacePenal; destino: Punto } {
  const rng = prngDerivado(o.seed, `penal:${o.tick}:${o.ejecutor}`);
  const desenlace: DesenlacePenal = rng.next() < o.p ? "gol" : o.portero && rng.next() < PE.atajadaFraccion ? "atajada" : "fuera";
  if (desenlace === "atajada") return { desenlace, destino: { ...o.portero! } };
  const signo = rng.next() < 0.5 ? -1 : 1, r = desenlace === "gol" ? PE.colocacionM : PE.fueraM;
  const lateral = (desenlace === "gol" ? 0 : ARENA.arcoM / 2) + r.min + rng.next() * (r.max - r.min);
  return { desenlace, destino: transformar({ x: ARENA.largoM + ARENA.remateTrasLineaM, y: MEDIO_Y + signo * lateral }, o.lado) };
}
