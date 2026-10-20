import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stageSource } from "./deploy-azure.mjs";

const grupo = "rg-cronista-demo";
function az(args) { return JSON.parse(execFileSync("az", [...args, "-o", "json", "--only-show-errors"], { encoding: "utf8", maxBuffer: 5_000_000 })); }
if (existsSync(".env")) process.loadEnvFile(".env");
process.loadEnvFile(".cache/azure-servicios.env");
const temporal = mkdtempSync(join(tmpdir(), "cronista-jobs-"));
try {
  if (az(["group", "show", "-n", grupo]).tags?.project !== "cronista") throw new Error("Grupo no identificado como CRONISTA");
  const registro = az(["acr", "list", "-g", grupo])[0]; if (!registro) throw new Error("Falta registry");
  const source = join(temporal, "source");
  stageSource(process.cwd(), source, [process.env.AZURE_OPENAI_API_KEY, process.env.FOUNDRY_API_KEY].filter(Boolean));
  cpSync("Dockerfile.lotes", join(source, "Dockerfile.lotes"));
  const tag = "lote-" + new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  console.log("Compilando trabajador de evaluaciones en ACR con contexto aislado…");
  az(["acr", "build", "-r", registro.name, "-f", "Dockerfile.lotes", "-t", `cronista-lotes:${tag}`, "--no-logs", source]);
  const parameters = { "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#", contentVersion: "1.0.0.0", parameters: {
    registryName: { value: registro.name }, imageTag: { value: tag }, blobEndpoint: { value: process.env.ARENA_BLOB_ENDPOINT }, insightsConnectionString: { value: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING },
  } };
  const file = join(temporal, "parameters.json"); writeFileSync(file, JSON.stringify(parameters), { mode: 0o600 });
  const deployment = az(["deployment", "group", "create", "-g", grupo, "-n", "cronista-evaluaciones-job", "--template-file", "infra/evaluaciones-job.bicep", "--parameters", `@${file}`]);
  const jobName = deployment.properties.outputs.jobName.value;
  const execution = az(["containerapp", "job", "start", "-g", grupo, "-n", jobName]);
  writeFileSync("docs/evidencia/azure-lotes.json", JSON.stringify({ checkedUtc: new Date().toISOString(), phase: "manual_job_started_offline_validation", jobName, execution: execution.name, image: `${registro.loginServer}/cronista-lotes:${tag}`, modelCalls: 0, retryLimit: 0, sourceIsolation: "explicit_allowlist_without_env_or_cache", resultPrefix: "lotes/validacion-cloud-v1/" }, null, 2) + "\n");
  console.log(JSON.stringify({ job: jobName, execution: execution.name, modelCalls: 0 }));
} catch (error) { console.error(JSON.stringify({ error: "Job no completado; revisar el estado y conservar resultados", tipo: error instanceof Error ? error.name : "Error" })); process.exitCode = 1; }
finally { rmSync(temporal, { recursive: true, force: true }); }
