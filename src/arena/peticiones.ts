import { z } from "zod";
import { ARENA, CESPEDES, CLIMAS_PARTIDO, NIVELES_PRESION, SUPERFICIES } from "../sim/limites";
import { formaciones } from "./tipos";

export const ajustesArena = z.strictObject({
  seed: z.number().int().min(0).max(4294967295), segundos: z.number().int().min(1).max(ARENA.duracionMaxS),
  local: z.enum([...formaciones, "auto"]), visita: z.enum([...formaciones, "auto"]),
  entorno: z.strictObject({ clima: z.enum(CLIMAS_PARTIDO).optional(), temperaturaC: z.number().int().min(-8).max(41).optional(), superficie: z.enum(SUPERFICIES).optional(), cesped: z.enum(CESPEDES).optional(), presion: z.strictObject({ local: z.enum(NIVELES_PRESION), visita: z.enum(NIVELES_PRESION) }).optional() }).optional(),
});
export const peticionSesion = ajustesArena.extend({ presentacion: z.enum(["preparada", "directo", "buffer"]).default("directo"), seleccion: z.discriminatedUnion("modo", [
  z.strictObject({ modo: z.literal("programado") }), z.strictObject({ modo: z.literal("azar") }),
  z.strictObject({ modo: z.literal("manual"), local: z.string().min(1).max(40), visita: z.string().min(1).max(40) }),
]) });

export async function leerJsonAcotado(req: Request, maxBytes = 16_384): Promise<unknown> {
  if (!req.body) throw new Error("Petición vacía");
  const lector = req.body.getReader(), partes: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await lector.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await lector.cancel(); throw new Error("Petición demasiado grande"); }
      partes.push(value);
    }
  } finally { lector.releaseLock(); }
  return JSON.parse(Buffer.concat(partes).toString("utf8")) as unknown;
}
