import { ARENA } from "../sim/limites";
import type { Punto } from "./tipos";
export const limitar = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const distancia = (a: Punto, b: Punto): number => Math.hypot(a.x - b.x, a.y - b.y);
export const enCancha = (p: Punto): Punto => ({ x: limitar(p.x, 0, ARENA.largoM), y: limitar(p.y, 0, ARENA.anchoM) });
export function proyeccion(p: Punto, a: Punto, b: Punto): { t: number; distancia: number } {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = limitar(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return { t, distancia: distancia(p, { x: a.x + t * dx, y: a.y + t * dy }) };
}
