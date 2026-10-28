// Vídeo final de la entrega (docs/entrega/guion-video.md; corte del brief 067). Graba las apps públicas con
// Playwright, sintetiza la voz en off con Azure Speech, monta tarjetas propias y subtítulos.
// No modifica la app ni sube nada. Uso, desde la raíz del repo:
//   node scripts/grabar-video-final.mjs [--fases=arena,previa,torneo,recap,datos,tarjetas,voz,montar,verificar] [--controladores=azar|programado|manual] [--toma=toma067-1] [--recap=arena-cronica:<huella>]
// Intermedios en .cache/video-final/; salida docs/entrega/cronista-demo-final.{mp4,en.srt}; informe en docs/evidencia/video-067/.
// Credenciales: .env y .cache/azure-servicios.env (nunca se imprimen ni se escriben).
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const HOST_ARENA = "https://cronista-arena.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io";
const HOST_CRONICAS = "https://cronista.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io"; // redactor real (GPT-6.1 Sol)
const ARENA = `${HOST_ARENA}/arena`;
const TORNEO_LIGA = `${HOST_ARENA}/arena/torneo/2026-10-24`;
const TORNEO_GRUPOS = `${HOST_ARENA}/arena/torneo/sitio-prueba-32ad2249691f`;
const DATOS = `${HOST_ARENA}/datos`, OVERLAY = `${HOST_ARENA}/api/overlay/246`;
const VOZ_OFF = "en-US-AndrewNeural"; // Neutral; no la usa ningún rol de la mesa (Jenny, Davis, Guy).
const ANCHO = 1440, ALTO = 900, FPS = 25;
const TRABAJO = resolve(".cache/video-final");
const SALIDA = resolve("docs/entrega/cronista-demo-final.mp4");
const SALIDA_SRT = resolve("docs/entrega/cronista-demo-final.en.srt");
const INFORME = resolve("docs/evidencia/video-067");
const EVIDENCIA = resolve("docs/evidencia/publicacion-048");
const arg = (n, d) => process.argv.find(a => a.startsWith(`--${n}=`))?.split("=")[1] ?? d;
const fases = arg("fases", "arena,torneo,recap,datos,tarjetas,voz,montar,verificar").split(",");
const controladores = arg("controladores", "manual");
const toma = arg("toma", "toma067-1");
const duracionPartido = +arg("duracion", "120");
// 067 · Escena 11: host de crónicas con el redactor real; `--recap=arena` usa la del host de la arena.
const RECAP = arg("recap", "cronicas") === "arena" ? `${HOST_ARENA}/match/246` : `${HOST_CRONICAS}/match/246`;
// Tercer montaje (brief 064 B4 + 071): `--recap=arena-cronica:<huella>` graba la crónica de la arena de ESE partido
// (/arena/cronica/<huella>) en su propia carpeta; `montar` la usa en la escena 11 si recibe el mismo argumento.
const HUELLA_CRONICA = /^arena-cronica:([a-f0-9]{40})$/.exec(arg("recap", ""))?.[1] ?? null;
const CRONICA_ARENA = HUELLA_CRONICA ? `${HOST_ARENA}/arena/cronica/${HUELLA_CRONICA}` : null;
const DIR_RECAP = HUELLA_CRONICA ? resolve(".cache/video-final", `recap-arena-${HUELLA_CRONICA.slice(0, 12)}`) : resolve(".cache/video-final/recap");
const RECAP_DATOS = HUELLA_CRONICA ? `${HOST_CRONICAS}/match/246` : RECAP; // la fase datos sigue en el host del redactor
const [modeloLocal, modeloVisita] = arg("modelos", "astra6,sol61").split(",");
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
      // 067 · Escena 8: audio en español de un comentario aprobado («Preparar audio del comentario»).
      if (/\/voz$/.test(u) && r.request().method() === "POST") {
        let pedido = {}; try { pedido = JSON.parse(r.request().postData() ?? "{}"); } catch { /* sin cuerpo */ }
        estado.vozEs = { http: r.status(), pedido, recibidoS: (Date.now() - t0) / 1000, tipo: r.headers()["content-type"] ?? null };
        if (r.ok()) { const bytes = await r.body(); writeFileSync(join(dir, "relatos", "voz-es.mp3"), bytes); estado.vozEs.archivo = "voz-es.mp3"; estado.vozEs.bytes = bytes.length; }
      }
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
    await g.mover(page.getByTestId("arena-referee"), 1500); // 067: más tiempo de gancho antes de la elección
    // Escena 2: elección manual de modelos y arranque.
    const vivoPanel = page.getByTestId("arena-live");
    await g.desplazar(vivoPanel, 84, 1300);
    const select = vivoPanel.locator("select").first();
    await g.mover(select, 1300);
    await g.marca("s2-modelos");
    if (controladores === "programado") await select.selectOption("programado");
    else {
      await select.selectOption("manual"); await sleep(700);
      const [local, visita] = [vivoPanel.locator("select").nth(1), vivoPanel.locator("select").nth(2)];
      await g.mover(local, 450); await local.selectOption(modeloLocal); await sleep(800);
      await g.mover(visita, 450); await visita.selectOption(modeloVisita); await sleep(1400);
    }
    const boton = page.getByRole("button", { name: "Start live match" });
    await g.mover(boton, 1100);
    await g.marca("s2-clic");
    { const b = await boton.boundingBox(); await page.mouse.click(b.x + 40, b.y + b.height / 2); }
    let arrancado = await g.esperar(async () => (await txt("[data-testid=arena-live-assignment]")) || null, 15_000, "asignación");
    if (!arrancado) throw new Error("El partido no arrancó: " + await txt("[data-testid=arena-live]"));
    await g.marca("s2-asignacion", { texto: arrancado });
    // 067 · Escena 4 (a): estado compartido; mientras los entrenadores deciden, el reloj simulado espera.
    const decidiendo = await g.esperar(async () => /Coaches are deciding/.test(await txt("[data-testid=arena-live-status]")), 4_000, "entrenadores decidiendo");
    if (decidiendo) await g.mover(page.getByTestId("arena-live-status"), 200);
    await g.marca("s4-decidiendo", { visto: !!decidiendo, texto: await txt("[data-testid=arena-live-status]") });
    await sleep(1300);
    // Narración activada en cuanto existe el botón (emisión preparándose, reloj en 0): así suena la previa.
    // Brief 058: la narración arranca sola con el partido («Turn narration off»); solo se pulsa si no.
    // 067: la antesala empieza unos 3 s después del clic, así que se va directo a las alineaciones.
    const activar = page.getByRole("button", { name: "Enable narration" }), activa = page.getByRole("button", { name: "Turn narration off" });
    await g.esperar(async () => await activar.isVisible() || await activa.isVisible(), 60_000, "botón de narración");
    await g.marca("narracion", { texto: await txt("[data-testid=arena-buffer-status]") });
    if (await activar.isVisible()) {
      await g.mover(activar, 400);
      const bb = await activar.boundingBox(); await page.mouse.click(bb.x + 40, bb.y + bb.height / 2);
    }
    await sleep(400);
    // Escena 3: tarjeta de alineaciones mientras el estadista habla la previa.
    const conPrevia = await visible("[data-testid=arena-lineups]");
    if (conPrevia) await g.desplazar(page.getByTestId("arena-lineups"), 76, 1100);
    else { console.log("  ! la tarjeta de alineaciones ya no está (el reloj arrancó)"); await g.desplazar(page.getByTestId("arena-pitch"), 175, 900); }
    await page.mouse.move(ANCHO - 30, ALTO - 30, { steps: 8 });
    await g.marca("previa", { tarjeta: conPrevia });
    // 067 · Escena 4 (c): cuando ya sonó la primera pieza de la antesala (bienvenida y local), se abren los
    // planes de equipo (JSON validado de cada entrenador) y las órdenes individuales; luego vuelve la cámara.
    const piezaTerminada = async prefijo => {
      const ahora = Date.now(), ev = await page.evaluate(() => window.__audio).catch(() => []);
      return ev.some(e => { const r = e.tag ? estado.relatos.get(e.tag) : null; return r?.intervencion?.startsWith(prefijo) && ahora > (e.parada ?? e.t + (e.dur - e.offset) * 1000) + 400; });
    };
    if (conPrevia) await g.esperar(() => piezaTerminada("antesala:02"), 45_000, "fin de la pieza antesala:02");
    const planes = page.locator("details.arena-plans");
    if (await visible("[data-testid=arena-lineups]") || !conPrevia) {
      await g.desplazar(planes, 96, 1100);
      await g.pulsar(planes.locator(":scope > summary"), 400);
      await g.esperar(async () => (await planes.locator(".arena-team-plan").count()) > 0, 25_000, "primer plan de equipo");
      await sleep(700);
      await g.marca("s4-planes", { texto: (await planes.innerText().catch(() => "")).slice(0, 1200) });
      await sleep(2600);
      const ordenes = planes.locator(".arena-team-plan details > summary").first();
      if (await ordenes.count()) { await g.pulsar(ordenes, 400); await g.marca("s4-ordenes", { texto: (await planes.locator(".arena-team-plan").first().innerText().catch(() => "")).slice(0, 1200) }); await sleep(3200); }
      if (await visible("[data-testid=arena-lineups]")) { await g.desplazar(page.getByTestId("arena-lineups"), 76, 1000); await page.mouse.move(ANCHO - 30, ALTO - 30, { steps: 8 }); }
      else await g.desplazar(page.getByTestId("arena-pitch"), 175, 900);
    } else console.log("  ! sin tiempo para los planes antes del saque");
    // Dirección de cámara: alineaciones mientras siguen visibles; luego cancha; mesa durante cada intercambio.
    let camara = conPrevia && await visible("[data-testid=arena-lineups]") ? "previa" : "cancha";
    let vivoVisto = false, analistaHecho = false, decidiendoVivo = 0;
    // 067 · Escena 9: el analista de Foundry se consulta durante el partido. Tras un partido de 120 s narrado,
    // la suma de reservas de voz del encuentro supera PRESUPUESTO_AUDIO_ENCUENTRO y /analisis responde 429
    // («Se alcanzó el límite de consultas de este encuentro»; ensayo 21e577c6, 27 oct).
    const asistente = page.getByTestId("arena-assistant");
    const preguntarAnalista = async () => {
      analistaHecho = true;
      await g.desplazar(asistente, 90, 1100);
      await g.marca("s9-ida");
      const [pregunta, estilo] = [asistente.locator("select").nth(0), asistente.locator("select").nth(1)];
      await g.mover(pregunta, 400); await pregunta.selectOption("momento");
      await g.mover(estilo, 400); await estilo.selectOption("analyst");
      await g.marca("s9");
      const preguntar = asistente.getByRole("button", { name: "Ask analyst" });
      await g.mover(preguntar, 400);
      { const bb = await preguntar.boundingBox(); await page.mouse.click(bb.x + 40, bb.y + bb.height / 2); }
      await g.marca("s9-pregunta");
      const respuesta = await g.esperar(async () => (await asistente.getByTestId("arena-assistant-answer").count()) > 0 || (await asistente.getByRole("alert").count()) > 0, 45_000, "respuesta del analista");
      await sleep(300);
      await g.marca("s9-respuesta", { texto: await txt("[data-testid=arena-assistant-answer]"), alerta: await txt("[data-testid=arena-assistant] [role=alert]") });
      if (respuesta && await asistente.getByTestId("arena-assistant-answer").count()) {
        await sleep(1600);
        await g.pulsar(asistente.getByTestId("arena-assistant-answer").locator("summary"), 300);
        await g.marca("s9-herramientas", { texto: await txt("[data-testid=arena-assistant-answer]") });
        await g.desplazar(asistente.getByTestId("arena-assistant-answer"), 120, 1000);
        await sleep(3600);
      }
      await g.marca("s9-vuelta");
    };
    const segundosJuego = async () => { const m = /(\d+):(\d+)\s*\//.exec(await txt("[data-testid=arena-clock]")); return m ? +m[1] * 60 + +m[2] : 0; };
    const desdeAnalista = +arg("analista-s", "12");
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
      const esPreviaR = /^(previa|antesala):/.test(r?.intervencion ?? "");
      const esMesa = r?.intervencion && !esPreviaR && (r.fragmentos ?? []).some(f => f.rol === "comentarista" || f.rol === "estadista");
      if (camara === "previa") { if (!esPreviaR && !(await visible("[data-testid=arena-lineups]")) ) await ir("cancha"); }
      else if (esMesa && await visible("[data-testid=arena-mesa-dialogo]")) await ir("mesa");
      else if (!esMesa) await ir("cancha");
      const bs = await txt("[data-testid=arena-buffer]");
      // 067 · Escena 4 (b): al saque, el estado de la emisión «Live · N s ready» (2,5 s) y vuelta a la cancha.
      if (!vivoVisto && camara === "cancha" && /Live · \d+ s ready/.test(await txt("[data-testid=arena-buffer-status]"))) {
        vivoVisto = true;
        await g.desplazar(page.getByTestId("arena-buffer"), 300, 700);
        await g.mover(page.getByTestId("arena-buffer-status"), 150);
        await g.marca("s4-vivo", { texto: await txt("[data-testid=arena-buffer-status]") });
        await sleep(2300);
        camara = "x"; await ir("cancha"); continue;
      }
      // 067 · Escena 4: el estado «Coaches are deciding» vuelve en cada ventana de decisión mientras se genera;
      // se marca cada aparición (con la cámara en la cancha el panel lateral la muestra).
      if (camara === "cancha" && /Coaches are deciding/.test(await txt("[data-testid=arena-live-status]"))) {
        if (!decidiendoVivo || ahora - decidiendoVivo > 8000) { decidiendoVivo = ahora; await g.marca("s4-decidiendo-vivo", { texto: await txt("[data-testid=arena-live-status]"), reloj: await txt("[data-testid=arena-clock]") }); }
      }
      const cantando = !!r && (r.temaVoz === "gol" || (r.fragmentos ?? []).some(f => f.canto));
      if (vivoVisto && !analistaHecho && !cantando && !esMesa && camara === "cancha" && await segundosJuego() >= desdeAnalista) {
        await preguntarAnalista();
        camara = "x"; await ir("cancha"); continue;
      }
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
    // 067 · Escena 7: cifras del partido (final) y ficha del goleador con distancia, velocidad máxima y pases.
    const cifras = page.getByTestId("arena-stats");
    await g.desplazar(cifras, 84, 1300);
    await g.marca("s7-cifras", { texto: (await txt("[data-testid=arena-stats]")).slice(0, 800) });
    await sleep(3200);
    const goleador = estado.sesion ? await page.evaluate(async id => { const r = await fetch(`/api/arena/sesiones/${id}/emision`); if (!r.ok) return null; const j = await r.json(); return j.registro?.eventos?.filter(e => e.tipo === "gol" && !e.autogol).at(-1)?.jugador ?? null; }, estado.sesion).catch(() => null) : null;
    await g.desplazar(page.getByTestId("arena-pitch"), 175, 1100);
    const ficha = goleador ? page.locator(`[data-testid=arena-player][data-player="${goleador}"]`) : page.getByTestId("arena-player").nth(9);
    await g.pulsar((await ficha.count()) ? ficha.first() : page.getByTestId("arena-player").nth(9), 500);
    await g.marca("s7-seleccion", { jugador: goleador });
    const statsJugador = page.getByTestId("arena-player-stats");
    await g.desplazar(statsJugador, 250, 1400);
    await g.mover(statsJugador.locator('[data-stat="velocidad_max_kmh"] dt'), 300);
    await g.marca("s7-jugador", { jugador: goleador, texto: (await txt("[data-testid=arena-player-stats]")).slice(0, 900) });
    await sleep(1500);
    await g.mover(statsJugador.locator('[data-stat="pases_completados"] dt'), 300);
    await sleep(1800);
    // 067 · Escena 8: personalización. Estrella del jugador (en la ficha), estrella del club (marcador),
    // «Only my player (and goals)», audiencias de «Understand this moment» y cambio a español (texto y voz).
    const estrellaJugador = page.getByTestId("arena-favorite-player");
    await g.desplazar(page.getByTestId("arena-player-card"), 84, 1100);
    await g.mover(estrellaJugador, 500);
    await g.marca("s8-fav-jugador-antes");
    await g.pulsar(estrellaJugador, 100);
    await g.marca("s8-fav-jugador", { pulsada: await estrellaJugador.getAttribute("aria-pressed").catch(() => null) });
    await sleep(1400);
    const lado = goleador?.startsWith("visita") ? "visita" : "local";
    const estrellaClub = page.locator(`[data-testid=arena-favorite-club][data-side=${lado}]`);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); await sleep(1100);
    await g.mover(estrellaClub, 500);
    await g.pulsar(estrellaClub, 100);
    await g.marca("s8-fav-club", { lado, pulsada: await estrellaClub.getAttribute("aria-pressed").catch(() => null) });
    await sleep(1500);
    const textoVivo = page.getByTestId("arena-live-text");
    await g.desplazar(textoVivo, 84, 1200);
    const solo = page.getByTestId("arena-only-favourite");
    await g.mover(solo, 500);
    await g.marca("s8-solo-antes", { items: await textoVivo.locator("li").count() });
    await solo.check();
    await g.marca("s8-solo", { items: await textoVivo.locator("li").count(), texto: (await txt("[data-testid=arena-live-text]")).slice(0, 600) });
    await sleep(1800);
    const audiencia = page.getByTestId("arena-intelligence").getByRole("combobox", { name: "Audience" });
    await g.desplazar(page.getByTestId("arena-intelligence"), 140, 1000);
    for (const modo of ["fan", "analyst", "player"]) {
      await g.mover(audiencia, 350); await audiencia.selectOption(modo); await sleep(250);
      await g.marca(`s8-audiencia-${modo}`, { texto: (await txt("[data-testid=arena-intelligence]")).slice(0, 600) });
      await sleep(1500);
    }
    // Español: la barra del sitio cambia el idioma; la narración de la propia página vuelve a sonar en español
    // (brief 058 § 3.1) y se oye unos segundos antes de volver al inglés.
    const botonEs = page.getByRole("button", { name: "Switch to Spanish" });
    await g.mover(botonEs, 450);
    await g.marca("s8-es-antes");
    await g.pulsar(botonEs, 100);
    await g.marca("s8-es", { texto: (await txt("[data-testid=arena-intelligence]")).slice(0, 400) });
    const sonoEs = await g.esperar(async () => { const ev = await page.evaluate(() => window.__audio).catch(() => []); return ev.some(e => e.t > Date.now() - 6000 && estado.relatos.get(e.tag)?.idioma === "es"); }, 12_000, "narración en español");
    await g.marca("s8-es-audio", { visto: !!sonoEs });
    await sleep(3600);
    const botonEn = page.getByRole("button", { name: "Cambiar a inglés" });
    await g.mover(botonEn, 300);
    await g.pulsar(botonEn, 100);
    await g.marca("s8-en");
    await sleep(800);
    // Escena 9 (analista), si no se pudo grabar durante el partido.
    if (!analistaHecho) await preguntarAnalista();
    // Fotograma final.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); await sleep(1300);
    await page.mouse.move(ANCHO - 20, ALTO - 20, { steps: 6 });
    await g.marca("fin");
    await sleep(4000);
    // Datos para subtítulos e informe: eventos de audio y registro de la sesión.
    const eventos = await page.evaluate(() => window.__audio);
    const sesion = estado.sesion ? await page.evaluate(async id => { const r = await fetch(`/api/arena/sesiones/${id}/emision`); return r.ok ? r.json() : { http: r.status }; }, estado.sesion).catch(() => null) : null;
    writeFileSync(join(dir, "datos.json"), JSON.stringify({ t0, url: ARENA, controladores, sesion: estado.sesion, asignacion: estado.asignacion, marcas: g.marcas, eventosAudio: eventos.map(e => ({ ...e, t: (e.t - t0) / 1000, parada: e.parada === null ? null : (e.parada - t0) / 1000, relato: estado.relatos.get(e.tag)?.archivo ?? null })), analisis: estado.analisis, vozEs: estado.vozEs ? { ...estado.vozEs, inicioS: estado.vozEsInicio ?? null, paradaS: estado.vozEsParada ?? null } : null, errores: estado.errores, peticionesRelato: estado.peticionesRelato }, null, 1));
    if (sesion) {
      const ev = sesion.registro?.eventos ?? [], cuenta = tipo => ev.filter(e => e.tipo === tipo).length;
      writeFileSync(join(dir, "emision.json"), JSON.stringify({ estado: sesion.estado, metricas: sesion.metricas, asignacion: sesion.asignacion, reglas: sesion.registro?.config?.reglas ?? sesion.registro?.reglas ?? null, version: sesion.registro?.version ?? null, claves: Object.keys(sesion.registro?.config ?? {}), duracionS: sesion.registro?.config?.duracionS ?? null, marcador: sesion.registro?.final?.marcador ?? null, goles: ev.filter(e => e.tipo === "gol"), faltas: cuenta("falta"), amarillas: cuenta("amarilla"), rojas: cuenta("roja"), fuerasDeJuego: cuenta("fuera_juego"), comentarios: sesion.comentarios ?? [], intervenciones: sesion.intervenciones ?? sesion.registro?.intervenciones ?? null }, null, 1));
    }
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
// Fase torneo: torneos ya jugados (no se lanza ninguno). Liga del 24 oct (archivada, validada en CI) y
// cuadro del torneo de grupos con eliminatoria (torneo de prueba del operador, rotulado como tal).
async function grabarTorneo() {
  const dir = join(TRABAJO, "torneo"); mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: ANCHO, height: ALTO }, colorScheme: "dark", locale: "en-US", recordVideo: { dir, size: { width: ANCHO, height: ALTO } } });
  await context.addInitScript(scriptCursor);
  const t0 = Date.now(), page = await context.newPage(), g = grabador(page, t0, dir);
  let datos;
  try {
    await page.goto(TORNEO_LIGA, { waitUntil: "networkidle", timeout: 180_000 });
    const tabla = page.getByTestId("arena-torneo-tabla");
    await tabla.waitFor();
    await g.desplazar(tabla, 150, 900);
    await g.marca("liga", { texto: (await tabla.innerText()).slice(0, 400) });
    await g.mover(tabla.getByTestId("arena-torneo-fila").first(), 1400);
    await g.mover(tabla.getByTestId("arena-torneo-fila").nth(2), 1400);
    await sleep(3500);
    await page.goto(TORNEO_GRUPOS, { waitUntil: "networkidle", timeout: 180_000 });
    const cuadro = page.getByTestId("arena-torneo-cuadro");
    await cuadro.waitFor();
    const prueba = await page.getByTestId("arena-torneo-prueba").innerText().catch(() => "");
    await g.desplazar(cuadro, 90, 700);
    await g.marca("cuadro", { prueba, texto: (await cuadro.innerText()).slice(0, 400) });
    await g.mover(page.getByTestId("arena-torneo-campeon"), 1500);
    await sleep(5000);
    datos = { t0, liga: TORNEO_LIGA, grupos: TORNEO_GRUPOS, marcas: g.marcas };
  } finally { await context.close(); await browser.close(); }
  writeFileSync(join(dir, "datos.json"), JSON.stringify(datos, null, 1));
  const video = readdirSync(dir).filter(f => f.endsWith(".webm") && f !== "torneo.webm").map(f => join(dir, f)).at(-1);
  renameSync(video, join(dir, "torneo.webm"));
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
    console.log(`  · ${etiqueta}`); // El rótulo de la escena dice qué redactor muestra la página.
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
  const video = readdirSync(dir).filter(f => f.startsWith("page@") && f.endsWith(".webm")).map(f => join(dir, f)).sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs).at(-1);
  renameSync(video, join(dir, "recap.webm"));
}

// --------------------------------------------------------------------------------------------
// Fase recap, tercer montaje: la crónica de la arena de este mismo partido (/arena/cronica/<huella>, brief 064 B4),
// con la coreografía de grabarRecap: cabecera con el redactor y la barra de verificación, clic en una frase → sus
// eventos se iluminan en la línea de tiempo, y «View process». Se precalienta fuera de la grabación.
async function grabarCronicaArena() {
  const dir = DIR_RECAP; mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  { const c = await browser.newContext(); const p = await c.newPage(); await p.goto(CRONICA_ARENA, { waitUntil: "networkidle", timeout: 240_000 }); await p.getByTestId("sentence").first().waitFor({ timeout: 60_000 }); await c.close(); }
  const context = await browser.newContext({ viewport: { width: ANCHO, height: ALTO }, colorScheme: "dark", locale: "en-US", recordVideo: { dir, size: { width: ANCHO, height: ALTO } } });
  await context.addInitScript(scriptCursor);
  const t0 = Date.now(), page = await context.newPage(), g = grabador(page, t0, dir);
  const errores = []; page.on("pageerror", e => errores.push(e.message));
  let datos;
  try {
    await page.goto(CRONICA_ARENA, { waitUntil: "networkidle", timeout: 240_000 });
    await page.getByTestId("sentence").first().waitFor();
    const redactor = page.getByTestId("cronica-redactor"), barra = page.getByTestId("verify-bar"), via = page.getByTestId("cronica-hechos-via");
    const leido = {
      redactor: await redactor.innerText().catch(() => ""), fixture: await redactor.getAttribute("data-fixture").catch(() => null), modo: await redactor.getAttribute("data-modo").catch(() => null),
      via: (await via.count()) ? await via.innerText() : null, verificacion: await barra.innerText().catch(() => ""), modoBarra: await barra.getAttribute("data-mode").catch(() => null),
      marcador: await g.texto("[data-testid=cronica-arena-marcador]"), cabecera: await g.texto("[data-testid=cronica-arena-cabecera]"), modelos: await g.texto("[data-testid=cronica-arena-modelos]"),
      titulo: await g.texto("[data-testid=chronicle-title]"), lang: await page.evaluate(() => `${document.documentElement.lang}/${document.querySelector("main")?.lang ?? ""}`),
    };
    console.log(`  · ${leido.redactor} · ${leido.via ?? "sin rótulo MCP"} · ${leido.verificacion.split("\n")[0]}`);
    await sleep(800);
    await page.mouse.move(700, 120, { steps: 4 });
    await g.marca("c-inicio");
    await g.mover(page.getByTestId("cronica-arena-marcador"), 700);
    await g.mover(redactor, 1000);
    if (leido.via) await g.mover(via, 600);
    await g.mover(barra.locator(".verify-main, strong").first(), 900);
    // La frase: la del último gol (cita eventos; en toma067-1, el 1–1 cuyo canto suena en la escena 5); si no, la primera que cita eventos.
    const frases = await page.evaluate(() => [...document.querySelectorAll("[data-testid=sentence]")].map(e => ({ ids: (e.dataset.eventIds ?? "").trim(), texto: e.querySelector("[data-testid=sentence-text]")?.innerText ?? "" })));
    let i = frases.findLastIndex(f => f.ids && /scor|goal/i.test(f.texto));
    if (i < 0) i = frases.findIndex(f => f.ids);
    if (i < 0) throw new Error("Ninguna frase cita eventos");
    const frase = page.getByTestId("sentence").nth(i), textoFrase = frase.getByTestId("sentence-text");
    await g.mover(textoFrase, 450);
    await g.marca("c-clic", { indice: i, frase: frases[i].texto, eventos: frases[i].ids });
    { const bb = await textoFrase.boundingBox(); await page.mouse.click(bb.x + 60, bb.y + bb.height / 2); }
    const resaltado = page.locator('[data-testid="timeline-event"][data-highlighted="true"]');
    await resaltado.first().waitFor({ state: "attached", timeout: 10_000 });
    await sleep(1000);
    // Frase y eventos en el mismo encuadre si caben; si no, se baja hasta el primer evento resaltado.
    const [yFrase, yFinEvento] = await page.evaluate(([f, e]) => [f.getBoundingClientRect().top + scrollY, e.getBoundingClientRect().bottom + scrollY], [await frase.elementHandle(), await resaltado.last().elementHandle()]);
    if (yFinEvento - yFrase < ALTO - 170) await g.desplazar(frase, 100, 1000);
    else await g.desplazar(resaltado.first(), 360, 1000);
    await g.mover(resaltado.first(), 250);
    await g.marca("c-eventos", { resaltados: await resaltado.count(), texto: (await resaltado.first().innerText().catch(() => "")).slice(0, 200) });
    await sleep(1900);
    await g.desplazar(barra, 110, 1000);
    const proceso = page.getByTestId("open-process").first();
    await g.mover(proceso, 350);
    await g.marca("c-proceso-ir");
    { const bb = await proceso.boundingBox(); await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); }
    await page.getByTestId("process-view").waitFor();
    await g.marca("c-proceso", { texto: (await g.texto("[data-testid=process-view]")).slice(0, 600) });
    await page.mouse.move(1300, 760, { steps: 10 });
    await sleep(4500);
    datos = { tipo: "arena-cronica", t0, url: CRONICA_ARENA, huella: HUELLA_CRONICA, ...leido, errores, marcas: g.marcas };
  } finally { await context.close(); await browser.close(); }
  writeFileSync(join(dir, "datos.json"), JSON.stringify(datos, null, 1));
  const video = readdirSync(dir).filter(f => f.startsWith("page@") && f.endsWith(".webm")).map(f => join(dir, f)).sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs).at(-1);
  renameSync(video, join(dir, "recap.webm"));
  console.log(JSON.stringify({ ...datos, marcas: datos.marcas.map(m => [m.nombre, +m.t.toFixed(2)]) }, null, 1));
}

// --------------------------------------------------------------------------------------------
// Fase datos (067 · escena 12): /datos (dataset sintético, DATASHEET y descarga) y un vistazo al JSON para
// overlay de la crónica 246 en el host del redactor real. No se descarga nada durante la grabación.
async function grabarDatos() {
  const dir = join(TRABAJO, "datos"); mkdirSync(dir, { recursive: true });
  const overlay = RECAP_DATOS.replace(/\/match\/246$/, "/api/overlay/246");
  const browser = await chromium.launch();
  { const c = await browser.newContext(); const p = await c.newPage(); for (const u of [DATOS, overlay]) await p.goto(u, { waitUntil: "networkidle", timeout: 180_000 }); await c.close(); }
  const context = await browser.newContext({ viewport: { width: ANCHO, height: ALTO }, colorScheme: "dark", locale: "en-US", recordVideo: { dir, size: { width: ANCHO, height: ALTO } } });
  await context.addInitScript(scriptCursor);
  const t0 = Date.now(), page = await context.newPage(), g = grabador(page, t0, dir);
  let datos;
  try {
    await page.goto(DATOS, { waitUntil: "networkidle", timeout: 180_000 });
    await sleep(700);
    await page.mouse.move(700, 300, { steps: 4 });
    await g.marca("datos", { texto: (await page.locator("main").innerText()).slice(0, 600) });
    await g.mover(page.getByTestId("sample-download"), 1300);
    await g.marca("datos-descarga", { href: await page.getByTestId("sample-download").getAttribute("href") });
    await g.mover(page.getByTestId("datasheet-link"), 1300);
    await g.marca("datos-datasheet");
    await sleep(600);
    await page.goto(overlay, { waitUntil: "networkidle", timeout: 180_000 });
    // Casilla «Pretty-print» del visor de JSON de Chromium (arriba a la izquierda), pulsada con el cursor visible.
    await page.mouse.move(104, 9, { steps: 10 }); await sleep(250); await page.mouse.click(104, 9);
    await sleep(500);
    await page.mouse.move(900, 420, { steps: 4 });
    await g.marca("overlay", { url: overlay, texto: (await page.locator("body").innerText()).slice(0, 300) });
    await sleep(3500);
    datos = { t0, datos: DATOS, overlay, marcas: g.marcas };
  } finally { await context.close(); await browser.close(); }
  writeFileSync(join(dir, "datos.json"), JSON.stringify(datos, null, 1));
  const video = readdirSync(dir).filter(f => f.endsWith(".webm") && f !== "datos.webm").map(f => join(dir, f)).at(-1);
  renameSync(video, join(dir, "datos.webm"));
}

// --------------------------------------------------------------------------------------------
// Fase tarjetas: tres tarjetas propias (paleta de la arena, sin logotipos).
// 067 · § 2.3: cifras vistas correr (npm test en dbd70e0; Playwright 343 en el run 40451967668 sobre dbd70e0;
// test:stats 80 en el brief 068). Segundo montaje (27 oct): cifras del run 40462385259 sobre be3c96a, reglas v11,
// sin las líneas «Not implemented» / «Not used» (la orquestación propia ya figura en el antetítulo y en el README). `--ci="run N · three jobs · commit sha · fecha"` solo si ese run terminó en verde.
const CALIDAD = { unit: arg("unit", "2,994"), archivos: arg("archivos", "143"), e2e: arg("e2e", "343"), stats: arg("stats", "85"), statsNota: arg("stats-nota", "same CI run, rules up to reinicios-v11"), ci: arg("ci", "").replace(/_/g, " "), sha: arg("sha", "be3c96a"), runE2e: arg("run-e2e", "40462385259") };
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
#arquitectura{padding-top:80px}#arquitectura h1{margin-bottom:14px} /* tercer montaje: fila MCP sin pisar los subtítulos */
</style>
<main id="arquitectura">
 <div class="brand">CRONISTA</div><div class="over">Multi-agent architecture · custom TypeScript orchestration on Azure · rules reinicios-v11</div>
 <h1>Separate roles, one shared journal,<br>a verifier before every spoken analysis.</h1>
 <div class="grid" style="grid-template-columns:1.05fr 40px 1.1fr 40px 1.1fr">
  <div class="grid"><div class="box k"><b>Home coach</b><span>LLM · Azure OpenAI deployment · JSON plan per player</span></div><div class="box k"><b>Away coach</b><span>Six in the catalogue: GPT-6.1 Sol · GPT-6 Astra · GPT-6 Sol · GPT-6 Luna · GPT-5.6 Luna · GPT-5.4 mini</span></div></div>
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
 <div class="grid" style="grid-template-columns:1fr 1fr;margin-top:16px"><div class="box"><b>Match analyst · Microsoft Foundry Agent Service</b><span>On request, read-only tools over the confirmed play; answers pass the same verifier</span></div><div class="box"><b>MCP server · read-only /api/mcp</b><span>The match-report agent reads its facts through it; any MCP client can query finished matches</span></div></div>
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
</main>
<main id="calidad">
 <div class="brand">CRONISTA</div><div class="over">Quality · evidence in the repository</div>
 <h1>More than three thousand automated checks</h1>
 <div class="grid" style="grid-template-columns:1fr 1fr 1fr">
  <div class="box" style="padding:30px"><div class="num">${CALIDAD.unit}</div><div class="lbl">unit, invariant, oracle and lie-battery tests in ${CALIDAD.archivos} files</div></div>
  <div class="box" style="padding:30px"><div class="num">${CALIDAD.e2e}</div><div class="lbl">Playwright journeys</div></div>
  <div class="box" style="padding:30px"><div class="num">${CALIDAD.stats}</div><div class="lbl">statistical checks over simulated matches (${CALIDAD.statsNota})</div></div>
 </div>
 <p style="margin-top:34px">${CALIDAD.ci ? `<span class="ci"><i>CI</i><em>passed</em></span> <span style="color:var(--muted);font-size:21px;margin-left:12px">${CALIDAD.ci}</span>` : `<span class="ci"><i>Unit and statistical suites run locally on ${CALIDAD.sha}</i></span> <span style="color:var(--muted);font-size:21px;margin-left:12px">Playwright journeys passed in CI run ${CALIDAD.runE2e} on ${CALIDAD.sha}</span>`}</p>
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
// Fase voz: voz en off en inglés con Azure Speech (misma llamada REST que src/arena/voz.ts). Corte del 067.
const VOZ = {
  gancho: "AI can call a football match. Can it prove what it says? CRONISTA: a multi-agent broadcast where every sentence is traceable.",
  agentes: "Two LLM coaches, GPT-6 Astra and GPT-6.1 Sol, manage the teams. A shared engine resolves the play; a desk of three voices narrates it.",
  estado: "While the coaches decide, the clock waits. Both see the same committed state and return a validated JSON plan for every player.",
  verificacion: "The commentator may only analyse with a cited fact. Eight deterministic rules check it; a failure is retried once, then becomes a labelled template.",
  cifras: "Team and player numbers come from the engine's events and frames: passes, shots, distance and top speed in kilometres per hour.",
  personal: "Make it yours: star a club and a player, follow only that player, and choose a fan, analyst or player view. Spanish switches text and voice.",
  analista: "A versioned Microsoft Foundry agent answers questions with read-only tools over the confirmed play. Its sentences pass the same verifier.",
  torneo: "The six models also play each other. Every league match has a replay, and the page states what the results cannot prove.",
  // Tercer montaje: la crónica de la arena de este mismo partido (la del 067 era /match/246, aparte de la arena).
  cronica: "After the final whistle, another agent writes the match report from these events. Every sentence is verified; one click shows its evidence.",
  datos: "All data is synthetic: a documented dataset, and JSON for broadcast overlays.",
  cierre: "It runs on Azure OpenAI, Foundry, Speech and Container Apps, with over three thousand automated checks. CRONISTA: narrate the match, prove every sentence.",
};
const RITMO = { gancho: "+12%", agentes: "+15%", estado: "+12%", verificacion: "+14%", cifras: "+12%", personal: "+14%", analista: "+12%", torneo: "+12%", cronica: "+12%", datos: "+12%", cierre: "+15%" };
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
// Fase montar (067): trece escenas, subtítulos (rótulo superior + transcripción inferior), mezcla y MP4.
const NOMBRE_ROL = { narrador: "Narrator", comentarista: "Commentator", estadista: "Statistician" };
const ROTULO = {
  gancho: "CRONISTA — multi-agent match broadcast · own emblem, fictional crests and kits · every sentence traceable",
  antesala: "Pre-match presentation · real audio as played in the live broadcast · first piece only (the whole presentation lasts about 50 s)",
  estado: "Shared state · coaches decide while the simulation clock waits · broadcast buffer · each coach's validated JSON plan and player orders",
  gol: "Goal call · real narrator audio as played in the live broadcast · ball in the net, GOAL banner, goal view (height illustrative)",
  verificacion: "V1–V8: schema · citations · numbers · names · coverage · ES=EN · negations · strong claims",
  cifras: "Match stats and player card · passes and shots from confirmed events · distance and top speed (km/h) sampled from engine frames",
  personal: "Favourite club and player (stored in this browser) · Only my player (and goals) · audience: Fan, Analyst, Follow selected player",
  personalEs: "Switched to Spanish · page text and the page's own narration (real Azure Speech audio, as played in this recording)",
  torneo: "Model league of 24 Oct · six models, archived and validated in CI · results describe these matches, not model quality",
  datos: "Synthetic dataset at /datos · DATASHEET · 10-match JSONL sample to download",
  overlay: "/api/overlay/246 · the verified match-report updates as JSON for a broadcast overlay",
  cierreA: "Azure OpenAI · Foundry Agent Service · Azure Speech · Container Apps + Jobs · Blob · Key Vault · App Insights · ACR · Bicep · GitHub Actions",
  cierreB: "All data synthetic · open source · claims link to evidence",
};
// Límites del corte (brief 067 § 2): estrictamente entre 1:50,0 y 1:58,0.
const MIN_S = 110.2, MAX_S = 117.6;
function montar() {
  const dir = join(TRABAJO, "montaje"); mkdirSync(dir, { recursive: true });
  const arena = JSON.parse(readFileSync(join(TRABAJO, toma, "datos.json"), "utf8"));
  const emision = existsSync(join(TRABAJO, toma, "emision.json")) ? JSON.parse(readFileSync(join(TRABAJO, toma, "emision.json"), "utf8")) : null;
  const recap = JSON.parse(readFileSync(join(DIR_RECAP, "datos.json"), "utf8"));
  const datosW = JSON.parse(readFileSync(join(TRABAJO, "datos", "datos.json"), "utf8"));
  const torneo = JSON.parse(readFileSync(join(TRABAJO, "torneo", "datos.json"), "utf8"));
  const vozOff = JSON.parse(readFileSync(join(TRABAJO, "voz", "voz.json"), "utf8")).escenas;
  const m = (datos, n) => { const x = datos.marcas.findLast(k => k.nombre === n); if (!x) throw new Error(`Falta la marca ${n}`); return x; };
  const mOpc = (datos, n) => datos.marcas.findLast(k => k.nombre === n) ?? null;
  const A = join(TRABAJO, toma, "arena.webm"), R = join(DIR_RECAP, "recap.webm"), T = join(TRABAJO, "tarjetas");
  const TT = join(TRABAJO, "torneo", "torneo.webm"), DD = join(TRABAJO, "datos", "datos.webm");
  const durVoz = e => vozOff[e].duracionS;
  const holgura = +arg("holgura", "0.4");
  const largo = (e, ranura) => Math.max(ranura, +(durVoz(e) + holgura).toFixed(2));
  const sin = arg("sin", "").split(",").filter(Boolean);

  // Audio real de la sesión: cada clip que la página arrancó, identificado por huella.
  const dirRelatos = join(TRABAJO, toma, "relatos"), porHuella = new Map(), porArchivo = new Map();
  for (const f of readdirSync(dirRelatos).filter(f => f.endsWith(".json"))) { const j = JSON.parse(readFileSync(join(dirRelatos, f), "utf8")); porHuella.set(j.tag, j.archivo); porArchivo.set(j.archivo, j); }
  const eventos = arena.eventosAudio.map(e => ({ ...e, relato: e.relato ?? porHuella.get(e.tag) ?? null, fin: e.parada ?? e.t + (e.dur - e.offset) }));
  const rel = e => porArchivo.get(e.relato);
  const completo = e => e.offset === 0 && (e.parada === null || e.parada >= e.t + e.dur - 0.15);
  const esCanto = r => r?.temaVoz === "gol" || (r?.fragmentos ?? []).some(f => f.canto);
  const esPreviaR = r => /^(previa|antesala):/.test(r?.intervencion ?? "");
  const esAntesalaR = r => !!r?.intervencion?.startsWith("antesala:");
  const esIntercambioLlm = r => !!r?.intervencion && !esPreviaR(r) && (r.fragmentos ?? []).some(f => f.rol === "comentarista") && r.modoIntervencion === "llm";
  const esIntercambioCualquiera = r => !!r?.intervencion && !esPreviaR(r) && (r.fragmentos ?? []).some(f => f.rol === "comentarista");
  const desdeMesa = m(arena, "previa").t + 0.3, hastaMesa = m(arena, "fin-emision").t;
  const enMesa = eventos.filter(e => e.relato && e.t >= desdeMesa && e.fin <= hastaMesa && completo(e));
  // Fuera de la cancha mientras se consulta al analista (escena 9, durante el partido): esas locuciones no valen.
  const ida = mOpc(arena, "s9-ida"), vuelta = mOpc(arena, "s9-vuelta");
  const enCancha = e => !(ida && vuelta && e.t < vuelta.t + 1.0 && e.fin > ida.t - 1.2);
  const cantos = enMesa.filter(e => esCanto(rel(e)) && enCancha(e));
  let intercambios = enMesa.filter(e => esIntercambioLlm(rel(e)) && enCancha(e));
  if (!intercambios.length) intercambios = enMesa.filter(e => esIntercambioCualquiera(rel(e)) && enCancha(e));
  if (!cantos.length) throw new Error("No sonó ningún canto de gol completo en la vista de la cancha");
  const ajustar = (ini, fin) => {
    for (const e of eventos) if (e.t < ini && e.fin > ini) ini = e.fin + 0.03;
    for (const e of eventos) if (e.t > ini && e.t < fin && e.fin > fin + 0.05) fin = e.t - 0.02;
    return [Math.max(ini, desdeMesa), Math.min(fin, hastaMesa)];
  };
  // Escenas 5 y 6: un canto seguido del intercambio de la mesa sobre ese gol (una sola toma continua), si lo hay.
  let canto = cantos[0], tras = null;
  if (!sin.includes("mesa")) for (const c of cantos) { const x = intercambios.find(i => i.t > c.fin && i.t - c.fin < 12); if (x) { canto = c; tras = x; break; } }
  const ventanaGol = tras && tras.fin + 1 - (canto.t - 1.5) <= 27 ? { id: "gol", ini: canto.t - 1.5, fin: tras.fin + 1.0, cambio: tras.t - 0.3, intercambio: tras } : { id: "gol", ini: canto.t - 1.2, fin: canto.fin + 0.9 };
  [ventanaGol.ini, ventanaGol.fin] = ajustar(ventanaGol.ini, ventanaGol.fin);
  if (ventanaGol.ini > canto.t - 0.4) ventanaGol.ini = Math.max(desdeMesa, canto.t - 0.4);
  ventanaGol.dur = +(ventanaGol.fin - ventanaGol.ini).toFixed(2);
  console.log("  · cantos", cantos.map(c => [c.relato, +c.t.toFixed(1)]), "intercambios", intercambios.map(c => [c.relato, +c.t.toFixed(1)]), "gol", [+ventanaGol.ini.toFixed(1), +ventanaGol.fin.toFixed(1), !!ventanaGol.intercambio]);

  // Escena 3: antesala en el directo, una sola pieza (apertura + cabecera local, que nombra al modelo).
  const antesala = eventos.filter(e => e.relato && esAntesalaR(rel(e)) && completo(e));
  const clipA = n => antesala.find(e => rel(e).intervencion.startsWith(`antesala:${n}-`));
  if (!clipA("01")) throw new Error("Falta la pieza antesala:01 completa");
  const ventanaAntesala = { id: "antesala", ini: clipA("01").t - 0.5, fin: (clipA("02") ?? clipA("01")).fin + 0.3 };
  ventanaAntesala.dur = +(ventanaAntesala.fin - ventanaAntesala.ini).toFixed(2);

  // Escena 8: narración en español de la propia página tras «Switch to Spanish», tal como sonó (huella).
  const esClic = mOpc(arena, "s8-es")?.t ?? null;
  const esEv = esClic === null || sin.includes("es") ? null : eventos.find(e => e.relato && e.t >= esClic - 0.2 && e.t < esClic + 8 && rel(e)?.idioma === "es" && e.offset === 0) ?? null;
  const usoEs = esEv ? Math.min(+arg("es", "2.6"), esEv.fin - esEv.t) : 0;
  const esDesde = esEv ? esClic - 0.6 : 0;

  const L = { gancho: largo("gancho", 6), agentes: largo("agentes", 10), estado: largo("estado", 7.5), verificacion: largo("verificacion", 8.5), cifras: largo("cifras", 7.5), personal: largo("personal", 8), analista: largo("analista", 7.5), torneo: largo("torneo", 6.5), cronica: largo("cronica", 7.5), datos: largo("datos", 5), cierre: largo("cierre", 10) };
  const s1 = m(arena, "s1").t, mod = m(arena, "s2-modelos").t, clic = m(arena, "s2-clic").t;
  const finGancho = s1 - 0.3 + L.gancho, iniAgentes = Math.max(finGancho, clic + 1.5 - L.agentes); // la escena termina tras el clic
  // Escena 4: «Coaches are deciding» → «Live · N s ready» → planes y órdenes.
  // «Coaches are deciding»: la marca inicial si se vio; si no, la primera aparición durante el partido, o la
  // hora indicada con --decidiendo=<s> tras revisar los fotogramas de la toma (se anota en el informe).
  const decArg = arg("decidiendo", ""), decVivo = mOpc(arena, "s4-decidiendo-vivo");
  const dec = decArg ? +decArg + 0.4 : m(arena, "s4-decidiendo").visto ? m(arena, "s4-decidiendo").t : decVivo ? decVivo.t : m(arena, "s4-decidiendo").t, vivoM = mOpc(arena, "s4-vivo"), pl = m(arena, "s4-planes").t, ordM = mOpc(arena, "s4-ordenes");
  const pDec = 2.6, pVivo = vivoM ? 2.3 : 0, pPlan = +(L.estado - pDec - pVivo).toFixed(2);
  // Escena 8: trozos alrededor de cada acción, repartidos para cubrir la voz en off; después el audio ES.
  const trozos8 = [["s8-fav-jugador-antes", -0.2, 2.0], ["s8-fav-club", -1.4, 2.0], ["s8-solo-antes", -0.3, 2.3], ["s8-audiencia-analyst", -0.9, 1.6], ["s8-audiencia-player", -0.9, 1.8]];
  const escala8 = L.personal / trozos8.reduce((s, x) => s + x[2], 0);
  const s9 = m(arena, "s9").t, s9p = m(arena, "s9-pregunta").t, s9r = m(arena, "s9-respuesta").t, piezaA9 = +Math.min(L.analista * 0.45, s9p + 1.4 - (s9 - 1.2)).toFixed(2);
  const herramientas = mOpc(arena, "s9-herramientas");
  const pDatos = 3.1;
  const escenas = [
    { id: "gancho", voz: "gancho", piezas: [{ src: A, desde: s1 - 0.3, dur: L.gancho }] },
    { id: "agentes", voz: "agentes", piezas: [{ src: A, desde: iniAgentes, dur: L.agentes }] },
    { id: "antesala", piezas: [{ src: A, desde: ventanaAntesala.ini, dur: ventanaAntesala.dur }], ventana: ventanaAntesala },
    { id: "estado", voz: "estado", piezas: [{ src: A, desde: dec - 0.4, dur: pDec }, ...(vivoM ? [{ src: A, desde: vivoM.t - 0.2, dur: pVivo }] : []), { src: A, desde: (ordM && pPlan < 4.2 ? ordM.t - 1.2 : pl - 0.5), dur: pPlan }] },
    { id: "gol", piezas: [{ src: A, desde: ventanaGol.ini, dur: ventanaGol.dur }], ventana: ventanaGol },
    { id: "verificacion", voz: "verificacion", piezas: [{ src: A, desde: m(arena, "s5").t - 0.8, dur: L.verificacion }] },
    { id: "cifras", voz: "cifras", piezas: [{ src: A, desde: m(arena, "s7-cifras").t - 0.4, dur: 3.0 }, { src: A, desde: m(arena, "s7-jugador").t + 1.0, dur: +(L.cifras - 3.0).toFixed(2) }] },
    { id: "personal", voz: "personal", piezas: [...trozos8.map(([n, d, dur]) => ({ src: A, desde: m(arena, n).t + d, dur: +(dur * escala8).toFixed(2) })), ...(esEv ? [{ src: A, desde: esDesde, dur: +(esEv.t - esDesde + usoEs + 0.3).toFixed(2), es: true }] : [])] },
    { id: "analista", voz: "analista", piezas: [{ src: A, desde: s9 - 1.2, dur: piezaA9 }, { src: A, desde: herramientas ? herramientas.t - 0.8 : s9r - 0.6, dur: +(L.analista - piezaA9).toFixed(2) }] },
    { id: "torneo", voz: "torneo", piezas: [{ src: TT, desde: m(torneo, "liga").t - 0.4, dur: L.torneo }] },
    { id: "cronica", voz: "cronica", piezas: recap.tipo === "arena-cronica"
      // Tercer montaje: cabecera (redactor, MCP, barra) → clic en la frase → eventos iluminados → «View process».
      ? (() => { const tr = [["c-inicio", -0.2, 2.3], ["c-clic", -0.8, 2.0], ["c-eventos", -0.5, 1.9], ["c-proceso-ir", -0.3, 1.6]], k = L.cronica / tr.reduce((s, x) => s + x[2], 0);
          const p = tr.map(([n, d, dur]) => ({ src: R, desde: m(recap, n).t + d, dur: +(dur * k).toFixed(2) })); p.at(-1).dur = +(L.cronica - p.slice(0, -1).reduce((s, x) => s + x.dur, 0)).toFixed(2); return p; })()
      : [{ src: R, desde: m(recap, "r-clic").t - 2.4, dur: L.cronica }] },
    { id: "datos", voz: "datos", piezas: [{ src: DD, desde: m(datosW, "datos").t - 0.3, dur: sin.includes("overlay") ? L.datos : pDatos }, ...(sin.includes("overlay") ? [] : [{ src: DD, desde: m(datosW, "overlay").t - 0.6, dur: +Math.max(1.9, L.datos - pDatos).toFixed(2), overlay: true }])] },
  ].filter(e => !sin.includes(e.id));
  const fin13 = 1.6, cartas = L.cierre - fin13, c1 = +(cartas * 0.38).toFixed(2), c2 = +(cartas * 0.30).toFixed(2);
  escenas.push({ id: "cierre", voz: "cierre", piezas: [{ img: join(T, "arquitectura.png"), dur: c1 }, { img: join(T, "azure.png"), dur: c2 }, { img: join(T, "calidad.png"), dur: +(cartas - c1 - c2).toFixed(2) }, { src: A, desde: m(arena, "fin").t + 0.6, dur: fin13 }] });
  const durTotal = () => escenas.reduce((s, e) => s + e.piezas.reduce((t, p) => t + p.dur, 0), 0);
  // Orden de recorte del brief (§ 2.1): overlay, audio ES, mesa, torneo. Las escenas 2, 4, 5, 7 y 8 no se recortan.
  const recortes = [
    ["overlay", () => { const e = escenas.find(e => e.id === "datos"); const i = e?.piezas.findIndex(p => p.overlay) ?? -1; if (i < 0 || e.piezas.reduce((s, p) => s + p.dur, 0) - L.datos < 0.05) return false; e.piezas.splice(i, 1); e.piezas[0].dur = L.datos; return true; }],
    ["es", () => { const e = escenas.find(e => e.id === "personal"); const i = e.piezas.findIndex(p => p.es); if (i < 0) return false; e.piezas.splice(i, 1); return true; }],
    ["mesa", () => { const e = escenas.find(e => e.id === "gol"); const v = e.ventana; if (!v.intercambio) return false; v.fin = canto.fin + 0.9; delete v.intercambio; delete v.cambio; v.dur = +(v.fin - v.ini).toFixed(2); e.piezas[0].dur = v.dur; return true; }],
    ["torneo", () => { const i = escenas.findIndex(e => e.id === "torneo"); if (i < 0) return false; escenas.splice(i, 1); return true; }],
  ];
  for (const [id, quitar] of recortes) if (durTotal() > MAX_S && quitar()) { sin.push(id); console.log(`  · recorte por duración: ${id} → ${durTotal().toFixed(2)} s`); }
  const total = durTotal();
  console.log(`  · duración prevista ${total.toFixed(2)} s`);
  if (total > MAX_S || total < MIN_S) throw new Error(`Fuera de 1:50–1:58 (${total.toFixed(2)} s): ajusta --holgura o --sin`);

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

  // 2) Audio: voz en off y audio real de la sesión (antesala, gol, mesa, español).
  const entradas = [], filtros = [], subt = [], audioSesion = [];
  const agregar = (archivo, alInicio, { volumen = 1, desde = 0, dur = null } = {}) => {
    const k = entradas.length / 2; entradas.push("-i", archivo);
    filtros.push(`[${k}:a]aresample=48000,aformat=channel_layouts=mono,atrim=start=${desde.toFixed(3)}${dur ? `:duration=${dur.toFixed(3)}` : ""},asetpts=PTS-STARTPTS,afade=t=in:d=0.03${dur ? `,afade=t=out:st=${Math.max(0, dur - 0.12).toFixed(3)}:d=0.12` : ""},volume=${volumen},adelay=${Math.round(alInicio * 1000)}:all=1[a${k}]`);
  };
  const desfase = e => e === "gancho" || e === "cierre" ? 0.25 : 0.3;
  const repartir = (texto, desde, dur) => {
    const frases = texto.split(/(?<=[.?!;:]["»]?)\s+/).map(s => s.trim()).filter(Boolean), trozos = [];
    for (const f of frases) { if (trozos.length && (trozos.at(-1) + " " + f).length <= 84 && !/[.?!]$/.test(trozos.at(-1))) trozos[trozos.length - 1] += " " + f; else trozos.push(f); }
    const tot = trozos.reduce((s, t) => s + t.length, 0); let t = desde;
    for (const tr of trozos) { const d = dur * tr.length / tot; subt.push({ ini: t, fin: t + d - 0.04, texto: tr }); t += d; }
  };
  for (const e of escenas.filter(e => e.voz)) { agregar(join(TRABAJO, "voz", `${e.voz}.wav`), inicio[e.id] + desfase(e.id)); repartir(VOZ[e.voz], inicio[e.id] + desfase(e.id) + 0.05, durVoz(e.voz) - 0.25); }
  const rolDe = (r, f) => esAntesalaR(r) ? `${NOMBRE_ROL[f.rol] ?? "Narrator"} (pre-match presentation)` : esPreviaR(r) ? (f.rol === "estadista" ? "Statistician (spoken pre-match)" : "Narrator (pre-match)") : f.rol === "comentarista" ? `Commentator (${r.modoIntervencion === "llm" ? "LLM, verified" : "template fallback"})` : f.rol === "estadista" ? "Statistician (deterministic)"
    : f.canto || r.temaVoz === "gol" ? "Narrator (goal call)" : r.reserva ? "Narrator (backup clip)" : r.intervencion ? "Narrator (template)" : "Narrator (play-by-play)";
  const cortarFragmentos = (frags, fraccion) => {
    if (fraccion >= 0.999) return frags;
    const total = frags.reduce((s, f) => s + f.texto.length, 0), corte = total * fraccion; let acum = 0;
    return frags.flatMap(f => { if (acum >= corte) return []; const resto = corte - acum; acum += f.texto.length; if (f.texto.length <= resto) return [f]; const pal = f.texto.slice(0, Math.max(1, Math.floor(resto))).replace(/\s+\S*$/, ""); return [{ ...f, texto: `${pal}…` }]; });
  };
  for (const e of escenas.filter(e => e.ventana)) {
    const v = e.ventana;
    for (const ev of eventos.filter(x => x.relato && x.t >= v.ini - 0.05 && x.fin <= v.fin + 0.05 && x.fin - x.t >= 0.6)) {
      const alInicio = inicio[e.id] + (ev.t - v.ini), dur = ev.fin - ev.t;
      agregar(join(dirRelatos, ev.relato), alInicio, { desde: ev.offset, dur });
      const r = rel(ev);
      audioSesion.push({ escena: e.id, relato: ev.relato, intervencion: r.intervencion ?? null, tag: ev.tag, alInicio: +alInicio.toFixed(2), dur: +dur.toFixed(2) });
      // Locución cortada por la propia emisión (una noticia posterior): el subtítulo se corta igual.
      const frags = cortarFragmentos(r.fragmentos?.length ? r.fragmentos : [{ rol: "narrador", texto: r.texto }], ev.parada !== null && ev.parada < ev.t + ev.dur - 0.15 ? dur / ev.dur : 1);
      const chars = frags.reduce((s, f) => s + f.texto.length, 0); let t = alInicio + 0.1;
      for (const f of frags) { const d = (dur - 0.4) * f.texto.length / chars; subt.push({ ini: t, fin: t + d - 0.04, texto: `${rolDe(r, f)}: ${f.texto}` }); t += d; }
    }
  }
  // Audio en español: la narración que la página hizo sonar tras el cambio de idioma, recortada a usoEs.
  let textoEs = null;
  for (const e of escenas) for (const p of e.piezas.filter(p => p.es)) {
    const alInicio = p.inicioFinal + (esEv.t - esDesde), r = rel(esEv);
    agregar(join(dirRelatos, esEv.relato), alInicio, { dur: usoEs });
    audioSesion.push({ escena: e.id, relato: esEv.relato, intervencion: r.intervencion ?? null, idioma: "es", tag: esEv.tag, alInicio: +alInicio.toFixed(2), dur: +usoEs.toFixed(2), durClip: +(esEv.fin - esEv.t).toFixed(2) });
    textoEs = (r.fragmentos?.length ? r.fragmentos : [{ texto: r.texto }]).map(f => f.texto).join(" ");
    const [f] = cortarFragmentos([{ texto: textoEs }], usoEs / (esEv.fin - esEv.t));
    subt.push({ ini: alInicio + 0.05, fin: alInicio + usoEs, texto: `Narrator in Spanish: «${f.texto}»` });
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
  const analisisModo = arena.analisis?.cuerpo?.comentario?.modo;
  // Tercer montaje: el rótulo de la crónica de la arena dice solo lo que la página grabada muestra. «This same match»
  // exige marcador, modelos y duración iguales a los de la sesión de la toma; «via MCP», el rótulo de la página.
  const rotuloCronicaArena = r => {
    const autor = /^Writer: (.+?)(?: · Azure OpenAI)?$/.exec((r.redactor ?? "").trim())?.[1] ?? null;
    const n = /(\d+)\/(\d+) sentences verified/.exec(r.verificacion ?? "");
    const goles = /(\d+)\s*–\s*(\d+)/.exec(r.marcador ?? "");
    const mismo = !!(emision && goles && +goles[1] === emision.marcador?.local && +goles[2] === emision.marcador?.visita
      && [asignacion.local.nombre, asignacion.visita.nombre].every(x => (r.modelos ?? "").includes(x)) && (r.cabecera ?? "").includes(`${emision.duracionS} s`));
    return [mismo ? "Match report of this same match" : `Match report /arena/cronica/${r.huella.slice(0, 8)}…`,
      autor && r.fixture === "false" && r.modo === "llm" ? `written after the final whistle by ${autor} from its events` : `page label: ${r.redactor}`,
      n ? `${n[1]}/${n[2]} sentences verified (V1–V8)` : null, /^Facts retrieved via MCP$/.test((r.via ?? "").trim()) ? "facts retrieved via MCP" : null].filter(Boolean).join(" · ");
  };
  const rotulos = { ...ROTULO,
    agentes: `Home: ${asignacion.local.nombre} · Away: ${asignacion.visita.nombre} · chosen manually · ${emision?.duracionS ?? duracionPartido} s live match · same observation, strict JSON`,
    cronica: recap.tipo === "arena-cronica" ? rotuloCronicaArena(recap) : /gpt-6\.1-sol/i.test(recap.redactor ?? "") ? `Match report /match/246 · page label: ${recap.redactor.replace(/^Writer: /, "writer ")} · ${(/(\d+\/\d+) sentences verified/.exec(recap.verificacion ?? "") ?? ["", "?"])[1]} sentences passed V1–V8`
      : /offline stub/i.test(recap.redactor ?? "") ? "Match report /match/246 · writer on this host: the labelled offline stub · V1–V8 on every sentence" : `Match report /match/246 · ${recap.redactor}`,
    analista: analisisModo === "llm" ? `Microsoft Foundry Agent Service · AI explanation · read-only tool ${[...new Set((arena.analisis?.cuerpo?.herramientas ?? []).map(h => h.nombre))].join(", ") || "calls"} · cited events · checked by V1–V8` : "Microsoft Foundry Agent Service · this answer: verified template fallback",
  };
  const assT = s => { const cs = Math.round(s * 100); return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, "0")}:${String(Math.floor(cs / 100) % 60).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`; };
  const ev = [], rot = (texto, ini, fin) => ev.push(`Dialogue: 1,${assT(ini)},${assT(fin)},Rotulo,,0,0,0,,${texto}`);
  for (const e of escenas) {
    const a = inicio[e.id] + 0.15, b = inicio[e.id] + e.dur - 0.1;
    const corte = pred => e.piezas.find(pred)?.inicioFinal;
    if (e.id === "cierre") { const c3 = e.piezas[2].inicioFinal; rot(rotulos.cierreA, a, c3); rot(rotulos.cierreB, c3, b + 0.05); }
    else if (e.ventana?.cambio) { const c = inicio[e.id] + (e.ventana.cambio - e.ventana.ini); rot(rotulos.gol, a, c); rot(rotuloMesa(e.ventana.intercambio), c, b); }
    else if (e.id === "personal" && corte(p => p.es) !== undefined) { const c = corte(p => p.es); rot(rotulos.personal, a, c); rot(rotulos.personalEs, c, b); }
    else if (e.id === "datos" && corte(p => p.overlay) !== undefined) { const c = corte(p => p.overlay); rot(rotulos.datos, a, c); rot(rotulos.overlay, c, b); }
    else rot(rotulos[e.id], a, b);
  }
  for (const s of subt) ev.push(`Dialogue: 0,${assT(s.ini)},${assT(s.fin)},Sub,,0,0,0,,${partir(s.texto).join("\\N")}`);
  const ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${ANCHO}\nPlayResY: ${ALTO}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Sub,Liberation Sans,31,&H00FFFFFF,&H00FFFFFF,&H30201208,&H30201208,1,0,0,0,100,100,0,0,3,8,0,2,140,140,30,1\nStyle: Rotulo,Liberation Sans,24,&H003AFFD4,&H003AFFD4,&H18201208,&H18201208,1,0,0,0,100,100,0,0,3,9,0,8,300,300,14,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${ev.join("\n")}\n`;
  writeFileSync(join(dir, "subtitulos.ass"), ass);

  // 4) Vídeo final.
  ff(["-i", join(dir, "mudo.mp4"), "-i", join(dir, "mezcla.wav"), "-vf", `ass=${join(dir, "subtitulos.ass")}:fontsdir=/usr/share/fonts/truetype/liberation`, "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-maxrate", "3000k", "-bufsize", "6000k", "-pix_fmt", "yuv420p", "-r", String(FPS), "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-shortest", SALIDA]);
  const sesionInfo = emision ? { id: arena.sesion, reglas: emision.reglas, version: emision.version, duracionS: emision.duracionS, metricas: emision.metricas, marcador: emision.marcador, goles: emision.goles.map(g => ({ tick: g.tick, s: +(g.tick / 10).toFixed(1), jugador: g.jugador, autogol: !!g.autogol })), faltas: emision.faltas, amarillas: emision.amarillas, rojas: emision.rojas, fuerasDeJuego: emision.fuerasDeJuego } : { id: arena.sesion };
  const informe = { salida: SALIDA, duracionS: +duracion(SALIDA).toFixed(2), escenas: escenas.map(e => ({ id: e.id, inicioS: +inicio[e.id].toFixed(2), durS: +e.dur.toFixed(2), piezas: e.piezas.map(p => p.img ? { tarjeta: p.img.split("/").at(-1), dur: p.dur } : { fuente: p.src.split("/").at(-1), desdeS: +p.desde.toFixed(2), dur: p.dur }) })), rotulos: Object.fromEntries(Object.entries(rotulos).filter(([id]) => escenas.some(e => id.startsWith(e.id)) || id.startsWith("cierre"))), audioSesion, textoEs, vozOff: VOZ_OFF, asignacion, sesion: sesionInfo, toma, recap: { url: recap.url, tipo: recap.tipo ?? "match-246", redactor: recap.redactor, verificacion: recap.verificacion, ...(recap.tipo === "arena-cronica" ? { huella: recap.huella, via: recap.via, marcador: recap.marcador, modelos: recap.modelos, frase: recap.marcas.find(k => k.nombre === "c-clic")?.frase ?? null, eventos: recap.marcas.find(k => k.nombre === "c-clic")?.eventos ?? null } : {}) }, datos: { datos: datosW.datos, overlay: datosW.overlay }, torneo: torneo.liga, omitidas: sin };
  writeFileSync(join(dir, "informe.json"), JSON.stringify(informe, null, 1));
  console.log(JSON.stringify({ duracionS: informe.duracionS, escenas: informe.escenas.map(e => `${e.id} ${e.inicioS}+${e.durS}`), audioSesion }, null, 1));
}

// Fase verificar: duración, flujos, un fotograma por escena (para revisarlos a ojo) y coincidencia de cada
// subtítulo de voz real con el clip que suena (huella FNV-1a del MP3 frente a la que arrancó la página).
function verificar() {
  const informe = JSON.parse(readFileSync(join(TRABAJO, "montaje", "informe.json"), "utf8"));
  let salida = ""; try { execFileSync(FF, ["-hide_banner", "-i", SALIDA], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); } catch (e) { salida = String(e.stderr); }
  const flujos = salida.split("\n").filter(l => /Stream #/.test(l)).map(l => l.trim());
  const dir = join(INFORME, "fotogramas"); mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir).filter(f => /\.(png|jpg)$/.test(f))) execFileSync("rm", ["-f", join(dir, f)]);
  const puntos = informe.escenas.map((e, i) => [`${String(i + 1).padStart(2, "0")}-${e.id}`, e.inicioS + e.durS * (e.id === "cierre" ? 0.15 : 0.6)]);
  for (const [nombre, t] of puntos) ff(["-ss", t.toFixed(2), "-i", SALIDA, "-frames:v", "1", "-q:v", "3", join(dir, `${nombre}.jpg`)]);
  const dirRelatos = join(TRABAJO, informe.toma, "relatos");
  const huellas = informe.audioSesion.map(a => {
    const bytes = readFileSync(join(dirRelatos, a.relato)), tag = huella(bytes);
    const meta = existsSync(join(dirRelatos, a.relato.replace(".mp3", ".json"))) ? JSON.parse(readFileSync(join(dirRelatos, a.relato.replace(".mp3", ".json")), "utf8")) : null;
    return { escena: a.escena, relato: a.relato, alInicio: a.alInicio, coincide: tag === a.tag, tag, tagPagina: a.tag ?? null, texto: meta?.fragmentos?.map(f => f.texto).join(" ") ?? meta?.texto ?? informe.textoEs };
  });
  const r = { duracionS: duracion(SALIDA), bytes: readFileSync(SALIDA).length, flujos, capturas: puntos.map(([n, t]) => ({ archivo: `docs/evidencia/video-067/fotogramas/${n}.jpg`, t: +t.toFixed(2) })), huellas };
  writeFileSync(join(TRABAJO, "montaje", "verificacion.json"), JSON.stringify(r, null, 1));
  writeFileSync(join(INFORME, "verificacion.json"), JSON.stringify(r, null, 1));
  writeFileSync(join(INFORME, "escenas-y-sesion.json"), JSON.stringify(informe, null, 1));
  copyFileSync(join(TRABAJO, "montaje", "subtitulos.ass"), join(INFORME, "subtitulos.ass"));
  console.log(JSON.stringify(r, null, 1));
  if (r.duracionS <= 110 || r.duracionS >= 118) throw new Error(`Duración fuera de 1:50–1:58: ${r.duracionS}`);
  if (!flujos.some(l => /Audio: aac/.test(l)) || !flujos.some(l => /Video: h264/.test(l))) throw new Error("Faltan flujos H.264/AAC");
  if (huellas.some(h => !h.coincide)) throw new Error("Un clip de la sesión no coincide con la huella que sonó");
}

for (const f of fases) {
  console.log(`== ${f}`);
  if (f === "arena") await grabarArena();
  else if (f === "previa") await grabarPrevia();
  else if (f === "recap") await (HUELLA_CRONICA ? grabarCronicaArena() : grabarRecap());
  else if (f === "torneo") await grabarTorneo();
  else if (f === "datos") await grabarDatos();
  else if (f === "tarjetas") await tarjetas();
  else if (f === "voz") await voz();
  else if (f === "montar") montar();
  else if (f === "verificar") verificar();
  else throw new Error(`Fase desconocida: ${f}`);
}
