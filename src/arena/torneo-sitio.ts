// Brief 062 v1.3 — Gestor del torneo lanzable desde el sitio (solo servidor). Las § 17, 18 y 19 del brief
// prevalecen sobre su cuerpo (§ 6):
//   - § 17.1 · Réplica única: un MUTEX EN PROCESO (cola de promesas) ejecuta en serie la admisión, cada cierre de
//     partido + la decisión del siguiente, el cierre final y el cierre de arranque. Sin *lease* ni `activo.json`.
//   - § 18.1 · Latido de presencia de CADA proceso (`latido-<proceso>.json` cada `latidoMs`) y BARRERA DE RELEVO:
//     el proceso nuevo no admite ni cierra nada mientras exista un latido ajeno fresco; al liberarla relee todos los
//     manifiestos y libros (la bolsa) dentro del mutex y ejecuta el cierre de arranque.
//   - § 19 · AUTOSILENCIO: nada protegido (admisión, instantánea, anexo, manifiesto, cierre, inferencia) sin un
//     primer latido confirmado y con la última renovación correcta de menos de `latidoSilencioS`. Si una renovación
//     falla o vence, el proceso aborta el partido y queda `silenciado` para siempre (no vuelve a escribir).
//   - § 17.2 + § 18.2 · Sin reanudación: tras un reinicio, el cierre de arranque deja el torneo `interrumpido` /
//     `reinicio` con la última instantánea y la reserva abierta contada entera; con reintentos y plazo.
//   - § 17.6 · Cancelación administrativa con token: aborta un `AbortController` que escuchan todas las esperas.
//   - § 18.4 · Liga de prueba con identidad propia (`sitio-prueba-<hex12>`, `prueba-<hex12>.json`), solo con token.
//   - § 6.4 · El bucle del 059 (`jugarEncuentro`, reservas, `gastoConocido`) con ritmo de reloj (D12), tope por
//     estimación, plazo total, repeticiones y enfriamientos; validación por partido en el servidor (§ 17.3).
// Dependencias inyectables (almacén, reloj, esperas, temporizadores, fetch, controladores y SIGTERM): las pruebas
// lo ejecutan con un almacén falso, reloj controlado y controladores programados.
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ARENA, TORNEO_ARENA as T, TORNEO_SITIO as S } from "../sim/limites";
import { Admision } from "./admision";
import { almacenTorneosDesdeEnv, noExiste, type AlmacenTorneos } from "./almacen-torneos";
import { crearControladorLlm, planProgramado } from "./controladores";
import { fabricaLlmReal } from "./smoke-modelos";
import {
  archivoEncuentro, esquemaMovimiento, esquemaParticipante, esquemaTorneo062, esquemaTorneoCualquiera, FORMATOS_TORNEO, gastoConocido, ID_TORNEO, reservaPartido,
  rondasPartido, validarCoherencia, type MovimientoGasto, type ParticipanteTorneo, type Torneo062,
} from "./torneo";
import {
  diaUtc, estimarFormato, FORMATOS_DISPONIBLES, ID_SITIO, idDelDia, planTorneo, PREFIJO_PRUEBA, proximoCupoUtc, semillaDelDia, siguientePartido, topeFormatoMicroUsd,
  validarMetadatos062, type EncuentroPlan062, type EntradasSitio, type FichaFormato, type FormatoTorneo,
} from "./torneo-formatos";
import { detectarSecretos, ejecutorEncuentro, esperarAbortable, especDe, jugarEncuentro, participantesEnsayo, redactar, type CrearControlador, type ResultadoEncuentro } from "./torneo-ejecucion";
import { sha256 } from "./torneo-validacion";
import entradasGeneradas from "./torneo-sitio-entradas.json";

// ---------------------------------------------------------------------------------------------------
// Tipos, esquemas y errores.
// ---------------------------------------------------------------------------------------------------
export type MotivoSitio = "desactivado" | "commit" | "origen" | "cancelacion" | "replicas" | "catalogo" | "iniciando" | "relevo" | "cierre" | "activo" | "cupo" | "bolsa";
export const TEXTO_MOTIVO: Record<MotivoSitio, string> = {
  desactivado: "Lanzar torneos no está disponible en este momento.",
  commit: "Lanzar torneos no está disponible en este momento.",
  origen: "Lanzar torneos no está disponible en este momento (origen público sin configurar).",
  cancelacion: "La cancelación administrativa no está configurada.",
  replicas: "Lanzar torneos exige una sola réplica del servidor.",
  catalogo: "Faltan en el catálogo modelos del torneo; no se puede lanzar con los mismos modelos.",
  iniciando: "El servidor está iniciando; vuelve a intentarlo en un momento.",
  relevo: "Despliegue en curso; vuelve a intentarlo en un minuto.",
  cierre: "Hay un torneo anterior sin cerrar; el operador tiene que revisarlo.",
  activo: "Hay un torneo en curso; espera a que termine.",
  cupo: "Ya se lanzó el torneo de hoy (UTC).",
  bolsa: "Se agotó el presupuesto de torneos del sitio para este periodo.",
};
const ESTADO_HTTP: Record<MotivoSitio, number> = { desactivado: 503, commit: 503, origen: 503, cancelacion: 503, replicas: 503, catalogo: 422, iniciando: 503, relevo: 503, cierre: 503, activo: 409, cupo: 409, bolsa: 422 };

export class ErrorSitio extends Error {
  constructor(mensaje: string, readonly status: number, readonly motivo: string | null = null, readonly reintentarS?: number) { super(mensaje); this.name = "ErrorSitio"; }
}
/** Next puede cargar este módulo dos veces (instrumentación y rutas): el gestor compartido lanza el ErrorSitio de SU
 * copia, así que `instanceof` no basta. Se reconoce por nombre y forma. */
export function esErrorSitio(e: unknown): e is ErrorSitio {
  if (e instanceof ErrorSitio) return true;
  const x = e as { name?: unknown; status?: unknown; message?: unknown } | null;
  return e instanceof Error && x?.name === "ErrorSitio" && typeof x.status === "number" && x.status >= 400 && x.status <= 599;
}
const errorMotivo = (motivo: MotivoSitio) => new ErrorSitio(TEXTO_MOTIVO[motivo], ESTADO_HTTP[motivo], motivo);
/** Escritura rechazada porque el proceso está detenido, silenciado o sin latido vigente (§ 19). */
export class ErrorSilencio extends Error {}

const fechaUtc = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/);
/** § 17.2 + § 18.4 · `dia-AAAA-MM-DD.json` o `prueba-<hex12>.json`: la configuración completa del torneo y la
 * `operacion` (uuid de la admisión). Es el punto de confirmación: se crea con `nuevo: true`. */
export const esquemaManifiesto = z.strictObject({
  version: z.literal(S.version), id: z.string().regex(ID_TORNEO), formato: z.enum(FORMATOS_TORNEO), tipo: z.enum(["real", "ensayo"]), lanzamiento: z.enum(["publico", "prueba"]),
  participantes: z.array(esquemaParticipante).min(T.participantes.min).max(T.participantes.max), semilla: z.number().int().min(0).max(0xffffffff),
  duracionS: z.number().int().min(1), intervaloS: z.number().int().min(1), motor: z.strictObject({ version: z.string().min(1).max(40), reglas: z.string().min(1).max(40) }),
  commit: z.string().regex(/^[0-9a-f]{7,40}$/), topeMicroUsd: z.number().int().min(0), tipicoMicroUsd: z.number().int().min(0), reservaMaxPartidoMicroUsd: z.number().int().min(0),
  promptMax: z.number().int().min(1), operacion: z.string().regex(/^[0-9a-f-]{36}$/), creadoUtc: fechaUtc,
});
export type Manifiesto = z.infer<typeof esquemaManifiesto>;
export const esquemaLatido = z.strictObject({ proceso: z.string().regex(/^[0-9a-f-]{36}$/), utc: fechaUtc });
const MANIFIESTO = /^(dia-\d{4}-\d{2}-\d{2}|prueba-[0-9a-f]{12})\.json$/;
const LATIDO = /^latido-([0-9a-f-]{36})\.json$/;
/** § 18.1 · Los latidos ajenos de más de una hora se borran (al liberar la barrera). */
const LATIDO_BORRAR_MS = 60 * 60 * 1000;
const nombreManifiesto = (m: Pick<Manifiesto, "id" | "lanzamiento">) => m.lanzamiento === "prueba" ? `prueba-${m.id.slice(PREFIJO_PRUEBA.length)}.json` : `dia-${m.id.slice(S.prefijoId.length)}.json`;
const iso = (ms: number) => new Date(ms).toISOString();

/** § 19 · Pura: el latido está vigente si la última renovación correcta tiene menos de `latidoSilencioS`. */
export function latidoVigente(ultimaRenovacionMs: number | null, ahoraMs: number): boolean {
  return ultimaRenovacionMs !== null && ahoraMs - ultimaRenovacionMs < S.latidoSilencioS * 1000;
}

// ---------------------------------------------------------------------------------------------------
// Configuración desde el entorno (pura, sin almacén): interruptor, commit, origen, token y réplicas.
// ---------------------------------------------------------------------------------------------------
type Env = Record<string, string | undefined>;
export interface ConfigSitio {
  motivo: MotivoSitio | null; ensayo: boolean; duracionS: number; ritmo: boolean; origen: string | null; token: string | null; commit: string | null;
}
const LETRAS_ENSAYO = ["a", "b", "c", "d", "e", "f"] as const;
export function configuracionSitio(env: Env, tipoAlmacen: "local" | "blob"): ConfigSitio {
  const ensayo = env.ARENA_TORNEO_SITIO_ENSAYO === "1";
  const segundos = ensayo && env.ARENA_TORNEO_SITIO_SEGUNDOS !== undefined ? Number(env.ARENA_TORNEO_SITIO_SEGUNDOS) : T.duracionS;
  const commit = env.CRONISTA_COMMIT && /^[0-9a-f]{7,40}$/.test(env.CRONISTA_COMMIT) ? env.CRONISTA_COMMIT : null;
  let origen: string | null = null;
  try { if (env.ARENA_ORIGEN_PUBLICO) { const u = new URL(env.ARENA_ORIGEN_PUBLICO); if (u.origin === env.ARENA_ORIGEN_PUBLICO.replace(/\/$/, "")) origen = u.origin; } } catch { origen = null; }
  const token = env.ARENA_ADMIN_TOKEN && env.ARENA_ADMIN_TOKEN.length >= S.admin.tokenMinCaracteres ? env.ARENA_ADMIN_TOKEN : null;
  const base = { ensayo, duracionS: segundos, ritmo: S.ritmoReal && !(ensayo && env.ARENA_TORNEO_SITIO_SIN_RITMO === "1"), origen, token, commit };
  // R3 · El ensayo (sin IA, sin coste) nunca corre contra el Blob de producción.
  const ensayoInvalido = ensayo && (!!env.ARENA_BLOB_ENDPOINT || !Number.isInteger(segundos) || segundos < T.ensayoSegundos.min || segundos > T.ensayoSegundos.max);
  const motivo: MotivoSitio | null = env.ARENA_TORNEO_SITIO !== "1" || ensayoInvalido ? "desactivado" : !commit ? "commit" : !origen ? "origen" : !token ? "cancelacion"
    : tipoAlmacen === "blob" && env.ARENA_MAX_REPLICAS !== "1" ? "replicas" : null;
  return { ...base, motivo };
}
/** § 6.2 · Cada participante tiene que estar en `ARENA_MODELOS` con su mismo deployment (y la inferencia configurada). */
export function catalogoCompleto(participantes: readonly ParticipanteTorneo[], env: Env): boolean {
  if (!env.AZURE_OPENAI_API_KEY || !env.AZURE_OPENAI_ENDPOINT) return false;
  let catalogo: { id: string; prefijo: string }[];
  try { catalogo = z.array(z.object({ id: z.string(), prefijo: z.string().regex(/^ARENA_[A-Z0-9_]+_$/) })).parse(JSON.parse(env.ARENA_MODELOS ?? "")); } catch { return false; }
  return participantes.every(p => { const m = catalogo.find(x => x.id === p.id); return p.llm === "azure-openai" && !!m && env[`${m.prefijo}AZURE_OPENAI_DEPLOYMENT`] === p.deployment; });
}

// ---------------------------------------------------------------------------------------------------
// Gestor.
// ---------------------------------------------------------------------------------------------------
export interface DepsGestor {
  almacen?: AlmacenTorneos;
  env?: Env;
  ahora?: () => number;
  dormir?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Temporizador de un disparo (latido, relevo y reintentos de cierre); devuelve la cancelación. */
  programar?: (fn: () => void, ms: number) => () => void;
  uuid?: () => string;
  fetch?: typeof fetch;
  crearControlador?: CrearControlador;
  entradas?: EntradasSitio;
  registrarSigterm?: (fn: () => void) => void;
  esperaMs?: number;
  log?: (s: string) => void;
}
interface TorneoMem { manifiesto: Manifiesto; instantanea: Torneo062 | null; libro: MovimientoGasto[] | null; error: string | null }
interface Activo { id: string; mem: TorneoMem & { instantanea: Torneo062; libro: MovimientoGasto[] }; abort: AbortController; causa: null | "cancelado" | "sigterm" | "silencio"; promesa: Promise<void> }
export interface EstadoSitio {
  habilitado: boolean; motivo: MotivoSitio | null; diaUtc: string; proximoCupoUtc: string;
  activo: { id: string } | null; hoy: { id: string; formato: FormatoTorneo } | null;
  /** `conocidoMicroUsd` es null hasta que el proceso relee los libros (al liberar la barrera de relevo). */
  bolsa: { conocidoMicroUsd: number | null; bolsaMicroUsd: number };
  formatos: Record<FormatoTorneo, FichaFormato>;
}
type Fin = { estado: "completo" | "incompleto" | "cancelado" | "interrumpido"; motivoFin: Torneo062["motivoFin"] };

const temporizadorReal = (fn: () => void, ms: number) => { const t = setTimeout(fn, ms); t.unref?.(); return () => clearTimeout(t); };

export class GestorTorneoSitio {
  readonly proceso: string;
  private almacenP?: Promise<AlmacenTorneos>;
  private almacenListo?: AlmacenTorneos;
  private cola: Promise<unknown> = Promise.resolve();
  private iniciado = false;
  private ultimoLatido: number | null = null;
  private silenciado = false;
  private detenido = false;
  motivoSilencio: string | null = null;
  barrera: "relevo" | null = "relevo";
  private recargado = false;
  private torneos = new Map<string, TorneoMem>();
  private activo: Activo | null = null;
  /** Cierres finales que no se pudieron escribir: el reintento de cierre los escribe tal cual. */
  private cierresEnMemoria = new Map<string, Torneo062>();
  private primerIntentoCierre: number | null = null;
  private cierreAgotado = false;
  private cancelarTimers = new Set<() => void>();
  private fallosAdmin: number[] = [];
  private cacheLectura = new Map<string, { hasta: number; valor: Torneo062 | "incoherente" | null }>();
  readonly admisionHttp: Admision;
  private readonly entradas: EntradasSitio;

  constructor(private readonly deps: DepsGestor = {}) {
    this.proceso = (deps.uuid ?? randomUUID)();
    this.entradas = deps.entradas ?? (entradasGeneradas as EntradasSitio);
    this.admisionHttp = new Admision(S.admision, () => this.ahora());
  }
  private get env(): Env { return this.deps.env ?? process.env; }
  ahora(): number { return (this.deps.ahora ?? Date.now)(); }
  private dormir(ms: number, signal?: AbortSignal) { return (this.deps.dormir ?? esperarAbortable)(ms, signal); }
  private log(s: string) { (this.deps.log ?? (x => console.error(x)))(`[torneo-sitio] ${s}`); }
  private programar(fn: () => void, ms: number) {
    const cancelar = (this.deps.programar ?? temporizadorReal)(() => { this.cancelarTimers.delete(cancelar); fn(); }, ms);
    this.cancelarTimers.add(cancelar);
  }
  private almacen(): Promise<AlmacenTorneos> {
    return this.almacenP ??= (this.deps.almacen ? Promise.resolve(this.deps.almacen) : almacenTorneosDesdeEnv(this.env)).then(a => (this.almacenListo = a));
  }
  private tipoAlmacen(): "local" | "blob" { return this.almacenListo?.tipo ?? (this.deps.almacen?.tipo ?? (this.env.ARENA_BLOB_ENDPOINT ? "blob" : "local")); }
  config(): ConfigSitio { return configuracionSitio(this.env, this.tipoAlmacen()); }
  private participantes(cfg: ConfigSitio): ParticipanteTorneo[] { return cfg.ensayo ? participantesEnsayo(LETRAS_ENSAYO) : this.entradas.participantes; }
  private entradasDe(cfg: ConfigSitio): EntradasSitio {
    if (!cfg.ensayo) return this.entradas;
    const participantes = this.participantes(cfg);
    return { ...this.entradas, participantes, medidas: participantes.map(p => ({ id: p.id, entradaMedia: 0, salidaMedia: 0, medicionPropia: false, medianaMs: null, latenciaPropia: false })) };
  }
  private callado() { return this.detenido || this.silenciado; }

  // -------------------------------------------------------------------------------------------------
  // Mutex en proceso (§ 17.1).
  // -------------------------------------------------------------------------------------------------
  private exclusiva<R>(fn: () => Promise<R>): Promise<R> {
    const ejecucion = this.cola.then(() => fn());
    this.cola = ejecucion.catch(() => {});
    return ejecucion;
  }

  // -------------------------------------------------------------------------------------------------
  // Arranque, latido, autosilencio y SIGTERM (§ 18.1, § 19).
  // -------------------------------------------------------------------------------------------------
  /** Idempotente: latido de presencia, barrera de relevo y manejador de SIGTERM. */
  iniciar(): void {
    if (this.iniciado) return;
    this.iniciado = true;
    (this.deps.registrarSigterm ?? (fn => { process.once("SIGTERM", fn); }))(() => this.alSigterm());
    void (async () => {
      try { await (await this.almacen()).iniciar(); }
      catch (error) { this.log(`no se pudo iniciar el almacén: ${mensaje(error)}`); }
      await this.latir();
      void this.sondearRelevo();
    })();
  }
  private async latir(): Promise<void> {
    if (this.callado()) return;
    const t = this.ahora();
    try {
      await (await this.almacen()).escribir(`latido-${this.proceso}.json`, JSON.stringify({ proceso: this.proceso, utc: iso(t) }));
    } catch (error) { this.silenciar(`la renovación del latido falló (${mensaje(error)})`); return; }
    if (this.callado()) return;
    // Un latido que confirma tarde y ya no está vigente no rehabilita nada: el proceso se silencia.
    if (this.ultimoLatido !== null && !latidoVigente(this.ultimoLatido, this.ahora())) { this.silenciar("el latido venció antes de renovarse"); return; }
    this.ultimoLatido = t;
    this.programar(() => void this.latir(), S.latidoMs);
  }
  /** § 19 (3) · Permanente en este proceso: aborta el partido, deja de escribir y de admitir. */
  silenciar(motivo: string): void {
    if (this.silenciado) return;
    this.silenciado = true; this.motivoSilencio = motivo;
    this.log(`silenciado: ${motivo}`);
    if (this.activo) { this.activo.causa ??= "silencio"; this.activo.abort.abort(); }
    for (const c of this.cancelarTimers) c();
    this.cancelarTimers.clear();
  }
  /** § 17.1 · La réplica vieja aborta el partido y se calla: no escribe ningún cierre ni renueva el latido. */
  alSigterm(): void {
    if (this.detenido) return;
    this.detenido = true;
    this.log("SIGTERM: se aborta el partido en curso y el proceso deja de escribir");
    if (this.activo) { this.activo.causa ??= "sigterm"; this.activo.abort.abort(); }
    for (const c of this.cancelarTimers) c();
    this.cancelarTimers.clear();
  }
  /** Antes de cada operación protegida y de cada inferencia (§ 19.2). */
  private exigirVigencia(): void {
    if (this.detenido) throw new ErrorSilencio("Proceso detenido (SIGTERM)");
    if (this.silenciado) throw new ErrorSilencio(`Proceso silenciado: ${this.motivoSilencio}`);
    if (this.ultimoLatido === null) throw new ErrorSilencio("Sin primer latido confirmado");
    if (!latidoVigente(this.ultimoLatido, this.ahora())) { this.silenciar("latido vencido"); throw new ErrorSilencio("Latido vencido"); }
  }
  private async escribirP(nombre: string, texto: string, nuevo = false) { this.exigirVigencia(); await (await this.almacen()).escribir(nombre, texto, nuevo); }
  private async anexarP(nombre: string, texto: string) { this.exigirVigencia(); await (await this.almacen()).anexar(nombre, texto); }
  private async bytesP(nombre: string, datos: Uint8Array) { this.exigirVigencia(); await (await this.almacen()).escribirBytes(nombre, datos); }
  private async borrarP(nombre: string) { this.exigirVigencia(); await (await this.almacen()).borrar(nombre); }

  // -------------------------------------------------------------------------------------------------
  // Barrera de relevo (§ 18.1) y relectura de manifiestos, instantáneas y libros.
  // -------------------------------------------------------------------------------------------------
  private async sondearRelevo(): Promise<void> {
    if (this.callado() || this.barrera === null) return;
    try {
      if (this.ultimoLatido !== null) {
        const a = await this.almacen(), ajenos = await this.latidosAjenos(a);
        if (!ajenos.some(x => x.edad < S.latidoCaducoMs)) {
          await this.exclusiva(async () => {
            if (this.callado() || this.barrera === null) return;
            this.exigirVigencia();
            await this.recargar();
            this.barrera = null;
            for (const x of ajenos) if (x.edad > LATIDO_BORRAR_MS) await this.borrarP(x.nombre).catch(() => {});
            await this.intentarCierre();
          });
          this.programarReintentoCierre();
          return;
        }
      }
    } catch (error) { if (!(error instanceof ErrorSilencio)) this.log(`relevo: ${mensaje(error)}`); }
    if (!this.callado()) this.programar(() => void this.sondearRelevo(), S.relevoSondeoMs);
  }
  private async latidosAjenos(a: AlmacenTorneos): Promise<{ nombre: string; edad: number }[]> {
    const r: { nombre: string; edad: number }[] = [];
    for (const nombre of await a.listar()) {
      const m = LATIDO.exec(nombre);
      if (!m || m[1] === this.proceso) continue;
      try { r.push({ nombre, edad: this.ahora() - Date.parse(esquemaLatido.parse(JSON.parse(await a.leer(nombre))).utc) }); }
      catch (error) { if (!noExiste(error)) r.push({ nombre, edad: 0 }); } // ilegible ⇒ se trata como fresco (conservador)
    }
    return r;
  }
  /** § 18.1 (1) · Relee TODOS los manifiestos, sus instantáneas y sus libros. Un manifiesto ilegible hace fallar
   * la relectura entera; un libro ilegible queda `null` (la admisión lo rechaza con 503, nunca cuenta como 0). */
  private async recargar(): Promise<void> {
    const a = await this.almacen(), torneos = new Map<string, TorneoMem>();
    for (const nombre of (await a.listar()).filter(n => MANIFIESTO.test(n))) {
      const manifiesto = esquemaManifiesto.parse(JSON.parse(await a.leer(nombre)));
      if (nombreManifiesto(manifiesto) !== nombre) throw new Error(`${nombre}: id distinto del nombre`);
      const mem: TorneoMem = { manifiesto, instantanea: null, libro: null, error: null };
      Object.assign(mem, await this.leerInstantanea(a, manifiesto.id));
      mem.libro = await this.leerLibro(a, manifiesto.id);
      torneos.set(manifiesto.id, mem);
    }
    // El torneo que este proceso ejecuta conserva su estado en memoria (es la fuente de verdad mientras corre).
    if (this.activo) torneos.set(this.activo.id, this.activo.mem);
    this.torneos = torneos; this.recargado = true;
  }
/** La instantánea guardada de `id` (esquema 062, id y coherencia). Ausente ⇒ `instantanea: null` sin error;
   * ilegible o incoherente ⇒ `error` (el cierre la vuelve a leer en cada intento: un fallo transitorio no la condena). */
  private async leerInstantanea(a: AlmacenTorneos, id: string): Promise<{ instantanea: Torneo062 | null; error: string | null }> {
    try {
      const t = esquemaTorneoCualquiera.parse(JSON.parse(await a.leer(`${id}.torneo.json`)));
      if (t.version !== S.version || t.id !== id || validarCoherencia(t).length) throw new Error("instantánea incoherente");
      return { instantanea: t, error: null };
    } catch (error) { return { instantanea: null, error: noExiste(error) ? null : `instantánea ilegible (${mensaje(error)})` }; }
  }
  private async leerLibro(a: AlmacenTorneos, id: string): Promise<MovimientoGasto[] | null> {
    let texto: string;
    try { texto = await a.leer(`${id}.gasto.ndjson`); } catch (error) { return noExiste(error) ? [] : null; }
    try { return texto.split("\n").filter(l => l.trim()).map(l => esquemaMovimiento.parse(JSON.parse(l))); } catch { return null; }
  }

  // -------------------------------------------------------------------------------------------------
  // Cierre de arranque con reintentos (§ 17.2, § 18.2).
  // -------------------------------------------------------------------------------------------------
  private pendientesCierre(): TorneoMem[] {
    return [...this.torneos.values()].filter(t => t.manifiesto.id !== this.activo?.id && (this.cierresEnMemoria.has(t.manifiesto.id) || t.instantanea === null || t.instantanea.estado === "en_curso"));
  }
  /** Un intento (dentro del mutex): cierra como `interrumpido` / `reinicio` cada pendiente, sin reanudar nada. */
  private async intentarCierre(): Promise<number> {
    if (this.callado()) return this.pendientesCierre().length;
    let fallos = 0;
    for (const t of this.pendientesCierre()) {
      const id = t.manifiesto.id;
      try {
        let final = this.cierresEnMemoria.get(id);
        if (!final) {
          // Revisión Codex #3 · Un error de lectura anterior no se da por definitivo: se relee y se valida.
          if (t.error) {
            Object.assign(t, await this.leerInstantanea(await this.almacen(), id));
            if (t.error) throw new Error(t.error);
            if (t.instantanea && t.instantanea.estado !== "en_curso") continue; // ya estaba cerrada
          }
          const libro = t.libro ?? await this.leerLibro(await this.almacen(), id);
          if (!libro) throw new Error("libro de gasto ilegible");
          t.libro = libro;
          const base = t.instantanea ?? this.instantaneaInicial(t.manifiesto);
          final = this.validarInstantanea({ ...base, estado: "interrumpido", motivoFin: "reinicio", enCurso: null, finUtc: iso(this.ahora()), gasto: { ...base.gasto, conocidoMicroUsd: gastoConocido(libro) } });
        }
        await this.escribirP(`${id}.torneo.json`, JSON.stringify(final, null, 2) + "\n");
        t.instantanea = final; this.cierresEnMemoria.delete(id); this.cacheLectura.delete(id);
        this.log(`cierre de arranque: ${id} ${final.estado} (${final.motivoFin}) con ${final.encuentros.length} partidos`);
      } catch (error) {
        if (error instanceof ErrorSilencio) throw error;
        fallos++;
        const texto = mensaje(error);
        console.error(`[torneo-sitio] cierre de ${id} falló: ${texto}`);
        void import("../lib/telemetria").then(({ trazar }) => trazar("arena.torneo.cierre", { "arena.torneo.id": id, "arena.torneo.cierre_error": texto.slice(0, 200) }, async () => {})).catch(() => {});
      }
    }
    if (!this.pendientesCierre().length) { this.primerIntentoCierre = null; this.cierreAgotado = false; }
    return fallos;
  }
  private programarReintentoCierre(): void {
    if (this.callado() || !this.pendientesCierre().length) return;
    this.primerIntentoCierre ??= this.ahora();
    if (this.ahora() - this.primerIntentoCierre >= S.cierrePlazoMs) { this.cierreAgotado = true; this.log("cierre de arranque: plazo agotado; lanzamientos deshabilitados (motivo cierre)"); return; }
    this.programar(() => { void this.exclusiva(() => this.intentarCierre()).catch(() => {}).then(() => this.programarReintentoCierre()); }, S.cierreReintentoMs);
  }
  /** `POST …/cerrar` con token: un intento más, también tras agotar el plazo. */
  async cerrar(): Promise<{ pendientes: number }> {
    if (this.barrera || this.ultimoLatido === null) throw errorMotivo(this.ultimoLatido === null ? "iniciando" : "relevo");
    await this.exclusiva(async () => { if (!this.recargado) await this.recargar(); await this.intentarCierre(); });
    if (!this.pendientesCierre().length) this.cierreAgotado = false;
    return { pendientes: this.pendientesCierre().length };
  }

  // -------------------------------------------------------------------------------------------------
  // Instantáneas.
  // -------------------------------------------------------------------------------------------------
  private instantaneaInicial(m: Manifiesto): Torneo062 {
    const dia = m.creadoUtc.slice(0, 10), prueba = m.lanzamiento === "prueba", ensayo = m.tipo === "ensayo";
    const titulo = {
      es: `${prueba ? "Torneo de prueba del operador" : "Torneo del sitio"} · ${dia}${ensayo ? " · ensayo sin IA" : ""}`,
      en: `${prueba ? "Operator test tournament" : "Site tournament"} · ${dia}${ensayo ? " · rehearsal, no AI" : ""}`,
    };
    return {
      version: S.version, id: m.id, tipo: m.tipo, titulo, inicioUtc: m.creadoUtc, finUtc: null, commit: m.commit, motor: m.motor, duracionS: m.duracionS, intervaloS: m.intervaloS,
      semilla: m.semilla, participantes: m.participantes, pendientes: [], gasto: { conocidoMicroUsd: 0, tipicoMicroUsd: m.tipicoMicroUsd, topeMicroUsd: m.topeMicroUsd, reservaMaxPartidoMicroUsd: m.reservaMaxPartidoMicroUsd },
      formato: m.formato, origen: "sitio", lanzamiento: m.lanzamiento, estado: "en_curso", motivoFin: null, enCurso: null, encuentros: [],
    };
  }
  /** Esquema y coherencia cada vez que se escribe (§ 17.3). */
  private validarInstantanea(t: Torneo062): Torneo062 {
    const v = esquemaTorneo062.parse(t), errores = validarCoherencia(v);
    if (errores.length) throw new Error(`instantánea ${t.id} incoherente: ${errores.join("; ")}`);
    return v;
  }
  private async escribirInstantanea(a: Activo, t: Torneo062): Promise<void> {
    const v = this.validarInstantanea(t), texto = redactar(JSON.stringify(v, null, 2) + "\n", this.secretos());
    if (detectarSecretos(texto, this.secretos())) throw new Error("la instantánea conserva un secreto");
    await this.escribirP(`${a.id}.torneo.json`, texto);
    a.mem.instantanea = v; this.cacheLectura.delete(a.id);
  }
  private async anotar(a: Activo, m: MovimientoGasto): Promise<void> {
    const v = esquemaMovimiento.parse(m);
    // Conservador: una reserva cuenta desde antes de anexarla (un anexo ambiguo puede haberse aplicado).
    if (v.tipo === "reserva") a.mem.libro.push(v);
    await this.anexarP(`${a.id}.gasto.ndjson`, JSON.stringify(v) + "\n");
    if (v.tipo === "cierre") a.mem.libro.push(v);
  }
  private secretos(): string[] {
    const env = this.env, s: string[] = [];
    if (env.AZURE_OPENAI_API_KEY) s.push(env.AZURE_OPENAI_API_KEY);
    if (env.ARENA_ADMIN_TOKEN) s.push(env.ARENA_ADMIN_TOKEN);
    for (const url of [env.AZURE_OPENAI_ENDPOINT, env.FOUNDRY_BASE_URL]) { try { if (url) { const h = new URL(url).hostname; s.push(h, h.split(".")[0]!); } } catch { /* sin host */ } }
    return s;
  }

  // -------------------------------------------------------------------------------------------------
  // Estado (GET) y motivos.
  // -------------------------------------------------------------------------------------------------
  private bolsaConocida(): number | null {
    if (!this.recargado) return null;
    let total = 0;
    for (const t of this.torneos.values()) {
      if (t.manifiesto.tipo !== "real") continue;
      if (!t.libro) return null;
      total += gastoConocido(t.libro);
    }
    return total;
  }
  private motivoEjecucion(dia: string, formato: FormatoTorneo = "liga"): MotivoSitio | null {
    if (this.callado()) return "desactivado";
    if (this.ultimoLatido === null) return "iniciando";
    if (this.barrera) return "relevo";
    if (this.cierreAgotado) return "cierre";
    if (this.activo || this.pendientesCierre().length) return "activo";
    if (this.torneos.has(idDelDia(dia))) return "cupo";
    const conocido = this.bolsaConocida();
    if (conocido !== null && conocido + topeFormatoMicroUsd(formato) > S.bolsaUsd * 1_000_000) return "bolsa";
    return null;
  }
  estado(): EstadoSitio {
    const cfg = this.config(), ahora = this.ahora(), dia = diaUtc(ahora);
    const motivo = cfg.motivo ?? (catalogoCompleto(this.participantes(cfg), this.env) || cfg.ensayo ? null : "catalogo") ?? this.motivoEjecucion(dia);
    const enCurso = this.activo?.id ?? this.pendientesCierre()[0]?.manifiesto.id ?? null;
    const hoy = this.torneos.get(idDelDia(dia))?.manifiesto;
    const entradas = this.entradasDe(cfg);
    return {
      habilitado: motivo === null, motivo, diaUtc: dia, proximoCupoUtc: proximoCupoUtc(ahora),
      activo: enCurso ? { id: enCurso } : null, hoy: hoy ? { id: hoy.id, formato: hoy.formato } : null,
      bolsa: { conocidoMicroUsd: this.bolsaConocida(), bolsaMicroUsd: S.bolsaUsd * 1_000_000 },
      formatos: Object.fromEntries(FORMATOS_TORNEO.map(f => [f, estimarFormato(f, entradas, cfg.duracionS)])) as Record<FormatoTorneo, FichaFormato>,
    };
  }

  // -------------------------------------------------------------------------------------------------
  // Admisión (§ 6.3 con § 17.1, § 17.2, § 17.7, § 18.4): todo dentro del mutex, con una sola captura del reloj.
  // -------------------------------------------------------------------------------------------------
  async lanzar(p: { formato: FormatoTorneo; prueba: boolean }): Promise<{ id: string }> {
    const cfg = this.config();
    if (cfg.motivo) throw errorMotivo(cfg.motivo);
    const participantes = this.participantes(cfg);
    if (!cfg.ensayo && !catalogoCompleto(participantes, this.env)) throw errorMotivo("catalogo");
    if (!FORMATOS_DISPONIBLES.includes(p.formato)) throw new ErrorSitio("Este formato estará disponible pronto.", 422, "formato");
    const entradas = this.entradasDe(cfg), ficha = estimarFormato(p.formato, entradas, cfg.duracionS);
    if (ficha.tipicoMicroUsd.maxConDesempates > ficha.topeMicroUsd) throw new ErrorSitio("El típico del formato no cabe en su tope.", 503, "desactivado");
    return this.exclusiva(async () => {
      const ahora = this.ahora(), dia = diaUtc(ahora);
      if (this.callado()) throw errorMotivo("desactivado");
      if (this.ultimoLatido === null) throw errorMotivo("iniciando");
      if (this.barrera) throw errorMotivo("relevo");
      try { this.exigirVigencia(); } catch { throw errorMotivo("desactivado"); }
      // § 17.7 · Libros ilegibles: se rechaza la admisión (nunca equivalen a gasto cero).
      if (!this.recargado || this.bolsaConocida() === null) {
        try { await this.recargar(); } catch (error) { this.log(`relectura: ${mensaje(error)}`); throw new ErrorSitio("No se pudo comprobar el presupuesto.", 503, "bolsa_ilegible"); }
        if (this.bolsaConocida() === null) throw new ErrorSitio("No se pudo comprobar el presupuesto.", 503, "bolsa_ilegible");
      }
      // Un torneo activo (en memoria o una instantánea `en_curso` sin cerrar) bloquea, SIEMPRE antes de crear `dia-`.
      if (this.activo || this.pendientesCierre().length) throw errorMotivo(this.cierreAgotado && !this.activo ? "cierre" : "activo");
      if (!p.prueba && this.torneos.has(idDelDia(dia))) throw errorMotivo("cupo");
      const conocido = this.bolsaConocida()!;
      if (conocido + ficha.topeMicroUsd > S.bolsaUsd * 1_000_000) throw errorMotivo("bolsa");
      let id = idDelDia(dia);
      if (p.prueba) do { id = `${PREFIJO_PRUEBA}${(this.deps.uuid ?? randomUUID)().replace(/-/g, "").slice(0, 12)}`; } while (this.torneos.has(id));
      const ids = participantes.map(x => x.id), semilla = semillaDelDia(dia), rondas = rondasPartido(cfg.duracionS, S.intervaloS);
      const plan = planTorneo(p.formato, ids, semilla, { encuentros: [], pendientes: [] });
      const precio = (pid: string) => participantes.find(x => x.id === pid)!.precio;
      const manifiesto = esquemaManifiesto.parse({
        version: S.version, id, formato: p.formato, tipo: cfg.ensayo ? "ensayo" : "real", lanzamiento: p.prueba ? "prueba" : "publico", participantes, semilla,
        duracionS: cfg.duracionS, intervaloS: S.intervaloS, motor: { version: ARENA.version, reglas: ARENA.reglas }, commit: cfg.commit!,
        topeMicroUsd: ficha.topeMicroUsd, tipicoMicroUsd: ficha.tipicoMicroUsd.max, // En grupos las llaves dependen de los resultados: la reserva máxima es la de cualquier pareja (la de la ficha).
        reservaMaxPartidoMicroUsd: Math.max(ficha.reservaMaxPartidoMicroUsd, ...plan.map(x => reservaPartido({ local: precio(x.local), visita: precio(x.visita) }, entradas.promptMax.tokens, rondas))),
        promptMax: entradas.promptMax.tokens, operacion: (this.deps.uuid ?? randomUUID)(), creadoUtc: iso(ahora),
      } satisfies Manifiesto);
      // 1. Punto de confirmación (§ 17.2): el manifiesto con `nuevo: true`. Respuesta perdida ⇒ se relee.
      const nombre = nombreManifiesto(manifiesto);
      try { await this.escribirP(nombre, JSON.stringify(manifiesto, null, 2) + "\n", true); }
      catch (error) {
        if (error instanceof ErrorSilencio) throw errorMotivo("desactivado");
        let existente: Manifiesto;
        try { existente = esquemaManifiesto.parse(JSON.parse(await (await this.almacen()).leer(nombre))); }
        catch { throw new ErrorSitio("No se pudo confirmar el lanzamiento; el cupo de hoy puede haberse consumido.", 503, "confirmacion"); }
        if (existente.operacion !== manifiesto.operacion) {
          this.torneos.set(existente.id, { manifiesto: existente, instantanea: null, libro: await this.leerLibro(await this.almacen(), existente.id), error: null });
          throw errorMotivo("cupo");
        }
      }
      const mem = { manifiesto, instantanea: this.instantaneaInicial(manifiesto), libro: [] as MovimientoGasto[], error: null };
      const activo: Activo = { id, mem, abort: new AbortController(), causa: null, promesa: Promise.resolve() };
      this.torneos.set(id, mem);
      // 2. Primera instantánea (`en_curso`, 0 partidos). Si falla, se cierra en memoria con 0 partidos.
      try { await this.escribirInstantanea(activo, mem.instantanea); }
      catch (error) {
        this.log(`primera instantánea de ${id}: ${mensaje(error)}`);
        mem.instantanea = this.validarInstantanea({ ...mem.instantanea, estado: "interrumpido", motivoFin: "almacen", finUtc: iso(this.ahora()) });
        this.cierresEnMemoria.set(id, mem.instantanea);
        if (!(error instanceof ErrorSilencio)) this.programarReintentoCierre();
        throw new ErrorSitio("No se pudo iniciar el torneo; el cupo de hoy queda consumido.", 503, "almacen");
      }
      this.activo = activo;
      this.log(`admitido ${id} (${p.formato}, ${manifiesto.tipo}, ${manifiesto.lanzamiento}); bolsa conocida ${conocido} µUSD`);
      activo.promesa = this.correr(activo).catch(error => this.log(`bucle de ${id}: ${mensaje(error)}`));
      return { id };
    });
  }

  // -------------------------------------------------------------------------------------------------
  // Bucle (§ 6.4 con § 17.2): commit + decisión del siguiente en una sola sección del mutex, de modo que el
  // último cierre del libro, la instantánea final y la liberación del activo ocurren juntos (S9b).
  // -------------------------------------------------------------------------------------------------
  private async correr(a: Activo): Promise<void> {
    const m = a.mem.manifiesto, ids = m.participantes.map(x => x.id), signal = a.abort.signal, cfg = this.config();
    const marco = { duracionS: m.duracionS, intervaloS: m.intervaloS, motor: m.motor };
    const precio = (id: string) => m.participantes.find(x => x.id === id)!.precio;
    const rondas = rondasPartido(m.duracionS, m.intervaloS);
    const reservaDe = (p: EncuentroPlan062) => reservaPartido({ local: precio(p.local), visita: precio(p.visita) }, m.promptMax, rondas);
    const siguiente = () => siguientePartido(m.formato, ids, m.semilla, a.mem.instantanea);
    const intentosDe = (n: number) => a.mem.libro.filter(x => x.n === n && x.tipo === "reserva").length;
    const crear = this.fabricaControladores(cfg);
    let seguidos = 0, largoUsado = false;
    type Paso = { tipo: "fin" } | { tipo: "jugar"; plan: EncuentroPlan062; intento: number; reserva: number } | { tipo: "esperar"; ms: number };
    try {
      while (true) {
        // A. Inicio de un partido (mutex): cancelación, plazo, siguiente, tope, instantánea con `enCurso` y reserva.
        const inicio: Paso = await this.exclusiva(async (): Promise<Paso> => {
          if (this.callado()) return { tipo: "fin" };
          if (a.causa === "cancelado") return this.cerrarFinal(a, { estado: "cancelado", motivoFin: "cancelado" });
          if (this.ahora() - Date.parse(a.mem.instantanea.inicioUtc) > S.plazoTotalMs) return this.cerrarFinal(a, { estado: "incompleto", motivoFin: "plazo" });
          const p = siguiente();
          if (!p) return this.cerrarFinal(a, a.mem.instantanea.pendientes.length ? { estado: "incompleto", motivoFin: "infraestructura" } : { estado: "completo", motivoFin: null });
          const reserva = reservaDe(p), conocido = gastoConocido(a.mem.libro);
          // § 5.2 · Nunca empieza un partido cuya reserva no cabe: en el sitio no hay quien suba el tope.
          if (conocido + reserva > m.topeMicroUsd) return this.cerrarFinal(a, { estado: "incompleto", motivoFin: "tope" });
          const intento = 1 + Math.max(0, ...a.mem.libro.filter(x => x.n === p.n).map(x => x.intento));
          await this.escribirInstantanea(a, { ...a.mem.instantanea, enCurso: { n: p.n, local: p.local, visita: p.visita, inicioUtc: iso(this.ahora()) } });
          await this.anotar(a, { n: p.n, intento, tipo: "reserva", microUsd: reserva });
          return { tipo: "jugar", plan: p, intento, reserva };
        });
        if (inicio.tipo !== "jugar") return;
        // B. El partido, fuera del mutex (ritmo de reloj, inferencia protegida por el latido).
        const r = await this.jugar(a, inicio.plan, inicio.intento, marco, crear, cfg);
        // C. Commit del resultado y, si no hay siguiente, cierre final en la MISMA sección.
        const paso: Paso = await this.exclusiva(async (): Promise<Paso> => {
          if (this.callado()) return { tipo: "fin" };
          const { plan: p, intento, reserva } = inicio;
          if (r.resultado === "valido") {
            const e062 = { ...r.encuentro, fase: p.fase, desempate: p.desempate };
            validarMetadatos062(e062, p);
            const gz = `${a.id}.${archivoEncuentro(p.n)}`;
            // Primero el ejecutor y después los bytes (el .gz es el punto de confirmación); se relee y se compara la huella.
            await this.escribirP(`${a.id}.${ejecutorEncuentro(p.n)}`, JSON.stringify(r.ejecutor, null, 2) + "\n");
            await this.bytesP(gz, r.gz);
            if (sha256(await (await this.almacen()).leerBytes(gz)) !== r.encuentro.archivoSha256) throw new Error(`P${p.n}: el .gz releído no tiene la huella declarada`);
            await this.anotar(a, { n: p.n, intento, tipo: "cierre", microUsd: r.costoMicroUsd, resultado: "valido" });
            seguidos = 0;
            await this.escribirInstantanea(a, { ...a.mem.instantanea, enCurso: null, encuentros: [...a.mem.instantanea.encuentros, e062], gasto: { ...a.mem.instantanea.gasto, conocidoMicroUsd: gastoConocido(a.mem.libro) } });
            this.log(`${a.id} P${p.n} ${r.encuentro.local.goles}–${r.encuentro.visita.goles} (coste declarado ${r.costoMicroUsd} µUSD)`);
          } else if (r.resultado === "anulado") {
            await this.anotar(a, { n: p.n, intento, tipo: "cierre", microUsd: r.costoMicroUsd, resultado: "anulado" });
            seguidos++;
            const agotado = intentosDe(p.n) >= 1 + T.repeticionesMax;
            await this.escribirInstantanea(a, { ...a.mem.instantanea, enCurso: null, pendientes: agotado ? [...a.mem.instantanea.pendientes, p.n] : a.mem.instantanea.pendientes, gasto: { ...a.mem.instantanea.gasto, conocidoMicroUsd: gastoConocido(a.mem.libro) } });
            this.log(`${a.id} P${p.n} anulado por infraestructura (${r.causas.join("; ")})${agotado ? "; queda pendiente" : ""}`);
            const hay = siguiente();
            if (!hay) return this.cerrarFinal(a, { estado: "incompleto", motivoFin: "infraestructura" });
            if (seguidos >= T.anuladosSeguidosMax) {
              if (largoUsado) return this.cerrarFinal(a, { estado: "incompleto", motivoFin: "infraestructura" });
              largoUsado = true; seguidos = 0;
              return { tipo: "esperar", ms: S.enfriamientoLargoMs };
            }
            return { tipo: "esperar", ms: !agotado && seguidos === T.anuladosSeguidosMax - 1 ? T.enfriamientoMs : T.pausaEntrePartidosMs };
          } else if (r.resultado === "interrumpido") {
            await this.anotar(a, { n: p.n, intento, tipo: "cierre", microUsd: r.costoMicroUsd, resultado: "interrumpido" });
            if (a.causa === "cancelado") return this.cerrarFinal(a, { estado: "cancelado", motivoFin: "cancelado" });
            return this.cerrarFinal(a, { estado: "incompleto", motivoFin: "infraestructura" });
          } else {
            // Un defecto (validación, secreto, controlador equivocado): se cierra con la reserva y termina.
            await this.anotar(a, { n: p.n, intento, tipo: "cierre", microUsd: reserva, resultado: "fallo" });
            this.log(`${a.id} P${p.n}: ${mensaje(r.error)}`);
            return this.cerrarFinal(a, { estado: "incompleto", motivoFin: "infraestructura" });
          }
          if (!siguiente()) return this.cerrarFinal(a, a.mem.instantanea.pendientes.length ? { estado: "incompleto", motivoFin: "infraestructura" } : { estado: "completo", motivoFin: null });
          return { tipo: "esperar", ms: T.pausaEntrePartidosMs };
        });
        if (paso.tipo === "fin") return;
        // D. Pausa o enfriamiento, fuera del mutex; la cancelación la corta (la sección A la cierra).
        if (paso.tipo === "esperar") { try { await this.dormir(paso.ms, signal); } catch { /* abortada: la sección A decide */ } }
      }
    } catch (error) {
      if (this.callado() || error instanceof ErrorSilencio) return;
      // § 17.2 · Cualquier escritura fallida (incluido un anexo ambiguo) detiene el torneo: `interrumpido` / `almacen`.
      this.log(`${a.id} detenido por el almacén: ${mensaje(error)}`);
      await this.exclusiva(() => this.cerrarFinal(a, { estado: "interrumpido", motivoFin: "almacen" }, true)).catch(() => {});
    }
  }
  /** Cierre final (siempre dentro del mutex): instantánea final con el gasto conocido y liberación del activo. */
  private async cerrarFinal(a: Activo, fin: Fin, tolerante = false): Promise<{ tipo: "fin" }> {
    const base = a.mem.instantanea;
    const final = this.validarInstantanea({ ...base, estado: fin.estado, motivoFin: fin.motivoFin, enCurso: null, finUtc: iso(this.ahora()), gasto: { ...base.gasto, conocidoMicroUsd: gastoConocido(a.mem.libro) } });
    try { await this.escribirInstantanea(a, final); }
    catch (error) {
      if (!tolerante || error instanceof ErrorSilencio) throw error;
      // Lo escribirá el reintento de cierre (o el arranque siguiente, como `reinicio`).
      this.cierresEnMemoria.set(a.id, final); a.mem.instantanea = final;
      this.programarReintentoCierre();
    }
    if (this.activo === a) this.activo = null;
    this.log(`${a.id} ${final.estado}${final.motivoFin ? ` (${final.motivoFin})` : ""}: ${final.encuentros.length} partidos; gasto conocido ${final.gasto.conocidoMicroUsd} µUSD`);
    return { tipo: "fin" };
  }
  private async jugar(a: Activo, plan: EncuentroPlan062, intento: number, marco: { duracionS: number; intervaloS: number; motor: Torneo062["motor"] }, crear: CrearControlador, cfg: ConfigSitio): Promise<ResultadoEncuentro | { resultado: "fallo"; costoMicroUsd: number; error: unknown }> {
    const signal = a.abort.signal, base = this.deps.fetch ?? fetch;
    let inicioRonda = this.ahora();
    // § 19.2 · Antes de cada solicitud de inferencia, el latido tiene que estar vigente.
    const fetchProtegido = ((url: string | URL | Request, init?: RequestInit) => { try { this.exigirVigencia(); } catch (error) { return Promise.reject(error); } return base(url, init); }) as typeof fetch;
    try {
      return await jugarEncuentro({
        plan, participantes: a.mem.manifiesto.participantes, marco, intento, crearControlador: crear, fetch: fetchProtegido, promptMax: a.mem.manifiesto.promptMax, secretos: this.secretos(),
        signal, ...(this.deps.esperaMs !== undefined ? { esperaMs: this.deps.esperaMs } : {}),
        alPublicar: async publicacion => {
          if (publicacion.tipo === "esperando") { this.exigirVigencia(); inicioRonda = this.ahora(); }
          // D12 · Cada ronda dura al menos `intervaloS` de reloj, sin tocar `tiempoMs` (la espera va después de decidir).
          else if (publicacion.tipo === "ronda" && cfg.ritmo) { const resta = inicioRonda + marco.intervaloS * 1000 - this.ahora(); if (resta > 0) await this.dormir(resta, signal); }
        },
      });
    } catch (error) {
      if (signal.aborted) return { resultado: "interrumpido", costoMicroUsd: 0 };
      return { resultado: "fallo", costoMicroUsd: 0, error };
    }
  }
  private fabricaControladores(cfg: ConfigSitio): CrearControlador {
    if (this.deps.crearControlador) return this.deps.crearControlador;
    if (cfg.ensayo) return p => ({ id: p.controlador, tipo: "programado", async decidir(obs) { return planProgramado(obs); } });
    const env = this.env, fabrica = fabricaLlmReal({ apiKey: env.AZURE_OPENAI_API_KEY ?? "", endpointAzureOpenAI: env.AZURE_OPENAI_ENDPOINT ?? "", baseFoundry: env.FOUNDRY_BASE_URL ?? null });
    return (p, transporte) => crearControladorLlm(fabrica(especDe(p), transporte));
  }

  // -------------------------------------------------------------------------------------------------
  // Administración (§ 17.6): token, cancelación.
  // -------------------------------------------------------------------------------------------------
  /** `timingSafeEqual` sobre los sha256; los fallos tienen un limitador global por hora. */
  verificarAdmin(autorizacion: string | null): void {
    const token = this.config().token;
    if (!token) throw errorMotivo("cancelacion");
    const ahora = this.ahora();
    this.fallosAdmin = this.fallosAdmin.filter(t => ahora - t < S.admision.ventanaMs);
    if (this.fallosAdmin.length >= S.admin.fallosPorHora) throw new ErrorSitio("Demasiados intentos de administración; espera.", 429, null, Math.ceil((this.fallosAdmin[0]! + S.admision.ventanaMs - ahora) / 1000));
    const m = /^Bearer ([^\s]+)$/.exec(autorizacion ?? "");
    const h = (x: string) => createHash("sha256").update(x).digest();
    if (!m || !timingSafeEqual(h(m[1]!), h(token))) { this.fallosAdmin.push(ahora); throw new ErrorSitio("Token de administración inválido.", 401); }
  }
  async cancelar(): Promise<{ id: string; estado: Torneo062["estado"] }> {
    const a = await this.exclusiva(async () => {
      if (!this.activo) throw new ErrorSitio("No hay ningún torneo en curso.", 404);
      this.activo.causa = "cancelado"; this.activo.abort.abort();
      return this.activo;
    });
    await a.promesa;
    return { id: a.id, estado: a.mem.instantanea.estado };
  }

  // -------------------------------------------------------------------------------------------------
  // Lectura (rutas [id] y [archivo]): sin escrituras; la del torneo activo vive en memoria.
  // -------------------------------------------------------------------------------------------------
  async leer(id: string): Promise<{ estado: "ok"; torneo: Torneo062 } | { estado: "incoherente" } | null> {
    if (!ID_SITIO.test(id)) return null;
    if (this.activo?.id === id) return { estado: "ok", torneo: this.activo.mem.instantanea };
    const ahora = this.ahora(), cache = this.cacheLectura.get(id);
    let valor: Torneo062 | "incoherente" | null;
    if (cache && cache.hasta > ahora) valor = cache.valor;
    else {
      try {
        const t = esquemaTorneoCualquiera.parse(JSON.parse(await (await this.almacen()).leer(`${id}.torneo.json`)));
        valor = t.version === S.version && t.id === id && !validarCoherencia(t).length ? t : "incoherente";
      } catch (error) { valor = noExiste(error) ? null : "incoherente"; }
      // Las instantáneas `en_curso` de otro proceso no se cachean (pueden cerrarse en cualquier momento).
      if (!(valor && valor !== "incoherente" && valor.estado === "en_curso")) this.cacheLectura.set(id, { hasta: ahora + 60_000, valor });
    }
    // La promoción al repositorio (servir desde public/torneos) es P2.
    if (valor === null) return null;
    return valor === "incoherente" ? { estado: "incoherente" } : { estado: "ok", torneo: valor };
  }
  /** `archivo` debe cumplir `^e\d{2}\.json\.gz$` Y estar en `encuentros`; el nombre leído sale del manifiesto. */
  async leerArchivo(id: string, archivo: string): Promise<Uint8Array | null> {
    if (!/^e\d{2}\.json\.gz$/.test(archivo)) return null;
    const l = await this.leer(id);
    if (!l || l.estado !== "ok") return null;
    const e = l.torneo.encuentros.find(x => x.archivo === archivo);
    if (!e) return null;
    let bytes: Uint8Array;
    try { bytes = await (await this.almacen()).leerBytes(`${id}.${archivoEncuentro(e.n)}`); } catch (error) { if (noExiste(error)) return null; throw error; }
    if (sha256(bytes) !== e.archivoSha256) throw new ErrorSitio("El registro guardado no coincide con su huella.", 409);
    return bytes;
  }
  /** Torneos del sitio guardados (para la lista de la página), del más reciente al más antiguo; caché de 60 s. */
  private cacheLista: { hasta: number; valor: Torneo062[] } | null = null;
  async listarTorneosSitio(): Promise<Torneo062[]> {
    const ahora = this.ahora();
    if (this.cacheLista && this.cacheLista.hasta > ahora) return this.cacheLista.valor;
    const ids = (await (await this.almacen()).listar()).filter(n => n.endsWith(".torneo.json")).map(n => n.slice(0, -".torneo.json".length)).filter(x => ID_SITIO.test(x));
    const torneos: Torneo062[] = [];
    for (const id of ids) { const l = await this.leer(id); if (l?.estado === "ok") torneos.push(l.torneo); }
    torneos.sort((x, y) => y.inicioUtc.localeCompare(x.inicioUtc) || x.id.localeCompare(y.id));
    this.cacheLista = { hasta: ahora + 60_000, valor: torneos };
    return torneos;
  }
  /** Solo pruebas: espera a que termine el torneo activo (si lo hay). */
  async esperarActivo(): Promise<void> { await this.activo?.promesa; }
  get idActivo(): string | null { return this.activo?.id ?? null; }
}

const mensaje = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 300);

const compartido = globalThis as typeof globalThis & { __cronistaTorneoSitio?: GestorTorneoSitio };
/** Un gestor por proceso (las pruebas crean los suyos). */
export function gestorTorneoSitio(): GestorTorneoSitio { return compartido.__cronistaTorneoSitio ??= new GestorTorneoSitio(); }
/** Si este proceso debe mantener el latido y el cierre de arranque (interruptor encendido o almacén de producción). */
export const debeIniciarGestor = (env: Env = process.env) => env.ARENA_TORNEO_SITIO === "1" || !!env.ARENA_BLOB_ENDPOINT;

// ---------------------------------------------------------------------------------------------------
// HTTP (§ 17.7): origen completo, clave del limitador y lectura acotada con plazo.
// ---------------------------------------------------------------------------------------------------
/** El ÚLTIMO salto de x-forwarded-for (el que añade el ingreso de Container Apps); el primero lo controla el cliente. */
export function claveLimitador(xff: string | null): string {
  const saltos = (xff ?? "").split(",").map(x => x.trim()).filter(Boolean);
  return saltos.at(-1) ?? "desconocida";
}
export function origenCoincide(origin: string | null, esperado: string): boolean {
  if (!origin) return false;
  try { return new URL(origin).origin === esperado; } catch { return false; }
}
/** Lectura incremental con tope de bytes (413) y plazo (408); JSON inválido o vacío ⇒ 400. */
export async function leerCuerpoAcotado(req: Request, maxBytes: number, plazoMs: number): Promise<unknown> {
  if (!req.body) throw new ErrorSitio("Petición vacía", 400);
  const lector = req.body.getReader(), partes: Uint8Array[] = [];
  let bytes = 0, temporizador: ReturnType<typeof setTimeout> | undefined;
  const plazo = new Promise<never>((_, rechazar) => { temporizador = setTimeout(() => rechazar(new ErrorSitio("La petición tardó demasiado", 408)), plazoMs); });
  try {
    while (true) {
      const { done, value } = await Promise.race([lector.read(), plazo]);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new ErrorSitio("Petición demasiado grande", 413);
      partes.push(value);
    }
  // Revisión Codex #4 · La cancelación se lanza sin esperarla: un flujo cuya cancelación no termina no retiene la
  // respuesta (408/413) ni la plaza del limitador, que la ruta libera en su `finally`.
  // Brief 071 (revisión Codex, ronda 3) · Se lanza YA, antes de que el `finally` suelte el bloqueo: diferida a una
  // microtarea fallaba en silencio (lector ya liberado) y el flujo nunca se cancelaba.
  } catch (error) { try { void lector.cancel(error).catch(() => {}); } catch { /* ya liberado o cerrado */ } throw error; }
  finally { clearTimeout(temporizador); try { lector.releaseLock(); } catch { /* cancelado */ } }
  try { return JSON.parse(Buffer.concat(partes).toString("utf8")) as unknown; }
  catch { throw new ErrorSitio(bytes ? "JSON inválido" : "Petición vacía", 400); }
}
export const esquemaPeticionLanzar = z.strictObject({ formato: z.enum(FORMATOS_TORNEO) });
export function respuestaErrorSitio(error: unknown): Response {
  if (esErrorSitio(error)) {
    return Response.json({ error: error.message, motivo: error.motivo }, { status: error.status, headers: { "cache-control": "no-store", ...(error.reintentarS ? { "retry-after": String(Math.max(1, error.reintentarS)) } : {}) } });
  }
  console.error(`[torneo-sitio] ${mensaje(error)}`);
  return Response.json({ error: "No se pudo completar la operación del torneo." }, { status: 500, headers: { "cache-control": "no-store" } });
}
