// Brief 016 §2 — tabla de posiciones y goleadores: funciones PURAS de los resultados.
// Puntos 3/1/0; desempate puntos → diferencia de gol → goles a favor → orden alfabético.

import type { FilaTabla, Goleador, PartidoLiga } from "./tipos";

export const PUNTOS_VICTORIA = 3;
export const PUNTOS_EMPATE = 1;

const alfabetico = (a: string, b: string) => a.localeCompare(b, "es");

export function tablaDePosiciones(equipos: readonly string[], partidos: readonly PartidoLiga[]): FilaTabla[] {
  const filas = new Map<string, FilaTabla>(
    equipos.map((e) => [e, { equipo: e, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0 }]),
  );
  const fila = (nombre: string) => {
    const f = filas.get(nombre);
    if (!f) throw new Error(`tablaDePosiciones: equipo desconocido «${nombre}»`);
    return f;
  };
  for (const p of partidos) {
    const l = fila(p.local);
    const v = fila(p.visita);
    l.pj++;
    v.pj++;
    l.gf += p.golesLocal;
    l.gc += p.golesVisita;
    v.gf += p.golesVisita;
    v.gc += p.golesLocal;
    if (p.golesLocal > p.golesVisita) {
      l.g++;
      v.p++;
      l.pts += PUNTOS_VICTORIA;
    } else if (p.golesLocal < p.golesVisita) {
      v.g++;
      l.p++;
      v.pts += PUNTOS_VICTORIA;
    } else {
      l.e++;
      v.e++;
      l.pts += PUNTOS_EMPATE;
      v.pts += PUNTOS_EMPATE;
    }
  }
  const out = [...filas.values()];
  for (const f of out) f.dg = f.gf - f.gc;
  return out.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || alfabetico(a.equipo, b.equipo));
}

/** Goleadores: todos los que marcaron, por goles (desc) y luego por nombre. */
export function goleadores(partidos: readonly PartidoLiga[]): Goleador[] {
  const cuenta = new Map<string, Goleador>();
  for (const p of partidos) {
    for (const g of p.goles) {
      const k = `${g.equipo}|${g.jugador}`;
      const actual = cuenta.get(k) ?? { jugador: g.jugador, equipo: g.equipo, goles: 0 };
      actual.goles++;
      cuenta.set(k, actual);
    }
  }
  return [...cuenta.values()].sort((a, b) => b.goles - a.goles || alfabetico(a.jugador, b.jugador));
}
