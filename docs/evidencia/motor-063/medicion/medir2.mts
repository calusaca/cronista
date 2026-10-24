// Métricas de comportamiento visibles (brief 063): repliegue, persecución, atributos. Línea base o prototipo (RAIZ).
const R = process.env.RAIZ ?? "/home/calusaca/cronista/src";
const { ARENA } = await import(`${R}/sim/limites.ts`);
const { MotorArena, crearConfigArena } = await import(`${R}/arena/motor.ts`);
const { ejecutarArena } = await import(`${R}/arena/coordinador.ts`);
const { crearControladorProgramado } = await import(`${R}/arena/controladores.ts`);
const { transformar } = await import(`${R}/arena/catalogo.ts`);
const desde = Number(process.argv[2] ?? 1), n = Number(process.argv[3] ?? 30);
const linea = (p: string) => p === "POR" ? "POR" : p.startsWith("DFC") || p === "LI" || p === "LD" || p.startsWith("CAR") ? "DEF" : p.startsWith("DC") || p === "EI" || p === "ED" ? "DEL" : "MED";
const t = { repMuestras: 0, repCorren: 0, perMuestras: 0, perPersigue: 0, perDelMuestras: 0, delPasaMedio: 0,
  vmax: [] as { v: number; a: number }[], posesion: {} as Record<string, number>, robos: {} as Record<string, number>, aguante: {} as Record<string, number> };
const proto = MotorArena.prototype as any, original = proto.planesActivos;
for (let seed = desde; seed < desde + n; seed++) {
  const muestras: any[] = [];
  proto.planesActivos = function (planes: any) { const a = original.call(this, planes); const e = this.estado;
    muestras.push({ tick: e.tick, poseedor: e.balon.poseedor, vuelo: !!e.balon.vuelo, manos: !!e.balon.manos, pausa: !!(e.pausa && e.tick < e.pausa.hastaTick) || !!e.saque, balon: { ...e.balon.posicion },
      jug: e.jugadores.map((j: any) => ({ id: j.id, lado: j.lado, puesto: j.puesto, x: j.posicion.x, y: j.posicion.y, vx: j.velocidad.x, vy: j.velocidad.y })) }); return a; };
  const reg = await ejecutarArena(crearConfigArena({ seed, duracionS: 120 }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
  proto.planesActivos = original;
  const at = new Map([...reg.inicial.jugadores, ...(reg.inicial.banco ?? [])].map((j: any) => [j.id, j.atributos]));
  const vmax = new Map<string, number>();
  let inicioSup = -1;
  for (let i = 0; i < muestras.length; i++) {
    const m = muestras[i];
    for (const j of m.jug) vmax.set(j.id, Math.max(vmax.get(j.id) ?? 0, Math.hypot(j.vx, j.vy)));
    const p = m.jug.find((j: any) => j.id === m.poseedor);
    let sup = false;
    if (p && p.puesto !== "POR" && !m.manos && !m.pausa) {
      const px = transformar({ x: p.x, y: p.y }, p.lado).x;
      const defs = m.jug.filter((j: any) => j.lado !== p.lado && j.puesto !== "POR");
      sup = px > Math.max(...defs.map((j: any) => transformar({ x: j.x, y: j.y }, p.lado).x));
      if (sup && inicioSup < 0) inicioSup = m.tick;
      if (sup && (m.tick - inicioSup) * ARENA.pasoS >= 1) for (const d of defs) {
        if (!["DEF", "MED"].includes(linea(d.puesto)) || Math.hypot(d.x - p.x, d.y - p.y) > 30) continue;
        t.repMuestras++;
        const haciaArco = -transformar({ x: d.vx, y: d.vy }, d.lado === "local" ? "local" : "visita").x; // componente hacia su propio arco
        const vxPropio = d.lado === "local" ? -d.vx : d.vx; // local defiende x=0
        if (vxPropio >= 3) t.repCorren++;
      }
      t.posesion[p.id] = (t.posesion[p.id] ?? 0) + 1;
    }
    if (!sup) inicioSup = -1;
    // robo en duelo: poseedor de campo cambia a rival en muestras consecutivas sin vuelo
    const ant = muestras[i - 1];
    if (ant && ant.poseedor && m.poseedor && ant.poseedor !== m.poseedor && !ant.vuelo) {
      const a = ant.jug.find((j: any) => j.id === ant.poseedor), b = m.jug.find((j: any) => j.id === m.poseedor);
      if (a && b && a.lado !== b.lado && a.puesto !== "POR") {
        t.robos[a.id] = (t.robos[a.id] ?? 0) + 1;
        // persecución del perdedor en los 2 s siguientes
        for (const s of muestras.slice(i + 10, i + 40)) {
          if (s.pausa) break; const z = s.jug.find((j: any) => j.id === a.id); if (!z) break;
          const pose = s.jug.find((j: any) => j.id === s.poseedor); if (pose && pose.lado === a.lado) break;
          const dx = s.balon.x - z.x, dy = s.balon.y - z.y, dd = Math.hypot(dx, dy), v = Math.hypot(z.vx, z.vy);
          t.perMuestras++; if (v >= 3 && dd > 0 && (z.vx * dx + z.vy * dy) / (v * dd) >= 0.7) t.perPersigue++;
          if (linea(z.puesto) === "DEL") { t.perDelMuestras++; if (transformar({ x: z.x, y: z.y }, z.lado).x < ARENA.largoM / 2 - 1) t.delPasaMedio++; }
        }
      }
    }
  }
  for (const [id, v] of vmax) { const a = at.get(id); if (a && id.length) t.vmax.push({ v, a: a.velocidad }); }
  for (const id of Object.keys(t.posesion)) if (at.get(id)) t.aguante[id] = at.get(id).aguante;
}
const grupo = (f: (a: number) => boolean) => { const ids = Object.keys(t.posesion).filter(id => t.aguante[id] !== undefined && f(t.aguante[id])); const pos = ids.reduce((s, id) => s + t.posesion[id], 0) * ARENA.pasoS; const r = ids.reduce((s, id) => s + (t.robos[id] ?? 0), 0); return { robosPorMinutoDePosesion: pos ? r / pos * 60 : null, minutos: pos / 60 }; };
const vel = (f: (a: number) => boolean) => { const xs = t.vmax.filter(x => f(x.a)).map(x => x.v); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; };
console.log(JSON.stringify({ semillas: [desde, desde + n - 1],
  repliegue: { muestras: t.repMuestras, fraccionCorrenHaciaSuArco3mps: t.repCorren / t.repMuestras },
  persecucion: { muestras: t.perMuestras, fraccionPersigue: t.perPersigue / t.perMuestras, delanterosTrasMedio: t.delPasaMedio, muestrasDelantero: t.perDelMuestras },
  atributos: t.vmax.length ? { vmaxVelocidadAlta70: vel(a => a >= 70), vmaxVelocidadBaja35: vel(a => a <= 35), robosAguanteAlto65: grupo(a => a >= 65), robosAguanteBajo40: grupo(a => a <= 40) } : null }, null, 1));
