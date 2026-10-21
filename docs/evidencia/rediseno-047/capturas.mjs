// Brief 047 · Capturas de /arena en cuatro encuadres (1440×900 y 360×740, claro y oscuro).
// Uso (desde la raíz del repo): node docs/evidencia/rediseno-047/capturas.mjs <prefijo> [URL base de /arena]
// <prefijo> es «antes» o «despues». Guarda en docs/evidencia/rediseno-047/ y sale con código 1
// si hay desborde horizontal o errores JS.
import { chromium } from "@playwright/test";

const prefijo = process.argv[2] ?? "antes";
const BASE = process.argv[3] ?? "https://cronista-arena.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io/arena";
const PARTIDO = "cd0e2ad0-a8b6-45fb-ba6d-1a9ca3f9a905";
const DIR = "docs/evidencia/rediseno-047";
const encuadres = [{ nombre: "escritorio", width: 1440, height: 900 }, { nombre: "movil", width: 360, height: 740 }];
const browser = await chromium.launch();
let problemas = 0;
for (const e of encuadres) for (const tema of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: e.width, height: e.height }, colorScheme: tema });
  const page = await ctx.newPage();
  const errores = []; page.on("pageerror", x => errores.push(String(x)));
  const nombre = `${DIR}/${prefijo}-${e.nombre}-${tema === "light" ? "claro" : "oscuro"}`;
  // 1) Portada sin partido: lo primero que ve un juez.
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
  await page.getByTestId("arena-pitch").waitFor();
  await page.screenshot({ path: `${nombre}-inicio.png` });
  // 2) Partido terminado a los 40 s: marcador, cancha y mesa con contenido.
  await page.goto(`${BASE}?partido=${PARTIDO}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.getByTestId("arena-pitch").waitFor();
  await page.getByRole("slider", { name: "Match time" }).fill("40");
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${nombre}.png` });
  await page.locator("#arena-watch").evaluate(x => x.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${nombre}-cancha.png` });
  await page.getByTestId("arena-mesa").screenshot({ path: `${nombre}-mesa.png` });
  const m = await page.evaluate(() => ({
    anchoDocumento: document.documentElement.scrollWidth,
    marcadorAbajo: Math.round(document.querySelector(".arena-score").getBoundingClientRect().bottom + scrollY),
    mesaEnAcompanante: Math.round(document.querySelector('[data-testid="arena-mesa"]').offsetTop),
    accionesEnAcompanante: Math.round(document.querySelector('[data-testid="arena-live-text"]').offsetTop),
    // Tamaño de fuente renderizado del dorsal en px de pantalla (font-size del SVG × escala acumulada).
    dorsalPx: (() => { const t = document.querySelector('[data-testid="arena-player"] text'); const m = t.getScreenCTM(); return Math.round(parseFloat(getComputedStyle(t).fontSize) * Math.hypot(m.a, m.b) * 10) / 10; })(),
    altoDocumento: document.documentElement.scrollHeight,
  }));
  const desborde = m.anchoDocumento > e.width;
  if (desborde || errores.length) problemas++;
  console.log(JSON.stringify({ encuadre: e.nombre, tema, ...m, desborde, errores }));
  await ctx.close();
}
await browser.close();
process.exitCode = problemas ? 1 : 0;
