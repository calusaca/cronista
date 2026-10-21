// Utilidades comunes: ejecuta partidos programados y captura el estado por tick
// envolviendo MotorArena.prototype.moverBalon (sin modificar el repo).
import { ARENA } from "/home/calusaca/cronista/src/sim/limites";
import { crearControladorProgramado } from "/home/calusaca/cronista/src/arena/controladores";
import { ejecutarArena } from "/home/calusaca/cronista/src/arena/coordinador";
import { crearConfigArena, MotorArena } from "/home/calusaca/cronista/src/arena/motor";
import { transformar } from "/home/calusaca/cronista/src/arena/catalogo";
import type { RegistroArena } from "/home/calusaca/cronista/src/arena/tipos";

export interface JugTick { id: string; lado: "local" | "visita"; puesto: string; x: number; y: number; vx: number; vy: number }
export interface Tick { tick: number; bx: number; by: number; poseedor: string | null; vuelo: string | null; vueloLado: string | null; pausa: boolean; jug: JugTick[] }

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

export async function partido(seed: number, duracionS = 120): Promise<{ registro: RegistroArena; ticks: Tick[] }> {
  captura = [];
  const registro = await ejecutarArena(crearConfigArena({ seed, duracionS }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
  const ticks = captura; captura = null;
  return { registro, ticks };
}
/** Coordenadas orientadas: el lado dado ataca hacia x = largo. */
export const orientar = (x: number, y: number, lado: "local" | "visita") => transformar({ x, y }, lado);
export const A = ARENA;
export const rival = (l: string) => (l === "local" ? "visita" : "local") as "local" | "visita";
