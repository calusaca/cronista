// Comprobación de bandas con el helper oficial (medirLote) y overrides en tiempo de ejecución.
// uso: node --import tsx bandas.mts <reglas> <desde> <n> [overridesJSON] [etiqueta]
import * as L from "/home/calusaca/cronista/src/sim/limites.ts";
import { bandasLote, incumplimientos, incumplimientos063, incumplimientosBC, medirLote } from "/home/calusaca/cronista/src/arena/metricas-lote.ts";
const [reglas, desdeS, nS, ovS, etiqueta] = process.argv.slice(2);
const ov: Record<string, unknown> = ovS ? JSON.parse(ovS) : {};
for (const [ruta, valor] of Object.entries(ov)) { const p = ruta.split("."); let o: any = (L as any)[p.shift()!]; while (p.length > 1) o = o[p.shift()!]; o[p[0]!] = valor; }
const m = await medirLote({ desde: Number(desdeS), semillas: Number(nS), reglas: reglas as any });
const { b046, b051, b063, bBC } = bandasLote(reglas as any, Number(nS) === L.LOTE_ARENA_046.rapido.semillas ? "rapido" : "completo");
const inc = [...incumplimientos(m, b046 as any, b051), ...(b063 ? incumplimientos063(m, b063) : []), ...(bBC ? incumplimientosBC(m, bBC) : [])];
const r = (x: number | null) => x === null ? null : Math.round(x * 1000) / 1000;
console.log(JSON.stringify({ etiqueta, reglas, semillas: `${desdeS}+${nS}`, goles: r(m.golesPorPartido), conversion: r(m.remate.conversion), aPuerta: r(m.remate.aPuerta), fuera: r(m.remate.fuera), atajadas: r(m.remate.atajadasSobreAPuerta), mamConv: r(m.manoAMano.conversion), lejanosPP: r(m.largoLejano063.lejanosPorPartido), convLejanos: r(m.largoLejano063.conversionLejanos), aPuertaLejanos: r(m.largoLejano063.aPuertaLejanos), incumplimientos: inc }));
