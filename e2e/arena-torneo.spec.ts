// Brief 059 § 8 (con § 15.8–15.10) · /arena/torneo con el fixture de ensayo (ARENA_TORNEOS_DIR) y la repetición
// en /arena: el .gz y torneo.json se sirven como estáticos del build del e2e (scripts/e2e-torneos.mjs), se
// descomprimen en el navegador y se validan con POST /api/arena. Tabla con valores LITERALES (no clasificar),
// matriz y lista, idioma, 360 px, contraste, errores y la vigencia/limpieza de la procedencia (N13, N14).
import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { contrasteWcag } from "../src/arena/identidad";
import { IDENTIDAD_ARENA } from "../src/sim/limites";

test.describe.configure({ mode: "serial" });
/** Torneos reales archivados en public/torneos (se sirven tal cual; el e2e no los modifica). */
const REALES = existsSync("public/torneos/indice.json") ? (JSON.parse(readFileSync("public/torneos/indice.json", "utf8")) as { id: string }[]).map(x => x.id) : [];
const IDS = ["ensayo-059", ...REALES];
const NN = ["01", "02", "03", "04", "05", "06"];
const hex = (rgb: string) => { const m = rgb.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number); return `#${m.map(v => Math.round(v).toString(16).padStart(2, "0")).join("")}`; };

/** Tabla del fixture calculada a mano (A: 2 V y 2 D, 2:2; B y C: 1-2-1, 1:1, empatados también en su liguilla 0–0 y 0–0). */
const TABLA = [["1", "Ensayo A", "4", "2-0-2", "2:2", "0", "6"], ["2=", "Ensayo B", "4", "1-2-1", "1:1", "0", "5"], ["2=", "Ensayo C", "4", "1-2-1", "1:1", "0", "5"]];

async function filasTabla(page: Page) {
  return page.getByTestId("arena-torneo-fila").evaluateAll(filas => filas.map(f => [...f.children].map(c => {
    const visible = c.querySelector("[aria-hidden=true]") ?? c.querySelector(".arena-torneo-largo") ?? c;
    return (visible.textContent ?? "").trim();
  })));
}

test("1 · tabla literal, banda de ensayo, matriz con n(n−1) enlaces y lista con las mismas repeticiones; el .gz se sirve", async ({ page, request }) => {
  await page.goto("/arena/torneo/ensayo-059");
  await expect(page.getByRole("heading", { level: 1, name: "Model tournament" })).toBeVisible();
  await expect(page.getByTestId("arena-torneo-ensayo")).toContainText("Rehearsal tournament · no AI");
  expect(await filasTabla(page)).toEqual(TABLA);
  await expect(page.getByText("tied for 2nd place")).toHaveCount(2);
  const celdas = page.getByTestId("arena-torneo-celda");
  await expect(celdas).toHaveCount(6);
  expect((await celdas.evaluateAll(as => as.map(a => a.getAttribute("href")))).sort()).toEqual(NN.map(n => `/arena?torneo=ensayo-059&encuentro=${n}`));
  await expect(page.getByRole("link", { name: /^Watch replay of match \d$/ })).toHaveCount(6);
  await expect(page.getByTestId("arena-torneo-significacion")).toContainText("(p = 0.5)");
  const gz = await request.get("/torneos/ensayo-059/e03.json.gz");
  expect(gz.status()).toBe(200);
  expect((await gz.body())[0]).toBe(0x1f);
});

test("2 · una celda abre la repetición: marcador final del partido, procedencia y la cancha se mueve al reproducir", async ({ page }) => {
  await page.goto("/arena/torneo/ensayo-059");
  const post = page.waitForRequest(r => r.url().endsWith("/api/arena") && r.method() === "POST");
  await page.getByRole("link", { name: "Ensayo A 0, Ensayo C 1. Watch the replay of match 2" }).click();
  await expect(page).toHaveURL(/\/arena\?torneo=ensayo-059&encuentro=02$/);
  expect((await post).postDataJSON()).toMatchObject({ accion: "reproducir" });
  const origen = page.getByTestId("arena-torneo-origen");
  await expect(origen).toContainText("Match 2 of the");
  await expect(origen).toContainText("Home: Club Quebralta (Ensayo A) · Away: Sporting Ormidia (Ensayo C)");
  await expect(origen.getByRole("link", { name: "Back to the tournament" })).toHaveAttribute("href", "/arena/torneo/ensayo-059");
  await page.getByRole("slider", { name: "Match time" }).press("End");
  await expect(page.locator(".arena-score strong")).toHaveText("0–1");
  await page.getByRole("button", { name: "Restart" }).click();
  const balon = page.getByTestId("arena-ball");
  const antes = await balon.getAttribute("cx");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(async () => await balon.getAttribute("cx"), { timeout: 10_000 }).not.toBe(antes);
});

test("4 · el botón de idioma cambia los textos; ?lang=es arranca en español y los enlaces conservan el idioma", async ({ page }) => {
  await page.goto("/arena/torneo/ensayo-059");
  await page.getByRole("button", { name: "Switch to Spanish" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Torneo entre modelos" })).toBeVisible();
  for (const h of ["Tabla de posiciones", "Resultados (local en filas, visita en columnas)", "Partidos por jornada", "Cómo jugaron los entrenadores", "Procedencia y coste", "Lo que este torneo no demuestra"]) await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();
  await expect(page.getByTestId("arena-torneo-ensayo")).toContainText("Torneo de ensayo · sin IA");
  await expect(page.getByText("empatado en el 2.º puesto")).toHaveCount(2);
  await expect(page.getByRole("link", { name: /^Ver repetición del partido \d$/ })).toHaveCount(6);
  await page.getByRole("button", { name: "Cambiar a inglés" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Model tournament" })).toBeVisible();
  await page.goto("/arena/torneo/ensayo-059?lang=es");
  await expect(page.getByRole("heading", { level: 1, name: "Torneo entre modelos" })).toBeVisible();
  await page.getByRole("link", { name: "Ensayo A 0, Ensayo C 1. Ver la repetición del partido 2" }).click();
  await expect(page).toHaveURL(/encuentro=02&lang=es$/);
  await expect(page.getByTestId("arena-torneo-origen")).toContainText("Partido 2 del torneo del");
  await expect(page.getByRole("link", { name: "Volver al torneo" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Torneo", exact: true })).toHaveAttribute("href", "/arena/torneo?lang=es");
});

for (const id of IDS) for (const tema of ["light", "dark"] as const) for (const idioma of ["en", "es"] as const) {
  test(`5 · ${id} · 360 px (${tema}, ${idioma}): sin desplazamiento de página; tabla y matriz fuera de contenedores desplazables y ≤ 328 px`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, colorScheme: tema });
    const page = await ctx.newPage();
    await page.goto(`/arena/torneo/${id}${idioma === "es" ? "?lang=es" : ""}`);
    await expect(page.getByTestId("arena-torneo-tabla")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    for (const id of ["arena-torneo-tabla", "arena-torneo-matriz"]) {
      const t = page.getByTestId(id);
      expect((await t.boundingBox())!.width).toBeLessThanOrEqual(328);
      expect(await t.evaluate(e => { for (let p = e.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll") return true; } return false; })).toBe(false);
    }
    // El nombre corto se ve; el completo queda en title.
    await expect(page.getByTestId("arena-torneo-fila").first().locator(".arena-torneo-corto")).toBeVisible();
    await expect(page.getByRole("region", { name: idioma === "es" ? "Métricas por modelo" : "Metrics by model" })).toHaveAttribute("tabindex", "0");
    await ctx.close();
  });
}

for (const id of IDS) for (const tema of ["light", "dark"] as const) test(`6 · ${id} · contraste por estilos calculados (${tema}): texto ≥ ${IDENTIDAD_ARENA.minTexto}, anillo de foco ≥ ${IDENTIDAD_ARENA.minGrafico}`, async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: tema });
  const page = await ctx.newPage();
  await page.goto(`/arena/torneo/${id}`);
  const pares = await page.evaluate(() => {
    const fondo = (e: Element) => { for (let x: Element | null = e; x; x = x.parentElement) { const b = getComputedStyle(x).backgroundColor; if (b && !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(b)) return b; } return getComputedStyle(document.body).backgroundColor; };
    const sel = [".arena-torneo-tabla td", ".arena-torneo-tabla thead th", ".arena-torneo-tabla caption", ".arena-torneo-matriz a", ".arena-torneo-matriz thead th", ".arena-torneo-banda strong", ".arena-torneo-aviso", ".arena-torneo h1", ".arena-torneo h2", ".arena-torneo-acciones a", ".arena-torneo-datos dt"];
    return sel.flatMap(s => [...document.querySelectorAll(s)].slice(0, 3).map(e => ({ s, color: getComputedStyle(e).color, fondo: fondo(e) })));
  });
  expect(pares.length).toBeGreaterThan(10);
  for (const p of pares) expect(contrasteWcag(hex(p.color), hex(p.fondo)), p.s).toBeGreaterThanOrEqual(IDENTIDAD_ARENA.minTexto);
  // Anillo de foco de un enlace de la matriz al llegar con el teclado.
  const celda = page.getByTestId("arena-torneo-celda").first();
  for (let i = 0; i < 60 && !(await celda.evaluate(e => e === document.activeElement)); i++) await page.keyboard.press("Tab");
  const anillo = await celda.evaluate(e => { const s = getComputedStyle(e); let b = "rgb(255, 255, 255)"; for (let x: Element | null = e.parentElement; x; x = x.parentElement) { const c = getComputedStyle(x).backgroundColor; if (!/rgba\(\d+, \d+, \d+, 0\)/.test(c)) { b = c; break; } } return { estilo: s.outlineStyle, color: s.outlineColor, fondo: b }; });
  expect(anillo.estilo).not.toBe("none");
  expect(contrasteWcag(hex(anillo.color), hex(anillo.fondo))).toBeGreaterThanOrEqual(IDENTIDAD_ARENA.minGrafico);
  await ctx.close();
});

test("8 · /arena/torneo/no-existe es 404; un encuentro inexistente muestra el error y conserva el partido inicial", async ({ page }) => {
  expect((await page.goto("/arena/torneo/no-existe"))!.status()).toBe(404);
  await page.goto("/arena");
  const inicial = await page.locator(".arena-score").textContent();
  await page.goto("/arena?torneo=ensayo-059&encuentro=99");
  await expect(page.getByTestId("arena-torneo-error")).toContainText("Could not open this tournament match. The previous one is still available.");
  await expect(page.locator(".arena-score")).toHaveText(inicial!);
  await expect(page.getByTestId("arena-torneo-origen")).toHaveCount(0);
  await expect(page.getByText("Saved preview. Start a live match above or choose a recording.")).toBeVisible();
});

test("N13 · la procedencia se limpia al empezar otra carga, aunque esta falle", async ({ page }) => {
  await page.goto("/arena?torneo=ensayo-059&encuentro=02");
  await expect(page.getByTestId("arena-torneo-origen")).toBeVisible();
  await page.route("**/api/arena", r => r.request().method() === "POST" ? r.fulfill({ status: 500, json: { error: "prueba" } }) : r.continue());
  await page.getByText("Choose a saved match or create a recording").click();
  await page.getByRole("button", { name: "Load recorded AI run" }).click();
  await expect(page.getByText("Could not validate or run this experiment. Your previous run is still available.")).toBeVisible();
  await expect(page.getByTestId("arena-torneo-origen")).toHaveCount(0);
});

test("N14 · una respuesta tardía del torneo, cancelada, no reemplaza el registro elegido después", async ({ page }) => {
  let soltar!: () => void;
  const retenido = new Promise<void>(r => { soltar = r; });
  await page.route("**/torneos/ensayo-059/e03.json.gz", async r => { await retenido; await r.continue().catch(() => {}); });
  const posts: string[] = [];
  page.on("request", r => { if (r.url().endsWith("/api/arena") && r.method() === "POST") posts.push(r.postData() ?? ""); });
  await page.goto("/arena?torneo=ensayo-059&encuentro=03");
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByText("Choose a saved match or create a recording").click();
  await page.getByRole("button", { name: "Load recorded AI run" }).click();
  await expect(page.getByRole("button", { name: "Load recorded AI run" })).toBeEnabled();
  const marcador = await page.locator(".arena-score").textContent();
  soltar();
  await page.waitForTimeout(1500);
  await expect(page.locator(".arena-score")).toHaveText(marcador!);
  await expect(page.getByTestId("arena-torneo-origen")).toHaveCount(0);
  expect(posts).toHaveLength(1);
});

test("revisión Codex #2 · si la URL de un encuentro devuelve el registro válido de otro, se muestra el error y no se atribuye", async ({ page }) => {
  await page.route("**/torneos/ensayo-059/e01.json.gz", r => r.fulfill({ path: "src/arena/__fixtures__/torneos/ensayo-059/e02.json.gz", contentType: "application/gzip" }));
  await page.goto("/arena");
  const inicial = await page.locator(".arena-score").textContent();
  await page.goto("/arena?torneo=ensayo-059&encuentro=01");
  await expect(page.getByTestId("arena-torneo-error")).toContainText("Could not open this tournament match. The previous one is still available.");
  await expect(page.getByTestId("arena-torneo-origen")).toHaveCount(0);
  await expect(page.locator(".arena-score")).toHaveText(inicial!);
});

test("9 · regresión: el enlace «Tournament» está en /arena", async ({ page }) => {
  await page.goto("/arena");
  await expect(page.getByRole("link", { name: "Tournament", exact: true })).toHaveAttribute("href", "/arena/torneo");
});

for (const id of REALES) test(`real · ${id}: /arena/torneo muestra el más reciente; 6 filas, matriz de 30 enlaces, p calculada; un partido real se abre con su marcador`, async ({ page, request }) => {
  const t = JSON.parse(readFileSync(`public/torneos/${id}/torneo.json`, "utf8")) as { tipo: string; participantes: unknown[]; encuentros: { n: number; local: { goles: number }; visita: { goles: number } }[] };
  await page.goto("/arena/torneo");
  await expect(page.getByRole("heading", { level: 1, name: "Model tournament" })).toBeVisible();
  await expect(page.getByTestId("arena-torneo-ensayo")).toHaveCount(t.tipo === "ensayo" ? 1 : 0);
  await expect(page.getByTestId("arena-torneo-fila")).toHaveCount(t.participantes.length);
  await expect(page.getByTestId("arena-torneo-celda")).toHaveCount(t.encuentros.length);
  await expect(page.getByTestId("arena-torneo-significacion")).toContainText("(p = 0.0625)");
  expect((await request.get(`/torneos/${id}/e01.json.gz`)).status()).toBe(200);
  const e = t.encuentros.find(x => x.n === 1)!;
  await page.goto(`/arena?torneo=${id}&encuentro=01`);
  await expect(page.getByTestId("arena-torneo-origen")).toContainText("Match 1 of the");
  await page.getByRole("slider", { name: "Match time" }).press("End");
  await expect(page.locator(".arena-score strong")).toHaveText(`${e.local.goles}–${e.visita.goles}`);
});
