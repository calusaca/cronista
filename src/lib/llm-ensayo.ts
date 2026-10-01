// LLM de ENSAYO (fixture para el e2e del 004/006). NO es un modelo: es el stub con un
// error deliberado en el PRIMER intento (una cifra inventada en una oración), que el
// Verificador rechaza (V3); en el reintento devuelve la crónica correcta. Así la UI tiene
// una frase «corregida» (↻) con historia real del Verificador para probar la Caja de cristal.
//
// Regla de honestidad del 006: jamás alimenta la demo. Solo se activa con
// CRONISTA_LLM=ensayo, y la UI lo rotula como «test fixture».

import { borradorDesdeHechos, updateDesdeMensaje } from "./llm-stub";
import type { Llm, Mensaje } from "./llm";

/** La cifra inventada (fuera de cualquier hecho del simulador). */
export const CIFRA_ENSAYO = 37;

export function crearLlmEnsayo(): Llm {
  return {
    id: "ensayo",
    async completar(_system: string, mensajes: Mensaje[]): Promise<string> {
      const primero = mensajes.find((m) => m.rol === "user");
      if (!primero) throw new Error("ensayo: no hay mensaje del usuario");
      const esPrimerIntento = mensajes.filter((m) => m.rol === "user").length === 1;
      // Brief 008: en una actualización en vivo, el mismo error deliberado en el primer intento.
      const update = updateDesdeMensaje(primero.contenido);
      if (update) {
        const o = update.oraciones[0];
        if (esPrimerIntento && o) {
          o.texto_es += ` Hubo ${CIFRA_ENSAYO} remates en esa jugada.`;
          o.texto_en += ` There were ${CIFRA_ENSAYO} shots in that move.`;
        }
        return JSON.stringify(update);
      }
      const d = borradorDesdeHechos(primero.contenido);
      if (esPrimerIntento && d.oraciones.length > 0) {
        // Se corrompe la segunda oración si existe (la primera es el resultado final).
        const o = d.oraciones[Math.min(1, d.oraciones.length - 1)]!;
        o.texto_es += ` Hubo ${CIFRA_ENSAYO} remates en esa jugada.`;
        o.texto_en += ` There were ${CIFRA_ENSAYO} shots in that move.`;
      }
      return JSON.stringify(d);
    },
  };
}
