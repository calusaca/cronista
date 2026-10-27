// Regenera arena-reinicios-v11.json (brief 070 § 2): `node --import tsx src/arena/__fixtures__/generar-reinicios-v11.ts`.
// Busca la primera semilla (DURACION_FIXTURE_V11_S s, controladores programados, reinicios-v11, semillas 1 a
// SEMILLA_MAX_FIXTURE_V11) que, como la de v10, tiene identidades de juego distintas y `config.atributos`, y además ejerce
// v11: al menos una falta, un tiro libre (`reinicio` "libre"), un penal lanzado (`reinicio` "penal" y su `tiro` con
// `motivo: "penal"`) y un gol. `tiempoMs` se fija a 0 para que el archivo sea estable byte a byte.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ARENA } from "../../sim/limites";
import { crearControladorProgramado } from "../controladores";
import { ejecutarArena } from "../coordinador";
import { crearConfigArena } from "../motor";
import type { RegistroArena } from "../tipos";

/** Duración del partido del fixture (valor propio del escenario, no una regla; la misma que la del fixture v10). */
export const DURACION_FIXTURE_V11_S = 45;
/** Última semilla de la búsqueda (valor propio del generador; el brief pide el penal «si existe en 1–200»). */
export const SEMILLA_MAX_FIXTURE_V11 = 200;

/** Condiciones que el fixture debe ejercer (también las comprueba la prueba). */
export function condicionesFixtureV11(r: RegistroArena) {
  return {
    reglas: r.config.reglas === "reinicios-v11",
    identidades: r.config.estilosJuego !== undefined && r.config.estilosJuego.local !== r.config.estilosJuego.visita,
    atributos: r.config.atributos !== undefined && Object.keys(r.config.atributos).length > 0,
    falta: r.eventos.some(e => e.tipo === "falta"),
    libre: r.eventos.some(e => e.tipo === "reinicio" && e.reinicio === "libre"),
    penal: r.eventos.some(e => e.tipo === "reinicio" && e.reinicio === "penal") && r.eventos.some(e => e.tipo === "tiro" && e.motivo === "penal"),
    gol: r.eventos.some(e => e.tipo === "gol"),
  };
}
export const cumpleFixtureV11 = (r: RegistroArena): boolean => Object.values(condicionesFixtureV11(r)).every(Boolean);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (let seed = 1; seed <= SEMILLA_MAX_FIXTURE_V11; seed++) {
    const r = await ejecutarArena(crearConfigArena({ seed, duracionS: DURACION_FIXTURE_V11_S, reglas: "reinicios-v11" }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
    if (!cumpleFixtureV11(r)) continue;
    for (const ronda of r.rondas) for (const d of Object.values(ronda.decisiones)) d.tiempoMs = 0;
    const texto = JSON.stringify(r);
    if (Buffer.byteLength(texto) > ARENA.archivoMaxBytes) throw new Error(`semilla ${seed}: el fixture supera archivoMaxBytes`);
    writeFileSync(fileURLToPath(new URL("./arena-reinicios-v11.json", import.meta.url)), texto);
    const tiros = r.eventos.filter(e => e.tipo === "tiro" && e.motivo === "penal").map(t => t.id);
    console.log(`semilla ${seed}: ${r.config.estilosJuego!.local} frente a ${r.config.estilosJuego!.visita}, ${r.eventos.filter(e => e.tipo === "reinicio" && e.reinicio === "libre").length} tiros libres, penal ${tiros.join(",")} (${r.eventos.some(e => e.tipo === "gol" && e.fuentes?.some(f => tiros.includes(f))) ? "gol" : "sin gol"}), ${r.eventos.filter(e => e.tipo === "gol").length} goles, ${r.eventos.length} eventos, ${r.fotogramas.length} fotogramas, ${Buffer.byteLength(texto)} bytes`);
    process.exit(0);
  }
  throw new Error("Ninguna semilla cumple las condiciones del fixture v11");
}
