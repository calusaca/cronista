// Brief 064 § 4.4 / I10: golden de `generarCronica` tomado ANTES de extraer
// `redactarYVerificar`. Semillas 246, 42 y 7; neutral y `equipo:local`; stub y ensayo.
// Uso: `npx tsx src/cadena/__fixtures__/generar-golden-064.ts` (escribe golden-064.json al lado).
// La unitaria `redactar-064.test.ts` recalcula lo mismo y exige `JSON.stringify` idéntico.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { crearLlmEnsayo } from "../../lib/llm-ensayo";
import { crearLlmStub } from "../../lib/llm-stub";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import { generarCronica } from "../cadena";
import type { ModoPersonalizacion } from "../tipos";

export const SEMILLAS_GOLDEN_064 = [246, 42, 7] as const;
export const MODOS_GOLDEN_064: readonly ModoPersonalizacion[] = ["neutral", "equipo:local"];
export const LLMS_GOLDEN_064 = { stub: crearLlmStub, ensayo: crearLlmEnsayo } as const;

export async function calcularGolden064(): Promise<Record<string, string>> {
  const salida: Record<string, string> = {};
  for (const seed of SEMILLAS_GOLDEN_064) {
    for (const modo of MODOS_GOLDEN_064) {
      for (const [nombre, crear] of Object.entries(LLMS_GOLDEN_064)) {
        const r = await generarCronica(simular(configDeSemilla(seed)), { llm: crear(), modoPersonalizacion: modo });
        salida[`${seed}|${modo}|${nombre}`] = JSON.stringify(r);
      }
    }
  }
  return salida;
}

const esPrincipal = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
if (esPrincipal) {
  const destino = join(dirname(fileURLToPath(import.meta.url)), "golden-064.json");
  writeFileSync(destino, `${JSON.stringify(await calcularGolden064(), null, 1)}\n`);
  console.log(`golden escrito en ${destino}`);
}
