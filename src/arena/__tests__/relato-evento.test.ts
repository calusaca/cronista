// Brief 060 v1.1 (3) · `construirRelato(…, "buffer", { evento })`: la pista al ritmo narra cada evento importante de
// una ventana con su propio clip. Sin `evento`, el resultado es byte a byte el de antes (huellas de HEAD 73eb279 sobre
// los tres registros de public/experimentos, todas las ventanas, los dos idiomas y memoria vacía y encadenada).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { construirRelato } from "../relato";
import { recordarVoz, type RecuerdoVoz } from "../editorial";
import { importantesVentana, planificarPista, type PiezaPlan } from "../plan-pista";
import { RELATO_INTERVALOS } from "../protocolo";
import { GestorSesiones } from "../sesiones";
import type { EventoArena, RegistroArena } from "../tipos";
import { POST as relatoHttp } from "../../app/api/arena/sesiones/[id]/relato/route";
import { PRIORIDAD_EVENTO_ARENA, REPETICION_NARRADA } from "../../sim/limites";

/** Interpretación 3 (coordinador): un evento elegido sin hecho narrable da un clip vacío, nunca un error. */
const simulacion = vi.hoisted(() => ({ sinHecho: null as string | null }));
vi.mock("../inteligencia", async original => {
  const m = await original<typeof import("../inteligencia")>();
  return { ...m, hechosArena: (...a: Parameters<typeof m.hechosArena>) => m.hechosArena(...a).filter(h => !simulacion.sinHecho || !h.eventos.includes(simulacion.sinHecho)) };
});

const B = RELATO_INTERVALOS.buffer;
/** El resultado del modo buffer (con tipoRelato, prioridad, claveVoz y temaVoz). */
type Buffer060 = Extract<ReturnType<typeof construirRelato>, { tipoRelato: unknown }>;
const buffer = (...a: Parameters<typeof construirRelato>) => construirRelato(...a) as Buffer060;
const leer = (f: string) => JSON.parse(readFileSync(join("public/experimentos", f), "utf8")) as RegistroArena;
const huellas = (JSON.parse(readFileSync("src/arena/__fixtures__/relato-buffer-060.json", "utf8")) as { huellas: Record<string, string> }).huellas;

describe("060 v1.1 (3) · sin `evento`, construirRelato(buffer) es byte a byte el de antes", () => {
  for (const f of ["arena-duelo-v3.json", "arena-llm-v3.json", "arena-llm-v1.json"]) it(f, () => {
    const r = leer(f);
    for (const idioma of ["es", "en"] as const) for (const cadena of [false, true]) {
      const h = createHash("sha256"); let memoria: RecuerdoVoz[] = [], ultima = 0;
      for (let d = 0; d < r.final.tick; d += B) {
        const x = buffer(r, d, Math.min(d + B, r.final.tick), "buffer", idioma, { memoria }); ultima = d;
        h.update(JSON.stringify(x));
        if (cadena && x.texto) memoria = recordarVoz(memoria, { tick: x.fragmentos[0]!.tick, texto: x.texto.slice(0, 500), clave: x.claveVoz, tema: x.temaVoz });
      }
      h.update(JSON.stringify(construirRelato(r, ultima, r.final.tick, "buffer", idioma, { cierre: true, memoria })));
      expect(h.digest("hex"), `${f}:${idioma}:${cadena}`).toBe(huellas[`${f}:${idioma}:${cadena ? "encadenada" : "vacia"}`]);
    }
  });
});

/** Registro sintético: el duelo con eventos inyectados (copias de su gol) en una ventana sin hechos importantes. */
function conEventos(nuevos: (gol: EventoArena) => EventoArena[]): RegistroArena {
  const r = leer("arena-duelo-v3.json"), gol = r.eventos.find(e => e.tipo === "gol")!;
  return { ...r, eventos: [...r.eventos, ...nuevos(gol)].sort((a, b) => a.tick - b.tick) };
}
/** Lo que hace la pista al ritmo en una ventana: la petición sin `evento` y una más por cada importante distinto. */
function peticionesVentana(r: RegistroArena, d: number, idioma: "es" | "en") {
  const h = d + B, primera = buffer(r, d, h, "buffer", idioma);
  const narrado = primera.tipoRelato === "jugada" ? primera.fuentes[0] : undefined;
  const extras = importantesVentana(r, d, h).filter(e => e.id !== narrado).map(e => buffer(r, d, h, "buffer", idioma, { evento: e.id }));
  return [primera, ...extras];
}

describe("060 v1.1 (3) · varios hechos importantes en una ventana", () => {
  it("dos goles en la misma ventana de 5 s: dos peticiones, dos clips colocados y ninguno omitido (M21)", () => {
    const d = 8 * B, r = conEventos(g => [{ ...g, id: "x1", tick: d + 10 }, { ...g, id: "x2", tick: d + 40 }]);
    expect(importantesVentana(r, d, d + B).map(e => e.id)).toEqual(["x1", "x2"]);
    const pedidas = peticionesVentana(r, d, "es");
    expect(pedidas).toHaveLength(2);
    expect(pedidas.map(s => s.fuentes[0]).sort()).toEqual(["x1", "x2"]);
    expect(pedidas.every(s => s.tipoRelato === "jugada" && s.prioridad === PRIORIDAD_EVENTO_ARENA.gol)).toBe(true);
    const piezas: PiezaPlan[] = pedidas.map((s, orden) => ({ id: s.fuentes[0]!, tipo: "narrador", tick: s.fragmentos[0]!.tick, duracionS: 3, prioridad: s.prioridad, orden }));
    const plan = planificarPista(piezas, r.final.tick);
    expect(plan.colocadas.map(c => c.id).sort()).toEqual(["x1", "x2"]); expect(plan.omitidas).toEqual([]);
  });

  it("gol + amarilla en la misma ventana: dos clips", () => {
    const d = 10 * B, r = conEventos(g => [{ ...g, id: "x3", tick: d + 10 }, { ...g, id: "x4", tipo: "amarilla", tick: d + 30, hasta: g.desde }]);
    expect(PRIORIDAD_EVENTO_ARENA.amarilla).toBeGreaterThanOrEqual(REPETICION_NARRADA.prioridadEspera);
    const pedidas = peticionesVentana(r, d, "en");
    expect(pedidas.map(s => s.fuentes[0])).toEqual(["x3", "x4"]);
    expect(pedidas.every(s => s.texto.length > 0)).toBe(true);
  });

  it("el duelo real ya tiene remate y gol en la misma ventana: la petición extra narra el remate", () => {
    const r = leer("arena-duelo-v3.json"), gol = r.eventos.find(e => e.tipo === "gol")!, d = Math.floor((gol.tick - 1) / B) * B;
    const pedidas = peticionesVentana(r, d, "es");
    expect(pedidas.map(s => r.eventos.find(e => e.id === s.fuentes[0])!.tipo)).toEqual(["gol", "tiro"]);
  });

  it("un evento fuera de la ventana, de prioridad < prioridadEspera o con cierre/entrada/otro modo: error (la ruta responde 400)", () => {
    const r = leer("arena-duelo-v3.json"), gol = r.eventos.find(e => e.tipo === "gol")!, d = Math.floor((gol.tick - 1) / B) * B;
    const menor = r.eventos.find(e => (PRIORIDAD_EVENTO_ARENA[e.tipo] ?? 0) < REPETICION_NARRADA.prioridadEspera && e.tick > d && e.tick <= d + B)!;
    expect(() => construirRelato(r, d, d + B, "buffer", "es", { evento: menor.id })).toThrow();
    expect(() => construirRelato(r, d + B, d + 2 * B, "buffer", "es", { evento: gol.id })).toThrow();
    expect(() => construirRelato(r, d, d + B, "buffer", "es", { evento: gol.id, entradaTick: d })).toThrow();
    expect(() => construirRelato(r, 200, 300, "completo", "es", { evento: gol.id })).toThrow();
  });

  it("interpretación 3 · un evento elegido sin hecho narrable da un clip vacío (silencio), no un error ni un comentario", () => {
    const r = leer("arena-duelo-v3.json"), gol = r.eventos.find(e => e.tipo === "gol")!, d = Math.floor((gol.tick - 1) / B) * B;
    simulacion.sinHecho = gol.id;
    try {
      const x = construirRelato(r, d, d + B, "buffer", "es", { evento: gol.id });
      expect(x.texto).toBe(""); expect(x.fragmentos).toEqual([]);
    } finally { simulacion.sinHecho = null; }
  });
});

describe("060 v1.1 (3) · ruta /relato con `evento`", () => {
  const compartido = globalThis as typeof globalThis & { __cronistaSesiones?: GestorSesiones };
  const previo = compartido.__cronistaSesiones, rutas: string[] = [];
  afterEach(async () => { compartido.__cronistaSesiones = previo; vi.unstubAllEnvs(); await Promise.all(rutas.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
  const pedir = (id: string, cuerpo: object) => relatoHttp(new Request("http://localhost/relato", { method: "POST", body: JSON.stringify(cuerpo) }), { params: Promise.resolve({ id }) });

  it("400 con prioridad insuficiente, fuera de buffer, con cierre o con intervención; el directo nunca lo envía", async () => {
    vi.stubEnv("ARENA_BLOB_ENDPOINT", ""); vi.stubEnv("ARENA_VOZ", "1");
    const directorio = await mkdtemp(join(tmpdir(), "cronista-060-")); rutas.push(directorio);
    const g = new GestorSesiones({ directorio, ritmoMsPorSegundo: 0 }); compartido.__cronistaSesiones = g;
    const { id } = await g.crear({ seed: 60, segundos: 10, local: "auto", visita: "auto", seleccion: { modo: "programado" }, presentacion: "preparada" });
    await g.esperarFinal(id);
    const { registro } = await g.reproduccion(id);
    const menor = registro.eventos.find(e => e.tick > 0 && e.tick <= B && (PRIORIDAD_EVENTO_ARENA[e.tipo] ?? 0) < REPETICION_NARRADA.prioridadEspera)!;
    expect(menor).toBeDefined();
    const base = { desdeTick: 0, hastaTick: B, idioma: "es", modo: "buffer" };
    expect((await pedir(id, { ...base, evento: menor.id })).status).toBe(400);
    expect((await pedir(id, { ...base, modo: "completo", hastaTick: 2 * B, evento: menor.id })).status).toBe(400);
    expect((await pedir(id, { ...base, desdeTick: Math.floor((registro.final.tick - 1) / B) * B, hastaTick: registro.final.tick, cierre: true, evento: menor.id })).status).toBe(400);
    expect((await pedir(id, { ...base, hastaTick: 0, intervencion: "previa:1-local:0", evento: menor.id })).status).toBe(400);
  }, 60_000);
});
