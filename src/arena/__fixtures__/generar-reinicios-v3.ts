// Regenera arena-reinicios-v3.json (brief 044): `node --import tsx src/arena/__fixtures__/generar-reinicios-v3.ts`.
// Busca la primera semilla (40 s, intervalo 10) con un desvío del portero cuyo rechace sale
// por la línea de fondo y una ventana local con arreglo de dos sustituciones junto a una
// sustitución visitante con forma objeto en la misma interrupción. El local usa el
// controlador de prueba `programado:doble-cambio-prueba`; `tiempoMs` se fija a 0 para que
// el archivo sea estable byte a byte.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { crearControladorProgramado, planProgramado, validarOrdenes } from "../controladores";
import { ejecutarArena } from "../coordinador";
import { crearConfigArena } from "../motor";
import type { ControladorEquipo, OrdenesEquipo, RegistroArena } from "../tipos";

/** En su primera revisión válida retira a los dos titulares de campo con menos energía. */
export function controladorDobleCambio(): ControladorEquipo {
  let hecho = false;
  return { id: "programado:doble-cambio-prueba", tipo: "programado", async decidir(obs) {
    const plan = planProgramado(obs), t = obs.estado.entrenadores?.[obs.lado];
    if (hecho || !t || obs.estado.tick < t.proximaRevisionTick) return plan;
    const titulares = obs.estado.jugadores.filter(j => j.lado === obs.lado && j.puesto !== "POR").sort((a, b) => a.energia - b.energia || a.id.localeCompare(b.id));
    const banco = (obs.estado.banco ?? []).filter(j => j.lado === obs.lado && j.posicionNatural !== "POR");
    if (titulares.length < 2 || banco.length < 2) return plan;
    const gestion = plan.gestion ?? { formacion: null, mentalidad: t.plan.mentalidad, sustitucion: null, motivo: "rotación doble", fuentes: [] };
    const candidato: OrdenesEquipo = { ...plan, gestion: { ...gestion, sustitucion: [{ sale: titulares[0]!.id, entra: banco[0]!.id }, { sale: titulares[1]!.id, entra: banco[1]!.id }] } };
    try { validarOrdenes(candidato, obs); hecho = true; return candidato; } catch { return plan; }
  } };
}

/** Condiciones que el fixture debe ejercer (también las comprueba la prueba). */
export function cumpleFixtureV3(r: RegistroArena): boolean {
  const saleFuera = r.eventos.some(d => {
    if (d.tipo !== "atajada" || d.motivo !== "desvio") return false;
    const sig = r.eventos.find(e => e.tick > d.tick && ["recepcion", "intercepcion", "recuperacion", "reinicio", "gol", "atajada", "tiro_fuera"].includes(e.tipo));
    return sig?.tipo === "reinicio" && (sig.reinicio === "esquina" || sig.reinicio === "meta");
  });
  const ventana = r.rondas.some(ronda => Array.isArray(ronda.decisiones.local.ordenes.gestion?.sustitucion) && !!ronda.decisiones.visita.ordenes.gestion?.sustitucion && !Array.isArray(ronda.decisiones.visita.ordenes.gestion.sustitucion));
  const cambios = r.eventos.filter(e => e.tipo === "cambio");
  const misma = cambios.some(c => cambios.filter(o => o.tick === c.tick && o.lado === "local").length >= 2 && cambios.some(o => o.tick === c.tick && o.lado === "visita"));
  return saleFuera && ventana && misma;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (let seed = 1; seed < 1000; seed++) {
    const r = await ejecutarArena(crearConfigArena({ seed, duracionS: 40, intervaloS: 10, reglas: "reinicios-v3" }), { local: controladorDobleCambio(), visita: crearControladorProgramado() });
    if (!cumpleFixtureV3(r)) continue;
    for (const ronda of r.rondas) for (const d of Object.values(ronda.decisiones)) d.tiempoMs = 0;
    writeFileSync(fileURLToPath(new URL("./arena-reinicios-v3.json", import.meta.url)), JSON.stringify(r));
    console.log(`semilla ${seed}: ${r.eventos.length} eventos, ${r.fotogramas.length} fotogramas`);
    process.exit(0);
  }
  throw new Error("Ninguna semilla cumple las condiciones del fixture v3");
}
