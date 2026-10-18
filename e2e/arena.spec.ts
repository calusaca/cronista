import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("arena: 22 jugadores, movimiento, pausa y selección temporal", async ({ page }) => {
  const errores: string[] = [];
  page.on("pageerror", e => errores.push(e.message));
  await page.goto("/arena");
  await expect(page.getByTestId("arena-player")).toHaveCount(22);
  const jugador = page.locator('[data-player="local-5"]');
  const antes = await jugador.getAttribute("transform");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(() => jugador.getAttribute("transform")).not.toBe(antes);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const pausado = await jugador.getAttribute("transform");
  await page.waitForTimeout(200);
  expect(await jugador.getAttribute("transform")).toBe(pausado);
  await page.getByRole("slider", { name: "Match time" }).press("End");
  await expect(page.getByTestId("arena-clock")).toHaveText("1:00 / 1:00");
  await expect(page.getByRole("region", { name: "Event narration" })).toContainText(/attempts|receives|intercepts|Goal|shot|restart|offside|control/);
  expect(errores).toEqual([]);
});
test("arena: espera visible, una petición y controles deshabilitados", async ({ page }) => {
  await page.goto("/arena");
  await page.getByLabel("Home formation").selectOption("4-4-2");
  let liberar!: () => void, peticiones = 0;
  const barrera = new Promise<void>(r => { liberar = r; });
  await page.route("**/api/arena", async route => { peticiones++; await barrera; await route.continue(); });
  try {
    await page.getByRole("button", { name: "Run programmed teams" }).click();
    await expect(page.getByTestId("match-loading")).toContainText("Resolving the experiment");
    await expect(page.getByLabel("Home formation")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Run programmed teams" })).toBeDisabled();
    await page.locator(".arena-settings").evaluate((f: HTMLFormElement) => f.requestSubmit());
    await expect.poll(() => peticiones).toBe(1);
  } finally { liberar(); }
  await expect(page.getByTestId("match-loading")).toBeHidden();
  await expect(page.locator(".arena-shape").first()).toContainText("4-4-2");
  expect(peticiones).toBe(1);
});
test("arena: error recuperable, descarga íntegra e importación comprobada", async ({ page }) => {
  await page.goto("/arena");
  await page.route("**/api/arena", route => route.fulfill({ status: 503, body: "error" }), { times: 1 });
  await page.getByRole("button", { name: "Run programmed teams" }).click();
  await expect(page.getByTestId("arena").getByRole("alert")).toContainText("previous run is still available");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByTestId("arena").getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Download run" })).toBeEnabled();
  const descarga = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download run" }).click();
  const archivo = await descarga;
  const datos = await readFile((await archivo.path())!);
  const registro = JSON.parse(datos.toString());
  expect(registro.final.tick).toBe(600);
  expect(registro.rondas.every((r: { decisiones: { local: { tipo: string } } }) => r.decisiones.local.tipo === "programado")).toBe(true);
  await page.getByLabel("Open saved run", { exact: true }).setInputFiles({ name: "arena.json", mimeType: "application/json", buffer: datos });
  await expect(page.getByText("Imported recording:", { exact: false })).toBeVisible();
  registro.final.marcador.local++;
  await page.getByLabel("Open saved run", { exact: true }).setInputFiles({ name: "alterado.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(registro)) });
  await expect(page.getByTestId("arena").getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("arena-player")).toHaveCount(22);
});
test("arena: móvil oscuro, español y movimiento reducido sin desborde", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/arena");
  await page.getByRole("button", { name: "Switch to Spanish" }).click();
  await expect(page.getByRole("heading", { name: "Dos equipos. Una misma cancha." })).toBeVisible();
  await expect(page.getByText("Movimiento reducido: estados discretos.", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  const caja = await page.getByTestId("arena-pitch").boundingBox();
  expect(caja!.x).toBeGreaterThanOrEqual(0); expect(caja!.x + caja!.width).toBeLessThanOrEqual(360);
  await expect(page.getByTestId("arena-player")).toHaveCount(22);
});
test("arena: ejemplo real archivado, dos controladores del mismo modelo y reproducción sin inferencia", async ({ page }) => {
  const externos: string[] = [];
  page.on("request", req => { if (/openai\.azure\.com|services\.ai\.azure\.com/.test(req.url())) externos.push(req.url()); });
  await page.goto("/arena");
  await page.getByRole("button", { name: "Load recorded AI run" }).click();
  await expect(page.getByText("Two independent controllers using the same model deployment.")).toBeVisible();
  await expect(page.getByTestId("arena-clock")).toHaveText("0:00 / 0:10");
  await expect(page.locator(".arena-controller")).toContainText(["azure-openai:gpt-6.1-sol", "azure-openai:gpt-6.1-sol"]);
  await page.getByRole("slider", { name: "Match time" }).press("End");
  await expect(page.getByTestId("arena-clock")).toHaveText("0:10 / 0:10");
  expect(externos).toEqual([]);
});
