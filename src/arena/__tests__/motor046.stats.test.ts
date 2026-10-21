// Brief 046 · lote completo (semillas LOTE_ARENA_046.completo) bajo reinicios-v4 y contraste con
// reinicios-v3: el mismo lote v3 debe incumplir las bandas que distinguen el cambio (v1.1 · 1; v1.2:
// también goles tras saque). Las bandas de saques se exigen además en el segundo lote (v1.2 · 4).
import { describe, expect, it } from "vitest";
import { LOTE_ARENA_046 as L } from "../../sim/limites";
import { incumplimientos, incumplimientosSaques, medirLote } from "../metricas-lote";

const lote = { desde: L.completo.semillaDesde, semillas: L.completo.semillas };

describe("046 · lote completo de la arena", () => {
  it("reinicios-v4 cumple todas las bandas completas", { timeout: 300_000 }, async () => {
    const m = await medirLote(lote);
    console.log("[046 v4]", JSON.stringify(m));
    expect(m.partidos).toBe(L.completo.semillas);
    expect(m.reglas).toBe("reinicios-v4");
    expect(incumplimientos(m, L.completo)).toEqual([]);
  });

  it("v1.2: el segundo lote (segundoLoteDesde) cumple las bandas de saques desde las manos", { timeout: 300_000 }, async () => {
    const m = await medirLote({ desde: L.segundoLoteDesde, semillas: L.completo.semillas });
    console.log("[046 v4 segundo lote]", JSON.stringify(m));
    expect(m.saquesManos).toBeGreaterThan(0);
    expect(incumplimientosSaques(m, L.completo)).toEqual([]);
  });

  it("el mismo lote bajo reinicios-v3 incumple pérdidas tras atajada, mediana del desplazamiento y proporción de centros", { timeout: 300_000 }, async () => {
    const m = await medirLote({ ...lote, reglas: "reinicios-v3" });
    console.log("[046 v3]", JSON.stringify(m));
    const fallos = incumplimientos(m, L.completo);
    console.log("[046 v3 incumplimientos]", JSON.stringify(fallos));
    for (const nombre of ["perdidasTrasAtajada", "desplazamientoMedianaM", "proporcionCentros", "golesTrasSaquePorPartido"]) expect(fallos.some(f => f.startsWith(`${nombre}=`))).toBe(true);
    // El contador de robos con balon.manos es exclusivo de v4: en v3 no existe ese estado.
    expect(m.robosEnManos).toBe(0);
  });
});
