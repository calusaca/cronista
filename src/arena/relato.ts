import { hechosArena, type HechoArena } from "./inteligencia";
import { amenazaConBalon, expresionEvento, varianteVoz, type FragmentoVoz } from "./expresion";
import { RELATO_INTERVALOS } from "./protocolo";
import type { EstadoArena, EventoArena, RegistroArena } from "./tipos";
import { ARENA, MESA_ARENA, PRIORIDAD_EVENTO_ARENA } from "../sim/limites";
import type { IntervencionArena } from "./protocolo";
import { comentarioEditorial, elegirVarianteVoz, type RecuerdoVoz } from "./editorial";

export const RELATO_INTERVALO_TICKS = RELATO_INTERVALOS.completo;
const importantes = new Set(["gol", "tiro", "atajada", "tiro_fuera", "falta", "amarilla", "roja", "cambio", "fuera_juego", "final_anticipado"]);

function textoEvento(h: HechoArena, e: EventoArena, registro: RegistroArena, idioma: "es" | "en", variante: number, breve: boolean) {
  const jugadores = [...registro.inicial.jugadores, ...registro.inicial.banco ?? []];
  const j = jugadores.find(j => j.id === e.jugador)?.nombre, receptor = jugadores.find(j => j.id === e.receptor)?.nombre;
  if (!j) return idioma === "es" ? h.texto_es : h.texto_en;
  const es = idioma === "es";
  if (e.autogol || e.motivo === "desvio") return es ? h.texto_es : h.texto_en;
  if (e.tipo === "gol") return (es ? [`¡Gol de ${j}!`, `¡Gol! ¡Lo anota ${j}!`, `¡${j} marca el gol!`, `¡Gol, gol de ${j}!`] : [`Goal by ${j}!`, `Goal! ${j} scores!`, `${j} scores the goal!`, `It's a goal by ${j}!`])[variante]!;
  if (e.tipo === "atajada") return (es ? [`¡Ataja ${j}!`, `¡${j} detiene el remate!`, `¡El remate lo ataja ${j}!`, `¡Atajada de ${j}!`] : [`${j} makes the save!`, `${j} stops the shot!`, `The shot is saved by ${j}!`, `A save by ${j}!`])[variante]!;
  if (breve && e.tipo === "tiro") return (es ? [`¡Remata ${j}!`, `¡Disparo de ${j}!`, `¡${j} prueba el remate!`, `¡Le pega ${j}!`] : [`${j} shoots!`, `An attempt from ${j}!`, `${j} takes the shot!`, `${j} goes for goal!`])[variante]!;
  if (breve && e.tipo === "fuera_juego") return (es ? [`Fuera de juego de ${j}.`, `Señalan posición adelantada de ${j}.`, `${j} estaba en fuera de juego.`, `La acción se detiene: fuera de juego de ${j}.`] : [`${j} is offside.`, `Offside against ${j}.`, `${j} was caught offside.`, `Play stops for offside against ${j}.`])[variante]!;
  // Brief 046: el centro tiene frase breve propia; el saque desde las manos usa el texto de `vista`.
  if (breve && e.tipo === "pase" && e.motivo === "centro") return es ? `¡Centro de ${j}!` : `${j} sends in a cross!`;
  if (e.tipo === "pase" && e.motivo === "saque_manos") return es ? h.texto_es : h.texto_en;
  if (breve && e.tipo === "pase" && receptor) return es ? `${j} busca a ${receptor}.` : `${j} looks for ${receptor}.`;
  if (breve && e.tipo === "recepcion") return es ? `Recibe ${j}.` : `${j} receives it.`;
  return es ? h.texto_es : h.texto_en;
}

/** Posesión continua y avance comprobados en estados ya publicados. */
function conducciones(registro: RegistroArena, hastaTick: number, idioma: "es" | "en"): FragmentoVoz[] {
  const frames = registro.fotogramas.filter(f => f.tick <= hastaTick);
  const resultado: FragmentoVoz[] = []; let ultimoTick = -40;
  for (let i = 0; i < frames.length; i++) {
    const actual = frames[i]!;
    if (actual.tick - ultimoTick < 40 || actual.balon.vuelo || actual.pausa && actual.pausa.hastaTick > actual.tick) continue;
    let indice = i - 1;
    while (indice >= 0 && frames[indice]!.tick > actual.tick - 10) indice--;
    if (indice < 0) continue;
    const antes = frames[indice]!, id = actual.balon.poseedor;
    if (actual.tick - antes.tick > 15) continue;
    if (!id || frames.slice(indice, i + 1).some(f => f.balon.poseedor !== id || f.balon.vuelo || f.pausa && f.pausa.hastaTick > f.tick)) continue;
    const j = actual.jugadores.find(j => j.id === id), previo = antes.jugadores.find(j => j.id === id);
    if (!j || !previo) continue;
    const sentido = j.lado === "local" ? 1 : -1;
    const avance = j.lado === "local" ? j.posicion.x / ARENA.largoM : (ARENA.largoM - j.posicion.x) / ARENA.largoM;
    if (avance < 0.75 || sentido * j.velocidad.x < 1 || sentido * (j.posicion.x - previo.posicion.x) < 2) continue;
    const variante = varianteVoz(registro.config.partido.seed, `conduccion:${id}:${actual.tick}`);
    const texto = (idioma === "es" ? [`${j.nombre} avanza hacia el área.`, `¡Progresa ${j.nombre} con el balón!`, `${j.nombre} lleva el balón hacia el área.`, `¡Sigue avanzando ${j.nombre}!`] : [`${j.nombre} advances towards the box.`, `${j.nombre} drives forward with the ball!`, `${j.nombre} carries the ball towards the box.`, `${j.nombre} keeps advancing!`])[variante]!;
    resultado.push({ tick: actual.tick, texto, emocion: "tension", intensidad: Math.max(0.5, amenazaConBalon(actual, j.lado)), variante, fuentes: [], fotogramas: [antes.tick, actual.tick] });
    ultimoTick = actual.tick;
  }
  return resultado;
}

/** Cada frase usa únicamente hechos y estados anteriores o simultáneos a su tick. */
export function construirRelato(registro: RegistroArena, desdeTick: number, hastaTick: number, modo: "vivo" | "completo" | "buffer", idioma: "es" | "en", opciones: { cierre?: boolean; entradaTick?: number; memoria?: readonly RecuerdoVoz[] } = {}) {
  const intervalo = RELATO_INTERVALOS[modo];
  // Compatibilidad con clientes anteriores que pedían ventanas vivas de 10 s.
  const legado = modo === "vivo" && desdeTick % 100 === 0 && hastaTick <= desdeTick + 100;
  if (!Number.isInteger(desdeTick) || desdeTick < 0 || !Number.isInteger(hastaTick) || hastaTick <= desdeTick || hastaTick > registro.final.tick || !(desdeTick % intervalo === 0 && hastaTick <= desdeTick + intervalo || legado)) throw new Error("Ventana de relato no publicada o inválida");
  const pertenece = (tick: number) => tick > desdeTick || desdeTick === 0 && tick === 0;
  const hechos = hechosArena(registro, hastaTick), todos = hechos.filter(h => pertenece(h.tick));
  if (opciones.cierre && modo !== "buffer") throw new Error("El cierre selectivo requiere emisión en vivo");
  if (opciones.entradaTick !== undefined && (modo !== "buffer" || opciones.cierre || !Number.isInteger(opciones.entradaTick) || opciones.entradaTick < desdeTick || opciones.entradaTick > hastaTick)) throw new Error("Entrada de narración inválida");
  if (modo === "buffer") return relatoBuffer(registro, desdeTick, hastaTick, idioma, todos, opciones.cierre, opciones.entradaTick, opciones.memoria);
  const seleccion = modo === "completo" ? todos : todos.filter(h => importantes.has(h.tipo) || h === todos.at(-1));
  const ids = new Set(seleccion.map(h => h.id));
  const eventos = new Map(registro.eventos.filter(e => e.tick <= hastaTick).map(e => [e.id, e]));
  const frames = registro.fotogramas.filter(f => f.tick <= hastaTick);
  let cursor = 0, estado: EstadoArena = registro.inicial;
  let anterior: { tick: number; intensidad: number; lado: EventoArena["lado"] } | null = null;
  const fragmentos: FragmentoVoz[] = [];
  for (const h of hechos) {
    const e = eventos.get(h.id.slice(6))!;
    while (cursor < frames.length && frames[cursor]!.tick <= e.tick) estado = frames[cursor++]!;
    const expresion = expresionEvento(e, estado, anterior, registro.config.duracionS);
    anterior = { tick: e.tick, intensidad: expresion.intensidad, lado: e.lado };
    if (!ids.has(h.id)) continue;
    const variante = varianteVoz(registro.config.partido.seed, e.id);
    fragmentos.push({ tick: e.tick, texto: textoEvento(h, e, registro, idioma, variante, modo === "vivo"), ...expresion, variante, fuentes: h.eventos, fotogramas: [] });
  }
  const carreras = conducciones(registro, hastaTick, idioma).filter(f => pertenece(f.tick));
  fragmentos.push(...carreras); fragmentos.sort((a, b) => a.tick - b.tick);
  if (desdeTick === 0) fragmentos.unshift({ tick: 0, texto: idioma === "es" ? modo === "vivo" ? "Comienza el partido." : `Comienza el partido entre ${registro.config.partido.local.nombre} y ${registro.config.partido.visita.nombre}.` : modo === "vivo" ? "The match begins." : `The match between ${registro.config.partido.local.nombre} and ${registro.config.partido.visita.nombre} begins.`, emocion: "serena", intensidad: 0.25, variante: 0, fuentes: [], fotogramas: [0] });
  if (hastaTick === Math.round(registro.config.duracionS * 10) || registro.final.finalizado && hastaTick === registro.final.tick) {
    const m = registro.final.marcador;
    fragmentos.push({ tick: hastaTick, texto: idioma === "es" ? `Final del partido. ${registro.config.partido.local.nombre}, ${m.local}; ${registro.config.partido.visita.nombre}, ${m.visita}.` : `Full time. ${registro.config.partido.local.nombre}, ${m.local}; ${registro.config.partido.visita.nombre}, ${m.visita}.`, emocion: "serena", intensidad: 0.25, variante: 1, fuentes: [], fotogramas: [hastaTick] });
  }
  return { desdeTick, hastaTick, modo, idioma, texto: fragmentos.map(f => f.texto).join(" "), fragmentos, fuentes: seleccion.flatMap(h => h.eventos), fotogramas: [...new Set(fragmentos.flatMap(f => f.fotogramas))], eventosDisponibles: todos.length, eventosNarrados: seleccion.length, conduccionesNarradas: carreras.length };
}

/** Cada ventana ofrece una jugada seleccionada o un comentario del estado actual.
 * Todo el contexto de una intervención termina en su propio tick de publicación. */
function relatoBuffer(registro: RegistroArena, desdeTick: number, hastaTick: number, idioma: "es" | "en", hechos: HechoArena[], cierre = false, entradaTick?: number, memoria: readonly RecuerdoVoz[] = []) {
  const prioridadEvento = PRIORIDAD_EVENTO_ARENA;
  const candidatos = registro.eventos.filter(e => (e.tick > desdeTick || desdeTick === 0 && e.tick === 0) && e.tick <= hastaTick && prioridadEvento[e.tipo]);
  candidatos.sort((a, b) => prioridadEvento[b.tipo]! - prioridadEvento[a.tipo]! || b.tick - a.tick);
  const evento = candidatos[0], hecho = evento && hechos.find(h => h.eventos.includes(evento.id));
  const fragmentos: FragmentoVoz[] = [];
  const es = idioma === "es";
  let prioridad = 10, eventosNarrados = 0;
  let tipoRelato: "jugada" | "comentario" | "estado" | "entrada" | "cierre" = "comentario", firmaEstado: string | undefined;
  let claveVoz: string | undefined, temaVoz: string | undefined;
  if (entradaTick !== undefined) { tipoRelato = "entrada"; }
  else if (cierre) {
    tipoRelato = "cierre";
    if (!(hastaTick === Math.round(registro.config.duracionS / ARENA.pasoS) || registro.final.finalizado && hastaTick === registro.final.tick)) throw new Error("El partido todavía no ha terminado");
    const goles = registro.eventos.filter(e => e.tipo === "gol" && e.tick <= hastaTick);
    const marcador = { ...registro.inicial.marcador };
    for (const gol of goles) marcador[gol.lado]++;
    fragmentos.push({ tick: hastaTick, texto: es ? `Final del partido. ${registro.config.partido.local.nombre}, ${marcador.local}; ${registro.config.partido.visita.nombre}, ${marcador.visita}.` : `Full time. ${registro.config.partido.local.nombre}, ${marcador.local}; ${registro.config.partido.visita.nombre}, ${marcador.visita}.`, emocion: "serena", intensidad: .25, variante: 0, fuentes: goles.map(e => e.id), fotogramas: [hastaTick] });
    prioridad = 0;
  } else if (evento && hecho) {
    tipoRelato = "jugada";
    const estado = [...registro.fotogramas].reverse().find(f => f.tick <= evento.tick) ?? registro.inicial;
    const variante = varianteVoz(registro.config.partido.seed, evento.id);
    const textos = Array.from({ length: 4 }, (_, i) => textoEvento(hecho, evento, registro, idioma, i, true));
    const texto = elegirVarianteVoz(textos, memoria, evento.tick, variante);
    claveVoz = `evento:${evento.id}`; temaVoz = evento.tipo;
    fragmentos.push({ tick: evento.tick, texto, ...expresionEvento(evento, estado, null, registro.config.duracionS), variante: varianteVoz(registro.config.partido.seed, evento.id), fuentes: [evento.id], fotogramas: [] });
    prioridad = prioridadEvento[evento.tipo]!; eventosNarrados = 1;
  } else if (desdeTick === 0) {
    fragmentos.push({ tick: 0, texto: es ? `Comienza el partido entre ${registro.config.partido.local.nombre} y ${registro.config.partido.visita.nombre}.` : `The match between ${registro.config.partido.local.nombre} and ${registro.config.partido.visita.nombre} begins.`, emocion: "serena", intensidad: .25, variante: 0, fuentes: [], fotogramas: [0] });
  }
  if (!fragmentos.length) {
    const tick = entradaTick ?? hastaTick;
    const comentario = comentarioEditorial(registro, tick, idioma, memoria, entradaTick !== undefined);
    tipoRelato = entradaTick === undefined ? comentario?.firmaEstado ? "estado" : "comentario" : "entrada";
    if (comentario) {
      firmaEstado = comentario.firmaEstado; claveVoz = comentario.clave; temaVoz = comentario.tema;
      fragmentos.push({ tick, texto: comentario.texto, emocion: "serena", intensidad: .25, variante: Math.floor(tick / 50) % 4, fuentes: comentario.fuentes, fotogramas: comentario.fotogramas });
      eventosNarrados = comentario.fuentes.length;
    }
  }
  return { desdeTick, hastaTick, modo: "buffer" as const, idioma, texto: fragmentos.map(f => f.texto).join(" "), fragmentos, fuentes: fragmentos.flatMap(f => f.fuentes), fotogramas: fragmentos.flatMap(f => f.fotogramas), eventosDisponibles: hechos.filter(h => h.tick <= (entradaTick ?? hastaTick)).length, eventosNarrados, conduccionesNarradas: 0, prioridad, cierre, tipoRelato, firmaEstado, claveVoz, temaVoz, ...(entradaTick === undefined ? {} : { entradaTick }) };
}

/** Brief 045: un clip por intervención. Fragmento opcional de cesión del narrador y un
 * fragmento con TODAS las oraciones del invitado. La duración se decide por caracteres:
 * si cesión + invitado supera el máximo se omite la cesión (nunca el dato); si el invitado
 * solo lo supera, se recorta a su primera oración (primer dato del estadista).
 * v3.1: sin memoria. La cesión sale de `cesiones[idioma][rol]` por `varianteVoz(seed, id)`:
 * un SSML por intervención e idioma, una sola entrada de caché para todos los espectadores. */
export function relatoIntervencion(intervencion: IntervencionArena, seed: number, idioma: "es" | "en") {
  const es = idioma === "es", tick = intervencion.tick;
  const textos = intervencion.oraciones.map(o => es ? o.texto_es : o.texto_en);
  const completo = textos.join(" ");
  const usadas = completo.length > MESA_ARENA.maxCaracteresIntervencion ? 1 : textos.length;
  const invitado = textos.slice(0, usadas).join(" ");
  const nombre = MESA_ARENA.nombres[idioma][intervencion.rol];
  const cesiones = MESA_ARENA.cesiones[idioma][intervencion.rol].map(c => c.replace("{nombre}", nombre));
  const cesion = cesiones[varianteVoz(seed, intervencion.id) % cesiones.length]!;
  const conCesion = cesion.length + invitado.length <= MESA_ARENA.maxCaracteresIntervencion;
  const fuentes = [...new Set(intervencion.evidencia.slice(0, usadas).flatMap(e => e.eventos))];
  const fragmentos: FragmentoVoz[] = [
    ...(conCesion ? [{ tick, texto: cesion, emocion: "serena" as const, intensidad: .25, variante: 0, fuentes: [], fotogramas: [], rol: "narrador" as const }] : []),
    { tick, texto: invitado, emocion: "serena", intensidad: intervencion.rol === "estadista" ? .1 : .18, variante: varianteVoz(seed, `${intervencion.id}:invitado`), fuentes, fotogramas: [], rol: intervencion.rol },
  ];
  return {
    desdeTick: tick, hastaTick: tick, modo: "buffer" as const, idioma, texto: fragmentos.map(f => f.texto).join(" "), fragmentos, fuentes, fotogramas: [] as number[],
    eventosDisponibles: 0, eventosNarrados: usadas, conduccionesNarradas: 0, prioridad: MESA_ARENA.prioridadInvitado, cierre: false, tipoRelato: "invitado" as const,
    firmaEstado: undefined, claveVoz: intervencion.id, temaVoz: `${intervencion.rol}:${intervencion.tema}`, rol: intervencion.rol, intervencion: intervencion.id, modoIntervencion: intervencion.modo, cesion: conCesion,
  };
}
