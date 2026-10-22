// Brief 049 · Capturas de la ficha del jugador y del panel «Cifras del partido» (escritorio
// 1440×900 y móvil 360×780, claro y oscuro) y contraste WCAG de sus pares de texto, con el mismo
// método que docs/evidencia/rediseno-047/contraste.mjs (estilos computados, fondo opaco del ancestro).
// Uso (desde la raíz del repo, con la compilación de producción servida):
//   node docs/evidencia/estadisticas-049/capturas.mjs http://127.0.0.1:<puerto>/arena
// Sale con código 1 si algún par presente no alcanza su mínimo o si hay desborde a 360 px.
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const URL_ARENA = process.argv[2] ?? "http://127.0.0.1:3449/arena";
const DIR = "docs/evidencia/estadisticas-049";
const ejemplo = JSON.parse(readFileSync("public/experimentos/arena-llm-v3.json", "utf8"));
const tiros = new Map(); for (const e of ejemplo.eventos) if (e.tipo === "tiro") tiros.set(e.jugador, (tiros.get(e.jugador) ?? 0) + 1);
const rematador = [...tiros].sort((a, b) => b[1] - a[1])[0][0];
// [nombre, selector, mínimo]
const PARES = [
  ["valor líder local / pastilla (--ar-home-ui)", ".arena-stat-value[data-lead][data-side=local]", 4.5],
  ["valor líder visita / pastilla (--ar-away-ui)", ".arena-stat-value[data-lead][data-side=visita]", 4.5],
  ["valor no líder (--ar-bug-muted) / panel", ".arena-stat-value:not([data-lead])", 4.5],
  ["etiqueta de fila / panel", ".arena-stat-label", 4.5],
  ["rótulo del panel / panel", ".arena-stats .overline", 4.5],
  ["reloj del panel / chip", ".arena-stats-clock", 4.5],
  ["nombre de equipo / panel", ".arena-stats-teams span", 4.5],
  ["pie del panel / panel", ".arena-stats-foot .arena-muted", 4.5],
  ["desplegable de eventos / panel", ".arena-stats-foot summary", 4.5],
  ["cifra de la ficha / celda", ".arena-player-stats dd", 4.5],
  ["rótulo de la ficha / celda", ".arena-player-stats dt", 4.5],
  ["detalle de la ficha / celda", ".arena-player-stats dd small", 4.5],
  ["nota de la ficha / tarjeta", ".arena-player-stats-note", 4.5],
  ["club favorito / marcador", ".arena-score > span[data-favorite]", 4.5],
  ["leyenda / panel", ".arena-stats-legend [data-class]", 4.5],
  ["destacado: nombre / panel", ".arena-stats-highlights strong", 4.5],
  ["destacado: cifra / panel", ".arena-stats-highlights .tnum", 4.5],
  ["destacado: rótulo / panel", ".arena-stats-highlights li > span:first-child", 4.5],
  ["nota «no simulado» / panel", ".arena-stat-note", 4.5],
];

const browser = await chromium.launch();
let fallos = 0;
const salida = [];
for (const [vista, viewport] of [["escritorio", { width: 1440, height: 900 }], ["movil", { width: 360, height: 780 }]]) for (const tema of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport, colorScheme: tema, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(URL_ARENA, { waitUntil: "networkidle", timeout: 90000 });
  // Solo para las capturas de elemento: la barra superior fija taparía el borde del recorte.
  await page.addStyleTag({ content: ".arena-topbar { position: static !important; }" });
  await page.getByRole("button", { name: "Saved matches", exact: true }).click();
  const respuesta = page.waitForResponse(r => new URL(r.url()).pathname === "/api/arena" && r.request().method() === "POST");
  await page.getByRole("button", { name: "Load AI coaches example", exact: true }).click();
  await respuesta;
  await page.locator(".arena-score").filter({ hasText: ejemplo.config.partido.visita.nombre }).waitFor();
  await page.getByRole("slider", { name: "Match time" }).press("End");
  await page.locator('[data-testid="arena-stats"][data-final="true"]').waitFor();
  await page.locator(`[data-testid="arena-player"][data-player="${rematador}"]`).dispatchEvent("click");
  await page.locator('[data-testid="arena-favorite-club"][data-side="visita"]').click();
  await page.waitForTimeout(300);
  const sufijo = `${vista}-${tema === "light" ? "claro" : "oscuro"}`;
  await page.getByTestId("arena-stats").screenshot({ path: `${DIR}/panel-${sufijo}.png` });
  await page.getByTestId("arena-player-card").screenshot({ path: `${DIR}/ficha-${sufijo}.png` });
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
  if (vista === "movil" && ancho > 360) { fallos++; salida.push(`${sufijo}: DESBORDE scrollWidth=${ancho}`); }
  const filas = await page.evaluate((PARES) => {
    const rgb = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
    const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const opaco = el => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c && c.a > 0.5) return c; } return rgb(getComputedStyle(document.body).backgroundColor); };
    const txt = c => `rgb(${c.r},${c.g},${c.b})`;
    return PARES.map(([nombre, sel, min]) => {
      const el = document.querySelector(sel);
      if (!el) return { nombre, estado: "AUSENTE" };
      const fg = rgb(getComputedStyle(el).color), bg = opaco(el), r = ratio(fg, bg);
      return { nombre, fg: txt(fg), bg: txt(bg), ratio: Math.round(r * 100) / 100, min, estado: r >= min ? "OK" : "FALLA" };
    });
  }, PARES);
  for (const f of filas) { if (f.estado === "FALLA") fallos++; salida.push(`${sufijo} · ${f.nombre}: ${f.estado}${f.ratio ? ` ${f.ratio}:1 (mín ${f.min}; ${f.fg} sobre ${f.bg})` : ""}`); }
  salida.push(`${sufijo} · scrollWidth = ${ancho}`);
  await ctx.close();
}
await browser.close();
console.log(salida.join("\n"));
console.log(fallos ? `FALLOS: ${fallos}` : "Todo en verde.");
process.exit(fallos ? 1 : 0);
