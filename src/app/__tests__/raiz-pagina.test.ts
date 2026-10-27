// Brief 064 § 8.1.1 (v1.1, D3) · La página de `/`: con CRONISTA_RAIZ=cronicas devuelve la portada de crónicas con
// ruta "/" y la perspectiva pedida; sin la variable lanza el error de `redirect` (307) hacia la arena con la query.
import { afterEach, describe, expect, it } from "vitest";
import Raiz from "../page";
import { PortadaCronicas } from "../../ui/PortadaCronicas";
import Cronicas from "../cronicas/page";

const antes = process.env.CRONISTA_RAIZ;
const antesArena = process.env.CRONISTA_ARENA_URL;
afterEach(() => {
  if (antes === undefined) delete process.env.CRONISTA_RAIZ; else process.env.CRONISTA_RAIZ = antes;
  if (antesArena === undefined) delete process.env.CRONISTA_ARENA_URL; else process.env.CRONISTA_ARENA_URL = antesArena;
});

async function errorDe(p: Promise<unknown>): Promise<{ digest?: string }> {
  try { await p; } catch (e) { return e as { digest?: string }; }
  throw new Error("la página no redirigió");
}

describe("064 · página raíz", () => {
  it("con CRONISTA_RAIZ=cronicas: PortadaCronicas con ruta / y la perspectiva pedida", async () => {
    process.env.CRONISTA_RAIZ = "cronicas";
    const el = (await Raiz({ searchParams: Promise.resolve({ perspectiva: "visita" }) })) as unknown as { type: unknown; props: Record<string, unknown> };
    expect(el.type).toBe(PortadaCronicas);
    expect(el.props.ruta).toBe("/");
    expect(el.props.perspectiva).toBe("visita");
    const neutral = (await Raiz({ searchParams: Promise.resolve({}) })) as unknown as { type: unknown; props: Record<string, unknown> };
    expect(neutral.type).toBe(PortadaCronicas);
    expect(neutral.props.perspectiva).toBe("neutral");
  });

  it("sin la variable: redirect 307 a /arena?lang=es", async () => {
    delete process.env.CRONISTA_RAIZ;
    const e = await errorDe(Raiz({ searchParams: Promise.resolve({ lang: "es" }) }));
    expect(e.digest).toContain("/arena?lang=es");
    expect(e.digest).toContain("307");
  });

  it("sin la variable y con perspectiva: redirect 307 a /cronicas con la query", async () => {
    process.env.CRONISTA_RAIZ = "arena";
    const e = await errorDe(Raiz({ searchParams: Promise.resolve({ perspectiva: "visita" }) }));
    expect(e.digest).toContain("/cronicas?perspectiva=visita");
    expect(e.digest).toContain("307");
  });
});

// Brief 069 · En el host de crónicas, la página lee CRONISTA_ARENA_URL en el servidor, en cada petición, y pasa su
// origen a la portada (barra y «← Arena»). Sin la variable, `null`: enlaces relativos como hasta ahora.
describe("069 · origen de la arena pública en la portada", () => {
  type Elemento = { type: unknown; props: Record<string, unknown> };
  it("con CRONISTA_ARENA_URL: / y /cronicas pasan el origen a PortadaCronicas", async () => {
    process.env.CRONISTA_RAIZ = "cronicas";
    process.env.CRONISTA_ARENA_URL = "https://arena.ejemplo.invalid/";
    const raiz = (await Raiz({ searchParams: Promise.resolve({ lang: "es" }) })) as unknown as Elemento;
    expect(raiz.type).toBe(PortadaCronicas);
    expect(raiz.props.origenArena).toBe("https://arena.ejemplo.invalid");
    expect(raiz.props.idiomaBarra).toBe("es");
    const cronicas = (await Cronicas({ searchParams: Promise.resolve({}) })) as unknown as Elemento;
    expect(cronicas.type).toBe(PortadaCronicas);
    expect(cronicas.props.origenArena).toBe("https://arena.ejemplo.invalid");
  });
  it("sin CRONISTA_ARENA_URL: origen null en / y /cronicas", async () => {
    process.env.CRONISTA_RAIZ = "cronicas";
    delete process.env.CRONISTA_ARENA_URL;
    expect(((await Raiz({ searchParams: Promise.resolve({}) })) as unknown as Elemento).props.origenArena).toBeNull();
    expect(((await Cronicas({ searchParams: Promise.resolve({}) })) as unknown as Elemento).props.origenArena).toBeNull();
  });
});
