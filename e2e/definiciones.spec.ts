// Brief 020 — definiciones con alma y autogoles en la UI. Los goles los fija
// src/vista/__tests__/definiciones.test.ts: la chilena de la semilla 116 (e094), el gol de media
// cancha de la semilla 246 (e050, la portada) y el autogol del partido de liga 2/2.
import { expect, type Page, test } from "@playwright/test";

async function abrirGol(page: Page, eventoId: string) {
  const gol = page.locator(`[data-testid="timeline-event"][data-event-id="${eventoId}"]`);
  await gol.scrollIntoViewIfNeeded();
  await gol.click();
  const tarjeta = page.getByTestId("goal-card");
  await expect(tarjeta).toBeVisible();
  return tarjeta;
}

test("la chilena: rótulo en el paso y en la pizarra, con su zona y su distancia", async ({ page }) => {
  await page.goto("/match/116");
  const tarjeta = await abrirGol(page, "e094");
  await expect(tarjeta.getByTestId("goal-step").filter({ hasText: "Shot" })).toContainText("Bicycle kick! · six-yard box");
  const pizarra = tarjeta.getByTestId("pitch-diagram");
  await expect(pizarra).toHaveAttribute("data-definicion", "chilena");
  await expect(tarjeta.getByTestId("pitch-zona")).toContainText("Bicycle kick!");
});

test("media cancha (la portada, 246): la pizarra llega al medio campo y el balón recorre su distancia real hasta el palo", async ({ page }) => {
  await page.goto("/match/246");
  const tarjeta = await abrirGol(page, "e050");
  const pizarra = tarjeta.getByTestId("pitch-diagram");
  await expect(pizarra).toHaveAttribute("data-definicion", "media_cancha");
  await expect(pizarra).toHaveAttribute("viewBox", "0 0 100 76");
  await expect(pizarra).toHaveAttribute("data-anim", "terminada", { timeout: 6000 });
  await expect(tarjeta.getByTestId("pitch-zona")).toContainText("From the halfway line!");
  await expect(tarjeta.getByTestId("goal-step").filter({ hasText: "Shot" })).toContainText(/From the halfway line! · \d{2} m/);
});

test("autogol de liga (2/2): la línea dice «Own goal», la crónica lo narra en propia puerta y la pizarra marca al autor", async ({ page }) => {
  await page.goto("/liga/2/2");
  const ev = page.locator('[data-testid="timeline-event"][data-tipo="gol"]', { hasText: "Own goal" });
  await expect(ev).toHaveCount(1);
  await expect(page.getByTestId("sentence").filter({ hasText: "own goal" })).toHaveCount(1);
  const id = (await ev.getAttribute("data-event-id")) ?? "";
  const tarjeta = await abrirGol(page, id);
  await expect(tarjeta.locator("#gol-titulo")).toContainText("(own goal)");
  await expect(tarjeta.getByTestId("pitch-diagram")).toHaveAttribute("data-autogol", "true");
  await expect(tarjeta.getByTestId("pitch-autor")).toBeVisible({ timeout: 6000 });
});
