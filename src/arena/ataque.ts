// Brief 046 (reinicios-v4): conducción, centros y llegada al área. Funciones puras que el
// motor llama solo bajo v4. Coordenadas orientadas (`o`): el atacante va hacia x = largoM.
import { ARENA, ATAQUE_ARENA as A } from "../sim/limites";
import type { Lado } from "../sim/tipos";
import { transformar } from "./catalogo";
import { distancia, enCancha, limitar } from "./geometria";
import { prefiereConducir } from "./personalidades";
import type { EstadoArena, JugadorArena, OrdenJugador, Punto } from "./tipos";

const MEDIO_Y = ARENA.anchoM / 2;
const signoBanda = (o: Punto) => Math.sign(o.y - MEDIO_Y) || 1;

/** Banda del último tramo: x ≥ zonaCentroXM y fuera del ancho del área. */
export const enZonaCentro = (o: Punto): boolean => o.x >= A.zonaCentroXM && Math.abs(o.y - MEDIO_Y) >= ARENA.areaAnchoM / 2;

/** Punto (absoluto) dentro del área rival del lado. */
export function enAreaRival(p: Punto, lado: Lado): boolean {
  const o = transformar(p, lado);
  return o.x >= ARENA.largoM - ARENA.areaLargoM && o.x <= ARENA.largoM && Math.abs(o.y - MEDIO_Y) <= ARENA.areaAnchoM / 2;
}

/** Punto de giro (orientado) del lado del balón. */
export const puntoGiro = (o: Punto): Punto => ({ x: ARENA.largoM - A.giroFondoM, y: MEDIO_Y + signoBanda(o) * (ARENA.areaAnchoM / 2 - A.giroInteriorM) });

/** Ningún destino de conducción apunta a menos de margenFondoM de la línea de fondo ni de margenBandaM de la banda. */
export function limitarConduccion(destino: Punto, lado: Lado): Punto {
  const o = transformar(destino, lado);
  return enCancha(transformar({ x: Math.min(o.x, ARENA.largoM - A.margenFondoM), y: limitar(o.y, A.margenBandaM, ARENA.anchoM - A.margenBandaM) }, lado));
}

/** Destino por defecto de un poseedor de campo (absoluto). */
export function conduccionPorDefecto(j: JugadorArena): Punto {
  const o = transformar(j.posicion, j.lado);
  let d: Punto;
  if (o.x < A.zonaCentroXM) d = { x: o.x + ARENA.avanceConduccionM, y: o.y };
  else if (enZonaCentro(o)) d = puntoGiro(o);
  else {
    const gx = ARENA.largoM - o.x, gy = MEDIO_Y - o.y, n = Math.hypot(gx, gy) || 1;
    d = { x: o.x + gx / n * ARENA.avanceConduccionM, y: o.y + gy / n * ARENA.avanceConduccionM };
  }
  return limitarConduccion(transformar(d, j.lado), j.lado);
}

/** Objetivos orientados del centro, en orden de preferencia: palo cercano, punto penal, palo lejano. */
export function objetivosCentro(o: Punto): [Punto, Punto, Punto] {
  const s = signoBanda(o);
  return [{ x: ARENA.largoM - A.paloXM, y: MEDIO_Y + s * A.paloYM }, { x: ARENA.largoM - A.penalXM, y: MEDIO_Y }, { x: ARENA.largoM - A.paloXM, y: MEDIO_Y - s * A.paloYM }];
}

/** Un «conductor» solo centra desde conductorCentroXM o junto a su punto de giro. */
export function puedeCentrar(j: JugadorArena): boolean {
  const o = transformar(j.posicion, j.lado);
  return !prefiereConducir(j) || o.x >= A.conductorCentroXM || distancia(o, puntoGiro(o)) < A.renovarConduccionM;
}

/** Mejor objetivo con ventaja positiva para el receptor (empate por orden de la lista). */
export function opcionCentro(j: JugadorArena, estado: EstadoArena): { destino: Punto; receptor: JugadorArena } | undefined {
  const o = transformar(j.posicion, j.lado);
  // El portero rival no cuenta: disputa el centro al caer, por contacto.
  const rivales = estado.jugadores.filter(p => p.lado !== j.lado && p.puesto !== "POR");
  const propios = estado.jugadores.filter(p => p.lado === j.lado && p.id !== j.id && p.puesto !== "POR");
  let mejor: { destino: Punto; receptor: JugadorArena; ventaja: number } | undefined;
  for (const t of objetivosCentro(o)) {
    const destino = transformar(t, j.lado);
    if (distancia(j.posicion, destino) > A.centroMaxM) continue;
    const receptor = propios.filter(p => distancia(p.posicion, destino) <= A.llegadaM)
      .sort((a, b) => distancia(a.posicion, destino) - distancia(b.posicion, destino) || a.id.localeCompare(b.id))[0];
    if (!receptor) continue;
    const ventaja = Math.min(...rivales.map(r => distancia(r.posicion, destino))) - distancia(receptor.posicion, destino);
    if (ventaja > 0 && (!mejor || ventaja > mejor.ventaja)) mejor = { destino, receptor, ventaja };
  }
  return mejor && { destino: mejor.destino, receptor: mejor.receptor };
}

/** Receptor de un `centrar` con `receptor: null`: compañero de campo más cercano al destino. */
export function receptorCentro(j: JugadorArena, destino: Punto, estado: EstadoArena): JugadorArena | undefined {
  return estado.jugadores.filter(p => p.lado === j.lado && p.id !== j.id && p.puesto !== "POR")
    .sort((a, b) => distancia(a.posicion, destino) - distancia(b.posicion, destino) || a.id.localeCompare(b.id))[0];
}

/** x orientada de la línea de fuera de juego del lado atacante: la misma referencia que `adelantados`. */
export function lineaFueraDeJuego(estado: EstadoArena, lado: Lado): number {
  const defensores = estado.jugadores.filter(j => j.lado !== lado).map(j => transformar(j.posicion, lado).x).sort((a, b) => b - a);
  return Math.max(ARENA.largoM / 2, transformar(estado.balon.posicion, lado).x, defensores[1] ?? ARENA.largoM);
}

/** Acciones que entran al área sin cambio de posesión (con `cubrir`, `mover` o `presionar` no). */
export const accionesLlegada: readonly OrdenJugador["accion"][] = ["apoyar", "profundidad"];

/** Llegada al área (M08): con el balón del lado en la zona de centro (poseedor de campo o vuelo
 * `centro`), hasta `rematadores` jugadores de campo reciben palo cercano, lejano y penal, por x
 * orientada más alta. Con `cambio` de posesión en la ronda, cualquier orden es elegible
 * (v1.1: `cambio || accionPermitida`). Destinos absolutos por id. */
export function destinosLlegada(estado: EstadoArena, lado: Lado, ordenes: readonly OrdenJugador[], cambio: boolean): Map<string, Punto> {
  const resultado = new Map<string, Punto>();
  const balon = estado.balon, o = transformar(balon.posicion, lado);
  const poseedor = estado.jugadores.find(j => j.id === balon.poseedor);
  const activa = poseedor ? poseedor.lado === lado && poseedor.puesto !== "POR" : balon.vuelo?.centro === true && balon.vuelo.lado === lado;
  if (!activa || !enZonaCentro(o)) return resultado;
  const [cercano, penal, lejano] = objetivosCentro(o);
  const linea = lineaFueraDeJuego(estado, lado) - A.margenFueraJuegoM;
  estado.jugadores.filter(j => j.lado === lado && j.puesto !== "POR" && j.id !== balon.poseedor && j.id !== balon.vuelo?.receptor
      && (cambio || accionesLlegada.includes(ordenes.find(x => x.jugador === j.id)?.accion ?? "mover")))
    .sort((a, b) => transformar(b.posicion, lado).x - transformar(a.posicion, lado).x || a.id.localeCompare(b.id))
    .slice(0, A.rematadores)
    .forEach((j, i) => { const d = [cercano, lejano, penal][i]!; resultado.set(j.id, enCancha(transformar({ x: Math.min(d.x, linea), y: d.y }, lado))); });
  return resultado;
}
