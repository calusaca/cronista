// Brief 025 — los insólitos sobre el corpus de liga COMPLETO (8 ligas × 90 partidos, temporada
// actual): todas las invariantes, cada rareza medida (recuento propio) dentro de su banda de
// limites.ts y NINGUNA vacía; y el A/B de la niebla (N_AB por brazo, mismas semillas).
//
// Copia independiente: las bandas (RAREZA_INSOLITOS, AB_NIEBLA) se escribieron en limites.ts aparte
// de las probabilidades del generador (parametros.INSOLITOS), que esta prueba NO importa.
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import { RAREZA_CONDICION_MAX, TEMPORADA_ACTUAL } from "../../analista/umbrales";
import { mundo } from "../../mundo/mundo";
import { configDePartidoLiga } from "../../mundo/temporada";
import { VERIFICADORES } from "../invariantes";
import { AB_NIEBLA, N_AB, PASE_M, RAREZA_INSOLITOS as R, SUBIDA_MINUTO_MIN } from "../limites";
import { micro, type MicroPartido } from "../micro";
import { simular } from "../motor";
import { configDeSemilla } from "../plantillas";
import type { Condiciones, Partido } from "../tipos";

const informe = (k: string, v: string) => console.log(`[insólitos 025] ${k}: ${v}`);
const pct = (a: number, b: number) => `${((a * 100) / b).toFixed(2)} %`;
const enBanda = (x: number, b: { min: number; max: number }, nombre: string) => {
  expect(x, nombre).toBeGreaterThanOrEqual(b.min);
  expect(x, nombre).toBeLessThanOrEqual(b.max);
};

const corpus: Partido[] = mundo().ligas.flatMap((liga) => Array.from({ length: 90 }, (_, k) => simular(configDePartidoLiga(liga, TEMPORADA_ACTUAL, Math.floor(k / 5) + 1, (k % 5) + 1))));

describe(`025 · corpus de liga completo (${corpus.length} partidos)`, () => {
  it("todas las invariantes con la variante encendida", () => {
    expect(corpus.every((p) => p.config.variantes?.insolitos === true)).toBe(true);
    const fallas = corpus.flatMap((p) => Object.entries(VERIFICADORES).flatMap(([n, v]) => v(p).map((e) => `${p.config.seed} ${n}: ${e}`)));
    expect(fallas.slice(0, 10)).toEqual([]);
  });

  it("rarezas medidas (recuento propio) en su banda; ninguna vacía", () => {
    let goles = 0;
    let olimpicos = 0;
    let elegibles = 0;
    let subidas = 0;
    let golesPortero = 0;
    let noGol = 0;
    let palo = 0;
    let doble = 0;
    let conInterrupcion = 0;
    for (const p of corpus) {
      const marc = { local: 0, visita: 0 };
      // «tiros no gol» (brief): todo tiro sin gol, atajados incluidos (los penales también cuentan).
      const convertidos = new Set(p.eventos.filter((e) => e.tipo === "gol" && e.relacionadoCon).map((e) => e.relacionadoCon));
      const por = new Set(["local", "visita"].flatMap((l) => p.config[l as "local"].jugadores.filter((j) => j.posicion === "POR").map((j) => `${l}|${j.nombre}`)));
      for (const e of p.eventos) {
        if (e.tipo === "gol") {
          goles++;
          marc[e.equipo]++;
          if (e.definicion === "olimpico") olimpicos++;
          if (!e.autogol && por.has(`${e.equipo}|${e.jugador}`)) golesPortero++;
        }
        // córner elegible: desde el minuto de la subida, el que lo saca pierde por exactamente uno
        if (e.tipo === "corner" && e.minuto >= SUBIDA_MINUTO_MIN && marc[e.equipo === "local" ? "visita" : "local"] - marc[e.equipo] === 1) elegibles++;
        if (e.tipo === "subida_portero") subidas++;
        if (e.tipo === "tiro" && !convertidos.has(e.id)) noGol++;
        if (e.alPalo !== undefined) {
          palo++;
          if (e.alPalo === 2) doble++;
        }
      }
      if (p.eventos.some((e) => e.tipo === "interrupcion")) conInterrupcion++;
    }
    informe("olímpico", `${olimpicos} de ${goles} goles (${pct(olimpicos, goles)})`);
    informe("subida del portero", `${subidas} de ${elegibles} córners elegibles (${pct(subidas, elegibles)}); goles de portero: ${golesPortero}`);
    informe("al palo", `${palo} de ${noGol} tiros no gol (${pct(palo, noGol)})`);
    informe("doble palo", `${doble} de ${palo} tiros al palo (${pct(doble, palo)})`);
    informe("interrupción", `${conInterrupcion} de ${corpus.length} partidos (${pct(conInterrupcion, corpus.length)})`);
    for (const [n, k] of [["olímpico", olimpicos], ["subida", subidas], ["palo", palo], ["doble", doble], ["interrupción", conInterrupcion]] as const) expect(k, `${n}: banda vacía`).toBeGreaterThan(0);
    enBanda(olimpicos / goles, R.olimpico, "olímpico");
    enBanda(subidas / elegibles, R.subida, "subida");
    enBanda(palo / noGol, R.alPalo, "al palo");
    enBanda(doble / palo, R.doblePalo, "doble palo");
    enBanda(conInterrupcion / corpus.length, R.interrupcion, "interrupción");
  });

  it("efecto_niebla: solo en partidos con niebla, y raro (≤ el techo de los efectos del 018)", () => {
    let niebla = 0;
    let efecto = 0;
    for (const p of corpus) {
      const tiene = analizar(p).some((h) => h.tipo === "efecto_niebla");
      if (p.config.condiciones?.clima === "niebla") niebla++;
      else expect(tiene, `${p.config.seed}`).toBe(false);
      if (tiene) efecto++;
    }
    informe("niebla", `${niebla} partidos con niebla (${pct(niebla, corpus.length)}); efecto_niebla en ${efecto} (${pct(efecto, niebla)} de ellos)`);
    expect(niebla).toBeGreaterThan(0);
    expect(efecto).toBeGreaterThan(0);
    expect(efecto / corpus.length).toBeLessThanOrEqual(RAREZA_CONDICION_MAX);
  });
});

describe(`025 · A/B de la niebla, N = ${N_AB} por brazo`, () => {
  const NEUTRAS: Condiciones = { clima: "despejado", superficie: "natural", cesped: "corto", presion: { local: "baja", visita: "media" } };
  const brazo = (c: Condiciones): MicroPartido[] => Array.from({ length: N_AB }, (_, i) => micro(simular({ ...configDeSemilla(i + 1), condiciones: c, variantes: { insolitos: true } })));
  const completacion = (xs: MicroPartido[], f: (d: number) => boolean) => {
    const ps = xs.flatMap((m) => m.eventos.filter((x) => x.tipo === "pase" && x.distanciaM !== undefined && f(x.distanciaM)));
    return ps.filter((x) => x.completado).length / ps.length;
  };
  it("niebla ⇒ los pases LARGOS se completan menos; los cortos, igual", () => {
    const control = brazo(NEUTRAS);
    const niebla = brazo({ ...NEUTRAS, clima: "niebla" });
    const largo = (d: number) => d >= PASE_M.largo.min;
    const corto = (d: number) => d < PASE_M.corto.max;
    const dl = completacion(niebla, largo) - completacion(control, largo);
    const dc = completacion(niebla, corto) - completacion(control, corto);
    informe("A/B niebla · largos · cortos (diferencias)", `${dl.toFixed(4)} · ${dc.toFixed(4)}`);
    enBanda(dl, AB_NIEBLA.largos, "largos");
    expect(Math.abs(dc)).toBeLessThanOrEqual(AB_NIEBLA.cortosTolerancia);
  });
});
