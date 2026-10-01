// Contrato del simulador — brief 001 (docs/disenos/001-simulador.md).
// Los nombres y propiedades de este archivo NO se cambian sin actualizar el brief.

export type Estilo = "posesion" | "contragolpe" | "presion";

export type Posicion = "POR" | "DEF" | "MED" | "DEL";

/**
 * El brief usa `Jugador[]` sin definirlo. Definición mínima del implementador
 * (pendiente de validación por Fable): el nombre es único dentro del partido y es
 * lo que viaja en `Evento.jugador`.
 */
export interface Jugador {
  nombre: string; // ficticio
  dorsal: number;
  posicion: Posicion;
}

export interface Equipo {
  nombre: string; // ficticio, nunca un club real
  ataque: number; // 1–100
  defensa: number; // 1–100
  estilo: Estilo;
  jugadores: Jugador[]; // 11 titulares (índices 0–10) + 5 suplentes (11–15), nombres ficticios
}

export interface SimConfig {
  seed: number;
  local: Equipo;
  visita: Equipo;
}

export type TipoEvento =
  | "inicio_periodo"
  | "fin_periodo"
  | "pase_clave"
  | "tiro"
  | "gol"
  | "atajada"
  | "falta"
  | "tarjeta_amarilla"
  | "tarjeta_roja"
  | "corner"
  | "fuera_de_juego"
  | "cambio";

export type Lado = "local" | "visita";
export type Zona = "defensa" | "medio" | "ataque";

export interface Evento {
  id: string; // "e042", secuencial
  minuto: number; // 0–90 + descuento
  tipo: TipoEvento;
  equipo: Lado;
  jugador?: string;
  zona?: Zona;
  xg?: number; // solo en tipo "tiro" (el gol hereda el del tiro)
  penal?: boolean; // solo en tipo "tiro"
  relacionadoCon?: string; // gol/atajada → id del tiro; tarjeta → id de la falta
  /**
   * Revisión 1.1 [B2]: nombre del jugador que deja el campo. OBLIGATORIO en tipo
   * "cambio" y ausente en cualquier otro tipo (lo exige verificarContrato).
   * En un cambio, `jugador` es el que entra.
   */
  sale?: string;
}

export interface Partido {
  config: SimConfig;
  eventos: Evento[];
}

export const TITULARES = 11;
export const SUPLENTES = 5;
/** Regla de juego del brief (invariante 6), no un umbral estadístico. */
export const MAX_CAMBIOS = 3;
/** Revisión 1.1 [B6]: la semilla se normaliza al rango entero [0, SEED_MAX]. */
export const SEED_MAX = 0xffffffff;
/** Rango válido de ataque/defensa (contrato: 1–100, enteros). */
export const FUERZA_MIN = 1;
export const FUERZA_MAX = 100;
