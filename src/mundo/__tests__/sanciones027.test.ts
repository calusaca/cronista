// Brief 027 — sanciones de club (suite rápida). Fixture reina: con las sanciones apagadas, cada
// temporada es byte a byte la del commit a92abf8. Con ellas: sorteo de listas cerradas, registro
// ⇔ configs (oráculo propio), tabla con deducciones (oráculo independiente), invariantes, la
// puerta cerrada (presión baja para ambos, grada muda), el banco limitado y su invariante.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CAUSAS_POR_TIPO, DEDUCCION_PUNTOS, LIMITE_BANCO_JORNADAS, PUERTA_CERRADA_PARTIDOS, TEMPORADA_ACTUAL } from "../../analista/umbrales";
import { verificarCondiciones, verificarSancionesClub, VERIFICADORES } from "../../sim/invariantes";
import { BANCO_LIMITADO, CAUSAS_SANCION_CLUB, RAREZA_SANCIONES_CLUB, TIPOS_SANCION_CLUB } from "../../sim/limites";
import { simular } from "../../sim/motor";
import { TITULARES, type Partido, type SancionClubPartido } from "../../sim/tipos";
import { reacciones } from "../../vista/grada";
import { mundo } from "../mundo";
import { calendarioDeLiga, simularTemporada, sorteoSancionesClub } from "../temporada";
import type { Liga, Temporada } from "../tipos";

const sha = (t: string) => createHash("sha256").update(t).digest("hex");
const json = (x: unknown) => JSON.stringify(x);
const liga = (id: string) => mundo().ligas.find((l) => l.id === id) as Liga;
const REINA = JSON.parse(readFileSync(new URL("../__fixtures__/temporada-026.json", import.meta.url), "utf8")) as { commit: string; temporada: number; porLiga: Record<string, string> };
/** Casos (temporada 1 y 2): fiordos T1 = puerta cerrada + deducción; cumbres T2 = puerta cerrada + banco limitado. */
const fiordos1 = simularTemporada(liga("liga-de-los-fiordos"), 1);
const cumbres2 = simularTemporada(liga("liga-de-las-cumbres"), 2);
const partidosDe = (t: Temporada): Partido[] => t.configs.map((c) => simular(c));

describe("027 · fixture reina: sin sanciones, la temporada de siempre", () => {
  it(`las 8 ligas, temporada ${REINA.temporada}: sha256 idéntico al del commit ${REINA.commit}`, () => {
    expect(REINA.temporada).toBe(TEMPORADA_ACTUAL);
    for (const l of mundo().ligas) expect(sha(json(simularTemporada(l, REINA.temporada, { sanciones: false }))), l.id).toBe(REINA.porLiga[l.id]);
  });

  it("con sanciones: determinista (dos veces idéntica) y la liga enciende la variante", () => {
    expect(json(simularTemporada(liga("liga-de-los-fiordos"), 1))).toBe(json(fiordos1));
    expect(fiordos1.configs.every((c) => c.variantes?.sanciones === true)).toBe(true);
  });

  it("una deducción no cambia ningún partido: solo la tabla (norte-blanco y oasis T1 solo tienen deducciones)", () => {
    for (const id of ["liga-del-norte-blanco", "liga-del-oasis-hondo"]) {
      const on = simularTemporada(liga(id), 1);
      const off = simularTemporada(liga(id), 1, { sanciones: false });
      expect(on.sancionesClub!.every((s) => s.tipo === "deduccion")).toBe(true);
      expect(json(on.partidos)).toBe(json(off.partidos));
      expect(json(on.tabla)).not.toBe(json(off.tabla));
    }
  });
});

describe("027 · el sorteo (listas cerradas, rangos, a lo sumo una por club)", () => {
  it("200 liga-temporadas: 0–2 clubes, distintos; tipo, causa coherente y magnitudes en su rango", () => {
    let total = 0;
    for (let t = 1; t <= 25; t++) {
      for (const l of mundo().ligas) {
        const s = sorteoSancionesClub(l, t);
        total += s.length;
        expect(s.length).toBeLessThanOrEqual(RAREZA_SANCIONES_CLUB.max);
        expect(new Set(s.map((x) => x.equipo)).size).toBe(s.length);
        const cal = calendarioDeLiga(l);
        for (const x of s) {
          expect(TIPOS_SANCION_CLUB).toContain(x.tipo);
          expect(CAUSAS_SANCION_CLUB).toContain(x.causa);
          expect(CAUSAS_POR_TIPO[x.tipo] as readonly string[]).toContain(x.causa);
          const idx = l.equipos.findIndex((e) => e.equipo.nombre === x.equipo);
          if (x.tipo === "deduccion") {
            expect(x.jornadas).toHaveLength(1);
            expect(x.puntos).toBeGreaterThanOrEqual(DEDUCCION_PUNTOS.min);
            expect(x.puntos).toBeLessThanOrEqual(DEDUCCION_PUNTOS.max);
          } else if (x.tipo === "puerta_cerrada") {
            // partidos de LOCAL consecutivos del club
            const deLocal = cal.flatMap((jj, k) => (jj.some((c) => c.local === idx) ? [k + 1] : []));
            const k0 = deLocal.indexOf(x.jornadas[0]!);
            expect(k0).toBeGreaterThanOrEqual(0);
            expect(x.jornadas).toEqual(deLocal.slice(k0, k0 + x.jornadas.length));
            expect(x.jornadas.length).toBeGreaterThanOrEqual(PUERTA_CERRADA_PARTIDOS.min);
            expect(x.jornadas.length).toBeLessThanOrEqual(PUERTA_CERRADA_PARTIDOS.max);
          } else {
            expect(x.jornadas.length).toBeGreaterThanOrEqual(LIMITE_BANCO_JORNADAS.min);
            expect(x.jornadas.length).toBeLessThanOrEqual(LIMITE_BANCO_JORNADAS.max);
            x.jornadas.forEach((j, k) => expect(j).toBe(x.jornadas[0]! + k));
            expect(x.jornadas[x.jornadas.length - 1]!).toBeLessThanOrEqual(cal.length);
          }
        }
      }
    }
    expect(total).toBeGreaterThan(0);
  });
});

describe("027 · registro ⇔ configs (oráculo propio) e invariantes", () => {
  for (const [nombre, t, id] of [
    ["fiordos T1", fiordos1, "liga-de-los-fiordos"],
    ["cumbres T2", cumbres2, "liga-de-las-cumbres"],
  ] as const) {
    it(`${nombre}: cada partido lleva EXACTAMENTE las sanciones que el registro le da, y todas las invariantes pasan`, () => {
      const reg = t.sancionesClub!;
      expect(reg.length).toBeGreaterThan(0);
      t.partidos.forEach((pl, k) => {
        const esperado: SancionClubPartido[] = [];
        for (const s of reg) {
          const n = s.jornadas.indexOf(pl.jornada);
          if (n < 0) continue;
          const lado = s.equipo === pl.local ? "local" : s.equipo === pl.visita ? "visita" : undefined;
          if (!lado || (s.tipo === "puerta_cerrada" && lado !== "local")) continue;
          esperado.push(s.tipo === "deduccion" ? { lado, tipo: s.tipo, causa: s.causa, puntos: s.puntos! } : { lado, tipo: s.tipo, causa: s.causa, partido: n + 1, de: s.jornadas.length });
        }
        expect(t.configs[k]!.sancionesClub ?? [], `${pl.jornada}/${pl.indice}`).toEqual(esperado);
      });
      const fallas = partidosDe(t).flatMap((p) => Object.entries(VERIFICADORES).flatMap(([n, v]) => v(p).map((x) => `${p.config.seed} ${n}: ${x}`)));
      expect(fallas.slice(0, 10)).toEqual([]);
      void id;
    });
  }

  it("la puerta cerrada: presión baja para AMBOS y la grada muda del todo (ni la visitante); fuera de ella, la grada suena", () => {
    let cerrados = 0;
    for (const t of [fiordos1, cumbres2]) {
      partidosDe(t).forEach((p) => {
        const cerrada = (p.config.sancionesClub ?? []).some((s) => s.tipo === "puerta_cerrada");
        if (!cerrada) return;
        cerrados++;
        expect(p.config.condiciones!.presion).toEqual({ local: "baja", visita: "baja" });
        expect(reacciones(p)).toEqual([]);
        // la misma config sin la sanción tendría reacciones (hay goles o descanso): la grada calla por la puerta
        const abierta: Partido = { ...p, config: { ...p.config, sancionesClub: [] } };
        if (p.eventos.some((e) => e.tipo === "gol")) expect(reacciones(abierta).length).toBeGreaterThan(0);
      });
    }
    expect(cerrados).toBeGreaterThanOrEqual(3);
  });

  it("el banco limitado: todo el que entra sale de los primeros BANCO_LIMITADO del banco de la config", () => {
    let partidos = 0;
    let cambios = 0;
    for (const p of partidosDe(cumbres2)) {
      for (const s of (p.config.sancionesClub ?? []).filter((x) => x.tipo === "limite_banco")) {
        partidos++;
        const disponibles = p.config[s.lado].jugadores.slice(TITULARES, TITULARES + BANCO_LIMITADO).map((j) => j.nombre);
        for (const e of p.eventos.filter((x) => x.tipo === "cambio" && x.equipo === s.lado)) {
          cambios++;
          expect(disponibles).toContain(e.jugador);
        }
      }
    }
    expect(partidos).toBe(3);
    expect(cambios).toBeGreaterThan(0);
  });
});

describe("027 · la tabla con deducciones (oráculo independiente)", () => {
  it("fiordos T1: puntos recontados de los resultados − la deducción del registro; la fila lo muestra", () => {
    const brutos = new Map<string, number>();
    for (const p of fiordos1.partidos) {
      const [l, v] = p.golesLocal > p.golesVisita ? [3, 0] : p.golesLocal < p.golesVisita ? [0, 3] : [1, 1];
      brutos.set(p.local, (brutos.get(p.local) ?? 0) + l);
      brutos.set(p.visita, (brutos.get(p.visita) ?? 0) + v);
    }
    const deduccion = new Map(fiordos1.sancionesClub!.filter((s) => s.tipo === "deduccion").map((s) => [s.equipo, s.puntos!] as const));
    expect(deduccion.size).toBe(1);
    for (const f of fiordos1.tabla) {
      const d = deduccion.get(f.equipo) ?? 0;
      expect(f.pts, f.equipo).toBe((brutos.get(f.equipo) ?? 0) - d);
      if (d > 0) expect([f.ptsBrutos! - f.deduccion!.puntos, f.deduccion!.puntos]).toEqual([f.pts, d]);
      else expect(f.deduccion === undefined && f.ptsBrutos === undefined).toBe(true);
    }
    // el orden usa los puntos NETOS
    for (let i = 1; i < fiordos1.tabla.length; i++) expect(fiordos1.tabla[i - 1]!.pts).toBeGreaterThanOrEqual(fiordos1.tabla[i]!.pts);
  });
});

describe("027 · cada invariante caza su corrupción", () => {
  const p = simular(cumbres2.configs.find((c) => (c.sancionesClub ?? []).some((s) => s.tipo === "limite_banco"))!);
  const cerrada = simular(fiordos1.configs.find((c) => (c.sancionesClub ?? []).some((s) => s.tipo === "puerta_cerrada"))!);

  it("sanciones sin la variante ⇒ invariante", () => {
    expect(verificarSancionesClub({ ...p, config: { ...p.config, variantes: { ...p.config.variantes, sanciones: false } } }).some((x) => x.includes("sin la variante"))).toBe(true);
    expect(verificarSancionesClub(p)).toEqual([]);
  });

  it("puerta cerrada con presión alta ⇒ invariante de condiciones", () => {
    expect(verificarCondiciones(cerrada)).toEqual([]);
    const mala: Partido = { ...cerrada, config: { ...cerrada.config, condiciones: { ...cerrada.config.condiciones!, presion: { local: "media", visita: "alta" } } } };
    expect(verificarCondiciones(mala).some((x) => x.includes("puerta cerrada"))).toBe(true);
  });

  it("un cuarto suplente (fuera de los disponibles) con el banco limitado ⇒ invariante", () => {
    const s = p.config.sancionesClub!.find((x) => x.tipo === "limite_banco")!;
    const cuarto = p.config[s.lado].jugadores[TITULARES + BANCO_LIMITADO]!.nombre;
    const sale = p.config[s.lado].jugadores[3]!.nombre;
    const malo: Partido = { ...p, eventos: [...p.eventos.slice(0, -1), { id: "e999", minuto: 80, tipo: "cambio", equipo: s.lado, jugador: cuarto, sale }, p.eventos[p.eventos.length - 1]!] };
    expect(verificarSancionesClub(malo).some((x) => x.includes("banco limitado"))).toBe(true);
  });

  it("dos sanciones para el mismo club, o la puerta cerrada para el visitante ⇒ invariante", () => {
    const sc = cerrada.config.sancionesClub!;
    expect(verificarSancionesClub({ ...cerrada, config: { ...cerrada.config, sancionesClub: [...sc, { ...sc[0]!, tipo: "limite_banco", partido: 1, de: 2 }] } }).some((x) => x.includes("máximo una"))).toBe(true);
    expect(verificarSancionesClub({ ...cerrada, config: { ...cerrada.config, sancionesClub: [{ ...sc[0]!, lado: "visita" }] } }).some((x) => x.includes("visitante"))).toBe(true);
  });
});
