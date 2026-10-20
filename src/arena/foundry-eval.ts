/** Evaluación de respuestas ya registradas mediante el SDK oficial de Foundry. */
import { AIProjectClient } from "@azure/ai-projects";
import { AzureCliCredential } from "@azure/identity";

export interface FilaEvaluacion { query: string; response: string; context: string; ground_truth: string; [key: string]: unknown }
export async function iniciarEvaluacionFoundry(filas: FilaEvaluacion[], opciones: { endpoint: string; modeloJuez: string; nombre: string }) {
  if (!filas.length || filas.length > 100) throw new Error("Foundry: entre 1 y 100 filas por corrida");
  const url = new URL(opciones.endpoint);
  if (url.protocol !== "https:") throw new Error("Foundry necesita HTTPS");
  const proyecto = new AIProjectClient(opciones.endpoint, new AzureCliCredential());
  const cliente = proyecto.getOpenAIClient({ maxRetries: 0, timeout: 60_000 });
  const esquema = { type: "custom", item_schema: { type: "object", properties: { query: { type: "string" }, response: { type: "string" }, context: { type: "string" }, ground_truth: { type: "string" } }, required: ["query", "response", "context", "ground_truth"] } };
  const criterios = ["groundedness", "relevance"].map(nombre => ({ type: "azure_ai_evaluator", name: nombre, evaluator_name: `builtin.${nombre}`, initialization_parameters: { deployment_name: opciones.modeloJuez }, data_mapping: { query: "{{item.query}}", response: "{{item.response}}", ...(nombre === "groundedness" ? { context: "{{item.context}}" } : {}) } }));
  // Azure amplía testing_criteria; post conserva ese contrato sin forzar los tipos del SDK base.
  const evaluacion = await cliente.post<{ id: string }>("/evals", { body: { name: opciones.nombre, data_source_config: esquema, testing_criteria: criterios } });
  const corrida = await cliente.evals.runs.create(evaluacion.id, { name: opciones.nombre, data_source: { type: "jsonl", source: { type: "file_content", content: filas.map(item => ({ item })) } } });
  return { evalId: evaluacion.id, runId: corrida.id, status: corrida.status, reportUrl: corrida.report_url };
}

export async function consultarEvaluacionFoundry(endpoint: string, evalId: string, runId: string) {
  const cliente = new AIProjectClient(endpoint, new AzureCliCredential()).getOpenAIClient({ maxRetries: 0, timeout: 60_000 });
  const corrida = await cliente.evals.runs.retrieve(runId, { eval_id: evalId });
  const resultados = [];
  if (["completed", "failed", "canceled"].includes(corrida.status)) for await (const item of cliente.evals.runs.outputItems.list(runId, { eval_id: evalId })) resultados.push(item);
  return { corrida, resultados };
}
