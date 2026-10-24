// Brief 058 · Bloque A · Narración activa por defecto en el directo (A1, A1b, A1c, A2, A3, A4 y A5).
// Todo simulado: /herramientas, POST /api/arena/sesiones, /emision, /eventos y /relato. El AudioContext está
// instrumentado: un escuchador `click` de window en captura pone `__enGesto = true` y uno en burbuja lo pone
// a false; el manejador de React corre entre ambos. Las cifras se leen de las constantes, nunca a mano.
import { readFile } from "node:fs/promises";
import { expect, test, type Page, type Route } from "@playwright/test";
import { wavMono } from "../src/arena/pista-audio";
import type { RegistroArena } from "../src/arena/tipos";
import { NARRACION_DIRECTO } from "../src/sim/limites";

test.describe.configure({ mode: "serial" });

type Llamada = { tipo: "ctor" | "resume" | "start"; enGesto: boolean; t: number };
type Pedido = { desdeTick: number; hastaTick: number; idioma: "es" | "en"; intervencion?: string; variante?: string; entradaTick?: number };
type Ventana = { __llamadas: Llamada[]; __clic: number[]; __contextos: AudioContext[]; __marcas: Record<string, number>; __desbloquear: boolean };

const SR = 24000;
const wav = async (s: number) => Buffer.from(await wavMono([Float32Array.from({ length: Math.round(s * SR) }, (_, i) => 0.05 * Math.sin(i / 9))], SR).arrayBuffer()).toString("base64");
const leer = async (ruta: string) => JSON.parse(await readFile(ruta, "utf8")) as RegistroArena;
const prefijo = (r: RegistroArena, t: number): RegistroArena => ({ ...r, eventos: r.eventos.filter(e => e.tick <= t), fotogramas: r.fotogramas.filter(f => f.tick <= t), rondas: r.rondas.filter(x => x.inicioTick < t), final: [...r.fotogramas].reverse().find(f => f.tick <= t)! });
const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));
const asignacion = { modo: "programado", local: { id: "programado", nombre: "Programmed", controlador: "programado" }, visita: { id: "programado", nombre: "Programmed", controlador: "programado" } };
const clave = NARRACION_DIRECTO.clavePreferencia;

/** Instrumenta el gesto, el AudioContext y las marcas de tiempo de los botones de voz. Con `bloquearAudio`,
 * `resume()` no se resuelve nunca y el estado es `suspended` hasta que la prueba ponga `__desbloquear`. */
async function instrumentar(page: Page, opciones: { bloquearAudio?: boolean; bloquearAlmacen?: boolean } = {}) {
  await page.addInitScript(({ bloquearAudio, bloquearAlmacen }) => {
    const w = window as unknown as Ventana & typeof window;
    w.__llamadas = []; w.__clic = []; w.__contextos = []; w.__marcas = {}; w.__desbloquear = false;
    let enGesto = false;
    if (bloquearAlmacen) Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new DOMException("bloqueado", "SecurityError"); } });
    window.addEventListener("click", () => { enGesto = true; w.__clic.push(performance.now()); }, true);
    window.addEventListener("click", () => { enGesto = false; });
    const Base = window.AudioContext;
    window.AudioContext = class extends Base {
      // La marca se toma al LLAMAR al constructor (antes de super): crear el primer contexto puede tardar en una máquina cargada.
      constructor(o?: AudioContextOptions) { const t = performance.now(), dentro = enGesto; super(o); w.__llamadas.push({ tipo: "ctor", enGesto: dentro, t }); w.__contextos.push(this); }
      override get state(): AudioContextState { const real = super.state; return bloquearAudio && !w.__desbloquear && real !== "closed" ? "suspended" : real; }
      override resume() { w.__llamadas.push({ tipo: "resume", enGesto, t: performance.now() }); return bloquearAudio && !w.__desbloquear ? new Promise<void>(() => {}) : super.resume(); }
    };
    const iniciar = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, ...a: Parameters<AudioBufferSourceNode["start"]>) { w.__llamadas.push({ tipo: "start", enGesto, t: performance.now() }); return iniciar.apply(this, a); };
    document.addEventListener("DOMContentLoaded", () => new MutationObserver(() => {
      for (const texto of ["Turn narration off", "Enable narration", "Enable audio playback", "Desactivar narración"]) {
        if (w.__marcas[texto] === undefined && [...document.querySelectorAll("button")].some(b => b.textContent === texto)) w.__marcas[texto] = performance.now();
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true }));
  }, { bloquearAudio: opciones.bloquearAudio ?? false, bloquearAlmacen: opciones.bloquearAlmacen ?? false });
}
const ventana = (page: Page) => page.evaluate(() => { const w = window as unknown as Ventana; return { llamadas: w.__llamadas, clic: w.__clic, estados: w.__contextos.map(c => c.state), marcas: w.__marcas }; });

const soloKeepalive = (r: Route) => r.fulfill({ headers: { "content-type": "text/event-stream" }, body: ": keepalive\n\n" }).catch(() => {});

/** Directo simulado: POST que crea `id` (con `retrasoPostMs`), instantánea hasta `corte` y SSE que, con
 * `avanceMs`, entrega todo hasta el tick 300 a ese plazo. /relato: 404 a las intervenciones; tramos vacíos;
 * la entrada, 0,3 s de audio. */
async function directo(page: Page, id: string, opciones: { voz?: boolean; retrasoPostMs?: number; avanceMs?: number; corte?: number } = {}) {
  const registro = await leer("public/experimentos/arena-duelo-v3.json"), corte = opciones.corte ?? 0, hasta = 300;
  const entrada = await wav(0.3);
  const pedidos: Pedido[] = [], posts: number[] = [];
  await page.route("**/api/arena/herramientas", r => r.fulfill({ json: { voz: opciones.voz ?? true, analista: false } }));
  await page.route("**/api/arena/sesiones", async r => {
    if (r.request().method() !== "POST") return r.fallback();
    posts.push(Date.now());
    if (opciones.retrasoPostMs) await esperar(opciones.retrasoPostMs);
    await r.fulfill({ json: { id, asignacion } }).catch(() => {});
  });
  await page.route(`**/api/arena/sesiones/${id}/emision`, r => r.fulfill({ json: { registro: prefijo(registro, corte), comentarios: [], intervenciones: [], asignacion, metricas: {}, estado: "ejecutando", ultimoMensaje: 1 } }));
  let llamadas = 0;
  const final = [...registro.fotogramas].reverse().find(f => f.tick <= hasta)!;
  const publicaciones = [
    ...registro.rondas.filter(x => x.inicioTick >= corte && x.inicioTick < hasta).map(ronda => ({ tipo: "ordenes", ronda })),
    { tipo: "avance", estado: final, fotogramas: registro.fotogramas.filter(f => f.tick > corte && f.tick <= hasta), eventos: registro.eventos.filter(e => e.tick > corte && e.tick <= hasta) },
  ];
  await page.route(`**/api/arena/sesiones/${id}/eventos*`, async r => {
    if (llamadas++ > 0 || opciones.avanceMs === undefined) return soloKeepalive(r);
    await esperar(opciones.avanceMs);
    await r.fulfill({ headers: { "content-type": "text/event-stream" }, body: publicaciones.map((publicacion, i) => `id: ${i + 2}\nevent: arena\ndata: ${JSON.stringify({ id: i + 2, publicacion })}\n\n`).join("") }).catch(() => {});
  });
  await page.route(`**/api/arena/sesiones/${id}/relato`, async r => {
    const p = r.request().postDataJSON() as Pedido; pedidos.push(p);
    if (p.intervencion) return r.fulfill({ status: 404, json: { error: "Sin invitados en esta prueba" } }).catch(() => {});
    if (p.entradaTick !== undefined) return r.fulfill({ json: { desdeTick: p.desdeTick, hastaTick: p.hastaTick, modo: "buffer", idioma: p.idioma, entradaTick: p.entradaTick, texto: "Apertura", fragmentos: [{ tick: p.entradaTick, texto: "Apertura", emocion: "serena", intensidad: .2, variante: 0, fuentes: [], fotogramas: [] }], fuentes: [], fotogramas: [], eventosDisponibles: 0, eventosNarrados: 1, conduccionesNarradas: 0, prioridad: 10, cierre: false, tipoRelato: "entrada", claveVoz: "prueba:entrada", audio: { base64: entrada, tipo: "audio/wav" } } }).catch(() => {});
    return r.fulfill({ json: { desdeTick: p.desdeTick, hastaTick: p.hastaTick, modo: "buffer", idioma: p.idioma, texto: "", fragmentos: [], fuentes: [], fotogramas: [], eventosDisponibles: 0, eventosNarrados: 0, conduccionesNarradas: 0, prioridad: 10, cierre: false, tipoRelato: "comentario", audio: null } }).catch(() => {});
  });
  return { pedidos, posts };
}
const iniciar = (page: Page) => page.getByTestId("arena-live").getByRole("button", { name: "Start live match", exact: true }).click();
const casilla = (page: Page) => page.getByTestId("arena-live-voice").getByRole("checkbox");
const vozApagar = (page: Page) => page.getByRole("button", { name: "Turn narration off", exact: true });
const vozActivar = (page: Page) => page.getByRole("button", { name: "Enable narration", exact: true });

/** A1: las tres llamadas del cebado ocurren dentro del gesto del clic, en ≤ 50 ms, y queda un solo contexto,
 * en `running`, adoptado por el búfer. */
async function comprobarCebado(page: Page) {
  await expect.poll(async () => (await ventana(page)).estados).toEqual(["running"]);
  const { llamadas, clic } = await ventana(page);
  const primera = (tipo: Llamada["tipo"]) => llamadas.find(l => l.tipo === tipo);
  for (const tipo of ["ctor", "resume", "start"] as const) expect(primera(tipo), JSON.stringify(llamadas)).toMatchObject({ enGesto: true });
  expect(clic.length).toBeGreaterThan(0);
  expect(primera("ctor")!.t - clic[clic.length - 1]!).toBeLessThanOrEqual(50);
  expect(llamadas.filter(l => l.tipo === "ctor")).toHaveLength(1);
}

test("058 · A1 arranque con voz por defecto: contexto cebado dentro del clic, narración activa sin otro clic, nota fija y sin variantes breves", async ({ page }) => {
  const errores: string[] = []; page.on("pageerror", e => errores.push(e.message));
  const id = "00000000-0000-4000-8000-000000005801";
  const { pedidos } = await directo(page, id);
  await instrumentar(page);
  await page.goto("/arena");
  await expect(casilla(page)).toBeVisible();
  await expect(casilla(page)).toBeChecked();
  await expect(page.getByTestId("arena-live-voice")).toContainText("Narrate the match");
  expect(await page.evaluate(k => localStorage.getItem(k), clave)).toBeNull();
  await iniciar(page);
  await expect(vozApagar(page)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("arena-voice-default-note")).toHaveText("Narration started with the match. «Turn narration off» mutes it; this browser remembers your choice.");
  // La nota no es región viva.
  await expect(page.getByTestId("arena-voice-default-note")).not.toHaveAttribute("role", /.+/);
  await comprobarCebado(page);
  // La activación automática no escribe la preferencia.
  expect(await page.evaluate(k => localStorage.getItem(k), clave)).toBeNull();
  // Se pidió algo con la voz activa (las piezas de la previa) y nada en variante breve.
  await expect.poll(() => pedidos.length).toBeGreaterThan(0);
  await page.waitForTimeout(1000);
  expect(pedidos.filter(p => p.variante === "breve")).toEqual([]);
  // La casilla queda deshabilitada mientras hay sesión.
  await expect(casilla(page)).toBeDisabled();
  expect(errores).toEqual([]);
});

test("058 · A1b el POST tarda 3 s: la voz arranca igual con el contexto adoptado", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000005802";
  await directo(page, id, { retrasoPostMs: 3000 });
  await instrumentar(page);
  await page.goto("/arena");
  await expect(casilla(page)).toBeChecked();
  await iniciar(page);
  await expect(vozApagar(page)).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
  await comprobarCebado(page);
});

test("058 · A1c cambiar de idioma en una sesión propia con la voz activa la reactiva sola en el idioma nuevo", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000005803";
  await directo(page, id);
  await instrumentar(page);
  await page.goto("/arena");
  await iniciar(page);
  await expect(vozApagar(page)).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Switch to Spanish" }).click();
  await expect(page.getByRole("button", { name: "Desactivar narración", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("arena-voice-default-note")).toHaveText("La narración empezó con el partido. «Desactivar narración» la silencia; este navegador recuerda tu elección.");
  await expect.poll(async () => (await ventana(page)).estados.at(-1)).toBe("running");
  // Con la voz apagada antes del cambio, no se reactiva.
  await page.getByRole("button", { name: "Desactivar narración", exact: true }).click();
  await page.getByRole("button", { name: "Cambiar a inglés" }).click();
  await expect(vozActivar(page)).toHaveAttribute("aria-pressed", "false");
  await page.waitForTimeout(500);
  await expect(vozActivar(page)).toBeVisible();
});

test("058 · A2 preferencia: «Turn narration off» guarda «0»; la casilla vuelve sin marcar y la voz no arranca; marcarla guarda «1»; almacenamiento bloqueado", async ({ page, browser }) => {
  const id = "00000000-0000-4000-8000-000000005804";
  await directo(page, id);
  await instrumentar(page);
  await page.goto("/arena");
  await iniciar(page);
  await vozApagar(page).click();
  await expect(vozActivar(page)).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(k => localStorage.getItem(k), clave)).toBe("0");

  // Recargar (sin la sesión guardada en sessionStorage) y repetir: la casilla sin marcar, la voz no arranca.
  await page.evaluate(() => sessionStorage.clear()); await page.reload();
  await expect(casilla(page)).toBeVisible();
  await expect(casilla(page)).not.toBeChecked();
  await iniciar(page);
  await expect(vozActivar(page)).toBeVisible();
  await page.waitForTimeout(NARRACION_DIRECTO.desbloqueoMs);
  await expect(vozActivar(page)).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("arena-voice-default-note")).toHaveCount(0);
  expect((await ventana(page)).llamadas.filter(l => l.tipo === "ctor")).toHaveLength(0);
  expect(await page.evaluate(k => localStorage.getItem(k), clave)).toBe("0");

  // Marcar la casilla e iniciar: arranca y la preferencia queda en «1».
  await page.evaluate(() => sessionStorage.clear()); await page.reload();
  await expect(casilla(page)).not.toBeChecked();
  await casilla(page).check();
  expect(await page.evaluate(k => localStorage.getItem(k), clave)).toBe("1");
  await iniciar(page);
  await expect(vozApagar(page)).toHaveAttribute("aria-pressed", "true");
  await comprobarCebado(page);
  expect(await page.evaluate(k => localStorage.getItem(k), clave)).toBe("1");

  // Variante con localStorage bloqueado (el getter lanza): la página carga y A1 funciona.
  const ctx = await browser.newContext(); const otra = await ctx.newPage();
  const errores: string[] = []; otra.on("pageerror", e => errores.push(e.message));
  await directo(otra, "00000000-0000-4000-8000-000000005805");
  await instrumentar(otra, { bloquearAlmacen: true });
  await otra.goto("/arena");
  await expect(casilla(otra)).toBeChecked();
  await iniciar(otra);
  await expect(vozApagar(otra)).toHaveAttribute("aria-pressed", "true");
  await comprobarCebado(otra);
  await vozApagar(otra).click();
  await expect(vozActivar(otra)).toBeVisible();
  expect(errores).toEqual([]);
  await ctx.close();
});

test("058 · A3 sin voz en el servidor: ni casilla ni contexto, y el reloj como hoy", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000005806";
  await directo(page, id, { voz: false, avanceMs: 2000 });
  await instrumentar(page);
  await page.goto("/arena");
  await expect(page.getByTestId("arena-live").getByRole("button", { name: "Start live match", exact: true })).toBeEnabled();
  await page.waitForTimeout(500);
  await expect(page.getByTestId("arena-live-voice")).toHaveCount(0);
  await iniciar(page);
  await expect(page.getByTestId("arena-buffer")).toContainText("Audio is unavailable on this server.");
  await expect(vozActivar(page)).toBeDisabled();
  await expect(page.getByTestId("arena-clock")).toContainText("0:01 /", { timeout: 15_000 });
  expect((await ventana(page)).llamadas).toEqual([]);
});

test("058 · A4 autoplay bloqueado: «Enable audio playback» aparece antes de desbloqueoMs + 0,5 s, el reloj no se retiene y el clic lo recupera", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000005807";
  await directo(page, id, { avanceMs: 2000 });
  await instrumentar(page, { bloquearAudio: true });
  await page.goto("/arena");
  await iniciar(page);
  const pulsar = page.getByRole("button", { name: "Enable audio playback", exact: true });
  await expect(pulsar).toBeVisible({ timeout: NARRACION_DIRECTO.desbloqueoMs + 5000 });
  const { marcas, estados } = await ventana(page);
  expect(estados).toEqual(["suspended"]);
  expect(marcas["Enable audio playback"]! - marcas["Turn narration off"]!).toBeLessThanOrEqual(NARRACION_DIRECTO.desbloqueoMs + 500);
  await expect(page.getByTestId("arena-clock")).toContainText("0:01 /", { timeout: 15_000 });
  // Recuperación: con resume restaurado en ese clic, el contexto pasa a running y el botón desaparece.
  await page.evaluate(() => { (window as unknown as Ventana).__desbloquear = true; });
  await pulsar.click();
  await expect.poll(async () => (await ventana(page)).estados).toEqual(["running"]);
  await expect(pulsar).toHaveCount(0);
});

test("058 · A5 enlace compartido: con voz y preferencia por defecto no se activa sola (hace falta el gesto)", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000005808";
  await directo(page, id);
  await instrumentar(page);
  await page.goto(`/arena?partido=${id}&vista=buffer`);
  await expect(vozActivar(page)).toBeEnabled();
  await page.waitForTimeout(NARRACION_DIRECTO.desbloqueoMs);
  await expect(vozActivar(page)).toHaveAttribute("aria-pressed", "false");
  expect((await ventana(page)).llamadas.filter(l => l.tipo === "ctor")).toHaveLength(0);
  // Activar a mano escribe «1».
  await vozActivar(page).click();
  await expect(vozApagar(page)).toBeVisible();
  expect(await page.evaluate(k => localStorage.getItem(k), clave)).toBe("1");
  await expect(page.getByTestId("arena-voice-default-note")).toHaveCount(0);
});

test("058 · A6 360 px y 1440 px, claro y oscuro, EN y ES: casilla y nota sin desbordar (capturas con CAPTURAS_058=1)", async ({ browser }) => {
  test.setTimeout(120_000);
  const guardar = process.env.CAPTURAS_058 === "1", carpeta = "docs/evidencia/narracion-058";
  const casos = [
    { ancho: 1440, alto: 900, tema: "light" as const, es: false }, { ancho: 1440, alto: 900, tema: "dark" as const, es: false },
    { ancho: 360, alto: 740, tema: "light" as const, es: false }, { ancho: 360, alto: 740, tema: "dark" as const, es: false },
    { ancho: 360, alto: 740, tema: "dark" as const, es: true },
  ];
  let n = 0;
  for (const c of casos) {
    const ctx = await browser.newContext({ viewport: { width: c.ancho, height: c.alto }, colorScheme: c.tema });
    const page = await ctx.newPage();
    await directo(page, `00000000-0000-4000-8000-0000000058${String(10 + n++)}`);
    await instrumentar(page);
    await page.goto("/arena");
    if (c.es) await page.getByRole("button", { name: "Switch to Spanish" }).click();
    const nombre = `${c.es ? "es" : "en"}-${c.tema === "dark" ? "oscuro" : "claro"}-${c.ancho}`;
    const live = page.getByTestId("arena-live"), etiqueta = page.getByTestId("arena-live-voice");
    await expect(etiqueta).toContainText(c.es ? "Narrar el partido" : "Narrate the match");
    await etiqueta.scrollIntoViewIfNeeded();
    expect((await etiqueta.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // Casilla y texto en la misma fila (la regla de la sala de control apilaba las etiquetas en rejilla).
    expect(await etiqueta.evaluate(e => { const c = getComputedStyle(e); return `${c.display} ${c.flexDirection}`; })).toMatch(/flex row$/);
    expect((await etiqueta.boundingBox())!.height).toBeLessThan(2 * 44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(c.ancho);
    if (guardar) await live.screenshot({ path: `${carpeta}/casilla-${nombre}.png` });
    await live.getByRole("button", { name: c.es ? "Iniciar partido en vivo" : "Start live match", exact: true }).click();
    const nota = page.getByTestId("arena-voice-default-note");
    await expect(nota).toBeVisible();
    await expect(page.getByRole("button", { name: c.es ? "Desactivar narración" : "Turn narration off", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("arena-buffer").scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(c.ancho);
    if (guardar) await page.getByTestId("arena-buffer").screenshot({ path: `${carpeta}/narracion-activa-${nombre}.png` });
    await ctx.close();
  }
});
