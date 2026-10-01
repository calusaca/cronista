// Parser estricto de argumentos del CLI (revisión 1.1, [B6] [B8]). Función pura:
// no lee process.argv ni termina el proceso; cli.ts decide qué hacer con el resultado.

import { SEED_MAX } from "./tipos";

export interface OpcionesCli {
  seed: number;
  todo: boolean;
  json: boolean;
}

export type ResultadoArgs = { ok: true; opciones: OpcionesCli } | { ok: false; error: string };

/** Semilla por defecto cuando no se pasa --seed. */
export const SEED_POR_DEFECTO = 42;

const BANDERAS = new Set(["--seed", "--todo", "--json"]);

/** Solo dígitos decimales: rechaza vacío, signo, hex (0x…), decimales y exponentes. */
const ENTERO_DECIMAL = /^[0-9]+$/;

export function parsearArgs(args: readonly string[]): ResultadoArgs {
  let seed: number | undefined;
  let todo = false;
  let json = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i] as string;
    if (!BANDERAS.has(a)) {
      return { ok: false, error: a.startsWith("-") ? `flag desconocido: ${a}` : `argumento inesperado: "${a}"` };
    }
    if (a === "--todo") {
      if (todo) return { ok: false, error: "--todo repetido" };
      todo = true;
    } else if (a === "--json") {
      if (json) return { ok: false, error: "--json repetido" };
      json = true;
    } else {
      if (seed !== undefined) return { ok: false, error: "--seed repetido" };
      const v = args[i + 1];
      if (v === undefined || v.startsWith("--")) return { ok: false, error: "--seed necesita un valor" };
      i++;
      const s = validarSeedTexto(v);
      if (!s.ok) return s;
      seed = s.seed;
    }
  }
  return { ok: true, opciones: { seed: seed ?? SEED_POR_DEFECTO, todo, json } };
}

/** Valida el valor de --seed (compartido por todos los CLI del proyecto). */
export function validarSeedTexto(v: string): { ok: true; seed: number } | { ok: false; error: string } {
  if (!ENTERO_DECIMAL.test(v)) {
    return { ok: false, error: `--seed debe ser un entero decimal en [0, ${SEED_MAX}] (recibido: "${v}")` };
  }
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n > SEED_MAX) {
    return { ok: false, error: `--seed fuera de rango: ${v} (máximo ${SEED_MAX})` };
  }
  return { ok: true, seed: n };
}
