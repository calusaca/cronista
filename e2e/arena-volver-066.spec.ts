// Brief 066 · Volver al partido después de salir de la pantalla (390 × 844 y 1440 × 900).
// Sesión simulada por rutas (POST, /emision, SSE y /relato; sin inferencia ni Azure). La pestaña oculta se emula de
// verdad: `document.hidden`/`visibilityState` controlados por la prueba, `visibilitychange` emitido y los callbacks de
// requestAnimationFrame RETENIDOS mientras está oculta (se entregan al volver), como hace un navegador real. El
// AudioContext está instrumentado: `enGesto` vale true entre un escuchador `click`/`keydown` de window en captura y otro
// en burbuja (el manejador de React corre entre ambos); con `__colgar`, resume() no se resuelve nunca y el estado es
// `suspended`. Textos y claves salen de los módulos (textos-retomar, retomar-directo); cifras de limites.
//   D  · oculta, «terminada» llega oculta, vuelve, «Resume broadcast» y el reloj llega al final (2:00);
//   B  · tras esa pausa, «Continue match · m:ss» sobre la cancha, sin tapar el marcador; desaparece al continuar;
//   C  · resume() dentro del gesto; si no resuelve, «Enable audio playback» a los desbloqueoMs;
//   A  · recarga con la sesión completa: en pausa en el segundo guardado, con el aviso y la narración al continuar;
//        Torneo y «atrás» con la sesión en curso: en el segundo guardado, sin saltar al vivo (Espacio continúa);
//        sesión caducada: aviso «This match is no longer available» y la clave se limpia;
//   una pausa del espectador no muestra el aviso.
import { expect, test, type Page, type Route } from "@playwright/test";
import { wavMono } from "../src/arena/pista-audio";
import type { RegistroArena } from "../src/arena/tipos";
import { ARENA_WEB, NARRACION_DIRECTO } from "../src/sim/limites";
import { CLAVES_DIRECTO } from "../src/ui/retomar-directo";
import { TEXTOS_RETOMAR } from "../src/ui/textos-retomar";

const SR = 24000;
const wav = async (s: number) => Buffer.from(await wavMono([Float32Array.from({ length: Math.round(s * SR) }, (_, i) => 0.05 * Math.sin(i / 9))], SR).arrayBuffer()).toString("base64");
const asignacion = { modo: "programado", local: { id: "programado", nombre: "Programmed", controlador: "programado" }, visita: { id: "programado", nombre: "Programmed", controlador: "programado" } };
const prefijo = (r: RegistroArena, t: number): RegistroArena => ({ ...r, eventos: r.eventos.filter(e => e.tick <= t), fotogramas: r.fotogramas.filter(f => f.tick <= t), rondas: r.rondas.filter(x => x.inicioTick < t), final: [...r.fotogramas].reverse().find(f => f.tick <= t)! });
const TX = TEXTOS_RETOMAR.en;
type Llamada = { tipo: "ctor" | "resume"; enGesto: boolean; t: number };
type Ventana = { __ocultar: (oculta: boolean) => void; __llamadas: Llamada[]; __colgar: boolean };

/** Pestaña oculta fiel + AudioContext instrumentado (ver cabecera). */
async function instrumentar(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Ventana & typeof window;
    let oculta = false, siguiente = 1, enGesto = false;
    const rafReal = window.requestAnimationFrame.bind(window), cancelarReal = window.cancelAnimationFrame.bind(window);
    /** id propio → { cb, real } (real = null mientras está retenido). */
    const pendientes = new Map<number, { cb: FrameRequestCallback; real: number | null }>();
    const programar = (id: number) => { const p = pendientes.get(id)!; p.real = rafReal(t => { pendientes.delete(id); p.cb(t); }); };
    Object.defineProperty(Document.prototype, "hidden", { configurable: true, get: () => oculta });
    Object.defineProperty(Document.prototype, "visibilityState", { configurable: true, get: () => oculta ? "hidden" : "visible" });
    window.requestAnimationFrame = cb => { const id = siguiente++; pendientes.set(id, { cb, real: null }); if (!oculta) programar(id); return id; };
    window.cancelAnimationFrame = id => { const p = pendientes.get(id); if (p?.real != null) cancelarReal(p.real); pendientes.delete(id); };
    w.__ocultar = valor => {
      if (valor === oculta) return;
      oculta = valor;
      if (oculta) for (const p of pendientes.values()) { if (p.real !== null) { cancelarReal(p.real); p.real = null; } }
      document.dispatchEvent(new Event("visibilitychange"));
      if (!oculta) for (const id of [...pendientes.keys()]) programar(id);
    };
    w.__llamadas = []; w.__colgar = false;
    for (const tipo of ["click", "keydown"]) { window.addEventListener(tipo, () => { enGesto = true; }, true); window.addEventListener(tipo, () => { enGesto = false; }); }
    const Base = window.AudioContext;
    window.AudioContext = class extends Base {
      constructor(o?: AudioContextOptions) { const dentro = enGesto; super(o); w.__llamadas.push({ tipo: "ctor", enGesto: dentro, t: performance.now() }); }
      override get state(): AudioContextState { const real = super.state; return w.__colgar && real !== "closed" ? "suspended" : real; }
      override resume() { w.__llamadas.push({ tipo: "resume", enGesto, t: performance.now() }); return w.__colgar ? new Promise<void>(() => {}) : super.resume(); }
    };
  });
}
const ocultar = (page: Page, valor: boolean) => page.evaluate(v => (window as unknown as Ventana).__ocultar(v), valor);
const llamadas = (page: Page) => page.evaluate(() => (window as unknown as Ventana).__llamadas);
const almacen = (page: Page) => page.evaluate(c => ({ sesion: sessionStorage.getItem(c.sesion), segundo: JSON.parse(sessionStorage.getItem(c.segundo) ?? "null") as { sesion: string; segundo: number; narracion: boolean } | null }), CLAVES_DIRECTO);

/** Sesión simulada. /emision: el prefijo de `cortes[n]` (n = llamada; la última se repite) en «ejecutando» hasta que la
 * prueba llama a `soltar`; después, el registro completo en «completa». Cada conexión SSE espera a `soltar` y entrega
 * desde `desde` el resto, `fin` y `terminada`. /relato: entrada, tramos y cierre con 0,5 s de audio; invitados, 404. */
async function sesionSimulada(page: Page, id: string, registro: RegistroArena, cortes: number[]) {
  let soltar!: () => void, terminado = false, llamadasEmision = 0;
  const terminar = new Promise<void>(r => { soltar = () => { terminado = true; r(); }; });
  const audio = await wav(0.5), fin = registro.final.tick, corteSse = cortes.at(-1)!;
  await page.route("**/api/arena/herramientas", r => r.fulfill({ json: { voz: true, analista: false } }));
  await page.route("**/api/arena/modelos", r => r.fulfill({ json: { modelos: [] } }));
  await page.route("**/api/arena/sesiones", async r => {
    if (r.request().method() !== "POST") return r.fallback();
    await r.fulfill({ json: { id, asignacion } });
  });
  const publicaciones = [
    ...registro.rondas.filter(x => x.inicioTick >= corteSse).map(ronda => ({ tipo: "ordenes", ronda })),
    { tipo: "avance", estado: registro.final, fotogramas: registro.fotogramas.filter(f => f.tick > corteSse), eventos: registro.eventos.filter(e => e.tick > corteSse) },
    { tipo: "fin" }, { tipo: "terminada", estado: "completa", metricas: { decisiones: 8, respaldos: 0, duracionMs: 1000, esperaModeloMs: [] } },
  ].map((publicacion, i) => ({ id: i + 2, publicacion }));
  await page.route(`**/api/arena/sesiones/${id}/emision`, r => {
    const corte = cortes[Math.min(llamadasEmision++, cortes.length - 1)]!;
    return r.fulfill({ json: terminado
      ? { registro, comentarios: [], intervenciones: [], asignacion, metricas: { decisiones: 8, respaldos: 0, duracionMs: 1000, esperaModeloMs: [] }, estado: "completa", ultimoMensaje: 1 + publicaciones.length }
      : { registro: prefijo(registro, corte), comentarios: [], intervenciones: [], asignacion, metricas: {}, estado: "ejecutando", ultimoMensaje: 1 } });
  });
  await page.route(`**/api/arena/sesiones/${id}/eventos*`, async r => {
    const desde = Number(new URL(r.request().url()).searchParams.get("desde") ?? 0);
    await terminar;
    await r.fulfill({ headers: { "content-type": "text/event-stream" }, body: publicaciones.filter(m => m.id > desde).map(m => `id: ${m.id}\nevent: arena\ndata: ${JSON.stringify(m)}\n\n`).join("") }).catch(() => {});
  });
  await page.route(`**/api/arena/sesiones/${id}/relato`, async (r: Route) => {
    const p = r.request().postDataJSON() as { desdeTick: number; hastaTick: number; idioma: string; intervencion?: string; entradaTick?: number; cierre?: boolean };
    if (p.intervencion) return r.fulfill({ status: 404, json: {} }).catch(() => {});
    const tick = p.entradaTick ?? (p.cierre ? Math.min(p.hastaTick, fin) : p.desdeTick);
    const tipoRelato = p.entradaTick !== undefined ? "entrada" : p.cierre ? "cierre" : "jugada";
    return r.fulfill({ json: { desdeTick: p.desdeTick, hastaTick: p.hastaTick, modo: "buffer", idioma: p.idioma, ...(p.entradaTick !== undefined ? { entradaTick: p.entradaTick } : {}), texto: `Tramo ${tick}`, fragmentos: [{ tick, texto: `Tramo ${tick}`, emocion: "serena", intensidad: .2, variante: 0, fuentes: [], fotogramas: [] }], fuentes: [], fotogramas: [], eventosDisponibles: 0, eventosNarrados: 1, conduccionesNarradas: 0, prioridad: 10, cierre: !!p.cierre, tipoRelato, claveVoz: `prueba:${tipoRelato}:${tick}`, audio: { base64: audio, tipo: "audio/wav" } } }).catch(() => {});
  });
  return { soltar };
}

/** Partido programado de ARENA_WEB.duracionDefectoS (2:00), simulado una vez por el propio servidor. */
let registro: RegistroArena;
test.beforeEach(async ({ request }) => {
  if (registro) return;
  const respuesta = await request.post("/api/arena", { data: { accion: "simular", seed: 47, segundos: ARENA_WEB.duracionDefectoS, local: "auto", visita: "auto" } });
  expect(respuesta.ok()).toBe(true);
  registro = await respuesta.json() as RegistroArena;
});

const relojS = async (page: Page) => Number(await page.getByTestId("arena-clock").getAttribute("data-cursor-s"));
const iniciar = (page: Page) => page.getByTestId("arena-live").getByRole("button", { name: "Start live match", exact: true }).click();
const aviso = (page: Page) => page.getByTestId("arena-continue");
const botonAviso = (page: Page) => aviso(page).getByRole("button", { name: new RegExp(`^${TX.continuar} · \\d+:\\d\\d$`) });
const reanudarEmision = (page: Page) => page.getByRole("button", { name: "Resume broadcast", exact: true });
/** Arranca el directo narrado y espera a que el reloj avance `segundos` desde su inicio. */
async function arrancar(page: Page, segundos = 3) {
  await page.goto("/arena");
  await iniciar(page);
  await expect(page.getByRole("button", { name: "Pause broadcast", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Turn narration off", exact: true })).toBeVisible();
  const inicio = await relojS(page);
  await expect.poll(() => relojS(page), { timeout: 20_000 }).toBeGreaterThan(inicio + segundos);
}
/** El aviso va dentro de la cancha, a la vista y sin tapar el marcador; su rótulo lleva el minuto del reloj. */
async function comprobarAviso(page: Page) {
  await expect(botonAviso(page)).toBeVisible();
  await expect(botonAviso(page)).toBeInViewport();
  await expect(botonAviso(page)).toHaveAttribute("aria-keyshortcuts", "Space");
  const [cancha, caja, marcador] = await Promise.all([page.locator(".arena-pitch-wrap").boundingBox(), aviso(page).boundingBox(), page.locator(".arena-score").boundingBox()]);
  expect(caja!.y).toBeGreaterThanOrEqual(cancha!.y - .5); expect(caja!.y + caja!.height).toBeLessThanOrEqual(cancha!.y + cancha!.height + .5);
  expect(caja!.y).toBeGreaterThanOrEqual(marcador!.y + marcador!.height - .5);
  await expect(botonAviso(page)).toHaveText(TX.boton(await relojS(page)));
}

for (const ventana of [{ width: 1440, height: 900 }, { width: 390, height: 844 }] as const) {
  test.describe(`${ventana.width} × ${ventana.height}`, () => {
    test.use({ viewport: ventana });
    const id = (n: number) => `00000000-0000-4000-8000-0000000${ventana.width === 390 ? "0390" : "1440"}${n}`;

    test("D · oculta, «terminada» llega oculta, vuelve con «Continue match» y «Resume broadcast» llega al final (C: resume() en el gesto)", async ({ page }) => {
      test.setTimeout(120_000);
      const errores: string[] = []; page.on("pageerror", e => errores.push(e.message));
      await instrumentar(page);
      const fin = registro.final.tick, { soltar } = await sesionSimulada(page, id(1), registro, [fin - 100]);
      await arrancar(page);
      await ocultar(page, true);
      const alOcultar = await relojS(page);
      soltar();
      await expect(page.getByTestId("arena-live-status")).toHaveText("Match complete · recording available");
      await page.waitForTimeout(2000);
      expect(await relojS(page)).toBeCloseTo(alOcultar, 0);
      expect((await almacen(page)).sesion, "«terminada» no borra la sesión mientras la emisión no acabe").toBe(id(1));
      await ocultar(page, false);
      await comprobarAviso(page);
      const antes = (await llamadas(page)).length;
      await reanudarEmision(page).click();
      await expect(aviso(page)).toHaveCount(0);
      expect((await llamadas(page)).slice(antes).filter(l => l.tipo === "resume")[0], "resume() dentro del gesto").toMatchObject({ enGesto: true });
      await expect.poll(() => relojS(page), { timeout: 60_000 }).toBeGreaterThanOrEqual(fin / 10 - .05);
      await expect(page.getByTestId("arena-buffer-status")).toHaveText("End of broadcast");
      await expect.poll(async () => (await almacen(page)).sesion, { message: "al final de la emisión se olvida la sesión" }).toBeNull();
      expect(errores).toEqual([]);
    });

    test("A · recarga con la sesión completa: en pausa en el segundo guardado, «Continue match» y la narración vuelve en el gesto", async ({ page }) => {
      test.setTimeout(90_000);
      await instrumentar(page);
      const fin = registro.final.tick, { soltar } = await sesionSimulada(page, id(2), registro, [fin - 100]);
      await arrancar(page);
      soltar();
      await expect(page.getByTestId("arena-live-status")).toHaveText("Match complete · recording available");
      await expect.poll(async () => (await almacen(page)).segundo?.segundo ?? 0).toBeGreaterThan(0);
      await page.reload();
      await expect(botonAviso(page)).toBeVisible();
      const guardado = (await almacen(page)).segundo!;
      expect(guardado).toMatchObject({ sesion: id(2), narracion: true });
      const alVolver = await relojS(page);
      expect(Math.abs(alVolver - guardado.segundo)).toBeLessThanOrEqual(.11);
      await expect(page.getByTestId("arena-buffer-status")).toHaveText("Broadcast paused · generation continues");
      await comprobarAviso(page);
      await page.waitForTimeout(1500);
      expect(await relojS(page)).toBe(alVolver);
      const antes = (await llamadas(page)).length;
      await botonAviso(page).click();
      await expect(aviso(page)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Turn narration off", exact: true })).toBeVisible();
      const nuevas = (await llamadas(page)).slice(antes);
      expect(nuevas.find(l => l.tipo === "ctor"), JSON.stringify(nuevas)).toMatchObject({ enGesto: true });
      expect(nuevas.find(l => l.tipo === "resume"), JSON.stringify(nuevas)).toMatchObject({ enGesto: true });
      await expect.poll(() => relojS(page), { timeout: 10_000 }).toBeGreaterThan(alVolver + 1.5);
    });

    test("A · Torneo y «atrás» con la sesión en curso: retoma en el segundo guardado, sin saltar al vivo; Espacio continúa", async ({ page }) => {
      test.setTimeout(90_000);
      await instrumentar(page);
      const fin = registro.final.tick;
      // La segunda instantánea (al volver) ya va 70 s por delante: saltar al vivo se notaría.
      await sesionSimulada(page, id(3), registro, [400, fin - 100]);
      await arrancar(page, 4);
      await page.getByTestId("torneo-link").click();
      await expect(page).toHaveURL(/\/arena\/torneo/);
      const guardado = (await almacen(page)).segundo!;
      expect(guardado.sesion).toBe(id(3));
      await page.goBack();
      await expect(page).toHaveURL(/\/arena(\?|$)/);
      await expect(botonAviso(page)).toBeVisible();
      const alVolver = await relojS(page);
      expect(Math.abs(alVolver - guardado.segundo)).toBeLessThanOrEqual(.11);
      await comprobarAviso(page);
      await page.keyboard.press("Space");
      await expect(aviso(page)).toHaveCount(0);
      await expect.poll(() => relojS(page), { timeout: 10_000 }).toBeGreaterThan(alVolver + 1);
      expect(await relojS(page)).toBeLessThan(alVolver + 10);
    });

    test("B · una pausa pedida por el espectador no muestra el aviso, ni al ocultar y volver", async ({ page }) => {
      await instrumentar(page);
      await sesionSimulada(page, id(4), registro, [registro.final.tick - 100]);
      await arrancar(page, 2);
      await page.getByRole("button", { name: "Pause broadcast", exact: true }).click();
      await expect(reanudarEmision(page)).toBeVisible();
      await expect(aviso(page)).toHaveCount(0);
      await ocultar(page, true);
      await page.waitForTimeout(500);
      await ocultar(page, false);
      await page.waitForTimeout(500);
      await expect(reanudarEmision(page)).toBeVisible();
      await expect(aviso(page)).toHaveCount(0);
      const t0 = await relojS(page);
      await reanudarEmision(page).click();
      await expect.poll(() => relojS(page), { timeout: 10_000 }).toBeGreaterThan(t0 + 1);
    });

    test(`C · si resume() no resuelve, «Enable audio playback» aparece a los ${NARRACION_DIRECTO.desbloqueoMs} ms y el reloj sigue`, async ({ page }) => {
      await instrumentar(page);
      await sesionSimulada(page, id(5), registro, [registro.final.tick - 100]);
      await arrancar(page, 2);
      await ocultar(page, true);
      await page.evaluate(() => { (window as unknown as Ventana).__colgar = true; });
      await ocultar(page, false);
      const antes = (await llamadas(page)).length, t0 = await relojS(page);
      await botonAviso(page).click();
      const pulsar = page.getByRole("button", { name: "Enable audio playback", exact: true });
      await expect(pulsar).toBeVisible({ timeout: NARRACION_DIRECTO.desbloqueoMs + 2000 });
      expect((await llamadas(page)).slice(antes).find(l => l.tipo === "resume"), "resume() dentro del gesto").toMatchObject({ enGesto: true });
      await expect.poll(() => relojS(page), { timeout: 10_000 }).toBeGreaterThan(t0 + 1);
      await page.evaluate(() => { (window as unknown as Ventana).__colgar = false; });
      await pulsar.click();
      await expect(pulsar).toHaveCount(0);
    });

    test("A · sesión guardada caducada (404): aviso breve y la clave se limpia", async ({ page }) => {
      const muerta = id(6);
      await page.route(`**/api/arena/sesiones/${muerta}/emision`, r => r.fulfill({ status: 404, json: { error: "Sesión inexistente o caducada" } }));
      // La sesión guardada se escribe antes de cargar (escribirla tras `goto` compite con la hidratación).
      await page.addInitScript(({ c, muerta }) => { sessionStorage.setItem(c.sesion, muerta); sessionStorage.setItem(c.presentacion, "buffer"); sessionStorage.setItem(c.segundo, JSON.stringify({ sesion: muerta, segundo: 30, narracion: true })); }, { c: CLAVES_DIRECTO, muerta });
      await page.goto("/arena");
      await expect(page.getByTestId("arena-live-gone")).toHaveText(TX.noDisponible);
      await expect(page.getByTestId("arena-live-gone")).toBeInViewport();
      expect(await almacen(page)).toEqual({ sesion: null, segundo: null });
      await expect(page.getByRole("button", { name: "Pause broadcast", exact: true })).toHaveCount(0);
      await expect(page.getByTestId("arena-live").getByRole("button", { name: "Start live match", exact: true })).toBeEnabled();
    });
  });
}
