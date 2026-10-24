// Brief 059 v1.2 — `npm run arena:torneo`: todos contra todos pareado entre modelos publicados, por inferencia
// real, fuera del límite diario público y con su propio tope por estimación en USD (§ 3, § 15).
//
//   npm run arena:torneo -- --id 2026-10-24 --tope-usd 16 --participantes equilibrado,rapido,luna6,sol6,astra6,sol61
//     [--semilla 59] [--intervalo 15|30] [--confirmar] [--reanudar] [--liberar-cerrojo]
//     [--ensayo --participantes a,b,c --segundos 20 --salida <dir>]
//
// Sin --confirmar SOLO imprime la estimación y el calendario y sale con 0: no crea controladores, no lee
// .env ni llama a fetch (ensayo en seco). Un torneo real exige el árbol de git limpio (ignorando .cache/).
// Códigos: 0 terminado (o en seco) · 1 error · 2 anulados seguidos · 3 parada preventiva por el tope · 130 Ctrl+C.
//
// Fixture de ensayo (src/arena/__fixtures__/torneos/, § 7), generado con:
//   rm -rf .cache/arena-torneos/ensayo-059 && npm run arena:torneo -- --ensayo --id ensayo-059 --participantes a,b,c \
//     --segundos 20 --tope-usd 1 --confirmar --salida src/arena/__fixtures__/torneos
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { TORNEO_ARENA as T, TORNEO_SITIO } from "../sim/limites";
import { crearControladorLlm, planProgramado } from "./controladores";
import { fabricaLlmReal, type EvidenciaSmoke } from "./smoke-modelos";
import { calendarioTorneo, ID_TORNEO } from "./torneo";
import {
  ejecutarTorneo, ErrorTorneo, escribirAtomico, estimarTorneo, formatearEstimacion, liberarCerrojo, participantesEnsayo, participantesReales,
  especDe, type CrearControlador, type EntradaCatalogo, type EvidenciaArchivo, type PreciosJson,
} from "./torneo-ejecucion";

const DIR_EVIDENCIA_052 = "docs/evidencia/modelos-052";
const NO_EVIDENCIA = ["precios.json", "despliegues.json", "factibilidad-2026-10-22.json"];

export interface DepsCli {
  argv: string[];
  /** Raíz del repositorio (cwd). */
  raiz: string;
  fetch: typeof fetch;
  /** Variables de entorno (el CLI real carga .env SOLO tras --confirmar en un torneo real). */
  env: () => Record<string, string | undefined>;
  git: () => { porcelana: string; head: string };
  esTTY: boolean; preguntar: (pregunta: string) => Promise<string>;
  out: (s: string) => void; err: (s: string) => void;
  signal?: AbortSignal; ahora?: () => Date; pid?: number; matar?: (pid: number, senal: number) => unknown;
  dormir?: (ms: number, signal?: AbortSignal) => Promise<void>; esperaMs?: number;
  /** Solo pruebas: sustituye la fábrica real (que sigue siendo la de los ids de controlador). */
  crearControlador?: CrearControlador;
  /** Por defecto `<raiz>/.cache/arena-torneos`. */
  dirTrabajoBase?: string;
}

/** Líneas de `git status --porcelain` que no son de `.cache/`. */
export function cambiosSinCache(porcelana: string): string[] {
  return porcelana.split("\n").filter(l => l.trim()).filter(l => { const ruta = l.slice(3).replace(/^"|"$/g, ""); return !ruta.startsWith(".cache/") && ruta !== ".cache"; });
}

export function leerEvidencias(raiz: string): EvidenciaArchivo[] {
  const dir = join(raiz, DIR_EVIDENCIA_052);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith(".json") && !NO_EVIDENCIA.includes(f)).sort()
    .map(f => ({ archivo: `${DIR_EVIDENCIA_052}/${f}`, evidencia: JSON.parse(readFileSync(join(dir, f), "utf8")) as EvidenciaSmoke }))
    .filter(x => x.evidencia.version === "052-v1.1");
}

export async function principal(d: DepsCli): Promise<number> {
  try { return await principalSinCaptura(d); }
  catch (error) {
    d.err(`Torneo no completado: ${error instanceof Error ? error.message.slice(0, 400).replace(/[A-Za-z0-9]{32,}/g, "[REDACTED]") : "error"}`);
    return error instanceof ErrorTorneo ? error.codigo : 1;
  }
}

async function principalSinCaptura(d: DepsCli): Promise<number> {
  const { values: v } = parseArgs({
    args: d.argv, strict: true, allowPositionals: false,
    options: {
      id: { type: "string" }, "tope-usd": { type: "string" }, participantes: { type: "string" }, semilla: { type: "string" }, intervalo: { type: "string" },
      confirmar: { type: "boolean", default: false }, reanudar: { type: "boolean", default: false }, "liberar-cerrojo": { type: "boolean", default: false },
      ensayo: { type: "boolean", default: false }, segundos: { type: "string" }, salida: { type: "string" },
    },
  });
  if (!v.id || !ID_TORNEO.test(v.id)) throw new ErrorTorneo("--id obligatorio, ^[a-z0-9-]{1,30}$");
  // Brief 062 D2 · `sitio-` es el espacio de nombres de los torneos lanzados desde el sitio.
  if (v.id.startsWith(TORNEO_SITIO.prefijoId)) throw new ErrorTorneo(`--id no puede empezar por ${TORNEO_SITIO.prefijoId}: es el espacio de nombres del sitio`);
  const base = d.dirTrabajoBase ?? join(d.raiz, ".cache", "arena-torneos"), dirTrabajo = join(base, v.id);
  if (v["liberar-cerrojo"]) { d.out(liberarCerrojo(dirTrabajo, d.matar)); return 0; }

  if (v["tope-usd"] === undefined || !/^\d+(\.\d+)?$/.test(v["tope-usd"]) || Number(v["tope-usd"]) <= 0) throw new ErrorTorneo(`--tope-usd obligatorio (USD > 0, máximo ${T.topeMaxUsd}; propuesto ${T.topePropuestoUsd})`);
  const topeUsd = Number(v["tope-usd"]);
  // Los importes para mostrar nunca autorizan gasto: el tope en micro-USD se redondea hacia abajo.
  const topeMicroUsd = Math.floor(topeUsd * 1_000_000);
  if (!v.participantes) throw new ErrorTorneo("--participantes obligatorio: la lista es una decisión explícita (sin valor por defecto)");
  const ids = v.participantes.split(",").map(x => x.trim()).filter(Boolean);
  if (new Set(ids).size !== ids.length) throw new ErrorTorneo("--participantes repetidos");
  if (ids.length < T.participantes.min || ids.length > T.participantes.max) throw new ErrorTorneo(`--participantes: entre ${T.participantes.min} y ${T.participantes.max}`);
  const semilla = v.semilla === undefined ? T.semillaDefecto : Number(v.semilla);
  if (!Number.isInteger(semilla) || semilla < 0 || semilla > 0xffffffff) throw new ErrorTorneo("--semilla: entero uint32");
  const intervaloS = v.intervalo === undefined ? T.intervalosS[0] : Number(v.intervalo);
  if (!(T.intervalosS as readonly number[]).includes(intervaloS)) throw new ErrorTorneo(`--intervalo: ${T.intervalosS.join(" o ")}`);
  const ensayo = v.ensayo;
  if (!ensayo && (v.segundos !== undefined || v.salida !== undefined)) throw new ErrorTorneo("--segundos y --salida solo existen con --ensayo");
  let duracionS: number = T.duracionS;
  if (ensayo) {
    duracionS = Number(v.segundos);
    if (!Number.isInteger(duracionS) || duracionS < T.ensayoSegundos.min || duracionS > T.ensayoSegundos.max) throw new ErrorTorneo(`--segundos obligatorio en ensayo: entero entre ${T.ensayoSegundos.min} y ${T.ensayoSegundos.max}`);
    if (!v.salida) throw new ErrorTorneo("--salida obligatorio en ensayo (nunca se escribe en public/)");
    if (/(^|[\\/])public([\\/]|$)/.test(v.salida)) throw new ErrorTorneo("Un ensayo nunca se publica en public/");
  }

  // Participantes (sin red: el id del controlador sale de construir el Llm, que no llama a nada).
  const fabricaIds = fabricaLlmReal({ apiKey: "sin-clave", endpointAzureOpenAI: "https://sin-endpoint.invalid", baseFoundry: "https://sin-endpoint.invalid" });
  const participantes = ensayo ? participantesEnsayo(ids)
    : participantesReales(ids, JSON.parse(readFileSync(join(d.raiz, "infra/modelos-arena.json"), "utf8")) as EntradaCatalogo[],
      JSON.parse(readFileSync(join(d.raiz, DIR_EVIDENCIA_052, "precios.json"), "utf8")) as PreciosJson,
      espec => fabricaIds(espec, (() => { throw new Error("sin red"); }) as unknown as typeof fetch).id);
  calendarioTorneo(participantes.map(p => p.id), semilla);
  const estimacion = estimarTorneo({ participantes, evidencias: leerEvidencias(d.raiz), duracionS, intervaloS, semilla, topeMicroUsd, topeUsd });
  d.out(formatearEstimacion(estimacion));
  if (estimacion.rechazos.length) return 1;
  if (!v.confirmar) { d.out("\nEnsayo en seco: sin --confirmar no se juega ni se llama a ningún modelo."); return 0; }

  const { porcelana, head } = d.git();
  if (!ensayo) {
    const sucios = cambiosSinCache(porcelana);
    if (sucios.length) throw new ErrorTorneo(`Árbol de git con cambios (el commit archivado tiene que ser el código que jugó):\n${sucios.slice(0, 20).join("\n")}`);
  }
  if (!/^[0-9a-f]{7,40}$/.test(head)) throw new ErrorTorneo("No se pudo leer el commit (git rev-parse HEAD)");
  if (d.esTTY) {
    const respuesta = (await d.preguntar(`Escribe el tope por estimación (${v["tope-usd"]}) para confirmar: `)).trim();
    if (respuesta !== v["tope-usd"]) throw new ErrorTorneo("Confirmación distinta del tope: no se juega");
  }

  let crearControlador: CrearControlador;
  let secretos: string[] = [];
  if (d.crearControlador) crearControlador = d.crearControlador;
  else if (ensayo) crearControlador = p => ({ id: p.controlador, tipo: "programado", async decidir(obs) { return planProgramado(obs); } });
  else {
    const env = d.env();
    const clave = env.AZURE_OPENAI_API_KEY, aoai = env.AZURE_OPENAI_ENDPOINT, foundry = env.FOUNDRY_BASE_URL ?? null;
    if (!clave || !aoai) throw new ErrorTorneo("Faltan AZURE_OPENAI_API_KEY o AZURE_OPENAI_ENDPOINT en .env");
    if (participantes.some(p => p.llm === "foundry-modelos") && !foundry) throw new ErrorTorneo("Falta FOUNDRY_BASE_URL en .env");
    secretos = [clave, new URL(aoai).hostname, new URL(aoai).hostname.split(".")[0]!, ...(foundry ? [new URL(foundry).hostname] : [])];
    const fabrica = fabricaLlmReal({ apiKey: clave, endpointAzureOpenAI: aoai, baseFoundry: foundry });
    crearControlador = (p, transporte) => crearControladorLlm(fabrica(especDe(p), transporte));
  }

  mkdirSync(dirTrabajo, { recursive: true });
  escribirAtomico(join(dirTrabajo, "estimacion.json"), JSON.stringify({ ...estimacion, orden: `npm run arena:torneo -- ${d.argv.join(" ")}`, commit: head }, null, 2) + "\n");
  const r = await ejecutarTorneo({
    id: v.id, tipo: ensayo ? "ensayo" : "real", participantes, semilla, duracionS, intervaloS, commit: head,
    topeMicroUsd, tipicoMicroUsd: estimacion.tipicoMicroUsd, promptMax: estimacion.promptMax.tokens,
    dirTrabajo, dirTorneos: ensayo ? resolve(d.raiz, v.salida!) : join(d.raiz, "public", "torneos"), dirEvidencia: ensayo ? null : join(d.raiz, "docs", "evidencia", "torneo-059", v.id),
    orden: `npm run arena:torneo -- ${d.argv.join(" ")}`, reanudar: v.reanudar, crearControlador, fetch: d.fetch, secretos,
    ...(d.esperaMs !== undefined ? { esperaMs: d.esperaMs } : {}), ...(d.dormir ? { dormir: d.dormir } : {}), ...(d.ahora ? { ahora: d.ahora } : {}),
    ...(d.signal ? { signal: d.signal } : {}), ...(d.pid !== undefined ? { pid: d.pid } : {}), log: s => d.err(s),
  });
  d.out(r.mensaje);
  return r.codigo;
}

async function main() {
  const raiz = process.cwd(), cancelacion = new AbortController();
  process.once("SIGINT", () => { process.stderr.write("\nCtrl+C: se cierra el intento en curso con su uso conocido…\n"); cancelacion.abort(); });
  const git = (args: string[]) => execFileSync("git", ["-c", `safe.directory=${raiz}`, ...args], { cwd: raiz, encoding: "utf8" });
  let envCargado = false;
  const codigo = await principal({
    argv: process.argv.slice(2), raiz, fetch, signal: cancelacion.signal,
    env: () => { if (!envCargado && existsSync(join(raiz, ".env"))) { process.loadEnvFile(join(raiz, ".env")); envCargado = true; } return process.env; },
    git: () => ({ porcelana: git(["status", "--porcelain"]), head: git(["rev-parse", "HEAD"]).trim() }),
    esTTY: !!process.stdin.isTTY,
    preguntar: async pregunta => { const rl = createInterface({ input: process.stdin, output: process.stdout }); try { return await rl.question(pregunta); } finally { rl.close(); } },
    out: s => console.log(s), err: s => console.error(s),
  });
  process.exitCode = codigo;
}

if (process.argv[1]?.endsWith("torneo-cli.ts")) void main();
