import { z } from "zod";
import { ARENA, TECNICA_ARENA } from "../sim/limites";
import type { Lado, Posicion, SimConfig } from "../sim/tipos";

export const lados: readonly Lado[] = ["local", "visita"];
export const formaciones = ["4-3-3", "4-2-3-1", "4-4-2", "4-1-4-1", "4-1-2-1-2", "3-5-2", "3-4-3", "4-3-1-2", "4-2-2-2", "3-4-2-1", "5-3-2", "5-4-1"] as const;
export type FormacionArena = (typeof formaciones)[number];
export type VersionArena = typeof ARENA.version | typeof ARENA.versionPersonalidades | typeof ARENA.versionLegado;
/** Las reglas archivadas se siguen aceptando y reproduciendo sin cambios; las nuevas usan ARENA.reglas. */
/** Brief 046: "reinicios-v3" es literal; el orden de la lista es el de las versiones (`reglasDesde`). */
export const reglasArena = ["reinicios-v1", "reinicios-v2", "reinicios-v3", ARENA.reglas] as const;
export type ReglasArena = (typeof reglasArena)[number];
export const perfilesEntrenador = ["posicional", "presion", "reactivo", "vertical", "adaptable"] as const;
export type PerfilEntrenador = (typeof perfilesEntrenador)[number];
export interface EntrenadorArena {
  nombre: string; perfil: PerfilEntrenador; preferidas: FormacionArena[];
  ofensiva: number; defensiva: number; presion: number; verticalidad: number;
  amplitud: number; riesgo: number; adaptabilidad: number; paciencia: number;
  rotacion: number; serenidad: number;
}
export type Mentalidad = "conservar" | "equilibrar" | "buscar";
export interface PlanTecnico {
  amplitud: "estrecha" | "media" | "amplia";
  bloque: "bajo" | "medio" | "alto";
  ritmo: "pausado" | "normal" | "alto";
  mentalidad: Mentalidad;
}
export interface ParSustitucion { sale: string; entra: string }
export interface GestionEquipo {
  formacion: FormacionArena | null; mentalidad: Mentalidad;
  /** Brief 044: un par (forma original) o hasta TECNICA_ARENA.cambiosPorVentana pares en la misma ventana. */
  sustitucion: ParSustitucion | ParSustitucion[] | null;
  motivo: string; fuentes: string[];
}
export interface EstadoEntrenador {
  formacion: FormacionArena; plan: PlanTecnico;
  confianza: number; frustracion: number; urgencia: number;
  proximaRevisionTick: number; ultimaRevisionTick: number; ultimoPlanTick: number;
  cambios: number; ventanas: number; ultimoCambioTick: number;
  pendiente: GestionEquipo["sustitucion"];
  ultimaDecision: { tick: number; motivo: string; fuentes: string[] } | null;
}
export interface ResumenEquipo {
  pases: number; recepciones: number; perdidas: number; tiros: number;
  goles: number; energiaMedia: number; fuentes: string[];
}
export interface AficionArena { sector: string; canto: { es: string; en: string } }
export interface EstadoAficion { animo: number; reaccion: "atencion" | "aliento" | "rugido" | "silbidos" | "silencio"; evento: string | null }
export interface Punto { x: number; y: number }
export const perfilesJugador = ["defensivo", "ofensivo", "pasador", "conductor", "rematador", "equilibrado"] as const;
export type PerfilJugador = (typeof perfilesJugador)[number];
export interface PersonalidadJugador {
  perfil: PerfilJugador;
  defensiva: number; ofensiva: number; pase: number; conduccion: number; remate: number;
  agresividad: number; disciplina: number; compostura: number; liderazgo: number;
}
export interface JugadorArena {
  id: string; lado: Lado; nombre: string; dorsal: number; puesto: string;
  nivel: number; posicion: Punto; velocidad: Punto; energia: number;
  /** Desde arena-v2; la capitanía es un rol independiente del perfil. */
  personalidad?: PersonalidadJugador; capitan?: boolean;
  posicionNatural?: Posicion; amarillas?: number;
}
export interface ArbitroArena {
  id: "arbitro"; nombre: string; posicion: Punto; velocidad: Punto;
  criterioContacto?: number;
  ultimaDecision?: { tick: number; evento: string; tipo: "falta" | "amarilla" | "roja" } | null;
}
export type TipoReinicioArena = "centro" | "banda" | "esquina" | "meta";
export interface SaqueArena { tipo: TipoReinicioArena; lado: Lado; ejecutor: string; punto: Punto; hastaTick: number }
export interface Vuelo {
  /** "rechace" (reinicios-v3): balón suelto tras el desvío del portero. Su autor es el portero
   * (último toque, autogol si entra en su arco) pero conserva el `lado` del remate original;
   * quien lo recoja genera una `recuperacion` sin relación. */
  tipo: "pase" | "tiro" | "rechace"; autor: string; lado: Lado; receptor: string | null;
  origen: Punto; destino: Punto; inicioTick: number; adelantados: string[];
  reinicio?: TipoReinicioArena;
  /** Brief 046 (reinicios-v4): centro con fase aérea; solo se toca cerca de su destino. */
  centro?: true;
  /** Brief 046 v1.2: saque largo del portero desde las manos; misma fase aérea que el centro. */
  aereo?: true;
}
export interface EstadoArena {
  tick: number;
  jugadores: JugadorArena[];
  balon: { posicion: Punto; poseedor: string | null; vuelo: Vuelo | null; ultimoToque?: { jugador: string; lado: Lado };
    /** Brief 046 (reinicios-v4): el portero tiene el balón en las manos dentro de su área y no se
     * le puede disputar. Desaparece en cuanto el motor reasigna el balón. */
    manos?: { portero: string; desdeTick: number; hastaTick: number } };
  saque?: SaqueArena | null;
  marcador: Record<Lado, number>;
  arbitro?: ArbitroArena;
  banco?: JugadorArena[]; retirados?: JugadorArena[]; expulsados?: JugadorArena[];
  entrenadores?: Record<Lado, EstadoEntrenador>;
  aficion?: Record<Lado, EstadoAficion>;
  pausa?: { hastaTick: number; lado: Lado; punto: Punto; motivo: "falta" | "reinicio" } | null;
  finalizado?: { tick: number; motivo: "menos_de_siete" } | null;
}
export interface ConfigArena {
  /** Ausente en archivos arena-v1; nunca se actualizan al reproducirlos. */
  version?: VersionArena;
  reglas?: ReglasArena;
  partido: SimConfig;
  formaciones: Record<Lado, FormacionArena>;
  entrenadores?: Record<Lado, EntrenadorArena>;
  aficiones?: Record<Lado, AficionArena>;
  duracionS: number; intervaloS: number;
}
export type TipoEventoArena = "pase" | "recepcion" | "intercepcion" | "recuperacion" | "tiro" | "gol" | "atajada" | "tiro_fuera" | "fuera_juego" | "reinicio" | "plan_equipo" | "cambio" | "falta" | "amarilla" | "roja" | "final_anticipado";
export interface EventoArena {
  id: string; tick: number; tipo: TipoEventoArena; lado: Lado; jugador: string;
  receptor: string | null; desde: Punto; hasta: Punto; distanciaM: number;
  sale?: string; entrenador?: string; motivo?: string; fuentes?: string[];
  formacion?: FormacionArena;
  gravedad?: "imprudente" | "temeraria" | "fuerza_excesiva";
  dobleAmarilla?: boolean; reinicio?: TipoReinicioArena; ultimoToque?: string; autogol?: boolean;
}
const parSustitucion = z.strictObject({ sale: z.string().max(40), entra: z.string().max(40) });
/** Ambas formas de `gestion.sustitucion` como lista; null o ausente es una lista vacía. */
export const paresSustitucion = (s: GestionEquipo["sustitucion"] | undefined): ParSustitucion[] => !s ? [] : Array.isArray(s) ? s : [s];
const punto = z.strictObject({ x: z.number().min(0).max(ARENA.largoM), y: z.number().min(0).max(ARENA.anchoM) });
export const esquemaOrdenes = z.strictObject({
  observacion: z.string().min(1).max(80),
  lado: z.enum(["local", "visita"]),
  intencion: z.string().min(1).max(300),
  amplitud: z.enum(["estrecha", "media", "amplia"]),
  bloque: z.enum(["bajo", "medio", "alto"]),
  ordenes: z.array(z.strictObject({
    jugador: z.string().min(1).max(40),
    accion: z.enum(["mover", "apoyar", "profundidad", "cubrir", "presionar", "conducir", "pasar", "tirar", "centrar"]),
    destino: punto,
    receptor: z.string().min(1).max(40).nullable(),
  })).min(1).max(11),
  gestion: z.strictObject({
    formacion: z.enum(formaciones).nullable(), mentalidad: z.enum(["conservar", "equilibrar", "buscar"]),
    sustitucion: z.union([parSustitucion, z.array(parSustitucion).min(1).max(TECNICA_ARENA.cambiosPorVentana)]).nullable(),
    motivo: z.string().min(1).max(200), fuentes: z.array(z.string().max(40)).max(8),
  }).nullable().optional(),
});
export type OrdenesEquipo = z.infer<typeof esquemaOrdenes>;
export type OrdenJugador = OrdenesEquipo["ordenes"][number];
export interface ObservacionArena {
  id: string; lado: Lado; tiempoS: number; horizonteS: number;
  duracionS?: number;
  estado: EstadoArena;
  equipos: Record<Lado, { nombre: string; ataque: number; defensa: number; estilo: string; formacion: FormacionArena; entrenador?: EntrenadorArena }>;
  condiciones: SimConfig["condiciones"] | null;
  recientes: EventoArena[];
  resumen?: Record<Lado, ResumenEquipo>;
}
export interface ControladorEquipo {
  readonly id: string;
  readonly tipo: "programado" | "llm";
  decidir(observacion: ObservacionArena, signal: AbortSignal): Promise<unknown>;
  llamadasUltimaDecision?: () => number;
}
export interface DecisionArena {
  controlador: string; tipo: "programado" | "llm";
  origen: "controlador" | "respaldo";
  motivo: "valida" | "orden_invalida" | "error_controlador" | "plazo_agotado";
  tiempoMs: number;
  ordenes: OrdenesEquipo;
  llamadas?: number;
}
export interface RondaArena {
  observacion: string; inicioTick: number; finTick: number;
  decisiones: Record<Lado, DecisionArena>;
}
export interface RegistroArena {
  version: VersionArena;
  config: ConfigArena;
  inicial: EstadoArena;
  rondas: RondaArena[];
  eventos: EventoArena[];
  fotogramas: EstadoArena[];
  final: EstadoArena;
}
/** Publicaciones confirmadas del servidor. Un avance nunca contiene el futuro. */
export type PublicacionArena =
  | { tipo: "inicio"; version: VersionArena; config: ConfigArena; inicial: EstadoArena }
  | { tipo: "esperando"; tick: number }
  | { tipo: "ordenes"; ronda: RondaArena }
  | { tipo: "avance"; estado: EstadoArena; eventos: EventoArena[]; fotogramas: EstadoArena[] }
  | { tipo: "ronda"; ronda: RondaArena }
  | { tipo: "fin"; tick: number };
export const rival = (lado: Lado): Lado => lado === "local" ? "visita" : "local";
export const tiempoS = (estado: Pick<EstadoArena, "tick">): number => estado.tick * ARENA.pasoS;
