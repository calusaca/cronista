// Brief 026 — el «¡olé!» de la grada como MEDICIÓN pura de la capa micro (lo usan el Analista,
// para su hecho `ole_de_la_grada`, y la capa de vista `src/vista/grada.ts`, para el ticker y el
// panel: una sola definición, así la crónica y la grada no pueden divergir).
//
// Racha: pases COMPLETADOS consecutivos (entre los pases, en el orden de la capa micro) del mismo
// equipo y de la misma posesión, todos desde el minuto OLE_MINUTO_MIN, con ese equipo en ventaja.
// Una posesión de la capa micro nunca cruza su evento ancla (comprobado en las pruebas), así que
// el marcador no cambia dentro de una racha y la racha está entera en cuanto su ancla es visible:
// la propiedad de prefijo sale de la estructura, no de un parche.

import type { MicroEvento, MicroPartido } from "../sim/micro";
import type { Lado, Partido } from "../sim/tipos";
import { OLE_MINUTO_MIN, OLE_RACHA_MIN } from "./umbrales";

export interface RachaOle {
  equipo: Lado;
  pases: MicroEvento[];
  /** El evento macro que cierra el tramo de la racha (la dispara: antes de él no se conoce). */
  ancla: string;
}

/** El marcador ANTES de cada evento macro (por id). */
export function marcadorAntes(p: Partido): Map<string, Record<Lado, number>> {
  const out = new Map<string, Record<Lado, number>>();
  const m = { local: 0, visita: 0 };
  for (const e of p.eventos) {
    out.set(e.id, { ...m });
    if (e.tipo === "gol") m[e.equipo] += 1;
  }
  return out;
}

export function rachasOle(p: Partido, m: MicroPartido): RachaOle[] {
  const antes = marcadorAntes(p);
  const out: RachaOle[] = [];
  let racha: MicroEvento[] = [];
  const cerrar = () => {
    const ultimo = racha[racha.length - 1];
    if (ultimo && racha.length >= OLE_RACHA_MIN) out.push({ equipo: ultimo.equipo, pases: racha, ancla: ultimo.ancla });
    racha = [];
  };
  for (const x of m.eventos) {
    if (x.tipo !== "pase") continue;
    const g = antes.get(x.ancla);
    const rival: Lado = x.equipo === "local" ? "visita" : "local";
    const vale = x.completado === true && x.minuto >= OLE_MINUTO_MIN && g !== undefined && g[x.equipo] > g[rival];
    if (!vale) {
      cerrar();
      continue;
    }
    const previo = racha[racha.length - 1];
    if (previo && (previo.equipo !== x.equipo || previo.posesion !== x.posesion)) cerrar();
    racha.push(x);
  }
  cerrar();
  return out;
}
