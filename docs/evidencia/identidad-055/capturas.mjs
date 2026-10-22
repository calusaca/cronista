// Brief 055 (v1.1 § 9) · Capturas y métricas de /arena: 1440×900 y 360×740, claro y oscuro,
// portada y `?partido=`, más la Mesa en los cuatro estados (portada, ejemplo cargado, partido en
// vivo iniciado, URL con partido). Copiado y ampliado de docs/evidencia/rediseno-047/capturas.mjs.
//
// Uso (desde la raíz del repo):
//   node docs/evidencia/identidad-055/capturas.mjs antes   [URL base de /arena] [id de partido]
//   node docs/evidencia/identidad-055/capturas.mjs despues [URL base de /arena] [id de partido] [--solo-a]
//
// · `antes` registra las métricas (incluidos favicon 404 y cancha bajo el pliegue) y sale con 0
//   salvo desborde horizontal o errores JS.
// · `despues` aplica además los umbrales del brief y falla si alguno no se cumple:
//   favicon = 200 (en `/arena` y en `/`), dos `data-kit` distintos en el marcador, y en escritorio
//   canchaAbajo ≤ 900, marcadorAbajo ≤ 330, altoCabecera ≤ 96 (portada y partido), Mesa ≤ 700 en
//   los dos estados plegados; a 360 px marcadorAbajo ≤ 420 y cancha ≥ 316 px de ancho.
//   Con `--solo-a` (entrega mínima del Bloque A, v1.1 «P1 realista») se omiten los umbrales de Z2.
// · Si no se da un id de partido, el script crea uno con la API (demostración programada,
//   presentación «preparada», semilla fija 4242, 60 s): no llama a ningún modelo.
// · Orden de medida en cada vista: goto → arena-pitch.waitFor() → scrollTo(0,0) → medir →
//   captura → interacciones (deslizador, #arena-watch).
import { chromium } from "@playwright/test";

const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
const soloA = process.argv.includes("--solo-a");
const modo = args[0] === "despues" ? "despues" : "antes";
const BASE = args[1] ?? "https://cronista-arena.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io/arena";
const ORIGEN = new URL(BASE).origin;
const DIR = "docs/evidencia/identidad-055";

async function crearPartido() {
  const r = await fetch(`${ORIGEN}/api/arena/sesiones`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ seed: 4242, segundos: 60, local: "auto", visita: "auto", seleccion: { modo: "programado" }, presentacion: "preparada" }),
  });
  if (!r.ok) throw new Error(`No se pudo crear el partido: ${r.status} ${await r.text()}`);
  const { id } = await r.json();
  for (let i = 0; i < 240; i++) {
    const rep = await fetch(`${ORIGEN}/api/arena/sesiones/${id}/reproduccion`);
    if (rep.ok) return id;
    await new Promise(res => setTimeout(res, 500));
  }
  throw new Error("El partido preparado no terminó a tiempo");
}
const PARTIDO = args[2] ?? await crearPartido();
console.log(JSON.stringify({ modo, base: BASE, partido: PARTIDO, soloA }));

/** Métricas del primer encuadre, medidas sin desplazar (scrollTo(0,0) antes). */
const medir = () => {
  const r = s => document.querySelector(s)?.getBoundingClientRect();
  const abajo = s => { const b = r(s); return b ? Math.round(b.bottom + scrollY) : null; };
  const companion = document.querySelector('[data-testid="arena-companion"]');
  const mesa = document.querySelector('[data-testid="arena-mesa"]');
  const emblema = r(".brand-emblem");
  const fill = sel => { const el = document.querySelector(sel); return el ? getComputedStyle(el).fill : null; };
  const pitch = r(".arena-pitch-wrap");
  return {
    anchoDocumento: document.documentElement.scrollWidth,
    marcadorAbajo: abajo(".arena-score"),
    canchaAbajo: abajo(".arena-pitch-wrap"),
    anchoCancha: pitch ? Math.round(pitch.width) : null,
    altoCabecera: r(".arena-intro") ? Math.round(r(".arena-intro").height) : null,
    controlDentroAcompanante: Boolean(companion && document.getElementById("arena-control") && companion.contains(document.getElementById("arena-control"))),
    mesaEnAcompanante: mesa ? Math.round(mesa.offsetTop) : null,
    setupAbierto: document.querySelector("details.arena-setup")?.open ?? null,
    kits: {
      escudos: [...document.querySelectorAll(".arena-score .arena-crest")].map(e => e.getAttribute("data-kit")),
      local: fill(".arena-local circle"), visita: fill(".arena-visita circle"),
    },
    emblema: emblema ? { x: Math.round(emblema.x), y: Math.round(emblema.y), w: Math.round(emblema.width), h: Math.round(emblema.height) } : null,
    faviconHref: document.querySelector('link[rel="icon"]')?.getAttribute("href") ?? null,
  };
};

async function favicon(page) {
  const href = await page.evaluate(() => document.querySelector('link[rel="icon"]')?.getAttribute("href") ?? null);
  // Sin <link rel="icon"> el navegador pide /favicon.ico: se registra ese estado.
  const url = new URL(href ?? "/favicon.ico", page.url()).toString();
  const res = await page.request.get(url);
  return { href, estado: res.status(), tipo: res.headers()["content-type"] ?? null };
}

const encuadres = [{ nombre: "escritorio", width: 1440, height: 900 }, { nombre: "movil", width: 360, height: 740 }];
const browser = await chromium.launch();
let problemas = 0;
const fallo = (cond, msg, lista) => { if (cond) lista.push(msg); };
for (const e of encuadres) for (const tema of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: e.width, height: e.height }, colorScheme: tema });
  const page = await ctx.newPage();
  const errores = []; page.on("pageerror", x => errores.push(String(x)));
  const nombre = `${DIR}/${modo}-${e.nombre}-${tema === "light" ? "claro" : "oscuro"}`;
  const umbrales = [];
  const filas = {};
  // 1) Portada sin partido.
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
  await page.getByTestId("arena-pitch").waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  filas.portada = await page.evaluate(medir);
  filas.portada.favicon = await favicon(page);
  await page.screenshot({ path: `${nombre}-inicio.png` });
  // Favicon también desde la portada de cronicas.
  const cronicas = await ctx.newPage();
  await cronicas.goto(new URL("/", BASE).toString(), { waitUntil: "networkidle", timeout: 90000 });
  filas.cronicas = { favicon: await favicon(cronicas), emblema: await cronicas.evaluate(() => { const b = document.querySelector(".brand-emblem")?.getBoundingClientRect(); return b ? { w: Math.round(b.width), h: Math.round(b.height) } : null; }) };
  if (e.nombre === "escritorio" && tema === "light") await cronicas.screenshot({ path: `${DIR}/${modo}-cronicas-cabecera.png`, clip: { x: 0, y: 0, width: e.width, height: 120 } });
  await cronicas.close();
  // 2) Partido compartido por URL (configuración plegada).
  await page.goto(`${BASE}?partido=${PARTIDO}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.getByTestId("arena-pitch").waitFor();
  await page.getByRole("slider", { name: "Match time" }).waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  filas.partido = await page.evaluate(medir);
  await page.screenshot({ path: `${nombre}-partido.png` });
  await page.getByRole("slider", { name: "Match time" }).fill("40");
  await page.waitForTimeout(800);
  await page.locator("#arena-watch").evaluate(x => x.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${nombre}-cancha.png` });
  // 3) Ejemplo cargado con las pestañas (configuración abierta, como hoy).
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
  await page.getByTestId("arena-pitch").waitFor();
  await page.getByRole("button", { name: "Saved matches" }).click();
  await page.getByRole("button", { name: "Load AI coaches example" }).click();
  await page.locator(".arena-board > .arena-empty").waitFor({ state: "detached", timeout: 30000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  filas.ejemplo = await page.evaluate(medir);
  await page.screenshot({ path: `${nombre}-ejemplo.png` });
  // 4) Partido en vivo iniciado (demostración programada, 30 s; se cancela al medir).
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
  await page.getByTestId("arena-pitch").waitFor();
  await page.getByLabel("Simulated duration").selectOption("30");
  await page.getByLabel("Controller selection").selectOption("programado");
  await page.getByTestId("arena-live").getByRole("button", { name: "Start live match" }).click();
  await page.getByTestId("arena-pitch-live-status").waitFor({ timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  filas.vivo = await page.evaluate(medir);
  await page.screenshot({ path: `${nombre}-vivo.png` });
  const cancelar = page.getByRole("button", { name: "Cancel live match" });
  if (await cancelar.count()) await cancelar.click().catch(() => {});
  await page.waitForTimeout(500);

  const desborde = Object.values(filas).some(f => f.anchoDocumento > e.width);
  if (modo === "despues") {
    fallo(filas.portada.favicon.estado !== 200, "favicon /arena ≠ 200", umbrales);
    fallo(filas.cronicas.favicon.estado !== 200, "favicon / ≠ 200", umbrales);
    for (const v of ["portada", "partido", "ejemplo"]) {
      const k = filas[v].kits.escudos;
      fallo(k.length !== 2 || k[0] === k[1], `${v}: kits del marcador no distintos (${k.join(",")})`, umbrales);
    }
    if (!soloA) {
      if (e.nombre === "escritorio") {
        for (const v of ["portada", "partido"]) {
          fallo(!(filas[v].canchaAbajo <= 900), `${v}: canchaAbajo ${filas[v].canchaAbajo} > 900`, umbrales);
          fallo(!(filas[v].marcadorAbajo <= 330), `${v}: marcadorAbajo ${filas[v].marcadorAbajo} > 330`, umbrales);
          fallo(!(filas[v].altoCabecera <= 96), `${v}: altoCabecera ${filas[v].altoCabecera} > 96`, umbrales);
          fallo(!filas[v].controlDentroAcompanante, `${v}: #arena-control fuera del acompañante`, umbrales);
        }
        for (const v of ["partido", "vivo"]) fallo(!(filas[v].mesaEnAcompanante <= 700), `${v}: mesaEnAcompanante ${filas[v].mesaEnAcompanante} > 700`, umbrales);
      } else {
        for (const v of ["portada", "partido"]) {
          fallo(!(filas[v].marcadorAbajo <= 420), `${v}: marcadorAbajo ${filas[v].marcadorAbajo} > 420 (360 px)`, umbrales);
          fallo(!(filas[v].anchoCancha >= 316), `${v}: cancha ${filas[v].anchoCancha} px < 316`, umbrales);
        }
      }
    }
  }
  if (desborde || errores.length || umbrales.length) problemas++;
  console.log(JSON.stringify({ encuadre: e.nombre, tema, ...filas, desborde, errores, umbrales }));
  await ctx.close();
}
await browser.close();
process.exitCode = problemas ? 1 : 0;
