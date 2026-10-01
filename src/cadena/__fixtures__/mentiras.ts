// Datos de la batería permanente de mentiras (brief 003, revisión 3.1): los ataques de la
// auditoría adversaria (ataque.ts / protocolo.ts del auditor, semilla 246) adaptados al
// contrato «un hecho principal por oración», y los falsos positivos que deben aceptarse.
// Solo para pruebas: jamás alimentan la demo (regla de honestidad del 006).

import { analizar } from "../../analista/analista";
import type { Hecho } from "../../analista/tipos";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { CronicaDraft, Oracion, Regla } from "../tipos";
import { COBERTURA } from "../umbrales";

export const SEMILLA_MENTIRAS = 246;
const hechos = analizar(simular(configDeSemilla(SEMILLA_MENTIRAS)));

/** La batería depende de qué hecho es cada id: si el Analista cambia, la prueba lo dice primero. */
export const ESPERADO_246: Record<string, Hecho["tipo"]> = {
  h01: "expulsion_y_efecto", h02: "doblete_o_mas", h03: "resultado_final", h04: "gol_anotado", h05: "gol_anotado",
  h06: "gol_anotado", h07: "gol_anotado", h08: "gol_anotado", h09: "portero_destacado", h10: "justicia_xg",
  h11: "marcador_por_periodo", h12: "marcador_por_periodo", h13: "gol_temprano", h14: "presion_sostenida", h15: "disciplina",
};

export const O = (es: string, en: string, hecho: string, ...apoyo: string[]): Oracion => ({ texto_es: es, texto_en: en, hecho, ...(apoyo.length ? { apoyo } : {}) });

export interface Mentira {
  id: string;
  nota: string;
  regla: Regla;
  reemplaza?: string; // id del hecho cuya oración se reemplaza
  oracion?: Oracion;
  titulo?: [string, string];
  /** Ajuste extra del borrador (F23). */
  ajuste?: (d: CronicaDraft) => void;
}

export const MENTIRAS: Mentira[] = [
  // 1. Nombres
  { id: "F01", regla: "V4", nota: "apellido inventado al abrir la oración", reemplaza: "h04",
    oracion: O("Gutiérrez habilitó a Darío Mariosa, que marcó en el minuto 3.", "Gutiérrez set up Darío Mariosa, who scored in minute 3.", "h04") },
  { id: "F02", regla: "V4", nota: "nombre inventado tras un punto", reemplaza: "h04",
    oracion: O("Darío Mariosa marcó en el minuto 3. Ramírez le dio el pase.", "Darío Mariosa scored in minute 3. Ramírez provided the pass.", "h04") },
  { id: "F03", regla: "V4", nota: "nombre inventado tras dos puntos", reemplaza: "h04",
    oracion: O("El pase del 1–0 en el minuto 3 tuvo un autor: Ramírez, y lo cerró Darío Mariosa.", "The pass for the 1–0 in minute 3 had an author: Ramírez, and Darío Mariosa finished it.", "h04") },
  { id: "F04", regla: "V4", nota: "nombre inventado entre comillas", reemplaza: "h04",
    oracion: O("Darío Mariosa marcó en el minuto 3 tras una pared con «Ramírez».", "Darío Mariosa scored in minute 3 after a give-and-go with “Ramírez”.", "h04") },
  { id: "F05", regla: "V4", nota: "nombre compuesto con piezas de dos jugadores (apoyo no habilita)", reemplaza: "h07",
    oracion: O("Bruno Celeloya marcó de penal en el minuto 60.", "Bruno Celeloya scored a penalty in minute 60.", "h07", "h02") },
  // 2. Mentiras sin cifras ni nombres falsos
  { id: "F06", regla: "V8", nota: "ganador invertido con cifras y nombres correctos", reemplaza: "h03",
    oracion: O("Atlético Montefrío Bajo goleó 4–1 a Juventud Islaverde Sur.", "Atlético Montefrío Bajo thrashed Juventud Islaverde Sur 4–1.", "h03") },
  { id: "F07", regla: "V7", nota: "negación: «sin penales ni expulsiones» (hubo de ambos)", reemplaza: "h03",
    oracion: O("Resultado final: Juventud Islaverde Sur 4–1 Atlético Montefrío Bajo, en un partido sin penales ni expulsiones.", "Full time: Juventud Islaverde Sur 4–1 Atlético Montefrío Bajo, in a match without penalties or red cards.", "h03") },
  { id: "F08", regla: "V8", nota: "juicio inventado: «monólogo»", reemplaza: "h10",
    oracion: O("Atlético Montefrío Bajo fue un monólogo de principio a fin y mereció perder por más.", "Atlético Montefrío Bajo were a one-man show from start to finish and deserved to lose by more.", "h10") },
  { id: "F09", regla: "V8", nota: "roja directa por agresión (fue doble amarilla)", reemplaza: "h01",
    oracion: O(
      "Leo Fenaido (Atlético Montefrío Bajo) vio la roja directa por una agresión en el minuto 66, con Juventud Islaverde Sur 3–1 Atlético Montefrío Bajo; después, Juventud Islaverde Sur marcó 1 y Atlético Montefrío Bajo 0.",
      "Leo Fenaido (Atlético Montefrío Bajo) was shown a straight red for violent conduct in minute 66, with Juventud Islaverde Sur 3–1 Atlético Montefrío Bajo; afterwards, Juventud Islaverde Sur scored 1 and Atlético Montefrío Bajo 0.",
      "h01") },
  { id: "F10", regla: "V8", nota: "el portero «encajó» en vez de atajar", reemplaza: "h09",
    oracion: O("Aarón Celoón (Juventud Islaverde Sur) encajó 8 goles en tiros que sumaban 1.08 de xG.", "Aarón Celoón (Juventud Islaverde Sur) conceded 8 goals from shots totalling 1.08 xG.", "h09") },
  // 3. Números en palabras, ordinales, cuentas
  { id: "F11", regla: "V3", nota: "triplete / hat-trick (fue doblete)", reemplaza: "h02",
    oracion: O("Darío Celeloya (Juventud Islaverde Sur) firmó un triplete (minutos 31, 48).", "Darío Celeloya (Juventud Islaverde Sur) completed a hat-trick (minutes 31, 48).", "h02") },
  { id: "F12", regla: "V3", nota: "ordinal falso: «el quinto de la temporada»", reemplaza: "h06",
    oracion: O("Darío Celeloya marcó en el minuto 48 su tercer gol del partido y el quinto de la temporada.", "Darío Celeloya scored his third goal of the match in minute 48, his fifth of the season.", "h06") },
  { id: "F13", regla: "V3", nota: "número en palabras > 20: «treinta»", reemplaza: "h04",
    oracion: O("Darío Mariosa marcó en el minuto treinta.", "Darío Mariosa scored in minute thirty.", "h04") },
  { id: "F14", regla: "V3", nota: "«un solo gol de diferencia» (fueron tres)", reemplaza: "h03",
    oracion: O("Juventud Islaverde Sur ganó por un solo gol de diferencia.", "Juventud Islaverde Sur won by a single goal.", "h03") },
  { id: "F15", regla: "V3", nota: "«docena» / «dozen» de atajadas (fueron 8)", reemplaza: "h09",
    oracion: O("Aarón Celoón (Juventud Islaverde Sur) hizo una docena de atajadas.", "Aarón Celoón (Juventud Islaverde Sur) made a dozen saves.", "h09") },
  { id: "F16", regla: "V3", nota: "dígitos no ASCII (fullwidth ７–０)", reemplaza: "h03",
    oracion: O("Juventud Islaverde Sur ganó ７–０.", "Juventud Islaverde Sur won ７–０.", "h03") },
  // 4. Recombinación de cifras verdaderas
  { id: "F17", regla: "V4", nota: "goleador de otro hecho (en apoyo) con su minuto", reemplaza: "h04",
    oracion: O("Dante Doraena abrió el marcador en el minuto 3 y Darío Mariosa cerró la goleada en el 67.", "Dante Doraena opened the scoring in minute 3 and Darío Mariosa completed the rout in the 67th.", "h04", "h08") },
  { id: "F18", regla: "V3", nota: "marcador del descanso invertido con cifras del propio hecho", reemplaza: "h11",
    oracion: O("Al descanso: Juventud Islaverde Sur 0–2 Atlético Montefrío Bajo.", "Half time: Juventud Islaverde Sur 0–2 Atlético Montefrío Bajo.", "h11") },
  { id: "F19", regla: "V8", nota: "xG cruzado: «ganó con más xG» (fue con menos)", reemplaza: "h10",
    oracion: O("Juventud Islaverde Sur ganó con más xG que su rival: 2.45 contra 1.75.", "Juventud Islaverde Sur won with more xG than their opponent: 2.45 to 1.75.", "h10") },
  // 5. Atribuciones
  { id: "F20", regla: "V4", nota: "asistencia inventada de un jugador del apoyo", reemplaza: "h05",
    oracion: O("Darío Mariosa asistió a Darío Celeloya, que marcó en el minuto 31.", "Darío Mariosa assisted Darío Celeloya, who scored in minute 31.", "h05", "h04") },
  { id: "F21", regla: "V4", nota: "penal atribuido al equipo equivocado", reemplaza: "h07",
    oracion: O("Bruno Toroino (Juventud Islaverde Sur) marcó de penal en el minuto 60.", "Bruno Toroino (Juventud Islaverde Sur) scored a penalty in minute 60.", "h07", "h03") },
  // 6. Citar todo para permitirlo todo
  { id: "F22", regla: "V4", nota: "oración con TODOS los hechos en apoyo: cualquier cifra/nombre", reemplaza: "h14",
    oracion: O("Leo Fenaido marcó de penal en el minuto 4 y Aarón Celoón fue expulsado en el 31.", "Leo Fenaido scored a penalty in minute 4 and Aarón Celoón was sent off in the 31st.", "h14", ...hechos.map((h) => h.id)) },
  { id: "F24", regla: "V4", nota: "ES y EN cuentan goleadores distintos", reemplaza: "h04",
    oracion: O("Darío Mariosa marcó en el minuto 3.", "Dante Doraena scored in minute 3.", "h04", "h08") },
  // 7. Citar sin narrar
  { id: "F23", regla: "V5", nota: "oración vacía de contenido como principal de un hecho obligatorio", reemplaza: "h01",
    oracion: O("Fue una tarde intensa.", "It was an intense afternoon.", "h01", ...hechos.filter((h) => h.relevancia >= COBERTURA).map((h) => h.id)) },
  // Títulos
  { id: "T01", regla: "V8", nota: "título con ganador invertido",
    titulo: ["Atlético Montefrío Bajo golea 4–1 a Juventud Islaverde Sur", "Atlético Montefrío Bajo thrash Juventud Islaverde Sur 4–1"] },
  { id: "T02", regla: "V4", nota: "título con apellido inventado abriendo",
    titulo: ["Gutiérrez guía la goleada de Juventud Islaverde Sur", "Gutiérrez leads Juventud Islaverde Sur rout"] },
  { id: "T03", regla: "V3", nota: "título con triplete (fue doblete)",
    titulo: ["Triplete de Darío Celeloya en el 4–1", "Darío Celeloya hat-trick in 4–1 win"] },
];

/** Falsos positivos de la auditoría (B5) y del ataque F25: deben ser ACEPTADOS. */
export const VERDADES: { id: string; nota: string; oracion?: Oracion; titulo?: [string, string] }[] = [
  { id: "F25", nota: "«one-two» (pared) no es una cifra",
    oracion: O("Darío Mariosa marcó en el minuto 3 tras una pared.", "Darío Mariosa scored in minute 3 after a one-two.", "h04") },
  { id: "B5-1", nota: "«con diez» / «ten men» con la expulsión como principal",
    oracion: O("Leo Fenaido vio la segunda amarilla en el minuto 66 y Atlético Montefrío Bajo se quedó con diez.", "Leo Fenaido picked up a second yellow in minute 66, leaving Atlético Montefrío Bajo with ten men.", "h01") },
  { id: "B5-2", nota: "título inglés en Title Case",
    titulo: ["Doblete de Darío Celeloya en el 4–1", "Darío Celeloya Brace Seals 4–1 Win"] },
  { id: "B5-3", nota: "«dos goles» de un doblete",
    oracion: O("Darío Celeloya marcó dos goles, en los minutos 31 y 48.", "Darío Celeloya scored two goals, in minutes 31 and 48.", "h02") },
  { id: "B5-4", nota: "«los 90 minutos»",
    oracion: O("Juventud Islaverde Sur controló los 90 minutos.", "Juventud Islaverde Sur controlled the 90 minutes.", "h03") },
  { id: "B5-5", nota: "«segunda amarilla» / «2nd yellow»",
    oracion: O("Leo Fenaido vio la segunda amarilla en el minuto 66.", "Leo Fenaido saw his 2nd yellow in minute 66.", "h01") },
];

