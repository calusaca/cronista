// Parámetros internos del motor (perillas de calibración). NO son umbrales de prueba:
// los umbrales viven en limites.ts. Estos valores se ajustan para que el motor caiga
// dentro de esos umbrales, nunca al revés.

import { XG_PENAL } from "./limites";
import type { Estilo, Posicion } from "./tipos";

export const P = {
  // --- Reloj ---
  /** Duración de una posesión en minutos: base + uniforme(0, rango), × factor de estilo. */
  duracionMin: 0.2,
  duracionRango: 0.5,
  /** Minutos que se consumen tras un gol (celebración + saque). */
  tiempoGol: 1.0,
  /** Tiempo entre eventos encadenados dentro de una misma posesión. */
  pasoEvento: 0.1,
  /** Descuento del primer tiempo (sus eventos se sellan en el minuto 45). */
  descuento1: { min: 1, max: 3 },
  /** Descuento del segundo tiempo (minutos 90+1 … 90+max). */
  descuento2: { min: 2, max: 6 },

  // --- Progresión ---
  /** Probabilidad base de que una posesión llegue al último tercio. */
  ataqueBase: 0.3,
  /** Sensibilidad exponencial a (ataque propio − defensa rival)/100. */
  kFuerzaAtaque: 1.2,
  /** Tope de probabilidad de llegar al último tercio. */
  ataqueMax: 0.8,

  // --- Resolución en el último tercio (probabilidades excluyentes) ---
  pTiro: 0.32,
  pFueraDeJuego: 0.07,
  pFaltaArea: 0.1,
  pCornerDirecto: 0.1,

  // --- Tiros ---
  /** log-xG ~ Normal(mu + desplazamientos, sigma), recortado a [xgMin, xgMax]. */
  xgMu: -2.8,
  xgSigma: 0.9,
  xgMuCabezazo: -2.9,
  xgMuTiroLibre: -3.0,
  xgMin: 0.01,
  xgMax: 0.95,
  /** Desplazamiento de log-xG por (ataque − defensa rival)/100. */
  kFuerzaXg: 1.0,
  /** Probabilidad de atajada (condicionada a no gol), en tiro abierto y penal. */
  pAtajada: 0.3,
  pAtajadaPenal: 0.7,
  /** Corner tras atajada / tras tiro desviado. */
  pCornerTrasAtajada: 0.35,
  pCornerTrasDesvio: 0.12,
  /** Tiro tras corner (cabezazo). */
  pTiroCorner: 0.3,
  xgPenal: XG_PENAL, // brief 012: la misma cifra que la banda del punto penal (limites.ts)
  /** Tras una falta en el último tercio: penal o tiro libre directo. */
  pPenalTrasFalta: 0.035,
  pTiroLibreTrasFalta: 0.12,

  // --- Faltas y tarjetas ---
  /** Falta del equipo que defiende cuando la posesión NO llega al último tercio. */
  pFaltaDefensorMedio: 0.08,
  /** Falta del equipo que ataca (cargas, manos) en una posesión cualquiera. */
  pFaltaAtacante: 0.025,
  pAmarilla: 0.16,
  /** Amarilla en la falta que concede un penal (ocasión manifiesta). */
  pAmarillaPenal: 0.45,
  pRojaDirecta: 0.0025,
  /** Un amonestado comete menos faltas (peso multiplicado). */
  cautelaAmonestado: 0.15,

  // --- Estado del partido ---
  /** Cansancio: crece linealmente entre estos minutos (0 → 1). */
  fatigaDesde: 60,
  fatigaHasta: 90,
  fatigaAtaque: 0.12,
  fatigaXg: 0.12,
  fatigaFaltas: 0.15,
  /** Desde este minuto, el que pierde empuja y el que gana se repliega. */
  marcadorDesde: 60,
  perdiendoEmpuje: 0.15,
  ganandoRepliegue: 0.1,
  /** Por cada expulsado propio / del rival. */
  rojaPropiaAtaque: 0.85,
  rojaRivalAtaque: 1.12,
  rojaRivalXg: 0.06,

  // --- Cambios ---
  /** Distribución del número de cambios por equipo (índice = cantidad). */
  pesosCambios: [0.04, 0.08, 0.25, 0.63],
  cambioDesde: 55,
  cambioHasta: 88,
} as const;

/** Efectos de estilo del equipo que ataca. */
export const ESTILO_ATAQUE: Record<
  Estilo,
  { duracion: number; ataque: number; paseClave: number; xgShift: number }
> = {
  // Posesiones largas, llega con pases elaborados.
  posesion: { duracion: 1.3, ataque: 1.2, paseClave: 0.85, xgShift: 0.0 },
  // Posesiones cortas, menos llegadas pero ocasiones más claras.
  contragolpe: { duracion: 0.8, ataque: 0.85, paseClave: 0.5, xgShift: 0.24 },
  // Recupera arriba: llega más a menudo, tiros de calidad normal.
  presion: { duracion: 0.95, ataque: 1.1, paseClave: 0.5, xgShift: -0.05 },
};

/** Efectos de estilo del equipo que defiende. */
export const ESTILO_DEFENSA: Record<Estilo, { faltas: number; ataqueRival: number }> = {
  posesion: { faltas: 0.9, ataqueRival: 1.0 },
  contragolpe: { faltas: 1.0, ataqueRival: 1.0 },
  presion: { faltas: 1.4, ataqueRival: 0.95 },
};

/** Pesos por posición para elegir protagonista de cada tipo de acción. */
export const PESOS: Record<string, Record<Posicion, number>> = {
  tiro: { POR: 0, DEF: 1, MED: 3, DEL: 6 },
  cabezazo: { POR: 0, DEF: 3, MED: 1, DEL: 4 },
  paseClave: { POR: 0, DEF: 2, MED: 5, DEL: 3 },
  falta: { POR: 0, DEF: 4, MED: 4, DEL: 2 },
  fueraDeJuego: { POR: 0, DEF: 0.3, MED: 2, DEL: 6 },
  corner: { POR: 0, DEF: 1, MED: 5, DEL: 2 },
  tiroLibre: { POR: 0, DEF: 1, MED: 4, DEL: 3 },
  saleCambio: { POR: 0, DEF: 2, MED: 3, DEL: 4 },
};

/**
 * Brief 011 — pesos del detalle espacial (perillas; las bandas que los acotan viven en
 * limites.ts). Se sortean con prngDerivado(semilla, id): nunca tocan el stream principal.
 */
export const ESPACIAL = {
  /** Destino del tiro (visto desde el tirador). */
  destino: { palo_izquierdo: 0.4, palo_derecho: 0.4, centro_del_arco: 0.2 },
  altura: { raso: 0.45, media: 0.3, alta: 0.25 },
  /** Tiro de jugada con ocasión clara (xG ≥ banda de área chica). */
  jugadaClara: { area_chica: 0.55, frontal_del_area: 0.3, banda_izquierda: 0.075, banda_derecha: 0.075 },
  /** Tiro de jugada intermedio (entre las dos bandas). */
  jugadaMedia: { frontal_del_area: 0.6, banda_izquierda: 0.2, banda_derecha: 0.2 },
  /** Brief 012: un tiro de jugada con xG ≤ esto (y dentro de la banda de media distancia) usa la tabla lejana. */
  lejanoXgMax: 0.08,
  /** Tiro de jugada lejano. */
  jugadaLejana: { media_distancia: 0.5, frontal_del_area: 0.2, banda_izquierda: 0.15, banda_derecha: 0.15 },
  /** Cabezazo de córner con ocasión clara; si no, frontal del área. */
  cornerClaro: { area_chica: 0.7, frontal_del_area: 0.3 },
  /** Tiro libre lejano; si no, frontal del área. */
  libreLejano: { media_distancia: 0.6, frontal_del_area: 0.4 },
  /** Pase clave desde el último tercio (desde el medio es siempre media distancia). */
  paseAtaque: { banda_izquierda: 0.35, banda_derecha: 0.35, frontal_del_area: 0.3 },
  banda: { izquierda: 0.5, derecha: 0.5 },
} as const;
