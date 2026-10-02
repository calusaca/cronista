// Revisión 3.1 del 003 (§6): pruebas que matan las mutaciones que sobrevivían a la
// auditoría (sus ids entre corchetes, del harness mutar.mjs del auditor), más la caché
// endurecida, B6 y `--modo acta` sin env. La batería de mentiras vive en mentiras.test.ts.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import { crearLlmStub } from "../../lib/llm-stub";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import { indiceDeId, jugadorFantasma, llmGuionado, numeroInventado, type Corruptor } from "../__fixtures__/llms-falsos";
import { borradorActa } from "../acta";
import { crearCacheDisco, nombreArchivo, VERSION_CACHE } from "../cache";
import { generarCronica } from "../cadena";
import { EXPLICACION, mensajeInicial } from "../prompt";
import { COBERTURA, MAX_REINTENTOS } from "../umbrales";
import { verificarDraft } from "../verificador";

const p42 = () => simular(configDeSemilla(42));
const p246 = () => simular(configDeSemilla(246));
const dirTemporal = () => mkdtempSync(join(tmpdir(), "cronista-r31-"));

describe("feedback al Cronista [M01, M02, M03]", () => {
  it("nombra la oración en base 1, explica la regla y trae el detalle (qué número)", async () => {
    const { cronica, hechos } = await generarCronica(p42(), { llm: llmGuionado([numeroInventado(), "ok"]) });
    const motivo = cronica.audit[0]!.veredicto.find((m) => m.regla === "V3")!;
    const fb = cronica.audit[0]!.feedback as string;
    // [M01] la oración rechazada, contada desde 1
    expect(fb).toContain(`Oración ${motivo.oracion + 1} — V3`);
    const gol = hechos.find((h) => h.tipo === "gol_anotado")!;
    expect(cronica.audit[0]!.borrador.oraciones[motivo.oracion]!.hecho).toBe(gol.id);
    // [M02] la explicación de ESA regla
    expect(fb).toContain(`V3 (${EXPLICACION.V3})`);
    // [M03] el detalle concreto
    expect(fb).toContain(motivo.detalle);
    expect(fb).toContain("37");
  });

  it("cada motivo del veredicto aparece en el feedback con su regla y su explicación", async () => {
    const { cronica } = await generarCronica(p42(), { llm: llmGuionado([jugadorFantasma, "ok"]) });
    const fb = cronica.audit[0]!.feedback as string;
    for (const m of cronica.audit[0]!.veredicto) expect(fb).toContain(`${m.regla} (${EXPLICACION[m.regla]}): ${m.detalle}`);
  });
});

describe("omisión precisa [M04, M05]", () => {
  // Dos frases NO obligatorias malas en todos los intentos (semilla 246: presión h15 y disciplina h16).
  const dosMalas: Corruptor = (d) => {
    for (const id of ["h15", "h16"]) {
      const o = d.oraciones[indiceDeId(d, id)]!;
      o.texto_es += " Hubo 99 tiros.";
      o.texto_en += " There were 99 shots.";
    }
    return d;
  };

  it("se omiten EXACTAMENTE las oraciones rechazadas, ni una más, y se cuentan todas", async () => {
    const p = p246();
    const { cronica, hechos } = await generarCronica(p, { llm: llmGuionado([dosMalas]) });
    expect(cronica).toMatchObject({ modo: "llm", intentos: 1 + MAX_REINTENTOS, frasesOmitidas: 2 });
    expect(cronica.oraciones.map((o) => o.hecho)).toEqual(hechos.map((h) => h.id).filter((id) => id !== "h15" && id !== "h16"));
    expect(verificarDraft(cronica, hechos, p)).toEqual([]);
  });
});

describe("acta [M06]", () => {
  it("una oración por hecho, en el orden de relevancia del Analista, cada una con su hecho como principal", () => {
    const hechos = analizar(p246());
    const acta = borradorActa(hechos);
    expect(acta.oraciones.map((o) => o.hecho)).toEqual(hechos.map((h) => h.id));
    expect(acta.oraciones.map((o) => o.texto_es)).toEqual(hechos.map((h) => h.texto_es));
    expect(hechos.map((h) => h.relevancia)).toEqual([...hechos.map((h) => h.relevancia)].sort((a, b) => b - a));
  });

  it("la cadena en modo acta conserva ese orden", async () => {
    const { cronica, hechos } = await generarCronica(p246(), { forzarActa: true });
    expect(cronica.oraciones.map((o) => o.hecho)).toEqual(hechos.map((h) => h.id));
  });
});

describe("prompt [M17]", () => {
  it(`la lista de obligatorios del mensaje inicial es exactamente la de relevancia ≥ ${COBERTURA}`, () => {
    const hechos = analizar(p246());
    const linea = mensajeInicial(hechos)
      .split("\n")
      .find((l) => l.startsWith("Hechos obligatorios"))!;
    const listados = linea.split(": ").pop()!.replace(/\.$/, "").split(", ");
    expect(listados).toEqual(hechos.filter((h) => h.relevancia >= COBERTURA).map((h) => h.id));
  });
});

describe("caché endurecida [M07, M13, M14]", () => {
  it("[M07] la clave incluye la semilla: dos semillas, dos entradas, y cada una se sirve a la suya", async () => {
    const dir = dirTemporal();
    const cache = crearCacheDisco(dir);
    await generarCronica(p42(), { llm: crearLlmStub(), cache });
    await generarCronica(simular(configDeSemilla(43)), { llm: crearLlmStub(), cache });
    expect(readdirSync(dir).sort()).toEqual([nombreArchivo({ seed: 42, deployment: "stub", modo: "neutral" }), nombreArchivo({ seed: 43, deployment: "stub", modo: "neutral" })].sort());
    const llm = llmGuionado(["ok"], "stub");
    const r = await generarCronica(p42(), { llm, cache });
    expect(r.desdeCache).toBe(true);
    expect(llm.llamadas).toHaveLength(0);
  });

  it("[M13] una entrada de otra versión del formato se regenera", async () => {
    const dir = dirTemporal();
    const cache = crearCacheDisco(dir);
    await generarCronica(p42(), { llm: crearLlmStub(), cache });
    const archivo = join(dir, readdirSync(dir)[0] as string);
    const e = JSON.parse(readFileSync(archivo, "utf8"));
    writeFileSync(archivo, JSON.stringify({ ...e, version: VERSION_CACHE - 1 }));
    const llm = llmGuionado(["ok"], "stub");
    const r = await generarCronica(p42(), { llm, cache });
    expect(r.desdeCache).toBe(false);
    expect(llm.llamadas).toHaveLength(1);
    expect(JSON.parse(readFileSync(archivo, "utf8")).version).toBe(VERSION_CACHE);
  });

  it("[M14] una entrada MANIPULADA (esquema válido, mentira dentro) no se sirve: se regenera, sin lanzar", async () => {
    const dir = dirTemporal();
    const cache = crearCacheDisco(dir);
    const p = p42();
    await generarCronica(p, { llm: crearLlmStub(), cache });
    const archivo = join(dir, readdirSync(dir)[0] as string);
    const e = JSON.parse(readFileSync(archivo, "utf8"));
    e.cronica.oraciones[0].texto_es = e.cronica.oraciones[0].texto_es.replace("1–1", "3–1");
    e.cronica.oraciones[0].texto_en = e.cronica.oraciones[0].texto_en.replace("1–1", "3–1");
    writeFileSync(archivo, JSON.stringify(e));
    const llm = llmGuionado(["ok"], "stub");
    const r = await generarCronica(p, { llm, cache });
    expect(r.desdeCache).toBe(false);
    expect(llm.llamadas).toHaveLength(1);
    expect(JSON.stringify(r.cronica)).not.toContain("3–1");
    expect(verificarDraft(r.cronica, r.hechos, p)).toEqual([]);
  });

  it.each([
    ["audit ausente", (c: Record<string, unknown>) => delete c.audit],
    ["audit con n fuera de rango", (c: Record<string, unknown>) => ((c.audit as { n: number }[])[0]!.n = 7)],
    ["motivo con regla inexistente", (c: Record<string, unknown>) => ((c.audit as { veredicto: unknown[] }[])[0]!.veredicto = [{ oracion: 0, regla: "V9", detalle: "x" }])],
    ["oración del contrato viejo", (c: Record<string, unknown>) => ((c.oraciones as unknown[])[0] = { texto_es: "a", texto_en: "a", hechos: ["h01"] })],
    ["modo desconocido", (c: Record<string, unknown>) => (c.modo = "poesia")],
  ])("entrada que no pasa el esquema completo (%s) ⇒ se regenera", async (_, romper) => {
    const dir = dirTemporal();
    const cache = crearCacheDisco(dir);
    await generarCronica(p42(), { llm: crearLlmStub(), cache });
    const archivo = join(dir, readdirSync(dir)[0] as string);
    const e = JSON.parse(readFileSync(archivo, "utf8"));
    romper(e.cronica);
    writeFileSync(archivo, JSON.stringify(e));
    const llm = llmGuionado(["ok"], "stub");
    const r = await generarCronica(p42(), { llm, cache });
    expect(r.desdeCache).toBe(false);
    expect(llm.llamadas).toHaveLength(1);
  });

  it("el temporal de escritura es único: un `.tmp` de nombre fijo bloqueado no impide escribir", async () => {
    const dir = dirTemporal();
    const destino = join(dir, nombreArchivo({ seed: 42, deployment: "stub", modo: "neutral" }));
    mkdirSync(`${destino}.tmp`, { recursive: true }); // un directorio donde iría un .tmp de nombre fijo
    const cache = crearCacheDisco(dir);
    await generarCronica(p42(), { llm: crearLlmStub(), cache });
    expect(JSON.parse(readFileSync(destino, "utf8")).version).toBe(VERSION_CACHE);
    expect(readdirSync(dir).filter((f) => f.endsWith(".tmp") && f !== `${nombreArchivo({ seed: 42, deployment: "stub", modo: "neutral" })}.tmp`)).toEqual([]);
  });

  it("escrituras concurrentes de la misma clave dejan un JSON válido y ningún temporal", async () => {
    const dir = dirTemporal();
    const cache = crearCacheDisco(dir);
    await Promise.all([1, 2, 3, 4].map(() => generarCronica(p42(), { llm: crearLlmStub(), cache })));
    const archivos = readdirSync(dir);
    expect(archivos.filter((f) => f.endsWith(".tmp"))).toEqual([]);
    expect(JSON.parse(readFileSync(join(dir, archivos[0] as string), "utf8")).version).toBe(VERSION_CACHE);
  });
});

describe("sin LLM solo con acta", () => {
  it("generarCronica sin LLM y sin forzarActa ⇒ error claro", async () => {
    await expect(generarCronica(p42(), {})).rejects.toThrow(/falta el LLM/);
  });

  it("subproceso: --modo acta funciona con CRONISTA_LLM=foundry SIN credenciales (se resuelve antes del env)", () => {
    const cli = fileURLToPath(new URL("../cli.ts", import.meta.url));
    const r = spawnSync(process.execPath, ["--import", "tsx", cli, "--seed", "42", "--modo", "acta"], {
      encoding: "utf8",
      timeout: 60_000,
      env: { ...process.env, CRONISTA_LLM: "foundry", FOUNDRY_API_KEY: "", FOUNDRY_BASE_URL: "", FOUNDRY_DEPLOYMENT: "" },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/modo acta · sin LLM \(acta pedida\)/);
    // Un subproceso de tsx tarda ~4–5 s con la suite en paralelo: el límite de la prueba es el
    // mismo que el del spawn (con el de 5 s por defecto se ponía roja por carga, no por fallo).
  }, 60_000);
});
