import { ARENA } from "../sim/limites";
import type { Lado } from "../sim/tipos";
import type { EstadoArena, Punto } from "./tipos";
import { anclas, transformar } from "./catalogo";
import { distancia } from "./geometria";

export const PUNTO_CENTRAL = { x: ARENA.largoM / 2, y: ARENA.anchoM / 2 };

/** Colocación común al saque inicial y al saque posterior a un gol. */
export function colocarCentro(estado: EstadoArena, lado: Lado) {
  const ejecutor = estado.jugadores.filter(j => j.lado === lado && j.puesto !== "POR")
    .sort((a, b) => distancia(a.posicion, PUNTO_CENTRAL) - distancia(b.posicion, PUNTO_CENTRAL) || a.id.localeCompare(b.id))[0]!;
  for (const j of estado.jugadores) {
    const base = anclas(estado.entrenadores![j.lado].formacion, j.lado, "base")[j.puesto]!;
    const nominal = transformar(base, j.lado);
    // Comprimir la formación hacia su mitad conserva las distancias entre líneas;
    // recortar todas las x a la misma línea superponía algunos compañeros.
    nominal.x *= (j.lado === lado ? 50 : 43) / ARENA.largoM;
    j.posicion = transformar(nominal, j.lado); j.velocidad = { x: 0, y: 0 };
  }
  ejecutor.posicion = { ...PUNTO_CENTRAL };
  return ejecutor;
}

/** Primer cruce del segmento con el perímetro; no cuenta una aproximación a la línea. */
export function cruceDeBanda(desde: Punto, hasta: Punto): { punto: Punto; borde: "lateral" | "fondo"; t: number } | null {
  const candidatos: { punto: Punto; borde: "lateral" | "fondo"; t: number }[] = [];
  const dx = hasta.x - desde.x, dy = hasta.y - desde.y;
  for (const x of [0, ARENA.largoM]) if (dx && (x === 0 ? hasta.x < x : hasta.x > x)) {
    const t = (x - desde.x) / dx;
    if (t >= 0 && t <= 1) candidatos.push({ punto: { x, y: desde.y + dy * t }, borde: "fondo", t });
  }
  for (const y of [0, ARENA.anchoM]) if (dy && (y === 0 ? hasta.y < y : hasta.y > y)) {
    const t = (y - desde.y) / dy;
    if (t >= 0 && t <= 1) candidatos.push({ punto: { x: desde.x + dx * t, y }, borde: "lateral", t });
  }
  return candidatos.sort((a, b) => a.t - b.t)[0] ?? null;
}
export const defensorDePorteria = (x: number): Lado => x < ARENA.largoM / 2 ? "local" : "visita";
