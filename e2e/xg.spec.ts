// Brief 017 — xG en cristiano: la vista Aficionado lee «35% chance» / «35 % de gol» en todo el
// chrome (línea de tiempo, pizarra, relato, desglose, stats); Analista conserva «xG 0.35»; el
// dato crudo queda en data-xg; a 360 px nada desborda.
import { expect, type Page, test } from "@playwright/test";

const tiro = (page: Page) => page.locator('[data-testid="timeline-event"][data-tipo="tiro"]').first();

async function textoTiro(page: Page) {
  const t = tiro(page);
  const xg = Number(await t.getAttribute("data-xg"));
  return { xg, texto: (await t.textContent()) ?? "" };
}

test("Aficionado: % de gol en la línea, la pizarra, el relato y el panel; Analista: xG", async ({ page }) => {
  await page.goto("/match/246");
  await expect(page.getByTestId("sentence").first()).toBeVisible();
  await expect(page.getByTestId("mode-toggle").locator('[data-mode="aficionado"]')).toHaveAttribute("aria-pressed", "true");

  // Línea de tiempo (EN por defecto): el % sale del crudo de data-xg, sin «xG».
  const en = await textoTiro(page);
  expect(en.xg).toBeGreaterThan(0);
  expect(en.texto).toContain(`${Math.round(en.xg * 100)}% chance`);
  expect(await page.getByTestId("timeline").textContent()).not.toMatch(/xG/);

  // Panel de stats: explicador de una línea y relato sin «xG».
  const panel = page.getByTestId("stats-panel");
  await expect(panel.getByTestId("xg-explica")).toContainText("% chance: how likely");
  await panel.getByTestId("stat-duelo").first().click();
  await expect(page.getByTestId("stats-evidence")).toBeVisible();
  expect(await page.getByTestId("stats-evidence").textContent()).not.toMatch(/xG/);
  await page.keyboard.press("Escape");

  // Pizarra del gol: rótulo, pasos y pie sin «xG», con el explicador.
  const gol = page.locator('[data-testid="timeline-event"][data-tipo="gol"]').first();
  await gol.scrollIntoViewIfNeeded();
  await gol.click();
  const tarjeta = page.getByTestId("goal-card");
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta.getByTestId("pitch-diagram")).toHaveAttribute("data-anim", "terminada", { timeout: 6000 });
  await expect(tarjeta.getByTestId("pitch-zona")).toContainText("% chance");
  await expect(tarjeta.getByTestId("goal-step").filter({ hasText: "Shot" })).toContainText("% chance");
  await expect(tarjeta.getByTestId("xg-explica")).toBeVisible();
  expect(await tarjeta.textContent()).not.toMatch(/xG/);
  await tarjeta.getByRole("button", { name: "Close" }).click();

  // Desglose de una valoración (abierto por selección en Aficionado): sin «xG».
  const fig = page.locator('[data-testid="rating"][data-figura="true"]');
  await fig.scrollIntoViewIfNeeded();
  await fig.click();
  const desglose = page.getByTestId("rating-breakdown");
  await expect(desglose).toHaveCount(1);
  await expect(desglose).toContainText("% chance");
  expect(await desglose.textContent()).not.toMatch(/xG/);

  // ES: «% de gol».
  await page.getByTestId("lang-toggle").locator('[data-lang="es"]').click();
  const es = await textoTiro(page);
  expect(es.texto).toContain(`${Math.round(es.xg * 100)} % de gol`);
  await expect(panel.getByTestId("xg-explica")).toContainText("% de gol: qué tan probable");

  // Analista: «xG 0.35» de vuelta, sin explicador.
  await page.getByTestId("mode-toggle").locator('[data-mode="analista"]').click();
  const an = await textoTiro(page);
  expect(an.texto).toContain(`xG ${an.xg.toFixed(2)}`);
  await expect(panel.getByTestId("xg-explica")).toHaveCount(0);
});

test("relato del panel con un remate (29, primer duelo): % de gol en Aficionado, xG en Analista", async ({ page }) => {
  // La 29 es la semilla (de 1..40 y los presets) cuyo primer duelo termina en un remate dentro
  // de su evidencia; en la 246 ninguna evidencia del panel llega a un tiro.
  await page.goto("/match/29");
  await expect(page.getByTestId("sentence").first()).toBeVisible();
  const panel = page.getByTestId("stats-panel");
  const cajon = page.getByTestId("stats-evidence");
  await panel.getByTestId("stat-duelo").first().click();
  await expect(cajon).toContainText(/shoots .*\d+% chance/);
  expect(await cajon.textContent()).not.toMatch(/xG/);
  await page.keyboard.press("Escape");
  await page.getByTestId("mode-toggle").locator('[data-mode="analista"]').click();
  await panel.getByTestId("stat-duelo").first().click();
  await expect(cajon).toContainText(/shoots .*xG \d\.\d\d/);
});

test("a 360 px, con el % de gol, la página y la pizarra no desbordan", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const page = await ctx.newPage();
  await page.goto("/match/246");
  await expect(tiro(page)).toContainText("% chance");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.getByTestId("lang-toggle").locator('[data-lang="es"]').click();
  await expect(tiro(page)).toContainText("% de gol");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  const gol = page.locator('[data-testid="timeline-event"][data-tipo="gol"]').first();
  await gol.scrollIntoViewIfNeeded();
  await gol.click();
  await expect(page.getByTestId("pitch-diagram")).toHaveAttribute("data-anim", "terminada", { timeout: 6000 });
  await expect(page.getByTestId("xg-explica").last()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await ctx.close();
});
