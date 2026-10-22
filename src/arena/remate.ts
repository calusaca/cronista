// Brief 051 (reinicios-v5): funciones puras del remate y del portero ante el remate. El motor las
// llama solo bajo v5 (getter `v5` de MotorArena); las pruebas las usan directamente. Las cifras
// salen de REMATE_ARENA, PORTERO_ARENA y ARENA; aquí no hay umbrales propios.
import { ARENA, PORTERO_ARENA as PO, REMATE_ARENA as RM } from "../sim/limites";
import type { Lado } from "../sim/tipos";
import { transformar } from "./catalogo";
import { limitar } from "./geometria";
import { lineaArcoBalon } from "./portero";
import type { Punto } from "./tipos";

const MEDIO_Y = ARENA.anchoM / 2;
/** Tendencia `remate` neutra (escala 0–100) de un jugador sin personalidad: no añade ni quita margen. */
export const REMATE_NEUTRO = 50;
/** Nivel de referencia (escala 0–100) del término de nivel de `probabilidadDesvio`. */
const NIVEL_MEDIO = 50;

/** Objetivo del remate en coordenadas ORIENTADAS del rematador (arco rival en x = largoM): `y` dentro
 * del arco, `lado` = +1 (hacia +y) o −1, y el margen desde el palo. El lado es el contrario a donde
 * está el portero respecto de la RECTA rematador–centro del arco (distancia perpendicular por producto
 * cruzado normalizado, v1.1 #5); con el portero sobre la recta (≤ indiferenciaM), sin portero o con el
 * rematador sobre el centro del arco, el palo lejano respecto de la y del rematador (y = 34 → +y). */
export function objetivoRemate(origen: Punto, portero: Punto | null, nivel: number, remate: number, lado: Lado): { y: number; lado: 1 | -1; margenM: number } {
  const o = transformar(origen, lado), arco = { x: ARENA.largoM, y: MEDIO_Y };
  let s: 1 | -1 = o.y <= MEDIO_Y ? 1 : -1;
  const largo = Math.hypot(arco.x - o.x, arco.y - o.y);
  if (portero && largo > 0) {
    const k = transformar(portero, lado);
    // cruz > 0: el portero queda hacia −y de la recta (marco orientado); se apunta a +y.
    const cruz = (k.x - o.x) * (arco.y - o.y) - (k.y - o.y) * (arco.x - o.x);
    if (Math.abs(cruz) / largo > RM.indiferenciaM) s = cruz > 0 ? 1 : -1;
  }
  const margenM = limitar(RM.margenPaloM + RM.margenNivelM * (1 - nivel / 100) + RM.margenPersonalidadM * (0.5 - remate / 100), RM.margenPaloM, ARENA.arcoM / 2);
  return { y: MEDIO_Y + s * (ARENA.arcoM / 2 - margenM), lado: s, margenM };
}

/** Potencia ∈ [0, 1] según la distancia (m) al centro del arco: 0 hasta colocadoHastaM, 1 desde potenteDesdeM. */
export const potenciaRemate = (distanciaM: number): number => limitar((distanciaM - RM.colocadoHastaM) / (RM.potenteDesdeM - RM.colocadoHastaM), 0, 1);

/** Velocidad del remate (m/s, sin el factor del entorno). */
export const velocidadRemate = (potencia: number): number => ARENA.velocidadTiroMps * (1 + RM.potenciaVelocidad * (potencia - 0.5));

/** Semiancho (m) del error lateral triangular por nivel, distancia y potencia; el motor le suma la
 * lluvia y la presión de la afición como al remate anterior. */
export const errorRemate = (nivel: number, distanciaM: number, potencia: number): number =>
  RM.errorBaseM * (1 - nivel / 100) * limitar(distanciaM / RM.referenciaM, RM.factorDistanciaMin, RM.factorDistanciaMax) * (1 + RM.errorPotencia * potencia);

/** Probabilidad de que el remate salga por encima del travesaño (modelada, sin altura simulada). */
export const probabilidadAlto = (nivel: number, potencia: number): number => RM.altoBase + RM.altoPotencia * potencia + RM.altoNivel * (1 - nivel / 100);

/** Tiempo de reacción (s) de referencia: PORTERO_ARENA.reaccionM a ARENA.velocidadTiroMps. */
export const reaccionS = (): number => PO.reaccionM / ARENA.velocidadTiroMps;

/** Radio de contacto (m) del portero ante un remate: alcance por nivel × min(1, t/reaccionS), nunca
 * menor que cuerpoM; t = distancia origen–portero / velocidad efectiva del remate (v1.1 #3). */
export function alcancePortero(nivel: number, tiempoS: number): number {
  const factor = Number.isFinite(tiempoS) ? Math.min(1, Math.max(0, tiempoS) / reaccionS()) : 1;
  return Math.max(PO.cuerpoM, (RM.alcanceMinM + (RM.alcanceMaxM - RM.alcanceMinM) * nivel / 100) * factor);
}

/** Estirada ∈ [0, 1]: (distancia lateral del balón al portero − cuerpoM) / (alcance − cuerpoM); 0 si
 * el alcance no supera cuerpoM (v1.1 #2: sin división por cero). */
export const estiradaPortero = (distanciaLateralM: number, alcanceM: number): number =>
  alcanceM > PO.cuerpoM ? limitar((distanciaLateralM - PO.cuerpoM) / (alcanceM - PO.cuerpoM), 0, 1) : 0;

/** Probabilidad de desviar (en vez de atrapar) un remate que toca: siempre finita en [desvioMin, desvioMax]. */
export function probabilidadDesvio(nivel: number, potencia: number, estirada: number): number {
  const e = Number.isFinite(estirada) ? limitar(estirada, 0, 1) : 0;
  const p = RM.desvioBase + RM.desvioPotencia * (potencia - 0.5) - RM.desvioNivel * (nivel - NIVEL_MEDIO) / NIVEL_MEDIO + RM.desvioEstirada * e;
  return Number.isFinite(p) ? limitar(p, RM.desvioMin, RM.desvioMax) : RM.desvioMin;
}

/** Posicionamiento del portero fuera del mano a mano: C + u·posicionamientoM sobre la línea
 * balón–centro del arco (misma dirección que `destinoSalida`). Coordenadas absolutas. */
export function destinoPosicionamiento(balon: Punto, lado: Lado): Punto {
  const { dx, dy, d } = lineaArcoBalon(balon, lado);
  if (!d) return transformar({ x: ARENA.controlM, y: MEDIO_Y }, lado);
  return transformar({ x: dx / d * RM.posicionamientoM, y: MEDIO_Y + dy / d * RM.posicionamientoM }, lado);
}

/** ¿El balón está a ≤ manoAManoRadioM del centro del arco del lado? (condición del posicionamiento). */
export const balonCercaDelArco = (balon: Punto, lado: Lado): boolean => {
  const { d } = lineaArcoBalon(balon, lado);
  return d > 0 && d <= PO.manoAManoRadioM;
};
