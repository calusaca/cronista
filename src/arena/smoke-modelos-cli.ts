// Brief 052 v1.1 — `npm run arena:smoke-modelos -- --id <id> [--formato auto|json_schema|json_object|texto] [--seed 52]`
// Smoke REAL de admisión de un deployment de infra/modelos-arena.json. No toca la app pública
// ni su cupo diario. Escribe docs/evidencia/modelos-052/<id>.json (indicadores, sin muestras
// crudas ni secretos) y regenera docs/evidencia/modelos-052/README.md con todos los resultados.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { ARENA, MESA_ARENA, SMOKE_MODELOS_ARENA as S } from "../sim/limites";
import { ejecutarSmokeModelo, fabricaLlmReal, PARTIDOS_SMOKE, serializarEvidencia, type CandidatoSmoke, type EvidenciaSmoke, type FabricaLlm, type FormatoSonda, type NombrePartido, type Precio } from "./smoke-modelos";

const DIR = "docs/evidencia/modelos-052";
interface EntradaModelo { nombre: string; modelo: string; version: string; formato: string; capacidad: number; id: string; nombrePublico: string; llm: "azure-openai" | "foundry-modelos"; formatoJson?: FormatoSonda; esfuerzoRazonamiento?: "low" | "minimal"; publicar: boolean }

function precioDe(deployment: string): Precio | null {
  const ruta = `${DIR}/precios.json`;
  if (!existsSync(ruta)) return null;
  const p = (JSON.parse(readFileSync(ruta, "utf8")) as { modelos: { deployment: string; entrada: number; salida: number; cache: number | null }[] }).modelos.find(m => m.deployment === deployment);
  return p ? { entrada: p.entrada, salida: p.salida, ...(p.cache !== null ? { cache: p.cache } : {}) } : null;
}

const fmt = (n: number | null | undefined, d = 0) => n === null || n === undefined ? "—" : n.toLocaleString("es", { maximumFractionDigits: d, minimumFractionDigits: d });

/** Tokens de salida por llamada del narrador/comentarista (src/arena/narrador.ts). */
const TOKENS_NARRADOR = 1200;

interface RetiradoPorCosto { deployment: string; motivo: string }
interface Precios { modelos: { deployment: string; modelo: string; entrada: number; salida: number }[]; speech?: { usdPorMillonCaracteres: number; caracteresPorDiaMax: number }; presupuesto?: { creditoInicialUsd: number; creditoRestanteUsd: number | null; hipotesisCreditoRestanteUsd?: number; fechaFin: string; partidosModeloPorDia: number; margenUsd: number; retiradosPorCosto?: RetiradoPorCosto[] } }

/** §5: modelos que pasaron el smoke pero se retiran del catálogo por la condición de presupuesto
 * (se retira el más caro hasta cumplirla). Se anotan en precios.json → presupuesto.retiradosPorCosto. */
function retiradosPorCosto(): RetiradoPorCosto[] {
  if (!existsSync(`${DIR}/precios.json`)) return [];
  return (JSON.parse(readFileSync(`${DIR}/precios.json`, "utf8")) as Precios).presupuesto?.retiradosPorCosto ?? [];
}

/** Condición §5 (v1.1): por catálogo, la combinación más cara (el modelo más caro dos veces) más
 * narrador/comentarista en cronista-rapido, más Speech diario, durante los días restantes. */
export function seccionPresupuesto(evidencias: EvidenciaSmoke[], hoy = new Date()): string[] {
  if (!existsSync(`${DIR}/precios.json`)) return ["", "## Condición de presupuesto (§5)", "", "Sin precios.json: no se evalúa."];
  const p = JSON.parse(readFileSync(`${DIR}/precios.json`, "utf8")) as Precios;
  const pr = p.presupuesto, sp = p.speech;
  if (!pr || !sp) return [];
  const precio = (d: string) => p.modelos.find(m => m.deployment === d);
  // Entrada por solicitud: el prompt máximo observado en cualquier partido web (todas las familias
  // usan la misma observación) × factor de reintento. Salida: el tope de 2.048 (o la mayor observada).
  const promptWeb = Math.max(0, ...evidencias.flatMap(e => e.partidos.filter(x => x.nombre === "web").flatMap(x => x.lados.map(lado => lado.promptMax ?? 0))));
  const solicitudes = Math.ceil(S.webS / S.webIntervaloS) * ARENA.intentosOrdenes;
  const lado = (deployment: string): number | null => {
    const ev = evidencias.find(e => e.candidato.deployment === deployment);
    if (ev?.costo.ladoWebUsd !== null && ev?.costo.ladoWebUsd !== undefined) return ev.costo.ladoWebUsd;
    const m = precio(deployment);
    return m && promptWeb ? solicitudes * (promptWeb * S.factorEntradaReintento * m.entrada + ARENA.tokensOrdenes * m.salida) / 1e6 : null;
  };
  const rapido = precio("cronista-rapido");
  const narrador = rapido && promptWeb ? MESA_ARENA.presupuestoLlamadasModelo * (promptWeb * rapido.entrada + TOKENS_NARRADOR * rapido.salida) / 1e6 : 0;
  const speechDia = sp.caracteresPorDiaMax * sp.usdPorMillonCaracteres / 1e6;
  const dias = Math.max(0, Math.ceil((Date.parse(`${pr.fechaFin}T23:59:59Z`) - hoy.getTime()) / 86_400_000));
  const publicados = (JSON.parse(readFileSync("infra/modelos-arena.json", "utf8")) as { nombre: string; publicar: boolean }[]);
  const retirados = (pr.retiradosPorCosto ?? []).map(r => r.deployment);
  const admitidos = evidencias.filter(e => e.admision.admitido && !retirados.includes(e.candidato.deployment)).map(e => e.candidato.deployment);
  // «Previo»: lo publicado que no salió de este smoke (los dos entrenadores del 19 oct).
  const actuales = publicados.filter(m => m.publicar && !admitidos.includes(m.nombre)).map(m => m.nombre);
  const catalogos: [string, string[]][] = [["previo al 052", actuales], ["publicado + admitidos", [...new Set([...actuales, ...admitidos])]], ...evidencias.filter(e => !admitidos.includes(e.candidato.deployment)).map(e => [`publicado + ${e.candidato.deployment} (${e.admision.admitido ? "apto en smoke, retirado por §5" : "no admitido"}, referencia)`, [...new Set([...actuales, ...admitidos, e.candidato.deployment])]] as [string, string[]])];
  const creditos: [string, number][] = [...(pr.creditoRestanteUsd !== null ? [["crédito restante anotado", pr.creditoRestanteUsd] as [string, number]] : []), ...(pr.hipotesisCreditoRestanteUsd !== undefined ? [["hipótesis (pendiente de Carlos)", pr.hipotesisCreditoRestanteUsd] as [string, number]] : []), ["último dato verificado (10 oct)", pr.creditoInicialUsd]];
  const l = ["", "## Condición de presupuesto (§5)", "",
    `Entrada por solicitud: prompt máximo web observado ${fmt(promptWeb)} × ${S.factorEntradaReintento}; ${solicitudes} solicitudes por lado; salida ${ARENA.tokensOrdenes} tokens (o la mayor observada si el razonamiento va fuera de \`completion_tokens\`). Narrador/comentarista: ${MESA_ARENA.presupuestoLlamadasModelo} llamadas en \`cronista-rapido\` × (${fmt(promptWeb)} de entrada como cota + ${TOKENS_NARRADOR} de salida) = ${fmt(narrador, 3)} USD. Speech: ${fmt(sp.caracteresPorDiaMax)} caracteres/día × ${sp.usdPorMillonCaracteres} USD/1M = ${fmt(speechDia, 2)} USD/día. Días hasta el ${pr.fechaFin}: ${dias}. Condición: (costoMaxPartido × ${pr.partidosModeloPorDia} + Speech/día) × días ≤ crédito − ${pr.margenUsd}.`,
    "", "| Catálogo | Modelo más caro | Costo máx. por partido | Gasto proyectado | Crédito | Margen | ¿Cumple? |", "|---|---|---|---|---|---|---|"];
  for (const [nombre, deps] of catalogos) {
    const costos = deps.map(d => ({ d, c: lado(d) }));
    const peor = costos.reduce((a, b) => (b.c ?? Infinity) > (a.c ?? Infinity) ? b : a, costos[0]!);
    const partido = peor.c === null ? null : 2 * peor.c + narrador;
    const gasto = partido === null ? null : (partido * pr.partidosModeloPorDia + speechDia) * dias;
    for (const [etiqueta, credito] of creditos) {
      const margen = gasto === null ? null : credito - pr.margenUsd - gasto;
      l.push(`| ${nombre} (${deps.map(d => `\`${d}\``).join(", ")}) | \`${peor.d}\` ${peor.c === null ? "sin dato" : `${fmt(peor.c, 3)} USD/lado`} | ${partido === null ? "—" : `${fmt(partido, 3)} USD`} | ${gasto === null ? "—" : `${fmt(gasto, 2)} USD`} | ${etiqueta}: ${credito} USD | ${margen === null ? "—" : `${fmt(margen, 2)} USD`} | ${margen === null ? "—" : margen >= 0 ? "sí" : "**no**"} |`);
    }
  }
  return l;
}

/** README a partir de despliegues.json y de cada <id>.json presente. */
export function generarReadme(): string {
  const despliegues = existsSync(`${DIR}/despliegues.json`) ? JSON.parse(readFileSync(`${DIR}/despliegues.json`, "utf8")) as { intentos: { deployment: string; modelo: string; resultado: string; capacidadAceptada?: number; error?: string }[]; noProbados: { id: string; nombre: string; causa: string }[] } : { intentos: [], noProbados: [] };
  const evidencias = readdirSync(DIR).filter(f => /^[a-z0-9-]+\.json$/.test(f) && !f.endsWith("-parcial.json") && !["precios.json", "despliegues.json", "factibilidad-2026-10-22.json"].includes(f))
    .map(f => JSON.parse(readFileSync(`${DIR}/${f}`, "utf8")) as EvidenciaSmoke).filter(e => e.version === "052-v1.1");
  const l: string[] = [
    "# Brief 052 — modelos de otras familias: evidencia de admisión",
    "",
    "Generado por `npm run arena:smoke-modelos` (no editar a mano; se regenera en cada corrida).",
    `Criterio (v1.1 §3): las ${PARTIDOS_SMOKE.length} partidas (espejo, cruzado A, cruzado B invertido y web ${S.webS} s / ${S.webIntervaloS} s) suman las decisiones esperadas del candidato; todas con \`origen: "controlador"\`, \`tiempoMs ≤ ${fmt(S.decisionMaxMs)}\`, ≤ 2 solicitudes, \`respuestasConUso === llamadas\`, precio anotado en [precios.json](precios.json). Solo cuentan las decisiones cuyo \`controlador\` es el candidato; las del rival (\`cronista-rapido\`) se reportan aparte.`,
    "",
    "Condición de publicación (§5): si la proyección de gasto no cabe en el crédito, se retira del catálogo el modelo más caro hasta cumplirla. «Apto en smoke; no publicado (§5)» = pasó los cuatro partidos pero queda con `publicar: false` en `infra/modelos-arena.json` y fuera de `ARENA_MODELOS` (motivo en `precios.json` → `presupuesto.retiradosPorCosto`).",
    "",
    "Sin muestras crudas: se guardan indicadores (`teniaThink`, `reasoningContentChars`, `finish`, tokens) y nunca texto del modelo, claves ni endpoints. Ningún resultado demuestra que un modelo sea mejor entrenador.",
    "",
    "## Resultado por modelo",
    "",
    "| Modelo (deployment) | Estado | Formato | Decisiones válidas | Latencia máx. / mediana | Solicitudes máx. | Tokens entrada / salida | Costo smoke | Causa |",
    "|---|---|---|---|---|---|---|---|---|",
  ];
  const retiradosCosto = retiradosPorCosto();
  const retirado = (e: EvidenciaSmoke) => e.admision.admitido ? retiradosCosto.find(r => r.deployment === e.candidato.deployment) : undefined;
  for (const e of evidencias) {
    const tiempos = e.decisionesCandidato.map(d => d.tiempoMs).sort((a, b) => a - b);
    const mediana = tiempos.length ? tiempos[Math.floor(tiempos.length / 2)]! : null;
    const t = e.resumen.tokensCandidato;
    l.push(`| ${e.candidato.nombrePublico} (\`${e.candidato.deployment}\`, ${e.candidato.modelo}) | ${!e.admision.admitido ? "probado, no admitido" : retirado(e) ? "apto en smoke; **no publicado** (§5)" : "**admitido**"} | ${e.candidato.llm === "azure-openai" ? "json_schema (azure-openai)" : (e.sonda.elegido ?? `ninguno ok (partidos con ${e.candidato.formatoJson})`)} | ${e.resumen.controlador} / ${e.resumen.esperadas} | ${fmt(e.resumen.tiempoMaxMs)} / ${fmt(mediana)} ms | ${e.resumen.llamadasMax ?? "—"} | ${fmt(t.entrada)} / ${fmt(t.salida)}${e.resumen.razonamientoFueraDeCompletion ? " (incl. razonamiento informado fuera de completion)" : ""} | ${e.costo.smokeUsd === null ? "—" : `${fmt(e.costo.smokeUsd, 4)} USD`} | ${[...e.admision.causas, ...(retirado(e) ? [retirado(e)!.motivo] : [])].join("; ") || "—"} |`);
  }
  for (const n of despliegues.noProbados) l.push(`| ${n.nombre} | no probado | — | — | — | — | — | — | ${n.causa} |`);
  l.push("", "## Sonda de formato (esquema real, 2048 tokens)", "", "| Deployment | Formato | Observación | Resultado | HTTP | ms | finish | entrada / salida / razonamiento | marcador think | reasoning_content (caracteres) | Respeta esquema |", "|---|---|---|---|---|---|---|---|---|---|---|");
  for (const e of evidencias) for (const i of e.sonda.intentos) {
    const p = i.peticion;
    l.push(`| \`${e.candidato.deployment}\` | ${i.formato} | ${i.observacion} | ${i.resultado} | ${p?.status ?? i.status ?? "—"} | ${fmt(p?.ms)} | ${p?.finish ?? "—"} | ${fmt(p?.entrada)} / ${fmt(p?.salida)} / ${fmt(p?.razonamiento)} | ${p ? (p.teniaThink ? "sí" : "no") : "—"} | ${fmt(p?.reasoningContentChars)} | ${i.respetaEsquema === null ? "—" : i.respetaEsquema ? "sí" : "no"} |`);
  }
  l.push("", "## Partidos", "", "| Deployment | Partido | Duración / intervalo | Esperadas / observadas | Respaldos del candidato | Latencia máx. candidato | HTTP del candidato | finish del candidato | Prompt máx. | Marcador |", "|---|---|---|---|---|---|---|---|---|---|");
  for (const e of evidencias) for (const p of e.partidos) {
    const ds = e.decisionesCandidato.filter(d => d.partido === p.nombre);
    l.push(`| \`${e.candidato.deployment}\` | ${p.nombre} | ${p.duracionS} s / ${p.intervaloS} s | ${p.esperadas} / ${p.observadas} | ${ds.filter(d => d.origen !== "controlador").length}${ds.some(d => d.origen !== "controlador") ? ` (${[...new Set(ds.filter(d => d.origen !== "controlador").map(d => d.motivo))].join(", ")})` : ""} | ${fmt(Math.max(0, ...ds.map(d => d.tiempoMs)))} ms | ${Object.entries(p.lados.filter(x => x.esCandidato).reduce<Record<string, number>>((a, x) => { for (const [k, v] of Object.entries(x.estados)) a[k] = (a[k] ?? 0) + v; return a; }, {})).map(([k, v]) => `${k}×${v}`).join(", ")} | ${Object.entries(p.lados.filter(x => x.esCandidato).reduce<Record<string, number>>((a, x) => { for (const [k, v] of Object.entries(x.finishes ?? {})) a[k] = (a[k] ?? 0) + v; return a; }, {})).map(([k, v]) => `${k}×${v}`).join(", ") || "—"} | ${fmt(Math.max(0, ...p.lados.filter(x => x.esCandidato).map(x => x.promptMax ?? 0)))} | ${JSON.stringify(p.marcador)} |`);
  }
  l.push("", "## Costo estimado por lado en un partido web (§5)", "", "| Deployment | Precio entrada / salida (USD/1M) | Prompt máx. web | Costo por lado | Nota |", "|---|---|---|---|---|");
  for (const e of evidencias) l.push(`| \`${e.candidato.deployment}\` | ${e.costo.precio ? `${e.costo.precio.entrada} / ${e.costo.precio.salida}` : "sin precio"} | ${fmt(e.resumen.promptMaxWeb)} | ${e.costo.ladoWebUsd === null ? "—" : `${fmt(e.costo.ladoWebUsd, 4)} USD`} | ${e.costo.nota} |`);
  l.push(...seccionPresupuesto(evidencias));
  l.push("", "## Despliegues intentados", "", "| Deployment | Modelo | Resultado | Capacidad aceptada | Error |", "|---|---|---|---|---|");
  for (const d of despliegues.intentos) l.push(`| \`${d.deployment}\` | ${d.modelo} | ${d.resultado} | ${d.capacidadAceptada ?? "—"} | ${d.error ? d.error.replace(/\|/g, "/") : "—"} |`);
  l.push("", "Precios: [precios.json](precios.json) (Azure Retail Prices API). Despliegues: [despliegues.json](despliegues.json). Detalle por decisión: `<id>.json`.", "");
  return l.join("\n");
}

async function main() {
  const { values } = parseArgs({ options: { id: { type: "string" }, formato: { type: "string", default: "auto" }, seed: { type: "string", default: "52" }, partidos: { type: "string" }, "solo-readme": { type: "boolean", default: false } }, strict: true });
  if (values["solo-readme"]) { writeFileSync(`${DIR}/README.md`, generarReadme()); return; }
  if (!values.id) throw new Error("Falta --id");
  if (existsSync(".env")) process.loadEnvFile(".env");
  const entradas = JSON.parse(readFileSync("infra/modelos-arena.json", "utf8")) as EntradaModelo[];
  const entrada = entradas.find(m => m.id === values.id);
  if (!entrada) throw new Error(`id ${values.id} no está en infra/modelos-arena.json`);
  if (!["auto", "json_schema", "json_object", "texto"].includes(values.formato)) throw new Error("--formato auto | json_schema | json_object | texto");
  const clave = process.env.AZURE_OPENAI_API_KEY, aoai = process.env.AZURE_OPENAI_ENDPOINT, base = process.env.FOUNDRY_BASE_URL;
  if (!clave || !aoai || !base) throw new Error("Faltan AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT o FOUNDRY_BASE_URL en .env");
  // Brief 059 § 3.2: la fábrica se extrajo a `fabricaLlmReal` (misma salida) para compartirla con el torneo.
  const fabrica: FabricaLlm = fabricaLlmReal({ apiKey: clave, endpointAzureOpenAI: aoai, baseFoundry: base });
  const candidato: CandidatoSmoke = { id: entrada.id, nombrePublico: entrada.nombrePublico, llm: entrada.llm, deployment: entrada.nombre, modelo: entrada.modelo, version: entrada.version, capacidad: entrada.capacidad,
    ...(entrada.esfuerzoRazonamiento ? { esfuerzoRazonamiento: entrada.esfuerzoRazonamiento } : {}),
    ...(values.formato !== "auto" ? { formatoJson: values.formato as FormatoSonda } : {}) };
  const partidos = values.partidos ? values.partidos.split(",") as NombrePartido[] : undefined;
  if (partidos?.some(p => !PARTIDOS_SMOKE.includes(p))) throw new Error(`--partidos: ${PARTIDOS_SMOKE.join(",")}`);
  const evidencia = await ejecutarSmokeModelo({ candidato, rival: { tipo: "azure-openai", deployment: "cronista-rapido" }, fabrica, fetch, seed: Number(values.seed), precio: precioDe(entrada.nombre), alProgreso: t => console.error(t), ...(partidos ? { partidos } : {}) });
  const hosts = [new URL(aoai).hostname, new URL(base).hostname, new URL(aoai).hostname.split(".")[0]!];
  const texto = serializarEvidencia(evidencia, [clave, ...hosts]);
  writeFileSync(`${DIR}/${entrada.id}${partidos ? "-parcial" : ""}.json`, texto);
  writeFileSync(`${DIR}/README.md`, generarReadme());
  console.log(JSON.stringify({ id: entrada.id, admitido: evidencia.admision.admitido, causas: evidencia.admision.causas, formato: evidencia.sonda.elegido, resumen: evidencia.resumen, costo: evidencia.costo }, null, 2));
}

if (process.argv[1]?.endsWith("smoke-modelos-cli.ts")) main().catch((error: unknown) => {
  // No se vuelca el error crudo: puede traer material del proveedor.
  console.error(`Smoke no completado: ${error instanceof Error ? error.message.slice(0, 200).replace(/[A-Za-z0-9]{32,}/g, "[REDACTED]") : "error"}`);
  process.exitCode = 1;
});
