// Brief 059 v1.2 — Orquestador del torneo entre modelos, con dependencias inyectables (fetch, controladores,
// reloj, pausas, señal de cancelación, directorios). Lo cablea `torneo-cli.ts`; las pruebas lo ejecutan con un
// `fetch` falso. Piezas (§ 15 y § 16 prevalecen sobre el cuerpo):
//   - transporteTorneo: reintentos de 408/429/5xx y red dentro del plazo, naturaleza de cada intento y
//     esperas que escuchan `init.signal` (§ 3.5, § 15.3, § 16.2);
//   - jugarEncuentro: un partido, su causa terminal por respaldo, anulación por infraestructura y archivo .gz
//     validado con `validarEncuentro` (§ 3.4, § 15.5, § 16.1);
//   - ejecutarTorneo: cerrojo, config.json, libro de gasto de solo anexión, parada preventiva por reserva,
//     repeticiones, reanudación por archivos y salida final (§ 15.1, § 15.4, § 3.8);
//   - estimarTorneo: típico, máximo por intento y reservas en micro-USD (§ 3.6, § 15.1).
import { appendFileSync, closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync, writeSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { gunzipSync, gzipSync } from "node:zlib";
import { ARENA, SMOKE_MODELOS_ARENA as S, TORNEO_ARENA as T, TORNEO_SITIO } from "../sim/limites";
import type { Lado } from "../sim/tipos";
import { contenidoCanonico, ejecutarArena } from "./coordinador";
import { razonamientoFuera, transporteInstrumentado, type EspecLlm, type EvidenciaSmoke, type FormatoSonda, type Peticion } from "./smoke-modelos";
import {
  archivoEncuentro, calendarioTorneo, causaTerminal, cortoDe, costoLadoMicro, esquemaCerrojo,
  esquemaConfigTorneo, esquemaEjecutor, esquemaIndice, esquemaMovimiento, gastoConocido, LADOS_TORNEO, microMaxIntento, microTipicoDecision, rondasPartido,
  reservaPartido, resumenTorneo, VERSION_TORNEO,
  type DeclaradoLado, type EjecutorEncuentro, type EncuentroPlan, type EncuentroTorneo, type EsperaHttp, type IntentoHttp, type MarcoTorneo, type MovimientoGasto,
  type ParticipanteTorneo, type TorneoArchivado, type TorneoCualquiera,
} from "./torneo";
import { configDelPlan, constaEnArchivo, descomprimirRegistro, encuentroDesdeEjecutor, sha256, validarEncuentro, validarTorneo } from "./torneo-validacion";
import type { ControladorEquipo, PublicacionArena, RegistroArena } from "./tipos";

/** Error con el código de salida del CLI (1 por defecto). */
export class ErrorTorneo extends Error {
  constructor(mensaje: string, readonly codigo = 1) { super(mensaje); }
}
const usd = (micro: number) => `${(micro / 1_000_000).toFixed(4)} USD`;
const abortError = () => new DOMException("Cancelado", "AbortError");
export const esAbort = (error: unknown) => error instanceof Error && error.name === "AbortError";

// ---------------------------------------------------------------------------------------------------
// Secretos (§ 15.9): redactar y detectar van separados. Un REGISTRO con un secreto aborta (redactarlo rompería
// su validación); torneo.json y ejecutor.json se redactan, se detecta y se vuelven a validar.
// ---------------------------------------------------------------------------------------------------
const secretosUtiles = (secretos: readonly string[]) => secretos.filter(s => typeof s === "string" && s.length >= 4);
export function redactar(texto: string, secretos: readonly string[]): string {
  let r = texto;
  for (const s of secretosUtiles(secretos)) r = r.split(s).join("[REDACTED]");
  return r;
}
/** Cuántos secretos aparecen en el texto (nunca devuelve el secreto). */
export function detectarSecretos(texto: string, secretos: readonly string[]): number {
  return secretosUtiles(secretos).filter(s => texto.includes(s)).length;
}

// ---------------------------------------------------------------------------------------------------
// Transporte del torneo (§ 3.5, § 15.3, § 16.2).
// ---------------------------------------------------------------------------------------------------
export interface IntentoTransporte extends IntentoHttp { entrada: number | null; salida: number | null; cache: number | null; modelo: string | null }
export interface RegistroTransporte {
  /** Ronda en curso (1…): la fija el orquestador con `alProgreso`; cada intento captura la suya al empezar. */
  ronda: number;
  intentos: IntentoTransporte[]; esperas: EsperaHttp[];
  /** Peticiones en vuelo: se esperan antes de resumir el partido. */
  enCurso: Set<Promise<unknown>>;
  t0: number; ahora: () => number;
}
export function nuevoRegistroTransporte(ahora: () => number = Date.now): RegistroTransporte {
  return { ronda: 1, intentos: [], esperas: [], enCurso: new Set(), t0: ahora(), ahora };
}
const reintentables = T.http.estadosReintentables as readonly number[];
function naturalezaHttp(status: number): "ok" | "reintentable" | "http_otro" {
  if (status >= 200 && status < 300) return "ok";
  if (reintentables.includes(status) || status >= 500) return "reintentable";
  return "http_otro";
}
/** `retry-after-ms`, si no `retry-after` (segundos), y si no `http.esperasMs[k]`; nunca más de `esperaMaxMs`. */
export function esperaReintento(r: Response | null, k: number): number {
  const ms = r?.headers.get("retry-after-ms")?.trim(), s = r?.headers.get("retry-after")?.trim();
  const tabla = T.http.esperasMs[Math.min(k, T.http.esperasMs.length - 1)]!;
  const espera = ms && /^\d+(\.\d+)?$/.test(ms) ? Number(ms) : s && /^\d+(\.\d+)?$/.test(s) ? Number(s) * 1000 : tabla;
  return Math.min(Math.round(espera), T.http.esperaMaxMs);
}
/** Espera que escucha la señal: si se aborta, rechaza con AbortError sin dejar temporizadores. */
export function esperarAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolver, rechazar) => {
    if (signal?.aborted) { rechazar(abortError()); return; }
    const alAbortar = () => { clearTimeout(temporizador); rechazar(abortError()); };
    const temporizador = setTimeout(() => { signal?.removeEventListener("abort", alAbortar); resolver(); }, ms);
    signal?.addEventListener("abort", alAbortar, { once: true });
  });
}
async function esperarReintento(registro: RegistroTransporte, ronda: number, ms: number, signal?: AbortSignal): Promise<void> {
  const espera: EsperaHttp = { ronda, desdeMs: Math.max(0, Math.round(registro.ahora() - registro.t0)), ms, interrumpida: false };
  registro.esperas.push(espera);
  try { await esperarAbortable(ms, signal); }
  catch (error) { espera.interrumpida = true; throw error; }
}

/** Envuelve a `transporteInstrumentado`: cada intento real queda registrado con su naturaleza; las esperas entre
 * reintentos van aparte y nunca crean intentos ficticios. Nunca pasa del `AbortSignal` de la petición. */
export function transporteTorneo(base: typeof fetch, registro: RegistroTransporte): typeof fetch {
  return ((url: string | URL | Request, init?: RequestInit) => {
    const ronda = registro.ronda, signal = init?.signal ?? undefined;
    const tarea = (async (): Promise<Response> => {
      for (let k = 0; ; k++) {
        if (signal?.aborted) throw abortError();
        const medidas: Peticion[] = [];
        let r: Response;
        try { r = await transporteInstrumentado(base, medidas)(url, init); }
        catch (error) {
          const abortado = !!signal?.aborted;
          registro.intentos.push({ naturaleza: abortado ? "abortado" : "red", status: null, conUso: false, ronda, entrada: null, salida: null, cache: null, modelo: null });
          if (abortado || k >= T.http.reintentos) throw error;
          await esperarReintento(registro, ronda, esperaReintento(null, k), signal);
          continue;
        }
        const m = medidas[0]!;
        let naturaleza: IntentoHttp["naturaleza"] = naturalezaHttp(r.status);
        const conUso = naturaleza === "ok" && m.entrada !== null && m.salida !== null;
        // 2xx cuyo cuerpo no llegó a leerse porque se canceló la petición.
        if (naturaleza === "ok" && !conUso && signal?.aborted) naturaleza = "abortado";
        registro.intentos.push({ naturaleza, status: r.status, conUso, ronda, entrada: conUso ? m.entrada : null, salida: conUso ? m.salida! + (razonamientoFuera(m) ? m.razonamiento ?? 0 : 0) : null, cache: conUso ? m.cache ?? 0 : null, modelo: m.modelo });
        if (naturaleza !== "reintentable" || !reintentables.includes(r.status) || k >= T.http.reintentos) return r;
        void r.body?.cancel().catch(() => {});
        await esperarReintento(registro, ronda, esperaReintento(r, k), signal);
      }
    })();
    registro.enCurso.add(tarea);
    void tarea.catch(() => {}).finally(() => registro.enCurso.delete(tarea));
    return tarea;
  }) as typeof fetch;
}
async function drenar(registros: readonly RegistroTransporte[]): Promise<void> {
  for (const r of registros) while (r.enCurso.size) await Promise.allSettled([...r.enCurso]);
}
function usoDe(r: RegistroTransporte) {
  const con = r.intentos.filter(i => i.conUso);
  return { entrada: con.reduce((s, i) => s + (i.entrada ?? 0), 0), salida: con.reduce((s, i) => s + (i.salida ?? 0), 0), cache: con.reduce((s, i) => s + (i.cache ?? 0), 0), sinUso: r.intentos.length - con.length };
}
export function declaradoDe(r: RegistroTransporte, consta: Pick<DeclaradoLado, "tiemposMs" | "llamadas" | "motivos">, p: ParticipanteTorneo, promptMax: number): DeclaradoLado {
  const uso = usoDe(r);
  return {
    ...consta,
    intentos: r.intentos.map(({ naturaleza, status, conUso, ronda }) => ({ naturaleza, status, conUso, ronda })),
    esperas: r.esperas.map(e => ({ ...e })),
    ...uso, costoMicroUsd: costoLadoMicro(uso, p.precio, promptMax),
    modelosDevueltos: [...new Set(r.intentos.map(i => i.modelo).filter((x): x is string => !!x))].sort(),
  };
}

// ---------------------------------------------------------------------------------------------------
// Un partido (§ 3.4).
// ---------------------------------------------------------------------------------------------------
export interface ContextoControlador { plan: EncuentroPlan; lado: Lado; intento: number }
export type CrearControlador = (p: ParticipanteTorneo, transporte: typeof fetch, contexto: ContextoControlador) => ControladorEquipo;
export interface EntradaEncuentro {
  plan: EncuentroPlan; participantes: readonly ParticipanteTorneo[]; marco: MarcoTorneo; intento: number;
  crearControlador: CrearControlador; fetch: typeof fetch; promptMax: number; secretos: readonly string[];
  esperaMs?: number; signal?: AbortSignal; ahora?: () => number;
  /** Brief 062 (D12) · Opcional y aditiva: el servidor la usa para el ritmo de reloj; el CLI no la pasa. */
  alPublicar?: (publicacion: PublicacionArena) => Promise<void>;
}
export type ResultadoEncuentro =
  | { resultado: "valido"; costoMicroUsd: number; encuentro: EncuentroTorneo; ejecutor: EjecutorEncuentro; gz: Buffer; registro: RegistroArena }
  | { resultado: "anulado"; costoMicroUsd: number; causas: string[]; declarado: Record<Lado, DeclaradoLado> }
  | { resultado: "interrumpido"; costoMicroUsd: number };

export async function jugarEncuentro(o: EntradaEncuentro): Promise<ResultadoEncuentro> {
  const buscar = (id: string) => { const p = o.participantes.find(x => x.id === id); if (!p) throw new ErrorTorneo(`Participante ${id} ausente`); return p; };
  const part: Record<Lado, ParticipanteTorneo> = { local: buscar(o.plan.local), visita: buscar(o.plan.visita) };
  const regs: Record<Lado, RegistroTransporte> = { local: nuevoRegistroTransporte(o.ahora), visita: nuevoRegistroTransporte(o.ahora) };
  const controladores = Object.fromEntries(LADOS_TORNEO.map(lado => [lado, o.crearControlador(part[lado], transporteTorneo(o.fetch, regs[lado]), { plan: o.plan, lado, intento: o.intento })])) as Record<Lado, ControladorEquipo>;
  for (const lado of LADOS_TORNEO) if (controladores[lado].id !== part[lado].controlador) throw new ErrorTorneo(`El controlador ${lado} (${controladores[lado].id}) no es el del participante (${part[lado].controlador})`);
  const costoConocido = () => LADOS_TORNEO.reduce((s, lado) => s + costoLadoMicro(usoDe(regs[lado]), part[lado].precio, o.promptMax), 0);
  let registro: RegistroArena;
  try {
    // La MISMA llamada que la validación (§ 16.1): CLI y CI no pueden divergir.
    registro = await ejecutarArena(configDelPlan(o.plan, o.marco), controladores, {
      esperaMs: o.esperaMs ?? ARENA.esperaMs, ...(o.signal ? { signal: o.signal } : {}), ...(o.alPublicar ? { alPublicar: o.alPublicar } : {}),
      alProgreso: () => { regs.local.ronda++; regs.visita.ronda++; },
    });
  } catch (error) {
    await drenar([regs.local, regs.visita]);
    // Ctrl+C: el uso conocido más el máximo de cada intento sin usage.
    if (o.signal?.aborted) return { resultado: "interrumpido", costoMicroUsd: costoConocido() };
    throw error;
  }
  await drenar([regs.local, regs.visita]);
  const declarado = { local: declaradoDe(regs.local, constaEnArchivo(registro, "local"), part.local, o.promptMax), visita: declaradoDe(regs.visita, constaEnArchivo(registro, "visita"), part.visita, o.promptMax) };
  const costoMicroUsd = declarado.local.costoMicroUsd + declarado.visita.costoMicroUsd;
  const causas: string[] = [];
  registro.rondas.forEach((r, i) => LADOS_TORNEO.forEach(lado => {
    const d = r.decisiones[lado];
    if (d.origen !== "respaldo") return;
    const causa = causaTerminal(d.motivo, declarado[lado].intentos.filter(x => x.ronda === i + 1), declarado[lado].esperas.filter(x => x.ronda === i + 1));
    if (causa === "infraestructura") causas.push(`ronda ${i + 1} · ${lado} · ${d.motivo}`);
  }));
  if (causas.length) return { resultado: "anulado", costoMicroUsd, causas, declarado };

  const textoRegistro = JSON.stringify(registro);
  if (detectarSecretos(textoRegistro, o.secretos)) throw new ErrorTorneo(`P${o.plan.n}: el registro conserva un secreto; se aborta sin redactarlo`);
  if (Buffer.byteLength(textoRegistro) > ARENA.archivoMaxBytes) throw new ErrorTorneo(`P${o.plan.n}: registro mayor que ${ARENA.archivoMaxBytes} bytes`);
  const gz = gzipSync(textoRegistro, { level: 9 });
  if (gz.length > T.registroGzMaxBytes) throw new ErrorTorneo(`P${o.plan.n}: registro comprimido mayor que ${T.registroGzMaxBytes} bytes`);
  if (gunzipSync(gz).toString("utf8") !== textoRegistro) throw new ErrorTorneo(`P${o.plan.n}: la ida y vuelta de gzip no reproduce el registro`);
  const crudo = esquemaEjecutor.parse({ n: o.plan.n, intento: o.intento, archivoSha256: sha256(gz), local: declarado.local, visita: declarado.visita });
  const textoEjecutor = redactar(JSON.stringify(crudo), o.secretos);
  if (detectarSecretos(textoEjecutor, o.secretos)) throw new ErrorTorneo(`P${o.plan.n}: ejecutor.json conserva un secreto`);
  const ejecutor = esquemaEjecutor.parse(JSON.parse(textoEjecutor));
  const encuentro = encuentroDesdeEjecutor(ejecutor, o.plan, registro);
  // Validación con cada partido válido: un fallo aquí es un defecto, no un fallo de red: aborta el torneo.
  const rep = validarEncuentro(encuentro, o.plan, o.participantes, gz, o.marco);
  if (!isDeepStrictEqual(contenidoCanonico(rep), contenidoCanonico(JSON.parse(textoRegistro) as RegistroArena))) throw new ErrorTorneo(`P${o.plan.n}: la reproducción no coincide con el registro`);
  return { resultado: "valido", costoMicroUsd, encuentro, ejecutor, gz, registro: rep };
}

// ---------------------------------------------------------------------------------------------------
// Archivos, cerrojo y libro (§ 15.4).
// ---------------------------------------------------------------------------------------------------
export const ejecutorEncuentro = (n: number) => `e${String(n).padStart(2, "0")}.ejecutor.json`;
export function escribirAtomico(ruta: string, datos: string | Uint8Array): void {
  const tmp = `${ruta}.tmp-${process.pid}`;
  writeFileSync(tmp, datos);
  renameSync(tmp, ruta);
}
/** Un partido está hecho si y solo si `eNN.json.gz` y `eNN.ejecutor.json` existen y validarEncuentro los acepta.
 * Un par incompleto o inválido se borra y el partido se vuelve a jugar entero. */
export function partidoHecho(dir: string, plan: EncuentroPlan, participantes: readonly ParticipanteTorneo[], marco: MarcoTorneo, log: (s: string) => void = () => {}): EncuentroTorneo | null {
  const rutaGz = join(dir, archivoEncuentro(plan.n)), rutaEj = join(dir, ejecutorEncuentro(plan.n));
  const hayGz = existsSync(rutaGz), hayEj = existsSync(rutaEj);
  if (!hayGz && !hayEj) return null;
  try {
    if (!hayGz || !hayEj) throw new Error("par ejecutor.json/.gz incompleto");
    const ejecutor = esquemaEjecutor.parse(JSON.parse(readFileSync(rutaEj, "utf8")));
    if (ejecutor.n !== plan.n) throw new Error("ejecutor.json de otro partido");
    const bytes = readFileSync(rutaGz);
    const e = encuentroDesdeEjecutor(ejecutor, plan, descomprimirRegistro(bytes) as RegistroArena);
    validarEncuentro(e, plan, participantes, bytes, marco);
    return e;
  } catch (error) {
    log(`P${plan.n}: ${error instanceof Error ? error.message : "archivo inválido"}; se borra y se vuelve a jugar`);
    rmSync(rutaGz, { force: true }); rmSync(rutaEj, { force: true });
    return null;
  }
}
/** Cerrojo con `open(…, "wx")`: un segundo proceso aborta. */
export function tomarCerrojo(dir: string, pid: number, inicio: Date): () => void {
  const ruta = join(dir, "cerrojo");
  let fd: number;
  try { fd = openSync(ruta, "wx"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new ErrorTorneo(`Otro proceso tiene el cerrojo de ${dir}; si murió, usa --liberar-cerrojo`);
    throw error;
  }
  try { writeSync(fd, JSON.stringify(esquemaCerrojo.parse({ pid, inicioUtc: inicio.toISOString() }))); } finally { closeSync(fd); }
  return () => rmSync(ruta, { force: true });
}
/** `--liberar-cerrojo`: solo si `process.kill(pid, 0)` lanza con ESRCH. EPERM o un contenido inválido rechazan.
 * Límite declarado: no protege frente a dos liberadores concurrentes (CLI de un solo operador). */
export function liberarCerrojo(dir: string, matar: (pid: number, senal: number) => unknown = (pid, s) => process.kill(pid, s)): string {
  const ruta = join(dir, "cerrojo");
  if (!existsSync(ruta)) return "No hay cerrojo que liberar";
  let pid: number;
  try { pid = esquemaCerrojo.parse(JSON.parse(readFileSync(ruta, "utf8"))).pid; }
  catch { throw new ErrorTorneo("El cerrojo tiene un contenido inválido: no se libera"); }
  try { matar(pid, 0); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") { rmSync(ruta, { force: true }); return `Cerrojo del pid ${pid} liberado (el proceso ya no vive)`; }
    throw new ErrorTorneo(`No se libera el cerrojo: el pid ${pid} no se puede comprobar (${(error as NodeJS.ErrnoException).code ?? "error"})`);
  }
  throw new ErrorTorneo(`No se libera el cerrojo: el proceso ${pid} sigue vivo`);
}
export function leerLibro(ruta: string): MovimientoGasto[] {
  if (!existsSync(ruta)) return [];
  return readFileSync(ruta, "utf8").split("\n").filter(l => l.trim()).map((l, i) => {
    try { return esquemaMovimiento.parse(JSON.parse(l)); }
    catch { throw new ErrorTorneo(`gasto.ndjson: línea ${i + 1} inválida`); }
  });
}

// ---------------------------------------------------------------------------------------------------
// El torneo (§ 3.5, § 3.8, § 15.1, § 15.4).
// ---------------------------------------------------------------------------------------------------
export interface OpcionesTorneo {
  id: string; tipo: "real" | "ensayo"; participantes: ParticipanteTorneo[]; semilla: number; duracionS: number; intervaloS: number; commit: string;
  topeMicroUsd: number; tipicoMicroUsd: number; promptMax: number;
  /** `.cache/arena-torneos/<id>/`. */
  dirTrabajo: string;
  /** Raíz de los torneos publicados (`public/torneos` o `--salida` en ensayo): escribe `<id>/…` e `indice.json`. */
  dirTorneos: string;
  /** `docs/evidencia/torneo-059/<id>/` en un torneo real; null en ensayo. */
  dirEvidencia: string | null;
  orden: string; reanudar: boolean;
  crearControlador: CrearControlador; fetch: typeof fetch; secretos: readonly string[];
  esperaMs?: number; dormir?: (ms: number, signal?: AbortSignal) => Promise<void>; ahora?: () => Date; signal?: AbortSignal; log?: (s: string) => void; pid?: number;
}
export interface ResultadoTorneo { codigo: 0 | 2 | 3 | 130; mensaje: string; torneo: TorneoCualquiera | null }

export async function ejecutarTorneo(o: OpcionesTorneo): Promise<ResultadoTorneo> {
  const ahora = o.ahora ?? (() => new Date());
  mkdirSync(o.dirTrabajo, { recursive: true });
  const soltar = tomarCerrojo(o.dirTrabajo, o.pid ?? process.pid, ahora());
  try { return await ejecutarConCerrojo(o, ahora); } finally { soltar(); }
}

async function ejecutarConCerrojo(o: OpcionesTorneo, ahora: () => Date): Promise<ResultadoTorneo> {
  const log = o.log ?? (() => {}), dormir = o.dormir ?? esperarAbortable, dir = o.dirTrabajo;
  const marco: MarcoTorneo = { duracionS: o.duracionS, intervaloS: o.intervaloS, motor: { version: ARENA.version, reglas: ARENA.reglas } };
  const config = esquemaConfigTorneo.parse({ id: o.id, participantes: o.participantes, semilla: o.semilla, duracionS: o.duracionS, intervaloS: o.intervaloS, motor: marco.motor, commit: o.commit });
  const rutaConfig = join(dir, "config.json"), rutaInicio = join(dir, "inicio.json"), rutaLibro = join(dir, "gasto.ndjson");
  if (existsSync(rutaConfig)) {
    if (!o.reanudar) throw new ErrorTorneo(`Ya hay un torneo ${o.id} en ${dir}: usa --reanudar (o borra ese directorio)`);
    let previa: unknown;
    try { previa = esquemaConfigTorneo.parse(JSON.parse(readFileSync(rutaConfig, "utf8"))); } catch { throw new ErrorTorneo("config.json ilegible: no se reanuda"); }
    if (!isDeepStrictEqual(previa, config)) throw new ErrorTorneo("config.json distinto: la reanudación exige los mismos participantes, semilla, duración, intervalo, motor y commit");
  } else escribirAtomico(rutaConfig, JSON.stringify(config, null, 2) + "\n");
  if (!existsSync(rutaInicio)) escribirAtomico(rutaInicio, JSON.stringify({ inicioUtc: ahora().toISOString() }) + "\n");
  const inicioUtc = (JSON.parse(readFileSync(rutaInicio, "utf8")) as { inicioUtc: string }).inicioUtc;

  const libro = leerLibro(rutaLibro);
  const anotar = (m: MovimientoGasto) => { const v = esquemaMovimiento.parse(m); appendFileSync(rutaLibro, JSON.stringify(v) + "\n"); libro.push(v); };
  if (gastoConocido(libro) > o.topeMicroUsd) return { codigo: 3, mensaje: `El tope (${usd(o.topeMicroUsd)}) no puede bajar del gasto conocido (${usd(gastoConocido(libro))})`, torneo: null };

  const plan = calendarioTorneo(o.participantes.map(p => p.id), o.semilla), rondas = rondasPartido(o.duracionS, o.intervaloS);
  const precio = (id: string) => o.participantes.find(p => p.id === id)!.precio;
  const reservaDe = (p: EncuentroPlan) => reservaPartido({ local: precio(p.local), visita: precio(p.visita) }, o.promptMax, rondas);
  const pausa = async (ms: number) => { try { await dormir(ms, o.signal); return true; } catch (error) { if (esAbort(error)) return false; throw error; } };
  const interrumpido = (n: number): ResultadoTorneo => ({ codigo: 130, mensaje: `Interrumpido (Ctrl+C) en P${n}; reanuda con --reanudar`, torneo: null });
  const hechos = new Map<number, EncuentroTorneo>(), pendientes: number[] = [];
  let seguidos = 0;
  for (const [i, p] of plan.entries()) {
    const hecho = partidoHecho(dir, p, o.participantes, marco, log);
    if (hecho) { hechos.set(p.n, hecho); continue; }
    let valido = false;
    for (let k = 0; k <= T.repeticionesMax; k++) {
      if (o.signal?.aborted) return interrumpido(p.n);
      const intento = 1 + Math.max(0, ...libro.filter(m => m.n === p.n).map(m => m.intento));
      const reserva = reservaDe(p), conocido = gastoConocido(libro);
      // Parada preventiva (§ 15.1): nunca se empieza un intento cuya reserva no cabe en el tope por estimación.
      if (conocido + reserva > o.topeMicroUsd) return { codigo: 3, mensaje: `Pausado por el tope por estimación antes de P${p.n}: gasto conocido ${usd(conocido)} + reserva ${usd(reserva)} > tope ${usd(o.topeMicroUsd)}. Reanuda con --reanudar --tope-usd <mayor>.`, torneo: null };
      anotar({ n: p.n, intento, tipo: "reserva", microUsd: reserva });
      log(`P${p.n} · J${p.jornada}${p.vuelta ? " (vuelta)" : ""} · ${p.local} – ${p.visita} · intento ${intento} · reserva ${usd(reserva)}`);
      let r: ResultadoEncuentro;
      try {
        r = await jugarEncuentro({ plan: p, participantes: o.participantes, marco, intento, crearControlador: o.crearControlador, fetch: o.fetch, promptMax: o.promptMax, secretos: o.secretos,
          ...(o.esperaMs !== undefined ? { esperaMs: o.esperaMs } : {}), ...(o.signal ? { signal: o.signal } : {}) });
      } catch (error) {
        anotar({ n: p.n, intento, tipo: "cierre", microUsd: reserva, resultado: "fallo" });
        throw error;
      }
      anotar({ n: p.n, intento, tipo: "cierre", microUsd: r.costoMicroUsd, resultado: r.resultado });
      if (r.resultado === "interrumpido") return interrumpido(p.n);
      if (r.resultado === "valido") {
        // Primero ejecutor.json, después el .gz (punto de confirmación), ambos con temporal y rename.
        escribirAtomico(join(dir, ejecutorEncuentro(p.n)), JSON.stringify(r.ejecutor, null, 2) + "\n");
        escribirAtomico(join(dir, archivoEncuentro(p.n)), r.gz);
        const confirmado = partidoHecho(dir, p, o.participantes, marco, log);
        if (!confirmado) throw new ErrorTorneo(`P${p.n}: el par escrito no supera validarEncuentro`);
        hechos.set(p.n, confirmado); seguidos = 0; valido = true;
        log(`P${p.n} · ${confirmado.local.club} ${confirmado.local.goles}–${confirmado.visita.goles} ${confirmado.visita.club} · coste declarado ${usd(r.costoMicroUsd)}`);
        break;
      }
      seguidos++;
      log(`P${p.n} anulado por infraestructura (${r.causas.join("; ")}); coste ${usd(r.costoMicroUsd)}`);
      const ultimo = k === T.repeticionesMax;
      // Con anuladosSeguidosMax se detiene (código 2) si aún queda trabajo; un último partido agotado queda pendiente.
      if (seguidos >= T.anuladosSeguidosMax && !(ultimo && i === plan.length - 1)) return { codigo: 2, mensaje: `${seguidos} partidos anulados seguidos por infraestructura: reanuda más tarde con --reanudar`, torneo: null };
      if (!ultimo && !(await pausa(seguidos === T.anuladosSeguidosMax - 1 ? T.enfriamientoMs : T.pausaEntrePartidosMs))) return interrumpido(p.n);
    }
    if (!valido) pendientes.push(p.n);
    if (i < plan.length - 1 && !(await pausa(T.pausaEntrePartidosMs))) return interrumpido(p.n);
  }

  const encuentros = plan.filter(p => hechos.has(p.n)).map(p => hechos.get(p.n)!);
  const torneo: TorneoArchivado = {
    version: VERSION_TORNEO, id: o.id, tipo: o.tipo,
    titulo: o.tipo === "ensayo" ? { es: "Torneo de ensayo · sin IA", en: "Rehearsal tournament · no AI" } : { es: `Torneo entre modelos · ${inicioUtc.slice(0, 10)}`, en: `Model tournament · ${inicioUtc.slice(0, 10)}` },
    inicioUtc, finUtc: ahora().toISOString(), commit: o.commit, motor: marco.motor, duracionS: o.duracionS, intervaloS: o.intervaloS, semilla: o.semilla,
    participantes: o.participantes, encuentros, pendientes,
    gasto: { conocidoMicroUsd: gastoConocido(libro), tipicoMicroUsd: o.tipicoMicroUsd, topeMicroUsd: o.topeMicroUsd, reservaMaxPartidoMicroUsd: Math.max(...plan.map(reservaDe)) },
    estado: pendientes.length ? "incompleto" : "completo",
  };
  const texto = redactar(JSON.stringify(torneo, null, 2) + "\n", o.secretos);
  if (detectarSecretos(texto, o.secretos)) throw new ErrorTorneo("torneo.json conserva un secreto");
  const validado = validarTorneo(JSON.parse(texto), archivo => readFileSync(join(dir, archivo)));

  // Publicación: copia de los .gz, torneo.json y el índice; después se vuelve a validar lo publicado.
  const destino = join(o.dirTorneos, o.id);
  mkdirSync(destino, { recursive: true });
  for (const e of validado.encuentros) {
    const tmp = join(destino, `${e.archivo}.tmp-${process.pid}`);
    copyFileSync(join(dir, e.archivo), tmp); renameSync(tmp, join(destino, e.archivo));
  }
  escribirAtomico(join(destino, "torneo.json"), texto);
  validarTorneo(JSON.parse(readFileSync(join(destino, "torneo.json"), "utf8")), archivo => readFileSync(join(destino, archivo)));
  const rutaIndice = join(o.dirTorneos, "indice.json");
  const indice = existsSync(rutaIndice) ? esquemaIndice.parse(JSON.parse(readFileSync(rutaIndice, "utf8"))) : [];
  const nuevo = [...indice.filter(x => x.id !== o.id), { id: o.id, inicioUtc, titulo: validado.titulo }].sort((a, b) => b.inicioUtc.localeCompare(a.inicioUtc) || a.id.localeCompare(b.id));
  escribirAtomico(rutaIndice, JSON.stringify(esquemaIndice.parse(nuevo), null, 2) + "\n");

  if (o.dirEvidencia) {
    mkdirSync(o.dirEvidencia, { recursive: true });
    escribirAtomico(join(o.dirEvidencia, "resumen.md"), resumenTorneo(validado));
    const gasto = { orden: o.orden, commit: o.commit, topeMicroUsd: o.topeMicroUsd, tipicoMicroUsd: o.tipicoMicroUsd, conocidoMicroUsd: validado.gasto.conocidoMicroUsd, movimientos: libro };
    const textoGasto = redactar(JSON.stringify(gasto, null, 2) + "\n", o.secretos);
    if (detectarSecretos(textoGasto, o.secretos)) throw new ErrorTorneo("gasto.json conserva un secreto");
    escribirAtomico(join(o.dirEvidencia, "gasto.json"), textoGasto);
    if (existsSync(join(dir, "estimacion.json"))) copyFileSync(join(dir, "estimacion.json"), join(o.dirEvidencia, "estimacion.json"));
  }
  const conocido = validado.gasto.conocidoMicroUsd;
  return { codigo: 0, mensaje: `Torneo ${o.id} ${validado.estado}: ${encuentros.length} de ${plan.length} partidos; gasto conocido ${usd(conocido)} (tope por estimación ${usd(o.topeMicroUsd)})${pendientes.length ? `; pendientes ${pendientes.map(n => `P${n}`).join(", ")} (--reanudar los vuelve a intentar)` : ""}`, torneo: validado };
}

// ---------------------------------------------------------------------------------------------------
// Participantes (§ 3.2, § 15.6).
// ---------------------------------------------------------------------------------------------------
export interface EntradaCatalogo { nombre: string; modelo: string; version: string; id: string; nombrePublico: string; llm: "azure-openai" | "foundry-modelos"; formatoJson?: FormatoSonda; esfuerzoRazonamiento?: "low" | "minimal"; publicar: boolean }
export interface PreciosJson { fuente: string; consultadoUtc: string; modelos: { deployment: string; entrada: number; salida: number; cache: number | null }[] }
/** § 9 · Único precio estimado admitido: gpt-6.1-sol con el de gpt-6-sol, declarado, mientras falte el suyo. */
export const PRECIO_ESTIMADO_DE: Readonly<Record<string, string>> = { "cronista-sol61": "cronista-sol6" };

export const especDe = (p: Pick<ParticipanteTorneo, "llm" | "deployment" | "formatoJson" | "esfuerzo">): EspecLlm => {
  if (p.llm === "ensayo") throw new ErrorTorneo("Un participante de ensayo no tiene LLM");
  return { tipo: p.llm, deployment: p.deployment, ...(p.llm === "foundry-modelos" && p.formatoJson ? { formatoJson: p.formatoJson as FormatoSonda } : {}), ...(p.llm === "foundry-modelos" && p.esfuerzo ? { esfuerzoRazonamiento: p.esfuerzo } : {}) };
};

/** Un id fuera del catálogo, no publicado o sin precio aborta antes de llamar a nada. */
export function participantesReales(ids: readonly string[], catalogo: readonly EntradaCatalogo[], precios: PreciosJson, controladorDe: (espec: EspecLlm) => string): ParticipanteTorneo[] {
  return ids.map(id => {
    const m = catalogo.find(x => x.id === id);
    if (!m) throw new ErrorTorneo(`${id} no está en infra/modelos-arena.json`);
    if (!m.publicar) throw new ErrorTorneo(`${id} no tiene publicar: true en infra/modelos-arena.json`);
    const propio = precios.modelos.find(x => x.deployment === m.nombre);
    const estimadoDe = propio ? null : PRECIO_ESTIMADO_DE[m.nombre] ?? null;
    const lista = propio ?? (estimadoDe ? precios.modelos.find(x => x.deployment === estimadoDe) : undefined);
    if (!lista) throw new ErrorTorneo(`${id} (${m.nombre}) no tiene precio en precios.json`);
    const sinControlador = { id: m.id, nombre: m.nombrePublico, corto: cortoDe(m.nombrePublico), deployment: m.nombre, modelo: m.modelo, version: m.version, llm: m.llm,
      formatoJson: m.formatoJson ?? null, esfuerzo: m.llm === "azure-openai" ? "low" as const : m.esfuerzoRazonamiento ?? null,
      precio: { entrada: lista.entrada, salida: lista.salida, cache: lista.cache, fuente: precios.fuente, consultadoUtc: precios.consultadoUtc, estimadoDe } };
    return { ...sinControlador, controlador: controladorDe(especDe(sinControlador)) };
  });
}
/** D10 · Ensayo: controladores programados con ids `ensayo:<x>`, coste 0, nunca publicado en public/. */
export function participantesEnsayo(letras: readonly string[]): ParticipanteTorneo[] {
  return letras.map(x => {
    if (!/^[a-z0-9]{1,8}$/.test(x)) throw new ErrorTorneo(`Participante de ensayo inválido: ${x}`);
    const nombre = `Ensayo ${x.toUpperCase()}`;
    return { id: `ensayo:${x}`, nombre, corto: cortoDe(nombre), deployment: `ensayo-${x}`, modelo: "política programada", version: ARENA.version, llm: "ensayo" as const,
      controlador: `ensayo:${x}`, formatoJson: null, esfuerzo: null,
      precio: { entrada: 0, salida: 0, cache: 0, fuente: "ensayo: sin inferencia ni coste", consultadoUtc: "1970-01-01T00:00:00.000Z", estimadoDe: null } };
  });
}

// ---------------------------------------------------------------------------------------------------
// Estimación antes de jugar (§ 3.6, § 15.1).
// ---------------------------------------------------------------------------------------------------
export interface EvidenciaArchivo { archivo: string; evidencia: EvidenciaSmoke }
export interface EstimacionParticipante {
  id: string; nombre: string; deployment: string; controlador: string; decisiones: number;
  medicionPropia: boolean; entradaMedia: number; salidaMedia: number; tipicoDecisionMicroUsd: number; tipicoMicroUsd: number;
  maxIntentoMicroUsd: number; reservaMicroUsd: number; medianaMs: number | null; latenciaPropia: boolean; precioEstimadoDe: string | null;
}
export interface EstimacionTorneo {
  version: string; promptMax: PromptMaxReserva; rondas: number; decisionesPorParticipante: number;
  participantes: EstimacionParticipante[];
  partidos: { n: number; jornada: number; vuelta: boolean; local: string; visita: string; seed: number; reservaMicroUsd: number; tiempoS: number }[];
  tipicoMicroUsd: number; reservaSumaMicroUsd: number; reservaMaxPartidoMicroUsd: number; tiempoS: number; topeMicroUsd: number; rechazos: string[];
}
const mediana = (xs: number[]) => { const v = [...xs].sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)]! : null; };

/** Brief 062 § 6.2 · Lo que la estimación toma de la evidencia 052, extraído de `estimarTorneo` sin cambiar su
 * salida: el prompt máximo de los partidos de 60 s y, por participante, las medias de entrada y salida (la mayor
 * media observada si no hay medición propia) y la mediana de latencia. Lo usa también `torneo-entradas-cli.ts`. */
export interface MedidaEstimacion { id: string; entradaMedia: number; salidaMedia: number; medicionPropia: boolean; medianaMs: number | null; latenciaPropia: boolean }
export function entradasEstimacion(participantes: readonly Pick<ParticipanteTorneo, "id" | "controlador">[], evidencias: readonly EvidenciaArchivo[]): { promptMax: EstimacionTorneo["promptMax"]; medidas: MedidaEstimacion[] } {
  // P: el mayor promptMax de cualquier partido de 60 s de la evidencia 052.
  let promptMax: EstimacionTorneo["promptMax"] | null = null;
  for (const { archivo, evidencia } of evidencias) for (const p of evidencia.partidos) {
    if (p.duracionS !== S.cortoS) continue;
    for (const l of p.lados) if (l.promptMax !== null && (!promptMax || l.promptMax > promptMax.tokens)) promptMax = { tokens: l.promptMax, archivo, partido: p.nombre };
  }
  if (!promptMax) throw new ErrorTorneo("Sin evidencia 052 de partidos de 60 s: no se puede estimar el máximo por intento");
  // Medias por llamada con usage, por controlador (como candidato o como rival), y medianas de latencia.
  const lados = evidencias.flatMap(x => x.evidencia.partidos.flatMap(p => p.lados));
  const decisiones = evidencias.flatMap(x => [...x.evidencia.decisionesCandidato, ...x.evidencia.decisionesRival]);
  const medias = (controlador: string) => {
    const us = lados.filter(l => l.controlador === controlador && l.uso && l.uso.respuestasConUso > 0).map(l => l.uso!);
    const n = us.reduce((s, u) => s + u.respuestasConUso, 0);
    return n ? { entrada: us.reduce((s, u) => s + u.entrada, 0) / n, salida: us.reduce((s, u) => s + u.salida, 0) / n } : null;
  };
  const controladores = [...new Set(lados.map(l => l.controlador))];
  const todas = controladores.map(medias).filter((x): x is { entrada: number; salida: number } => !!x);
  const mayor = { entrada: Math.max(0, ...todas.map(x => x.entrada)), salida: Math.max(0, ...todas.map(x => x.salida)) };
  const medianas = controladores.map(c => mediana(decisiones.filter(d => d.controlador === c).map(d => d.tiempoMs))).filter((x): x is number => x !== null);
  const medidas = participantes.map((p): MedidaEstimacion => {
    const propia = medias(p.controlador), m = propia ?? mayor;
    const lat = mediana(decisiones.filter(d => d.controlador === p.controlador).map(d => d.tiempoMs));
    return { id: p.id, entradaMedia: m.entrada, salidaMedia: m.salida, medicionPropia: !!propia, medianaMs: lat ?? (medianas.length ? Math.max(...medianas) : null), latenciaPropia: lat !== null };
  });
  return { promptMax, medidas };
}

/** Brief 063 v1.1 § 17.4 · revisión de Codex sobre la publicación 2 (P2): ÚNICA fuente del prompt máximo con el que
 * se reserva, la misma para el CLI (`estimarTorneo` y la ejecución, que reserva y cobra los intentos sin `usage` con
 * `estimacion.promptMax.tokens`) y para el sitio (`generarEntradasSitio` → `torneo-sitio-entradas.json`): el medido en la
 * evidencia 052 por TORNEO_SITIO.factorObservacion063, al alza, declarando el medido y el factor. Las peticiones
 * nuevas llevan las frases del 063 en el sistema y los datos del 063 en la observación, sean cuales sean sus reglas. */
export interface PromptMaxReserva { tokens: number; archivo: string; partido: string; medido?: number; factorObservacion063?: number }
export function promptMaxReserva(medido: { tokens: number; archivo: string; partido: string }, factor: number = TORNEO_SITIO.factorObservacion063): PromptMaxReserva {
  return { tokens: Math.ceil(medido.tokens * factor), archivo: medido.archivo, partido: medido.partido, medido: medido.tokens, factorObservacion063: factor };
}

/** `factorObservacion` solo existe para reproducir estimaciones archivadas anteriores al 063 (factor 1). */
export function estimarTorneo(o: { participantes: readonly ParticipanteTorneo[]; evidencias: readonly EvidenciaArchivo[]; duracionS: number; intervaloS: number; semilla: number; topeMicroUsd: number; topeUsd: number; factorObservacion?: number }): EstimacionTorneo {
  const { promptMax: medido, medidas } = entradasEstimacion(o.participantes, o.evidencias);
  const promptMax = promptMaxReserva(medido, o.factorObservacion);
  const P = promptMax.tokens;
  const rondas = rondasPartido(o.duracionS, o.intervaloS), n = o.participantes.length;
  const D = 2 * (n - 1) * rondas;
  const plan = calendarioTorneo(o.participantes.map(p => p.id), o.semilla);
  const reservaDe = (pl: EncuentroPlan) => reservaPartido({ local: buscar(pl.local).precio, visita: buscar(pl.visita).precio }, P, rondas);
  function buscar(id: string) { return o.participantes.find(p => p.id === id)!; }
  const participantes = o.participantes.map((p, i): EstimacionParticipante => {
    const m = medidas[i]!, tipicoDecision = microTipicoDecision(m.entradaMedia, m.salidaMedia, p.precio);
    const maxIntento = microMaxIntento(p.precio, P);
    return { id: p.id, nombre: p.nombre, deployment: p.deployment, controlador: p.controlador, decisiones: D, medicionPropia: m.medicionPropia, entradaMedia: m.entradaMedia, salidaMedia: m.salidaMedia,
      tipicoDecisionMicroUsd: tipicoDecision, tipicoMicroUsd: D * tipicoDecision, maxIntentoMicroUsd: maxIntento,
      reservaMicroUsd: plan.filter(x => x.local === p.id || x.visita === p.id).length * rondas * ARENA.intentosOrdenes * (1 + T.http.reintentos) * maxIntento,
      medianaMs: m.medianaMs, latenciaPropia: m.latenciaPropia, precioEstimadoDe: p.precio.estimadoDe };
  });
  const latencia = (id: string) => participantes.find(x => x.id === id)!.medianaMs ?? 0;
  const partidos = plan.map(pl => ({ n: pl.n, jornada: pl.jornada, vuelta: pl.vuelta, local: pl.local, visita: pl.visita, seed: pl.seed, reservaMicroUsd: reservaDe(pl),
    tiempoS: Math.round(rondas * Math.max(latencia(pl.local), latencia(pl.visita)) / 1000 + T.pausaEntrePartidosMs / 1000) }));
  const tipico = participantes.reduce((s, p) => s + p.tipicoMicroUsd, 0);
  const rechazos: string[] = [];
  if (o.topeUsd > T.topeMaxUsd) rechazos.push(`--tope-usd ${o.topeUsd} es mayor que el máximo admitido (${T.topeMaxUsd} USD)`);
  if (tipico > o.topeMicroUsd) rechazos.push(`el tope no alcanza para terminar: típico ${usd(tipico)} > tope ${usd(o.topeMicroUsd)}`);
  return { version: VERSION_TORNEO, promptMax, rondas, decisionesPorParticipante: D, participantes, partidos, tipicoMicroUsd: tipico,
    reservaSumaMicroUsd: partidos.reduce((s, p) => s + p.reservaMicroUsd, 0), reservaMaxPartidoMicroUsd: Math.max(...partidos.map(p => p.reservaMicroUsd)),
    tiempoS: partidos.reduce((s, p) => s + p.tiempoS, 0), topeMicroUsd: o.topeMicroUsd, rechazos };
}

export function formatearEstimacion(e: EstimacionTorneo): string {
  const nombre = new Map(e.participantes.map(p => [p.id, p.nombre]));
  const fila = (cols: string[]) => `| ${cols.join(" | ")} |`;
  const l = [
    `Estimación del torneo (${e.participantes.length} participantes, ${e.partidos.length} partidos, ${e.rondas} rondas por partido, ${e.decisionesPorParticipante} decisiones por modelo)`,
    `Máximo por intento HTTP: entrada ceil(${e.promptMax.tokens} × ${S.factorEntradaReintento}) + ${ARENA.tokensOrdenes} + ${T.reserva.margenCorreccionTokens}, salida ${ARENA.tokensOrdenes}; P = ${e.promptMax.tokens}${e.promptMax.medido !== undefined ? ` = ceil(${e.promptMax.medido} medido × ${e.promptMax.factorObservacion063} del brief 063)` : ""} (${e.promptMax.archivo}, ${e.promptMax.partido}).`,
    `Reserva por lado y partido = ${e.rondas} rondas × ${ARENA.intentosOrdenes} intentos × (1 + ${T.http.reintentos} reintentos HTTP) × máximo por intento.`,
    "",
    fila(["Modelo", "Deployment", "Decisiones", "Típico/decisión", "Típico torneo", "Máx./intento", "Reserva torneo", "Medición propia", "Latencia mediana"]),
    fila(Array(9).fill("---")),
    ...e.participantes.map(p => fila([p.nombre + (p.precioEstimadoDe ? ` († precio estimado con el de ${p.precioEstimadoDe})` : ""), p.deployment, String(p.decisiones), usd(p.tipicoDecisionMicroUsd), usd(p.tipicoMicroUsd), usd(p.maxIntentoMicroUsd), usd(p.reservaMicroUsd), p.medicionPropia ? "sí" : "no (mayor media observada)", p.medianaMs === null ? "—" : `${(p.medianaMs / 1000).toFixed(1)} s${p.latenciaPropia ? "" : " (sin medición propia)"}`])),
    "",
    `Típico total: ${usd(e.tipicoMicroUsd)}`,
    `Reserva del partido más caro: ${usd(e.reservaMaxPartidoMicroUsd)}`,
    `Peor caso teórico (todas las reservas; no es una previsión): ${usd(e.reservaSumaMicroUsd)}`,
    `Tope por estimación pedido: ${usd(e.topeMicroUsd)} (propuesto: ${T.topePropuestoUsd} USD; máximo ${T.topeMaxUsd} USD). Antes de cada partido: gasto conocido + reserva ≤ tope.`,
    `Tiempo estimado sin incidencias: ≈ ${Math.round(e.tiempoS / 60)} min (rondas × la mayor mediana de latencia de cada partido + pausas).`,
    "Límites: el consumo de una petición cortada es invisible (se cuenta su máximo); el precio de lista no es la factura; el control real del gasto es la facturación de Azure.",
    "",
    "Calendario:",
    ...e.partidos.map(p => `  J${String(p.jornada).padStart(2)} · P${String(p.n).padStart(2, "0")}${p.vuelta ? " (vuelta)" : "         "} · ${nombre.get(p.local)} (local) – ${nombre.get(p.visita)} (visita) · semilla ${p.seed} · reserva ${usd(p.reservaMicroUsd)}`),
  ];
  if (e.rechazos.length) l.push("", ...e.rechazos.map(r => `RECHAZO: ${r}`));
  return l.join("\n");
}
