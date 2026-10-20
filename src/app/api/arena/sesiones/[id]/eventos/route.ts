import { ErrorSesion, gestorSesiones, respuestaErrorSesion } from "../../../../../../arena/sesiones";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const cursor = req.headers.get("last-event-id") ?? new URL(req.url).searchParams.get("desde") ?? "0";
    if (!/^\d+$/.test(cursor)) return Response.json({ error: "Cursor inválido" }, { status: 400 });
    return await gestorSesiones().escuchar((await ctx.params).id, Number(cursor), req.signal);
  } catch (error) {
    if (error instanceof ErrorSesion && error.status === 503) return new Response("retry: 3000\n: Waiting for coordinator\n\n", { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
    return respuestaErrorSesion(error);
  }
}
