// Línea base consolidada del brief 046 (programados, N semillas de D s). Sin tocar el repo.
import { ARENA } from "/home/calusaca/cronista/src/sim/limites";
const M = await import(process.env.PROTO ? "./comun-proto.mts" : "./comun.mts"); const MotorArena = process.env.PROTO ? M.MotorArena : (await import("/home/calusaca/cronista/src/arena/motor")).MotorArena;
import { distancia } from "/home/calusaca/cronista/src/arena/geometria";
const partido = M.partido as typeof import("./comun.mts").partido;
const N = Number(process.env.N ?? 30), D = Number(process.env.D ?? 120), R = 25;
const o = (p: { x: number; y: number }, lado: string) => lado === "local" ? p : { x: 105 - p.x, y: 68 - p.y };
const enBanda = (p: { x: number; y: number }) => p.x >= 70 && Math.abs(p.y - 34) > ARENA.areaAnchoM / 2;
const enArea = (p: { x: number; y: number }) => p.x >= 105 - ARENA.areaLargoM && Math.abs(p.y - 34) <= ARENA.areaAnchoM / 2;
// Laterales: orden pasar imposible y conducción frenada.
let seedAct = 0; const bloqueos = new Set<string>(); let ticksPasarImposible = 0, ticksConducir = 0, ticksConducirParado = 0;
const proto = MotorArena.prototype as any; const origAccion = proto.accionBalon;
proto.accionBalon = function (this: any, planes: any, ejecutadas: Set<string>) {
  const e = this.estado, j = e.jugadores.find((p: any) => p.id === e.balon.poseedor);
  if (j && j.puesto !== "POR") {
    const orden = planes[j.lado].ordenes.find((x: any) => x.jugador === j.id);
    const usar = !ejecutadas.has(j.id);
    if (usar && orden.accion === "pasar") { const r = e.jugadores.find((p: any) => p.id === orden.receptor); if (!r || distancia(j.posicion, r.posicion) > ARENA.paseMaxM) { ticksPasarImposible++; bloqueos.add(`${seedAct}:${j.id}:${Math.floor(e.tick / 150)}`); } }
    if (orden.accion === "conducir") { ticksConducir++; if (Math.hypot(j.velocidad.x, j.velocidad.y) < 1) ticksConducirParado++; }
  }
  return origAccion.call(this, planes, ejecutadas);
};
const golesPorPartido: number[] = [];
const g = { goles: 0, autogoles: 0, tiros: 0, atajadas: 0, desvios: 0, tiroFueraTrasDesvio: 0, recepcionDePortero: 0, pases: 0, recepciones: 0, faltas: 0, metas: 0, esquinas: 0, metasPorConduccion: 0, golesSinTiro: 0 };
const mam = { episodios: 0, goles: 0, acerc: [] as number[], mayor1: 0, mayor3: 0 };
const cen = { pasesBanda: 0, centros: 0, motivoCentro: 0, centroRecibido: 0, golTras5s: 0, saqueManos: 0, fueraJuego: 0 };
const robosDbg: string[] = [];
const por = { atajadasConBalon: 0, robosTrasAtajada: 0, robosEnManos: 0, golesTrasRobo: 0, tramosEnArea: 0 };
const S0 = Number(process.env.S0 ?? 0);
for (let seed = S0 + 1; seed <= S0 + N; seed++) {
  seedAct = seed;
  const { registro, ticks } = await partido(seed, D);
  const ev = registro.eventos; const porId = new Set<string>();
  for (const t of ticks) for (const j of t.jug) if (j.puesto === "POR") porId.add(j.id);
  const golesP = ev.filter(e => e.tipo === "gol").length; golesPorPartido.push(golesP);
  ev.forEach((e, i) => {
    if (e.tipo === "gol") { g.goles++; if (e.autogol) g.autogoles++; let k = i - 1; while (k >= 0 && ["plan_equipo", "cambio"].includes(ev[k]!.tipo)) k--; const p = ev[k]; if (p && p.tipo !== "tiro" && !(p.tipo === "atajada" && p.motivo === "desvio")) g.golesSinTiro++; }
    if (e.tipo === "tiro") g.tiros++;
    if (e.tipo === "atajada") { g.atajadas++; if (e.motivo === "desvio") { g.desvios++; const sig = ev.slice(i + 1).find(x => !["plan_equipo", "cambio"].includes(x.tipo)); if (sig?.tipo === "tiro_fuera") g.tiroFueraTrasDesvio++; } else por.atajadasConBalon++; }
    if (e.tipo === "recepcion" && e.receptor && porId.has(e.receptor)) { const prev = ev.slice(0, i).reverse().find(x => !["plan_equipo", "cambio"].includes(x.tipo)); if (prev?.tipo === "atajada" && prev.motivo === "desvio") g.recepcionDePortero++; }
    if (e.tipo === "pase" && !e.reinicio) { g.pases++; const d = o(e.desde, e.lado); if (enBanda(d)) { cen.pasesBanda++; if (enArea(o(e.hasta, e.lado))) cen.centros++; } }
    if (e.tipo === "recepcion") g.recepciones++;
    if (e.tipo === "fuera_juego") cen.fueraJuego++;
    if (e.tipo === "pase" && e.motivo === "saque_manos") cen.saqueManos++;
    if (e.tipo === "pase" && e.motivo === "centro") { cen.motivoCentro++; const sig = ev.slice(i + 1).find(x => ["recepcion", "intercepcion", "recuperacion", "reinicio", "fuera_juego"].includes(x.tipo)); if (sig?.tipo === "recepcion" && sig.lado === e.lado) cen.centroRecibido++; if (ev.some(x => x.tipo === "gol" && x.lado === e.lado && x.tick > e.tick && x.tick <= e.tick + 50)) cen.golTras5s++; }
    if (e.tipo === "falta") g.faltas++;
    if (e.tipo === "reinicio" && e.reinicio === "esquina") g.esquinas++;
    if (e.tipo === "reinicio" && e.reinicio === "meta") {
      g.metas++;
      const t = [...ticks].reverse().find(t => t.tick < e.tick || (t.tick === e.tick && false));
      const prev = ticks.find(t => t.tick === e.tick - 1) ?? t;
      if (prev?.poseedor && !porId.has(prev.poseedor) && prev.poseedor.split("-")[0] !== e.lado) g.metasPorConduccion++;
    }
  });
  // Robos al portero con balón dentro de su área.
  for (let i = 1; i < ticks.length; i++) {
    const a = ticks[i - 1]!, b = ticks[i]!;
    if (!a.poseedor || !porId.has(a.poseedor) || b.poseedor === a.poseedor || !b.poseedor) continue;
    const pj = a.jug.find(j => j.id === a.poseedor)!; const po = o(pj, pj.lado);
    const dentro = po.x <= ARENA.areaLargoM && Math.abs(po.y - 34) <= ARENA.areaAnchoM / 2;
    if (b.poseedor.split("-")[0] === pj.lado || !dentro) continue;
    por.robosEnManos++; robosDbg.push(`seed=${seed} tick=${b.tick} por=${a.poseedor} -> ${b.poseedor} en (${po.x.toFixed(1)},${po.y.toFixed(1)})`);
    const abre = [...ev].reverse().find(e => e.tick <= a.tick && e.jugador === a.poseedor && ["atajada", "recepcion", "recuperacion", "intercepcion", "reinicio"].includes(e.tipo));
    if (abre?.tipo === "atajada") por.robosTrasAtajada++;
    const ladron = b.poseedor.split("-")[0];
    const gol = ev.find(e => e.tick >= b.tick && e.tipo === "gol" && e.lado === ladron && !ev.some(x => x.tick >= b.tick && x.tick < e.tick && x.lado !== ladron && ["recepcion", "recuperacion", "intercepcion", "atajada", "reinicio"].includes(x.tipo)));
    if (gol) por.golesTrasRobo++;
  }
  // Mano a mano (criterio A del script de error 1).
  let act: { atac: string; por: string; idx: number[] } | null = null;
  const cerrar = () => {
    if (!act || act.idx.length < 3) { act = null; return; }
    const ts = act.idx.map(i => ticks[i]!); const lado = act.atac.split("-")[0]!;
    const pj = (t: typeof ts[number]) => o(t.jug.find(j => j.id === act!.por)!, lado);
    const b0 = o({ x: ts[0]!.bx, y: ts[0]!.by }, lado), k0 = pj(ts[0]!), k1 = pj(ts.at(-1)!);
    const d0 = Math.hypot(k0.x - b0.x, k0.y - b0.y), ux = (b0.x - k0.x) / d0, uy = (b0.y - k0.y) / d0;
    const acerc = (k1.x - k0.x) * ux + (k1.y - k0.y) * uy;
    mam.episodios++; mam.acerc.push(acerc); if (acerc > 1) mam.mayor1++; if (acerc > 3) mam.mayor3++;
    const t1 = ts.at(-1)!.tick;
    const fin = ev.find(e => e.tick >= t1 && e.tick <= t1 + 30 && ["tiro", "pase", "recuperacion", "intercepcion", "falta", "fuera_juego", "reinicio", "gol"].includes(e.tipo));
    if (fin?.tipo === "gol") mam.goles++;
    if (fin?.tipo === "tiro") { const r = ev.find(e => e.tick >= fin.tick && e.id !== fin.id && ["gol", "atajada", "tiro_fuera", "intercepcion", "reinicio", "recepcion", "recuperacion"].includes(e.tipo)); if (r?.tipo === "gol") mam.goles++; }
    act = null;
  };
  ticks.forEach((t, i) => {
    const p = t.jug.find(j => j.id === t.poseedor); let ok = false, porR = "";
    if (p && p.puesto !== "POR" && !t.pausa) {
      const pp = o(p, p.lado);
      if (Math.hypot(pp.x - 105, pp.y - 34) <= R) { const rivales = t.jug.filter(j => j.lado !== p.lado); porR = rivales.find(j => j.puesto === "POR")?.id ?? ""; ok = !!porR && rivales.filter(j => j.puesto !== "POR").every(c => o(c, p.lado).x <= pp.x); }
    }
    if (ok && act && act.atac === p!.id && act.idx.at(-1) === i - 1) act.idx.push(i); else { cerrar(); if (ok) act = { atac: p!.id, por: porR, idx: [i] }; }
  });
  cerrar();
}
const q = (a: number[], f: number) => a.length ? +[...a].sort((x, y) => x - y)[Math.floor((a.length - 1) * f)]!.toFixed(2) : NaN;
const media = golesPorPartido.reduce((s, x) => s + x, 0) / N, sd = Math.sqrt(golesPorPartido.reduce((s, x) => s + (x - media) ** 2, 0) / N);
console.log(JSON.stringify({ semillas: N, duracionS: D,
  global: { ...g, golesPorPartido: +media.toFixed(2), sdGoles: +sd.toFixed(2), tirosPorPartido: +(g.tiros / N).toFixed(2), pasesCompletados: +(g.recepciones / g.pases).toFixed(3), metasPorPartido: +(g.metas / N).toFixed(2), metasPorConduccionPorPartido: +(g.metasPorConduccion / N).toFixed(2), esquinasPorPartido: +(g.esquinas / N).toFixed(2), faltasPorPartido: +(g.faltas / N).toFixed(2) },
  manoAMano: { episodios: mam.episodios, golesEnEpisodio: mam.goles, conversion: +(mam.goles / mam.episodios).toFixed(3), fraccionDeGoles: +(mam.goles / g.goles).toFixed(3), acercMediana: q(mam.acerc, 0.5), acercP75: q(mam.acerc, 0.75), fraccionMayor1m: +(mam.mayor1 / mam.episodios).toFixed(3), fraccionMayor3m: +(mam.mayor3 / mam.episodios).toFixed(3) },
  centros: { ...cen, proporcion: +(cen.centros / cen.pasesBanda).toFixed(3) },
  portero: { ...por, robosDbg: robosDbg.slice(0, 5) },
  laterales: { ticksPasarImposible, rondasJugadorBloqueadas: bloqueos.size, ticksConducir, ticksConducirParado, fraccionConducirParado: +(ticksConducirParado / ticksConducir).toFixed(3) } }, null, 1));
