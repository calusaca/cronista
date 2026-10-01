// Umbrales del partido en vivo (brief 008) — única fuente de estas cifras y listas.
// Las pruebas los importan; ninguna prueba los repite a mano.

import type { TipoHecho } from "../analista/tipos";

/** Momentos clave que disparan una actualización (brief 008: gol, roja, descanso, final). */
export const MOMENTOS_CLAVE = ["gol", "roja", "descanso", "final"] as const;
export type TipoMomento = (typeof MOMENTOS_CLAVE)[number];

/** Hecho del Analista que cada momento narra como principal. */
export const HECHO_DEL_MOMENTO: Record<TipoMomento, TipoHecho> = {
  gol: "gol_anotado",
  roja: "expulsion_y_efecto",
  descanso: "marcador_por_periodo",
  final: "resultado_final",
};

/** Una actualización es corta: 1 o 2 oraciones (brief 008). */
export const MAX_ORACIONES_UPDATE = 2;

/**
 * Hechos «de cierre»: el Analista los emite sobre cualquier prefijo, pero ANTES del final
 * dirían algo falso — «Resultado final» a los 20', «ganó con menos xG», o una remontada
 * calculada con un marcador provisional como si fuera el definitivo. No se le dan al
 * Cronista ni se pueden citar hasta el momento «final». (Decisión del implementador.)
 * `dominio_periodo` tampoco se da mientras su periodo no haya terminado: afirma algo
 * sobre el periodo entero.
 */
// Brief 009: `figura_del_partido` también es de cierre («fue la figura del partido»: sobre
// un prefijo sería el mejor HASTA AHORA, no del partido). Misma lección que el hallazgo F1.
export const HECHOS_DE_CIERRE: readonly TipoHecho[] = ["resultado_final", "justicia_xg", "remontada", "figura_del_partido"];

/**
 * Hallazgo F1: campos de `expulsion_y_efecto` que en vivo NO se entregan (antes del final).
 * `goles_despues_*` es un balance posterior a la roja que sobre un prefijo es parcial y se
 * lee como de cierre; `goles_local/visita` es el «total del partido» del 002 (sobre el
 * prefijo coincide con el marcador del momento, que ya va en `marcador_*`).
 */
export const CAMPOS_DE_EFECTO: readonly string[] = ["goles_despues_local", "goles_despues_visita", "goles_local", "goles_visita"];

/**
 * Velocidades del replay (brief 008: ×1, ×5 y pausa): milisegundos reales por minuto de
 * partido. A ×1 un partido de ~95' dura ~95 s; a ×5, ~19 s.
 */
export const MS_POR_MINUTO = { x1: 1000, x5: 200 } as const;
export type Velocidad = keyof typeof MS_POR_MINUTO | "pausa";
