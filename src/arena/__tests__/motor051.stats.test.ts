// Brief 051 · lotes completos bajo reinicios-v5 (LOTE_ARENA_046.completo y el segundo lote desde
// segundoLoteDesde) con todas las bandas `completo` de LOTE_ARENA_051 y LOTE_ARENA_046, los cuatro
// lotes del experimento controlado (porteros y campo, nivelesControlado.bajo frente a .alto) y el
// contraste conjunto: el mismo lote bajo reinicios-v4 incumple las cuatro bandas discriminantes
// (a puerta, colocación, altos / fuera y diferencia controlada de porteros). v1.1 #7: el contraste es
// una comprobación conjunta del cambio, no una garantía por regla (eso lo cubren las mutaciones).
import { describe, expect, it } from "vitest";
import { LOTE_ARENA_046 as L, LOTE_ARENA_051 as L51 } from "../../sim/limites";
import { incumplimientos, incumplimientosControlado, medirControlado, medirLote } from "../metricas-lote";

const V5 = "reinicios-v5" as const, V4 = "reinicios-v4" as const;
const primero = { desde: L.completo.semillaDesde, semillas: L.completo.semillas };
const segundo = { desde: L.segundoLoteDesde, semillas: L.completo.semillas };

describe("051 · lotes completos de la arena (reinicios-v5)", () => {
  it("1–100: todas las bandas completas (051 y 046) y el experimento controlado de porteros y de campo", { timeout: 600_000 }, async () => {
    const m = await medirLote({ ...primero, reglas: V5 });
    console.log("[051 v5 1–100]", JSON.stringify({ remate: m.remate, goles: m.golesPorPartido, intercepciones: [m.intercepcionesInmediatas, m.intercepcionesInmediatasCercanas] }));
    expect(m.partidos).toBe(L.completo.semillas);
    expect(m.reglas).toBe(V5);
    expect(incumplimientos(m, L.completo, L51.completo)).toEqual([]);
    const porteros = await medirControlado({ ...primero, reglas: V5, quien: "portero" });
    const campo = await medirControlado({ ...primero, reglas: V5, quien: "campo" });
    console.log("[051 v5 1–100 · controlado]", JSON.stringify({ porteros: porteros.diferencia, campo: campo.diferencia }));
    expect(incumplimientosControlado({ porteros: porteros.diferencia, campo: campo.diferencia }, L51.completo)).toEqual([]);
  });

  it("segundo lote (segundoLoteDesde): todas las bandas completas (051 y 046)", { timeout: 600_000 }, async () => {
    const m = await medirLote({ ...segundo, reglas: V5 });
    console.log("[051 v5 segundo lote]", JSON.stringify({ remate: m.remate, goles: m.golesPorPartido, intercepciones: [m.intercepcionesInmediatas, m.intercepcionesInmediatasCercanas] }));
    expect(m.partidos).toBe(L.completo.semillas);
    expect(incumplimientos(m, L.completo, L51.completo)).toEqual([]);
  });

  it("contraste: el mismo lote bajo reinicios-v4 incumple a puerta, colocación, altos / fuera y la diferencia controlada de porteros", { timeout: 600_000 }, async () => {
    const m = await medirLote({ ...primero, reglas: V4 });
    const porteros = await medirControlado({ ...primero, reglas: V4, quien: "portero" });
    const fallos = [...incumplimientos(m, L.completo, L51.completo), ...incumplimientosControlado({ porteros: porteros.diferencia, campo: null }, L51.completo)];
    console.log("[051 v4 contraste]", JSON.stringify(fallos));
    for (const nombre of ["aPuerta", "colocacionLados", "altosSobreFuera", "controladoPorteros"]) expect({ nombre, incumple: fallos.some(f => f.startsWith(`${nombre}=`)) }).toEqual({ nombre, incumple: true });
  });
});
