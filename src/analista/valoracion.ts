// Valoración de jugadores (brief 009): nota de partido 1–10 por jugador, computada
// deterministamente desde los eventos y explicable — cada delta del desglose cita un
// evento real. Función pura de los eventos vistos: en el replay (008) la nota al minuto M
// es `valorar` sobre el prefijo, sin nada del futuro.
//
// Decisiones del implementador (para Fable):
// - Participación: se valora a quien aparece como `jugador` en algún evento (incluye el
//   suplente que entra por `cambio` y el que solo tiró desviado: nota base, desglose vacío),
//   al POR titular, y a todo portero que estuvo en el arco en una atajada o un gol recibido.
//   El que solo SALE en un cambio (`sale`) no cuenta como participación.
// - «Córner forzado» va al jugador que nombra el evento `corner` (el simulador nombra al
//   lanzador; es el único jugador que el evento vincula).
// - «Tiro a puerta (atajado)»: el tiro que tiene una atajada colgada (relacionadoCon). El
//   tiro que termina en gol suma por el gol, no además como tiro.
// - Portero en el arco: la misma regla del Analista (POR titular; un cambio cuyo `sale` es
//   el portero pone al que entra; tras una roja al portero no hay portero identificable y
//   nadie recibe esas atajadas ni esos goles).
// - Atajada: dos entradas sobre el MISMO evento: +atajada y +xG del tiro ×factor.
// - Figura: la mayor nota; desempate por más delta positivo de goles, luego índice en la
//   plantilla, luego local antes que visita. Si la mayor nota tiene el desglose vacío
//   (nadie hizo nada medible), no hay figura: no se inventa.

import type { Evento, Lado, Partido, Posicion } from "../sim/tipos";
import { VALORACION } from "./umbrales";

export type MotivoValoracion =
  | "gol"
  | "gol_dificil"
  | "tiro_atajado"
  | "pase_clave"
  | "corner"
  | "amarilla"
  | "roja"
  | "falta"
  | "fuera_de_juego"
  | "atajada"
  | "xg_atajado"
  | "gol_recibido";

export interface EntradaDesglose {
  evento: string; // ID de un evento real del partido
  delta: number; // con signo, dos decimales
  motivo: MotivoValoracion;
}

export interface Valoracion {
  jugador: string;
  equipo: string; // nombre del equipo
  lado: Lado;
  posicion: Posicion;
  nota: number; // [min, max], un decimal
  desglose: EntradaDesglose[]; // en orden del stream
}

const LADOS: readonly Lado[] = ["local", "visita"];
const rival = (l: Lado): Lado => (l === "local" ? "visita" : "local");
const cent = (x: number) => Math.round(x * 100);

/** Pesos en centésimas (se suman enteros). */
const C = {
  gol: cent(VALORACION.gol),
  gol_dificil: cent(VALORACION.gol_dificil),
  gol_dificil_xg_max: cent(VALORACION.gol_dificil_xg_max),
  tiro_atajado: cent(VALORACION.tiro_atajado),
  pase_clave: cent(VALORACION.pase_clave),
  corner: cent(VALORACION.corner),
  amarilla: cent(VALORACION.amarilla),
  roja: cent(VALORACION.roja),
  falta: cent(VALORACION.falta),
  fuera_de_juego: cent(VALORACION.fuera_de_juego),
  atajada: cent(VALORACION.atajada),
  gol_recibido: cent(VALORACION.gol_recibido),
};

/**
 * Portero en el arco de cada equipo ANTES de cada evento (por índice del stream):
 * - arranca el POR titular;
 * - un cambio cuyo `sale` es el portero pone en el arco al que entra;
 * - una roja al portero deja el arco sin portero identificable (undefined);
 * - con el arco sin portero identificable, si entra un jugador de posición POR, ese es el portero.
 */
export function porteros(p: Partido): Record<Lado, (string | undefined)[]> {
  const posicion = new Map<string, string>();
  for (const lado of LADOS) for (const j of p.config[lado].jugadores) posicion.set(`${lado}|${j.nombre}`, j.posicion);
  const actual: Record<Lado, string | undefined> = {
    local: p.config.local.jugadores.slice(0, 11).find((j) => j.posicion === "POR")?.nombre,
    visita: p.config.visita.jugadores.slice(0, 11).find((j) => j.posicion === "POR")?.nombre,
  };
  const out: Record<Lado, (string | undefined)[]> = { local: [], visita: [] };
  for (const e of p.eventos) {
    for (const lado of LADOS) out[lado].push(actual[lado]);
    if (e.tipo === "cambio" && e.jugador !== undefined) {
      const entraPortero = posicion.get(`${e.equipo}|${e.jugador}`) === "POR";
      if (e.sale !== undefined && e.sale === actual[e.equipo]) actual[e.equipo] = e.jugador;
      else if (actual[e.equipo] === undefined && entraPortero) actual[e.equipo] = e.jugador;
    }
    if (e.tipo === "tarjeta_roja" && e.jugador !== undefined && e.jugador === actual[e.equipo]) actual[e.equipo] = undefined;
  }
  return out;
}

/** Nota desde la suma del desglose (centésimas enteras), acotada y redondeada a un decimal. */
export function notaDe(desglose: readonly EntradaDesglose[]): number {
  const total = cent(VALORACION.base) + desglose.reduce((s, d) => s + cent(d.delta), 0);
  const decimas = Math.round(total / 10);
  return Math.min(cent(VALORACION.max) / 10, Math.max(cent(VALORACION.min) / 10, decimas)) / 10;
}

/** Nota con un decimal siempre («7.0», no «7»): así la dice el texto y la verifica V3. */
export const notaTxt = (n: number) => n.toFixed(1);

/** Valoraciones del partido (o del prefijo visto): local primero, en orden de plantilla. */
export function valorar(p: Partido): Valoracion[] {
  const gk = porteros(p);
  const ev = p.eventos;
  const porId = new Map(ev.map((e) => [e.id, e] as const));
  const atajados = new Set(ev.filter((e) => e.tipo === "atajada" && e.relacionadoCon).map((e) => e.relacionadoCon as string));
  const desglose = new Map<string, EntradaDesglose[]>(); // clave lado|nombre
  const participa = new Set<string>();
  const poner = (lado: Lado, jugador: string | undefined, e: Evento, centesimas: number, motivo: MotivoValoracion) => {
    if (!jugador) return;
    const k = `${lado}|${jugador}`;
    participa.add(k);
    desglose.set(k, [...(desglose.get(k) ?? []), { evento: e.id, delta: centesimas / 100, motivo }]);
  };

  for (const lado of LADOS) {
    const por = p.config[lado].jugadores.slice(0, 11).find((j) => j.posicion === "POR");
    if (por) participa.add(`${lado}|${por.nombre}`);
  }

  ev.forEach((e, i) => {
    if (e.jugador !== undefined) participa.add(`${e.equipo}|${e.jugador}`);
    switch (e.tipo) {
      case "gol": {
        poner(e.equipo, e.jugador, e, C.gol, "gol");
        const xg = cent(e.xg ?? porId.get(e.relacionadoCon ?? "")?.xg ?? 0);
        if (xg < C.gol_dificil_xg_max) poner(e.equipo, e.jugador, e, C.gol_dificil, "gol_dificil");
        poner(rival(e.equipo), gk[rival(e.equipo)][i], e, C.gol_recibido, "gol_recibido");
        break;
      }
      case "tiro":
        if (atajados.has(e.id)) poner(e.equipo, e.jugador, e, C.tiro_atajado, "tiro_atajado");
        break;
      case "atajada": {
        // La atajada lleva el equipo del TIRADOR (contrato 001): ataja el portero rival.
        const portero = gk[rival(e.equipo)][i];
        poner(rival(e.equipo), portero, e, C.atajada, "atajada");
        const xg = cent((porId.get(e.relacionadoCon ?? "")?.xg ?? 0) * VALORACION.xg_atajado_factor);
        if (xg !== 0) poner(rival(e.equipo), portero, e, xg, "xg_atajado");
        break;
      }
      case "pase_clave":
        poner(e.equipo, e.jugador, e, C.pase_clave, "pase_clave");
        break;
      case "corner":
        poner(e.equipo, e.jugador, e, C.corner, "corner");
        break;
      case "tarjeta_amarilla":
        poner(e.equipo, e.jugador, e, C.amarilla, "amarilla");
        break;
      case "tarjeta_roja":
        poner(e.equipo, e.jugador, e, C.roja, "roja");
        break;
      case "falta":
        poner(e.equipo, e.jugador, e, C.falta, "falta");
        break;
      case "fuera_de_juego":
        poner(e.equipo, e.jugador, e, C.fuera_de_juego, "fuera_de_juego");
        break;
      default:
        break;
    }
  });

  const out: Valoracion[] = [];
  for (const lado of LADOS) {
    for (const j of p.config[lado].jugadores) {
      const k = `${lado}|${j.nombre}`;
      if (!participa.has(k)) continue;
      const d = desglose.get(k) ?? [];
      out.push({ jugador: j.nombre, equipo: p.config[lado].nombre, lado, posicion: j.posicion, nota: notaDe(d), desglose: d });
    }
  }
  return out;
}

/** Delta positivo de goles (gol + definición difícil), en centésimas: primer desempate de la figura. */
const deltaGoles = (v: Valoracion) => v.desglose.filter((d) => d.motivo === "gol" || d.motivo === "gol_dificil").reduce((s, d) => s + cent(d.delta), 0);

/** La figura del partido, o undefined si nadie tiene un desglose que la respalde. */
export function figura(p: Partido, valoraciones: Valoracion[] = valorar(p)): Valoracion | undefined {
  const indice = (v: Valoracion) => p.config[v.lado].jugadores.findIndex((j) => j.nombre === v.jugador);
  const orden = [...valoraciones].sort(
    (a, b) => b.nota - a.nota || deltaGoles(b) - deltaGoles(a) || indice(a) - indice(b) || (a.lado === b.lado ? 0 : a.lado === "local" ? -1 : 1),
  );
  const top = orden[0];
  return top && top.desglose.length > 0 ? top : undefined;
}
