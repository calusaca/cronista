// Brief 016 — modo liga: /liga → tabla visible → clic en un partido de la jornada → vista de
// partido completa con breadcrumb → volver. Y el overlay del replay de un partido de liga.
import { expect, test } from "@playwright/test";

test("home → League mode → tabla → jornada → partido completo con breadcrumb → volver", async ({ page }) => {
  await page.goto("/cronicas");
  await page.getByTestId("league-mode").click();
  await expect(page).toHaveURL(/\/liga$/);
  await expect(page.getByTestId("league-page")).toContainText("A fully simulated fictional league");
  const nombre = (await page.getByTestId("league-name").textContent())?.trim() ?? "";
  expect(nombre).toMatch(/^Liga /);

  // Tabla: 10 equipos, 18 partidos cada uno, ordenada por puntos.
  const filas = page.getByTestId("league-row");
  await expect(filas).toHaveCount(10);
  const pts = await filas.evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-pts"))));
  expect([...pts].sort((a, b) => b - a)).toEqual(pts);
  expect(await page.getByTestId("scorer").count()).toBeGreaterThan(0);

  // Jornada 7: 5 partidos con marcador.
  await page.locator('[data-testid="matchday-link"][data-jornada="7"]').click();
  await expect(page.getByTestId("matchday-matches")).toHaveAttribute("data-jornada", "7");
  const partidos = page.getByTestId("league-match");
  await expect(partidos).toHaveCount(5);
  const tercero = partidos.nth(2);
  const marcador = ((await tercero.locator(".jp-marcador").textContent()) ?? "").trim();
  const local = ((await tercero.locator(".jp-local").textContent()) ?? "").trim();
  await tercero.click();

  // La vista de partido de siempre, con breadcrumb y el mismo marcador y equipos.
  await expect(page).toHaveURL(/\/liga\/7\/3$/);
  await expect(page.getByTestId("league-breadcrumb")).toContainText(`${nombre} · Matchday 7`);
  await expect(page.getByTestId("match-view")).toBeVisible();
  // El chip dice «League fixture», no la semilla cruda (escrita en Simulate daría otro partido).
  const rotulo = page.locator(".match-head .overline").first();
  await expect(rotulo).toContainText("League fixture");
  await expect(rotulo).not.toContainText("Seed");
  await expect(page.getByTestId("final-score")).toHaveText(marcador);
  await expect(page.locator(".scoreline .team.home")).toContainText(local);
  await expect(page.getByTestId("sentence").first()).toBeVisible();
  await expect(page.getByTestId("timeline-event").first()).toBeVisible();
  await expect(page.getByTestId("stats-panel")).toBeVisible();
  await expect(page.getByTestId("ratings-panel")).toBeVisible();

  // Anterior / siguiente por el calendario.
  await page.getByTestId("league-next").click();
  await expect(page).toHaveURL(/\/liga\/7\/4$/);
  await page.getByTestId("league-prev").click();
  await expect(page).toHaveURL(/\/liga\/7\/3$/);

  // Volver: a la jornada del partido.
  await page.getByTestId("league-back").click();
  await expect(page).toHaveURL(/\/liga\?j=7$/);
  await expect(page.getByTestId("matchday-matches")).toHaveAttribute("data-jornada", "7");
});

test("primer y último partido: sin anterior / sin siguiente; ruta inválida da 404", async ({ page }) => {
  await page.goto("/liga/1/1");
  await expect(page.getByTestId("league-next")).toBeVisible();
  await expect(page.getByTestId("league-prev")).toHaveCount(0);
  // En /match el chip sigue siendo la semilla (ahí sí reproduce el partido).
  await page.goto("/match/246");
  await expect(page.locator(".match-head .overline").first()).toContainText("Seed 246");
  await page.goto("/liga/18/5");
  await expect(page.getByTestId("league-prev")).toBeVisible();
  await expect(page.getByTestId("league-next")).toHaveCount(0);
  for (const r of ["/liga/19/1", "/liga/1/6", "/liga/0/1", "/liga/x/1"]) {
    const resp = await page.goto(r);
    expect(resp?.status(), r).toBe(404);
  }
});

test("el replay de un partido de liga usa su propio overlay, y coincide con sus eventos", async ({ page, request }) => {
  const r = await request.get("/api/liga/7/3/overlay");
  expect(r.ok()).toBe(true);
  const json = (await r.json()) as { seed: number; local: string; visita: string };
  await page.goto("/liga/7/3");
  await expect(page.locator(".scoreline .team.home")).toContainText(json.local);
  await expect(page.getByTestId("match-view")).toHaveAttribute("data-seed", String(json.seed));
  // La misma semilla por /api/overlay/[seed] es OTRO partido (configDeSemilla): por eso la liga
  // tiene su propio endpoint.
  const suelto = (await (await request.get(`/api/overlay/${json.seed}`)).json()) as { local: string };
  expect(suelto.local).not.toBe(json.local);

  // «Watch live» en la página de liga pide SU overlay y el ticker se llena.
  const pedido = page.waitForRequest((q) => new URL(q.url()).pathname === "/api/liga/7/3/overlay");
  await page.getByTestId("watch-live").click();
  await pedido;
  await expect(page.getByTestId("replay-badge")).toHaveText("Replay");
  await page.locator('[data-testid="replay-speed"] [data-speed="x5"]').click();
  await expect.poll(() => page.getByTestId("ticker-update").count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(1);
  expect((await request.get("/api/liga/19/1/overlay")).status()).toBe(404);
});

test("a 360 px: /liga y un partido de liga sin desborde; la tabla scrollea en su contenedor", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const page = await ctx.newPage();
  await page.goto("/liga");
  await expect(page.getByTestId("league-table")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  const caja = page.getByTestId("league-table-scroll");
  const anchoCaja = await caja.evaluate((e) => e.clientWidth);
  expect(anchoCaja).toBeLessThanOrEqual(360);
  await page.goto("/liga/7/3");
  await expect(page.getByTestId("league-breadcrumb")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await ctx.close();
});
