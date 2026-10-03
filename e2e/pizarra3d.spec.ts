// Brief 021 — la pizarra 3D. Abrir la tarjeta del gol → «3D» → canvas → transición completa de
// data-anim-3d (grabada con MutationObserver, contrato del cierre del 016: no se muestrea) →
// rótulo honesto visible. La página NO descarga three sin tocar «3D» (prueba de red); sin WebGL ⇒
// la 2D, sin error; y el chunk de three cabe en su presupuesto (limites.ts).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { expect, type Page, test } from "@playwright/test";
import { PRESUPUESTO_CHUNK_3D_KB } from "../src/sim/limites";
import { ROTULO_3D } from "../src/vista/escena3d";

/** Firma inequívoca de three en un chunk. */
const FIRMA_THREE = "WebGLRenderer";

async function grabar3d(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __a3d: string[]; __o3d?: MutationObserver };
    w.__a3d = [];
    w.__o3d?.disconnect();
    const anotar = (el: Element) => {
      const v = el.getAttribute("data-anim-3d");
      if (v) w.__a3d.push(v);
    };
    w.__o3d = new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === "attributes") anotar(m.target as Element);
        else
          m.addedNodes.forEach((n) => {
            if (n instanceof Element) {
              if (n.matches("[data-anim-3d]")) anotar(n);
              n.querySelectorAll("[data-anim-3d]").forEach(anotar);
            }
          });
      }
    });
    w.__o3d.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-anim-3d"] });
  });
}
const estados = (page: Page) => page.evaluate(() => (window as unknown as { __a3d: string[] }).__a3d);

async function abrirGol(page: Page, id: string) {
  const ev = page.locator(`[data-testid="timeline-event"][data-event-id="${id}"]`);
  await ev.scrollIntoViewIfNeeded();
  await ev.click();
  const t = page.getByTestId("goal-card");
  await expect(t).toBeVisible();
  return t;
}

test("penal de la 246: three NO se descarga sin tocar «3D»; al tocarlo, canvas, transición completa y rótulo honesto", async ({ page }) => {
  const cuerpos: Promise<{ url: string; tiene: boolean }>[] = [];
  page.on("response", (r) => {
    if (!r.url().endsWith(".js")) return;
    cuerpos.push(
      r
        .text()
        .then((t) => ({ url: r.url(), tiene: t.includes(FIRMA_THREE) }))
        .catch(() => ({ url: r.url(), tiene: false })),
    );
  });
  await page.goto("/match/246");
  const tarjeta = await abrirGol(page, "e031");
  await expect(tarjeta.getByTestId("pitch-diagram")).toBeVisible(); // la 2D es el default
  const antes = await Promise.all(cuerpos);
  expect(antes.filter((x) => x.tiene).map((x) => x.url)).toEqual([]);

  await grabar3d(page);
  await tarjeta.getByTestId("pitch-3d-btn").click();
  await expect(tarjeta.getByTestId("pitch-3d-canvas")).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(async () => {
      const a = await estados(page);
      const i = a.indexOf("corriendo");
      return i >= 0 && a.indexOf("terminada", i + 1) > i;
    }, { timeout: 20_000 })
    .toBe(true);
  await expect(tarjeta.getByTestId("pitch-3d-rotulo")).toHaveText(ROTULO_3D);
  await expect(tarjeta.getByTestId("pitch-3d-rotulo")).toBeVisible();
  const despues = await Promise.all(cuerpos);
  expect(despues.some((x) => x.tiene)).toBe(true);
  // y la 2D sigue a un clic
  await tarjeta.getByTestId("pitch-2d").click();
  await expect(tarjeta.getByTestId("pitch-diagram")).toBeVisible();
});

test("sin WebGL: «3D» deja la 2D visible con su aviso, sin errores de página", async ({ page }) => {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    // @ts-expect-error — se bloquea el contexto WebGL a propósito
    HTMLCanvasElement.prototype.getContext = function (tipo: string, ...rest: unknown[]) {
      if (tipo === "webgl" || tipo === "webgl2" || tipo === "experimental-webgl") return null;
      return (original as (...a: unknown[]) => unknown).call(this, tipo, ...rest);
    };
  });
  await page.goto("/match/246");
  const tarjeta = await abrirGol(page, "e031");
  await tarjeta.getByTestId("pitch-3d-btn").click();
  await expect(tarjeta.getByTestId("sin-webgl")).toBeVisible();
  await expect(tarjeta.getByTestId("pitch-diagram")).toBeVisible();
  await expect(tarjeta.getByTestId("pitch-3d-canvas")).toHaveCount(0);
  expect(errores).toEqual([]);
});

test("presupuesto: el chunk de three pesa ≤ PRESUPUESTO_CHUNK_3D_KB gzip (build de producción)", () => {
  const raiz = join(process.cwd(), ".next", "static", "chunks");
  const archivos: string[] = [];
  const recorrer = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) recorrer(p);
      else if (n.endsWith(".js")) archivos.push(p);
    }
  };
  recorrer(raiz);
  const conThree = archivos.filter((f) => readFileSync(f, "utf8").includes(FIRMA_THREE));
  expect(conThree.length).toBeGreaterThan(0);
  for (const f of conThree) {
    const kb = gzipSync(readFileSync(f)).length / 1024;
    console.log(`[021] chunk 3D ${f.split(/[\\/]/).pop()}: ${kb.toFixed(1)} KB gzip`);
    expect(kb).toBeLessThanOrEqual(PRESUPUESTO_CHUNK_3D_KB);
  }
});

test("a 360 px: la tarjeta con la 3D no desborda", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const page = await ctx.newPage();
  await page.goto("/match/116");
  const tarjeta = await abrirGol(page, "e016");
  await tarjeta.getByTestId("pitch-3d-btn").click();
  await expect(tarjeta.getByTestId("pitch-3d")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await ctx.close();
});
