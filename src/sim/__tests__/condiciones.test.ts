// Brief 018 — condiciones del partido en el simulador (suite rápida). La regla de oro: sin
// condiciones (o con `condiciones: undefined`) el partido es BYTE A BYTE el de siempre; con
// condiciones neutras, también. Determinismo con condiciones, contrato e invariantes, y la
// propiedad de prefijo de la capa micro intacta. Los A/B estadísticos (N_AB por brazo) viven en
// condiciones.stats.test.ts. Vocabularios y bandas, de limites.ts: nada repetido a mano.
import { describe, expect, it } from "vitest";
import { TEMPORADA_ACTUAL } from "../../analista/umbrales";
import { mundo } from "../../mundo/mundo";
import { condicionesDePartido, configDePartidoLiga, cruceDe } from "../../mundo/temporada";
import { castigoPase, extraVelocidad, factorAtaque, factorCornerTrasAtajada, factorFaltas, factorMediaDistancia, factorRitmo, intensidadCalor } from "../condiciones";
import { verificarCondiciones, VERIFICADORES } from "../invariantes";
import { CESPEDES, CLIMAS_PARTIDO, NIVELES_PRESION, SUPERFICIES, TEMPERATURA_C } from "../limites";
import { micro } from "../micro";
import { simular, validarConfig } from "../motor";
import { configDeSemilla } from "../plantillas";
import type { Condiciones, Evento, Partido, SimConfig } from "../tipos";

const NEUTRAS: Condiciones = { clima: "despejado", superficie: "natural", cesped: "corto", presion: { local: "baja", visita: "media" } };
const con = (cfg: SimConfig, c: Condiciones): SimConfig => ({ ...cfg, condiciones: c });
const json = (x: unknown) => JSON.stringify(x);

describe("018 · regla de oro: sin condiciones, el partido de siempre", () => {
  it("misma semilla con y sin `condiciones: undefined` ⇒ Partido y capa micro byte a byte idénticos (1..200)", () => {
    const distintas: number[] = [];
    for (let s = 1; s <= 200; s++) {
      const cfg = configDeSemilla(s);
      const a = simular(cfg);
      const b = simular({ ...cfg, condiciones: undefined });
      if (json(a) !== json(b) || json(micro(a)) !== json(micro(b))) distintas.push(s);
      if ("condiciones" in b.config) distintas.push(-s); // ni siquiera la clave sobrevive
    }
    expect(distintas).toEqual([]);
  });

  it("condiciones NEUTRAS (despejado, natural corto, sin presión alta) ⇒ mismos eventos y misma capa micro (1..150)", () => {
    const distintas: number[] = [];
    for (let s = 1; s <= 150; s++) {
      const cfg = configDeSemilla(s);
      const a = simular(cfg);
      const b = simular(con(cfg, NEUTRAS));
      if (json(a.eventos) !== json(b.eventos) || json(micro(a)) !== json(micro(b))) distintas.push(s);
    }
    expect(distintas).toEqual([]);
  });

  it("el frío (registrado, sin efecto en el brief) tampoco cambia nada", () => {
    for (let s = 1; s <= 60; s++) {
      const cfg = configDeSemilla(s);
      const b = simular(con(cfg, { ...NEUTRAS, clima: "frio", temperaturaC: TEMPERATURA_C.frio.min }));
      expect(json(b.eventos)).toBe(json(simular(cfg).eventos));
    }
  });

  it("los modificadores devuelven el neutro EXACTO sin condiciones o con las neutras", () => {
    for (const c of [undefined, NEUTRAS]) {
      for (const per of [1, 2] as const) {
        expect(factorAtaque(c, per)).toBe(1);
        expect(factorRitmo(c, per)).toBe(1);
        expect(factorFaltas(c, per)).toBe(1);
      }
      expect(factorCornerTrasAtajada(c)).toBe(1);
      expect(factorMediaDistancia(c)).toBe(1);
      expect(extraVelocidad(c)).toBe(0);
      for (const lado of ["local", "visita"] as const) for (const zona of ["defensa", "medio", "ataque"] as const) for (const clase of ["corto", "medio", "largo"] as const) expect(castigoPase(c, lado, zona, clase, 0)).toBe(0);
    }
  });

  it("cada modificador actúa SOLO donde dice el brief", () => {
    const calor = (t: number): Condiciones => ({ ...NEUTRAS, clima: "calor", temperaturaC: t });
    // 1 y 2: solo el 2.º tiempo, y más con más calor
    expect(factorAtaque(calor(TEMPERATURA_C.calor.max), 1)).toBe(1);
    expect(factorFaltas(calor(TEMPERATURA_C.calor.max), 1)).toBe(1);
    expect(factorRitmo(calor(TEMPERATURA_C.calor.max), 2)).toBeLessThan(factorRitmo(calor(TEMPERATURA_C.calor.min), 2));
    expect(factorAtaque(calor(TEMPERATURA_C.calor.max), 2)).toBeLessThan(1);
    expect(factorFaltas(calor(TEMPERATURA_C.calor.max), 2)).toBeGreaterThan(factorFaltas(calor(TEMPERATURA_C.calor.min), 2));
    expect(intensidadCalor(calor(TEMPERATURA_C.calor.max))).toBe(1);
    // 5: solo el visitante, solo pases cortos, solo césped natural alto
    const alto: Condiciones = { ...NEUTRAS, cesped: "alto" };
    expect(castigoPase(alto, "visita", "medio", "corto", 50)).toBeGreaterThan(0);
    expect(castigoPase(alto, "local", "medio", "corto", 50)).toBe(0);
    expect(castigoPase(alto, "visita", "medio", "largo", 50)).toBe(0);
    // 6: solo el presionado, solo en su salida, solo antes de la ventana
    const presion: Condiciones = { ...NEUTRAS, presion: { local: "media", visita: "alta" } };
    expect(castigoPase(presion, "visita", "defensa", "medio", 0)).toBeGreaterThan(0);
    expect(castigoPase(presion, "visita", "medio", "medio", 0)).toBe(0);
    expect(castigoPase(presion, "local", "defensa", "medio", 0)).toBe(0);
    expect(castigoPase(presion, "visita", "defensa", "medio", 90)).toBe(0);
  });
});

describe("018 · determinismo con condiciones", () => {
  const cfg = configDePartidoLiga(mundo().ligas[2]!, TEMPORADA_ACTUAL, 9, 3);
  it("la misma config de liga dos veces ⇒ el mismo Partido y la misma capa micro", () => {
    expect(json(simular(cfg))).toBe(json(simular(configDePartidoLiga(mundo().ligas[2]!, TEMPORADA_ACTUAL, 9, 3))));
    expect(json(micro(simular(cfg)))).toBe(json(micro(simular(cfg))));
  });

  it("clima reproducible por partido de liga y distinto entre partidos (no un valor fijo)", () => {
    const vistos = new Set<string>();
    for (const liga of mundo().ligas) {
      for (let j = 1; j <= 18; j++) {
        for (let i = 1; i <= 5; i++) {
          const cfg = configDePartidoLiga(liga, TEMPORADA_ACTUAL, j, i);
          const a = cfg.condiciones as Condiciones;
          const b = condicionesDePartido(liga, cruceDe(liga, j, i)!, cfg.seed);
          // Brief 027: a puerta cerrada, lo único que cambia es la presión (baja para ambos).
          const cerrada = (cfg.sancionesClub ?? []).some((s) => s.tipo === "puerta_cerrada");
          expect(cerrada ? { ...b, presion: { local: "baja", visita: "baja" } } : b).toEqual(a);
          vistos.add(a.clima);
        }
      }
    }
    expect([...vistos].sort()).toEqual([...CLIMAS_PARTIDO].sort());
  });

  it("la cancha es la del LOCAL y la presión del visitante, un nivel por encima", () => {
    for (const liga of mundo().ligas) {
      for (let j = 1; j <= 18; j++) {
        for (let i = 1; i <= 5; i++) {
          const cfg = configDePartidoLiga(liga, TEMPORADA_ACTUAL, j, i);
          const c = cfg.condiciones as Condiciones;
          const cancha = liga.equipos[cruceDe(liga, j, i)!.local]!.cancha;
          expect(c.superficie).toBe(cancha.superficie);
          expect(c.cesped).toBe(cancha.superficie === "natural" ? cancha.cesped : undefined);
          // Brief 027 (extensión consciente): a puerta cerrada, sin público, presión baja para AMBOS.
          if ((cfg.sancionesClub ?? []).some((s) => s.tipo === "puerta_cerrada")) expect(c.presion).toEqual({ local: "baja", visita: "baja" });
          else expect(NIVELES_PRESION.indexOf(c.presion.visita)).toBe(NIVELES_PRESION.indexOf(c.presion.local) + 1);
        }
      }
    }
  });
});

describe("018 · contrato de las condiciones", () => {
  const base = configDeSemilla(7);
  const malas: [string, Condiciones][] = [
    ["clima fuera de vocabulario", { ...NEUTRAS, clima: "granizo" as Condiciones["clima"] }],
    ["calor sin temperatura", { ...NEUTRAS, clima: "calor" }],
    ["calor bajo su banda", { ...NEUTRAS, clima: "calor", temperaturaC: TEMPERATURA_C.calor.min - 1 }],
    ["frío sobre su banda", { ...NEUTRAS, clima: "frio", temperaturaC: TEMPERATURA_C.frio.max + 1 }],
    ["despejado con temperatura", { ...NEUTRAS, temperaturaC: TEMPERATURA_C.calor.min }],
    ["natural sin césped", { ...NEUTRAS, cesped: undefined }],
    ["sintética con césped", { ...NEUTRAS, superficie: "sintetica", cesped: "alto" }],
    ["superficie fuera de vocabulario", { ...NEUTRAS, superficie: "tierra" as Condiciones["superficie"] }],
    ["visitante al mismo nivel", { ...NEUTRAS, presion: { local: "media", visita: "media" } }],
    ["visitante dos niveles arriba", { ...NEUTRAS, presion: { local: "baja", visita: "alta" } }],
  ];
  for (const [nombre, c] of malas) {
    it(`validarConfig lanza y el invariante la caza: ${nombre}`, () => {
      expect(() => validarConfig(con(base, c))).toThrow(/condiciones/);
      expect(verificarCondiciones({ config: con(base, c), eventos: [] }).length).toBeGreaterThan(0);
    });
  }

  it("los vocabularios de las condiciones del mundo son los de limites (y la guarda de entrada aplica el invariante)", () => {
    expect(VERIFICADORES.condiciones).toBe(verificarCondiciones);
    for (const liga of mundo().ligas) {
      const c = configDePartidoLiga(liga, TEMPORADA_ACTUAL, 1, 1).condiciones as Condiciones;
      expect(SUPERFICIES).toContain(c.superficie);
      if (c.cesped) expect(CESPEDES).toContain(c.cesped);
      expect(verificarCondiciones(simular(configDePartidoLiga(liga, TEMPORADA_ACTUAL, 1, 1)))).toEqual([]);
    }
  });
});

describe("018 · con condiciones, el partido sigue siendo un partido válido", () => {
  const condiciones: Condiciones[] = [
    { ...NEUTRAS, clima: "calor", temperaturaC: TEMPERATURA_C.calor.max },
    { ...NEUTRAS, clima: "lluvia" },
    { ...NEUTRAS, superficie: "sintetica", cesped: undefined },
    { ...NEUTRAS, cesped: "alto" },
    { ...NEUTRAS, presion: { local: "media", visita: "alta" } },
  ];
  it("todas las invariantes (incluidas las bandas del 015 en sintética y la capa micro) en 1..80 × 5 condiciones", () => {
    const fallas: string[] = [];
    for (const c of condiciones) {
      for (let s = 1; s <= 80; s++) {
        const p = simular(con(configDeSemilla(s), c));
        for (const [nombre, v] of Object.entries(VERIFICADORES)) for (const e of v(p)) fallas.push(`${c.clima}/${c.superficie}/${c.cesped}/${c.presion.visita} seed ${s} ${nombre}: ${e}`);
      }
    }
    expect(fallas.slice(0, 10)).toEqual([]);
  });

  it("propiedad de prefijo de la capa micro con condiciones (liga visible, todos los fines de periodo y goles)", () => {
    const liga = mundo().ligas[2]!;
    const fallas: string[] = [];
    for (let j = 1; j <= 6; j++) {
      for (let i = 1; i <= 5; i++) {
        const p = simular(configDePartidoLiga(liga, TEMPORADA_ACTUAL, j, i));
        const full = micro(p);
        p.eventos.forEach((e: Evento, k) => {
          if (e.tipo !== "gol" && e.tipo !== "fin_periodo") return;
          const pre: Partido = { config: p.config, eventos: p.eventos.slice(0, k + 1) };
          const mp = micro(pre);
          if (json(mp.eventos) !== json(full.eventos.slice(0, mp.eventos.length))) fallas.push(`${j}/${i} k=${k}`);
        });
      }
    }
    expect(fallas).toEqual([]);
  });
});
