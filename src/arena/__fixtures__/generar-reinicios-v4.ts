// Regenera arena-reinicios-v4.json (brief 046): `node --import tsx src/arena/__fixtures__/generar-reinicios-v4.ts`.
// Busca la primera semilla (DURACION_S s, controladores programados, reinicios-v4) con una atajada
// seguida de un saque desde las manos del mismo portero, un centro, un mano a mano en el que el
// portero se desplaza más de LOTE_ARENA_046.desplazamientoM y un desvío con rechace (044 en v4).
// `tiempoMs` se fija a 0 para que el archivo sea estable byte a byte.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ARENA, LOTE_ARENA_046 as L } from "../../sim/limites";
import { crearControladorProgramado } from "../controladores";
import { ejecutarArena } from "../coordinador";
import { crearConfigArena } from "../motor";
import { manoAMano } from "../portero";
import { rival, type RegistroArena } from "../tipos";

/** Duración del partido del fixture (valor propio del escenario, no una regla). */
export const DURACION_FIXTURE_V4_S = 60;

/** Episodios de mano a mano observables en los fotogramas publicados y desplazamiento del portero
 * (proyección sobre la dirección inicial portero → balón). */
export function salidasEnFotogramas(r: RegistroArena): number[] {
  const desplazamientos: number[] = [];
  let tramo: RegistroArena["fotogramas"] = [];
  const cerrar = () => {
    if (tramo.length > 1 && tramo.at(-1)!.tick - tramo[0]!.tick >= L.manoAManoTicks - 1) {
      const a = tramo[0]!, b = tramo.at(-1)!, atacante = a.jugadores.find(j => j.id === a.balon.poseedor)!;
      const k0 = a.jugadores.find(j => j.lado === rival(atacante.lado) && j.puesto === "POR"), k1 = b.jugadores.find(j => j.id === k0?.id);
      if (k0 && k1) {
        const dx = a.balon.posicion.x - k0.posicion.x, dy = a.balon.posicion.y - k0.posicion.y, n = Math.hypot(dx, dy) || 1;
        desplazamientos.push(((k1.posicion.x - k0.posicion.x) * dx + (k1.posicion.y - k0.posicion.y) * dy) / n);
      }
    }
    tramo = [];
  };
  for (const f of r.fotogramas) {
    const p = f.jugadores.find(j => j.id === f.balon.poseedor);
    const mam = p ? manoAMano(f, rival(p.lado), ARENA.radioTiroM) : null;
    if (mam && tramo.length && tramo.at(-1)!.balon.poseedor === mam.id) tramo.push(f);
    else { cerrar(); if (mam) tramo = [f]; }
  }
  cerrar();
  return desplazamientos;
}

/** Condiciones que el fixture debe ejercer (también las comprueba la prueba). */
export function cumpleFixtureV4(r: RegistroArena): boolean {
  const saqueTrasAtajada = r.eventos.some((e, i) => e.tipo === "atajada" && e.motivo !== "desvio"
    && r.eventos.slice(i + 1).find(x => x.jugador === e.jugador && ["pase", "tiro"].includes(x.tipo))?.motivo === "saque_manos"
    && r.fotogramas.some(f => f.tick > e.tick && f.balon.manos?.portero === e.jugador));
  const centro = r.eventos.some(e => e.tipo === "pase" && e.motivo === "centro");
  const salida = salidasEnFotogramas(r).some(d => d > L.desplazamientoM);
  const rechace = r.eventos.some(e => e.tipo === "atajada" && e.motivo === "desvio") && r.fotogramas.some(f => f.balon.vuelo?.tipo === "rechace");
  return r.config.reglas === "reinicios-v4" && saqueTrasAtajada && centro && salida && rechace;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (let seed = 1; seed < 1000; seed++) {
    const r = await ejecutarArena(crearConfigArena({ seed, duracionS: DURACION_FIXTURE_V4_S, reglas: "reinicios-v4" }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
    if (!cumpleFixtureV4(r)) continue;
    for (const ronda of r.rondas) for (const d of Object.values(ronda.decisiones)) d.tiempoMs = 0;
    writeFileSync(fileURLToPath(new URL("./arena-reinicios-v4.json", import.meta.url)), JSON.stringify(r));
    console.log(`semilla ${seed}: ${r.eventos.length} eventos, ${r.fotogramas.length} fotogramas`);
    process.exit(0);
  }
  throw new Error("Ninguna semilla cumple las condiciones del fixture v4");
}
