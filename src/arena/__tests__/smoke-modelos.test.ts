// Brief 052 v1.1 §3–4, §7 — el smoke de admisión, sin red: adaptadores REALES con fetch falso.
// Cuenta solo las decisiones del candidato (por identidad y lado), espera 22, no guarda muestras
// crudas ni secretos, y un fallo del rival no cuenta ni a favor ni en contra.
import { describe, expect, it } from "vitest";
import { crearLlmAzureOpenAI } from "../../lib/llm-azure-openai";
import { crearLlmFoundryModelos } from "../../lib/llm-foundry-modelos";
import { SMOKE_MODELOS_ARENA as S } from "../../sim/limites";
import { planProgramado } from "../controladores";
import { clasificarError, ejecutarSmokeModelo, esperadasPorPartido, PARTIDOS_SMOKE, razonamientoFuera, serializarEvidencia, type CandidatoSmoke, type FabricaLlm, type Peticion } from "../smoke-modelos";
import type { ObservacionArena } from "../tipos";

const CLAVE = "clave-centinela-smoke-052";
const ordenesDe = (init?: RequestInit) => {
  const cuerpo = JSON.parse(String(init?.body)) as { messages: { role: string; content: string }[] };
  return JSON.stringify(planProgramado(JSON.parse(cuerpo.messages[1]!.content) as ObservacionArena));
};
const ok = (content: string, extra: Record<string, unknown> = {}) => Response.json({ model: "modelo-falso", choices: [{ message: { content, ...extra }, finish_reason: "stop" }], usage: { prompt_tokens: 8000, completion_tokens: 400, total_tokens: 8400 } });
/** Candidato que razona con <think> y reasoning_content (ambos con la clave centinela). */
const fetchCandidato = (async (_: unknown, init?: RequestInit) => ok(`<think>pienso ${CLAVE}</think>${ordenesDe(init)}`, { reasoning_content: `razonamiento ${CLAVE}` })) as unknown as typeof fetch;
const fetchRival = (falla: boolean) => (async (_: unknown, init?: RequestInit) => falla ? new Response("boom", { status: 500 }) : ok(ordenesDe(init))) as unknown as typeof fetch;
const candidato: CandidatoSmoke = { id: "prueba", nombrePublico: "Modelo de prueba (Foundry)", llm: "foundry-modelos", deployment: "cronista-prueba", modelo: "modelo-falso", version: "1", capacidad: 10 };
const fabrica = (): FabricaLlm => (espec, transporte) => espec.tipo === "azure-openai"
  ? crearLlmAzureOpenAI({ apiKey: CLAVE, endpoint: "https://falso.openai.azure.com", deployment: espec.deployment, reasoningEffort: "low", fetch: transporte })
  : crearLlmFoundryModelos({ apiKey: CLAVE, endpoint: "https://falso.services.ai.azure.com", deployment: espec.deployment, ...(espec.formatoJson ? { formatoJson: espec.formatoJson } : {}), fetch: transporte });
// El transporte instrumentado recibe como base un fetch que distingue al rival por URL.
const base = (rivalFalla = false) => (async (u: string | URL | Request, i?: RequestInit) => String(u).includes("openai.azure.com") ? fetchRival(rivalFalla)(u, i) : fetchCandidato(u, i)) as typeof fetch;

describe("052 · smoke de admisión (sin red)", () => {
  it("22 decisiones esperadas del candidato: espejo 8, cruzados 4 + 4, web 6", () => {
    expect(PARTIDOS_SMOKE.map(esperadasPorPartido)).toEqual([2 * Math.ceil(S.cortoS / S.cortoIntervaloS), Math.ceil(S.cortoS / S.cortoIntervaloS), Math.ceil(S.cortoS / S.cortoIntervaloS), Math.ceil(S.webS / S.webIntervaloS)]);
    expect(PARTIDOS_SMOKE.map(esperadasPorPartido).reduce((a, b) => a + b, 0)).toBe(22);
  });

  it("candidato válido: admitido con 22/22, solo cuenta sus decisiones y la evidencia no guarda <think>, razonamiento ni la clave", async () => {
    const e = await ejecutarSmokeModelo({ candidato, rival: { tipo: "azure-openai", deployment: "cronista-rapido" }, fabrica: fabrica(), fetch: base(), seed: 52, ritmoMsPorSegundo: 0, precio: { entrada: 1, salida: 2 } });
    expect(e.sonda.elegido).toBe("json_schema");
    expect(e.resumen).toMatchObject({ esperadas: 22, observadas: 22, controlador: 22, respaldos: 0, llamadasMax: 1 });
    expect(e.partidos.map(p => [p.nombre, p.esperadas, p.observadas])).toEqual([["espejo", 8, 8], ["cruzadoA", 4, 4], ["cruzadoB", 4, 4], ["web", 6, 6]]);
    expect(new Set(e.decisionesCandidato.map(d => d.controlador))).toEqual(new Set(["foundry-modelos:cronista-prueba"]));
    expect(e.decisionesCandidato.filter(d => d.partido === "cruzadoB").every(d => d.lado === "visita")).toBe(true);
    expect(e.decisionesRival).toHaveLength(14);
    expect(e.partidos.flatMap(p => p.lados.filter(l => l.esCandidato)).every(l => l.teniaThink === l.peticiones && l.reasoningContentChars > 0)).toBe(true);
    expect(e.admision).toEqual({ admitido: true, causas: [] });
    const texto = serializarEvidencia(e, [CLAVE]);
    for (const prohibido of [CLAVE, "<think>", "</think>", "pienso", "razonamiento " + CLAVE]) expect(texto).not.toContain(prohibido);
  }, 120_000);

  it("un fallo del rival no cuenta contra el candidato; sin precio no hay admisión", async () => {
    const e = await ejecutarSmokeModelo({ candidato, rival: { tipo: "azure-openai", deployment: "cronista-rapido" }, fabrica: fabrica(), fetch: base(true), seed: 52, ritmoMsPorSegundo: 0, precio: null, partidos: ["cruzadoA"] });
    expect(e.decisionesRival.every(d => d.origen === "respaldo")).toBe(true);
    expect(e.resumen).toMatchObject({ esperadas: 4, observadas: 4, controlador: 4 });
    expect(e.admision.causas).toEqual(["sin precio anotado en precios.json (§5)"]);
  }, 60_000);

  it("respaldos del candidato impiden la admisión y se reportan con su motivo", async () => {
    let n = 0;
    const falla = (async (u: string | URL | Request, i?: RequestInit) => String(u).includes("openai.azure.com") ? fetchRival(false)(u, i) : ++n % 2 === 0 ? new Response("boom", { status: 500 }) : fetchCandidato(u, i)) as typeof fetch;
    const e = await ejecutarSmokeModelo({ candidato, rival: { tipo: "azure-openai", deployment: "cronista-rapido" }, fabrica: fabrica(), fetch: falla, seed: 52, ritmoMsPorSegundo: 0, precio: { entrada: 1, salida: 2 }, partidos: ["cruzadoA"] });
    expect(e.resumen.respaldos).toBeGreaterThan(0);
    expect(e.admision.admitido).toBe(false);
    expect(e.admision.causas.join(" ")).toMatch(/cayeron a respaldo \(error_controlador\)/);
    expect(e.partidos[0]!.lados.find(l => l.esCandidato)!.estados["500"]).toBeGreaterThan(0);
  }, 60_000);

  it("serializarEvidencia redacta secretos y rechaza marcadores de razonamiento", () => {
    expect(serializarEvidencia({ a: `x ${CLAVE} y` }, [CLAVE])).not.toContain(CLAVE);
    expect(() => serializarEvidencia({ a: "<think>x</think>" }, [])).toThrow(/marcadores de razonamiento/);
  });

  it("clasificación de errores de la sonda y razonamiento fuera de completion", () => {
    expect(clasificarError("Foundry Models 400 (petición rechazada): x")).toEqual({ resultado: "http", status: 400 });
    expect(clasificarError("Foundry Models: respuesta truncada (finish_reason = length)").resultado).toBe("truncado");
    expect(clasificarError("Foundry Models: razonamiento sin cerrar").resultado).toBe("truncado");
    expect(clasificarError("Foundry Models: marcadores de razonamiento fuera de la envoltura").resultado).toBe("no_json");
    const p = (total: number): Peticion => ({ status: 200, ms: 1, finish: "stop", modelo: null, entrada: 44, salida: 9, razonamiento: 75, cache: 0, total, teniaThink: false, reasoningContentChars: 0 });
    expect(razonamientoFuera(p(128))).toBe(true);
    expect(razonamientoFuera(p(53))).toBe(false);
  });
});
