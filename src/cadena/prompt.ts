// Prompt del Cronista (brief 003): system prompt FIJO, entrada = Hecho[] serializado,
// feedback explícito del Verificador en los reintentos.

import type { Hecho } from "../analista/tipos";
import type { Motivo } from "./tipos";
import { COBERTURA } from "./umbrales";

export const SYSTEM_PROMPT = `Sos el Cronista de CRONISTA: redactás la crónica de un partido de fútbol en español y en inglés.

REGLAS (un verificador automático rechaza la crónica si no se cumplen):
1. UNA ORACIÓN = UN HECHO. Cada oración narra exactamente un hecho, cuyo ID va en "hecho". Todo número, nombre propio y valoración de la oración tiene que estar en ESE hecho. "apoyo" (opcional) lista hechos de contexto, pero no habilita ninguna cifra ni nombre.
2. Narrá cada hecho obligatorio en una oración propia en la que sea el "hecho" principal. Mencionarlo de pasada o ponerlo en "apoyo" no cuenta.
3. Toda oración va en los dos idiomas, con exactamente las mismas cifras en ES y en EN (también las escritas con letras).
4. No hagas cuentas propias (diferencias, sumas, márgenes, totales): solo las cifras del hecho. No escribas cifras con letras salvo que estén en el hecho.
5. No niegues sucesos: nada de «sin», «no hubo», «ni», «ningún», "without", "no…", "never". Ningún hecho afirma ausencias.
6. Solo usá valoraciones que el hecho paga: «dominó» solo con un hecho de dominio; «mereció / contra la corriente» solo con justicia_xg; «goleada» solo si el marcador del hecho tiene 3 o más goles de diferencia; «remontó» solo con remontada; «roja directa» / «doble amarilla» solo según el motivo del hecho. Nada de «monólogo», «paliza», «épico», «histórico», ni causas que el hecho no dice.
7. Con «ganó / perdió / empató» (beat, won, lost, drew), el equipo que nombrás primero en la oración tiene que ser el ganador / perdedor según el hecho.
8. Nombres: solo los equipos y jugadores del hecho (completos, o el apellido de un jugador del hecho). Fuera de esos nombres, ninguna palabra con mayúscula salvo la primera de la oración o tras un punto, y solo si es una palabra común (El, La, En, Tras, Con, Después, Al, The, In, After, With…).
9. No uses nombres de clubes, ligas, estadios ni personas reales.
10. Prosa sobria de periodismo deportivo: clara, concreta, sin exageraciones ni datos inventados.

SALIDA: únicamente un objeto JSON válido, sin texto antes ni después, con esta forma exacta:
{"titulo_es": string, "titulo_en": string, "oraciones": [{"texto_es": string, "texto_en": string, "hecho": string, "apoyo": [string, ...]}, ...]}
El título resume el resultado final; si nombra a un jugador, solo puede decir lo que dicen sus hechos.`;

const ABRE = "<hechos>";
const CIERRA = "</hechos>";

/** Lo que el Cronista ve de cada hecho (brief: id, textos, datos, relevancia). */
export function serializarHechos(hechos: Hecho[]): string {
  return JSON.stringify(
    hechos.map((h) => ({ id: h.id, tipo: h.tipo, relevancia: h.relevancia, texto_es: h.texto_es, texto_en: h.texto_en, datos: h.datos })),
    null,
    1,
  );
}

/** Primer mensaje del usuario: los hechos y cuáles son de cobertura obligatoria. */
export function mensajeInicial(hechos: Hecho[]): string {
  const obligatorios = hechos.filter((h) => h.relevancia >= COBERTURA).map((h) => h.id);
  return [
    "Estos son los hechos verificados del partido, ordenados por relevancia:",
    ABRE,
    serializarHechos(hechos),
    CIERRA,
    `Hechos obligatorios (cada uno debe ser el "hecho" principal de una oración que lo narre): ${obligatorios.length > 0 ? obligatorios.join(", ") : "ninguno"}.`,
    "Devolvé solo el JSON de la crónica.",
  ].join("\n");
}

/** Recupera los hechos del mensaje inicial (lo usa el stub; es el mismo formato que ve el LLM real). */
export function extraerHechos(mensaje: string): Hecho[] {
  const a = mensaje.indexOf(ABRE);
  const b = mensaje.indexOf(CIERRA);
  if (a < 0 || b < a) throw new Error("mensaje sin bloque <hechos>");
  return JSON.parse(mensaje.slice(a + ABRE.length, b)) as Hecho[];
}

export const EXPLICACION: Record<Motivo["regla"], string> = {
  V1: "la salida no es JSON válido con el esquema pedido",
  V2: "su hecho principal (o un apoyo) no existe, o no tiene hecho principal",
  V3: "dice una cifra, un marcador, un margen o un periodo que su hecho principal no afirma",
  V4: "nombra a alguien que no está en su hecho principal, o usa una palabra con mayúscula no permitida",
  V5: "un hecho obligatorio no es el principal de ninguna oración, o la oración no narra su hecho",
  V6: "el español y el inglés no tienen las mismas cifras, o uno está vacío",
  V7: "niega un suceso: ningún hecho afirma ausencias",
  V8: "usa una valoración o un verbo de resultado que su hecho principal no respalda",
};

/** Feedback explícito para el reintento: cada motivo, con su regla en palabras. */
export function feedback(motivos: Motivo[]): string {
  const lineas = motivos.map((m) => {
    const donde = m.oracion >= 0 ? `Oración ${m.oracion + 1}` : "General";
    return `- ${donde} — ${m.regla} (${EXPLICACION[m.regla]}): ${m.detalle}`;
  });
  return [
    "El verificador rechazó tu crónica por estos motivos:",
    ...lineas,
    "Corregí exactamente esos problemas sin introducir otros y devolvé el JSON completo de la crónica.",
  ].join("\n");
}
