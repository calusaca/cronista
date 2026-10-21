// Igual que comun.mts pero con el motor prototipo v4 del scratchpad (no es código de producción).
import { ARENA } from "/home/calusaca/cronista/src/sim/limites";
import { planProgramado } from "/home/calusaca/cronista/src/arena/controladores";
import { observarArena } from "/home/calusaca/cronista/src/arena/coordinador";
import { crearConfigArena, MotorArena } from "../proto/motor.ts";
import type { Tick } from "./comun.mts";
export { MotorArena };
let captura: Tick[] | null = null;
const proto = MotorArena.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
const original = proto.moverBalon!;
proto.moverBalon = function (this: MotorArena, ...a: unknown[]) {
  const r = original.apply(this, a);
  if (captura) {
    const e = this.estado;
    captura.push({ tick: e.tick, bx: e.balon.posicion.x, by: e.balon.posicion.y, poseedor: e.balon.poseedor, vuelo: e.balon.vuelo?.tipo ?? null, vueloLado: e.balon.vuelo?.lado ?? null,
      pausa: !!e.pausa, jug: e.jugadores.map(j => ({ id: j.id, lado: j.lado, puesto: j.puesto, x: j.posicion.x, y: j.posicion.y, vx: j.velocidad.x, vy: j.velocidad.y })) });
  }
  return r;
};
export async function partido(seed: number, duracionS = 120) {
  captura = [];
  const config = crearConfigArena({ seed, duracionS });
  const motor = new MotorArena(config);
  const total = Math.round(config.duracionS / ARENA.pasoS);
  while (motor.estado.tick < total && !motor.estado.finalizado) {
    const obs = { local: observarArena(motor as any, "local"), visita: observarArena(motor as any, "visita") };
    const planes = { local: planProgramado(obs.local), visita: planProgramado(obs.visita) };
    motor.avanzar(planes, Math.min(total, motor.estado.tick + Math.round(config.intervaloS / ARENA.pasoS)));
  }
  const ticks = captura; captura = null;
  return { registro: { eventos: motor.eventos, final: motor.estado, fotogramas: motor.fotogramas } as any, ticks };
}
