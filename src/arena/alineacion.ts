import type { Posicion } from "../sim/tipos";
import { puestos } from "./catalogo";
import type { FormacionArena, JugadorArena } from "./tipos";

export function compatibilidadPuesto(j: JugadorArena, puesto: string): number {
  const natural = j.posicionNatural;
  if (!natural) return 100;
  if (puesto === "POR") return natural === "POR" ? 100 : 0;
  if (natural === "POR") return 0;
  const compatibles: Posicion[] = puesto.startsWith("DFC") || puesto === "LI" || puesto === "LD" ? ["DEF"]
    : puesto.startsWith("DC") ? ["DEL"]
    : puesto === "EI" || puesto === "ED" ? ["DEL", "MED"]
    : puesto.startsWith("CAR") ? ["DEF", "MED"] : ["MED"];
  return compatibles.includes(natural) ? 100 : 60;
}

/** Asigna personas a funciones; conserva IDs y posiciones físicas. Puede seleccionar
 * once de una plantilla de 16 o reasignar únicamente los jugadores aún activos. */
export function asignarPuestos(plantilla: readonly JugadorArena[], formacion: FormacionArena): JugadorArena[] {
  const disponibles = [...plantilla], resultado: JugadorArena[] = [];
  for (const puesto of puestos(formacion)) {
    if (!disponibles.length) break;
    const puntuacion = (j: JugadorArena) => {
      const p = j.personalidad;
      const tendencia = puesto.startsWith("DFC") || puesto === "PIV" ? p?.defensiva ?? 50
        : puesto.startsWith("DC") ? p?.remate ?? 50 : p?.pase ?? 50;
      return compatibilidadPuesto(j, puesto) * 10 + j.nivel + tendencia / 10;
    };
    disponibles.sort((a, b) => puntuacion(b) - puntuacion(a) || a.id.localeCompare(b.id));
    const j = disponibles.shift()!;
    resultado.push({ ...j, puesto });
  }
  return resultado;
}

export function elegirFormacion(plantilla: readonly JugadorArena[], preferidas: readonly FormacionArena[]): FormacionArena {
  return [...preferidas].map((f, indice) => ({ f, valor: asignarPuestos(plantilla, f).reduce((s, j) => s + compatibilidadPuesto(j, j.puesto) + j.nivel / 10, 0) - indice * 2 }))
    .sort((a, b) => b.valor - a.valor)[0]!.f;
}
