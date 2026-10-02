// Brief 011 (rev 1.1) + brief 012 §F — detalle espacial de los eventos de ataque.
//
// Se aplica DESPUÉS de simular, sobre los eventos ya emitidos, y cada valor sale de
// prngDerivado(semilla, id del evento): ni un `next()` del stream principal. Por eso la
// proyección legado (borrar estos campos) devuelve el partido de siempre, byte a byte.
//
// Brief 012:
// - el generador sortea solo zonas cuya banda xG (ZONA_XG_BANDAS) contiene el xG del tiro;
// - «tras córner» tiene UNA definición (`cornerDelTiro`), compartida con el invariante y
//   con la pizarra;
// - un penal nunca es «tras córner».

import { ESPACIAL } from "./parametros";
import { LADO_PORTERO_DE, TIPOS_ATAQUE, TRAS_CORNER_MAX_MIN, ZONA_XG_BANDAS, type Destino, type ZonaOrigen } from "./limites";
import { prngDerivado, type Rng } from "./prng";
import { CAMPOS_ESPACIALES, type Evento, type Partido } from "./tipos";

export type OrigenTiro = "penal" | "corner" | "tiro_libre" | "jugada";

/** ¿El xG cae en la banda de la zona? (ZONA_XG_BANDAS, en centésimas para no depender del redondeo). */
export function enBanda(zona: ZonaOrigen, xg: number): boolean {
  const b = ZONA_XG_BANDAS[zona];
  const x = Math.round(xg * 100);
  const lo = Math.round(b.min * 100);
  const hi = Math.round(b.max * 100);
  return x >= lo && (b.incluyeMax ? x <= hi : x < hi);
}

/**
 * LA definición de «tiro tras córner» (brief 012 §F4): recorriendo hacia atrás desde el tiro,
 * el primer evento de ataque es un córner del mismo equipo, a ≤ TRAS_CORNER_MAX_MIN minutos.
 * Un penal nunca es «tras córner». Devuelve ese córner, o undefined.
 */
export function cornerDelTiro(eventos: readonly Evento[], i: number): Evento | undefined {
  const tiro = eventos[i];
  if (!tiro || tiro.tipo !== "tiro" || tiro.penal === true) return undefined;
  for (let k = i - 1; k >= 0; k--) {
    const e = eventos[k] as Evento;
    if (!TIPOS_ATAQUE.includes(e.tipo)) continue;
    return e.tipo === "corner" && e.equipo === tiro.equipo && tiro.minuto - e.minuto <= TRAS_CORNER_MAX_MIN ? e : undefined;
  }
  return undefined;
}

function sortear<K extends string>(rng: Rng, pesos: Readonly<Partial<Record<K, number>>>): K | undefined {
  const claves = (Object.keys(pesos) as K[]).filter((k) => (pesos[k] ?? 0) > 0);
  return rng.weighted(claves, (k) => pesos[k] ?? 0);
}

/** Solo las zonas de la tabla cuya banda contiene el xG. */
function filtrar(tabla: Readonly<Partial<Record<ZonaOrigen, number>>>, xg: number): Partial<Record<ZonaOrigen, number>> {
  const out: Partial<Record<ZonaOrigen, number>> = {};
  for (const [z, w] of Object.entries(tabla) as [ZonaOrigen, number][]) if (enBanda(z, xg)) out[z] = w;
  return out;
}

/** Último recurso (nunca vacío para un xG del simulador): cualquier zona de juego cuya banda lo contenga. */
const ZONAS_DE_JUEGO: ZonaOrigen[] = ["area_chica", "frontal_del_area", "banda_izquierda", "banda_derecha", "media_distancia"];

function zonaDelTiro(rng: Rng, origen: OrigenTiro, xg: number): ZonaOrigen {
  if (origen === "penal") return "punto_penal";
  let tabla: Readonly<Partial<Record<ZonaOrigen, number>>>;
  if (origen === "corner") {
    // Rev 1.1 del 012: con el frontal desde 0.01, todo tiro tras córner tiene zona de área.
    tabla = ESPACIAL.cornerClaro;
  } else if (origen === "tiro_libre") {
    tabla = ESPACIAL.libreLejano;
  } else {
    const claro = xg >= ZONA_XG_BANDAS.area_chica.min;
    const lejano = enBanda("media_distancia", xg) && xg <= ESPACIAL.lejanoXgMax;
    tabla = claro ? ESPACIAL.jugadaClara : lejano ? ESPACIAL.jugadaLejana : ESPACIAL.jugadaMedia;
  }
  const z = sortear(rng, filtrar(tabla, xg));
  if (z) return z;
  const resto: Partial<Record<ZonaOrigen, number>> = {};
  for (const k of ZONAS_DE_JUEGO) if (enBanda(k, xg)) resto[k] = 1;
  return sortear(rng, resto) ?? "frontal_del_area";
}

/**
 * Agrega los campos espaciales a los eventos (en el lugar). `origenes` mapea id de tiro →
 * origen informado por el motor; «tras córner» se decide con `cornerDelTiro` (la definición
 * única), y un penal manda sobre todo.
 */
export function enriquecerEspacial(eventos: Evento[], semilla: number, origenes: ReadonlyMap<string, OrigenTiro>): void {
  const porId = new Map(eventos.map((e) => [e.id, e] as const));
  eventos.forEach((e, i) => {
    const rng = prngDerivado(semilla, e.id);
    switch (e.tipo) {
      case "tiro": {
        const informado = origenes.get(e.id) ?? "jugada";
        const origen: OrigenTiro = informado === "penal" ? "penal" : cornerDelTiro(eventos, i) ? "corner" : informado === "corner" ? "jugada" : informado;
        e.zonaOrigen = zonaDelTiro(rng, origen, e.xg ?? 0);
        e.destino = sortear(rng, ESPACIAL.destino) as Destino;
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
