// Brief 024 — la alineación (panel de Ratings de un partido de liga) muestra el nivel de cada
// jugador, rotulado como atributo generado; un partido suelto por semilla no muestra niveles.
import { expect, test } from "@playwright/test";

test("partido de liga: cada jugador valorado muestra «Level N» con el rótulo de atributo generado; el suelto no", async ({ page }) => {
  await page.goto("/liga/5/2");
  const panel = page.getByTestId("ratings-panel");
  await expect(panel.getByTestId("level-note")).toContainText("generated attribute");
  const niveles = panel.getByTestId("player-level");
  const filas = panel.getByTestId("rating");
  expect(await niveles.count()).toBe(await filas.count());
  const n = Number(await niveles.first().getAttribute("data-nivel"));
  expect(n).toBeGreaterThanOrEqual(1);
  expect(n).toBeLessThanOrEqual(100);
  await expect(niveles.first()).toContainText(`Level ${n}`);
  await page.goto("/match/246");
  await expect(page.getByTestId("ratings-panel")).toBeVisible();
  await expect(page.getByTestId("player-level")).toHaveCount(0);
});
