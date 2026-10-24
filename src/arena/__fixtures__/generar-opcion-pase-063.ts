// Brief 063 v1.1 § 17.5 · Oráculo independiente de `opcionPase` (prueba 0.4). Se generó ANTES de
// refactorizar `opcionPase` en `evaluarPases`: guarda, para cada jugador de campo de MUESTRAS_ORACULO_063
// estados muestreados de los fixtures v3–v5, el id que devolvía `opcionPase` (o null).
// `node --import tsx src/arena/__fixtures__/generar-opcion-pase-063.ts`
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { opcionPase } from "../controladores";
import { datosEquipos } from "../motor";
import type { Lado } from "../../sim/tipos";
import { lados, type EstadoArena, type ObservacionArena, type RegistroArena } from "../tipos";

/** Fixtures de los que se muestrea (valor propio del oráculo). */
export const FIXTURES_ORACULO_063 = ["arena-reinicios-v3", "arena-reinicios-v4", "arena-reinicios-v5"] as const;
/** Estados muestreados en total (valor propio del oráculo). */
export const MUESTRAS_ORACULO_063 = 200;

export interface EntradaOraculo063 { fixture: string; fotograma: number; jugador: string; opcion: string | null }

export const leerFixture063 = (nombre: string): RegistroArena => JSON.parse(readFileSync(fileURLToPath(new URL(`./${nombre}.json`, import.meta.url)), "utf8")) as RegistroArena;

/** Observación mínima para `opcionPase`: el estado y los datos de equipo de la configuración. */
export function observacionOraculo(r: RegistroArena, estado: EstadoArena, lado: Lado): ObservacionArena {
  return { id: `oraculo:${estado.tick}`, lado, tiempoS: 0, horizonteS: r.config.intervaloS, estado, equipos: datosEquipos(r.config, estado), condiciones: r.config.partido.condiciones ?? null, recientes: [] };
}

/** Los estados muestreados: índices repartidos uniformemente sobre los fotogramas concatenados. */
export function estadosOraculo(): { fixture: string; fotograma: number; registro: RegistroArena; estado: EstadoArena }[] {
  const todos = FIXTURES_ORACULO_063.flatMap(fixture => { const registro = leerFixture063(fixture); return registro.fotogramas.map((estado, fotograma) => ({ fixture, fotograma, registro, estado })); });
  return Array.from({ length: MUESTRAS_ORACULO_063 }, (_, k) => todos[Math.floor(k * todos.length / MUESTRAS_ORACULO_063)]!);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const entradas: EntradaOraculo063[] = [];
  for (const { fixture, fotograma, registro, estado } of estadosOraculo()) {
    for (const lado of lados) {
      const obs = observacionOraculo(registro, estado, lado);
      for (const j of estado.jugadores.filter(p => p.lado === lado && p.puesto !== "POR")) entradas.push({ fixture, fotograma, jugador: j.id, opcion: opcionPase(j, obs)?.id ?? null });
    }
  }
  writeFileSync(fileURLToPath(new URL("./opcion-pase-063.json", import.meta.url)), JSON.stringify(entradas) + "\n");
  console.log(`${entradas.length} entradas, ${entradas.filter(e => e.opcion).length} con pase`);
}
