// Brief 018 — cómo las condiciones del partido tocan la simulación. Funciones puras que leen
// los modificadores de parametros.ts (CONDICIONES). Sin condiciones (o con condiciones
// neutras) todas devuelven el elemento neutro EXACTO (factor 1, ajuste 0): el motor y la capa
// micro multiplican/suman con ellos sin consumir ni un sorteo, así que el stream no cambia.
//
// Los seis efectos (ni uno más):
//   1 calor ⇒ cansancio en el 2.º tiempo (menos acciones micro y menos llegadas)
//   2 calor ⇒ más faltas en el 2.º tiempo
//   3 lluvia ⇒ pases más imprecisos y atajadas sueltas (más córners tras atajada)
//   4 sintética ⇒ tiro más rápido y más tiros de media distancia
//   5 césped alto ⇒ pases cortos del VISITANTE más imprecisos
//   6 presión alta ⇒ salida nerviosa del presionado en los primeros minutos

import { CESPEDES, CLIMAS_PARTIDO, NIVELES_PRESION, SUPERFICIES, TEMPERATURA_C } from "./limites";
import { CONDICIONES, INSOLITOS } from "./parametros";
import type { Condiciones, Lado, Zona } from "./tipos";

/** Intensidad del calor en [0, 1] (0 si no hay calor registrado). */
export function intensidadCalor(c: Condiciones | undefined): number {
  if (!c || c.clima !== "calor" || c.temperaturaC === undefined) return 0;
  const i = (c.temperaturaC - CONDICIONES.calorDesdeC) / (CONDICIONES.calorHastaC - CONDICIONES.calorDesdeC);
  return Math.min(1, Math.max(0, i));
}

/** 1 · Factor de las llegadas al último tercio en el periodo (solo el 2.º tiempo con calor). */
export function factorAtaque(c: Condiciones | undefined, periodo: 1 | 2): number {
  const i = intensidadCalor(c);
  return periodo === 2 && i > 0 ? 1 - CONDICIONES.calorAtaque2T * i : 1;
}

/** 1 · Factor de las acciones micro de un tramo del periodo. */
export function factorRitmo(c: Condiciones | undefined, periodo: 1 | 2): number {
  const i = intensidadCalor(c);
  return periodo === 2 && i > 0 ? 1 - CONDICIONES.calorRitmo2T * i : 1;
}

/** 2 · Factor de las faltas en el periodo. */
export function factorFaltas(c: Condiciones | undefined, periodo: 1 | 2): number {
  const i = intensidadCalor(c);
  return periodo === 2 && i > 0 ? 1 + CONDICIONES.calorFaltas2T * i : 1;
}

/** 3 · Factor de la probabilidad de córner tras una atajada. */
export function factorCornerTrasAtajada(c: Condiciones | undefined): number {
  return c?.clima === "lluvia" ? CONDICIONES.lluviaCornerTrasAtajada : 1;
}

/** 4 · km/h que se suman a la velocidad del tiro (antes de recortar a las bandas del 015). */
export function extraVelocidad(c: Condiciones | undefined): number {
  return c?.superficie === "sintetica" ? CONDICIONES.sinteticaVelocidadKmh : 0;
}

/** 4 · Factor del peso de media distancia en la tabla de tiros lejanos. */
export function factorMediaDistancia(c: Condiciones | undefined): number {
  return c?.superficie === "sintetica" ? CONDICIONES.sinteticaMediaDistancia : 1;
}

/**
 * 3, 5 y 6 · Cuánto BAJA la probabilidad de completar un pase (≥ 0; 0 = sin efecto).
 * `minutoAncla`: el minuto del evento macro que cierra el tramo (el tramo es «temprano» si
 * termina antes de CONDICIONES.presionHastaMin: así el vivo no ve el futuro).
 */
export function castigoPase(
  c: Condiciones | undefined,
  lado: Lado,
  zona: Zona,
  clase: "corto" | "medio" | "largo",
  minutoAncla: number,
): number {
  if (!c) return 0;
  let k = 0;
  if (c.clima === "lluvia") k += CONDICIONES.lluviaPase;
  // Brief 025 · 5: con niebla no se ve lejos — solo los pases LARGOS pierden precisión.
  if (c.clima === "niebla" && clase === "largo") k += INSOLITOS.nieblaPaseLargo;
  if (lado === "visita" && c.superficie === "natural" && c.cesped === "alto" && clase === "corto") k += CONDICIONES.cespedAltoCortoVisita;
  if (c.presion[lado] === "alta" && zona === "defensa" && minutoAncla < CONDICIONES.presionHastaMin) k += CONDICIONES.presionAltaSalida;
  return k;
}

/** El nivel siguiente de presión (v1 del brief: el visitante, uno por encima del local). */
export function nivelSiguiente(n: (typeof NIVELES_PRESION)[number]): (typeof NIVELES_PRESION)[number] {
  return n === "baja" ? "media" : "alta";
}

/** Violaciones del contrato de unas condiciones (vacía = válidas). */
/** `aPuertaCerrada` (brief 027): sin público, la presión es baja para AMBOS (extensión consciente del 018). */
export function erroresCondiciones(c: Condiciones, aPuertaCerrada = false): string[] {
  const err: string[] = [];
  if (!CLIMAS_PARTIDO.includes(c.clima)) err.push(`clima fuera de vocabulario (${String(c.clima)})`);
  if (c.clima === "calor" || c.clima === "frio") {
    const b = TEMPERATURA_C[c.clima];
    if (!Number.isInteger(c.temperaturaC) || (c.temperaturaC as number) < b.min || (c.temperaturaC as number) > b.max)
      err.push(`${c.clima} con temperatura ${String(c.temperaturaC)} (entero en [${b.min}, ${b.max}])`);
  } else if (c.temperaturaC !== undefined) err.push(`${c.clima} con temperatura (solo calor y frío la registran)`);
  if (!SUPERFICIES.includes(c.superficie)) err.push(`superficie fuera de vocabulario (${String(c.superficie)})`);
  if (c.superficie === "natural" && (c.cesped === undefined || !CESPEDES.includes(c.cesped))) err.push(`césped natural sin altura válida (${String(c.cesped)})`);
  if (c.superficie === "sintetica" && c.cesped !== undefined) err.push("césped con altura en una cancha sintética");
  if (!c.presion || !NIVELES_PRESION.includes(c.presion.local) || !NIVELES_PRESION.includes(c.presion.visita)) err.push("presión fuera de vocabulario");
  else if (aPuertaCerrada) {
    if (c.presion.local !== "baja" || c.presion.visita !== "baja") err.push(`presión ${c.presion.local}/${c.presion.visita} a puerta cerrada (sin público: baja para ambos)`);
  } else if (c.presion.local === "alta" || c.presion.visita !== nivelSiguiente(c.presion.local))
    err.push(`presión ${c.presion.local}/${c.presion.visita}: el visitante va siempre un nivel por encima del local`);
  return err;
}
