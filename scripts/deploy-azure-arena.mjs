import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { secretosDeEntorno, stageSource } from "./deploy-azure.mjs";
import { endpointFoundryModelos, leerCatalogoPublicado } from "./arena-modelos.mjs";

const grupo = "rg-cronista-demo";
function az(args) { return JSON.parse(execFileSync("az", [...args, "-o", "json", "--only-show-errors"], { encoding: "utf8", maxBuffer: 5_000_000 })); }
const git = args => execFileSync("git", ["-c", `safe.directory=${process.cwd()}`, ...args], { encoding: "utf8" });
/** Brief 062 · Líneas de `git status --porcelain` que no son de `.cache/` (el commit desplegado tiene que ser el código). */
function cambiosSinCache(porcelana) {
  return porcelana.split("\n").filter(l => l.trim()).filter(l => { const ruta = l.slice(3).replace(/^"|"$/g, ""); return !ruta.startsWith(".cache/") && ruta !== ".cache"; });
}
/** Brief 062 § 6.5 + § 17.2 · Con un torneo del sitio activo, el despliegue lo deja «interrumpido» y consume el cupo:
 * se niega salvo con --forzar. Devuelve el id activo o null (un sitio que aún no tiene la ruta cuenta como sin torneo). */
async function torneoActivo(urlBase, fetchImpl = fetch) {
  const r = await fetchImpl(`${urlBase}/api/arena/torneos/sitio`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GET /api/arena/torneos/sitio respondió ${r.status}`);
  return (await r.json()).activo?.id ?? null;
}
if (existsSync(".env")) process.loadEnvFile(".env");
process.loadEnvFile(".cache/azure-servicios.env");
const temporal = mkdtempSync(join(tmpdir(), "cronista-arena-"));
try {
  const source = join(temporal, "source");
  // Brief 052 v1.1 §7: toda variable *_API_KEY / *_KEY (incluidas ARENA_<ID>_…) y la cadena de Insights.
  const files = stageSource(process.cwd(), source, secretosDeEntorno(process.env));
  // Brief 052 v1.1 §6: catálogo y nombres públicos derivados de infra/modelos-arena.json.
  const modelos = leerCatalogoPublicado("infra/modelos-arena.json");
  const foundryEndpoint = endpointFoundryModelos(process.env.FOUNDRY_BASE_URL);
  mkdirSync(".cache/arena-publicacion", { recursive: true });
  writeFileSync(".cache/arena-publicacion/source-manifest.json", JSON.stringify({ checkedUtc: new Date().toISOString(), files }, null, 2) + "\n");
  if (process.argv.includes("--prepare")) {
    console.log(JSON.stringify({ phase: "prepared_locally_no_azure_mutation", files: files.length, manifest: ".cache/arena-publicacion/source-manifest.json", catalogo: modelos.map(m => ({ id: m.id, nombre: m.nombre, llm: m.llm, deployment: m.deployment, ...(m.formatoJson ? { formatoJson: m.formatoJson } : {}), ...(m.esfuerzoRazonamiento ? { esfuerzoRazonamiento: m.esfuerzoRazonamiento } : {}) })) }));
  } else {
  if (az(["group", "show", "-n", grupo]).tags?.project !== "cronista") throw new Error("Grupo incorrecto");
  // Brief 062 · CRONISTA_COMMIT desde git rev-parse HEAD; se niega con el árbol sucio.
  const sucios = cambiosSinCache(git(["status", "--porcelain"]));
  if (sucios.length) { console.error(JSON.stringify({ error: "Árbol de git con cambios: el commit desplegado tiene que ser el código", cambios: sucios.slice(0, 20) })); process.exit(1); }
  const commit = git(["rev-parse", "HEAD"]).trim();
  // Brief 062 § 17.2 · Aviso con un torneo activo: antes de compilar y otra vez justo antes de ARM (revisión Codex #5),
  // porque durante la compilación en ACR se puede admitir uno. Límite declarado: entre la segunda consulta y el cambio
  // de revisión quedan unos segundos sin exclusión. Con el interruptor apagado (por defecto) no hay admisiones
  // públicas; la barrera de mantenimiento completa (bloquear admisiones durante el despliegue) queda pendiente para
  // cuando se encienda.
  const actual = az(["containerapp", "list", "-g", grupo]).find(a => a.name === "cronista-arena");
  const fqdn = actual?.properties?.configuration?.ingress?.fqdn;
  const comprobarTorneoActivo = async () => {
    if (!fqdn) return;
    const activo = await torneoActivo(`https://${fqdn}`);
    if (activo && !process.argv.includes("--forzar")) { console.error(`El torneo ${activo} quedará interrumpido; el cupo de hoy queda consumido. Vuelve a ejecutar con --forzar para desplegar igualmente.`); process.exit(1); }
    if (activo) console.error(`--forzar: el torneo ${activo} quedará interrumpido (el cupo de hoy queda consumido).`);
  };
  await comprobarTorneoActivo();
  // Brief 062 § 17.6 · El secreto de administración NO se crea aquí (decisión del coordinador): solo se comprueba.
  // Cómo crearlo: docs/evidencia/torneo-sitio-062/README.md. Sin él, los lanzamientos quedan deshabilitados.
  const vault = JSON.parse((await import("node:fs")).readFileSync("docs/evidencia/azure-servicios.json", "utf8")).resources.vaultUri.replace(/^https:\/\//, "").split(".")[0];
  let adminTokenEnKeyVault = false;
  try { az(["keyvault", "secret", "show", "--vault-name", vault, "--name", "cronista-arena-admin", "--query", "id"]); adminTokenEnKeyVault = true; } catch { adminTokenEnKeyVault = false; }
  const i = process.argv.indexOf("--torneo-sitio"), torneoSitio = i >= 0 && process.argv[i + 1] === "1" ? "1" : "0";
  if (torneoSitio === "1" && !adminTokenEnKeyVault) throw new Error("--torneo-sitio 1 exige el secreto cronista-arena-admin en Key Vault");
  const registro = az(["acr", "list", "-g", grupo])[0];
  const tag = "arena-" + new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  console.log("Compilando la arena en ACR con contexto aislado…");
  az(["acr", "build", "-r", registro.name, "-f", "Dockerfile", "-t", `cronista:${tag}`, "--no-logs", source]);
  const servicios = JSON.parse((await import("node:fs")).readFileSync("docs/evidencia/azure-servicios.json", "utf8"));
  const valores = { registryName: registro.name, imageTag: tag, openAiEndpoint: process.env.AZURE_OPENAI_ENDPOINT, projectEndpoint: process.env.AZURE_AI_PROJECT_ENDPOINT,
    blobEndpoint: process.env.ARENA_BLOB_ENDPOINT, vaultUri: servicios.resources.vaultUri, speechEndpoint: process.env.AZURE_SPEECH_ENDPOINT, agentVersion: process.env.ARENA_AGENTE_VERSION, insightsConnectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING, foundryEndpoint, modelos, commit, torneoSitio, adminTokenEnKeyVault };
  const file = join(temporal, "params.json");
  writeFileSync(file, JSON.stringify({ "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#", contentVersion: "1.0.0.0", parameters: Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, { value: v }])) }), { mode: 0o600 });
  await comprobarTorneoActivo();
  const d = az(["deployment", "group", "create", "-g", grupo, "-n", "cronista-arena-publicacion", "--template-file", "infra/arena-preview.bicep", "--parameters", `@${file}`]);
  const url = d.properties.outputs.url.value;
  writeFileSync("docs/evidencia/azure-arena-publicacion.json", JSON.stringify({ checkedUtc: new Date().toISOString(), phase: "deployed_pending_smoke", url, image: `${registro.loginServer}/cronista:${tag}`, sourceFiles: files, limits: { modelMatchesPerDay: 10, analystQuestionsPerDay: 20, speechCharactersPerDay: 120000 }, originalDemoUnchanged: true }, null, 2) + "\n");
  console.log(JSON.stringify({ url: `${url}/arena`, phase: "deployed_pending_smoke" }));
  }
} catch (error) { console.error(JSON.stringify({ error: "Publicación de arena no completada; revisar ACR y ARM", tipo: error instanceof Error ? error.name : "Error" })); process.exitCode = 1; }
finally { rmSync(temporal, { recursive: true, force: true }); }
