// Node 24 + Azure CLI. ACR compila en Azure: no hace falta Docker local.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE = ["Dockerfile", ".dockerignore", "package.json", "package-lock.json", "tsconfig.json", "next.config.ts", "src", "public", "docs/dataset/ficha.json", "docs/dataset/DATASHEET.md"];

/** Allowlist independiente de git/dockerignore: el archivo enviado a ACR nunca es el checkout. */
export function stageSource(root, destination, secrets = []) {
  const files = [];
  function inspect(path, relative) {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error(`No se permiten enlaces simbólicos en el contexto: ${relative}`);
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort()) inspect(join(path, name), `${relative}/${name}`);
    } else if (stat.isFile()) {
      const data = readFileSync(path);
      if (basename(path) === ".env" || basename(path).startsWith(".env.")) throw new Error(`Archivo de entorno en el contexto: ${relative}`);
      if (secrets.some(s => s && data.includes(Buffer.from(s)))) throw new Error(`Credencial encontrada en un archivo del contexto: ${relative}`);
      files.push({ path: relative, bytes: data.length, sha256: createHash("sha256").update(data).digest("hex") });
    } else throw new Error(`Tipo de archivo no permitido: ${relative}`);
  }
  // Comprobar todo antes de copiar: no deja un contexto parcial con una credencial.
  for (const f of SOURCE) inspect(join(root, f), f);
  mkdirSync(destination, { recursive: true, mode: 0o700 });
  for (const f of SOURCE) {
    mkdirSync(join(destination, f, ".."), { recursive: true });
    cpSync(join(root, f), join(destination, f), { recursive: true });
  }
  return files;
}

/** Toda variable `*_API_KEY` / `*_KEY` (incluidas las prefijadas ARENA_<ID>_…) más la cadena
 * de Application Insights: valores no vacíos, sin repetir. */
export function secretosDeEntorno(env = process.env) {
  const valores = Object.entries(env)
    .filter(([nombre, valor]) => (/_KEY$/.test(nombre) || nombre === "APPLICATIONINSIGHTS_CONNECTION_STRING") && typeof valor === "string" && valor.trim() !== "")
    .map(([, valor]) => valor);
  return [...new Set(valores)];
}

async function main() {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  if (existsSync(join(root, ".env"))) process.loadEnvFile(join(root, ".env"));
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("npm run deploy:azure -- --prepare | --check | --subscription <id> [--resource-group rg-cronista-demo] [--location eastus2] [--app cronista]");
    return;
  }
  const allowed = new Set(["--prepare", "--check", "--subscription", "--resource-group", "--location", "--app"]);
  for (let i = 0; i < args.length; i++) {
    if (!allowed.has(args[i])) throw new Error(`Argumento desconocido: ${args[i]}`);
    if (!["--prepare", "--check"].includes(args[i])) {
      if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`Falta el valor de ${args[i]}`);
      i++;
    }
  }
  const option = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
  const subscription = option("--subscription", process.env.AZURE_SUBSCRIPTION_ID);
  const group = option("--resource-group", "rg-cronista-demo");
  const location = option("--location", "eastus2");
  const appName = option("--app", "cronista");
  if (!/^[a-z][a-z0-9-]{0,30}[a-z0-9]$/.test(appName) || appName.includes("--")) throw new Error("Nombre de app inválido (2–32 caracteres, minúsculas/números/guiones).");
  // Brief 052 v1.1 §7: toda variable *_API_KEY / *_KEY y la cadena de Insights.
  const secrets = secretosDeEntorno(process.env);
  const redact = value => secrets.reduce((text, secret) => text.split(secret).join("[REDACTED]"), value);
  async function az(params, { json = false } = {}) {
    return await new Promise((res, rej) => {
      const child = spawn("az", [...params, ...(subscription ? ["--subscription", subscription] : []), "--only-show-errors", "--output", json ? "json" : "none"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "", stderr = "";
      child.stdout.on("data", chunk => { stdout += chunk; });
      child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-8000); });
      child.on("error", () => rej(new Error("Azure CLI no disponible. Instala Azure CLI y ejecuta az login antes de publicar.")));
      child.on("close", code => {
        if (code !== 0) rej(new Error(redact(`Azure CLI (${params.slice(0, 3).join(" ")}): ${stderr || stdout.slice(-8000)}`)));
        else {
          try { res(json ? JSON.parse(stdout) : undefined); } catch { rej(new Error("Azure CLI no devolvió JSON válido.")); }
        }
      });
    });
  }
  const temporary = mkdtempSync(join(tmpdir(), "cronista-deploy-"));
  try {
    const source = join(temporary, "source");
    const files = stageSource(root, source, secrets);
    const cacheDir = join(root, ".cache/deploy");
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, "source-manifest.json"), JSON.stringify({ files }, null, 2) + "\n");
    console.log(`Contexto de ACR validado: ${files.length} archivos, sin .env ni credenciales conocidas.`);
    if (args.includes("--prepare")) return;
    if (!subscription) throw new Error("Indica --subscription <id> o AZURE_SUBSCRIPTION_ID. No se selecciona una suscripción implícitamente.");
    const account = await az(["account", "show", "--query", "{id:id,state:state}"], { json: true });
    if (account.id !== subscription || account.state !== "Enabled") throw new Error("La suscripción indicada no está habilitada en la sesión de az login.");
    for (const name of ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_DEPLOYMENT", "AZURE_OPENAI_REASONING_EFFORT"]) {
      if (!process.env[name]?.trim()) throw new Error(`Falta ${name} en el entorno o en .env.`);
    }
    if (new URL(process.env.AZURE_OPENAI_ENDPOINT).protocol !== "https:") throw new Error("El endpoint de Azure OpenAI debe usar HTTPS.");
    console.log("Cuenta y configuración verificadas.");
    if (args.includes("--check")) return;
    // Desde aquí crea recursos facturables en un grupo dedicado. No borra recursos.
    for (const provider of ["Microsoft.App", "Microsoft.ContainerRegistry", "Microsoft.ManagedIdentity"]) {
      console.log(`Registrando/verificando ${provider}…`);
      await az(["provider", "register", "--namespace", provider, "--wait"]);
    }
    const exists = await az(["group", "exists", "--name", group], { json: true });
    if (exists) {
      const project = await az(["group", "show", "--name", group, "--query", "tags.project"], { json: true });
      if (project !== "cronista") throw new Error("El grupo existente no tiene tags.project=cronista. Usa un grupo dedicado nuevo con --resource-group.");
    } else await az(["group", "create", "--name", group, "--location", location, "--tags", "project=cronista", "purpose=hackathon-demo"]);
    const registryName = "crcronista" + createHash("sha256").update(`${subscription}/${group}`).digest("hex").slice(0, 12);
    const imageTag = "demo-" + new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    console.log("Creando registry privado e identidad AcrPull…");
    await az(["deployment", "group", "create", "--resource-group", group, "--name", "cronista-registry", "--template-file", join(root, "infra/registry.bicep"), "--parameters", `registryName=${registryName}`, `location=${location}`]);
    console.log("Compilando imagen en ACR (puede tardar varios minutos)…");
    await az(["acr", "build", "--registry", registryName, "--file", "Dockerfile", "--image", `cronista:${imageTag}`, source]);
    const params = {
      location, registryName, appName, imageTag,
      openAiEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
      openAiDeployment: process.env.AZURE_OPENAI_DEPLOYMENT,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-10-21",
      reasoningEffort: process.env.AZURE_OPENAI_REASONING_EFFORT,
      openAiApiKey: process.env.AZURE_OPENAI_API_KEY,
    };
    const parameterFile = join(temporary, "parameters.json");
    writeFileSync(parameterFile, JSON.stringify({
      $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
      contentVersion: "1.0.0.0",
      parameters: Object.fromEntries(Object.entries(params).map(([k, value]) => [k, { value }])),
    }), { mode: 0o600 });
    console.log("Publicando Container App con secreto de servidor y probes HTTP…");
    const outputs = await az(["deployment", "group", "create", "--resource-group", group, "--name", "cronista-app", "--template-file", join(root, "infra/app.bicep"), "--parameters", `@${parameterFile}`, "--query", "properties.outputs"], { json: true });
    const url = outputs.url.value;
    writeFileSync(join(cacheDir, "deployment.json"), JSON.stringify({ url, group, appName, registryName, imageTag, deployedUtc: new Date().toISOString() }, null, 2) + "\n");
    console.log(`Demo: ${url}`);
    console.log(`Verificar desde otra red: npm run smoke:public -- ${url}`);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
