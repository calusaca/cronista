// Brief 016 — overlay del replay de un partido de liga: el mismo JSON (esquema zod del 008)
// que /api/overlay/[seed], con la config que fabrica la temporada.
import { cargarOverlayLiga, leerRefPartido } from "../../../../../../vista/liga";
import { leerPerspectiva } from "../../../../../../vista/servidor";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ jornada: string; partido: string }> }): Promise<Response> {
  const { jornada, partido } = await params;
  const ref = leerRefPartido(jornada, partido);
  if (!ref) return Response.json({ error: `league match not found: matchday ${jornada}, match ${partido}` }, { status: 404 });
  const perspectiva = leerPerspectiva(new URL(req.url).searchParams.get("perspectiva"));
  try {
    return Response.json(await cargarOverlayLiga(ref, perspectiva));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
