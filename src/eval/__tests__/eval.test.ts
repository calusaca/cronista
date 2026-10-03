// Brief 022 — la eval. Determinismo con ensayo; el titular con ensayo FIJADO desde la batería
// (cada crónica de ensayo trae exactamente un error deliberado en su primer intento, y el stub
// escribe una frase por hecho ⇒ la cifra exacta se recomputa aquí, por su cuenta); pipeline = 0
// con ensayo y con stub; el baseline no reintenta; el juez cuenta V8; las semillas son las de
// umbrales-eval; sin credenciales, mensaje claro y exit ≠ 0.
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import type { Llm, Mensaje } from "../../lib/llm";
import { crearLlmEnsayo } from "../../lib/llm-ensayo";
import { crearLlmStub } from "../../lib/llm-stub";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import { correrEval, informe, titular } from "../eval";
import { EVAL_SEMILLAS } from "../umbrales-eval";

const conConteo = (base: Llm) => {
  const llamadas: Mensaje[][] = [];
  return { llm: { id: base.id, completar: (s: string, m: Mensaje[]) => (llamadas.push(m), base.completar(s, m)) } as Llm, llamadas };
};

describe("022 · eval con ensayo", async () => {
  const a = await correrEval(crearLlmEnsayo());
  const b = await correrEval(crearLlmEnsayo());

  it("determinista: dos corridas ⇒ el mismo informe, byte a byte", () => {
    expect(informe(b)).toBe(informe(a));
  });

  it("las semillas son EVAL_SEMILLAS: 20, con las cuatro del brief y 20 marcadores distintos", () => {
    expect(a.filas.map((f) => f.seed)).toEqual([...EVAL_SEMILLAS]);
    expect(EVAL_SEMILLAS).toHaveLength(20);
    for (const s of [246, 116, 834, 289]) expect(EVAL_SEMILLAS).toContain(s);
    const marcadores = EVAL_SEMILLAS.map((s) => {
      const g = simular(configDeSemilla(s)).eventos.filter((e) => e.tipo === "gol");
      return `${g.filter((e) => e.equipo === "local").length}-${g.filter((e) => e.equipo === "visita").length}`;
    });
    expect(new Set(marcadores).size).toBe(20);
  });

  it("el titular con ensayo es EXACTAMENTE el de la batería: un error por crónica sobre una frase por hecho", () => {
    const frases = EVAL_SEMILLAS.reduce((s, seed) => s + analizar(simular(configDeSemilla(seed))).length, 0);
    const pct = Math.round((EVAL_SEMILLAS.length * 1000) / frases) / 10;
    expect([a.baselineFrases, a.baselineConHallazgos, a.porcentaje]).toEqual([frases, EVAL_SEMILLAS.length, pct]);
    expect(titular(a)).toBe(`${pct.toFixed(1)}% of unverified sentences contained unsupported claims; the pipeline published 0.`);
    for (const f of a.filas) expect([f.baselineConHallazgos, f.baselineReglas]).toEqual([1, ["V3"]]);
  });

  it("pipeline = 0: nada con hallazgos llega al lector (se juzga lo PUBLICADO), y el informe lo rotula como ensayo", () => {
    expect(a.pipelineConHallazgos).toBe(0);
    for (const f of a.filas) expect([f.pipelineConHallazgos, f.pipelineModo, f.pipelineIntentos]).toEqual([0, "llm", 2]);
    expect(informe(a)).toContain("ENSAYO RUN — NOT the headline figure");
  });
});

describe("022 · baseline, juez y backends", () => {
  it("con stub: baseline 0 y pipeline 0 (el stub escribe las plantillas verificadas)", async () => {
    const r = await correrEval(crearLlmStub(), EVAL_SEMILLAS.slice(0, 5));
    expect([r.baselineConHallazgos, r.pipelineConHallazgos]).toEqual([0, 0]);
  });

  it("el baseline no reintenta jamás: UNA llamada de baseline por semilla (la cadena hace las suyas aparte)", async () => {
    const { llm, llamadas } = conConteo(crearLlmEnsayo());
    await correrEval(llm, [246]);
    // baseline (1) + cadena (2: el ensayo falla y se corrige) — y la del baseline es un primer intento puro.
    expect(llamadas).toHaveLength(3);
    expect(llamadas[0]).toHaveLength(1);
  });

  it("el juez cuenta V8: una mentira de juicio en el primer intento es una frase con hallazgo", async () => {
    // «goleada» en un 1–0 (semilla 10): solo V8 la caza (no hay cifra ni nombre falso).
    const stub = crearLlmStub();
    const mentiroso: Llm = {
      id: "stub",
      async completar(s, m) {
        const d = JSON.parse(await stub.completar(s, m)) as { oraciones: { texto_es: string; texto_en: string }[] };
        if (m.filter((x) => x.rol === "user").length === 1 && d.oraciones[0]) {
          d.oraciones[0].texto_es = d.oraciones[0].texto_es.replace(/\.$/, "; fue una goleada.");
          d.oraciones[0].texto_en = d.oraciones[0].texto_en.replace(/\.$/, "; it was a rout.");
        }
        return JSON.stringify(d);
      },
    };
    const r = await correrEval(mentiroso, [10]);
    expect(r.filas[0]!.baselineConHallazgos).toBe(1);
    expect(r.filas[0]!.baselineReglas).toEqual(["V8"]);
    expect(r.pipelineConHallazgos).toBe(0);
  });

  it("sin red: CRONISTA_LLM=foundry sin credenciales ⇒ mensaje que nombra la variable y exit ≠ 0", () => {
    const env = { ...process.env, CRONISTA_LLM: "foundry", FOUNDRY_API_KEY: "", FOUNDRY_BASE_URL: "", FOUNDRY_DEPLOYMENT: "" };
    const r = spawnSync(process.execPath, ["--import", "tsx", "src/eval/cli.ts"], { env, encoding: "utf8" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/FOUNDRY_API_KEY/);
    expect(r.stdout).toBe("");
  });
});
