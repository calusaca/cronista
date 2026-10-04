// Brief 027 — las sanciones de club en la UI (funciones puras; chrome en inglés, como el resto):
// la nota de la fila sancionada de la tabla y los chips de la cabecera del partido afectado.

import { BANCO_LIMITADO, type CausaSancionClub } from "../sim/limites";
import type { FilaTabla } from "../mundo/tipos";
import type { SimConfig } from "../sim/tipos";

export const CAUSA_SANCION_EN: Record<CausaSancionClub, string> = {
  irregularidad_financiera: "financial irregularities",
  alineacion_indebida: "fielding an ineligible player",
  incidentes_de_publico: "crowd trouble",
};

/** La nota de una fila con deducción («−6 pts · financial irregularities»); sin deducción, nada. */
export function notaDeduccion(f: FilaTabla): string | undefined {
  return f.deduccion ? `−${f.deduccion.puntos} pts · ${CAUSA_SANCION_EN[f.deduccion.causa]}` : undefined;
}

export interface ChipSancion {
  tipo: "deduccion" | "puerta_cerrada" | "limite_banco";
  texto: string;
}

/** Los chips de la cabecera de un partido afectado por sanciones de club (dato del registro). */
export function chipsSancion(config: SimConfig): ChipSancion[] {
  if (config.variantes?.sanciones !== true) return [];
  return (config.sancionesClub ?? []).map((s) => {
    const equipo = config[s.lado].nombre;
    const causa = CAUSA_SANCION_EN[s.causa];
    if (s.tipo === "puerta_cerrada") return { tipo: s.tipo, texto: `Behind closed doors · ${equipo} · match ${s.partido} of ${s.de} · ${causa}` };
    if (s.tipo === "limite_banco") return { tipo: s.tipo, texto: `${equipo}: bench limited to ${BANCO_LIMITADO} substitutes · match ${s.partido} of ${s.de} · ${causa}` };
    return { tipo: s.tipo, texto: `${equipo}: docked ${s.puntos} points · ${causa}` };
  });
}
