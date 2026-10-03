// Brief 019 §2 — lesiones en el simulador, GATED por config.variantes. Regla de oro: sin la
// variante (ausente, `undefined`, `{}` o `lesiones: false`) el partido es byte a byte el de
// siempre; con ella, toda lesión saca al lesionado con un cambio forzado y nunca reaparece.
import { describe, expect, it } from "vitest";
import { verificarLesiones, VERIFICADORES } from "../invariantes";
import { LESION_JORNADAS } from "../limites";
import { micro } from "../micro";
import { simular, validarConfig } from "../motor";
import { configDeSemilla } from "../plantillas";
import type { Partido, SimConfig } from "../tipos";

const json = (x: unknown) => JSON.stringify(x);
const conLesiones = (cfg: SimConfig): SimConfig => ({ ...cfg, variantes: { lesiones: true } });
const corpus: Partido[] = Array.from({ length: 300 }, (_, i) => simular(conLesiones(configDeSemilla(i + 1))));

describe("019 · regla de oro: sin la variante, el partido de siempre", () => {
  it("misma semilla con y sin `variantes: undefined` ⇒ Partido y capa micro byte a byte idénticos (1..200)", () => {
    const distintas: number[] = [];
    for (let s = 1; s <= 200; s++) {
      const cfg = configDeSemilla(s);
      const a = simular(cfg);
      const b = simular({ ...cfg, variantes: undefined, bajas: undefined });
      if (json(a) !== json(b) || json(micro(a)) !== json(micro(b))) distintas.push(s);
    }
    expect(distintas).toEqual([]);
  });

  it("`variantes: {}` y `lesiones: false` ⇒ mismos eventos (1..100)", () => {
    for (let s = 1; s <= 100; s++) {
      const cfg = configDeSemilla(s);
      const base = json(simular(cfg).eventos);
      expect(json(simular({ ...cfg, variantes: {} }).eventos)).toBe(base);
      expect(json(simular({ ...cfg, variantes: { lesiones: false } }).eventos)).toBe(base);
    }
  });

  it("con la variante, un partido SIN lesión es el de siempre (los sorteos son derivados: no tocan el stream)", () => {
    let sin = 0;
    corpus.forEach((p, i) => {
      if (p.eventos.some((e) => e.tipo === "lesion")) return;
      sin++;
      expect(json(p.eventos)).toBe(json(simular(configDeSemilla(i + 1)).eventos));
    });
    expect(sin).toBeGreaterThan(0);
  });
});

describe("019 · con la variante: lesiones coherentes", () => {
  it("hay lesiones, de falta y de sobreesfuerzo, con su baja en LESION_JORNADAS", () => {
    const ls = corpus.flatMap((p) => p.eventos.filter((e) => e.tipo === "lesion"));
    expect(ls.length).toBeGreaterThan(0);
    expect(ls.some((e) => e.relacionadoCon !== undefined)).toBe(true);
    expect(ls.some((e) => e.relacionadoCon === undefined)).toBe(true);
    for (const e of ls) {
      expect(e.baja).toBeGreaterThanOrEqual(LESION_JORNADAS.min);
      expect(e.baja).toBeLessThanOrEqual(LESION_JORNADAS.max);
    }
  });

  it("todas las invariantes (incluida la de lesiones y la capa micro) en 1..300", () => {
    const fallas = corpus.flatMap((p) => Object.entries(VERIFICADORES).flatMap(([n, v]) => v(p).map((e) => `${p.config.seed} ${n}: ${e}`)));
    expect(VERIFICADORES.lesiones).toBe(verificarLesiones);
    expect(fallas.slice(0, 10)).toEqual([]);
  });

  it("el invariante caza a un lesionado que reaparece, una lesión sin su cambio y una lesión sin la variante", () => {
    const p = corpus.find((x) => x.eventos.some((e) => e.tipo === "lesion"))!;
    const i = p.eventos.findIndex((e) => e.tipo === "lesion");
    const lesionado = p.eventos[i]!.jugador!;
    const reaparece: Partido = JSON.parse(json(p));
    const tarde = reaparece.eventos.findIndex((e, k) => k > i + 1 && e.equipo === reaparece.eventos[i]!.equipo && e.jugador !== undefined && e.tipo !== "cambio");
    if (tarde > 0) {
      reaparece.eventos[tarde]!.jugador = lesionado;
      expect(verificarLesiones(reaparece).some((x) => x.includes("reaparece"))).toBe(true);
    }
    const sinCambio: Partido = JSON.parse(json(p));
    sinCambio.eventos.splice(i + 1, 1);
    expect(verificarLesiones(sinCambio).some((x) => x.includes("cambio forzado"))).toBe(true);
    const sinVariante: Partido = JSON.parse(json(p));
    delete sinVariante.config.variantes;
    expect(verificarLesiones(sinVariante).some((x) => x.includes("sin la variante"))).toBe(true);
  });

  it("propiedad de prefijo de la capa micro con lesiones", () => {
    const fallas: string[] = [];
    for (const p of corpus.filter((x) => x.eventos.some((e) => e.tipo === "lesion")).slice(0, 40)) {
      const full = micro(p);
      p.eventos.forEach((e, k) => {
        if (e.tipo !== "lesion" && e.tipo !== "gol" && e.tipo !== "fin_periodo") return;
        const mp = micro({ config: p.config, eventos: p.eventos.slice(0, k + 1) });
        if (json(mp.eventos) !== json(full.eventos.slice(0, mp.eventos.length))) fallas.push(`${p.config.seed} k=${k}`);
      });
    }
    expect(fallas).toEqual([]);
  });

  it("una baja del registro no puede estar en la plantilla de su equipo (validarConfig lanza; el invariante la caza)", () => {
    const cfg = configDeSemilla(5);
    const nombre = cfg.local.jugadores[3]!.nombre;
    const mala: SimConfig = { ...cfg, bajas: { local: [{ jugador: nombre, motivo: "suspension", jornadas: 1 }] } };
    expect(() => validarConfig(mala)).toThrow(/baja/);
    expect(verificarLesiones({ config: mala, eventos: [] }).length).toBeGreaterThan(0);
  });
});
