import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { ejecutarLote } from "./lote";
import { cerrarTelemetria, iniciarTelemetria } from "../lib/telemetria";

async function main() {
  if (existsSync(".env")) process.loadEnvFile(".env");
  const { values } = parseArgs({ options: { id: { type: "string" }, semillas: { type: "string" }, segundos: { type: "string" }, ventanas: { type: "string" }, narrar: { type: "boolean" }, "max-solicitudes": { type: "string" } } });
  await iniciarTelemetria();
  const resultado = await ejecutarLote({ id: values.id ?? process.env.ARENA_LOTE_ID ?? "validacion-v1", semillas: (values.semillas ?? process.env.ARENA_LOTE_SEMILLAS ?? "42,43").split(",").map(Number), segundos: Number(values.segundos ?? process.env.ARENA_LOTE_SEGUNDOS ?? 30), ventanas: Number(values.ventanas ?? process.env.ARENA_LOTE_VENTANAS ?? 2), narrar: values.narrar ?? process.env.ARENA_LOTE_NARRAR === "1", maxSolicitudes: Number(values["max-solicitudes"] ?? process.env.ARENA_LOTE_MAX_SOLICITUDES ?? 0) });
  console.log(JSON.stringify(resultado));
}
main().catch((error: unknown) => { console.error(JSON.stringify({ error: "Lote no completado; los resultados y reservas se conservan", tipo: error instanceof Error ? error.name : "Error" })); process.exitCode = 1; }).finally(cerrarTelemetria);
