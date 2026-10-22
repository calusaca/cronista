// Brief 055 (v1.1) · Escudos, equipaciones por partido, anillos de la ficha y emblema, con
// renderToStaticMarkup (como arena-canto-gol.test.tsx). Ninguna cifra de IDENTIDAD_ARENA se repite.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { identidadClub, identidadPartido, type Forma, type IdentidadClub, type Patron } from "../../arena/identidad";
import type { EventoArena, RegistroArena } from "../../arena/tipos";
import { estadoVisual } from "../../arena/vista";
import { IDENTIDAD_ARENA } from "../../sim/limites";
import { Arena } from "../Arena";
import { ArenaMarcador } from "../ArenaCelebracion";
import { EmblemaCronista, TRAZOS_EMBLEMA } from "../Emblema";
import { Escudo } from "../Escudo";
import { ArenaCifras } from "../ArenaCifras";
import { ArenaDescripcion } from "../ArenaDescripcion";
import { claseIcono, iconoDeCifra, IconoEventoArena, type ClaseIcono } from "../IconosArena";
import { ETIQUETAS_CIFRAS } from "../../arena/estadisticas";
import { ESTADISTICAS_ARENA } from "../../sim/limites";
import type { TipoEventoArena } from "../../arena/tipos";

const leer = (ruta: string) => JSON.parse(readFileSync(ruta, "utf8")) as RegistroArena;
const v3 = leer("src/arena/__fixtures__/arena-reinicios-v3.json");
const CSS = readFileSync("src/app/globals.css", "utf8");
const tokenClaro = (nombre: string) => {
  const i = CSS.indexOf(":root:has(main.arena-shell) {"), cuerpo = CSS.slice(i, CSS.indexOf("}", i));
  const m = new RegExp(`${nombre}:\\s*(#[0-9a-f]{6});`, "i").exec(cuerpo);
  if (!m) throw new Error(`Falta ${nombre}`);
  return m[1]!.toLowerCase();
};
const svgs = (html: string) => html.match(/<svg[^>]*class="arena-crest[^"]*"[^>]*>.*?<\/svg>/g) ?? [];
const conForma = (i: IdentidadClub, forma: Forma, patron: Patron): IdentidadClub => ({ ...i, forma, patron });

describe("055 · Escudo", () => {
  const local = identidadClub(v3.config.partido.local.nombre), visita = identidadClub(v3.config.partido.visita.nombre);
  it("los dos clubes del fixture: aria-hidden, data-kit/patrón/forma, iniciales, clipPath con id distinto y sin <title>", () => {
    const html = renderToStaticMarkup(<div><Escudo identidad={local} /><Escudo identidad={visita} /></div>);
    const [a, b] = svgs(html);
    expect(a && b).toBeTruthy();
    for (const [s, i] of [[a!, local], [b!, visita]] as const) {
      expect(s).toContain('aria-hidden="true"');
      expect(s).toContain('focusable="false"');
      expect(s).toContain(`data-kit="${i.principal.id}"`);
      expect(s).toContain(`data-patron="${i.patron}"`);
      expect(s).toContain(`data-forma="${i.forma}"`);
      expect(s).toContain(`>${i.iniciales}</text>`);
      expect(s).not.toContain("<title");
      // Escudo permanente (v1.1 § 11): forma y campo en la principal, contorno e iniciales en su tinta.
      expect(s).toMatch(new RegExp(`class="arena-crest-forma"[^>]*fill="${i.principal.fondo}"`));
      expect(s).toMatch(new RegExp(`class="arena-crest-campo"[^>]*fill="${i.principal.fondo}"`));
      expect(s).toMatch(new RegExp(`class="arena-crest-contorno"[^>]*stroke="${i.principal.tinta}"`));
      expect(s).toMatch(new RegExp(`class="arena-crest-iniciales"[^>]*fill="${i.principal.tinta}"`));
    }
    const ids = [...html.matchAll(/<clipPath id="([^"]+)"/g)].map(m => m[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(html).toContain(`clip-path="url(#${id})"`);
  });

  it("liso no emite elementos de patrón; los demás emiten 1–3 en la segunda equipación; el campo existe en las tres formas", () => {
    const n = { liso: 0, rayas: 3, mitades: 1, banda: 1, aros: 2 } as const;
    for (const forma of IDENTIDAD_ARENA.formas) for (const patron of IDENTIDAD_ARENA.patrones) {
      const i = conForma(local, forma, patron), s = renderToStaticMarkup(<Escudo identidad={i} />);
      expect((s.match(/class="arena-crest-patron"/g) ?? []).length, `${forma}/${patron}`).toBe(n[patron]);
      for (const m of s.matchAll(/class="arena-crest-patron"[^>]*fill="([^"]+)"/g)) expect(m[1]).toBe(i.alternativa.fondo);
      expect(s.match(/class="arena-crest-campo"/g)).toHaveLength(1);
      expect(s.match(/class="arena-crest-contorno"/g)).toHaveLength(1);
    }
  });
});

describe("055 · arena con identidad", () => {
  it("main lleva en style exactamente las 10 variables; el marcador tiene dos escudos aria-hidden con data-kit distintos", () => {
    const html = renderToStaticMarkup(<Arena inicial={v3} />);
    const style = /<main class="arena-shell"[^>]*style="([^"]*)"/.exec(html)?.[1];
    expect(style).toBeDefined();
    const vars = Object.fromEntries(style!.split(";").filter(Boolean).map(d => d.split(":").map(x => x.trim()) as [string, string]));
    const id = identidadPartido(v3.config.partido.local.nombre, v3.config.partido.visita.nombre);
    expect(vars).toEqual(id.variables);
    expect(Object.keys(vars)).toHaveLength(10);
    const marcador = /<div class="arena-score"[^>]*>(.*?)<strong/.exec(html)![0] + /<strong class="tnum">.*?<\/strong>(.*?)<\/div>/.exec(html)![1];
    const escudos = svgs(marcador);
    expect(escudos).toHaveLength(2);
    expect(escudos.every(s => s.includes('aria-hidden="true"'))).toBe(true);
    const kits = escudos.map(s => /data-kit="([^"]+)"/.exec(s)![1]);
    expect(kits).toEqual([id.local.principal.id, id.visita.principal.id]);
    expect(kits[0]).not.toBe(kits[1]);
    expect(html).not.toContain("arena-kit-note");
    // Ningún svg.arena-crest en toda la página sin aria-hidden.
    expect(svgs(html).length).toBeGreaterThan(2);
    expect(svgs(html).filter(s => !s.includes('aria-hidden="true"'))).toHaveLength(0);
  });

  it("marcador suelto: escudos solo con identidad; sin ella, el marcador del 050 no cambia", () => {
    const estado = estadoVisual(v3, 0), id = identidadPartido(v3.config.partido.local.nombre, v3.config.partido.visita.nombre);
    expect(renderToStaticMarkup(<ArenaMarcador registro={v3} estado={estado} gol={null} />)).not.toContain("arena-crest");
    const html = renderToStaticMarkup(<ArenaMarcador registro={v3} estado={estado} gol={null} identidad={id} />);
    expect(html).toMatch(/^<div class="arena-score"><span><svg[^>]*class="arena-crest"/);
    expect(html).toMatch(/<\/svg><\/span><\/div>$/);
  });

  it("clubes de la misma familia: la visita viste la alternativa y aparece .arena-kit-note como tercer span", () => {
    let otro = "";
    const l = identidadClub(v3.config.partido.local.nombre);
    for (let k = 0; k < 10_000 && !otro; k++) { const n = `Racing Ensayo ${k}`; if (identidadClub(n).principal.familia === l.principal.familia) otro = n; }
    const r = structuredClone(v3); r.config.partido.visita.nombre = otro;
    const html = renderToStaticMarkup(<Arena inicial={r} />);
    expect(html).toMatch(/<div class="arena-direction"><span>[^<]*<\/span><span>[^<]*<\/span><span class="arena-kit-note">[^<]*<\/span><\/div>/);
    expect(html).toContain(`${otro} wears its change kit`);
    const style = /<main class="arena-shell"[^>]*style="([^"]*)"/.exec(html)![1]!;
    expect(style).toContain(`--ar-away:${identidadClub(otro).alternativa.fondo}`);
  });

  it("anillo de selección: una sola vez, tras el dorsal y NO último hijo cuando el seleccionado celebra; el anillo de gol sigue último", () => {
    const capitan = v3.inicial.jugadores.find(j => j.lado === "local" && j.capitan)!;
    const g = v3.eventos.find(e => e.tipo === "gol")!;
    const r = structuredClone(v3), e: EventoArena = { ...structuredClone(g), id: "gol-cero", tick: 0, lado: "local", jugador: capitan.id };
    r.eventos = [e, ...r.eventos];
    const html = renderToStaticMarkup(<Arena inicial={r} />);
    expect(html.match(/arena-select-ring/g)).toHaveLength(1);
    const ficha = new RegExp(`<g data-testid="arena-player" data-player="${capitan.id}"[^>]*>(.*?)</g></g>`).exec(html)![1]!;
    const token = /<g class="arena-token">(.*)$/.exec(ficha)![1]!;
    expect(token).toMatch(/^<circle class="arena-kit" r="1.9"><\/circle><text[^>]*>\d+<\/text><circle class="arena-select-ring" r="2.6" aria-hidden="true"><\/circle>/);
    expect(token).toMatch(/<circle class="arena-goal-ring" r="3.2" aria-hidden="true"><\/circle>$/);
    expect(token).not.toMatch(/arena-select-ring" r="2.6" aria-hidden="true"><\/circle>$/);
    // SSR: favoritos sin hidratar, sin anillo de favorito.
    expect(html).not.toContain("arena-fav-ring");
  });
});

describe("055 · emblema y favicon", () => {
  const icono = readFileSync("src/app/icon.svg", "utf8");
  it("EmblemaCronista: aria-hidden, sin texto ni título, viewBox 0 0 32 32", () => {
    const html = renderToStaticMarkup(<EmblemaCronista />);
    expect(html).toMatch(/^<svg viewBox="0 0 32 32"[^>]*aria-hidden="true" focusable="false" class="brand-emblem">/);
    expect(html).not.toMatch(/<title|<text/);
    expect(html.replace(/<[^>]+>/g, "")).toBe("");
  });
  it("paridad con src/app/icon.svg: mismos trazos y punto, y los tres hex son --ar-bug, --ar-score-bg y --ar-live claros", () => {
    const html = renderToStaticMarkup(<EmblemaCronista />);
    const ds = (s: string) => [...s.matchAll(/<path d="([^"]+)"/g)].map(m => m[1]);
    const punto = (s: string) => /<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/.exec(s)!.slice(1);
    expect(ds(icono)).toEqual(ds(html));
    expect(ds(html)).toEqual([TRAZOS_EMBLEMA.contorno, TRAZOS_EMBLEMA.pentagono, TRAZOS_EMBLEMA.costuras]);
    expect(punto(icono)).toEqual(punto(html));
    const hex = new Set((icono.match(/#[0-9a-f]{6}/gi) ?? []).map(h => h.toLowerCase()));
    expect(hex).toEqual(new Set([tokenClaro("--ar-bug"), tokenClaro("--ar-score-bg"), tokenClaro("--ar-live")]));
    expect(icono).toMatch(new RegExp(`<rect[^>]*fill="${tokenClaro("--ar-bug")}"`));
    expect(icono).toMatch(new RegExp(`<circle[^>]*fill="${tokenClaro("--ar-live")}"`));
  });
});

describe("055 (bloque C) · iconos de eventos", () => {
  // Tabla § 6.1 como datos de la prueba: los 16 TipoEventoArena (reinicio con cada valor y tras falta).
  const TABLA: [Pick<EventoArena, "tipo" | "reinicio" | "motivo">, ClaseIcono | null][] = [
    [{ tipo: "gol" }, "gol"], [{ tipo: "tiro" }, "tiro"], [{ tipo: "tiro_fuera" }, "tiro_fuera"], [{ tipo: "atajada" }, "atajada"],
    [{ tipo: "amarilla" }, "amarilla"], [{ tipo: "roja" }, "roja"], [{ tipo: "cambio" }, "cambio"], [{ tipo: "fuera_juego" }, "fuera_juego"],
    [{ tipo: "falta" }, "falta"], [{ tipo: "reinicio", reinicio: "esquina" }, "esquina"], [{ tipo: "reinicio", reinicio: "centro" }, "reinicio"],
    [{ tipo: "reinicio", reinicio: "banda" }, "reinicio"], [{ tipo: "reinicio", reinicio: "meta" }, "reinicio"], [{ tipo: "reinicio", motivo: "falta" }, "reinicio"],
    [{ tipo: "pase" }, null], [{ tipo: "recepcion" }, null], [{ tipo: "intercepcion" }, null], [{ tipo: "recuperacion" }, null],
    [{ tipo: "plan_equipo" }, null], [{ tipo: "final_anticipado" }, null],
  ];
  it("claseIcono cubre los 16 tipos de la tabla § 6.1 y devuelve null para los seis sin icono", () => {
    const tipos: TipoEventoArena[] = ["pase", "recepcion", "intercepcion", "recuperacion", "tiro", "gol", "atajada", "tiro_fuera", "fuera_juego", "reinicio", "plan_equipo", "cambio", "falta", "amarilla", "roja", "final_anticipado"];
    expect(new Set(TABLA.map(([e]) => e.tipo))).toEqual(new Set(tipos));
    for (const [e, clase] of TABLA) expect(claseIcono(e), JSON.stringify(e)).toBe(clase);
    expect(TABLA.filter(([, c]) => c === null)).toHaveLength(6);
  });
  it("la celda existe siempre: aria-hidden, con data-kind y svg solo cuando hay icono", () => {
    for (const [e, clase] of TABLA) {
      const html = renderToStaticMarkup(<IconoEventoArena evento={{ ...v3.eventos[0]!, ...e } as EventoArena} />);
      expect(html).toMatch(/^<span class="arena-event-icon"[^>]*aria-hidden="true"/);
      if (clase) { expect(html).toContain(`data-kind="${clase}"`); expect(html).toContain("<svg"); }
      else { expect(html).not.toContain("data-kind"); expect(html).toBe('<span class="arena-event-icon" aria-hidden="true"></span>'); }
    }
  });
  it("lista mixta en la descripción (pase, gol, amarilla, reinicio): cuatro hijos por fila y data-kind solo donde toca", () => {
    const pase = v3.eventos.find(e => e.tipo === "pase")!, gol = v3.eventos.find(e => e.tipo === "gol")!, rein = v3.eventos.find(e => e.tipo === "reinicio")!;
    const amarilla: EventoArena = { ...structuredClone(pase), id: "amarilla-x", tipo: "amarilla", receptor: null };
    const html = renderToStaticMarkup(<ArenaDescripcion eventos={[pase, gol, amarilla, rein]} registro={v3} idioma="es" saltar={() => {}} />);
    const filas = [...html.matchAll(/<li data-event-id="([^"]+)"[^>]*>(.*?)<\/li>/g)].map(m => ({ id: m[1]!, cuerpo: m[2]! }));
    expect(filas).toHaveLength(4);
    for (const f of filas) {
      const hijos = f.cuerpo.match(/^<button[^>]*>.*?<\/button><span class="arena-event-icon"[^>]*>(?:<svg.*?<\/svg>)?<\/span><span class="arena-event-text">.*?<\/span><code class="arena-event-id">.*?<\/code>$/);
      expect(hijos, f.id).not.toBeNull();
    }
    expect(filas.map(f => /data-kind="([^"]+)"/.exec(f.cuerpo)?.[1] ?? null)).toEqual([null, "gol", "amarilla", rein.reinicio === "esquina" ? "esquina" : "reinicio"]);
  });
  it("feed de «Últimas acciones» con gol y amarilla en el tick 0: data-kind dentro de .arena-live-feed li, siempre aria-hidden", () => {
    const gol = v3.eventos.find(e => e.tipo === "gol")!;
    const r = structuredClone(v3);
    const g: EventoArena = { ...structuredClone(gol), id: "gol-cero", tick: 0 }, am: EventoArena = { ...structuredClone(gol), id: "amarilla-cero", tick: 0, tipo: "amarilla", autogol: undefined };
    r.eventos = [g, am, ...r.eventos];
    const html = renderToStaticMarkup(<Arena inicial={r} />);
    const feed = /<section class="arena-live-feed"[^>]*>(.*?)<\/section>/.exec(html)![1]!;
    const lis = [...feed.matchAll(/<li data-event-tick="0">(.*?)<\/li>/g)].map(m => m[1]!);
    expect(lis.some(l => l.includes('data-kind="gol"'))).toBe(true);
    expect(lis.some(l => l.includes('data-kind="amarilla"'))).toBe(true);
    for (const l of lis) expect(l).toMatch(/^<time>[^<]*<\/time><span class="arena-event-icon"[^>]*aria-hidden="true"/);
  });
  it("panel de cifras: iconoDeCifra para todas las filas, remates → tiro, etiquetas ES/EN sin cambios", () => {
    const esperado: Record<string, ClaseIcono | null> = {
      posesion_pct: null, igr: null, remates: "tiro", remates_directos: "tiro", remates_indirectos: "tiro", remates_cercanos: "tiro", esquinas: "esquina",
      fueras_juego: "fuera_juego", pases_completados: null, precision_pase: null, recuperaciones: null, perdidas: null, faltas: "falta", amarillas: "amarilla", rojas: "roja", atajadas: "atajada",
    };
    expect(Object.keys(esperado).sort()).toEqual([...ESTADISTICAS_ARENA.filasPanel].sort());
    for (const clave of ESTADISTICAS_ARENA.filasPanel) expect(iconoDeCifra(clave), clave).toBe(esperado[clave]);
    for (const idioma of ["es", "en"] as const) {
      const html = renderToStaticMarkup(<ArenaCifras registro={v3} tick={v3.final.tick} idioma={idioma} favorito={null} />);
      const fila = /<div class="arena-stat-row" data-stat="remates"[^>]*>(.*?)<span class="arena-stat-bars"/.exec(html)![1]!;
      expect(fila).toMatch(new RegExp(`<span class="arena-stat-label"><span class="arena-event-icon" data-kind="tiro" aria-hidden="true"><svg[^>]*>.*?</svg></span>${ETIQUETAS_CIFRAS.remates[idioma]}`));
      for (const m of html.matchAll(/<span class="arena-stat-label">(.*?)<\/span><span class="arena-stat-bars"/g)) {
        const texto = m[1]!.replace(/<small.*$/, "").replace(/<[^>]+>/g, "");
        expect(Object.values(ETIQUETAS_CIFRAS).map(e => e[idioma])).toContain(texto);
      }
    }
  });
});
