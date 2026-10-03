// El Verificador (brief 003, revisiones 3.1 y 3.2): determinista, sin LLM.
//
//   V1 la salida no parsea o no cumple el esquema zod
//   V2 una oración cita (como principal o apoyo) un hecho inexistente, o no tiene principal
//   V3 un número no está en el hecho PRINCIPAL; o un marcador («A x–y B», «x a y»), un margen,
//      un periodo o una cuenta de goles no coincide con lo que ese hecho afirma
//   V4 un nombre propio no es del hecho principal; «Jugador (Equipo)» con equipo ajeno; una
//      palabra con mayúscula que no es nombre del hecho ni palabra funcional; letras de otra
//      escritura (homóglifos, katakana…)
//   V5 narración obligatoria: todo hecho requerido es PRINCIPAL de alguna oración, y cada
//      oración narra a su principal (nombra a alguien o dice alguna cifra suya)
//   V6 ES y EN difieren en sus números, o alguno está vacío
//   V7 negaciones: ningún hecho afirma ausencias — salvo una negación de GOLES que los datos
//      del principal respaldan con un cero para ese equipo (rev. 3.2)
//   V8 vocabulario no pagado por el hecho: tabla de juicio, muletillas, verbos de resultado
//      con sujeto equivocado, afirmaciones computables falsas (gol de la victoria, valla
//      invicta, franjas temporales), preguntas retóricas y tiempo futuro
//
// El TÍTULO no cita hechos: se verifica contra el resultado final más los hechos de los
// jugadores que nombra. Sus motivos llevan oracion −1 y el detalle empieza con «título».

import { z } from "zod";
import type { Hecho } from "../analista/tipos";
import { FUERA_DEL_AREA_M, MISIL_KMH } from "../sim/limites";
import type { Partido } from "../sim/tipos";
import {
  BALANCE_POSTERIOR,
  CIERRE_EN_VIVO,
  CIERRE_EN_VIVO_EXCEPTO,
  CONSECUENCIAS,
  CUENTA_GOLES,
  EFECTOS_CONDICION,
  FRANJAS,
  GRADOS_C,
  FRASES_CANAL,
  FUERA_DEL_AREA,
  MISIL,
  FRASES_INFERIORIDAD,
  FRASES_PERIODO,
  FRASES_SIEMPRE,
  FUNCIONALES,
  FUTURO,
  GOL_DECISIVO,
  GOL_DEFINITIVO,
  JUICIO,
  type Lengua,
  MARGEN,
  type Marcador,
  NEGACION_FREE,
  NEGACIONES,
  NEGACIONES_EXCEPTO,
  NUMEROS_EN_PALABRAS,
  palabras,
  PREPOSICIONES,
  RAICES_GOL,
  TITULO_EN_COMUNES,
  VALLA_INVICTA,
  valorMargen,
  VERBOS_RESULTADO,
} from "./lexico";
import type { CronicaDraft, Motivo, Oracion, Regla } from "./tipos";
import { COBERTURA, FINAL_MIN, MARCADOR_MAX_GOLES, MINUTO_DESCANSO, TEMPRANO_MAX } from "./umbrales";

export const esquemaOracion = z.object({
  texto_es: z.string(),
  texto_en: z.string(),
  hecho: z.string(),
  apoyo: z.array(z.string()).optional(),
});

export const esquemaDraft = z.object({
  titulo_es: z.string(),
  titulo_en: z.string(),
  oraciones: z.array(esquemaOracion).min(1),
});

/** Esquema del borrador guardado en el audit: puede tener 0 oraciones (intento V1). */
export const esquemaDraftAudit = esquemaDraft.extend({ oraciones: z.array(esquemaOracion) });

// ---------------------------------------------------------------------------------
// Normalización (antes de cualquier regla)
// ---------------------------------------------------------------------------------

const ES_DIGITO = /\p{Nd}/u;
/** Caracteres de ancho cero y guion blando: se eliminan («go​leó» ⇒ «goleó»). */
const ANCHO_CERO = /[​-‍⁠﻿­]/gu;
/** Guiones Unicode que NFKC no lleva a «-» (U+2010, U+2011, U+2012, U+2015, menos U+2212…). */
const GUIONES = /[‐‑‒―−﹘﹣－]/gu;

/** Quita ancho cero, NFKC (fullwidth ７ ⇒ 7, ³⁰ ⇒ 30), dígitos Unicode a ASCII y guiones raros a «-». */
export function normalizar(t: string): string {
  const n = t.replace(ANCHO_CERO, "").normalize("NFKC").replace(GUIONES, "-");
  let out = "";
  for (const ch of n) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if (ES_DIGITO.test(ch)) {
      // Los dígitos Unicode vienen en tiradas consecutivas de diez (0–9).
      let cp = ch.codePointAt(0) as number;
      let k = 0;
      while (ES_DIGITO.test(String.fromCodePoint(cp - 1))) {
        cp--;
        k++;
      }
      out += String(k % 10);
    } else out += ch;
  }
  return out;
}

const norm = (x: string) => String(Number(x.replace(",", ".")));
const borrar = (t: string, desde: number, largo: number) => t.slice(0, desde) + " ".repeat(largo) + t.slice(desde + largo);

function quitar(t: string, re: RegExp, cada?: (m: RegExpMatchArray) => boolean | void): string {
  let w = t;
  for (const m of t.matchAll(new RegExp(re.source, re.flags))) {
    if (cada?.(m) === false) continue; // false = no borrar
    w = borrar(w, m.index as number, m[0].length);
  }
  return w;
}

// ---------------------------------------------------------------------------------
// Plantel y contexto
// ---------------------------------------------------------------------------------

interface Plantel {
  nombres: string[]; // equipos + jugadores, los más largos primero
  equipos: string[];
  equipoDe: Map<string, string>; // jugador → equipo
  /** Formas de nombrar a un equipo → nombre completo: completo, sin prefijo, y prefijo si no es ambiguo. */
  alias: Map<string, string>;
  aliasOrdenados: string[]; // los más largos primero
}

function plantel(p: Partido): Plantel {
  const equipos = [p.config.local.nombre, p.config.visita.nombre];
  const equipoDe = new Map<string, string>();
  for (const lado of ["local", "visita"] as const) for (const j of p.config[lado].jugadores) equipoDe.set(j.nombre, p.config[lado].nombre);
  // Brief 019: las bajas del registro también son nombres del partido (no juegan, pero se nombran).
  for (const lado of ["local", "visita"] as const) for (const b of p.config.bajas?.[lado] ?? []) equipoDe.set(b.jugador, p.config[lado].nombre);
  const nombres = [...equipos, ...equipoDe.keys()].sort((a, b) => b.length - a.length);
  const alias = new Map<string, string>();
  const prefijos = equipos.map((e) => e.split(/\s+/)[0] as string);
  equipos.forEach((e, i) => {
    alias.set(e, e);
    const partes = e.split(/\s+/);
    if (partes.length >= 2) alias.set(partes.slice(1).join(" "), e);
    const pre = prefijos[i] as string;
    if (partes.length >= 2 && prefijos.filter((x) => x === pre).length === 1) alias.set(pre, e); // «Atlético» si no es ambiguo
  });
  return { nombres, equipos, equipoDe, alias, aliasOrdenados: [...alias.keys()].sort((a, b) => b.length - a.length) };
}

interface Contexto {
  hechos: Hecho[];
  todos: Hecho[];
  partido: Partido;
  pl: Plantel;
  numeros: Set<string>;
  nombres: Set<string>; // nombres completos permitidos
  formasCortas: Set<string>; // apellido de un jugador permitido; formas cortas de un equipo permitido
  marcadores: Marcador[];
  periodos: Set<1 | 2>;
  minutos: number[]; // todos los minutos que afirma el principal
  resultado?: { ganador?: string; perdedor?: string; empate: boolean };
}

const fuenteDe = (h: Hecho) => [h.texto_es, h.texto_en, ...Object.values(h.datos).map(String)].join("\n");

function nombresLocalVisita(h: Hecho, partido: Partido): [string, string] {
  const d = h.datos;
  return [typeof d.local === "string" ? d.local : partido.config.local.nombre, typeof d.visita === "string" ? d.visita : partido.config.visita.nombre];
}

export function marcadoresDe(h: Hecho, partido: Partido): Marcador[] {
  const d = h.datos;
  const [local, visita] = nombresLocalVisita(h, partido);
  const out: Marcador[] = [];
  const par = (a: string, b: string, x: unknown, y: unknown) => {
    if (typeof x === "number" && typeof y === "number") out.push({ a, b, x, y });
  };
  par(local, visita, d.goles_local, d.goles_visita);
  par(local, visita, d.marcador_local, d.marcador_visita);
  par(local, visita, d.goles_local_periodo, d.goles_visita_periodo);
  if (typeof d.equipo === "string" && typeof d.rival === "string") {
    par(d.equipo, d.rival, d.desventaja_propios, d.desventaja_rival);
    par(d.equipo, d.rival, d.final_propios, d.final_rival);
  }
  return out;
}

function resultadoDe(h: Hecho, partido: Partido): Contexto["resultado"] {
  const d = h.datos;
  if (h.tipo === "remontada") {
    if (d.desenlace === "victoria") return { ganador: String(d.equipo), perdedor: String(d.rival), empate: false };
    if (d.desenlace === "empate") return { empate: true };
    return undefined;
  }
  let gl: unknown = d.goles_local;
  let gv: unknown = d.goles_visita;
  if (h.tipo === "marcador_por_periodo" && d.periodo === 2) {
    gl = d.marcador_local;
    gv = d.marcador_visita;
  }
  if (!["resultado_final", "justicia_xg", "expulsion_y_efecto", "marcador_por_periodo"].includes(h.tipo)) return undefined;
  if (typeof gl !== "number" || typeof gv !== "number") return undefined;
  const [local, visita] = nombresLocalVisita(h, partido);
  if (gl === gv) return { empate: true };
  return gl > gv ? { ganador: local, perdedor: visita, empate: false } : { ganador: visita, perdedor: local, empate: false };
}

function minutosDe(h: Hecho): number[] {
  const out: number[] = [];
  for (const k of ["minuto", "desde", "hasta", "minuto_desventaja", "minutos"]) {
    const v = h.datos[k];
    if (v === undefined) continue;
    for (const m of String(v).match(/\d+(?:\+\d+)?/g) ?? []) {
      const [base, extra] = m.split("+");
      out.push(Number(base) + Number(extra ?? 0));
    }
  }
  return out;
}

function periodosDe(h: Hecho): (1 | 2)[] {
  const d = h.datos;
  if (d.periodo === 1 || d.periodo === 2) return [d.periodo];
  const out: (1 | 2)[] = [];
  for (const k of ["minuto", "desde", "hasta", "minuto_desventaja", "minutos"]) {
    const v = d[k];
    if (v === undefined) continue;
    for (const m of String(v).match(/\d+(?:\+\d+)?/g) ?? []) {
      const base = Number(m.split("+")[0]);
      if (base <= 45) out.push(1);
      if (base >= 45) out.push(2);
    }
  }
  return out;
}

function contexto(hechos: Hecho[], todos: Hecho[], partido: Partido, pl: Plantel): Contexto {
  const numeros = new Set<string>();
  for (const h of hechos) {
    for (const t of [h.texto_es, h.texto_en]) for (const n of normalizar(t).match(/\d+(?:[.,]\d+)?/g) ?? []) numeros.add(norm(n));
    for (const v of Object.values(h.datos)) {
      if (typeof v === "number") numeros.add(norm(String(v)));
      else for (const n of normalizar(v).match(/\d+(?:[.,]\d+)?/g) ?? []) numeros.add(norm(n));
    }
  }
  const fuente = hechos.map(fuenteDe).join("\n");
  const nombres = new Set(pl.nombres.filter((n) => fuente.includes(n)));
  const formasCortas = new Set<string>();
  for (const n of nombres) {
    if (pl.equipos.includes(n)) {
      for (const [a, e] of pl.alias) if (e === n && a !== n) formasCortas.add(a);
    } else {
      const partes = n.split(/\s+/);
      if (partes.length >= 2) formasCortas.add(partes.slice(1).join(" "));
    }
  }
  const resultado = hechos.map((h) => resultadoDe(h, partido)).find((r) => r !== undefined);
  return {
    hechos,
    todos,
    partido,
    pl,
    numeros,
    nombres,
    formasCortas,
    marcadores: hechos.flatMap((h) => marcadoresDe(h, partido)),
    periodos: new Set(hechos.flatMap(periodosDe)),
    minutos: hechos.flatMap(minutosDe),
    ...(resultado ? { resultado } : {}),
  };
}

/** Goles finales de cada equipo (del hecho resultado_final de la lista completa). */
function finalDe(ctx: Contexto): Map<string, number> | undefined {
  const r = ctx.todos.find((h) => h.tipo === "resultado_final");
  if (!r || typeof r.datos.goles_local !== "number" || typeof r.datos.goles_visita !== "number") return undefined;
  const [local, visita] = nombresLocalVisita(r, ctx.partido);
  return new Map([
    [local, r.datos.goles_local],
    [visita, r.datos.goles_visita],
  ]);
}

/** Equipos para los que el principal afirma algún cero de goles (respalda «A no marcó»). */
function equiposConCero(ctx: Contexto): Set<string> {
  const s = new Set<string>();
  for (const m of ctx.marcadores) {
    if (m.x === 0) s.add(m.a);
    if (m.y === 0) s.add(m.b);
  }
  for (const h of ctx.hechos) {
    const [local, visita] = nombresLocalVisita(h, ctx.partido);
    if (h.datos.goles_despues_local === 0) s.add(local);
    if (h.datos.goles_despues_visita === 0) s.add(visita);
  }
  return s;
}

// ---------------------------------------------------------------------------------
// Análisis de un texto contra su contexto
// ---------------------------------------------------------------------------------

interface Hallazgo {
  regla: Regla;
  detalle: string;
}

interface Analisis {
  hallazgos: Hallazgo[];
  numeros: string[]; // para V6
  narra: boolean;
}

const PUNTUACION_ABRE = new Set([".", "!", "?", ":", ";", "«", '"', "“", "‘", "'", "¿", "¡", "—", "–", "-", "(", "["]);
const NUMEROS_RE: Record<Lengua, RegExp> = { es: palabras([...NUMEROS_EN_PALABRAS.es.keys()]), en: palabras([...NUMEROS_EN_PALABRAS.en.keys()]) };
const CUENTA_RE: Record<Lengua, RegExp> = { es: palabras(Object.keys(CUENTA_GOLES.es)), en: palabras(Object.keys(CUENTA_GOLES.en)) };
const SIEMPRE_RE: Record<Lengua, RegExp> = { es: palabras(FRASES_SIEMPRE.es), en: palabras(FRASES_SIEMPRE.en) };
const INFERIORIDAD_RE: Record<Lengua, RegExp> = { es: palabras(FRASES_INFERIORIDAD.es), en: palabras(FRASES_INFERIORIDAD.en) };
/** Letras que no son de escritura latina (homóglifos cirílicos/griegos, katakana…). */
const NO_LATINA = /(?=\p{L})\P{Script=Latin}/u;

function segmentoDe(t: string, i: number): [number, number] {
  let a = i;
  while (a > 0 && !".;:!?".includes(t[a - 1] as string)) a--;
  let b = i;
  while (b < t.length && !".;:!?".includes(t[b] as string)) b++;
  return [a, b];
}

interface Mencion {
  i: number;
  fin: number;
  equipo: string;
}

/** Menciones de equipo (por cualquier alias) en t[desde, hasta), sin solapes, en orden. */
function menciones(t: string, desde: number, hasta: number, pl: Plantel): Mencion[] {
  const out: Mencion[] = [];
  let v = t;
  for (const a of pl.aliasOrdenados) {
    let i = v.indexOf(a, desde);
    while (i >= 0 && i + a.length <= hasta) {
      const antes = i === 0 ? "" : (v[i - 1] as string);
      const despues = v[i + a.length] ?? "";
      if (!/[\p{L}\p{N}]/u.test(antes) && !/[\p{L}\p{N}]/u.test(despues)) {
        out.push({ i, fin: i + a.length, equipo: pl.alias.get(a) as string });
        v = borrar(v, i, a.length);
      }
      i = v.indexOf(a, i + a.length);
    }
  }
  return out.sort((x, y) => x.i - y.i);
}

/** ¿La palabra inmediatamente anterior a la posición es una preposición? */
function precedidoDePreposicion(t: string, i: number, lengua: Lengua): boolean {
  const previa = t.slice(0, i).match(/(\p{L}+)\s*$/u)?.[1]?.toLowerCase();
  return previa !== undefined && PREPOSICIONES[lengua].has(previa);
}

/**
 * Sujeto de un verbo de resultado (rev. 3.2): la mención de equipo inmediatamente anterior
 * al verbo en su frase que NO esté precedida de preposición («Ante J, A ganó» ⇒ A); si no
 * hay, la primera posterior sin preposición delante.
 */
function sujetoDe(t: string, verbo: number, lengua: Lengua, pl: Plantel): string | undefined {
  const [a, b] = segmentoDe(t, verbo);
  const ms = menciones(t, a, b, pl);
  const antes = ms.filter((m) => m.fin <= verbo).reverse();
  for (const m of antes) if (!precedidoDePreposicion(t, m.i, lengua)) return m.equipo;
  for (const m of ms.filter((m) => m.i > verbo)) if (!precedidoDePreposicion(t, m.i, lengua)) return m.equipo;
  return undefined;
}

function analizarTexto(texto: string, lengua: Lengua, ctx: Contexto, esTitulo: boolean): Analisis {
  const h: Hallazgo[] = [];
  const t0 = normalizar(texto);

  // V4 — escritura: solo letras latinas (cierra homóglifos y escrituras sin mayúsculas)
  const raro = t0.match(NO_LATINA);
  if (raro) h.push({ regla: "V4", detalle: `letra de otra escritura («${raro[0]}»): los nombres y el texto van en alfabeto latino` });

  // V8 — preguntas retóricas y tiempo futuro: una crónica afirma hechos pasados
  if (/[?¿]/.test(t0)) h.push({ regla: "V8", detalle: "pregunta: la crónica afirma hechos, no insinúa" });
  for (const m of t0.matchAll(new RegExp(FUTURO[lengua].source, FUTURO[lengua].flags))) {
    h.push({ regla: "V8", detalle: `tiempo futuro («${m[0]}»): los hechos son pasados` });
  }

  let s = quitar(t0, NEGACIONES_EXCEPTO[lengua]);

  // V8 — afirmaciones computables (antes de V7: «sin recibir goles» se juzga como valla invicta)
  const fin = finalDe(ctx);
  s = quitar(s, GOL_DECISIVO[lengua], (m) => {
    const ok =
      fin !== undefined &&
      ctx.hechos.some((x) => {
        if (x.tipo !== "gol_anotado") return false;
        const equipo = String(x.datos.equipo);
        const rival = [...fin.keys()].find((k) => k !== equipo);
        if (rival === undefined) return false;
        const gEq = fin.get(equipo) as number;
        const gRiv = fin.get(rival) as number;
        if (gEq <= gRiv) return false; // solo el ganador tiene «gol de la victoria»
        const [local] = nombresLocalVisita(x, ctx.partido);
        const marcadorEq = equipo === local ? x.datos.marcador_local : x.datos.marcador_visita;
        return marcadorEq === gRiv + 1;
      });
    if (!ok) h.push({ regla: "V8", detalle: `«${m[0]}»: ese gol no fue el que decidió el partido` });
  });
  // Brief 012 §D — «definitivo / settled the match»: el ÚLTIMO gol del partido y deja al ganador por delante.
  s = quitar(s, GOL_DEFINITIVO[lengua], (m) => {
    const ok =
      fin !== undefined &&
      ctx.hechos.some((x) => {
        if (x.tipo !== "gol_anotado") return false;
        const [local, visita] = nombresLocalVisita(x, ctx.partido);
        const ml = x.datos.marcador_local;
        const mv = x.datos.marcador_visita;
        const gl = fin.get(local);
        const gv = fin.get(visita);
        if (ml !== gl || mv !== gv || gl === undefined || gv === undefined) return false; // no es el último gol
        const equipo = String(x.datos.equipo);
        const ganador = gl > gv ? local : gv > gl ? visita : undefined;
        return ganador !== undefined && ganador === equipo;
      });
    if (!ok) h.push({ regla: "V8", detalle: `«${m[0]}»: ese gol no fue el último del partido dejando al ganador por delante` });
  });
  // Brief 015 — magnitudes del tiro computables.
  s = quitar(s, FUERA_DEL_AREA[lengua], (m) => {
    if (!ctx.hechos.some((x) => typeof x.datos.distancia_m === "number" && x.datos.distancia_m >= FUERA_DEL_AREA_M))
      h.push({ regla: "V8", detalle: `«${m[0]}»: el hecho no registra un tiro desde ${FUERA_DEL_AREA_M} m o más` });
  });
  s = quitar(s, MISIL[lengua], (m) => {
    if (!ctx.hechos.some((x) => typeof x.datos.velocidad_kmh === "number" && x.datos.velocidad_kmh >= MISIL_KMH))
      h.push({ regla: "V8", detalle: `«${m[0]}»: el hecho no registra un disparo de ${MISIL_KMH} km/h o más` });
  });
  s = quitar(s, VALLA_INVICTA[lengua], (m) => {
    const equipos = ctx.hechos.map((x) => x.datos.equipo).filter((x): x is string => typeof x === "string");
    const [a, b] = segmentoDe(s, m.index as number);
    const equipo = equipos[0] ?? menciones(s, a, b, ctx.pl)[0]?.equipo;
    const rival = equipo && fin ? [...fin.keys()].find((k) => k !== equipo) : undefined;
    if (!(fin && rival !== undefined && fin.get(rival) === 0)) h.push({ regla: "V8", detalle: `«${m[0]}»: ${equipo ?? "el equipo"} recibió goles` });
  });
  // Brief 018 — el color de las condiciones, solo con su efecto medido como principal (antes de
  // V7: «nunca se acomodó / never settled» describe la medición, no niega un suceso).
  for (const e of [...EFECTOS_CONDICION, ...CONSECUENCIAS]) {
    s = quitar(s, e[lengua], (m) => {
      if (!ctx.hechos.some((x) => e.habilita(x, marcadoresDe(x, ctx.partido)))) h.push({ regla: "V8", detalle: `«${m[0]}»: ${e.requisito}` });
    });
  }
  for (const f of FRANJAS) {
    s = quitar(s, f[lengua], (m) => {
      const ms = ctx.minutos;
      const ok =
        ms.length > 0 &&
        ms.every((x) =>
          f.id === "tras_descanso" ? x > MINUTO_DESCANSO : f.id === "final" ? x >= FINAL_MIN : f.id === "temprano" ? x <= TEMPRANO_MAX : x > 90,
        );
      if (!ok) h.push({ regla: "V8", detalle: `«${m[0]}» no coincide con los minutos del hecho (${ms.join(", ") || "sin minutos"})` });
    });
  }

  // V7 — negaciones (con respaldo para negaciones de goles)
  const ceros = equiposConCero(ctx);
  const negar = (re: RegExp) => {
    s = quitar(s, re, (m) => {
      const i = m.index as number;
      const ventana = s.slice(i, i + m[0].length + 40);
      const deGoles = RAICES_GOL[lengua].test(ventana);
      if (deGoles) {
        const [a, b] = segmentoDe(s, i);
        const despues = menciones(s, i, Math.min(b, i + m[0].length + 40), ctx.pl)[0];
        const antes = menciones(s, a, i, ctx.pl).pop();
        const equipo = (despues ?? antes)?.equipo;
        if (equipo !== undefined && ceros.has(equipo)) return; // respaldada: se acepta y se borra
      }
      h.push({ regla: "V7", detalle: `niega un suceso («${m[0]}»): ningún hecho afirma esa ausencia` });
    });
  };
  negar(NEGACIONES[lengua]);
  negar(NEGACION_FREE);

  // V8 — verbos de resultado: pasiva primero (el sujeto pierde), luego activa
  const verbos = VERBOS_RESULTADO[lengua];
  const r = ctx.resultado;
  const juzgar = (clase: "gana" | "pierde" | "empata", m: RegExpMatchArray, texto: string) => {
    const sujeto = sujetoDe(texto, m.index as number, lengua, ctx.pl);
    // Brief 012 §C: con un GOL como principal, «empató / equalised» es computable: el marcador
    // tras ese gol (datos del hecho) queda igualado.
    const empateDeGol = ctx.hechos.some((x) => x.tipo === "gol_anotado" && typeof x.datos.marcador_local === "number" && x.datos.marcador_local === x.datos.marcador_visita);
    const ok =
      clase === "empata"
        ? (r !== undefined && r.empate) || empateDeGol
        : r !== undefined && !r.empate && sujeto !== undefined && sujeto === (clase === "gana" ? r.ganador : r.perdedor);
    if (!ok) h.push({ regla: "V8", detalle: `«${m[0]}»${sujeto ? ` con sujeto ${sujeto}` : ""} no coincide con el resultado que afirma el hecho` });
  };
  let sv = quitar(s, verbos.excepto);
  sv = quitar(sv, verbos.pasiva, (m) => juzgar("pierde", m, sv));
  for (const [clase, re] of [["gana", verbos.gana], ["pierde", verbos.pierde], ["empata", verbos.empata]] as const) {
    for (const m of sv.matchAll(new RegExp(re.source, re.flags))) juzgar(clase, m, sv);
  }

  // Frases fijas (se quitan antes de contar números)
  let w = quitar(s, SIEMPRE_RE[lengua]);
  for (const [frase, p] of FRASES_PERIODO[lengua]) {
    w = quitar(w, palabras([frase]), (m) => {
      if (!ctx.periodos.has(p)) h.push({ regla: "V3", detalle: `«${m[0]}» no coincide con el periodo del hecho` });
    });
  }
  w = quitar(w, INFERIORIDAD_RE[lengua], (m) => {
    if (!ctx.hechos.some((x) => x.tipo === "expulsion_y_efecto")) h.push({ regla: "V8", detalle: `«${m[0]}» exige una expulsión como hecho principal` });
  });

  // V8 — canal computable (brief 013): el canal nombrado tiene que ser el del hecho principal.
  for (const [canal, re] of FRASES_CANAL[lengua]) {
    w = quitar(w, re, (m) => {
      if (!ctx.hechos.some((x) => x.datos.canal === canal)) h.push({ regla: "V8", detalle: `«${m[0]}»: el hecho principal no afirma ese canal (${canal})` });
    });
  }

  // V8 — tabla de juicio y muletillas
  for (const e of JUICIO) {
    w = quitar(w, e[lengua], (m) => {
      if (!ctx.hechos.some((x) => e.habilita(x, marcadoresDe(x, ctx.partido)))) h.push({ regla: "V8", detalle: `«${m[0]}»: ${e.requisito}` });
    });
  }

  // V3 — margen
  for (const re of MARGEN[lengua]) {
    w = quitar(w, re, (m) => {
      const v = valorMargen(m[1] ?? "", lengua);
      if (v === undefined || !ctx.marcadores.some((mk) => Math.abs(mk.x - mk.y) === v)) {
        h.push({ regla: "V3", detalle: `el margen «${m[0]}» no es la diferencia de ningún marcador del hecho` });
      }
    });
  }

  // V3 — marcadores «A x–y B», «A x a y B», «A x to y B» (rev. 3.2: todos orientables)
  const conector = lengua === "es" ? "a" : "to";
  // Los números de un marcador no pueden ser parte de un decimal («1.75 to 2.45» no es «75 to 2»).
  for (const m of w.matchAll(new RegExp(`(?<![\\d.,])(\\d+)(?:\\s*[–—-]\\s*|\\s+${conector}\\s+)(\\d+)(?![.,]?\\d)`, "gu"))) {
    const x = Number(m[1]);
    const y = Number(m[2]);
    if (x > MARCADOR_MAX_GOLES || y > MARCADOR_MAX_GOLES) continue;
    const i = m.index as number;
    const antes = w.slice(0, i).trimEnd();
    const despues = w.slice(i + m[0].length).trimStart();
    const A = ctx.pl.aliasOrdenados.find((n) => antes.endsWith(n) && !/[\p{L}]/u.test(antes[antes.length - n.length - 1] ?? ""));
    const B = ctx.pl.aliasOrdenados.find((n) => despues.startsWith(n) && !/[\p{L}]/u.test(despues[n.length] ?? ""));
    const eA = A ? ctx.pl.alias.get(A) : undefined;
    const eB = B ? ctx.pl.alias.get(B) : undefined;
    const ok =
      eA && eB
        ? ctx.marcadores.some((mk) => (mk.a === eA && mk.b === eB && mk.x === x && mk.y === y) || (mk.a === eB && mk.b === eA && mk.x === y && mk.y === x))
        : ctx.marcadores.some((mk) => (mk.x === x && mk.y === y) || (mk.x === y && mk.y === x));
    if (!ok) h.push({ regla: "V3", detalle: `el marcador «${eA ? `${eA} ` : ""}${x}–${y}${eB ? ` ${eB}` : ""}» no es uno que el hecho afirme` });
  }

  // Números: cuentas de goles, palabras numéricas, dígitos
  const numeros: string[] = [];
  w = quitar(w, CUENTA_RE[lengua], (m) => {
    const v = CUENTA_GOLES[lengua][m[0].toLowerCase().replace(/\s+/g, " ")] as number;
    numeros.push(String(v));
    if (!ctx.hechos.some((x) => x.tipo === "doblete_o_mas" && x.datos.goles === v)) {
      h.push({ regla: "V3", detalle: `«${m[0]}» (${v} goles) no lo respalda un doblete_o_mas con ${v} goles` });
    }
  });
  w = quitar(w, NUMEROS_RE[lengua], (m) => {
    const v = NUMEROS_EN_PALABRAS[lengua].get(m[0].toLowerCase().replace(/\s+/g, " ").replace(/\s*-\s*/g, "-"));
    if (v !== undefined) numeros.push(String(v));
  });
  for (const m of w.matchAll(/\d+(?:[.,]\d+)?/g)) numeros.push(norm(m[0]));
  for (const n of new Set(numeros)) {
    if (!ctx.numeros.has(n)) h.push({ regla: "V3", detalle: `el número ${n} no está en el hecho` });
  }

  // V4 — nombres
  let nombrados = 0;
  let v = quitar(w, GRADOS_C); // brief 018: la unidad no es un nombre
  for (const n of ctx.pl.nombres) {
    let i = v.indexOf(n);
    while (i >= 0) {
      if (!ctx.nombres.has(n)) h.push({ regla: "V4", detalle: `«${n}» no pertenece al hecho` });
      else nombrados++;
      v = borrar(v, i, n.length);
      i = v.indexOf(n, i + n.length);
    }
  }
  // «Jugador (Equipo)»: el equipo entre paréntesis debe ser el del jugador
  for (const m of t0.matchAll(/([^()]+?)\s*\(([^()]+)\)/g)) {
    const equipo = ctx.pl.alias.get((m[2] as string).trim());
    if (!equipo) continue;
    const tramo = (m[1] as string).split(/[;:,.]/).pop() as string;
    for (const parte of tramo.split(" / ")) {
      const jugador = [...ctx.pl.equipoDe.keys()].filter((n) => parte.trim().endsWith(n)).sort((a, b) => b.length - a.length)[0];
      if (jugador && ctx.pl.equipoDe.get(jugador) !== equipo) h.push({ regla: "V4", detalle: `«${jugador} (${equipo})»: ${jugador} juega en ${ctx.pl.equipoDe.get(jugador)}` });
    }
  }
  // Palabras con mayúscula (o titlecase, ǅ) restantes
  const corto = [...ctx.formasCortas].sort((a, b) => b.split(" ").length - a.split(" ").length);
  for (const m of v.matchAll(/(?<![\p{L}\p{N}'’-])[\p{Lu}\p{Lt}][\p{L}'’-]*(?:[ \t]+[\p{Lu}\p{Lt}][\p{L}'’-]*)*/gu)) {
    const tokens = m[0].split(/[ \t]+/).map((x) => x.replace(/['’]s$/u, "").replace(/['’]$/u, ""));
    const previo = v.slice(0, m.index as number).trimEnd();
    const abre = previo === "" || PUNTUACION_ABRE.has(previo[previo.length - 1] as string);
    let k = 0;
    while (k < tokens.length) {
      const forma = corto.find((c) => {
        const cs = c.split(" ");
        return cs.every((x, j) => tokens[k + j] === x);
      });
      if (forma) {
        nombrados++;
        k += forma.split(" ").length;
        continue;
      }
      const tok = tokens[k] as string;
      const bajo = tok.toLowerCase();
      const funcional = FUNCIONALES[lengua].has(tok) || NUMEROS_EN_PALABRAS[lengua].has(bajo);
      if ((k === 0 && abre && funcional) || (esTitulo && lengua === "en" && (TITULO_EN_COMUNES.has(bajo) || FUNCIONALES.en.has(tok)))) {
        k++;
        continue;
      }
      h.push({ regla: "V4", detalle: `«${tokens.slice(k).join(" ")}» no es un nombre del hecho ni una palabra permitida` });
      break;
    }
  }

  const narra = nombrados > 0 || numeros.some((n) => ctx.numeros.has(n));
  return { hallazgos: h, numeros, narra };
}

// ---------------------------------------------------------------------------------
// Verificación
// ---------------------------------------------------------------------------------

export interface Veredicto {
  draft: CronicaDraft | null;
  motivos: Motivo[];
}

/** Lee la salida del LLM. Devuelve null si no es JSON con el esquema (V1). */
export function parsear(salida: string): { draft: CronicaDraft | null; error?: string } {
  let t = salida.trim();
  const fence = t.match(/^```(?:json)?\s*\n([\s\S]*)\n```$/);
  if (fence) t = (fence[1] as string).trim();
  let json: unknown;
  try {
    json = JSON.parse(t);
  } catch (e) {
    return { draft: null, error: `no es JSON: ${(e as Error).message}` };
  }
  const r = esquemaDraft.safeParse(json);
  if (!r.success) return { draft: null, error: `no cumple el esquema: ${r.error.issues.map((i) => `${i.path.join(".") || "(raíz)"} ${i.message}`).join("; ")}` };
  return { draft: r.data as CronicaDraft };
}

function verificarPar(oracion: number, prefijo: string, es: string, en: string, ctx: Contexto, esTitulo: boolean): { motivos: Motivo[]; narra: boolean } {
  const motivos: Motivo[] = [];
  const add = (regla: Regla, detalle: string) => motivos.push({ oracion, regla, detalle: `${prefijo}${detalle}` });
  if (es.trim() === "" || en.trim() === "") {
    add("V6", `${es.trim() === "" ? "el texto en español" : "el texto en inglés"} está vacío`);
    return { motivos, narra: false };
  }
  const aes = analizarTexto(es, "es", ctx, esTitulo);
  const aen = analizarTexto(en, "en", ctx, esTitulo);
  const vistos = new Set<string>();
  for (const [lengua, a] of [["ES", aes], ["EN", aen]] as const) {
    for (const x of a.hallazgos) {
      const clave = `${x.regla}|${x.detalle}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      add(x.regla, `${x.detalle} (${lengua})`);
    }
  }
  const nes = [...aes.numeros].sort();
  const nen = [...aen.numeros].sort();
  if (nes.join(" ") !== nen.join(" ")) add("V6", `cifras ES [${nes.join(", ")}] ≠ EN [${nen.join(", ")}]`);
  return { motivos, narra: aes.narra && aen.narra };
}

/** Hechos contra los que se verifica el título: el resultado final + los de los jugadores que nombra. */
function hechosDelTitulo(draft: CronicaDraft, hechos: Hecho[], pl: Plantel): Hecho[] {
  const titulo = normalizar(`${draft.titulo_es}\n${draft.titulo_en}`);
  const jugadores = [...pl.equipoDe.keys()].filter((n) => titulo.includes(n) || titulo.includes(n.split(" ").slice(1).join(" ")));
  const out = hechos.filter((h) => h.tipo === "resultado_final");
  for (const h of hechos) if (!out.includes(h) && jugadores.some((j) => fuenteDe(h).includes(j))) out.push(h);
  return out;
}

/** Verifica un borrador ya parseado. */
export function verificarDraft(draft: CronicaDraft, hechos: Hecho[], partido: Partido): Motivo[] {
  const motivos: Motivo[] = [];
  const pl = plantel(partido);
  const porId = new Map(hechos.map((h) => [h.id, h] as const));

  // Título
  motivos.push(...verificarPar(-1, "título: ", draft.titulo_es, draft.titulo_en, contexto(hechosDelTitulo(draft, hechos, pl), hechos, partido, pl), true).motivos);
  motivos.push(...verificarOraciones(draft.oraciones, hechos, partido));
  motivos.push(...cobertura(draft.oraciones, hechos));
  return motivos;
}

/**
 * Las reglas por oración (V2–V8 y que cada oración narre a su principal), sin título ni
 * cobertura global. La comparten la crónica completa y las actualizaciones en vivo (008):
 * el MISMO Verificador.
 */
export function verificarOraciones(oraciones: Oracion[], hechos: Hecho[], partido: Partido): Motivo[] {
  const motivos: Motivo[] = [];
  const pl = plantel(partido);
  const porId = new Map(hechos.map((h) => [h.id, h] as const));
  oraciones.forEach((o: Oracion, i) => {
    // V2
    if (o.hecho.trim() === "") {
      motivos.push({ oracion: i, regla: "V2", detalle: "no tiene hecho principal" });
    } else if (!porId.has(o.hecho)) {
      motivos.push({ oracion: i, regla: "V2", detalle: `su hecho principal ${o.hecho} no existe` });
    }
    for (const id of o.apoyo ?? []) if (!porId.has(id)) motivos.push({ oracion: i, regla: "V2", detalle: `cita de apoyo ${id}, que no existe` });
    const principal = porId.get(o.hecho);
    const ctx = contexto(principal ? [principal] : [], hechos, partido, pl);
    const r = verificarPar(i, "", o.texto_es, o.texto_en, ctx, false);
    motivos.push(...r.motivos);
    // V5 — narra a su principal
    if (principal && !r.narra && !r.motivos.some((m) => m.regla === "V6")) {
      motivos.push({ oracion: i, regla: "V5", detalle: `no narra su hecho principal ${principal.id} (no nombra a nadie ni dice ninguna cifra suya)` });
    }
  });
  return motivos;
}

// ---------------------------------------------------------------------------------
// Brief 008 — actualizaciones en vivo
// ---------------------------------------------------------------------------------

export const esquemaUpdate = (maxOraciones: number) =>
  z.object({ oraciones: z.array(esquemaOracion).min(1).max(maxOraciones) });

/**
 * Verifica una actualización en vivo: el MISMO Verificador por oración (V2–V8) contra los
 * hechos del PREFIJO del partido, más las reglas propias de una actualización:
 * 1–`maxOraciones` oraciones (V1) y la primera narra como principal el hecho del momento
 * que la dispara (V5: la cobertura de crónica completa no aplica aquí).
 * Sin clarividencia por construcción: los únicos hechos citables son los del prefijo.
 */
export function verificarUpdate(
  salida: string,
  hechosPrefijo: Hecho[],
  partido: Partido,
  hechoMomento: string,
  maxOraciones: number,
  opciones: { final?: boolean } = {},
): { oraciones: Oracion[] | null; motivos: Motivo[] } {
  let t = salida.trim();
  const fence = t.match(/^```(?:json)?\s*\n([\s\S]*)\n```$/);
  if (fence) t = (fence[1] as string).trim();
  let json: unknown;
  try {
    json = JSON.parse(t);
  } catch (e) {
    return { oraciones: null, motivos: [{ oracion: -1, regla: "V1", detalle: `no es JSON: ${(e as Error).message}` }] };
  }
  const r = esquemaUpdate(maxOraciones).safeParse(json);
  if (!r.success) {
    return {
      oraciones: null,
      motivos: [{ oracion: -1, regla: "V1", detalle: `no cumple el esquema de actualización (1–${maxOraciones} oraciones): ${r.error.issues.map((i) => `${i.path.join(".") || "(raíz)"} ${i.message}`).join("; ")}` }],
    };
  }
  const oraciones = r.data.oraciones as Oracion[];
  const motivos = verificarOraciones(oraciones, hechosPrefijo, partido);
  // F1 del 008: en vivo, ningún balance de lo que pasó «después» (el partido sigue).
  oraciones.forEach((o, i) => {
    for (const [lengua, texto] of [["es", o.texto_es], ["en", o.texto_en]] as const) {
      const m = texto.match(new RegExp(BALANCE_POSTERIOR[lengua].source, "iu"));
      if (m) motivos.push({ oracion: i, regla: "V7", detalle: `balance posterior en vivo («${m[0]}»): el partido sigue y ese balance afirmaría una ausencia que nadie conoce todavía (${lengua.toUpperCase()})` });
    }
  });
  // Brief 012 §A1: antes del final nada está terminado ni decidido (ES y EN por separado).
  if (opciones.final !== true) {
    oraciones.forEach((o, i) => {
      for (const [lengua, texto] of [["es", o.texto_es], ["en", o.texto_en]] as const) {
        const limpio = texto.replace(new RegExp(CIERRE_EN_VIVO_EXCEPTO[lengua].source, "giu"), " ");
        const m = limpio.match(new RegExp(CIERRE_EN_VIVO[lengua].source, "iu"));
        if (m) motivos.push({ oracion: i, regla: "V8", detalle: `cierre en vivo («${m[0]}»): antes del final el partido no está terminado ni decidido (${lengua.toUpperCase()})` });
      }
    });
  }
  if (oraciones[0]?.hecho !== hechoMomento) {
    motivos.push({ oracion: 0, regla: "V5", detalle: `la actualización debe narrar primero el hecho de su momento (${hechoMomento})` });
  }
  return { oraciones, motivos };
}

/** V5 — narración obligatoria: todo hecho requerido es el PRINCIPAL de alguna oración. */
export function cobertura(oraciones: Oracion[], hechos: Hecho[]): Motivo[] {
  const narrados = new Set(oraciones.map((o) => o.hecho));
  return hechos
    .filter((h) => h.relevancia >= COBERTURA && !narrados.has(h.id))
    .map((h) => ({
      oracion: -1,
      regla: "V5" as const,
      detalle: `ninguna oración narra ${h.id} (${h.tipo}, relevancia ${h.relevancia}) como hecho principal`,
    }));
}

/** Verifica la salida cruda del LLM: V1, y si parsea, V2–V8. */
export function verificar(salida: string, hechos: Hecho[], partido: Partido): Veredicto {
  const { draft, error } = parsear(salida);
  if (!draft) return { draft: null, motivos: [{ oracion: -1, regla: "V1", detalle: error ?? "salida ilegible" }] };
  return { draft, motivos: verificarDraft(draft, hechos, partido) };
}

/** Índices de oraciones con algún motivo propio. */
export function oracionesRechazadas(motivos: Motivo[]): Set<number> {
  return new Set(motivos.filter((m) => m.oracion >= 0).map((m) => m.oracion));
}

/** ¿Algún motivo afecta al título? */
export function tituloRechazado(motivos: Motivo[]): boolean {
  return motivos.some((m) => m.oracion === -1 && m.detalle.startsWith("título: "));
}

/** Números de un texto (para pruebas y diagnóstico): dígitos, palabras, ordinales, cuentas. */
export function numeros(texto: string, lengua: Lengua): string[] {
  const partidoVacio = { config: { seed: 0, local: { nombre: "", jugadores: [] }, visita: { nombre: "", jugadores: [] } }, eventos: [] } as unknown as Partido;
  const vacio: Contexto = {
    hechos: [],
    todos: [],
    partido: partidoVacio,
    pl: { nombres: [], equipos: [], equipoDe: new Map(), alias: new Map(), aliasOrdenados: [] },
    numeros: new Set(),
    nombres: new Set(),
    formasCortas: new Set(),
    marcadores: [],
    periodos: new Set([1, 2]),
    minutos: [],
  };
  return analizarTexto(texto, lengua, vacio, false).numeros;
}
