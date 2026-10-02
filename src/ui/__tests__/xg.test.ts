// Brief 017 — xG en cristiano: un único formateador decide cómo se lee un xG en el chrome.
// Aficionado: «35% chance» / «35 % de gol» (Math.round(xg·100)); Analista: «xG 0.35».
import { describe, expect, it } from "vitest";
import { micro } from "../../sim/micro";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Evento } from "../../sim/tipos";
import { lineaRemate, relato } from "../../vista/stats";
import { describirEvento, EXPLICA_XG, formatoXg, MOTIVO_VALORACION_EN, motivoValoracion } from "../textos";

const partidos = Array.from({ length: 40 }, (_, i) => simular(configDeSemilla(i + 1)));
const tiros: Evento[] = partidos.flatMap((p) => p.eventos.filter((e) => e.tipo === "tiro" && e.xg !== undefined));

describe("017 · formatoXg", () => {
  it("Aficionado redondea al entero más cercano (ni trunca ni sube) y habla el idioma", () => {
    expect(formatoXg(0.35, "aficionado", "en")).toBe("35% chance");
    expect(formatoXg(0.35, "aficionado", "es")).toBe("35 % de gol");
    expect(formatoXg(0.126, "aficionado", "en")).toBe("13% chance");
    expect(formatoXg(0.124, "aficionado", "en")).toBe("12% chance");
    expect(formatoXg(0.07, "aficionado", "es")).toBe("7 % de gol");
    expect(formatoXg(0.004, "aficionado", "en")).toBe("0% chance");
    expect(formatoXg(0.79, "aficionado", "en")).toBe("79% chance");
  });

  it("Analista conserva «xG 0.35» en ambos idiomas", () => {
    expect(formatoXg(0.35, "analista", "en")).toBe("xG 0.35");
    expect(formatoXg(0.35, "analista", "es")).toBe("xG 0.35");
    expect(formatoXg(0.126, "analista", "es")).toBe("xG 0.13");
  });

  it("el explicador de una línea existe en ES y EN y no dice «xG»", () => {
    expect(EXPLICA_XG.es).toMatch(/^% de gol: /);
    expect(EXPLICA_XG.en).toMatch(/^% chance: /);
    for (const t of Object.values(EXPLICA_XG)) expect(t).not.toMatch(/xG/i);
  });
});

describe("017 · el chrome pasa por el formateador (corpus 1..40)", () => {
  it("hay tiros con xG que probar", () => expect(tiros.length).toBeGreaterThan(400));

  it("línea de tiempo: Aficionado sin «xG» y con el % del tiro; Analista con el xG a dos decimales", () => {
    for (const e of tiros) {
      const pct = String(Math.round(e.xg! * 100));
      const en = describirEvento(e, "aficionado", "en");
      const es = describirEvento(e, "aficionado", "es");
      expect(en).not.toMatch(/xG/);
      expect(es).not.toMatch(/xG/);
      expect(en).toContain(` · ${pct}% chance`);
      expect(es).toContain(` · ${pct} % de gol`);
      expect(describirEvento(e, "analista", "en")).toContain(`xG ${e.xg!.toFixed(2)}`);
      // El default (llamadas que no son chrome de modo) es el de antes del 017.
      expect(describirEvento(e)).toBe(describirEvento(e, "analista", "en"));
    }
  });

  it("relato del panel de stats: con el formateador de Aficionado no aparece «xG»", () => {
    const p = partidos[0]!;
    const m = micro(p);
    const ids = p.eventos.filter((e) => e.tipo === "tiro").map((e) => e.id);
    const fx = (x: number) => formatoXg(x, "aficionado", "es");
    for (const e of p.eventos.filter((x) => x.tipo === "tiro" && x.xg !== undefined)) {
      expect(lineaRemate(p, e, fx)).not.toMatch(/xG/);
      expect(lineaRemate(p, e, fx)).toContain(`${Math.round(e.xg! * 100)} % de gol`);
      expect(lineaRemate(p, e)).toContain(`xG ${e.xg!.toFixed(2)}`);
    }
    // Cito el último micro-evento de cada posesión que terminó en remate: el relato agrega el remate.
    const finales = m.posesiones
      .filter((q) => q.termina === "ancla" && ids.includes(q.ancla ?? ""))
      .map((q) => q.eventos[q.eventos.length - 1]!)
      .filter(Boolean);
    const lineas = relato(p, m, finales, 0, fx);
    expect(lineas.some((l) => ids.includes(l.id))).toBe(true);
    for (const l of lineas) expect(l.texto).not.toMatch(/xG/);
  });

  it("desglose de valoración: los motivos en Aficionado no dicen «xG»; en Analista, los de siempre", () => {
    for (const k of Object.keys(MOTIVO_VALORACION_EN)) {
      expect(motivoValoracion(k, "aficionado")).not.toMatch(/xG/);
      expect(motivoValoracion(k, "analista")).toBe(MOTIVO_VALORACION_EN[k]);
    }
    expect(motivoValoracion("gol_dificil", "analista")).toMatch(/xG/);
  });
});
