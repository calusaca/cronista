import { z } from "zod";
import { leerJsonAcotado } from "../../../../arena/peticiones";
import { gestorSesiones, respuestaErrorSesion } from "../../../../arena/sesiones";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(req: Request): Promise<Response> {
  try {
    const sesion = await gestorSesiones().crear(await leerJsonAcotado(req));
    return Response.json(sesion, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    // Brief 044: los ajustes inválidos (p. ej. temperatura fuera de la banda del clima)
    // devuelven el mensaje en inglés del esquema, como el resto de errores 400 de la arena.
    if (error instanceof z.ZodError) return Response.json({ error: `Invalid match settings: ${error.issues.map(i => i.message).join("; ")}` }, { status: 400, headers: { "cache-control": "no-store" } });
    return respuestaErrorSesion(error);
  }
}
