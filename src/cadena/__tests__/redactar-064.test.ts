// Brief 064 § 4.4 / I10 · `redactarYVerificar` se extrajo de `generarCronica` sin cambiar su conducta: el golden tomado
// ANTES del refactor (`__fixtures__/golden-064.json`, commit propio) coincide carácter a carácter. Además: sin
// `opcionesLlm` la llamada sigue siendo de dos argumentos; `verificarExtra` entra en cada intento y en la
// re-verificación final; `antesDeLlamar` y `maxCaracteresRespuesta` cortan sin llamar / sin reenviar.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import type { Llm, Mensaje, OpcionesLlm } from "../../lib/llm";
import { borradorDesdeHechos } from "../../lib/llm-stub";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import { calcularGolden064 } from "../__fixtures__/generar-golden-064";
import { generarCronica, redactarYVerificar } from "../cadena";
import { mensajeInicial, SYSTEM_PROMPT } from "../prompt";
import type { Motivo } from "../tipos";
import { COBERTURA, MAX_REINTENTOS } from "../umbrales";

const golden = JSON.parse(readFileSync(join(__dirname, "..", "__fixtures__", "golden-064.json"), "utf8")) as Record<string, string>;

interface LlmContado extends Llm { argumentos: number[]; mensajes: Mensaje[][]; opciones: (OpcionesLlm | undefined)[] }
/** Doble que responde el borrador correcto (como el stub), opcionalmente reordenado, y registra cada llamada. */
function llmContado(transformar: (salida: string) => string = (s) => s): LlmContado {
  const argumentos: number[] = [];
  const mensajes: Mensaje[][] = [];
  const opciones: (OpcionesLlm | undefined)[] = [];
  return {
    id: "contado",
    argumentos,
    mensajes,
    opciones,
    async completar(...args: unknown[]): Promise<string> {
      argumentos.push(args.length);
      const ms = args[1] as Mensaje[];
      mensajes.push(ms.map((m) => ({ ...m })));
      opciones.push(args[2] as OpcionesLlm | undefined);
      return transformar(JSON.stringify(borradorDesdeHechos(ms[0]!.contenido)));
    },
  };
}

const partido42 = () => simular(configDeSemilla(42));

describe("064 · I10 golden de generarCronica", () => {
  it("las 12 combinaciones (246/42/7 × neutral/equipo:local × stub/ensayo) son idénticas al golden previo al refactor", async () => {
    const ahora = await calcularGolden064();
    expect(Object.keys(ahora).sort()).toEqual(Object.keys(golden).sort());
    for (const k of Object.keys(golden)) expect(ahora[k], k).toBe(golden[k]);
  });

  it("sin opcionesLlm la llamada es de dos argumentos (generarCronica y redactarYVerificar)", async () => {
    const a = llmContado();
    await generarCronica(partido42(), { llm: a });
    expect(a.argumentos).toEqual([2]);
    const b = llmContado();
    const p = partido42();
    await redactarYVerificar(analizar(p), p, b);
    expect(b.argumentos).toEqual([2]);
  });

  it("con opcionesLlm se pasan como tercer argumento, una vez por intento", async () => {
    const llm = llmContado();
    const p = partido42();
    const vistos: number[] = [];
    await redactarYVerificar(analizar(p), p, llm, { opcionesLlm: (n) => { vistos.push(n); return { maxTokens: 7 }; } });
    expect(llm.argumentos).toEqual([3]);
    expect(llm.opciones[0]).toEqual({ maxTokens: 7 });
    expect(vistos).toEqual([1]);
  });

  it("system por defecto = SYSTEM_PROMPT; con system propio se usa ese", async () => {
    const sistemas: string[] = [];
    const p = partido42();
    const hechos = analizar(p);
    const llm: Llm = { id: "s", async completar(s, ms) { sistemas.push(s); return JSON.stringify(borradorDesdeHechos(ms[0]!.contenido)); } };
    await redactarYVerificar(hechos, p, llm);
    await redactarYVerificar(hechos, p, llm, { system: "OTRO" });
    expect(sistemas).toEqual([SYSTEM_PROMPT, "OTRO"]);
  });
});

describe("064 · verificarExtra", () => {
  it("rechaza la oración 0 (no obligatoria) en cada intento → omitida tras agotar intentos si V5 aguanta", async () => {
    const p = partido42();
    const hechos = analizar(p);
    const opcional = hechos.find((h) => h.relevancia < COBERTURA)!;
    expect(opcional).toBeDefined();
    // El doble pone primero la oración del hecho no obligatorio.
    const llm = llmContado((s) => {
      const d = JSON.parse(s) as { oraciones: { hecho: string }[] };
      d.oraciones.sort((x, y) => (x.hecho === opcional.id ? -1 : y.hecho === opcional.id ? 1 : 0));
      return JSON.stringify(d);
    });
    const extra = (d: { oraciones: { hecho: string }[] }): Motivo[] =>
      d.oraciones.flatMap((o, i) => (o.hecho === opcional.id ? [{ oracion: i, regla: "V3" as const, detalle: "extra de prueba" }] : []));
    const { cronica } = await redactarYVerificar(hechos, p, llm, { verificarExtra: extra });
    expect(llm.argumentos.length).toBe(1 + MAX_REINTENTOS);
    expect(cronica.modo).toBe("llm");
    expect(cronica.frasesOmitidas).toBe(1);
    expect(cronica.oraciones.some((o) => o.hecho === opcional.id)).toBe(false);
    expect(cronica.audit.every((a) => a.veredicto.some((m) => m.detalle === "extra de prueba"))).toBe(true);
    // El feedback del reintento lleva el motivo extra.
    expect(cronica.audit[0]!.feedback).toContain("extra de prueba");
  });

  it("asegurarVerificada aplica verificarExtra al final: un rechazo general que la omisión no puede quitar es error de programa", async () => {
    const p = partido42();
    const general: Motivo = { oracion: -1, regla: "V3", detalle: "general de prueba" };
    await expect(redactarYVerificar(analizar(p), p, llmContado(), { verificarExtra: () => [general] })).rejects.toThrow(/error de programa/);
  });
});

describe("064 · antesDeLlamar, feedback y maxCaracteresRespuesta", () => {
  it("antesDeLlamar false en el primer intento → cero llamadas y acta", async () => {
    const p = partido42();
    const llm = llmContado();
    const { cronica, huboErrorLlm } = await redactarYVerificar(analizar(p), p, llm, { antesDeLlamar: () => false });
    expect(llm.argumentos).toEqual([]);
    expect(cronica.modo).toBe("acta");
    expect(cronica.intentos).toBe(0);
    expect(huboErrorLlm).toBe(false);
  });

  it("antesDeLlamar recibe system, mensajes e intento; false en el 2.º corta tras uno", async () => {
    const p = partido42();
    const llm = llmContado((s) => s.replace('"oraciones":[', '"oraciones":[{"texto_es":"Hubo 99 remates.","texto_en":"There were 99 shots.","hecho":"h01"},'));
    const vistos: [string, number, number][] = [];
    const { cronica } = await redactarYVerificar(analizar(p), p, llm, {
      antesDeLlamar: (s, ms, n) => { vistos.push([s, ms.length, n]); return n < 2; },
    });
    expect(llm.argumentos.length).toBe(1);
    expect(vistos).toEqual([[SYSTEM_PROMPT, 1, 1], [SYSTEM_PROMPT, 3, 2]]);
    expect(cronica.intentos).toBe(1);
  });

  it("feedback propio sustituye al de prompt.ts", async () => {
    const p = partido42();
    const llm = llmContado((s) => s.replace('"oraciones":[', '"oraciones":[{"texto_es":"Hubo 99 remates.","texto_en":"There were 99 shots.","hecho":"h01"},'));
    const { cronica } = await redactarYVerificar(analizar(p), p, llm, { feedback: () => "FB" });
    expect(cronica.audit[0]!.feedback).toBe("FB");
    expect(llm.mensajes[1]!.at(-1)).toEqual({ rol: "user", contenido: "FB" });
  });

  it("una respuesta más larga que el máximo es V1 y no se reenvía (el siguiente intento parte de los mensajes previos)", async () => {
    const p = partido42();
    let n = 0;
    const llm = llmContado((s) => (++n === 1 ? s + " ".repeat(50) : s));
    const hechos = analizar(p);
    const base = JSON.stringify(borradorDesdeHechos(mensajeInicial(hechos)));
    const { cronica } = await redactarYVerificar(hechos, p, llm, { maxCaracteresRespuesta: base.length });
    expect(llm.argumentos.length).toBe(2);
    expect(cronica.audit[0]!.veredicto[0]).toMatchObject({ regla: "V1", oracion: -1 });
    expect(cronica.audit[0]!.veredicto[0]!.detalle).toMatch(/demasiado larga/);
    expect(cronica.audit[0]!.feedback).toBeUndefined();
    expect(llm.mensajes[1]!.length).toBe(1);
    expect(cronica.modo).toBe("llm");
    expect(cronica.intentos).toBe(2);
  });
});

