// Brief 009 — el hecho `figura_del_partido` en la cadena: su plantilla pasa el Verificador,
// la nota se verifica por V3, el nombre por V4, y «figura / man of the match / player of
// the match» se habilita en V8 SOLO con este hecho como principal.
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import type { Hecho } from "../../analista/tipos";
import { crearLlmStub, borradorDesdeHechos } from "../../lib/llm-stub";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import { generarCronica } from "../cadena";
import { mensajeInicial } from "../prompt";
import type { Motivo, Oracion } from "../tipos";
import { verificarDraft } from "../verificador";

const p = simular(configDeSemilla(246));
const hechos = analizar(p);
const fig = hechos.find((h) => h.tipo === "figura_del_partido") as Hecho;
const gol = hechos.find((h) => h.tipo === "gol_anotado") as Hecho;

/** Reemplaza la oración del hecho `id` y devuelve los motivos de esa oración. */
function con(id: string, es: string, en: string): Motivo[] {
  const d = borradorDesdeHechos(mensajeInicial(hechos));
  const i = d.oraciones.findIndex((o) => o.hecho === id);
  const o: Oracion = { texto_es: es, texto_en: en, hecho: id };
  d.oraciones[i] = o;
  return verificarDraft(d, hechos, p).filter((m) => m.oracion === i);
}
const reglas = (ms: Motivo[]) => [...new Set(ms.map((m) => m.regla))].sort();

describe("009 · figura_del_partido en el Verificador", () => {
  it("la plantilla del hecho pasa", () => {
    expect(con(fig.id, fig.texto_es, fig.texto_en)).toEqual([]);
  });

  it("«figura / player of the match / man of the match» con la figura como principal: pasa", () => {
    const j = fig.datos.jugador as string;
    const n = fig.datos.nota as string;
    expect(con(fig.id, `${j} fue la figura, con nota ${n}.`, `${j} was the man of the match, rated ${n}.`)).toEqual([]);
  });

  it("«man of the match» con OTRO hecho como principal (un goleador): V8", () => {
    const j = gol.datos.jugador as string;
    const m = con(gol.id, `${j} fue la figura del partido.`, `${j} was the man of the match.`);
    expect(reglas(m)).toContain("V8");
  });

  it("nota inventada: V3", () => {
    const j = fig.datos.jugador as string;
    expect(reglas(con(fig.id, `${j} fue la figura del partido (nota 9.9).`, `${j} was the player of the match (rating 9.9).`))).toContain("V3");
  });

  it("figura atribuida a otro jugador (nombre que no es del hecho): V4", () => {
    const otro = gol.datos.jugador as string;
    expect(otro).not.toBe(fig.datos.jugador);
    const n = fig.datos.nota as string;
    expect(reglas(con(fig.id, `${otro} fue la figura del partido (nota ${n}).`, `${otro} was the player of the match (rating ${n}).`))).toContain("V4");
  });

  it("corpus 1..60 con stub: la crónica pasa y narra la figura (relevancia ≥ cobertura: obligatoria)", async () => {
    const llm = crearLlmStub();
    for (let s = 1; s <= 60; s++) {
      const ps = simular(configDeSemilla(s));
      const { cronica, hechos: hs } = await generarCronica(ps, { llm });
      expect(cronica.modo).toBe("llm");
      const f = hs.find((h) => h.tipo === "figura_del_partido");
      expect(f, `seed ${s}`).toBeDefined();
      expect(cronica.oraciones.some((o) => o.hecho === f!.id)).toBe(true);
    }
  });
});
