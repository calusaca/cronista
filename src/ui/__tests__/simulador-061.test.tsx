// Brief 061 (v1.1) § 6.1.3 + § V6, ajustada por el 064 § 8.1.3 · El Simulador ya no es la barra: es la tira
// `nav.cronicas-herramientas` de las rutas heredadas, con «Featured match · League mode · Data» en orden con sus
// destinos, aria-current según la sección, sin <header> y sin estilos en línea.
// Sin DOM en vitest (entorno node): se lee el HTML estático con expresiones acotadas.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {}, forward: () => {}, refresh: () => {} }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import { Simulador, type SeccionCronicas } from "../Simulador";

const html = (seccion?: SeccionCronicas) => renderToStaticMarkup(<Simulador presets={[]} semillaActual={246} seccion={seccion} />);
const atributo = (etiqueta: string, nombre: string) => new RegExp(`\\s${nombre}="([^"]*)"`).exec(etiqueta)?.[1] ?? null;
const texto = (interior: string) => interior.replace(/<[^>]*>/g, "").trim();

/** Enlaces de la tira, en orden: etiqueta de apertura y texto visible. */
const enlacesTira = (h: string) => {
  const tira = /<nav\b[^>]*class="cronicas-herramientas"[^>]*>(.*?)<\/nav>/s.exec(h)?.[1];
  if (!tira) throw new Error("Falta la tira nav.cronicas-herramientas");
  return [...tira.matchAll(/(<a\b[^>]*>)(.*?)<\/a>/gs)].map(([, apertura, interior]) => ({
    nombre: texto(interior!),
    href: atributo(apertura!, "href"),
    testid: atributo(apertura!, "data-testid"),
    actual: atributo(apertura!, "aria-current"),
  }));
};

describe("061 + 064 · tira del simulador de 90 minutos", () => {
  it("es un nav.cronicas-herramientas con su nombre accesible y su rótulo visible, sin <header>", () => {
    const h = html("cronicas");
    const nav = /^<nav\b[^>]*>/.exec(h)?.[0] ?? "";
    expect(atributo(nav, "class")).toBe("cronicas-herramientas");
    expect(atributo(nav, "aria-label")).toBe("90-minute simulator");
    expect(h).toContain("90-minute simulator · separate from the arena");
    expect(h).not.toMatch(/<header\b/);
    expect(h).not.toMatch(/role="region"/);
  });

  it("los enlaces son Featured match · League mode · Data, en ese orden y con sus destinos", () => {
    const enlaces = enlacesTira(html("cronicas"));
    expect(enlaces.map((a) => a.nombre)).toEqual(["Featured match", "League mode", "Data"]);
    expect(enlaces.map((a) => a.href)).toEqual(["/cronicas", "/liga", "/datos"]);
    expect(enlaces.map((a) => a.testid)).toEqual(["reports-link", "league-mode", "data-link"]);
  });

  it('aria-current="page" solo en el enlace de la sección dada; sin sección, en ninguno', () => {
    const esperado: Record<SeccionCronicas, string> = { cronicas: "Featured match", liga: "League mode", datos: "Data" };
    for (const [seccion, nombre] of Object.entries(esperado) as [SeccionCronicas, string][]) {
      const actuales = enlacesTira(html(seccion)).filter((a) => a.actual !== null);
      expect(actuales.map((a) => [a.nombre, a.actual])).toEqual([[nombre, "page"]]);
    }
    expect(enlacesTira(html()).filter((a) => a.actual !== null)).toEqual([]);
  });

  it("conserva el formulario con sus data-testid (y ya no lleva marca ni «Arena»)", () => {
    const h = html("cronicas");
    for (const id of ["preset-select", "seed-input", "simulate", "random-match"]) expect(h).toContain(`data-testid="${id}"`);
    expect(h).toMatch(/<form\b[^>]*class="sim-form"/);
    expect(h).not.toContain('class="brand"');
    expect(h).not.toContain('data-testid="arena-link"');
  });

  it("Simulador.tsx no lleva estilos en línea (el error usa la clase sim-error)", () => {
    const fuente = readFileSync("src/ui/Simulador.tsx", "utf8");
    expect(fuente).not.toContain("style={{");
    expect(fuente).toContain('role="alert" className="sim-error"');
  });
});
