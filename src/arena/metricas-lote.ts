// Brief 046 · Métricas de lote de la arena (controladores programados). Muestrea TODOS los ticks
// (pausas incluidas) envolviendo `MotorArena.prototype.planesActivos`, que el motor llama al
// empezar cada paso, y mide la continuidad de los episodios por diferencia de ticks. Un
// denominador cero es `null` («sin muestra»): nunca cuenta como cumplimiento.
// Geometría y ticks salen de ARENA / LOTE_ARENA_046; no hay cifras propias.
import { ARENA, LOTE_ARENA_046 as L } from "../sim/limites";
import type { Lado } from "../sim/tipos";
import { enAreaRival } from "./ataque";
import { transformar } from "./catalogo";
import { crearControladorProgramado } from "./controladores";
import { ejecutarArena } from "./coordinador";
import { crearConfigArena, MotorArena } from "./motor";
import { enAreaPropia, manoAMano } from "./portero";
import { rival, type EstadoArena, type EventoArena, type OrdenesEquipo, type Punto, type ReglasArena } from "./tipos";

interface JugadorMuestra { id: string; lado: Lado; puesto: string; x: number; y: number }
/** Estado al empezar el paso `tick` (o el final del partido). */
export interface MuestraTick {
  tick: number; eventos: number; poseedor: string | null; balon: Punto;
  manos: string | null; pausado: boolean;
  /** Poseedor del episodio de mano a mano medido con ARENA.radioTiroM, o null. */
  manoAMano: string | null;
  /** `conducir` del poseedor de campo sin pausa ni saque: velocidad del poseedor (m/s). */
  conducir: number | null;
  jugadores: JugadorMuestra[];
}

export interface MetricasPartido {
  seed: number; goles: number; tiros: number;
  robosEnManos: number; atajadasConPosesion: number; perdidasTrasAtajada: number; perdidasArea: number;
  episodios: { desplazamientoM: number; gol: boolean }[];
  pasesBanda: number; pasesBandaAlArea: number; centros: number;
  /** v1.2 · saques desde las manos, perdidos (primer toque rival), interceptados en ≤ saqueInmediataS
   * y goles rivales sin toque defensor en ≤ golTrasSaqueS. */
  saquesManos: number; saquesPerdidos: number; intercepcionesInmediatas: number; golesTrasSaque: number;
  metas: number; metasConduccion: number;
  tiroFueraTrasDesvio: number; recepcionPorteroRechace: number;
  ticksConducir: number; ticksConducirFrenado: number; fuerasDeJuego: number;
}

const tipoPosesion = new Set<EventoArena["tipo"]>(["tiro", "pase", "recuperacion", "intercepcion", "falta", "fuera_juego", "reinicio", "gol"]);
const tipoResultadoTiro = new Set<EventoArena["tipo"]>(["gol", "atajada", "tiro_fuera", "intercepcion", "reinicio", "recepcion", "recuperacion"]);
const neutro = new Set<EventoArena["tipo"]>(["plan_equipo", "cambio"]);
const toque = new Set<EventoArena["tipo"]>(["recepcion", "intercepcion", "recuperacion", "atajada"]);
const finSaque = new Set<EventoArena["tipo"]>([...toque, "fuera_juego", "reinicio", "gol"]);
const ganancia = new Set<EventoArena["tipo"]>(["recepcion", "atajada", "intercepcion", "recuperacion", "reinicio"]);
const toqueDefensor = new Set<EventoArena["tipo"]>([...toque, "pase", "tiro"]);

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
  return { tick: estado.tick, eventos, poseedor: balon.poseedor, balon: { ...balon.posicion }, manos: balon.manos?.portero ?? null, pausado, manoAMano: mam?.id ?? null, conducir,
    jugadores: estado.jugadores.map(j => ({ id: j.id, lado: j.lado, puesto: j.puesto, x: j.posicion.x, y: j.posicion.y })) };
}

/** Ejecuta un partido programado y devuelve las muestras de todos los ticks y los eventos. */
export async function muestrasPartido(seed: number, duracionS: number, reglas?: ReglasArena): Promise<{ muestras: MuestraTick[]; eventos: EventoArena[] }> {
  const proto = MotorArena.prototype as unknown as { planesActivos: (this: MotorArena, planes: Record<Lado, OrdenesEquipo>) => Record<Lado, OrdenesEquipo> };
  const original = proto.planesActivos, muestras: MuestraTick[] = [];
  proto.planesActivos = function (planes) {
    const activos = original.call(this, planes);
    muestras.push(muestrear(this.estado, this.eventos.length, activos));
    return activos;
  };
  try {
    const registro = await ejecutarArena(crearConfigArena({ seed, duracionS, ...(reglas ? { reglas } : {}) }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
    muestras.push(muestrear(registro.final, registro.eventos.length));
    return { muestras, eventos: registro.eventos };
  } finally { proto.planesActivos = original; }
}

/** Métricas de un partido a partir de muestras consecutivas y eventos (puro). */
export function analizarPartido(seed: number, muestras: readonly MuestraTick[], eventos: readonly EventoArena[]): MetricasPartido {
  const m: MetricasPartido = { seed, goles: 0, tiros: 0, robosEnManos: 0, atajadasConPosesion: 0, perdidasTrasAtajada: 0, perdidasArea: 0, episodios: [],
    pasesBanda: 0, pasesBandaAlArea: 0, centros: 0, saquesManos: 0, saquesPerdidos: 0, intercepcionesInmediatas: 0, golesTrasSaque: 0, metas: 0, metasConduccion: 0, tiroFueraTrasDesvio: 0, recepcionPorteroRechace: 0,
    ticksConducir: 0, ticksConducirFrenado: 0, fuerasDeJuego: 0 };
  const porteros = new Set(muestras.flatMap(s => s.jugadores.filter(j => j.puesto === "POR").map(j => j.id)));
  const ladoDe = (id: string) => muestras.find(s => s.jugadores.some(j => j.id === id))?.jugadores.find(j => j.id === id)?.lado;
  const porTick = new Map(muestras.map(s => [s.tick, s]));
  eventos.forEach((e, i) => {
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
        if ((primero.tick - e.tick) * ARENA.pasoS <= L.saqueInmediataS) m.intercepcionesInmediatas++;
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
  return m;
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
  metas: number; metasConduccion: number; metasConduccionPorPartido: number;
  tiroFueraTrasDesvio: number; recepcionPorteroRechace: number;
  conducir: { ticks: number; frenados: number; fraccion: number | null }; fuerasDeJuego: number;
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
    intercepcionesInmediatas: suma(p => p.intercepcionesInmediatas), golesTrasSaque: suma(p => p.golesTrasSaque), golesTrasSaquePorPartido: suma(p => p.golesTrasSaque) / n,
    metas: suma(p => p.metas), metasConduccion: suma(p => p.metasConduccion), metasConduccionPorPartido: suma(p => p.metasConduccion) / n,
    tiroFueraTrasDesvio: suma(p => p.tiroFueraTrasDesvio), recepcionPorteroRechace: suma(p => p.recepcionPorteroRechace),
    conducir: { ticks: suma(p => p.ticksConducir), frenados: suma(p => p.ticksConducirFrenado), fraccion: cociente(suma(p => p.ticksConducirFrenado), suma(p => p.ticksConducir)) },
    fuerasDeJuego: suma(p => p.fuerasDeJuego),
  };
}

/** Lote de `semillas` partidos programados desde `desde` (siempre LOTE_ARENA_046.duracionS salvo prueba). */
export async function medirLote(opciones: { desde: number; semillas: number; reglas?: ReglasArena; duracionS?: number }): Promise<MetricasLote> {
  const duracionS = opciones.duracionS ?? L.duracionS, reglas = opciones.reglas ?? ARENA.reglas, partidos: MetricasPartido[] = [];
  for (let seed = opciones.desde; seed < opciones.desde + opciones.semillas; seed++) {
    const { muestras, eventos } = await muestrasPartido(seed, duracionS, reglas);
    partidos.push(analizarPartido(seed, muestras, eventos));
  }
  return agregarLote(reglas, duracionS, partidos);
}

type Banda = (typeof L)["rapido"] | (typeof L)["completo"];
/** Bandas incumplidas (nombre y valor). Un valor `null` es «sin muestra» y siempre incumple. */
export function incumplimientos(m: MetricasLote, banda: Banda): string[] {
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
  return fallos;
}

/** v1.2 · bandas de los saques desde las manos (también exigidas en el segundo lote). Sin saques,
 * «sin muestra». */
export function incumplimientosSaques(m: MetricasLote, banda: Banda): string[] {
  if (!m.saquesManos) return ["saquesManos=sin muestra"];
  const fallos: string[] = [];
  if (m.intercepcionesInmediatas > banda.intercepcionesInmediatasMax) fallos.push(`intercepcionesInmediatas=${m.intercepcionesInmediatas} > ${banda.intercepcionesInmediatasMax}`);
  if (m.golesTrasSaquePorPartido > banda.golesTrasSaquePorPartidoMax) fallos.push(`golesTrasSaquePorPartido=${m.golesTrasSaquePorPartido} > ${banda.golesTrasSaquePorPartidoMax}`);
  if (m.saquesPerdidosPorPartido > banda.saquesPerdidosPorPartidoMax) fallos.push(`saquesPerdidosPorPartido=${m.saquesPerdidosPorPartido} > ${banda.saquesPerdidosPorPartidoMax}`);
  return fallos;
}
