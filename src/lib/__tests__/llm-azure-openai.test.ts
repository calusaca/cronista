// Brief 023 — el backend Azure OpenAI, probado OFFLINE con `fetch` inyectado (el patrón de
// Foundry): la petición exacta (URL con deployment y api-version, cabecera api-key, temperatura
// explícita, json_object), la respuesta feliz validada por zod, y cada falla (malformada, 401, 429,
// 500, truncada) que la cadena convierte en acta con su motivo. Y la caché distingue el deployment.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import { crearCacheDisco } from "../../cadena/cache";
import { generarCronica } from "../../cadena/cadena";
import { mensajeInicial } from "../../cadena/prompt";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import { crearLlmDesdeEnv } from "../llm";
import { API_VERSION_AZURE_OPENAI, crearLlmAzureOpenAI, MAX_TOKENS_AZURE_OPENAI, MAX_TOKENS_RAZONAMIENTO_AZURE_OPENAI, TEMPERATURA_AZURE_OPENAI, urlAzureOpenAI } from "../llm-azure-openai";
import { borradorDesdeHechos } from "../llm-stub";

const ENV = {
  CRONISTA_LLM: "azure-openai",
  AZURE_OPENAI_ENDPOINT: "https://recurso-prueba.openai.azure.com/",
  AZURE_OPENAI_API_KEY: "clave-de-prueba",
  AZURE_OPENAI_DEPLOYMENT: "gpt-6.1-sol",
};
const partido = simular(configDeSemilla(42));
const hechos = analizar(partido);
const cronicaStub = JSON.stringify(borradorDesdeHechos(mensajeInicial(hechos)));

interface Llamada {
  url: string;
  init: RequestInit;
}
function fetchFalso(responder: () => Response) {
  const llamadas: Llamada[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    llamadas.push({ url: String(url), init: init ?? {} });
    return responder();
  }) as typeof fetch;
  return { f, llamadas };
}
const okCon = (content: unknown, finish = "stop") => () =>
  new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content }, finish_reason: finish }], usage: { prompt_tokens: 10, completion_tokens: 20 } }), { status: 200, headers: { "content-type": "application/json" } });
const cfg = (f: typeof fetch, extra: Record<string, string> = {}) => ({ apiKey: ENV.AZURE_OPENAI_API_KEY, endpoint: ENV.AZURE_OPENAI_ENDPOINT, deployment: ENV.AZURE_OPENAI_DEPLOYMENT, fetch: f, ...extra });

describe("023 · fábrica por CRONISTA_LLM=azure-openai", () => {
  it("con su config ⇒ id con el deployment (entra en la clave de caché)", () => {
    expect(crearLlmDesdeEnv(ENV).id).toBe("azure-openai:gpt-6.1-sol");
  });
  it.each(["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_DEPLOYMENT"])("sin %s ⇒ error claro que nombra la variable y el backend", (falta) => {
    expect(() => crearLlmDesdeEnv({ ...ENV, [falta]: "" })).toThrow(new RegExp(`CRONISTA_LLM=azure-openai necesita la variable ${falta}`));
  });
  it("api-version: la de AZURE_OPENAI_API_VERSION si viene; si no (o vacía), el default documentado", () => {
    expect(urlAzureOpenAI({ endpoint: "https://x.openai.azure.com", deployment: "d" })).toContain(`api-version=${API_VERSION_AZURE_OPENAI}`);
    expect(urlAzureOpenAI({ endpoint: "https://x.openai.azure.com", deployment: "d", apiVersion: "2099-01-01-preview" })).toContain("api-version=2099-01-01-preview");
  });
  it("esfuerzo inválido ⇒ error de configuración antes de llamar al servicio", () => {
    expect(() => crearLlmDesdeEnv({ ...ENV, AZURE_OPENAI_REASONING_EFFORT: "none" })).toThrow(/AZURE_OPENAI_REASONING_EFFORT/);
  });
});

describe("023 · la petición y la respuesta (fetch inyectado)", () => {
  it("POST a /openai/deployments/{deployment}/chat/completions?api-version=…, cabecera api-key, system primero, temperatura explícita y json_object", async () => {
    const { f, llamadas } = fetchFalso(okCon('{"ok":true}'));
    const salida = await crearLlmAzureOpenAI(cfg(f)).completar("sistema", [
      { rol: "user", contenido: "hola" },
      { rol: "assistant", contenido: "respuesta" },
      { rol: "user", contenido: "feedback" },
    ]);
    expect(salida).toBe('{"ok":true}');
    expect(llamadas).toHaveLength(1);
    const { url, init } = llamadas[0] as Llamada;
    expect(url).toBe(`https://recurso-prueba.openai.azure.com/openai/deployments/gpt-6.1-sol/chat/completions?api-version=${API_VERSION_AZURE_OPENAI}`);
    expect(init.method).toBe("POST");
    const h = new Headers(init.headers);
    expect(h.get("api-key")).toBe("clave-de-prueba");
    expect(h.get("content-type")).toBe("application/json");
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.messages).toEqual([
      { role: "system", content: "sistema" },
      { role: "user", content: "hola" },
      { role: "assistant", content: "respuesta" },
      { role: "user", content: "feedback" },
    ]);
    expect(body.temperature).toBe(TEMPERATURA_AZURE_OPENAI);
    expect(body.max_completion_tokens).toBe(MAX_TOKENS_AZURE_OPENAI);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("api-version de env llega a la URL (nunca otra hardcodeada)", async () => {
    const { f, llamadas } = fetchFalso(okCon("{}"));
    await crearLlmAzureOpenAI(cfg(f, { apiVersion: "2099-01-01-preview" })).completar("s", [{ rol: "user", contenido: "x" }]);
    expect((llamadas[0] as Llamada).url).toMatch(/\?api-version=2099-01-01-preview$/);
  });

  it("GPT-6.1 Sol con deployment de nombre libre: esfuerzo de env, sin temperature y con presupuesto para razonar", async () => {
    const { f, llamadas } = fetchFalso(okCon(cronicaStub));
    const llm = crearLlmDesdeEnv({ ...ENV, AZURE_OPENAI_DEPLOYMENT: "cronista", AZURE_OPENAI_REASONING_EFFORT: " low " });
    // La fábrica valida y conserva el esfuerzo; el transporte se inyecta en la misma config.
    expect(llm.id).toBe("azure-openai:cronista:reasoning-low");
    const modelo = crearLlmAzureOpenAI({ ...cfg(f), deployment: "cronista", reasoningEffort: "low" });
    expect(modelo.id).toBe(llm.id);
    const { cronica } = await generarCronica(partido, { llm: modelo });
    expect(cronica.modo).toBe("llm");
    expect(cronica.intentos).toBe(1);
    const body = JSON.parse(String(llamadas[0]?.init.body));
    expect(body.reasoning_effort).toBe("low");
    expect(body).not.toHaveProperty("temperature");
    expect(body.max_completion_tokens).toBe(MAX_TOKENS_RAZONAMIENTO_AZURE_OPENAI);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it.each([
    ["sin choices", { usage: {} }],
    ["choices vacío", { choices: [] }],
    ["content numérico", { choices: [{ message: { content: 7 }, finish_reason: "stop" }] }],
  ])("respuesta malformada (%s) ⇒ lanza «malformada» (zod)", async (_n, cuerpo) => {
    const { f } = fetchFalso(() => new Response(JSON.stringify(cuerpo), { status: 200 }));
    await expect(crearLlmAzureOpenAI(cfg(f)).completar("s", [{ rol: "user", contenido: "x" }])).rejects.toThrow(/malformada/);
  });
});

describe("023 · las fallas llegan a la cadena como acta con su motivo", () => {
  const casos: [string, () => Response, RegExp][] = [
    ["401", () => new Response('{"error":{"code":"401"}}', { status: 401 }), /401 \(clave rechazada\)/],
    ["429", () => new Response('{"error":{"code":"429"}}', { status: 429 }), /429 \(cuota o límite de tasa\)/],
    ["500", () => new Response("boom", { status: 500 }), /500 \(error del servicio\)/],
    ["truncada", okCon('{"titulo_es":"…', "length"), /truncada/],
    ["malformada", () => new Response(JSON.stringify({ choices: [{ message: {} }] }), { status: 200 }), /malformada/],
  ];
  for (const [nombre, responder, motivo] of casos) {
    it(`${nombre} ⇒ cada intento es un V1 con el motivo, y la crónica sale en modo acta`, async () => {
      const { f, llamadas } = fetchFalso(responder);
      const { cronica } = await generarCronica(partido, { llm: crearLlmAzureOpenAI(cfg(f)) });
      expect(cronica.modo).toBe("acta");
      expect(llamadas.length).toBe(cronica.intentos);
      for (const a of cronica.audit) expect(a.veredicto.some((m) => m.regla === "V1" && motivo.test(m.detalle))).toBe(true);
    });
  }

  it("respuesta feliz ⇒ la cadena publica la crónica del modelo (modo llm, un intento)", async () => {
    const { f } = fetchFalso(okCon(cronicaStub));
    const { cronica } = await generarCronica(partido, { llm: crearLlmAzureOpenAI(cfg(f)) });
    expect([cronica.modo, cronica.intentos]).toEqual(["llm", 1]);
  });
});

describe("023 · la caché distingue el deployment (y el backend)", () => {
  const dir = mkdtempSync(join(tmpdir(), "cronista-azure-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  it("una crónica de azure-openai:A se sirve a A; a azure-openai:B y a stub NO (se regeneran)", async () => {
    const cache = crearCacheDisco(dir);
    const a = fetchFalso(okCon(cronicaStub));
    expect((await generarCronica(partido, { llm: crearLlmAzureOpenAI(cfg(a.f)), cache })).desdeCache).toBe(false);
    expect((await generarCronica(partido, { llm: crearLlmAzureOpenAI(cfg(a.f)), cache })).desdeCache).toBe(true);
    expect(a.llamadas).toHaveLength(1);
    const razonamiento = fetchFalso(okCon(cronicaStub));
    const conRazonamiento = await generarCronica(partido, { llm: crearLlmAzureOpenAI({ ...cfg(razonamiento.f), reasoningEffort: "low" }), cache });
    expect([conRazonamiento.desdeCache, razonamiento.llamadas.length]).toEqual([false, 1]);
    const otroEsfuerzo = fetchFalso(okCon(cronicaStub));
    const conOtroEsfuerzo = await generarCronica(partido, { llm: crearLlmAzureOpenAI({ ...cfg(otroEsfuerzo.f), reasoningEffort: "medium" }), cache });
    expect([conOtroEsfuerzo.desdeCache, otroEsfuerzo.llamadas.length]).toEqual([false, 1]);
    const b = fetchFalso(okCon(cronicaStub));
    const otro = await generarCronica(partido, { llm: crearLlmAzureOpenAI({ ...cfg(b.f), deployment: "gpt-otro" }), cache });
    expect([otro.desdeCache, b.llamadas.length]).toEqual([false, 1]);
    const { crearLlmStub } = await import("../llm-stub");
    expect((await generarCronica(partido, { llm: crearLlmStub(), cache })).desdeCache).toBe(false);
  });
});
