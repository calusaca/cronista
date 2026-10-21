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
 * de eventos, el intervalo inspeccionado y su fuente (`inicial` o `fotograma:<tick>`). */
export interface EvidenciaMesa {
  eventos: string[]; intervalo?: [number, number]; fuente?: string;
  /** v3.1 · Una entrada por hecho citado por la oración (principal y apoyos) que sea un dato
   * del estadista, copiada de su evidencia; `eventos` sigue siendo la unión. */
  citas?: CitaMesa[];
}
export interface CitaMesa { hecho: string; eventos: string[]; intervalo?: [number, number]; fuente?: string }
/** Candidatura generada UNA vez en el servidor y publicada en el diario de la sesión. */
export interface IntervencionArena {
  id: string; rol: Exclude<RolMesa, "narrador">; tick: number; tema: string;
  oraciones: Oracion[]; hechos: HechoVerificable[]; evidencia: EvidenciaMesa[];
  audit: ComentarioArena["audit"]; modo: "llm" | "plantilla" | "determinista"; modelo?: string;
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
