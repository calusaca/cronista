import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Integraciones auxiliares; no cambia imagen, tráfico ni variables de la app pública.
const grupo = "rg-cronista-demo", grupoFoundry = "rg-carlos.sandi-6716", cuenta = "carlossandi-9096-resource";
function az(args) { return JSON.parse(execFileSync("az", [...args, "-o", "json", "--only-show-errors"], { encoding: "utf8", maxBuffer: 5_000_000 })); }
if (existsSync(".env")) process.loadEnvFile(".env");
const temporal = mkdtempSync(join(tmpdir(), "cronista-servicios-"));
try {
  const grupoActual = az(["group", "show", "-n", grupo]);
  if (grupoActual.tags?.project !== "cronista") throw new Error("Grupo no identificado como CRONISTA");
  const identidades = az(["identity", "list", "-g", grupo]);
  const identidad = identidades.find(i => i.name.endsWith("-pull"));
  if (!identidad) throw new Error("Falta identidad de la aplicación");
  const usuario = az(["ad", "signed-in-user", "show", "--query", "id"]);
  console.log("Aprovisionando Blob Storage, Application Insights, Log Analytics y Key Vault…");
  const despliegue = az(["deployment", "group", "create", "-g", grupo, "-n", "cronista-servicios-arena", "--template-file", "infra/servicios-arena.bicep", "--parameters", `appPrincipalId=${identidad.principalId}`, `developerPrincipalId=${usuario}`]);
  const outputs = despliegue.properties.outputs, get = n => outputs[n].value;
  const insights = az(["resource", "show", "--ids", get("insightsId"), "--api-version", "2020-02-02"]);
  const parametros = { "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#", contentVersion: "1.0.0.0", parameters: { accountName: { value: cuenta }, insightsId: { value: get("insightsId") }, connectionString: { value: insights.properties.ConnectionString } } };
  const archivo = join(temporal, "parametros.json"); writeFileSync(archivo, JSON.stringify(parametros), { mode: 0o600 });
  az(["deployment", "group", "create", "-g", grupoFoundry, "-n", "cronista-conexion-trazas", "--template-file", "infra/conectar-trazas-foundry.bicep", "--parameters", `@${archivo}`]);
  // El secreto preexistente se copia mediante archivo privado, nunca como argumento.
  if (process.env.AZURE_OPENAI_API_KEY) {
    const secreto = join(temporal, "clave"); writeFileSync(secreto, process.env.AZURE_OPENAI_API_KEY, { mode: 0o600 });
    az(["keyvault", "secret", "set", "--vault-name", get("vaultName"), "--name", "cronista-inferencia", "--file", secreto]);
  }
  // Foundry User por ID estable tras el cambio de nombre de Azure AI User.
  // Responses con agent_reference también requiere AIServices/agents/read;
  // Runtime User (responses/*) no basta para este agente versionado.
  const rolFoundry = "53ca6127-db72-4b80-b1b0-d745d6d5456d";
  const recursoFoundry = az(["cognitiveservices", "account", "show", "-g", grupoFoundry, "-n", cuenta]);
  az(["role", "assignment", "create", "--assignee-object-id", identidad.principalId, "--assignee-principal-type", "ServicePrincipal", "--role", rolFoundry, "--scope", `${recursoFoundry.id}/projects/carlossandi-9096`]);
  mkdirSync(".cache", { recursive: true });
  const entorno = { ARENA_BLOB_ENDPOINT: get("blobEndpoint"), ARENA_BLOB_CONTENEDOR: "arena", CRONISTA_TELEMETRIA: "1", APPLICATIONINSIGHTS_CONNECTION_STRING: insights.properties.ConnectionString,
    OTEL_SERVICE_NAME: "cronista", AZURE_AI_PROJECT_ENDPOINT: `https://${cuenta}.services.ai.azure.com/api/projects/carlossandi-9096`, AZURE_SPEECH_ENDPOINT: recursoFoundry.properties.endpoint,
    AZURE_SPEECH_RESOURCE_ID: recursoFoundry.id, ARENA_ANALISTA_LLM: "1", ARENA_VOZ: "1" };
  writeFileSync(".cache/azure-servicios.env", Object.entries(entorno).map(([k, v]) => `${k}=${v}`).join("\n") + "\n", { mode: 0o600 });
  const evidencia = { checkedUtc: new Date().toISOString(), phase: "auxiliary_services_provisioned_application_unchanged", resourceGroup: grupo, resources: Object.fromEntries(Object.keys(outputs).map(k => [k, get(k)])), identityClientId: identidad.clientId, identityPrincipalId: identidad.principalId, foundryConnection: "cronista-appinsights", secret: "cronista-inferencia", modelCalls: 0 };
  writeFileSync("docs/evidencia/azure-servicios.json", JSON.stringify(evidencia, null, 2) + "\n");
  console.log("Servicios preparados. Configuración privada: .cache/azure-servicios.env. Evidencia sin claves guardada.");
} finally { rmSync(temporal, { recursive: true, force: true }); }
