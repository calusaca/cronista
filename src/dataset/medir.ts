// Brief 028 §2 — lo que el DATASHEET cuenta de ESTA corrida: composición (conteos) y la
// validación de las bandas de limites.ts RE-MEDIDAS sobre los partidos exportados, cada una con su
// intervalo del 95 % (Wilson para fracciones, normal para medias) y un veredicto honesto:
// - "en_banda": el valor medido cae dentro de la banda;
// - "consistente": cae fuera, pero el intervalo toca la banda (con este N no se distingue);
// - "fuera": ni el intervalo la toca.
// Las definiciones de cada medida son las de la suite estadística (npm run test:stats).

import type { TipoHecho } from "../analista/tipos";
import { VERIFICADORES } from "../sim/invariantes";
import {
  AMARILLAS_MEDIA,
  DESCUENTO_FINAL_FRACCION_MIN,
  GOLES_FRANJA,
  GOLES_MEDIA,
  LESIONES_MEDIA,
  MICRO_PASES,
  MICRO_REGATES_EXITO,
  MICRO_TOTAL,
  PASE_M,
  PASE_MEZCLA,
  RAREZA_AUTOGOL,
  RAREZA_DEFINICION,
  RAREZA_INSOLITOS,
  REFERENCIA_LIGAS_TOP,
  ROJA_MAX_FRACCION,
  ROJA_MIN_FRACCION,
  SUBIDA_MINUTO_MIN,
  VELOCIDAD_STATS,
  XG_MEDIA,
} from "../sim/limites";
import { franjaDe, golesConPeriodo } from "../sim/resumen";
import type { TipoEvento } from "../sim/tipos";
import { erroresLinea } from "./esquema";
import { lineaPartido, type Procesado } from "./exportar";
import { t, type Texto } from "./texto";
import { CONFIANZA } from "./umbrales-dataset";

export type Veredicto = "en_banda" | "consistente" | "fuera";
/** Cómo se escribe la cifra: decimal con k cifras, porcentaje con k decimales, entero. */
export type Formato = { tipo: "dec"; d: number } | { tipo: "pct"; d: number } | { tipo: "int" };

export interface Medicion {
  clave: string;
  medida: Texto;
  /** Constante de limites.ts de la que sale la banda. */
  fuente: string;
  min?: number;
  max?: number;
  /** La cota superior es estricta («menos de»). */
  maxEstricto?: boolean;
  medido: number;
  formato: Formato;
  intervalo?: [number, number];
  /** Tamaño de la muestra y su unidad (partidos, goles, tiros…). */
  n: number;
  unidad: string;
  conteo?: number;
  referencia?: { min: number; max: number };
  veredicto: Veredicto;
}

// ---- intervalos ----

export function wilson(k: number, n: number, z = CONFIANZA.z): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n;
  const den = 1 + (z * z) / n;
  const centro = (p + (z * z) / (2 * n)) / den;
  const medio = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  // En los extremos la cota es exacta (0 o 1); el redondeo de coma flotante no debe dejarla fuera.
  return [k === 0 ? 0 : Math.max(0, centro - medio), k === n ? 1 : Math.min(1, centro + medio)];
}

export function intervaloMedia(xs: readonly number[], z = CONFIANZA.z): [number, number] {
  const n = xs.length;
  const m = media(xs);
  if (n < 2) return [m, m];
  const s2 = xs.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1);
  const e = z * Math.sqrt(s2 / n);
  return [m - e, m + e];
}

export const media = (xs: readonly number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

export function dentro(x: number, m: Pick<Medicion, "min" | "max" | "maxEstricto">): boolean {
  if (m.min !== undefined && x < m.min) return false;
  if (m.max !== undefined && (m.maxEstricto ? x >= m.max : x > m.max)) return false;
  return true;
}

export function veredicto(m: Omit<Medicion, "veredicto">): Veredicto {
  if (dentro(m.medido, m)) return "en_banda";
  if (!m.intervalo) return "fuera";
  const [lo, hi] = m.intervalo;
  const tocaAbajo = m.max === undefined || lo <= m.max;
  const tocaArriba = m.min === undefined || hi >= m.min;
  return tocaAbajo && tocaArriba ? "consistente" : "fuera";
}

const conVeredicto = (m: Omit<Medicion, "veredicto">): Medicion => ({ ...m, veredicto: veredicto(m) });

function proporcion(clave: string, medida: Texto, fuente: string, banda: { min?: number; max?: number; maxEstricto?: boolean }, k: number, n: number, unidad: string, d = 2, referencia?: { min: number; max: number }): Medicion {
  return conVeredicto({ clave, medida, fuente, ...banda, medido: n === 0 ? 0 : k / n, formato: { tipo: "pct", d }, intervalo: wilson(k, n), n, unidad, conteo: k, ...(referencia ? { referencia } : {}) });
}

function promedio(clave: string, medida: Texto, fuente: string, banda: { min?: number; max?: number }, xs: readonly number[], unidad: string, d = 2, referencia?: { min: number; max: number }): Medicion {
  return conVeredicto({ clave, medida, fuente, ...banda, medido: media(xs), formato: { tipo: "dec", d }, intervalo: intervaloMedia(xs), n: xs.length, unidad, ...(referencia ? { referencia } : {}) });
}

// ---- composición ----

export interface Composicion {
  partidos: number;
  eventos: number;
  eventosPorTipo: [TipoEvento, number][];
  micro: { total: number; media: number; min: number; max: number };
  posesiones: number;
  hechos: number;
  /** Tipo, total de hechos y partidos con al menos uno. */
  hechosPorTipo: [TipoHecho, number, number][];
  goles: number;
  empates: number;
  victoriasLocal: number;
  victoriasVisita: number;
  equipos: number;
  jugadores: number;
  conCondiciones: number;
  conBajas: number;
  conSancionesClub: number;
  microCitados: number;
}

export function componer(xs: readonly Procesado[]): Composicion {
  const porTipo = new Map<TipoEvento, number>();
  const porHecho = new Map<TipoHecho, number>();
  const partidosHecho = new Map<TipoHecho, number>();
  const equipos = new Set<string>();
  const jugadores = new Set<string>();
  let empates = 0;
  let vl = 0;
  let vv = 0;
  let microCitados = 0;
  for (const x of xs) {
    for (const e of x.partido.eventos) porTipo.set(e.tipo, (porTipo.get(e.tipo) ?? 0) + 1);
    for (const h of x.hechos) porHecho.set(h.tipo, (porHecho.get(h.tipo) ?? 0) + 1);
    for (const tipo of new Set(x.hechos.map((h) => h.tipo))) partidosHecho.set(tipo, (partidosHecho.get(tipo) ?? 0) + 1);
    for (const l of ["local", "visita"] as const) {
      equipos.add(x.partido.config[l].nombre);
      for (const j of x.partido.config[l].jugadores) jugadores.add(j.nombre);
    }
    const gl = x.resumen.local.goles;
    const gv = x.resumen.visita.goles;
    if (gl === gv) empates++;
    else if (gl > gv) vl++;
    else vv++;
    microCitados += lineaPartido(x).microCitados.length;
  }
  const micro = xs.map((x) => x.micro.eventos.length);
  const orden = <K extends string>(m: Map<K, number>): [K, number][] => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    partidos: xs.length,
    eventos: xs.reduce((a, x) => a + x.partido.eventos.length, 0),
    eventosPorTipo: orden(porTipo),
    micro: { total: micro.reduce((a, b) => a + b, 0), media: media(micro), min: Math.min(...micro), max: Math.max(...micro) },
    posesiones: xs.reduce((a, x) => a + x.micro.posesiones.length, 0),
    hechos: xs.reduce((a, x) => a + x.hechos.length, 0),
    hechosPorTipo: orden(porHecho).map(([k, v]) => [k, v, partidosHecho.get(k) ?? 0] as [TipoHecho, number, number]),
    goles: xs.reduce((a, x) => a + x.resumen.local.goles + x.resumen.visita.goles, 0),
    empates,
    victoriasLocal: vl,
    victoriasVisita: vv,
    equipos: equipos.size,
    jugadores: jugadores.size,
    conCondiciones: xs.filter((x) => x.partido.config.condiciones !== undefined).length,
    conBajas: xs.filter((x) => x.partido.config.bajas !== undefined).length,
    conSancionesClub: xs.filter((x) => x.partido.config.sancionesClub !== undefined).length,
    microCitados,
  };
}

// ---- controles estructurales: invariantes del motor y validez de cada línea ----

export interface Estructura {
  verificadores: number;
  comprobaciones: number;
  violaciones: number;
  lineas: number;
  lineasInvalidas: number;
}

export function controlar(xs: readonly Procesado[]): Estructura {
  const vs = Object.values(VERIFICADORES);
  let violaciones = 0;
  let invalidas = 0;
  for (const x of xs) {
    for (const v of vs) violaciones += v(x.partido).length;
    if (erroresLinea(JSON.parse(JSON.stringify(lineaPartido(x)))).length > 0) invalidas++;
  }
  return { verificadores: vs.length, comprobaciones: vs.length * xs.length, violaciones, lineas: xs.length, lineasInvalidas: invalidas };
}

// ---- bandas re-medidas sobre la corrida ----

export function medirCorrida(xs: readonly Procesado[]): Medicion[] {
  const out: Medicion[] = [];
  const ps = xs.map((x) => x.partido);
  const R = REFERENCIA_LIGAS_TOP;

  out.push(promedio("goles", t`Goals per match`, "GOLES_MEDIA", GOLES_MEDIA, xs.map((x) => x.resumen.local.goles + x.resumen.visita.goles), "matches", 2, R.golesPorPartido));
  out.push(promedio("xg", t`xG per match (both teams)`, "XG_MEDIA", XG_MEDIA, xs.map((x) => x.resumen.local.xg + x.resumen.visita.xg), "matches", 2, R.xgPorPartido));
  out.push(promedio("amarillas", t`Yellow cards per match`, "AMARILLAS_MEDIA", AMARILLAS_MEDIA, xs.map((x) => x.resumen.local.amarillas + x.resumen.visita.amarillas), "matches", 2, R.amarillasPorPartido));
  const conRoja = xs.filter((x) => x.resumen.local.rojas + x.resumen.visita.rojas > 0).length;
  out.push(proporcion("roja", t`Matches with a red card`, "ROJA_MIN_FRACCION · ROJA_MAX_FRACCION", { min: ROJA_MIN_FRACCION, max: ROJA_MAX_FRACCION, maxEstricto: true }, conRoja, xs.length, "matches", 1, R.partidosConRoja));

  // Goles por franja de un cuarto de hora (la última incluye el descuento y no tiene techo).
  const cuenta = Array.from({ length: GOLES_FRANJA.franjas }, () => 0);
  for (const p of ps) for (const g of golesConPeriodo(p)) cuenta[franjaDe(g.minuto, g.periodo)]! += 1;
  const totalGoles = cuenta.reduce((a, b) => a + b, 0);
  cuenta.forEach((k, i) => {
    const ultima = i === GOLES_FRANJA.franjas - 1;
    out.push(
      proporcion(
        `franja${i + 1}`,
        ultima ? t`Share of goals, quarter-hour ${i + 1} of ${GOLES_FRANJA.franjas} (incl. stoppage time)` : t`Share of goals, quarter-hour ${i + 1} of ${GOLES_FRANJA.franjas}`,
        "GOLES_FRANJA",
        ultima ? { min: GOLES_FRANJA.min } : { min: GOLES_FRANJA.min, max: GOLES_FRANJA.max },
        k,
        totalGoles,
        "goals",
        1,
        ultima ? R.golesUltimoCuartoDeHora : undefined,
      ),
    );
  });

  // El final reglamentario sale del propio partido: el 2.º tiempo dura lo que va de un saque inicial
  // al otro (sin escribir «90» a mano); hay descuento si el último evento cae después.
  const conDescuento = ps.filter((p) => {
    const [i1, i2] = p.eventos.filter((e) => e.tipo === "inicio_periodo");
    if (!i1 || !i2) return false;
    const finReglamentario = i2.minuto + (i2.minuto - i1.minuto);
    return (p.eventos[p.eventos.length - 1]?.minuto ?? 0) > finReglamentario;
  }).length;
  out.push(proporcion("descuento", t`Matches whose second half has stoppage time`, "DESCUENTO_FINAL_FRACCION_MIN", { min: DESCUENTO_FINAL_FRACCION_MIN }, conDescuento, ps.length, "matches", 1));

  // Capa micro.
  const tot = xs.map((x) => x.micro.eventos.length);
  out.push(conVeredicto({ clave: "microMin", medida: t`Fewest micro-events in any match`, fuente: "MICRO_TOTAL.min", min: MICRO_TOTAL.min, medido: Math.min(...tot), formato: { tipo: "int" }, n: xs.length, unidad: "matches" }));
  out.push(conVeredicto({ clave: "microMax", medida: t`Most micro-events in any match`, fuente: "MICRO_TOTAL.max", max: MICRO_TOTAL.max, medido: Math.max(...tot), formato: { tipo: "int" }, n: xs.length, unidad: "matches" }));
  out.push(promedio("microMedia", t`Micro-events per match`, "MICRO_TOTAL.mediaMin", { min: MICRO_TOTAL.mediaMin }, tot, "matches", 0));
  const pases = xs.map((x) => x.micro.eventos.filter((m) => m.tipo === "pase"));
  out.push(promedio("pases", t`Passes per match`, "MICRO_PASES", { min: MICRO_PASES.mediaMin, max: MICRO_PASES.mediaMax }, pases.map((p) => p.length), "matches", 0));
  out.push(
    promedio("completados", t`Pass completion (mean of matches)`, "MICRO_PASES", { min: MICRO_PASES.completadosMin, max: MICRO_PASES.completadosMax }, pases.map((p) => p.filter((m) => m.completado).length / p.length), "matches", 3),
  );
  const regates = xs.flatMap((x) => x.micro.eventos.filter((m) => m.tipo === "regate"));
  out.push(proporcion("regates", t`Successful dribbles`, "MICRO_REGATES_EXITO", { min: MICRO_REGATES_EXITO.min, max: MICRO_REGATES_EXITO.max }, regates.filter((m) => m.exito).length, regates.length, "dribbles", 1));
  const dist = pases.flat().map((m) => m.distanciaM as number);
  out.push(proporcion("cortos", t`Short passes (under ${PASE_M.corto.max} m)`, "PASE_MEZCLA", { min: PASE_MEZCLA.cortosMin, max: PASE_MEZCLA.cortosMax }, dist.filter((d) => d < PASE_M.corto.max).length, dist.length, "passes", 1));
  out.push(proporcion("largos", t`Long passes (${PASE_M.largo.min} m or more)`, "PASE_MEZCLA", { min: PASE_MEZCLA.largosMin, max: PASE_MEZCLA.largosMax }, dist.filter((d) => d >= PASE_M.largo.min).length, dist.length, "passes", 1));

  // Magnitudes del tiro.
  const vel = ps.flatMap((p) => p.eventos.filter((e) => e.tipo === "tiro").map((e) => e.velocidadKmh as number));
  out.push(promedio("velocidad", t`Mean shot speed (km/h)`, "VELOCIDAD_STATS", { min: VELOCIDAD_STATS.mediaMin, max: VELOCIDAD_STATS.mediaMax }, vel, "shots", 1));
  out.push(proporcion("colaAlta", t`Shots at ${VELOCIDAD_STATS.colaAltaKmh} km/h or more`, "VELOCIDAD_STATS", { min: VELOCIDAD_STATS.colaMin, max: VELOCIDAD_STATS.colaMax }, vel.filter((v) => v >= VELOCIDAD_STATS.colaAltaKmh).length, vel.length, "shots", 1));
  out.push(proporcion("colaBaja", t`Shots at ${VELOCIDAD_STATS.colaBajaKmh} km/h or less`, "VELOCIDAD_STATS", { min: VELOCIDAD_STATS.colaMin, max: VELOCIDAD_STATS.colaMax }, vel.filter((v) => v <= VELOCIDAD_STATS.colaBajaKmh).length, vel.length, "shots", 1));

  // Definiciones (entre los goles que no son en propia puerta) y autogoles.
  const goles = ps.flatMap((p) => p.eventos.filter((e) => e.tipo === "gol"));
  const propios = goles.filter((g) => g.autogol !== true);
  const def = (clave: keyof typeof RAREZA_DEFINICION, medida: Texto, pred: (d: string) => boolean) =>
    out.push(proporcion(`def_${clave}`, medida, `RAREZA_DEFINICION.${clave}`, RAREZA_DEFINICION[clave], propios.filter((g) => pred(g.definicion ?? "")).length, propios.length, "goals (excl. own goals)", 2));
  def("cabezazo", t`Headed goals`, (d) => d === "cabezazo");
  def("mano_a_mano", t`One-on-one goals`, (d) => d === "mano_a_mano");
  def("vaselina", t`Chipped goals`, (d) => d === "vaselina");
  def("chilena_o_tijera", t`Bicycle / scissor-kick goals`, (d) => d === "chilena" || d === "tijera");
  def("media_cancha", t`Goals from the halfway line`, (d) => d === "media_cancha");
  out.push(proporcion("autogol", t`Own goals`, "RAREZA_AUTOGOL", RAREZA_AUTOGOL, goles.filter((g) => g.autogol === true).length, goles.length, "goals", 2));

  // Insólitos (definiciones del 025: recuento propio).
  let elegibles = 0;
  let subidas = 0;
  let noGol = 0;
  let palo = 0;
  let doble = 0;
  for (const p of ps) {
    const marc = { local: 0, visita: 0 };
    const convertidos = new Set(p.eventos.filter((e) => e.tipo === "gol" && e.relacionadoCon).map((e) => e.relacionadoCon));
    for (const e of p.eventos) {
      if (e.tipo === "gol") marc[e.equipo]++;
      if (e.tipo === "corner" && e.minuto >= SUBIDA_MINUTO_MIN && marc[e.equipo === "local" ? "visita" : "local"] - marc[e.equipo] === 1) elegibles++;
      if (e.tipo === "subida_portero") subidas++;
      if (e.tipo === "tiro" && !convertidos.has(e.id)) noGol++;
      if (e.alPalo !== undefined) {
        palo++;
        if (e.alPalo === 2) doble++;
      }
    }
  }
  const RI = RAREZA_INSOLITOS;
  out.push(proporcion("olimpico", t`Direct-corner goals`, "RAREZA_INSOLITOS.olimpico", RI.olimpico, goles.filter((g) => g.definicion === "olimpico").length, goles.length, "goals", 2));
  out.push(proporcion("subida", t`Goalkeeper goes up (eligible corners)`, "RAREZA_INSOLITOS.subida", RI.subida, subidas, elegibles, "eligible corners", 1));
  out.push(proporcion("alPalo", t`Unconverted shots off the woodwork`, "RAREZA_INSOLITOS.alPalo", RI.alPalo, palo, noGol, "unconverted shots", 2));
  out.push(proporcion("doblePalo", t`Woodwork shots hitting both posts`, "RAREZA_INSOLITOS.doblePalo", RI.doblePalo, doble, palo, "woodwork shots", 1));
  out.push(proporcion("interrupcion", t`Matches with a brief stoppage`, "RAREZA_INSOLITOS.interrupcion", RI.interrupcion, ps.filter((p) => p.eventos.some((e) => e.tipo === "interrupcion")).length, ps.length, "matches", 1));
  out.push(promedio("lesiones", t`Injuries per match`, "LESIONES_MEDIA", LESIONES_MEDIA, ps.map((p) => p.eventos.filter((e) => e.tipo === "lesion").length), "matches", 3));
  return out;
}
