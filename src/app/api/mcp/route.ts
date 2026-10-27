// Brief 071 § 2.A · /api/mcp: el servidor MCP de solo lectura de CRONISTA por Streamable HTTP SIN sesión. El SDK exige
// un transporte nuevo por petición en ese modo: cada POST crea su `McpServer` (`crearServidorMcp`) y su
// `WebStandardStreamableHTTPServerTransport` (respuestas JSON, sin SSE) y los cierra al responder.
// GET (flujo SSE) y DELETE (cierre de sesión) no aplican sin sesión → 405. Sin CORS. Cuerpo ≤ MCP_ARENA.maxCuerpoBytes
// (413) y admisión por IP y global con el patrón y las cabeceras de la de crónicas (429 + retry-after).
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Admision } from "../../../arena/admision";
import { servicioCronicas } from "../../../arena/cronica";
import { almacenCronicasDesdeEnv } from "../../../arena/cronica-almacen";
import { depsFuentesReales } from "../../../arena/cronica-fuentes";
import { crearServidorMcp } from "../../../mcp/servidor";
import { MCP_ARENA } from "../../../sim/limites";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const sinCache = { "cache-control": "no-store" };
const compartida = globalThis as typeof globalThis & { __cronistaAdmisionMcp?: Admision };
const admision = () => compartida.__cronistaAdmisionMcp ??= new Admision(MCP_ARENA.admision);
const errorRpc = (status: number, mensaje: string, extra: Record<string, string> = {}) =>
  Response.json({ jsonrpc: "2.0", error: { code: -32000, message: mensaje }, id: null }, { status, headers: { ...sinCache, ...extra } });

/** Origen público para las URLs de las respuestas (el host de la petición; https si el ingress lo declara). */
function origenPublico(req: Request): string {
  const u = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return `${proto === "https" || proto === "http" ? proto : u.protocol.slice(0, -1)}://${u.host}`;
}

export async function POST(req: Request): Promise<Response> {
  const largo = Number(req.headers.get("content-length") ?? NaN);
  if (Number.isFinite(largo) && largo > MCP_ARENA.maxCuerpoBytes) { await req.body?.cancel().catch(() => {}); return errorRpc(413, "Request body too large"); }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida";
  const r = admision().admitir(ip);
  if (!r.ok) {
    await req.body?.cancel().catch(() => {});
    return errorRpc(429, "Too many MCP requests; wait a moment", { "retry-after": String(Math.max(1, Math.ceil(r.reintentarEnMs / 1000))) });
  }
  const servidor = crearServidorMcp({ almacen: () => almacenCronicasDesdeEnv(), fuentes: depsFuentesReales, cronicas: servicioCronicas(), origen: origenPublico(req) });
  const transporte = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: MCP_ARENA.maxCuerpoBytes });
  try {
    await servidor.connect(transporte);
    const respuesta = await transporte.handleRequest(req);
    respuesta.headers.set("cache-control", "no-store");
    return respuesta;
  } catch (error) {
    console.warn("CRONISTA: petición MCP no disponible", { tipo: error instanceof Error ? error.name : "Error" });
    return errorRpc(500, "MCP request failed");
  } finally {
    r.liberar();
    await transporte.close().catch(() => {});
    await servidor.close().catch(() => {});
  }
}

const sinSesion = () => errorRpc(405, "Method not allowed: this server is stateless (POST only, no SSE stream)", { allow: "POST" });
export const GET = sinSesion;
export const DELETE = sinSesion;
