// Brief 016 §1 — el mundo: 8 países ficticios con perfil climático, una liga por país, 10
// equipos por liga con su cancha. Todo determinista desde MUNDO_SEMILLA, con flujos
// derivados por clave (prngDerivado): agregar una liga no cambia las demás.
//
// Los nombres salen del generador existente (las sílabas y prefijos de plantillas.ts); los
// equipos y plantillas, de `generarEquipo` — el mismo de siempre.

import { EQUIPOS_POR_LIGA, MUNDO_SEMILLA, N_PAISES, PROB_CANCHA_SINTETICA, PROB_CESPED_ALTO } from "../analista/umbrales";
import { generarEquipo, generarPlantilla, PREFIJOS, SILABAS_INICIO } from "../sim/plantillas";
import { prngDerivado, type Rng } from "../sim/prng";
import { CLIMAS, type Clima, type EquipoMundo, type Liga, type Mundo, type Pais } from "./tipos";

// Sílabas propias del mundo, armadas para que no choquen vocales («Castiira», «Doroosa»): el
// inicio (de plantillas) termina en consonante; el medio, vacío o vocal+consonante; el final
// empieza por vocal (ciudad) o es vocal + sufijo con consonante (país).
const VOCAL_PAIS = ["a", "e", "o", "i"] as const;
const SUFIJO_PAIS = ["nia", "lia", "ria", "dora", "sia", "landa", "vena"] as const;
const MEDIO_CIUDAD = ["", "", "el", "ar", "in", "an", "or", "es"] as const;
const FIN_CIUDAD = ["ena", "ales", "era", "osa", "ino", "ueta", "ido", "edo", "ira", "ela", "ana"] as const;

/**
 * Nombres que el generador puede formar y que coinciden con lugares reales conocidos o con
 * palabras comunes que no suenan a lugar: se vuelven a tirar (regla de cero datos reales).
 */
const REALES = new Set([
  "Valonia", "Valencia", "Valera", "Toledo", "Moreno", "Marino", "Torino", "Rosales", "Galena",
  "Marido", "Nevera", "Torera", "Galera", "Palido", "Barena", "Marena", "Morena", "Mendosa",
  "Galeria", "Castalia",
]);

/** Nombres de liga por clima (dos por perfil: el mundo tiene 8 países y 6 climas). */
const NOMBRES_LIGA: Record<Clima, readonly [string, string]> = {
  tropical: ["Liga del Sol Alto", "Liga de las Palmas Rojas"],
  desertico: ["Liga de las Dunas", "Liga del Oasis Hondo"],
  templado: ["Liga de los Valles", "Liga del Río Manso"],
  nordico: ["Liga del Norte Blanco", "Liga de los Fiordos"],
  lluvioso: ["Liga de la Bruma", "Liga del Agua Mansa"],
  de_altura: ["Liga de las Cumbres", "Liga del Cóndor"],
};

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function nombreUnico(rng: Rng, usados: Set<string>, armar: (r: Rng) => string): string {
  for (;;) {
    const n = armar(rng);
    if (!usados.has(n) && !REALES.has(n)) {
      usados.add(n);
      return n;
    }
  }
}

/** Brief 019: de una plantilla extra se toman un POR, un DEF, un MED y un DEL (índices de la plantilla 1-4-3-3), con dorsales 18–21. */
const RESERVAS: readonly [number, number][] = [
  [0, 18],
  [1, 19],
  [5, 20],
  [8, 21],
];

const nombrePais = (r: Rng) => r.pick(SILABAS_INICIO) + r.pick(VOCAL_PAIS) + r.pick(SUFIJO_PAIS);
const nombreCiudad = (r: Rng) => r.pick(SILABAS_INICIO) + r.pick(MEDIO_CIUDAD) + r.pick(FIN_CIUDAD);

/** El mundo completo de una semilla (por defecto, MUNDO_SEMILLA). Puro y determinista. */
export function crearMundo(semilla: number = MUNDO_SEMILLA): Mundo {
  const rngPaises = prngDerivado(semilla, "paises");
  const usadosPais = new Set<string>();
  const paises: Pais[] = [];
  for (let k = 0; k < N_PAISES; k++) {
    // Los primeros seis cubren cada perfil una vez (el 018 necesita todos); los demás, al azar.
    const clima: Clima = k < CLIMAS.length ? (CLIMAS[k] as Clima) : rngPaises.pick(CLIMAS);
    const nombre = nombreUnico(rngPaises, usadosPais, nombrePais);
    paises.push({ id: slug(nombre), nombre, clima });
  }

  const usadosCiudad = new Set<string>(); // ninguna ciudad repetida en el mundo
  const usadosEquipo = new Set<string>();
  const usadosJugador = new Set<string>(); // ningún jugador repetido en el mundo
  const nombresLigaUsados = new Set<string>();
  const ligas: Liga[] = paises.map((pais) => {
    const [a, b] = NOMBRES_LIGA[pais.clima];
    const nombreLiga = nombresLigaUsados.has(a) ? b : a;
    nombresLigaUsados.add(nombreLiga);
    const id = slug(nombreLiga);
    const rng = prngDerivado(semilla, `liga:${pais.id}`);
    const equipos: EquipoMundo[] = [];
    for (let i = 0; i < EQUIPOS_POR_LIGA; i++) {
      const nombre = nombreUnico(rng, usadosEquipo, (r) => `${r.pick(PREFIJOS)} ${nombreUnico(r, usadosCiudad, nombreCiudad)}`);
      const equipo = generarEquipo(rng, { nombre }, usadosJugador);
      equipos.push({
        equipo,
        pais: pais.id,
        liga: id,
        cancha: {
          superficie: rng.chance(PROB_CANCHA_SINTETICA) ? "sintetica" : "natural",
          cesped: rng.chance(PROB_CESPED_ALTO) ? "alto" : "corto",
        },
        reservas: [],
      });
    }
    return { id, nombre: nombreLiga, pais: pais.id, clima: pais.clima, equipos };
  });
  // Brief 019: las reservas se generan DESPUÉS de todo lo demás, con su propio flujo derivado,
  // para que el mundo del 016 (nombres, plantillas, canchas) no cambie ni una letra.
  for (const liga of ligas) {
    liga.equipos.forEach((eq, i) => {
      const extra = generarPlantilla(prngDerivado(semilla, `reservas:${liga.id}:${i}`), usadosJugador);
      eq.reservas = RESERVAS.map(([idx, dorsal]) => ({ ...(extra[idx] as (typeof extra)[number]), dorsal }));
    });
  }
  return { semilla, paises, ligas };
}

let mundoCache: Mundo | undefined;
/** El mundo de MUNDO_SEMILLA, memorizado (es inmutable). */
export function mundo(): Mundo {
  mundoCache ??= crearMundo();
  return mundoCache;
}
