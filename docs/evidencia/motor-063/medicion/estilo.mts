const R = process.env.RAIZ!;
const { ARENA } = await import(`${R}/sim/limites.ts`);
const { MotorArena, crearConfigArena } = await import(`${R}/arena/motor.ts`);
const { ejecutarArena } = await import(`${R}/arena/coordinador.ts`);
const { crearControladorProgramado } = await import(`${R}/arena/controladores.ts`);
const { transformar } = await import(`${R}/arena/catalogo.ts`);
const r = { P: 0, gf: 0, gc: 0, xSin: 0, nSin: 0, largos: 0, lejanos: 0, persTicks: 0, persN: 0, tiros: 0 };
const proto = MotorArena.prototype as any, original = proto.planesActivos;
for (let seed = 1; seed <= 200; seed++) {
  proto.planesActivos = function (p: any) { const a = original.call(this, p); const e = this.estado; const pos = e.jugadores.find((j: any) => j.id === e.balon.poseedor);
    if (pos && pos.lado === "visita" && !(e.pausa && e.tick < e.pausa.hastaTick)) for (const j of e.jugadores) if (j.lado === "local" && j.puesto !== "POR") { r.xSin += transformar(j.posicion, "local").x; r.nSin++; }
    if (e.persecucion && e.persecucion.lado === "local" && e.tick < e.persecucion.hastaTick) r.persTicks++;
    return a; };
  const reg = await ejecutarArena(crearConfigArena({ seed, duracionS: 120 }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
  proto.planesActivos = original; r.P++;
  for (const e of reg.eventos) { if (e.tipo === "gol") e.lado === "local" ? r.gf++ : r.gc++; if (e.lado === "local" && e.tipo === "pase" && e.motivo === "largo") r.largos++; if (e.lado === "local" && e.tipo === "tiro") { r.tiros++; if (e.motivo === "lejano") r.lejanos++; } }
}
console.log(JSON.stringify({ estilo: process.env.FORZAR_ESTILO, golesFavor: r.gf / r.P, golesContra: r.gc / r.P, xMediaSinBalon: r.xSin / r.nSin, largos: r.largos / r.P, tiros: r.tiros / r.P, lejanos: r.lejanos / r.P, segundosPersecucion: r.persTicks * ARENA.pasoS / r.P }));
