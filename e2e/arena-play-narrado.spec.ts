// Brief 057 (v1.2) · Bloque A, Reproducir con narración. Rutas y Speech simulados como en
// arena-descargas.spec.ts: `herramientas` → voz; `grabaciones` → `{ id }` de una sesión programada real
// creada con `crearSesion` (el servidor de e2e no tiene ARENA_VOZ); `relato` → `construirRelato` real + WAV
// de silencio por ventana (las piezas de la previa responden 404 y se omiten, como en arena.spec.ts).
// La grabación se crea con «Create recording without AI» (POST real a /api/arena).
import { expect, test, type APIRequestContext, type Page, type Route } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { crearSesion } from "./sesiones";
import { instanteAudio, instanteNarrado, wavMono, type TramoTemporal } from "../src/arena/pista-audio";
import { RELATO_INTERVALOS } from "../src/arena/protocolo";
import { construirRelato } from "../src/arena/relato";
import type { RegistroArena } from "../src/arena/tipos";
import { ARENA } from "../src/sim/limites";

test.describe.configure({ mode: "serial" });

const reloj = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const wav = async (segundos: number) => Buffer.from(await wavMono([new Float32Array(Math.round(segundos * 24000))], 24000).arrayBuffer()).toString("base64");
const barrera = () => { let soltar!: () => void; const p = new Promise<void>(r => { soltar = r; }); return { p, soltar }; };
type Pedido = { desdeTick: number; hastaTick: number; modo: string; idioma: "es" | "en"; intervencion?: string };

let idReal: string | undefined;
/** Una sesión programada real (la misma para todo el archivo): `grabaciones` simulada devuelve su id. */
async function sesionReal(request: APIRequestContext) {
  idReal ??= (await (await crearSesion(request, { seed: 571, segundos: 12, local: "auto", visita: "auto", seleccion: { modo: "programado" }, presentacion: "preparada" })).json() as { id: string }).id;
  return idReal;
}

interface OpcionesVoz {
  voz?: boolean; clipS?: number; id: string;
  /** Respuesta de `grabaciones` (por defecto, `{ id }`); puede retenerse. */
  grabacion?: (r: Route, n: number) => Promise<void>;
  /** Respuesta de un tramo del narrador; por defecto `construirRelato` + WAV. */
  tramo?: (r: Route, p: Pedido, normal: () => Promise<void>) => Promise<void>;
  registro?: RegistroArena;
}
/** Simula voz, registro y relato. Devuelve los cuerpos de `grabaciones` y los pedidos de `relato`. */
async function simularVoz(page: Page, o: OpcionesVoz) {
  const grabaciones: unknown[] = [], relatos: (Pedido & { sesion: string })[] = [];
  let registro: RegistroArena | undefined = o.registro;
  const clip = await wav(o.clipS ?? 1);
  await page.route("**/api/arena/herramientas", r => r.fulfill({ json: { voz: o.voz ?? true, analista: false } }));
  await page.route("**/api/arena/grabaciones", async r => {
    const cuerpo = r.request().postDataJSON() as { registro?: RegistroArena; archivo?: string };
    grabaciones.push(cuerpo);
    if (cuerpo.registro) registro = cuerpo.registro;
    if (cuerpo.archivo === "ejemplo-v3") registro = JSON.parse(await readFile("public/experimentos/arena-llm-v3.json", "utf8")) as RegistroArena;
    if (o.grabacion) return o.grabacion(r, grabaciones.length);
    return r.fulfill({ json: { id: o.id } }).catch(() => {});
  });
  await page.route("**/api/arena/sesiones/*/relato", async r => {
    const p = r.request().postDataJSON() as Pedido;
    if (p.intervencion) return r.fulfill({ status: 404, json: { error: "Sin invitados en esta prueba" } }).catch(() => {});
    relatos.push({ ...p, sesion: r.request().url().split("/sesiones/")[1]!.split("/")[0]! });
    const normal = () => r.fulfill({ json: { ...construirRelato(registro!, p.desdeTick, p.hastaTick, p.modo as "completo", p.idioma), audio: { base64: clip, tipo: "audio/wav" } } }).catch(() => {});
    return o.tramo ? o.tramo(r, p, normal) : normal();
  });
  return { grabaciones, relatos, registro: () => registro! };
}
/** «Saved matches» → 30 s → «Create recording without AI»: devuelve el registro creado por el servidor. */
async function crearGrabacion(page: Page, es = false) {
  await page.getByRole("button", { name: es ? "Partidos guardados" : "Saved matches", exact: true }).click();
  await page.getByRole("combobox", { name: es ? "Duración simulada" : "Simulated duration", exact: true }).selectOption("30");
  const respuesta = page.waitForResponse(r => new URL(r.url()).pathname === "/api/arena" && r.request().method() === "POST");
  await page.getByRole("button", { name: es ? "Crear grabación sin IA" : "Create recording without AI", exact: true }).click();
  const r = await respuesta; expect(r.ok()).toBe(true);
  const registro = await r.json() as RegistroArena;
  await expect(page.getByTestId("arena-clock")).toHaveText(`0:00 / ${reloj(registro.final.tick * ARENA.pasoS)}`);
  return registro;
}
/** Tramos de la pista (la previa se omite): una ventana de RELATO_INTERVALOS.completo por clip de `clipS`. */
const tramosDe = (registro: RegistroArena, clipS: number): TramoTemporal[] => {
  const tramos: TramoTemporal[] = [];
  for (let k = 0, desde = 0; desde < registro.final.tick; k++, desde += RELATO_INTERVALOS.completo) tramos.push({ inicioS: k * clipS, finS: (k + 1) * clipS, desdeTick: desde, hastaTick: Math.min(desde + RELATO_INTERVALOS.completo, registro.final.tick) });
  return tramos;
};
const audio = (page: Page) => page.getByTestId("arena-narration").locator("audio");
const lectura = (page: Page) => page.evaluate(() => {
  const a = document.querySelector<HTMLAudioElement>('[data-testid="arena-narration"] audio')!, s = document.querySelector<HTMLInputElement>("input.arena-seek")!;
  return { t: a.currentTime, pausado: a.paused, src: a.getAttribute("src"), v: Number(s.value), reloj: document.querySelector('[data-testid="arena-clock"]')!.textContent! };
});
const boton = (page: Page, nombre: string) => page.getByRole("button", { name: nombre, exact: true });
async function seMueve(page: Page) {
  const ficha = page.getByTestId("arena-player").nth(5), antes = await ficha.getAttribute("transform");
  await expect.poll(() => ficha.getAttribute("transform")).not.toBe(antes);
}

test("057 · crear grabación sin IA → Reproducir sube el registro, prepara, suena y la cancha sigue a la voz; pausa, búsqueda y volver al inicio", async ({ page, request }) => {
  test.setTimeout(90_000);
  const errores: string[] = []; page.on("pageerror", e => errores.push(e.message));
  const id = await sesionReal(request), clipS = 2;
  const retener = barrera();
  const voz = await simularVoz(page, { id, clipS, tramo: async (_r, _p, normal) => { await retener.p; await normal(); } });
  await page.goto("/arena");
  const registro = await crearGrabacion(page);
  const conmutador = page.getByTestId("arena-play-voice");
  await expect(conmutador).toBeVisible(); await expect(conmutador).toBeChecked();
  await expect(page.getByText("With narration, the audio sets the pace", { exact: false })).toBeVisible();
  await boton(page, "Play").click();
  // Una subida con el registro de la pantalla; progreso junto al botón mientras prepara.
  await expect.poll(() => voz.grabaciones.length).toBe(1);
  expect((voz.grabaciones[0] as { registro: RegistroArena }).registro.final.tick).toBe(registro.final.tick);
  expect(Object.keys(voz.grabaciones[0] as object)).toEqual(["registro"]);
  await expect(page.getByTestId("arena-play-progress")).toHaveText(/^Preparing narration \d+\/\d+$/);
  await expect(page.getByTestId("arena-play-progress")).toHaveAttribute("aria-hidden", "true");
  await expect(boton(page, "Play without narration")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Speed" })).toBeDisabled();
  await page.locator(".arena-board").screenshot({ path: "docs/evidencia/play-narrado-057/barra-preparando-1440-claro.png" });
  retener.soltar();
  await expect(boton(page, "Pause")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("arena-play-progress")).toHaveCount(0);
  await expect.poll(async () => (await lectura(page)).pausado).toBe(false);
  expect(voz.relatos.every(p => p.sesion === id && p.modo === "completo")).toBe(true);
  // Un solo escritor: dos lecturas separadas 1 s, el cursor coincide con instanteNarrado(audio.currentTime) (± 0,3 s).
  const tramos = tramosDe(registro, clipS);
  for (let k = 0; k < 2; k++) {
    if (k) await page.waitForTimeout(1000);
    const l = await lectura(page);
    expect(l.pausado).toBe(false);
    expect(Math.abs(l.v - instanteNarrado(tramos, l.t).tick * ARENA.pasoS), JSON.stringify(l)).toBeLessThanOrEqual(0.3);
    expect(l.reloj.startsWith(reloj(l.v))).toBe(true);
  }
  await page.locator(".arena-board").screenshot({ path: "docs/evidencia/play-narrado-057/barra-sonando-1440-claro.png" });
  // Pausa: el audio se detiene y el cursor no cambia en 300 ms; Reproducir sigue desde el mismo currentTime.
  await boton(page, "Pause").click();
  await expect.poll(async () => (await lectura(page)).pausado).toBe(true);
  const pausa = await lectura(page);
  await page.waitForTimeout(300);
  const quieto = await lectura(page);
  expect(quieto.v).toBe(pausa.v); expect(quieto.t).toBe(pausa.t);
  await expect(boton(page, "Play")).toHaveAttribute("aria-pressed", "false");
  await boton(page, "Play").click();
  await expect(boton(page, "Pause")).toBeVisible();
  const sigue = await lectura(page);
  expect(sigue.t).toBeGreaterThanOrEqual(pausa.t); expect(sigue.t - pausa.t).toBeLessThan(0.5);
  // Deslizador a mitad del partido (en pausa): currentTime = instanteAudio(tramos) y el reloj muestra el tick mapeado (M15).
  await boton(page, "Pause").click();
  await expect.poll(async () => (await lectura(page)).pausado).toBe(true);
  const mitad = registro.final.tick * ARENA.pasoS / 2;
  await page.getByRole("slider", { name: "Match time" }).fill(String(mitad));
  const destino = instanteAudio(tramos, mitad / ARENA.pasoS);
  await expect.poll(async () => Math.abs((await lectura(page)).t - destino)).toBeLessThan(0.01);
  await expect(page.getByTestId("arena-clock")).toHaveText(new RegExp(`^${reloj(instanteNarrado(tramos, destino).tick * ARENA.pasoS)} /`));
  // Volver al inicio: currentTime 0 y 0:00.
  await boton(page, "Restart").click();
  await expect.poll(async () => (await lectura(page)).t).toBe(0);
  await expect(page.getByTestId("arena-clock")).toHaveText(/^0:00 \//);
  expect(voz.grabaciones).toHaveLength(1);
  expect(errores).toEqual([]);
});

test("057 · fin del audio: Reproducir vuelve a sonar desde 0 sin pedir de nuevo la pista", async ({ page, request }) => {
  const id = await sesionReal(request);
  await page.addInitScript(() => { (window as unknown as { reproducciones: number }).reproducciones = 0; document.addEventListener("play", () => { (window as unknown as { reproducciones: number }).reproducciones++; }, true); });
  const voz = await simularVoz(page, { id, clipS: 0.25 });
  await page.goto("/arena");
  const registro = await crearGrabacion(page);
  await boton(page, "Play").click();
  await expect(page.getByTestId("arena-narration").getByRole("status")).toHaveText("End of narration", { timeout: 20_000 });
  await expect(page.getByTestId("arena-clock")).toHaveText(`${reloj(registro.final.tick * ARENA.pasoS)} / ${reloj(registro.final.tick * ARENA.pasoS)}`);
  await expect(boton(page, "Play")).toBeEnabled();
  const pedidos = voz.relatos.length, sonadas = await page.evaluate(() => (window as unknown as { reproducciones: number }).reproducciones);
  expect(sonadas).toBeGreaterThanOrEqual(1);
  await boton(page, "Play").click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { reproducciones: number }).reproducciones)).toBe(sonadas + 1);
  expect(voz.relatos.length).toBe(pedidos);
  expect(voz.grabaciones).toHaveLength(1);
});

test("057 · relato 404: un único re-registro por subida y, si vuelve a fallar, «expired» con reproducción muda (M16)", async ({ page, request }) => {
  const id = await sesionReal(request), otra = "00000000-0000-4000-8000-000000000572";
  const voz = await simularVoz(page, { id, grabacion: (r, n) => r.fulfill({ json: { id: n === 1 ? id : otra } }), tramo: r => r.fulfill({ status: 404, json: { error: "Sesión inexistente o caducada" } }) });
  await page.goto("/arena");
  await crearGrabacion(page);
  await boton(page, "Play").click();
  const aviso = page.getByTestId("arena-play-fallback");
  await expect(aviso).toHaveText("Narration unavailable (the shared session expired); playing without voice.");
  await expect(aviso).toHaveAttribute("role", "status");
  expect(voz.grabaciones).toHaveLength(2);
  expect(voz.grabaciones.every(g => Object.keys(g as object).join() === "registro")).toBe(true);
  expect(new Set(voz.relatos.map(p => p.sesion))).toEqual(new Set([id, otra]));
  await expect(audio(page)).not.toHaveAttribute("src", /blob:/);
  await seMueve(page);
  await expect(boton(page, "Pause")).toBeVisible();
  // Volver a pulsar Reproducir quita el aviso (pausa la muda).
  await boton(page, "Pause").click();
  await expect(aviso).toHaveCount(0);
});

test("057 · ?partido= de una sesión borrada: se re-registra con una sola subida del registro en memoria y suena", async ({ page, request }) => {
  const borrada = await sesionReal(request), nueva = "00000000-0000-4000-8000-000000000573";
  const registro = await (await request.get(`/api/arena/sesiones/${borrada}/registro`)).json() as RegistroArena;
  const voz = await simularVoz(page, { id: nueva, registro, tramo: async (r, p, normal) => {
    // El almacén ya no tiene la sesión compartida: su relato es 404 (como responde el servidor).
    if (r.request().url().includes(borrada)) return r.fulfill({ status: 404, json: { error: "Sesión inexistente o caducada" } });
    expect(p.modo).toBe("completo"); await normal();
  } });
  await page.goto(`/arena?partido=${borrada}`);
  await expect(page.getByTestId("arena-live-status")).toContainText("Match ready", { timeout: 20_000 });
  await expect(page.getByTestId("arena-play-voice")).toBeChecked();
  await boton(page, "Play").click();
  await expect(boton(page, "Pause")).toBeVisible({ timeout: 20_000 });
  expect(voz.grabaciones).toHaveLength(1);
  expect((voz.grabaciones[0] as { registro: RegistroArena }).registro.final).toEqual(registro.final);
  expect(voz.relatos.filter(p => p.sesion === borrada)).toHaveLength(1);
  await expect(page.getByTestId("arena-play-fallback")).toHaveCount(0);
});

test("057 · sin voz (herramientas voz: false): no hay conmutador y Reproducir mueve la cancha como hoy (M17)", async ({ page, request }) => {
  const voz = await simularVoz(page, { id: await sesionReal(request), voz: false });
  await page.goto("/arena");
  await crearGrabacion(page);
  await expect(page.getByTestId("arena-narration")).toContainText("Generate a match to enable its narration.");
  await expect(page.getByTestId("arena-play-voice")).toHaveCount(0);
  await boton(page, "Play").click();
  await seMueve(page);
  await expect(boton(page, "Pause")).toBeVisible();
  expect(voz.grabaciones).toHaveLength(0); expect(voz.relatos).toHaveLength(0);
});

test("057 · conmutador desmarcado: Reproducir no pide grabaciones ni relato", async ({ page, request }) => {
  const voz = await simularVoz(page, { id: await sesionReal(request) });
  await page.goto("/arena");
  await crearGrabacion(page);
  await page.getByTestId("arena-play-voice").uncheck();
  await expect(page.getByText("With narration, the audio sets the pace", { exact: false })).toHaveCount(0);
  await boton(page, "Play").click();
  await seMueve(page);
  await boton(page, "Pause").click();
  await page.waitForTimeout(300);
  expect(voz.grabaciones).toHaveLength(0); expect(voz.relatos).toHaveLength(0);
});

test("057 · ejemplo de entrenadores IA con voz: Reproducir registra { archivo: \"ejemplo-v3\" }, no { registro }", async ({ page, request }) => {
  const voz = await simularVoz(page, { id: await sesionReal(request) });
  await page.goto("/arena");
  await boton(page, "Saved matches").click();
  await boton(page, "Load AI coaches example").click();
  await expect(page.locator(".arena-board > .arena-empty")).toHaveCount(0);
  await expect(page.getByTestId("arena-play-voice")).toBeChecked();
  await boton(page, "Play").click();
  await expect.poll(() => voz.grabaciones.length).toBe(1);
  expect(voz.grabaciones[0]).toEqual({ archivo: "ejemplo-v3" });
  await expect(boton(page, "Pause")).toBeVisible({ timeout: 20_000 });
  await boton(page, "Pause").click();
});

test("057 v1.1 (1) · con la cancha muda en marcha, «Listen from the start» la detiene antes de la primera petición de relato", async ({ page, request }) => {
  const id = await sesionReal(request), retener = barrera();
  let primera!: () => void; const pedida = new Promise<void>(r => { primera = r; });
  await simularVoz(page, { id, tramo: async (_r, _p, normal) => { primera(); await retener.p; await normal(); } });
  await page.goto("/arena");
  await crearGrabacion(page);
  // Registrar (sin pista) y arrancar la cancha muda con el conmutador desmarcado.
  await boton(page, "Enable narration for this recording").click();
  await expect(boton(page, "Listen from the start")).toBeEnabled();
  await page.getByTestId("arena-play-voice").uncheck();
  await boton(page, "Play").click();
  await seMueve(page);
  const ficha = page.getByTestId("arena-player").nth(5);
  await boton(page, "Listen from the start").click();
  const alClic = await ficha.getAttribute("transform");
  await pedida;
  expect(await ficha.getAttribute("transform")).toBe(alClic);
  await page.waitForTimeout(300);
  expect(await ficha.getAttribute("transform")).toBe(alClic);
  await expect(boton(page, "Play without narration")).toBeVisible();
  retener.soltar();
  await expect(boton(page, "Pause")).toBeVisible({ timeout: 20_000 });
});

test("057 v1.1 (1d) · con la pista sonando, desmarcar el conmutador pausa el audio, suelta su URL y deja la cancha quieta", async ({ page, request }) => {
  await simularVoz(page, { id: await sesionReal(request), clipS: 3 });
  await page.goto("/arena");
  await crearGrabacion(page);
  await boton(page, "Play").click();
  await expect(boton(page, "Pause")).toBeVisible({ timeout: 20_000 });
  await expect.poll(async () => (await lectura(page)).pausado).toBe(false);
  await page.getByTestId("arena-play-voice").uncheck();
  await expect(audio(page)).not.toHaveAttribute("src", /blob:/);
  expect((await lectura(page)).pausado).toBe(true);
  const ficha = page.getByTestId("arena-player").nth(5), antes = await ficha.getAttribute("transform"), reloj0 = (await lectura(page)).v;
  await page.waitForTimeout(500);
  expect(await ficha.getAttribute("transform")).toBe(antes);
  expect((await lectura(page)).v).toBe(reloj0);
  await expect(boton(page, "Play")).toBeVisible();
});

test("057 v1.1 (2a) · registro retenido y se carga otro partido: al liberar, ni relato, ni audio, ni aviso", async ({ page, request }) => {
  const retener = barrera();
  const voz = await simularVoz(page, { id: await sesionReal(request), grabacion: async r => { await retener.p; await r.fulfill({ json: { id: idReal } }).catch(() => {}); } });
  await page.goto("/arena");
  await crearGrabacion(page);
  await boton(page, "Play").click();
  await expect(page.getByTestId("arena-play-progress")).toHaveText("Registering the recording…");
  await boton(page, "Create recording without AI").click();
  await expect(page.getByTestId("arena-play-progress")).toHaveCount(0);
  retener.soltar();
  await page.waitForTimeout(1000);
  expect(voz.relatos).toHaveLength(0);
  await expect(audio(page)).not.toHaveAttribute("src", /blob:/);
  await expect(page.getByTestId("arena-play-fallback")).toHaveCount(0);
  await expect(boton(page, "Play")).toBeVisible();
});

test("057 v1.1 (2b) · registro retenido y «Play without narration»: la pista no arranca al liberar y la cancha sigue muda", async ({ page, request }) => {
  const retener = barrera();
  const voz = await simularVoz(page, { id: await sesionReal(request), grabacion: async r => { await retener.p; await r.fulfill({ json: { id: idReal } }).catch(() => {}); } });
  await page.goto("/arena");
  await crearGrabacion(page);
  await boton(page, "Play").click();
  await boton(page, "Play without narration").click();
  await seMueve(page);
  retener.soltar();
  await page.waitForTimeout(1000);
  expect(voz.relatos).toHaveLength(0);
  await expect(audio(page)).not.toHaveAttribute("src", /blob:/);
  await expect(boton(page, "Pause")).toBeVisible();
  await seMueve(page);
});

test("057 v1.2 (2c, N1) · preparación retenida y cambio de idioma: todo se cancela y queda apagado; otra pulsación pide la pista en español", async ({ page, request }) => {
  const retener = barrera();
  // Codex 057 (impl., #1): se cuentan las llamadas a fetch de relato INICIADAS en la página (también las que se
  // abortan antes de llegar a la red), no solo las que recibe la ruta simulada.
  await page.addInitScript(() => {
    const w = window as unknown as { relatoIniciado: string[] }, original = window.fetch;
    w.relatoIniciado = [];
    window.fetch = (entrada, init) => {
      if (String(entrada instanceof Request ? entrada.url : entrada).includes("/relato")) { try { w.relatoIniciado.push((JSON.parse(String(init?.body)) as { idioma: string }).idioma); } catch { w.relatoIniciado.push("?"); } }
      return original(entrada, init);
    };
  });
  const iniciadas = () => page.evaluate(() => (window as unknown as { relatoIniciado: string[] }).relatoIniciado);
  const voz = await simularVoz(page, { id: await sesionReal(request), tramo: async (_r, p, normal) => { if (p.idioma === "en") await retener.p; await normal(); } });
  await page.goto("/arena");
  await crearGrabacion(page);
  await boton(page, "Play").click();
  await expect.poll(() => voz.relatos.length).toBe(1);
  await page.getByRole("button", { name: "Switch to Spanish" }).click();
  // Ninguna petición de relato en el idioma nuevo se inicia por el cambio de idioma (ni siquiera abortada).
  expect((await iniciadas()).filter(i => i === "es")).toEqual([]);
  retener.soltar();
  const narracion = page.getByTestId("arena-narration");
  await expect(narracion.getByRole("status")).toHaveText("Audio desactivado");
  await expect(audio(page)).not.toHaveAttribute("src", /blob:/);
  await expect(narracion.locator("summary")).toHaveCount(0);
  await expect(boton(page, "Reproducir")).toBeEnabled();
  await page.waitForTimeout(500);
  expect(voz.relatos.filter(p => p.idioma === "es")).toHaveLength(0);
  expect((await iniciadas()).filter(i => i === "es")).toEqual([]);
  await boton(page, "Reproducir").click();
  await expect(boton(page, "Pausar")).toBeVisible({ timeout: 20_000 });
  const nuevos = voz.relatos.slice(1);
  expect(nuevos.length).toBeGreaterThan(0);
  expect(nuevos.every(p => p.idioma === "es")).toBe(true);
});

test("057 v1.1 (8) · autoplay bloqueado: fase «pulsar», el botón dice Play y un clic hace sonar la pista", async ({ page, request }) => {
  await page.addInitScript(() => {
    const original = HTMLMediaElement.prototype.play; let primera = true;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) { if (primera) { primera = false; return Promise.reject(new DOMException("Bloqueado", "NotAllowedError")); } return original.call(this); };
  });
  await simularVoz(page, { id: await sesionReal(request), clipS: 2 });
  await page.goto("/arena");
  await crearGrabacion(page);
  await boton(page, "Play").click();
  await expect(page.getByTestId("arena-narration").getByRole("status")).toHaveText("Press play to listen", { timeout: 20_000 });
  await expect(boton(page, "Play")).toBeVisible();
  expect((await lectura(page)).pausado).toBe(true);
  await boton(page, "Play").click();
  await expect(boton(page, "Pause")).toBeVisible();
  await expect.poll(async () => (await lectura(page)).pausado).toBe(false);
});

test("057 v1.1 (8) · error tardío: 200 en dos ventanas y 500 en la tercera → sin pista, aviso y cancha muda", async ({ page, request }) => {
  const voz = await simularVoz(page, { id: await sesionReal(request), tramo: async (r, p, normal) => { if (p.desdeTick >= 2 * RELATO_INTERVALOS.completo) return r.fulfill({ status: 500, json: { error: "Fallo de prueba" } }); await normal(); } });
  await page.goto("/arena");
  await crearGrabacion(page);
  await boton(page, "Play").click();
  await expect(page.getByTestId("arena-play-fallback")).toHaveText("Narration unavailable (network error); playing without voice.", { timeout: 20_000 });
  expect(voz.relatos.map(p => p.desdeTick)).toEqual([0, RELATO_INTERVALOS.completo, 2 * RELATO_INTERVALOS.completo]);
  await expect(audio(page)).not.toHaveAttribute("src", /blob:/);
  await seMueve(page);
});

test("057 · 360 × 780, oscuro y movimiento reducido: sin desborde; escuchar, detener y WAV siguen presentes y el WAV se habilita tras preparar", async ({ browser, request }) => {
  const id = await sesionReal(request);
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, colorScheme: "dark", reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await simularVoz(page, { id, clipS: 3 });
  await page.goto("/arena");
  await crearGrabacion(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  const narracion = page.getByTestId("arena-narration");
  await expect(narracion.getByRole("button", { name: "Download audio (WAV)" })).toBeDisabled();
  await boton(page, "Play").click();
  await expect(page.getByTestId("arena-play-progress")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.locator(".arena-playback").screenshot({ path: "docs/evidencia/play-narrado-057/barra-preparando-360-oscuro.png" }).catch(() => {});
  await expect(boton(page, "Pause")).toBeVisible({ timeout: 20_000 });
  await expect(narracion.getByRole("button", { name: "Listen from the start" })).toBeVisible();
  await expect(narracion.getByRole("button", { name: "Stop narration" })).toBeVisible();
  await expect(narracion.getByRole("button", { name: "Download audio (WAV)" })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.locator(".arena-board").screenshot({ path: "docs/evidencia/play-narrado-057/barra-sonando-360-oscuro.png" });
  await ctx.close();
});

/** Codex 057 (impl., #2) · play() retenido: la prueba decide cuándo resuelve o rechaza cada llamada. `ok` llama
 * al play real; `solo-resolver` resuelve sin reproducir; `rechazar` rechaza con NotAllowedError. */
async function playRetenido(page: Page) {
  await page.addInitScript(() => {
    type Pendiente = { el: HTMLMediaElement; res: () => void; rej: (e: unknown) => void };
    const w = window as unknown as { plays: Pendiente[]; soltar: (i: number, modo: string) => void }, original = HTMLMediaElement.prototype.play;
    w.plays = [];
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) { return new Promise<void>((res, rej) => { w.plays.push({ el: this, res, rej }); }); };
    w.soltar = (i, modo) => { const p = w.plays[i]!; if (modo === "ok") original.call(p.el).then(p.res, p.rej); else if (modo === "solo-resolver") p.res(); else p.rej(new DOMException("Bloqueado", "NotAllowedError")); };
  });
  return {
    pedidos: () => page.evaluate(() => (window as unknown as { plays: unknown[] }).plays.length),
    soltar: (i: number, modo: "ok" | "solo-resolver" | "rechazar") => page.evaluate(([i, modo]) => (window as unknown as { soltar: (i: number, m: string) => void }).soltar(i as number, modo as string), [i, modo] as const),
  };
}
const estadoVoz = (page: Page) => page.getByTestId("arena-narration").getByRole("status");

test("Codex 057 #2 · play() retenido y detener: el rechazo tardío no pone «Press play to listen»", async ({ page, request }) => {
  const play = await playRetenido(page);
  await simularVoz(page, { id: await sesionReal(request), clipS: 2 });
  await page.goto("/arena");
  await crearGrabacion(page);
  await boton(page, "Play").click();
  await expect.poll(play.pedidos, { timeout: 20_000 }).toBe(1);
  await page.getByTestId("arena-play-voice").uncheck();
  await expect(estadoVoz(page)).toHaveText("Audio off");
  await play.soltar(0, "rechazar");
  await page.waitForTimeout(400);
  await expect(estadoVoz(page)).toHaveText("Audio off");
});

test("Codex 057 #2 · play() retenido y otra carga: el rechazo tardío se descarta", async ({ page, request }) => {
  const play = await playRetenido(page);
  await simularVoz(page, { id: await sesionReal(request), clipS: 2 });
  await page.goto("/arena");
  await crearGrabacion(page);
  await boton(page, "Play").click();
  await expect.poll(play.pedidos, { timeout: 20_000 }).toBe(1);
  const respuesta = page.waitForResponse(r => new URL(r.url()).pathname === "/api/arena" && r.request().method() === "POST");
  await boton(page, "Create recording without AI").click();
  expect((await respuesta).ok()).toBe(true);
  await expect(estadoVoz(page)).toHaveText("Audio off");
  await play.soltar(0, "rechazar");
  await page.waitForTimeout(400);
  await expect(estadoVoz(page)).toHaveText("Audio off");
  await expect(boton(page, "Play")).toBeVisible();
});

test("Codex 057 #2 · reiniciar la pista antes de que resuelva el play() anterior: su rechazo no pisa la reproducción nueva", async ({ page, request }) => {
  const play = await playRetenido(page);
  await simularVoz(page, { id: await sesionReal(request), clipS: 2 });
  await page.goto("/arena");
  await crearGrabacion(page);
  await boton(page, "Play").click();
  await expect.poll(play.pedidos, { timeout: 20_000 }).toBe(1);
  const conmutador = page.getByTestId("arena-play-voice");
  await conmutador.uncheck(); await conmutador.check();
  await boton(page, "Play").click();
  await expect.poll(play.pedidos).toBe(2);
  await expect(estadoVoz(page)).toHaveText("Narration playing");
  await play.soltar(0, "rechazar");
  await page.waitForTimeout(400);
  await expect(estadoVoz(page)).toHaveText("Narration playing");
  await play.soltar(1, "ok");
  await expect(boton(page, "Pause")).toBeVisible();
  await expect.poll(async () => (await lectura(page)).pausado).toBe(false);
});

test("Codex 057 #2 · reanudar con play() retenido y detener: su resolución tardía no anuncia «Narration playing»", async ({ page, request }) => {
  const play = await playRetenido(page);
  await simularVoz(page, { id: await sesionReal(request), clipS: 3 });
  await page.goto("/arena");
  await crearGrabacion(page);
  await boton(page, "Play").click();
  await expect.poll(play.pedidos, { timeout: 20_000 }).toBe(1);
  await play.soltar(0, "ok");
  await expect(boton(page, "Pause")).toBeVisible();
  await boton(page, "Pause").click();
  await expect(boton(page, "Play")).toBeVisible();
  await boton(page, "Play").click();
  await expect.poll(play.pedidos).toBe(2);
  await page.getByTestId("arena-play-voice").uncheck();
  await expect(estadoVoz(page)).toHaveText("Audio off");
  await play.soltar(1, "solo-resolver");
  await page.waitForTimeout(400);
  await expect(estadoVoz(page)).toHaveText("Audio off");
});

// Brief 057 v1.3 (4) · Subida con 429, error del servidor, play nativo en «pulsar» y Reproducir desde el cursor.
test("v1.3 · subida con 429 y retry-after: 2 una vez: reintenta una sola vez y suena", async ({ page, request }) => {
  const id = await sesionReal(request);
  const voz = await simularVoz(page, { id, grabacion: (r, n) => n === 1 ? r.fulfill({ status: 429, headers: { "retry-after": "2" }, json: { error: "Hay otra subida en curso" } }) : r.fulfill({ json: { id } }) });
  await page.goto("/arena");
  await crearGrabacion(page);
  await boton(page, "Play").click();
  await expect(boton(page, "Pause")).toBeVisible({ timeout: 20_000 });
  expect(voz.grabaciones).toHaveLength(2);
  await expect(page.getByTestId("arena-play-fallback")).toHaveCount(0);
});

test("v1.3 · subida con 429 y retry-after: 3600: degrada al momento («ocupado») sin esperar ni reintentar", async ({ page, request }) => {
  const voz = await simularVoz(page, { id: await sesionReal(request), grabacion: r => r.fulfill({ status: 429, headers: { "retry-after": "3600" }, json: { error: "Demasiadas subidas; espera un momento" } }) });
  await page.goto("/arena");
  await crearGrabacion(page);
  await boton(page, "Play").click();
  await expect(page.getByTestId("arena-play-fallback")).toHaveText("Too many uploaded recordings; narration returns in 60 min. Playing without voice.", { timeout: 3000 });
  expect(voz.grabaciones).toHaveLength(1);
  await seMueve(page);
  await page.getByRole("button", { name: "Switch to Spanish" }).click();
  await expect(page.getByTestId("arena-play-fallback")).toHaveText("Demasiadas grabaciones subidas; la narración vuelve en 60 min. Reproduciendo sin voz.");
});

test("v1.3 · subida con 500: «sin-sesion» y reproducción muda", async ({ page, request }) => {
  const voz = await simularVoz(page, { id: await sesionReal(request), grabacion: r => r.fulfill({ status: 500, json: { error: "Fallo de prueba" } }) });
  await page.goto("/arena");
  await crearGrabacion(page);
  await boton(page, "Play").click();
  await expect(page.getByTestId("arena-play-fallback")).toHaveText("Narration unavailable (the recording could not be registered); playing without voice.");
  expect(voz.grabaciones).toHaveLength(1); expect(voz.relatos).toHaveLength(0);
  await seMueve(page);
});

test("v1.3 · «pulsar» y play con el control nativo del audio: la barra pasa a Pausa", async ({ page, request }) => {
  await page.addInitScript(() => {
    const original = HTMLMediaElement.prototype.play; let primera = true;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) { if (primera) { primera = false; return Promise.reject(new DOMException("Bloqueado", "NotAllowedError")); } return original.call(this); };
  });
  await simularVoz(page, { id: await sesionReal(request), clipS: 2 });
  await page.goto("/arena");
  await crearGrabacion(page);
  await boton(page, "Play").click();
  await expect(page.getByTestId("arena-narration").getByRole("status")).toHaveText("Press play to listen", { timeout: 20_000 });
  // El espectador usa el control del propio <audio> (no la barra).
  await audio(page).evaluate((a: HTMLAudioElement) => a.play());
  await expect(boton(page, "Pause")).toBeVisible();
  await expect(page.getByTestId("arena-narration").getByRole("status")).toHaveText("Narration playing");
});

test("v1.3 · Reproducir desde el cursor en 0:15: la pista empieza ahí (reloj ≥ 0:14)", async ({ page, request }) => {
  await simularVoz(page, { id: await sesionReal(request), clipS: 2 });
  await page.goto("/arena");
  await crearGrabacion(page);
  await page.getByRole("slider", { name: "Match time" }).fill("15");
  await expect(page.getByTestId("arena-clock")).toHaveText(/^0:15 \//);
  await boton(page, "Play").click();
  await expect(boton(page, "Pause")).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(300);
  const segundos = (texto: string) => { const [m, s] = texto.split(" / ")[0]!.split(":").map(Number); return m! * 60 + s!; };
  expect(segundos(await page.getByTestId("arena-clock").textContent() ?? "")).toBeGreaterThanOrEqual(14);
  expect((await lectura(page)).t).toBeGreaterThan(0);
});
