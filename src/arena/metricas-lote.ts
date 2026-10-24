// Brief 046 · Métricas de lote de la arena (controladores programados). Muestrea TODOS los ticks
// (pausas incluidas) envolviendo `MotorArena.prototype.planesActivos`, que el motor llama al
// empezar cada paso, y mide la continuidad de los episodios por diferencia de ticks. Un
// denominador cero es `null` («sin muestra»): nunca cuenta como cumplimiento.
// Geometría y ticks salen de ARENA / LOTE_ARENA_046; no hay cifras propias.
// Brief 051: en la misma pasada, las métricas de remate (desenlace físico, «a puerta» por
// `rematesPorLado`, colocación) con las bandas de LOTE_ARENA_051, el experimento controlado de
// niveles (`partidoConNiveles`) y los dos contadores de intercepción inmediata (v1.1 #4).
// Brief 063 · bloque A: `repliegueCorren`, `repliegueSeleccion` y `persecucionPerdedor` (§ 11.1, v1.1 § 17.7)
// con las bandas de LOTE_ARENA_063, y las escenas para el smoke (`escenasPartido`).
import { ARENA, LOTE_ARENA_046 as L, LOTE_ARENA_051 as L51, LOTE_ARENA_063 as L63, PERSECUCION_ARENA as PE } from "../sim/limites";
import { configDeSemilla } from "../sim/plantillas";
import type { Lado, SimConfig } from "../sim/tipos";
import { enAreaRival } from "./ataque";
import { transformar } from "./catalogo";
import { crearControladorProgramado } from "./controladores";
import { ejecutarArena } from "./coordinador";
import { rematesPorLado } from "./estadista";
import { distancia } from "./geometria";
import { crearConfigArena, MotorArena } from "./motor";
import { lineaDePuesto } from "./atributos";
import { destinoRepliegue, perseguidoresDe, seleccionRepliegue, superadoPor } from "./persecucion";
import { enAreaPropia, manoAMano } from "./portero";
import { lados, reglasArena, rival, type EstadoArena, type EventoArena, type OrdenesEquipo, type PersecucionArena, type Punto, type ReglasArena } from "./tipos";

/** Brief 063 § 11.1: con la velocidad (vx, vy) de cada jugador. */
interface JugadorMuestra { id: string; lado: Lado; puesto: string; x: number; y: number; vx: number; vy: number }
/** Estado al empezar el paso `tick` (o el final del partido). */
export interface MuestraTick {
  tick: number; eventos: number; poseedor: string | null; balon: Punto;
  manos: string | null; pausado: boolean;
  /** Poseedor del episodio de mano a mano medido con ARENA.radioTiroM, o null. */
  manoAMano: string | null;
  /** `conducir` del poseedor de campo sin pausa ni saque: velocidad del poseedor (m/s). */
  conducir: number | null;
  jugadores: JugadorMuestra[];
  /** Brief 063 § 11.1: hay un balón en vuelo. */
  vuelo: boolean;
  /** Brief 063 § 6.1: poseedor superado (`superadoPor`), fuera de pausa y saque, o null. Geométrico: igual en v5. */
  superado: string | null;
  /** Brief 063 v1.1 § 17.7: conjunto `seleccionRepliegue` reconstruido sobre la muestra y su destino. */
  seleccion: { ids: string[]; destino: Punto } | null;
  /** Brief 063: `estado.persecucion` (null también en v1–v5, donde la clave no existe). */
  persecucion: PersecucionArena | null;
}

export interface MetricasPartido {
  seed: number; goles: number; tiros: number;
  robosEnManos: number; atajadasConPosesion: number; perdidasTrasAtajada: number; perdidasArea: number;
  episodios: { desplazamientoM: number; gol: boolean }[];
  pasesBanda: number; pasesBandaAlArea: number; centros: number;
  /** v1.2 · saques desde las manos, perdidos (primer toque rival), interceptados en ≤ saqueInmediataS
   * y goles rivales sin toque defensor en ≤ golTrasSaqueS. */
  saquesManos: number; saquesPerdidos: number; intercepcionesInmediatas: number; golesTrasSaque: number;
  /** Brief 051 v1.1 #4: las inmediatas cuyo toque rival (`hasta`) queda a ≤ inmediataRadioM del `desde` del saque. */
  intercepcionesInmediatasCercanas: number;
  /** Brief 051 · desenlace físico de cada remate (evento `tiro`). */
  remates: Record<DesenlaceRemate, number>;
  /** Brief 051 · lectura 045 (`rematesPorLado`): a puerta, y de ellos los cerrados por atajada. */
  aPuerta045: number; atajadas045: number;
  /** Remates en los que la lectura 045 (a puerta o no) y la física (gol, atrapada o desvío) difieren. */
  discrepancias045: number;
  /** Goles cuyo evento previo no neutro no es un `tiro` ni un desvío del portero. */
  golesSinRemate: number;
  /** Colocación: remates con |hasta.y − centro| ≤ arcoM/2, de ellos > arcoM/4, y suma de |hasta.y − centro| (m). */
  rematesDentro: number; rematesLados: number; sumaDesvioDestinoM: number;
  metas: number; metasConduccion: number;
  tiroFueraTrasDesvio: number; recepcionPorteroRechace: number;
  ticksConducir: number; ticksConducirFrenado: number; fuerasDeJuego: number;
  /** Brief 063 § 11.1 · numerador y denominador de cada métrica del bloque A. */
  repliegueCorren: { corren: number; muestras: number };
  repliegueSeleccion: { corren: number; muestras: number };
  persecucionPerdedor: { persigue: number; muestras: number };
}

const tipoPosesion = new Set<EventoArena["tipo"]>(["tiro", "pase", "recuperacion", "intercepcion", "falta", "fuera_juego", "reinicio", "gol"]);
const tipoResultadoTiro = new Set<EventoArena["tipo"]>(["gol", "atajada", "tiro_fuera", "intercepcion", "reinicio", "recepcion", "recuperacion"]);
const neutro = new Set<EventoArena["tipo"]>(["plan_equipo", "cambio"]);
const toque = new Set<EventoArena["tipo"]>(["recepcion", "intercepcion", "recuperacion", "atajada"]);
const finSaque = new Set<EventoArena["tipo"]>([...toque, "fuera_juego", "reinicio", "gol"]);
const ganancia = new Set<EventoArena["tipo"]>(["recepcion", "atajada", "intercepcion", "recuperacion", "reinicio"]);
const toqueDefensor = new Set<EventoArena["tipo"]>([...toque, "pase", "tiro"]);

/** Brief 051 · desenlace físico de un remate. */
export const DESENLACES_REMATE = ["gol", "atrapada", "desvio", "ancho", "alto", "bloqueado", "otro"] as const;
export type DesenlaceRemate = (typeof DESENLACES_REMATE)[number];
const cierreRemate = new Set<EventoArena["tipo"]>(["recepcion", "reinicio", "recuperacion", "tiro", "gol", "fuera_juego"]);
/** Desenlace físico del remate `eventos[i]`: el primer evento posterior no neutro que lo cierra. Gol
 * del mismo lado y jugador; atajada con `receptor` = rematador (atrapada o desvío según `motivo`);
 * `tiro_fuera` del rematador (ancho, o alto con `motivo: "alto"`); intercepción con `receptor` =
 * rematador (bloqueado); cualquier otro cierre (recepción, reinicio, recuperación, otro tiro, otro
 * gol, fuera de juego) = otro. Faltas, tarjetas y eventos de otro vuelo no cierran. */
export function desenlaceFisico(eventos: readonly EventoArena[], i: number): DesenlaceRemate {
  const e = eventos[i]!;
  for (const d of eventos.slice(i + 1)) {
    if (neutro.has(d.tipo)) continue;
    if (d.tipo === "gol" && d.lado === e.lado && d.jugador === e.jugador) return "gol";
    if (d.tipo === "atajada" && d.receptor === e.jugador) return d.motivo === "desvio" ? "desvio" : "atrapada";
    if (d.tipo === "tiro_fuera" && d.jugador === e.jugador) return d.motivo === "alto" ? "alto" : "ancho";
    if (d.tipo === "intercepcion" && d.receptor === e.jugador) return "bloqueado";
    if (cierreRemate.has(d.tipo)) return "otro";
  }
  return "otro";
}

/** Brief 051 · ids de los remates «a puerta» según `rematesPorLado` (045) y, para cada uno, el tipo
 * del evento que lo cierra (gol o atajada). */
function aPuertaSegun045(eventos: readonly EventoArena[]): Map<string, EventoArena["tipo"]> {
  const r = rematesPorLado(eventos, Infinity), tipos = new Map(eventos.map(e => [e.id, e.tipo])), resultado = new Map<string, EventoArena["tipo"]>();
  for (const lado of lados) r[lado].eventos.forEach((id, k, ids) => {
    const siguiente = ids[k + 1];
    if (tipos.get(id) === "tiro" && siguiente !== undefined && tipos.get(siguiente) !== "tiro") resultado.set(id, tipos.get(siguiente)!);
  });
  return resultado;
}

/** v1.2 · ¿el evento i es un saque desde las manos? En v4, `motivo: "saque_manos"`. Para comparar
 * con reglas sin ese estado (v3), también el primer pase de juego de un portero cuya última
 * ganancia de posesión ocurrió dentro de su área. */
export function esSaqueManos(eventos: readonly EventoArena[], i: number, porteros: ReadonlySet<string>): boolean {
  const e = eventos[i]!;
  if (e.tipo !== "pase" || e.reinicio) return false;
  if (e.motivo === "saque_manos") return true;
  if (!porteros.has(e.jugador)) return false;
  for (let k = i - 1; k >= 0; k--) {
    const x = eventos[k]!;
    if (x.jugador !== e.jugador) continue;
    if (x.tipo === "pase" || x.tipo === "tiro") return false;
    if (ganancia.has(x.tipo)) return !x.reinicio && enAreaPropia(x.hasta, e.lado);
  }
  return false;
}
const enBandaMetrica = (o: Punto) => o.x >= L.bandaMetricaXM && Math.abs(o.y - ARENA.anchoM / 2) > ARENA.areaAnchoM / 2;

function muestrear(estado: EstadoArena, eventos: number, planes?: Record<Lado, OrdenesEquipo>): MuestraTick {
  const balon = estado.balon, poseedor = estado.jugadores.find(j => j.id === balon.poseedor);
  const pausado = !!(estado.pausa && estado.tick < estado.pausa.hastaTick);
  const mam = poseedor ? manoAMano(estado, rival(poseedor.lado), ARENA.radioTiroM) : null;
  const orden = poseedor && planes ? planes[poseedor.lado].ordenes.find(o => o.jugador === poseedor.id) : undefined;
  const conducir = poseedor && poseedor.puesto !== "POR" && !pausado && !estado.saque && orden?.accion === "conducir" ? Math.hypot(poseedor.velocidad.x, poseedor.velocidad.y) : null;
  const superado = !pausado && !estado.saque ? superadoPor(estado) : null;
  const ids = superado ? seleccionRepliegue(estado, perseguidoresDe(estado.jugadores, balon.posicion)).map(j => j.id) : [];
  return { tick: estado.tick, eventos, poseedor: balon.poseedor, balon: { ...balon.posicion }, manos: balon.manos?.portero ?? null, pausado, manoAMano: mam?.id ?? null, conducir,
    jugadores: estado.jugadores.map(j => ({ id: j.id, lado: j.lado, puesto: j.puesto, x: j.posicion.x, y: j.posicion.y, vx: j.velocidad.x, vy: j.velocidad.y })),
    vuelo: balon.vuelo !== null, superado: superado?.id ?? null, seleccion: superado ? { ids, destino: destinoRepliegue(balon.posicion, rival(superado.lado)) } : null,
    persecucion: estado.persecucion ? { ...estado.persecucion } : null };
}

/** Brief 051 · experimento controlado: la configuración de la semilla con `variantes.niveles` y el
 * nivel forzado de los porteros y/o de los jugadores de campo; los no forzados reciben el nivel de
 * su equipo ((ataque + defensa) / 2, redondeado: la variante exige niveles enteros). */
export function partidoConNiveles(seed: number, nivelPortero: number | null, nivelCampo: number | null): SimConfig {
  const base = configDeSemilla(seed);
  const equipo = (lado: Lado) => {
    const nivelEquipo = Math.round((base[lado].ataque + base[lado].defensa) / 2);
    return { ...base[lado], jugadores: base[lado].jugadores.map(j => ({ ...j, nivel: j.posicion === "POR" ? nivelPortero ?? nivelEquipo : nivelCampo ?? nivelEquipo })) };
  };
  return { ...base, variantes: { ...base.variantes, niveles: true }, local: equipo("local"), visita: equipo("visita") };
}
export interface NivelesForzados { portero: number | null; campo: number | null }

/** Ejecuta un partido programado y devuelve las muestras de todos los ticks y los eventos. */
export async function muestrasPartido(seed: number, duracionS: number, reglas?: ReglasArena, niveles?: NivelesForzados): Promise<{ muestras: MuestraTick[]; eventos: EventoArena[] }> {
  const proto = MotorArena.prototype as unknown as { planesActivos: (this: MotorArena, planes: Record<Lado, OrdenesEquipo>) => Record<Lado, OrdenesEquipo> };
  const original = proto.planesActivos, muestras: MuestraTick[] = [];
  proto.planesActivos = function (planes) {
    const activos = original.call(this, planes);
    muestras.push(muestrear(this.estado, this.eventos.length, activos));
    return activos;
  };
  try {
    const registro = await ejecutarArena(crearConfigArena({ seed, duracionS, ...(reglas ? { reglas } : {}), ...(niveles ? { partido: partidoConNiveles(seed, niveles.portero, niveles.campo) } : {}) }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
    muestras.push(muestrear(registro.final, registro.eventos.length));
    return { muestras, eventos: registro.eventos };
  } finally { proto.planesActivos = original; }
}

/** Métricas de un partido a partir de muestras consecutivas y eventos (puro). */
export function analizarPartido(seed: number, muestras: readonly MuestraTick[], eventos: readonly EventoArena[]): MetricasPartido {
  const m: MetricasPartido = { seed, goles: 0, tiros: 0, robosEnManos: 0, atajadasConPosesion: 0, perdidasTrasAtajada: 0, perdidasArea: 0, episodios: [],
    pasesBanda: 0, pasesBandaAlArea: 0, centros: 0, saquesManos: 0, saquesPerdidos: 0, intercepcionesInmediatas: 0, intercepcionesInmediatasCercanas: 0, golesTrasSaque: 0,
    remates: Object.fromEntries(DESENLACES_REMATE.map(d => [d, 0])) as Record<DesenlaceRemate, number>, aPuerta045: 0, atajadas045: 0, discrepancias045: 0, golesSinRemate: 0,
    rematesDentro: 0, rematesLados: 0, sumaDesvioDestinoM: 0, metas: 0, metasConduccion: 0, tiroFueraTrasDesvio: 0, recepcionPorteroRechace: 0,
    ticksConducir: 0, ticksConducirFrenado: 0, fuerasDeJuego: 0,
    repliegueCorren: { corren: 0, muestras: 0 }, repliegueSeleccion: { corren: 0, muestras: 0 }, persecucionPerdedor: { persigue: 0, muestras: 0 } };
  const porteros = new Set(muestras.flatMap(s => s.jugadores.filter(j => j.puesto === "POR").map(j => j.id)));
  const ladoDe = (id: string) => muestras.find(s => s.jugadores.some(j => j.id === id))?.jugadores.find(j => j.id === id)?.lado;
  const porTick = new Map(muestras.map(s => [s.tick, s]));
  const aPuerta = aPuertaSegun045(eventos);
  eventos.forEach((e, i) => {
    if (e.tipo === "tiro") {
      const fisico = desenlaceFisico(eventos, i), cierre = aPuerta.get(e.id);
      m.remates[fisico]++;
      if (cierre) { m.aPuerta045++; if (cierre === "atajada") m.atajadas045++; }
      if ((cierre !== undefined) !== (fisico === "gol" || fisico === "atrapada" || fisico === "desvio")) m.discrepancias045++;
      const lateral = Math.abs(e.hasta.y - ARENA.anchoM / 2);
      m.sumaDesvioDestinoM += lateral;
      if (lateral <= ARENA.arcoM / 2) { m.rematesDentro++; if (lateral > ARENA.arcoM / 4) m.rematesLados++; }
    }
    if (e.tipo === "gol") {
      const previo = eventos.slice(0, i).reverse().find(x => !neutro.has(x.tipo));
      if (!(previo?.tipo === "tiro" || previo?.tipo === "atajada" && previo.motivo === "desvio")) m.golesSinRemate++;
    }
    const siguiente = eventos.slice(i + 1).find(x => !neutro.has(x.tipo));
    if (e.tipo === "gol") m.goles++;
    if (e.tipo === "tiro") m.tiros++;
    if (e.tipo === "fuera_juego") m.fuerasDeJuego++;
    if (e.tipo === "atajada" && e.motivo === "desvio" && siguiente?.tipo === "tiro_fuera") m.tiroFueraTrasDesvio++;
    if (e.tipo === "recepcion" && e.receptor && porteros.has(e.receptor)) {
      const previo = eventos.slice(0, i).reverse().find(x => !neutro.has(x.tipo));
      if (previo?.tipo === "atajada" && previo.motivo === "desvio") m.recepcionPorteroRechace++;
    }
    if (e.tipo === "pase" && !e.reinicio && enBandaMetrica(transformar(e.desde, e.lado))) { m.pasesBanda++; if (enAreaRival(e.hasta, e.lado)) m.pasesBandaAlArea++; }
    if (e.tipo === "pase" && e.motivo === "centro") m.centros++;
    if (esSaqueManos(eventos, i, porteros)) {
      m.saquesManos++;
      const primero = eventos.slice(i + 1).find(x => finSaque.has(x.tipo));
      if (primero && toque.has(primero.tipo) && primero.lado !== e.lado) {
        m.saquesPerdidos++;
        if ((primero.tick - e.tick) * ARENA.pasoS <= L.saqueInmediataS) {
          m.intercepcionesInmediatas++;
          if (distancia(primero.hasta, e.desde) <= L.inmediataRadioM) m.intercepcionesInmediatasCercanas++;
        }
      }
      const limite = e.tick + Math.round(L.golTrasSaqueS / ARENA.pasoS);
      for (const x of eventos.slice(i + 1)) {
        if (x.tick > limite) break;
        if (toqueDefensor.has(x.tipo) && x.lado === e.lado) break;
        if (x.tipo === "gol") { if (x.lado !== e.lado) m.golesTrasSaque++; break; }
      }
    }
    if (e.tipo === "reinicio" && e.reinicio === "meta") {
      m.metas++;
      const previo = porTick.get(e.tick - 1), p = previo?.jugadores.find(j => j.id === previo.poseedor);
      if (p && p.puesto !== "POR" && p.lado === rival(e.lado)) m.metasConduccion++;
    }
    // Pérdida tras atajada (v1.1): el portero pierde la posesión ante un rival antes de soltarla.
    if (e.tipo === "atajada" && e.motivo !== "desvio") {
      m.atajadasConPosesion++;
      for (const x of eventos.slice(i + 1)) {
        if (neutro.has(x.tipo) || ["falta", "amarilla", "roja"].includes(x.tipo)) continue;
        if ((x.tipo === "pase" || x.tipo === "tiro") && x.jugador === e.jugador) break;
        if (x.tipo === "reinicio" && x.lado === e.lado) continue;
        if (x.lado !== e.lado || x.tipo === "gol") m.perdidasTrasAtajada++;
        break;
      }
    }
  });
  for (let i = 1; i < muestras.length; i++) {
    const a = muestras[i - 1]!, b = muestras[i]!;
    if (b.tick !== a.tick + 1) continue;
    // Robo duro: recuperación o falta de un rival en un paso que empieza con el balón en las manos.
    if (a.manos) {
      const lado = ladoDe(a.manos);
      for (const x of eventos.slice(a.eventos, b.eventos)) {
        if ((x.tipo === "pase" || x.tipo === "tiro") && x.jugador === a.manos) break;
        if ((x.tipo === "recuperacion" || x.tipo === "falta") && x.lado !== lado) m.robosEnManos++;
      }
    }
    // Pérdida amplia: de un portero dentro de su área a un rival entre dos ticks.
    const pa = a.jugadores.find(j => j.id === a.poseedor), pb = b.jugadores.find(j => j.id === b.poseedor);
    if (pa?.puesto === "POR" && pb && pb.lado !== pa.lado && enAreaPropia(pa, pa.lado)) m.perdidasArea++;
  }
  for (const s of muestras) if (s.conducir !== null) { m.ticksConducir++; if (s.conducir < L.conducirLentoMps) m.ticksConducirFrenado++; }
  // Episodios de mano a mano: ticks consecutivos (por diferencia de tick) con el mismo poseedor.
  const desenlaceTicks = Math.round(L.desenlaceS / ARENA.pasoS);
  let tramo: MuestraTick[] = [];
  const cerrar = () => {
    if (tramo.length >= L.manoAManoTicks) {
      const primero = tramo[0]!, ultimo = tramo.at(-1)!;
      const lado = primero.jugadores.find(j => j.id === primero.manoAMano)!.lado;
      const portero = (s: MuestraTick) => s.jugadores.find(j => j.lado === rival(lado) && j.puesto === "POR");
      const k0 = portero(primero), k1 = portero(ultimo);
      if (k0 && k1) {
        const dx = primero.balon.x - k0.x, dy = primero.balon.y - k0.y, n = Math.hypot(dx, dy) || 1;
        const desplazamientoM = ((k1.x - k0.x) * dx + (k1.y - k0.y) * dy) / n;
        const fin = eventos.find(e => e.tick >= ultimo.tick && e.tick <= ultimo.tick + desenlaceTicks && tipoPosesion.has(e.tipo));
        let gol = fin?.tipo === "gol";
        if (fin?.tipo === "tiro") gol = eventos.find(e => e.tick >= fin.tick && e.id !== fin.id && tipoResultadoTiro.has(e.tipo))?.tipo === "gol";
        m.episodios.push({ desplazamientoM, gol });
      }
    }
    tramo = [];
  };
  for (const s of muestras) {
    const previo = tramo.at(-1);
    if (s.manoAMano && previo && previo.manoAMano === s.manoAMano && s.tick === previo.tick + 1) tramo.push(s);
    else { cerrar(); if (s.manoAMano) tramo = [s]; }
  }
  cerrar();
  medirPersecucion(m, muestras);
  return m;
}

/** Brief 063 § 11.1 · velocidad hacia el arco propio (local defiende x = 0). */
const haciaSuArco = (j: JugadorMuestra) => j.lado === "local" ? -j.vx : j.vx;
/** Coseno entre la velocidad del jugador y la dirección a `hacia`; null sin velocidad o sin dirección. */
function coseno(j: JugadorMuestra, hacia: Punto): number | null {
  const dx = hacia.x - j.x, dy = hacia.y - j.y, v = Math.hypot(j.vx, j.vy), d = Math.hypot(dx, dy);
  return v && d ? (j.vx * dx + j.vy * dy) / (v * d) : null;
}
/** Brief 063 § 11.1 y v1.1 § 17.7 · `repliegueCorren`, `repliegueSeleccion` y `persecucionPerdedor` (puro). */
function medirPersecucion(m: MetricasPartido, muestras: readonly MuestraTick[]): void {
  const edadRepliegue = Math.round(L63.repliegue.edadMinS / ARENA.pasoS), edadSeleccion = Math.round(L63.seleccion.edadMinS / ARENA.pasoS);
  const lineas: readonly string[] = PE.repliegue.lineas;
  let inicio = -1;
  muestras.forEach((s, i) => {
    const previa = muestras[i - 1];
    if (!s.superado) { inicio = -1; return; }
    if (!(previa && previa.superado === s.superado && previa.tick + 1 === s.tick)) inicio = s.tick;
    const edad = s.tick - inicio, poseedor = s.jugadores.find(j => j.id === s.superado)!;
    if (edad >= edadRepliegue) for (const d of s.jugadores) {
      if (d.lado === poseedor.lado || !lineas.includes(lineaDePuesto(d.puesto)) || Math.hypot(d.x - poseedor.x, d.y - poseedor.y) > PE.repliegue.radioM) continue;
      m.repliegueCorren.muestras++;
      if (haciaSuArco(d) >= L63.repliegue.velocidadMinMps) m.repliegueCorren.corren++;
    }
    if (edad >= edadSeleccion && s.seleccion) for (const id of s.seleccion.ids) {
      const j = s.jugadores.find(x => x.id === id);
      if (!j) continue;
      m.repliegueSeleccion.muestras++;
      const c = coseno(j, s.seleccion.destino);
      if (Math.hypot(j.vx, j.vy) >= L63.seleccion.velocidadMinMps && c !== null && c >= L63.seleccion.cosenoMin) m.repliegueSeleccion.corren++;
    }
  });
  // Robo en duelo: entre dos muestras consecutivas el poseedor de campo pasa a un rival y la primera no tiene vuelo.
  const desde = Math.round(L63.persecucion.desdeS / ARENA.pasoS), hasta = Math.round(L63.persecucion.hastaS / ARENA.pasoS);
  for (let i = 1; i < muestras.length; i++) {
    const a = muestras[i - 1]!, b = muestras[i]!;
    if (b.tick !== a.tick + 1 || a.vuelo || !a.poseedor || !b.poseedor) continue;
    const perdedor = a.jugadores.find(j => j.id === a.poseedor), nuevo = b.jugadores.find(j => j.id === b.poseedor);
    if (!perdedor || !nuevo || perdedor.puesto === "POR" || nuevo.lado === perdedor.lado) continue;
    for (let k = i; k < muestras.length; k++) {
      const s = muestras[k]!, edad = s.tick - b.tick;
      if (edad >= hasta || s.tick !== b.tick + (k - i)) break;
      const z = s.jugadores.find(j => j.id === perdedor.id), poseedor = s.jugadores.find(j => j.id === s.poseedor);
      // Se corta en la primera pausa, cuando el perdedor sale o cuando su lado recupera.
      if (s.pausado || !z || poseedor?.lado === perdedor.lado) break;
      if (edad < desde) continue;
      m.persecucionPerdedor.muestras++;
      const c = coseno(z, s.balon);
      if (Math.hypot(z.vx, z.vy) >= L63.persecucion.velocidadMinMps && c !== null && c >= L63.persecucion.cosenoMin) m.persecucionPerdedor.persigue++;
    }
  }
}

/** Brief 063 § 14 · escenas para el smoke: los episodios superados (ticks consecutivos con el mismo
 * poseedor superado) en los que alguien repliega, y cada persecución (de `estado.persecucion`). */
export interface EscenasPartido {
  seed: number;
  superados: { desdeTick: number; hastaTick: number; poseedor: string; repliegue: string[] }[];
  persecuciones: { jugador: string; linea: string; desdeTick: number; hastaTick: number }[];
}
export function escenasPartido(seed: number, muestras: readonly MuestraTick[]): EscenasPartido {
  const superados: EscenasPartido["superados"] = [], persecuciones: EscenasPartido["persecuciones"] = [];
  const linea = (id: string) => lineaDePuesto(muestras.flatMap(s => s.jugadores).find(j => j.id === id)?.puesto ?? "");
  muestras.forEach((s, i) => {
    const previa = muestras[i - 1], ultimo = superados.at(-1);
    if (s.superado) {
      if (ultimo && previa?.superado === s.superado && previa.tick + 1 === s.tick && ultimo.hastaTick === previa.tick) { ultimo.hastaTick = s.tick; ultimo.repliegue = [...new Set([...ultimo.repliegue, ...(s.seleccion?.ids ?? [])])]; }
      else superados.push({ desdeTick: s.tick, hastaTick: s.tick, poseedor: s.superado, repliegue: [...(s.seleccion?.ids ?? [])] });
    }
    const p = s.persecucion, actual = persecuciones.at(-1);
    if (p && !(actual && actual.jugador === p.jugador && actual.desdeTick === p.desdeTick)) persecuciones.push({ jugador: p.jugador, linea: linea(p.jugador), desdeTick: p.desdeTick, hastaTick: p.hastaTick });
  });
  return { seed, superados: superados.filter(e => e.repliegue.length), persecuciones };
}

const cociente = (a: number, b: number): number | null => b > 0 ? a / b : null;
const cuantil = (xs: readonly number[], f: number): number | null => xs.length ? [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) * f)]! : null;

export interface MetricasLote {
  reglas: ReglasArena; semillas: { desde: number; hasta: number }; duracionS: number; partidos: number;
  golesPorPartido: number; desviacionGoles: number; tirosPorPartido: number;
  robosEnManos: number; atajadasConPosesion: number; perdidasTrasAtajada: number;
  perdidasArea: number; perdidasAreaPorPartido: number;
  manoAMano: { episodios: number; goles: number; conversion: number | null; fraccionDeGoles: number | null; desplazamientoMedianaM: number | null; desplazamientoP75M: number | null; fraccionDesplazado: number | null };
  centros: { pasesBanda: number; alArea: number; proporcion: number | null; motivoCentro: number; porPartido: number };
  saquesManos: number; saquesPerdidos: number; saquesPerdidosPorPartido: number; intercepcionesInmediatas: number; golesTrasSaque: number; golesTrasSaquePorPartido: number;
  /** Brief 051 v1.1 #4. */
  intercepcionesInmediatasPorPartido: number; intercepcionesInmediatasCercanas: number;
  /** Brief 051 · métricas de remate. «A puerta» y atajadas / a puerta: lectura 045 (`rematesPorLado`);
   * conversión, fuera, altos, bloqueados y desvíos / atajadas: desenlace físico. */
  remate: {
    remates: number; porPartido: number; desenlaces: Record<DesenlaceRemate, number>;
    aPuerta: number | null; conversion: number | null; atajadasSobreAPuerta: number | null; desviosSobreAtajadas: number | null;
    fuera: number | null; altos: number; altosSobreFuera: number | null; bloqueados: number | null;
    golesSinRemate: number; golesSinRematePorPartido: number;
    colocacionLados: number | null; desvioMedioM: number | null; discrepancias045: number;
  };
  metas: number; metasConduccion: number; metasConduccionPorPartido: number;
  tiroFueraTrasDesvio: number; recepcionPorteroRechace: number;
  conducir: { ticks: number; frenados: number; fraccion: number | null }; fuerasDeJuego: number;
  /** Brief 063 § 11.1 · bloque A (fracciones; null = sin muestra). */
  persecucion063: { repliegueCorren: number | null; repliegueSeleccion: number | null; persecucionPerdedor: number | null; muestras: { repliegue: number; seleccion: number; persecucion: number } };
}

export function agregarLote(reglas: ReglasArena, duracionS: number, partidos: readonly MetricasPartido[]): MetricasLote {
  const n = partidos.length, suma = (f: (p: MetricasPartido) => number) => partidos.reduce((s, p) => s + f(p), 0);
  const goles = partidos.map(p => p.goles), media = suma(p => p.goles) / n;
  const episodios = partidos.flatMap(p => p.episodios), desplazamientos = episodios.map(e => e.desplazamientoM);
  const golesEpisodio = episodios.filter(e => e.gol).length;
  return {
    reglas, semillas: { desde: Math.min(...partidos.map(p => p.seed)), hasta: Math.max(...partidos.map(p => p.seed)) }, duracionS, partidos: n,
    golesPorPartido: media, desviacionGoles: Math.sqrt(goles.reduce((s, g) => s + (g - media) ** 2, 0) / n), tirosPorPartido: suma(p => p.tiros) / n,
    robosEnManos: suma(p => p.robosEnManos), atajadasConPosesion: suma(p => p.atajadasConPosesion), perdidasTrasAtajada: suma(p => p.perdidasTrasAtajada),
    perdidasArea: suma(p => p.perdidasArea), perdidasAreaPorPartido: suma(p => p.perdidasArea) / n,
    manoAMano: { episodios: episodios.length, goles: golesEpisodio, conversion: cociente(golesEpisodio, episodios.length), fraccionDeGoles: cociente(golesEpisodio, suma(p => p.goles)),
      desplazamientoMedianaM: cuantil(desplazamientos, 0.5), desplazamientoP75M: cuantil(desplazamientos, 0.75), fraccionDesplazado: cociente(desplazamientos.filter(d => d > L.desplazamientoM).length, episodios.length) },
    centros: { pasesBanda: suma(p => p.pasesBanda), alArea: suma(p => p.pasesBandaAlArea), proporcion: cociente(suma(p => p.pasesBandaAlArea), suma(p => p.pasesBanda)), motivoCentro: suma(p => p.centros), porPartido: suma(p => p.centros) / n },
    saquesManos: suma(p => p.saquesManos), saquesPerdidos: suma(p => p.saquesPerdidos), saquesPerdidosPorPartido: suma(p => p.saquesPerdidos) / n,
    intercepcionesInmediatas: suma(p => p.intercepcionesInmediatas), intercepcionesInmediatasPorPartido: suma(p => p.intercepcionesInmediatas) / n, intercepcionesInmediatasCercanas: suma(p => p.intercepcionesInmediatasCercanas),
    remate: agregarRemates(partidos), golesTrasSaque: suma(p => p.golesTrasSaque), golesTrasSaquePorPartido: suma(p => p.golesTrasSaque) / n,
    metas: suma(p => p.metas), metasConduccion: suma(p => p.metasConduccion), metasConduccionPorPartido: suma(p => p.metasConduccion) / n,
    tiroFueraTrasDesvio: suma(p => p.tiroFueraTrasDesvio), recepcionPorteroRechace: suma(p => p.recepcionPorteroRechace),
    conducir: { ticks: suma(p => p.ticksConducir), frenados: suma(p => p.ticksConducirFrenado), fraccion: cociente(suma(p => p.ticksConducirFrenado), suma(p => p.ticksConducir)) },
    fuerasDeJuego: suma(p => p.fuerasDeJuego),
    persecucion063: {
      repliegueCorren: cociente(suma(p => p.repliegueCorren.corren), suma(p => p.repliegueCorren.muestras)),
      repliegueSeleccion: cociente(suma(p => p.repliegueSeleccion.corren), suma(p => p.repliegueSeleccion.muestras)),
      persecucionPerdedor: cociente(suma(p => p.persecucionPerdedor.persigue), suma(p => p.persecucionPerdedor.muestras)),
      muestras: { repliegue: suma(p => p.repliegueCorren.muestras), seleccion: suma(p => p.repliegueSeleccion.muestras), persecucion: suma(p => p.persecucionPerdedor.muestras) },
    },
  };
}

function agregarRemates(partidos: readonly MetricasPartido[]): MetricasLote["remate"] {
  const n = partidos.length, suma = (f: (p: MetricasPartido) => number) => partidos.reduce((s, p) => s + f(p), 0);
  const desenlaces = Object.fromEntries(DESENLACES_REMATE.map(d => [d, suma(p => p.remates[d])])) as Record<DesenlaceRemate, number>;
  const remates = DESENLACES_REMATE.reduce((s, d) => s + desenlaces[d], 0), aPuerta = suma(p => p.aPuerta045);
  const atajadas = desenlaces.atrapada + desenlaces.desvio, fuera = desenlaces.ancho + desenlaces.alto;
  return {
    remates, porPartido: remates / n, desenlaces,
    aPuerta: cociente(aPuerta, remates), conversion: cociente(desenlaces.gol, remates), atajadasSobreAPuerta: cociente(suma(p => p.atajadas045), aPuerta),
    desviosSobreAtajadas: cociente(desenlaces.desvio, atajadas), fuera: cociente(fuera, remates), altos: desenlaces.alto, altosSobreFuera: cociente(desenlaces.alto, fuera),
    bloqueados: cociente(desenlaces.bloqueado, remates), golesSinRemate: suma(p => p.golesSinRemate), golesSinRematePorPartido: suma(p => p.golesSinRemate) / n,
    colocacionLados: cociente(suma(p => p.rematesLados), suma(p => p.rematesDentro)), desvioMedioM: cociente(suma(p => p.sumaDesvioDestinoM), remates),
    discrepancias045: suma(p => p.discrepancias045),
  };
}

/** Brief 063 § 14 · escenas de `semillas` partidos programados desde `desde` (smoke). */
export async function escenasLote(opciones: { desde: number; semillas: number; reglas?: ReglasArena; duracionS?: number }): Promise<EscenasPartido[]> {
  const duracionS = opciones.duracionS ?? L.duracionS, reglas = opciones.reglas ?? ARENA.reglas, escenas: EscenasPartido[] = [];
  for (let seed = opciones.desde; seed < opciones.desde + opciones.semillas; seed++) escenas.push(escenasPartido(seed, (await muestrasPartido(seed, duracionS, reglas)).muestras));
  return escenas;
}

/** Lote de `semillas` partidos programados desde `desde` (siempre LOTE_ARENA_046.duracionS salvo prueba). */
export async function medirLote(opciones: { desde: number; semillas: number; reglas?: ReglasArena; duracionS?: number; niveles?: NivelesForzados }): Promise<MetricasLote> {
  const duracionS = opciones.duracionS ?? L.duracionS, reglas = opciones.reglas ?? ARENA.reglas, partidos: MetricasPartido[] = [];
  for (let seed = opciones.desde; seed < opciones.desde + opciones.semillas; seed++) {
    const { muestras, eventos } = await muestrasPartido(seed, duracionS, reglas, opciones.niveles);
    partidos.push(analizarPartido(seed, muestras, eventos));
  }
  return agregarLote(reglas, duracionS, partidos);
}

type Banda = (typeof L)["rapido"] | (typeof L)["completo"];
type Banda051 = (typeof L51)["rapido"] | (typeof L51)["completo"];
/** Bandas incumplidas (nombre y valor). Un valor `null` es «sin muestra» y siempre incumple. Con
 * `banda051` (brief 051), también las de remate (sin el experimento controlado, que son otros lotes). */
export function incumplimientos(m: MetricasLote, banda: Banda, banda051?: Banda051): string[] {
  const fallos: string[] = [];
  const max = (nombre: string, v: number | null, limite: number) => { if (v === null || v > limite) fallos.push(`${nombre}=${v ?? "sin muestra"} > ${limite}`); };
  const min = (nombre: string, v: number | null, limite: number) => { if (v === null || v < limite) fallos.push(`${nombre}=${v ?? "sin muestra"} < ${limite}`); };
  const entre = (nombre: string, v: number | null, r: { min: number; max: number }) => { if (v === null || v < r.min || v > r.max) fallos.push(`${nombre}=${v ?? "sin muestra"} ∉ [${r.min}; ${r.max}]`); };
  max("robosEnManos", m.robosEnManos, banda.robosEnManosMax);
  max("perdidasTrasAtajada", cociente(m.perdidasTrasAtajada, m.atajadasConPosesion) === null ? null : m.perdidasTrasAtajada, banda.perdidasTrasAtajadaMax);
  fallos.push(...incumplimientosSaques(m, banda));
  min("desplazamientoMedianaM", m.manoAMano.desplazamientoMedianaM, banda.desplazamientoMedianaMinM);
  min("fraccionDesplazado", m.manoAMano.fraccionDesplazado, banda.fraccionDesplazadoMin);
  if ("conversion" in banda) entre("conversion", m.manoAMano.conversion, banda.conversion);
  min("proporcionCentros", m.centros.proporcion, banda.proporcionCentrosMin);
  min("centrosPorPartido", m.centros.porPartido, banda.centrosPorPartidoMin);
  max("metasConduccionPorPartido", m.metasConduccionPorPartido, banda.metasConduccionPorPartidoMax);
  entre("golesPorPartido", m.golesPorPartido, banda.golesPorPartido);
  max("tiroFueraTrasDesvio", m.tiroFueraTrasDesvio, banda.tiroFueraTrasDesvioMax);
  max("recepcionPorteroRechace", m.recepcionPorteroRechace, banda.recepcionPorteroRechaceMax);
  max("conducirFrenado", m.conducir.fraccion, banda.conducirFrenadoMax);
  if (banda051) fallos.push(...incumplimientosRemate(m, banda051));
  return fallos;
}

const comprobar = (fallos: string[]) => ({
  max: (nombre: string, v: number | null, limite: number) => { if (v === null || v > limite) fallos.push(`${nombre}=${v ?? "sin muestra"} > ${limite}`); },
  min: (nombre: string, v: number | null, limite: number) => { if (v === null || v < limite) fallos.push(`${nombre}=${v ?? "sin muestra"} < ${limite}`); },
  entre: (nombre: string, v: number | null, r: { min: number; max: number }) => { if (v === null || v < r.min || v > r.max) fallos.push(`${nombre}=${v ?? "sin muestra"} ∉ [${r.min}; ${r.max}]`); },
});

type Banda063 = (typeof L63)["rapido"] | (typeof L63)["completo"];
/** Brief 063 § 12.3 · bandas de un lote según sus reglas y su tamaño: 046 y 051 (v6 y anteriores, las
 * originales) y las del bloque A desde LOTE_ARENA_063.desdeA (null antes). */
export function bandasLote(reglas: ReglasArena, tamano: "rapido" | "completo"): { b046: Banda; b051: Banda051; b063: Banda063 | null } {
  const conA = reglasArena.indexOf(reglas) >= reglasArena.indexOf(L63.desdeA);
  return { b046: L[tamano], b051: L51[tamano], b063: conA ? L63[tamano] : null };
}
/** Brief 063 § 11.2 · bandas del bloque A (sin muestra = incumple). */
export function incumplimientos063(m: MetricasLote, banda: Banda063): string[] {
  const fallos: string[] = [], { min } = comprobar(fallos), a = m.persecucion063;
  min("repliegueCorren", a.repliegueCorren, banda.repliegueCorrenMin);
  min("persecucionPerdedor", a.persecucionPerdedor, banda.persecucionPerdedorMin);
  if ("repliegueSeleccionMin" in banda) min("repliegueSeleccion", a.repliegueSeleccion, banda.repliegueSeleccionMin);
  return fallos;
}

/** Brief 051 · bandas de remate de LOTE_ARENA_051 (salvo el experimento controlado). */
export function incumplimientosRemate(m: MetricasLote, banda: Banda051): string[] {
  const fallos: string[] = [], { max, min, entre } = comprobar(fallos), r = m.remate;
  entre("aPuerta", r.aPuerta, banda.aPuerta);
  if ("conversion" in banda) entre("conversionRemate", r.conversion, banda.conversion);
  entre("atajadasSobreAPuerta", r.atajadasSobreAPuerta, banda.atajadasSobreAPuerta);
  entre("fuera", r.fuera, banda.fuera);
  if ("altosMin" in banda) min("altos", r.remates ? r.altos : null, banda.altosMin);
  if ("altosSobreFuera" in banda) entre("altosSobreFuera", r.altosSobreFuera, banda.altosSobreFuera);
  max("bloqueados", r.bloqueados, banda.bloqueadosMax);
  max("golesSinRematePorPartido", m.partidos ? r.golesSinRematePorPartido : null, banda.golesSinRematePorPartidoMax);
  min("colocacionLados", r.colocacionLados, banda.colocacionLadosMin);
  return fallos;
}

/** Brief 051 · experimento controlado: el mismo lote con el nivel forzado a nivelesControlado.bajo y
 * a .alto, para los porteros (diferencia de atajadas / a puerta) o para los de campo (diferencia de
 * conversión). Sin muestra en cualquiera de los dos, la diferencia es null. */
export async function medirControlado(opciones: { desde: number; semillas: number; reglas?: ReglasArena; duracionS?: number; quien: "portero" | "campo" }): Promise<{ bajo: MetricasLote; alto: MetricasLote; diferencia: number | null }> {
  const niveles = (nivel: number): NivelesForzados => opciones.quien === "portero" ? { portero: nivel, campo: null } : { portero: null, campo: nivel };
  const bajo = await medirLote({ ...opciones, niveles: niveles(L51.nivelesControlado.bajo) });
  const alto = await medirLote({ ...opciones, niveles: niveles(L51.nivelesControlado.alto) });
  const valor = (x: MetricasLote) => opciones.quien === "portero" ? x.remate.atajadasSobreAPuerta : x.remate.conversion;
  const a = valor(alto), b = valor(bajo);
  return { bajo, alto, diferencia: a === null || b === null ? null : a - b };
}

/** Brief 051 · bandas del experimento controlado (diferencias alto − bajo). `campo` solo en `completo`. */
export function incumplimientosControlado(diferencias: { porteros: number | null; campo?: number | null }, banda: Banda051): string[] {
  const fallos: string[] = [], { min } = comprobar(fallos);
  min("controladoPorteros", diferencias.porteros, banda.controladoPorterosMin);
  if ("controladoCampoMin" in banda) min("controladoCampo", diferencias.campo ?? null, banda.controladoCampoMin);
  return fallos;
}

/** v1.2 · bandas de los saques desde las manos (también exigidas en el segundo lote). Sin saques,
 * «sin muestra». */
export function incumplimientosSaques(m: MetricasLote, banda: Banda): string[] {
  if (!m.saquesManos) return ["saquesManos=sin muestra"];
  const fallos: string[] = [];
  // Brief 051 v1.1 #4: el temporal del 046 (≤ 1 en el lote rápido, ≤ 0,01 por partido en el completo)
  // y el cercano (toque a ≤ inmediataRadioM del saque), con su propia banda.
  if ("intercepcionesInmediatasPorPartidoMax" in banda) { if (m.intercepcionesInmediatasPorPartido > banda.intercepcionesInmediatasPorPartidoMax) fallos.push(`intercepcionesInmediatasPorPartido=${m.intercepcionesInmediatasPorPartido} > ${banda.intercepcionesInmediatasPorPartidoMax}`); }
  else if (m.intercepcionesInmediatas > banda.intercepcionesInmediatasMax) fallos.push(`intercepcionesInmediatas=${m.intercepcionesInmediatas} > ${banda.intercepcionesInmediatasMax}`);
  if (m.intercepcionesInmediatasCercanas > banda.intercepcionesCercanasMax) fallos.push(`intercepcionesInmediatasCercanas=${m.intercepcionesInmediatasCercanas} > ${banda.intercepcionesCercanasMax}`);
  if (m.golesTrasSaquePorPartido > banda.golesTrasSaquePorPartidoMax) fallos.push(`golesTrasSaquePorPartido=${m.golesTrasSaquePorPartido} > ${banda.golesTrasSaquePorPartidoMax}`);
  if (m.saquesPerdidosPorPartido > banda.saquesPerdidosPorPartidoMax) fallos.push(`saquesPerdidosPorPartido=${m.saquesPerdidosPorPartido} > ${banda.saquesPerdidosPorPartidoMax}`);
  return fallos;
}
