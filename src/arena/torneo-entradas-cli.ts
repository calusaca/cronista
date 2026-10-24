// Brief 062 § 6.2 — `npm run arena:torneo-entradas`: genera `src/arena/torneo-sitio-entradas.json`, las entradas de la
// estimación del torneo del sitio. La imagen del contenedor no lleva `docs/`, así que el servidor no puede leer la
// evidencia 052: este JSON fija, con la MISMA lógica que `estimarTorneo` (`entradasEstimacion`):
//   - los 6 participantes del torneo archivado `2026-10-24` («los mismos modelos»), con el precio de lista vigente de
//     `precios.json` (`estimadoDe: null` cuando el modelo ya tiene precio propio);
//   - el prompt máximo de los partidos de 60 s y su origen; brief 063 (v1.1 § 17.4): `tokens` es el medido por
//     TORNEO_SITIO.factorObservacion063, al alza, y el JSON declara el medido y el factor;
//   - por participante, las medias de entrada y salida y la mediana de latencia.
// `torneo-entradas.test.ts` lo regenera y exige igualdad byte a byte: si cambian los precios o la evidencia, CI se
// pone en rojo hasta que se vuelva a generar. No llama a red ni lee `.env`.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TORNEO_SITIO } from "../sim/limites";
import { fabricaLlmReal } from "./smoke-modelos";
import { esquemaTorneo } from "./torneo";
import { leerEvidencias } from "./torneo-cli";
import { entradasEstimacion, participantesReales, type EntradaCatalogo, type PreciosJson } from "./torneo-ejecucion";
import type { EntradasSitio } from "./torneo-formatos";

/** Torneo archivado del que salen los participantes del sitio. */
export const TORNEO_ORIGEN_SITIO = "2026-10-24";
export const RUTA_ENTRADAS_SITIO = "src/arena/torneo-sitio-entradas.json";

export function generarEntradasSitio(raiz: string): string {
  const archivado = esquemaTorneo.parse(JSON.parse(readFileSync(join(raiz, "public", "torneos", TORNEO_ORIGEN_SITIO, "torneo.json"), "utf8")));
  const catalogo = JSON.parse(readFileSync(join(raiz, "infra", "modelos-arena.json"), "utf8")) as EntradaCatalogo[];
  const precios = JSON.parse(readFileSync(join(raiz, "docs", "evidencia", "modelos-052", "precios.json"), "utf8")) as PreciosJson;
  // Solo los ids de controlador: construir el Llm no llama a nada.
  const fabricaIds = fabricaLlmReal({ apiKey: "sin-clave", endpointAzureOpenAI: "https://sin-endpoint.invalid", baseFoundry: "https://sin-endpoint.invalid" });
  const sinRed = (() => { throw new Error("sin red"); }) as unknown as typeof fetch;
  const participantes = participantesReales(archivado.participantes.map(p => p.id), catalogo, precios, espec => fabricaIds(espec, sinRed).id);
  for (const p of participantes) {
    const a = archivado.participantes.find(x => x.id === p.id)!;
    if (a.controlador !== p.controlador || a.deployment !== p.deployment) throw new Error(`${p.id}: el catálogo cambió su deployment o su controlador respecto del torneo ${TORNEO_ORIGEN_SITIO}`);
  }
  const { promptMax: medido, medidas } = entradasEstimacion(participantes, leerEvidencias(raiz));
  // Brief 063 v1.1 § 17.4: las peticiones de reinicios-v7 son más grandes que las medidas el 22 oct.
  const promptMax = { ...medido, tokens: Math.ceil(medido.tokens * TORNEO_SITIO.factorObservacion063), medido: medido.tokens, factorObservacion063: TORNEO_SITIO.factorObservacion063 };
  const entradas: EntradasSitio = { version: TORNEO_SITIO.version, torneoOrigen: TORNEO_ORIGEN_SITIO, participantes, promptMax, medidas };
  return JSON.stringify(entradas, null, 2) + "\n";
}

if (process.argv[1]?.endsWith("torneo-entradas-cli.ts")) {
  const raiz = process.cwd();
  writeFileSync(join(raiz, RUTA_ENTRADAS_SITIO), generarEntradasSitio(raiz));
  console.log(`Escrito ${RUTA_ENTRADAS_SITIO}`);
}
