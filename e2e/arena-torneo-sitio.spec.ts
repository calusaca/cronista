// Brief 062 § 10 (P1-a: e2e 1, 3, 4, 5 y 7) · Torneo lanzable desde el sitio, sin IA. El servidor del e2e corre con
// ARENA_TORNEO_SITIO=1 en ENSAYO (participantes a–f programados, 10 s por partido, sin ritmo) y un almacén local que
// scripts/e2e-torneos.mjs vacía y siembra con el fixture del sitio (src/arena/__fixtures__/torneos-sitio: una liga de
// ensayo del 2026-10-20). El lanzamiento real (prueba 4) va al final: consume el cupo de hoy y se cancela con el token
// de administración del e2e para no dejar un torneo activo.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { expect, test, type Page } from "@playwright/test";
import { TOKEN_ADMIN_E2E } from "../playwright.config";

test.describe.configure({ mode: "serial" });
const FIXTURE = "sitio-2026-10-20", DIR = "src/arena/__fixtures__/torneos-sitio";
const fixture = JSON.parse(readFileSync(`${DIR}/${FIXTURE}.torneo.json`, "utf8")) as { encuentros: { n: number; local: { goles: number }; visita: { goles: number } }[] };
type Ficha = { disponible: boolean; partidos: { min: number; max: number }; topeMicroUsd: number; duracionMin: { min: number; max: number } };
const rango = (r: { min: number; max: number }) => (r.min === r.max ? String(r.min) : `${r.min}–${r.max}`);
const fueraDeScroll = (page: Page, testid: string) => page.getByTestId(testid).evaluate(e => { for (let p = e.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll") return false; } return true; });

test("1 · lista con los dos orígenes, rótulo del sitio y cifras del panel iguales a GET /api/arena/torneos/sitio", async ({ page, request }) => {
  const estado = await (await request.get("/api/arena/torneos/sitio")).json() as { formatos: Record<"liga" | "grupos", Ficha> };
  await page.goto("/arena/torneo");
  await expect(page.getByRole("heading", { level: 2, name: "Tournaments" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Archived in the repository · validated in CI" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Launched on the site · validated on the server" })).toBeVisible();
  await expect(page.getByTestId("arena-torneo-lista-lanzados").locator(`[data-id="${FIXTURE}"]`)).toHaveCount(1);
  await expect(page.getByTestId("arena-torneo-lista-archivados").locator(`[data-id="${FIXTURE}"]`)).toHaveCount(0);
  for (const f of ["liga", "grupos"] as const) {
    const cifras = page.getByTestId(`arena-torneo-cifras-${f}`), ficha = estado.formatos[f];
    await expect(cifras).toContainText(`${rango(ficha.partidos)} matches`);
    await expect(cifras).toContainText(`cap ${ficha.topeMicroUsd / 1_000_000} USD`);
    await expect(cifras).toContainText(`≈ ${rango(ficha.duracionMin)} min`);
  }
  await expect(page.getByRole("radio", { name: /Groups \+ knockout/ })).toBeDisabled();
  await expect(page.getByTestId("arena-torneo-cifras-grupos")).toContainText("Coming soon");
  await expect(page.getByRole("radio", { name: /League · double round robin/ })).toBeChecked();
  await page.getByTestId("arena-torneo-lista-lanzados").locator(`[data-id="${FIXTURE}"] a`).click();
  await expect(page).toHaveURL(new RegExp(`/arena/torneo/${FIXTURE}$`));
  await expect(page.getByTestId("arena-torneo-rotulo")).toHaveText("Launched on the site · validated on the server after each match");
  await expect(page.getByText("† declared by the server; not verifiable from the record")).toBeVisible();
  await expect(page.getByTestId("arena-torneo-fila")).toHaveCount(6);
});

test("3 · «Watch replay» de un partido del sitio abre /arena con su marcador, la procedencia y «Back to the tournament»", async ({ page }) => {
  await page.goto(`/arena/torneo/${FIXTURE}`);
  await page.getByRole("link", { name: "Watch replay of match 1", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/arena\\?torneo=${FIXTURE}&encuentro=01$`));
  const origen = page.getByTestId("arena-torneo-origen");
  await expect(origen).toContainText("Match 1 of the");
  await expect(origen.getByRole("link", { name: "Back to the tournament" })).toHaveAttribute("href", `/arena/torneo/${FIXTURE}`);
  const e = fixture.encuentros.find(x => x.n === 1)!;
  await page.getByRole("slider", { name: "Match time" }).press("End");
  await expect(page.locator(".arena-score strong")).toHaveText(`${e.local.goles}–${e.visita.goles}`);
  await page.getByRole("button", { name: "Restart" }).click();
  const balon = page.getByTestId("arena-ball"), antes = await balon.getAttribute("cx");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(async () => await balon.getAttribute("cx"), { timeout: 10_000 }).not.toBe(antes);
});

test("3b · el registro del sitio se sirve por la ruta del manifiesto con su huella; fuera del manifiesto, 404", async ({ request }) => {
  const r = await request.get(`/api/arena/torneos/sitio/${FIXTURE}/e01.json.gz`);
  expect(r.status()).toBe(200);
  expect(gunzipSync(await r.body()).toString("utf8")).toBe(gunzipSync(readFileSync(`${DIR}/${FIXTURE}.e01.json.gz`)).toString("utf8"));
  expect((await request.get(`/api/arena/torneos/sitio/${FIXTURE}/e99.json.gz`)).status()).toBe(404);
});

test("5 · un POST con un Origin ajeno da 403 (y sin JSON, 415)", async ({ request }) => {
  expect((await request.post("/api/arena/torneos/sitio", { headers: { origin: "https://evil.example", "content-type": "application/json" }, data: { formato: "liga" } })).status()).toBe(403);
  expect((await request.post("/api/arena/torneos/sitio", { headers: { origin: new URL(test.info().project.use.baseURL!).origin, "content-type": "text/plain" }, data: "{}" })).status()).toBe(415);
});

for (const tema of ["light", "dark"] as const) for (const idioma of ["en", "es"] as const) {
  test(`7 · 360 px (${tema}, ${idioma}): panel y liga del fixture sin desplazamiento; tabla y matriz fuera de contenedores desplazables`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, colorScheme: tema });
    const page = await ctx.newPage();
    const q = idioma === "es" ? "?lang=es" : "";
    await page.goto(`/arena/torneo${q}`);
    await expect(page.getByTestId("arena-torneo-cifras-liga")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await page.goto(`/arena/torneo/${FIXTURE}${q}`);
    await expect(page.getByTestId("arena-torneo-tabla")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    for (const id of ["arena-torneo-tabla", "arena-torneo-matriz"]) {
      expect((await page.getByTestId(id).boundingBox())!.width).toBeLessThanOrEqual(328);
      expect(await fueraDeScroll(page, id)).toBe(true);
    }
    await ctx.close();
  });
}

test("4 · lanzar una liga: confirmación, 202 y «In play»; al recargar, el botón está deshabilitado por el cupo y un POST directo da 409", async ({ page, request, baseURL }) => {
  await page.goto("/arena/torneo");
  const iniciar = page.getByRole("button", { name: "Start new tournament" });
  await expect(iniciar).toBeEnabled();
  await iniciar.click();
  await expect(page.getByRole("heading", { level: 3, name: "Confirm today's tournament" })).toBeFocused();
  await expect(page.getByTestId("arena-torneo-confirmar")).toContainText("You are about to launch today's tournament for the whole site: League");
  const respuesta = page.waitForResponse(r => r.url().endsWith("/api/arena/torneos/sitio") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Confirm and start" }).click();
  expect((await respuesta).status()).toBe(202);
  // El cuerpo de la respuesta ya no está disponible tras la navegación: el id sale de la URL a la que lleva el panel.
  const id = `sitio-${new Date().toISOString().slice(0, 10)}`;
  await expect(page).toHaveURL(new RegExp(`/arena/torneo/${id}#arena-torneo-estado$`));
  await expect(page.getByRole("heading", { level: 2, name: "In play" })).toBeVisible();
  // Se cancela con el token del e2e: el cupo de hoy queda consumido y no queda un torneo activo para el resto de la suite.
  const cancelar = await request.post("/api/arena/torneos/sitio/cancelar", { headers: { authorization: `Bearer ${TOKEN_ADMIN_E2E}` } });
  expect(cancelar.status()).toBe(200);
  await page.goto("/arena/torneo");
  await expect(page.getByRole("button", { name: "Start new tournament" })).toBeDisabled();
  await expect(page.getByTestId("arena-torneo-motivo")).toContainText("Today's tournament (UTC) has already been launched.");
  const directo = await request.post("/api/arena/torneos/sitio", { headers: { origin: new URL(baseURL!).origin, "content-type": "application/json" }, data: { formato: "liga" } });
  expect(directo.status()).toBe(409);
  expect((await directo.json()).motivo).toBe("cupo");
});
