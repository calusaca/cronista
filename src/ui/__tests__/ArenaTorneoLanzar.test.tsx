// Brief 062 § 9 U1 (P1-a) · Render (renderToStaticMarkup) del panel «Lanzar un torneo» y de la página con torneos del
// sitio: cifras que salen de la Ficha del servidor (no literales), botón `disabled` con su motivo visible en cada caso,
// grupos visible y deshabilitado, confirmación, rótulos de origen, leyenda «†» según quién declara, bandas de estado,
// bloque «En juego», lista separada por origen y anuncios `aria-live` solo con cambios.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TORNEO_SITIO as S } from "../../sim/limites";
import { esquemaTorneo, esquemaTorneo062, type Torneo062 } from "../../arena/torneo";
import { estimarFormato, type EntradasSitio, type FichaFormato } from "../../arena/torneo-formatos";
import type { EstadoSitio, MotivoSitio } from "../../arena/torneo-sitio";
import entradas from "../../arena/torneo-sitio-entradas.json";
import { anunciosCambio, ArenaTorneo, rotuloOrigen } from "../ArenaTorneo";
import { cifrasFormato, PanelLanzar, textoMotivo, type VistaPanel } from "../ArenaTorneoLanzar";
import { TEXTOS_TORNEO_SITIO as T } from "../textos-torneo-sitio";
import { listaTorneos, torneoAMostrar } from "../torneo-lista";
import { clubesDelPlan } from "../../arena/torneo-pagina";

const decodificar = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#x27;/g, "'");
/** Fichas con cifras deliberadamente raras: si el panel escribiera algo a mano, no coincidiría. */
const ficha = (f: "liga" | "grupos", cambio: Partial<FichaFormato> = {}): FichaFormato => ({ ...estimarFormato(f, entradas as EntradasSitio), ...cambio });
const estadoBase = (cambio: Partial<EstadoSitio> = {}): EstadoSitio => ({
  habilitado: true, motivo: null, diaUtc: "2026-10-26", proximoCupoUtc: "2026-10-27T00:00:00.000Z", activo: null, hoy: null,
  bolsa: { conocidoMicroUsd: 1_234_567, bolsaMicroUsd: S.bolsaUsd * 1_000_000 },
  formatos: { liga: ficha("liga", { partidos: { min: 31, max: 31 }, duracionMin: { min: 37, max: 37 }, tipicoMicroUsd: { min: 4_444_444, max: 4_444_444, maxConDesempates: 4_444_444 } }), grupos: ficha("grupos") },
  ...cambio,
});
const panel = (v: Partial<VistaPanel> = {}, idioma: "es" | "en" = "en") =>
  decodificar(renderToStaticMarkup(<PanelLanzar idioma={idioma} estado={estadoBase()} error={false} formato="liga" confirmando={false} enviando={false} aviso={null} {...v} />));
const boton = (h: string) => /<button type="button" class="btn btn-primary"([^>]*)data-testid="arena-torneo-iniciar">/.exec(h)?.[1] ?? "";
const motivoVisible = (h: string) => (/<p id="arena-torneo-motivo"[^>]*>(.*?)<\/p>/.exec(h)?.[1] ?? "").replace(/<[^>]+>/g, "");

const SITIO = esquemaTorneo062.parse(JSON.parse(readFileSync("src/arena/__fixtures__/torneos-sitio/sitio-2026-10-20.torneo.json", "utf8")));
const REPO = esquemaTorneo.parse(JSON.parse(readFileSync("src/arena/__fixtures__/torneos/ensayo-059/torneo.json", "utf8")));
const pagina = (t: Torneo062 | typeof REPO, idioma: "es" | "en" = "en") => decodificar(renderToStaticMarkup(<ArenaTorneo lectura={{ estado: "ok", torneo: t }} lista={listaTorneos([REPO], [SITIO])} clubes={clubesDelPlan(t)} idiomaInicial={idioma} />));

describe("062 · U1 · panel «Lanzar un torneo»", () => {
  it("las cifras de cada formato salen de la Ficha del servidor (no son literales)", () => {
    const h = panel();
    expect(h).toContain("31 matches · ≈ 4.4 USD typical · cap 8 USD · ≈ 37 min");
    expect(h).toContain(cifrasFormato(estadoBase().formatos.grupos, "en"));
    const es = panel({}, "es");
    expect(es).toContain("31 partidos · ≈ 4,4 USD típicos · tope 8 USD · ≈ 37 min");
    expect(es).toContain("hasta 2,7 con desempates");
  });
  it("P1-b · Grupos habilitado (la ficha lo declara disponible); si la ficha no lo estuviera: deshabilitado con «Disponible pronto»", () => {
    const habil = panel(), entrada = (h: string, v: string) => new RegExp(`<input type="radio"[^>]*value="${v}"[^>]*/>`).exec(h)?.[0] ?? "";
    expect(entrada(habil, "grupos")).not.toContain("disabled");
    expect(habil).not.toContain(`· ${T.pronto.en}`);
    expect(boton(panel({ formato: "grupos" }))).not.toContain("disabled");
    expect(panel({ formato: "grupos", confirmando: true })).toContain("You are about to launch today's tournament for the whole site: Groups + knockout, 15–18 matches");
    const h = panel({ estado: estadoBase({ formatos: { ...estadoBase().formatos, grupos: ficha("grupos", { disponible: false }) } }) });
    const input = (v: string) => new RegExp(`<input type="radio"[^>]*value="${v}"[^>]*/>`).exec(h)?.[0] ?? "";
    expect(input("grupos")).toContain('disabled=""'); expect(input("grupos")).not.toContain("checked");
    expect(input("liga")).toContain('checked=""'); expect(input("liga")).not.toContain("disabled");
    expect(h).toContain(`· ${T.pronto.en}`);
    expect(boton(h)).not.toContain("disabled");
    expect(boton(h)).toContain('aria-describedby="arena-torneo-motivo"');
    expect(motivoVisible(h)).toBe("");
    expect(h).toContain("One tournament per day (UTC) for the whole site. Period budget: 1.2 of 50 USD †");
  });
  const motivos: MotivoSitio[] = ["desactivado", "commit", "origen", "cancelacion", "replicas", "catalogo", "iniciando", "relevo", "cierre", "activo", "cupo", "bolsa"];
  for (const m of motivos) it(`motivo «${m}» ⇒ botón disabled y el motivo visible (ES y EN)`, () => {
    for (const idioma of ["es", "en"] as const) {
      const h = panel({ estado: estadoBase({ habilitado: false, motivo: m, activo: m === "activo" ? { id: "sitio-2026-10-26" } : null }) }, idioma);
      expect(boton(h)).toContain('disabled=""');
      expect(motivoVisible(h)).toContain(textoMotivo(m, idioma, "2026-10-27T00:00:00.000Z"));
      if (m === "activo") expect(h).toContain(`href="/arena/torneo/sitio-2026-10-26${idioma === "es" ? "?lang=es" : ""}"`);
    }
  });
  it("sin estado por error ⇒ «Could not check the status» con Reintentar; elegir grupos (no disponible) también deshabilita", () => {
    const h = panel({ estado: null, error: true });
    expect(boton(h)).toContain('disabled=""');
    expect(motivoVisible(h)).toContain("Could not check the status.");
    expect(h).toContain(">Retry</button>");
    expect(boton(panel({ formato: "grupos", estado: estadoBase({ formatos: { ...estadoBase().formatos, grupos: ficha("grupos", { disponible: false }) } }) }))).toContain('disabled=""');
  });
  it("confirmación en la misma página: h3, el texto con las cifras de la Ficha y los dos botones; sin el botón de iniciar", () => {
    const h = panel({ confirmando: true });
    expect(h).toContain('<h3 tabindex="-1">Confirm today\'s tournament</h3>');
    expect(h).toContain("You are about to launch today's tournament for the whole site: League, 31 matches, ≈ 4.4 USD typical (estimated cap 8 USD), ≈ 37 min. There is only one per day (UTC).");
    expect(h).toContain(">Confirm and start</button>");
    expect(h).not.toContain('data-testid="arena-torneo-iniciar"');
    expect(panel({ confirmando: true, enviando: true })).toMatch(/disabled="" data-testid="arena-torneo-confirmar-boton"/);
  });
  it("un aviso tras el POST va en role=alert", () => {
    expect(panel({ aviso: textoMotivo("cupo", "en", "2026-10-27T00:00:00.000Z") })).toMatch(/<p role="alert" class="arena-torneo-banda" data-testid="arena-torneo-aviso-lanzar">Today's tournament \(UTC\) has already been launched/);
  });
});

describe("062 · U1 · página con torneos del sitio", () => {
  it("rótulos de origen (D11) y leyenda «†» según quién declara", () => {
    const s = pagina(SITIO), r = pagina(REPO);
    expect(s).toContain('<p class="arena-torneo-rotulo" data-testid="arena-torneo-rotulo">Launched on the site · validated on the server after each match</p>');
    expect(r).toContain('<p class="arena-torneo-rotulo" data-testid="arena-torneo-rotulo">Archived in the repository · validated in CI</p>');
    expect(s).toContain(T.declaradoServidor.en); expect(s).not.toContain("† declared by the CLI");
    expect(r).toContain("† declared by the CLI");
    expect(rotuloOrigen({ ...SITIO, origen: "repositorio" }, "es")).toBe(T.origenPromovido.es);
    expect(pagina(SITIO, "es")).toContain("Lanzado en el sitio · validado en el servidor al terminar cada partido");
  });
  it("las descargas del sitio salen de su ruta; el resumen declara las decisiones por partido", () => {
    const s = pagina(SITIO);
    expect(s).toContain(`href="/api/arena/torneos/sitio/${SITIO.id}/e01.json.gz" download=""`);
    expect(s).toContain("1 decision per coach and match");
    expect(pagina(REPO)).toContain('href="/torneos/ensayo-059/e01.json.gz" download=""');
  });
  it("bandas: incompleto con su motivo y los partidos sin disputar, cancelado e interrumpido", () => {
    const parcial = { ...SITIO, encuentros: SITIO.encuentros.slice(0, 10) };
    expect(pagina({ ...parcial, estado: "incompleto", motivoFin: "tope" })).toContain("Incomplete tournament (estimated cap reached): 20 matches not played");
    expect(pagina({ ...parcial, estado: "cancelado", motivoFin: "cancelado" }, "es")).toContain(T.cancelado.es);
    expect(pagina({ ...parcial, estado: "interrumpido", motivoFin: "reinicio" })).toContain("Interrupted tournament (server restart): 20 matches not played");
  });
  it("en curso: bloque «En juego» con el partido, la fase, los clubes y la hora; lo demás «Por jugar»", () => {
    const enCurso = { ...SITIO, encuentros: SITIO.encuentros.slice(0, 4), estado: "en_curso" as const, motivoFin: null, finUtc: null, enCurso: { n: 5, local: SITIO.encuentros[4]!.local.participante, visita: SITIO.encuentros[4]!.visita.participante, inicioUtc: "2026-10-20T12:00:13.000Z" } };
    const h = pagina(enCurso);
    expect(h).toMatch(/<h2 id="arena-torneo-h-enjuego">In play<\/h2>/);
    expect(h).toContain(`P5 · League · ${SITIO.encuentros[4]!.local.club} (`);
    expect(h).toContain(`– ${SITIO.encuentros[4]!.visita.club} (`);
    expect(h).toContain("started at 12:00 UTC");
    // Los clubes del plan (calculados en el servidor) son los que luego constan en cada partido jugado.
    const clubes = clubesDelPlan(SITIO);
    for (const e of SITIO.encuentros) expect(clubes[e.n]).toEqual({ local: e.local.club, visita: e.visita.club });
    expect(h).toContain("To be played");
    expect(h).toContain('aria-live="polite" data-testid="arena-torneo-anuncio"></p>');
  });
  it("aria-live solo anuncia los cambios: partidos nuevos y el final", () => {
    const antes = { ...SITIO, encuentros: SITIO.encuentros.slice(0, 2), estado: "en_curso" as const, motivoFin: null, finUtc: null };
    const e3 = SITIO.encuentros[2]!;
    expect(anunciosCambio(antes, antes, "en")).toEqual([]);
    expect(anunciosCambio(antes, { ...antes, encuentros: SITIO.encuentros.slice(0, 3) }, "en")).toEqual([`Match 3 finished: ${e3.local.club} ${e3.local.goles}–${e3.visita.goles} ${e3.visita.club}`]);
    expect(anunciosCambio({ ...antes, encuentros: SITIO.encuentros }, SITIO, "es")).toEqual([T.terminado.es]);
  });
  it("lista «Torneos» separada por origen; el estado vacío invita a lanzar", () => {
    const h = pagina(SITIO);
    expect(h).toMatch(/<h3 id="arena-torneo-h-archivados">Archived in the repository · validated in CI<\/h3><ul aria-labelledby="arena-torneo-h-archivados"><li data-testid="arena-torneo-lista-item" data-id="ensayo-059">/);
    expect(h).toMatch(/<h3 id="arena-torneo-h-lanzados">Launched on the site · validated on the server<\/h3><ul aria-labelledby="arena-torneo-h-lanzados"><li data-testid="arena-torneo-lista-item" data-id="sitio-2026-10-20">/);
    expect(h).toMatch(/>Oct 20 · League · complete · 1st=? [^<]+ · rehearsal · no AI</);
    expect(pagina(SITIO, "es")).toMatch(/>20 oct · Liga · completo · 1\.º=? [^<]+ · ensayo · sin IA</);
    expect(h).not.toContain("Operator test tournaments");
    const v = decodificar(renderToStaticMarkup(<ArenaTorneo lectura={null} lista={[]} idiomaInicial="es" />));
    expect(v).toContain(T.vacioLanzar.es);
    expect(v).not.toContain("none can be launched");
  });
  it("torneoAMostrar: el activo primero; si no, el más reciente real antes que un ensayo; la lista no duplica un promovido", () => {
    const x = (id: string, inicioUtc: string, estado: string, tipo: "real" | "ensayo") => ({ id, inicioUtc, estado, tipo });
    expect(torneoAMostrar([x("a", "2026-10-24", "completo", "real"), x("b", "2026-10-26", "completo", "ensayo"), x("c", "2026-10-20", "en_curso", "real")])?.id).toBe("c");
    expect(torneoAMostrar([x("a", "2026-10-24", "completo", "real"), x("c", "2026-10-26", "en_curso", "ensayo")])?.id).toBe("a");
    expect(torneoAMostrar([x("b", "2026-10-26", "completo", "ensayo"), x("c", "2026-10-25", "en_curso", "ensayo")])?.id).toBe("c");
    expect(torneoAMostrar([x("a", "2026-10-24", "completo", "real"), x("b", "2026-10-26", "cancelado", "ensayo")])?.id).toBe("a");
    expect(torneoAMostrar([x("b", "2026-10-26", "cancelado", "ensayo")])?.id).toBe("b");
    expect(torneoAMostrar([])).toBeNull();
    expect(listaTorneos([{ ...SITIO, origen: "repositorio" }], [SITIO]).map(r => [r.id, r.origen])).toEqual([[SITIO.id, "repositorio"]]);
  });
});

describe("062 · los componentes de cliente no arrastran módulos de servidor al navegador", () => {
  it("ArenaTorneo, ArenaTorneoLanzar y sus auxiliares solo importan por valor módulos aptos para el cliente", () => {
    const prohibidos = /from "\.\.\/arena\/(motor|controladores|torneo-sitio|torneo-pagina|torneo-archivo|almacen-torneos|sesiones)"|from "\.\.\/lib\/|from "node:/;
    for (const archivo of ["src/ui/ArenaTorneo.tsx", "src/ui/ArenaTorneoLanzar.tsx", "src/ui/torneo-carga.ts", "src/ui/torneo-lista.ts", "src/ui/textos-torneo-sitio.ts"]) {
      const valor = readFileSync(archivo, "utf8").split("\n").filter(l => /^import (?!type )/.test(l));
      expect(valor.filter(l => prohibidos.test(l)), archivo).toEqual([]);
    }
  });
});

const GRUPOS = esquemaTorneo062.parse(JSON.parse(readFileSync("src/arena/__fixtures__/torneos-sitio/sitio-prueba-aaaaaa660000.torneo.json", "utf8")));
describe("062 · U1 (P1-b) · grupos + eliminatoria", () => {
  const h = pagina(GRUPOS), es = pagina(GRUPOS, "es");
  const sinEtiquetas = (x: string) => x.replace(/<[^>]+>/g, "");
  it("dos tablas de grupo con «Advances» EN TEXTO (Yes (1st) / Yes (2nd) / No) y la línea del criterio del corte", () => {
    for (const G of ["A", "B"]) {
      const tabla = new RegExp(`<table class="arena-torneo-tabla arena-torneo-tabla-grupo" data-testid="arena-torneo-tabla-${G}"[\\s\\S]*?</table>`).exec(h)![0];
      expect(tabla).toContain("<th scope=\"col\">Advances</th>");
      expect([...tabla.matchAll(/data-testid="arena-torneo-pasa">([^<]+)</g)].map(m => m[1])).toEqual(["Yes (1st)", "Yes (2nd)", "No"]);
    }
    expect(es).toContain("<th scope=\"col\">Pasa</th>");
    expect(es).toMatch(/data-testid="arena-torneo-pasa">Sí \(1\.º\)</);
    // Todos los partidos del ensayo de 10 s acaban 0–0: el corte lo decide un criterio del torneo, escrito en texto.
    const criterios = [...h.matchAll(/data-testid="arena-torneo-criterio-grupo">([^<]+)</g)].map(m => m[1]!);
    expect(criterios.length).toBeGreaterThan(0);
    for (const c of criterios) expect(c).toMatch(/Advances as (1st|2nd) on (shots on target \(\d+ to \d+\)|shots \(\d+ to \d+\)|draw \(seed\)) · tournament criterion, not a football rule/);
  });
  it("matrices 3 × 3 por grupo con los 6 partidos del grupo enlazados", () => {
    for (const G of ["A", "B"]) {
      const m = new RegExp(`data-testid="arena-torneo-matriz-${G}"[\\s\\S]*?</table>`).exec(h)![0];
      expect(m.match(/data-testid="arena-torneo-celda"/g)).toHaveLength(6);
    }
  });
  it("cuadro: semifinales y final con su desempate de lados invertidos y el criterio rotulado; «Wins this tournament» junto a la frase de significación", () => {
    for (const fase of ["semifinal-1", "semifinal-2", "final"]) {
      const card = new RegExp(`data-testid="arena-torneo-llave-${fase}">[\\s\\S]*?</li>`).exec(h)![0];
      expect(card).toContain("Play-off, sides swapped: ");
      expect(sinEtiquetas(card)).toMatch(/advances on (shots on target \(\d+–\d+\)|shots \(\d+–\d+\)|group coefficient \(pts, GD, GF: [^)]+\)|draw \(seed\)) · tournament criterion, not a football rule/);
    }
    const c = /data-testid="arena-torneo-campeon">([\s\S]*?)<\/p>/.exec(h)![1]!;
    expect(sinEtiquetas(c)).toMatch(/^Wins this tournament: Ensayo [A-F] In an illustrative sign test .* \(p = 0\.125\)\. This bracket describes this tournament; it does not rank the models by quality\.$/);
    expect(es).toContain("Desempate, lados invertidos: ");
    expect(es).toContain("criterio del torneo, no reglamentario");
  });
  it("prueba del operador: banda en la página, sección propia en la lista y «campeón» en el resumen", () => {
    expect(h).toContain('data-testid="arena-torneo-prueba"><strong>Operator test tournament</strong>');
    const lista = decodificar(renderToStaticMarkup(<ArenaTorneo lectura={{ estado: "ok", torneo: SITIO }} lista={listaTorneos([REPO], [SITIO, GRUPOS])} idiomaInicial="en" />));
    expect(lista).toMatch(/<h3 id="arena-torneo-h-pruebas">Operator test tournaments<\/h3><ul aria-labelledby="arena-torneo-h-pruebas"><li data-testid="arena-torneo-lista-item" data-id="sitio-prueba-aaaaaa660000"><a [^>]*>Oct 21 · Groups \+ knockout · complete · champion Ensayo [A-F] · rehearsal · no AI</);
  });
  it("la significación de grupos (p = 0,125) y el resumen del formato en la cabecera", () => {
    expect(h).toContain("6 AI coaches: 2 groups of 3, home and away, then a knockout (semi-finals and final), 10 s per match");
    expect(h).toContain("15–18");
  });
});
