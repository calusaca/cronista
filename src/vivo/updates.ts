// Actualizaciones en vivo (brief 008). Por cada momento clave:
//   prefijo eventos[0..i] → analizar() → hechos del momento → [Cronista ⇄ Verificador]×(1+MAX_REINTENTOS)
// con el MISMO contrato un-hecho-por-oración y el MISMO Verificador V1–V8 (por oración). La
// cobertura V5 de crónica completa no aplica; en su lugar, la primera oración debe narrar como
// principal el hecho del momento. Agotados los reintentos: la PLANTILLA del hecho del
// momento (el «acta» de las actualizaciones). Nada sin verificar llega al ticker: toda update
// final se re-verifica y, si no pasara, es un error de programa y se lanza.
//
// Sin clarividencia: el Cronista solo recibe los hechos del prefijo (minuto ≤ M), y el
// Verificador solo acepta IDs de esos hechos (V2) y cifras/nombres de ellos (V3/V4).

import type { Hecho } from "../analista/tipos";
import { guardaDeEntrada } from "../cadena/cadena";
import { feedback } from "../cadena/prompt";
import { instruccionPerspectiva, repriorizar } from "../cadena/personalizacion";
import type { ModoPersonalizacion, Motivo, Oracion } from "../cadena/tipos";
import { MAX_REINTENTOS } from "../cadena/umbrales";
import { verificarUpdate } from "../cadena/verificador";
import type { Llm, Mensaje } from "../lib/llm";
import type { Partido } from "../sim/tipos";
import { detectarMomentos, hechoDeMomento, hechosDelMomento, type Momento, prefijo } from "./momentos";
import { mensajeUpdate, SYSTEM_PROMPT_UPDATE } from "./prompt";
import { MAX_ORACIONES_UPDATE } from "./umbrales";

/** Un intento del Cronista en una actualización (la misma historia que el audit del 006). */
export interface IntentoUpdate {
  n: 1 | 2 | 3;
  oraciones: Oracion[]; // vacío si no parseaba: ver `crudo`
  veredicto: Motivo[]; // vacío = aprobado
  feedback?: string;
  crudo?: string;
}

export interface UpdateVerificada {
  momento: Momento;
  oraciones: Oracion[];
  intentos: number; // 1–3
  /** "llm" = la escribió el Cronista y pasó el Verificador; "plantilla" = el acta del hecho del momento. */
  modo: "llm" | "plantilla";
  audit: IntentoUpdate[];
  /** Los hechos del prefijo (lo conocido hasta el minuto M): IDs locales a esta update. */
  hechos: Hecho[];
  desdeCache: boolean;
}

export interface ClaveUpdate {
  seed: number;
  momento: string;
  deployment: string;
  modo: ModoPersonalizacion;
}

/** Lo que se guarda en caché de una update (sin `momento`/`hechos`, que se recalculan). */
export type UpdateGuardada = Pick<UpdateVerificada, "oraciones" | "intentos" | "modo" | "audit">;

export interface CacheUpdates {
  leer(clave: ClaveUpdate, hechos: Hecho[]): UpdateGuardada | undefined;
  /** Devuelve true si quedó guardada. Nunca lanza. */
  escribir(clave: ClaveUpdate, hechos: Hecho[], update: UpdateGuardada): boolean;
}

export interface OpcionesUpdates {
  llm: Llm;
  cache?: CacheUpdates;
  modoPersonalizacion?: ModoPersonalizacion;
}

/** Motivos del Verificador para unas oraciones ya estructuradas (re-verificación). */
export function verificarOracionesUpdate(oraciones: Oracion[], hechos: Hecho[], partido: Partido, hechoMomento: string, final = false): Motivo[] {
  return verificarUpdate(JSON.stringify({ oraciones }), hechos, partido, hechoMomento, MAX_ORACIONES_UPDATE, { final }).motivos;
}

/** La plantilla del hecho del momento: el «acta» de las actualizaciones. */
export function plantillaDelMomento(h: Hecho): Oracion[] {
  return [{ texto_es: h.texto_es, texto_en: h.texto_en, hecho: h.id }];
}

/** Hechos del momento ya personalizados (007: mismos hechos, otro orden) y su hecho principal. */
export function contextoDelMomento(partido: Partido, momento: Momento, modo: ModoPersonalizacion): { hechos: Hecho[]; principal: Hecho; pre: Partido } {
  const pre = prefijo(partido, momento);
  const hechos = repriorizar(hechosDelMomento(partido, momento), modo, pre);
  const principal = hechoDeMomento(momento, hechos);
  if (!principal) throw new Error(`error de programa: el momento ${momento.id} no tiene su hecho (${momento.tipo})`);
  return { hechos, principal, pre };
}

function guardar(cache: CacheUpdates | undefined, clave: ClaveUpdate, hechos: Hecho[], u: UpdateGuardada): void {
  try {
    cache?.escribir(clave, hechos, u);
  } catch {
    // sin caché esta vez (igual que la crónica: guardar jamás tumba la respuesta)
  }
}

export async function generarUpdate(partido: Partido, momento: Momento, opciones: OpcionesUpdates): Promise<UpdateVerificada> {
  const modoP = opciones.modoPersonalizacion ?? "neutral";
  const { hechos, principal, pre } = contextoDelMomento(partido, momento, modoP);
  // Brief 012 §A1: la regla de cierre en vivo rige en todo momento salvo el final.
  const esFinal = momento.tipo === "final";
  const asegurar = (oraciones: Oracion[]): Oracion[] => {
    const m = verificarOracionesUpdate(oraciones, hechos, pre, principal.id, esFinal);
    if (m.length > 0) throw new Error(`error de programa: la update ${momento.id} no pasa el Verificador: ${m.map((x) => `${x.regla} ${x.detalle}`).join(" | ")}`);
    return oraciones;
  };

  const clave: ClaveUpdate = { seed: partido.config.seed, momento: momento.id, deployment: opciones.llm.id, modo: modoP };
  const cacheada = opciones.cache?.leer(clave, hechos);
  if (cacheada && verificarOracionesUpdate(cacheada.oraciones, hechos, pre, principal.id, esFinal).length === 0) {
    return { momento, ...cacheada, hechos, desdeCache: true };
  }

  const perspectiva = instruccionPerspectiva(modoP, partido);
  const mensajes: Mensaje[] = [{ rol: "user", contenido: mensajeUpdate(hechos, principal.id, String(momento.minuto), perspectiva) }];
  const audit: IntentoUpdate[] = [];
  let huboErrorLlm = false;

  for (let n = 1; n <= 1 + MAX_REINTENTOS; n++) {
    let salida = "";
    let errorLlm: string | undefined;
    try {
      salida = await opciones.llm.completar(SYSTEM_PROMPT_UPDATE, mensajes);
    } catch (e) {
      errorLlm = (e as Error).message;
      huboErrorLlm = true;
    }
    const r =
      errorLlm !== undefined
        ? { oraciones: null, motivos: [{ oracion: -1, regla: "V1" as const, detalle: `el LLM falló: ${errorLlm}` }] }
        : verificarUpdate(salida, hechos, pre, principal.id, MAX_ORACIONES_UPDATE, { final: esFinal });
    const intento: IntentoUpdate = { n: n as 1 | 2 | 3, oraciones: r.oraciones ?? [], veredicto: r.motivos };
    if (!r.oraciones) intento.crudo = salida;
    audit.push(intento);

    if (r.motivos.length === 0 && r.oraciones) {
      const u: UpdateGuardada = { oraciones: asegurar(r.oraciones), intentos: n, modo: "llm", audit };
      if (!huboErrorLlm) guardar(opciones.cache, clave, hechos, u);
      return { momento, ...u, hechos, desdeCache: false };
    }
    if (n <= MAX_REINTENTOS && errorLlm === undefined) {
      const fb = feedback(r.motivos);
      intento.feedback = fb;
      mensajes.push({ rol: "assistant", contenido: salida }, { rol: "user", contenido: fb });
    }
  }

  // Reintentos agotados: la mentira no llega al ticker; cae a la plantilla del hecho.
  const u: UpdateGuardada = { oraciones: asegurar(plantillaDelMomento(principal)), intentos: audit.length, modo: "plantilla", audit };
  if (!huboErrorLlm) guardar(opciones.cache, clave, hechos, u);
  return { momento, ...u, hechos, desdeCache: false };
}

/** Todas las actualizaciones del partido, en orden de momento. Mismo seed ⇒ mismas updates. */
export async function generarUpdates(partido: Partido, opciones: OpcionesUpdates): Promise<UpdateVerificada[]> {
  guardaDeEntrada(partido);
  const momentos = detectarMomentos(partido);
  // En paralelo: con el LLM real son ~5–8 llamadas independientes (cada una con su prefijo).
  return Promise.all(momentos.map((m) => generarUpdate(partido, m, opciones)));
}
