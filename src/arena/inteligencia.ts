import { ARENA } from "../sim/limites";
import { resumir } from "./entorno";
import type { EstadoArena, EventoArena, RegistroArena } from "./tipos";
import { narrarEventoArena } from "./vista";

export interface HechoArena {
  id: string; tick: number; tipo: EventoArena["tipo"]; lado: EventoArena["lado"]; jugadores: string[];
  texto_es: string; texto_en: string; eventos: string[];
}
export function hechosArena(registro: RegistroArena, hastaTick: number): HechoArena[] {
  const eventos = registro.eventos.filter(e => e.tick <= hastaTick);
  const conocidos = new Set<string>();
  return eventos.map(e => {
    conocidos.add(e.id);
    const base = { id: `arena:${e.id}`, tick: e.tick, tipo: e.tipo, lado: e.lado, jugadores: [e.jugador, e.receptor, e.sale].filter((j): j is string => !!j), eventos: [e.id, ...(e.fuentes ?? []).filter(id => conocidos.has(id) && id !== e.id)] };
    if (e.tipo === "plan_equipo") return { ...base,
      texto_es: `${e.entrenador} revisa la formación a ${e.formacion}. Motivo declarado: «${e.motivo ?? "revisión"}».`,
      texto_en: `${e.entrenador} reviews the formation: ${e.formacion}. Stated reason: “${e.motivo ?? "review"}”.`,
    };
    return { ...base, texto_es: narrarEventoArena(e, registro, "es"), texto_en: narrarEventoArena(e, registro, "en") };
  });
}

export function inteligenciaArena(registro: RegistroArena, estado: EstadoArena, ventanaS = 30) {
  const eventos = registro.eventos.filter(e => e.tick <= estado.tick);
  const recientes = eventos.filter(e => e.tick > estado.tick - ventanaS / ARENA.pasoS);
  return {
    tick: estado.tick, ventanaS: Math.min(ventanaS, estado.tick * ARENA.pasoS),
    resumen: resumir(estado, eventos, ventanaS),
    fuentes: recientes.filter(e => ["pase", "recepcion", "intercepcion", "recuperacion", "tiro", "gol"].includes(e.tipo)).map(e => e.id),
    hechos: hechosArena(registro, estado.tick),
  };
}

/** Dataset de ventanas ya observadas; se puede importar en evaluación de Foundry. */
export function datasetEvaluacionArena(registro: RegistroArena, cadaS = 30) {
  if (!Number.isInteger(cadaS) || cadaS < 1) throw new Error("Ventana inválida");
  const ticks = registro.fotogramas.filter((f, i, all) => f.tick > 0 && (f.tick % Math.round(cadaS / ARENA.pasoS) === 0 || i === all.length - 1)).map(f => f.tick);
  return [...new Set(ticks)].map(tick => {
    const estado = registro.fotogramas.find(f => f.tick === tick)!;
    const inteligencia = inteligenciaArena(registro, estado);
    const hechos = inteligencia.hechos.slice(-12);
    return {
      id: `${registro.version}:${registro.config.partido.seed}:${tick}`, tick, seed: registro.config.partido.seed,
      query: "Explain the latest confirmed football action for a casual fan. Use only this context and cite its fact ID. Do not anticipate the result or invent causes.",
      context: JSON.stringify({ tiempoS: tick * ARENA.pasoS, marcador: estado.marcador, hechos, resumen: inteligencia.resumen }),
      ground_truth: hechos.at(-1)?.texto_en ?? "No confirmed action yet.",
      response: hechos.at(-1)?.texto_en ?? "No confirmed action yet.",
      procedencia: "plantilla_determinista", fuentes: hechos.flatMap(h => h.eventos),
    };
  });
}
