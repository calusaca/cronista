// Localiza, bajo el prototipo, los saques desde las manos interceptados en ≤ saqueInmediataS y
// describe el contexto (distancia, aéreo, rival más cercano a la línea al golpear, quién toca y cuándo).
import { ARENA, LOTE_ARENA_046 as L, PORTERO_ARENA as PO } from "/home/calusaca/cronista/src/sim/limites";
import { planProgramado } from "/home/calusaca/cronista/src/arena/controladores";
import { observarArena } from "/home/calusaca/cronista/src/arena/coordinador";
import { distancia, proyeccion } from "/home/calusaca/cronista/src/arena/geometria";
import { crearConfigArena, MotorArena } from "../proto/motor.ts";

const N = Number(process.env.N ?? 100), S0 = Number(process.env.S0 ?? 0), D = Number(process.env.D ?? 120);
const toque = new Set(["recepcion", "intercepcion", "recuperacion", "atajada", "fuera_juego", "reinicio", "gol"]);
for (let seed = S0 + 1; seed <= S0 + N; seed++) {
  const config = crearConfigArena({ seed, duracionS: D }), motor = new MotorArena(config), total = Math.round(D / ARENA.pasoS);
  const contexto: Record<number, string> = {};
  const proto = MotorArena.prototype as any, orig = proto.sacarBalon;
  proto.sacarBalon = function (this: any, j: any, tipo: string, destino: any, receptor: any, extra: any) {
    if (extra?.motivo === "saque_manos") {
      const rivales = this.estado.jugadores.filter((p: any) => p.lado !== j.lado);
      const linea = Math.min(...rivales.map((r: any) => proyeccion(r.posicion, j.posicion, destino).distancia));
      const cerca = Math.min(...rivales.map((r: any) => distancia(r.posicion, j.posicion)));
      contexto[this.estado.tick + 1] = `d=${distancia(j.posicion, destino).toFixed(1)} aereo=${!!extra.aereo} forzado=${this.estado.tick >= (this.estado.balon.manos?.hastaTick ?? Infinity)} rivalLinea=${linea.toFixed(2)} rivalCerca=${cerca.toFixed(2)} portero=(${j.posicion.x.toFixed(1)},${j.posicion.y.toFixed(1)}) destino=(${destino.x.toFixed(1)},${destino.y.toFixed(1)})`;
    }
    return orig.call(this, j, tipo, destino, receptor, extra);
  };
  while (motor.estado.tick < total && !motor.estado.finalizado) {
    const obs = { local: observarArena(motor as any, "local"), visita: observarArena(motor as any, "visita") };
    motor.avanzar({ local: planProgramado(obs.local), visita: planProgramado(obs.visita) }, Math.min(total, motor.estado.tick + Math.round(config.intervaloS / ARENA.pasoS)));
  }
  proto.sacarBalon = orig;
  const ev = motor.eventos;
  ev.forEach((e, i) => {
    if (e.tipo !== "pase" || e.motivo !== "saque_manos") return;
    const primero = ev.slice(i + 1).find(x => toque.has(x.tipo));
    if (primero && primero.lado !== e.lado && ["recepcion", "intercepcion", "recuperacion", "atajada"].includes(primero.tipo) && (primero.tick - e.tick) * ARENA.pasoS <= L.saqueInmediataS)
      console.log(`semilla ${seed} tick ${e.tick}: ${e.jugador} → ${e.receptor} ${contexto[e.tick]}; toca ${primero.jugador} (${primero.tipo}) en tick ${primero.tick} en (${primero.hasta.x.toFixed(1)},${primero.hasta.y.toFixed(1)}); saqueAereoMinM=${PO.saqueAereoMinM} lineaSaqueMinM=${PO.lineaSaqueMinM}`);
  });
}
