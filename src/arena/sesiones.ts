import { createHash, randomUUID } from "node:crypto";
import { setTimeout as esperar } from "node:timers/promises";
import { ANTESALA_ARENA, ARENA, MESA_ARENA, PREVIA_ARENA, SPEECH_DIARIO } from "../sim/limites";
import { contenidoCanonico, ejecutarArena } from "./coordinador";
import { catalogoModelos, elegirModelos, type ModeloConfigurado } from "./modelos";
import { crearConfigArena } from "./motor";
import { ErrorPeticion, peticionSesion } from "./peticiones";
import type { AsignacionModelos, EstadoSesion, InstantaneaEmision, MensajeSesion, MetricasSesion, PublicacionSesion, ReproduccionArena } from "./protocolo";
import type { RegistroArena } from "./tipos";
import { aplicarPublicacion } from "./protocolo";
import { conPresupuesto, crearLlmDesdeEnv, type Llm } from "../lib/llm";
import { contextoNarradorArena, narrarArena } from "./narrador";
import { almacenDesdeEnv, type AlmacenArena, type BloqueoAlmacen } from "./almacen";
import { iniciarTelemetria, trazar } from "../lib/telemetria";
import { RitmoProduccionBuffer } from "./buffer";
import { MesaSesion } from "./mesa";
import type { IntervencionArena } from "./protocolo";

export class ErrorSesion extends Error { constructor(message: string, readonly status: number) { super(message); } }
interface Sesion {
  id: string; estado: EstadoSesion; creada: number; asignacion: AsignacionModelos;
  mensajes: MensajeSesion[]; suscriptores: Set<(m: MensajeSesion) => void>; cancelar: AbortController;
  tarea?: Promise<void>; metricas: MetricasSesion;
  cola: Promise<void>;
}
interface Opciones {
  directorio?: string; ritmoMsPorSegundo?: number; esperaMs?: number;
  catalogo?: () => ModeloConfigurado[]; maxActivas?: number; maxLlmDiarias?: number;
  maxRetenidas?: number;
  narrador?: () => Llm;
  almacen?: AlmacenArena;
  /** Solo pruebas: plazo del comentarista; por defecto MESA_ARENA.plazoComentaristaMs. */
  plazoComentaristaMs?: number;
}
const intervencionesDe = (mensajes: readonly MensajeSesion[]): IntervencionArena[] => mensajes.flatMap(m => m.publicacion.tipo === "intervencion" ? [m.publicacion.intervencion] : []);
const duracionRetencionMs = 24 * 60 * 60 * 1000;
/** Presupuesto de voz por encuentro (solicitudes de audio y caracteres de SSML reservados). */
export const PRESUPUESTO_AUDIO_ENCUENTRO = { solicitudes: 80, caracteres: 24_000 } as const;
/** Brief 048: clase de la síntesis de voz. v1.3 (1): el narrador (tramos y cierre) consume solo de
 * PRESUPUESTO_AUDIO_ENCUENTRO, con la reserva del cierre (v1.2) dentro; los invitados, solo de su
 * bolsa propia `bolsaSpeechInvitados`. Ninguna de las dos se presta a la otra.
 * Brief 056 (v1.1 § 9): la previa hablada consume SOLO de PREVIA_ARENA.bolsaSpeech, y ni el narrador
 * ni los invitados la cuentan. */
export type ClaseVoz = "narrador" | "cierre" | "invitado" | "previa" | "antesala";
/** Rechazo de presupuesto de voz para una nueva síntesis (null si cabe). Pura. */
export function rechazoCuotaVoz(reservas: readonly { tipo: string; caracteres?: number; clase?: ClaseVoz }[], caracteres: number, clase: ClaseVoz): string | null {
  const audio = reservas.filter(x => x.tipo === "audio"), suma = (xs: typeof audio) => xs.reduce((s, x) => s + (x.caracteres ?? 0), 0);
  const P = PRESUPUESTO_AUDIO_ENCUENTRO, D = MESA_ARENA.dialogo;
  if (clase === "previa") {
    const previa = audio.filter(x => x.clase === "previa"), B = PREVIA_ARENA.bolsaSpeech;
    return previa.length + 1 > B.solicitudes || suma(previa) + caracteres > B.caracteres ? "Bolsa de voz de la previa agotada" : null;
  }
  // Brief 058 § 4.7: la antesala cobra solo de su bolsa; ninguna otra la cuenta ni le presta.
  if (clase === "antesala") {
    const antesala = audio.filter(x => x.clase === "antesala"), B = ANTESALA_ARENA.bolsaSpeech;
    return antesala.length + 1 > B.solicitudes || suma(antesala) + caracteres > B.caracteres ? "Bolsa de voz de la antesala agotada" : null;
  }
  if (clase === "invitado") {
    const invitados = audio.filter(x => x.clase === "invitado"), B = D.bolsaSpeechInvitados;
    return invitados.length + 1 > B.solicitudes || suma(invitados) + caracteres > B.caracteres ? "Bolsa de voz de los invitados agotada" : null;
  }
  const narrador = audio.filter(x => x.clase !== "invitado" && x.clase !== "previa" && x.clase !== "antesala");
  if (narrador.length + 1 > P.solicitudes || suma(narrador) + caracteres > P.caracteres) return "Se alcanzó el límite de consultas de este encuentro";
  if (clase !== "cierre" && (narrador.length + 1 > P.solicitudes - D.reservaSpeechCierreSolicitudes || suma(narrador) + caracteres > P.caracteres - D.reservaSpeechCierreCaracteres)) return "Presupuesto de voz reservado para el cierre";
  return null;
}
const identificadorValido = (id: string) => /^[a-f0-9-]{36}$/.test(id);

/** Coordinador de una réplica. El diario permite reconectar, sin volver a inferir. */
export class GestorSesiones {
  private sesiones = new Map<string, Sesion>();
  private creando = false;
  private trabajos = new Set<string>();
  private extrasActivos = new Map<string, number>();
  private consultasEnCurso = new Map<string, Promise<unknown>>();
  private almacenPromesa?: Promise<AlmacenArena>;
  private bloqueo?: BloqueoAlmacen;
  private colaExtras: Promise<void> = Promise.resolve();
  readonly directorio: string;
  constructor(private opciones: Opciones = {}) { this.directorio = (opciones.directorio ?? process.env.ARENA_SESIONES_DIR ?? ".cache/arena-sesiones").replace(/\/$/, ""); }
  private almacen() { return this.almacenPromesa ??= this.opciones.almacen ? Promise.resolve(this.opciones.almacen) : almacenDesdeEnv(this.directorio); }
  private async asegurarEscritura() {
    if (this.bloqueo?.vigente()) return;
    if (this.bloqueo) { for (const s of this.sesiones.values()) if (s.estado === "ejecutando") s.cancelar.abort(); throw new ErrorSesion("Se perdió la coordinación del encuentro", 503); }
    try { this.bloqueo = await (await this.almacen()).bloquear(); }
    catch { throw new ErrorSesion("Otro proceso coordina encuentros; intenta más tarde", 503); }
  }
  private async liberarSiInactivo() {
    if (this.creando || this.trabajos.size || this.extrasActivos.size) return;
    const bloqueo = this.bloqueo; this.bloqueo = undefined; await bloqueo?.liberar();
  }
  private archivo(id: string, extension: string) {
    if (!identificadorValido(id)) throw new ErrorSesion("Sesión inexistente", 404);
    return `${id}.${extension}`;
  }
  private async publicar(sesion: Sesion, publicacion: PublicacionSesion): Promise<void> {
    const pendiente = sesion.cola.then(async () => {
      const mensaje = { id: sesion.mensajes.length + 1, publicacion };
      if (!this.bloqueo?.vigente()) throw new ErrorSesion("Se perdió el permiso de escritura", 503);
      await (await this.almacen()).anexar(this.archivo(sesion.id, "ndjson"), JSON.stringify(mensaje) + "\n");
      sesion.mensajes.push(mensaje);
      for (const recibir of sesion.suscriptores) recibir(mensaje);
    });
    sesion.cola = pendiente.catch(() => {});
    await pendiente;
  }
  private async limpiar(): Promise<void> {
    const almacen = await this.almacen(); await almacen.iniciar();
    const archivos = await almacen.listar();
    const vigentes: { id: string; creada: number }[] = [];
    for (const nombre of archivos.filter(n => n.endsWith(".meta.json"))) {
      try {
        const meta = JSON.parse(await almacen.leer(nombre)) as { id: string; creada: number };
        if (Date.now() - meta.creada <= duracionRetencionMs || this.sesiones.get(meta.id)?.estado === "ejecutando" || this.extrasActivos.has(meta.id)) { vigentes.push(meta); continue; }
        for (const nombre of archivos.filter(n => n.startsWith(meta.id + "."))) await almacen.borrar(nombre).catch(() => {});
        this.sesiones.delete(meta.id);
      } catch { /* Un archivo ajeno o incompleto no participa del catálogo. */ }
    }
    for (const meta of vigentes.sort((a, b) => b.creada - a.creada).slice(Math.max(0, (this.opciones.maxRetenidas ?? 24) - 1))) {
      if (this.sesiones.get(meta.id)?.estado === "ejecutando" || this.extrasActivos.has(meta.id)) continue;
      // Conservar la pequeña metadata evita que la limpieza reinicie el presupuesto diario.
      for (const nombre of archivos.filter(n => n.startsWith(meta.id + ".") && !n.endsWith(".meta.json"))) await almacen.borrar(nombre).catch(() => {});
      this.sesiones.delete(meta.id);
    }
  }
  async crear(raw: unknown): Promise<{ id: string; asignacion: AsignacionModelos }> {
    const p = peticionSesion.parse(raw);
    await iniciarTelemetria();
    if (this.creando) throw new ErrorSesion("Otra sesión se está iniciando", 429);
    this.creando = true;
    try {
      const almacen = await this.almacen(); await almacen.iniciar(); await this.asegurarEscritura();
      await this.limpiar();
      const activas = [...this.sesiones.values()].filter(s => s.estado === "ejecutando");
      if (activas.length >= (this.opciones.maxActivas ?? 2) || (p.seleccion.modo !== "programado" && activas.some(s => s.asignacion.modo !== "programado"))) throw new ErrorSesion("Hay un encuentro en ejecución; espera a que termine", 429);
      if (p.seleccion.modo !== "programado") {
        const hoy = new Date().toISOString().slice(0, 10);
        let usados = 0;
        for (const nombre of (await almacen.listar()).filter(n => n.endsWith(".meta.json"))) {
          const meta = JSON.parse(await almacen.leer(nombre)) as { creada: number; asignacion: AsignacionModelos };
          if (new Date(meta.creada).toISOString().startsWith(hoy) && meta.asignacion.modo !== "programado") usados++;
        }
        if (usados >= (this.opciones.maxLlmDiarias ?? 10)) throw new ErrorSesion("Se alcanzó el límite diario de encuentros con modelos", 429);
      }
      const catalogo = p.seleccion.modo === "programado" ? [] : (this.opciones.catalogo ?? catalogoModelos)();
      const { asignacion, controladores, uso } = elegirModelos(p.seleccion, p.seed, catalogo);
      const config = crearConfigArena({ seed: p.seed, duracionS: p.segundos, intervaloS: 30, ...(p.local !== "auto" ? { local: p.local } : {}), ...(p.visita !== "auto" ? { visita: p.visita } : {}), entorno: p.entorno });
      const modeloNarrador = process.env.ARENA_NARRADOR_MODELO ? catalogo.find(m => m.publico.id === process.env.ARENA_NARRADOR_MODELO) : undefined;
      if (process.env.ARENA_NARRADOR_MODELO && p.seleccion.modo !== "programado" && !modeloNarrador) throw new Error("Narrador fuera del catálogo");
      const modeloSesion = p.seleccion.modo !== "programado" ? this.opciones.narrador?.() ?? (process.env.ARENA_NARRADOR_LLM === "1" && process.env.ARENA_WEB_LLM === "1" ? modeloNarrador?.crear() ?? crearLlmDesdeEnv(process.env, { maxRetries: 0 }) : undefined) : undefined;
      // Brief 045 v3.1: un presupuesto de llamadas por sesión, compartido por el narrador y la
      // mesa (la misma instancia envuelta una vez); agotado, ambos caen a plantilla.
      const narrador = modeloSesion ? conPresupuesto(modeloSesion, MESA_ARENA.presupuestoLlamadasModelo) : undefined;
      const sesion: Sesion = { id: randomUUID(), estado: "ejecutando", creada: Date.now(), asignacion, mensajes: [], suscriptores: new Set(), cancelar: new AbortController(), cola: Promise.resolve(), metricas: { duracionMs: 0, decisiones: 0, respaldos: 0, esperaModeloMs: [] } };
      await almacen.escribir(this.archivo(sesion.id, "meta.json"), JSON.stringify({ id: sesion.id, creada: sesion.creada, asignacion }), true);
      this.sesiones.set(sesion.id, sesion);
      await this.publicar(sesion, { tipo: "sesion", id: sesion.id, asignacion });
      this.trabajos.add(sesion.id);
      sesion.tarea = trazar("arena.sesion", { "arena.sesion.id": sesion.id, "arena.seed": p.seed, "arena.modo": asignacion.modo, "arena.version": config.version ?? "arena-v1" }, async span => {
        let ultimoTick = 0, prefijo: RegistroArena | null = null, comentarios = 0, comentarioTick = -150;
        const ritmoBuffer = new RitmoProduccionBuffer(undefined, this.opciones.ritmoMsPorSegundo ?? 1000);
        let narracion: Promise<void> | undefined, cerrada = false;
        // Brief 045: candidaturas de comentarista y estadista, una sola vez, en el diario.
        const mesa = new MesaSesion({ llm: narrador, signal: sesion.cancelar.signal, plazoMs: this.opciones.plazoComentaristaMs, publicar: intervencion => this.publicar(sesion, { tipo: "intervencion", intervencion }) });
        const programarComentario = () => {
          if (!narrador || narracion || comentarios >= 3 || !prefijo || prefijo.final.tick - comentarioTick < 150) return;
          const snapshot = structuredClone(prefijo), tick = snapshot.final.tick;
          if (!contextoNarradorArena(snapshot, tick).length) return;
          comentarios++; comentarioTick = tick;
          narracion = narrarArena(snapshot, tick, narrador, { signal: sesion.cancelar.signal })
            .then(async comentario => { if (comentario && !sesion.cancelar.signal.aborted && !cerrada) await this.publicar(sesion, { tipo: "comentario", comentario }); })
            .catch(() => {})
            .finally(() => { narracion = undefined; });
        };
        try {
          const registro = await ejecutarArena(config, controladores, {
            signal: sesion.cancelar.signal, esperaMs: this.opciones.esperaMs,
            alPublicar: async publicacion => {
              if (publicacion.tipo === "avance") {
                const ms = (publicacion.estado.tick - ultimoTick) * ARENA.pasoS * (this.opciones.ritmoMsPorSegundo ?? 1000);
                if (p.presentacion === "directo" && ms > 0) await esperar(ms, undefined, { signal: sesion.cancelar.signal });
                if (p.presentacion === "buffer") {
                  const pausa = ritmoBuffer.espera(publicacion.estado.tick);
                  if (pausa > 0) await esperar(pausa, undefined, { signal: sesion.cancelar.signal });
                }
                ultimoTick = publicacion.estado.tick;
              }
              if (publicacion.tipo === "ronda") {
                const decisiones = Object.values(publicacion.ronda.decisiones);
                sesion.metricas.decisiones += decisiones.length;
                sesion.metricas.respaldos += decisiones.filter(d => d.origen === "respaldo").length;
                sesion.metricas.solicitudesEquipo = (sesion.metricas.solicitudesEquipo ?? 0) + decisiones.filter(d => d.tipo === "llm").reduce((s, d) => s + (d.llamadas ?? 1), 0);
                sesion.metricas.esperaModeloMs.push(...decisiones.filter(d => d.tipo === "llm").map(d => d.tiempoMs));
              }
              await this.publicar(sesion, publicacion);
              prefijo = aplicarPublicacion(prefijo, publicacion);
              if (publicacion.tipo === "avance") { programarComentario(); await mesa.avanzar(prefijo!, publicacion.eventos); }
            },
          });
          if (!this.bloqueo?.vigente()) throw new Error("Coordinación perdida");
          await almacen.escribir(this.archivo(sesion.id, "json"), JSON.stringify(registro) + "\n");
          await narracion;
          await mesa.final(registro);
          sesion.estado = "completa";
        } catch {
          sesion.estado = sesion.cancelar.signal.aborted ? "cancelada" : "error";
        } finally {
          // v3.1: antes de `terminada`, en todos los caminos: nada publica después.
          cerrada = true; mesa.cerrar();
          sesion.metricas.duracionMs = Date.now() - sesion.creada;
          sesion.metricas.uso = { ...uso(), narrador: narrador?.uso?.() ?? null };
          span.setAttributes({ "arena.estado": sesion.estado, "arena.decisiones": sesion.metricas.decisiones, "arena.respaldos": sesion.metricas.respaldos, "arena.duracion_ms": sesion.metricas.duracionMs });
          try { await this.publicar(sesion, { tipo: "terminada", estado: sesion.estado as Exclude<EstadoSesion, "ejecutando">, metricas: sesion.metricas }); }
          finally { this.trabajos.delete(sesion.id); await this.liberarSiInactivo(); }
        }
      }).catch(async () => { sesion.estado = "error"; this.trabajos.delete(sesion.id); await this.liberarSiInactivo(); });
      return { id: sesion.id, asignacion };
    } finally { this.creando = false; await this.liberarSiInactivo(); }
  }
  async obtener(id: string): Promise<Sesion> {
    this.archivo(id, "meta.json");
    const viva = this.sesiones.get(id); if (viva) return viva;
    try {
      const almacen = await this.almacen();
      const meta = JSON.parse(await almacen.leer(this.archivo(id, "meta.json"))) as Pick<Sesion, "id" | "creada" | "asignacion">;
      if (Date.now() - meta.creada > duracionRetencionMs) throw new Error("Caducada");
      const diario = await almacen.leer(this.archivo(id, "ndjson"));
      const mensajes: MensajeSesion[] = [];
      for (const linea of diario.split("\n").filter(Boolean)) {
        try { const m = JSON.parse(linea) as MensajeSesion; if (m.id !== mensajes.length + 1) break; mensajes.push(m); } catch { break; }
      }
      const final = mensajes.at(-1)?.publicacion;
      const sesion: Sesion = { ...meta, mensajes, suscriptores: new Set(), cancelar: new AbortController(), cola: Promise.resolve(), estado: final?.tipo === "terminada" ? final.estado : "interrumpida", metricas: final?.tipo === "terminada" ? final.metricas : { duracionMs: Date.now() - meta.creada, decisiones: 0, respaldos: 0, esperaModeloMs: [] } };
      if (sesion.estado === "interrumpida") {
        await this.asegurarEscritura();
        try { await this.publicar(sesion, { tipo: "terminada", estado: "interrumpida", metricas: sesion.metricas }); }
        finally { await this.liberarSiInactivo(); }
      }
      this.sesiones.set(id, sesion);
      return sesion;
    } catch (error) { if (error instanceof ErrorSesion) throw error; throw new ErrorSesion("Sesión inexistente o caducada", 404); }
  }
  async detener(id: string): Promise<void> { const s = await this.obtener(id); if (s.estado === "ejecutando") s.cancelar.abort(); }
  /** Adjunta un archivo ya validado: no vuelve a jugar ni llama a los equipos.
   * Brief 057 v1.1 § 4: `procedencia` "declarada" (subidas) queda en la asignación (meta, mensaje `sesion`,
   * reproducción y emisión) y la deduplicación compara el contenido canónico, no los metadatos declarados. */
  async registrarGrabacion(registro: RegistroArena, referencia: string, procedencia?: "verificada" | "declarada") {
    await iniciarTelemetria();
    if (!/^[a-z0-9-]{1,50}$/.test(referencia)) throw new ErrorSesion("Referencia inválida", 400);
    if (this.creando) throw new ErrorSesion("Otra sesión se está iniciando", 429);
    this.creando = true;
    try {
      const a = await this.almacen(); await a.iniciar(); await this.asegurarEscritura();
      const indice = `grabacion-${referencia}.json`;
      const forma = (r: RegistroArena) => JSON.stringify(procedencia === "declarada" ? contenidoCanonico(r) : r);
      try { const id = JSON.parse(await a.leer(indice)).id as string; if ((await this.obtener(id)).estado === "completa" && forma(await this.registro(id)) === forma(registro)) return { id }; }
      catch (error) { if (!(error instanceof ErrorSesion && error.status === 404) && (error as { code?: string }).code !== "ENOENT" && (error as { statusCode?: number }).statusCode !== 404) throw error; }
      await this.limpiar();
      const equipo = (lado: "local" | "visita") => { const d = registro.rondas[0]!.decisiones[lado]; return { id: lado, nombre: d.controlador, controlador: d.controlador }; };
      const asignacion: AsignacionModelos = { modo: "programado", local: equipo("local"), visita: equipo("visita"), ...(procedencia ? { procedencia } : {}) };
      const metricas: MetricasSesion = { duracionMs: 0, decisiones: registro.rondas.length * 2, respaldos: registro.rondas.flatMap(r => Object.values(r.decisiones)).filter(d => d.origen === "respaldo").length, esperaModeloMs: [] };
      const sesion: Sesion = { id: randomUUID(), creada: Date.now(), estado: "completa", asignacion, metricas, mensajes: [], suscriptores: new Set(), cancelar: new AbortController(), cola: Promise.resolve() };
      await a.escribir(this.archivo(sesion.id, "meta.json"), JSON.stringify({ id: sesion.id, creada: sesion.creada, asignacion, reproduccion: true }), true);
      await this.publicar(sesion, { tipo: "sesion", id: sesion.id, asignacion });
      await this.publicar(sesion, { tipo: "inicio", version: registro.version, config: registro.config, inicial: registro.inicial });
      for (const ronda of registro.rondas) await this.publicar(sesion, { tipo: "ronda", ronda });
      await this.publicar(sesion, { tipo: "avance", estado: registro.final, fotogramas: registro.fotogramas.slice(1), eventos: registro.eventos });
      await a.escribir(this.archivo(sesion.id, "json"), JSON.stringify(registro));
      await this.publicar(sesion, { tipo: "terminada", estado: "completa", metricas });
      await a.escribir(indice, JSON.stringify({ id: sesion.id })); this.sesiones.set(sesion.id, sesion);
      return { id: sesion.id };
    } finally { this.creando = false; await this.liberarSiInactivo(); }
  }
  async registro(id: string): Promise<RegistroArena> {
    const s = await this.obtener(id);
    if (s.estado !== "completa") throw new ErrorSesion("El encuentro aún no tiene un registro completo", 409);
    return JSON.parse(await (await this.almacen()).leer(this.archivo(id, "json"))) as RegistroArena;
  }
  async esperarFinal(id: string): Promise<void> { await (await this.obtener(id)).tarea; }
  /** Un mismo resultado para todos los espectadores; leer nunca ejecuta modelos. */
  async reproduccion(id: string): Promise<ReproduccionArena> {
    const registro = await this.registro(id), sesion = await this.obtener(id);
    return { registro, comentarios: sesion.mensajes.flatMap(m => m.publicacion.tipo === "comentario" ? [m.publicacion.comentario] : []), intervenciones: intervencionesDe(sesion.mensajes), asignacion: sesion.asignacion, metricas: sesion.metricas };
  }
  /** Copia coherente del diario y su cursor: el SSE posterior continúa desde aquí. */
  async emision(id: string): Promise<InstantaneaEmision> {
    const sesion = await this.obtener(id), mensajes = sesion.mensajes.slice();
    let registro: RegistroArena | null = null;
    for (const m of mensajes) registro = aplicarPublicacion(registro, m.publicacion);
    if (!registro) throw new ErrorSesion("La emisión está comenzando; vuelve a conectar", 409);
    const ultima = mensajes.at(-1)!.publicacion;
    return { registro, comentarios: mensajes.flatMap(m => m.publicacion.tipo === "comentario" ? [m.publicacion.comentario] : []), intervenciones: intervencionesDe(mensajes), asignacion: sesion.asignacion, metricas: { ...sesion.metricas }, estado: ultima.tipo === "terminada" ? ultima.estado : "ejecutando", ultimoMensaje: mensajes.at(-1)!.id };
  }
  async vistaPublicada(id: string, hastaTick: number): Promise<RegistroArena> {
    const sesion = await this.obtener(id);
    let prefijo: RegistroArena | null = null;
    for (const m of sesion.mensajes) {
      const p = m.publicacion;
      if (p.tipo === "avance" && p.estado.tick > hastaTick) {
        // Un archivo adjunto puede contener todo el partido en una publicación.
        const estado = [...p.fotogramas].reverse().find(f => f.tick <= hastaTick);
        if (estado && prefijo && estado.tick > prefijo.final.tick) prefijo = aplicarPublicacion(prefijo, { tipo: "avance", estado, fotogramas: p.fotogramas.filter(f => f.tick <= estado.tick), eventos: p.eventos.filter(e => e.tick <= estado.tick) });
        break;
      }
      prefijo = aplicarPublicacion(prefijo, p);
    }
    if (!prefijo || !Number.isInteger(hastaTick) || hastaTick < 0 || hastaTick > Math.max(...sesion.mensajes.map(m => m.publicacion.tipo === "avance" ? m.publicacion.estado.tick : 0))) throw new ErrorSesion("Instante todavía no publicado", 409);
    return { ...prefijo, rondas: prefijo.rondas.filter(r => r.inicioTick <= prefijo.final.tick) };
  }
  /** Reserva durable ANTES del servicio; un proceso interrumpido no repite el gasto. */
  async extra<T>(id: string, tipo: "analisis" | "audio", clave: string, tarea: () => Promise<T>, caracteres = 0, clase?: ClaseVoz): Promise<T> {
    if (tipo !== "audio") return this.extraIndividual(id, tipo, clave, tarea, caracteres);
    const solicitud = JSON.stringify([id, tipo, clave]);
    const pendiente = this.consultasEnCurso.get(solicitud);
    if (pendiente) return pendiente as Promise<T>;
    const trabajo = this.extraIndividual(id, tipo, clave, tarea, caracteres, clase);
    this.consultasEnCurso.set(solicitud, trabajo);
    try { return await trabajo; }
    finally { this.consultasEnCurso.delete(solicitud); }
  }
  private async extraIndividual<T>(id: string, tipo: "analisis" | "audio", clave: string, tarea: () => Promise<T>, caracteres = 0, clase?: ClaseVoz): Promise<T> {
    if ([...this.extrasActivos.values()].reduce((s, n) => s + n, 0) >= 2) throw new ErrorSesion("Hay otras consultas en curso; espera a que terminen", 429);
    this.archivo(id, "meta.json");
    this.extrasActivos.set(id, (this.extrasActivos.get(id) ?? 0) + 1);
    try { await this.obtener(id); return await this.ejecutarExtra(id, tipo, clave, tarea, caracteres, clase); }
    finally {
      const n = (this.extrasActivos.get(id) ?? 1) - 1; if (n) this.extrasActivos.set(id, n); else this.extrasActivos.delete(id);
      await this.liberarSiInactivo();
    }
  }
  private async ejecutarExtra<T>(id: string, tipo: "analisis" | "audio", clave: string, tarea: () => Promise<T>, caracteres: number, clase?: ClaseVoz): Promise<T> {
    await this.obtener(id);
    type Reservas = Record<string, { tipo: string; estado: "pendiente" | "completa" | "error"; archivo?: string; resultado?: T; caracteres?: number; clase?: ClaseVoz }>;
    const nombre = this.archivo(id, "extras.json");
    const cache = this.archivo(id, `${tipo}-${createHash("sha256").update(clave).digest("hex")}.json`);
    const exclusiva = async <R>(fn: (r: Reservas, a: AlmacenArena) => Promise<R>): Promise<R> => {
      const anterior = this.colaExtras;
      let liberar!: () => void; this.colaExtras = new Promise<void>(resolve => { liberar = resolve; });
      await anterior;
      try {
        await this.asegurarEscritura(); const a = await this.almacen();
        let reservas: Reservas;
        try { reservas = JSON.parse(await a.leer(nombre)) as Reservas; }
        catch (error) { if ((error as { code?: string }).code === "ENOENT" || (error as { statusCode?: number }).statusCode === 404) reservas = {}; else throw error; }
        return await fn(reservas, a);
      } finally { await this.liberarSiInactivo(); liberar(); }
    };
    const existente = await exclusiva(async (r, a) => {
      if (r[clave]) { if (r[clave].estado !== "completa") throw new ErrorSesion("Solicitud reservada o interrumpida; no se repetirá automáticamente", 409); return { valor: r[clave].archivo ? JSON.parse(await a.leer(r[clave].archivo)) as T : r[clave].resultado as T }; }
      // La voz expresiva reserva también el SSML; el texto hablado conserva
      // su límite de 6.000 y la reserva nunca supera el total por sesión.
      if (!Number.isInteger(caracteres) || caracteres < 0 || caracteres > 24_000) throw new ErrorSesion("Presupuesto de voz inválido", 400);
      const usadas = Object.values(r).filter(x => x.tipo === tipo).length, reservados = Object.values(r).reduce((s, x) => s + (x.caracteres ?? 0), 0);
      // El audio se presupuesta por clase en rechazoCuotaVoz (048 v1.3: narrador e invitados por separado).
      if (tipo === "analisis" && (usadas >= 2 || reservados + caracteres > PRESUPUESTO_AUDIO_ENCUENTRO.caracteres)) throw new ErrorSesion("Se alcanzó el límite de consultas de este encuentro", 429);
      // Brief 048 v1.3 (1): bolsa propia de los invitados y reserva del cierre, presupuestadas con el SSML.
      const cuota = tipo === "audio" ? rechazoCuotaVoz(Object.values(r), caracteres, clase ?? "narrador") : null;
      if (cuota) throw new ErrorSesion(cuota, 429);
      const diario = `servicios-${new Date().toISOString().slice(0, 10)}.json`;
      let total: Record<string, number>;
      try { total = JSON.parse(await a.leer(diario)); }
      catch (error) { if ((error as { code?: string }).code === "ENOENT" || (error as { statusCode?: number }).statusCode === 404) total = {}; else throw error; }
      // Brief 058 · C1: el tope diario de Speech vive en SPEECH_DIARIO; el análisis conserva sus 20 consultas.
      if ((total[tipo] ?? 0) >= (tipo === "analisis" ? 20 : SPEECH_DIARIO.audios) || (total.caracteres ?? 0) + caracteres > SPEECH_DIARIO.caracteres) throw new ErrorSesion("Presupuesto diario de este servicio agotado", 429);
      total[tipo] = (total[tipo] ?? 0) + 1; total.caracteres = (total.caracteres ?? 0) + caracteres; await a.escribir(diario, JSON.stringify(total));
      r[clave] = { tipo, estado: "pendiente", caracteres, ...(clase ? { clase } : {}) }; await a.escribir(nombre, JSON.stringify(r)); return null;
    });
    if (existente) return existente.valor;
    try {
      const valor = await tarea();
      await exclusiva(async (r, a) => { await a.escribir(cache, JSON.stringify(valor), true); r[clave] = { tipo, estado: "completa", archivo: cache, caracteres, ...(clase ? { clase } : {}) }; await a.escribir(nombre, JSON.stringify(r)); });
      return valor;
    } catch (error) {
      await exclusiva(async (r, a) => { r[clave] = { tipo, estado: "error", caracteres, ...(clase ? { clase } : {}) }; await a.escribir(nombre, JSON.stringify(r)); }).catch(() => {});
      throw error;
    }
  }
  /** Brief 058 § 4.7 · Asignación de controladores de la propia sesión (memoria o meta.json); la ruta nunca
   * acepta una que venga del cliente. */
  async asignacionPublicada(id: string): Promise<AsignacionModelos> {
    return (await this.obtener(id)).asignacion;
  }
  /** Brief 045: el audio de una intervención se construye desde el diario; nunca se regenera. */
  async intervencionPublicada(id: string, intervencionId: string): Promise<IntervencionArena> {
    const intervencion = intervencionesDe((await this.obtener(id)).mensajes).find(i => i.id === intervencionId);
    if (!intervencion) throw new ErrorSesion("Intervención no publicada", 404);
    return intervencion;
  }
  async comentarioPublicado(id: string, tick: number, principal: string) {
    const sesion = await this.obtener(id);
    const comentarios = sesion.mensajes.flatMap(m => m.publicacion.tipo === "comentario" ? [m.publicacion.comentario] : []);
    try {
      const almacen = await this.almacen();
      const extras = JSON.parse(await almacen.leer(this.archivo(id, "extras.json"))) as Record<string, { tipo: string; estado: string; archivo?: string; resultado?: { comentario?: import("./narrador").ComentarioArena } }>;
      for (const e of Object.values(extras)) if (e.tipo === "analisis" && e.estado === "completa") {
        const resultado = e.archivo ? JSON.parse(await almacen.leer(e.archivo)) as { comentario?: import("./narrador").ComentarioArena } : e.resultado;
        if (resultado?.comentario) comentarios.push(resultado.comentario);
      }
    } catch (error) { if ((error as { code?: string }).code !== "ENOENT" && (error as { statusCode?: number }).statusCode !== 404) throw error; }
    const comentario = comentarios.find(c => c.tick === tick && c.principal === principal);
    if (!comentario) throw new ErrorSesion("Comentario no publicado", 404);
    return comentario;
  }
  async escuchar(id: string, desde: number, signal: AbortSignal): Promise<Response> {
    const s = await this.obtener(id);
    if (!Number.isSafeInteger(desde) || desde < 0 || desde > s.mensajes.length) throw new ErrorSesion("Cursor de reconexión inválido", 400);
    if (s.suscriptores.size >= 12) throw new ErrorSesion("Demasiadas conexiones a este encuentro", 429);
    const encoder = new TextEncoder(); let cerrar = () => {};
    const stream = new ReadableStream<Uint8Array>({
      start: controller => {
        let cerrado = false, latido: ReturnType<typeof setInterval> | undefined;
        cerrar = () => {
          if (cerrado) return; cerrado = true; clearInterval(latido); s.suscriptores.delete(enviar); signal.removeEventListener("abort", cerrar);
          try { controller.close(); } catch { /* El lector ya cerró. */ }
        };
        const enviar = (m: MensajeSesion) => {
          if (cerrado) return;
          try {
            if ((controller.desiredSize ?? 0) <= 0) { cerrar(); return; }
            controller.enqueue(encoder.encode(`id: ${m.id}\nevent: arena\ndata: ${JSON.stringify(m)}\n\n`));
            if (m.publicacion.tipo === "terminada") cerrar();
          } catch { cerrar(); }
        };
        // El alta y la copia del prefijo son síncronas: ninguna publicación se pierde en medio.
        s.suscriptores.add(enviar);
        for (const mensaje of s.mensajes.slice(desde)) enviar(mensaje);
        if (s.estado !== "ejecutando") cerrar();
        if (!cerrado) {
          latido = setInterval(() => { try { controller.enqueue(encoder.encode(": keepalive\n\n")); } catch { cerrar(); } }, 15_000);
          signal.addEventListener("abort", cerrar, { once: true }); if (signal.aborted) cerrar();
        }
      },
      cancel: () => cerrar(),
    }, { highWaterMark: 16 * 1024 * 1024, size: parte => parte.byteLength });
    return new Response(stream, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" } });
  }
}

const compartido = globalThis as typeof globalThis & { __cronistaSesiones?: GestorSesiones };
export function gestorSesiones(): GestorSesiones { return compartido.__cronistaSesiones ??= new GestorSesiones(); }
export function respuestaErrorSesion(error: unknown): Response {
  // Brief 057 v1.1 § 9: el lector acotado responde su propio estado (413 / 400) y su mensaje.
  const tipificado = error instanceof ErrorSesion || error instanceof ErrorPeticion;
  return Response.json({ error: tipificado ? error.message : "No se pudo preparar el encuentro. Revisa la configuración del servidor." }, { status: tipificado ? error.status : 400, headers: { "cache-control": "no-store" } });
}
