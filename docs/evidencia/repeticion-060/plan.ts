import { readFileSync } from "node:fs";
import { construirRelato } from "/home/calusaca/cronista/src/arena/relato";
import { recordarVoz } from "/home/calusaca/cronista/src/arena/editorial";
const R = "/home/calusaca/cronista/public/experimentos/";
const reaccion = 0.3, retraso = 3, pEspera = 60, cps = 11.6, sobre = 1.1, hueco = 0.25;
for (const f of ["arena-duelo-v3.json", "arena-llm-v3.json"]) {
  const r = JSON.parse(readFileSync(R + f, "utf8")); const fin = r.final.tick / 10;
  for (const idioma of ["es", "en"] as const) {
    let memoria: any[] = []; const clips: any[] = [];
    for (let d = 0; d < r.final.tick; d += 50) {
      const h = Math.min(d + 50, r.final.tick);
      const s: any = construirRelato(r, d, h, "buffer", idioma, { memoria });
      if (s.texto) { const f0 = s.fragmentos[0]; memoria = recordarVoz(memoria, { tick: f0.tick, texto: s.texto.slice(0, 500), clave: s.claveVoz, tema: s.temaVoz }); clips.push({ tick: f0.tick / 10, d: s.texto.length / cps + sobre, p: s.prioridad, t: s.texto.slice(0, 30) }); }
    }
    const c: any = construirRelato(r, Math.floor((r.final.tick - 1) / 50) * 50, r.final.tick, "buffer", idioma, { cierre: true, memoria });
    clips.push({ tick: fin, d: c.texto.length / cps + sobre, p: 1000, t: "cierre" });
    // planificador simplificado: P = cursor, T = audio, voz libre
    let P = 0, T = 0, voz = 0, esperas = 0, omit: string[] = [], lags: number[] = [];
    for (let i = 0; i < clips.length; i++) {
      const k = clips[i], alta = k.p >= pEspera, obj = Math.min(fin, k.tick + (k.p === 1000 ? 0 : reaccion));
      // lookahead
      const sig = clips.slice(i + 1).find(x => x.p >= pEspera);
      let inicioT: number, inicioP: number;
      const tReach = T + Math.max(0, obj - P);
      if (voz <= tReach) { inicioT = tReach; inicioP = Math.max(P, obj); }
      else { inicioT = voz; inicioP = Math.max(P, obj) + (voz - tReach); }
      if (inicioP > fin) { const extra = inicioP - fin; inicioP = fin; esperas += extra; }
      let lag = inicioP - k.tick;
      if (lag > retraso + 1e-9 && k.p !== 1000) {
        if (!alta) { omit.push(k.t); continue; }
        const hold = lag - retraso; esperas += hold; inicioP = k.tick + retraso; lag = retraso;
      }
      if (!alta && sig && inicioP + k.d > Math.min(fin, sig.tick + reaccion) + 1e-9 && sig.p !== 1000) { omit.push("cede:" + k.t); continue; }
      T = inicioT; P = inicioP; voz = T + k.d + hueco; lags.push(+lag.toFixed(1));
      if (k.p === 1000) { T = voz; }
    }
    const pistaS = Math.max(T, voz) ;
    console.log(f, idioma, `clips ${clips.length} omitidos ${omit.length} · esperas ${esperas.toFixed(1)} s · pista narrador ≈ ${pistaS.toFixed(0)} s para ${fin} s · retrasos ${lags.join(",")}`);
  }
}
