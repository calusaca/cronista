// Prompt de las actualizaciones en vivo (brief 008): el mismo contrato «una oración = un
// hecho» y las mismas reglas que la crónica, en formato corto. El Cronista recibe SOLO los
// hechos del prefijo (lo conocido hasta el minuto M) y el hecho que debe narrar.

import type { Hecho } from "../analista/tipos";
import { serializarHechos } from "../cadena/prompt";
import { MAX_ORACIONES_UPDATE } from "./umbrales";

export const SYSTEM_PROMPT_UPDATE = `Sos el Cronista de CRONISTA y estás cubriendo un partido EN VIVO (es un replay de un partido simulado). Escribís una ACTUALIZACIÓN corta en español y en inglés para el momento que se te indica.

REGLAS (un verificador automático rechaza la actualización si no se cumplen):
1. Entre 1 y ${MAX_ORACIONES_UPDATE} oraciones. UNA ORACIÓN = UN HECHO: cada oración narra un hecho, cuyo ID va en "hecho"; todo número, nombre y valoración tiene que estar en ESE hecho. "apoyo" no habilita nada.
2. La PRIMERA oración narra el hecho del momento que se te indica.
3. Solo sabés lo que pasó hasta este minuto. No anticipes nada: ni el resultado final, ni goles o tarjetas que todavía no ocurrieron. Tampoco hagas balances de lo que pasó «después» de una expulsión o de cualquier momento: el partido sigue.
4. Mismas cifras en español y en inglés. Sin negaciones («sin», «no hubo», without…), sin juicios que el hecho no pague, sin cuentas propias.
5. Nombres: solo los del hecho. Ninguna otra palabra con mayúscula salvo la primera de la oración o tras un punto, y solo si es una palabra común.

SALIDA: únicamente un objeto JSON válido, sin texto antes ni después:
{"oraciones": [{"texto_es": string, "texto_en": string, "hecho": string, "apoyo": [string, ...]}]}`;

const ABRE = "<momento>";
const CIERRA = "</momento>";

/** Mensaje de la actualización: el minuto, el hecho del momento y los hechos del prefijo. */
export function mensajeUpdate(hechos: Hecho[], hechoMomento: string, minuto: string, perspectiva?: string): string {
  return [
    `Minuto ${minuto}. Esto es todo lo que sabés del partido hasta ahora:`,
    "<hechos>",
    serializarHechos(hechos),
    "</hechos>",
    `Hecho de este momento (la primera oración lo narra): ${ABRE}${hechoMomento}${CIERRA}`,
    ...(perspectiva ? [perspectiva] : []),
    "Devolvé solo el JSON de la actualización.",
  ].join("\n");
}

/** El hecho del momento, desde el mensaje (lo usa el stub; es el mismo texto que ve el LLM real). */
export function extraerHechoMomento(mensaje: string): string | undefined {
  const a = mensaje.indexOf(ABRE);
  const b = mensaje.indexOf(CIERRA);
  return a >= 0 && b > a ? mensaje.slice(a + ABRE.length, b) : undefined;
}
