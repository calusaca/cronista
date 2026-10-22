// Brief 047 · Contraste WCAG de pares clave de /arena medido sobre estilos computados.
// Uso (desde la raíz del repo): node docs/evidencia/rediseno-047/contraste.mjs [URL] [SEGUNDO]
// (brief 050: SEGUNDO opcional del deslizador, 40 por defecto; con un gol en curso mide rótulo y anillo).
// Por defecto mide la arena pública con un partido terminado. Sale con código 1 si algún
// par presente falla su mínimo o si falta un elemento marcado como obligatorio.
import { chromium } from "@playwright/test";

const URL_ARENA = process.argv[2] ?? "https://cronista-arena.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io/arena?partido=cd0e2ad0-a8b6-45fb-ba6d-1a9ca3f9a905";
// [nombre, selector primer plano, propiedad, selectores de fondo (null = ancestro opaco), propiedad fondo, mínimo, obligatorio tras el 047]
const PARES = [
  ["texto principal / fondo", "main h1", "color", null, null, 4.5, true],
  ["texto atenuado / tarjeta", ".arena-companion .arena-muted", "color", null, null, 4.5, true],
  ["marcador / caja del marcador", ".arena-score strong", "color", null, null, 3, true],
  ["nombre equipo / marcador", ".arena-score > span", "color", null, null, 4.5, true],
  ["reloj / fondo", "[data-testid=arena-clock]", "color", null, null, 4.5, true],
  ["botón primario", ".arena-playback .btn-primary", "color", [".arena-playback .btn-primary"], "background-color", 4.5, true],
  ["pestaña activa", ".arena-source-tabs [aria-pressed=true]", "color", [".arena-source-tabs [aria-pressed=true]"], "background-color", 4.5, true],
  ["dorsal local / ficha", ".arena-local text", "fill", [".arena-local circle"], "fill", 4.5, true],
  ["dorsal visita / ficha", ".arena-visita text", "fill", [".arena-visita circle"], "fill", 4.5, true],
  ["ficha local / césped", ".arena-local circle", "fill", [".arena-grass", ".arena-stripe"], "fill", 3, true],
  ["anillo local / césped", ".arena-local circle", "stroke", [".arena-grass", ".arena-stripe"], "fill", 3, true],
  ["ficha visita / césped", ".arena-visita circle", "fill", [".arena-grass", ".arena-stripe"], "fill", 3, true],
  ["balón / césped", ".arena-ball", "fill", [".arena-grass", ".arena-stripe"], "fill", 3, true],
  ["líneas / césped", ".arena-lines", "stroke", [".arena-grass", ".arena-stripe"], "fill", 3, true],
  ["nombre mesa / tarjeta", ".arena-mesa-card h3", "color", null, null, 4.5, true],
  ["rótulo narrador / tarjeta", "[data-mesa-role=narrador] h3 .arena-muted", "color", null, null, 4.5, true],
  ["rótulo comentarista / tarjeta", "[data-mesa-role=comentarista] h3 .arena-muted", "color", null, null, 4.5, true],
  ["rótulo estadista / tarjeta", "[data-mesa-role=estadista] h3 .arena-muted", "color", null, null, 4.5, true],
  ["avatar narrador", "[data-mesa-role=narrador] .arena-mesa-avatar", "color", ["[data-mesa-role=narrador] .arena-mesa-avatar"], "background-color", 4.5, true],
  ["avatar comentarista", "[data-mesa-role=comentarista] .arena-mesa-avatar", "color", ["[data-mesa-role=comentarista] .arena-mesa-avatar"], "background-color", 4.5, true],
  ["avatar estadista", "[data-mesa-role=estadista] .arena-mesa-avatar", "color", ["[data-mesa-role=estadista] .arena-mesa-avatar"], "background-color", 4.5, true],
  ["hora acción / tarjeta", ".arena-live-feed time", "color", null, null, 4.5, true],
  ["barra superior", ".arena-topbar .brand-mark", "color", null, null, 4.5, true],
  // Pares añadidos por la implementación del 047 (texto/fondo nuevos que el script no cubría).
  ["enlace barra superior", ".arena-topbar .topbar-links a", "color", null, null, 4.5, true],
  ["rótulo cabecera / chip", ".arena-intro .overline", "color", null, null, 4.5, true],
  ["párrafo cabecera / banda", ".arena-intro p:not(.overline)", "color", null, null, 4.5, true],
  ["pestaña inactiva / fondo", ".arena-source-tabs [aria-pressed=false]", "color", null, null, 4.5, true],
  ["enlace a la cancha / fondo", ".arena-source-tabs a", "color", null, null, 4.5, true],
  ["estado del directo / píldora", ".arena-live [role=status]", "color", null, null, 4.5, true],
  ["enlace compartir / botón", ".arena-live a[href^='/arena?partido=']", "color", null, null, 4.5, false],
  ["dirección local / tablero", ".arena-direction span:first-child", "color", null, null, 4.5, true],
  ["dirección visita / tablero", ".arena-direction span:last-child", "color", null, null, 4.5, true],
  ["botón fantasma / transporte", ".arena-playback .btn:not(.btn-primary)", "color", null, null, 4.5, true],
  ["árbitro / ficha informativa", ".arena-referee-info p", "color", null, null, 4.5, false],
  ["instante y modo / chip", ".arena-mesa-meta", "color", null, null, 4.5, true],
  ["resumen de evidencia / tarjeta", ".arena-mesa-card summary", "color", null, null, 4.5, true],
  ["oración mesa / tarjeta", ".arena-mesa-card [data-intervencion] > p:not(.arena-muted)", "color", null, null, 4.5, false],
  ["estado vacío mesa / tarjeta", ".arena-mesa-card > p.arena-muted", "color", null, null, 4.5, false],
  ["estado vacío / fondo", ".arena-empty", "color", null, null, 4.5, false],
  ["rótulo panel / chip", ".arena-intelligence .overline", "color", null, null, 4.5, true],
  ["enlace evidencia / chip", ".arena-evidence-link", "color", null, null, 4.5, false],
  ["resumen desplegable / panel", ".arena-setup > summary", "color", null, null, 4.5, true],
  // Brief 050: rótulo del gol (mismos tokens que el marcador) y anillo del goleador; solo existen
  // durante la celebración, así que no son obligatorios.
  ["rótulo de gol / fondo", ".arena-goal-banner", "color", null, null, 4.5, false],
  ["anillo del goleador / césped", "circle.arena-goal-ring", "stroke", [".arena-grass", ".arena-stripe"], "fill", 3, false],
];

const browser = await chromium.launch();
let fallos = 0;
for (const tema of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: tema });
  const page = await ctx.newPage();
  await page.goto(URL_ARENA, { waitUntil: "networkidle", timeout: 90000 });
  await page.getByTestId("arena-pitch").waitFor();
  const slider = page.getByRole("slider", { name: "Match time" });
  if (await slider.count()) { await slider.fill(process.argv[3] ?? "40"); await page.waitForTimeout(500); }
  const filas = await page.evaluate((PARES) => {
    const rgb = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
    const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const opaco = el => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c && c.a > 0.5) return c; } return rgb(getComputedStyle(document.body).backgroundColor); };
    const txt = c => `rgb(${c.r},${c.g},${c.b})`;
    return PARES.map(([nombre, sel, prop, selF, propF, min, obligatorio]) => {
      const el = document.querySelector(sel);
      if (!el) return { nombre, estado: "AUSENTE", obligatorio };
      const fg = rgb(getComputedStyle(el).getPropertyValue(prop));
      const fondos = selF ? selF.map(s => document.querySelector(s)).filter(Boolean).map(e => rgb(getComputedStyle(e).getPropertyValue(propF))) : [opaco(el.closest("svg")?.parentElement ?? el)];
      if (!fg || !fondos.length || fondos.some(f => !f)) return { nombre, estado: "SIN COLOR", obligatorio };
      const medidas = fondos.map(f => ({ bg: txt(f), r: ratio(fg, f) }));
      const peor = medidas.reduce((a, b) => (b.r < a.r ? b : a));
      return { nombre, fg: txt(fg), bg: medidas.map(m => m.bg).join(" y "), ratio: Math.round(peor.r * 100) / 100, min, estado: peor.r >= min ? "OK" : "FALLA", obligatorio };
    });
  }, PARES);
  for (const f of filas) {
    if (f.estado === "FALLA" || (f.obligatorio && f.estado !== "OK")) fallos++;
    console.log(`| ${tema === "light" ? "claro" : "oscuro"} | ${f.nombre} | ${f.fg ?? "—"} | ${f.bg ?? "—"} | ${f.ratio ?? "—"} | ${f.min ?? "—"} | ${f.estado} |`);
  }
  await ctx.close();
}
await browser.close();
console.log(`\nPares fuera de criterio (falla o ausente obligatorio): ${fallos}`);
process.exitCode = fallos ? 1 : 0;
