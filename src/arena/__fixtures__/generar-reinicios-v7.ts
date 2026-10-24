// Regenera arena-reinicios-v7.json (brief 063, prueba C11): `node --import tsx src/arena/__fixtures__/generar-reinicios-v7.ts`.
// Busca la primera semilla (DURACION_FIXTURE_V7_S s, controladores programados, reinicios-v7, semillas 1 a
// SEMILLA_MAX_FIXTURE_V7) con al menos un balón largo (`pase` con `motivo: "largo"`), un remate lejano (`tiro` con
// `motivo: "lejano"`) y `config.atributos`. `tiempoMs` se fija a 0 para que el archivo sea estable byte a byte.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ARENA } from "../../sim/limites";
import { crearControladorProgramado } from "../controladores";
import { ejecutarArena } from "../coordinador";
import { crearConfigArena } from "../motor";
import type { RegistroArena } from "../tipos";

/** Duración del partido del fixture (valor propio del escenario, no una regla). */
export const DURACION_FIXTURE_V7_S = 45;
/** Última semilla de la búsqueda (valor propio del generador, § 13 C11). */
export const SEMILLA_MAX_FIXTURE_V7 = 400;

/** Condiciones que el fixture debe ejercer (también las comprueba la prueba). */
export function condicionesFixtureV7(r: RegistroArena) {
  return {
    reglas: r.config.reglas === "reinicios-v7",
    atributos: r.config.atributos !== undefined && Object.keys(r.config.atributos).length > 0,
    largo: r.eventos.some(e => e.tipo === "pase" && e.motivo === "largo"),
    lejano: r.eventos.some(e => e.tipo === "tiro" && e.motivo === "lejano"),
  };
}
export const cumpleFixtureV7 = (r: RegistroArena): boolean => Object.values(condicionesFixtureV7(r)).every(Boolean);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (let seed = 1; seed <= SEMILLA_MAX_FIXTURE_V7; seed++) {
    const r = await ejecutarArena(crearConfigArena({ seed, duracionS: DURACION_FIXTURE_V7_S, reglas: "reinicios-v7" }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
    if (!cumpleFixtureV7(r)) continue;
    for (const ronda of r.rondas) for (const d of Object.values(ronda.decisiones)) d.tiempoMs = 0;
    const texto = JSON.stringify(r);
    if (Buffer.byteLength(texto) > ARENA.archivoMaxBytes) throw new Error(`semilla ${seed}: el fixture supera archivoMaxBytes`);
    writeFileSync(fileURLToPath(new URL("./arena-reinicios-v7.json", import.meta.url)), texto);
    console.log(`semilla ${seed}: ${r.eventos.length} eventos, ${r.fotogramas.length} fotogramas, ${Buffer.byteLength(texto)} bytes`);
    process.exit(0);
  }
  throw new Error("Ninguna semilla cumple las condiciones del fixture v7");
}
