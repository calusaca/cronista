import { z } from "zod";
import { ARENA } from "../sim/limites";
import type { Lado, SimConfig } from "../sim/tipos";

export const lados: readonly Lado[] = ["local", "visita"];
export const formaciones = ["4-3-3", "4-2-3-1", "4-4-2"] as const;
export type FormacionArena = (typeof formaciones)[number];
export interface Punto { x: number; y: number }
export interface JugadorArena {
  id: string; lado: Lado; nombre: string; dorsal: number; puesto: string;
  nivel: number; posicion: Punto; velocidad: Punto; energia: number;
}
export interface Vuelo {
  tipo: "pase" | "tiro"; autor: string; lado: Lado; receptor: string | null;
  origen: Punto; destino: Punto; inicioTick: number; adelantados: string[];
}
export interface EstadoArena {
  tick: number;
  jugadores: JugadorArena[];
  balon: { posicion: Punto; poseedor: string | null; vuelo: Vuelo | null };
  marcador: Record<Lado, number>;
}
export interface ConfigArena {
  partido: SimConfig;
  formaciones: Record<Lado, FormacionArena>;
  duracionS: number; intervaloS: number;
}
export type TipoEventoArena = "pase" | "recepcion" | "intercepcion" | "recuperacion" | "tiro" | "gol" | "atajada" | "tiro_fuera" | "fuera_juego" | "reinicio";
export interface EventoArena {
  id: string; tick: number; tipo: TipoEventoArena; lado: Lado; jugador: string;
  receptor: string | null; desde: Punto; hasta: Punto; distanciaM: number;
}
const punto = z.strictObject({ x: z.number().min(0).max(ARENA.largoM), y: z.number().min(0).max(ARENA.anchoM) });
export const esquemaOrdenes = z.strictObject({
  observacion: z.string().min(1).max(80),
  lado: z.enum(["local", "visita"]),
  intencion: z.string().min(1).max(300),
  amplitud: z.enum(["estrecha", "media", "amplia"]),
  bloque: z.enum(["bajo", "medio", "alto"]),
  ordenes: z.array(z.strictObject({
    jugador: z.string().min(1).max(40),
    accion: z.enum(["mover", "apoyar", "profundidad", "cubrir", "presionar", "conducir", "pasar", "tirar"]),
    destino: punto,
    receptor: z.string().min(1).max(40).nullable(),
  })).length(11),
});
export type OrdenesEquipo = z.infer<typeof esquemaOrdenes>;
export type OrdenJugador = OrdenesEquipo["ordenes"][number];
export interface ObservacionArena {
  id: string; lado: Lado; tiempoS: number; horizonteS: number;
  estado: EstadoArena;
  equipos: Record<Lado, { nombre: string; ataque: number; defensa: number; estilo: string; formacion: FormacionArena }>;
  condiciones: SimConfig["condiciones"] | null;
  recientes: EventoArena[];
}
export interface ControladorEquipo {
  readonly id: string;
  readonly tipo: "programado" | "llm";
  decidir(observacion: ObservacionArena, signal: AbortSignal): Promise<unknown>;
}
export interface DecisionArena {
  controlador: string; tipo: "programado" | "llm";
  origen: "controlador" | "respaldo";
  motivo: "valida" | "orden_invalida" | "error_controlador" | "plazo_agotado";
  tiempoMs: number;
  ordenes: OrdenesEquipo;
}
export interface RondaArena {
  observacion: string; inicioTick: number; finTick: number;
  decisiones: Record<Lado, DecisionArena>;
}
export interface RegistroArena {
  version: typeof ARENA.version;
  config: ConfigArena;
  inicial: EstadoArena;
  rondas: RondaArena[];
  eventos: EventoArena[];
  fotogramas: EstadoArena[];
  final: EstadoArena;
}
export const rival = (lado: Lado): Lado => lado === "local" ? "visita" : "local";
export const tiempoS = (estado: Pick<EstadoArena, "tick">): number => estado.tick * ARENA.pasoS;
