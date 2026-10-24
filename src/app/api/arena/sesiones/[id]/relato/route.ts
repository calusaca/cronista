import { z } from "zod";
import { leerJsonAcotado } from "../../../../../../arena/peticiones";
import { construirRelato, relatoIntervencion } from "../../../../../../arena/relato";
import { esPrevia, previaPartido } from "../../../../../../arena/previa";
import { antesalaPartido, esAntesala } from "../../../../../../arena/antesala";
import type { IntervencionArena } from "../../../../../../arena/protocolo";
import { ErrorSesion, gestorSesiones, respuestaErrorSesion } from "../../../../../../arena/sesiones";
import { asignarVoces, catalogoVoces, claveAudio, prepararVoz, sintetizarVoz, vocesDe } from "../../../../../../arena/voz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (process.env.ARENA_VOZ !== "1") throw new ErrorSesion("Voz no habilitada", 503);
    const cuerpo = await leerJsonAcotado(req);
    // Brief 045 v3.1 (C2): con `intervencion` la memoria del espectador se ignora, así que tampoco
    // puede invalidar la petición; la rama del narrador conserva su validación estricta.
    const conIntervencion = typeof cuerpo === "object" && cuerpo !== null && "intervencion" in cuerpo;
    const memoria = conIntervencion ? z.unknown().transform(() => undefined)
      : z.array(z.strictObject({ tick: z.number().int().nonnegative().max(1800), texto: z.string().max(500), clave: z.string().max(120).optional(), tema: z.string().max(80).optional(), estado: z.enum(["iniciada", "completa", "interrumpida"]).optional(), rol: z.enum(["narrador", "comentarista", "estadista"]).optional() })).max(12).optional();
    const p = z.strictObject({ desdeTick: z.number().int().nonnegative().max(1800), hastaTick: z.number().int().nonnegative().max(1800), idioma: z.enum(["es", "en"]), modo: z.enum(["vivo", "completo", "buffer"]), cierre: z.boolean().optional(), entradaTick: z.number().int().nonnegative().max(1800).optional(),
      // Brief 045: identificador del diario; la intervención se lee, nunca se regenera.
      intervencion: z.string().min(1).max(120).optional(),
      // Brief 048: variante del intercambio (solo con `intervencion`); por defecto, la completa.
      variante: z.enum(["completa", "breve"]).optional(),
      memoria: memoria.optional() }).parse(cuerpo);
    const { id } = await ctx.params, gestor = gestorSesiones();
    if (p.variante !== undefined && p.intervencion === undefined) throw new ErrorSesion("La variante solo se admite con una intervención", 400);
    if (p.intervencion !== undefined) {
      // Brief 056 § 5.3 · La previa no está en el diario: se re-deriva del prefijo publicado en el tick 0
      // (config + inicial); un id previa:* desconocido es 404 como cualquier intervención no publicada.
      const previa = esPrevia({ id: p.intervencion }), antesala = esAntesala({ id: p.intervencion });
      let intervencion: IntervencionArena;
      if (antesala) {
        // Brief 058 § 4.7 / v1.3 · La antesala tampoco está en el diario: se re-deriva del prefijo publicado en el
        // tick 0 y de la asignación de la PROPIA sesión, con los hechos del idioma pedido. Sin reintento de 409 aquí
        // (ese helper es del cliente); un id desconocido es 404.
        const vista = await gestor.vistaPublicada(id, 0), asignacion = await gestor.asignacionPublicada(id);
        let piezas: IntervencionArena[] = [];
        try { piezas = antesalaPartido(vista, asignacion, p.idioma); } catch { /* Alineación inconsistente: no hay antesala. */ }
        const encontrada = piezas.find(i => i.id === p.intervencion);
        if (!encontrada) throw new ErrorSesion("Intervención no publicada", 404);
        intervencion = encontrada;
      } else if (previa) {
        const vista = await gestor.vistaPublicada(id, 0);
        let piezas: IntervencionArena[] = [];
        try { piezas = previaPartido(vista); } catch { /* Alineación inconsistente: no hay previa que servir. */ }
        const encontrada = piezas.find(i => i.id === p.intervencion);
        if (!encontrada) throw new ErrorSesion("Intervención no publicada", 404);
        intervencion = encontrada;
      } else intervencion = await gestor.intervencionPublicada(id, p.intervencion);
      if (p.modo !== "buffer" || p.cierre || p.entradaTick !== undefined || p.desdeTick !== intervencion.tick || p.hastaTick !== intervencion.tick) throw new ErrorSesion("Ventana de intervención inválida", 400);
      const registro = await gestor.vistaPublicada(id, intervencion.tick);
      // v3.1: la memoria del espectador no influye en la intervención; si llega, se ignora.
      // 048 v1.1 (6): los turnos se sirven tal cual están materializados en el diario; nunca se recomponen.
      const relato = relatoIntervencion(intervencion, registro.config.partido.seed, p.idioma, p.variante ?? "completa");
      // Voz efectiva por rol, con la degradación del catálogo que publica /herramientas.
      const preparada = prepararVoz(relato.fragmentos, p.idioma, vocesDe(asignarVoces(p.idioma, await catalogoVoces())));
      // 048 v1.2 (2): la síntesis de un invitado respeta la cuota de invitados y la reserva del cierre (si no, 429).
      // Brief 056 § 5.4: la previa cobra solo de su bolsa propia (clase "previa").
      const audio = await gestor.extra(id, "audio", claveAudio(preparada, intervencion.tick), () => sintetizarVoz(preparada, intervencion.tick), preparada.caracteresPresupuestados, antesala ? "antesala" : previa ? "previa" : "invitado");
      return Response.json({ ...relato, audio }, { headers: { "cache-control": "private, max-age=86400" } });
    }
    // Brief 056 v1.1 § 1 · La rama del narrador exige una ventana no vacía (antes la rechazaba construirRelato).
    if (!(p.hastaTick > p.desdeTick)) throw new ErrorSesion("Ventana de relato vacía", 400);
    const registro = await gestor.vistaPublicada(id, p.hastaTick);
    const relato = construirRelato(registro, p.desdeTick, p.hastaTick, p.modo, p.idioma, { cierre: p.cierre, entradaTick: p.entradaTick, memoria: p.memoria });
    if (!relato.texto) return Response.json({ ...relato, audio: null }, { headers: { "cache-control": "no-store" } });
    const preparada = prepararVoz(relato.fragmentos, p.idioma);
    // Una síntesis compartida ya reservada termina y queda en caché aunque
    // se desconecte un espectador. El proveedor mantiene su timeout de 15 s.
    // 048 v1.2 (2): solo el cierre puede usar la reserva propia del cierre.
    const audio = await gestor.extra(id, "audio", claveAudio(preparada, p.hastaTick), () => sintetizarVoz(preparada, p.hastaTick), preparada.caracteresPresupuestados, p.cierre ? "cierre" : "narrador");
    return Response.json({ ...relato, audio }, { headers: { "cache-control": "private, max-age=86400" } });
  } catch (error) { return respuestaErrorSesion(error); }
}
