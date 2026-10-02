// Léxicos del Verificador (brief 003, revisión 3.1). Junto a umbrales.ts y con el mismo
// estatus: las pruebas los importan; ninguna prueba repite estas listas a mano.
//
// Controlamos los idiomas (ES/EN) y controlamos el prompt: por eso estas listas pueden
// ser cerradas. Lo que no está aquí, el Verificador no lo deja pasar.

import type { Hecho } from "../analista/tipos";
import { GOLEADA_MARGEN_MIN } from "./umbrales";

export type Lengua = "es" | "en";

// ---------------------------------------------------------------------------------
// Utilidades de expresiones regulares con límites de palabra Unicode (\b de JS es ASCII).
// ---------------------------------------------------------------------------------

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** RegExp global que encuentra cualquiera de las expresiones como palabra(s) completa(s). */
export function palabras(alternativas: readonly string[], extra = ""): RegExp {
  const alts = [...alternativas].sort((a, b) => b.length - a.length).map((a) => escapar(a).replace(/ /g, "\\s+"));
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alts.join("|")})${extra}(?![\\p{L}\\p{N}])`, "giu");
}

// ---------------------------------------------------------------------------------
// Números en palabras 0–99 (V3/V6). Se EXCLUYEN un/una/uno/one/a/an: son también
// artículos y pronombres («marcó un gol») y producirían falsos positivos constantes.
// El «un gol de diferencia» se verifica aparte (MARGEN).
// ---------------------------------------------------------------------------------

const UNIDADES_ES = ["cero", "", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const DIEZ_A_DIECINUEVE_ES: Record<string, number> = {
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  "dieciséis": 16, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
};
const VEINTI_ES: Record<string, number> = {
  veinte: 20, veintiuno: 21, "veintiún": 21, veintiun: 21, veintiuna: 21, "veintidós": 22, veintidos: 22,
  "veintitrés": 23, veintitres: 23, veinticuatro: 24, veinticinco: 25, "veintiséis": 26, veintiseis: 26,
  veintisiete: 27, veintiocho: 28, veintinueve: 29,
};
const DECENAS_ES: Record<string, number> = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };

const UNIDADES_EN = ["zero", "", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const DIEZ_A_DIECINUEVE_EN: Record<string, number> = {
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const DECENAS_EN: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

function construirNumeros(): Record<Lengua, Map<string, number>> {
  const es = new Map<string, number>();
  const en = new Map<string, number>();
  UNIDADES_ES.forEach((w, n) => w && es.set(w, n));
  for (const [w, n] of Object.entries(DIEZ_A_DIECINUEVE_ES)) es.set(w, n);
  for (const [w, n] of Object.entries(VEINTI_ES)) es.set(w, n);
  for (const [w, n] of Object.entries(DECENAS_ES)) {
    es.set(w, n);
    for (const [u, k] of [["uno", 1], ["un", 1], ["una", 1], ...UNIDADES_ES.map((x, i) => [x, i] as const).slice(2)] as [string, number][]) {
      es.set(`${w} y ${u}`, n + k);
    }
  }
  UNIDADES_EN.forEach((w, n) => w && en.set(w, n));
  for (const [w, n] of Object.entries(DIEZ_A_DIECINUEVE_EN)) en.set(w, n);
  for (const [w, n] of Object.entries(DECENAS_EN)) {
    en.set(w, n);
    for (const [u, k] of [["one", 1], ...UNIDADES_EN.map((x, i) => [x, i] as const).slice(2)] as [string, number][]) {
      en.set(`${w}-${u}`, n + k);
      en.set(`${w} ${u}`, n + k);
    }
  }
  // Ordinales 1º–20º y decenas (V3: «su tercer gol» afirma un 3; rev. 3.2: completos).
  const ORD_ES_BASE: [string, number][] = [
    ["primer", 1], ["primero", 1], ["segundo", 2], ["tercer", 3], ["tercero", 3], ["cuarto", 4], ["quinto", 5], ["sexto", 6],
    ["séptimo", 7], ["septimo", 7], ["octavo", 8], ["noveno", 9], ["décimo", 10], ["decimo", 10], ["undécimo", 11], ["undecimo", 11],
    ["onceavo", 11], ["duodécimo", 12], ["duodecimo", 12], ["doceavo", 12], ["decimotercer", 13], ["decimotercero", 13],
    ["decimocuarto", 14], ["decimoquinto", 15], ["decimosexto", 16], ["decimoséptimo", 17], ["decimoseptimo", 17],
    ["decimoctavo", 18], ["decimonoveno", 19], ["decimonono", 19], ["vigésimo", 20], ["vigesimo", 20], ["trigésimo", 30],
    ["cuadragésimo", 40], ["quincuagésimo", 50], ["sexagésimo", 60], ["septuagésimo", 70], ["octogésimo", 80], ["nonagésimo", 90],
  ];
  for (const [w, n] of ORD_ES_BASE) {
    es.set(w, n);
    if (w.endsWith("o")) es.set(`${w.slice(0, -1)}a`, n); // femenino: primera, tercera, undécima…
  }
  const ORD_EN_UNIDADES: [string, number][] = [
    ["first", 1], ["second", 2], ["third", 3], ["fourth", 4], ["fifth", 5], ["sixth", 6], ["seventh", 7], ["eighth", 8], ["ninth", 9],
  ];
  const ORD_EN: [string, number][] = [
    ...ORD_EN_UNIDADES, ["tenth", 10], ["eleventh", 11], ["twelfth", 12], ["thirteenth", 13], ["fourteenth", 14], ["fifteenth", 15],
    ["sixteenth", 16], ["seventeenth", 17], ["eighteenth", 18], ["nineteenth", 19], ["twentieth", 20], ["thirtieth", 30],
    ["fortieth", 40], ["fiftieth", 50], ["sixtieth", 60], ["seventieth", 70], ["eightieth", 80], ["ninetieth", 90],
  ];
  for (const [w, n] of ORD_EN) en.set(w, n);
  for (const [d, n] of Object.entries(DECENAS_EN)) for (const [u, k] of ORD_EN_UNIDADES) en.set(`${d}-${u}`, n + k);
  // Cantidades léxicas (rev. 3.2: dos veces / twice / por partida doble, decena).
  for (const [w, n] of [
    ["docena", 12], ["media docena", 6], ["decena", 10], ["veintena", 20], ["par", 2], ["par de", 2], ["ambos", 2], ["ambas", 2],
    ["los dos", 2], ["las dos", 2], ["por partida doble", 2], ["por partida triple", 3],
  ] as [string, number][]) es.set(w, n);
  for (const [w, n] of [["dozen", 12], ["half a dozen", 6], ["pair", 2], ["couple", 2], ["both", 2], ["twice", 2], ["thrice", 3]] as [string, number][]) en.set(w, n);
  return { es, en };
}

/** Palabra(s) → número, por lengua (0–99, ordinales, docena/par/ambos…). */
export const NUMEROS_EN_PALABRAS = construirNumeros();

/**
 * Palabras de CUENTA DE GOLES de un jugador: valen su número (V6) y además solo son
 * ciertas si el hecho las respalda: un hecho `doblete_o_mas` con exactamente esos goles.
 */
export const CUENTA_GOLES: Record<Lengua, Record<string, number>> = {
  es: { doblete: 2, triplete: 3, "póker": 4, "póquer": 4, poker: 4, repoker: 5, "repóker": 5 },
  en: { brace: 2, "hat-trick": 3, "hat trick": 3, hattrick: 3 },
};

// ---------------------------------------------------------------------------------
// Frases fijas que se quitan ANTES de contar números. Cada una tiene una condición:
// - siempre: expresiones del fútbol cuyo número no es un dato del partido («los 90
//   minutos», «one-two» = pared, «ambos equipos»).
// - periodo: «primer/segundo tiempo», «first/second half»… solo si el periodo del
//   hecho principal coincide (por `datos.periodo` o por el minuto del hecho).
// - expulsión: «con diez», «ten men» solo si el hecho principal es una expulsión.
// - V8 se ocupa de «segunda/doble amarilla» y «roja directa» (ver JUICIO).
// ---------------------------------------------------------------------------------

export const FRASES_SIEMPRE: Record<Lengua, string[]> = {
  es: ["los 90 minutos", "los noventa minutos", "90 minutos", "ambos equipos", "ambos conjuntos", "los dos equipos", "ambas escuadras"],
  en: ["the 90 minutes", "the full 90", "90 minutes", "one-two", "both teams", "both sides"],
};

export const FRASES_PERIODO: Record<Lengua, [string, 1 | 2][]> = {
  es: [["primer tiempo", 1], ["primera parte", 1], ["primera mitad", 1], ["segundo tiempo", 2], ["segunda parte", 2], ["segunda mitad", 2], ["complemento", 2]],
  en: [["first half", 1], ["second half", 2]],
};

export const FRASES_INFERIORIDAD: Record<Lengua, string[]> = {
  es: ["con diez", "con diez hombres", "con diez jugadores", "con uno menos", "en inferioridad"],
  en: ["ten men", "with ten", "a man down", "down to ten"],
};

// ---------------------------------------------------------------------------------
// MARGEN — «por un gol de diferencia», «by a single goal», «two-goal lead»: el número
// dicho debe ser la diferencia de algún marcador del hecho principal.
// ---------------------------------------------------------------------------------

export const MARGEN: Record<Lengua, RegExp[]> = {
  es: [
    /(?<![\p{L}\p{N}])(?:por|con)\s+(un|una|uno|\p{L}+|\d+)\s+(?:solo\s+|sólo\s+|único\s+)?gol(?:es)?\s+de\s+diferencia(?![\p{L}\p{N}])/giu,
    /(?<![\p{L}\p{N}])(un|una|\p{L}+|\d+)\s+gol(?:es)?\s+de\s+(?:diferencia|ventaja)(?![\p{L}\p{N}])/giu,
    /(?<![\p{L}\p{N}])por\s+la\s+(m[ií]nima)(?![\p{L}\p{N}])/giu,
  ],
  en: [
    /(?<![\p{L}\p{N}])by\s+(a\s+single|a|one|single|\p{L}+|\d+)\s+(?:clear\s+)?goals?(?![\p{L}\p{N}])/giu,
    /(?<![\p{L}\p{N}])(one|\p{L}+|\d+)-goal\s+(?:margin|lead|win|victory|cushion)(?![\p{L}\p{N}])/giu,
    /(?<![\p{L}\p{N}])(narrowly)(?![\p{L}\p{N}])/giu,
  ],
};

/** Valor de la palabra capturada por MARGEN (un/one/a single/la mínima/narrowly ⇒ 1). */
export function valorMargen(captura: string, lengua: Lengua): number | undefined {
  const w = captura.toLowerCase().replace(/\s+/g, " ").trim();
  if (["un", "una", "uno", "one", "a", "a single", "single", "mínima", "minima", "narrowly"].includes(w)) return 1;
  if (/^\d+$/.test(w)) return Number(w);
  return NUMEROS_EN_PALABRAS[lengua].get(w);
}

// ---------------------------------------------------------------------------------
// V7 — negaciones: ningún hecho afirma ausencias.
// ---------------------------------------------------------------------------------

export const NEGACIONES: Record<Lengua, RegExp> = {
  es: palabras([
    "sin", "no hubo", "no hay", "no hizo", "no tuvo", "no logró", "no pudo", "no marcó", "no recibió", "ni", "ningún", "ninguna", "ninguno",
    "nadie", "nunca", "jamás", "tampoco",
    // rev. 3.2
    "no ganó", "no perdió", "no empató", "no anotó", "no respondió", "no descontó", "libre de", "libres de", "sin victoria", "sin ganar",
    "no se registró", "no se registraron", "no se produjo", "no se produjeron", "no se vio", "no se vieron", "no existió", "no existieron",
  ]),
  en: palabras([
    "without", "none", "never", "nobody", "nor", "neither", "not a single", "failed to", "did not", "didn't", "could not", "couldn't", "no goals", "no goal",
    "no shots", "no shot", "no penalties", "no penalty", "no cards", "no card", "no red", "no yellow", "no saves", "no chances", "no corners",
    // rev. 3.2
    "unable to", "failed to win", "winless", "was not", "were not", "wasn't", "weren't", "no reply",
  ]),
};

/** Rev. 3.2: «penalty-free», «card-free»… (cualquier palabra terminada en -free) también niega. */
export const NEGACION_FREE = /(?<![\p{L}\p{N}])\p{L}+-free(?![\p{L}\p{N}])/giu;

/**
 * V7 con respaldo (rev. 3.2): una negación sobre GOLES («sin que A respondiera», «A no
 * marcó», «could not respond») se acepta si los datos del hecho principal afirman ese
 * cero para ese equipo. Estas raíces, cerca de la negación, la marcan como «de goles».
 */
export const RAICES_GOL: Record<Lengua, RegExp> = {
  es: /(?<![\p{L}])(respond|replic|reaccion|descont|marc|anot|gol)\p{L}*/iu,
  en: /(?<![\p{L}])(respond|repl|hit back|scor|net)\p{L}*/iu,
};
/** «sin embargo» (sin = conector, no niega un evento). */
export const NEGACIONES_EXCEPTO: Record<Lengua, RegExp> = { es: palabras(["sin embargo"]), en: palabras(["nevertheless"]) };

// ---------------------------------------------------------------------------------
// V8 — vocabulario de juicio: el color que el Cronista puede usar es el que los hechos
// pagan. Cada entrada: qué palabras, y qué hecho principal las habilita.
// ---------------------------------------------------------------------------------

/** Marcadores (equipo, goles a favor, goles en contra) que un hecho afirma. */
export interface Marcador {
  a: string; // equipo
  b: string; // rival
  x: number; // goles de a
  y: number; // goles de b
}

export interface EntradaJuicio {
  id: string;
  es: RegExp;
  en: RegExp;
  /** ¿El hecho principal habilita estas palabras? */
  habilita: (h: Hecho, marcadores: Marcador[]) => boolean;
  /** Explicación para el feedback. */
  requisito: string;
}

const margenMax = (ms: Marcador[]) => Math.max(-1, ...ms.map((m) => Math.abs(m.x - m.y)));

export const JUICIO: EntradaJuicio[] = [
  {
    id: "dominio",
    es: palabras(["dominó", "dominio", "dominador", "dominadora", "dominante", "dominaron"]),
    en: palabras(["dominated", "dominance", "dominant", "dominating"]),
    // Brief 013: también el dominio_global (posesión computada desde la capa micro).
    habilita: (h) => h.tipo === "dominio_periodo" || h.tipo === "dominio_global",
    requisito: "solo un hecho dominio_periodo o dominio_global habilita «dominó / dominated»",
  },
  {
    // Brief 013: el léxico de regate SOLO con duelo_ganado como principal.
    id: "regate",
    es: palabras(["dribló", "driblaba", "regateó", "regateaba", "se fue de", "lo dejó atrás", "la dejó atrás", "dejó atrás", "lo desbordó", "desbordó"]),
    en: palabras(["dribbled past", "dribbled", "beat his man", "beats his man", "skipped past", "skips past", "went past", "got past", "left him for dead"]),
    habilita: (h) => h.tipo === "duelo_ganado",
    requisito: "«dribló / beat his man / skipped past» exige el hecho duelo_ganado como principal",
  },
  {
    // Brief 013: «se desangró por / bled down» SOLO con perdidas_en_salida como principal.
    id: "desangro",
    es: palabras(["se desangró por", "se desangró", "se desangraba", "sangró por"]),
    en: palabras(["bled down", "bleeding down", "bled possession", "haemorrhaged", "hemorrhaged"]),
    habilita: (h) => h.tipo === "perdidas_en_salida",
    requisito: "«se desangró por / bled down» exige el hecho perdidas_en_salida como principal",
  },
  {
    id: "merecimiento",
    es: palabras(["mereció", "merecía", "merecido", "merecida", "merecimiento", "merecidamente", "justo ganador"]),
    en: palabras(["deserved", "deserving", "deservedly", "deserve"]),
    habilita: (h) => h.tipo === "justicia_xg",
    requisito: "solo un hecho justicia_xg habilita «mereció / deserved»",
  },
  {
    id: "contra_la_corriente",
    es: palabras(["contra la corriente", "con menos xg", "menos xg"]),
    en: palabras(["against the run of play", "with less xg", "less xg"]),
    habilita: (h) => h.tipo === "justicia_xg" && h.datos.contra_la_corriente === "si",
    requisito: "«contra la corriente / menos xG» exige justicia_xg con contra_la_corriente = si",
  },
  {
    id: "mas_xg",
    es: palabras(["con más xg", "más xg", "mayor xg"]),
    en: palabras(["with more xg", "more xg", "higher xg"]),
    habilita: (h) => h.tipo === "justicia_xg" && h.datos.contra_la_corriente === "no" && h.datos.goles_local !== h.datos.goles_visita,
    requisito: "«más xG» exige justicia_xg con un ganador que NO fue contra la corriente",
  },
  {
    id: "goleada",
    es: palabras(["goleada", "goleó", "golea", "golear", "goleador de la tarde"]),
    en: palabras(["thrashed", "thrash", "thrashes", "thrashing", "rout", "routed", "routs", "hammered", "hammering"]),
    habilita: (_h, ms) => margenMax(ms) >= GOLEADA_MARGEN_MIN,
    requisito: `«goleada / rout» exige un marcador del hecho con margen ≥ ${GOLEADA_MARGEN_MIN}`,
  },
  {
    id: "remontada",
    es: palabras(["remontó", "remontada", "remontar", "remontaron", "dio vuelta", "dio la vuelta", "levantó el partido", "dio vuelta el partido", "le dio la vuelta"]),
    en: palabras(["came back", "comeback", "come-from-behind", "turned it around", "turned the game around", "fought back", "turned the tide", "turned the match around"]),
    habilita: (h) => h.tipo === "remontada",
    requisito: "solo un hecho remontada habilita «remontó / comeback»",
  },
  {
    id: "doble_amarilla",
    es: palabras(["doble amarilla", "segunda amarilla", "dos amarillas", "segunda tarjeta amarilla"]),
    en: palabras(["second yellow", "2nd yellow", "two yellows", "two yellow cards", "second booking", "double yellow"]),
    habilita: (h) => h.tipo === "expulsion_y_efecto" && h.datos.motivo === "doble_amarilla",
    requisito: "«doble/segunda amarilla» exige una expulsión por doble amarilla",
  },
  {
    id: "roja_directa",
    es: palabras(["roja directa", "tarjeta roja directa"]),
    en: palabras(["straight red", "direct red"]),
    habilita: (h) => h.tipo === "expulsion_y_efecto" && h.datos.motivo === "roja_directa",
    requisito: "«roja directa» exige una expulsión por roja directa",
  },
  {
    id: "goles_encajados",
    es: palabras(["encajó", "encajaron", "concedió", "concedieron", "recibió goles"]),
    en: palabras(["conceded", "concedes", "let in", "shipped"]),
    habilita: (h) => ["resultado_final", "marcador_por_periodo", "remontada", "expulsion_y_efecto", "gol_anotado"].includes(h.tipo),
    requisito: "«encajó / conceded» solo con un hecho que cuenta goles (resultado, marcador, remontada, expulsión, gol)",
  },
  {
    // Brief 009: «figura / man of the match / player of the match» SOLO con el hecho
    // figura_del_partido como principal (la nota computada desde los eventos la respalda).
    id: "figura",
    // Brief 012 §B: ampliada; ES y EN se buscan por separado (el español no se salva por su par).
    es: palabras([
      "figura", "la figura", "figura del partido", "jugador del partido", "el mejor del partido", "el mejor de la cancha", "el mejor del campo",
      "el mejor hombre", "el hombre más destacado", "el jugador más destacado", "la estrella del partido", "el mejor jugador", "mejor jugador",
    ]),
    en: palabras([
      "man of the match", "player of the match", "star of the match", "best player on the pitch", "best player on the field", "best player",
      "star man", "man of the hour", "standout player", "outstanding player",
    ]),
    habilita: (h) => h.tipo === "figura_del_partido",
    requisito: "«figura / man of the match / player of the match» exige el hecho figura_del_partido como principal",
  },
  {
    id: "fuera_de_tabla",
    es: palabras([
      "monólogo", "paliza", "baile", "bailó", "vapuleo", "vapuleó", "humillación", "humilló", "masacre", "aplastó", "aplastante", "épico", "épica",
      "histórico", "histórica", "milagro", "milagroso", "robo", "escándalo", "escandaloso", "agresión", "agredió", "codazo", "insultó", "insulto",
      "protestó", "lesión", "lesionado", "var", "árbitro", "infame", "vergonzoso",
      // rev. 3.2 — muletillas típicas de un LLM (lista mantenida; el lenguaje abierto no se cierra)
      "golazo", "golazos", "polémico", "polémica", "polémicamente", "de forma polémica", "controvertido", "controvertida", "gracias a",
      "por culpa de", "error del portero", "error del arquero", "error de la defensa", "error defensivo", "el mejor de la tarde",
      "el mejor gol", "mejor gol", "injusto", "injusta", "injusticia", "fue justo", "es justo",
      "inolvidable", "espectacular", "brillante", "magistral",
    ]),
    en: palabras([
      "one-man show", "masterclass", "humiliation", "humiliated", "massacre", "demolition", "demolished", "crushed", "crushing", "epic", "historic",
      "miracle", "miraculous", "robbery", "scandal", "scandalous", "violent conduct", "elbow", "elbowed", "insulted", "insult", "protested", "injury",
      "injured", "var", "referee", "shameful", "disgrace",
      // rev. 3.2
      "controversially", "controversial", "thanks to", "due to an error", "because of an error", "error by", "goalkeeping error",
      "defensive error", "stunner", "screamer", "wonder goal", "worldie", "best goal", "standout", "unfair", "fair",
      "unforgettable", "spectacular", "brilliant", "outplayed",
    ]),
    habilita: () => false,
    requisito: "palabra de juicio o de suceso que ningún hecho respalda",
  },
];

// ---------------------------------------------------------------------------------
// Verbos de RESULTADO: el sujeto (primer equipo nombrado en la frase) debe ser el
// ganador / perdedor / empatador según el hecho principal. Mata «ganador invertido con
// tokens legítimos».
// ---------------------------------------------------------------------------------

export const VERBOS_RESULTADO: Record<Lengua, { gana: RegExp; pierde: RegExp; empata: RegExp; pasiva: RegExp; excepto: RegExp }> = {
  es: {
    // «derrota» (presente) se excluye: es también sustantivo («una derrota dura para A»).
    gana: palabras([
      "ganó", "gana", "ganaron", "venció", "vence", "derrotó", "goleó", "golea", "se impuso", "se impone", "se llevó el partido",
      "se llevó la victoria", "se quedó con la victoria", "superó", "supera", "se quedó con el partido", "doblegó", "doblega", "batió",
    ]),
    pierde: palabras(["perdió", "pierde", "perdieron", "cayó", "cae", "cayeron", "sucumbió", "sucumbe"]),
    // Brief 012 §C: con un gol como principal, «empató/igualó» es computable (marcador igualado tras ese gol).
    empata: palabras(["empató", "empata", "empataron", "igualó", "igualaron", "puso el empate", "niveló"]),
    // Pasiva: el sujeto gramatical PIERDE («J fue superado por A»). Se detecta antes que la activa.
    pasiva: palabras([
      "fue superado por", "fue superada por", "fueron superados por", "fue derrotado por", "fue derrotada por", "fue vencido por",
      "fue vencida por", "fue goleado por", "fue goleada por", "fue doblegado por", "fue doblegada por", "fue batido por", "fue batida por",
    ]),
    excepto: palabras(["ganó un penal", "ganó un córner", "ganó una falta", "ganó el balón", "perdió el balón", "perdió la pelota", "perdió la posesión", "perdiendo el balón"]),
  },
  en: {
    gana: palabras([
      "beat", "beats", "won", "wins", "defeated", "defeats", "thrashed", "thrash", "thrashes", "edged", "edges", "overcame", "routed", "saw off",
      "downed", "downs", "cruised past", "cruise past", "got the better of", "gets the better of", "overpowered",
    ]),
    pierde: palabras(["lost", "loses", "fell to", "went down", "succumbed", "succumbs"]),
    empata: palabras(["drew", "draws", "drawn", "held to a draw", "equalised", "equalized", "drew level", "levelled", "leveled", "pulled level"]),
    pasiva: palabras([
      "were beaten by", "was beaten by", "were defeated by", "was defeated by", "were outplayed by", "was outplayed by",
      "were thrashed by", "was thrashed by", "were downed by", "was downed by", "were edged by", "was edged by", "were overcome by",
    ]),
    excepto: palabras(["won a penalty", "won a corner", "won a free kick", "won the ball", "wins a penalty", "beat his man", "beats his man", "beat their man", "lost the ball", "lost possession", "losing the ball"]),
  },
};

/** Rev. 3.2 — una preposición delante descarta a un equipo como SUJETO («Ante J, A ganó»). */
export const PREPOSICIONES: Record<Lengua, Set<string>> = {
  es: new Set(["ante", "contra", "a", "de", "del", "con", "sobre", "para", "por", "versus", "vs", "frente", "entre", "sin"]),
  en: new Set(["against", "versus", "vs", "to", "by", "over", "for", "with", "of", "from", "past", "beat", "beats", "on"]),
};

// ---------------------------------------------------------------------------------
// Rev. 3.2 — afirmaciones COMPUTABLES (V8): se verifican contra datos del hecho principal.
// ---------------------------------------------------------------------------------

/** «gol de la victoria / winner»: el gol del ganador que puso su marcador en (goles del perdedor + 1). */
export const GOL_DECISIVO: Record<Lengua, RegExp> = {
  es: palabras(["gol de la victoria", "gol del triunfo", "gol decisivo", "tanto decisivo", "tanto de la victoria", "gol ganador", "el gol que decidió"]),
  en: palabras(["the winning goal", "winning goal", "decisive goal", "match-winner", "game-winner", "scored the winner", "netted the winner", "grabbed the winner", "the winner in minute"]),
};

/**
 * Brief 012 §D — «definitivo / settled the match»: solo si ese gol es el ÚLTIMO del partido
 * y deja al equipo ganador por delante (computable con los datos del hecho y el final).
 * En vivo, antes del final, lo rechaza además CIERRE_EN_VIVO.
 */
export const GOL_DEFINITIVO: Record<Lengua, RegExp> = {
  es: palabras(["gol definitivo", "tanto definitivo", "definitivo", "definitiva", "cerró el partido", "liquidó el partido"]),
  en: palabras(["settled the match", "settled the game", "settled it", "to settle it", "to settle the match", "settle the match", "the decisive final goal"]),
};

/** «valla invicta / clean sheet»: el equipo del hecho no recibió goles en el partido. */
export const VALLA_INVICTA: Record<Lengua, RegExp> = {
  es: palabras(["valla invicta", "portería a cero", "portería imbatida", "arco en cero", "arco invicto", "sin recibir goles", "sin encajar"]),
  en: palabras(["clean sheet", "kept a clean sheet", "shut out", "shutout"]),
};

/** Franjas temporales: cada minuto del hecho principal debe cumplir la franja. */
export const FRANJAS: { id: "tras_descanso" | "final" | "temprano" | "descuento"; es: RegExp; en: RegExp }[] = [
  {
    id: "tras_descanso",
    es: palabras(["tras el descanso", "después del descanso", "al volver del descanso", "a la vuelta del descanso", "tras el entretiempo"]),
    en: palabras(["after the break", "after half-time", "after halftime", "after the interval", "after the restart"]),
  },
  {
    id: "final",
    es: palabras(["sobre el final", "en el final del partido", "en el tramo final", "en los minutos finales", "al cierre del partido", "sobre la hora", "al final del partido"]),
    en: palabras(["late on", "late in the game", "late in the match", "in the closing minutes", "in the dying minutes", "at the death"]),
  },
  {
    id: "temprano",
    es: palabras(["temprano", "tempranero", "tempranera", "en los primeros minutos", "de entrada", "al inicio del partido", "nada más empezar"]),
    en: palabras(["early on", "early goal", "in the opening minutes", "from the off", "inside the first ten minutes"]),
  },
  {
    id: "descuento",
    es: palabras(["en el descuento", "en tiempo añadido", "en el tiempo de descuento"]),
    en: palabras(["in stoppage time", "in added time", "in injury time"]),
  },
];

/**
 * Hallazgo F1 del 008 — SOLO en actualizaciones en vivo: un balance de lo que pasó
 * «después» de un momento. Sobre un prefijo ese balance es parcial y se lee como de cierre
 * («afterwards … scored 0»), y el cero del marcador del momento lo respaldaría ante V7. En
 * vivo el partido sigue: el balance posterior se rechaza siempre (V7). La crónica completa
 * no usa esta lista (la plantilla de la expulsión del 002 sí dice «después»).
 * Brief 012 §A2: ampliada y simétrica ES/EN; la regla corre sobre los DOS textos.
 */
export const BALANCE_POSTERIOR: Record<Lengua, RegExp> = {
  es: palabras([
    "después", "despues", "desde entonces", "a partir de ahí", "a partir de entonces", "en adelante", "tras eso", "luego de eso", "hasta el final",
    "el resto del partido", "más tarde",
    // brief 012
    "luego", "a continuación", "posteriormente", "acto seguido", "desde ahí", "en lo que quedaba", "lo que quedaba", "en lo que restaba",
    "lo que restaba", "por el resto", "en el resto",
  ]),
  en: palabras([
    "afterwards", "afterward", "after that", "since then", "thereafter", "from then on", "from that point", "until the end", "the rest of the match",
    "the rest of the game", "later on",
    // brief 012
    "later", "subsequently", "from there", "for the remainder", "the remainder", "in what remained", "what remained", "for the rest",
    "in the rest",
  ]),
};

/**
 * Brief 012 §A1 — SOLO en actualizaciones en vivo y SOLO en momentos ≠ final: vocabulario de
 * partido terminado o decidido. Antes del pitazo final nada está terminado ni sentenciado.
 * ES y EN se buscan por separado. `CIERRE_EN_VIVO_EXCEPTO` deja pasar lo que sí es verdad en
 * el descanso («el primer tiempo terminó / the first half ended»).
 */
export const CIERRE_EN_VIVO: Record<Lengua, RegExp> = {
  es: palabras([
    "resultado final", "marcador final", "final del partido", "pitazo final", "terminó", "el partido terminó", "el partido acabó", "acabó el partido", "finalizó", "cerró el marcador",
    "cerró la cuenta", "sentenció", "sentenciado", "selló", "liquidó", "encaminó la victoria", "encarriló", "definitivo", "definitiva",
    "decisivo", "decisiva", "gol del triunfo", "gol de la victoria", "decidió el partido", "partido decidido", "aseguró la victoria",
    // brief 013: un dominio parcial no es el del partido entero
    "el partido entero", "todo el partido", "de principio a fin", "los noventa minutos",
  ]),
  en: palabras([
    "full time", "full-time", "final score", "final whistle", "ended", "the match ended", "the match finished", "finished the match", "completed the scoring", "complete the scoring", "completing the scoring", "sealed the win",
    "sealed it", "sealed", "wrapped up", "clinched", "on course for victory", "would prove decisive", "decisive", "settled the match", "settled it", "settle the match", "settle it",
    "winning goal", "the winner", "decided the match",
    // brief 013: un dominio parcial no es el del partido entero
    "the whole match", "the entire match", "the whole game", "the entire game", "from start to finish", "all match long",
  ]),
};
export const CIERRE_EN_VIVO_EXCEPTO: Record<Lengua, RegExp> = {
  es: palabras(["el primer tiempo terminó", "terminó el primer tiempo", "la primera parte terminó", "terminó la primera parte", "el primer tiempo acabó", "acabó el primer tiempo"]),
  en: palabras(["the first half ended", "first half ended", "the half ended", "the first half finished", "first half finished"]),
};

/**
 * Tiempo futuro (rev. 3.2): los hechos son pasados; una crónica no anuncia.
 * Brief 012 §A3: + condicional (verbos del dominio en «-ría/-rían»: un sufijo genérico
 * atraparía «categoría, mayoría»), perífrasis «va a + infinitivo», «would», «looks set to»,
 * «on course to».
 */
const CONDICIONAL_ES = [
  "terminaría", "terminarían", "sería", "serían", "acabaría", "acabarían", "quedaría", "quedarían", "ganaría", "ganarían", "perdería",
  "perderían", "empataría", "empatarían", "marcaría", "marcarían", "llegaría", "llegarían", "resistiría", "resistirían", "sentenciaría",
  "cerraría", "sellaría", "definiría", "decidiría", "remontaría", "remontarían", "aguantaría", "aguantarían", "mantendría", "mantendrían",
  "lograría", "lograrían", "conseguiría", "conseguirían", "daría", "darían", "haría", "harían", "podría", "podrían", "tendría", "tendrían",
  "iría", "irían", "vendría", "vendrían", "saldría", "saldrían", "pondría", "pondrían", "habría", "habrían",
];
export const FUTURO: Record<Lengua, RegExp> = {
  es: new RegExp(
    [
      /(?<![\p{L}])\p{L}{2,}(?:ará|erá|irá|arán|erán|irán)(?![\p{L}])/u.source,
      palabras(CONDICIONAL_ES).source,
      /(?<![\p{L}])(?:va|van|vamos)\s+a\s+\p{L}+(?:ar|er|ir)(?![\p{L}])/u.source,
    ].join("|"),
    "giu",
  ),
  en: palabras(["will", "shall", "going to", "is set to", "are set to", "would", "looks set to", "look set to", "looked set to", "on course to", "is about to"]),
};

// ---------------------------------------------------------------------------------
// V4 — palabras con mayúscula permitidas al inicio del texto o tras puntuación, sin ser
// nombres. Diccionario corto y cerrado: lo controlamos porque controlamos los idiomas.
// ---------------------------------------------------------------------------------

export const FUNCIONALES: Record<Lengua, Set<string>> = {
  es: new Set([
    "El", "La", "Los", "Las", "Lo", "Un", "Una", "Unos", "Unas", "Al", "Del", "A", "De", "En", "Con", "Por", "Para", "Tras", "Desde", "Hasta", "Ante",
    "Sobre", "Entre", "Hacia", "Según", "Durante", "Después", "Antes", "Luego", "Más", "Menos", "Ya", "Pero", "Y", "O", "Aunque", "Mientras", "Cuando",
    "Como", "Así", "Además", "También", "Incluso", "Finalmente", "Entonces", "Apenas", "Pese", "Ese", "Esa", "Este", "Esta", "Eso", "Esto", "Su", "Sus",
    "Fue", "Era", "Hubo", "Ha", "Había", "Llegó", "Allí", "Ahí", "Recién", "Primero", "Pronto", "Todo", "Toda", "Cada", "Otro", "Otra",
    // sustantivos del oficio que abren frases o títulos
    "Resultado", "Goles", "Gol", "Segundo", "Primer", "Primera", "Segunda", "Medio", "Final", "Descanso", "Doblete", "Triplete", "Remontada",
    "Penal", "Victoria", "Empate", "Derrota", "Expulsión", "Roja", "Amarilla", "Atajadas", "Partido", "Crónica", "Presión", "Dominio",
    // rev. 3.2 — aperturas habituales
    "Sin", "Poco", "Minutos", "Momentos", "Solo", "Sólo", "Hoy", "Enseguida", "Inmediatamente", "Nuevamente", "Otra", "Mientras", "Instantes",
  ]),
  en: new Set([
    "The", "A", "An", "In", "On", "At", "After", "Before", "By", "With", "For", "From", "Of", "To", "As", "And", "But", "Or", "Then", "Later", "Early",
    "Late", "Despite", "Although", "While", "When", "Only", "Just", "Even", "Also", "His", "Their", "Its", "It", "This", "That", "There", "Here",
    "Soon", "First", "Second", "Full", "Half", "Goals", "Goal", "Final", "Score", "Brace", "Hat-trick", "Comeback", "Win", "Draw", "Victory", "Defeat",
    "Penalty", "Red", "Yellow", "Saves", "Keeper", "Goalkeeper", "Over", "Under", "Into", "Up", "Down", "Off", "Each", "Every", "Pressure", "Dominance",
    // rev. 3.2 — aperturas habituales
    "However", "Shortly", "Moments", "Minutes", "Today", "Meanwhile", "Again", "Once", "Immediately", "Soon", "Just",
  ]),
};

/** Palabras comunes que un TÍTULO en inglés puede llevar en Title Case (comparación en minúsculas). */
export const TITULO_EN_COMUNES = new Set(
  [
    "win", "wins", "won", "beat", "beats", "draw", "draws", "drew", "seal", "seals", "sealed", "brace", "hat-trick", "late", "early", "comeback",
    "goal", "goals", "red", "card", "yellow", "keeper", "goalkeeper", "save", "saves", "stun", "stuns", "edge", "edges", "hold", "holds", "held",
    "rout", "routs", "victory", "defeat", "penalty", "penalties", "double", "header", "strike", "strikes", "earn", "earns", "secure", "secures",
    "grab", "grabs", "rescue", "rescues", "point", "points", "share", "spoils", "full", "time", "half", "first", "second", "sent", "off", "ten", "men",
    "against", "the", "a", "an", "in", "on", "at", "of", "for", "to", "as", "and", "after", "with", "by", "from", "over", "into", "vs", "v",
    "decides", "decide", "lead", "leads", "inspire", "inspires", "power", "powers", "fires", "fire", "sinks", "sink", "downs", "down", "tops",
  ].map((w) => w.toLowerCase()),
);

/**
 * Brief 013 — CANAL computable (V8): si una oración nombra un canal (banda izquierda, el
 * centro, banda derecha), el hecho principal tiene que afirmar ESE canal en `datos.canal`.
 * Sin esto, «perdió el balón 6 veces por la banda derecha» pasaría con un hecho de la
 * izquierda (no hay cifras ni nombres que lo delaten).
 */
export const FRASES_CANAL: Record<Lengua, [string, RegExp][]> = {
  es: [
    ["banda_izquierda", palabras(["banda izquierda", "por la izquierda", "costado izquierdo", "flanco izquierdo", "sector izquierdo", "carril izquierdo"])],
    ["banda_derecha", palabras(["banda derecha", "por la derecha", "costado derecho", "flanco derecho", "sector derecho", "carril derecho"])],
    ["centro", palabras(["por el centro", "por el medio", "por dentro", "carril central"])],
  ],
  en: [
    ["banda_izquierda", palabras(["left flank", "left wing", "left side", "left channel", "down the left", "on the left"])],
    ["banda_derecha", palabras(["right flank", "right wing", "right side", "right channel", "down the right", "on the right"])],
    ["centro", palabras(["the middle", "through the middle", "down the middle", "the centre", "the center", "through the centre", "through the center", "central channel"])],
  ],
};

/**
 * Brief 015 — magnitudes del tiro, COMPUTABLES (V8): «desde fuera del área» solo si el hecho
 * principal registra distancia ≥ FUERA_DEL_AREA_M; «un misil» solo con velocidad ≥ MISIL_KMH.
 */
export const FUERA_DEL_AREA: Record<Lengua, RegExp> = {
  es: palabras(["desde fuera del área", "fuera del área", "desde afuera del área", "desde lejos", "desde larga distancia", "de media distancia"]),
  en: palabras(["from outside the box", "outside the box", "from outside the area", "outside the area", "from long range", "from distance", "from range"]),
};
export const MISIL: Record<Lengua, RegExp> = {
  es: palabras(["un misil", "misil", "un cañonazo", "cañonazo", "un obús", "obús", "un zapatazo", "zapatazo"]),
  en: palabras(["a rocket", "rocket", "a thunderbolt", "thunderbolt", "a piledriver", "piledriver"]),
};
