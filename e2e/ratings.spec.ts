// Brief 009 — Ratings: panel visible → clic en una nota → desglose con ≥1 evento → esos
// eventos resaltados en la línea de tiempo. Y en el replay, las notas son las del prefijo.
import { expect, type Locator, type Page, test } from "@playwright/test";

async function clicConMouse(page: Page, l: Locator) {
  await l.scrollIntoViewIfNeeded();
  const caja = await l.boundingBox();
  if (!caja) throw new Error("elemento sin caja visible");
  await page.mouse.move(caja.x + caja.width / 2, caja.y + Math.min(caja.height / 2, 14), { steps: 4 });
  await page.mouse.down();
  await page.mouse.up();
}

test("ratings: panel rotulado → clic en la nota de la figura → desglose con eventos → eventos resaltados", async ({ page }) => {
  await page.goto("/match/246");
  const panel = page.getByTestId("ratings-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("computed from match events");

  // Dos plantillas con su nota; exactamente una figura.
  const notas = panel.getByTestId("rating");
  expect(await panel.locator('[data-testid="rating"][data-lado="local"]').count()).toBeGreaterThan(5);
  expect(await panel.locator('[data-testid="rating"][data-lado="visita"]').count()).toBeGreaterThan(5);
  const fig = panel.locator('[data-testid="rating"][data-figura="true"]');
  await expect(fig).toHaveCount(1);
  // La figura del panel es la del hecho que narra la crónica (misma nota).
  const notaFigura = await fig.getAttribute("data-nota");
  expect(Number(notaFigura)).toBe(Math.max(...(await notas.evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-nota")))))));

  // Clic ⇒ desglose con ≥1 evento, y cada evento del desglose resaltado en la línea.
  await clicConMouse(page, fig);
  await expect(fig).toHaveAttribute("data-selected", "true");
  const desglose = panel.getByTestId("rating-breakdown");
  await expect(desglose).toHaveCount(1);
  const ids = await desglose.getByTestId("breakdown-event").evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("data-event-id")))]);
  expect(ids.length).toBeGreaterThanOrEqual(1);
  const resaltados = await page
    .locator('[data-testid="timeline-event"][data-highlighted="true"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-event-id")));
  expect(new Set(resaltados)).toEqual(new Set(ids));

  // Otro clic en la misma nota la cierra.
  await clicConMouse(page, fig);
  await expect(panel.getByTestId("rating-breakdown")).toHaveCount(0);
  await expect(page.locator('[data-testid="timeline-event"][data-highlighted="true"]')).toHaveCount(0);

  // Modo Analista: todos los desgloses abiertos.
  await clicConMouse(page, page.locator('[data-testid="mode-toggle"] [data-mode="analista"]'));
  expect(await panel.getByTestId("rating-breakdown").count()).toBe(await notas.count());
});

test("ratings en el replay: sin figura mientras corre, notas del prefijo; la figura aparece al final", async ({ page }) => {
  await page.goto("/match/246");
  const fig = page.locator('[data-testid="rating"][data-figura="true"]');
  const notaFinal = await fig.getAttribute("data-nota");
  await clicConMouse(page, page.getByTestId("watch-live"));
  await expect(page.getByTestId("ratings-panel")).toContainText("so far");
  await expect(fig).toHaveCount(0);
  // Pausa al rato: ningún evento del desglose de nadie es posterior al reloj.
  await clicConMouse(page, page.locator('[data-testid="replay-speed"] [data-speed="x5"]'));
  await expect.poll(() => page.getByTestId("ticker-update").count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
  await clicConMouse(page, page.locator('[data-testid="replay-speed"] [data-speed="pausa"]'));
  const reloj = Number(await page.getByTestId("replay-clock").getAttribute("data-minuto"));
  await clicConMouse(page, page.locator('[data-testid="rating"]:not([data-nota="6.0"])').first());
  const minutos = await page.getByTestId("timeline-event").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-minuto"))));
  expect(Math.max(...minutos)).toBeLessThanOrEqual(reloj);
  // El desglose de la nota cita solo eventos ya vistos (están en la línea de tiempo del prefijo).
  const visibles = new Set(await page.getByTestId("timeline-event").evaluateAll((els) => els.map((e) => e.getAttribute("data-event-id"))));
  const citados = await page.getByTestId("breakdown-event").evaluateAll((els) => els.map((e) => e.getAttribute("data-event-id")));
  expect(citados.length).toBeGreaterThan(0);
  for (const id of citados) expect(visibles.has(id)).toBe(true);
  // Al final, la figura vuelve y es la misma.
  await clicConMouse(page, page.locator('[data-testid="replay-speed"] [data-speed="x5"]'));
  await expect(page.getByTestId("replay-clock")).toHaveText("FT", { timeout: 40_000 });
  await expect(fig).toHaveCount(1);
  await expect(fig).toHaveAttribute("data-nota", notaFinal as string);
});
