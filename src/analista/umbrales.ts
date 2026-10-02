// Umbrales del Analista — ÚNICA fuente de estas cifras (brief 002).
// Las pruebas los importan; ninguna prueba repite un número de este archivo a mano.
// Si un umbral parece mal, se reporta a Fable; no se mueve para que una prueba pase.

import type { TipoEvento } from "../sim/tipos";
import type { TipoHecho } from "./tipos";

/** `gol_temprano`: gol con minuto ESTRICTAMENTE menor que este (brief: < 10). */
export const GOL_TEMPRANO_ANTES_DE = 10;

/** `gol_tardio`: gol con minuto ESTRICTAMENTE mayor que este (brief: > 85). Incluye el descuento 91–96. */
export const GOL_TARDIO_DESPUES_DE = 85;

/** `doblete_o_mas`: goles mínimos de un mismo jugador (brief: ≥ 2). */
export const DOBLETE_MIN_GOLES = 2;

/**
 * `dominio_periodo`: porcentaje mínimo (entero, en %) de las acciones ofensivas
 * (tiro, corner, pase_clave) de un periodo que debe sumar un equipo (brief: ≥ 65 %).
 * Se compara en enteros (acciones·100 ≥ PORCENTAJE·total) para que 65 % exacto
 * emita y 64.9 % no, sin errores de coma flotante.
 */
export const DOMINIO_PORCENTAJE_MIN = 65;

/**
 * `presion_sostenida`: tiros mínimos del mismo equipo dentro de la ventana.
 * Brief inicial: ≥ 3. Revisión 2.1: subido a 4 tras medir el corpus 1..1000
 * (con 3 tiros y sin xG mínimo salía en el 99.3 % de los partidos, 4.4 por partido).
 * Elegido con barrido (n × ventana × xG mínimo): 4 tiros / 10' / 0.75 xG ⇒ 23.5 % de
 * los partidos y 0.29 por partido, en el centro de RAREZA_PRESION. La variante con 3
 * tiros (36.3 %) quedaba pegada al techo de 0.40.
 */
export const PRESION_TIROS_MIN = 4;

/**
 * `presion_sostenida` (revisión 2.1): xG acumulado mínimo del tramo, en CENTÉSIMAS
 * (0.75 ⇒ 75). Tres tiritos de 0.08 xG no son presión: el tramo tiene que haber
 * generado peligro, no solo volumen.
 */
export const PRESION_XG_MIN_CENTESIMAS = 75;

/**
 * `presion_sostenida`: ancho máximo de la ventana en minutos de reloj (brief: ≤ 10):
 * minuto del último tiro − minuto del primero ≤ este valor. La ventana no cruza el
 * descanso (decisión del implementador: el 1T termina sellado en 45 y el 2T arranca en 45).
 */
export const PRESION_VENTANA_MINUTOS = 10;

/**
 * `portero_destacado`: atajadas mínimas de un portero. Brief inicial: ≥ 4.
 * Revisión 2.1: subido a 7. En el corpus 1..1000 un equipo recibe ~3.8 atajadas
 * de media y 4+ ocurre en la mitad de los casos (salía en el 71.8 % de los
 * partidos). Con 7 (o el xG de abajo) ⇒ 18.1 % de los partidos, centro de
 * RAREZA_PORTERO. Con 6 daba 30.7 %, demasiado cerca del techo de 0.35.
 */
export const PORTERO_ATAJADAS_MIN = 7;

/**
 * `portero_destacado`: xG atajado mínimo, en CENTÉSIMAS de xG. Brief inicial: ≥ 1.5.
 * Revisión 2.1: bajado a 1.00 ⇒ 100 para que la rama de CALIDAD (pocas atajadas
 * pero a ocasiones claras, p. ej. un penal atajado + otra) aporte casos propios
 * (~2.5 puntos del 18.1 %); con 1.5 casi nunca disparaba por sí sola.
 * Los xg del simulador tienen 2 decimales; sumar en centésimas enteras evita
 * errores de coma flotante.
 */
export const PORTERO_XG_ATAJADO_MIN_CENTESIMAS = 100;

/**
 * Revisión 2.1 — propiedad de RAREZA sobre el corpus 1..1000 (suite rápida).
 * Un hecho que sale en casi todos los partidos no es noticia. Si una calibración
 * futura del simulador vuelve banal `presion_sostenida`, una prueba se pone roja.
 * - `min`/`max`: fracción de partidos con al menos uno de estos hechos.
 * - `mediaMax`: media máxima de hechos de este tipo por partido.
 */
export const RAREZA_PRESION = { min: 0.1, max: 0.4, mediaMax: 1.0 } as const;

/** Revisión 2.1 — fracción de partidos con al menos un `portero_destacado`. */
export const RAREZA_PORTERO = { min: 0.08, max: 0.35 } as const;

/**
 * Revisión 2.2 — fracción de partidos con al menos una `remontada` de desenlace
 * "victoria" (la de relevancia 90). Si deja de ser excepcional, deja de ser titular.
 */
export const RAREZA_REMONTADA_VICTORIA = { min: 0.03, max: 0.2 } as const;

/** `disciplina`: tarjetas amarillas mínimas de un equipo (brief: ≥ 4). */
export const DISCIPLINA_AMARILLAS_MIN = 4;

/**
 * Clave de la tabla de relevancia: el tipo de hecho, salvo `remontada`, que se
 * divide por desenlace (revisión 2.2).
 */
export type ClaveRelevancia = Exclude<TipoHecho, "remontada"> | "remontada_victoria" | "remontada_empate";

/**
 * Relevancia fija (0–100). Brief: remontada 90, expulsion_y_efecto 85, doblete 80,
 * resultado_final 75, … disciplina 30; los intermedios (gol 70 … presión 35) los
 * propuso el implementador y quedaron aceptados en la revisión 2.1.
 * Revisión 2.2: la remontada que termina en VICTORIA vale 90 (titular); la que
 * termina en EMPATE vale 60 (una remontada empatada no es titular: en el corpus
 * 1..1000 la mayoría son déficits de un gol que terminan 1–1).
 * A igual relevancia desempata el minuto del EVENTO DEFINITORIO (ver DESEMPATE_EVENTO).
 */
export const RELEVANCIA: Record<ClaveRelevancia, number> = {
  remontada_victoria: 90,
  remontada_empate: 60,
  expulsion_y_efecto: 85,
  doblete_o_mas: 80,
  resultado_final: 75,
  // Brief 009: entre el resultado (75) y el gol (70).
  figura_del_partido: 72,
  // Brief 013.
  dominio_global: 70,
  duelo_ganado: 68,
  perdidas_en_salida: 64,
  dominio_por_canal: 60,
  gol_anotado: 70,
  portero_destacado: 65,
  gol_tardio: 60,
  justicia_xg: 55,
  marcador_por_periodo: 50,
  dominio_periodo: 45,
  gol_temprano: 40,
  presion_sostenida: 35,
  disciplina: 30,
};

/**
 * Revisión 2.3 [B1] — evento definitorio de cada tipo de hecho, para el desempate
 * cronológico a igual relevancia: se usa el PRIMER evento citado de este tipo
 * (si el hecho no cita ninguno, el primer evento citado). Antes se usaba el primer
 * evento citado a secas, y una expulsión por doble amarilla se ordenaba por su
 * amarilla previa: con dos expulsiones, la roja del 53' podía quedar antes que la
 * del 26' (semilla 495).
 * - resultado_final / marcador_por_periodo: el pitazo (fin_periodo).
 * - expulsion_y_efecto: la roja, nunca la falta ni la amarilla previa.
 * - portero_destacado: la primera atajada; disciplina: la primera amarilla.
 * - justicia_xg: el primer tiro (sin tiros, cae al fin del partido que cita).
 */
export const DESEMPATE_EVENTO: Record<TipoHecho, TipoEvento> = {
  resultado_final: "fin_periodo",
  marcador_por_periodo: "fin_periodo",
  gol_anotado: "gol",
  doblete_o_mas: "gol",
  remontada: "gol",
  gol_temprano: "gol",
  gol_tardio: "gol",
  dominio_periodo: "tiro",
  presion_sostenida: "tiro",
  justicia_xg: "tiro",
  portero_destacado: "atajada",
  expulsion_y_efecto: "tarjeta_roja",
  disciplina: "tarjeta_amarilla",
  // Brief 009: hay una sola figura por partido, así que nunca empata consigo misma;
  // si empatara en relevancia con otro tipo, decide su primer gol (o su primer evento citado).
  figura_del_partido: "gol",
  // Brief 013: los acotados citan micro-eventos (no hay evento macro definitorio: desempata el
  // orden de TIPOS_HECHO); los agregados citan los inicios de periodo.
  duelo_ganado: "inicio_periodo",
  perdidas_en_salida: "inicio_periodo",
  dominio_global: "inicio_periodo",
  dominio_por_canal: "inicio_periodo",
};

// ---------------------------------------------------------------------------------
// Brief 009 — valoración de jugadores (nota de partido 1–10, estilo prensa).
// Valores INICIALES del brief, calibrables: se cambian aquí y en ningún otro lado (las
// pruebas importan estas cifras). Deltas con signo, en notas. El cálculo suma en
// centésimas enteras para no arrastrar errores de coma flotante.
// ---------------------------------------------------------------------------------

export const VALORACION = {
  /** Nota de partida de todo jugador con participación. */
  base: 6.0,
  /** Escala final acotada [min, max]; redondeo a un decimal. */
  min: 3.0,
  max: 10.0,
  /** Gol (al que lo marca). */
  gol: 1.2,
  /** Extra por definición difícil: gol de un tiro con xG ESTRICTAMENTE menor que `gol_dificil_xg_max`. */
  gol_dificil: 0.3,
  gol_dificil_xg_max: 0.15,
  /** Tiro a puerta que el portero atajó (al tirador). */
  tiro_atajado: 0.3,
  pase_clave: 0.3,
  /** Córner: al jugador que nombra el evento `corner` (ver valoracion.ts). */
  corner: 0.1,
  amarilla: -0.5,
  /** Roja (directa o segunda amarilla, que llega como tarjeta_roja). */
  roja: -1.5,
  falta: -0.1,
  fuera_de_juego: -0.1,
  /** Porteros (el que está en el arco en ese evento): atajada, xG atajado ×factor, gol recibido.
   *  Calibrado el 1 oct (barrido de 500 semillas): con 0.5/1.0 el portero era la figura en el
   *  61 % de los partidos. Con 0.1/1.0 queda en 5.8 % (DEL 56 %, MED 29 %, DEF 9 %), que es lo
   *  que firma la prensa; el factor se mantiene en 1.0 porque un xG (centésimas) por un factor
   *  fraccionario produce medias centésimas y rompe la aritmética exacta del cálculo. */
  atajada: 0.1,
  xg_atajado_factor: 1.0,
  gol_recibido: -0.3,
} as const;

// ---------------------------------------------------------------------------------
// Brief 013 — hechos de la capa micro. Umbrales iniciales del brief (calibrables: se mueven
// aquí y en ningún otro lado; si la rareza medida no cuadra, se reporta, no se mueve solo).
// ---------------------------------------------------------------------------------

/** `duelo_ganado`: regates exitosos de un mismo atacante sobre un mismo defensor (brief: ≥ 4). */
export const DUELO_MIN = 4;
/** `perdidas_en_salida`: pérdidas de un equipo en su zona de salida (defensa) por un mismo canal.
 *  Calibrado el 2 oct (barrido N=1000): el 6 inicial daba 56,2 % de rareza; con 8 queda en
 *  29,4 % — perder 8 veces por el mismo flanco sí es noticia. */
export const PERDIDAS_MIN = 8;
/** `dominio_global`: % de posesión (por pases intentados) de un equipo (brief: ≥ 58). */
export const DOMINIO_MIN = 58;
/** `dominio_por_canal`: % de los avances de un equipo por un mismo canal.
 *  Calibrado el 2 oct (barrido N=1000): el 45 inicial daba 39,1 % (con ~40 avances, el ruido
 *  solo ya lo pasa); con 47 queda en 26,6 %. */
export const CANAL_MIN = 47;
/**
 * Agregado por el implementador (no está en el brief): muestra mínima para un porcentaje.
 * Sobre un prefijo corto (en vivo), 3 pases de 4 serían «75 % de posesión»: no es noticia.
 */
export const DOMINIO_PASES_MIN = 100;
export const CANAL_AVANCES_MIN = 10;
/** Rareza del brief 013: cada hecho nuevo en ≤ 35 % de los partidos del corpus. */
export const RAREZA_MICRO_MAX = 0.35;
