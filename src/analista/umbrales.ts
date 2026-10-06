// Umbrales del Analista — ÚNICA fuente de estas cifras (brief 002).
// Las pruebas los importan; ninguna prueba repite un número de este archivo a mano.
// Si un umbral parece mal, se reporta a Fable; no se mueve para que una prueba pase.

import type { Clima } from "../mundo/tipos";
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
  // Brief 018: los efectos medidos, por debajo de los goles y sin obligar a narrarlos (< COBERTURA);
  // las condiciones registradas son contexto (dato puro), relevancia baja.
  presion_que_ahoga: 62,
  efecto_calor: 58,
  cancha_incomoda: 56,
  condiciones_del_partido: 25,
  // Brief 019: la lesión, debajo del gol (no obliga a narrarla); las bajas, contexto de la previa.
  // Rareza medida en liga (720, 2 oct): lesion_en_partido 26,1 % de los partidos; bajas_del_partido
  // 49,6 % (es contexto, como las condiciones); un equipo con 2+ bajas («diezmado») en el 9,2 %.
  // Sanciones: 0,117 por partido (53 por doble amarilla, 31 por roja directa).
  lesion_en_partido: 66,
  bajas_del_partido: 45,
  // Brief 020: el autogol es LA anécdota del partido (y, ≥ COBERTURA, la crónica debe narrarlo).
  autogol: 82,
  // Brief 025: el olímpico ES la anécdota; la subida del portero se narra siempre (≥ COBERTURA).
  gol_olimpico: 85,
  subida_portero: 70,
  efecto_niebla: 56,
  tiro_al_palo: 55,
  interrupcion: 40,
  // Brief 026: el olé de la grada, color (< COBERTURA: no obliga a narrarlo).
  ole_de_la_grada: 50,
  // Brief 027: la sanción de club, la previa del partido afectado.
  sancion_de_club: 48,
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
  // Brief 018: las condiciones y los agregados citan los inicios de periodo; la presión cita
  // micro-eventos (como perdidas_en_salida).
  condiciones_del_partido: "inicio_periodo",
  efecto_calor: "inicio_periodo",
  cancha_incomoda: "inicio_periodo",
  presion_que_ahoga: "inicio_periodo",
  lesion_en_partido: "lesion",
  bajas_del_partido: "inicio_periodo",
  autogol: "gol",
  gol_olimpico: "gol",
  subida_portero: "subida_portero",
  tiro_al_palo: "tiro",
  interrupcion: "interrupcion",
  efecto_niebla: "inicio_periodo",
  // Brief 026: cita micro-eventos (los pases de la racha), como duelo_ganado.
  ole_de_la_grada: "inicio_periodo",
  // Brief 027: cita el inicio del partido (el dato es del registro, como bajas_del_partido).
  sancion_de_club: "inicio_periodo",
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
  /** Brief 020: definiciones legendarias (chilena, tijera, media cancha), vaselina, y el autor de un autogol. */
  definicion_legendaria: 0.5,
  definicion_vaselina: 0.2,
  autogol: -1.0,
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

// ---------------------------------------------------------------------------------
// Brief 016 — el mundo. Constantes de generación (no son umbrales del Analista, pero el
// brief las pone «en umbrales»: una sola fuente, y las pruebas las importan).
// ---------------------------------------------------------------------------------
/** Semilla del mundo: países, ligas, equipos y canchas salen de aquí, de forma determinista. */
export const MUNDO_SEMILLA = 2026;
/**
 * Liga que muestra /liga (id = slug del nombre). Medido el 2 oct sobre la temporada 1 de las 8
 * ligas (720 partidos): total 27,2 % de empates y 2,72 goles por partido, pegado al motor. La
 * Liga del Sol Alto (la primera) salió la desafortunada del lote (41,1 % / 2,34); la Liga de
 * los Valles es la más viva (21,1 % / 2,92). La dispersión de fuerzas es la estándar: es
 * azar de una temporada, no un sesgo del mundo.
 * Re-medido con las condiciones del 018 (2 oct): total 28,1 % / 2,64; los Valles siguen entre
 * las más vivas (24,4 % / 2,90) — la elección se sostiene.
 */
export const LIGA_DESTACADA = "liga-de-los-valles";
/** Temporada que muestra la UI. */
export const TEMPORADA_ACTUAL = 1;
export const N_PAISES = 8;
export const EQUIPOS_POR_LIGA = 10;
/** Identidad de la cancha (con efecto desde el 018): probabilidad de césped sintético y de césped alto. */
export const PROB_CANCHA_SINTETICA = 0.25;
export const PROB_CESPED_ALTO = 0.5;

// ---------------------------------------------------------------------------------
// Brief 018 — condiciones de los partidos de liga (generación) y umbrales de los hechos de
// efecto. Una sola fuente; las pruebas las importan.
// ---------------------------------------------------------------------------------

/**
 * «A veces» (brief §1): probabilidad de cada clima por perfil del país, sorteada por partido
 * (despejado = el resto). El frío no tiene efecto en el brief (los seis efectos no lo incluyen):
 * se registra y se muestra, nada más.
 */
// Brief 025: + niebla, rara y solo en los perfiles nórdico, lluvioso y de altura. Se toma de lo que
// antes era «despejado» (al final del intervalo): los demás climas sorteados no cambian.
export const PROB_CLIMA: Record<Clima, { calor: number; lluvia: number; frio: number; niebla: number }> = {
  tropical: { calor: 0.4, lluvia: 0.3, frio: 0, niebla: 0 },
  desertico: { calor: 0.55, lluvia: 0.03, frio: 0.05, niebla: 0 },
  templado: { calor: 0.2, lluvia: 0.2, frio: 0.1, niebla: 0 },
  nordico: { calor: 0, lluvia: 0.2, frio: 0.45, niebla: 0.08 },
  lluvioso: { calor: 0.03, lluvia: 0.55, frio: 0.1, niebla: 0.08 },
  de_altura: { calor: 0.02, lluvia: 0.15, frio: 0.35, niebla: 0.08 },
};

/**
 * `efecto_calor` (brief §3): pases del 2.º tiempo ≤ K % de los del 1.º, con calor registrado y
 * el 2.º tiempo terminado. Calibrado el 2 oct (A/B N=500, semillas 1..500): sin calor ningún
 * partido baja de 90 % (p10 = 99,6 %, mediana 109 %: el 2.º tiempo tiene más descuento); con
 * 41 °C la mediana cae a 90,6 % y el 46 % pasa el umbral; con 30 °C, el 2,4 %.
 */
export const CALOR_PASES_2T_MAX = 90;
/**
 * `cancha_incomoda` (brief §3): completación de pases CORTOS del visitante ≤ este % con césped
 * natural alto. Calibrado el 2 oct (N=500): sin césped alto, el 3,4 % de los visitantes ya
 * queda en ≤ 73 % (equipos flojos: por eso el hecho exige ADEMÁS el césped alto); con césped
 * alto, ~14 %. Muestra mínima para un prefijo (en vivo): CANCHA_CORTOS_MUESTRA_MIN pases cortos.
 * Verificación de Fable (2 oct): además, SIN lluvia — con lluvia la caída salía en el 55 % de los
 * partidos de césped alto (14 % en seco): la lluvia, no el césped, podía explicarla. Re-medido en
 * liga (720): 4,4 % de los partidos, 16,4 % de los 195 de césped alto sin lluvia (con el 019: 4,3 % y 15,9 %).
 */
export const CANCHA_CORTOS_MAX = 73;
export const CANCHA_CORTOS_MUESTRA_MIN = 60;
/**
 * `presion_que_ahoga` (brief §3): pérdidas en salida del presionado antes de SALIDA_TEMPRANA_MIN
 * (limites.ts). Calibrado el 2 oct (N=500): sin presión alta el visitante pierde 2,3 de media
 * ahí y llega a 8 en el 1,6 % de los partidos; con presión alta, 4,6 de media y 8+ en el 18,8 %.
 * Verificación de Fable (2 oct): SUBSUME a `perdidas_en_salida` del mismo equipo (mismas pérdidas,
 * con su causa: no se narran dos veces). Re-medido en liga (720): perdidas_en_salida pasa de 35,4 %
 * a 27,5 % (29,7 % con presión alta; 25,3 % sin), bajo RAREZA_MICRO_MAX (con el 019: 26,4 %).
 */
export const PRESION_PERDIDAS_MIN = 8;
// ---------------------------------------------------------------------------------
// Brief 019 — consecuencias: sanciones y rating de temporada. Una sola fuente.
// ---------------------------------------------------------------------------------
/** Jornadas de suspensión (brief §1). Acumulación de amarillas: fuera de alcance v1. */
export const SANCION_JORNADAS = { doble_amarilla: 1, roja_directa: 2 } as const;
/** Rating general (brief §3): mínimo de partidos jugados para entrar al top. */
export const RATING_PARTIDOS_MIN = 5;
/** Filas del top del rating en la pestaña Players. */
export const RATING_TOP = 15;

/**
 * `efecto_niebla` (brief 025): completación de los pases LARGOS (≥ 30 m) del partido ≤ este % con
 * niebla registrada, sobre una muestra mínima. Calibrado el 3 oct (N=500): sin niebla el 3,4 % de los
 * partidos ya queda ahí (mediana 68 %); con niebla, el 23,4 % (mediana 60 %).
 */
export const NIEBLA_LARGOS_MAX = 54;
export const NIEBLA_LARGOS_MUESTRA_MIN = 30;

// ---------------------------------------------------------------------------------
// Brief 026 — la grada: reacciones DERIVADAS de los datos (capa de vista pura, sin RNG salvo la
// identidad de la afición). Única fuente de umbrales y de las listas cerradas.
// ---------------------------------------------------------------------------------

/**
 * ¡Olé!: racha de pases completados consecutivos del mismo equipo (misma posesión), desde este minuto
 * y en ventaja. Delta de Fable (3 oct): 12 ⇒ 15, el olé tiene que sentirse ocasión. Medido: con 12,
 * 29,6 % de los partidos de liga (30,5 % sueltos); con 15, 10,0 % de liga (77 olés en 720) y 11,6 %
 * de sueltos 1..1000; mediana de la racha 16. Abrazado por los dos lados en las pruebas: semilla 23
 * (racha máxima exacta 15 ⇒ olé) y semilla 35 (máxima 14 ⇒ sin olé).
 */
export const OLE_RACHA_MIN = 15;
export const OLE_MINUTO_MIN = 60;
/** Ovación: el mejor valorado HASTA ese momento sale sustituido con al menos esta nota. */
export const OVACION_NOTA_MIN = 7.5;
/** Aliento: al llegar a este minuto, el local pierde por exactamente esta diferencia. */
export const ALIENTO_MINUTO = 75;
export const ALIENTO_DIFERENCIA = 1;
/** Las seis reacciones (lista cerrada), en el orden en que se emiten a igual momento. */
export const TIPOS_REACCION = ["ole", "rugido", "grito_visitante", "silbidos_descanso", "ovacion", "aliento"] as const;
/** Semilla de la identidad de la afición (flujo derivado por nombre de equipo: el mundo no cambia). */
export const AFICION_SEMILLA = 2026;
/** Identidad de la afición: colectivo + palabra de sílabas propias (ficción declarada). */
export const AFICION_COLECTIVOS = ["Marea", "Peña", "Coro", "Tribuna", "Muralla", "Oleaje"] as const;
export const AFICION_SILABAS = ["da", "ri", "no", "ve", "la", "so", "ta", "mi", "lu", "ce", "ra", "bo"] as const;
export const AFICION_FINALES = ["na", "ra", "ta", "sa"] as const;
/**
 * Cánticos: plantillas CERRADAS de una línea, letra 100 % original escrita para CRONISTA (cero
 * melodías ni letras adaptadas de nada real). {n} = el nombre propio del equipo; {s} = su sector.
 */
export const CANTICOS = [
  { es: "¡{n}, {n}, nadie te para!", en: "{n}, {n}, nobody can stop you!" },
  { es: "¡Somos {s} y no nos cansamos!", en: "We are {s} and we never tire!" },
  { es: "¡Una más, {n}, una más!", en: "One more, {n}, one more!" },
  { es: "¡De punta a punta, {n} manda!", en: "End to end, {n} is in charge!" },
  { es: "¡Toca, {n}, toca, que la tarde es tuya!", en: "Pass it, {n}, pass it, the afternoon is yours!" },
  { es: "¡Arriba, {n}, que la grada empuja!", en: "Up, {n}, the stand is pushing!" },
] as const;

// ---------------------------------------------------------------------------------
// Brief 027 — sanciones de club: el sorteo por temporada (rangos y probabilidades del generador).
// La banda de rareza va aparte, en sim/limites (RAREZA_SANCIONES_CLUB).
// ---------------------------------------------------------------------------------

/** Clubes sancionados por liga y temporada: probabilidad de 0, 1 y 2 (esperanza 0,8). */
export const PROB_CLUBES_SANCIONADOS = [0.4, 0.4, 0.2] as const;
export const DEDUCCION_PUNTOS = { min: 3, max: 9 } as const;
/** Puerta cerrada: partidos de LOCAL consecutivos. */
export const PUERTA_CERRADA_PARTIDOS = { min: 1, max: 3 } as const;
/** Límite de banco: jornadas consecutivas. */
export const LIMITE_BANCO_JORNADAS = { min: 2, max: 4 } as const;
/** La causa de cada tipo (coherente: el público cierra la puerta; lo administrativo, puntos y banco). */
export const CAUSAS_POR_TIPO = {
  deduccion: ["irregularidad_financiera", "alineacion_indebida"],
  puerta_cerrada: ["incidentes_de_publico"],
  limite_banco: ["alineacion_indebida", "irregularidad_financiera"],
} as const;

/** Rareza de los hechos de efecto sobre el corpus de liga (las 8 ligas, temporada 1): como en el 013, ≤ 35 %. */
export const RAREZA_CONDICION_MAX = 0.35;

/**
 * Presión v1 (brief §1): el nivel del LOCAL por liga; el visitante va siempre uno por encima
 * (baja ⇒ media, media ⇒ alta). Solo la presión ALTA tiene efecto (el 6). Elegido a mano por
 * Opus: cuatro ligas de ambiente caliente («media»: el visitante juega con presión alta) y
 * cuatro tranquilas, para que el mundo muestre los dos casos. Presión por puesto en la tabla:
 * queda para después (brief).
 */
export const PRESION_LOCAL_POR_LIGA: Record<string, "baja" | "media"> = {
  "liga-del-sol-alto": "media",
  "liga-de-las-dunas": "baja",
  "liga-de-los-valles": "media",
  "liga-del-norte-blanco": "baja",
  "liga-de-la-bruma": "media",
  "liga-de-las-cumbres": "media",
  "liga-del-oasis-hondo": "baja",
  "liga-de-los-fiordos": "baja",
};
