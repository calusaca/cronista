// modo: letras c (sin filtro de centro), l (sin filtro de largo); factor; tamaño rapido|completo
const [modo, factor, tamano] = process.argv.slice(2);
if (modo.includes("c")) (globalThis as any).SIN_CENTRO = true;
if (modo.includes("l")) (globalThis as any).SIN_LARGO = true;
const lim = await import("/home/calusaca/cronista/src/sim/limites.ts");
(lim.FALTAS_ARENA_V10 as any).factorProbabilidad = Number(factor);
const ml = await import("/home/calusaca/cronista/src/arena/metricas-lote.ts");
const m68 = await import("/home/calusaca/cronista/src/arena/metricas-068.ts");
const L = lim.LOTE_ARENA_046, t = tamano as "rapido" | "completo";
const lote = { desde: process.argv[5] ? Number(process.argv[5]) : L[t].semillaDesde, semillas: L[t].semillas, reglas: "reinicios-v10" as const };
const m = await ml.medirLote(lote);
const b = ml.bandasLote("reinicios-v10", t);
const f = [...ml.incumplimientos(m, b.b046, b.b051), ...ml.incumplimientos063(m, b.b063!), ...ml.incumplimientosBC(m, b.bBC!)];
const k = await m68.medirLote068(lote);
console.log(JSON.stringify({ modo, factor, tamano, goles: m.golesPorPartido, fallosViejas: f, m068: k }));
