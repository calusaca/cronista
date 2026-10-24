// Brief 059 v1.2 — funciones puras del torneo: calendario Berger (M1–M3, N1), clasificación y desempates con
// fixtures construidos a mano y tablas literales (M4–M8, § 15.9), cruces (M10), prueba de signos (M11),
// micro-USD y reservas con valores literales (§ 15.9, N4–N7), causa terminal exhaustiva (§ 16.2, N2, N3, N17),
// esquema estricto (M20) y coherencia (M21). Ninguna cifra de TORNEO_ARENA/ARENA se repite a mano salvo los
// micro-USD literales que § 15.9 exige calcular a mano (derivación en el comentario de cada caso).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TORNEO_ARENA as T } from "../../sim/limites";
import {
  calendarioTorneo, causaTerminal, clasificar, costoLadoMicro, cruces, esquemaTorneo, gastoConocido, microCostoUso, microMaxIntento, ordenTorneo,
  pMinimaTorneo, pSignosBilateral, reservaPartido, semillasCruce, TABLAS_BERGER, textoSignificacion, validarCoherencia, cortoDe,
  type EncuentroTorneo, type ParticipanteTorneo, type TorneoArchivado,
} from "../torneo";

const SEIS = ["equilibrado", "rapido", "luna6", "sol6", "astra6", "sol61"];
const TRES = ["ensayo:a", "ensayo:b", "ensayo:c"];
const FIXTURE = "src/arena/__fixtures__/torneos/ensayo-059/torneo.json";
const torneoFixture = () => JSON.parse(readFileSync(FIXTURE, "utf8")) as TorneoArchivado;

describe("059 · calendario Berger (§ 15.2)", () => {
  it("M1 · cada par juega 2 veces, una de local cada uno, con la misma semilla en ida y vuelta y semillas distintas entre cruces", () => {
    const plan = calendarioTorneo(SEIS, T.semillaDefecto);
    expect(plan).toHaveLength(SEIS.length * (SEIS.length - 1));
    const porPar = new Map<string, typeof plan>();
    for (const p of plan) { const k = [p.local, p.visita].sort().join("|"); porPar.set(k, [...(porPar.get(k) ?? []), p]); }
    expect(porPar.size).toBe(15);
    for (const [, ps] of porPar) {
      expect(ps).toHaveLength(2);
      expect(ps[0]!.local).toBe(ps[1]!.visita);
      expect(ps[0]!.visita).toBe(ps[1]!.local);
      expect(ps[0]!.seed).toBe(ps[1]!.seed);
      expect(ps[0]!.cruce).toBe(ps[1]!.cruce);
      expect([ps[0]!.vuelta, ps[1]!.vuelta].sort()).toEqual([false, true]);
    }
    expect(new Set([...porPar.values()].map(ps => ps[0]!.seed)).size).toBe(15);
    expect(plan.every(p => Number.isInteger(p.seed) && p.seed >= 0 && p.seed <= 0xffffffff)).toBe(true);
  });

  it("M2 · nadie juega dos veces por jornada; ida con locales [3,3,3,2,2,2] por índice y 5/5 en el torneo; con 3, 1/1 y un descanso por jornada", () => {
    const plan = calendarioTorneo(SEIS, T.semillaDefecto);
    for (const j of new Set(plan.map(p => p.jornada))) {
      const ids = plan.filter(p => p.jornada === j).flatMap(p => [p.local, p.visita]);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toHaveLength(6);
    }
    const orden = ordenTorneo(SEIS, T.semillaDefecto), ida = plan.filter(p => !p.vuelta);
    expect(orden.map(id => ida.filter(p => p.local === id).length)).toEqual([3, 3, 3, 2, 2, 2]);
    for (const id of SEIS) {
      expect(plan.filter(p => p.local === id)).toHaveLength(5);
      expect(plan.filter(p => p.visita === id)).toHaveLength(5);
    }
    const tres = calendarioTorneo(TRES, T.semillaDefecto);
    expect(tres).toHaveLength(6);
    for (const id of TRES) expect(tres.filter(p => !p.vuelta && p.local === id)).toHaveLength(1);
    for (const j of [1, 2, 3]) expect(tres.filter(p => p.jornada === j)).toHaveLength(1);
  });

  it("M2 · determinista por semilla; estable ante el orden de ids, también la semilla de cada cruce", () => {
    const a = calendarioTorneo(SEIS, 59), b = calendarioTorneo([...SEIS].reverse(), 59), c = calendarioTorneo(SEIS, 60);
    expect(b).toEqual(a);
    expect(c).not.toEqual(a);
    expect([...semillasCruce([...SEIS].reverse(), 59)]).toEqual([...semillasCruce(SEIS, 59)]);
    // Con otro orden de entrada (y por tanto otra posición), el mismo par conserva la semilla.
    const s1 = semillasCruce(SEIS, 59), s2 = semillasCruce(["sol61", "astra6", "equilibrado", "rapido", "sol6", "luna6"], 59);
    for (const [k, v] of s1) expect(s2.get(k)).toBe(v);
  });

  it("M3 · la ida (1…N/2) es un todos contra todos simple; la vuelta (N/2+1…N) repite jornadas y orden con los lados invertidos", () => {
    const plan = calendarioTorneo(SEIS, 59), mitad = plan.length / 2;
    const ida = plan.slice(0, mitad), vuelta = plan.slice(mitad);
    expect(ida.every(p => !p.vuelta) && vuelta.every(p => p.vuelta)).toBe(true);
    expect(new Set(ida.map(p => [p.local, p.visita].sort().join("|"))).size).toBe(mitad);
    expect(plan.map(p => p.n)).toEqual(Array.from({ length: plan.length }, (_, i) => i + 1));
    vuelta.forEach((v, i) => { expect([v.local, v.visita, v.seed, v.cruce]).toEqual([ida[i]!.visita, ida[i]!.local, ida[i]!.seed, ida[i]!.cruce]); expect(v.jornada).toBe(ida[i]!.jornada + 5); });
  });

  it("N1 · tablas literales de 6 y de 3 (local–visita) aplicadas sobre el orden barajado", () => {
    expect(TABLAS_BERGER[6]).toEqual([
      [[1, 6], [2, 5], [3, 4]], [[6, 4], [5, 3], [1, 2]], [[2, 6], [3, 1], [4, 5]], [[6, 5], [1, 4], [2, 3]], [[3, 6], [4, 2], [5, 1]],
    ]);
    expect(TABLAS_BERGER[3]).toEqual([[[1, 2]], [[3, 1]], [[2, 3]]]);
    const orden = ordenTorneo(SEIS, 59), plan = calendarioTorneo(SEIS, 59);
    expect(plan.slice(0, 15).map(p => [orden.indexOf(p.local) + 1, orden.indexOf(p.visita) + 1])).toEqual(TABLAS_BERGER[6]!.flat());
    expect(plan.slice(0, 15).map(p => p.jornada)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5]);
  });

  it("4 o 5 participantes: «sin tabla» (P2)", () => {
    expect(() => calendarioTorneo(SEIS.slice(0, 4), 59)).toThrow(/sin tabla/);
    expect(() => calendarioTorneo(SEIS.slice(0, 5), 59)).toThrow(/sin tabla/);
  });

  it("nombre corto: sin «GPT-» y 8 caracteres como máximo", () => {
    expect(["GPT-5.6 Luna", "GPT-5.4 mini", "GPT-6 Luna", "GPT-6 Sol", "GPT-6 Astra", "GPT-6.1 Sol"].map(cortoDe)).toEqual(["5.6 Luna", "5.4 mini", "6 Luna", "6 Sol", "6 Astra", "6.1 Sol"]);
    expect(cortoDe("Nombre larguísimo").length).toBeLessThanOrEqual(8);
  });
});

// --- Clasificación con fixtures construidos a mano -----------------------------------------------------------
const V = T.puntos.victoria, E = T.puntos.empate, D = T.puntos.derrota;
const m = (local: string, gl: number, visita: string, gv: number) => ({ local: { participante: local, goles: gl }, visita: { participante: visita, goles: gv } }) as unknown as EncuentroTorneo;
const par = (id: string, nombre = id) => ({ id, nombre }) as ParticipanteTorneo;
const fila = (id: string, pos: number, empatada: boolean, g: number, e: number, p: number, gf: number, gc: number) => ({ id, pos, empatada, pj: g + e + p, g, e, p, gf, gc, dg: gf - gc, pts: g * V + e * E + p * D });

describe("059 · clasificación (§ 4.2, § 15.9)", () => {
  it("M4–M6 · seis participantes: puntos, DG y GF; el visitante también suma sus goles", () => {
    // B 0–3 A (A gana de visitante), C 1–0 D, E 4–3 F. A, E y C empatan a puntos: A por DG (+3); E y C con DG +1,
    // E por GF (4 > 1). Perdedores: F (−1, GF 3), D (−1, GF 0), B (−3).
    const t = { participantes: ["A", "B", "C", "D", "E", "F"].map(x => par(x)), encuentros: [m("B", 0, "A", 3), m("C", 1, "D", 0), m("E", 4, "F", 3)] };
    expect(clasificar(t)).toEqual([
      fila("A", 1, false, 1, 0, 0, 3, 0), fila("E", 2, false, 1, 0, 0, 4, 3), fila("C", 3, false, 1, 0, 0, 1, 0),
      fila("F", 4, false, 0, 0, 1, 3, 4), fila("D", 5, false, 0, 0, 1, 0, 1), fila("B", 6, false, 0, 0, 1, 0, 3),
    ]);
  });

  it("M7 · cuatro participantes: liguilla de 3 que se separa en 1 + 2 y se reaplica a los 2", () => {
    // Entre P, Q y R: Q 1–0 R, Q 0–1 P, R 1–0 P, P 2–0 Q, P 2–0 R → P 9 pts; Q y R 3 pts, DG −2, GF 1.
    // Contra S: S 1–0 P dos veces; Q 2–0 S y R 2–0 S dos veces cada uno. Total: P, Q y R con 9 pts, DG +2, GF 5.
    // Liguilla de 3: P arriba; Q y R siguen empatados; liguilla de 2 (solo Q 1–0 R): Q arriba.
    const t = { participantes: ["P", "Q", "R", "S"].map(x => par(x)), encuentros: [
      m("Q", 1, "R", 0), m("Q", 0, "P", 1), m("R", 1, "P", 0), m("P", 2, "Q", 0), m("P", 2, "R", 0),
      m("S", 1, "P", 0), m("P", 0, "S", 1), m("Q", 2, "S", 0), m("S", 0, "Q", 2), m("R", 2, "S", 0), m("S", 0, "R", 2),
    ] };
    expect(clasificar(t)).toEqual([
      fila("P", 1, false, 3, 0, 3, 5, 3), fila("Q", 2, false, 3, 0, 2, 5, 3), fila("R", 3, false, 3, 0, 2, 5, 3), fila("S", 4, false, 2, 0, 4, 2, 8),
    ]);
  });

  it("M8 · posición compartida (1, 2, 2, 4) con `empatada`; alfabético por nombre (es) solo para mostrar", () => {
    // T gana a todos 1–0; B 1–1 C; B 1–0 D; C 1–0 D. B y C: 4 pts, DG 0, GF 2; liguilla: 1–1 → irreducible.
    const t = { participantes: [par("t", "Tauro"), par("b", "Zeta"), par("c", "Álamo"), par("d", "Delta")], encuentros: [
      m("t", 1, "b", 0), m("t", 1, "c", 0), m("t", 1, "d", 0), m("b", 1, "c", 1), m("b", 1, "d", 0), m("c", 1, "d", 0),
    ] };
    expect(clasificar(t)).toEqual([fila("t", 1, false, 3, 0, 0, 3, 0), fila("c", 2, true, 1, 1, 1, 2, 2), fila("b", 2, true, 1, 1, 1, 2, 2), fila("d", 4, false, 0, 0, 3, 0, 3)]);
  });

  it("tres participantes: empate irreducible, los tres en 1=, en orden alfabético español (N < Ñ < O)", () => {
    const t = { participantes: [par("x", "Oca"), par("y", "Ñandú"), par("z", "Nube")], encuentros: [m("x", 1, "y", 1), m("y", 1, "z", 1), m("z", 1, "x", 1)] };
    expect(clasificar(t)).toEqual([fila("z", 1, true, 0, 2, 0, 2, 2), fila("y", 1, true, 0, 2, 0, 2, 2), fila("x", 1, true, 0, 2, 0, 2, 2)]);
  });

  it("M9 · solo cuentan los encuentros: los pendientes no suman PJ", () => {
    const t = torneoFixture();
    const sin = { ...t, encuentros: t.encuentros.slice(0, 4), pendientes: [5, 6] };
    for (const f of clasificar(sin)) expect(f.pj).toBe(sin.encuentros.filter(e => e.local.participante === f.id || e.visita.participante === f.id).length);
  });

  it("M10 · cruces: global de ida y vuelta sin gol de visitante doble; ganador null en empate global", () => {
    const t = torneoFixture();
    const [p1, p4] = [t.encuentros.find(e => e.n === 1)!, t.encuentros.find(e => e.n === 4)!];
    // Cruce 1 = P1 (ida, a local) y P4 (vuelta, b local).
    const conGoles = (e: EncuentroTorneo, gl: number, gv: number) => ({ ...e, local: { ...e.local, goles: gl }, visita: { ...e.visita, goles: gv } });
    const a = { ...t, encuentros: [conGoles(p1, 0, 1), conGoles(p4, 2, 1), ...t.encuentros.filter(e => e.n !== 1 && e.n !== 4)] };
    const c1 = cruces(a).find(c => c.cruce === 1)!;
    // Ida a 0–1 b, vuelta b 2–1 a: a = 0 + 1 = 1; b = 1 + 2 = 3.
    expect([c1.golesA, c1.golesB, c1.completo, c1.ganador]).toEqual([1, 3, true, p1.visita.participante]);
    // Ida a 0–0 b, vuelta b 0–2 a: a = 2, b = 0.
    const b = { ...t, encuentros: [conGoles(p1, 0, 0), conGoles(p4, 0, 2), ...t.encuentros.filter(e => e.n !== 1 && e.n !== 4)] };
    expect(cruces(b).find(c => c.cruce === 1)!).toMatchObject({ golesA: 2, golesB: 0, ganador: p1.local.participante });
    // Ida a 2–1 b, vuelta b 1–0 a: global 2–2; b marcó 1 de visitante y a ninguno: con la regla del gol de
    // visitante ganaría b; aquí no hay ganador.
    const empate = { ...t, encuentros: [conGoles(p1, 2, 1), conGoles(p4, 1, 0), ...t.encuentros.filter(e => e.n !== 1 && e.n !== 4)] };
    expect(cruces(empate).find(c => c.cruce === 1)!).toMatchObject({ golesA: 2, golesB: 2, completo: true, ganador: null });
    const incompleto = { ...t, encuentros: t.encuentros.filter(e => e.n !== 4) };
    expect(cruces(incompleto).find(c => c.cruce === 1)!).toMatchObject({ completo: false, ganador: null });
  });
});

describe("059 · prueba de signos ilustrativa (§ 4.4, § 15.7)", () => {
  it("M11 · binomial exacta bilateral con tope 1; empates fuera", () => {
    expect(pSignosBilateral(5, 0)).toBe(0.0625);
    expect(pSignosBilateral(4, 0)).toBe(0.125);
    expect(pSignosBilateral(3, 1)).toBe(0.625);
    expect(pSignosBilateral(0, 5)).toBe(0.0625);
    expect(pSignosBilateral(2, 2)).toBe(1);
    expect(pSignosBilateral(0, 0)).toBe(1);
    expect(pMinimaTorneo(6)).toBe(pSignosBilateral(5, 0));
  });

  it("la frase de § 15.7 lleva la p calculada y el alfa de TORNEO_ARENA en ES y EN", () => {
    const t = { participantes: SEIS.map(x => par(x)) };
    const p = pMinimaTorneo(SEIS.length);
    expect(textoSignificacion(t, "es")).toBe(`En una prueba de signos ilustrativa —que supone cruces independientes y una probabilidad de ½ de ganar cada uno—, ni ganar los 5 cruces alcanzaría p < ${String(T.alfa).replace(".", ",")} (p = ${String(p).replace(".", ",")}). La tabla describe este torneo; no ordena los modelos por calidad.`);
    expect(textoSignificacion(t, "en")).toContain(`even winning all 5 pairings would not reach p < ${T.alfa} (p = ${p})`);
    expect(textoSignificacion({ participantes: TRES.map(x => par(x)) }, "en")).toContain(`(p = ${pMinimaTorneo(3)})`);
  });
});

describe("059 · micro-USD y reservas (§ 15.1, § 15.9)", () => {
  const astra = { entrada: 10, salida: 50, cache: 1 }, sol = { entrada: 2, salida: 10, cache: 0.2 };
  it("Astra con 9.240 de entrada y 441 de salida sin caché: 92.400 + 22.050 = 114.450 µUSD", () => {
    expect(microCostoUso({ entrada: 9240, salida: 441, cache: 0 }, astra)).toBe(114_450);
  });
  it("con caché: 10.000 de entrada (2.000 en caché) y 500 de salida a precio de Sol: 8.000×2 + 2.000×0,2 + 500×10 = 21.400 µUSD", () => {
    expect(microCostoUso({ entrada: 10_000, salida: 500, cache: 2_000 }, sol)).toBe(21_400);
  });
  it("N6 · redondeo al alza: 1 token de entrada a 0,2 USD/1M es 0,2 µUSD → 1", () => {
    expect(microCostoUso({ entrada: 1, salida: 0, cache: 0 }, { entrada: 0.2, salida: 0, cache: null })).toBe(1);
  });
  it("N4 · un intento sin usage vale microMaxIntento: Astra con P = 9.928 → (ceil(9.928×1,25) + 2.048 + 512)×10 + 2.048×50 = 252.100 µUSD", () => {
    expect(microMaxIntento(astra, 9928)).toBe(252_100);
    expect(costoLadoMicro({ entrada: 0, salida: 0, cache: 0, sinUso: 1 }, astra, 9928)).toBe(252_100);
    expect(costoLadoMicro({ entrada: 9240, salida: 441, cache: 0, sinUso: 2 }, astra, 9928)).toBe(114_450 + 2 * 252_100);
  });
  it("N5 · reserva del partido Astra–Sol con los reintentos HTTP: (252.100 + 50.420) × 4 rondas × 2 × 3 = 7.260.480 µUSD", () => {
    expect(microMaxIntento(sol, 9928)).toBe(50_420);
    expect(reservaPartido({ local: astra, visita: sol }, 9928, 4)).toBe(7_260_480);
  });
  it("N7 · libro: por intento cuenta el cierre; una reserva sin cierre cuenta entera", () => {
    expect(gastoConocido([
      { n: 1, intento: 1, tipo: "reserva", microUsd: 100 }, { n: 1, intento: 1, tipo: "cierre", microUsd: 40, resultado: "valido" },
      { n: 2, intento: 1, tipo: "reserva", microUsd: 70 },
    ])).toBe(110);
  });
});

describe("059 · causa terminal exhaustiva (§ 16.2)", () => {
  const ultimos = ["ok", "reintentable", "red", "http_otro", "abortado", "ninguno"] as const;
  const intentosCon = (u: (typeof ultimos)[number], previos: ("reintentable" | "ok")[] = []) => [...previos, ...(u === "ninguno" ? [] : [u])].map(naturaleza => ({ naturaleza }));
  it("las 3 × 6 combinaciones tienen el resultado esperado, escrito literalmente", () => {
    const esperado: Record<string, Record<string, string>> = {
      orden_invalida: { ok: "modelo", reintentable: "modelo", red: "modelo", http_otro: "modelo", abortado: "modelo", ninguno: "modelo" },
      error_controlador: { ok: "modelo", reintentable: "infraestructura", red: "infraestructura", http_otro: "infraestructura", abortado: "infraestructura", ninguno: "infraestructura" },
      plazo_agotado: { ok: "modelo", reintentable: "infraestructura", red: "infraestructura", http_otro: "infraestructura", abortado: "modelo", ninguno: "infraestructura" },
    };
    for (const motivo of ["orden_invalida", "error_controlador", "plazo_agotado"] as const) for (const u of ultimos) expect([motivo, u, causaTerminal(motivo, intentosCon(u))]).toEqual([motivo, u, esperado[motivo]![u]]);
    expect(causaTerminal("valida", [])).toBeNull();
  });
  it("N2 · 429 → 200 inválido: el último intento es ok, así que la causa es el modelo", () => {
    expect(causaTerminal("error_controlador", intentosCon("ok", ["reintentable"]))).toBe("modelo");
  });
  it("N3/N17 · plazo agotado: abortado sin 429 ni red ni esperas = modelo (lento); con 429 previo o espera = infraestructura", () => {
    expect(causaTerminal("plazo_agotado", intentosCon("abortado"))).toBe("modelo");
    expect(causaTerminal("plazo_agotado", intentosCon("abortado", ["reintentable"]))).toBe("infraestructura");
    expect(causaTerminal("plazo_agotado", intentosCon("abortado"), [{ ronda: 1 }])).toBe("infraestructura");
    expect(causaTerminal("plazo_agotado", intentosCon("reintentable"), [{ ronda: 1 }])).toBe("infraestructura");
  });
});

describe("059 · esquema estricto y coherencia (§ 15.6, M20, M21)", () => {
  it("el fixture de ensayo cumple el esquema y es coherente", () => {
    const t = esquemaTorneo.parse(torneoFixture());
    expect(validarCoherencia(t)).toEqual([]);
  });
  it("M20 · rechaza `clasificacion`, `tabla`, `totales` o cualquier campo agregado, también anidado", () => {
    const t = torneoFixture();
    for (const extra of [{ clasificacion: [] }, { tabla: [] }, { totales: {} }]) expect(esquemaTorneo.safeParse({ ...t, ...extra }).success).toBe(false);
    expect(esquemaTorneo.safeParse({ ...t, encuentros: [{ ...t.encuentros[0]!, puntos: 3 }, ...t.encuentros.slice(1)] }).success).toBe(false);
    expect(esquemaTorneo.safeParse({ ...t, gasto: { ...t.gasto, totalUsd: 0 } }).success).toBe(false);
    expect(esquemaTorneo.safeParse({ ...t, participantes: t.participantes.map(p => ({ ...p, rango: 1 })) }).success).toBe(false);
  });
  it("M21 · plan distinto de calendarioTorneo, huella repetida o gasto menor que la suma → incoherente", () => {
    const t = esquemaTorneo.parse(torneoFixture());
    const lados = { ...t, encuentros: t.encuentros.map(e => e.n === 2 ? { ...e, local: e.visita, visita: e.local } : e) };
    expect(validarCoherencia(lados).join()).toMatch(/P2: no coincide con calendarioTorneo/);
    const semilla = { ...t, encuentros: t.encuentros.map(e => e.n === 3 ? { ...e, seed: e.seed + 1 } : e) };
    expect(validarCoherencia(semilla).join()).toMatch(/P3: no coincide/);
    const huella = { ...t, encuentros: t.encuentros.map(e => e.n === 2 ? { ...e, archivoSha256: t.encuentros[0]!.archivoSha256 } : e) };
    expect(validarCoherencia(huella).join()).toMatch(/huellas de archivo repetidas/);
    const conCoste = { ...t, encuentros: t.encuentros.map(e => e.n === 1 ? { ...e, local: { ...e.local, declarado: { ...e.local.declarado, costoMicroUsd: 5 } } } : e) };
    expect(validarCoherencia(conCoste).join()).toMatch(/gasto conocido es menor/);
    expect(validarCoherencia({ ...t, estado: "incompleto" }).join()).toMatch(/estado incoherente/);
    expect(validarCoherencia({ ...t, encuentros: t.encuentros.slice(1) }).join()).toMatch(/no cubren el calendario/);
  });
});
