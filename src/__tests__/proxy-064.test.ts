// Brief 064 D2 (P2 de Codex sobre el bloque A) · El proxy de `/` conserva la query original en su orden, también con
// claves repetidas, y no redirige con `CRONISTA_RAIZ=cronicas` (D3).
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { config, proxy } from "../proxy";

const antes = process.env.CRONISTA_RAIZ;
afterEach(() => { if (antes === undefined) delete process.env.CRONISTA_RAIZ; else process.env.CRONISTA_RAIZ = antes; });

const destino = (url: string): { status: number; ruta: string | null } => {
  const r = proxy(new NextRequest(url));
  const loc = r.headers.get("location");
  return { status: r.status, ruta: loc ? new URL(loc, url).pathname + new URL(loc, url).search : null };
};

describe("064 · proxy de la raíz", () => {
  it("solo se aplica a /", () => {
    expect(config.matcher).toEqual(["/"]);
  });
  it("claves repetidas conservan su orden original", () => {
    delete process.env.CRONISTA_RAIZ;
    expect(destino("http://localhost:3000/?a=1&b=2&a=3")).toEqual({ status: 307, ruta: "/arena?a=1&b=2&a=3" });
    expect(destino("http://localhost:3000/?lang=es&perspectiva=x&lang=en")).toEqual({ status: 307, ruta: "/cronicas?lang=es&perspectiva=x&lang=en" });
  });
  it("sin query → /arena; con perspectiva → /cronicas", () => {
    delete process.env.CRONISTA_RAIZ;
    expect(destino("http://localhost:3000/")).toEqual({ status: 307, ruta: "/arena" });
    expect(destino("http://localhost:3000/?perspectiva=visita")).toEqual({ status: 307, ruta: "/cronicas?perspectiva=visita" });
  });
  it("el destino es del mismo origen", () => {
    delete process.env.CRONISTA_RAIZ;
    const r = proxy(new NextRequest("http://ejemplo.test:4000/?lang=es"));
    expect(new URL(r.headers.get("location")!, "http://otro.test").origin).toBe("http://ejemplo.test:4000");
  });
  it("con CRONISTA_RAIZ=cronicas no redirige (D3)", () => {
    process.env.CRONISTA_RAIZ = "cronicas";
    const r = proxy(new NextRequest("http://localhost:3000/?a=1&b=2&a=3"));
    expect(r.headers.get("location")).toBeNull();
    expect(r.status).toBe(200);
  });
});
