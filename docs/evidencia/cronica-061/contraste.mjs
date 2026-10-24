// Brief 061 (v1.1) § 6.3 + § V4 · Contraste WCAG de la crónica con la paleta y la barra de la arena,
// medido sobre estilos computados (adaptado de docs/evidencia/rediseno-047/contraste.mjs: misma fórmula
// y misma tabla). Mide /match/246 con la primera frase seleccionada y el error de la barra visible
// (semilla «abc»), a 1440 y a 360 px, y la caja de cristal de una frase corregida.
// Uso (desde la raíz del repo):
//   node docs/evidencia/cronica-061/contraste.mjs [BASE] [--tema=claro|oscuro] [--publico]
// BASE por defecto: el servidor del e2e (http://127.0.0.1:3417, CRONISTA_LLM=ensayo). Con --publico, los
// pares de la caja de cristal son opcionales (el modelo real puede no tener ninguna frase corregida).
// Sale con código 1 si algún par presente falla su mínimo o si falta un par obligatorio.
import { chromium } from "@playwright/test";

const ARGS = process.argv.slice(2).filter(a => !a.startsWith("--"));
const BASE = (ARGS[0] ?? "http://127.0.0.1:3417").replace(/\/$/, "");
const TEMA = process.argv.find(a => a.startsWith("--tema="))?.split("=")[1] ?? null;
const PUBLICO = process.argv.includes("--publico");

// [nombre, selector primer plano, propiedad, selectores de fondo (null = ancestro opaco), propiedad fondo, mínimo, obligatorio]
const PARES = [
  ["marca / barra", ".topbar-cronicas .brand-mark", "color", null, null, 4.5, true],
  ["punto del emblema (--ar-live) / barra", ".topbar-cronicas .brand-emblem circle", "fill", [".topbar-cronicas"], "background-color", 3, true],
  ["enlace de la barra / barra", ".topbar-cronicas .topbar-links a:not([aria-current])", "color", null, null, 4.5, true],
  ["[aria-current=page] / barra", ".topbar-cronicas .topbar-links a[aria-current=page]", "color", null, null, 4.5, true],
  ["texto de «Simulate match» / barra", ".topbar-cronicas [data-testid=simulate]", "color", null, null, 4.5, true],
  [".sim-error / barra (semilla «abc»)", ".topbar-cronicas .sim-error", "color", null, null, 4.5, true],
  [".volver-arena / --bg", ".volver-arena", "color", null, null, 4.5, true],
  ["frase / superficie", "[data-testid=sentence]:not([data-selected=true]) [data-testid=sentence-text]", "color", null, null, 4.5, true],
  ["frase seleccionada / --hl", "[data-testid=sentence][data-selected=true] [data-testid=sentence-text]", "color", null, null, 4.5, true],
  ["texto atenuado (.overline) / superficie", ".match-head .overline", "color", null, null, 4.5, true],
  ["chip neutro (--ink / --chip)", ".ev:not([data-tipo=gol]):not([data-tipo=tarjeta_roja]) .chip", "color", null, null, 4.5, true],
  ["chip de gol (--accent-ink / --accent)", ".ev[data-tipo=gol] .chip", "color", null, null, 4.5, true],
  ["chip de roja (--surface / --danger)", ".ev[data-tipo=tarjeta_roja] .chip", "color", null, null, 4.5, true],
  ["perspectiva activa", ".perspective-option[aria-current=true]", "color", null, null, 4.5, true],
  ["idioma activo", "[data-testid=lang-toggle] [aria-pressed=true]", "color", null, null, 4.5, true],
  ["«Watch live» (.btn-primary)", "[data-testid=watch-live]", "color", null, null, 4.5, true],
];
// § V4 · Caja de cristal abierta en una frase corregida; fondo efectivo del intento = --bg.
const PARES_CRISTAL = [
  [".verdict.rejected / intento", "[data-testid=glass-box] .verdict.rejected", "color", null, null, 4.5],
  [".rule-tag / intento", "[data-testid=glass-box] .rule-tag", "color", null, null, 4.5],
  [".rule-note / intento", "[data-testid=glass-box] .rule-note", "color", null, null, 4.5],
  [".attempt-text.struck / intento", "[data-testid=glass-box] .attempt-text.struck", "color", null, null, 4.5],
  [".verdict.ok / intento", "[data-testid=glass-box] .verdict.ok", "color", null, null, 4.5],
].map(p => [...p, !PUBLICO]);
// Pares de tokens (gráficos): [nombre, token primer plano, token fondo, mínimo].
const TOKENS = [
  ["foco (--accent) / superficie", "--accent", "--surface", 3],
  ["icono de amarilla (--card-yellow) / superficie", "--card-yellow", "--surface", 3],
];

const medir = (page, pares) => page.evaluate(([PARES, TOKENS]) => {
  const rgb = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; } /* El CSS minificado acorta #ffffff a #fff. */ const h = String(s).trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i); if (!h) return null; const n = parseInt(h[1].length === 3 ? [...h[1]].map(c => c + c).join("") : h[1], 16); return { r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: 1 }; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const opaco = el => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c && c.a > 0.5) return c; } return rgb(getComputedStyle(document.body).backgroundColor); };
  const txt = c => `rgb(${c.r},${c.g},${c.b})`;
  const filas = PARES.map(([nombre, sel, prop, selF, propF, min, obligatorio]) => {
    const el = document.querySelector(sel);
    if (!el) return { nombre, estado: "AUSENTE", obligatorio };
    const fg = rgb(getComputedStyle(el).getPropertyValue(prop));
    const fondos = selF ? selF.map(s => document.querySelector(s)).filter(Boolean).map(e => rgb(getComputedStyle(e).getPropertyValue(propF))) : [opaco(el.closest("svg")?.parentElement ?? el)];
    if (!fg || !fondos.length || fondos.some(f => !f)) return { nombre, estado: "SIN COLOR", obligatorio };
    const peor = fondos.map(f => ({ bg: txt(f), r: ratio(fg, f) })).reduce((a, b) => (b.r < a.r ? b : a));
    return { nombre, fg: txt(fg), bg: peor.bg, ratio: Math.round(peor.r * 100) / 100, min, estado: peor.r >= min ? "OK" : "FALLA", obligatorio };
  });
  const raiz = getComputedStyle(document.documentElement);
  for (const [nombre, a, b, min] of TOKENS) {
    const fg = rgb(raiz.getPropertyValue(a)), bg = rgb(raiz.getPropertyValue(b));
    if (!fg || !bg) { filas.push({ nombre, estado: "SIN COLOR", obligatorio: true }); continue; }
    const r = ratio(fg, bg);
    filas.push({ nombre, fg: txt(fg), bg: txt(bg), ratio: Math.round(r * 100) / 100, min, estado: r >= min ? "OK" : "FALLA", obligatorio: true });
  }
  return filas;
}, [pares, TOKENS]);

let fallos = 0;
const browser = await chromium.launch();
const temas = TEMA ? [TEMA] : ["claro", "oscuro"];
console.log(`Contraste 061 · ${BASE}/match/246 · ${new Date().toISOString()}${PUBLICO ? " · público (caja de cristal opcional)" : ""}\n`);
console.log("| Tema | Ancho | Par | Primer plano | Fondo | Ratio | Mínimo | Estado |");
console.log("| --- | --- | --- | --- | --- | --- | --- | --- |");
for (const tema of temas) {
  for (const ancho of [1440, 360]) {
    const ctx = await browser.newContext({ viewport: { width: ancho, height: 900 }, colorScheme: tema === "claro" ? "light" : "dark" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/match/246`, { waitUntil: "networkidle", timeout: 90000 });
    await page.getByTestId("seed-input").fill("abc");
    await page.getByTestId("simulate").click();
    await page.locator(".sim-form [role=alert]").waitFor();
    const primera = page.getByTestId("sentence").first();
    await primera.getByTestId("sentence-text").click();
    await page.locator("[data-testid=sentence][data-selected=true]").first().waitFor();
    // Sin hover en ninguna frase: el ratón se aparta para medir el estado de reposo.
    await page.mouse.move(1, 1);
    // .sentence anima su fondo 150 ms: se mide con la transición terminada.
    await page.waitForTimeout(500);
    const filas = await medir(page, PARES);
    const corregida = page.locator('[data-testid="sentence"][data-state="corregida"]').first();
    if (await corregida.count()) {
      await corregida.getByTestId("sentence-state").click();
      await page.getByTestId("glass-box").waitFor();
      filas.push(...(await medir(page, PARES_CRISTAL)).filter(f => !TOKENS.some(t => t[0] === f.nombre)));
    } else {
      for (const [nombre, , , , , , obligatorio] of PARES_CRISTAL) filas.push({ nombre, estado: "AUSENTE", obligatorio });
    }
    for (const f of filas) {
      if (f.estado === "FALLA" || (f.obligatorio && f.estado !== "OK")) fallos++;
      console.log(`| ${tema} | ${ancho} | ${f.nombre} | ${f.fg ?? "—"} | ${f.bg ?? "—"} | ${f.ratio ?? "—"} | ${f.min ?? "—"} | ${f.estado} |`);
    }
    await ctx.close();
  }
}
await browser.close();
console.log(`\nPares fuera de criterio (falla o ausente obligatorio): ${fallos}`);
process.exitCode = fallos ? 1 : 0;
