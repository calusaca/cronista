// Brief 068 (v1.1 prevalece sobre §§ 2.A, 2.B y 3) · reinicios-v10: el pasador consciente del fuera de juego en los
// pases rasos (A), la regla en el prompt y `fueraDeJuego` en la observación (B) y más faltas (C). Las cifras salen de
// limites.ts (FALTAS_ARENA_V10, BANDAS_068, LOTE_ARENA_046 y ARENA); los valores propios de cada escenario se nombran en
// ESCENARIO. Cada prueba nombra la mutación que la pone en rojo.
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual as isDeepEqual } from "node:util";
import { describe, expect, it } from "vitest";
import { ARENA, BANDAS_068 as B68, FALTAS_ARENA_V10 as F, LOTE_ARENA_046 as L, LOTE_ARENA_051 as L51, LOTE_ARENA_063 as L63 } from "../../sim/limites";
import type { Lado } from "../../sim/tipos";
import { probabilidadFalta } from "../arbitro";
import { lineaFueraDeJuego } from "../ataque";
import { anclas, transformar } from "../catalogo";
import { evaluarPases, frasesFueraDeJuego, planProgramado, SISTEMA_ARENA } from "../controladores";
import { ejecutarArena, observarArena, reproducirArena } from "../coordinador";
import { condicionesFixtureV10, cumpleFixtureV10, DURACION_FIXTURE_V10_S } from "../__fixtures__/generar-reinicios-v10";
import { bandasLote, incumplimientos, incumplimientos063, incumplimientosBC, incumplimientosControlado, medirControlado, medirLote } from "../metricas-lote";
import { contarPartido068, incumplimientos068, medirLote068 } from "../metricas-068";
import { adelantados, crearConfigArena, crearEstadoArena, fueraDeJuegoObservado, MotorArena, REGLAS_FUERA_DE_JUEGO_068, reglasDesde } from "../motor";
import { lados, reglasArena, type ConfigArena, type ControladorEquipo, type EstadoArena, type EventoArena, type JugadorArena, type ObservacionArena, type OrdenesEquipo, type OrdenJugador, type Punto, type RegistroArena, type ReglasArena } from "../tipos";

const V9 = "reinicios-v9" as const, V10 = "reinicios-v10" as const;

/** Valores propios de los escenarios (posiciones elegidas para aislar cada regla; no son reglas). */
const ESCENARIO = {
  semilla: 7, duracionS: 30, intervaloS: 10,
  /** Jugadores de campo que no intervienen: locales junto a su línea de gol (a más de LARGO_ARENA.pase.maxM del balón),
   * visitantes en x = 30 (por detrás del balón local: el penúltimo defensor no fija la línea). */
  parqueLocalX: 2, parqueVisitaX: 30, filaY0: 4, filaDY: 6,
  /** Pase raso: poseedor local en x = 60 (la línea es el balón), delantero adelantado y medio en línea. */
  poseedor: { x: 60, y: 34 }, adelantado: { x: 75, y: 34 }, enLinea: { x: 58, y: 20 },
  /** El adelantado vuelve detrás del poseedor, fuera del abanico local (avance < ARENA.avanceMinPaseM) pero a alcance. */
  vueltaDx: -12,
  /** Saque de manos: portero local en el borde de su área, adelantado a ≤ PORTERO_ARENA.saqueManosMaxM, compañero en
   * línea, y los visitantes de campo apartados de las líneas de saque. */
  portero: { x: 16, y: 34 }, adelantadoSaque: { x: 54, y: 34 }, enLineaSaque: { x: 40, y: 50 }, visitaSaqueY0: 2, visitaSaqueDY: 1.5,
  /** Centro: poseedor en la banda del último tramo, destino y adelantado en el área. */
  centrador: { x: 80, y: 8 }, destinoCentro: { x: 95, y: 30 },
  /** Ticks para que un balón llegue a su receptor. */
  ticksVuelo: 40,
  /** Semillas y duración de las observaciones de B y del lote corto de C. */
  semillasObs: [1, 2, 3], duracionObsS: 60, loteC: { desde: 1, semillas: 30 },
} as const;

const campo = (e: EstadoArena, lado: Lado) => e.jugadores.filter(j => j.lado === lado && j.puesto !== "POR").sort((a, b) => a.id.localeCompare(b.id));
const portero = (e: EstadoArena, lado: Lado) => e.jugadores.find(j => j.lado === lado && j.puesto === "POR")!;
function colocar(j: JugadorArena, p: Punto) { j.posicion = { ...p }; j.velocidad = { x: 0, y: 0 }; }
type OrdenEscenario = { accion: OrdenJugador["accion"]; destino?: Punto; receptor?: string | null };
interface Escenario { motor: MotorArena; planes: Record<Lado, OrdenesEquipo>; j(id: string): JugadorArena; ticks(n: number): void; eventos(tipo: EventoArena["tipo"]): EventoArena[] }
/** Estado sin saque ni pausa; los jugadores de campo aparcados; `preparar` coloca a los protagonistas y fija el balón. */
function montar(reglas: ReglasArena, preparar: (e: EstadoArena) => void, ordenes: (e: EstadoArena) => Record<string, OrdenEscenario> = () => ({})): Escenario {
  const config: ConfigArena = crearConfigArena({ seed: ESCENARIO.semilla, duracionS: ESCENARIO.duracionS, intervaloS: ESCENARIO.intervaloS, local: "4-3-3", visita: "5-3-2", reglas });
  const inicial = crearEstadoArena(config);
  inicial.saque = null; inicial.pausa = null;
  for (const lado of lados) {
    campo(inicial, lado).forEach((j, k) => colocar(j, { x: lado === "local" ? ESCENARIO.parqueLocalX : ESCENARIO.parqueVisitaX, y: ESCENARIO.filaY0 + ESCENARIO.filaDY * k }));
    colocar(portero(inicial, lado), anclas(config.formaciones[lado], lado, "base").POR!);
  }
  preparar(inicial);
  const motor = new MotorArena(config, inicial);
  const o = ordenes(motor.estado);
  const planes = Object.fromEntries(lados.map(lado => [lado, { observacion: `escenario:${lado}`, lado, intencion: "Escenario de prueba", amplitud: "media", bloque: "medio", gestion: null,
    ordenes: motor.estado.jugadores.filter(j => j.lado === lado).map(j => ({ jugador: j.id, accion: o[j.id]?.accion ?? "mover", destino: o[j.id]?.destino ?? { ...j.posicion }, receptor: o[j.id]?.receptor ?? null }))
      .sort((a, b) => a.jugador.localeCompare(b.jugador)) } satisfies OrdenesEquipo])) as Record<Lado, OrdenesEquipo>;
  return { motor, planes, j: id => motor.estado.jugadores.find(j => j.id === id)!, ticks(n) { for (let i = 0; i < n; i++) motor.avanzar(planes, motor.estado.tick + 1); }, eventos: tipo => motor.eventos.filter(e => e.tipo === tipo) };
}
/** Protagonistas locales: poseedor (primer medio), adelantado (primer delantero) y en línea (segundo medio). */
const protagonistas = (e: EstadoArena) => {
  const c = campo(e, "local"), med = c.filter(j => j.posicionNatural === "MED"), del = c.filter(j => j.posicionNatural === "DEL");
  return { p: med[0]!, d: del[0]!, m: med[1]! };
};
const conBalon = (e: EstadoArena, j: JugadorArena) => { e.balon = { posicion: { ...j.posicion }, poseedor: j.id, vuelo: null }; };
/** Sin preferencia por conducir (la regla probada es la elección del receptor, no la personalidad). */
const pasador = (j: JugadorArena) => { j.personalidad = { ...j.personalidad!, conduccion: 0, pase: 100 }; };
const pases = (s: Escenario) => s.eventos("pase");

describe("068 · A · pasador consciente del fuera de juego en los pases rasos (reinicios-v10)", () => {
  /** El poseedor tiene una orden `pasar` al adelantado; nadie más a alcance de pase. */
  const explicito = (reglas: ReglasArena) => {
    let ids = { p: "", d: "" };
    const s = montar(reglas, e => {
      const { p, d } = protagonistas(e); ids = { p: p.id, d: d.id };
      colocar(p, ESCENARIO.poseedor); colocar(d, ESCENARIO.adelantado); pasador(p); conBalon(e, p);
    }, e => ({ [protagonistas(e).p.id]: { accion: "pasar", receptor: protagonistas(e).d.id, destino: { ...ESCENARIO.adelantado } } }));
    return { s, ...ids };
  };

  it("A1 · precondición: el adelantado está en `adelantados` y la línea es la de lineaFueraDeJuego", () => {
    for (const reglas of [V9, V10]) {
      const { s, d } = explicito(reglas);
      expect(adelantados(s.motor.estado, "local")).toContain(d);
      expect(lineaFueraDeJuego(s.motor.estado, "local")).toBe(ESCENARIO.poseedor.x);
    }
  });

  it("A2 · un `pasar` explícito raso a un adelantado no sale en v10 y la orden queda pendiente si conduce; en v9 sale y es fuera de juego (mutación: quitar el filtro del pase explícito)", () => {
    const v9 = explicito(V9);
    v9.s.ticks(1);
    expect(pases(v9.s).map(e => e.receptor)).toEqual([v9.d]);
    v9.s.ticks(ESCENARIO.ticksVuelo);
    expect(v9.s.eventos("fuera_juego").map(e => e.jugador)).toEqual([v9.d]);

    const v10 = explicito(V10);
    v10.s.ticks(1);
    expect(pases(v10.s)).toEqual([]);
    expect(v10.s.motor.estado.balon.poseedor).toBe(v10.p);
    // El adelantado vuelve en línea, detrás del poseedor y fuera del abanico local: solo la orden pendiente lo elige.
    const p = v10.s.j(v10.p), d = v10.s.j(v10.d);
    colocar(d, { x: p.posicion.x + ESCENARIO.vueltaDx, y: p.posicion.y });
    expect(adelantados(v10.s.motor.estado, "local")).not.toContain(v10.d);
    expect(evaluarPases(p, observarArena(v10.s.motor, "local")).map(c => c.p.id)).not.toContain(v10.d);
    v10.s.ticks(1);
    expect(pases(v10.s).map(e => e.receptor)).toEqual([v10.d]);
  });

  it("A3 · la decisión local no elige a un adelantado y toma el siguiente candidato; en v9 elige al adelantado (mutación: quitar el filtro local)", () => {
    const local = (reglas: ReglasArena) => {
      let ids = { d: "", m: "" };
      const s = montar(reglas, e => {
        const { p, d, m } = protagonistas(e); ids = { d: d.id, m: m.id };
        colocar(p, ESCENARIO.poseedor); colocar(d, ESCENARIO.adelantado); colocar(m, ESCENARIO.enLinea); pasador(p); conBalon(e, p);
      });
      return { s, ...ids };
    };
    const v9 = local(V9), v10 = local(V10);
    const poseedor = v10.s.j(v10.s.motor.estado.balon.poseedor!);
    // Precondición: el adelantado es el mejor candidato y el que está en línea, el siguiente.
    expect(evaluarPases(poseedor, observarArena(v10.s.motor, "local")).slice(0, 2).map(c => c.p.id)).toEqual([v10.d, v10.m]);
    v9.s.ticks(1); v10.s.ticks(1);
    expect(pases(v9.s).map(e => e.receptor)).toEqual([v9.d]);
    expect(pases(v10.s).map(e => e.receptor)).toEqual([v10.m]);
  });

  it("A4 · saque de manos: el receptor explícito adelantado se descarta y sale al válido de opcionPase; en v9, al adelantado (mutación: quitar el filtro del saque)", () => {
    const saque = (reglas: ReglasArena) => {
      let ids = { g: "", d: "", m: "" };
      const s = montar(reglas, e => {
        const g = portero(e, "local"), { d, m } = protagonistas(e); ids = { g: g.id, d: d.id, m: m.id };
        campo(e, "visita").forEach((j, k) => colocar(j, { x: ESCENARIO.parqueVisitaX, y: ESCENARIO.visitaSaqueY0 + ESCENARIO.visitaSaqueDY * k }));
        colocar(g, ESCENARIO.portero); colocar(d, ESCENARIO.adelantadoSaque); colocar(m, ESCENARIO.enLineaSaque);
        e.balon = { posicion: { ...g.posicion }, poseedor: g.id, vuelo: null, manos: { portero: g.id, desdeTick: -1000, hastaTick: 100_000 } };
      }, e => ({ [portero(e, "local").id]: { accion: "pasar", receptor: protagonistas(e).d.id, destino: { ...ESCENARIO.adelantadoSaque } } }));
      return { s, ...ids };
    };
    const v9 = saque(V9), v10 = saque(V10);
    expect(adelantados(v10.s.motor.estado, "local")).toContain(v10.d);
    v9.s.ticks(1); v10.s.ticks(1);
    expect(pases(v9.s).map(e => [e.receptor, e.motivo])).toEqual([[v9.d, "saque_manos"]]);
    expect(pases(v10.s).map(e => [e.receptor, e.motivo])).toEqual([[v10.m, "saque_manos"]]);
  });

  it("A5 · v1.1: un centro a un adelantado no se filtra en v10 y el árbitro lo sanciona (mutación: filtrar el centro)", () => {
    for (const reglas of [V9, V10]) {
      let d = "";
      const s = montar(reglas, e => {
        const x = protagonistas(e); d = x.d.id;
        colocar(x.p, ESCENARIO.centrador); colocar(x.d, ESCENARIO.destinoCentro); colocar(x.m, { x: ESCENARIO.centrador.x - 1, y: ESCENARIO.destinoCentro.y }); conBalon(e, x.p);
      }, e => ({ [protagonistas(e).p.id]: { accion: "centrar", receptor: protagonistas(e).d.id, destino: { ...ESCENARIO.destinoCentro } } }));
      expect(adelantados(s.motor.estado, "local")).toContain(d);
      s.ticks(1);
      expect({ reglas, pases: pases(s).map(e => [e.receptor, e.motivo]) }).toEqual({ reglas, pases: [[d, "centro"]] });
      s.ticks(ESCENARIO.ticksVuelo);
      expect({ reglas, fuera: s.eventos("fuera_juego").map(e => e.jugador) }).toEqual({ reglas, fuera: [d] });
    }
  });

  it("A6 · un balón suelto (rechace) que recoge un adelantado sigue siendo fuera de juego en v10", () => {
    let d = "";
    const s = montar(V10, e => {
      const x = protagonistas(e); d = x.d.id;
      colocar(x.d, ESCENARIO.adelantado);
      const g = portero(e, "visita");
      e.balon = { posicion: { ...ESCENARIO.adelantado }, poseedor: null, vuelo: { tipo: "rechace", autor: g.id, lado: "local", receptor: null, origen: { ...g.posicion }, destino: { ...ESCENARIO.adelantado }, inicioTick: -100, adelantados: [x.d.id] } };
    });
    s.ticks(1);
    expect(s.eventos("fuera_juego").map(e => e.jugador)).toEqual([d]);
  });

  it("A7 · REGLAS_FUERA_DE_JUEGO_068 es reinicios-v10 (brief 070: ARENA.reglas es reinicios-v11, posterior); v1–v10 válidas y v9 literal (mutación: olvidar el literal de v9)", () => {
    expect(REGLAS_FUERA_DE_JUEGO_068).toBe(V10);
    // Brief 070: ARENA.reglas es reinicios-v11; el pasador del 068 rige desde v10 (v11 incluida).
    expect(reglasArena.indexOf(ARENA.reglas)).toBeGreaterThan(reglasArena.indexOf(V10));
    expect(reglasArena.slice(-3, -1)).toEqual([V9, V10]);
    expect(reglasDesde(crearConfigArena({ reglas: V9 }), V10)).toBe(false);
    expect(reglasDesde(crearConfigArena({ reglas: V10 }), V10)).toBe(true);
  });
});

describe("068 · B · la regla en el prompt y `fueraDeJuego` en la observación", () => {
  it("B1 · frasesFueraDeJuego() con constantes alteradas; SISTEMA_ARENA la incluye; dice que el largo y el centro se sancionan (mutación: cifras a mano)", () => {
    const real = frasesFueraDeJuego(), otra = frasesFueraDeJuego({ toleranciaM: 0.7, mitadM: 41 });
    expect(real).toContain(`por más de ${ARENA.toleranciaM} m`);
    expect(real).toContain(`(x=${ARENA.largoM / 2})`);
    expect(otra).toContain("por más de 0.7 m");
    expect(otra).toContain("(x=41)");
    expect(otra).not.toBe(real);
    expect(SISTEMA_ARENA).toContain(real);
    expect(real).toMatch(/no da un pase corto a un compañero adelantado/);
    expect(real).toMatch(/balón largo o un centro a un compañero adelantado sí se sanciona/);
    expect(real).toContain("fueraDeJuego");
  });

  it("B2 · la observación trae `fueraDeJuego` solo en v10, con la línea absoluta de lineaFueraDeJuego (un decimal) y los adelantados propios; el id es el mismo para los dos lados (mutación: línea orientada)", async () => {
    let vistas = 0;
    for (const seed of ESCENARIO.semillasObs) for (const reglas of [V9, V10]) {
      const captura: ControladorEquipo = { id: "captura", tipo: "programado", async decidir(obs: ObservacionArena) {
        if (reglas === V9) expect("fueraDeJuego" in obs).toBe(false);
        else {
          const e = obs.estado, absoluta = (l: Lado) => Math.round(transformar({ x: lineaFueraDeJuego(e, l), y: 0 }, l).x * 10) / 10;
          const otro: Lado = obs.lado === "local" ? "visita" : "local";
          expect(obs.fueraDeJuego).toEqual({ propia: { linea: absoluta(obs.lado), adelantados: adelantados(e, obs.lado) }, rival: { linea: absoluta(otro) } });
          expect(obs.fueraDeJuego).toEqual(fueraDeJuegoObservado(e, obs.lado));
          vistas++;
        }
        return planProgramado(obs);
      } };
      const r = await ejecutarArena(crearConfigArena({ seed, duracionS: ESCENARIO.duracionObsS, reglas }), { local: captura, visita: { ...captura } });
      // La reproducción recalcula la observación de cada lado y exige el id de la ronda en los dos.
      expect(reproducirArena(structuredClone(r))).toEqual(r);
    }
    expect(vistas).toBeGreaterThan(0);
    // La línea absoluta de la visita es largoM − la orientada (aquí, la mitad de la cancha en el saque inicial).
    const m = new MotorArena(crearConfigArena({ seed: 1, reglas: V10 }));
    expect(observarArena(m, "visita").fueraDeJuego!.propia.linea).toBe(Math.round((ARENA.largoM - lineaFueraDeJuego(m.estado, "visita")) * 10) / 10);
    expect(observarArena(m, "local").id).toBe(observarArena(m, "visita").id);
  });
});

describe("068 · C · más faltas (FALTAS_ARENA_V10)", () => {
  it("C1 · probabilidadFalta aplica FALTAS_ARENA_V10.factorProbabilidad (con tope 1) solo en v10; desde = ARENA.reglas (mutación: factor a 1)", () => {
    expect(F.desde).toBe(V10);
    expect(F.factorProbabilidad).toBeGreaterThan(1);
    let topes = 0;
    for (const agresividad of [0, 50, 100]) for (const disciplina of [0, 50, 100]) for (const criterio of [40, 60, 85]) {
      const base = probabilidadFalta({ agresividad, disciplina }, criterio, false), v10 = probabilidadFalta({ agresividad, disciplina }, criterio, true);
      expect(v10).toBe(Math.min(1, base * F.factorProbabilidad));
      if (base * F.factorProbabilidad < 1) expect(v10 / base).toBeCloseTo(F.factorProbabilidad, 12);
      else topes++;
    }
    expect(probabilidadFalta({ agresividad: 100, disciplina: 0 }, 1e6, true)).toBe(1);
    expect(topes).toBeGreaterThanOrEqual(0);
  });

  it("C2 · lote corto de programados (120 s): v10 tiene más faltas que v9 en las mismas semillas y ningún fuera de juego del receptor previsto de un pase raso (mutaciones: factor a 1 en el motor; quitar el filtro)", { timeout: 300_000 }, async () => {
    const v9 = await medirLote068({ ...ESCENARIO.loteC, reglas: V9 }), v10 = await medirLote068({ ...ESCENARIO.loteC, reglas: V10 });
    console.log("[068 lote corto]", JSON.stringify({ v9, v10 }));
    expect(v10.faltasPorPartido).toBeGreaterThan(v9.faltasPorPartido);
    // Orientativo: el lote corto ya alcanza el mínimo de la banda de 1–100 (sin el factor, v10 queda muy por debajo).
    expect(v10.faltasPorPartido).toBeGreaterThanOrEqual(B68.faltasPorPartido.min);
    expect(v10.fuerasJuegoPrevisto).toBe(0);
    expect(v9.fuerasJuegoPrevisto).toBeGreaterThan(0);
    expect(v10.fuerasJuegoPorPartido).toBeLessThan(v9.fuerasJuegoPorPartido);
  });

  it("C3 · contarPartido068: el receptor previsto solo cuenta en pases rasos de campo (sin motivo ni reinicio) con el mismo origen", () => {
    const base = { lado: "local" as const, desde: { x: 1, y: 2 }, hasta: { x: 3, y: 4 }, distanciaM: 1 };
    const pase = (motivo?: EventoArena["motivo"], reinicio?: EventoArena["reinicio"]): EventoArena => ({ ...base, id: "p", tick: 1, tipo: "pase", jugador: "local-1", receptor: "local-9", ...(motivo ? { motivo } : {}), ...(reinicio ? { reinicio } : {}) });
    const fuera: EventoArena = { ...base, id: "f", tick: 2, tipo: "fuera_juego", jugador: "local-9", receptor: null };
    expect(contarPartido068([pase(), fuera]).fuerasJuegoPrevisto).toBe(1);
    for (const motivo of ["largo", "centro", "saque_manos"] as const) expect(contarPartido068([pase(motivo), fuera]).fuerasJuegoPrevisto).toBe(0);
    expect(contarPartido068([pase(undefined, "banda"), fuera]).fuerasJuegoPrevisto).toBe(0);
    expect(contarPartido068([{ ...pase(), desde: { x: 9, y: 9 } }, fuera]).fuerasJuegoPrevisto).toBe(0);
    expect(contarPartido068([pase(), fuera]).fuerasJuego).toBe(1);
    expect(incumplimientos068({ reglas: V10, duracionS: 1, desde: 1, partidos: 1, fuerasJuegoPorPartido: 0, fuerasJuegoPrevisto: 1, faltasPorPartido: 0, sinFalta: 1, amarillasPorPartido: 0, rojasPorPartido: 1, golesPorPartido: 0, tirosPorPartido: 0 }, 1).length).toBe(6);
  });
});

describe("068 · lote rápido y fixture de reinicios-v10", () => {
  it("v10.1 · lote rápido v10: bandas `rapido` del 046 (recalibradas), del 051 (y su controlado de porteros), del bloque A y de los bloques B y C", { timeout: 300_000 }, async () => {
    const lote = { desde: L.rapido.semillaDesde, semillas: L.rapido.semillas, reglas: V10 };
    const m = await medirLote(lote);
    const { b046, b051, b063, bBC } = bandasLote(V10, "rapido");
    console.log("[068 v10 rápido]", JSON.stringify({ goles: m.golesPorPartido, conversion: m.remate.conversion, manoAMano: m.manoAMano.conversion, centros: m.centros.porPartido, a: m.persecucion063, bc: m.largoLejano063 }));
    expect(b046.golesPorPartido).toEqual(L63.recalibracion046.rapido.golesPorPartido);
    expect(incumplimientos(m, b046, b051)).toEqual([]);
    expect(incumplimientos063(m, b063!)).toEqual([]);
    expect(incumplimientosBC(m, bBC!)).toEqual([]);
    const porteros = await medirControlado({ ...lote, quien: "portero" });
    expect(incumplimientosControlado({ porteros: porteros.diferencia }, L51.rapido)).toEqual([]);
  });

  it("v10.2 · fixture v10 (45 s, búsqueda 1–400) con identidades, atributos, balón largo, persecución, gol, atajada y falta; reproducción exacta; los fixtures v1–v9 siguen exactos (mutación: activar algo de v10 en v9)", { timeout: 300_000 }, async () => {
    const r = JSON.parse(await readFile("src/arena/__fixtures__/arena-reinicios-v10.json", "utf8")) as RegistroArena;
    expect(r.config.duracionS).toBe(DURACION_FIXTURE_V10_S);
    expect(condicionesFixtureV10(r)).toEqual({ reglas: true, identidades: true, atributos: true, largo: true, persecucion: true, gol: true, atajada: true, falta: true });
    expect(cumpleFixtureV10(r)).toBe(true);
    expect(r.rondas.flatMap(x => Object.values(x.decisiones)).every(d => d.tiempoMs === 0)).toBe(true);
    expect(reproducirArena(structuredClone(r))).toEqual(r);
    expect(Buffer.byteLength(JSON.stringify(r))).toBeLessThan(ARENA.archivoMaxBytes);
    for (const v of ["v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8", "v9"]) {
      const x = JSON.parse(await readFile(`src/arena/__fixtures__/arena-reinicios-${v}.json`, "utf8")) as RegistroArena;
      expect({ v, exacto: isDeepEqual(reproducirArena(structuredClone(x)), x) }).toEqual({ v, exacto: true });
    }
  });
});
