// Brief 011 §3 — «Random match»: navega a un partido válido (semilla 1..99999), y a 360 px
// la barra superior no desborda.
import { expect, test } from "@playwright/test";

test("Random match navega a un partido válido distinto de la portada", async ({ page }) => {
  await page.goto("/cronicas");
  const boton = page.getByTestId("random-match");
  await expect(boton).toBeVisible();
  await expect(boton).toContainText("Random match");
  await boton.click();
  await page.waitForURL(/\/match\/\d+$/);
  const seed = Number(new URL(page.url()).pathname.split("/").pop());
  expect(seed).toBeGreaterThanOrEqual(1);
  expect(seed).toBeLessThanOrEqual(99999);
  const vista = page.getByTestId("match-view");
  await expect(vista).toBeVisible();
  await expect(vista).toHaveAttribute("data-seed", String(seed));
  await expect(page.getByTestId("final-score")).toBeVisible();
});

test("a 360 px la barra superior con Random match no desborda", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const page = await ctx.newPage();
  await page.goto("/match/246");
  await expect(page.getByTestId("random-match")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await ctx.close();
});
