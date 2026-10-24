// Brief 060 § 7 + v1.1 (1)(2)(7) + v1.2 · Planificador de la pista al ritmo del partido. Los invariantes se comprueban
// sobre `plan.tramos` con `instanteNarrado` (oráculo independiente de `colocada.cursorTick`), en segundos de partido
// (`tick · pasoS`), nunca «tick + segundos». Las cifras salen de REPETICION_NARRADA, MESA_ARENA y VOZ_BUFFER.
import { describe, expect, it } from "vitest";
import { planificarPista, segmentoEn, type PiezaPlan, type PlanPista } from "../plan-pista";
import { ensamblarPista, instanteAudio, instanteNarrado } from "../pista-audio";
import { VOZ_BUFFER } from "../buffer";
import { prngDerivado } from "../../sim/prng";
import { ARENA, MESA_ARENA, PRIORIDAD_EVENTO_ARENA, REPETICION_NARRADA as R } from "../../sim/limites";
import { RELATO_INTERVALOS } from "../protocolo";

const paso = ARENA.pasoS, EPS = 1e-6;
const tickEn = (plan: PlanPista, s: number) => instanteNarrado(plan.tramos, s).tick;
const colocada = (plan: PlanPista, id: string) => plan.colocadas.find(c => c.id === id);
const omitida = (plan: PlanPista, id: string) => plan.omitidas.find(o => o.id === id);
const importante = (p: PiezaPlan) => p.tipo === "cierre" || p.tipo === "narrador" && p.prioridad >= R.prioridadEspera;

/** Generador de § 7: previa 0–3, narrador cada RELATO_INTERVALOS.buffer con prioridades de la tabla real (más algún
 * evento importante extra en la misma ventana), 0–4 invitados, cierre; duraciones de 0,5 a VOZ_BUFFER.duracionMaxS. */
function generar(caso: number): { piezas: PiezaPlan[]; finTick: number } {
  const rng = prngDerivado(caso, "plan-pista-060");
  const finTick = [RELATO_INTERVALOS.buffer * 6, 300, 600][rng.int(0, 2)]!;
  const prioridades = [10, ...Object.values(PRIORIDAD_EVENTO_ARENA)] as number[];
  const duracion = () => rng.next() < 0.6 ? 0.5 + rng.next() * 5.5 : 0.5 + rng.next() * (VOZ_BUFFER.duracionMaxS - 0.5);
  const piezas: PiezaPlan[] = [];
  let orden = 0;
  for (let i = 0, n = rng.int(0, 3); i < n; i++) piezas.push({ id: `previa:${i}`, tipo: "previa", tick: 0, duracionS: duracion(), prioridad: 0, orden: orden++ });
  const invitados = Array.from({ length: rng.int(0, 4) }, (_, i) => rng.int(0, finTick)).sort((a, b) => a - b);
  let k = 0;
  for (let d = 0; d < finTick; d += RELATO_INTERVALOS.buffer) {
    const h = Math.min(d + RELATO_INTERVALOS.buffer, finTick);
    const tick = d === 0 && rng.next() < 0.3 ? 0 : rng.next() < 0.3 ? h : rng.int(d + 1, h);
    piezas.push({ id: `ventana:${d}`, tipo: "narrador", tick, duracionS: duracion(), prioridad: prioridades[rng.int(0, prioridades.length - 1)]!, orden: orden++ });
    if (rng.next() < 0.25) piezas.push({ id: `evento:${d}`, tipo: "narrador", tick: rng.int(d + 1, h), duracionS: duracion(), prioridad: R.prioridadEspera + rng.int(0, 40), orden: orden++ });
    while (k < invitados.length && invitados[k]! <= h) piezas.push({ id: `invitado:${k}`, tipo: "invitado", tick: invitados[k++]!, duracionS: duracion(), prioridad: MESA_ARENA.prioridadInvitado, orden: orden++ });
  }
  if (rng.next() < 0.85) piezas.push({ id: "cierre", tipo: "cierre", tick: finTick, duracionS: duracion(), prioridad: Infinity, orden: orden++ });
  return { piezas, finTick };
}

/** Invariantes (a′), (b′), (c)–(h) de § 3.2 y v1.1, más la caducidad de los invitados y el reparto colocadas/omitidas. */
function comprobar(piezas: readonly PiezaPlan[], finTick: number, plan: PlanPista) {
  const fin = finTick * paso, porId = new Map(piezas.map(p => [p.id, p]));
  const { tramos } = plan;
  // (g) contiguos desde 0, que cubren [0, duracionS] y terminan en finTick.
  expect(tramos[0]!.inicioS).toBe(0); expect(tramos[0]!.desdeTick).toBeCloseTo(0, 9);
  for (let i = 0; i < tramos.length; i++) {
    const t = tramos[i]!;
    expect(t.finS).toBeGreaterThanOrEqual(t.inicioS);
    expect(t.hastaTick).toBeGreaterThanOrEqual(t.desdeTick - EPS);
    if (i) { expect(Math.abs(t.inicioS - tramos[i - 1]!.finS)).toBeLessThan(EPS); expect(Math.abs(t.desdeTick - tramos[i - 1]!.hastaTick)).toBeLessThan(EPS); }
  }
  expect(Math.abs(tramos.at(-1)!.finS - plan.duracionS)).toBeLessThan(EPS);
  expect(Math.abs(tramos.at(-1)!.hastaTick - finTick)).toBeLessThan(EPS);
  // (c) 1×: cada tramo que corre, muestreado en 10 puntos, avanza un segundo de partido por segundo de audio.
  for (const t of tramos.filter(t => t.hastaTick > t.desdeTick + EPS)) {
    expect(Math.abs((t.finS - t.inicioS) - (t.hastaTick - t.desdeTick) * paso)).toBeLessThan(EPS);
    for (let j = 0; j < 10; j++) { const s = t.inicioS + (t.finS - t.inicioS) * (j + 0.5) / 10; expect(Math.abs((tickEn(plan, s) - t.desdeTick) * paso - (s - t.inicioS))).toBeLessThan(EPS); }
  }
  // (d) solo esperas de los cuatro tipos, y cada tramo de ancho cero está cubierto por una espera.
  for (const e of plan.esperas) expect(["previa", "invitado", "clave", "final"]).toContain(e.tipo);
  const ceros = tramos.filter(t => Math.abs(t.hastaTick - t.desdeTick) < EPS && t.finS > t.inicioS + EPS);
  for (const t of ceros) expect(plan.esperas.some(e => e.inicioS <= t.inicioS + EPS && e.finS >= t.finS - EPS)).toBe(true);
  expect(Math.abs(ceros.reduce((n, t) => n + t.finS - t.inicioS, 0) - plan.esperas.reduce((n, e) => n + e.finS - e.inicioS, 0))).toBeLessThan(1e-5);
  // (e) sin solapes, con al menos huecoS entre dos clips; cada clip dura lo que su pieza.
  plan.colocadas.forEach((c, i) => {
    expect(Math.abs(c.finS - c.inicioS - porId.get(c.id)!.duracionS)).toBeLessThan(EPS);
    if (i) expect(c.inicioS).toBeGreaterThanOrEqual(plan.colocadas[i - 1]!.finS + R.huecoS - EPS);
  });
  expect(plan.duracionS).toBeGreaterThanOrEqual((plan.colocadas.at(-1)?.finS ?? 0) - EPS);
  // Reparto: cada pieza está colocada u omitida (una sola vez); (f) nunca se omite una importante ni el cierre.
  expect(plan.colocadas.length + plan.omitidas.length).toBe(piezas.length);
  expect(new Set([...plan.colocadas.map(c => c.id), ...plan.omitidas.map(o => o.id)]).size).toBe(piezas.length);
  for (const p of piezas.filter(importante)) expect(colocada(plan, p.id), p.id).toBeDefined();
  for (const o of plan.omitidas) { const p = porId.get(o.id)!; expect(p.tipo === "invitado" ? ["caducada"] : p.tipo === "narrador" ? ["retraso", "cede"] : []).toContain(o.motivo); }
  // Previa primero: todas sus piezas terminan antes de inicioJuegoS, que es el inicio del primer tramo que corre.
  const primero = tramos.find(t => t.hastaTick > t.desdeTick + EPS);
  if (primero) expect(Math.abs(primero.inicioS - plan.inicioJuegoS)).toBeLessThan(EPS);
  for (const c of plan.colocadas.filter(c => c.tipo === "previa")) { expect(c.finS).toBeLessThanOrEqual(plan.inicioJuegoS + EPS); expect(tickEn(plan, c.inicioS)).toBeCloseTo(0, 9); }
  for (const c of plan.colocadas.filter(c => c.tipo !== "previa")) {
    const p = porId.get(c.id)!, A = Math.min(p.tick * paso, fin), cursor = tickEn(plan, c.inicioS) * paso;
    // M22 · cursorTick coincide con el oráculo sobre los tramos.
    expect(Math.abs(c.cursorTick - tickEn(plan, c.inicioS))).toBeLessThan(EPS);
    // (a′) nunca delante: el cursor ya está en min(A + reaccionS, fin); el cierre, en fin.
    expect(cursor, `${c.id} delante`).toBeGreaterThanOrEqual(Math.min(A + R.reaccionS, fin) - EPS);
    if (c.tipo === "cierre") expect(Math.abs(cursor - fin)).toBeLessThan(EPS);
    // (b′) retraso de partido acotado del narrador.
    if (c.tipo === "narrador") expect(cursor, `${c.id} retraso`).toBeLessThanOrEqual(Math.min(A + R.retrasoMaxS, fin) + EPS);
    // Invitados: detrás, nunca más viejos que la caducidad; si detienen, la cancha no se mueve mientras hablan.
    if (c.tipo === "invitado") {
      expect(cursor - A).toBeLessThanOrEqual(MESA_ARENA.caducidadInvitadoS + EPS);
      if (c.modo === "detiene") expect(Math.abs(tickEn(plan, c.finS - 1e-4) - tickEn(plan, c.inicioS))).toBeLessThan(EPS);
    }
  }
}

describe("060 · planificarPista por propiedades (200 casos, prngDerivado)", () => {
  it("cumple (a′), (b′), (c)–(h) y la caducidad de los invitados", () => {
    let omitidas = 0, esperasClave = 0, detienen = 0;
    for (let caso = 0; caso < 200; caso++) {
      const { piezas, finTick } = generar(caso);
      const plan = planificarPista(piezas, finTick);
      comprobar(piezas, finTick, plan);
      // (h) determinista, también con la entrada en otro orden (el orden lo dan tick y `orden`).
      expect(planificarPista([...piezas].reverse(), finTick)).toEqual(plan);
      omitidas += plan.omitidas.length; esperasClave += plan.esperas.filter(e => e.tipo === "clave").length; detienen += plan.colocadas.filter(c => c.modo === "detiene" && c.tipo === "invitado").length;
    }
    // El generador ejercita las ramas que importan (omisiones, esperas clave e invitados que detienen).
    expect(omitidas).toBeGreaterThan(0); expect(esperasClave).toBeGreaterThan(0); expect(detienen).toBeGreaterThan(0);
  });
});

const n = (id: string, tick: number, duracionS: number, prioridad: number, orden: number): PiezaPlan => ({ id, tipo: "narrador", tick, duracionS, prioridad, orden });
const inv = (id: string, tick: number, duracionS: number, orden: number): PiezaPlan => ({ id, tipo: "invitado", tick, duracionS, prioridad: MESA_ARENA.prioridadInvitado, orden });
const cierre = (finTick: number, duracionS: number, orden: number): PiezaPlan => ({ id: "cierre", tipo: "cierre", tick: finTick, duracionS, prioridad: Infinity, orden });
const s = (tick: number) => tick * paso;
const GOL = PRIORIDAD_EVENTO_ARENA.gol!, REMATE = PRIORIDAD_EVENTO_ARENA.tiro!, COMENTARIO = 10;

describe("060 · casos fijos", () => {
  it("gol tras un comentario largo: el comentario cede y el gol entra con la reacción mínima", () => {
    const piezas = [n("comentario", 10, 8, COMENTARIO, 0), n("gol", 50, 4, GOL, 1)];
    const plan = planificarPista(piezas, 300);
    comprobar(piezas, 300, plan);
    expect(omitida(plan, "comentario")?.motivo).toBe("cede");
    expect(tickEn(plan, colocada(plan, "gol")!.inicioS) * paso).toBeCloseTo(s(50) + R.reaccionS, 6);
    expect(plan.esperas).toEqual([]);
  });

  it("dos claves seguidas: la segunda espera (clave) y empieza con retraso = retrasoMaxS", () => {
    const piezas = [n("gol", 50, 6, GOL, 0), n("remate", 60, 3, REMATE, 1)];
    const plan = planificarPista(piezas, 300);
    comprobar(piezas, 300, plan);
    expect(tickEn(plan, colocada(plan, "remate")!.inicioS) * paso).toBeCloseTo(s(60) + R.retrasoMaxS, 6);
    expect(plan.esperas.map(e => e.tipo)).toEqual(["clave"]);
    expect(plan.esperas[0]!.tick * paso).toBeCloseTo(s(60) + R.retrasoMaxS, 6);
  });

  it("invitado que choca con un gol: se conserva y detiene la cancha (M20: nunca cede)", () => {
    const piezas = [inv("invitado", 10, 6, 0), n("gol", 40, 3, GOL, 1)];
    const plan = planificarPista(piezas, 300);
    comprobar(piezas, 300, plan);
    expect(colocada(plan, "invitado")).toMatchObject({ modo: "detiene" });
    expect(plan.esperas.map(e => e.tipo)).toEqual(["invitado"]);
    expect(tickEn(plan, colocada(plan, "gol")!.inicioS) * paso).toBeCloseTo(s(40) + R.reaccionS, 6);
  });

  it("invitado justo en el límite: con fin + huecoS = objetivo corre; si solo cabe sin huecoS, detiene", () => {
    const objetivo = s(50) + R.reaccionS, inicio = s(10) + R.reaccionS;
    const justo = planificarPista([inv("invitado", 10, objetivo - inicio - R.huecoS, 0), n("gol", 50, 2, GOL, 1)], 300);
    expect(colocada(justo, "invitado")?.modo).toBe("corre"); expect(justo.esperas).toEqual([]);
    const sinHueco = planificarPista([inv("invitado", 10, objetivo - inicio - R.huecoS / 2, 0), n("gol", 50, 2, GOL, 1)], 300);
    expect(colocada(sinHueco, "invitado")?.modo).toBe("detiene"); expect(sinHueco.esperas.map(e => e.tipo)).toEqual(["invitado"]);
  });

  it("invitado que caduca: la voz ocupada lo deja más viejo que caducidadInvitadoS y se omite", () => {
    const largo = MESA_ARENA.caducidadInvitadoS + 6;
    const piezas = [n("gol", 10, largo, GOL, 0), inv("invitado", 20, 3, 1), cierre(600, 2, 2)];
    const plan = planificarPista(piezas, 600);
    comprobar(piezas, 600, plan);
    expect(omitida(plan, "invitado")?.motivo).toBe("caducada");
  });

  it("v1.1 interpretación 1 · con la voz ocupada, la cancha no pasa del tope de la siguiente importante: el invitado espera en él y la jugada clave entra con retraso ≤ retrasoMaxS", () => {
    // Gol largo en 20 s; un invitado en 20,5 s y un remate en 24 s esperan a que la voz quede libre (≈ 30,5 s).
    const piezas = [n("gol", 200, 10, GOL, 0), inv("invitado", 205, 4, 1), n("remate", 240, 2, REMATE, 2)];
    const plan = planificarPista(piezas, 600);
    comprobar(piezas, 600, plan);
    const tope = s(240) + R.retrasoMaxS;
    expect(tickEn(plan, colocada(plan, "invitado")!.inicioS) * paso).toBeCloseTo(tope, 6);
    expect(colocada(plan, "invitado")?.modo).toBe("detiene");
    expect(tickEn(plan, colocada(plan, "remate")!.inicioS) * paso).toBeCloseTo(tope, 6);
    // En ningún instante antes del remate el cursor pasa del tope.
    for (const t of plan.tramos.filter(t => t.finS <= colocada(plan, "remate")!.inicioS + EPS)) expect(t.hastaTick * paso).toBeLessThanOrEqual(tope + EPS);
    // La cancha espera en el tope (clave), durante el invitado y, ya libre la voz, el hueco antes del remate (clave).
    expect(plan.esperas.map(e => e.tipo)).toEqual(["clave", "invitado", "clave"]);
  });

  it("v1.1 interpretación 2 · los invitados también esperan reaccionS tras su tick", () => {
    const plan = planificarPista([inv("invitado", 30, 2, 0)], 300);
    expect(tickEn(plan, colocada(plan, "invitado")!.inicioS) * paso).toBeCloseTo(s(30) + R.reaccionS, 6);
  });

  it("sin previa: inicioJuegoS = 0", () => {
    const plan = planificarPista([n("inicio", 0, 2, COMENTARIO, 0)], 100);
    expect(plan.inicioJuegoS).toBe(0);
    expect(plan.tramos[0]!.hastaTick).toBeGreaterThan(plan.tramos[0]!.desdeTick);
  });

  it("previa primero (M6): aunque un clip del tick 0 tenga menor orden, la previa suena antes, con la cancha en 0", () => {
    const piezas: PiezaPlan[] = [n("inicio", 0, 2, COMENTARIO, 0), { id: "previa:1", tipo: "previa", tick: 0, duracionS: 5, prioridad: 0, orden: 1 }, { id: "previa:2", tipo: "previa", tick: 0, duracionS: 4, prioridad: 0, orden: 2 }];
    const plan = planificarPista(piezas, 100);
    comprobar(piezas, 100, plan);
    expect(plan.colocadas.map(c => c.id)).toEqual(["previa:1", "previa:2", "inicio"]);
    expect(plan.inicioJuegoS).toBeCloseTo(5 + R.huecoS + 4, 9);
    expect(plan.esperas).toEqual([{ tipo: "previa", inicioS: 0, finS: plan.inicioJuegoS, tick: 0 }]);
    expect(colocada(plan, "inicio")!.inicioS).toBeCloseTo(plan.inicioJuegoS + R.reaccionS, 9);
  });

  it("cierre con la voz ocupada: la cancha llega al fin, espera (final) y el cierre empieza al quedar libre la voz", () => {
    const piezas = [n("gol", 580, 5, GOL, 0), cierre(600, 3, 1)];
    const plan = planificarPista(piezas, 600);
    comprobar(piezas, 600, plan);
    const gol = colocada(plan, "gol")!, c = colocada(plan, "cierre")!;
    expect(c.inicioS).toBeCloseTo(gol.finS + R.huecoS, 9);
    expect(c.cursorTick).toBeCloseTo(600, 9);
    expect(plan.esperas.map(e => e.tipo)).toEqual(["final"]);
    expect(plan.duracionS).toBeCloseTo(c.finS, 9);
  });

  it("v1.2 · A + reaccionS < fin < A + retrasoMaxS: la pieza puede empezar antes del fin; la terminal, con la cancha ya en el fin", () => {
    const fin = 600, A = fin - 10; // 59 s: 59,3 < 60 < 62
    expect(s(A) + R.reaccionS).toBeLessThan(s(fin)); expect(s(fin)).toBeLessThan(s(A) + R.retrasoMaxS);
    const plan = planificarPista([n("remate", A, 0.4, REMATE, 0)], fin);
    comprobar([n("remate", A, 0.4, REMATE, 0)], fin, plan);
    expect(tickEn(plan, colocada(plan, "remate")!.inicioS) * paso).toBeCloseTo(s(A) + R.reaccionS, 9);
    // Excepción terminal: A + reaccionS > fin ⇒ empieza con la cancha ya en fin (reacción fin − A < reaccionS, nunca negativa).
    const terminal = planificarPista([n("gol", fin - 1, 2, GOL, 0)], fin);
    expect(tickEn(terminal, colocada(terminal, "gol")!.inicioS)).toBeCloseTo(fin, 9);
  });
});

describe("060 · segmentoEn, ensamblado e instanteAudio sobre plan.tramos", () => {
  it("segmentoEn: la última colocada con inicioS ≤ t, o la primera", () => {
    const plan = planificarPista([n("a", 10, 1, COMENTARIO, 0), n("b", 60, 1, COMENTARIO, 1)], 300);
    expect(segmentoEn(plan.colocadas, 0)).toBe(0);
    expect(segmentoEn(plan.colocadas, plan.colocadas[1]!.inicioS)).toBe(1);
    expect(segmentoEn([], 3)).toBe(-1);
  });

  it("ensamblarPista: desplazamiento round(inicioS·sr), sin solapes (ajuste por redondeo) y longitud round(duracionS·sr) (M9)", () => {
    const sr = 24000, clip = (v: number, n: number) => new Float32Array(n).fill(v);
    // El segundo clip empieza a 99,4 muestras: su redondeo (99) solaparía al primero (100 muestras) → empieza en 100.
    const clips = [{ inicioS: 0, muestras: clip(0.5, 100) }, { inicioS: 99.4 / sr, muestras: clip(0.25, 50) }, { inicioS: 1, muestras: clip(0.75, 10) }];
    const pcm = Float32Array.from(ensamblarPista(clips, 1.5, sr).flatMap(f => [...f]));
    expect(pcm.length).toBe(Math.round(1.5 * sr));
    const primera = (v: number) => pcm.findIndex(x => x === v);
    expect(primera(0.5)).toBe(0); expect(primera(0.25)).toBe(100); expect(primera(0.75)).toBe(Math.round(1 * sr));
    expect(pcm.filter(x => x === 0.5).length).toBe(100); expect(pcm.filter(x => x === 0.25).length).toBe(50);
  });

  it("instanteAudio/instanteNarrado: inversa en los tramos que corren y buscar el tick de una espera cae en el tramo siguiente", () => {
    for (let caso = 0; caso < 40; caso++) {
      const { piezas, finTick } = generar(1000 + caso), plan = planificarPista(piezas, finTick);
      const corren = plan.tramos.filter(t => t.hastaTick > t.desdeTick + EPS);
      for (const t of corren) for (const f of [0.25, 0.5, 0.75]) {
        const tick = t.desdeTick + f * (t.hastaTick - t.desdeTick);
        expect(Math.abs(instanteNarrado(plan.tramos, instanteAudio(plan.tramos, tick)).tick - tick)).toBeLessThan(1e-4);
      }
      for (const e of plan.esperas.filter(e => e.tick > EPS && e.tick < finTick - EPS)) {
        const siguiente = corren.find(t => Math.abs(t.desdeTick - e.tick) < EPS)!;
        expect(instanteAudio(plan.tramos, e.tick)).toBeCloseTo(siguiente.inicioS, 6);
        expect(siguiente.inicioS).toBeGreaterThanOrEqual(e.finS - EPS);
      }
    }
  });
});
