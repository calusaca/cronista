import type { EstadoArena, RegistroArena } from "./tipos";
import { ARENA } from "../sim/limites";

export const VOZ_BUFFER = { duracionMaxS: 24, atrasoNormalS: 3, atrasoImportanteS: 3, concurrencia: 2, silencioMaxS: 5, reservaTrasS: 2, prioridadInterrupcion: 35 } as const;
export const BUFFER_ARENA = { segundos: 20, tramoTicks: 50, recuperacionS: 10, adelantoAudioS: 25 } as const;

/** Identidad del estado descrito: un texto de posesión no arranca tras perderla. */
export function firmaEstadoVoz(estado: EstadoArena): string {
  const b = estado.balon, zona = `${b.posicion.x < 35 ? "izquierda" : b.posicion.x > 70 ? "derecha" : "centro"}:${b.posicion.y < 15 || b.posicion.y > 53 ? "banda" : "interior"}`;
  if (estado.saque && estado.pausa && estado.pausa.hastaTick > estado.tick) return `saque:${estado.saque.tipo}:${estado.saque.lado}:${estado.saque.hastaTick}`;
  if (b.vuelo) return `vuelo:${b.vuelo.autor}:${b.vuelo.inicioTick}:${zona}`;
  return `${b.poseedor ?? "libre"}:${zona}`;
}

/** El productor llena la reserva inicial y después sigue un reloj absoluto.
 * Una decisión lenta consume reserva; no añade su demora a todas las rondas. */
export class RitmoProduccionBuffer {
  private origen: number | undefined;
  constructor(private ahora = () => performance.now(), private msPorSegundo = 1000) {}
  espera(tick: number): number {
    const segundos = tick * ARENA.pasoS;
    if (segundos <= BUFFER_ARENA.segundos) {
      if (segundos === BUFFER_ARENA.segundos) this.origen ??= this.ahora();
      return 0;
    }
    this.origen ??= this.ahora();
    return Math.max(0, this.origen + (segundos - BUFFER_ARENA.segundos) * this.msPorSegundo - this.ahora());
  }
}

/** Reloj de presentación: solo los datos del partido limitan su avance.
 * Ningún consumidor de voz o análisis modifica su disponibilidad. */
export class RelojBuffer {
  segundo: number;
  estado: "preparando" | "reproduciendo" | "recuperando" | "pausada" | "final" = "preparando";
  constructor(inicioS = 0) { this.segundo = inicioS; }
  avanzar(deltaS: number, disponibleS: number, terminada: boolean): number {
    if (this.estado === "pausada" || this.estado === "final") return this.segundo;
    const reserva = Math.max(0, disponibleS - this.segundo);
    const objetivo = this.estado === "preparando" ? BUFFER_ARENA.segundos : BUFFER_ARENA.recuperacionS;
    if (this.estado !== "reproduciendo") {
      if (reserva + 1e-6 < objetivo && !terminada) return this.segundo;
      this.estado = "reproduciendo";
    }
    this.segundo = Math.min(disponibleS, this.segundo + Math.max(0, Math.min(.25, deltaS)));
    if (this.segundo >= disponibleS - 1e-6) this.estado = terminada ? "final" : "recuperando";
    return this.segundo;
  }
  pausar() { if (this.estado !== "final") this.estado = "pausada"; }
  continuar() { if (this.estado === "pausada") this.estado = "recuperando"; }
}

/** Evita mostrar planes de una ronda futura cuando el cursor aún no la alcanza. */
export function rondaVisible(registro: RegistroArena, tick: number) {
  return registro.rondas.find(r => tick >= r.inicioTick && tick < r.finTick)
    ?? [...registro.rondas].reverse().find(r => r.inicioTick <= tick);
}

/** La voz consume el cursor visible. Espera su instante, conserva velocidad natural
 * y deja pasar el partido cuando todavía no puede hablar. */
export function planVozBuffer(eventoS: number, duracionS: number, partidoS: number, ahoraAudioS: number, finAnteriorS: number, prioridad: number, prioridadAnterior = 0, cierre = false) {
  if (![eventoS, duracionS, partidoS, ahoraAudioS, finAnteriorS, prioridad, prioridadAnterior].every(Number.isFinite) || duracionS <= 0 || duracionS > VOZ_BUFFER.duracionMaxS || eventoS > partidoS + 1e-6) return null;
  const importante = prioridad >= VOZ_BUFFER.prioridadInterrupcion;
  if (!cierre && partidoS - eventoS > (importante ? VOZ_BUFFER.atrasoImportanteS : VOZ_BUFFER.atrasoNormalS)) return null;
  const ocupada = finAnteriorS > ahoraAudioS;
  if (ocupada && !(prioridadAnterior < 0 || importante && prioridad > prioridadAnterior)) return null;
  const cuando = ahoraAudioS + .03;
  return { cuando, velocidad: 1, fin: cuando + duracionS, interrumpirAnterior: ocupada };
}
