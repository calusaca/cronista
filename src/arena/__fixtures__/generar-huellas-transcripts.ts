// Brief 048 · Huellas de los transcripts de referencia (material ajeno, NO versionado).
// Los seis transcripts de transmisiones reales viven solo en local (docs/DatosPrueba, ignorado por git).
// Para comprobar que ninguna plantilla copia cuatro o más palabras seguidas de ellos sin distribuir el
// texto, se versiona solo un conjunto de huellas SHA-256 truncadas de sus tramos normalizados de 4 palabras.
// Uso: node --import tsx src/arena/__fixtures__/generar-huellas-transcripts.ts [directorio]
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { huellaTramo, normalizarTramo, quitarMarcasDeTiempo } from "./huellas-transcripts";

const dir = process.argv[2] ?? "docs/DatosPrueba";
const archivos = readdirSync(dir).filter(f => f.endsWith(".txt")).sort();
const huellas = new Set<string>();
for (const f of archivos) {
  const palabras = normalizarTramo(quitarMarcasDeTiempo(readFileSync(join(dir, f), "utf8"))).split(" ").filter(Boolean);
  for (let k = 0; k + 4 <= palabras.length; k++) huellas.add(huellaTramo(palabras.slice(k, k + 4).join(" ")));
}
const ordenadas = [...huellas].sort();
const salida = {
  descripcion: "Huellas SHA-256 (12 hex) de tramos normalizados de 4 palabras de los transcripts de referencia; no contiene texto.",
  archivos: archivos.length,
  huellaCorpus: createHash("sha256").update(ordenadas.join("")).digest("hex"),
  huellas: ordenadas.join(""),
};
writeFileSync("src/arena/__fixtures__/huellas-transcripts.json", JSON.stringify(salida) + "\n");
console.log(`${archivos.length} archivos, ${ordenadas.length} huellas`);
