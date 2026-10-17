// Brief 029: presentación completa y determinista del stream, sin inventar tracking.
import { enCancha, micro, type MicroEvento, type MicroPartido } from "../sim/micro";
import type { Canal, TipoMicro } from "../sim/limites";
import type { Evento, Lado, Partido, Zona } from "../sim/tipos";
import { formatoXg, type LenguaXg, type ModoXg } from "../ui/textos";

type Lengua = LenguaXg;
export interface AccionCompleta {
  id: string;
  minuto: number;
  periodo: 1 | 2;
  equipo: Lado;
  marcador: { local: number; visita: number };
  registro: { capa: "micro"; evento: MicroEvento } | { capa: "macro"; evento: Evento; portero?: string };
}

/** Se intercala por ancla, no por minuto: a 45′/90′ también hay un orden causal. */
export function accionesCompletas(p: Partido, m: MicroPartido = micro(p)): AccionCompleta[] {
  const porAncla = new Map<string, MicroEvento[]>();
  for (const e of m.eventos) {
    const grupo = porAncla.get(e.ancla) ?? [];
    grupo.push(e);
    porAncla.set(e.ancla, grupo);
  }
  let periodo: 1 | 2 = 1;
  let inicios = 0;
  const marcador = { local: 0, visita: 0 };
  const filas: AccionCompleta[] = [];
  p.eventos.forEach((e, i) => {
    if (e.tipo === "inicio_periodo") periodo = ++inicios >= 2 ? 2 : 1;
    for (const x of porAncla.get(e.id) ?? []) {
      filas.push({ id: x.id, minuto: x.minuto, periodo, equipo: x.equipo, marcador: { ...marcador }, registro: { capa: "micro", evento: x } });
    }
    if (e.tipo === "gol") marcador[e.equipo]++;
    // `atajada.equipo` es el tirador; el portero en cancha pertenece al contrario.
    const equipo = e.tipo === "atajada" ? otro(e.equipo) : e.equipo;
    const portero = e.tipo === "atajada" ? enCancha(p, i)[equipo].find((j) => j.posicion === "POR")?.nombre : undefined;
    filas.push({ id: e.id, minuto: e.minuto, periodo, equipo, marcador: { ...marcador }, registro: { capa: "macro", evento: e, ...(portero ? { portero } : {}) } });
  });
  return filas;
}

const otro = (l: Lado): Lado => l === "local" ? "visita" : "local";
const ZONAS: Record<Lengua, Record<Zona, string>> = {
  es: { defensa: "tercio defensivo", medio: "mediocampo", ataque: "tercio de ataque" },
  en: { defensa: "defensive third", medio: "midfield", ataque: "final third" },
};
const CANALES: Record<Lengua, Record<Canal, string>> = {
  es: { banda_izquierda: "banda izquierda", centro: "centro", banda_derecha: "banda derecha" },
  en: { banda_izquierda: "left flank", centro: "middle", banda_derecha: "right flank" },
};
const NOMBRES: Record<Lengua, Record<Evento["tipo"] | TipoMicro, string>> = {
  es: { inicio_periodo: "Saque inicial", fin_periodo: "Fin del tiempo", pase_clave: "Pase clave", tiro: "Remate", gol: "Gol", atajada: "Atajada", falta: "Falta", tarjeta_amarilla: "Amarilla", tarjeta_roja: "Roja", corner: "Córner", fuera_de_juego: "Fuera de juego", cambio: "Cambio", lesion: "Lesión", subida_portero: "Subida del portero", interrupcion: "Interrupción", pase: "Pase", conduccion: "Conducción", regate: "Regate", duelo: "Duelo", perdida: "Pérdida", recuperacion: "Recuperación" },
  en: { inicio_periodo: "Kick-off", fin_periodo: "End of half", pase_clave: "Key pass", tiro: "Shot", gol: "Goal", atajada: "Save", falta: "Foul", tarjeta_amarilla: "Yellow card", tarjeta_roja: "Red card", corner: "Corner", fuera_de_juego: "Offside", cambio: "Substitution", lesion: "Injury", subida_portero: "Goalkeeper goes up", interrupcion: "Stoppage", pase: "Pass", conduccion: "Carry", regate: "Dribble", duelo: "Duel", perdida: "Ball lost", recuperacion: "Recovery" },
};
const ORIGEN: Record<Lengua, Record<string, string>> = {
  es: { area_chica: "área chica", punto_penal: "punto penal", frontal_del_area: "frontal del área", banda_izquierda: "banda izquierda", banda_derecha: "banda derecha", media_distancia: "media distancia" },
  en: { area_chica: "six-yard box", punto_penal: "penalty spot", frontal_del_area: "edge of the box", banda_izquierda: "left flank", banda_derecha: "right flank", media_distancia: "long range" },
};
const DESTINO: Record<Lengua, Record<string, string>> = {
  es: { palo_izquierdo: "palo izquierdo", palo_derecho: "palo derecho", centro_del_arco: "centro del arco" },
  en: { palo_izquierdo: "left post", palo_derecho: "right post", centro_del_arco: "centre of goal" },
};
const ALTURA: Record<Lengua, Record<string, string>> = {
  es: { raso: "raso", media: "a media altura", alta: "alto" },
  en: { raso: "low", media: "mid-height", alta: "high" },
};
const DEFINICION: Record<Lengua, Record<string, string>> = {
  es: { jugada: "", cabezazo: "de cabeza", mano_a_mano: "mano a mano", vaselina: "vaselina", chilena: "chilena", tijera: "tijera", media_cancha: "desde media cancha", olimpico: "gol olímpico" },
  en: { jugada: "", cabezazo: "header", mano_a_mano: "one-on-one", vaselina: "chip", chilena: "bicycle kick", tijera: "scissor kick", media_cancha: "from halfway", olimpico: "direct from the corner" },
};

export const nombreAccion = (a: AccionCompleta, l: Lengua) => NOMBRES[l][a.registro.evento.tipo];

export function ubicacionAccion(a: AccionCompleta, l: Lengua): string {
  const e = a.registro.evento;
  if (a.registro.capa === "micro") return `${ZONAS[l][a.registro.evento.zona]} · ${CANALES[l][a.registro.evento.canal]}`;
  // La zona macro de una atajada está dada desde el atacante: no atribuirla al portero.
  const macro = a.registro.evento;
  if (macro.tipo === "atajada") return "";
  return [macro.zonaOrigen ? ORIGEN[l][macro.zonaOrigen] : e.zona ? ZONAS[l][e.zona] : "", macro.banda ? (l === "es" ? `banda ${macro.banda}` : `${macro.banda === "izquierda" ? "left" : "right"} flank`) : ""].filter(Boolean).join(" · ");
}

export function explicarAccion(a: AccionCompleta, p: Partido, l: Lengua, modo: ModoXg = "aficionado"): string {
  const es = l === "es";
  if (a.registro.capa === "micro") {
    const x = a.registro.evento;
    switch (x.tipo) {
      case "pase": return es
        ? `${x.jugador} pasa${metros(x.distanciaM)} hacia ${x.receptor ?? "un compañero"}. ${x.completado ? "El pase llega a su receptor." : "El pase no llega a su receptor."}`
        : `${x.jugador} passes${metros(x.distanciaM)} to ${x.receptor ?? "a teammate"}. ${x.completado ? "The pass reaches its receiver." : "The pass does not reach its receiver."}`;
      case "conduccion": return es ? `${x.jugador} conduce el balón${metros(x.distanciaM)}.` : `${x.jugador} carries the ball${metros(x.distanciaM)}.`;
      case "regate": return es ? `${x.jugador} intenta superar a ${x.rival} con un regate. ${x.exito ? "Supera al rival y conserva el balón." : "El rival frena el regate."}` : `${x.jugador} takes on ${x.rival}. ${x.exito ? "The dribble succeeds; the player keeps the ball." : "The opponent stops the dribble."}`;
      case "duelo": return es ? `${x.jugador} disputa el balón con ${x.rival}. ${x.exito ? "Gana el duelo." : "Pierde el duelo."}` : `${x.jugador} contests the ball with ${x.rival}. ${x.exito ? "Wins the duel." : "Loses the duel."}`;
      case "perdida": return es ? `${x.jugador} pierde la posesión del balón.` : `${x.jugador} loses possession of the ball.`;
      case "recuperacion": return es ? `${x.jugador} recupera el balón para ${p.config[x.equipo].nombre}.` : `${x.jugador} wins the ball back for ${p.config[x.equipo].nombre}.`;
    }
  }
  const e = a.registro.evento;
  const quien = e.jugador ?? (es ? "el jugador registrado" : "the recorded player");
  const equipo = p.config[e.equipo].nombre;
  switch (e.tipo) {
    case "inicio_periodo": return es ? `Empieza el ${a.periodo === 1 ? "primer" : "segundo"} tiempo. ${equipo} saca de centro.` : `The ${a.periodo === 1 ? "first" : "second"} half starts. ${equipo} kicks off.`;
    case "fin_periodo": return es ? `${a.periodo === 1 ? "Termina el primer tiempo" : "Final del partido"}. Marcador: ${p.config.local.nombre} ${a.marcador.local}–${a.marcador.visita} ${p.config.visita.nombre}.` : `${a.periodo === 1 ? "Half-time" : "Full time"}. Score: ${p.config.local.nombre} ${a.marcador.local}–${a.marcador.visita} ${p.config.visita.nombre}.`;
    case "pase_clave": return es ? `${quien} da un pase clave para ${equipo}.` : `${quien} plays a key pass for ${equipo}.`;
    case "tiro": {
      const datos = [e.distanciaM !== undefined ? `${e.distanciaM} m` : "", e.velocidadKmh !== undefined ? `${e.velocidadKmh} km/h` : "", e.xg !== undefined ? formatoXg(e.xg, modo, l) : "", e.definicion ? DEFINICION[l][e.definicion] : "", e.destino ? `${es ? "hacia el" : "towards the"} ${DESTINO[l][e.destino]}` : "", e.altura ? ALTURA[l][e.altura] : "", e.alPalo ? (es ? `toca ${e.alPalo === 2 ? "los dos palos" : "el palo"}` : `hits ${e.alPalo === 2 ? "both posts" : "the post"}`) : ""].filter(Boolean);
      return `${quien} ${es ? (e.penal ? "remata de penal" : "remata") : (e.penal ? "takes a penalty" : "shoots")}${datos.length ? ` · ${datos.join(" · ")}` : ""}.`;
    }
    case "gol": return e.autogol
      ? (es ? `${quien}, de ${p.config[otro(e.equipo)].nombre}, marca en propia puerta. El gol suma para ${equipo}.` : `${quien} of ${p.config[otro(e.equipo)].nombre} scores an own goal. The goal counts for ${equipo}.`)
      : `${es ? "Gol de" : "Goal by"} ${quien} ${es ? "para" : "for"} ${equipo}${e.definicion && DEFINICION[l][e.definicion] ? ` · ${DEFINICION[l][e.definicion]}` : ""}.`;
    case "atajada": {
      const portero = a.registro.portero ?? (es ? `El portero de ${p.config[a.equipo].nombre}` : `The goalkeeper for ${p.config[a.equipo].nombre}`);
      const lado = e.ladoPortero ? ({ es: { su_izquierda: "a su izquierda", su_derecha: "a su derecha", centro: "por el centro" }, en: { su_izquierda: "to his left", su_derecha: "to his right", centro: "down the middle" } }[l][e.ladoPortero]) : "";
      return `${portero} ${es ? "ataja el remate" : "saves the shot"}${lado ? ` · ${lado}` : ""}.`;
    }
    case "falta": return es ? `${quien}, de ${equipo}, comete una falta.` : `${quien} of ${equipo} commits a foul.`;
    case "tarjeta_amarilla": return es ? `${quien} recibe una tarjeta amarilla.` : `${quien} receives a yellow card.`;
    case "tarjeta_roja": return es ? `${quien} recibe una tarjeta roja y deja el campo.` : `${quien} receives a red card and leaves the field.`;
    case "corner": return es ? `${quien} ejecuta un córner para ${equipo}.` : `${quien} takes a corner for ${equipo}.`;
    case "fuera_de_juego": return es ? `Fuera de juego de ${quien}, de ${equipo}.` : `${quien} of ${equipo} is offside.`;
    case "cambio": return es ? `Cambio en ${equipo}: sale ${e.sale ?? "el jugador registrado"} y entra ${quien}.` : `${equipo} makes a substitution: ${e.sale ?? "the recorded player"} goes off; ${quien} comes on.`;
    case "lesion": return es ? `${quien} se lesiona${e.baja !== undefined ? ` y queda de baja ${e.baja} jornadas` : ""}.` : `${quien} is injured${e.baja !== undefined ? ` and is out for ${e.baja} matchdays` : ""}.`;
    case "subida_portero": return es ? `El portero ${quien} sube a participar en el córner de ${equipo}.` : `Goalkeeper ${quien} goes up for ${equipo}'s corner.`;
    case "interrupcion": {
      const causa = e.causa ? ({ es: { perro: "un perro en la cancha", objeto: "un objeto lanzado a la cancha", globos: "globos en el área" }, en: { perro: "a dog on the pitch", objeto: "an object thrown onto the pitch", globos: "balloons in the box" } }[l][e.causa]) : (es ? "una interrupción registrada" : "a recorded stoppage");
      return es ? `Se detiene el juego por ${causa}${e.duracion !== undefined ? `. Se añaden ${e.duracion} minutos al descuento` : ""}.` : `Play stops because of ${causa}${e.duracion !== undefined ? `. ${e.duracion} minutes are added to stoppage time` : ""}.`;
    }
  }
}
const metros = (n: number | undefined) => n === undefined ? "" : ` ${n} m`;

export interface FiltroAcciones { periodo: "todos" | "1" | "2"; equipo: "todos" | Lado; tipo: "todos" | Evento["tipo"] | TipoMicro; buscar: string }
const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
export function filtrarAcciones(filas: AccionCompleta[], filtro: FiltroAcciones, p: Partido): AccionCompleta[] {
  const q = normalizar(filtro.buscar);
  return filas.filter((a) => {
    const e = a.registro.evento;
    return (filtro.periodo === "todos" || a.periodo === Number(filtro.periodo)) &&
      (filtro.equipo === "todos" || a.equipo === filtro.equipo) &&
      (filtro.tipo === "todos" || e.tipo === filtro.tipo) &&
      (!q || normalizar([p.config[a.equipo].nombre, e.jugador, a.registro.capa === "micro" ? `${a.registro.evento.receptor ?? ""} ${a.registro.evento.rival ?? ""}` : a.registro.evento.sale, a.registro.capa === "macro" ? a.registro.portero : ""].filter(Boolean).join(" ")).includes(q));
  });
}

export const ACCIONES_POR_PAGINA = 80;
export function paginaDelMinuto(filas: AccionCompleta[], minuto: number): number {
  const indice = filas.findIndex((a) => a.minuto >= minuto);
  return Math.floor((indice < 0 ? Math.max(0, filas.length - 1) : indice) / ACCIONES_POR_PAGINA);
}

export function exportarPartido(p: Partido, filas: AccionCompleta[], l: Lengua, modo: ModoXg): string {
  const es = l === "es";
  return [
    `${es ? "Partido completo" : "Full match"}: ${p.config.local.nombre} — ${p.config.visita.nombre}`,
    es ? "Partido simulado. Minutos y zonas registrados; sin segundos exactos ni movimientos sin balón." : "Simulated match. Recorded minutes and zones; no exact seconds or off-ball tracking.",
    `${filas.length} ${es ? "acciones registradas" : "recorded actions"}.`, "",
    ...filas.map((a) => `[${a.id}] ${a.periodo}${es ? "T" : "H"} ${a.minuto}′ | ${p.config[a.equipo].nombre} | ${explicarAccion(a, p, l, modo)}${ubicacionAccion(a, l) ? ` | ${ubicacionAccion(a, l)}` : ""} | ${a.marcador.local}–${a.marcador.visita}`),
  ].join("\n") + "\n";
}
