// Brief 025 — un insólito en la UI. El caso lo fija src/vista/__tests__/insolitos.test.ts: el doble
// palo de la liga visible, jornada 7, partido 4 (e071, Teo Rosiena). El tiro abre su tarjeta, la
// pizarra dibuja el poste y el rebote al otro, y la línea lo dice.
import { expect, test } from "@playwright/test";

test("doble palo de liga (7/4): la línea lo dice, la tarjeta se abre y la pizarra rebota entre los dos palos", async ({ page }) => {
  await page.goto("/liga/7/4");
  const ev = page.locator('[data-testid="timeline-event"][data-event-id="e071"]');
  await ev.scrollIntoViewIfNeeded();
  await expect(ev).toContainText("hit both posts!");
  await ev.click();
  const tarjeta = page.getByTestId("goal-card");
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta.locator("#gol-titulo")).toContainText("Teo Rosiena · hit both posts");
  const pizarra = tarjeta.getByTestId("pitch-diagram");
  await expect(pizarra).toHaveAttribute("data-palos", "2");
  await expect(pizarra).toHaveAttribute("data-anim", "terminada", { timeout: 6000 });
  await expect(tarjeta.getByTestId("pitch-destino")).toContainText("Both posts!");
});
