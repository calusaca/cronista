// Brief 011 — geometría de la pizarra del gol desde los DATOS: cada punto sale de un campo
// registrado en los eventos (zonaOrigen, banda del córner, destino). Una sola tabla
// zona → (x, y). Son zonas, no centímetros: el rótulo lo dice. Funciones puras (la UI y las
// pruebas usan las mismas).
//
// Sistema de coordenadas del SVG (viewBox 0 0 100 72): el arco atacado arriba (y = 2, de
// x 45 a 55), la vista es la del atacante mirando al arco: su izquierda es x pequeña.

import type { Destino, ZonaOrigen } from "../sim/limites";
import { cornerDelTiro } from "../sim/espacial";
import type { Evento } from "../sim/tipos";
import type { PasoJugada } from "./evidencia";

export interface Punto {
  x: number;
  y: number;
}

/** LA tabla zona → punto (una sola). */
export const POS_ZONA: Record<ZonaOrigen, Punto> = {
  area_chica: { x: 50, y: 6 },
  punto_penal: { x: 50, y: 13 },
  frontal_del_area: { x: 50, y: 22 },
  banda_izquierda: { x: 14, y: 14 },
  banda_derecha: { x: 86, y: 14 },
  media_distancia: { x: 50, y: 36 },
};

/** Banderines de córner (vista del atacante). */
export const POS_CORNER: Record<"izquierda" | "derecha", Punto> = {
  izquierda: { x: 2.5, y: 2.5 },
  derecha: { x: 97.5, y: 2.5 },
};

/** Dónde entra el balón según el destino registrado (vista del tirador). */
export const POS_DESTINO: Record<Destino, Punto> = {
  palo_izquierdo: { x: 45.8, y: 2.4 },
  palo_derecho: { x: 54.2, y: 2.4 },
  centro_del_arco: { x: 50, y: 2.4 },
};

/**
 * Brief 020: unidades de la pizarra por metro, para dibujar a escala lo que la zona no alcanza
 * (la media cancha recorre su distancia REAL). Calibrada con la tabla de zonas: la media distancia
 * (20–32 m) cae en y ≈ 36. La línea de medio campo queda a 52,5 m del arco.
 */
export const UNIDADES_POR_M = 1.22;
export const MEDIO_CAMPO_M = 52.5;
const yDeMetros = (m: number) => 2 + m * UNIDADES_POR_M;

export interface GeometriaJugada {
  /** Brief 025: el remate dio en un palo (1) o en los dos (2): el balón no entra, rebota. */
  palos?: 1 | 2;
  /** Brief 020: la definición registrada del tiro y, si fue en propia puerta, dónde la tocó el autor. */
  definicion?: string;
  autor?: Punto;
  /** Alto del dibujo (la media cancha necesita la cancha hasta el medio campo). */
  alto: number;
  /** Punto del paso que preparó el remate (córner o pase clave con zona registrada). */
  origen?: Punto;
  origenRol?: "corner" | "pase_clave";
  remate: Punto;
  arco: Punto;
  /** Los datos que respaldan el dibujo (para rotular). */
  zona: ZonaOrigen;
  destino: Destino;
  altura?: string;
}

/**
 * Geometría desde los datos, o undefined si el tiro no tiene detalle espacial (un partido
 * viejo): entonces la UI cae a la pizarra convencional con su rótulo anterior.
 *
 * Brief 012 §F3–F4: el origen dibujado es el paso de ataque INMEDIATO al remate (si hay un
 * pase clave entre el córner y el tiro, se dibuja el pase; el córner queda en los pasos de
 * texto), y un córner solo se dibuja si el tiro es «tras córner» según LA definición del
 * generador (`cornerDelTiro`). Un penal no dibuja origen (la falta no tiene zona).
 */
/** Brief 025: los postes del arco en la pizarra (el borde de la boca, x 45 y 55). */
export const POS_POSTE: Record<"palo_izquierdo" | "palo_derecho", Punto> = { palo_izquierdo: { x: 45, y: 2.2 }, palo_derecho: { x: 55, y: 2.2 } };

export function geometriaJugada(pasos: PasoJugada[], eventos: readonly Evento[]): GeometriaJugada | undefined {
  const tiro = pasos.find((p) => p.rol === "tiro")?.evento;
  // Brief 025: el gol olímpico — del banderín registrado al palo registrado, sin remate intermedio.
  const golOlimpico = pasos.find((p) => p.rol === "gol" && p.evento.definicion === "olimpico")?.evento;
  const cornerOlimpico = pasos.find((p) => p.rol === "corner")?.evento;
  if (!tiro && golOlimpico?.destino && cornerOlimpico?.banda) {
    return { remate: POS_CORNER[cornerOlimpico.banda], arco: POS_DESTINO[golOlimpico.destino], zona: "area_chica", destino: golOlimpico.destino, ...(golOlimpico.altura ? { altura: golOlimpico.altura } : {}), definicion: "olimpico", alto: 48 };
  }
  if (!tiro?.zonaOrigen || !tiro.destino) return undefined;
  // Brief 020: la media cancha se dibuja a su distancia registrada (no a la de su zona).
  const remate = tiro.definicion === "media_cancha" && tiro.distanciaM !== undefined ? { x: 50, y: yDeMetros(tiro.distanciaM) } : POS_ZONA[tiro.zonaOrigen];
  const geo: GeometriaJugada = { remate, arco: POS_DESTINO[tiro.destino], zona: tiro.zonaOrigen, destino: tiro.destino, alto: remate.y > 40 ? 76 : 48 };
  if (tiro.definicion && tiro.definicion !== "jugada") geo.definicion = tiro.definicion;
  // Brief 025: al palo — el balón termina en el poste registrado (y en el otro, si fueron los dos).
  if (tiro.alPalo !== undefined && (tiro.destino === "palo_izquierdo" || tiro.destino === "palo_derecho")) {
    geo.palos = tiro.alPalo;
    geo.arco = POS_POSTE[tiro.destino];
  }
  // Brief 020: en propia puerta, el autor la toca en el área chica, camino del arco.
  const gol = pasos.find((p) => p.rol === "gol")?.evento;
  if (gol?.autogol === true) geo.autor = { x: geo.arco.x + (remate.x >= 50 ? -3 : 3), y: 6 };
  if (tiro.altura) geo.altura = tiro.altura;
  // Un penal no dibuja origen: jugadaDelGol solo le da la falta (que no tiene zona) — §F2.
  const inmediato = [...pasos].reverse().find((p) => p.rol === "corner" || p.rol === "pase_clave");
  const e: Evento | undefined = inmediato?.evento;
  if (inmediato?.rol === "corner" && e?.banda) {
    const i = eventos.findIndex((x) => x.id === tiro.id);
    if (cornerDelTiro(eventos, i)?.id === e.id) {
      geo.origen = POS_CORNER[e.banda];
      geo.origenRol = "corner";
    }
  } else if (inmediato?.rol === "pase_clave" && e?.zonaOrigen) {
    const p = POS_ZONA[e.zonaOrigen];
    // Pase y remate desde la misma zona: el pase se dibuja un poco atrás para que se vea.
    geo.origen = p.x === remate.x && p.y === remate.y ? { x: p.x, y: p.y + 9 } : p;
    geo.origenRol = "pase_clave";
  }
  return geo;
}

/**
 * Los puntos que recorre el balón, en orden (origen → remate → [autor] → arco). Brief 025: si el
 * remate dio en el palo, sigue el rebote (al otro poste si fueron dos, y fuera del arco).
 */
export function recorrido(geo: GeometriaJugada): Punto[] {
  // Brief 025: con dos palos, el balón cruza la boca de un poste al otro y sale despedido.
  const otro = geo.palos === 2 ? (geo.arco.x < 50 ? POS_POSTE.palo_derecho : POS_POSTE.palo_izquierdo) : undefined;
  const fuera = geo.palos !== undefined ? { x: (otro ?? geo.arco).x + ((otro ?? geo.arco).x < 50 ? -5 : 5), y: 9 } : undefined;
  // Brief 025: el olímpico no va por la línea de fondo: se cierra desde el banderín (un punto de
  // curva esquemático, a mitad de camino y dentro del campo; no es una coordenada registrada).
  const curva = geo.definicion === "olimpico" ? [{ x: (geo.remate.x + geo.arco.x) / 2, y: Math.max(geo.remate.y, geo.arco.y) + 7 }] : [];
  return [...(geo.origen ? [geo.origen] : []), geo.remate, ...curva, ...(geo.autor ? [geo.autor] : []), geo.arco, ...(otro ? [otro] : []), ...(fuera ? [fuera] : [])];
}

/**
 * Posición del balón en t ∈ [0, 1] a lo largo del recorrido (tramos de igual duración).
 * En t = 1 está EXACTAMENTE en el destino registrado.
 */
export function posicionBalon(geo: GeometriaJugada, t: number): Punto {
  const ps = recorrido(geo);
  // Al final, el punto registrado tal cual (sin error de redondeo de la interpolación).
  if (t >= 1) return { ...(ps[ps.length - 1] as Punto) };
  const u = Math.max(0, t) * (ps.length - 1);
  const k = Math.min(ps.length - 2, Math.floor(u));
  const a = ps[k] as Punto;
  const b = ps[k + 1] as Punto;
  const f = u - k;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

/** Duración de la animación del gol (brief 011: ~2.5 s). */
export const DURACION_ANIMACION_MS = 2500;
