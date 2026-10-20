import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { reproducirArena } from "./coordinador";
import { datasetEvaluacionArena } from "./inteligencia";
import { evaluarNarracionArena } from "./evaluacion";
import { crearLlmDesdeEnv } from "../lib/llm";
import { ARENA } from "../sim/limites";

async function main() {
  const { values } = parseArgs({ strict: true, options: {
    registro: { type: "string", default: "public/experimentos/arena-llm-v3.json" }, salida: { type: "string", default: ".cache/evaluacion-arena" },
    narrar: { type: "boolean", default: false }, foundry: { type: "boolean", default: false }, ventanas: { type: "string", default: "4" },
    endpoint: { type: "string" }, juez: { type: "string" }, consultar: { type: "string" },
  } });
  if (existsSync(".env")) process.loadEnvFile(".env");
  const endpoint = values.endpoint ?? process.env.AZURE_AI_PROJECT_ENDPOINT;
  if (values.consultar) {
    if (!endpoint) throw new Error("Falta endpoint");
    const anterior = JSON.parse(readFileSync(values.consultar, "utf8")) as { evalId: string; runId: string };
    const { consultarEvaluacionFoundry } = await import("./foundry-eval");
    const resultado = await consultarEvaluacionFoundry(endpoint, anterior.evalId, anterior.runId);
    mkdirSync(values.salida, { recursive: true });
    writeFileSync(join(values.salida, "foundry-resultado.json"), JSON.stringify(resultado, null, 2) + "\n");
    console.log(JSON.stringify({ status: resultado.corrida.status, resultados: resultado.resultados.length, reportUrl: resultado.corrida.report_url })); return;
  }
  const maxVentanas = Number(values.ventanas);
  if (!Number.isInteger(maxVentanas) || maxVentanas < 1 || maxVentanas > 12) throw new Error("Ventanas: 1..12");
  if (statSync(values.registro).size > ARENA.archivoMaxBytes) throw new Error("Registro demasiado grande");
  const registro = reproducirArena(JSON.parse(readFileSync(values.registro, "utf8")));
  mkdirSync(values.salida, { recursive: true });
  if (existsSync(join(values.salida, "dataset.jsonl")) || existsSync(join(values.salida, "informe.json"))) throw new Error("Elige una carpeta de salida nueva");
  if (values.foundry && !endpoint) throw new Error("Falta AZURE_AI_PROJECT_ENDPOINT");
  if (values.narrar && !["azure-openai", "foundry"].includes(process.env.CRONISTA_LLM ?? "")) throw new Error("Narrar requiere un modelo real configurado");
  const resultado = values.narrar ? await evaluarNarracionArena(registro, crearLlmDesdeEnv(process.env, { maxRetries: 0 }), { maxVentanas }) : null;
  const filas = resultado?.filas ?? datasetEvaluacionArena(registro, 15).slice(0, maxVentanas);
  writeFileSync(join(values.salida, "dataset.jsonl"), filas.map(f => JSON.stringify(f)).join("\n") + "\n", { flag: "wx" });
  writeFileSync(join(values.salida, "informe.json"), JSON.stringify(resultado ?? { metodo: "exportacion_plantillas_sin_inferencia", filas: filas.length }, null, 2) + "\n", { flag: "wx" });
  if (values.foundry) {
    if (!endpoint) throw new Error("Falta AZURE_AI_PROJECT_ENDPOINT");
    const modeloJuez = values.juez ?? process.env.AZURE_AI_MODEL_DEPLOYMENT_NAME ?? process.env.AZURE_OPENAI_DEPLOYMENT;
    if (!modeloJuez) throw new Error("Falta deployment del juez");
    const { iniciarEvaluacionFoundry } = await import("./foundry-eval");
    const corrida = await iniciarEvaluacionFoundry(filas, { endpoint, modeloJuez, nombre: `cronista-arena-${Date.now()}` });
    writeFileSync(join(values.salida, "foundry-corrida.json"), JSON.stringify(corrida, null, 2) + "\n", { flag: "wx" });
    console.log(JSON.stringify(corrida));
  }
  console.log(JSON.stringify({ filas: filas.length, salida: values.salida, metodo: resultado?.metodo ?? "plantillas_sin_inferencia", uso: resultado?.uso ?? null }));
}
main().catch((error: unknown) => {
  const status = typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
  console.error(JSON.stringify({ error: "Evaluación no completada. Revisa argumentos, sesión de Azure, endpoint y permisos. Los archivos ya producidos se conservan.", ...(typeof status === "number" ? { status } : {}) }));
  process.exitCode = 1;
});
