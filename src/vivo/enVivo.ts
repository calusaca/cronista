// Hallazgo F1 del 008 (honestidad en vivo): un hecho que SÍ hay que narrar puede traer DENTRO
// una cláusula de balance. `expulsion_y_efecto` cuenta los goles «después» de la roja; sobre
// un prefijo eso es un balance PARCIAL que se lee como de cierre («afterwards … scored 0
// and 0» al 66', y al 67' cae gol). Es la misma categoría que HECHOS_DE_CIERRE, solo que
// dentro de un hecho.
//
// En vivo (todo momento salvo el final), los hechos de expulsión se le entregan al Cronista
// SIN los campos de efecto ni el total del partido, con una plantilla live sin la cláusula
// «después/afterwards», y sin los eventos posteriores a la roja como evidencia. Queda lo que
// sí es del prefijo: quién, motivo, minuto y el marcador en ese momento. El 002 no se toca:
// la transformación es de `src/vivo` y se aplica sobre la salida de `analizar`.

import type { Hecho } from "../analista/tipos";
import { rellenar } from "../analista/textos";
import type { Partido } from "../sim/tipos";
import { CAMPOS_DE_EFECTO } from "./umbrales";

/** Plantillas live de la expulsión: sin balance posterior. */
export const PLANTILLAS_EXPULSION_EN_VIVO = {
  roja_directa: {
    es: "{jugador} ({equipo}) vio la roja directa en el minuto {minuto}, con {local} {marcador_local}–{marcador_visita} {visita}.",
    en: "{jugador} ({equipo}) was shown a straight red card in minute {minuto}, with {local} {marcador_local}–{marcador_visita} {visita}.",
  },
  doble_amarilla: {
    es: "{jugador} ({equipo}) fue expulsado por doble amarilla en el minuto {minuto}, con {local} {marcador_local}–{marcador_visita} {visita}.",
    en: "{jugador} ({equipo}) was sent off for a second yellow card in minute {minuto}, with {local} {marcador_local}–{marcador_visita} {visita}.",
  },
} as const;

/**
 * El hecho tal como se puede afirmar en vivo. Hoy solo transforma `expulsion_y_efecto`;
 * cualquier otro hecho sale igual (copia). Función pura: mismo hecho y partido ⇒ misma salida.
 */
export function hechoEnVivo(h: Hecho, partido: Partido): Hecho {
  if (h.tipo !== "expulsion_y_efecto") return { ...h, datos: { ...h.datos }, eventos: [...h.eventos] };
  const datos: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(h.datos)) if (!CAMPOS_DE_EFECTO.includes(k)) datos[k] = v;
  const p = PLANTILLAS_EXPULSION_EN_VIVO[datos.motivo === "doble_amarilla" ? "doble_amarilla" : "roja_directa"];
  // Evidencia: solo hasta la roja (los goles posteriores sustentaban la cláusula que se quitó).
  const pos = new Map(partido.eventos.map((e, i) => [e.id, i]));
  const roja = h.eventos.find((id) => partido.eventos[pos.get(id) ?? -1]?.tipo === "tarjeta_roja");
  const limite = roja !== undefined ? (pos.get(roja) as number) : Infinity;
  return {
    ...h,
    texto_es: rellenar(p.es, datos),
    texto_en: rellenar(p.en, datos),
    eventos: h.eventos.filter((id) => (pos.get(id) ?? Infinity) <= limite),
    datos,
  };
}
