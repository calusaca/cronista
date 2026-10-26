// Medición de goles por versión de reglas (solo lectura del repo; overrides en tiempo de ejecución).
// uso: node --import tsx medir.mts <reglas> <duracionS> <desde> <n> [overridesJSON] [etiqueta]
import * as L from "/home/calusaca/cronista/src/sim/limites.ts";
import { crearConfigArena, MotorArena } from "/home/calusaca/cronista/src/arena/motor.ts";
import { ejecutarArena } from "/home/calusaca/cronista/src/arena/coordinador.ts";
import { crearControladorProgramado } from "/home/calusaca/cronista/src/arena/controladores.ts";
import { cierreDeRemate } from "/home/calusaca/cronista/src/arena/metricas-lote.ts";
import { transformar } from "/home/calusaca/cronista/src/arena/catalogo.ts";

const [reglas, durS, desdeS, nS, ovS, etiqueta] = process.argv.slice(2);
const dur = Number(durS), desde = Number(desdeS), n = Number(nS);
const ov: Record<string, unknown> = ovS ? JSON.parse(ovS) : {};
for (const [ruta, valor] of Object.entries(ov)) {
  const partes = ruta.split("."); let o: any = (L as any)[partes.shift()!];
  while (partes.length > 1) o = o[partes.shift()!];
  o[partes[0]!] = valor;
}
const A = L.ARENA, GOAL = { x: A.largoM, y: A.anchoM / 2 };
type S = { tick: number; poseedor: string | null; lado: string | null; d: number | null; manos: boolean; saque: boolean };
const proto = MotorArena.prototype as any; const orig = proto.planesActivos;
let muestras: S[] = [];
proto.planesActivos = function (planes: any) {
  const r = orig.call(this, planes); const e = this.estado;
  const p = e.jugadores.find((j: any) => j.id === e.balon.poseedor);
  let d: number | null = null;
  if (p && p.puesto !== "POR") { const o = transformar(p.posicion, p.lado); d = Math.hypot(o.x - GOAL.x, o.y - GOAL.y); }
  muestras.push({ tick: e.tick, poseedor: p?.id ?? null, lado: p?.lado ?? null, d, manos: !!e.balon.manos, saque: !!e.saque });
  return r;
};
const agg: any = { partidos: 0, goles: 0, golesLista: [] as number[], tiros: 0, lejanos: 0, golesLejanos: 0, desenlaces: {} as Record<string, number>,
  posesiones: 0, llegadas33: 0, llegadas25: 0, llegadas25Remate: 0, finLlegadaSinRemate: {} as Record<string, number>,
  robosDuelo: 0, robosDueloUltimoTercio: 0, intercepciones: 0, largos: 0, centros: 0, ticksZona25: 0, ticksPosesion: 0 };
const inc = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };
for (let seed = desde; seed < desde + n; seed++) {
  muestras = [];
  const config = crearConfigArena({ seed, duracionS: dur, reglas: reglas as any });
  const reg = await ejecutarArena(config, { local: crearControladorProgramado(), visita: crearControladorProgramado() });
  const ev = reg.eventos;
  const g = ev.filter(e => e.tipo === "gol").length; agg.goles += g; agg.golesLista.push(g); agg.partidos++;
  ev.forEach((e, i) => {
    if (e.tipo === "tiro") { agg.tiros++; const c = cierreDeRemate(ev, i); inc(agg.desenlaces, c.desenlace); if (e.motivo === "lejano") { agg.lejanos++; if (c.desenlace === "gol") agg.golesLejanos++; } }
    if (e.tipo === "intercepcion") agg.intercepciones++;
    if (e.tipo === "pase" && e.motivo === "largo") agg.largos++;
    if (e.tipo === "pase" && e.motivo === "centro") agg.centros++;
  });
  // Posesiones a partir de las muestras: dueño = último lado con poseedor (se arrastra en vuelos).
  const pid = new Map(reg.final.jugadores.map(j => [j.id, j.lado]));
  let dueno: string | null = null, minD = Infinity, ini = 0, prev: S | null = null;
  const cerrar = (finTick: number) => {
    if (dueno === null) return;
    agg.posesiones++;
    if (minD <= 33) agg.llegadas33++;
    if (minD <= A.radioTiroM) {
      agg.llegadas25++;
      const tiro = ev.some(e => e.tipo === "tiro" && e.lado === dueno && e.tick >= ini && e.tick <= finTick);
      if (tiro) agg.llegadas25Remate++;
      else {
        // causa: primer evento no neutro en [finTick-1, finTick+1] que cambia la posesión
        const fin = ev.find(e => e.tick >= finTick - 1 && e.tick <= finTick + 1 && ["recuperacion", "intercepcion", "reinicio", "falta", "fuera_juego", "atajada", "gol"].includes(e.tipo));
        inc(agg.finLlegadaSinRemate, fin ? fin.tipo + (fin.tipo === "reinicio" ? ":" + (fin as any).reinicio : "") : "fin_partido/otro");
      }
    }
  };
  for (const s of muestras) {
    if (s.lado && s.lado !== dueno) {
      if (dueno !== null && prev && prev.poseedor && pid.get(prev.poseedor) === dueno && !prev.manos) {
        // robo en duelo: el balón pasa de un poseedor a un rival en ticks consecutivos
        agg.robosDuelo++; if (prev.d !== null && prev.d <= 35) agg.robosDueloUltimoTercio++;
      }
      cerrar(s.tick); dueno = s.lado; minD = Infinity; ini = s.tick;
    }
    if (s.saque && dueno !== null) { /* un saque no cambia el dueño por sí mismo; el poseedor lo hará */ }
    if (s.lado && s.lado === dueno && s.d !== null) { minD = Math.min(minD, s.d); if (s.d <= A.radioTiroM) agg.ticksZona25++; }
    if (s.lado) agg.ticksPosesion++;
    prev = s;
  }
  cerrar(reg.final.tick);
}
proto.planesActivos = orig;
const p = agg.partidos, gl = agg.golesLista as number[];
const media = agg.goles / p;
const r = (x: number, k = 3) => Math.round(x * 10 ** k) / 10 ** k;
const out = {
  etiqueta: etiqueta ?? "", reglas, dur, semillas: `${desde}-${desde + n - 1}`, ov,
  golesPP: r(media), sdGoles: r(Math.sqrt(gl.reduce((s, x) => s + (x - media) ** 2, 0) / p)), seGoles: r(Math.sqrt(gl.reduce((s, x) => s + (x - media) ** 2, 0) / p) / Math.sqrt(p)),
  pct0goles: r(gl.filter(x => x === 0).length / p), tirosPP: r(agg.tiros / p), conversion: r(agg.goles / agg.tiros),
  aPuerta: r(((agg.desenlaces.gol ?? 0) + (agg.desenlaces.atrapada ?? 0) + (agg.desenlaces.desvio ?? 0)) / agg.tiros),
  desenlacesPP: Object.fromEntries(Object.entries(agg.desenlaces as Record<string, number>).map(([k, v]) => [k, r(v / p, 2)])),
  lejanosPP: r(agg.lejanos / p), golesLejanosPP: r(agg.golesLejanos / p), golesNoLejanosPP: r((agg.goles - agg.golesLejanos) / p),
  tirosNoLejanosPP: r((agg.tiros - agg.lejanos) / p),
  posesionesPP: r(agg.posesiones / p, 1), llegadas33PP: r(agg.llegadas33 / p, 2), llegadas25PP: r(agg.llegadas25 / p, 2), fraccLlegada25ConRemate: r(agg.llegadas25Remate / agg.llegadas25),
  finLlegada25SinRematePP: Object.fromEntries(Object.entries(agg.finLlegadaSinRemate as Record<string, number>).map(([k, v]) => [k, r(v / p, 2)])),
  robosDueloPP: r(agg.robosDuelo / p, 2), robosDueloUltTercioPP: r(agg.robosDueloUltimoTercio / p, 2), intercepcionesPP: r(agg.intercepciones / p, 2),
  largosPP: r(agg.largos / p, 2), centrosPP: r(agg.centros / p, 2), segZona25PP: r(agg.ticksZona25 * A.pasoS / p, 1),
};
console.log(JSON.stringify(out));
