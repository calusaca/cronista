// Brief 022 — umbrales de la eval: ÚNICA fuente de las semillas y del costo. Las pruebas los
// importan; nada se repite a mano.

/**
 * Las 20 semillas de la eval, fijas (mismas semillas siempre ⇒ cifra reproducible). Las cuatro
 * del brief (246 la portada 4–1, 116 el 2–0 de la chilena, 834 el 0–0, 289 el 0–1 al 94') y las 16
 * primeras del corpus 1..1000 con un marcador que no se repite: 20 marcadores distintos.
 */
export const EVAL_SEMILLAS: readonly number[] = [246, 116, 834, 289, 1, 3, 4, 5, 7, 8, 10, 11, 12, 19, 22, 23, 27, 32, 34, 40];

/**
 * Tokens estimados por carácter (la costura LLM no devuelve el uso real; la estimación clásica de
 * ~4 caracteres por token). Rotulado como estimación en el informe.
 */
export const CARACTERES_POR_TOKEN = 4;

/**
 * Precio (USD por millón de tokens, entrada + salida promediadas) por backend, para el costo
 * estimado. stub y ensayo no llaman a nadie: $0. Los backends reales se completan el 6 oct con el
 * precio de la cuenta (hasta entonces el informe dice «precio sin fijar» en vez de inventarlo).
 */
export const PRECIO_USD_POR_MTOK: Record<string, number | undefined> = {
  stub: 0,
  ensayo: 0,
};
