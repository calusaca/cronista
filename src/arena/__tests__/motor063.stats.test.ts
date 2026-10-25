// Brief 063 · publicación 1 · lotes completos bajo reinicios-v6 (LOTE_ARENA_046.completo y el segundo lote
// desde segundoLoteDesde) con todas las bandas `completo` del 046 y del 051 (v6 conserva las originales,
// § 12.1), los experimentos controlados del 051 y las bandas del bloque A de LOTE_ARENA_063; y el contraste:
// el mismo lote bajo reinicios-v5 incumple `repliegueCorren` y `persecucionPerdedor` (§ 11.2).
// Publicación 2 · lotes completos bajo reinicios-v7 con las bandas del 046 (goles y centros recalibrados, § 12.3), del
// 051, del bloque A y de los bloques B y C; contraste (v5 y v6 sin balones largos ni remates lejanos); experimento
// controlado de atributos (§ 11.2) con las dos parejas por encima del umbral (v1.2 § 18.3).
// Publicación 3 · lotes completos bajo reinicios-v8 con las mismas bandas que v7 (046 recalibradas, 051, A, B y C) y el
// experimento controlado de identidad (§ 11.2, la identidad del `local` forzada).
import { describe, expect, it } from "vitest";
import { LOTE_ARENA_046 as L, LOTE_ARENA_063 as L63 } from "../../sim/limites";
import { bandasLote, incumplimientos, incumplimientos063, incumplimientosBC, incumplimientosControlado, incumplimientosControladoAtributos, incumplimientosIdentidad, medirControlado, medirControladoAtributo, medirControladoIdentidad, medirLote } from "../metricas-lote";
import { atributosJugador, type AtributoJugador } from "../tipos";

const V8 = "reinicios-v8" as const, V7 = "reinicios-v7" as const, V6 = "reinicios-v6" as const, V5 = "reinicios-v5" as const;
const primero = { desde: L.completo.semillaDesde, semillas: L.completo.semillas };
const segundo = { desde: L.segundoLoteDesde, semillas: L.completo.semillas };

describe("063 · lotes completos de la arena (reinicios-v6)", () => {
  for (const [nombre, lote, controlado] of [["1–100", primero, true], ["segundo lote", segundo, false]] as const) {
    it(`${nombre}: bandas completas del 046, del 051 y del bloque A${controlado ? ", y el experimento controlado del 051" : ""}`, { timeout: 900_000 }, async () => {
      const m = await medirLote({ ...lote, reglas: V6 });
      const { b046, b051, b063 } = bandasLote(V6, "completo");
      console.log(`[063 v6 ${nombre}]`, JSON.stringify({ goles: m.golesPorPartido, remates: m.remate.porPartido, centros: m.centros.porPartido, conducir: m.conducir.fraccion, a: m.persecucion063 }));
      expect(m.partidos).toBe(L.completo.semillas);
      expect(incumplimientos(m, b046, b051)).toEqual([]);
      expect(incumplimientos063(m, b063!)).toEqual([]);
      if (controlado) {
        const porteros = await medirControlado({ ...lote, reglas: V6, quien: "portero" });
        const campo = await medirControlado({ ...lote, reglas: V6, quien: "campo" });
        console.log(`[063 v6 ${nombre} · controlado 051]`, JSON.stringify({ porteros: porteros.diferencia, campo: campo.diferencia }));
        expect(incumplimientosControlado({ porteros: porteros.diferencia, campo: campo.diferencia }, b051)).toEqual([]);
      }
    });
  }

  it("contraste: el mismo lote bajo reinicios-v5 incumple repliegueCorren y persecucionPerdedor", { timeout: 600_000 }, async () => {
    const m = await medirLote({ ...primero, reglas: V5 });
    expect(bandasLote(V5, "completo").b063).toBeNull();
    const fallos = incumplimientos063(m, bandasLote(V6, "completo").b063!);
    console.log("[063 v5 contraste]", JSON.stringify({ a: m.persecucion063, fallos }));
    for (const nombre of ["repliegueCorren", "persecucionPerdedor"]) expect({ nombre, incumple: fallos.some(f => f.startsWith(`${nombre}=`)) }).toEqual({ nombre, incumple: true });
  });
});

describe("063 · lotes completos de la arena (reinicios-v7)", () => {
  for (const [nombre, lote, controlado] of [["1–100", primero, true], ["segundo lote", segundo, false]] as const) {
    it(`${nombre}: bandas completas del 046 (recalibradas), del 051, del bloque A y de los bloques B y C${controlado ? ", y el experimento controlado del 051" : ""}`, { timeout: 900_000 }, async () => {
      const m = await medirLote({ ...lote, reglas: V7 });
      const { b046, b051, b063, bBC } = bandasLote(V7, "completo");
      console.log(`[063 v7 ${nombre}]`, JSON.stringify({ goles: m.golesPorPartido, remates: m.remate.porPartido, centros: m.centros.porPartido, conversionManoAMano: m.manoAMano.conversion, a: m.persecucion063, bc: m.largoLejano063 }));
      expect(m.partidos).toBe(L.completo.semillas);
      expect(b046.golesPorPartido).toEqual(L63.recalibracion046.completo.golesPorPartido);
      expect(incumplimientos(m, b046, b051)).toEqual([]);
      expect(incumplimientos063(m, b063!)).toEqual([]);
      expect(incumplimientosBC(m, bBC!)).toEqual([]);
      if (controlado) {
        const porteros = await medirControlado({ ...lote, reglas: V7, quien: "portero" });
        const campo = await medirControlado({ ...lote, reglas: V7, quien: "campo" });
        console.log(`[063 v7 ${nombre} · controlado 051]`, JSON.stringify({ porteros: porteros.diferencia, campo: campo.diferencia }));
        expect(incumplimientosControlado({ porteros: porteros.diferencia, campo: campo.diferencia }, b051)).toEqual([]);
      }
    });
  }

  it("contraste: el mismo lote bajo reinicios-v5 y reinicios-v6 no tiene balones largos ni remates lejanos (e incumple las bandas B y C)", { timeout: 900_000 }, async () => {
    for (const reglas of [V5, V6]) {
      const m = await medirLote({ ...primero, reglas });
      expect(bandasLote(reglas, "completo").bBC).toBeNull();
      const fallos = incumplimientosBC(m, bandasLote(V7, "completo").bBC!);
      console.log(`[063 ${reglas} contraste B y C]`, JSON.stringify({ bc: m.largoLejano063, fallos }));
      expect({ reglas, largos: m.largoLejano063.largos, lejanos: m.largoLejano063.lejanos }).toEqual({ reglas, largos: 0, lejanos: 0 });
      for (const nombre of ["largosPorPartido", "lejanosPorPartido"]) expect({ reglas, nombre, incumple: fallos.some(f => f.startsWith(`${nombre}=`)) }).toEqual({ reglas, nombre, incumple: true });
    }
  });

  it("experimento controlado de atributos (local, 30 frente a 80) y visión y potencia por encima del umbral (60/65 frente a 90)", { timeout: 1_800_000 }, async () => {
    const diferencias: Partial<Record<AtributoJugador, number | null>> = {}, cocientes: { vision?: number | null; potencia?: number | null } = {};
    for (const atributo of atributosJugador) diferencias[atributo] = (await medirControladoAtributo({ ...primero, reglas: V7, atributo, ...L63.controlado.valores })).diferencia;
    for (const atributo of ["vision", "potencia"] as const) cocientes[atributo] = (await medirControladoAtributo({ ...primero, reglas: V7, atributo, ...L63.sobreUmbral[atributo] })).cociente;
    const fallos = incumplimientosControladoAtributos({ diferencias, cocientes });
    console.log("[063 v7 controlado de atributos]", JSON.stringify({ diferencias, cocientes, fallos }));
    expect(fallos).toEqual([]);
  });
});

describe("063 · lotes completos de la arena (reinicios-v8)", () => {
  for (const [nombre, lote, controlado] of [["1–100", primero, true], ["segundo lote", segundo, false]] as const) {
    it(`${nombre}: bandas completas del 046 (recalibradas), del 051, del bloque A y de los bloques B y C${controlado ? ", y el experimento controlado del 051" : ""}`, { timeout: 900_000 }, async () => {
      const m = await medirLote({ ...lote, reglas: V8 });
      const { b046, b051, b063, bBC } = bandasLote(V8, "completo");
      console.log(`[063 v8 ${nombre}]`, JSON.stringify({ goles: m.golesPorPartido, remates: m.remate.porPartido, centros: m.centros.porPartido, conversionManoAMano: m.manoAMano.conversion, a: m.persecucion063, bc: m.largoLejano063 }));
      expect(m.partidos).toBe(L.completo.semillas);
      expect(b046.golesPorPartido).toEqual(L63.recalibracion046.completo.golesPorPartido);
      expect(incumplimientos(m, b046, b051)).toEqual([]);
      expect(incumplimientos063(m, b063!)).toEqual([]);
      expect(incumplimientosBC(m, bBC!)).toEqual([]);
      if (controlado) {
        const porteros = await medirControlado({ ...lote, reglas: V8, quien: "portero" });
        const campo = await medirControlado({ ...lote, reglas: V8, quien: "campo" });
        console.log(`[063 v8 ${nombre} · controlado 051]`, JSON.stringify({ porteros: porteros.diferencia, campo: campo.diferencia }));
        expect(incumplimientosControlado({ porteros: porteros.diferencia, campo: campo.diferencia }, b051)).toEqual([]);
      }
    });
  }

  it("experimento controlado de identidad (local): bloque presión − defensivo, largos directo − posesión, lejanos ofensivo − posesión y persecución presión − defensivo", { timeout: 1_800_000 }, async () => {
    const r = await medirControladoIdentidad({ ...primero, reglas: V8 });
    const fallos = incumplimientosIdentidad(r.diferencias);
    console.log("[063 v8 controlado de identidad]", JSON.stringify({ diferencias: r.diferencias, fallos, porIdentidad: Object.fromEntries(Object.entries(r.lotes).map(([k, m]) => [k, { x: m!.local063.xMediaSinBalon, largos: m!.local063.largosPorPartido, lejanos: m!.local063.lejanosPorPartido, persecucionS: m!.local063.persecucionSPorPartido }])) }));
    expect(fallos).toEqual([]);
  });
});
