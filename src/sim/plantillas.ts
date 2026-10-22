// Generador determinista de equipos y plantillas FICTICIAS.
// Brief 016: el mundo (src/mundo) reusa PREFIJOS y SILABAS_INICIO — se exportan, no cambian.
// Los nombres de club son lugares inventados; los apellidos se arman con sílabas
// para no coincidir con jugadores reales. Nada de clubes ni personas reales.

import { normalizarSeed } from "./motor";
import { crearRng, type Rng } from "./prng";
import type { Equipo, Estilo, Jugador, Posicion, SimConfig } from "./tipos";

export const PREFIJOS = ["Atlético", "Deportivo", "Unión", "Sporting", "Racing", "Club", "Olímpico", "Juventud"] as const;
export const LUGARES = [
  "Torreluna",
  "Pradoalto",
  "Marisal",
  "Ventolera",
  "Nebrisa",
  "Valdecristal",
  "Solcanto",
  "Brezal",
  "Ormidia",
  "Arenablanca",
  "Puertoscuro",
  "Caleteo",
  "Lumbrera",
  "Quebralta",
  "Islaverde Sur",
  "Montefrío Bajo",
] as const;

const NOMBRES = [
  "Mateo", "Iker", "Thiago", "Bruno", "Dante", "Leo", "Joel", "Nico", "Ramiro", "Tomás",
  "Elías", "Gael", "Simón", "Ulises", "Fabio", "Hugo", "Aarón", "Ciro", "Emilio", "Lucio",
  "Owen", "Rafael", "Teo", "Vicente", "Adrián", "Benja", "Darío", "Germán", "Ismael", "Marco",
] as const;

export const SILABAS_INICIO = ["Bar", "Cel", "Dor", "Fen", "Gal", "Lor", "Mar", "Nev", "Or", "Pal", "Quin", "Ros", "Tor", "Val", "Zar", "Brel", "Cast", "Mend", "Sor", "Ulv"] as const;
const SILABAS_MEDIO = ["", "a", "e", "i", "o", "ar", "el", "in"] as const;
const SILABAS_FIN = ["ena", "ido", "ales", "ón", "ueta", "era", "ino", "ardi", "osa", "ell", "ánez", "oya", "ich", "uz"] as const;

const ESTILOS: readonly Estilo[] = ["posesion", "contragolpe", "presion"];

/** Posiciones de la plantilla: 11 titulares (1-4-3-3) + 5 suplentes. */
const POSICIONES: readonly Posicion[] = [
  "POR", "DEF", "DEF", "DEF", "DEF", "MED", "MED", "MED", "DEL", "DEL", "DEL",
  "POR", "DEF", "MED", "MED", "DEL",
];

function apellido(rng: Rng): string {
  return rng.pick(SILABAS_INICIO) + rng.pick(SILABAS_MEDIO) + rng.pick(SILABAS_FIN);
}

/** Genera una plantilla de 16 jugadores con nombres únicos respecto de `usados`. */
export function generarPlantilla(rng: Rng, usados: Set<string> = new Set()): Jugador[] {
  const dorsalesTitulares = [1, 2, 3, 4, 5, 6, 8, 10, 7, 9, 11];
  const dorsalesSuplentes = [13, 14, 15, 16, 17];
  const dorsales = [...dorsalesTitulares, ...dorsalesSuplentes];
  return POSICIONES.map((posicion, i) => {
    let nombre = "";
    do {
      nombre = `${rng.pick(NOMBRES)} ${apellido(rng)}`;
    } while (usados.has(nombre));
    usados.add(nombre);
    return { nombre, dorsal: dorsales[i] as number, posicion };
  });
}

export interface OpcionesEquipo {
  nombre?: string;
  ataque?: number;
  defensa?: number;
  estilo?: Estilo;
}

/** Equipo ficticio a partir de un rng; las opciones fijan atributos concretos. */
export function generarEquipo(rng: Rng, opciones: OpcionesEquipo = {}, usados: Set<string> = new Set()): Equipo {
  const nombre = opciones.nombre ?? `${rng.pick(PREFIJOS)} ${rng.pick(LUGARES)}`;
  const ataque = opciones.ataque ?? rng.int(55, 85);
  const defensa = opciones.defensa ?? rng.int(55, 85);
  const estilo = opciones.estilo ?? rng.pick(ESTILOS);
  return { nombre, ataque, defensa, estilo, jugadores: generarPlantilla(rng, usados) };
}

// Las plantillas usan un flujo de azar distinto del partido (misma semilla, otra
// constante), para que cambiar el motor no cambie los equipos de una semilla.
const SAL_PLANTILLAS = 0x9e3779b9;

/** Configuración completa (dos equipos ficticios distintos) derivada de una semilla. */
export function configDeSemilla(
  seed: number,
  local: OpcionesEquipo = {},
  visita: OpcionesEquipo = {},
): SimConfig {
  const rng = crearRng((normalizarSeed(seed) ^ SAL_PLANTILLAS) >>> 0);
  const usados = new Set<string>();
  const eqLocal = generarEquipo(rng, local, usados);
  let eqVisita = generarEquipo(rng, visita, usados);
  // Nunca dos clubes con el mismo nombre.
  while (eqVisita.nombre === eqLocal.nombre && visita.nombre === undefined) {
    eqVisita = { ...eqVisita, nombre: `${rng.pick(PREFIJOS)} ${rng.pick(LUGARES)}` };
  }
  return { seed: normalizarSeed(seed), local: eqLocal, visita: eqVisita };
}
