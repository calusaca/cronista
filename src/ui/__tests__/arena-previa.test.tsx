// Brief 056 (v1.1) · Tarjeta de alineaciones (renderToStaticMarkup). Los valores esperados salen del JSON
// del fixture y de puestos(); ninguna cifra de PREVIA_ARENA se repite.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { puestos } from "../../arena/catalogo";
import { etiquetasEntrenador } from "../../arena/entrenadores";
import { identidadPartido } from "../../arena/identidad";
import { previaVisual } from "../../arena/previa";
import type { RegistroArena } from "../../arena/tipos";
import { PREVIA_ARENA } from "../../sim/limites";
import { Arena } from "../Arena";
import { ArenaPrevia } from "../ArenaPrevia";

const leer = (ruta: string) => JSON.parse(readFileSync(ruta, "utf8")) as RegistroArena;
const v3 = leer("src/arena/__fixtures__/arena-reinicios-v3.json");
const v1 = leer("public/experimentos/arena-llm-v1.json");
const tarjeta = (r: RegistroArena, idioma: "es" | "en", plegada = false) => renderToStaticMarkup(<ArenaPrevia previa={previaVisual(r)}
  identidad={identidadPartido(r.config.partido.local.nombre, r.config.partido.visita.nombre)} idioma={idioma} plegada={plegada} alternar={() => {}} seleccionado={null} seleccionar={() => {}} />);
const articulo = (html: string, lado: string) => new RegExp(`<article class="arena-lineup arena-${lado}" data-testid="arena-lineup" data-side="${lado}">(.*?)</article>`).exec(html)?.[1] ?? "";

describe("056 · ArenaPrevia con arena-reinicios-v3", () => {
  const es = tarjeta(v3, "es"), en = tarjeta(v3, "en");
  it("dos artículos; 11 fichas por lado en el orden de puestos() con el jugador correcto; una marca de capitán por lado", () => {
    expect(es.match(/<article [^>]*data-side=/g)).toHaveLength(2);
    for (const lado of ["local", "visita"] as const) {
      const a = articulo(es, lado);
      const slots = [...a.matchAll(/<g class="arena-lineup-slot" data-slot="([^"]+)" data-lineup-player="([^"]+)"/g)].map(m => [m[1], m[2]]);
      expect(slots.map(s => s[0])).toEqual(puestos(v3.config.formaciones[lado]));
      for (const [slot, id] of slots) expect(v3.inicial.jugadores.find(j => j.id === id)).toMatchObject({ lado, puesto: slot });
      expect(a.match(/class="arena-captain-mark"/g)).toHaveLength(1);
      expect(a.match(/data-testid="arena-lineup-player"/g)).toHaveLength(11);
      for (const j of v3.inicial.jugadores.filter(j => j.lado === lado)) {
        expect(a).toMatch(new RegExp(`data-lineup-player="${j.id}"[^>]*><span class="tnum">${j.dorsal}</span> <strong>${j.nombre}</strong> <span class="arena-muted">${j.puesto}${j.capitan ? " · Capitán" : ""}</span>`));
      }
      expect(a.match(/· Capitán/g)).toHaveLength(1);
      const e = v3.config.entrenadores![lado];
      expect(a).toContain(`DT</span> ${e.nombre} · ${etiquetasEntrenador[e.perfil].es}`);
      expect(a).toContain(`Suplentes (${v3.inicial.banco!.filter(j => j.lado === lado).length})`);
      expect(a).toContain(PREVIA_ARENA.textos.estilo.es[v3.config.partido[lado].estilo]);
      expect(a).toMatch(/<svg class="arena-lineup-pitch"[^>]*aria-hidden="true"/);
    }
    expect(en.match(/· Captain/g)).toHaveLength(2);
    expect(en).toContain("Starting line-ups");
    expect(en).toContain("Bench (5)");
  });
  it("chips con clima, superficie y árbitro; sin testids de la cancha, la plantilla ni el banquillo", () => {
    const c = v3.config.partido.condiciones!;
    expect(es).toContain(`<span class="arena-lineup-chip">${PREVIA_ARENA.textos.clima.es[c.clima]}</span>`);
    expect(es).toContain(`<span class="arena-lineup-chip">Superficie sintética</span>`);
    expect(es).toContain(`<span class="arena-lineup-chip">Árbitro: ${v3.inicial.arbitro!.nombre}</span>`);
    expect(en).toContain(`<span class="arena-lineup-chip">Referee: ${v3.inicial.arbitro!.nombre}</span>`);
    for (const id of ["arena-player", "arena-roster-person", "arena-bench-person"]) expect(es).not.toContain(`data-testid="${id}"`);
    // v1.2 · Nada de la tarjeta usa data-player ni <header> (los e2e existentes los buscan sin acotar),
    // y el dibujo lleva solo dorsales: ningún <text> con nombre.
    expect(es).not.toMatch(/\sdata-player=/);
    expect(es).not.toContain("<header");
    expect(es).not.toContain("arena-lineup-name");
    for (const lado of ["local", "visita"] as const) {
      const svg = /<svg class="arena-lineup-pitch".*?<\/svg>/.exec(articulo(es, lado))![0];
      const textos = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m => m[1]);
      expect(textos.every(x => /^\d+$/.test(x!) || x === "C"), textos.join(",")).toBe(true);
    }
  });
  it("cuerpo siempre montado: hidden al plegar y aria-controls estable", () => {
    expect(es).toContain('aria-controls="arena-lineups-body"');
    expect(es).toContain('aria-expanded="true"');
    expect(es).toMatch(/<div class="arena-lineups-grid" id="arena-lineups-body">/);
    const plegada = tarjeta(v3, "es", true);
    expect(plegada).toContain('aria-expanded="false"');
    expect(plegada).toMatch(/<div class="arena-lineups-grid" id="arena-lineups-body" hidden="">/);
    expect(plegada).toContain("Mostrar alineaciones");
    expect(plegada).toContain('data-collapsed="true"');
  });
});

describe("056 · ArenaPrevia con arena-llm-v1 (degradación)", () => {
  it("sin DT, sin banco, sin marca de capitán ni chip de árbitro; sin errores", () => {
    const html = tarjeta(v1, "es");
    expect(html.match(/data-testid="arena-lineup-player"/g)).toHaveLength(22);
    expect(html).not.toContain("arena-lineup-coach");
    expect(html).not.toContain("arena-lineup-bench");
    expect(html).not.toContain("arena-captain-mark");
    expect(html).not.toContain("Árbitro");
    expect(html).not.toContain("arena-lineups-conditions");
  });
});

describe("056 · Arena", () => {
  it("la tarjeta es el hermano siguiente de .arena-direction en el tick 0", () => {
    const html = renderToStaticMarkup(<Arena inicial={v3} />);
    expect(html).toMatch(/<div class="arena-direction">.*?<\/div><section class="arena-lineups" data-testid="arena-lineups"/);
  });
  it("con una alineación inconsistente no hay tarjeta y el resto del tablero sigue", () => {
    const r = structuredClone(v3);
    const [a, b] = r.inicial.jugadores.filter(j => j.lado === "visita");
    b!.puesto = a!.puesto;
    expect(() => previaVisual(r)).toThrow("Alineación inconsistente");
    const html = renderToStaticMarkup(<Arena inicial={r} />);
    expect(html).not.toContain("arena-lineups");
    for (const s of ['data-testid="arena-pitch"', 'class="arena-direction"', 'data-testid="arena-clock"', "arena-stats"]) expect(html).toContain(s);
  });
});

// ——— Brief 058 · Bloque C · Resaltado sincronizado y tira «En voz» (§ 5, § 8 y v1.1 § 10) ———
import { antesalaPartido, focoDeAntesala, jugadoresDelBloque, type FocoAntesala } from "../../arena/antesala";
import { etiquetasPerfil, etiquetaTemperamento } from "../../arena/personalidades";
import { ANTESALA_ARENA } from "../../sim/limites";

const conFoco = (r: RegistroArena, idioma: "es" | "en", foco: FocoAntesala | null, plegada = false) => renderToStaticMarkup(<ArenaPrevia previa={previaVisual(r)}
  identidad={identidadPartido(r.config.partido.local.nombre, r.config.partido.visita.nombre)} idioma={idioma} plegada={plegada} alternar={() => {}} seleccionado={null} seleccionar={() => {}} foco={foco} />);
const hablando = (html: string, clase: string) => [...html.matchAll(new RegExp(`<[^>]*class="${clase}"[^>]*>`, "g"))].filter(m => m[0].includes('data-speaking="true"')).map(m => /data-lineup-player="([^"]+)"/.exec(m[0])?.[1] ?? m[0]);
const tira = (html: string) => /<div data-testid="arena-lineups-now"[\s\S]*?<\/div>/.exec(html)?.[0] ?? "";
const CAMPOS = ["dorsal", "nombre", "puesto", "nivel", "perfil", "temperamento", "rol-natural", "capitan"];
const piezaDe = (r: RegistroArena, id: string, idioma: "es" | "en" = "es") => antesalaPartido(r, null, idioma).find(p => p.id === id)!;

describe("058 · C · resaltado en ArenaPrevia", () => {
  it("con el foco de «atrás» local: data-speaking exactamente en sus fichas y botones (contra jugadoresDelBloque) y en ningún otro", () => {
    for (const bloque of ["atras", "medio", "arriba"] as const) for (const lado of ["local", "visita"] as const) {
      const foco = focoDeAntesala(piezaDe(v3, `antesala:0${(lado === "local" ? 3 : 7) + ["atras", "medio", "arriba"].indexOf(bloque)}-${lado}-${bloque}:0`))!;
      const html = conFoco(v3, "es", foco), esperados = jugadoresDelBloque(v3, lado, bloque).map(j => j.id);
      expect(hablando(html, "arena-lineup-slot").sort()).toEqual([...esperados].sort());
      expect(hablando(html, "arena-lineup-player").sort()).toEqual([...esperados].sort());
      expect(html.match(/<article [^>]*data-speaking/g)).toBeNull();
      const coach = /<p class="arena-lineup-coach"[^>]*>/g;
      expect([...html.matchAll(coach)].filter(m => m[0].includes("data-speaking")).length).toBe(bloque === "arriba" && foco.entrenador ? 1 : 0);
    }
  });
  it("con la cabecera, data-speaking en el article de ese lado; sin foco, en ninguna parte", () => {
    const html = conFoco(v3, "en", focoDeAntesala(piezaDe(v3, "antesala:06-visita-cabecera:0"))!);
    expect([...html.matchAll(/<article [^>]*>/g)].filter(m => m[0].includes("data-speaking")).map(m => /data-side="(\w+)"/.exec(m[0])![1])).toEqual(["visita"]);
    expect(tira(html)).toContain(ANTESALA_ARENA.bloquesRotulo.en.cabecera);
    expect(tira(html)).not.toContain("data-jugador");
    expect(conFoco(v3, "es", null)).not.toContain("data-speaking");
    expect(conFoco(v3, "es", null)).not.toContain("arena-lineups-now");
  });
  it("la tira lista exactamente los campos de § 5, cada valor del jugador correcto de `inicial`, con la nota de perfil previo; visible aunque esté plegada y sin región viva", () => {
    for (const idioma of ["es", "en"] as const) for (const id of ["antesala:03-local-atras:0", "antesala:04-local-medio:0", "antesala:09-visita-arriba:0"]) {
      const foco = focoDeAntesala(piezaDe(v3, id, idioma))!;
      const html = conFoco(v3, idioma, foco, true), t = tira(html);
      expect(t).toContain(`${previaVisual(v3).equipos[foco.lado!].nombre} · ${ANTESALA_ARENA.bloquesRotulo[idioma][foco.bloque as "atras"]}`);
      expect(t).toContain(idioma === "es" ? "Perfil previo: índices sintéticos del registro; aún no hay estadísticas de juego." : "Pre-match profile: synthetic indices from the record; no match statistics yet.");
      expect(t).not.toMatch(/role="status"|aria-live/);
      const filas = [...t.matchAll(/<li class="arena-lineups-now-row" data-jugador="([^"]+)">([\s\S]*?)<\/li>/g)];
      expect(filas.map(f => f[1])).toEqual(foco.jugadores);
      for (const [, jid, fila] of filas) {
        const j = v3.inicial.jugadores.find(x => x.id === jid)!;
        const campos = Object.fromEntries([...fila!.matchAll(/data-campo="([^"]+)">([^<]*)</g)].map(m => [m[1], m[2]]));
        for (const c of Object.keys(campos)) expect(CAMPOS).toContain(c);
        expect(campos.dorsal).toBe(String(j.dorsal)); expect(campos.nombre).toBe(j.nombre); expect(campos.puesto).toBe(j.puesto);
        expect(campos.nivel).toBe(idioma === "es" ? `Nivel ${j.nivel}` : `Ability ${j.nivel}`);
        expect(campos.perfil).toBe(j.personalidad ? etiquetasPerfil[j.personalidad.perfil][idioma] : undefined);
        expect(campos.temperamento).toBe(j.personalidad ? etiquetaTemperamento(j.personalidad, idioma) : undefined);
        expect(campos["rol-natural"]).toBe(j.posicionNatural && j.posicionNatural !== j.puesto ? (idioma === "es" ? `Rol natural: ${j.posicionNatural}` : `Natural role: ${j.posicionNatural}`) : undefined);
        expect(campos.capitan).toBe(j.capitan ? (idioma === "es" ? "Capitán" : "Captain") : undefined);
        // Ninguna cifra de la fila que no esté en `inicial` para ese jugador.
        for (const n of fila!.replace(/<[^>]+>/g, " ").match(/\d+/g) ?? []) expect([String(j.dorsal), String(j.nivel), ...j.puesto.match(/\d+/g) ?? [], ...(j.posicionNatural ?? "").match(/\d+/g) ?? []]).toContain(n);
      }
    }
  });
  it("con un registro v1 la tira solo lleva dorsal, nombre, puesto y nivel", () => {
    const foco = focoDeAntesala(piezaDe(v1, "antesala:04-local-medio:0"))!;
    const t = tira(conFoco(v1, "es", foco));
    expect(new Set([...t.matchAll(/data-campo="([^"]+)"/g)].map(m => m[1]))).toEqual(new Set(["dorsal", "nombre", "puesto", "nivel"]));
  });
});
