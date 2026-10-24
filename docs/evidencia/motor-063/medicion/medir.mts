// Medición de línea base para el brief 063 (no es código del repo). Programados, 120 s, v5 por defecto.
// node --import tsx medir.mts <desde> <semillas> [reglas]
const R = process.env.RAIZ ?? "/home/calusaca/cronista/src";
const { ARENA } = await import(`${R}/sim/limites.ts`);
const { MotorArena, crearConfigArena } = await import(`${R}/arena/motor.ts`);
const { ejecutarArena } = await import(`${R}/arena/coordinador.ts`);
const { crearControladorProgramado } = await import(`${R}/arena/controladores.ts`);
const { transformar } = await import(`${R}/arena/catalogo.ts`);
const { distancia, proyeccion } = await import(`${R}/arena/geometria.ts`);

const desde = Number(process.argv[2] ?? 1), n = Number(process.argv[3] ?? 30), reglas = process.argv[4];
const linea = (p: string) => p === "POR" ? "POR" : p.startsWith("DFC") || p === "LI" || p === "LD" || p.startsWith("CAR") ? "DEF" : p.startsWith("DC") || p === "EI" || p === "ED" ? "DEL" : "MED";
const q = (xs: number[], f: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(f * s.length))] : null; };
const media = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

const tot = { partidos: 0, goles: 0, tiros: 0, ticksSuperado: 0, episodiosSuperado: 0, durSuperado: [] as number[], golesEnSuperado: 0, tirosEnSuperado: 0,
  velDefSuperado: [] as number[], velPoseedorSuperado: [] as number[], defQuietosSuperado: 0, defMuestrasSuperado: 0,
  perdidas: 0, perdidasPorLinea: { DEF: 0, MED: 0, DEL: 0, POR: 0 } as Record<string, number>, perdedorAcerca: 0, perdedorMuestras: 0, velPerdedor: [] as number[],
  pases: [] as number[], largos: 0, largosOk: 0, lejanos: 0, lejanosGol: 0, lejanosAPuerta: 0, paseLargo25: 0, tirosDist: [] as number[], espacioLejano: 0, sinPaseConLargo: 0, sinPase: 0, muestrasPoseedor: 0 };

const proto = MotorArena.prototype as any;
const original = proto.planesActivos;
for (let seed = desde; seed < desde + n; seed++) {
  const muestras: any[] = [];
  proto.planesActivos = function (planes: any) {
    const a = original.call(this, planes);
    const e = this.estado;
    muestras.push({ tick: e.tick, eventos: this.eventos.length, poseedor: e.balon.poseedor, manos: !!e.balon.manos, pausa: !!(e.pausa && e.tick < e.pausa.hastaTick) || !!e.saque,
      balon: { ...e.balon.posicion }, jug: e.jugadores.map((j: any) => ({ id: j.id, lado: j.lado, puesto: j.puesto, x: j.posicion.x, y: j.posicion.y, vx: j.velocidad.x, vy: j.velocidad.y })) });
    return a;
  };
  const cfg = crearConfigArena({ seed, duracionS: 120, ...(reglas ? { reglas } : {}) });
  const reg = await ejecutarArena(cfg, { local: crearControladorProgramado(), visita: crearControladorProgramado() });
  proto.planesActivos = original;
  tot.partidos++;
  const ev = reg.eventos;
  tot.goles += ev.filter((e: any) => e.tipo === "gol").length; tot.tiros += ev.filter((e: any) => e.tipo === "tiro").length;
  ev.forEach((e: any, i: number) => {
    if (e.tipo === "pase" && e.motivo === "largo") { tot.largos++; const t = ev.slice(i + 1).find((x: any) => ["recepcion", "intercepcion", "recuperacion", "reinicio", "fuera_juego", "atajada"].includes(x.tipo)); if (t && t.tipo === "recepcion" && t.lado === e.lado) tot.largosOk++; }
    if (e.tipo === "tiro" && e.motivo === "lejano") { tot.lejanos++; const t = ev.slice(i + 1).find((x: any) => ["gol", "atajada", "tiro_fuera", "intercepcion", "recepcion", "recuperacion", "reinicio"].includes(x.tipo)); if (t && t.tipo === "gol") tot.lejanosGol++; if (t && (t.tipo === "gol" || t.tipo === "atajada")) tot.lejanosAPuerta++; }
  });
  for (const e of ev) {
    if (e.tipo === "pase" && !e.motivo && !e.reinicio) { tot.pases.push(e.distanciaM); if (e.distanciaM >= 25) tot.paseLargo25++; }
    if (e.tipo === "tiro") tot.tirosDist.push(distancia(e.desde, transformar({ x: ARENA.largoM, y: ARENA.anchoM / 2 }, e.lado)));
  }
  // Superado: poseedor de campo más allá del último defensor de campo rival.
  let enEp = false, inicio = 0, epTick0 = 0;
  const cerrar = (t: number) => {
    if (!enEp) return; enEp = false; tot.episodiosSuperado++; tot.durSuperado.push((t - inicio) * ARENA.pasoS);
    const posteriores = ev.filter((e: any) => e.tick >= inicio && e.tick <= t + 10);
    if (posteriores.some((e: any) => e.tipo === "tiro")) tot.tirosEnSuperado++;
    if (posteriores.some((e: any) => e.tipo === "gol")) tot.golesEnSuperado++;
  };
  let poseAnt: any = null;
  for (let i = 0; i < muestras.length; i++) {
    const m = muestras[i];
    const p = m.jug.find((j: any) => j.id === m.poseedor);
    let superado = false;
    if (p && p.puesto !== "POR" && !m.manos && !m.pausa) {
      const px = transformar({ x: p.x, y: p.y }, p.lado).x;
      const defs = m.jug.filter((j: any) => j.lado !== p.lado && j.puesto !== "POR");
      const ultimo = Math.max(...defs.map((j: any) => transformar({ x: j.x, y: j.y }, p.lado).x));
      superado = px > ultimo;
      if (superado) {
        tot.ticksSuperado++;
        tot.velPoseedorSuperado.push(Math.hypot(p.vx, p.vy));
        for (const d of defs.filter((j: any) => linea(j.puesto) === "DEF")) { const v = Math.hypot(d.vx, d.vy); tot.velDefSuperado.push(v); tot.defMuestrasSuperado++; if (v < 2) tot.defQuietosSuperado++; }
      }
      // muestras de poseedor (cada 10 ticks) para oportunidades
      if (m.tick % 10 === 0) {
        tot.muestrasPoseedor++;
        const o = transformar({ x: p.x, y: p.y }, p.lado);
        const darco = Math.hypot(ARENA.largoM - o.x, ARENA.anchoM / 2 - o.y);
        const rivales = m.jug.filter((j: any) => j.lado !== p.lado);
        const libre = Math.min(...rivales.map((r: any) => Math.hypot(r.x - p.x, r.y - p.y)));
        if (darco > 25 && darco <= 33 && Math.abs(o.y - ARENA.anchoM / 2) < 20 && libre > 5) tot.espacioLejano++;
        const cand = (max: number) => m.jug.filter((c: any) => c.lado === p.lado && c.id !== p.id).filter((c: any) => {
          const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < ARENA.paseMinM || d > max) return false;
          const av = transformar({ x: c.x, y: c.y }, p.lado).x - o.x; if (av < (max > 32 ? 10 : ARENA.avanceMinPaseM)) return false;
          const margen = Math.min(...rivales.map((r: any) => proyeccion({ x: r.x, y: r.y }, { x: p.x, y: p.y }, { x: c.x, y: c.y }).distancia));
          return margen > ARENA.controlM * ARENA.margenPase;
        });
        const corto = cand(ARENA.paseMaxM).length;
        if (!corto) { tot.sinPase++; if (cand(50).length) tot.sinPaseConLargo++; }
      }
    }
    if (superado && !enEp) { enEp = true; inicio = m.tick; }
    if (!superado) cerrar(m.tick);
    // Pérdidas: cambio de lado del poseedor entre muestras con poseedor.
    if (p) {
      if (poseAnt && poseAnt.lado !== p.lado && !m.pausa) {
        const perdedor = poseAnt;
        tot.perdidas++; tot.perdidasPorLinea[linea(perdedor.puesto)]++;
        // ¿se acerca al balón en 2 s?
        const j = muestras.slice(i, i + 20);
        if (j.length === 20) {
          const a0 = j[0].jug.find((x: any) => x.id === perdedor.id), a1 = j[19].jug.find((x: any) => x.id === perdedor.id);
          if (a0 && a1) {
            tot.perdedorMuestras++;
            if (Math.hypot(a1.x - j[19].balon.x, a1.y - j[19].balon.y) < Math.hypot(a0.x - j[0].balon.x, a0.y - j[0].balon.y) - 1) tot.perdedorAcerca++;
            tot.velPerdedor.push(media(j.map((s: any) => { const z = s.jug.find((x: any) => x.id === perdedor.id); return z ? Math.hypot(z.vx, z.vy) : 0; }))!);
          }
        }
      }
      poseAnt = p;
    }
  }
  cerrar(muestras.at(-1).tick);
}
const P = tot.partidos;
console.log(JSON.stringify({
  reglas: reglas ?? ARENA.reglas, semillas: { desde, hasta: desde + n - 1 }, duracionS: 120,
  golesPorPartido: tot.goles / P, tirosPorPartido: tot.tiros / P,
  superado: { episodiosPorPartido: tot.episodiosSuperado / P, segundosPorPartido: tot.ticksSuperado * ARENA.pasoS / P, duracionMediana: q(tot.durSuperado, 0.5), duracionP90: q(tot.durSuperado, 0.9),
    fraccionConTiro: tot.tirosEnSuperado / tot.episodiosSuperado, fraccionConGol: tot.golesEnSuperado / tot.episodiosSuperado, golesEnSuperadoSobreGoles: tot.golesEnSuperado / tot.goles,
    velocidadMediaDefensas: media(tot.velDefSuperado), fraccionDefensasBajo2mps: tot.defQuietosSuperado / tot.defMuestrasSuperado, velocidadMediaPoseedor: media(tot.velPoseedorSuperado) },
  perdidas: { porPartido: tot.perdidas / P, porLinea: tot.perdidasPorLinea, perdedorSeAcerca2s: tot.perdedorAcerca / tot.perdedorMuestras, velocidadMediaPerdedor2s: media(tot.velPerdedor) },
  largos: { porPartido: tot.largos / P, fraccionDePases: tot.largos / tot.pases.length, exito: tot.largosOk / tot.largos },
  lejanos: { porPartido: tot.lejanos / P, fraccionDeTiros: tot.lejanos / tot.tiros, conversion: tot.lejanosGol / tot.lejanos, aPuerta: tot.lejanosAPuerta / tot.lejanos },
  pases: { porPartido: tot.pases.length / P, mediana: q(tot.pases, 0.5), p90: q(tot.pases, 0.9), max: Math.max(...tot.pases), fraccion25: tot.paseLargo25 / tot.pases.length },
  tiros: { distanciaMediana: q(tot.tirosDist, 0.5), p90: q(tot.tirosDist, 0.9), max: Math.max(...tot.tirosDist), fraccion20: tot.tirosDist.filter(d => d >= 20).length / tot.tirosDist.length, fraccion25: tot.tirosDist.filter(d => d > 25).length / tot.tirosDist.length },
  oportunidades: { muestrasPoseedorPorPartido: tot.muestrasPoseedor / P, espacioLejano25a33PorPartido: tot.espacioLejano / P, sinPaseCortoPorPartido: tot.sinPase / P, sinPaseCortoConLargo50PorPartido: tot.sinPaseConLargo / P },
}, null, 1));
