// Brief 050 v1.1 · Celebración visual del gol (renderToStaticMarkup, como arena-cifras.test.tsx):
// golEnCelebracion con cota inferior, marcador con data-gol y rótulo estático. Ninguna cifra de
// CANTO_GOL ni ARENA se repite a mano.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EventoArena, RegistroArena } from "../../arena/tipos";
import { estadoVisual, golEnCelebracion } from "../../arena/vista";
import { ARENA, CANTO_GOL } from "../../sim/limites";
import { Arena } from "../Arena";
import { ArenaMarcador, ArenaRotuloGol } from "../ArenaCelebracion";

const leer = (ruta: string) => JSON.parse(readFileSync(ruta, "utf8")) as RegistroArena;
const v3 = leer("src/arena/__fixtures__/arena-reinicios-v3.json");
const ventana = CANTO_GOL.celebracionS / ARENA.pasoS;
const [g1, g2] = v3.eventos.filter(e => e.tipo === "gol") as [EventoArena, EventoArena];
const nombreDe = (r: RegistroArena, id: string) => [...r.inicial.jugadores, ...r.inicial.banco ?? []].find(j => j.id === id)!.nombre;
/** Tablero en el cursor `tick`: marcador y rótulo, como en Arena.tsx. */
const tablero = (r: RegistroArena, tick: number, idioma: "es" | "en" = "es") => {
  const gol = golEnCelebracion(r, tick), estado = estadoVisual(r, tick * ARENA.pasoS);
  return renderToStaticMarkup(<div><ArenaMarcador registro={r} estado={estado} gol={gol} /><div className="arena-pitch-wrap"><ArenaRotuloGol registro={r} gol={gol} idioma={idioma} /></div></div>);
};
const rotulo = (html: string) => html.match(/<p class="arena-goal-banner"[^>]*>.*?<\/p>/)?.[0] ?? null;

afterEach(() => { vi.useRealTimers(); });

describe("050 · golEnCelebracion", () => {
  it("en el tick del gol y hasta celebracionS − pasoS devuelve el gol; en celebracionS, null; antes del gol, null", () => {
    expect(g2.tick - g1.tick).toBeGreaterThan(ventana);
    expect(golEnCelebracion(v3, g1.tick)?.id).toBe(g1.id);
    expect(golEnCelebracion(v3, g1.tick + ventana - 1)?.id).toBe(g1.id);
    expect(golEnCelebracion(v3, g1.tick + ventana)).toBeNull();
    expect(golEnCelebracion(v3, g1.tick - 1)).toBeNull();
    expect(golEnCelebracion(v3, 0)).toBeNull();
    // El cursor real es fraccionario (segundos / pasoS): en el instante del gol ya celebra.
    expect(golEnCelebracion(v3, (g1.tick * ARENA.pasoS) / ARENA.pasoS)?.id).toBe(g1.id);
  });

  it("entre dos goles: el primero solo dentro de su ventana; con dos goles en ventana, el último; al retroceder, el primero", () => {
    expect(golEnCelebracion(v3, g1.tick + ventana + 1)).toBeNull();
    expect(golEnCelebracion(v3, g2.tick + 1)?.id).toBe(g2.id);
    const juntos = structuredClone(v3), cerca: EventoArena = { ...structuredClone(g2), id: "gol-cerca", tick: g1.tick + ventana / 2 };
    juntos.eventos = [...juntos.eventos, cerca].sort((a, b) => a.tick - b.tick);
    expect(golEnCelebracion(juntos, cerca.tick + 1)?.id).toBe(cerca.id);
    // Retroceso: desde después del segundo hasta dentro de la ventana del primero (sobre todos los eventos).
    expect(golEnCelebracion(juntos, g1.tick + 1)?.id).toBe(g1.id);
    // Un gol futuro (tick mayor que el cursor) nunca cuenta.
    expect(golEnCelebracion(juntos, cerca.tick - 1)?.id).toBe(g1.id);
  });
});

describe("050 · marcador y rótulo", () => {
  it("dentro de la celebración: data-gol con el lado, strong exactamente {l}–{v}, dos span y el rótulo con palabra, equipo y goleador", () => {
    for (const [gol, idioma] of [[g1, "es"], [g2, "en"]] as const) {
      const tick = gol.tick + 3, html = tablero(v3, tick, idioma), m = estadoVisual(v3, tick * ARENA.pasoS).marcador;
      expect(html).toContain(`<div class="arena-score" data-gol="${gol.lado}">`);
      expect(html).toMatch(new RegExp(`<strong class="tnum">${m.local}–${m.visita}</strong>`));
      expect(html.match(/<div class="arena-score"[^>]*>(.*?)<\/div>/)![1]!.match(/<span/g)).toHaveLength(2);
      const p = rotulo(html)!;
      expect(p).toContain(`data-lado="${gol.lado}"`);
      expect(p).toContain(`<span class="arena-goal-word">${idioma === "es" ? "Gol" : "Goal"}</span>`);
      expect(p).toContain(v3.config.partido[gol.lado].nombre); expect(p).toContain(nombreDe(v3, gol.jugador));
      expect(p).toContain('aria-live="polite"');
    }
  });

  it("M9 · el rótulo no lleva role (ni status): el tablero no suma otro getByRole(\"status\")", () => {
    const p = rotulo(tablero(v3, g1.tick))!;
    expect(p).not.toMatch(/\srole=/);
  });

  it("fuera de la celebración no hay rótulo ni data-gol, y el marcador conserva el marcado anterior", () => {
    for (const tick of [g1.tick - 1, g1.tick + ventana, 0]) {
      const html = tablero(v3, tick);
      expect(rotulo(html)).toBeNull(); expect(html).not.toContain("data-gol");
      const m = estadoVisual(v3, tick * ARENA.pasoS).marcador;
      expect(html).toContain(`<div class="arena-score"><span>${v3.config.partido.local.nombre}</span><strong class="tnum">${m.local}–${m.visita}</strong><span>${v3.config.partido.visita.nombre}</span></div>`);
    }
  });

  it("autogol: rótulo con plantillas.rotulo.autogol, el equipo beneficiado y el jugador de la propia puerta", () => {
    const r = structuredClone(v3), e = r.eventos.find(x => x.id === g1.id)!;
    const defensor = r.inicial.jugadores.find(j => j.lado !== e.lado && j.puesto !== "POR")!;
    e.autogol = true; e.jugador = defensor.id;
    for (const idioma of ["es", "en"] as const) {
      const p = rotulo(tablero(r, e.tick + 1, idioma))!;
      expect(p).toContain(`<span class="arena-goal-word">${CANTO_GOL.plantillas.rotulo.autogol[idioma]}</span>`);
      expect(p).toContain(r.config.partido[e.lado].nombre); expect(p).toContain(defensor.nombre);
    }
  });

  it("goleador ya sustituido (en el banco): el rótulo se muestra igual con su nombre", () => {
    const r = structuredClone(v3), e = r.eventos.find(x => x.id === g1.id)!;
    const j = r.inicial.jugadores.find(j => j.id === e.jugador)!;
    r.inicial.jugadores = r.inicial.jugadores.filter(x => x.id !== j.id); r.inicial.banco = [...r.inicial.banco ?? [], j];
    expect(rotulo(tablero(r, e.tick + 1))).toContain(j.nombre);
  });

  it("M11 · la celebración depende solo del cursor: después → nada; retroceso antes del gol → nada; dentro → rótulo; el reloj sin cursor no cambia nada", () => {
    vi.useFakeTimers();
    const despues = tablero(v3, g1.tick + ventana + 5), antes = tablero(v3, g1.tick - 5), dentro = tablero(v3, g1.tick + 5);
    expect(rotulo(despues)).toBeNull(); expect(rotulo(antes)).toBeNull(); expect(rotulo(dentro)).not.toBeNull();
    vi.advanceTimersByTime(CANTO_GOL.celebracionS * 1000 * 2);
    expect(tablero(v3, g1.tick + 5)).toBe(dentro);
    expect(tablero(v3, g1.tick - 5)).toBe(antes);
  });

  it("el primer render de la arena (tick 0) no muestra rótulo ni data-gol y conserva el marcador", () => {
    const html = renderToStaticMarkup(<Arena inicial={v3} />);
    expect(html).not.toContain("arena-goal-banner"); expect(html).not.toContain("data-gol");
    expect(html).toMatch(/<div class="arena-pitch-wrap"><svg /);
    expect(html).toMatch(/<strong class="tnum">\d+–\d+<\/strong>/);
  });
});

// P2 · Anillo del goleador en la cancha. El SSR de la arena arranca con el cursor en 0: un gol
// sintético en el tick 0 deja el tablero dentro de la celebración sin estado ni temporizadores.
describe("050 (P2) · ficha del goleador", () => {
  const conGolEnCero = (jugador?: string) => {
    const r = structuredClone(v3), e = { ...structuredClone(g1), id: "gol-cero", tick: 0, ...jugador ? { jugador } : {} };
    r.eventos = [e, ...r.eventos];
    return { r, e };
  };
  const fichas = (html: string) => [...html.matchAll(/<g data-testid="arena-player" data-player="([^"]+)"([^>]*)>(.*?)<\/g><\/g>/g)].map(m => ({ id: m[1]!, atributos: m[2]!, token: m[3]! }));

  it("data-gol solo en la ficha del goleador y el anillo como último hijo de su .arena-token", () => {
    const { r, e } = conGolEnCero(), html = renderToStaticMarkup(<Arena inicial={r} />);
    expect(html).toContain(`<div class="arena-score" data-gol="${e.lado}">`);
    const todas = fichas(html), goleador = todas.find(f => f.id === e.jugador)!;
    expect(todas.length).toBeGreaterThan(20);
    expect(goleador.atributos).toContain('data-gol="true"');
    expect(todas.filter(f => f.atributos.includes("data-gol"))).toHaveLength(1);
    expect(goleador.token).toMatch(/^<title>.*?<\/title><g class="arena-token"><circle class="arena-kit" r="1.9"><\/circle>/); // Brief 055: círculo base .arena-kit
    expect(goleador.token).toMatch(/<circle class="arena-goal-ring" r="3.2" aria-hidden="true"><\/circle>$/);
    expect(html.match(/arena-goal-ring/g)).toHaveLength(1);
    expect(html).toMatch(/<div class="arena-pitch-wrap"><p class="arena-goal-banner"/);
  });

  it("goleador fuera del campo (en el banco): rótulo sin anillo", () => {
    const suplente = v3.inicial.banco?.[0];
    expect(suplente).toBeDefined();
    const { r } = conGolEnCero(suplente!.id), html = renderToStaticMarkup(<Arena inicial={r} />);
    expect(rotulo(html)).toContain(suplente!.nombre);
    expect(html).not.toContain("arena-goal-ring"); expect(html).not.toMatch(/data-player="[^"]+" [^>]*data-gol/);
  });
});
