// Brief 057 (v1.2) · Bloques B1 y B2: el gol en la cancha (vuelo previo, balón en la red con los 22 quietos,
// corte al estado registrado) y la vista frontal del arco. Ejemplo público `arena-llm-v3.json` (dos goles:
// g1 en el arco izquierdo, g2 en el derecho; sin reglas de reinicio) cargado como en arena-canto-gol.spec.ts;
// el cursor se mueve con el deslizador. Ninguna cifra de GOL_VISUAL ni CANTO_GOL se repite a mano.
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { EstadoArena, EventoArena, RegistroArena } from "../src/arena/tipos";
import { estadoVisual } from "../src/arena/vista";
import { ARENA, CANTO_GOL, GOL_VISUAL, IDENTIDAD_ARENA } from "../src/sim/limites";

const EVIDENCIA = "docs/evidencia/play-narrado-057";
const ejemplo = JSON.parse(await readFile("public/experimentos/arena-llm-v3.json", "utf8")) as RegistroArena;
const [g1, g2] = ejemplo.eventos.filter(e => e.tipo === "gol") as [EventoArena, EventoArena];
const previo = (g: EventoArena): EstadoArena => [...ejemplo.fotogramas].reverse().find(f => f.tick < g.tick)!;
const balon = (page: Page) => page.getByTestId("arena-ball");
const num = async (page: Page, attr: "cx" | "cy") => Number(await balon(page).getAttribute(attr));

async function cargarEjemplo(page: Page) {
  await page.goto("/arena");
  await page.getByRole("button", { name: "Saved matches", exact: true }).click();
  const respuesta = page.waitForResponse(r => new URL(r.url()).pathname === "/api/arena" && r.request().method() === "POST");
  await page.getByRole("button", { name: "Load AI coaches example", exact: true }).click();
  expect((await respuesta).ok()).toBe(true);
  await expect(page.locator(".arena-score")).toContainText(ejemplo.config.partido.visita.nombre);
}
const cursor = async (page: Page, segundos: number) => { await page.getByRole("slider", { name: "Match time" }).fill(String(Math.round(segundos * 10) / 10)); };
/** Posiciones (atributo transform) de las fichas visibles, por id. */
const fichas = (page: Page) => page.getByTestId("arena-player").evaluateAll(els => els.map(el => {
  const m = /translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)/.exec(el.getAttribute("transform") ?? "")!;
  return { id: el.getAttribute("data-player")!, x: Number(m[1]), y: Number(m[2]) };
}));

test("B1 · los dos goles del ejemplo: vuelo hasta el cruce, balón en la red con los 22 quietos, sin «Saque» durante la red y corte al estado registrado", async ({ page }) => {
  const errores: string[] = []; page.on("pageerror", e => errores.push(e.message));
  await cargarEjemplo(page);
  for (const [g, arco] of [[g1, "izquierdo"], [g2, "derecho"]] as const) {
    const A = previo(g), s = g.hasta.x >= ARENA.largoM / 2 ? 1 : -1;
    // Último hueco antes del gol: vuelo recto desde la última posición registrada hacia el punto de cruce.
    await cursor(page, g.tick / 10 - 0.2);
    await expect(balon(page)).toHaveAttribute("data-reconstruccion", "vuelo");
    const cx = await num(page, "cx");
    expect(cx, arco).toBeGreaterThanOrEqual(Math.min(A.balon.posicion.x, g.hasta.x) - 1e-9);
    expect(cx, arco).toBeLessThanOrEqual(Math.max(A.balon.posicion.x, g.hasta.x) + 1e-9);
    // En el tick del gol: en la línea, a la altura lateral del cruce.
    await cursor(page, g.tick / 10);
    await expect(balon(page)).toHaveAttribute("data-reconstruccion", "red");
    expect(await num(page, "cy")).toBeCloseTo(g.hasta.y, 6);
    // A mitad de enRedS: dentro de la red (fuera de la cancha hacia el arco batido), los 22 en el fotograma previo.
    await cursor(page, g.tick / 10 + GOL_VISUAL.enRedS / 2);
    await expect(balon(page)).toHaveAttribute("data-reconstruccion", "red");
    const dentro = await num(page, "cx");
    if (s > 0) expect(dentro, arco).toBeGreaterThan(ARENA.largoM); else expect(dentro, arco).toBeLessThan(0);
    const vistas = await fichas(page);
    expect(vistas).toHaveLength(22);
    for (const j of A.jugadores) { const f = vistas.find(v => v.id === j.id)!; expect(f.x).toBeCloseTo(j.posicion.x, 6); expect(f.y).toBeCloseTo(j.posicion.y, 6); }
    await expect(page.getByTestId("arena-restart")).toHaveCount(0);
    // B2 · vista frontal del arco batido, del lado correcto, con la altura rotulada como ilustrativa.
    const recuadro = page.getByTestId("arena-goal-view");
    await expect(recuadro).toHaveAttribute("data-arco", s > 0 ? "visita" : "local");
    await expect(recuadro).toHaveAttribute("data-altura", /^(raso|media|alta)$/);
    await expect(recuadro).toHaveAttribute("data-lado", g.lado);
    await expect(recuadro.locator("figcaption")).toContainText("illustrative");
    await expect(recuadro.locator("figcaption")).toContainText(ejemplo.config.partido[s > 0 ? "visita" : "local"].nombre);
    expect(await recuadro.locator(".arena-goal-view-ball").evaluate(el => getComputedStyle(el).animationName)).toBe("none");
    await page.locator(".arena-board").screenshot({ path: `${EVIDENCIA}/gol-red-recuadro-${arco}-1440-claro.png` });
    // Al cumplirse enRedS: corte al estado registrado (sin reglas: el balón del fotograma, no el centro).
    await cursor(page, g.tick / 10 + GOL_VISUAL.enRedS);
    await expect(balon(page)).not.toHaveAttribute("data-reconstruccion");
    const registrado = estadoVisual(ejemplo, g.tick * ARENA.pasoS + GOL_VISUAL.enRedS).balon.posicion;
    expect(await num(page, "cx")).toBeCloseTo(registrado.x, 6);
    expect(await num(page, "cy")).toBeCloseTo(registrado.y, 6);
    // El recuadro sigue la celebración del 050 y desaparece a los celebracionS.
    await expect(page.getByTestId("arena-goal-view")).toHaveCount(1);
    // (g2 cae a menos de celebracionS del final: su celebración dura hasta el último instante del registro.)
    if (g.tick * ARENA.pasoS + CANTO_GOL.celebracionS <= ejemplo.final.tick * ARENA.pasoS) {
      await cursor(page, g.tick / 10 + CANTO_GOL.celebracionS);
      await expect(page.getByTestId("arena-goal-view")).toHaveCount(0);
    }
  }
  // Estilos calculados en fase red: fichas, balón y árbitro sin animation, transition ni transform de CSS (047).
  await cursor(page, g2.tick / 10 + GOL_VISUAL.enRedS / 2);
  for (const sel of [".arena-player", ".arena-ball", ".arena-referee"]) {
    const s = await page.locator(sel).first().evaluate(el => {
      const c = getComputedStyle(el), m = /translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)/.exec(el.getAttribute("transform") ?? "");
      const atributo = m ? `matrix(1, 0, 0, 1, ${Number(m[1])}, ${Number(m[2])})` : "none";
      const css = c.transform === "none" ? "none" : c.transform.replace(/[-\d.e]+(?=[,)])/g, x => String(Math.round(Number(x) * 1e4) / 1e4));
      return { animacion: c.animationName, transicion: `${c.transitionProperty} ${c.transitionDuration}`, transform: css === atributo.replace(/[-\d.e]+(?=[,)])/g, x => String(Math.round(Number(x) * 1e4) / 1e4)) ? "atributo" : css };
    });
    expect(s, sel).toEqual({ animacion: "none", transicion: "all 0s", transform: "atributo" });
  }
  // El texto de ayuda lleva el rótulo de reconstrucción.
  await expect(page.getByText("After a goal the ball is drawn reaching the net", { exact: false })).toBeVisible();
  expect(errores).toEqual([]);
});

test("B1 · movimiento reducido: no hay vuelo previo y la red aparece ya en su profundidad", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await cargarEjemplo(page);
  await cursor(page, g1.tick / 10 - 0.2);
  await expect(balon(page)).not.toHaveAttribute("data-reconstruccion", "vuelo");
  await cursor(page, g1.tick / 10);
  await expect(balon(page)).toHaveAttribute("data-reconstruccion", "red");
  expect(await num(page, "cx")).toBeCloseTo(g1.hasta.x - GOL_VISUAL.profundidadRedM, 6);
  expect(await page.getByTestId("arena-goal-view").evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  await ctx.close();
});

test("B2 · 360 px (oscuro, reducido) y 1440 px (oscuro): recuadro sin desborde; capturas", async ({ browser }) => {
  for (const [ancho, tema, reducido] of [[360, "dark", true], [360, "light", false], [1440, "dark", false]] as const) {
    const ctx = await browser.newContext({ viewport: { width: ancho, height: ancho === 360 ? 780 : 900 }, colorScheme: tema, reducedMotion: reducido ? "reduce" : "no-preference" });
    const page = await ctx.newPage();
    await cargarEjemplo(page);
    await cursor(page, g2.tick / 10 + GOL_VISUAL.enRedS / 2);
    const recuadro = page.getByTestId("arena-goal-view");
    await expect(recuadro).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ancho);
    const caja = (await recuadro.boundingBox())!, cancha = (await page.locator(".arena-pitch-wrap").boundingBox())!;
    expect(caja.x).toBeGreaterThanOrEqual(cancha.x - 0.5); expect(caja.x + caja.width).toBeLessThanOrEqual(cancha.x + cancha.width + 0.5);
    if (reducido) expect(await recuadro.evaluate(el => getComputedStyle(el).animationName)).toBe("none");
    await page.locator(".arena-board").screenshot({ path: `${EVIDENCIA}/gol-recuadro-${ancho}-${tema === "dark" ? "oscuro" : "claro"}${reducido ? "-reducido" : ""}.png` });
    await ctx.close();
  }
});

test("B1 · con reglas (fixture reinicios-v5 importado): sin «Kick-off» mientras el balón está en la red; al cumplirse enRedS, centro y «Kick-off» (M11)", async ({ page }) => {
  const datos = await readFile("src/arena/__fixtures__/arena-reinicios-v5.json");
  const v5 = JSON.parse(datos.toString("utf8")) as RegistroArena, g = v5.eventos.find(e => e.tipo === "gol")!;
  await page.goto("/arena");
  await page.getByRole("button", { name: "Saved matches", exact: true }).click();
  const importada = page.waitForResponse(r => new URL(r.url()).pathname === "/api/arena" && r.request().method() === "POST");
  await page.getByLabel("Open saved run", { exact: true }).setInputFiles({ name: "arena-reinicios-v5.json", mimeType: "application/json", buffer: datos });
  expect((await importada).ok()).toBe(true);
  await expect(page.locator(".arena-score")).toContainText(v5.config.partido.local.nombre);
  await cursor(page, g.tick / 10 + GOL_VISUAL.enRedS / 2);
  await expect(balon(page)).toHaveAttribute("data-reconstruccion", "red");
  await expect(page.getByTestId("arena-restart")).toHaveCount(0);
  await cursor(page, g.tick / 10 + GOL_VISUAL.enRedS);
  await expect(page.getByTestId("arena-restart")).toContainText("Kick-off");
  await expect(balon(page)).toHaveAttribute("cx", String(ARENA.largoM / 2));
  await expect(balon(page)).toHaveAttribute("cy", String(ARENA.anchoM / 2));
  await expect(balon(page)).not.toHaveAttribute("data-reconstruccion");
});

test("regresión · el escudo del rótulo de gol mide su tamaño (no el ancho de la cancha) y la cancha sigue ocupando todo .arena-pitch-wrap", async ({ browser }) => {
  for (const ancho of [1440, 360]) {
    const ctx = await browser.newContext({ viewport: { width: ancho, height: ancho === 360 ? 780 : 900 } });
    const page = await ctx.newPage();
    await cargarEjemplo(page);
    await cursor(page, g1.tick / 10 + GOL_VISUAL.enRedS / 2);
    const escudo = page.locator(".arena-goal-banner .arena-crest");
    await expect(escudo).toBeVisible();
    expect((await escudo.boundingBox())!.width, `${ancho} px`).toBeLessThanOrEqual(IDENTIDAD_ARENA.escudoPx.rotuloGol + 2);
    const cancha = (await page.getByTestId("arena-pitch").boundingBox())!, envoltura = await page.locator(".arena-pitch-wrap").evaluate(el => el.clientWidth);
    expect(Math.abs(cancha.width - envoltura), `${ancho} px`).toBeLessThanOrEqual(1);
    // La vista del arco tiene su propia regla de tamaño: cabe en su figure.
    const vista = (await page.getByTestId("arena-goal-view").boundingBox())!, svgVista = (await page.locator(".arena-goal-view svg").boundingBox())!;
    expect(svgVista.width).toBeLessThanOrEqual(vista.width);
    await ctx.close();
  }
});
