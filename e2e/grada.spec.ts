// Brief 026 — la grada en la UI. Semilla 246 (la portada): el rugido del 3' y el olé del 81'
// (16 pases de Juventud Islaverde Sur; lo fija src/vista/__tests__/grada.test.ts por el oráculo).
import { expect, test } from "@playwright/test";

test("vivo: la reacción entra en el ticker en su minuto, rotulada; clic ⇒ su evidencia resaltada (el rugido marca su gol; el olé, su racha)", async ({ page }) => {
  await page.goto("/match/246");
  await page.getByTestId("watch-live").click();
  await page.locator('[data-testid="replay-speed"] [data-speed="x5"]').click();

  // El rugido del primer gol: rotulado como derivado, sin clarividencia (su minuto ≤ el reloj).
  const rugido = page.locator('[data-testid="ticker-reaccion"][data-tipo="rugido"]').first();
  await expect(rugido).toBeVisible({ timeout: 20_000 });
  await expect(rugido).toContainText("derived from match data");
  const reloj = Number(await page.getByTestId("replay-clock").getAttribute("data-minuto"));
  expect(Number(await rugido.getAttribute("data-minuto"))).toBeLessThanOrEqual(reloj);

  // El olé llega cuando su racha ya se jugó.
  const ole = page.locator('[data-testid="ticker-reaccion"][data-tipo="ole"]').first();
  await expect(ole).toBeVisible({ timeout: 40_000 });
  await page.locator('[data-testid="replay-speed"] [data-speed="pausa"]').click();
  expect(Number(await ole.getAttribute("data-minuto"))).toBeLessThanOrEqual(Number(await page.getByTestId("replay-clock").getAttribute("data-minuto")));
  await expect(ole).toContainText("passes in a row");
  await ole.click();
  const cajon = page.getByTestId("crowd-evidence");
  await expect(cajon).toBeVisible();
  await expect(cajon).toHaveAttribute("data-tipo", "ole");
  await expect(cajon.locator('[data-testid="pbp-line"][data-citado="true"]')).toHaveCount(16);
  await page.keyboard.press("Escape");
  await expect(cajon).toHaveCount(0);

  // El rugido: su gol resaltado en la línea de tiempo y en el cajón.
  await rugido.click();
  await expect(cajon).toHaveAttribute("data-tipo", "rugido");
  const gol = cajon.getByTestId("crowd-event");
  await expect(gol).toHaveCount(1);
  const id = (await gol.getAttribute("data-id")) ?? "";
  await expect(page.locator(`[data-testid="timeline-event"][data-event-id="${id}"]`)).toHaveAttribute("data-highlighted", "true");
});

test("vista normal: bloque «Crowd» en stats, rotulado; el olé abre su racha resaltada", async ({ page }) => {
  await page.goto("/match/246");
  const bloque = page.getByTestId("stats-crowd");
  await bloque.scrollIntoViewIfNeeded();
  await expect(bloque).toContainText("derived from match data");
  const ole = bloque.locator('[data-testid="stat-reaccion"][data-tipo="ole"]');
  await expect(ole).toHaveCount(1);
  await ole.click();
  await expect(page.getByTestId("crowd-evidence").locator('[data-testid="pbp-line"][data-citado="true"]')).toHaveCount(16);
});
