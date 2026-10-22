import type { PublicacionArena, RegistroArena } from "./tipos";
import type { ComentarioArena } from "./narrador";
import type { UsoLlm } from "../lib/llm";
import type { Oracion } from "../cadena/tipos";
import type { HechoVerificable } from "../cadena/verificador";

export const RELATO_INTERVALOS = { vivo: 30, completo: 100, buffer: 50 } as const;

export interface ModeloPublico { id: string; nombre: string; controlador: string }
export type SeleccionModelos = { modo: "programado" | "azar" } | { modo: "manual"; local: string; visita: string };
export interface AsignacionModelos { modo: SeleccionModelos["modo"]; local: ModeloPublico; visita: ModeloPublico }
export type EstadoSesion = "ejecutando" | "completa" | "cancelada" | "interrumpida" | "error";
export interface MetricasSesion { duracionMs: number; decisiones: number; respaldos: number; esperaModeloMs: number[]; solicitudesEquipo?: number; uso?: { local: UsoLlm | null; visita: UsoLlm | null; narrador: UsoLlm | null } }
/** Brief 045: roles de la mesa de transmisión. */
export type RolMesa = "narrador" | "comentarista" | "estadista";
/** Evidencia de un dato o una oración: eventos de la fórmula o, si el valor no procede
 * de eventos, el intervalo inspeccionado y su fuente (`inicial` o `fotograma:<tick>`).
 * Brief 056: la previa cita campos del registro (`config.partido`, `config.formaciones`,
 * `config.entrenadores`, `config.partido.condiciones`, `inicial.jugadores`, `inicial.arbitro`). */
export interface EvidenciaMesa {
  eventos: string[]; intervalo?: [number, number]; fuente?: string;
  /** v3.1 · Una entrada por hecho citado por la oración (principal y apoyos) que sea un dato
   * del estadista, copiada de su evidencia; `eventos` sigue siendo la unión. */
  citas?: CitaMesa[];
}
export interface CitaMesa { hecho: string; eventos: string[]; intervalo?: [number, number]; fuente?: string }
/** Brief 048 · Formas del intercambio. v1.1: la forma `dato` queda fuera de esta entrega (el tipo
 * la conserva por contrato, pero `componerIntercambio` nunca la produce y D2 la rechaza). */
export type FormaDialogo = "pregunta" | "dato" | "ronda" | "estadista" | "final" | "previa";
export type FuncionTurno = "pregunta" | "cesion" | "respuesta" | "dato" | "cierre";
export type VarianteIntercambio = "completa" | "breve";
export interface TurnoMesa {
  rol: RolMesa; funcion: FuncionTurno;
  /** Texto hablado completo del turno. */
  texto_es: string; texto_en: string;
  /** Índices en `intervencion.oraciones`, en orden. */
  oraciones: number[];
  /** "marco.repaso#2", "marco.estadista.remates#1", "cierre#0", "cesion.estadista#1"… */
  plantilla?: string;
  /** Turno C: índice de la oración que retoma (sin uso en v1.1: no hay forma `dato`). */
  conector?: { plantilla: string; antesDe: number };
  /** Hechos que dan valor a {jugador}/{accion}/tema; `refiere[0]` es el evento disparador. */
  refiere?: string[];
}
export interface AuditDialogo { motivos: { regla: "D1" | "D2" | "D3" | "D4" | "D5"; detalle: string }[]; escalones: string[] }
/** Candidatura generada UNA vez en el servidor y publicada en el diario de la sesión. */
export interface IntervencionArena {
  id: string; rol: Exclude<RolMesa, "narrador">; tick: number; tema: string;
  oraciones: Oracion[]; hechos: HechoVerificable[]; evidencia: EvidenciaMesa[];
  audit: ComentarioArena["audit"]; modo: "llm" | "plantilla" | "determinista"; modelo?: string;
  /** Brief 048 (opcionales; las intervenciones del 045 siguen siendo válidas). */
  forma?: FormaDialogo; turnos?: TurnoMesa[]; turnosBreve?: TurnoMesa[]; auditDialogo?: AuditDialogo;
}
export type PublicacionSesion = PublicacionArena
  | { tipo: "sesion"; id?: string; asignacion: AsignacionModelos }
  | { tipo: "comentario"; comentario: ComentarioArena }
  | { tipo: "intervencion"; intervencion: IntervencionArena }
  | { tipo: "terminada"; estado: Exclude<EstadoSesion, "ejecutando">; metricas: MetricasSesion };
export interface MensajeSesion { id: number; publicacion: PublicacionSesion }
export type PresentacionArena = "preparada" | "directo" | "buffer";
export interface ReproduccionArena { registro: RegistroArena; comentarios: ComentarioArena[]; intervenciones: IntervencionArena[]; asignacion: AsignacionModelos; metricas: MetricasSesion }
export interface InstantaneaEmision extends ReproduccionArena { estado: EstadoSesion; ultimoMensaje: number }

/** Reconstruye el prefijo que ya confirmó el servidor, sin fabricar un final. */
export function aplicarPublicacion(registro: RegistroArena | null, p: PublicacionSesion): RegistroArena | null {
  if (p.tipo === "inicio") return { version: p.version, config: p.config, inicial: p.inicial, rondas: [], eventos: [], fotogramas: [p.inicial], final: p.inicial };
  if (!registro) return null;
  if (p.tipo === "ordenes" || p.tipo === "ronda") {
    const rondas = registro.rondas.filter(r => r.inicioTick !== p.ronda.inicioTick);
    return { ...registro, rondas: [...rondas, p.ronda].sort((a, b) => a.inicioTick - b.inicioTick) };
  }
  if (p.tipo === "avance") {
    if (p.estado.tick <= registro.final.tick || p.eventos.some(e => e.tick > p.estado.tick)) throw new Error("Secuencia de publicaciones inválida");
    return { ...registro, eventos: [...registro.eventos, ...p.eventos], fotogramas: [...registro.fotogramas, ...p.fotogramas], final: p.estado };
  }
  return registro;
}
