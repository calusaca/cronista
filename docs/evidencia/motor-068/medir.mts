// Brief 068 § 3 · lote de medida: programados, 120 s (LOTE_ARENA_046.duracionS), v9 frente a v10.
// Uso (desde la raíz del repo, Node 24): node --import tsx docs/evidencia/motor-068/medir.mts <reglas> <desde> <semillas> [duracionS]
// Imprime una línea JSON con las métricas de src/arena/metricas-068.ts (fueras de juego, las del receptor previsto,
// faltas, fracción sin falta, amarillas, rojas, goles y tiros por partido).
import { medirLote068 } from "../../../src/arena/metricas-068.ts";
import type { ReglasArena } from "../../../src/arena/tipos.ts";

const [reglas, desde, semillas, duracionS] = process.argv.slice(2);
const inicio = Date.now();
const m = await medirLote068({ reglas: reglas as ReglasArena, desde: Number(desde), semillas: Number(semillas), ...(duracionS ? { duracionS: Number(duracionS) } : {}) });
console.log(JSON.stringify({ ...m, segundos: Math.round((Date.now() - inicio) / 1000) }));
