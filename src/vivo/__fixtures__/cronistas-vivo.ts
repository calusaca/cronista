// Cronistas falsos para las actualizaciones en vivo (brief 008), inyectados por la costura
// `Llm`. Parten de la update CORRECTA (la del stub: la plantilla del hecho del momento) y la
// corrompen. Solo para pruebas: jamás alimentan la demo.

import type { Hecho } from "../../analista/tipos";
import type { Oracion } from "../../cadena/tipos";
import type { Llm, Mensaje } from "../../lib/llm";
import { updateDesdeMensaje } from "../../lib/llm-stub";
import { extraerHechoMomento } from "../prompt";

export interface ContextoCorruptor {
  hechos: Hecho[];
  hechoMomento: string;
  mensaje: string;
}

export type CorruptorUpdate = (u: { oraciones: Oracion[] }, ctx: ContextoCorruptor) => { oraciones: Oracion[] } | string;

export interface LlmVivoGuionado extends Llm {
  llamadas: Mensaje[][];
}

/** En la llamada k (por conversación) aplica guion[k] (o el último): corruptor, "ok" o Error. */
export function llmVivoGuionado(guion: (CorruptorUpdate | "ok" | Error)[], id = "falso-vivo"): LlmVivoGuionado {
  const llamadas: Mensaje[][] = [];
  return {
    id,
    llamadas,
    async completar(_system: string, mensajes: Mensaje[]): Promise<string> {
      llamadas.push(mensajes.map((m) => ({ ...m })));
      const k = mensajes.filter((m) => m.rol === "user").length - 1; // intento dentro de ESTA update
      const paso = guion[Math.min(k, guion.length - 1)];
      const inicial = mensajes.find((m) => m.rol === "user")?.contenido ?? "";
      const correcto = updateDesdeMensaje(inicial);
      if (!correcto) throw new Error("fixture: no es un mensaje de actualización");
      if (paso instanceof Error) throw paso;
      if (paso === "ok" || paso === undefined) return JSON.stringify(correcto);
      const hechos = JSON.parse(inicial.slice(inicial.indexOf("<hechos>") + 8, inicial.indexOf("</hechos>"))) as Hecho[];
      const r = paso(JSON.parse(JSON.stringify(correcto)) as { oraciones: Oracion[] }, { hechos, hechoMomento: extraerHechoMomento(inicial) ?? "", mensaje: inicial });
      return typeof r === "string" ? r : JSON.stringify(r);
    },
  };
}

/** La mentira de clarividencia: anuncia un marcador final inventado («terminará 7–5»). */
export const FUTURO_ES = " El partido terminará 7–5.";
export const FUTURO_EN = " The match will end 7–5.";

export const clarividente: CorruptorUpdate = (u) => {
  const o = u.oraciones[0];
  if (o) {
    o.texto_es += FUTURO_ES;
    o.texto_en += FUTURO_EN;
  }
  return u;
};

/** Cita como apoyo un hecho que todavía no existe (un ID fuera del prefijo). */
export const citaFutura: CorruptorUpdate = (u) => {
  const o = u.oraciones[0];
  if (o) o.apoyo = ["h999"];
  return u;
};

/** Narra primero otro hecho (no el del momento). */
export const otroHechoPrimero: CorruptorUpdate = (u, { hechos, hechoMomento }) => {
  const otro = hechos.find((h) => h.id !== hechoMomento);
  return otro ? { oraciones: [{ texto_es: otro.texto_es, texto_en: otro.texto_en, hecho: otro.id }] } : u;
};

/** Tres oraciones (la update es corta: máximo MAX_ORACIONES_UPDATE). */
export const demasiadoLarga: CorruptorUpdate = (u, { hechos }) => {
  const extra = hechos.slice(0, 2).map((h) => ({ texto_es: h.texto_es, texto_en: h.texto_en, hecho: h.id }));
  return { oraciones: [...u.oraciones, ...extra] };
};

export const noJson: CorruptorUpdate = () => "Gol. Qué partido.";

/**
 * F1 — la batería del balance posterior en vivo: la update de la roja agrega lo que pasó
 * «después». Sobre el prefijo el balance es 0–0 por construcción y se lee como de cierre.
 * Cada mentira se agrega DENTRO de la oración del momento (como lo haría un LLM).
 */
export const MENTIRAS_BALANCE: { nombre: string; es: (l: string, v: string) => string; en: (l: string, v: string) => string }[] = [
  { nombre: "afterwards they scored 0", es: () => "; después, marcaron 0.", en: () => "; afterwards, they scored 0." },
  { nombre: "afterwards X scored 0 and Y 0", es: (l, v) => `; después, ${l} marcó 0 y ${v} 0.`, en: (l, v) => `; afterwards, ${l} scored 0 and ${v} 0.` },
  { nombre: "since then nobody scored", es: () => "; desde entonces, nadie marcó.", en: () => "; since then, nobody scored." },
  { nombre: "the rest of the match", es: (_l, v) => `; ${v} jugó el resto del partido con diez.`, en: (_l, v) => `; ${v} played the rest of the match with ten men.` },
  { nombre: "until the end", es: () => "; el marcador se mantuvo hasta el final.", en: () => "; the score held until the end." },
];

export function balancePosterior(m: (typeof MENTIRAS_BALANCE)[number], local: string, visita: string): CorruptorUpdate {
  return (u) => {
    const o = u.oraciones[0];
    if (o) {
      o.texto_es = o.texto_es.replace(/\.$/, "") + m.es(local, visita);
      o.texto_en = o.texto_en.replace(/\.$/, "") + m.en(local, visita);
    }
    return u;
  };
}
