// Brief 027 — sanciones de club en la UI. La liga visible (liga-de-los-valles, temporada 1) sale
// con 0 clubes sancionados en el sorteo (pasa en el 40 % de las liga-temporadas): este e2e cuida
// el camino SIN sanciones (nada que no exista se dibuja). La tabla con asterisco y la cabecera a
// puerta cerrada se ven en el smoke (fiordos T1 / cumbres T2) y las fijan las pruebas de
// src/vista/__tests__/sanciones.test.ts — ver la pregunta abierta del informe del 027.
import { expect, test } from "@playwright/test";

test("liga visible sin sanciones en la temporada: ni asterisco ni leyenda en la tabla, ni chips en la cabecera", async ({ page }) => {
  await page.goto("/liga");
  await expect(page.getByTestId("league-table")).toBeVisible();
  await expect(page.getByTestId("league-deduction")).toHaveCount(0);
  await expect(page.getByTestId("league-deduction-legend")).toHaveCount(0);
  await page.goto("/liga/1/1");
  await expect(page.getByTestId("match-view")).toBeVisible();
  await expect(page.getByTestId("club-sanctions")).toHaveCount(0);
});
