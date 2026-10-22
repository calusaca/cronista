import { ARENA, CANTO_GOL } from "../sim/limites";
import type { EstadoArena, EventoArena, RegistroArena } from "./tipos";

/** Interpolación visual de estados del motor. Los reinicios declarados cortan el
 * balón; no se dibuja una trayectoria ficticia de un arco al otro. */
export function estadoVisual(registro: RegistroArena, segundos: number, discreto = false): EstadoArena {
  const bruto = segundos / ARENA.pasoS, entero = Math.round(bruto);
  const tick = Math.max(0, Math.min(registro.final.tick, Math.abs(bruto - entero) <= Number.EPSILON * ARENA.duracionMaxS / ARENA.pasoS * 4 ? entero : bruto));
  let lo = 0, hi = registro.fotogramas.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (registro.fotogramas[mid]!.tick <= tick) lo = mid; else hi = mid - 1;
  }
  const a = registro.fotogramas[lo]!, b = registro.fotogramas[lo + 1] ?? a;
  if (discreto || a.tick === b.tick) return a;
  const t = (tick - a.tick) / (b.tick - a.tick);
  const interpolar = (u: number, v: number) => u + (v - u) * t;
  const corte = registro.eventos.some(e => e.tipo === "reinicio" && e.tick > a.tick && e.tick <= b.tick);
  const marcador = { ...registro.inicial.marcador };
  for (const e of registro.eventos) if (e.tipo === "gol" && e.tick * ARENA.pasoS <= segundos + Number.EPSILON * ARENA.duracionMaxS) marcador[e.lado]++;
  return { ...a, marcador,
    ...(a.arbitro && b.arbitro ? { arbitro: { ...a.arbitro, posicion: { x: interpolar(a.arbitro.posicion.x, b.arbitro.posicion.x), y: interpolar(a.arbitro.posicion.y, b.arbitro.posicion.y) } } } : {}),
    jugadores: corte && registro.eventos.some(e => e.reinicio && e.tipo === "reinicio" && e.tick > a.tick && e.tick <= b.tick) ? a.jugadores : a.jugadores.map(j => ({ ...j, posicion: {
    x: interpolar(j.posicion.x, b.jugadores.find(p => p.id === j.id)?.posicion.x ?? j.posicion.x), y: interpolar(j.posicion.y, b.jugadores.find(p => p.id === j.id)?.posicion.y ?? j.posicion.y),
  } })), balon: { ...a.balon, posicion: corte ? a.balon.posicion : { x: interpolar(a.balon.posicion.x, b.balon.posicion.x), y: interpolar(a.balon.posicion.y, b.balon.posicion.y) } } };
}
/** Brief 050 v1.1 (4) · Gol en celebración en el cursor visible `tick` (puede ser fraccionario): el de
 * mayor tick con 0 ≤ tick − gol.tick < CANTO_GOL.celebracionS / ARENA.pasoS, buscado en todos los
 * eventos (retroceder el cursor funciona). Sin temporizadores ni estado: un gol futuro nunca cuenta. */
export function golEnCelebracion(registro: RegistroArena, tick: number): EventoArena | null {
  const ventana = CANTO_GOL.celebracionS / ARENA.pasoS;
  let elegido: EventoArena | null = null;
  for (const e of registro.eventos) {
    const edad = tick - e.tick;
    // Misma tolerancia que el marcador de estadoVisual: en el tick exacto del gol ya celebra.
    if (e.tipo === "gol" && edad >= -1e-9 && edad < ventana && (!elegido || e.tick > elegido.tick)) elegido = e;
  }
  return elegido;
}

export function narrarEventoArena(evento: EventoArena, registro: RegistroArena, idioma: "es" | "en"): string {
  const plantilla = [...registro.inicial.jugadores, ...registro.inicial.banco ?? []];
  const j = plantilla.find(j => j.id === evento.jugador)!;
  const receptor = plantilla.find(j => j.id === evento.receptor);
  const sale = plantilla.find(j => j.id === evento.sale);
  const nombre = `${j.nombre} (${j.dorsal})`;
  const metros = Math.round(evento.distanciaM);
  if (evento.tipo === "reinicio" && evento.reinicio) {
    const saque = { centro: ["Saque de centro", "Kick-off"], banda: ["Saque de banda", "Throw-in"], esquina: ["Saque de esquina", "Corner kick"], meta: ["Saque de meta", "Goal kick"] }[evento.reinicio][idioma === "es" ? 0 : 1];
    const equipo = registro.config.partido[evento.lado].nombre;
    return idioma === "es" ? `${saque} para ${equipo}; ejecuta ${nombre}.` : `${saque} for ${equipo}; ${nombre} takes it.`;
  }
  if (evento.tipo === "gol" && evento.autogol) return idioma === "es" ? `Autogol de ${nombre}; gol para ${registro.config.partido[evento.lado].nombre}.` : `Own goal by ${nombre}; goal for ${registro.config.partido[evento.lado].nombre}.`;
  // Brief 046: centro y saque desde las manos (motivo del pase, reinicios-v4).
  if (evento.tipo === "pase" && evento.motivo === "centro") return idioma === "es"
    ? `${nombre} centra al área hacia ${receptor?.nombre ?? "un compañero"} (${metros} m).` : `${nombre} crosses into the box towards ${receptor?.nombre ?? "a teammate"} (${metros} m).`;
  if (evento.tipo === "pase" && evento.motivo === "saque_manos") return idioma === "es"
    ? `${nombre} pone el balón en juego desde sus manos hacia ${receptor?.nombre ?? "el centro del campo"} (${metros} m).` : `${nombre} puts the ball back in play from the hands towards ${receptor?.nombre ?? "midfield"} (${metros} m).`;
  if (evento.tipo === "atajada" && evento.motivo === "desvio") return idioma === "es" ? `${nombre} desvía el remate; el balón sigue en juego.` : `${nombre} deflects the shot; the ball stays in play.`;
  // Brief 051: remate por encima del travesaño (reinicios-v5); sin motivo, el texto genérico de abajo.
  if (evento.tipo === "tiro_fuera" && evento.motivo === "alto") return idioma === "es" ? `El remate de ${nombre} se va por encima del travesaño.` : `${nombre}'s shot goes over the bar.`;
  const textos = idioma === "es" ? {
    pase: `${nombre} intenta un pase de ${metros} m hacia ${receptor?.nombre ?? "un compañero"}.`,
    recepcion: `${nombre} recibe el balón.`, intercepcion: `${nombre} intercepta la trayectoria del balón.`,
    recuperacion: `${nombre} toma el control del balón.`, tiro: `${nombre} remata hacia la portería rival.`,
    gol: `Gol de ${nombre}.`, atajada: `${nombre} detiene el remate.`, tiro_fuera: `El remate de ${nombre} sale fuera.`,
    fuera_juego: `${nombre} interviene en posición adelantada (aproximación puntual).`,
    reinicio: `Reinicio experimental desde ${nombre}; se recoloca el balón.`,
    plan_equipo: `${evento.entrenador} revisa el plan: ${evento.formacion}. ${explicarMotivo(evento.motivo ?? "revision", idioma)}.`,
    cambio: `${evento.entrenador}: entra ${nombre} por ${sale?.nombre ?? evento.sale}.`,
    falta: `Falta de ${nombre} sobre ${receptor?.nombre ?? "el rival"}; contacto ${evento.gravedad === "fuerza_excesiva" ? "con fuerza excesiva" : evento.gravedad}.`,
    amarilla: `Tarjeta amarilla para ${nombre}.`, roja: `Tarjeta roja para ${nombre}${evento.dobleAmarilla ? " por segunda amarilla" : ""}.`,
    final_anticipado: `Final anticipado: el equipo de ${nombre} tiene menos de siete jugadores.`,
  } : {
    pase: `${nombre} attempts a ${metros} m pass towards ${receptor?.nombre ?? "a teammate"}.`,
    recepcion: `${nombre} receives the ball.`, intercepcion: `${nombre} intercepts the ball's path.`,
    recuperacion: `${nombre} takes control of the ball.`, tiro: `${nombre} shoots towards the opposing goal.`,
    gol: `Goal by ${nombre}.`, atajada: `${nombre} stops the shot.`, tiro_fuera: `${nombre}'s shot goes wide.`,
    fuera_juego: `${nombre} receives in an offside position (point approximation).`,
    reinicio: `Experimental restart from ${nombre}; the ball is repositioned.`,
    plan_equipo: `${evento.entrenador} reviews the plan: ${evento.formacion}. ${explicarMotivo(evento.motivo ?? "revision", idioma)}.`,
    cambio: `${evento.entrenador}: ${nombre} replaces ${sale?.nombre ?? evento.sale}.`,
    falta: `${nombre} fouls ${receptor?.nombre ?? "an opponent"}; ${evento.gravedad === "fuerza_excesiva" ? "excessive force" : evento.gravedad === "temeraria" ? "reckless" : "careless"} contact.`,
    amarilla: `Yellow card for ${nombre}.`, roja: `Red card for ${nombre}${evento.dobleAmarilla ? " after a second yellow" : ""}.`,
    final_anticipado: `Early finish: ${nombre}'s team has fewer than seven players.`,
  };
  return textos[evento.tipo];
}

export function explicarMotivo(motivo: string, idioma: "es" | "en"): string {
  const motivos: Record<string, { es: string; en: string }> = {
    calor: { es: "Gestionar el esfuerzo por calor", en: "Manage effort in the heat" }, perdidas: { es: "Responder a pérdidas recientes", en: "Respond to recent turnovers" },
    desventaja: { es: "Buscar el empate", en: "Chase an equaliser" }, ventaja: { es: "Proteger la ventaja", en: "Protect the lead" },
    desgaste: { es: "Responder al desgaste medido", en: "Respond to measured fatigue" }, revision: { es: "Revisar el funcionamiento del equipo", en: "Review team performance" },
    mantener: { es: "Mantener el plan", en: "Keep the plan" }, sustitucion: { es: "Sustitución ejecutada en una interrupción", en: "Substitution completed at a stoppage" },
  };
  return motivo.split(", ").map(m => motivos[m]?.[idioma] ?? m).join(" · ");
}
