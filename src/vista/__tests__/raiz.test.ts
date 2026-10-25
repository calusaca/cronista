// Brief 064 § 8.1.1 · Destino de `/` (D2) y raíz por host (D3), funciones puras.
import { describe, expect, it } from "vitest";
import { destinoRaiz, idiomaDeLang, raizEsCronicas } from "../raiz";

describe("064 · destinoRaiz", () => {
  it("sin query → /arena", () => {
    expect(destinoRaiz({})).toBe("/arena");
    expect(destinoRaiz(new URLSearchParams())).toBe("/arena");
  });
  it("conserva la query íntegra: lang=es → /arena?lang=es", () => {
    expect(destinoRaiz({ lang: "es" })).toBe("/arena?lang=es");
    expect(destinoRaiz(new URLSearchParams("lang=es"))).toBe("/arena?lang=es");
  });
  it("con perspectiva va a la portada de crónicas", () => {
    expect(destinoRaiz({ perspectiva: "visita" })).toBe("/cronicas?perspectiva=visita");
  });
  it("conserva el orden de la query", () => {
    expect(destinoRaiz(new URLSearchParams("perspectiva=x&lang=es"))).toBe("/cronicas?perspectiva=x&lang=es");
    expect(destinoRaiz({ perspectiva: "x", lang: "es" })).toBe("/cronicas?perspectiva=x&lang=es");
    expect(destinoRaiz(new URLSearchParams("lang=es&perspectiva=x"))).toBe("/cronicas?lang=es&perspectiva=x");
  });
  it("los enlaces compartidos de la arena siguen llegando: partido=… → /arena?partido=…", () => {
    expect(destinoRaiz({ partido: "abc-123", lang: "es" })).toBe("/arena?partido=abc-123&lang=es");
    expect(destinoRaiz(new URLSearchParams("torneo=t1&encuentro=02"))).toBe("/arena?torneo=t1&encuentro=02");
  });
  it("valores repetidos y vacíos se conservan; los indefinidos no", () => {
    expect(destinoRaiz({ a: ["1", "2"], b: undefined, c: "" })).toBe("/arena?a=1&a=2&c=");
  });
});

describe("064 · raizEsCronicas", () => {
  it("solo con CRONISTA_RAIZ=cronicas (recortada)", () => {
    expect(raizEsCronicas({ CRONISTA_RAIZ: "cronicas" })).toBe(true);
    expect(raizEsCronicas({ CRONISTA_RAIZ: " cronicas " })).toBe(true);
    expect(raizEsCronicas({ CRONISTA_RAIZ: "arena" })).toBe(false);
    expect(raizEsCronicas({})).toBe(false);
  });
  it("lee process.env en cada llamada, no al importar", () => {
    const antes = process.env.CRONISTA_RAIZ;
    try {
      process.env.CRONISTA_RAIZ = "cronicas";
      expect(raizEsCronicas()).toBe(true);
      delete process.env.CRONISTA_RAIZ;
      expect(raizEsCronicas()).toBe(false);
    } finally {
      if (antes === undefined) delete process.env.CRONISTA_RAIZ; else process.env.CRONISTA_RAIZ = antes;
    }
  });
});

describe("064 · idiomaDeLang", () => {
  it("es solo con lang=es", () => {
    expect(idiomaDeLang("es")).toBe("es");
    expect(idiomaDeLang("en")).toBe("en");
    expect(idiomaDeLang(undefined)).toBe("en");
    expect(idiomaDeLang(["es"])).toBe("en");
  });
});
