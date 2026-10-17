// Probes del hosting: comprueban el proceso HTTP, sin simulación ni llamadas al LLM.
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json({ status: "ok", service: "cronista" }, { headers: { "cache-control": "no-store" } });
}
