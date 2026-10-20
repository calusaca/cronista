import { createHash } from "node:crypto";
import { z } from "zod";
import { analizarArena, transporteFoundry } from "../../../../../../arena/agente";
import { leerJsonAcotado } from "../../../../../../arena/peticiones";
import { ErrorSesion, gestorSesiones, respuestaErrorSesion } from "../../../../../../arena/sesiones";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const schema = z.strictObject({ tick: z.number().int().min(0).max(1800), pregunta: z.enum(["momento", "jugador", "ocasiones"]), jugador: z.string().max(40).nullable(), audiencia: z.enum(["fan", "analyst"]) });
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (process.env.ARENA_ANALISTA_LLM !== "1") throw new ErrorSesion("Analista no habilitado", 503);
    const p = schema.parse(await leerJsonAcotado(req)), { id } = await ctx.params, gestor = gestorSesiones();
    const registro = await gestor.vistaPublicada(id, p.tick);
    const clave = "analisis:" + createHash("sha256").update(JSON.stringify({ ...p, tick: registro.final.tick })).digest("hex");
    const resultado = await gestor.extra(id, "analisis", clave, async () => analizarArena(registro, { ...p, tick: registro.final.tick, sesion: id }, await transporteFoundry(), req.signal));
    return Response.json(resultado, { headers: { "cache-control": "no-store" } });
  } catch (error) { return respuestaErrorSesion(error); }
}
