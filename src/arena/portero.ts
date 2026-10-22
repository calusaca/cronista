// Brief 046 (reinicios-v4): funciones puras del portero. El motor las llama solo bajo v4;
// las métricas de lote usan `manoAMano` con ARENA.radioTiroM para comparar con la línea base.
import { ARENA, PORTERO_ARENA as PO } from "../sim/limites";
import type { Lado } from "../sim/tipos";
import { transformar } from "./catalogo";
import { distancia, enCancha, limitar, proyeccion } from "./geometria";
import type { EstadoArena, JugadorArena, Punto } from "./tipos";

const MEDIO_Y = ARENA.anchoM / 2;

/** Punto (coordenadas absolutas) dentro del área propia del lado, como en `moverBalon`. */
export function enAreaPropia(p: Punto, lado: Lado): boolean {
  const o = transformar(p, lado);
  return o.x <= ARENA.areaLargoM && Math.abs(o.y - MEDIO_Y) <= ARENA.areaAnchoM / 2;
}

/** Acota un punto a la caja del área propia, a ≥ controlM de la línea de gol. */
export function limitarAreaPropia(p: Punto, lado: Lado): Punto {
  const o = transformar(p, lado);
  return transformar({ x: limitar(o.x, ARENA.controlM, ARENA.areaLargoM), y: limitar(o.y, MEDIO_Y - ARENA.areaAnchoM / 2, MEDIO_Y + ARENA.areaAnchoM / 2) }, lado);
}

/** Criterio A de la investigación: poseedor de campo rival a ≤ radioM del arco del portero y
 * ningún jugador de campo del portero más cerca de la línea que él (x orientada ≤ la suya). */
export function manoAMano(estado: EstadoArena, ladoPortero: Lado, radioM: number): JugadorArena | null {
  if (estado.saque || (estado.pausa && estado.tick < estado.pausa.hastaTick)) return null;
  const p = estado.jugadores.find(j => j.id === estado.balon.poseedor);
  if (!p || p.lado === ladoPortero || p.puesto === "POR") return null;
  const o = transformar(p.posicion, p.lado);
  if (Math.hypot(o.x - ARENA.largoM, o.y - MEDIO_Y) > radioM) return null;
  return estado.jugadores.filter(j => j.lado === ladoPortero && j.puesto !== "POR").every(d => transformar(d.posicion, p.lado).x <= o.x) ? p : null;
}

/** Brief 051: dirección (coordenadas orientadas del portero) de la línea centro del arco propio–balón
 * y distancia del balón a ese centro. La comparten la salida (046) y el posicionamiento (051). */
export function lineaArcoBalon(balon: Punto, lado: Lado): { dx: number; dy: number; d: number } {
  const b = transformar(balon, lado), dx = b.x, dy = b.y - MEDIO_Y;
  return { dx, dy, d: Math.hypot(dx, dy) };
}

/** Destino de la salida: C + u·s, con C el centro del arco propio y u la dirección al balón. */
export function destinoSalida(balon: Punto, lado: Lado): Punto {
  const { dx, dy, d } = lineaArcoBalon(balon, lado);
  if (!d) return transformar({ x: ARENA.controlM, y: MEDIO_Y }, lado);
  const s = Math.min(PO.salidaMaxM, Math.max(ARENA.controlM, d - Math.max(PO.salidaHolguraM, PO.salidaFraccion * d)));
  return transformar({ x: dx / d * s, y: MEDIO_Y + dy / d * s }, lado);
}

/** Radio de contacto del portero en su área ante un remate originado a `distanciaOrigenM`. */
export const radioAtajada = (distanciaOrigenM: number): number => Math.max(PO.cuerpoM, ARENA.controlPorteroM * Math.min(1, distanciaOrigenM / PO.reaccionM));

/** Radio que respetan los rivales del portero con manos (v1.2: con histéresis). */
export const radioManos = (): number => PO.distanciaManosM + PO.margenManosM;

/** Proyecta a radioManos() del portero el destino de un rival que quedaría más cerca, en la
 * dirección destino − portero (o jugador − portero si coinciden). Si ese punto cae fuera del
 * campo, devuelve el punto del círculo dentro del campo más cercano al destino: junto a una línea
 * el recorte nunca lo deja dentro del radio protegido. */
export function respetarManos(destino: Punto, posicion: Punto, portero: Punto): Punto {
  const d = distancia(destino, portero);
  const r = radioManos();
  if (d >= r) return destino;
  let ux = destino.x - portero.x, uy = destino.y - portero.y;
  if (!d) { ux = posicion.x - portero.x; uy = posicion.y - portero.y; }
  // Jugador, destino y portero en el mismo punto: hacia el centro del campo.
  if (!Math.hypot(ux, uy)) { ux = ARENA.largoM / 2 - portero.x; uy = MEDIO_Y - portero.y; }
  const base = Math.atan2(uy, ux);
  const punto = (a: number): Punto => ({ x: portero.x + Math.cos(a) * r, y: portero.y + Math.sin(a) * r });
  const EPS = 1e-9, enCampo = (p: Punto) => p.x >= -EPS && p.x <= ARENA.largoM + EPS && p.y >= -EPS && p.y <= ARENA.anchoM + EPS;
  if (enCampo(punto(base))) return enCancha(punto(base));
  // La distancia al destino crece con la diferencia angular respecto de `base`, así que el punto
  // factible más cercano es un extremo de un arco dentro del campo: un corte del círculo con una línea.
  const cortes: number[] = [];
  for (const x of [0, ARENA.largoM]) { const c = (x - portero.x) / r; if (Math.abs(c) <= 1) cortes.push(Math.acos(c), -Math.acos(c)); }
  for (const y of [0, ARENA.anchoM]) { const s = (y - portero.y) / r; if (Math.abs(s) <= 1) cortes.push(Math.asin(s), Math.PI - Math.asin(s)); }
  const diferencia = (a: number) => Math.abs(Math.atan2(Math.sin(a - base), Math.cos(a - base)));
  const mejor = cortes.filter(a => enCampo(punto(a))).sort((a, b) => diferencia(a) - diferencia(b))[0];
  return enCancha(punto(mejor ?? base));
}

/** Ticks que dura el balón en las manos. */
export const ticksManos = (): number => Math.round(PO.manosMaxS / ARENA.pasoS);

/** Margen de un compañero (v1.1 #2): distancia a su rival más cercano. */
export function margenCompanero(companero: Punto, rivales: readonly JugadorArena[]): number {
  return Math.min(...rivales.map(r => distancia(r.posicion, companero)));
}

/** Margen de una línea de pase: distancia mínima de los rivales al segmento. */
export function margenLinea(desde: Punto, hasta: Punto, rivales: readonly JugadorArena[]): number {
  return Math.min(...rivales.map(r => proyeccion(r.posicion, desde, hasta).distancia));
}

/** v1.2 · un saque desde las manos hacia `destino` es admisible si es largo (aéreo, a más de
 * saqueAereoMinM) o corto con línea limpia (ningún rival a menos de lineaSaqueMinM del segmento). */
export function saqueAdmisible(desde: Punto, destino: Punto, rivales: readonly JugadorArena[]): { admisible: boolean; aereo: boolean } {
  const aereo = distancia(desde, destino) > PO.saqueAereoMinM;
  return { aereo, admisible: aereo || margenLinea(desde, destino, rivales) >= PO.lineaSaqueMinM };
}

/** Saque forzado al vencer el plazo: entre los compañeros de campo con saque admisible (v1.2), el
 * de mayor margen respecto de su rival más cercano, sin límite de distancia (v1.1), desempate por
 * id. `destinoDe` da el punto al que iría el saque. `undefined` si ninguno es admisible: despeje. */
export function saqueForzado(portero: JugadorArena, estado: EstadoArena, destinoDe: (p: JugadorArena) => Punto = p => p.posicion): JugadorArena | undefined {
  const rivales = estado.jugadores.filter(p => p.lado !== portero.lado);
  return estado.jugadores.filter(p => p.lado === portero.lado && p.id !== portero.id && p.puesto !== "POR" && saqueAdmisible(portero.posicion, destinoDe(p), rivales).admisible)
    .map(p => ({ p, margen: margenCompanero(p.posicion, rivales) }))
    .sort((a, b) => b.margen - a.margen || a.p.id.localeCompare(b.p.id))[0]?.p;
}

/** Despeje sin receptor (v1.1): centro del campo en x, la misma y del portero acotada al campo.
 * v1.2: siempre aéreo. */
export const despejeManos = (portero: Punto): Punto => ({ x: ARENA.largoM / 2, y: limitar(portero.y, 0, ARENA.anchoM) });
