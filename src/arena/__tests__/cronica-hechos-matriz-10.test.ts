// Brief 064 § 7 I4/I5 · Matriz de partidos programados: semillas 1–200 a 10 s (reglas vigentes). Un archivo por
// duración para que la suite reparta el trabajo; cada bloque de 50 semillas es una prueba.
import { describe, expect, it } from "vitest";
import { incumplimientosI4I5 } from "../__fixtures__/cronica-064";
import { crearControladorProgramado } from "../controladores";
import { ejecutarArena } from "../coordinador";
import { crearConfigArena } from "../motor";

const DURACION_S = 10;
const BLOQUE = 50;
describe(`064 · I4/I5 · 200 semillas programadas a ${DURACION_S} s`, () => {
  for (let inicio = 1; inicio <= 200; inicio += BLOQUE) {
    it(`semillas ${inicio}–${inicio + BLOQUE - 1}`, async () => {
      const fallos: string[] = [];
      for (let seed = inicio; seed < inicio + BLOQUE; seed++) {
        const r = await ejecutarArena(crearConfigArena({ seed, duracionS: DURACION_S }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
        for (const e of incumplimientosI4I5(r)) fallos.push(`semilla ${seed}: ${e}`);
      }
      expect(fallos).toEqual([]);
    });
  }
});
