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
  // Brief 013.
  duelo_ganado: {
    es: "{jugador} ({equipo}) dribló {regates} veces a {rival} ({equipo_rival}).",
    en: "{jugador} ({equipo}) dribbled past {rival} ({equipo_rival}) {regates} times.",
  },
  perdidas_en_salida: {
    es: "{equipo} perdió el balón {perdidas} veces saliendo por {canal_es}.",
    en: "{equipo} lost the ball {perdidas} times playing out down {canal_en}.",
  },
  dominio_global: {
    es: "{equipo} dominó el partido ({porcentaje} % de la posesión).",
    en: "{equipo} dominated the match ({porcentaje}% possession).",
  },
  dominio_por_canal: {
    es: "{equipo} atacó sobre todo por {canal_es} ({porcentaje} % de sus avances).",
    en: "{equipo} attacked mostly down {canal_en} ({porcentaje}% of their attacks).",
  },
  // Brief 018: las condiciones (dato puro: cita la config registrada) y los tres efectos medidos.
  condiciones_del_partido: {
    es: "Con {clima_es} y {cancha_es} en la cancha de {local}; presión {presion_local_es} para el local y {presion_visita_es} para {visita}.",
    en: "With {clima_en} and {cancha_en} at {local}'s ground; {presion_local_en} pressure on the hosts and {presion_visita_en} on {visita}.",
  },
  efecto_calor: {
    es: "Con {temperatura_c} °C, el ritmo bajó en el segundo tiempo: {pases_segundo_tiempo} pases, frente a {pases_primer_tiempo} antes del descanso ({porcentaje} %).",
    en: "With {temperatura_c} °C, the tempo dropped in the second half: {pases_segundo_tiempo} passes, against {pases_primer_tiempo} before the break ({porcentaje}%).",
  },
  cancha_incomoda: {
    es: "En el césped alto de la cancha de {local}, {equipo} completó el {porcentaje} % de sus pases cortos ({completados} de {intentados}).",
    en: "On the long grass at {local}'s ground, {equipo} completed {porcentaje}% of their short passes ({completados} of {intentados}).",
  },
  // Brief 025: los insólitos.
  gol_olimpico: {
    es: "{jugador} ({equipo}) marcó un gol olímpico en el minuto {minuto}, directo del córner; {local} {marcador_local}–{marcador_visita} {visita}.",
    en: "{jugador} ({equipo}) scored straight from a corner in minute {minuto}; {local} {marcador_local}–{marcador_visita} {visita}.",
  },
  subida_portero: {
    es: "En el minuto {minuto}, con su equipo perdiendo por uno, el portero {jugador} ({equipo}) subió al área para un córner.",
    en: "In minute {minuto}, with his side one goal down, goalkeeper {jugador} ({equipo}) went up for a corner.",
  },
  subida_portero_remate: {
    es: "En el minuto {minuto}, con su equipo perdiendo por uno, el portero {jugador} ({equipo}) subió al área para un córner y llegó a rematar.",
    en: "In minute {minuto}, with his side one goal down, goalkeeper {jugador} ({equipo}) went up for a corner and got a shot away.",
  },
  subida_portero_gol: {
    es: "En el minuto {minuto}, con su equipo perdiendo por uno, el portero {jugador} ({equipo}) subió al área para un córner y marcó.",
    en: "In minute {minuto}, with his side one goal down, goalkeeper {jugador} ({equipo}) went up for a corner and scored.",
  },
  al_palo: {
    es: "{jugador} ({equipo}) estrelló un remate en el palo en el minuto {minuto}.",
    en: "{jugador} ({equipo}) hit the post in minute {minuto}.",
  },
  doble_palo: {
    es: "{jugador} ({equipo}) estrelló un remate en los dos palos en el minuto {minuto}.",
    en: "{jugador} ({equipo}) hit both posts in minute {minuto}.",
  },
  interrupcion: {
    es: "El partido se interrumpió {duracion} min en el minuto {minuto} por {causa_es}; se sumaron al descuento.",
    en: "Play was stopped for {duracion} min in minute {minuto} ({causa_en}); the time was added on.",
  },
  efecto_niebla: {
    es: "La niebla pesó en los pases largos: {completados} de {intentados} completados ({porcentaje} %).",
    en: "In the fog, long passes suffered: {completados} of {intentados} completed ({porcentaje}%).",
  },
  // Brief 020: sin verbos de mérito («marcó»): el autor no anotó para su equipo.
  autogol: {
    es: "En el minuto {minuto}, un gol en propia puerta de {jugador} ({equipo}) sumó para {beneficiado}: {local} {marcador_local}–{marcador_visita} {visita}.",
    en: "In minute {minuto}, an own goal by {jugador} ({equipo}) counted for {beneficiado}: {local} {marcador_local}–{marcador_visita} {visita}.",
  },
  // Brief 019.
  lesion: {
    es: "{jugador} ({equipo}) se retiró lesionado en el minuto {minuto} (baja de {baja_es}).",
    en: "{jugador} ({equipo}) went off injured in minute {minuto} (out for {baja_en}).",
  },
  lesion_falta: {
    es: "{jugador} ({equipo}) se retiró lesionado en el minuto {minuto}, tras una falta de {infractor} (baja de {baja_es}).",
    en: "{jugador} ({equipo}) went off injured in minute {minuto} after a foul by {infractor} (out for {baja_en}).",
  },
  bajas_del_partido: {
    es: "{equipo} llegó sin {lista_es}.",
    en: "{equipo} were without {lista_en}.",
  },
  presion_que_ahoga: {
    es: "Con presión alta, {equipo} perdió el balón {perdidas} veces en su salida antes del minuto {limite}.",
    en: "Under high pressure, {equipo} lost the ball {perdidas} times playing out before minute {limite}.",
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

/**
 * Brief 018: cómo se dicen las condiciones en los textos de los hechos. La temperatura bajo
 * cero va con el signo menos tipográfico (el Verificador lo normaliza: la cifra es la misma).
 */
export const temperaturaTxt = (c: number): string => (c < 0 ? `−${-c}` : String(c));
export const CLIMA_TEXTO: Record<string, { es: string; en: string }> = {
  despejado: { es: "cielo despejado", en: "clear skies" },
  lluvia: { es: "lluvia", en: "rain" },
  // Brief 025 (sin «la niebla / the fog»: esas frases las paga solo el efecto medido).
  niebla: { es: "niebla", en: "fog" },
};
/** Brief 025: las causas FICTICIAS de una interrupción, en los textos de los hechos. */
export const CAUSA_TEXTO: Record<string, { es: string; en: string }> = {
  perro: { es: "un perro en la cancha", en: "a dog on the pitch" },
  objeto: { es: "un objeto lanzado al campo", en: "an object thrown onto the pitch" },
  globos: { es: "globos en el área", en: "balloons in the box" },
};
export const CANCHA_TEXTO: Record<string, { es: string; en: string }> = {
  natural_corto: { es: "césped natural corto", en: "short natural grass" },
  natural_alto: { es: "césped natural alto", en: "long natural grass" },
  sintetica: { es: "césped sintético", en: "an artificial pitch" },
};
export const PRESION_TEXTO: Record<string, { es: string; en: string }> = {
  baja: { es: "baja", en: "low" },
  media: { es: "media", en: "medium" },
  alta: { es: "alta", en: "high" },
};

/** Brief 019: «1 jornada / 3 jornadas», «1 matchday / 3 matchdays». */
export const jornadasTxt = (n: number) => ({ es: `${n} ${n === 1 ? "jornada" : "jornadas"}`, en: `${n} ${n === 1 ? "matchday" : "matchdays"}` });
/** Brief 019: «A (suspendido), B (lesionado) y C (lesionado)» / «… and …». */
export function listaBajas(bajas: readonly { jugador: string; motivo: "suspension" | "lesion" }[]): { es: string; en: string } {
  const unir = (xs: string[], y: string) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${y} ${xs[xs.length - 1]}`);
  return {
    es: unir(bajas.map((b) => `${b.jugador} (${b.motivo === "suspension" ? "suspendido" : "lesionado"})`), "y"),
    en: unir(bajas.map((b) => `${b.jugador} (${b.motivo === "suspension" ? "suspended" : "injured"})`), "and"),
  };
}

/** Brief 013: cómo se dice cada canal en los textos de los hechos. */
export const CANAL_TEXTO: Record<string, { es: string; en: string }> = {
  banda_izquierda: { es: "la banda izquierda", en: "the left flank" },
  centro: { es: "el centro", en: "the middle" },
  banda_derecha: { es: "la banda derecha", en: "the right flank" },
};
