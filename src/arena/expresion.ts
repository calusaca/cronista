import { ARENA, CANTO_GOL } from "../sim/limites";
import { prngDerivado } from "../sim/prng";
import type { Lado } from "../sim/tipos";
import type { EstadoArena, EventoArena } from "./tipos";

export type EmocionVoz = "serena" | "tension" | "emocion" | "sorpresa" | "jubilo" | "decepcion" | "seria";
export interface FragmentoVoz {
  tick: number; texto: string; emocion: EmocionVoz; intensidad: number; variante: number;
  fuentes: string[]; fotogramas: number[];
  /** Brief 045: voz que pronuncia el fragmento; ausente equivale a "narrador". */
  rol?: "narrador" | "comentarista" | "estadista";
  /** Brief 050 v1.1 · Canto de gol del narrador: tramos de prosodia dentro de un solo `<s>`.
   * Invariante: `texto === canto.tramos.map(t => t.texto).join(" ")`. */
  canto?: { tramos: TramoCanto[] };
}
export type TipoTramoCanto = "grito" | "goleador" | "hechos" | "autogol";
export interface TramoCanto { texto: string; tipo: TipoTramoCanto }
export const limitarIntensidad = (n: number) => Math.max(0, Math.min(1, n));
export function varianteVoz(seed: number, id: string) { return prngDerivado(seed, `voz-expresiva-v1:${id}`).int(0, 3); }

/** Tensión editorial, no probabilidad de gol. Solo usa el estado observado. */
export function amenazaConBalon(estado: EstadoArena, lado: Lado): number {
  if (estado.balon.vuelo || estado.pausa && estado.pausa.hastaTick > estado.tick) return 0;
  const j = estado.jugadores.find(j => j.id === estado.balon.poseedor && j.lado === lado);
  if (!j) return 0;
  const sentido = lado === "local" ? 1 : -1;
  const avance = (lado === "local" ? j.posicion.x : ARENA.largoM - j.posicion.x) / ARENA.largoM;
  if (avance < 0.65) return 0;
  const velocidad = Math.max(0, sentido * j.velocidad.x);
  const central = 1 - Math.min(1, Math.abs(j.posicion.y - ARENA.anchoM / 2) / (ARENA.anchoM / 2));
  const defensores = estado.jugadores.filter(d => d.lado !== lado && sentido * (d.posicion.x - j.posicion.x) >= 0 && Math.abs(d.posicion.y - j.posicion.y) < 12 && Math.abs(d.posicion.x - j.posicion.x) < 25).length;
  return limitarIntensidad((avance - 0.5) * 1.1 + Math.min(velocidad / 8, 1) * 0.2 + central * 0.15 - Math.min(defensores, 4) * 0.04);
}

export function expresionEvento(e: EventoArena, estado: EstadoArena, anterior: { tick: number; intensidad: number; lado: Lado } | null, duracionS: number): Pick<FragmentoVoz, "emocion" | "intensidad"> {
  const amenaza = amenazaConBalon(estado, e.lado);
  const memoria = anterior?.lado === e.lado ? Math.max(0, anterior.intensidad - (e.tick - anterior.tick) * ARENA.pasoS * 0.12) : 0;
  const tension = Math.max(amenaza, memoria);
  // Brief 050: misma regla que «sobre el final» del canto, con las cifras de CANTO_GOL.
  if (e.tipo === "gol") return { emocion: "jubilo", intensidad: e.tick * ARENA.pasoS >= duracionS * CANTO_GOL.tardioDesdeFraccion && Math.abs(estado.marcador.local - estado.marcador.visita) <= CANTO_GOL.tardioDiferenciaMax ? 1 : 0.92 };
  if (e.tipo === "tiro") return { emocion: "emocion", intensidad: 0.85 };
  if (e.tipo === "atajada") return { emocion: "sorpresa", intensidad: 0.88 };
  if (e.tipo === "tiro_fuera") return { emocion: "decepcion", intensidad: 0.65 };
  if (e.tipo === "roja" || e.tipo === "final_anticipado") return { emocion: "seria", intensidad: 0.8 };
  if (e.tipo === "amarilla" || e.tipo === "falta") return { emocion: "seria", intensidad: 0.45 };
  if (e.tipo === "fuera_juego") return { emocion: tension > 0.4 ? "decepcion" : "seria", intensidad: Math.max(0.35, tension * 0.7) };
  if (e.tipo === "reinicio" || e.tipo === "plan_equipo" || e.tipo === "cambio") return { emocion: "serena", intensidad: 0.2 };
  if ((e.tipo === "intercepcion" || e.tipo === "recuperacion") && anterior && anterior.lado !== e.lado && anterior.intensidad > 0.6 && e.tick - anterior.tick <= 40) return { emocion: "sorpresa", intensidad: 0.65 };
  return { emocion: tension >= 0.45 ? "tension" : "serena", intensidad: tension >= 0.45 ? Math.min(tension, 0.75) : 0.18 };
}
