// Vídeo final de la entrega (docs/entrega/guion-video.md). Graba las dos apps públicas con
// Playwright, sintetiza la voz en off con Azure Speech, monta tarjetas propias y subtítulos.
// No modifica la app ni sube nada. Uso, desde la raíz del repo:
//   node scripts/grabar-video-final.mjs [--fases=arena,previa,recap,tarjetas,voz,montar,verificar] [--controladores=azar|programado] [--toma=arena]
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
const fases = arg("fases", "arena,previa,recap,tarjetas,voz,montar,verificar").split(",");
const controladores = arg("controladores", "azar");
const toma = arg("toma", "arena");
const duracionPartido = +arg("duracion", "60");
const [modeloLocal, modeloVisita] = arg("modelos", "sol6,luna6").split(",");
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
    const txt = sel => page.evaluate(s => document.querySelector(s)?.innerText ?? "", sel).catch(() => "");
    const visible = sel => page.evaluate(s => { const e = document.querySelector(s); return !!e && e.getBoundingClientRect().height > 0; }, sel).catch(() => false);
    // Duración (fuera de cuadro).
    { const dur = page.locator("select").filter({ has: page.locator(`option:text-is("${duracionPartido} s")`) }).first(); await dur.selectOption({ label: `${duracionPartido} s` }); }
    // Escena 1: nueva identidad (emblema, escudos, equipaciones) en el primer encuadre.
    await page.evaluate(() => window.scrollTo(0, 0)); await sleep(600);
    await g.marca("s1");
    await g.mover(page.locator(".arena-score").first(), 1600);
    await g.mover(page.getByTestId("arena-player").nth(3), 1500);
    await g.mover(page.getByTestId("arena-player").nth(16), 1500);
    // Escena 2: elección manual de modelos y arranque.
    const vivoPanel = page.getByTestId("arena-live");
    await g.desplazar(vivoPanel, 84, 1300);
    const select = vivoPanel.locator("select").first();
    await g.mover(select, 600);
    await g.marca("s2-modelos");
    if (controladores === "programado") await select.selectOption("programado");
    else {
      await select.selectOption("manual"); await sleep(700);
      const [local, visita] = [vivoPanel.locator("select").nth(1), vivoPanel.locator("select").nth(2)];
      await g.mover(local, 450); await local.selectOption(modeloLocal); await sleep(800);
      await g.mover(visita, 450); await visita.selectOption(modeloVisita); await sleep(800);
    }
    const boton = page.getByRole("button", { name: "Start live match" });
    await g.mover(boton, 500);
    await g.marca("s2-clic");
    { const b = await boton.boundingBox(); await page.mouse.click(b.x + 40, b.y + b.height / 2); }
    let arrancado = await g.esperar(async () => (await txt("[data-testid=arena-live-assignment]")) || null, 15_000, "asignación");
    if (!arrancado) throw new Error("El partido no arrancó: " + await txt("[data-testid=arena-live]"));
    await g.marca("s2-asignacion", { texto: arrancado });
    // Narración activada en cuanto existe el botón (emisión preparándose, reloj en 0): así suena la previa.
    const activar = page.getByRole("button", { name: "Enable narration" });
    await g.esperar(async () => activar.isVisible(), 60_000, "botón de narración");
    await g.desplazar(page.getByTestId("arena-buffer"), 120, 900);
    await g.mover(activar, 400);
    await g.marca("narracion", { texto: await txt("[data-testid=arena-buffer-status]") });
    { const bb = await activar.boundingBox(); await page.mouse.click(bb.x + 40, bb.y + bb.height / 2); }
    await sleep(400);
    // Escena 3: tarjeta de alineaciones mientras el estadista habla la previa.
    const conPrevia = await visible("[data-testid=arena-lineups]");
    if (conPrevia) await g.desplazar(page.getByTestId("arena-lineups"), 76, 1100);
    else { console.log("  ! la tarjeta de alineaciones ya no está (el reloj arrancó)"); await g.desplazar(page.getByTestId("arena-pitch"), 175, 900); }
    await page.mouse.move(ANCHO - 30, ALTO - 30, { steps: 8 });
    await g.marca("previa", { tarjeta: conPrevia });
    // Dirección de cámara: alineaciones mientras siguen visibles; luego cancha; mesa durante cada intercambio.
    let camara = conPrevia ? "previa" : "cancha";
    const ir = async destino => {
      if (destino === camara) return;
      camara = destino;
      if (destino === "cancha") await g.desplazar(page.getByTestId("arena-pitch"), 175, 700);
      else if (destino === "mesa") await g.desplazar(page.locator("[data-testid=arena-mesa-dialogo]").first(), 84, 700);
      await g.marca(`camara-${destino}`);
    };
    const finEmision = Date.now() + (duracionPartido + 150) * 1000;
    let finVisto = null;
    while (Date.now() < finEmision) {
      const ahora = Date.now();
      const eventos = await page.evaluate(() => window.__audio).catch(() => []);
      const sonando = eventos.filter(e => e.t <= ahora && ahora < (e.parada ?? e.t + (e.dur - e.offset) * 1000)).at(-1);
      const r = sonando?.tag ? estado.relatos.get(sonando.tag) : null;
      const esPreviaR = r?.intervencion?.startsWith("previa:");
      const esMesa = r?.intervencion && !esPreviaR && (r.fragmentos ?? []).some(f => f.rol === "comentarista" || f.rol === "estadista");
      if (camara === "previa") { if (!esPreviaR && !(await visible("[data-testid=arena-lineups]")) ) await ir("cancha"); }
      else if (esMesa && await visible("[data-testid=arena-mesa-dialogo]")) await ir("mesa");
      else if (!esMesa) await ir("cancha");
      const bs = await txt("[data-testid=arena-buffer]");
      if (/End of narration/.test(bs)) break;
      if (/End of broadcast/.test(bs)) { finVisto ??= ahora; if (ahora - finVisto > 25_000) break; }
      await sleep(250);
    }
    await g.marca("fin-emision", { texto: await txt("[data-testid=arena-buffer-status]") });
    await sleep(2000);
    // Escena: hechos y verificaciones en la tarjeta del comentarista.
    const tarjeta = page.getByTestId("arena-mesa-comentarista");
    await g.desplazar(tarjeta, 120, 1200);
    await g.pulsar(tarjeta.locator("details > summary").first(), 400);
    await g.marca("s5");
    await sleep(4500);
    await g.desplazar(tarjeta, 84, 1500);
    await sleep(5500);
    // Escena: cifras del partido (final) y ficha del goleador.
    const cifras = page.getByTestId("arena-stats");
    await g.desplazar(cifras, 84, 1300);
    await g.marca("s6-cifras");
    await sleep(3000);
    await g.desplazarPor(260, 1600);
    await sleep(1500);
    const goleador = estado.sesion ? await page.evaluate(async id => { const r = await fetch(`/api/arena/sesiones/${id}/emision`); if (!r.ok) return null; const j = await r.json(); return j.registro?.eventos?.filter(e => e.tipo === "gol" && !e.autogol).at(-1)?.jugador ?? null; }, estado.sesion).catch(() => null) : null;
    await g.desplazar(page.getByTestId("arena-pitch"), 175, 1100);
    const ficha = goleador ? page.locator(`[data-testid=arena-player][data-player="${goleador}"]`) : page.getByTestId("arena-player").nth(9);
    await g.pulsar((await ficha.count()) ? ficha.first() : page.getByTestId("arena-player").nth(9), 500);
    await g.marca("s6-seleccion", { jugador: goleador });
    await g.desplazar(page.getByTestId("arena-player-card"), 84, 1400);
    await g.marca("s6-jugador", { texto: (await txt("[data-testid=arena-player-card]")).slice(0, 600) });
    await sleep(5000);
    // Escena: descargar comentarios (Markdown).
    const descargas = page.getByTestId("arena-downloads");
    await g.desplazar(descargas, 220, 1300);
    const md = descargas.getByRole("button", { name: "Download commentary (Markdown)" });
    await g.mover(md, 700);
    await g.marca("s7");
    const espera = page.waitForEvent("download", { timeout: 20_000 });
    { const bb = await md.boundingBox(); await page.mouse.click(bb.x + 40, bb.y + bb.height / 2); }
    const descarga = await espera;
    await descarga.saveAs(join(dir, "descarga.md"));
    await g.marca("s7-descargado", { archivo: descarga.suggestedFilename() });
    await sleep(3000);
    // Escena: agente de Foundry.
    const asistente = page.getByTestId("arena-assistant");
    await g.desplazar(asistente, 90, 1200);
    const [pregunta, estilo] = [asistente.locator("select").nth(0), asistente.locator("select").nth(1)];
    await g.mover(pregunta, 500); await pregunta.selectOption("momento");
    await g.mover(estilo, 500); await estilo.selectOption("analyst");
    await g.marca("s8");
    const preguntar = asistente.getByRole("button", { name: "Ask analyst" });
    await g.mover(preguntar, 500);
    { const bb = await preguntar.boundingBox(); await page.mouse.click(bb.x + 40, bb.y + bb.height / 2); }
    await g.marca("s8-pregunta");
    const respuesta = await g.esperar(async () => (await asistente.getByTestId("arena-assistant-answer").count()) > 0 || (await asistente.getByRole("alert").count()) > 0, 90_000, "respuesta del analista");
    await sleep(400);
    await g.marca("s8-respuesta", { texto: await txt("[data-testid=arena-assistant-answer]") });
    if (respuesta && await asistente.getByTestId("arena-assistant-answer").count()) {
      await sleep(2200);
      await g.pulsar(asistente.getByTestId("arena-assistant-answer").locator("summary"), 300);
      await g.marca("s8-herramientas", { texto: await txt("[data-testid=arena-assistant-answer]") });
      await g.desplazar(asistente.getByTestId("arena-assistant-answer"), 120, 1200);
      await sleep(4500);
    }
    // Fotograma final.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); await sleep(1300);
    await page.mouse.move(ANCHO - 20, ALTO - 20, { steps: 6 });
    await g.marca("fin");
    await sleep(4000);
    // Datos para subtítulos e informe: eventos de audio y registro de la sesión.
    const eventos = await page.evaluate(() => window.__audio);
    const sesion = estado.sesion ? await page.evaluate(async id => { const r = await fetch(`/api/arena/sesiones/${id}/emision`); return r.ok ? r.json() : { http: r.status }; }, estado.sesion).catch(() => null) : null;
    writeFileSync(join(dir, "datos.json"), JSON.stringify({ t0, url: ARENA, controladores, sesion: estado.sesion, asignacion: estado.asignacion, marcas: g.marcas, eventosAudio: eventos.map(e => ({ ...e, t: (e.t - t0) / 1000, parada: e.parada === null ? null : (e.parada - t0) / 1000, relato: estado.relatos.get(e.tag)?.archivo ?? null })), analisis: estado.analisis, errores: estado.errores, peticionesRelato: estado.peticionesRelato }, null, 1));
    if (sesion) writeFileSync(join(dir, "emision.json"), JSON.stringify({ estado: sesion.estado, metricas: sesion.metricas, asignacion: sesion.asignacion, reglas: sesion.registro?.config?.reglas ?? null, marcador: sesion.registro?.final?.marcador ?? null, goles: (sesion.registro?.eventos ?? []).filter(e => e.tipo === "gol"), intervenciones: sesion.intervenciones ?? sesion.registro?.intervenciones ?? null }, null, 1));
  } finally {
    await context.close();
    await browser.close();
  }
  const video = readdirSync(dir).filter(f => f.endsWith(".webm")).map(f => join(dir, f)).at(-1);
  renameSync(video, join(dir, "arena.webm"));
}

// --------------------------------------------------------------------------------------------
// Fase previa: el mismo partido, guardado, con «Reproducir con narración» (brief 057) desde 0:00:
// la tarjeta de alineaciones y la previa hablada del estadista tal como la reproduce la página.
async function grabarPrevia() {
  const base = join(TRABAJO, toma), dir = join(base, "previa"); mkdirSync(dir, { recursive: true });
  const sesion = JSON.parse(readFileSync(join(base, "datos.json"), "utf8")).sesion;
  if (!sesion) throw new Error("La toma no tiene sesión");
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const context = await browser.newContext({ viewport: { width: ANCHO, height: ALTO }, colorScheme: "dark", locale: "en-US", recordVideo: { dir, size: { width: ANCHO, height: ALTO } } });
  await context.addInitScript(scriptCursor);
  const t0 = Date.now(), page = await context.newPage(), g = grabador(page, t0, dir);
  const piezas = [];
  page.on("response", async r => {
    if (!/\/relato$/.test(r.url()) || !r.ok()) return;
    try { const j = await r.json(); if (j.intervencion?.startsWith("previa:") && j.audio?.base64) { const n = piezas.length; writeFileSync(join(dir, `previa-${n}.mp3`), Buffer.from(j.audio.base64, "base64")); const { audio, ...resto } = j; piezas.push({ archivo: `previa-${n}.mp3`, recibidoS: (Date.now() - t0) / 1000, ...resto }); } } catch { /* parcial */ }
  });
  const audioEstado = () => page.evaluate(() => { const a = document.querySelector("[data-testid=arena-narration] audio"); return a ? { t: Date.now(), c: a.currentTime, pausado: a.paused } : null; });
  let datos;
  try {
    await page.goto(`${ARENA}?partido=${sesion}`, { waitUntil: "networkidle", timeout: 180_000 });
    await page.getByTestId("arena-lineups").waitFor({ timeout: 60_000 });
    await sleep(1000);
    const voz = page.getByTestId("arena-play-voice");
    await voz.waitFor({ timeout: 30_000 });
    if (!(await voz.isChecked())) await voz.check();
    const play = page.locator(".arena-playback button.btn-primary").first();
    await g.desplazar(page.getByTestId("arena-pitch"), 175, 900);
    await g.mover(play, 500);
    await g.marca("play");
    { const b = await play.boundingBox(); await page.mouse.click(b.x + 30, b.y + b.height / 2); }
    await sleep(600);
    await g.desplazar(page.getByTestId("arena-lineups"), 76, 1000);
    await page.mouse.move(ANCHO - 30, ALTO - 30, { steps: 8 });
    const sonando = await g.esperar(async () => { const e = await audioEstado(); return e && !e.pausado && e.c > 0.05 ? e : null; }, 120_000, "pista narrada");
    if (!sonando) throw new Error("La pista narrada no empezó");
    await g.marca("sonando", { audioC: sonando.c, audioT: (sonando.t - t0) / 1000 });
    await sleep(17_000);
    const fin = await audioEstado();
    await g.marca("fin", { audioC: fin?.c, tarjeta: await page.evaluate(() => { const e = document.querySelector("[data-testid=arena-lineups]"); return !!e && e.getBoundingClientRect().height > 0; }) });
    await page.evaluate(() => document.querySelector("[data-testid=arena-narration] audio")?.pause());
    await sleep(500);
    datos = { t0, url: `${ARENA}?partido=${sesion}`, sesion, marcas: g.marcas, piezas };
  } finally { await context.close(); await browser.close(); }
  writeFileSync(join(dir, "datos.json"), JSON.stringify(datos, null, 1));
  const video = readdirSync(dir).filter(f => f.endsWith(".webm") && f !== "previa.webm").map(f => join(dir, f)).at(-1);
  renameSync(video, join(dir, "previa.webm"));
  console.log(JSON.stringify({ piezas: piezas.map(p => [p.archivo, p.intervencion, p.texto?.slice(0, 80)]), marcas: datos.marcas.map(m => [m.nombre, m.t, m.audioC]) }, null, 1));
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
  <div class="grid"><div class="box k"><b>Home coach</b><span>LLM · Azure OpenAI deployment · JSON plan per player</span></div><div class="box k"><b>Away coach</b><span>GPT-6 Sol · GPT-6 Luna · GPT-5.6 Luna · GPT-5.4 mini</span></div></div>
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
 <h1>More than two thousand automated checks</h1>
 <div class="grid" style="grid-template-columns:1fr 1fr 1fr">
  <div class="box" style="padding:30px"><div class="num">2,395</div><div class="lbl">unit, invariant, oracle and lie-battery tests</div></div>
  <div class="box" style="padding:30px"><div class="num">190</div><div class="lbl">Playwright journeys</div></div>
  <div class="box" style="padding:30px"><div class="num">61</div><div class="lbl">statistical checks over simulated matches (last run 22 Oct)</div></div>
 </div>
 <p style="margin-top:34px"><span class="ci"><i>CI</i><em>passed</em></span> <span style="color:var(--muted);font-size:21px;margin-left:12px">run 39883072278 · three jobs · commit 368357e · 23 Oct 2026</span></p>
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
  // Vista previa del archivo descargado en la toma (nombre real y primeras líneas reales).
  const datosToma = join(TRABAJO, toma, "datos.json"), md = join(TRABAJO, toma, "descarga.md");
  if (existsSync(datosToma) && existsSync(md)) {
    const nombre = JSON.parse(readFileSync(datosToma, "utf8")).marcas.find(m => m.nombre === "s7-descargado")?.archivo ?? "commentary.md";
    const todas = readFileSync(md, "utf8").split("\n").filter(l => l.trim());
    const emision = todas.findIndex(l => /^## Broadcast/.test(l));
    const lineas = [...todas.slice(0, 2), "…", ...todas.slice(emision, emision + 10)];
    const esc = t => t.replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]);
    const html = TARJETAS_HTML.replace(/<main id="arquitectura">[\s\S]*<\/html>/, `<main id="descarga"><div class="brand">CRONISTA</div><div class="over">Downloaded from the public arena in this recording</div>
<h1 style="font-size:40px;margin-bottom:18px">${esc(nombre)}</h1>
<pre style="background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:20px 24px;margin:0;font:17px/1.5 'DejaVu Sans Mono',monospace;color:var(--ink);white-space:pre-wrap;overflow:hidden;max-height:470px">${lineas.map(esc).join("\n")}</pre>
<div class="foot">Unedited excerpt: the first two lines and the start of the broadcast section (“…” marks the skipped summary).</div></main></html>`);
    writeFileSync(join(dir, "descarga.html"), html);
    await page.goto("file://" + join(dir, "descarga.html"), { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.locator("#descarga").screenshot({ path: join(dir, "descarga.png") });
  }
  await browser.close();
}

// --------------------------------------------------------------------------------------------
// Fase voz: voz en off en inglés con Azure Speech (misma llamada REST que src/arena/voz.ts).
const VOZ = {
  gancho: "AI can call a football match. Can it prove what it says? CRONISTA is a multi-agent broadcast where every sentence is traceable.",
  modelos: "Two LLM coaches, GPT-6 Sol and GPT-6 Luna, receive the same committed observation and return a plan for every player. A shared deterministic engine resolves the play; the clock waits for both.",
  verificacion: "The commentator may only analyse with a cited fact. Eight deterministic rules check citations, numbers, names and claims. A failed sentence is retried once, then replaced by a labelled template.",
  cifras: "Match stats and each player's numbers are computed only from confirmed events, live as the broadcast plays.",
  descarga: "Every line of the commentary can be downloaded, with its time, voice, evidence and checks.",
  analista: "A versioned Microsoft Foundry agent answers viewer questions with read-only tools over the confirmed play only. Its sentences pass the same verifier.",
  cronica: "The same verifier guards the automated recap: click any sentence to see its events and open the process view with every draft and verdict. We claim traceability, not better prose.",
  cierre: "It runs on Azure Container Apps with Blob, Key Vault, Application Insights, Speech and Foundry. More than two thousand automated tests run in CI. Everything is synthetic. CRONISTA: narrate the match, prove every sentence.",
};
const RITMO = { gancho: "+9%", modelos: "+12%", verificacion: "+10%", cronica: "+12%", cierre: "+15%" };
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
  gancho: "CRONISTA — multi-agent match broadcast · own emblem, fictional crests and kits · every sentence traceable",
  previa: "Pre-match · same match replayed with narration from Saved matches · line-up card and the statistician's spoken pre-match, real audio as played",
  gol: "Goal call · real narrator audio as played in the live broadcast · ball in the net, GOAL banner, goal view (height illustrative)",
  verificacion: "V1–V8: schema · citations · numbers · names · coverage · ES=EN · negations · strong claims",
  cifras: "Match stats and the selected player's stats · counted from confirmed engine events · estimates labelled",
  descarga: "Download commentary · Markdown or JSON · each line with time, voice, evidence and checks",
  cronica: "Automated recap · GPT-6.1 Sol · 0/163 baseline, 0/167 pipeline flagged · no reduction demonstrated",
  cierreA: "Azure OpenAI · Foundry Agent Service · Azure Speech · Container Apps + Jobs · Blob · Key Vault · App Insights · ACR · Bicep · GitHub Actions",
  cierreB: "All data synthetic · open source · claims link to evidence",
};
function montar() {
  const dir = join(TRABAJO, "montaje"); mkdirSync(dir, { recursive: true });
  const arena = JSON.parse(readFileSync(join(TRABAJO, toma, "datos.json"), "utf8"));
  const recap = JSON.parse(readFileSync(join(TRABAJO, "recap", "datos.json"), "utf8"));
  const vozOff = JSON.parse(readFileSync(join(TRABAJO, "voz", "voz.json"), "utf8")).escenas;
  const m = (datos, n) => { const x = datos.marcas.findLast(k => k.nombre === n); if (!x) throw new Error(`Falta la marca ${n}`); return x; };
  const A = join(TRABAJO, toma, "arena.webm"), R = join(TRABAJO, "recap", "recap.webm"), T = join(TRABAJO, "tarjetas");
  const durVoz = e => vozOff[e].duracionS;
  const largo = (e, ranura) => Math.max(ranura, +(durVoz(e) + 0.7).toFixed(2));
  const sin = arg("sin", "").split(",").filter(Boolean);

  // Audio real de la sesión: cada clip que la página arrancó, identificado por huella.
  const dirRelatos = join(TRABAJO, toma, "relatos"), porHuella = new Map(), porArchivo = new Map();
  for (const f of readdirSync(dirRelatos).filter(f => f.endsWith(".json"))) { const j = JSON.parse(readFileSync(join(dirRelatos, f), "utf8")); porHuella.set(j.tag, j.archivo); porArchivo.set(j.archivo, j); }
  const eventos = arena.eventosAudio.map(e => ({ ...e, relato: e.relato ?? porHuella.get(e.tag) ?? null, fin: e.parada ?? e.t + (e.dur - e.offset) }));
  const rel = e => porArchivo.get(e.relato);
  const completo = e => e.offset === 0 && (e.parada === null || e.parada >= e.t + e.dur - 0.15);
  const esCanto = r => r?.temaVoz === "gol" || (r?.fragmentos ?? []).some(f => f.canto);
  const esPreviaR = r => !!r?.intervencion?.startsWith("previa:");
  const esIntercambioLlm = r => !!r?.intervencion && !esPreviaR(r) && (r.fragmentos ?? []).some(f => f.rol === "comentarista") && r.modoIntervencion === "llm";
  const esIntercambioCualquiera = r => !!r?.intervencion && !esPreviaR(r) && (r.fragmentos ?? []).some(f => f.rol === "comentarista");
  const desdeMesa = m(arena, "previa").t + 0.3, hastaMesa = m(arena, "fin-emision").t;
  const enMesa = eventos.filter(e => e.relato && e.t >= desdeMesa && e.fin <= hastaMesa && completo(e));
  const cantos = enMesa.filter(e => esCanto(rel(e)));
  let intercambios = enMesa.filter(e => esIntercambioLlm(rel(e)));
  if (!intercambios.length) intercambios = enMesa.filter(e => esIntercambioCualquiera(rel(e)));
  if (!cantos.length) throw new Error("No sonó ningún canto de gol completo en la vista de la cancha");
  const ajustar = (ini, fin) => {
    for (const e of eventos) if (e.t < ini && e.fin > ini) ini = e.fin + 0.03;
    for (const e of eventos) if (e.t > ini && e.t < fin && e.fin > fin + 0.05) fin = e.t - 0.02;
    return [Math.max(ini, desdeMesa), Math.min(fin, hastaMesa)];
  };
  // Preferencia: un canto seguido del intercambio del comentarista sobre ese gol (una sola toma continua).
  let canto = cantos[0], tras = null;
  for (const c of cantos) { const x = intercambios.find(i => i.t > c.fin && i.t - c.fin < 12); if (x) { canto = c; tras = x; break; } }
  const ventanas = [];
  if (tras && tras.fin + 1 - (canto.t - 1.5) <= 27) ventanas.push({ id: "gol", ini: canto.t - 1.5, fin: tras.fin + 1.0, cambio: tras.t - 0.3, intercambio: tras });
  else {
    ventanas.push({ id: "gol", ini: canto.t - 1.5, fin: canto.fin + 1.2 });
    const x = intercambios.find(i => i.t > canto.fin + 2) ?? intercambios.find(i => i.fin < canto.t - 2);
    if (x) ventanas.push({ id: "mesa", ini: x.t - 1.0, fin: x.fin + 1.0, intercambio: x });
  }
  for (const v of ventanas) {
    const ancla = v.id === "gol" ? canto : v.intercambio;
    [v.ini, v.fin] = ajustar(v.ini, v.fin);
    // Nunca empezar después de la locución que da sentido a la ventana (el canto o el intercambio).
    if (ancla && v.ini > ancla.t - 0.4) v.ini = Math.max(desdeMesa, ancla.t - 0.4);
    v.dur = +(v.fin - v.ini).toFixed(2);
  }
  console.log("  · cantos", cantos.map(c => [c.relato, +c.t.toFixed(1)]), "intercambios", intercambios.map(c => [c.relato, +c.t.toFixed(1)]), "ventanas", ventanas.map(v => [v.id, +v.ini.toFixed(1), +v.fin.toFixed(1)]));

  const vivo = m(arena, "narracion").t + 1.0, mod = m(arena, "s2-modelos").t, clic = m(arena, "s2-clic").t;
  // Previa: el mismo partido reproducido con narración desde «Saved matches» (fase previa); la primera
  // pieza del estadista suena al principio de la pista narrada, con la tarjeta de alineaciones en pantalla.
  const dirPrevia = join(TRABAJO, toma, "previa"), P = join(dirPrevia, "previa.webm");
  let ventanaPrevia = null;
  if (existsSync(join(dirPrevia, "datos.json"))) {
    const dp = JSON.parse(readFileSync(join(dirPrevia, "datos.json"), "utf8")), son = dp.marcas.find(k => k.nombre === "sonando");
    const pieza = dp.piezas.find(x => x.intervencion === "previa:1-local:0");
    if (son && pieza) {
      const durPieza = duracion(join(dirPrevia, pieza.archivo)), cero = son.t - son.audioC;
      ventanaPrevia = { id: "previa", ini: cero - 0.6, fin: cero + durPieza + 0.6, dur: +(durPieza + 1.2).toFixed(2), pieza, durPieza, desfase: 0.6 };
    }
  }
  if (!ventanaPrevia) console.log("  ! sin fase previa: la escena de la previa se omite");
  const L = { gancho: largo("gancho", 8), modelos: largo("modelos", 13), verificacion: largo("verificacion", 12), cifras: largo("cifras", 10.5), descarga: largo("descarga", 8.5), analista: largo("analista", 10), cronica: largo("cronica", 11), cierre: largo("cierre", 12) };
  const piezaA2 = +(clic + 2.6 - (mod - 0.6)).toFixed(2);
  const s8 = m(arena, "s8").t, s8p = m(arena, "s8-pregunta").t, s8r = m(arena, "s8-respuesta").t, piezaA8 = +(s8p + 1.6 - (s8 - 1.8)).toFixed(2);
  const escenas = [
    { id: "gancho", voz: "gancho", piezas: [{ src: A, desde: m(arena, "s1").t - 0.3, dur: L.gancho }] },
    { id: "modelos", voz: "modelos", piezas: [{ src: A, desde: mod - 0.6, dur: piezaA2 }, { src: A, desde: Math.max(clic + 2.6, vivo - 0.6 - (L.modelos - piezaA2)), dur: +(L.modelos - piezaA2).toFixed(2) }] },
    ...(ventanaPrevia ? [{ id: "previa", piezas: [{ src: P, desde: ventanaPrevia.ini, dur: ventanaPrevia.dur }], previa: ventanaPrevia }] : []),
    ...ventanas.map(v => ({ id: v.id, piezas: [{ src: A, desde: v.ini, dur: v.dur }], ventana: v })),
    { id: "verificacion", voz: "verificacion", piezas: [{ src: A, desde: m(arena, "s5").t - 0.8, dur: L.verificacion }] },
    { id: "cifras", voz: "cifras", piezas: [{ src: A, desde: m(arena, "s6-cifras").t - 0.4, dur: 5.6 }, { src: A, desde: m(arena, "s6-jugador").t - 0.3, dur: +(L.cifras - 5.6).toFixed(2) }] },
    { id: "descarga", voz: "descarga", piezas: [{ src: A, desde: m(arena, "s7").t - 1.6, dur: 3.6 }, { img: join(T, "descarga.png"), dur: +(L.descarga - 3.6).toFixed(2) }] },
    { id: "analista", voz: "analista", piezas: [{ src: A, desde: s8 - 1.8, dur: piezaA8 }, { src: A, desde: (arena.marcas.some(k => k.nombre === "s8-herramientas") ? m(arena, "s8-herramientas").t - 1.0 : s8r - 0.6), dur: +(L.analista - piezaA8).toFixed(2) }] },
    { id: "cronica", voz: "cronica", piezas: [{ src: R, desde: m(recap, "r-clic").t - 2.6, dur: L.cronica }] },
  ].filter(e => !sin.includes(e.id));
  const fin9 = 1.6, cartas = L.cierre - fin9, c1 = +(cartas * 0.38).toFixed(2), c2 = +(cartas * 0.32).toFixed(2);
  escenas.push({ id: "cierre", voz: "cierre", piezas: [{ img: join(T, "arquitectura.png"), dur: c1 }, { img: join(T, "azure.png"), dur: c2 }, { img: join(T, "calidad.png"), dur: +(cartas - c1 - c2).toFixed(2) }, { src: A, desde: m(arena, "fin").t + 0.6, dur: fin9 }] });
  const durTotal = () => escenas.reduce((s, e) => s + e.piezas.reduce((t, p) => t + p.dur, 0), 0);
  // Recorte automático para quedar ≤ 1:55: primero la crónica, luego el analista.
  for (const id of ["cronica", "analista"]) if (durTotal() > 114.9 && escenas.some(e => e.id === id)) { escenas.splice(escenas.findIndex(e => e.id === id), 1); sin.push(id); console.log(`  · escena omitida por duración: ${id}`); }
  const total = durTotal();
  console.log(`  · duración prevista ${total.toFixed(2)} s`);
  if (total > 114.9) throw new Error(`Supera 1:55 (${total.toFixed(2)} s): usa --sin=<escena>`);

  // 1) Segmentos de vídeo.
  const segmentos = []; let n = 0, reloj = 0; const inicio = {};
  for (const e of escenas) {
    inicio[e.id] = reloj; e.dur = e.piezas.reduce((t, p) => t + p.dur, 0);
    for (const p of e.piezas) {
      const out = join(dir, `seg-${String(n++).padStart(2, "0")}.mp4`), vf = `scale=${ANCHO}:${ALTO}:flags=lanczos,fps=${FPS},format=yuv420p`;
      if (p.img) ff(["-loop", "1", "-t", String(p.dur), "-i", p.img, "-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-an", out]);
      else ff(["-ss", p.desde.toFixed(3), "-i", p.src, "-t", String(p.dur), "-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-an", out]);
      segmentos.push(out); p.inicioFinal = reloj; reloj += p.dur;
    }
  }
  writeFileSync(join(dir, "lista.txt"), segmentos.map(s => `file '${s}'`).join("\n") + "\n");
  ff(["-f", "concat", "-safe", "0", "-i", join(dir, "lista.txt"), "-c", "copy", join(dir, "mudo.mp4")]);

  // 2) Audio: voz en off y audio real de la sesión en las ventanas del gol y de la mesa.
  const entradas = [], filtros = [], subt = [], audioSesion = [];
  const agregar = (archivo, alInicio, { volumen = 1, desde = 0, dur = null } = {}) => {
    const k = entradas.length / 2; entradas.push("-i", archivo);
    filtros.push(`[${k}:a]aresample=48000,aformat=channel_layouts=mono,atrim=start=${desde.toFixed(3)}${dur ? `:duration=${dur.toFixed(3)}` : ""},asetpts=PTS-STARTPTS,afade=t=in:d=0.03,volume=${volumen},adelay=${Math.round(alInicio * 1000)}:all=1[a${k}]`);
  };
  const desfase = e => e === "gancho" || e === "cierre" ? 0.25 : 0.3;
  const repartir = (texto, desde, dur) => {
    const frases = texto.split(/(?<=[.?!;:]["»]?)\s+/).map(s => s.trim()).filter(Boolean), trozos = [];
    for (const f of frases) { if (trozos.length && (trozos.at(-1) + " " + f).length <= 84 && !/[.?!]$/.test(trozos.at(-1))) trozos[trozos.length - 1] += " " + f; else trozos.push(f); }
    const tot = trozos.reduce((s, t) => s + t.length, 0); let t = desde;
    for (const tr of trozos) { const d = dur * tr.length / tot; subt.push({ ini: t, fin: t + d - 0.04, texto: tr }); t += d; }
  };
  for (const e of escenas.filter(e => e.voz)) { agregar(join(TRABAJO, "voz", `${e.voz}.wav`), inicio[e.id] + desfase(e.id)); repartir(VOZ[e.voz], inicio[e.id] + desfase(e.id) + 0.05, durVoz(e.voz) - 0.25); }
  const rolDe = (r, f) => esPreviaR(r) ? (f.rol === "estadista" ? "Statistician (spoken pre-match)" : "Narrator (pre-match)") : f.rol === "comentarista" ? `Commentator (${r.modoIntervencion === "llm" ? "LLM, verified" : "template fallback"})` : f.rol === "estadista" ? "Statistician (deterministic)"
    : f.canto || r.temaVoz === "gol" ? "Narrator (goal call)" : r.reserva ? "Narrator (backup clip)" : r.intervencion ? "Narrator (template)" : "Narrator (play-by-play)";
  for (const e of escenas.filter(e => e.previa)) {
    const v = e.previa, alInicio = inicio[e.id] + v.desfase;
    agregar(join(dirPrevia, v.pieza.archivo), alInicio, { dur: v.durPieza });
    audioSesion.push({ escena: e.id, relato: `previa/${v.pieza.archivo}`, alInicio: +alInicio.toFixed(2), dur: +v.durPieza.toFixed(2) });
    const texto = v.pieza.texto, frases = texto.split(/(?<=[.;])\s+/), tot = texto.length; let t = alInicio + 0.1;
    for (const [i, fr] of frases.entries()) { const d = (v.durPieza - 0.3) * fr.length / tot; subt.push({ ini: t, fin: t + d - 0.04, texto: i === 0 ? `Statistician (spoken pre-match): ${fr}` : fr }); t += d; }
  }
  for (const e of escenas.filter(e => e.ventana)) {
    const v = e.ventana;
    for (const ev of eventos.filter(x => x.relato && x.t >= v.ini - 0.05 && x.fin <= v.fin + 0.05 && x.fin - x.t >= 0.6)) {
      const alInicio = inicio[e.id] + (ev.t - v.ini), dur = ev.fin - ev.t;
      agregar(join(dirRelatos, ev.relato), alInicio, { desde: ev.offset, dur });
      audioSesion.push({ escena: e.id, relato: ev.relato, alInicio: +alInicio.toFixed(2), dur: +dur.toFixed(2) });
      const r = rel(ev);
      let frags = r.fragmentos?.length ? r.fragmentos : [{ rol: "narrador", texto: r.texto }];
      // Locución cortada por la propia emisión (una noticia posterior): el subtítulo se corta igual.
      if (ev.parada !== null && ev.parada < ev.t + ev.dur - 0.15) { const total = frags.reduce((s, f) => s + f.texto.length, 0), corte = total * dur / ev.dur; let acum = 0; frags = frags.flatMap(f => { if (acum >= corte) return []; const resto = corte - acum; acum += f.texto.length; if (f.texto.length <= resto) return [f]; const pal = f.texto.slice(0, Math.max(1, Math.floor(resto))).replace(/\s+\S*$/, ""); return [{ ...f, texto: `${pal}…` }]; }); }
      const chars = frags.reduce((s, f) => s + f.texto.length, 0); let t = alInicio + 0.1;
      for (const f of frags) { const d = (dur - 0.4) * f.texto.length / chars; subt.push({ ini: t, fin: t + d - 0.04, texto: `${rolDe(r, f)}: ${f.texto}` }); t += d; }
    }
  }
  const k = entradas.length / 2;
  filtros.push(`${Array.from({ length: k }, (_, i) => `[a${i}]`).join("")}amix=inputs=${k}:normalize=0:dropout_transition=0,apad,atrim=duration=${total.toFixed(3)},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[mez]`);
  writeFileSync(join(dir, "filtros-audio.txt"), filtros.join(";\n"));
  ff([...entradas, "-filter_complex_script", join(dir, "filtros-audio.txt"), "-map", "[mez]", "-ac", "2", "-c:a", "pcm_s16le", join(dir, "mezcla.wav")]);

  // 3) Subtítulos: transcripción (SRT) y rótulos (ASS).
  subt.sort((a, b) => a.ini - b.ini);
  for (let i = 0; i + 1 < subt.length; i++) if (subt[i].fin > subt[i + 1].ini - 0.02) subt[i].fin = subt[i + 1].ini - 0.02;
  const srtT = s => { const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), mi = Math.floor(ms / 60000) % 60, se = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(se).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };
  const partir = (t, max = 62) => { if (t.length <= max) return [t]; const pal = t.split(" "); let a = ""; const out = []; for (const p of pal) { if ((a + " " + p).trim().length > Math.ceil(t.length / Math.ceil(t.length / max)) + 6 && a) { out.push(a); a = p; } else a = (a + " " + p).trim(); } out.push(a); return out; };
  writeFileSync(SALIDA_SRT, subt.map((s, i) => `${i + 1}\n${srtT(s.ini)} --> ${srtT(s.fin)}\n${partir(s.texto).join("\n")}\n`).join("\n"));
  const asignacion = arena.asignacion;
  const rotuloMesa = x => { const r = rel(x); return `Real audio from this match · desk exchange${r.variante === "breve" ? " (short variant)" : ""}: ${(r.fragmentos ?? []).map(f => f.rol === "comentarista" ? `Commentator (${r.modoIntervencion === "llm" ? "LLM, verified" : "template fallback"})` : f.rol === "estadista" ? "Statistician (deterministic)" : "Narrator (template)").join(" → ")}`; };
  const rotulos = { ...ROTULO,
    modelos: `Home: ${asignacion.local.nombre} · Away: ${asignacion.visita.nombre} · chosen manually · same observation, strict JSON, 60 s deadline`,
    analista: arena.analisis?.cuerpo?.comentario?.modo === "llm" ? "Microsoft Foundry Agent Service · agent cronista-analista:1 · tools reject future ticks" : "Microsoft Foundry Agent Service · this answer: verified template fallback · tools reject future ticks",
  };
  const assT = s => { const cs = Math.round(s * 100); return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, "0")}:${String(Math.floor(cs / 100) % 60).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`; };
  const ev = [], rot = (texto, ini, fin) => ev.push(`Dialogue: 1,${assT(ini)},${assT(fin)},Rotulo,,0,0,0,,${texto}`);
  for (const e of escenas) {
    const a = inicio[e.id] + 0.15, b = inicio[e.id] + e.dur - 0.1;
    if (e.id === "cierre") { const c3 = e.piezas[2].inicioFinal; rot(rotulos.cierreA, a, c3); rot(rotulos.cierreB, c3, b + 0.05); }
    else if (e.ventana?.cambio) { const c = inicio[e.id] + (e.ventana.cambio - e.ventana.ini); rot(rotulos.gol, a, c); rot(rotuloMesa(e.ventana.intercambio), c, b); }
    else if (e.id === "mesa") rot(rotuloMesa(e.ventana.intercambio), a, b);
    else rot(rotulos[e.id], a, b);
  }
  for (const s of subt) ev.push(`Dialogue: 0,${assT(s.ini)},${assT(s.fin)},Sub,,0,0,0,,${partir(s.texto).join("\\N")}`);
  const ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${ANCHO}\nPlayResY: ${ALTO}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Sub,Liberation Sans,31,&H00FFFFFF,&H00FFFFFF,&H30201208,&H30201208,1,0,0,0,100,100,0,0,3,8,0,2,140,140,30,1\nStyle: Rotulo,Liberation Sans,24,&H003AFFD4,&H003AFFD4,&H18201208,&H18201208,1,0,0,0,100,100,0,0,3,9,0,8,300,300,14,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${ev.join("\n")}\n`;
  writeFileSync(join(dir, "subtitulos.ass"), ass);

  // 4) Vídeo final.
  ff(["-i", join(dir, "mudo.mp4"), "-i", join(dir, "mezcla.wav"), "-vf", `ass=${join(dir, "subtitulos.ass")}:fontsdir=/usr/share/fonts/truetype/liberation`, "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-maxrate", "3000k", "-bufsize", "6000k", "-pix_fmt", "yuv420p", "-r", String(FPS), "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-shortest", SALIDA]);
  const informe = { salida: SALIDA, duracionS: +duracion(SALIDA).toFixed(2), escenas: escenas.map(e => ({ id: e.id, inicioS: +inicio[e.id].toFixed(2), durS: +e.dur.toFixed(2), piezas: e.piezas.map(p => p.img ? { tarjeta: p.img.split("/").at(-1), dur: p.dur } : { fuente: p.src.split("/").at(-1), desdeS: +p.desde.toFixed(2), dur: p.dur }) })), rotulos, audioSesion, vozOff: VOZ_OFF, asignacion, sesion: arena.sesion, omitidas: sin };
  writeFileSync(join(dir, "informe.json"), JSON.stringify(informe, null, 1));
  console.log(JSON.stringify({ duracionS: informe.duracionS, escenas: informe.escenas.map(e => `${e.id} ${e.inicioS}+${e.durS}`), audioSesion }, null, 1));
}

// Fase verificar: duración, flujos y un fotograma por escena para revisarlos a ojo.
function verificar() {
  const informe = JSON.parse(readFileSync(join(TRABAJO, "montaje", "informe.json"), "utf8"));
  let salida = ""; try { execFileSync(FF, ["-hide_banner", "-i", SALIDA], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); } catch (e) { salida = String(e.stderr); }
  const flujos = salida.split("\n").filter(l => /Stream #/.test(l)).map(l => l.trim());
  const dir = resolve("docs/entrega/capturas"); mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir).filter(f => f.startsWith("video-final-"))) execFileSync("rm", ["-f", join(dir, f)]);
  const puntos = informe.escenas.map((e, i) => [`${i + 1}-${e.id}`, e.inicioS + e.durS * (e.id === "cierre" ? 0.15 : 0.6)]);
  for (const [nombre, t] of puntos) ff(["-ss", t.toFixed(2), "-i", SALIDA, "-frames:v", "1", join(dir, `video-final-${nombre}.png`)]);
  const r = { duracionS: duracion(SALIDA), bytes: readFileSync(SALIDA).length, flujos, capturas: puntos.map(([n, t]) => ({ archivo: `docs/entrega/capturas/video-final-${n}.png`, t: +t.toFixed(2) })) };
  writeFileSync(join(TRABAJO, "montaje", "verificacion.json"), JSON.stringify(r, null, 1));
  console.log(JSON.stringify(r, null, 1));
  if (r.duracionS >= 115) throw new Error("El vídeo supera 1:55");
  if (!flujos.some(l => /Audio: aac/.test(l)) || !flujos.some(l => /Video: h264/.test(l))) throw new Error("Faltan flujos H.264/AAC");
}

for (const f of fases) {
  console.log(`== ${f}`);
  if (f === "arena") await grabarArena();
  else if (f === "previa") await grabarPrevia();
  else if (f === "recap") await grabarRecap();
  else if (f === "tarjetas") await tarjetas();
  else if (f === "voz") await voz();
  else if (f === "montar") montar();
  else if (f === "verificar") verificar();
  else throw new Error(`Fase desconocida: ${f}`);
}
