// Brief 028 — constantes del dataset: ÚNICA fuente. El CLI, el DATASHEET, la página /datos y las
// pruebas las importan; ninguna se repite a mano. (Las bandas estadísticas NO viven aquí: son las
// de src/sim/limites.ts, que el DATASHEET importa y re-mide.)

import type { Variantes } from "../sim/tipos";

/** Versión del esquema de cada línea (campo `esquema`). Se sube si un campo cambia de significado. */
export const ESQUEMA = "cronista/1";

/** `npm run dataset` sin argumentos: semillas 1..N_POR_DEFECTO a SALIDA_POR_DEFECTO (la corrida de referencia). */
export const N_POR_DEFECTO = 100;
export const SALIDA_POR_DEFECTO = "docs/dataset";

/** Archivos que escribe el CLI dentro de --out. */
export const ARCHIVOS = {
  partidos: "partidos.jsonl",
  micro: "micro.jsonl.gz",
  resumen: "resumen.csv",
  datasheet: "DATASHEET.md",
  /** Cifras de cabecera de la corrida (las lee la página /datos: no se escriben a mano en la UI). */
  ficha: "ficha.json",
} as const;

/**
 * Partidos por semilla del dataset: TODAS las variantes del motor que existen en un partido suelto
 * (las sanciones de club necesitan el registro de una temporada: solo en --liga).
 */
export const VARIANTES_DATASET: Required<Pick<Variantes, "lesiones" | "autogoles" | "niveles" | "insolitos">> = {
  lesiones: true,
  autogoles: true,
  niveles: true,
  insolitos: true,
};

/** La muestra que se descarga desde /datos (public/): estas semillas, exactamente como las exporta el CLI. */
export const MUESTRA_SEMILLAS: readonly number[] = Array.from({ length: 10 }, (_, i) => i + 1);
export const MUESTRA_ARCHIVO = `muestra-${MUESTRA_SEMILLAS.length}.jsonl`;

/** Intervalo de confianza del DATASHEET: z de un 95 % bilateral (Wilson para fracciones, normal para medias). */
export const CONFIANZA = { etiqueta: "95%", z: 1.96 } as const;

/** Decimales del CSV para el xG (el JSONL lleva el valor exacto). */
export const CSV_DECIMALES_XG = 2;

/**
 * gzip determinista: el contenedor se escribe a mano (RFC 1952) con MTIME = 0 y OS = 255
 * («desconocido»): dos corridas, en cualquier máquina y a cualquier hora, dan la misma cabecera.
 */
export const GZIP = { nivel: 9, mtime: 0, os: 255 } as const;

/** Tamaño de los experimentos en la prueba RÁPIDA del DATASHEET (la corrida real usa N_AB y N_ESTADISTICA). */
export const N_PRUEBA_RAPIDA = { partidos: 6, experimentos: 8 } as const;
