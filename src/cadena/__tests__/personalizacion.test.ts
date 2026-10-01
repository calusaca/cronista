// Brief 007 — personalización: se personaliza selección, orden y tono, JAMÁS la verdad.
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import type { Hecho } from "../../analista/tipos";
import { crearLlmStub } from "../../lib/llm-stub";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import { indiceDeId, llmGuionado, type Corruptor } from "../__fixtures__/llms-falsos";
import { crearCacheDisco, nombreArchivo } from "../cache";
import { generarCronica } from "../cadena";
import { equipoDeModo, esDelEquipo, instruccionPerspectiva, repriorizar } from "../personalizacion";
import { DELTA_MI_EQUIPO, MAX_REINTENTOS } from "../umbrales";
import { verificarDraft } from "../verificador";

const p = simular(configDeSemilla(246));
const base = analizar(p);
const J = p.config.local.nombre; // Juventud Islaverde Sur (ganó 4–1)
const A = p.config.visita.nombre; // Atlético Montefrío Bajo

describe("re-priorización determinista", () => {
  it("mismo partido y modo ⇒ misma lista, mismo orden, mismos IDs (byte a byte)", () => {
    for (const modo of ["neutral", "equipo:local", "equipo:visita"] as const) {
      expect(JSON.stringify(repriorizar(base, modo, p))).toBe(JSON.stringify(repriorizar(analizar(p), modo, p)));
    }
  });

  it("neutral ⇒ los hechos del Analista tal cual", () => {
    expect(repriorizar(base, "neutral", p)).toEqual(base);
  });

  it(`los hechos del equipo suben exactamente DELTA_MI_EQUIPO (${DELTA_MI_EQUIPO}, tope 100); los demás no cambian`, () => {
    for (const [modo, equipo] of [["equipo:local", J], ["equipo:visita", A]] as const) {
      const r = repriorizar(base, modo, p);
      for (const h of base) {
        const nuevo = r.find((x) => x.id === h.id) as Hecho;
        expect(nuevo.relevancia).toBe(esDelEquipo(h, equipo) ? Math.min(100, h.relevancia + DELTA_MI_EQUIPO) : h.relevancia);
      }
      expect(base.some((h) => esDelEquipo(h, equipo))).toBe(true);
    }
  });

  it("solo cambia la relevancia y el orden: textos, datos, eventos e IDs intactos; la entrada no se muta", () => {
    const copia = JSON.stringify(base);
    const r = repriorizar(base, "equipo:visita", p);
    expect(JSON.stringify(base)).toBe(copia);
    const sinRelevancia = (hs: Hecho[]) => hs.map(({ relevancia: _r, ...resto }) => resto).sort((a, b) => a.id.localeCompare(b.id));
    expect(sinRelevancia(r)).toEqual(sinRelevancia(base));
  });

  it("orden por relevancia descendente, estable (a igualdad, el orden del Analista)", () => {
    const r = repriorizar(base, "equipo:visita", p);
    for (let k = 1; k < r.length; k++) {
      const a = r[k - 1] as Hecho;
      const b = r[k] as Hecho;
      expect(a.relevancia).toBeGreaterThanOrEqual(b.relevancia);
      if (a.relevancia === b.relevancia) expect(base.findIndex((h) => h.id === a.id)).toBeLessThan(base.findIndex((h) => h.id === b.id));
    }
  });

  it("los hechos de ambos equipos (resultado, marcador por periodo, justicia xG) nunca suben", () => {
    for (const modo of ["equipo:local", "equipo:visita"] as const) {
      const r = repriorizar(base, modo, p);
      for (const tipo of ["resultado_final", "marcador_por_periodo", "justicia_xg"]) {
        for (const h of base.filter((x) => x.tipo === tipo)) expect(r.find((x) => x.id === h.id)?.relevancia).toBe(h.relevancia);
      }
    }
  });

  it("el orden cambia de verdad respecto del neutral (semilla 246, afición visitante)", () => {
    expect(repriorizar(base, "equipo:visita", p).map((h) => h.id)).not.toEqual(base.map((h) => h.id));
  });
});

describe("perspectiva en la cadena", () => {
  it("el Cronista recibe la instrucción de perspectiva solo en modo «mi equipo»", async () => {
    const neutro = llmGuionado(["ok"]);
    await generarCronica(p, { llm: neutro });
    expect(neutro.llamadas[0]?.[0]?.contenido).not.toContain("Perspectiva");
    const fan = llmGuionado(["ok"]);
    await generarCronica(p, { llm: fan, modoPersonalizacion: "equipo:visita" });
    expect(fan.llamadas[0]?.[0]?.contenido).toContain(instruccionPerspectiva("equipo:visita", p));
    expect(fan.llamadas[0]?.[0]?.contenido).toContain(A);
  });

  it("con el stub: crónica verificada, en el orden re-priorizado, distinto del neutral", async () => {
    const neutro = await generarCronica(p, { llm: crearLlmStub() });
    const fan = await generarCronica(p, { llm: crearLlmStub(), modoPersonalizacion: "equipo:visita" });
    expect(verificarDraft(fan.cronica, fan.hechos, p)).toEqual([]);
    expect(fan.cronica.oraciones.map((o) => o.hecho)).toEqual(repriorizar(base, "equipo:visita", p).map((h) => h.id));
    expect(fan.cronica.oraciones.map((o) => o.hecho)).not.toEqual(neutro.cronica.oraciones.map((o) => o.hecho));
    // Mismos hechos narrados (mismo conjunto), mismos textos: la verdad no cambió.
    expect(new Set(fan.cronica.oraciones.map((o) => o.texto_en))).toEqual(new Set(neutro.cronica.oraciones.map((o) => o.texto_en)));
  });

  it("equipoDeModo resuelve el nombre del equipo", () => {
    expect(equipoDeModo("equipo:local", p)).toBe(J);
    expect(equipoDeModo("equipo:visita", p)).toBe(A);
    expect(equipoDeModo("neutral", p)).toBeUndefined();
  });
});

describe("la crónica de «mi equipo» pasa el MISMO Verificador (cronista malicioso en modo perspectiva)", () => {
  // Un cronista hincha de Atlético (que perdió 4–1): invierte el resultado, inventa dominio y merecimiento.
  const hincha: Corruptor = (d) => {
    const r = d.oraciones[indiceDeId(d, "h03")]!;
    r.texto_es = `${A} ganó a ${J}: ${J} 4–1 ${A}.`;
    r.texto_en = `${A} beat ${J}: ${J} 4–1 ${A}.`;
    const pres = d.oraciones[indiceDeId(d, "h15")]!;
    pres.texto_es += ` ${A} dominó y mereció más.`;
    pres.texto_en += ` ${A} dominated and deserved more.`;
    return d;
  };

  it("persistente: cada intento rechazado (V8), y nada de la mentira llega al lector", async () => {
    const { cronica, hechos } = await generarCronica(p, { llm: llmGuionado([hincha]), modoPersonalizacion: "equipo:visita" });
    expect(cronica.intentos).toBe(1 + MAX_REINTENTOS);
    expect(cronica.audit.every((a) => a.veredicto.some((m) => m.regla === "V8"))).toBe(true);
    expect(verificarDraft(cronica, hechos, p)).toEqual([]);
    const todo = cronica.oraciones.map((o) => `${o.texto_es} ${o.texto_en}`).join(" ");
    for (const mentira of [`${A} ganó`, `${A} beat`, "dominó", "dominated", "mereció", "deserved"]) expect(todo).not.toContain(mentira);
  });

  it("una sola vez y luego corrige: la versión fiel se aprueba con la historia del rechazo", async () => {
    const { cronica, hechos } = await generarCronica(p, { llm: llmGuionado([hincha, "ok"]), modoPersonalizacion: "equipo:visita" });
    expect(cronica).toMatchObject({ modo: "llm", intentos: 2 });
    expect(cronica.audit[0]?.veredicto.some((m) => m.regla === "V8")).toBe(true);
    expect(verificarDraft(cronica, hechos, p)).toEqual([]);
  });

  it("perspectiva sin mentir pasa: un texto fiel centrado en Atlético es aceptado", async () => {
    const fiel: Corruptor = (d) => {
      const o = d.oraciones[indiceDeId(d, "h08")]!;
      o.texto_es = `Para ${A}, el descuento llegó en el minuto 60: Bruno Toroino marcó de penal.`;
      o.texto_en = `For ${A}, the consolation came in minute 60: Bruno Toroino scored a penalty.`;
      return d;
    };
    const { cronica } = await generarCronica(p, { llm: llmGuionado([fiel]), modoPersonalizacion: "equipo:visita" });
    expect(cronica).toMatchObject({ modo: "llm", intentos: 1 });
  });
});

describe("caché por (seed, deployment, modo)", () => {
  it("cada perspectiva tiene su entrada y se sirve a la suya", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cronista-007-"));
    const cache = crearCacheDisco(dir);
    for (const modo of ["neutral", "equipo:local", "equipo:visita"] as const) await generarCronica(p, { llm: crearLlmStub(), cache, modoPersonalizacion: modo });
    expect(readdirSync(dir).sort()).toEqual(
      (["neutral", "equipo:local", "equipo:visita"] as const).map((modo) => nombreArchivo({ seed: 246, deployment: "stub", modo })).sort(),
    );
    const espia = llmGuionado(["ok"], "stub");
    const r = await generarCronica(p, { llm: espia, cache, modoPersonalizacion: "equipo:visita" });
    expect(r.desdeCache).toBe(true);
    expect(espia.llamadas).toHaveLength(0);
    expect(r.cronica.oraciones.map((o) => o.hecho)).toEqual(repriorizar(base, "equipo:visita", p).map((h) => h.id));
  });
});
