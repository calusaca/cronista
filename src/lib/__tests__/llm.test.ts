// La costura LLM (brief 003): fábrica por env, stub determinista y la implementación
// de Foundry probada OFFLINE con un `fetch` inyectado (no hay cuenta de Azure todavía):
// se verifica la petición que saldría — URL, cabeceras, modelo = deployment, thinking
// adaptive y SIN temperature/top_k (Foundry los rechaza).
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import { mensajeInicial, SYSTEM_PROMPT } from "../../cadena/prompt";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import { conPresupuesto, crearLlmDesdeEnv, type Llm, type Mensaje } from "../llm";
import { API_VERSION_FOUNDRY, crearLlmFoundry } from "../llm-foundry";
import { borradorDesdeHechos, crearLlmStub } from "../llm-stub";

const ENV_FOUNDRY = {
  CRONISTA_LLM: "foundry",
  FOUNDRY_API_KEY: "clave-de-prueba",
  FOUNDRY_BASE_URL: "https://recurso-prueba.services.ai.azure.com/anthropic",
  FOUNDRY_DEPLOYMENT: "claude-sonnet-5",
};

describe("fábrica por CRONISTA_LLM", () => {
  it("sin variable ⇒ stub (offline, $0)", () => {
    expect(crearLlmDesdeEnv({}).id).toBe("stub");
    expect(crearLlmDesdeEnv({ CRONISTA_LLM: "stub" }).id).toBe("stub");
  });

  it("foundry con su config ⇒ id con el deployment (entra en la clave de caché)", () => {
    expect(crearLlmDesdeEnv(ENV_FOUNDRY).id).toBe("foundry:claude-sonnet-5");
  });

  it.each(["FOUNDRY_API_KEY", "FOUNDRY_BASE_URL", "FOUNDRY_DEPLOYMENT"])("foundry sin %s ⇒ error claro que nombra la variable", (falta) => {
    const env: Record<string, string | undefined> = { ...ENV_FOUNDRY, [falta]: undefined };
    expect(() => crearLlmDesdeEnv(env)).toThrow(new RegExp(falta));
  });

  it("un valor desconocido ⇒ error que lista los válidos", () => {
    expect(() => crearLlmDesdeEnv({ CRONISTA_LLM: "openai" })).toThrow(/stub, foundry/);
  });
});

describe("stub determinista", () => {
  const p = simular(configDeSemilla(42));
  const hechos = analizar(p);
  const mensajes: Mensaje[] = [{ rol: "user", contenido: mensajeInicial(hechos) }];

  it("construye desde las plantillas: una oración por hecho, que lo narra como principal; título = resultado final", async () => {
    const d = JSON.parse(await crearLlmStub().completar(SYSTEM_PROMPT, mensajes)) as ReturnType<typeof borradorDesdeHechos>;
    expect(d.oraciones.map((o) => o.hecho)).toEqual(hechos.map((h) => h.id));
    expect(d.oraciones.map((o) => o.texto_es)).toEqual(hechos.map((h) => h.texto_es));
    expect(d.titulo_es).toBe(hechos.find((h) => h.tipo === "resultado_final")?.texto_es);
  });

  it("misma entrada ⇒ misma salida byte a byte, también con feedback en la conversación", async () => {
    const a = await crearLlmStub().completar(SYSTEM_PROMPT, mensajes);
    const b = await crearLlmStub().completar(SYSTEM_PROMPT, [...mensajes, { rol: "assistant", contenido: "x" }, { rol: "user", contenido: "feedback" }]);
    expect(b).toBe(a);
  });
});

describe("Foundry (offline, fetch inyectado)", () => {
  function fetchFalso(respuestaTexto: string) {
    const llamadas: { url: string; init: RequestInit }[] = [];
    const f = (async (url: string | URL | Request, init?: RequestInit) => {
      llamadas.push({ url: String(url), init: init ?? {} });
      const cuerpo = {
        id: "msg_prueba",
        type: "message",
        role: "assistant",
        model: "claude-sonnet-5",
        content: [
          { type: "thinking", thinking: "pensando…", signature: "x" },
          { type: "text", text: respuestaTexto },
        ],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 20 },
      };
      return new Response(JSON.stringify(cuerpo), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    return { f, llamadas };
  }

  it("la petición: URL /anthropic/v1/messages, x-api-key, anthropic-version, modelo = deployment, thinking adaptive, SIN temperature/top_k", async () => {
    const { f, llamadas } = fetchFalso('{"ok":true}');
    const llm = crearLlmFoundry({ ...cfgDe(ENV_FOUNDRY), fetch: f, maxRetries: 0 });
    const salida = await llm.completar("sistema", [
      { rol: "user", contenido: "hola" },
      { rol: "assistant", contenido: "respuesta" },
      { rol: "user", contenido: "feedback" },
    ]);
    expect(salida).toBe('{"ok":true}'); // solo los bloques de texto, no el pensamiento
    expect(llamadas).toHaveLength(1);
    const { url, init } = llamadas[0] as { url: string; init: RequestInit };
    expect(url).toBe("https://recurso-prueba.services.ai.azure.com/anthropic/v1/messages");
    const cabeceras = new Headers(init.headers);
    expect(cabeceras.get("x-api-key")).toBe("clave-de-prueba");
    expect(cabeceras.get("anthropic-version")).toBe(API_VERSION_FOUNDRY);
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.model).toBe("claude-sonnet-5");
    expect(body.system).toBe("sistema");
    expect(body.thinking).toEqual({ type: "adaptive" });
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("top_k");
    expect(body.messages).toEqual([
      { role: "user", content: "hola" },
      { role: "assistant", content: "respuesta" },
      { role: "user", content: "feedback" },
    ]);
  });

  it("un error HTTP se propaga (la cadena lo registra como intento fallido)", async () => {
    const f = (async () => new Response(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "no" } }), { status: 400 })) as typeof fetch;
    const llm = crearLlmFoundry({ ...cfgDe(ENV_FOUNDRY), fetch: f, maxRetries: 0 });
    await expect(llm.completar("s", [{ rol: "user", contenido: "x" }])).rejects.toThrow();
  });
});

describe("conPresupuesto (brief 045 v3.1): presupuesto de llamadas compartido", () => {
  it("N llamadas pasan, la N+1 lanza sin tocar el modelo; id y uso delegan", async () => {
    const n = 3, uso = { llamadas: 7, respuestasConUso: 1, entrada: 2, salida: 3, cache: 0 };
    let llamadas = 0;
    const base: Llm = { id: "stub-presupuesto", uso: () => uso, completar: async (_s, m) => { llamadas++; return m[0]!.contenido; } };
    const envuelto = conPresupuesto(base, n);
    expect(envuelto.id).toBe(base.id);
    for (let k = 0; k < n; k++) expect(await envuelto.completar("s", [{ rol: "user", contenido: `p${k}` }])).toBe(`p${k}`);
    await expect(envuelto.completar("s", [{ rol: "user", contenido: "otra" }])).rejects.toThrow("Presupuesto de llamadas agotado");
    expect(llamadas).toBe(n);
    expect(envuelto.uso?.()).toBe(uso);
    expect(conPresupuesto({ id: "sin-uso", completar: async () => "" }, n).uso).toBeUndefined();
  });

  it("también cuentan las llamadas que fallan o agotan su plazo", async () => {
    let llamadas = 0;
    const envuelto = conPresupuesto({ id: "falla", completar: async () => { llamadas++; throw new Error("plazo agotado"); } }, 2);
    await expect(envuelto.completar("s", [])).rejects.toThrow("plazo agotado");
    await expect(envuelto.completar("s", [])).rejects.toThrow("plazo agotado");
    await expect(envuelto.completar("s", [])).rejects.toThrow("Presupuesto de llamadas agotado");
    expect(llamadas).toBe(2);
  });
});

function cfgDe(env: Record<string, string>) {
  return { apiKey: env.FOUNDRY_API_KEY as string, baseURL: env.FOUNDRY_BASE_URL as string, deployment: env.FOUNDRY_DEPLOYMENT as string };
}
