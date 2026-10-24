// Uso: node medir.mjs <base> <forma> <idioma> <salida.json> [archivoReplay.json]
// forma: duelo | ejemplo-v3 | ejemplo | partido:<id> | crear | importar:<ruta> | torneo:<id>:<n>
import { chromium } from "/home/calusaca/cronista/node_modules/@playwright/test/index.mjs";
import { readFileSync, writeFileSync } from "node:fs";
const [base, forma, idioma = "en", salida, replay] = process.argv.slice(2);
const es = idioma === "es";
const navegador = await chromium.launch();
const page = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
const capturas = []; const repl = replay ? JSON.parse(readFileSync(replay, "utf8")) : null; let k = 0;
if (repl) {
  await page.route("**/api/arena/herramientas", r => r.fulfill({ json: { voz: true, analista: false } }));
  await page.route("**/api/arena/grabaciones", r => r.fulfill({ json: { id: "00000000-0000-4000-8000-0000000000aa" } }));
  await page.route("**/api/arena/sesiones/*/relato", async r => {
    const p = r.request().postDataJSON();
    const c = repl.capturas.find(c => c.pedido.desdeTick === p.desdeTick && c.pedido.hastaTick === p.hastaTick && (c.pedido.intervencion ?? null) === (p.intervencion ?? null) && c.pedido.idioma === p.idioma);
    if (!c || c.status !== 200) return r.fulfill({ status: 404, json: { error: "x" } });
    return r.fulfill({ json: c.cuerpo });
  });
}
page.on("response", async r => {
  if (!r.url().includes("/relato")) return;
  try { const pedido = r.request().postDataJSON(); const cuerpo = r.status() === 200 ? await r.json() : null; capturas.push({ orden: k++, pedido, status: r.status(), cuerpo }); } catch {}
});
await page.addInitScript(() => {
  window.__m = [];
  setInterval(() => {
    const a = document.querySelector('[data-testid="arena-narration"] audio'), s = document.querySelector("input.arena-seek"), c = document.querySelector('[data-testid="arena-clock"]');
    if (a && a.src) window.__m.push({ ms: performance.now(), at: a.currentTime, pausado: a.paused, fin: a.ended, v: s ? Number(s.value) : null, reloj: c?.textContent });
  }, 100);
});
const b = n => page.getByRole("button", { name: n, exact: true });
let url = `${base}/arena${es ? "?lang=es" : ""}`;
if (forma.startsWith("partido:")) url = `${base}/arena?partido=${forma.slice(8)}${es ? "&lang=es" : ""}`;
if (forma.startsWith("torneo:")) { const [, id, n] = forma.split(":"); url = `${base}/arena?torneo=${id}&encuentro=${n}${es ? "&lang=es" : ""}`; }
await page.goto(url);
const asignacion = async () => ({ assignment: await page.getByTestId("arena-live-assignment").allTextContents(), torneo: await page.getByTestId("arena-torneo-origen").allTextContents(), controladores: await page.locator(".arena-controller").allTextContents() });
if (["duelo", "ejemplo-v3", "ejemplo", "crear"].includes(forma) || forma.startsWith("importar:")) {
  await b(es ? "Partidos guardados" : "Saved matches").click();
  if (forma === "duelo") await b(es ? "Cargar duelo de modelos grabado" : "Load recorded model duel").click();
  if (forma === "ejemplo-v3") await b(es ? "Cargar ejemplo de entrenadores IA" : "Load AI coaches example").click();
  if (forma === "ejemplo") await b(es ? "Cargar ejemplo de IA grabado" : "Load recorded AI run").click();
  if (forma === "crear") { await page.getByRole("combobox", { name: es ? "Duración simulada" : "Simulated duration", exact: true }).selectOption("30"); await b(es ? "Crear grabación sin IA" : "Create recording without AI").click(); }
  if (forma.startsWith("importar:")) await page.locator('input[type="file"]').first().setInputFiles(forma.slice(9));
}
await page.waitForFunction(() => /0:00 \/ [1-9]|0:00 \/ 0:[1-9]/.test(document.querySelector('[data-testid="arena-clock"]')?.textContent ?? ""), null, { timeout: 60000 });
await page.waitForTimeout(1500);
const info = { forma, idioma, antes: await asignacion() };
const conmutador = page.getByTestId("arena-play-voice");
info.conmutador = await conmutador.count() ? await conmutador.isChecked() : null;
if (process.env.SOLO_INFO) { writeFileSync(salida, JSON.stringify(info, null, 1)); await navegador.close(); process.exit(0); }
await page.locator(".arena-playback .btn-primary").click();
const t0 = Date.now();
await page.waitForFunction(() => { const a = document.querySelector('[data-testid="arena-narration"] audio'); return a && a.src && !a.paused; }, null, { timeout: 240000 });
info.preparacionMs = Date.now() - t0;
await page.waitForFunction(() => { const a = document.querySelector('[data-testid="arena-narration"] audio'); return a && (a.ended || !a.src); }, null, { timeout: 600000, polling: 500 });
info.despues = await asignacion();
info.muestras = await page.evaluate(() => window.__m);
// Duraciones y silencios por pieza
info.piezas = await page.evaluate(async capt => {
  const ctx = new AudioContext({ sampleRate: 24000 }); const out = [];
  for (const c of capt) {
    if (c.status !== 200 || !c.cuerpo?.audio) { out.push({ orden: c.orden, status: c.status, intervencion: c.pedido.intervencion ?? null }); continue; }
    const bytes = Uint8Array.from(atob(c.cuerpo.audio.base64), x => x.charCodeAt(0));
    const buf = await ctx.decodeAudioData(bytes.buffer); const d = buf.getChannelData(0), sr = buf.sampleRate, ven = Math.round(sr * 0.02);
    const rms = []; for (let i = 0; i + ven <= d.length; i += ven) { let s = 0; for (let j = i; j < i + ven; j++) s += d[j] * d[j]; rms.push(Math.sqrt(s / ven)); }
    const umbral = Math.max(0.004, Math.max(...rms) * 0.03);
    // inicios de voz tras silencios de >= 60 ms
    const inicios = []; let sil = 99;
    rms.forEach((r, i) => { if (r < umbral) sil++; else { if (sil >= 3) inicios.push(+(i * 0.02).toFixed(2)); sil = 0; } });
    out.push({ orden: c.orden, status: 200, duracion: buf.duration, inicios, desdeTick: c.cuerpo.desdeTick, hastaTick: c.cuerpo.hastaTick, intervencion: c.pedido.intervencion ?? null, rol: c.cuerpo.rol ?? "narrador", fragmentos: c.cuerpo.fragmentos.map(f => ({ tick: f.tick, texto: f.texto, canto: !!f.canto })) });
  }
  return out;
}, capturas);
writeFileSync(salida, JSON.stringify({ ...info, capturas }, null, 1));
await navegador.close();
