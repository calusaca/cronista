// Brief 013 — suite estadística de la capa micro, N = N_ESTADISTICA (`npm run test:stats`).
// Volumen, pases y completación, regates, correlación con ATT, mezcla de distancias y la
// rareza de los 4 hechos nuevos. Todos los umbrales vienen de limites.ts / umbrales.ts.
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import { RAREZA_MICRO_MAX } from "../../analista/umbrales";
import type { TipoHecho } from "../../analista/tipos";
import { MICRO_ATT, MICRO_PASES, MICRO_REGATES_EXITO, MICRO_TOTAL, N_ESTADISTICA, PASE_M, PASE_MEZCLA } from "../limites";
import { micro } from "../micro";
import { simular } from "../motor";
import { configDeSemilla } from "../plantillas";
import type { Lado, Partido } from "../tipos";

const corpus: Partido[] = Array.from({ length: N_ESTADISTICA }, (_, i) => simular(configDeSemilla(i + 1)));
const capas = corpus.map((p) => micro(p));
const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const informe = (k: string, v: string | number) => console.log(`[stats micro] ${k}: ${v}`);

describe(`013 · capa micro, N = ${N_ESTADISTICA}`, () => {
  it("volumen: cada partido en [MICRO_TOTAL.min, max] y el promedio ≥ mediaMin", () => {
    const tot = capas.map((m) => m.eventos.length);
    informe("micro/partido (min · media · max)", `${Math.min(...tot)} · ${media(tot).toFixed(0)} · ${Math.max(...tot)}`);
    expect(Math.min(...tot)).toBeGreaterThanOrEqual(MICRO_TOTAL.min);
    expect(Math.max(...tot)).toBeLessThanOrEqual(MICRO_TOTAL.max);
    expect(media(tot)).toBeGreaterThanOrEqual(MICRO_TOTAL.mediaMin);
  });

  it("pases por partido y fracción de completados dentro de MICRO_PASES", () => {
    const pases = capas.map((m) => m.eventos.filter((x) => x.tipo === "pase"));
    const n = media(pases.map((x) => x.length));
    const c = media(pases.map((x) => x.filter((y) => y.completado).length / x.length));
    informe("pases/partido", n.toFixed(0));
    informe("completados", c.toFixed(3));
    expect(n).toBeGreaterThanOrEqual(MICRO_PASES.mediaMin);
    expect(n).toBeLessThanOrEqual(MICRO_PASES.mediaMax);
    expect(c).toBeGreaterThanOrEqual(MICRO_PASES.completadosMin);
    expect(c).toBeLessThanOrEqual(MICRO_PASES.completadosMax);
  });

  it("regates exitosos dentro de MICRO_REGATES_EXITO", () => {
    const rg = capas.flatMap((m) => m.eventos.filter((x) => x.tipo === "regate"));
    const f = rg.filter((x) => x.exito).length / rg.length;
    informe("regates/partido · éxito", `${(rg.length / N_ESTADISTICA).toFixed(1)} · ${f.toFixed(3)}`);
    expect(f).toBeGreaterThanOrEqual(MICRO_REGATES_EXITO.min);
    expect(f).toBeLessThanOrEqual(MICRO_REGATES_EXITO.max);
  });

  it("el equipo con más ATT completa más pases (MICRO_ATT)", () => {
    let n = 0;
    let ok = 0;
    corpus.forEach((p, i) => {
      const dif = p.config.local.ataque - p.config.visita.ataque;
      if (Math.abs(dif) < MICRO_ATT.difAtaqueMin) return;
      const ps = (capas[i] as ReturnType<typeof micro>).eventos.filter((x) => x.tipo === "pase");
      const c = (l: Lado) => {
        const x = ps.filter((y) => y.equipo === l);
        return x.filter((y) => y.completado).length / x.length;
      };
      n++;
      if (dif > 0 === c("local") > c("visita")) ok++;
    });
    informe("ATT ⇒ completa más", `${ok}/${n} = ${(ok / n).toFixed(3)}`);
    expect(ok / n).toBeGreaterThanOrEqual(MICRO_ATT.fraccionMin);
  });

  it("mezcla de distancias de pase realista (PASE_MEZCLA)", () => {
    const d = capas.flatMap((m) => m.eventos.filter((x) => x.tipo === "pase").map((x) => x.distanciaM as number));
    const cortos = d.filter((x) => x < PASE_M.corto.max).length / d.length;
    const largos = d.filter((x) => x >= PASE_M.largo.min).length / d.length;
    informe("pases cortos · largos", `${cortos.toFixed(3)} · ${largos.toFixed(3)}`);
    expect(cortos).toBeGreaterThanOrEqual(PASE_MEZCLA.cortosMin);
    expect(cortos).toBeLessThanOrEqual(PASE_MEZCLA.cortosMax);
    expect(largos).toBeGreaterThanOrEqual(PASE_MEZCLA.largosMin);
    expect(largos).toBeLessThanOrEqual(PASE_MEZCLA.largosMax);
  });

  it.each(["duelo_ganado", "perdidas_en_salida", "dominio_global", "dominio_por_canal"] as TipoHecho[])(
    "rareza: %s aparece en ≤ RAREZA_MICRO_MAX de los partidos (y al menos en alguno)",
    (tipo) => {
      const n = corpus.filter((p) => analizar(p).some((h) => h.tipo === tipo)).length;
      informe(`rareza ${tipo}`, `${((n * 100) / N_ESTADISTICA).toFixed(1)} %`);
      expect(n).toBeGreaterThan(0);
      expect(n / N_ESTADISTICA).toBeLessThanOrEqual(RAREZA_MICRO_MAX);
    },
  );
});
