// Umbrales de la cadena — ÚNICA fuente de estas cifras (brief 003).
// Las pruebas los importan; ninguna prueba repite un número de este archivo a mano.

/**
 * V5 — cobertura: todo hecho con relevancia ≥ COBERTURA debe quedar citado por al
 * menos una oración de la crónica. Con la tabla del 002, 70 obliga a cubrir:
 * remontada con victoria (90), expulsiones (85), dobletes (80), el resultado final
 * (75) y cada gol (70). Lo de relevancia menor (portero, justicia xG, dominio…) el
 * Cronista lo usa si le sirve, pero su ausencia no rechaza la crónica.
 */
export const COBERTURA = 70;

/** Reintentos con feedback tras el primer intento (brief: máx. 2 ⇒ hasta 3 intentos). */
export const MAX_REINTENTOS = 2;

/**
 * V8 (revisión 3.1) — «goleada / rout» solo si algún marcador del hecho principal
 * tiene una diferencia de al menos este número de goles (brief: margen ≥ 3).
 */
export const GOLEADA_MARGEN_MIN = 3;

/** Brief 019 — V8: «diezmado / depleted» solo con al menos este número de bajas (brief: ≥ 2). */
export const BAJAS_DIEZMADO_MIN = 2;

/**
 * Un marcador «x–y» se reconoce como tal solo si ambos números son ≤ este tope;
 * «55-64» es un rango de minutos, no un marcador (sus números se verifican sueltos).
 */
export const MARCADOR_MAX_GOLES = 20;

/**
 * V8 (rev. 3.2) — franjas temporales. «sobre el final / late on» exige que TODO minuto
 * del hecho principal sea ≥ FINAL_MIN (el último cuarto de hora corto del partido);
 * «temprano / early on» exige ≤ TEMPRANO_MAX (coherente con gol_temprano del 002);
 * «tras el descanso / after the break» exige > MINUTO_DESCANSO.
 */
export const FINAL_MIN = 80;
export const TEMPRANO_MAX = 10;
export const MINUTO_DESCANSO = 45;

/**
 * Caché (rev. 3.2) — un `.tmp` más viejo que esto al abrir la caché es un huérfano de
 * una escritura interrumpida y se borra. Lo bastante largo para no pisar una escritura
 * en curso de otro proceso.
 */
export const TMP_HUERFANO_MS = 60_000;

/**
 * Brief 007 — modo «mi equipo»: los hechos del equipo elegido (los que tienen
 * `datos.equipo` igual a su nombre) suben esta cantidad de relevancia (tope 100). Vive en
 * la CADENA, no en el Analista: el 002 queda neutral y cerrado; la personalización es un
 * paso de selección y orden ANTES del Cronista, nunca en el medio.
 * Con 15: un gol propio (70) pasa a 85; el portero propio (65) pasa a 80 y se vuelve
 * obligatorio para V5 (≥ COBERTURA); la presión propia (35) sube a 50.
 */
export const DELTA_MI_EQUIPO = 15;

/** Caché (rev. 3.2) — reintentos del `rename` atómico (Windows da EPERM/EBUSY si otro proceso lee). */
export const RENAME_REINTENTOS = 5;
export const RENAME_ESPERA_MS = 15;
