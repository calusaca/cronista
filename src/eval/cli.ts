// CLI de la eval (brief 022): `npm run eval [-- --md <ruta>]`
// El LLM se elige por CRONISTA_LLM como todo lo demás (un .env en la raíz se carga si existe).
// Imprime el informe en Markdown; con --md lo escribe además en esa ruta. Exit 0 SOLO si el
// pipeline publicó 0 frases con hallazgos; sin credenciales del backend pedido, mensaje claro y 1.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { crearLlmDesdeEnv } from "../lib/llm";
import { correrEval, informe } from "./eval";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--md");
  const md = i >= 0 ? argv[i + 1] : undefined;
  if (i >= 0 && !md) throw new Error("--md necesita una ruta");
  if (existsSync(".env")) process.loadEnvFile(".env");
  const llm = crearLlmDesdeEnv();
  const r = await correrEval(llm);
  const texto = informe(r);
  process.stdout.write(texto);
  if (md) {
    mkdirSync(dirname(md), { recursive: true });
    writeFileSync(md, texto, "utf8");
  }
  if (r.pipelineConHallazgos !== 0) {
    console.error(`error: el pipeline publicó ${r.pipelineConHallazgos} frase(s) con hallazgos — bug del producto`);
    process.exit(2);
  }
}

main().catch((e: unknown) => {
  console.error(`error: ${(e as Error).message}`);
  process.exit(1);
});
