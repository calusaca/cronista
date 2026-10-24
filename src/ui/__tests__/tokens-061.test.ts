// Brief 061 (v1.1) § 6.1.2 + § V5 · Una sola paleta: los tokens globales del :root del 010 (y sus dos
// bloques oscuros) valen lo mismo que los del bloque de la arena (047). Lee globals.css como
// identidad-ui.test.tsx; ninguna cifra se repite aquí: se comparan los bloques entre sí.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS = readFileSync("src/app/globals.css", "utf8");

/** Cuerpo del primer bloque cuya cabecera es exactamente `cabecera` (hasta su primera llave de cierre). */
function bloque(cabecera: string): Map<string, string> {
  const i = CSS.indexOf(`${cabecera} {`);
  if (i < 0) throw new Error(`Falta el bloque ${cabecera}`);
  const cuerpo = CSS.slice(i + cabecera.length + 2, CSS.indexOf("}", i));
  const mapa = new Map<string, string>();
  for (const m of cuerpo.matchAll(/(--[a-z0-9-]+|color-scheme)\s*:\s*([^;]+);/gi)) mapa.set(m[1]!, m[2]!.trim().replace(/\s+/g, " ").toLowerCase());
  return mapa;
}

// El oscuro base va dentro de @media: se busca su cabecera tras la consulta.
const BASE = bloque(":root");
const BASE_OSCURO_MEDIA = bloque('  :root:not([data-theme="light"])');
const BASE_OSCURO_ATRIBUTO = bloque(':root[data-theme="dark"]');
const ARENA = bloque(":root:has(main.arena-shell)");
const ARENA_OSCURO_MEDIA = bloque('  :root:not([data-theme="light"]):has(main.arena-shell)');
const ARENA_OSCURO_ATRIBUTO = bloque(':root[data-theme="dark"]:has(main.arena-shell)');

/** § 3 D1: los catorce (trece tokens más color-scheme). */
const D1 = ["--bg", "--surface", "--ink", "--muted", "--line", "--accent", "--accent-ink", "--hl", "--hl-line", "--danger", "--danger-soft", "--chip", "--shadow", "color-scheme"];
/** § 3 D2: constantes de rótulo (--ar-live, además, cambia en oscuro: § V5). */
const D2 = ["--ar-bug", "--ar-bug-2", "--ar-bug-ink", "--ar-bug-muted", "--ar-score-bg", "--ar-score-ink", "--ar-live", "--ar-select", "--ar-card-red-bug"];

const valor = (b: Map<string, string>, t: string, donde: string) => {
  const v = b.get(t);
  if (v === undefined) throw new Error(`Falta ${t} en ${donde}`);
  return v;
};

describe("061 · tokens: la crónica usa la paleta de la arena", () => {
  it("cada token de D1 del :root base es igual al de :root:has(main.arena-shell)", () => {
    for (const t of D1) expect(valor(BASE, t, "base"), t).toBe(valor(ARENA, t, "arena"));
  });

  it("los dos bloques oscuros base son iguales al oscuro de la arena (y entre sí)", () => {
    for (const t of D1) {
      const arena = valor(ARENA_OSCURO_MEDIA, t, "arena oscuro (media)");
      expect(valor(ARENA_OSCURO_ATRIBUTO, t, "arena oscuro (atributo)"), t).toBe(arena);
      expect(valor(BASE_OSCURO_MEDIA, t, "base oscuro (media)"), t).toBe(arena);
      expect(valor(BASE_OSCURO_ATRIBUTO, t, "base oscuro (atributo)"), t).toBe(arena);
    }
  });

  it("--pitch-line del base no es el de la arena (sería invisible sobre la superficie de la crónica)", () => {
    expect(valor(BASE, "--pitch-line", "base")).not.toBe(valor(ARENA, "--pitch-line", "arena"));
  });

  it("los nueve tokens de D2 del :root base son iguales a los de la arena", () => {
    expect(D2).toHaveLength(9);
    for (const t of D2) expect(valor(BASE, t, "base"), t).toBe(valor(ARENA, t, "arena"));
  });

  it("§ V5: --ar-live coincide en los tres bloques (claro y los dos oscuros) y cambia con el tema", () => {
    expect(valor(BASE_OSCURO_MEDIA, "--ar-live", "base oscuro (media)")).toBe(valor(ARENA_OSCURO_MEDIA, "--ar-live", "arena oscuro (media)"));
    expect(valor(BASE_OSCURO_ATRIBUTO, "--ar-live", "base oscuro (atributo)")).toBe(valor(ARENA_OSCURO_ATRIBUTO, "--ar-live", "arena oscuro (atributo)"));
    expect(valor(BASE_OSCURO_MEDIA, "--ar-live", "base oscuro")).not.toBe(valor(BASE, "--ar-live", "base"));
  });
});
