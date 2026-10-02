// Brief 015 — las magnitudes del tiro en la cadena: entran a los `datos` del gol ⇒ V3/V6 las
// verifican; «desde fuera del área / from outside the box» y «un misil / a rocket» son
// computables (V8). Cada mentira en un idioma con el otro limpio. Umbrales importados.
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import type { Hecho } from "../../analista/tipos";
import { borradorDesdeHechos } from "../../lib/llm-stub";
import { FUERA_DEL_AREA_M, MISIL_KMH } from "../../sim/limites";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Partido } from "../../sim/tipos";
import { mensajeInicial } from "../prompt";
import type { Motivo, Oracion } from "../tipos";
import { verificarDraft } from "../verificador";

function golCon(pred: (h: Hecho) => boolean): { p: Partido; hs: Hecho[]; h: Hecho } {
  for (let s = 1; s <= 400; s++) {
    const p = simular(configDeSemilla(s));
    const hs = analizar(p);
    const h = hs.find((x) => x.tipo === "gol_anotado" && pred(x));
    if (h) return { p, hs, h };
  }
  throw new Error("fixture: no hay un gol así en 1..400");
}
function con(p: Partido, hs: Hecho[], id: string, es: string, en: string): Motivo[] {
  const d = borradorDesdeHechos(mensajeInicial(hs));
  const i = d.oraciones.findIndex((o) => o.hecho === id);
  const o: Oracion = { texto_es: es, texto_en: en, hecho: id };
  d.oraciones[i] = o;
  return verificarDraft(d, hs, p).filter((m) => m.oracion === i);
}
const enIdioma = (ms: Motivo[], regla: string, lengua: "ES" | "EN") => ms.some((m) => m.regla === regla && m.detalle.endsWith(`(${lengua})`));
const sin = (t: string) => t.replace(/\.$/, "");
const d = (h: Hecho) => Number(h.datos.distancia_m);
const v = (h: Hecho) => Number(h.datos.velocidad_kmh);

describe("015 · los datos del gol llevan las magnitudes de su tiro", () => {
  it("distancia_m y velocidad_kmh en todo gol del corpus 1..100, iguales a las del tiro", () => {
    for (let s = 1; s <= 100; s++) {
      const p = simular(configDeSemilla(s));
      for (const h of analizar(p).filter((x) => x.tipo === "gol_anotado")) {
        const tiro = p.eventos.find((e) => h.eventos.includes(e.id) && e.tipo === "tiro")!;
        expect(h.datos.distancia_m).toBe(tiro.distanciaM);
        expect(h.datos.velocidad_kmh).toBe(tiro.velocidadKmh);
      }
    }
  });
});

describe("015 · V3/V6: la cifra narrada tiene que ser la registrada", () => {
  const { p, hs, h } = golCon(() => true);
  const es = (dist: number, vel: number) => `${sin(h.texto_es)}, desde ${dist} metros y a ${vel} km/h.`;
  const en = (dist: number, vel: number) => `${sin(h.texto_en)}, from ${dist} metres at ${vel} km/h.`;

  it("narrar la distancia y la velocidad registradas SÍ pasa", () => expect(con(p, hs, h.id, es(d(h), v(h)), en(d(h), v(h)))).toEqual([]));
  it("distancia cambiada ⇒ V3 en ES (EN limpio) y en EN (ES limpio)", () => {
    expect(enIdioma(con(p, hs, h.id, es(d(h) + 7, v(h)), en(d(h), v(h))), "V3", "ES")).toBe(true);
    expect(enIdioma(con(p, hs, h.id, es(d(h), v(h)), en(d(h) + 7, v(h))), "V3", "EN")).toBe(true);
  });
  it("velocidad cambiada ⇒ V3", () => {
    expect(enIdioma(con(p, hs, h.id, es(d(h), v(h) + 13), en(d(h), v(h))), "V3", "ES")).toBe(true);
  });
});

describe("015 · V8 computable: «desde fuera del área / from outside the box»", () => {
  const lejos = golCon((x) => d(x) >= FUERA_DEL_AREA_M);
  const cerca = golCon((x) => d(x) < FUERA_DEL_AREA_M && d(x) <= 9);

  it(`con un gol desde ≥ ${FUERA_DEL_AREA_M} m SÍ pasa`, () => {
    const { p, hs, h } = lejos;
    expect(con(p, hs, h.id, `${sin(h.texto_es)}, desde fuera del área.`, `${sin(h.texto_en)}, from outside the box.`)).toEqual([]);
  });
  it(`con un gol desde ${d(cerca.h)} m ⇒ V8 (ES y EN por separado)`, () => {
    const { p, hs, h } = cerca;
    expect(enIdioma(con(p, hs, h.id, `${sin(h.texto_es)}, desde fuera del área.`, h.texto_en), "V8", "ES")).toBe(true);
    expect(enIdioma(con(p, hs, h.id, h.texto_es, `${sin(h.texto_en)}, from outside the box.`), "V8", "EN")).toBe(true);
  });
});

describe("015 · V8 computable: «un misil / a rocket»", () => {
  const fuerte = golCon((x) => v(x) >= MISIL_KMH);
  const blando = golCon((x) => v(x) <= 75);

  it(`con un disparo de ≥ ${MISIL_KMH} km/h SÍ pasa`, () => {
    const { p, hs, h } = fuerte;
    expect(con(p, hs, h.id, `${sin(h.texto_es)}: un misil.`, `${sin(h.texto_en)}: a rocket.`)).toEqual([]);
  });
  it(`con un disparo de ${v(blando.h)} km/h ⇒ V8 (ES y EN por separado)`, () => {
    const { p, hs, h } = blando;
    expect(enIdioma(con(p, hs, h.id, `${sin(h.texto_es)}: un misil.`, h.texto_en), "V8", "ES")).toBe(true);
    expect(enIdioma(con(p, hs, h.id, h.texto_es, `${sin(h.texto_en)}: a rocket.`), "V8", "EN")).toBe(true);
  });
  it("«misil» con un hecho sin velocidad (resultado final) ⇒ V8", () => {
    const { p, hs } = fuerte;
    const r = hs.find((x) => x.tipo === "resultado_final")!;
    expect(enIdioma(con(p, hs, r.id, `${sin(r.texto_es)}, con un misil.`, r.texto_en), "V8", "ES")).toBe(true);
  });
});
