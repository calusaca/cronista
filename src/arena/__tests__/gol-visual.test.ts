// Brief 057 · Pruebas puras: inversa del reloj de audio (`instanteAudio`, bloque A) y, con B1/B2, la
// reconstrucción visual del gol. Ninguna cifra de GOL_VISUAL, TECNICA_ARENA, CANTO_GOL ni ARENA se repite.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { instanteAudio, instanteNarrado, type TramoTemporal } from "../pista-audio";
import type { EventoArena, RegistroArena } from "../tipos";
import { alturaIlustrativa, estadoVisual, reconstruccionGol, vistaArco } from "../vista";
import { ALTURA_DESTINO_M, ARCO_3D, ARENA, GOL_VISUAL, TECNICA_ARENA } from "../../sim/limites";

describe("057 v1.1 § 6 · instanteAudio", () => {
  // Previa [0,0], narrador [0,100], intervención [100,100], narrador [100,200].
  const tramos: TramoTemporal[] = [
    { inicioS: 0, finS: 2, desdeTick: 0, hastaTick: 0 },
    { inicioS: 2, finS: 5, desdeTick: 0, hastaTick: 100 },
    { inicioS: 5, finS: 6, desdeTick: 100, hastaTick: 100 },
    { inicioS: 6, finS: 9, desdeTick: 100, hastaTick: 200 },
  ];
  const narrador = (i: number) => tramos[i]!.hastaTick > tramos[i]!.desdeTick;

  it("tick ≤ 0 → 0 (inicio del audio, previa incluida)", () => {
    expect(instanteAudio(tramos, 0)).toBe(0);
    expect(instanteAudio(tramos, -5)).toBe(0);
  });

  it("tick 100 (frontera compartida) cae en el segundo tramo del narrador con progreso 0, no en la intervención ni al final del primero", () => {
    const s = instanteAudio(tramos, 100);
    expect(s).toBe(tramos[3]!.inicioS);
    expect(instanteNarrado(tramos, s)).toEqual({ indice: 3, tick: 100 });
  });

  it("tick ≥ fin → fin del último tramo del narrador menos 1 ms (nunca finS)", () => {
    expect(instanteAudio(tramos, 200)).toBeCloseTo(tramos[3]!.finS - 0.001, 9);
    expect(instanteAudio(tramos, 250)).toBeCloseTo(tramos[3]!.finS - 0.001, 9);
    expect(instanteAudio(tramos, 200)).toBeLessThan(tramos[3]!.finS);
  });

  it("propiedad inversa: para t ∈ (0, 200) en pasos de 1 tick, instanteNarrado(instanteAudio(t)) está en un tramo del narrador y a ≤ 1 tick de t", () => {
    for (let t = 1; t < 200; t++) {
      const s = instanteAudio(tramos, t), inst = instanteNarrado(tramos, s);
      expect(narrador(inst.indice), `t=${t}`).toBe(true);
      expect(Math.abs(inst.tick - t), `t=${t}`).toBeLessThanOrEqual(1);
      // Nunca un instante dentro de un tramo de ancho cero.
      for (const [i, x] of tramos.entries()) if (!narrador(i)) expect(s >= x.inicioS && s < x.finS, `t=${t} en ${i}`).toBe(false);
    }
  });
});

const leer = (ruta: string) => JSON.parse(readFileSync(ruta, "utf8")) as RegistroArena;
/** v1.1 § 7 · Cinco fixtures de reinicios (goles de los dos lados) y los dos ejemplos públicos sin reglas. */
const REGISTROS: [string, RegistroArena][] = [
  ...[1, 2, 3, 4, 5].map(v => [`reinicios-v${v}`, leer(`src/arena/__fixtures__/arena-reinicios-v${v}.json`)] as [string, RegistroArena]),
  ["duelo-v3", leer("public/experimentos/arena-duelo-v3.json")],
  ["llm-v3", leer("public/experimentos/arena-llm-v3.json")],
];
const s = (tick: number) => tick * ARENA.pasoS;
const previo = (r: RegistroArena, g: EventoArena) => [...r.fotogramas].reverse().find(f => f.tick < g.tick)!;
const enRed = GOL_VISUAL.enRedS / ARENA.pasoS, entrada = GOL_VISUAL.entradaRedS / ARENA.pasoS;

describe("057 B1 · reconstruccionGol sobre los cinco fixtures y los dos ejemplos", () => {
  for (const [nombre, r] of REGISTROS) {
    const goles = r.eventos.filter(e => e.tipo === "gol");
    it(`${nombre}: ${goles.length} gol(es) — antes del hueco null; vuelo sobre el segmento; red en el cruce y a profundidadRedM; 22 y árbitro del fotograma previo; corte en enRedS`, () => {
      expect(goles.length).toBeGreaterThan(0);
      const antes = JSON.stringify(r);
      for (const g of goles) {
        const A = previo(r, g), lado = g.hasta.x >= ARENA.largoM / 2 ? 1 : -1;
        // M1a · antes del último fotograma previo: nada.
        expect(reconstruccionGol(r, s(A.tick - 1)), `${g.id} antes`).toBeNull();
        // Vuelo: colineal con A.balon → G.hasta, x monótona, sin gol expuesto (M1b), congelado = A.
        let xPrevia = A.balon.posicion.x;
        for (const k of [0, 0.25, 0.5, 0.75]) {
          const tick = A.tick + k * (g.tick - A.tick), v = reconstruccionGol(r, s(tick));
          expect(v?.fase, `${g.id} vuelo ${k}`).toBe("vuelo");
          if (v?.fase !== "vuelo") continue;
          expect("gol" in v).toBe(false);
          const a = A.balon.posicion, b = g.hasta;
          expect(Math.abs((b.x - a.x) * (v.balon.y - a.y) - (b.y - a.y) * (v.balon.x - a.x))).toBeLessThan(1e-6);
          expect((v.balon.x - xPrevia) * (b.x - a.x)).toBeGreaterThanOrEqual(-1e-9); xPrevia = v.balon.x;
          expect(v.congelado).toBe(A);
        }
        // Red en el tick exacto: en la línea; desde entradaRedS, a profundidadRedM tras ella, hacia el arco batido.
        const r0 = reconstruccionGol(r, s(g.tick));
        expect(r0?.fase, `${g.id} red`).toBe("red");
        if (r0?.fase !== "red") continue;
        expect(r0.gol.id).toBe(g.id);
        expect(r0.balon.y).toBe(g.hasta.y);
        expect(Math.abs(r0.balon.x - g.hasta.x)).toBe(0);
        const r1 = reconstruccionGol(r, s(g.tick + entrada))!;
        expect(Math.abs(r1.balon.x - g.hasta.x)).toBeCloseTo(GOL_VISUAL.profundidadRedM, 9);
        if (lado > 0) expect(r1.balon.x).toBeGreaterThan(ARENA.largoM); else expect(r1.balon.x).toBeLessThan(0);
        // M4 · congelado = último fotograma con tick < G.tick (ids, posiciones y árbitro), nunca el del gol.
        expect(r1.congelado).toBe(A);
        expect(r1.congelado!.jugadores.map(j => [j.id, j.posicion])).toEqual(A.jugadores.map(j => [j.id, j.posicion]));
        expect(r1.congelado!.arbitro).toEqual(A.arbitro);
        // M5 · corte al cumplirse enRedS: el estado registrado (v2+: balón en el centro).
        expect(reconstruccionGol(r, s(g.tick + enRed))).toBeNull();
        const tras = estadoVisual(r, s(g.tick + enRed));
        if (r.config.reglas && r.config.reglas !== "reinicios-v1") expect(tras.balon.posicion).toEqual({ x: ARENA.largoM / 2, y: ARENA.anchoM / 2 });
        // M6 · movimiento reducido: nunca vuelo; red con u = 1 desde el tick del gol.
        expect(reconstruccionGol(r, s(A.tick + (g.tick - A.tick) / 2), true)).toBeNull();
        const d = reconstruccionGol(r, s(g.tick), true)!;
        expect(d.fase).toBe("red");
        expect(Math.abs(d.balon.x - g.hasta.x)).toBeCloseTo(GOL_VISUAL.profundidadRedM, 9);
      }
      expect(JSON.stringify(r)).toBe(antes);
    });
  }

  it("v1 con dos goles: cada uno reconstruye el suyo", () => {
    const r = REGISTROS[0]![1], [a, b] = r.eventos.filter(e => e.tipo === "gol") as [EventoArena, EventoArena];
    expect((reconstruccionGol(r, s(a.tick)) as { gol: EventoArena }).gol.id).toBe(a.id);
    expect((reconstruccionGol(r, s(b.tick)) as { gol: EventoArena }).gol.id).toBe(b.id);
  });

  it("M3 · el arco de la red se decide por hasta.x, no por lado: con el lado invertido (autogol sintético) la profundidad sigue hacia el arco batido", () => {
    for (const [, original] of REGISTROS.slice(0, 5)) {
      const r = structuredClone(original);
      for (const g of r.eventos.filter(e => e.tipo === "gol")) {
        g.lado = g.lado === "local" ? "visita" : "local"; g.autogol = true;
        const x = reconstruccionGol(r, s(g.tick + entrada))!.balon.x;
        if (g.hasta.x >= ARENA.largoM / 2) expect(x).toBeGreaterThan(ARENA.largoM); else expect(x).toBeLessThan(0);
      }
    }
  });

  it("gol sintético con hasta.y fuera del arco → null en sus dos fases", () => {
    const r = structuredClone(REGISTROS[2]![1]), g = r.eventos.find(e => e.tipo === "gol")!;
    g.hasta = { ...g.hasta, y: ARENA.anchoM / 2 + ARENA.arcoM };
    const A = previo(r, g);
    expect(reconstruccionGol(r, s(g.tick))).toBeNull();
    expect(reconstruccionGol(r, s((A.tick + g.tick) / 2))).toBeNull();
  });
});

describe("057 § 6 · invariantes de GOL_VISUAL", () => {
  it("enRedS < pausaS; entradaRedS ≤ enRedS; 0 < profundidadRedM ≤ 2; cortes crecientes < 1; altura máxima < travesaño; radio < medio arco (M7)", () => {
    expect(GOL_VISUAL.enRedS).toBeLessThan(TECNICA_ARENA.pausaS);
    expect(GOL_VISUAL.entradaRedS).toBeLessThanOrEqual(GOL_VISUAL.enRedS);
    expect(GOL_VISUAL.profundidadRedM).toBeGreaterThan(0); expect(GOL_VISUAL.profundidadRedM).toBeLessThanOrEqual(2);
    expect(GOL_VISUAL.cortesPotencia.raso).toBeLessThan(GOL_VISUAL.cortesPotencia.media); expect(GOL_VISUAL.cortesPotencia.media).toBeLessThan(1);
    expect(Math.max(...Object.values(ALTURA_DESTINO_M))).toBeLessThan(ARCO_3D.altoM);
    expect(GOL_VISUAL.vista.radioBalonM).toBeLessThan(ARCO_3D.anchoM / 2);
  });
});

describe("057 B2 · alturaIlustrativa (§ 5.1)", () => {
  const gol = (r: RegistroArena, id: string) => r.eventos.find(e => e.id === id)!;
  const [v1, , , , v5, duelo, llm] = REGISTROS.map(x => x[1]) as RegistroArena[];
  it("las cinco distancias de los fixtures dan las bandas del brief (M8); 14 m sintético → media; distancia no finita → raso sin derivar", () => {
    const casos: [EventoArena, string][] = [[gol(v1!, "a23"), "alta"], [gol(v1!, "a40"), "raso"], [gol(v5!, "a12"), "raso"], [gol(duelo!, "a14"), "alta"], [gol(llm!, "a18"), "raso"]];
    for (const [g, banda] of casos) {
      const a = alturaIlustrativa(g);
      expect(a.banda, `${g.id} ${g.distanciaM}`).toBe(banda);
      expect(a.derivada).toBe(true);
      expect(a.metros).toBe(ALTURA_DESTINO_M[a.banda]);
      expect(a.metros).toBeLessThan(ARCO_3D.altoM);
    }
    expect(alturaIlustrativa({ ...gol(v1!, "a23"), distanciaM: 14 }).banda).toBe("media");
    expect(alturaIlustrativa({ ...gol(v1!, "a23"), distanciaM: Number.NaN })).toEqual({ banda: "raso", metros: ALTURA_DESTINO_M.raso, derivada: false });
  });
});

describe("057 B2 · vistaArco (§ 5.1)", () => {
  const v1 = REGISTROS[0]![1], [derecho, izquierdo] = v1.eventos.filter(e => e.tipo === "gol") as [EventoArena, EventoArena];
  it("arco por hasta.x y signo lateral mirando desde el campo: derecho → visita (+), izquierdo → local (−)", () => {
    expect(derecho.hasta.x).toBe(ARENA.largoM); expect(izquierdo.hasta.x).toBe(0);
    const d = vistaArco(v1, derecho), i = vistaArco(v1, izquierdo);
    expect(d.defiende).toBe("visita"); expect(d.lateralM).toBeCloseTo(derecho.hasta.y - ARENA.anchoM / 2, 9);
    expect(i.defiende).toBe("local"); expect(i.lateralM).toBeCloseTo(-(izquierdo.hasta.y - ARENA.anchoM / 2), 9);
  });
  it("autogol sintético (lado del beneficiado visita, hasta.x = 0) → defiende el local (M3)", () => {
    const autogol: EventoArena = { ...izquierdo, lado: "visita", autogol: true, hasta: { x: 0, y: izquierdo.hasta.y } };
    expect(vistaArco(v1, autogol).defiende).toBe("local");
    expect(vistaArco(v1, { ...derecho, lado: "visita", autogol: true }).defiende).toBe("visita");
  });
  it("acotación lateral a ±(arcoM/2 − radioBalonM)", () => {
    const tope = ARENA.arcoM / 2 - GOL_VISUAL.vista.radioBalonM;
    expect(vistaArco(v1, { ...derecho, hasta: { x: ARENA.largoM, y: ARENA.anchoM / 2 + ARENA.arcoM / 2 } }).lateralM).toBeCloseTo(tope, 9);
    expect(vistaArco(v1, { ...derecho, hasta: { x: ARENA.largoM, y: ARENA.anchoM / 2 - ARENA.arcoM / 2 } }).lateralM).toBeCloseTo(-tope, 9);
  });
});
