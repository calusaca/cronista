// Brief 055 (v1.1) · Identidad futbolera en /arena: favicon y emblema, escudos y equipaciones por
// partido con contraste medido en el navegador, anillos de selección y favorito (cuatro estados) con
// sus estilos calculados, realce del escudo en la celebración y ausencia de las barras ::before/::after.
// Los mínimos se leen de IDENTIDAD_ARENA; los ejemplos se leen del JSON público en el propio test.
import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { contrasteWcag, identidadPartido } from "../src/arena/identidad";
import type { EventoArena, RegistroArena } from "../src/arena/tipos";
import { ARENA, IDENTIDAD_ARENA } from "../src/sim/limites";

test.describe.configure({ mode: "serial" });

const leer = async (ruta: string) => JSON.parse(await readFile(ruta, "utf8")) as RegistroArena;
const hex = (rgb: string) => { const m = rgb.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number); return `#${m.map(v => Math.round(v).toString(16).padStart(2, "0")).join("")}`; };
const rgbDe = (h: string) => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;
/** Color computado de una variable CSS resuelta dentro de .arena-shell. */
const variable = (page: Page, nombre: string) => page.locator("main.arena-shell").evaluate((main, n) => {
  const s = document.createElement("span"); s.style.color = `var(${n})`; main.appendChild(s);
  const c = getComputedStyle(s).color; s.remove(); return c;
}, nombre);

async function cargar(page: Page, boton: "Load AI coaches example" | "Load recorded model duel", visita: string) {
  await page.getByRole("button", { name: "Saved matches", exact: true }).click();
  const respuesta = page.waitForResponse(r => new URL(r.url()).pathname === "/api/arena" && r.request().method() === "POST");
  await page.getByRole("button", { name: boton, exact: true }).click();
  expect((await respuesta).ok()).toBe(true);
  await expect(page.locator(".arena-score")).toContainText(visita);
}

/** Paso 3 · Escudos con data-kit de cada club y fichas que contrastan entre sí y con el césped. */
async function comprobarKits(page: Page, registro?: RegistroArena) {
  const escudos = page.locator(".arena-score .arena-crest");
  await expect(escudos).toHaveCount(2);
  const kits = await escudos.evaluateAll(es => es.map(e => e.getAttribute("data-kit")));
  expect(kits[0]).not.toBe(kits[1]);
  const [local, visita, cesped] = await Promise.all([".arena-local .arena-kit", ".arena-visita .arena-kit", ".arena-grass"]
    .map(s => page.locator(s).first().evaluate(e => getComputedStyle(e).fill)));
  expect(contrasteWcag(hex(local!), hex(visita!))).toBeGreaterThanOrEqual(IDENTIDAD_ARENA.minEntreEquipos);
  expect(contrasteWcag(hex(local!), hex(cesped!))).toBeGreaterThanOrEqual(IDENTIDAD_ARENA.minGrafico);
  expect(contrasteWcag(hex(visita!), hex(cesped!))).toBeGreaterThanOrEqual(IDENTIDAD_ARENA.minGrafico);
  if (registro) {
    const id = identidadPartido(registro.config.partido.local.nombre, registro.config.partido.visita.nombre);
    expect(kits).toEqual([id.local.principal.id, id.visita.principal.id]);
    expect(local).toBe(rgbDe(id.kits.local.fondo));
    expect(visita).toBe(rgbDe(id.kits.visita.fondo));
    await expect(page.locator(".arena-kit-note")).toHaveCount(id.kits.visitaAlternativa ? 1 : 0);
  }
  return kits;
}

/** v1.1 § 8 · Sin barras de color en el marcador ni en los nombres del panel de cifras. */
async function sinBarras(page: Page) {
  const pseudo = (l: Locator, p: "::before" | "::after") => l.evaluate((e, p) => { const s = getComputedStyle(e, p); return { content: s.content, width: s.width }; }, p);
  for (const [l, p] of [[page.locator(".arena-score > span").first(), "::before"], [page.locator(".arena-score > span").last(), "::after"],
    [page.locator('.arena-stats-teams [data-side="local"]'), "::before"], [page.locator('.arena-stats-teams [data-side="visita"]'), "::before"]] as const) {
    const s = await pseudo(l, p);
    expect(s.content).toBe("none");
    // Chromium devuelve «auto» para un pseudoelemento inexistente (v1.1 § 8 pedía «0px»: imposible aquí).
    expect(["0px", "auto"]).toContain(s.width);
  }
}

/** Estilos de los anillos y del dorsal de una ficha (v1.1 §§ 2–3). */
const ficha = (page: Page, id: string) => page.locator(`[data-testid="arena-player"][data-player="${id}"]`);
const anillos = (page: Page, id: string) => ficha(page, id).evaluate(g => {
  const token = g.querySelector(":scope > .arena-token")!, hijos = [...token.children];
  const kit = token.querySelector(":scope > .arena-kit")!, texto = hijos[1]!;
  const sel = token.querySelector(":scope > .arena-select-ring"), fav = token.querySelector(":scope > .arena-fav-ring");
  const st = (e: Element | null) => e && { fill: getComputedStyle(e).fill, stroke: getComputedStyle(e).stroke, dash: getComputedStyle(e).strokeDasharray, display: getComputedStyle(e).display, r: Number(e.getAttribute("r")) };
  return {
    clases: hijos.map(h => h.getAttribute("class") ?? h.tagName), kit: st(kit), textoEsSegundo: texto.tagName === "text" && hijos[0] === kit,
    textoFill: getComputedStyle(texto).fill, sel: st(sel), fav: st(fav), ultimo: hijos.at(-1)!.getAttribute("class"),
  };
});

test("055 · favicon SVG y emblema en / y en /arena", async ({ page }) => {
  for (const ruta of ["/arena", "/"]) {
    await page.goto(ruta);
    const href = await page.locator('link[rel="icon"]').first().getAttribute("href");
    expect(href).toBeTruthy();
    const r = await page.request.get(href!);
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toContain("image/svg+xml");
    await expect(page.locator(".brand-emblem")).toBeVisible();
    // El enlace .brand sigue siendo el enlace a / y el emblema no añade texto a su nombre.
    await expect(page.locator("a.brand")).toHaveAttribute("href", "/");
    expect(await page.locator(".brand-emblem").getAttribute("aria-hidden")).toBe("true");
  }
  await page.goto("/arena");
  const color = await page.locator(".arena-topbar .brand-emblem").evaluate(e => getComputedStyle(e).color);
  expect(color).toBe(await variable(page, "--ar-score-bg"));
});

test("055 · escudos y equipaciones: portada, ejemplo de entrenadores IA (dos veces) y duelo; sin barras de color", async ({ page }) => {
  const errores: string[] = []; page.on("pageerror", e => errores.push(e.message));
  const ejemplo = await leer("public/experimentos/arena-llm-v3.json"), duelo = await leer("public/experimentos/arena-duelo-v3.json");
  await page.goto("/arena");
  await comprobarKits(page);
  await sinBarras(page);
  await cargar(page, "Load AI coaches example", ejemplo.config.partido.visita.nombre);
  const a = await comprobarKits(page, ejemplo);
  await page.getByRole("slider", { name: "Match time" }).press("End");
  await sinBarras(page);
  // v1.1 § 1 · Pastillas líder: texto --ar-bug en los dos lados (local claro, visita oscura en este ejemplo).
  const bug = await variable(page, "--ar-bug");
  for (const lado of ["local", "visita"] as const) {
    const pastilla = page.locator(`.arena-stat-value[data-lead][data-side="${lado}"]`).first();
    await expect(pastilla).toBeVisible();
    const [color, fondo] = await pastilla.evaluate(e => [getComputedStyle(e).color, getComputedStyle(e).backgroundColor]);
    expect(color).toBe(bug);
    expect(contrasteWcag(hex(color!), hex(fondo!))).toBeGreaterThanOrEqual(IDENTIDAD_ARENA.minTexto);
  }
  await cargar(page, "Load recorded model duel", duelo.config.partido.visita.nombre);
  const b = await comprobarKits(page, duelo);
  expect(b).not.toEqual(a);
  // Determinismo visto: recargar y volver a cargar el ejemplo da los mismos escudos y camisetas.
  await page.reload();
  await cargar(page, "Load AI coaches example", ejemplo.config.partido.visita.nombre);
  expect(await comprobarKits(page, ejemplo)).toEqual(a);
  // Los nombres accesibles de los botones de equipo no cambian (el escudo es aria-hidden).
  for (const lado of ["local", "visita"] as const) await expect(page.getByRole("button", { name: ejemplo.config.partido[lado].nombre, exact: true })).toBeVisible();
  expect(errores).toEqual([]);
});

test("055 · anillos de selección y favorito: cuatro estados, estilos calculados y realce del escudo en la celebración", async ({ page }) => {
  const errores: string[] = []; page.on("pageerror", e => errores.push(e.message));
  const ejemplo = await leer("public/experimentos/arena-llm-v3.json");
  const [g1, g2] = ejemplo.eventos.filter(e => e.tipo === "gol") as [EventoArena, EventoArena];
  const id = identidadPartido(ejemplo.config.partido.local.nombre, ejemplo.config.partido.visita.nombre);
  const favorito = g1.jugador, otro = ejemplo.inicial.jugadores.find(j => j.lado !== g1.lado && j.id !== g2.jugador)!.id;
  const ladoDe = (pid: string) => ejemplo.inicial.jugadores.find(j => j.id === pid)!.lado;
  await page.goto("/arena");
  await cargar(page, "Load AI coaches example", ejemplo.config.partido.visita.nombre);
  const select = await variable(page, "--ar-select");
  const comprobarBase = (a: Awaited<ReturnType<typeof anillos>>, pid: string) => {
    const kit = id.kits[ladoDe(pid)];
    expect(a.textoEsSegundo).toBe(true);
    expect(a.textoFill).toBe(rgbDe(kit.tinta));
    expect(a.kit!.stroke).toBe(rgbDe(kit.tinta));
    expect(a.kit!.fill).toBe(rgbDe(kit.fondo));
  };
  const comprobarAnillo = (r: NonNullable<Awaited<ReturnType<typeof anillos>>["sel"]>, kitR: number) => {
    expect(["none", "rgba(0, 0, 0, 0)"]).toContain(r.fill);
    expect(r.stroke).toBe(select);
    expect(r.r).toBeGreaterThan(kitR);
  };

  // Seleccionado solo (paso 5): clic en una ficha → un anillo sólido, tras el dorsal.
  await ficha(page, favorito).dispatchEvent("click");
  await expect(page.locator(".arena-player-selected .arena-select-ring")).toHaveCount(1);
  let a = await anillos(page, favorito);
  comprobarBase(a, favorito);
  expect(a.clases.slice(0, 3)).toEqual(["arena-kit", "text", "arena-select-ring"]);
  comprobarAnillo(a.sel!, a.kit!.r); expect(a.sel!.dash).toBe("none"); expect(a.fav).toBeNull();

  // Ambos: el seleccionado se marca como favorito → sólido r 2,6 y punteado r 3,05.
  await page.getByTestId("arena-favorite-player").click();
  await expect(ficha(page, favorito)).toHaveAttribute("data-favorite", "true");
  a = await anillos(page, favorito);
  comprobarBase(a, favorito);
  expect(a.clases.slice(0, 4)).toEqual(["arena-kit", "text", "arena-select-ring", "arena-fav-ring"]);
  comprobarAnillo(a.sel!, a.kit!.r); comprobarAnillo(a.fav!, a.sel!.r);
  expect(a.fav!.dash).not.toBe("none"); expect(a.fav!.display).not.toBe("none");

  // Favorito solo: se selecciona otra ficha.
  await ficha(page, otro).dispatchEvent("click");
  a = await anillos(page, favorito);
  comprobarBase(a, favorito);
  expect(a.sel).toBeNull(); comprobarAnillo(a.fav!, a.kit!.r);
  expect(a.clases.slice(0, 3)).toEqual(["arena-kit", "text", "arena-fav-ring"]);
  const b = await anillos(page, otro);
  comprobarBase(b, otro); expect(b.fav).toBeNull(); comprobarAnillo(b.sel!, b.kit!.r);
  await expect(page.locator(".arena-select-ring")).toHaveCount(1);
  await expect(page.locator(".arena-fav-ring")).toHaveCount(1);

  // Celebración del gol del favorito: anillo punteado oculto, anillo de gol último hijo y escudo realzado.
  const realce = () => page.locator(".arena-score .arena-crest").evaluateAll(es => es.map(e => ({ estilo: getComputedStyle(e).outlineStyle, color: getComputedStyle(e).outlineColor })));
  const marca = await variable(page, "--ar-score-bg");
  for (const g of [g1, g2]) {
    await page.getByRole("slider", { name: "Match time" }).fill(String(g.tick * ARENA.pasoS + 0.5));
    await expect(page.locator(`.arena-score[data-gol="${g.lado}"]`)).toHaveCount(1);
    const [l, v] = await realce();
    const [marcado, otroLado] = g.lado === "local" ? [l!, v!] : [v!, l!];
    expect(marcado).toEqual({ estilo: "solid", color: marca });
    expect(otroLado.estilo).toBe("none");
    if (g === g1) {
      a = await anillos(page, favorito);
      expect(a.ultimo).toBe("arena-goal-ring");
      expect(a.fav!.display).toBe("none");
      comprobarBase(a, favorito);
    }
  }
  expect(errores).toEqual([]);
});

// ---------- Bloque B · Partido primero (§ 4 y v1.1 §§ 5–6) ----------

/** Paso 2 · Sin desplazar: cancha completa y marcador en el primer encuadre; tablero y acompañante alineados. */
async function primerEncuadre(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  const cancha = (await page.locator(".arena-pitch-wrap").boundingBox())!, marcador = (await page.locator(".arena-score").boundingBox())!;
  expect(cancha.y + cancha.height).toBeLessThanOrEqual(900);
  expect(marcador.y + marcador.height).toBeLessThanOrEqual(330);
  const tablero = (await page.locator(".arena-board").boundingBox())!, acompanante = (await page.getByTestId("arena-companion").boundingBox())!;
  expect(Math.abs(tablero.y - acompanante.y)).toBeLessThan(2);
  expect(await page.getByTestId("arena-companion").evaluate(c => c.contains(document.getElementById("arena-control")))).toBe(true);
  expect(await page.locator("#arena-control").evaluate(e => e.parentElement!.firstElementChild === e)).toBe(true);
}

/** v1.1 § 6 · Teclado: Tab hasta el CTA de la cabecera y Enter → foco y vista en la sala de control. */
async function ctaPorTeclado(page: Page, nombre: string, primerControl: string) {
  const cta = page.getByRole("link", { name: nombre, exact: true });
  await expect(cta).toBeVisible();
  await page.locator("a.brand").focus();
  for (let i = 0; i < 12 && !(await cta.evaluate(e => e === document.activeElement)); i++) await page.keyboard.press("Tab");
  expect(await cta.evaluate(e => e === document.activeElement)).toBe(true);
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("arena-control");
  const vista = page.viewportSize()!;
  await expect.poll(async () => { const b = await page.locator("#arena-control").boundingBox(); return b !== null && b.y >= 0 && b.y < vista.height; }).toBe(true);
  const cabecera = await page.locator("header").evaluate(h => { const r = h.getBoundingClientRect(); return getComputedStyle(h).position === "sticky" ? r.bottom : 0; });
  expect((await page.locator("#arena-control").boundingBox())!.y).toBeGreaterThanOrEqual(cabecera - 1);
  await expect(page.locator("#arena-control").getByRole("button", { name: primerControl, exact: true })).toBeInViewport();
}

test("055 · partido primero en escritorio: cancha y marcador sin desplazar, sala de control en el acompañante y CTA por teclado", async ({ page }) => {
  const errores: string[] = []; page.on("pageerror", e => errores.push(e.message));
  const ejemplo = await leer("public/experimentos/arena-llm-v3.json");
  await page.goto("/arena");
  await page.getByTestId("arena-pitch").waitFor();
  await primerEncuadre(page);
  await cargar(page, "Load AI coaches example", ejemplo.config.partido.visita.nombre);
  await primerEncuadre(page);
  // El formulario sigue abierto tras cargar (no cambia `configurando`) y es usable dentro del acompañante.
  expect(await page.locator("details.arena-setup").evaluate(d => (d as HTMLDetailsElement).open)).toBe(true);
  await ctaPorTeclado(page, "Set up or choose a match", "Live");
  // Con el acompañante desplazado internamente al fondo, el CTA devuelve la sala de control a la vista.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByTestId("arena-companion").evaluate(c => { c.scrollTop = c.scrollHeight; });
  expect(await page.getByTestId("arena-companion").evaluate(c => c.scrollTop)).toBeGreaterThan(0);
  await ctaPorTeclado(page, "Set up or choose a match", "Live");
  expect(errores).toEqual([]);
});

test.describe("055 · móvil", () => {
  test.use({ viewport: { width: 360, height: 780 }, colorScheme: "dark", reducedMotion: "reduce" });
  test("360 px, oscuro, movimiento reducido y español: sin desborde, encabezado y CTA visibles; el CTA lleva a la sala de control", async ({ page }) => {
    const errores: string[] = []; page.on("pageerror", e => errores.push(e.message));
    await page.goto("/arena");
    await page.getByRole("button", { name: "Switch to Spanish" }).click();
    await expect(page.getByRole("heading", { name: "Dos equipos. Una misma cancha." })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await page.getByRole("link", { name: "Configurar o elegir un partido", exact: true }).click();
    await expect.poll(async () => { const b = await page.locator("#arena-control").boundingBox(); return b !== null && b.y >= 0 && b.y < 780; }).toBe(true);
    await ctaPorTeclado(page, "Configurar o elegir un partido", "En vivo");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    expect(errores).toEqual([]);
  });
});

// ---------- Bloque C · Iconos de eventos (§ 6 y v1.1 §§ 7–8) ----------
test("055 · iconos de eventos en el feed, la descripción y el panel de cifras", async ({ page }) => {
  const errores: string[] = []; page.on("pageerror", e => errores.push(e.message));
  const ejemplo = await leer("public/experimentos/arena-llm-v3.json");
  const gol = ejemplo.eventos.find(e => e.tipo === "gol")!, amarilla = ejemplo.eventos.find(e => e.tipo === "amarilla");
  await page.goto("/arena");
  await cargar(page, "Load AI coaches example", ejemplo.config.partido.visita.nombre);
  // El cursor en el tick exacto del evento: está entre los cinco últimos del feed.
  for (const e of [gol, ...amarilla ? [amarilla] : []]) {
    await page.getByRole("slider", { name: "Match time" }).fill(String(e.tick * ARENA.pasoS));
    const li = page.getByTestId("arena-live-text").locator(`li[data-event-tick="${e.tick}"]`);
    await expect(li.locator(`.arena-event-icon[data-kind="${e.tipo}"]`).first()).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator(`#arena-description li[data-event-id="${e.id}"] .arena-event-icon[data-kind="${e.tipo}"]`)).toHaveCount(1);
  }
  // Al final: toda fila del feed y de la descripción tiene su celda de icono; el panel marca los remates.
  await page.getByRole("slider", { name: "Match time" }).press("End");
  await expect(page.locator(".arena-live-feed li .arena-event-icon[data-kind]").first()).toBeVisible();
  const filas = page.locator("#arena-description li");
  expect(await filas.count()).toBeGreaterThan(0);
  expect(await filas.evaluateAll(lis => lis.every(li => li.children.length === 4 && li.children[1]!.classList.contains("arena-event-icon")))).toBe(true);
  await expect(page.getByTestId("arena-stats").locator('[data-stat="remates"] .arena-event-icon[data-kind="tiro"]')).toHaveCount(1);
  // Las tarjetas del panel usan los tokens del rótulo, no el --card-yellow/--danger del atributo.
  const tarjeta = await page.getByTestId("arena-stats").locator('[data-stat="amarillas"] .arena-event-icon rect').evaluate(r => getComputedStyle(r).fill);
  expect(tarjeta).toBe(await variable(page, "--ar-card-yellow-bug"));
  expect(errores).toEqual([]);
});
