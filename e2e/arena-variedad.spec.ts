import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { wavMono } from "../src/arena/pista-audio";
import type { RegistroArena } from "../src/arena/tipos";
import type { RecuerdoVoz } from "../src/arena/editorial";

test("voz: recuerda lo reproducido y descarta ideas duplicadas preparadas antes de oírlas", async ({ page }, testInfo) => {
  const registro = JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;
  const id = "00000000-0000-4000-8000-000000000053";
  const audio = Buffer.from(await wavMono([new Float32Array(7200)], 24000).arrayBuffer()).toString("base64");
  await page.route(`**/api/arena/sesiones/${id}/emision`, r => r.fulfill({ json: { registro, comentarios: [], asignacion: { modo: "programado", local: { nombre: "Local" }, visita: { nombre: "Visita" } }, metricas: {}, estado: "finalizada", ultimoMensaje: 1 } }));
  await page.route("**/api/arena/herramientas", r => r.fulfill({ json: { voz: true, analista: false } }));
  await page.addInitScript(() => {
    const escuchado: { tick: number; texto: string }[] = [];
    (window as unknown as { variedad: typeof escuchado }).variedad = escuchado;
    document.addEventListener("DOMContentLoaded", () => {
      let previo = "";
      new MutationObserver(() => {
        const el = document.querySelector('[data-testid="arena-voice-transcript"]');
        const tick = el?.getAttribute("data-narration-tick"), texto = el?.querySelector("p")?.textContent;
        if (tick && texto && `${tick}:${texto}` !== previo) { escuchado.push({ tick: Number(tick), texto }); previo = `${tick}:${texto}`; }
      }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["data-narration-tick"] });
    });
  });
  const peticiones: { desdeTick: number; hastaTick: number; entradaTick?: number; memoria: RecuerdoVoz[] }[] = [];
  await page.route(`**/api/arena/sesiones/${id}/relato`, ruta => {
    const p = ruta.request().postDataJSON(); peticiones.push(p);
    const entrada = p.entradaTick !== undefined, texto = entrada ? "Current match entry." : "One confirmed passing sequence.";
    const tick = p.entradaTick ?? p.hastaTick;
    return ruta.fulfill({ json: { ...p, texto, tipoRelato: entrada ? "entrada" : "comentario", claveVoz: entrada ? "entrada" : "secuencia:compartida", temaVoz: entrada ? "entrada" : "secuencia", prioridad: 10,
      fragmentos: [{ tick, texto, emocion: "serena", intensidad: .2, variante: 0, fuentes: [], fotogramas: [] }], fuentes: [], fotogramas: [], eventosDisponibles: 0, eventosNarrados: 0, conduccionesNarradas: 0, audio: { base64: audio, tipo: "audio/wav" } } });
  });
  await page.goto(`/arena?partido=${id}&vista=buffer`);
  await page.getByRole("button", { name: "Enable narration", exact: true }).click();
  // Al incorporarse a un registro completo se entra veinte segundos antes del final.
  await expect(page.getByTestId("arena-clock")).toHaveText("0:52 / 1:00", { timeout: 20000 });
  await page.getByRole("button", { name: "Turn narration off", exact: true }).click();
  await page.getByRole("button", { name: "Enable narration", exact: true }).click();
  await expect(page.getByTestId("arena-clock")).toHaveText("0:58 / 1:00", { timeout: 10000 });
  const escuchado = await page.evaluate(() => (window as unknown as { variedad: { tick: number; texto: string }[] }).variedad);
  expect(escuchado.filter(e => e.texto === "One confirmed passing sequence.")).toHaveLength(1);
  expect(peticiones.filter(p => p.memoria.some(m => m.texto === "One confirmed passing sequence.")).length).toBeGreaterThan(0);
  expect(peticiones[0]!.memoria).toEqual([]);
  for (const p of peticiones) for (const m of p.memoria) expect(escuchado.some(e => e.texto === m.texto)).toBe(true);
  await testInfo.attach("memoria-voz.json", { body: JSON.stringify({ escuchado, peticiones }, null, 2), contentType: "application/json" });
});

test("voz: Speech fallido mantiene comentarios audibles distintos durante cuarenta segundos", async ({ page }, testInfo) => {
  const original = JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;
  const registro = { ...original, final: original.fotogramas.find(f => f.tick === 200), fotogramas: original.fotogramas.filter(f => f.tick <= 200), eventos: original.eventos.filter(e => e.tick <= 200), rondas: [] };
  const id = "00000000-0000-4000-8000-000000000054";
  await page.route(`**/api/arena/sesiones/${id}/emision`, r => r.fulfill({ json: { registro, comentarios: [], asignacion: { modo: "programado", local: { nombre: "Local" }, visita: { nombre: "Visita" } }, metricas: {}, estado: "ejecutando", ultimoMensaje: 1 } }));
  await page.route(`**/api/arena/sesiones/${id}/eventos*`, r => r.fulfill({ headers: { "content-type": "text/event-stream" }, body: ": keepalive\n\n" }));
  await page.route("**/api/arena/herramientas", r => r.fulfill({ json: { voz: true, analista: false } }));
  await page.route(`**/api/arena/sesiones/${id}/relato`, r => r.fulfill({ status: 503, json: { error: "Speech fallido en esta prueba" } }));
  await page.addInitScript(() => {
    const fuentes: { inicio: number; fin: number; voz: number[][]; texto: string }[] = [];
    (window as unknown as { respaldo: typeof fuentes }).respaldo = fuentes;
    const Base = window.AudioContext;
    window.AudioContext = class extends Base {
      override createBufferSource() {
        const fuente = super.createBufferSource(), iniciar = fuente.start.bind(fuente);
        fuente.start = (cuando = 0) => {
          const inicio = performance.now() + Math.max(0, cuando - this.currentTime) * 1000, buffer = fuente.buffer!, pcm = buffer.getChannelData(0), paso = Math.round(buffer.sampleRate * .02), voz: number[][] = [];
          for (let i = 0; i < pcm.length; i += paso) if (pcm.subarray(i, i + paso).some(v => Math.abs(v) > .001)) voz.push([inicio + i / buffer.sampleRate * 1000, inicio + Math.min(i + paso, pcm.length) / buffer.sampleRate * 1000]);
          const dato = { inicio, fin: inicio + buffer.duration * 1000, voz, texto: "" }; fuentes.push(dato);
          setTimeout(() => { dato.texto = document.querySelector('[data-testid="arena-voice-transcript"] p')?.textContent ?? ""; }, 100);
          iniciar(cuando);
        }; return fuente;
      }
    };
  });
  await page.goto(`/arena?partido=${id}&vista=buffer`);
  await page.getByRole("button", { name: "Switch to Spanish", exact: true }).click();
  const inicio = await page.evaluate(() => performance.now());
  await page.getByRole("button", { name: "Activar narración", exact: true }).click();
  await page.waitForTimeout(40000);
  const medicion = await page.evaluate(inicio => {
    const fuentes = (window as unknown as { respaldo: { inicio: number; fin: number; voz: number[][]; texto: string }[] }).respaldo;
    let fin = inicio, maxSilencioMs = 0;
    for (const [a, b] of fuentes.flatMap(f => f.voz).sort((a, b) => a[0]! - b[0]!)) { maxSilencioMs = Math.max(maxSilencioMs, a! - fin); fin = Math.max(fin, b!); }
    maxSilencioMs = Math.max(maxSilencioMs, performance.now() - fin);
    return { fuentes, maxSilencioMs };
  }, inicio);
  expect(medicion.fuentes.length).toBeGreaterThanOrEqual(5);
  expect(medicion.fuentes.every(f => f.voz.length > 0 && f.texto.length > 0)).toBe(true);
  expect(new Set(medicion.fuentes.map(f => f.texto)).size).toBe(medicion.fuentes.length);
  expect(medicion.maxSilencioMs).toBeLessThanOrEqual(5000);
  await testInfo.attach("respaldo-variado.json", { body: JSON.stringify(medicion, null, 2), contentType: "application/json" });
});
