// Regenera arena-reinicios-v9.json (brief 065 § 2): `node --import tsx src/arena/__fixtures__/generar-reinicios-v9.ts`.
// Busca la primera semilla (DURACION_FIXTURE_V9_S s, controladores programados, reinicios-v9, semillas 1 a
// SEMILLA_MAX_FIXTURE_V9) que, como la de v8, tiene identidades de juego distintas, `config.atributos`, un balón largo y
// una persecución, y además ejerce el remate de v9: al menos un gol y una atajada del portero. `tiempoMs` se fija a 0
// para que el archivo sea estable byte a byte.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ARENA } from "../../sim/limites";
import { crearControladorProgramado } from "../controladores";
import { ejecutarArena } from "../coordinador";
import { crearConfigArena } from "../motor";
import type { RegistroArena } from "../tipos";

/** Duración del partido del fixture (valor propio del escenario, no una regla; la misma que la del fixture v8). */
export const DURACION_FIXTURE_V9_S = 45;
/** Última semilla de la búsqueda (valor propio del generador). */
export const SEMILLA_MAX_FIXTURE_V9 = 400;

/** Condiciones que el fixture debe ejercer (también las comprueba la prueba). */
export function condicionesFixtureV9(r: RegistroArena) {
  return {
    reglas: r.config.reglas === "reinicios-v9",
    identidades: r.config.estilosJuego !== undefined && r.config.estilosJuego.local !== r.config.estilosJuego.visita,
    atributos: r.config.atributos !== undefined && Object.keys(r.config.atributos).length > 0,
    largo: r.eventos.some(e => e.tipo === "pase" && e.motivo === "largo"),
    persecucion: r.fotogramas.some(f => f.persecucion),
    gol: r.eventos.some(e => e.tipo === "gol"),
    atajada: r.eventos.some(e => e.tipo === "atajada"),
  };
}
export const cumpleFixtureV9 = (r: RegistroArena): boolean => Object.values(condicionesFixtureV9(r)).every(Boolean);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (let seed = 1; seed <= SEMILLA_MAX_FIXTURE_V9; seed++) {
    const r = await ejecutarArena(crearConfigArena({ seed, duracionS: DURACION_FIXTURE_V9_S, reglas: "reinicios-v9" }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
    if (!cumpleFixtureV9(r)) continue;
    for (const ronda of r.rondas) for (const d of Object.values(ronda.decisiones)) d.tiempoMs = 0;
    const texto = JSON.stringify(r);
    if (Buffer.byteLength(texto) > ARENA.archivoMaxBytes) throw new Error(`semilla ${seed}: el fixture supera archivoMaxBytes`);
    writeFileSync(fileURLToPath(new URL("./arena-reinicios-v9.json", import.meta.url)), texto);
    console.log(`semilla ${seed}: ${r.config.estilosJuego!.local} frente a ${r.config.estilosJuego!.visita}, ${r.eventos.filter(e => e.tipo === "gol").length} goles, ${r.eventos.length} eventos, ${r.fotogramas.length} fotogramas, ${Buffer.byteLength(texto)} bytes`);
    process.exit(0);
  }
  throw new Error("Ninguna semilla cumple las condiciones del fixture v9");
}
