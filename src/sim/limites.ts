import type { TipoEventoArena } from "../arena/tipos";

// Umbrales estadísticos del simulador — ÚNICA fuente de estas cifras.
// Las pruebas los importan; ninguna prueba repite un número de este archivo a mano.
// Si un umbral parece mal, se reporta a Fable; no se mueve para que una prueba pase.
//
// Referencias de orden de magnitud: ligas top europeas de las últimas temporadas
// (REFERENCIA_LIGAS_TOP, abajo: goles, xG, amarillas, partidos con roja y goles en el último
// cuarto de hora con descuento). Las cifras que el brief da como "~" se respetan; las que no da
// las fijó el implementador ANTES de calibrar el motor (pendientes de validación por Fable).

/**
 * Brief 028: las referencias de orden de magnitud de este comentario, como dato (el DATASHEET las
 * muestra junto a lo medido; antes vivían solo en el comentario). Son aproximadas («~»): NO son
 * bandas de ninguna prueba.
 */
export const REFERENCIA_LIGAS_TOP = {
  golesPorPartido: { min: 2.7, max: 2.9 },
  xgPorPartido: { min: 2.7, max: 3.0 },
  amarillasPorPartido: { min: 3.5, max: 4.5 },
  partidosConRoja: { min: 0.1, max: 0.15 },
  golesUltimoCuartoDeHora: { min: 0.2, max: 0.23 },
} as const;

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

// Brief 025: + niebla (rara: solo perfiles nórdico, lluvioso y de altura).
export const CLIMAS_PARTIDO = ["despejado", "calor", "lluvia", "frio", "niebla"] as const;
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
// Brief 025 — eventos insólitos (solo con config.variantes.insolitos). Vocabularios, coherencias
// y rarezas: ÚNICA fuente. Las probabilidades que las producen viven en parametros.INSOLITOS.
// ---------------------------------------------------------------------------------

/** Interrupción breve: causas FICTICIAS de lista cerrada y su duración (min), que se suma al descuento. */
export const CAUSAS_INTERRUPCION = ["perro", "objeto", "globos"] as const;
export type CausaInterrupcion = (typeof CAUSAS_INTERRUPCION)[number];
export const DURACION_INTERRUPCION = { min: 1, max: 3 } as const;
/** El portero solo sube a un córner desde este minuto, con su equipo perdiendo por exactamente 1. */
export const SUBIDA_MINUTO_MIN = 88;
/** xG que registra un gol olímpico (no hay tiro del que heredarlo: es la probabilidad de un córner directo). */
export const XG_OLIMPICO = 0.01;
/**
 * Rarezas objetivo (brief 025), medidas en el corpus de liga:
 * - olímpico: fracción de los goles; subida: fracción de los córners elegibles;
 * - alPalo: fracción de los tiros no gol (atajados incluidos); doble: fracción de los tiros al palo;
 * - interrupción: fracción de los partidos.
 * Medido el 3 oct (liga, 720 partidos, temporada actual): olímpico 1 de 1.934 goles (0,05 %); subida
 * 2 de 132 córners elegibles (1,52 %), 0 goles de portero (no tiene banda: «la que salga»); al palo
 * 520 de 16.301 tiros no gol (3,19 %); doble 6 de 520 (1,15 %); interrupción 12 de 720 (1,67 %) con
 * los dos tiempos; tras el delta (solo 2.º tiempo, pInterrupcion 0,016): 11 de 720 (1,53 %).
 * Semillas sueltas 1..6000 con la variante: 8 olímpicos de 16.523 goles (0,05 %), 30 subidas, 1
 * remate de portero, 0 goles de portero, 49 dobles, 83 interrupciones. Ninguna banda vacía.
 */
export const RAREZA_INSOLITOS = {
  olimpico: { min: 0.0002, max: 0.001 },
  subida: { min: 0.01, max: 0.03 },
  alPalo: { min: 0.02, max: 0.05 },
  doblePalo: { min: 0.005, max: 0.02 },
  interrupcion: { min: 0.01, max: 0.02 },
} as const;
/**
 * A/B de la niebla (N_AB, banda aparte de parametros): completación de pases LARGOS (diferencia) y la
 * de los cortos (sin efecto). Medido: largos −0,0791, cortos 0,0000.
 */
export const AB_NIEBLA = { largos: { min: -0.12, max: -0.04 }, cortosTolerancia: 0.01 } as const;

// ---------------------------------------------------------------------------------
// Brief 024 — nivel por jugador. Bandas de los A/B DENTRO del equipo (tercil alto − tercil bajo
// del plantel, mismos partidos, con la variante), escritas ANTES de calibrar y aparte de los
// modificadores (parametros.NIVELES): la técnica de la copia independiente.
// ---------------------------------------------------------------------------------

export const NIVEL = { min: 1, max: 100 } as const;
/** El «tercil» de un plantel de 16 en los A/B y en la figura: los 6 de más nivel / los 6 de menos (⌈16/3⌉). */
export const TERCIL_PLANTEL = 6;
export const N_AB_NIVELES = 500;
export const AB_NIVELES = {
  /** Completación de pases (diferencia alto − bajo). */
  pases: { min: 0.02, max: 0.08 },
  /** Éxito en regates y duelos (diferencia). */
  regatesDuelos: { min: 0.035, max: 0.12 },
  /** Remates por jugador y partido (cociente alto / bajo). */
  remates: { min: 1.3, max: 2.3 },
  /** xG medio por remate (cociente alto / bajo). */
  xgPorRemate: { min: 1.05, max: 1.35 },
  /** Atajadas sobre tiros no convertidos: porteros por encima de su media vs por debajo (diferencia). */
  atajadas: { min: 0.03, max: 0.13 },
  /** Sin la variante, la misma medición tiene que dar ~0 (|diferencia| ≤, o cociente en [1/x, x]). */
  controlDiferencia: 0.012,
  controlCociente: 1.08,
} as const;
/**
 * La figura del partido (009) cae en el tercil alto de su plantel en al menos esta fracción de los partidos de liga.
 * Medido el 3 oct (720 partidos): 56,8 % (sin niveles sería ~1/3). Los A/B: pases +0,034 · regates/duelos
 * +0,065 · remates ×1,87 · xG por remate ×1,17 · atajadas +0,085 (control sin variante: ~0). Totales de liga
 * contra las MISMAS configs sin la variante: goles 2,657 → 2,682 (+0,9 %), xG 2,697 → 2,739 (+1,6 %),
 * amarillas 3,97 → 3,95, partidos con roja 10,4 → 11,0 % — dentro de las bandas de siempre.
 */
export const FIGURA_TERCIL_ALTO_MIN = 0.55;

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

// Brief 025: + olimpico (el córner entra directo: el gol cuelga del córner, sin tiro).
export const DEFINICIONES = ["jugada", "cabezazo", "mano_a_mano", "vaselina", "chilena", "tijera", "media_cancha", "olimpico"] as const;
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

// ---------------------------------------------------------------------------------
// Brief 027 — sanciones de club (solo liga, con config.variantes.sanciones). Vocabularios y
// contrato: ÚNICA fuente. Los rangos y probabilidades del sorteo viven en analista/umbrales.
// ---------------------------------------------------------------------------------

/** Los tres tipos (lista cerrada). */
export const TIPOS_SANCION_CLUB = ["deduccion", "puerta_cerrada", "limite_banco"] as const;
export type TipoSancionClub = (typeof TIPOS_SANCION_CLUB)[number];
/** Causas FICTICIAS de lista cerrada (cero casos reales). */
export const CAUSAS_SANCION_CLUB = ["irregularidad_financiera", "alineacion_indebida", "incidentes_de_publico"] as const;
export type CausaSancionClub = (typeof CAUSAS_SANCION_CLUB)[number];
/** Límite de banco: suplentes disponibles (los primeros del banco) en vez de los 5. */
export const BANCO_LIMITADO = 3;
/**
 * Rareza (banda aparte del generador): clubes sancionados por liga y temporada — media en banda
 * (esperanza del brief ~0,8) y nunca más de `max`.
 */
export const RAREZA_SANCIONES_CLUB = { media: { min: 0.6, max: 1.0 }, max: 2 } as const;
/** A/B de la puerta cerrada (N_AB): pérdidas tempranas del visitante con presión alta vs puerta cerrada, cociente sobre la base. */
export const AB_PUERTA_CERRADA = { cocienteBase: { min: 0.9, max: 1.1 } } as const;
/** Brief 034: prototipo espacial independiente; cifras sintéticas por calibrar.
 * No intervienen en el motor histórico. Unidades: metros y segundos. */
export const ARENA = {
  version: "arena-v3", versionPersonalidades: "arena-v2", versionLegado: "arena-v1",
  largoM: 105, anchoM: 68, arcoM: 7.32,
  pasoS: 0.1, fotogramaS: 0.5,
  duracionS: 180, duracionMaxS: 180,
  intervaloS: 15, intervaloMinS: 2, intervaloMaxS: 30,
  maxRondas: 90, esperaMs: 60_000, esperaMaxMs: 60_000, tokensOrdenes: 2048, intentosOrdenes: 2,
  aceleracionMps2: 3, velocidadMps: 6.5,
  velocidadBalonMps: 17, velocidadTiroMps: 24,
  controlM: 1.1, controlPorteroM: 1.7,
  separacionM: 1.6, toleranciaM: 0.2,
  accionCadaS: 2, radioTiroM: 25, paseMaxM: 32,
  recuperacionCadaS: 0.8, archivoMaxBytes: 8_000_000,
  paseMinM: 4, avanceMinPaseM: -8, margenPase: 1.5,
  pesoAvanceDirecto: 1.5, pesoDistanciaPase: 0.15, margenUtilM: 8,
  ajusteLongitud: 0.25, ajusteAncho: 0.2, ajusteMaxM: 10,
  avanceConduccionM: 15, velocidadMinFactor: 0.9, velocidadNivelFactor: 0.2,
  energiaMin: 0.4, energiaPorMetro: 0.00015, recuperacionEnergiaS: 0.0002,
  factorCalor: 1.5, factorEnergiaMin: 0.8,
  errorPaseM: 2, errorLluviaM: 0.5, errorTiroM: 9,
  dueloBase: 0.35, dueloNivel: 0.004, dueloFuerza: 0.002,
  dueloMin: 0.1, dueloMax: 0.75, ignorarAutorS: 0.4,
  areaLargoM: 16.5, areaAnchoM: 40.32,
  /** Brief 044: reglas que el motor declara en cada configuración nueva (`ConfigArena.reglas`).
   * Brief 046: reinicios-v4 (portero con el balón en las manos, salida a achicar y centros).
   * Brief 051: reinicios-v5 (remate colocado, potencia, balón por encima y portero con nivel).
   * Brief 063 (publicación 1): reinicios-v6 (repliegue de emergencia y persecución tras pérdida).
   * Brief 063 (publicación 2): reinicios-v7 (atributos de jugador, balones largos y remates lejanos).
   * Brief 063 (publicación 3): reinicios-v8 (identidad de juego del club).
   * Brief 065: reinicios-v9 (remate más preciso y portero con menos alcance, REMATE_ARENA_V9). */
  reglas: "reinicios-v9",
  /** Jugadores de cada plantilla de arena-v3: once titulares más el banco. */
  plantillaArena: 16,
  /** Probabilidad de que el portero desvíe (en vez de atrapar) un remate que toca. */
  desvioProbabilidad: 0.35,
  /** Desplazamiento lateral (m) del destino del desvío respecto del centro del arco. */
  desvioLateralM: 6,
  /** Distancia mínima (m) de los rivales al punto de saque: banda, esquina y meta. */
  distanciaSaqueBandaM: 2.1, distanciaSaqueEsquinaM: 10.2, distanciaSaqueMetaM: 9.65,
  /** Saque de centro: x propia máxima (m) del equipo que saca y de su rival. */
  centroPropioMaxM: 50, centroRivalMaxM: 43,
  /** Destino del desvío: metros más allá de la línea de fondo propia del portero. */
  desvioFondoM: 1,
  /** Con reinicios, el remate apunta este margen (m) detrás de la línea de gol rival. */
  remateTrasLineaM: 0.5,
  /** Saque de meta: margen (m) fuera del área para los rivales. */
  margenAreaMetaM: 0.5,
  /** Punto de saque de esquina (m) desde cada línea y distancia del saque de meta a la línea de fondo. */
  esquinaM: 0.3, saqueMetaM: 5.5,
  /** Temperatura (°C) asignada cuando se pide calor o frío sin indicarla; dentro de TEMPERATURA_C. */
  temperaturaDefectoC: { calor: 32, frio: -2 },
  amplitud: { estrecha: 0.8, media: 1, amplia: 1.1 },
  alturaBloqueM: { bajo: -6, medio: 0, alto: 6 },
} as const;

/** Brief 046 · Portero (reinicios-v4). Cifras sintéticas por calibrar. */
export const PORTERO_ARENA = {
  /** Radio (m) desde el centro del arco propio en el que un poseedor rival sin defensores de
   * campo por delante activa la salida. Mayor que ARENA.radioTiroM para salir antes del remate. */
  manoAManoRadioM: 28,
  /** Salida: distancia al balón que conserva = max(holguraM, fraccion × distancia arco–balón). */
  salidaFraccion: 0.3, salidaHolguraM: 1,
  /** Distancia máxima (m) de la salida desde el centro del arco (dentro del área de 16,5 m). */
  salidaMaxM: 14,
  /** Radio de atajada ante un remate: controlPorteroM × min(1, d/reaccionM), nunca menor que
   * cuerpoM; d = distancia del origen del remate al portero. Un remate a bocajarro reduce el
   * tiempo de reacción. */
  reaccionM: 8, cuerpoM: 0.5,
  /** Balón en las manos: plazo (s) para ponerlo en juego. Siempre mayor que
   * ARENA.accionCadaS / min(TECNICA_ARENA.ritmo) (2 / 0,85 ≈ 2,35 s), así que existe una
   * ventana para soltar. Mientras dura, ARENA.recuperacionCadaS no se aplica al portero: nadie
   * puede disputarle el balón. */
  manosMaxS: 4,
  /** Distancia (m) que los rivales respetan con el portero que tiene el balón en las manos;
   * hasta vencer el plazo, el portero no suelta mientras un rival esté más cerca. */
  distanciaManosM: 4,
  /** Brief 046 v1.2 · histéresis: los rivales se mantienen a distanciaManosM + margenManosM del
   * portero con manos; el saque voluntario solo se bloquea a menos de distanciaManosM. Con la
   * tolerancia de llegada (ARENA.toleranciaM) un rival respetuoso nunca bloquea el saque. */
  margenManosM: 1.5,
  /** v1.2 · un saque desde las manos a más de estos metros va por arriba: usa la fase aérea del
   * centro (solo se toca a ≤ ATAQUE_ARENA.caidaM de su caída). Ajuste 1 de 2 permitido por la v1.2:
   * 20 → 25, porque con 20 un saque aéreo de 24,8 m (semilla 23) se interceptaba en la caída al
   * segundo exacto y el lote 1–100 incumplía «intercepción inmediata = 0». */
  saqueAereoMinM: 25,
  /** v1.2 · un saque corto exige línea limpia: ningún rival a menos de estos metros del segmento. */
  lineaSaqueMinM: 3,
  /** Alcance máximo (m) del saque voluntario del portero desde las manos (el pase normal es
   * paseMaxM). El saque forzado al vencer el plazo no tiene límite de distancia (brief 046 v1.1). */
  saqueManosMaxM: 40,
} as const;

/** Brief 046 · Conducción y centros (reinicios-v4). Coordenadas orientadas: el atacante va hacia x = largoM. */
export const ATAQUE_ARENA = {
  /** x orientada desde la que la banda (|y − ancho/2| ≥ areaAnchoM/2) es zona de centro. */
  zonaCentroXM: 75,
  /** La conducción nunca apunta a menos de estos metros de la línea de fondo ni de banda. */
  margenFondoM: 2, margenBandaM: 2,
  /** Un `conducir` a menos de esta distancia (m) de su destino se renueva (antes, 0,2 m). */
  renovarConduccionM: 2,
  /** Punto de giro en la zona de centro: (largoM − giroFondoM, borde del área − giroInteriorM). */
  giroFondoM: 6, giroInteriorM: 2,
  /** Objetivos del centro: palo cercano y lejano a paloXM de la línea y ±paloYM del centro del
   * arco; punto penal a penalXM. */
  paloXM: 5.5, paloYM: 3, penalXM: 11,
  /** Un compañero de campo a ≤ llegadaM del objetivo puede ser el receptor del centro. */
  llegadaM: 14,
  /** Distancia máxima (m) de un centro. */
  centroMaxM: 40,
  /** Fase aérea: el centro solo se puede tocar en puntos de su trayectoria a ≤ caidaM de su destino. */
  caidaM: 5,
  /** Un jugador que prefiere conducir solo centra desde esta x o en el punto de giro. */
  conductorCentroXM: 95,
  /** Jugadores que atacan el área: palo cercano, palo lejano, punto penal (M08 del brief 033). */
  rematadores: 3,
  /** La llegada no rebasa la línea de fuera de juego vigente menos este margen (m). */
  margenFueraJuegoM: 0.5,
  /** v1.2 · el destino de un `centrar` queda al menos a estos metros de la línea de gol rival. */
  margenLineaCentroM: 1.5,
} as const;

/**
 * Brief 046 · Métricas de lote de la arena (controladores programados) y sus bandas. Las calcula
 * `src/arena/metricas-lote.ts`, que muestrea todos los ticks. Un denominador cero es «sin
 * muestra» y nunca cuenta como cumplimiento. `rapido` corre en `npm test` (semillas 1–30) y
 * `completo` en `npm run test:stats` (semillas 1–100), donde además el mismo lote bajo
 * reinicios-v3 debe incumplir `contraste` (pérdidas tras atajada, mediana del desplazamiento y
 * proporción de centros; v1.2: también goles tras saque). v1.2: las bandas de saques desde las
 * manos sustituyen a la antigua «pérdida del portero en su área» y se exigen también en el segundo
 * lote (segundoLoteDesde).
 */
export const LOTE_ARENA_046 = {
  duracionS: 120,
  /** Banda del último tercio para la proporción de centros: x orientada ≥ esta cifra y fuera del ancho del área. */
  bandaMetricaXM: 70,
  /** Ticks consecutivos mínimos de un episodio de mano a mano. */
  manoAManoTicks: 3,
  /** Ventana (s) tras el último tick del episodio para buscar su desenlace. */
  desenlaceS: 3,
  /** Desplazamiento (m) del portero que cuenta como salida en un episodio. */
  desplazamientoM: 1,
  /** Velocidad (m/s) por debajo de la cual un poseedor con `conducir` cuenta como frenado. */
  conducirLentoMps: 1,
  /** v1.2 · saques desde las manos: una pérdida en ≤ saqueInmediataS es «intercepción inmediata»; un
   * gol rival sin toque defensor en ≤ golTrasSaqueS tras el saque es «gol tras saque». */
  saqueInmediataS: 1, golTrasSaqueS: 10,
  /** Brief 051 v1.1 #4 · «intercepción inmediata cercana»: además de ≤ saqueInmediataS, el punto del
   * toque rival (`hasta`) queda a ≤ inmediataRadioM (m) del origen (`desde`) del saque. Es la
   * prohibición del saque regalado al rival plantado junto al portero (046 v1.2 #4); la disputa
   * legal de la caída de un saque aéreo lejano solo cuenta en el contador temporal. */
  inmediataRadioM: 15,
  /** v1.2 · las bandas de saques se exigen también en este segundo lote de `completo.semillas`. */
  segundoLoteDesde: 101,
  rapido: {
    semillaDesde: 1, semillas: 30,
    robosEnManosMax: 0, perdidasTrasAtajadaMax: 0,
    /** Brief 051 v1.1 #4: el contador temporal admite como máximo 1 en el lote rápido (antes 0); el
     * cercano sigue en 0. */
    intercepcionesInmediatasMax: 1, intercepcionesCercanasMax: 0, golesTrasSaquePorPartidoMax: 0.05, saquesPerdidosPorPartidoMax: 0.35,
    desplazamientoMedianaMinM: 1, fraccionDesplazadoMin: 0.45,
    proporcionCentrosMin: 0.25, centrosPorPartidoMin: 0.3,
    metasConduccionPorPartidoMax: 0.05, golesPorPartido: { min: 1.5, max: 3 },
    tiroFueraTrasDesvioMax: 0, recepcionPorteroRechaceMax: 0, conducirFrenadoMax: 0.25,
  },
  completo: {
    semillaDesde: 1, semillas: 100,
    robosEnManosMax: 0, perdidasTrasAtajadaMax: 0,
    /** Brief 051 v1.1 #4: el contador temporal pasa de 0 a ≤ 0,01 por partido en cada lote completo
     * (único límite del 046 que cambia: un saque aéreo de ≥ saqueAereoMinM entra en la caída en
     * 1,05–1,2 s y la convención `tick + 1` lo mide 0,1 s antes); el cercano sigue en 0. */
    intercepcionesInmediatasPorPartidoMax: 0.01, intercepcionesCercanasMax: 0, golesTrasSaquePorPartidoMax: 0.05, saquesPerdidosPorPartidoMax: 0.35,
    desplazamientoMedianaMinM: 1, fraccionDesplazadoMin: 0.45, conversion: { min: 0.25, max: 0.42 },
    proporcionCentrosMin: 0.3, centrosPorPartidoMin: 0.4,
    metasConduccionPorPartidoMax: 0.05, golesPorPartido: { min: 1.8, max: 2.8 },
    tiroFueraTrasDesvioMax: 0, recepcionPorteroRechaceMax: 0, conducirFrenadoMax: 0.25,
  },
} as const;

/** Brief 051 · Remate (reinicios-v5). Cifras sintéticas calibradas con el prototipo del 22 oct
 * (docs/evidencia/motor-051). Solo las usa el motor bajo reinicios-v5, vía `src/arena/remate.ts`. */
export const REMATE_ARENA = {
  /** Objetivo dentro del arco: margen mínimo desde el palo, más margen por falta de nivel y por
   * personalidad (tendencia `remate` baja = más conservador). Acotado a [margenPaloM, arcoM/2]. */
  margenPaloM: 0.5, margenNivelM: 1.5, margenPersonalidadM: 0.6,
  /** Desvío lateral del portero (m) respecto de la línea rematador–arco por debajo del cual se considera
   * centrado y el rematador elige el palo lejano. */
  indiferenciaM: 0.5,
  /** Error lateral (semiancho triangular, m) a nivel 0 y distancia referenciaM; escala con la distancia
   * acotada a [factorDistanciaMin, factorDistanciaMax] y crece con la potencia. Sustituye a
   * ARENA.errorTiroM solo para el remate bajo v5. */
  errorBaseM: 5.5, referenciaM: 16, factorDistanciaMin: 0.5, factorDistanciaMax: 1.2, errorPotencia: 0.3,
  /** Potencia 0 hasta colocadoHastaM, 1 desde potenteDesdeM (distancia al centro del arco). */
  colocadoHastaM: 8, potenteDesdeM: 20,
  /** Velocidad del remate = ARENA.velocidadTiroMps × (1 + potenciaVelocidad × (potencia − 0,5)). */
  potenciaVelocidad: 0.4,
  /** Probabilidad de que el balón salga por encima del travesaño (dimensión vertical modelada). */
  altoBase: 0.02, altoPotencia: 0.06, altoNivel: 0.04,
  /** Alcance del portero (m) a nivel 0 y 100, con el tiempo de reacción de PORTERO_ARENA (reaccionM /
   * velocidadTiroMps) y el mínimo cuerpoM. A nivel 50 ≈ ARENA.controlPorteroM. */
  alcanceMinM: 0.9, alcanceMaxM: 2.4,
  /** Desvío en vez de atrapada: base, más potencia, menos nivel, más estirada; acotado. */
  desvioBase: 0.35, desvioPotencia: 0.2, desvioNivel: 0.15, desvioEstirada: 0.3, desvioMin: 0.1, desvioMax: 0.8,
  /** Fuera del mano a mano, el portero se coloca a estos metros del centro del arco sobre la línea
   * balón–centro del arco (no la bisectriz del ángulo entre los postes; v1.1 #6). */
  posicionamientoM: 3,
} as const;

/** Brief 065 § 2 (opción A, elegida por Carlos el 26 oct) · Remate más preciso y portero con menos alcance, solo para
 * reglas ≥ `desde`; v5–v8 conservan REMATE_ARENA sin cambio (están publicadas y congeladas). Sustituyen solo estas dos
 * cifras de REMATE_ARENA; el resto sigue igual. Diagnóstico (semillas 1–600, docs/evidencia/motor-065/diagnostico/): los
 * goles por partido a 60 s cayeron de 1,215 (v4) a 0,948 (v8), sobre todo por el remate del 051.
 *   - errorBaseM: semiancho (m) del error lateral a nivel 0 y distancia referenciaM (v5–v8: 5,5).
 *   - alcanceMaxM: alcance (m) del portero a nivel 100 (v5–v8: 2,4); alcanceMinM no cambia.
 * Calibración (26 oct, docs/evidencia/motor-065/v9/): el brief propone 4,5 y 2,1, que cumplen los lotes completos 1–100
 * y 101–200 pero no el lote rápido de `npm test` (golesTrasSaquePorPartido 2/30 = 0,067 > 0,05). Ajustes permitidos por
 * el brief, sin mover bandas: iteración 1, alcanceMaxM 2,1 → 2,2 (el rápido sigue en 0,067); iteración 2, además
 * errorBaseM 4,5 → 4,8: rápido, 1–100 y 101–200 sin incumplimientos y controlados del 051 y del 063 en verde (4,8 con
 * 2,1 incumplía la conversión del mano a mano en 1–100: 0,433 > 0,42). */
export const REMATE_ARENA_V9 = {
  desde: "reinicios-v9",
  errorBaseM: 4.8,
  alcanceMaxM: 2.2,
} as const;

/**
 * Brief 051 · Bandas de las métricas de remate (`src/arena/metricas-lote.ts`, en la misma pasada que
 * las del 046: programados, LOTE_ARENA_046.duracionS, todos los ticks; denominador cero = «sin
 * muestra», incumple). «A puerta» es exactamente `rematesPorLado` (045/049, v1.1 #1); fuera, altos y
 * bloqueados salen del desenlace físico de cada remate. `rapido` corre en `npm test` (semillas de
 * LOTE_ARENA_046.rapido) y `completo` en `npm run test:stats` (LOTE_ARENA_046.completo y el segundo
 * lote desde segundoLoteDesde). Los goles por partido siguen siendo las bandas de LOTE_ARENA_046.
 */
export const LOTE_ARENA_051 = {
  /** Experimento controlado: el mismo lote con `variantes.niveles` y el nivel forzado a `bajo` y a
   * `alto` (porteros o jugadores de campo; los demás reciben el nivel de su equipo). */
  nivelesControlado: { bajo: 40, alto: 90 },
  rapido: {
    aPuerta: { min: 0.55, max: 0.88 }, atajadasSobreAPuerta: { min: 0.25, max: 0.6 }, fuera: { min: 0.08, max: 0.4 },
    /** Remates altos mínimos en el lote (cuenta, no fracción: el lote rápido tiene pocos fuera). */
    altosMin: 2,
    bloqueadosMax: 0.1, golesSinRematePorPartidoMax: 0.05, colocacionLadosMin: 0.6,
    /** Diferencia de atajadas / a puerta entre porteros a `alto` y a `bajo`. */
    controladoPorterosMin: 0.1,
  },
  completo: {
    aPuerta: { min: 0.6, max: 0.85 }, conversion: { min: 0.3, max: 0.5 }, atajadasSobreAPuerta: { min: 0.3, max: 0.55 }, fuera: { min: 0.12, max: 0.35 },
    altosSobreFuera: { min: 0.1, max: 0.45 },
    bloqueadosMax: 0.1, golesSinRematePorPartidoMax: 0.05, colocacionLadosMin: 0.6,
    controladoPorterosMin: 0.1,
    /** Diferencia de conversión entre jugadores de campo a `alto` y a `bajo`. */
    controladoCampoMin: 0.1,
  },
} as const;

/** Brief 063 · Bloque A (reinicios-v6): repliegue de emergencia y persecución tras pérdida. Cifras
 * sintéticas del prototipo del 24 oct (docs/evidencia/motor-063); solo las usa el motor bajo
 * reinicios-v6, vía `src/arena/persecucion.ts`. */
export const PERSECUCION_ARENA = {
  /** Repliegue: con un poseedor rival de campo por detrás del último defensor de campo, los jugadores
   * de las líneas `lineas` a ≤ radioM (m) del balón, como máximo `max`, sin el perseguidor, corren a un
   * destino a `adelantoM` (m) del balón sobre la recta balón–centro del arco propio. */
  repliegue: { lineas: ["DEF", "MED"], radioM: 30, max: 4, adelantoM: 4 },
  /** Persecución: segundos base por línea del perdedor. */
  segundos: { DEF: 6, MED: 4, DEL: 3 },
  /** Factores de la duración: agresividadMin + agresividadRango·agresividad/100; energiaMin +
   * (1 − energiaMin)·energía; bloque del plan del entrenador. Duración acotada a [minS, maxS] (s). */
  agresividadMin: 0.75, agresividadRango: 0.5, energiaMin: 0.5,
  bloque: { bajo: 0.85, medio: 1, alto: 1.15 }, minS: 1.5, maxS: 8,
  /** Límite espacial: x orientada propia mínima del destino del perdedor = fracción × largoM (DEF sin límite). */
  limiteFraccion: { DEF: 0, MED: 1 / 3, DEL: 0.5 },
  /** Frenado (m/s²) de quien está en repliegue o persecución cuando la velocidad deseada reduce la
   * componente actual; el resto conserva ARENA.aceleracionMps2. */
  frenadoMps2: 5,
} as const;

/** Brief 063 · Bloque B (reinicios-v7): atributos de jugador. Seis índices sintéticos 0–100 por jugador, guardados
 * en `config.atributos` (el motor usa los guardados). `atributosDe` (src/arena/atributos.ts): PRNG
 * `atributos:arena-v7:{equipo}:{jugador}` con esta semilla, seis extracciones en [−variacion, variacion], un atributo
 * distintivo (+distintivo; el portero, entre velocidad y visión), base por posición natural más ajuste por perfil,
 * redondeo y cota [min, max]. Cifras del prototipo del 24 oct (docs/evidencia/motor-063). Efecto de un valor a:
 * ef = (a − neutro)/neutro; cada multiplicador vale exactamente 1 (o suma 0) con a = neutro. */
export const ATRIBUTOS_ARENA = {
  semilla: 0x61747231, min: 20, max: 95, variacion: 12, distintivo: 12, neutro: 50,
  base: {
    POR: { velocidad: 40, resistencia: 46, aguante: 38, entrada: 28, vision: 48, potencia: 50 },
    DEF: { velocidad: 43, resistencia: 48, aguante: 44, entrada: 60, vision: 40, potencia: 38 },
    MED: { velocidad: 46, resistencia: 56, aguante: 48, entrada: 48, vision: 56, potencia: 46 },
    DEL: { velocidad: 56, resistencia: 42, aguante: 52, entrada: 30, vision: 44, potencia: 59 },
  },
  /** Ajuste por perfil de la personalidad (los atributos que no aparecen suman 0). */
  perfil: {
    defensivo: { entrada: 8, potencia: -5, vision: -3 }, ofensivo: { velocidad: 7, potencia: 5, entrada: -7 },
    pasador: { vision: 12, aguante: 3, velocidad: -4, potencia: -4 }, conductor: { aguante: 9, velocidad: 7, vision: -4 },
    rematador: { potencia: 11, resistencia: -5, vision: -6 }, equilibrado: { resistencia: 5 },
  },
  /** Efectos: velocidad máxima × (1 + velocidadMax·ef) y aceleración × (1 + aceleracion·ef) (velocidad); desgaste
   * por metro × (1 − resistenciaDesgaste·ef) (resistencia); p del duelo − aguanteDuelo·ef del portador (aguante) y
   * + entradaDuelo·ef del defensor (entrada); error de todo pase × (1 − visionError·ef) (visión); velocidad del
   * remate × (1 + potenciaVelocidad·ef) del autor (potencia). */
  velocidadMax: 0.10, aceleracion: 0.15, resistenciaDesgaste: 0.35,
  /** Ajuste 1 de § 12.2 (24 oct): aguanteDuelo y entradaDuelo 0,15 → 0,12. Con 0,15 el lote 1–100 de reinicios-v7
   * incumplía la conversión del mano a mano del 046 (0,4202 > 0,42); con 0,12 los tres lotes cumplen todas las bandas del
   * 046, del 051 y de los bloques A, B y C (docs/evidencia/motor-063/publicacion-2). El primer ajuste de la lista
   * (probabilidad del lejano y penalización del largo) no aplicaba: lejanos y largos estaban dentro de banda.
   * v1.3 § 19 (24 oct): entradaDuelo se desacopla de aguanteDuelo (que queda en 0,12) y se prueba 0,18, 0,24 y 0,30 hasta
   * cumplir la entrada del experimento controlado (≥ 0,30). Con 0,12 medía 0,17; con 0,18, 0,2999… (30 robos más en 100
   * partidos: en la frontera exacta e incumplida por la comparación en coma flotante de la prueba); con 0,24, 0,42, y
   * todas las demás bandas de v7 cumplen en 1–30, 1–100 y 101–200 (goles 1,70 / 1,93 / 2,03; conversión del mano a mano
   * 0,46 / 0,411 / 0,414) y en los demás experimentos controlados (docs/evidencia/motor-063/publicacion-2/intentos-entrada). */
  aguanteDuelo: 0.12, entradaDuelo: 0.24, visionError: 0.2, potenciaVelocidad: 0.08,
  /** Rasgo distintivo mostrado en la UI: el atributo mayor (en empate, el primero) si alcanza este valor. */
  distintivoMin: 70,
  /** § 9.1 · Textos de la ficha y de la tira «En voz». */
  etiquetas: {
    es: { velocidad: "Velocidad", resistencia: "Resistencia", aguante: "Aguante con balón", entrada: "Entrada", vision: "Visión", potencia: "Potencia de disparo" },
    en: { velocidad: "Pace", resistencia: "Stamina", aguante: "Ball retention", entrada: "Tackling", vision: "Vision", potencia: "Shot power" },
  },
  rasgos: {
    es: { velocidad: "Muy rápido", resistencia: "Incansable", aguante: "Protege el balón", entrada: "Gran quite", vision: "Lee el juego", potencia: "Disparo potente" },
    en: { velocidad: "Very quick", resistencia: "Tireless", aguante: "Shields the ball", entrada: "Strong tackler", vision: "Reads the game", potencia: "Powerful shot" },
  },
  efectos: {
    es: { velocidad: "Más velocidad punta y aceleración.", resistencia: "Se desgasta menos al correr.", aguante: "Pierde menos duelos con el balón.", entrada: "Gana más duelos para robar.", vision: "Pasa con más precisión y ve balones largos.", potencia: "Dispara más fuerte y se anima desde lejos." },
    en: { velocidad: "Higher top speed and acceleration.", resistencia: "Tires less when running.", aguante: "Loses fewer duels on the ball.", entrada: "Wins more tackles.", vision: "Passes more accurately and spots long balls.", potencia: "Shoots harder and tries from distance." },
  },
} as const;

/** Brief 063 · Bloque C (reinicios-v7): remate lejano y balón largo. Cifras del prototipo del 24 oct. */
export const LARGO_ARENA = {
  /** Remate lejano: candidato de campo con potencia ≥ potenciaMin, a (radioTiroM, maxM] m del centro del arco, dentro
   * del ancho del área, sin rivales a < espacioM ni rivales de campo a < lineaM de la línea al arco; decisión local con
   * p = probabilidad · (remateBase + remate/100) · (potenciaBase + ef(potencia)). Un `tirar` del LLM a más de maxM no
   * se ejecuta (decide en local). Con lejos = d − radioTiroM > 0 (y d ≤ maxM): el error del remate × (1 + errorPorM·lejos)
   * y la probabilidad de alto + altoPorM·lejos, acotada a altoMax. */
  remate: { potenciaMin: 60, maxM: 33, espacioM: 5, lineaM: 2, probabilidad: 0.35, remateBase: 0.5, potenciaBase: 0.5,
    errorPorM: 0.3, altoPorM: 0.03, altoMax: 0.6 },
  /** Balón largo por arriba (fase aérea del 046): alcance = paseMaxM + (maxM − paseMaxM)·min(1, (visión − visionMin)/
   * (100 − visionMin)), nada con visión < visionMin; candidato con avance ≥ avanceMinM o |Δy| ≥ cambioFraccion·anchoM y
   * ventaja en la caída; puntuación avance + min(ventaja, margenUtilM) − d·pesoDistanciaPase·penalizacion. Error extra
   * = errorM · (d − paseMaxM)/(maxM − paseMaxM) · (errorVisionBase − visión/100). */
  pase: { visionMin: 50, maxM: 55, penalizacion: 0.7, avanceMinM: 10, cambioFraccion: 0.4,
    errorM: 3, errorVisionBase: 1.5 },
} as const;

/** Brief 063 · Bloque D (reinicios-v8): identidad de juego del club, derivada del nombre normalizado (`estiloJuegoDe`,
 * PRNG `estilo-juego:arena-v8:{clave}` con ATRIBUTOS_ARENA.semilla) y guardada en `config.estilosJuego`. Cifras del
 * prototipo del 24 oct (docs/evidencia/motor-063). Efectos, todos del lado de esa identidad:
 *   - bloqueM (m): se suma a ARENA.alturaBloqueM[bloque] en el destino sin balón;
 *   - persecucion: factor de la duración de la persecución tras pérdida; extra (0 o 1): un perseguidor de apoyo;
 *   - repliegue: suma al máximo del repliegue de emergencia (PERSECUCION_ARENA.repliegue.max) del lado que defiende;
 *   - largo: divisor de la penalización por distancia del balón largo local; umbralLargo: suma al umbral de visión
 *     (LARGO_ARENA.pase.visionMin) del balón largo local;
 *   - lejano: factor de la probabilidad del remate lejano local; umbralLejano: suma al umbral de potencia
 *     (LARGO_ARENA.remate.potenciaMin) del remate lejano local.
 * Las órdenes `pasar` y `tirar` del LLM no los usan (§ 8.1 y § 8.2: «por su cuenta»). */
export const ESTILO_JUEGO_ARENA = {
  efectos: {
    defensivo:   { bloqueM: -5, persecucion: 0.8,  extra: 0, repliegue: 1,  largo: 1.2, lejano: 0.8,  umbralLargo: -5,  umbralLejano: 5 },
    ofensivo:    { bloqueM: 3,  persecucion: 1.15, extra: 0, repliegue: -1, largo: 1,   lejano: 1.25, umbralLargo: 0,   umbralLejano: -10 },
    posesion:    { bloqueM: 0,  persecucion: 1.15, extra: 1, repliegue: 0,  largo: 0.6, lejano: 0.8,  umbralLargo: 20,  umbralLejano: 10 },
    contragolpe: { bloqueM: -3, persecucion: 0.9,  extra: 0, repliegue: 1,  largo: 1.5, lejano: 1,    umbralLargo: -10, umbralLejano: 0 },
    directo:     { bloqueM: 0,  persecucion: 1,    extra: 0, repliegue: 0,  largo: 1.5, lejano: 1.2,  umbralLargo: -15, umbralLejano: -10 },
    presion:     { bloqueM: 5,  persecucion: 1.3,  extra: 1, repliegue: 0,  largo: 1,   lejano: 1,    umbralLargo: 0,   umbralLejano: 0 },
  },
  /** § 9.3 · Textos de la tarjeta de alineaciones y de la del entrenador. */
  etiquetas: {
    es: { defensivo: "Defensivo", ofensivo: "Ofensivo", posesion: "Posesión", contragolpe: "Contragolpe", directo: "Juego directo", presion: "Presión alta" },
    en: { defensivo: "Defensive", ofensivo: "Attacking", posesion: "Possession", contragolpe: "Counter-attacking", directo: "Direct play", presion: "High press" },
  },
  descripciones: {
    es: { defensivo: "Bloque más bajo y repliegue con más jugadores.", ofensivo: "Bloque más alto, más remates lejanos y menos repliegue.", posesion: "Pocos balones largos; tras perderlo presiona un jugador más.", contragolpe: "Bloque bajo y más balones largos al espacio.", directo: "Muchos balones largos y remates lejanos.", presion: "Bloque alto y persecución más larga tras perderlo; un jugador más presiona." },
    en: { defensivo: "Deeper block and more players tracking back.", ofensivo: "Higher block, more long-range shots, fewer players tracking back.", posesion: "Few long balls; one extra player presses after losing it.", contragolpe: "Deep block and more long balls into space.", directo: "Many long balls and long-range shots.", presion: "High block and longer chase after losing it; one extra presser." },
  },
} as const;

/**
 * Brief 063 · Métricas de lote del bloque A (`src/arena/metricas-lote.ts`, en la misma pasada que las del
 * 046 y el 051: programados, LOTE_ARENA_046.duracionS, todos los ticks; denominador cero = «sin muestra»,
 * incumple). Bandas exigidas desde `desdeA`; `rapido` corre en `npm test` (semillas de
 * LOTE_ARENA_046.rapido) y `completo` en `npm run test:stats` (LOTE_ARENA_046.completo y el segundo lote).
 * Las métricas son geométricas: se miden igual en reinicios-v5, que debe incumplirlas (contraste).
 */
export const LOTE_ARENA_063 = {
  desdeA: "reinicios-v6",
  /** `repliegueCorren`: muestras de rivales DEF/MED a ≤ PERSECUCION_ARENA.repliegue.radioM del poseedor
   * superado, con el episodio superado de al menos edadMinS (s); corren hacia su arco a ≥ velocidadMinMps. */
  repliegue: { edadMinS: 1, velocidadMinMps: 3 },
  /** `repliegueSeleccion` (v1.1 § 17.7): seleccionados por `seleccionRepliegue`, episodio ≥ edadMinS (s),
   * corren a ≥ velocidadMinMps con cos(velocidad, destino − jugador) ≥ cosenoMin. */
  seleccion: { edadMinS: 1.5, velocidadMinMps: 3, cosenoMin: 0.7 },
  /** `persecucionPerdedor`: muestras de desdeS a hastaS (s) tras un robo en duelo; el perdedor corre a ≥
   * velocidadMinMps con cos(velocidad, balón − perdedor) ≥ cosenoMin. */
  persecucion: { desdeS: 1, hastaS: 4, velocidadMinMps: 3, cosenoMin: 0.7 },
  /** v1.2 § 18.4: cota (bytes) del crecimiento máximo de un registro por las claves nuevas del 063; la
   * prueba la recalcula con fórmulas y constantes. */
  crecimientoMaxBytes: 200_000,
  rapido: { repliegueCorrenMin: 0.55, persecucionPerdedorMin: 0.38 },
  completo: { repliegueCorrenMin: 0.55, persecucionPerdedorMin: 0.4, repliegueSeleccionMin: 0.55 },
  /** Bloques B y C (§ 11.2): bandas exigidas desde `desdeBC`. `rapido`: cuentas mínimas en el lote; `completo`: por
   * partido. Éxito de un balón largo: el primer toque posterior es una recepción del mismo lado. «A puerta» de un
   * remate lejano: gol, atrapada o desvío (desenlace físico del 051). */
  desdeBC: "reinicios-v7",
  bloqueBC: {
    rapido: { largosMinLote: 8, lejanosMinLote: 5 },
    completo: { largosPorPartido: { min: 0.4, max: 1.6 }, exitoLargos: { min: 0.3, max: 0.7 }, lejanosPorPartido: { min: 0.3, max: 1.2 },
      conversionLejanosMax: 0.3, aPuertaLejanosMax: 0.7 },
  },
  /** § 12.3 · Recalibración explícita de dos bandas del 046 solo para reglas ≥ `desde`: goles por partido (el suelo
   * queda unas dos veces el error típico del lote por debajo de la media nueva medida en el prototipo, ≈ 1,84) y
   * centros por partido (el balón largo y el remate lejano sustituyen parte del juego por banda; la proporción de
   * centros no cambia). v6 y anteriores conservan las originales. */
  recalibracion046: {
    desde: "reinicios-v7",
    rapido: { golesPorPartido: { min: 1.3, max: 3 }, centrosPorPartidoMin: 0.2 },
    completo: { golesPorPartido: { min: 1.5, max: 2.8 }, centrosPorPartidoMin: 0.35 },
  },
  /** § 13 B1 · Coherencia de `atributosDe` en los jugadores de campo de las semillas 1 a `semillas`: media global de cada
   * atributo dentro de `media` (centrados en ATRIBUTOS_ARENA.neutro). */
  coherenciaAtributos: { semillas: 200, media: { min: 45, max: 55 } },
  /** § 11.2 · Experimento controlado de atributos (v7, `completo.semillas` desde `completo.semillaDesde`): el
   * atributo de los jugadores de campo del `local` (titulares y banco) forzado a `bajo` y a `alto`; diferencia
   * mínima alto − bajo de su métrica (aguante: bajo − alto de los robos sufridos por minuto de posesión). */
  controlado: {
    valores: { bajo: 30, alto: 80 },
    diferenciaMin: { velocidad: 0.4, aguante: 0.3, entrada: 0.3, vision: 0.8, potencia: 0.4, resistencia: 0.03 },
  },
  /** v1.2 § 18.3 · Visión y potencia por encima de su umbral de acceso: cociente máximo alto/bajo de la métrica
   * (visión: |hasta − destino previsto| medio de los pases cortos con receptor del `local`; potencia: ticks de vuelo
   * por metro de los remates del `local` que terminan sin contacto o en el portero). Derivados de las fórmulas: el
   * semiancho del pase baja un 12,5 % y los ticks por metro del remate un 3,8 %. */
  sobreUmbral: {
    vision: { bajo: 60, alto: 90, cocienteMax: 0.95 },
    potencia: { bajo: 65, alto: 90, cocienteMax: 0.985 },
  },
  /** Bloque D (§ 11.2): versión desde la que existe la identidad de juego (`config.estilosJuego`). */
  desdeD: "reinicios-v8",
  /** § 11.2 · Experimento controlado de identidad (v8, `completo.semillas` desde `completo.semillaDesde`): la identidad
   * del `local` forzada; diferencia mínima `alto` − `bajo` de su métrica, medida solo en el `local`:
   *   - xSinBalon: x orientada media de los de campo con el balón en poder del rival, fuera de pausa (m);
   *   - largos: balones largos por partido; lejanos: remates lejanos por partido;
   *   - persecucionS: segundos por partido con una persecución del `local` activa. */
  identidad: {
    xSinBalon: { alto: "presion", bajo: "defensivo", min: 3 },
    largos: { alto: "directo", bajo: "posesion", min: 0.6 },
    lejanos: { alto: "ofensivo", bajo: "posesion", min: 0.2 },
    persecucionS: { alto: "presion", bajo: "defensivo", min: 1 },
  },
} as const;

/** Mini-encuentro v3: parámetros sintéticos, en segundos reales de simulación. */
export const TECNICA_ARENA = {
  semilla: 0x7465636e, revisionMinS: 10, revisionMaxS: 25,
  cambioPlanMinS: 20, ventanaMemoriaS: 30, maxCambios: 5, maxVentanas: 3,
  /** Brief 044: pares {sale, entra} admitidos en una misma ventana (misma interrupción). */
  cambiosPorVentana: 3,
  /** Peso base de la verticalidad del entrenador al puntuar un pase: base + verticalidad/100. */
  direccionPaseBase: 0.6,
  pausaS: 1.5, cambioMinS: 20, cambiosSeparacionS: 15,
  energiaCambio: 0.87, confianzaInicial: 60, emocionMin: 0, emocionMax: 100,
  presionCalor: 0.25, desgasteRitmo: 0.5, energiaPorMetro: 0.0005,
  ritmo: { pausado: 0.85, normal: 1, alto: 1.12 },
  compatibilidadMinFactor: 0.85, resguardoM: 6,
} as const;

export const ENTORNO_ARENA = {
  calorFactor: 0.65, frioVelocidad: 0.06, frioHastaS: 25,
  sinteticaBalon: 1.12, cespedAltoBalon: 0.9, cespedAltoErrorM: 0.6,
  paseCortoM: 18, nieblaDesdeM: 20, nieblaErrorM: 1,
  presionErrorM: 0.8, presionInicialS: 30,
  presion: { baja: 0.15, media: 0.5, alta: 1 },
  animoInicial: 50, animoGol: 15, animoTiro: 2, animoPerdida: 1,
} as const;

export const ARBITRAJE_ARENA = {
  faltaBase: 0.015, faltaAgresividad: 0.07, faltaIndisciplina: 0.04,
  temerariaDesde: 0.6, excesivaDesde: 0.985,
  criterioMin: 40, criterioMax: 85, minJugadores: 7,
  /** Factor de contacto del árbitro: base + criterioContacto/100. */
  criterioBase: 0.5,
} as const;

/** Preferencias sintéticas de arena-v2; no son capacidades ni cifras calibradas. */
export const PERSONALIDAD_ARENA = {
  semilla: 0x70657273, min: 0, max: 100, variacion: 12,
  distanciaPresionM: 8, ajusteApoyoM: 10,
  avanceMinFactor: 0.6, avanceRangoFactor: 0.8,
  margenMinFactor: 0.5, distanciaMinFactor: 0.7, distanciaRangoFactor: 0.6,
  tiroMinFactor: 0.4, tiroRangoFactor: 0.6, ventajaConduccion: 15,
  temperamentoAlto: 70, temperamentoBajo: 35,
} as const;

/** Árbitro visual de arena-v2: movimiento propio, sin contacto ni decisiones arbitrales. */
export const ARBITRO_ARENA = {
  velocidadMps: 5.5, aceleracionMps2: 3,
  distanciaLongitudM: 10, distanciaLateralM: 12, margenM: 3,
} as const;

/**
 * Brief 045: prioridad de voz del narrador por tipo de evento de arena (antes, tabla local
 * de `relato.ts`). Un tipo ausente (pase, recepción…) no genera noticia hablada. El
 * comentarista se dispara por evento desde `MESA_ARENA.comentaristaDesdePrioridad`.
 */
export const PRIORIDAD_EVENTO_ARENA: Readonly<Partial<Record<TipoEventoArena, number>>> = {
  gol: 100, roja: 95, final_anticipado: 90, atajada: 80, tiro_fuera: 70, tiro: 60,
  amarilla: 85, falta: 40, fuera_juego: 40, cambio: 50, reinicio: 35,
};

/** Brief 045 · Mesa de transmisión: narrador, comentarista y estadista. */
export const MESA_ARENA = {
  /** Por debajo de VOZ_BUFFER.prioridadInterrupcion (35), por encima del editorial (10). */
  prioridadInvitado: 20,
  /** Segundos de audio desde el fin de la última noticia; menor que VOZ_BUFFER.reservaTrasS. */
  calmaMinS: 1.5,
  /** Segundos de audio entre el fin de un invitado y el inicio del siguiente. */
  separacionInvitadosS: 6,
  /** Segundos de partido; una candidatura más vieja no arranca. */
  caducidadInvitadoS: 12,
  /** Corrección (045/048, 22 oct) · Petición de una variante de invitado que recibe 429 (p. ej. el tope
   * de síntesis «extra» simultáneas del servidor, ocupado por el narrador al activar la voz) o un fallo
   * de red o de plazo: se reintenta tras reintentoInvitadoMs · 2^k ms (k = reintentos ya hechos), hasta
   * maxReintentosInvitado veces y nunca pasada caducidadInvitadoS. 1 + 2 + 4 = 7 s de espera < 12 s.
   * Un 400/404, un 5xx o un segmento inválido siguen siendo finales. */
  reintentoInvitadoMs: 1000, maxReintentosInvitado: 3,
  /** Cadencia de candidaturas del estadista (segundos de partido). */
  estadistaCadaS: 20,
  /** Ventana (s) de la proporción de acciones y de la distancia media de pase; mínimo de acciones. */
  ventanaAccionesS: 30, minAcciones: 6,
  /** Datos por candidatura del estadista, en el orden de la tabla del brief. */
  maxDatosEstadista: 2,
  /** tiro_fuera, atajada, amarilla, roja, gol, final_anticipado. */
  comentaristaDesdePrioridad: 70,
  /** Cadencia (s), tope por sesión y plazo (ms) del comentarista. */
  comentaristaCadaS: 25, maxComentaristaPorSesion: 6, plazoComentaristaMs: 6000,
  /** Hechos permitidos que recibe el comentarista y oraciones máximas de su salida. */
  hechosComentarista: 8, maxOracionesComentarista: 2,
  /** Caracteres máximos del texto hablado de una variante (todos sus turnos).
   * [048] antes 280: 280 caracteres a 9,5 c/s duran ≈ 29 s > VOZ_BUFFER.duracionMaxS (24 s) y el
   * consumidor descartaba el clip. 210 / 9,5 ≈ 22 s.
   * [048] se elimina fragmentosPorIntervencion: el máximo de fragmentos es dialogo.maxTurnos. */
  maxCaracteresIntervencion: 210,
  /** v3.1 · Caracteres por oración del comentarista (maxLength del esquema + rechazo V1) y por
   * dato del estadista (prueba sobre fixtures y semillas). [048] ≤ maxCaracteresIntervencion: el
   * último escalón de la escalera (un solo turno con la oración o el dato) siempre cabe. */
  maxCaracteresOracion: 200,
  /** v3.1 · Llamadas a `completar` por sesión, narrador + comentarista, reintentos y plazos
   * agotados incluidos (`conPresupuesto` en src/lib/llm.ts). Cubre 3 comentarios + 6
   * candidaturas a la primera; los reintentos consumen de aquí. */
  presupuestoLlamadasModelo: 12,
  /** v3.1 · Caché del catálogo real de Speech: una hora si respondió; un minuto tras un fallo
   * (antes cada consulta reintentaba con hasta 5 s de espera). */
  catalogoVocesCacheS: 3600, catalogoVocesReintentoS: 60,
  /** Nombres ficticios: no coinciden con locutores reales ni con los de los transcripts. */
  nombres: {
    es: { narrador: "Rodrigo Valle", comentarista: "Ana Cedeño", estadista: "Tomás Ibarra" },
    en: { narrador: "Mark Ellison", comentarista: "Priya Chandra", estadista: "Owen Platt" },
  },
  /** v3.1 · Cesiones por idioma y rol; al comentarista nunca se le cede «con el dato». */
  cesiones: {
    es: {
      comentarista: ["{nombre}, ¿qué ves?", "Te escucho, {nombre}.", "Adelante, {nombre}."],
      estadista: ["{nombre}, con el dato.", "Vamos con {nombre} y los números.", "Adelante, {nombre}."],
    },
    en: {
      comentarista: ["{nombre}, what do you see?", "Over to you, {nombre}.", "Go ahead, {nombre}."],
      estadista: ["{nombre}, with the numbers.", "Let's hear the numbers, {nombre}.", "Go ahead, {nombre}."],
    },
  },
  /** Solo datos del hecho principal; cada una pasa verificarUpdate en la prueba. */
  respaldosComentarista: {
    es: ["{jugador} ({equipo}) protagoniza la última acción destacada, a {distancia} metros.",
         "La jugada más reciente lleva la firma de {jugador}, de {equipo}.",
         "{equipo} aparece en la última acción relevante, con {jugador}."],
    en: ["{jugador} ({equipo}) features in the latest key action, from {distancia} metres.",
         "The most recent play carries the mark of {jugador}, of {equipo}.",
         "{equipo} shows up in the latest relevant action, through {jugador}."],
  },
  /** Brief 048 · Diálogo entre voces (v1.1: formas pregunta, ronda, estadista y final; sin la
   * forma `dato`, sin conectores y sin los marcos causales `secuencia` y `centro`). */
  dialogo: {
    /** Turnos por intervención (un fragmento de voz y un <voice> por turno). */
    maxTurnos: 4,
    /** Caracteres por segundo de voz: el mínimo medido en los cuatro mp3 públicos del 045
     * (9,5–10,3 c/s, cesión y cambio de voz incluidos). Solo sirve para estimar y para el informe. */
    caracteresPorSegundoVoz: 9.5,
    /** v1.1 (8) · Segundos que la estimación suma por cada turno más allá del primero (cambio de
     * <voice> y pausa entre frases). NO medido: lo fija la implementación para que cuatro turnos
     * con maxCaracteresIntervencion quepan en VOZ_BUFFER.duracionMaxS (210 / 9,5 + 3 · 0,4 ≈ 23,3 s);
     * se recalibra con el smoke junto a caracteresPorSegundoVoz. */
    pausaTurnoS: 0.4,
    /** v1.3 (1) · Bolsa propia de Speech de los invitados (solicitudes y caracteres de SSML), aparte
     * del presupuesto del narrador (PRESUPUESTO_AUDIO_ENCUENTRO, el anterior al 048): se suma al total
     * y nunca se presta en ningún sentido, así que un invitado no puede causar un 429 del narrador.
     * Del orden de la cuota calibrada en la v1.2 (0,2 × 80 / 24.000). Coste máximo añadido por
     * encuentro: esta bolsa. Medición del narrador sin invitados (8 semillas, apertura + tramos +
     * cierre): 60 s ES+EN ≤ 28 solicitudes y 9.411 caracteres; 120 s ≤ 52 y 17.636; 180 s ≤ 76 y
     * 26.058, que ya supera su presupuesto (límite anterior al 048, v1.3 (2)). */
    bolsaSpeechInvitados: { solicitudes: 16, caracteres: 4800 },
    /** v1.2 (2) · Reserva propia del cierre del narrador, dentro de su presupuesto, que ningún otro
     * tramo puede usar: dos cierres (ES y EN) de ≤ 335 caracteres de SSML medidos, con margen. */
    reservaSpeechCierreCaracteres: 800,
    reservaSpeechCierreSolicitudes: 2,
    /** Plantillas recientes por función que no se repiten si hay alternativa. */
    memoriaPlantillas: 2,
    /** Temas del dato de mesa por disparo del comentarista, en orden de preferencia. */
    temasPorDisparador: {
      gol: ["marcador", "remates"], atajada: ["atajadas", "remates"], tiro_fuera: ["remates"],
      amarilla: ["faltas"], roja: ["faltas"], final_anticipado: ["marcador"], tiempo: ["remates", "acciones", "pases"],
    },
    acciones: {
      es: { gol: "el gol de {jugador}", atajada: "la atajada de {jugador}", tiro_fuera: "el remate de {jugador}", amarilla: "la amarilla a {jugador}", roja: "la roja a {jugador}" },
      en: { gol: "{jugador}'s goal", atajada: "{jugador}'s save", tiro_fuera: "{jugador}'s shot", amarilla: "the booking for {jugador}", roja: "the red card for {jugador}" },
    },
    /** v1.1 (3) · Marcos neutrales: nombran la acción del disparador y piden la lectura del
     * invitado, sin presuponer causas. */
    marcos: {
      es: {
        repaso: ["{nombre}, repasemos {accion}.", "{nombre}, vamos con {accion}.", "Sobre {accion}, {nombre}, ¿qué tenemos?"],
        estadista: {
          marcador: ["{nombre}, ¿cómo está el marcador?", "El marcador, {nombre}."],
          remates: ["{nombre}, ¿cómo van los remates?", "{nombre}, los remates."],
          atajadas: ["{nombre}, ¿cuántas atajadas llevamos?", "Las atajadas, {nombre}."],
          faltas: ["{nombre}, ¿cómo van las faltas?", "{nombre}, la disciplina."],
          cambios: ["{nombre}, ¿cómo van los cambios?", "Los cambios, {nombre}."],
          acciones: ["{nombre}, ¿cómo se reparten las acciones?", "{nombre}, el reparto de acciones."],
          reinicios: ["{nombre}, ¿cómo van los reinicios?", "Los reinicios, {nombre}."],
          pases: ["{nombre}, ¿cómo están los pases?", "{nombre}, la distancia de pase."],
        },
        final: ["{nombre}, los números del partido.", "{nombre}, cerramos con los datos.", "Para cerrar, {nombre}, los números."],
      },
      en: {
        repaso: ["{nombre}, let's go over {accion}.", "{nombre}, take us through {accion}.", "{nombre}, what do we have on {accion}?"],
        estadista: {
          marcador: ["{nombre}, where does the score stand?", "The score, {nombre}."],
          remates: ["{nombre}, how are the shots looking?", "{nombre}, the shots."],
          atajadas: ["{nombre}, how many saves so far?", "The saves, {nombre}."],
          faltas: ["{nombre}, how are the fouls looking?", "{nombre}, discipline."],
          cambios: ["{nombre}, where are the substitutions?", "The substitutions, {nombre}."],
          acciones: ["{nombre}, how is the share of actions?", "{nombre}, the share of actions."],
          reinicios: ["{nombre}, how are the restarts?", "The restarts, {nombre}."],
          pases: ["{nombre}, how are the passes?", "{nombre}, the pass distance."],
        },
        final: ["{nombre}, the match numbers.", "{nombre}, let's close with the data.", "To close, {nombre}, the numbers."],
      },
    },
    cierres: {
      es: ["Gracias, {nombre}.", "Anotado, {nombre}.", "Muy bien, {nombre}. Seguimos."],
      en: ["Thanks, {nombre}.", "Noted, {nombre}.", "Good, {nombre}. Back to the play."],
    },
    /** v1.2 (4) · Cierres propios de la forma `final`: tras el pitazo nunca «seguimos». */
    cierresFinal: {
      es: ["Gracias, {nombre}, por los números del partido.", "Así quedan los números, {nombre}. Gracias.", "Gracias, {nombre}. Hasta aquí los datos."],
      en: ["Thanks, {nombre}, for the match numbers.", "Those are the numbers, {nombre}. Thanks.", "Thanks, {nombre}. That is all the data."],
    },
  },
} as const;

/** Brief 049 · Cifras del partido y favoritos. */
export const ESTADISTICAS_ARENA = {
  /** Filas del panel, en orden; solo las implementadas (v1.1 § 13: entrega mínima, nivel 2 y, del
   * nivel 3, `igr` y `remates_cercanos`, ambas «estimadas»). */
  filasPanel: ["posesion_pct", "igr", "remates", "remates_directos", "remates_indirectos", "remates_cercanos", "esquinas", "fueras_juego", "pases_completados", "precision_pase", "recuperaciones", "perdidas", "faltas", "amarillas", "rojas", "atajadas"],
  /** Claves donde lidera el menor valor. */
  mejorMenor: ["fueras_juego", "perdidas", "faltas", "amarillas", "rojas"],
  /** Ancho mínimo (%) de una barra con valor > 0, para que siga visible. */
  barraMinPct: 4,
  /** Líneas de «Destacados» en la vista final. */
  destacados: 3,
  /** m/s → km/h. */
  kmhPorMps: 3.6,
  /** Evidencias listadas por cifra en la ficha (la cifra cuenta todas). */
  evidenciasVisibles: 12,
  /** Clave de localStorage de los favoritos; el sufijo versiona el formato. */
  claveFavoritos: "cronista:arena:favoritos:v1",
} as const;

/** Brief 049 (v1.1 § 9, nivel 3) · Índice geométrico de remate (IGR) de la arena: SOLO ordena
 * remates por distancia y ángulo al arco rival. Adimensional, en [0, max]; NO es una probabilidad
 * ni un xG, no está calibrado contra nada y no es comparable con el xG del simulador histórico.
 * Siempre rotulado «estimado». Desde la línea de fondo rival o detrás (θ = 0) vale 0. */
export const IGR_ARENA = {
  base: 0.35, puntoPenalM: 11, distanciaLibreM: 6, escalaM: 12, min: 0.02, max: 0.6,
  /** Umbral de «remate cercano y centrado»; coincide en magnitud con XG_ALTO.xgMin, pero es independiente. */
  umbralCercano: 0.3,
} as const;

/** Brief 055 · Identidad de club derivada del nombre: equipaciones, escudos e iconos. Los colores
 * se midieron con la fórmula WCAG 2.x el 22 oct contra --ar-grass-a/-b (3:1 mínimo para el relleno
 * y el anillo), contra el relleno (4,5:1 para el dorsal) y contra --surface/--ar-surface-2 (claro)
 * y --surface/--ar-surface-2/--ar-bug/--ar-bug-2 (oscuro) para los colores de interfaz (4,5:1).
 * Las pruebas vuelven a medir todo con los tokens leídos de globals.css; aquí no se repite ninguna cifra.
 * Determinismo entre despliegues: cambiar la paleta o el orden de sus entradas cambia el escudo de
 * todos los clubes; los colores nuevos van al final y actualizan la prueba de distribución. */
export const IDENTIDAD_ARENA = {
  /** Mínimos WCAG: relleno/anillo frente al césped y entre equipos (gráfico), dorsal e interfaz (texto). */
  minGrafico: 3, minTexto: 4.5, minEntreEquipos: 3,
  /** FNV-1a de 32 bits. */
  fnvDesplazamiento: 0x811c9dc5, fnvPrimo: 0x01000193,
  /** Iniciales: máximo y longitud mínima de palabra. */
  maxIniciales: 3, minLetrasPalabra: 3,
  formas: ["escudo", "redondo", "estandarte"],
  patrones: ["liso", "rayas", "mitades", "banda", "aros"],
  /** Índices 0–4 familia oscura, 5–9 familia clara. tinta = color del dorsal y del anillo.
   * uiClaro/uiOscuro = color del equipo sobre superficies del tema claro/oscuro (barras, tabla, bordes). */
  paleta: [
    { id: "marino",   familia: "oscura", fondo: "#0c1640", tinta: "#ffffff", uiClaro: "#1b2f7a", uiOscuro: "#8fb0ff", nombre: { es: "marino",   en: "navy" } },
    { id: "negro",    familia: "oscura", fondo: "#121418", tinta: "#ffffff", uiClaro: "#2b2f3a", uiOscuro: "#c9ced9", nombre: { es: "negro",    en: "black" } },
    { id: "granate",  familia: "oscura", fondo: "#2e0612", tinta: "#ffffff", uiClaro: "#7a1430", uiOscuro: "#ff9fb4", nombre: { es: "granate",  en: "claret" } },
    { id: "purpura",  familia: "oscura", fondo: "#200a3a", tinta: "#ffffff", uiClaro: "#5a2a9a", uiOscuro: "#cfaaff", nombre: { es: "púrpura",  en: "purple" } },
    { id: "petroleo", familia: "oscura", fondo: "#041c24", tinta: "#ffffff", uiClaro: "#0b5566", uiOscuro: "#7fd6e8", nombre: { es: "petróleo", en: "teal" } },
    { id: "blanco",   familia: "clara",  fondo: "#f5f7fb", tinta: "#0b1220", uiClaro: "#13203f", uiOscuro: "#f5f7fb", nombre: { es: "blanco",   en: "white" } },
    { id: "amarillo", familia: "clara",  fondo: "#ffd23f", tinta: "#0b1220", uiClaro: "#7a5a00", uiOscuro: "#ffd23f", nombre: { es: "amarillo", en: "yellow" } },
    { id: "celeste",  familia: "clara",  fondo: "#a6d6ff", tinta: "#0b1220", uiClaro: "#0b4f8a", uiOscuro: "#a6d6ff", nombre: { es: "celeste",  en: "sky blue" } },
    { id: "rosa",     familia: "clara",  fondo: "#ffbccf", tinta: "#0b1220", uiClaro: "#8a2a4a", uiOscuro: "#ffbccf", nombre: { es: "rosa",     en: "pink" } },
    { id: "naranja",  familia: "clara",  fondo: "#ffc46a", tinta: "#0b1220", uiClaro: "#8a4b00", uiOscuro: "#ffc46a", nombre: { es: "naranja",  en: "amber" } },
  ],
  /** Tamaños del escudo (px de ancho) por lugar; el alto es ×36/32. */
  escudoPx: { marcador: 28, marcadorMovil: 22, rotuloGol: 16, cifras: 16, plantilla: 18, ficha: 18, entrenador: 20, plan: 22, reanudacion: 16 },
  /** Tope de concentración admitido en la prueba de distribución sobre todos los nombres posibles. */
  maxFraccionPorKit: 0.25,
} as const;

/** Brief 056 (v1.2) · Previa del partido: alineaciones tipo TV derivadas del registro (config + inicial).
 * La cancha de la tarjeta usa ARENA.anchoM como ancho del viewBox (metros reales). El eje de profundidad
 * se estira con escalaProfundidad (v1.2, decisión del coordinador): la línea de fondo propia queda en
 * margenSuperior + ARENA.largoM · escalaProfundidad y el alto del viewBox añade margenInferior. */
export const PREVIA_ARENA = {
  /** Unidades del viewBox. escalaProfundidad (unidades por metro de largo): con 0,68 la pareja más
   * cercana del catálogo (MP–DC del 4-2-3-1, 11,55 m en el mismo carril) queda a 7,85 unidades, por
   * encima de 2 · radioFicha + separacionMinFichas (7,4); el mínimo exacto es 0,641. El dibujo solo
   * lleva dorsales (los nombres están en la lista de texto). escalaCapitan amplía la marca «C». */
  tarjeta: { margenSuperior: 8, margenInferior: 4, escalaProfundidad: 0.68, separacionMinFichas: 1, radioFicha: 3.2, fuenteDorsal: 3, escalaCapitan: 1.6, maxPerfilesMostrados: 2 },
  /** Caducidad (s de partido) de las tres piezas habladas; mayor que la general (MESA_ARENA.caducidadInvitadoS)
   * para cubrir el primer tramo tras el saque. */
  caducidadS: 30,
  /** Separación (s de audio) entre dos piezas de la previa; entre una previa y otro invitado rige la general. */
  separacionS: 1.2,
  /** Bolsa propia de Speech por encuentro (v1.1 § 9): 3 piezas × 2 variantes × 2 idiomas. Medido el 22 oct
   * con prepararVoz: completa ≈ 573–665 c de SSML, breve ≈ 362–442; con nombres al máximo admitido ≈ 700 y
   * ≈ 500 → cota 7.200; 9.000 deja un 25 % de margen. No se presta a ni toma de otras bolsas. */
  bolsaSpeech: { solicitudes: 12, caracteres: 9000 },
  /** Orden y claves de las piezas; el id es `previa:${n}-${clave}:0` (n desde 1). */
  piezas: ["local", "visita", "condiciones"],
  /** Plantillas habladas (ES/EN paralelas). Llaves: equipo, formacion, capitan, nivel, entrenador, perfil,
   * arbitro, clima, temperatura, superficie, local, visita, a1, d1, a2, d2. {formacion} se pronuncia en
   * palabras (CANTO_GOL.plantillas.numeros); `referencias` sustituyen al club en la escalera (v1.1 § 4). */
  plantillas: {
    es: {
      alineacion: "Así sale {equipo}, en {formacion}: {capitan} lleva el brazalete.", alineacionSinCapitan: "Así sale {equipo}, en {formacion}.",
      plantel: "Once de nivel medio {nivel}; en el banquillo, {entrenador}, {perfil}.", plantelSinPerfil: "Once de nivel medio {nivel}; en el banquillo, {entrenador}.", plantelSinEntrenador: "Once de nivel medio {nivel}.",
      arbitro: "Arbitra {arbitro}.", condiciones: "{clima}{temperatura} y {superficie}.", temperatura: ", {n} grados",
      perfiles: "Perfiles de equipo: {local}, ataque {a1} y defensa {d1}; {visita}, ataque {a2} y defensa {d2}.",
      referencias: { local: "el local", visita: "la visita" },
    },
    en: {
      alineacion: "Here is {equipo}, in a {formacion}: {capitan} wears the armband.", alineacionSinCapitan: "Here is {equipo}, in a {formacion}.",
      plantel: "A starting eleven with an average ability of {nivel}; {entrenador} in the dugout, {perfil}.", plantelSinPerfil: "A starting eleven with an average ability of {nivel}; {entrenador} in the dugout.", plantelSinEntrenador: "A starting eleven with an average ability of {nivel}.",
      arbitro: "{arbitro} is the referee.", condiciones: "{clima}{temperatura} and {superficie}.", temperatura: ", {n} degrees",
      perfiles: "Team profiles: {local}, attack {a1} and defence {d1}; {visita}, attack {a2} and defence {d2}.",
      referencias: { local: "the home side", visita: "the away side" },
    },
  },
  /** Textos compartidos por la tarjeta y la voz. En la frase hablada van en minúscula salvo al inicio.
   * Superficie: `natural` (sin longitud de césped en el registro), `natural_corto`, `natural_alto`, `sintetica`. */
  textos: {
    clima: { es: { despejado: "Cielo despejado", calor: "Calor", lluvia: "Lluvia", frio: "Frío", niebla: "Niebla" }, en: { despejado: "Clear skies", calor: "Heat", lluvia: "Rain", frio: "Cold", niebla: "Fog" } },
    superficie: { es: { natural: "césped natural", natural_corto: "césped natural corto", natural_alto: "césped natural alto", sintetica: "superficie sintética" }, en: { natural: "natural grass", natural_corto: "short natural grass", natural_alto: "long natural grass", sintetica: "artificial surface" } },
    estilo: { es: { posesion: "Posesión", contragolpe: "Contragolpe", presion: "Presión" }, en: { posesion: "Possession", contragolpe: "Counter-attack", presion: "Pressing" } },
  },
} as const;

/** Brief 043 (nota del 22 oct) · Reservas de voz pregrabadas del consumidor en vivo (respaldo neutral). */
export const RESERVAS_VOZ = {
  /** Tras la primera vuelta completa del catálogo, ninguna de las ⌈n · fracción⌉ reservas oídas más
   * recientes vuelve a sonar (n = reservas generales disponibles, sin el cierre). */
  fraccionNoRepeticion: 0.5,
  /** Reservas generales por idioma en el catálogo estático (public/voz-reserva). Medición del 22 oct en
   * 180 s con el catálogo de 12: con Speech normal sonaron 16 (es) y 20 (en); con Speech fallido, 23 y 25.
   * Con 30 ninguna se repite en un partido de 180 s, ni siquiera con Speech fallido. */
  minimoPorIdioma: 30,
  /** Descargas simultáneas de clips de reserva al activar la voz. */
  descargasSimultaneas: 4,
} as const;

/** Brief 050 v1.1 · Canto de gol del narrador. Prosodia y estructura medidas el 22 oct con Speech real
 * (docs/evidencia/canto-gol-050/indice.json): tres tramos (grito, goleador, hechos) dentro de un solo
 * <s> duran ≈ 9,9 s (ES) y la cota con los nombres más largos 13,87 s (ES) y 14,23 s (EN); cada
 * frontera de <s> u oración añade ≈ 1 s de silencio. La escucha humana puede ajustar cifras, no la
 * estructura. */
export const CANTO_GOL = {
  /** Porcentajes SSML y styledegree por tramo. El grito usa el máximo documentado (2); el goleador
   * baja un escalón; los hechos bajan para que el marcador se entienda; el autogol no grita
   * (sustituye a grito + goleador).
   * Brief 054 · Prosodia común del grito; el rate lo aporta cada grito del catálogo. */
  tramos: {
    grito: { pitch: 16, volume: 30, grado: 2 },
    goleador: { rate: 10, pitch: 12, volume: 22, grado: 1.8 },
    hechos: { rate: 6, pitch: 6, volume: 10, grado: 1.3 },
    autogol: { rate: 0, pitch: 3, volume: 6, grado: 1 },
  },
  /** Estilo por idioma y tramo según el catálogo real del 22 oct (catalogo-estilos.json): Jorge solo
   * cheerful/chat (ninguna voz es-* del recurso tiene shouting); Jenny admite shouting (ronda 5:
   * shouting en el grito, excited en el resto). Si la voz efectiva no admite el estilo, se omite
   * express-as y queda la prosodia (comportamiento vigente de prepararVoz). */
  estilos: {
    es: { grito: "cheerful", goleador: "cheerful", hechos: "cheerful", autogol: "cheerful" },
    en: { grito: "shouting", goleador: "excited", hechos: "excited", autogol: "excited" },
  },
  /** Silencio final del canto (como el jubilo anterior). */
  pausaFinalMs: 380,
  /** Caracteres máximos del texto (tramos unidos): 160 / MESA_ARENA.dialogo.caracteresPorSegundoVoz
   * + 0,38 ≈ 17,2 s < VOZ_BUFFER.duracionMaxS. Solo acota plantillas; la cota es la duración medida
   * (13,87 / 14,23 s; con el grito más largo del 054, 13,87 / 14,56 s) y el rechazo por duración
   * real del consumidor. Brief 054 § 3.5: la prueba del presupuesto con los diez gritos midió 152 c
   * (ES: «¡Gol, gol, gol, gooool!» + «¡Gol, gol de …!» + «Sobre el final, … se pone por delante, cinco
   * a cuatro, …»), por encima de 150; se sube a 160 como prescribe el brief, sin acortar ningún grito. */
  maxCaracteres: 160,
  /** «Sobre el final»: desde esta fracción de la duración y con diferencia ≤ tardioDiferenciaMax tras
   * el gol. Misma regla que la intensidad 1 de expresionEvento (que lee de aquí). */
  tardioDesdeFraccion: 0.8, tardioDiferenciaMax: 1,
  /** Diferencia a favor, después del gol, desde la que el tramo de hechos dice «goleada». */
  goleadaDesde: 3,
  /** Segundos de partido (cursor visible) que duran el rótulo y el realce del marcador. */
  celebracionS: 8,
  /** Caducidad de la candidatura de la Mesa con tema `gol`: el canto (≈ 9–10 s) y calmaMinS ocupan
   * casi los 12 s de MESA_ARENA.caducidadInvitadoS. Los demás temas conservan la del 045. */
  caducidadInvitadoTrasGolS: 20,
  /** Números del marcador en palabras hasta aquí; desde el siguiente, cifras. */
  numerosEnPalabrasHasta: 9,
  /** Brief 054 · Catálogo de gritos medido el 22 oct (docs/evidencia/canto-gol-054/indice.json): habla
   * 0,5–2,5 s por grito, media de los dos primeros segundos −22,3…−19,1 dB (ES) y −17,3…−13,1 (EN).
   * Grafías rechazadas por duración: «Yyyy» (deletreo, +1,84 s), «lll» final (corta la vocal),
   * mayúsculas (sin efecto). rate entre −10 y −30: −45 alarga el silencio final sin sostener más.
   * Sin `condicion` = general; con `prioridad` = condicionado que se antepone a la rotación. */
  gritos: [
    { clave: "gooool", es: { texto: "¡Gooool!", rate: -30 }, en: { texto: "Goooal!", rate: -30 } },
    { clave: "gooool_largo", es: { texto: "¡Goooooooool!", rate: -30 }, en: { texto: "Goooooooal!", rate: -30 } },
    { clave: "gol_x4", es: { texto: "¡Gol, gol, gol, gol!", rate: -10 }, en: { texto: "Goal, goal, goal, goal!", rate: -10 } },
    { clave: "gol_gol_gooool", es: { texto: "¡Gol, gol, gol, gooool!", rate: -20 }, en: { texto: "Go, go, go, goooal!", rate: -20 } },
    { clave: "y_gooool", es: { texto: "¡Y gooool!", rate: -30 }, en: { texto: "Aaaand goooal!", rate: -30 } },
    { clave: "remate", condicion: "remate", es: { texto: "¡Remate y gooool!", rate: -25 }, en: { texto: "Shot, and goooal!", rate: -25 } },
    { clave: "golazo", condicion: "golazo", prioridad: 1, es: { texto: "¡Qué golaaaazo!", rate: -25 }, en: { texto: "What a goal!", rate: -25 } },
    { clave: "tardio", condicion: "tardio", prioridad: 2, es: { texto: "¡Gooool sobre el final!", rate: -30 }, en: { texto: "A late, late goooal!", rate: -25 } },
    { clave: "empate", condicion: "empate", prioridad: 3, es: { texto: "¡Gooool del empate!", rate: -30 }, en: { texto: "Goooal, they're level!", rate: -25 } },
    { clave: "otro", condicion: "otro", prioridad: 4, es: { texto: "¡Y otro gooool!", rate: -30 }, en: { texto: "Another goooal!", rate: -30 } },
  ],
  /** «Golazo» es valorativo: solo lo habilita un remate cuyo origen dista de la línea de meta, en
   * profundidad (|hasta.x − desde.x|), al menos el largo del área: «desde fuera del área». 2 de 9
   * goles de los fixtures (16,6 y 18,3 m). No mide ángulo ni dificultad. */
  golazoDesdeM: ARENA.areaLargoM,
  /** «Remate y gol» (054 v1.1, por posición en registro.eventos): el evento anterior más cercano del
   * goleador es un `tiro` con el mismo origen y, entre los índices del tiro y del gol, no hay ningún
   * evento de estos tipos; lo posterior al gol (su reinicio del mismo tick) no cuenta. 9 de 9 goles de
   * los fixtures lo cumplen; un centro o pase que cruza la línea, no. */
  gritoRemate: { tiposQueRompen: ["pase", "recepcion", "intercepcion", "recuperacion", "atajada", "tiro", "tiro_fuera", "fuera_juego", "reinicio"] },
  /** Semilla derivada del orden de rotación de los gritos sin prioridad (por partido). */
  semillaGritos: "canto-gol-054:grito",
  plantillas: {
    /** Tramo goleador, cuatro variantes (elegirVarianteVoz sobre los cantos completos). */
    goleador: {
      es: ["¡Gol de {goleador}!", "¡Lo marca {goleador}!", "¡{goleador}, gol!", "¡Gol, gol de {goleador}!"],
      en: ["Goal by {goleador}!", "{goleador} scores!", "{goleador}, goal!", "Goal, goal by {goleador}!"],
    },
    /** Autogol: sin grito; este tramo sustituye a grito + goleador. */
    autogol: { es: "Gol en propia puerta de {goleador}.", en: "An own goal by {goleador}." },
    situacion: {
      es: { empate: "{equipo} empata", recorte: "{equipo} recorta distancias", goleada: "Goleada de {equipo}", ampliacion: "{equipo} amplía la ventaja", apertura: "{equipo} se adelanta", ventaja: "{equipo} se pone por delante" },
      en: { empate: "{equipo} level it", recorte: "{equipo} pull one back", goleada: "It's a rout for {equipo}", ampliacion: "{equipo} extend their lead", apertura: "{equipo} take the lead", ventaja: "{equipo} go in front" },
    },
    hechos: { es: "{situacion}, {marcador}, a los {segundos} segundos.", en: "{situacion}, {marcador}, after {segundos} seconds." },
    tardio: { es: "Sobre el final, ", en: "Late on, " },
    numeros: { es: ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"], en: ["nil", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"] },
    marcador: { es: "{local} a {visita}", en: "{local}–{visita}" },
    /** Palabra del rótulo para un autogol (el gol normal usa «Gol»/«Goal»). */
    rotulo: { autogol: { es: "Autogol", en: "Own goal" } },
  },
} as const;

/** Brief 057 · Reproducir con narración. */
export const PLAY_NARRADO = {
  /** Un solo reintento del registro de la grabación tras un 429 (ms); con `retry-after`, el mayor. */
  reintentoRegistroMs: 1500,
  /** v1.1 § 3 · Admisión de subidas `{ registro }` a /api/arena/grabaciones, decidida ANTES de leer el
   * cuerpo y de ejecutar `reproducirArena` (validación síncrona de hasta 180 s): ventana deslizante en
   * memoria por IP (primer salto de x-forwarded-for) y global, más un tope de replays simultáneos. */
  subida: {
    porIpPorHora: 6,
    globalPorHora: 30,
    enCurso: 1,
    /** Ventana deslizante de los dos cupos anteriores (ms): una hora. */
    ventanaMs: 3_600_000,
    /** Brief 057 v1.3 (1) · El cliente reintenta UNA vez un 429 solo si `retry-after` ≤ esto (s): el caso «en
     * curso» (2 s). Con más (cupo por IP o global agotado) degrada al momento a reproducción muda (`ocupado`). */
    reintentoMaxS: 5,
  },
} as const;
/** Brief 057 · Reconstrucción visual del gol: datos del registro (punto de cruce `gol.hasta`, distancia,
 * fotogramas) más una profundidad en la red y una altura ilustrativas. Nada de esto cambia el motor ni el
 * registro. */
export const GOL_VISUAL = {
  /** Segundos de partido en que el balón recorre `profundidadRedM` tras cruzar la línea (fase del cursor). */
  entradaRedS: 0.3,
  /** Segundos de partido con el balón en la red y los 22 quietos en su último fotograma previo. DEBE ser
   * menor que TECNICA_ARENA.pausaS (1,5 s): el corte al centro precede al saque registrado. */
  enRedS: 1.0,
  /** Metros tras la línea de meta a los que se detiene el balón (el arco real mide ≈ 2 m de fondo). */
  profundidadRedM: 1.0,
  /** Banda de altura de ALTURA_DESTINO_M según potenciaRemate(distanciaM) (051): corto → raso, lejano → alta.
   * Es ilustrativa: el motor es 2D y no registra altura. */
  cortesPotencia: { raso: 0.34, media: 0.67 },
  vista: {
    /** Radio esquemático del balón en la vista frontal (m); el real es 0,11. */
    radioBalonM: 0.18,
    /** Altura (viewBox) desde la que «llega» el balón antes de la fase del cursor, en décimas de metro. */
    llegadaAltaM: 0.3,
  },
} as const;

/** Brief 058 · Narración activa por defecto en el directo (solo cliente). Quien inicia el partido con la
 * casilla marcada oye la emisión sin otro clic: el AudioContext se ceba dentro de ese gesto. */
export const NARRACION_DIRECTO = {
  /** Preferencia por espectador en localStorage: "1" | "0"; ausente o ilegible ⇒ porDefecto. */
  clavePreferencia: "cronista:arena:narracion",
  porDefecto: true,
  /** Si el AudioContext no corre tras este plazo (ms), se muestra «Habilitar reproducción de audio». */
  desbloqueoMs: 1500,
  /** Retención inicial del reloj (ms) mientras se sabe si hay voz en una sesión propia (bloque B). */
  esperaHerramientasMs: 1500,
} as const;

/** Brief 058 · C1 (23 oct): tope diario de Speech de la réplica. 200.000 c la semana de jueces (antes 120.000);
 * 800 audios sin cambio. A ≈ 15,5 USD por millón, como máximo ≈ 3,1 USD al día. Revisar tras el fallo. */
export const SPEECH_DIARIO = { audios: 800, caracteres: 200_000 } as const;

/** Brief 058 · Bloque B · Antesala: nueve clips de plantilla, una sola voz (el narrador), antes del saque.
 * Medido con Speech real el 23 oct: 52,3 s (ES) y 52,5 s (EN) de audio para dos 4-2-3-1; ≈ 327 c de SSML por
 * clip. v1.1–v1.3: `topeS` es tiempo de PARED desde el clic que pidió la narración (0 = antesala sin retener
 * el reloj); el máximo en vuelo es VOZ_BUFFER.concurrencia (se lee en antesala.ts: buffer.ts importa este
 * archivo y no puede importarse aquí). */
export const ANTESALA_ARENA = {
  bloques: ["cabecera", "atras", "medio", "arriba"],
  /** Silencio (s de audio) entre dos clips de la antesala. */
  huecoS: 0.3,
  /** Espera máxima (s de audio) de un clip aún no decodificado antes de saltarlo. */
  esperaClipS: 4,
  /** Tiempo máximo (s de reloj de pared desde el clic) de la retención del reloj; 0 = sin retención (C2). */
  topeS: 75,
  /** Duración estimada máxima del guion (estimarDuracionS + huecos); por encima, la escalera del guion. */
  objetivoS: 66,
  maxFallosSeguidos: 2, reintentoMs: 600, maxReintentos: 1,
  /** v1.1 § 1: reintentos de un 409 (vista publicada aún sin `inicio`). */
  maxReintentos409: 3,
  /** v1.1 § 6: texto de un clip con los escapes de SSML (voz.ts) y cota del SSML de un clip (300 + 290 de marcas). */
  maxTextoEscapadoC: 300,
  maxSsmlClipC: 590,
  /** Bolsa propia por encuentro: 9 clips × 2 idiomas; 18 × maxSsmlClipC = 10.620 ≤ 10.800. */
  bolsaSpeech: { solicitudes: 18, caracteres: 10_800 },
  /** Plantillas habladas (§ 4.2), ES/EN paralelas. `entrenador` es el sufijo de `arriba` (empieza por espacio); `lista` une el último elemento: «A, B y C». */
  plantillas: {
    es: {
      apertura: "Bienvenidos a la arena: {local} contra {visita}.",
      cabeceraModelo: "{equipo} sale en {formacion}, con {modelo} al mando.",
      cabeceraProgramada: "{equipo} sale en {formacion}, con un plan programado.",
      cabecera: "{equipo} sale en {formacion}.",
      atras: "En la portería, {portero}; en defensa, {defensas}.",
      medio: "En el medio, {medios}.",
      arriba: "Arriba, {delanteros}.",
      entrenador: " Dirige {entrenador}.",
      lista: " y ",
      dorsal: "el {n}",
    },
    en: {
      apertura: "Welcome to the arena: {local} against {visita}.",
      cabeceraModelo: "{equipo} line up in a {formacion}, with {modelo} in charge.",
      cabeceraProgramada: "{equipo} line up in a {formacion}, on a programmed plan.",
      cabecera: "{equipo} line up in a {formacion}.",
      atras: "In goal, {portero}; at the back, {defensas}.",
      medio: "In midfield, {medios}.",
      arriba: "Up front, {delanteros}.",
      entrenador: " {entrenador} is the coach.",
      lista: " and ",
      dorsal: "number {n}",
    },
  },
  /** Rótulos de la tira «En voz» (§ 5, bloque C). */
  bloquesRotulo: { es: { cabecera: "Formación", atras: "Portería y defensa", medio: "Medio", arriba: "Ataque" }, en: { cabecera: "Formation", atras: "Goal and defence", medio: "Midfield", arriba: "Attack" } },
} as const;

/** Brief 060 · Pista narrada al ritmo del partido (Reproducir). Medido el 24 oct: con el relato detallado la
 * cancha iba a 0,13–0,29× y la voz se adelantaba hasta 16 s (docs/evidencia/repeticion-060). */
export const REPETICION_NARRADA = {
  /** s de partido mínimos entre que la cancha muestra el hecho y la voz empieza a contarlo (nunca delante). */
  reaccionS: 0.3,
  /** s de partido máximos de retraso de un clip del narrador; más allá se omite o, si es clave, la cancha espera. */
  retrasoMaxS: 3,
  /** Prioridad (PRIORIDAD_EVENTO_ARENA) desde la que un clip nunca se omite: remate (60) o más. */
  prioridadEspera: 60,
  /** s de silencio mínimo entre dos clips colocados. */
  huecoS: 0.25,
  /** Variante pedida a los invitados de la Mesa en esta pista (048: «breve» cae en «completa» si no hay). */
  varianteInvitado: "breve",
} as const;

/** Defecto de producción (smokes de capacidad y grupos, 24 oct) · El cierre del directo recibía 429 «Hay otras
 * consultas en curso»: el servidor admite 2 síntesis de voz simultáneas en total y, al terminar el partido, el cliente
 * pide a la vez el último tramo, el cierre y el invitado final de la Mesa. El presupuesto no se agotaba (la reserva
 * propia del cierre ya existe: MESA_ARENA.dialogo.reservaSpeechCierre*). */
/** Defecto de producción (rev. 0000035) · Cupo de encuentros con modelos por día UTC de la réplica (antes, el 10 literal
 * de sesiones.ts). El 429 que lo aplica lleva `motivo: "limite-diario"` y `limite`, y el panel lo explica. */
export const ENCUENTROS_LLM_DIARIOS = 10;

export const CIERRE_VOZ = {
  /** Plazas de síntesis simultánea que solo puede ocupar un cierre, además de las 2 comunes (prioridad del cierre). */
  plazasPropias: 1,
  /** s que anuncia `retry-after` en el 429 de concurrencia (los 429 de presupuesto no lo llevan y son finales). */
  retryAfterS: 1,
  /** El cliente reintenta el cierre ante un 429 con `retry-after`: espera max(retry-after, reintentoMs · 2^k) ms,
   * hasta maxReintentos veces (1 + 2 + 4 = 7 s, dentro de la reserva de la emisión). */
  reintentoMs: 1000, maxReintentos: 3,
} as const;

/** Brief 052 v1.1 §3–4 · Admisión de un modelo al catálogo público de la arena (smoke real,
 * `npm run arena:smoke-modelos`). No son parámetros del motor: son las cotas operativas con que
 * se decide si un deployment entra a ARENA_MODELOS. Presupuesto de tokens y solicitudes por
 * decisión son los de ARENA (tokensOrdenes, intentosOrdenes), los mismos que usa la web. */
export const SMOKE_MODELOS_ARENA = {
  /** Ninguna decisión del candidato puede superar este tiempo (mitad del plazo web de 60 s). */
  decisionMaxMs: 30_000,
  /** Partidos cortos (espejo, cruzado A, cruzado B): duración e intervalo en segundos. */
  cortoS: 60, cortoIntervaloS: 15,
  /** Partido «web»: la duración e intervalo que usa la arena publicada. */
  webS: 180, webIntervaloS: 30,
  /** Margen sobre el prompt_tokens máximo observado para estimar la entrada con reintento (§5). */
  factorEntradaReintento: 1.25,
} as const;

/** Brief 059 (v1.2) · Torneo entre modelos (`npm run arena:torneo`). Cotas operativas del CLI y de la
 * tabla; no son parámetros del motor ni del sitio público (que no lanza torneos). Toda autorización de
 * gasto se calcula en micro-USD enteros con redondeo al alza (§ 15.1): es un «tope por estimación», no una
 * garantía monetaria; el control real del gasto es la facturación de Azure. */
export const TORNEO_ARENA = {
  /** Versión del archivo `torneo.json` (esquema único y estricto de § 15.6). */
  version: "059-v1.1",
  /** Partido corto del smoke 052: 4 decisiones por lado, cubierto por la admisión de los seis. */
  duracionS: SMOKE_MODELOS_ARENA.cortoS,
  /** Intervalo por defecto y la única alternativa (variante barata, § 9). */
  intervalosS: [SMOKE_MODELOS_ARENA.cortoIntervaloS, SMOKE_MODELOS_ARENA.webIntervaloS],
  semillaDefecto: 59,
  participantes: { min: 3, max: 6 },
  puntos: { victoria: 3, empate: 1, derrota: 0 },
  /** Transporte: reintentos solo ante estos estados o error de red, dentro del plazo de la decisión
   * (v1.1: 2 reintentos, para que la reserva por partido sea útil). */
  http: { reintentos: 2, esperasMs: [2_000, 5_000], esperaMaxMs: 20_000, estadosReintentables: [408, 429, 500, 502, 503, 504] },
  /** Un partido anulado por infraestructura se repite hasta 2 veces; con 3 anulaciones seguidas se detiene. */
  repeticionesMax: 2, anuladosSeguidosMax: 3, enfriamientoMs: 120_000, pausaEntrePartidosMs: 3_000,
  /** `--tope-usd` obligatorio y nunca mayor que `topeMaxUsd`; `topePropuestoUsd` solo aparece como ayuda del CLI. */
  topeMaxUsd: 20, topePropuestoUsd: 16,
  /** Tokens de entrada añadidos al máximo por intento HTTP: cubren la respuesta anterior y el diagnóstico
   * del validador que reenvía el segundo intento del controlador (`controladores.ts`). */
  reserva: { margenCorreccionTokens: 512 },
  /** Registro comprimido (gzip 9) por partido; el descomprimido se acota con ARENA.archivoMaxBytes. */
  registroGzMaxBytes: 1_000_000,
  /** Umbral con el que se redacta la frase de la prueba de signos ilustrativa (§ 15.7). */
  alfa: 0.05,
  /** Ensayo sin inferencia (fixtures): duraciones admitidas en segundos. */
  ensayoSegundos: { min: 10, max: 60 },
} as const;

/** Brief 062 v1.3 · Torneo lanzable desde el sitio (cualquier visitante): un cupo global por día UTC, un torneo
 * activo a la vez, tope por estimación por formato y una bolsa del periodo. Reutiliza las reservas del 059
 * (`TORNEO_ARENA`). Las § 17, 18 y 19 del brief prevalecen sobre su § 8: intervalo de 30 s, topes 8/7 USD, sin
 * *lease* ni reanudación (mutex en proceso, latido de presencia, barrera de relevo y autosilencio). Toda cifra
 * monetaria es una estimación con precio de lista, no la factura. */
export const TORNEO_SITIO = {
  version: "062-v1",
  /** Espacio de nombres de los ids del sitio (`sitio-AAAA-MM-DD`, `sitio-prueba-<hex12>`); el CLI lo rechaza. */
  prefijoId: "sitio-",
  /** Un lanzamiento por día UTC en todo el sitio, sea cual sea el formato (la liga de prueba no lo consume). */
  cupoDiario: 1,
  formatos: {
    /** Liga = 059 (Berger de 6, ida y vuelta). § 17.5: típico ≈ 3,54 USD a 30 s + reserva del más caro ≤ 8. */
    liga: { topeUsd: 8 },
    /** 2 grupos de 3 a ida y vuelta, pasan 2, llaves a partido único y como mucho 1 desempate por llave (P1-b). */
    grupos: { grupos: 2, porGrupo: 3, pasanPorGrupo: 2, desempatesPorLlave: 1, topeUsd: 7 },
  },
  /** Salvaguarda del crédito (§ 5.3): conocido acumulado de los torneos reales + tope del formato ≤ bolsa. */
  bolsaUsd: 50,
  /** Admisión en memoria (clase del 057): por IP (último salto de x-forwarded-for) y global; solo protege la
   * carga de la ruta, lo económico lo protegen el cupo y la bolsa persistidos (§ 17.7). */
  admision: { porIpPorHora: 3, globalPorHora: 20, enCurso: 1, ventanaMs: 3_600_000, cuerpoMaxBytes: 1_024 },
  /** § 17.7 · Plazo de lectura del cuerpo de la petición de lanzamiento (408 si se pasa). */
  cuerpoPlazoMs: 2_000,
  /** § 17.5 · Intervalo de decisión del torneo del sitio (2 decisiones por entrenador y partido de 60 s). */
  intervaloS: 30,
  /** D12 · Cada ronda dura al menos su intervalo de reloj de pared. */
  ritmoReal: true,
  /** Plazo total desde `inicioUtc`: pasado, el torneo termina `incompleto` con `motivoFin: "plazo"`. */
  plazoTotalMs: 10_800_000,
  /** Con `TORNEO_ARENA.anuladosSeguidosMax` anulados seguidos se espera esto UNA vez; si se repite, termina. */
  enfriamientoLargoMs: 600_000,
  /** Sondeo de la página mientras el torneo está `en_curso` (solo con la pestaña visible). */
  sondeoUiMs: 15_000,
  /** Solo para la duración mostrada: segundos por partido además de la duración y la pausa. */
  margenValidacionS: 2,
  /** § 18.1 · Latido de presencia de CADA proceso (`latido-<proceso>.json`), reescrito con este periodo. */
  latidoMs: 10_000,
  /** § 18.1 · Un latido ajeno más reciente que esto mantiene la barrera de relevo del proceso nuevo. */
  latidoCaducoMs: 45_000,
  /** § 19 · El proceso deja de escribir si su última renovación correcta tiene esta edad (< latidoCaducoMs). */
  latidoSilencioS: 30,
  /** § 18.1 · Periodo con el que el proceso nuevo vuelve a mirar los latidos ajenos. */
  relevoSondeoMs: 5_000,
  /** § 18.1 · Plazo de cada operación del almacén de torneos (`AbortSignal.timeout`). */
  opPlazoMs: 10_000,
  /** § 18.2 · Reintento del cierre de arranque mientras quede algún pendiente, y plazo total de reintentos. */
  cierreReintentoMs: 30_000,
  cierrePlazoMs: 600_000,
  /** § 17.6 · Token de administración (cancelación, cierre y liga de prueba): fallos por hora y longitud mínima. */
  admin: { fallosPorHora: 10, tokenMinCaracteres: 32 },
  /** Brief 063 v1.1 § 17.4 y v1.2 § 18.2 · Factor sobre el prompt máximo medido el 22 oct (sin atributos): las
   * peticiones de reinicios-v7 llevan `equipos[lado].atributos` y frases nuevas en el sistema. La observación más
   * grande medida (tick 0 con banco) pasa de 16,8 a ≈ 19,5 KB (×1,16); el factor cubre la petición completa con un 10 %
   * de margen de tokens (la prueba exige factor ≥ 1,1 × el mayor cociente de caracteres v7/v5, semillas 1–50). v1.2 § 18.2:
   * 1,3 no bastaba (mayor cociente medido de la petición completa 1,1924 → 1,1 × 1,1924 = 1,3117); se sube a 1,32 y los
   * dos formatos siguen cabiendo en su tope. Publicación 3 (reinicios-v8, § 18.2): la petición lleva además
   * `equipos[lado].estiloJuego` y frasesIdentidad(); mayor cociente medido 1,2143 (v8/v5; v7/v5 1,2050 con el sistema
   * nuevo) → 1,1 × 1,2143 = 1,3357; se sube a 1,34 y se rehace la comprobación de topes (la prueba la repite).
   * Brief 065 (reinicios-v9): la petición tiene las mismas claves que v8; mayor cociente medido 1,2144 (v9/v5, semillas
   * 1–50) → 1,1 × 1,2144 = 1,3359 ≤ 1,34: el factor no cambia y los topes de liga y grupos siguen cumpliéndose. */
  factorObservacion063: 1.34,
} as const;

/**
 * Brief 064 § 6 (bloque B) · Crónica verificada por partido de la arena. Las pruebas importan estas cifras; ninguna las
 * repite a mano. `llamadasPorCronica` no vive aquí: es `1 + MAX_REINTENTOS` de `cadena/umbrales.ts`.
 */
export const CRONICA_ARENA = {
  /** Versión del archivo `<h>.cronica.json`. */
  version: "cronica-arena-v1",
  /** Versión del catálogo del Analista de arena (§ 4.2); cambiarla invalida las guardadas (`desactualizada`). */
  analista: "hechos-arena-v1",
  /** Primer recorte de hechos; los obligatorios (≥ COBERTURA) nunca se recortan (después manda maxCaracteresEntrada). */
  maxHechos: 24,
  /** Que un partido largo no llene la crónica de una sola clase. */
  maxPorClase: { lejanos: 3, amarillas: 4, cambios: 4 },
  /** Relevancia de cada clase del catálogo; obligatorios = los que V5 exige con COBERTURA 70. */
  relevancia: { resultado: 100, gol: 90, autogol: 90, varios: 80, expulsion: 75, finalAnticipado: 75, remates: 60, atajadas: 55, lejano: 50, amarilla: 45, largos: 40, cambio: 35, fueraJuego: 30 },
  /** Generaciones con modelo por día UTC (tope estimado ≈ 5,04 USD/día, § 4.5); `ARENA_CRONICA_DIARIA` lo sustituye. */
  diarias: 15,
  /** Tokens de salida por llamada, razonamiento incluido; JSON bilingüe de ≤ hechos.length oraciones. */
  maxTokensSalida: 5_000,
  /** Plazos por intento y total, por debajo de los 240 s del ingress. */
  plazoIntentoMs: 60_000,
  plazoTotalMs: 150_000,
  /** Plazo del cliente: total + margen. */
  plazoClienteMs: 165_000,
  /** System prompt + mensaje inicial; sin caber con los obligatorios → acta `tamano`. */
  maxCaracteresEntrada: 22_000,
  /** `feedbackAcotado`. */
  maxCaracteresFeedback: 4_000,
  /** Respuesta del modelo que se reenvía en la conversación; más larga = intento fallido V1. */
  maxCaracteresRespuesta: 12_000,
  /** `esquemaCronicaArena` serializado (la unitaria 7 lo mide con 24 hechos). */
  maxCaracteresEsquema: 6_000,
  /** Una réplica, coste predecible. */
  generacionesSimultaneas: 1,
  /** `retry-after` del 429 `en-curso`. */
  reintentoOcupadoS: 5,
  /** 2 × plazoTotalMs: una reserva pendiente más vieja es `abandonada`. */
  reservaAbandonadaMs: 300_000,
  /** Registros nuevos por día UTC: acota el almacén (≈ 1–2 MB por registro comprimido). */
  registrosDiarios: 200,
  /** Admisión de subidas `{ registro }`: protege la CPU de reproducirArena. */
  admision: { porIpPorHora: 10, globalPorHora: 60, enCurso: 1, ventanaMs: 3_600_000 },
  /** La repetición empieza un poco antes de la jugada. */
  antesDelEventoS: 3,
} as const;
