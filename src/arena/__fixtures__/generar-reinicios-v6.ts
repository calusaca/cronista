// Regenera arena-reinicios-v6.json (brief 063, prueba A10): `node --import tsx src/arena/__fixtures__/generar-reinicios-v6.ts`.
// Busca la primera semilla (DURACION_FIXTURE_V6_S s, controladores programados, reinicios-v6) con al menos
// un fotograma con persecución activa y un episodio superado de al menos EPISODIO_MIN_S con al menos
// REPLIEGUE_MIN_FIXTURE jugadores en repliegue, ambos observables en los fotogramas publicados.
// `tiempoMs` se fija a 0 para que el archivo sea estable byte a byte.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ARENA, LOTE_ARENA_063 as L63 } from "../../sim/limites";
import { crearControladorProgramado } from "../controladores";
import { ejecutarArena } from "../coordinador";
import { crearConfigArena } from "../motor";
import { perseguidoresDe, seleccionRepliegue, superadoPor } from "../persecucion";
import type { EstadoArena, RegistroArena } from "../tipos";

/** Duración del partido del fixture (valor propio del escenario, no una regla). */
export const DURACION_FIXTURE_V6_S = 45;
/** Última semilla de la búsqueda (valor propio del generador). */
export const SEMILLA_MAX_FIXTURE_V6 = 400;
/** Jugadores mínimos en repliegue durante el episodio (valor propio del fixture, § 13 A10). */
export const REPLIEGUE_MIN_FIXTURE = 2;

const enJuego = (f: EstadoArena) => !f.saque && !(f.pausa && f.tick < f.pausa.hastaTick);
/** Episodios superados observables en los fotogramas: fotogramas consecutivos con el mismo poseedor
 * superado; duración (s) del primero al último y máximo de jugadores en repliegue. */
export function episodiosSuperados(r: RegistroArena): { poseedor: string; duracionS: number; repliegueMax: number }[] {
  const episodios: { poseedor: string; desde: number; hasta: number; repliegueMax: number }[] = [];
  let previo: string | null = null;
  for (const f of r.fotogramas) {
    const s = enJuego(f) ? superadoPor(f) : null;
    const n = s ? seleccionRepliegue(f, perseguidoresDe(f.jugadores, f.balon.posicion)).length : 0;
    if (s && previo === s.id) { const e = episodios.at(-1)!; e.hasta = f.tick; e.repliegueMax = Math.max(e.repliegueMax, n); }
    else if (s) episodios.push({ poseedor: s.id, desde: f.tick, hasta: f.tick, repliegueMax: n });
    previo = s?.id ?? null;
  }
  return episodios.map(e => ({ poseedor: e.poseedor, duracionS: (e.hasta - e.desde) * ARENA.pasoS, repliegueMax: e.repliegueMax }));
}

/** Condiciones que el fixture debe ejercer (también las comprueba la prueba). */
export function condicionesFixtureV6(r: RegistroArena) {
  return {
    reglas: r.config.reglas === "reinicios-v6",
    persecucion: r.fotogramas.some(f => f.persecucion !== null && f.persecucion !== undefined),
    repliegue: episodiosSuperados(r).some(e => e.duracionS >= L63.repliegue.edadMinS && e.repliegueMax >= REPLIEGUE_MIN_FIXTURE),
  };
}
export const cumpleFixtureV6 = (r: RegistroArena): boolean => Object.values(condicionesFixtureV6(r)).every(Boolean);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (let seed = 1; seed <= SEMILLA_MAX_FIXTURE_V6; seed++) {
    const r = await ejecutarArena(crearConfigArena({ seed, duracionS: DURACION_FIXTURE_V6_S, reglas: "reinicios-v6" }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
    if (!cumpleFixtureV6(r)) continue;
    for (const ronda of r.rondas) for (const d of Object.values(ronda.decisiones)) d.tiempoMs = 0;
    const texto = JSON.stringify(r);
    if (Buffer.byteLength(texto) > ARENA.archivoMaxBytes) throw new Error(`semilla ${seed}: el fixture supera archivoMaxBytes`);
    writeFileSync(fileURLToPath(new URL("./arena-reinicios-v6.json", import.meta.url)), texto);
    console.log(`semilla ${seed}: ${r.eventos.length} eventos, ${r.fotogramas.length} fotogramas, ${Buffer.byteLength(texto)} bytes`);
    process.exit(0);
  }
  throw new Error("Ninguna semilla cumple las condiciones del fixture v6");
}
