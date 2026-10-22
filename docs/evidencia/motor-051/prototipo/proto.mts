// Mide el prototipo v5 (proto/motor.ts parcheado) con el bucle programado sin LLM.
// `V5=1 N=100 S0=0 node --import tsx proto.mts [salida.json]`
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const commitRepo = (() => { try { return execFileSync("git", ["-C", "/home/calusaca/cronista", "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch { return null; } })();
import { ARENA } from "/home/calusaca/cronista/src/sim/limites";
import { planProgramado } from "/home/calusaca/cronista/src/arena/controladores";
import { observarArena } from "/home/calusaca/cronista/src/arena/coordinador";
import { crearConfigArena, MotorArena, C5 } from "../proto/motor.ts";
import { agregar, clasificar, instalarCaptura } from "./remates.mts";
import { partidoConNiveles } from "./niveles-check.mts";
const NIV_POR = process.env.NIV_POR ? Number(process.env.NIV_POR) : null, NIV_CAMPO = process.env.NIV_CAMPO ? Number(process.env.NIV_CAMPO) : null;

const N = Number(process.env.N ?? 30), D = Number(process.env.D ?? 120), S0 = Number(process.env.S0 ?? 0);
const { vaciar } = instalarCaptura(MotorArena);
const partidos = [];
for (let seed = S0 + 1; seed <= S0 + N; seed++) {
  const config = crearConfigArena({ seed, duracionS: D, ...(NIV_POR !== null || NIV_CAMPO !== null ? { partido: partidoConNiveles(seed, NIV_POR, NIV_CAMPO) } : {}) });
  const motor = new MotorArena(config);
  const total = Math.round(config.duracionS / ARENA.pasoS);
  while (motor.estado.tick < total && !motor.estado.finalizado) {
    const obs = { local: observarArena(motor as any, "local"), visita: observarArena(motor as any, "visita") };
    motor.avanzar({ local: planProgramado(obs.local), visita: planProgramado(obs.visita) }, Math.min(total, motor.estado.tick + Math.round(config.intervaloS / ARENA.pasoS)));
  }
  partidos.push(clasificar(seed, motor.eventos, vaciar()));
}
const salida = { generado: new Date().toISOString(), commit: commitRepo, motor: process.env.V5 === "1" ? `experimental-v5 (prototipo; POS=${process.env.POS ?? "0"}, TRI=${process.env.TRI ?? "0"})` : "base-v4 (copia parcheada con V5=0)", nivelesForzados: { portero: NIV_POR, campo: NIV_CAMPO }, constantes: C5, duracionS: D, controladores: "programado:geometria-v3 (ambos lados)", ...agregar(process.env.V5 === "1" ? "prototipo-v5" : "reinicios-v4", { desde: S0 + 1, hasta: S0 + N }, partidos) };
const texto = JSON.stringify(salida, null, 1);
if (process.argv[2]) writeFileSync(process.argv[2], texto + "\n");
console.log(texto);
