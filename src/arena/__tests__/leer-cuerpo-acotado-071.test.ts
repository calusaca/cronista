// Brief 071 (revisión Codex, ronda 3) · `leerCuerpoAcotado` (lo usan /api/mcp y el torneo del sitio): en un 408 (plazo)
// o un 413 (tope) cancela DE VERDAD el flujo subyacente —antes de soltar el bloqueo—, sin esperar a que la cancelación
// termine. Los códigos de respuesta no cambian.
import { describe, expect, it } from "vitest";
import { leerCuerpoAcotado } from "../torneo-sitio";

function conCuerpo(trozos: string[], cerrar: boolean, cancelacionColgada = false) {
  const espia = { cancelaciones: 0 };
  const body = new ReadableStream<Uint8Array>({
    start(c) { for (const t of trozos) c.enqueue(new TextEncoder().encode(t)); if (cerrar) c.close(); },
    cancel() { espia.cancelaciones++; return cancelacionColgada ? new Promise<void>(() => {}) : undefined; },
  });
  const req = new Request("http://localhost/x", { method: "POST", body, duplex: "half" } as RequestInit & { duplex: "half" });
  return { req, espia };
}
const estado = async (p: Promise<unknown>) => { try { await p; return 0; } catch (e) { return (e as { status: number }).status; } };
const tic = () => new Promise((r) => setTimeout(r, 10));

describe("071 · leerCuerpoAcotado cancela el flujo en 408 y 413", () => {
  it("plazo vencido → 408 y el flujo recibe cancel (también si la cancelación nunca termina)", async () => {
    for (const colgada of [false, true]) {
      const { req, espia } = conCuerpo(["{"], false, colgada);
      expect(await estado(leerCuerpoAcotado(req, 1_000, 30))).toBe(408);
      await tic();
      expect(espia.cancelaciones).toBe(1);
    }
  });

  it("cuerpo por encima del tope → 413 y el flujo recibe cancel", async () => {
    const { req, espia } = conCuerpo(["x".repeat(600), "x".repeat(600)], false);
    expect(await estado(leerCuerpoAcotado(req, 1_000, 5_000))).toBe(413);
    await tic();
    expect(espia.cancelaciones).toBe(1);
  });

  it("sin cambios en el camino feliz y en JSON inválido (400)", async () => {
    expect(await leerCuerpoAcotado(conCuerpo(['{"a":', "1}"], true).req, 1_000, 1_000)).toEqual({ a: 1 });
    expect(await estado(leerCuerpoAcotado(conCuerpo(["{"], true).req, 1_000, 1_000))).toBe(400);
  });
});
