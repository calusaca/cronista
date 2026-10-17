import { cpSync, existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const esEntorno = name => name === ".env" || name.startsWith(".env.");

export function prepareStandalone(root, secrets = []) {
  const out = resolve(root, ".next/standalone");
  if (!existsSync(join(out, "server.js"))) throw new Error("Ejecuta npm run build primero.");
  // Next copia sus loadedEnvFiles APARTE del tracing. Solo se retiran las copias
  // del artefacto; nunca se toca la configuración original del checkout.
  for (const f of readdirSync(out)) if (esEntorno(f)) rmSync(join(out, f));
  cpSync(join(root, "public"), join(out, "public"), { recursive: true });
  cpSync(join(root, ".next/static"), join(out, ".next/static"), { recursive: true });
  for (const f of ["docs/dataset/ficha.json", "docs/dataset/DATASHEET.md"]) {
    if (!existsSync(join(out, f))) throw new Error(`Falta ${f} en el tracing de Next.`);
  }
  function comprobar(dir) {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, f.name);
      if (esEntorno(f.name)) throw new Error(`Archivo de entorno en el artefacto: ${path}`);
      if (f.isDirectory()) comprobar(path);
      else if (f.isFile() && secrets.some(s => s && readFileSync(path).includes(Buffer.from(s)))) throw new Error(`Credencial encontrada en el artefacto: ${path}`);
    }
  }
  comprobar(out);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  if (existsSync(join(root, ".env"))) process.loadEnvFile(join(root, ".env"));
  prepareStandalone(root, [process.env.AZURE_OPENAI_API_KEY, process.env.FOUNDRY_API_KEY].filter(Boolean));
  console.log("Standalone listo: servidor, assets y dataset; sin .env ni credenciales conocidas.");
}
