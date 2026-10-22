// Brief 056 (v1.1–v1.2) · Previa del partido. Escenarios (1), (3) y (4) de la voz (más abajo) y (2): la tarjeta de alineaciones se ve en el tick 0,
// se oculta al rodar el balón y vuelve con «Restart»; plegado, teclado, foco y suplentes; 360 px en
// oscuro, movimiento reducido y español. Los datos esperados se leen del JSON público en el propio test.
import { readFile } from "node:fs/promises";
import { expect, test, type Page, type Route } from "@playwright/test";
import { BUFFER_ARENA, VOZ_BUFFER } from "../src/arena/buffer";
import { datosEstadista, intervencionEstadista } from "../src/arena/estadista";
import { wavMono } from "../src/arena/pista-audio";
import { previaPartido } from "../src/arena/previa";
import { RELATO_INTERVALOS, type IntervencionArena } from "../src/arena/protocolo";
import { construirRelato, relatoIntervencion } from "../src/arena/relato";
import type { RegistroArena } from "../src/arena/tipos";
import { ARENA, PREVIA_ARENA } from "../src/sim/limites";

test.describe.configure({ mode: "serial" });

const leer = async (ruta: string) => JSON.parse(await readFile(ruta, "utf8")) as RegistroArena;

async function cargarEjemplo(page: Page, es = false) {
  await page.getByRole("button", { name: es ? "Partidos guardados" : "Saved matches", exact: true }).click();
  const respuesta = page.waitForResponse(r => new URL(r.url()).pathname === "/api/arena" && r.request().method() === "POST");
  await page.getByRole("button", { name: es ? "Cargar ejemplo de entrenadores IA" : "Load AI coaches example", exact: true }).click();
  expect((await respuesta).ok()).toBe(true);
  await expect(page.locator(".arena-board > .arena-empty")).toHaveCount(0);
}
/** Pulsa Tab hasta que el foco cumpla `cumple` (máximo 40 pulsaciones). */
async function tabHasta(page: Page, cumple: string) {
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(s => document.activeElement?.matches(s) ?? false, cumple)) return;
  }
  throw new Error(`El foco no llegó a ${cumple}`);
}

test("056 · (2) la tarjeta se ve antes del saque, se oculta al reproducir y vuelve con Restart; teclado y foco", async ({ page }) => {
  const ejemplo = await leer("public/experimentos/arena-llm-v3.json");
  await page.goto("/arena");
  await cargarEjemplo(page);
  const tarjeta = page.getByTestId("arena-lineups");
  await expect(page.getByTestId("arena-clock")).toContainText("0:00 /");
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta.locator('[data-testid="arena-lineup"][data-side]')).toHaveCount(2);
  await expect(page.getByTestId("arena-lineup-player")).toHaveCount(22);
  await expect(tarjeta).toContainText(ejemplo.config.partido.local.nombre);
  await expect(tarjeta).toContainText(ejemplo.config.partido.visita.nombre);
  // La tarjeta va bajo la cancha, después de .arena-direction.
  expect(await page.locator(".arena-direction + .arena-lineups").count()).toBe(1);

  // Teclado: Tab desde la dirección de juego llega al botón de plegar; Enter pliega y despliega.
  await page.locator(".arena-direction").click();
  await tabHasta(page, '[data-testid="arena-lineups-toggle"]');
  const toggle = page.getByTestId("arena-lineups-toggle");
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#arena-lineups-body")).toBeHidden();
  await expect(page.locator("#arena-lineups-body")).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#arena-lineups-body")).toBeVisible();
  // Tab hasta un jugador de la tarjeta y Enter: la ficha muestra ese jugador.
  await tabHasta(page, '[data-testid="arena-lineup-player"]');
  const id = await page.evaluate(() => document.activeElement!.getAttribute("data-lineup-player"));
  const jugador = ejemplo.inicial.jugadores.find(j => j.id === id)!;
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("arena-player-card")).toContainText(jugador.nombre);
  await expect(page.locator(`[data-testid="arena-lineup-player"][data-lineup-player="${id}"]`)).toHaveAttribute("aria-pressed", "true");

  // Plegada y con el foco dentro (Shift+Tab vuelve al botón de plegar); se reproduce sin mover el foco
  // (un clic real llevaría el foco a «Play»): al desaparecer, el foco pasa a una ficha de la cancha.
  await page.keyboard.press("Shift+Tab");
  await expect(toggle).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Play", exact: true }).dispatchEvent("click");
  await expect(tarjeta).toHaveCount(0, { timeout: 2_000 });
  expect(await page.evaluate(() => { const a = document.activeElement; return a?.matches('.arena-player[data-testid="arena-player"]') ?? false; })).toBe(true);
  await page.getByRole("button", { name: "Pause", exact: true }).click();

  // «Restart»: vuelve desplegada aunque se hubiera plegado antes.
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(tarjeta).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#arena-lineups-body")).toBeVisible();

  // Reproducir con un clic: la tarjeta desaparece en ≤ 2 s; volver con el deslizador a 0 la recupera.
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(tarjeta).toHaveCount(0, { timeout: 2_000 });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("slider", { name: "Match time" }).fill("0");
  await expect(tarjeta).toBeVisible();

  // Suplente desde el banquillo de la tarjeta.
  const banco = page.locator('[data-side="local"] .arena-lineup-bench');
  await banco.locator("summary").click();
  const suplente = banco.locator(".arena-lineup-player").first();
  const idSuplente = await suplente.getAttribute("data-lineup-player");
  await suplente.click();
  const ficha = page.getByTestId("arena-player-card");
  await expect(ficha).toContainText(ejemplo.inicial.banco!.find(j => j.id === idSuplente)!.nombre);
  await expect(ficha).toContainText("Available substitute");
});

test("056 · (2) 360 px, oscuro, movimiento reducido y español", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, colorScheme: "dark", reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/arena");
  await page.getByRole("button", { name: "Switch to Spanish" }).click();
  await cargarEjemplo(page, true);
  const tarjeta = page.getByTestId("arena-lineups");
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta.getByRole("heading", { name: "Alineaciones", exact: true })).toBeVisible();
  const banco = tarjeta.locator('[data-side="local"] .arena-lineup-bench summary');
  await banco.scrollIntoViewIfNeeded();
  await expect(banco).toHaveText("Suplentes (5)");
  await expect(banco).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  // Sin animaciones ni transiciones en la tarjeta.
  const animadas = await tarjeta.evaluate(s => [s, ...s.querySelectorAll("*")].filter(e => { const c = getComputedStyle(e); return c.animationName !== "none" || (c.transitionDuration.split(",").some(d => parseFloat(d) > 0) && !e.matches(".btn")); }).length);
  expect(animadas).toBe(0);
  await ctx.close();
});

// ——— Bloque B · Previa hablada con línea de tiempo controlada (§ 7 y v1.1 §§ 2, 3, 10) ———
type Fuente = { inicio: number; fin: number; duracion: number; detenida: boolean; relojS: number; etiqueta?: { role: string; kind: string; tick: number; texto: string; roles: string[]; variante?: string } };
type Pedido = { desdeTick: number; hastaTick: number; modo: string; idioma: "es" | "en"; intervencion?: string; variante?: string; cierre?: boolean; entradaTick?: number; memoria?: { texto: string; tick: number }[] };
const SR = 24000;
const wav = async (s: number) => Buffer.from(await wavMono([Float32Array.from({ length: Math.round(s * SR) }, (_, i) => 0.05 * Math.sin(i / 9))], SR).arrayBuffer()).toString("base64");
const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));
const prefijo = (r: RegistroArena, t: number): RegistroArena => ({ ...r, eventos: r.eventos.filter(e => e.tick <= t), fotogramas: r.fotogramas.filter(f => f.tick <= t), rondas: r.rondas.filter(x => x.inicioTick < t), final: [...r.fotogramas].reverse().find(f => f.tick <= t)! });
const asignacion = { modo: "programado", local: { nombre: "Local" }, visita: { nombre: "Visita" } };
const relojS = (texto: string) => { const m = /^(\d+):(\d{2})/.exec(texto.trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };

/** Instrumenta Web Audio y etiqueta cada fuente con la transcripción visible (patrón de arena-mesa.spec). */
async function instrumentar(page: Page) {
  await page.addInitScript(() => {
    const fuentes: Fuente[] = []; (window as unknown as { mesa: Fuente[] }).mesa = fuentes;
    const reloj = () => { const m = /^(\d+):(\d{2})/.exec(document.querySelector('[data-testid="arena-clock"]')?.textContent?.trim() ?? ""); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
    const Base = window.AudioContext;
    window.AudioContext = class extends Base {
      override createBufferSource() {
        const f = super.createBufferSource(), iniciar = f.start.bind(f), detener = f.stop.bind(f);
        const dato: Fuente = { inicio: 0, fin: 0, duracion: 0, detenida: false, relojS: NaN };
        f.start = (cuando = 0) => {
          const retraso = Math.max(0, cuando - this.currentTime);
          dato.inicio = performance.now() + retraso * 1000; dato.duracion = f.buffer!.duration; dato.fin = dato.inicio + dato.duracion * 1000;
          dato.relojS = reloj() + retraso; fuentes.push(dato); iniciar(cuando);
        };
        f.stop = (cuando = 0) => { if (dato.fin > performance.now() + 20) dato.detenida = true; dato.fin = Math.min(dato.fin, performance.now() + Math.max(0, cuando - this.currentTime) * 1000); detener(cuando); };
        f.addEventListener("ended", () => { dato.fin = Math.min(dato.fin, performance.now()); });
        return f;
      }
    };
    let previo = "";
    document.addEventListener("DOMContentLoaded", () => new MutationObserver(() => {
      const el = document.querySelector<HTMLElement>('[data-testid="arena-voice-transcript"]');
      if (!el) return;
      const ps = [...el.querySelectorAll<HTMLElement>("p[data-narration-role]")];
      const d = { role: el.dataset.narrationRole ?? "", kind: el.dataset.narrationKind ?? "", tick: Number(el.dataset.narrationTick), texto: ps[0]?.textContent ?? "", roles: ps.map(x => x.dataset.narrationRole ?? ""), variante: el.dataset.narrationVariant };
      const clave = JSON.stringify(d); if (clave === previo) return; previo = clave;
      const f = [...fuentes].reverse().find(x => !x.etiqueta); if (f) f.etiqueta = d;
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true }));
  });
}
const fuentesDe = async (page: Page, t0: number) => (await page.evaluate(() => (window as unknown as { mesa: Fuente[] }).mesa)).map(f => ({ ...f, inicioS: (f.inicio - t0) / 1000, finS: (f.fin - t0) / 1000 }));
/** Pieza de la previa a la que pertenece una fuente (por el texto de su primer fragmento, ES o EN). */
const piezaDe = (piezas: IntervencionArena[], f: Fuente) => f.etiqueta?.kind !== "invitado" ? undefined
  : piezas.find(i => [i.turnos!, i.turnosBreve ?? []].some(t => t[0] && (t[0].texto_en === f.etiqueta!.texto || t[0].texto_es === f.etiqueta!.texto)));

/** Emisión en búfer simulada: instantánea con el prefijo hasta `corte`, SSE controlado y /relato propio. */
async function emision(page: Page, id: string, registro: RegistroArena, corte: number, eventos: (r: Route, llamada: number) => Promise<void>, relato: (p: Pedido, r: Route) => Promise<void>) {
  await page.route(`**/api/arena/sesiones/${id}/emision`, r => r.fulfill({ json: { registro: prefijo(registro, corte), comentarios: [], intervenciones: [], asignacion, metricas: {}, estado: "ejecutando", ultimoMensaje: 1 } }));
  let llamadas = 0;
  await page.route(`**/api/arena/sesiones/${id}/eventos*`, r => eventos(r, llamadas++));
  await page.route("**/api/arena/herramientas", r => r.fulfill({ json: { voz: true, analista: false } }));
  await page.route(`**/api/arena/sesiones/${id}/relato`, r => relato(r.request().postDataJSON() as Pedido, r));
}
const soloKeepalive = (r: Route) => r.fulfill({ headers: { "content-type": "text/event-stream" }, body: ": keepalive\n\n" });

test("056 · (1) antes del saque, con el reloj detenido: la entrada y las tres piezas completas, en orden y sin solaparse", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const registro = await leer("public/experimentos/arena-duelo-v3.json");
  const id = "00000000-0000-4000-8000-000000000561", corte = BUFFER_ARENA.tramoTicks, seed = registro.config.partido.seed;
  const piezas = previaPartido(prefijo(registro, corte));
  const clips = { entrada: await wav(0.3), pieza: await wav(1.5) };
  const pedidos: Pedido[] = [];
  await emision(page, id, registro, corte, r => soloKeepalive(r), async (p, r) => {
    pedidos.push(p);
    if (p.intervencion) {
      const i = piezas.find(x => x.id === p.intervencion);
      if (!i) return r.fulfill({ status: 404, json: { error: "Sin invitados en esta prueba" } }).catch(() => {});
      return r.fulfill({ json: { ...relatoIntervencion(i, seed, p.idioma, (p.variante ?? "completa") as "completa" | "breve"), audio: { base64: clips.pieza, tipo: "audio/wav" } } }).catch(() => {});
    }
    if (p.entradaTick !== undefined) return r.fulfill({ json: { desdeTick: p.desdeTick, hastaTick: p.hastaTick, modo: "buffer", idioma: p.idioma, entradaTick: p.entradaTick, texto: "Apertura", fragmentos: [{ tick: p.entradaTick, texto: "Apertura", emocion: "serena", intensidad: .2, variante: 0, fuentes: [], fotogramas: [] }], fuentes: [], fotogramas: [], eventosDisponibles: 0, eventosNarrados: 1, conduccionesNarradas: 0, prioridad: 10, cierre: false, tipoRelato: "entrada", claveVoz: "prueba:entrada", audio: { base64: clips.entrada, tipo: "audio/wav" } } }).catch(() => {});
    return r.fulfill({ json: { desdeTick: p.desdeTick, hastaTick: p.hastaTick, modo: "buffer", idioma: p.idioma, texto: "", fragmentos: [], fuentes: [], fotogramas: [], eventosDisponibles: 0, eventosNarrados: 0, conduccionesNarradas: 0, prioridad: 10, cierre: false, tipoRelato: "comentario", audio: null } }).catch(() => {});
  });
  await instrumentar(page);
  await page.goto(`/arena?partido=${id}&vista=buffer`);
  await expect(page.getByTestId("arena-buffer-status")).toHaveText(`Preparing broadcast · ${corte * ARENA.pasoS}/${BUFFER_ARENA.segundos} s ready`);
  await expect(page.getByTestId("arena-clock")).toContainText("0:00 /");
  const tarjeta = page.getByTestId("arena-lineups");
  await expect(tarjeta).toBeVisible();
  await expect(page.getByTestId("arena-lineup-player")).toHaveCount(22);
  await expect(tarjeta.locator('[data-testid="arena-lineup"][data-side]')).toHaveCount(2);
  const t0 = await page.evaluate(() => performance.now());
  await page.getByRole("button", { name: "Enable narration", exact: true }).click();
  const transcripcion = page.getByTestId("arena-voice-transcript");
  await expect(transcripcion).toHaveAttribute("data-narration-kind", "invitado", { timeout: 8000 });
  await expect(transcripcion).toContainText(`Here is ${registro.config.partido.local.nombre}`);
  await expect.poll(async () => (await fuentesDe(page, t0)).filter(f => piezaDe(piezas, f)).length, { timeout: 20_000 }).toBe(3);
  await page.waitForTimeout(500);
  const fuentes = await fuentesDe(page, t0);
  await testInfo.attach("previa-1.json", { body: JSON.stringify({ fuentes, pedidos }, null, 2), contentType: "application/json" });
  const deLaPrevia = fuentes.filter(f => piezaDe(piezas, f)).sort((a, b) => a.inicio - b.inicio);
  expect(deLaPrevia.map(f => piezaDe(piezas, f)!.id)).toEqual(piezas.map(i => i.id));
  expect(deLaPrevia.every(f => f.etiqueta!.variante === "completa")).toBe(true);
  // Con el reloj detenido en 0:00 (relojS = reloj visible + retraso de programación, < 1 s) y sin cortes.
  for (const f of deLaPrevia) { expect(f.relojS, JSON.stringify(f)).toBeLessThan(1); expect(f.detenida, JSON.stringify(f)).toBe(false); }
  // La entrada del narrador suena antes que la primera pieza.
  const entrada = fuentes.find(f => f.etiqueta?.kind === "entrada")!;
  expect(entrada).toBeDefined();
  expect(deLaPrevia[0]!.inicio).toBeGreaterThanOrEqual(entrada.fin - 60);
  // Huecos entre piezas ≤ separacionS + 1 s y ninguna fuente solapada.
  for (let k = 1; k < deLaPrevia.length; k++) expect(deLaPrevia[k]!.inicio - deLaPrevia[k - 1]!.fin).toBeLessThanOrEqual((PREVIA_ARENA.separacionS + 1) * 1000);
  const ordenadas = [...fuentes].sort((a, b) => a.inicio - b.inicio);
  ordenadas.forEach((f, k) => { if (k) expect(f.inicio, JSON.stringify([ordenadas[k - 1], f])).toBeGreaterThanOrEqual(ordenadas[k - 1]!.fin - 60); });
  // Las peticiones de la previa: solo completas, en orden 1, 2, 3.
  const dePrevia = pedidos.filter(p => p.intervencion?.startsWith("previa:"));
  expect(dePrevia.some(p => p.variante === "breve")).toBe(false);
  expect([...new Set(dePrevia.map(p => p.intervencion))]).toEqual(piezas.map(i => i.id));
  for (const p of dePrevia) expect(p).toMatchObject({ desdeTick: 0, hastaTick: 0, modo: "buffer", variante: "completa" });
  await expect(page.getByTestId("arena-clock")).toContainText("0:00 /");
  // Pulsar un jugador de la tarjeta muestra su ficha.
  const boton = page.getByTestId("arena-lineup-player").nth(3);
  const idElegido = await boton.getAttribute("data-lineup-player");
  const elegido = registro.inicial.jugadores.find(j => j.id === idElegido)!;
  await boton.click();
  await expect(page.getByTestId("arena-player-card")).toContainText(elegido.nombre);
});

test("056 · (3) «Listen from the start» empieza por las tres piezas de la previa con el reloj en 0", async ({ page }) => {
  test.setTimeout(90_000);
  const registro = await leer("public/experimentos/arena-llm-v3.json"), seed = registro.config.partido.seed;
  const id = "00000000-0000-4000-8000-000000000563";
  const piezas = previaPartido(registro);
  const piezaS = 2, tramoS = 1;
  const clips = { pieza: await wav(piezaS), tramo: await wav(tramoS) };
  const pedidos: Pedido[] = [];
  await page.route("**/api/arena/herramientas", r => r.fulfill({ json: { voz: true, analista: false } }));
  // La grabación del ejemplo cargado registra una sesión; la voz se simula (Speech no está en el e2e).
  await page.route("**/api/arena/grabaciones", r => r.fulfill({ json: { id } }));
  await page.route(`**/api/arena/sesiones/${id}/relato`, r => {
    const p = r.request().postDataJSON() as Pedido; pedidos.push(p);
    if (p.intervencion) {
      const i = piezas.find(x => x.id === p.intervencion);
      if (!i) return r.fulfill({ status: 404, json: { error: "Sin invitados en esta prueba" } });
      return r.fulfill({ json: { ...relatoIntervencion(i, seed, p.idioma, (p.variante ?? "completa") as "completa" | "breve"), audio: { base64: clips.pieza, tipo: "audio/wav" } } });
    }
    return r.fulfill({ json: { ...construirRelato(registro, p.desdeTick, p.hastaTick, p.modo as "completo", p.idioma), audio: { base64: clips.tramo, tipo: "audio/wav" } } });
  });
  await page.goto("/arena");
  await cargarEjemplo(page);
  const narracion = page.getByTestId("arena-narration");
  await narracion.getByRole("button", { name: "Enable narration for this recording" }).click();
  await narracion.getByRole("button", { name: "Listen from the start" }).click();
  await expect(narracion.locator("audio")).toHaveAttribute("src", /blob:/, { timeout: 30_000 });
  const tramos = Math.ceil(registro.final.tick / RELATO_INTERVALOS.completo);
  await expect(narracion.getByRole("status")).toHaveAttribute("data-progress-total", String(tramos + piezas.length));
  // Las tres primeras peticiones son la previa (completa, en orden) y después el tramo 0–100.
  expect(pedidos.slice(0, 3).map(p => [p.intervencion, p.variante, p.desdeTick, p.hastaTick])).toEqual(piezas.map(i => [i.id, "completa", 0, 0]));
  expect(pedidos[3]).toMatchObject({ desdeTick: 0, hastaTick: RELATO_INTERVALOS.completo, modo: "completo" });
  await narracion.locator("audio").evaluate((a: HTMLAudioElement) => a.pause());
  const ir = (t: number) => narracion.locator("audio").evaluate((a: HTMLAudioElement, t) => { a.currentTime = t; }, t);
  const transcripcion = page.getByTestId("arena-narration-transcript");
  for (let k = 0; k < piezas.length; k++) {
    await ir(k * piezaS + piezaS / 2);
    await expect(transcripcion).toHaveAttribute("data-narration-role", "estadista");
    await expect(transcripcion).toHaveAttribute("data-narration-tick", "0");
    await expect(transcripcion).toContainText(piezas[k]!.turnos![0]!.texto_en);
    await expect(page.getByTestId("arena-clock")).toContainText("0:00 /");
  }
  // Tras el primer tramo del narrador, el reloj avanza.
  await ir(piezas.length * piezaS + tramoS * 0.9);
  await expect(transcripcion).toHaveAttribute("data-narration-role", "narrador");
  await expect.poll(async () => relojS(await page.getByTestId("arena-clock").textContent() ?? "")).toBeGreaterThan(0);
});

/** Escenario (4) de v1.1 § 10: preparación de PREP_MS, saque, calma y caducidad con síntesis demoradas. */
async function escenario4(page: Page, id: string, opciones: { activarS?: number } = {}) {
  const registro = await leer("public/experimentos/arena-duelo-v3.json"), seed = registro.config.partido.seed;
  const corte = BUFFER_ARENA.tramoTicks, PREP_MS = 7000;
  const piezas = previaPartido(prefijo(registro, corte));
  const ordinaria = intervencionEstadista(datosEstadista(prefijo(registro, 300), 300).filter(d => d.ocupaPlaza).slice(0, 1), 300);
  const clips = { narrador: await wav(0.8), p1: await wav(3), p1b: await wav(1.5), p2: await wav(4), p2b: await wav(2), p3: await wav(3), p3b: await wav(1.5) };
  const pedidos: (Pedido & { t: number })[] = [];
  let tCarga = 0;
  const publicaciones = [
    ...registro.rondas.filter(x => x.inicioTick >= corte).map(ronda => ({ tipo: "ordenes", ronda })),
    { tipo: "avance", estado: registro.final, fotogramas: registro.fotogramas.filter(f => f.tick > corte), eventos: registro.eventos.filter(e => e.tick > corte) },
    { tipo: "intervencion", intervencion: ordinaria },
    { tipo: "terminada", estado: "completa", metricas: { decisiones: 4, respaldos: 0, duracionMs: 0 } },
  ];
  await emision(page, id, registro, corte, async (r, llamada) => {
    if (llamada > 0) return soloKeepalive(r);
    await esperar(PREP_MS);
    await r.fulfill({ headers: { "content-type": "text/event-stream" }, body: publicaciones.map((publicacion, i) => `id: ${i + 2}\nevent: arena\ndata: ${JSON.stringify({ id: i + 2, publicacion })}\n\n`).join("") }).catch(() => {});
  }, async (p, r) => {
    pedidos.push({ ...p, t: Date.now() - tCarga });
    if (p.intervencion) {
      const i = piezas.find(x => x.id === p.intervencion);
      if (!i) return r.fulfill({ status: 404, json: { error: "Sin invitados en esta prueba" } }).catch(() => {});
      const breve = p.variante === "breve", n = piezas.indexOf(i) + 1;
      // Pieza 1: 1 s de demora; pieza 2: llega 9 s después de pedirse; pieza 3: después de 35 s de partido.
      if (n === 1) await esperar(1000);
      if (n === 2 && !breve) await esperar(9000);
      if (n === 3) await esperar(PREP_MS + 36_000 - (Date.now() - tCarga));
      const base64 = n === 1 ? (breve ? clips.p1b : clips.p1) : n === 2 ? (breve ? clips.p2b : clips.p2) : (breve ? clips.p3b : clips.p3);
      return r.fulfill({ json: { ...relatoIntervencion(i, seed, p.idioma, (p.variante ?? "completa") as "completa" | "breve"), audio: { base64, tipo: "audio/wav" } } }).catch(() => {});
    }
    const relato = construirRelato(prefijo(registro, p.hastaTick), p.desdeTick, p.hastaTick, "buffer", p.idioma, { cierre: p.cierre, entradaTick: p.entradaTick, memoria: p.memoria as never });
    return r.fulfill({ json: { ...relato, audio: relato.texto ? { base64: clips.narrador, tipo: "audio/wav" } : null } }).catch(() => {});
  });
  await instrumentar(page);
  tCarga = Date.now();
  await page.goto(`/arena?partido=${id}&vista=buffer`);
  await expect(page.getByTestId("arena-clock")).toContainText("0:00 /");
  if (opciones.activarS) await esperar(opciones.activarS * 1000 - (Date.now() - tCarga));
  const t0 = await page.evaluate(() => performance.now()), tActivacion = Date.now();
  await page.getByRole("button", { name: "Enable narration", exact: true }).click();
  return { registro, piezas, pedidos, t0, tActivacion, tCarga: () => tCarga, PREP_MS };
}

test("056 · (4) preparación, saque, calma y caducidad: ninguna pieza se solapa ni se repite; la 3 caduca; reservas cubren el silencio", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const { piezas, pedidos, t0, tActivacion } = await escenario4(page, "00000000-0000-4000-8000-000000000564");
  // El reloj avanza a velocidad 1 desde que termina la preparación, sin esperar a las síntesis.
  await esperar(27_000 - (Date.now() - tActivacion));
  expect(Math.abs(relojS(await page.getByTestId("arena-clock").textContent() ?? "") - 20)).toBeLessThanOrEqual(1);
  await esperar(45_000 - (Date.now() - tActivacion));
  const fuentes = await fuentesDe(page, t0);
  await testInfo.attach("previa-4.json", { body: JSON.stringify({ fuentes, pedidos }, null, 2), contentType: "application/json" });
  const [p1, p2, p3] = piezas as [IntervencionArena, IntervencionArena, IntervencionArena];
  const de = (i: IntervencionArena) => fuentes.filter(f => piezaDe(piezas, f)?.id === i.id);
  // La entrada suena antes que cualquier pieza.
  const entrada = fuentes.find(f => f.etiqueta?.kind === "entrada")!;
  expect(entrada).toBeDefined();
  for (const f of fuentes.filter(f => piezaDe(piezas, f))) expect(f.inicio).toBeGreaterThanOrEqual(entrada.fin - 60);
  // Pieza 1: arranca con el reloj en 0:00 y completa.
  expect(de(p1)).toHaveLength(1);
  expect(de(p1)[0]!.relojS, JSON.stringify(de(p1)[0])).toBeLessThan(1);
  expect(de(p1)[0]!.etiqueta!.variante).toBe("completa");
  // Pieza 2: pedida como completa durante la preparación; suene la completa o la breve, una sola vez.
  expect(pedidos.find(p => p.intervencion === p2.id)).toMatchObject({ variante: "completa" });
  expect(de(p2).length).toBeLessThanOrEqual(1);
  // Ninguna pieza vuelve a arrancar (una detenida por una noticia tampoco).
  for (const i of piezas) expect(de(i).length, i.id).toBeLessThanOrEqual(1);
  // Pieza 3: servida después de su caducidad, nunca suena.
  expect(de(p3)).toHaveLength(0);
  // Ninguna fuente se solapa con otra.
  const ordenadas = [...fuentes].sort((a, b) => a.inicio - b.inicio);
  ordenadas.forEach((f, k) => { if (k) expect(f.inicio, JSON.stringify([ordenadas[k - 1], f])).toBeGreaterThanOrEqual(ordenadas[k - 1]!.fin - 60); });
  // Silencio máximo ≤ VOZ_BUFFER.silencioMaxS durante los primeros 40 s con voz (las reservas cubren huecos).
  const ventana = ordenadas.filter(f => f.inicioS <= 40);
  expect(ventana.some(f => f.etiqueta?.kind === "comentario" && f.etiqueta.tick >= 0 && !piezaDe(piezas, f))).toBe(true);
  let finAnterior = ventana[0]!.inicioS;
  expect(ventana[0]!.inicioS).toBeLessThanOrEqual(VOZ_BUFFER.silencioMaxS);
  for (const f of ventana) { expect(f.inicioS - finAnterior, JSON.stringify(f)).toBeLessThanOrEqual(VOZ_BUFFER.silencioMaxS); finAnterior = Math.max(finAnterior, f.finS); }
});

test("056 · (4) reactivación: desactivar con la pieza 2 pendiente y reactivar con el reloj en marcha la conserva; activación tardía pide las tres", async ({ page }) => {
  test.setTimeout(120_000);
  const { piezas, t0, tActivacion, PREP_MS } = await escenario4(page, "00000000-0000-4000-8000-000000000565");
  const voz = page.getByRole("button", { name: "Turn narration off", exact: true });
  await esperar(3000 - (Date.now() - tActivacion));
  await voz.click();
  // Reactivar con el reloj ya en marcha (la pieza 2 llegó durante el silencio): tick > 0, dentro de caducidadS.
  await esperar(PREP_MS + 3000 - (Date.now() - tActivacion));
  expect(relojS(await page.getByTestId("arena-clock").textContent() ?? "")).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Enable narration", exact: true }).click();
  await expect.poll(async () => (await fuentesDe(page, t0)).filter(f => piezaDe(piezas, f)?.id === piezas[1]!.id).length, { timeout: 20_000 }).toBe(1);
});

test("056 · (4) activación tardía (8 s): las tres piezas se piden y suena al menos la 1", async ({ page }) => {
  test.setTimeout(120_000);
  const { piezas, pedidos, t0 } = await escenario4(page, "00000000-0000-4000-8000-000000000566", { activarS: 8 });
  await expect.poll(async () => (await fuentesDe(page, t0)).filter(f => piezaDe(piezas, f)?.id === piezas[0]!.id).length, { timeout: 20_000 }).toBe(1);
  await expect.poll(() => new Set(pedidos.filter(p => p.intervencion?.startsWith("previa:")).map(p => p.intervencion)).size, { timeout: 20_000 }).toBe(3);
});
