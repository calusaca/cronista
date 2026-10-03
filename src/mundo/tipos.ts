// Brief 016 — el mundo ficticio: países con clima, ligas, equipos con cancha, temporadas.
// El motor no se entera: un equipo del mundo ENVUELVE un `Equipo` de siempre, y un partido
// de liga es un `SimConfig` estándar con semilla `semillaDePartido(...)`.

import type { Equipo, Jugador, SimConfig } from "../sim/tipos";

/** Perfil climático del país (se consume en el 018; aquí es identidad). */
export type Clima = "tropical" | "desertico" | "templado" | "nordico" | "lluvioso" | "de_altura";

export const CLIMAS: readonly Clima[] = ["tropical", "desertico", "templado", "nordico", "lluvioso", "de_altura"];

export interface Cancha {
  superficie: "natural" | "sintetica";
  cesped: "corto" | "alto";
}

export interface Pais {
  id: string;
  nombre: string;
  clima: Clima;
}

export interface EquipoMundo {
  /** El equipo del motor, intacto (nombre, ataque, defensa, estilo, plantilla). */
  equipo: Equipo;
  pais: string; // id del país
  liga: string; // id de la liga
  /** Identidad de la cancha local (desde el 018, entra a las condiciones de sus partidos de local). */
  cancha: Cancha;
  /**
   * Brief 019 — el plantel extendido: reservas (POR, DEF, MED, DEL) fuera de la plantilla de 16
   * del partido; entran cuando un sancionado o un lesionado no puede jugar.
   */
  reservas: Jugador[];
}

export interface Liga {
  id: string;
  nombre: string;
  pais: string; // id del país
  /** Brief 018: el perfil climático del país (de él sale el clima de cada partido). */
  clima: Clima;
  equipos: EquipoMundo[];
}

export interface Mundo {
  semilla: number;
  paises: Pais[];
  ligas: Liga[];
}

/** Un cruce del calendario: índices de equipo dentro de la liga. */
export interface Cruce {
  local: number;
  visita: number;
}

/** Jornadas 1..18; en cada una, 5 cruces (índice 1..5 en la UI). */
export type Calendario = Cruce[][];

export interface GolLiga {
  jugador: string;
  equipo: string; // nombre del equipo que anota
  minuto: number;
}

export interface PartidoLiga {
  jornada: number; // 1-based
  indice: number; // 1-based dentro de la jornada
  seed: number;
  local: string; // nombre del equipo
  visita: string;
  golesLocal: number;
  golesVisita: number;
  goles: GolLiga[];
}

export interface FilaTabla {
  equipo: string;
  pj: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  gc: number;
  dg: number;
  pts: number;
}

export interface Goleador {
  jugador: string;
  equipo: string;
  goles: number;
}

/** Brief 019 — una sanción del registro: se la pierde las `jornadas` siguientes de su equipo. */
export interface Sancion {
  jugador: string;
  equipo: string;
  motivo: "doble_amarilla" | "roja_directa";
  jornada: number; // en la que la vio
  jornadas: number; // de suspensión
  evento: string; // id de la tarjeta_roja
}

/** Brief 019 — una lesión del registro: fuera las `jornadas` siguientes. */
export interface LesionLiga {
  jugador: string;
  equipo: string;
  jornada: number;
  minuto: number;
  jornadas: number;
  evento: string; // id del evento lesion
}

export interface Temporada {
  liga: string; // id
  temporada: number;
  partidos: PartidoLiga[]; // en orden de jornada e índice
  tabla: FilaTabla[];
  goleadores: Goleador[];
  /** Brief 019: la config con la que se jugó cada partido (alineaciones, condiciones, bajas), alineada con `partidos`. */
  configs: SimConfig[];
  sanciones: Sancion[];
  lesiones: LesionLiga[];
}
