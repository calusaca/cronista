import { chromium } from "/home/calusaca/cronista/node_modules/@playwright/test/index.mjs";
import { readFileSync } from "node:fs";
const [archivo] = process.argv.slice(2);
const d = JSON.parse(readFileSync(archivo, "utf8"));
const nav = await chromium.launch(); const page = await nav.newPage(); await page.goto("about:blank");
for (const c of d.capturas.filter(c => !c.pedido.intervencion && c.status === 200)) {
  const n = c.cuerpo.fragmentos.length;
  const r = await page.evaluate(async ([b64, n]) => {
    const ctx = new AudioContext({ sampleRate: 24000 }); const buf = await ctx.decodeAudioData(Uint8Array.from(atob(b64), x => x.charCodeAt(0)).buffer);
    const x = buf.getChannelData(0), sr = buf.sampleRate, w = sr / 100; const e = [];
    for (let i = 0; i + w <= x.length; i += w) { let s = 0; for (let j = i; j < i + w; j++) s += x[j] * x[j]; e.push(Math.sqrt(s / w)); }
    const thr = Math.max(...e) * 0.02; const runs = []; let ini = -1;
    e.forEach((v, i) => { if (v < thr) { if (ini < 0) ini = i; } else { if (ini >= 0) { runs.push({ fin: i, len: i - ini }); ini = -1; } } });
    const primera = e.findIndex(v => v >= thr);
    const largos = runs.filter(r => r.fin > primera).sort((a, b) => b.len - a.len).slice(0, n - 1).sort((a, b) => a.fin - b.fin);
    return { dur: buf.duration, onsets: [primera / 100, ...largos.map(r => r.fin / 100)], gaps: largos.map(r => r.len * 10) };
  }, [c.cuerpo.audio.base64, n]);
  const chars = c.cuerpo.fragmentos.reduce((k, f) => k + f.texto.length + 1, 0); let acc = 0;
  console.log(`[${c.pedido.desdeTick}-${c.pedido.hastaTick}] ${r.dur.toFixed(1)} s · huecos ms ${r.gaps.join(",")}`);
  c.cuerpo.fragmentos.forEach((f, j) => { const est = acc / chars * r.dur; acc += f.texto.length + 1; const lin = (f.tick - c.pedido.desdeTick) / (c.pedido.hastaTick - c.pedido.desdeTick) * r.dur; console.log(`   t${f.tick} silencios ${r.onsets[j]?.toFixed(1)} s · caracteres ${est.toFixed(1)} s · cancha llega ${lin.toFixed(1)} s · ${f.texto.slice(0, 40)}`); });
}
await nav.close();
