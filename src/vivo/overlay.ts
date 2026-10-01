// Export de overlay para broadcast (brief 008): JSON minutado de las actualizaciones
// verificadas. Es la MISMA fuente que consume el ticker de la UI (la UI pide este endpoint),
// así que lo que ve el estudio y lo que ve el lector coinciden por construcción.
//
// Una entrada por ORACIÓN verificada (cada oración narra un hecho, de ahí `hecho` singular),
// con los campos del brief {minuto, texto_es, texto_en, hecho, eventos} más cuatro de
// contexto: `momento` (agrupa las oraciones de una misma update), `tipo`, `verificacion` e
// `intentos`.

import { z } from "zod";
import { MODOS_PERSONALIZACION, type ModoPersonalizacion } from "../cadena/tipos";
import type { UpdateVerificada } from "./updates";
import { MOMENTOS_CLAVE } from "./umbrales";

export const esquemaEntradaOverlay = z.object({
  minuto: z.number().int().min(0),
  texto_es: z.string().min(1),
  texto_en: z.string().min(1),
  /** ID del hecho narrado. Local a la update (los hechos se analizan sobre el prefijo). */
  hecho: z.string().min(1),
  /** IDs de los eventos que respaldan la oración (hecho principal + apoyo), todos de minuto ≤ `minuto`. */
  eventos: z.array(z.string().regex(/^e\d+$/)).min(1),
  momento: z.string().min(1),
  tipo: z.enum(MOMENTOS_CLAVE),
  /** "llm" = el Cronista la escribió y pasó V1–V8; "plantilla" = el acta del hecho del momento. */
  verificacion: z.enum(["llm", "plantilla"]),
  /** Intentos del Cronista en esa update (1 = aprobada a la primera; >1 = corregida o plantilla). */
  intentos: z.number().int().min(1),
});

export const esquemaOverlay = z
  .object({
    seed: z.number().int().min(0),
    /** Honestidad del brief: es un replay de un partido simulado, no streaming en vivo. */
    replay: z.literal(true),
    llm: z.string(),
    modo: z.enum(MODOS_PERSONALIZACION),
    local: z.string(),
    visita: z.string(),
    actualizaciones: z.array(esquemaEntradaOverlay),
  })
  .superRefine((o, ctx) => {
    o.actualizaciones.forEach((a, i) => {
      const prev = o.actualizaciones[i - 1];
      if (prev && prev.minuto > a.minuto) ctx.addIssue({ code: "custom", message: `actualizaciones[${i}] fuera de orden de minuto` });
    });
  });

export type EntradaOverlay = z.infer<typeof esquemaEntradaOverlay>;
export type Overlay = z.infer<typeof esquemaOverlay>;

export interface ContextoOverlay {
  seed: number;
  llm: string;
  modo: ModoPersonalizacion;
  local: string;
  visita: string;
}

/** Overlay desde las updates verificadas (ya en orden de momento). Lanza si no valida. */
export function construirOverlay(ctx: ContextoOverlay, updates: UpdateVerificada[], ordenEventos: string[]): Overlay {
  const pos = new Map(ordenEventos.map((id, i) => [id, i]));
  const actualizaciones = updates.flatMap((u) => {
    const porId = new Map(u.hechos.map((h) => [h.id, h]));
    return u.oraciones.map((o) => {
      const ids = new Set([o.hecho, ...(o.apoyo ?? [])].flatMap((id) => porId.get(id)?.eventos ?? []));
      return {
        minuto: u.momento.minuto,
        texto_es: o.texto_es,
        texto_en: o.texto_en,
        hecho: o.hecho,
        eventos: [...ids].sort((a, b) => (pos.get(a) ?? 0) - (pos.get(b) ?? 0)),
        momento: u.momento.id,
        tipo: u.momento.tipo,
        verificacion: u.modo,
        intentos: u.intentos,
      };
    });
  });
  return esquemaOverlay.parse({ ...ctx, replay: true, actualizaciones });
}
