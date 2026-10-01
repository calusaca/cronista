// Personalización (brief 007): se personaliza la selección, el orden y el tono — JAMÁS la
// verdad. Esto ocurre ANTES del Cronista (re-priorización determinista de hechos +
// instrucción de perspectiva); la crónica resultante pasa el mismo Verificador V1–V8.
//
// Lo que NO cambia: los hechos, sus textos, sus datos, sus eventos y sus IDs. Solo cambia
// la `relevancia` de los hechos del equipo elegido (+DELTA_MI_EQUIPO) y, por ende, el
// orden y qué hechos son obligatorios para V5.

import type { Hecho } from "../analista/tipos";
import type { Partido } from "../sim/tipos";
import type { ModoPersonalizacion } from "./tipos";
import { DELTA_MI_EQUIPO } from "./umbrales";

/** Nombre del equipo para el que se cuenta el partido, o undefined en modo neutral. */
export function equipoDeModo(modo: ModoPersonalizacion, partido: Partido): string | undefined {
  if (modo === "equipo:local") return partido.config.local.nombre;
  if (modo === "equipo:visita") return partido.config.visita.nombre;
  return undefined;
}

/** ¿El hecho es del equipo? (tiene `datos.equipo` con ese nombre; los de ambos equipos no). */
export const esDelEquipo = (h: Hecho, equipo: string) => h.datos.equipo === equipo;

/**
 * Re-priorización determinista: los hechos del equipo suben DELTA_MI_EQUIPO (tope 100) y
 * la lista se re-ordena por relevancia descendente, ESTABLE (a igualdad se conserva el
 * orden del Analista, que ya desempató por minuto). Devuelve copias; no muta la entrada.
 * Mismo partido y modo ⇒ misma lista, mismo orden, mismos IDs.
 */
export function repriorizar(hechos: Hecho[], modo: ModoPersonalizacion, partido: Partido): Hecho[] {
  const equipo = equipoDeModo(modo, partido);
  if (!equipo) return hechos.map((h) => ({ ...h, datos: { ...h.datos }, eventos: [...h.eventos] }));
  return hechos
    .map((h, i) => ({
      h: { ...h, datos: { ...h.datos }, eventos: [...h.eventos], relevancia: esDelEquipo(h, equipo) ? Math.min(100, h.relevancia + DELTA_MI_EQUIPO) : h.relevancia },
      i,
    }))
    .sort((a, b) => b.h.relevancia - a.h.relevancia || a.i - b.i)
    .map((x) => x.h);
}

/**
 * Instrucción de perspectiva para el Cronista (brief 007): el tono cambia, la verdad no.
 * Va en el mensaje del usuario; el system prompt sigue siendo el fijo del 003.
 */
export function instruccionPerspectiva(modo: ModoPersonalizacion, partido: Partido): string | undefined {
  const equipo = equipoDeModo(modo, partido);
  if (!equipo) return undefined;
  return [
    `Perspectiva: contá el partido para la afición de ${equipo}, sin faltar a la verdad.`,
    `Empezá por lo que más le importa a esa afición (los hechos ya vienen ordenados así), pero las reglas no cambian: cada oración narra un hecho, toda cifra, nombre y valoración tiene que estar en ese hecho, y nada de juicios que los hechos no paguen.`,
  ].join(" ");
}
