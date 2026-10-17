import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import type { Hecho } from "../../analista/tipos";
import { borradorDesdeHechos } from "../../lib/llm-stub";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import real from "../__fixtures__/sujeto-implicito-real.json";
import { generarCronica } from "../cadena";
import { mensajeInicial } from "../prompt";
import { verificarDraft } from "../verificador";

const partido = simular(configDeSemilla(real.seed));
const hechos = analizar(partido);
const remontada = hechos.find((h) => h.tipo === "remontada") as Hecho;
const A = String(remontada.datos.equipo);
const B = String(remontada.datos.rival);
const original = real.draft.oraciones.find((o) => o.hecho === remontada.id)!;

function motivos(es: string, en: string) {
  const draft = structuredClone(real.draft);
  const o = draft.oraciones.find((o) => o.hecho === remontada.id)!;
  o.texto_es = es;
  o.texto_en = en;
  return verificarDraft(draft, hechos, partido);
}

describe("V8 — sujeto implícito tras dos puntos en una remontada", () => {
  it("acepta el borrador real de GPT-6.1 Sol que originó el falso positivo", () => {
    expect(verificarDraft(real.draft, hechos, partido)).toEqual([]);
  });

  it.each([
    ["resultado inmediato", `${A} remontó ante ${B}: ganó 3–1.`, `${A} came from behind against ${B}: won 3–1.`],
    ["otro verbo de remontada", `${A} remontó contra ${B}: perdía 0–1 en el minuto 8 y ganó 3–1.`, `${A} came back against ${B}: they were 0–1 down in minute 8 and won 3–1.`],
    ["rival omitido", `${A} remontó: ganó 3–1.`, `${A} fought back: they won 3–1.`],
    ["espacios y dos puntos normalizados", `${A} remontó ante ${B}：\n ganó 3–1.`, `${A} came from behind against ${B}：\n won 3–1.`],
  ])("acepta %s", (_label, es, en) => {
    expect(motivos(es, en)).toEqual([]);
  });

  it("aplica la misma regla a equipos, minutos y marcadores distintos del corpus", () => {
    const comprobadas: number[] = [];
    for (let seed = 1; seed <= 50; seed++) {
      const p = simular(configDeSemilla(seed));
      const hs = analizar(p);
      const h = hs.find((h) => h.tipo === "remontada" && h.datos.desenlace === "victoria");
      if (!h) continue;
      const d = h.datos;
      const draft = borradorDesdeHechos(mensajeInicial(hs));
      const o = draft.oraciones.find((o) => o.hecho === h.id)!;
      o.texto_es = `${d.equipo} remontó ante ${d.rival}: perdía ${d.desventaja_propios}–${d.desventaja_rival} en el minuto ${d.minuto_desventaja} y ganó ${d.final_propios}–${d.final_rival}.`;
      o.texto_en = `${d.equipo} came from behind against ${d.rival}: they were ${d.desventaja_propios}–${d.desventaja_rival} down in minute ${d.minuto_desventaja} and won ${d.final_propios}–${d.final_rival}.`;
      expect(verificarDraft(draft, hs, p), `semilla ${seed}`).toEqual([]);
      comprobadas.push(seed);
    }
    expect(comprobadas.length).toBeGreaterThan(1);
  });

  it("la cadena publica el borrador real en un intento y sin omisiones", async () => {
    let llamadas = 0;
    const { cronica } = await generarCronica(partido, {
      llm: { id: "regresion-sujeto-implicito", completar: async () => { llamadas++; return JSON.stringify(real.draft); } },
    });
    expect(llamadas).toBe(1);
    expect(cronica).toMatchObject({ modo: "llm", intentos: 1, frasesOmitidas: 0 });
    expect(cronica.oraciones).toEqual(real.draft.oraciones);
  });
});

describe.each(["es", "en"] as const)("V8 — controles adversarios solo en %s", (lengua) => {
  it.each([
    ["sujeto inicial perdedor", `${B} remontó ante ${A}: ganó 3–1.`, `${B} came from behind against ${A}: won 3–1.`],
    ["sujeto nuevo antes del verbo", `${A} remontó ante ${B}: ${B} ganó 3–1.`, `${A} came from behind against ${B}: ${B} won 3–1.`],
    ["sujeto nuevo después del verbo", `${A} remontó ante ${B}: ganó ${B} 3–1.`, `${A} came from behind against ${B}: won ${B} 3–1.`],
    ["verbo de derrota", `${A} remontó ante ${B}: perdió 3–1.`, `${A} came from behind against ${B}: lost 3–1.`],
    ["desventaja cambiada con cifras legítimas", `${A} remontó ante ${B}: perdía 3–1 en el minuto 8 y ganó 3–1.`, `${A} came from behind against ${B}: they were 3–1 down in minute 8 and won 3–1.`],
    ["minuto cambiado con una cifra legítima", `${A} remontó ante ${B}: perdía 0–1 en el minuto 3 y ganó 3–1.`, `${A} came from behind against ${B}: they were 0–1 down in minute 3 and won 3–1.`],
    ["dos sujetos posibles", `${A} y ${B} remontaron: ganó 3–1.`, `${A} and ${B} came back: won 3–1.`],
    ["contexto sin una declaración de remontada", `${A} habló sobre ${B}: ganó 3–1.`, `${A} spoke about ${B}: won 3–1.`],
    ["sujeto ambiguo el rival", `${A} remontó ante ${B}: el rival ganó 3–1.`, `${A} came from behind against ${B}: their opponent won 3–1.`],
    ["pronombre ambiguo", `${A} remontó ante ${B}: este ganó 3–1.`, `${A} came from behind against ${B}: the latter won 3–1.`],
    ["frase independiente", `${A} remontó ante ${B}. ganó 3–1.`, `${A} came from behind against ${B}. won 3–1.`],
    ["punto y coma", `${A} remontó ante ${B}; ganó 3–1.`, `${A} came from behind against ${B}; won 3–1.`],
    ["segundo segmento sin sujeto", `${A} remontó ante ${B}: tras el partido: ganó 3–1.`, `${A} came from behind against ${B}: after the match: won 3–1.`],
  ])("rechaza %s sin que el otro idioma oculte el control", (_label, es, en) => {
    const ms = motivos(lengua === "es" ? es : original.texto_es, lengua === "en" ? en : original.texto_en);
    expect(ms.some((m) => m.regla === "V8" && m.detalle.endsWith(`(${lengua.toUpperCase()})`))).toBe(true);
    const otra = lengua === "es" ? "EN" : "ES";
    expect(ms.filter((m) => m.detalle.endsWith(`(${otra})`))).toEqual([]);
  });
});
