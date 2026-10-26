// Brief 065 § 2 · lotes completos bajo reinicios-v9 (REMATE_ARENA_V9: remate más preciso y portero con menos alcance)
// con las mismas bandas que v8 (046 recalibradas, 051, bloque A y bloques B y C), el experimento controlado del 051 y
// los del 063 (atributos con visión y potencia por encima del umbral, e identidad). No se mueve ninguna banda.
import { describe, expect, it } from "vitest";
import { LOTE_ARENA_046 as L, LOTE_ARENA_063 as L63 } from "../../sim/limites";
import { bandasLote, incumplimientos, incumplimientos063, incumplimientosBC, incumplimientosControlado, incumplimientosControladoAtributos, incumplimientosIdentidad, medirControlado, medirControladoAtributo, medirControladoIdentidad, medirLote } from "../metricas-lote";
import { atributosJugador, type AtributoJugador } from "../tipos";

const V9 = "reinicios-v9" as const;
const primero = { desde: L.completo.semillaDesde, semillas: L.completo.semillas };
const segundo = { desde: L.segundoLoteDesde, semillas: L.completo.semillas };

describe("065 · lotes completos de la arena (reinicios-v9)", () => {
  for (const [nombre, lote, controlado] of [["1–100", primero, true], ["segundo lote", segundo, false]] as const) {
    it(`${nombre}: bandas completas del 046 (recalibradas), del 051, del bloque A y de los bloques B y C${controlado ? ", y el experimento controlado del 051" : ""}`, { timeout: 900_000 }, async () => {
      const m = await medirLote({ ...lote, reglas: V9 });
      const { b046, b051, b063, bBC } = bandasLote(V9, "completo");
      console.log(`[065 v9 ${nombre}]`, JSON.stringify({ goles: m.golesPorPartido, remates: m.remate.porPartido, conversion: m.remate.conversion, aPuerta: m.remate.aPuerta, centros: m.centros.porPartido, conversionManoAMano: m.manoAMano.conversion, a: m.persecucion063, bc: m.largoLejano063 }));
      expect(m.partidos).toBe(L.completo.semillas);
      expect(b046.golesPorPartido).toEqual(L63.recalibracion046.completo.golesPorPartido);
      expect(incumplimientos(m, b046, b051)).toEqual([]);
      expect(incumplimientos063(m, b063!)).toEqual([]);
      expect(incumplimientosBC(m, bBC!)).toEqual([]);
      if (controlado) {
        const porteros = await medirControlado({ ...lote, reglas: V9, quien: "portero" });
        const campo = await medirControlado({ ...lote, reglas: V9, quien: "campo" });
        console.log(`[065 v9 ${nombre} · controlado 051]`, JSON.stringify({ porteros: porteros.diferencia, campo: campo.diferencia }));
        expect(incumplimientosControlado({ porteros: porteros.diferencia, campo: campo.diferencia }, b051)).toEqual([]);
      }
    });
  }

  it("experimento controlado de atributos (local, bajo frente a alto) y visión y potencia por encima del umbral", { timeout: 1_800_000 }, async () => {
    const diferencias: Partial<Record<AtributoJugador, number | null>> = {}, cocientes: { vision?: number | null; potencia?: number | null } = {};
    for (const atributo of atributosJugador) diferencias[atributo] = (await medirControladoAtributo({ ...primero, reglas: V9, atributo, ...L63.controlado.valores })).diferencia;
    for (const atributo of ["vision", "potencia"] as const) cocientes[atributo] = (await medirControladoAtributo({ ...primero, reglas: V9, atributo, ...L63.sobreUmbral[atributo] })).cociente;
    const fallos = incumplimientosControladoAtributos({ diferencias, cocientes });
    console.log("[065 v9 controlado de atributos]", JSON.stringify({ diferencias, cocientes, fallos }));
    expect(fallos).toEqual([]);
  });

  it("experimento controlado de identidad (local): bloque, largos, lejanos y persecución", { timeout: 1_800_000 }, async () => {
    const r = await medirControladoIdentidad({ ...primero, reglas: V9 });
    const fallos = incumplimientosIdentidad(r.diferencias);
    console.log("[065 v9 controlado de identidad]", JSON.stringify({ diferencias: r.diferencias, fallos }));
    expect(fallos).toEqual([]);
  });
});
