// Brief 019 — la temporada viva en la UI: pestaña Players → top visible → clic en un rating →
// desglose por partido → link a ese partido. Y las bajas: el expulsado de la jornada 2 aparece
// suspendido en la jornada 3 (lista de la pestaña y cabecera del partido 3/1). El caso lo fija
// src/vista/__tests__/consecuencias.test.ts.
import { expect, test } from "@playwright/test";

test("Players: top visible → clic en un rating → desglose → link a un partido", async ({ page }) => {
  await page.goto("/liga");
  await page.getByTestId("tab-players").click();
  await expect(page).toHaveURL(/tab=players/);
  const filas = page.getByTestId("rating-row");
  expect(await filas.count()).toBeGreaterThan(0);
  const primera = filas.first();
  const partidos = Number(await primera.getAttribute("data-partidos"));
  await primera.locator("summary").click();
  const desglose = primera.getByTestId("rating-breakdown");
  await expect(desglose).toBeVisible();
  const links = desglose.getByTestId("rating-match-link");
  await expect(links).toHaveCount(partidos);
  const href = (await links.first().getAttribute("href")) ?? "";
  expect(href).toMatch(/^\/liga\/\d+\/\d+$/);
  await links.first().click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await expect(page.getByTestId("match-view")).toBeVisible();
  await expect(page.getByTestId("ratings-panel")).toBeVisible();
});

test("bajas: el suspendido de la jornada 2 figura en la jornada 3 (lista y cabecera del partido)", async ({ page }) => {
  await page.goto("/liga?tab=players&j=3");
  const suspendidos = page.locator('[data-testid="unavailable-player"][data-motivo="suspension"]');
  expect(await suspendidos.count()).toBeGreaterThanOrEqual(1);
  const nombre = ((await suspendidos.first().locator(".gol-jugador").textContent()) ?? "").trim();
  await page.goto("/liga/3/1");
  const baja = page.locator('[data-testid="baja"][data-motivo="suspension"]');
  await expect(baja).toContainText(nombre);
  await expect(baja).toContainText("suspended");
});

test("a 360 px: la pestaña Players y su desglose no desbordan", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const page = await ctx.newPage();
  await page.goto("/liga?tab=players&j=3");
  await page.getByTestId("rating-row").first().locator("summary").click();
  await expect(page.getByTestId("rating-breakdown").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await ctx.close();
});
