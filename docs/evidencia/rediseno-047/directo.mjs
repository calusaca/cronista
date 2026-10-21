// Brief 047 · Vista en directo (búfer) con el controlador programado, que no llama a modelos.
// Uso (desde la raíz del repo, contra un servidor LOCAL): node docs/evidencia/rediseno-047/directo.mjs <URL de /arena>
// Inicia un partido en vivo, captura la cancha con el punto «en directo» en 1440×900 y 360×740
// (claro y oscuro), comprueba el pulso y su ausencia con movimiento reducido, mide el desborde
// horizontal y cancela el partido. Sale con código 1 si algo falla.
import { chromium } from "@playwright/test";

const BASE = process.argv[2];
if (!BASE || !/^http:\/\/(127\.0\.0\.1|localhost)/.test(BASE)) { console.error("Indica una URL local de /arena"); process.exit(2); }
const DIR = "docs/evidencia/rediseno-047";
const browser = await chromium.launch();
let problemas = 0;
const casos = [
  { nombre: "escritorio", width: 1440, height: 900, tema: "light", reducido: "no-preference" },
  { nombre: "escritorio", width: 1440, height: 900, tema: "dark", reducido: "no-preference" },
  { nombre: "movil", width: 360, height: 740, tema: "light", reducido: "no-preference" },
  { nombre: "movil", width: 360, height: 740, tema: "dark", reducido: "reduce" },
];
for (const c of casos) {
  const ctx = await browser.newContext({ viewport: { width: c.width, height: c.height }, colorScheme: c.tema, reducedMotion: c.reducido });
  const page = await ctx.newPage();
  const errores = []; page.on("pageerror", x => errores.push(String(x)));
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
  await page.getByRole("combobox", { name: "Controller selection" }).selectOption("programado");
  await page.getByRole("button", { name: "Start live match" }).click();
  await page.getByTestId("arena-buffer").waitFor({ timeout: 90000 });
  await page.locator(".arena-match-clock[data-en-vivo]").waitFor({ timeout: 30000 });
  await page.waitForTimeout(6000);
  await page.locator("#arena-watch").evaluate(x => x.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(400);
  const nombre = `${DIR}/despues-directo-${c.nombre}-${c.tema === "light" ? "claro" : "oscuro"}${c.reducido === "reduce" ? "-reducido" : ""}`;
  await page.screenshot({ path: `${nombre}.png` });
  const m = await page.evaluate(() => {
    const reloj = document.querySelector(".arena-match-clock");
    const punto = getComputedStyle(reloj, "::before");
    return {
      anchoDocumento: document.documentElement.scrollWidth,
      enVivo: reloj.hasAttribute("data-en-vivo"),
      punto: { ancho: punto.width, fondo: punto.backgroundColor, animacion: punto.animationName },
      textoReloj: document.querySelector('[data-testid="arena-clock"]').textContent,
      transporteVisible: !!document.querySelector(".arena-playback"),
      estado: document.querySelector('[data-testid="arena-live-status"]')?.textContent,
    };
  });
  const esperado = c.reducido === "reduce" ? "none" : "arena-pulso-vivo";
  const mal = m.anchoDocumento > c.width || !m.enVivo || m.punto.animacion !== esperado || m.transporteVisible || errores.length;
  if (mal) problemas++;
  console.log(JSON.stringify({ caso: `${c.nombre}-${c.tema}-${c.reducido}`, ...m, errores, ok: !mal }));
  const cancelar = page.getByRole("button", { name: "Cancel live match" });
  if (await cancelar.count()) await cancelar.click();
  await page.waitForTimeout(1000);
  await ctx.close();
}
await browser.close();
process.exitCode = problemas ? 1 : 0;
