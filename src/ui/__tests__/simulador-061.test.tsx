// Brief 061 (v1.1) § 6.1.3 + § V6 · Barra compartida de las crónicas: clases del header, enlaces de
// sección en orden con sus nombres y destinos, aria-current según la sección y sin estilos en línea.
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

/** Enlaces del nav «Sections», en orden: etiqueta de apertura y texto visible. */
const enlacesNav = (h: string) => {
  const nav = /<nav[^>]*aria-label="Sections"[^>]*>(.*?)<\/nav>/s.exec(h)?.[1];
  if (!nav) throw new Error("Falta el nav Sections");
  return [...nav.matchAll(/(<a\b[^>]*>)(.*?)<\/a>/gs)].map(([, apertura, interior]) => ({
    nombre: texto(interior!),
    href: atributo(apertura!, "href"),
    testid: atributo(apertura!, "data-testid"),
    actual: atributo(apertura!, "aria-current"),
  }));
};

describe("061 · barra superior de las crónicas", () => {
  it("el header reutiliza la barra de la arena: topbar arena-topbar topbar-cronicas", () => {
    const header = /<header\b[^>]*>/.exec(html("cronicas"))?.[0] ?? "";
    expect(atributo(header, "class")?.split(/\s+/)).toEqual(["topbar", "arena-topbar", "topbar-cronicas"]);
  });

  it("la navegación lleva Match reports · League mode · Data · Arena, en ese orden y con sus destinos", () => {
    const enlaces = enlacesNav(html("cronicas"));
    expect(enlaces.map((a) => a.nombre)).toEqual(["Match reports", "League mode", "Data", "Arena"]);
    expect(enlaces.map((a) => a.href)).toEqual(["/", "/liga", "/datos", "/arena"]);
    expect(enlaces.map((a) => a.testid)).toEqual(["reports-link", "league-mode", "data-link", "arena-link"]);
  });

  it('aria-current="page" solo en el enlace de la sección dada; sin sección, en ninguno', () => {
    const esperado: Record<SeccionCronicas, string> = { cronicas: "Match reports", liga: "League mode", datos: "Data" };
    for (const [seccion, nombre] of Object.entries(esperado) as [SeccionCronicas, string][]) {
      const actuales = enlacesNav(html(seccion)).filter((a) => a.actual !== null);
      expect(actuales.map((a) => [a.nombre, a.actual])).toEqual([[nombre, "page"]]);
    }
    expect(enlacesNav(html()).filter((a) => a.actual !== null)).toEqual([]);
  });

  it(".brand sigue llevando a /", () => {
    const marca = /<a\b[^>]*class="brand"[^>]*>/.exec(html("cronicas"))?.[0] ?? "";
    expect(atributo(marca, "href")).toBe("/");
  });

  it("Simulador.tsx no lleva estilos en línea (el error usa la clase sim-error)", () => {
    const fuente = readFileSync("src/ui/Simulador.tsx", "utf8");
    expect(fuente).not.toContain("style={{");
    expect(fuente).toContain('role="alert" className="sim-error"');
  });
});
