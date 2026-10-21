import { wavMono } from "../src/arena/pista-audio";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { contextoNarradorArena } from "../src/arena/narrador";
import { construirRelato } from "../src/arena/relato";
import type { RegistroArena } from "../src/arena/tipos";

async function guardados(page: Page) {
  await page.getByRole("button", { name: "Saved matches", exact: true }).click();
  await page.getByText("Reproduce a specific match (advanced)", { exact: true }).click();
  await page.getByLabel("Match seed (optional)", { exact: true }).fill("42");
  await page.locator(".arena-plans > summary").click();
}

const audioPrueba = Buffer.from(await wavMono([new Float32Array(240000)], 24000).arrayBuffer()).toString("base64");

test("arena: la voz en vivo pide tramos de tres segundos y permite detenerlos", async ({ page, request }) => {
  const creada = await request.post("/api/arena/sesiones", { data: { seed: 73, segundos: 30, local: "auto", visita: "auto", seleccion: { modo: "programado" } } });
  expect(creada.status()).toBe(201); const { id } = await creada.json();
  const tramos: { desdeTick: number; hastaTick: number; modo: string }[] = [];
  try {
    await page.addInitScript(id => sessionStorage.setItem("cronista:arena:sesion", id), id);
    await page.route("**/api/arena/herramientas", route => route.fulfill({ json: { analista: false, voz: true } }));
    await page.route(`**/api/arena/sesiones/${id}/relato`, route => {
      const p = route.request().postDataJSON(); tramos.push(p);
      return route.fulfill({ json: { ...p, idioma: p.idioma, texto: "Confirmed play.", fuentes: [], fotogramas: [], fragmentos: [], audio: { base64: audioPrueba, tipo: "audio/wav" } } });
    });
    await page.goto("/arena");
    const voz = page.getByTestId("arena-narration");
    await expect(voz.getByRole("button", { name: "Live narration", exact: true })).toBeEnabled();
    await voz.getByRole("button", { name: "Live narration", exact: true }).click();
    await expect.poll(() => tramos.length, { timeout: 10000 }).toBeGreaterThan(0);
    await expect(voz.locator("summary")).toBeVisible({ visible: true });
    expect(tramos[0]!.hastaTick - tramos[0]!.desdeTick).toBe(30);
    expect(tramos[0]!.modo).toBe("vivo");
    await voz.locator("audio").dispatchEvent("ended");
    await expect.poll(() => tramos.length, { timeout: 10000 }).toBeGreaterThan(1);
    await voz.getByRole("button", { name: "Stop narration" }).click();
    await expect(voz.getByRole("button", { name: "Stop narration" })).toHaveCount(0);
    expect(tramos.every(p => p.hastaTick - p.desdeTick === 30)).toBe(true);
  } finally { await request.delete(`/api/arena/sesiones/${id}`); }
});

test("arena: analista con evidencia y narración completa por tramos, sin servicios de pago", async ({ page, request }) => {
  const creada = await request.post("/api/arena/sesiones", { data: { seed: 42, segundos: 12, local: "auto", visita: "auto", seleccion: { modo: "programado" } } });
  expect(creada.status()).toBe(201); const { id } = await creada.json();
  await page.addInitScript(id => sessionStorage.setItem("cronista:arena:sesion", id), id);
  await page.route("**/api/arena/herramientas", route => route.fulfill({ json: { analista: true, voz: true } }));
  await page.goto("/arena");
  await expect(page.getByTestId("arena-live-status")).toContainText("Match complete", { timeout: 20_000 });
  const registro = await (await request.get(`/api/arena/sesiones/${id}/registro`)).json() as RegistroArena;
  const h = contextoNarradorArena(registro, 120).at(-1)!;
  const consultas: unknown[] = [], tramos: { desdeTick: number; hastaTick: number }[] = [];
  await page.route(`**/api/arena/sesiones/${id}/analisis`, route => {
    consultas.push(route.request().postDataJSON());
    return route.fulfill({ json: { tick: 120, agente: "transporte-prueba", solicitudes: 2, uso: { entrada: 0, salida: 0 }, herramientas: [{ nombre: "consultar_eventos", argumentos: {}, hechos: [h.id] }], comentario: { tick: 120, modelo: "transporte-prueba", modo: "plantilla", principal: h.id, hechos: [h], oraciones: [{ texto_es: h.texto_es, texto_en: h.texto_en, hecho: h.id, apoyo: [] }], audit: [] } } });
  });
  await page.getByRole("button", { name: "Ask analyst", exact: true }).click();
  await expect(page.getByTestId("arena-assistant-answer")).toContainText(h.texto_en);
  expect(consultas).toEqual([{ tick: 120, pregunta: "momento", jugador: null, audiencia: "fan" }]);
  await page.route(`**/api/arena/sesiones/${id}/relato`, route => {
    const p = route.request().postDataJSON();
    // Brief 045 v3.1: las intervenciones de la mesa se piden por id; aquí fallan y se omiten (ver arena-mesa.spec.ts).
    if (p.intervencion) return route.fulfill({ status: 503, json: { error: "Sin voz de invitados en esta prueba" } });
    tramos.push({ desdeTick: p.desdeTick, hastaTick: p.hastaTick });
    const s = construirRelato(registro, p.desdeTick, p.hastaTick, p.modo, p.idioma);
    return route.fulfill({ json: { ...s, audio: { base64: audioPrueba, tipo: "audio/wav" } } });
  });
  const voz = page.getByTestId("arena-narration");
  await voz.getByRole("button", { name: "Listen from the start" }).click();
  await expect(voz.locator("summary")).toContainText("0–10 s");
  expect(tramos).toEqual([{ desdeTick: 0, hastaTick: 100 }, { desdeTick: 100, hastaTick: 120 }]);
  await voz.locator("audio").evaluate((a: HTMLAudioElement) => { a.pause(); a.currentTime = 11; });
  await expect(voz.locator("summary")).toContainText("10–12 s");
  await voz.locator("details").evaluate(e => { (e as HTMLDetailsElement).open = true; });
  await expect(voz).toContainText("Full time.");
  await voz.locator("audio").dispatchEvent("ended");
  await expect(voz.getByRole("status")).toHaveText("End of narration");
  expect(tramos).toEqual([{ desdeTick: 0, hastaTick: 100 }, { desdeTick: 100, hastaTick: 120 }]);
  await voz.getByRole("button", { name: "Listen from the start" }).click();
  await expect(voz.locator("summary")).toContainText("0–10 s");
  expect(tramos).toHaveLength(2);
  await voz.getByRole("button", { name: "Stop narration" }).click();
});

test("arena: sorteo y elección manual envían solo IDs del catálogo del servidor", async ({ page }) => {
  const selecciones: unknown[] = [];
  await page.route("**/api/arena/modelos", route => route.fulfill({ json: { modelos: [
    { id: "a", nombre: "Modelo A" }, { id: "b", nombre: "Modelo B" },
  ] } }));
  await page.route("**/api/arena/sesiones", async route => {
    selecciones.push(route.request().postDataJSON().seleccion);
    await route.fulfill({ status: 503, json: { error: "Prueba sin inferencia" } });
  });
  await page.goto("/arena");
  const panel = page.getByTestId("arena-live");
  await expect(panel.getByRole("combobox", { name: "Controller selection" })).toHaveValue("azar");
  await page.getByRole("button", { name: "Saved matches", exact: true }).click();
  await panel.getByRole("button", { name: "Generate match", exact: true }).click();
  await expect(panel.getByRole("alert")).toBeVisible();
  expect(selecciones).toEqual([{ modo: "azar" }]);
  await panel.getByRole("combobox", { name: "Controller selection" }).selectOption("manual");
  await panel.getByRole("combobox", { name: "Home model" }).selectOption("b");
  await panel.getByRole("combobox", { name: "Away model" }).selectOption("a");
  await panel.getByRole("button", { name: "Generate match", exact: true }).click();
  await expect(panel.getByRole("alert")).toBeVisible();
  expect(selecciones).toEqual([{ modo: "azar" }, { modo: "manual", local: "b", visita: "a" }]);
});

test("arena: duelo real archivado entre dos modelos, sin respaldos ni nuevas inferencias", async ({ page }) => {
  await page.goto("/arena");
  await guardados(page);
  await page.getByRole("button", { name: "Load recorded model duel" }).click();
  await expect(page.locator(".arena-controller")).toContainText(["cronista-equilibrado", "cronista-rapido"]);
  await expect(page.getByText("Two independent controllers using the same model deployment.")).toHaveCount(0);
  await page.getByRole("slider", { name: "Match time" }).press("End");
  await expect(page.getByTestId("arena-clock")).toHaveText("1:00 / 1:00");
  await expect(page.locator(".arena-fallback")).toHaveCount(0);
  await expect(page.getByTestId("arena-player")).toHaveCount(22);
  await page.screenshot({ path: ".cache/arena-duelo-escritorio.png", fullPage: true });
});

test("arena: transmisión incremental, reconexión al mismo encuentro y archivo final", async ({ page, request }) => {
  const r = await request.post("/api/arena/sesiones", { data: { seed: 99, segundos: 8, local: "auto", visita: "auto", seleccion: { modo: "programado" } } });
  expect(r.status()).toBe(201); const { id } = await r.json();
  await page.addInitScript(id => sessionStorage.setItem("cronista:arena:sesion", id), id);
  await page.goto("/arena");
  await expect(page.getByTestId("arena-live-status")).toContainText(/Live|Coaches|Connecting/);
  await expect(page.getByLabel("Home formation")).toBeDisabled();
  await expect.poll(() => page.getByTestId("arena-clock").innerText()).not.toBe("0:00 / 0:08");
  const antes = await page.getByTestId("arena-clock").innerText();
  await page.reload();
  await expect(page.getByTestId("arena-live-status")).toContainText(/Live|Coaches|complete/);
  await expect(page.getByTestId("arena-live-status")).toContainText("Match complete", { timeout: 20_000 });
  await expect(page.getByTestId("arena-clock")).toHaveText("0:08 / 0:08");
  expect(antes).not.toBe("0:08 / 0:08");
  const archivo = await request.get(`/api/arena/sesiones/${id}/registro`);
  expect(archivo.status()).toBe(200); const registro = await archivo.json();
  expect(registro.final.tick).toBe(80);
  expect((await request.post("/api/arena", { data: { accion: "reproducir", registro } })).status()).toBe(200);
});

test("arena: cancelar en vivo y personalizar la inteligencia con evidencia", async ({ page }) => {
  const errores: string[] = []; page.on("pageerror", e => errores.push(e.message));
  await page.goto("/arena");

  await page.getByRole("button", { name: "Start live match", exact: true }).click();
  await expect(page.getByTestId("arena-live-status")).toContainText(/Live|Coaches|Connecting/);
  await page.getByRole("button", { name: "Cancel live match" }).click();
  await expect(page.getByTestId("arena-live-status")).toHaveText("Match cancelled");
  await guardados(page);
  await expect(page.getByRole("button", { name: "Download run" })).toBeDisabled();
  await page.getByRole("button", { name: "Create recording without AI" }).click();
  await expect(page.getByRole("button", { name: "Download run" })).toBeEnabled();
  await page.getByRole("slider", { name: "Match time" }).press("End");
  const inteligencia = page.getByTestId("arena-intelligence");
  await inteligencia.getByRole("combobox", { name: "Audience" }).selectOption("analyst");
  await expect(inteligencia.getByRole("table")).toBeVisible();
  await inteligencia.getByRole("button", { name: /^Evidence for/ }).first().click();
  await expect(page.getByTestId("arena-intelligence-evidence")).toBeVisible();
  await inteligencia.getByRole("combobox", { name: "Audience" }).selectOption("player");
  await expect(inteligencia).toContainText("Select another player");
  expect(errores).toEqual([]);
});

test("arena: 22 jugadores, movimiento, pausa y selección temporal", async ({ page }) => {
  const errores: string[] = [];
  page.on("pageerror", e => errores.push(e.message));
  await page.goto("/arena");
  await expect(page.getByTestId("arena-player")).toHaveCount(22);
  await expect(page.getByTestId("arena-referee")).toHaveCount(1);
  const jugador = page.getByTestId("arena-player").nth(5);
  const antes = await jugador.getAttribute("transform");
  const arbitro = page.getByTestId("arena-referee"), arbitroAntes = await arbitro.getAttribute("transform");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(() => jugador.getAttribute("transform")).not.toBe(antes);
  await expect.poll(() => arbitro.getAttribute("transform")).not.toBe(arbitroAntes);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const pausado = await jugador.getAttribute("transform");
  const arbitroPausado = await arbitro.getAttribute("transform");
  await page.waitForTimeout(200);
  expect(await jugador.getAttribute("transform")).toBe(pausado);
  expect(await arbitro.getAttribute("transform")).toBe(arbitroPausado);
  await page.getByRole("slider", { name: "Match time" }).press("End");
  await expect(page.getByTestId("arena-clock")).toHaveText("1:00 / 1:00");
  await expect(page.getByRole("region", { name: "Event narration" })).toContainText(/attempts|receives|intercepts|Goal|shot|restart|offside|control/);
  expect(errores).toEqual([]);
});
test("arena: espera visible, una petición y controles deshabilitados", async ({ page }) => {
  await page.goto("/arena");
  await guardados(page);
  await page.getByLabel("Home formation").selectOption("4-4-2");
  let liberar!: () => void, peticiones = 0;
  const barrera = new Promise<void>(r => { liberar = r; });
  await page.route("**/api/arena", async route => { peticiones++; await barrera; await route.continue(); });
  try {
    await page.getByRole("button", { name: "Create recording without AI" }).click();
    await expect(page.getByTestId("match-loading")).toContainText("Resolving the experiment");
    await expect(page.getByLabel("Home formation")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Create recording without AI" })).toBeDisabled();
    await page.locator(".arena-settings").evaluate((f: HTMLFormElement) => f.requestSubmit());
    await expect.poll(() => peticiones).toBe(1);
  } finally { liberar(); }
  await expect(page.getByTestId("match-loading")).toBeHidden();
  await expect(page.locator(".arena-shape").first()).toContainText("4-4-2");
  expect(peticiones).toBe(1);
});
test("arena: error recuperable, descarga íntegra e importación comprobada", async ({ page }) => {
  await page.goto("/arena");
  await guardados(page);
  await page.route("**/api/arena", route => route.fulfill({ status: 503, body: "error" }), { times: 1 });
  await page.getByRole("button", { name: "Create recording without AI" }).click();
  await expect(page.getByTestId("arena").getByRole("alert")).toContainText("previous run is still available");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByTestId("arena").getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Download run" })).toBeEnabled();
  const descarga = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download run" }).click();
  const archivo = await descarga;
  const datos = await readFile((await archivo.path())!);
  const registro = JSON.parse(datos.toString());
  expect(registro.final.tick).toBe(600);
  expect(registro.rondas.every((r: { decisiones: { local: { tipo: string } } }) => r.decisiones.local.tipo === "programado")).toBe(true);
  await page.getByLabel("Open saved run", { exact: true }).setInputFiles({ name: "arena.json", mimeType: "application/json", buffer: datos });
  await expect(page.getByText("Imported recording:", { exact: false })).toBeVisible();
  registro.final.marcador.local++;
  await page.getByLabel("Open saved run", { exact: true }).setInputFiles({ name: "alterado.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(registro)) });
  await expect(page.getByTestId("arena").getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("arena-player")).toHaveCount(22);
  await expect(page.getByTestId("arena-referee")).toHaveCount(1);
});
test("arena: móvil oscuro, español y movimiento reducido sin desborde", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/arena");
  await page.getByRole("button", { name: "Switch to Spanish" }).click();
  await expect(page.getByRole("heading", { name: "Dos equipos. Una misma cancha." })).toBeVisible();
  await expect(page.getByText("Movimiento reducido: estados discretos.", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  const caja = await page.getByTestId("arena-pitch").boundingBox();
  expect(caja!.x).toBeGreaterThanOrEqual(0); expect(caja!.x + caja!.width).toBeLessThanOrEqual(360);
  await expect(page.getByTestId("arena-player")).toHaveCount(22);
  await expect(page.getByTestId("arena-referee")).toHaveCount(1);
  await page.getByTestId("arena-roster-person").last().click();
  await expect(page.getByTestId("arena-player-card").getByRole("meter")).toHaveCount(9);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.screenshot({ path: ".cache/arena-v3-movil.png", fullPage: true });
});
test("arena: ejemplo real archivado, dos controladores del mismo modelo y reproducción sin inferencia", async ({ page }) => {
  const externos: string[] = [];
  page.on("request", req => { if (/openai\.azure\.com|services\.ai\.azure\.com/.test(req.url())) externos.push(req.url()); });
  await page.goto("/arena");
  await guardados(page);
  await page.getByRole("button", { name: "Load recorded AI run" }).click();
  await expect(page.getByText("Two independent controllers using the same model deployment.")).toBeVisible();
  await expect(page.getByTestId("arena-clock")).toHaveText("0:00 / 0:10");
  await expect(page.getByTestId("arena-referee")).toHaveCount(0);
  await expect(page.getByTestId("arena-legacy-profile")).toBeVisible();
  await expect(page.locator(".arena-controller")).toContainText(["azure-openai:gpt-6.1-sol", "azure-openai:gpt-6.1-sol"]);
  await page.getByRole("slider", { name: "Match time" }).press("End");
  await expect(page.getByTestId("arena-clock")).toHaveText("0:10 / 0:10");
  expect(externos).toEqual([]);
});

test("arena: perfiles, capitanes y selección accesible desde la cancha y la plantilla", async ({ page }) => {
  const errores: string[] = [];
  page.on("pageerror", e => errores.push(e.message));
  await page.goto("/arena");
  await expect(page.locator('[data-testid="arena-player"][data-captain="true"]')).toHaveCount(2);
  await expect(page.getByTestId("arena-referee").locator("rect")).toHaveCount(1);
  await expect(page.getByTestId("arena-player-card")).toContainText("Captain");
  await expect(page.getByTestId("arena-roster-person")).toHaveCount(11);
  const destino = page.locator('[data-testid="arena-player"][data-player^="visita-"]').nth(5);
  const nombre = (await destino.getAttribute("aria-label"))!.split(" · ")[0]!;
  await destino.focus(); await destino.press("Enter");
  await expect(destino).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("arena-player-card").getByRole("heading")).toContainText(nombre);
  await expect(page.getByTestId("arena-roster-person").first()).toHaveAttribute("data-person", /^visita-/);
  await expect(page.getByTestId("arena-player-card").getByRole("meter")).toHaveCount(9);
  await page.getByTestId("arena-roster-person").first().click();
  const primerId = await page.getByTestId("arena-roster-person").first().getAttribute("data-person");
  await expect(page.locator(`[data-player="${primerId}"]`)).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Switch to Spanish" }).click();
  await expect(page.getByTestId("arena-player-card").getByLabel("Preferencia de pase")).toBeVisible();
  await page.getByText("Cómo influyen los rasgos", { exact: true }).click();
  await expect(page.getByTestId("arena-player-card")).toContainText("riesgo de falta");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: ".cache/arena-v3-escritorio.png", fullPage: true });
  await page.getByTestId("arena-context").screenshot({ path: ".cache/arena-v3-contexto.png" });
  expect(errores).toEqual([]);
});

test("arena: ejemplo real de entrenadores con cuatro decisiones válidas y sin inferencia al cargar", async ({ page }) => {
  const errores: string[] = [], externos: string[] = [];
  page.on("pageerror", e => errores.push(e.message));
  page.on("request", req => { if (/openai\.azure\.com|services\.ai\.azure\.com/.test(req.url())) externos.push(req.url()); });
  await page.goto("/arena");
  await guardados(page);
  await page.getByRole("button", { name: "Load AI coaches example", exact: true }).click();
  await expect(page.getByText("Two independent controllers using the same model deployment.")).toBeVisible();
  await expect(page.getByTestId("arena-coach-local")).toContainText("Elio Ulvino");
  await expect(page.locator(".arena-fallback")).toHaveCount(0);
  await page.getByRole("slider", { name: "Match time" }).press("End");
  await expect(page.getByTestId("arena-coach-local")).toContainText("Vamos por detrás");
  await expect(page.getByTestId("arena-clock")).toHaveText("1:00 / 1:00");
  expect(errores).toEqual([]); expect(externos).toEqual([]);
});

test("arena: entrenadores, entorno configurable y banco con perfiles", async ({ page }) => {
  const errores: string[] = []; page.on("pageerror", e => errores.push(e.message));
  await page.goto("/arena");
  await guardados(page);
  await expect(page.getByTestId("arena-coach-local")).toContainText("Elio Ulvino");
  await expect(page.getByTestId("arena-bench-person")).toHaveCount(5);
  await page.getByTestId("arena-bench-person").first().click();
  await expect(page.getByTestId("arena-player-card")).toContainText("Available substitute");
  await page.getByTestId("arena-coach-local").getByText("Coach traits", { exact: true }).click();
  await expect(page.getByTestId("arena-coach-local").getByRole("meter")).toHaveCount(10);
  await page.getByText("Choose weather, pitch and crowd pressure", { exact: true }).click();
  await page.getByRole("combobox", { name: "Weather", exact: true }).selectOption("lluvia");
  await page.getByRole("combobox", { name: "Surface", exact: true }).selectOption("sintetica");
  await page.getByRole("combobox", { name: "Home formation", exact: true }).selectOption("3-5-2");
  await page.getByRole("button", { name: "Create recording without AI" }).click();
  await expect(page.getByTestId("arena-environment")).toContainText("Rain");
  await expect(page.getByTestId("arena-environment")).toContainText("Artificial surface");
  await expect(page.getByTestId("arena-coach-local")).toContainText("3-5-2");
  await page.getByText("What these conditions change", { exact: true }).click();
  await expect(page.getByTestId("arena-context")).toContainText("+0.50 m");
  await expect(page.getByTestId("arena-context")).toContainText("×1.12");
  await page.getByTestId("arena-coach-local").getByText("Formation with player names", { exact: true }).click();
  await expect(page.getByTestId("arena-coach-local").locator(".arena-lineup-names button")).toHaveCount(11);
  await page.getByRole("slider", { name: "Match time" }).press("End");
  await expect(page.getByTestId("arena-coach-local")).toContainText("Latest decision");
  const evidencia = page.getByTestId("arena-context").getByRole("button", { name: /^Inspect event/ }).first();
  const id = await evidencia.textContent();
  await evidencia.click();
  await expect(page.getByRole("region", { name: "Event narration" })).toContainText(id!);
  expect(errores).toEqual([]);
});

test("arena: cambios durante la reproducción, descarga y reimportación v3", async ({ page }) => {
  const errores: string[] = []; page.on("pageerror", e => errores.push(e.message));
  await page.goto("/arena");
  await guardados(page);
  await page.getByRole("combobox", { name: "Simulated duration", exact: true }).selectOption("180");
  await page.getByRole("button", { name: "Create recording without AI" }).click();
  await expect(page.getByTestId("arena-clock")).toHaveText("0:00 / 3:00");
  const descarga = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download run" }).click();
  const datos = await readFile((await (await descarga).path())!);
  const r = JSON.parse(datos.toString());
  expect(r.version).toBe("arena-v3");
  const cambio = r.eventos.find((e: { tipo: string }) => e.tipo === "cambio");
  expect(cambio).toBeTruthy();
  await page.getByRole("slider", { name: "Match time" }).press("End");
  const nuevo = r.final.jugadores.find((j: { id: string }) => !r.inicial.jugadores.some((p: { id: string }) => p.id === j.id));
  const retirado = r.final.retirados[0];
  await expect(page.locator(`[data-player="${nuevo.id}"]`)).toHaveCount(1);
  await expect(page.locator(`[data-player="${retirado.id}"]`)).toHaveCount(0);
  await page.getByLabel("Open saved run", { exact: true }).setInputFiles({ name: "arena-v3.json", mimeType: "application/json", buffer: datos });
  await expect(page.getByText("Imported recording:", { exact: false })).toBeVisible();
  await expect(page.getByTestId("arena-coach-local")).toBeVisible();
  expect(errores).toEqual([]);
});

test("arena: generar primero entrega el partido pausado, comparte el registro y permite reproducir sin red", async ({ page, request, context }) => {
  const errores: string[] = []; page.on("pageerror", e => errores.push(e.message));
  await page.goto("/arena");
  const panel = page.getByTestId("arena-live");
  await page.getByRole("button", { name: "Saved matches", exact: true }).click();
  const inicio = page.waitForResponse(r => r.url().endsWith("/api/arena/sesiones") && r.request().method() === "POST");
  await panel.getByRole("button", { name: "Generate match", exact: true }).click();
  const respuesta = await inicio;
  expect(respuesta.request().postDataJSON().presentacion).toBe("preparada");
  const { id } = await respuesta.json();
  await expect(panel.getByRole("status")).toContainText("Match ready");
  await expect(page.getByTestId("arena-clock")).toHaveText("0:00 / 1:00");
  const guardado = await request.get(`/api/arena/sesiones/${id}/reproduccion`);
  expect(guardado.status()).toBe(200);
  expect(guardado.headers()["cache-control"]).toContain("max-age=86400");
  const resultado = await guardado.json(); expect(resultado.registro.final.tick).toBe(600);
  const enlace = panel.getByRole("link", { name: "Open or share this saved match" });
  expect(await enlace.getAttribute("href")).toBe(`/arena?partido=${id}`);
  const otro = await context.newPage();
  let nuevasSesiones = 0;
  otro.on("request", r => { if (r.url().endsWith("/api/arena/sesiones") && r.method() === "POST") nuevasSesiones++; });
  await otro.goto(`/arena?partido=${id}`);
  await expect(otro.getByTestId("arena-live-status")).toContainText("Match ready");
  await expect(otro.getByTestId("arena-clock")).toHaveText("0:00 / 1:00");
  expect(nuevasSesiones).toBe(0); await otro.close();
  await page.route("**/api/arena/**", route => route.abort());
  const jugador = page.getByTestId("arena-player").nth(5), antes = await jugador.getAttribute("transform");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(() => jugador.getAttribute("transform")).not.toBe(antes);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  expect(errores).toEqual([]);
});

test("arena: prepara todos los audios antes de sonar, sigue un reloj continuo y cancela sin publicar audio parcial", async ({ page, request }) => {
  const creada = await request.post("/api/arena/sesiones", { data: { seed: 42, segundos: 12, local: "auto", visita: "auto", seleccion: { modo: "programado" }, presentacion: "preparada" } });
  const { id } = await creada.json();
  await page.route("**/api/arena/herramientas", route => route.fulfill({ json: { voz: true, analista: false } }));
  await expect.poll(async () => (await request.get(`/api/arena/sesiones/${id}/registro`)).status()).toBe(200);
  const registro = await (await request.get(`/api/arena/sesiones/${id}/registro`)).json() as RegistroArena;
  let liberar!: () => void; const barrera = new Promise<void>(r => { liberar = r; });
  let solicitudes = 0;
  await page.route(`**/api/arena/sesiones/${id}/relato`, async route => {
    const p = route.request().postDataJSON();
    // Brief 045 v3.1: las intervenciones de la mesa se piden por id; aquí fallan y se omiten (ver arena-mesa.spec.ts).
    if (p.intervencion) return route.fulfill({ status: 503, json: { error: "Sin voz de invitados en esta prueba" } }).catch(() => {});
    solicitudes++;
    if (p.desdeTick === 100) await barrera;
    await route.fulfill({ json: { ...construirRelato(registro, p.desdeTick, p.hastaTick, p.modo, p.idioma), audio: { base64: audioPrueba, tipo: "audio/wav" } } }).catch(() => {});
  });
  await page.goto(`/arena?partido=${id}`);
  await expect(page.getByTestId("arena-live-status")).toContainText("Match ready");
  const voz = page.getByTestId("arena-narration");
  await voz.getByRole("button", { name: "Listen from the start" }).click();
  // El progreso cuenta tramos e intervenciones del diario (brief 045 v3.1).
  const { intervenciones } = await (await request.get(`/api/arena/sesiones/${id}/reproduccion`)).json() as { intervenciones: unknown[] };
  await expect(voz.getByRole("status")).toHaveText(`Preparing narration: 1/${2 + intervenciones.length} passages`);
  await expect(voz.locator("audio")).not.toHaveAttribute("src", /blob:/);
  await expect(page.getByTestId("arena-clock")).toHaveText("0:00 / 0:12");
  liberar();
  await expect(voz.locator("audio")).toHaveAttribute("src", /blob:/);
  await voz.locator("audio").evaluate((a: HTMLAudioElement) => { a.pause(); a.currentTime = 15; });
  await expect(voz.locator("summary")).toContainText("10–12 s");
  await expect(page.getByTestId("arena-clock")).toHaveText("0:11 / 0:12");
  expect(solicitudes).toBe(2);
  await voz.getByRole("button", { name: "Stop narration" }).click();
  await expect(voz.locator("audio")).not.toHaveAttribute("src", /blob:/);
  expect(solicitudes).toBe(2);
});

test("arena: prepara una pista continua con los seis MP3 reales archivados, sin llamadas de Azure", async ({ page }) => {
  const informe = JSON.parse(await readFile("docs/evidencia/voz-expresiva/relato-completo.json", "utf8"));
  const grabacion = JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;
  const completo = await readFile("docs/evidencia/voz-expresiva/duelo-es-completo.mp3");
  const bloques = new Map<number, Buffer>(); let offset = 0;
  for (const s of informe.segments) { bloques.set(s.desdeTick, completo.subarray(offset, offset + s.bytes)); offset += s.bytes; }
  expect(offset).toBe(completo.length);
  const id = "00000000-0000-4000-8000-000000000037";
  await page.route("**/api/arena/herramientas", r => r.fulfill({ json: { voz: true, analista: false } }));
  await page.route("**/api/arena/grabaciones", r => r.fulfill({ json: { id } }));
  let solicitudes = 0;
  await page.route(`**/api/arena/sesiones/${id}/relato`, r => {
    const p = r.request().postDataJSON(); solicitudes++;
    return r.fulfill({ json: { ...construirRelato(grabacion, p.desdeTick, p.hastaTick, p.modo, p.idioma), audio: { base64: bloques.get(p.desdeTick)!.toString("base64"), tipo: "audio/mpeg" } } });
  });
  await page.goto("/arena");
  await page.getByRole("button", { name: "Saved matches", exact: true }).click();
  await page.getByRole("button", { name: "Switch to Spanish" }).click();
  await page.getByRole("button", { name: "Cargar duelo de modelos grabado" }).click();
  const voz = page.getByTestId("arena-narration");
  await voz.getByRole("button", { name: "Activar narración de esta grabación" }).click();
  await voz.getByRole("button", { name: "Escuchar desde el inicio" }).click();
  await expect(voz.locator("audio")).toHaveAttribute("src", /blob:/);
  await expect.poll(() => voz.locator("audio").evaluate((a: HTMLAudioElement) => Number.isFinite(a.duration) && a.duration > 200)).toBe(true);
  const duracion = await voz.locator("audio").evaluate((a: HTMLAudioElement) => { a.pause(); return a.duration; });
  expect(duracion).toBeCloseTo(informe.decoded.durationSeconds, 0);
  expect(solicitudes).toBe(6);
  await voz.locator("audio").evaluate((a: HTMLAudioElement) => { a.currentTime = 80; });
  await expect(voz.locator("summary")).toContainText("20–30 s");
  await expect(page.getByTestId("arena-clock")).not.toHaveText("0:00 / 1:00");
  await page.setViewportSize({ width: 360, height: 780 }); await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.screenshot({ path: ".cache/partido-preparado-movil.png", fullPage: true });
  await voz.locator("audio").dispatchEvent("ended");
  await expect(page.getByTestId("arena-clock")).toHaveText("1:00 / 1:00");
  await expect(voz.getByRole("status")).toHaveText("Fin de la narración");
  expect(solicitudes).toBe(6);
});

test("arena: cancelar la preparación o cambiar idioma descarta las respuestas atrasadas", async ({ page, request }) => {
  const creada = await request.post("/api/arena/sesiones", { data: { seed: 42, segundos: 12, local: "auto", visita: "auto", seleccion: { modo: "programado" }, presentacion: "preparada" } });
  const { id } = await creada.json();
  await page.route("**/api/arena/herramientas", r => r.fulfill({ json: { voz: true, analista: false } }));
  let liberar!: () => void; const barrera = new Promise<void>(r => { liberar = r; });
  let solicitudes = 0;
  await page.route(`**/api/arena/sesiones/${id}/relato`, async r => {
    solicitudes++; await barrera;
    await r.fulfill({ json: { ...r.request().postDataJSON(), texto: "Respuesta atrasada", fuentes: [], fotogramas: [], audio: { base64: audioPrueba, tipo: "audio/wav" } } }).catch(() => {});
  });
  await page.goto(`/arena?partido=${id}`);
  await expect(page.getByTestId("arena-live-status")).toContainText("Match ready");
  const voz = page.getByTestId("arena-narration");
  await voz.getByRole("button", { name: "Listen from the start" }).click();
  await expect.poll(() => solicitudes).toBe(1);
  await voz.getByRole("button", { name: "Stop narration" }).click();
  await expect(voz.getByRole("status")).toHaveText("Audio off");
  await voz.getByRole("button", { name: "Listen from the start" }).click();
  await expect.poll(() => solicitudes).toBe(2);
  await page.getByRole("button", { name: "Switch to Spanish" }).click();
  liberar();
  await expect(voz.getByRole("status")).toHaveText("Audio desactivado");
  await expect(voz.locator("audio")).not.toHaveAttribute("src", /blob:/);
  await expect(voz.locator("summary")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reproducir", exact: true })).toBeEnabled();
});

test("arena: un fallo al cargar el registro permite reconectar sin generar otro partido", async ({ page }) => {
  await page.goto("/arena");
  let creadas = 0;
  page.on("request", r => { if (r.url().endsWith("/api/arena/sesiones") && r.method() === "POST") creadas++; });
  await page.route("**/reproduccion", r => r.fulfill({ status: 503, json: { error: "Fallo de transporte de prueba" } }), { times: 1 });
  const panel = page.getByTestId("arena-live");
  await page.getByRole("button", { name: "Saved matches", exact: true }).click();
  await panel.getByRole("button", { name: "Generate match", exact: true }).click();
  await expect(panel.getByRole("alert")).toBeVisible();
  await panel.getByRole("button", { name: "Reconnect to this match" }).click();
  await expect(panel.getByRole("status")).toContainText("Match ready");
  await expect(page.getByTestId("arena-clock")).toHaveText("0:00 / 1:00");
  expect(creadas).toBe(1);
});
