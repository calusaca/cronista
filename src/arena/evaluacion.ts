import { verificarUpdate } from "../cadena/verificador";
import type { Llm } from "../lib/llm";
import { narrarArena } from "./narrador";
import { datasetEvaluacionArena } from "./inteligencia";
import type { RegistroArena } from "./tipos";

export async function evaluarNarracionArena(registro: RegistroArena, llm: Llm, opciones: { maxVentanas?: number; cadaS?: number; signal?: AbortSignal } = {}) {
  const ventanas = datasetEvaluacionArena(registro, opciones.cadaS ?? 15).slice(0, opciones.maxVentanas ?? 4);
  const casos = [];
  for (const ventana of ventanas) {
    opciones.signal?.throwIfAborted();
    const inicio = performance.now();
    const comentario = await narrarArena(registro, ventana.tick, llm, { signal: opciones.signal });
    if (!comentario) continue;
    const primero = comentario.audit[0]!, contexto = { config: registro.config.partido };
    const consulta = `Narrate fact ${comentario.principal} for a casual football fan in English and Spanish, using only the confirmed context. Do not anticipate results.`;
    const filas = (["primer_borrador", "pipeline"] as const).map(brazo => {
      const oraciones = brazo === "primer_borrador" ? primero.oraciones : comentario.oraciones;
      const response = oraciones.map(o => `[ES] ${o.texto_es}\n[EN] ${o.texto_en}`).join("\n");
      const motivos = verificarUpdate(JSON.stringify({ oraciones }), comentario.hechos, contexto, comentario.principal, 2).motivos;
      return { id: `${ventana.id}:${brazo}`, brazo, query: consulta, context: JSON.stringify({ tick: ventana.tick, principal: comentario.principal, hechos: comentario.hechos }), response,
        ground_truth: comentario.hechos.find(h => h.id === comentario.principal)!.texto_en,
        procedencia: brazo === "primer_borrador" && !primero.oraciones.length ? "sin_borrador_valido" : brazo === "pipeline" && comentario.modo === "plantilla" ? "respaldo_plantilla" : "modelo_real", tick: ventana.tick, fuentes: comentario.hechos.flatMap(h => h.eventos), motivos,
      };
    });
    casos.push({ tick: ventana.tick, duracionMs: performance.now() - inicio, comentario, filas });
  }
  return { modelo: llm.id, metodo: "ablacion_verificacion_mismo_primer_borrador", casos, filas: casos.flatMap(c => c.filas), uso: llm.uso?.() ?? null,
    limites: ["Las reglas del producto no constituyen evaluación semántica independiente.", "La comparación aísla verificación y feedback; no demuestra por sí sola superioridad multiagente.", "Las generaciones nuevas pueden variar; la revisión humana ciega sigue pendiente."],
  };
}
