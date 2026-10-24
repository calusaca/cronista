// Brief 062 § 6.8 · Registro `eNN.json.gz` de un partido del sitio. `archivo` debe cumplir `^e\d{2}\.json\.gz$` Y
// estar en `encuentros` (el nombre leído del almacén sale del manifiesto, nunca de la URL); se comprueba la huella.
import { gestorTorneoSitio, respuestaErrorSitio } from "../../../../../../../arena/torneo-sitio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; archivo: string }> }): Promise<Response> {
  try {
    const { id, archivo } = await ctx.params;
    const bytes = await gestorTorneoSitio().leerArchivo(id, archivo);
    if (!bytes) return Response.json({ error: "Registro inexistente" }, { status: 404, headers: { "cache-control": "no-store" } });
    return new Response(Buffer.from(bytes), { headers: { "content-type": "application/gzip", "cache-control": "public, max-age=86400, immutable" } });
  } catch (error) { return respuestaErrorSitio(error); }
}
