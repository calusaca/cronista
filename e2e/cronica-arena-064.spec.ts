// Brief 064 § 8.2 (bloque B) · La crónica de un partido de la arena: del botón «Match report» a la página (B1), frase ↔
// línea de tiempo (B2), recargar no genera (B3), el mismo partido sale del almacén (B4), sin botón durante el directo
// (B5), ES y 360 px (B6), 404 y estado sin crónica con un registro reinicios-v11 sembrado (B7), barra y pie (B8), y
// contraste por estilos calculados (§ 8.3). El redactor es el LLM de ENSAYO (CRONISTA_LLM=ensayo), rotulado como tal.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { crearSesion } from "./sesiones";
import { archivosCronica, comprimirRegistro, huellaRegistro } from "../src/arena/cronica-almacen";
import { contrasteWcag } from "../src/arena/identidad";
import { IDENTIDAD_ARENA } from "../src/sim/limites";
import type { RegistroArena } from "../src/arena/tipos";

const URL_CRONICA = /\/arena\/cronica\/[a-f0-9]{40}(\?lang=es)?$/;
const esPost = (u: string, m: string) => new URL(u).pathname === "/api/arena/cronicas" && m === "POST";
const hex = (rgb: string) => { const m = rgb.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number); return `#${m.map(v => Math.round(v).toString(16).padStart(2, "0")).join("")}`; };

/** La crónica del duelo archivado por la API (la primera petición la escribe; las siguientes salen del almacén). */
async function cronicaDuelo(request: APIRequestContext): Promise<string> {
  const r = await request.post("/api/arena/cronicas", { data: { archivo: "duelo" } });
  expect(r.status()).toBe(200);
  return (await r.json()).huella as string;
}
async function cargarDuelo(page: Page) {
  await page.goto("/arena");
  await page.getByRole("button", { name: "Saved matches", exact: true }).click();
  await page.getByRole("button", { name: "Load recorded model duel" }).click();
  await expect(page.getByTestId("arena-models")).toHaveAttribute("data-procedencia", "declarada");
}
const sinDesborde = async (page: Page, ancho: number) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ancho);

test("B1 · arena → duelo archivado → «Match report» con espera accesible y un solo POST → página con autor, frases y una corregida con su historia V3", async ({ page }) => {
  const errores: string[] = []; page.on("pageerror", e => errores.push(e.message));
  await cargarDuelo(page);
  const boton = page.getByTestId("arena-cronica");
  await expect(boton).toBeVisible();
  await expect(boton).toHaveText("Match report");
  await expect(page.getByText("Written after the match and checked sentence by sentence")).toBeVisible();
  let posts = 0; page.on("request", r => { if (esPost(r.url(), r.method())) posts++; });
  // Una espera visible: la respuesta se demora un poco para observar el aviso (sin porcentajes).
  await page.route("**/api/arena/cronicas", async r => { await new Promise(res => setTimeout(res, 900)); await r.continue(); });
  await boton.dblclick();
  const aviso = page.getByTestId("match-loading");
  await expect(aviso).toBeVisible();
  await expect(aviso).toContainText("Writing the match report…");
  expect(await aviso.textContent()).not.toMatch(/\d\s*%/);
  await expect(page).toHaveURL(URL_CRONICA, { timeout: 30_000 });
  expect(posts).toBe(1);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.getByTestId("sentence").count()).toBeGreaterThanOrEqual(2);
  const redactor = page.getByTestId("cronica-redactor");
  await expect(redactor).toContainText("Writer: Rehearsal fixture");
  await expect(redactor).toHaveAttribute("data-fixture", "true");
  await expect(page.getByTestId("cronica-arena-cabecera")).toContainText("60 s");
  await expect(page.getByTestId("cronica-arena-modelos")).toHaveAttribute("data-procedencia", "declarada");
  const corregida = page.locator('[data-testid="sentence"][data-state="corregida"]').first();
  await expect(corregida).toBeVisible();
  await corregida.click();
  await expect(page.getByTestId("sentence-fact")).toBeVisible();
  await page.getByTestId("how-written").click();
  await expect(page.getByTestId("glass-box").locator('[data-testid="rule"][data-rule="V3"]').first()).toBeVisible();
  expect(errores).toEqual([]);
});

test("B2 · frase → sus eventos resaltados en la línea de tiempo; evento resaltado → la frase", async ({ page, request }) => {
  const h = await cronicaDuelo(request);
  await page.goto(`/arena/cronica/${h}`);
  const frases = page.getByTestId("sentence");
  const n = await frases.count();
  let i = 0;
  for (; i < n; i++) if ((await frases.nth(i).getAttribute("data-event-ids"))?.trim()) break;
  expect(i).toBeLessThan(n);
  const frase = frases.nth(i);
  const ids = (await frase.getAttribute("data-event-ids"))!.split(" ").filter(Boolean);
  await frase.click();
  await expect(frase).toHaveAttribute("data-selected", "true");
  const resaltados = page.locator('[data-testid="timeline-event"][data-highlighted="true"]');
  await expect(resaltados.first()).toBeVisible();
  const marcados = await resaltados.evaluateAll(es => es.map(e => e.getAttribute("data-event-id")!));
  expect(marcados.length).toBeGreaterThanOrEqual(1);
  for (const id of marcados) expect(ids).toContain(id);
  await resaltados.first().click();
  await expect(frase).toHaveAttribute("data-highlighted", "true");
  // Con el teclado: Enter sobre una frase la elige.
  await frases.nth(0).focus();
  await page.keyboard.press("Enter");
  await expect(frases.nth(0)).toHaveAttribute("data-selected", "true");
});

test("B3 · recargar la página no emite ningún POST y muestra el mismo título", async ({ page, request }) => {
  const h = await cronicaDuelo(request);
  let posts = 0; page.on("request", r => { if (esPost(r.url(), r.method())) posts++; });
  await page.goto(`/arena/cronica/${h}`);
  const titulo = await page.getByRole("heading", { level: 1 }).textContent();
  expect(titulo?.trim().length).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(titulo!);
  await page.waitForLoadState("networkidle");
  expect(posts).toBe(0);
  // El GET tampoco escribe ni genera: devuelve la crónica lista.
  const g = await request.get(`/api/arena/cronicas/${h}`);
  expect((await g.json()).estado).toBe("lista");
});

test("B4 · volver a pulsar para el mismo partido trae la misma huella desde el almacén", async ({ page, request }) => {
  const h = await cronicaDuelo(request);
  await cargarDuelo(page);
  const respuesta = page.waitForResponse(r => esPost(r.url(), r.request().method()));
  await page.getByTestId("arena-cronica").click();
  const cuerpo = await (await respuesta).json();
  expect(cuerpo).toMatchObject({ huella: h, desdeAlmacen: true, url: `/arena/cronica/${h}` });
  await expect(page).toHaveURL(new RegExp(`/arena/cronica/${h}$`));
});

test("B5 · durante un directo programado no hay botón; al terminar la emisión aparece", async ({ page, request }) => {
  const creada = await crearSesion(request, { seed: 11, segundos: 12, local: "auto", visita: "auto", seleccion: { modo: "programado" }, presentacion: "buffer" });
  const { id } = await creada.json();
  try {
    await page.goto(`/arena?partido=${id}&vista=buffer`);
    await expect(page.getByTestId("arena-buffer-status")).toContainText("Live");
    for (let k = 0; k < 4; k++) { await expect(page.getByTestId("arena-cronica")).toHaveCount(0); await page.waitForTimeout(500); }
    await expect(page.getByTestId("arena-cronica")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("arena-buffer-status")).not.toContainText("Live");
  } finally { await request.delete(`/api/arena/sesiones/${id}`).catch(() => {}); }
});

test("B6 · ES: frases, «Ver proceso» y las reglas de Proceso en español; 360 px sin desborde", async ({ page, request }) => {
  const h = await cronicaDuelo(request);
  await page.goto(`/arena/cronica/${h}`);
  const en = await page.getByTestId("sentence-text").first().textContent();
  await page.getByRole("banner").getByRole("button", { name: "Switch to Spanish" }).click();
  await expect(page.locator("main.arena-cronica")).toHaveAttribute("lang", "es");
  await expect(page.getByTestId("sentence-text").first()).not.toHaveText(en!);
  await expect(page.getByTestId("cronica-redactor")).toContainText("Redactor:");
  await expect(page.getByRole("heading", { level: 2, name: "Línea de tiempo" })).toBeVisible();
  await page.getByTestId("open-process").click();
  await expect(page.getByTestId("open-process")).toHaveCount(1);
  const proceso = page.getByTestId("process-view");
  await expect(proceso).toContainText("El proceso · todos los intentos, lado a lado");
  await expect(proceso.locator('[data-testid="rule"][data-rule="V3"]').first()).toContainText("Una cifra, un marcador");
  await page.getByRole("button", { name: "Cerrar" }).click();
  await page.setViewportSize({ width: 360, height: 780 });
  await sinDesborde(page, 360);
  await page.goto(`/arena/cronica/${h}?lang=es`);
  await expect(page.getByRole("banner").getByRole("button", { name: "Cambiar a inglés" })).toBeVisible();
  await sinDesborde(page, 360);
});

test("B7 · una huella inexistente es 404; un registro reinicios-v11 sin crónica muestra el estado y el botón la escribe", async ({ page, request }) => {
  expect((await request.get(`/arena/cronica/${"f".repeat(40)}`)).status()).toBe(404);
  expect((await request.get("/arena/cronica/no-es-una-huella")).status()).toBe(404);
  const errores: string[] = []; page.on("pageerror", e => errores.push(e.message));
  const registro = JSON.parse(readFileSync("src/arena/__fixtures__/arena-reinicios-v11.json", "utf8")) as RegistroArena;
  const h = huellaRegistro(registro), dir = resolve(".cache/e2e/cronicas");
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, archivosCronica.registro(h)), comprimirRegistro(registro));
  await page.goto(`/arena/cronica/${h}`);
  const vacia = page.getByTestId("cronica-arena-sin-prosa");
  await expect(vacia).toHaveAttribute("data-estado", "sin-cronica");
  await expect(page.getByTestId("sentence")).toHaveCount(0);
  await expect(page.getByTestId("cronica-redactor")).toHaveCount(0);
  await expect(page.getByTestId("cronica-arena-cabecera")).toContainText("reinicios-v11");
  await page.getByTestId("arena-cronica").click();
  await expect(page.getByTestId("sentence").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("cronica-redactor")).toContainText("Rehearsal fixture");
  await expect(page.getByTestId("sentence-text").filter({ hasText: "from the penalty spot" })).toHaveCount(1);
  expect(errores).toEqual([]);
});

test("B8 · en /arena/cronica/<h>: una barra (Arena · Tournament), sin sección actual, dataset en el pie y ?lang=es tras ES", async ({ page, request }) => {
  const h = await cronicaDuelo(request);
  await page.goto(`/arena/cronica/${h}`);
  await expect(page.getByRole("banner")).toHaveCount(1);
  const nav = page.getByRole("banner").getByRole("navigation");
  const enlaces = async () => nav.getByRole("link").evaluateAll(as => as.map(a => [(a.textContent ?? "").trim(), a.getAttribute("href"), a.getAttribute("aria-current")]));
  expect(await enlaces()).toEqual([["Arena", "/arena", null], ["Tournament", "/arena/torneo", null]]);
  await expect(page.getByRole("banner").locator("a.brand")).toHaveAttribute("href", "/arena");
  await expect(page.getByTestId("site-footer").getByTestId("dataset-link")).toHaveAttribute("href", "/datos");
  await page.getByRole("banner").getByRole("button", { name: "Switch to Spanish" }).click();
  expect(await enlaces()).toEqual([["Arena", "/arena?lang=es", null], ["Torneo", "/arena/torneo?lang=es", null]]);
  await expect(page.getByRole("banner").locator("a.brand")).toHaveAttribute("href", "/arena?lang=es");
  await expect(page.getByTestId("dataset-link")).toHaveText("Dataset sintético");
});

for (const tema of ["light", "dark"] as const) for (const ancho of [1440, 360]) {
  test(`§ 8.3 · contraste por estilos calculados (${tema}, ${ancho} px): texto ≥ ${IDENTIDAD_ARENA.minTexto}, foco ≥ ${IDENTIDAD_ARENA.minGrafico}`, async ({ browser, request }) => {
    const h = await cronicaDuelo(request);
    const ctx = await browser.newContext({ colorScheme: tema, viewport: { width: ancho, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`/arena/cronica/${h}`);
    await page.locator('[data-testid="sentence"]:not([data-event-ids=""])').first().click();
    await expect(page.locator('[data-testid="timeline-event"][data-highlighted="true"]').first()).toBeVisible();
    const medir = () => page.evaluate(() => {
      const fondo = (e: Element) => { for (let x: Element | null = e; x; x = x.parentElement) { const b = getComputedStyle(x).backgroundColor; if (b && !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(b)) return b; } return getComputedStyle(document.body).backgroundColor; };
      const sel = ['[data-testid="sentence-text"]', '[data-selected="true"] [data-testid="sentence-text"]', '[data-testid="sentence-fact"]', '[data-testid="timeline-event"][data-highlighted="true"]', '[data-testid="timeline-event"]', ".arena-cronica-reloj", '[data-testid="cronica-redactor"]', '[data-testid="verify-bar"]', ".verify-item", ".chronicle-title", ".arena-cronica-marcador", ".arena-cronica-datos", ".arena-cronica-linea h2", '[data-testid="process-view"] .rule', '[data-testid="process-view"] .process-sentence'];
      return sel.flatMap(s => [...document.querySelectorAll(s)].slice(0, 3).map(e => ({ s, color: getComputedStyle(e).color, fondo: fondo(e) })));
    });
    const antes = await medir();
    await page.getByTestId("open-process").click();
    await expect(page.getByTestId("process-view")).toBeVisible();
    const pares = [...antes, ...(await medir()).filter(p => p.s.startsWith('[data-testid="process-view"]'))];
    expect(pares.length).toBeGreaterThan(12);
    expect(pares.some(p => p.s.startsWith('[data-testid="process-view"] .rule'))).toBe(true);
    for (const p of pares) expect(contrasteWcag(hex(p.color), hex(p.fondo)), `${p.s} ${p.color} / ${p.fondo}`).toBeGreaterThanOrEqual(IDENTIDAD_ARENA.minTexto);
    await page.getByTestId("process-view").getByRole("button", { name: "Close" }).click();
    // Foco con el teclado (Tab) sobre una frase: anillo visible con contraste gráfico.
    const frase = page.getByTestId("sentence").first();
    await page.getByRole("heading", { level: 1 }).click();
    for (let i = 0; i < 40 && !(await frase.evaluate(e => e === document.activeElement)); i++) await page.keyboard.press("Tab");
    await expect(frase).toBeFocused();
    const anillo = await frase.evaluate(e => { const s = getComputedStyle(e); let b = "rgb(255, 255, 255)"; for (let x: Element | null = e.parentElement; x; x = x.parentElement) { const c = getComputedStyle(x).backgroundColor; if (!/rgba\(\d+, \d+, \d+, 0\)/.test(c)) { b = c; break; } } return { estilo: s.outlineStyle, color: s.outlineColor, fondo: b }; });
    expect(anillo.estilo).not.toBe("none");
    expect(contrasteWcag(hex(anillo.color), hex(anillo.fondo))).toBeGreaterThanOrEqual(IDENTIDAD_ARENA.minGrafico);
    await ctx.close();
  });
}

// Producción (rev. 0000056) · A ≥ 1100 px la rejilla del héroe de la arena (.arena-intro) mandaba todos los párrafos de
// la cabecera a la misma celda: marcador, quién jugó y reglas se dibujaban unos encima de otros. Cada hijo de la
// cabecera ocupa su propia franja, dentro de la tarjeta y sin desbordarla, en 1440 y 360, claro y oscuro.
for (const tema of ["light", "dark"] as const) for (const ancho of [1440, 1100, 360]) {
  test(`B9 · cabecera sin solapes ni desborde (${tema}, ${ancho} px)`, async ({ browser, request }) => {
    const h = await cronicaDuelo(request);
    const ctx = await browser.newContext({ colorScheme: tema, viewport: { width: ancho, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`/arena/cronica/${h}`);
    const cabecera = page.getByTestId("cronica-arena-cabecera");
    await expect(cabecera).toBeVisible();
    const medida = await cabecera.evaluate(c => {
      const caja = (e: Element) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, d: r.right, b: r.bottom, nombre: e.getAttribute("data-testid") ?? e.className }; };
      // scrollHeight/scrollWidth no sirven: los adornos absolutos (::before/::after) del héroe se salen a propósito.
      return { cabecera: caja(c), hijos: [...c.children].map(caja) };
    });
    expect(medida.hijos.length).toBeGreaterThanOrEqual(4);
    const t = 1;
    for (const a of medida.hijos) {
      expect(a.x, a.nombre).toBeGreaterThanOrEqual(medida.cabecera.x - t);
      expect(a.d, a.nombre).toBeLessThanOrEqual(medida.cabecera.d + t);
      expect(a.y, a.nombre).toBeGreaterThanOrEqual(medida.cabecera.y - t);
      expect(a.b, a.nombre).toBeLessThanOrEqual(medida.cabecera.b + t);
    }
    for (let i = 0; i < medida.hijos.length; i++) for (let j = i + 1; j < medida.hijos.length; j++) {
      const a = medida.hijos[i]!, b = medida.hijos[j]!;
      const corta = a.x < b.d - t && b.x < a.d - t && a.y < b.b - t && b.y < a.b - t;
      expect(corta, `${a.nombre} ⟂ ${b.nombre}`).toBe(false);
    }
    await ctx.close();
  });
}
