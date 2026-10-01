// LLM stub (brief 003): determinista, offline, $0. Construye el JSON CORRECTO desde
// las plantillas de los hechos que recibe en el mismo mensaje que vería el LLM real:
// título = el resultado final; una oración por hecho, que lo narra como principal
// (contrato de la revisión 3.1). Ignora el feedback
// (su primera respuesta ya es correcta). Todo el pipeline funciona offline con él.

import { extraerHechos } from "../cadena/prompt";
import type { CronicaDraft } from "../cadena/tipos";
import type { Llm, Mensaje } from "./llm";

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
      return JSON.stringify(borradorDesdeHechos(primero.contenido));
    },
  };
}
