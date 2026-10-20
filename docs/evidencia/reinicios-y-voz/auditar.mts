import { readFile, writeFile } from "node:fs/promises";
import { ejecutarArena, reproducirArena } from "../../../src/arena/coordinador.ts";
import { crearConfigArena } from "../../../src/arena/motor.ts";
import { crearControladorProgramado } from "../../../src/arena/controladores.ts";
import { isDeepStrictEqual } from "node:util";

const totales: Record<string, number> = {}, ejemplos: Record<string, { seed: number; tick: number }> = {};
for (let seed = 1; seed <= 30; seed++) {
  const registro = await ejecutarArena(crearConfigArena({ seed, duracionS: 60 }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
  if (!isDeepStrictEqual(reproducirArena(registro), registro)) throw new Error(`Reproducción distinta: ${seed}`);
  for (const e of registro.eventos) {
    const k = e.tipo === "reinicio" && e.reinicio ? e.reinicio : e.tipo;
    totales[k] = (totales[k] ?? 0) + 1; ejemplos[k] ??= { seed, tick: e.tick };
  }
}
// Recalcular también cada ejemplo archivado del proyecto.
const directorio = new URL("../../../public/experimentos/", import.meta.url);
const { readdir } = await import("node:fs/promises");
const historicos = [];
for (const nombre of await readdir(directorio)) {
  if (!nombre.startsWith("arena-") || !nombre.endsWith(".json")) continue;
  const r = JSON.parse(await readFile(new URL(nombre, directorio), "utf8"));
  if (!r.config || !r.fotogramas) continue;
  if (!isDeepStrictEqual(reproducirArena(r), r)) throw new Error(`Archivo distinto: ${nombre}`);
  historicos.push(nombre);
}
const v2 = JSON.parse(await readFile(new URL("../../../src/arena/__fixtures__/arena-v2.json", import.meta.url), "utf8"));
if (!isDeepStrictEqual(reproducirArena(v2), v2)) throw new Error("Archivo v2 distinto");
historicos.push("src/arena/__fixtures__/arena-v2.json");
const resultado = { checkedUtc: new Date().toISOString(), partidos: 30, duracionS: 60, totales, ejemplos, reproduccionExacta: 30, archivosHistoricosExactos: historicos, llamadasModelos: 0 };
await writeFile(new URL("corpus.json", import.meta.url), JSON.stringify(resultado, null, 2) + "\n");
console.log(JSON.stringify(resultado));
