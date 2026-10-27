// Brief 070 § 3 · lotes completos bajo reinicios-v11 (tiro libre con distancia de 9,15 m y opción de tiro directo, y
// penal): BANDAS_070, las del 068 y las mismas bandas que v10 (046 recalibradas, 051, bloque A y bloques B y C), el
// experimento controlado del 051 y los del 063 (atributos con visión y potencia por encima del umbral, e identidad).
// No se mueve ninguna banda.
import { describe, expect, it } from "vitest";
import { LOTE_ARENA_046 as L, LOTE_ARENA_063 as L63 } from "../../sim/limites";
import { bandasLote, incumplimientos, incumplimientos063, incumplimientosBC, incumplimientosControlado, incumplimientosControladoAtributos, incumplimientosIdentidad, medirControlado, medirControladoAtributo, medirControladoIdentidad, medirLote } from "../metricas-lote";
import { incumplimientos068, medirLote068 } from "../metricas-068";
import { agregar070, incumplimientos070, medirLote070 } from "../metricas-070";
import { atributosJugador, type AtributoJugador } from "../tipos";

const V9 = "reinicios-v9" as const, V11 = "reinicios-v11" as const;
const primero = { desde: L.completo.semillaDesde, semillas: L.completo.semillas };
const segundo = { desde: L.segundoLoteDesde, semillas: L.completo.semillas };

describe("070 · lotes completos de la arena (reinicios-v11)", () => {
  it("BANDAS_070 en 1–100 (recuperación del infractor, rivales a menos de 9,15 m, penales por partido) y conversión de penales en 1–100 y 101–200 juntas; BANDAS_068 en 1–100", { timeout: 900_000 }, async () => {
    const a = await medirLote070({ ...primero, reglas: V11 }), b = await medirLote070({ ...segundo, reglas: V11 });
    const juntas = agregar070(V11, L.duracionS, primero.desde, [...a.conteos, ...b.conteos]);
    const fallos = incumplimientos070(a.metricas, juntas.conversionPenales);
    const v9 = await medirLote068({ ...primero, reglas: V9 }), v11 = await medirLote068({ ...primero, reglas: V11 });
    const fallos068 = incumplimientos068(v11, v9.golesPorPartido);
    console.log("[070 BANDAS_070 y BANDAS_068]", JSON.stringify({ primero: a.metricas, segundo: b.metricas, conversionJuntas: juntas.conversionPenales, fallos, m068: v11, golesV9: v9.golesPorPartido, fallos068 }));
    expect(a.metricas.partidos).toBe(L.completo.semillas);
    expect(a.metricas.duracionS).toBe(L.duracionS);
    expect(fallos).toEqual([]);
    expect(fallos068).toEqual([]);
  });

  for (const [nombre, lote, controlado] of [["1–100", primero, true], ["segundo lote", segundo, false]] as const) {
    it(`${nombre}: bandas completas del 046 (recalibradas), del 051, del bloque A y de los bloques B y C${controlado ? ", y el experimento controlado del 051" : ""}`, { timeout: 900_000 }, async () => {
      const m = await medirLote({ ...lote, reglas: V11 });
      const { b046, b051, b063, bBC } = bandasLote(V11, "completo");
      console.log(`[070 v11 ${nombre}]`, JSON.stringify({ goles: m.golesPorPartido, remates: m.remate.porPartido, conversion: m.remate.conversion, aPuerta: m.remate.aPuerta, centros: m.centros.porPartido, conversionManoAMano: m.manoAMano.conversion, a: m.persecucion063, bc: m.largoLejano063 }));
      expect(m.partidos).toBe(L.completo.semillas);
      expect(b046.golesPorPartido).toEqual(L63.recalibracion046.completo.golesPorPartido);
      expect(incumplimientos(m, b046, b051)).toEqual([]);
      expect(incumplimientos063(m, b063!)).toEqual([]);
      expect(incumplimientosBC(m, bBC!)).toEqual([]);
      if (controlado) {
        const porteros = await medirControlado({ ...lote, reglas: V11, quien: "portero" });
        const campo = await medirControlado({ ...lote, reglas: V11, quien: "campo" });
        console.log(`[070 v11 ${nombre} · controlado 051]`, JSON.stringify({ porteros: porteros.diferencia, campo: campo.diferencia }));
        expect(incumplimientosControlado({ porteros: porteros.diferencia, campo: campo.diferencia }, b051)).toEqual([]);
      }
    });
  }

  it("experimento controlado de atributos (local, bajo frente a alto) y visión y potencia por encima del umbral", { timeout: 1_800_000 }, async () => {
    const diferencias: Partial<Record<AtributoJugador, number | null>> = {}, cocientes: { vision?: number | null; potencia?: number | null } = {};
    for (const atributo of atributosJugador) diferencias[atributo] = (await medirControladoAtributo({ ...primero, reglas: V11, atributo, ...L63.controlado.valores })).diferencia;
    for (const atributo of ["vision", "potencia"] as const) cocientes[atributo] = (await medirControladoAtributo({ ...primero, reglas: V11, atributo, ...L63.sobreUmbral[atributo] })).cociente;
    const fallos = incumplimientosControladoAtributos({ diferencias, cocientes });
    console.log("[070 v11 controlado de atributos]", JSON.stringify({ diferencias, cocientes, fallos }));
    expect(fallos).toEqual([]);
  });

  it("experimento controlado de identidad (local): bloque, largos, lejanos y persecución", { timeout: 1_800_000 }, async () => {
    const r = await medirControladoIdentidad({ ...primero, reglas: V11 });
    const fallos = incumplimientosIdentidad(r.diferencias);
    console.log("[070 v11 controlado de identidad]", JSON.stringify({ diferencias: r.diferencias, fallos }));
    expect(fallos).toEqual([]);
  });
});
