// Retenemos la navegación real: la carga debe verse antes de recibir el partido,
// independientemente de la velocidad del fixture o de que la crónica esté en caché.
import { expect, type Page, test } from "@playwright/test";

async function retenerPartido(page: Page) {
  let liberar!: () => void;
  const espera = new Promise<void>((resolve) => { liberar = resolve; });
  const destinos: string[] = [];
  await page.route("**/match/**", async (route) => {
    if (route.request().headers().rsc !== "1") return route.continue();
    destinos.push(new URL(route.request().url()).pathname);
    await espera;
    await route.continue();
  });
  return { liberar, destinos };
}

for (const accion of ["semilla", "azar", "vacia", "historia"] as const) {
  test(`${accion}: aviso inmediato hasta recibir el partido y sin solicitudes duplicadas`, async ({ page }) => {
    await page.goto(accion === "semilla" ? "/" : "/match/246");
    const seed = page.getByTestId("seed-input");
    if (accion === "semilla") await seed.fill("42");
    if (accion === "vacia") await seed.fill("");
    // Un destino fijo evita que el azar elija la ruta de partida o una ya visitada.
    if (accion === "azar" || accion === "vacia") await page.evaluate(() => { Math.random = () => .42; });
    const peticion = await retenerPartido(page);
    try {
      if (accion === "azar") await page.getByTestId("random-match").click();
      else if (accion === "vacia") await seed.press("Enter");
      else if (accion === "historia") {
        const otra = await page.getByTestId("preset-select").locator('option:not([value=""]):not([value="246"])').first().getAttribute("value");
        await page.getByTestId("preset-select").selectOption(otra!);
      } else await page.getByTestId("simulate").click();

      const aviso = page.getByTestId("match-loading");
      await expect(aviso).toBeVisible({ timeout: 1500 });
      await expect(aviso).toHaveAttribute("role", "status");
      await expect(aviso).toContainText("Preparing your match…");
      await expect(page.getByRole("form", { name: "Simulate a match" })).toHaveAttribute("aria-busy", "true");
      for (const id of ["simulate", "random-match", "seed-input", "preset-select"]) {
        await expect(page.getByTestId(id)).toBeDisabled();
      }
      // El partido anterior sigue visible; incluso un submit programático se ignora.
      await expect(page.getByTestId("match-view")).toHaveAttribute("data-seed", "246");
      await page.getByRole("form", { name: "Simulate a match" }).evaluate((form: HTMLFormElement) => form.requestSubmit());
      await expect.poll(() => peticion.destinos.length).toBe(1);
      await expect(aviso).toBeVisible();
    } finally { peticion.liberar(); }

    await page.waitForURL((url) => url.pathname === peticion.destinos[0]);
    const destino = peticion.destinos[0]!.split("/").pop()!;
    if (accion === "semilla") expect(destino).toBe("42");
    if (accion === "azar" || accion === "vacia") expect(destino).toBe("42000");
    await expect(page.getByTestId("match-view")).toHaveAttribute("data-seed", destino);
    await expect(page.getByTestId("match-loading")).toBeHidden();
    await expect(page.getByTestId("simulate")).toBeEnabled();
    await expect(page.getByTestId("random-match")).toBeEnabled();
    expect(peticion.destinos).toHaveLength(1);
  });
}

test("semilla inválida y misma ruta no dejan la barra en espera", async ({ page }) => {
  await page.goto("/match/246");
  await page.getByTestId("seed-input").fill("abc");
  await page.getByTestId("simulate").click();
  await expect(page.locator('.sim-form [role="alert"]')).toContainText("Seed must be a whole number");
  await expect(page.getByTestId("match-loading")).toBeHidden();
  await expect(page.getByTestId("simulate")).toBeEnabled();
  await page.getByTestId("seed-input").fill("246");
  await page.getByTestId("simulate").click();
  await expect(page.locator('.sim-form [role="alert"]')).toHaveCount(0);
  await expect(page.getByTestId("match-loading")).toBeHidden();
  await expect(page.getByTestId("simulate")).toBeEnabled();
  await expect(page.getByTestId("match-view")).toHaveAttribute("data-seed", "246");
});

test("espera visible en móvil oscuro, sin desborde y con movimiento reducido", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/match/246");
  await page.getByTestId("seed-input").fill("43");
  const peticion = await retenerPartido(page);
  try {
    await page.getByTestId("simulate").click();
    await expect(page.getByTestId("match-loading")).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    expect(await page.locator(".match-loading-spinner").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  } finally { peticion.liberar(); }
  await expect(page.getByTestId("match-view")).toHaveAttribute("data-seed", "43");
  await expect(page.getByTestId("match-loading")).toBeHidden();
});
