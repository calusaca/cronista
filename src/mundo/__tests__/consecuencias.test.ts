// Brief 019 — la temporada viva. ORÁCULO del registro: desde los eventos de cada partido ya
// jugado se recalcula AQUÍ, por otro camino, quién no puede jugar cada jornada (roja directa ⇒
// SANCION_JORNADAS.roja_directa; doble amarilla ⇒ .doble_amarilla; lesión ⇒ su `baja`), y se exige
// que la config del partido lo refleje: bajas declaradas = las del oráculo, y ningún sancionado ni
// lesionado en la plantilla ni en los eventos de esas jornadas. Más: determinismo y el rating.
import { describe, expect, it } from "vitest";
import { RATING_PARTIDOS_MIN, SANCION_JORNADAS, TEMPORADA_ACTUAL } from "../../analista/umbrales";
import { valorar } from "../../analista/valoracion";
import { validarConfig } from "../../sim/motor";
import { simular } from "../../sim/motor";
import { SUPLENTES, TITULARES, type Partido } from "../../sim/tipos";
import { mundo } from "../mundo";
import { partidosDeTemporada, ratingsDeTemporada, topRating } from "../rating";
import { alineacion, simularTemporada } from "../temporada";
import type { Liga, Temporada } from "../tipos";

const ligas = mundo().ligas.slice(0, 3);
const temporadas = new Map<string, { t: Temporada; ps: Partido[] }>(
  ligas.map((l) => {
    const t = simularTemporada(l, TEMPORADA_ACTUAL);
    return [l.id, { t, ps: partidosDeTemporada(t) }];
  }),
);

/** Oráculo: bajas esperadas en cada partido (clave `j/i|equipo` → nombres), desde los eventos. */
function oraculoBajas(liga: Liga, t: Temporada, ps: Partido[]): Map<string, Set<string>> {
  const hasta = new Map<string, number>(); // equipo|jugador → última jornada fuera
  const out = new Map<string, Set<string>>();
  t.partidos.forEach((r, k) => {
    const p = ps[k] as Partido;
    for (const equipo of [r.local, r.visita]) {
      const fuera = new Set<string>();
      for (const [clave, h] of hasta) if (clave.startsWith(`${equipo}|`) && h >= r.jornada) fuera.add(clave.slice(equipo.length + 1));
      out.set(`${r.jornada}/${r.indice}|${equipo}`, fuera);
    }
    const amarillas = new Set<string>();
    for (const e of p.eventos) {
      if (!e.jugador) continue;
      const equipo = p.config[e.equipo].nombre;
      const clave = `${equipo}|${e.jugador}`;
      if (e.tipo === "tarjeta_amarilla") amarillas.add(clave);
      let n = 0;
      if (e.tipo === "tarjeta_roja") n = amarillas.has(clave) ? SANCION_JORNADAS.doble_amarilla : SANCION_JORNADAS.roja_directa;
      if (e.tipo === "lesion") n = e.baja ?? 0;
      if (n > 0) hasta.set(clave, Math.max(hasta.get(clave) ?? 0, r.jornada + n));
    }
  });
  expect(liga.equipos.length).toBeGreaterThan(0);
  return out;
}

describe("019 · el registro de la temporada (oráculo independiente)", () => {
  it("determinista: la temporada dos veces ⇒ idéntica, sanciones, lesiones y configs incluidas", () => {
    const l = ligas[0]!;
    expect(JSON.stringify(simularTemporada(l, TEMPORADA_ACTUAL))).toBe(JSON.stringify(temporadas.get(l.id)!.t));
  });

  it("hay sanciones de los dos tipos y lesiones en el corpus (el oráculo tiene qué vigilar)", () => {
    const todas = [...temporadas.values()];
    expect(todas.flatMap(({ t }) => t.sanciones).some((s) => s.motivo === "doble_amarilla")).toBe(true);
    expect(todas.flatMap(({ t }) => t.sanciones).some((s) => s.motivo === "roja_directa")).toBe(true);
    expect(todas.flatMap(({ t }) => t.lesiones).length).toBeGreaterThan(0);
  });

  for (const liga of ligas) {
    it(`${liga.id}: bajas de cada partido = oráculo; ningún sancionado o lesionado en la plantilla ni en los eventos`, () => {
      const { t, ps } = temporadas.get(liga.id)!;
      const esperado = oraculoBajas(liga, t, ps);
      const fallas: string[] = [];
      t.partidos.forEach((r, k) => {
        const p = ps[k] as Partido;
        for (const lado of ["local", "visita"] as const) {
          const equipo = p.config[lado].nombre;
          const ref = `${r.jornada}/${r.indice}|${equipo}`;
          const fuera = esperado.get(ref) as Set<string>;
          const declaradas = new Set((p.config.bajas?.[lado] ?? []).map((b) => b.jugador));
          if ([...fuera].sort().join() !== [...declaradas].sort().join()) fallas.push(`${ref}: bajas ${[...declaradas]} ≠ oráculo ${[...fuera]}`);
          for (const n of fuera) {
            if (p.config[lado].jugadores.some((j) => j.nombre === n)) fallas.push(`${ref}: ${n} en la plantilla estando de baja`);
            if (p.eventos.some((e) => e.equipo === lado && (e.jugador === n || e.sale === n))) fallas.push(`${ref}: ${n} juega estando de baja`);
          }
        }
      });
      expect(fallas.slice(0, 10)).toEqual([]);
    });
  }

  it("cumplida la baja, el jugador vuelve: después de su última jornada fuera está de nuevo en la plantilla (si es de los 16)", () => {
    let vueltas = 0;
    for (const liga of ligas) {
      const { t } = temporadas.get(liga.id)!;
      for (const s of [...t.sanciones.map((x) => ({ ...x, n: x.jornadas })), ...t.lesiones.map((x) => ({ ...x, n: x.jornadas }))]) {
        const vuelta = s.jornada + s.n + 1;
        const k = t.partidos.findIndex((r) => r.jornada === vuelta && (r.local === s.equipo || r.visita === s.equipo));
        if (k < 0) continue;
        const c = t.configs[k]!;
        const lado = t.partidos[k]!.local === s.equipo ? "local" : "visita";
        const otra = [...t.sanciones, ...t.lesiones].some((o) => o !== s && o.jugador === s.jugador && o.jornada + o.jornadas >= vuelta && o.jornada < vuelta);
        const base = liga.equipos.find((e) => e.equipo.nombre === s.equipo)!.equipo.jugadores.some((j) => j.nombre === s.jugador);
        if (otra || !base) continue;
        expect(c[lado].jugadores.some((j) => j.nombre === s.jugador), `${s.jugador} J${vuelta}`).toBe(true);
        vueltas++;
      }
    }
    expect(vueltas).toBeGreaterThan(0);
  });

  it("todas las configs son válidas: 16 jugadores únicos, titulares y banco de su tamaño", () => {
    for (const { t } of temporadas.values()) for (const c of t.configs) expect(() => validarConfig(c)).not.toThrow();
  });
});

describe("019 · la alineación sin las bajas", () => {
  const eq = mundo().ligas[0]!.equipos[0]!;
  it("sin bajas: exactamente los 16 de siempre, en su orden", () => {
    expect(alineacion(eq, new Set()).jugadores).toEqual(eq.equipo.jugadores);
  });
  it("un titular de baja lo reemplaza el suplente de SU posición; el banco se completa con una reserva", () => {
    const titular = eq.equipo.jugadores[2]!; // un DEF
    const al = alineacion(eq, new Set([titular.nombre]));
    const entra = al.jugadores[2]!;
    expect(entra.posicion).toBe(titular.posicion);
    expect(eq.equipo.jugadores.slice(TITULARES).map((j) => j.nombre)).toContain(entra.nombre);
    expect(al.jugadores).toHaveLength(TITULARES + SUPLENTES);
    expect(al.jugadores.some((j) => j.nombre === titular.nombre)).toBe(false);
    expect(al.jugadores.some((j) => eq.reservas.some((r) => r.nombre === j.nombre))).toBe(true);
  });
  it("el portero de baja lo reemplaza el portero suplente", () => {
    const por = eq.equipo.jugadores[0]!;
    expect(alineacion(eq, new Set([por.nombre])).jugadores[0]!.posicion).toBe("POR");
  });
});

describe("019 · rating general de temporada (oráculo independiente de la media y del top)", () => {
  const liga = ligas[0]!;
  const { t, ps } = temporadas.get(liga.id)!;
  // Recuento propio: notas del 009 por jugador, media en décimas, redondeo a un decimal.
  const notas = new Map<string, number[]>();
  ps.forEach((p) => {
    for (const v of valorar(p)) notas.set(`${v.equipo}|${v.jugador}`, [...(notas.get(`${v.equipo}|${v.jugador}`) ?? []), v.nota]);
  });
  const media = (xs: number[]) => Math.round(xs.reduce((s, x) => s + Math.round(x * 10), 0) / xs.length) / 10;
  const rs = ratingsDeTemporada(t, ps);

  it("cada rating = la media de sus notas de partido, con `partidos` = cuántas", () => {
    expect(rs.length).toBe(notas.size);
    for (const r of rs) {
      const xs = notas.get(`${r.equipo}|${r.jugador}`)!;
      expect([r.rating, r.partidos], r.jugador).toEqual([media(xs), xs.length]);
    }
  });

  it("el top: mínimo de partidos y orden por rating (desempate: partidos, nombre) == recuento propio", () => {
    const propio = [...notas.entries()]
      .map(([k, xs]) => ({ k, r: media(xs), n: xs.length }))
      .filter((x) => x.n >= RATING_PARTIDOS_MIN)
      .sort((a, b) => b.r - a.r || b.n - a.n || a.k.split("|")[1]!.localeCompare(b.k.split("|")[1]!))
      .slice(0, 10)
      .map((x) => x.k);
    expect(topRating(rs, RATING_PARTIDOS_MIN, 10).map((r) => `${r.equipo}|${r.jugador}`)).toEqual(propio);
  });

  it("el mínimo de partidos se aplica: un suplente con una sola nota altísima NO entra al top", () => {
    // En las ligas reales nadie con pocos partidos llega arriba (la mutación que quitaba el
    // filtro sobrevivía): se fuerza el caso con un rating sintético.
    const fugaz = { jugador: "Fugaz", equipo: "X", posicion: "DEL" as const, partidos: 1, rating: 9.9, notas: [{ jornada: 1, indice: 1, nota: 9.9, rival: "Y" }] };
    const top = topRating([...rs, fugaz], RATING_PARTIDOS_MIN, 10);
    expect(top.some((r) => r.jugador === "Fugaz")).toBe(false);
    expect(topRating([...rs, { ...fugaz, partidos: RATING_PARTIDOS_MIN }], RATING_PARTIDOS_MIN, 10)[0]?.jugador).toBe("Fugaz");
  });

  it("el desglose de cada rating: una fila por partido, con su nota y su partido (jornada/índice) real", () => {
    for (const r of topRating(rs, RATING_PARTIDOS_MIN, 5)) {
      for (const n of r.notas) {
        const k = t.partidos.findIndex((x) => x.jornada === n.jornada && x.indice === n.indice);
        const v = valorar(simular(t.configs[k]!)).find((x) => x.jugador === r.jugador && x.equipo === r.equipo);
        expect(v?.nota).toBe(n.nota);
      }
    }
  });
});
