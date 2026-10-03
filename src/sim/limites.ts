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
  // Brief 015 (decisión de Fable): el techo baja de 0.50 a 0.30 — un xG ≥ 0.3 es una ocasión
  // clara de cerca, nunca un tiro desde el borde del área. Esos tiros van al área chica.
  frontal_del_area: { min: 0.01, max: 0.3, incluyeMax: false },
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

// ---------------------------------------------------------------------------------
// Brief 015 — magnitudes del tiro: distancia al arco (m) y velocidad del disparo (km/h).
// Bandas de credibilidad y coherencia: ÚNICA fuente (invariantes, suite estadística, V8).
// ---------------------------------------------------------------------------------

/** Distancia por zona de origen, en metros enteros, [min, max] inclusivos. El penal: 11 exacto. */
export const DISTANCIA_ZONA: Record<ZonaOrigen, { min: number; max: number }> = {
  area_chica: { min: 2, max: 6 },
  punto_penal: { min: 11, max: 11 },
  frontal_del_area: { min: 16, max: 22 },
  banda_izquierda: { min: 10, max: 24 },
  banda_derecha: { min: 10, max: 24 },
  media_distancia: { min: 20, max: 32 },
};

/** Coherencia distancia↔xG (el penal queda exento): un xG alto exige cerca; lejos exige xG bajo. */
export const XG_ALTO = { xgMin: 0.3, distanciaMax: 12 } as const;
export const TIRO_LEJANO = { distanciaMin: 20, xgMax: 0.15 } as const;


/** Velocidad del disparo: rango absoluto (jamás un «8 km/h»), penal y tiros lejanos. */
export const VELOCIDAD = { min: 60, max: 125 } as const;
export const VELOCIDAD_PENAL = { min: 75, max: 110 } as const;
export const VELOCIDAD_LEJANO = { distanciaMin: 20, min: 80 } as const;

/** Suite estadística: media de velocidad y colas (fracción de tiros por encima/debajo). */
export const VELOCIDAD_STATS = { mediaMin: 85, mediaMax: 95, colaAltaKmh: 110, colaBajaKmh: 70, colaMin: 0.02, colaMax: 0.15 } as const;

/** V8 computable (brief 015): «desde fuera del área» desde esta distancia; «un misil» desde esta velocidad. */
export const FUERA_DEL_AREA_M = 17;
export const MISIL_KMH = 100;

// ---------------------------------------------------------------------------------
// Brief 018 — condiciones del partido (clima, cancha, presión). Vocabularios cerrados, bandas
// de temperatura y las BANDAS de los A/B estadísticos: ÚNICA fuente. Los modificadores que
// producen los efectos viven en parametros.ts (CONDICIONES); las bandas de aquí se escribieron
// APARTE, como expectativa del brief, para que generador y prueba no se muevan juntos (la
// técnica de la copia independiente del 012/P12): si alguien toca un modificador, el A/B sale
// de su banda y se pone rojo.
// ---------------------------------------------------------------------------------

export const CLIMAS_PARTIDO = ["despejado", "calor", "lluvia", "frio"] as const;
export type ClimaPartido = (typeof CLIMAS_PARTIDO)[number];
export const SUPERFICIES = ["natural", "sintetica"] as const;
export type Superficie = (typeof SUPERFICIES)[number];
export const CESPEDES = ["corto", "alto"] as const;
export type Cesped = (typeof CESPEDES)[number];
export const NIVELES_PRESION = ["baja", "media", "alta"] as const;
export type NivelPresion = (typeof NIVELES_PRESION)[number];

/** Brief 018 §1: temperatura (°C enteros, inclusivos) de los climas que la registran. Despejado y lluvia no llevan. */
export const TEMPERATURA_C = { calor: { min: 29, max: 41 }, frio: { min: -8, max: 5 } } as const;

/**
 * Efecto 6 — ventana de la «salida nerviosa» que MIDEN el A/B y el Analista: pérdidas en la
 * zona de salida antes de este minuto (brief: «los primeros 25'»). El generador tiene su
 * propia copia en parametros.ts (CONDICIONES.presionHastaMin).
 */
export const SALIDA_TEMPRANA_MIN = 25;

// ---------------------------------------------------------------------------------
// Brief 021 — la pizarra 3D. Las magnitudes de la ESCENA (no del partido): cómo se traduce cada
// campo registrado a metros y segundos. Única fuente; las pruebas las importan.
// ---------------------------------------------------------------------------------

/** Altura (m) a la que entra el balón según la `altura` registrada (el travesaño está a 2,44 m). */
export const ALTURA_DESTINO_M = { raso: 0.25, media: 1.2, alta: 2.1 } as const;
export const ARCO_3D = { anchoM: 7.32, altoM: 2.44 } as const;
/** Altura del balón al salir: del suelo; de cabeza o de chilena/tijera, a la altura del remate aéreo. */
export const SALIDA_M = { suelo: 0.2, cabezazo: 1.9, chilena: 1.6 } as const;
/** Comba (m por encima de la recta) de cada tramo según la altura o la definición registradas. */
// Calibrado a ojo en el smoke del 2 oct: un remate «alto» no es una vaselina (con 2 m de comba el
// penal parecía bombeado); la altura ya la da el destino registrado.
export const COMBA_M = { raso: 0.1, media: 0.35, alta: 0.7, vaselina: 4.2, media_cancha: 9.0, pase: 1.2 } as const;
/**
 * Cámara lenta de la escena: la duración del vuelo es distanciaM / velocidad (m/s) × este factor
 * (un remate dura < 1 s: a velocidad real no se ve). El pase previo no tiene velocidad registrada:
 * dura PASE_3D_S (convención de la escena, rotulada como tal en sus fuentes).
 */
export const CAMARA_LENTA = 4;
export const PASE_3D_S = 1.4;
/** Tolerancia de la prueba de duración (s) y presupuesto del chunk 3D (KB gzip). */
export const DURACION_3D_TOLERANCIA_S = 0.01;
export const PRESUPUESTO_CHUNK_3D_KB = 180;

// ---------------------------------------------------------------------------------
// Brief 020 (rev 1.1) — definiciones del tiro y autogoles. Vocabulario, coherencias duras y
// rarezas: ÚNICA fuente. Las definiciones ANIDAN dentro del contrato del 015 (60–125 km/h).
// ---------------------------------------------------------------------------------

export const DEFINICIONES = ["jugada", "cabezazo", "mano_a_mano", "vaselina", "chilena", "tijera", "media_cancha"] as const;
export type Definicion = (typeof DEFINICIONES)[number];

/** Coherencias duras (brief 020 rev 1.1). Velocidades dentro de VELOCIDAD (el «jamás» del 015 no se reabre). */
export const DEF_CABEZAZO = { velocidad: { min: 60, max: 75 } } as const;
export const DEF_VASELINA = { velocidad: { min: 60, max: 70 } } as const;
export const DEF_MANO_A_MANO = { xgMin: 0.2 } as const;
/** La cola nueva de distancia: SOLO media_cancha pasa del máximo de DISTANCIA_ZONA. */
export const DEF_MEDIA_CANCHA = { distancia: { min: 40, max: 55 }, xgMax: 0.03, velocidadMin: 85 } as const;

/**
 * Rareza objetivo ENTRE LOS GOLES (sin autogoles), suite estadística N=1000: fracción [min, max].
 * Chilena y tijera caen juntas en una banda (la tijera es su variante).
 * Medido el 2 oct (2.855 goles, semillas 1..1000): cabezazo 13,56 % · mano a mano 9,11 % · vaselina
 * 1,65 % · chilena o tijera 0,25 % (7 goles: 6 + 1) · media cancha 0,14 % (4 goles). Mano a mano:
 * con xG ≥ 0,20 solo 7,96 % de goles elegibles (< 8 %) ⇒ se aceptó además el pase atrás (rev 1.1).
 * Velocidad del corpus tras las reescrituras: media 90,4 km/h, p5 66 (cola < 70: 8,0 %).
 */
export const RAREZA_DEFINICION = {
  cabezazo: { min: 0.12, max: 0.18 },
  mano_a_mano: { min: 0.08, max: 0.14 },
  vaselina: { min: 0.01, max: 0.03 },
  chilena_o_tijera: { min: 0.001, max: 0.004 },
  media_cancha: { min: 0.0005, max: 0.0025 },
} as const;

/**
 * Autogoles (solo con config.variantes.autogoles): rareza entre los goles (brief: ~2–3 %). Medido:
 * 2,84 % (semillas sueltas con la variante) y 2,88 % en la liga (55 de 1.913 goles; ~7,6 % de los partidos).
 */
export const RAREZA_AUTOGOL = { min: 0.015, max: 0.035 } as const;

// ---------------------------------------------------------------------------------
// Brief 019 — lesiones (solo con config.variantes.lesiones). Severidad y rareza: ÚNICA fuente.
// ---------------------------------------------------------------------------------

/** Jornadas de baja de una lesión [min, max] y su reparto (severidad sorteada; leve la mayoría). */
export const LESION_JORNADAS = { min: 1, max: 4 } as const;
export const LESION_SEVERIDAD: Record<1 | 2 | 3 | 4, number> = { 1: 0.4, 2: 0.3, 3: 0.2, 4: 0.1 };
/**
 * Rareza (brief: ~0,3 lesiones por partido): media del corpus dentro de esta banda. Medido el 2 oct:
 * liga completa (720) 0,301; semillas sueltas 1..1000 con la variante, 0,371. Severidad en liga:
 * 86 / 72 / 39 / 20 lesiones de 1 / 2 / 3 / 4 jornadas.
 */
export const LESIONES_MEDIA = { min: 0.2, max: 0.4 } as const;

/** Tamaño de cada brazo de los A/B del brief 018 (condición vs control, mismas semillas). */
export const N_AB = 500;

/**
 * Bandas de los A/B (cociente = condición / control sobre el corpus, salvo donde dice
 * «diferencia»). Cada banda exige el SIGNO (el intervalo no contiene el 1 o el 0) y acota la
 * magnitud por los dos lados.
 */
export const AB_CONDICIONES = {
  /** Efecto 1 a 41 °C: pases y tiros del 2.º tiempo (cociente). El 1.er tiempo no cambia. */
  calorPases2T: { min: 0.72, max: 0.9 },
  calorTiros2T: { min: 0.6, max: 0.92 },
  /** Efecto 1, gradiente: el cociente de pases a 30 °C queda entre el de 41 °C y 1. */
  calorTemperaturaBaja: 30,
  /** Efecto 2 a 41 °C: faltas del 2.º tiempo (cociente). */
  calorFaltas2T: { min: 1.15, max: 1.7 },
  /** Efecto 3: completación de pases (diferencia absoluta) y atajadas que terminan en córner (cociente). */
  lluviaCompletacion: { min: -0.08, max: -0.025 },
  lluviaCornerTrasAtajada: { min: 1.25, max: 2.1 },
  /** Efecto 4: velocidad media del tiro (diferencia, km/h) y fracción de tiros de media distancia (cociente). */
  sinteticaVelocidadKmh: { min: 2.5, max: 8 },
  sinteticaMediaDistancia: { min: 1.15, max: 1.8 },
  /** Efecto 5: completación de pases CORTOS del visitante (diferencia) y la del local, que no se mueve (|diferencia| ≤). */
  cespedVisitaCortos: { min: -0.1, max: -0.03 },
  cespedLocalTolerancia: 0.015,
  /** Efecto 6: pérdidas en salida del presionado antes de SALIDA_TEMPRANA_MIN (cociente) y después (cociente, sin efecto). */
  presionSalidaTemprana: { min: 1.3, max: 2.6 },
  presionSalidaDespues: { min: 0.9, max: 1.1 },
} as const;
