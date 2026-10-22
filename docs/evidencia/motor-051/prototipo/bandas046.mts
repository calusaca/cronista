// Comprueba las bandas 044/046 (LOTE_ARENA_046) sobre el prototipo: muestrea todos los ticks como
// `muestrasPartido` del helper del repo, pero con la clase MotorArena parcheada.
// `V5=1 ... N=100 S0=0 node --import tsx bandas046.mts [salida.json]`
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const commitRepo = (() => { try { return execFileSync("git", ["-C", "/home/calusaca/cronista", "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch { return null; } })();
import { ARENA, LOTE_ARENA_046 as L, PORTERO_ARENA as PO } from "/home/calusaca/cronista/src/sim/limites";
const toqueS = new Set(["recepcion", "intercepcion", "recuperacion", "atajada"]), finS = new Set([...toqueS, "fuera_juego", "reinicio", "gol"]);
let inmediatasCortas = 0, inmediatasTotal = 0;
import { planProgramado } from "/home/calusaca/cronista/src/arena/controladores";
import { observarArena } from "/home/calusaca/cronista/src/arena/coordinador";
import { agregarLote, analizarPartido, incumplimientos, incumplimientosSaques, type MuestraTick } from "/home/calusaca/cronista/src/arena/metricas-lote";
import { manoAMano } from "/home/calusaca/cronista/src/arena/portero";
import { rival } from "/home/calusaca/cronista/src/arena/tipos";
import { crearConfigArena, MotorArena, C5 } from "../proto/motor.ts";

const N = Number(process.env.N ?? 100), D = Number(process.env.D ?? L.duracionS), S0 = Number(process.env.S0 ?? 0);
function muestrear(estado: any, eventos: number, planes?: any): MuestraTick {
  const balon = estado.balon, poseedor = estado.jugadores.find((j: any) => j.id === balon.poseedor);
  const pausado = !!(estado.pausa && estado.tick < estado.pausa.hastaTick);
  const mam = poseedor ? manoAMano(estado, rival(poseedor.lado), ARENA.radioTiroM) : null;
  const orden = poseedor && planes ? planes[poseedor.lado].ordenes.find((o: any) => o.jugador === poseedor.id) : undefined;
  const conducir = poseedor && poseedor.puesto !== "POR" && !pausado && !estado.saque && orden?.accion === "conducir" ? Math.hypot(poseedor.velocidad.x, poseedor.velocidad.y) : null;
  return { tick: estado.tick, eventos, poseedor: balon.poseedor, balon: { ...balon.posicion }, manos: balon.manos?.portero ?? null, pausado, manoAMano: mam?.id ?? null, conducir,
    jugadores: estado.jugadores.map((j: any) => ({ id: j.id, lado: j.lado, puesto: j.puesto, x: j.posicion.x, y: j.posicion.y })) };
}
const proto = MotorArena.prototype as any; const original = proto.planesActivos; let muestras: MuestraTick[] = [];
proto.planesActivos = function (planes: any) { const a = original.call(this, planes); muestras.push(muestrear(this.estado, this.eventos.length, a)); return a; };
const partidos = [];
for (let seed = S0 + 1; seed <= S0 + N; seed++) {
  muestras = [];
  const config = crearConfigArena({ seed, duracionS: D }), motor = new MotorArena(config), total = Math.round(D / ARENA.pasoS);
  while (motor.estado.tick < total && !motor.estado.finalizado) {
    const obs = { local: observarArena(motor as any, "local"), visita: observarArena(motor as any, "visita") };
    motor.avanzar({ local: planProgramado(obs.local), visita: planProgramado(obs.visita) }, Math.min(total, motor.estado.tick + Math.round(config.intervaloS / ARENA.pasoS)));
  }
  muestras.push(muestrear(motor.estado, motor.eventos.length));
  partidos.push(analizarPartido(seed, muestras, motor.eventos));
  motor.eventos.forEach((e, i) => {
    if (e.tipo !== "pase" || e.motivo !== "saque_manos") return;
    const primero = motor.eventos.slice(i + 1).find(x => finS.has(x.tipo));
    // v1.1 #4: dos contadores: temporal (046) y temporal con radio desde el origen del saque (toque a ≤ RADIO_INMEDIATA m).
    if (primero && toqueS.has(primero.tipo) && primero.lado !== e.lado && (primero.tick - e.tick) * ARENA.pasoS <= L.saqueInmediataS) { inmediatasTotal++; if (Math.hypot(primero.hasta.x - e.desde.x, primero.hasta.y - e.desde.y) <= Number(process.env.RADIO_INMEDIATA ?? 15)) inmediatasCortas++; }
  });
}
const m = agregarLote((process.env.V5 === "1" ? "prototipo-v5" : "reinicios-v4") as any, D, partidos); // v1.1 #8: etiqueta inequívoca
const banda = N === L.rapido.semillas ? L.rapido : L.completo;
const salida = { generado: new Date().toISOString(), commit: commitRepo, motor: process.env.V5 === "1" ? `experimental-v5 (prototipo; POS=${process.env.POS ?? "0"}, TRI=${process.env.TRI ?? "0"})` : "base-v4 (copia parcheada con V5=0)", constantes: C5, banda: banda === L.rapido ? "rapido" : "completo", incumplimientos: incumplimientos(m, banda), incumplimientosSaques: incumplimientosSaques(m, banda), intercepcionesInmediatas: { temporal: inmediatasTotal, temporalConRadio: inmediatasCortas, radioM: Number(process.env.RADIO_INMEDIATA ?? 15) }, metricas: m };
const texto = JSON.stringify(salida, null, 1);
if (process.argv[2]) writeFileSync(process.argv[2], texto + "\n");
console.log(JSON.stringify({ inmediatas: salida.intercepcionesInmediatas, incumplimientos: salida.incumplimientos, saques: salida.incumplimientosSaques, goles: m.golesPorPartido, tiros: m.tirosPorPartido, conversionMaM: m.manoAMano.conversion, despl: m.manoAMano.desplazamientoMedianaM, fraccionDespl: m.manoAMano.fraccionDesplazado, centros: m.centros.porPartido, propCentros: m.centros.proporcion }));
