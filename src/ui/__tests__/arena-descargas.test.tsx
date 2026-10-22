// Brief 053 · Sección «Descargar comentarios» y botón de WAV (renderToStaticMarkup), más el tope
// compartido de la pista (PISTA_MAX_PCM_BYTES, sin cifra repetida en ArenaNarracion).
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PISTA_MAX_PCM_BYTES, wavMono } from "../../arena/pista-audio";
import type { RegistroArena } from "../../arena/tipos";
import { ArenaDescargas } from "../ArenaDescargas";
import { ArenaNarracion } from "../ArenaNarracion";

const registro = JSON.parse(readFileSync("src/arena/__fixtures__/arena-reinicios-v4.json", "utf8")) as RegistroArena;
const seccion = (props: Partial<Parameters<typeof ArenaDescargas>[0]>) => renderToStaticMarkup(createElement(ArenaDescargas, {
  registro, comentarios: [], intervenciones: [], sesion: "s", hastaTick: registro.final.tick, enCurso: false, idioma: "en", sinPartido: false, ...props,
}));
const narracion = (idioma: "es" | "en") => renderToStaticMarkup(createElement(ArenaNarracion, {
  seed: registro.config.partido.seed, sesion: "s", archivo: null, alRegistrar: () => {}, hastaTick: registro.final.tick, enDirecto: false, idioma, seleccionarTiempo: () => {}, alActividadAudio: () => {},
}));
const botones = (html: string) => [...html.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)].map(m => ({ atributos: m[1]!, texto: m[2]! }));

describe("053 · ArenaDescargas", () => {
  it("sección con data-partial y data-until-tick según el cursor", () => {
    const final = seccion({});
    expect(final).toContain('data-testid="arena-downloads"');
    expect(final).toContain('aria-label="Descargas de la transmisión / Broadcast downloads"');
    expect(final).toContain('data-partial="false"'); expect(final).toContain(`data-until-tick="${registro.final.tick}"`);
    const mitad = seccion({ hastaTick: 300 });
    expect(mitad).toContain('data-partial="true"'); expect(mitad).toContain('data-until-tick="300"');
    expect(mitad).toContain("0:30.0");
  });

  it("botones ES y EN, habilitados con partido y deshabilitados sin partido; sin un segundo «Download run»", () => {
    const en = botones(seccion({})), es = botones(seccion({ idioma: "es" }));
    expect(en.map(b => b.texto)).toEqual(["Download commentary (Markdown)", "Download commentary (JSON)"]);
    expect(es.map(b => b.texto)).toEqual(["Descargar comentarios (Markdown)", "Descargar comentarios (JSON)"]);
    for (const b of en) { expect(b.atributos).not.toContain("disabled"); expect(b.atributos).toContain('aria-describedby="arena-downloads-help"'); }
    for (const b of botones(seccion({ sinPartido: true }))) expect(b.atributos).toContain("disabled");
    expect(seccion({})).toContain("Download commentary"); expect(seccion({ idioma: "es" })).toContain("Descargar comentarios");
    expect(seccion({})).not.toContain("Download run");
    expect(seccion({ enCurso: true })).toContain("published so far, up to the visible clock");
    expect(seccion({ enCurso: true, idioma: "es" })).toContain("hasta el reloj visible");
  });
});

describe("053 · botón de WAV en ArenaNarracion", () => {
  it("existe y está deshabilitado sin pista, en ES y EN", () => {
    for (const [idioma, texto] of [["en", "Download audio (WAV)"], ["es", "Descargar audio (WAV)"]] as const) {
      const b = botones(narracion(idioma)).find(x => x.atributos.includes('data-testid="arena-narration-download"'))!;
      expect(b.texto).toBe(texto);
      expect(b.atributos).toContain("disabled");
    }
  });

  it("el tope de la pista es PISTA_MAX_PCM_BYTES + 44 y ArenaNarracion no repite la cifra", async () => {
    const justo = wavMono([new Float32Array(PISTA_MAX_PCM_BYTES / 2)], 24000);
    expect(justo.size).toBe(PISTA_MAX_PCM_BYTES + 44);
    expect(() => wavMono([new Float32Array(PISTA_MAX_PCM_BYTES / 2 + 1)], 24000)).toThrow("Pista fuera de presupuesto");
    const fuente = readFileSync("src/ui/ArenaNarracion.tsx", "utf8");
    expect(fuente).toContain("PISTA_MAX_PCM_BYTES");
    expect(fuente).not.toMatch(/60_?000_?000/);
  });
});
