import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { micro } from "../src/sim/micro";
import { simular } from "../src/sim/motor";
import { configDeSemilla } from "../src/sim/plantillas";
import { accionesCompletas } from "../src/vista/partido-completo";
import { construirRelato, frasesDeJugada } from "../src/vista/relato";

const p = simular(configDeSemilla(246));
const m = micro(p);
const filas = accionesCompletas(p, m);
const { jugadas, cuadros } = construirRelato(p, filas);
const carry = m.eventos.find(e => e.tipo === "conduccion")!;

test("reproducción: ficha y balón se mueven, pausa estable y selección manual detiene incluso en la misma frase", async ({ page }) => {
  await page.goto("/");
  const errores: string[] = [], api: string[] = [];
  page.on("pageerror", e => errores.push(e.message));
  page.on("request", r => { if (new URL(r.url()).pathname.startsWith("/api/")) api.push(r.url()); });
  await page.getByTestId("open-full-match").click();
  const frase = page.locator(`[data-relato-id="${carry.id}"]`);
  await frase.click();
  const ficha = page.locator(`.tactical-active[data-name="${carry.jugador}"]`);
  const inicio = await ficha.getAttribute("transform");
  const balon = await page.getByTestId("tactical-ball").getAttribute("cx");
  await page.getByTestId("pitch-play").click();
  await expect.poll(async () => Number(await page.getByTestId("pitch-player").getAttribute("data-progress"))).toBeGreaterThan(.1);
  expect(await ficha.getAttribute("transform")).not.toBe(inicio);
  expect(await page.getByTestId("tactical-ball").getAttribute("cx")).not.toBe(balon);
  await page.getByTestId("pitch-play").click();
  const pausa = await page.getByTestId("pitch-player").getAttribute("data-progress");
  const posicion = await ficha.getAttribute("transform");
  await page.waitForTimeout(350);
  await expect(page.getByTestId("pitch-player")).toHaveAttribute("data-progress", pausa!);
  await expect(ficha).toHaveAttribute("transform", posicion!);
  await page.getByTestId("pitch-speed").selectOption("2");
  await page.getByTestId("pitch-play").click();
  await expect(page.getByTestId("pitch-player")).toHaveAttribute("data-playing", "true");
  await frase.click();
  await expect(page.getByTestId("pitch-player")).toHaveAttribute("data-playing", "false");
  await expect(page.getByTestId("pitch-player")).toHaveAttribute("data-progress", "0.0000");
  expect(errores).toEqual([]); expect(api).toEqual([]);
});

test("la jugada se detiene en su último ID; reinicio y partido completo cruzan la posesión sincronizando texto", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("open-full-match").click();
  await page.getByTestId("pitch-speed").selectOption("2");
  await page.getByTestId("pitch-play").click();
  const ultimo = jugadas[0]!.acciones.at(-1)!.id;
  await expect(page.getByTestId("pitch-player")).toHaveAttribute("data-action-id", ultimo, { timeout: 15_000 });
  await expect(page.getByTestId("pitch-player")).toHaveAttribute("data-playing", "false", { timeout: 5000 });
  await expect(page.getByTestId("pitch-player")).toHaveAttribute("data-progress", "1.0000");
  await page.getByTestId("pitch-restart").click();
  await expect(page.getByTestId("pitch-player")).toHaveAttribute("data-action-id", filas[0]!.id);
  await expect(page.getByTestId("pitch-player")).toHaveAttribute("data-progress", "0.0000");
  await page.getByTestId("pitch-scope").selectOption("partido");
  await page.getByTestId("pitch-play").click();
  const siguiente = jugadas[1]!.acciones[0]!.id;
  await expect(page.getByTestId("pitch-player")).toHaveAttribute("data-action-id", siguiente, { timeout: 15_000 });
  await expect(page.locator(`[data-relato-id="${siguiente}"]`)).toHaveAttribute("aria-pressed", "true");
  const texto = await page.locator(`[data-relato-id="${siguiente}"]`).textContent();
  await expect(page.getByTestId("pitch-current-commentary")).toHaveText(texto!);
  await page.getByTestId("commentary-action-next").click();
  await expect(page.getByTestId("pitch-player")).toHaveAttribute("data-playing", "false");
});

test("fluido/detallado ES/EN, formaciones narradas y descarga con todos los IDs", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("open-full-match").click();
  await expect(page.getByTestId("commentary-lineups")).toContainText("4-3-3");
  await expect(page.getByTestId("commentary-lineups")).toBeInViewport();
  await page.getByTestId("full-match-language").getByRole("button", { name: "ES", exact: true }).click();
  await expect(page.getByTestId("commentary-lineups")).toBeInViewport();
  const jugada = jugadas.find(j => j.acciones.some(a => a.id === carry.id))!;
  await page.locator(`[data-relato-id="${carry.id}"]`).click();
  for (const lengua of ["en", "es"] as const) {
    await page.getByTestId("full-match-language").getByRole("button", { name: lengua.toUpperCase(), exact: true }).click();
    for (const estilo of ["fluido", "detallado"] as const) {
      await page.getByTestId("commentary-style").selectOption(estilo);
      const esperado = frasesDeJugada(p, jugada, cuadros, lengua, "aficionado", estilo).find(f => f.accion.id === carry.id)!.texto;
      await expect(page.locator(`[data-relato-id="${carry.id}"]`)).toHaveText(esperado);
      await expect(page.locator(`[data-relato-id="${carry.id}"]`)).toBeInViewport({ ratio: .5 });
      await expect(page.getByTestId("pitch-current-commentary")).toHaveText(esperado);
      await expect(page.getByTestId("pitch-player")).toHaveAttribute("data-playing", "false");
    }
  }
  const promesa = page.waitForEvent("download");
  await page.getByTestId("download-commentary").click();
  const txt = await readFile((await (await promesa).path())!, "utf8");
  expect([...txt.matchAll(/^\[([^\]]+)\]/gm)].map(m => m[1])).toEqual(filas.map(f => f.id));
  expect(txt).toContain("4–1");
});

test("movimiento reducido mantiene pasos discretos y lectura sincronizada", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByTestId("open-full-match").click();
  await page.locator(`[data-relato-id="${carry.id}"]`).click();
  const ficha = page.locator(`.tactical-active[data-name="${carry.jugador}"]`);
  const antes = await ficha.getAttribute("transform");
  await page.getByRole("button", { name: "After", exact: true }).click();
  const despues = await ficha.getAttribute("transform");
  expect(despues).not.toBe(antes);
  await page.getByRole("button", { name: "Before", exact: true }).click();
  await page.getByTestId("pitch-play").click();
  await expect.poll(async () => Number(await page.getByTestId("pitch-player").getAttribute("data-progress"))).toBeGreaterThan(.05);
  await expect(ficha).toHaveAttribute("transform", despues!);
  await expect(page.getByTestId("pitch-timing-note")).toContainText("without interpolation");
  await page.getByTestId("pitch-play").click();
});

test("móvil: cancha completa, pausa al volver al relato y Escape devuelve el foco", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByTestId("open-full-match").click();
  await page.getByTestId("full-match-language").getByRole("button", { name: "ES", exact: true }).click();
  await page.locator(`[data-relato-id="${carry.id}"]`).click();
  await expect(page.getByTestId("tactical-pitch")).toBeInViewport({ ratio: .95 });
  await page.getByTestId("pitch-play").click();
  await expect(page.getByTestId("pitch-player")).toHaveAttribute("data-playing", "true");
  await page.getByTestId("commentary-pitch-toggle").click();
  await expect(page.getByTestId("pitch-player")).toHaveAttribute("data-playing", "false");
  await expect(page.getByTestId("commentary-story")).toBeVisible();
  expect(await page.getByTestId("full-match").evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("open-full-match")).toBeFocused();
});

test("ocultar la pestaña cancela la reproducción y no la reanuda sola", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("open-full-match").click();
  await page.getByTestId("pitch-play").click();
  await expect(page.getByTestId("pitch-player")).toHaveAttribute("data-playing", "true");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.getByTestId("pitch-player")).toHaveAttribute("data-playing", "false");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.getByTestId("pitch-player")).toHaveAttribute("data-playing", "false");
});
