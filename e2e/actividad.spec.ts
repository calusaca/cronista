import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, type Request, test } from "@playwright/test";

async function retener(page: Page, aceptar: (request: Request) => boolean) {
  let liberar!: () => void;
  const espera = new Promise<void>((resolve) => { liberar = resolve; });
  let solicitudes = 0;
  await page.route("**/*", async (route) => {
    if (!aceptar(route.request())) return route.continue();
    solicitudes++;
    await espera;
    await route.continue();
  });
  return { liberar, solicitudes: () => solicitudes };
}

const navegaciones = [
  { de: "/", selector: '[data-testid="league-mode"]', a: "/liga", titulo: "Loading page…" },
  { de: "/", selector: '[data-testid="data-link"]', a: "/datos", titulo: "Loading page…" },
  { de: "/datos", selector: ".brand", a: "/", titulo: "Preparing your match…" },
  { de: "/match/246", selector: '[data-perspective="visita"]', a: "/match/246?perspectiva=visita", titulo: "Preparing your report…" },
  { de: "/liga", selector: '[data-testid="tab-players"]', a: "/liga?tab=players&j=1", titulo: "Loading page…" },
  { de: "/liga", selector: '[data-testid="matchday-link"][data-jornada="7"]', a: "/liga?j=7", titulo: "Loading page…" },
  { de: "/liga", selector: '[data-testid="league-match"]', a: "/liga/1/1", titulo: "Preparing your match…" },
  { de: "/liga/7/3", selector: '[data-testid="league-next"]', a: "/liga/7/4", titulo: "Preparing your match…" },
  { de: "/liga/7/3", selector: '[data-testid="league-back"]', a: "/liga?j=7", titulo: "Loading page…" },
];

for (const ruta of navegaciones) {
  test(`${ruta.de} → ${ruta.a}: aviso durante toda la navegación`, async ({ page }) => {
    await page.goto(ruta.de);
    const retenida = await retener(page, (r) => r.headers().rsc === "1");
    try {
      await page.locator(ruta.selector).first().click();
      await expect(page.getByTestId("match-loading")).toContainText(ruta.titulo, { timeout: 1500 });
      await expect(page.getByTestId("match-loading")).toBeInViewport();
      await expect.poll(retenida.solicitudes).toBe(1);
      await expect(page).toHaveURL(ruta.de);
    } finally { retenida.liberar(); }
    await expect(page).toHaveURL(ruta.a);
    await expect(page.getByTestId("match-loading")).toBeHidden();
  });
}

test("los enlaces conservan Enter, clic modificado y no dejan un aviso al volver", async ({ page }) => {
  await page.goto("/datos");
  const enlace = page.getByTestId("league-mode");
  await enlace.click({ modifiers: ["ControlOrMeta"] });
  await expect(page).toHaveURL("/datos");
  await expect(page.getByTestId("match-loading")).toBeHidden();
  await enlace.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/liga");
  await page.goBack();
  await expect(page).toHaveURL("/datos");
  await expect(page.getByTestId("match-loading")).toBeHidden();
});

test("descarga: espera, un solo fetch, bytes originales y error recuperable", async ({ page }) => {
  await page.goto("/datos");
  const enlace = page.getByTestId("sample-download");
  const href = (await enlace.getAttribute("href"))!;
  await page.route(`**${href}`, (route) => route.fulfill({ status: 503, body: "test unavailable" }));
  await enlace.click();
  await expect(page.getByTestId("download-error")).toBeVisible();
  await expect(page.getByTestId("match-loading")).toBeHidden();
  await expect(enlace).not.toHaveAttribute("aria-disabled", "true");
  await page.unroute(`**${href}`);

  const retenida = await retener(page, (r) => new URL(r.url()).pathname === href);
  const descarga = page.waitForEvent("download");
  try {
    await enlace.click();
    await expect(page.getByTestId("match-loading")).toContainText("Preparing download…");
    await expect(enlace).toHaveAttribute("aria-busy", "true");
    await expect(page.getByTestId("download-error")).toHaveCount(0);
    await enlace.click({ force: true });
    await expect.poll(retenida.solicitudes).toBe(1);
  } finally { retenida.liberar(); }
  const archivo = await descarga;
  expect(await archivo.failure()).toBeNull();
  expect(readFileSync((await archivo.path())!)).toEqual(readFileSync(join(process.cwd(), "public", href)));
  await expect(page.getByTestId("download-status")).toContainText("Download started");
  await expect(page.getByTestId("match-loading")).toBeHidden();
  await expect(page).toHaveURL("/datos");
});

test("replay: error, reintento y salir/entrar durante la espera no duplica la petición", async ({ page }) => {
  await page.goto("/match/246");
  await page.route("**/api/overlay/246", (r) => r.fulfill({ status: 503, json: { error: "test unavailable" } }));
  await page.getByTestId("watch-live").click();
  await expect(page.getByTestId("ticker-error")).toBeVisible();
  await expect(page.getByTestId("match-loading")).toBeHidden();
  await page.unroute("**/api/overlay/246");
  const retenida = await retener(page, (r) => new URL(r.url()).pathname === "/api/overlay/246");
  try {
    await page.getByTestId("ticker-retry").click();
    await expect(page.getByTestId("match-loading")).toContainText("Preparing the replay…");
    await expect(page.getByTestId("ticker-loading")).toBeVisible();
    await expect(page.getByTestId("replay-clock")).toHaveText("0′");
    await page.getByTestId("skip-full-time").click();
    await expect(page.getByTestId("match-loading")).toBeHidden();
    await page.getByTestId("watch-live").click();
    await expect(page.getByTestId("match-loading")).toBeVisible();
    await expect.poll(retenida.solicitudes).toBe(1);
  } finally { retenida.liberar(); }
  await expect(page.getByTestId("ticker-loading")).toHaveCount(0);
  await expect(page.getByTestId("match-loading")).toBeHidden();
  await expect.poll(async () => Number(await page.getByTestId("replay-clock").getAttribute("data-minuto"))).toBeGreaterThan(0);
});

function chunksCon(firma: string) {
  const raiz = join(process.cwd(), ".next/static/chunks");
  return readdirSync(raiz, { recursive: true }).filter((p): p is string => typeof p === "string" && p.endsWith(".js") && readFileSync(join(raiz, p), "utf8").includes(firma)).map((p) => p.split("/").pop());
}

test("partido completo: la primera apertura avisa mientras se descarga su módulo", async ({ page }) => {
  const chunks = chunksCon("full-match-close");
  expect(chunks.length).toBeGreaterThan(0);
  await page.goto("/match/246");
  const retenida = await retener(page, (r) => chunks.includes(new URL(r.url()).pathname.split("/").pop()));
  try {
    await page.getByTestId("open-formations").click();
    await expect(page.getByTestId("match-loading")).toContainText("Opening the full match…");
    await expect(page.getByTestId("full-match")).toHaveCount(0);
    await expect.poll(retenida.solicitudes).toBeGreaterThan(0);
  } finally { retenida.liberar(); }
  await expect(page.getByTestId("full-match")).toBeVisible();
  await expect(page.getByTestId("match-loading")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("open-formations")).toBeFocused();
});

test("3D: aviso hasta recibir el motor y retirada al mostrar la cancha", async ({ page }) => {
  const chunks = chunksCon("WebGLRenderer");
  expect(chunks.length).toBeGreaterThan(0);
  await page.goto("/match/246");
  await page.locator('[data-testid="timeline-event"][data-event-id="e031"]').click();
  const retenida = await retener(page, (r) => chunks.includes(new URL(r.url()).pathname.split("/").pop()));
  try {
    await page.getByTestId("pitch-3d-btn").click();
    await expect(page.getByTestId("match-loading")).toContainText("Loading the 3D view…");
    await expect.poll(retenida.solicitudes).toBeGreaterThan(0);
  } finally { retenida.liberar(); }
  await expect(page.getByTestId("pitch-3d-canvas")).toBeVisible();
  await expect(page.getByTestId("match-loading")).toBeHidden();
});

test("fallo del módulo 3D retira la espera y conserva la alternativa 2D", async ({ page }) => {
  const chunks = chunksCon("WebGLRenderer");
  await page.goto("/match/246");
  await page.route("**/*.js", (route) => chunks.includes(new URL(route.request().url()).pathname.split("/").pop()) ? route.abort("failed") : route.continue());
  await page.locator('[data-testid="timeline-event"][data-event-id="e031"]').click();
  await page.getByTestId("pitch-3d-btn").click();
  await expect(page.getByTestId("sin-webgl")).toBeVisible();
  await expect(page.getByTestId("pitch-diagram")).toBeVisible();
  await expect(page.getByTestId("match-loading")).toBeHidden();
});

test("fallo al abrir el partido completo ofrece reintento sin dejar la carga permanente", async ({ page }) => {
  const chunks = chunksCon("full-match-close");
  await page.goto("/match/246");
  await page.route("**/*.js", (route) => chunks.includes(new URL(route.request().url()).pathname.split("/").pop()) ? route.abort("failed") : route.continue());
  await page.getByTestId("open-full-match").click();
  await expect(page.getByTestId("page-error")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("match-loading")).toBeHidden();
  await page.unroute("**/*.js");
  await page.getByTestId("page-error").getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("match-view")).toHaveAttribute("data-seed", "246");
  await expect(page.getByTestId("page-error")).toHaveCount(0);
  await expect(page.getByTestId("match-loading")).toBeHidden();
  await page.getByTestId("open-full-match").click();
  await expect(page.getByTestId("full-match")).toBeVisible();
});
