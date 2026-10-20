import { gestorSesiones, respuestaErrorSesion } from "../../../../../../arena/sesiones";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try { return Response.json(await gestorSesiones().reproduccion((await ctx.params).id), { headers: { "cache-control": "private, max-age=86400" } }); }
  catch (error) { return respuestaErrorSesion(error); }
}
