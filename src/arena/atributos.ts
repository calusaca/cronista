// Brief 063 · Módulo puro de atributos e identidad de juego. Publicación 1 (reinicios-v6): solo la línea
// de un puesto (§ 4.6), que usan el repliegue y la persecución. Los atributos (§ 4.4) y la identidad
// (§ 4.5) llegan con reinicios-v7 y reinicios-v8.
import type { LineaArena } from "./tipos";

/** Línea del puesto ACTUAL (un medio natural que juega de extremo persigue como delantero). */
export function lineaDePuesto(puesto: string): LineaArena {
  if (puesto === "POR") return "POR";
  if (puesto.startsWith("DFC") || puesto === "LI" || puesto === "LD" || puesto.startsWith("CAR")) return "DEF";
  if (puesto.startsWith("DC") || puesto === "EI" || puesto === "ED") return "DEL";
  return "MED";
}
