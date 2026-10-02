// Brief 014 — la vitrina: panel «Match stats» con evidencia jugada a jugada, presets curados
// (cinco historias, sin spoilear el marcador) y simular sin fricción (semilla vacía ⇒ al azar).
import { expect, test } from "@playwright/test";

test("Match stats: rotulado, cifras clicables, evidencia jugada a jugada y desglose", async ({ page }) => {
  await page.goto("/match/146"); // el preset del duelo (PRESETS.duelo)
  const panel = page.getByTestId("stats-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(/computed from [\d,]+ simulated match events/);

  // Duelo: clic ⇒ relato con los regates exactos marcados.
  const duelo = panel.getByTestId("stat-duelo").first();
  await duelo.scrollIntoViewIfNeeded();
  const n = Number((await duelo.innerText()).match(/(\d+)×/)?.[1]);
  await duelo.click();
  const cajon = page.getByTestId("stats-evidence");
  await expect(cajon).toBeVisible();
  await expect(cajon.locator('[data-testid="pbp-line"][data-citado="true"]')).toHaveCount(n);
  await expect(cajon.locator('[data-testid="pbp-line"]').first()).toContainText(/′/);
  await expect(cajon).toContainText(/beats .+ on the dribble/);
  await page.keyboard.press("Escape");
  await expect(cajon).toHaveCount(0);

  // Posesión: clic ⇒ desglose recomputable (pases por equipo y por periodo).
  await panel.getByTestId("stat-posesion").click();
  await expect(page.getByTestId("stats-desglose")).toBeVisible();
  await expect(page.getByTestId("stats-desglose")).toContainText("passes");
  await page.keyboard.press("Escape");

  // Pérdidas en salida: un canal con pérdidas ⇒ relato con esas pérdidas marcadas.
  const chip = panel.locator('[data-testid="stat-perdida"]:not([disabled])').first();
  await chip.scrollIntoViewIfNeeded();
  const k = Number((await chip.innerText()).match(/(\d+)$/)?.[1]);
  await chip.click();
  await expect(page.locator('[data-testid="pbp-line"][data-citado="true"]')).toHaveCount(k);
  await expect(page.getByTestId("stats-evidence")).toContainText("loses the ball playing out");
});

test("Match stats en el replay: «so far», y crecen con el reloj", async ({ page }) => {
  await page.goto("/match/246");
  const panel = page.getByTestId("stats-panel");
  // textContent (no innerText): el antetítulo va en versalitas por CSS.
  const total = async () => Number(((await panel.locator(".overline").first().textContent()) ?? "").match(/from ([\d,]+)/i)?.[1]?.replace(/,/g, "") ?? "0");
  const lleno = await total();
  await page.getByTestId("watch-live").click();
  await expect(panel).toContainText("so far");
  await page.locator('[data-testid="replay-speed"] [data-speed="x5"]').click();
  await expect.poll(total, { timeout: 15_000 }).toBeGreaterThan(0);
  const a = await total();
  expect(a).toBeLessThan(lleno);
  await expect.poll(total, { timeout: 15_000 }).toBeGreaterThan(a);
});

test("presets: cinco historias sin marcador, y elegir una abre su partido", async ({ page }) => {
  await page.goto("/");
  const select = page.getByTestId("preset-select");
  const opciones = await select.locator("option").evaluateAll((os) => os.map((o) => ({ v: (o as HTMLOptionElement).value, t: o.textContent ?? "" })));
  const historias = opciones.filter((o) => o.v !== "");
  expect(historias).toHaveLength(5);
  for (const o of historias) expect(o.t).not.toMatch(/\d\s*[–-]\s*\d/);
  expect(historias.map((o) => o.v)).toContain("246");
  const elegida = historias.find((o) => o.v !== "246")!;
  await select.selectOption(elegida.v);
  await page.waitForURL(new RegExp(`/match/${elegida.v}$`));
  await expect(page.getByTestId("match-view")).toHaveAttribute("data-seed", elegida.v);
});

test("Simulate con la semilla VACÍA genera una al azar y navega; con una inválida sigue el error", async ({ page }) => {
  await page.goto("/match/246");
  const semilla = page.getByTestId("seed-input");
  await semilla.fill("");
  await page.getByTestId("simulate").click();
  // Esperar a que la URL CAMBIE (la de partida ya es /match/246; 1 en 99 999 de que salga igual).
  await page.waitForURL((u) => /^\/match\/\d+$/.test(u.pathname) && u.pathname !== "/match/246");
  const seed = Number(new URL(page.url()).pathname.split("/").pop());
  expect(seed).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId("match-view")).toHaveAttribute("data-seed", String(seed));

  await page.getByTestId("seed-input").fill("abc");
  await page.getByTestId("simulate").click();
  await expect(page.locator('.sim-form [role="alert"]')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(`/match/${seed}`);
});

test("a 360 px el panel de stats y su evidencia no desbordan", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const page = await ctx.newPage();
  await page.goto("/match/146");
  await page.getByTestId("stats-panel").scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.getByTestId("stat-duelo").first().click();
  await expect(page.getByTestId("stats-evidence")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await ctx.close();
});
