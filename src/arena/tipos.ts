import { z } from "zod";
import { ARENA, TECNICA_ARENA } from "../sim/limites";
import type { Lado, Posicion, SimConfig } from "../sim/tipos";

export const lados: readonly Lado[] = ["local", "visita"];
export const formaciones = ["4-3-3", "4-2-3-1", "4-4-2", "4-1-4-1", "4-1-2-1-2", "3-5-2", "3-4-3", "4-3-1-2", "4-2-2-2", "3-4-2-1", "5-3-2", "5-4-1"] as const;
export type FormacionArena = (typeof formaciones)[number];
export type VersionArena = typeof ARENA.version | typeof ARENA.versionPersonalidades | typeof ARENA.versionLegado;
/** Las reglas archivadas se siguen aceptando y reproduciendo sin cambios; las nuevas usan ARENA.reglas. */
/** Brief 046: "reinicios-v3" es literal; el orden de la lista es el de las versiones (`reglasDesde`).
 * Brief 051: "reinicios-v4" también es literal; ARENA.reglas es reinicios-v5.
 * Brief 063 (publicación 1): "reinicios-v5" también es literal; ARENA.reglas es reinicios-v6.
 * Brief 063 (publicación 2): "reinicios-v6" también es literal; ARENA.reglas es reinicios-v7.
 * Brief 063 (publicación 3): "reinicios-v7" también es literal; ARENA.reglas es reinicios-v8.
 * Brief 065: "reinicios-v8" también es literal; ARENA.reglas es reinicios-v9.
 * Brief 068: "reinicios-v9" también es literal; ARENA.reglas es reinicios-v10.
 * Brief 070: "reinicios-v10" también es literal; ARENA.reglas es reinicios-v11. */
export const reglasArena = ["reinicios-v1", "reinicios-v2", "reinicios-v3", "reinicios-v4", "reinicios-v5", "reinicios-v6", "reinicios-v7", "reinicios-v8", "reinicios-v9", "reinicios-v10", ARENA.reglas] as const;
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
/** Brief 063 § 4.6: línea de un puesto (`lineaDePuesto`). */
export type LineaArena = "POR" | "DEF" | "MED" | "DEL";
/** Brief 063 (reinicios-v6): persecución tras pérdida activa. Desde v6 la clave existe siempre en el
 * estado y vale null o este objeto; en v1–v5 no existe. */
export interface PersecucionArena { jugador: string; lado: Lado; desdeTick: number; hastaTick: number }
/** Brief 063 § 4.1 (reinicios-v7): seis atributos enteros en [ATRIBUTOS_ARENA.min, .max] por jugador. */
export const atributosJugador = ["velocidad", "resistencia", "aguante", "entrada", "vision", "potencia"] as const;
export type AtributoJugador = (typeof atributosJugador)[number];
export type AtributosJugador = Record<AtributoJugador, number>;
/** Brief 063 § 4.1 (reinicios-v8): identidad de juego del club, derivada de su nombre. */
export const estilosJuego = ["defensivo", "ofensivo", "posesion", "contragolpe", "directo", "presion"] as const;
export type EstiloJuego = (typeof estilosJuego)[number];
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
/** Brief 070 (reinicios-v11): "libre" (tiro libre desde el punto de la falta) y "penal" (falta dentro del área). */
export type TipoReinicioArena = "centro" | "banda" | "esquina" | "meta" | "libre" | "penal";
/** `falta` (brief 070, solo en "libre" y "penal"): id del evento `falta` que lo originó. */
export interface SaqueArena { tipo: TipoReinicioArena; lado: Lado; ejecutor: string; punto: Punto; hastaTick: number; falta?: string }
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
  /** Brief 051 (reinicios-v5), solo en remates: potencia ∈ [0, 1] (velocidad del vuelo y desvío). */
  potencia?: number;
  /** Brief 051 (reinicios-v5): remate por encima del travesaño (probabilidad modelada, sin altura
   * simulada). Nadie lo toca y al cruzar la línea de fondo es `tiro_fuera` con `motivo: "alto"`. */
  alto?: true;
  /** Brief 063 (reinicios-v7), solo en remates desde más de ARENA.radioTiroM: el portero va a la trayectoria. */
  lejano?: true;
  /** Brief 070 (reinicios-v11), solo en el remate de un penal: desenlace ya decidido (PENAL_ARENA) e id del `tiro`.
   * Nadie toca el balón en vuelo; «atajada» termina en las manos del portero al llegar a su destino. */
  penal?: { desenlace: "gol" | "atajada" | "fuera"; tiro: string };
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
  /** Brief 063 (reinicios-v6): siempre presente (null o la persecución activa); ausente en v1–v5. */
  persecucion?: PersecucionArena | null;
}
export interface ConfigArena {
  /** Ausente en archivos arena-v1; nunca se actualizan al reproducirlos. */
  version?: VersionArena;
  reglas?: ReglasArena;
  partido: SimConfig;
  formaciones: Record<Lado, FormacionArena>;
  entrenadores?: Record<Lado, EntrenadorArena>;
  aficiones?: Record<Lado, AficionArena>;
  /** Brief 063 § 4.2 (desde reinicios-v7, y solo entonces): los atributos de los 2 × min(16, plantilla) IDs, por ID. */
  atributos?: Record<string, AtributosJugador>;
  /** Brief 063 § 4.3 (desde reinicios-v8, y solo entonces): la identidad de juego de cada club. */
  estilosJuego?: Record<Lado, EstiloJuego>;
  duracionS: number; intervaloS: number;
}
export type TipoEventoArena = "pase" | "recepcion" | "intercepcion" | "recuperacion" | "tiro" | "gol" | "atajada" | "tiro_fuera" | "fuera_juego" | "reinicio" | "plan_equipo" | "cambio" | "falta" | "amarilla" | "roja" | "final_anticipado";
export interface EventoArena {
  id: string; tick: number; tipo: TipoEventoArena; lado: Lado; jugador: string;
  receptor: string | null; desde: Punto; hasta: Punto; distanciaM: number;
  /** `motivo`: p. ej. "desvio" (atajada), "centro"/"saque_manos"/"largo" (pase), "alto" (tiro_fuera, brief 051),
   * "lejano" (tiro, brief 063), "libre"/"penal" (tiro, brief 070). */
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
  /** Brief 063 (reinicios-v7): `atributos` con los IDs de ese lado (titulares y banco); (reinicios-v8) `estiloJuego`. */
  equipos: Record<Lado, { nombre: string; ataque: number; defensa: number; estilo: string; formacion: FormacionArena; entrenador?: EntrenadorArena; atributos?: Record<string, AtributosJugador>; estiloJuego?: EstiloJuego }>;
  condiciones: SimConfig["condiciones"] | null;
  recientes: EventoArena[];
  resumen?: Record<Lado, ResumenEquipo>;
  /** Brief 068 § 2.B (desde reinicios-v10, y solo entonces): la línea de fuera de juego de cada lado en el instante de
   * la observación. `linea` es la x ABSOLUTA (no orientada) con un decimal de `lineaFueraDeJuego`; `propia` es la que
   * deben respetar los atacantes de `lado` y `adelantados` sus IDs propios adelantados (`adelantados(estado, lado)`);
   * `rival`, la que deben respetar los atacantes rivales. */
  fueraDeJuego?: FueraDeJuegoObservado;
}
/** Brief 068 § 2.B · la línea de fuera de juego en la observación (ver `ObservacionArena.fueraDeJuego`). */
export interface FueraDeJuegoObservado { propia: { linea: number; adelantados: string[] }; rival: { linea: number } }
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
