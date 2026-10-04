// Brief 027 — la sanción de club en el Analista y el Verificador. ORÁCULO: cada sanción del
// registro en el partido ⇒ un hecho `sancion_de_club` con sus datos (y ninguno sin ella); las tres
// plantillas pasan el Verificador. BATERÍA V8, frase por frase, ES y EN por separado: «puerta
// cerrada / behind closed doors / docked points» SOLO con el hecho como principal. «sancionado /
// suspended» sigue siendo de los jugadores suspendidos (019): no se rompe.
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import type { Hecho } from "../../analista/tipos";
import { RELEVANCIA } from "../../analista/umbrales";
import { mundo } from "../../mundo/mundo";
import { simularTemporada } from "../../mundo/temporada";
import type { Liga } from "../../mundo/tipos";
import { BANCO_LIMITADO } from "../../sim/limites";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Partido } from "../../sim/tipos";
import { FRASES_SANCION_CLUB, SANCION_CLUB_JUICIO } from "../lexico";
import type { Motivo } from "../tipos";
import { verificarOraciones } from "../verificador";

interface Caso {
  p: Partido;
  hs: Hecho[];
}
const liga = (id: string) => mundo().ligas.find((l) => l.id === id) as Liga;
const casos: Caso[] = [simularTemporada(liga("liga-de-los-fiordos"), 1), simularTemporada(liga("liga-de-las-cumbres"), 2)].flatMap((t) =>
  t.configs.map((c) => {
    const p = simular(c);
    return { p, hs: analizar(p) };
  }),
);
const con = (tipo: string) => casos.find((c) => (c.p.config.sancionesClub ?? []).some((s) => s.tipo === tipo))!;
const hechoDe = (c: Caso, tipo: string) => c.hs.find((h) => h.tipo === "sancion_de_club" && h.datos.tipo === tipo)!;
const normal = (() => {
  const p = simular(configDeSemilla(1));
  return { p, hs: analizar(p) };
})();
const motivos = (c: Caso, h: Hecho, es: string, en: string): Motivo[] => verificarOraciones([{ texto_es: es, texto_en: en, hecho: h.id }], c.hs, c.p);
const sin = (t: string) => t.replace(/\.$/, "");
const req = SANCION_CLUB_JUICIO[0]!.requisito;

describe("027 · el hecho sancion_de_club (oráculo)", () => {
  it("una por cada sanción del partido, con sus datos, relevancia 48 y citando el inicio; ninguna sin registro", () => {
    let n = 0;
    for (const c of casos) {
      const sc = c.p.config.sancionesClub ?? [];
      const hs = c.hs.filter((h) => h.tipo === "sancion_de_club");
      expect(hs.length, `${c.p.config.seed}`).toBe(sc.length);
      const inicio = c.p.eventos.find((e) => e.tipo === "inicio_periodo")!.id;
      sc.forEach((s, k) => {
        n++;
        const h = hs[k]!;
        expect(h.relevancia).toBe(RELEVANCIA.sancion_de_club);
        expect(h.eventos).toEqual([inicio]);
        expect([h.datos.equipo, h.datos.tipo, h.datos.causa]).toEqual([c.p.config[s.lado].nombre, s.tipo, s.causa]);
        if (s.tipo === "deduccion") expect(h.datos.puntos).toBe(s.puntos);
        else expect([h.datos.partido, h.datos.de]).toEqual([s.partido, s.de]);
        if (s.tipo === "limite_banco") expect(h.datos.suplentes).toBe(BANCO_LIMITADO);
      });
    }
    expect(n).toBeGreaterThanOrEqual(7);
    expect(analizar(simular(configDeSemilla(5))).some((h) => h.tipo === "sancion_de_club")).toBe(false);
  });

  it("en los partidos sancionados, las plantillas de TODOS sus hechos pasan el Verificador (la presión baja/baja incluida)", () => {
    for (const c of casos.filter((x) => (x.p.config.sancionesClub ?? []).length > 0)) for (const h of c.hs) expect(motivos(c, h, h.texto_es, h.texto_en), `${h.tipo}: ${h.texto_es}`).toEqual([]);
  });

  it("las tres plantillas pasan el Verificador (ES y EN)", () => {
    for (const tipo of ["deduccion", "puerta_cerrada", "limite_banco"]) {
      const c = con(tipo);
      const h = hechoDe(c, tipo);
      expect(motivos(c, h, h.texto_es, h.texto_en), h.texto_es).toEqual([]);
    }
  });
});

describe("027 · batería V8: las frases de la sanción solo con su hecho", () => {
  const c = con("puerta_cerrada");
  const h = hechoDe(c, "puerta_cerrada");
  const gol = normal.hs.find((x) => x.tipo === "gol_anotado")!;
  for (const lengua of ["es", "en"] as const) {
    for (const f of FRASES_SANCION_CLUB.sancion[lengua]) {
      it(`«${f}» (${lengua.toUpperCase()}): con la sanción ⇒ pasa; con un gol ⇒ V8`, () => {
        const mas = (x: Hecho): [string, string] => (lengua === "es" ? [`${sin(x.texto_es)}; ${f}.`, x.texto_en] : [x.texto_es, `${sin(x.texto_en)}; ${f}.`]);
        expect(motivos(c, h, ...mas(h))).toEqual([]);
        expect(motivos(normal, gol, ...mas(gol)).some((m) => m.regla === "V8" && m.detalle.includes(req))).toBe(true);
      });
    }
  }

  it("en un partido sancionado, «docked points» desde otro hecho (un gol) también ⇒ V8: hay que citar la sanción", () => {
    const d = con("deduccion");
    const g = d.hs.find((x) => x.tipo === "gol_anotado" || x.tipo === "resultado_final")!;
    expect(motivos(d, g, `${sin(g.texto_es)}; puntos de sanción.`, `${sin(g.texto_en)}; docked points.`).filter((m) => m.regla === "V8" && m.detalle.includes(req))).toHaveLength(2);
  });
});
