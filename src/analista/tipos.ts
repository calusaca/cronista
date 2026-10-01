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
  | "figura_del_partido";

export interface Hecho {
  id: string; // "h07", secuencial por relevancia descendente
  tipo: TipoHecho;
  texto_es: string; // enunciado neutro por plantilla (no LLM)
  texto_en: string;
  eventos: string[]; // IDs de eventos que lo sustentan; NUNCA vacío (orden del stream, sin repetidos)
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
];
