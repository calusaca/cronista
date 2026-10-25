// Brief 064 § 8.1.1 (v1.1, D3) · La página de `/`: con CRONISTA_RAIZ=cronicas devuelve la portada de crónicas con
// ruta "/" y la perspectiva pedida; sin la variable lanza el error de `redirect` (307) hacia la arena con la query.
import { afterEach, describe, expect, it } from "vitest";
import Raiz from "../page";
import { PortadaCronicas } from "../../ui/PortadaCronicas";

const antes = process.env.CRONISTA_RAIZ;
afterEach(() => { if (antes === undefined) delete process.env.CRONISTA_RAIZ; else process.env.CRONISTA_RAIZ = antes; });

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
