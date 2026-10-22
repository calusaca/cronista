import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { construirRelato } from "../src/arena/relato";
import { wavMono } from "../src/arena/pista-audio";
import { VOZ_BUFFER } from "../src/arena/buffer";
import type { RegistroArena } from "../src/arena/tipos";
import { recordarVoz, type RecuerdoVoz } from "../src/arena/editorial";

// Nota del 22 oct (043): reservas en un partido de 180 s, en el consumidor real del búfer.
type Idioma = "es" | "en";
const indice = JSON.parse(await readFile("public/voz-reserva/indice.json", "utf8")) as Record<Idioma, { reservas: { texto: string; bytes: number }[]; cierre: { texto: string } }>;
const textosReserva = (idioma: Idioma) => indice[idioma].reservas.map(c => c.texto);
/** Caracteres por segundo de la voz del narrador, medidos sobre las reservas reales (MP3 de 48 kbit/s). */
const ritmo = (idioma: Idioma) => indice[idioma].reservas.reduce((n, c) => n + c.texto.length, 0) / indice[idioma].reservas.reduce((s, c) => s + c.bytes * 8 / 48000, 0);
/** Recuerdos que conserva la memoria de escucha: más reservas que estas delatan una elección por memoria. */
const memoriaEscucha = Array.from({ length: 50 }).reduce<RecuerdoVoz[]>(m => recordarVoz(m, { tick: 0, texto: "" }), []).length;

function recortar(registro: RegistroArena, tick: number): RegistroArena {
  const fotogramas = registro.fotogramas.filter(f => f.tick <= tick);
  return { ...registro, fotogramas, eventos: registro.eventos.filter(e => e.tick <= tick), rondas: registro.rondas.filter(r => r.inicioTick < tick), final: fotogramas.at(-1)! };
}

/** Emisión de 180 s: instantánea con los primeros 20 s y el resto publicado por el flujo. Con Speech
 * «normal», la ruta del relato construye el relato real (memoria incluida) con audio audible de la
 * duración que tendría a ritmo de narrador; con «fallido», toda síntesis responde 503. */
async function emision180(page: Page, id: string, registro: RegistroArena, speech: "normal" | "fallido", idioma: Idioma) {
  const inicio = recortar(registro, 200);
  await page.route(`**/api/arena/sesiones/${id}/emision`, r => r.fulfill({ json: { registro: inicio, comentarios: [], intervenciones: [], asignacion: { modo: "programado", local: { nombre: "Local" }, visita: { nombre: "Visita" } }, metricas: {}, estado: "ejecutando", ultimoMensaje: 1 } }));
  const publicaciones = [
    { tipo: "avance", estado: registro.final, fotogramas: registro.fotogramas.filter(f => f.tick > 200), eventos: registro.eventos.filter(e => e.tick > 200) },
    { tipo: "terminada", estado: "completa", metricas: { decisiones: 0, respaldos: 0, duracionMs: 0 } },
  ];
  await page.route(`**/api/arena/sesiones/${id}/eventos*`, r => r.fulfill({ headers: { "content-type": "text/event-stream" }, body: publicaciones.map((publicacion, i) => `id: ${i + 2}\nevent: arena\ndata: ${JSON.stringify({ id: i + 2, publicacion })}\n\n`).join("") }));
  await page.route("**/api/arena/herramientas", r => r.fulfill({ json: { voz: true, analista: false } }));
  const pedidos = { relato: 0, conAudio: 0 };
  await page.route(`**/api/arena/sesiones/${id}/relato`, async r => {
    const p = r.request().postDataJSON();
    if (speech === "fallido") return r.fulfill({ status: 503, json: { error: "Speech fallido en esta prueba" } });
    if (p.intervencion) return r.fulfill({ status: 404, json: { error: "Sin invitados en esta prueba" } });
    pedidos.relato++;
    const relato = construirRelato(recortar(registro, p.hastaTick), p.desdeTick, p.hastaTick, "buffer", p.idioma, { cierre: p.cierre, entradaTick: p.entradaTick, memoria: p.memoria });
    if (!relato.texto) return r.fulfill({ json: { ...relato, audio: null } });
    pedidos.conAudio++;
    const muestras = new Float32Array(Math.round(Math.min(VOZ_BUFFER.duracionMaxS, relato.texto.length / ritmo(idioma)) * 24000)).map((_, i) => .05 * Math.sin(i / 8));
    return r.fulfill({ json: { ...relato, audio: { base64: Buffer.from(await wavMono([muestras], 24000).arrayBuffer()).toString("base64"), tipo: "audio/wav" } } });
  });
  await page.addInitScript(() => {
    const fuentes: { inicio: number; fin: number; voz: number[][] }[] = [], oido: { tick: string; texto: string }[] = [];
    Object.assign(window, { fuentesReserva: fuentes, oidoReserva: oido });
    const Base = window.AudioContext;
    window.AudioContext = class extends Base {
      override createBufferSource() {
        const fuente = super.createBufferSource(), iniciar = fuente.start.bind(fuente), detener = fuente.stop.bind(fuente);
        let dato: { inicio: number; fin: number; voz: number[][] } | undefined;
        fuente.start = (cuando = 0) => {
          const inicio = performance.now() + Math.max(0, cuando - this.currentTime) * 1000, buffer = fuente.buffer!, pcm = buffer.getChannelData(0), paso = Math.round(buffer.sampleRate * .02), voz: number[][] = [];
          for (let i = 0; i < pcm.length; i += paso) if (pcm.subarray(i, i + paso).some(v => Math.abs(v) > .001)) voz.push([inicio + i / buffer.sampleRate * 1000, inicio + Math.min(i + paso, pcm.length) / buffer.sampleRate * 1000]);
          dato = { inicio, fin: inicio + buffer.duration * 1000, voz }; fuentes.push(dato); iniciar(cuando);
        };
        fuente.stop = (cuando = 0) => { if (dato) { const fin = performance.now() + Math.max(0, cuando - this.currentTime) * 1000; dato.fin = Math.min(dato.fin, fin); dato.voz = dato.voz.filter(([a]) => a! < fin); } detener(cuando); };
        return fuente;
      }
    };
    document.addEventListener("DOMContentLoaded", () => {
      let previo = "";
      new MutationObserver(() => {
        const el = document.querySelector('[data-testid="arena-voice-transcript"]');
        const tick = el?.getAttribute("data-narration-tick"), texto = el?.querySelector("p")?.textContent;
        if (tick && texto && `${tick}:${texto}` !== previo) { oido.push({ tick, texto }); previo = `${tick}:${texto}`; }
      }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["data-narration-tick"] });
    });
  });
  return pedidos;
}

async function escuchar180(page: Page, id: string, idioma: Idioma) {
  await page.goto(`/arena?partido=${id}&vista=buffer`);
  if (idioma === "es") await page.getByRole("button", { name: "Switch to Spanish", exact: true }).click();
  await expect(page.getByTestId("arena-clock")).toHaveText(/^0:0\d \/ 3:00$/);
  const inicio = await page.evaluate(() => performance.now());
  await page.getByRole("button", { name: idioma === "es" ? "Activar narración" : "Enable narration", exact: true }).click();
  await expect(page.getByTestId("arena-clock")).toHaveText("3:00 / 3:00", { timeout: 200_000 });
  const fin = await page.evaluate(() => performance.now());
  return page.evaluate(([inicio, fin]) => {
    const w = window as unknown as { fuentesReserva: { voz: number[][] }[]; oidoReserva: { tick: string; texto: string }[] };
    let hasta = inicio!, maxSilencioMs = 0;
    for (const [a, b] of w.fuentesReserva.flatMap(f => f.voz).filter(([a]) => a! <= fin!).sort((x, y) => x[0]! - y[0]!)) { maxSilencioMs = Math.max(maxSilencioMs, a! - hasta); hasta = Math.max(hasta, b!); }
    maxSilencioMs = Math.max(maxSilencioMs, fin! - hasta);
    return { oido: w.oidoReserva, fuentes: w.fuentesReserva.length, maxSilencioMs, duracionMs: fin! - inicio! };
  }, [inicio, fin]);
}

const simular180 = async (request: import("@playwright/test").APIRequestContext, seed: number) => {
  const r = await request.post("/api/arena", { data: { accion: "simular", seed, segundos: 180, local: "auto", visita: "auto" } });
  expect(r.ok()).toBe(true);
  return await r.json() as RegistroArena;
};

const casos = (process.env.CRONISTA_MEDIR_RESERVAS ?? "").split(",").filter(Boolean);
for (const caso of casos) {
  const [speech, idioma] = caso.split(":") as ["normal" | "fallido", Idioma];
  test(`medición: reservas en 180 s con Speech ${speech} (${idioma})`, async ({ page, request }, testInfo) => {
    test.setTimeout(300_000);
    const registro = await simular180(request, 1043);
    const id = `00000000-0000-4000-8000-0000000431${speech === "normal" ? 1 : 2}${idioma === "es" ? 1 : 2}`;
    const pedidos = await emision180(page, id, registro, speech, idioma);
    const m = await escuchar180(page, id, idioma);
    const catalogo = textosReserva(idioma), reservas = m.oido.filter(o => catalogo.includes(o.texto)).map(o => o.texto);
    const resumen = { speech, idioma, catalogo: catalogo.length, reservas: reservas.length, distintas: new Set(reservas).size, intervenciones: m.oido.length, fuentes: m.fuentes, maxSilencioMs: m.maxSilencioMs, duracionMs: m.duracionMs, pedidos, ritmoCaracteresS: ritmo(idioma), secuencia: reservas };
    console.log(JSON.stringify({ ...resumen, secuencia: undefined }));
    await testInfo.attach(`reservas-${speech}-${idioma}.json`, { body: JSON.stringify(resumen, null, 2), contentType: "application/json" });
  });
}

test("voz: en 180 s con Speech fallido no se repite una reserva antes de agotar el catálogo", async ({ page, request }, testInfo) => {
  test.setTimeout(300_000);
  const registro = await simular180(request, 1043), id = "00000000-0000-4000-8000-000000043300";
  await emision180(page, id, registro, "fallido", "es");
  const m = await escuchar180(page, id, "es");
  const catalogo = textosReserva("es"), reservas = m.oido.filter(o => catalogo.includes(o.texto)).map(o => o.texto);
  await testInfo.attach("reservas-180s-fallido.json", { body: JSON.stringify({ catalogo: catalogo.length, reservas, maxSilencioMs: m.maxSilencioMs, duracionMs: m.duracionMs }, null, 2), contentType: "application/json" });
  // Con Speech fallido solo suenan reservas, y el cierre no aparece antes del final del partido.
  const cierre = m.oido.findIndex(o => o.texto === indice.es.cierre.texto);
  expect(cierre === -1 || cierre === m.oido.length - 1).toBe(true);
  expect(m.oido.map(o => o.texto).filter(t => t !== indice.es.cierre.texto)).toEqual(reservas);
  expect(reservas.length).toBeGreaterThan(memoriaEscucha);
  const n = catalogo.length;
  expect(new Set(reservas.slice(0, n)).size).toBe(Math.min(n, reservas.length));
  expect(m.maxSilencioMs).toBeLessThanOrEqual(VOZ_BUFFER.silencioMaxS * 1000);
});

test("voz: si fallan algunas reservas o tarda su descarga, las demás cubren el silencio", async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  const registro = recortar(await simular180(request, 1043), 400), id = "00000000-0000-4000-8000-000000043400";
  await emision180(page, id, registro, "fallido", "es");
  // La mitad de los clips no carga (red o 404) y el resto llega con demora.
  const caidas = indice.es.reservas.filter((_, i) => i % 2 === 0).map(c => c.texto);
  const archivoDe = new Map(indice.es.reservas.map((c, i) => [`es/${String(i + 1).padStart(2, "0")}.mp3`, c.texto]));
  let fallidas = 0;
  await page.route("**/voz-reserva/es/*.mp3", async r => {
    const texto = archivoDe.get(new URL(r.request().url()).pathname.replace("/voz-reserva/", ""));
    if (texto && caidas.includes(texto)) { fallidas++; return fallidas % 2 ? r.abort() : r.fulfill({ status: 404, body: "" }); }
    await new Promise(f => setTimeout(f, 300)); return r.continue();
  });
  await page.goto(`/arena?partido=${id}&vista=buffer`);
  await page.getByRole("button", { name: "Switch to Spanish", exact: true }).click();
  const inicio = await page.evaluate(() => performance.now());
  await page.getByRole("button", { name: "Activar narración", exact: true }).click();
  await page.waitForTimeout(35_000);
  const m = await page.evaluate(inicio => {
    const w = window as unknown as { fuentesReserva: { voz: number[][] }[]; oidoReserva: { texto: string }[] };
    let hasta = inicio, maxSilencioMs = 0;
    for (const [a, b] of w.fuentesReserva.flatMap(f => f.voz).sort((x, y) => x[0]! - y[0]!)) { maxSilencioMs = Math.max(maxSilencioMs, a! - hasta); hasta = Math.max(hasta, b!); }
    return { oido: w.oidoReserva.map(o => o.texto), maxSilencioMs: Math.max(maxSilencioMs, performance.now() - hasta) };
  }, inicio);
  await testInfo.attach("reservas-parciales.json", { body: JSON.stringify({ ...m, fallidas }, null, 2), contentType: "application/json" });
  expect(fallidas).toBe(caidas.length);
  expect(m.oido.length).toBeGreaterThanOrEqual(3);
  expect(m.oido.every(t => textosReserva("es").includes(t) && !caidas.includes(t))).toBe(true);
  expect(new Set(m.oido).size).toBe(m.oido.length);
  expect(m.maxSilencioMs).toBeLessThanOrEqual(VOZ_BUFFER.silencioMaxS * 1000);
});
