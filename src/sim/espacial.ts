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

import { DEFINICION, ESPACIAL, INSOLITOS } from "./parametros";
import {
  DEF_CABEZAZO,
  DEF_MANO_A_MANO,
  DEF_MEDIA_CANCHA,
  DEF_VASELINA,
  type Definicion,
  DISTANCIA_ZONA,
  LADO_PORTERO_DE,
  TIPOS_ATAQUE,
  TIRO_LEJANO,
  TRAS_CORNER_MAX_MIN,
  VELOCIDAD,
  VELOCIDAD_LEJANO,
  VELOCIDAD_PENAL,
  XG_ALTO,
  ZONA_XG_BANDAS,
  type Destino,
  type ZonaOrigen,
} from "./limites";
import { extraVelocidad, factorMediaDistancia } from "./condiciones";
import { prngDerivado, type Rng } from "./prng";
import { CAMPOS_ESPACIALES, type Condiciones, type Evento, type Partido, type Variantes } from "./tipos";

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

function zonaDelTiro(rng: Rng, origen: OrigenTiro, xg: number, condiciones?: Condiciones): ZonaOrigen {
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
    // Brief 018 · efecto 4: en sintética, la bola corre y se prueba más de media distancia
    // (el peso se multiplica por 1 exacto en cualquier otra cancha: el sorteo no cambia).
    tabla = claro
      ? ESPACIAL.jugadaClara
      : lejano
        ? { ...ESPACIAL.jugadaLejana, media_distancia: ESPACIAL.jugadaLejana.media_distancia * factorMediaDistancia(condiciones) }
        : ESPACIAL.jugadaMedia;
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
export function enriquecerEspacial(eventos: Evento[], semilla: number, origenes: ReadonlyMap<string, OrigenTiro>, condiciones?: Condiciones, variantes?: Variantes): void {
  const porId = new Map(eventos.map((e) => [e.id, e] as const));
  eventos.forEach((e, i) => {
    const rng = prngDerivado(semilla, e.id);
    switch (e.tipo) {
      case "tiro": {
        const informado = origenes.get(e.id) ?? "jugada";
        const origen: OrigenTiro = informado === "penal" ? "penal" : cornerDelTiro(eventos, i) ? "corner" : informado === "corner" ? "jugada" : informado;
        e.zonaOrigen = zonaDelTiro(rng, origen, e.xg ?? 0, condiciones);
        e.destino = sortear(rng, ESPACIAL.destino) as Destino;
        e.altura = sortear(rng, ESPACIAL.altura);
        // Brief 015: magnitudes del mismo stream derivado, DESPUÉS de los sorteos del 011
        // (así zona, destino y altura no cambian).
        Object.assign(e, magnitudes(rng, e.zonaOrigen, e.xg ?? 0, e.penal === true, extraVelocidad(condiciones)));
        // Brief 020: la definición, del MISMO stream, DESPUÉS de los sorteos del 015 (así las
        // magnitudes de los demás tiros no cambian; las reescrituras son a propósito y acotadas).
        definir(rng, e, origenDelTiro(eventos, i));
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
    // Brief 025 · 1: el gol olímpico cuelga del córner — entra en el área chica, al palo del lado del
    // córner (vista del atacante: el de la izquierda entra por el palo izquierdo), alto.
    if (e.tipo === "gol" && tiro?.tipo === "corner") {
      e.definicion = "olimpico";
      e.zonaOrigen = "area_chica";
      e.destino = tiro.banda === "derecha" ? "palo_derecho" : "palo_izquierdo";
      e.altura = "alta";
      continue;
    }
    if (!tiro || tiro.tipo !== "tiro") continue;
    // Brief 020: la atajada hereda la definición; el gol también, salvo el autogol (no es del tirador).
    if (tiro.definicion !== undefined && (e.tipo === "atajada" || (e.tipo === "gol" && e.autogol !== true))) e.definicion = tiro.definicion;
    if (e.tipo === "gol") {
      if (tiro.zonaOrigen) e.zonaOrigen = tiro.zonaOrigen;
      if (tiro.destino) e.destino = tiro.destino;
      if (tiro.altura) e.altura = tiro.altura;
    }
    // Brief 015: el gol y la atajada heredan las magnitudes de su tiro.
    if ((e.tipo === "gol" || e.tipo === "atajada") && tiro.distanciaM !== undefined) {
      e.distanciaM = tiro.distanciaM;
      if (tiro.velocidadKmh !== undefined) e.velocidadKmh = tiro.velocidadKmh;
    }
    if (e.tipo === "atajada" && tiro.destino) e.ladoPortero = LADO_PORTERO_DE[tiro.destino as Destino];
  }
  // Brief 025 · 3: un tiro desviado (sin gol ni atajada) apuntado a un palo puede dar en él, o en los
  // dos. Sorteo derivado PROPIO (después de todo lo anterior: nada de lo ya sorteado cambia).
  if (variantes?.insolitos === true) {
    const conDesenlace = new Set(eventos.filter((e) => (e.tipo === "gol" || e.tipo === "atajada") && e.relacionadoCon).map((e) => e.relacionadoCon));
    for (const e of eventos) {
      if (e.tipo !== "tiro" || e.penal === true || conDesenlace.has(e.id) || (e.destino !== "palo_izquierdo" && e.destino !== "palo_derecho")) continue;
      const rng = prngDerivado(semilla, `palo:${e.id}`);
      if (rng.chance(INSOLITOS.pAlPalo)) e.alPalo = rng.chance(INSOLITOS.pDoblePalo) ? 2 : 1;
    }
  }
}

/**
 * Brief 015 — rango de distancia admisible para un tiro: la banda de su zona, recortada por la
 * coherencia con el xG (xG alto ⇒ cerca; xG > TIRO_LEJANO.xgMax ⇒ menos de TIRO_LEJANO.distanciaMin).
 * El penal: 11 exacto (exento de la coherencia).
 */
export function rangoDistancia(zona: ZonaOrigen, xg: number, penal: boolean): { min: number; max: number } {
  const b = DISTANCIA_ZONA[zona];
  if (penal || zona === "punto_penal") return { min: b.min, max: b.max };
  // «xG alto ⇒ cerca» no necesita recorte aquí: con las bandas xG (frontal < 0.30 desde el 015)
  // solo el área chica (≤ 6 m) admite xG ≥ XG_ALTO.xgMin. El invariante lo vigila.
  let max = b.max;
  if (Math.round(xg * 100) > Math.round(TIRO_LEJANO.xgMax * 100)) max = Math.min(max, TIRO_LEJANO.distanciaMin - 1);
  return { min: b.min, max: Math.max(b.min, max) };
}

/** Distancia y velocidad de un tiro: dentro de sus bandas, más lejos cuanto menor el xG, más fuerte desde lejos. */
function magnitudes(rng: Rng, zona: ZonaOrigen | undefined, xg: number, penal: boolean, extraKmh = 0): { distanciaM: number; velocidadKmh: number } {
  const r = rangoDistancia(zona ?? "frontal_del_area", xg, penal);
  const cerca = Math.min(1, xg / XG_ALTO.xgMin); // 1 = ocasión clara
  const t = 0.35 * (1 - cerca) + 0.65 * rng.next();
  const distanciaM = Math.min(r.max, Math.floor(r.min + t * (r.max - r.min + 1)));
  let velocidadKmh: number;
  if (penal) velocidadKmh = rng.int(VELOCIDAD_PENAL.min, VELOCIDAD_PENAL.max);
  else {
    // Brief 018 · efecto 4: + extraKmh en sintética (0 exacto en otra cancha), y el recorte de
    // siempre: las bandas del 015 no se mueven.
    const v = ESPACIAL.velocidadMedia + ESPACIAL.velocidadSigma * rng.normal() + ESPACIAL.velocidadPorMetro * (distanciaM - ESPACIAL.velocidadMetroRef) + extraKmh;
    const piso = distanciaM >= VELOCIDAD_LEJANO.distanciaMin ? VELOCIDAD_LEJANO.min : VELOCIDAD.min;
    velocidadKmh = Math.round(Math.min(VELOCIDAD.max, Math.max(piso, v)));
  }
  return { distanciaM, velocidadKmh };
}

/** Proyección legado: el partido SIN los campos espaciales (clon profundo). */
export function proyeccionLegado(p: Partido): Partido {
  const c = JSON.parse(JSON.stringify(p)) as Partido;
  for (const e of c.eventos) for (const k of CAMPOS_ESPACIALES) delete e[k];
  return c;
}

// ---------------------------------------------------------------------------------
// Brief 020 (rev 1.1) — la definición del tiro. UNA definición de los orígenes (la comparten el
// generador, el invariante y la pizarra, como cornerDelTiro).
// ---------------------------------------------------------------------------------

export interface OrigenDefinicion {
  /** Tiro «tras córner» (cornerDelTiro). */
  corner: boolean;
  /** El pase clave inmediatamente anterior, del mismo equipo (si lo hay). */
  pase?: Evento;
  /** Centro: tras córner o tras un pase clave desde banda. */
  centro: boolean;
  /** Pase filtrado: pase clave por el centro (frontal o media distancia), no tras córner. */
  filtrado: boolean;
  /** Pase atrás: pase clave desde banda a un remate del área chica, no tras córner (rev 1.1). */
  atras: boolean;
}

const BANDA_PASE = new Set<string>(["banda_izquierda", "banda_derecha"]);

export function origenDelTiro(eventos: readonly Evento[], i: number): OrigenDefinicion {
  const tiro = eventos[i] as Evento;
  const corner = cornerDelTiro(eventos, i) !== undefined;
  const prev = eventos[i - 1];
  const pase = prev?.tipo === "pase_clave" && prev.equipo === tiro.equipo ? prev : undefined;
  const desdeBanda = pase !== undefined && BANDA_PASE.has(pase.zonaOrigen ?? "");
  return {
    corner,
    ...(pase ? { pase } : {}),
    centro: corner || desdeBanda,
    filtrado: !corner && pase !== undefined && (pase.zonaOrigen === "frontal_del_area" || pase.zonaOrigen === "media_distancia"),
    atras: !corner && desdeBanda && tiro.zonaOrigen === "area_chica",
  };
}

const enArea = (z: ZonaOrigen | undefined) => z === "area_chica" || z === "frontal_del_area";

/** ¿El tiro admite esta definición? (coherencias de la tabla del brief, sobre lo ya sorteado; altura FILTRADA). */
export function admite(def: Definicion, e: Evento, o: OrigenDefinicion): boolean {
  if (e.penal === true) return def === "jugada";
  const xg = e.xg ?? 0;
  switch (def) {
    case "jugada":
      return true;
    case "media_cancha":
      return e.zonaOrigen === "media_distancia" && Math.round(xg * 100) <= Math.round(DEF_MEDIA_CANCHA.xgMax * 100);
    case "chilena":
    case "tijera":
      return e.zonaOrigen === "area_chica" && o.centro && e.altura === "alta";
    case "cabezazo":
      // Anidado en el 015: un remate lento (≤ 75 km/h) solo de cerca — desde VELOCIDAD_LEJANO.distanciaMin
      // el 015 exige ≥ 80 km/h.
      return enArea(e.zonaOrigen) && o.centro && e.altura !== undefined && e.altura !== "raso" && (e.distanciaM ?? 0) < VELOCIDAD_LEJANO.distanciaMin;
    case "mano_a_mano":
      return enArea(e.zonaOrigen) && (o.filtrado || o.atras) && Math.round(xg * 100) >= Math.round(DEF_MANO_A_MANO.xgMin * 100);
    case "vaselina":
      return admite("mano_a_mano", e, o) && e.altura === "alta" && (e.distanciaM ?? 0) < VELOCIDAD_LEJANO.distanciaMin;
    case "olimpico":
      return false; // brief 025: no es un tiro — el gol cuelga del córner
  }
}

/** Sortea la definición y hace las reescrituras acotadas del brief (rev 1.1). */
function definir(rng: Rng, e: Evento, o: OrigenDefinicion): void {
  let def: Definicion = "jugada";
  if (admite("media_cancha", e, o) && rng.chance(DEFINICION.pMediaCancha)) def = "media_cancha";
  else if (admite("chilena", e, o) && rng.chance(DEFINICION.pChilena)) def = rng.chance(DEFINICION.pTijera) ? "tijera" : "chilena";
  else if (admite("cabezazo", e, o) && rng.chance(DEFINICION.pCabezazo)) def = "cabezazo";
  else if (admite("vaselina", e, o) && rng.chance(DEFINICION.pVaselina)) def = "vaselina";
  else if (admite("mano_a_mano", e, o) && rng.chance(DEFINICION.pManoAMano)) def = "mano_a_mano";
  e.definicion = def;
  if (def === "cabezazo") e.velocidadKmh = rng.int(DEF_CABEZAZO.velocidad.min, DEF_CABEZAZO.velocidad.max);
  if (def === "vaselina") e.velocidadKmh = rng.int(DEF_VASELINA.velocidad.min, DEF_VASELINA.velocidad.max);
  if (def === "media_cancha") {
    e.distanciaM = rng.int(DEF_MEDIA_CANCHA.distancia.min, DEF_MEDIA_CANCHA.distancia.max);
    e.velocidadKmh = rng.int(DEF_MEDIA_CANCHA.velocidadMin, DEFINICION.velocidadMediaCanchaMax);
  }
}
