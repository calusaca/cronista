// Brief 064 § 4.8 · GET /api/arena/cronicas/<huella>/registro: el registro guardado (JSON), contenido direccionado por
// su huella → `public, max-age=31536000, immutable`. Solo lee. Huella inválida o sin registro → 404.
import { almacenCronicasDesdeEnv, HUELLA, leerRegistroGuardado } from "../../../../../../arena/cronica-almacen";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ huella: string }> }): Promise<Response> {
  const { huella } = await ctx.params;
  const noStore = { "cache-control": "no-store" };
  if (!HUELLA.test(huella)) return Response.json({ error: "Registro inexistente" }, { status: 404, headers: noStore });
  try {
    const registro = await leerRegistroGuardado(await almacenCronicasDesdeEnv(), huella);
    if (!registro) return Response.json({ error: "Registro inexistente" }, { status: 404, headers: noStore });
    return Response.json(registro, { headers: { "cache-control": "public, max-age=31536000, immutable" } });
  } catch {
    return Response.json({ error: "Almacén no disponible" }, { status: 503, headers: noStore });
  }
}
