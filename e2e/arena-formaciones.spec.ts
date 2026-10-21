import { expect, test } from "@playwright/test";

test("formaciones: expone doce opciones y las cinco nuevas cambian la cancha con un registro reproducible", async ({ page, request }) => {
  const errores: string[] = []; page.on("pageerror", e => errores.push(e.message));
  await page.goto("/arena");
  await page.getByRole("button", { name: "Saved matches", exact: true }).click();
  const selector = page.getByRole("combobox", { name: "Home formation", exact: true });
  await expect(selector.locator("option")).toHaveCount(13); // Doce y la elección del entrenador.
  const geometrías = new Set<string>();
  for (const formacion of ["4-3-1-2", "4-2-2-2", "3-4-2-1", "5-3-2", "5-4-1"]) {
    await selector.selectOption(formacion);
    const respuesta = page.waitForResponse(r => r.url().endsWith("/api/arena") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Create recording without AI", exact: true }).click();
    const r = await respuesta; expect(r.status()).toBe(200);
    const registro = await r.json(); expect(registro.config.formaciones.local).toBe(formacion);
    await expect(page.getByTestId("arena-coach-local")).toContainText(formacion);
    geometrías.add(JSON.stringify(registro.inicial.jugadores.filter((j: { lado: string }) => j.lado === "local").map((j: { posicion: { x: number; y: number } }) => j.posicion)));
    expect((await request.post("/api/arena", { data: { accion: "reproducir", registro } })).status()).toBe(200);
  }
  expect(geometrías.size).toBe(5);
  await page.setViewportSize({ width: 360, height: 780 }); await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Switch to Spanish" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.getByTestId("arena-pitch").screenshot({ path: ".cache/arena-formaciones-doce-movil.png" });
  expect(errores).toEqual([]);
});

test("interfaz: live es el valor inicial, los ajustes se envían antes de iniciar y la semilla es opcional", async ({ page }) => {
  const enviadas: { seed: number; presentacion: string; local: string; segundos: number }[] = [];
  await page.route("**/api/arena/modelos", r => r.fulfill({ json: { modelos: [] } }));
  await page.route("**/api/arena/sesiones", r => { enviadas.push(r.request().postDataJSON()); return r.fulfill({ status: 503, json: { error: "Sin inferencia en esta prueba" } }); });
  await page.goto("/arena");
  await expect(page.getByRole("button", { name: "Live", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("combobox", { name: "Viewing mode" })).toHaveCount(0);
  await expect(page.getByLabel("Match seed (optional)", { exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "Load recorded model duel" })).toBeHidden();
  expect(await page.locator("main").innerText()).not.toMatch(/Near.live|Casi en vivo/i);
  await page.getByRole("combobox", { name: "Home formation", exact: true }).selectOption("5-4-1");
  await page.getByRole("combobox", { name: "Simulated duration", exact: true }).selectOption("30");
  const inicio = page.getByRole("button", { name: "Start live match", exact: true });
  await inicio.click(); await expect(page.getByTestId("arena-live").getByRole("alert")).toBeVisible();
  await inicio.click(); await expect.poll(() => enviadas.length).toBe(2);
  await expect(inicio).toBeEnabled();
  expect(enviadas[0]).toMatchObject({ presentacion: "buffer", local: "5-4-1", segundos: 30 });
  expect(Number.isInteger(enviadas[0]!.seed)).toBe(true); expect(enviadas[1]!.seed).not.toBe(enviadas[0]!.seed);
  await page.locator(".arena-setup > summary").click();
  await page.getByText("Reproduce a specific match (advanced)", { exact: true }).click();
  await page.getByLabel("Match seed (optional)", { exact: true }).fill("42");
  await inicio.click(); await expect.poll(() => enviadas.length).toBe(3);
  expect(enviadas[2]!.seed).toBe(42);
});

test("interfaz: narración y audio junto a la cancha, sin anticipar eventos y sin desborde en móvil", async ({ page }) => {
  await page.goto("/arena");
  await page.getByRole("button", { name: "Saved matches", exact: true }).click();
  await page.getByRole("button", { name: "Load recorded model duel" }).click();
  await expect(page.locator(".arena-controller")).toContainText(["cronista-equilibrado", "cronista-rapido"]);
  await expect(page.getByTestId("arena-clock")).toHaveText("0:00 / 1:00");
  const panel = page.getByTestId("arena-companion"), texto = panel.getByTestId("arena-live-text");
  await expect(panel.getByTestId("arena-narration")).toBeVisible();
  await expect(panel.getByRole("region", { name: "Broadcast desk" })).toBeVisible(); // Brief 045: Mesa de transmisión
  await expect(panel.getByTestId("arena-mesa").locator("[data-mesa-role]")).toHaveCount(3);
  await expect(panel.getByTestId("arena-intelligence")).toBeAttached();
  const cancha = await page.locator(".arena-board").boundingBox(), lado = await panel.boundingBox();
  expect(Math.abs(cancha!.y - lado!.y)).toBeLessThan(2); expect(lado!.x).toBeGreaterThan(cancha!.x + cancha!.width);
  await page.getByRole("slider", { name: "Match time" }).fill("10");
  await expect(page.getByTestId("arena-clock")).toHaveText("0:10 / 1:00");
  const ticks = await texto.locator("[data-event-tick]").evaluateAll(es => es.map(e => Number(e.getAttribute("data-event-tick"))));
  expect(ticks.length).toBeGreaterThan(0); expect(Math.max(...ticks)).toBeLessThanOrEqual(100);
  await page.locator("#arena-watch").evaluate(e => e.scrollIntoView({ block: "start" }));
  const cabecera = await page.locator("header").boundingBox(), panelVisible = await panel.boundingBox();
  expect(panelVisible!.y).toBeGreaterThanOrEqual(cabecera!.y + cabecera!.height);
  await page.screenshot({ path: ".cache/arena-interfaz-escritorio.png" });
  await page.setViewportSize({ width: 360, height: 780 });
  await page.getByRole("button", { name: "Switch to Spanish" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.locator("#arena-watch").screenshot({ path: ".cache/arena-interfaz-movil.png" });
});

test("descripción: permite recorrer todas las acciones confirmadas sin mostrar eventos futuros", async ({ page }) => {
  const { ejecutarArena } = await import("../src/arena/coordinador");
  const { crearConfigArena } = await import("../src/arena/motor");
  const { crearControladorProgramado } = await import("../src/arena/controladores");
  const registro = await ejecutarArena(crearConfigArena({ seed: 1, duracionS: 180, intervaloS: 30 }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
  expect(registro.eventos.length).toBeGreaterThan(40);
  await page.route("**/api/arena", r => r.fulfill({ json: registro }));
  await page.goto("/arena");
  await page.getByRole("button", { name: "Saved matches", exact: true }).click();
  await page.getByRole("button", { name: "Create recording without AI" }).click();
  await expect(page.getByTestId("arena-clock")).toHaveText("0:00 / 3:00");
  await page.getByRole("slider", { name: "Match time" }).press("End");
  const descripcion = page.getByTestId("arena-description");
  await expect(descripcion.getByTestId("arena-description-count")).toContainText(`of ${registro.eventos.length} actions`);
  const encontrados = new Set<string>();
  while (true) {
    for (const id of await descripcion.locator("[data-event-id]").evaluateAll(es => es.map(e => e.getAttribute("data-event-id")!))) encontrados.add(id);
    if (await descripcion.getByRole("button", { name: "Earlier actions" }).isDisabled()) break;
    await descripcion.getByRole("button", { name: "Earlier actions" }).click();
  }
  expect([...encontrados].sort()).toEqual(registro.eventos.map(e => e.id).sort());
  await page.getByRole("slider", { name: "Match time" }).fill("10");
  await expect(page.getByTestId("arena-clock")).toHaveText("0:10 / 3:00");
  const ticks = await descripcion.locator("[data-event-tick]").evaluateAll(es => es.map(e => Number(e.getAttribute("data-event-tick"))));
  expect(ticks.every(tick => tick <= 100)).toBe(true);
});
