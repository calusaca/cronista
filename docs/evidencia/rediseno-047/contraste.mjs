// Brief 047 · Contraste WCAG de pares clave de /arena medido sobre estilos computados.
// Uso (desde la raíz del repo): node docs/evidencia/rediseno-047/contraste.mjs [URL] [SEGUNDO] [--cargar=ejemplo-v3|duelo] [--favorito]
// (brief 050: SEGUNDO opcional del deslizador, 40 por defecto; con un gol en curso mide rótulo y anillo).
// Brief 055: --cargar carga un ejemplo público con las pestañas («Saved matches» → botón) antes de medir;
// --favorito marca como favorito al jugador activo (aparece su anillo punteado). Un par cuyo primer
// plano es una lista [[selector, propiedad], …] usa la regla «max» (silueta: relleno o contorno).
// Por defecto mide la arena pública con un partido terminado. Sale con código 1 si algún
// par presente falla su mínimo o si falta un elemento marcado como obligatorio.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
// Brief 057 v1.1 § 7 [v1.2] · Comprobación estática de la regla 047 (Node ≥ 23 importa el .ts sin tipos).
import { violaciones047 } from "../../../src/ui/css-047.ts";

const ARGS = process.argv.slice(2).filter(a => !a.startsWith("--"));
const CARGAR = process.argv.find(a => a.startsWith("--cargar="))?.split("=")[1] ?? null;
const FAVORITO = process.argv.includes("--favorito");
// Brief 056: --previa mide en el tick 0 (SEGUNDO = 0): los pares de la tarjeta de alineaciones pasan a
// obligatorios y los demás a opcionales (en el tick 0 aún no hay acciones, iconos ni datos de la Mesa).
const PREVIA = process.argv.includes("--previa");
const URL_ARENA = ARGS[0] ?? "https://cronista-arena.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io/arena?partido=cd0e2ad0-a8b6-45fb-ba6d-1a9ca3f9a905";
// [nombre, selector primer plano, propiedad, selectores de fondo (null = ancestro opaco), propiedad fondo, mínimo, obligatorio tras el 047]
const PARES = [
  ["texto principal / fondo", "main h1", "color", null, null, 4.5, true],
  ["texto atenuado / tarjeta", ".arena-companion .arena-muted", "color", null, null, 4.5, true],
  ["marcador / caja del marcador", ".arena-score strong", "color", null, null, 3, true],
  ["nombre equipo / marcador", ".arena-score > span", "color", null, null, 4.5, true],
  ["reloj / fondo", "[data-testid=arena-clock]", "color", null, null, 4.5, true],
  ["botón primario", ".arena-playback .btn-primary", "color", [".arena-playback .btn-primary"], "background-color", 4.5, true],
  ["pestaña activa", ".arena-source-tabs [aria-pressed=true]", "color", [".arena-source-tabs [aria-pressed=true]"], "background-color", 4.5, true],
  // Brief 055: el círculo base de la ficha es .arena-kit (los anillos nuevos se miden aparte).
  ["dorsal local / ficha", ".arena-local .arena-token > text", "fill", [".arena-local .arena-kit"], "fill", 4.5, true],
  ["dorsal visita / ficha", ".arena-visita .arena-token > text", "fill", [".arena-visita .arena-kit"], "fill", 4.5, true],
  ["ficha local / césped", ".arena-local .arena-kit", "fill", [".arena-grass", ".arena-stripe"], "fill", 3, true],
  ["anillo local / césped", ".arena-local .arena-kit", "stroke", [".arena-grass", ".arena-stripe"], "fill", 3, true],
  ["ficha visita / césped", ".arena-visita .arena-kit", "fill", [".arena-grass", ".arena-stripe"], "fill", 3, true],
  ["anillo visita / césped", ".arena-visita .arena-kit", "stroke", [".arena-grass", ".arena-stripe"], "fill", 3, true],
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
  ["dirección visita / tablero", ".arena-direction span:nth-child(2)", "color", null, null, 4.5, true],
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
  // Brief 055 (v1.1 §§ 1–4 y 9) · Identidad de club, anillos, emblema y pastillas líder.
  ["iniciales escudo local / campo", ".arena-score > span:first-child .arena-crest-iniciales", "fill", [".arena-score > span:first-child .arena-crest-campo"], "fill", 4.5, true],
  ["iniciales escudo visita / campo", ".arena-score > span:last-child .arena-crest-iniciales", "fill", [".arena-score > span:last-child .arena-crest-campo"], "fill", 4.5, true],
  ["silueta escudo local / marcador", [[".arena-score > span:first-child .arena-crest-forma", "fill"], [".arena-score > span:first-child .arena-crest-contorno", "stroke"]], "max", [".arena-score"], "background-color", 3, true],
  ["silueta escudo visita / marcador", [[".arena-score > span:last-child .arena-crest-forma", "fill"], [".arena-score > span:last-child .arena-crest-contorno", "stroke"]], "max", [".arena-score"], "background-color", 3, true],
  ["anillo de selección / césped", ".arena-select-ring", "stroke", [".arena-grass", ".arena-stripe"], "fill", 3, false],
  ["anillo favorito / césped", ".arena-fav-ring", "stroke", [".arena-grass", ".arena-stripe"], "fill", 3, false],
  ["nota de equipación / tablero", ".arena-kit-note", "color", null, null, 4.5, false],
  ["emblema / barra superior", ".arena-topbar .brand-emblem", "color", null, null, 3, true],
  ["pastilla líder local", ".arena-stat-value[data-lead][data-side=local]", "color", [".arena-stat-value[data-lead][data-side=local]"], "background-color", 4.5, false],
  ["pastilla líder visita", ".arena-stat-value[data-lead][data-side=visita]", "color", [".arena-stat-value[data-lead][data-side=visita]"], "background-color", 4.5, false],
  ["CTA de la cabecera", ".arena-intro-cta", "color", null, null, 4.5, true],
  // Bloque C · iconos de eventos (aria-hidden; gráficos, 3:1).
  ["icono del feed / tarjeta", ".arena-live-feed .arena-event-icon[data-kind]", "color", null, null, 3, false],
  ["icono de cifras / rótulo", ".arena-stat-label .arena-event-icon[data-kind]", "color", [".arena-stats"], "background-color", 3, true],
  ["tarjeta amarilla de cifras / rótulo", ".arena-stat-label [data-kind=amarilla] rect", "fill", [".arena-stats"], "background-color", 3, true],
  ["tarjeta roja de cifras / rótulo", ".arena-stat-label [data-kind=roja] rect", "fill", [".arena-stats"], "background-color", 3, true],
  ["tarjeta amarilla del feed / tarjeta", ".arena-live-feed [data-kind=amarilla] rect", "fill", null, null, 3, false],
  ["tarjeta roja del feed / tarjeta", ".arena-live-feed [data-kind=roja] rect", "fill", null, null, 3, false],
  // Brief 057 § 5.3 · Vista frontal del arco: solo existe durante la celebración (medir con un SEGUNDO de gol).
  ["vista del arco: rótulo / caja", ".arena-goal-view figcaption", "color", [".arena-goal-view"], "background-color", 4.5, false],
  ["vista del arco: palos / caja", ".arena-goal-view .arena-goal-view-posts", "stroke", [".arena-goal-view"], "background-color", 3, false],
];
// Brief 056 · Tarjeta de alineaciones: solo existe en el tick 0 (medir con SEGUNDO = 0, --cargar y --previa).
const PARES_PREVIA = [
  ["líneas alineación / césped tarjeta", ".arena-lineup-pitch .arena-lines", "stroke", [".arena-lineup-pitch .arena-grass"], "fill", 3, false],
  ["dorsal alineación local / ficha", ".arena-lineup.arena-local .arena-token > text", "fill", [".arena-lineup.arena-local .arena-kit"], "fill", 4.5, false],
  ["dorsal alineación visita / ficha", ".arena-lineup.arena-visita .arena-token > text", "fill", [".arena-lineup.arena-visita .arena-kit"], "fill", 4.5, false],
  ["jugador alineación / tarjeta", ".arena-lineup-player strong", "color", [".arena-lineups"], "background-color", 4.5, false],
  ["puesto alineación / tarjeta", ".arena-lineup-player .arena-muted", "color", [".arena-lineups"], "background-color", 4.5, false],
  ["rasgos alineación / tarjeta", ".arena-lineup-traits", "color", [".arena-lineups"], "background-color", 4.5, false],
  ["chip de condiciones", ".arena-lineup-chip", "color", [".arena-lineup-chip"], "background-color", 4.5, false],
  ["formación / chip", ".arena-lineup-shape", "color", [".arena-lineup-shape"], "background-color", 4.5, false],
];

for (const par of PARES) if (PREVIA) par[6] = false;
for (const par of PARES_PREVIA) { par[6] = PREVIA; PARES.push(par); }

let fallos = 0;
const css047 = violaciones047(readFileSync(new URL("../../../src/app/globals.css", import.meta.url), "utf8"));
for (const v of css047) console.log(`| 047 | ${v.selector} declara ${v.propiedad} | — | — | — | — | FALLA |`);
fallos += css047.length;
const browser = await chromium.launch();
for (const tema of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: tema });
  const page = await ctx.newPage();
  await page.goto(URL_ARENA, { waitUntil: "networkidle", timeout: 90000 });
  await page.getByTestId("arena-pitch").waitFor();
  if (CARGAR) {
    await page.getByRole("button", { name: "Saved matches", exact: true }).click();
    await page.getByRole("button", { name: CARGAR === "duelo" ? "Load recorded model duel" : "Load AI coaches example", exact: true }).click();
    await page.locator(".arena-board > .arena-empty").waitFor({ state: "detached", timeout: 30000 });
  }
  if (FAVORITO) await page.getByTestId("arena-favorite-player").click();
  const slider = page.getByRole("slider", { name: "Match time" });
  if (await slider.count()) { await slider.fill(ARGS[1] ?? "40"); await page.waitForTimeout(500); }
  const filas = await page.evaluate((PARES) => {
    const rgb = s => { const srgb = String(s).match(/color\(srgb ([^)]+)\)/); if (srgb) { const p = srgb[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p[3] ?? 1 }; } /* Brief 057: color-mix() se resuelve como color(srgb …). */ const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
    const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const opaco = el => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c && c.a > 0.5) return c; } return rgb(getComputedStyle(document.body).backgroundColor); };
    const txt = c => `rgb(${c.r},${c.g},${c.b})`;
    return PARES.map(([nombre, sel, prop, selF, propF, min, obligatorio]) => {
      // Regla «max» (brief 055 v1.1 § 4): varias partes del primer plano; cuenta la que más contrasta.
      const partes = Array.isArray(sel) ? sel : [[sel, prop]];
      const els = partes.map(([s]) => document.querySelector(s));
      if (els.some(e => !e)) return { nombre, estado: "AUSENTE", obligatorio };
      const el = els[0];
      const fgs = partes.map(([, p], i) => rgb(getComputedStyle(els[i]).getPropertyValue(p)));
      const fondos = selF ? selF.map(s => document.querySelector(s)).filter(Boolean).map(e => rgb(getComputedStyle(e).getPropertyValue(propF))) : [opaco(el.closest("svg")?.parentElement ?? el)];
      if (fgs.some(f => !f) || !fondos.length || fondos.some(f => !f)) return { nombre, estado: "SIN COLOR", obligatorio };
      const elegir = f => fgs.reduce((a, b) => (ratio(b, f) > ratio(a, f) ? b : a));
      const fg = elegir(fondos[0]);
      const medidas = fondos.map(f => ({ bg: txt(f), r: ratio(elegir(f), f) }));
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
