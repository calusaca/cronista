import { catalogoModelos } from "../../../../arena/modelos";

export const dynamic = "force-dynamic";
export async function GET(): Promise<Response> {
  try { return Response.json({ modelos: catalogoModelos().map(m => m.publico), estado: "ok" }, { headers: { "cache-control": "no-store" } }); }
  catch { return Response.json({ modelos: [], estado: "configuracion_incompleta" }, { headers: { "cache-control": "no-store" } }); }
}
