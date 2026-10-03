// Funciones puras de la vista (brief 004 + 006): la cadena oración → hecho(s) → eventos,
// su inversa, el estado de cada frase y su historia en el audit, el marcador progresivo
// y la jugada de un gol. Todo sale de datos reales — nunca de un mapeo hecho a mano.
// Sin React ni DOM: se prueba con vitest.

import { cornerDelTiro } from "../sim/espacial";
import { TIPOS_ATAQUE, TRAS_CORNER_MAX_MIN } from "../sim/limites";
import type { Hecho } from "../analista/tipos";
import type { CronicaVerificada, IntentoAudit, Motivo, Oracion } from "../cadena/tipos";
import type { Evento, Lado } from "../sim/tipos";

/** Hechos que respalda una oración: el principal y su apoyo, sin repetir. */
export function hechosDeOracion(o: Oracion): string[] {
  return [...new Set([o.hecho, ...(o.apoyo ?? [])])];
}

/** Orden del stream a partir del id secuencial («e042» ⇒ 42). */
const ordenEvento = (id: string) => Number(id.slice(1));

/**
 * Eventos que respaldan la oración i (brief 004): los de su hecho principal y los de su
 * apoyo, SIN duplicados (dos hechos pueden citar el mismo evento) y en orden del partido.
 */
export function eventosDeOracion(cronica: CronicaVerificada, hechos: Hecho[], i: number): string[] {
  const o = cronica.oraciones[i];
  if (!o) return [];
  const porId = new Map(hechos.map((h) => [h.id, h] as const));
  const ids = new Set<string>();
  for (const hid of hechosDeOracion(o)) for (const e of porId.get(hid)?.eventos ?? []) ids.add(e);
  return [...ids].sort((a, b) => ordenEvento(a) - ordenEvento(b));
}

/** Inversa: índices de las oraciones que citan (vía sus hechos) un evento. */
export function oracionesDeEvento(cronica: CronicaVerificada, hechos: Hecho[], eventoId: string): number[] {
  const out: number[] = [];
  cronica.oraciones.forEach((_, i) => {
    if (eventosDeOracion(cronica, hechos, i).includes(eventoId)) out.push(i);
  });
  return out;
}

// ---------------------------------------------------------------------------------
// Estado y la historia de cada frase (006: la Caja de cristal)
// ---------------------------------------------------------------------------------

/** «verificada» (✓), «corregida» (↻: hubo un rechazo y esta es la versión aprobada), «acta». */
export type EstadoOracion = "verificada" | "corregida" | "acta";

export interface PasoHistoria {
  n: number;
  /** La versión de ESTA frase (la que narra el mismo hecho) en ese intento, si existió. */
  version?: Oracion;
  /** Motivos de rechazo de esa versión (incluido un V5 global que la reclamaba). */
  motivos: Motivo[];
  /** Feedback que el Verificador devolvió al Cronista tras ese intento. */
  feedback?: string;
  /** true si esa versión no tuvo motivos propios (pasó). */
  aprobada: boolean;
  /** Si ese intento no se pudo leer como JSON (V1), el motivo general. */
  ilegible?: Motivo;
}

/** La historia de la oración i a lo largo de los intentos del audit. */
export function historiaDeOracion(cronica: CronicaVerificada, i: number): PasoHistoria[] {
  const o = cronica.oraciones[i];
  if (!o) return [];
  return cronica.audit.map((a: IntentoAudit) => {
    const j = a.borrador.oraciones.findIndex((x) => x.hecho === o.hecho);
    const version = j >= 0 ? a.borrador.oraciones[j] : undefined;
    const propios = j >= 0 ? a.veredicto.filter((m) => m.oracion === j) : [];
    const reclamada = a.veredicto.filter((m) => m.regla === "V5" && m.oracion === -1 && m.detalle.includes(o.hecho));
    const ilegible = a.veredicto.find((m) => m.regla === "V1");
    const motivos = [...propios, ...reclamada];
    return {
      n: a.n,
      ...(version ? { version } : {}),
      motivos,
      ...(a.feedback ? { feedback: a.feedback } : {}),
      aprobada: version !== undefined && motivos.length === 0,
      ...(ilegible ? { ilegible } : {}),
    };
  });
}

export function estadoOracion(cronica: CronicaVerificada, i: number): EstadoOracion {
  if (cronica.modo === "acta") return "acta";
  const hubo = historiaDeOracion(cronica, i).some((p) => p.motivos.length > 0 || p.ilegible !== undefined);
  return hubo ? "corregida" : "verificada";
}

/** Barra de verificación (004): «14/14 sentences verified · 2 attempts · 0 omitted». */
export function resumenVerificacion(cronica: CronicaVerificada): { oraciones: number; intentos: number; omitidas: number; corregidas: number; modo: "llm" | "acta" } {
  const corregidas = cronica.oraciones.filter((_, i) => estadoOracion(cronica, i) === "corregida").length;
  return { oraciones: cronica.oraciones.length, intentos: cronica.intentos, omitidas: cronica.frasesOmitidas, corregidas, modo: cronica.modo };
}

// ---------------------------------------------------------------------------------
// Línea de tiempo
// ---------------------------------------------------------------------------------

export function fmtMinuto(m: number): string {
  return m > 90 ? `90+${m - 90}′` : `${m}′`;
}

/** Marcador después de cada evento (para la columna de marcador progresivo). */
export function marcadorProgresivo(eventos: Evento[]): Record<string, { local: number; visita: number }> {
  const m: Record<Lado, number> = { local: 0, visita: 0 };
  const out: Record<string, { local: number; visita: number }> = {};
  for (const e of eventos) {
    if (e.tipo === "gol") m[e.equipo] += 1;
    out[e.id] = { local: m.local, visita: m.visita };
  }
  return out;
}

export interface Periodo {
  n: 1 | 2;
  eventos: Evento[];
}

/** Eventos agrupados por periodo (los inicio/fin de periodo se dibujan como separadores). */
export function porPeriodo(eventos: Evento[]): Periodo[] {
  const out: Periodo[] = [];
  let actual: Periodo | undefined;
  for (const e of eventos) {
    if (e.tipo === "inicio_periodo") {
      actual = { n: out.length === 0 ? 1 : 2, eventos: [] };
      out.push(actual);
      continue;
    }
    if (e.tipo === "fin_periodo") continue;
    actual?.eventos.push(e);
  }
  return out;
}

// ---------------------------------------------------------------------------------
// «Cómo fue el gol» (004): la jugada, solo con lo que los eventos afirman
// ---------------------------------------------------------------------------------

export interface PasoJugada {
  evento: Evento;
  rol: "falta" | "corner" | "pase_clave" | "tiro" | "gol" | "subida" | "atajada";
}

/**
 * La jugada de un gol: su tiro (relacionadoCon) y lo que lo preparó inmediatamente antes
 * en el stream, sin cruzar más de TRAS_CORNER_MAX_MIN minutos. Nada que los eventos no digan.
 * - Penal: la falta rival (las tarjetas de esa falta se saltan) y ahí termina (brief 012 §F2:
 *   un penal nunca es «tras córner»).
 * - Si no: hacia atrás por los eventos de ATAQUE (los demás — faltas, tarjetas, cambios — se
 *   saltan), hasta 2 pasos de pase clave o córner del mismo equipo. Es el mismo recorrido de
 *   `cornerDelTiro` (brief 012 §F4), así pizarra y generador no pueden divergir.
 */
export function jugadaDelGol(eventos: Evento[], golId: string): PasoJugada[] {
  const idx = new Map(eventos.map((e, i) => [e.id, i] as const));
  const evento = eventos[idx.get(golId) ?? -1];
  // Brief 025: la jugada de la SUBIDA del portero — la subida, su córner y, si lo hubo, el remate de
  // ese córner (de quien sea) con su desenlace. Nada que los eventos no digan.
  if (evento?.tipo === "subida_portero") {
    const i = idx.get(evento.id) as number;
    const corner = eventos[i + 1];
    if (!corner || corner.tipo !== "corner") return [{ evento, rol: "subida" }];
    const pasos: PasoJugada[] = [{ evento, rol: "subida" }, { evento: corner, rol: "corner" }];
    const sig = eventos[i + 2];
    if (sig?.tipo === "gol" && sig.relacionadoCon === corner.id) return [...pasos, { evento: sig, rol: "gol" }];
    if (sig?.tipo !== "tiro" || cornerDelTiro(eventos, i + 2)?.id !== corner.id) return pasos;
    const fin = eventos.find((x) => (x.tipo === "gol" || x.tipo === "atajada") && x.relacionadoCon === sig.id);
    return [...pasos, { evento: sig, rol: "tiro" }, ...(fin ? [{ evento: fin, rol: fin.tipo === "gol" ? ("gol" as const) : ("atajada" as const) }] : [])];
  }
  // Brief 025: también la jugada de un tiro AL PALO (no hay gol: la tarjeta cuenta ese remate).
  const esTiroAlPalo = evento?.tipo === "tiro" && evento.alPalo !== undefined;
  if (!evento || (evento.tipo !== "gol" && !esTiroAlPalo)) return [];
  const gol = esTiroAlPalo ? undefined : evento;
  const ti = esTiroAlPalo ? idx.get(evento.id) : idx.get(evento.relacionadoCon ?? "");
  const tiro = ti !== undefined ? eventos[ti] : undefined;
  // Brief 025: el gol olímpico cuelga de su córner (sin tiro); si el portero había subido, va su paso.
  if (gol && tiro?.tipo === "corner" && ti !== undefined) {
    const sub = eventos[ti - 1]?.tipo === "subida_portero" ? [{ evento: eventos[ti - 1] as Evento, rol: "subida" as const }] : [];
    return [...sub, { evento: tiro, rol: "corner" }, { evento: gol, rol: "gol" }];
  }
  if (!tiro || ti === undefined || tiro.tipo !== "tiro") return gol ? [{ evento: gol, rol: "gol" }] : [];
  const previos: PasoJugada[] = [];
  for (let k = ti - 1; k >= 0 && previos.length < 2; k--) {
    const e = eventos[k] as Evento;
    if (tiro.minuto - e.minuto > TRAS_CORNER_MAX_MIN) break;
    if (tiro.penal === true) {
      if (e.tipo === "tarjeta_amarilla" || e.tipo === "tarjeta_roja") continue;
      if (e.tipo === "falta" && e.equipo !== tiro.equipo) previos.unshift({ evento: e, rol: "falta" });
      break;
    }
    if (!TIPOS_ATAQUE.includes(e.tipo)) continue;
    if (e.tipo === "pase_clave" && e.equipo === tiro.equipo) previos.unshift({ evento: e, rol: "pase_clave" });
    else if (e.tipo === "corner" && e.equipo === tiro.equipo) previos.unshift({ evento: e, rol: "corner" });
    else break;
  }
  // Brief 025: si el córner del remate tuvo la subida del portero, va primero.
  const primero = previos[0];
  const iPrimero = primero ? idx.get(primero.evento.id) : undefined;
  const subida = iPrimero !== undefined && eventos[iPrimero - 1]?.tipo === "subida_portero" ? [{ evento: eventos[iPrimero - 1] as Evento, rol: "subida" as const }] : [];
  return [...subida, ...previos, { evento: tiro, rol: "tiro" }, ...(gol ? [{ evento: gol, rol: "gol" as const }] : [])];
}
