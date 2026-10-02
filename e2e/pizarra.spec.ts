// Brief 011 — la animación del gol respaldada por los datos: el balón termina en el palo
// REGISTRADO, Replay la repite, reduced-motion muestra la pizarra estática directa, y a
// 360 px la tarjeta no desborda.
import { expect, type Page, test } from "@playwright/test";
import { POS_DESTINO } from "../src/vista/pizarra";
import { DESTINO_EN, ZONA_EN } from "../src/ui/textos";

/**
 * Cierre del 016: bajo carga la animación (2,5 s) puede terminar antes de que un aserto
 * muestree «corriendo». Un MutationObserver instalado ANTES de abrir la tarjeta anota cada
 * valor de data-anim que la pizarra toma (al montarse y en cada cambio): se verifica la
 * transición completa sin depender del instante del muestreo.
 */
async function grabarAnimacion(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __anims: string[]; __obs?: MutationObserver };
    w.__anims = [];
    w.__obs?.disconnect();
    const anotar = (el: Element) => {
      const v = el.getAttribute("data-anim");
      if (v) w.__anims.push(v);
    };
    w.__obs = new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === "attributes") anotar(m.target as Element);
        else
          m.addedNodes.forEach((n) => {
            if (n instanceof Element) {
              if (n.matches('[data-testid="pitch-diagram"]')) anotar(n);
              n.querySelectorAll('[data-testid="pitch-diagram"]').forEach(anotar);
            }
          });
      }
    });
    w.__obs.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-anim"] });
  });
}

const animaciones = (page: Page) => page.evaluate(() => (window as unknown as { __anims: string[] }).__anims);

/** «corriendo» registrado y, después de él, «terminada». */
async function corrioYTermino(page: Page) {
  await expect
    .poll(async () => {
      const a = await animaciones(page);
      const i = a.indexOf("corriendo");
      return i >= 0 && a.indexOf("terminada", i + 1) > i;
    }, { timeout: 6000 })
    .toBe(true);
}

async function abrirGol(page: Page, eventoId?: string) {
  const gol = eventoId
    ? page.locator(`[data-testid="timeline-event"][data-event-id="${eventoId}"]`)
    : page.locator('[data-testid="timeline-event"][data-tipo="gol"]').first();
  await gol.scrollIntoViewIfNeeded();
  await gol.click();
  const tarjeta = page.getByTestId("goal-card");
  await expect(tarjeta).toBeVisible();
  return tarjeta;
}

test("animación: corre, termina en el palo registrado con zona y palo rotulados, y Replay la repite", async ({ page }) => {
  await page.goto("/match/246");
  await grabarAnimacion(page);
  const tarjeta = await abrirGol(page);
  const svg = tarjeta.getByTestId("pitch-diagram");
  await expect(svg).toHaveAttribute("data-fuente", "datos");
  // La animación corre (se montó en «corriendo») y termina — sin carrera con el muestreo.
  await corrioYTermino(page);
  await expect(svg).toHaveAttribute("data-anim", "terminada");
  await expect(tarjeta).toContainText("positions by zone, from match data");

  const destino = (await svg.getAttribute("data-destino")) as keyof typeof POS_DESTINO;
  const zona = (await svg.getAttribute("data-zona")) as string;
  const esperado = POS_DESTINO[destino];
  const bola = tarjeta.getByTestId("pitch-ball");
  expect(Number(await bola.getAttribute("cx"))).toBeCloseTo(esperado.x, 5);
  expect(Number(await bola.getAttribute("cy"))).toBeCloseTo(esperado.y, 5);
  expect(Number(await tarjeta.getByTestId("pitch-target").getAttribute("cx"))).toBeCloseTo(esperado.x, 5);
  await expect(tarjeta.getByTestId("pitch-destino")).toContainText(DESTINO_EN[destino] as string);
  await expect(tarjeta.getByTestId("pitch-zona")).toContainText(ZONA_EN[zona] as string);
  // Los pasos de texto citan los mismos datos.
  await expect(tarjeta.getByTestId("goal-step").filter({ hasText: "Shot" })).toContainText(DESTINO_EN[destino] as string);

  // Replay: vuelve a correr y vuelve a terminar en el mismo palo.
  await grabarAnimacion(page);
  await tarjeta.getByTestId("pitch-replay").click();
  await corrioYTermino(page);
  await expect(svg).toHaveAttribute("data-anim", "terminada");
  expect(Number(await bola.getAttribute("cx"))).toBeCloseTo(esperado.x, 5);
});

test("penal: el remate sale del punto penal registrado", async ({ page }) => {
  await page.goto("/match/246");
  // El 2–0 de la 246 es de penal (e031): ESPERADO_246 y los fixtures ya dependen de esta semilla.
  const tarjeta = await abrirGol(page, "e031");
  const svg = tarjeta.getByTestId("pitch-diagram");
  await expect(svg).toHaveAttribute("data-zona", "punto_penal");
  await expect(svg).toHaveAttribute("data-anim", "terminada", { timeout: 6000 });
  await expect(tarjeta.getByTestId("pitch-zona")).toContainText(ZONA_EN.punto_penal as string);
  // Brief 015: la medición del penal es 11 m exactos, visible en el rótulo del remate.
  await expect(tarjeta.getByTestId("pitch-zona")).toContainText(/(^|[^0-9])11 m · \d+ km\/h/);
  await expect(tarjeta.getByTestId("pitch-zona")).toContainText("km/h");
});

test("prefers-reduced-motion: pizarra estática directa, sin animación", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  await page.goto("/match/246");
  const tarjeta = await abrirGol(page);
  const svg = tarjeta.getByTestId("pitch-diagram");
  await expect(svg).toHaveAttribute("data-anim", "terminada", { timeout: 500 });
  await expect(tarjeta.getByTestId("pitch-replay")).toBeDisabled();
  await ctx.close();
});

test("a 360 px la tarjeta del gol con la pizarra no desborda", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const page = await ctx.newPage();
  await page.goto("/match/246");
  await abrirGol(page);
  await expect(page.getByTestId("pitch-diagram")).toHaveAttribute("data-anim", "terminada", { timeout: 6000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await ctx.close();
});
