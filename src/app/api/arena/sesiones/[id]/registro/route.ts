import { gestorSesiones, respuestaErrorSesion } from "../../../../../../arena/sesiones";

export const dynamic = "force-dynamic";
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try { return Response.json(await gestorSesiones().registro((await ctx.params).id), { headers: { "cache-control": "no-store" } }); }
  catch (error) { return respuestaErrorSesion(error); }
}
