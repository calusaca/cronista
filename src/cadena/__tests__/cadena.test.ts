// La cadena del 003 con LLMs falsos inyectados por la costura: fixtures (a)–(g),
// omisión, error del LLM, guarda de entrada, e2e con stub 1..50, propiedades del
// `audit` (006) y caché por (seed, deployment, modo).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import { crearLlmStub } from "../../lib/llm-stub";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Evento, Partido } from "../../sim/tipos";
import {
  FANTASMA,
  jsonRoto,
  jugadorFantasma,
  llmGuionado,
  NUMERO_INVENTADO,
  numeroInventado,
  oracionSinCita,
  sinUnGol,
} from "../__fixtures__/llms-falsos";
import { borradorActa } from "../acta";
import { crearCacheDisco, nombreArchivo, VERSION_CACHE } from "../cache";
import { generarCronica, guardaDeEntrada } from "../cadena";
import { parsearArgsCronica } from "../cli-args";
import type { CronicaVerificada, Regla } from "../tipos";
import { MAX_REINTENTOS } from "../umbrales";
import { verificarDraft } from "../verificador";

const p42 = (): Partido => simular(configDeSemilla(42));
const reglasDe = (c: CronicaVerificada, n: number): Regla[] => [...new Set(c.audit[n]?.veredicto.map((m) => m.regla) ?? [])].sort();
const cacheTemporal = () => {
  const dir = mkdtempSync(join(tmpdir(), "cronista-cache-"));
  return { dir, cache: crearCacheDisco(dir) };
};

/** Propiedades del 006 que todo `audit` debe cumplir. */
function auditValido(c: CronicaVerificada): string[] {
  const err: string[] = [];
  if (!Array.isArray(c.audit)) return ["audit ausente"];
  c.audit.forEach((a, i) => {
    if (a.n !== i + 1) err.push(`n no consecutivo en ${i}`);
    if (a.veredicto.length === 0 && i !== c.audit.length - 1) err.push(`intento ${a.n} aprobado pero no es el último`);
    for (const m of a.veredicto) {
      if (!m.regla || typeof m.oracion !== "number" || !m.detalle) err.push(`motivo incompleto en intento ${a.n}`);
    }
    if (a.veredicto.length > 0 && i < c.audit.length - 1 && !a.feedback) err.push(`intento ${a.n} rechazado sin feedback`);
  });
  if (c.modo === "llm" && c.intentos !== c.audit.length) err.push("intentos ≠ audit.length");
  return err;
}

describe("fixtures (a)–(g) con LLMs falsos", () => {
  it("(a) salida perfecta ⇒ aprobada a la primera", async () => {
    const llm = llmGuionado(["ok"]);
    const { cronica } = await generarCronica(p42(), { llm });
    expect(cronica).toMatchObject({ modo: "llm", intentos: 1, frasesOmitidas: 0 });
    expect(cronica.audit).toHaveLength(1);
    expect(cronica.audit[0]?.veredicto).toEqual([]);
    expect(llm.llamadas).toHaveLength(1);
  });

  it("(b) número inventado ⇒ V3, feedback y reintento aprobado", async () => {
    const llm = llmGuionado([numeroInventado(), "ok"]);
    const { cronica } = await generarCronica(p42(), { llm });
    expect(cronica).toMatchObject({ modo: "llm", intentos: 2, frasesOmitidas: 0 });
    expect(reglasDe(cronica, 0)).toEqual(["V3"]);
    expect(cronica.audit[0]?.veredicto[0]?.detalle).toContain(String(NUMERO_INVENTADO));
    // El feedback llegó al Cronista en la segunda llamada, con la regla.
    const segunda = llm.llamadas[1]!;
    expect(segunda.map((m) => m.rol)).toEqual(["user", "assistant", "user"]);
    expect(segunda[2]?.contenido).toContain("V3");
    expect(segunda[2]?.contenido).toBe(cronica.audit[0]?.feedback);
    // Nada sin verificar: la crónica final no contiene el número inventado.
    expect(JSON.stringify(cronica.oraciones)).not.toContain(String(NUMERO_INVENTADO));
  });

  it("(c) jugador fantasma ⇒ V4", async () => {
    const { cronica } = await generarCronica(p42(), { llm: llmGuionado([jugadorFantasma, "ok"]) });
    expect(reglasDe(cronica, 0)).toEqual(["V4"]);
    expect(cronica.intentos).toBe(2);
    expect(JSON.stringify(cronica.oraciones)).not.toContain(FANTASMA);
  });

  it("(d) oración sin cita ⇒ V2 (y, por no citar nada, sus cifras y nombres tampoco tienen respaldo)", async () => {
    const { cronica } = await generarCronica(p42(), { llm: llmGuionado([oracionSinCita, "ok"]) });
    expect(reglasDe(cronica, 0)).toContain("V2");
    // Todos los motivos son de esa misma oración: el rechazo no se derrama a otras.
    expect(new Set(cronica.audit[0]?.veredicto.map((m) => m.oracion)).size).toBe(1);
    expect(cronica.intentos).toBe(2);
  });

  it("(e) cobertura incompleta ⇒ V5", async () => {
    const { cronica } = await generarCronica(p42(), { llm: llmGuionado([sinUnGol, "ok"]) });
    expect(reglasDe(cronica, 0)).toEqual(["V5"]);
    expect(cronica.intentos).toBe(2);
  });

  it("(f) JSON roto ⇒ V1, el crudo queda en el audit", async () => {
    const { cronica } = await generarCronica(p42(), { llm: llmGuionado([jsonRoto, "ok"]) });
    expect(reglasDe(cronica, 0)).toEqual(["V1"]);
    expect(cronica.audit[0]?.crudo).toBeDefined();
    expect(cronica.audit[0]?.borrador.oraciones).toEqual([]);
    expect(cronica.intentos).toBe(2);
  });

  it(`(g) malicioso persistente sobre un hecho obligatorio ⇒ ${1 + MAX_REINTENTOS} intentos y MODO ACTA válido`, async () => {
    const p = p42();
    const llm = llmGuionado([numeroInventado("resultado_final")]);
    const { cronica, hechos } = await generarCronica(p, { llm });
    expect(cronica.modo).toBe("acta");
    expect(cronica.intentos).toBe(1 + MAX_REINTENTOS);
    expect(llm.llamadas).toHaveLength(1 + MAX_REINTENTOS);
    expect(cronica.audit.every((a) => a.veredicto.some((m) => m.regla === "V3"))).toBe(true);
    // El acta es exactamente la de las plantillas y pasa el Verificador.
    expect({ titulo_es: cronica.titulo_es, titulo_en: cronica.titulo_en, oraciones: cronica.oraciones }).toEqual(borradorActa(hechos));
    expect(verificarDraft(cronica, hechos, p)).toEqual([]);
  });
});

describe("tras agotar reintentos: omisión antes que acta", () => {
  it("malicioso persistente sobre un hecho NO obligatorio ⇒ se omite esa oración y sigue en modo llm", async () => {
    const p = p42();
    const { cronica, hechos } = await generarCronica(p, { llm: llmGuionado([numeroInventado("gol_temprano")]) });
    expect(cronica).toMatchObject({ modo: "llm", intentos: 1 + MAX_REINTENTOS, frasesOmitidas: 1 });
    const idTemprano = hechos.find((h) => h.tipo === "gol_temprano")?.id as string;
    expect(cronica.oraciones.some((o) => o.hecho === idTemprano)).toBe(false);
    expect(verificarDraft(cronica, hechos, p)).toEqual([]);
  });

  it("título malicioso persistente ⇒ se reemplaza por el del acta (el resto sigue en modo llm)", async () => {
    const titulo = (d: Parameters<typeof jsonRoto>[0]) => ({ ...d, titulo_es: `${d.titulo_es} (37)`, titulo_en: `${d.titulo_en} (37)` });
    const p = p42();
    const { cronica, hechos } = await generarCronica(p, { llm: llmGuionado([titulo]) });
    expect(cronica.modo).toBe("llm");
    expect(cronica.titulo_es).toBe(hechos.find((h) => h.tipo === "resultado_final")?.texto_es);
    expect(cronica.frasesOmitidas).toBe(0);
  });

  it("JSON roto persistente ⇒ acta", async () => {
    const { cronica } = await generarCronica(p42(), { llm: llmGuionado([jsonRoto]) });
    expect(cronica.modo).toBe("acta");
    expect(cronica.intentos).toBe(1 + MAX_REINTENTOS);
  });
});

describe("errores del LLM", () => {
  it("una caída del LLM cuenta como intento fallido (V1) y se reintenta sin turno vacío", async () => {
    const llm = llmGuionado([new Error("timeout de red"), "ok"]);
    const { cronica } = await generarCronica(p42(), { llm });
    expect(cronica).toMatchObject({ modo: "llm", intentos: 2 });
    expect(cronica.audit[0]?.veredicto[0]?.detalle).toContain("timeout de red");
    // Mismo diálogo en el reintento: no se agregó un mensaje vacío del asistente.
    expect(llm.llamadas[1]?.map((m) => m.rol)).toEqual(["user"]);
  });

  it("el LLM caído siempre ⇒ acta, nunca lanza", async () => {
    const { cronica } = await generarCronica(p42(), { llm: llmGuionado([new Error("sin cuota")]) });
    expect(cronica.modo).toBe("acta");
  });
});

describe("guarda de entrada", () => {
  it("un Partido que viola el contrato del 001 ⇒ falla fuerte ANTES de analizar", async () => {
    const p = p42();
    const gol = p.eventos.find((e) => e.tipo === "gol") as Evento;
    delete gol.relacionadoCon;
    expect(() => guardaDeEntrada(p)).toThrow(/guarda de entrada/);
    await expect(generarCronica(p, { llm: llmGuionado(["ok"]) })).rejects.toThrow(/guarda de entrada/);
  });

  it("una config inválida (fuerza fuera de rango) ⇒ falla fuerte", () => {
    const p = p42();
    p.config.local.ataque = 500;
    expect(() => guardaDeEntrada(p)).toThrow(/ataque/);
  });
});

describe("e2e con stub, semillas 1..50", () => {
  it("siempre produce una CronicaVerificada válida, nunca lanza; con el stub, aprobada a la primera", async () => {
    const llm = crearLlmStub();
    const fallas: string[] = [];
    for (let s = 1; s <= 50; s++) {
      const p = simular(configDeSemilla(s));
      try {
        const { cronica, hechos } = await generarCronica(p, { llm });
        if (cronica.modo !== "llm" || cronica.intentos !== 1) fallas.push(`seed ${s}: ${cronica.modo}/${cronica.intentos}`);
        for (const m of verificarDraft(cronica, hechos, p)) fallas.push(`seed ${s}: ${m.regla} ${m.detalle}`);
        for (const e of auditValido(cronica)) fallas.push(`seed ${s}: ${e}`);
      } catch (e) {
        fallas.push(`seed ${s}: lanzó ${(e as Error).message}`);
      }
    }
    expect(fallas).toEqual([]);
  });

  it("misma semilla ⇒ misma crónica byte a byte", async () => {
    const a = await generarCronica(p42(), { llm: crearLlmStub() });
    const b = await generarCronica(p42(), { llm: crearLlmStub() });
    expect(JSON.stringify(a.cronica)).toBe(JSON.stringify(b.cronica));
  });
});

describe("006 — el audit (la historia de la corrida)", () => {
  it.each([
    ["(a) perfecta", ["ok"] as const],
    ["(b) reintento", [numeroInventado(), "ok"] as const],
    ["(g) acta", [numeroInventado("resultado_final")] as const],
  ])("%s: audit presente, n consecutivos, el aprobado es el último, rechazos con regla y oración", async (_, guion) => {
    const { cronica } = await generarCronica(p42(), { llm: llmGuionado([...guion]) });
    expect(auditValido(cronica)).toEqual([]);
    expect(cronica.audit.length).toBeGreaterThan(0);
  });

  it("acta pedida directamente: sin llamadas al LLM, audit vacío pero presente, intentos 0", async () => {
    const llm = llmGuionado(["ok"]);
    const { cronica } = await generarCronica(p42(), { llm, forzarActa: true });
    expect(cronica).toMatchObject({ modo: "acta", intentos: 0, audit: [] });
    expect(llm.llamadas).toHaveLength(0);
  });
});

describe("caché por (seed, deployment, modo)", () => {
  it("la segunda corrida sale de la caché con cero llamadas y el MISMO audit byte a byte", async () => {
    const { cache } = cacheTemporal();
    const llm1 = llmGuionado([numeroInventado(), "ok"], "falso-a");
    const r1 = await generarCronica(p42(), { llm: llm1, cache });
    const llm2 = llmGuionado(["ok"], "falso-a");
    const r2 = await generarCronica(p42(), { llm: llm2, cache });
    expect(r2.desdeCache).toBe(true);
    expect(llm2.llamadas).toHaveLength(0);
    expect(JSON.stringify(r2.cronica)).toBe(JSON.stringify(r1.cronica));
    expect(r2.cronica.audit[0]?.veredicto[0]?.regla).toBe("V3"); // la historia real se preserva
  });

  it("otro deployment ⇒ otra entrada (la clave incluye deployment y modo)", async () => {
    const { dir, cache } = cacheTemporal();
    await generarCronica(p42(), { llm: llmGuionado(["ok"], "falso-a"), cache });
    const llmB = llmGuionado(["ok"], "falso-b");
    const r = await generarCronica(p42(), { llm: llmB, cache });
    expect(r.desdeCache).toBe(false);
    expect(llmB.llamadas).toHaveLength(1);
    expect(readdirSync(dir).sort()).toEqual(
      [nombreArchivo({ seed: 42, deployment: "falso-a", modo: "neutral" }), nombreArchivo({ seed: 42, deployment: "falso-b", modo: "neutral" })].sort(),
    );
  });

  it("si los hechos cambian (otro partido con la misma semilla), la entrada vieja se ignora", async () => {
    const { cache } = cacheTemporal();
    await generarCronica(p42(), { llm: llmGuionado(["ok"]), cache });
    const otro = simular({ ...configDeSemilla(43), seed: 42 }); // mismo seed, otros equipos ⇒ otros hechos
    const llm = llmGuionado(["ok"]);
    const r = await generarCronica(otro, { llm, cache });
    expect(r.desdeCache).toBe(false);
    expect(llm.llamadas).toHaveLength(1);
    expect(r.hechos).not.toEqual(analizar(p42()));
  });

  it("una corrida con error del LLM NO se cachea (no es la historia de una corrida real)", async () => {
    const { dir, cache } = cacheTemporal();
    await generarCronica(p42(), { llm: llmGuionado([new Error("red"), "ok"]), cache });
    expect(readdirSync(dir)).toEqual([]);
  });

  it("el acta pedida a mano no se cachea", async () => {
    const { dir, cache } = cacheTemporal();
    await generarCronica(p42(), { llm: llmGuionado(["ok"]), cache, forzarActa: true });
    expect(readdirSync(dir)).toEqual([]);
  });

  it("una entrada corrupta se ignora y se regenera", async () => {
    const { dir, cache } = cacheTemporal();
    await generarCronica(p42(), { llm: llmGuionado(["ok"]), cache });
    const archivo = join(dir, readdirSync(dir)[0] as string);
    const { writeFileSync } = await import("node:fs");
    writeFileSync(archivo, "{ esto no es json");
    const llm = llmGuionado(["ok"]);
    const r = await generarCronica(p42(), { llm, cache });
    expect(r.desdeCache).toBe(false);
    expect(JSON.parse(readFileSync(archivo, "utf8")).version).toBe(VERSION_CACHE);
  });
});

describe("CLI de la crónica", () => {
  it.each([
    [["--seed"], "sin valor"],
    [["--seed", "0x2A"], "hex"],
    [["--modo"], "modo sin valor"],
    [["--modo", "poesia"], "modo desconocido"],
    [["--modo", "acta", "--modo", "llm"], "modo repetido"],
    [["--rapido"], "flag desconocido"],
    [["42"], "posicional"],
    [["--perspectiva", "rival"], "perspectiva desconocida"],
    [["--perspectiva"], "perspectiva sin valor"],
  ] as [string[], string][])("rechaza %j (%s)", (args) => {
    expect(parsearArgsCronica(args).ok).toBe(false);
  });

  it("acepta --perspectiva local|visita (brief 007)", () => {
    const r = parsearArgsCronica(["--seed", "7", "--perspectiva", "visita"]);
    expect(r.ok && r.opciones.perspectiva).toBe("visita");
  });

  it("acepta --seed, --modo acta, --json y --sin-cache", () => {
    expect(parsearArgsCronica(["--seed", "7", "--modo", "acta", "--json", "--sin-cache"])).toEqual({
      ok: true,
      opciones: { seed: 7, modo: "acta", json: true, sinCache: true, perspectiva: "neutral" },
    });
  });

  const cli = fileURLToPath(new URL("../cli.ts", import.meta.url));
  const correr = (args: string[]) =>
    spawnSync(process.execPath, ["--import", "tsx", cli, ...args], {
      encoding: "utf8",
      timeout: 60_000,
      env: { ...process.env, CRONISTA_LLM: "stub" },
    });

  it("subproceso: argumento inválido ⇒ exit 1 con mensaje", () => {
    const r = correr(["--modo", "poesia"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/--modo debe ser llm o acta/);
  });

  it("subproceso: --seed 42 --sin-cache con stub ⇒ exit 0, crónica con citas", () => {
    const r = correr(["--seed", "42", "--sin-cache"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/modo llm · LLM stub · intentos 1/);
    expect(r.stdout).toMatch(/↳ h01/);
  });

  it("subproceso: CRONISTA_LLM=foundry sin config ⇒ exit 1 nombrando la variable que falta", () => {
    const r = spawnSync(process.execPath, ["--import", "tsx", cli, "--seed", "1", "--sin-cache"], {
      encoding: "utf8",
      timeout: 60_000,
      env: { ...process.env, CRONISTA_LLM: "foundry", FOUNDRY_API_KEY: "", FOUNDRY_BASE_URL: "", FOUNDRY_DEPLOYMENT: "" },
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/FOUNDRY_API_KEY/);
  });
});
