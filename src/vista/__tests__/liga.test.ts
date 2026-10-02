// Brief 016 §4 — navegación de la liga: anterior/siguiente por el calendario y validación de
// la ruta /liga/[jornada]/[partido].
import { describe, expect, it } from "vitest";
import { LIGA_DESTACADA, TEMPORADA_ACTUAL } from "../../analista/umbrales";
import { mundo } from "../../mundo/mundo";
import { simular } from "../../sim/motor";
import { configDePartidoLiga, simularTemporada } from "../../mundo/temporada";
import { contextoDe, leerRefPartido, ligaVisible, rutaPartidoLiga, temporadaVisible, vecinos } from "../liga";

describe("016 · navegación de la liga", () => {
  it("la liga visible es LIGA_DESTACADA, que existe en el mundo", () => {
    expect(mundo().ligas.map((l) => l.id)).toContain(LIGA_DESTACADA);
    expect(ligaVisible().id).toBe(LIGA_DESTACADA);
  });

  it("vecinos recorre el calendario entero en orden, sin huecos", () => {
    let r: { jornada: number; indice: number } | undefined = { jornada: 1, indice: 1 };
    const vistos: string[] = [];
    while (r) {
      vistos.push(`${r.jornada}/${r.indice}`);
      r = vecinos(r, 18, 5).siguiente;
    }
    expect(vistos).toHaveLength(90);
    expect(vistos[5]).toBe("2/1");
    expect(vistos[89]).toBe("18/5");
    expect(vecinos({ jornada: 1, indice: 1 }, 18, 5).anterior).toBeUndefined();
    expect(vecinos({ jornada: 2, indice: 1 }, 18, 5).anterior).toEqual({ jornada: 1, indice: 5 });
  });

  it("leerRefPartido acepta 1..18 × 1..5 y rechaza lo demás", () => {
    expect(leerRefPartido("7", "3")).toEqual({ jornada: 7, indice: 3 });
    expect(leerRefPartido("18", "5")).toEqual({ jornada: 18, indice: 5 });
    for (const [j, i] of [["0", "1"], ["19", "1"], ["1", "6"], ["1", "0"], ["x", "1"], ["1.5", "1"], ["-1", "1"], ["0007", "1"]])
      expect(leerRefPartido(j as string, i as string), `${j}/${i}`).toBeUndefined();
  });

  it("el contexto y la ruta del partido de liga son los de su jornada", () => {
    const c = contextoDe({ jornada: 7, indice: 3 });
    expect(c.liga).toBe(ligaVisible().nombre);
    expect(c.anterior).toEqual({ jornada: 7, indice: 2 });
    expect(c.siguiente).toEqual({ jornada: 7, indice: 4 });
    expect(rutaPartidoLiga(c)).toBe("/liga/7/3");
  });

  it("la temporada visible es la de la liga visible, y su partido 7/3 es el que se simula en la página", () => {
    const t = temporadaVisible();
    expect(JSON.stringify(t)).toBe(JSON.stringify(simularTemporada(ligaVisible(), TEMPORADA_ACTUAL)));
    const p = simular(configDePartidoLiga(ligaVisible(), TEMPORADA_ACTUAL, 7, 3));
    const r = t.partidos.find((x) => x.jornada === 7 && x.indice === 3)!;
    expect([r.local, r.visita, r.seed]).toEqual([p.config.local.nombre, p.config.visita.nombre, p.config.seed]);
  });
});
