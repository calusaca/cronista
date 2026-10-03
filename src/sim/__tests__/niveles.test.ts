// Brief 024 — nivel por jugador (suite rápida). Regla de oro: sin la variante, el partido es byte a
// byte el de siempre (también con niveles puestos y la variante apagada). Tope de plantel EXACTO
// sobre los 80 equipos del mundo (oráculo propio), niveles derivados (el mundo no cambia),
// invariantes con la variante y propiedad de prefijo de la capa micro.
import { describe, expect, it } from "vitest";
import { mundo } from "../../mundo/mundo";
import { crearMundo } from "../../mundo/mundo";
import { configDePartidoLiga } from "../../mundo/temporada";
import { TEMPORADA_ACTUAL } from "../../analista/umbrales";
import { verificarNiveles, VERIFICADORES } from "../invariantes";
import { NIVEL } from "../limites";
import { micro } from "../micro";
import { simular, validarConfig } from "../motor";
import { conNiveles, nivelesDe } from "../niveles";
import { NIVELES } from "../parametros";
import { configDeSemilla } from "../plantillas";
import type { Partido, SimConfig } from "../tipos";

const json = (x: unknown) => JSON.stringify(x);
const conNiv = (c: SimConfig, variante?: boolean): SimConfig => ({
  ...c,
  local: conNiveles(c.local, nivelesDe(c.local)),
  visita: conNiveles(c.visita, nivelesDe(c.visita)),
  ...(variante === undefined ? {} : { variantes: { niveles: variante } }),
});

describe("024 · regla de oro: sin la variante, el partido de siempre", () => {
  it("misma semilla con y sin `variantes: undefined` ⇒ Partido y capa micro idénticos (1..200)", () => {
    for (let s = 1; s <= 200; s++) {
      const cfg = configDeSemilla(s);
      const a = simular(cfg);
      const b = simular({ ...cfg, variantes: undefined });
      expect(json(b), `seed ${s}`).toBe(json(a));
      if (s <= 60) expect(json(micro(b))).toBe(json(micro(a)));
    }
  });

  it("con niveles puestos pero la variante apagada (o ausente) ⇒ los mismos eventos y la misma capa micro", () => {
    for (let s = 1; s <= 80; s++) {
      const base = simular(configDeSemilla(s));
      for (const v of [undefined, false]) {
        const p = simular(conNiv(configDeSemilla(s), v));
        expect(json(p.eventos), `seed ${s} ${String(v)}`).toBe(json(base.eventos));
        if (s <= 30) expect(json(micro(p).eventos)).toBe(json(micro(base).eventos));
      }
    }
  });
});

describe("024 · generación derivada y tope de plantel (oráculo)", () => {
  const equipos = mundo().ligas.flatMap((l) => l.equipos);

  it("80 equipos: el promedio de los 16 es EXACTAMENTE la media (ataque + defensa) / 2, y todo nivel en su recorte", () => {
    expect(equipos).toHaveLength(80);
    for (const e of equipos) {
      const n = nivelesDe(e.equipo, e.reservas);
      const media = (e.equipo.ataque + e.equipo.defensa) / 2;
      const plantel = e.equipo.jugadores.map((j) => n.get(j.nombre) as number);
      expect(plantel).toHaveLength(16);
      // Oráculo: la suma entera, sin pasar por coma flotante.
      expect(plantel.reduce((a, b) => a + b, 0), e.equipo.nombre).toBe(Math.round(16 * media));
      for (const v of [...plantel, ...e.reservas.map((r) => n.get(r.nombre) as number)]) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(Math.max(NIVEL.min, Math.ceil(media - NIVELES.recorte)));
        expect(v).toBeLessThanOrEqual(Math.min(NIVEL.max, Math.floor(media + NIVELES.recorte)));
      }
    }
  });

  it("derivado y puro: dos veces lo mismo; no toca el equipo; el mundo del 016 no cambia ni una letra", () => {
    const e = equipos[3]!;
    const antes = json(e);
    expect([...nivelesDe(e.equipo, e.reservas)]).toEqual([...nivelesDe(e.equipo, e.reservas)]);
    expect(json(e)).toBe(antes);
    expect(json(crearMundo())).toBe(json(mundo()));
    // hay dispersión real (no son todos la media)
    expect(new Set(e.equipo.jugadores.map((j) => nivelesDe(e.equipo).get(j.nombre))).size).toBeGreaterThan(4);
  });
});

describe("024 · con la variante: contrato e invariantes", () => {
  const corpus: Partido[] = Array.from({ length: 150 }, (_, i) => simular(conNiv(configDeSemilla(i + 1), true)));

  it("todas las invariantes (incluida la de niveles y la capa micro) en 1..150", () => {
    expect(VERIFICADORES.niveles).toBe(verificarNiveles);
    const fallas = corpus.flatMap((p) => Object.entries(VERIFICADORES).flatMap(([n, v]) => v(p).map((x) => `${p.config.seed} ${n}: ${x}`)));
    expect(fallas.slice(0, 10)).toEqual([]);
  });

  it("la variante sin niveles en los jugadores ⇒ validarConfig lanza y el invariante lo caza", () => {
    const mala: SimConfig = { ...configDeSemilla(9), variantes: { niveles: true } };
    expect(() => validarConfig(mala)).toThrow(/nivel/);
    expect(verificarNiveles({ config: mala, eventos: [] }).length).toBeGreaterThan(0);
  });

  it("propiedad de prefijo de la capa micro con niveles", () => {
    const fallas: string[] = [];
    for (const p of corpus.slice(0, 30)) {
      const full = micro(p);
      p.eventos.forEach((e, k) => {
        if (e.tipo !== "gol" && e.tipo !== "fin_periodo") return;
        const mp = micro({ config: p.config, eventos: p.eventos.slice(0, k + 1) });
        if (json(mp.eventos) !== json(full.eventos.slice(0, mp.eventos.length))) fallas.push(`${p.config.seed} k=${k}`);
      });
    }
    expect(fallas).toEqual([]);
  });

  it("la liga enciende la variante y cada jugador de cada alineación trae el nivel de su equipo del mundo", () => {
    for (const l of mundo().ligas.slice(0, 2)) {
      for (const [j, i] of [[1, 1], [9, 3], [18, 5]] as const) {
        const c = configDePartidoLiga(l, TEMPORADA_ACTUAL, j, i);
        expect(c.variantes?.niveles).toBe(true);
        for (const lado of ["local", "visita"] as const) {
          const eq = l.equipos.find((e) => e.equipo.nombre === c[lado].nombre)!;
          const n = nivelesDe(eq.equipo, eq.reservas);
          for (const x of c[lado].jugadores) expect(x.nivel, `${l.id} ${j}/${i} ${x.nombre}`).toBe(n.get(x.nombre));
        }
      }
    }
  });
});
