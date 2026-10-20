import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { AIProjectClient } from "@azure/ai-projects";
import { credencialAzure, endpointAzure } from "../lib/azure";
import { definicionAnalista } from "./agente";

async function main() {
  if (existsSync(".env")) process.loadEnvFile(".env");
  if (existsSync(".cache/azure-servicios.env")) process.loadEnvFile(".cache/azure-servicios.env");
  const endpoint = endpointAzure(process.env.AZURE_AI_PROJECT_ENDPOINT, ".services.ai.azure.com");
  const proyecto = new AIProjectClient(endpoint, credencialAzure());
  const agente = await proyecto.agents.createVersion("cronista-analista", definicionAnalista(process.env.ARENA_AGENTE_MODELO ?? "cronista-rapido"));
  appendFileSync(".cache/azure-servicios.env", `ARENA_AGENTE_NOMBRE=${agente.name}\nARENA_AGENTE_VERSION=${agente.version}\n`, { mode: 0o600 });
  writeFileSync("docs/evidencia/azure-agente.json", JSON.stringify({ checkedUtc: new Date().toISOString(), name: agente.name, version: agente.version, id: agente.id, model: process.env.ARENA_AGENTE_MODELO ?? "cronista-rapido", tools: definicionAnalista("").tools.map(t => t.name), inferenceCalls: 0 }, null, 2) + "\n");
  console.log(JSON.stringify({ agent: agente.name, version: agente.version, inferenceCalls: 0 }));
}
main().catch((error: unknown) => { console.error(JSON.stringify({ error: "No se pudo registrar el agente", tipo: error instanceof Error ? error.name : "Error" })); process.exitCode = 1; });
