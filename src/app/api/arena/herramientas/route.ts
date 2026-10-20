export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ analista: process.env.ARENA_ANALISTA_LLM === "1" && !!process.env.AZURE_AI_PROJECT_ENDPOINT && !!process.env.ARENA_AGENTE_VERSION,
    voz: process.env.ARENA_VOZ === "1" && !!process.env.AZURE_SPEECH_ENDPOINT }, { headers: { "cache-control": "no-store" } });
}
