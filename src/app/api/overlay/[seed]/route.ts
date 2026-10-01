// Brief 008 — export de overlay para broadcast: GET /api/overlay/[seed][?perspectiva=local|visita]
// JSON minutado de las actualizaciones verificadas del replay (esquema zod en src/vivo/overlay.ts).
// Todo corre en el server; la API key jamás sale de aquí.
import { validarSeedTexto } from "../../../../sim/cli-args";
import { cargarOverlay, leerPerspectiva } from "../../../../vista/servidor";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ seed: string }> }): Promise<Response> {
  const { seed: crudo } = await params;
  const v = validarSeedTexto(crudo);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400 });
  const perspectiva = leerPerspectiva(new URL(req.url).searchParams.get("perspectiva"));
  try {
    return Response.json(await cargarOverlay(v.seed, perspectiva));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
