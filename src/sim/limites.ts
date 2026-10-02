// Umbrales estadísticos del simulador — ÚNICA fuente de estas cifras.
// Las pruebas los importan; ninguna prueba repite un número de este archivo a mano.
// Si un umbral parece mal, se reporta a Fable; no se mueve para que una prueba pase.
//
// Referencias de orden de magnitud: ligas top europeas de las últimas temporadas
// (goles ~2.7–2.9/partido, xG total ~2.7–3.0, amarillas ~3.5–4.5, roja en ~10–15 %
// de los partidos, ~20–23 % de los goles en el último cuarto de hora con descuento).
// Las cifras que el brief da como "~" se respetan; las que no da las fijó el
// implementador ANTES de calibrar el motor (pendientes de validación por Fable).

/** Tamaño del corpus de la suite estadística: semillas 1..N (brief, sección Estadísticas). */
export const N_ESTADISTICA = 1000;

/** Prop. 7 — media de goles por partido (ambos equipos). Brief: ~[2.2, 3.4]. */
export const GOLES_MEDIA = { min: 2.2, max: 3.4 } as const;

/**
 * Prop. 8 — fracción de goles que cae en cada franja de 15' (6 franjas:
 * 0–15, 15–30, 30–45+desc, 45–60, 60–75, 75–90+desc). Reparto uniforme = 1/6 ≈ 0.167.
 * - `min`: ninguna franja puede quedar "muerta" (por debajo de 10 %).
 * - `max`: ninguna franja puede acaparar más de 24 %, salvo la última, que incluye
 *   el descuento y el cansancio y puede ir por encima (lo permite el brief).
 */
export const GOLES_FRANJA = { franjas: 6, min: 0.1, max: 0.24 } as const;

/** Prop. 9 — media de xG total por partido (suma de ambos equipos). */
export const XG_MEDIA = { min: 2.2, max: 3.4 } as const;

/**
 * Prop. 10 — escenario fuerte vs débil: el fuerte tiene ataque 80 frente a la
 * defensa 60 del rival, y el rival ataca con 60 frente a la defensa 80 del fuerte.
 * Fracción de victorias del fuerte (empates no cuentan como victoria). Brief: ~[55 %, 85 %].
 */
export const VENTAJA_FUERTE = {
  fuerte: { ataque: 80, defensa: 80 },
  debil: { ataque: 60, defensa: 60 },
  min: 0.55,
  max: 0.85,
} as const;

/** Prop. 11 — media de tarjetas amarillas por partido (ambos equipos). */
export const AMARILLAS_MEDIA = { min: 2.5, max: 5.0 } as const;

/** Prop. 11 — fracción máxima de partidos con al menos una tarjeta roja. */
export const ROJA_MAX_FRACCION = 0.2;

/**
 * Agregado por el implementador (no está en el brief): fracción MÍNIMA de partidos
 * con roja. Sin rojas en el corpus, la invariante 4 sería vacía (nunca se ejercitaría).
 */
export const ROJA_MIN_FRACCION = 0.02;

/**
 * Prop. 16 (revisión 1.1, [B3]) — fracción MÍNIMA de partidos del corpus de la suite
 * rápida cuyo `fin_periodo` final cae después del minuto 90. En el fútbol real casi
 * todos los segundos tiempos tienen descuento; exigir 90 % deja margen sin permitir
 * que el descuento desaparezca en silencio.
 */
export const DESCUENTO_FINAL_FRACCION_MIN = 0.9;

/**
 * Prop. 12 — los tres estilos deben ser distinguibles. Cada estilo se mide como
 * equipo local con ataque/defensa iguales al rival; el ratio se calcula contra el
 * MAYOR de los otros dos estilos (así se distingue de cada uno, no del promedio).
 * - posesión ⇒ más pases clave por partido (brief).
 * - contragolpe ⇒ mayor xG medio por tiro (brief).
 * - presión ⇒ más faltas cometidas por partido (elección del implementador para que
 *   el tercer estilo también tenga firma propia; pendiente de validación).
 */
export const ESTILOS = {
  /** Rating común de ambos equipos en el experimento de estilos. */
  rating: 70,
  pasesClavePosesionRatioMin: 1.15,
  xgPorTiroContragolpeRatioMin: 1.1,
  faltasPresionRatioMin: 1.15,
} as const;

// ---------------------------------------------------------------------------------
// Brief 011 (rev 1.1) — detalle espacial. Vocabularios cerrados y bandas de coherencia:
// ÚNICA fuente. Las invariantes y las pruebas los importan; el auditor los puede atacar.
// ---------------------------------------------------------------------------------

/** Zona de origen de un tiro (y su gol) o de un pase clave. */
export const ZONAS_ORIGEN = ["area_chica", "punto_penal", "frontal_del_area", "banda_izquierda", "banda_derecha", "media_distancia"] as const;
export type ZonaOrigen = (typeof ZONAS_ORIGEN)[number];

/** A qué parte del arco fue el tiro, visto DESDE EL TIRADOR. */
export const DESTINOS = ["palo_izquierdo", "palo_derecho", "centro_del_arco"] as const;
export type Destino = (typeof DESTINOS)[number];

export const ALTURAS = ["raso", "media", "alta"] as const;
export type Altura = (typeof ALTURAS)[number];

/** Lado hacia el que se tiró el portero, visto DESDE EL PORTERO. */
export const LADOS_PORTERO = ["su_izquierda", "su_derecha", "centro"] as const;
export type LadoPortero = (typeof LADOS_PORTERO)[number];

/** Banda desde la que se saca un córner. */
export const BANDAS = ["izquierda", "derecha"] as const;
export type Banda = (typeof BANDAS)[number];

/**
 * Tabla fija destino del tiro → lado del portero (el tirador y el portero se miran de
 * frente: el palo izquierdo del tirador es la derecha del portero).
 */
export const LADO_PORTERO_DE: Record<Destino, LadoPortero> = {
  palo_izquierdo: "su_derecha",
  palo_derecho: "su_izquierda",
  centro_del_arco: "centro",
};

/** Zonas «de área»: un tiro nacido de un córner (cabezazo) solo puede salir de aquí. */
export const ZONAS_AREA: readonly ZonaOrigen[] = ["area_chica", "frontal_del_area"];

/** Zonas posibles de un pase clave (nadie da un pase clave desde el punto penal ni el área chica). */
export const ZONAS_ORIGEN_PASE: readonly ZonaOrigen[] = ["banda_izquierda", "banda_derecha", "frontal_del_area", "media_distancia"];

/** xG de un penal (el simulador lo usa tal cual; es la banda exacta del punto penal). */
export const XG_PENAL = 0.76;

/**
 * Brief 012 §F1 — matriz COMPLETA de bandas xG por zona de origen (antes: solo área chica y
 * media distancia). `[min, max]` si `incluyeMax`, `[min, max)` si no. El generador sortea
 * solo zonas cuya banda contiene el xG del tiro y el invariante lo exige en el corpus.
 */
export const ZONA_XG_BANDAS: Record<ZonaOrigen, { min: number; max: number; incluyeMax: boolean }> = {
  area_chica: { min: 0.15, max: 1.0, incluyeMax: true },
  punto_penal: { min: XG_PENAL, max: XG_PENAL, incluyeMax: true },
  // Rev 1.1 del 012: el piso del frontal baja a 0.01 (un tiro raso desde el frontal tras el
  // despeje de un córner es fútbol normal): así todo tiro tras córner tiene zona de área.
  frontal_del_area: { min: 0.01, max: 0.5, incluyeMax: false },
  banda_izquierda: { min: 0.01, max: 0.3, incluyeMax: false },
  banda_derecha: { min: 0.01, max: 0.3, incluyeMax: false },
  media_distancia: { min: 0.01, max: 0.15, incluyeMax: false },
};

/**
 * Brief 012 §F4 — UNA definición de «tiro tras córner» (la comparten generador, invariante
 * y pizarra): el siguiente evento de ataque del stream después del córner es ese tiro, del
 * mismo equipo, a lo sumo `TRAS_CORNER_MAX_MIN` minutos después.
 */
export const TIPOS_ATAQUE: readonly string[] = ["tiro", "gol", "atajada", "corner", "pase_clave", "fuera_de_juego"];
export const TRAS_CORNER_MAX_MIN = 1;

// ---------------------------------------------------------------------------------
// Brief 013 (rev 1.1) — capa de micro-eventos. Vocabularios y umbrales de realismo:
// ÚNICA fuente. La suite estadística propia (micro.stats.test.ts) y los invariantes los
// importan; ninguna prueba los repite a mano.
// ---------------------------------------------------------------------------------

/** Tipos de micro-evento. */
export const TIPOS_MICRO = ["pase", "conduccion", "regate", "duelo", "perdida", "recuperacion"] as const;
export type TipoMicro = (typeof TIPOS_MICRO)[number];

/** Canal (vista del equipo que ataca: su izquierda es banda_izquierda). */
export const CANALES = ["banda_izquierda", "centro", "banda_derecha"] as const;
export type Canal = (typeof CANALES)[number];

/** Volumen por partido: cada partido en [min, max] y el promedio del corpus ≥ mediaMin. */
export const MICRO_TOTAL = { min: 1800, max: 2600, mediaMin: 2000 } as const;
/** Pases por partido (media del corpus) y fracción de completados (media). */
export const MICRO_PASES = { mediaMin: 850, mediaMax: 1000, completadosMin: 0.78, completadosMax: 0.85 } as const;
/** Regates exitosos (fracción de intentos, media del corpus). */
export const MICRO_REGATES_EXITO = { min: 0.45, max: 0.65 } as const;
/**
 * Correlación con ATT: en los partidos donde un equipo tiene al menos `difAtaqueMin` más de
 * ataque que el otro, el de más ATT completa una fracción mayor de pases en al menos
 * `fraccionMin` de esos partidos.
 */
export const MICRO_ATT = { difAtaqueMin: 10, fraccionMin: 0.6 } as const;

/**
 * Magnitudes (rev 1.1): distancia de cada pase y metros de cada conducción. Bandas de pase
 * [min, max) salvo la última, que incluye su máximo. Mezcla realista (corto la mayoría).
 * Coherencia con la zona: un pase LARGO no sale de la zona de ataque.
 */
export const PASE_M = { corto: { min: 4, max: 15 }, medio: { min: 15, max: 30 }, largo: { min: 30, max: 55 } } as const;
export const CONDUCCION_M = { min: 2, max: 25 } as const;
/** Mezcla de pases (fracción de cortos/largos sobre el corpus) — banda de realismo. */
export const PASE_MEZCLA = { cortosMin: 0.5, cortosMax: 0.75, largosMin: 0.05, largosMax: 0.15 } as const;
