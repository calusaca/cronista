// Brief 064 § 4.6 y § 4.9 · Textos (EN/ES) de la página de crónica de un partido de la arena y de su botón. Marco
// bilingüe completo: el ES/EN de la barra cambia frases, marco y línea de tiempo.
import type { MotivoActa } from "../arena/cronica";

type Idioma = "es" | "en";
type Par = Record<Idioma, string>;
/** Espera legible a partir del retry-after (s): segundos por debajo de dos minutos, minutos (hacia arriba) desde ahí. */
const espera = (s: number) => (s < 120 ? `${s} s` : `${Math.ceil(s / 60)} min`);

export const TEXTOS_CRONICA_ARENA = {
  overline: { en: "Match report · arena", es: "Crónica · arena" },
  finalAnticipado: { en: "Early finish", es: "Final anticipado" },
  reglas: { en: "Engine rules", es: "Reglas del motor" },
  quienJugo: { en: "Who played", es: "Quién jugó" },
  torneo: { en: (n: number, fecha: string) => `Match ${n} of the ${fecha} tournament`, es: (n: number, fecha: string) => `Partido ${n} del torneo del ${fecha}` },
  volverTorneo: { en: "Back to the tournament", es: "Volver al torneo" },
  redactor: { en: "Writer", es: "Redactor" },
  acta: {
    en: "Deterministic record — template sentences from the arena analyst, no language model",
    es: "Acta determinista — frases de plantilla del analista de la arena, sin modelo de lenguaje",
  },
  provisional: { en: "Provisional: a later request with the writer available can replace it.", es: "Provisional: una petición posterior con el redactor disponible puede sustituirla." },
  motivos: {
    desactivado: { en: "the model writer is turned off on this server", es: "el redactor con modelo está desactivado en este servidor" },
    redactor: { en: "the writer model is not available", es: "el modelo redactor no está disponible" },
    cupo: { en: "today's quota of model-written reports is used up", es: "se agotó el cupo diario de crónicas con modelo" },
    error: { en: "the writer model failed", es: "falló el modelo redactor" },
    abandonada: { en: "a previous attempt was interrupted", es: "se interrumpió un intento anterior" },
    rechazos: { en: "the writer did not pass verification in its attempts", es: "el redactor no superó la verificación en sus intentos" },
    tamano: { en: "the required facts are too long for the writer", es: "los hechos obligatorios no caben en la entrada del redactor" },
  } satisfies Record<MotivoActa, Par>,
  stub: { en: "Offline stub — sentences reuse the analyst's templates", es: "Stub sin conexión — las frases reutilizan las plantillas del analista" },
  ensayo: { en: "Rehearsal fixture — a scripted writer with one deliberate error (test only)", es: "Rehearsal fixture (ensayo) — un redactor guionizado con un error deliberado (solo pruebas)" },
  verificadas: { en: (n: number) => `${n}/${n} sentences verified`, es: (n: number) => `${n}/${n} frases verificadas` },
  intentos: { en: (n: number) => (n === 1 ? "attempt" : "attempts"), es: (n: number) => (n === 1 ? "intento" : "intentos") },
  corregidas: { en: "corrected", es: "corregidas" },
  omitidas: { en: "omitted", es: "omitidas" },
  verProceso: { en: "View process", es: "Ver proceso" },
  verRechazos: { en: "See the rejected attempts", es: "Ver los intentos rechazados" },
  actaBanner: { en: "Deterministic record — not a written report", es: "Acta determinista — no es una crónica redactada" },
  actaDetalle: {
    en: "Every sentence is the arena analyst's fixed template for one fact: dry, and checked by the same verifier.",
    es: "Cada frase es la plantilla fija del analista de la arena para un hecho: seca, y revisada por el mismo verificador.",
  },
  estado: {
    verificada: { en: "Verified on the first pass", es: "Verificada a la primera" },
    corregida: { en: "Corrected — a draft was rejected; open its history", es: "Corregida — se rechazó un borrador; abre su historia" },
    acta: { en: "Analyst record (no language-model prose)", es: "Acta del analista (sin prosa de modelo)" },
  },
  hecho: { en: "Fact", es: "Hecho" },
  historia: { en: "History", es: "Historia" },
  verRepeticion: { en: "Watch in the replay", es: "Ver en la repetición" },
  linea: { en: "Timeline", es: "Línea de tiempo" },
  lineaNota: { en: "Engine templates for each event (not checked by the verifier). Click an event to light up the sentences that cite it.", es: "Plantillas del motor para cada evento (no pasan por el verificador). Pulsa un evento para resaltar las frases que lo citan." },
  leyenda: { en: "Click a sentence to light up its events in the timeline.", es: "Pulsa una frase para resaltar sus eventos en la línea de tiempo." },
  limites: { en: "Limits of this report", es: "Límites de esta crónica" },
  limitesComprueba: {
    en: "Checked: every sentence cites facts derived from the match record; figures, scores, names, negations, result verbs and judgements follow rules V1–V8, and every time is in seconds and must be the time of its fact.",
    es: "Se comprueba: cada frase cita hechos derivados del registro del partido; cifras, marcadores, nombres, negaciones, verbos de resultado y valoraciones siguen las reglas V1–V8, y todo tiempo va en segundos y tiene que ser el de su hecho.",
  },
  limitesNo: {
    en: "Not checked: causes, intentions and tactics (pressing, chasing, dropping back), qualities of a shot or a pass beyond the table, spatial relations other than the shot distance, the role of a figure outside scores and time, and free prose that touches none of the maintained rule families.",
    es: "No se comprueba: causas, intenciones y tácticas (presión, persecución, repliegue), cualidades del remate o del pase fuera de la tabla, relaciones espaciales salvo la distancia del remate, el papel de una cifra fuera de marcadores y tiempo, y la prosa libre que no toca las familias de reglas mantenidas.",
  },
  limitesLinea: { en: "The timeline uses the engine's own templates; they are not checked by the verifier.", es: "La línea de tiempo usa las plantillas del propio motor; no pasan por el verificador." },
  sinCronica: {
    "sin-cronica": { en: "This match has no report yet.", es: "Este partido aún no tiene crónica." },
    invalida: { en: "The saved report no longer passes the verifier, so its prose is not shown.", es: "La crónica guardada ya no pasa el verificador, así que su prosa no se muestra." },
    desactualizada: { en: "The saved report was written from an older set of facts, so its prose is not shown.", es: "La crónica guardada se escribió con otro conjunto de hechos, así que su prosa no se muestra." },
  },
  // Botón
  boton: { en: "Match report", es: "Crónica" },
  botonNota: { en: "Written after the match and checked sentence by sentence", es: "Escrita al terminar y verificada frase a frase" },
  esperaTitulo: { en: "Writing the match report…", es: "Escribiendo la crónica…" },
  esperaDetalle: {
    en: "The writer drafts it and the verifier checks every sentence. It can take up to two minutes.",
    es: "El redactor la escribe y el verificador revisa cada frase. Puede tardar hasta dos minutos.",
  },
  ocupado: { en: (s: number) => `Another match report is being written. Try again in ${s} s.`, es: (s: number) => `Se está escribiendo otra crónica. Vuelve a intentarlo en ${s} s.` },
  subidas: {
    en: (s?: number) => `Too many match reports have been requested for uploaded or locally played matches in the last hour. ${s ? `Try again in ${espera(s)}.` : "Try again later."}`,
    es: (s?: number) => `Se han pedido demasiadas crónicas de partidos subidos o jugados aquí en la última hora. ${s ? `Vuelve a intentarlo en ${espera(s)}.` : "Vuelve a intentarlo más tarde."}`,
  },
  registrosDiarios: {
    en: (s?: number) => `Today's limit of new matches with a match report has been reached. ${s ? `Try again in ${espera(s)}.` : "Try again tomorrow (UTC)."}`,
    es: (s?: number) => `Se alcanzó el límite diario de partidos nuevos con crónica. ${s ? `Vuelve a intentarlo en ${espera(s)}.` : "Vuelve a intentarlo mañana (UTC)."}`,
  },
  fallo: { en: "The match report could not be written.", es: "No se pudo escribir la crónica." },
  reintentar: { en: "Retry", es: "Reintentar" },
} as const;
