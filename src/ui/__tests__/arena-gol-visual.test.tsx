// Brief 057 § 5.2 y v1.1 § 8 · Vista frontal del arco (renderToStaticMarkup, como arena-canto-gol.test.tsx):
// atributos, entrada por la fase del cursor (no por el reloj), rótulo de altura ilustrativa, autogol, ausencia
// sin gol y el tablero del 050 intacto con la escena presente. Ninguna cifra de GOL_VISUAL ni ARENA a mano.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EventoArena, RegistroArena } from "../../arena/tipos";
import { estadoVisual, golEnCelebracion } from "../../arena/vista";
import { ARENA, GOL_VISUAL } from "../../sim/limites";
import { Arena } from "../Arena";
import { ArenaMarcador, ArenaRotuloGol, ArenaVistaArco } from "../ArenaCelebracion";

const leer = (ruta: string) => JSON.parse(readFileSync(ruta, "utf8")) as RegistroArena;
const v1 = leer("src/arena/__fixtures__/arena-reinicios-v1.json");
const a23 = v1.eventos.find(e => e.id === "a23")!;
const entrada = GOL_VISUAL.entradaRedS / ARENA.pasoS;
const vista = (gol: EventoArena | null, tick: number, idioma: "es" | "en" = "en", reducido = false) => renderToStaticMarkup(<ArenaVistaArco registro={v1} gol={gol} tick={tick} idioma={idioma} reducido={reducido} />);
const balon = (html: string) => { const m = /<circle class="arena-goal-view-ball" cx="([-\d.e]+)" cy="([-\d.e]+)" r="([-\d.e]+)"/.exec(html)!; return { cx: Number(m[1]), cy: Number(m[2]), r: Number(m[3]) }; };
const figcaption = (html: string) => /<figcaption>(.*?)<\/figcaption>/.exec(html)![1]!.replace(/<[^>]+>/g, "");

afterEach(() => { vi.useRealTimers(); });

describe("057 B2 · ArenaVistaArco", () => {
  it("gol v1 a23 (arco derecho, 16,6 m): data-arco visita, data-altura alta, data-lado; cx monótono hacia el destino y r creciente con el cursor", () => {
    const html = vista(a23, a23.tick);
    expect(html).toMatch(/^<figure class="arena-goal-view" data-testid="arena-goal-view" data-arco="visita" data-altura="alta" data-lado="local">/);
    const pasos = [0, entrada / 2, entrada, entrada * 3].map(d => balon(vista(a23, a23.tick + d)));
    const destino = pasos[2]!;
    expect(pasos[3]).toEqual(destino);
    for (let k = 1; k < 3; k++) {
      expect(Math.abs(destino.cx - pasos[k]!.cx)).toBeLessThanOrEqual(Math.abs(destino.cx - pasos[k - 1]!.cx));
      expect(pasos[k]!.r).toBeGreaterThan(pasos[k - 1]!.r);
      expect(pasos[k]!.cy).toBeLessThan(pasos[k - 1]!.cy);
    }
  });

  it("con movimiento reducido el primer render ya está en el destino", () => {
    expect(balon(vista(a23, a23.tick, "en", true))).toEqual(balon(vista(a23, a23.tick + entrada)));
  });

  it("figcaption con «illustrative»/«ilustrativa», el equipo que defiende y «lateral»; aria-label con la altura (M9)", () => {
    const defiende = v1.config.partido.visita.nombre;
    const en = figcaption(vista(a23, a23.tick)), es = figcaption(vista(a23, a23.tick, "es"));
    expect(en).toContain("illustrative"); expect(en).toContain(defiende); expect(en).toContain("lateral");
    expect(es).toContain("ilustrativa"); expect(es).toContain(defiende); expect(es).toContain("lateral");
    expect(vista(a23, a23.tick)).toMatch(/aria-label="Front view of [^"]*illustrative height \(high\)"/);
  });

  it("autogol → data-autogol y «Own goal»/«Autogol» en la figcaption; el arco sigue siendo el de hasta.x", () => {
    const autogol: EventoArena = { ...a23, lado: "visita", autogol: true };
    const html = vista(autogol, a23.tick);
    expect(html).toContain('data-autogol="true"'); expect(html).toContain('data-arco="visita"');
    expect(figcaption(html)).toMatch(/^Own goal · /);
    expect(figcaption(vista(autogol, a23.tick, "es"))).toMatch(/^Autogol · /);
  });

  it("sin gol no renderiza nada", () => {
    expect(vista(null, a23.tick)).toBe("");
  });

  it("M10 · la entrada depende del cursor, no del reloj: mismo tick con 5 s de reloj entre medias → markup idéntico", () => {
    vi.useFakeTimers();
    const antes = vista(a23, a23.tick + entrada / 3);
    vi.advanceTimersByTime(5000);
    expect(vista(a23, a23.tick + entrada / 3)).toBe(antes);
    expect(balon(vista(a23, a23.tick + entrada * 2 / 3)).cx).not.toBe(balon(antes).cx);
  });

  it("en la arena, con un gol en el tick 0: el recuadro aparece dentro de .arena-pitch-wrap tras la cancha y el tablero del 050 sigue idéntico", () => {
    const r = structuredClone(v1), e = { ...structuredClone(a23), id: "gol-cero", tick: 0 };
    r.eventos = [e, ...r.eventos];
    const html = renderToStaticMarkup(<Arena inicial={r} />);
    expect(html).toMatch(/<\/svg><figure class="arena-goal-view" data-testid="arena-goal-view" data-arco="visita"/);
    const gol = golEnCelebracion(r, 0), estado = estadoVisual(r, 0);
    // Tablero del 050: marcador con data-gol y el mismo strong, y el rótulo del gol con su lado (con o sin recuadro).
    const marcador = renderToStaticMarkup(<ArenaMarcador registro={r} estado={estado} gol={gol} />);
    expect(html).toContain(`<div class="arena-score" data-gol="${e.lado}">`);
    expect(html).toContain(/<strong class="tnum">[^<]+<\/strong>/.exec(marcador)![0]);
    expect(html).toContain(/<p class="arena-goal-banner" data-lado="[^"]+"/.exec(renderToStaticMarkup(<ArenaRotuloGol registro={r} gol={gol} idioma="en" />))![0]);
    expect(html).toContain('data-reconstruccion="red"');
  });
});
