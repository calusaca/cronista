import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.argv[2] ?? "https://cronista-arena.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io";
const carpeta = "docs/evidencia/reinicios-y-voz"; await mkdir(carpeta, { recursive: true });
const navegador = await chromium.launch({ headless: true });
const page = await navegador.newPage({ viewport: { width: 1440, height: 1000 } });
const errores = [], solicitudes = []; let id, liberar;
const barrera = new Promise(r => { liberar = r; });
try {
  await page.addInitScript(() => {
    window.pruebaContinuidad = { fuentes: [], reinicios: [], transcripciones: [] };
    const Base = window.AudioContext;
    window.AudioContext = class extends Base {
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
        if (tick && tick !== pasaje) window.pruebaContinuidad.transcripciones.push({ tick: Number(tick), texto: el.textContent, reloj: document.querySelector('[data-testid="arena-clock"]')?.textContent });
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
  // Las sesiones revisan planes cada 30 s. Esta semilla produce esquina a 8 s
  // y gol a 21,7 s con ese intervalo, diferente del corpus de intervalos de 15 s.
  await page.getByLabel("Match seed (optional)", { exact: true }).fill("7");
  const creada = page.waitForResponse(r => r.url().endsWith("/api/arena/sesiones") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Start live match", exact: true }).click();
  const respuesta = await creada; expect(respuesta.status()).toBe(201); const sesion = await respuesta.json(); id = sesion.id;
  expect(sesion.asignacion.modo).toBe("programado");
  expect(respuesta.request().postDataJSON().seed).toBe(7);
  await expect(page.getByTestId("arena-buffer-status")).toContainText("Live", { timeout: 30000 });
  await page.route(`**/api/arena/sesiones/${id}/relato`, async ruta => {
    const p = ruta.request().postDataJSON(), dato = { desdeTick: p.desdeTick, hastaTick: p.hastaTick, cierre: !!p.cierre }; solicitudes.push(dato);
    await barrera;
    try {
      const r = await ruta.fetch({ timeout: 25000 }), cuerpo = await r.json();
      dato.estado = r.status(); dato.texto = cuerpo.texto; dato.caracteres = cuerpo.audio?.caracteres ?? 0;
      await ruta.fulfill({ response: r });
    } catch { await ruta.abort().catch(() => {}); }
  });
  const inicio = await page.evaluate(() => performance.now());
  await page.getByRole("button", { name: "Enable narration", exact: true }).click();
  await expect(page.getByTestId("arena-voice-status")).toHaveText("Narration playing", { timeout: 5000 });
  await page.waitForTimeout(8500); liberar();
  await expect.poll(() => solicitudes.some(s => s.estado === 200 && s.caracteres > 0), { timeout: 20000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => window.pruebaContinuidad.reinicios.some(r => r.texto.includes("Kick-off"))), { timeout: 25000 }).toBe(true);
  const voz = await page.evaluate(inicio => {
    const datos = window.pruebaContinuidad, ahora = performance.now(); let fin = inicio, maxSilencioMs = 0;
    const voz = datos.fuentes.flatMap(f => f.voz.map(([a, b]) => [a, Math.min(b, f.fin, ahora)]).filter(([a, b]) => b > a)).sort((a, b) => a[0] - b[0]);
    for (const [a, b] of voz) { maxSilencioMs = Math.max(maxSilencioMs, a - fin); fin = Math.max(fin, b); }
    maxSilencioMs = Math.max(maxSilencioMs, ahora - fin);
    return { ...datos, maxSilencioMs, duracionObservadaMs: ahora - inicio, medicion: "PCM absoluto > 0.001 en bloques de 20 ms; incluye pausas internas y truncamientos" };
  }, inicio);
  expect(voz.maxSilencioMs).toBeLessThanOrEqual(5000);
  expect(voz.fuentes.length).toBeGreaterThan(2); expect(voz.fuentes.every(f => f.audible && f.velocidad === 1)).toBe(true);
  expect(voz.reinicios.some(r => r.texto.includes("Corner kick"))).toBe(true);
  for (const t of voz.transcripciones) {
    const [m, s] = t.reloj.split(" / ")[0].split(":").map(Number);
    expect(t.tick).toBeLessThan((m * 60 + s + 1) * 10 + 1);
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
  for (const seed of [1, 2, 6]) {
    const respuesta = await page.request.post(`${base}/api/arena`, { data: { accion: "simular", seed, segundos: 60, local: "auto", visita: "auto" } });
    expect(respuesta.ok()).toBe(true); const r = await respuesta.json();
    expect(r.config.reglas).toBe("reinicios-v1");
    for (const e of r.eventos.filter(e => e.tipo === "reinicio" && e.reinicio)) muestras.push({ seed, tick: e.tick, tipo: e.reinicio, lado: e.lado });
    for (const e of r.eventos.filter(e => e.tipo === "gol")) expect(r.eventos.find(s => s.tipo === "reinicio" && s.tick === e.tick)).toMatchObject({ reinicio: "centro", lado: e.lado === "local" ? "visita" : "local" });
  }
  expect(new Set(muestras.map(e => e.tipo))).toEqual(new Set(["banda", "centro", "esquina", "meta"])); expect(errores).toEqual([]);
  await writeFile(`${carpeta}/navegador-publico.json`, JSON.stringify({ checkedUtc: new Date().toISOString(), phase: "passed", url: `${base}/arena`, sesion: id, seed: 7, intervaloDecisionesS: 30, voz, solicitudes, reiniciosServidor: muestras, modelosLlm: 0, speechReal: true, javascriptErrors: errores, mobileWidth: 360, horizontalOverflow: false }, null, 2) + "\n");
  console.log(JSON.stringify({ phase: "passed", maxSilencioMs: voz.maxSilencioMs, fuentesAudibles: voz.fuentes.length, evidencia: `${carpeta}/navegador-publico.json` }));
} catch (error) {
  await writeFile(".cache/reinicios-publico-fallo.json", JSON.stringify({ checkedUtc: new Date().toISOString(), id, error: String(error), solicitudes, voz: await page.evaluate(() => window.pruebaContinuidad).catch(() => null), reloj: await page.getByTestId("arena-clock").textContent().catch(() => null) }, null, 2));
  throw error;
} finally { liberar(); if (id) await page.request.delete(`${base}/api/arena/sesiones/${id}`).catch(() => {}); await navegador.close(); }
