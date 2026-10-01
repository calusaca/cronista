// Batería PERMANENTE de mentiras (brief 003, revisión 3.1): los ataques de la auditoría
// adversaria del 003 (scripts ataque.ts / protocolo.ts del auditor, semilla 246),
// adaptados al contrato «un hecho principal por oración». Cada mentira reemplaza UNA
// oración (o el título) de la crónica correcta y debe ser rechazada con la regla esperada,
// en el lugar correcto. Los falsos positivos que la auditoría encontró deben ser ACEPTADOS.
//
// Semilla 246 (15 hechos): h01 expulsión por doble amarilla · h02 doblete · h03 resultado
// 4–1 · h04–h08 goles (h05 y h07 de penal) · h09 portero · h10 justicia xG contra la
// corriente · h11/h12 marcador por periodo · h13 gol temprano · h14 presión · h15 disciplina.

import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import { borradorDesdeHechos } from "../../lib/llm-stub";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import { indiceDeId, llmGuionado, type Corruptor } from "../__fixtures__/llms-falsos";
import { ESPERADO_246, MENTIRAS, SEMILLA_MENTIRAS, VERDADES } from "../__fixtures__/mentiras";
import { MENTIRAS_R2, VERDADES_R2 } from "../__fixtures__/mentiras-r2";
import { generarCronica } from "../cadena";
import { mensajeInicial } from "../prompt";
import type { CronicaDraft, Motivo, Oracion } from "../tipos";
import { MAX_REINTENTOS } from "../umbrales";
import { verificarDraft } from "../verificador";

const SEMILLA = SEMILLA_MENTIRAS;
const p = simular(configDeSemilla(SEMILLA));
const hechos = analizar(p);
const correcto = (): CronicaDraft => borradorDesdeHechos(mensajeInicial(hechos));

function aplicar(c: { reemplaza?: string; oracion?: Oracion; titulo?: [string, string] }): { d: CronicaDraft; indice: number } {
  const d = correcto();
  let indice = -1;
  if (c.oracion) {
    if (c.reemplaza) {
      indice = indiceDeId(d, c.reemplaza);
      d.oraciones[indice] = c.oracion;
    } else {
      d.oraciones.push(c.oracion);
      indice = d.oraciones.length - 1;
    }
  }
  if (c.titulo) [d.titulo_es, d.titulo_en] = c.titulo;
  return { d, indice };
}

const resumen = (ms: Motivo[]) => ms.map((m) => `${m.regla}@${m.oracion} ${m.detalle}`).join(" | ");

describe(`la batería se apoya en los hechos esperados (semilla ${SEMILLA})`, () => {
  it("cada id es del tipo que la batería supone", () => {
    expect(Object.fromEntries(hechos.map((h) => [h.id, h.tipo]))).toEqual(ESPERADO_246);
  });
  it("la crónica correcta pasa (punto de partida limpio)", () => {
    expect(verificarDraft(correcto(), hechos, p)).toEqual([]);
  });
});

describe(`las ${MENTIRAS.length} mentiras de la auditoría: todas rechazadas con su regla y en su lugar`, () => {
  it.each(MENTIRAS.map((m) => [m.id, m] as const))("%s", (_, m) => {
    const { d, indice } = aplicar(m);
    const motivos = verificarDraft(d, hechos, p);
    const donde = m.titulo ? (x: Motivo) => x.oracion === -1 && x.detalle.startsWith("título") : (x: Motivo) => x.oracion === indice;
    expect(motivos.length, `${m.id} (${m.nota}) PASÓ`).toBeGreaterThan(0);
    expect(motivos.some((x) => x.regla === m.regla && donde(x)), `${m.id} (${m.nota}): se esperaba ${m.regla}; hubo ${resumen(motivos)}`).toBe(true);
  });
});

describe(`ronda 2 (rev. 3.2): las ${MENTIRAS_R2.length} mentiras rechazadas con su regla y en su lugar`, () => {
  it.each(MENTIRAS_R2.map((m) => [m.id, m] as const))("%s", (_, m) => {
    const { d, indice } = aplicar(m);
    const motivos = verificarDraft(d, hechos, p);
    const donde = m.titulo ? (x: Motivo) => x.oracion === -1 && x.detalle.startsWith("título") : (x: Motivo) => x.oracion === indice;
    expect(motivos.length, `${m.id} (${m.nota}) PASÓ`).toBeGreaterThan(0);
    expect(motivos.some((x) => x.regla === m.regla && donde(x)), `${m.id} (${m.nota}): se esperaba ${m.regla}; hubo ${resumen(motivos)}`).toBe(true);
  });
});

describe("ronda 2 (rev. 3.2): falsos positivos aceptados", () => {
  it.each(VERDADES_R2.map((v) => [v.id, v] as const))("%s", (_, v) => {
    const { d } = aplicar(v);
    expect(resumen(verificarDraft(d, hechos, p)), v.nota).toBe("");
  });
});

describe("falsos positivos de la auditoría: aceptados", () => {
  it.each(VERDADES.map((v) => [v.id, v] as const))("%s", (_, v) => {
    const { d } = aplicar(v);
    expect(resumen(verificarDraft(d, hechos, p)), v.nota).toBe("");
  });
});

describe("ataques al protocolo (protocolo.ts del auditor)", () => {
  const sinH07: Corruptor = (d) => {
    d.oraciones.splice(indiceDeId(d, "h07"), 1);
    return d;
  };
  const h07Ritual: Corruptor = (d) => {
    d.oraciones.splice(indiceDeId(d, "h07"), 1);
    const o = d.oraciones[indiceDeId(d, "h15")]!;
    o.apoyo = [...(o.apoyo ?? []), "h07"];
    return d;
  };
  const enMiente: Corruptor = (d) => {
    d.oraciones[indiceDeId(d, "h03")]!.texto_en = "Full time: Atlético Montefrío Bajo beat Juventud Islaverde Sur 4–1.";
    return d;
  };
  const malEn =
    (id: string): Corruptor =>
    (d) => {
      const o = d.oraciones[indiceDeId(d, id)]!;
      o.texto_es += " Hubo 99 tiros.";
      o.texto_en += " There were 99 shots.";
      return d;
    };
  const roto: Corruptor = (d) => JSON.stringify(d).slice(0, -5);

  it("P1 «V5 ritual»: poner el hecho faltante en el apoyo de otra oración no cuenta como narrarlo", async () => {
    const { cronica } = await generarCronica(p, { llm: llmGuionado([sinH07, h07Ritual]) });
    expect(cronica.audit.slice(1).every((a) => a.veredicto.some((m) => m.regla === "V5" && m.detalle.includes("h07")))).toBe(true);
    // Lo que llega al lector narra h07 como principal (aquí, vía acta).
    expect(cronica.oraciones.some((o) => o.hecho === "h07")).toBe(true);
    expect(verificarDraft(cronica, hechos, p)).toEqual([]);
  });

  it("P2: mentira solo en inglés, sin números («beat» con el perdedor como sujeto) ⇒ V8, y no llega al lector", async () => {
    const { cronica } = await generarCronica(p, { llm: llmGuionado([enMiente]) });
    expect(cronica.audit[0]?.veredicto.some((m) => m.regla === "V8")).toBe(true);
    expect(cronica.oraciones.some((o) => o.texto_en.includes("Atlético Montefrío Bajo beat"))).toBe(false);
    expect(verificarDraft(cronica, hechos, p)).toEqual([]);
  });

  it("P4: una frase mala distinta en cada intento ⇒ se omite la del último, el resto llega verificado", async () => {
    const { cronica } = await generarCronica(p, { llm: llmGuionado([malEn("h14"), malEn("h15"), malEn("h13")]) });
    expect(cronica).toMatchObject({ modo: "llm", intentos: 1 + MAX_REINTENTOS, frasesOmitidas: 1 });
    expect(cronica.oraciones.some((o) => o.hecho === "h13")).toBe(false);
    expect(verificarDraft(cronica, hechos, p)).toEqual([]);
  });

  it("P5 (B6): intento 1 casi bueno y luego JSON roto ⇒ se recupera el intento 1 por omisión, no el acta", async () => {
    const { cronica } = await generarCronica(p, { llm: llmGuionado([malEn("h14"), roto, roto]) });
    expect(cronica).toMatchObject({ modo: "llm", intentos: 1 + MAX_REINTENTOS, frasesOmitidas: 1 });
    expect(cronica.oraciones.some((o) => o.hecho === "h14")).toBe(false);
    expect(cronica.oraciones.map((o) => o.hecho)).toEqual(hechos.map((h) => h.id).filter((id) => id !== "h14"));
    expect(verificarDraft(cronica, hechos, p)).toEqual([]);
  });
});
