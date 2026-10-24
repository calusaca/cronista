// Experimento controlado de atributos (solo local, jugadores de campo): bajo frente a alto.
const R = process.env.RAIZ!;
const { ARENA } = await import(`${R}/sim/limites.ts`);
const { MotorArena, crearConfigArena } = await import(`${R}/arena/motor.ts`);
const { ejecutarArena } = await import(`${R}/arena/coordinador.ts`);
const { crearControladorProgramado } = await import(`${R}/arena/controladores.ts`);
const desde = Number(process.argv[2] ?? 1), n = Number(process.argv[3] ?? 100);
const r = { partidos: 0, golesL: 0, golesV: 0, vmax: 0, nv: 0, energia: 0, robosSufridosL: 0, robosHechosL: 0, posL: 0, largosL: 0, lejanosL: 0, aereosL: 0, aereosOkL: 0, tirosL: 0 };
const proto = MotorArena.prototype as any, original = proto.planesActivos;
for (let seed = desde; seed < desde + n; seed++) {
  const m: any[] = [];
  proto.planesActivos = function (p: any) { const a = original.call(this, p); const e = this.estado; m.push({ pos: e.balon.poseedor, vuelo: !!e.balon.vuelo, jug: e.jugadores.map((j: any) => ({ id: j.id, lado: j.lado, por: j.puesto === "POR", v: Math.hypot(j.velocidad.x, j.velocidad.y) })) }); return a; };
  const reg = await ejecutarArena(crearConfigArena({ seed, duracionS: 120 }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
  proto.planesActivos = original; r.partidos++;
  const vmax = new Map<string, number>();
  for (let i = 0; i < m.length; i++) {
    for (const j of m[i].jug) if (j.lado === "local" && !j.por) vmax.set(j.id, Math.max(vmax.get(j.id) ?? 0, j.v));
    const p = m[i].jug.find((j: any) => j.id === m[i].pos); if (p && p.lado === "local" && !p.por) r.posL++;
    const a = m[i - 1]; if (a && a.pos && m[i].pos && a.pos !== m[i].pos && !a.vuelo) { const x = a.jug.find((j: any) => j.id === a.pos), y = m[i].jug.find((j: any) => j.id === m[i].pos); if (x && y && x.lado !== y.lado && !x.por) { if (x.lado === "local") r.robosSufridosL++; else r.robosHechosL++; } }
  }
  for (const v of vmax.values()) { r.vmax += v; r.nv++; }
  const fin = reg.final.jugadores.filter((j: any) => j.lado === "local" && j.puesto !== "POR"); r.energia += fin.reduce((s: number, j: any) => s + j.energia, 0) / fin.length;
  const ev = reg.eventos;
  ev.forEach((e: any, i: number) => {
    if (e.tipo === "gol") { if (e.lado === "local") r.golesL++; else r.golesV++; }
    if (e.lado !== "local") return;
    if (e.tipo === "tiro") r.tirosL++;
    if (e.tipo === "pase" && e.motivo === "largo") r.largosL++;
    if (e.tipo === "tiro" && e.motivo === "lejano") r.lejanosL++;
    if (e.tipo === "pase" && (e.motivo === "centro" || e.motivo === "largo")) { r.aereosL++; const t = ev.slice(i + 1).find((x: any) => ["recepcion", "intercepcion", "recuperacion", "reinicio", "atajada", "fuera_juego"].includes(x.tipo)); if (t && t.tipo === "recepcion" && t.lado === "local") r.aereosOkL++; }
  });
}
const P = r.partidos;
console.log(JSON.stringify({ forzar: process.env.FORZAR ?? null, golesLocal: r.golesL / P, golesVisita: r.golesV / P, tirosLocal: r.tirosL / P, vmaxMedia: r.vmax / r.nv, energiaFinal: r.energia / P,
  robosSufridosPorMin: r.robosSufridosL / (r.posL * ARENA.pasoS) * 60, robosHechosPorPartido: r.robosHechosL / P, largosPorPartido: r.largosL / P, lejanosPorPartido: r.lejanosL / P, aereosExito: r.aereosOkL / r.aereosL, aereos: r.aereosL }));
