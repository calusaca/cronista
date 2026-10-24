// Brief 058 · Bloque A · Narración activa por defecto en el directo (A1, A1b, A1c, A2, A3, A4 y A5).
// Todo simulado: /herramientas, POST /api/arena/sesiones, /emision, /eventos y /relato. El AudioContext está
// instrumentado: un escuchador `click` de window en captura pone `__enGesto = true` y uno en burbuja lo pone
// a false; el manejador de React corre entre ambos. Las cifras se leen de las constantes, nunca a mano.
import { readFile } from "node:fs/promises";
import { expect, test, type Page, type Route } from "@playwright/test";
import { antesalaPartido } from "../src/arena/antesala";
import { BUFFER_ARENA, VOZ_BUFFER } from "../src/arena/buffer";
import { wavMono } from "../src/arena/pista-audio";
import { previaPartido } from "../src/arena/previa";
import type { AsignacionModelos } from "../src/arena/protocolo";
import { relatoIntervencion } from "../src/arena/relato";
import type { RegistroArena } from "../src/arena/tipos";
import { ANTESALA_ARENA, NARRACION_DIRECTO } from "../src/sim/limites";

test.describe.configure({ mode: "serial" });

type Llamada = { tipo: "ctor" | "resume" | "start"; enGesto: boolean; t: number };
type Pedido = { desdeTick: number; hastaTick: number; idioma: "es" | "en"; intervencion?: string; variante?: string; entradaTick?: number };
type Ventana = { __llamadas: Llamada[]; __clic: number[]; __contextos: AudioContext[]; __marcas: Record<string, number>; __desbloquear: boolean };

const SR = 24000;
const wav = async (s: number) => Buffer.from(await wavMono([Float32Array.from({ length: Math.round(s * SR) }, (_, i) => 0.05 * Math.sin(i / 9))], SR).arrayBuffer()).toString("base64");
const leer = async (ruta: string) => JSON.parse(await readFile(ruta, "utf8")) as RegistroArena;
const prefijo = (r: RegistroArena, t: number): RegistroArena => ({ ...r, eventos: r.eventos.filter(e => e.tick <= t), fotogramas: r.fotogramas.filter(f => f.tick <= t), rondas: r.rondas.filter(x => x.inicioTick < t), final: [...r.fotogramas].reverse().find(f => f.tick <= t)! });
const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));
const asignacionProgramada = { modo: "programado", local: { id: "programado", nombre: "Programmed", controlador: "programado" }, visita: { id: "programado", nombre: "Programmed", controlador: "programado" } };
const clave = NARRACION_DIRECTO.clavePreferencia;

/** Instrumenta el gesto, el AudioContext y las marcas de tiempo de los botones de voz. Con `bloquearAudio`,
 * `resume()` no se resuelve nunca y el estado es `suspended` hasta que la prueba ponga `__desbloquear`. */
async function instrumentar(page: Page, opciones: { bloquearAudio?: boolean; bloquearAlmacen?: boolean; bloquearNuevos?: boolean; resumeLentoMs?: number } = {}) {
  await page.addInitScript(({ bloquearAudio, bloquearAlmacen, bloquearNuevos, resumeLentoMs }) => {
    const w = window as unknown as Ventana & typeof window;
    w.__llamadas = []; w.__clic = []; w.__contextos = []; w.__marcas = {}; w.__desbloquear = false;
    let enGesto = false;
    if (bloquearAlmacen) Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new DOMException("bloqueado", "SecurityError"); } });
    window.addEventListener("click", () => { enGesto = true; w.__clic.push(performance.now()); }, true);
    window.addEventListener("click", () => { enGesto = false; });
    const Base = window.AudioContext;
    window.AudioContext = class extends Base {
      // La marca se toma al LLAMAR al constructor (antes de super): crear el primer contexto puede tardar en una máquina cargada.
      /** Codex 058 #3 · Política estricta (`bloquearNuevos`): solo se desbloquea el contexto creado en el gesto de
       * «Start live match»; cualquier contexto creado después queda suspendido y su resume() no se resuelve. */
      bloqueado = false;
      constructor(o?: AudioContextOptions) { const t = performance.now(), dentro = enGesto, previos = w.__contextos.length; super(o); this.bloqueado = !!bloquearNuevos && previos > 0; w.__llamadas.push({ tipo: "ctor", enGesto: dentro, t }); w.__contextos.push(this); }
      override get state(): AudioContextState { const real = super.state; return (bloquearAudio && !w.__desbloquear || this.bloqueado) && real !== "closed" ? "suspended" : real; }
      override resume() {
        w.__llamadas.push({ tipo: "resume", enGesto, t: performance.now() });
        if (bloquearAudio && !w.__desbloquear || this.bloqueado) return new Promise<void>(() => {});
        // Reanudación lenta (máquina cargada): el contexto sigue suspendido durante resumeLentoMs.
        return resumeLentoMs ? new Promise<void>(r => setTimeout(r, resumeLentoMs)).then(() => super.resume()) : super.resume();
      }
    };
    const iniciar = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, ...a: Parameters<AudioBufferSourceNode["start"]>) { w.__llamadas.push({ tipo: "start", enGesto, t: performance.now() }); return iniciar.apply(this, a); };
    document.addEventListener("DOMContentLoaded", () => new MutationObserver(() => {
      for (const texto of ["Turn narration off", "Enable narration", "Enable audio playback", "Desactivar narración"]) {
        if (w.__marcas[texto] === undefined && [...document.querySelectorAll("button")].some(b => b.textContent === texto)) w.__marcas[texto] = performance.now();
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true }));
  }, { bloquearAudio: opciones.bloquearAudio ?? false, bloquearAlmacen: opciones.bloquearAlmacen ?? false, bloquearNuevos: opciones.bloquearNuevos ?? false, resumeLentoMs: opciones.resumeLentoMs ?? 0 });
}
const ventana = (page: Page) => page.evaluate(() => { const w = window as unknown as Ventana; return { llamadas: w.__llamadas, clic: w.__clic, estados: w.__contextos.map(c => c.state), marcas: w.__marcas }; });

const soloKeepalive = (r: Route) => r.fulfill({ headers: { "content-type": "text/event-stream" }, body: ": keepalive\n\n" }).catch(() => {});

/** Directo simulado: POST que crea `id` (con `retrasoPostMs`), instantánea hasta `corte` y SSE que, con
 * `avanceMs`, entrega todo hasta el tick 300 a ese plazo. /relato: 404 a las intervenciones; tramos vacíos;
 * la entrada, 0,3 s de audio. */
async function directo(page: Page, id: string, opciones: { voz?: boolean; herramientas?: Promise<unknown>; retrasoPostMs?: number; hasta?: number; terminar?: boolean; avanceMs?: number; avance?: Promise<unknown>; corte?: number; asignacion?: object;
  /** Manejador propio de /relato (antesala, previa…): devuelve true si respondió. */
  relato?: (p: Pedido, r: Route) => Promise<boolean> } = {}) {
  const registro = await leer("public/experimentos/arena-duelo-v3.json"), corte = opciones.corte ?? 0, hasta = opciones.hasta ?? 300;
  const entrada = await wav(0.3);
  const pedidos: (Pedido & { t: number })[] = [], posts: number[] = [], cuerpos: Record<string, unknown>[] = [], enVuelo = { ahora: 0, maximo: 0 };
  const asignacion = opciones.asignacion ?? asignacionProgramada;
  await page.route("**/api/arena/herramientas", async r => { if (opciones.herramientas) await opciones.herramientas; await r.fulfill({ json: { voz: opciones.voz ?? true, analista: false } }).catch(() => {}); });
  await page.route("**/api/arena/sesiones", async r => {
    if (r.request().method() !== "POST") return r.fallback();
    posts.push(Date.now()); cuerpos.push(r.request().postDataJSON() as Record<string, unknown>);
    if (opciones.retrasoPostMs) await esperar(opciones.retrasoPostMs);
    await r.fulfill({ json: { id, asignacion } }).catch(() => {});
  });
  await page.route(`**/api/arena/sesiones/${id}/emision`, r => r.fulfill({ json: { registro: prefijo(registro, corte), comentarios: [], intervenciones: [], asignacion, metricas: {}, estado: "ejecutando", ultimoMensaje: 1 } }));
  let llamadas = 0;
  const final = [...registro.fotogramas].reverse().find(f => f.tick <= hasta)!;
  const publicaciones = [
    ...registro.rondas.filter(x => x.inicioTick >= corte && x.inicioTick < hasta).map(ronda => ({ tipo: "ordenes", ronda })),
    { tipo: "avance", estado: final, fotogramas: registro.fotogramas.filter(f => f.tick > corte && f.tick <= hasta), eventos: registro.eventos.filter(e => e.tick > corte && e.tick <= hasta) },
    ...opciones.terminar ? [{ tipo: "fin" }, { tipo: "terminada", estado: "completa", metricas: { decisiones: 4, respaldos: 0, duracionMs: 0, esperaModeloMs: [] } }] : [],
  ];
  await page.route(`**/api/arena/sesiones/${id}/eventos*`, async r => {
    if (llamadas++ > 0 || opciones.avanceMs === undefined && !opciones.avance) return soloKeepalive(r);
    if (opciones.avance) await opciones.avance; else await esperar(opciones.avanceMs!);
    await r.fulfill({ headers: { "content-type": "text/event-stream" }, body: publicaciones.map((publicacion, i) => `id: ${i + 2}\nevent: arena\ndata: ${JSON.stringify({ id: i + 2, publicacion })}\n\n`).join("") }).catch(() => {});
  });
  await page.route(`**/api/arena/sesiones/${id}/relato`, async r => {
    const p = r.request().postDataJSON() as Pedido; pedidos.push({ ...p, t: performance.now() });
    enVuelo.ahora++; enVuelo.maximo = Math.max(enVuelo.maximo, enVuelo.ahora);
    try { await atender(p, r); } finally { enVuelo.ahora--; }
  });
  async function atender(p: Pedido, r: Route) {
    if (opciones.relato && await opciones.relato(p, r)) return;
    if (p.intervencion) return r.fulfill({ status: 404, json: { error: "Sin invitados en esta prueba" } }).catch(() => {});
    if (p.entradaTick !== undefined) return r.fulfill({ json: { desdeTick: p.desdeTick, hastaTick: p.hastaTick, modo: "buffer", idioma: p.idioma, entradaTick: p.entradaTick, texto: "Apertura", fragmentos: [{ tick: p.entradaTick, texto: "Apertura", emocion: "serena", intensidad: .2, variante: 0, fuentes: [], fotogramas: [] }], fuentes: [], fotogramas: [], eventosDisponibles: 0, eventosNarrados: 1, conduccionesNarradas: 0, prioridad: 10, cierre: false, tipoRelato: "entrada", claveVoz: "prueba:entrada", audio: { base64: entrada, tipo: "audio/wav" } } }).catch(() => {});
    return r.fulfill({ json: { desdeTick: p.desdeTick, hastaTick: p.hastaTick, modo: "buffer", idioma: p.idioma, texto: "", fragmentos: [], fuentes: [], fotogramas: [], eventosDisponibles: 0, eventosNarrados: 0, conduccionesNarradas: 0, prioridad: 10, cierre: false, tipoRelato: "comentario", audio: null } }).catch(() => {});
  }
  return { pedidos, posts, cuerpos, enVuelo, registro };
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

// ——— Bloque B · Antesala (§ 9 y v1.1 §§ 2–5, 10; v1.3) ———
type FuenteB = { inicio: number; fin: number; duracion: number; detenida: boolean; intervencion?: string; kind?: string; texto?: string; reloj: string };
type MarcaB = { t: number; texto: string };
type VentanaB = { __fuentes: FuenteB[]; __estados: MarcaB[]; __relojes: MarcaB[]; __ctx: AudioContext[]; __vivas: number[] };
/** Etiqueta cada fuente con la transcripción visible (intervención, tipo y texto) y registra el estado del búfer y
 * el reloj en cada fotograma (requestAnimationFrame instrumentado). */
async function instrumentarB(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as VentanaB & typeof window;
    w.__fuentes = []; w.__estados = []; w.__relojes = []; w.__ctx = []; w.__vivas = [];
    const reloj = () => document.querySelector('[data-testid="arena-clock"]')?.textContent?.trim() ?? "";
    const Base = window.AudioContext;
    window.AudioContext = class extends Base {
      constructor(o?: AudioContextOptions) { super(o); w.__ctx.push(this); }
      override createBufferSource() {
        const f = super.createBufferSource(), iniciar = f.start.bind(f), detener = f.stop.bind(f);
        const dato: FuenteB = { inicio: 0, fin: 0, duracion: 0, detenida: false, reloj: "" };
        f.start = (cuando = 0) => {
          if (!f.buffer || f.buffer.length <= 1) return iniciar(cuando); // el cebado de una muestra
          const retraso = Math.max(0, cuando - this.currentTime);
          dato.inicio = performance.now() + retraso * 1000; dato.duracion = f.buffer.duration; dato.fin = dato.inicio + dato.duracion * 1000; dato.reloj = reloj();
          w.__fuentes.push(dato); iniciar(cuando);
        };
        f.stop = (cuando = 0) => { if (dato.fin > performance.now() + 20) dato.detenida = true; dato.fin = Math.min(dato.fin, performance.now()); detener(cuando); };
        f.addEventListener("ended", () => { dato.fin = Math.min(dato.fin, performance.now()); });
        return f;
      }
    };
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb: FrameRequestCallback) => raf(t => { cb(t); w.__relojes.push({ t: performance.now(), texto: reloj() }); });
    let previo = "", previoEstado = "";
    document.addEventListener("DOMContentLoaded", () => new MutationObserver(() => {
      const estado = document.querySelector('[data-testid="arena-buffer-status"]')?.textContent ?? "";
      if (estado && estado !== previoEstado) { previoEstado = estado; w.__estados.push({ t: performance.now(), texto: estado }); }
      // Codex 058 #4: regiones vivas del búfer en cada mutación mientras dura la presentación.
      if (/Pre-match presentation|Presentación del partido/.test(estado)) w.__vivas.push(document.querySelectorAll('[data-testid="arena-buffer"] [role="status"], [data-testid="arena-buffer"] [aria-live]').length);
      const el = document.querySelector<HTMLElement>('[data-testid="arena-voice-transcript"]');
      if (!el) return;
      const d = { intervencion: el.dataset.narrationIntervention, kind: el.dataset.narrationKind, texto: el.querySelector("p")?.textContent ?? "" };
      const clave = JSON.stringify(d); if (clave === previo) return; previo = clave;
      const f = [...w.__fuentes].reverse().find(x => x.kind === undefined); if (f) Object.assign(f, d);
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true }));
  });
}
const datosB = (page: Page) => page.evaluate(() => { const w = window as unknown as VentanaB; return { fuentes: w.__fuentes, estados: w.__estados, relojes: w.__relojes, ctx: w.__ctx.map(c => c.state), vivas: w.__vivas }; });
const asignacionModelos = { modo: "manual", local: { id: "equilibrado", nombre: "GPT-5.6 Luna", controlador: "azure-openai:equilibrado" }, visita: { id: "luna6", nombre: "GPT-6 Luna", controlador: "azure-openai:luna6" } } as const;
/** Sirve los clips de la antesala derivados del mismo registro y asignación (hechos del idioma pedido). */
function servirAntesala(registro: RegistroArena, asignacion: AsignacionModelos | null, opciones: { duracionS?: number; demoraMs?: (id: string, idioma: string) => number | Promise<unknown>; estado?: (id: string) => number | null } = {}) {
  const audios = new Map<number, Promise<string>>();
  const audio = (s: number) => { if (!audios.has(s)) audios.set(s, wav(s)); return audios.get(s)!; };
  return async (p: Pedido, r: Route): Promise<boolean> => {
    if (!p.intervencion?.startsWith("antesala:")) return false;
    const demora = opciones.demoraMs?.(p.intervencion, p.idioma);
    if (typeof demora === "number") await esperar(demora); else if (demora) await demora;
    const estado = opciones.estado?.(p.intervencion) ?? null;
    if (estado) { await r.fulfill({ status: estado, json: { error: "simulado" } }).catch(() => {}); return true; }
    const i = antesalaPartido(prefijo(registro, 0), asignacion, p.idioma).find(x => x.id === p.intervencion);
    if (!i) { await r.fulfill({ status: 404, json: { error: "Intervención no publicada" } }).catch(() => {}); return true; }
    await r.fulfill({ json: { ...relatoIntervencion(i, registro.config.partido.seed, p.idioma, "completa"), audio: { base64: await audio(opciones.duracionS ?? 0.6), tipo: "audio/wav" } } }).catch(() => {});
    return true;
  };
}
const idsGuion = (registro: RegistroArena, asignacion: AsignacionModelos | null) => antesalaPartido(prefijo(registro, 0), asignacion, "en").map(i => i.id);
const saltar = (page: Page) => page.getByTestId("arena-antesala-skip");
const deAntesala = (fuentes: FuenteB[]) => fuentes.filter(f => f.intervencion?.startsWith("antesala:")).sort((a, b) => a.inicio - b.inicio);

test("058 · B1 antesala completa: orden, huecos, reloj retenido con «Pre-match presentation», entrada al final, saque en ≤ 1 s y sin previa", async ({ page }) => {
  test.setTimeout(90_000);
  const id = "00000000-0000-4000-8000-000000005821";
  const registro = await leer("public/experimentos/arena-duelo-v3.json");
  const { pedidos } = await directo(page, id, { avanceMs: 2000, asignacion: asignacionModelos, relato: servirAntesala(registro, asignacionModelos as AsignacionModelos) });
  await instrumentarB(page);
  await page.goto("/arena");
  await iniciar(page);
  await expect(saltar(page)).toBeVisible();
  await expect(page.getByTestId("arena-buffer-status")).toContainText("Pre-match presentation");
  const ids = idsGuion(registro, asignacionModelos as AsignacionModelos);
  await expect.poll(async () => (await datosB(page)).estados.some(e => e.texto.startsWith("Live")), { timeout: 40_000 }).toBe(true);
  await expect(saltar(page)).toHaveCount(0);
  const { fuentes, estados, relojes, vivas } = await datosB(page);
  const clips = deAntesala(fuentes);
  expect(clips.map(f => f.intervencion)).toEqual(ids);
  // Codex 058 #4: una sola región viva en el búfer durante toda la presentación, también entre clips.
  expect(vivas.length).toBeGreaterThan(ids.length);
  expect(Math.max(...vivas)).toBe(1);
  for (let k = 1; k < clips.length; k++) {
    expect(clips[k]!.inicio, JSON.stringify([clips[k - 1], clips[k]])).toBeGreaterThanOrEqual(clips[k - 1]!.fin - 20);
    expect(clips[k]!.inicio - clips[k - 1]!.fin).toBeLessThanOrEqual((ANTESALA_ARENA.huecoS + 0.2) * 1000);
  }
  // La cabecera local dice el modelo del POST simulado.
  expect(clips.find(f => f.intervencion === "antesala:02-local-cabecera:0")!.texto).toContain(asignacionModelos.local.nombre);
  // La entrada después del último clip; el reloj sale de 0:00 (estado «Live») en ≤ 1 s tras su fin.
  const entrada = fuentes.find(f => f.kind === "entrada")!;
  expect(entrada.inicio).toBeGreaterThanOrEqual(clips.at(-1)!.fin - 20);
  const vivo = estados.find(e => e.texto.startsWith("Live"))!;
  expect(vivo.t - entrada.fin).toBeLessThanOrEqual(1000);
  // Durante todo el guion: reloj en 0:00 y la región viva con «Pre-match presentation».
  for (const r of relojes.filter(x => x.t >= clips[0]!.inicio && x.t <= entrada.fin)) expect(r.texto, String(r.t)).toMatch(/^0:00 /);
  const durante = estados.filter(e => e.t >= clips[0]!.inicio && e.t <= entrada.fin);
  for (const e of durante) expect(e.texto).toContain("Pre-match presentation");
  // Ninguna petición ni fuente de la previa del 056; una sola petición por clip.
  expect(pedidos.filter(p => p.intervencion?.startsWith("previa:"))).toEqual([]);
  expect(fuentes.filter(f => f.intervencion?.startsWith("previa:"))).toEqual([]);
  expect(pedidos.filter(p => p.intervencion?.startsWith("antesala:")).map(p => p.intervencion)).toEqual(ids);
});

test("058 · B2 «Skip to kick-off» con el teclado: la fuente se detiene, el botón desaparece, el reloj sale en ≤ 1,5 s y el foco pasa al botón de narración", async ({ page }) => {
  test.setTimeout(90_000);
  const id = "00000000-0000-4000-8000-000000005822";
  const registro = await leer("public/experimentos/arena-duelo-v3.json");
  await directo(page, id, { avanceMs: 1000, relato: servirAntesala(registro, asignacionProgramada as AsignacionModelos, { duracionS: 3 }) });
  await instrumentarB(page);
  await page.goto("/arena");
  await iniciar(page);
  await expect.poll(async () => deAntesala((await datosB(page)).fuentes).length, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
  await saltar(page).focus();
  const t = await page.evaluate(() => performance.now());
  await page.keyboard.press("Enter");
  await expect(saltar(page)).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement?.textContent)).toBe("Turn narration off");
  await expect.poll(async () => (await datosB(page)).estados.find(e => e.t >= t && e.texto.startsWith("Live"))?.t ?? null, { timeout: 5000 }).not.toBeNull();
  const { fuentes, estados } = await datosB(page);
  expect(estados.find(e => e.t >= t && e.texto.startsWith("Live"))!.t - t).toBeLessThanOrEqual(1500);
  const cortada = deAntesala(fuentes).at(-1)!;
  expect(cortada.detenida).toBe(true);
  // Ninguna fuente de la antesala arranca después de saltar.
  expect(deAntesala(fuentes).filter(f => f.inicio > t + 50)).toEqual([]);
});

test("058 · B3 fallos: con 404 en antesala:* la retención se suelta en ≤ 2 s, la previa del 056 suena y no vuelve «Pre-match presentation»", async ({ page }) => {
  test.setTimeout(90_000);
  const id = "00000000-0000-4000-8000-000000005823";
  const registro = await leer("public/experimentos/arena-duelo-v3.json"), corte = BUFFER_ARENA.tramoTicks;
  const piezas = previaPartido(prefijo(registro, corte)), pieza = await wav(1.5);
  const { pedidos } = await directo(page, id, { corte, relato: async (p, r) => {
    if (p.intervencion?.startsWith("antesala:")) { await r.fulfill({ status: 404, json: { error: "Intervención no publicada" } }).catch(() => {}); return true; }
    const i = piezas.find(x => x.id === p.intervencion);
    if (!i) return false;
    await r.fulfill({ json: { ...relatoIntervencion(i, registro.config.partido.seed, p.idioma, (p.variante ?? "completa") as "completa" | "breve"), audio: { base64: pieza, tipo: "audio/wav" } } }).catch(() => {});
    return true;
  } });
  await instrumentarB(page);
  await page.goto("/arena");
  const t = await page.evaluate(() => performance.now());
  await iniciar(page);
  await expect.poll(async () => (await datosB(page)).fuentes.filter(f => f.intervencion?.startsWith("previa:")).length, { timeout: 30_000 }).toBe(piezas.length);
  const { estados } = await datosB(page);
  const presentacion = estados.filter(e => e.texto.includes("Pre-match presentation"));
  const suelta = estados.find(e => e.t > (presentacion.at(-1)?.t ?? t) && !e.texto.includes("Pre-match presentation"));
  if (presentacion.length) {
    expect(suelta).toBeDefined();
    expect(suelta!.t - presentacion[0]!.t).toBeLessThanOrEqual(2000);
    expect(estados.filter(e => e.t > suelta!.t && e.texto.includes("Pre-match presentation"))).toEqual([]);
  }
  await expect(saltar(page)).toHaveCount(0);
  // Abandono tras maxFallosSeguidos: no se piden más clips (sin abandono se pedirían los nueve).
  expect(pedidos.filter(p => p.intervencion?.startsWith("antesala:"))).toHaveLength(ANTESALA_ARENA.maxFallosSeguidos);
});

test("058 · B4 enlace compartido con el reloj en marcha: «Enable narration» no pide la antesala", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000005824";
  const { pedidos } = await directo(page, id, { corte: 300 });
  await instrumentarB(page);
  await page.goto(`/arena?partido=${id}&vista=buffer`);
  await expect(page.getByTestId("arena-buffer-status")).toContainText("Live");
  await vozActivar(page).click();
  await page.waitForTimeout(1500);
  expect(pedidos.filter(p => p.intervencion?.startsWith("antesala:"))).toEqual([]);
  await expect(saltar(page)).toHaveCount(0);
});

test("058 · B5 @lento tope de pared: con clips de 20 s la fuente se corta y el reloj sale entre t0 + topeS y t0 + topeS + 1,5 s", async ({ page }) => {
  test.setTimeout(120_000);
  const id = "00000000-0000-4000-8000-000000005825";
  const registro = await leer("public/experimentos/arena-duelo-v3.json");
  const clipS = 20;
  expect(clipS).toBeLessThanOrEqual(VOZ_BUFFER.duracionMaxS);
  await directo(page, id, { avanceMs: 1000, relato: servirAntesala(registro, asignacionProgramada as AsignacionModelos, { duracionS: clipS }) });
  await instrumentarB(page);
  await page.goto("/arena");
  const t0 = await page.evaluate(() => performance.now());
  await iniciar(page);
  const limite = t0 + ANTESALA_ARENA.topeS * 1000;
  await expect.poll(async () => (await datosB(page)).estados.find(e => e.t >= limite - 500 && e.texto.startsWith("Live"))?.t ?? null, { timeout: (ANTESALA_ARENA.topeS + 15) * 1000, intervals: [1000] }).not.toBeNull();
  const { fuentes, estados } = await datosB(page);
  const vivo = estados.find(e => e.texto.startsWith("Live"))!;
  expect(vivo.t).toBeGreaterThanOrEqual(limite);
  expect(vivo.t).toBeLessThanOrEqual(limite + 1500);
  const ultima = deAntesala(fuentes).at(-1)!;
  expect(ultima.detenida).toBe(true);
  expect(ultima.fin).toBeLessThanOrEqual(limite + 1500);
});

test("058 · B6 (a) activación a mano en pausa en 0:00: la antesala espera a «Resume broadcast»; (b) pausar a mitad la suspende y el reloj no se mueve", async ({ page }) => {
  test.setTimeout(90_000);
  const id = "00000000-0000-4000-8000-000000005826";
  const registro = await leer("public/experimentos/arena-duelo-v3.json");
  const { pedidos } = await directo(page, id, { corte: BUFFER_ARENA.tramoTicks, relato: servirAntesala(registro, asignacionProgramada as AsignacionModelos, { duracionS: 2 }) });
  await instrumentar(page, { resumeLentoMs: NARRACION_DIRECTO.desbloqueoMs - 300 });
  await instrumentarB(page);
  await page.goto(`/arena?partido=${id}&vista=buffer`);
  await page.getByRole("button", { name: "Pause broadcast", exact: true }).click();
  await vozActivar(page).click();
  // Más que desbloqueoMs: el contexto suspendido por la pausa no cuenta como audio bloqueado ni suelta la retención.
  await page.waitForTimeout(NARRACION_DIRECTO.desbloqueoMs + 1000);
  await expect(page.getByRole("button", { name: "Enable audio playback", exact: true })).toHaveCount(0);
  expect(deAntesala((await datosB(page)).fuentes)).toEqual([]);
  expect(pedidos.filter(p => p.intervencion?.startsWith("antesala:"))).toEqual([]);
  await page.getByRole("button", { name: "Resume broadcast", exact: true }).click();
  await expect(page.getByTestId("arena-buffer-status")).toContainText("Pre-match presentation");
  await expect.poll(async () => deAntesala((await datosB(page)).fuentes).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
  // (b) Pausa a mitad: el contexto se suspende y el reloj sigue en 0:00; al continuar vuelve a «Pre-match presentation».
  await page.getByRole("button", { name: "Pause broadcast", exact: true }).click();
  await expect.poll(async () => (await datosB(page)).ctx.at(-1)).toBe("suspended");
  await expect(page.getByTestId("arena-clock")).toContainText("0:00 /");
  await page.getByRole("button", { name: "Resume broadcast", exact: true }).click();
  await expect(page.getByTestId("arena-buffer-status")).toContainText("Pre-match presentation");
  await expect.poll(async () => (await datosB(page)).ctx.at(-1)).toBe("running");
  await expect(page.getByTestId("arena-clock")).toContainText("0:00 /");
});

test("058 · B6 (c) activación a mano y la reserva se llena justo después: el reloj sigue en 0:00 en todos los fotogramas", async ({ page }) => {
  test.setTimeout(60_000);
  const id = "00000000-0000-4000-8000-000000005827";
  const registro = await leer("public/experimentos/arena-duelo-v3.json");
  let liberar!: () => void; const avance = new Promise<void>(r => { liberar = r; });
  await directo(page, id, { corte: 150, avance, relato: servirAntesala(registro, asignacionProgramada as AsignacionModelos, { duracionS: 1 }) });
  await instrumentarB(page);
  await page.goto(`/arena?partido=${id}&vista=buffer`);
  await expect(page.getByTestId("arena-buffer-status")).toContainText("Preparing broadcast");
  await vozActivar(page).click();
  const t = await page.evaluate(() => performance.now());
  liberar();
  await expect.poll(async () => deAntesala((await datosB(page)).fuentes).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
  const { relojes } = await datosB(page);
  for (const r of relojes.filter(x => x.t >= t)) expect(r.texto).toMatch(/^0:00 /);
});

test("058 · B7 token: una respuesta retenida que llega después de saltar no arranca ninguna fuente ni pide más clips", async ({ page }) => {
  test.setTimeout(60_000);
  const id = "00000000-0000-4000-8000-000000005828";
  const registro = await leer("public/experimentos/arena-duelo-v3.json");
  let liberar!: () => void; const retenida = new Promise<void>(r => { liberar = r; });
  const ids = idsGuion(registro, asignacionProgramada as AsignacionModelos);
  const { pedidos } = await directo(page, id, { avanceMs: 1000, relato: servirAntesala(registro, asignacionProgramada as AsignacionModelos, { duracionS: 1.5, demoraMs: x => x === ids[1] ? retenida : 0 }) });
  await instrumentarB(page);
  await page.goto("/arena");
  await iniciar(page);
  await expect.poll(() => pedidos.some(p => p.intervencion === ids[1]), { timeout: 15_000 }).toBe(true);
  await saltar(page).click();
  const n = pedidos.filter(p => p.intervencion?.startsWith("antesala:")).length;
  const antes = deAntesala((await datosB(page)).fuentes).length;
  const foco = await page.evaluate(() => document.activeElement?.textContent ?? null);
  liberar();
  // Más que esperaClipS: un estado viejo que siguiera vivo saltaría el clip cortado y arrancaría el retenido.
  await page.waitForTimeout((ANTESALA_ARENA.esperaClipS + 1.5) * 1000);
  expect(deAntesala((await datosB(page)).fuentes)).toHaveLength(antes);
  expect(await page.evaluate(() => document.activeElement?.textContent ?? null)).toBe(foco);
  expect(pedidos.filter(p => p.intervencion?.startsWith("antesala:"))).toHaveLength(n);
});

test("058 · B8 cambio de idioma con la antesala sonando y la reserva completa: el reloj sigue en 0:00 en cada fotograma; el clip EN tardío se descarta y sigue en ES desde el clip 1", async ({ page }) => {
  test.setTimeout(90_000);
  const id = "00000000-0000-4000-8000-000000005829";
  const registro = await leer("public/experimentos/arena-duelo-v3.json");
  let liberar!: () => void; const retenida = new Promise<void>(r => { liberar = r; });
  const ids = idsGuion(registro, asignacionProgramada as AsignacionModelos);
  const { pedidos } = await directo(page, id, { avanceMs: 500, relato: servirAntesala(registro, asignacionProgramada as AsignacionModelos, { duracionS: 1.5, demoraMs: (x, idioma) => idioma === "en" && x === ids[2] ? retenida : 0 }) });
  await instrumentarB(page);
  await page.goto("/arena");
  await iniciar(page);
  await expect.poll(() => pedidos.some(p => p.intervencion === ids[2] && p.idioma === "en"), { timeout: 15_000 }).toBe(true);
  await expect(page.getByTestId("arena-buffer-status")).toHaveAttribute("data-ready-seconds", /^(2\d|[3-9]\d)\./);
  const t = await page.evaluate(() => performance.now());
  await page.getByRole("button", { name: "Switch to Spanish" }).click();
  liberar();
  await expect.poll(async () => deAntesala((await datosB(page)).fuentes).filter(f => f.inicio > t).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
  const { fuentes, relojes } = await datosB(page);
  for (const r of relojes.filter(x => x.t >= t)) expect(r.texto, String(r.t)).toMatch(/^0:00 /);
  const despues = deAntesala(fuentes).filter(f => f.inicio > t);
  expect(despues[0]!.intervencion).toBe(ids[0]);
  // El clip EN retenido nunca suena (las fuentes posteriores son de las peticiones en español).
  const tras = pedidos.filter(p => p.t > 0 && p.intervencion?.startsWith("antesala:") && p.idioma === "es");
  expect(tras[0]!.intervencion).toBe(ids[0]);
  expect(despues.every(f => /Bienvenidos|sale en|En la portería|En el medio|Arriba/.test(f.texto ?? ""))).toBe(true);
});

test("058 · B9 Speech lento (2,5 s por respuesta): nunca más de 2 /relato en vuelo; con el último clip pendiente se pide la entrada y ningún invitado", async ({ page }) => {
  test.setTimeout(120_000);
  const id = "00000000-0000-4000-8000-000000005830";
  const registro = await leer("public/experimentos/arena-duelo-v3.json");
  const ids = idsGuion(registro, asignacionProgramada as AsignacionModelos);
  const servir = servirAntesala(registro, asignacionProgramada as AsignacionModelos, { duracionS: 0.6 });
  const { pedidos, enVuelo } = await directo(page, id, { avanceMs: 500, relato: async (p, r) => { await esperar(2500); return servir(p, r); } });
  await instrumentarB(page);
  await page.goto("/arena");
  await iniciar(page);
  await expect.poll(() => pedidos.some(p => p.entradaTick !== undefined), { timeout: 60_000 }).toBe(true);
  const entrada = pedidos.find(p => p.entradaTick !== undefined)!;
  const ultimo = pedidos.find(p => p.intervencion === ids.at(-1))!;
  expect(ultimo).toBeDefined();
  // La entrada se pide con el último clip todavía en vuelo (pedido antes y respondido 2,5 s después).
  expect(entrada.t).toBeGreaterThanOrEqual(ultimo.t);
  expect(entrada.t - ultimo.t).toBeLessThan(2500);
  await expect(saltar(page)).toHaveCount(0, { timeout: 60_000 });
  expect(enVuelo.maximo).toBeLessThanOrEqual(VOZ_BUFFER.concurrencia);
  expect(pedidos.filter(p => p.intervencion && !p.intervencion.startsWith("antesala:") && p.t < entrada.t)).toEqual([]);
});

test("058 · B10 dos espectadores en la misma sesión: cada uno ≤ 2 en vuelo y completa o abandona su antesala", async ({ browser }) => {
  test.setTimeout(120_000);
  const id = "00000000-0000-4000-8000-000000005831";
  const registro = await leer("public/experimentos/arena-duelo-v3.json");
  const ctx = await browser.newContext(), uno = await ctx.newPage(), otro = await ctx.newPage();
  const servir = servirAntesala(registro, asignacionProgramada as AsignacionModelos, { duracionS: 0.6, demoraMs: () => 400 });
  const a = await directo(uno, id, { relato: servir }), b = await directo(otro, id, { relato: servir });
  await instrumentarB(uno); await instrumentarB(otro);
  await uno.goto("/arena");
  await iniciar(uno);
  await otro.goto(`/arena?partido=${id}&vista=buffer`);
  await vozActivar(otro).click();
  for (const page of [uno, otro]) {
    await expect.poll(async () => deAntesala((await datosB(page)).fuentes).length, { timeout: 30_000 }).toBeGreaterThan(0);
    await expect(saltar(page)).toHaveCount(0, { timeout: 60_000 });
  }
  expect(a.enVuelo.maximo).toBeLessThanOrEqual(VOZ_BUFFER.concurrencia);
  expect(b.enVuelo.maximo).toBeLessThanOrEqual(VOZ_BUFFER.concurrencia);
  await ctx.close();
});

test("058 · A4b autoplay bloqueado y recuperado con el reloj en 0:00: la antesala empieza al habilitar el audio", async ({ page }) => {
  test.setTimeout(60_000);
  const id = "00000000-0000-4000-8000-000000005832";
  const registro = await leer("public/experimentos/arena-duelo-v3.json");
  const { pedidos } = await directo(page, id, { relato: servirAntesala(registro, asignacionProgramada as AsignacionModelos) });
  await instrumentar(page, { bloquearAudio: true });
  await instrumentarB(page);
  await page.goto("/arena");
  await iniciar(page);
  const pulsar = page.getByRole("button", { name: "Enable audio playback", exact: true });
  await expect(pulsar).toBeVisible({ timeout: NARRACION_DIRECTO.desbloqueoMs + 5000 });
  expect(pedidos.filter(p => p.intervencion?.startsWith("antesala:"))).toEqual([]);
  await expect(page.getByTestId("arena-clock")).toContainText("0:00 /");
  await page.evaluate(() => { (window as unknown as Ventana).__desbloquear = true; });
  await pulsar.click();
  await expect(saltar(page)).toBeVisible();
  await expect.poll(async () => deAntesala((await datosB(page)).fuentes).length, { timeout: 15_000 }).toBeGreaterThan(0);
});

test("058 · B11 360 px y 1440 px, claro y oscuro, EN y ES: antesala en curso sin desbordar (capturas con CAPTURAS_058=1)", async ({ browser }) => {
  test.setTimeout(120_000);
  const guardar = process.env.CAPTURAS_058 === "1", carpeta = "docs/evidencia/narracion-058";
  const registro = await leer("public/experimentos/arena-duelo-v3.json");
  const casos = [
    { ancho: 1440, alto: 900, tema: "light" as const, es: false }, { ancho: 1440, alto: 900, tema: "dark" as const, es: false },
    { ancho: 360, alto: 740, tema: "light" as const, es: false }, { ancho: 360, alto: 740, tema: "dark" as const, es: false },
    { ancho: 360, alto: 740, tema: "dark" as const, es: true },
  ];
  let n = 0;
  for (const c of casos) {
    const ctx = await browser.newContext({ viewport: { width: c.ancho, height: c.alto }, colorScheme: c.tema });
    const page = await ctx.newPage();
    await directo(page, `00000000-0000-4000-8000-0000000058${String(40 + n++)}`, { avanceMs: 500, asignacion: asignacionModelos, relato: servirAntesala(registro, asignacionModelos as AsignacionModelos, { duracionS: 6 }) });
    await page.goto("/arena");
    if (c.es) await page.getByRole("button", { name: "Switch to Spanish" }).click();
    await page.getByTestId("arena-live").getByRole("button", { name: c.es ? "Iniciar partido en vivo" : "Start live match", exact: true }).click();
    const boton = page.getByTestId("arena-antesala-skip");
    await expect(boton).toHaveText(c.es ? "Saltar al saque" : "Skip to kick-off");
    await expect(page.getByTestId("arena-buffer-status")).toContainText(c.es ? "Presentación del partido" : "Pre-match presentation");
    await expect(page.getByTestId("arena-voice-transcript")).toHaveAttribute("data-narration-intervention", /^antesala:/);
    await page.getByTestId("arena-buffer").scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(c.ancho);
    const nombre = `${c.es ? "es" : "en"}-${c.tema === "dark" ? "oscuro" : "claro"}-${c.ancho}`;
    if (guardar) await page.getByTestId("arena-buffer").screenshot({ path: `${carpeta}/antesala-${nombre}.png` });
    await ctx.close();
  }
});

test("058 · B12 (Codex #3) con una política que bloquea contextos creados fuera del gesto, cambiar de idioma no pide otro clic y transfiere la retención", async ({ page }) => {
  test.setTimeout(90_000);
  const id = "00000000-0000-4000-8000-000000005833";
  const registro = await leer("public/experimentos/arena-duelo-v3.json");
  const ids = idsGuion(registro, asignacionProgramada as AsignacionModelos);
  const { pedidos } = await directo(page, id, { avanceMs: 500, relato: servirAntesala(registro, asignacionProgramada as AsignacionModelos, { duracionS: 1.5 }) });
  await instrumentar(page, { bloquearNuevos: true });
  await instrumentarB(page);
  await page.goto("/arena");
  await iniciar(page);
  await expect.poll(async () => deAntesala((await datosB(page)).fuentes).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
  await expect(page.getByTestId("arena-buffer-status")).toHaveAttribute("data-ready-seconds", /^(2\d|[3-9]\d)\./);
  const t = await page.evaluate(() => performance.now());
  await page.getByRole("button", { name: "Switch to Spanish" }).click();
  await expect(page.getByRole("button", { name: "Desactivar narración", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => deAntesala((await datosB(page)).fuentes).filter(f => f.inicio > t).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
  await page.waitForTimeout(NARRACION_DIRECTO.desbloqueoMs + 500);
  // Sin otro clic: nunca aparece «Habilitar reproducción de audio» y sigue habiendo un solo contexto, en marcha.
  await expect(page.getByRole("button", { name: "Habilitar reproducción de audio", exact: true })).toHaveCount(0);
  expect((await ventana(page)).estados).toEqual(["running"]);
  const { fuentes, relojes, vivas } = await datosB(page);
  // La retención se transfiere: 0:00 en cada fotograma tras el cambio, y la antesala vuelve a empezar en español.
  for (const r of relojes.filter(x => x.t >= t && x.t <= deAntesala(fuentes).filter(f => f.inicio > t)[1]!.inicio)) expect(r.texto, String(r.t)).toMatch(/^0:00 /);
  expect(deAntesala(fuentes).filter(f => f.inicio > t)[0]!.intervencion).toBe(ids[0]);
  expect(pedidos.filter(p => p.intervencion?.startsWith("antesala:") && p.idioma === "es")[0]!.intervencion).toBe(ids[0]);
  expect(Math.max(...vivas)).toBe(1);
});

for (const voz of [true, false]) test(`058 · B13 (smoke rev. 0000027) «Start live match» antes de que responda /herramientas (voz: ${voz}): cebado en el gesto, reloj retenido hasta la respuesta y ${voz ? "antesala sin otro clic" : "contexto cerrado sin efectos"}`, async ({ page }) => {
  test.setTimeout(90_000);
  const id = `00000000-0000-4000-8000-00000000583${voz ? 4 : 5}`;
  const registro = await leer("public/experimentos/arena-duelo-v3.json");
  let liberar!: () => void; const barrera = new Promise<void>(r => { liberar = r; });
  const { pedidos } = await directo(page, id, { voz, herramientas: barrera, avanceMs: 300, relato: servirAntesala(registro, asignacionProgramada as AsignacionModelos) });
  await instrumentar(page);
  await instrumentarB(page);
  await page.goto("/arena");
  // La casilla aún no aparece (sin respuesta de /herramientas); su valor por defecto es marcar.
  await expect(page.getByTestId("arena-live-voice")).toHaveCount(0);
  await iniciar(page);
  await expect(page.getByTestId("arena-buffer")).toBeVisible();
  // Con la reserva ya completa, el reloj sigue retenido más allá de esperaHerramientasMs mientras /herramientas no responde.
  await expect(page.getByTestId("arena-buffer-status")).toHaveAttribute("data-ready-seconds", /^(2\d|[3-9]\d)\./);
  await page.waitForTimeout(NARRACION_DIRECTO.esperaHerramientasMs + 1000);
  await expect(page.getByTestId("arena-clock")).toContainText("0:00 /");
  const t = await page.evaluate(() => performance.now());
  liberar();
  const { llamadas } = await ventana(page);
  expect(llamadas.find(l => l.tipo === "ctor"), JSON.stringify(llamadas)).toMatchObject({ enGesto: true });
  if (voz) {
    await expect(vozApagar(page)).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => deAntesala((await datosB(page)).fuentes).length, { timeout: 15_000 }).toBeGreaterThan(0);
    const { fuentes, relojes } = await datosB(page);
    for (const r of relojes.filter(x => x.t <= deAntesala(fuentes)[0]!.inicio)) expect(r.texto, String(r.t)).toMatch(/^0:00 /);
    expect((await ventana(page)).estados).toEqual(["running"]);
    expect(pedidos.some(p => p.intervencion === idsGuion(registro, asignacionProgramada as AsignacionModelos)[0])).toBe(true);
  } else {
    await expect.poll(async () => (await ventana(page)).estados).toEqual(["closed"]);
    await expect(page.getByTestId("arena-clock")).toContainText("0:01 /", { timeout: 5000 });
    expect(pedidos.filter(p => p.intervencion?.startsWith("antesala:"))).toEqual([]);
    await expect(vozApagar(page)).toHaveCount(0);
    const despues = (await datosB(page)).estados.filter(e => e.t > t);
    expect(despues.some(e => e.texto.includes("Pre-match presentation"))).toBe(false);
  }
});

test("defecto rev. 0000029 · con el directo terminado (sin abrir la repetición) la duración y los ajustes se habilitan y el siguiente POST lleva segundos: 30; durante la generación siguen deshabilitados", async ({ page }) => {
  test.setTimeout(60_000);
  const id = "00000000-0000-4000-8000-000000005836";
  const registro = await leer("public/experimentos/arena-duelo-v3.json");
  let liberar!: () => void; const fin = new Promise<void>(r => { liberar = r; });
  const { cuerpos } = await directo(page, id, { voz: false, avance: fin, hasta: registro.final.tick, terminar: true });
  await page.goto("/arena");
  // La configuración vive en un <details> que se pliega al iniciar: se abre antes de cada comprobación.
  const abrir = () => page.evaluate(() => { for (const d of document.querySelectorAll<HTMLDetailsElement>("details.arena-setup, details.arena-setup details")) d.open = true; });
  const control = (etiqueta: string) => page.getByRole(etiqueta.startsWith("Match seed") ? "textbox" : "combobox", { name: etiqueta, exact: true });
  const duracion = control("Simulated duration");
  await abrir();
  await expect(duracion).toBeEnabled();
  await iniciar(page);
  // Durante la generación: deshabilitados.
  await expect(page.getByTestId("arena-buffer")).toBeVisible();
  await abrir();
  for (const etiqueta of ["Simulated duration", "Home formation", "Away formation", "Weather", "Surface", "Crowd pressure: home / away", "Match seed (optional)"]) await expect(control(etiqueta)).toBeDisabled();
  liberar();
  await expect(page.getByTestId("arena-live-status")).toContainText("Match complete");
  // La emisión sigue en pantalla (sin pulsar «Open available replay») y los ajustes del próximo partido se habilitan.
  await expect(page.getByTestId("arena-buffer")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open available replay", exact: true })).toBeVisible();
  await abrir();
  for (const etiqueta of ["Simulated duration", "Home formation", "Away formation", "Weather", "Surface", "Crowd pressure: home / away", "Match seed (optional)"]) await expect(control(etiqueta)).toBeEnabled();
  // Los botones que reemplazan el partido mostrado conservan su bloqueo.
  await expect(page.getByRole("button", { name: "Saved matches", exact: true })).toBeDisabled();
  // Cambiar la duración no altera la emisión actual: el reloj sigue con la duración del registro. La emisión
  // sigue avanzando mientras tanto, así que solo se compara el total («/ 1:00»), no el instante.
  const total = (await page.getByTestId("arena-clock").textContent())!.split("/")[1]!.trim();
  await duracion.selectOption("30");
  await expect(page.getByTestId("arena-clock")).toHaveText(new RegExp(`/ ${total.replace(":", "\\:")}$`));
  await iniciar(page);
  await expect.poll(() => cuerpos.length).toBe(2);
  expect(cuerpos[1]).toMatchObject({ segundos: 30 });
  expect(cuerpos[0]).toMatchObject({ segundos: 60 });
});
