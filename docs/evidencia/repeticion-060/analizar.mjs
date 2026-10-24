import { readFileSync } from "node:fs";
const d = JSON.parse(readFileSync(process.argv[2], "utf8"));
console.log("forma", d.forma, d.idioma, "conmutador", d.conmutador, "prep ms", d.preparacionMs);
console.log("antes", JSON.stringify(d.antes)); console.log("despues", JSON.stringify(d.despues));
const piezas = d.piezas.filter(p => p.status === 200).sort((a, b) => a.orden - b.orden);
let t = 0; const tramos = [];
for (const p of piezas) { tramos.push({ ...p, inicioS: t, finS: t + p.duracion }); t += p.duracion; }
console.log("total audio s", t.toFixed(1), "piezas", piezas.length, "omitidas", d.piezas.filter(p => p.status !== 200).map(p => p.intervencion + ":" + p.status).join(","));
const tickEn = s => { const i = Math.max(0, tramos.findIndex(x => s < x.finS)); const x = s >= tramos.at(-1).finS ? tramos.at(-1) : tramos[i]; const pr = Math.max(0, Math.min(1, (s - x.inicioS) / (x.finS - x.inicioS))); return x.desdeTick + pr * (x.hastaTick - x.desdeTick); };
// fase por tipo
let previa = 0, narr = 0, inv = 0, ticksN = 0;
for (const x of tramos) { if (x.intervencion?.startsWith("previa")) previa += x.duracion; else if (x.intervencion) inv += x.duracion; else { narr += x.duracion; ticksN += x.hastaTick - x.desdeTick; } }
console.log(`previa ${previa.toFixed(1)} s (0 s de cancha) | invitados ${inv.toFixed(1)} s (0 s de cancha) | narrador ${narr.toFixed(1)} s para ${(ticksN / 10).toFixed(0)} s de cancha → ${(ticksN / 10 / narr).toFixed(3)} s cancha / s audio`);
for (const x of tramos) {
  const ancho = (x.hastaTick - x.desdeTick) / 10;
  const frs = x.fragmentos; const chars = frs.reduce((n, f) => n + f.texto.length + 1, 0);
  let acc = 0; const onsets = frs.map(f => { const o = acc / chars * x.duracion; acc += f.texto.length + 1; return o; });
  const sil = x.inicios.length === frs.length ? x.inicios : null;
  console.log(`${x.intervencion ?? "narrador"} [${x.desdeTick}-${x.hastaTick}] ${x.duracion.toFixed(2)} s audio · ${ancho} s cancha · ${(ancho / x.duracion).toFixed(3)} s/s · frags ${frs.length} inicios ${x.inicios.length}${sil ? " (silencios)" : " (chars)"}`);
  if (!x.intervencion) frs.forEach((f, j) => {
    const o = (sil ?? onsets)[j]; const s = x.inicioS + o; const tk = tickEn(s);
    // tiempo de audio en que la cancha llega al tick del hecho
    const sCancha = x.inicioS + (f.tick - x.desdeTick) / (x.hastaTick - x.desdeTick) * x.duracion;
    if (/goal|gol|shot|remat|save|ataja|wide|over|fuera|Full time|Final/i.test(f.texto) || f.canto) console.log(`    t${f.tick} «${f.texto.slice(0, 50)}» voz a ${s.toFixed(1)} s (char ${(x.inicioS + onsets[j]).toFixed(1)}) · cancha en tick ${tk.toFixed(0)} · desfase partido ${((f.tick - tk) / 10).toFixed(1)} s · voz adelantada ${(sCancha - s).toFixed(1)} s reales`);
  });
}
// verificación de muestras: pendiente cancha/audio
const m = d.muestras.filter(x => !x.pausado && x.at > 0);
let err = 0, n = 0; for (const x of m) { const pred = tickEn(x.at) / 10; err = Math.max(err, Math.abs(pred - x.v)); n++; }
console.log("muestras", n, "error max |v - instanteNarrado| s", err.toFixed(2));
// pendiente reloj vs pared
const pend = []; for (let i = 10; i < m.length; i += 10) { const a = m[i - 10], b = m[i]; pend.push([(b.at - a.at) / ((b.ms - a.ms) / 1000), (b.v - a.v) / (b.at - a.at)]); }
console.log("audio/pared media", (pend.reduce((s, p) => s + p[0], 0) / pend.length).toFixed(3));
