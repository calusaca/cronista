// Brief 062 § 18.2 · Un intento más del cierre de arranque, con el token de administración (también después de
// agotar `cierrePlazoMs`). Responde cuántos torneos quedan pendientes de cierre.
import { gestorTorneoSitio, respuestaErrorSitio } from "../../../../../../arena/torneo-sitio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  try {
    const g = gestorTorneoSitio();
    g.verificarAdmin(req.headers.get("authorization"));
    return Response.json(await g.cerrar(), { headers: { "cache-control": "no-store" } });
  } catch (error) { return respuestaErrorSitio(error); }
}
