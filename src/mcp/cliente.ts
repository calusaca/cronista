// Brief 071 § 2.B · El cronista como cliente MCP: obtiene la selección de hechos de un registro ya guardado llamando a
// `get_match_facts` con el cliente oficial del SDK, conectado en el mismo proceso (InMemoryTransport, sin red) a un
// servidor de `crearServidorMcp`, el mismo que expone `/api/mcp`. Todo con un plazo (`MCP_ARENA.plazoClienteMs`): quien
// llama decide el respaldo; esta función solo devuelve los hechos o lanza `ErrorClienteMcp` con su motivo.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { HechoCronicaArena } from "../arena/cronica-hechos";
import { MCP_ARENA } from "../sim/limites";
import { crearServidorMcp, NOMBRE_SERVIDOR_MCP, VERSION_SERVIDOR_MCP, type DepsMcp, type HechosMcp } from "./servidor";

export type MotivoRespaldoMcp = "plazo" | "error" | "herramienta" | "respuesta" | "discrepancia";
export class ErrorClienteMcp extends Error {
  constructor(readonly motivo: MotivoRespaldoMcp, detalle: string) { super(detalle); }
}

/** La forma mínima que el cronista exige a la respuesta (lo demás lo comprueba la equivalencia con la llamada directa). */
function validar(datos: unknown, huella: string): HechosMcp {
  const d = datos as Partial<HechosMcp> | undefined;
  if (!d || d.huella !== huella || typeof d.cabe !== "boolean" || !Array.isArray(d.hechos)
    || !d.hechos.every((h: Partial<HechoCronicaArena>) => typeof h?.hecho?.id === "string" && Array.isArray(h.hecho.eventos))) {
    throw new ErrorClienteMcp("respuesta", "get_match_facts devolvió una forma inesperada");
  }
  return d as HechosMcp;
}

/** `get_match_facts({ fuente: { huella } })` por MCP in-process, con plazo. Cierra cliente y servidor siempre. */
export async function hechosPorMcp(deps: DepsMcp, huella: string, plazoMs: number = MCP_ARENA.plazoClienteMs): Promise<HechosMcp> {
  const servidor = crearServidorMcp(deps);
  const cliente = new Client({ name: `${NOMBRE_SERVIDOR_MCP}-cronica`, version: VERSION_SERVIDOR_MCP });
  const [delCliente, delServidor] = InMemoryTransport.createLinkedPair();
  const senal = AbortSignal.timeout(plazoMs);
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const plazo = new Promise<never>((_, rechazar) => { reloj = setTimeout(() => rechazar(new ErrorClienteMcp("plazo", `más de ${plazoMs} ms`)), plazoMs); });
  try {
    const llamada = (async () => {
      await servidor.connect(delServidor);
      await cliente.connect(delCliente, { signal: senal, timeout: plazoMs });
      const r = await cliente.callTool({ name: "get_match_facts", arguments: { fuente: { huella } } }, undefined, { signal: senal, timeout: plazoMs });
      if (r.isError) {
        const texto = Array.isArray(r.content) ? r.content.map((c) => (c as { text?: string }).text ?? "").join(" ") : "";
        throw new ErrorClienteMcp("herramienta", texto.slice(0, 200));
      }
      return validar(r.structuredContent, huella);
    })();
    llamada.catch(() => {});
    return await Promise.race([llamada, plazo]);
  } catch (e) {
    if (e instanceof ErrorClienteMcp) throw e;
    throw new ErrorClienteMcp(senal.aborted ? "plazo" : "error", e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 200) : "error");
  } finally {
    clearTimeout(reloj);
    await cliente.close().catch(() => {});
    await servidor.close().catch(() => {});
  }
}
