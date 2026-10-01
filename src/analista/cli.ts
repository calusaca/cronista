// CLI del Analista: `npm run analizar -- --seed 42 [--todo] [--json]`
// Imprime los hechos del partido en orden de relevancia, con sus textos ES/EN y los
// eventos que los respaldan. --todo detalla cada evento citado; --json vuelca Hecho[].

import { parsearArgs } from "../sim/cli-args";
import { simular } from "../sim/motor";
import { configDeSemilla } from "../sim/plantillas";
import type { Evento } from "../sim/tipos";
import { analizar } from "./analista";

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
