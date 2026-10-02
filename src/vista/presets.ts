// Brief 014 §2 — presets curados: cinco historias que muestran el rango real del simulador.
// Las semillas las caza `cazarPresets` sobre el corpus con criterios fijos y deterministas
// (el script `npm run presets` lo imprime; una prueba verifica que PRESETS coincide con lo
// que caza y que cada semilla cumple su criterio). Los textos dicen el TIPO de historia sin
// spoilear el marcador exacto.

import { analizar } from "../analista/analista";
import type { Hecho } from "../analista/tipos";
import { simular } from "../sim/motor";
import { configDeSemilla } from "../sim/plantillas";
import type { Partido } from "../sim/tipos";

/** Partido destacado de la home (la historia grande se queda). */
export const SEMILLA_DESTACADA = 246;

/** Corpus donde se cazan las historias. */
export const CORPUS_PRESETS = 1000;

/** Regates de un mismo atacante sobre un mismo defensor que hacen «un duelo» de vitrina (criterio del brief: 5+). */
export const DUELO_VITRINA_MIN = 5;

export type IdHistoria = "porteria_cero" | "triunfo_tardio" | "empate_remontado" | "noche_grande" | "duelo";

export interface Criterio {
  id: IdHistoria;
  /** Texto del preset: el tipo de historia, sin el marcador. */
  historia: string;
  /** ¿La semilla cumple la historia? */
  cumple: (hs: Hecho[], p: Partido) => boolean;
  /** Entre las que cumplen, gana la de mayor puntaje (a igualdad, la menor semilla). */
  puntaje: (hs: Hecho[], p: Partido) => number;
}

const resultado = (hs: Hecho[]) => hs.find((h) => h.tipo === "resultado_final") as Hecho;
const marcador = (hs: Hecho[]) => [Number(resultado(hs).datos.goles_local), Number(resultado(hs).datos.goles_visita)] as const;

export const CRITERIOS: Criterio[] = [
  {
    id: "porteria_cero",
    historia: "A goalless thriller",
    // 0–0 con un portero enorme: hay portero_destacado; gana el que más xG atajó.
    cumple: (hs) => marcador(hs).join("-") === "0-0" && hs.some((h) => h.tipo === "portero_destacado"),
    puntaje: (hs) => Math.max(...hs.filter((h) => h.tipo === "portero_destacado").map((h) => Number(h.datos.xg_atajado))),
  },
  {
    id: "triunfo_tardio",
    historia: "A late winner",
    // 1–0 sufrido: el único gol es tardío; gana el más tardío.
    cumple: (hs) => {
      const [l, v] = marcador(hs);
      return l + v === 1 && hs.some((h) => h.tipo === "gol_tardio");
    },
    puntaje: (hs) => Math.max(...hs.filter((h) => h.tipo === "gol_tardio").map((h) => Number(String(h.datos.minuto).split("+").reduce((a, b) => a + Number(b), 0)))),
  },
  {
    id: "empate_remontado",
    historia: "Honours even after a fightback",
    // 2–2 con remontada parcial (un equipo iba perdiendo y empató); gana la mayor desventaja remontada.
    cumple: (hs) => marcador(hs).join("-") === "2-2" && hs.some((h) => h.tipo === "remontada" && h.datos.desenlace === "empate"),
    puntaje: (hs) => Math.max(...hs.filter((h) => h.tipo === "remontada").map((h) => Number(h.datos.desventaja_max))),
  },
  {
    id: "noche_grande",
    historia: "The big night: a red card and penalties",
    cumple: (_hs, p) => p.config.seed === SEMILLA_DESTACADA,
    puntaje: () => 0,
  },
  {
    id: "duelo",
    historia: "A one-on-one duel",
    // Alguien regatea DUELO_VITRINA_MIN+ veces al mismo rival; gana el duelo más largo.
    cumple: (hs) => hs.some((h) => h.tipo === "duelo_ganado" && Number(h.datos.regates) >= DUELO_VITRINA_MIN),
    puntaje: (hs) => Math.max(...hs.filter((h) => h.tipo === "duelo_ganado").map((h) => Number(h.datos.regates))),
  },
];

/** Marcador sin orden («2–1» y «1–2» son el mismo resultado de vitrina). */
const resultadoDe = (hs: Hecho[]) => {
  const [l, v] = marcador(hs);
  return `${Math.max(l, v)}-${Math.min(l, v)}`;
};

/**
 * Caza las cinco semillas sobre 1..CORPUS_PRESETS (determinista). Rev. de Fable: el duelo
 * se elige al FINAL y evita los resultados de las otras cuatro historias (no dos 2–2 entre
 * cinco): gana el mayor puntaje entre los candidatos con resultado no usado; a igualdad, la
 * menor semilla.
 */
export function cazarPresets(corpus = CORPUS_PRESETS): Record<IdHistoria, number> {
  const candidatos = new Map<IdHistoria, { seed: number; puntaje: number; resultado: string }[]>();
  for (let s = 1; s <= corpus; s++) {
    const p = simular(configDeSemilla(s));
    const hs = analizar(p);
    for (const c of CRITERIOS) {
      if (!c.cumple(hs, p)) continue;
      candidatos.set(c.id, [...(candidatos.get(c.id) ?? []), { seed: s, puntaje: c.puntaje(hs, p), resultado: resultadoDe(hs) }]);
    }
  }
  const mejor = (xs: { seed: number; puntaje: number }[]) => xs.reduce((a, b) => (b.puntaje > a.puntaje ? b : a));
  const out = {} as Record<IdHistoria, number>;
  const usados = new Set<string>();
  const orden = [...CRITERIOS.filter((c) => c.id !== "duelo"), ...CRITERIOS.filter((c) => c.id === "duelo")];
  for (const c of orden) {
    const xs = candidatos.get(c.id) ?? [];
    const libres = c.id === "duelo" ? xs.filter((x) => !usados.has(x.resultado)) : xs;
    if (libres.length === 0) throw new Error(`presets: ninguna semilla de 1..${corpus} cumple «${c.historia}»${c.id === "duelo" ? " con un resultado no usado" : ""}`);
    const m = mejor(libres) as { seed: number; puntaje: number; resultado: string };
    out[c.id] = m.seed;
    usados.add(m.resultado);
  }
  return out;
}

/** Las semillas elegidas por `cazarPresets()` (fijas: una prueba vigila que coincidan). */
export const PRESETS: Record<IdHistoria, number> = {
  porteria_cero: 834,
  triunfo_tardio: 289,
  empate_remontado: 12,
  noche_grande: SEMILLA_DESTACADA,
  duelo: 146,
};
