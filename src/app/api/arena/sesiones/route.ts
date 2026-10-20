import { leerJsonAcotado } from "../../../../arena/peticiones";
import { gestorSesiones, respuestaErrorSesion } from "../../../../arena/sesiones";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(req: Request): Promise<Response> {
  try {
    const sesion = await gestorSesiones().crear(await leerJsonAcotado(req));
    return Response.json(sesion, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) { return respuestaErrorSesion(error); }
}
