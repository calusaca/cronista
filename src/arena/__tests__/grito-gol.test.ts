// Brief 054 (v1.1) · Variedad del grito de gol: catálogo, condiciones desde el registro (remate por
// posición, golazo, tardío, empate, otro), prioridad, rotación determinista por semilla, modos, autogol
// y presupuesto. Ningún texto, rate, umbral ni tipo de CANTO_GOL se repite a mano: se leen del módulo
// de límites. Las reglas del catálogo (rate en [−30, −10], ≤ 23 caracteres, grafías rechazadas) son las
// del brief 054 § 5.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { ARENA, CANTO_GOL, MESA_ARENA } from "../../sim/limites";
import { RELATO_INTERVALOS } from "../protocolo";
import type { Lado } from "../../sim/tipos";
import { VOZ_BUFFER } from "../buffer";
import { crearConfigArena, crearEstadoArena } from "../motor";
import { cantoGol, catalogoGritos, condicionesGrito, construirRelato, golazo, golDeRemate, golTardio, gritosPartido, marcadorTrasGol, ordenGritos, situacionGol, type SituacionGol } from "../relato";
import type { EventoArena, RegistroArena, TipoEventoArena } from "../tipos";

const leer = (ruta: string) => JSON.parse(readFileSync(ruta, "utf8")) as RegistroArena;
const fixtures: Record<string, RegistroArena> = {
  ...Object.fromEntries(["v1", "v2", "v3", "v4"].map(v => [v, leer(`src/arena/__fixtures__/arena-reinicios-${v}.json`)])),
  duelo: leer("public/experimentos/arena-duelo-v3.json"),
  llm: leer("public/experimentos/arena-llm-v3.json"),
};
const idiomas = ["es", "en"] as const;
const G = catalogoGritos();
const textoDe = (clave: string, idioma: "es" | "en") => G.find(g => g.clave === clave)![idioma].texto;
const generales = G.filter(g => !g.condicion).map(g => g.clave);
const goles = (r: RegistroArena) => r.eventos.filter(e => e.tipo === "gol");
const otroLado = (l: Lado): Lado => l === "local" ? "visita" : "local";

// ── Registros sintéticos sobre v3 ────────────────────────────────────────────────────────────────
const base = fixtures.v3!;
const plantillaGol = base.eventos.find(e => e.tipo === "gol")!, plantillaTiro = base.eventos.find(e => e.tipo === "tiro")!;
const plantillaPase = base.eventos.find(e => e.tipo === "pase")!;
/** k-ésimo jugador de campo de `lado` en v3. */
const jugador = (lado: Lado, k = 0) => base.inicial.jugadores.filter(j => j.lado === lado && j.puesto !== "POR")[k]!.id;
/** Gol de `lado`, hacia la portería rival (hasta.x = largoM para el local, 0 para la visita). */
function gol(id: string, tick: number, lado: Lado, j = jugador(lado), profundidad = 5, extra: Partial<EventoArena> = {}): EventoArena {
  const linea = lado === "local" ? ARENA.largoM : 0, desdeX = lado === "local" ? linea - profundidad : linea + profundidad;
  return { ...structuredClone(plantillaGol), id, tick, lado, jugador: j, receptor: null, desde: { x: desdeX, y: 30 }, hasta: { x: linea, y: 34 }, ...extra };
}
/** `tiro` del goleador con el mismo origen que `g`, `antes` ticks antes. */
const tiro = (g: EventoArena, antes = 4, extra: Partial<EventoArena> = {}): EventoArena =>
  ({ ...structuredClone(plantillaTiro), id: `tiro-${g.id}`, tick: g.tick - antes, lado: g.lado, jugador: g.jugador, desde: { ...g.desde }, hasta: { ...g.hasta }, ...extra });
/** Evento de `tipo` de otro jugador del mismo lado, en `tick`. */
const evento = (tipo: TipoEventoArena, tick: number, lado: Lado, id = `${tipo}-${tick}`): EventoArena =>
  ({ ...structuredClone(plantillaPase), id, tick, tipo, lado, jugador: jugador(lado, 5), receptor: null });
function registro(eventos: EventoArena[], antes = { local: 0, visita: 0 }, seed?: number): RegistroArena {
  const r = structuredClone(base);
  r.inicial.marcador = { ...antes }; r.eventos = eventos;
  if (seed !== undefined) r.config.partido.seed = seed;
  return r;
}

const original = { golazoDesdeM: CANTO_GOL.golazoDesdeM };
afterEach(() => { (CANTO_GOL as { golazoDesdeM: number }).golazoDesdeM = original.golazoDesdeM; });

describe("054 · catálogo", () => {
  it("diez entradas, claves únicas, ES/EN con texto y rate entero en [−30, −10]; cinco generales; prioridades únicas con condición", () => {
    expect(G).toHaveLength(10);
    expect(new Set(G.map(g => g.clave)).size).toBe(G.length);
    for (const g of G) for (const idioma of idiomas) {
      expect(g[idioma].texto.trim().length, g.clave).toBeGreaterThan(0);
      expect(Number.isInteger(g[idioma].rate), g.clave).toBe(true);
      expect(g[idioma].rate).toBeGreaterThanOrEqual(-30); expect(g[idioma].rate).toBeLessThanOrEqual(-10);
    }
    expect(G.filter(g => !g.condicion)).toHaveLength(5);
    const conPrioridad = G.filter(g => g.prioridad !== undefined);
    for (const g of conPrioridad) expect(g.condicion, g.clave).toBeDefined();
    expect(new Set(conPrioridad.map(g => g.prioridad)).size).toBe(conPrioridad.length);
  });

  it("sin grafías rechazadas: «yyy», «lll», mayúsculas sostenidas, ni los rechazados del experimento; ≤ 23 caracteres", () => {
    const rechazados = ["¡Yyyy gooool!", "¡Goooolllll!", "Goooallll!", "¡GOOOL!", "GOOOAL!", "¡Guuuoooolll!", "Guuuoooal!", "¡Golaaaazo!", "¡Golazo!"];
    for (const g of G) for (const idioma of idiomas) {
      const t = g[idioma].texto;
      expect(t.toLowerCase()).not.toContain("yyy"); expect(t.toLowerCase()).not.toContain("lll");
      expect(t, t).not.toMatch(/\p{Lu}{2,}/u);
      expect(rechazados).not.toContain(t);
      expect(t.length, t).toBeLessThanOrEqual(23);
    }
  });
});

describe("054 · condición `remate` (v1.1, por posición en el registro)", () => {
  it("verdadera en los 9 goles de los fixtures v1–v4, duelo y arena-llm-v3 (con su reinicio detrás, que no cuenta)", () => {
    let n = 0;
    for (const [nombre, r] of Object.entries(fixtures)) for (const e of goles(r)) {
      n++;
      expect(golDeRemate(e, r), `${nombre} ${e.id}`).toBe(true);
    }
    expect(n).toBe(9);
    // Todos llevan un `reinicio` detrás en el mismo tick: la regla por intervalo de ticks los rechazaría.
    expect(Object.values(fixtures).flatMap(r => goles(r).map(g => r.eventos.slice(r.eventos.indexOf(g) + 1).some(e => e.tick === g.tick && e.tipo === "reinicio"))).every(Boolean)).toBe(true);
  });

  it("falsa sin `tiro`; falsa si el `tiro` del goleador tiene otro `desde` (M14); verdadera con el mismo", () => {
    const g = gol("g", 100, "local");
    expect(golDeRemate(g, registro([g]))).toBe(false);
    expect(golDeRemate(g, registro([tiro(g), g]))).toBe(true);
    expect(golDeRemate(g, registro([tiro(g, 4, { desde: { x: g.desde.x - 3, y: g.desde.y } }), g]))).toBe(false);
    expect(golDeRemate(g, registro([tiro(g, 4, { desde: { x: g.desde.x, y: g.desde.y + 2 } }), g]))).toBe(false);
  });

  it("M15 · falsa si entre los índices del `tiro` y del gol hay un evento de cualquier tipo de tiposQueRompen", () => {
    expect(CANTO_GOL.gritoRemate.tiposQueRompen.length).toBeGreaterThan(0);
    for (const tipo of CANTO_GOL.gritoRemate.tiposQueRompen) {
      const g = gol("g", 100, "local"), t = tiro(g);
      expect(golDeRemate(g, registro([t, evento(tipo, 98, otroLado(g.lado)), g])), tipo).toBe(false);
      // También en el mismo tick que el gol, si va antes en el registro (la regla es por posición).
      expect(golDeRemate(g, registro([t, evento(tipo, g.tick, "local"), g])), `${tipo} mismo tick`).toBe(false);
      // Detrás del gol (su reinicio, por ejemplo) nunca cuenta.
      expect(golDeRemate(g, registro([t, g, evento(tipo, g.tick, otroLado(g.lado))])), `${tipo} detrás`).toBe(true);
    }
  });

  it("verdadera si entre medias solo hay `plan_equipo` (o cambios); un gol de centro (su vuelo es un pase) no la cumple", () => {
    const g = gol("g", 100, "local"), t = tiro(g);
    expect(golDeRemate(g, registro([t, evento("plan_equipo", 98, "visita"), evento("plan_equipo", 99, "local"), evento("cambio", 99, "visita"), g]))).toBe(true);
    // Centro de otro jugador que cruza la línea: no hay tiro del goleador con el origen del gol.
    const centro = { ...evento("pase", 96, "local"), desde: { ...g.desde }, motivo: "centro" } as EventoArena;
    expect(golDeRemate(g, registro([centro, g]))).toBe(false);
  });

  it("el evento anterior más cercano del goleador debe ser el tiro: un tiro suyo más antiguo, tapado por otro evento suyo, no cuenta", () => {
    const g = gol("g", 100, "local"), t = tiro(g, 10);
    const recepcionPropia = { ...evento("recepcion", 95, "local"), jugador: g.jugador };
    expect(golDeRemate(g, registro([t, recepcionPropia, g]))).toBe(false);
  });
});

describe("054 · condición `golazo`", () => {
  it("verdadera en v1 a23 y duelo a14 (2 de 9 goles de los fixtures), falsa en v3 a10", () => {
    const si = Object.entries(fixtures).flatMap(([n, r]) => goles(r).filter(e => golazo(e, r)).map(e => `${n}:${e.id}`));
    expect(si).toEqual(["v1:a23", "duelo:a14"]);
    expect(golazo(fixtures.v3!.eventos.find(e => e.id === "a10")!, fixtures.v3!)).toBe(false);
  });

  it("umbral exacto en los dos lados: |hasta.x − desde.x| = golazoDesdeM sí, golazoDesdeM − 0,1 no", () => {
    for (const lado of ["local", "visita"] as const) {
      const exacto = gol("g", 100, lado, jugador(lado), CANTO_GOL.golazoDesdeM), corto = gol("g", 100, lado, jugador(lado), CANTO_GOL.golazoDesdeM - 0.1);
      expect(Math.abs(exacto.hasta.x - exacto.desde.x)).toBe(CANTO_GOL.golazoDesdeM);
      expect(golazo(exacto, registro([tiro(exacto), exacto])), lado).toBe(true);
      expect(golazo(corto, registro([tiro(corto), corto])), lado).toBe(false);
    }
  });

  it("falsa sin `remate` aunque la distancia cumpla", () => {
    const g = gol("g", 100, "local", jugador("local"), CANTO_GOL.golazoDesdeM + 5);
    expect(golazo(g, registro([g]))).toBe(false);
    expect(golazo(g, registro([tiro(g), evento("pase", 98, "local"), g]))).toBe(false);
  });

  it("M16 · lee CANTO_GOL.golazoDesdeM en tiempo de ejecución", () => {
    const v1 = fixtures.v1!, a23 = v1.eventos.find(e => e.id === "a23")!, v3 = fixtures.v3!, a10 = v3.eventos.find(e => e.id === "a10")!;
    expect(golazo(a23, v1)).toBe(true); expect(golazo(a10, v3)).toBe(false);
    (CANTO_GOL as { golazoDesdeM: number }).golazoDesdeM = Math.abs(a23.hasta.x - a23.desde.x) + 1;
    expect(golazo(a23, v1)).toBe(false);
    (CANTO_GOL as { golazoDesdeM: number }).golazoDesdeM = Math.abs(a10.hasta.x - a10.desde.x);
    expect(golazo(a10, v3)).toBe(true);
  });
});

describe("054 · condiciones `tardio`, `empate` y `otro`", () => {
  const g = CANTO_GOL.goleadaDesde;
  // Mismos marcadores (antes del gol de `lado`) que la tabla de situaciones del 050.
  const casos: { clave: SituacionGol; lado: Lado; antes: { local: number; visita: number } }[] = [
    { clave: "empate", lado: "local", antes: { local: 0, visita: 1 } },
    { clave: "empate", lado: "visita", antes: { local: 2, visita: 1 } },
    { clave: "recorte", lado: "local", antes: { local: 0, visita: 2 } },
    { clave: "recorte", lado: "visita", antes: { local: 3, visita: 1 } },
    { clave: "goleada", lado: "local", antes: { local: g - 1, visita: 0 } },
    { clave: "goleada", lado: "visita", antes: { local: 1, visita: g } },
    { clave: "ampliacion", lado: "local", antes: { local: g - 2, visita: 0 } },
    { clave: "apertura", lado: "local", antes: { local: 0, visita: 0 } },
    { clave: "apertura", lado: "visita", antes: { local: 0, visita: 0 } },
    { clave: "ventaja", lado: "local", antes: { local: 1, visita: 1 } },
    { clave: "ventaja", lado: "visita", antes: { local: 2, visita: 2 } },
  ];

  it("M22 · `otro` solo en ampliación y goleada; `empate` solo en empate (tabla del 050)", () => {
    expect(new Set(casos.map(c => c.clave)).size).toBe(6);
    for (const { clave, lado, antes } of casos) {
      const e = gol("g", 50, lado), r = registro([e], antes);
      expect(situacionGol(lado, marcadorTrasGol(r, e.tick))).toBe(clave);
      const c = condicionesGrito(e, r);
      expect(c.otro, `${clave} ${lado}`).toBe(clave === "ampliacion" || clave === "goleada");
      expect(c.empate, `${clave} ${lado}`).toBe(clave === "empate");
    }
  });

  it("`tardio` es la regla del 050: en el umbral sí, un tick antes no, con diferencia > tardioDiferenciaMax no", () => {
    const dur = base.config.duracionS;
    let t = Math.floor(CANTO_GOL.tardioDesdeFraccion * dur / ARENA.pasoS) - 2; while (t * ARENA.pasoS < CANTO_GOL.tardioDesdeFraccion * dur) t++;
    const d = CANTO_GOL.tardioDiferenciaMax;
    for (const { tick, antes, aplica } of [{ tick: t, antes: { local: 0, visita: 0 }, aplica: true }, { tick: t - 1, antes: { local: 0, visita: 0 }, aplica: false }, { tick: t, antes: { local: d, visita: 0 }, aplica: false }]) {
      const e = gol("g", tick, "local"), r = registro([e], antes);
      expect(condicionesGrito(e, r).tardio).toBe(aplica);
      expect(golTardio(tick, dur, marcadorTrasGol(r, tick))).toBe(aplica);
    }
  });
});

/** Primer tick «sobre el final» de v3 (calculado de CANTO_GOL, no escrito a mano). */
const tickTardio = () => { const dur = base.config.duracionS; let t = Math.floor(CANTO_GOL.tardioDesdeFraccion * dur / ARENA.pasoS) - 2; while (t * ARENA.pasoS < CANTO_GOL.tardioDesdeFraccion * dur) t++; return t; };
const prioridadDe = (clave: string) => G.find(g => g.clave === clave)!.prioridad!;

describe("054 · prioridad", () => {
  it("M17 · golazo+tardío+empate → golazo; el siguiente con tardío y empate → tardío; el siguiente con empate (tardío ya usado) → empate", () => {
    expect(prioridadDe("golazo")).toBeLessThan(prioridadDe("tardio")); expect(prioridadDe("tardio")).toBeLessThan(prioridadDe("empate"));
    const t = tickTardio();
    // Antes 0–1. g1 (local, remate desde fuera del área) 1–1; autogol que da 1–2; g2 2–2; autogol 2–3; g3 3–3.
    const g1 = gol("g1", t, "local", jugador("local", 0), CANTO_GOL.golazoDesdeM + 2);
    const a1 = gol("a1", t + 10, "visita", jugador("local", 3), 3, { autogol: true });
    const g2 = gol("g2", t + 20, "local", jugador("local", 1));
    const a2 = gol("a2", t + 30, "visita", jugador("local", 3), 3, { autogol: true });
    const g3 = gol("g3", t + 40, "local", jugador("local", 2));
    const r = registro([tiro(g1), g1, a1, g2, a2, g3], { local: 0, visita: 1 });
    expect(condicionesGrito(g1, r)).toMatchObject({ golazo: true, tardio: true, empate: true });
    expect(condicionesGrito(g2, r)).toMatchObject({ golazo: false, tardio: true, empate: true });
    expect(condicionesGrito(g3, r)).toMatchObject({ golazo: false, tardio: true, empate: true });
    const m = gritosPartido(r, "es");
    expect([m.get("g1"), m.get("g2"), m.get("g3")]).toEqual(["golazo", "tardio", "empate"]);
    expect(m.has("a1")).toBe(false); expect(m.has("a2")).toBe(false);
  });
});

/** Goles alternos sin remates: apertura, empate, ventaja, empate, … (todos antes de «sobre el final»). */
function alternos(n: number, seed?: number) {
  const eventos = Array.from({ length: n }, (_, k) => gol(`g${k + 1}`, 10 + 10 * k, k % 2 ? "visita" : "local", jugador(k % 2 ? "visita" : "local", k % 4)));
  return registro(eventos, { local: 0, visita: 0 }, seed);
}

describe("054 · rotación sin repetir hasta agotar", () => {
  it("M13 · ningún grito se repite hasta agotar los elegibles; `empate` en el primer gol que empata y no en el segundo; la segunda vuelta empieza de nuevo sin repetir", () => {
    const r = alternos(12), m = gritosPartido(r, "es"), seq = goles(r).map(e => m.get(e.id)!);
    const sit = goles(r).map(e => situacionGol(e.lado, marcadorTrasGol(r, e.tick)));
    expect(sit.slice(0, 4)).toEqual(["apertura", "empate", "ventaja", "empate"]);
    for (const e of goles(r)) expect(condicionesGrito(e, r)).toMatchObject({ remate: false, golazo: false, tardio: false, otro: false });
    // Elegibles: las cinco generales más `empate` en los goles que empatan. Primera vuelta = 6 goles.
    const orden = ordenGritos(r.config.partido.seed).filter(c => generales.includes(c));
    expect(seq[0]).toBe(orden[0]);
    expect(seq[1]).toBe("empate");
    expect(seq[3]).not.toBe("empate");
    expect(new Set(seq.slice(0, 6)).size).toBe(6);
    expect(new Set(seq.slice(0, 6))).toEqual(new Set([...generales, "empate"]));
    // Segunda vuelta: se vacía `usados` y vuelve a empezar por el orden del partido, sin repetir dentro.
    expect(seq[6]).toBe(orden[0]);
    expect(seq[7]).toBe("empate");
    expect(new Set(seq.slice(6, 12)).size).toBe(6);
    for (const k of [0, 2, 3, 4, 5]) expect(generales).toContain(seq[k]);
  });

  it("los gritos sin prioridad siguen el orden del partido (las generales y `remate`)", () => {
    const orden = ordenGritos(base.config.partido.seed);
    expect(new Set(orden)).toEqual(new Set(G.filter(g => g.prioridad === undefined).map(g => g.clave)));
    const r = alternos(1), m = gritosPartido(r, "en");
    expect(m.get("g1")).toBe(orden.find(c => generales.includes(c)));
  });
});

describe("054 · determinismo", () => {
  it("dos llamadas sobre el mismo registro dan el mismo mapa; el idioma no cambia la selección", () => {
    for (const r of [...Object.values(fixtures), alternos(12)]) {
      expect([...gritosPartido(r, "es")]).toEqual([...gritosPartido(structuredClone(r), "es")]);
      expect([...gritosPartido(r, "es")]).toEqual([...gritosPartido(r, "en")]);
    }
  });

  it("M19 · 20 semillas 5000–5019 con goles sintéticos idénticos: al menos dos órdenes distintos de las claves generales", () => {
    const secuencias = new Set(Array.from({ length: 20 }, (_, i) => {
      const r = alternos(5, 5000 + i), m = gritosPartido(r, "es");
      // Solo los goles que no empatan (apertura y ventajas): eligen siempre por el orden del partido.
      return goles(r).filter((_, k) => k % 2 === 0).map(e => m.get(e.id)).join(",");
    }));
    expect(secuencias.size).toBeGreaterThanOrEqual(2);
  });
});

describe("054 · modos y variantes", () => {
  const ventana = (tick: number, paso: number, fin: number) => { const d = Math.floor((tick - 1) / paso) * paso; return [d, Math.min(d + paso, fin)] as const; };

  it("vivo, completo y buffer (con y sin memoria) dan el mismo grito en el tramo 0; las cuatro variantes del goleador lo comparten", () => {
    let n = 0;
    for (const [nombre, r] of Object.entries(fixtures)) for (const e of goles(r)) for (const idioma of idiomas) {
      const clave = gritosPartido(r, idioma).get(e.id)!, texto = textoDe(clave, idioma);
      const vistos: { modo: string; grito?: string; texto: string }[] = [];
      for (const modo of ["vivo", "completo"] as const) {
        const [d, h] = ventana(e.tick, RELATO_INTERVALOS[modo], r.final.tick);
        const f = construirRelato(r, d, h, modo, idioma).fragmentos.find(f => f.canto && f.fuentes.includes(e.id))!;
        vistos.push({ modo, grito: f.canto!.tramos[0]!.grito, texto: f.canto!.tramos[0]!.texto });
      }
      const [d, h] = ventana(e.tick, RELATO_INTERVALOS.buffer, r.final.tick);
      const sin = construirRelato(r, d, h, "buffer", idioma).fragmentos[0]!;
      const con = construirRelato(r, d, h, "buffer", idioma, { memoria: [{ tick: e.tick, texto: sin.texto, estado: "completa" }] }).fragmentos[0]!;
      expect(con.texto).not.toBe(sin.texto);
      for (const [modo, f] of [["buffer", sin], ["buffer+memoria", con]] as const) vistos.push({ modo, grito: f.canto!.tramos[0]!.grito, texto: f.canto!.tramos[0]!.texto });
      for (const v of vistos) expect(v, `${nombre} ${e.id} ${idioma} ${v.modo}`).toEqual({ modo: v.modo, grito: clave, texto });
      for (let k = 0; k < 4; k++) expect(cantoGol(e, r, idioma, k)!.tramos[0]).toEqual({ texto, tipo: "grito", grito: clave });
      n++;
    }
    expect(n).toBeGreaterThanOrEqual(2 * 9);
  });

  it("dentro de cada fixture con dos goles, los gritos son distintos", () => {
    for (const r of Object.values(fixtures).filter(r => goles(r).length >= 2)) {
      const m = gritosPartido(r, "es");
      expect(new Set(goles(r).map(e => m.get(e.id))).size).toBe(goles(r).length);
    }
  });
});

describe("054 · autogol", () => {
  it("M21 · sin tramo `grito` y sin consumir grito: el siguiente gol normal recibe el primero del orden", () => {
    // Antes 2–0. Autogol de un visitante (3–0 para el local) y gol normal de la visita (3–1, «recorte»: sin condición).
    const propio = gol("a", 20, "local", jugador("visita", 1), 3, { autogol: true });
    const normal = gol("g", 40, "visita", jugador("visita", 0));
    const r = registro([propio, normal], { local: 2, visita: 0 });
    expect(situacionGol("visita", marcadorTrasGol(r, normal.tick))).toBe("recorte");
    const m = gritosPartido(r, "es");
    expect(m.has("a")).toBe(false);
    expect(m.get("g")).toBe(ordenGritos(r.config.partido.seed).find(c => generales.includes(c)));
    for (const idioma of idiomas) {
      const c = cantoGol(propio, r, idioma, 0)!;
      expect(c.tramos.map(t => t.tipo)).toEqual(["autogol", "hechos"]);
      expect(c.tramos.some(t => t.grito)).toBe(false);
      for (const g of G) expect(c.texto).not.toContain(g[idioma].texto);
    }
  });
});

describe("054 · presupuesto", () => {
  const plantillas = [
    ...Object.values(fixtures).map(r => ({ equipos: [r.config.partido.local.nombre, r.config.partido.visita.nombre], jugadores: [...r.inicial.jugadores, ...r.inicial.banco ?? []].map(j => j.nombre) })),
    ...Array.from({ length: 20 }, (_, i) => { const c = crearConfigArena({ seed: 5000 + i }), e = crearEstadoArena(c); return { equipos: [c.partido.local.nombre, c.partido.visita.nombre], jugadores: [...e.jugadores, ...e.banco ?? []].map(j => j.nombre) }; }),
  ];
  const masLargo = (xs: string[]) => xs.reduce((a, b) => b.length > a.length ? b : a);

  it("10 gritos × 4 variantes × situaciones × tardío × ES/EN con los nombres más largos caben en maxCaracteres; la estimación queda bajo duracionMaxS", () => {
    const equipo = masLargo(plantillas.flatMap(p => p.equipos)), nombre = masLargo(plantillas.flatMap(p => p.jugadores));
    const r0 = structuredClone(base);
    r0.fotogramas = []; r0.rondas = [];
    r0.config.duracionS = ARENA.duracionMaxS; r0.config.partido.local.nombre = equipo; r0.config.partido.visita.nombre = equipo;
    for (const j of r0.inicial.jugadores) j.nombre = nombre;
    const fin = Math.round(ARENA.duracionMaxS / ARENA.pasoS) - 1, temprano = Math.floor(CANTO_GOL.tardioDesdeFraccion * ARENA.duracionMaxS / ARENA.pasoS) - 1;
    const max = { es: 0, en: 0 }, largo = { es: "", en: "" }, situaciones = new Set<string>(), gritosVistos = new Set<string>();
    let tardios = 0;
    for (const lado of ["local", "visita"] as const) for (let l = 0; l <= 12; l++) for (let v = 0; v <= 12; v++) for (const tick of [fin, temprano]) {
      const e = gol("g", tick, lado), r = structuredClone(r0);
      r.inicial.marcador = { local: l, visita: v }; r.eventos = [e];
      const a = marcadorTrasGol(r, tick);
      situaciones.add(situacionGol(lado, a)); if (golTardio(tick, r.config.duracionS, a)) tardios++;
      for (const idioma of idiomas) for (let k = 0; k < 4; k++) {
        const c = cantoGol(e, r, idioma, k)!;
        expect(c.tramos[0]!.tipo).toBe("grito");
        for (const g of G) {
          gritosVistos.add(g.clave);
          const texto = [g[idioma].texto, ...c.tramos.slice(1).map(t => t.texto)].join(" ");
          if (texto.length > max[idioma]) { max[idioma] = texto.length; largo[idioma] = texto; }
        }
      }
    }
    for (const idioma of idiomas) expect(max[idioma], largo[idioma]).toBeLessThanOrEqual(CANTO_GOL.maxCaracteres);
    expect(situaciones.size).toBe(6); expect(tardios).toBeGreaterThan(0); expect(gritosVistos.size).toBe(G.length);
    expect(CANTO_GOL.maxCaracteres / MESA_ARENA.dialogo.caracteresPorSegundoVoz + CANTO_GOL.pausaFinalMs / 1000).toBeLessThan(VOZ_BUFFER.duracionMaxS);
    console.log(`054 · canto más largo con los nombres de la prueba («${equipo}», «${nombre}»): ES ${max.es} c, EN ${max.en} c (máximo ${CANTO_GOL.maxCaracteres}): «${largo.es}» / «${largo.en}»`);
  });
});
