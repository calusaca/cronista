// Brief 071 § 3 (e2e) · El servidor MCP de solo lectura en el build de producción (puerto 3417), con el CLIENTE OFICIAL
// del SDK por Streamable HTTP: initialize, tools/list con las 3 herramientas, list_matches y get_match_facts del duelo
// (la misma huella que la crónica del duelo). El tope de tasa por IP devuelve 429 (el SDK lo informa como error HTTP
// 429). GET sin SSE → 405. Ninguna cifra se repite: el tope sale de MCP_ARENA.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport, StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect, test } from "@playwright/test";
import { MCP_ARENA } from "../src/sim/limites";

const urlMcp = (base: string | undefined) => new URL("/api/mcp", base ?? "http://127.0.0.1:3417");

async function conectar(base: string | undefined, ip?: string): Promise<Client> {
  const cliente = new Client({ name: "e2e-071", version: "0" });
  await cliente.connect(new StreamableHTTPClientTransport(urlMcp(base), ip ? { requestInit: { headers: { "x-forwarded-for": ip } } } : undefined));
  return cliente;
}

test("071 · cliente MCP del SDK por HTTP: initialize, tools/list, list_matches y get_match_facts del duelo", async ({ request, baseURL }) => {
  const cliente = await conectar(baseURL);
  try {
    expect(cliente.getServerVersion()?.name).toBe("cronista");
    const { tools } = await cliente.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["get_match_facts", "get_match_report", "list_matches"]);
    for (const t of tools) expect(t.annotations?.readOnlyHint).toBe(true);

    const lista = await cliente.callTool({ name: "list_matches", arguments: {} });
    expect(lista.isError).toBeFalsy();
    const partidos = (lista.structuredContent as { partidos: { fuente: Record<string, string> }[] }).partidos;
    expect(partidos.map((p) => p.fuente)).toContainEqual({ archivo: "duelo" });
    expect(partidos.some((p) => "torneo" in p.fuente)).toBe(true);
    expect(partidos.every((p) => !("sesion" in p.fuente) && !("registro" in p.fuente))).toBe(true);

    const hechos = await cliente.callTool({ name: "get_match_facts", arguments: { fuente: { archivo: "duelo" } } });
    expect(hechos.isError).toBeFalsy();
    const d = hechos.structuredContent as { huella: string; hechos: { hecho: { id: string; eventos: string[] } }[] };
    expect(d.huella).toMatch(/^[a-f0-9]{40}$/);
    expect(d.hechos.length).toBeGreaterThan(0);
    expect(d.hechos.every((h) => h.hecho.eventos.length > 0)).toBe(true);
    // La misma identidad que la crónica del duelo (064).
    const cronica = await request.post("/api/arena/cronicas", { data: { archivo: "duelo" } });
    expect(cronica.status()).toBe(200);
    expect((await cronica.json()).huella).toBe(d.huella);

    // Una sesión en directo nunca se acepta.
    const sesion = await cliente.callTool({ name: "get_match_facts", arguments: { fuente: { sesion: "00000000-0000-0000-0000-000000000000" } } });
    expect(sesion.isError).toBe(true);
  } finally { await cliente.close(); }
});

test("071 · GET sin SSE → 405; el tope de tasa por IP → 429 con retry-after (también para el cliente del SDK)", async ({ request, baseURL }) => {
  const get = await request.get("/api/mcp", { headers: { accept: "text/event-stream" } });
  expect(get.status()).toBe(405);
  expect(get.headers()["allow"]).toBe("POST");

  const ip = "198.51.100.71";
  const cuerpo = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };
  const headers = { "content-type": "application/json", accept: "application/json, text/event-stream", "x-forwarded-for": ip };
  for (let i = 0; i < MCP_ARENA.admision.porIpPorHora; i++) expect((await request.post("/api/mcp", { data: cuerpo, headers })).status()).toBe(200);
  const tope = await request.post("/api/mcp", { data: cuerpo, headers });
  expect(tope.status()).toBe(429);
  expect(Number(tope.headers()["retry-after"])).toBeGreaterThanOrEqual(1);
  expect(tope.headers()["cache-control"]).toBe("no-store");
  const error = await conectar(baseURL, ip).then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(StreamableHTTPError);
  expect((error as StreamableHTTPError).code).toBe(429);
});
