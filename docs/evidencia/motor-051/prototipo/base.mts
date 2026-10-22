// Línea base del brief 051 con el motor del repositorio (programados, N semillas de D s).
// `REGLAS=reinicios-v4 N=100 S0=0 node --import tsx base.mts [salida.json]`
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { ARENA } from "/home/calusaca/cronista/src/sim/limites";
import { crearControladorProgramado } from "/home/calusaca/cronista/src/arena/controladores";
import { ejecutarArena } from "/home/calusaca/cronista/src/arena/coordinador";
import { crearConfigArena, MotorArena } from "/home/calusaca/cronista/src/arena/motor";
import { agregar, clasificar, instalarCaptura } from "./remates.mts";

const N = Number(process.env.N ?? 30), D = Number(process.env.D ?? 120), S0 = Number(process.env.S0 ?? 0);
const reglas = (process.env.REGLAS ?? ARENA.reglas) as any;
const { buffer, vaciar } = instalarCaptura(MotorArena);
const partidos = [];
for (let seed = S0 + 1; seed <= S0 + N; seed++) {
  const registro = await ejecutarArena(crearConfigArena({ seed, duracionS: D, reglas }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
  partidos.push(clasificar(seed, registro.eventos, vaciar()));
}
const commit = (() => { try { return execFileSync("git", ["-C", "/home/calusaca/cronista", "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch { return null; } })();
const salida = { generado: new Date().toISOString(), commit, motor: "repositorio", duracionS: D, controladores: "programado:geometria-v3 (ambos lados)", ...agregar(reglas, { desde: S0 + 1, hasta: S0 + N }, partidos) };
const texto = JSON.stringify(salida, null, 1);
if (process.argv[2]) writeFileSync(process.argv[2], texto + "\n");
console.log(texto);
