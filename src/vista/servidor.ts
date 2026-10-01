// Carga de datos para la UI — SOLO servidor (brief 004: sim + analista + cadena corren en
// el server; la API key jamás llega al cliente). Lo que sale de aquí es serializable y no
// contiene secretos: eventos, hechos, la crónica verificada con su audit, y una etiqueta
// del LLM usado.

import { analizar } from "../analista/analista";
import type { Hecho } from "../analista/tipos";
import { crearCacheDisco } from "../cadena/cache";
import { generarCronica } from "../cadena/cadena";
import type { CronicaVerificada } from "../cadena/tipos";
import { crearLlmDesdeEnv } from "../lib/llm";
import { simular } from "../sim/motor";
import { configDeSemilla } from "../sim/plantillas";
import type { Estilo, Evento } from "../sim/tipos";

/** Partido destacado de la home: variado (expulsión, doblete, dos penales, portero, presión). */
export const SEMILLA_DESTACADA = 246;

export interface EquipoVista {
  nombre: string;
  ataque: number;
  defensa: number;
  estilo: Estilo;
}

export interface DatosPartido {
  seed: number;
  local: EquipoVista;
  visita: EquipoVista;
  eventos: Evento[];
  hechos: Hecho[];
  cronica: CronicaVerificada;
  llm: { id: string; etiqueta: string; fixture: boolean };
  desdeCache: boolean;
}

/** Etiqueta honesta del LLM para la UI. */
export function etiquetaLlm(id: string): { etiqueta: string; fixture: boolean } {
  if (id === "stub") return { etiqueta: "Offline stub — sentences reuse the analyst's templates", fixture: false };
  if (id === "ensayo") return { etiqueta: "Rehearsal fixture — a scripted writer with one deliberate error (test only)", fixture: true };
  if (id.startsWith("foundry:")) return { etiqueta: `Microsoft Foundry · ${id.slice("foundry:".length)}`, fixture: false };
  return { etiqueta: id, fixture: false };
}

const equipo = (e: { nombre: string; ataque: number; defensa: number; estilo: Estilo }): EquipoVista => ({
  nombre: e.nombre,
  ataque: e.ataque,
  defensa: e.defensa,
  estilo: e.estilo,
});

export async function cargarPartido(seed: number): Promise<DatosPartido> {
  const partido = simular(configDeSemilla(seed));
  const llm = crearLlmDesdeEnv();
  const { cronica, hechos, desdeCache } = await generarCronica(partido, { llm, cache: crearCacheDisco() });
  return {
    seed: partido.config.seed,
    local: equipo(partido.config.local),
    visita: equipo(partido.config.visita),
    eventos: partido.eventos,
    hechos,
    cronica,
    llm: { id: llm.id, ...etiquetaLlm(llm.id) },
    desdeCache,
  };
}

// ---------------------------------------------------------------------------------
// Presets: enfrentamientos con una historia, elegidos por lo que el Analista DICE de ellos
// (no por etiqueta a mano): la primera semilla del corpus que tiene ese hecho.
// ---------------------------------------------------------------------------------

export interface Preset {
  seed: number;
  historia: string; // en inglés: es chrome de la UI
  local: string;
  visita: string;
  marcador: string;
}

const HISTORIAS: { historia: string; cumple: (hs: Hecho[]) => boolean }[] = [
  { historia: "Comeback win", cumple: (hs) => hs.some((h) => h.tipo === "remontada" && h.datos.desenlace === "victoria") },
  { historia: "Red card", cumple: (hs) => hs.some((h) => h.tipo === "expulsion_y_efecto") },
  { historia: "Against the run of play", cumple: (hs) => hs.some((h) => h.tipo === "justicia_xg" && h.datos.contra_la_corriente === "si") },
  { historia: "Hat-trick", cumple: (hs) => hs.some((h) => h.tipo === "doblete_o_mas" && Number(h.datos.goles) >= 3) },
  { historia: "Goalkeeper's day", cumple: (hs) => hs.some((h) => h.tipo === "portero_destacado") },
  { historia: "Late drama", cumple: (hs) => hs.some((h) => h.tipo === "gol_tardio") && hs.some((h) => h.tipo === "remontada") },
];

let presetsCalculados: Preset[] | undefined;

export function presets(): Preset[] {
  if (presetsCalculados) return presetsCalculados;
  const out: Preset[] = [];
  const usadas = new Set<number>([SEMILLA_DESTACADA]);
  for (const { historia, cumple } of HISTORIAS) {
    for (let s = 1; s <= 600; s++) {
      if (usadas.has(s)) continue;
      const p = simular(configDeSemilla(s));
      const hs = analizar(p);
      if (!cumple(hs)) continue;
      const r = hs.find((h) => h.tipo === "resultado_final") as Hecho;
      out.push({ seed: s, historia, local: p.config.local.nombre, visita: p.config.visita.nombre, marcador: `${r.datos.goles_local}–${r.datos.goles_visita}` });
      usadas.add(s);
      break;
    }
  }
  presetsCalculados = out;
  return out;
}
