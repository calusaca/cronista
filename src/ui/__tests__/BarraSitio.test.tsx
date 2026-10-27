// Brief 064 § 8.1.2 · La barra única del sitio: un <header> `topbar arena-topbar`; «Arena» y «Tournament»/«Torneo» con
// sus destinos exactos en EN y ES; aria-current según la sección; la marca a la arena; el botón con el nombre accesible
// de siempre; sin «Match reports», «League mode» ni «Data». Sin DOM en vitest: HTML estático con expresiones acotadas.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {}, forward: () => {}, refresh: () => {} }),
  usePathname: () => "/arena",
  useSearchParams: () => new URLSearchParams(),
}));

import { BarraSitio, enlacesSitio, type SeccionSitio } from "../BarraSitio";
import { BarraHeredada } from "../BarraHeredada";

const html = (idioma: "es" | "en", seccion: SeccionSitio) => renderToStaticMarkup(<BarraSitio idioma={idioma} alCambiarIdioma={() => {}} seccion={seccion} />);
const atributo = (etiqueta: string, nombre: string) => new RegExp(`\\s${nombre}="([^"]*)"`).exec(etiqueta)?.[1] ?? null;
const texto = (interior: string) => interior.replace(/<[^>]*>/g, "").trim();
const navDe = (h: string) => {
  const nav = /<nav\b[^>]*class="topbar-links"[^>]*>(.*?)<\/nav>/s.exec(h);
  if (!nav) throw new Error("Falta el nav de secciones");
  return { apertura: /^<nav\b[^>]*>/.exec(nav[0])![0], interior: nav[1]! };
};
const enlaces = (h: string) => [...navDe(h).interior.matchAll(/(<a\b[^>]*>)(.*?)<\/a>/gs)].map(([, apertura, interior]) => ({
  nombre: texto(interior!), href: atributo(apertura!, "href"), testid: atributo(apertura!, "data-testid"), actual: atributo(apertura!, "aria-current"),
}));

describe("064 · BarraSitio", () => {
  it("es un único <header> con las clases topbar arena-topbar", () => {
    const h = html("en", "arena");
    expect(h.match(/<header\b/g)).toHaveLength(1);
    expect(atributo(/<header\b[^>]*>/.exec(h)![0], "class")?.split(/\s+/)).toEqual(["topbar", "arena-topbar"]);
  });

  it("EN: Arena → /arena y Tournament → /arena/torneo; la marca → /arena", () => {
    const h = html("en", null);
    expect(enlaces(h).map((a) => [a.nombre, a.href, a.testid])).toEqual([["Arena", "/arena", "arena-link"], ["Tournament", "/arena/torneo", "torneo-link"]]);
    expect(atributo(/<a\b[^>]*class="brand"[^>]*>/.exec(h)![0], "href")).toBe("/arena");
    expect(atributo(navDe(h).apertura, "aria-label")).toBe("Sections");
    expect(h).toContain("Football agents with evidence");
  });

  it("ES: Arena → /arena?lang=es y Torneo → /arena/torneo?lang=es; la marca → /arena?lang=es", () => {
    const h = html("es", null);
    expect(enlaces(h).map((a) => [a.nombre, a.href])).toEqual([["Arena", "/arena?lang=es"], ["Torneo", "/arena/torneo?lang=es"]]);
    expect(atributo(/<a\b[^>]*class="brand"[^>]*>/.exec(h)![0], "href")).toBe("/arena?lang=es");
    expect(atributo(navDe(h).apertura, "aria-label")).toBe("Secciones");
    expect(h).toContain("Agentes de fútbol con evidencia");
  });

  it("enlacesSitio da los tres destinos con el lang aplicado", () => {
    expect(enlacesSitio("en")).toEqual({ marca: "/arena", arena: "/arena", torneo: "/arena/torneo" });
    expect(enlacesSitio("es")).toEqual({ marca: "/arena?lang=es", arena: "/arena?lang=es", torneo: "/arena/torneo?lang=es" });
  });

  it('aria-current="page" según la sección; sin sección, en ninguno', () => {
    expect(enlaces(html("en", "arena")).filter((a) => a.actual).map((a) => [a.nombre, a.actual])).toEqual([["Arena", "page"]]);
    expect(enlaces(html("es", "torneo")).filter((a) => a.actual).map((a) => [a.nombre, a.actual])).toEqual([["Torneo", "page"]]);
    expect(enlaces(html("en", null)).filter((a) => a.actual)).toEqual([]);
  });

  it("el botón de idioma conserva sus nombres accesibles y su texto", () => {
    const boton = (h: string) => /<button\b[^>]*>(.*?)<\/button>/s.exec(navDe(h).interior)!;
    expect(atributo(boton(html("en", "arena"))[0], "aria-label")).toBe("Switch to Spanish");
    expect(texto(boton(html("en", "arena"))[1]!)).toBe("ES");
    expect(atributo(boton(html("es", "arena"))[0], "aria-label")).toBe("Cambiar a inglés");
    expect(texto(boton(html("es", "arena"))[1]!)).toBe("EN");
  });

  it("no hay «Match reports», «League mode», «Data», «Lab» ni los lemas viejos en la barra", () => {
    for (const idioma of ["en", "es"] as const) {
      const h = html(idioma, null);
      for (const viejo of ["Match reports", "Crónicas", "League mode", ">Data<", "Lab", "Team agents lab", "Model tournament", "Match reports where every sentence shows its evidence"]) expect(h).not.toContain(viejo);
      expect(enlaces(h)).toHaveLength(2);
    }
  });
});

// Brief 069 · Con el origen de la arena pública (CRONISTA_ARENA_URL, leída en el servidor y pasada por props), la marca,
// «Arena» y «Torneo» son URL absolutas a ese origen, con el lang de siempre; sin él, las relativas de arriba.
describe("069 · BarraSitio con la arena pública", () => {
  const ARENA = "https://arena.ejemplo.invalid";
  const marca = (h: string) => atributo(/<a\b[^>]*class="brand"[^>]*>/.exec(h)![0], "href");

  it("enlacesSitio con origen: absolutos, con el lang aplicado", () => {
    expect(enlacesSitio("en", ARENA)).toEqual({ marca: `${ARENA}/arena`, arena: `${ARENA}/arena`, torneo: `${ARENA}/arena/torneo` });
    expect(enlacesSitio("es", ARENA)).toEqual({ marca: `${ARENA}/arena?lang=es`, arena: `${ARENA}/arena?lang=es`, torneo: `${ARENA}/arena/torneo?lang=es` });
  });

  it("enlacesSitio sin origen (undefined o null): idéntico a hoy", () => {
    for (const origen of [undefined, null]) {
      expect(enlacesSitio("en", origen)).toEqual(enlacesSitio("en"));
      expect(enlacesSitio("es", origen)).toEqual({ marca: "/arena?lang=es", arena: "/arena?lang=es", torneo: "/arena/torneo?lang=es" });
    }
  });

  it("la barra renderizada lleva los hrefs absolutos en EN y ES", () => {
    const en = renderToStaticMarkup(<BarraSitio idioma="en" alCambiarIdioma={() => {}} seccion={null} origenArena={ARENA} />);
    expect(enlaces(en).map((a) => [a.nombre, a.href])).toEqual([["Arena", `${ARENA}/arena`], ["Tournament", `${ARENA}/arena/torneo`]]);
    expect(marca(en)).toBe(`${ARENA}/arena`);
    const es = renderToStaticMarkup(<BarraSitio idioma="es" alCambiarIdioma={() => {}} seccion={null} origenArena={ARENA} />);
    expect(enlaces(es).map((a) => [a.nombre, a.href])).toEqual([["Arena", `${ARENA}/arena?lang=es`], ["Torneo", `${ARENA}/arena/torneo?lang=es`]]);
    expect(marca(es)).toBe(`${ARENA}/arena?lang=es`);
  });

  it("BarraHeredada pasa el origen a la barra; sin él, relativos", () => {
    const con = renderToStaticMarkup(<BarraHeredada idiomaInicial="es" origenArena={ARENA} />);
    expect(marca(con)).toBe(`${ARENA}/arena?lang=es`);
    expect(enlaces(con).map((a) => a.href)).toEqual([`${ARENA}/arena?lang=es`, `${ARENA}/arena/torneo?lang=es`]);
    const sin = renderToStaticMarkup(<BarraHeredada idiomaInicial="en" />);
    expect(marca(sin)).toBe("/arena");
    expect(enlaces(sin).map((a) => a.href)).toEqual(["/arena", "/arena/torneo"]);
  });
});
