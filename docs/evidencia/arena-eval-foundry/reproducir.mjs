import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const resultado = JSON.parse(readFileSync(new URL("resultado.json", import.meta.url), "utf8"));
for (const [archivo, esperado] of Object.entries(resultado.hashes)) {
  const actual = createHash("sha256").update(readFileSync(new URL(archivo, import.meta.url))).digest("hex");
  if (actual !== esperado) throw new Error(`Archivo alterado: ${archivo}`);
}
console.log(JSON.stringify({
  estado: resultado.estado,
  metodo: resultado.metodo,
  filas: resultado.resultados.map(r => ({
    tick: r.tick, brazo: r.brazo,
    criterios: r.resultados.map(m => ({ nombre: m.nombre, puntuacion: m.puntuacion, aprobada: m.aprobada })),
  })),
  conclusion: resultado.conclusion,
}, null, 2));
