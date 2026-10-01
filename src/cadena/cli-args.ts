// Parser estricto del CLI de la crónica: `--seed N [--modo llm|acta] [--json] [--sin-cache]`.
// Función pura (no lee process.argv ni termina el proceso).

import { SEED_POR_DEFECTO, validarSeedTexto } from "../sim/cli-args";

export interface OpcionesCronicaCli {
  seed: number;
  /** "llm" (por defecto): el Cronista por la costura; "acta": directo de las plantillas. */
  modo: "llm" | "acta";
  json: boolean;
  sinCache: boolean;
}

export type ResultadoArgsCronica = { ok: true; opciones: OpcionesCronicaCli } | { ok: false; error: string };

const MODOS = ["llm", "acta"] as const;

export function parsearArgsCronica(args: readonly string[]): ResultadoArgsCronica {
  let seed: number | undefined;
  let modo: "llm" | "acta" | undefined;
  let json = false;
  let sinCache = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i] as string;
    switch (a) {
      case "--seed": {
        if (seed !== undefined) return { ok: false, error: "--seed repetido" };
        const v = args[i + 1];
        if (v === undefined || v.startsWith("--")) return { ok: false, error: "--seed necesita un valor" };
        i++;
        const s = validarSeedTexto(v);
        if (!s.ok) return s;
        seed = s.seed;
        break;
      }
      case "--modo": {
        if (modo !== undefined) return { ok: false, error: "--modo repetido" };
        const v = args[i + 1];
        if (v === undefined || v.startsWith("--")) return { ok: false, error: "--modo necesita un valor (llm o acta)" };
        i++;
        if (!(MODOS as readonly string[]).includes(v)) return { ok: false, error: `--modo debe ser llm o acta (recibido: "${v}")` };
        modo = v as "llm" | "acta";
        break;
      }
      case "--json":
        if (json) return { ok: false, error: "--json repetido" };
        json = true;
        break;
      case "--sin-cache":
        if (sinCache) return { ok: false, error: "--sin-cache repetido" };
        sinCache = true;
        break;
      default:
        return { ok: false, error: a.startsWith("-") ? `flag desconocido: ${a}` : `argumento inesperado: "${a}"` };
    }
  }
  return { ok: true, opciones: { seed: seed ?? SEED_POR_DEFECTO, modo: modo ?? "llm", json, sinCache } };
}
