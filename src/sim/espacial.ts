// Brief 011 (rev 1.1) — detalle espacial de los eventos de ataque.
//
// Se aplica DESPUÉS de simular, sobre los eventos ya emitidos, y cada valor sale de
// prngDerivado(semilla, id del evento): ni un `next()` del stream principal. Por eso la
// proyección legado (borrar estos campos) devuelve el partido de siempre, byte a byte.
//
// El origen de cada tiro (penal, córner, tiro libre o jugada) lo informa el motor, que es
// quien lo sabe; no se adivina desde el stream.

import { ESPACIAL } from "./parametros";
import { LADO_PORTERO_DE, ZONA_XG, type Destino, type ZonaOrigen } from "./limites";
import { prngDerivado, type Rng } from "./prng";
import { CAMPOS_ESPACIALES, type Evento, type Partido } from "./tipos";

export type OrigenTiro = "penal" | "corner" | "tiro_libre" | "jugada";

function sortear<K extends string>(rng: Rng, pesos: Readonly<Record<K, number>>): K {
  const claves = Object.keys(pesos) as K[];
  return rng.weighted(claves, (k) => pesos[k]) ?? (claves[0] as K);
}

function zonaDelTiro(rng: Rng, origen: OrigenTiro, xg: number): ZonaOrigen {
  const claro = xg >= ZONA_XG.areaChicaXgMin;
  const lejano = xg <= ZONA_XG.mediaDistanciaXgMax;
  switch (origen) {
    case "penal":
      return "punto_penal";
    case "corner":
      return claro ? sortear(rng, ESPACIAL.cornerClaro) : "frontal_del_area";
    case "tiro_libre":
      return lejano ? sortear(rng, ESPACIAL.libreLejano) : "frontal_del_area";
    case "jugada":
      if (claro) return sortear(rng, ESPACIAL.jugadaClara);
      if (lejano) return sortear(rng, ESPACIAL.jugadaLejana);
      return sortear(rng, ESPACIAL.jugadaMedia);
  }
}

/**
 * Agrega los campos espaciales a los eventos (en el lugar). `origenes` mapea id de tiro →
 * origen; un tiro sin origen informado cuenta como jugada.
 */
export function enriquecerEspacial(eventos: Evento[], semilla: number, origenes: ReadonlyMap<string, OrigenTiro>): void {
  const porId = new Map(eventos.map((e) => [e.id, e] as const));
  eventos.forEach((e, i) => {
    const rng = prngDerivado(semilla, e.id);
    switch (e.tipo) {
      case "tiro": {
        // Un tiro sin relacionadoCon no puede citar al córner (agregarlo rompería la
        // proyección legado). La regla verificable es de stream: el tiro INMEDIATAMENTE
        // posterior a un córner del mismo equipo cuenta como nacido del córner. Incluye
        // todos los cabezazos (el motor los emite pegados al saque) y algunos tiros de la
        // posesión siguiente (rival sin eventos en medio): esos también van al área.
        const prev = eventos[i - 1];
        const trasCorner = prev?.tipo === "corner" && prev.equipo === e.equipo;
        const informado = origenes.get(e.id) ?? "jugada";
        const origen: OrigenTiro = informado === "penal" ? "penal" : trasCorner ? "corner" : informado;
        e.zonaOrigen = zonaDelTiro(rng, origen, e.xg ?? 0);
        e.destino = sortear(rng, ESPACIAL.destino);
        e.altura = sortear(rng, ESPACIAL.altura);
        break;
      }
      case "pase_clave":
        e.zonaOrigen = e.zona === "medio" ? "media_distancia" : sortear(rng, ESPACIAL.paseAtaque);
        break;
      case "corner":
        e.banda = sortear(rng, ESPACIAL.banda);
        break;
      default:
        break;
    }
  });
  // Gol y atajada heredan de su tiro (que siempre va antes en el stream).
  for (const e of eventos) {
    const tiro = e.relacionadoCon ? porId.get(e.relacionadoCon) : undefined;
    if (!tiro || tiro.tipo !== "tiro") continue;
    if (e.tipo === "gol") {
      if (tiro.zonaOrigen) e.zonaOrigen = tiro.zonaOrigen;
      if (tiro.destino) e.destino = tiro.destino;
      if (tiro.altura) e.altura = tiro.altura;
    }
    if (e.tipo === "atajada" && tiro.destino) e.ladoPortero = LADO_PORTERO_DE[tiro.destino as Destino];
  }
}

/** Proyección legado: el partido SIN los campos espaciales (clon profundo). */
export function proyeccionLegado(p: Partido): Partido {
  const c = JSON.parse(JSON.stringify(p)) as Partido;
  for (const e of c.eventos) for (const k of CAMPOS_ESPACIALES) delete e[k];
  return c;
}
