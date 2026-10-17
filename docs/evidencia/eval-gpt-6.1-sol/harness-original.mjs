// src/sim/tipos.ts
function ladoDelJugador(e) {
  return e.autogol === true ? e.equipo === "local" ? "visita" : "local" : e.equipo;
}
var TITULARES = 11;
var SUPLENTES = 5;
var MAX_CAMBIOS = 3;
var FUERZA_MIN = 1;
var FUERZA_MAX = 100;

// src/sim/limites.ts
var ZONAS_ORIGEN = ["area_chica", "punto_penal", "frontal_del_area", "banda_izquierda", "banda_derecha", "media_distancia"];
var DESTINOS = ["palo_izquierdo", "palo_derecho", "centro_del_arco"];
var ALTURAS = ["raso", "media", "alta"];
var LADOS_PORTERO = ["su_izquierda", "su_derecha", "centro"];
var BANDAS = ["izquierda", "derecha"];
var LADO_PORTERO_DE = {
  palo_izquierdo: "su_derecha",
  palo_derecho: "su_izquierda",
  centro_del_arco: "centro"
};
var ZONAS_AREA = ["area_chica", "frontal_del_area"];
var ZONAS_ORIGEN_PASE = ["banda_izquierda", "banda_derecha", "frontal_del_area", "media_distancia"];
var XG_PENAL = 0.76;
var ZONA_XG_BANDAS = {
  area_chica: { min: 0.15, max: 1, incluyeMax: true },
  punto_penal: { min: XG_PENAL, max: XG_PENAL, incluyeMax: true },
  // Rev 1.1 del 012: el piso del frontal baja a 0.01 (un tiro raso desde el frontal tras el
  // despeje de un córner es fútbol normal): así todo tiro tras córner tiene zona de área.
  // Brief 015 (decisión de Fable): el techo baja de 0.50 a 0.30 — un xG ≥ 0.3 es una ocasión
  // clara de cerca, nunca un tiro desde el borde del área. Esos tiros van al área chica.
  frontal_del_area: { min: 0.01, max: 0.3, incluyeMax: false },
  banda_izquierda: { min: 0.01, max: 0.3, incluyeMax: false },
  banda_derecha: { min: 0.01, max: 0.3, incluyeMax: false },
  media_distancia: { min: 0.01, max: 0.15, incluyeMax: false }
};
var TIPOS_ATAQUE = ["tiro", "gol", "atajada", "corner", "pase_clave", "fuera_de_juego"];
var TRAS_CORNER_MAX_MIN = 1;
var TIPOS_MICRO = ["pase", "conduccion", "regate", "duelo", "perdida", "recuperacion"];
var CANALES = ["banda_izquierda", "centro", "banda_derecha"];
var PASE_M = { corto: { min: 4, max: 15 }, medio: { min: 15, max: 30 }, largo: { min: 30, max: 55 } };
var CONDUCCION_M = { min: 2, max: 25 };
var DISTANCIA_ZONA = {
  area_chica: { min: 2, max: 6 },
  punto_penal: { min: 11, max: 11 },
  frontal_del_area: { min: 16, max: 22 },
  banda_izquierda: { min: 10, max: 24 },
  banda_derecha: { min: 10, max: 24 },
  media_distancia: { min: 20, max: 32 }
};
var XG_ALTO = { xgMin: 0.3, distanciaMax: 12 };
var TIRO_LEJANO = { distanciaMin: 20, xgMax: 0.15 };
var VELOCIDAD = { min: 60, max: 125 };
var VELOCIDAD_PENAL = { min: 75, max: 110 };
var VELOCIDAD_LEJANO = { distanciaMin: 20, min: 80 };
var FUERA_DEL_AREA_M = 17;
var MISIL_KMH = 100;
var CLIMAS_PARTIDO = ["despejado", "calor", "lluvia", "frio", "niebla"];
var SUPERFICIES = ["natural", "sintetica"];
var CESPEDES = ["corto", "alto"];
var NIVELES_PRESION = ["baja", "media", "alta"];
var TEMPERATURA_C = { calor: { min: 29, max: 41 }, frio: { min: -8, max: 5 } };
var SALIDA_TEMPRANA_MIN = 25;
var CAUSAS_INTERRUPCION = ["perro", "objeto", "globos"];
var DURACION_INTERRUPCION = { min: 1, max: 3 };
var SUBIDA_MINUTO_MIN = 88;
var XG_OLIMPICO = 0.01;
var NIVEL = { min: 1, max: 100 };
var DEFINICIONES = ["jugada", "cabezazo", "mano_a_mano", "vaselina", "chilena", "tijera", "media_cancha", "olimpico"];
var DEF_CABEZAZO = { velocidad: { min: 60, max: 75 } };
var DEF_VASELINA = { velocidad: { min: 60, max: 70 } };
var DEF_MANO_A_MANO = { xgMin: 0.2 };
var DEF_MEDIA_CANCHA = { distancia: { min: 40, max: 55 }, xgMax: 0.03, velocidadMin: 85 };
var LESION_JORNADAS = { min: 1, max: 4 };
var LESION_SEVERIDAD = { 1: 0.4, 2: 0.3, 3: 0.2, 4: 0.1 };
var TIPOS_SANCION_CLUB = ["deduccion", "puerta_cerrada", "limite_banco"];
var CAUSAS_SANCION_CLUB = ["irregularidad_financiera", "alineacion_indebida", "incidentes_de_publico"];
var BANCO_LIMITADO = 3;

// src/sim/parametros.ts
var P = {
  // --- Reloj ---
  /** Duración de una posesión en minutos: base + uniforme(0, rango), × factor de estilo. */
  duracionMin: 0.2,
  duracionRango: 0.5,
  /** Minutos que se consumen tras un gol (celebración + saque). */
  tiempoGol: 1,
  /** Tiempo entre eventos encadenados dentro de una misma posesión. */
  pasoEvento: 0.1,
  /** Descuento del primer tiempo (sus eventos se sellan en el minuto 45). */
  descuento1: { min: 1, max: 3 },
  /** Descuento del segundo tiempo (minutos 90+1 … 90+max). */
  descuento2: { min: 2, max: 6 },
  // --- Progresión ---
  /** Probabilidad base de que una posesión llegue al último tercio. */
  ataqueBase: 0.3,
  /** Sensibilidad exponencial a (ataque propio − defensa rival)/100. */
  kFuerzaAtaque: 1.2,
  /** Tope de probabilidad de llegar al último tercio. */
  ataqueMax: 0.8,
  // --- Resolución en el último tercio (probabilidades excluyentes) ---
  pTiro: 0.32,
  pFueraDeJuego: 0.07,
  pFaltaArea: 0.1,
  pCornerDirecto: 0.1,
  // --- Tiros ---
  /** log-xG ~ Normal(mu + desplazamientos, sigma), recortado a [xgMin, xgMax]. */
  xgMu: -2.8,
  xgSigma: 0.9,
  xgMuCabezazo: -2.9,
  xgMuTiroLibre: -3,
  xgMin: 0.01,
  xgMax: 0.95,
  /** Desplazamiento de log-xG por (ataque − defensa rival)/100. */
  kFuerzaXg: 1,
  /** Probabilidad de atajada (condicionada a no gol), en tiro abierto y penal. */
  pAtajada: 0.3,
  pAtajadaPenal: 0.7,
  /** Corner tras atajada / tras tiro desviado. */
  pCornerTrasAtajada: 0.35,
  pCornerTrasDesvio: 0.12,
  /** Tiro tras corner (cabezazo). */
  pTiroCorner: 0.3,
  xgPenal: XG_PENAL,
  // brief 012: la misma cifra que la banda del punto penal (limites.ts)
  /** Tras una falta en el último tercio: penal o tiro libre directo. */
  pPenalTrasFalta: 0.035,
  pTiroLibreTrasFalta: 0.12,
  // --- Faltas y tarjetas ---
  /** Falta del equipo que defiende cuando la posesión NO llega al último tercio. */
  pFaltaDefensorMedio: 0.08,
  /** Falta del equipo que ataca (cargas, manos) en una posesión cualquiera. */
  pFaltaAtacante: 0.025,
  pAmarilla: 0.16,
  /** Amarilla en la falta que concede un penal (ocasión manifiesta). */
  pAmarillaPenal: 0.45,
  pRojaDirecta: 25e-4,
  /** Un amonestado comete menos faltas (peso multiplicado). */
  cautelaAmonestado: 0.15,
  // --- Estado del partido ---
  /** Cansancio: crece linealmente entre estos minutos (0 → 1). */
  fatigaDesde: 60,
  fatigaHasta: 90,
  fatigaAtaque: 0.12,
  fatigaXg: 0.12,
  fatigaFaltas: 0.15,
  /** Desde este minuto, el que pierde empuja y el que gana se repliega. */
  marcadorDesde: 60,
  perdiendoEmpuje: 0.15,
  ganandoRepliegue: 0.1,
  /** Por cada expulsado propio / del rival. */
  rojaPropiaAtaque: 0.85,
  rojaRivalAtaque: 1.12,
  rojaRivalXg: 0.06,
  // --- Cambios ---
  /** Distribución del número de cambios por equipo (índice = cantidad). */
  pesosCambios: [0.04, 0.08, 0.25, 0.63],
  cambioDesde: 55,
  cambioHasta: 88
};
var ESTILO_ATAQUE = {
  // Posesiones largas, llega con pases elaborados.
  posesion: { duracion: 1.3, ataque: 1.2, paseClave: 0.85, xgShift: 0 },
  // Posesiones cortas, menos llegadas pero ocasiones más claras.
  contragolpe: { duracion: 0.8, ataque: 0.85, paseClave: 0.5, xgShift: 0.24 },
  // Recupera arriba: llega más a menudo, tiros de calidad normal.
  presion: { duracion: 0.95, ataque: 1.1, paseClave: 0.5, xgShift: -0.05 }
};
var ESTILO_DEFENSA = {
  posesion: { faltas: 0.9, ataqueRival: 1 },
  contragolpe: { faltas: 1, ataqueRival: 1 },
  presion: { faltas: 1.4, ataqueRival: 0.95 }
};
var PESOS = {
  tiro: { POR: 0, DEF: 1, MED: 3, DEL: 6 },
  cabezazo: { POR: 0, DEF: 3, MED: 1, DEL: 4 },
  paseClave: { POR: 0, DEF: 2, MED: 5, DEL: 3 },
  falta: { POR: 0, DEF: 4, MED: 4, DEL: 2 },
  fueraDeJuego: { POR: 0, DEF: 0.3, MED: 2, DEL: 6 },
  corner: { POR: 0, DEF: 1, MED: 5, DEL: 2 },
  tiroLibre: { POR: 0, DEF: 1, MED: 4, DEL: 3 },
  saleCambio: { POR: 0, DEF: 2, MED: 3, DEL: 4 }
};
var ESPACIAL = {
  /** Destino del tiro (visto desde el tirador). */
  destino: { palo_izquierdo: 0.4, palo_derecho: 0.4, centro_del_arco: 0.2 },
  altura: { raso: 0.45, media: 0.3, alta: 0.25 },
  /** Tiro de jugada con ocasión clara (xG ≥ banda de área chica). */
  jugadaClara: { area_chica: 0.55, frontal_del_area: 0.3, banda_izquierda: 0.075, banda_derecha: 0.075 },
  /** Tiro de jugada intermedio (entre las dos bandas). */
  jugadaMedia: { frontal_del_area: 0.6, banda_izquierda: 0.2, banda_derecha: 0.2 },
  /** Brief 012: un tiro de jugada con xG ≤ esto (y dentro de la banda de media distancia) usa la tabla lejana. */
  lejanoXgMax: 0.08,
  /** Tiro de jugada lejano. */
  jugadaLejana: { media_distancia: 0.5, frontal_del_area: 0.2, banda_izquierda: 0.15, banda_derecha: 0.15 },
  /** Cabezazo de córner con ocasión clara; si no, frontal del área. */
  cornerClaro: { area_chica: 0.7, frontal_del_area: 0.3 },
  /** Tiro libre lejano; si no, frontal del área. */
  libreLejano: { media_distancia: 0.6, frontal_del_area: 0.4 },
  /** Pase clave desde el último tercio (desde el medio es siempre media distancia). */
  paseAtaque: { banda_izquierda: 0.35, banda_derecha: 0.35, frontal_del_area: 0.3 },
  banda: { izquierda: 0.5, derecha: 0.5 },
  /** Brief 015 — velocidad del disparo (km/h): media, dispersión y +km/h por metro de distancia. */
  velocidadMedia: 89,
  velocidadSigma: 11,
  velocidadPorMetro: 0.6,
  velocidadMetroRef: 14
};
var CONDICIONES = {
  /** Intensidad del calor: 0 hasta `calorDesdeC`, lineal hasta 1 en `calorHastaC`. */
  calorDesdeC: 25,
  calorHastaC: 41,
  /** 1 · Cansancio: en el 2.º tiempo, acciones micro × (1 − k·i) y llegadas al último tercio × (1 − k·i). */
  calorRitmo2T: 0.2,
  calorAtaque2T: 0.22,
  /** 2 · Piernas pesadas: en el 2.º tiempo, faltas × (1 + k·i). */
  calorFaltas2T: 0.45,
  /** 3 · Lluvia: completación de todo pase − k; atajada sin retención ⇒ córner × k. */
  lluviaPase: 0.05,
  lluviaCornerTrasAtajada: 1.6,
  /** 4 · Sintética: velocidad del tiro + k km/h (bandas del 015 intactas); peso de media distancia en tiros lejanos × k. */
  sinteticaVelocidadKmh: 5,
  sinteticaMediaDistancia: 1.8,
  /** 5 · Césped alto: completación de los pases CORTOS del visitante − k. */
  cespedAltoCortoVisita: 0.065,
  /** 6 · Presión alta: completación de los pases en la zona de salida del presionado − k, en tramos antes de este minuto. */
  presionAltaSalida: 0.12,
  presionHastaMin: 25
};
var INSOLITOS = {
  /** Gol olímpico: probabilidad de que un córner entre directo. */
  pOlimpico: 12e-5,
  /** Subida del portero a un córner elegible (≥ SUBIDA_MINUTO_MIN, perdiendo por 1). */
  pSubida: 0.025,
  /** Peso del portero en el cabezazo de ESE córner (los de campo: PESOS.cabezazo). */
  pesoPorteroSubida: 2,
  /** Palo: probabilidad de que un tiro desviado (sin gol ni atajada) dé en un palo; y de que dé en los dos. */
  pAlPalo: 0.055,
  pDoblePalo: 0.012,
  /**
   * Interrupción: probabilidad por partido, SOLO en el 2.º tiempo (delta de Fable, 3 oct: el 1.º se
   * sella en el 45 y su descuento no es verificable). Era 0,0075 por tiempo; con solo el 2.º daba
   * 0,69 % en liga (5 de 720, bajo el piso de 1 %) ⇒ subido a 0,016: 11 de 720 (1,53 %).
   */
  pInterrupcion: 0.016,
  /** Niebla: completación de los pases LARGOS − k (no se ve lejos). */
  nieblaPaseLargo: 0.08
};
var NIVELES = {
  /** Generación: dispersión dentro del equipo y recorte alrededor de la media. */
  sigma: 8,
  recorte: 20,
  /** 1 · Protagonista: el peso de PESOS × (1 + k·delta) en remates, pases clave, córners y tiros libres. */
  kProtagonista: 4.5,
  /** 2 · Micro pase: completación + k·delta del que pasa. */
  kPase: 0.25,
  /** 3 · Micro regate / duelo: éxito + k·delta del que lo intenta. */
  kRegate: 0.4,
  /** 4 · xG: log-xG + k·delta del tirador (pequeño). */
  kXg: 1,
  /** 5 · Atajada: probabilidad + k·delta del portero en el arco. */
  kAtajada: 0.6,
  /** El factor del protagonista nunca baja de esto (un peso nunca se anula por el nivel). */
  factorMin: 0.2
};
var DEFINICION = {
  pMediaCancha: 0.12,
  pChilena: 0.1,
  /** De las chilenas, cuántas son de tijera. */
  pTijera: 0.4,
  pCabezazo: 1,
  pVaselina: 0.75,
  pManoAMano: 0.9,
  /** Velocidad reescrita de la media cancha: [mínimo coherente, este techo]. */
  velocidadMediaCanchaMax: 112
};
var AUTOGOL = {
  /** Probabilidad de que el gol de un tiro (no penal) vaya a propia puerta. */
  p: 0.026,
  /** Peso por posición del autor (del equipo que lo sufre): sobre todo defensores. */
  peso: { POR: 0.3, DEF: 6, MED: 2, DEL: 0.5 }
};
var LESIONES = {
  /** Probabilidad de que una falta lesione al que la recibe. */
  pPorFalta: 8e-3,
  /** Sobreesfuerzo por posesión: base × (1 + k·cansancio). */
  pSobreesfuerzo: 65e-5,
  kSobreesfuerzo: 3,
  /** Peso por posición de quién se lesiona. */
  peso: { POR: 0.2, DEF: 1, MED: 1.2, DEL: 1.4 }
};
var MICRO = {
  /** Acciones por minuto de reloj entre anclas, y extra por ancla de ataque (la elaboración). */
  accionesPorMinuto: 16.2,
  accionesAncla: 2,
  /** Reparto de acciones del poseedor (resto: pase). */
  pConduccion: 0.34,
  pRegate: 0.04,
  pDuelo: 0.05,
  /** Completación de pase: base + k·(ataque − defensa rival)/100, por estilo. */
  paseBase: 0.8,
  /** Ajuste de completación por zona: en la salida se juega seguro, arriba se arriesga. */
  paseZona: { defensa: 0.17, medio: 0, ataque: -0.1 },
  /** Factor de intentos de regate/duelo por zona (en la salida casi nadie regatea). */
  riesgoZona: { defensa: 0.1, medio: 1, ataque: 1.4 },
  paseKFuerza: 0.4,
  paseEstilo: { posesion: 0.045, contragolpe: -0.04, presion: 0 },
  /** Regate exitoso: base + k·(ataque − defensa rival)/100. */
  regateBase: 0.55,
  regateKFuerza: 0.4,
  /** Duelo ganado por el poseedor. */
  dueloBase: 0.5,
  /** Mezcla de pases por zona: probabilidad de corto / medio (resto largo). */
  paseMezcla: {
    defensa: { corto: 0.5, medio: 0.32 },
    medio: { corto: 0.6, medio: 0.32 },
    ataque: { corto: 0.75, medio: 0.25 }
    // sin largos: un pase largo no sale de la zona de ataque (invariante)
  },
  /** Avance de zona: probabilidad de subir de zona tras un pase completado según su largo, y tras una conducción. */
  avance: {
    defensa: { corto: 0.35, medio: 0.55, largo: 0.75, conduccion: 0.35 },
    medio: { corto: 0.12, medio: 0.3, largo: 0.5, conduccion: 0.15 },
    ataque: { corto: 0, medio: 0, largo: 0, conduccion: 0 }
  },
  /** Preferencia de canal de cada equipo: peso extra del canal preferido (sorteado por equipo). */
  canalBase: { banda_izquierda: 0.36, centro: 0.28, banda_derecha: 0.36 },
  canalPreferido: 0.04,
  /** Pesos del actor según posición (POR casi no participa salvo al salir). */
  actor: { POR: 0.3, DEF: 2, MED: 3, DEL: 2 },
  regateador: { POR: 0, DEF: 0.5, MED: 2, DEL: 4 }
};

// src/sim/condiciones.ts
function intensidadCalor(c) {
  if (!c || c.clima !== "calor" || c.temperaturaC === void 0) return 0;
  const i = (c.temperaturaC - CONDICIONES.calorDesdeC) / (CONDICIONES.calorHastaC - CONDICIONES.calorDesdeC);
  return Math.min(1, Math.max(0, i));
}
function factorAtaque(c, periodo) {
  const i = intensidadCalor(c);
  return periodo === 2 && i > 0 ? 1 - CONDICIONES.calorAtaque2T * i : 1;
}
function factorRitmo(c, periodo) {
  const i = intensidadCalor(c);
  return periodo === 2 && i > 0 ? 1 - CONDICIONES.calorRitmo2T * i : 1;
}
function factorFaltas(c, periodo) {
  const i = intensidadCalor(c);
  return periodo === 2 && i > 0 ? 1 + CONDICIONES.calorFaltas2T * i : 1;
}
function factorCornerTrasAtajada(c) {
  return c?.clima === "lluvia" ? CONDICIONES.lluviaCornerTrasAtajada : 1;
}
function extraVelocidad(c) {
  return c?.superficie === "sintetica" ? CONDICIONES.sinteticaVelocidadKmh : 0;
}
function factorMediaDistancia(c) {
  return c?.superficie === "sintetica" ? CONDICIONES.sinteticaMediaDistancia : 1;
}
function castigoPase(c, lado, zona, clase, minutoAncla) {
  if (!c) return 0;
  let k = 0;
  if (c.clima === "lluvia") k += CONDICIONES.lluviaPase;
  if (c.clima === "niebla" && clase === "largo") k += INSOLITOS.nieblaPaseLargo;
  if (lado === "visita" && c.superficie === "natural" && c.cesped === "alto" && clase === "corto") k += CONDICIONES.cespedAltoCortoVisita;
  if (c.presion[lado] === "alta" && zona === "defensa" && minutoAncla < CONDICIONES.presionHastaMin) k += CONDICIONES.presionAltaSalida;
  return k;
}
function nivelSiguiente(n) {
  return n === "baja" ? "media" : "alta";
}
function erroresCondiciones(c, aPuertaCerrada = false) {
  const err = [];
  if (!CLIMAS_PARTIDO.includes(c.clima)) err.push(`clima fuera de vocabulario (${String(c.clima)})`);
  if (c.clima === "calor" || c.clima === "frio") {
    const b = TEMPERATURA_C[c.clima];
    if (!Number.isInteger(c.temperaturaC) || c.temperaturaC < b.min || c.temperaturaC > b.max)
      err.push(`${c.clima} con temperatura ${String(c.temperaturaC)} (entero en [${b.min}, ${b.max}])`);
  } else if (c.temperaturaC !== void 0) err.push(`${c.clima} con temperatura (solo calor y fr\xEDo la registran)`);
  if (!SUPERFICIES.includes(c.superficie)) err.push(`superficie fuera de vocabulario (${String(c.superficie)})`);
  if (c.superficie === "natural" && (c.cesped === void 0 || !CESPEDES.includes(c.cesped))) err.push(`c\xE9sped natural sin altura v\xE1lida (${String(c.cesped)})`);
  if (c.superficie === "sintetica" && c.cesped !== void 0) err.push("c\xE9sped con altura en una cancha sint\xE9tica");
  if (!c.presion || !NIVELES_PRESION.includes(c.presion.local) || !NIVELES_PRESION.includes(c.presion.visita)) err.push("presi\xF3n fuera de vocabulario");
  else if (aPuertaCerrada) {
    if (c.presion.local !== "baja" || c.presion.visita !== "baja") err.push(`presi\xF3n ${c.presion.local}/${c.presion.visita} a puerta cerrada (sin p\xFAblico: baja para ambos)`);
  } else if (c.presion.local === "alta" || c.presion.visita !== nivelSiguiente(c.presion.local))
    err.push(`presi\xF3n ${c.presion.local}/${c.presion.visita}: el visitante va siempre un nivel por encima del local`);
  return err;
}

// src/sim/prng.ts
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function crearRng(seed) {
  const next = mulberry32(seed);
  const rng = {
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    chance(p) {
      return next() < p;
    },
    normal() {
      const u = 1 - next();
      const v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    pick(items) {
      if (items.length === 0) throw new Error("pick sobre lista vac\xEDa");
      return items[Math.floor(next() * items.length)];
    },
    weighted(items, weight) {
      let total = 0;
      for (const it of items) total += Math.max(0, weight(it));
      if (total <= 0) return void 0;
      let r = next() * total;
      for (const it of items) {
        const w = Math.max(0, weight(it));
        if (w <= 0) continue;
        r -= w;
        if (r < 0) return it;
      }
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (weight(it) > 0) return it;
      }
      return void 0;
    }
  };
  return rng;
}
function prngDerivado(semilla, clave) {
  let h = 2166136261;
  const texto = `${semilla >>> 0}:${clave}`;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return crearRng(h);
}

// src/sim/niveles.ts
var mediaDeEquipo = (e) => (e.ataque + e.defensa) / 2;
var deltaNivel = (j, e) => j?.nivel === void 0 ? 0 : (j.nivel - mediaDeEquipo(e)) / 100;

// src/sim/micro.ts
var rival = (l) => l === "local" ? "visita" : "local";
var espejoCanal = (c) => c === "banda_izquierda" ? "banda_derecha" : c === "banda_derecha" ? "banda_izquierda" : "centro";
var espejoZona = (z2) => z2 === "defensa" ? "ataque" : z2 === "ataque" ? "defensa" : "medio";
var subir = (z2) => z2 === "defensa" ? "medio" : "ataque";
var ANCLAS_ATAQUE = /* @__PURE__ */ new Set(["tiro", "pase_clave", "corner", "fuera_de_juego"]);
function enCancha(p, hasta) {
  const out = { local: p.config.local.jugadores.slice(0, 11), visita: p.config.visita.jugadores.slice(0, 11) };
  for (const e of p.eventos.slice(0, hasta)) {
    if (e.tipo === "cambio" && e.jugador && e.sale) {
      const entra = p.config[e.equipo].jugadores.find((j) => j.nombre === e.jugador);
      if (entra) out[e.equipo] = out[e.equipo].map((j) => j.nombre === e.sale ? entra : j);
    }
    if (e.tipo === "tarjeta_roja" && e.jugador) out[e.equipo] = out[e.equipo].filter((j) => j.nombre !== e.jugador);
  }
  return out;
}
function canalesDe(plantel2) {
  const m = /* @__PURE__ */ new Map();
  for (const pos of ["POR", "DEF", "MED", "DEL"]) {
    const linea = plantel2.filter((j) => j.posicion === pos);
    linea.forEach((j, i) => {
      const n = linea.length;
      m.set(j.nombre, n === 1 || pos === "POR" ? "centro" : i === 0 ? "banda_izquierda" : i === n - 1 ? "banda_derecha" : "centro");
    });
  }
  return m;
}
function elegir(rng, js, peso) {
  return rng.weighted(js, peso) ?? js[0];
}
function sortearCanal(rng, pref) {
  return rng.weighted([...CANALES], (c) => MICRO.canalBase[c] + (c === pref ? MICRO.canalPreferido : 0)) ?? "centro";
}
function canalPreferido(semilla, lado) {
  return prngDerivado(semilla, `micro:canal:${lado}`).pick(CANALES);
}
function inicioTras(p, k) {
  for (let i = k - 1; i >= 0; i--) {
    const e = p.eventos[i];
    switch (e.tipo) {
      case "inicio_periodo":
        return { equipo: e.equipo, zona: "medio" };
      case "gol":
        return { equipo: rival(e.equipo), zona: "medio" };
      // saca de centro el que recibió
      case "tiro":
      case "atajada":
        return { equipo: rival(e.equipo), zona: "defensa" };
      // saque de arco / el portero
      case "falta":
      case "tarjeta_amarilla":
      case "tarjeta_roja":
        return { equipo: rival(e.equipo), zona: espejoZona(e.zona ?? "medio") };
      case "corner":
        return { equipo: e.equipo, zona: "ataque", ...e.jugador ? { actor: e.jugador } : {} };
      case "pase_clave":
        return { equipo: e.equipo, zona: "ataque" };
      case "fuera_de_juego":
        return { equipo: rival(e.equipo), zona: "defensa" };
      case "fin_periodo":
        return { equipo: e.equipo, zona: "medio" };
      default:
        continue;
    }
  }
  return { equipo: "local", zona: "medio" };
}
function segmentoVacio(ancla, prev) {
  if (ancla.tipo === "inicio_periodo") return true;
  if (!prev) return false;
  if (["gol", "atajada", "tarjeta_amarilla", "tarjeta_roja", "lesion", "subida_portero"].includes(ancla.tipo)) return true;
  const directo = ancla.minuto - prev.minuto <= 1;
  if (ancla.tipo === "tiro" && directo && ["pase_clave", "corner", "falta", "tarjeta_amarilla", "tarjeta_roja"].includes(prev.tipo)) return true;
  if (ancla.tipo === "corner" && directo && ["tiro", "atajada"].includes(prev.tipo)) return true;
  if (ancla.tipo === "cambio" && ancla.minuto === prev.minuto) return true;
  return false;
}
function segmento(p, k, semilla) {
  const ancla = p.eventos[k];
  const prev = k > 0 ? p.eventos[k - 1] : void 0;
  if (segmentoVacio(ancla, prev)) return { eventos: [], posesiones: [] };
  const rng = prngDerivado(semilla, `micro:${ancla.id}`);
  const cancha = enCancha(p, k);
  const canales = { local: canalesDe(cancha.local), visita: canalesDe(cancha.visita) };
  const pref = { local: canalPreferido(semilla, "local"), visita: canalPreferido(semilla, "visita") };
  const cfg = p.config;
  const fuerza = (l) => (cfg[l].ataque - cfg[rival(l)].defensa) / 100;
  const conNiveles = cfg.variantes?.niveles === true;
  const deltaDe = (l, nombre) => conNiveles ? deltaNivel(cancha[l].find((j) => j.nombre === nombre), cfg[l]) : 0;
  const periodo = p.eventos.slice(0, k + 1).filter((x) => x.tipo === "inicio_periodo").length >= 2 ? 2 : 1;
  const eventos = [];
  const posesiones = [];
  const ini = inicioTras(p, k);
  const actorInicial = (l, zona) => {
    const js = cancha[l];
    const peso = (j) => zona === "defensa" && j.posicion === "POR" ? 3 : MICRO.actor[j.posicion];
    return elegir(rng, js, peso).nombre;
  };
  const enJuego = (l, nombre) => cancha[l].some((j) => j.nombre === nombre);
  let e = {
    equipo: ini.equipo,
    zona: ini.zona,
    canal: sortearCanal(rng, pref[ini.equipo]),
    actor: ini.actor && enJuego(ini.equipo, ini.actor) ? ini.actor : ""
  };
  if (!e.actor) e.actor = actorInicial(e.equipo, e.zona);
  posesiones.push({ equipo: e.equipo, termina: "perdida" });
  const emitir = (b) => {
    eventos.push({ equipo: e.equipo, canal: e.canal, zona: e.zona, ancla: ancla.id, pos: posesiones.length - 1, ...b });
  };
  const defensor = () => {
    const r = rival(e.equipo);
    const espejo = espejoCanal(e.canal);
    return elegir(rng, cancha[r].filter((j) => j.posicion !== "POR"), (j) => (canales[r].get(j.nombre) === espejo ? 6 : 1) * (j.posicion === "DEF" ? 3 : j.posicion === "MED" ? 2 : 0.5)).nombre;
  };
  const perder = (quien) => {
    emitir({ tipo: "perdida", jugador: e.actor });
    const r = rival(e.equipo);
    posesiones[posesiones.length - 1].termina = "perdida";
    const zonaR = espejoZona(e.zona);
    const canalR = espejoCanal(e.canal);
    const recupera = quien && enJuego(r, quien) ? quien : actorInicial(r, zonaR);
    posesiones.push({ equipo: r, termina: "perdida" });
    e = { equipo: r, actor: recupera, zona: zonaR, canal: canalR };
    emitir({ tipo: "recuperacion", jugador: recupera });
  };
  const pase = (receptor, forzarCompletado = false) => {
    const mezcla = MICRO.paseMezcla[e.zona];
    const r = rng.next();
    const clase = r < mezcla.corto ? "corto" : r < mezcla.corto + mezcla.medio ? "medio" : "largo";
    const banda = PASE_M[clase];
    const distanciaM = clase === "largo" ? rng.int(banda.min, banda.max) : rng.int(banda.min, banda.max - 1);
    const ajuste = clase === "corto" ? 0.06 : clase === "largo" ? -0.2 : -0.03;
    const pc = MICRO.paseBase + MICRO.paseKFuerza * fuerza(e.equipo) + MICRO.paseEstilo[cfg[e.equipo].estilo] + MICRO.paseZona[e.zona] + ajuste - castigoPase(cfg.condiciones, e.equipo, e.zona, clase, ancla.minuto) + NIVELES.kPase * deltaDe(e.equipo, e.actor);
    const completado = forzarCompletado || rng.chance(pc);
    emitir({ tipo: "pase", jugador: e.actor, receptor, completado, distanciaM });
    if (!completado) return perder();
    e.actor = receptor;
    if (clase === "largo" && rng.chance(0.4)) e.canal = rng.pick(CANALES.filter((c) => c !== e.canal));
    if (e.zona !== "ataque" && rng.chance(MICRO.avance[e.zona][clase])) e.zona = subir(e.zona);
  };
  const companero = () => {
    const js = cancha[e.equipo].filter((j) => j.nombre !== e.actor);
    return elegir(rng, js, (j) => MICRO.actor[j.posicion] * (canales[e.equipo].get(j.nombre) === e.canal ? 2 : 1)).nombre;
  };
  const delta = prev ? Math.max(0, ancla.minuto - prev.minuto) : 0;
  const deAtaque = ANCLAS_ATAQUE.has(ancla.tipo) || ancla.tipo === "falta";
  const n = Math.max(0, Math.round((MICRO.accionesPorMinuto * delta + (deAtaque ? MICRO.accionesAncla : 0)) * factorRitmo(cfg.condiciones, periodo) + rng.int(-2, 2)));
  let recienRegateo = false;
  for (let i = 0; i < n; i++) {
    const pos = cancha[e.equipo].find((j) => j.nombre === e.actor)?.posicion ?? "MED";
    const r = rng.next();
    const riesgo = MICRO.riesgoZona[e.zona];
    const pReg = recienRegateo ? 0 : MICRO.pRegate * MICRO.regateador[pos] * riesgo / 2;
    recienRegateo = false;
    if (r < pReg) {
      recienRegateo = true;
      const d = defensor();
      const exito = rng.chance(MICRO.regateBase + MICRO.regateKFuerza * fuerza(e.equipo) + NIVELES.kRegate * deltaDe(e.equipo, e.actor));
      emitir({ tipo: "regate", jugador: e.actor, rival: d, exito });
      if (!exito) perder(d);
      else if (e.zona !== "ataque" && rng.chance(0.4)) e.zona = subir(e.zona);
    } else if (r < pReg + MICRO.pDuelo * riesgo) {
      const d = defensor();
      const exito = rng.chance(MICRO.dueloBase + NIVELES.kRegate * deltaDe(e.equipo, e.actor));
      emitir({ tipo: "duelo", jugador: e.actor, rival: d, exito });
      if (!exito) perder(d);
    } else if (r < pReg + MICRO.pDuelo * riesgo + MICRO.pConduccion) {
      emitir({ tipo: "conduccion", jugador: e.actor, distanciaM: Math.min(CONDUCCION_M.max, CONDUCCION_M.min + Math.floor(rng.next() * rng.next() * (CONDUCCION_M.max - CONDUCCION_M.min + 1))) });
      if (e.zona !== "ataque" && rng.chance(MICRO.avance[e.zona].conduccion)) e.zona = subir(e.zona);
    } else {
      pase(companero());
    }
  }
  const equipoFinal = ANCLAS_ATAQUE.has(ancla.tipo) ? ancla.equipo : ancla.tipo === "falta" ? rival(ancla.equipo) : void 0;
  if (equipoFinal !== void 0 && equipoFinal !== e.equipo) {
    const mezcla = MICRO.paseMezcla[e.zona];
    emitir({ tipo: "pase", jugador: e.actor, receptor: companero(), completado: false, distanciaM: rng.int(PASE_M.corto.min, (e.zona === "ataque" || rng.chance(mezcla.corto + mezcla.medio) ? PASE_M.medio.max : PASE_M.largo.max) - 1) });
    perder();
  }
  const actorFinal = ancla.tipo === "tiro" || ancla.tipo === "pase_clave" ? ancla.jugador : void 0;
  if (actorFinal && actorFinal !== e.actor && enJuego(e.equipo, actorFinal)) {
    e.zona = ancla.tipo === "tiro" ? "ataque" : e.zona;
    pase(actorFinal, true);
  }
  if (equipoFinal !== void 0 && posesiones.length > 0) posesiones[posesiones.length - 1].termina = "ancla";
  return { eventos, posesiones };
}
function micro(p) {
  const semilla = p.config.seed;
  const eventos = [];
  const posesiones = [];
  let nPos = 0;
  p.eventos.forEach((ancla, k) => {
    const prev = k > 0 ? p.eventos[k - 1] : void 0;
    const seg = segmento(p, k, semilla);
    if (seg.eventos.length === 0) return;
    const desde = prev ? prev.minuto : ancla.minuto;
    const delta = Math.max(0, ancla.minuto - desde);
    const base = nPos;
    const usadas = /* @__PURE__ */ new Set();
    seg.eventos.forEach((b, j) => {
      const minuto = Math.min(ancla.minuto, desde + Math.floor(delta * (j + 1) / (seg.eventos.length + 1)));
      const { pos, ...resto } = b;
      usadas.add(pos);
      eventos.push({ id: `m${String(eventos.length + 1).padStart(4, "0")}`, minuto, posesion: base + pos + 1, ...resto });
    });
    seg.posesiones.forEach((ps, i) => {
      if (!usadas.has(i)) return;
      const evs = eventos.filter((m) => m.posesion === base + i + 1);
      const cuenta = /* @__PURE__ */ new Map();
      for (const m of evs) cuenta.set(m.canal, (cuenta.get(m.canal) ?? 0) + 1);
      const canal = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "centro";
      posesiones.push({
        n: base + i + 1,
        equipo: ps.equipo,
        canal,
        ancla: ancla.id,
        desde: evs[0]?.minuto ?? ancla.minuto,
        hasta: evs[evs.length - 1]?.minuto ?? ancla.minuto,
        termina: ps.termina,
        avance: evs.some((m) => m.zona === "ataque" && m.equipo === ps.equipo) || ps.termina === "ancla" && ANCLAS_ATAQUE.has(ancla.tipo),
        eventos: evs.map((m) => m.id)
      });
    });
    nPos = base + seg.posesiones.length;
  });
  const mapa = new Map(posesiones.map((ps, i) => [ps.n, i + 1]));
  for (const ps of posesiones) ps.n = mapa.get(ps.n);
  for (const m of eventos) m.posesion = mapa.get(m.posesion);
  return { eventos, posesiones };
}

// src/analista/textos.ts
var PLANTILLAS = {
  resultado_final: {
    es: "Resultado final: {local} {goles_local}\u2013{goles_visita} {visita}.",
    en: "Full time: {local} {goles_local}\u2013{goles_visita} {visita}."
  },
  marcador_periodo_1: {
    es: "Al descanso: {local} {marcador_local}\u2013{marcador_visita} {visita}.",
    en: "Half time: {local} {marcador_local}\u2013{marcador_visita} {visita}."
  },
  marcador_periodo_2: {
    es: "Segundo tiempo: {local} {goles_local_periodo}\u2013{goles_visita_periodo} {visita} en el periodo; {marcador_local}\u2013{marcador_visita} en el total.",
    en: "Second half: {local} {goles_local_periodo}\u2013{goles_visita_periodo} {visita} in the period; {marcador_local}\u2013{marcador_visita} overall."
  },
  gol: {
    es: "{jugador} ({equipo}) marc\xF3 en el minuto {minuto}, con un tiro de xG {xg}; {local} {marcador_local}\u2013{marcador_visita} {visita}.",
    en: "{jugador} ({equipo}) scored in minute {minuto}, from a shot of {xg} xG; {local} {marcador_local}\u2013{marcador_visita} {visita}."
  },
  gol_penal: {
    es: "{jugador} ({equipo}) marc\xF3 de penal en el minuto {minuto}, con un tiro de xG {xg}; {local} {marcador_local}\u2013{marcador_visita} {visita}.",
    en: "{jugador} ({equipo}) scored a penalty in minute {minuto}, from a shot of {xg} xG; {local} {marcador_local}\u2013{marcador_visita} {visita}."
  },
  doblete: {
    es: "{jugador} ({equipo}) marc\xF3 un doblete (minutos {minutos}).",
    en: "{jugador} ({equipo}) scored a brace (minutes {minutos})."
  },
  triplete: {
    es: "{jugador} ({equipo}) marc\xF3 un triplete (minutos {minutos}).",
    en: "{jugador} ({equipo}) scored a hat-trick (minutes {minutos})."
  },
  varios_goles: {
    es: "{jugador} ({equipo}) marc\xF3 {goles} goles (minutos {minutos}).",
    en: "{jugador} ({equipo}) scored {goles} goals (minutes {minutos})."
  },
  // Marcadores desde la perspectiva del equipo que remonta (propios–rival).
  remontada_victoria: {
    es: "{equipo} perd\xEDa {desventaja_propios}\u2013{desventaja_rival} contra {rival} en el minuto {minuto_desventaja} y gan\xF3 {final_propios}\u2013{final_rival}.",
    en: "{equipo} were {desventaja_propios}\u2013{desventaja_rival} down against {rival} in minute {minuto_desventaja} and won {final_propios}\u2013{final_rival}."
  },
  remontada_empate: {
    es: "{equipo} perd\xEDa {desventaja_propios}\u2013{desventaja_rival} contra {rival} en el minuto {minuto_desventaja} y empat\xF3 {final_propios}\u2013{final_rival}.",
    en: "{equipo} were {desventaja_propios}\u2013{desventaja_rival} down against {rival} in minute {minuto_desventaja} and drew {final_propios}\u2013{final_rival}."
  },
  gol_temprano: {
    es: "{jugador} ({equipo}) marc\xF3 en el minuto {minuto}.",
    en: "{jugador} ({equipo}) scored in minute {minuto}."
  },
  gol_tardio: {
    es: "{jugador} ({equipo}) marc\xF3 en el minuto {minuto}.",
    en: "{jugador} ({equipo}) scored in minute {minuto}."
  },
  dominio_1: {
    es: "En el primer tiempo, {equipo} sum\xF3 {acciones_equipo} de las {acciones_total} acciones ofensivas (tiros, c\xF3rners y pases clave): {porcentaje} %.",
    en: "In the first half, {equipo} had {acciones_equipo} of the {acciones_total} attacking actions (shots, corners and key passes): {porcentaje}%."
  },
  dominio_2: {
    es: "En el segundo tiempo, {equipo} sum\xF3 {acciones_equipo} de las {acciones_total} acciones ofensivas (tiros, c\xF3rners y pases clave): {porcentaje} %.",
    en: "In the second half, {equipo} had {acciones_equipo} of the {acciones_total} attacking actions (shots, corners and key passes): {porcentaje}%."
  },
  presion: {
    es: "{equipo} remat\xF3 {tiros} veces entre el minuto {desde} y el {hasta}, con {xg} de xG en total.",
    en: "{equipo} had {tiros} shots between minute {desde} and minute {hasta}, totalling {xg} xG."
  },
  justicia_contra_corriente: {
    es: "{ganador} gan\xF3 con menos xG que su rival: {xg_ganador} contra {xg_perdedor} ({local} {goles_local}\u2013{goles_visita} {visita}).",
    en: "{ganador} won with less xG than their opponent: {xg_ganador} to {xg_perdedor} ({local} {goles_local}\u2013{goles_visita} {visita})."
  },
  justicia_neutra: {
    es: "Goles y xG: {local} {goles_local} ({xg_local} xG), {visita} {goles_visita} ({xg_visita} xG).",
    en: "Goals and xG: {local} {goles_local} ({xg_local} xG), {visita} {goles_visita} ({xg_visita} xG)."
  },
  portero: {
    es: "{portero} ({equipo}) hizo {atajadas} atajadas a tiros que sumaban {xg_atajado} de xG.",
    en: "{portero} ({equipo}) made {atajadas} saves from shots totalling {xg_atajado} xG."
  },
  portero_sin_nombre: {
    es: "El portero de {equipo} hizo {atajadas} atajadas a tiros que sumaban {xg_atajado} de xG.",
    en: "The {equipo} goalkeeper made {atajadas} saves from shots totalling {xg_atajado} xG."
  },
  expulsion_directa: {
    es: "{jugador} ({equipo}) vio la roja directa en el minuto {minuto}, con {local} {marcador_local}\u2013{marcador_visita} {visita}; despu\xE9s, {local} marc\xF3 {goles_despues_local} y {visita} {goles_despues_visita}.",
    en: "{jugador} ({equipo}) was shown a straight red card in minute {minuto}, with {local} {marcador_local}\u2013{marcador_visita} {visita}; afterwards, {local} scored {goles_despues_local} and {visita} {goles_despues_visita}."
  },
  expulsion_doble_amarilla: {
    es: "{jugador} ({equipo}) fue expulsado por doble amarilla en el minuto {minuto}, con {local} {marcador_local}\u2013{marcador_visita} {visita}; despu\xE9s, {local} marc\xF3 {goles_despues_local} y {visita} {goles_despues_visita}.",
    en: "{jugador} ({equipo}) was sent off for a second yellow card in minute {minuto}, with {local} {marcador_local}\u2013{marcador_visita} {visita}; afterwards, {local} scored {goles_despues_local} and {visita} {goles_despues_visita}."
  },
  disciplina: {
    es: "{equipo} recibi\xF3 {amarillas} tarjetas amarillas (minutos {minutos}).",
    en: "{equipo} received {amarillas} yellow cards (minutes {minutos})."
  },
  // Brief 009.
  figura_del_partido: {
    es: "{jugador} fue la figura del partido (nota {nota}).",
    en: "{jugador} was the player of the match (rating {nota})."
  },
  // Brief 013.
  duelo_ganado: {
    es: "{jugador} ({equipo}) dribl\xF3 {regates} veces a {rival} ({equipo_rival}).",
    en: "{jugador} ({equipo}) dribbled past {rival} ({equipo_rival}) {regates} times."
  },
  perdidas_en_salida: {
    es: "{equipo} perdi\xF3 el bal\xF3n {perdidas} veces saliendo por {canal_es}.",
    en: "{equipo} lost the ball {perdidas} times playing out down {canal_en}."
  },
  dominio_global: {
    es: "{equipo} domin\xF3 el partido ({porcentaje} % de la posesi\xF3n).",
    en: "{equipo} dominated the match ({porcentaje}% possession)."
  },
  dominio_por_canal: {
    es: "{equipo} atac\xF3 sobre todo por {canal_es} ({porcentaje} % de sus avances).",
    en: "{equipo} attacked mostly down {canal_en} ({porcentaje}% of their attacks)."
  },
  // Brief 018: las condiciones (dato puro: cita la config registrada) y los tres efectos medidos.
  condiciones_del_partido: {
    es: "Con {clima_es} y {cancha_es} en la cancha de {local}; presi\xF3n {presion_local_es} para el local y {presion_visita_es} para {visita}.",
    en: "With {clima_en} and {cancha_en} at {local}'s ground; {presion_local_en} pressure on the hosts and {presion_visita_en} on {visita}."
  },
  efecto_calor: {
    es: "Con {temperatura_c} \xB0C, el ritmo baj\xF3 en el segundo tiempo: {pases_segundo_tiempo} pases, frente a {pases_primer_tiempo} antes del descanso ({porcentaje} %).",
    en: "With {temperatura_c} \xB0C, the tempo dropped in the second half: {pases_segundo_tiempo} passes, against {pases_primer_tiempo} before the break ({porcentaje}%)."
  },
  cancha_incomoda: {
    es: "En el c\xE9sped alto de la cancha de {local}, {equipo} complet\xF3 el {porcentaje} % de sus pases cortos ({completados} de {intentados}).",
    en: "On the long grass at {local}'s ground, {equipo} completed {porcentaje}% of their short passes ({completados} of {intentados})."
  },
  // Brief 025: los insólitos.
  gol_olimpico: {
    es: "{jugador} ({equipo}) marc\xF3 un gol ol\xEDmpico en el minuto {minuto}, directo del c\xF3rner; {local} {marcador_local}\u2013{marcador_visita} {visita}.",
    en: "{jugador} ({equipo}) scored straight from a corner in minute {minuto}; {local} {marcador_local}\u2013{marcador_visita} {visita}."
  },
  subida_portero: {
    es: "En el minuto {minuto}, con su equipo perdiendo por uno, el portero {jugador} ({equipo}) subi\xF3 al \xE1rea para un c\xF3rner.",
    en: "In minute {minuto}, with his side one goal down, goalkeeper {jugador} ({equipo}) went up for a corner."
  },
  subida_portero_remate: {
    es: "En el minuto {minuto}, con su equipo perdiendo por uno, el portero {jugador} ({equipo}) subi\xF3 al \xE1rea para un c\xF3rner y lleg\xF3 a rematar.",
    en: "In minute {minuto}, with his side one goal down, goalkeeper {jugador} ({equipo}) went up for a corner and got a shot away."
  },
  subida_portero_gol: {
    es: "En el minuto {minuto}, con su equipo perdiendo por uno, el portero {jugador} ({equipo}) subi\xF3 al \xE1rea para un c\xF3rner y marc\xF3.",
    en: "In minute {minuto}, with his side one goal down, goalkeeper {jugador} ({equipo}) went up for a corner and scored."
  },
  al_palo: {
    es: "{jugador} ({equipo}) estrell\xF3 un remate en el palo en el minuto {minuto}.",
    en: "{jugador} ({equipo}) hit the post in minute {minuto}."
  },
  doble_palo: {
    es: "{jugador} ({equipo}) estrell\xF3 un remate en los dos palos en el minuto {minuto}.",
    en: "{jugador} ({equipo}) hit both posts in minute {minuto}."
  },
  interrupcion: {
    es: "El partido se interrumpi\xF3 {duracion} min en el minuto {minuto} por {causa_es}; se sumaron al descuento.",
    en: "Play was stopped for {duracion} min in minute {minuto} ({causa_en}); the time was added on."
  },
  // Brief 027: la sanción de club, la previa del partido afectado (cita el registro).
  sancion_deduccion: {
    es: "{equipo} arrastra una deducci\xF3n de {puntos} puntos por {causa_es}.",
    en: "{equipo} were docked {puntos} points for {causa_en}."
  },
  sancion_puerta_cerrada: {
    es: "{equipo} juega a puerta cerrada (partido {partido} de {de}) por {causa_es}.",
    en: "{equipo} play behind closed doors (match {partido} of {de}) for {causa_en}."
  },
  sancion_limite_banco: {
    es: "{equipo} tiene el banco limitado a {suplentes} suplentes (partido {partido} de {de}) por {causa_es}.",
    en: "{equipo} have a limited bench of {suplentes} substitutes (match {partido} of {de}) for {causa_en}."
  },
  ole_de_la_grada: {
    es: "La grada core\xF3 el ol\xE9 en el minuto {minuto}: {equipo} encaden\xF3 {pases} pases seguidos.",
    en: "The crowd roared ol\xE9 in minute {minuto}: {equipo} strung together {pases} passes in a row."
  },
  efecto_niebla: {
    es: "La niebla pes\xF3 en los pases largos: {completados} de {intentados} completados ({porcentaje} %).",
    en: "In the fog, long passes suffered: {completados} of {intentados} completed ({porcentaje}%)."
  },
  // Brief 020: sin verbos de mérito («marcó»): el autor no anotó para su equipo.
  autogol: {
    es: "En el minuto {minuto}, un gol en propia puerta de {jugador} ({equipo}) sum\xF3 para {beneficiado}: {local} {marcador_local}\u2013{marcador_visita} {visita}.",
    en: "In minute {minuto}, an own goal by {jugador} ({equipo}) counted for {beneficiado}: {local} {marcador_local}\u2013{marcador_visita} {visita}."
  },
  // Brief 019.
  lesion: {
    es: "{jugador} ({equipo}) se retir\xF3 lesionado en el minuto {minuto} (baja de {baja_es}).",
    en: "{jugador} ({equipo}) went off injured in minute {minuto} (out for {baja_en})."
  },
  lesion_falta: {
    es: "{jugador} ({equipo}) se retir\xF3 lesionado en el minuto {minuto}, tras una falta de {infractor} (baja de {baja_es}).",
    en: "{jugador} ({equipo}) went off injured in minute {minuto} after a foul by {infractor} (out for {baja_en})."
  },
  bajas_del_partido: {
    es: "{equipo} lleg\xF3 sin {lista_es}.",
    en: "{equipo} were without {lista_en}."
  },
  presion_que_ahoga: {
    es: "Con presi\xF3n alta, {equipo} perdi\xF3 el bal\xF3n {perdidas} veces en su salida antes del minuto {limite}.",
    en: "Under high pressure, {equipo} lost the ball {perdidas} times playing out before minute {limite}."
  }
};
function rellenar(plantilla, datos) {
  return plantilla.replace(/\{([a-z_]+)\}/g, (_, clave) => {
    const v = datos[clave];
    if (v === void 0) throw new Error(`plantilla: falta el dato "${clave}"`);
    return String(v);
  });
}
function textos(clave, datos) {
  const p = PLANTILLAS[clave];
  return { texto_es: rellenar(p.es, datos), texto_en: rellenar(p.en, datos) };
}
function minutoTxt(m) {
  return m > 90 ? `90+${m - 90}` : String(m);
}
function xgTxt(centesimas2) {
  return (centesimas2 / 100).toFixed(2);
}
var temperaturaTxt = (c) => c < 0 ? `\u2212${-c}` : String(c);
var CLIMA_TEXTO = {
  despejado: { es: "cielo despejado", en: "clear skies" },
  lluvia: { es: "lluvia", en: "rain" },
  // Brief 025 (sin «la niebla / the fog»: esas frases las paga solo el efecto medido).
  niebla: { es: "niebla", en: "fog" }
};
var CAUSA_SANCION_TEXTO = {
  irregularidad_financiera: { es: "irregularidades financieras", en: "financial irregularities" },
  alineacion_indebida: { es: "alineaci\xF3n indebida", en: "fielding an ineligible player" },
  incidentes_de_publico: { es: "incidentes de p\xFAblico", en: "crowd trouble" }
};
var CAUSA_TEXTO = {
  perro: { es: "un perro en la cancha", en: "a dog on the pitch" },
  objeto: { es: "un objeto lanzado al campo", en: "an object thrown onto the pitch" },
  globos: { es: "globos en el \xE1rea", en: "balloons in the box" }
};
var CANCHA_TEXTO = {
  natural_corto: { es: "c\xE9sped natural corto", en: "short natural grass" },
  natural_alto: { es: "c\xE9sped natural alto", en: "long natural grass" },
  sintetica: { es: "c\xE9sped sint\xE9tico", en: "an artificial pitch" }
};
var PRESION_TEXTO = {
  baja: { es: "baja", en: "low" },
  media: { es: "media", en: "medium" },
  alta: { es: "alta", en: "high" }
};
var jornadasTxt = (n) => ({ es: `${n} ${n === 1 ? "jornada" : "jornadas"}`, en: `${n} ${n === 1 ? "matchday" : "matchdays"}` });
function listaBajas(bajas) {
  const unir = (xs, y) => xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${y} ${xs[xs.length - 1]}`;
  return {
    es: unir(bajas.map((b) => `${b.jugador} (${b.motivo === "suspension" ? "suspendido" : "lesionado"})`), "y"),
    en: unir(bajas.map((b) => `${b.jugador} (${b.motivo === "suspension" ? "suspended" : "injured"})`), "and")
  };
}
var CANAL_TEXTO = {
  banda_izquierda: { es: "la banda izquierda", en: "the left flank" },
  centro: { es: "el centro", en: "the middle" },
  banda_derecha: { es: "la banda derecha", en: "the right flank" }
};

// src/analista/umbrales.ts
var GOL_TEMPRANO_ANTES_DE = 10;
var GOL_TARDIO_DESPUES_DE = 85;
var DOBLETE_MIN_GOLES = 2;
var DOMINIO_PORCENTAJE_MIN = 65;
var PRESION_TIROS_MIN = 4;
var PRESION_XG_MIN_CENTESIMAS = 75;
var PRESION_VENTANA_MINUTOS = 10;
var PORTERO_ATAJADAS_MIN = 7;
var PORTERO_XG_ATAJADO_MIN_CENTESIMAS = 100;
var DISCIPLINA_AMARILLAS_MIN = 4;
var RELEVANCIA = {
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
  sancion_de_club: 48
};
var DESEMPATE_EVENTO = {
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
  sancion_de_club: "inicio_periodo"
};
var VALORACION = {
  /** Nota de partida de todo jugador con participación. */
  base: 6,
  /** Escala final acotada [min, max]; redondeo a un decimal. */
  min: 3,
  max: 10,
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
  xg_atajado_factor: 1,
  gol_recibido: -0.3,
  /** Brief 020: definiciones legendarias (chilena, tijera, media cancha), vaselina, y el autor de un autogol. */
  definicion_legendaria: 0.5,
  definicion_vaselina: 0.2,
  autogol: -1
};
var DUELO_MIN = 4;
var PERDIDAS_MIN = 8;
var DOMINIO_MIN = 58;
var CANAL_MIN = 47;
var DOMINIO_PASES_MIN = 100;
var CANAL_AVANCES_MIN = 10;
var CALOR_PASES_2T_MAX = 90;
var CANCHA_CORTOS_MAX = 73;
var CANCHA_CORTOS_MUESTRA_MIN = 60;
var PRESION_PERDIDAS_MIN = 8;
var NIEBLA_LARGOS_MAX = 54;
var NIEBLA_LARGOS_MUESTRA_MIN = 30;
var OLE_RACHA_MIN = 15;
var OLE_MINUTO_MIN = 60;

// src/analista/condiciones.ts
var pct = (a, b) => b === 0 ? 0 : Math.round(a * 100 / b);
function inicioSegundo(p) {
  return p.eventos.findIndex((e, i) => i > 0 && e.tipo === "inicio_periodo");
}
function medirCalor(p, m) {
  const c = p.config.condiciones;
  if (!c || c.clima !== "calor" || c.temperaturaC === void 0) return void 0;
  const i2 = inicioSegundo(p);
  const idx = new Map(p.eventos.map((e, i) => [e.id, i]));
  let pases1 = 0;
  let pases2 = 0;
  for (const x of m.eventos) {
    if (x.tipo !== "pase") continue;
    if (i2 >= 0 && (idx.get(x.ancla) ?? 0) >= i2) pases2++;
    else pases1++;
  }
  const completo = p.eventos.filter((e) => e.tipo === "fin_periodo").length >= 2;
  const efecto = completo && pases1 > 0 && pases2 * 100 <= CALOR_PASES_2T_MAX * pases1;
  return { temperaturaC: c.temperaturaC, pases1, pases2, porcentaje: pct(pases2, pases1), completo, efecto };
}
var esCorto = (d) => d !== void 0 && d < PASE_M.corto.max;
function medirCancha(p, m) {
  const c = p.config.condiciones;
  if (!c || c.superficie !== "natural" || c.cesped !== "alto") return void 0;
  const de = (l2) => m.eventos.filter((x) => x.tipo === "pase" && x.equipo === l2 && esCorto(x.distanciaM));
  const v = de("visita");
  const l = de("local");
  const completados = v.filter((x) => x.completado).length;
  const completadosLocal = l.filter((x) => x.completado).length;
  const porcentaje = pct(completados, v.length);
  const lluvia = c.clima === "lluvia";
  const efecto = !lluvia && v.length >= CANCHA_CORTOS_MUESTRA_MIN && completados * 100 <= CANCHA_CORTOS_MAX * v.length;
  return { completados, intentados: v.length, porcentaje, completadosLocal, intentadosLocal: l.length, porcentajeLocal: pct(completadosLocal, l.length), lluvia, efecto };
}
function medirPresion(p, m) {
  const c = p.config.condiciones;
  if (!c) return void 0;
  const lado = ["local", "visita"].find((l) => c.presion[l] === "alta");
  if (!lado) return void 0;
  const ids = m.eventos.filter((x) => x.tipo === "perdida" && x.equipo === lado && x.zona === "defensa" && x.minuto < SALIDA_TEMPRANA_MIN).map((x) => x.id);
  return { lado, ids, limite: SALIDA_TEMPRANA_MIN, efecto: ids.length >= PRESION_PERDIDAS_MIN };
}
function medirNiebla(p, m) {
  if (p.config.condiciones?.clima !== "niebla") return void 0;
  const largos = m.eventos.filter((x) => x.tipo === "pase" && x.distanciaM !== void 0 && x.distanciaM >= PASE_M.largo.min);
  const completados = largos.filter((x) => x.completado).length;
  const efecto = largos.length >= NIEBLA_LARGOS_MUESTRA_MIN && completados * 100 <= NIEBLA_LARGOS_MAX * largos.length;
  return { completados, intentados: largos.length, porcentaje: pct(completados, largos.length), efecto };
}

// src/analista/grada.ts
function marcadorAntes(p) {
  const out = /* @__PURE__ */ new Map();
  const m = { local: 0, visita: 0 };
  for (const e of p.eventos) {
    out.set(e.id, { ...m });
    if (e.tipo === "gol") m[e.equipo] += 1;
  }
  return out;
}
function rachasOle(p, m) {
  const antes = marcadorAntes(p);
  const out = [];
  let racha = [];
  const cerrar = () => {
    const ultimo = racha[racha.length - 1];
    if (ultimo && racha.length >= OLE_RACHA_MIN) out.push({ equipo: ultimo.equipo, pases: racha, ancla: ultimo.ancla });
    racha = [];
  };
  for (const x of m.eventos) {
    if (x.tipo !== "pase") continue;
    const g = antes.get(x.ancla);
    const rival4 = x.equipo === "local" ? "visita" : "local";
    const vale = x.completado === true && x.minuto >= OLE_MINUTO_MIN && g !== void 0 && g[x.equipo] > g[rival4];
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

// src/analista/tipos.ts
var TIPOS_HECHO = [
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
  "autogol",
  "gol_olimpico",
  "subida_portero",
  "tiro_al_palo",
  "interrupcion",
  "efecto_niebla",
  "ole_de_la_grada",
  "sancion_de_club"
];

// src/analista/valoracion.ts
var LADOS = ["local", "visita"];
var rival2 = (l) => l === "local" ? "visita" : "local";
var cent = (x) => Math.round(x * 100);
var C = {
  gol: cent(VALORACION.gol),
  gol_dificil: cent(VALORACION.gol_dificil),
  gol_dificil_xg_max: cent(VALORACION.gol_dificil_xg_max),
  tiro_atajado: cent(VALORACION.tiro_atajado),
  pase_clave: cent(VALORACION.pase_clave),
  corner: cent(VALORACION.corner),
  amarilla: cent(VALORACION.amarilla),
  roja: cent(VALORACION.roja),
  falta: cent(VALORACION.falta),
  fuera_de_juego: cent(VALORACION.fuera_de_juego),
  atajada: cent(VALORACION.atajada),
  gol_recibido: cent(VALORACION.gol_recibido),
  definicion_legendaria: cent(VALORACION.definicion_legendaria),
  definicion_vaselina: cent(VALORACION.definicion_vaselina),
  autogol: cent(VALORACION.autogol)
};
function porteros(p) {
  const posicion = /* @__PURE__ */ new Map();
  for (const lado of LADOS) for (const j of p.config[lado].jugadores) posicion.set(`${lado}|${j.nombre}`, j.posicion);
  const actual = {
    local: p.config.local.jugadores.slice(0, 11).find((j) => j.posicion === "POR")?.nombre,
    visita: p.config.visita.jugadores.slice(0, 11).find((j) => j.posicion === "POR")?.nombre
  };
  const out = { local: [], visita: [] };
  for (const e of p.eventos) {
    for (const lado of LADOS) out[lado].push(actual[lado]);
    if (e.tipo === "cambio" && e.jugador !== void 0) {
      const entraPortero = posicion.get(`${e.equipo}|${e.jugador}`) === "POR";
      if (e.sale !== void 0 && e.sale === actual[e.equipo]) actual[e.equipo] = e.jugador;
      else if (actual[e.equipo] === void 0 && entraPortero) actual[e.equipo] = e.jugador;
    }
    if (e.tipo === "tarjeta_roja" && e.jugador !== void 0 && e.jugador === actual[e.equipo]) actual[e.equipo] = void 0;
  }
  return out;
}
function notaDe(desglose) {
  const total = cent(VALORACION.base) + desglose.reduce((s, d) => s + cent(d.delta), 0);
  const decimas = Math.round(total / 10);
  return Math.min(cent(VALORACION.max) / 10, Math.max(cent(VALORACION.min) / 10, decimas)) / 10;
}
var notaTxt = (n) => n.toFixed(1);
function valorar(p) {
  const gk = porteros(p);
  const ev = p.eventos;
  const porId = new Map(ev.map((e) => [e.id, e]));
  const atajados = new Set(ev.filter((e) => e.tipo === "atajada" && e.relacionadoCon).map((e) => e.relacionadoCon));
  const desglose = /* @__PURE__ */ new Map();
  const participa = /* @__PURE__ */ new Set();
  const poner = (lado, jugador, e, centesimas2, motivo) => {
    if (!jugador) return;
    const k = `${lado}|${jugador}`;
    participa.add(k);
    desglose.set(k, [...desglose.get(k) ?? [], { evento: e.id, delta: centesimas2 / 100, motivo }]);
  };
  for (const lado of LADOS) {
    const por = p.config[lado].jugadores.slice(0, 11).find((j) => j.posicion === "POR");
    if (por) participa.add(`${lado}|${por.nombre}`);
  }
  ev.forEach((e, i) => {
    if (e.jugador !== void 0) participa.add(`${ladoDelJugador(e)}|${e.jugador}`);
    switch (e.tipo) {
      case "gol": {
        if (e.autogol === true) {
          poner(ladoDelJugador(e), e.jugador, e, C.autogol, "autogol");
          poner(rival2(e.equipo), gk[rival2(e.equipo)][i], e, C.gol_recibido, "gol_recibido");
          break;
        }
        poner(e.equipo, e.jugador, e, C.gol, "gol");
        if (e.definicion === "chilena" || e.definicion === "tijera" || e.definicion === "media_cancha") poner(e.equipo, e.jugador, e, C.definicion_legendaria, "definicion");
        else if (e.definicion === "vaselina") poner(e.equipo, e.jugador, e, C.definicion_vaselina, "definicion");
        const xg = cent(e.xg ?? porId.get(e.relacionadoCon ?? "")?.xg ?? 0);
        if (xg < C.gol_dificil_xg_max) poner(e.equipo, e.jugador, e, C.gol_dificil, "gol_dificil");
        poner(rival2(e.equipo), gk[rival2(e.equipo)][i], e, C.gol_recibido, "gol_recibido");
        break;
      }
      case "tiro":
        if (atajados.has(e.id)) poner(e.equipo, e.jugador, e, C.tiro_atajado, "tiro_atajado");
        break;
      case "atajada": {
        const portero = gk[rival2(e.equipo)][i];
        poner(rival2(e.equipo), portero, e, C.atajada, "atajada");
        const xg = cent((porId.get(e.relacionadoCon ?? "")?.xg ?? 0) * VALORACION.xg_atajado_factor);
        if (xg !== 0) poner(rival2(e.equipo), portero, e, xg, "xg_atajado");
        break;
      }
      case "pase_clave":
        poner(e.equipo, e.jugador, e, C.pase_clave, "pase_clave");
        break;
      case "corner":
        poner(e.equipo, e.jugador, e, C.corner, "corner");
        break;
      case "tarjeta_amarilla":
        poner(e.equipo, e.jugador, e, C.amarilla, "amarilla");
        break;
      case "tarjeta_roja":
        poner(e.equipo, e.jugador, e, C.roja, "roja");
        break;
      case "falta":
        poner(e.equipo, e.jugador, e, C.falta, "falta");
        break;
      case "fuera_de_juego":
        poner(e.equipo, e.jugador, e, C.fuera_de_juego, "fuera_de_juego");
        break;
      default:
        break;
    }
  });
  const out = [];
  for (const lado of LADOS) {
    for (const j of p.config[lado].jugadores) {
      const k = `${lado}|${j.nombre}`;
      if (!participa.has(k)) continue;
      const d = desglose.get(k) ?? [];
      out.push({ jugador: j.nombre, equipo: p.config[lado].nombre, lado, posicion: j.posicion, nota: notaDe(d), desglose: d });
    }
  }
  return out;
}
var deltaGoles = (v) => v.desglose.filter((d) => d.motivo === "gol" || d.motivo === "gol_dificil").reduce((s, d) => s + cent(d.delta), 0);
function figura(p, valoraciones = valorar(p)) {
  const indice = (v) => p.config[v.lado].jugadores.findIndex((j) => j.nombre === v.jugador);
  const orden = [...valoraciones].sort(
    (a, b) => b.nota - a.nota || deltaGoles(b) - deltaGoles(a) || indice(a) - indice(b) || (a.lado === b.lado ? 0 : a.lado === "local" ? -1 : 1)
  );
  const top = orden[0];
  return top && top.desglose.length > 0 ? top : void 0;
}

// src/analista/analista.ts
var LADOS2 = ["local", "visita"];
var rival3 = (l) => l === "local" ? "visita" : "local";
function centesimas(xg) {
  return Math.round((xg ?? 0) * 100);
}
function contexto(p) {
  const ev = p.eventos;
  const indice = new Map(ev.map((e, i) => [e.id, i]));
  const porId = new Map(ev.map((e) => [e.id, e]));
  const periodo = [];
  let inicios2 = 0;
  const marcador = { local: 0, visita: 0 };
  const goles = [];
  const fines = [];
  ev.forEach((e, i) => {
    if (e.tipo === "inicio_periodo") inicios2++;
    const per = inicios2 >= 2 ? 2 : 1;
    periodo.push(per);
    if (e.tipo === "gol") {
      marcador[e.equipo] += 1;
      goles.push({ ev: e, i, periodo: per, marcador: { ...marcador } });
    }
    if (e.tipo === "fin_periodo") fines.push(e);
  });
  return {
    ev,
    indice,
    porId,
    periodo,
    nombre: { local: p.config.local.nombre, visita: p.config.visita.nombre },
    goles,
    fines,
    final: { ...marcador }
  };
}
function citar(c, ids) {
  const unicos = [...new Set(ids.filter((x) => x !== void 0 && c.indice.has(x)))];
  return unicos.sort((a, b) => c.indice.get(a) - c.indice.get(b));
}
function claveRelevancia(tipo, datos) {
  if (tipo !== "remontada") return tipo;
  if (datos.desenlace === "victoria") return "remontada_victoria";
  if (datos.desenlace === "empate") return "remontada_empate";
  throw new Error(`remontada sin desenlace v\xE1lido: ${String(datos.desenlace)}`);
}
function hecho(c, tipo, clave, ids, datos) {
  return { tipo, ...textos(clave, datos), eventos: citar(c, ids), relevancia: RELEVANCIA[claveRelevancia(tipo, datos)], datos };
}
function equipos(c) {
  return { local: c.nombre.local, visita: c.nombre.visita };
}
function resultadoFinal(c) {
  const fin = c.fines[c.fines.length - 1];
  const ganador = c.final.local > c.final.visita ? "local" : c.final.local < c.final.visita ? "visita" : "empate";
  return [
    hecho(c, "resultado_final", "resultado_final", [...c.goles.map((g) => g.ev.id), fin?.id], {
      ...equipos(c),
      goles_local: c.final.local,
      goles_visita: c.final.visita,
      ganador
    })
  ];
}
function marcadorPorPeriodo(c) {
  return c.fines.slice(0, 2).map((fin, k) => {
    const periodo = k + 1;
    const delPeriodo = c.goles.filter((g) => g.periodo === periodo);
    const hasta = c.goles.filter((g) => g.periodo <= periodo);
    const acum = hasta.length > 0 ? hasta[hasta.length - 1].marcador : { local: 0, visita: 0 };
    return hecho(c, "marcador_por_periodo", periodo === 1 ? "marcador_periodo_1" : "marcador_periodo_2", [...delPeriodo.map((g) => g.ev.id), fin.id], {
      ...equipos(c),
      periodo,
      goles_local_periodo: delPeriodo.filter((g) => g.ev.equipo === "local").length,
      goles_visita_periodo: delPeriodo.filter((g) => g.ev.equipo === "visita").length,
      marcador_local: acum.local,
      marcador_visita: acum.visita
    });
  });
}
function golesAnotados(c) {
  return c.goles.filter((g) => g.ev.autogol !== true && g.ev.definicion !== "olimpico").map((g) => {
    const tiro = g.ev.relacionadoCon ? c.porId.get(g.ev.relacionadoCon) : void 0;
    const penal = tiro?.penal === true;
    return hecho(c, "gol_anotado", penal ? "gol_penal" : "gol", [g.ev.id, tiro?.id], {
      ...equipos(c),
      jugador: g.ev.jugador ?? "",
      equipo: c.nombre[g.ev.equipo],
      minuto: minutoTxt(g.ev.minuto),
      xg: xgTxt(centesimas(g.ev.xg)),
      penal: penal ? "si" : "no",
      marcador_local: g.marcador.local,
      marcador_visita: g.marcador.visita,
      // Brief 015: las magnitudes del tiro (si el partido las trae) para que V3/V6 las verifiquen.
      ...tiro?.distanciaM !== void 0 ? { distancia_m: tiro.distanciaM } : {},
      ...tiro?.velocidadKmh !== void 0 ? { velocidad_kmh: tiro.velocidadKmh } : {},
      // Brief 020: la definición registrada (V8 la exige para «de chilena», «mano a mano»…).
      ...tiro?.definicion !== void 0 ? { definicion: tiro.definicion } : {}
    });
  });
}
function autogoles(c) {
  return c.goles.filter((g) => g.ev.autogol === true).map(
    (g) => hecho(c, "autogol", "autogol", [g.ev.id, g.ev.relacionadoCon], {
      ...equipos(c),
      jugador: g.ev.jugador ?? "",
      equipo: c.nombre[ladoDelJugador(g.ev)],
      beneficiado: c.nombre[g.ev.equipo],
      minuto: minutoTxt(g.ev.minuto),
      marcador_local: g.marcador.local,
      marcador_visita: g.marcador.visita
    })
  );
}
function dobletes(c) {
  const porJugador = /* @__PURE__ */ new Map();
  for (const g of c.goles) {
    if (!g.ev.jugador || g.ev.autogol === true) continue;
    const clave = `${g.ev.equipo}|${g.ev.jugador}`;
    porJugador.set(clave, [...porJugador.get(clave) ?? [], g]);
  }
  const out = [];
  for (const gs of porJugador.values()) {
    if (gs.length < DOBLETE_MIN_GOLES) continue;
    const primero = gs[0];
    const clave = gs.length === 2 ? "doblete" : gs.length === 3 ? "triplete" : "varios_goles";
    out.push(
      hecho(c, "doblete_o_mas", clave, gs.map((g) => g.ev.id), {
        jugador: primero.ev.jugador,
        equipo: c.nombre[primero.ev.equipo],
        goles: gs.length,
        minutos: gs.map((g) => minutoTxt(g.ev.minuto)).join(", ")
      })
    );
  }
  return out;
}
function remontadas(c) {
  const out = [];
  for (const lado of LADOS2) {
    let peor = 0;
    let k = -1;
    c.goles.forEach((g, j) => {
      const d = g.marcador[lado] - g.marcador[rival3(lado)];
      if (d < peor) {
        peor = d;
        k = j;
      }
    });
    const dFinal = c.final[lado] - c.final[rival3(lado)];
    if (k < 0 || dFinal < 0) continue;
    const enDesventaja = c.goles[k];
    const ids = [
      ...c.goles.slice(0, k + 1).filter((g) => g.ev.equipo === rival3(lado)).map((g) => g.ev.id),
      ...c.goles.slice(k + 1).map((g) => g.ev.id)
    ];
    out.push(
      hecho(c, "remontada", dFinal > 0 ? "remontada_victoria" : "remontada_empate", ids, {
        equipo: c.nombre[lado],
        rival: c.nombre[rival3(lado)],
        desventaja_max: -peor,
        minuto_desventaja: minutoTxt(enDesventaja.ev.minuto),
        desventaja_propios: enDesventaja.marcador[lado],
        desventaja_rival: enDesventaja.marcador[rival3(lado)],
        final_propios: c.final[lado],
        final_rival: c.final[rival3(lado)],
        desenlace: dFinal > 0 ? "victoria" : "empate"
      })
    );
  }
  return out;
}
function golesTempranosYTardios(c) {
  const out = [];
  for (const g of c.goles) {
    if (g.ev.autogol === true) continue;
    const tipo = g.ev.minuto < GOL_TEMPRANO_ANTES_DE ? "gol_temprano" : g.ev.minuto > GOL_TARDIO_DESPUES_DE ? "gol_tardio" : void 0;
    if (!tipo) continue;
    out.push(
      hecho(c, tipo, tipo, [g.ev.id], {
        jugador: g.ev.jugador ?? "",
        equipo: c.nombre[g.ev.equipo],
        minuto: minutoTxt(g.ev.minuto)
      })
    );
  }
  return out;
}
var OFENSIVOS = /* @__PURE__ */ new Set(["tiro", "corner", "pase_clave"]);
function dominio(c) {
  const out = [];
  for (const periodo of [1, 2]) {
    const of = c.ev.filter((e, i) => c.periodo[i] === periodo && OFENSIVOS.has(e.tipo));
    const total = of.length;
    if (total === 0) continue;
    for (const lado of LADOS2) {
      const propios = of.filter((e) => e.equipo === lado);
      if (propios.length * 100 < DOMINIO_PORCENTAJE_MIN * total) continue;
      out.push(
        hecho(c, "dominio_periodo", periodo === 1 ? "dominio_1" : "dominio_2", propios.map((e) => e.id), {
          equipo: c.nombre[lado],
          periodo,
          acciones_equipo: propios.length,
          acciones_total: total,
          porcentaje: Math.round(propios.length * 1e3 / total) / 10
        })
      );
    }
  }
  return out;
}
function presion(c) {
  const out = [];
  for (const lado of LADOS2) {
    for (const periodo of [1, 2]) {
      const tiros = c.ev.filter((e, i) => e.tipo === "tiro" && e.equipo === lado && c.periodo[i] === periodo);
      let a = 0;
      while (a < tiros.length) {
        const inicio = tiros[a];
        let b = a;
        while (b + 1 < tiros.length && tiros[b + 1].minuto - inicio.minuto <= PRESION_VENTANA_MINUTOS) b++;
        const grupo = tiros.slice(a, b + 1);
        const xgGrupo = grupo.reduce((s, e) => s + centesimas(e.xg), 0);
        if (grupo.length >= PRESION_TIROS_MIN && xgGrupo >= PRESION_XG_MIN_CENTESIMAS) {
          out.push(
            hecho(c, "presion_sostenida", "presion", grupo.map((e) => e.id), {
              equipo: c.nombre[lado],
              tiros: grupo.length,
              desde: minutoTxt(inicio.minuto),
              hasta: minutoTxt(grupo[grupo.length - 1].minuto),
              xg: xgTxt(xgGrupo)
            })
          );
          a = b + 1;
        } else {
          a++;
        }
      }
    }
  }
  return out;
}
function justiciaXg(c) {
  const tiros = c.ev.filter((e) => e.tipo === "tiro" && e.xg !== void 0);
  const xg = { local: 0, visita: 0 };
  for (const t of tiros) xg[t.equipo] += centesimas(t.xg);
  const gl = c.final.local;
  const gv = c.final.visita;
  const ganador = gl > gv ? "local" : gl < gv ? "visita" : void 0;
  const contra = ganador !== void 0 && xg[ganador] < xg[rival3(ganador)];
  const base = {
    ...equipos(c),
    goles_local: gl,
    goles_visita: gv,
    xg_local: xgTxt(xg.local),
    xg_visita: xgTxt(xg.visita),
    contra_la_corriente: contra ? "si" : "no"
  };
  const ids = tiros.length > 0 ? tiros.map((t) => t.id) : [c.fines[c.fines.length - 1]?.id];
  if (contra && ganador) {
    return [
      hecho(c, "justicia_xg", "justicia_contra_corriente", ids, {
        ...base,
        ganador: c.nombre[ganador],
        xg_ganador: xgTxt(xg[ganador]),
        xg_perdedor: xgTxt(xg[rival3(ganador)])
      })
    ];
  }
  return [hecho(c, "justicia_xg", "justicia_neutra", ids, base)];
}
function porteroDestacado(p, c) {
  const gk = porteros(p);
  const out = [];
  for (const tirador of LADOS2) {
    const defensor = rival3(tirador);
    const atajadas = c.ev.map((e, i) => ({ e, i })).filter(({ e }) => e.tipo === "atajada" && e.equipo === tirador);
    const xgAtajado = atajadas.reduce((s, { e }) => s + centesimas(c.porId.get(e.relacionadoCon ?? "")?.xg), 0);
    if (atajadas.length < PORTERO_ATAJADAS_MIN && xgAtajado < PORTERO_XG_ATAJADO_MIN_CENTESIMAS) continue;
    const quienes = atajadas.map(({ i }) => gk[defensor][i]);
    const todosConocidos = quienes.every((n) => n !== void 0);
    const nombres = [...new Set(quienes.filter((n) => n !== void 0))];
    const datos = {
      equipo: c.nombre[defensor],
      atajadas: atajadas.length,
      xg_atajado: xgTxt(xgAtajado)
    };
    if (todosConocidos) datos.portero = nombres.join(" / ");
    out.push(
      hecho(c, "portero_destacado", todosConocidos ? "portero" : "portero_sin_nombre", atajadas.flatMap(({ e }) => [e.id, e.relacionadoCon]), datos)
    );
  }
  return out;
}
function expulsiones(c) {
  const out = [];
  c.ev.forEach((r, i) => {
    if (r.tipo !== "tarjeta_roja") return;
    const amarillaPrevia = c.ev.slice(0, i).find((a) => a.tipo === "tarjeta_amarilla" && a.equipo === r.equipo && a.jugador === r.jugador);
    const antes = c.goles.filter((g) => g.i < i);
    const despues = c.goles.filter((g) => g.i > i);
    const enEseMomento = antes.length > 0 ? antes[antes.length - 1].marcador : { local: 0, visita: 0 };
    out.push(
      hecho(
        c,
        "expulsion_y_efecto",
        amarillaPrevia ? "expulsion_doble_amarilla" : "expulsion_directa",
        [r.id, r.relacionadoCon, amarillaPrevia?.id, ...despues.map((g) => g.ev.id)],
        {
          ...equipos(c),
          jugador: r.jugador ?? "",
          equipo: c.nombre[r.equipo],
          minuto: minutoTxt(r.minuto),
          motivo: amarillaPrevia ? "doble_amarilla" : "roja_directa",
          marcador_local: enEseMomento.local,
          marcador_visita: enEseMomento.visita,
          goles_despues_local: despues.filter((g) => g.ev.equipo === "local").length,
          goles_despues_visita: despues.filter((g) => g.ev.equipo === "visita").length,
          goles_local: c.final.local,
          goles_visita: c.final.visita
        }
      )
    );
  });
  return out;
}
function figuraDelPartido(p, c) {
  const f = figura(p);
  if (!f) return [];
  return [
    hecho(c, "figura_del_partido", "figura_del_partido", f.desglose.map((d) => d.evento), {
      jugador: f.jugador,
      equipo: f.equipo,
      nota: notaTxt(f.nota)
    })
  ];
}
function disciplina(c) {
  const out = [];
  for (const lado of LADOS2) {
    const amarillas = c.ev.filter((e) => e.tipo === "tarjeta_amarilla" && e.equipo === lado);
    if (amarillas.length < DISCIPLINA_AMARILLAS_MIN) continue;
    out.push(
      hecho(c, "disciplina", "disciplina", amarillas.map((e) => e.id), {
        equipo: c.nombre[lado],
        amarillas: amarillas.length,
        minutos: amarillas.map((e) => minutoTxt(e.minuto)).join(", ")
      })
    );
  }
  return out;
}
function hechoMicro(tipo, clave, ids, datos) {
  return { tipo, ...textos(clave, datos), eventos: [...new Set(ids)], relevancia: RELEVANCIA[claveRelevancia(tipo, datos)], datos };
}
var canalDatos = (canal) => ({ canal, canal_es: CANAL_TEXTO[canal].es, canal_en: CANAL_TEXTO[canal].en });
var pct2 = (a, b) => Math.round(a * 100 / b);
function duelos(c, m) {
  const pares = /* @__PURE__ */ new Map();
  for (const x of m.eventos) {
    if (x.tipo !== "regate" || x.exito !== true || !x.rival) continue;
    const k = `${x.equipo}|${x.jugador}|${x.rival}`;
    pares.set(k, [...pares.get(k) ?? [], x]);
  }
  const out = [];
  for (const xs of pares.values()) {
    if (xs.length < DUELO_MIN) continue;
    const x = xs[0];
    out.push(
      hechoMicro("duelo_ganado", "duelo_ganado", xs.map((y) => y.id), {
        jugador: x.jugador,
        equipo: c.nombre[x.equipo],
        rival: x.rival,
        equipo_rival: c.nombre[rival3(x.equipo)],
        regates: xs.length
      })
    );
  }
  return out;
}
function perdidasEnSalida(c, m, subsumidos = /* @__PURE__ */ new Set()) {
  const out = [];
  for (const lado of LADOS2) {
    if (subsumidos.has(lado)) continue;
    const por = /* @__PURE__ */ new Map();
    for (const x of m.eventos) if (x.tipo === "perdida" && x.equipo === lado && x.zona === "defensa") por.set(x.canal, [...por.get(x.canal) ?? [], x.id]);
    const mejor = [...por.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    if (!mejor || mejor[1].length < PERDIDAS_MIN) continue;
    out.push(hechoMicro("perdidas_en_salida", "perdidas_en_salida", mejor[1], { equipo: c.nombre[lado], ...canalDatos(mejor[0]), perdidas: mejor[1].length }));
  }
  return out;
}
function periodoMicro(c, x) {
  return c.periodo[c.indice.get(x.ancla) ?? 0] ?? 1;
}
var inicios = (c) => c.ev.filter((e) => e.tipo === "inicio_periodo").map((e) => e.id);
function dominioGlobal(c, m) {
  const pases = m.eventos.filter((x) => x.tipo === "pase");
  if (pases.length < DOMINIO_PASES_MIN) return [];
  for (const lado of LADOS2) {
    const propios = pases.filter((x) => x.equipo === lado).length;
    const porcentaje = pct2(propios, pases.length);
    if (porcentaje < DOMINIO_MIN) continue;
    const datos = { equipo: c.nombre[lado], porcentaje, pases_equipo: propios, pases_total: pases.length };
    for (const per of [1, 2]) {
      const delPer = pases.filter((x) => periodoMicro(c, x) === per);
      if (delPer.length === 0) continue;
      datos[`pases_equipo_p${per}`] = delPer.filter((x) => x.equipo === lado).length;
      datos[`pases_total_p${per}`] = delPer.length;
    }
    return [hechoMicro("dominio_global", "dominio_global", inicios(c), datos)];
  }
  return [];
}
function dominioPorCanal(c, m) {
  const out = [];
  for (const lado of LADOS2) {
    const av = m.posesiones.filter((x) => x.equipo === lado && x.avance);
    if (av.length < CANAL_AVANCES_MIN) continue;
    const cuenta = { banda_izquierda: 0, centro: 0, banda_derecha: 0 };
    for (const x of av) cuenta[x.canal] = (cuenta[x.canal] ?? 0) + 1;
    const [canal, n] = Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0];
    const porcentaje = pct2(n, av.length);
    if (porcentaje < CANAL_MIN) continue;
    out.push(
      hechoMicro("dominio_por_canal", "dominio_por_canal", inicios(c), {
        equipo: c.nombre[lado],
        ...canalDatos(canal),
        porcentaje,
        avances_canal: n,
        avances_total: av.length,
        avances_izquierda: cuenta.banda_izquierda,
        avances_centro: cuenta.centro,
        avances_derecha: cuenta.banda_derecha
      })
    );
  }
  return out;
}
function condicionesDelPartido(p, c) {
  const k = p.config.condiciones;
  const inicio = c.ev.find((e) => e.tipo === "inicio_periodo");
  if (!k || !inicio) return [];
  const conTemp = k.temperaturaC !== void 0;
  const clima = conTemp ? { es: `${temperaturaTxt(k.temperaturaC)} \xB0C`, en: `${temperaturaTxt(k.temperaturaC)} \xB0C` } : CLIMA_TEXTO[k.clima];
  const cancha = CANCHA_TEXTO[k.superficie === "sintetica" ? "sintetica" : `natural_${k.cesped}`];
  const pl = PRESION_TEXTO[k.presion.local];
  const pv = PRESION_TEXTO[k.presion.visita];
  return [
    hecho(c, "condiciones_del_partido", "condiciones_del_partido", [inicio.id], {
      ...equipos(c),
      clima: k.clima,
      ...conTemp ? { temperatura_c: k.temperaturaC } : {},
      superficie: k.superficie,
      ...k.cesped ? { cesped: k.cesped } : {},
      presion_local: k.presion.local,
      presion_visita: k.presion.visita,
      clima_es: clima.es,
      clima_en: clima.en,
      cancha_es: cancha.es,
      cancha_en: cancha.en,
      presion_local_es: pl.es,
      presion_local_en: pl.en,
      presion_visita_es: pv.es,
      presion_visita_en: pv.en
    })
  ];
}
function efectoCalor(p, c, m) {
  const x = medirCalor(p, m);
  if (!x || !x.efecto) return [];
  return [
    hechoMicro("efecto_calor", "efecto_calor", inicios(c), {
      ...equipos(c),
      temperatura_c: x.temperaturaC,
      periodo: 2,
      pases_primer_tiempo: x.pases1,
      pases_segundo_tiempo: x.pases2,
      porcentaje: x.porcentaje
    })
  ];
}
function canchaIncomoda(p, c, m) {
  const x = medirCancha(p, m);
  if (!x || !x.efecto) return [];
  return [
    hechoMicro("cancha_incomoda", "cancha_incomoda", inicios(c), {
      ...equipos(c),
      equipo: c.nombre.visita,
      cesped: "alto",
      porcentaje: x.porcentaje,
      completados: x.completados,
      intentados: x.intentados,
      porcentaje_local: x.porcentajeLocal,
      completados_local: x.completadosLocal,
      intentados_local: x.intentadosLocal
    })
  ];
}
function presionQueAhoga(p, c, m) {
  const x = medirPresion(p, m);
  if (!x || !x.efecto) return [];
  return [hechoMicro("presion_que_ahoga", "presion_que_ahoga", x.ids, { ...equipos(c), equipo: c.nombre[x.lado], presion: "alta", perdidas: x.ids.length, limite: x.limite })];
}
function insolitos(p, c, m) {
  const out = [];
  for (const g of c.goles) {
    if (g.ev.definicion !== "olimpico") continue;
    out.push(
      hecho(c, "gol_olimpico", "gol_olimpico", [g.ev.relacionadoCon, g.ev.id], {
        ...equipos(c),
        jugador: g.ev.jugador ?? "",
        equipo: c.nombre[g.ev.equipo],
        minuto: minutoTxt(g.ev.minuto),
        definicion: "olimpico",
        marcador_local: g.marcador.local,
        marcador_visita: g.marcador.visita
      })
    );
  }
  c.ev.forEach((e, i) => {
    if (e.tipo === "subida_portero" && e.jugador) {
      const corner = c.ev[i + 1];
      const tiro = c.ev.slice(i + 2).find((x, k) => x.tipo === "tiro" && x.jugador === e.jugador && c.ev.slice(i + 2, i + 2 + k).every((y) => !["tiro", "corner", "pase_clave", "fuera_de_juego"].includes(y.tipo)));
      const gol = tiro ? c.ev.find((x) => x.tipo === "gol" && x.relacionadoCon === tiro.id) : void 0;
      out.push(
        hecho(c, "subida_portero", gol ? "subida_portero_gol" : tiro ? "subida_portero_remate" : "subida_portero", [e.id, corner?.id, tiro?.id, gol?.id], {
          jugador: e.jugador,
          equipo: c.nombre[e.equipo],
          minuto: minutoTxt(e.minuto),
          remate: tiro ? "si" : "no",
          gol: gol ? "si" : "no"
        })
      );
    }
    if (e.tipo === "tiro" && e.alPalo !== void 0 && e.jugador) {
      out.push(hecho(c, "tiro_al_palo", e.alPalo === 2 ? "doble_palo" : "al_palo", [e.id], { jugador: e.jugador, equipo: c.nombre[e.equipo], minuto: minutoTxt(e.minuto), palos: e.alPalo }));
    }
    if (e.tipo === "interrupcion" && e.causa && e.duracion !== void 0) {
      const t = CAUSA_TEXTO[e.causa];
      out.push(hecho(c, "interrupcion", "interrupcion", [e.id], { minuto: minutoTxt(e.minuto), duracion: e.duracion, causa: e.causa, causa_es: t.es, causa_en: t.en }));
    }
  });
  const niebla = medirNiebla(p, m);
  if (niebla?.efecto) out.push(hechoMicro("efecto_niebla", "efecto_niebla", inicios(c), { ...equipos(c), completados: niebla.completados, intentados: niebla.intentados, porcentaje: niebla.porcentaje }));
  return out;
}
function sancionesDeClub(p, c) {
  const inicio = c.ev.find((e) => e.tipo === "inicio_periodo");
  if (!inicio) return [];
  return (p.config.sancionesClub ?? []).map((s) => {
    const t = CAUSA_SANCION_TEXTO[s.causa];
    const base = { equipo: c.nombre[s.lado], tipo: s.tipo, causa: s.causa, causa_es: t.es, causa_en: t.en };
    if (s.tipo === "deduccion") return hecho(c, "sancion_de_club", "sancion_deduccion", [inicio.id], { ...base, puntos: s.puntos });
    return hecho(c, "sancion_de_club", s.tipo === "puerta_cerrada" ? "sancion_puerta_cerrada" : "sancion_limite_banco", [inicio.id], {
      ...base,
      partido: s.partido,
      de: s.de,
      ...s.tipo === "limite_banco" ? { suplentes: BANCO_LIMITADO } : {}
    });
  });
}
function oleDeLaGrada(p, c, m) {
  return rachasOle(p, m).map(
    (r) => hechoMicro("ole_de_la_grada", "ole_de_la_grada", r.pases.map((x) => x.id), {
      equipo: c.nombre[r.equipo],
      pases: r.pases.length,
      minuto: minutoTxt(r.pases[r.pases.length - 1].minuto)
    })
  );
}
function lesiones(c) {
  const out = [];
  c.ev.forEach((e, i) => {
    if (e.tipo !== "lesion" || !e.jugador || e.baja === void 0) return;
    const cambio = c.ev[i + 1]?.tipo === "cambio" ? c.ev[i + 1] : void 0;
    const falta = e.relacionadoCon ? c.porId.get(e.relacionadoCon) : void 0;
    const j = jornadasTxt(e.baja);
    out.push(
      hecho(c, "lesion_en_partido", falta?.jugador ? "lesion_falta" : "lesion", [e.id, cambio?.id, falta?.id], {
        jugador: e.jugador,
        equipo: c.nombre[e.equipo],
        minuto: minutoTxt(e.minuto),
        jornadas: e.baja,
        baja_es: j.es,
        baja_en: j.en,
        ...falta?.jugador ? { infractor: falta.jugador } : {}
      })
    );
  });
  return out;
}
function bajasDelPartido(p, c) {
  const inicio = c.ev.find((e) => e.tipo === "inicio_periodo");
  if (!inicio) return [];
  const out = [];
  for (const lado of LADOS2) {
    const bs = p.config.bajas?.[lado] ?? [];
    if (bs.length === 0) continue;
    const l = listaBajas(bs);
    out.push(
      hecho(c, "bajas_del_partido", "bajas_del_partido", [inicio.id], {
        equipo: c.nombre[lado],
        bajas: bs.length,
        suspendidos: bs.filter((b) => b.motivo === "suspension").length,
        lesionados: bs.filter((b) => b.motivo === "lesion").length,
        lista_es: l.es,
        lista_en: l.en
      })
    );
  }
  return out;
}
function definitorio(c, h) {
  const tipo = DESEMPATE_EVENTO[h.tipo];
  const id = h.eventos.find((x) => c.porId.get(x)?.tipo === tipo) ?? h.eventos[0];
  return id === void 0 ? void 0 : c.porId.get(id);
}
function comparar(c, m) {
  const microIdx = new Map(m.eventos.map((x, i) => [x.id, i]));
  const primerMicro = (h) => {
    const i = microIdx.get(h.eventos[0] ?? "");
    return i === void 0 ? void 0 : m.eventos[i];
  };
  const primero = (h) => {
    const e = definitorio(c, h);
    if (e) return c.indice.get(e.id);
    const x = primerMicro(h);
    return x ? c.ev.length + microIdx.get(x.id) : Number.MAX_SAFE_INTEGER;
  };
  const minuto = (h) => definitorio(c, h)?.minuto ?? primerMicro(h)?.minuto ?? Number.MAX_SAFE_INTEGER;
  return (a, b) => {
    if (a.relevancia !== b.relevancia) return b.relevancia - a.relevancia;
    if (minuto(a) !== minuto(b)) return minuto(a) - minuto(b);
    if (primero(a) !== primero(b)) return primero(a) - primero(b);
    const ta = TIPOS_HECHO.indexOf(a.tipo);
    const tb = TIPOS_HECHO.indexOf(b.tipo);
    if (ta !== tb) return ta - tb;
    const ia = a.eventos.map((id) => c.indice.get(id) ?? 0);
    const ib = b.eventos.map((id) => c.indice.get(id) ?? 0);
    for (let k = 0; k < Math.min(ia.length, ib.length); k++) {
      if (ia[k] !== ib[k]) return ia[k] - ib[k];
    }
    return ia.length - ib.length;
  };
}
function analizar(partido) {
  const c = contexto(partido);
  const borradores = [
    ...resultadoFinal(c),
    ...marcadorPorPeriodo(c),
    ...golesAnotados(c),
    ...autogoles(c),
    ...dobletes(c),
    ...remontadas(c),
    ...golesTempranosYTardios(c),
    ...dominio(c),
    ...presion(c),
    ...justiciaXg(c),
    ...porteroDestacado(partido, c),
    ...expulsiones(c),
    ...disciplina(c),
    ...figuraDelPartido(partido, c)
  ];
  const m = micro(partido);
  const presionAlta = medirPresion(partido, m);
  const subsumidos = new Set(presionAlta?.efecto ? [presionAlta.lado] : []);
  borradores.push(...duelos(c, m), ...perdidasEnSalida(c, m, subsumidos), ...dominioGlobal(c, m), ...dominioPorCanal(c, m));
  borradores.push(...insolitos(partido, c, m));
  borradores.push(...oleDeLaGrada(partido, c, m));
  borradores.push(...sancionesDeClub(partido, c));
  borradores.push(...lesiones(c), ...bajasDelPartido(partido, c));
  borradores.push(...condicionesDelPartido(partido, c), ...efectoCalor(partido, c, m), ...canchaIncomoda(partido, c, m), ...presionQueAhoga(partido, c, m));
  borradores.sort(comparar(c, m));
  return borradores.map((b, i) => ({ id: `h${String(i + 1).padStart(2, "0")}`, ...b }));
}

// src/sim/espacial.ts
function enBanda(zona, xg) {
  const b = ZONA_XG_BANDAS[zona];
  const x = Math.round(xg * 100);
  const lo = Math.round(b.min * 100);
  const hi = Math.round(b.max * 100);
  return x >= lo && (b.incluyeMax ? x <= hi : x < hi);
}
function cornerDelTiro(eventos, i) {
  const tiro = eventos[i];
  if (!tiro || tiro.tipo !== "tiro" || tiro.penal === true) return void 0;
  for (let k = i - 1; k >= 0; k--) {
    const e = eventos[k];
    if (!TIPOS_ATAQUE.includes(e.tipo)) continue;
    return e.tipo === "corner" && e.equipo === tiro.equipo && tiro.minuto - e.minuto <= TRAS_CORNER_MAX_MIN ? e : void 0;
  }
  return void 0;
}
function sortear(rng, pesos) {
  const claves = Object.keys(pesos).filter((k) => (pesos[k] ?? 0) > 0);
  return rng.weighted(claves, (k) => pesos[k] ?? 0);
}
function filtrar(tabla, xg) {
  const out = {};
  for (const [z2, w] of Object.entries(tabla)) if (enBanda(z2, xg)) out[z2] = w;
  return out;
}
var ZONAS_DE_JUEGO = ["area_chica", "frontal_del_area", "banda_izquierda", "banda_derecha", "media_distancia"];
function zonaDelTiro(rng, origen, xg, condiciones) {
  if (origen === "penal") return "punto_penal";
  let tabla;
  if (origen === "corner") {
    tabla = ESPACIAL.cornerClaro;
  } else if (origen === "tiro_libre") {
    tabla = ESPACIAL.libreLejano;
  } else {
    const claro = xg >= ZONA_XG_BANDAS.area_chica.min;
    const lejano = enBanda("media_distancia", xg) && xg <= ESPACIAL.lejanoXgMax;
    tabla = claro ? ESPACIAL.jugadaClara : lejano ? { ...ESPACIAL.jugadaLejana, media_distancia: ESPACIAL.jugadaLejana.media_distancia * factorMediaDistancia(condiciones) } : ESPACIAL.jugadaMedia;
  }
  const z2 = sortear(rng, filtrar(tabla, xg));
  if (z2) return z2;
  const resto = {};
  for (const k of ZONAS_DE_JUEGO) if (enBanda(k, xg)) resto[k] = 1;
  return sortear(rng, resto) ?? "frontal_del_area";
}
function enriquecerEspacial(eventos, semilla, origenes, condiciones, variantes) {
  const porId = new Map(eventos.map((e) => [e.id, e]));
  eventos.forEach((e, i) => {
    const rng = prngDerivado(semilla, e.id);
    switch (e.tipo) {
      case "tiro": {
        const informado = origenes.get(e.id) ?? "jugada";
        const origen = informado === "penal" ? "penal" : cornerDelTiro(eventos, i) ? "corner" : informado === "corner" ? "jugada" : informado;
        e.zonaOrigen = zonaDelTiro(rng, origen, e.xg ?? 0, condiciones);
        e.destino = sortear(rng, ESPACIAL.destino);
        e.altura = sortear(rng, ESPACIAL.altura);
        Object.assign(e, magnitudes(rng, e.zonaOrigen, e.xg ?? 0, e.penal === true, extraVelocidad(condiciones)));
        definir(rng, e, origenDelTiro(eventos, i));
        break;
      }
      case "pase_clave":
        e.zonaOrigen = e.zona === "medio" ? "media_distancia" : sortear(rng, ESPACIAL.paseAtaque);
        break;
      case "corner":
        e.banda = sortear(rng, ESPACIAL.banda);
        break;
      default:
        break;
    }
  });
  for (const e of eventos) {
    const tiro = e.relacionadoCon ? porId.get(e.relacionadoCon) : void 0;
    if (e.tipo === "gol" && tiro?.tipo === "corner") {
      e.definicion = "olimpico";
      e.zonaOrigen = "area_chica";
      e.destino = tiro.banda === "derecha" ? "palo_derecho" : "palo_izquierdo";
      e.altura = "alta";
      continue;
    }
    if (!tiro || tiro.tipo !== "tiro") continue;
    if (tiro.definicion !== void 0 && (e.tipo === "atajada" || e.tipo === "gol" && e.autogol !== true)) e.definicion = tiro.definicion;
    if (e.tipo === "gol") {
      if (tiro.zonaOrigen) e.zonaOrigen = tiro.zonaOrigen;
      if (tiro.destino) e.destino = tiro.destino;
      if (tiro.altura) e.altura = tiro.altura;
    }
    if ((e.tipo === "gol" || e.tipo === "atajada") && tiro.distanciaM !== void 0) {
      e.distanciaM = tiro.distanciaM;
      if (tiro.velocidadKmh !== void 0) e.velocidadKmh = tiro.velocidadKmh;
    }
    if (e.tipo === "atajada" && tiro.destino) e.ladoPortero = LADO_PORTERO_DE[tiro.destino];
  }
  if (variantes?.insolitos === true) {
    const conDesenlace = new Set(eventos.filter((e) => (e.tipo === "gol" || e.tipo === "atajada") && e.relacionadoCon).map((e) => e.relacionadoCon));
    for (const e of eventos) {
      if (e.tipo !== "tiro" || e.penal === true || conDesenlace.has(e.id) || e.destino !== "palo_izquierdo" && e.destino !== "palo_derecho") continue;
      const rng = prngDerivado(semilla, `palo:${e.id}`);
      if (rng.chance(INSOLITOS.pAlPalo)) e.alPalo = rng.chance(INSOLITOS.pDoblePalo) ? 2 : 1;
    }
  }
}
function rangoDistancia(zona, xg, penal) {
  const b = DISTANCIA_ZONA[zona];
  if (penal || zona === "punto_penal") return { min: b.min, max: b.max };
  let max = b.max;
  if (Math.round(xg * 100) > Math.round(TIRO_LEJANO.xgMax * 100)) max = Math.min(max, TIRO_LEJANO.distanciaMin - 1);
  return { min: b.min, max: Math.max(b.min, max) };
}
function magnitudes(rng, zona, xg, penal, extraKmh = 0) {
  const r = rangoDistancia(zona ?? "frontal_del_area", xg, penal);
  const cerca = Math.min(1, xg / XG_ALTO.xgMin);
  const t = 0.35 * (1 - cerca) + 0.65 * rng.next();
  const distanciaM = Math.min(r.max, Math.floor(r.min + t * (r.max - r.min + 1)));
  let velocidadKmh;
  if (penal) velocidadKmh = rng.int(VELOCIDAD_PENAL.min, VELOCIDAD_PENAL.max);
  else {
    const v = ESPACIAL.velocidadMedia + ESPACIAL.velocidadSigma * rng.normal() + ESPACIAL.velocidadPorMetro * (distanciaM - ESPACIAL.velocidadMetroRef) + extraKmh;
    const piso = distanciaM >= VELOCIDAD_LEJANO.distanciaMin ? VELOCIDAD_LEJANO.min : VELOCIDAD.min;
    velocidadKmh = Math.round(Math.min(VELOCIDAD.max, Math.max(piso, v)));
  }
  return { distanciaM, velocidadKmh };
}
var BANDA_PASE = /* @__PURE__ */ new Set(["banda_izquierda", "banda_derecha"]);
function origenDelTiro(eventos, i) {
  const tiro = eventos[i];
  const corner = cornerDelTiro(eventos, i) !== void 0;
  const prev = eventos[i - 1];
  const pase = prev?.tipo === "pase_clave" && prev.equipo === tiro.equipo ? prev : void 0;
  const desdeBanda = pase !== void 0 && BANDA_PASE.has(pase.zonaOrigen ?? "");
  return {
    corner,
    ...pase ? { pase } : {},
    centro: corner || desdeBanda,
    filtrado: !corner && pase !== void 0 && (pase.zonaOrigen === "frontal_del_area" || pase.zonaOrigen === "media_distancia"),
    atras: !corner && desdeBanda && tiro.zonaOrigen === "area_chica"
  };
}
var enArea = (z2) => z2 === "area_chica" || z2 === "frontal_del_area";
function admite(def, e, o) {
  if (e.penal === true) return def === "jugada";
  const xg = e.xg ?? 0;
  switch (def) {
    case "jugada":
      return true;
    case "media_cancha":
      return e.zonaOrigen === "media_distancia" && Math.round(xg * 100) <= Math.round(DEF_MEDIA_CANCHA.xgMax * 100);
    case "chilena":
    case "tijera":
      return e.zonaOrigen === "area_chica" && o.centro && e.altura === "alta";
    case "cabezazo":
      return enArea(e.zonaOrigen) && o.centro && e.altura !== void 0 && e.altura !== "raso" && (e.distanciaM ?? 0) < VELOCIDAD_LEJANO.distanciaMin;
    case "mano_a_mano":
      return enArea(e.zonaOrigen) && (o.filtrado || o.atras) && Math.round(xg * 100) >= Math.round(DEF_MANO_A_MANO.xgMin * 100);
    case "vaselina":
      return admite("mano_a_mano", e, o) && e.altura === "alta" && (e.distanciaM ?? 0) < VELOCIDAD_LEJANO.distanciaMin;
    case "olimpico":
      return false;
  }
}
function definir(rng, e, o) {
  let def = "jugada";
  if (admite("media_cancha", e, o) && rng.chance(DEFINICION.pMediaCancha)) def = "media_cancha";
  else if (admite("chilena", e, o) && rng.chance(DEFINICION.pChilena)) def = rng.chance(DEFINICION.pTijera) ? "tijera" : "chilena";
  else if (admite("cabezazo", e, o) && rng.chance(DEFINICION.pCabezazo)) def = "cabezazo";
  else if (admite("vaselina", e, o) && rng.chance(DEFINICION.pVaselina)) def = "vaselina";
  else if (admite("mano_a_mano", e, o) && rng.chance(DEFINICION.pManoAMano)) def = "mano_a_mano";
  e.definicion = def;
  if (def === "cabezazo") e.velocidadKmh = rng.int(DEF_CABEZAZO.velocidad.min, DEF_CABEZAZO.velocidad.max);
  if (def === "vaselina") e.velocidadKmh = rng.int(DEF_VASELINA.velocidad.min, DEF_VASELINA.velocidad.max);
  if (def === "media_cancha") {
    e.distanciaM = rng.int(DEF_MEDIA_CANCHA.distancia.min, DEF_MEDIA_CANCHA.distancia.max);
    e.velocidadKmh = rng.int(DEF_MEDIA_CANCHA.velocidadMin, DEFINICION.velocidadMediaCanchaMax);
  }
}

// src/sim/invariantes.ts
function verificarMinutos(p) {
  const err = [];
  const ev = p.eventos;
  const ultimoFin = [...ev].reverse().find((e) => e.tipo === "fin_periodo");
  if (!ultimoFin) return ["no hay fin_periodo"];
  const tope = ultimoFin.minuto;
  let anterior = -Infinity;
  for (const e of ev) {
    if (!Number.isInteger(e.minuto)) err.push(`${e.id}: minuto no entero (${e.minuto})`);
    if (e.minuto < anterior) err.push(`${e.id}: minuto ${e.minuto} < anterior ${anterior}`);
    if (e.minuto < 0 || e.minuto > tope) err.push(`${e.id}: minuto ${e.minuto} fuera de [0, ${tope}]`);
    anterior = e.minuto;
  }
  return err;
}
function verificarRelaciones(p) {
  const err = [];
  const indice = new Map(p.eventos.map((e, i) => [e.id, i]));
  p.eventos.forEach((e, i) => {
    const necesita = e.tipo === "gol" && e.definicion === "olimpico" ? "corner" : e.tipo === "gol" || e.tipo === "atajada" ? "tiro" : e.tipo === "tarjeta_amarilla" || e.tipo === "tarjeta_roja" ? "falta" : void 0;
    if (!necesita) return;
    if (!e.relacionadoCon) {
      err.push(`${e.id} (${e.tipo}): sin relacionadoCon`);
      return;
    }
    const j = indice.get(e.relacionadoCon);
    const ref = j === void 0 ? void 0 : p.eventos[j];
    if (j === void 0 || !ref) {
      err.push(`${e.id} (${e.tipo}): relacionadoCon ${e.relacionadoCon} no existe`);
      return;
    }
    if (j >= i) err.push(`${e.id} (${e.tipo}): relacionadoCon ${ref.id} no es anterior`);
    if (ref.tipo !== necesita) err.push(`${e.id} (${e.tipo}): apunta a ${ref.tipo}, se esperaba ${necesita}`);
    if ((necesita === "tiro" || necesita === "corner") && ref.equipo !== e.equipo) err.push(`${e.id} (${e.tipo}): el ${necesita} ${ref.id} es del otro equipo`);
  });
  return err;
}
function verificarExpulsados(p) {
  const err = [];
  const amarillas = /* @__PURE__ */ new Map();
  const fuera = /* @__PURE__ */ new Map();
  for (const e of p.eventos) {
    if (e.sale !== void 0) {
      const exp2 = fuera.get(`${e.equipo}|${e.sale}`);
      if (exp2 !== void 0) err.push(`${e.id} (${e.tipo}): ${e.sale} sale en un cambio tras su expulsi\xF3n en ${exp2}`);
    }
    if (!e.jugador) continue;
    const clave = `${ladoDelJugador(e)}|${e.jugador}`;
    const exp = fuera.get(clave);
    if (exp !== void 0) err.push(`${e.id} (${e.tipo}): ${e.jugador} aparece tras su expulsi\xF3n en ${exp}`);
    if (e.tipo === "tarjeta_roja") fuera.set(clave, e.id);
    if (e.tipo === "tarjeta_amarilla") {
      const n = (amarillas.get(clave) ?? 0) + 1;
      amarillas.set(clave, n);
      if (n >= 2) fuera.set(clave, e.id);
    }
  }
  return err;
}
function verificarJugadores(p) {
  const err = [];
  const plantilla = {
    local: p.config.local.jugadores.map((j) => j.nombre),
    visita: p.config.visita.jugadores.map((j) => j.nombre)
  };
  const entraron = /* @__PURE__ */ new Set();
  for (const e of p.eventos) {
    if (!e.jugador) continue;
    const lado = ladoDelJugador(e);
    const idx = plantilla[lado].indexOf(e.jugador);
    if (idx < 0) {
      err.push(`${e.id} (${e.tipo}): ${e.jugador} no est\xE1 en la plantilla ${lado}`);
      continue;
    }
    const clave = `${lado}|${e.jugador}`;
    const esSuplente = idx >= TITULARES;
    if (e.tipo === "cambio") {
      if (!esSuplente) err.push(`${e.id}: cambio con titular ${e.jugador} como entrante`);
      if (entraron.has(clave)) err.push(`${e.id}: ${e.jugador} entra dos veces`);
      entraron.add(clave);
    } else if (esSuplente && !entraron.has(clave)) {
      err.push(`${e.id} (${e.tipo}): suplente ${e.jugador} aparece antes de su cambio`);
    }
  }
  return err;
}
function verificarCambiosYPeriodos(p) {
  const err = [];
  const cambios = { local: 0, visita: 0 };
  for (const e of p.eventos) if (e.tipo === "cambio") cambios[e.equipo] += 1;
  for (const lado of ["local", "visita"]) {
    if (cambios[lado] > MAX_CAMBIOS) err.push(`${lado}: ${cambios[lado]} cambios (> ${MAX_CAMBIOS})`);
  }
  const marcas = p.eventos.filter((e) => e.tipo === "inicio_periodo" || e.tipo === "fin_periodo").map((e) => e.tipo);
  const esperado = ["inicio_periodo", "fin_periodo", "inicio_periodo", "fin_periodo"];
  if (JSON.stringify(marcas) !== JSON.stringify(esperado)) err.push(`periodos: ${marcas.join(",")}`);
  let dentro = false;
  for (const e of p.eventos) {
    if (e.tipo === "inicio_periodo") {
      if (dentro) err.push(`${e.id}: inicio_periodo dentro de un periodo`);
      dentro = true;
    } else if (e.tipo === "fin_periodo") {
      if (!dentro) err.push(`${e.id}: fin_periodo sin inicio`);
      dentro = false;
    } else if (!dentro) {
      err.push(`${e.id} (${e.tipo}): fuera de periodo`);
    }
  }
  return err;
}
function verificarDesenlaces(p) {
  const err = [];
  const usados = /* @__PURE__ */ new Map();
  for (const e of p.eventos) {
    if (e.tipo !== "gol" && e.tipo !== "atajada" || e.relacionadoCon === void 0) continue;
    const previo = usados.get(e.relacionadoCon);
    if (previo !== void 0) err.push(`${e.id} (${e.tipo}): el tiro ${e.relacionadoCon} ya ten\xEDa desenlace en ${previo}`);
    else usados.set(e.relacionadoCon, e.id);
  }
  return err;
}
function verificarSalidas(p) {
  const err = [];
  const plantilla = {
    local: p.config.local.jugadores.map((j) => j.nombre),
    visita: p.config.visita.jugadores.map((j) => j.nombre)
  };
  const entraron = /* @__PURE__ */ new Set();
  const salieron = /* @__PURE__ */ new Map();
  for (const e of p.eventos) {
    for (const nombre of [e.jugador, e.sale]) {
      if (nombre === void 0) continue;
      const previo = salieron.get(`${nombre === e.jugador ? ladoDelJugador(e) : e.equipo}|${nombre}`);
      if (previo !== void 0) err.push(`${e.id} (${e.tipo}): ${nombre} aparece tras salir en ${previo}`);
    }
    if (e.tipo !== "cambio" || e.sale === void 0) continue;
    const idx = plantilla[e.equipo].indexOf(e.sale);
    if (idx < 0) err.push(`${e.id}: sale ${e.sale}, que no est\xE1 en la plantilla ${e.equipo}`);
    else if (idx >= TITULARES && !entraron.has(`${e.equipo}|${e.sale}`)) err.push(`${e.id}: sale el suplente ${e.sale}, que nunca entr\xF3`);
    if (e.sale === e.jugador) err.push(`${e.id}: entra y sale el mismo jugador`);
    if (e.jugador !== void 0) entraron.add(`${e.equipo}|${e.jugador}`);
    salieron.set(`${e.equipo}|${e.sale}`, e.id);
  }
  return err;
}
var xgValido = (xg) => xg !== void 0 && Number.isFinite(xg) && xg > 0 && xg < 1;
function verificarContrato(p) {
  const err = [];
  const porId = new Map(p.eventos.map((e) => [e.id, e]));
  p.eventos.forEach((e, i) => {
    const esperado = `e${String(i + 1).padStart(3, "0")}`;
    if (e.id !== esperado) err.push(`${e.id}: id no secuencial (se esperaba ${esperado})`);
    if (e.penal !== void 0 && e.tipo !== "tiro") err.push(`${e.id}: penal fuera de un tiro`);
    if (e.xg !== void 0 && e.tipo !== "tiro" && e.tipo !== "gol") err.push(`${e.id}: xg en ${e.tipo}`);
    if ((e.tipo === "tiro" || e.tipo === "gol") && !xgValido(e.xg)) err.push(`${e.id}: ${e.tipo} con xg inv\xE1lido (${String(e.xg)})`);
    if (e.tipo === "cambio" && (typeof e.sale !== "string" || e.sale === "")) err.push(`${e.id}: cambio sin sale`);
    if (e.tipo !== "cambio" && e.sale !== void 0) err.push(`${e.id}: sale en ${e.tipo}`);
    if (e.autogol !== void 0) {
      if (e.tipo !== "gol" || e.autogol !== true) err.push(`${e.id}: autogol en ${e.tipo}`);
      if (p.config.variantes?.autogoles !== true) err.push(`${e.id}: autogol sin la variante`);
      const t = e.relacionadoCon ? porId.get(e.relacionadoCon) : void 0;
      if (t?.penal === true) err.push(`${e.id}: autogol de un penal`);
    }
    if (e.tipo === "lesion" ? !Number.isInteger(e.baja) || e.baja < LESION_JORNADAS.min || e.baja > LESION_JORNADAS.max : e.baja !== void 0)
      err.push(`${e.id}: baja ${String(e.baja)} en ${e.tipo}`);
    if (e.tipo === "gol" && e.relacionadoCon) {
      const r = porId.get(e.relacionadoCon);
      const t = r?.tipo === "tiro" ? r : void 0;
      if (t && t.xg !== e.xg) err.push(`${e.id}: gol no hereda el xg de su tiro`);
      if (t && e.autogol !== true && t.jugador !== e.jugador) err.push(`${e.id}: gol de otro jugador que el del tiro`);
    }
    if ((e.tipo === "tarjeta_amarilla" || e.tipo === "tarjeta_roja") && e.relacionadoCon) {
      const f = porId.get(e.relacionadoCon);
      if (f && (f.jugador !== e.jugador || f.equipo !== e.equipo)) err.push(`${e.id}: tarjeta a otro jugador que el de la falta`);
    }
  });
  return err;
}
function verificarEspacial(p) {
  const err = [];
  const porId = new Map(p.eventos.map((e) => [e.id, e]));
  const en = (tipos, e) => tipos.includes(e.tipo);
  p.eventos.forEach((e, i) => {
    if (e.zonaOrigen !== void 0) {
      if (!ZONAS_ORIGEN.includes(e.zonaOrigen)) err.push(`${e.id}: zonaOrigen fuera de vocabulario (${String(e.zonaOrigen)})`);
      if (!en(["tiro", "gol", "pase_clave"], e)) err.push(`${e.id}: zonaOrigen en ${e.tipo}`);
    }
    if (e.destino !== void 0) {
      if (!DESTINOS.includes(e.destino)) err.push(`${e.id}: destino fuera de vocabulario (${String(e.destino)})`);
      if (!en(["tiro", "gol"], e)) err.push(`${e.id}: destino en ${e.tipo}`);
    }
    if (e.altura !== void 0) {
      if (!ALTURAS.includes(e.altura)) err.push(`${e.id}: altura fuera de vocabulario (${String(e.altura)})`);
      if (!en(["tiro", "gol"], e)) err.push(`${e.id}: altura en ${e.tipo}`);
    }
    if (e.ladoPortero !== void 0) {
      if (!LADOS_PORTERO.includes(e.ladoPortero)) err.push(`${e.id}: ladoPortero fuera de vocabulario (${String(e.ladoPortero)})`);
      if (e.tipo !== "atajada") err.push(`${e.id}: ladoPortero en ${e.tipo}`);
    }
    if (e.banda !== void 0) {
      if (!BANDAS.includes(e.banda)) err.push(`${e.id}: banda fuera de vocabulario (${String(e.banda)})`);
      if (e.tipo !== "corner") err.push(`${e.id}: banda en ${e.tipo}`);
    }
    if (e.tipo === "tiro" && e.zonaOrigen !== void 0) {
      if (e.penal === true && e.zonaOrigen !== "punto_penal") err.push(`${e.id}: penal con zonaOrigen ${e.zonaOrigen}`);
      if (e.penal !== true && e.zonaOrigen === "punto_penal") err.push(`${e.id}: punto_penal en un tiro que no es penal`);
      const xg = e.xg ?? 0;
      if (cornerDelTiro(p.eventos, i) && !ZONAS_AREA.includes(e.zonaOrigen))
        err.push(`${e.id}: tiro de c\xF3rner desde ${e.zonaOrigen} (fuera del \xE1rea)`);
      if (!enBanda(e.zonaOrigen, xg)) {
        const b = ZONA_XG_BANDAS[e.zonaOrigen];
        err.push(`${e.id}: ${e.zonaOrigen} con xG ${xg} (banda [${b.min}, ${b.max}${b.incluyeMax ? "]" : ")"})`);
      }
    }
    for (const k of ["distanciaM", "velocidadKmh"]) {
      const v = e[k];
      if (v === void 0) continue;
      if (!["tiro", "gol", "atajada"].includes(e.tipo)) err.push(`${e.id}: ${k} en ${e.tipo}`);
      if (!Number.isInteger(v)) err.push(`${e.id}: ${k} no entero (${v})`);
    }
    if (e.tipo === "tiro" && e.distanciaM !== void 0) {
      const d = e.distanciaM;
      const xg = e.xg ?? 0;
      if (e.penal === true) {
        if (d !== DISTANCIA_ZONA.punto_penal.min) err.push(`${e.id}: penal desde ${d} m`);
      } else {
        const z2 = e.zonaOrigen;
        if (e.definicion === "media_cancha") {
          if (d < DEF_MEDIA_CANCHA.distancia.min || d > DEF_MEDIA_CANCHA.distancia.max) err.push(`${e.id}: media cancha a ${d} m`);
        } else if (z2 && (d < DISTANCIA_ZONA[z2].min || d > DISTANCIA_ZONA[z2].max)) err.push(`${e.id}: ${z2} a ${d} m`);
        if (xg >= XG_ALTO.xgMin && d > XG_ALTO.distanciaMax) err.push(`${e.id}: xG ${xg} desde ${d} m`);
        if (d >= TIRO_LEJANO.distanciaMin && Math.round(xg * 100) > Math.round(TIRO_LEJANO.xgMax * 100)) err.push(`${e.id}: ${d} m con xG ${xg}`);
      }
    }
    if (e.tipo === "tiro" && e.velocidadKmh !== void 0) {
      const v = e.velocidadKmh;
      const b = e.penal === true ? VELOCIDAD_PENAL : VELOCIDAD;
      if (v < b.min || v > b.max) err.push(`${e.id}: ${v} km/h fuera de [${b.min}, ${b.max}]`);
      if (e.penal !== true && (e.distanciaM ?? 0) >= VELOCIDAD_LEJANO.distanciaMin && v < VELOCIDAD_LEJANO.min) err.push(`${e.id}: ${v} km/h desde ${e.distanciaM} m`);
    }
    if ((e.tipo === "gol" || e.tipo === "atajada") && e.relacionadoCon) {
      const t = porId.get(e.relacionadoCon);
      for (const k of ["distanciaM", "velocidadKmh"]) if (t && t[k] !== void 0 && e[k] !== t[k]) err.push(`${e.id}: ${k} ${String(e[k])} \u2260 su tiro (${t[k]})`);
    }
    if (e.definicion !== void 0) {
      if (!DEFINICIONES.includes(e.definicion)) err.push(`${e.id}: definicion fuera de vocabulario (${String(e.definicion)})`);
      if (!["tiro", "gol", "atajada"].includes(e.tipo)) err.push(`${e.id}: definicion en ${e.tipo}`);
      if (e.tipo === "gol" && e.autogol === true) err.push(`${e.id}: un autogol no lleva la definici\xF3n del tirador`);
      const t = e.relacionadoCon ? porId.get(e.relacionadoCon) : void 0;
      if ((e.tipo === "gol" || e.tipo === "atajada") && t?.tipo === "tiro" && t.definicion !== e.definicion) err.push(`${e.id}: definicion \u2260 su tiro`);
    }
    if (e.tipo === "tiro" && e.definicion !== void 0 && e.definicion !== "jugada") {
      const o = origenDelTiro(p.eventos, i);
      const v = e.velocidadKmh ?? 0;
      const xgc = Math.round((e.xg ?? 0) * 100);
      const area = e.zonaOrigen === "area_chica" || e.zonaOrigen === "frontal_del_area";
      const mal = (m) => err.push(`${e.id}: ${e.definicion} ${m}`);
      if (e.penal === true) mal("en un penal");
      switch (e.definicion) {
        case "cabezazo":
          if (!area || !o.centro) mal("sin centro al \xE1rea");
          if (e.altura === "raso") mal("a ras del suelo");
          if (v < DEF_CABEZAZO.velocidad.min || v > DEF_CABEZAZO.velocidad.max) mal(`a ${v} km/h`);
          break;
        case "mano_a_mano":
        case "vaselina":
          if (!area || !(o.filtrado || o.atras)) mal("sin pase filtrado ni pase atr\xE1s al \xE1rea");
          if (xgc < Math.round(DEF_MANO_A_MANO.xgMin * 100)) mal(`con xG ${e.xg}`);
          if (e.definicion === "vaselina" && e.altura !== "alta") mal(`con altura ${String(e.altura)}`);
          if (e.definicion === "vaselina" && (v < DEF_VASELINA.velocidad.min || v > DEF_VASELINA.velocidad.max)) mal(`a ${v} km/h`);
          break;
        case "chilena":
        case "tijera":
          if (e.zonaOrigen !== "area_chica" || !o.centro || e.altura !== "alta") mal("sin centro alto al \xE1rea chica");
          break;
        case "media_cancha":
          if (e.zonaOrigen !== "media_distancia") mal(`desde ${String(e.zonaOrigen)}`);
          if (xgc > Math.round(DEF_MEDIA_CANCHA.xgMax * 100)) mal(`con xG ${e.xg}`);
          if (v < DEF_MEDIA_CANCHA.velocidadMin) mal(`a ${v} km/h`);
          break;
      }
    }
    if (e.tipo === "pase_clave" && e.zonaOrigen !== void 0 && !ZONAS_ORIGEN_PASE.includes(e.zonaOrigen))
      err.push(`${e.id}: pase clave desde ${e.zonaOrigen}`);
    const rel = e.relacionadoCon ? porId.get(e.relacionadoCon) : void 0;
    const tiro = rel?.tipo === "tiro" ? rel : void 0;
    if (e.tipo === "gol" && tiro) {
      if (tiro.destino !== void 0 && e.destino === void 0) err.push(`${e.id}: gol sin destino (su tiro lo tiene)`);
      for (const k of ["zonaOrigen", "destino", "altura"])
        if (e[k] !== void 0 && e[k] !== tiro[k]) err.push(`${e.id}: gol con ${k} ${String(e[k])} \u2260 su tiro (${String(tiro[k])})`);
    }
    if (e.tipo === "atajada" && tiro) {
      if (tiro.destino !== void 0 && e.ladoPortero === void 0) err.push(`${e.id}: atajada sin ladoPortero (su tiro tiene destino)`);
      if (e.ladoPortero !== void 0 && tiro.destino !== void 0 && e.ladoPortero !== LADO_PORTERO_DE[tiro.destino])
        err.push(`${e.id}: portero a ${e.ladoPortero} con tiro al ${tiro.destino}`);
    }
  });
  return err;
}
function verificarCondiciones(p) {
  const c = p.config.condiciones;
  if (c === void 0) return [];
  const err = [];
  if (!CLIMAS_PARTIDO.includes(c.clima)) err.push(`condiciones: clima ${String(c.clima)}`);
  const banda = c.clima === "calor" ? TEMPERATURA_C.calor : c.clima === "frio" ? TEMPERATURA_C.frio : void 0;
  if (banda) {
    const t = c.temperaturaC;
    if (t === void 0 || !Number.isInteger(t) || t < banda.min || t > banda.max) err.push(`condiciones: ${c.clima} a ${String(t)} \xB0C`);
  } else if (c.temperaturaC !== void 0) err.push(`condiciones: ${c.clima} con temperatura`);
  if (!SUPERFICIES.includes(c.superficie)) err.push(`condiciones: superficie ${String(c.superficie)}`);
  if (c.superficie === "natural" ? c.cesped === void 0 || !CESPEDES.includes(c.cesped) : c.cesped !== void 0) err.push(`condiciones: c\xE9sped ${String(c.cesped)} en ${c.superficie}`);
  const nl = NIVELES_PRESION.indexOf(c.presion?.local);
  const nv = NIVELES_PRESION.indexOf(c.presion?.visita);
  const cerrada = p.config.variantes?.sanciones === true && (p.config.sancionesClub ?? []).some((s) => s.tipo === "puerta_cerrada");
  if (cerrada) {
    if (c.presion?.local !== "baja" || c.presion?.visita !== "baja") err.push(`condiciones: puerta cerrada con presi\xF3n ${String(c.presion?.local)}/${String(c.presion?.visita)}`);
  } else if (nl < 0 || nv < 0 || nv !== nl + 1) err.push(`condiciones: presi\xF3n ${String(c.presion?.local)}/${String(c.presion?.visita)}`);
  return err;
}
function verificarLesiones(p) {
  const err = [];
  const porId = new Map(p.eventos.map((e, i) => [e.id, i]));
  p.eventos.forEach((e, i) => {
    if (e.tipo !== "lesion") return;
    if (p.config.variantes?.lesiones !== true) err.push(`${e.id}: lesion sin la variante`);
    const sig = p.eventos[i + 1];
    if (!sig || sig.tipo !== "cambio" || sig.equipo !== e.equipo || sig.sale !== e.jugador || sig.minuto !== e.minuto) err.push(`${e.id}: lesion de ${String(e.jugador)} sin su cambio forzado`);
    for (const x of p.eventos.slice(i + 2)) if (x.jugador === e.jugador && ladoDelJugador(x) === e.equipo || x.sale === e.jugador && x.equipo === e.equipo) err.push(`${x.id}: ${String(e.jugador)} reaparece tras lesionarse en ${e.id}`);
    if (e.relacionadoCon !== void 0) {
      const j = porId.get(e.relacionadoCon);
      const f = j === void 0 ? void 0 : p.eventos[j];
      if (!f || f.tipo !== "falta" || f.equipo === e.equipo || j >= i) err.push(`${e.id}: relacionadoCon ${e.relacionadoCon} no es una falta previa del rival`);
    }
  });
  for (const lado of ["local", "visita"]) {
    for (const b of p.config.bajas?.[lado] ?? []) {
      if (p.config[lado].jugadores.some((j) => j.nombre === b.jugador)) err.push(`baja ${b.jugador} en la plantilla ${lado}`);
      if (p.eventos.some((e) => e.equipo === lado && (e.jugador === b.jugador || e.sale === b.jugador))) err.push(`baja ${b.jugador} aparece en el partido`);
    }
  }
  return err;
}
function verificarInsolitos(p) {
  const err = [];
  const ev = p.eventos;
  const on = p.config.variantes?.insolitos === true;
  const pos = /* @__PURE__ */ new Map();
  for (const l of ["local", "visita"]) for (const j of p.config[l].jugadores) pos.set(`${l}|${j.nombre}`, j.posicion);
  const marcador = { local: 0, visita: 0 };
  const disparosDeSubida = /* @__PURE__ */ new Set();
  if (!on && p.config.condiciones?.clima === "niebla") err.push("niebla sin la variante de ins\xF3litos");
  ev.forEach((e, i) => {
    if (e.tipo === "gol") marcador[e.equipo]++;
    if (!on && (e.tipo === "subida_portero" || e.tipo === "interrupcion" || e.alPalo !== void 0 || e.definicion === "olimpico")) err.push(`${e.id}: ${e.tipo} ins\xF3lito sin la variante`);
    if (e.tipo === "gol" && (e.definicion === "olimpico" || ev.find((x) => x.id === e.relacionadoCon)?.tipo === "corner")) {
      const c = ev[i - 1];
      if (e.definicion !== "olimpico" || !c || c.tipo !== "corner" || c.id !== e.relacionadoCon || c.equipo !== e.equipo || c.jugador !== e.jugador || e.zonaOrigen !== "area_chica")
        err.push(`${e.id}: gol ol\xEDmpico sin su c\xF3rner inmediato (o de otro, o fuera del \xE1rea chica)`);
    }
    if (e.definicion === "olimpico" && e.tipo !== "gol") err.push(`${e.id}: ol\xEDmpico en ${e.tipo}`);
    if (e.tipo === "subida_portero") {
      const c = ev[i + 1];
      const rival4 = e.equipo === "local" ? "visita" : "local";
      if (!c || c.tipo !== "corner" || c.equipo !== e.equipo || c.minuto !== e.minuto) err.push(`${e.id}: subida sin su c\xF3rner`);
      if (pos.get(`${e.equipo}|${e.jugador}`) !== "POR") err.push(`${e.id}: sube alguien que no es el portero`);
      if (e.minuto < SUBIDA_MINUTO_MIN || marcador[rival4] - marcador[e.equipo] !== 1) err.push(`${e.id}: subida fuera de su situaci\xF3n (minuto ${e.minuto}, ${marcador[e.equipo]}\u2013${marcador[rival4]})`);
      for (let k = i + 2; k < ev.length; k++) {
        const t = ev[k];
        if (TIPOS_ATAQUE.includes(t.tipo) && t.tipo !== "tiro") break;
        if (t.tipo === "tiro") {
          if (t.jugador === e.jugador && cornerDelTiro(ev, k)?.id === c?.id) {
            disparosDeSubida.add(t.id);
            for (const g of ev) if (g.relacionadoCon === t.id) disparosDeSubida.add(g.id);
          }
          break;
        }
      }
    }
    if (e.alPalo !== void 0) {
      const desenlace = ev.some((x) => (x.tipo === "gol" || x.tipo === "atajada") && x.relacionadoCon === e.id);
      if (e.tipo !== "tiro" || e.alPalo !== 1 && e.alPalo !== 2 || desenlace || e.destino !== "palo_izquierdo" && e.destino !== "palo_derecho") err.push(`${e.id}: alPalo ${String(e.alPalo)} incoherente`);
    }
    if (e.tipo === "interrupcion") {
      if (!CAUSAS_INTERRUPCION.includes(e.causa)) err.push(`${e.id}: causa ${String(e.causa)}`);
      if (!Number.isInteger(e.duracion) || e.duracion < DURACION_INTERRUPCION.min || e.duracion > DURACION_INTERRUPCION.max) err.push(`${e.id}: duraci\xF3n ${String(e.duracion)}`);
    }
  });
  for (const e of ev) {
    if (!e.jugador || !["tiro", "gol", "pase_clave", "corner", "fuera_de_juego"].includes(e.tipo) || e.autogol === true) continue;
    if (pos.get(`${e.equipo}|${e.jugador}`) === "POR" && !disparosDeSubida.has(e.id)) err.push(`${e.id}: el portero ${e.jugador} en un ${e.tipo} sin subida registrada`);
  }
  const segundo = ev.findIndex((e, i) => i > 0 && e.tipo === "inicio_periodo");
  const delTiempo = (a, b) => ev.slice(a, b).filter((e) => e.tipo === "interrupcion");
  if (segundo > 0) {
    if (delTiempo(0, segundo).length > 0) err.push("interrupci\xF3n en el 1.er tiempo (su descuento no es verificable)");
    if (delTiempo(segundo, ev.length).length > 1) err.push("m\xE1s de una interrupci\xF3n en el 2.\xBA tiempo");
    const fin = [...ev].reverse().find((e) => e.tipo === "fin_periodo");
    const suma = delTiempo(segundo, ev.length).reduce((s, e) => s + (e.duracion ?? 0), 0);
    if (fin) {
      const descuento = fin.minuto - 90 - suma;
      if (descuento < P.descuento2.min || descuento > P.descuento2.max) err.push(`reloj: el 2.\xBA tiempo termina en ${fin.minuto} con ${suma}' de interrupci\xF3n (descuento ${descuento} fuera de [${P.descuento2.min}, ${P.descuento2.max}])`);
    }
  }
  return err;
}
function verificarSancionesClub(p) {
  const err = [];
  const sc = p.config.sancionesClub ?? [];
  if (sc.length > 0 && p.config.variantes?.sanciones !== true) err.push("sanciones de club sin la variante");
  const lados = /* @__PURE__ */ new Set();
  for (const s of sc) {
    if (!TIPOS_SANCION_CLUB.includes(s.tipo)) err.push(`sanci\xF3n de club: tipo ${String(s.tipo)}`);
    if (!CAUSAS_SANCION_CLUB.includes(s.causa)) err.push(`sanci\xF3n de club: causa ${String(s.causa)}`);
    if (s.lado !== "local" && s.lado !== "visita") err.push(`sanci\xF3n de club: lado ${String(s.lado)}`);
    if (lados.has(s.lado)) err.push(`sanci\xF3n de club: dos sanciones para ${s.lado} (m\xE1ximo una por club)`);
    lados.add(s.lado);
    if (s.tipo === "deduccion") {
      if (!Number.isInteger(s.puntos) || s.puntos < 1) err.push(`deducci\xF3n de ${String(s.puntos)} puntos`);
    } else if (!Number.isInteger(s.partido) || !Number.isInteger(s.de) || s.partido < 1 || s.partido > s.de) err.push(`${s.tipo}: partido ${String(s.partido)} de ${String(s.de)}`);
    if (s.tipo === "puerta_cerrada" && s.lado !== "local") err.push("puerta cerrada para el visitante (se cierra el estadio del sancionado)");
    if (s.tipo === "limite_banco") {
      const disponibles = new Set(p.config[s.lado].jugadores.slice(TITULARES, TITULARES + BANCO_LIMITADO).map((j) => j.nombre));
      for (const e of p.eventos) if (e.tipo === "cambio" && e.equipo === s.lado && e.jugador && !disponibles.has(e.jugador)) err.push(`${e.id}: ${e.jugador} entra con el banco limitado a ${BANCO_LIMITADO} (no es de los disponibles)`);
    }
  }
  return err;
}
function verificarNiveles(p) {
  if (p.config.variantes?.niveles !== true) return [];
  const err = [];
  for (const lado of ["local", "visita"])
    for (const j of p.config[lado].jugadores) if (!Number.isInteger(j.nivel) || j.nivel < NIVEL.min || j.nivel > NIVEL.max) err.push(`${lado}: ${j.nombre} con nivel ${String(j.nivel)}`);
  return err;
}
var VERIFICADORES = {
  minutos: verificarMinutos,
  relaciones: verificarRelaciones,
  expulsados: verificarExpulsados,
  jugadores: verificarJugadores,
  cambiosYPeriodos: verificarCambiosYPeriodos,
  desenlaces: verificarDesenlaces,
  salidas: verificarSalidas,
  contrato: verificarContrato,
  espacial: verificarEspacial,
  // Brief 018.
  condiciones: verificarCondiciones,
  // Brief 019.
  lesiones: verificarLesiones,
  // Brief 024.
  niveles: verificarNiveles,
  // Brief 025.
  insolitos: verificarInsolitos,
  // Brief 027.
  sancionesClub: verificarSancionesClub,
  // Brief 013: la capa micro derivada también se verifica (es función pura del partido).
  micro: (p) => verificarMicro(p, micro(p))
};
function verificarMicro(p, m) {
  const err = [];
  const idxMacro = new Map(p.eventos.map((e, i) => [e.id, i]));
  const cancha = [];
  const actual = {
    local: new Set(p.config.local.jugadores.slice(0, TITULARES).map((j) => j.nombre)),
    visita: new Set(p.config.visita.jugadores.slice(0, TITULARES).map((j) => j.nombre))
  };
  for (const e of p.eventos) {
    cancha.push({ local: new Set(actual.local), visita: new Set(actual.visita) });
    if (e.tipo === "cambio" && e.jugador && e.sale) {
      actual[e.equipo].delete(e.sale);
      actual[e.equipo].add(e.jugador);
    }
    if (e.tipo === "tarjeta_roja" && e.jugador) actual[e.equipo].delete(e.jugador);
  }
  const otro = (l) => l === "local" ? "visita" : "local";
  let minAnterior = -Infinity;
  m.eventos.forEach((x, i) => {
    const esperado = `m${String(i + 1).padStart(4, "0")}`;
    if (x.id !== esperado) err.push(`${x.id}: id no secuencial (se esperaba ${esperado})`);
    if (!TIPOS_MICRO.includes(x.tipo)) err.push(`${x.id}: tipo ${String(x.tipo)}`);
    if (!CANALES.includes(x.canal)) err.push(`${x.id}: canal ${String(x.canal)}`);
    if (x.minuto < minAnterior) err.push(`${x.id}: minuto ${x.minuto} < anterior ${minAnterior}`);
    minAnterior = x.minuto;
    const k = idxMacro.get(x.ancla);
    if (k === void 0) {
      err.push(`${x.id}: ancla ${x.ancla} inexistente`);
      return;
    }
    const ancla = p.eventos[k];
    const prev = p.eventos[k - 1];
    if (x.minuto > ancla.minuto || prev && x.minuto < prev.minuto) err.push(`${x.id}: minuto ${x.minuto} fuera de su tramo (${prev?.minuto ?? "?"}..${ancla.minuto})`);
    const c = cancha[k];
    if (!c[x.equipo].has(x.jugador)) err.push(`${x.id}: ${x.jugador} no est\xE1 en cancha (${x.tipo})`);
    if (x.receptor !== void 0 && (!c[x.equipo].has(x.receptor) || x.receptor === x.jugador)) err.push(`${x.id}: receptor ${x.receptor} inv\xE1lido`);
    if (x.rival !== void 0 && !c[otro(x.equipo)].has(x.rival)) err.push(`${x.id}: rival ${x.rival} no est\xE1 en cancha`);
    if (x.tipo === "pase") {
      if (x.receptor === void 0 || x.completado === void 0 || x.distanciaM === void 0) err.push(`${x.id}: pase incompleto`);
      else {
        if (x.distanciaM < PASE_M.corto.min || x.distanciaM > PASE_M.largo.max) err.push(`${x.id}: pase de ${x.distanciaM} m`);
        if (x.distanciaM >= PASE_M.largo.min && x.zona === "ataque") err.push(`${x.id}: pase largo desde la zona de ataque`);
      }
    }
    if (x.tipo === "conduccion" && (x.distanciaM === void 0 || x.distanciaM < CONDUCCION_M.min || x.distanciaM > CONDUCCION_M.max)) err.push(`${x.id}: conducci\xF3n de ${String(x.distanciaM)} m`);
    if ((x.tipo === "regate" || x.tipo === "duelo") && (x.rival === void 0 || x.exito === void 0)) err.push(`${x.id}: ${x.tipo} sin rival o sin resultado`);
    const sig = m.eventos[i + 1];
    if (sig && sig.ancla === x.ancla) {
      const pierde = x.tipo === "pase" && x.completado === false || (x.tipo === "regate" || x.tipo === "duelo") && x.exito === false;
      if (pierde) {
        if (sig.tipo !== "perdida" || sig.jugador !== x.jugador) err.push(`${x.id}\u2192${sig.id}: tras perder la pelota debe venir su p\xE9rdida`);
      } else if (x.tipo === "perdida") {
        if (sig.tipo !== "recuperacion" || sig.equipo === x.equipo || sig.posesion === x.posesion) err.push(`${x.id}\u2192${sig.id}: tras la p\xE9rdida recupera el rival en otra posesi\xF3n`);
      } else {
        const tiene = x.tipo === "pase" ? x.receptor : x.jugador;
        if (sig.posesion !== x.posesion || sig.jugador !== tiene) err.push(`${x.id}\u2192${sig.id}: continuidad rota (la tiene ${String(tiene)}, act\xFAa ${sig.jugador})`);
      }
    }
  });
  p.eventos.forEach((a, k) => {
    if (a.tipo !== "tiro" && a.tipo !== "pase_clave") return;
    const del = m.eventos.filter((x) => x.ancla === a.id);
    const u = del[del.length - 1];
    if (!u) return;
    const tiene = u.tipo === "pase" && u.completado ? u.receptor : u.jugador;
    if (u.equipo !== a.equipo || tiene !== a.jugador) err.push(`${a.id} (${a.tipo} de ${a.jugador}): la pelota la ten\xEDa ${String(tiene)} (${u.id})`);
    void k;
  });
  return err;
}

// src/sim/motor.ts
function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}
function redondear2(x) {
  return Math.round(x * 100) / 100;
}
function fatiga(minuto) {
  return clamp((minuto - P.fatigaDesde) / (P.fatigaHasta - P.fatigaDesde), 0, 1);
}
function factoresAtaque(atk, def, minuto) {
  const s = (atk.eq.ataque - def.eq.defensa) / 100;
  const f = fatiga(minuto);
  let p = P.ataqueBase * Math.exp(P.kFuerzaAtaque * s) * ESTILO_ATAQUE[atk.eq.estilo].ataque * ESTILO_DEFENSA[def.eq.estilo].ataqueRival * Math.pow(P.rojaPropiaAtaque, atk.expulsados) * Math.pow(P.rojaRivalAtaque, def.expulsados) * (1 + P.fatigaAtaque * f);
  if (minuto >= P.marcadorDesde) {
    if (atk.goles < def.goles) p *= 1 + P.perdiendoEmpuje;
    else if (atk.goles > def.goles) p *= 1 - P.ganandoRepliegue;
  }
  const xgShift = P.kFuerzaXg * s + ESTILO_ATAQUE[atk.eq.estilo].xgShift + P.fatigaXg * f + P.rojaRivalXg * def.expulsados;
  return { pAtaque: Math.min(p, P.ataqueMax), xgShift };
}
function validarPlanCambios(plan) {
  if (plan.length > MAX_CAMBIOS) {
    throw new Error(`plan de cambios inv\xE1lido: ${plan.length} cambios (m\xE1ximo ${MAX_CAMBIOS})`);
  }
}
function cambiosEjecutables(plan, hechos, minuto) {
  const vencidos = plan.filter((m) => m <= minuto).length;
  return Math.max(0, Math.min(vencidos, MAX_CAMBIOS - hechos));
}
function normalizarSeed(seed) {
  if (!Number.isInteger(seed)) throw new Error(`seed inv\xE1lida: ${String(seed)} (debe ser un entero)`);
  return seed >>> 0;
}
function validarConfig(config) {
  normalizarSeed(config.seed);
  const nombres = /* @__PURE__ */ new Set();
  for (const lado of ["local", "visita"]) {
    const eq = config[lado];
    if (!eq) throw new Error(`config inv\xE1lida: falta el equipo ${lado}`);
    for (const campo of ["ataque", "defensa"]) {
      const v = eq[campo];
      if (!Number.isInteger(v) || v < FUERZA_MIN || v > FUERZA_MAX) {
        throw new Error(`config inv\xE1lida: ${lado}.${campo} = ${String(v)} (entero en [${FUERZA_MIN}, ${FUERZA_MAX}])`);
      }
    }
    if (!ESTILOS_VALIDOS.includes(eq.estilo)) throw new Error(`config inv\xE1lida: ${lado}.estilo = ${String(eq.estilo)}`);
    if (!Array.isArray(eq.jugadores) || eq.jugadores.length !== TITULARES + SUPLENTES) {
      throw new Error(`config inv\xE1lida: ${lado} debe tener ${TITULARES + SUPLENTES} jugadores`);
    }
    for (const j of eq.jugadores) {
      if (typeof j.nombre !== "string" || j.nombre.trim() === "") throw new Error(`config inv\xE1lida: jugador sin nombre en ${lado}`);
      if (nombres.has(j.nombre)) throw new Error(`config inv\xE1lida: nombre de jugador repetido "${j.nombre}"`);
      nombres.add(j.nombre);
    }
  }
  if (config.variantes?.niveles === true) {
    for (const lado of ["local", "visita"]) {
      for (const j of config[lado].jugadores) {
        if (!Number.isInteger(j.nivel) || j.nivel < 1 || j.nivel > 100) throw new Error(`config inv\xE1lida: ${j.nombre} sin nivel v\xE1lido (${String(j.nivel)})`);
      }
    }
  }
  for (const lado of ["local", "visita"]) {
    for (const b of config.bajas?.[lado] ?? []) {
      if (config[lado].jugadores.some((j) => j.nombre === b.jugador)) throw new Error(`config inv\xE1lida: la baja ${b.jugador} est\xE1 en la plantilla ${lado}`);
      if (!Number.isInteger(b.jornadas) || b.jornadas < 1 || b.motivo !== "suspension" && b.motivo !== "lesion") throw new Error(`config inv\xE1lida: baja ${b.jugador} mal formada`);
    }
  }
  if (config.condiciones !== void 0) {
    const err = erroresCondiciones(config.condiciones, config.variantes?.sanciones === true && (config.sancionesClub ?? []).some((s) => s.tipo === "puerta_cerrada"));
    if (err.length > 0) throw new Error(`config inv\xE1lida: condiciones \u2014 ${err.join("; ")}`);
  }
}
var ESTILOS_VALIDOS = ["posesion", "contragolpe", "presion"];
var Simulacion = class {
  constructor(config) {
    this.config = config;
    this.rng = crearRng(config.seed);
    this.equipos = {
      local: this.estadoInicial("local", config.local),
      visita: this.estadoInicial("visita", config.visita)
    };
  }
  config;
  rng;
  eventos = [];
  /** Brief 011: origen de cada tiro (lo sabe el motor). No toca el stream principal. */
  origenes = /* @__PURE__ */ new Map();
  equipos;
  t = 0;
  /** Brief 019: número de posesión (la clave del sorteo derivado del sobreesfuerzo). */
  nPosesion = 0;
  periodo = 1;
  finPeriodo = 45;
  minutoFinal = 90;
  /** Brief 027: ¿este lado juega con el banco limitado? (solo con la variante de sanciones). */
  bancoLimitado(lado) {
    return this.config.variantes?.sanciones === true && (this.config.sancionesClub ?? []).some((s) => s.lado === lado && s.tipo === "limite_banco");
  }
  estadoInicial(lado, eq) {
    const n = this.rng.weighted([0, 1, 2, 3], (k) => P.pesosCambios[k] ?? 0) ?? 0;
    const plan = [];
    for (let i = 0; i < n; i++) plan.push(P.cambioDesde + this.rng.next() * (P.cambioHasta - P.cambioDesde));
    plan.sort((a, b) => a - b);
    validarPlanCambios(plan);
    return {
      lado,
      eq,
      enCampo: eq.jugadores.slice(0, TITULARES),
      // Brief 027: con el banco limitado (registro de la temporada), solo los primeros BANCO_LIMITADO.
      suplentes: this.bancoLimitado(lado) ? eq.jugadores.slice(TITULARES, TITULARES + BANCO_LIMITADO) : eq.jugadores.slice(TITULARES),
      amonestados: /* @__PURE__ */ new Set(),
      expulsados: 0,
      cambios: 0,
      planCambios: plan,
      goles: 0
    };
  }
  // ---------------- utilidades ----------------
  rival(lado) {
    return lado === "local" ? "visita" : "local";
  }
  minutoActual() {
    const m = Math.floor(this.t);
    return this.periodo === 1 ? Math.min(m, 45) : clamp(m, 45, this.minutoFinal);
  }
  emitir(tipo, equipo, extra = {}, minuto) {
    const id = `e${String(this.eventos.length + 1).padStart(3, "0")}`;
    const ev = { id, minuto: minuto ?? this.minutoActual(), tipo, equipo };
    if (extra.jugador !== void 0) ev.jugador = extra.jugador;
    if (extra.zona !== void 0) ev.zona = extra.zona;
    if (extra.xg !== void 0) ev.xg = extra.xg;
    if (extra.penal !== void 0) ev.penal = extra.penal;
    if (extra.relacionadoCon !== void 0) ev.relacionadoCon = extra.relacionadoCon;
    if (extra.sale !== void 0) ev.sale = extra.sale;
    if (extra.baja !== void 0) ev.baja = extra.baja;
    if (extra.autogol !== void 0) ev.autogol = extra.autogol;
    if (extra.causa !== void 0) ev.causa = extra.causa;
    if (extra.duracion !== void 0) ev.duracion = extra.duracion;
    this.eventos.push(ev);
    return id;
  }
  avanzar(dt) {
    this.t += dt;
  }
  elegir(est, pesos, excluir, cautela = false, protagonista = false) {
    return this.rng.weighted(est.enCampo, (j) => {
      if (j.nombre === excluir) return 0;
      let w = pesos[j.posicion];
      if (cautela && est.amonestados.has(j.nombre)) w *= P.cautelaAmonestado;
      if (protagonista && this.niveles) w *= Math.max(NIVELES.factorMin, 1 + NIVELES.kProtagonista * deltaNivel(j, est.eq));
      return w;
    });
  }
  /** Brief 025: ¿el partido admite insólitos? */
  get insolitos() {
    return this.config.variantes?.insolitos === true;
  }
  /** Brief 024: ¿el partido usa los niveles? */
  get niveles() {
    return this.config.variantes?.niveles === true;
  }
  /** Brief 024 · efecto 4: desplazamiento de log-xG del tirador (0 exacto sin la variante). */
  xgDelTirador(est, j) {
    return this.niveles ? NIVELES.kXg * deltaNivel(j, est.eq) : 0;
  }
  lanzadorPenal(est) {
    for (const pos of ["DEL", "MED", "DEF"]) {
      const j = est.enCampo.find((x) => x.posicion === pos);
      if (j) return j;
    }
    return void 0;
  }
  fatiga() {
    return fatiga(this.t);
  }
  factores(atk, def) {
    const f = factoresAtaque(atk, def, this.t);
    return { pAtaque: f.pAtaque * factorAtaque(this.config.condiciones, this.periodo), xgShift: f.xgShift };
  }
  /** Brief 018 · efecto 2: con calor, más faltas en el 2.º tiempo (factor 1 exacto sin calor). */
  factorFaltas() {
    return factorFaltas(this.config.condiciones, this.periodo);
  }
  // ---------------- acciones ----------------
  /** Falta + posible tarjeta. Devuelve el id de la falta, o undefined si no hubo infractor. */
  falta(est, zona, pAmarilla = P.pAmarilla) {
    const j = this.elegir(est, PESOS.falta, void 0, true);
    if (!j) return void 0;
    const idFalta = this.emitir("falta", est.lado, { jugador: j.nombre, zona });
    if (this.rng.chance(P.pRojaDirecta)) {
      this.emitir("tarjeta_roja", est.lado, { jugador: j.nombre, zona, relacionadoCon: idFalta });
      this.expulsar(est, j);
    } else if (this.rng.chance(pAmarilla * (1 + P.fatigaFaltas * this.fatiga()))) {
      if (est.amonestados.has(j.nombre)) {
        this.emitir("tarjeta_roja", est.lado, { jugador: j.nombre, zona, relacionadoCon: idFalta });
        this.expulsar(est, j);
      } else {
        this.emitir("tarjeta_amarilla", est.lado, { jugador: j.nombre, zona, relacionadoCon: idFalta });
        est.amonestados.add(j.nombre);
      }
    }
    if (this.config.variantes?.lesiones === true) {
      const rng = prngDerivado(this.config.seed, `lesion:${idFalta}`);
      if (rng.chance(LESIONES.pPorFalta)) this.lesionar(this.equipos[this.rival(est.lado)], rng, idFalta);
    }
    return idFalta;
  }
  /**
   * Brief 019 — lesión: elige al lesionado (en cancha), sortea su baja y lo saca con un cambio
   * FORZADO (lesion + cambio, mismo minuto). Sin cambios disponibles o sin suplente, el
   * jugador sigue (no hay lesión que registrar): el lesionado siempre sale, nunca juega lesionado.
   */
  lesionar(est, rng, idFalta) {
    if (est.cambios >= MAX_CAMBIOS) return;
    const victima = rng.weighted(est.enCampo, (j) => LESIONES.peso[j.posicion]);
    if (!victima) return;
    const candidatos = est.suplentes.filter((s) => victima.posicion === "POR" ? s.posicion === "POR" : s.posicion !== "POR");
    if (candidatos.length === 0) return;
    const entra = candidatos.find((s) => s.posicion === victima.posicion) ?? candidatos[0];
    const baja = rng.weighted([1, 2, 3, 4], (k) => LESION_SEVERIDAD[k]) ?? 1;
    this.emitir("lesion", est.lado, { jugador: victima.nombre, baja, ...idFalta ? { relacionadoCon: idFalta } : {} });
    est.suplentes = est.suplentes.filter((s) => s.nombre !== entra.nombre);
    est.enCampo = est.enCampo.map((j) => j.nombre === victima.nombre ? entra : j);
    est.cambios += 1;
    this.emitir("cambio", est.lado, { jugador: entra.nombre, sale: victima.nombre });
  }
  expulsar(est, j) {
    est.enCampo = est.enCampo.filter((x) => x.nombre !== j.nombre);
    est.expulsados += 1;
  }
  /** Tiro y su resolución. Devuelve true si fue gol. */
  tiro(atk, tirador, xg, opciones) {
    const xgR = clamp(redondear2(xg), P.xgMin, P.xgMax);
    const idTiro = this.emitir("tiro", atk.lado, { jugador: tirador.nombre, zona: "ataque", xg: xgR, penal: opciones.penal });
    this.origenes.set(idTiro, opciones.origen);
    const u = this.rng.next();
    if (u < xgR) {
      const autor = !opciones.penal && this.config.variantes?.autogoles === true ? this.autorDeAutogol(idTiro) : void 0;
      if (autor) this.emitir("gol", atk.lado, { jugador: autor.nombre, zona: "ataque", xg: xgR, relacionadoCon: idTiro, autogol: true });
      else this.emitir("gol", atk.lado, { jugador: tirador.nombre, zona: "ataque", xg: xgR, relacionadoCon: idTiro });
      atk.goles += 1;
      return true;
    }
    const def = this.equipos[this.rival(atk.lado)];
    const portero = this.niveles ? def.enCampo.find((j) => j.posicion === "POR") : void 0;
    const pAtajada = (opciones.penal ? P.pAtajadaPenal : P.pAtajada) + (portero ? NIVELES.kAtajada * deltaNivel(portero, def.eq) : 0);
    if (this.rng.chance(pAtajada)) {
      this.emitir("atajada", atk.lado, { zona: "ataque", relacionadoCon: idTiro });
      if (!opciones.penal && this.rng.chance(P.pCornerTrasAtajada * factorCornerTrasAtajada(this.config.condiciones))) return this.corner(atk, opciones.profundidad + 1);
    } else if (!opciones.penal && this.rng.chance(P.pCornerTrasDesvio)) {
      return this.corner(atk, opciones.profundidad + 1);
    }
    return false;
  }
  /** Brief 020: ¿este gol va a propia puerta? Devuelve el autor (del equipo que defiende) o undefined. */
  autorDeAutogol(idTiro) {
    const rng = prngDerivado(this.config.seed, `autogol:${idTiro}`);
    if (!rng.chance(AUTOGOL.p)) return void 0;
    const tiro = this.eventos.find((e) => e.id === idTiro);
    const def = this.equipos[this.rival(tiro?.equipo ?? "local")];
    return rng.weighted(def.enCampo, (j) => AUTOGOL.peso[j.posicion]);
  }
  sortearXg(mu, shift) {
    return Math.exp(mu + shift + P.xgSigma * this.rng.normal());
  }
  /** Corner y posible cabezazo. Devuelve true si terminó en gol. */
  corner(atk, profundidad) {
    this.avanzar(P.pasoEvento);
    const def = this.equipos[this.rival(atk.lado)];
    let portero;
    if (this.insolitos && this.periodo === 2 && this.minutoActual() >= SUBIDA_MINUTO_MIN && def.goles - atk.goles === 1) {
      const por = atk.enCampo.find((j) => j.posicion === "POR");
      if (por && prngDerivado(this.config.seed, `subida:${this.eventos.length}`).chance(INSOLITOS.pSubida)) {
        this.emitir("subida_portero", atk.lado, { jugador: por.nombre });
        portero = por;
      }
    }
    const lanzador = this.elegir(atk, PESOS.corner, void 0, false, true);
    const idCorner = this.emitir("corner", atk.lado, lanzador ? { jugador: lanzador.nombre, zona: "ataque" } : { zona: "ataque" });
    if (this.insolitos && lanzador && prngDerivado(this.config.seed, `olimpico:${idCorner}`).chance(INSOLITOS.pOlimpico)) {
      this.emitir("gol", atk.lado, { jugador: lanzador.nombre, zona: "ataque", xg: XG_OLIMPICO, relacionadoCon: idCorner });
      atk.goles += 1;
      return true;
    }
    if (profundidad > 2 || !this.rng.chance(P.pTiroCorner)) return false;
    const pesos = portero ? { ...PESOS.cabezazo, POR: INSOLITOS.pesoPorteroSubida } : PESOS.cabezazo;
    const cabeceador = this.elegir(atk, pesos, lanzador?.nombre, false, true);
    if (!cabeceador) return false;
    this.avanzar(P.pasoEvento);
    const { xgShift } = this.factores(atk, def);
    return this.tiro(atk, cabeceador, this.sortearXg(P.xgMuCabezazo, xgShift + this.xgDelTirador(atk, cabeceador)), { penal: false, profundidad, origen: "corner" });
  }
  /** Juega una posesión del lado `lado`; devuelve quién tiene la siguiente. */
  posesion(lado) {
    const atk = this.equipos[lado];
    const def = this.equipos[this.rival(lado)];
    const inicio = this.t;
    const dur = (P.duracionMin + this.rng.next() * P.duracionRango) * ESTILO_ATAQUE[atk.eq.estilo].duracion;
    const { pAtaque, xgShift } = this.factores(atk, def);
    const mFaltasDef = ESTILO_DEFENSA[def.eq.estilo].faltas * (1 + P.fatigaFaltas * this.fatiga()) * this.factorFaltas();
    let gol = false;
    this.nPosesion += 1;
    if (this.config.variantes?.lesiones === true) {
      const rng = prngDerivado(this.config.seed, `lesion:posesion:${this.nPosesion}`);
      if (rng.chance(LESIONES.pSobreesfuerzo * (1 + LESIONES.kSobreesfuerzo * this.fatiga()))) this.lesionar(atk, rng);
    }
    this.avanzar(P.pasoEvento);
    if (!this.rng.chance(pAtaque)) {
      if (this.rng.chance(P.pFaltaDefensorMedio * mFaltasDef)) {
        const zona = def.eq.estilo === "presion" && this.rng.chance(0.5) ? "ataque" : "medio";
        this.falta(def, zona);
      } else if (this.rng.chance(P.pFaltaAtacante * this.factorFaltas())) {
        this.falta(atk, this.rng.chance(0.5) ? "medio" : "defensa");
      }
    } else {
      const r = this.rng.next();
      const cTiro = P.pTiro;
      const cOffside = cTiro + P.pFueraDeJuego;
      const cFalta = cOffside + P.pFaltaArea * mFaltasDef;
      const cCorner = cFalta + P.pCornerDirecto;
      if (r < cTiro) {
        const tirador = this.elegir(atk, PESOS.tiro, void 0, false, true);
        if (tirador) {
          if (this.rng.chance(ESTILO_ATAQUE[atk.eq.estilo].paseClave)) {
            const asistente = this.elegir(atk, PESOS.paseClave, tirador.nombre, false, true);
            if (asistente) {
              const zona = atk.eq.estilo === "contragolpe" && this.rng.chance(0.4) ? "medio" : "ataque";
              this.emitir("pase_clave", atk.lado, { jugador: asistente.nombre, zona });
              this.avanzar(P.pasoEvento);
            }
          }
          gol = this.tiro(atk, tirador, this.sortearXg(P.xgMu, xgShift + this.xgDelTirador(atk, tirador)), { penal: false, profundidad: 0, origen: "jugada" });
        }
      } else if (r < cOffside) {
        const j = this.elegir(atk, PESOS.fueraDeJuego);
        if (j) this.emitir("fuera_de_juego", atk.lado, { jugador: j.nombre, zona: "ataque" });
      } else if (r < cFalta) {
        const esPenal = this.rng.chance(P.pPenalTrasFalta);
        const idFalta = this.falta(def, "defensa", esPenal ? P.pAmarillaPenal : P.pAmarilla);
        if (idFalta) {
          this.avanzar(P.pasoEvento);
          if (esPenal) {
            const lanzador = this.lanzadorPenal(atk);
            if (lanzador) gol = this.tiro(atk, lanzador, P.xgPenal, { penal: true, profundidad: 0, origen: "penal" });
          } else if (this.rng.chance(P.pTiroLibreTrasFalta)) {
            const j = this.elegir(atk, PESOS.tiroLibre, void 0, false, true);
            if (j) gol = this.tiro(atk, j, this.sortearXg(P.xgMuTiroLibre, xgShift + this.xgDelTirador(atk, j)), { penal: false, profundidad: 0, origen: "tiro_libre" });
          }
        }
      } else if (r < cCorner) {
        gol = this.corner(atk, 0);
      }
    }
    this.t = Math.max(this.t, inicio + dur);
    if (gol) {
      this.avanzar(P.tiempoGol);
      return def.lado;
    }
    return def.lado;
  }
  procesarCambios() {
    for (const lado of ["local", "visita"]) {
      const est = this.equipos[lado];
      const ahora = cambiosEjecutables(est.planCambios, est.cambios, this.t);
      for (let k = 0; k < ahora; k++) {
        est.planCambios.shift();
        const sale = this.elegir(est, PESOS.saleCambio);
        if (!sale) continue;
        const candidatos = est.suplentes.filter((s) => s.posicion !== "POR");
        if (candidatos.length === 0) continue;
        const entra = candidatos.find((s) => s.posicion === sale.posicion) ?? candidatos[0];
        est.suplentes = est.suplentes.filter((s) => s.nombre !== entra.nombre);
        est.enCampo = est.enCampo.map((j) => j.nombre === sale.nombre ? entra : j);
        est.cambios += 1;
        this.emitir("cambio", lado, { jugador: entra.nombre, sale: sale.nombre });
      }
    }
  }
  jugarPeriodo(periodo, saque) {
    this.periodo = periodo;
    this.t = periodo === 1 ? 0 : 45;
    const descuento = periodo === 1 ? this.rng.int(P.descuento1.min, P.descuento1.max) : this.rng.int(P.descuento2.min, P.descuento2.max);
    this.finPeriodo = (periodo === 1 ? 45 : 90) + descuento;
    if (periodo === 2) this.minutoFinal = this.finPeriodo;
    const parada = this.insolitos && periodo === 2 ? this.interrupcionDe(periodo) : void 0;
    if (parada) {
      this.finPeriodo += parada.duracion;
      if (periodo === 2) this.minutoFinal = this.finPeriodo;
    }
    this.emitir("inicio_periodo", saque, {}, periodo === 1 ? 0 : 45);
    let poseedor = saque;
    let parado = false;
    while (this.t < this.finPeriodo) {
      if (periodo === 2) this.procesarCambios();
      if (parada && !parado && this.t >= parada.minuto) {
        parado = true;
        this.emitir("interrupcion", poseedor, { causa: parada.causa, duracion: parada.duracion });
      }
      poseedor = this.posesion(poseedor);
    }
    this.emitir("fin_periodo", saque, {}, periodo === 1 ? 45 : this.minutoFinal);
  }
  /** Brief 025: ¿se interrumpe este tiempo? Minuto de juego, causa y duración, del sorteo derivado. */
  interrupcionDe(periodo) {
    const rng = prngDerivado(this.config.seed, `interrupcion:${periodo}`);
    if (!rng.chance(INSOLITOS.pInterrupcion)) return void 0;
    const base = periodo === 1 ? 0 : 45;
    return { minuto: base + rng.int(3, 42), causa: rng.pick(CAUSAS_INTERRUPCION), duracion: rng.int(DURACION_INTERRUPCION.min, DURACION_INTERRUPCION.max) };
  }
  correr() {
    const saque = this.rng.chance(0.5) ? "local" : "visita";
    this.jugarPeriodo(1, saque);
    this.jugarPeriodo(2, this.rival(saque));
    enriquecerEspacial(this.eventos, this.config.seed, this.origenes, this.config.condiciones, this.config.variantes);
    return { config: this.config, eventos: this.eventos };
  }
};
function simular(config) {
  validarConfig(config);
  const copia = JSON.parse(JSON.stringify(config));
  copia.seed = normalizarSeed(config.seed);
  return new Simulacion(copia).correr();
}

// src/cadena/acta.ts
function tituloActa(hechos) {
  const r = hechos.find((h) => h.tipo === "resultado_final") ?? hechos[0];
  return { titulo_es: r?.texto_es ?? "", titulo_en: r?.texto_en ?? "" };
}
function borradorActa(hechos) {
  return {
    ...tituloActa(hechos),
    oraciones: hechos.map((h) => ({ texto_es: h.texto_es, texto_en: h.texto_en, hecho: h.id }))
  };
}

// src/cadena/umbrales.ts
var COBERTURA = 70;
var MAX_REINTENTOS = 2;
var GOLEADA_MARGEN_MIN = 3;
var BAJAS_DIEZMADO_MIN = 2;
var MARCADOR_MAX_GOLES = 20;
var FINAL_MIN = 80;
var TEMPRANO_MAX = 10;
var MINUTO_DESCANSO = 45;
var DELTA_MI_EQUIPO = 15;

// src/cadena/personalizacion.ts
function equipoDeModo(modo, partido) {
  if (modo === "equipo:local") return partido.config.local.nombre;
  if (modo === "equipo:visita") return partido.config.visita.nombre;
  return void 0;
}
var esDelEquipo = (h, equipo) => h.datos.equipo === equipo;
function repriorizar(hechos, modo, partido) {
  const equipo = equipoDeModo(modo, partido);
  if (!equipo) return hechos.map((h) => ({ ...h, datos: { ...h.datos }, eventos: [...h.eventos] }));
  return hechos.map((h, i) => ({
    h: { ...h, datos: { ...h.datos }, eventos: [...h.eventos], relevancia: esDelEquipo(h, equipo) ? Math.min(100, h.relevancia + DELTA_MI_EQUIPO) : h.relevancia },
    i
  })).sort((a, b) => b.h.relevancia - a.h.relevancia || a.i - b.i).map((x) => x.h);
}
function instruccionPerspectiva(modo, partido) {
  const equipo = equipoDeModo(modo, partido);
  if (!equipo) return void 0;
  return [
    `Perspectiva: cont\xE1 el partido para la afici\xF3n de ${equipo}, sin faltar a la verdad.`,
    `Empez\xE1 por lo que m\xE1s le importa a esa afici\xF3n (los hechos ya vienen ordenados as\xED), pero las reglas no cambian: cada oraci\xF3n narra un hecho, toda cifra, nombre y valoraci\xF3n tiene que estar en ese hecho, y nada de juicios que los hechos no paguen.`
  ].join(" ");
}

// src/cadena/prompt.ts
var SYSTEM_PROMPT = `Sos el Cronista de CRONISTA: redact\xE1s la cr\xF3nica de un partido de f\xFAtbol en espa\xF1ol y en ingl\xE9s.

REGLAS (un verificador autom\xE1tico rechaza la cr\xF3nica si no se cumplen):
1. UNA ORACI\xD3N = UN HECHO. Cada oraci\xF3n narra exactamente un hecho, cuyo ID va en "hecho". Todo n\xFAmero, nombre propio y valoraci\xF3n de la oraci\xF3n tiene que estar en ESE hecho. "apoyo" (opcional) lista hechos de contexto, pero no habilita ninguna cifra ni nombre.
2. Narr\xE1 cada hecho obligatorio en una oraci\xF3n propia en la que sea el "hecho" principal. Mencionarlo de pasada o ponerlo en "apoyo" no cuenta.
3. Toda oraci\xF3n va en los dos idiomas, con exactamente las mismas cifras en ES y en EN (tambi\xE9n las escritas con letras).
4. No hagas cuentas propias (diferencias, sumas, m\xE1rgenes, totales): solo las cifras del hecho. No escribas cifras con letras salvo que est\xE9n en el hecho.
5. No niegues sucesos: nada de \xABsin\xBB, \xABno hubo\xBB, \xABni\xBB, \xABning\xFAn\xBB, "without", "no\u2026", "never". Ning\xFAn hecho afirma ausencias.
6. Solo us\xE1 valoraciones que el hecho paga: \xABdomin\xF3\xBB solo con un hecho de dominio; \xABmereci\xF3 / contra la corriente\xBB solo con justicia_xg; \xABgoleada\xBB solo si el marcador del hecho tiene 3 o m\xE1s goles de diferencia; \xABremont\xF3\xBB solo con remontada; \xABroja directa\xBB / \xABdoble amarilla\xBB solo seg\xFAn el motivo del hecho. Nada de \xABmon\xF3logo\xBB, \xABpaliza\xBB, \xAB\xE9pico\xBB, \xABhist\xF3rico\xBB, ni causas que el hecho no dice.
7. Con \xABgan\xF3 / perdi\xF3 / empat\xF3\xBB (beat, won, lost, drew), el equipo que nombr\xE1s primero en la oraci\xF3n tiene que ser el ganador / perdedor seg\xFAn el hecho.
8. Nombres: solo los equipos y jugadores del hecho (completos, o el apellido de un jugador del hecho). Fuera de esos nombres, ninguna palabra con may\xFAscula salvo la primera de la oraci\xF3n o tras un punto, y solo si es una palabra com\xFAn (El, La, En, Tras, Con, Despu\xE9s, Al, The, In, After, With\u2026).
9. No uses nombres de clubes, ligas, estadios ni personas reales.
10. Prosa sobria de periodismo deportivo: clara, concreta, sin exageraciones ni datos inventados.

SALIDA: \xFAnicamente un objeto JSON v\xE1lido, sin texto antes ni despu\xE9s, con esta forma exacta:
{"titulo_es": string, "titulo_en": string, "oraciones": [{"texto_es": string, "texto_en": string, "hecho": string, "apoyo": [string, ...]}, ...]}
El t\xEDtulo resume el resultado final; si nombra a un jugador, solo puede decir lo que dicen sus hechos.`;
var ABRE = "<hechos>";
var CIERRA = "</hechos>";
function serializarHechos(hechos) {
  return JSON.stringify(
    hechos.map((h) => ({ id: h.id, tipo: h.tipo, relevancia: h.relevancia, texto_es: h.texto_es, texto_en: h.texto_en, datos: h.datos })),
    null,
    1
  );
}
function mensajeInicial(hechos, perspectiva) {
  const obligatorios = hechos.filter((h) => h.relevancia >= COBERTURA).map((h) => h.id);
  return [
    "Estos son los hechos verificados del partido, ordenados por relevancia:",
    ABRE,
    serializarHechos(hechos),
    CIERRA,
    `Hechos obligatorios (cada uno debe ser el "hecho" principal de una oraci\xF3n que lo narre): ${obligatorios.length > 0 ? obligatorios.join(", ") : "ninguno"}.`,
    // Brief 007: instrucción de perspectiva («mi equipo»). Cambia el tono, nunca las reglas.
    ...perspectiva ? [perspectiva] : [],
    "Devolv\xE9 solo el JSON de la cr\xF3nica."
  ].join("\n");
}
var EXPLICACION = {
  V1: "la salida no es JSON v\xE1lido con el esquema pedido",
  V2: "su hecho principal (o un apoyo) no existe, o no tiene hecho principal",
  V3: "dice una cifra, un marcador, un margen o un periodo que su hecho principal no afirma",
  V4: "nombra a alguien que no est\xE1 en su hecho principal, o usa una palabra con may\xFAscula no permitida",
  V5: "un hecho obligatorio no es el principal de ninguna oraci\xF3n, o la oraci\xF3n no narra su hecho",
  V6: "el espa\xF1ol y el ingl\xE9s no tienen las mismas cifras, o uno est\xE1 vac\xEDo",
  V7: "niega un suceso: ning\xFAn hecho afirma ausencias",
  V8: "usa una valoraci\xF3n o un verbo de resultado que su hecho principal no respalda"
};
function feedback(motivos) {
  const lineas = motivos.map((m) => {
    const donde = m.oracion >= 0 ? `Oraci\xF3n ${m.oracion + 1}` : "General";
    return `- ${donde} \u2014 ${m.regla} (${EXPLICACION[m.regla]}): ${m.detalle}`;
  });
  return [
    "El verificador rechaz\xF3 tu cr\xF3nica por estos motivos:",
    ...lineas,
    "Correg\xED exactamente esos problemas sin introducir otros y devolv\xE9 el JSON completo de la cr\xF3nica."
  ].join("\n");
}

// src/cadena/verificador.ts
import { z } from "zod";

// src/cadena/lexico.ts
var escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function palabras(alternativas, extra = "") {
  const alts = [...alternativas].sort((a, b) => b.length - a.length).map((a) => escapar(a).replace(/ /g, "\\s+"));
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alts.join("|")})${extra}(?![\\p{L}\\p{N}])`, "giu");
}
var UNIDADES_ES = ["cero", "", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
var DIEZ_A_DIECINUEVE_ES = {
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  "diecis\xE9is": 16,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19
};
var VEINTI_ES = {
  veinte: 20,
  veintiuno: 21,
  "veinti\xFAn": 21,
  veintiun: 21,
  veintiuna: 21,
  "veintid\xF3s": 22,
  veintidos: 22,
  "veintitr\xE9s": 23,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  "veintis\xE9is": 26,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29
};
var DECENAS_ES = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };
var UNIDADES_EN = ["zero", "", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
var DIEZ_A_DIECINUEVE_EN = {
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19
};
var DECENAS_EN = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
function construirNumeros() {
  const es = /* @__PURE__ */ new Map();
  const en = /* @__PURE__ */ new Map();
  UNIDADES_ES.forEach((w, n) => w && es.set(w, n));
  for (const [w, n] of Object.entries(DIEZ_A_DIECINUEVE_ES)) es.set(w, n);
  for (const [w, n] of Object.entries(VEINTI_ES)) es.set(w, n);
  for (const [w, n] of Object.entries(DECENAS_ES)) {
    es.set(w, n);
    for (const [u, k] of [["uno", 1], ["un", 1], ["una", 1], ...UNIDADES_ES.map((x, i) => [x, i]).slice(2)]) {
      es.set(`${w} y ${u}`, n + k);
    }
  }
  UNIDADES_EN.forEach((w, n) => w && en.set(w, n));
  for (const [w, n] of Object.entries(DIEZ_A_DIECINUEVE_EN)) en.set(w, n);
  for (const [w, n] of Object.entries(DECENAS_EN)) {
    en.set(w, n);
    for (const [u, k] of [["one", 1], ...UNIDADES_EN.map((x, i) => [x, i]).slice(2)]) {
      en.set(`${w}-${u}`, n + k);
      en.set(`${w} ${u}`, n + k);
    }
  }
  const ORD_ES_BASE = [
    ["primer", 1],
    ["primero", 1],
    ["segundo", 2],
    ["tercer", 3],
    ["tercero", 3],
    ["cuarto", 4],
    ["quinto", 5],
    ["sexto", 6],
    ["s\xE9ptimo", 7],
    ["septimo", 7],
    ["octavo", 8],
    ["noveno", 9],
    ["d\xE9cimo", 10],
    ["decimo", 10],
    ["und\xE9cimo", 11],
    ["undecimo", 11],
    ["onceavo", 11],
    ["duod\xE9cimo", 12],
    ["duodecimo", 12],
    ["doceavo", 12],
    ["decimotercer", 13],
    ["decimotercero", 13],
    ["decimocuarto", 14],
    ["decimoquinto", 15],
    ["decimosexto", 16],
    ["decimos\xE9ptimo", 17],
    ["decimoseptimo", 17],
    ["decimoctavo", 18],
    ["decimonoveno", 19],
    ["decimonono", 19],
    ["vig\xE9simo", 20],
    ["vigesimo", 20],
    ["trig\xE9simo", 30],
    ["cuadrag\xE9simo", 40],
    ["quincuag\xE9simo", 50],
    ["sexag\xE9simo", 60],
    ["septuag\xE9simo", 70],
    ["octog\xE9simo", 80],
    ["nonag\xE9simo", 90]
  ];
  for (const [w, n] of ORD_ES_BASE) {
    es.set(w, n);
    if (w.endsWith("o")) es.set(`${w.slice(0, -1)}a`, n);
  }
  const ORD_EN_UNIDADES = [
    ["first", 1],
    ["second", 2],
    ["third", 3],
    ["fourth", 4],
    ["fifth", 5],
    ["sixth", 6],
    ["seventh", 7],
    ["eighth", 8],
    ["ninth", 9]
  ];
  const ORD_EN = [
    ...ORD_EN_UNIDADES,
    ["tenth", 10],
    ["eleventh", 11],
    ["twelfth", 12],
    ["thirteenth", 13],
    ["fourteenth", 14],
    ["fifteenth", 15],
    ["sixteenth", 16],
    ["seventeenth", 17],
    ["eighteenth", 18],
    ["nineteenth", 19],
    ["twentieth", 20],
    ["thirtieth", 30],
    ["fortieth", 40],
    ["fiftieth", 50],
    ["sixtieth", 60],
    ["seventieth", 70],
    ["eightieth", 80],
    ["ninetieth", 90]
  ];
  for (const [w, n] of ORD_EN) en.set(w, n);
  for (const [d, n] of Object.entries(DECENAS_EN)) for (const [u, k] of ORD_EN_UNIDADES) en.set(`${d}-${u}`, n + k);
  for (const [w, n] of [
    ["docena", 12],
    ["media docena", 6],
    ["decena", 10],
    ["veintena", 20],
    ["par", 2],
    ["par de", 2],
    ["ambos", 2],
    ["ambas", 2],
    ["los dos", 2],
    ["las dos", 2],
    ["por partida doble", 2],
    ["por partida triple", 3]
  ]) es.set(w, n);
  for (const [w, n] of [["dozen", 12], ["half a dozen", 6], ["pair", 2], ["couple", 2], ["both", 2], ["twice", 2], ["thrice", 3]]) en.set(w, n);
  return { es, en };
}
var NUMEROS_EN_PALABRAS = construirNumeros();
var CUENTA_GOLES = {
  es: { doblete: 2, triplete: 3, "p\xF3ker": 4, "p\xF3quer": 4, poker: 4, repoker: 5, "rep\xF3ker": 5 },
  en: { brace: 2, "hat-trick": 3, "hat trick": 3, hattrick: 3 }
};
var FRASES_SIEMPRE = {
  es: ["los 90 minutos", "los noventa minutos", "90 minutos", "ambos equipos", "ambos conjuntos", "los dos equipos", "ambas escuadras"],
  en: ["the 90 minutes", "the full 90", "90 minutes", "one-two", "both teams", "both sides"]
};
var FRASES_PERIODO = {
  es: [["primer tiempo", 1], ["primera parte", 1], ["primera mitad", 1], ["segundo tiempo", 2], ["segunda parte", 2], ["segunda mitad", 2], ["complemento", 2]],
  en: [["first half", 1], ["second half", 2]]
};
var FRASES_INFERIORIDAD = {
  es: ["con diez", "con diez hombres", "con diez jugadores", "con uno menos", "en inferioridad"],
  en: ["ten men", "with ten", "a man down", "down to ten"]
};
var MARGEN = {
  es: [
    new RegExp("(?<![\\p{L}\\p{N}])(?:por|con)\\s+(un|una|uno|\\p{L}+|\\d+)\\s+(?:solo\\s+|s\xF3lo\\s+|\xFAnico\\s+)?gol(?:es)?\\s+de\\s+diferencia(?![\\p{L}\\p{N}])", "giu"),
    new RegExp("(?<![\\p{L}\\p{N}])(un|una|\\p{L}+|\\d+)\\s+gol(?:es)?\\s+de\\s+(?:diferencia|ventaja)(?![\\p{L}\\p{N}])", "giu"),
    /(?<![\p{L}\p{N}])por\s+la\s+(m[ií]nima)(?![\p{L}\p{N}])/giu
  ],
  en: [
    new RegExp("(?<![\\p{L}\\p{N}])by\\s+(a\\s+single|a|one|single|\\p{L}+|\\d+)\\s+(?:clear\\s+)?goals?(?![\\p{L}\\p{N}])", "giu"),
    new RegExp("(?<![\\p{L}\\p{N}])(one|\\p{L}+|\\d+)-goal\\s+(?:margin|lead|win|victory|cushion)(?![\\p{L}\\p{N}])", "giu"),
    /(?<![\p{L}\p{N}])(narrowly)(?![\p{L}\p{N}])/giu
  ]
};
function valorMargen(captura, lengua) {
  const w = captura.toLowerCase().replace(/\s+/g, " ").trim();
  if (["un", "una", "uno", "one", "a", "a single", "single", "m\xEDnima", "minima", "narrowly"].includes(w)) return 1;
  if (/^\d+$/.test(w)) return Number(w);
  return NUMEROS_EN_PALABRAS[lengua].get(w);
}
var NEGACIONES = {
  es: palabras([
    "sin",
    "no hubo",
    "no hay",
    "no hizo",
    "no tuvo",
    "no logr\xF3",
    "no pudo",
    "no marc\xF3",
    "no recibi\xF3",
    "ni",
    "ning\xFAn",
    "ninguna",
    "ninguno",
    "nadie",
    "nunca",
    "jam\xE1s",
    "tampoco",
    // rev. 3.2
    "no gan\xF3",
    "no perdi\xF3",
    "no empat\xF3",
    "no anot\xF3",
    "no respondi\xF3",
    "no descont\xF3",
    "libre de",
    "libres de",
    "sin victoria",
    "sin ganar",
    "no se registr\xF3",
    "no se registraron",
    "no se produjo",
    "no se produjeron",
    "no se vio",
    "no se vieron",
    "no existi\xF3",
    "no existieron"
  ]),
  en: palabras([
    "without",
    "none",
    "never",
    "nobody",
    "nor",
    "neither",
    "not a single",
    "failed to",
    "did not",
    "didn't",
    "could not",
    "couldn't",
    "no goals",
    "no goal",
    "no shots",
    "no shot",
    "no penalties",
    "no penalty",
    "no cards",
    "no card",
    "no red",
    "no yellow",
    "no saves",
    "no chances",
    "no corners",
    // rev. 3.2
    "unable to",
    "failed to win",
    "winless",
    "was not",
    "were not",
    "wasn't",
    "weren't",
    "no reply"
  ])
};
var NEGACION_FREE = new RegExp("(?<![\\p{L}\\p{N}])\\p{L}+-free(?![\\p{L}\\p{N}])", "giu");
var RAICES_GOL = {
  es: new RegExp("(?<![\\p{L}])(respond|replic|reaccion|descont|marc|anot|gol)\\p{L}*", "iu"),
  en: new RegExp("(?<![\\p{L}])(respond|repl|hit back|scor|net)\\p{L}*", "iu")
};
var NEGACIONES_EXCEPTO = { es: palabras(["sin embargo"]), en: palabras(["nevertheless"]) };
var margenMax = (ms) => Math.max(-1, ...ms.map((m) => Math.abs(m.x - m.y)));
var JUICIO = [
  {
    id: "dominio",
    es: palabras(["domin\xF3", "dominio", "dominador", "dominadora", "dominante", "dominaron"]),
    en: palabras(["dominated", "dominance", "dominant", "dominating"]),
    // Brief 013: también el dominio_global (posesión computada desde la capa micro).
    habilita: (h) => h.tipo === "dominio_periodo" || h.tipo === "dominio_global",
    requisito: "solo un hecho dominio_periodo o dominio_global habilita \xABdomin\xF3 / dominated\xBB"
  },
  {
    // Brief 013: el léxico de regate SOLO con duelo_ganado como principal.
    id: "regate",
    es: palabras(["dribl\xF3", "driblaba", "regate\xF3", "regateaba", "se fue de", "lo dej\xF3 atr\xE1s", "la dej\xF3 atr\xE1s", "dej\xF3 atr\xE1s", "lo desbord\xF3", "desbord\xF3"]),
    en: palabras(["dribbled past", "dribbled", "beat his man", "beats his man", "skipped past", "skips past", "went past", "got past", "left him for dead"]),
    habilita: (h) => h.tipo === "duelo_ganado",
    requisito: "\xABdribl\xF3 / beat his man / skipped past\xBB exige el hecho duelo_ganado como principal"
  },
  {
    // Brief 013: «se desangró por / bled down» SOLO con perdidas_en_salida como principal.
    id: "desangro",
    es: palabras(["se desangr\xF3 por", "se desangr\xF3", "se desangraba", "sangr\xF3 por"]),
    en: palabras(["bled down", "bleeding down", "bled possession", "haemorrhaged", "hemorrhaged"]),
    habilita: (h) => h.tipo === "perdidas_en_salida",
    requisito: "\xABse desangr\xF3 por / bled down\xBB exige el hecho perdidas_en_salida como principal"
  },
  {
    id: "merecimiento",
    es: palabras(["mereci\xF3", "merec\xEDa", "merecido", "merecida", "merecimiento", "merecidamente", "justo ganador"]),
    en: palabras(["deserved", "deserving", "deservedly", "deserve"]),
    habilita: (h) => h.tipo === "justicia_xg",
    requisito: "solo un hecho justicia_xg habilita \xABmereci\xF3 / deserved\xBB"
  },
  {
    id: "contra_la_corriente",
    es: palabras(["contra la corriente", "con menos xg", "menos xg"]),
    en: palabras(["against the run of play", "with less xg", "less xg"]),
    habilita: (h) => h.tipo === "justicia_xg" && h.datos.contra_la_corriente === "si",
    requisito: "\xABcontra la corriente / menos xG\xBB exige justicia_xg con contra_la_corriente = si"
  },
  {
    id: "mas_xg",
    es: palabras(["con m\xE1s xg", "m\xE1s xg", "mayor xg"]),
    en: palabras(["with more xg", "more xg", "higher xg"]),
    habilita: (h) => h.tipo === "justicia_xg" && h.datos.contra_la_corriente === "no" && h.datos.goles_local !== h.datos.goles_visita,
    requisito: "\xABm\xE1s xG\xBB exige justicia_xg con un ganador que NO fue contra la corriente"
  },
  {
    id: "goleada",
    es: palabras(["goleada", "gole\xF3", "golea", "golear", "goleador de la tarde"]),
    en: palabras(["thrashed", "thrash", "thrashes", "thrashing", "rout", "routed", "routs", "hammered", "hammering"]),
    habilita: (_h, ms) => margenMax(ms) >= GOLEADA_MARGEN_MIN,
    requisito: `\xABgoleada / rout\xBB exige un marcador del hecho con margen \u2265 ${GOLEADA_MARGEN_MIN}`
  },
  {
    id: "remontada",
    es: palabras(["remont\xF3", "remontada", "remontar", "remontaron", "dio vuelta", "dio la vuelta", "levant\xF3 el partido", "dio vuelta el partido", "le dio la vuelta"]),
    en: palabras(["came back", "comeback", "come-from-behind", "turned it around", "turned the game around", "fought back", "turned the tide", "turned the match around"]),
    habilita: (h) => h.tipo === "remontada",
    requisito: "solo un hecho remontada habilita \xABremont\xF3 / comeback\xBB"
  },
  {
    id: "doble_amarilla",
    es: palabras(["doble amarilla", "segunda amarilla", "dos amarillas", "segunda tarjeta amarilla"]),
    en: palabras(["second yellow", "2nd yellow", "two yellows", "two yellow cards", "second booking", "double yellow"]),
    habilita: (h) => h.tipo === "expulsion_y_efecto" && h.datos.motivo === "doble_amarilla",
    requisito: "\xABdoble/segunda amarilla\xBB exige una expulsi\xF3n por doble amarilla"
  },
  {
    id: "roja_directa",
    es: palabras(["roja directa", "tarjeta roja directa"]),
    en: palabras(["straight red", "direct red"]),
    habilita: (h) => h.tipo === "expulsion_y_efecto" && h.datos.motivo === "roja_directa",
    requisito: "\xABroja directa\xBB exige una expulsi\xF3n por roja directa"
  },
  {
    id: "goles_encajados",
    es: palabras(["encaj\xF3", "encajaron", "concedi\xF3", "concedieron", "recibi\xF3 goles"]),
    en: palabras(["conceded", "concedes", "let in", "shipped"]),
    habilita: (h) => ["resultado_final", "marcador_por_periodo", "remontada", "expulsion_y_efecto", "gol_anotado"].includes(h.tipo),
    requisito: "\xABencaj\xF3 / conceded\xBB solo con un hecho que cuenta goles (resultado, marcador, remontada, expulsi\xF3n, gol)"
  },
  {
    // Brief 009: «figura / man of the match / player of the match» SOLO con el hecho
    // figura_del_partido como principal (la nota computada desde los eventos la respalda).
    id: "figura",
    // Brief 012 §B: ampliada; ES y EN se buscan por separado (el español no se salva por su par).
    es: palabras([
      "figura",
      "la figura",
      "figura del partido",
      "jugador del partido",
      "el mejor del partido",
      "el mejor de la cancha",
      "el mejor del campo",
      "el mejor hombre",
      "el hombre m\xE1s destacado",
      "el jugador m\xE1s destacado",
      "la estrella del partido",
      "el mejor jugador",
      "mejor jugador"
    ]),
    en: palabras([
      "man of the match",
      "player of the match",
      "star of the match",
      "best player on the pitch",
      "best player on the field",
      "best player",
      "star man",
      "man of the hour",
      "standout player",
      "outstanding player"
    ]),
    habilita: (h) => h.tipo === "figura_del_partido",
    requisito: "\xABfigura / man of the match / player of the match\xBB exige el hecho figura_del_partido como principal"
  },
  {
    id: "fuera_de_tabla",
    es: palabras([
      "mon\xF3logo",
      "paliza",
      "baile",
      "bail\xF3",
      "vapuleo",
      "vapule\xF3",
      "humillaci\xF3n",
      "humill\xF3",
      "masacre",
      "aplast\xF3",
      "aplastante",
      "\xE9pico",
      "\xE9pica",
      "hist\xF3rico",
      "hist\xF3rica",
      "milagro",
      "milagroso",
      "robo",
      "esc\xE1ndalo",
      "escandaloso",
      "agresi\xF3n",
      "agredi\xF3",
      "codazo",
      "insult\xF3",
      "insulto",
      "protest\xF3",
      "var",
      "\xE1rbitro",
      "infame",
      "vergonzoso",
      // rev. 3.2 — muletillas típicas de un LLM (lista mantenida; el lenguaje abierto no se cierra)
      "golazo",
      "golazos",
      "pol\xE9mico",
      "pol\xE9mica",
      "pol\xE9micamente",
      "de forma pol\xE9mica",
      "controvertido",
      "controvertida",
      "gracias a",
      "por culpa de",
      "error del portero",
      "error del arquero",
      "error de la defensa",
      "error defensivo",
      "el mejor de la tarde",
      "el mejor gol",
      "mejor gol",
      "injusto",
      "injusta",
      "injusticia",
      "fue justo",
      "es justo",
      "inolvidable",
      "espectacular",
      "brillante",
      "magistral"
    ]),
    en: palabras([
      "one-man show",
      "masterclass",
      "humiliation",
      "humiliated",
      "massacre",
      "demolition",
      "demolished",
      "crushed",
      "crushing",
      "epic",
      "historic",
      "miracle",
      "miraculous",
      "robbery",
      "scandal",
      "scandalous",
      "violent conduct",
      "elbow",
      "elbowed",
      "insulted",
      "insult",
      "protested",
      "var",
      "referee",
      "shameful",
      "disgrace",
      // rev. 3.2
      "controversially",
      "controversial",
      "thanks to",
      "due to an error",
      "because of an error",
      "error by",
      "goalkeeping error",
      "defensive error",
      "stunner",
      "screamer",
      "wonder goal",
      "worldie",
      "best goal",
      "standout",
      "unfair",
      "fair",
      "unforgettable",
      "spectacular",
      "brilliant",
      "outplayed"
    ]),
    habilita: () => false,
    requisito: "palabra de juicio o de suceso que ning\xFAn hecho respalda"
  }
];
var VERBOS_RESULTADO = {
  es: {
    // «derrota» (presente) se excluye: es también sustantivo («una derrota dura para A»).
    gana: palabras([
      "gan\xF3",
      "gana",
      "ganaron",
      "venci\xF3",
      "vence",
      "derrot\xF3",
      "gole\xF3",
      "golea",
      "se impuso",
      "se impone",
      "se llev\xF3 el partido",
      "se llev\xF3 la victoria",
      "se qued\xF3 con la victoria",
      "super\xF3",
      "supera",
      "se qued\xF3 con el partido",
      "dobleg\xF3",
      "doblega",
      "bati\xF3"
    ]),
    pierde: palabras(["perdi\xF3", "pierde", "perdieron", "cay\xF3", "cae", "cayeron", "sucumbi\xF3", "sucumbe"]),
    // Brief 012 §C: con un gol como principal, «empató/igualó» es computable (marcador igualado tras ese gol).
    empata: palabras(["empat\xF3", "empata", "empataron", "igual\xF3", "igualaron", "puso el empate", "nivel\xF3"]),
    // Pasiva: el sujeto gramatical PIERDE («J fue superado por A»). Se detecta antes que la activa.
    pasiva: palabras([
      "fue superado por",
      "fue superada por",
      "fueron superados por",
      "fue derrotado por",
      "fue derrotada por",
      "fue vencido por",
      "fue vencida por",
      "fue goleado por",
      "fue goleada por",
      "fue doblegado por",
      "fue doblegada por",
      "fue batido por",
      "fue batida por"
    ]),
    excepto: palabras(["gan\xF3 un penal", "gan\xF3 un c\xF3rner", "gan\xF3 una falta", "gan\xF3 el bal\xF3n", "perdi\xF3 el bal\xF3n", "perdi\xF3 la pelota", "perdi\xF3 la posesi\xF3n", "perdiendo el bal\xF3n"])
  },
  en: {
    gana: palabras([
      "beat",
      "beats",
      "won",
      "wins",
      "defeated",
      "defeats",
      "thrashed",
      "thrash",
      "thrashes",
      "edged",
      "edges",
      "overcame",
      "routed",
      "saw off",
      "downed",
      "downs",
      "cruised past",
      "cruise past",
      "got the better of",
      "gets the better of",
      "overpowered"
    ]),
    pierde: palabras(["lost", "loses", "fell to", "went down", "succumbed", "succumbs"]),
    empata: palabras(["drew", "draws", "drawn", "held to a draw", "equalised", "equalized", "drew level", "levelled", "leveled", "pulled level"]),
    pasiva: palabras([
      "were beaten by",
      "was beaten by",
      "were defeated by",
      "was defeated by",
      "were outplayed by",
      "was outplayed by",
      "were thrashed by",
      "was thrashed by",
      "were downed by",
      "was downed by",
      "were edged by",
      "was edged by",
      "were overcome by"
    ]),
    excepto: palabras(["won a penalty", "won a corner", "won a free kick", "won the ball", "wins a penalty", "beat his man", "beats his man", "beat their man", "lost the ball", "lost possession", "losing the ball"])
  }
};
var PREPOSICIONES = {
  es: /* @__PURE__ */ new Set(["ante", "contra", "a", "de", "del", "con", "sobre", "para", "por", "versus", "vs", "frente", "entre", "sin"]),
  en: /* @__PURE__ */ new Set(["against", "versus", "vs", "to", "by", "over", "for", "with", "of", "from", "past", "beat", "beats", "on"])
};
var GOL_DECISIVO = {
  es: palabras(["gol de la victoria", "gol del triunfo", "gol decisivo", "tanto decisivo", "tanto de la victoria", "gol ganador", "el gol que decidi\xF3"]),
  en: palabras(["the winning goal", "winning goal", "decisive goal", "match-winner", "game-winner", "scored the winner", "netted the winner", "grabbed the winner", "the winner in minute"])
};
var GOL_DEFINITIVO = {
  es: palabras(["gol definitivo", "tanto definitivo", "definitivo", "definitiva", "cerr\xF3 el partido", "liquid\xF3 el partido"]),
  en: palabras(["settled the match", "settled the game", "settled it", "to settle it", "to settle the match", "settle the match", "the decisive final goal"])
};
var VALLA_INVICTA = {
  es: palabras(["valla invicta", "porter\xEDa a cero", "porter\xEDa imbatida", "arco en cero", "arco invicto", "sin recibir goles", "sin encajar"]),
  en: palabras(["clean sheet", "kept a clean sheet", "shut out", "shutout"])
};
var FRANJAS = [
  {
    id: "tras_descanso",
    es: palabras(["tras el descanso", "despu\xE9s del descanso", "al volver del descanso", "a la vuelta del descanso", "tras el entretiempo"]),
    en: palabras(["after the break", "after half-time", "after halftime", "after the interval", "after the restart"])
  },
  {
    id: "final",
    es: palabras(["sobre el final", "en el final del partido", "en el tramo final", "en los minutos finales", "al cierre del partido", "sobre la hora", "al final del partido"]),
    en: palabras(["late on", "late in the game", "late in the match", "in the closing minutes", "in the dying minutes", "at the death"])
  },
  {
    id: "temprano",
    es: palabras(["temprano", "tempranero", "tempranera", "en los primeros minutos", "de entrada", "al inicio del partido", "nada m\xE1s empezar"]),
    en: palabras(["early on", "early goal", "in the opening minutes", "from the off", "inside the first ten minutes"])
  },
  {
    id: "descuento",
    es: palabras(["en el descuento", "en tiempo a\xF1adido", "en el tiempo de descuento"]),
    en: palabras(["in stoppage time", "in added time", "in injury time"])
  }
];
var BALANCE_POSTERIOR = {
  es: palabras([
    "despu\xE9s",
    "despues",
    "desde entonces",
    "a partir de ah\xED",
    "a partir de entonces",
    "en adelante",
    "tras eso",
    "luego de eso",
    "hasta el final",
    "el resto del partido",
    "m\xE1s tarde",
    // brief 012
    "luego",
    "a continuaci\xF3n",
    "posteriormente",
    "acto seguido",
    "desde ah\xED",
    "en lo que quedaba",
    "lo que quedaba",
    "en lo que restaba",
    "lo que restaba",
    "por el resto",
    "en el resto"
  ]),
  en: palabras([
    "afterwards",
    "afterward",
    "after that",
    "since then",
    "thereafter",
    "from then on",
    "from that point",
    "until the end",
    "the rest of the match",
    "the rest of the game",
    "later on",
    // brief 012
    "later",
    "subsequently",
    "from there",
    "for the remainder",
    "the remainder",
    "in what remained",
    "what remained",
    "for the rest",
    "in the rest"
  ])
};
var CIERRE_EN_VIVO = {
  es: palabras([
    "resultado final",
    "marcador final",
    "final del partido",
    "pitazo final",
    "termin\xF3",
    "el partido termin\xF3",
    "el partido acab\xF3",
    "acab\xF3 el partido",
    "finaliz\xF3",
    "cerr\xF3 el marcador",
    "cerr\xF3 la cuenta",
    "sentenci\xF3",
    "sentenciado",
    "sell\xF3",
    "liquid\xF3",
    "encamin\xF3 la victoria",
    "encarril\xF3",
    "definitivo",
    "definitiva",
    "decisivo",
    "decisiva",
    "gol del triunfo",
    "gol de la victoria",
    "decidi\xF3 el partido",
    "partido decidido",
    "asegur\xF3 la victoria",
    // brief 013: un dominio parcial no es el del partido entero
    "el partido entero",
    "todo el partido",
    "de principio a fin",
    "los noventa minutos"
  ]),
  en: palabras([
    "full time",
    "full-time",
    "final score",
    "final whistle",
    "ended",
    "the match ended",
    "the match finished",
    "finished the match",
    "completed the scoring",
    "complete the scoring",
    "completing the scoring",
    "sealed the win",
    "sealed it",
    "sealed",
    "wrapped up",
    "clinched",
    "on course for victory",
    "would prove decisive",
    "decisive",
    "settled the match",
    "settled it",
    "settle the match",
    "settle it",
    "winning goal",
    "the winner",
    "decided the match",
    // brief 013: un dominio parcial no es el del partido entero
    "the whole match",
    "the entire match",
    "the whole game",
    "the entire game",
    "from start to finish",
    "all match long"
  ])
};
var CIERRE_EN_VIVO_EXCEPTO = {
  es: palabras(["el primer tiempo termin\xF3", "termin\xF3 el primer tiempo", "la primera parte termin\xF3", "termin\xF3 la primera parte", "el primer tiempo acab\xF3", "acab\xF3 el primer tiempo"]),
  en: palabras(["the first half ended", "first half ended", "the half ended", "the first half finished", "first half finished"])
};
var CONDICIONAL_ES = [
  "terminar\xEDa",
  "terminar\xEDan",
  "ser\xEDa",
  "ser\xEDan",
  "acabar\xEDa",
  "acabar\xEDan",
  "quedar\xEDa",
  "quedar\xEDan",
  "ganar\xEDa",
  "ganar\xEDan",
  "perder\xEDa",
  "perder\xEDan",
  "empatar\xEDa",
  "empatar\xEDan",
  "marcar\xEDa",
  "marcar\xEDan",
  "llegar\xEDa",
  "llegar\xEDan",
  "resistir\xEDa",
  "resistir\xEDan",
  "sentenciar\xEDa",
  "cerrar\xEDa",
  "sellar\xEDa",
  "definir\xEDa",
  "decidir\xEDa",
  "remontar\xEDa",
  "remontar\xEDan",
  "aguantar\xEDa",
  "aguantar\xEDan",
  "mantendr\xEDa",
  "mantendr\xEDan",
  "lograr\xEDa",
  "lograr\xEDan",
  "conseguir\xEDa",
  "conseguir\xEDan",
  "dar\xEDa",
  "dar\xEDan",
  "har\xEDa",
  "har\xEDan",
  "podr\xEDa",
  "podr\xEDan",
  "tendr\xEDa",
  "tendr\xEDan",
  "ir\xEDa",
  "ir\xEDan",
  "vendr\xEDa",
  "vendr\xEDan",
  "saldr\xEDa",
  "saldr\xEDan",
  "pondr\xEDa",
  "pondr\xEDan",
  "habr\xEDa",
  "habr\xEDan"
];
var FUTURO = {
  es: new RegExp(
    [
      new RegExp("(?<![\\p{L}])\\p{L}{2,}(?:ar\xE1|er\xE1|ir\xE1|ar\xE1n|er\xE1n|ir\xE1n)(?![\\p{L}])", "u").source,
      palabras(CONDICIONAL_ES).source,
      new RegExp("(?<![\\p{L}])(?:va|van|vamos)\\s+a\\s+\\p{L}+(?:ar|er|ir)(?![\\p{L}])", "u").source
    ].join("|"),
    "giu"
  ),
  en: palabras(["will", "shall", "going to", "is set to", "are set to", "would", "looks set to", "look set to", "looked set to", "on course to", "is about to"])
};
var FUNCIONALES = {
  es: /* @__PURE__ */ new Set([
    "El",
    "La",
    "Los",
    "Las",
    "Lo",
    "Un",
    "Una",
    "Unos",
    "Unas",
    "Al",
    "Del",
    "A",
    "De",
    "En",
    "Con",
    "Por",
    "Para",
    "Tras",
    "Desde",
    "Hasta",
    "Ante",
    "Sobre",
    "Entre",
    "Hacia",
    "Seg\xFAn",
    "Durante",
    "Despu\xE9s",
    "Antes",
    "Luego",
    "M\xE1s",
    "Menos",
    "Ya",
    "Pero",
    "Y",
    "O",
    "Aunque",
    "Mientras",
    "Cuando",
    "Como",
    "As\xED",
    "Adem\xE1s",
    "Tambi\xE9n",
    "Incluso",
    "Finalmente",
    "Entonces",
    "Apenas",
    "Pese",
    "Ese",
    "Esa",
    "Este",
    "Esta",
    "Eso",
    "Esto",
    "Su",
    "Sus",
    "Fue",
    "Era",
    "Hubo",
    "Ha",
    "Hab\xEDa",
    "Lleg\xF3",
    "All\xED",
    "Ah\xED",
    "Reci\xE9n",
    "Primero",
    "Pronto",
    "Todo",
    "Toda",
    "Cada",
    "Otro",
    "Otra",
    // sustantivos del oficio que abren frases o títulos
    "Resultado",
    "Goles",
    "Gol",
    "Segundo",
    "Primer",
    "Primera",
    "Segunda",
    "Medio",
    "Final",
    "Descanso",
    "Doblete",
    "Triplete",
    "Remontada",
    "Penal",
    "Victoria",
    "Empate",
    "Derrota",
    "Expulsi\xF3n",
    "Roja",
    "Amarilla",
    "Atajadas",
    "Partido",
    "Cr\xF3nica",
    "Presi\xF3n",
    "Dominio",
    // rev. 3.2 — aperturas habituales
    "Sin",
    "Poco",
    "Minutos",
    "Momentos",
    "Solo",
    "S\xF3lo",
    "Hoy",
    "Enseguida",
    "Inmediatamente",
    "Nuevamente",
    "Otra",
    "Mientras",
    "Instantes"
  ]),
  en: /* @__PURE__ */ new Set([
    "The",
    "A",
    "An",
    "In",
    "On",
    "At",
    "After",
    "Before",
    "By",
    "With",
    "For",
    "From",
    "Of",
    "To",
    "As",
    "And",
    "But",
    "Or",
    "Then",
    "Later",
    "Early",
    "Late",
    "Despite",
    "Although",
    "While",
    "When",
    "Only",
    "Just",
    "Even",
    "Also",
    "His",
    "Their",
    "Its",
    "It",
    "This",
    "That",
    "There",
    "Here",
    "Soon",
    "First",
    "Second",
    "Full",
    "Half",
    "Goals",
    "Goal",
    "Final",
    "Score",
    "Brace",
    "Hat-trick",
    "Comeback",
    "Win",
    "Draw",
    "Victory",
    "Defeat",
    "Penalty",
    "Red",
    "Yellow",
    "Saves",
    "Keeper",
    "Goalkeeper",
    "Over",
    "Under",
    "Into",
    "Up",
    "Down",
    "Off",
    "Each",
    "Every",
    "Pressure",
    "Dominance",
    // rev. 3.2 — aperturas habituales
    "However",
    "Shortly",
    "Moments",
    "Minutes",
    "Today",
    "Meanwhile",
    "Again",
    "Once",
    "Immediately",
    "Soon",
    "Just"
  ])
};
var TITULO_EN_COMUNES = new Set(
  [
    "win",
    "wins",
    "won",
    "beat",
    "beats",
    "draw",
    "draws",
    "drew",
    "seal",
    "seals",
    "sealed",
    "brace",
    "hat-trick",
    "late",
    "early",
    "comeback",
    "goal",
    "goals",
    "red",
    "card",
    "yellow",
    "keeper",
    "goalkeeper",
    "save",
    "saves",
    "stun",
    "stuns",
    "edge",
    "edges",
    "hold",
    "holds",
    "held",
    "rout",
    "routs",
    "victory",
    "defeat",
    "penalty",
    "penalties",
    "double",
    "header",
    "strike",
    "strikes",
    "earn",
    "earns",
    "secure",
    "secures",
    "grab",
    "grabs",
    "rescue",
    "rescues",
    "point",
    "points",
    "share",
    "spoils",
    "full",
    "time",
    "half",
    "first",
    "second",
    "sent",
    "off",
    "ten",
    "men",
    "against",
    "the",
    "a",
    "an",
    "in",
    "on",
    "at",
    "of",
    "for",
    "to",
    "as",
    "and",
    "after",
    "with",
    "by",
    "from",
    "over",
    "into",
    "vs",
    "v",
    "decides",
    "decide",
    "lead",
    "leads",
    "inspire",
    "inspires",
    "power",
    "powers",
    "fires",
    "fire",
    "sinks",
    "sink",
    "downs",
    "down",
    "tops"
  ].map((w) => w.toLowerCase())
);
var FRASES_CANAL = {
  es: [
    ["banda_izquierda", palabras(["banda izquierda", "por la izquierda", "costado izquierdo", "flanco izquierdo", "sector izquierdo", "carril izquierdo"])],
    ["banda_derecha", palabras(["banda derecha", "por la derecha", "costado derecho", "flanco derecho", "sector derecho", "carril derecho"])],
    ["centro", palabras(["por el centro", "por el medio", "por dentro", "carril central"])]
  ],
  en: [
    ["banda_izquierda", palabras(["left flank", "left wing", "left side", "left channel", "down the left", "on the left"])],
    ["banda_derecha", palabras(["right flank", "right wing", "right side", "right channel", "down the right", "on the right"])],
    ["centro", palabras(["the middle", "through the middle", "down the middle", "the centre", "the center", "through the centre", "through the center", "central channel"])]
  ]
};
var FUERA_DEL_AREA = {
  es: palabras(["desde fuera del \xE1rea", "fuera del \xE1rea", "desde afuera del \xE1rea", "desde lejos", "desde larga distancia", "de media distancia"]),
  en: palabras(["from outside the box", "outside the box", "from outside the area", "outside the area", "from long range", "from distance", "from range"])
};
var MISIL = {
  es: palabras(["un misil", "misil", "un ca\xF1onazo", "ca\xF1onazo", "un ob\xFAs", "ob\xFAs", "un zapatazo", "zapatazo"]),
  en: palabras(["a rocket", "rocket", "a thunderbolt", "thunderbolt", "a piledriver", "piledriver"])
};
var FRASES_EFECTO = {
  // Primero la presión: «buckled under the pressure» no debe leerse como otra cosa.
  presion_que_ahoga: {
    es: [
      "la presi\xF3n lo ahog\xF3",
      "la presi\xF3n los ahog\xF3",
      "la presi\xF3n la ahog\xF3",
      "ahogado por la presi\xF3n",
      "ahogados por la presi\xF3n",
      "lo ahog\xF3",
      "los ahog\xF3",
      "se ahog\xF3",
      "se ahogaron",
      "salida nerviosa",
      "nerviosismo",
      "nervioso",
      "nerviosa",
      "nerviosos",
      "nerviosas",
      "nervios"
    ],
    en: [
      "buckled under the pressure",
      "buckled under pressure",
      "crumbled under the pressure",
      "crumbled under pressure",
      "buckled",
      "choked",
      "nervy",
      "nervous",
      "nerves",
      "rattled"
    ]
  },
  cancha_incomoda: {
    es: [
      "se le hizo de barro",
      "se les hizo de barro",
      "se hizo de barro",
      "nunca se acomod\xF3",
      "nunca se asent\xF3",
      "nunca se sinti\xF3 c\xF3modo",
      "inc\xF3modo",
      "inc\xF3moda",
      "inc\xF3modos",
      "incomod\xF3",
      "trabado",
      "trabada"
    ],
    en: [
      "never settled",
      "never got comfortable",
      "never found their feet",
      "bogged down",
      "struggled on the surface",
      "struggled on the long grass",
      "uncomfortable",
      "ill at ease"
    ]
  },
  efecto_calor: {
    es: [
      "le pas\xF3 factura",
      "les pas\xF3 factura",
      "pas\xF3 factura",
      "el calor los fundi\xF3",
      "el calor lo fundi\xF3",
      "los fundi\xF3",
      "lo fundi\xF3",
      "se fundi\xF3",
      "se fundieron",
      "fundidos",
      "fundido",
      "piernas pesadas",
      "cansancio",
      "cansados",
      "cansado",
      "agotados",
      "agotado",
      "exhaustos",
      "se apag\xF3",
      "se apagaron"
    ],
    en: [
      "wilted in the heat",
      "took its toll",
      "took a toll",
      "melted in the heat",
      "ran out of legs",
      "heavy legs",
      "wilted",
      "wilting",
      "tiredness",
      "tired",
      "fatigue",
      "exhausted",
      "leggy",
      "faded"
    ]
  }
};
var EFECTOS_CONDICION = Object.keys(FRASES_EFECTO).map((tipo) => ({
  id: tipo,
  es: palabras(FRASES_EFECTO[tipo].es),
  en: palabras(FRASES_EFECTO[tipo].en),
  habilita: (h) => h.tipo === tipo,
  requisito: `esa frase exige el hecho ${tipo} como principal (el efecto medido en el partido; la condici\xF3n registrada sola no la paga)`
}));
var GRADOS_C = /°\s?C(?![\p{L}\p{N}])/gu;
var FRASES_CONSECUENCIA = {
  sin: {
    es: ["lleg\xF3 sin", "llega sin", "jug\xF3 sin", "juega sin", "sin poder contar con", "no pudo contar con", "no cont\xF3 con"],
    en: ["were without", "was without", "are without", "is without", "played without", "had to do without"]
  },
  suspension: {
    es: ["suspendido", "suspendidos", "suspendida", "sancionado", "sancionados", "suspensi\xF3n"],
    en: ["suspended", "suspension", "banned", "serving a ban"]
  },
  lesion: {
    es: ["se retir\xF3 lesionado", "lesionado", "lesionados", "lesionada", "lesi\xF3n", "lesiones"],
    en: ["went off injured", "injured", "injury", "injuries"]
  },
  diezmado: {
    es: ["diezmado", "diezmados", "diezmada", "mermado", "mermados"],
    en: ["depleted", "decimated", "understrength", "under-strength"]
  }
};
var conBajas = (h, motivo) => h.tipo === "bajas_del_partido" && (motivo === void 0 || Number(h.datos[motivo]) > 0);
var CONSECUENCIAS = [
  {
    id: "bajas_sin",
    es: palabras(FRASES_CONSECUENCIA.sin.es),
    en: palabras(FRASES_CONSECUENCIA.sin.en),
    habilita: (h) => conBajas(h),
    requisito: "\xABlleg\xF3 sin / were without\xBB exige el hecho bajas_del_partido como principal"
  },
  {
    id: "suspension",
    es: palabras(FRASES_CONSECUENCIA.suspension.es),
    en: palabras(FRASES_CONSECUENCIA.suspension.en),
    habilita: (h) => conBajas(h, "suspendidos"),
    requisito: "\xABsuspendido / suspended\xBB exige bajas_del_partido con alg\xFAn suspendido como principal"
  },
  {
    id: "lesion",
    es: palabras(FRASES_CONSECUENCIA.lesion.es),
    en: palabras(FRASES_CONSECUENCIA.lesion.en),
    habilita: (h) => h.tipo === "lesion_en_partido" || conBajas(h, "lesionados"),
    requisito: "\xABlesionado / injured\xBB exige lesion_en_partido, o bajas_del_partido con alg\xFAn lesionado, como principal"
  },
  {
    id: "diezmado",
    es: palabras(FRASES_CONSECUENCIA.diezmado.es),
    en: palabras(FRASES_CONSECUENCIA.diezmado.en),
    habilita: (h) => conBajas(h) && Number(h.datos.bajas) >= BAJAS_DIEZMADO_MIN,
    requisito: `\xABdiezmado / depleted\xBB exige bajas_del_partido con ${BAJAS_DIEZMADO_MIN} bajas o m\xE1s`
  }
];
var FRASES_DEFINICION = {
  chilena: { es: ["de chilena", "chilena"], en: ["bicycle kick", "overhead kick", "overhead"] },
  tijera: { es: ["de tijera", "tijera", "tijereta"], en: ["scissor kick", "scissors kick"] },
  media_cancha: { es: ["desde media cancha", "desde el medio campo", "desde su propio campo"], en: ["from the halfway line", "from inside his own half", "from halfway"] },
  vaselina: { es: ["de vaselina", "vaselina", "por encima del portero"], en: ["chipped the keeper", "chipped", "a chip", "lobbed"] },
  mano_a_mano: { es: ["mano a mano"], en: ["one-on-one", "one on one"] },
  cabezazo: { es: ["de cabeza", "cabezazo", "con la cabeza"], en: ["header", "headed", "with his head"] }
};
var PROPIA_PUERTA = {
  es: ["en propia puerta", "en su propia puerta", "en propia meta", "en su propia meta", "autogol"],
  en: ["own goal", "own-goal", "into his own net", "into their own net", "own net"]
};
var MERITO = {
  es: palabras(["marc\xF3", "anot\xF3", "convirti\xF3", "firm\xF3", "meti\xF3"]),
  en: palabras(["scored", "netted", "converted", "struck", "fired home"])
};
function trasMeritoPropiaPuerta(lengua) {
  const alts = [...PROPIA_PUERTA[lengua]].sort((a, b) => b.length - a.length).map((a) => escapar(a).replace(/ /g, "\\s+"));
  return new RegExp(`^\\s*(?:(?:an?|un|uno|el|su|his|their)\\s+)?(?:gol\\s+)?(?:${alts.join("|")})(?![\\p{L}\\p{N}])`, "iu");
}
var FRASES_INSOLITOS = {
  olimpico: {
    // Sin «olímpico» suelto: «Olímpico» es prefijo de nombres de club (Olímpico Castana…).
    es: ["gol ol\xEDmpico", "un ol\xEDmpico", "de c\xF3rner directo", "directo del c\xF3rner", "directamente del c\xF3rner", "directo de c\xF3rner"],
    en: ["olympic goal", "straight from a corner", "straight from the corner", "directly from a corner", "direct from the corner"]
  },
  subida: {
    es: ["el portero subi\xF3", "subi\xF3 el portero", "subi\xF3 a rematar", "subi\xF3 al \xE1rea"],
    en: ["went up for a corner", "went up for the corner", "goalkeeper went up", "keeper went up", "goalkeeper came up"]
  },
  palo: {
    // «al palo» (la del brief) NO cuando sigue el lado: «cruzó al palo izquierdo / largo» describe el
    // destino de un gol honesto (el del 011), no un remate al poste (ver PALO_NO_DESTINO).
    es: ["al palo", "en el palo", "dio en el palo", "peg\xF3 en el palo", "estrell\xF3", "el poste", "la madera"],
    en: ["hit the post", "off the post", "the woodwork", "hit the woodwork", "struck the post"]
  },
  doblePalo: {
    es: ["doble palo", "los dos palos", "ambos palos"],
    en: ["hit both posts", "both posts"]
  },
  interrupcion: {
    es: ["se interrumpi\xF3", "interrumpido", "interrupci\xF3n", "se par\xF3 el partido", "se detuvo el juego"],
    en: ["play was stopped", "was interrupted", "interruption", "play was halted"]
  },
  niebla: {
    es: ["la niebla", "por la niebla", "entre la niebla", "en la niebla"],
    en: ["in the fog", "the fog", "fog-bound"]
  }
};
var palos = (h) => h.tipo === "tiro_al_palo" ? Number(h.datos.palos) : 0;
var PALO_NO_DESTINO = "(?!\\s+(?:izquierdo|derecho|largo|corto|contrario|cercano|lejano))";
var paloEs = new RegExp(`${palabras(FRASES_INSOLITOS.palo.es.filter((f) => f !== "al palo")).source}|${palabras(["al palo"], PALO_NO_DESTINO).source}`, "giu");
var INSOLITOS_JUICIO = [
  { id: "olimpico", es: palabras(FRASES_INSOLITOS.olimpico.es), en: palabras(FRASES_INSOLITOS.olimpico.en), habilita: (h) => h.tipo === "gol_olimpico", requisito: "\xABol\xEDmpico / straight from the corner\xBB exige el hecho gol_olimpico como principal" },
  { id: "subida", es: palabras(FRASES_INSOLITOS.subida.es), en: palabras(FRASES_INSOLITOS.subida.en), habilita: (h) => h.tipo === "subida_portero", requisito: "\xABel portero subi\xF3 / went up for a corner\xBB exige el hecho subida_portero como principal" },
  // los dos palos ANTES que un palo: «los dos palos» no se lee como «el palo»
  { id: "doble_palo", es: palabras(FRASES_INSOLITOS.doblePalo.es), en: palabras(FRASES_INSOLITOS.doblePalo.en), habilita: (h) => palos(h) === 2, requisito: "\xABdoble palo / hit both posts\xBB exige un remate registrado en los dos palos" },
  { id: "palo", es: paloEs, en: palabras(FRASES_INSOLITOS.palo.en), habilita: (h) => palos(h) >= 1, requisito: "\xABal palo / hit the post\xBB exige un remate registrado en el palo" },
  { id: "interrupcion", es: palabras(FRASES_INSOLITOS.interrupcion.es), en: palabras(FRASES_INSOLITOS.interrupcion.en), habilita: (h) => h.tipo === "interrupcion", requisito: "\xABse interrumpi\xF3 / play was stopped\xBB exige el hecho interrupcion como principal" },
  { id: "niebla", es: palabras(FRASES_INSOLITOS.niebla.es), en: palabras(FRASES_INSOLITOS.niebla.en), habilita: (h) => h.tipo === "efecto_niebla", requisito: "\xABla niebla / in the fog\xBB exige el efecto medido (efecto_niebla) como principal" }
];
var FRASES_GRADA = {
  ole: {
    es: ["ol\xE9", "ole", "la grada rugi\xF3", "rugi\xF3 la grada", "la grada core\xF3", "core\xF3 el ol\xE9"],
    en: ["ol\xE9", "ole", "the crowd roared", "roared ol\xE9", "the fans roared", "the stands roared"]
  }
};
var GRADA_JUICIO = [
  { id: "ole", es: palabras(FRASES_GRADA.ole.es), en: palabras(FRASES_GRADA.ole.en), habilita: (h) => h.tipo === "ole_de_la_grada", requisito: "\xABol\xE9 / the crowd roared\xBB exige el hecho ole_de_la_grada como principal" }
];
var FRASES_SANCION_CLUB = {
  sancion: {
    es: ["puerta cerrada", "sin p\xFAblico", "castigado", "castigada", "deducci\xF3n", "le restaron", "le descontaron", "puntos de sanci\xF3n", "sanci\xF3n de club", "banco limitado"],
    en: ["behind closed doors", "docked", "points deduction", "points deducted", "deduction", "sanctioned", "punished", "crowd ban", "limited bench"]
  }
};
var SANCION_CLUB_JUICIO = [
  {
    id: "sancion_club",
    es: palabras(FRASES_SANCION_CLUB.sancion.es),
    en: palabras(FRASES_SANCION_CLUB.sancion.en),
    habilita: (h) => h.tipo === "sancion_de_club",
    requisito: "\xABpuerta cerrada / behind closed doors / docked points\xBB exige el hecho sancion_de_club como principal"
  }
];

// src/cadena/verificador.ts
var esquemaOracion = z.object({
  texto_es: z.string(),
  texto_en: z.string(),
  hecho: z.string(),
  apoyo: z.array(z.string()).optional()
});
var esquemaDraft = z.object({
  titulo_es: z.string(),
  titulo_en: z.string(),
  oraciones: z.array(esquemaOracion).min(1)
});
var esquemaDraftAudit = esquemaDraft.extend({ oraciones: z.array(esquemaOracion) });
var ES_DIGITO = new RegExp("\\p{Nd}", "u");
var ANCHO_CERO = /[​-‍⁠﻿­]/gu;
var GUIONES = /[‐‑‒―−﹘﹣－]/gu;
function normalizar(t) {
  const n = t.replace(ANCHO_CERO, "").normalize("NFKC").replace(GUIONES, "-");
  let out = "";
  for (const ch of n) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if (ES_DIGITO.test(ch)) {
      let cp = ch.codePointAt(0);
      let k = 0;
      while (ES_DIGITO.test(String.fromCodePoint(cp - 1))) {
        cp--;
        k++;
      }
      out += String(k % 10);
    } else out += ch;
  }
  return out;
}
var norm = (x) => String(Number(x.replace(",", ".")));
var borrar = (t, desde, largo) => t.slice(0, desde) + " ".repeat(largo) + t.slice(desde + largo);
function quitar(t, re, cada) {
  let w = t;
  for (const m of t.matchAll(new RegExp(re.source, re.flags))) {
    if (cada?.(m) === false) continue;
    w = borrar(w, m.index, m[0].length);
  }
  return w;
}
function plantel(p) {
  const equipos2 = [p.config.local.nombre, p.config.visita.nombre];
  const equipoDe = /* @__PURE__ */ new Map();
  for (const lado of ["local", "visita"]) for (const j of p.config[lado].jugadores) equipoDe.set(j.nombre, p.config[lado].nombre);
  for (const lado of ["local", "visita"]) for (const b of p.config.bajas?.[lado] ?? []) equipoDe.set(b.jugador, p.config[lado].nombre);
  const nombres = [...equipos2, ...equipoDe.keys()].sort((a, b) => b.length - a.length);
  const alias = /* @__PURE__ */ new Map();
  const prefijos = equipos2.map((e) => e.split(/\s+/)[0]);
  equipos2.forEach((e, i) => {
    alias.set(e, e);
    const partes = e.split(/\s+/);
    if (partes.length >= 2) alias.set(partes.slice(1).join(" "), e);
    const pre = prefijos[i];
    if (partes.length >= 2 && prefijos.filter((x) => x === pre).length === 1) alias.set(pre, e);
  });
  return { nombres, equipos: equipos2, equipoDe, alias, aliasOrdenados: [...alias.keys()].sort((a, b) => b.length - a.length) };
}
var fuenteDe = (h) => [h.texto_es, h.texto_en, ...Object.values(h.datos).map(String)].join("\n");
function nombresLocalVisita(h, partido) {
  const d = h.datos;
  return [typeof d.local === "string" ? d.local : partido.config.local.nombre, typeof d.visita === "string" ? d.visita : partido.config.visita.nombre];
}
function marcadoresDe(h, partido) {
  const d = h.datos;
  const [local, visita] = nombresLocalVisita(h, partido);
  const out = [];
  const par = (a, b, x, y) => {
    if (typeof x === "number" && typeof y === "number") out.push({ a, b, x, y });
  };
  par(local, visita, d.goles_local, d.goles_visita);
  par(local, visita, d.marcador_local, d.marcador_visita);
  par(local, visita, d.goles_local_periodo, d.goles_visita_periodo);
  if (typeof d.equipo === "string" && typeof d.rival === "string") {
    par(d.equipo, d.rival, d.desventaja_propios, d.desventaja_rival);
    par(d.equipo, d.rival, d.final_propios, d.final_rival);
  }
  return out;
}
function resultadoDe(h, partido) {
  const d = h.datos;
  if (h.tipo === "remontada") {
    if (d.desenlace === "victoria") return { ganador: String(d.equipo), perdedor: String(d.rival), empate: false };
    if (d.desenlace === "empate") return { empate: true };
    return void 0;
  }
  let gl = d.goles_local;
  let gv = d.goles_visita;
  if (h.tipo === "marcador_por_periodo" && d.periodo === 2) {
    gl = d.marcador_local;
    gv = d.marcador_visita;
  }
  if (!["resultado_final", "justicia_xg", "expulsion_y_efecto", "marcador_por_periodo"].includes(h.tipo)) return void 0;
  if (typeof gl !== "number" || typeof gv !== "number") return void 0;
  const [local, visita] = nombresLocalVisita(h, partido);
  if (gl === gv) return { empate: true };
  return gl > gv ? { ganador: local, perdedor: visita, empate: false } : { ganador: visita, perdedor: local, empate: false };
}
function minutosDe(h) {
  const out = [];
  for (const k of ["minuto", "desde", "hasta", "minuto_desventaja", "minutos"]) {
    const v = h.datos[k];
    if (v === void 0) continue;
    for (const m of String(v).match(/\d+(?:\+\d+)?/g) ?? []) {
      const [base, extra] = m.split("+");
      out.push(Number(base) + Number(extra ?? 0));
    }
  }
  return out;
}
function periodosDe(h) {
  const d = h.datos;
  if (d.periodo === 1 || d.periodo === 2) return [d.periodo];
  const out = [];
  for (const k of ["minuto", "desde", "hasta", "minuto_desventaja", "minutos"]) {
    const v = d[k];
    if (v === void 0) continue;
    for (const m of String(v).match(/\d+(?:\+\d+)?/g) ?? []) {
      const base = Number(m.split("+")[0]);
      if (base <= 45) out.push(1);
      if (base >= 45) out.push(2);
    }
  }
  return out;
}
function contexto2(hechos, todos, partido, pl) {
  const numeros = /* @__PURE__ */ new Set();
  for (const h of hechos) {
    for (const t of [h.texto_es, h.texto_en]) for (const n of normalizar(t).match(/\d+(?:[.,]\d+)?/g) ?? []) numeros.add(norm(n));
    for (const v of Object.values(h.datos)) {
      if (typeof v === "number") numeros.add(norm(String(v)));
      else for (const n of normalizar(v).match(/\d+(?:[.,]\d+)?/g) ?? []) numeros.add(norm(n));
    }
  }
  const fuente = hechos.map(fuenteDe).join("\n");
  const nombres = new Set(pl.nombres.filter((n) => fuente.includes(n)));
  const formasCortas = /* @__PURE__ */ new Set();
  for (const n of nombres) {
    if (pl.equipos.includes(n)) {
      for (const [a, e] of pl.alias) if (e === n && a !== n) formasCortas.add(a);
    } else {
      const partes = n.split(/\s+/);
      if (partes.length >= 2) formasCortas.add(partes.slice(1).join(" "));
    }
  }
  const resultado = hechos.map((h) => resultadoDe(h, partido)).find((r) => r !== void 0);
  return {
    hechos,
    todos,
    partido,
    pl,
    numeros,
    nombres,
    formasCortas,
    marcadores: hechos.flatMap((h) => marcadoresDe(h, partido)),
    periodos: new Set(hechos.flatMap(periodosDe)),
    minutos: hechos.flatMap(minutosDe),
    ...resultado ? { resultado } : {}
  };
}
function finalDe(ctx) {
  const r = ctx.todos.find((h) => h.tipo === "resultado_final");
  if (!r || typeof r.datos.goles_local !== "number" || typeof r.datos.goles_visita !== "number") return void 0;
  const [local, visita] = nombresLocalVisita(r, ctx.partido);
  return /* @__PURE__ */ new Map([
    [local, r.datos.goles_local],
    [visita, r.datos.goles_visita]
  ]);
}
function equiposConCero(ctx) {
  const s = /* @__PURE__ */ new Set();
  for (const m of ctx.marcadores) {
    if (m.x === 0) s.add(m.a);
    if (m.y === 0) s.add(m.b);
  }
  for (const h of ctx.hechos) {
    const [local, visita] = nombresLocalVisita(h, ctx.partido);
    if (h.datos.goles_despues_local === 0) s.add(local);
    if (h.datos.goles_despues_visita === 0) s.add(visita);
  }
  return s;
}
var PUNTUACION_ABRE = /* @__PURE__ */ new Set([".", "!", "?", ":", ";", "\xAB", '"', "\u201C", "\u2018", "'", "\xBF", "\xA1", "\u2014", "\u2013", "-", "(", "["]);
var NUMEROS_RE = { es: palabras([...NUMEROS_EN_PALABRAS.es.keys()]), en: palabras([...NUMEROS_EN_PALABRAS.en.keys()]) };
var CUENTA_RE = { es: palabras(Object.keys(CUENTA_GOLES.es)), en: palabras(Object.keys(CUENTA_GOLES.en)) };
var SIEMPRE_RE = { es: palabras(FRASES_SIEMPRE.es), en: palabras(FRASES_SIEMPRE.en) };
var INFERIORIDAD_RE = { es: palabras(FRASES_INFERIORIDAD.es), en: palabras(FRASES_INFERIORIDAD.en) };
var NO_LATINA = new RegExp("(?=\\p{L})\\P{Script=Latin}", "u");
function segmentoDe(t, i) {
  let a = i;
  while (a > 0 && !".;:!?".includes(t[a - 1])) a--;
  let b = i;
  while (b < t.length && !".;:!?".includes(t[b])) b++;
  return [a, b];
}
function menciones(t, desde, hasta, pl) {
  const out = [];
  let v = t;
  for (const a of pl.aliasOrdenados) {
    let i = v.indexOf(a, desde);
    while (i >= 0 && i + a.length <= hasta) {
      const antes = i === 0 ? "" : v[i - 1];
      const despues = v[i + a.length] ?? "";
      if (!/[\p{L}\p{N}]/u.test(antes) && !/[\p{L}\p{N}]/u.test(despues)) {
        out.push({ i, fin: i + a.length, equipo: pl.alias.get(a) });
        v = borrar(v, i, a.length);
      }
      i = v.indexOf(a, i + a.length);
    }
  }
  return out.sort((x, y) => x.i - y.i);
}
function precedidoDePreposicion(t, i, lengua) {
  const previa = t.slice(0, i).match(new RegExp("(\\p{L}+)\\s*$", "u"))?.[1]?.toLowerCase();
  return previa !== void 0 && PREPOSICIONES[lengua].has(previa);
}
function sujetoDe(t, verbo, lengua, pl) {
  const [a, b] = segmentoDe(t, verbo);
  const ms = menciones(t, a, b, pl);
  const antes = ms.filter((m) => m.fin <= verbo).reverse();
  for (const m of antes) if (!precedidoDePreposicion(t, m.i, lengua)) return m.equipo;
  for (const m of ms.filter((m2) => m2.i > verbo)) if (!precedidoDePreposicion(t, m.i, lengua)) return m.equipo;
  return void 0;
}
function analizarTexto(texto, lengua, ctx, esTitulo) {
  const h = [];
  const t0 = normalizar(texto);
  const raro = t0.match(NO_LATINA);
  if (raro) h.push({ regla: "V4", detalle: `letra de otra escritura (\xAB${raro[0]}\xBB): los nombres y el texto van en alfabeto latino` });
  if (/[?¿]/.test(t0)) h.push({ regla: "V8", detalle: "pregunta: la cr\xF3nica afirma hechos, no insin\xFAa" });
  for (const m of t0.matchAll(new RegExp(FUTURO[lengua].source, FUTURO[lengua].flags))) {
    h.push({ regla: "V8", detalle: `tiempo futuro (\xAB${m[0]}\xBB): los hechos son pasados` });
  }
  let s = quitar(t0, NEGACIONES_EXCEPTO[lengua]);
  const fin = finalDe(ctx);
  s = quitar(s, GOL_DECISIVO[lengua], (m) => {
    const ok = fin !== void 0 && ctx.hechos.some((x) => {
      if (x.tipo !== "gol_anotado") return false;
      const equipo = String(x.datos.equipo);
      const rival4 = [...fin.keys()].find((k) => k !== equipo);
      if (rival4 === void 0) return false;
      const gEq = fin.get(equipo);
      const gRiv = fin.get(rival4);
      if (gEq <= gRiv) return false;
      const [local] = nombresLocalVisita(x, ctx.partido);
      const marcadorEq = equipo === local ? x.datos.marcador_local : x.datos.marcador_visita;
      return marcadorEq === gRiv + 1;
    });
    if (!ok) h.push({ regla: "V8", detalle: `\xAB${m[0]}\xBB: ese gol no fue el que decidi\xF3 el partido` });
  });
  s = quitar(s, GOL_DEFINITIVO[lengua], (m) => {
    const ok = fin !== void 0 && ctx.hechos.some((x) => {
      if (x.tipo !== "gol_anotado") return false;
      const [local, visita] = nombresLocalVisita(x, ctx.partido);
      const ml = x.datos.marcador_local;
      const mv = x.datos.marcador_visita;
      const gl = fin.get(local);
      const gv = fin.get(visita);
      if (ml !== gl || mv !== gv || gl === void 0 || gv === void 0) return false;
      const equipo = String(x.datos.equipo);
      const ganador = gl > gv ? local : gv > gl ? visita : void 0;
      return ganador !== void 0 && ganador === equipo;
    });
    if (!ok) h.push({ regla: "V8", detalle: `\xAB${m[0]}\xBB: ese gol no fue el \xFAltimo del partido dejando al ganador por delante` });
  });
  if (ctx.hechos.some((x) => x.tipo === "autogol")) {
    const sigue = trasMeritoPropiaPuerta(lengua);
    for (const m of s.matchAll(new RegExp(MERITO[lengua].source, MERITO[lengua].flags))) {
      const tras = s.slice(m.index + m[0].length, m.index + m[0].length + 40);
      if (!sigue.test(tras)) h.push({ regla: "V8", detalle: `\xAB${m[0]}\xBB: el autogol no se le acredita a nadie como m\xE9rito (solo \xAB${m[0]} en propia puerta / own goal\xBB)` });
    }
  }
  s = quitar(s, palabras(PROPIA_PUERTA[lengua]), (m) => {
    if (!ctx.hechos.some((x) => x.tipo === "autogol")) h.push({ regla: "V8", detalle: `\xAB${m[0]}\xBB exige el hecho autogol como principal` });
  });
  for (const [def, fr] of Object.entries(FRASES_DEFINICION)) {
    s = quitar(s, palabras(fr[lengua]), (m) => {
      if (!ctx.hechos.some((x) => x.datos.definicion === def)) h.push({ regla: "V8", detalle: `\xAB${m[0]}\xBB: el hecho principal no registra la definici\xF3n ${def}` });
    });
  }
  s = quitar(s, FUERA_DEL_AREA[lengua], (m) => {
    if (!ctx.hechos.some((x) => typeof x.datos.distancia_m === "number" && x.datos.distancia_m >= FUERA_DEL_AREA_M))
      h.push({ regla: "V8", detalle: `\xAB${m[0]}\xBB: el hecho no registra un tiro desde ${FUERA_DEL_AREA_M} m o m\xE1s` });
  });
  s = quitar(s, MISIL[lengua], (m) => {
    if (!ctx.hechos.some((x) => typeof x.datos.velocidad_kmh === "number" && x.datos.velocidad_kmh >= MISIL_KMH))
      h.push({ regla: "V8", detalle: `\xAB${m[0]}\xBB: el hecho no registra un disparo de ${MISIL_KMH} km/h o m\xE1s` });
  });
  s = quitar(s, VALLA_INVICTA[lengua], (m) => {
    const equipos2 = ctx.hechos.map((x) => x.datos.equipo).filter((x) => typeof x === "string");
    const [a, b] = segmentoDe(s, m.index);
    const equipo = equipos2[0] ?? menciones(s, a, b, ctx.pl)[0]?.equipo;
    const rival4 = equipo && fin ? [...fin.keys()].find((k) => k !== equipo) : void 0;
    if (!(fin && rival4 !== void 0 && fin.get(rival4) === 0)) h.push({ regla: "V8", detalle: `\xAB${m[0]}\xBB: ${equipo ?? "el equipo"} recibi\xF3 goles` });
  });
  for (const e of [...INSOLITOS_JUICIO, ...GRADA_JUICIO, ...SANCION_CLUB_JUICIO, ...EFECTOS_CONDICION, ...CONSECUENCIAS]) {
    s = quitar(s, e[lengua], (m) => {
      if (!ctx.hechos.some((x) => e.habilita(x, marcadoresDe(x, ctx.partido)))) h.push({ regla: "V8", detalle: `\xAB${m[0]}\xBB: ${e.requisito}` });
    });
  }
  for (const f of FRANJAS) {
    s = quitar(s, f[lengua], (m) => {
      const ms = ctx.minutos;
      const ok = ms.length > 0 && ms.every(
        (x) => f.id === "tras_descanso" ? x > MINUTO_DESCANSO : f.id === "final" ? x >= FINAL_MIN : f.id === "temprano" ? x <= TEMPRANO_MAX : x > 90
      );
      if (!ok) h.push({ regla: "V8", detalle: `\xAB${m[0]}\xBB no coincide con los minutos del hecho (${ms.join(", ") || "sin minutos"})` });
    });
  }
  const ceros = equiposConCero(ctx);
  const negar = (re) => {
    s = quitar(s, re, (m) => {
      const i = m.index;
      const ventana = s.slice(i, i + m[0].length + 40);
      const deGoles = RAICES_GOL[lengua].test(ventana);
      if (deGoles) {
        const [a, b] = segmentoDe(s, i);
        const despues = menciones(s, i, Math.min(b, i + m[0].length + 40), ctx.pl)[0];
        const antes = menciones(s, a, i, ctx.pl).pop();
        const equipo = (despues ?? antes)?.equipo;
        if (equipo !== void 0 && ceros.has(equipo)) return;
      }
      h.push({ regla: "V7", detalle: `niega un suceso (\xAB${m[0]}\xBB): ning\xFAn hecho afirma esa ausencia` });
    });
  };
  negar(NEGACIONES[lengua]);
  negar(NEGACION_FREE);
  const verbos = VERBOS_RESULTADO[lengua];
  const r = ctx.resultado;
  const juzgar = (clase, m, texto2) => {
    const sujeto = sujetoDe(texto2, m.index, lengua, ctx.pl);
    const empateDeGol = ctx.hechos.some((x) => x.tipo === "gol_anotado" && typeof x.datos.marcador_local === "number" && x.datos.marcador_local === x.datos.marcador_visita);
    const ok = clase === "empata" ? r !== void 0 && r.empate || empateDeGol : r !== void 0 && !r.empate && sujeto !== void 0 && sujeto === (clase === "gana" ? r.ganador : r.perdedor);
    if (!ok) h.push({ regla: "V8", detalle: `\xAB${m[0]}\xBB${sujeto ? ` con sujeto ${sujeto}` : ""} no coincide con el resultado que afirma el hecho` });
  };
  let sv = quitar(s, verbos.excepto);
  sv = quitar(sv, verbos.pasiva, (m) => juzgar("pierde", m, sv));
  for (const [clase, re] of [["gana", verbos.gana], ["pierde", verbos.pierde], ["empata", verbos.empata]]) {
    for (const m of sv.matchAll(new RegExp(re.source, re.flags))) juzgar(clase, m, sv);
  }
  let w = quitar(s, SIEMPRE_RE[lengua]);
  for (const [frase, p] of FRASES_PERIODO[lengua]) {
    w = quitar(w, palabras([frase]), (m) => {
      if (!ctx.periodos.has(p)) h.push({ regla: "V3", detalle: `\xAB${m[0]}\xBB no coincide con el periodo del hecho` });
    });
  }
  w = quitar(w, INFERIORIDAD_RE[lengua], (m) => {
    if (!ctx.hechos.some((x) => x.tipo === "expulsion_y_efecto")) h.push({ regla: "V8", detalle: `\xAB${m[0]}\xBB exige una expulsi\xF3n como hecho principal` });
  });
  for (const [canal, re] of FRASES_CANAL[lengua]) {
    w = quitar(w, re, (m) => {
      if (!ctx.hechos.some((x) => x.datos.canal === canal)) h.push({ regla: "V8", detalle: `\xAB${m[0]}\xBB: el hecho principal no afirma ese canal (${canal})` });
    });
  }
  for (const e of JUICIO) {
    w = quitar(w, e[lengua], (m) => {
      if (!ctx.hechos.some((x) => e.habilita(x, marcadoresDe(x, ctx.partido)))) h.push({ regla: "V8", detalle: `\xAB${m[0]}\xBB: ${e.requisito}` });
    });
  }
  for (const re of MARGEN[lengua]) {
    w = quitar(w, re, (m) => {
      const v2 = valorMargen(m[1] ?? "", lengua);
      if (v2 === void 0 || !ctx.marcadores.some((mk) => Math.abs(mk.x - mk.y) === v2)) {
        h.push({ regla: "V3", detalle: `el margen \xAB${m[0]}\xBB no es la diferencia de ning\xFAn marcador del hecho` });
      }
    });
  }
  const conector = lengua === "es" ? "a" : "to";
  for (const m of w.matchAll(new RegExp(`(?<![\\d.,])(\\d+)(?:\\s*[\u2013\u2014-]\\s*|\\s+${conector}\\s+)(\\d+)(?![.,]?\\d)`, "gu"))) {
    const x = Number(m[1]);
    const y = Number(m[2]);
    if (x > MARCADOR_MAX_GOLES || y > MARCADOR_MAX_GOLES) continue;
    const i = m.index;
    const antes = w.slice(0, i).trimEnd();
    const despues = w.slice(i + m[0].length).trimStart();
    const A = ctx.pl.aliasOrdenados.find((n) => antes.endsWith(n) && !/[\p{L}]/u.test(antes[antes.length - n.length - 1] ?? ""));
    const B = ctx.pl.aliasOrdenados.find((n) => despues.startsWith(n) && !/[\p{L}]/u.test(despues[n.length] ?? ""));
    const eA = A ? ctx.pl.alias.get(A) : void 0;
    const eB = B ? ctx.pl.alias.get(B) : void 0;
    const ok = eA && eB ? ctx.marcadores.some((mk) => mk.a === eA && mk.b === eB && mk.x === x && mk.y === y || mk.a === eB && mk.b === eA && mk.x === y && mk.y === x) : ctx.marcadores.some((mk) => mk.x === x && mk.y === y || mk.x === y && mk.y === x);
    if (!ok) h.push({ regla: "V3", detalle: `el marcador \xAB${eA ? `${eA} ` : ""}${x}\u2013${y}${eB ? ` ${eB}` : ""}\xBB no es uno que el hecho afirme` });
  }
  const numeros = [];
  w = quitar(w, CUENTA_RE[lengua], (m) => {
    const v2 = CUENTA_GOLES[lengua][m[0].toLowerCase().replace(/\s+/g, " ")];
    numeros.push(String(v2));
    if (!ctx.hechos.some((x) => x.tipo === "doblete_o_mas" && x.datos.goles === v2)) {
      h.push({ regla: "V3", detalle: `\xAB${m[0]}\xBB (${v2} goles) no lo respalda un doblete_o_mas con ${v2} goles` });
    }
  });
  w = quitar(w, NUMEROS_RE[lengua], (m) => {
    const v2 = NUMEROS_EN_PALABRAS[lengua].get(m[0].toLowerCase().replace(/\s+/g, " ").replace(/\s*-\s*/g, "-"));
    if (v2 !== void 0) numeros.push(String(v2));
  });
  for (const m of w.matchAll(/\d+(?:[.,]\d+)?/g)) numeros.push(norm(m[0]));
  for (const n of new Set(numeros)) {
    if (!ctx.numeros.has(n)) h.push({ regla: "V3", detalle: `el n\xFAmero ${n} no est\xE1 en el hecho` });
  }
  let nombrados = 0;
  let v = quitar(w, GRADOS_C);
  for (const n of ctx.pl.nombres) {
    let i = v.indexOf(n);
    while (i >= 0) {
      if (!ctx.nombres.has(n)) h.push({ regla: "V4", detalle: `\xAB${n}\xBB no pertenece al hecho` });
      else nombrados++;
      v = borrar(v, i, n.length);
      i = v.indexOf(n, i + n.length);
    }
  }
  for (const m of t0.matchAll(/([^()]+?)\s*\(([^()]+)\)/g)) {
    const equipo = ctx.pl.alias.get(m[2].trim());
    if (!equipo) continue;
    const tramo = m[1].split(/[;:,.]/).pop();
    for (const parte of tramo.split(" / ")) {
      const jugador = [...ctx.pl.equipoDe.keys()].filter((n) => parte.trim().endsWith(n)).sort((a, b) => b.length - a.length)[0];
      if (jugador && ctx.pl.equipoDe.get(jugador) !== equipo) h.push({ regla: "V4", detalle: `\xAB${jugador} (${equipo})\xBB: ${jugador} juega en ${ctx.pl.equipoDe.get(jugador)}` });
    }
  }
  const corto = [...ctx.formasCortas].sort((a, b) => b.split(" ").length - a.split(" ").length);
  for (const m of v.matchAll(/(?<![\p{L}\p{N}'’-])[\p{Lu}\p{Lt}][\p{L}'’-]*(?:[ \t]+[\p{Lu}\p{Lt}][\p{L}'’-]*)*/gu)) {
    const tokens = m[0].split(/[ \t]+/).map((x) => x.replace(/['’]s$/u, "").replace(/['’]$/u, ""));
    const previo = v.slice(0, m.index).trimEnd();
    const abre = previo === "" || PUNTUACION_ABRE.has(previo[previo.length - 1]);
    let k = 0;
    while (k < tokens.length) {
      const forma = corto.find((c) => {
        const cs = c.split(" ");
        return cs.every((x, j) => tokens[k + j] === x);
      });
      if (forma) {
        nombrados++;
        k += forma.split(" ").length;
        continue;
      }
      const tok = tokens[k];
      const bajo = tok.toLowerCase();
      const funcional = FUNCIONALES[lengua].has(tok) || NUMEROS_EN_PALABRAS[lengua].has(bajo);
      if (k === 0 && abre && funcional || esTitulo && lengua === "en" && (TITULO_EN_COMUNES.has(bajo) || FUNCIONALES.en.has(tok))) {
        k++;
        continue;
      }
      h.push({ regla: "V4", detalle: `\xAB${tokens.slice(k).join(" ")}\xBB no es un nombre del hecho ni una palabra permitida` });
      break;
    }
  }
  const narra = nombrados > 0 || numeros.some((n) => ctx.numeros.has(n));
  return { hallazgos: h, numeros, narra };
}
function parsear(salida) {
  let t = salida.trim();
  const fence = t.match(/^```(?:json)?\s*\n([\s\S]*)\n```$/);
  if (fence) t = fence[1].trim();
  let json;
  try {
    json = JSON.parse(t);
  } catch (e) {
    return { draft: null, error: `no es JSON: ${e.message}` };
  }
  const r = esquemaDraft.safeParse(json);
  if (!r.success) return { draft: null, error: `no cumple el esquema: ${r.error.issues.map((i) => `${i.path.join(".") || "(ra\xEDz)"} ${i.message}`).join("; ")}` };
  return { draft: r.data };
}
function verificarPar(oracion, prefijo, es, en, ctx, esTitulo) {
  const motivos = [];
  const add = (regla, detalle) => motivos.push({ oracion, regla, detalle: `${prefijo}${detalle}` });
  if (es.trim() === "" || en.trim() === "") {
    add("V6", `${es.trim() === "" ? "el texto en espa\xF1ol" : "el texto en ingl\xE9s"} est\xE1 vac\xEDo`);
    return { motivos, narra: false };
  }
  const aes = analizarTexto(es, "es", ctx, esTitulo);
  const aen = analizarTexto(en, "en", ctx, esTitulo);
  const vistos = /* @__PURE__ */ new Set();
  for (const [lengua, a] of [["ES", aes], ["EN", aen]]) {
    for (const x of a.hallazgos) {
      const clave = `${x.regla}|${x.detalle}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      add(x.regla, `${x.detalle} (${lengua})`);
    }
  }
  const nes = [...aes.numeros].sort();
  const nen = [...aen.numeros].sort();
  if (nes.join(" ") !== nen.join(" ")) add("V6", `cifras ES [${nes.join(", ")}] \u2260 EN [${nen.join(", ")}]`);
  return { motivos, narra: aes.narra && aen.narra };
}
function hechosDelTitulo(draft, hechos, pl) {
  const titulo = normalizar(`${draft.titulo_es}
${draft.titulo_en}`);
  const jugadores = [...pl.equipoDe.keys()].filter((n) => titulo.includes(n) || titulo.includes(n.split(" ").slice(1).join(" ")));
  const out = hechos.filter((h) => h.tipo === "resultado_final");
  for (const h of hechos) if (!out.includes(h) && jugadores.some((j) => fuenteDe(h).includes(j))) out.push(h);
  return out;
}
function verificarDraft(draft, hechos, partido) {
  const motivos = [];
  const pl = plantel(partido);
  const porId = new Map(hechos.map((h) => [h.id, h]));
  motivos.push(...verificarPar(-1, "t\xEDtulo: ", draft.titulo_es, draft.titulo_en, contexto2(hechosDelTitulo(draft, hechos, pl), hechos, partido, pl), true).motivos);
  motivos.push(...verificarOraciones(draft.oraciones, hechos, partido));
  motivos.push(...cobertura(draft.oraciones, hechos));
  return motivos;
}
function verificarOraciones(oraciones, hechos, partido) {
  const motivos = [];
  const pl = plantel(partido);
  const porId = new Map(hechos.map((h) => [h.id, h]));
  oraciones.forEach((o, i) => {
    if (o.hecho.trim() === "") {
      motivos.push({ oracion: i, regla: "V2", detalle: "no tiene hecho principal" });
    } else if (!porId.has(o.hecho)) {
      motivos.push({ oracion: i, regla: "V2", detalle: `su hecho principal ${o.hecho} no existe` });
    }
    for (const id of o.apoyo ?? []) if (!porId.has(id)) motivos.push({ oracion: i, regla: "V2", detalle: `cita de apoyo ${id}, que no existe` });
    const principal = porId.get(o.hecho);
    const ctx = contexto2(principal ? [principal] : [], hechos, partido, pl);
    const r = verificarPar(i, "", o.texto_es, o.texto_en, ctx, false);
    motivos.push(...r.motivos);
    if (principal && !r.narra && !r.motivos.some((m) => m.regla === "V6")) {
      motivos.push({ oracion: i, regla: "V5", detalle: `no narra su hecho principal ${principal.id} (no nombra a nadie ni dice ninguna cifra suya)` });
    }
  });
  return motivos;
}
function cobertura(oraciones, hechos) {
  const narrados = new Set(oraciones.map((o) => o.hecho));
  return hechos.filter((h) => h.relevancia >= COBERTURA && !narrados.has(h.id)).map((h) => ({
    oracion: -1,
    regla: "V5",
    detalle: `ninguna oraci\xF3n narra ${h.id} (${h.tipo}, relevancia ${h.relevancia}) como hecho principal`
  }));
}
function verificar(salida, hechos, partido) {
  const { draft, error } = parsear(salida);
  if (!draft) return { draft: null, motivos: [{ oracion: -1, regla: "V1", detalle: error ?? "salida ilegible" }] };
  return { draft, motivos: verificarDraft(draft, hechos, partido) };
}
function oracionesRechazadas(motivos) {
  return new Set(motivos.filter((m) => m.oracion >= 0).map((m) => m.oracion));
}
function tituloRechazado(motivos) {
  return motivos.some((m) => m.oracion === -1 && m.detalle.startsWith("t\xEDtulo: "));
}

// src/cadena/cadena.ts
function guardaDeEntrada(partido) {
  validarConfig(partido.config);
  const problemas = Object.entries(VERIFICADORES).flatMap(([nombre, v]) => v(partido).map((e) => `${nombre}: ${e}`));
  if (problemas.length > 0) {
    throw new Error(`Partido inv\xE1lido (guarda de entrada): ${problemas.slice(0, 5).join(" | ")}${problemas.length > 5 ? ` (+${problemas.length - 5})` : ""}`);
  }
}
var BORRADOR_VACIO = { titulo_es: "", titulo_en: "", oraciones: [] };
function asegurarVerificada(c, hechos, partido) {
  const motivos = verificarDraft(c, hechos, partido);
  if (motivos.length > 0) {
    throw new Error(`error de programa: la cr\xF3nica final no pasa el Verificador: ${motivos.map((m) => `${m.regla} ${m.detalle}`).join(" | ")}`);
  }
  return c;
}
function guardarEnCache(cache, clave, hechos, cronica) {
  try {
    cache?.escribir(clave, hechos, cronica);
  } catch {
  }
}
function acta(hechos, intentos, audit) {
  return { ...borradorActa(hechos), intentos, frasesOmitidas: 0, modo: "acta", audit };
}
async function generarCronica(partido, opciones) {
  guardaDeEntrada(partido);
  const modoPersonalizacion = opciones.modoPersonalizacion ?? "neutral";
  const hechos = repriorizar(analizar(partido), modoPersonalizacion, partido);
  const perspectiva = instruccionPerspectiva(modoPersonalizacion, partido);
  if (opciones.forzarActa) {
    return { cronica: asegurarVerificada(acta(hechos, 0, []), hechos, partido), hechos, desdeCache: false };
  }
  const llm = opciones.llm;
  if (!llm) throw new Error("generarCronica: falta el LLM (solo el acta forzada puede correr sin \xE9l)");
  const clave = { seed: partido.config.seed, deployment: llm.id, modo: modoPersonalizacion };
  const cacheada = opciones.cache?.leer(clave, hechos);
  if (cacheada && verificarDraft(cacheada, hechos, partido).length === 0) return { cronica: cacheada, hechos, desdeCache: true };
  const audit = [];
  const mensajes = [{ rol: "user", contenido: mensajeInicial(hechos, perspectiva) }];
  let ultimo = { draft: null, motivos: [] };
  let huboErrorLlm = false;
  for (let n = 1; n <= 1 + MAX_REINTENTOS; n++) {
    let salida = "";
    let errorLlm;
    try {
      salida = await llm.completar(SYSTEM_PROMPT, mensajes);
    } catch (e) {
      errorLlm = e.message;
      huboErrorLlm = true;
    }
    ultimo = errorLlm !== void 0 ? { draft: null, motivos: [{ oracion: -1, regla: "V1", detalle: `el LLM fall\xF3: ${errorLlm}` }] } : verificar(salida, hechos, partido);
    const intento = { n, borrador: ultimo.draft ?? BORRADOR_VACIO, veredicto: ultimo.motivos };
    if (!ultimo.draft) intento.crudo = salida;
    audit.push(intento);
    if (ultimo.motivos.length === 0 && ultimo.draft) {
      const cronica2 = asegurarVerificada({ ...ultimo.draft, intentos: n, frasesOmitidas: 0, modo: "llm", audit }, hechos, partido);
      if (!huboErrorLlm) guardarEnCache(opciones.cache, clave, hechos, cronica2);
      return { cronica: cronica2, hechos, desdeCache: false };
    }
    if (n <= MAX_REINTENTOS && errorLlm === void 0) {
      const fb = feedback(ultimo.motivos);
      intento.feedback = fb;
      mensajes.push({ rol: "assistant", contenido: salida }, { rol: "user", contenido: fb });
    }
  }
  const intentos = audit.length;
  let base = ultimo.draft ? { draft: ultimo.draft, motivos: ultimo.motivos } : void 0;
  if (!base) {
    const costo = (a) => {
      const rechazadas = oracionesRechazadas(a.veredicto);
      const sinNarrar = cobertura(a.borrador.oraciones.filter((_, i) => !rechazadas.has(i)), hechos).length;
      return { total: rechazadas.size + sinNarrar, sinNarrar };
    };
    const previos = audit.filter((a) => a.borrador.oraciones.length > 0 && !a.veredicto.some((m) => m.regla === "V1"));
    const mejor = previos.reduce((acc, a) => {
      if (acc === void 0) return a;
      const ca = costo(a);
      const cb = costo(acc);
      if (ca.total !== cb.total) return ca.total < cb.total ? a : acc;
      if (ca.sinNarrar !== cb.sinNarrar) return ca.sinNarrar < cb.sinNarrar ? a : acc;
      return a;
    }, void 0);
    if (mejor) base = { draft: mejor.borrador, motivos: mejor.veredicto };
  }
  let cronica;
  if (base) {
    const rechazadas = oracionesRechazadas(base.motivos);
    const quedan = base.draft.oraciones.filter((_, i) => !rechazadas.has(i));
    const titulo = tituloRechazado(base.motivos) ? tituloActa(hechos) : { titulo_es: base.draft.titulo_es, titulo_en: base.draft.titulo_en };
    if (quedan.length > 0 && cobertura(quedan, hechos).length === 0) {
      cronica = { ...titulo, oraciones: quedan, intentos, frasesOmitidas: rechazadas.size, modo: "llm", audit };
    } else {
      cronica = acta(hechos, intentos, audit);
    }
  } else {
    cronica = acta(hechos, intentos, audit);
  }
  cronica = asegurarVerificada(cronica, hechos, partido);
  if (!huboErrorLlm) guardarEnCache(opciones.cache, clave, hechos, cronica);
  return { cronica, hechos, desdeCache: false };
}

// src/sim/plantillas.ts
var PREFIJOS = ["Atl\xE9tico", "Deportivo", "Uni\xF3n", "Sporting", "Racing", "Club", "Ol\xEDmpico", "Juventud"];
var LUGARES = [
  "Torreluna",
  "Pradoalto",
  "Marisal",
  "Ventolera",
  "Nebrisa",
  "Valdecristal",
  "Solcanto",
  "Brezal",
  "Ormidia",
  "Arenablanca",
  "Puertoscuro",
  "Caleteo",
  "Lumbrera",
  "Quebralta",
  "Islaverde Sur",
  "Montefr\xEDo Bajo"
];
var NOMBRES = [
  "Mateo",
  "Iker",
  "Thiago",
  "Bruno",
  "Dante",
  "Leo",
  "Joel",
  "Nico",
  "Ramiro",
  "Tom\xE1s",
  "El\xEDas",
  "Gael",
  "Sim\xF3n",
  "Ulises",
  "Fabio",
  "Hugo",
  "Aar\xF3n",
  "Ciro",
  "Emilio",
  "Lucio",
  "Owen",
  "Rafael",
  "Teo",
  "Vicente",
  "Adri\xE1n",
  "Benja",
  "Dar\xEDo",
  "Germ\xE1n",
  "Ismael",
  "Marco"
];
var SILABAS_INICIO = ["Bar", "Cel", "Dor", "Fen", "Gal", "Lor", "Mar", "Nev", "Or", "Pal", "Quin", "Ros", "Tor", "Val", "Zar", "Brel", "Cast", "Mend", "Sor", "Ulv"];
var SILABAS_MEDIO = ["", "a", "e", "i", "o", "ar", "el", "in"];
var SILABAS_FIN = ["ena", "ido", "ales", "\xF3n", "ueta", "era", "ino", "ardi", "osa", "ell", "\xE1nez", "oya", "ich", "uz"];
var ESTILOS = ["posesion", "contragolpe", "presion"];
var POSICIONES = [
  "POR",
  "DEF",
  "DEF",
  "DEF",
  "DEF",
  "MED",
  "MED",
  "MED",
  "DEL",
  "DEL",
  "DEL",
  "POR",
  "DEF",
  "MED",
  "MED",
  "DEL"
];
function apellido(rng) {
  return rng.pick(SILABAS_INICIO) + rng.pick(SILABAS_MEDIO) + rng.pick(SILABAS_FIN);
}
function generarPlantilla(rng, usados = /* @__PURE__ */ new Set()) {
  const dorsalesTitulares = [1, 2, 3, 4, 5, 6, 8, 10, 7, 9, 11];
  const dorsalesSuplentes = [13, 14, 15, 16, 17];
  const dorsales = [...dorsalesTitulares, ...dorsalesSuplentes];
  return POSICIONES.map((posicion, i) => {
    let nombre = "";
    do {
      nombre = `${rng.pick(NOMBRES)} ${apellido(rng)}`;
    } while (usados.has(nombre));
    usados.add(nombre);
    return { nombre, dorsal: dorsales[i], posicion };
  });
}
function generarEquipo(rng, opciones = {}, usados = /* @__PURE__ */ new Set()) {
  const nombre = opciones.nombre ?? `${rng.pick(PREFIJOS)} ${rng.pick(LUGARES)}`;
  const ataque = opciones.ataque ?? rng.int(55, 85);
  const defensa = opciones.defensa ?? rng.int(55, 85);
  const estilo = opciones.estilo ?? rng.pick(ESTILOS);
  return { nombre, ataque, defensa, estilo, jugadores: generarPlantilla(rng, usados) };
}
var SAL_PLANTILLAS = 2654435769;
function configDeSemilla(seed, local = {}, visita = {}) {
  const rng = crearRng((normalizarSeed(seed) ^ SAL_PLANTILLAS) >>> 0);
  const usados = /* @__PURE__ */ new Set();
  const eqLocal = generarEquipo(rng, local, usados);
  let eqVisita = generarEquipo(rng, visita, usados);
  while (eqVisita.nombre === eqLocal.nombre && visita.nombre === void 0) {
    eqVisita = { ...eqVisita, nombre: `${rng.pick(PREFIJOS)} ${rng.pick(LUGARES)}` };
  }
  return { seed: normalizarSeed(seed), local: eqLocal, visita: eqVisita };
}

// src/eval/umbrales-eval.ts
var EVAL_SEMILLAS = [246, 116, 834, 289, 1, 3, 4, 5, 7, 8, 10, 11, 12, 19, 22, 23, 27, 32, 34, 40];
var CARACTERES_POR_TOKEN = 4;
var PRECIO_USD_POR_MTOK = {
  stub: 0,
  ensayo: 0
};

// src/eval/eval.ts
var frasesConHallazgo = (ms) => new Set(ms.filter((m) => m.oracion >= 0).map((m) => m.oracion)).size;
function contador(llm) {
  let n = 0;
  return {
    llm: {
      id: llm.id,
      async completar(system, mensajes) {
        n += system.length + mensajes.reduce((s, m) => s + m.contenido.length, 0);
        const r = await llm.completar(system, mensajes);
        n += r.length;
        return r;
      }
    },
    total: () => n
  };
}
async function correrEval(llmBase, semillas = EVAL_SEMILLAS) {
  const filas = [];
  for (const seed of semillas) {
    const partido = simular(configDeSemilla(seed));
    guardaDeEntrada(partido);
    const hechos = analizar(partido);
    const goles = partido.eventos.filter((e) => e.tipo === "gol");
    const marcador = `${goles.filter((e) => e.equipo === "local").length}\u2013${goles.filter((e) => e.equipo === "visita").length}`;
    const { llm, total } = contador(llmBase);
    const salida = await llm.completar(SYSTEM_PROMPT, [{ rol: "user", contenido: mensajeInicial(hechos) }]);
    const juicio = verificar(salida, hechos, partido);
    const parseo = juicio.draft !== null;
    const baselineFrases = parseo ? juicio.draft?.oraciones.length ?? 0 : 1;
    const baselineConHallazgos = parseo ? frasesConHallazgo(juicio.motivos) : 1;
    const { cronica } = await generarCronica(partido, { llm });
    const publicado = verificarDraft(cronica, hechos, partido);
    filas.push({
      seed,
      marcador,
      baselineFrases,
      baselineConHallazgos,
      baselineReglas: [...new Set(juicio.motivos.map((m) => m.regla))].sort(),
      pipelineFrases: cronica.oraciones.length,
      pipelineConHallazgos: frasesConHallazgo(publicado),
      pipelineModo: cronica.modo,
      pipelineIntentos: cronica.intentos,
      caracteres: total()
    });
  }
  const suma = (k) => filas.reduce((s, f) => s + f[k], 0);
  const bf = suma("baselineFrases");
  const bh = suma("baselineConHallazgos");
  const tokens = Math.round(suma("caracteres") / CARACTERES_POR_TOKEN);
  const precio = PRECIO_USD_POR_MTOK[llmBase.id.split(":")[0]];
  return {
    llm: llmBase.id,
    filas,
    baselineFrases: bf,
    baselineConHallazgos: bh,
    pipelineFrases: suma("pipelineFrases"),
    pipelineConHallazgos: suma("pipelineConHallazgos"),
    porcentaje: bf === 0 ? 0 : Math.round(bh * 1e3 / bf) / 10,
    tokensEstimados: tokens,
    costoUsd: precio === void 0 ? void 0 : tokens / 1e6 * precio
  };
}
var titular = (r) => `${r.porcentaje.toFixed(1)}% of unverified sentences contained unsupported claims; the pipeline published ${r.pipelineConHallazgos}.`;
function informe(r) {
  const ensayo = r.llm === "ensayo" || r.llm === "stub";
  const l = [];
  l.push(`# CRONISTA eval \u2014 single agent vs pipeline`);
  l.push("");
  if (ensayo) {
    l.push(`> **${r.llm.toUpperCase()} RUN \u2014 NOT the headline figure.** The \`${r.llm}\` backend is a test fixture${r.llm === "ensayo" ? " that plants one deliberate error per chronicle" : ""}; this sample only proves the harness is deterministic and the pipeline publishes nothing unverified. The README figure comes from the real LLM.`);
    l.push("");
  }
  l.push(`Backend: \`${r.llm}\` \xB7 ${r.filas.length} fixed seeds (src/eval/umbrales-eval.ts) \xB7 judge: the existing Verifier (rules V1\u2013V8), unchanged.`);
  l.push("");
  l.push(`**${titular(r)}**`);
  l.push("");
  l.push("| Seed | Score | Single agent: sentences | with findings | % | rules | Pipeline: sentences | with findings | mode \xB7 attempts |");
  l.push("|---:|:---:|---:|---:|---:|:---|---:|---:|:---|");
  for (const f of r.filas) {
    const pct3 = f.baselineFrases === 0 ? 0 : Math.round(f.baselineConHallazgos * 1e3 / f.baselineFrases) / 10;
    l.push(
      `| ${f.seed} | ${f.marcador} | ${f.baselineFrases} | ${f.baselineConHallazgos} | ${pct3.toFixed(1)} | ${f.baselineReglas.join(", ") || "\u2014"} | ${f.pipelineFrases} | ${f.pipelineConHallazgos} | ${f.pipelineModo} \xB7 ${f.pipelineIntentos} |`
    );
  }
  l.push(`| **Total** | | **${r.baselineFrases}** | **${r.baselineConHallazgos}** | **${r.porcentaje.toFixed(1)}** | | **${r.pipelineFrases}** | **${r.pipelineConHallazgos}** | |`);
  l.push("");
  l.push(
    `Estimated tokens: ${r.tokensEstimados.toLocaleString("en-US")} (\u2248 ${CARACTERES_POR_TOKEN} characters per token, both arms) \xB7 estimated cost: ${r.costoUsd === void 0 ? "price not set for this backend yet" : `$${r.costoUsd.toFixed(2)}`}.`
  );
  return `${l.join("\n")}
`;
}
export {
  correrEval,
  informe,
  titular
};
