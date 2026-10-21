import { asignarVoces, catalogoVoces } from "../../../../arena/voz";

export const dynamic = "force-dynamic";
export async function GET() {
  const voz = process.env.ARENA_VOZ === "1" && !!process.env.AZURE_SPEECH_ENDPOINT;
  let voces: { es: ReturnType<typeof asignarVoces>; en: ReturnType<typeof asignarVoces> } | null = null, catalogo: "consultado" | "no disponible" | undefined;
  if (voz) {
    // Brief 045: asignación efectiva por rol y su motivo (degradación según el catálogo real).
    const lista = await catalogoVoces();
    catalogo = lista ? "consultado" : "no disponible";
    try { voces = { es: asignarVoces("es", lista), en: asignarVoces("en", lista) }; } catch { voces = null; }
  }
  return Response.json({ analista: process.env.ARENA_ANALISTA_LLM === "1" && !!process.env.AZURE_AI_PROJECT_ENDPOINT && !!process.env.ARENA_AGENTE_VERSION,
    voz, ...(voz ? { voces, catalogo } : {}) }, { headers: { "cache-control": "no-store" } });
}
