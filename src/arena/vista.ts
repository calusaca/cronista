import { ARENA } from "../sim/limites";
import type { EstadoArena, EventoArena, RegistroArena } from "./tipos";

/** Interpolación visual de estados del motor. Los reinicios declarados cortan el
 * balón; no se dibuja una trayectoria ficticia de un arco al otro. */
export function estadoVisual(registro: RegistroArena, segundos: number, discreto = false): EstadoArena {
  const tick = Math.max(0, Math.min(registro.final.tick, segundos / ARENA.pasoS));
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
  return { ...a, marcador, jugadores: a.jugadores.map((j, i) => ({ ...j, posicion: {
    x: interpolar(j.posicion.x, b.jugadores[i]!.posicion.x), y: interpolar(j.posicion.y, b.jugadores[i]!.posicion.y),
  } })), balon: { ...a.balon, posicion: corte ? a.balon.posicion : { x: interpolar(a.balon.posicion.x, b.balon.posicion.x), y: interpolar(a.balon.posicion.y, b.balon.posicion.y) } } };
}
export function narrarEventoArena(evento: EventoArena, registro: RegistroArena, idioma: "es" | "en"): string {
  const j = registro.inicial.jugadores.find(j => j.id === evento.jugador)!;
  const receptor = registro.inicial.jugadores.find(j => j.id === evento.receptor);
  const nombre = `${j.nombre} (${j.dorsal})`;
  const metros = Math.round(evento.distanciaM);
  const textos = idioma === "es" ? {
    pase: `${nombre} intenta un pase de ${metros} m hacia ${receptor?.nombre ?? "un compañero"}.`,
    recepcion: `${nombre} recibe el balón.`, intercepcion: `${nombre} intercepta la trayectoria del balón.`,
    recuperacion: `${nombre} toma el control del balón.`, tiro: `${nombre} remata hacia la portería rival.`,
    gol: `Gol de ${nombre}.`, atajada: `${nombre} detiene el remate.`, tiro_fuera: `El remate de ${nombre} sale fuera.`,
    fuera_juego: `${nombre} interviene en posición adelantada (aproximación puntual).`,
    reinicio: `Reinicio experimental desde ${nombre}; se recoloca el balón.`,
  } : {
    pase: `${nombre} attempts a ${metros} m pass towards ${receptor?.nombre ?? "a teammate"}.`,
    recepcion: `${nombre} receives the ball.`, intercepcion: `${nombre} intercepts the ball's path.`,
    recuperacion: `${nombre} takes control of the ball.`, tiro: `${nombre} shoots towards the opposing goal.`,
    gol: `Goal by ${nombre}.`, atajada: `${nombre} stops the shot.`, tiro_fuera: `${nombre}'s shot goes wide.`,
    fuera_juego: `${nombre} receives in an offside position (point approximation).`,
    reinicio: `Experimental restart from ${nombre}; the ball is repositioned.`,
  };
  return textos[evento.tipo];
}
