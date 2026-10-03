// Brief 022 — la eval: un agente solo vs la cadena, sobre las mismas semillas.
//
// - BASELINE («single agent»): el Cronista escribe y su PRIMER intento se toma como lo publicado —
//   sin reintentos, sin omisión, sin acta. El juez es el Verificador existente en modo evaluación
//   (`verificar` sobre ese texto): cuenta las frases con algún hallazgo V1–V8.
// - PIPELINE: la cadena completa de siempre (`generarCronica`, sin caché: se mide la corrida);
//   se cuentan las frases con hallazgos de lo PUBLICADO. Por construcción deben ser 0; si no, es un
//   bug del producto y la eval lo delata.
// Cero lógica nueva de verificación: todo lo juzga src/cadena.

import { analizar } from "../analista/analista";
import { generarCronica, guardaDeEntrada } from "../cadena/cadena";
import { mensajeInicial, SYSTEM_PROMPT } from "../cadena/prompt";
import { verificar, verificarDraft } from "../cadena/verificador";
import type { Motivo } from "../cadena/tipos";
import type { Llm, Mensaje } from "../lib/llm";
import { simular } from "../sim/motor";
import { configDeSemilla } from "../sim/plantillas";
import { CARACTERES_POR_TOKEN, EVAL_SEMILLAS, PRECIO_USD_POR_MTOK } from "./umbrales-eval";

export interface FilaEval {
  seed: number;
  marcador: string;
  /** Baseline: frases del primer intento y cuántas tienen hallazgos (si no parsea: 1 de 1). */
  baselineFrases: number;
  baselineConHallazgos: number;
  /** Reglas que dispararon en el baseline (para el informe). */
  baselineReglas: string[];
  /** Pipeline: frases publicadas y cuántas tienen hallazgos (debe ser 0). */
  pipelineFrases: number;
  pipelineConHallazgos: number;
  pipelineModo: "llm" | "acta";
  pipelineIntentos: number;
  /** Caracteres enviados y recibidos (baseline + pipeline), para el costo estimado. */
  caracteres: number;
}

export interface ResultadoEval {
  llm: string;
  filas: FilaEval[];
  baselineFrases: number;
  baselineConHallazgos: number;
  pipelineFrases: number;
  pipelineConHallazgos: number;
  /** % de frases del baseline con hallazgos, a un decimal. */
  porcentaje: number;
  tokensEstimados: number;
  costoUsd: number | undefined;
}

/** Frases (índices de oración) con al menos un hallazgo. */
const frasesConHallazgo = (ms: Motivo[]) => new Set(ms.filter((m) => m.oracion >= 0).map((m) => m.oracion)).size;

/** Cuenta los caracteres que cruzan la costura (lo que se pagaría en tokens). */
function contador(llm: Llm): { llm: Llm; total: () => number } {
  let n = 0;
  return {
    llm: {
      id: llm.id,
      async completar(system: string, mensajes: Mensaje[]) {
        n += system.length + mensajes.reduce((s, m) => s + m.contenido.length, 0);
        const r = await llm.completar(system, mensajes);
        n += r.length;
        return r;
      },
    },
    total: () => n,
  };
}

export async function correrEval(llmBase: Llm, semillas: readonly number[] = EVAL_SEMILLAS): Promise<ResultadoEval> {
  const filas: FilaEval[] = [];
  for (const seed of semillas) {
    const partido = simular(configDeSemilla(seed));
    guardaDeEntrada(partido);
    const hechos = analizar(partido);
    const goles = partido.eventos.filter((e) => e.tipo === "gol");
    const marcador = `${goles.filter((e) => e.equipo === "local").length}–${goles.filter((e) => e.equipo === "visita").length}`;
    const { llm, total } = contador(llmBase);

    // Baseline: UN intento, lo que salga es lo publicado.
    const salida = await llm.completar(SYSTEM_PROMPT, [{ rol: "user", contenido: mensajeInicial(hechos) }]);
    const juicio = verificar(salida, hechos, partido);
    const parseo = juicio.draft !== null;
    const baselineFrases = parseo ? (juicio.draft?.oraciones.length ?? 0) : 1;
    const baselineConHallazgos = parseo ? frasesConHallazgo(juicio.motivos) : 1;

    // Pipeline: la cadena entera, y se juzga lo PUBLICADO.
    const { cronica } = await generarCronica(partido, { llm });
    const publicado = verificarDraft(cronica, hechos, partido);
    filas.push({
      seed,
      marcador,
      baselineFrases,
      baselineConHallazgos,
      baselineReglas: [...new Set(juicio.motivos.map((m) => m.regla))].sort(),
      pipelineFrases: cronica.oraciones.length,
      pipelineConHallazgos: frasesConHallazgo(publicado),
      pipelineModo: cronica.modo,
      pipelineIntentos: cronica.intentos,
      caracteres: total(),
    });
  }
  const suma = (k: keyof FilaEval) => filas.reduce((s, f) => s + (f[k] as number), 0);
  const bf = suma("baselineFrases");
  const bh = suma("baselineConHallazgos");
  const tokens = Math.round(suma("caracteres") / CARACTERES_POR_TOKEN);
  const precio = PRECIO_USD_POR_MTOK[llmBase.id.split(":")[0] as string];
  return {
    llm: llmBase.id,
    filas,
    baselineFrases: bf,
    baselineConHallazgos: bh,
    pipelineFrases: suma("pipelineFrases"),
    pipelineConHallazgos: suma("pipelineConHallazgos"),
    porcentaje: bf === 0 ? 0 : Math.round((bh * 1000) / bf) / 10,
    tokensEstimados: tokens,
    costoUsd: precio === undefined ? undefined : (tokens / 1_000_000) * precio,
  };
}

/** El titular de la eval (el del brief, en inglés: va al README el lunes, con el LLM real). */
export const titular = (r: ResultadoEval) =>
  `${r.porcentaje.toFixed(1)}% of unverified sentences contained unsupported claims; the pipeline published ${r.pipelineConHallazgos}.`;

/** El informe en Markdown (determinista: sin fechas ni tiempos). */
export function informe(r: ResultadoEval): string {
  const ensayo = r.llm === "ensayo" || r.llm === "stub";
  const l: string[] = [];
  l.push(`# CRONISTA eval — single agent vs pipeline`);
  l.push("");
  if (ensayo) {
    l.push(`> **${r.llm.toUpperCase()} RUN — NOT the headline figure.** The \`${r.llm}\` backend is a test fixture${r.llm === "ensayo" ? " that plants one deliberate error per chronicle" : ""}; this sample only proves the harness is deterministic and the pipeline publishes nothing unverified. The README figure comes from the real LLM.`);
    l.push("");
  }
  l.push(`Backend: \`${r.llm}\` · ${r.filas.length} fixed seeds (src/eval/umbrales-eval.ts) · judge: the existing Verifier (rules V1–V8), unchanged.`);
  l.push("");
  l.push(`**${titular(r)}**`);
  l.push("");
  l.push("| Seed | Score | Single agent: sentences | with findings | % | rules | Pipeline: sentences | with findings | mode · attempts |");
  l.push("|---:|:---:|---:|---:|---:|:---|---:|---:|:---|");
  for (const f of r.filas) {
    const pct = f.baselineFrases === 0 ? 0 : Math.round((f.baselineConHallazgos * 1000) / f.baselineFrases) / 10;
    l.push(
      `| ${f.seed} | ${f.marcador} | ${f.baselineFrases} | ${f.baselineConHallazgos} | ${pct.toFixed(1)} | ${f.baselineReglas.join(", ") || "—"} | ${f.pipelineFrases} | ${f.pipelineConHallazgos} | ${f.pipelineModo} · ${f.pipelineIntentos} |`,
    );
  }
  l.push(`| **Total** | | **${r.baselineFrases}** | **${r.baselineConHallazgos}** | **${r.porcentaje.toFixed(1)}** | | **${r.pipelineFrases}** | **${r.pipelineConHallazgos}** | |`);
  l.push("");
  l.push(
    `Estimated tokens: ${r.tokensEstimados.toLocaleString("en-US")} (≈ ${CARACTERES_POR_TOKEN} characters per token, both arms) · estimated cost: ${r.costoUsd === undefined ? "price not set for this backend yet" : `$${r.costoUsd.toFixed(2)}`}.`,
  );
  return `${l.join("\n")}\n`;
}
