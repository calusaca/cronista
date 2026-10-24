// Brief 063 · publicación 1 · lotes completos bajo reinicios-v6 (LOTE_ARENA_046.completo y el segundo lote
// desde segundoLoteDesde) con todas las bandas `completo` del 046 y del 051 (v6 conserva las originales,
// § 12.1), los experimentos controlados del 051 y las bandas del bloque A de LOTE_ARENA_063; y el contraste:
// el mismo lote bajo reinicios-v5 incumple `repliegueCorren` y `persecucionPerdedor` (§ 11.2).
import { describe, expect, it } from "vitest";
import { LOTE_ARENA_046 as L } from "../../sim/limites";
import { bandasLote, incumplimientos, incumplimientos063, incumplimientosControlado, medirControlado, medirLote } from "../metricas-lote";

const V6 = "reinicios-v6" as const, V5 = "reinicios-v5" as const;
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
