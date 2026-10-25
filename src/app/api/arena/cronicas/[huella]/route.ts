// Brief 064 § 4.8 · GET /api/arena/cronicas/<huella>: `{ huella, origen, estado, cronica? }`, `no-store`. Solo lee
// (I7): ni modelo ni escrituras. La crónica solo viaja con `estado: "lista"` (I9). Huella fuera de ^[a-f0-9]{40}$ → 404.
import { leerCronicaArena } from "../../../../../arena/cronica";
import { HUELLA } from "../../../../../arena/cronica-almacen";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const sinCache = { "cache-control": "no-store" };
export async function GET(_req: Request, ctx: { params: Promise<{ huella: string }> }): Promise<Response> {
  const { huella } = await ctx.params;
  if (!HUELLA.test(huella)) return Response.json({ error: "Crónica inexistente" }, { status: 404, headers: sinCache });
  try {
    const l = await leerCronicaArena(huella);
    if (!l) return Response.json({ error: "Crónica inexistente" }, { status: 404, headers: sinCache });
    return Response.json({ huella, origen: l.origen, estado: l.estado, ...(l.archivo ? { cronica: l.archivo } : {}) }, { headers: sinCache });
  } catch {
    return Response.json({ error: "Almacén no disponible" }, { status: 503, headers: sinCache });
  }
}
