// Brief 064 § 4.3 · Verificador de la crónica de arena: V1–V8 de la cadena (sin cambios) + una regla de tiempo propia
// de la arena, con letra V3 (la UI y `feedback` ya la explican):
// - «N s» / «N segundos» (ES) y «N s» / «N seconds» (EN) exigen N ∈ {segundo, duracion_s} del hecho principal; en el
//   TÍTULO, que no tiene principal, solo vale `duracion_s` del resultado.
// - Cualquier número junto a «minuto(s)» / «minute(s)» se rechaza: la arena no tiene minutos.
// El singular («1 segundo») y «segundo N» no se prometen: el V3 histórico lee «segundo» como el ordinal 2 y los rechaza.
// El patrón «m:ss» no se trata: sus números ya los juzga V3.
//
// Lo que NO comprueba (se declara en la página): causas, intenciones y tácticas («presionó», «persiguió»), cualidades
// del remate o del pase fuera de la tabla, relaciones espaciales salvo la distancia del remate, el papel de una cifra
// fuera de marcadores y tiempo, y la prosa libre que no toque las familias mantenidas.

import type { CronicaDraft, Motivo } from "../cadena/tipos";
import { normalizar, verificarDraft, type HechoVerificable } from "../cadena/verificador";
import type { SimConfig } from "../sim/tipos";

const SEGUNDOS: Record<"es" | "en", RegExp> = {
  es: /(?<![\d.,])(\d+)\s*(?:s|segundos)(?![\p{L}])/gu,
  en: /(?<![\d.,])(\d+)\s*(?:s|seconds)(?![\p{L}])/gu,
};
const MINUTOS = [/(\d+)\s*(?:minutos?|minutes?)(?![\p{L}])/giu, /(?:minutos?|minutes?)\s+(\d+)/giu];

/** Segundos que habilita un hecho (segundo y duracion_s), como enteros. */
function segundosDe(h: HechoVerificable | undefined, soloDuracion: boolean): Set<number> {
  const s = new Set<number>();
  if (!h) return s;
  for (const k of soloDuracion ? ["duracion_s"] : ["segundo", "duracion_s"]) {
    const v = h.datos[k];
    if (typeof v === "number") s.add(v);
  }
  return s;
}

function revisar(texto: string, lengua: "es" | "en", permitidos: Set<number>, oracion: number, prefijo: string, motivos: Motivo[]): void {
  const t = normalizar(texto);
  const etiqueta = lengua === "es" ? "ES" : "EN";
  for (const m of t.matchAll(SEGUNDOS[lengua])) {
    const n = Number(m[1]);
    if (!permitidos.has(n)) {
      const esperado = [...permitidos].join(", ") || "ninguno";
      motivos.push({ oracion, regla: "V3", detalle: `${prefijo}tiempo «${m[0].trim()}» no coincide con el segundo del hecho (${esperado}) (${etiqueta})` });
    }
  }
  for (const re of MINUTOS) {
    for (const m of t.matchAll(re)) {
      motivos.push({ oracion, regla: "V3", detalle: `${prefijo}«${m[0].trim()}»: en la arena el tiempo va en segundos, no en minutos (${etiqueta})` });
    }
  }
}

/** La regla de tiempo de la arena sobre título y oraciones. */
export function reglasTiempoArena(draft: CronicaDraft, hechos: HechoVerificable[]): Motivo[] {
  const motivos: Motivo[] = [];
  const porId = new Map(hechos.map((h) => [h.id, h] as const));
  const resultado = hechos.find((h) => h.tipo === "resultado_final");
  const titulo = segundosDe(resultado, true);
  revisar(draft.titulo_es, "es", titulo, -1, "título: ", motivos);
  revisar(draft.titulo_en, "en", titulo, -1, "título: ", motivos);
  draft.oraciones.forEach((o, i) => {
    const permitidos = segundosDe(porId.get(o.hecho), false);
    revisar(o.texto_es, "es", permitidos, i, "", motivos);
    revisar(o.texto_en, "en", permitidos, i, "", motivos);
  });
  return motivos;
}

/** V1–V8 de la cadena + la regla de tiempo de la arena. */
export function verificarCronicaArena(draft: CronicaDraft, hechos: HechoVerificable[], config: SimConfig): Motivo[] {
  return [...verificarDraft(draft, hechos, { config }), ...reglasTiempoArena(draft, hechos)];
}
