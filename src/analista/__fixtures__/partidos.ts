// Fixtures del Analista: partidos pequeños construidos a mano (brief 002).
// Cada uno dispara un tipo de hecho o su caso borde. Devuelven el Partido y los IDs
// de los eventos que las pruebas esperan ver citados.
// Los minutos de los casos borde se derivan de umbrales.ts (nunca se repiten a mano).

import type { Partido } from "../../sim/tipos";
import {
  DISCIPLINA_AMARILLAS_MIN,
  DOBLETE_MIN_GOLES,
  DOMINIO_PORCENTAJE_MIN,
  GOL_TARDIO_DESPUES_DE,
  GOL_TEMPRANO_ANTES_DE,
  PORTERO_ATAJADAS_MIN,
  PORTERO_XG_ATAJADO_MIN_CENTESIMAS,
  PRESION_TIROS_MIN,
  PRESION_VENTANA_MINUTOS,
  PRESION_XG_MIN_CENTESIMAS,
} from "../umbrales";
import { Constructor } from "./constructor";

export interface Fixture {
  partido: Partido;
  ids: Record<string, string[]>;
}

/** 2–1 sin sobresaltos: L 20', V 50', L 70'. Sin roja, sin remontada. */
export function basico(): Fixture {
  const b = new Constructor().abrir();
  const g1 = b.gol(20, "local", 9);
  b.descanso();
  const g2 = b.gol(50, "visita", 9);
  const g3 = b.gol(70, "local", 8);
  const p = b.cerrar();
  const fines = p.eventos.filter((e) => e.tipo === "fin_periodo").map((e) => e.id);
  return { partido: p, ids: { goles: [g1, g2, g3], fines } };
}

/** 0–2 al descanso y 3–2 final: remontada con victoria del local. */
export function remontadaVictoria(): Fixture {
  const b = new Constructor().abrir();
  const v1 = b.gol(10, "visita", 9);
  const v2 = b.gol(30, "visita", 8);
  b.descanso();
  const l1 = b.gol(50, "local", 9);
  const l2 = b.gol(60, "local", 8);
  const l3 = b.gol(80, "local", 10);
  return { partido: b.cerrar(), ids: { desventaja: [v1, v2], remontada: [l1, l2, l3] } };
}

/** Caso borde: 0–1 y 1–1 final. La remontada que termina en empate SÍ emite. */
export function remontadaEmpate(): Fixture {
  const b = new Constructor().abrir();
  const v1 = b.gol(30, "visita", 9);
  b.descanso();
  const l1 = b.gol(70, "local", 9);
  return { partido: b.cerrar(), ids: { goles: [v1, l1] } };
}

/**
 * Sin remontada: el visitante empata 1–1 pero pierde 2–1 (estuvo abajo y terminó
 * perdiendo); el local nunca estuvo abajo.
 */
export function sinRemontada(): Fixture {
  const b = new Constructor().abrir();
  b.gol(10, "local", 9);
  b.gol(20, "visita", 9);
  b.gol(30, "local", 8);
  b.descanso();
  return { partido: b.cerrar(), ids: {} };
}

/** Doblete exacto (DOBLETE_MIN_GOLES goles) de un jugador y un gol suelto de otro. */
export function dobleteExacto(): Fixture {
  const b = new Constructor().abrir();
  const goles: string[] = [];
  for (let k = 0; k < DOBLETE_MIN_GOLES; k++) goles.push(b.gol(15 + 10 * k, "local", 9));
  const suelto = b.gol(40, "local", 8);
  b.descanso();
  return { partido: b.cerrar(), ids: { doblete: goles, suelto: [suelto] } };
}

/** Un jugador con tres goles: doblete_o_mas con los tres. */
export function triplete(): Fixture {
  const b = new Constructor().abrir();
  const g = [b.gol(12, "visita", 10), b.gol(33, "visita", 10)];
  b.descanso();
  g.push(b.gol(61, "visita", 10));
  return { partido: b.cerrar(), ids: { goles: g } };
}

/**
 * Bordes de temprano/tardío: un gol en el último minuto temprano y otro justo en el
 * umbral (no temprano); uno justo en el umbral tardío (no tardío), uno pasado el
 * umbral y uno en el descuento (ambos tardíos).
 */
export function tempranoYTardio(): Fixture {
  const b = new Constructor().abrir();
  const temprano = b.gol(GOL_TEMPRANO_ANTES_DE - 1, "local", 9);
  const enUmbralTemprano = b.gol(GOL_TEMPRANO_ANTES_DE, "visita", 9);
  b.descanso();
  const enUmbralTardio = b.gol(GOL_TARDIO_DESPUES_DE, "local", 8);
  const tardio = b.gol(GOL_TARDIO_DESPUES_DE + 1, "visita", 8);
  const descuento = b.gol(92, "local", 10);
  return {
    partido: b.cerrar(95),
    ids: { tempranos: [temprano], tardios: [tardio, descuento], noEmiten: [enUmbralTemprano, enUmbralTardio] },
  };
}

/**
 * Dominio con `propias` de `total` acciones ofensivas del local en el 1T (corners,
 * pases clave y tiros alternados). El 2T queda parejo (1 y 1).
 */
function dominio(propias: number, total: number): Fixture {
  const b = new Constructor().abrir();
  const del1T: string[] = [];
  for (let k = 0; k < total; k++) {
    const minuto = Math.floor((k * 44) / total);
    const lado = k < propias ? "local" : "visita";
    const id = k % 3 === 0 ? b.corner(minuto, lado) : k % 3 === 1 ? b.paseClave(minuto, lado) : b.tiro(minuto, lado, 9, 0.05);
    if (lado === "local") del1T.push(id);
  }
  b.descanso();
  b.corner(60, "local");
  b.corner(70, "visita");
  return { partido: b.cerrar(), ids: { propias: del1T } };
}

/** Exactamente DOMINIO_PORCENTAJE_MIN %: 13 de 20 con el umbral de 65 ⇒ SÍ emite. */
export function dominioJusto(): Fixture {
  // total = 20 ⇒ propias = umbral·20/100 (entero para un umbral múltiplo de 5).
  const total = 20;
  return dominio((DOMINIO_PORCENTAJE_MIN * total) / 100, total);
}

/** 0.1 punto por debajo del umbral (64.9 % con el umbral de 65): 649 de 1000 ⇒ NO emite. */
export function dominioCasi(): Fixture {
  const total = 1000;
  return dominio(DOMINIO_PORCENTAJE_MIN * 10 - 1, total);
}

/** Reparte `total` centésimas en `n` tiros: n−1 iguales y el último completa el total exacto. */
function repartir(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, k) => (k < n - 1 ? base : total - base * (n - 1)));
}

/** Minuto del k-ésimo de n eventos repartidos entre `desde` y `hasta` (incluidos). */
function minutoEn(k: number, n: number, desde: number, hasta: number): number {
  return n <= 1 ? desde : desde + Math.round((k * (hasta - desde)) / (n - 1));
}

/** xG alto por tiro para los casos que deben fallar SOLO por otra razón (ancho, descanso). */
const XG_ALTO = 0.3;

/**
 * Presión (revisión 2.1). Cuatro bordes, cada uno falla por una sola razón:
 * - local 1T: PRESION_TIROS_MIN tiros en la ventana EXACTA con el xG mínimo EXACTO ⇒ emite.
 * - visitante 1T: los mismos tiros con xG alto pero en una ventana un minuto más ancha ⇒ no.
 * - local, cruzando el descanso: n−1 tiros de xG alto al cierre del 1T y uno al inicio
 *   del 2T, todo en pocos minutos de reloj ⇒ no (la ventana no cruza periodos).
 * - local 2T: n tiros en la ventana exacta con el xG mínimo menos una centésima ⇒ no.
 */
export function presion(): Fixture {
  const b = new Constructor().abrir();
  const n = PRESION_TIROS_MIN;
  const v = PRESION_VENTANA_MINUTOS;
  const xgJusto = repartir(PRESION_XG_MIN_CENTESIMAS, n);
  const presionL: string[] = [];
  for (let k = 0; k < n; k++) {
    const m = minutoEn(k, n, 5, 5 + v);
    presionL.push(b.tiro(m, "local", 9, (xgJusto[k] as number) / 100));
    // El visitante acompaña con los mismos minutos salvo el último, que cae fuera.
    b.tiro(k < n - 1 ? m : 5 + v + 1, "visita", 9, XG_ALTO);
  }
  // Cruzando el descanso: n−1 tiros locales al cierre del 1T…
  for (let k = 0; k < n - 1; k++) b.tiro(minutoEn(k, n - 1, 43, 45), "local", 8, XG_ALTO);
  b.descanso();
  // …y uno al inicio del 2T.
  b.tiro(46, "local", 8, XG_ALTO);
  // 2T, lejos del anterior: ventana exacta, xG una centésima corto.
  const xgCorto = repartir(PRESION_XG_MIN_CENTESIMAS - 1, n);
  for (let k = 0; k < n; k++) b.tiro(minutoEn(k, n, 70, 70 + v), "local", 10, (xgCorto[k] as number) / 100);
  return { partido: b.cerrar(), ids: { presionL } };
}

/** PORTERO_ATAJADAS_MIN atajadas de poco xG del portero local (titular, índice 0). */
export function porteroPorAtajadas(): Fixture {
  const b = new Constructor().abrir();
  const ids: string[] = [];
  for (let k = 0; k < PORTERO_ATAJADAS_MIN; k++) {
    // 1 centésima por tiro: muy por debajo del xG atajado mínimo, emite por número.
    const a = b.atajada(minutoEn(k, PORTERO_ATAJADAS_MIN, 5, 44), "visita", 9, 0.01);
    ids.push(`e${String(Number(a.slice(1)) - 1).padStart(3, "0")}`, a);
  }
  b.descanso();
  return { partido: b.cerrar(), ids: { citados: ids, portero: [b.jugador("local", 0)] } };
}

/** Una atajada menos que el mínimo, de xG ínfimo ⇒ NO emite (borde del número). */
export function porteroCasiPorAtajadas(): Fixture {
  const b = new Constructor().abrir();
  const n = PORTERO_ATAJADAS_MIN - 1;
  for (let k = 0; k < n; k++) b.atajada(minutoEn(k, n, 5, 44), "visita", 9, 0.01);
  b.descanso();
  return { partido: b.cerrar(), ids: {} };
}

/** Menos atajadas que el mínimo pero exactamente el xG atajado mínimo ⇒ SÍ emite. */
export function porteroPorXg(): Fixture {
  const b = new Constructor().abrir();
  const n = PORTERO_ATAJADAS_MIN - 1;
  const xg = repartir(PORTERO_XG_ATAJADO_MIN_CENTESIMAS, n);
  for (let k = 0; k < n; k++) b.atajada(minutoEn(k, n, 5, 44), "local", 9, (xg[k] as number) / 100);
  b.descanso();
  return { partido: b.cerrar(), ids: { portero: [b.jugador("visita", 0)] } };
}

/** Una centésima por debajo del xG mínimo y una atajada menos que el mínimo ⇒ NO emite. */
export function porteroCasi(): Fixture {
  const b = new Constructor().abrir();
  const n = PORTERO_ATAJADAS_MIN - 1;
  const xg = repartir(PORTERO_XG_ATAJADO_MIN_CENTESIMAS - 1, n);
  for (let k = 0; k < n; k++) b.atajada(minutoEn(k, n, 5, 44), "local", 9, (xg[k] as number) / 100);
  b.descanso();
  return { partido: b.cerrar(), ids: {} };
}

/** Cambio de arquero: el portero local titular (0) sale por el suplente (11) a mitad de las atajadas. */
export function porteroConCambio(): Fixture {
  const b = new Constructor().abrir();
  const mitad = Math.ceil(PORTERO_ATAJADAS_MIN / 2);
  const resto = PORTERO_ATAJADAS_MIN - mitad;
  for (let k = 0; k < mitad; k++) b.atajada(minutoEn(k, mitad, 5, 44), "visita", 9, 0.01);
  b.descanso();
  b.cambio(60, "local", 11, 0);
  for (let k = 0; k < resto; k++) b.atajada(minutoEn(k, resto, 62, 90), "visita", 9, 0.01);
  return { partido: b.cerrar(), ids: { porteros: [b.jugador("local", 0), b.jugador("local", 11)] } };
}

/** Roja directa al local 3 con 0–1; después V marca y L marca. */
export function expulsionDirecta(): Fixture {
  const b = new Constructor().abrir();
  const antes = b.gol(20, "visita", 9);
  const roja = b.roja(30, "local", 3);
  const falta = `e${String(Number(roja.slice(1)) - 1).padStart(3, "0")}`;
  b.descanso();
  const d1 = b.gol(60, "visita", 8);
  const d2 = b.gol(70, "local", 9);
  return { partido: b.cerrar(), ids: { roja: [roja], falta: [falta], antes: [antes], despues: [d1, d2] } };
}

/** Doble amarilla: amarilla al local 3 en el 20' y roja en el 50' (una sola tarjeta_roja). */
export function expulsionDobleAmarilla(): Fixture {
  const b = new Constructor().abrir();
  const amarilla = b.amarilla(20, "local", 3);
  b.descanso();
  const roja = b.roja(50, "local", 3);
  return { partido: b.cerrar(), ids: { amarilla: [amarilla], roja: [roja] } };
}

/** DISCIPLINA_AMARILLAS_MIN amarillas del local (emite) y una menos del visitante (no emite). */
export function disciplina(): Fixture {
  const b = new Constructor().abrir();
  const locales: string[] = [];
  for (let k = 0; k < DISCIPLINA_AMARILLAS_MIN; k++) locales.push(b.amarilla(5 + 8 * k, "local", 1 + k));
  b.descanso();
  for (let k = 0; k < DISCIPLINA_AMARILLAS_MIN - 1; k++) b.amarilla(50 + 8 * k, "visita", 1 + k);
  return { partido: b.cerrar(), ids: { locales } };
}

/** 0–0 sin un solo tiro: resultado_final y justicia_xg citan solo el fin del partido. */
export function sinTiros(): Fixture {
  const b = new Constructor().abrir();
  b.falta(30, "local", 5);
  b.descanso();
  b.corner(70, "visita");
  const p = b.cerrar();
  return { partido: p, ids: { fin: [p.eventos[p.eventos.length - 1]!.id] } };
}

/** El local gana 1–0 con 0.10 de xG contra 1.50 del visitante: "contra la corriente". */
export function contraLaCorriente(): Fixture {
  const b = new Constructor().abrir();
  b.gol(25, "local", 9, 0.1);
  b.atajada(30, "visita", 9, 0.5);
  b.descanso();
  b.atajada(60, "visita", 8, 0.5);
  b.atajada(80, "visita", 10, 0.5);
  return { partido: b.cerrar(), ids: {} };
}

/** Revisión 2.3 — el local gana 1–0 con EXACTAMENTE el mismo xG que el visitante ⇒ no es "contra la corriente". */
export function justiciaXgIgual(): Fixture {
  const b = new Constructor().abrir();
  b.gol(25, "local", 9, 0.3);
  b.descanso();
  b.atajada(60, "visita", 9, 0.3);
  return { partido: b.cerrar(), ids: {} };
}

/**
 * Revisión 2.3 [B1] — dos expulsiones por doble amarilla cuyas amarillas previas
 * van en el orden inverso a sus rojas: local 3 amarilla 5' y roja 53'; visitante 4
 * amarilla 20' y roja 26'. Las rojas (y los hechos) deben quedar cronológicos.
 */
export function dosDoblesAmarillas(): Fixture {
  const b = new Constructor().abrir();
  const amarillaL = b.amarilla(5, "local", 3);
  const amarillaV = b.amarilla(20, "visita", 4);
  const rojaV = b.roja(26, "visita", 4);
  b.descanso();
  const rojaL = b.roja(53, "local", 3);
  return { partido: b.cerrar(), ids: { rojasEnOrden: [rojaV, rojaL], amarillas: [amarillaL, amarillaV] } };
}

/**
 * Revisión 2.3 [B2] — roja al portero local (0) en el 30' y, después, el mínimo de
 * atajadas del visitante. Nadie identificable está en el arco: el hecho no nombra.
 */
export function rojaAlPortero(): Fixture {
  const b = new Constructor().abrir();
  b.roja(30, "local", 0);
  b.descanso();
  for (let k = 0; k < PORTERO_ATAJADAS_MIN; k++) b.atajada(minutoEn(k, PORTERO_ATAJADAS_MIN, 50, 90), "visita", 9, 0.01);
  return { partido: b.cerrar(), ids: { expulsado: [b.jugador("local", 0)] } };
}

/**
 * Revisión 2.3 [B2] — caso mixto: el portero local ataja dos veces, ve la roja y
 * el resto de las atajadas ocurre sin portero identificable. Nombrarlo le
 * atribuiría atajadas que no hizo: el hecho no nombra.
 */
export function rojaAlPorteroMixto(): Fixture {
  const b = new Constructor().abrir();
  b.atajada(10, "visita", 9, 0.01);
  b.atajada(20, "visita", 9, 0.01);
  b.roja(30, "local", 0);
  b.descanso();
  for (let k = 2; k < PORTERO_ATAJADAS_MIN; k++) b.atajada(minutoEn(k - 2, PORTERO_ATAJADAS_MIN - 2, 50, 90), "visita", 9, 0.01);
  return { partido: b.cerrar(), ids: { expulsado: [b.jugador("local", 0)] } };
}

/**
 * Revisión 2.3 [B2] — roja al portero local y entra el portero suplente (11) por un
 * mediocampista (5). Las atajadas posteriores son del suplente, que sí se nombra.
 */
export function rojaAlPorteroConSuplente(): Fixture {
  const b = new Constructor().abrir();
  b.roja(30, "local", 0);
  b.cambio(32, "local", 11, 5);
  b.descanso();
  for (let k = 0; k < PORTERO_ATAJADAS_MIN; k++) b.atajada(minutoEn(k, PORTERO_ATAJADAS_MIN, 50, 90), "visita", 9, 0.01);
  return { partido: b.cerrar(), ids: { portero: [b.jugador("local", 11)], expulsado: [b.jugador("local", 0)] } };
}

export const FIXTURES = {
  basico,
  remontadaVictoria,
  remontadaEmpate,
  sinRemontada,
  dobleteExacto,
  triplete,
  tempranoYTardio,
  dominioJusto,
  dominioCasi,
  presion,
  porteroPorAtajadas,
  porteroCasiPorAtajadas,
  porteroPorXg,
  porteroCasi,
  porteroConCambio,
  expulsionDirecta,
  expulsionDobleAmarilla,
  disciplina,
  sinTiros,
  contraLaCorriente,
  justiciaXgIgual,
  dosDoblesAmarillas,
  rojaAlPortero,
  rojaAlPorteroMixto,
  rojaAlPorteroConSuplente,
} as const;
