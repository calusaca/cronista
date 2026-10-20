import { z } from "zod";
import { leerJsonAcotado } from "../../../../../../arena/peticiones";
import { construirRelato } from "../../../../../../arena/relato";
import { ErrorSesion, gestorSesiones, respuestaErrorSesion } from "../../../../../../arena/sesiones";
import { claveAudio, prepararVoz, sintetizarVoz } from "../../../../../../arena/voz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (process.env.ARENA_VOZ !== "1") throw new ErrorSesion("Voz no habilitada", 503);
    const p = z.strictObject({ desdeTick: z.number().int().nonnegative().max(1800), hastaTick: z.number().int().positive().max(1800), idioma: z.enum(["es", "en"]), modo: z.enum(["vivo", "completo", "buffer"]), cierre: z.boolean().optional(), entradaTick: z.number().int().nonnegative().max(1800).optional(), memoria: z.array(z.strictObject({ tick: z.number().int().nonnegative().max(1800), texto: z.string().max(500), clave: z.string().max(120).optional(), tema: z.string().max(80).optional(), estado: z.enum(["iniciada", "completa", "interrumpida"]).optional() })).max(12).optional() }).parse(await leerJsonAcotado(req));
    const { id } = await ctx.params, gestor = gestorSesiones(), registro = await gestor.vistaPublicada(id, p.hastaTick);
    const relato = construirRelato(registro, p.desdeTick, p.hastaTick, p.modo, p.idioma, { cierre: p.cierre, entradaTick: p.entradaTick, memoria: p.memoria });
    if (!relato.texto) return Response.json({ ...relato, audio: null }, { headers: { "cache-control": "no-store" } });
    const preparada = prepararVoz(relato.fragmentos, p.idioma);
    // Una síntesis compartida ya reservada termina y queda en caché aunque
    // se desconecte un espectador. El proveedor mantiene su timeout de 15 s.
    const audio = await gestor.extra(id, "audio", claveAudio(preparada, p.hastaTick), () => sintetizarVoz(preparada, p.hastaTick), preparada.caracteresPresupuestados);
    return Response.json({ ...relato, audio }, { headers: { "cache-control": "private, max-age=86400" } });
  } catch (error) { return respuestaErrorSesion(error); }
}
