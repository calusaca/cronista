// Brief 055 § 6 (v1.1 § 7) · Iconos de eventos de la arena con la grafía de transmisión (balón,
// diana, guante, tarjeta, banderín, silbato). Siempre aria-hidden y junto a un texto que ya nombra
// el evento: ningún icono transmite información que no esté en el texto adyacente. La celda
// `span.arena-event-icon` existe SIEMPRE (vacía y sin data-kind cuando el evento no lleva icono),
// para que cada fila del feed y de la descripción tenga las mismas celdas.
import type { EventoArena } from "../arena/tipos";
import { base, IconoEvento } from "./Iconos";

export type ClaseIcono = "gol" | "tiro" | "tiro_fuera" | "atajada" | "amarilla" | "roja" | "cambio" | "fuera_juego" | "falta" | "esquina" | "reinicio";

/** Tabla § 6.1: `pase`, `recepcion`, `intercepcion`, `recuperacion`, `plan_equipo` y `final_anticipado` no llevan icono. */
export function claseIcono(e: Pick<EventoArena, "tipo" | "reinicio" | "motivo">): ClaseIcono | null {
  switch (e.tipo) {
    case "gol": case "tiro": case "tiro_fuera": case "atajada": case "amarilla": case "roja": case "cambio": case "fuera_juego": case "falta":
      return e.tipo;
    case "reinicio":
      // Brief 070: no hay icono propio del penal; usa el de la falta (silbato). El tiro libre, el de reinicio.
      return e.reinicio === "esquina" ? "esquina" : e.reinicio === "penal" ? "falta" : "reinicio";
    default:
      return null;
  }
}

/** § 6.2 · Icono de una fila del panel de cifras (y de la ficha del jugador), por clave. */
export function iconoDeCifra(clave: string): ClaseIcono | null {
  switch (clave) {
    case "remates": case "remates_directos": case "remates_indirectos": case "remates_cercanos": return "tiro";
    case "esquinas": return "esquina";
    case "fueras_juego": return "fuera_juego";
    case "amarillas": return "amarilla";
    case "rojas": return "roja";
    case "atajadas": return "atajada";
    case "faltas": return "falta";
    default: return null;
  }
}

function Dibujo({ clase, size }: { clase: ClaseIcono; size: number }) {
  switch (clase) {
    case "tiro_fuera":
      // Diana con flecha que sale.
      return <svg {...base(size)}><circle cx="10" cy="14" r="7" /><path d="M14 10 l6 -6 M20 4 h-4 M20 4 v4" /></svg>;
    case "reinicio":
      // Balón en el punto.
      return <svg {...base(size)}><circle cx="12" cy="9" r="4" /><path d="M4 19 h16" /><path d="M12 13 v6" /></svg>;
    case "amarilla": return <IconoEvento tipo="tarjeta_amarilla" size={size} />;
    case "roja": return <IconoEvento tipo="tarjeta_roja" size={size} />;
    case "fuera_juego": return <IconoEvento tipo="fuera_de_juego" size={size} />;
    case "esquina": return <IconoEvento tipo="corner" size={size} />;
    default: return <IconoEvento tipo={clase} size={size} />;
  }
}

/** Celda del icono para una clase (o vacía con `null`). */
export function IconoClase({ clase, size = 14 }: { clase: ClaseIcono | null; size?: number }) {
  return <span className="arena-event-icon" data-kind={clase ?? undefined} aria-hidden="true">{clase && <Dibujo clase={clase} size={size} />}</span>;
}

export function IconoEventoArena({ evento, size = 14 }: { evento: EventoArena; size?: number }) {
  return <IconoClase clase={claseIcono(evento)} size={size} />;
}
