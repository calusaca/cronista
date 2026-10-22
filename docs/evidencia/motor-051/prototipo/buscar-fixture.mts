// Busca la primera semilla (D s, programados, prototipo v5) cuyo registro contenga: un tiro_fuera con
// motivo alto, una atajada con desvío, una atajada sin desvío, un tiro_fuera sin motivo (ancho) y un
// gol de remate colocado a un lado (|hasta.y − 34| > arcoM/4). Condiciones candidatas del fixture v5.
import { ARENA } from "/home/calusaca/cronista/src/sim/limites";
import { planProgramado } from "/home/calusaca/cronista/src/arena/controladores";
import { observarArena } from "/home/calusaca/cronista/src/arena/coordinador";
import { crearConfigArena, MotorArena } from "../proto/motor.ts";

const D = Number(process.env.D ?? 60), HASTA = Number(process.env.HASTA ?? 300);
const encontrados: number[] = []; const cuenta = { alto: 0, ancho: 0, desvio: 0, atrapada: 0, golLado: 0, sinAncho: 0 };
for (let seed = 1; seed <= HASTA; seed++) {
  const config = crearConfigArena({ seed, duracionS: D }), motor = new MotorArena(config), total = Math.round(D / ARENA.pasoS);
  while (motor.estado.tick < total && !motor.estado.finalizado) {
    const obs = { local: observarArena(motor as any, "local"), visita: observarArena(motor as any, "visita") };
    motor.avanzar({ local: planProgramado(obs.local), visita: planProgramado(obs.visita) }, Math.min(total, motor.estado.tick + Math.round(config.intervaloS / ARENA.pasoS)));
  }
  const ev = motor.eventos;
  const alto = ev.some(e => e.tipo === "tiro_fuera" && e.motivo === "alto");
  const ancho = ev.some(e => e.tipo === "tiro_fuera" && !e.motivo);
  const desvio = ev.some(e => e.tipo === "atajada" && e.motivo === "desvio");
  const atrapada = ev.some(e => e.tipo === "atajada" && !e.motivo);
  const golLado = ev.some((e, i) => e.tipo === "gol" && !e.autogol && Math.abs(e.hasta.y - ARENA.anchoM / 2) > ARENA.arcoM / 4 && ev.slice(0, i).reverse().find(x => !["plan_equipo", "cambio"].includes(x.tipo))?.tipo === "tiro");
  for (const [k, v] of Object.entries({ alto, ancho, desvio, atrapada, golLado })) if (v) (cuenta as any)[k]++;
  if (alto && desvio && atrapada && golLado) { cuenta.sinAncho++; if (!ancho) console.log(`semilla ${seed} cumple todo salvo ancho`); }
  if (alto && ancho && desvio && atrapada && golLado) { encontrados.push(seed); console.log(`semilla ${seed}: ${ev.length} eventos, ${motor.fotogramas.length} fotogramas; tiros ${ev.filter(e => e.tipo === "tiro").length}`); if (encontrados.length >= 3) break; }
}
console.log("semillas que cumplen:", encontrados, "cuenta por condición:", cuenta, "semillas probadas:", Math.min(HASTA, encontrados.length ? encontrados.at(-1)! : HASTA));
