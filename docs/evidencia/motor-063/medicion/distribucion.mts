const R = process.env.RAIZ!;
const { crearConfigArena, crearEstadoArena } = await import(`${R}/arena/motor.ts`);
const { atributos } = await import(`${R}/arena/juego063.ts`);
const sum: Record<string, number[]> = {}; const porPos: Record<string, Record<string, number[]>> = {}; const estilos: Record<string, number> = {}; const distintos: Record<string, number> = {};
let n = 0, extremos = 0;
for (let seed = 1; seed <= 200; seed++) {
  const c = crearConfigArena({ seed }); const e = crearEstadoArena(c);
  for (const l of ["local", "visita"]) estilos[c.estilosJuego[l]] = (estilos[c.estilosJuego[l]] ?? 0) + 1;
  for (const j of [...e.jugadores, ...e.banco]) {
    if (j.posicionNatural === "POR") continue; n++;
    let max = ""; let mv = -1;
    for (const a of atributos) { (sum[a] ??= []).push(j.atributos[a]); ((porPos[j.posicionNatural] ??= {})[a] ??= []).push(j.atributos[a]); if (j.atributos[a] > mv) { mv = j.atributos[a]; max = a; } }
    distintos[max] = (distintos[max] ?? 0) + 1; if (mv >= 75) extremos++;
  }
}
const m = (xs: number[]) => +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);
console.log(JSON.stringify({ jugadoresCampo: n, media: Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, m(v)])), min: Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, Math.min(...v)])), max: Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, Math.max(...v)])),
  porPosicion: Object.fromEntries(Object.entries(porPos).map(([p, o]) => [p, Object.fromEntries(Object.entries(o).map(([k, v]) => [k, m(v)]))])), atributoMaximo: distintos, fraccionConRasgo75: extremos / n, estilos }, null, 1));
