// Brief 049 (v1.1) · Cifras del partido, ficha del jugador y favoritos en /arena. Las cifras
// esperadas se leen del JSON público en el propio test, nunca se escriben a mano.
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { rematesPorLado } from "../src/arena/estadista";
import type { RegistroArena } from "../src/arena/tipos";
import { ESTADISTICAS_ARENA } from "../src/sim/limites";

test("arena: cifras en vivo y finales, ficha del jugador y favoritos que sobreviven a la recarga", async ({ page }) => {
  const errores: string[] = []; page.on("pageerror", e => errores.push(e.message));
  const ejemplo = JSON.parse(await readFile("public/experimentos/arena-llm-v3.json", "utf8")) as RegistroArena;
  const fin = ejemplo.final.tick;
  const tiros = ejemplo.eventos.filter(e => e.tipo === "tiro"), atajadas = ejemplo.eventos.filter(e => e.tipo === "atajada");
  const porJugador = new Map<string, number>(); for (const t of tiros) porJugador.set(t.jugador, (porJugador.get(t.jugador) ?? 0) + 1);
  const [rematador, susRemates] = [...porJugador].sort((a, b) => b[1] - a[1])[0]!;
  const nombreRematador = ejemplo.inicial.jugadores.find(j => j.id === rematador)!.nombre;
  const rp = rematesPorLado(ejemplo.eventos, fin), liderDirectos = rp.local.aPuerta === rp.visita.aPuerta ? "none" : rp.local.aPuerta > rp.visita.aPuerta ? "local" : "visita";
  const cargarEjemplo = async () => {
    await page.getByRole("button", { name: "Saved matches", exact: true }).click();
    const respuesta = page.waitForResponse(r => new URL(r.url()).pathname === "/api/arena" && r.request().method() === "POST");
    await page.getByRole("button", { name: "Load AI coaches example", exact: true }).click();
    expect((await respuesta).ok()).toBe(true);
    await expect(page.locator(".arena-score")).toContainText(ejemplo.config.partido.visita.nombre);
    await expect(page.getByTestId("arena-clock")).toHaveText("0:00 / 1:00");
  };
  const panel = page.getByTestId("arena-stats"), fila = (clave: string) => panel.locator(`.arena-stat-row[data-stat="${clave}"]`);
  const valores = async (clave: string) => (await fila(clave).locator(".arena-stat-value").allTextContents()).map(t => Number.parseInt(t, 10));

  // 1. Ejemplo v3 (60 s): panel vacío en 0 s.
  await page.goto("/arena");
  await cargarEjemplo();
  await expect(page.getByTestId("arena-clock")).toHaveText("0:00 / 1:00");
  await expect(panel).toContainText("Waiting for kick-off");
  await expect(panel.locator(".arena-stat-row")).toHaveCount(0);

  // 2. Ficha de cancha del local: 0 remates; al final, el panel cuadra con el JSON.
  await page.locator('[data-testid="arena-player"][data-player^="local-"]').first().dispatchEvent("click");
  await expect(page.getByTestId("arena-player-stats").locator('[data-stat="remates"] dd')).toHaveText(/^0/);
  await page.getByRole("slider", { name: "Match time" }).press("End");
  await expect(page.getByTestId("arena-clock")).toHaveText("1:00 / 1:00");
  await expect(panel).toHaveAttribute("data-final", "true");
  await expect(panel).toContainText("Final stats");
  expect((await valores("remates")).reduce((a, b) => a + b, 0)).toBe(tiros.length);
  expect((await valores("atajadas")).reduce((a, b) => a + b, 0)).toBe(atajadas.length);
  await expect(fila("remates_directos")).toHaveAttribute("data-leader", liderDirectos);
  await page.locator(`[data-testid="arena-player"][data-player="${rematador}"]`).dispatchEvent("click");
  const ficha = page.getByTestId("arena-player-card");
  await expect(ficha.getByRole("heading")).toContainText(nombreRematador);
  await expect(page.getByTestId("arena-player-stats").locator('[data-stat="remates"] dd')).toHaveText(new RegExp(`^${susRemates}`));
  const distancia = Number.parseInt(await page.getByTestId("arena-player-stats").locator('[data-stat="distancia_m"] dd').innerText(), 10);
  expect(distancia).toBeGreaterThan(0);
  await expect(ficha.getByRole("meter")).toHaveCount(9);

  // 3. Favoritos: club visitante y el jugador seleccionado; recarga y vuelve a cargar el ejemplo.
  await page.locator('[data-testid="arena-favorite-club"][data-side="visita"]').click();
  await page.getByTestId("arena-favorite-player").click();
  await expect(page.locator('[data-testid="arena-favorite-club"][data-side="visita"]')).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await cargarEjemplo();
  await expect(page.locator('[data-testid="arena-favorite-club"][data-side="visita"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("arena-favorite-player")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(`[data-testid="arena-player"][data-player="${rematador}"]`)).toHaveAttribute("data-favorite", "true");
  await expect(ficha.getByRole("heading")).toContainText(nombreRematador);
  await expect(page.getByTestId("arena-intelligence").getByRole("combobox", { name: "Audience" })).toHaveValue("player");
  await expect(panel.locator('.arena-stats-teams [data-side="visita"]')).toHaveAttribute("data-favorite", "true");
  // «Solo mi jugador»: filtra «Últimas acciones» al favorito (y los goles) sin cambiar el contador.
  await page.getByRole("slider", { name: "Match time" }).press("End");
  const enlace = page.getByTestId("arena-live-text").getByRole("link", { name: /^Complete description/ });
  const contador = await enlace.innerText();
  await page.getByTestId("arena-only-favourite").check();
  await expect(enlace).toHaveText(contador);
  // Esperado, del JSON: eventos que nombran al favorito (jugador, receptor, sale) más los goles; los 5 últimos.
  const esperados = ejemplo.eventos.filter(e => e.jugador === rematador || e.receptor === rematador || e.sale === rematador || e.tipo === "gol").slice(-5).reverse().map(e => String(e.tick));
  await expect(page.getByTestId("arena-live-text").locator("li")).toHaveCount(esperados.length);
  expect(await page.getByTestId("arena-live-text").locator("li").evaluateAll(lis => lis.map(li => li.getAttribute("data-event-tick")))).toEqual(esperados);
  await page.getByTestId("arena-only-favourite").uncheck();
  await expect(panel.getByTestId("arena-stats-highlights")).toBeVisible();

  // 4. Español; 360 px en oscuro con movimiento reducido, sin desborde.
  await page.getByRole("button", { name: "Switch to Spanish" }).click();
  await page.getByRole("slider", { name: "Tiempo de juego" }).press("End");
  await expect(panel).toContainText("Cifras finales");
  await expect(fila("remates_directos")).toContainText("Remates directos (a puerta)");
  await expect(fila("perdidas")).toContainText("Balones perdidos");
  await page.setViewportSize({ width: 360, height: 780 }); await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await panel.scrollIntoViewIfNeeded(); await expect(panel).toBeVisible();
  await ficha.scrollIntoViewIfNeeded(); await expect(page.getByTestId("arena-player-stats")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  // 5. Registro sin entrenadores (arena-v1): faltas y tarjetas «no simulado», no 0.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Partidos guardados", exact: true }).click();
  await page.getByRole("button", { name: "Cargar ejemplo de IA grabado", exact: true }).click();
  await expect(page.getByTestId("arena-legacy-profile")).toBeVisible();
  await page.getByRole("slider", { name: "Tiempo de juego" }).press("End");
  for (const clave of ["faltas", "amarillas", "rojas"]) {
    await expect(fila(clave)).toContainText("no simulado en este registro");
    expect(await fila(clave).locator(".arena-stat-value").allTextContents()).toEqual(["—", "—"]);
  }
  expect(errores).toEqual([]);
});

// Revisión Codex (049) · Ciclo de favoritos montado en el navegador real: hidratación, errores de
// almacenamiento y preselección de un suplente.
const BLOQUEADO = "Your favourite could not be saved in this browser";

test("arena: localStorage cuyo getter lanza ⇒ aviso visible y el favorito se aplica en memoria", async ({ page }) => {
  const errores: string[] = []; page.on("pageerror", e => errores.push(e.message));
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new DOMException("bloqueado", "SecurityError"); } }));
  await page.goto("/arena");
  await expect(page.getByTestId("arena-player-card").getByRole("status")).toHaveText(BLOQUEADO);
  const estrella = page.locator('[data-testid="arena-favorite-club"][data-side="local"]');
  await estrella.click();
  await expect(estrella).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".arena-score > span").first()).toHaveAttribute("data-favorite", "true");
  expect(errores).toEqual([]);
});

test("arena: setItem que lanza al pulsar las estrellas ⇒ aviso y favoritos aplicados en memoria", async ({ page }) => {
  const errores: string[] = []; page.on("pageerror", e => errores.push(e.message));
  await page.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException("cuota", "QuotaExceededError"); }; });
  await page.goto("/arena");
  await expect(page.getByTestId("arena-favorite-club").first()).toBeEnabled();
  await expect(page.getByText(BLOQUEADO)).toHaveCount(0);
  const club = page.locator('[data-testid="arena-favorite-club"][data-side="visita"]');
  await club.click();
  await expect(page.getByTestId("arena-player-card").getByRole("status")).toHaveText(BLOQUEADO);
  await expect(club).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".arena-score > span").last()).toHaveAttribute("data-favorite", "true");
  await page.getByTestId("arena-favorite-player").click();
  await expect(page.getByTestId("arena-favorite-player")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("arena-player-card")).toHaveAttribute("data-favorite", "true");
  await expect(page.locator('[data-testid="arena-player"][data-favorite="true"]')).toHaveCount(1);
  expect(errores).toEqual([]);
});

test("arena: un suplente favorito guardado se preselecciona en la ficha al cargar el partido", async ({ page }) => {
  const ejemplo = JSON.parse(await readFile("public/experimentos/arena-llm-v3.json", "utf8")) as RegistroArena;
  const suplente = ejemplo.inicial.banco!.find(j => j.lado === "visita")!;
  const favoritos = { club: null, jugador: { club: ejemplo.config.partido.visita.nombre, dorsal: suplente.dorsal, nombre: suplente.nombre } };
  await page.addInitScript(([clave, valor]) => localStorage.setItem(clave, valor), [ESTADISTICAS_ARENA.claveFavoritos, JSON.stringify(favoritos)] as const);
  await page.goto("/arena");
  await page.getByRole("button", { name: "Saved matches", exact: true }).click();
  const respuesta = page.waitForResponse(r => new URL(r.url()).pathname === "/api/arena" && r.request().method() === "POST");
  await page.getByRole("button", { name: "Load AI coaches example", exact: true }).click();
  expect((await respuesta).ok()).toBe(true);
  const ficha = page.getByTestId("arena-player-card");
  await expect(ficha.getByRole("heading")).toContainText(suplente.nombre);
  await expect(ficha).toContainText("Available substitute");
  await expect(ficha).toHaveAttribute("data-favorite", "true");
  await expect(page.getByTestId("arena-favorite-player")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("arena-intelligence").getByRole("combobox", { name: "Audience" })).toHaveValue("player");
});
