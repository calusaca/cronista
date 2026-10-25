// Brief 059 § 5.2–5.5, M25 · Render de la página del torneo (renderToStaticMarkup) con el fixture de ensayo:
// «—» para null (nunca 0), «†» en todas las declaradas, bandas de ensayo e incompleto, ninguna cifra si es
// incoherente y la frase de significación con la p calculada.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { calendarioTorneo, clasificar, textoSignificacion, TEXTO_PAREO, type TorneoArchivado } from "../../arena/torneo";
import { ArenaTorneo, enlaceRepeticion, TEXTOS_TORNEO } from "../ArenaTorneo";

const t0 = JSON.parse(readFileSync("src/arena/__fixtures__/torneos/ensayo-059/torneo.json", "utf8")) as TorneoArchivado;
const indice = [{ id: t0.id, inicioUtc: t0.inicioUtc, titulo: t0.titulo }];
const html = (t: TorneoArchivado, idioma: "es" | "en" = "en") => renderToStaticMarkup(<ArenaTorneo lectura={{ estado: "ok", torneo: t }} ediciones={indice} idiomaInicial={idioma} />);
const fila = (h: string, testid: string, id: string) => new RegExp(`<tr data-testid="${testid}" data-participante="${id}">(.*?)</tr>`).exec(h)?.[1] ?? "";
const decodificar = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#x27;/g, "'");

describe("059 · página del torneo (M25)", () => {
  it("cabecera, banda de ensayo, frase de significación calculada y pareo; sin banda de incompleto en un torneo completo", () => {
    for (const idioma of ["es", "en"] as const) {
      const h = decodificar(html(t0, idioma));
      expect(h).toContain(TEXTOS_TORNEO.ensayo[idioma]);
      expect(h).toContain(textoSignificacion(t0, idioma));
      expect(h).toContain(TEXTO_PAREO[idioma]);
      expect(h).toContain(TEXTOS_TORNEO.resumen[idioma](t0.participantes.length, t0.duracionS));
      expect(h).not.toContain("data-testid=\"arena-torneo-incompleto\"");
      expect(h).toMatch(new RegExp(`<main class="arena-shell arena-torneo" lang="${idioma}"`));
    }
  });
  it("incompleto: banda con k partidos sin disputar y «s/d» en la matriz", () => {
    const t = { ...t0, encuentros: t0.encuentros.filter(e => e.n !== 6), pendientes: [6], estado: "incompleto" as const };
    const h = html(t, "es");
    expect(h).toContain(TEXTOS_TORNEO.incompleto.es(1));
    expect(h).toContain("<span aria-hidden=\"true\">s/d</span><span class=\"arena-torneo-oculto\">sin disputar</span>");
  });
  it("tabla en el orden de clasificar; matriz con n(n−1) enlaces a /arena?torneo=…&encuentro=NN y la lista con el mismo número de repeticiones", () => {
    const h = html(t0), n = t0.participantes.length;
    expect([...h.matchAll(/<tr data-testid="arena-torneo-fila" data-participante="([^"]+)"/g)].map(m => m[1])).toEqual(clasificar(t0).map(f => f.id));
    const celdas = [...h.matchAll(/<a href="([^"]+)" data-testid="arena-torneo-celda"/g)].map(m => decodificar(m[1]!));
    expect(celdas).toHaveLength(n * (n - 1));
    expect(new Set(celdas)).toEqual(new Set(calendarioTorneo(t0.participantes.map(p => p.id), t0.semilla).map(p => enlaceRepeticion(t0.id, p.n, "en"))));
    expect(h.match(/>Watch replay<span/g)).toHaveLength(t0.encuentros.length);
    expect(h.match(/<span aria-hidden="true">—<\/span><span class="arena-torneo-oculto">not applicable<\/span>/g)).toHaveLength(n);
  });
  it("«—» para null (nunca 0) y «†» en todas las cifras declaradas", () => {
    const id = t0.participantes[0]!.id;
    const t = { ...t0, encuentros: t0.encuentros.map(e => e.local.participante === id ? { ...e, local: { ...e.local, cifras: { ...e.local.cifras, posesionPct: null, remates: null } } } : e) };
    const h = html(t), celdas = [...fila(h, "arena-torneo-metrica", id).matchAll(/<td class="tnum">(.*?)<\/td>/g)].map(m => m[1]!.replace(/<[^>]+>/g, ""));
    // Columnas: válidas, respaldos, solicitudes, latencia, tokens, coste (declaradas) · posesión, remates, directos, precisión, recuperaciones.
    expect(celdas.slice(0, 6).every(c => c.includes("†"))).toBe(true);
    expect(celdas.slice(6).every(c => !c.includes("†"))).toBe(true);
    expect([celdas[6], celdas[7]]).toEqual(["—", "—"]);
    expect(h.match(/<th scope="col">[^<]*†<\/th>/g)).toHaveLength(6);
    expect(h).toContain(TEXTOS_TORNEO.declarado.en);
  });
  it("posición compartida «2=» con texto accesible", () => {
    const t = { ...t0, encuentros: t0.encuentros.map(e => ({ ...e, local: { ...e.local, goles: 1 }, visita: { ...e.visita, goles: 1 } })) };
    const h = html(t, "es");
    expect(h).toContain("<span aria-hidden=\"true\">1=</span><span class=\"arena-torneo-oculto\">empatado en el 1.º puesto</span>");
  });
  it("incoherente: el mensaje y ninguna cifra; vacío: el estado vacío", () => {
    const h = renderToStaticMarkup(<ArenaTorneo lectura={{ estado: "incoherente", id: "x", errores: ["plan"] }} ediciones={[]} idiomaInicial="es" />);
    expect(h).toContain(TEXTOS_TORNEO.incoherente.es);
    expect(h).not.toMatch(/<table|USD|<dd/);
    // Brief 064 § 3.4 · Ninguna cifra en el contenido del torneo (<main>); el pie común del sitio dice «Simulador de 90
    // minutos» y queda fuera de esta comprobación.
    const main = /<main\b[^>]*>(.*)<\/main>/s.exec(h)?.[1] ?? "";
    expect(main).not.toBe("");
    expect(main.replace(/<[^>]+>/g, "")).not.toMatch(/\d/);
    const v = renderToStaticMarkup(<ArenaTorneo lectura={null} ediciones={[]} idiomaInicial="en" />);
    expect(v).toContain(TEXTOS_TORNEO.vacio.en);
    expect(v).not.toContain("<table");
  });
});
