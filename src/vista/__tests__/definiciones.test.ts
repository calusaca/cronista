// Brief 020 — fija los goles que miran el smoke y el e2e (si el mundo cambia, esto explica por qué).
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import { TEMPORADA_ACTUAL } from "../../analista/umbrales";
import { configDePartidoLiga } from "../../mundo/temporada";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import { jugadaDelGol } from "../evidencia";
import { ligaVisible } from "../liga";
import { geometriaJugada, MEDIO_CAMPO_M, UNIDADES_POR_M } from "../pizarra";

describe("020 · los goles del smoke y del e2e", () => {
  it("semilla 116, e094: una chilena de gol", () => {
    const p = simular(configDeSemilla(116));
    const g = p.eventos.find((e) => e.id === "e094")!;
    expect([g.tipo, g.definicion]).toEqual(["gol", "chilena"]);
    expect(geometriaJugada(jugadaDelGol(p.eventos, g.id), p.eventos)?.definicion).toBe("chilena");
  });

  it("semilla 246 (la portada), e050: gol de media cancha, dibujado a su distancia real y antes del medio campo", () => {
    const p = simular(configDeSemilla(246));
    const g = p.eventos.find((e) => e.id === "e050")!;
    expect([g.tipo, g.definicion]).toEqual(["gol", "media_cancha"]);
    const geo = geometriaJugada(jugadaDelGol(p.eventos, g.id), p.eventos)!;
    expect(geo.remate.y).toBeCloseTo(2 + g.distanciaM! * UNIDADES_POR_M, 6);
    expect(geo.remate.y).toBeLessThan(2 + MEDIO_CAMPO_M * UNIDADES_POR_M);
    expect(geo.alto).toBe(76);
  });

  // Brief 024: los niveles cambian los partidos de liga; el autogol del e2e pasó de la 2/2 a la 2/1.
  it("liga visible 2/1: un autogol con su hecho (relevancia de cobertura) y la pizarra con el autor", () => {
    const p = simular(configDePartidoLiga(ligaVisible(), TEMPORADA_ACTUAL, 2, 1));
    const g = p.eventos.filter((e) => e.tipo === "gol" && e.autogol === true);
    expect(g).toHaveLength(1);
    expect(analizar(p).some((h) => h.tipo === "autogol" && h.eventos.includes(g[0]!.id))).toBe(true);
    expect(geometriaJugada(jugadaDelGol(p.eventos, g[0]!.id), p.eventos)?.autor).toBeDefined();
  });
});
