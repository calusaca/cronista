// Brief 020 — rarezas de las definiciones ENTRE LOS GOLES (N = N_ESTADISTICA semillas) y de los
// autogoles con la variante, contra RAREZA_DEFINICION / RAREZA_AUTOGOL (limites.ts). Ninguna
// banda vacía: la chilena y la media cancha existen. `npm run test:stats`.
import { describe, expect, it } from "vitest";
import { N_ESTADISTICA, RAREZA_AUTOGOL, RAREZA_DEFINICION } from "../limites";
import { simular } from "../motor";
import { configDeSemilla } from "../plantillas";

const goles = Array.from({ length: N_ESTADISTICA }, (_, i) => simular(configDeSemilla(i + 1))).flatMap((p) => p.eventos.filter((e) => e.tipo === "gol"));
const informe = (k: string, v: string) => console.log(`[020] ${k}: ${v}`);

describe(`020 · rarezas entre los goles (${goles.length} goles, N = ${N_ESTADISTICA})`, () => {
  const frac = (pred: (d: string) => boolean) => goles.filter((g) => pred(g.definicion ?? "")).length / goles.length;
  const casos: [keyof typeof RAREZA_DEFINICION, (d: string) => boolean][] = [
    ["cabezazo", (d) => d === "cabezazo"],
    ["mano_a_mano", (d) => d === "mano_a_mano"],
    ["vaselina", (d) => d === "vaselina"],
    ["chilena_o_tijera", (d) => d === "chilena" || d === "tijera"],
    ["media_cancha", (d) => d === "media_cancha"],
  ];
  for (const [k, pred] of casos) {
    it(`${k} dentro de su banda (y nunca vacía)`, () => {
      const f = frac(pred);
      informe(k, `${(f * 100).toFixed(2)} % (${goles.filter((g) => pred(g.definicion ?? "")).length} goles)`);
      expect(f).toBeGreaterThan(0);
      expect(f).toBeGreaterThanOrEqual(RAREZA_DEFINICION[k].min);
      expect(f).toBeLessThanOrEqual(RAREZA_DEFINICION[k].max);
    });
  }

  it("autogoles (con la variante) dentro de RAREZA_AUTOGOL", () => {
    const gs = Array.from({ length: N_ESTADISTICA }, (_, i) => simular({ ...configDeSemilla(i + 1), variantes: { autogoles: true } })).flatMap((p) => p.eventos.filter((e) => e.tipo === "gol"));
    const f = gs.filter((g) => g.autogol === true).length / gs.length;
    informe("autogoles", `${(f * 100).toFixed(2)} % de ${gs.length} goles`);
    expect(f).toBeGreaterThanOrEqual(RAREZA_AUTOGOL.min);
    expect(f).toBeLessThanOrEqual(RAREZA_AUTOGOL.max);
  });
});
