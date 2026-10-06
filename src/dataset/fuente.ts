// Brief 028 §1 — de dónde salen los partidos del dataset.
// - Por semilla: la config de siempre (`configDeSemilla`) con los niveles del 024 puestos y TODAS
//   las variantes de un partido suelto encendidas (VARIANTES_DATASET). OJO: no es el /match/<semilla>
//   de la app, que muestra el motor base sin variantes (el DATASHEET y /datos lo rotulan).
// - Por liga (--liga): la temporada completa del mundo del 016, con su registro (condiciones,
//   bajas, sanciones de club): exactamente las configs con las que /liga juega cada partido.

import { mundo } from "../mundo/mundo";
import { temporadaDe } from "../mundo/temporada";
import type { Liga } from "../mundo/tipos";
import { conNiveles, nivelesDe } from "../sim/niveles";
import { configDeSemilla } from "../sim/plantillas";
import type { SimConfig } from "../sim/tipos";
import { VARIANTES_DATASET } from "./umbrales-dataset";

export type Fuente = { tipo: "semilla"; semilla: number } | { tipo: "liga"; liga: string; temporada: number; jornada: number; indice: number };

export interface Entrada {
  /** Identificador estable de la línea: "s42" o "liga-de-los-valles/1/7/3". */
  id: string;
  fuente: Fuente;
  config: SimConfig;
}

/** La config del dataset para una semilla suelta (niveles puestos + variantes encendidas). */
export function configDataset(semilla: number): SimConfig {
  const c = configDeSemilla(semilla);
  return {
    ...c,
    local: conNiveles(c.local, nivelesDe(c.local)),
    visita: conNiveles(c.visita, nivelesDe(c.visita)),
    variantes: { ...VARIANTES_DATASET },
  };
}

export function entradasPorSemilla(semillas: readonly number[]): Entrada[] {
  return semillas.map((semilla) => ({ id: `s${semilla}`, fuente: { tipo: "semilla", semilla }, config: configDataset(semilla) }));
}

export function ligaPorId(id: string): Liga {
  const liga = mundo().ligas.find((l) => l.id === id);
  if (!liga) throw new Error(`liga desconocida: ${id} (existen: ${mundo().ligas.map((l) => l.id).join(", ")})`);
  return liga;
}

/** La temporada completa de una liga, en orden de jornada e índice (las configs de /liga). */
export function entradasDeLiga(ligaId: string, temporada: number): Entrada[] {
  const liga = ligaPorId(ligaId);
  const t = temporadaDe(liga, temporada);
  return t.partidos.map((p, k) => ({
    id: `${liga.id}/${temporada}/${p.jornada}/${p.indice}`,
    fuente: { tipo: "liga", liga: liga.id, temporada, jornada: p.jornada, indice: p.indice },
    config: JSON.parse(JSON.stringify(t.configs[k])) as SimConfig,
  }));
}
