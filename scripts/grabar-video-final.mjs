// Vídeo final de la entrega (docs/entrega/guion-video.md). Graba las dos apps públicas con
// Playwright, sintetiza la voz en off con Azure Speech, monta tarjetas propias y subtítulos.
// No modifica la app ni sube nada. Uso, desde la raíz del repo:
//   node scripts/grabar-video-final.mjs [--fases=arena,recap,tarjetas,voz,montar,verificar] [--controladores=azar|programado] [--toma=arena]
// Intermedios en .cache/video-final/; salida docs/entrega/cronista-demo-final.{mp4,en.srt}.
// Credenciales: .env y .cache/azure-servicios.env (nunca se imprimen ni se escriben).
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ARENA = "https://cronista-arena.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io/arena";
const RECAP = "https://cronista.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io";
const VOZ_OFF = "en-US-AndrewNeural"; // Neutral; no la usa ningún rol de la mesa (Jenny, Davis, Guy).
const ANCHO = 1440, ALTO = 900, FPS = 25;
const TRABAJO = resolve(".cache/video-final");
const SALIDA = resolve("docs/entrega/cronista-demo-final.mp4");
const SALIDA_SRT = resolve("docs/entrega/cronista-demo-final.en.srt");
const EVIDENCIA = resolve("docs/evidencia/publicacion-048");
const arg = (n, d) => process.argv.find(a => a.startsWith(`--${n}=`))?.split("=")[1] ?? d;
const fases = arg("fases", "arena,recap,tarjetas,voz,montar,verificar").split(",");
const controladores = arg("controladores", "azar");
const toma = arg("toma", "arena");
const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync(TRABAJO, { recursive: true });

function ffmpegExe() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  return execFileSync(resolve(".cache/venv-video/bin/python"), ["-c", "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf8" }).trim();
}
const FF = fases.some(f => ["voz", "montar", "verificar"].includes(f)) ? ffmpegExe() : null;
const ff = (args) => execFileSync(FF, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "inherit", "inherit"], maxBuffer: 1 << 26 });
function duracion(file) {
  let salida = "";
  try { execFileSync(FF, ["-hide_banner", "-i", file], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { salida = String(e.stderr ?? ""); }
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(salida);
  if (!m) throw new Error(`Sin duración: ${file}`);
  return +m[1] * 3600 + +m[2] * 60 + +m[3];
}
// Huella FNV-1a de los bytes MP3: la misma en el navegador (decodeAudioData) y aquí.
function huella(bytes) { let h = 2166136261; for (const b of bytes) { h ^= b; h = Math.imul(h, 16777619) >>> 0; } return `${bytes.length}:${h.toString(16)}`; }

// --------------------------------------------------------------------------------------------
// Grabación: utilidades comunes (cursor visible, desplazamiento suave, marcas de tiempo).
const scriptCursor = () => {
  const poner = () => {
    if (document.getElementById("__cursor-video")) return;
    const c = document.createElement("div"); c.id = "__cursor-video";
    c.innerHTML = '<svg width="26" height="30" viewBox="0 0 26 30"><path d="M2 2 L2 24 L8 18 L12 28 L16 26 L12 16 L21 16 Z" fill="#ffffff" stroke="#0b1220" stroke-width="2" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: "fixed", left: "-40px", top: "-40px", zIndex: 2147483647, pointerEvents: "none", filter: "drop-shadow(0 2px 3px rgba(0,0,0,.5))" });
    document.documentElement.appendChild(c);
    addEventListener("mousemove", e => { c.style.left = e.clientX - 2 + "px"; c.style.top = e.clientY - 2 + "px"; }, true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", poner); else poner();
};
const scriptAudio = () => {
  window.__huellas = new WeakMap(); window.__audio = [];
  const dec = BaseAudioContext.prototype.decodeAudioData;
  BaseAudioContext.prototype.decodeAudioData = function (buf, ...resto) {
    let tag = null;
    try { const u = new Uint8Array(buf); let h = 2166136261; for (let i = 0; i < u.length; i++) { h ^= u[i]; h = Math.imul(h, 16777619) >>> 0; } tag = `${u.length}:${h.toString(16)}`; } catch { /* sin huella */ }
    const p = dec.call(this, buf, ...resto);
    return p && p.then ? p.then(ab => { if (tag) window.__huellas.set(ab, tag); return ab; }) : p;
  };
  const start = AudioBufferSourceNode.prototype.start, stop = AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, dur) {
    const ctx = this.context.currentTime;
    this.__idx = window.__audio.length;
    window.__audio.push({ idx: this.__idx, t: Date.now() + Math.max(0, when - ctx) * 1000, offset, dur: this.buffer?.duration ?? null, tag: this.buffer ? window.__huellas.get(this.buffer) ?? null : null, parada: null });
    return start.apply(this, arguments);
  };
  AudioBufferSourceNode.prototype.stop = function (when = 0) {
    const e = window.__audio[this.__idx];
    if (e && e.parada === null) e.parada = Date.now() + Math.max(0, when - this.context.currentTime) * 1000;
    return stop.apply(this, arguments);
  };
};

function grabador(page, t0, dir) {
  const marcas = [];
  const marca = async (nombre, extra = {}) => {
    const t = (Date.now() - t0) / 1000;
    marcas.push({ nombre, t, ...extra });
    console.log(`  · ${t.toFixed(1)} s ${nombre}`);
    await page.screenshot({ path: join(dir, `marca-${String(marcas.length).padStart(2, "0")}-${nombre}.png`) }).catch(() => {});
  };
  const mover = async (loc, pausa = 350) => {
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    const b = await loc.boundingBox();
    if (!b) throw new Error("Elemento sin caja");
    const x = b.x + Math.min(b.width / 2, 60), y = b.y + b.height / 2;
    await page.mouse.move(x, y, { steps: 18 });
    await sleep(pausa);
    return { x, y };
  };
  const pulsar = async (loc, pausa = 350) => { const { x, y } = await mover(loc, pausa); await page.mouse.click(x, y); };
  const desplazar = async (loc, arriba = 90, ms = 1100) => {
    await page.evaluate(([el, a]) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - a, behavior: "smooth" }), [await loc.elementHandle(), arriba]);
    await sleep(ms);
  };
  const desplazarPor = async (dy, ms = 1100) => { await page.evaluate(d => window.scrollBy({ top: d, behavior: "smooth" }), dy); await sleep(ms); };
  const texto = sel => page.evaluate(s => document.querySelector(s)?.innerText ?? "", sel).catch(() => "");
  const esperar = async (fn, ms, etiqueta) => {
    const fin = Date.now() + ms;
    while (Date.now() < fin) { const v = await fn().catch(() => null); if (v) return v; await sleep(200); }
    console.log(`  ! tiempo agotado: ${etiqueta}`); return null;
  };
  return { marcas, marca, mover, pulsar, desplazar, desplazarPor, texto, esperar };
}

/** Nota del 22 oct (043): clips de reserva estáticos (public/voz-reserva), cierre al final de cada idioma. */
function clipsReserva() {
  const indice = JSON.parse(readFileSync(resolve("public/voz-reserva/indice.json"), "utf8"));
  const leer = c => ({ texto: c.texto, bytes: readFileSync(resolve("public/voz-reserva", c.archivo)) });
  return Object.fromEntries(["en", "es"].map(idioma => [idioma, [...indice[idioma].reservas, indice[idioma].cierre].map(leer)]));
}

// --------------------------------------------------------------------------------------------
// Fase arena: partido en vivo real (escenas 1–7 y fotograma final).
async function grabarArena() {
  const dir = join(TRABAJO, toma); mkdirSync(join(dir, "relatos"), { recursive: true });
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const context = await browser.newContext({ viewport: { width: ANCHO, height: ALTO }, colorScheme: "dark", locale: "en-US", recordVideo: { dir, size: { width: ANCHO, height: ALTO } } });
  await context.addInitScript(scriptCursor); await context.addInitScript(scriptAudio);
  const t0 = Date.now();
  const page = await context.newPage();
  const g = grabador(page, t0, dir);
  const estado = { sesion: null, asignacion: null, relatos: new Map(), analisis: null, errores: [], peticionesRelato: [] };
  page.on("pageerror", e => estado.errores.push(e.message));
  // Clips de respaldo empaquetados con la app (suenan si Speech tarda): también se identifican.
  const reserva = clipsReserva();
  for (const idioma of ["en", "es"]) reserva[idioma].forEach((clip, i) => {
    const bytes = clip.bytes, tag = huella(bytes), archivo = `reserva-${idioma}-${i}.mp3`;
    writeFileSync(join(dir, "relatos", archivo), bytes);
    const meta = { tag, archivo, reserva: true, idioma, texto: clip.texto, fragmentos: [{ rol: "narrador", texto: clip.texto }] };
    writeFileSync(join(dir, "relatos", archivo.replace(".mp3", ".json")), JSON.stringify(meta, null, 1));
    estado.relatos.set(tag, meta);
  });
  page.on("response", async r => {
    const u = r.url();
    try {
      if (r.request().method() === "POST" && /\/api\/arena\/sesiones$/.test(u) && r.ok()) { const j = await r.json(); estado.sesion = j.id; estado.asignacion = j.asignacion; }
      if (/\/relato$/.test(u)) {
        let pedido = {}; try { pedido = JSON.parse(r.request().postData() ?? "{}"); } catch { /* sin cuerpo */ }
        estado.peticionesRelato.push({ t: (Date.now() - t0) / 1000, http: r.status(), desde: pedido.desdeTick, hasta: pedido.hastaTick, idioma: pedido.idioma, intervencion: pedido.intervencion ?? null, variante: pedido.variante ?? null });
        if (r.status() !== 200) console.log(`  ! relato ${r.status()} ${pedido.intervencion ?? `${pedido.desdeTick}-${pedido.hastaTick}`}`);
      }
      if (/\/relato$/.test(u) && r.ok()) {
        const j = await r.json();
        if (j.audio?.base64) {
          const bytes = Buffer.from(j.audio.base64, "base64"), tag = huella(bytes);
          if (!estado.relatos.has(tag)) {
            const n = String(estado.relatos.size).padStart(3, "0");
            writeFileSync(join(dir, "relatos", `${n}.mp3`), bytes);
            const { audio, ...resto } = j;
            const meta = { tag, archivo: `${n}.mp3`, voz: audio.voz, recibidoS: (Date.now() - t0) / 1000, ...resto };
            writeFileSync(join(dir, "relatos", `${n}.json`), JSON.stringify(meta, null, 1));
            estado.relatos.set(tag, meta);
          }
        }
      }
      if (/\/analisis$/.test(u)) estado.analisis = { http: r.status(), cuerpo: r.ok() ? await r.json() : null };
    } catch { /* respuestas parciales no interesan */ }
  });
  try {
    await page.goto(ARENA, { waitUntil: "networkidle", timeout: 180_000 });
    await page.getByTestId("arena-pitch").waitFor();
    await sleep(800);
    // Escena 1: marcador 0–0, cancha con 22 fichas y árbitro; el cursor recorre la mesa.
    await g.desplazar(page.getByTestId("arena-pitch"), 318, 1500);
    await g.marca("s1");
    for (const rol of ["narrador", "comentarista", "estadista"]) await g.mover(page.getByTestId(`arena-mesa-${rol}`), 1900);
    // Escena 2: elección aleatoria de modelos y arranque del partido en vivo.
    await g.desplazar(page.getByTestId("arena-live"), 84, 1400);
    const select = page.getByTestId("arena-live").locator("select").first();
    if (controladores === "programado") await select.selectOption("programado");
    else await select.selectOption("azar");
    await g.mover(select, 1300);
    const boton = page.getByRole("button", { name: "Start live match" });
    await g.mover(boton, 600);
    await g.marca("s2-clic");
    const b = await boton.boundingBox(); await page.mouse.click(b.x + 40, b.y + b.height / 2);
    await sleep(500); await page.mouse.move(520, 215, { steps: 14 });
    // Reintento si otro partido con modelos está en curso (429 del servidor): un solo partido por intento.
    let arrancado = await g.esperar(async () => (await g.texto("[data-testid=arena-live-assignment]")) || null, 15_000, "asignación");
    for (let intento = 0; !arrancado && intento < 3; intento++) {
      console.log("  ! no arrancó; se reintenta en 45 s: " + (await g.texto("[data-testid=arena-live] [role=alert]")));
      await sleep(45_000);
      await g.marca("s2-clic");
      const bb = await boton.boundingBox(); await page.mouse.click(bb.x + 40, bb.y + bb.height / 2);
      arrancado = await g.esperar(async () => (await g.texto("[data-testid=arena-live-assignment]")) || null, 15_000, "asignación");
    }
    if (!arrancado) throw new Error("El partido no arrancó: " + await g.texto("[data-testid=arena-live]"));
    await g.desplazar(page.getByTestId("arena-live"), 84, 900);
    await g.marca("s2-asignacion", { texto: arrancado });
    // «Coaches are deciding» y «Live · N s ready» pueden llegar en cualquier orden o a la vez.
    let tDec = null, tVivo = null; const ini2 = Date.now();
    while (Date.now() - ini2 < 150_000) {
      const st = await g.texto("[data-testid=arena-live-status]"), bs = await g.texto("[data-testid=arena-buffer-status]");
      if (!tDec && /Coaches are deciding/.test(st)) { tDec = Date.now(); await g.marca("s2-decidiendo"); }
      if (!tVivo && /Live · \d+ s ready/.test(bs)) { tVivo = Date.now(); await g.marca("s2-vivo", { texto: bs }); }
      if (tVivo && (tDec || Date.now() - tVivo > 4000)) break;
      await sleep(150);
    }
    if (!tVivo) throw new Error("La emisión no quedó lista");
    while (Date.now() < Math.max(tVivo, tDec ?? 0) + 1500) await sleep(100);
    // Escena 4 (inicio): la narración se activa en cuanto la emisión está lista, para que los
    // intercambios de la mesa se pidan de uno en uno y no en la ráfaga inicial.
    const activar = page.getByRole("button", { name: "Enable narration" });
    await g.esperar(async () => activar.isVisible(), 30_000, "botón de narración");
    await g.mover(activar, 500);
    await g.marca("s4");
    { const bb = await activar.boundingBox(); await page.mouse.click(bb.x + 40, bb.y + bb.height / 2); }
    await sleep(2500);
    // Escena 3: planes validados y órdenes por jugador.
    const planes = page.locator("details.arena-plans");
    await g.desplazar(planes, 330, 1300);
    await g.pulsar(planes.locator(":scope > summary"), 400);
    await g.marca("s3");
    await sleep(2500);
    const ordenes = planes.locator("details > summary").first();
    if (await ordenes.count()) { await g.desplazar(ordenes, 330, 1000); await g.pulsar(ordenes, 400); await g.marca("s3-ordenes"); }
    await sleep(1500);
    await g.desplazarPor(240, 1400);
    await sleep(4500);
    // Escena 4: narración y mesa; esperar un intercambio del comentarista que suene completo.
    await g.desplazar(page.getByTestId("arena-pitch"), 250, 1300);
    await page.mouse.move(ANCHO - 30, ALTO - 30, { steps: 10 });
    await g.marca("s4-mesa");
    let elegido = null;
    const inicio4 = Date.now();
    while (Date.now() - inicio4 < 120_000) {
      const eventos = await page.evaluate(() => window.__audio).catch(() => []);
      for (const e of eventos) {
        const r = e.tag && estado.relatos.get(e.tag);
        const turnos = r?.fragmentos?.map(f => f.rol) ?? [];
        if (r?.intervencion && turnos.includes("comentarista") && (r.modoIntervencion === "llm" || controladores === "programado") && e.offset === 0) { elegido = { ...e, relato: r.archivo }; break; }
      }
      if (elegido) break;
      await sleep(400);
    }
    if (!elegido) {
      console.log("  ! sin intercambio LLM del comentarista audible; se acepta cualquier intercambio");
      const eventos = await page.evaluate(() => window.__audio);
      const e = eventos.find(e => estado.relatos.get(e.tag)?.intervencion);
      if (e) elegido = { ...e, relato: estado.relatos.get(e.tag).archivo };
    }
    if (elegido) {
      const fin = elegido.t + (elegido.dur - elegido.offset) * 1000 + 1500;
      while (Date.now() < fin) await sleep(200);
      await g.marca("s4-intercambio", { inicio: (elegido.t - t0) / 1000, dur: elegido.dur, relato: elegido.relato });
    }
    // Escena 5: hechos y verificaciones en la tarjeta del comentarista.
    const tarjeta = page.getByTestId("arena-mesa-comentarista");
    await g.desplazar(tarjeta, 120, 1200);
    await g.pulsar(tarjeta.locator("details > summary").first(), 400);
    await g.marca("s5");
    await sleep(4500);
    const intentos = tarjeta.locator("details").first();
    await g.desplazar(intentos, 60, 1500);
    await sleep(5500);
    // Escena 6: agente de Foundry, estilo Analyst, herramientas y evidencia.
    const asistente = page.getByTestId("arena-assistant");
    await g.desplazar(asistente, 90, 1200);
    const [pregunta, estilo] = [asistente.locator("select").nth(0), asistente.locator("select").nth(1)];
    await g.mover(pregunta, 500); await pregunta.selectOption("momento");
    await g.mover(estilo, 500); await estilo.selectOption("analyst");
    await g.marca("s6");
    const preguntar = asistente.getByRole("button", { name: "Ask analyst" });
    await g.mover(preguntar, 500);
    { const bb = await preguntar.boundingBox(); await page.mouse.click(bb.x + 40, bb.y + bb.height / 2); }
    await g.marca("s6-pregunta");
    const respuesta = await g.esperar(async () => (await asistente.getByTestId("arena-assistant-answer").count()) > 0 || (await asistente.getByRole("alert").count()) > 0, 90_000, "respuesta del analista");
    await sleep(400);
    await g.marca("s6-respuesta", { texto: await g.texto("[data-testid=arena-assistant-answer]") });
    if (respuesta && await asistente.getByTestId("arena-assistant-answer").count()) {
      await sleep(2200);
      const herramientas = asistente.getByTestId("arena-assistant-answer").locator("summary");
      await g.pulsar(herramientas, 300);
      await g.marca("s6-herramientas", { texto: await g.texto("[data-testid=arena-assistant-answer]") });
      await g.desplazar(asistente.getByTestId("arena-assistant-answer"), 120, 1200);
      await sleep(4500);
    }
    // Escena 7: ES, selección de un dorsal y vista «seguir al jugador».
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); await sleep(1100);
    const es = page.getByRole("button", { name: "Switch to Spanish" });
    await g.mover(es, 400);
    await g.marca("s7");
    { const bb = await es.boundingBox(); await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); }
    await sleep(1200);
    await g.desplazar(page.getByTestId("arena-pitch"), 318, 1300);
    await sleep(1200);
    const ficha = page.getByTestId("arena-player").nth(6);
    await g.pulsar(ficha, 500);
    await g.marca("s7-jugador");
    const inteligencia = page.getByTestId("arena-intelligence");
    await g.desplazar(inteligencia, 110, 1200);
    const vista = inteligencia.locator("select").first();
    await g.mover(vista, 500);
    const opciones = await vista.locator("option").evaluateAll(os => os.map(o => ({ v: o.value, t: o.textContent })));
    const seguir = opciones.find(o => /jugador|player/i.test(o.t)) ?? opciones.at(-1);
    await vista.selectOption(seguir.v);
    await g.marca("s7-seguir", { opcion: seguir.t });
    await sleep(4500);
    // Fotograma final: de vuelta en EN, la cancha.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); await sleep(900);
    { const en = page.getByRole("button", { name: "Cambiar a inglés" }); const bb = await en.boundingBox(); await page.mouse.move(bb.x + 10, bb.y + 10, { steps: 8 }); await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); }
    await sleep(800);
    await g.desplazar(page.getByTestId("arena-pitch"), 318, 1300);
    await page.mouse.move(ANCHO - 20, ALTO - 20, { steps: 6 });
    await g.marca("fin");
    await sleep(4000);
    // Datos para subtítulos e informe: eventos de audio y registro de la sesión.
    const eventos = await page.evaluate(() => window.__audio);
    const sesion = estado.sesion ? await page.evaluate(async id => { const r = await fetch(`/api/arena/sesiones/${id}/emision`); return r.ok ? r.json() : { http: r.status }; }, estado.sesion).catch(() => null) : null;
    writeFileSync(join(dir, "datos.json"), JSON.stringify({ t0, url: ARENA, controladores, sesion: estado.sesion, asignacion: estado.asignacion, marcas: g.marcas, eventosAudio: eventos.map(e => ({ ...e, t: (e.t - t0) / 1000, parada: e.parada === null ? null : (e.parada - t0) / 1000, relato: estado.relatos.get(e.tag)?.archivo ?? null })), analisis: estado.analisis, errores: estado.errores, peticionesRelato: estado.peticionesRelato }, null, 1));
    if (sesion) writeFileSync(join(dir, "emision.json"), JSON.stringify({ estado: sesion.estado, metricas: sesion.metricas, asignacion: sesion.asignacion, intervenciones: sesion.intervenciones ?? sesion.registro?.intervenciones ?? null }, null, 1));
  } finally {
    await context.close();
    await browser.close();
  }
  const video = readdirSync(dir).filter(f => f.endsWith(".webm")).map(f => join(dir, f)).at(-1);
  renameSync(video, join(dir, "arena.webm"));
}

// --------------------------------------------------------------------------------------------
// Fase recap: demo pública de crónicas, semilla 246 (escena 8).
async function grabarRecap() {
  const dir = join(TRABAJO, "recap"); mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  // Precalienta la réplica fuera de la grabación.
  { const c = await browser.newContext(); const p = await c.newPage(); await p.goto(RECAP, { waitUntil: "networkidle", timeout: 240_000 }); await c.close(); }
  const context = await browser.newContext({ viewport: { width: ANCHO, height: ALTO }, colorScheme: "dark", locale: "en-US", recordVideo: { dir, size: { width: ANCHO, height: ALTO } } });
  await context.addInitScript(scriptCursor);
  const t0 = Date.now();
  const page = await context.newPage();
  const g = grabador(page, t0, dir);
  let datos;
  try {
    await page.goto(RECAP, { waitUntil: "networkidle", timeout: 240_000 });
    await page.getByTestId("sentence").first().waitFor();
    const etiqueta = await page.getByTestId("llm-label").innerText();
    if (!/gpt-6\.1-sol/i.test(etiqueta)) throw new Error(`Redactor inesperado: ${etiqueta}`);
    await sleep(800);
    await page.mouse.move(700, 450, { steps: 4 });
    await g.marca("r-inicio");
    await sleep(1200);
    const frase = page.getByTestId("sentence").nth(1).getByTestId("sentence-text");
    await g.mover(frase, 500);
    await g.marca("r-clic");
    { const bb = await frase.boundingBox(); await page.mouse.click(bb.x + 60, bb.y + bb.height / 2); }
    await page.locator('[data-testid="timeline-event"][data-highlighted="true"]').first().waitFor();
    await sleep(3200);
    const proceso = page.getByTestId("open-process").first();
    await g.mover(proceso, 500);
    { const bb = await proceso.boundingBox(); await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); }
    await page.getByTestId("process-view").waitFor();
    await g.marca("r-proceso");
    await page.mouse.move(1300, 760, { steps: 10 });
    await sleep(6000);
    datos = { t0, url: RECAP, redactor: etiqueta, verificacion: await page.getByTestId("verify-bar").innerText().catch(() => ""), marcas: g.marcas };
  } finally { await context.close(); await browser.close(); }
  writeFileSync(join(dir, "datos.json"), JSON.stringify(datos, null, 1));
  const video = readdirSync(dir).filter(f => f.endsWith(".webm") && f !== "recap.webm").map(f => join(dir, f)).at(-1);
  renameSync(video, join(dir, "recap.webm"));
}

// --------------------------------------------------------------------------------------------
// Fase tarjetas: tres tarjetas propias (paleta de la arena, sin logotipos).
const TARJETAS_HTML = `<!doctype html><html lang="en"><meta charset="utf-8"><title>CRONISTA cards</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800;900&family=Source+Sans+3:wght@400;600;700&display=block" rel="stylesheet">
<style>
:root{--bg:#0b1220;--surface:#131c2e;--surface2:#1a2540;--line:#26324a;--ink:#eef2f8;--muted:#9fb0c9;--accent:#d4ff3a;--nar:#d4ff3a;--com:#ff9a6b;--est:#5ee0d0}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:"Source Sans 3",system-ui,sans-serif}
main{width:1440px;height:900px;padding:92px 80px 64px;position:relative;overflow:hidden;background:radial-gradient(1200px 600px at 85% -10%,#18233a 0%,transparent 60%),var(--bg)}
.brand{font:900 30px Archivo,sans-serif;color:var(--accent);letter-spacing:.01em}
.over{margin-top:26px;font:700 16px Archivo,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
h1{font:800 48px/1.08 Archivo,sans-serif;letter-spacing:-.02em;margin:10px 0 26px}
.grid{display:grid;gap:14px}
.box{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px 18px}
.box b{display:block;font:700 21px Archivo,sans-serif;margin-bottom:4px}.box span{color:var(--muted);font-size:18px;line-height:1.35}
.arr{color:var(--accent);font:800 28px Archivo,sans-serif;align-self:center;text-align:center}
.foot{margin-top:22px;color:var(--muted);font-size:20px;line-height:1.45}
.tag{display:inline-block;border:1px solid var(--line);background:var(--surface2);border-radius:999px;padding:6px 14px;font:700 16px Archivo,sans-serif;color:var(--ink);margin-right:8px}
.k{border-left:5px solid var(--accent)}.n{border-left:5px solid var(--nar)}.c{border-left:5px solid var(--com)}.e{border-left:5px solid var(--est)}
.svc{display:grid;grid-template-columns:1fr 1fr;gap:14px}.svc .box b{font-size:23px}
.num{font:900 76px/1 Archivo,sans-serif;color:var(--accent);letter-spacing:-.03em}.lbl{font-size:22px;margin-top:10px}
.ci{display:inline-flex;align-items:center;gap:10px;border-radius:8px;overflow:hidden;font:700 20px Archivo,sans-serif;border:1px solid var(--line)}
.ci i{font-style:normal;background:var(--surface2);padding:8px 14px}.ci em{font-style:normal;background:var(--accent);color:var(--bg);padding:8px 14px}
</style>
<main id="arquitectura">
 <div class="brand">CRONISTA</div><div class="over">Multi-agent architecture · custom TypeScript orchestration on Azure</div>
 <h1>Separate roles, one shared journal,<br>a verifier before every spoken analysis.</h1>
 <div class="grid" style="grid-template-columns:1.05fr 40px 1.1fr 40px 1.1fr">
  <div class="grid"><div class="box k"><b>Home coach</b><span>LLM · Azure OpenAI · JSON plan per player</span></div><div class="box k"><b>Away coach</b><span>LLM · second deployment · same observation</span></div></div>
  <div class="arr">→</div>
  <div class="box" style="display:flex;flex-direction:column;justify-content:center"><b>Shared deterministic engine</b><span>Validates plans, resolves play.<br>Clock paused while coaches decide.</span></div>
  <div class="arr">→</div>
  <div class="box" style="display:flex;flex-direction:column;justify-content:center"><b>Session journal</b><span>Events · facts · desk exchanges<br>Blob Storage, leased</span></div>
 </div>
 <div class="grid" style="grid-template-columns:1fr 1fr 1fr 40px 1.15fr;margin-top:16px">
  <div class="box n"><b>Narrator</b><span>Templates + Azure Speech voice</span></div>
  <div class="box c"><b>Commentator</b><span>LLM, cites facts → Verifier V1–V8, retry, else template</span></div>
  <div class="box e"><b>Statistician</b><span>Deterministic numbers with event evidence</span></div>
  <div class="arr">→</div>
  <div class="box"><b>Desk coordinator</b><span>1–4 turn exchange, one SSML clip, ES / EN</span></div>
 </div>
 <div class="grid" style="grid-template-columns:1fr;margin-top:16px"><div class="box"><b>Match analyst · Microsoft Foundry Agent Service</b><span>On request, read-only tools over the confirmed play; answers pass the same verifier</span></div></div>
 <div class="foot">Not implemented: Microsoft Agent Framework, MCP, A2A.</div>
</main>
<main id="azure">
 <div class="brand">CRONISTA</div><div class="over">Running on Azure</div>
 <h1>Azure services behind the two public apps</h1>
 <div class="svc">
  <div class="box"><b>Azure OpenAI</b><span>Two coaches, commentator, recap writer</span></div>
  <div class="box"><b>Microsoft Foundry Agent Service</b><span>Versioned analyst agent with read-only tools</span></div>
  <div class="box"><b>Azure AI Speech</b><span>One neural voice per desk role, ES and EN</span></div>
  <div class="box"><b>Azure Container Apps + Jobs</b><span>Arena and recap apps; offline batch worker</span></div>
  <div class="box"><b>Blob Storage · Key Vault</b><span>Session journals, cached audio; managed identity, no keys in the image</span></div>
  <div class="box"><b>Application Insights</b><span>Spans per decision, narration, tool call and voice</span></div>
  <div class="box"><b>Container Registry · Bicep</b><span>Remote image builds; all infrastructure as code</span></div>
  <div class="box"><b>GitHub Actions</b><span>CI: unit tests, Playwright journeys, container and Bicep build</span></div>
 </div>
 <div class="foot">Not used: Microsoft Agent Framework, MCP, A2A, Fabric, AKS.</div>
</main>
<main id="calidad">
 <div class="brand">CRONISTA</div><div class="over">Quality · evidence in the repository</div>
 <h1>Nearly two thousand automated checks</h1>
 <div class="grid" style="grid-template-columns:1fr 1fr 1fr">
  <div class="box" style="padding:30px"><div class="num">1,788</div><div class="lbl">unit, invariant, oracle and lie-battery tests in 80 files</div></div>
  <div class="box" style="padding:30px"><div class="num">129</div><div class="lbl">Playwright journeys in 29 files</div></div>
  <div class="box" style="padding:30px"><div class="num">58</div><div class="lbl">statistical checks over 1,000 simulated matches</div></div>
 </div>
 <p style="margin-top:34px"><span class="ci"><i>CI</i><em>passed</em></span> <span style="color:var(--muted);font-size:21px;margin-left:12px">run 39699195295 · three jobs · commit 9704dce · 22 Oct 2026</span></p>
 <p style="margin-top:26px"><span class="tag">All data synthetic</span><span class="tag">Open source</span><span class="tag">Claims link to evidence</span></p>
 <div class="foot">Live arena: cronista-arena.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io/arena<br>Fictional clubs, players and broadcasters. The arena is a short 2D prototype, not a regulation match.</div>
</main>
</html>`;
async function tarjetas() {
  const dir = join(TRABAJO, "tarjetas"); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "tarjetas.html"), TARJETAS_HTML);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: ANCHO, height: ALTO } });
  await page.goto("file://" + join(dir, "tarjetas.html"), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  for (const id of ["arquitectura", "azure", "calidad"]) await page.locator(`#${id}`).screenshot({ path: join(dir, `${id}.png`) });
  await browser.close();
}

// --------------------------------------------------------------------------------------------
// Fase voz: voz en off en inglés con Azure Speech (misma llamada REST que src/arena/voz.ts).
const VOZ = {
  s1: "AI can call a football match. Can it prove what it says? CRONISTA is a multi-agent broadcast where every sentence is traceable.",
  s2: "Two LLM coaches on separate Azure OpenAI deployments receive the same committed observation and return a plan for every player. A shared deterministic engine resolves the play; the clock waits for both.",
  s3: "Plans are validated against the engine. An invalid or late answer gets one correction with feedback, then a recorded programmed fallback. The match never stalls.",
  s5: "The commentator may only analyse with a cited fact. Eight deterministic rules check citations, numbers, names and claims. A failed sentence is retried once, then replaced by a labelled template.",
  s6: "A versioned Microsoft Foundry agent answers viewer questions with read-only tools over the confirmed play only. Its sentences pass the same verifier.",
  s7: "Spanish or English, fan, analyst or one player: the same intelligence, rendered for each viewer.",
  s8: "The same verifier guards the automated recap: click any sentence to see its events and open the process view with every draft and verdict. We claim traceability, not better prose.",
  s9: "It runs on Azure Container Apps with Blob, Key Vault, Application Insights, Speech and Foundry. Nearly two thousand automated tests run in CI. Everything is synthetic. CRONISTA: narrate the match, prove every sentence.",
};
const RITMO = { s1: "+9%", s2: "+6%", s5: "+10%", s8: "+12%", s9: "+15%" };
async function voz() {
  const dir = join(TRABAJO, "voz"); mkdirSync(dir, { recursive: true });
  for (const f of [".env", ".cache/azure-servicios.env"]) if (existsSync(f)) process.loadEnvFile(f);
  const endpoint = new URL(process.env.AZURE_SPEECH_ENDPOINT ?? "");
  if (endpoint.protocol !== "https:" || !endpoint.hostname.endsWith(".cognitiveservices.azure.com")) throw new Error("Endpoint de Speech inválido");
  const clave = process.env.AZURE_SPEECH_KEY ?? process.env.AZURE_OPENAI_API_KEY;
  if (!clave) throw new Error("Speech sin credenciales");
  const esc = s => s.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);
  const lista = await (await fetch(`${endpoint.href.replace(/\/$/, "")}/tts/cognitiveservices/voices/list`, { headers: { "Ocp-Apim-Subscription-Key": clave } })).json();
  if (!lista.some(v => v.ShortName === VOZ_OFF)) throw new Error(`${VOZ_OFF} no está en el catálogo`);
  const resumen = {};
  for (const [escena, texto] of Object.entries(VOZ)) {
    const cuerpo = esc(texto).replace(/CRONISTA/g, '<sub alias="Cronista">CRONISTA</sub>');
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="${VOZ_OFF}"><prosody rate="${RITMO[escena] ?? "+3%"}">${cuerpo}</prosody></voice></speak>`;
    const archivo = join(dir, `${escena}.wav`), hash = createHash("sha256").update(ssml).digest("hex").slice(0, 16);
    const marcaHash = join(dir, `${escena}.hash`);
    if (!(existsSync(archivo) && existsSync(marcaHash) && readFileSync(marcaHash, "utf8") === hash)) {
      const r = await fetch(`${endpoint.href.replace(/\/$/, "")}/tts/cognitiveservices/v1`, { method: "POST", headers: { "content-type": "application/ssml+xml", "X-Microsoft-OutputFormat": "riff-48khz-16bit-mono-pcm", "user-agent": "CRONISTA", "Ocp-Apim-Subscription-Key": clave }, body: ssml });
      if (!r.ok) throw new Error(`Speech HTTP ${r.status}`);
      writeFileSync(archivo, Buffer.from(await r.arrayBuffer())); writeFileSync(marcaHash, hash);
    }
    resumen[escena] = { texto, palabras: texto.split(/\s+/).length, duracionS: +duracion(archivo).toFixed(2) };
    console.log(`  · ${escena}: ${resumen[escena].duracionS} s, ${resumen[escena].palabras} palabras`);
  }
  writeFileSync(join(dir, "voz.json"), JSON.stringify({ voz: VOZ_OFF, escenas: resumen }, null, 1));
}

// --------------------------------------------------------------------------------------------
// Fase montar: escenas, subtítulos (rótulo superior + transcripción inferior), mezcla y MP4.
const ROTULO = {
  s1: "CRONISTA — multi-agent match broadcast · every sentence traceable",
  s3: "Validated plan · 1 correction with feedback · fallback recorded, never silent",
  s5: "V1–V8: schema · citations · numbers · names · coverage · ES=EN · negations · strong claims",
  s7: "ES / EN · Fan · Analyst · Follow a player — same facts, different experience",
  s8: "Automated recap · GPT-6.1 Sol · 0/163 baseline, 0/167 pipeline flagged · no reduction demonstrated",
  s9a: "Azure OpenAI · Foundry Agent Service · Azure Speech · Container Apps + Jobs · Blob · Key Vault · App Insights · ACR · Bicep · GitHub Actions",
  s9b: "All data synthetic · open source · claims link to evidence",
};
const NOMBRE_ROL = { narrador: "Narrator", comentarista: "Commentator", estadista: "Statistician" };
function montar() {
  const dir = join(TRABAJO, "montaje"); mkdirSync(dir, { recursive: true });
  const arena = JSON.parse(readFileSync(join(TRABAJO, toma, "datos.json"), "utf8"));
  const recap = JSON.parse(readFileSync(join(TRABAJO, "recap", "datos.json"), "utf8"));
  const vozOff = JSON.parse(readFileSync(join(TRABAJO, "voz", "voz.json"), "utf8")).escenas;
  const m = (datos, n) => { const x = datos.marcas.findLast(k => k.nombre === n); if (!x) throw new Error(`Falta la marca ${n}`); return x; };
  const A = join(TRABAJO, toma, "arena.webm"), R = join(TRABAJO, "recap", "recap.webm"), T = join(TRABAJO, "tarjetas");
  const durVoz = e => vozOff[e].duracionS;
  const largo = (e, ranura) => Math.max(ranura, +(durVoz(e) + 0.7).toFixed(2));

  // Escena 4: el intercambio de la mesa que sonó en la sesión (audio propio de la página).
  const s4 = m(arena, "s4-intercambio");
  const relato4 = JSON.parse(readFileSync(join(TRABAJO, toma, "relatos", s4.relato.replace(".mp3", ".json")), "utf8"));
  // Ventana sin cortar ninguna locución: empieza en un silencio antes del intercambio y acaba
  // tras él o justo antes de la siguiente locución.
  const finEv = e => e.parada ?? e.t + (e.dur - e.offset);
  const mesa4 = m(arena, "s4-mesa").t + 0.2;
  const sonidos = arena.eventosAudio.filter(e => e.t < s4.inicio + s4.dur + 6 && finEv(e) > mesa4);
  let inicio4 = Math.max(mesa4, s4.inicio - 1.0);
  for (const e of sonidos) if (e.t < inicio4 && finEv(e) > inicio4) inicio4 = s4.inicio - finEv(e) >= 0.6 ? finEv(e) + 0.05 : Math.max(mesa4, e.t - 0.4);
  // Si la locución anterior (p. ej. el cantado del gol) acaba justo antes del intercambio, se incluye.
  const previa = sonidos.filter(e => finEv(e) <= s4.inicio + 0.05 && s4.inicio - finEv(e) < 2 && e.t - 0.6 >= mesa4).at(-1);
  if (previa) inicio4 = Math.max(previa.t - 0.6, ...sonidos.filter(e => e.t < previa.t).map(e => finEv(e) + 0.03));
  const finInt = s4.inicio + s4.dur;
  let fin4 = Math.min(finInt + 1.2, inicio4 + 19.3);
  for (const e of sonidos) if (e.t > finInt - 0.05 && e.t < fin4) fin4 = Math.max(finInt + 0.05, e.t - 0.02);
  const dur4 = +(fin4 - inicio4).toFixed(2);

  // Lista de escenas: piezas de vídeo y ventanas de audio de la sesión.
  const a2 = m(arena, "s2-clic").t, dec = arena.marcas.find(k => k.nombre === "s2-decidiendo")?.t ?? m(arena, "s2-vivo").t;
  const vivo = m(arena, "s2-vivo").t;
  // Escena 2: el clic y, tras un corte, la espera hasta «Live · N s ready» (justo antes de activar la narración).
  const clic4 = m(arena, "s4").t, pieza4a = 2.2;
  const piezas2 = [{ src: null, desde: a2 - 2.5, dur: 4.5 }];
  { const restoS2 = largo("s2", 14) - 4.5, fin = clic4 - 0.7; piezas2.push({ src: null, desde: Math.max(m(arena, "s2-asignacion").t + 0.8, fin - restoS2), dur: 0 }); }
  const L = { s1: largo("s1", 8), s2: largo("s2", 14), s3: largo("s3", 10), s4: +(pieza4a + dur4).toFixed(2), s5: largo("s5", 12), s6: largo("s6", 11), s7: largo("s7", 11), s8: largo("s8", 12), s9: largo("s9", 12) };
  const s6p = m(arena, "s6-pregunta").t, s6r = m(arena, "s6-respuesta").t;
  const piezaA6 = +(s6p + 1.6 - (m(arena, "s6").t - 1.8)).toFixed(2);
  const escenas = [
    { id: "s1", piezas: [{ src: A, desde: m(arena, "s1").t - 0.3, dur: L.s1 }] },
    { id: "s2", piezas: piezas2.map((p, i, todas) => ({ ...p, src: A, dur: i < todas.length - 1 ? p.dur : +(L.s2 - todas.slice(0, -1).reduce((s, q) => s + q.dur, 0)).toFixed(2) })) },
    { id: "s3", piezas: [{ src: A, desde: m(arena, "s3").t - 0.8, dur: L.s3 }] },
    { id: "s4", piezas: [{ src: A, desde: clic4 - 0.6, dur: pieza4a }, { src: A, desde: inicio4, dur: dur4 }] },
    { id: "s5", piezas: [{ src: A, desde: m(arena, "s5").t - 0.8, dur: L.s5 }] },
    { id: "s6", piezas: [{ src: A, desde: m(arena, "s6").t - 1.8, dur: piezaA6 }, { src: A, desde: s6r - 0.6, dur: +(L.s6 - piezaA6).toFixed(2) }] },
    { id: "s7", piezas: [{ src: A, desde: m(arena, "s7").t - 0.6, dur: L.s7 }] },
    { id: "s8", piezas: [{ src: R, desde: m(recap, "r-clic").t - 2.6, dur: L.s8 }] },
  ];
  const fin9 = 1.6, cartas = L.s9 - fin9;
  escenas.push({ id: "s9", piezas: [
    { img: join(T, "arquitectura.png"), dur: +(cartas * 0.38).toFixed(2) },
    { img: join(T, "azure.png"), dur: +(cartas * 0.32).toFixed(2) },
    { img: join(T, "calidad.png"), dur: +(cartas - +(cartas * 0.38).toFixed(2) - +(cartas * 0.32).toFixed(2)).toFixed(2) },
    { src: A, desde: m(arena, "fin").t + 0.6, dur: fin9 },
  ] });

  // 1) Segmentos de vídeo (intermedio de alta calidad, 25 fps, 1440×900).
  const segmentos = []; let n = 0; let reloj = 0; const inicio = {};
  for (const e of escenas) {
    inicio[e.id] = reloj;
    for (const p of e.piezas) {
      const out = join(dir, `seg-${String(n++).padStart(2, "0")}.mp4`);
      const vf = `scale=${ANCHO}:${ALTO}:flags=lanczos,fps=${FPS},format=yuv420p`;
      if (p.img) ff(["-loop", "1", "-t", String(p.dur), "-i", p.img, "-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-an", out]);
      else ff(["-ss", p.desde.toFixed(3), "-i", p.src, "-t", String(p.dur), "-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-an", out]);
      segmentos.push(out); p.inicioFinal = reloj; reloj += p.dur;
    }
  }
  const total = reloj;
  writeFileSync(join(dir, "lista.txt"), segmentos.map(s => `file '${s}'`).join("\n") + "\n");
  ff(["-f", "concat", "-safe", "0", "-i", join(dir, "lista.txt"), "-c", "copy", join(dir, "mudo.mp4")]);

  // 2) Audio: voz en off por escena, audio real de la sesión en la escena 4, clip C bajo la escena 7.
  const entradas = [], filtros = [];
  const agregar = (archivo, alInicio, { volumen = 1, desde = 0, dur = null } = {}) => {
    const k = entradas.length / 2; entradas.push("-i", archivo);
    const recorte = `atrim=start=${desde.toFixed(3)}${dur ? `:duration=${dur.toFixed(3)}` : ""},asetpts=PTS-STARTPTS`;
    filtros.push(`[${k}:a]aresample=48000,aformat=channel_layouts=mono,${recorte},afade=t=in:d=0.03,volume=${volumen},adelay=${Math.round(alInicio * 1000)}:all=1[a${k}]`);
  };
  const desfaseVoz = { s1: 0.25, s2: 0.3, s3: 0.3, s5: 0.3, s6: 0.3, s7: 0.9, s8: 0.3, s9: 0.25 };
  for (const e of Object.keys(VOZ)) agregar(join(TRABAJO, "voz", `${e}.wav`), inicio[e] + desfaseVoz[e]);
  const audioSesion = [];
  const dirRelatos = join(TRABAJO, toma, "relatos"), porHuella = new Map();
  for (const f of readdirSync(dirRelatos).filter(f => f.endsWith(".json"))) { const j = JSON.parse(readFileSync(join(dirRelatos, f), "utf8")); porHuella.set(j.tag, j.archivo); }
  const reserva = clipsReserva();
  for (const idioma of ["en", "es"]) reserva[idioma].forEach((clip, i) => {
    const bytes = clip.bytes, tag = huella(bytes), archivo = `reserva-${idioma}-${i}.mp3`;
    if (porHuella.has(tag)) return;
    writeFileSync(join(dirRelatos, archivo), bytes);
    writeFileSync(join(dirRelatos, archivo.replace(".mp3", ".json")), JSON.stringify({ tag, archivo, reserva: true, idioma, texto: clip.texto, fragmentos: [{ rol: "narrador", texto: clip.texto }] }, null, 1));
    porHuella.set(tag, archivo);
  });
  for (const ev0 of arena.eventosAudio) {
    const ev = { ...ev0, relato: ev0.relato ?? porHuella.get(ev0.tag) ?? null };
    if (!ev.relato) { if (ev.t < inicio4 + dur4 && (ev.parada ?? ev.t + ev.dur) > inicio4) console.log(`  ! audio sin identificar en la escena 4: ${ev.tag}`); continue; }
    const fin = ev.parada ?? ev.t + (ev.dur - ev.offset);
    if (fin <= inicio4 || ev.t >= inicio4 + dur4) continue;
    const desde = Math.max(0, inicio4 - ev.t), alInicio = inicio.s4 + pieza4a + Math.max(0, ev.t - inicio4);
    const dur = Math.min(fin, inicio4 + dur4) - Math.max(ev.t, inicio4);
    if (dur < 0.6) continue;
    agregar(join(TRABAJO, toma, "relatos", ev.relato), alInicio, { desde: ev.offset + desde, dur });
    audioSesion.push({ ...ev, alInicio, desde: ev.offset + desde, durUsada: dur });
  }
  if (!audioSesion.length) throw new Error("La escena 4 no tiene audio de la sesión");
  agregar(join(EVIDENCIA, "publico-ronda-457-es.mp3"), inicio.s7 + 0.1, { volumen: 0.22, dur: Math.min(16.66, L.s7 - 0.3) });
  const k = entradas.length / 2;
  filtros.push(`${Array.from({ length: k }, (_, i) => `[a${i}]`).join("")}amix=inputs=${k}:normalize=0:dropout_transition=0,apad,atrim=duration=${total.toFixed(3)},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[mez]`);
  writeFileSync(join(dir, "filtros-audio.txt"), filtros.join(";\n"));
  ff([...entradas, "-filter_complex_script", join(dir, "filtros-audio.txt"), "-map", "[mez]", "-ac", "2", "-c:a", "pcm_s16le", join(dir, "mezcla.wav")]);

  // 3) Subtítulos: transcripción (SRT entregable) y rótulos (solo en el vídeo, como ASS).
  const subt = [];
  const repartir = (texto, desde, dur, prefijo = "") => {
    const frases = texto.match(/[^.?!;:]+[.?!;:]+["»]?|[^.?!;:]+$/g).map(s => s.trim()).filter(Boolean);
    const trozos = [];
    for (const f of frases) { if (trozos.length && (trozos.at(-1) + " " + f).length <= 84 && !/[.?!]$/.test(trozos.at(-1))) trozos[trozos.length - 1] += " " + f; else trozos.push(f); }
    const total = trozos.reduce((s, t) => s + t.length, 0); let t = desde;
    trozos.forEach((tr, i) => { const d = dur * tr.length / total; subt.push({ ini: t, fin: t + d - 0.04, texto: (i === 0 ? prefijo : "") + tr }); t += d; });
  };
  for (const e of Object.keys(VOZ)) repartir(VOZ[e], inicio[e] + desfaseVoz[e] + 0.05, durVoz(e) - 0.25);
  // Escena 4: lo que se oye, con el rol de cada voz (de la respuesta /relato servida a la página).
  const modoInt = relato4.modoIntervencion;
  for (const ev of audioSesion) {
    const r = JSON.parse(readFileSync(join(TRABAJO, toma, "relatos", ev.relato.replace(".mp3", ".json")), "utf8"));
    const frags = r.fragmentos ?? [{ rol: "narrador", texto: r.texto }];
    const chars = frags.reduce((s, f) => s + f.texto.length, 0); let t = ev.alInicio + 0.1;
    const util = ev.dur - 0.4;
    for (const f of frags) {
      const d = util * f.texto.length / chars;
      const rol = f.rol === "comentarista" ? `Commentator (${r.modoIntervencion === "llm" ? "LLM, verified" : "template fallback"})` : f.rol === "estadista" ? "Statistician (deterministic)" : r.reserva ? "Narrator (bundled backup clip)" : r.intervencion ? "Narrator (template)" : "Narrator (play-by-play)";
      const ini = Math.max(t, inicio.s4 + pieza4a), finS = Math.min(t + d, inicio.s4 + L.s4);
      if (finS - ini > 0.5) subt.push({ ini, fin: finS - 0.04, texto: `${rol}: ${f.texto}` });
      t += d;
    }
  }
  // Escena 7: el clip C (otro partido, 21 oct) suena bajo la voz en off; se rotula al quedar solo.
  { const ini = inicio.s7 + desfaseVoz.s7 + durVoz("s7") + 0.15, fin = inicio.s7 + L.s7 - 0.1;
    if (fin - ini > 0.8) subt.push({ ini, fin, texto: "[Spanish desk audio: a four-voice round recorded in the public arena on 21 Oct]" }); }
  subt.sort((a, b) => a.ini - b.ini);
  for (let i = 0; i + 1 < subt.length; i++) if (subt[i].fin > subt[i + 1].ini - 0.02) subt[i].fin = subt[i + 1].ini - 0.02;
  const srtT = s => { const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), mi = Math.floor(ms / 60000) % 60, se = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(se).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };
  const partir = (t, max = 62) => { if (t.length <= max) return [t]; const pal = t.split(" "); let a = ""; const out = []; for (const p of pal) { if ((a + " " + p).trim().length > Math.ceil(t.length / Math.ceil(t.length / max)) + 6 && a) { out.push(a); a = p; } else a = (a + " " + p).trim(); } out.push(a); return out; };
  writeFileSync(SALIDA_SRT, subt.map((s, i) => `${i + 1}\n${srtT(s.ini)} --> ${srtT(s.fin)}\n${partir(s.texto).join("\n")}\n`).join("\n"));

  const asignacion = arena.asignacion;
  const rotulos = { ...ROTULO,
    s2: `Home: ${asignacion.local.nombre} · Away: ${asignacion.visita.nombre} · same observation, strict JSON, 60 s deadline, programmed fallback`,
    s4: `Real audio from this match · desk exchange${relato4.variante === "breve" ? " (short variant)" : ""}: ${(relato4.fragmentos ?? []).map(f => f.rol === "comentarista" ? `Commentator (${modoInt === "llm" ? "LLM, verified" : "template fallback"})` : f.rol === "estadista" ? "Statistician (deterministic)" : "Narrator (template)").join(" → ")}`,
    s6: arena.analisis?.cuerpo?.comentario?.modo === "llm" ? "Microsoft Foundry Agent Service · agent cronista-analista:1 · tools reject future ticks" : "Microsoft Foundry Agent Service · this answer: verified template fallback · tools reject future ticks",
  };
  const assT = s => { const cs = Math.round(s * 100); return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, "0")}:${String(Math.floor(cs / 100) % 60).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`; };
  const ev = [];
  const rot = (texto, ini, fin) => ev.push(`Dialogue: 1,${assT(ini)},${assT(fin)},Rotulo,,0,0,0,,${texto}`);
  for (const e of ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"]) rot(rotulos[e], inicio[e] + 0.15, inicio[e] + L[e] - 0.1);
  const s9b = escenas.at(-1).piezas[2].inicioFinal;
  rot(rotulos.s9a, inicio.s9 + 0.15, s9b); rot(rotulos.s9b, s9b, total - 0.05);
  for (const s of subt) ev.push(`Dialogue: 0,${assT(s.ini)},${assT(s.fin)},Sub,,0,0,0,,${partir(s.texto).join("\\N")}`);
  const ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${ANCHO}\nPlayResY: ${ALTO}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Sub,Liberation Sans,31,&H00FFFFFF,&H00FFFFFF,&H30201208,&H30201208,1,0,0,0,100,100,0,0,3,8,0,2,140,140,30,1\nStyle: Rotulo,Liberation Sans,24,&H003AFFD4,&H003AFFD4,&H18201208,&H18201208,1,0,0,0,100,100,0,0,3,9,0,8,300,300,14,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${ev.join("\n")}\n`;
  writeFileSync(join(dir, "subtitulos.ass"), ass);

  // 4) Vídeo final: subtítulos quemados, H.264 + AAC.
  ff(["-i", join(dir, "mudo.mp4"), "-i", join(dir, "mezcla.wav"), "-vf", `ass=${join(dir, "subtitulos.ass")}:fontsdir=/usr/share/fonts/truetype/liberation`, "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-maxrate", "3000k", "-bufsize", "6000k", "-pix_fmt", "yuv420p", "-r", String(FPS), "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-shortest", SALIDA]);
  const informe = { salida: SALIDA, duracionS: +duracion(SALIDA).toFixed(2), escenas: escenas.map(e => ({ id: e.id, inicioS: +inicio[e.id].toFixed(2), durS: +e.piezas.reduce((s, p) => s + p.dur, 0).toFixed(2), piezas: e.piezas.map(p => p.img ? { tarjeta: p.img.split("/").at(-1), dur: p.dur } : { fuente: p.src.split("/").at(-1), desdeS: +p.desde.toFixed(2), dur: p.dur }) })), rotulos, audioEscena4: audioSesion.map(a => ({ relato: a.relato, alInicio: +a.alInicio.toFixed(2), dur: +a.durUsada.toFixed(2) })), vozOff: VOZ_OFF, asignacion, sesion: arena.sesion };
  writeFileSync(join(dir, "informe.json"), JSON.stringify(informe, null, 1));
  console.log(JSON.stringify(informe, null, 1));
}

// Fase verificar: duración, flujos y fotogramas por escena para revisarlos a ojo.
function verificar() {
  const informe = JSON.parse(readFileSync(join(TRABAJO, "montaje", "informe.json"), "utf8"));
  let salida = ""; try { execFileSync(FF, ["-hide_banner", "-i", SALIDA], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); } catch (e) { salida = String(e.stderr); }
  const flujos = salida.split("\n").filter(l => /Stream #/.test(l)).map(l => l.trim());
  const dir = resolve("docs/entrega/capturas"); mkdirSync(dir, { recursive: true });
  const e = id => informe.escenas.find(x => x.id === id);
  const puntos = [["1-arena", e("s1").inicioS + 4], ["2-inicio", e("s2").inicioS + e("s2").durS - 2], ["3-planes", e("s3").inicioS + 7], ["4-mesa", e("s4").inicioS + e("s4").durS * 0.55],
    ["5-verificacion", e("s5").inicioS + 9], ["6-analista", e("s6").inicioS + e("s6").durS - 2], ["7-espanol", e("s7").inicioS + e("s7").durS - 2], ["8-cronica", e("s8").inicioS + 9], ["9-tarjeta", e("s9").inicioS + 2]];
  for (const [n, t] of puntos) ff(["-ss", t.toFixed(2), "-i", SALIDA, "-frames:v", "1", join(dir, `video-final-${n}.png`)]);
  const r = { duracionS: duracion(SALIDA), bytes: readFileSync(SALIDA).length, flujos, capturas: puntos.map(([n, t]) => ({ archivo: `docs/entrega/capturas/video-final-${n}.png`, t: +t.toFixed(2) })) };
  writeFileSync(join(TRABAJO, "montaje", "verificacion.json"), JSON.stringify(r, null, 1));
  console.log(JSON.stringify(r, null, 1));
  if (r.duracionS >= 115) throw new Error("El vídeo supera 1:55");
  if (!flujos.some(l => /Audio: aac/.test(l)) || !flujos.some(l => /Video: h264/.test(l))) throw new Error("Faltan flujos H.264/AAC");
}

for (const f of fases) {
  console.log(`== ${f}`);
  if (f === "arena") await grabarArena();
  else if (f === "recap") await grabarRecap();
  else if (f === "tarjetas") await tarjetas();
  else if (f === "voz") await voz();
  else if (f === "montar") montar();
  else if (f === "verificar") verificar();
  else throw new Error(`Fase desconocida: ${f}`);
}
