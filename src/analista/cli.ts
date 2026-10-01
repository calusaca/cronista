// CLI del Analista: `npm run analizar -- --seed 42 [--todo] [--json]`
// Imprime los hechos del partido en orden de relevancia, con sus textos ES/EN y los
// eventos que los respaldan. --todo detalla cada evento citado; --json vuelca Hecho[].
// Brief 009: después, las valoraciones de jugadores (nota 1–10 computada desde los eventos);
// con --todo, el desglose de cada nota.

import { parsearArgs } from "../sim/cli-args";
import { simular } from "../sim/motor";
import { configDeSemilla } from "../sim/plantillas";
import type { Evento } from "../sim/tipos";
import { analizar } from "./analista";
import { figura, notaTxt, valorar } from "./valoracion";

const USO = "uso: npm run analizar -- [--seed <entero 0..4294967295>] [--todo] [--json]";
const args = parsearArgs(process.argv.slice(2));
if (!args.ok) {
  console.error(`error: ${args.error}`);
  console.error(USO);
  process.exit(1);
}
const { seed, todo, json } = args.opciones;

const partido = simular(configDeSemilla(seed));
const hechos = analizar(partido);

if (json) {
  console.log(JSON.stringify(hechos, null, 2));
  process.exit(0);
}

const porId = new Map(partido.eventos.map((e) => [e.id, e] as const));
const fmtMin = (m: number) => (m > 90 ? `90+${m - 90}'` : `${m}'`);
const detalle = (e: Evento): string => {
  const partes = [`${e.id}`, fmtMin(e.minuto), e.equipo === "local" ? "L" : "V", e.tipo];
  if (e.jugador) partes.push(e.jugador);
  if (e.sale) partes.push(`(sale ${e.sale})`);
  if (e.xg !== undefined) partes.push(`xG ${e.xg.toFixed(2)}`);
  if (e.penal) partes.push("penal");
  if (e.relacionadoCon) partes.push(`→ ${e.relacionadoCon}`);
  return partes.join(" ");
};

const linea = "─".repeat(72);
console.log(linea);
console.log(`CRONISTA · analista · semilla ${seed}`);
console.log(`${partido.config.local.nombre} (L) vs ${partido.config.visita.nombre} (V) · ${hechos.length} hechos`);
console.log(linea);
for (const h of hechos) {
  console.log(`${h.id} [${String(h.relevancia).padStart(2)}] ${h.tipo}`);
  console.log(`    ES: ${h.texto_es}`);
  console.log(`    EN: ${h.texto_en}`);
  if (todo) {
    for (const id of h.eventos) {
      const e = porId.get(id);
      console.log(`      · ${e ? detalle(e) : `${id} (NO EXISTE)`}`);
    }
  } else {
    console.log(`    eventos: ${h.eventos.join(", ")}`);
  }
}
console.log(linea);

// Brief 009: valoraciones (computed from match events).
const valoraciones = valorar(partido);
const fig = figura(partido, valoraciones);
const MOTIVO: Record<string, string> = {
  gol: "gol", gol_dificil: "definición difícil", tiro_atajado: "tiro atajado", pase_clave: "pase clave", corner: "córner",
  amarilla: "amarilla", roja: "roja", falta: "falta", fuera_de_juego: "fuera de juego", atajada: "atajada", xg_atajado: "xG atajado",
  gol_recibido: "gol recibido",
};
console.log("Valoraciones (computadas desde los eventos; base, sumas por evento, escala acotada)");
for (const lado of ["local", "visita"] as const) {
  console.log(`  ${partido.config[lado].nombre}`);
  for (const v of valoraciones.filter((x) => x.lado === lado).sort((a, b) => b.nota - a.nota)) {
    const marca = fig && fig.jugador === v.jugador && fig.lado === v.lado ? " ★ figura" : "";
    console.log(`    ${notaTxt(v.nota).padStart(4)}  ${v.posicion}  ${v.jugador}${marca}`);
    if (todo) {
      for (const d of v.desglose) {
        const e = porId.get(d.evento);
        console.log(`            ${d.delta >= 0 ? "+" : ""}${d.delta.toFixed(2)}  ${MOTIVO[d.motivo] ?? d.motivo} · ${e ? detalle(e) : d.evento}`);
      }
    }
  }
}
console.log(linea);
