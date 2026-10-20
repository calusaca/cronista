import { z } from "zod";
import { leerJsonAcotado } from "../../../../../../arena/peticiones";
import { ErrorSesion, gestorSesiones, respuestaErrorSesion } from "../../../../../../arena/sesiones";
import { claveAudio, ssmlComentario, sintetizarVoz } from "../../../../../../arena/voz";
import { verificarUpdate } from "../../../../../../cadena/verificador";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (process.env.ARENA_VOZ !== "1") throw new ErrorSesion("Voz no habilitada", 503);
    const p = z.strictObject({ tick: z.number().int().nonnegative().max(1800), principal: z.string().max(50), idioma: z.enum(["es", "en"]) }).parse(await leerJsonAcotado(req));
    const { id } = await ctx.params, gestor = gestorSesiones(), registro = await gestor.vistaPublicada(id, p.tick);
    const comentario = await gestor.comentarioPublicado(id, p.tick, p.principal);
    if (comentario.hechos.some(h => h.eventos.some(e => !registro.eventos.some(x => x.id === e))) || verificarUpdate(JSON.stringify({ oraciones: comentario.oraciones }), comentario.hechos, { config: registro.config.partido }, comentario.principal, 2).motivos.length) throw new ErrorSesion("Comentario sin evidencia válida", 409);
    const preparada = ssmlComentario(comentario, p.idioma, registro);
    const audio = await gestor.extra(id, "audio", claveAudio(preparada, comentario.tick), () => sintetizarVoz(preparada, comentario.tick), preparada.caracteresPresupuestados);
    return new Response(Buffer.from(audio.base64, "base64"), { headers: { "content-type": audio.tipo, "cache-control": "private, max-age=86400", "x-arena-tick": String(audio.tick) } });
  } catch (error) { return respuestaErrorSesion(error); }
}
