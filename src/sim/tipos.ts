// Contrato del simulador — brief 001 (docs/disenos/001-simulador.md).
// Los nombres y propiedades de este archivo NO se cambian sin actualizar el brief.

import type { Altura, Banda, Destino, LadoPortero, ZonaOrigen } from "./limites";

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
  // --- Brief 011 (rev 1.1): detalle espacial OPCIONAL. Sale de un stream derivado por
  // (semilla, id) — nunca del stream principal —, así que la proyección sin estos campos
  // es el partido de siempre, byte a byte. `zona` (arriba) NO se reusa. Vocabularios en limites.ts.
  /** tiro, gol (copiado de su tiro) y pase_clave: de dónde sale. */
  zonaOrigen?: ZonaOrigen;
  /** tiro y gol: a qué parte del arco, visto desde el tirador. */
  destino?: Destino;
  /** tiro y gol. */
  altura?: Altura;
  /** atajada: hacia dónde se tiró el portero (coherente con el destino del tiro). */
  ladoPortero?: LadoPortero;
  /** corner: desde qué banda se sacó (no confundir con `Lado`, que es local/visita). */
  banda?: Banda;
  /** Brief 015 — tiro (y su gol/atajada): distancia al arco en metros enteros. */
  distanciaM?: number;
  /** Brief 015 — tiro (y su gol/atajada): velocidad del disparo en km/h enteros. */
  velocidadKmh?: number;
}

/** Brief 011: los campos espaciales (la proyección legado los borra). */
// Brief 015: la lista se extiende CONSCIENTEMENTE con las magnitudes del tiro (tercera extensión).
export const CAMPOS_ESPACIALES = ["zonaOrigen", "destino", "altura", "ladoPortero", "banda", "distanciaM", "velocidadKmh"] as const;

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
