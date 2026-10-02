// Brief 018 — el corpus de liga COMPLETO (8 ligas × 90 partidos, temporada actual): todas las
// invariantes con condiciones, los hechos de efecto jamás sin su medición (recuento propio) y su
// rareza medida e informada. `npm run test:stats`. Umbrales importados: nada repetido a mano.
import { describe, expect, it } from "vitest";
import { mundo } from "../../mundo/mundo";
import { configDePartidoLiga } from "../../mundo/temporada";
import { VERIFICADORES } from "../../sim/invariantes";
import { PASE_M, SALIDA_TEMPRANA_MIN } from "../../sim/limites";
import { micro } from "../../sim/micro";
import { simular } from "../../sim/motor";
import type { Partido } from "../../sim/tipos";
import { analizar } from "../analista";
import type { Hecho } from "../tipos";
import { RAREZA_MICRO_MAX, CALOR_PASES_2T_MAX, CANCHA_CORTOS_MAX, CANCHA_CORTOS_MUESTRA_MIN, PRESION_PERDIDAS_MIN, RAREZA_CONDICION_MAX, TEMPORADA_ACTUAL } from "../umbrales";

const corpus: { p: Partido; hs: Hecho[] }[] = mundo().ligas.flatMap((liga) =>
  Array.from({ length: 90 }, (_, k) => {
    const p = simular(configDePartidoLiga(liga, TEMPORADA_ACTUAL, Math.floor(k / 5) + 1, (k % 5) + 1));
    return { p, hs: analizar(p) };
  }),
);
const informe = (k: string, v: string) => console.log(`[liga 018] ${k}: ${v}`);
const pct = (a: number, b: number) => `${((a * 100) / b).toFixed(1)} %`;

describe(`018 · corpus de liga completo (${corpus.length} partidos)`, () => {
  it("todas las invariantes del motor y de la capa micro, con condiciones", () => {
    const fallas = corpus.flatMap(({ p }) => Object.entries(VERIFICADORES).flatMap(([n, v]) => v(p).map((e) => `${p.config.seed} ${n}: ${e}`)));
    expect(fallas.slice(0, 10)).toEqual([]);
  });

  it("los hechos de efecto jamás sin su medición (recuento propio), y su rareza en banda", () => {
    const n = { efecto_calor: 0, cancha_incomoda: 0, presion_que_ahoga: 0 };
    const con = { calor: 0, alto: 0, altoSeco: 0, alta: 0 };
    const errores: string[] = [];
    for (const { p, hs } of corpus) {
      const k = p.config.condiciones!;
      const m = micro(p);
      const per = new Map<string, number>();
      let ini = 0;
      for (const e of p.eventos) {
        if (e.tipo === "inicio_periodo") ini++;
        per.set(e.id, ini);
      }
      const pases = m.eventos.filter((x) => x.tipo === "pase");
      const a = pases.filter((x) => per.get(x.ancla) === 1).length;
      const b = pases.length - a;
      const cortos = pases.filter((x) => x.equipo === "visita" && x.distanciaM !== undefined && x.distanciaM < PASE_M.corto.max);
      const ok = cortos.filter((x) => x.completado).length;
      const lado = k.presion.visita === "alta" ? "visita" : k.presion.local === "alta" ? "local" : undefined;
      const perd = lado ? m.eventos.filter((x) => x.tipo === "perdida" && x.equipo === lado && x.zona === "defensa" && x.minuto < SALIDA_TEMPRANA_MIN).length : 0;
      const alto = k.superficie === "natural" && k.cesped === "alto";
      const esperado = {
        efecto_calor: k.clima === "calor" && b * 100 <= CALOR_PASES_2T_MAX * a,
        cancha_incomoda: alto && k.clima !== "lluvia" && cortos.length >= CANCHA_CORTOS_MUESTRA_MIN && ok * 100 <= CANCHA_CORTOS_MAX * cortos.length,
        presion_que_ahoga: lado !== undefined && perd >= PRESION_PERDIDAS_MIN,
      };
      if (k.clima === "calor") con.calor++;
      if (alto) con.alto++;
      if (alto && k.clima !== "lluvia") con.altoSeco++;
      if (lado) con.alta++;
      for (const t of Object.keys(esperado) as (keyof typeof esperado)[]) {
        const tiene = hs.some((h) => h.tipo === t);
        if (tiene !== esperado[t]) errores.push(`${p.config.seed} ${t}: hecho ${tiene}, medición ${esperado[t]}`);
        if (tiene) n[t]++;
      }
    }
    expect(errores.slice(0, 10)).toEqual([]);
    informe("efecto_calor", `${pct(n.efecto_calor, corpus.length)} de los partidos · ${pct(n.efecto_calor, con.calor)} de los ${con.calor} con calor`);
    informe("cancha_incomoda", `${pct(n.cancha_incomoda, corpus.length)} de los partidos · ${pct(n.cancha_incomoda, con.alto)} de los ${con.alto} con césped alto · ${pct(n.cancha_incomoda, con.altoSeco)} de los ${con.altoSeco} con césped alto sin lluvia`);
    informe("presion_que_ahoga", `${pct(n.presion_que_ahoga, corpus.length)} de los partidos · ${pct(n.presion_que_ahoga, con.alta)} de los ${con.alta} con presión alta`);
    for (const t of Object.keys(n) as (keyof typeof n)[]) {
      expect(n[t], t).toBeGreaterThan(0);
      expect(n[t] / corpus.length, t).toBeLessThanOrEqual(RAREZA_CONDICION_MAX);
    }
  });

  it("perdidas_en_salida en liga, con la subsunción de presion_que_ahoga: bajo el techo del 013", () => {
    const n = corpus.filter(({ hs }) => hs.some((h) => h.tipo === "perdidas_en_salida")).length;
    informe("perdidas_en_salida (con subsunción)", pct(n, corpus.length));
    expect(n / corpus.length).toBeLessThanOrEqual(RAREZA_MICRO_MAX);
  });

  it("informe: rareza de los hechos del 013 en el corpus de liga (la presión alta suma pérdidas en salida)", () => {
    for (const t of ["perdidas_en_salida", "duelo_ganado", "dominio_global", "dominio_por_canal"]) {
      const total = corpus.filter(({ hs }) => hs.some((h) => h.tipo === t)).length;
      const alta = corpus.filter(({ p }) => p.config.condiciones!.presion.visita === "alta");
      const enAlta = alta.filter(({ hs }) => hs.some((h) => h.tipo === t)).length;
      informe(t, `${pct(total, corpus.length)} (con presión alta: ${pct(enAlta, alta.length)}; sin: ${pct(total - enAlta, corpus.length - alta.length)})`);
    }
    expect(corpus.length).toBe(mundo().ligas.length * 90);
  });
});
