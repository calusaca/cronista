// Brief 064 § 4.1, § 4.5, § 4.6 y § 4.8 · Servicio de la crónica verificada de un partido de la arena.
//
// POST (generar): fuente → registro validado + origen → huella → almacén (registro, origen, índice) → crónica válida y
// no provisional guardada (cero llamadas) | generación en curso de la huella (se espera) | selección de hechos →
// sin redactor, sin cupo o sin caber: acta provisional/definitiva | reserva (cupo + `<h>.reserva.json`, ANTES de llamar)
// → `redactarYVerificar` (≤ 1 + MAX_REINTENTOS llamadas, plazos, maxTokens, esquema) → guardar → respuesta.
// GET (leer): lee, recalcula la selección y re-verifica; nunca genera ni escribe (I7, I9).
//
// Supuesto declarado (D-7): una réplica. El cupo y la exclusión viven en el proceso y en el almacén.
import type { CronicaDraft, CronicaVerificada, Motivo } from "../cadena/tipos";
import { hashHechos } from "../cadena/cache";
import { redactarYVerificar } from "../cadena/cadena";
import { borradorActa } from "../cadena/acta";
import { feedback } from "../cadena/prompt";
import { MAX_REINTENTOS } from "../cadena/umbrales";
import type { Hecho } from "../analista/tipos";
import { conPresupuesto, crearLlmDesdeEnv, type Llm, type UsoLlm } from "../lib/llm";
import { trazar } from "../lib/telemetria";
import { CRONICA_ARENA } from "../sim/limites";
import { etiquetaLlm } from "../vista/servidor";
import type { AlmacenTorneos } from "./almacen-torneos";
import catalogoPublico from "./catalogo-publico.json";
import { archivosCronica, comprimirRegistro, crearSiNoExiste, diaUtc, existeRegistro, huellaRegistro, almacenCronicasDesdeEnv, jsonEstable, leerJsonAlmacen, leerRegistroGuardado, LibroDiario } from "./cronica-almacen";
import { ErrorClienteMcp, hechosPorMcp, type MotivoRespaldoMcp } from "../mcp/cliente";
import { resolverFuente, ErrorCronica, depsFuentesReales, type DepsFuentes } from "./cronica-fuentes";
import { seleccionCronicaArena, SISTEMA_CRONICA_ARENA, type HechoCronicaArena } from "./cronica-hechos";
import { reglasTiempoArena, verificarCronicaArena } from "./cronica-verificador";
import { urlCronica, type FuenteCronica, type OrigenCronica } from "./cronica-vista";
import { catalogoModelos } from "./modelos";
import { nombreControlador } from "./modelos-jugados";
import { enteroPositivoEnv } from "./sesiones";
import type { RegistroArena } from "./tipos";

export { SISTEMA_CRONICA_ARENA };
type Env = Record<string, string | undefined>;

/** § 4.6 · Por qué una crónica es un acta. Todas menos `rechazos` y `tamano` son provisionales. */
export type MotivoActa = "desactivado" | "redactor" | "cupo" | "error" | "abandonada" | "rechazos" | "tamano";
export const ACTA_DEFINITIVA: readonly MotivoActa[] = ["rechazos", "tamano"];

export interface RedactorGuardado { id: string; etiqueta: string; fixture: boolean }
/** § 4.7 · Contenido de `<h>.cronica.json`. */
export interface ArchivoCronica {
  version: string; analista: string; huella: string; hashHechos: string; generadaUtc: string;
  redactor: RedactorGuardado | null; provisional: boolean; motivoActa?: MotivoActa;
  /** Uso informado por el proveedor (si lo informa). */
  uso?: UsoLlm;
  /** Brief 071 · Cómo obtuvo el cronista los hechos: su cliente MCP o la llamada directa (respaldo, con el motivo). Las
   * guardadas antes del 071 no lo tienen. */
  hechosVia?: "mcp" | "directo";
  hechosViaMotivo?: MotivoRespaldoMcp;
  cronica: CronicaVerificada;
}
type ViaHechos = Pick<ArchivoCronica, "hechosVia" | "hechosViaMotivo">;
export type EstadoCronica = "lista" | "sin-cronica" | "invalida" | "desactualizada";
export interface RespuestaCronica { huella: string; url: string; modo: "llm" | "acta"; provisional: boolean; motivoActa?: MotivoActa; desdeAlmacen: boolean }
export interface LecturaCronica {
  huella: string; origen: OrigenCronica | null; estado: EstadoCronica;
  /** Solo con `estado: "lista"` (I9: nada sin verificar se muestra). */
  archivo?: ArchivoCronica;
  registro: RegistroArena; hechos: HechoCronicaArena[];
}

export { urlCronica };
/** § 4.8 · Cupo efectivo de generaciones con modelo por día UTC (leído en cada uso). */
export const cupoDiarioCronicas = () => enteroPositivoEnv("ARENA_CRONICA_DIARIA", CRONICA_ARENA.diarias);

/** § 4.5 · Esquema de salida (patrón de `esquemaNarracionArena`): ids en `enum`, `apoyo` obligatorio, ≤ hechos.length oraciones. */
export function esquemaCronicaArena(hechos: readonly { id: string }[]): Record<string, unknown> {
  const ids = hechos.map((h) => h.id);
  return {
    type: "object", additionalProperties: false, required: ["titulo_es", "titulo_en", "oraciones"],
    properties: {
      titulo_es: { type: "string" }, titulo_en: { type: "string" },
      oraciones: { type: "array", minItems: 1, maxItems: Math.max(1, ids.length), items: {
        type: "object", additionalProperties: false, required: ["texto_es", "texto_en", "hecho", "apoyo"],
        properties: { texto_es: { type: "string" }, texto_en: { type: "string" }, hecho: { type: "string", enum: ids }, apoyo: { type: "array", items: { type: "string", enum: ids } } },
      } },
    },
  };
}

/** § 4.5.2 · `feedback(motivos)` truncado a maxCaracteresFeedback, cortando por línea y terminando con «- … y N motivos más.». */
export function feedbackAcotado(motivos: Motivo[], max: number = CRONICA_ARENA.maxCaracteresFeedback): string {
  const completo = feedback(motivos);
  if (completo.length <= max) return completo;
  const lineas = completo.split("\n");
  const cabecera = lineas[0]!, pie = lineas.at(-1)!, cuerpo = lineas.slice(1, -1);
  const resto = (n: number) => `- … y ${n} motivos más.`;
  let usadas = 0;
  let largo = cabecera.length + 1 + pie.length;
  while (usadas < cuerpo.length && largo + cuerpo[usadas]!.length + 1 + resto(cuerpo.length - usadas - 1).length + 1 <= max) { largo += cuerpo[usadas]!.length + 1; usadas++; }
  const salida = [cabecera, ...cuerpo.slice(0, usadas), resto(cuerpo.length - usadas), pie].join("\n");
  return salida.length <= max ? salida : salida.slice(0, max);
}

/** § 4.5.3 · Cota de la conversación en caracteres (system + mensajes + esquema). */
export const cotaConversacion = () => CRONICA_ARENA.maxCaracteresEntrada + CRONICA_ARENA.maxCaracteresEsquema + 2 * (CRONICA_ARENA.maxCaracteresFeedback + CRONICA_ARENA.maxCaracteresRespuesta);

const catalogo = catalogoPublico as { nombre: string; modelo: string; nombrePublico: string; publicar?: boolean }[];
/** § 4.6 · Rótulo del redactor: el de `/match` (stub, ensayo) y, para modelos reales, el nombre público del catálogo. */
export function etiquetaRedactor(id: string): RedactorGuardado {
  const base = etiquetaLlm(id);
  if (id.startsWith("azure-openai:")) return { id, etiqueta: `${nombreControlador(id, catalogo)} · Azure OpenAI`, fixture: false };
  if (id.startsWith("foundry:") || id.startsWith("foundry-modelos:")) return { id, etiqueta: `${nombreControlador(id, catalogo)} · Microsoft Foundry`, fixture: false };
  return { id, ...base };
}

/** D9 · El redactor del entorno, o el motivo por el que no hay. `crear` sustituye la construcción (pruebas). */
export function crearRedactor(env: Env, crear?: () => Llm): { llm: Llm } | { motivo: "desactivado" | "redactor" } {
  if (env.ARENA_CRONICA_LLM?.trim() !== "1") return { motivo: "desactivado" };
  try {
    if (crear) return { llm: crear() };
    const modelo = env.ARENA_CRONICA_MODELO?.trim();
    if (modelo) {
      const entrada = catalogoModelos(env).find((m) => m.publico.id === modelo);
      if (!entrada) { console.warn(`CRONISTA: ARENA_CRONICA_MODELO=${modelo} no está en el catálogo; la crónica será un acta`); return { motivo: "redactor" }; }
      return { llm: entrada.crear() };
    }
    return { llm: crearLlmDesdeEnv(env, { maxRetries: 0 }) };
  } catch (error) {
    console.warn("CRONISTA: no se pudo crear el redactor de la crónica de arena", { tipo: error instanceof Error ? error.name : "Error" });
    return { motivo: "redactor" };
  }
}

const hashSeleccion = (hechos: HechoCronicaArena[]) => hashHechos(hechos.map((h) => h.hecho) as unknown as Hecho[]);
const actaDe = (hechos: HechoCronicaArena[], audit: CronicaVerificada["audit"] = [], intentos = 0): CronicaVerificada =>
  ({ ...borradorActa(hechos.map((h) => h.hecho)), intentos, frasesOmitidas: 0, modo: "acta", audit });

/** I9 · Motivos de una crónica contra la selección del registro. */
const motivosDe = (c: CronicaDraft, hechos: HechoCronicaArena[], registro: RegistroArena) => verificarCronicaArena(c, hechos.map((h) => h.hecho), registro.config.partido);

/** Estado de una crónica guardada contra el registro (la misma selección que al generar, v1.2). */
export function estadoDe(archivo: ArchivoCronica | null, registro: RegistroArena, hechos: HechoCronicaArena[]): EstadoCronica {
  if (!archivo) return "sin-cronica";
  if (archivo.version !== CRONICA_ARENA.version || archivo.analista !== CRONICA_ARENA.analista || archivo.hashHechos !== hashSeleccion(hechos)) return "desactualizada";
  try { return motivosDe(archivo.cronica, hechos, registro).length === 0 ? "lista" : "invalida"; } catch { return "invalida"; }
}

export interface DepsServicio {
  almacen: () => Promise<AlmacenTorneos>;
  ahora: () => number;
  env: () => Env;
  fuentes: DepsFuentes;
  /** Sustituye la construcción del LLM (solo pruebas); se llama solo con ARENA_CRONICA_LLM=1. */
  crearLlm?: () => Llm;
  /** Brief 071 · Sustituye el cliente MCP in-process del cronista (solo pruebas: fallos, plazos, discrepancias). */
  hechosMcp?: typeof hechosPorMcp;
}

export class ServicioCronicas {
  private readonly libro: LibroDiario;
  private readonly enCurso = new Map<string, Promise<RespuestaCronica>>();
  private generandoConModelo = 0;
  constructor(private readonly deps: DepsServicio) { this.libro = new LibroDiario(deps.almacen); }

  /** Lectura sin coste (I7): ni LLM ni escrituras. `null` si la huella no tiene registro guardado. */
  async leer(huella: string): Promise<LecturaCronica | null> {
    const a = await this.deps.almacen();
    const registro = await leerRegistroGuardado(a, huella);
    if (!registro) return null;
    const origen = await leerJsonAlmacen<OrigenCronica>(a, archivosCronica.origen(huella));
    const { hechos } = seleccionCronicaArena(registro);
    const archivo = await leerJsonAlmacen<ArchivoCronica>(a, archivosCronica.cronica(huella));
    const estado = estadoDe(archivo, registro, hechos);
    return { huella, origen, estado, ...(estado === "lista" && archivo ? { archivo } : {}), registro, hechos };
  }

  /** POST · Genera (o devuelve la guardada). Lanza `ErrorCronica` con su estado HTTP. */
  async generar(fuente: FuenteCronica): Promise<RespuestaCronica> {
    const a = await this.deps.almacen().catch(() => { throw new ErrorCronica("Almacén no disponible", 503); });
    const { huella, registro, origen, indice } = await this.resolver(a, fuente);
    const previa = this.enCurso.get(huella);
    if (previa) return { ...(await previa), desdeAlmacen: false };
    const tarea = this.procesar(a, huella, registro, origen, indice);
    this.enCurso.set(huella, tarea);
    try { return await tarea; } finally { if (this.enCurso.get(huella) === tarea) this.enCurso.delete(huella); }
  }

  private async resolver(a: AlmacenTorneos, fuente: FuenteCronica): Promise<{ huella: string; registro: RegistroArena; origen: OrigenCronica; indice?: string }> {
    if ("huella" in fuente) {
      const registro = await leerRegistroGuardado(a, fuente.huella);
      if (!registro) throw new ErrorCronica("Crónica inexistente", 404);
      const origen = (await leerJsonAlmacen<OrigenCronica>(a, archivosCronica.origen(fuente.huella))) ?? { tipo: "subida", contexto: { forma: "importado" } };
      return { huella: fuente.huella, registro, origen };
    }
    const indice = "sesion" in fuente ? archivosCronica.idxSesion(fuente.sesion)
      : "torneo" in fuente ? archivosCronica.idxTorneo(fuente.torneo, fuente.encuentro)
        : "archivo" in fuente ? archivosCronica.idxArchivo(fuente.archivo) : undefined;
    if (indice) {
      const idx = await leerJsonAlmacen<{ huella: string }>(a, indice);
      if (idx) {
        const registro = await leerRegistroGuardado(a, idx.huella);
        const origen = await leerJsonAlmacen<OrigenCronica>(a, archivosCronica.origen(idx.huella));
        if (registro && origen) return { huella: idx.huella, registro, origen };
      }
    }
    const { registro, origen } = await resolverFuente(fuente as Exclude<FuenteCronica, { huella: string }>, this.deps.fuentes);
    return { huella: huellaRegistro(registro), registro, origen, ...(indice ? { indice } : {}) };
  }

  private async procesar(a: AlmacenTorneos, huella: string, registro: RegistroArena, origen: OrigenCronica, indice?: string): Promise<RespuestaCronica> {
    const ahora = this.deps.ahora(), dia = diaUtc(ahora), env = this.deps.env();
    // Registro, origen e índice (registros nuevos del día acotados).
    if (!(await existeRegistro(a, huella))) {
      if (!(await this.libro.sumar(dia, "registros", CRONICA_ARENA.registrosDiarios))) throw new ErrorCronica("Demasiados partidos nuevos hoy", 429, "registros-diarios");
      await a.escribirBytes(archivosCronica.registro(huella), comprimirRegistro(registro));
    }
    await crearSiNoExiste(a, archivosCronica.origen(huella), JSON.stringify(origen));
    if (indice) await crearSiNoExiste(a, indice, JSON.stringify({ huella }));

    const directa = seleccionCronicaArena(registro);
    const guardado = await leerJsonAlmacen<ArchivoCronica>(a, archivosCronica.cronica(huella));
    const estado = estadoDe(guardado, registro, directa.hechos);
    if (estado === "lista" && guardado && !guardado.provisional) return this.respuesta(huella, guardado, true);
    // Brief 071 · El cronista obtiene los hechos como cliente MCP (registro ya guardado arriba); si no, los directos.
    const { hechos, cabe, via } = await this.hechosDelCronista(a, huella, directa);

    const acta = async (motivo: MotivoActa, base?: { cronica: CronicaVerificada; redactor: RedactorGuardado | null; uso?: UsoLlm }): Promise<RespuestaCronica> => {
      // Un acta provisional ya guardada con el mismo motivo se devuelve tal cual (sin reescribir).
      if (!base && estado === "lista" && guardado && guardado.provisional && guardado.motivoActa === motivo) return this.respuesta(huella, guardado, true);
      const cronica = base?.cronica ?? actaDe(hechos);
      return this.guardar(a, huella, registro, hechos, cronica, base?.redactor ?? null, motivo, base?.uso, via);
    };
    if (!cabe) return acta("tamano");
    const redactor = crearRedactor(env, this.deps.crearLlm);
    if ("motivo" in redactor) return acta(redactor.motivo);

    // Reserva pendiente: reciente → otra generación en curso; vieja → abandonada.
    const reserva = await leerJsonAlmacen<{ estado: string; desdeUtc: string }>(a, archivosCronica.reserva(huella));
    if (reserva) {
      if (ahora - Date.parse(reserva.desdeUtc) < CRONICA_ARENA.reservaAbandonadaMs) throw new ErrorCronica("Otra crónica de este partido se está escribiendo", 429, "en-curso", CRONICA_ARENA.reintentoOcupadoS);
      await a.borrar(archivosCronica.reserva(huella));
      return acta("abandonada");
    }
    if (this.generandoConModelo >= CRONICA_ARENA.generacionesSimultaneas) throw new ErrorCronica("Se está escribiendo otra crónica", 429, "en-curso", CRONICA_ARENA.reintentoOcupadoS);
    this.generandoConModelo++;
    try {
      // D10 · La reserva del cupo se escribe ANTES de llamar.
      if (!(await this.libro.sumar(dia, "generaciones", cupoDiarioCronicas()))) return await acta("cupo");
      if (!(await crearSiNoExiste(a, archivosCronica.reserva(huella), JSON.stringify({ estado: "pendiente", desdeUtc: new Date(ahora).toISOString() })))) {
        throw new ErrorCronica("Otra crónica de este partido se está escribiendo", 429, "en-curso", CRONICA_ARENA.reintentoOcupadoS);
      }
      const llm = conPresupuesto(redactor.llm, 1 + MAX_REINTENTOS);
      const hs = hechos.map((h) => h.hecho);
      const esquema = esquemaCronicaArena(hs);
      const largoEsquema = JSON.stringify(esquema).length;
      const total = AbortSignal.timeout(CRONICA_ARENA.plazoTotalMs);
      const { cronica, huboErrorLlm } = await trazar("arena.cronica", { "gen_ai.request.model": llm.id, "arena.huella": huella }, () => redactarYVerificar(hs, { config: registro.config.partido }, llm, {
        system: SISTEMA_CRONICA_ARENA,
        verificarExtra: (d) => reglasTiempoArena(d, hs),
        opcionesLlm: () => ({ signal: AbortSignal.any([AbortSignal.timeout(CRONICA_ARENA.plazoIntentoMs), total]), maxTokens: CRONICA_ARENA.maxTokensSalida, esquema: { nombre: "cronica_arena", json: esquema } }),
        feedback: (m) => feedbackAcotado(m),
        antesDeLlamar: (system, mensajes) => system.length + mensajes.reduce((s, m) => s + m.contenido.length, 0) + largoEsquema <= cotaConversacion(),
        maxCaracteresRespuesta: CRONICA_ARENA.maxCaracteresRespuesta,
      }));
      const datosRedactor = etiquetaRedactor(redactor.llm.id);
      const uso = redactor.llm.uso?.();
      const r = cronica.modo === "llm"
        ? await this.guardar(a, huella, registro, hechos, cronica, datosRedactor, undefined, uso, via)
        : await acta(huboErrorLlm ? "error" : "rechazos", { cronica, redactor: datosRedactor, ...(uso ? { uso } : {}) });
      await a.borrar(archivosCronica.reserva(huella)).catch(() => {});
      return r;
    } finally { this.generandoConModelo--; }
  }

  /**
   * Brief 071 § 2.B · Hechos por `get_match_facts` (cliente MCP del SDK, in-process, con plazo). Respaldo a la llamada
   * directa si el MCP falla, tarda o no devuelve exactamente la misma selección (deep-equal): la crónica nunca falla
   * ni cambia por el MCP, y la vía queda en el archivo de la crónica.
   */
  private async hechosDelCronista(a: AlmacenTorneos, huella: string, directa: { hechos: HechoCronicaArena[]; cabe: boolean }): Promise<{ hechos: HechoCronicaArena[]; cabe: boolean; via: ViaHechos }> {
    try {
      const m = await (this.deps.hechosMcp ?? hechosPorMcp)({ almacen: async () => a, fuentes: this.deps.fuentes, cronicas: this }, huella);
      if (m.cabe !== directa.cabe || jsonEstable(m.hechos) !== jsonEstable(directa.hechos)) throw new ErrorClienteMcp("discrepancia", "la selección por MCP no es idéntica a la directa");
      return { hechos: m.hechos, cabe: m.cabe, via: { hechosVia: "mcp" } };
    } catch (e) {
      const motivo: MotivoRespaldoMcp = e instanceof ErrorClienteMcp ? e.motivo : "error";
      console.warn("CRONISTA: hechos de la crónica por la llamada directa (respaldo del MCP)", { huella, motivo, detalle: e instanceof Error ? e.message.slice(0, 200) : "error" });
      return { ...directa, via: { hechosVia: "directo", hechosViaMotivo: motivo } };
    }
  }

  private async guardar(a: AlmacenTorneos, huella: string, registro: RegistroArena, hechos: HechoCronicaArena[], cronica: CronicaVerificada, redactor: RedactorGuardado | null, motivoActa?: MotivoActa, uso?: UsoLlm, via?: ViaHechos): Promise<RespuestaCronica> {
    // I9 · Nada sin verificar se guarda: si fallara aquí sería un error de programa.
    const motivos = motivosDe(cronica, hechos, registro);
    if (motivos.length > 0) throw new Error(`error de programa: la crónica de arena no pasa el Verificador: ${motivos.map((m) => `${m.regla} ${m.detalle}`).join(" | ")}`);
    const archivo: ArchivoCronica = {
      version: CRONICA_ARENA.version, analista: CRONICA_ARENA.analista, huella, hashHechos: hashSeleccion(hechos), generadaUtc: new Date(this.deps.ahora()).toISOString(),
      redactor, provisional: motivoActa !== undefined && !ACTA_DEFINITIVA.includes(motivoActa), ...(motivoActa ? { motivoActa } : {}), ...(uso ? { uso } : {}), ...via, cronica,
    };
    await a.escribir(archivosCronica.cronica(huella), JSON.stringify(archivo));
    return this.respuesta(huella, archivo, false);
  }

  private respuesta(huella: string, archivo: ArchivoCronica, desdeAlmacen: boolean): RespuestaCronica {
    return { huella, url: urlCronica(huella), modo: archivo.cronica.modo, provisional: archivo.provisional, ...(archivo.motivoActa ? { motivoActa: archivo.motivoActa } : {}), desdeAlmacen };
  }
}

const compartido = globalThis as typeof globalThis & { __cronistaServicioCronicas?: ServicioCronicas };
/** El servicio del proceso (una réplica): almacén del entorno, reloj real y fuentes reales. */
export function servicioCronicas(): ServicioCronicas {
  return compartido.__cronistaServicioCronicas ??= new ServicioCronicas({ almacen: () => almacenCronicasDesdeEnv(), ahora: Date.now, env: () => process.env, fuentes: depsFuentesReales });
}
/** La misma lectura que el GET, sin HTTP (la página). */
export const leerCronicaArena = (huella: string) => servicioCronicas().leer(huella);
