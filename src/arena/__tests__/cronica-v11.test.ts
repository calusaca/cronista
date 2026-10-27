// Brief 064 (bloque B4) · Las reglas posteriores al brief (reinicios-v9, v10 con fuera de juego y faltas, v11 con tiro
// libre `reinicio: "libre"` y penal `motivo: "penal"`) también admiten crónica: I4 (el acta verifica) e I5 (hechos) sobre
// sus fixtures, y el gol de penal del v11 lo dice y cita la falta que lo originó. Ninguna cifra se repite a mano.
import { describe, expect, it } from "vitest";
import { borradorActa } from "../../cadena/acta";
import { incumplimientosI4I5, leerJson } from "../__fixtures__/cronica-064";
import { registroCompleto, seleccionCronicaArena } from "../cronica-hechos";
import { verificarCronicaArena } from "../cronica-verificador";
import { tiroDelGol } from "../relato";

const FIXTURES_POSTERIORES = [9, 10, 11].map((n) => `src/arena/__fixtures__/arena-reinicios-v${n}.json`);

describe("064 · registros de reglas posteriores (v9–v11)", () => {
  for (const f of FIXTURES_POSTERIORES) {
    it(`${f}: completo, I4 e I5`, () => {
      const r = leerJson(f);
      expect(registroCompleto(r)).toBe(true);
      expect(incumplimientosI4I5(r)).toEqual([]);
      const { hechos, cabe } = seleccionCronicaArena(r);
      expect(cabe).toBe(true);
      const hs = hechos.map((h) => h.hecho);
      expect(verificarCronicaArena(borradorActa(hs), hs, r.config.partido)).toEqual([]);
    });
  }

  it("v11: el gol de penal se narra como penal y cita la falta, el tiro y el gol", () => {
    const r = leerJson("src/arena/__fixtures__/arena-reinicios-v11.json");
    expect(r.config.reglas).toBe("reinicios-v11");
    expect(r.eventos.some((e) => e.tipo === "reinicio" && e.reinicio === "libre")).toBe(true);
    const gol = r.eventos.find((e) => e.tipo === "gol")!;
    const tiro = tiroDelGol(gol, r)!;
    expect(tiro.motivo).toBe("penal");
    const hecho = seleccionCronicaArena(r).hechos.map((h) => h.hecho).find((h) => h.tipo === "gol_anotado" && h.eventos.includes(gol.id))!;
    expect(hecho.texto_es).toContain("de penal");
    expect(hecho.texto_en).toContain("penalty");
    expect(hecho.eventos).toContain(tiro.id);
    for (const fuente of tiro.fuentes ?? []) expect(hecho.eventos).toContain(fuente);
    expect((tiro.fuentes ?? []).some((id) => r.eventos.find((e) => e.id === id)?.tipo === "falta")).toBe(true);
  });
});
