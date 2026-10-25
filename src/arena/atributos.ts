// Brief 063 · Módulo puro de atributos (e identidad de juego, que llega con reinicios-v8). Publicación 1
// (reinicios-v6): la línea de un puesto (§ 4.6), que usan el repliegue y la persecución. Publicación 2
// (reinicios-v7): los seis atributos de jugador (§ 4.4), su rasgo distintivo (§ 9.1) y las funciones de efecto
// de § 7.1, centradas: con el atributo en ATRIBUTOS_ARENA.neutro cada una vale exactamente 1 (o 0 en el duelo).
// Publicación 3 (reinicios-v8): la identidad de juego del club (§ 4.5), derivada del nombre normalizado.
// Las cifras salen de ATRIBUTOS_ARENA; no consume el azar del generador histórico.
import { ATRIBUTOS_ARENA as AT } from "../sim/limites";
import { prngDerivado } from "../sim/prng";
import type { Posicion } from "../sim/tipos";
import { claveClub } from "./identidad";
import { atributosJugador, estilosJuego, type AtributoJugador, type AtributosJugador, type EstiloJuego, type LineaArena, type PerfilJugador } from "./tipos";

/** Línea del puesto ACTUAL (un medio natural que juega de extremo persigue como delantero). */
export function lineaDePuesto(puesto: string): LineaArena {
  if (puesto === "POR") return "POR";
  if (puesto.startsWith("DFC") || puesto === "LI" || puesto === "LD" || puesto.startsWith("CAR")) return "DEF";
  if (puesto.startsWith("DC") || puesto === "EI" || puesto === "ED") return "DEL";
  return "MED";
}

const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/** § 4.4 · Atributos de un jugador: PRNG `atributos:arena-v7:{equipo}:{jugador}`, seis extracciones de variación en
 * el orden de `atributosJugador`, una extracción del atributo distintivo (el portero, entre velocidad y visión),
 * base de su posición natural + ajuste de su perfil + variación + distintivo, redondeo y cota. No depende de la
 * semilla del partido, del lado, de la formación ni de la duración. */
export function atributosDe(equipo: string, jugador: string, posicion: Posicion, perfil: PerfilJugador): AtributosJugador {
  const rng = prngDerivado(AT.semilla, `atributos:arena-v7:${equipo}:${jugador}`);
  const variacion = atributosJugador.map(() => rng.int(-AT.variacion, AT.variacion));
  const distintivo = rng.pick(posicion === "POR" ? (["velocidad", "vision"] as const) : atributosJugador);
  const ajuste: Partial<Record<AtributoJugador, number>> = AT.perfil[perfil];
  return Object.fromEntries(atributosJugador.map((a, k) => [a,
    limitar(Math.round(AT.base[posicion][a] + (ajuste[a] ?? 0) + variacion[k]! + (a === distintivo ? AT.distintivo : 0)), AT.min, AT.max)])) as AtributosJugador;
}

/** § 9.1 · Rasgo distintivo: el atributo mayor (en empate, el primero de `atributosJugador`) si alcanza
 * `distintivoMin`; si no, null. */
export function rasgoDistintivo(a: AtributosJugador): { atributo: AtributoJugador; valor: number } | null {
  let mejor: AtributoJugador = atributosJugador[0];
  for (const k of atributosJugador) if (a[k] > a[mejor]) mejor = k;
  return a[mejor] >= AT.distintivoMin ? { atributo: mejor, valor: a[mejor] } : null;
}

/** § 7.1 · ef(a) = (a − neutro)/neutro ∈ [−0,6; 0,9]. */
export const efectoAtributo = (a: number): number => (a - AT.neutro) / AT.neutro;
/** Velocidad: factor de la velocidad máxima. */
export const factorVelocidadMax = (velocidad: number): number => 1 + AT.velocidadMax * efectoAtributo(velocidad);
/** Velocidad: factor de la aceleración (no del frenado del bloque A). */
export const factorAceleracion = (velocidad: number): number => 1 + AT.aceleracion * efectoAtributo(velocidad);
/** Resistencia: factor del desgaste por metro. */
export const factorDesgaste = (resistencia: number): number => 1 - AT.resistenciaDesgaste * efectoAtributo(resistencia);
/** Entrada del defensor y aguante del portador: suma al p del duelo, antes del `limitar` existente. */
export const ajusteDuelo = (entradaDefensor: number, aguantePortador: number): number =>
  AT.entradaDuelo * efectoAtributo(entradaDefensor) - AT.aguanteDuelo * efectoAtributo(aguantePortador);
/** Visión: factor del error de todo pase (también centros y saques). */
export const factorErrorPase = (vision: number): number => 1 - AT.visionError * efectoAtributo(vision);
/** Potencia: factor de la velocidad del remate del autor (y del tiempo de reacción del portero). */
export const factorPotencia = (potencia: number): number => 1 + AT.potenciaVelocidad * efectoAtributo(potencia);

/** § 4.5 · Identidad de juego del club: PRNG `estilo-juego:arena-v8:{claveClub(nombre)}` con ATRIBUTOS_ARENA.semilla,
 * una extracción `pick` entre `estilosJuego`. Solo depende del nombre normalizado (como la equipación del 055): el
 * mismo club tiene la misma identidad en todos sus partidos, con cualquier semilla, lado o entrenador. */
export function estiloJuegoDe(nombre: string): EstiloJuego {
  return prngDerivado(AT.semilla, `estilo-juego:arena-v8:${claveClub(nombre)}`).pick(estilosJuego);
}
