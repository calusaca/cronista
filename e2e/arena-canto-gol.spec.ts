// Brief 050 v1.1 (P2) · Canto de gol en la arena: celebración por cursor en la repetición (rótulo,
// marcador y anillo del goleador, con sus estilos calculados), movimiento reducido a 360 px en oscuro,
// dos goles seguidos en emisión y gol final con cierre tardío. Rutas y Speech simulados como en
// e2e/arena-buffer.spec.ts; `construirRelato` real para que el fragmento del gol lleve `canto`.
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { construirRelato } from "../src/arena/relato";
import { wavMono } from "../src/arena/pista-audio";
import type { EventoArena, RegistroArena } from "../src/arena/tipos";
import { CANTO_GOL, PRIORIDAD_EVENTO_ARENA } from "../src/sim/limites";

const EVIDENCIA = "docs/evidencia/canto-gol-050";
const wav = async (segundos: number) => Buffer.from(await wavMono([new Float32Array(Math.round(segundos * 24000))], 24000).arrayBuffer()).toString("base64");
const leer = async (ruta: string) => JSON.parse(await readFile(ruta, "utf8")) as RegistroArena;

/** Carga el ejemplo público de entrenadores IA (dos goles: visita y local) en la repetición. */
async function cargarEjemplo(page: Page, ejemplo: RegistroArena) {
  await page.goto("/arena");
  await page.getByRole("button", { name: "Saved matches", exact: true }).click();
  const respuesta = page.waitForResponse(r => new URL(r.url()).pathname === "/api/arena" && r.request().method() === "POST");
  await page.getByRole("button", { name: "Load AI coaches example", exact: true }).click();
  expect((await respuesta).ok()).toBe(true);
  await expect(page.locator(".arena-score")).toContainText(ejemplo.config.partido.visita.nombre);
}
const cursor = async (page: Page, segundos: number) => { await page.getByRole("slider", { name: "Match time" }).fill(String(segundos)); };
/** Estilos calculados del anillo y del color --ar-select resuelto en el mismo árbol. */
const estiloAnillo = (page: Page) => page.locator("circle.arena-goal-ring").evaluate(el => {
  const prueba = document.createElement("span"); prueba.style.color = "var(--ar-select)"; el.closest(".arena-shell")!.appendChild(prueba);
  const select = getComputedStyle(prueba).color; prueba.remove();
  const s = getComputedStyle(el);
  return { fill: s.fill, stroke: s.stroke, select, animacion: s.animationName, ultimo: el.parentElement!.lastElementChild === el, primero: el.parentElement!.querySelector(":scope > circle") !== el };
});

test("celebración por cursor en la repetición: rótulo, marcador, anillo con sus estilos y retroceso", async ({ page }) => {
  const errores: string[] = []; page.on("pageerror", e => errores.push(e.message));
  const ejemplo = await leer("public/experimentos/arena-llm-v3.json");
  const [g1, g2] = ejemplo.eventos.filter(e => e.tipo === "gol") as [EventoArena, EventoArena];
  const nombre = (id: string) => ejemplo.inicial.jugadores.find(j => j.id === id)!.nombre;
  await cargarEjemplo(page, ejemplo);
  const rotulo = page.locator(".arena-pitch-wrap > p.arena-goal-banner"), tablero = page.locator(".arena-board");

  // Antes del gol: nada.
  await cursor(page, g1.tick / 10 - 0.5);
  await expect(rotulo).toHaveCount(0); await expect(page.locator("[data-gol]")).toHaveCount(0);
  // Dentro de la ventana del primer gol (visita).
  await cursor(page, g1.tick / 10 + 0.5);
  await expect(rotulo).toBeVisible();
  await expect(rotulo).toHaveAttribute("data-lado", g1.lado);
  await expect(rotulo).toContainText(ejemplo.config.partido[g1.lado].nombre); await expect(rotulo).toContainText(nombre(g1.jugador));
  expect(await rotulo.getAttribute("role")).toBeNull();
  await expect(tablero.getByRole("status", { name: /Gol|Goal/ })).toHaveCount(0);
  await expect(page.locator(`.arena-score[data-gol="${g1.lado}"]`)).toHaveCount(1);
  await expect(page.locator(".arena-score strong")).toHaveText(/^\d+–\d+$/);
  await expect(page.locator(".arena-score > span")).toHaveCount(2);
  await expect(page.locator('g.arena-player[data-gol="true"]')).toHaveAttribute("data-player", g1.jugador);
  // Anillo: último hijo, sin relleno y con --ar-select, sea cual sea el estado de la ficha.
  let a = await estiloAnillo(page);
  expect(a).toMatchObject({ fill: "none", stroke: a.select, ultimo: true, primero: true, animacion: "arena-gol-anillo" });
  const ficha = page.locator(`[data-testid="arena-player"][data-player="${g1.jugador}"]`);
  await ficha.dispatchEvent("click");
  await expect(ficha).toHaveClass(/arena-player-selected/);
  a = await estiloAnillo(page); expect(a).toMatchObject({ fill: "none", stroke: a.select });
  await ficha.focus();
  a = await estiloAnillo(page); expect(a).toMatchObject({ fill: "none", stroke: a.select });
  await page.getByTestId("arena-favorite-player").click();
  await expect(ficha).toHaveAttribute("data-favorite", "true");
  a = await estiloAnillo(page); expect(a).toMatchObject({ fill: "none", stroke: a.select });
  // Animaciones solo en rótulo, marcador y anillo; fichas, balón y árbitro siguen sin animación CSS.
  expect(await rotulo.evaluate(el => getComputedStyle(el).animationName)).toBe("arena-gol-rotulo");
  expect(await page.locator(".arena-score strong").evaluate(el => getComputedStyle(el).animationName)).toBe("arena-gol-marcador");
  for (const sel of [".arena-player", ".arena-ball", ".arena-referee"]) {
    // El transform calculado de un <g> SVG refleja su atributo (la posición); ninguna regla CSS añade otro.
    const s = await page.locator(sel).first().evaluate(el => {
      const c = getComputedStyle(el), m = /translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)/.exec(el.getAttribute("transform") ?? "");
      const atributo = m ? `matrix(1, 0, 0, 1, ${Number(m[1])}, ${Number(m[2])})` : "none";
      const css = c.transform === "none" ? "none" : c.transform.replace(/[-\d.e]+(?=[,)])/g, x => String(Math.round(Number(x) * 1e4) / 1e4));
      return { animacion: c.animationName, transicion: `${c.transitionProperty} ${c.transitionDuration}`, transform: css === atributo.replace(/[-\d.e]+(?=[,)])/g, x => String(Math.round(Number(x) * 1e4) / 1e4)) ? "atributo" : css };
    });
    expect(s, sel).toEqual({ animacion: "none", transicion: "all 0s", transform: "atributo" });
  }
  await page.locator(".arena-board").screenshot({ path: `${EVIDENCIA}/captura-claro-1440-seleccion-favorito.png` });
  // Al cumplirse celebracionS: nada. Retroceso dentro de la ventana: vuelve.
  await cursor(page, g1.tick / 10 + CANTO_GOL.celebracionS);
  await expect(rotulo).toHaveCount(0); await expect(page.locator("[data-gol]")).toHaveCount(0); await expect(page.locator(".arena-goal-ring")).toHaveCount(0);
  await cursor(page, g1.tick / 10 + 1);
  await expect(rotulo).toHaveAttribute("data-lado", g1.lado);
  // Segundo gol (local): anillo y marcador del otro lado.
  await cursor(page, g2.tick / 10 + 0.5);
  await expect(page.locator(`.arena-score[data-gol="${g2.lado}"]`)).toHaveCount(1);
  await expect(page.locator('g.arena-player[data-gol="true"]')).toHaveAttribute("data-player", g2.jugador);
  a = await estiloAnillo(page); expect(a).toMatchObject({ fill: "none", stroke: a.select, ultimo: true });
  expect(errores).toEqual([]);
});

test("M11 · con el cursor inmóvil más de celebracionS, la celebración permanece: depende del cursor, no del reloj", async ({ page }) => {
  test.setTimeout(60_000);
  const ejemplo = await leer("public/experimentos/arena-llm-v3.json");
  const g1 = ejemplo.eventos.find(e => e.tipo === "gol")!;
  await cargarEjemplo(page, ejemplo);
  await cursor(page, g1.tick / 10 + 0.5);
  const rotulo = page.locator(".arena-pitch-wrap > p.arena-goal-banner"), reloj = page.getByTestId("arena-clock");
  await expect(rotulo).toBeVisible();
  const instante = await reloj.textContent(), texto = await rotulo.textContent();
  // La repetición está detenida (empieza en pausa): el cursor no se mueve durante más de celebracionS.
  await page.waitForTimeout((CANTO_GOL.celebracionS + 1) * 1000);
  // Se fuerza un nuevo render sin mover el cursor (seleccionar otra ficha): la celebración se recalcula y sigue.
  const otra = page.locator(`[data-testid="arena-player"]:not([data-player="${g1.jugador}"])`).first();
  await otra.dispatchEvent("click");
  await expect(otra).toHaveClass(/arena-player-selected/);
  await expect(reloj).toHaveText(instante!);
  await expect(rotulo).toBeVisible(); await expect(rotulo).toHaveText(texto!);
  await expect(page.locator(`.arena-score[data-gol="${g1.lado}"]`)).toHaveCount(1);
  await expect(page.locator(`g.arena-player[data-gol="true"][data-player="${g1.jugador}"] circle.arena-goal-ring`)).toHaveCount(1);
});

test("movimiento reducido, 360 px y oscuro: celebración estática sin desborde", async ({ browser }) => {
  const ejemplo = await leer("public/experimentos/arena-llm-v3.json");
  const g1 = ejemplo.eventos.find(e => e.tipo === "gol")!;
  for (const [tema, ancho, reducido] of [["dark", 360, true], ["light", 360, false], ["dark", 1440, false]] as const) {
    const ctx = await browser.newContext({ viewport: { width: ancho, height: ancho === 360 ? 780 : 900 }, colorScheme: tema, reducedMotion: reducido ? "reduce" : "no-preference" });
    const page = await ctx.newPage();
    await cargarEjemplo(page, ejemplo);
    await cursor(page, g1.tick / 10 + 0.5);
    const rotulo = page.locator(".arena-pitch-wrap > p.arena-goal-banner");
    await expect(rotulo).toBeVisible();
    const nombres = [rotulo, page.locator(".arena-score strong"), page.locator("circle.arena-goal-ring")];
    for (const l of nombres) expect(await l.evaluate(el => getComputedStyle(el).animationName)).toEqual(reducido ? "none" : expect.stringMatching(/^arena-gol-/));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ancho);
    const caja = (await rotulo.boundingBox())!, cancha = (await page.locator(".arena-pitch-wrap").boundingBox())!;
    expect(caja.x).toBeGreaterThanOrEqual(cancha.x); expect(caja.x + caja.width).toBeLessThanOrEqual(cancha.x + cancha.width + 0.5);
    await page.locator(".arena-board").screenshot({ path: `${EVIDENCIA}/captura-${tema === "dark" ? "oscuro" : "claro"}-${ancho}${reducido ? "-reducido" : ""}.png` });
    await ctx.close();
  }
});

/** Emisión simulada: AudioContext que registra cada fuente (duración y si se detuvo). */
async function emision(page: Page, id: string, registro: RegistroArena, audio: (relato: ReturnType<typeof construirRelato> & { prioridad?: number; cierre?: boolean }) => Promise<string> | string, retener: (p: { desdeTick: number; hastaTick: number; cierre?: boolean; entradaTick?: number }) => Promise<void> | undefined = () => undefined, entregadas: string[] = [], ajustar: (p: { entradaTick?: number; cierre?: boolean }, json: Record<string, unknown>) => Record<string, unknown> = (_p, json) => json) {
  await page.route(`**/api/arena/sesiones/${id}/emision`, r => r.fulfill({ json: { registro, comentarios: [], asignacion: { modo: "programado", local: { nombre: "Local" }, visita: { nombre: "Visita" } }, metricas: {}, estado: "ejecutando", ultimoMensaje: 1 } }));
  await page.route(`**/api/arena/sesiones/${id}/eventos*`, r => r.fulfill({ headers: { "content-type": "text/event-stream" }, body: ": keepalive\n\n" }));
  await page.route("**/api/arena/herramientas", r => r.fulfill({ json: { voz: true, analista: false } }));
  await page.addInitScript(() => {
    const Base = window.AudioContext;
    const fuentes: { duracion: number; detenida: boolean; fin: boolean }[] = [];
    (window as unknown as { fuentesPrueba: typeof fuentes }).fuentesPrueba = fuentes;
    window.AudioContext = class extends Base {
      override createBufferSource() {
        const f = super.createBufferSource(), iniciar = f.start.bind(f), detener = f.stop.bind(f);
        const dato = { duracion: 0, detenida: false, fin: false };
        f.start = (cuando = 0) => { dato.duracion = Math.round(f.buffer!.duration * 10) / 10; fuentes.push(dato); iniciar(cuando); };
        f.stop = (cuando = 0) => { dato.detenida = true; detener(cuando); };
        f.addEventListener("ended", () => { dato.fin = true; });
        return f;
      }
    };
  });
  await page.route(`**/api/arena/sesiones/${id}/relato`, async r => {
    const p = r.request().postDataJSON();
    if (p.intervencion) return r.fulfill({ status: 404, json: { error: "Sin invitados en esta prueba" } });
    const relato = construirRelato(registro, p.desdeTick, p.hastaTick, "buffer", p.idioma, { cierre: p.cierre, entradaTick: p.entradaTick }) as ReturnType<typeof construirRelato> & { prioridad?: number; cierre?: boolean };
    // Respuesta retenida explícitamente por la prueba hasta que esta la libere.
    await retener(p);
    await r.fulfill({ json: ajustar(p, { ...relato, audio: relato.texto ? { base64: await audio(relato), tipo: "audio/wav" } : null }) });
    entregadas.push(p.cierre ? "cierre" : p.entradaTick !== undefined ? `entrada:${p.entradaTick}` : `${p.desdeTick}-${p.hastaTick}`);
  });
}
const fuentes = (page: Page) => page.evaluate(() => (window as unknown as { fuentesPrueba: { duracion: number; detenida: boolean; fin: boolean }[] }).fuentesPrueba);

test("dos goles seguidos (ticks 231 y 290): el segundo corta el primer canto y arranca", async ({ page }) => {
  const duelo = await leer("public/experimentos/arena-duelo-v3.json");
  const corte = 300, primero = duelo.eventos.find(e => e.tipo === "gol" && e.tick === 231)!;
  const segundo: EventoArena = { ...structuredClone(primero), id: "gol-sintetico-290", tick: 290, lado: "visita", jugador: duelo.inicial.jugadores.find(j => j.lado === "visita" && j.puesto !== "POR")!.id };
  const eventos = [...duelo.eventos.filter(e => e.tick <= segundo.tick), segundo, ...duelo.eventos.filter(e => e.tick > segundo.tick)];
  const registro: RegistroArena = { ...duelo, eventos: eventos.filter(e => e.tick <= corte), fotogramas: duelo.fotogramas.filter(f => f.tick <= corte), rondas: duelo.rondas.filter(r => r.inicioTick < corte), final: duelo.fotogramas.find(f => f.tick === corte)! };
  const canto = await wav(9), corto = await wav(0.3);
  await emision(page, "00000000-0000-4000-8000-000000000050", registro, relato => relato.prioridad === PRIORIDAD_EVENTO_ARENA.gol ? canto : corto);
  await page.goto("/arena?partido=00000000-0000-4000-8000-000000000050&vista=buffer");
  await page.getByRole("button", { name: "Enable narration" }).click();
  const transcripcion = page.getByTestId("arena-voice-transcript");
  await expect(transcripcion).toHaveAttribute("data-narration-tick", "231", { timeout: 30000 });
  await expect(transcripcion).toHaveAttribute("data-narration-tick", "290", { timeout: 12000 });
  await expect(page.locator(".arena-score strong")).toHaveText("1–1");
  await expect(page.locator('.arena-score[data-gol="visita"]')).toHaveCount(1);
  const cantos = (await fuentes(page)).filter(f => f.duracion === 9);
  expect(cantos).toHaveLength(2);
  expect(cantos[0]!.detenida).toBe(true); expect(cantos[1]!.detenida).toBe(false);
});

/** Promesa que la prueba resuelve cuando quiere liberar una respuesta retenida. */
const retenida = () => { let liberar!: () => void; const promesa = new Promise<void>(ok => { liberar = ok; }); return { promesa, liberar }; };

test("gol en la última ventana con cierre tardío y una respuesta normal retenida: canto, cierre y nada más", async ({ page }) => {
  test.setTimeout(90_000);
  const duelo = await leer("public/experimentos/arena-duelo-v3.json");
  const corte = 150, base = duelo.eventos.find(e => e.tipo === "gol")!;
  const gol: EventoArena = { ...structuredClone(base), id: "gol-final-145", tick: corte - 5 };
  const registro: RegistroArena = { ...duelo, config: { ...duelo.config, duracionS: corte / 10 }, eventos: [...duelo.eventos.filter(e => e.tick <= gol.tick), gol, ...duelo.eventos.filter(e => e.tick > gol.tick && e.tick <= corte)], fotogramas: duelo.fotogramas.filter(f => f.tick <= corte), rondas: duelo.rondas.filter(r => r.inicioTick < corte), final: duelo.fotogramas.find(f => f.tick === corte)! };
  const canto = await wav(9), cierre = await wav(2), corto = await wav(0.3);
  // La entrada de la narración (respuesta normal, no de cierre) queda retenida hasta que arranca el cierre;
  // el cierre responde tarde (1,5 s).
  const entrada = retenida(), entregadas: string[] = [];
  await emision(page, "00000000-0000-4000-8000-000000000051", registro, relato => relato.cierre ? cierre : relato.prioridad === PRIORIDAD_EVENTO_ARENA.gol ? canto : corto,
    p => p.cierre ? new Promise(ok => setTimeout(ok, 1500)) : p.entradaTick !== undefined ? entrada.promesa : undefined, entregadas,
    // La respuesta retenida llega sin firma de estado: sigue siendo válida al liberarse (el estado del balón ya
    // cambió), así que lo único que impide que suene tras el cierre es el corte del consumidor.
    (p, json) => p.entradaTick !== undefined ? { ...json, firmaEstado: undefined } : json);
  await page.goto("/arena?partido=00000000-0000-4000-8000-000000000051&vista=buffer");
  // Se activa a los 13 s: la entrada retenida espera menos que el plazo de 15 s del consumidor y, al
  // liberarse con el cursor ya en el final, sigue dentro del atraso: solo el corte tras el cierre la frena.
  await expect(page.getByTestId("arena-clock")).toHaveText(`0:13 / 0:${corte / 10}`, { timeout: 20000 });
  await page.getByRole("button", { name: "Enable narration" }).click();
  const transcripcion = page.getByTestId("arena-voice-transcript");
  await expect(transcripcion).toHaveAttribute("data-narration-tick", String(gol.tick), { timeout: 20000 });
  await expect(transcripcion).toContainText(CANTO_GOL.plantillas.grito.en);
  await expect(transcripcion).toHaveAttribute("data-narration-kind", "cierre", { timeout: 20000 });
  await expect(transcripcion).toContainText("Full time");
  expect(entregadas.some(e => e.startsWith("entrada:"))).toBe(false);
  const antes = (await fuentes(page)).length;
  // Arrancó el cierre: se libera la respuesta normal retenida y llega al consumidor.
  entrada.liberar();
  await expect.poll(() => entregadas.some(e => e.startsWith("entrada:"))).toBe(true);
  await page.waitForTimeout(4000);
  const todas = await fuentes(page), k = todas.findIndex(f => f.duracion === 9);
  expect(k).toBeGreaterThanOrEqual(0);
  expect(todas[k]!.detenida).toBe(false); expect(todas[k]!.fin).toBe(true);
  // Orden de fuentes desde el canto: canto → cierre, y ninguna después del cierre (tampoco la liberada).
  expect(todas.slice(k).map(f => f.duracion)).toEqual([9, 2]);
  expect(todas).toHaveLength(antes);
  await expect(transcripcion).toHaveAttribute("data-narration-kind", "cierre");
});

/** Duelo con el gol original movido al tick 245 (9 s de canto) y un gol sintético de la visita en el 251 (8 s):
 * tramos de cinco segundos distintos y los dos vigentes con el cursor en 26 s. */
async function dosGolesVigentes() {
  const duelo = await leer("public/experimentos/arena-duelo-v3.json"), corte = 300;
  const original = duelo.eventos.find(e => e.tipo === "gol")!;
  const viejo: EventoArena = { ...structuredClone(original), tick: 245 };
  const nuevo: EventoArena = { ...structuredClone(original), id: "gol-sintetico-251", tick: 251, lado: "visita", jugador: duelo.inicial.jugadores.find(j => j.lado === "visita" && j.puesto !== "POR")!.id };
  const eventos = [...duelo.eventos.filter(e => e.id !== original.id), viejo, nuevo].sort((a, b) => a.tick - b.tick);
  const registro: RegistroArena = { ...duelo, eventos: eventos.filter(e => e.tick <= corte), fotogramas: duelo.fotogramas.filter(f => f.tick <= corte), rondas: duelo.rondas.filter(r => r.inicioTick < corte), final: duelo.fotogramas.find(f => f.tick === corte)! };
  return { registro, viejo, nuevo, cantoViejo: await wav(9), cantoNuevo: await wav(8), corto: await wav(0.3) };
}

test("v1.1 (1a) · dos cantos vigentes disponibles a la vez: el consumidor arranca el reciente y descarta el anterior sin arrancarlo", async ({ page }) => {
  test.setTimeout(90_000);
  const { registro, viejo, nuevo, cantoViejo, cantoNuevo, corto } = await dosGolesVigentes();
  const tramos = retenida(), entregadas: string[] = [];
  await emision(page, "00000000-0000-4000-8000-000000000052", registro, relato => relato.fuentes.includes(viejo.id) ? cantoViejo : relato.fuentes.includes(nuevo.id) ? cantoNuevo : corto,
    p => p.entradaTick === undefined && !p.cierre && (p.desdeTick === 200 || p.desdeTick === 250) ? tramos.promesa : undefined, entregadas);
  await page.goto("/arena?partido=00000000-0000-4000-8000-000000000052&vista=buffer");
  await expect(page.getByTestId("arena-clock")).toHaveText("0:15 / 1:00", { timeout: 20000 });
  await page.getByRole("button", { name: "Enable narration" }).click();
  // Con el cursor más allá de los dos goles (y el viejo aún dentro del atraso), se pausa y se liberan ambos.
  await expect(page.getByTestId("arena-clock")).toHaveText("0:26 / 1:00", { timeout: 20000 });
  await page.getByRole("button", { name: "Pause broadcast" }).click();
  tramos.liberar();
  await expect.poll(() => ["200-250", "250-300"].every(t => entregadas.includes(t))).toBe(true);
  await page.waitForTimeout(1500); // decodificación de los dos clips durante la pausa
  await page.getByRole("button", { name: "Resume broadcast" }).click();
  const transcripcion = page.getByTestId("arena-voice-transcript");
  await expect(transcripcion).toHaveAttribute("data-narration-tick", String(nuevo.tick), { timeout: 10000 });
  await page.waitForTimeout(1500);
  const todas = await fuentes(page);
  expect(todas.filter(f => f.duracion === 8)).toEqual([expect.objectContaining({ detenida: false })]);
  expect(todas.some(f => f.duracion === 9)).toBe(false);
  await expect(transcripcion).toHaveAttribute("data-narration-tick", String(nuevo.tick));
});

test("v1.1 (1b) · respuestas fuera de orden: el clip del gol anterior llega tras arrancar el reciente y se descarta", async ({ page }) => {
  test.setTimeout(90_000);
  const { registro, viejo, nuevo, cantoViejo, cantoNuevo, corto } = await dosGolesVigentes();
  const tramoViejo = retenida(), tramoNuevo = retenida(), entregadas: string[] = [];
  await emision(page, "00000000-0000-4000-8000-000000000053", registro, relato => relato.fuentes.includes(viejo.id) ? cantoViejo : relato.fuentes.includes(nuevo.id) ? cantoNuevo : corto,
    p => p.entradaTick !== undefined || p.cierre ? undefined : p.desdeTick === 200 ? tramoViejo.promesa : p.desdeTick === 250 ? tramoNuevo.promesa : undefined, entregadas);
  await page.goto("/arena?partido=00000000-0000-4000-8000-000000000053&vista=buffer");
  await expect(page.getByTestId("arena-clock")).toHaveText("0:15 / 1:00", { timeout: 20000 });
  await page.getByRole("button", { name: "Enable narration" }).click();
  await expect(page.getByTestId("arena-clock")).toHaveText("0:26 / 1:00", { timeout: 20000 });
  tramoNuevo.liberar();
  const transcripcion = page.getByTestId("arena-voice-transcript");
  await expect(transcripcion).toHaveAttribute("data-narration-tick", String(nuevo.tick), { timeout: 10000 });
  // Con el canto reciente sonando, llega (tarde) el del gol anterior, todavía dentro del atraso.
  await page.getByRole("button", { name: "Pause broadcast" }).click();
  tramoViejo.liberar();
  await expect.poll(() => entregadas.includes("200-250")).toBe(true);
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Resume broadcast" }).click();
  await page.waitForTimeout(1500);
  const todas = await fuentes(page);
  expect(todas.filter(f => f.duracion === 8)).toEqual([expect.objectContaining({ detenida: false })]);
  expect(todas.some(f => f.duracion === 9)).toBe(false);
  await expect(transcripcion).toHaveAttribute("data-narration-tick", String(nuevo.tick));
});
