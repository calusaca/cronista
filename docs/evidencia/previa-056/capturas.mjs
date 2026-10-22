// Brief 056 (v1.1 § 4.5 y criterio 10.2) · Capturas de la tarjeta de alineaciones: 1440×900 y 360×740,
// claro y oscuro, con el ejemplo de entrenadores IA cargado en el tick 0 (tarjeta visible) y tras pulsar
// Reproducir (sin tarjeta). Registra métricas: anchoDocumento (≤ 360 a 360 px), marcadorAbajo,
// canchaAbajo (la tarjeta no las cambia: va debajo) y alineacionesAbajo (informativo).
//
// Uso (desde la raíz del repo): node docs/evidencia/previa-056/capturas.mjs [URL de /arena] [--partido=llm-v1|duelo]
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const BASE = process.argv.slice(2).find(a => !a.startsWith("--")) ?? "http://127.0.0.1:3418/arena";
const PARTIDO = process.argv.find(a => a.startsWith("--partido="))?.split("=")[1] ?? "llm-v3";
const BOTON = { "llm-v3": "Load AI coaches example", duelo: "Load recorded model duel", "llm-v1": "Load recorded AI run" }[PARTIDO];
const DIR = "docs/evidencia/previa-056";

const medir = () => {
  const abajo = s => { const b = document.querySelector(s)?.getBoundingClientRect(); return b ? Math.round(b.bottom + scrollY) : null; };
  return {
    anchoDocumento: document.documentElement.scrollWidth,
    marcadorAbajo: abajo(".arena-score"), canchaAbajo: abajo(".arena-pitch-wrap"), alineacionesAbajo: abajo(".arena-lineups"),
    tarjeta: Boolean(document.querySelector('[data-testid="arena-lineups"]')),
    jugadores: document.querySelectorAll('[data-testid="arena-lineup-player"]').length,
    reloj: document.querySelector('[data-testid="arena-clock"]')?.textContent ?? null,
  };
};

const browser = await chromium.launch();
const filas = [];
let fallos = 0;
for (const [vista, viewport] of [["escritorio", { width: 1440, height: 900 }], ["movil", { width: 360, height: 740 }]]) {
  for (const tema of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport, colorScheme: tema, deviceScaleFactor: vista === "movil" ? 2 : 1 });
    const page = await ctx.newPage();
    const errores = [];
    page.on("pageerror", e => errores.push(String(e)));
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Saved matches", exact: true }).click();
    await page.getByRole("button", { name: BOTON, exact: true }).click();
    await page.locator(".arena-board > .arena-empty").waitFor({ state: "detached", timeout: 30000 });
    await page.getByTestId("arena-lineups").waitFor();
    const nombre = `${vista}-${tema === "light" ? "claro" : "oscuro"}${PARTIDO === "llm-v3" ? "" : `-${PARTIDO}`}`;
    await page.evaluate(() => scrollTo(0, 0));
    const antes = await page.evaluate(medir);
    // Captura del tablero completo (marcador, cancha y tarjeta) en la columna del tablero.
    await page.locator(".arena-board").screenshot({ path: `${DIR}/tick0-${nombre}.png` });
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByTestId("arena-lineups").waitFor({ state: "detached", timeout: 2000 });
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.evaluate(() => scrollTo(0, 0));
    const despues = await page.evaluate(medir);
    await page.locator(".arena-board").screenshot({ path: `${DIR}/reproduciendo-${nombre}.png` });
    const fila = { vista, tema, partido: PARTIDO, tick0: antes, reproduciendo: despues, errores };
    if (antes.anchoDocumento > viewport.width || despues.anchoDocumento > viewport.width || !antes.tarjeta || despues.tarjeta || errores.length
      || antes.marcadorAbajo !== despues.marcadorAbajo || antes.canchaAbajo !== despues.canchaAbajo) fallos++;
    filas.push(fila);
    console.log(JSON.stringify(fila));
    await ctx.close();
  }
}
await browser.close();
writeFileSync(`${DIR}/capturas${PARTIDO === "llm-v3" ? "" : `-${PARTIDO}`}.json`, JSON.stringify({ base: BASE, partido: PARTIDO, filas }, null, 2) + "\n");
console.log(`Vistas fuera de criterio: ${fallos}`);
process.exitCode = fallos ? 1 : 0;
