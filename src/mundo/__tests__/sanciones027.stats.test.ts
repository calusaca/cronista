// Brief 027 — sanciones de club, suite estadística. (1) A/B de la puerta cerrada (N_AB por brazo,
// mismas semillas): con presión alta, el visitante pierde más balones en salida al principio (el
// efecto 6 del 018); a puerta cerrada ese efecto DESAPARECE — sus pérdidas tempranas vuelven a la
// base (banda aparte en limites). (2) Rareza del sorteo sobre 400 liga-temporadas (banda aparte).
// (3) Informe de cuánto pesa en la liga actual.
import { describe, expect, it } from "vitest";
import { TEMPORADA_ACTUAL } from "../../analista/umbrales";
import { AB_PUERTA_CERRADA, N_AB, RAREZA_SANCIONES_CLUB, SALIDA_TEMPRANA_MIN } from "../../sim/limites";
import { micro } from "../../sim/micro";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Condiciones, SimConfig } from "../../sim/tipos";
import { reacciones } from "../../vista/grada";
import { mundo } from "../mundo";
import { simularTemporada, sinPublico, sorteoSancionesClub } from "../temporada";

const informe = (k: string, v: string) => console.log(`[sanciones 027] ${k}: ${v}`);
const BASE: Condiciones = { clima: "despejado", superficie: "natural", cesped: "corto", presion: { local: "baja", visita: "media" } };
const perdidasTempranasVisita = (cfg: (s: number) => SimConfig) => {
  let n = 0;
  for (let i = 1; i <= N_AB; i++) n += micro(simular(cfg(i))).eventos.filter((x) => x.tipo === "perdida" && x.equipo === "visita" && x.zona === "defensa" && x.minuto < SALIDA_TEMPRANA_MIN).length;
  return n;
};

describe(`027 · A/B de la puerta cerrada, N = ${N_AB} por brazo`, () => {
  it("presión alta ⇒ más pérdidas tempranas del visitante; a puerta cerrada vuelven a la base (y la grada calla)", () => {
    const base = perdidasTempranasVisita((s) => ({ ...configDeSemilla(s), condiciones: BASE }));
    const alta = perdidasTempranasVisita((s) => ({ ...configDeSemilla(s), condiciones: { ...BASE, presion: { local: "media", visita: "alta" } } }));
    const cerradaCfg = (s: number): SimConfig => ({
      ...configDeSemilla(s),
      // la MISMA transformación que aplica la temporada (no una copia): partimos de la presión alta
      condiciones: sinPublico({ ...BASE, presion: { local: "media", visita: "alta" } }),
      variantes: { sanciones: true },
      sancionesClub: [{ lado: "local", tipo: "puerta_cerrada", causa: "incidentes_de_publico", partido: 1, de: 1 }],
    });
    const cerrada = perdidasTempranasVisita(cerradaCfg);
    informe("pérdidas tempranas del visitante (alta / cerrada / base)", `${alta} / ${cerrada} / ${base} · cocientes ${(alta / base).toFixed(3)} · ${(cerrada / base).toFixed(3)}`);
    expect(alta / base).toBeGreaterThan(AB_PUERTA_CERRADA.cocienteBase.max);
    expect(cerrada / base).toBeGreaterThanOrEqual(AB_PUERTA_CERRADA.cocienteBase.min);
    expect(cerrada / base).toBeLessThanOrEqual(AB_PUERTA_CERRADA.cocienteBase.max);
    for (let s = 1; s <= 60; s++) expect(reacciones(simular(cerradaCfg(s)))).toEqual([]);
  });
});

describe("027 · rareza del sorteo y su peso en la liga", () => {
  it("400 liga-temporadas: media de clubes sancionados en banda, nunca más de 2; los tres tipos aparecen", () => {
    let n = 0;
    let total = 0;
    const tipos: Record<string, number> = {};
    for (let t = 1; t <= 50; t++)
      for (const l of mundo().ligas) {
        const s = sorteoSancionesClub(l, t);
        n++;
        total += s.length;
        expect(s.length).toBeLessThanOrEqual(RAREZA_SANCIONES_CLUB.max);
        for (const x of s) tipos[x.tipo] = (tipos[x.tipo] ?? 0) + 1;
      }
    informe("clubes sancionados por liga y temporada", `${(total / n).toFixed(3)} (${total} en ${n}) · ${JSON.stringify(tipos)}`);
    expect(total / n).toBeGreaterThanOrEqual(RAREZA_SANCIONES_CLUB.media.min);
    expect(total / n).toBeLessThanOrEqual(RAREZA_SANCIONES_CLUB.media.max);
    expect(Object.keys(tipos).sort()).toEqual(["deduccion", "limite_banco", "puerta_cerrada"]);
  });

  it(`informe: temporada ${TEMPORADA_ACTUAL}, las 8 ligas — sanciones, partidos afectados y partidos que cambian`, () => {
    let afectados = 0;
    let cambian = 0;
    for (const l of mundo().ligas) {
      const on = simularTemporada(l, TEMPORADA_ACTUAL);
      const off = simularTemporada(l, TEMPORADA_ACTUAL, { sanciones: false });
      afectados += on.configs.filter((c) => (c.sancionesClub ?? []).length > 0).length;
      cambian += on.partidos.filter((p, k) => JSON.stringify(p) !== JSON.stringify(off.partidos[k])).length;
      if (on.sancionesClub!.length) informe(l.id, on.sancionesClub!.map((s) => `${s.tipo} · ${s.equipo} · j${s.jornadas.join(",")}${s.puntos ? ` · −${s.puntos}` : ""}`).join(" | "));
    }
    informe("partidos con sanción en la config · resultados que cambian (cascada del registro)", `${afectados} · ${cambian} de 720`);
    expect(afectados).toBeGreaterThan(0);
  });
});
