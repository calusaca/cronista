// El camino real del juez (briefs 004 + 006), conducido con el MOUSE.
// Asertos por estado del DOM (data-highlighted, data-state, data-testid), nunca pixeles.
// Server con el LLM de ensayo: una frase fue rechazada (V3) y corregida ⇒ estado ↻.
import { expect, type Locator, type Page, test } from "@playwright/test";

const cifras = (t: string) => (t.match(/\d+(?:[.,]\d+)?/g) ?? []).join(" ");

async function clicConMouse(page: Page, l: Locator) {
  await l.scrollIntoViewIfNeeded();
  const caja = await l.boundingBox();
  if (!caja) throw new Error("elemento sin caja visible");
  // Movimiento y clic de mouse reales, en el centro del elemento (como un juez).
  await page.mouse.move(caja.x + caja.width / 2, caja.y + Math.min(caja.height / 2, 14), { steps: 4 });
  await page.mouse.down();
  await page.mouse.up();
}

test("el camino del juez: evidencia, inversa, idioma, caja de cristal y pizarra del gol", async ({ page }) => {
  // 1. Home: el partido destacado ya está cargado, sin configurar nada.
  await page.goto("/");
  const destacado = page.getByTestId("featured-match");
  await expect(destacado).toBeVisible();
  const oraciones = destacado.getByTestId("sentence");
  await expect(oraciones.first()).toBeVisible();
  expect(await oraciones.count()).toBeGreaterThan(1);
  await expect(page.getByTestId("verify-bar")).toContainText("sentences verified");
  // El fixture se rotula como tal (regla de honestidad del 006).
  await expect(page.getByTestId("llm-label")).toHaveAttribute("data-fixture", "true");

  // 2. Hover sobre una frase: resaltado transitorio de su evidencia.
  const segunda = oraciones.nth(1);
  const cajaSeg = await segunda.boundingBox();
  await page.mouse.move(cajaSeg!.x + 60, cajaSeg!.y + 12);
  await expect(page.locator('[data-testid="timeline-event"][data-hover="true"]').first()).toBeVisible();

  // 3. Clic en la primera frase ⇒ ≥1 evento resaltado en la línea de tiempo (persistente).
  const primera = oraciones.first();
  await clicConMouse(page, primera.getByTestId("sentence-text"));
  await expect(primera).toHaveAttribute("data-selected", "true");
  const resaltados = page.locator('[data-testid="timeline-event"][data-highlighted="true"]');
  await expect(resaltados.first()).toBeVisible();
  expect(await resaltados.count()).toBeGreaterThanOrEqual(1);
  // Scroll automático: el primer evento resaltado queda DENTRO de la parte visible de la línea.
  await expect
    .poll(async () => {
      const linea = await page.getByTestId("timeline").boundingBox();
      const fila = await resaltados.first().boundingBox();
      return !!linea && !!fila && fila.y >= linea.y && fila.y + fila.height <= linea.y + linea.height;
    })
    .toBe(true);
  // El resaltado sigue tras sacar el mouse (es persistente al clic).
  await page.mouse.move(5, 5);
  expect(await resaltados.count()).toBeGreaterThanOrEqual(1);

  // 4. Inversa: clic en un evento (no gol) ⇒ las frases que lo citan quedan resaltadas.
  const eventoNoGol = resaltados.and(page.locator(':not([data-tipo="gol"])')).first();
  const idEvento = await eventoNoGol.getAttribute("data-event-id");
  await clicConMouse(page, eventoNoGol);
  await expect(page.locator(`[data-event-id="${idEvento}"]`)).toHaveAttribute("data-selected", "true");
  const frasesCitan = page.locator('[data-testid="sentence"][data-highlighted="true"]');
  await expect(frasesCitan.first()).toBeVisible();
  expect(await frasesCitan.count()).toBeGreaterThanOrEqual(1);

  // 5. Toggle EN: el texto cambia, los números no.
  const textoEs = (await primera.getByTestId("sentence-text").innerText()).trim();
  await clicConMouse(page, page.getByTestId("lang-toggle").locator('[data-lang="en"]'));
  await expect(page.getByTestId("lang-toggle").locator('[data-lang="en"]')).toHaveAttribute("aria-pressed", "true");
  const textoEn = (await primera.getByTestId("sentence-text").innerText()).trim();
  expect(textoEn).not.toBe(textoEs);
  expect(cifras(textoEn)).toBe(cifras(textoEs));
  expect(cifras(textoEn).length).toBeGreaterThan(0);

  // 6. Caja de cristal: la frase corregida (↻) abre su historia con ≥1 intento.
  const corregida = page.locator('[data-testid="sentence"][data-state="corregida"]').first();
  await expect(corregida).toBeVisible();
  await clicConMouse(page, corregida.getByTestId("sentence-state"));
  const caja = page.getByTestId("glass-box");
  await expect(caja).toBeVisible();
  const intentos = caja.getByTestId("attempt");
  expect(await intentos.count()).toBeGreaterThanOrEqual(1);
  // La versión rechazada, con su regla; la aprobada al final.
  await expect(caja.locator('[data-testid="attempt"][data-approved="false"]').first()).toBeVisible();
  await expect(caja.locator('[data-testid="rule"][data-rule="V3"]').first()).toBeVisible();
  await expect(intentos.last()).toHaveAttribute("data-approved", "true");
  await page.keyboard.press("Escape");
  await expect(caja).toBeHidden();

  // 6b. «How it was written» desde el botón de la frase seleccionada también abre su historia.
  const otra = oraciones.first();
  await clicConMouse(page, otra.getByTestId("sentence-text"));
  await expect(otra).toHaveAttribute("data-selected", "true");
  await clicConMouse(page, otra.getByTestId("how-written"));
  await expect(page.getByTestId("glass-box")).toBeVisible();
  await expect(page.getByTestId("glass-box").getByTestId("attempt").first()).toBeVisible();
  await page.keyboard.press("Escape");

  // 7. Vista global del proceso: los intentos lado a lado.
  await clicConMouse(page, page.getByTestId("open-process"));
  const proceso = page.getByTestId("process-view");
  await expect(proceso).toBeVisible();
  expect(await proceso.getByTestId("process-attempt").count()).toBeGreaterThanOrEqual(2);
  await page.keyboard.press("Escape");

  // 8. Clic en un gol ⇒ la tarjeta «cómo fue el gol» con la pizarra.
  const gol = page.locator('[data-testid="timeline-event"][data-tipo="gol"]').first();
  await clicConMouse(page, gol);
  const tarjeta = page.getByTestId("goal-card");
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta.getByTestId("pitch-diagram")).toBeVisible();
  expect(await tarjeta.getByTestId("goal-step").count()).toBeGreaterThanOrEqual(2);
  await expect(tarjeta).toContainText("Schematic");
});

test("simular otra semilla desde la barra superior abre su partido", async ({ page }) => {
  await page.goto("/");
  const semilla = page.getByTestId("seed-input");
  await semilla.click();
  await semilla.fill("42");
  await clicConMouse(page, page.getByTestId("simulate"));
  await page.waitForURL("**/match/42");
  await expect(page.getByTestId("match-view")).toHaveAttribute("data-seed", "42");
  await expect(page.getByTestId("sentence").first()).toBeVisible();
});

test("una semilla inválida en la URL da 404, no un partido inventado", async ({ page }) => {
  const r = await page.goto("/match/0x2A");
  expect(r?.status()).toBe(404);
});
