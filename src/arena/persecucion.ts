// Brief 063 · Bloque A (reinicios-v6): repliegue de emergencia y persecución tras pérdida. Funciones
// puras; el motor las llama solo bajo reinicios-v6. Las cifras salen de PERSECUCION_ARENA.
import { ARENA, PERSECUCION_ARENA as PE } from "../sim/limites";
import type { Lado } from "../sim/tipos";
import { lineaDePuesto } from "./atributos";
import { transformar } from "./catalogo";
import { distancia, enCancha, limitar } from "./geometria";
import { lados, rival, type EstadoArena, type JugadorArena, type PlanTecnico, type Punto } from "./tipos";

/** § 6.1 · El poseedor de campo (sin balón en las manos) cuya x orientada supera estrictamente la de todos
 * los rivales de campo (sin el portero), en su propio marco. Sin rivales de campo, null. */
export function superadoPor(estado: EstadoArena): JugadorArena | null {
  const p = estado.jugadores.find(j => j.id === estado.balon.poseedor);
  if (!p || p.puesto === "POR" || estado.balon.manos) return null;
  const rivales = estado.jugadores.filter(j => j.lado !== p.lado && j.puesto !== "POR");
  if (!rivales.length) return null;
  const x = transformar(p.posicion, p.lado).x;
  return x > Math.max(...rivales.map(j => transformar(j.posicion, p.lado).x)) ? p : null;
}

/** El perseguidor de cada lado: el jugador de campo más cercano al balón (en empate, el id menor). Es la
 * misma regla que el motor aplica desde arena-v1. */
export function perseguidoresDe(jugadores: readonly JugadorArena[], balon: Punto): Record<Lado, string | undefined> {
  return Object.fromEntries(lados.map(lado => [lado, jugadores.filter(j => j.lado === lado && j.puesto !== "POR").sort((a, b) => distancia(a.posicion, balon) - distancia(b.posicion, balon) || a.id.localeCompare(b.id))[0]?.id])) as Record<Lado, string | undefined>;
}

/** § 6.2 · Conjunto `repliegue`: con un poseedor superado, los jugadores de campo del lado que defiende de
 * las líneas `repliegue.lineas`, sin su perseguidor, a ≤ `repliegue.radioM` del balón, ordenados por
 * distancia al balón y luego por id; los primeros `repliegue.max` (+ `extra`). Sin superado, vacío. */
export function seleccionRepliegue(estado: EstadoArena, perseguidores: Record<Lado, string | undefined>, extra = 0): JugadorArena[] {
  const s = superadoPor(estado);
  if (!s) return [];
  const defiende = rival(s.lado), balon = estado.balon.posicion, lineas: readonly string[] = PE.repliegue.lineas;
  return estado.jugadores.filter(j => j.lado === defiende && j.puesto !== "POR" && lineas.includes(lineaDePuesto(j.puesto)) && j.id !== perseguidores[defiende] && distancia(j.posicion, balon) <= PE.repliegue.radioM)
    .sort((a, b) => distancia(a.posicion, balon) - distancia(b.posicion, balon) || a.id.localeCompare(b.id)).slice(0, PE.repliegue.max + extra);
}

/** § 6.2 · Destino del repliegue: a `adelantoM` del balón (o el arco, si está más cerca) sobre la recta
 * balón–centro del arco del lado que defiende. */
export function destinoRepliegue(balon: Punto, lado: Lado): Punto {
  const g = transformar({ x: 0, y: ARENA.anchoM / 2 }, lado);
  const dx = g.x - balon.x, dy = g.y - balon.y, d = Math.hypot(dx, dy);
  if (!d) return { ...g };
  const k = Math.min(PE.repliegue.adelantoM, d) / d;
  return enCancha({ x: balon.x + dx * k, y: balon.y + dy * k });
}

/** § 6.3 · x orientada propia mínima del destino de un perseguidor según su línea (DEF: 0, sin límite). */
export function limiteXPersecucion(j: Pick<JugadorArena, "puesto">): number {
  const linea = lineaDePuesto(j.puesto);
  return linea === "POR" ? 0 : PE.limiteFraccion[linea] * ARENA.largoM;
}
/** § 6.3 · Límite por línea: acota la x orientada propia del destino a ≥ `limiteXPersecucion`. */
export function limitarPersecucion(destino: Punto, j: Pick<JugadorArena, "puesto" | "lado">): Punto {
  const propio = transformar(destino, j.lado);
  propio.x = Math.max(propio.x, limiteXPersecucion(j));
  return transformar(propio, j.lado);
}
/** § 6.3 · Destino de la persecución: el balón, con el límite por línea. */
export const destinoPersecucion = (balon: Punto, j: Pick<JugadorArena, "puesto" | "lado">): Punto => limitarPersecucion({ ...balon }, j);

/** § 6.3 · Duración (s) de la persecución del perdedor de campo: segundos de su línea por agresividad
 * (50 si falta), bloque del plan (medio si falta) y energía, acotada a [minS, maxS]. */
export function duracionPersecucionS(perdedor: Pick<JugadorArena, "puesto" | "energia" | "personalidad">, bloque: PlanTecnico["bloque"] = "medio"): number {
  const linea = lineaDePuesto(perdedor.puesto);
  if (linea === "POR") throw new Error("El portero no persigue");
  const agresividad = perdedor.personalidad?.agresividad ?? 50;
  return limitar(PE.segundos[linea] * (PE.agresividadMin + PE.agresividadRango * agresividad / 100) * PE.bloque[bloque] * (PE.energiaMin + (1 - PE.energiaMin) * perdedor.energia), PE.minS, PE.maxS);
}
/** § 6.3 · Tick en que vence una persecución creada en `tick`. */
export const hastaTickPersecucion = (tick: number, segundos: number): number => tick + Math.round(segundos / ARENA.pasoS);
