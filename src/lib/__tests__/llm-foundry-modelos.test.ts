// Brief 052 (v1.0 + v1.1) — adaptador Foundry Models probado OFFLINE con `fetch` inyectado:
// petición exacta, formatos JSON, gramática cerrada de razonamiento, extracción en modo texto,
// consumo, errores con clave redactada, fábrica, catálogo sin inferencia y, con el adaptador
// REAL, el reintento del controlador (la segunda petición nunca lleva razonamiento).
import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogoModelos } from "../../arena/modelos";
import { crearControladorLlm, planProgramado } from "../../arena/controladores";
import { observarArena } from "../../arena/coordinador";
import { crearConfigArena, MotorArena } from "../../arena/motor";
import { CLAVES_LLM_POR_PREFIJO, crearLlmDesdeEnv, crearLlmEquipoDesdeEnv, TIPOS_LLM } from "../llm";
import {
  API_VERSION_FOUNDRY_MODELOS, crearLlmFoundryModelos, extraerObjetoJson, FORMATOS_JSON_FOUNDRY_MODELOS, limpiarRespuestaModelo,
  MAX_TOKENS_FOUNDRY_MODELOS, MAX_TOKENS_TOPE_FOUNDRY_MODELOS, salidaFacturable, urlFoundryModelos, type FormatoJsonFoundryModelos,
} from "../llm-foundry-modelos";

const CLAVE = "clave-centinela-052-NO-PUBLICAR";
const ENDPOINT = "https://recurso-prueba.services.ai.azure.com/";
const ENV = { CRONISTA_LLM: "foundry-modelos", FOUNDRY_MODELOS_API_KEY: CLAVE, FOUNDRY_MODELOS_ENDPOINT: ENDPOINT, FOUNDRY_MODELOS_DEPLOYMENT: "cronista-deepseek" };

interface Llamada { url: string; init: RequestInit; cuerpo: Record<string, unknown> }
type Respuesta = () => Response;
/** Transporte falso que responde en secuencia (la última se repite) y captura cada petición. */
function transporte(...respuestas: Respuesta[]) {
  const llamadas: Llamada[] = [];
  const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    llamadas.push({ url: String(url), init: init ?? {}, cuerpo: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown> });
    return (respuestas[Math.min(llamadas.length - 1, respuestas.length - 1)] as Respuesta)();
  }) as unknown as typeof fetch;
  return { f, llamadas };
}
const USO = { prompt_tokens: 100, completion_tokens: 40, prompt_tokens_details: { cached_tokens: 10 }, completion_tokens_details: { reasoning_tokens: 30 } };
const respuesta = (content: string | null, extra: { finish?: string | null; usage?: unknown; reasoning_content?: string } = {}): Respuesta => () =>
  Response.json({
    model: "modelo-real",
    choices: [{ message: { role: "assistant", content, ...(extra.reasoning_content !== undefined ? { reasoning_content: extra.reasoning_content } : {}) }, finish_reason: extra.finish === undefined ? "stop" : extra.finish }],
    ...(extra.usage === null ? {} : { usage: extra.usage ?? USO }),
  });
const estado = (status: number, cuerpo: string): Respuesta => () => new Response(cuerpo, { status });
const llm = (f: typeof fetch, formatoJson?: FormatoJsonFoundryModelos, apiVersion?: string) =>
  crearLlmFoundryModelos({ apiKey: CLAVE, endpoint: ENDPOINT, deployment: "cronista-deepseek", fetch: f, ...(formatoJson ? { formatoJson } : {}), ...(apiVersion ? { apiVersion } : {}) });
const ESQUEMA = { nombre: "ordenes_arena", json: { type: "object", properties: { a: { type: "integer" } }, required: ["a"], additionalProperties: false } };

afterEach(() => { vi.restoreAllMocks(); });

describe("052 · 1 · petición exacta", () => {
  it("POST a /models/chat/completions con api-version por defecto o sobreescrita, api-key, model = deployment, max_tokens y sin temperature/top_p/reasoning_effort", async () => {
    const { f, llamadas } = transporte(respuesta('{"a":1}'));
    await llm(f).completar("sistema", [{ rol: "user", contenido: "hola" }, { rol: "assistant", contenido: "r" }, { rol: "user", contenido: "fb" }]);
    const [l] = llamadas as [Llamada];
    expect(l.url).toBe(`https://recurso-prueba.services.ai.azure.com/models/chat/completions?api-version=${API_VERSION_FOUNDRY_MODELOS}`);
    expect(l.init.method).toBe("POST");
    expect(l.init.headers).toEqual({ "content-type": "application/json", "api-key": CLAVE });
    expect(l.cuerpo.model).toBe("cronista-deepseek");
    expect(l.cuerpo.max_tokens).toBe(MAX_TOKENS_FOUNDRY_MODELOS);
    expect(l.cuerpo.messages).toEqual([{ role: "system", content: "sistema" }, { role: "user", content: "hola" }, { role: "assistant", content: "r" }, { role: "user", content: "fb" }]);
    for (const prohibida of ["temperature", "top_p", "reasoning_effort", "max_completion_tokens"]) expect(l.cuerpo).not.toHaveProperty(prohibida);
    expect(urlFoundryModelos({ endpoint: "https://x.services.ai.azure.com", apiVersion: "2099-01-01-preview" })).toBe("https://x.services.ai.azure.com/models/chat/completions?api-version=2099-01-01-preview");
    const otra = transporte(respuesta("{}"));
    await llm(otra.f, undefined, "2099-01-01-preview").completar("s", [], { maxTokens: 2048 });
    expect(otra.llamadas[0]!.url).toContain("api-version=2099-01-01-preview");
    expect(otra.llamadas[0]!.cuerpo.max_tokens).toBe(2048);
  });
  it("v1.2 · esfuerzo de razonamiento solo si está configurado: reasoning_effort en el cuerpo y sufijo en el id", async () => {
    const { f, llamadas } = transporte(respuesta("{}"));
    const conEsfuerzo = crearLlmFoundryModelos({ apiKey: CLAVE, endpoint: ENDPOINT, deployment: "cronista-grok", esfuerzoRazonamiento: "low", fetch: f });
    await conEsfuerzo.completar("s", []);
    expect(llamadas[0]!.cuerpo.reasoning_effort).toBe("low");
    expect(conEsfuerzo.id).toBe("foundry-modelos:cronista-grok:reasoning-low");
    expect(llm(f).id).toBe("foundry-modelos:cronista-deepseek");
    expect(crearLlmDesdeEnv({ ...ENV, FOUNDRY_MODELOS_ESFUERZO_RAZONAMIENTO: "minimal" }).id).toBe("foundry-modelos:cronista-deepseek:reasoning-minimal");
    expect(() => crearLlmDesdeEnv({ ...ENV, FOUNDRY_MODELOS_ESFUERZO_RAZONAMIENTO: "none" })).toThrow(/FOUNDRY_MODELOS_ESFUERZO_RAZONAMIENTO debe ser low \| minimal/);
    expect(CLAVES_LLM_POR_PREFIJO).toContain("FOUNDRY_MODELOS_ESFUERZO_RAZONAMIENTO");
  });
  it("presupuesto inválido (0, 1,5, mayor al tope) ⇒ lanza sin llamar; el tope exacto se acepta", async () => {
    const { f, llamadas } = transporte(respuesta("{}"));
    for (const maxTokens of [0, 1.5, MAX_TOKENS_TOPE_FOUNDRY_MODELOS + 1, 20_000]) await expect(llm(f).completar("s", [], { maxTokens })).rejects.toThrow(/Presupuesto de salida inválido/);
    expect(llamadas).toHaveLength(0);
    await llm(f).completar("s", [], { maxTokens: MAX_TOKENS_TOPE_FOUNDRY_MODELOS });
    expect(llamadas).toHaveLength(1);
  });
});

describe("052 · 2 · response_format por formato", () => {
  it.each([
    ["json_schema", true, { type: "json_schema", json_schema: { name: ESQUEMA.nombre, strict: true, schema: ESQUEMA.json } }],
    ["json_schema", false, { type: "json_object" }],
    ["json_object", true, { type: "json_object" }],
    [undefined, true, { type: "json_object" }],
  ] as const)("formato %s (con esquema: %s)", async (formato, conEsquema, esperado) => {
    const { f, llamadas } = transporte(respuesta('{"a":1}'));
    await llm(f, formato).completar("s", [], conEsquema ? { esquema: ESQUEMA } : {});
    expect(llamadas[0]!.cuerpo.response_format).toEqual(esperado);
  });
  it("texto ⇒ la clave response_format no se envía", async () => {
    const { f, llamadas } = transporte(respuesta('{"a":1}'));
    await llm(f, "texto").completar("s", [], { esquema: ESQUEMA });
    expect(llamadas[0]!.cuerpo).not.toHaveProperty("response_format");
  });
});

describe("052 · 3 · gramática cerrada de la envoltura de razonamiento (v1.1 §1)", () => {
  it.each([
    ["bloque inicial", '<think>pienso {"x":9}</think>{"a":1}', '{"a":1}'],
    ["dos bloques iniciales con espacios", '<think>uno</think>\n  <think>dos</think>\n{"a":1}  ', '{"a":1}'],
    ["</think> huérfano: hasta el ÚLTIMO cierre", 'razono {"a":0} </think> sigo </think> {"a":1}', '{"a":1}'],
    ["sin marcadores: idéntico", '  {"a":"think y razonamiento"}  ', '{"a":"think y razonamiento"}'],
  ])("%s", (_, entrada, salida) => {
    expect(limpiarRespuestaModelo(entrada)).toBe(salida);
  });
  it.each([
    ["<think> sin cierre al inicio", '<think>pienso {"a":1}'],
    ["<think> sin cierre en medio", '{"a":1} <think> nunca cierra'],
    ["<think> sin cierre tras un bloque completo", '<think>a</think><think>b {"a":1}'],
  ])("%s ⇒ razonamiento sin cerrar", (_, entrada) => {
    expect(() => limpiarRespuestaModelo(entrada)).toThrow(/Foundry Models: razonamiento sin cerrar/);
  });
  it.each([
    ["marcadores dentro de una cadena del JSON", '{"a":"<think>x</think>"}'],
    ["bloque detrás del JSON", '{"a":1}<think>x</think>'],
    ["cierre extra tras la envoltura", '<think>a</think> {"a":1} </think>'],
  ])("%s ⇒ fuera de la envoltura", (_, entrada) => {
    expect(() => limpiarRespuestaModelo(entrada)).toThrow(/Foundry Models: marcadores de razonamiento fuera de la envoltura/);
  });
  it("completar limpia la envoltura y descarta reasoning_content", async () => {
    const { f } = transporte(respuesta('<think>RAZONAMIENTO-PRIVADO</think>{"a":1}', { reasoning_content: "OTRO-RAZONAMIENTO" }));
    const salida = await llm(f).completar("s", []);
    expect(salida).toBe('{"a":1}');
    expect(salida).not.toMatch(/RAZONAMIENTO|think/);
  });
  it("las dos excepciones de razonamiento salen de completar (sin reintento propio)", async () => {
    const abierto = transporte(respuesta('<think>pienso sin fin'));
    await expect(llm(abierto.f).completar("s", [])).rejects.toThrow(/razonamiento sin cerrar/);
    const fuera = transporte(respuesta('{"a":1}<think>x</think>'));
    await expect(llm(fuera.f).completar("s", [])).rejects.toThrow(/fuera de la envoltura/);
    expect(abierto.llamadas.length + fuera.llamadas.length).toBe(2);
  });
});

describe("052 · 4 · extraerObjetoJson (modo texto)", () => {
  it.each([
    ["valla ```json", 'Aquí va:\n```json\n{"a":{"b":1}}\n```\nListo.', '{"a":{"b":1}}'],
    ["prosa antes y después", 'Mi plan: {"a":1} espero que sirva.', '{"a":1}'],
    ["un ejemplo previo NO gana: el último objeto", 'Formato {"ejemplo":true}. Respuesta: {"a":2}', '{"a":2}'],
    ["llaves dentro de cadenas", 'R: {"t":"usa } y { sin miedo","n":{"m":"\\"}"}}', '{"t":"usa } y { sin miedo","n":{"m":"\\"}"}}'],
    ["objetos anidados", '{"a":{"b":{"c":1}},"d":2}', '{"a":{"b":{"c":1}},"d":2}'],
  ])("%s", (_, entrada, salida) => {
    expect(extraerObjetoJson(entrada)).toBe(salida);
  });
  it("sin objeto ⇒ devuelve el texto tal cual (no lanza)", () => {
    expect(extraerObjetoJson("no tengo JSON para ti")).toBe("no tengo JSON para ti");
    expect(extraerObjetoJson("abro { y nunca cierro")).toBe("abro { y nunca cierro");
  });
  it("completar en modo texto: limpia y luego extrae", async () => {
    const { f } = transporte(respuesta('<think>{"ejemplo":1}</think>Claro: {"a":3} fin'));
    expect(await llm(f, "texto").completar("s", [])).toBe('{"a":3}');
  });
});

describe("052 · 5 · consumo (UsoLlm)", () => {
  it("suma prompt/completion/cached; reasoning_tokens NO se suma aparte; respuestasConUso solo con usage", async () => {
    const { f } = transporte(respuesta('{"a":1}'), respuesta('{"a":1}', { usage: null }), respuesta('{"a":1}', { usage: { prompt_tokens: 5, completion_tokens: 7 } }));
    const l = llm(f);
    for (let i = 0; i < 3; i++) await l.completar("s", []);
    expect(l.uso?.()).toEqual({ llamadas: 3, respuestasConUso: 2, entrada: 105, salida: 47, cache: 10 });
    expect(Object.keys(l.uso!())).toEqual(["llamadas", "respuestasConUso", "entrada", "salida", "cache"]);
  });
  it("reasoning_tokens FUERA de completion_tokens (total = prompt + completion + reasoning, caso grok-4.7) se factura como salida; dentro (total = prompt + completion), no", async () => {
    const fuera = { prompt_tokens: 44, completion_tokens: 9, total_tokens: 128, completion_tokens_details: { reasoning_tokens: 75 } };
    const dentro = { prompt_tokens: 44, completion_tokens: 84, total_tokens: 128, completion_tokens_details: { reasoning_tokens: 75 } };
    expect(salidaFacturable(fuera)).toBe(84);
    expect(salidaFacturable(dentro)).toBe(84);
    expect(salidaFacturable({ prompt_tokens: 1, completion_tokens: 2, completion_tokens_details: { reasoning_tokens: 3 } })).toBe(2);
    const { f } = transporte(respuesta("{}", { usage: fuera }), respuesta("{}", { usage: dentro }));
    const l = llm(f);
    await l.completar("s", []); await l.completar("s", []);
    expect(l.uso?.()).toEqual({ llamadas: 2, respuestasConUso: 2, entrada: 88, salida: 168, cache: 0 });
  });
  it("el uso de una respuesta length o content_filter se cuenta antes de lanzar", async () => {
    const { f } = transporte(respuesta('{"a', { finish: "length" }), respuesta(null, { finish: "content_filter" }));
    const l = llm(f);
    await expect(l.completar("s", [])).rejects.toThrow(/truncada/);
    await expect(l.completar("s", [])).rejects.toThrow(/filtro de contenido/);
    expect(l.uso?.()).toEqual({ llamadas: 2, respuestasConUso: 2, entrada: 200, salida: 80, cache: 20 });
  });
  it("uso() devuelve una copia", async () => {
    const { f } = transporte(respuesta("{}"));
    const l = llm(f);
    const u = l.uso!(); u.entrada = 999;
    expect(l.uso!().entrada).toBe(0);
  });
});

describe("052 · 6 · errores con prefijo «Foundry Models» y motivo", () => {
  it.each([
    ["401", estado(401, "unauthorized"), /Foundry Models 401 \(clave rechazada\)/],
    ["429", estado(429, "slow down"), /Foundry Models 429 \(cuota o límite de tasa\)/],
    ["500", estado(500, "boom"), /Foundry Models 500 \(error del servicio\)/],
    ["404 DeploymentNotFound", estado(404, '{"error":{"code":"DeploymentNotFound","message":"no existe"}}'), /Foundry Models 404 \(petición rechazada\): .*DeploymentNotFound/],
    ["length", respuesta('{"a', { finish: "length" }), /Foundry Models: respuesta truncada/],
    ["content_filter", respuesta("x", { finish: "content_filter" }), /Foundry Models: respuesta bloqueada por el filtro de contenido/],
    ["content null", respuesta(null), /Foundry Models: respuesta vacía/],
    ["content vacío", respuesta("   "), /Foundry Models: respuesta vacía/],
    ["solo envoltura", respuesta("<think>nada</think>  "), /Foundry Models: respuesta vacía/],
    ["cuerpo no JSON", () => new Response("<html>", { status: 200 }), /Foundry Models: la respuesta no es JSON/],
    ["JSON sin choices", () => Response.json({ algo: 1 }), /Foundry Models: respuesta malformada \(choices\)/],
  ])("%s", async (_, r, motivo) => {
    const { f } = transporte(r);
    await expect(llm(f).completar("s", [])).rejects.toThrow(motivo);
  });
  it("el detalle del proveedor se redacta con la clave efectiva antes de recortarlo", async () => {
    const { f } = transporte(estado(400, `{"error":"bad key ${CLAVE} en la cabecera"}`));
    const error = await llm(f).completar("s", []).then(() => new Error("no lanzó"), (e: unknown) => e as Error);
    expect(error.message).toMatch(/Foundry Models 400 \(petición rechazada\)/);
    expect(error.message).toContain("[REDACTED]");
    expect(error.message).not.toContain(CLAVE);
  });
});

describe("052 · 7 · fábrica y costura", () => {
  it("id foundry-modelos:<deployment>; tipos y claves por prefijo", () => {
    expect(crearLlmDesdeEnv(ENV).id).toBe("foundry-modelos:cronista-deepseek");
    expect(TIPOS_LLM).toContain("foundry-modelos");
    expect(() => crearLlmDesdeEnv({ CRONISTA_LLM: "otro" })).toThrow(/foundry-modelos/);
    for (const k of ["FOUNDRY_MODELOS_ENDPOINT", "FOUNDRY_MODELOS_API_KEY", "FOUNDRY_MODELOS_DEPLOYMENT", "FOUNDRY_MODELOS_FORMATO_JSON", "FOUNDRY_MODELOS_API_VERSION"]) expect(CLAVES_LLM_POR_PREFIJO).toContain(k);
    expect(FORMATOS_JSON_FOUNDRY_MODELOS).toEqual(["json_schema", "json_object", "texto"]);
  });
  it.each(["FOUNDRY_MODELOS_API_KEY", "FOUNDRY_MODELOS_ENDPOINT", "FOUNDRY_MODELOS_DEPLOYMENT"])("sin %s ⇒ error que nombra la variable", (falta) => {
    expect(() => crearLlmDesdeEnv({ ...ENV, [falta]: "" })).toThrow(new RegExp(`CRONISTA_LLM=foundry-modelos necesita la variable ${falta}`));
  });
  it("FOUNDRY_MODELOS_FORMATO_JSON=xml ⇒ error antes de llamar; uno válido llega a la petición", async () => {
    const espia = vi.spyOn(globalThis, "fetch");
    expect(() => crearLlmDesdeEnv({ ...ENV, FOUNDRY_MODELOS_FORMATO_JSON: "xml" })).toThrow(/FOUNDRY_MODELOS_FORMATO_JSON debe ser json_schema \| json_object \| texto/);
    expect(espia).not.toHaveBeenCalled();
    espia.mockImplementation(async () => respuesta('{"a":1}')());
    await crearLlmDesdeEnv({ ...ENV, FOUNDRY_MODELOS_FORMATO_JSON: "texto", FOUNDRY_MODELOS_API_VERSION: "2099-01-01" }).completar("s", []);
    const [url, init] = espia.mock.calls[0]!;
    expect(String(url)).toContain("api-version=2099-01-01");
    expect(JSON.parse(String(init?.body))).not.toHaveProperty("response_format");
  });
  it("un lado de la arena puede usar foundry-modelos por prefijo", () => {
    const env = { CRONISTA_LLM: "azure-openai", AZURE_OPENAI_API_KEY: "k", AZURE_OPENAI_ENDPOINT: "https://e.openai.azure.com", AZURE_OPENAI_DEPLOYMENT: "a",
      ARENA_VISITA_LLM: "foundry-modelos", ARENA_VISITA_FOUNDRY_MODELOS_API_KEY: CLAVE, ARENA_VISITA_FOUNDRY_MODELOS_ENDPOINT: ENDPOINT, ARENA_VISITA_FOUNDRY_MODELOS_DEPLOYMENT: "cronista-grok" };
    expect(crearLlmEquipoDesdeEnv("local", env).id).toBe("azure-openai:a");
    expect(crearLlmEquipoDesdeEnv("visita", env).id).toBe("foundry-modelos:cronista-grok");
  });
});

describe("052 · 8 · catálogo: identidad pública sin inferencia ni credenciales", () => {
  it("ARENA_X_LLM=foundry-modelos con claves por prefijo ⇒ controlador foundry-modelos:…; construir no llama a fetch; el público no contiene clave ni endpoint", () => {
    const espia = vi.spyOn(globalThis, "fetch");
    const env = {
      ARENA_WEB_LLM: "1", CRONISTA_LLM: "azure-openai", AZURE_OPENAI_API_KEY: CLAVE, AZURE_OPENAI_ENDPOINT: "https://recurso-prueba.openai.azure.com",
      ARENA_MODELOS: JSON.stringify([{ id: "rapido", nombre: "GPT-5.4 mini", prefijo: "ARENA_RAPIDO_" }, { id: "grok", nombre: "Grok 4.7 (Foundry)", prefijo: "ARENA_GROK_" }]),
      ARENA_RAPIDO_AZURE_OPENAI_DEPLOYMENT: "cronista-rapido",
      ARENA_GROK_LLM: "foundry-modelos", ARENA_GROK_FOUNDRY_MODELOS_ENDPOINT: ENDPOINT, ARENA_GROK_FOUNDRY_MODELOS_API_KEY: CLAVE,
      ARENA_GROK_FOUNDRY_MODELOS_DEPLOYMENT: "cronista-grok", ARENA_GROK_FOUNDRY_MODELOS_FORMATO_JSON: "json_schema",
    };
    const catalogo = catalogoModelos(env);
    expect(catalogo.map(m => m.publico)).toEqual([
      { id: "rapido", nombre: "GPT-5.4 mini", controlador: "azure-openai:cronista-rapido" },
      { id: "grok", nombre: "Grok 4.7 (Foundry)", controlador: "foundry-modelos:cronista-grok" },
    ]);
    expect(espia).toHaveBeenCalledTimes(0);
    const publico = JSON.stringify(catalogo.map(m => m.publico));
    expect(publico).not.toContain(CLAVE);
    expect(publico).not.toContain("recurso-prueba");
    expect(() => catalogoModelos({ ...env, ARENA_GROK_FOUNDRY_MODELOS_FORMATO_JSON: "xml" })).toThrow(/FORMATO_JSON/);
  });
});

describe("052 · 9–12 · reintento del controlador con el adaptador REAL", () => {
  const nuevaObs = () => observarArena(new MotorArena(crearConfigArena({ duracionS: 10, intervaloS: 5 })), "local");
  it("9 · <think> + JSON inválido y luego válido: la segunda petición lleva el texto LIMPIO como assistant y el mensaje del validador", async () => {
    const obs = nuevaObs(), valido = JSON.stringify(planProgramado(obs)), c = new AbortController();
    const invalido = JSON.stringify({ ...planProgramado(obs), observacion: "otra-observacion" });
    const { f, llamadas } = transporte(respuesta(`<think>RAZONAMIENTO-PRIVADO {"x":1}</think>${invalido}`, { reasoning_content: "CONTENIDO-DE-RAZONAMIENTO" }), respuesta(valido));
    const adaptador = llm(f);
    const controlador = crearControladorLlm(adaptador);
    expect(await controlador.decidir(obs, c.signal)).toEqual(JSON.parse(valido));
    expect(llamadas).toHaveLength(2);
    expect(adaptador.uso?.().llamadas).toBe(llamadas.length);
    expect(controlador.llamadasUltimaDecision?.()).toBe(2);
    for (const l of llamadas) expect(l.init.signal).toBe(c.signal);
    const segunda = llamadas[1]!.cuerpo.messages as { role: string; content: string }[];
    expect(segunda).toHaveLength(4);
    expect(segunda[2]).toEqual({ role: "assistant", content: invalido });
    expect(segunda[3]!.role).toBe("user");
    expect(segunda[3]!.content).toMatch(/El validador rechazó: Orden de otra observación o equipo/);
    const texto = JSON.stringify(llamadas[1]!.cuerpo);
    for (const prohibido of ["<think>", "</think>", "RAZONAMIENTO-PRIVADO", "CONTENIDO-DE-RAZONAMIENTO", "reasoning_content"]) expect(texto).not.toContain(prohibido);
  });
  it("10 · abortar durante el fetch ⇒ AbortError y ninguna segunda petición", async () => {
    let peticiones = 0, enCurso!: () => void;
    const iniciado = new Promise<void>(r => { enCurso = r; });
    const f = (async (_: unknown, init?: RequestInit) => {
      peticiones++;
      return await new Promise<Response>((_, rechazar) => {
        init?.signal?.addEventListener("abort", () => rechazar(new DOMException("Cancelado", "AbortError")), { once: true });
        enCurso();
      });
    }) as unknown as typeof fetch;
    const c = new AbortController();
    const promesa = crearControladorLlm(llm(f)).decidir(nuevaObs(), c.signal);
    await iniciado; c.abort();
    await expect(promesa).rejects.toMatchObject({ name: "AbortError" });
    expect(peticiones).toBe(1);
  });
  it("11 · sin reintentos HTTP propios: un 500 produce exactamente una petición", async () => {
    const { f, llamadas } = transporte(estado(500, "boom"));
    await expect(crearControladorLlm(llm(f)).decidir(nuevaObs(), new AbortController().signal)).rejects.toThrow(/Foundry Models 500/);
    expect(llamadas).toHaveLength(1);
  });
  it("12 · modo texto sin objeto: completar resuelve con el texto limpio y el controlador pide la corrección", async () => {
    const obs = nuevaObs(), valido = JSON.stringify(planProgramado(obs));
    const sinObjeto = transporte(respuesta("<think>a</think>Lo siento, no puedo dar JSON ahora."));
    expect(await llm(sinObjeto.f, "texto").completar("s", [])).toBe("Lo siento, no puedo dar JSON ahora.");
    const { f, llamadas } = transporte(respuesta("<think>a</think>Lo siento, no puedo dar JSON ahora."), respuesta(`Aquí está:\n\`\`\`json\n${valido}\n\`\`\``));
    expect(await crearControladorLlm(llm(f, "texto")).decidir(obs, new AbortController().signal)).toEqual(JSON.parse(valido));
    expect(llamadas).toHaveLength(2);
    const segunda = llamadas[1]!.cuerpo.messages as { role: string; content: string }[];
    expect(segunda[2]).toEqual({ role: "assistant", content: "Lo siento, no puedo dar JSON ahora." });
    expect(segunda[3]!.content).toMatch(/El validador rechazó/);
    expect(llamadas[1]!.cuerpo).not.toHaveProperty("response_format");
  });
});
