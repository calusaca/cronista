import { gestorSesiones, respuestaErrorSesion } from "../../../../../arena/sesiones";

export const dynamic = "force-dynamic";
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try { await gestorSesiones().detener((await ctx.params).id); return Response.json({ estado: "cancelando" }); }
  catch (error) { return respuestaErrorSesion(error); }
}
