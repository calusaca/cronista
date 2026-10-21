// Brief 046 · Métricas de lote con metadatos de reproducción.
// `node --import tsx src/arena/metricas-lote-cli.ts --desde 1 --semillas 100 [--reglas reinicios-v3] [--salida archivo.json]`
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { ARENA, LOTE_ARENA_046 as L } from "../sim/limites";
import { incumplimientos, medirLote } from "./metricas-lote";
import { reglasArena, type ReglasArena } from "./tipos";

const arg = (nombre: string) => { const i = process.argv.indexOf(`--${nombre}`); return i > 0 ? process.argv[i + 1] : undefined; };
const desde = Number(arg("desde") ?? L.completo.semillaDesde), semillas = Number(arg("semillas") ?? L.completo.semillas);
const reglas = (arg("reglas") ?? ARENA.reglas) as ReglasArena;
if (!reglasArena.includes(reglas) || !Number.isInteger(desde) || !Number.isInteger(semillas) || semillas < 1) throw new Error("Argumentos inválidos");
const git = (...a: string[]) => { try { return execFileSync("git", ["-c", `safe.directory=${process.cwd()}`, ...a], { encoding: "utf8" }).trim(); } catch { return null; } };
const inicio = performance.now();
const metricas = await medirLote({ desde, semillas, reglas });
const banda = semillas === L.rapido.semillas ? L.rapido : L.completo;
const salida = {
  generado: new Date().toISOString(), commit: git("rev-parse", "HEAD"), arbolConCambios: !!git("status", "--porcelain"),
  controladores: "programado:geometria-v3 (ambos lados)", banda: banda === L.rapido ? "rapido" : "completo",
  incumplimientos: incumplimientos(metricas, banda), segundos: Math.round((performance.now() - inicio) / 100) / 10, metricas,
};
const texto = JSON.stringify(salida, null, 1);
const archivo = arg("salida");
if (archivo) writeFileSync(archivo, texto + "\n");
console.log(texto);
