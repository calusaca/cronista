// Agregados de un Partido (marcador, conteos) — usados por el CLI y la suite estadística.

import type { Lado, Partido } from "./tipos";

export interface ConteoEquipo {
  goles: number;
  xg: number;
  tiros: number;
  pasesClave: number;
  faltas: number;
  amarillas: number;
  rojas: number;
  corners: number;
  fuerasDeJuego: number;
  atajadas: number;
  cambios: number;
}

export type Resumen = Record<Lado, ConteoEquipo>;

function vacio(): ConteoEquipo {
  return { goles: 0, xg: 0, tiros: 0, pasesClave: 0, faltas: 0, amarillas: 0, rojas: 0, corners: 0, fuerasDeJuego: 0, atajadas: 0, cambios: 0 };
}

export function resumir(p: Partido): Resumen {
  const r: Resumen = { local: vacio(), visita: vacio() };
  for (const e of p.eventos) {
    const c = r[e.equipo];
    switch (e.tipo) {
      case "gol": c.goles++; break;
      case "tiro": c.tiros++; c.xg += e.xg ?? 0; break;
      case "pase_clave": c.pasesClave++; break;
      case "falta": c.faltas++; break;
      case "tarjeta_amarilla": c.amarillas++; break;
      case "tarjeta_roja": c.rojas++; break;
      case "corner": c.corners++; break;
      case "fuera_de_juego": c.fuerasDeJuego++; break;
      case "atajada": c.atajadas++; break;
      case "cambio": c.cambios++; break;
      default: break;
    }
  }
  return r;
}

/** Franja de 15' (0..5) de un minuto, sabiendo a qué periodo pertenece. */
export function franjaDe(minuto: number, periodo: 1 | 2): number {
  if (periodo === 1) return Math.min(Math.floor(minuto / 15), 2);
  return 3 + Math.min(Math.floor((minuto - 45) / 15), 2);
}

/** Minuto y periodo de cada gol. */
export function golesConPeriodo(p: Partido): { minuto: number; periodo: 1 | 2; equipo: Lado }[] {
  let periodo: 1 | 2 = 1;
  let inicios = 0;
  const out: { minuto: number; periodo: 1 | 2; equipo: Lado }[] = [];
  for (const e of p.eventos) {
    if (e.tipo === "inicio_periodo") {
      inicios++;
      periodo = inicios >= 2 ? 2 : 1;
    }
    if (e.tipo === "gol") out.push({ minuto: e.minuto, periodo, equipo: e.equipo });
  }
  return out;
}
