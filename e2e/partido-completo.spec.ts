import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { micro } from "../src/sim/micro";
import { simular } from "../src/sim/motor";
import { configDeSemilla } from "../src/sim/plantillas";
import { ACCIONES_POR_PAGINA } from "../src/vista/partido-completo";
import { LIGA_DESTACADA, TEMPORADA_ACTUAL } from "../src/analista/umbrales";
import { mundo } from "../src/mundo/mundo";
import { configDePartidoLiga } from "../src/mundo/temporada";

const p = simular(configDeSemilla(246));
const m = micro(p);
const total = p.eventos.length + m.eventos.length;

test("partido completo: cada acción, páginas hasta el final, minuto, filtros y descarga íntegra sin API", async ({ page }) => {
  await page.goto("/cronicas");
  const peticiones: string[] = [];
  page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/api/")) peticiones.push(r.url()); });
  await page.getByTestId("open-full-match").click();
  await page.getByTestId("full-view-acciones").click();
  const detalle = page.getByTestId("full-match");
  await expect(detalle).toBeVisible();
  await expect(page.getByTestId("full-match-count")).toHaveAttribute("data-total", String(total));
  await expect(page.getByTestId("full-match-action")).toHaveCount(ACCIONES_POR_PAGINA);
  await expect(page.getByTestId("full-match-action").first()).toHaveAttribute("data-action-id", p.eventos[0]!.id);
  await page.getByTestId("full-match-next").click();
  await expect(page.getByTestId("full-match-page")).toHaveText(`2 / ${Math.ceil(total / ACCIONES_POR_PAGINA)}`);
  await page.getByTestId("full-match-last").click();
  await expect(page.getByTestId("full-match-action").last()).toHaveAttribute("data-action-id", p.eventos.at(-1)!.id);
  await expect(detalle).toContainText("Full time. Score:");

  await page.getByTestId("full-match-minute").fill("65");
  await page.getByTestId("full-match-go").click();
  const objetivo = detalle.locator(".full-match-target");
  expect(Number(await objetivo.getAttribute("data-minute"))).toBeGreaterThanOrEqual(65);
  await expect(objetivo).toBeInViewport();
  await page.getByTestId("full-match-half").selectOption("2");
  await page.getByTestId("full-match-type").selectOption("pase");
  const receptor = m.eventos.find((e) => e.tipo === "pase" && e.minuto >= 46)!.receptor!;
  await page.getByTestId("full-match-search").fill(receptor);
  await expect(page.getByTestId("full-match-action").first()).toBeVisible();
  const atributos = await page.getByTestId("full-match-action").evaluateAll((els) => els.map((e) => [e.getAttribute("data-half"), e.getAttribute("data-kind")]));
  expect(atributos.every(([periodo, tipo]) => periodo === "2" && tipo === "pase")).toBe(true);

  // Aunque haya un filtro activo, la descarga contiene TODOS los registros.
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("full-match-download").click();
  const download = await downloadPromise;
  const txt = await readFile((await download.path())!, "utf8");
  const ids = [...txt.matchAll(/^\[([^\]]+)\]/gm)].map((x) => x[1]);
  expect(ids).toHaveLength(total);
  expect(new Set(ids)).toEqual(new Set([...p.eventos, ...m.eventos].map((e) => e.id)));
  expect(txt.trim().split("\n").at(-1)).toContain("4–1");
  expect(peticiones).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(detalle).toBeHidden();
  await expect(page.getByTestId("open-full-match")).toBeFocused();
});

test("partido completo ES/EN, sin resultados de búsqueda, teclado y móvil de 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/cronicas");
  await page.getByTestId("open-full-match").click();
  await page.getByTestId("full-view-acciones").click();
  await page.getByTestId("full-match-language").getByRole("button", { name: "ES", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Partido completo", exact: true })).toBeVisible();
  await page.getByTestId("full-match-type").selectOption("pase");
  await expect(page.getByTestId("full-match-action").first()).toContainText("pasa");
  await page.getByTestId("full-match-search").fill("Nombre que no existe");
  await expect(page.getByTestId("full-match-count")).toHaveAttribute("data-total", "0");
  await expect(page.getByTestId("full-match-action")).toHaveCount(0);
  await expect(page.getByTestId("full-match-next")).toBeDisabled();
  await page.getByTestId("full-match-reset").click();
  await expect(page.getByTestId("full-match-count")).toHaveAttribute("data-total", String(total));
  expect(await page.getByTestId("full-match").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByTestId("full-match-list")).toBeVisible();
  await page.getByTestId("full-match-close").focus();
  await page.keyboard.press("Shift+Tab");
  expect(await page.getByTestId("full-match").evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("open-full-match")).toBeFocused();
  await expect(page.getByTestId("open-full-match")).toHaveText("Partido completo");
});

test("la liga usa los equipos y eventos de su partido; el detalle no revela el futuro del replay", async ({ page }) => {
  const liga = mundo().ligas.find((l) => l.id === LIGA_DESTACADA)!;
  const partidoLiga = simular(configDePartidoLiga(liga, TEMPORADA_ACTUAL, 7, 3));
  const microLiga = micro(partidoLiga);
  await page.goto("/liga/7/3");
  const nombre = (await page.locator(".scoreline .team.home").innerText()).split("\n")[0]!;
  const ultimo = await page.getByTestId("timeline-event").last().getAttribute("data-event-id");
  await page.getByTestId("open-full-match").click();
  await page.getByTestId("full-view-acciones").click();
  await expect(page.getByTestId("full-match").locator(".full-match-teams")).toContainText(nombre);
  await page.getByTestId("full-match-last").click();
  await expect(page.getByTestId("full-match-action").last()).toContainText("Full time");
  // El último evento de la línea (sin fin_periodo) también está en el registro completo.
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("full-match-download").click();
  const txt = await readFile((await (await downloadPromise).path())!, "utf8");
  expect(txt).toContain(`[${ultimo}]`);
  expect(txt).toContain(nombre);
  expect([...txt.matchAll(/^\[([^\]]+)\]/gm)].map((x) => x[1]).sort()).toEqual([...partidoLiga.eventos, ...microLiga.eventos].map((e) => e.id).sort());
  // Un pase concreto debe pertenecer a la alineación de liga, no a configDeSemilla.
  const paseLiga = microLiga.eventos.find((e) => e.tipo === "pase")!;
  expect(txt).toContain(paseLiga.jugador);
  expect(txt).toContain(paseLiga.receptor!);
  await page.getByTestId("full-match-close").click();
  await page.getByTestId("watch-live").click();
  await expect(page.getByTestId("open-full-match")).toHaveCount(0);
  await expect(page.getByTestId("full-match")).toHaveCount(0);
});
