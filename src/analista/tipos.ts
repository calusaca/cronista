// Contrato del Analista — brief 002 (docs/disenos/002-analista.md).
// Los nombres y propiedades de este archivo NO se cambian sin actualizar el brief.

export type TipoHecho =
  | "resultado_final"
  | "marcador_por_periodo"
  | "gol_anotado"
  | "doblete_o_mas"
  | "remontada"
  | "gol_temprano"
  | "gol_tardio"
  | "dominio_periodo"
  | "presion_sostenida"
  | "justicia_xg"
  | "portero_destacado"
  | "expulsion_y_efecto"
  | "disciplina"
  // Brief 009: el mejor valorado del partido (nota computada desde los eventos).
  | "figura_del_partido"
  // Brief 013: hechos de la capa micro (acotados: citan micro-eventos «m0001»; agregados:
  // desglose auditable en `datos`, citan los inicios de periodo que cubren).
  | "duelo_ganado"
  | "perdidas_en_salida"
  | "dominio_global"
  | "dominio_por_canal"
  // Brief 018: las condiciones registradas (dato puro) y los tres efectos MEDIDOS en el partido.
  | "condiciones_del_partido"
  | "efecto_calor"
  | "cancha_incomoda"
  | "presion_que_ahoga"
  // Brief 019: consecuencias (lesión en el partido; bajas que trae el registro de la temporada).
  | "lesion_en_partido"
  | "bajas_del_partido";

export interface Hecho {
  id: string; // "h07", secuencial por relevancia descendente
  tipo: TipoHecho;
  texto_es: string; // enunciado neutro por plantilla (no LLM)
  texto_en: string;
  eventos: string[]; // IDs de eventos que lo sustentan; NUNCA vacío (orden del stream, sin repetidos). Brief 013: micro-eventos «m0001…» en los hechos acotados de la capa micro
  relevancia: number; // 0–100, para que el Cronista priorice
  datos: Record<string, string | number>; // cifras crudas (marcador, xG, minutos…)
}

/** Lista cerrada de tipos, en el orden en que se desempata a igual relevancia y minuto. */
export const TIPOS_HECHO: readonly TipoHecho[] = [
  "resultado_final",
  "marcador_por_periodo",
  "gol_anotado",
  "doblete_o_mas",
  "remontada",
  "gol_temprano",
  "gol_tardio",
  "dominio_periodo",
  "presion_sostenida",
  "justicia_xg",
  "portero_destacado",
  "expulsion_y_efecto",
  "disciplina",
  "figura_del_partido",
  "duelo_ganado",
  "perdidas_en_salida",
  "dominio_global",
  "dominio_por_canal",
  "condiciones_del_partido",
  "efecto_calor",
  "cancha_incomoda",
  "presion_que_ahoga",
  "lesion_en_partido",
  "bajas_del_partido",
];

/**
 * Brief 018: los hechos que solo existen con condiciones registradas (partidos de liga). El
 * corpus de semillas sueltas (configDeSemilla) no las tiene: allí estos tipos no aparecen nunca.
 */
export const TIPOS_HECHO_CONDICIONES: readonly TipoHecho[] = ["condiciones_del_partido", "efecto_calor", "cancha_incomoda", "presion_que_ahoga"];
/** Brief 019: los que solo existen en la temporada (lesiones gated por variantes; bajas del registro). */
export const TIPOS_HECHO_TEMPORADA: readonly TipoHecho[] = ["lesion_en_partido", "bajas_del_partido"];
