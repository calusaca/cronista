import type { Llm } from "../lib/llm";
import { ARENA, MESA_ARENA, PRIORIDAD_EVENTO_ARENA } from "../sim/limites";
import { DisparadorEstadista } from "./estadista";
import { comentarArena, contextoNarradorArena } from "./narrador";
import type { IntervencionArena } from "./protocolo";
import type { EventoArena, RegistroArena } from "./tipos";

/** Brief 045 · Candidaturas de la mesa en el servidor: se generan UNA vez y se publican en
 * el diario. Ninguna regla depende de la escucha de un consumidor; leer o reconectar nunca
 * genera otra intervención. */
export class MesaSesion {
  readonly estadista = new DisparadorEstadista();
  ultimaCandidaturaComentaristaTick = 0;
  comentaristas = 0;
  private generando: Promise<void> | undefined;
  private cerrada = false;
  constructor(private opciones: { llm?: Llm; publicar: (i: IntervencionArena) => Promise<void>; signal?: AbortSignal; plazoMs?: number }) {}

  /** v3.1 · Tras cerrar, ninguna generación (en curso o futura) publica. La sesión la cierra en
   * su `finally`, antes de publicar `terminada`, en todos los caminos. */
  cerrar(): void { this.cerrada = true; }
  private vigente() { return !this.cerrada && !this.opciones.signal?.aborted; }

  /** Se llama tras incorporar cada avance al prefijo. */
  async avanzar(prefijo: RegistroArena, nuevos: readonly EventoArena[]): Promise<void> {
    if (this.cerrada) return;
    const tick = prefijo.final.tick;
    const dato = this.estadista.evaluar(prefijo, tick);
    if (dato && this.vigente()) await this.opciones.publicar(dato);
    this.programarComentarista(prefijo, nuevos);
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
    this.comentaristas++;
    this.generando = comentarArena(snapshot, tick, this.opciones.llm, { signal: this.opciones.signal, principal: disparo ? `arena:${disparo.id}` : undefined, tema: disparo?.tipo ?? "tiempo", plazoMs: this.opciones.plazoMs })
      .then(async intervencion => {
        // Una generación que resuelve tras el cierre se descarta: nada sigue a `terminada`.
        if (!intervencion || !this.vigente()) { this.comentaristas--; return; }
        this.ultimaCandidaturaComentaristaTick = tick;
        await this.opciones.publicar(intervencion);
      })
      .catch(() => {})
      .finally(() => { this.generando = undefined; });
    return true;
  }

  async esperar(): Promise<void> { await this.generando; }

  /** Espera la generación en curso y publica la candidatura final del estadista. */
  async final(registro: RegistroArena): Promise<void> {
    await this.generando;
    if (this.cerrada) return;
    const dato = this.estadista.evaluar(registro, registro.final.tick, true);
    if (dato && this.vigente()) await this.opciones.publicar(dato);
  }
}
