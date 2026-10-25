// La cadena (brief 003):
//   Partido → [guarda de entrada] → analizar() → Hecho[] → [Cronista ⇄ Verificador]×(1+MAX_REINTENTOS) → CronicaVerificada
//
// Protocolo:
// 1. Guarda de entrada: validarConfig + las invariantes del simulador (incluido el
//    contrato) sobre el Partido ANTES de analizar; si algo no cuadra, LANZA.
// 2. Intento n: el Cronista (LLM por la costura) entrega un borrador; el Verificador
//    devuelve Motivo[]. Vacío ⇒ aprobado. Si no, feedback explícito y reintento.
// 3. Agotados los reintentos: se omiten las oraciones aún rechazadas del ÚLTIMO
//    borrador (o, si el último no parseó, del mejor intento previo — B6) si V5 se sigue
//    cumpliendo (un título rechazado se reemplaza por el del acta); si no, modo ACTA
//    desde las plantillas del Analista.
// 4. Nada sin verificar llega al lector: la crónica final se re-verifica entera; si
//    algo fallara ahí sería un error de programa y se lanza. Una entrada de CACHÉ que
//    no pasa el Verificador (manipulada, vieja) no se sirve: se regenera.
//
// Un error del LLM (red, cuota) cuenta como intento fallido con un motivo V1 que lo
// explica; esa corrida no se guarda en caché (no es la historia de una corrida real).

import { analizar } from "../analista/analista";
import type { Hecho } from "../analista/tipos";
import type { Llm, Mensaje, OpcionesLlm } from "../lib/llm";
import { VERIFICADORES } from "../sim/invariantes";
import { validarConfig } from "../sim/motor";
import type { Partido } from "../sim/tipos";
import { borradorActa, tituloActa } from "./acta";
import type { Cache, ClaveCache } from "./cache";
import { instruccionPerspectiva, repriorizar } from "./personalizacion";
import { feedback, mensajeInicial, SYSTEM_PROMPT } from "./prompt";
import type { CronicaDraft, CronicaVerificada, IntentoAudit, ModoPersonalizacion, Motivo } from "./tipos";
import { MAX_REINTENTOS } from "./umbrales";
import { cobertura, type HechoVerificable, oracionesRechazadas, tituloRechazado, type Veredicto, verificar, verificarDraft } from "./verificador";

/** Guarda de entrada (brief 003, de la auditoría del 002). Lanza si el Partido no es válido. */
export function guardaDeEntrada(partido: Partido): void {
  validarConfig(partido.config);
  const problemas = Object.entries(VERIFICADORES).flatMap(([nombre, v]) => v(partido).map((e) => `${nombre}: ${e}`));
  if (problemas.length > 0) {
    throw new Error(`Partido inválido (guarda de entrada): ${problemas.slice(0, 5).join(" | ")}${problemas.length > 5 ? ` (+${problemas.length - 5})` : ""}`);
  }
}

export interface OpcionesCadena {
  /** Obligatorio salvo con `forzarActa` (el acta no llama al LLM: CLI --modo acta sin env). */
  llm?: Llm;
  cache?: Cache;
  modoPersonalizacion?: ModoPersonalizacion;
  /** Acta directa, sin llamar al LLM (CLI --modo acta). No se cachea. */
  forzarActa?: boolean;
}

export interface ResultadoCadena {
  cronica: CronicaVerificada;
  hechos: Hecho[];
  /** true si la crónica vino de la caché (cero llamadas al LLM). */
  desdeCache: boolean;
}

const BORRADOR_VACIO: CronicaDraft = { titulo_es: "", titulo_en: "", oraciones: [] };

function asegurarVerificada(
  c: CronicaVerificada,
  hechos: HechoVerificable[],
  partido: Pick<Partido, "config">,
  verificarExtra?: (draft: CronicaDraft) => Motivo[],
): CronicaVerificada {
  const motivos = [...verificarDraft(c, hechos, partido), ...(verificarExtra?.(c) ?? [])];
  if (motivos.length > 0) {
    throw new Error(`error de programa: la crónica final no pasa el Verificador: ${motivos.map((m) => `${m.regla} ${m.detalle}`).join(" | ")}`);
  }
  return c;
}

/**
 * Rev. 3.2: guardar en caché JAMÁS lanza. Ya se pagó al LLM y la crónica está verificada:
 * si el disco falla (EPERM de Windows con otro proceso leyendo, disco lleno…), se sirve
 * igual, solo que sin cachear.
 */
function guardarEnCache(cache: Cache | undefined, clave: ClaveCache, hechos: Hecho[], cronica: CronicaVerificada): void {
  try {
    cache?.escribir(clave, hechos, cronica);
  } catch {
    // sin caché esta vez; la próxima corrida la regenera
  }
}

function acta(hechos: HechoVerificable[], intentos: number, audit: IntentoAudit[]): CronicaVerificada {
  return { ...borradorActa(hechos), intentos, frasesOmitidas: 0, modo: "acta", audit };
}

export async function generarCronica(partido: Partido, opciones: OpcionesCadena): Promise<ResultadoCadena> {
  guardaDeEntrada(partido);
  const modoPersonalizacion = opciones.modoPersonalizacion ?? "neutral";
  // Brief 007: la personalización ocurre ANTES del Cronista (re-priorización determinista);
  // los hechos, textos, datos, eventos e IDs no cambian, y el Verificador es el mismo.
  const hechos = repriorizar(analizar(partido), modoPersonalizacion, partido);
  const perspectiva = instruccionPerspectiva(modoPersonalizacion, partido);

  if (opciones.forzarActa) {
    return { cronica: asegurarVerificada(acta(hechos, 0, []), hechos, partido), hechos, desdeCache: false };
  }

  const llm = opciones.llm;
  if (!llm) throw new Error("generarCronica: falta el LLM (solo el acta forzada puede correr sin él)");
  const clave = { seed: partido.config.seed, deployment: llm.id, modo: modoPersonalizacion };
  // Caché: la única barrera contra una entrada manipulada o vieja es re-verificarla.
  // Si no pasa el Verificador, se REGENERA (nunca se sirve ni se lanza).
  const cacheada = opciones.cache?.leer(clave, hechos);
  if (cacheada && verificarDraft(cacheada, hechos, partido).length === 0) return { cronica: cacheada, hechos, desdeCache: true };

  const { cronica, huboErrorLlm } = await redactarYVerificar(hechos, partido, llm, { perspectiva });
  if (!huboErrorLlm) guardarEnCache(opciones.cache, clave, hechos, cronica);
  return { cronica, hechos, desdeCache: false };
}

/** Brief 064 § 4.4 · Opciones del bucle Cronista ⇄ Verificador. Sin ninguna, la conducta es la de la cadena histórica. */
export interface OpcionesRedaccion {
  /** Por defecto SYSTEM_PROMPT. */
  system?: string;
  /** La de 007, por defecto ninguna. */
  perspectiva?: string;
  /** Se suma a verificar/verificarDraft en cada intento y al final. */
  verificarExtra?: (draft: CronicaDraft) => Motivo[];
  /** Por defecto undefined: la llamada de hoy, con dos argumentos y sin opciones. */
  opcionesLlm?: (intento: number) => OpcionesLlm;
  /** Por defecto `feedback` de prompt.ts. */
  feedback?: (motivos: Motivo[]) => string;
  /** Antes de cada intento: si devuelve false, no se llama y el bucle termina como si se agotaran los intentos. */
  antesDeLlamar?: (system: string, mensajes: Mensaje[], intento: number) => boolean;
  /** Una salida más larga cuenta como intento fallido con motivo V1 y no se reenvía en la conversación. */
  maxCaracteresRespuesta?: number;
}

/**
 * Brief 064 § 4.4 · El bucle de la cadena (intentos con feedback, B6, omisión, acta y re-verificación final), extraído
 * de `generarCronica` sin cambio de conducta. Devuelve si hubo error del LLM para que quien llama decida si cachea.
 */
export async function redactarYVerificar(
  hechos: HechoVerificable[],
  partido: Pick<Partido, "config">,
  llm: Llm,
  opciones: OpcionesRedaccion = {},
): Promise<{ cronica: CronicaVerificada; huboErrorLlm: boolean }> {
  const system = opciones.system ?? SYSTEM_PROMPT;
  const extra = opciones.verificarExtra;
  const darFeedback = opciones.feedback ?? feedback;
  const conExtra = (v: Veredicto): Veredicto => (extra && v.draft ? { draft: v.draft, motivos: [...v.motivos, ...extra(v.draft)] } : v);
  const audit: IntentoAudit[] = [];
  const mensajes: Mensaje[] = [{ rol: "user", contenido: mensajeInicial(hechos, opciones.perspectiva) }];
  let ultimo: { draft: CronicaDraft | null; motivos: Motivo[] } = { draft: null, motivos: [] };
  let huboErrorLlm = false;

  for (let n = 1; n <= 1 + MAX_REINTENTOS; n++) {
    if (opciones.antesDeLlamar && !opciones.antesDeLlamar(system, mensajes, n)) break;
    let salida = "";
    let errorLlm: string | undefined;
    let demasiadoLarga = false;
    try {
      salida = opciones.opcionesLlm ? await llm.completar(system, mensajes, opciones.opcionesLlm(n)) : await llm.completar(system, mensajes);
    } catch (e) {
      errorLlm = (e as Error).message;
      huboErrorLlm = true;
    }
    if (errorLlm === undefined && opciones.maxCaracteresRespuesta !== undefined && salida.length > opciones.maxCaracteresRespuesta) {
      demasiadoLarga = true;
    }
    ultimo =
      errorLlm !== undefined
        ? { draft: null, motivos: [{ oracion: -1, regla: "V1", detalle: `el LLM falló: ${errorLlm}` }] }
        : demasiadoLarga
          ? { draft: null, motivos: [{ oracion: -1, regla: "V1", detalle: `respuesta demasiado larga (${salida.length} caracteres; máximo ${opciones.maxCaracteresRespuesta})` }] }
          : conExtra(verificar(salida, hechos, partido));
    const intento: IntentoAudit = { n: n as 1 | 2 | 3, borrador: ultimo.draft ?? BORRADOR_VACIO, veredicto: ultimo.motivos };
    if (!ultimo.draft) intento.crudo = demasiadoLarga ? `${salida.slice(0, opciones.maxCaracteresRespuesta)}…` : salida;
    audit.push(intento);

    if (ultimo.motivos.length === 0 && ultimo.draft) {
      const cronica = asegurarVerificada({ ...ultimo.draft, intentos: n, frasesOmitidas: 0, modo: "llm", audit }, hechos, partido, extra);
      return { cronica, huboErrorLlm };
    }
    // Un error del LLM se reintenta con la misma conversación (no hay respuesta que
    // devolverle); un rechazo del Verificador se reintenta con feedback explícito.
    // 064: una respuesta demasiado larga tampoco se devuelve (se trata como un error del LLM).
    if (n <= MAX_REINTENTOS && errorLlm === undefined && !demasiadoLarga) {
      const fb = darFeedback(ultimo.motivos);
      intento.feedback = fb;
      mensajes.push({ rol: "assistant", contenido: salida }, { rol: "user", contenido: fb });
    }
  }

  // Reintentos agotados: omitir oraciones rechazadas si V5 aguanta; si no, acta.
  // B6 (rev. 3.1): si el ÚLTIMO intento ni siquiera parseó (V1), se recupera el mejor
  // intento previo (menos oraciones rechazadas; a igualdad, el más reciente) por la
  // misma vía de omisión, antes de caer al acta.
  const intentos = audit.length;
  let base: { draft: CronicaDraft; motivos: Motivo[] } | undefined = ultimo.draft ? { draft: ultimo.draft, motivos: ultimo.motivos } : undefined;
  if (!base) {
    // Rev. 3.2: el mejor intento previo minimiza (oraciones rechazadas + hechos requeridos
    // que quedarían sin narrar tras omitirlas). A igual costo, el que deja menos requeridos
    // sin narrar (el que SÍ se puede servir); luego, el más reciente.
    const costo = (a: IntentoAudit) => {
      const rechazadas = oracionesRechazadas(a.veredicto);
      const sinNarrar = cobertura(a.borrador.oraciones.filter((_, i) => !rechazadas.has(i)), hechos).length;
      return { total: rechazadas.size + sinNarrar, sinNarrar };
    };
    const previos = audit.filter((a) => a.borrador.oraciones.length > 0 && !a.veredicto.some((m) => m.regla === "V1"));
    const mejor = previos.reduce<IntentoAudit | undefined>((acc, a) => {
      if (acc === undefined) return a;
      const ca = costo(a);
      const cb = costo(acc);
      if (ca.total !== cb.total) return ca.total < cb.total ? a : acc;
      if (ca.sinNarrar !== cb.sinNarrar) return ca.sinNarrar < cb.sinNarrar ? a : acc;
      return a; // empate total: el más reciente
    }, undefined);
    if (mejor) base = { draft: mejor.borrador, motivos: mejor.veredicto };
  }
  let cronica: CronicaVerificada;
  if (base) {
    const rechazadas = oracionesRechazadas(base.motivos);
    const quedan = base.draft.oraciones.filter((_, i) => !rechazadas.has(i));
    const titulo = tituloRechazado(base.motivos) ? tituloActa(hechos) : { titulo_es: base.draft.titulo_es, titulo_en: base.draft.titulo_en };
    if (quedan.length > 0 && cobertura(quedan, hechos).length === 0) {
      cronica = { ...titulo, oraciones: quedan, intentos, frasesOmitidas: rechazadas.size, modo: "llm", audit };
    } else {
      cronica = acta(hechos, intentos, audit);
    }
  } else {
    cronica = acta(hechos, intentos, audit);
  }
  cronica = asegurarVerificada(cronica, hechos, partido, extra);
  return { cronica, huboErrorLlm };
}
