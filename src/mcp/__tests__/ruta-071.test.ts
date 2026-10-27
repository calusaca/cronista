// Brief 071 § 2.A · La ruta /api/mcp (Streamable HTTP sin sesión) llamada como route handler: POST JSON-RPC con
// respuesta JSON, GET/DELETE 405 (sin SSE), cuerpo > MCP_ARENA.maxCuerpoBytes → 413, y la admisión por IP con el
// patrón de la de crónicas (429 + retry-after + no-store). Sin CORS. Ninguna cifra se repite a mano.
import { afterEach, describe, expect, it } from "vitest";
import { Admision } from "../../arena/admision";
import { MCP_ARENA } from "../../sim/limites";
import { DELETE, GET, POST } from "../../app/api/mcp/route";

const compartida = globalThis as typeof globalThis & { __cronistaAdmisionMcp?: Admision };
afterEach(() => { delete compartida.__cronistaAdmisionMcp; });

const URL_MCP = "http://localhost:3417/api/mcp";
const peticion = (cuerpo: unknown, ip = "203.0.113.7", extra: Record<string, string> = {}) => new Request(URL_MCP, {
  method: "POST", body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "x-forwarded-for": ip, ...extra },
});
const listar = (id = 1) => ({ jsonrpc: "2.0", id, method: "tools/list", params: {} });

describe("071 · /api/mcp", () => {
  it("initialize y tools/list por POST: JSON (no SSE), sin sesión, sin CORS y no-store", async () => {
    const ini = await POST(peticion({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "prueba", version: "0" } } }));
    expect(ini.status).toBe(200);
    expect(ini.headers.get("content-type")).toContain("application/json");
    expect(ini.headers.get("mcp-session-id")).toBeNull();
    expect(ini.headers.get("access-control-allow-origin")).toBeNull();
    expect(ini.headers.get("cache-control")).toBe("no-store");
    expect((await ini.json()).result.serverInfo.name).toBe("cronista");
    const l = await POST(peticion(listar()));
    expect(l.status).toBe(200);
    expect((await l.json()).result.tools.map((t: { name: string }) => t.name).sort()).toEqual(["get_match_facts", "get_match_report", "list_matches"]);
  });

  it("GET y DELETE → 405 con allow: POST", async () => {
    for (const f of [GET, DELETE]) {
      const r = f();
      expect(r.status).toBe(405);
      expect(r.headers.get("allow")).toBe("POST");
    }
  });

  it("cuerpo mayor que MCP_ARENA.maxCuerpoBytes → 413 (declarado y sin declarar)", async () => {
    const grande = JSON.stringify({ ...listar(), params: { relleno: "x".repeat(MCP_ARENA.maxCuerpoBytes) } });
    expect((await POST(peticion(grande, "203.0.113.8", { "content-length": String(Buffer.byteLength(grande)) }))).status).toBe(413);
    expect((await POST(peticion(grande, "203.0.113.9"))).status).toBe(413);
  });

  it("admisión por IP: la petición porIpPorHora + 1 de la misma IP → 429 con retry-after y no-store; otra IP sigue", async () => {
    for (let i = 0; i < MCP_ARENA.admision.porIpPorHora; i++) expect((await POST(peticion(listar(i), "198.51.100.1"))).status).toBe(200);
    const r = await POST(peticion(listar(), "198.51.100.1"));
    expect(r.status).toBe(429);
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect((await r.json()).error.message).toContain("Too many MCP requests");
    expect((await POST(peticion(listar(), "198.51.100.2"))).status).toBe(200);
  });
});

/** Un POST cuyo cuerpo envía `{` y nunca termina (cliente lento o malicioso). */
const atascada = (ip: string) => new Request(URL_MCP, {
  method: "POST", duplex: "half",
  body: new ReadableStream<Uint8Array>({ start: (c) => { c.enqueue(new TextEncoder().encode("{")); } }),
  headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "x-forwarded-for": ip },
} as RequestInit & { duplex: "half" });
const conTope = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<"sin-respuesta">((r) => setTimeout(() => r("sin-respuesta"), ms))]);

describe("071 · /api/mcp: revisión Codex", () => {
  it("un lote JSON-RPC (array) se rechaza con 400 antes de ejecutar nada (MCP 2025-06-18 sin lotes)", async () => {
    const r = await POST(peticion([listar(1), { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "get_match_facts", arguments: { fuente: { archivo: "duelo" } } } }]));
    expect(r.status).toBe(400);
    const d = await r.json();
    expect(d.error.message).toMatch(/batch/i);
    expect(d.result).toBeUndefined();
    expect((await POST(peticion("[]"))).status).toBe(400);
  });

  it("cuerpos atascados: no retienen plazas; una petición normal posterior entra y los atascados reciben 408 dentro del plazo", async () => {
    const atascadas = Array.from({ length: MCP_ARENA.admision.enCurso }, (_, i) => POST(atascada(`192.0.2.${i + 1}`)));
    await new Promise((r) => setTimeout(r, 50));
    expect((await POST(peticion(listar(), "192.0.2.200"))).status).toBe(200);
    const resultados = await Promise.all(atascadas.map((p) => conTope(p, MCP_ARENA.plazoLecturaMs + 2_000)));
    for (const r of resultados) { expect(r).not.toBe("sin-respuesta"); expect((r as Response).status).toBe(408); }
    expect((await POST(peticion(listar(), "192.0.2.201"))).status).toBe(200);
  }, MCP_ARENA.plazoLecturaMs * 3);

  it("Origin ajeno → 403; el mismo origen (con x-forwarded-proto) y sin Origin → 200", async () => {
    const ajeno = await POST(peticion(listar(), "203.0.113.30", { origin: "https://evil.example" }));
    expect(ajeno.status).toBe(403);
    expect(ajeno.headers.get("access-control-allow-origin")).toBeNull();
    expect((await POST(peticion(listar(), "203.0.113.31", { origin: "http://localhost:3417" }))).status).toBe(200);
    expect((await POST(peticion(listar(), "203.0.113.32", { origin: "https://localhost:3417", "x-forwarded-proto": "https" }))).status).toBe(200);
    expect((await POST(peticion(listar(), "203.0.113.33", { origin: "http://localhost:9999" }))).status).toBe(403);
    expect((await POST(peticion(listar(), "203.0.113.34", { origin: "null" }))).status).toBe(403);
    expect((await POST(peticion(listar(), "203.0.113.35"))).status).toBe(200);
  });
});
