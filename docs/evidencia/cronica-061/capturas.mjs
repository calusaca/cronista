// Brief 061 § 8 (cierre) y § V8 · Capturas de la crónica con la barra y la paleta de la arena.
// Uso (desde la raíz del repo): node docs/evidencia/cronica-061/capturas.mjs <BASE> <prefijo> [anchos]
//   BASE: http://127.0.0.1:3417 (build local del e2e) o el sitio público.
//   prefijo: «antes» o «despues» (nombre de los archivos: <prefijo>-<página>-<ancho>-<tema>.png).
//   anchos: lista separada por comas; por defecto 360,960,1440.
// Captura solo el viewport (900 px de alto; 780 a 360 px): la barra, «← Arena» y el arranque de la página.
import { chromium } from "@playwright/test";

const [BASE = "http://127.0.0.1:3417", PREFIJO = "despues", ANCHOS = "360,960,1440"] = process.argv.slice(2);
const PAGINAS = [["partido-246", "/match/246"], ["portada", "/"], ["liga", "/liga"], ["datos", "/datos"], ["arena", "/arena"]];
const dir = new URL(".", import.meta.url).pathname;
const browser = await chromium.launch();
for (const [nombre, ruta] of PAGINAS) {
  for (const ancho of ANCHOS.split(",").map(Number)) {
    for (const tema of ["claro", "oscuro"]) {
      const ctx = await browser.newContext({ viewport: { width: ancho, height: ancho <= 480 ? 780 : 900 }, colorScheme: tema === "claro" ? "light" : "dark" });
      // Sin inferencia ni voz: se abortan las solicitudes no-GET a la API de la arena (como en el § 1).
      await ctx.route("**/api/arena/**", r => (r.request().method() === "GET" ? r.continue() : r.abort()));
      const page = await ctx.newPage();
      // La arena abre conexiones largas: se espera a la carga, no a la red inactiva.
      await page.goto(BASE.replace(/\/$/, "") + ruta, { waitUntil: ruta === "/arena" ? "load" : "networkidle", timeout: 90000 });
      if (ruta === "/arena") await page.locator("main.arena-shell").waitFor();
      await page.waitForTimeout(400);
      const archivo = `${dir}${PREFIJO}-${nombre}-${ancho}-${tema}.png`;
      await page.screenshot({ path: archivo });
      console.log(archivo.replace(dir, ""));
      await ctx.close();
    }
  }
}
await browser.close();
