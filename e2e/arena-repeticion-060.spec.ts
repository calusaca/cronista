// Brief 060 (v1.2) · Repetición narrada al ritmo del partido. Voz y relato simulados como en el 057: `herramientas` →
// voz; `grabaciones` → `{ id }` de una sesión programada real; `relato` → `construirRelato` real en "buffer" (memoria,
// cierre y evento) y la previa/invitados con `relatoIntervencion`. Oráculo independiente (v1.1 (7)): cada clip servido
// es un tono de amplitud constante y duración conocida, distinta por pieza; la prueba decodifica el blob de la pista,
// localiza cada clip por sus muestras no nulas y lo identifica por su amplitud. `planificarPista` no se usa aquí.
import { expect, test, type APIRequestContext, type Page, type Route } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { crearSesion } from "./sesiones";
import { wavMono } from "../src/arena/pista-audio";
import { RELATO_INTERVALOS, type IntervencionArena } from "../src/arena/protocolo";
import { construirRelato, relatoIntervencion } from "../src/arena/relato";
import { previaPartido } from "../src/arena/previa";
import { datosEstadista, intervencionEstadista } from "../src/arena/estadista";
import type { RecuerdoVoz } from "../src/arena/editorial";
import type { RegistroArena } from "../src/arena/tipos";
import { ARENA, MESA_ARENA, REPETICION_NARRADA } from "../src/sim/limites";

test.describe.configure({ mode: "serial" });

const B = RELATO_INTERVALOS.buffer, paso = ARENA.pasoS;
const reloj = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
type Pedido = { desdeTick: number; hastaTick: number; modo: string; idioma: "es" | "en"; intervencion?: string; variante?: string; cierre?: boolean; evento?: string; memoria?: RecuerdoVoz[] };
/** Pieza servida con audio: su tono (amplitud y duración), el tick de su primer fragmento y su tipo. */
type Servida = { pedido: Pedido; amplitud: number; duracionS: number; tick: number; tipo: "previa" | "narrador" | "invitado" | "cierre" };

let idReal: string | undefined;
async function sesionReal(request: APIRequestContext) {
  idReal ??= (await (await crearSesion(request, { seed: 571, segundos: 12, local: "auto", visita: "auto", seleccion: { modo: "programado" }, presentacion: "preparada" })).json() as { id: string }).id;
  return idReal;
}
/** Tono k: amplitud y duración distintas por pieza (identificables tras el ensamblado y el WAV de 16 bits). */
const amplitudDe = (k: number) => 0.04 + 0.003 * k, duracionDe = (k: number) => 0.5 + 0.05 * (k % 12);
const tono = async (k: number) => Buffer.from(await wavMono([new Float32Array(Math.round(duracionDe(k) * 24000)).fill(amplitudDe(k))], 24000).arrayBuffer()).toString("base64");

async function simularVoz(page: Page, o: { id: string; registro?: RegistroArena; tramo?: (r: Route, p: Pedido, normal: () => Promise<void>) => Promise<void>; invitados?: IntervencionArena[] }) {
  const grabaciones: unknown[] = [], pedidos: Pedido[] = [], servidas: Servida[] = [];
  let registro = o.registro;
  await page.route("**/api/arena/herramientas", r => r.fulfill({ json: { voz: true, analista: false } }));
  await page.route("**/api/arena/grabaciones", async r => {
    const cuerpo = r.request().postDataJSON() as { registro?: RegistroArena; archivo?: string };
    grabaciones.push(cuerpo);
    if (cuerpo.registro) registro = cuerpo.registro;
    if (cuerpo.archivo === "duelo") registro = JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;
    return r.fulfill({ json: { id: o.id } }).catch(() => {});
  });
  await page.route("**/api/arena/sesiones/*/relato", async r => {
    const p = r.request().postDataJSON() as Pedido;
    pedidos.push(p);
    const responder = async (relato: { texto: string; fragmentos: { tick: number }[] }, tipo: Servida["tipo"]) => {
      if (!relato.texto) return r.fulfill({ json: { ...relato, audio: null } }).catch(() => {});
      const k = servidas.length;
      servidas.push({ pedido: p, amplitud: amplitudDe(k), duracionS: duracionDe(k), tick: relato.fragmentos[0]!.tick, tipo });
      return r.fulfill({ json: { ...relato, audio: { base64: await tono(k), tipo: "audio/wav" } } }).catch(() => {});
    };
    const normal = async () => {
      if (p.intervencion) {
        const i = [...previaPartido(registro!), ...o.invitados ?? []].find(i => i.id === p.intervencion);
        if (!i) return r.fulfill({ status: 404, json: { error: "Intervención no publicada" } }).catch(() => {});
        return responder(relatoIntervencion(i, registro!.config.partido.seed, p.idioma, (p.variante ?? "completa") as "completa"), p.intervencion.startsWith("previa:") ? "previa" : "invitado");
      }
      if (p.modo !== "buffer") return responder({ ...construirRelato(registro!, p.desdeTick, p.hastaTick, p.modo as "completo", p.idioma) }, "narrador");
      return responder(construirRelato(registro!, p.desdeTick, p.hastaTick, "buffer", p.idioma, { memoria: p.memoria, cierre: p.cierre, ...p.evento ? { evento: p.evento } : {} }), p.cierre ? "cierre" : "narrador");
    };
    return o.tramo ? o.tramo(r, p, normal) : normal();
  });
  return { grabaciones, pedidos, servidas, registro: () => registro! };
}
async function crearGrabacion(page: Page, es = false) {
  await page.getByRole("button", { name: es ? "Partidos guardados" : "Saved matches", exact: true }).click();
  await page.getByRole("combobox", { name: es ? "Duración simulada" : "Simulated duration", exact: true }).selectOption("30");
  const respuesta = page.waitForResponse(r => new URL(r.url()).pathname === "/api/arena" && r.request().method() === "POST");
  await page.getByRole("button", { name: es ? "Crear grabación sin IA" : "Create recording without AI", exact: true }).click();
  const r = await respuesta; expect(r.ok()).toBe(true);
  const registro = await r.json() as RegistroArena;
  await expect(page.getByTestId("arena-clock")).toHaveText(`0:00 / ${reloj(registro.final.tick * paso)}`);
  return registro;
}
const boton = (page: Page, nombre: string) => page.getByRole("button", { name: nombre, exact: true });
const lectura = (page: Page) => page.evaluate(() => {
  const a = document.querySelector<HTMLAudioElement>('[data-testid="arena-narration"] audio')!, c = document.querySelector<HTMLElement>('[data-testid="arena-clock"]')!;
  return { t: a.currentTime, pausado: a.paused, src: a.getAttribute("src"), cursor: Number(c.dataset.cursorS) };
});
/** Decodifica el blob de la pista y devuelve los clips (tramos de muestras no nulas) con su amplitud. */
const clipsDeLaPista = (page: Page) => page.evaluate(async () => {
  const a = document.querySelector<HTMLAudioElement>('[data-testid="arena-narration"] audio')!;
  const datos = await (await fetch(a.src)).arrayBuffer(), audio = await new OfflineAudioContext(1, 1, 24000).decodeAudioData(datos), x = audio.getChannelData(0);
  const clips: { inicio: number; fin: number; amplitud: number }[] = [];
  for (let i = 0; i < x.length;) {
    if (Math.abs(x[i]!) > 1e-3) { const j = i, amplitud = x[i]!; while (i < x.length && Math.abs(x[i]!) > 1e-3) i++; clips.push({ inicio: j / audio.sampleRate, fin: i / audio.sampleRate, amplitud }); } else i++;
  }
  return { clips, duracion: audio.duration };
});
/** Pieza servida cuyo tono tiene esa amplitud (la más cercana; la separación entre tonos es de 0,003). */
const piezaDe = (servidas: readonly Servida[], amplitud: number) => servidas.reduce((m, s) => Math.abs(s.amplitud - amplitud) < Math.abs(m.amplitud - amplitud) ? s : m);
/** Pausa el audio y lo coloca en `t`; espera a que el cursor de la cancha se asiente. */
async function buscarAudio(page: Page, t: number) {
  await page.evaluate(t => { const a = document.querySelector<HTMLAudioElement>('[data-testid="arena-narration"] audio')!; a.pause(); a.currentTime = t; }, t);
  await expect.poll(async () => Math.abs((await lectura(page)).t - t)).toBeLessThan(0.01);
  let anterior = NaN;
  await expect.poll(async () => { const c = (await lectura(page)).cursor, igual = c === anterior; anterior = c; return igual; }).toBe(true);
  return lectura(page);
}

test("060 E1 · ritmo y orden: previa, ventanas buffer en orden (con eventos importantes y cierre) y la cancha a 1× entre clips", async ({ page, request }) => {
  test.setTimeout(120_000);
  const errores: string[] = []; page.on("pageerror", e => errores.push(e.message));
  const voz = await simularVoz(page, { id: await sesionReal(request) });
  await page.goto("/arena");
  const registro = await crearGrabacion(page);
  await boton(page, "Play").click();
  await expect(boton(page, "Pause")).toBeVisible({ timeout: 30_000 });
  // Pedidos: la previa (completa), después cada ventana de RELATO_INTERVALOS.buffer en orden, en modo buffer, con sus
  // peticiones con `evento` justo detrás; el cierre al final.
  const previa = previaPartido(registro).map(i => i.id);
  expect(voz.pedidos.slice(0, previa.length).map(p => [p.intervencion, p.variante])).toEqual(previa.map(id => [id, "completa"]));
  const narrador = voz.pedidos.slice(previa.length);
  expect(narrador.every(p => p.modo === "buffer" && !p.intervencion)).toBe(true);
  const ventanas = narrador.filter(p => !p.evento && !p.cierre);
  expect(ventanas.map(p => [p.desdeTick, p.hastaTick])).toEqual(Array.from({ length: Math.ceil(registro.final.tick / B) }, (_, k) => [k * B, Math.min((k + 1) * B, registro.final.tick)]));
  for (const p of narrador.filter(p => p.evento)) { const k = narrador.indexOf(p); expect(narrador.slice(0, k).filter(x => !x.evento).at(-1)!.desdeTick).toBe(p.desdeTick); }
  expect(narrador.at(-1)).toMatchObject({ cierre: true, hastaTick: registro.final.tick });
  // La memoria se encadena: la segunda ventana ya lleva el recuerdo de la primera (si la primera habló).
  expect((ventanas[1]!.memoria ?? []).length).toBeGreaterThan(0);
  // 1×: dos lecturas separadas 1 s dentro de un hueco sin tono, tras el saque.
  const { clips } = await clipsDeLaPista(page);
  const finPrevia = Math.max(...clips.filter(c => piezaDe(voz.servidas, c.amplitud).tipo === "previa").map(c => c.fin));
  const huecos = clips.slice(1).map((c, i) => ({ desde: clips[i]!.fin, hasta: c.inicio })).filter(h => h.desde >= finPrevia && h.hasta - h.desde >= 1.8);
  expect(huecos.length).toBeGreaterThan(0);
  const hueco = huecos[0]!;
  await buscarAudio(page, hueco.desde + REPETICION_NARRADA.huecoS + 0.1);
  await page.evaluate(() => document.querySelector<HTMLAudioElement>('[data-testid="arena-narration"] audio')!.play());
  await expect.poll(async () => (await lectura(page)).pausado).toBe(false);
  const a = await lectura(page); await page.waitForTimeout(1000); const b = await lectura(page);
  expect(b.t).toBeLessThanOrEqual(hueco.hasta);
  const ritmo = (b.cursor - a.cursor) / (b.t - a.t);
  expect(ritmo, JSON.stringify({ a, b })).toBeGreaterThanOrEqual(0.9); expect(ritmo).toBeLessThanOrEqual(1.1);
  expect(errores).toEqual([]);
});

test("060 E1 · invitados de la Mesa con variante breve, tras la primera ventana que cubre su tick", async ({ page, request }) => {
  const id = await sesionReal(request);
  const registro = await (await request.get(`/api/arena/sesiones/${id}/registro`)).json() as RegistroArena;
  const tick = 60, datos = datosEstadista(registro, tick).filter(d => d.ocupaPlaza).slice(0, MESA_ARENA.maxDatosEstadista);
  test.skip(!datos.length, "Sin datos del estadista en esta semilla");
  const invitado = intervencionEstadista(datos, tick);
  const conInvitado = async (r: Route) => { const respuesta = await r.fetch(), cuerpo = await respuesta.json() as { intervenciones?: IntervencionArena[] }; if (Array.isArray(cuerpo.intervenciones)) cuerpo.intervenciones = [...cuerpo.intervenciones.filter(i => i.id !== invitado.id), invitado]; await r.fulfill({ response: respuesta, json: cuerpo }); };
  await page.route(`**/api/arena/sesiones/${id}/reproduccion`, conInvitado);
  await page.route(`**/api/arena/sesiones/${id}/emision`, conInvitado);
  const voz = await simularVoz(page, { id, registro, invitados: [invitado] });
  await page.goto(`/arena?partido=${id}`);
  await expect(page.getByTestId("arena-live-status")).toContainText("Match ready", { timeout: 20_000 });
  await boton(page, "Play").click();
  await expect(boton(page, "Pause")).toBeVisible({ timeout: 30_000 });
  const k = voz.pedidos.findIndex(p => p.intervencion === invitado.id);
  expect(voz.pedidos[k]).toMatchObject({ variante: REPETICION_NARRADA.varianteInvitado, desdeTick: tick, hastaTick: tick });
  const ventanaPrevia = voz.pedidos.slice(0, k).filter(p => !p.intervencion && !p.evento).at(-1)!;
  expect(ventanaPrevia.hastaTick).toBeGreaterThanOrEqual(tick); expect(ventanaPrevia.desdeTick).toBeLessThan(tick);
});

test("060 E2 · nunca delante: en el inicio de cada clip el cursor ya está en su hecho + reaccionS; también reproduciendo el gol", async ({ page, request }) => {
  test.setTimeout(150_000);
  const voz = await simularVoz(page, { id: await sesionReal(request) });
  await page.goto("/arena");
  await boton(page, "Saved matches").click();
  await boton(page, "Load recorded model duel").click();
  await expect(page.locator(".arena-board > .arena-empty")).toHaveCount(0);
  await boton(page, "Play").click();
  await expect(boton(page, "Pause")).toBeVisible({ timeout: 60_000 });
  const registro = voz.registro(), fin = registro.final.tick * paso, gol = registro.eventos.find(e => e.tipo === "gol")!;
  const { clips } = await clipsDeLaPista(page);
  let golClip: { inicio: number } | undefined;
  for (const c of clips) {
    const s = piezaDe(voz.servidas, c.amplitud);
    if (s.tipo === "previa") continue;
    const l = await buscarAudio(page, c.inicio);
    expect(l.cursor, JSON.stringify({ c, s: { ...s, pedido: undefined } })).toBeGreaterThanOrEqual(Math.min(s.tick * paso + REPETICION_NARRADA.reaccionS, fin) - 0.05);
    if (s.tipo === "narrador" && s.tick === gol.tick) golClip = c;
  }
  expect(golClip).toBeDefined();
  // Reproducción efectiva: desde 1 s antes del clip del gol, la primera muestra con currentTime ≥ su inicio.
  await buscarAudio(page, golClip!.inicio - 1);
  await page.evaluate(() => {
    const w = window as unknown as { muestras: { t: number; cursor: number }[] }; w.muestras = [];
    const a = document.querySelector<HTMLAudioElement>('[data-testid="arena-narration"] audio')!, c = document.querySelector<HTMLElement>('[data-testid="arena-clock"]')!;
    const medir = () => { w.muestras.push({ t: a.currentTime, cursor: Number(c.dataset.cursorS) }); if (w.muestras.length < 600) requestAnimationFrame(medir); };
    requestAnimationFrame(medir); void a.play();
  });
  await page.waitForTimeout(2000);
  const muestras = await page.evaluate(() => (window as unknown as { muestras: { t: number; cursor: number }[] }).muestras);
  const primera = muestras.find(m => m.t >= golClip!.inicio)!;
  expect(primera).toBeDefined();
  expect(primera.cursor).toBeGreaterThanOrEqual(gol.tick * paso + REPETICION_NARRADA.reaccionS - 0.1);
});

test("060 E3 · saltar la previa: el botón aparece con la previa sonando, lleva al saque y deja el foco en el botón principal (y en ES)", async ({ page, request }) => {
  const voz = await simularVoz(page, { id: await sesionReal(request) });
  await page.goto("/arena?lang=es");
  const registro = await crearGrabacion(page, true);
  await boton(page, "Reproducir").click();
  const saltar = page.getByTestId("arena-replay-skip");
  await expect(saltar).toBeVisible({ timeout: 30_000 });
  await expect(saltar).toHaveText("Saltar al saque");
  expect(previaPartido(registro).length).toBeGreaterThan(0);
  const { clips } = await clipsDeLaPista(page);
  const finPrevia = Math.max(...clips.filter(c => piezaDe(voz.servidas, c.amplitud).tipo === "previa").map(c => c.fin));
  await saltar.click();
  await expect(saltar).toHaveCount(0);
  const l = await lectura(page);
  expect(Math.abs(l.t - finPrevia)).toBeLessThan(0.05);
  await expect(boton(page, "Pausar")).toBeFocused();
});

test("060 E3 · EN: «Skip to kick-off» con la previa en pausa", async ({ page, request }) => {
  await simularVoz(page, { id: await sesionReal(request) });
  await page.goto("/arena");
  await crearGrabacion(page);
  await boton(page, "Play").click();
  await expect(boton(page, "Pause")).toBeVisible({ timeout: 30_000 });
  await boton(page, "Pause").click();
  await expect(page.getByTestId("arena-replay-skip")).toHaveText("Skip to kick-off");
  await page.getByTestId("arena-replay-skip").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("arena-replay-skip")).toHaveCount(0);
  await expect(boton(page, "Play")).toBeFocused();
});

test("060 E4 · dos pistas, dos claves: «Listen from the start» (detallada) y después Reproducir pide ventanas buffer", async ({ page, request }) => {
  const voz = await simularVoz(page, { id: await sesionReal(request) });
  await page.goto("/arena");
  await crearGrabacion(page);
  await boton(page, "Enable narration for this recording").click();
  await expect(boton(page, "Listen from the start")).toBeEnabled();
  await boton(page, "Listen from the start").click();
  await expect(page.getByTestId("arena-narration").getByRole("status")).toHaveText("Narration playing", { timeout: 30_000 });
  const detallada = voz.pedidos.filter(p => !p.intervencion);
  expect(detallada.length).toBeGreaterThan(0); expect(detallada.every(p => p.modo === "completo")).toBe(true);
  await boton(page, "Stop narration").click();
  await boton(page, "Play").click();
  await expect(boton(page, "Pause")).toBeVisible({ timeout: 30_000 });
  const ritmo = voz.pedidos.slice(voz.pedidos.indexOf(detallada.at(-1)!) + 1).filter(p => !p.intervencion);
  expect(ritmo.length).toBeGreaterThan(0); expect(ritmo.every(p => p.modo === "buffer")).toBe(true);
});

// ── Bloque B · Pausar y detener (§ 4 + v1.1 (4)(5)(9)) ──────────────────────────────────────────────────────────────
const audioNarracion = (page: Page) => page.getByTestId("arena-narration").locator("audio");
async function seMueve(page: Page) {
  const ficha = page.getByTestId("arena-player").nth(5), antes = await ficha.getAttribute("transform");
  await expect.poll(() => ficha.getAttribute("transform")).not.toBe(antes);
}
const quitarFoco = (page: Page) => page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); });

test("060 E4 · Detener y Reproducir otra vez no hace ningún pedido nuevo a /relato (la pista de ritmo se conserva)", async ({ page, request }) => {
  const voz = await simularVoz(page, { id: await sesionReal(request) });
  await page.goto("/arena");
  await crearGrabacion(page);
  await boton(page, "Play").click();
  await expect(boton(page, "Pause")).toBeVisible({ timeout: 30_000 });
  const pedidos = voz.pedidos.length;
  await page.getByTestId("arena-stop").click();
  await expect(boton(page, "Play")).toBeEnabled();
  await boton(page, "Play").click();
  await expect(boton(page, "Pause")).toBeVisible({ timeout: 10_000 });
  await expect.poll(async () => (await lectura(page)).pausado).toBe(false);
  expect(voz.pedidos.length).toBe(pedidos);
});

test("060 E5 · Detener con voz: audio en pausa sin src, reloj 0:00, Play habilitado y foco en el botón principal (M12)", async ({ page, request }) => {
  await simularVoz(page, { id: await sesionReal(request) });
  await page.goto("/arena");
  await crearGrabacion(page);
  await boton(page, "Play").click();
  await expect(boton(page, "Pause")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("arena-replay-skip").click();
  await page.waitForTimeout(800);
  expect((await lectura(page)).cursor).toBeGreaterThan(0);
  await page.getByTestId("arena-stop").click();
  await expect(audioNarracion(page)).not.toHaveAttribute("src", /blob:/);
  await expect(page.getByTestId("arena-clock")).toHaveAttribute("data-cursor-s", "0.000");
  await expect(page.getByTestId("arena-clock")).toHaveText(/^0:00 \//);
  await expect(boton(page, "Play")).toBeEnabled(); await expect(boton(page, "Play")).toBeFocused();
  await expect(page.getByTestId("arena-stop")).toBeDisabled();
});

test("060 E5 · Detener sin voz: el reloj en marcha vuelve a 0:00 y se queda quieto 500 ms; en ES, «Detener»", async ({ page, request }) => {
  await simularVoz(page, { id: await sesionReal(request) });
  await page.goto("/arena?lang=es");
  await crearGrabacion(page, true);
  await page.getByTestId("arena-play-voice").uncheck();
  await boton(page, "Reproducir").click();
  await seMueve(page);
  await expect(page.getByTestId("arena-stop")).toHaveText("Detener");
  await page.getByTestId("arena-stop").click();
  await expect(page.getByTestId("arena-clock")).toHaveAttribute("data-cursor-s", "0.000");
  await page.waitForTimeout(500);
  await expect(page.getByTestId("arena-clock")).toHaveAttribute("data-cursor-s", "0.000");
  await expect(boton(page, "Reproducir")).toBeFocused();
});

test("060 E5 · Detener durante la preparación: cancela sin pedir más tramos", async ({ page, request }) => {
  const retener = barreraLocal();
  const voz = await simularVoz(page, { id: await sesionReal(request), tramo: async (_r, p, normal) => { if (!p.intervencion) await retener.p; await normal(); } });
  await page.goto("/arena");
  await crearGrabacion(page);
  await boton(page, "Play").click();
  await expect(page.getByTestId("arena-play-progress")).toBeVisible();
  await expect.poll(() => voz.pedidos.filter(p => !p.intervencion).length).toBe(1);
  await page.getByTestId("arena-stop").click();
  retener.soltar();
  await page.waitForTimeout(800);
  expect(voz.pedidos.filter(p => !p.intervencion)).toHaveLength(1);
  await expect(page.getByTestId("arena-play-progress")).toHaveCount(0);
  await expect(boton(page, "Play")).toBeEnabled();
  await expect(page.getByTestId("arena-clock")).toHaveAttribute("data-cursor-s", "0.000");
});
function barreraLocal() { let soltar!: () => void; const p = new Promise<void>(r => { soltar = r; }); return { p, soltar }; }

test("060 E6 · espacio: con el foco en body pausa y reanuda (muda y pista); en el selector, el deslizador o una ficha no hace nada (M13)", async ({ page, request }) => {
  await simularVoz(page, { id: await sesionReal(request) });
  await page.goto("/arena");
  await crearGrabacion(page);
  // aria-keyshortcuts solo cuando el espacio actúa (aquí, sin reproducción ni pausa del espectador, no).
  await expect(boton(page, "Play")).not.toHaveAttribute("aria-keyshortcuts", /.+/);
  await expect(page.getByTestId("arena-space-note")).toHaveText("Space pauses or resumes when no control has focus");
  // Muda.
  await page.getByTestId("arena-play-voice").uncheck();
  await quitarFoco(page); await page.keyboard.press(" ");
  await expect(boton(page, "Play")).toBeVisible(); // sin reproducción ni pausa del espectador: nada
  await boton(page, "Play").click(); await seMueve(page);
  await expect(boton(page, "Pause")).toHaveAttribute("aria-keyshortcuts", "Space");
  await quitarFoco(page); await page.keyboard.press(" ");
  await expect(boton(page, "Play")).toBeVisible();
  await quitarFoco(page); await page.keyboard.press(" ");
  await expect(boton(page, "Pause")).toBeVisible(); await seMueve(page);
  // Con el foco en el selector de velocidad, en el deslizador o en una ficha: nada.
  for (const foco of [page.getByRole("combobox", { name: "Speed" }), page.getByRole("slider", { name: "Match time" }), page.getByTestId("arena-player").nth(3)]) {
    await foco.focus(); await page.keyboard.press(" ");
    await expect(boton(page, "Pause")).toBeVisible();
    await page.keyboard.press("Escape");
  }
  await boton(page, "Pause").click();
  // Pista.
  await page.getByTestId("arena-play-voice").check();
  await boton(page, "Restart").click();
  await boton(page, "Play").click();
  await expect(boton(page, "Pause")).toBeVisible({ timeout: 30_000 });
  await quitarFoco(page); await page.keyboard.press(" ");
  await expect.poll(async () => (await lectura(page)).pausado).toBe(true);
  await quitarFoco(page); await page.keyboard.press(" ");
  await expect.poll(async () => (await lectura(page)).pausado).toBe(false);
});

test("060 E6 · espacio durante la preparación retenida: ni pedidos ni cambios de reloj", async ({ page, request }) => {
  const retener = barreraLocal();
  const voz = await simularVoz(page, { id: await sesionReal(request), tramo: async (_r, p, normal) => { if (!p.intervencion) await retener.p; await normal(); } });
  await page.goto("/arena");
  await crearGrabacion(page);
  await boton(page, "Play").click();
  await expect.poll(() => voz.pedidos.filter(p => !p.intervencion).length).toBe(1);
  const antes = voz.pedidos.length;
  await quitarFoco(page); await page.keyboard.press(" ");
  await page.waitForTimeout(500);
  expect(voz.pedidos.length).toBe(antes);
  await expect(page.getByTestId("arena-play-progress")).toBeVisible();
  await expect(page.getByTestId("arena-clock")).toHaveAttribute("data-cursor-s", "0.000");
  retener.soltar();
});

test("060 E7 · directo con búfer: un único «Pause broadcast» bajo la cancha, pausa con «generation continues», espacio y «Stop match» con un DELETE (M14, M15)", async ({ page }) => {
  test.setTimeout(90_000);
  const borrados: string[] = [];
  page.on("request", r => { if (r.method() === "DELETE" && r.url().includes("/api/arena/sesiones/")) borrados.push(r.url()); });
  await page.goto("/arena");
  const panel = page.getByTestId("arena-live");
  await panel.getByRole("button", { name: "Start live match", exact: true }).click();
  await expect(page.getByTestId("arena-buffer-status")).toContainText("Live", { timeout: 30_000 });
  const pausa = page.getByRole("button", { name: "Pause broadcast", exact: true });
  await expect(pausa).toHaveCount(1);
  expect(await pausa.evaluate(b => !!b.closest(".arena-board") && !b.closest('[data-testid="arena-buffer"]'))).toBe(true);
  await expect(pausa).toHaveAttribute("aria-keyshortcuts", "Space");
  await pausa.click();
  await expect(page.getByTestId("arena-buffer-status")).toContainText("generation continues");
  const reloj = await page.getByTestId("arena-clock").getAttribute("data-cursor-s");
  await page.waitForTimeout(2000);
  await expect(page.getByTestId("arena-clock")).toHaveAttribute("data-cursor-s", reloj!);
  // Espacio con el foco en body: reanuda.
  await quitarFoco(page); await page.keyboard.press(" ");
  await expect(page.getByRole("button", { name: "Pause broadcast", exact: true })).toBeVisible();
  await expect(page.getByTestId("arena-stop")).toHaveText("Stop match");
  await expect(page.getByTestId("arena-stop")).toHaveAttribute("aria-describedby", "arena-stop-nota");
  await page.getByTestId("arena-stop").click();
  await expect(page.getByTestId("arena-live-status")).toHaveText("Match cancelled", { timeout: 20_000 });
  expect(borrados).toHaveLength(1);
  await expect(page.getByTestId("arena-clock")).toHaveText(/^0:00 \//);
  await expect(page.getByTestId("arena-buffer")).toHaveCount(0);
  await expect(boton(page, "Play")).toBeEnabled();
  await expect(panel.getByRole("button", { name: "Start live match", exact: true })).toBeEnabled();
});

test("060 E7 · Stop match con el POST retenido: un DELETE tras su respuesta, sin /eventos ni /reproduccion, y la vista anterior", async ({ page }) => {
  const retener = barreraLocal(), urls: string[] = [];
  page.on("request", r => urls.push(`${r.method()} ${new URL(r.url()).pathname}`));
  await page.route("**/api/arena/sesiones", async r => { if (r.request().method() !== "POST") return r.continue(); await retener.p; await r.continue(); });
  await page.goto("/arena");
  const antes = await page.getByTestId("arena-clock").textContent();
  await page.getByTestId("arena-live").getByRole("button", { name: "Start live match", exact: true }).click();
  await page.getByTestId("arena-stop").click();
  retener.soltar();
  await expect.poll(() => urls.filter(u => u.startsWith("DELETE /api/arena/sesiones/")).length, { timeout: 20_000 }).toBe(1);
  await page.waitForTimeout(800);
  expect(urls.filter(u => /\/(eventos|reproduccion|emision)$/.test(u))).toEqual([]);
  await expect(page.getByTestId("arena-live-status")).toHaveText("Match cancelled");
  await expect(page.getByTestId("arena-clock")).toHaveText(antes!);
  await expect(page.getByTestId("arena-models")).toHaveAttribute("data-procedencia", "programado");
});

test("060 E7 · preparado: una «completa» que llega después del DELETE no se carga", async ({ page }) => {
  test.setTimeout(90_000);
  const urls: string[] = [];
  page.on("request", r => urls.push(`${r.method()} ${new URL(r.url()).pathname}`));
  // El DELETE no llega al servidor: la sesión termina «completa» y el cliente debe ignorarla.
  await page.route("**/api/arena/sesiones/*", r => r.request().method() === "DELETE" ? r.fulfill({ json: { ok: true } }) : r.continue());
  await page.goto("/arena");
  const antes = await page.getByTestId("arena-clock").textContent();
  await boton(page, "Saved matches").click();
  await page.getByTestId("arena-live").getByRole("button", { name: "Generate match", exact: true }).click();
  await expect(page.getByTestId("arena-stop")).toHaveText("Stop match");
  await page.getByTestId("arena-stop").click();
  await expect(page.getByTestId("arena-live-status")).toHaveText("Match cancelled", { timeout: 60_000 });
  await page.waitForTimeout(800);
  expect(urls.filter(u => u.startsWith("DELETE"))).toHaveLength(1);
  expect(urls.filter(u => u.endsWith("/reproduccion"))).toEqual([]);
  await expect(page.getByTestId("arena-clock")).toHaveText(antes!);
});

// ── Bloque C · Modelos que jugaron (§ 5 + v1.1 (10)) ────────────────────────────────────────────────────────────────
type Entrada = { nombre: string; modelo: string; nombrePublico: string };
const catalogo = async () => JSON.parse(await readFile("infra/modelos-arena.json", "utf8")) as Entrada[];
const publico = (c: Entrada[], d: string) => { const n = c.find(e => e.nombre === d); if (n) return n.nombrePublico; const m = c.find(e => e.modelo === d)!; return `${m.nombrePublico} (deployment ${d})`; };

test("060 E8 · modelos por forma sin mock: duelo, ejemplo-v3, archivo importado, grabación sin IA y torneo de ensayo (EN y ES)", async ({ page }) => {
  const c = await catalogo(), modelos = page.getByTestId("arena-models");
  const duelo = JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;
  const dep = (r: RegistroArena, lado: "local" | "visita") => /^azure-openai:([^:]+)/.exec(r.rondas[0]!.decisiones[lado].controlador)![1]!;
  await page.goto("/arena");
  await expect(modelos).toHaveText("Home: Programmed policy · Away: Programmed policy · programmed, no AI");
  await boton(page, "Saved matches").click();
  await boton(page, "Load recorded model duel").click();
  await expect(modelos).toHaveText(`Home: ${publico(c, dep(duelo, "local"))} · Away: ${publico(c, dep(duelo, "visita"))} · declared by the project's archived file, not verified`);
  await expect(modelos).toHaveAttribute("data-procedencia", "declarada");
  await page.getByRole("button", { name: "Switch to Spanish" }).click();
  await expect(modelos).toHaveText(`Local: ${publico(c, dep(duelo, "local"))} · Visita: ${publico(c, dep(duelo, "visita"))} · declarada por el archivo archivado del proyecto, no verificada`);
  await page.getByRole("button", { name: "Cambiar a inglés" }).click();
  const v3 = JSON.parse(await readFile("public/experimentos/arena-llm-v3.json", "utf8")) as RegistroArena;
  await boton(page, "Load AI coaches example").click();
  await expect(modelos).toHaveText(`Home: ${publico(c, dep(v3, "local"))} · Away: ${publico(c, dep(v3, "visita"))} · declared by the project's archived file, not verified`);
  const importada = page.waitForResponse(r => r.url().endsWith("/api/arena") && r.request().method() === "POST");
  await page.getByLabel("Open saved run", { exact: true }).setInputFiles({ name: "duelo.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(duelo)) });
  expect((await importada).ok()).toBe(true);
  await expect(modelos).toHaveText(`Home: ${publico(c, dep(duelo, "local"))} · Away: ${publico(c, dep(duelo, "visita"))} · declared by the file, not verified`);
  await crearGrabacion(page);
  await expect(modelos).toHaveText("Home: Programmed policy · Away: Programmed policy · programmed, no AI");
  await expect(modelos).toHaveAttribute("data-procedencia", "programado");
  await page.goto("/arena?torneo=ensayo-059&encuentro=02&lang=es");
  await expect(page.getByTestId("arena-torneo-origen")).toBeVisible({ timeout: 20_000 });
  await expect(modelos).toHaveText("Local: Ensayo (sin modelo) · Visita: Ensayo (sin modelo) · ensayo: entrenadores programados con nombre de prueba");
  await expect(modelos).toHaveAttribute("data-procedencia", "ensayo");
  expect(await modelos.evaluate(m => m.previousElementSibling?.classList.contains("arena-match-clock"))).toBe(true);
  await expect(modelos).not.toHaveAttribute("role", /.+/);
});

test("060 E8 · sesión del servidor con fixtures (/emision): verificada, incoherente, mixta y sin decisiones", async ({ page }) => {
  const c = await catalogo(), duelo = JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;
  const id = (d: string) => `azure-openai:${d}:reasoning-low`;
  const L = /^azure-openai:([^:]+)/.exec(duelo.rondas[0]!.decisiones.local.controlador)![1]!, V = /^azure-openai:([^:]+)/.exec(duelo.rondas[0]!.decisiones.visita.controlador)![1]!;
  const asignacion = (l: string, v: string) => ({ modo: "manual", local: { id: "l", nombre: publico(c, l), controlador: id(l) }, visita: { id: "v", nombre: publico(c, v), controlador: id(v) } });
  const servir = async (sesion: string, registro: RegistroArena, a: unknown) => page.route(`**/api/arena/sesiones/${sesion}/emision`, r => r.fulfill({ json: { registro, comentarios: [], intervenciones: [], asignacion: a, metricas: { duracionMs: 0, decisiones: 0, respaldos: 0, esperaModeloMs: [] }, estado: "completa", ultimoMensaje: 1 } }));
  const casos: { sesion: string; registro: RegistroArena; a: unknown; texto: string; procedencia: string }[] = [
    { sesion: "00000000-0000-4000-8000-000000006001", registro: duelo, a: asignacion(L, V), texto: `Home: ${publico(c, L)} · Away: ${publico(c, V)} · verified: assigned by this session's server`, procedencia: "verificada" },
    { sesion: "00000000-0000-4000-8000-000000006002", registro: duelo, a: asignacion("cronista-luna6", "cronista-luna6"), texto: `Home: ${publico(c, L)} (assignment and record differ) · Away: ${publico(c, V)} (assignment and record differ) · declared by the file, not verified`, procedencia: "declarada" },
    { sesion: "00000000-0000-4000-8000-000000006003", registro: { ...duelo, rondas: duelo.rondas.map((r, k) => ({ ...r, decisiones: { ...r.decisiones, visita: { ...r.decisiones.visita, controlador: id("otro-dep"), origen: k === 0 ? "respaldo" : r.decisiones.visita.origen } } })) } as RegistroArena, a: asignacion(L, V),
      texto: `Home: ${publico(c, L)} (verified: assigned by this session's server) · Away: deployment otro-dep (not in the catalog) (1 of ${duelo.rondas.length} decisions by programmed fallback) (assignment and record differ) (declared by the file, not verified)`, procedencia: "mixta" },
    { sesion: "00000000-0000-4000-8000-000000006004", registro: { ...duelo, rondas: [] } as RegistroArena, a: asignacion(L, V), texto: `Home: ${publico(c, L)} (no decisions yet) · Away: ${publico(c, V)} (no decisions yet) · verified: assigned by this session's server`, procedencia: "verificada" },
  ];
  for (const k of casos) {
    await servir(k.sesion, k.registro, k.a);
    await page.goto(`/arena?partido=${k.sesion}&vista=buffer`);
    await expect(page.getByTestId("arena-models")).toHaveText(k.texto, { timeout: 20_000 });
    await expect(page.getByTestId("arena-models")).toHaveAttribute("data-procedencia", k.procedencia);
  }
});

test("060 E9 · 360 × 780, oscuro y movimiento reducido: sin desborde, barra a ≤ 32 px de la cancha, botones de ≥ 44 px y modelos visibles", async ({ browser, request }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, colorScheme: "dark", reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await simularVoz(page, { id: await sesionReal(request) });
  await page.goto("/arena");
  const registro = await crearGrabacion(page);
  void registro;
  const medir = () => page.evaluate(() => {
    const cancha = document.querySelector(".arena-pitch-wrap")!.getBoundingClientRect(), barra = document.querySelector(".arena-playback")!.getBoundingClientRect();
    const botones = [...document.querySelectorAll<HTMLElement>(".arena-playback .btn")].filter(b => b.offsetParent).map(b => b.getBoundingClientRect().height);
    const m = document.querySelector('[data-testid="arena-models"]')!.getBoundingClientRect();
    return { ancho: document.documentElement.scrollWidth, hueco: barra.top - cancha.bottom, botones, modelos: { izquierda: m.left, derecha: m.right, alto: m.height } };
  });
  for (const fase of ["inicial", "sonando"]) {
    if (fase === "sonando") { await boton(page, "Play").click(); await expect(boton(page, "Pause")).toBeVisible({ timeout: 30_000 }); }
    const x = await medir();
    expect(x.ancho, fase).toBeLessThanOrEqual(360);
    expect(x.hueco, fase).toBeLessThanOrEqual(32); expect(x.hueco).toBeGreaterThanOrEqual(0);
    for (const h of x.botones) expect(h, fase).toBeGreaterThanOrEqual(44);
    expect(x.modelos.izquierda).toBeGreaterThanOrEqual(0); expect(x.modelos.derecha).toBeLessThanOrEqual(360); expect(x.modelos.alto).toBeGreaterThan(0);
    await page.locator(".arena-board").screenshot({ path: `docs/evidencia/repeticion-060/barra-${fase}-360-oscuro.png` });
  }
  await ctx.close();
  // 1440: también ≤ 32 px.
  const p2 = await browser.newPage();
  await p2.goto("/arena");
  const hueco = await p2.evaluate(() => document.querySelector(".arena-playback")!.getBoundingClientRect().top - document.querySelector(".arena-pitch-wrap")!.getBoundingClientRect().bottom);
  expect(hueco).toBeLessThanOrEqual(32); expect(hueco).toBeGreaterThanOrEqual(0);
  await p2.locator(".arena-board").screenshot({ path: "docs/evidencia/repeticion-060/barra-1440-claro.png" });
  await p2.close();
});
