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
  /** Brief 015 — velocidad del disparo (km/h): media, dispersión y +km/h por metro de distancia. */
  velocidadMedia: 89,
  velocidadSigma: 11,
  velocidadPorMetro: 0.6,
  velocidadMetroRef: 14,
} as const;

/**
 * Brief 018 — los SEIS modificadores de las condiciones (ni uno más). Son perillas: las
 * bandas que los acotan (A/B) viven en limites.ts (AB_CONDICIONES), escritas aparte. Todos
 * multiplican o suman a una probabilidad que ya existía: ninguno consume sorteos propios, así
 * que unas condiciones neutras dan el partido de siempre.
 */
export const CONDICIONES = {
  /** Intensidad del calor: 0 hasta `calorDesdeC`, lineal hasta 1 en `calorHastaC`. */
  calorDesdeC: 25,
  calorHastaC: 41,
  /** 1 · Cansancio: en el 2.º tiempo, acciones micro × (1 − k·i) y llegadas al último tercio × (1 − k·i). */
  calorRitmo2T: 0.2,
  calorAtaque2T: 0.22,
  /** 2 · Piernas pesadas: en el 2.º tiempo, faltas × (1 + k·i). */
  calorFaltas2T: 0.45,
  /** 3 · Lluvia: completación de todo pase − k; atajada sin retención ⇒ córner × k. */
  lluviaPase: 0.05,
  lluviaCornerTrasAtajada: 1.6,
  /** 4 · Sintética: velocidad del tiro + k km/h (bandas del 015 intactas); peso de media distancia en tiros lejanos × k. */
  sinteticaVelocidadKmh: 5,
  sinteticaMediaDistancia: 1.8,
  /** 5 · Césped alto: completación de los pases CORTOS del visitante − k. */
  cespedAltoCortoVisita: 0.065,
  /** 6 · Presión alta: completación de los pases en la zona de salida del presionado − k, en tramos antes de este minuto. */
  presionAltaSalida: 0.12,
  presionHastaMin: 25,
} as const;

/**
 * Brief 019 — perillas de las lesiones (la banda que las acota, LESIONES_MEDIA, vive en limites).
 * Se sortean con prngDerivado (por falta / por posesión): sin la variante no se consume nada.
 */
export const LESIONES = {
  /** Probabilidad de que una falta lesione al que la recibe. */
  pPorFalta: 0.008,
  /** Sobreesfuerzo por posesión: base × (1 + k·cansancio). */
  pSobreesfuerzo: 0.00065,
  kSobreesfuerzo: 3,
  /** Peso por posición de quién se lesiona. */
  peso: { POR: 0.2, DEF: 1, MED: 1.2, DEL: 1.4 },
} as const;

/**
 * Brief 013 — perillas de la capa micro (los umbrales que las acotan viven en limites.ts).
 * Todo se sortea con prngDerivado(semilla, "micro:" + id del ancla): nunca el stream principal.
 */
export const MICRO = {
  /** Acciones por minuto de reloj entre anclas, y extra por ancla de ataque (la elaboración). */
  accionesPorMinuto: 16.2,
  accionesAncla: 2,
  /** Reparto de acciones del poseedor (resto: pase). */
  pConduccion: 0.34,
  pRegate: 0.04,
  pDuelo: 0.05,
  /** Completación de pase: base + k·(ataque − defensa rival)/100, por estilo. */
  paseBase: 0.8,
  /** Ajuste de completación por zona: en la salida se juega seguro, arriba se arriesga. */
  paseZona: { defensa: 0.17, medio: 0.0, ataque: -0.1 },
  /** Factor de intentos de regate/duelo por zona (en la salida casi nadie regatea). */
  riesgoZona: { defensa: 0.1, medio: 1.0, ataque: 1.4 },
  paseKFuerza: 0.4,
  paseEstilo: { posesion: 0.045, contragolpe: -0.04, presion: 0.0 },
  /** Regate exitoso: base + k·(ataque − defensa rival)/100. */
  regateBase: 0.55,
  regateKFuerza: 0.4,
  /** Duelo ganado por el poseedor. */
  dueloBase: 0.5,
  /** Mezcla de pases por zona: probabilidad de corto / medio (resto largo). */
  paseMezcla: {
    defensa: { corto: 0.5, medio: 0.32 },
    medio: { corto: 0.6, medio: 0.32 },
    ataque: { corto: 0.75, medio: 0.25 }, // sin largos: un pase largo no sale de la zona de ataque (invariante)
  },
  /** Avance de zona: probabilidad de subir de zona tras un pase completado según su largo, y tras una conducción. */
  avance: {
    defensa: { corto: 0.35, medio: 0.55, largo: 0.75, conduccion: 0.35 },
    medio: { corto: 0.12, medio: 0.3, largo: 0.5, conduccion: 0.15 },
    ataque: { corto: 0, medio: 0, largo: 0, conduccion: 0 },
  },
  /** Preferencia de canal de cada equipo: peso extra del canal preferido (sorteado por equipo). */
  canalBase: { banda_izquierda: 0.36, centro: 0.28, banda_derecha: 0.36 },
  canalPreferido: 0.04,
  /** Pesos del actor según posición (POR casi no participa salvo al salir). */
  actor: { POR: 0.3, DEF: 2, MED: 3, DEL: 2 },
  regateador: { POR: 0, DEF: 0.5, MED: 2, DEL: 4 },
} as const;
