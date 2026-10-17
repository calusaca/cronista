import { describe, expect, it } from "vitest";
import { micro } from "../../sim/micro";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Evento, Partido } from "../../sim/tipos";
import { ACCIONES_POR_PAGINA, accionesCompletas, explicarAccion, exportarPartido, filtrarAcciones, nombreAccion, paginaDelMinuto, ubicacionAccion, type FiltroAcciones } from "../partido-completo";

const todos: FiltroAcciones = { periodo: "todos", equipo: "todos", tipo: "todos", buscar: "" };
const p = simular(configDeSemilla(246));
const m = micro(p);
const filas = accionesCompletas(p, m);

describe("029 · cobertura completa y orden causal", () => {
  it("conserva cada registro macro y micro exactamente una vez, sin mutar el partido", () => {
    for (const seed of [1, 7, 42, 246, 495, 1000]) {
      const partido = simular({ ...configDeSemilla(seed), variantes: { lesiones: true, autogoles: true, insolitos: true } });
      const capa = micro(partido);
      const antes = JSON.stringify({ partido, capa });
      const a = accionesCompletas(partido, capa);
      const ids = [...partido.eventos, ...capa.eventos].map((e) => e.id);
      expect(a).toHaveLength(ids.length);
      expect(new Set(a.map((x) => x.id))).toEqual(new Set(ids));
      expect(a.filter((x) => x.registro.capa === "macro").map((x) => x.id)).toEqual(partido.eventos.map((e) => e.id));
      expect(a.filter((x) => x.registro.capa === "micro").map((x) => x.id)).toEqual(capa.eventos.map((e) => e.id));
      expect(JSON.stringify({ partido, capa })).toBe(antes);
    }
  });

  it("cada pase/movimiento cae después del macro anterior y antes de su ancla, incluso al mismo minuto", () => {
    const posicion = new Map(filas.map((a, i) => [a.id, i]));
    for (const x of m.eventos) {
      const ancla = p.eventos.findIndex((e) => e.id === x.ancla);
      expect(posicion.get(x.id)!).toBeLessThan(posicion.get(x.ancla)!);
      if (ancla > 0) expect(posicion.get(x.id)!).toBeGreaterThan(posicion.get(p.eventos[ancla - 1]!.id)!);
    }
    expect(filas.map((a) => a.minuto)).toEqual(filas.map((a) => a.minuto).sort((a, b) => a - b));
  });

  it("distingue el cierre del primer tiempo y el inicio del segundo en el mismo 45′", () => {
    const fin = filas.find((a) => a.registro.evento.tipo === "fin_periodo")!;
    const inicio = filas.filter((a) => a.registro.evento.tipo === "inicio_periodo")[1]!;
    expect([fin.minuto, inicio.minuto]).toEqual([45, 45]);
    expect([fin.periodo, inicio.periodo]).toEqual([1, 2]);
    const segundo = filas.indexOf(inicio);
    expect(filas.slice(0, segundo).every((a) => a.periodo === 1)).toBe(true);
    expect(filas.slice(segundo).every((a) => a.periodo === 2)).toBe(true);
  });

  it("el detalle de un prefijo es exactamente el prefijo del detalle completo", () => {
    for (const k of [1, 7, 19, 35]) {
      const parcial = { config: p.config, eventos: p.eventos.slice(0, k) };
      const detalle = accionesCompletas(parcial);
      const hasta = filas.findIndex((a) => a.id === parcial.eventos.at(-1)!.id);
      expect(detalle).toEqual(filas.slice(0, hasta + 1));
    }
    expect(accionesCompletas({ config: p.config, eventos: [] })).toEqual([]);
  });

  it("el marcador solo cambia en el gol y conserva el 4–1 real de la portada", () => {
    expect(filas[0]!.marcador).toEqual({ local: 0, visita: 0 });
    const goles = filas.filter((a) => a.registro.evento.tipo === "gol");
    expect(goles.map((a) => a.marcador)).toEqual([{ local: 1, visita: 0 }, { local: 2, visita: 0 }, { local: 3, visita: 0 }, { local: 3, visita: 1 }, { local: 4, visita: 1 }]);
    filas.forEach((a, i) => { if (i > 0 && a.registro.evento.tipo !== "gol") expect(a.marcador).toEqual(filas[i - 1]!.marcador); });
    expect(filas.at(-1)!.marcador).toEqual({ local: 4, visita: 1 });
  });
});

describe("029 · explicación de los datos, ES/EN", () => {
  it("cada pase dice quién, receptor, distancia, resultado y zona/canal registrados", () => {
    const pases = filas.filter((a) => a.registro.capa === "micro" && a.registro.evento.tipo === "pase");
    expect(pases.some((a) => a.registro.capa === "micro" && a.registro.evento.completado === false)).toBe(true);
    for (const a of pases) {
      if (a.registro.capa !== "micro") throw new Error("Expected micro");
      for (const l of ["es", "en"] as const) {
        const texto = explicarAccion(a, p, l);
        const e = a.registro.evento;
        for (const dato of [e.jugador, e.receptor!, `${e.distanciaM} m`]) expect(texto).toContain(dato);
        expect(texto).toContain(l === "es" ? (e.completado ? "El pase llega" : "El pase no llega") : (e.completado ? "The pass reaches" : "The pass does not reach"));
        expect(ubicacionAccion(a, l)).not.toBe("");
      }
    }
  });

  it("conducciones, regates y duelos explican las magnitudes y el rival sin inventar segundos", () => {
    for (const a of filas.filter((x) => x.registro.capa === "micro")) {
      if (a.registro.capa !== "micro") continue;
      const e = a.registro.evento;
      const texto = explicarAccion(a, p, "es");
      if (e.tipo === "conduccion") expect(texto).toContain(`${e.distanciaM} m`);
      if (e.tipo === "regate" || e.tipo === "duelo") expect(texto).toContain(e.rival);
      expect(texto).not.toMatch(/\d+:\d\d|undefined|NaN/);
    }
  });

  it("no convierte un tiro en gol antes de que aparezca el registro del gol", () => {
    const tiro = p.eventos.find((e) => e.tipo === "tiro" && p.eventos.some((g) => g.tipo === "gol" && g.relacionadoCon === e.id))!;
    const i = p.eventos.indexOf(tiro);
    const parcial = { config: p.config, eventos: p.eventos.slice(0, i + 1) };
    const a = filas.find((x) => x.id === tiro.id)!;
    const b = accionesCompletas(parcial).at(-1)!;
    for (const l of ["es", "en"] as const) expect(explicarAccion(a, p, l)).toBe(explicarAccion(b, parcial, l));
  });

  it("una atajada pertenece al equipo defensor y usa el portero que entró de cambio", () => {
    const config = structuredClone(p.config);
    const viejo = config.visita.jugadores.find((j) => j.posicion === "POR")!.nombre;
    config.visita.jugadores[15] = { nombre: "Portero Relevo", dorsal: 31, posicion: "POR" };
    const partido: Partido = { config, eventos: [
      { id: "e000", tipo: "inicio_periodo", minuto: 0, equipo: "local" },
      { id: "e001", tipo: "cambio", minuto: 10, equipo: "visita", jugador: "Portero Relevo", sale: viejo },
      { id: "e002", tipo: "tiro", minuto: 11, equipo: "local", jugador: config.local.jugadores[9]!.nombre },
      { id: "e003", tipo: "atajada", minuto: 11, equipo: "local", relacionadoCon: "e002", zona: "ataque", ladoPortero: "su_derecha" },
    ] };
    const a = accionesCompletas(partido).at(-1)!;
    expect(a.equipo).toBe("visita");
    expect(explicarAccion(a, partido, "es")).toBe("Portero Relevo ataja el remate · a su derecha.");
    expect(explicarAccion(a, partido, "en")).toContain("Portero Relevo saves");
    expect(ubicacionAccion(a, "es")).toBe(""); // la zona del tiro no es la del portero
  });

  it("un autogol explica al autor y al beneficiado y suma al beneficiado", () => {
    const gol: Evento = { id: "e000", minuto: 4, tipo: "gol", equipo: "local", jugador: p.config.visita.jugadores[2]!.nombre, autogol: true };
    const partido: Partido = { config: p.config, eventos: [gol] };
    const a = accionesCompletas(partido).at(-1)!;
    expect(a.marcador).toEqual({ local: 1, visita: 0 });
    for (const l of ["es", "en"] as const) {
      const texto = explicarAccion(a, partido, l);
      expect(texto).toContain(p.config.visita.nombre);
      expect(texto).toContain(p.config.local.nombre);
      expect(texto).toContain(l === "es" ? "en propia puerta" : "own goal");
    }
  });

  it("cada tipo de macro, incluidos lesión, interrupción y subida del portero, tiene texto bilingüe", () => {
    const tipos: Evento["tipo"][] = ["inicio_periodo", "fin_periodo", "pase_clave", "tiro", "gol", "atajada", "falta", "tarjeta_amarilla", "tarjeta_roja", "corner", "fuera_de_juego", "cambio", "lesion", "subida_portero", "interrupcion"];
    for (const tipo of tipos) {
      const partido: Partido = { config: p.config, eventos: [{ id: "e000", tipo, minuto: 2, equipo: "local", jugador: p.config.local.jugadores[1]!.nombre, sale: p.config.local.jugadores[2]!.nombre, causa: "globos", duracion: 2, baja: 3 }] };
      const a = accionesCompletas(partido).at(-1)!;
      for (const l of ["es", "en"] as const) {
        expect(nombreAccion(a, l)).toBeTruthy();
        expect(explicarAccion(a, partido, l)).not.toMatch(/undefined|NaN/);
        expect(explicarAccion(a, partido, l).length).toBeGreaterThan(10);
      }
    }
  });
});

describe("029 · encontrar acciones y exportar todo", () => {
  it("sin filtros no descarta acciones; los filtros combinados coinciden con los datos", () => {
    expect(filtrarAcciones(filas, todos, p)).toEqual(filas);
    const segundo = p.eventos.filter((e) => e.tipo === "inicio_periodo")[1]!;
    const anclasSegundo = new Set(p.eventos.slice(p.eventos.indexOf(segundo)).map((e) => e.id));
    const esperados = m.eventos.filter((e) => e.tipo === "pase" && e.equipo === "visita" && anclasSegundo.has(e.ancla)).map((e) => e.id);
    expect(filtrarAcciones(filas, { ...todos, periodo: "2", equipo: "visita", tipo: "pase" }, p).map((a) => a.id)).toEqual(esperados);
  });

  it("encuentra receptores y rivales, ignorando mayúsculas y tildes", () => {
    const pase = m.eventos.find((e) => e.tipo === "pase" && e.receptor?.includes("í")) ?? m.eventos.find((e) => e.tipo === "pase")!;
    const buscar = pase.receptor!.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    expect(filtrarAcciones(filas, { ...todos, buscar }, p).map((a) => a.id)).toContain(pase.id);
    const duelo = m.eventos.find((e) => e.tipo === "duelo")!;
    expect(filtrarAcciones(filas, { ...todos, buscar: duelo.rival! }, p).map((a) => a.id)).toContain(duelo.id);
    expect(filtrarAcciones(filas, { ...todos, buscar: "Nombre inexistente" }, p)).toEqual([]);
  });

  it("el salto de minuto maneja los bordes de página, el final y un stream vacío", () => {
    const muestra = Array.from({ length: ACCIONES_POR_PAGINA * 2 + 1 }, (_, i) => ({ ...filas[0]!, id: `test-${i}`, minuto: i }));
    expect(paginaDelMinuto(muestra, 0)).toBe(0);
    expect(paginaDelMinuto(muestra, ACCIONES_POR_PAGINA - 1)).toBe(0);
    expect(paginaDelMinuto(muestra, ACCIONES_POR_PAGINA)).toBe(1);
    expect(paginaDelMinuto(muestra, ACCIONES_POR_PAGINA * 2)).toBe(2);
    expect(paginaDelMinuto(muestra, 999)).toBe(2);
    expect(paginaDelMinuto([], 5)).toBe(0);
  });

  it("el TXT contiene todos los IDs una vez y termina con el resultado final, en ambos idiomas", () => {
    for (const l of ["es", "en"] as const) {
      const txt = exportarPartido(p, filas, l, "aficionado");
      expect([...txt.matchAll(/^\[([^\]]+)\]/gm)].map((x) => x[1])).toEqual(filas.map((a) => a.id));
      expect(txt.trim().split("\n").at(-1)).toContain("4–1");
      expect(txt).toContain(l === "es" ? "sin segundos exactos ni movimientos sin balón" : "no exact seconds or off-ball tracking");
      expect(txt).not.toMatch(/undefined|NaN/);
    }
  });
});
