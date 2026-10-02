// Brief 018 §4 — la cara visible de las condiciones: el chip dice la config registrada y el bloque
// del panel destaca EXACTAMENTE lo que el Analista narra (mismo criterio, también en prefijos).
// Fija además los partidos que usa el e2e (si el mundo cambia, esto explica por qué).
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import { TEMPORADA_ACTUAL } from "../../analista/umbrales";
import { configDePartidoLiga } from "../../mundo/temporada";
import { simular } from "../../sim/motor";
import type { Partido } from "../../sim/tipos";
import { detectarMomentos, prefijo } from "../../vivo/momentos";
import { efectosMedidos, piezasChip } from "../condiciones";
import { ligaVisible } from "../liga";

const partidoLiga = (j: number, i: number): Partido => simular(configDePartidoLiga(ligaVisible(), TEMPORADA_ACTUAL, j, i));
const nombres = (p: Partido) => ({ local: p.config.local.nombre, visita: p.config.visita.nombre });

describe("018 · chip y efectos del panel", () => {
  it("el chip nombra clima, cancha y presión de la config (temperatura con su signo)", () => {
    const vistos = new Set<string>();
    for (let j = 1; j <= 18; j++) {
      for (let i = 1; i <= 5; i++) {
        const c = partidoLiga(j, i).config.condiciones!;
        const [clima, cancha, presion] = piezasChip(c) as [string, string, string];
        if (c.temperaturaC !== undefined) expect(clima).toBe(`${c.temperaturaC < 0 ? "−" : ""}${Math.abs(c.temperaturaC)} °C`);
        else expect(clima).toBe(c.clima === "lluvia" ? "Rain" : "Clear skies");
        expect(cancha).toBe(c.superficie === "sintetica" ? "artificial pitch" : `${c.cesped === "alto" ? "long" : "short"} natural grass`);
        expect(presion.includes("high pressure")).toBe(c.presion.visita === "alta");
        vistos.add(clima.endsWith("°C") ? "temp" : clima);
      }
    }
    expect([...vistos].sort()).toEqual(["Clear skies", "Rain", "temp"]);
  });

  it("destacado del panel ⇔ hecho de efecto del Analista, en la liga visible entera y en cada momento del vivo", () => {
    const fallas: string[] = [];
    for (let j = 1; j <= 18; j++) {
      for (let i = 1; i <= 5; i++) {
        const p = partidoLiga(j, i);
        const vistas = [p, ...detectarMomentos(p).map((m) => prefijo(p, m))];
        for (const v of vistas) {
          const tipos = new Set(analizar(v).map((h) => h.tipo));
          for (const e of efectosMedidos(v, nombres(p))) if (e.destacado !== tipos.has(e.tipo)) fallas.push(`${j}/${i} (${v.eventos.length} eventos) ${e.tipo}`);
        }
      }
    }
    expect(fallas).toEqual([]);
  });

  it("los partidos del e2e: 2/2 (césped alto + presión alta medidos) y 9/3 (calor medido)", () => {
    const a = partidoLiga(2, 2);
    const ea = efectosMedidos(a, nombres(a));
    expect(ea.filter((e) => e.destacado).map((e) => e.tipo).sort()).toEqual(["cancha_incomoda", "presion_que_ahoga"]);
    expect(ea.find((e) => e.tipo === "presion_que_ahoga")!.ids.length).toBeGreaterThan(0);
    const b = partidoLiga(9, 3);
    expect(b.config.condiciones!.clima).toBe("calor");
    expect(efectosMedidos(b, nombres(b)).some((e) => e.tipo === "efecto_calor" && e.destacado)).toBe(true);
  });
});
