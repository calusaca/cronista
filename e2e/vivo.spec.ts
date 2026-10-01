// Brief 008 — el replay en vivo, conducido con el MOUSE, y el overlay de broadcast.
// Server con el LLM de ensayo: cada update fue rechazada una vez (V3) y corregida.
import { expect, type Locator, type Page, test } from "@playwright/test";
import { esquemaOverlay } from "../src/vivo/overlay";

async function clicConMouse(page: Page, l: Locator) {
  await l.scrollIntoViewIfNeeded();
  const caja = await l.boundingBox();
  if (!caja) throw new Error("elemento sin caja visible");
  await page.mouse.move(caja.x + caja.width / 2, caja.y + Math.min(caja.height / 2, 14), { steps: 4 });
  await page.mouse.down();
  await page.mouse.up();
}

const minutos = async (l: Locator) => (await l.evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-minuto")))));
const reloj = async (page: Page) => Number(await page.getByTestId("replay-clock").getAttribute("data-minuto"));

test("Watch live: updates en orden de minuto → clic resalta sus eventos → pausa → Skip a la crónica completa", async ({ page, request }) => {
  const overlay = esquemaOverlay.parse(await (await request.get("/api/overlay/246")).json());

  await page.goto("/match/246");
  await expect(page.getByTestId("final-score")).toBeVisible();
  await clicConMouse(page, page.getByTestId("watch-live"));

  // Rotulado «Replay» (honestidad del brief) y sin spoiler: el marcador es el del reloj.
  await expect(page.getByTestId("replay-badge")).toHaveText("Replay");
  await expect(page.getByTestId("live-score")).toBeVisible();
  await expect(page.getByTestId("final-score")).toHaveCount(0);
  await expect(page.getByTestId("sentence")).toHaveCount(0);

  // ×5: las updates van apareciendo.
  await clicConMouse(page, page.locator('[data-testid="replay-speed"] [data-speed="x5"]'));
  const updates = page.getByTestId("ticker-update");
  await expect.poll(() => updates.count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(3);

  // En orden de minuto, y ninguna del futuro respecto del reloj.
  const ms = await minutos(updates);
  expect([...ms].sort((a, b) => a - b)).toEqual(ms);
  expect(Math.max(...ms)).toBeLessThanOrEqual(await reloj(page));
  // Ningún evento del futuro en la línea de tiempo.
  const minutosLinea = await minutos(page.getByTestId("timeline-event"));
  expect(minutosLinea.length).toBeGreaterThan(0);
  expect(Math.max(...minutosLinea)).toBeLessThanOrEqual(await reloj(page));

  // Pausa: el reloj y el ticker se detienen.
  await clicConMouse(page, page.locator('[data-testid="replay-speed"] [data-speed="pausa"]'));
  await expect(page.locator('[data-testid="replay-speed"] [data-speed="pausa"]')).toHaveAttribute("aria-pressed", "true");
  const r0 = await reloj(page);
  const n0 = await updates.count();
  await page.waitForTimeout(1500); // a ×5 serían ~7 minutos de partido
  expect(await reloj(page)).toBe(r0);
  expect(await updates.count()).toBe(n0);

  // Clic en la segunda update ⇒ sus eventos (los del overlay) quedan resaltados en la línea.
  const segunda = updates.nth(1);
  await clicConMouse(page, segunda);
  await expect(segunda).toHaveAttribute("data-selected", "true");
  const momento = await segunda.getAttribute("data-momento");
  const esperados = overlay.actualizaciones.filter((a) => a.momento === momento).flatMap((a) => a.eventos);
  const resaltados = page.locator('[data-testid="timeline-event"][data-highlighted="true"]');
  await expect(resaltados.first()).toBeVisible();
  const ids = await resaltados.evaluateAll((els) => els.map((e) => e.getAttribute("data-event-id")));
  for (const id of ids) expect(esperados).toContain(id);
  // Todo evento esperado que ya está en la línea de tiempo está resaltado (los de inicio/fin de periodo no se dibujan como fila).
  const visibles = await page.getByTestId("timeline-event").evaluateAll((els) => els.map((e) => e.getAttribute("data-event-id")));
  for (const id of esperados) if (visibles.includes(id)) expect(ids).toContain(id);

  // Skip to full-time ⇒ la crónica completa de siempre, con el marcador final.
  await clicConMouse(page, page.getByTestId("skip-full-time"));
  await expect(page.getByTestId("replay-badge")).toHaveCount(0);
  await expect(page.getByTestId("chronicle-title")).toBeVisible();
  expect(await page.getByTestId("sentence").count()).toBeGreaterThan(1);
  await expect(page.getByTestId("final-score")).toBeVisible();
  await expect(page.getByTestId("verify-bar")).toBeVisible();
});

test("overlay: GET /api/overlay/246 responde JSON válido (zod) y coincide con lo que muestra el ticker", async ({ page, request }) => {
  const r = await request.get("/api/overlay/246");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("application/json");
  const ov = esquemaOverlay.parse(await r.json());
  expect(ov.seed).toBe(246);
  expect(ov.replay).toBe(true);
  expect(ov.actualizaciones.length).toBeGreaterThan(3);

  // Semilla inválida ⇒ 400 con JSON.
  const malo = await request.get("/api/overlay/abc");
  expect(malo.status()).toBe(400);

  // El replay completo a ×5: el ticker termina mostrando exactamente el overlay, en orden.
  await page.goto("/match/246");
  await clicConMouse(page, page.getByTestId("watch-live"));
  await clicConMouse(page, page.locator('[data-testid="replay-speed"] [data-speed="x5"]'));
  await expect(page.getByTestId("replay-clock")).toHaveText("FT", { timeout: 40_000 });
  const ticker = page.getByTestId("ticker-update");
  const ui = await ticker.evaluateAll((els) =>
    els.map((e) => ({ minuto: Number(e.getAttribute("data-minuto")), momento: e.getAttribute("data-momento"), texto: e.querySelector(".ticker-text")?.textContent ?? "" })),
  );
  expect(ui).toEqual(ov.actualizaciones.map((a) => ({ minuto: a.minuto, momento: a.momento, texto: a.texto_en })));
  // Y en español, lo mismo.
  await clicConMouse(page, page.locator('[data-testid="ticker-lang"] [data-lang="es"]'));
  const uiEs = await ticker.evaluateAll((els) => els.map((e) => e.querySelector(".ticker-text")?.textContent ?? ""));
  expect(uiEs).toEqual(ov.actualizaciones.map((a) => a.texto_es));
  // Con el ensayo, toda update visible fue corregida (rechazada una vez por el Verificador).
  expect(ov.actualizaciones.every((a) => a.verificacion === "llm" && a.intentos === 2)).toBe(true);
  await expect(page.getByTestId("skip-full-time")).toHaveText("Read the full report");
});
