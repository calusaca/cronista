import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.argv[2] ?? "https://cronista-arena.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io";
const carpeta = "docs/evidencia/variedad-narracion"; await mkdir(carpeta, { recursive: true });
const navegador = await chromium.launch({ headless: true });
const page = await navegador.newPage({ viewport: { width: 1440, height: 1000 } });
const errores = [], solicitudes = []; let id, liberar;
const barrera = new Promise(r => { liberar = r; });
try {
  await page.addInitScript(() => {
    window.pruebaContinuidad = { fuentes: [], reinicios: [], transcripciones: [], contextos: 0 };
    const Base = window.AudioContext;
    window.AudioContext = class extends Base {
      constructor(opciones) { super(opciones); window.pruebaContinuidad.contextos++; }
      createBufferSource() {
        const fuente = super.createBufferSource(), iniciar = fuente.start.bind(fuente), detener = fuente.stop.bind(fuente);
        const dato = { inicio: 0, fin: 0, duracion: 0, audible: false, velocidad: 0, voz: [] };
        fuente.start = (cuando = 0) => {
          dato.inicio = performance.now() + Math.max(0, cuando - this.currentTime) * 1000;
          dato.duracion = fuente.buffer.duration; dato.fin = dato.inicio + dato.duracion * 1000;
          const pcm = fuente.buffer.getChannelData(0), salto = Math.round(fuente.buffer.sampleRate * .02);
          for (let desde = 0; desde < pcm.length; desde += salto) {
            if (pcm.subarray(desde, desde + salto).some(v => Math.abs(v) > .001)) {
              const inicio = dato.inicio + desde / fuente.buffer.sampleRate * 1000;
              const fin = dato.inicio + Math.min(desde + salto, pcm.length) / fuente.buffer.sampleRate * 1000;
              const previo = dato.voz.at(-1);
              if (previo && inicio - previo[1] < 1) previo[1] = fin; else dato.voz.push([inicio, fin]);
            }
          }
          dato.audible = dato.voz.length > 0;
          dato.velocidad = fuente.playbackRate.value; window.pruebaContinuidad.fuentes.push(dato); iniciar(cuando);
        };
        fuente.stop = (cuando = 0) => { dato.fin = Math.min(dato.fin, performance.now() + Math.max(0, cuando - this.currentTime) * 1000); detener(cuando); };
        fuente.addEventListener("ended", () => { dato.fin = Math.min(dato.fin, performance.now()); });
        return fuente;
      }
    };
    document.addEventListener("DOMContentLoaded", () => {
      let previo = "", pasaje = "";
      new MutationObserver(() => {
        const saque = document.querySelector('[data-testid="arena-restart"]')?.textContent ?? "";
        if (saque && saque !== previo) window.pruebaContinuidad.reinicios.push({ texto: saque, reloj: document.querySelector('[data-testid="arena-clock"]')?.textContent });
        previo = saque;
        const el = document.querySelector('[data-testid="arena-voice-transcript"]');
        const tick = el?.getAttribute("data-narration-tick");
        if (tick && tick !== pasaje) window.pruebaContinuidad.transcripciones.push({ tick: Number(tick), instante: performance.now(), tipo: el.getAttribute("data-narration-kind"), texto: el.textContent, reloj: document.querySelector('[data-testid="arena-clock"]')?.textContent });
        pasaje = tick;
      }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["data-narration-tick"] });
    });
  });
  page.on("pageerror", e => errores.push(e.message));
  const modelos = page.waitForResponse(r => r.url().endsWith("/api/arena/modelos"));
  await page.goto(`${base}/arena`);
  await modelos;
  await page.getByRole("combobox", { name: "Controller selection" }).selectOption("programado");
  await page.getByText("Reproduce a specific match (advanced)", { exact: true }).click();
  // Saque inicial v2; esta semilla marca a los 27,5 s con decisiones cada 30 s.
  await page.getByLabel("Match seed (optional)", { exact: true }).fill("6");
  const creada = page.waitForResponse(r => r.url().endsWith("/api/arena/sesiones") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Start live match", exact: true }).click();
  const respuesta = await creada; expect(respuesta.status()).toBe(201); const sesion = await respuesta.json(); id = sesion.id;
  expect(sesion.asignacion.modo).toBe("programado");
  expect(respuesta.request().postDataJSON().seed).toBe(6);
  await expect(page.getByTestId("arena-buffer-status")).toContainText("Live", { timeout: 30000 });
  const inicial = (await (await page.request.get(`${base}/api/arena/sesiones/${id}/emision`)).json()).registro;
  expect(inicial.config.reglas).toBe("reinicios-v2");
  expect(inicial.inicial.balon.posicion).toEqual({ x: 52.5, y: 34 });
  expect(inicial.eventos.find(e => e.tipo === "reinicio" && e.tick === 0)).toMatchObject({ reinicio: "centro" });
  await page.route(`**/api/arena/sesiones/${id}/relato`, async ruta => {
    const p = ruta.request().postDataJSON(), dato = { desdeTick: p.desdeTick, hastaTick: p.hastaTick, cierre: !!p.cierre, entradaTick: p.entradaTick, memoria: p.memoria ?? [] }; solicitudes.push(dato);
    await barrera;
    try {
      const r = await ruta.fetch({ timeout: 25000 }), cuerpo = await r.json();
      dato.estado = r.status(); dato.tipoRelato = cuerpo.tipoRelato; dato.tick = cuerpo.fragmentos?.[0]?.tick; dato.texto = cuerpo.texto; dato.temaVoz = cuerpo.temaVoz; dato.claveVoz = cuerpo.claveVoz; dato.caracteres = cuerpo.audio?.caracteres ?? 0;
      await ruta.fulfill({ response: r });
    } catch { await ruta.abort().catch(() => {}); }
  });
  const inicio = await page.evaluate(() => performance.now());
  await page.getByRole("button", { name: "Enable narration", exact: true }).click();
  await expect(page.getByTestId("arena-voice-status")).toHaveText("Narration playing", { timeout: 5000 });
  await page.waitForTimeout(8500); liberar();
  await expect.poll(() => solicitudes.some(s => s.estado === 200 && s.caracteres > 0), { timeout: 20000 }).toBe(true);
  const apagado = await page.evaluate(() => performance.now());
  await page.getByRole("button", { name: "Turn narration off", exact: true }).click();
  const fuentesApagado = await page.evaluate(() => window.pruebaContinuidad.fuentes.length);
  await page.waitForTimeout(4000);
  expect(await page.evaluate(() => window.pruebaContinuidad.fuentes.length)).toBe(fuentesApagado);
  const reactivado = await page.evaluate(() => performance.now());
  const tiempoReactivado = (await page.getByTestId("arena-clock").textContent()).split(" / ")[0].split(":").map(Number);
  const minimoTick = (tiempoReactivado[0] * 60 + tiempoReactivado[1]) * 10;
  await page.getByRole("button", { name: "Enable narration", exact: true }).click();
  await expect.poll(() => solicitudes.filter(s => s.entradaTick !== undefined).length, { timeout: 15000 }).toBe(2);
  await expect.poll(() => page.evaluate(() => window.pruebaContinuidad.reinicios.some(r => r.texto.includes("Kick-off") && !r.reloj.startsWith("0:00"))), { timeout: 30000 }).toBe(true);
  expect(await page.evaluate(() => window.pruebaContinuidad.contextos)).toBe(1);
  const voz = await page.evaluate(({ inicio, apagado, reactivado }) => {
    const datos = window.pruebaContinuidad, ahora = performance.now(); let maxSilencioMs = 0;
    const voz = datos.fuentes.flatMap(f => f.voz.map(([a, b]) => [a, Math.min(b, f.fin, ahora)]).filter(([a, b]) => b > a)).sort((a, b) => a[0] - b[0]);
    const ventanas = [[inicio, apagado], [reactivado, ahora]];
    for (const [desde, hasta] of ventanas) {
      let fin = desde;
      for (const [a, b] of voz.filter(([a, b]) => b > desde && a < hasta)) { maxSilencioMs = Math.max(maxSilencioMs, Math.max(desde, a) - fin); fin = Math.max(fin, Math.min(b, hasta)); }
      maxSilencioMs = Math.max(maxSilencioMs, hasta - fin);
    }
    return { ...datos, ventanasAudibles: ventanas, maxSilencioMs, duracionObservadaMs: ahora - inicio, medicion: "PCM absoluto > 0.001 en bloques de 20 ms; incluye pausas internas y truncamientos" };
  }, { inicio, apagado, reactivado });
  expect(voz.maxSilencioMs).toBeLessThanOrEqual(5000);
  expect(solicitudes.some(s => s.memoria.length > 0)).toBe(true);
  expect(new Set(voz.transcripciones.map(t => t.texto)).size).toBe(voz.transcripciones.length);
  expect(voz.fuentes.length).toBeGreaterThan(2); expect(voz.fuentes.every(f => f.audible && f.velocidad === 1)).toBe(true);
  expect(voz.transcripciones.some(t => ["entrada", "jugada", "estado"].includes(t.tipo) && t.instante >= reactivado)).toBe(true);
  for (const t of voz.transcripciones) {
    const [m, s] = t.reloj.split(" / ")[0].split(":").map(Number);
    expect(t.tick).toBeLessThan((m * 60 + s + 1) * 10 + 1);
    expect((m * 60 + s) * 10 - t.tick).toBeLessThanOrEqual(30);
    if (t.instante >= reactivado) expect(t.tick).toBeGreaterThanOrEqual(minimoTick);
  }
  await page.getByRole("button", { name: "Turn narration off", exact: true }).click();
  await page.getByRole("button", { name: "Pause broadcast", exact: true }).click();
  await page.locator("#arena-watch").evaluate(e => e.scrollIntoView({ block: "start" }));
  await page.screenshot({ path: `${carpeta}/publico-escritorio.png` });
  await page.setViewportSize({ width: 360, height: 780 });
  await page.getByRole("button", { name: "Switch to Spanish" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.getByTestId("arena-buffer").screenshot({ path: `${carpeta}/publico-voz-movil.png` });
  const muestras = [];
  for (const seed of [3, 4, 5, 6]) {
    const respuesta = await page.request.post(`${base}/api/arena`, { data: { accion: "simular", seed, segundos: 60, local: "auto", visita: "auto" } });
    expect(respuesta.ok()).toBe(true); const r = await respuesta.json();
    expect(r.config.reglas).toBe("reinicios-v2");
    for (const e of r.eventos.filter(e => e.tipo === "reinicio" && e.reinicio)) muestras.push({ seed, tick: e.tick, tipo: e.reinicio, lado: e.lado });
    for (const e of r.eventos.filter(e => e.tipo === "gol")) {
      const lado = e.lado === "local" ? "visita" : "local";
      expect(r.eventos.find(s => s.tipo === "reinicio" && s.tick === e.tick)).toMatchObject({ reinicio: "centro", lado, hasta: { x: 52.5, y: 34 } });
      expect(r.fotogramas.find(f => f.tick === e.tick).balon.posicion).toEqual({ x: 52.5, y: 34 });
      const pase = r.eventos.find(p => p.tipo === "pase" && p.reinicio === "centro" && p.tick > e.tick);
      if (pase) expect(pase).toMatchObject({ lado, desde: { x: 52.5, y: 34 } });
    }
  }
  expect(new Set(muestras.map(e => e.tipo))).toEqual(new Set(["banda", "centro", "esquina", "meta"])); expect(errores).toEqual([]);
  await writeFile(`${carpeta}/navegador-publico.json`, JSON.stringify({ checkedUtc: new Date().toISOString(), phase: "passed", url: `${base}/arena`, sesion: id, seed: 6, intervaloDecisionesS: 30, balonInicial: inicial.inicial.balon.posicion, reactivacionTickMinimo: minimoTick, contextoReutilizado: true, voz, solicitudes, reiniciosServidor: muestras, modelosLlm: 0, speechReal: true, javascriptErrors: errores, mobileWidth: 360, horizontalOverflow: false }, null, 2) + "\n");
  console.log(JSON.stringify({ phase: "passed", maxSilencioMs: voz.maxSilencioMs, fuentesAudibles: voz.fuentes.length, evidencia: `${carpeta}/navegador-publico.json` }));
} catch (error) {
  await writeFile(".cache/variedad-publico-fallo.json", JSON.stringify({ checkedUtc: new Date().toISOString(), id, error: String(error), solicitudes, voz: await page.evaluate(() => window.pruebaContinuidad).catch(() => null), reloj: await page.getByTestId("arena-clock").textContent().catch(() => null) }, null, 2));
  throw error;
} finally { liberar(); if (id) await page.request.delete(`${base}/api/arena/sesiones/${id}`).catch(() => {}); await navegador.close(); }
