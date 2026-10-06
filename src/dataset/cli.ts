// CLI del dataset (brief 028): `npm run dataset [-- --n 100 --out docs/dataset --micro --liga [id]]`
// Escribe partidos.jsonl, resumen.csv (y micro.jsonl.gz con --micro), DATASHEET.md y ficha.json,
// e imprime el SHA-256 de cada archivo. `npm run dataset -- --muestra` regenera la muestra de /datos.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parsearArgsDataset } from "./cli-args";
import { generarDataset, muestra, sha256 } from "./generar";
import { MUESTRA_ARCHIVO } from "./umbrales-dataset";

const USO = "uso: npm run dataset -- [--n <entero>] [--out <dir>] [--micro] [--liga [id] [--temporada <entero>]] | --muestra";

async function main(): Promise<void> {
  const a = parsearArgsDataset(process.argv.slice(2));
  if (!a.ok) {
    console.error(`error: ${a.error}`);
    console.error(USO);
    process.exit(1);
  }
  if (a.tipo === "muestra") {
    mkdirSync("public", { recursive: true });
    const texto = muestra();
    const ruta = join("public", MUESTRA_ARCHIVO);
    writeFileSync(ruta, texto, "utf8");
    console.log(`${sha256(texto)}  ${ruta}`);
    return;
  }
  const t0 = Date.now();
  const r = await generarDataset(a.opciones, a.out);
  for (const f of r.archivos) console.log(`${f.sha256}  ${join(a.out, f.nombre)}  (${f.lineas} líneas, ${f.bytes} bytes)`);
  console.log(`${sha256(r.datasheet)}  ${join(a.out, "DATASHEET.md")}`);
  console.log(`${sha256(r.ficha)}  ${join(a.out, "ficha.json")}`);
  console.error(`${r.modelo.composicion.partidos} partidos en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

main().catch((e: unknown) => {
  console.error(`error: ${(e as Error).message}`);
  process.exit(1);
});
