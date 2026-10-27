// Brief 064 § 8.1.1 · Destino de `/` (D2) y raíz por host (D3), funciones puras.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { destinoRaiz, enlaceArena, idiomaDeLang, origenArenaPublica, raizEsCronicas } from "../raiz";

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

// Brief 069 · El origen de la arena pública en el host de crónicas, leído del entorno del servidor en cada llamada.
const ARENA = "https://arena.ejemplo.invalid";

describe("069 · origenArenaPublica", () => {
  it("sin la variable, vacía o inválida → null (enlaces relativos, como antes)", () => {
    expect(origenArenaPublica({})).toBeNull();
    expect(origenArenaPublica({ CRONISTA_ARENA_URL: "" })).toBeNull();
    expect(origenArenaPublica({ CRONISTA_ARENA_URL: "   " })).toBeNull();
    expect(origenArenaPublica({ CRONISTA_ARENA_URL: "arena.ejemplo.invalid" })).toBeNull();
    expect(origenArenaPublica({ CRONISTA_ARENA_URL: "javascript:alert(1)" })).toBeNull();
  });
  it("con la variable → solo el origen, sin ruta ni barra final", () => {
    expect(origenArenaPublica({ CRONISTA_ARENA_URL: ARENA })).toBe(ARENA);
    expect(origenArenaPublica({ CRONISTA_ARENA_URL: ` ${ARENA}/ ` })).toBe(ARENA);
    expect(origenArenaPublica({ CRONISTA_ARENA_URL: `${ARENA}/arena?lang=es` })).toBe(ARENA);
  });
  it("lee process.env en cada llamada, no al importar", () => {
    const antes = process.env.CRONISTA_ARENA_URL;
    try {
      process.env.CRONISTA_ARENA_URL = ARENA;
      expect(origenArenaPublica()).toBe(ARENA);
      delete process.env.CRONISTA_ARENA_URL;
      expect(origenArenaPublica()).toBeNull();
    } finally {
      if (antes === undefined) delete process.env.CRONISTA_ARENA_URL; else process.env.CRONISTA_ARENA_URL = antes;
    }
  });
});

describe("069 · enlaceArena", () => {
  it("relativa sin origen; absoluta con él", () => {
    expect(enlaceArena("/arena")).toBe("/arena");
    expect(enlaceArena("/arena", null)).toBe("/arena");
    expect(enlaceArena("/arena/torneo?lang=es", ARENA)).toBe(`${ARENA}/arena/torneo?lang=es`);
  });
});

describe("069 · infra/app.bicep (host de crónicas)", () => {
  const bicep = readFileSync("infra/app.bicep", "utf8");
  it("pone CRONISTA_ARENA_URL junto a CRONISTA_RAIZ=cronicas, desde un parámetro con la arena pública por defecto", () => {
    const parametro = /^param arenaUrl string = '([^']+)'$/m.exec(bicep);
    expect(parametro).not.toBeNull();
    expect(origenArenaPublica({ CRONISTA_ARENA_URL: parametro![1] })).toBe(parametro![1]);
    expect(bicep).toMatch(/\{ name: 'CRONISTA_RAIZ', value: 'cronicas' \}[^]*?\{ name: 'CRONISTA_ARENA_URL', value: arenaUrl \}/);
    expect(bicep).not.toContain("NEXT_PUBLIC_");
  });
});
