// CLI de inspección: `npm run sim -- --seed 42 [--todo] [--json]`
// Imprime marcador, goleadores, estadísticas y una línea de tiempo compacta.
// --todo muestra todos los eventos; --json vuelca el Partido completo.

import { parsearArgs } from "./cli-args";
import { simular } from "./motor";
import { configDeSemilla } from "./plantillas";
import { resumir } from "./resumen";
import type { Evento, Lado, Partido } from "./tipos";

const USO = "uso: npm run sim -- [--seed <entero 0..4294967295>] [--todo] [--json]";
const args = parsearArgs(process.argv.slice(2));
if (!args.ok) {
  console.error(`error: ${args.error}`);
  console.error(USO);
  process.exit(1);
}
const { seed } = args.opciones;

const partido: Partido = simular(configDeSemilla(seed));

if (args.opciones.json) {
  console.log(JSON.stringify(partido, null, 2));
  process.exit(0);
}

const { local, visita } = partido.config;
const nombre = (l: Lado) => (l === "local" ? local.nombre : visita.nombre);
const fmtMin = (m: number) => (m > 90 ? `90+${m - 90}'` : `${m}'`);
const r = resumir(partido);

const linea = "─".repeat(64);
console.log(linea);
console.log(`CRONISTA · simulador · semilla ${seed}`);
console.log(linea);
console.log(`${local.nombre} (L) — atq ${local.ataque} / def ${local.defensa} / ${local.estilo}`);
console.log(`${visita.nombre} (V) — atq ${visita.ataque} / def ${visita.defensa} / ${visita.estilo}`);
console.log();
console.log(`  ${local.nombre}  ${r.local.goles} – ${r.visita.goles}  ${visita.nombre}`);
console.log();

const porId = new Map(partido.eventos.map((e) => [e.id, e] as const));
const goles = partido.eventos.filter((e) => e.tipo === "gol");
for (const lado of ["local", "visita"] as const) {
  const g = goles.filter((e) => e.equipo === lado);
  const txt = g
    .map((e) => {
      const tiro = e.relacionadoCon ? porId.get(e.relacionadoCon) : undefined;
      return `${e.jugador} ${fmtMin(e.minuto)}${tiro?.penal ? " (p)" : ""}`;
    })
    .join(", ");
  console.log(`  Goles ${nombre(lado)}: ${txt || "—"}`);
}
console.log();

const fila = (etq: string, a: number | string, b: number | string) =>
  console.log(`  ${String(a).padStart(6)}  ${etq.padEnd(16)}${String(b).padStart(6)}`);
fila("xG", r.local.xg.toFixed(2), r.visita.xg.toFixed(2));
fila("Tiros", r.local.tiros, r.visita.tiros);
fila("Atajadas*", r.local.atajadas, r.visita.atajadas);
fila("Pases clave", r.local.pasesClave, r.visita.pasesClave);
fila("Corners", r.local.corners, r.visita.corners);
fila("Faltas", r.local.faltas, r.visita.faltas);
fila("Amarillas", r.local.amarillas, r.visita.amarillas);
fila("Rojas", r.local.rojas, r.visita.rojas);
fila("Fuera de juego", r.local.fuerasDeJuego, r.visita.fuerasDeJuego);
fila("Cambios", r.local.cambios, r.visita.cambios);
console.log("  * atajadas a tiros de ese equipo (las hizo el portero rival)");
console.log();

const todo = args.opciones.todo;
const relevante = (e: Evento): boolean => {
  if (todo) return true;
  switch (e.tipo) {
    case "inicio_periodo":
    case "fin_periodo":
    case "gol":
    case "tarjeta_amarilla":
    case "tarjeta_roja":
    case "cambio":
      return true;
    case "tiro":
      return e.penal === true || (e.xg ?? 0) >= 0.3;
    case "atajada": {
      const t = e.relacionadoCon ? porId.get(e.relacionadoCon) : undefined;
      return t !== undefined && (t.penal === true || (t.xg ?? 0) >= 0.3);
    }
    default:
      return false;
  }
};

const ETIQUETA: Record<Evento["tipo"], string> = {
  inicio_periodo: "inicio de periodo",
  fin_periodo: "fin de periodo",
  pase_clave: "pase clave",
  tiro: "tiro",
  gol: "GOL",
  atajada: "atajada",
  falta: "falta",
  tarjeta_amarilla: "amarilla",
  tarjeta_roja: "ROJA",
  corner: "corner",
  fuera_de_juego: "fuera de juego",
  cambio: "entra",
  lesion: "LESIÓN",
  subida_portero: "SUBE EL PORTERO",
  interrupcion: "INTERRUPCIÓN",
};

console.log(todo ? "Línea de tiempo (todos los eventos):" : "Línea de tiempo (goles, tarjetas, cambios, ocasiones xG ≥ 0.30, penales):");
let marcador = { local: 0, visita: 0 };
for (const e of partido.eventos) {
  if (e.tipo === "gol") marcador = { ...marcador, [e.equipo]: marcador[e.equipo] + 1 };
  if (!relevante(e)) continue;
  const extra: string[] = [];
  if (e.xg !== undefined) extra.push(`xG ${e.xg.toFixed(2)}`);
  if (e.penal) extra.push("penal");
  if (e.tipo === "gol") extra.push(`${marcador.local}-${marcador.visita}`);
  if (e.relacionadoCon) extra.push(`→ ${e.relacionadoCon}`);
  const quien = (e.jugador ? ` ${e.jugador}` : "") + (e.sale ? ` por ${e.sale}` : "");
  const lado = e.equipo === "local" ? "L" : "V";
  console.log(
    `  ${fmtMin(e.minuto).padStart(6)} ${e.id} ${lado} ${ETIQUETA[e.tipo]}${quien}${extra.length ? `  (${extra.join(", ")})` : ""}`,
  );
}
console.log(linea);
console.log(`${partido.eventos.length} eventos`);
