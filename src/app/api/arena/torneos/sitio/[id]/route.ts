// Brief 062 § 6.8 · Instantánea `torneo.json` de un torneo del sitio: esquema y coherencia (si fallan, 409 sin
// cifras); `no-store` con `en_curso` y `max-age=300` en los demás estados; 404 si el id es inválido o no existe.
import { gestorTorneoSitio, respuestaErrorSitio } from "../../../../../../arena/torneo-sitio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const l = await gestorTorneoSitio().leer((await ctx.params).id);
    if (!l) return Response.json({ error: "Torneo inexistente" }, { status: 404, headers: { "cache-control": "no-store" } });
    if (l.estado === "incoherente") return Response.json({ error: "El torneo guardado no supera la validación" }, { status: 409, headers: { "cache-control": "no-store" } });
    return Response.json(l.torneo, { headers: { "cache-control": l.torneo.estado === "en_curso" ? "no-store" : "public, max-age=300" } });
  } catch (error) { return respuestaErrorSitio(error); }
}
