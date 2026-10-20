import { gestorSesiones, respuestaErrorSesion } from "../../../../../../arena/sesiones";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try { return Response.json(await gestorSesiones().emision((await ctx.params).id), { headers: { "cache-control": "no-store" } }); }
  catch (error) { return respuestaErrorSesion(error); }
}
