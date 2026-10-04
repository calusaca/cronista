// Brief 026 — el olé en el Analista y el Verificador. El hecho `ole_de_la_grada` ⇔ la racha
// medida (el oráculo independiente vive en src/analista/__tests__/oraculo.test.ts y en
// src/vista/__tests__/grada.test.ts); su plantilla pasa el Verificador; y la BATERÍA V8, frase por
// frase, ES y EN por separado: «olé / la grada rugió / the crowd roared» SOLO con su hecho.
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import type { Hecho } from "../../analista/tipos";
import { OLE_RACHA_MIN, RELEVANCIA } from "../../analista/umbrales";
import { micro } from "../../sim/micro";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Partido } from "../../sim/tipos";
import { reacciones } from "../../vista/grada";
import { FRASES_GRADA, GRADA_JUICIO } from "../lexico";
import type { Motivo } from "../tipos";
import { verificarOraciones } from "../verificador";

interface Caso {
  p: Partido;
  hs: Hecho[];
}
const caso = (s: number): Caso => {
  const p = simular(configDeSemilla(s));
  return { p, hs: analizar(p) };
};
const corpus = Array.from({ length: 120 }, (_, i) => caso(i + 1));
const conOle = corpus.find((c) => c.hs.some((h) => h.tipo === "ole_de_la_grada"))!;
const sinOle = corpus.find((c) => !c.hs.some((h) => h.tipo === "ole_de_la_grada") && c.hs.some((h) => h.tipo === "gol_anotado"))!;
const motivos = (c: Caso, h: Hecho, es: string, en: string): Motivo[] => verificarOraciones([{ texto_es: es, texto_en: en, hecho: h.id }], c.hs, c.p);
const sin = (t: string) => t.replace(/\.$/, "");
const req = GRADA_JUICIO.find((e) => e.id === "ole")!.requisito;

describe("026 · el hecho ole_de_la_grada", () => {
  it("un hecho por cada olé de la grada (la MISMA racha: mismos pases), con su relevancia y sus datos", () => {
    let n = 0;
    for (const c of corpus) {
      const oles = c.hs.filter((h) => h.tipo === "ole_de_la_grada");
      const rs = reacciones(c.p).filter((r) => r.tipo === "ole");
      expect(oles.map((h) => h.eventos.join()).sort(), `${c.p.config.seed}`).toEqual(rs.map((r) => r.micro.join()).sort());
      const m = new Map(micro(c.p).eventos.map((x) => [x.id, x] as const));
      for (const h of oles) {
        n++;
        expect(h.relevancia).toBe(RELEVANCIA.ole_de_la_grada);
        expect(h.datos.pases).toBe(h.eventos.length);
        expect(h.eventos.length).toBeGreaterThanOrEqual(OLE_RACHA_MIN);
        const equipo = m.get(h.eventos[0]!)!.equipo;
        expect(h.datos.equipo).toBe(c.p.config[equipo].nombre);
      }
    }
    expect(n).toBeGreaterThan(10);
  });

  it("la plantilla pasa el Verificador (ES y EN) en todo el corpus", () => {
    for (const c of corpus) for (const h of c.hs.filter((x) => x.tipo === "ole_de_la_grada")) expect(motivos(c, h, h.texto_es, h.texto_en), h.texto_es).toEqual([]);
  });
});

describe("026 · batería V8: «olé / the crowd roared» solo con el hecho del olé", () => {
  const ole = conOle.hs.find((h) => h.tipo === "ole_de_la_grada")!;
  const gol = sinOle.hs.find((h) => h.tipo === "gol_anotado")!;
  for (const lengua of ["es", "en"] as const) {
    for (const f of FRASES_GRADA.ole[lengua]) {
      it(`«${f}» (${lengua.toUpperCase()}): con el olé ⇒ pasa; con un gol de un partido sin olé ⇒ V8`, () => {
        const con = (h: Hecho): [string, string] => (lengua === "es" ? [`${sin(h.texto_es)}; ${f}.`, h.texto_en] : [h.texto_es, `${sin(h.texto_en)}; ${f}.`]);
        expect(motivos(conOle, ole, ...con(ole))).toEqual([]);
        expect(motivos(sinOle, gol, ...con(gol)).some((m) => m.regla === "V8" && m.detalle.includes(req))).toBe(true);
      });
    }
  }

  it("en un partido CON olé, decirlo desde otro hecho (un gol) también ⇒ V8: tiene que citarse el olé", () => {
    const g = conOle.hs.find((h) => h.tipo === "gol_anotado")!;
    const ms = motivos(conOle, g, `${sin(g.texto_es)}; la grada rugió.`, `${sin(g.texto_en)}; the crowd roared.`);
    expect(ms.filter((m) => m.regla === "V8" && m.detalle.includes(req)).length).toBe(2);
  });
});
