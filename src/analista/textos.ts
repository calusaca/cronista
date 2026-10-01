// Plantillas de texto ES/EN — fijas, neutras y sin adjetivos (brief 002).
// El color literario lo pone el Cronista; aquí solo verdad seca.
// Cada {clave} se rellena con `datos` del hecho; una clave ausente es un error del
// programa (lanza), nunca un texto con llaves sin resolver.

export interface Plantilla {
  es: string;
  en: string;
}

export const PLANTILLAS = {
  resultado_final: {
    es: "Resultado final: {local} {goles_local}–{goles_visita} {visita}.",
    en: "Full time: {local} {goles_local}–{goles_visita} {visita}.",
  },
  marcador_periodo_1: {
    es: "Al descanso: {local} {marcador_local}–{marcador_visita} {visita}.",
    en: "Half time: {local} {marcador_local}–{marcador_visita} {visita}.",
  },
  marcador_periodo_2: {
    es: "Segundo tiempo: {local} {goles_local_periodo}–{goles_visita_periodo} {visita} en el periodo; {marcador_local}–{marcador_visita} en el total.",
    en: "Second half: {local} {goles_local_periodo}–{goles_visita_periodo} {visita} in the period; {marcador_local}–{marcador_visita} overall.",
  },
  gol: {
    es: "{jugador} ({equipo}) marcó en el minuto {minuto}, con un tiro de xG {xg}; {local} {marcador_local}–{marcador_visita} {visita}.",
    en: "{jugador} ({equipo}) scored in minute {minuto}, from a shot of {xg} xG; {local} {marcador_local}–{marcador_visita} {visita}.",
  },
  gol_penal: {
    es: "{jugador} ({equipo}) marcó de penal en el minuto {minuto}, con un tiro de xG {xg}; {local} {marcador_local}–{marcador_visita} {visita}.",
    en: "{jugador} ({equipo}) scored a penalty in minute {minuto}, from a shot of {xg} xG; {local} {marcador_local}–{marcador_visita} {visita}.",
  },
  doblete: {
    es: "{jugador} ({equipo}) marcó un doblete (minutos {minutos}).",
    en: "{jugador} ({equipo}) scored a brace (minutes {minutos}).",
  },
  triplete: {
    es: "{jugador} ({equipo}) marcó un triplete (minutos {minutos}).",
    en: "{jugador} ({equipo}) scored a hat-trick (minutes {minutos}).",
  },
  varios_goles: {
    es: "{jugador} ({equipo}) marcó {goles} goles (minutos {minutos}).",
    en: "{jugador} ({equipo}) scored {goles} goals (minutes {minutos}).",
  },
  // Marcadores desde la perspectiva del equipo que remonta (propios–rival).
  remontada_victoria: {
    es: "{equipo} perdía {desventaja_propios}–{desventaja_rival} contra {rival} en el minuto {minuto_desventaja} y ganó {final_propios}–{final_rival}.",
    en: "{equipo} were {desventaja_propios}–{desventaja_rival} down against {rival} in minute {minuto_desventaja} and won {final_propios}–{final_rival}.",
  },
  remontada_empate: {
    es: "{equipo} perdía {desventaja_propios}–{desventaja_rival} contra {rival} en el minuto {minuto_desventaja} y empató {final_propios}–{final_rival}.",
    en: "{equipo} were {desventaja_propios}–{desventaja_rival} down against {rival} in minute {minuto_desventaja} and drew {final_propios}–{final_rival}.",
  },
  gol_temprano: {
    es: "{jugador} ({equipo}) marcó en el minuto {minuto}.",
    en: "{jugador} ({equipo}) scored in minute {minuto}.",
  },
  gol_tardio: {
    es: "{jugador} ({equipo}) marcó en el minuto {minuto}.",
    en: "{jugador} ({equipo}) scored in minute {minuto}.",
  },
  dominio_1: {
    es: "En el primer tiempo, {equipo} sumó {acciones_equipo} de las {acciones_total} acciones ofensivas (tiros, córners y pases clave): {porcentaje} %.",
    en: "In the first half, {equipo} had {acciones_equipo} of the {acciones_total} attacking actions (shots, corners and key passes): {porcentaje}%.",
  },
  dominio_2: {
    es: "En el segundo tiempo, {equipo} sumó {acciones_equipo} de las {acciones_total} acciones ofensivas (tiros, córners y pases clave): {porcentaje} %.",
    en: "In the second half, {equipo} had {acciones_equipo} of the {acciones_total} attacking actions (shots, corners and key passes): {porcentaje}%.",
  },
  presion: {
    es: "{equipo} remató {tiros} veces entre el minuto {desde} y el {hasta}, con {xg} de xG en total.",
    en: "{equipo} had {tiros} shots between minute {desde} and minute {hasta}, totalling {xg} xG.",
  },
  justicia_contra_corriente: {
    es: "{ganador} ganó con menos xG que su rival: {xg_ganador} contra {xg_perdedor} ({local} {goles_local}–{goles_visita} {visita}).",
    en: "{ganador} won with less xG than their opponent: {xg_ganador} to {xg_perdedor} ({local} {goles_local}–{goles_visita} {visita}).",
  },
  justicia_neutra: {
    es: "Goles y xG: {local} {goles_local} ({xg_local} xG), {visita} {goles_visita} ({xg_visita} xG).",
    en: "Goals and xG: {local} {goles_local} ({xg_local} xG), {visita} {goles_visita} ({xg_visita} xG).",
  },
  portero: {
    es: "{portero} ({equipo}) hizo {atajadas} atajadas a tiros que sumaban {xg_atajado} de xG.",
    en: "{portero} ({equipo}) made {atajadas} saves from shots totalling {xg_atajado} xG.",
  },
  portero_sin_nombre: {
    es: "El portero de {equipo} hizo {atajadas} atajadas a tiros que sumaban {xg_atajado} de xG.",
    en: "The {equipo} goalkeeper made {atajadas} saves from shots totalling {xg_atajado} xG.",
  },
  expulsion_directa: {
    es: "{jugador} ({equipo}) vio la roja directa en el minuto {minuto}, con {local} {marcador_local}–{marcador_visita} {visita}; después, {local} marcó {goles_despues_local} y {visita} {goles_despues_visita}.",
    en: "{jugador} ({equipo}) was shown a straight red card in minute {minuto}, with {local} {marcador_local}–{marcador_visita} {visita}; afterwards, {local} scored {goles_despues_local} and {visita} {goles_despues_visita}.",
  },
  expulsion_doble_amarilla: {
    es: "{jugador} ({equipo}) fue expulsado por doble amarilla en el minuto {minuto}, con {local} {marcador_local}–{marcador_visita} {visita}; después, {local} marcó {goles_despues_local} y {visita} {goles_despues_visita}.",
    en: "{jugador} ({equipo}) was sent off for a second yellow card in minute {minuto}, with {local} {marcador_local}–{marcador_visita} {visita}; afterwards, {local} scored {goles_despues_local} and {visita} {goles_despues_visita}.",
  },
  disciplina: {
    es: "{equipo} recibió {amarillas} tarjetas amarillas (minutos {minutos}).",
    en: "{equipo} received {amarillas} yellow cards (minutes {minutos}).",
  },
  // Brief 009.
  figura_del_partido: {
    es: "{jugador} fue la figura del partido (nota {nota}).",
    en: "{jugador} was the player of the match (rating {nota}).",
  },
} as const satisfies Record<string, Plantilla>;

export type ClavePlantilla = keyof typeof PLANTILLAS;

/** Rellena una plantilla con `datos`. Lanza si falta una clave (error de programa). */
export function rellenar(plantilla: string, datos: Record<string, string | number>): string {
  return plantilla.replace(/\{([a-z_]+)\}/g, (_, clave: string) => {
    const v = datos[clave];
    if (v === undefined) throw new Error(`plantilla: falta el dato "${clave}"`);
    return String(v);
  });
}

export function textos(clave: ClavePlantilla, datos: Record<string, string | number>): { texto_es: string; texto_en: string } {
  const p = PLANTILLAS[clave];
  return { texto_es: rellenar(p.es, datos), texto_en: rellenar(p.en, datos) };
}

/** Minuto legible: 93 ⇒ "90+3"; el descuento del 1T ya viene sellado en 45. */
export function minutoTxt(m: number): string {
  return m > 90 ? `90+${m - 90}` : String(m);
}

/** xG con dos decimales y punto en ambos idiomas (las cifras deben coincidir ES/EN). */
export function xgTxt(centesimas: number): string {
  return (centesimas / 100).toFixed(2);
}
