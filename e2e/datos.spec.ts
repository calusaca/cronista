// Brief 028 §3 — /datos: la página carga desde la barra, la descarga de la muestra está y es la del
// repo, las cifras visibles son las de ficha.json (que escribe el CLI) y a 360 px no desborda.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const ficha = JSON.parse(readFileSync(join(process.cwd(), "docs", "dataset", "ficha.json"), "utf8")) as {
  partidos: number;
  microPorPartido: number;
  bandasCorrida: { enBanda: number; total: number };
  experimentos: { enBanda: number; total: number };
  muestra: { archivo: string; semillas: number[] };
};
const miles = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

test("barra → Data → cifras de la corrida, descarga de la muestra real, el DATASHEET; y a 360 px sin desborde", async ({ page, request, browser }) => {
  await page.goto("/cronicas");
  await page.getByTestId("data-link").click();
  await expect(page).toHaveURL(/\/datos$/);
  await expect(page.getByTestId("data-page")).toContainText("The CRONISTA match dataset");

  // Las cifras de cabecera son las de ficha.json (atributo y texto visible).
  const cifra = (clave: string) => page.locator(`[data-testid="data-figure"][data-clave="${clave}"]`);
  await expect(cifra("partidos")).toHaveAttribute("data-valor", String(ficha.partidos));
  await expect(cifra("partidos").locator(".datos-num")).toHaveText(miles(ficha.partidos));
  await expect(cifra("micro").locator(".datos-num")).toHaveText(miles(ficha.microPorPartido));
  await expect(cifra("bandas").locator(".datos-num")).toHaveText(`${ficha.bandasCorrida.enBanda}/${ficha.bandasCorrida.total}`);
  await expect(cifra("experimentos").locator(".datos-num")).toHaveText(`${ficha.experimentos.enBanda}/${ficha.experimentos.total}`);
  await expect(page.getByTestId("schema-field").first()).toBeVisible();
  await expect(page.getByTestId("data-honesty")).toContainText("Every match is simulated");

  // La descarga: el archivo servido es byte a byte el del repo, una línea por semilla de la muestra.
  const enlace = page.getByTestId("sample-download");
  await expect(enlace).toHaveAttribute("href", `/${ficha.muestra.archivo}`);
  await expect(enlace).toHaveAttribute("download", "");
  const r = await request.get(`/${ficha.muestra.archivo}`);
  expect(r.ok()).toBe(true);
  const cuerpo = await r.text();
  expect(cuerpo).toBe(readFileSync(join(process.cwd(), "public", ficha.muestra.archivo), "utf8"));
  const semillas = cuerpo.split("\n").filter(Boolean).map((l) => (JSON.parse(l) as { config: { seed: number } }).config.seed);
  expect(semillas).toEqual(ficha.muestra.semillas);

  // El DATASHEET servido es el del repo.
  const ds = await request.get((await page.getByTestId("datasheet-link").getAttribute("href")) ?? "");
  expect(ds.ok()).toBe(true);
  expect(ds.headers()["content-type"]).toContain("text/markdown");
  expect(await ds.text()).toBe(readFileSync(join(process.cwd(), "docs", "dataset", "DATASHEET.md"), "utf8"));

  // A 360 px: sin desborde horizontal.
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const chica = await ctx.newPage();
  await chica.goto("/datos");
  await expect(chica.getByTestId("data-figures")).toBeVisible();
  await expect(chica.getByTestId("sample-download")).toBeVisible();
  expect(await chica.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await ctx.close();
});
