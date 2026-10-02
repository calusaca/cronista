// Brief 011 — geometría de la pizarra del gol desde los DATOS: cada punto sale de un campo
// registrado en los eventos (zonaOrigen, banda del córner, destino). Una sola tabla
// zona → (x, y). Son zonas, no centímetros: el rótulo lo dice. Funciones puras (la UI y las
// pruebas usan las mismas).
//
// Sistema de coordenadas del SVG (viewBox 0 0 100 72): el arco atacado arriba (y = 2, de
// x 45 a 55), la vista es la del atacante mirando al arco: su izquierda es x pequeña.

import type { Destino, ZonaOrigen } from "../sim/limites";
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

export interface GeometriaJugada {
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
 */
export function geometriaJugada(pasos: PasoJugada[]): GeometriaJugada | undefined {
  const tiro = pasos.find((p) => p.rol === "tiro")?.evento;
  if (!tiro?.zonaOrigen || !tiro.destino) return undefined;
  const remate = POS_ZONA[tiro.zonaOrigen];
  const geo: GeometriaJugada = { remate, arco: POS_DESTINO[tiro.destino], zona: tiro.zonaOrigen, destino: tiro.destino };
  if (tiro.altura) geo.altura = tiro.altura;
  const previo = pasos.find((p) => p.rol === "corner" || p.rol === "pase_clave");
  const e: Evento | undefined = previo?.evento;
  if (previo?.rol === "corner" && e?.banda) {
    geo.origen = POS_CORNER[e.banda];
    geo.origenRol = "corner";
  } else if (previo?.rol === "pase_clave" && e?.zonaOrigen) {
    const p = POS_ZONA[e.zonaOrigen];
    // Pase y remate desde la misma zona: el pase se dibuja un poco atrás para que se vea.
    geo.origen = p.x === remate.x && p.y === remate.y ? { x: p.x, y: p.y + 9 } : p;
    geo.origenRol = "pase_clave";
  }
  return geo;
}

/** Los puntos que recorre el balón, en orden (máximo 3: origen → remate → arco). */
export function recorrido(geo: GeometriaJugada): Punto[] {
  return [...(geo.origen ? [geo.origen] : []), geo.remate, geo.arco];
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
