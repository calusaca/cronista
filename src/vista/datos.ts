// Brief 028 §3 — datos de la página /datos, SOLO servidor. Ninguna cifra se escribe a mano en la
// UI: las de cabecera salen de docs/dataset/ficha.json (la escribe `npm run dataset` junto con el
// DATASHEET) y el tamaño de la descarga, del archivo de la muestra en public/.

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Ficha } from "../dataset/generar";
import { ARCHIVOS, MUESTRA_ARCHIVO, SALIDA_POR_DEFECTO } from "../dataset/umbrales-dataset";

export const RUTA_DATASHEET = join(SALIDA_POR_DEFECTO, ARCHIVOS.datasheet).replace(/\\/g, "/");

export function leerFicha(raiz = process.cwd()): Ficha {
  return JSON.parse(readFileSync(join(raiz, SALIDA_POR_DEFECTO, ARCHIVOS.ficha), "utf8")) as Ficha;
}

export function leerDatasheet(raiz = process.cwd()): string {
  return readFileSync(join(raiz, RUTA_DATASHEET), "utf8");
}

/** KB (redondeado hacia arriba) de la muestra que se descarga. */
export function kbMuestra(raiz = process.cwd()): number {
  return Math.ceil(statSync(join(raiz, "public", MUESTRA_ARCHIVO)).size / 1024);
}
