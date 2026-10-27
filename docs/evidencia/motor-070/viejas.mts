// Brief 070 § 3 · bandas viejas (046 recalibradas, 051, 063 A y B/C) y BANDAS_068 sobre unas reglas y un lote.
// Uso (desde la raíz del repo, Node 24): node --import tsx docs/evidencia/motor-070/viejas.mts <reglas> <rapido|completo> [desde]
// Imprime una línea JSON con las métricas principales y la lista de incumplimientos (vacía = cumple).
import { LOTE_ARENA_046 as L } from "../../../src/sim/limites.ts";
import { bandasLote, incumplimientos, incumplimientos063, incumplimientosBC, medirLote } from "../../../src/arena/metricas-lote.ts";
import { incumplimientos068, medirLote068 } from "../../../src/arena/metricas-068.ts";
import type { ReglasArena } from "../../../src/arena/tipos.ts";

const [reglas, tamano, desde] = process.argv.slice(2) as [ReglasArena, "rapido" | "completo", string | undefined];
const inicio = Date.now();
const lote = { desde: desde ? Number(desde) : L[tamano].semillaDesde, semillas: L[tamano].semillas, reglas };
const m = await medirLote(lote);
const b = bandasLote(reglas, tamano);
const viejas = [...incumplimientos(m, b.b046, b.b051), ...incumplimientos063(m, b.b063!), ...incumplimientosBC(m, b.bBC!)];
const v9 = await medirLote068({ ...lote, reglas: "reinicios-v9" }), k = await medirLote068(lote);
console.log(JSON.stringify({ reglas, tamano, desde: lote.desde, goles: m.golesPorPartido, remates: m.remate.porPartido, conversion: m.remate.conversion, aPuerta: m.remate.aPuerta,
  conversionManoAMano: m.manoAMano.conversion, centros: m.centros.porPartido, a: m.persecucion063, bc: m.largoLejano063, fallosViejas: viejas,
  m068: k, golesV9: v9.golesPorPartido, fallos068: tamano === "completo" ? incumplimientos068(k, v9.golesPorPartido) : "solo completo", segundos: Math.round((Date.now() - inicio) / 1000) }));
