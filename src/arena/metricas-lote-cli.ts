// Brief 046 · Métricas de lote con metadatos de reproducción. Brief 051: también las métricas de
// remate (bandas de LOTE_ARENA_051) y, con --controlado, el experimento controlado de niveles.
// `node --import tsx src/arena/metricas-lote-cli.ts --desde 1 --semillas 100 [--reglas reinicios-v4] [--controlado] [--salida archivo.json]`
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { ARENA, LOTE_ARENA_046 as L, LOTE_ARENA_051 as L51 } from "../sim/limites";
import { incumplimientos, incumplimientosControlado, medirControlado, medirLote } from "./metricas-lote";
import { reglasArena, type ReglasArena } from "./tipos";

const arg = (nombre: string) => { const i = process.argv.indexOf(`--${nombre}`); return i > 0 ? process.argv[i + 1] : undefined; };
const desde = Number(arg("desde") ?? L.completo.semillaDesde), semillas = Number(arg("semillas") ?? L.completo.semillas);
const reglas = (arg("reglas") ?? ARENA.reglas) as ReglasArena;
const controlado = process.argv.includes("--controlado");
if (!reglasArena.includes(reglas) || !Number.isInteger(desde) || !Number.isInteger(semillas) || semillas < 1) throw new Error("Argumentos inválidos");
const git = (...a: string[]) => { try { return execFileSync("git", ["-c", `safe.directory=${process.cwd()}`, ...a], { encoding: "utf8" }).trim(); } catch { return null; } };
const inicio = performance.now();
const metricas = await medirLote({ desde, semillas, reglas });
const rapido = semillas === L.rapido.semillas;
const banda = rapido ? L.rapido : L.completo, banda051 = rapido ? L51.rapido : L51.completo;
let experimento: Record<string, unknown> | undefined;
if (controlado) {
  const porteros = await medirControlado({ desde, semillas, reglas, quien: "portero" });
  const campo = await medirControlado({ desde, semillas, reglas, quien: "campo" });
  const resumen = (x: Awaited<ReturnType<typeof medirControlado>>) => ({ diferencia: x.diferencia, bajo: x.bajo.remate, alto: x.alto.remate });
  experimento = { niveles: L51.nivelesControlado, porteros: resumen(porteros), campo: resumen(campo),
    incumplimientos: incumplimientosControlado({ porteros: porteros.diferencia, campo: campo.diferencia }, banda051) };
}
const salida = {
  generado: new Date().toISOString(), commit: git("rev-parse", "HEAD"), arbolConCambios: !!git("status", "--porcelain"),
  reglas, semillas: { desde, hasta: desde + semillas - 1 }, duracionS: metricas.duracionS,
  controladores: "programado:geometria-v3 (ambos lados)", banda: rapido ? "rapido" : "completo",
  incumplimientos: incumplimientos(metricas, banda, banda051), segundos: Math.round((performance.now() - inicio) / 100) / 10,
  ...(experimento ? { controlado: experimento } : {}), metricas,
};
const texto = JSON.stringify(salida, null, 1);
const archivo = arg("salida");
if (archivo) writeFileSync(archivo, texto + "\n");
console.log(texto);
