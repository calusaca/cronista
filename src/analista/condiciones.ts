// Brief 018 §3 — las MEDICIONES de los efectos de las condiciones sobre UN partido (o su
// prefijo). Funciones puras sobre el partido y su capa micro; las comparten el Analista (que
// decide si hay hecho) y el panel de stats (que destaca lo mismo que se narra). La condición
// registrada sola no paga ninguna frase: el hecho de efecto exige la medición de ESE partido.

import { PASE_M, SALIDA_TEMPRANA_MIN } from "../sim/limites";
import type { MicroPartido } from "../sim/micro";
import type { Lado, Partido } from "../sim/tipos";
import { CALOR_PASES_2T_MAX, CANCHA_CORTOS_MAX, CANCHA_CORTOS_MUESTRA_MIN, NIEBLA_LARGOS_MAX, NIEBLA_LARGOS_MUESTRA_MIN, PRESION_PERDIDAS_MIN } from "./umbrales";

const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a * 100) / b));

/** Índice del segundo inicio_periodo (−1 si el prefijo no llegó al 2.º tiempo). */
function inicioSegundo(p: Partido): number {
  return p.eventos.findIndex((e, i) => i > 0 && e.tipo === "inicio_periodo");
}

export interface MedicionCalor {
  temperaturaC: number;
  pases1: number;
  pases2: number;
  /** pases del 2.º tiempo como % de los del 1.º (entero). */
  porcentaje: number;
  /** ¿El 2.º tiempo terminó? Sin eso la comparación no está hecha (un 2.º tiempo a medias tiene menos pases). */
  completo: boolean;
  /** ¿La caída medida pasa el umbral (y la comparación está completa)? */
  efecto: boolean;
}

/** Efecto 1 — pases del 2.º tiempo frente a los del 1.º, solo si el partido se jugó con calor. */
export function medirCalor(p: Partido, m: MicroPartido): MedicionCalor | undefined {
  const c = p.config.condiciones;
  if (!c || c.clima !== "calor" || c.temperaturaC === undefined) return undefined;
  const i2 = inicioSegundo(p);
  const idx = new Map(p.eventos.map((e, i) => [e.id, i] as const));
  let pases1 = 0;
  let pases2 = 0;
  for (const x of m.eventos) {
    if (x.tipo !== "pase") continue;
    if (i2 >= 0 && (idx.get(x.ancla) ?? 0) >= i2) pases2++;
    else pases1++;
  }
  const completo = p.eventos.filter((e) => e.tipo === "fin_periodo").length >= 2;
  // En enteros: pases2·100 ≤ K·pases1 (como el resto de los umbrales del Analista).
  const efecto = completo && pases1 > 0 && pases2 * 100 <= CALOR_PASES_2T_MAX * pases1;
  return { temperaturaC: c.temperaturaC, pases1, pases2, porcentaje: pct(pases2, pases1), completo, efecto };
}

export interface MedicionCancha {
  completados: number;
  intentados: number;
  porcentaje: number;
  /** El local, que entrena en ese césped: la comparación del desglose. */
  completadosLocal: number;
  intentadosLocal: number;
  porcentajeLocal: number;
  /** Con lluvia la caída no se le atribuye al césped: no hay efecto que narrar. */
  lluvia: boolean;
  efecto: boolean;
}

/** ¿Pase corto? La banda del 013 (PASE_M.corto: menos de su máximo). */
const esCorto = (d: number | undefined) => d !== undefined && d < PASE_M.corto.max;

/** Efecto 5 — completación de los pases cortos del VISITANTE, solo en césped natural alto. */
export function medirCancha(p: Partido, m: MicroPartido): MedicionCancha | undefined {
  const c = p.config.condiciones;
  if (!c || c.superficie !== "natural" || c.cesped !== "alto") return undefined;
  const de = (l: Lado) => m.eventos.filter((x) => x.tipo === "pase" && x.equipo === l && esCorto(x.distanciaM));
  const v = de("visita");
  const l = de("local");
  const completados = v.filter((x) => x.completado).length;
  const completadosLocal = l.filter((x) => x.completado).length;
  const porcentaje = pct(completados, v.length);
  // Muestra mínima (como DOMINIO_PASES_MIN): en un prefijo corto, 3 de 5 no es «la cancha».
  // Verificación de Fable (2 oct): SIN lluvia. Con lluvia la caída sale en el 55 % de los partidos
  // de césped alto (14 % en seco): la frase le atribuiría al césped lo que hizo la lluvia.
  const lluvia = c.clima === "lluvia";
  const efecto = !lluvia && v.length >= CANCHA_CORTOS_MUESTRA_MIN && completados * 100 <= CANCHA_CORTOS_MAX * v.length;
  return { completados, intentados: v.length, porcentaje, completadosLocal, intentadosLocal: l.length, porcentajeLocal: pct(completadosLocal, l.length), lluvia, efecto };
}

export interface MedicionPresion {
  lado: Lado;
  /** Pérdidas en la zona de salida (defensa) del presionado antes de SALIDA_TEMPRANA_MIN: los micro-eventos citados. */
  ids: string[];
  limite: number;
  efecto: boolean;
}

/** Efecto 6 — pérdidas tempranas en salida del equipo con presión ALTA (si lo hay). */
export function medirPresion(p: Partido, m: MicroPartido): MedicionPresion | undefined {
  const c = p.config.condiciones;
  if (!c) return undefined;
  const lado = (["local", "visita"] as const).find((l) => c.presion[l] === "alta");
  if (!lado) return undefined;
  const ids = m.eventos.filter((x) => x.tipo === "perdida" && x.equipo === lado && x.zona === "defensa" && x.minuto < SALIDA_TEMPRANA_MIN).map((x) => x.id);
  return { lado, ids, limite: SALIDA_TEMPRANA_MIN, efecto: ids.length >= PRESION_PERDIDAS_MIN };
}

export interface MedicionNiebla {
  completados: number;
  intentados: number;
  porcentaje: number;
  efecto: boolean;
}

/** Brief 025 — pases LARGOS (la banda larga del 013) completados del partido, solo con niebla registrada. */
export function medirNiebla(p: Partido, m: MicroPartido): MedicionNiebla | undefined {
  if (p.config.condiciones?.clima !== "niebla") return undefined;
  const largos = m.eventos.filter((x) => x.tipo === "pase" && x.distanciaM !== undefined && x.distanciaM >= PASE_M.largo.min);
  const completados = largos.filter((x) => x.completado).length;
  const efecto = largos.length >= NIEBLA_LARGOS_MUESTRA_MIN && completados * 100 <= NIEBLA_LARGOS_MAX * largos.length;
  return { completados, intentados: largos.length, porcentaje: pct(completados, largos.length), efecto };
}
