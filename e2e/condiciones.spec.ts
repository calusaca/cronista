// Brief 018 — condiciones: partido de liga con condiciones → chip visible → stat destacada →
// evidencia. Los partidos (2/2 y 9/3 de la liga visible) los fija src/vista/__tests__/condiciones.test.ts.
import { expect, test } from "@playwright/test";

test("2/2: chip de condiciones → efectos destacados → evidencia (desglose y jugada a jugada)", async ({ page }) => {
  await page.goto("/liga/2/2");
  const chip = page.getByTestId("conditions-chip");
  await expect(chip).toBeVisible();
  await expect(chip).toContainText("long natural grass");
  await expect(chip).toContainText("away side under high pressure");
  await expect(page.getByTestId("conditions")).toContainText("only when this match's data measured it");

  const bloque = page.getByTestId("stats-conditions");
  await expect(bloque).toBeVisible();
  const cancha = bloque.locator('[data-testid="stat-efecto"][data-tipo="cancha_incomoda"]');
  await expect(cancha).toHaveAttribute("data-destacado", "true");
  await cancha.click();
  const ev = page.getByTestId("stats-evidence");
  await expect(ev).toBeVisible();
  await expect(ev.getByTestId("stats-desglose")).toContainText("short passes completed");
  await ev.getByRole("button", { name: "Close" }).click();
  await expect(ev).toHaveCount(0);

  const presion = bloque.locator('[data-testid="stat-efecto"][data-tipo="presion_que_ahoga"]');
  await expect(presion).toHaveAttribute("data-destacado", "true");
  await presion.click();
  await expect(page.getByTestId("stats-evidence")).toBeVisible();
  const citadas = page.locator('[data-testid="pbp-line"][data-citado="true"]');
  expect(await citadas.count()).toBeGreaterThanOrEqual(1);
  await expect(citadas.first()).toContainText("loses the ball playing out");
});

test("9/3: con calor, el chip dice la temperatura y el efecto del calor queda destacado", async ({ page }) => {
  await page.goto("/liga/9/3");
  await expect(page.getByTestId("conditions-chip")).toContainText("°C");
  await expect(page.getByTestId("conditions-chip")).toHaveAttribute("data-clima", "calor");
  const calor = page.locator('[data-testid="stat-efecto"][data-tipo="efecto_calor"]');
  await expect(calor).toHaveAttribute("data-destacado", "true");
  await calor.click();
  await expect(page.getByTestId("stats-desglose")).toContainText("Passes, 2nd half");
});

test("en el replay las condiciones se ven desde el 0'; un partido suelto no tiene condiciones", async ({ page }) => {
  await page.goto("/liga/2/2");
  await page.getByTestId("watch-live").click();
  await expect(page.getByTestId("replay-badge")).toHaveText("Replay");
  await expect(page.getByTestId("conditions-chip")).toBeVisible();
  await page.goto("/match/246");
  await expect(page.getByTestId("match-view")).toBeVisible();
  await expect(page.getByTestId("conditions-chip")).toHaveCount(0);
  await expect(page.getByTestId("stats-conditions")).toHaveCount(0);
});

test("a 360 px: el chip y el bloque de condiciones no desbordan", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const page = await ctx.newPage();
  await page.goto("/liga/2/2");
  await expect(page.getByTestId("conditions-chip")).toBeVisible();
  await expect(page.getByTestId("stats-conditions")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await ctx.close();
});
