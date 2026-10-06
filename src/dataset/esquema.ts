// Brief 028 — el esquema «cronista/1» de cada línea del dataset, en zod. Los nombres de campo son
// los del código (ES; una sola fuente de verdad); el diccionario en inglés de abajo los documenta
// para el DATASHEET y la página /datos, y una prueba exige que diccionario y esquema tengan
// exactamente las mismas claves (un campo nuevo sin documentar pone la suite en rojo).
//
// Objetos ESTRICTOS: un campo que el código agregue sin pasar por aquí hace fallar la validación.

import { z } from "zod";
import { TIPOS_HECHO } from "../analista/tipos";
import {
  ALTURAS,
  BANDAS,
  CANALES,
  CAUSAS_INTERRUPCION,
  CAUSAS_SANCION_CLUB,
  CESPEDES,
  CLIMAS_PARTIDO,
  DEFINICIONES,
  DESTINOS,
  LADOS_PORTERO,
  NIVELES_PRESION,
  SUPERFICIES,
  TIPOS_MICRO,
  TIPOS_SANCION_CLUB,
  ZONAS_ORIGEN,
} from "../sim/limites";
import type { TipoEvento } from "../sim/tipos";
import { ESQUEMA } from "./umbrales-dataset";

// Un Record sobre TipoEvento: si el motor agrega un tipo, esto no compila hasta sumarlo aquí.
const TIPO_EVENTO: Record<TipoEvento, true> = {
  inicio_periodo: true,
  fin_periodo: true,
  pase_clave: true,
  tiro: true,
  gol: true,
  atajada: true,
  falta: true,
  tarjeta_amarilla: true,
  tarjeta_roja: true,
  corner: true,
  fuera_de_juego: true,
  cambio: true,
  lesion: true,
  subida_portero: true,
  interrupcion: true,
};
export const TIPOS_EVENTO = Object.keys(TIPO_EVENTO) as [TipoEvento, ...TipoEvento[]];

const lado = z.enum(["local", "visita"]);
const zona = z.enum(["defensa", "medio", "ataque"]);
const entero = z.number().int();

export const esquemaJugador = z.strictObject({
  nombre: z.string().min(1),
  dorsal: entero.positive(),
  posicion: z.enum(["POR", "DEF", "MED", "DEL"]),
  nivel: entero.min(1).max(100).optional(),
});

export const esquemaEquipo = z.strictObject({
  nombre: z.string().min(1),
  ataque: entero.min(1).max(100),
  defensa: entero.min(1).max(100),
  estilo: z.enum(["posesion", "contragolpe", "presion"]),
  jugadores: z.array(esquemaJugador).min(1),
});

export const esquemaCondiciones = z.strictObject({
  clima: z.enum(CLIMAS_PARTIDO),
  temperaturaC: entero.optional(),
  superficie: z.enum(SUPERFICIES),
  cesped: z.enum(CESPEDES).optional(),
  presion: z.strictObject({ local: z.enum(NIVELES_PRESION), visita: z.enum(NIVELES_PRESION) }),
});

const esquemaBaja = z.strictObject({ jugador: z.string(), motivo: z.enum(["suspension", "lesion"]), jornadas: entero.positive() });

export const esquemaConfig = z.strictObject({
  seed: entero.min(0),
  local: esquemaEquipo,
  visita: esquemaEquipo,
  condiciones: esquemaCondiciones.optional(),
  variantes: z
    .strictObject({ lesiones: z.boolean().optional(), autogoles: z.boolean().optional(), niveles: z.boolean().optional(), insolitos: z.boolean().optional(), sanciones: z.boolean().optional() })
    .optional(),
  bajas: z.strictObject({ local: z.array(esquemaBaja).optional(), visita: z.array(esquemaBaja).optional() }).optional(),
  sancionesClub: z
    .array(
      z.strictObject({
        lado,
        tipo: z.enum(TIPOS_SANCION_CLUB),
        causa: z.enum(CAUSAS_SANCION_CLUB),
        puntos: entero.optional(),
        partido: entero.optional(),
        de: entero.optional(),
      }),
    )
    .optional(),
});

export const esquemaEvento = z.strictObject({
  id: z.string().regex(/^e\d+$/),
  minuto: entero.min(0),
  tipo: z.enum(TIPOS_EVENTO),
  equipo: lado,
  jugador: z.string().optional(),
  zona: zona.optional(),
  xg: z.number().min(0).max(1).optional(),
  penal: z.boolean().optional(),
  relacionadoCon: z.string().optional(),
  sale: z.string().optional(),
  zonaOrigen: z.enum(ZONAS_ORIGEN).optional(),
  destino: z.enum(DESTINOS).optional(),
  altura: z.enum(ALTURAS).optional(),
  ladoPortero: z.enum(LADOS_PORTERO).optional(),
  banda: z.enum(BANDAS).optional(),
  distanciaM: entero.optional(),
  velocidadKmh: entero.optional(),
  baja: entero.optional(),
  definicion: z.enum(DEFINICIONES).optional(),
  autogol: z.boolean().optional(),
  alPalo: z.union([z.literal(1), z.literal(2)]).optional(),
  causa: z.enum(CAUSAS_INTERRUPCION).optional(),
  duracion: entero.optional(),
});

export const esquemaMicro = z.strictObject({
  id: z.string().regex(/^m\d+$/),
  minuto: entero.min(0),
  tipo: z.enum(TIPOS_MICRO),
  equipo: lado,
  jugador: z.string(),
  canal: z.enum(CANALES),
  zona,
  ancla: z.string().regex(/^e\d+$/),
  posesion: entero.positive(),
  receptor: z.string().optional(),
  completado: z.boolean().optional(),
  distanciaM: entero.optional(),
  rival: z.string().optional(),
  exito: z.boolean().optional(),
});

export const esquemaHecho = z.strictObject({
  id: z.string().regex(/^h\d+$/),
  tipo: z.enum(TIPOS_HECHO as [string, ...string[]]),
  texto_es: z.string().min(1),
  texto_en: z.string().min(1),
  eventos: z.array(z.string()).min(1),
  relevancia: z.number().min(0).max(100),
  datos: z.record(z.string(), z.union([z.string(), z.number()])),
});

const esquemaFuente = z.discriminatedUnion("tipo", [
  z.strictObject({ tipo: z.literal("semilla"), semilla: entero.min(0) }),
  z.strictObject({ tipo: z.literal("liga"), liga: z.string(), temporada: entero, jornada: entero.positive(), indice: entero.positive() }),
]);

/** Una línea de partidos.jsonl. */
export const esquemaLinea = z.strictObject({
  esquema: z.literal(ESQUEMA),
  id: z.string().min(1),
  fuente: esquemaFuente,
  config: esquemaConfig,
  eventos: z.array(esquemaEvento).min(1),
  hechos: z.array(esquemaHecho),
  microCitados: z.array(esquemaMicro),
  capaMicro: z.strictObject({ eventos: entero.min(0), posesiones: entero.min(0) }),
});
export type LineaPartido = z.infer<typeof esquemaLinea>;

export const esquemaPosesion = z.strictObject({
  n: entero.positive(),
  equipo: lado,
  canal: z.enum(CANALES),
  ancla: z.string().regex(/^e\d+$/),
  desde: entero.min(0),
  hasta: entero.min(0),
  termina: z.enum(["ancla", "perdida"]),
  avance: z.boolean(),
  eventos: z.array(z.string()),
});

/** Una línea de micro.jsonl.gz (misma `id` que su línea de partidos.jsonl). */
export const esquemaLineaMicro = z.strictObject({
  esquema: z.literal(ESQUEMA),
  id: z.string().min(1),
  eventos: z.array(esquemaMicro),
  posesiones: z.array(esquemaPosesion),
});

/**
 * Validez de una línea (propiedad 2 del brief): el zod del esquema y, además, que cada cita de cada
 * hecho apunte a un evento PRESENTE en la misma línea (macro en `eventos`, micro en `microCitados`),
 * y que `microCitados` sea exactamente lo citado (ni uno de más).
 */
export function erroresLinea(crudo: unknown): string[] {
  const r = esquemaLinea.safeParse(crudo);
  if (!r.success) return r.error.issues.slice(0, 5).map((i) => `esquema: ${i.path.join(".")}: ${i.message}`);
  const l = r.data;
  const err: string[] = [];
  const macro = new Set(l.eventos.map((e) => e.id));
  if (macro.size !== l.eventos.length) err.push("ids de eventos repetidos");
  const micro = new Set(l.microCitados.map((m) => m.id));
  const citadosMicro = new Set<string>();
  for (const h of l.hechos)
    for (const id of h.eventos) {
      if (macro.has(id)) continue;
      if (micro.has(id)) {
        citadosMicro.add(id);
        continue;
      }
      err.push(`${l.id} ${h.id} (${h.tipo}) cita ${id}, ausente de la línea`);
    }
  for (const m of l.microCitados) {
    if (!citadosMicro.has(m.id)) err.push(`${l.id}: micro ${m.id} en microCitados sin hecho que lo cite`);
    if (!macro.has(m.ancla)) err.push(`${l.id}: micro ${m.id} con ancla ${m.ancla} ausente`);
  }
  return err;
}

/** Diccionario de campos (EN) — lo que el DATASHEET y /datos muestran. Claves = las del esquema. */
export interface Campo {
  campo: string;
  tipo: string;
  en: string;
}

export const CAMPOS_LINEA: readonly Campo[] = [
  { campo: "esquema", tipo: "string", en: "Schema version of the line." },
  { campo: "id", tipo: "string", en: "Stable line id: `s<seed>` for a seed match, `<league>/<season>/<round>/<fixture>` for a league match." },
  { campo: "fuente", tipo: "object", en: "Provenance: `{tipo: \"semilla\", semilla}` or `{tipo: \"liga\", liga, temporada, jornada, indice}` — enough to regenerate the line." },
  { campo: "config", tipo: "object", en: "The engine input, verbatim: `seed`, both teams (`local`, `visita`) with their 16-player squads and per-player `nivel`, plus `condiciones`, `variantes`, `bajas` and `sancionesClub` when present." },
  { campo: "eventos", tipo: "array", en: "Every macro event of the match, in stream order (kick-offs, passes into the box, shots, goals, saves, fouls, cards, corners, offsides, substitutions, injuries, rare events)." },
  { campo: "hechos", tipo: "array", en: "The Analyst's facts: deterministic statements (ES and EN templates) with relevance, raw figures in `datos`, and the ids of the events that support each one in `eventos`." },
  { campo: "microCitados", tipo: "array", en: "The micro-events cited by some fact (so every citation resolves inside the line). The full micro layer is in `micro.jsonl.gz`." },
  { campo: "capaMicro", tipo: "object", en: "Size of the full micro layer of the match: number of micro-events and possessions." },
];

export const CAMPOS_EVENTO: readonly Campo[] = [
  { campo: "id", tipo: "string", en: "Event id, sequential (`e001`…)." },
  { campo: "minuto", tipo: "int", en: "Match minute (stoppage time counts past 45/90)." },
  { campo: "tipo", tipo: "enum", en: "Event type." },
  { campo: "equipo", tipo: "enum", en: "`local` (home) or `visita` (away); for an own goal, the team that is credited." },
  { campo: "jugador", tipo: "string", en: "Player who acts (for a substitution, the one who comes on)." },
  { campo: "zona", tipo: "enum", en: "Pitch third (defence / midfield / attack)." },
  { campo: "xg", tipo: "number", en: "Expected-goals value of the shot (goals inherit it)." },
  { campo: "penal", tipo: "bool", en: "The shot is a penalty." },
  { campo: "relacionadoCon", tipo: "string", en: "Linked event id (goal/save → shot; card → foul; injury → foul)." },
  { campo: "sale", tipo: "string", en: "Player who leaves the pitch (substitutions only)." },
  { campo: "zonaOrigen", tipo: "enum", en: "Where the shot or key pass starts (zone vocabulary, not coordinates)." },
  { campo: "destino", tipo: "enum", en: "Part of the goal the shot goes to, seen from the shooter." },
  { campo: "altura", tipo: "enum", en: "Shot height (low / mid / high)." },
  { campo: "ladoPortero", tipo: "enum", en: "Side the goalkeeper dives to, seen from the goalkeeper (saves)." },
  { campo: "banda", tipo: "enum", en: "Side a corner is taken from." },
  { campo: "distanciaM", tipo: "int", en: "Shot distance to goal, metres." },
  { campo: "velocidadKmh", tipo: "int", en: "Shot speed, km/h." },
  { campo: "baja", tipo: "int", en: "Injury: matchdays out." },
  { campo: "definicion", tipo: "enum", en: "How the shot was finished (header, chip, bicycle kick, from the halfway line, direct corner…)." },
  { campo: "autogol", tipo: "bool", en: "Own goal (`jugador` belongs to the conceding team)." },
  { campo: "alPalo", tipo: "1 | 2", en: "Unconverted shot that hit one post/bar (1) or both (2)." },
  { campo: "causa", tipo: "enum", en: "Cause of a brief stoppage (fictitious closed list)." },
  { campo: "duracion", tipo: "int", en: "Minutes the stoppage adds to stoppage time." },
];

export const CAMPOS_HECHO: readonly Campo[] = [
  { campo: "id", tipo: "string", en: "Fact id, ordered by relevance (`h01`…)." },
  { campo: "tipo", tipo: "enum", en: "Fact type (closed list)." },
  { campo: "texto_es", tipo: "string", en: "Neutral statement, Spanish template (not LLM)." },
  { campo: "texto_en", tipo: "string", en: "Neutral statement, English template (not LLM)." },
  { campo: "eventos", tipo: "array", en: "Ids of the supporting events (macro `e…` or micro `m…`); never empty." },
  { campo: "relevancia", tipo: "number", en: "Relevance 0–100 for the writer to prioritise." },
  { campo: "datos", tipo: "object", en: "Raw figures behind the statement (score, xG, minutes…)." },
];

export const CAMPOS_MICRO: readonly Campo[] = [
  { campo: "id", tipo: "string", en: "Micro-event id (`m0001`…), in minute order." },
  { campo: "minuto", tipo: "int", en: "Minute." },
  { campo: "tipo", tipo: "enum", en: "pass / carry / dribble / duel / loss / recovery." },
  { campo: "equipo", tipo: "enum", en: "Team of the actor." },
  { campo: "jugador", tipo: "string", en: "Actor." },
  { campo: "canal", tipo: "enum", en: "Channel (left / centre / right), from the attacking team's view." },
  { campo: "zona", tipo: "enum", en: "Pitch third from the actor's team's view." },
  { campo: "ancla", tipo: "string", en: "Macro event that closes this stretch of play." },
  { campo: "posesion", tipo: "int", en: "Possession number." },
  { campo: "receptor", tipo: "string", en: "Pass: intended receiver." },
  { campo: "completado", tipo: "bool", en: "Pass: reached the receiver." },
  { campo: "distanciaM", tipo: "int", en: "Pass distance or carry length, metres." },
  { campo: "rival", tipo: "string", en: "Dribble / duel: the opponent faced." },
  { campo: "exito", tipo: "bool", en: "Dribble / duel: won by the actor." },
];

/** Las claves de un objeto zod (para la prueba diccionario = esquema). */
export const clavesDe = (o: { shape: Record<string, unknown> }): string[] => Object.keys(o.shape);
