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
  // Cierre del 016 (autorizado por Fable): es el camino largo por diseño; bajo carga ya iba a
  // 51,5 s de los 60 s por defecto. 120 s para este test, y solo este.
  test.setTimeout(120_000);
  // 1. Home: el partido destacado ya está cargado, sin configurar nada.
  await page.goto("/cronicas");
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

  // 5. La crónica abre en INGLÉS (jurado internacional); toggle ES: el texto cambia, los números no.
  await expect(page.getByTestId("lang-toggle").locator('[data-lang="en"]')).toHaveAttribute("aria-pressed", "true");
  const textoEn = (await primera.getByTestId("sentence-text").innerText()).trim();
  await clicConMouse(page, page.getByTestId("lang-toggle").locator('[data-lang="es"]'));
  await expect(page.getByTestId("lang-toggle").locator('[data-lang="es"]')).toHaveAttribute("aria-pressed", "true");
  const textoEs = (await primera.getByTestId("sentence-text").innerText()).trim();
  expect(textoEs).not.toBe(textoEn);
  expect(cifras(textoEs)).toBe(cifras(textoEn));
  expect(cifras(textoEs).length).toBeGreaterThan(0);
  await clicConMouse(page, page.getByTestId("lang-toggle").locator('[data-lang="en"]'));

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

/** Todas las cifras de la crónica visible, ordenadas (un multiconjunto). */
async function cifrasCronica(page: Page): Promise<string> {
  const textos = await page.getByTestId("sentence-text").allInnerTexts();
  return textos
    .flatMap((t) => t.match(/\d+(?:[.,]\d+)?/g) ?? [])
    .sort()
    .join(" ");
}

test("personalización (007): Aficionado ↔ Analista sin llamadas, y «mi equipo» cambia el orden, no los números", async ({ page }) => {
  await page.goto("/cronicas");
  await expect(page.getByTestId("sentence").first()).toBeVisible();
  const textosFan = await page.getByTestId("sentence-text").allInnerTexts();
  const cifrasNeutral = await cifrasCronica(page);

  // 1. Toggle Analista: render puro del cliente — ninguna petición al server mientras tanto.
  const peticiones: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (!u.pathname.startsWith("/_next/static")) peticiones.push(`${r.method()} ${u.pathname}${u.search}`);
  });
  await clicConMouse(page, page.getByTestId("mode-toggle").locator('[data-mode="analista"]'));
  await expect(page.getByTestId("mode-toggle").locator('[data-mode="analista"]')).toHaveAttribute("aria-pressed", "true");
  // xG por frase, citas expandidas y hechos no usados aparecen…
  await expect(page.getByTestId("sentence-xg").first()).toBeVisible();
  expect(await page.getByTestId("sentence-xg").count()).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId("sentence-evidence").first()).toBeVisible();
  await expect(page.getByTestId("unused-facts")).toBeVisible();
  // …y las frases y sus números NO cambian entre modos.
  expect(await page.getByTestId("sentence-text").allInnerTexts()).toEqual(textosFan);
  expect(await cifrasCronica(page)).toBe(cifrasNeutral);
  // De vuelta a Aficionado: el detalle desaparece.
  await clicConMouse(page, page.getByTestId("mode-toggle").locator('[data-mode="aficionado"]'));
  await expect(page.getByTestId("analyst-detail")).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(peticiones, "el cambio de modo no debe pedir nada al server").toEqual([]);

  // 2. «Mi equipo»: contar el partido para la afición visitante.
  const ordenNeutral = await page.getByTestId("sentence").evaluateAll((els) => els.map((e) => e.getAttribute("data-hecho")));
  await clicConMouse(page, page.getByTestId("perspective").locator('[data-perspective="visita"]'));
  await page.waitForURL("**/cronicas?perspectiva=visita");
  await expect(page.getByTestId("perspective").locator('[data-perspective="visita"]')).toHaveAttribute("aria-current", "true");
  await expect(page.getByTestId("match-view")).toContainText("Told for");
  const ordenVisita = await page.getByTestId("sentence").evaluateAll((els) => els.map((e) => e.getAttribute("data-hecho")));
  // El orden cambia…
  expect(ordenVisita).not.toEqual(ordenNeutral);
  // …los hechos narrados son los mismos y los números también: la verdad no se personaliza.
  expect([...ordenVisita].sort()).toEqual([...ordenNeutral].sort());
  expect(await cifrasCronica(page)).toBe(cifrasNeutral);
  // La misma verificación: la barra sigue diciendo que todo está verificado.
  await expect(page.getByTestId("verify-bar")).toContainText("sentences verified");
});

test("cargar la página NO pide de antemano las otras perspectivas (sin prefetch: cada una cuesta una crónica)", async ({ page }) => {
  // El espía se instala ANTES de cargar: un prefetch dispara al montar los enlaces.
  const pedidas: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("perspectiva=")) pedidas.push(r.url());
  });
  await page.goto("/cronicas");
  const selector = page.getByTestId("perspective");
  await selector.scrollIntoViewIfNeeded();
  await page.mouse.move(10, 10);
  // Tiempo de sobra para que un prefetch por visibilidad/inactividad ocurra si existiera.
  await page.waitForTimeout(2500);
  expect(pedidas, "ninguna perspectiva se pide sin que el usuario la elija").toEqual([]);
});

test("simular otra semilla desde la barra superior abre su partido", async ({ page }) => {
  await page.goto("/cronicas");
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
