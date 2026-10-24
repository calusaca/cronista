// Brief 063 · Bloque C (reinicios-v7): remate lejano y balón largo. Funciones puras; el motor las llama solo
// bajo reinicios-v7 con los atributos guardados en `config.atributos` (§ 4.2: por eso reciben los atributos
// del jugador como argumento). Las cifras salen de LARGO_ARENA y ARENA.
import { ARENA, LARGO_ARENA as LA } from "../sim/limites";
import { efectoAtributo } from "./atributos";
import { transformar } from "./catalogo";
import { distancia, enCancha, proyeccion } from "./geometria";
import type { AtributosJugador, EstadoArena, JugadorArena, Punto } from "./tipos";

const CENTRO_ARCO_RIVAL: Punto = { x: ARENA.largoM, y: ARENA.anchoM / 2 };

/** Distancia del jugador al centro del arco rival (en su marco orientado). */
export const distanciaAlArco = (j: Pick<JugadorArena, "posicion" | "lado">): number => distancia(transformar(j.posicion, j.lado), CENTRO_ARCO_RIVAL);

/** § 8.1 · Candidato de remate lejano: de campo con atributos, potencia ≥ potenciaMin, a (radioTiroM, maxM] del
 * centro del arco, dentro del ancho del área, ningún rival a < espacioM y ningún rival de campo a < lineaM del
 * segmento jugador–centro del arco. */
export function puedeRematarLejos(j: JugadorArena, a: AtributosJugador | undefined, estado: EstadoArena): boolean {
  if (!a || j.puesto === "POR" || a.potencia < LA.remate.potenciaMin) return false;
  const o = transformar(j.posicion, j.lado), d = distancia(o, CENTRO_ARCO_RIVAL);
  if (d <= ARENA.radioTiroM || d > LA.remate.maxM || Math.abs(o.y - ARENA.anchoM / 2) > ARENA.areaAnchoM / 2) return false;
  const rivales = estado.jugadores.filter(r => r.lado !== j.lado);
  if (rivales.some(r => distancia(r.posicion, j.posicion) < LA.remate.espacioM)) return false;
  const arco = transformar(CENTRO_ARCO_RIVAL, j.lado);
  return !rivales.some(r => r.puesto !== "POR" && proyeccion(r.posicion, j.posicion, arco).distancia < LA.remate.lineaM);
}

/** § 8.1 · Probabilidad de la decisión local del remate lejano (sin acotar; el motor usa min(1, p)). */
export const probabilidadLejano = (remate: number, potencia: number): number =>
  LA.remate.probabilidad * (LA.remate.remateBase + remate / 100) * (LA.remate.potenciaBase + efectoAtributo(potencia));

/** § 8.1 · Metros por encima de radioTiroM de un remate a `d` m del centro del arco, acotados al dominio
 * (radioTiroM, maxM]; 0 a d ≤ radioTiroM. */
export const lejosRemate = (d: number): number => Math.max(0, Math.min(d, LA.remate.maxM) - ARENA.radioTiroM);
/** § 8.1 · Multiplicador del error del remate lejano (1 con lejos = 0; ≤ 1 + errorPorM·(maxM − radioTiroM)). */
export const factorErrorLejano = (lejos: number): number => 1 + LA.remate.errorPorM * lejos;
/** § 8.1 · Probabilidad de alto del remate lejano: la de v5 + altoPorM·lejos, acotada a altoMax (con lejos > 0). */
export const altoLejano = (base: number, lejos: number): number => Math.min(LA.remate.altoMax, base + LA.remate.altoPorM * lejos);

/** § 8.2 · Alcance del balón largo según la visión; null si la visión no llega a visionMin. */
export function alcanceLargo(a: AtributosJugador | undefined): number | null {
  if (!a || a.vision < LA.pase.visionMin) return null;
  return ARENA.paseMaxM + (LA.pase.maxM - ARENA.paseMaxM) * Math.min(1, (a.vision - LA.pase.visionMin) / (100 - LA.pase.visionMin));
}

/** § 8.2 · Error lateral extra (m) del balón largo de `d` m. */
export const errorExtraLargo = (d: number, vision: number): number =>
  LA.pase.errorM * Math.max(0, d - ARENA.paseMaxM) / (LA.pase.maxM - ARENA.paseMaxM) * (LA.pase.errorVisionBase - vision / 100);

export interface CandidatoLargo { receptor: JugadorArena; destino: Punto; d: number; avance: number; ventaja: number; puntuacion: number }
/** § 8.2 · Mejor balón largo: compañero de campo (nunca desde ni hacia el portero) a (paseMaxM, alcance], con
 * avance orientado ≥ avanceMinM o cambio de orientación (|Δy| ≥ cambioFraccion·anchoM), destino extrapolado con su
 * velocidad durante d/velocidadBalonMps y ventaja positiva en la caída. Mayor puntuación; en empate, el id menor. */
export function opcionPaseLargo(j: JugadorArena, a: AtributosJugador | undefined, estado: EstadoArena): CandidatoLargo | undefined {
  const alcance = alcanceLargo(a);
  if (alcance === null || j.puesto === "POR") return undefined;
  const o = transformar(j.posicion, j.lado);
  const rivales = estado.jugadores.filter(r => r.lado !== j.lado && r.puesto !== "POR");
  const candidatos: CandidatoLargo[] = [];
  for (const r of estado.jugadores) {
    if (r.lado !== j.lado || r.id === j.id || r.puesto === "POR") continue;
    const d = distancia(j.posicion, r.posicion);
    if (d <= ARENA.paseMaxM || d > alcance) continue;
    const ro = transformar(r.posicion, j.lado), avance = ro.x - o.x;
    if (avance < LA.pase.avanceMinM && Math.abs(ro.y - o.y) < LA.pase.cambioFraccion * ARENA.anchoM) continue;
    const viaje = d / ARENA.velocidadBalonMps;
    const destino = enCancha({ x: r.posicion.x + r.velocidad.x * viaje, y: r.posicion.y + r.velocidad.y * viaje });
    const ventaja = (rivales.length ? Math.min(...rivales.map(x => distancia(x.posicion, destino))) : Infinity) - distancia(r.posicion, destino);
    if (!(ventaja > 0)) continue;
    const puntuacion = avance + Math.min(ventaja, ARENA.margenUtilM) - d * ARENA.pesoDistanciaPase * LA.pase.penalizacion;
    candidatos.push({ receptor: r, destino, d, avance, ventaja, puntuacion });
  }
  return candidatos.sort((x, y) => y.puntuacion - x.puntuacion || x.receptor.id.localeCompare(y.receptor.id))[0];
}

/** § 8.1 · Portero ante un remate lejano: el punto de la trayectoria origen → destino del vuelo en su x orientada
 * actual, con t acotado a [0; 1] (el motor aplica después el límite de área existente). */
export function destinoTrayectoria(vuelo: { origen: Punto; destino: Punto }, portero: Pick<JugadorArena, "posicion" | "lado">): Punto {
  const o = transformar(vuelo.origen, portero.lado), dd = transformar(vuelo.destino, portero.lado), px = transformar(portero.posicion, portero.lado).x;
  const t = dd.x !== o.x ? Math.min(1, Math.max(0, (px - o.x) / (dd.x - o.x))) : 1;
  return transformar({ x: px, y: o.y + (dd.y - o.y) * t }, portero.lado);
}
