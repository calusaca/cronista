// Brief 028 — parser estricto de `npm run dataset`. Función pura: no lee process.argv.
//   --n <entero ≥ 1>        semillas 1..n (por defecto N_POR_DEFECTO)
//   --out <dir>             carpeta de salida (por defecto SALIDA_POR_DEFECTO)
//   --micro                 escribe además micro.jsonl.gz
//   --liga [id]             una temporada completa de esa liga (sin id: la de /liga)
//   --temporada <entero>    con --liga (por defecto TEMPORADA_ACTUAL)
//   --muestra               escribe solo public/<MUESTRA_ARCHIVO> (la descarga de /datos)

import { LIGA_DESTACADA, TEMPORADA_ACTUAL } from "../analista/umbrales";
import type { OpcionesDataset } from "./generar";
import { N_POR_DEFECTO, SALIDA_POR_DEFECTO } from "./umbrales-dataset";

export type ArgsDataset = { ok: true; tipo: "dataset"; opciones: OpcionesDataset; out: string } | { ok: true; tipo: "muestra" } | { ok: false; error: string };

const ENTERO = /^[0-9]+$/;

export function parsearArgsDataset(args: readonly string[]): ArgsDataset {
  let n: number | undefined;
  let out: string | undefined;
  let micro = false;
  let liga: string | undefined;
  let temporada: number | undefined;
  let muestra = false;
  const vistos = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const a = args[i] as string;
    if (!["--n", "--out", "--micro", "--liga", "--temporada", "--muestra"].includes(a)) return { ok: false, error: a.startsWith("-") ? `flag desconocido: ${a}` : `argumento inesperado: "${a}"` };
    if (vistos.has(a)) return { ok: false, error: `${a} repetido` };
    vistos.add(a);
    const sig = args[i + 1];
    const tieneValor = sig !== undefined && !sig.startsWith("--");
    if (a === "--micro") micro = true;
    else if (a === "--muestra") muestra = true;
    else if (a === "--liga") {
      liga = tieneValor ? sig : LIGA_DESTACADA;
      if (tieneValor) i++;
    } else {
      if (!tieneValor) return { ok: false, error: `${a} necesita un valor` };
      i++;
      if (a === "--out") out = sig;
      else {
        if (!ENTERO.test(sig) || !Number.isSafeInteger(Number(sig))) return { ok: false, error: `${a} debe ser un entero decimal (recibido: "${sig}")` };
        if (a === "--n") {
          n = Number(sig);
          if (n < 1) return { ok: false, error: "--n debe ser ≥ 1" };
        } else temporada = Number(sig);
      }
    }
  }
  if (muestra) {
    if (vistos.size > 1) return { ok: false, error: "--muestra no se combina con otros flags" };
    return { ok: true, tipo: "muestra" };
  }
  if (liga !== undefined && n !== undefined) return { ok: false, error: "--liga exporta una temporada completa: no se combina con --n" };
  if (temporada !== undefined && liga === undefined) return { ok: false, error: "--temporada necesita --liga" };
  const modo: OpcionesDataset["modo"] = liga !== undefined ? { tipo: "liga", liga, temporada: temporada ?? TEMPORADA_ACTUAL } : { tipo: "semillas", n: n ?? N_POR_DEFECTO };
  return { ok: true, tipo: "dataset", opciones: { modo, micro }, out: out ?? SALIDA_POR_DEFECTO };
}
