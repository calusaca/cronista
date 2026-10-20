import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stageSource } from "./deploy-azure.mjs";

const grupo = "rg-cronista-demo";
function az(args) { return JSON.parse(execFileSync("az", [...args, "-o", "json", "--only-show-errors"], { encoding: "utf8", maxBuffer: 5_000_000 })); }
if (existsSync(".env")) process.loadEnvFile(".env");
process.loadEnvFile(".cache/azure-servicios.env");
const temporal = mkdtempSync(join(tmpdir(), "cronista-arena-"));
try {
  const source = join(temporal, "source");
  const files = stageSource(process.cwd(), source, [process.env.AZURE_OPENAI_API_KEY, process.env.FOUNDRY_API_KEY].filter(Boolean));
  mkdirSync(".cache/arena-publicacion", { recursive: true });
  writeFileSync(".cache/arena-publicacion/source-manifest.json", JSON.stringify({ checkedUtc: new Date().toISOString(), files }, null, 2) + "\n");
  if (process.argv.includes("--prepare")) {
    console.log(JSON.stringify({ phase: "prepared_locally_no_azure_mutation", files: files.length, manifest: ".cache/arena-publicacion/source-manifest.json" }));
  } else {
  if (az(["group", "show", "-n", grupo]).tags?.project !== "cronista") throw new Error("Grupo incorrecto");
  const registro = az(["acr", "list", "-g", grupo])[0];
  const tag = "arena-" + new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  console.log("Compilando la arena en ACR con contexto aislado…");
  az(["acr", "build", "-r", registro.name, "-f", "Dockerfile", "-t", `cronista:${tag}`, "--no-logs", source]);
  const servicios = JSON.parse((await import("node:fs")).readFileSync("docs/evidencia/azure-servicios.json", "utf8"));
  const valores = { registryName: registro.name, imageTag: tag, openAiEndpoint: process.env.AZURE_OPENAI_ENDPOINT, projectEndpoint: process.env.AZURE_AI_PROJECT_ENDPOINT,
    blobEndpoint: process.env.ARENA_BLOB_ENDPOINT, vaultUri: servicios.resources.vaultUri, speechEndpoint: process.env.AZURE_SPEECH_ENDPOINT, agentVersion: process.env.ARENA_AGENTE_VERSION, insightsConnectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING };
  const file = join(temporal, "params.json");
  writeFileSync(file, JSON.stringify({ "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#", contentVersion: "1.0.0.0", parameters: Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, { value: v }])) }), { mode: 0o600 });
  const d = az(["deployment", "group", "create", "-g", grupo, "-n", "cronista-arena-publicacion", "--template-file", "infra/arena-preview.bicep", "--parameters", `@${file}`]);
  const url = d.properties.outputs.url.value;
  writeFileSync("docs/evidencia/azure-arena-publicacion.json", JSON.stringify({ checkedUtc: new Date().toISOString(), phase: "deployed_pending_smoke", url, image: `${registro.loginServer}/cronista:${tag}`, sourceFiles: files, limits: { modelMatchesPerDay: 10, analystQuestionsPerDay: 20, speechCharactersPerDay: 120000 }, originalDemoUnchanged: true }, null, 2) + "\n");
  console.log(JSON.stringify({ url: `${url}/arena`, phase: "deployed_pending_smoke" }));
  }
} catch (error) { console.error(JSON.stringify({ error: "Publicación de arena no completada; revisar ACR y ARM", tipo: error instanceof Error ? error.name : "Error" })); process.exitCode = 1; }
finally { rmSync(temporal, { recursive: true, force: true }); }
