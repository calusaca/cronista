// Brief 018 §4 — las condiciones en la UI (funciones puras; chrome en inglés, como el resto).
// El chip de la cabecera dice la config registrada; el bloque del panel de stats muestra las
// MEDICIONES de los efectos narrables con las mismas funciones que usa el Analista
// (src/analista/condiciones.ts): el panel destaca exactamente lo que la crónica puede narrar.

import { medirCalor, medirCancha, medirPresion } from "../analista/condiciones";
import { CALOR_PASES_2T_MAX, CANCHA_CORTOS_MAX, PRESION_PERDIDAS_MIN } from "../analista/umbrales";
import { micro, type MicroPartido } from "../sim/micro";
import type { Condiciones, Lado, Partido } from "../sim/tipos";

/** Los niveles de presión en el chrome (inglés): nunca el valor crudo de la config. */
const PRESION_EN: Record<Condiciones["presion"]["local"], string> = { baja: "low", media: "medium", alta: "high" };

const temp = (c: number) => (c < 0 ? `−${-c}` : String(c));

/** Las piezas del chip («34 °C · long natural grass · away side under high pressure»). */
export function piezasChip(c: Condiciones): string[] {
  const clima = c.temperaturaC !== undefined ? `${temp(c.temperaturaC)} °C` : c.clima === "lluvia" ? "Rain" : c.clima === "niebla" ? "Fog" : "Clear skies";
  const cancha = c.superficie === "sintetica" ? "artificial pitch" : c.cesped === "alto" ? "long natural grass" : "short natural grass";
  const presion = c.presion.visita === "alta" ? "away side under high pressure" : `${PRESION_EN[c.presion.local]} pressure at home, ${PRESION_EN[c.presion.visita]} away`;
  return [clima, cancha, presion];
}

export const EXPLICA_CONDICIONES =
  "Fixture conditions — the host country's weather, the home ground and the crowd. They change the simulation, and the report mentions an effect only when this match's data measured it.";

export interface EfectoMedido {
  tipo: "efecto_calor" | "cancha_incomoda" | "presion_que_ahoga";
  titulo: string;
  valor: string;
  /** El mismo criterio que el hecho del Analista (en vivo, sobre lo visto). */
  destacado: boolean;
  /** Micro-eventos citados (si el efecto es acotado); si no, el desglose. */
  ids: string[];
  desglose: { etiqueta: string; valor: string }[];
}

/** Las mediciones de los efectos narrables de este partido (las que su config habilita). */
export function efectosMedidos(p: Partido, nombres: Record<Lado, string>, m: MicroPartido = micro(p)): EfectoMedido[] {
  const out: EfectoMedido[] = [];
  const calor = medirCalor(p, m);
  if (calor) {
    out.push({
      tipo: "efecto_calor",
      titulo: `Heat (${calor.temperaturaC} °C): passes after the break`,
      valor: `${calor.pases2} vs ${calor.pases1} (${calor.porcentaje}%)`,
      destacado: calor.efecto,
      ids: [],
      desglose: [
        { etiqueta: "Passes, 1st half", valor: String(calor.pases1) },
        { etiqueta: "Passes, 2nd half", valor: String(calor.pases2) },
        { etiqueta: "2nd half as % of the 1st", valor: `${calor.porcentaje}%` },
        { etiqueta: "Counts as an effect at or below", valor: `${CALOR_PASES_2T_MAX}% (only once the 2nd half is over)` },
      ],
    });
  }
  const cancha = medirCancha(p, m);
  if (cancha) {
    out.push({
      tipo: "cancha_incomoda",
      titulo: `Long grass: ${nombres.visita} short-pass completion`,
      valor: `${cancha.porcentaje}%`,
      destacado: cancha.efecto,
      ids: [],
      desglose: [
        { etiqueta: `${nombres.visita} short passes completed`, valor: `${cancha.completados} of ${cancha.intentados} (${cancha.porcentaje}%)` },
        { etiqueta: `${nombres.local} (home, used to it)`, valor: `${cancha.completadosLocal} of ${cancha.intentadosLocal} (${cancha.porcentajeLocal}%)` },
        { etiqueta: "Counts as an effect at or below", valor: cancha.lluvia ? "not in rain (the rain, not the grass, could explain it)" : `${CANCHA_CORTOS_MAX}%` },
      ],
    });
  }
  const presion = medirPresion(p, m);
  if (presion) {
    out.push({
      tipo: "presion_que_ahoga",
      titulo: `High pressure: ${nombres[presion.lado]} losses playing out before minute ${presion.limite}`,
      valor: String(presion.ids.length),
      destacado: presion.efecto,
      ids: presion.ids,
      desglose: [{ etiqueta: "Counts as an effect from", valor: `${PRESION_PERDIDAS_MIN} losses` }],
    });
  }
  return out;
}
