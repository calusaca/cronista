// LLM stub (brief 003): determinista, offline, $0. Construye el JSON CORRECTO desde
// las plantillas de los hechos que recibe en el mismo mensaje que vería el LLM real:
// título = el resultado final; una oración por hecho, que lo narra como principal
// (contrato de la revisión 3.1). Ignora el feedback
// (su primera respuesta ya es correcta). Todo el pipeline funciona offline con él.

import { extraerHechos } from "../cadena/prompt";
import type { CronicaDraft, Oracion } from "../cadena/tipos";
import { extraerHechoMomento } from "../vivo/prompt";
import type { Llm, Mensaje } from "./llm";

/**
 * Brief 008: si el mensaje es de una ACTUALIZACIÓN en vivo, la respuesta correcta es una
 * oración: la plantilla del hecho del momento. Devuelve undefined si no es una actualización.
 */
export function updateDesdeMensaje(mensaje: string): { oraciones: Oracion[] } | undefined {
  const id = extraerHechoMomento(mensaje);
  if (id === undefined) return undefined;
  const h = extraerHechos(mensaje).find((x) => x.id === id);
  return { oraciones: h ? [{ texto_es: h.texto_es, texto_en: h.texto_en, hecho: h.id }] : [] };
}

export function borradorDesdeHechos(mensajeInicial: string): CronicaDraft {
  const hechos = extraerHechos(mensajeInicial);
  const resultado = hechos.find((h) => h.tipo === "resultado_final") ?? hechos[0];
  return {
    titulo_es: resultado?.texto_es ?? "",
    titulo_en: resultado?.texto_en ?? "",
    oraciones: hechos.map((h) => ({ texto_es: h.texto_es, texto_en: h.texto_en, hecho: h.id })),
  };
}

export function crearLlmStub(): Llm {
  return {
    id: "stub",
    async completar(_system: string, mensajes: Mensaje[]): Promise<string> {
      const primero = mensajes.find((m) => m.rol === "user");
      if (!primero) throw new Error("stub: no hay mensaje del usuario");
      return JSON.stringify(updateDesdeMensaje(primero.contenido) ?? borradorDesdeHechos(primero.contenido));
    },
  };
}
