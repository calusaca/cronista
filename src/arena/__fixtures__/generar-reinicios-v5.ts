// Regenera arena-reinicios-v5.json (brief 051): `node --import tsx src/arena/__fixtures__/generar-reinicios-v5.ts`.
// Busca la primera semilla (DURACION_FIXTURE_V5_S s, controladores programados, reinicios-v5) con un
// remate por encima del travesaño, una atajada con desvío, una atajada sin desvío, un remate fuera
// por ancho y un gol de remate colocado en una mitad exterior del arco.
// `tiempoMs` se fija a 0 para que el archivo sea estable byte a byte.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ARENA } from "../../sim/limites";
import { crearControladorProgramado } from "../controladores";
import { ejecutarArena } from "../coordinador";
import { crearConfigArena } from "../motor";
import type { RegistroArena } from "../tipos";

/** Duración del partido del fixture (valor propio del escenario, no una regla). */
export const DURACION_FIXTURE_V5_S = 90;
/** Última semilla de la búsqueda (valor propio del generador). */
export const SEMILLA_MAX_FIXTURE_V5 = 400;
const neutros = new Set(["plan_equipo", "cambio"]);

/** Condiciones que el fixture debe ejercer (también las comprueba la prueba). */
export function condicionesFixtureV5(r: RegistroArena) {
  const ev = r.eventos;
  return {
    reglas: r.config.reglas === "reinicios-v5",
    alto: ev.some(e => e.tipo === "tiro_fuera" && e.motivo === "alto"),
    ancho: ev.some(e => e.tipo === "tiro_fuera" && e.motivo === undefined),
    desvio: ev.some(e => e.tipo === "atajada" && e.motivo === "desvio"),
    atrapada: ev.some(e => e.tipo === "atajada" && e.motivo === undefined),
    golColocado: ev.some((e, i) => e.tipo === "gol" && !e.autogol && Math.abs(e.hasta.y - ARENA.anchoM / 2) > ARENA.arcoM / 4
      && ev.slice(0, i).reverse().find(x => !neutros.has(x.tipo))?.tipo === "tiro"),
  };
}
export const cumpleFixtureV5 = (r: RegistroArena): boolean => Object.values(condicionesFixtureV5(r)).every(Boolean);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (let seed = 1; seed <= SEMILLA_MAX_FIXTURE_V5; seed++) {
    const r = await ejecutarArena(crearConfigArena({ seed, duracionS: DURACION_FIXTURE_V5_S, reglas: "reinicios-v5" }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
    if (!cumpleFixtureV5(r)) continue;
    for (const ronda of r.rondas) for (const d of Object.values(ronda.decisiones)) d.tiempoMs = 0;
    const texto = JSON.stringify(r);
    if (Buffer.byteLength(texto) > ARENA.archivoMaxBytes) throw new Error(`semilla ${seed}: el fixture supera archivoMaxBytes`);
    writeFileSync(fileURLToPath(new URL("./arena-reinicios-v5.json", import.meta.url)), texto);
    console.log(`semilla ${seed}: ${r.eventos.length} eventos, ${r.fotogramas.length} fotogramas, ${Buffer.byteLength(texto)} bytes`);
    process.exit(0);
  }
  throw new Error("Ninguna semilla cumple las condiciones del fixture v5");
}
