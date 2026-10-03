// Brief 016 — el mundo: países, ligas, calendario, temporada, tabla y goleadores.
// La tabla y los goleadores se comparan contra un ORÁCULO independiente que recuenta desde
// los eventos de cada partido re-simulado (no desde los resultados que arma temporada.ts).
import { describe, expect, it } from "vitest";
import { EQUIPOS_POR_LIGA, MUNDO_SEMILLA, N_PAISES, TEMPORADA_ACTUAL } from "../../analista/umbrales";
import {
  verificarCambiosYPeriodos,
  verificarContrato,
  verificarDesenlaces,
  verificarCondiciones,
  verificarEspacial,
  verificarExpulsados,
  verificarJugadores,
  verificarLesiones,
  verificarMinutos,
  verificarRelaciones,
  verificarSalidas,
} from "../../sim/invariantes";
import { simular } from "../../sim/motor";
import type { Partido } from "../../sim/tipos";
import { calendarioCirculo } from "../calendario";
import { crearMundo, mundo } from "../mundo";
import { goleadores, tablaDePosiciones } from "../tabla";
import { calendarioDeLiga, configDePartidoLiga, semillaDePartido, simularTemporada } from "../temporada";
import { CLIMAS, type PartidoLiga } from "../tipos";

const m = mundo();
const liga = m.ligas[0]!;
const temporada = simularTemporada(liga, TEMPORADA_ACTUAL);
const nombres = liga.equipos.map((e) => e.equipo.nombre);

// Los 90 partidos re-simulados por su cuenta, desde la config de liga (no desde `temporada`).
const simulados: { jornada: number; indice: number; p: Partido }[] = [];
calendarioDeLiga(liga).forEach((j, ji) =>
  j.forEach((_, ii) => simulados.push({ jornada: ji + 1, indice: ii + 1, p: simular(configDePartidoLiga(liga, TEMPORADA_ACTUAL, ji + 1, ii + 1)) })),
);

describe("016 · el mundo", () => {
  it("8 países con nombre único y perfil climático; los seis perfiles presentes", () => {
    expect(m.semilla).toBe(MUNDO_SEMILLA);
    expect(m.paises).toHaveLength(N_PAISES);
    expect(new Set(m.paises.map((p) => p.nombre)).size).toBe(N_PAISES);
    expect(new Set(m.paises.map((p) => p.id)).size).toBe(N_PAISES);
    for (const p of m.paises) expect(CLIMAS).toContain(p.clima);
    expect(new Set(m.paises.map((p) => p.clima))).toEqual(new Set(CLIMAS));
  });

  it("una liga por país, con nombre propio y 10 equipos que saben su país, su liga y su cancha", () => {
    expect(m.ligas).toHaveLength(N_PAISES);
    expect(new Set(m.ligas.map((l) => l.nombre)).size).toBe(N_PAISES);
    expect(m.ligas.map((l) => l.pais)).toEqual(m.paises.map((p) => p.id));
    for (const l of m.ligas) {
      expect(l.nombre).toMatch(/^Liga /);
      expect(l.equipos).toHaveLength(EQUIPOS_POR_LIGA);
      for (const e of l.equipos) {
        expect(e.liga).toBe(l.id);
        expect(e.pais).toBe(l.pais);
        expect(["natural", "sintetica"]).toContain(e.cancha.superficie);
        expect(["corto", "alto"]).toContain(e.cancha.cesped);
        expect(e.equipo.jugadores).toHaveLength(16);
      }
    }
  });

  it("ningún equipo ni jugador repetido en todo el mundo", () => {
    const equipos = m.ligas.flatMap((l) => l.equipos);
    expect(new Set(equipos.map((e) => e.equipo.nombre)).size).toBe(equipos.length);
    const jugadores = equipos.flatMap((e) => e.equipo.jugadores.map((j) => j.nombre));
    expect(new Set(jugadores).size).toBe(jugadores.length);
  });

  it("determinista: el mundo dos veces es el mismo, y otra semilla da otro mundo", () => {
    expect(JSON.stringify(crearMundo())).toBe(JSON.stringify(crearMundo(MUNDO_SEMILLA)));
    expect(JSON.stringify(crearMundo(MUNDO_SEMILLA + 1))).not.toBe(JSON.stringify(crearMundo()));
  });
});

describe("016 · calendario (algoritmo del círculo)", () => {
  const cal = calendarioDeLiga(liga);

  it("18 jornadas de 5 partidos; cada equipo juega una vez por jornada", () => {
    expect(cal).toHaveLength(18);
    for (const j of cal) {
      expect(j).toHaveLength(5);
      expect(new Set(j.flatMap((c) => [c.local, c.visita])).size).toBe(10);
    }
  });

  it("cada equipo: 18 partidos, 9 de local, exactamente 2 contra cada rival con la localía invertida", () => {
    const todos = cal.flat();
    for (let t = 0; t < 10; t++) {
      const suyos = todos.filter((c) => c.local === t || c.visita === t);
      expect(suyos).toHaveLength(18);
      expect(suyos.filter((c) => c.local === t)).toHaveLength(9);
      for (let r = 0; r < 10; r++) {
        if (r === t) continue;
        const vs = suyos.filter((c) => c.local === r || c.visita === r);
        expect(vs, `${t} vs ${r}`).toHaveLength(2);
        expect(vs.filter((c) => c.local === t)).toHaveLength(1);
      }
    }
  });

  it("funciona para otros tamaños pares y rechaza los impares", () => {
    for (const n of [2, 4, 6, 20]) {
      const c = calendarioCirculo(n);
      expect(c).toHaveLength(2 * (n - 1));
      expect(new Set(c.flat().map((x) => `${x.local}-${x.visita}`)).size).toBe(n * (n - 1));
    }
    expect(() => calendarioCirculo(9)).toThrow();
  });
});

describe("016 · semillaDePartido", () => {
  it("determinista, entera sin signo de 32 bits, y distinta en los 90 partidos de la temporada", () => {
    expect(semillaDePartido(liga.id, 1, 7, 3)).toBe(semillaDePartido(liga.id, 1, 7, 3));
    const semillas = simulados.map((s) => s.p.config.seed);
    expect(new Set(semillas).size).toBe(90);
    for (const s of semillas) expect(Number.isInteger(s) && s >= 0 && s <= 0xffffffff).toBe(true);
  });

  it("cambia con la liga, la temporada, la jornada y el índice", () => {
    const base = semillaDePartido(liga.id, 1, 7, 3);
    expect(semillaDePartido(m.ligas[1]!.id, 1, 7, 3)).not.toBe(base);
    expect(semillaDePartido(liga.id, 2, 7, 3)).not.toBe(base);
    expect(semillaDePartido(liga.id, 1, 8, 3)).not.toBe(base);
    expect(semillaDePartido(liga.id, 1, 7, 4)).not.toBe(base);
  });
});

describe("016 · temporada", () => {
  it("cada partido de liga es un partido normal: config estándar y contrato/invariantes del motor", () => {
    for (const { p } of simulados) {
      // Brief 018: la config estándar del 016 más sus condiciones (el brief 016 lo anunciaba).
      // Brief 019: más las lesiones encendidas y, si el registro las trae, las bajas.
      const claves = Object.keys(p.config).sort();
      expect(claves.filter((k) => k !== "bajas")).toEqual(["condiciones", "local", "seed", "variantes", "visita"]);
      const errores = [
        ...verificarContrato(p),
        ...verificarMinutos(p),
        ...verificarRelaciones(p),
        ...verificarExpulsados(p),
        ...verificarJugadores(p),
        ...verificarCambiosYPeriodos(p),
        ...verificarDesenlaces(p),
        ...verificarSalidas(p),
        ...verificarEspacial(p),
        ...verificarCondiciones(p),
        ...verificarLesiones(p),
      ];
      expect(errores, String(p.config.seed)).toEqual([]);
    }
  });

  it("determinista: la temporada completa dos veces es byte-idéntica (tabla y goleadores incluidos)", () => {
    expect(JSON.stringify(simularTemporada(liga, TEMPORADA_ACTUAL))).toBe(JSON.stringify(temporada));
    expect(JSON.stringify(simularTemporada(liga, TEMPORADA_ACTUAL + 1))).not.toBe(JSON.stringify(temporada));
  });

  it("los resultados son los del partido re-simulado", () => {
    expect(temporada.partidos).toHaveLength(90);
    temporada.partidos.forEach((r, i) => {
      const s = simulados[i]!;
      expect([r.jornada, r.indice, r.seed]).toEqual([s.jornada, s.indice, s.p.config.seed]);
      expect([r.local, r.visita]).toEqual([s.p.config.local.nombre, s.p.config.visita.nombre]);
    });
  });
});

// ---------------------------------------------------------------------------------
// ORÁCULO independiente. COPIA INDEPENDIENTE (deliberada) de la regla del brief: victoria 3,
// empate 1, derrota 0; desempate puntos → DG → GF → alfabético. No importa nada de tabla.ts.
// ---------------------------------------------------------------------------------
interface FilaOraculo {
  equipo: string;
  pj: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  gc: number;
  dg: number;
  pts: number;
}
function oraculoTabla(equipos: string[], marcadores: { local: string; visita: string; gl: number; gv: number }[]): FilaOraculo[] {
  const t: Record<string, FilaOraculo> = {};
  for (const e of equipos) t[e] = { equipo: e, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
  for (const x of marcadores) {
    const L = t[x.local]!;
    const V = t[x.visita]!;
    L.pj += 1;
    V.pj += 1;
    L.gf += x.gl;
    L.gc += x.gv;
    V.gf += x.gv;
    V.gc += x.gl;
    if (x.gl > x.gv) {
      L.g += 1;
      V.p += 1;
    } else if (x.gl < x.gv) {
      V.g += 1;
      L.p += 1;
    } else {
      L.e += 1;
      V.e += 1;
    }
  }
  const filas = Object.values(t).map((f) => ({ ...f, pts: 3 * f.g + 1 * f.e, dg: f.gf - f.gc }));
  return filas.sort((a, b) => {
    if (a.pts !== b.pts) return b.pts - a.pts;
    if (a.dg !== b.dg) return b.dg - a.dg;
    if (a.gf !== b.gf) return b.gf - a.gf;
    return a.equipo.localeCompare(b.equipo, "es");
  });
}

const marcadoresDeEventos = simulados.map(({ p }) => {
  let gl = 0;
  let gv = 0;
  for (const e of p.eventos) if (e.tipo === "gol") e.equipo === "local" ? gl++ : gv++;
  return { local: p.config.local.nombre, visita: p.config.visita.nombre, gl, gv };
});

describe("016 · oráculo de la tabla y de los goleadores", () => {
  it("la tabla de la temporada == recomputación independiente desde los eventos", () => {
    expect(temporada.tabla).toEqual(oraculoTabla(nombres, marcadoresDeEventos));
  });

  it("la temporada real ejercita los desempates (hay equipos igualados en puntos)", () => {
    const pts = temporada.tabla.map((f) => f.pts);
    expect(new Set(pts).size).toBeLessThan(pts.length);
  });

  it("casos a mano: empate vale 1, y el desempate va por DG, luego GF, luego nombre", () => {
    const eq = ["Delta", "Alfa", "Charlie", "Bravo"];
    const pl = (local: string, visita: string, gl: number, gv: number): PartidoLiga => ({
      jornada: 1, indice: 1, seed: 0, local, visita, golesLocal: gl, golesVisita: gv, goles: [],
    });
    // Alfa 4–1 Charlie, Alfa 0–0 Bravo, Bravo 2–1 Delta, Charlie 1–1 Delta. A mano:
    // Alfa 4 pts (DG +3), Bravo 4 (+1), Delta 1 (−1), Charlie 1 (−3) ⇒ la DG ordena a los iguales.
    const ps = [pl("Alfa", "Charlie", 4, 1), pl("Alfa", "Bravo", 0, 0), pl("Bravo", "Delta", 2, 1), pl("Charlie", "Delta", 1, 1)];
    const t = tablaDePosiciones(eq, ps);
    expect(t.map((f) => [f.equipo, f.pts, f.dg, f.gf])).toEqual([
      ["Alfa", 4, 3, 4],
      ["Bravo", 4, 1, 2],
      ["Delta", 1, -1, 2],
      ["Charlie", 1, -3, 2],
    ]);
    expect(t).toEqual(oraculoTabla(eq, ps.map((x) => ({ local: x.local, visita: x.visita, gl: x.golesLocal, gv: x.golesVisita }))));
    // Uno 3–3 Dos y Tres 1–1 Cuatro: los cuatro con 1 pt y DG 0 ⇒ GF manda (3 > 1) y, a igual
    // GF, el nombre: Dos, Uno, Cuatro, Tres.
    const gf = tablaDePosiciones(["Uno", "Dos", "Tres", "Cuatro"], [pl("Uno", "Dos", 3, 3), pl("Tres", "Cuatro", 1, 1)]);
    expect(gf.map((f) => [f.equipo, f.pts, f.dg, f.gf])).toEqual([
      ["Dos", 1, 0, 3],
      ["Uno", 1, 0, 3],
      ["Cuatro", 1, 0, 1],
      ["Tres", 1, 0, 1],
    ]);
  });

  it("goleadores == recuento independiente de los eventos gol", () => {
    const cuenta = new Map<string, number>();
    for (const { p } of simulados)
      for (const e of p.eventos)
        // Brief 020 (regla FIFA): el autogol no es del goleador — ni del autor ni del rival.
        if (e.tipo === "gol" && e.autogol !== true) {
          const k = `${(e.equipo === "local" ? p.config.local : p.config.visita).nombre}|${e.jugador}`;
          cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
        }
    const desdeTemporada = new Map(temporada.goleadores.map((g) => [`${g.equipo}|${g.jugador}`, g.goles]));
    expect(desdeTemporada).toEqual(cuenta);
    const total = [...cuenta.values()].reduce((a, b) => a + b, 0);
    const autogoles = simulados.reduce((n, { p }) => n + p.eventos.filter((e) => e.tipo === "gol" && e.autogol === true).length, 0);
    expect(total + autogoles).toBe(marcadoresDeEventos.reduce((s, x) => s + x.gl + x.gv, 0));
    // Orden: goles desc; el primero es el máximo.
    const g = temporada.goleadores;
    for (let i = 1; i < g.length; i++) expect(g[i - 1]!.goles).toBeGreaterThanOrEqual(g[i]!.goles);
    expect(g[0]!.goles).toBe(Math.max(...cuenta.values()));
  });

  it("goleadores() es pura: mismo resultado desde los resultados de la temporada", () => {
    expect(goleadores(temporada.partidos)).toEqual(temporada.goleadores);
  });
});
