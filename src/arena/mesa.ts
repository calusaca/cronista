import type { Llm } from "../lib/llm";
import { ARENA, MESA_ARENA, PRIORIDAD_EVENTO_ARENA } from "../sim/limites";
import { comprobarTurnos, componerIntercambio, confirmarMemoria, memoriaDialogoVacia, type EntradaComposicion, type Intercambio, type MemoriaDialogo } from "./dialogo";
import { DisparadorEstadista, datosEstadista, intervencionEstadista, type DatoEstadista } from "./estadista";
import { comentarArena, contextoNarradorArena } from "./narrador";
import type { IntervencionArena } from "./protocolo";
import type { EventoArena, RegistroArena } from "./tipos";

/** Brief 045 · Candidaturas de la mesa en el servidor: se generan UNA vez y se publican en
 * el diario. Ninguna regla depende de la escucha de un consumidor; leer o reconectar nunca
 * genera otra intervención. Brief 048: cada candidatura se publica como intercambio de turnos
 * materializados (composición única, comprobada con D1–D5). */
export class MesaSesion {
  readonly estadista = new DisparadorEstadista();
  /** 048 · Memoria de plantillas y presentados; solo se confirma tras publicar. */
  readonly memoria: MemoriaDialogo = memoriaDialogoVacia();
  ultimaCandidaturaComentaristaTick = 0;
  comentaristas = 0;
  private generando: Promise<void> | undefined;
  private cerrada = false;
  private prefijoVigente: RegistroArena | undefined;
  /** v1.2 (3) · Cola única: composición, registro del dato, publicación y confirmación de memoria
   * de un intercambio terminan antes de que empiece el siguiente. */
  private cola: Promise<void> = Promise.resolve();
  private publicadas = new Set<string>();
  constructor(private opciones: {
    llm?: Llm; publicar: (i: IntervencionArena) => Promise<void>; signal?: AbortSignal; plazoMs?: number;
    /** Solo pruebas: sustituye la composición (p. ej., para forzar una composición inválida). */
    componer?: (entrada: EntradaComposicion) => Intercambio;
  }) {}

  /** v3.1 · Tras cerrar, ninguna generación (en curso o futura) publica. La sesión la cierra en
   * su `finally`, antes de publicar `terminada`, en todos los caminos. */
  cerrar(): void { this.cerrada = true; }
  private vigente() { return !this.cerrada && !this.opciones.signal?.aborted; }

  private enCola(tarea: () => Promise<void>): Promise<void> {
    const turno = this.cola.then(tarea);
    this.cola = turno.catch(() => {});
    return turno;
  }

  /** 048 · MesaSesion es la única que publica. Dentro de la cola: revalida el dato de mesa (si
   * lo hay) contra el prefijo vigente, compone, comprueba D1–D5 y publica; si D1–D5 fallan,
   * publica la candidatura sin `turnos` (camino del 045) con los motivos en `auditDialogo`. En
   * una ronda, el dato se registra antes de publicar y se deshace (comparar y restaurar) si la
   * publicación falla. La memoria solo se confirma tras publicar. */
  private publicarIntercambio(base: IntervencionArena, registro: RegistroArena, forma: EntradaComposicion["forma"], datoMesa?: DatoEstadista): Promise<void> {
    return this.enCola(() => this.componerYPublicar(base, registro, forma, datoMesa));
  }
  /** Cuerpo de un intercambio; solo se llama desde dentro de la cola. */
  private async componerYPublicar(base: IntervencionArena, registro: RegistroArena, forma: EntradaComposicion["forma"], datoMesa?: DatoEstadista): Promise<void> {
    {
      if (!this.vigente()) return;
      // v1.1 (7): revalidación síncrona; si el valor cambió o ya se emitió, la ronda es pregunta.
      const dato = forma === "ronda" && datoMesa && this.estadista.sigueVigente(datoMesa, this.prefijoVigente ?? registro) ? datoMesa : undefined;
      const intercambio = (this.opciones.componer ?? componerIntercambio)({ intervencion: base, registro, seed: registro.config.partido.seed, forma: forma === "ronda" && !dato ? "pregunta" : forma, dato, memoria: this.memoria });
      const motivos = comprobarTurnos(intercambio.intervencion, registro);
      const valida = motivos.length === 0;
      let publicada: IntervencionArena = valida ? intercambio.intervencion
        : { ...base, auditDialogo: { motivos, escalones: intercambio.intervencion.auditDialogo?.escalones ?? [] } };
      // v1.2 (4): un id ya publicado (p. ej., el final tras una emisión periódica en el mismo tick) no se repite.
      if (this.publicadas.has(publicada.id)) publicada = { ...publicada, id: `${publicada.id}:final` };
      const deshacer = valida && intercambio.conDato && dato ? this.estadista.registrar(dato, base.tick) : undefined;
      try { await this.opciones.publicar(publicada); }
      catch (error) { deshacer?.(); throw error; }
      this.publicadas.add(publicada.id);
      if (valida) confirmarMemoria(this.memoria, intercambio);
    }
  }

  /** Se llama tras incorporar cada avance al prefijo. Brief 048: un evento `cambio` hace vencer
   * al estadista en este mismo avance, con preferencia por el tema `cambios`. v1.3 (3): la
   * evaluación del estadista (que escribe su estado) entra en la cola de los intercambios. */
  async avanzar(prefijo: RegistroArena, nuevos: readonly EventoArena[]): Promise<void> {
    if (this.cerrada) return;
    this.prefijoVigente = prefijo;
    const tick = prefijo.final.tick;
    const cambio = nuevos.some(e => e.tipo === "cambio" && e.tick <= tick);
    const publicacion = this.enCola(async () => {
      if (!this.vigente()) return;
      const dato = this.estadista.evaluar(prefijo, tick, false, cambio ? { preferidos: ["cambios"], forzar: true } : {});
      if (dato) await this.componerYPublicar(dato, prefijo, "estadista");
    });
    this.programarComentarista(prefijo, nuevos);
    await publicacion;
  }

  /** Disparo por evento (prioridad ≥ comentaristaDesdePrioridad) o por tiempo; una generación
   * en curso bloquea otra; tope por sesión; el temporizador se rearma al publicar. */
  programarComentarista(prefijo: RegistroArena, nuevos: readonly EventoArena[]): boolean {
    if (this.cerrada || this.generando || this.comentaristas >= MESA_ARENA.maxComentaristaPorSesion) return false;
    const tick = prefijo.final.tick;
    const disparo = [...nuevos].reverse().find(e => e.tick <= tick && (PRIORIDAD_EVENTO_ARENA[e.tipo] ?? 0) >= MESA_ARENA.comentaristaDesdePrioridad);
    const porTiempo = tick - this.ultimaCandidaturaComentaristaTick >= Math.round(MESA_ARENA.comentaristaCadaS / ARENA.pasoS);
    if (!disparo && !porTiempo) return false;
    if (!contextoNarradorArena(prefijo, tick, MESA_ARENA.hechosComentarista).length) return false;
    const snapshot = structuredClone(prefijo);
    if (!this.prefijoVigente || this.prefijoVigente.final.tick <= tick) this.prefijoVigente = prefijo;
    // 048 · Dato de mesa: consulta sin consumir entre los temas del disparo.
    const temas = (MESA_ARENA.dialogo.temasPorDisparador as Record<string, readonly string[]>)[disparo?.tipo ?? "tiempo"] ?? [];
    const datoMesa = this.estadista.candidato(snapshot, tick, temas);
    this.comentaristas++;
    this.generando = comentarArena(snapshot, tick, this.opciones.llm, { signal: this.opciones.signal, principal: disparo ? `arena:${disparo.id}` : undefined, tema: disparo?.tipo ?? "tiempo", plazoMs: this.opciones.plazoMs, datoMesa: datoMesa?.hecho.id })
      .then(async intervencion => {
        // Una generación que resuelve tras el cierre se descarta: nada sigue a `terminada`.
        if (!intervencion || !this.vigente()) { this.comentaristas--; return; }
        this.ultimaCandidaturaComentaristaTick = tick;
        await this.publicarIntercambio(intervencion, snapshot, datoMesa ? "ronda" : "pregunta", datoMesa);
      })
      .catch(() => {})
      .finally(() => { this.generando = undefined; });
    return true;
  }

  /** Espera la generación y las publicaciones en curso. */
  async esperar(): Promise<void> { await this.generando; await this.cola; }

  /** Espera la generación en curso y publica SIEMPRE la candidatura final del estadista (forma
   * `final`, v1.2 (4)): los datos cambiados o, si no hay ninguno (p. ej., el periódico ya habló en
   * el tick final), los primeros datos de la tabla, que pueden repetir marcador y remates. */
  async final(registro: RegistroArena): Promise<void> {
    await this.generando;
    await this.cola;
    if (this.cerrada) return;
    this.prefijoVigente = registro;
    const tick = registro.final.tick;
    // v1.3 (3): también la evaluación final ocurre dentro de la cola.
    await this.enCola(async () => {
      if (!this.vigente()) return;
      const dato = this.estadista.evaluar(registro, tick, true)
        ?? intervencionEstadista(datosEstadista(registro, tick).filter(d => d.ocupaPlaza).slice(0, MESA_ARENA.maxDatosEstadista), tick);
      await this.componerYPublicar(dato, registro, "final");
    });
  }
}
