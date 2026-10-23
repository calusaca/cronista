import { z } from "zod";
import { ARENA, CESPEDES, CLIMAS_PARTIDO, NIVELES_PRESION, SUPERFICIES, TEMPERATURA_C } from "../sim/limites";
import { formaciones } from "./tipos";

/** Brief 044: la temperatura solo se admite con calor o frío y dentro de su banda. */
export const entornoArena = z.strictObject({ clima: z.enum(CLIMAS_PARTIDO).optional(), temperaturaC: z.number().int().optional(), superficie: z.enum(SUPERFICIES).optional(), cesped: z.enum(CESPEDES).optional(), presion: z.strictObject({ local: z.enum(NIVELES_PRESION), visita: z.enum(NIVELES_PRESION) }).optional() })
  .superRefine((e, ctx) => {
    if (e.temperaturaC === undefined) return;
    if (e.clima !== "calor" && e.clima !== "frio") { ctx.addIssue({ code: "custom", path: ["temperaturaC"], message: "Temperature is only allowed with hot or cold weather" }); return; }
    const banda = TEMPERATURA_C[e.clima];
    if (e.temperaturaC < banda.min || e.temperaturaC > banda.max) ctx.addIssue({ code: "custom", path: ["temperaturaC"], message: `Temperature for ${e.clima === "calor" ? "hot" : "cold"} weather must be ${banda.min}..${banda.max} °C` });
  });
export const ajustesArena = z.strictObject({
  seed: z.number().int().min(0).max(4294967295), segundos: z.number().int().min(1).max(ARENA.duracionMaxS),
  local: z.enum([...formaciones, "auto"]), visita: z.enum([...formaciones, "auto"]),
  entorno: entornoArena.optional(),
});
export const peticionSesion = ajustesArena.extend({ presentacion: z.enum(["preparada", "directo", "buffer"]).default("directo"), seleccion: z.discriminatedUnion("modo", [
  z.strictObject({ modo: z.literal("programado") }), z.strictObject({ modo: z.literal("azar") }),
  z.strictObject({ modo: z.literal("manual"), local: z.string().min(1).max(40), visita: z.string().min(1).max(40) }),
]) });

/** Brief 057 v1.1 § 9 · Error tipificado del lector: 413 si el cuerpo supera el tope, 400 si falta o no
 * es JSON. `respuestaErrorSesion` responde su `status` y su mensaje. */
export class ErrorPeticion extends Error { constructor(mensaje: string, readonly status: 413 | 400) { super(mensaje); } }

export async function leerJsonAcotado(req: Request, maxBytes = 16_384): Promise<unknown> { return leerJsonDeCuerpo(req.body, maxBytes); }
/** El mismo lector sobre un flujo ya abierto (la ruta de grabaciones mira el primer fragmento antes). */
export async function leerJsonDeCuerpo(cuerpo: ReadableStream<Uint8Array> | null, maxBytes = 16_384): Promise<unknown> {
  if (!cuerpo) throw new ErrorPeticion("Petición vacía", 400);
  const lector = cuerpo.getReader(), partes: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await lector.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await lector.cancel(); throw new ErrorPeticion("Petición demasiado grande", 413); }
      partes.push(value);
    }
  } finally { lector.releaseLock(); }
  try { return JSON.parse(Buffer.concat(partes).toString("utf8")) as unknown; }
  catch { throw new ErrorPeticion(bytes ? "JSON inválido" : "Petición vacía", 400); }
}
