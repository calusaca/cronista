import { ARENA, MESA_ARENA } from "../sim/limites";
import { VOZ_BUFFER } from "./buffer";
import type { RecuerdoVoz } from "./editorial";

/** Brief 045 · Coordinador de turnos de la mesa. Función pura: no lee el DOM ni Web Audio. */
export type Rol = "narrador" | "comentarista" | "estadista";
export interface CandidataTurno { id: string; rol: Rol; tick: number; duracionS: number }
export interface EntradaTurno {
  partidoS: number;                 // cursor visible
  ahoraAudioS: number;              // reloj Web Audio
  fuenteActiva: { rol: Rol; prioridad: number; finS: number } | null; // reservas incluidas (prioridad −1)
  finUltimaNoticiaS: number | null; // fin (reloj de audio) del último clip del narrador con prioridad ≥ VOZ_BUFFER.prioridadInterrupcion; null si aún no hubo
  finUltimoInvitadoS: number | null; ultimoInvitado: { rol: Rol; tick: number } | null;
  pausaVigente: boolean;            // estado.pausa.hastaTick > tick en el fotograma del cursor
  terminada: boolean; cerrando: boolean;
  aperturaPendiente: boolean;       // v3.1: la entrada del narrador aún no sonó (pedida, en vuelo o decodificada sin consumir)
  candidatas: CandidataTurno[];     // solo con audio decodificado
}

const edadS = (c: CandidataTurno, e: EntradaTurno) => e.partidoS - c.tick * ARENA.pasoS;
/** Caducidad propia del invitado (no el atraso del narrador): ni vieja ni futura. */
const vigente = (c: CandidataTurno, e: EntradaTurno) => c.rol !== "narrador" && edadS(c, e) <= MESA_ARENA.caducidadInvitadoS && c.tick * ARENA.pasoS <= e.partidoS + 1e-6
  && Number.isFinite(c.duracionS) && c.duracionS > 0 && c.duracionS <= VOZ_BUFFER.duracionMaxS;

/** Candidaturas que ya no pueden sonar: caducadas, con duración inválida o superadas por
 * una más reciente del mismo rol que ya alcanzó el cursor. */
export function descartesTurno(e: EntradaTurno): string[] {
  const fuera = e.candidatas.filter(c => c.rol === "narrador" || edadS(c, e) > MESA_ARENA.caducidadInvitadoS || !(Number.isFinite(c.duracionS) && c.duracionS > 0 && c.duracionS <= VOZ_BUFFER.duracionMaxS)).map(c => c.id);
  const superadas = e.candidatas.filter(c => vigente(c, e) && e.candidatas.some(o => o.rol === c.rol && o.tick > c.tick && vigente(o, e))).map(c => c.id);
  return [...new Set([...fuera, ...superadas])];
}

/** Los invitados nunca interrumpen: solo con ninguna fuente audible, en calma (o en pausa),
 * separados del invitado anterior y nunca tras el final. Alterna roles. v3.1: la entrada del
 * narrador precede siempre a los invitados, aunque su audio llegue más tarde. */
export function siguienteTurno(e: EntradaTurno): { id: string; recuerdo: RecuerdoVoz } | null {
  if (e.fuenteActiva !== null || e.terminada || e.cerrando || e.aperturaPendiente) return null;
  const calma = e.finUltimaNoticiaS === null || e.ahoraAudioS - e.finUltimaNoticiaS >= MESA_ARENA.calmaMinS || e.pausaVigente;
  if (!calma) return null;
  if (e.finUltimoInvitadoS !== null && e.ahoraAudioS - e.finUltimoInvitadoS < MESA_ARENA.separacionInvitadosS) return null;
  const vigentes = e.candidatas.filter(c => vigente(c, e));
  const orden: Rol[] = e.ultimoInvitado?.rol === "comentarista" ? ["estadista", "comentarista"] : ["comentarista", "estadista"];
  for (const rol of orden) {
    const c = vigentes.filter(c => c.rol === rol).sort((a, b) => b.tick - a.tick)[0];
    // v3.1: `texto = id`, nunca el texto hablado; el consumidor lo añade tal cual, solo al arrancar.
    if (c) return { id: c.id, recuerdo: { tick: Math.floor(e.partidoS / ARENA.pasoS + 1e-9), texto: c.id, clave: c.id, tema: rol, estado: "iniciada", rol } };
  }
  return null;
}

interface SegmentoRecibido {
  desdeTick: number; hastaTick: number; idioma: string; modo: string; entradaTick?: number; texto: string;
  fragmentos: { tick: number }[]; audio: unknown; tipoRelato?: string; intervencion?: string;
}
/** Validación del consumidor. Solo `tipoRelato: "invitado"` admite dos fragmentos
 * (cesión + invitado), todos con el tick de la intervención y audio obligatorio. */
export function segmentoVozValido(s: SegmentoRecibido, esperado: { desde: number; hasta: number; idioma: string; entradaTick?: number; intervencion?: { id: string; tick: number } }): boolean {
  if (s.desdeTick !== esperado.desde || s.hastaTick !== esperado.hasta || s.idioma !== esperado.idioma || s.modo !== "buffer") return false;
  if (esperado.intervencion || s.tipoRelato === "invitado") {
    const i = esperado.intervencion;
    return !!i && s.tipoRelato === "invitado" && s.intervencion === i.id && s.entradaTick === undefined && !!s.texto && !!s.audio
      && s.fragmentos.length >= 1 && s.fragmentos.length <= MESA_ARENA.fragmentosPorIntervencion && s.fragmentos.every(f => f.tick === i.tick);
  }
  return !(s.entradaTick !== esperado.entradaTick || s.fragmentos.length > 1 || s.fragmentos.some(f => f.tick < esperado.desde || f.tick > esperado.hasta) || s.texto && !s.audio || s.audio && s.fragmentos.length !== 1);
}
