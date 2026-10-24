// Brief 063 · publicación 2 (reinicios-v7) · B6 y smoke visual de los bloques B y C: la ficha muestra los seis
// atributos de `config.atributos` en EN y ES a 360 px sin desbordes; una grabación v5 muestra la nota «anterior a
// los atributos»; un balón largo y un remate lejano del fixture v7 se narran en los dos idiomas y, en el remate
// lejano, el portero se mueve hacia la trayectoria. Capturas en docs/evidencia/motor-063/smoke-bc/. Los datos
// esperados se leen del fixture y de las constantes; ninguna cifra se repite a mano.
import { mkdir, readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { atributosJugador, type RegistroArena } from "../src/arena/tipos";
import { ARENA, ATRIBUTOS_ARENA } from "../src/sim/limites";

test.describe.configure({ mode: "serial" });

const EVIDENCIA = "docs/evidencia/motor-063/smoke-bc";
const FIXTURE_V7 = "src/arena/__fixtures__/arena-reinicios-v7.json", FIXTURE_V5 = "src/arena/__fixtures__/arena-reinicios-v5.json";
const LEGADO = { en: "This recording predates player attributes.", es: "Esta grabación es anterior a los atributos de jugador." };
const LIMITES = { en: "Six synthetic attributes per player", es: "Seis atributos sintéticos por jugador" };
/** Ventana alta: la cancha entera queda visible bajo la cabecera fija del sitio. */
const VENTANA = { width: 1440, height: 1600 }, MOVIL = { width: 360, height: 780 };

const cursor = async (page: Page, segundos: number, es = false) => { await page.getByRole("slider", { name: es ? "Tiempo de juego" : "Match time" }).fill(String(Math.round(segundos * 10) / 10)); };
async function importar(page: Page, nombre: string, datos: Buffer, local: string, ventana = VENTANA) {
  await page.setViewportSize(ventana);
  await page.goto("/arena");
  await page.getByRole("button", { name: "Saved matches", exact: true }).click();
  const respuesta = page.waitForResponse(r => new URL(r.url()).pathname === "/api/arena" && r.request().method() === "POST");
  await page.getByLabel("Open saved run", { exact: true }).setInputFiles({ name: nombre, mimeType: "application/json", buffer: datos });
  expect((await respuesta).ok()).toBe(true);
  await expect(page.locator(".arena-score")).toContainText(local);
}
const sinDesborde = async (page: Page, ancho: number) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ancho);

test("063 B6 · ficha con los seis atributos de config.atributos en EN y ES a 360 px; la grabación v5 muestra la nota de grabación anterior", async ({ page }) => {
  await mkdir(EVIDENCIA, { recursive: true });
  const datos = await readFile(FIXTURE_V7), r = JSON.parse(datos.toString("utf8")) as RegistroArena;
  await importar(page, "arena-reinicios-v7.json", datos, r.config.partido.local.nombre, MOVIL);
  // El jugador con el mayor valor de cualquier atributo de la plantilla titular local.
  const titulares = r.inicial.jugadores.filter(j => j.lado === "local");
  const elegido = [...titulares].sort((a, b) => Math.max(...atributosJugador.map(k => r.config.atributos![b.id]![k])) - Math.max(...atributosJugador.map(k => r.config.atributos![a.id]![k])) || a.id.localeCompare(b.id))[0]!;
  await page.locator(`[data-testid="arena-roster-person"][data-person="${elegido.id}"]`).click();
  const ficha = page.getByTestId("arena-player-card"), seccion = page.getByTestId("arena-player-attributes");
  await expect(ficha).toContainText(elegido.nombre);
  for (const idioma of ["en", "es"] as const) {
    if (idioma === "es") await page.getByRole("button", { name: "Switch to Spanish" }).click();
    await expect(seccion.locator("meter")).toHaveCount(atributosJugador.length);
    for (const k of atributosJugador) {
      const fila = seccion.locator(`[data-atributo="${k}"]`), valor = r.config.atributos![elegido.id]![k];
      await expect(fila.locator("label")).toContainText(ATRIBUTOS_ARENA.etiquetas[idioma][k]);
      await expect(fila.locator("label .tnum")).toHaveText(String(valor));
      await expect(fila.locator("meter")).toHaveAttribute("value", String(valor));
      await expect(fila.locator("meter")).toHaveAttribute("min", "0");
      await expect(fila.locator("meter")).toHaveAttribute("max", "100");
    }
    await seccion.locator("details summary").click();
    for (const k of atributosJugador) await expect(seccion.locator("details")).toContainText(ATRIBUTOS_ARENA.efectos[idioma][k]);
    await expect(page.getByTestId("arena-legacy-attributes")).toHaveCount(0);
    await ficha.scrollIntoViewIfNeeded();
    await sinDesborde(page, MOVIL.width);
    await ficha.screenshot({ path: `${EVIDENCIA}/ficha-${idioma}-360.png` });
    await seccion.locator("details summary").click();
  }
  // Texto de límites de los bloques B y C (ES; luego EN).
  const limites = page.locator(".arena-limits");
  await limites.locator("summary").click();
  await expect(limites).toContainText(LIMITES.es);
  await page.getByRole("button", { name: "Cambiar a inglés" }).click();
  await expect(limites).toContainText(LIMITES.en);

  // Grabación v5: la ficha muestra la nota y no hay medidores de atributos; el límite no menciona los atributos.
  const v5 = await readFile(FIXTURE_V5), r5 = JSON.parse(v5.toString("utf8")) as RegistroArena;
  await importar(page, "arena-reinicios-v5.json", v5, r5.config.partido.local.nombre, MOVIL);
  await expect(page.getByTestId("arena-player-attributes")).toHaveCount(0);
  await expect(page.getByTestId("arena-legacy-attributes")).toHaveText(LEGADO.en);
  await page.getByTestId("arena-player-card").scrollIntoViewIfNeeded();
  await sinDesborde(page, MOVIL.width);
  await page.getByTestId("arena-player-card").screenshot({ path: `${EVIDENCIA}/ficha-v5-legado-en-360.png` });
  await page.getByRole("button", { name: "Switch to Spanish" }).click();
  await expect(page.getByTestId("arena-legacy-attributes")).toHaveText(LEGADO.es);
  await page.locator(".arena-limits summary").click();
  await expect(page.locator(".arena-limits")).not.toContainText(LIMITES.es);
});

test("063 C · un balón largo y un remate lejano del fixture v7, narrados en EN y ES; el portero va hacia la trayectoria del lejano", async ({ page }) => {
  await mkdir(EVIDENCIA, { recursive: true });
  const datos = await readFile(FIXTURE_V7), r = JSON.parse(datos.toString("utf8")) as RegistroArena;
  const plantilla = [...r.inicial.jugadores, ...r.inicial.banco ?? []], de = (id: string | null) => plantilla.find(j => j.id === id)!;
  const largo = r.eventos.find(e => e.tipo === "pase" && e.motivo === "largo")!, lejano = r.eventos.find(e => e.tipo === "tiro" && e.motivo === "lejano")!;
  const textos = {
    largo: { en: `${de(largo.jugador).nombre} (${de(largo.jugador).dorsal}) plays a long ball towards ${de(largo.receptor).nombre} (${Math.round(largo.distanciaM)} m).`, es: `${de(largo.jugador).nombre} (${de(largo.jugador).dorsal}) lanza un balón largo hacia ${de(largo.receptor).nombre} (${Math.round(largo.distanciaM)} m).` },
    lejano: { en: `${de(lejano.jugador).nombre} (${de(lejano.jugador).dorsal}) tries a long-range shot (${Math.round(lejano.distanciaM)} m).`, es: `${de(lejano.jugador).nombre} (${de(lejano.jugador).dorsal}) prueba desde lejos (${Math.round(lejano.distanciaM)} m).` },
  };
  await importar(page, "arena-reinicios-v7.json", datos, r.config.partido.local.nombre);
  const descripcion = page.getByTestId("arena-description");
  for (const idioma of ["en", "es"] as const) {
    if (idioma === "es") await page.getByRole("button", { name: "Switch to Spanish" }).click();
    for (const [nombre, e] of [["largo", largo], ["lejano", lejano]] as const) {
      await cursor(page, e.tick * ARENA.pasoS, idioma === "es");
      const fila = descripcion.locator(`li[data-event-id="${e.id}"]`);
      await expect(fila.locator(".arena-event-text")).toHaveText(textos[nombre][idioma]);
      await fila.scrollIntoViewIfNeeded();
      await fila.screenshot({ path: `${EVIDENCIA}/${nombre}-${idioma}.png` });
    }
  }
  // El portero rival durante el vuelo del remate lejano: dos fotogramas, con la cancha capturada.
  const portero = r.inicial.jugadores.find(j => j.lado !== lejano.lado && j.puesto === "POR")!;
  const ficha = (id: string) => page.getByTestId("arena-player").and(page.locator(`[data-player="${id}"]`));
  const posicion = async () => { const m = /translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)/.exec((await ficha(portero.id).getAttribute("transform")) ?? "")!; return { x: Number(m[1]), y: Number(m[2]) }; };
  const enVuelo = r.fotogramas.filter(f => f.tick >= lejano.tick && f.balon.vuelo?.tipo === "tiro" && f.balon.vuelo.lejano).slice(0, 2);
  expect(enVuelo.length).toBeGreaterThan(0);
  const vistos: { x: number; y: number }[] = [];
  for (const [k, f] of enVuelo.entries()) {
    await cursor(page, f.tick * ARENA.pasoS, true);
    vistos.push(await posicion());
    await page.getByTestId("arena-pitch").screenshot({ path: `${EVIDENCIA}/lejano-portero-${k + 1}.png` });
  }
  console.log("[063 smoke C]", JSON.stringify({ seed: r.config.partido.seed, largo: { s: largo.tick * ARENA.pasoS, m: Math.round(largo.distanciaM) }, lejano: { s: lejano.tick * ARENA.pasoS, m: Math.round(lejano.distanciaM) }, portero: portero.id, vistos }));
});
