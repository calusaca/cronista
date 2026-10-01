// Modo acta (brief 003): la crónica armada directo de las plantillas del Analista,
// seca pero 100 % fiel. Es el último recurso cuando el LLM no logra pasar el
// Verificador; también se puede pedir a mano (CLI --modo acta).

import type { Hecho } from "../analista/tipos";
import type { CronicaDraft } from "./tipos";

/** Título del acta: el texto del resultado final (siempre existe, brief 002). */
export function tituloActa(hechos: Hecho[]): { titulo_es: string; titulo_en: string } {
  const r = hechos.find((h) => h.tipo === "resultado_final") ?? hechos[0];
  return { titulo_es: r?.texto_es ?? "", titulo_en: r?.texto_en ?? "" };
}

/** Una oración por hecho, en el orden de relevancia del Analista, cada una narrando su hecho como principal. */
export function borradorActa(hechos: Hecho[]): CronicaDraft {
  return {
    ...tituloActa(hechos),
    oraciones: hechos.map((h) => ({ texto_es: h.texto_es, texto_en: h.texto_en, hecho: h.id })),
  };
}
