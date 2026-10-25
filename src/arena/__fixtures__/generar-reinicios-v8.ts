// Regenera arena-reinicios-v8.json (brief 063, prueba D5): `node --import tsx src/arena/__fixtures__/generar-reinicios-v8.ts`.
// Busca la primera semilla (DURACION_FIXTURE_V8_S s, controladores programados, reinicios-v8, semillas 1 a
// SEMILLA_MAX_FIXTURE_V8) cuyos dos clubes tienen identidades de juego distintas (`config.estilosJuego`), con
// `config.atributos`, al menos un balón largo y una persecución. `tiempoMs` se fija a 0 para que el archivo sea estable
// byte a byte.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ARENA } from "../../sim/limites";
import { crearControladorProgramado } from "../controladores";
import { ejecutarArena } from "../coordinador";
import { crearConfigArena } from "../motor";
import type { RegistroArena } from "../tipos";

/** Duración del partido del fixture (valor propio del escenario, no una regla). */
export const DURACION_FIXTURE_V8_S = 45;
/** Última semilla de la búsqueda (valor propio del generador, § 13 D5). */
export const SEMILLA_MAX_FIXTURE_V8 = 400;

/** Condiciones que el fixture debe ejercer (también las comprueba la prueba). */
export function condicionesFixtureV8(r: RegistroArena) {
  return {
    reglas: r.config.reglas === "reinicios-v8",
    identidades: r.config.estilosJuego !== undefined && r.config.estilosJuego.local !== r.config.estilosJuego.visita,
    atributos: r.config.atributos !== undefined && Object.keys(r.config.atributos).length > 0,
    largo: r.eventos.some(e => e.tipo === "pase" && e.motivo === "largo"),
    persecucion: r.fotogramas.some(f => f.persecucion),
  };
}
export const cumpleFixtureV8 = (r: RegistroArena): boolean => Object.values(condicionesFixtureV8(r)).every(Boolean);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (let seed = 1; seed <= SEMILLA_MAX_FIXTURE_V8; seed++) {
    const r = await ejecutarArena(crearConfigArena({ seed, duracionS: DURACION_FIXTURE_V8_S, reglas: "reinicios-v8" }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
    if (!cumpleFixtureV8(r)) continue;
    for (const ronda of r.rondas) for (const d of Object.values(ronda.decisiones)) d.tiempoMs = 0;
    const texto = JSON.stringify(r);
    if (Buffer.byteLength(texto) > ARENA.archivoMaxBytes) throw new Error(`semilla ${seed}: el fixture supera archivoMaxBytes`);
    writeFileSync(fileURLToPath(new URL("./arena-reinicios-v8.json", import.meta.url)), texto);
    console.log(`semilla ${seed}: ${r.config.estilosJuego!.local} frente a ${r.config.estilosJuego!.visita}, ${r.eventos.length} eventos, ${r.fotogramas.length} fotogramas, ${Buffer.byteLength(texto)} bytes`);
    process.exit(0);
  }
  throw new Error("Ninguna semilla cumple las condiciones del fixture v8");
}
