// Brief 070 § 3 · lote de medida: programados, 120 s (LOTE_ARENA_046.duracionS), v10 frente a v11.
// Uso (desde la raíz del repo, Node 24): node --import tsx docs/evidencia/motor-070/medir.mts <reglas> <desde> <semillas> [duracionS]
// Imprime una línea JSON con las métricas de src/arena/metricas-070.ts (faltas, recuperación del infractor en la ventana
// del § 1, tiros libres y directos, penales y su conversión, rivales a < 9,15 m en la ejecución, goles, tiros y fueras de
// juego por partido) y los conteos por partido (la conversión de 1–200 se agrega sobre dos lotes).
import { medirLote070 } from "../../../src/arena/metricas-070.ts";
import type { ReglasArena } from "../../../src/arena/tipos.ts";

const [reglas, desde, semillas, duracionS] = process.argv.slice(2);
const inicio = Date.now();
const { metricas, conteos } = await medirLote070({ reglas: reglas as ReglasArena, desde: Number(desde), semillas: Number(semillas), ...(duracionS ? { duracionS: Number(duracionS) } : {}) });
console.log(JSON.stringify({ ...metricas, segundos: Math.round((Date.now() - inicio) / 1000), conteos }));
