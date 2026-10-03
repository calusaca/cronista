// Brief 019 — la cara visible de la temporada viva. Fija el caso del smoke y del e2e: en la liga
// visible, un expulsado de la jornada 2 (roja directa ⇒ 2 jornadas) falta en la 3 y en la 4 y
// vuelve en la 5; y la pestaña Players trae un top con su desglose enlazado a partidos reales.
import { describe, expect, it } from "vitest";
import { RATING_PARTIDOS_MIN, SANCION_JORNADAS } from "../../analista/umbrales";
import { bajasDeJornada, jugadoresVisibles, temporadaVisible } from "../liga";

describe("019 · temporada visible", () => {
  const t = temporadaVisible();
  const s = t.sanciones.find((x) => x.motivo === "roja_directa" && x.jornada === 2)!;

  it("hay un expulsado de roja directa en la jornada 2: falta exactamente las jornadas de su sanción y vuelve", () => {
    expect(s).toBeDefined();
    const enPlantilla = (j: number) => {
      const k = t.partidos.findIndex((p) => p.jornada === j && (p.local === s.equipo || p.visita === s.equipo));
      const c = t.configs[k]!;
      return [...c.local.jugadores, ...c.visita.jugadores].some((x) => x.nombre === s.jugador);
    };
    for (let j = s.jornada + 1; j <= s.jornada + SANCION_JORNADAS.roja_directa; j++) {
      expect(enPlantilla(j), `J${j}`).toBe(false);
      expect(bajasDeJornada(j).some((b) => b.jugador === s.jugador && b.motivo === "suspension")).toBe(true);
    }
    expect(enPlantilla(s.jornada + SANCION_JORNADAS.roja_directa + 1)).toBe(true);
  });

  it("es el partido 3/1 (local) el que usa el e2e para la cabecera de bajas", () => {
    const k = t.partidos.findIndex((p) => p.jornada === 3 && p.indice === 1);
    expect(t.partidos[k]!.local).toBe(s.equipo);
    expect(t.configs[k]!.bajas?.local?.some((b) => b.jugador === s.jugador && b.motivo === "suspension")).toBe(true);
  });

  it("la pestaña Players: top con el mínimo de partidos y un desglose por partido de la temporada", () => {
    const { top } = jugadoresVisibles();
    expect(top.length).toBeGreaterThan(0);
    for (const r of top) {
      expect(r.partidos).toBeGreaterThanOrEqual(RATING_PARTIDOS_MIN);
      expect(r.notas).toHaveLength(r.partidos);
      for (const n of r.notas) expect(t.partidos.some((p) => p.jornada === n.jornada && p.indice === n.indice)).toBe(true);
    }
  });
});
