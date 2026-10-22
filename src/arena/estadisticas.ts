// Brief 049 (v1.1) · Cifras del partido y por jugador. Código determinista, sin LLM. Todo recibe
// (registro, tick) y usa SOLO los eventos con e.tick ≤ tick y los fotogramas con f.tick ≤ tick
// (nunca `registro.final`): vale para el cursor, para la emisión en búfer (el cliente guarda
// fotogramas por delante del cursor) y para el final.
//
// Una sola agregación por prefijo (`agregarPrefijo`, § 11): una pasada por los eventos (máquina
// de § 3), una por los fotogramas con un puntero sobre los eventos y una llamada a
// `rematesPorLado` (045, sin tocar). `cifrasJugador` y `cifrasEquipos` son proyecciones.
import { ARENA, ESTADISTICAS_ARENA, IGR_ARENA } from "../sim/limites";
import type { Lado } from "../sim/tipos";
import { rematesPorLado } from "./estadista";
import type { EvidenciaMesa } from "./protocolo";
import { lados, reglasArena, type ConfigArena, type EventoArena, type Punto, type ReglasArena, type RegistroArena } from "./tipos";

/** Copia de `reglasDesde` de motor.ts: importar el motor desde un componente cliente arrastra
 * módulos de servidor al paquete del navegador y rompe `next build`. La prueba de estadisticas
 * exige que coincida con la del motor para todas las reglas. */
export const reglasDesdeCliente = (config: Pick<ConfigArena, "reglas">, desde: ReglasArena): boolean =>
  config.reglas !== undefined && reglasArena.indexOf(config.reglas) >= reglasArena.indexOf(desde);

export type ClaseCifra = "registrada" | "estimada";
export const CLAVES_JUGADOR = [
  "goles", "autogoles", "remates", "remates_directos", "remates_indirectos", "remates_pendientes", "pases",
  "pases_completados", "precision_pase", "distancia_media_pase", "centros", "recuperaciones", "perdidas",
  "faltas_cometidas", "faltas_recibidas", "amarillas", "rojas", "fueras_juego", "atajadas", "acciones_balon",
  "distancia_m", "velocidad_max_kmh", "posesion_s", "igr",
] as const;
export type ClaveCifraJugador = (typeof CLAVES_JUGADOR)[number];
export const CLAVES_EQUIPO = [
  "posesion_pct", "igr", "remates", "remates_directos", "remates_indirectos", "remates_cercanos", "esquinas", "fueras_juego",
  "pases_completados", "precision_pase", "recuperaciones", "perdidas", "faltas", "amarillas", "rojas", "atajadas",
] as const;
export type ClaveCifraEquipo = (typeof CLAVES_EQUIPO)[number];
export type ClaveCifra = ClaveCifraJugador | ClaveCifraEquipo;

export interface Cifra<T = number> {
  clave: ClaveCifra; valor: T | null;            // null = no aplicable o no simulado («—»)
  clase: ClaseCifra;
  evidencia: EvidenciaMesa;
}
export interface CifrasJugador { jugador: string; lado: Lado; tick: number; cubiertoHastaTick: number; cifras: Record<ClaveCifraJugador, Cifra>; }
export interface FilaPanel { clave: ClaveCifraEquipo; clase: ClaseCifra; local: Cifra; visita: Cifra; lider: Lado | null; }
export interface CifrasEquipo { tick: number; cubiertoHastaTick: number; filas: FilaPanel[]; final: boolean; }
export interface Capacidades { faltas: boolean; reinicios: boolean; centros: boolean }

/** § 4.3 (v1.1) · Lista cerrada de etiquetas. `pases` («intentados») y `remates_pendientes` («en
 * juego») no figuran en la tabla del brief: los exige la ficha (§ 4.1, § 5 v1.1). Ninguna contiene
 * «xG», «goles esperados» ni «expected goals». */
export const ETIQUETAS_CIFRAS: Record<ClaveCifra, { es: string; en: string }> = {
  posesion_pct: { es: "Posesión", en: "Possession" },
  remates: { es: "Remates", en: "Shots" },
  remates_directos: { es: "Remates directos (a puerta)", en: "Shots on target" },
  remates_indirectos: { es: "Remates indirectos (fuera o bloqueados)", en: "Shots off target or blocked" },
  remates_pendientes: { es: "Remates en juego", en: "Shots still in play" },
  esquinas: { es: "Saques de esquina", en: "Corners" },
  fueras_juego: { es: "Fueras de juego", en: "Offsides" },
  pases: { es: "Pases intentados", en: "Passes attempted" },
  pases_completados: { es: "Pases completados", en: "Passes completed" },
  precision_pase: { es: "Precisión de pase", en: "Pass accuracy" },
  distancia_media_pase: { es: "Distancia media de pase", en: "Average pass distance" },
  centros: { es: "Centros", en: "Crosses" },
  recuperaciones: { es: "Balones recuperados", en: "Balls recovered" },
  perdidas: { es: "Balones perdidos", en: "Balls lost" },
  faltas: { es: "Faltas", en: "Fouls" },
  faltas_cometidas: { es: "Faltas cometidas", en: "Fouls committed" },
  faltas_recibidas: { es: "Faltas recibidas", en: "Fouls suffered" },
  amarillas: { es: "Tarjetas amarillas", en: "Yellow cards" },
  rojas: { es: "Tarjetas rojas", en: "Red cards" },
  atajadas: { es: "Atajadas", en: "Saves" },
  goles: { es: "Goles", en: "Goals" },
  autogoles: { es: "Autogoles", en: "Own goals" },
  acciones_balon: { es: "Acciones con balón", en: "Ball actions" },
  distancia_m: { es: "Distancia recorrida", en: "Distance covered" },
  velocidad_max_kmh: { es: "Velocidad máxima", en: "Top speed" },
  posesion_s: { es: "Tiempo con el balón", en: "Time on the ball" },
  igr: { es: "Índice geométrico de remate (suma) · estimado", en: "Geometric shot index (sum) · estimated" },
  remates_cercanos: { es: "Remates cercanos y centrados · estimado", en: "Close, central shots · estimated" },
};

/** v1.1 § 9 (nivel 3) · Índice geométrico de remate desde `desde` hacia el arco rival de `lado`.
 * Ordena geometrías; NO es una probabilidad. 0 sobre o detrás de la línea de fondo rival. */
export function igrRemate(desde: Punto, lado: "local" | "visita"): number {
  const x = lado === "local" ? ARENA.largoM : 0, delante = lado === "local" ? desde.x < x : desde.x > x;
  const y1 = ARENA.anchoM / 2 - ARENA.arcoM / 2, y2 = ARENA.anchoM / 2 + ARENA.arcoM / 2;
  const a1 = Math.atan2(y1 - desde.y, x - desde.x), a2 = Math.atan2(y2 - desde.y, x - desde.x);
  let theta = Math.abs(a2 - a1); if (theta > Math.PI) theta = 2 * Math.PI - theta;
  if (!delante || !(theta > 0)) return 0;
  const d = Math.hypot(x - desde.x, ARENA.anchoM / 2 - desde.y), theta0 = 2 * Math.atan((ARENA.arcoM / 2) / IGR_ARENA.puntoPenalM);
  const bruto = IGR_ARENA.base * (theta / theta0) * Math.exp(-Math.max(0, d - IGR_ARENA.distanciaLibreM) / IGR_ARENA.escalaM);
  return Math.min(IGR_ARENA.max, Math.max(IGR_ARENA.min, bruto));
}


/** § 6 (v1.1) · Qué simula el registro. Capacidad falsa ⇒ cifra `null` («no simulado»); verdadera
 * y sin eventos ⇒ 0 («cero observado»). */
export function capacidades(registro: RegistroArena): Capacidades {
  return { faltas: !!registro.inicial.entrenadores, reinicios: registro.config.reglas !== undefined, centros: reglasDesdeCliente(registro.config, "reinicios-v4") };
}
const CAPACIDAD: Partial<Record<ClaveCifra, keyof Capacidades>> = {
  faltas: "faltas", faltas_cometidas: "faltas", faltas_recibidas: "faltas", amarillas: "faltas", rojas: "faltas",
  esquinas: "reinicios", centros: "centros",
};
/** La cifra depende de una capacidad que este registro no simula. */
export const noSimulada = (registro: RegistroArena, clave: ClaveCifra) => { const c = CAPACIDAD[clave]; return !!c && !capacidades(registro)[c]; };

/** Acumuladores de un jugador; cada lista guarda los ids de evidencia. */
export interface AcumuladoJugador {
  goles: string[]; autogoles: string[]; remates: string[];
  directos: number; directosEv: string[]; indirectos: number; indirectosEv: string[]; pendientes: number; pendientesEv: string[];
  pases: string[]; distanciasPase: number[]; centros: string[];
  completados: number; completadosEv: string[]; fallidos: number; fallidosEv: string[]; cancelados: string[];
  recuperaciones: number; recuperacionesEv: string[]; perdidas: number; perdidasEv: string[];
  faltasCometidas: string[]; faltasRecibidas: string[]; amarillas: string[]; rojas: string[];
  fuerasJuego: string[]; atajadas: string[]; desvios: string[]; acciones: string[];
  distanciaM: number; velocidadMax: number | null; posesionTicks: number;
  igr: number; cercanos: string[];
}
const vacio = (): AcumuladoJugador => ({
  goles: [], autogoles: [], remates: [], directos: 0, directosEv: [], indirectos: 0, indirectosEv: [], pendientes: 0, pendientesEv: [],
  pases: [], distanciasPase: [], centros: [], completados: 0, completadosEv: [], fallidos: 0, fallidosEv: [], cancelados: [],
  recuperaciones: 0, recuperacionesEv: [], perdidas: 0, perdidasEv: [], faltasCometidas: [], faltasRecibidas: [],
  amarillas: [], rojas: [], fuerasJuego: [], atajadas: [], desvios: [], acciones: [], distanciaM: 0, velocidadMax: null, posesionTicks: 0, igr: 0, cercanos: [],
});
export interface AgregadoPrefijo {
  tick: number; cubiertoHastaTick: number; final: boolean; capacidades: Capacidades;
  /** Plantilla completa (titulares y banco) → lado. */
  lados: Map<string, Lado>;
  jugadores: Map<string, AcumuladoJugador>;
  porLado: Record<Lado, { esquinas: string[]; posesionTicks: number }>;
  /** Pases abiertos al acabar el prefijo (a lo sumo uno). */
  pendientesPase: string[];
  orden: Map<string, number>;
  /** id → tick de los eventos del prefijo (saltos de la evidencia sin recorrer el registro). */
  tickDe: Map<string, number>;
  /** Eventos del prefijo: 0 ⇒ el panel muestra «Esperando el inicio». */
  eventosPrefijo: number;
}

const ACCIONES_BALON: ReadonlySet<EventoArena["tipo"]> = new Set(["pase", "recepcion", "intercepcion", "recuperacion", "tiro", "atajada", "reinicio"]);

/** § 1 (v1.1) · Final solo con el prefijo: duración cumplida, `final_anticipado` o fotograma `finalizado`. */
function esFinal(registro: RegistroArena, tick: number, eventos: readonly EventoArena[], fotogramasFinalizados: boolean): boolean {
  return tick * ARENA.pasoS >= registro.config.duracionS - 1e-9 || eventos.some(e => e.tipo === "final_anticipado") || fotogramasFinalizados;
}

/** Brief 053 · La misma regla del § 1 (v1.1) sobre el prefijo ≤ tick, sin leer `registro.final`. */
export function finalDelPrefijo(registro: RegistroArena, tick: number): boolean {
  return esFinal(registro, tick, registro.eventos.filter(e => e.tick <= tick), registro.fotogramas.some(f => f.tick <= tick && !!f.finalizado));
}

export function agregarPrefijo(registro: RegistroArena, tick: number): AgregadoPrefijo {
  const eventos = registro.eventos.filter(e => e.tick <= tick);
  const fotogramas = registro.fotogramas.filter(f => f.tick <= tick);
  const ladoDe = new Map([...registro.inicial.jugadores, ...registro.inicial.banco ?? []].map(j => [j.id, j.lado] as const));
  const jugadores = new Map<string, AcumuladoJugador>();
  const acc = (id: string) => { let a = jugadores.get(id); if (!a) { a = vacio(); jugadores.set(id, a); } return a; };
  const porLado: AgregadoPrefijo["porLado"] = { local: { esquinas: [], posesionTicks: 0 }, visita: { esquinas: [], posesionTicks: 0 } };
  const rechaceEsVuelo = !reglasDesdeCliente(registro.config, "reinicios-v3");

  // ---- Máquina de § 3 (v1.1). Los remates NO pasan por aquí.
  let controlador: string | null = registro.inicial.balon.poseedor;
  let ladoControl: Lado | null = controlador ? ladoDe.get(controlador) ?? null : null;
  let vuelo: EventoArena | null = null, pase: EventoArena | null = null;
  let suelto: { lado: Lado; atajada: EventoArena } | null = null;
  const controla = (e: EventoArena) => { controlador = e.jugador; ladoControl = e.lado; };
  const sinControl = () => { controlador = null; ladoControl = null; };
  /** Cierra el pase abierto como cancelado (cualquier cierre que no sea completado ni fallido). */
  const cancelar = () => { if (pase) { acc(pase.jugador).cancelados.push(pase.id); pase = null; } };
  const fallar = (p: EventoArena, cierre: EventoArena) => { const a = acc(p.jugador); a.fallidos++; a.fallidosEv.push(p.id, cierre.id); a.perdidas++; a.perdidasEv.push(p.id, cierre.id); pase = null; };
  const recuperar = (id: string, ev: string[]) => { const a = acc(id); a.recuperaciones++; a.recuperacionesEv.push(...ev); };

  for (const e of eventos) {
    if (ACCIONES_BALON.has(e.tipo)) acc(e.jugador).acciones.push(e.id);
    const p = pase as EventoArena | null, v = vuelo as EventoArena | null, s = suelto as { lado: Lado; atajada: EventoArena } | null;
    switch (e.tipo) {
      case "pase": {
        const a = acc(e.jugador); a.pases.push(e.id); a.distanciasPase.push(e.distanciaM);
        if (e.motivo === "centro") a.centros.push(e.id);
        cancelar(); pase = e; vuelo = e; controla(e); suelto = null; break;
      }
      case "tiro": {
        const a = acc(e.jugador), igr = igrRemate(e.desde, e.lado); a.remates.push(e.id); a.igr += igr;
        if (igr >= IGR_ARENA.umbralCercano) a.cercanos.push(e.id);
      }
        cancelar(); vuelo = e; controla(e); suelto = null; break;
      case "recepcion":
        if (p && e.receptor === p.jugador) { const a = acc(p.jugador); a.completados++; a.completadosEv.push(p.id, e.id); pase = null; }
        else cancelar();
        vuelo = null; controla(e); suelto = null; break;
      case "intercepcion":
        if (p && e.receptor === p.jugador) { fallar(p, e); recuperar(e.jugador, [e.id]); }
        else {
          cancelar();
          if (v?.tipo === "tiro" && e.receptor === v.jugador) recuperar(e.jugador, [e.id]);
          else if (ladoControl !== e.lado) recuperar(e.jugador, [e.id]);
        }
        vuelo = null; controla(e); suelto = null; break;
      case "atajada": {
        const a = acc(e.jugador); a.atajadas.push(e.id);
        cancelar();
        if (e.motivo === "desvio") { a.desvios.push(e.id); sinControl(); suelto = { lado: e.lado, atajada: e }; if (!rechaceEsVuelo) vuelo = null; }
        else { vuelo = null; controla(e); suelto = null; }
        break;
      }
      case "recuperacion":
        if (s) { if (e.lado === s.lado) recuperar(e.jugador, [s.atajada.id, e.id]); }
        else if (ladoControl !== null && ladoControl !== e.lado) {
          const previo = acc(controlador!); previo.perdidas++; previo.perdidasEv.push(e.id);
          recuperar(e.jugador, [e.id]);
        }
        cancelar(); vuelo = null; controla(e); suelto = null; break;
      case "fuera_juego":
        acc(e.jugador).fuerasJuego.push(e.id);
        if (p && e.lado === p.lado) fallar(p, e); else cancelar();
        vuelo = null; sinControl(); suelto = null; break;
      case "reinicio":
        if (p && e.lado !== p.lado) fallar(p, e); else cancelar();
        if (e.reinicio === "esquina") porLado[e.lado].esquinas.push(e.id);
        vuelo = null; controla(e); suelto = null; break;
      case "gol":
        if (e.autogol) acc(e.jugador).autogoles.push(e.id);
        else if (ladoDe.get(e.jugador) === e.lado) acc(e.jugador).goles.push(e.id);
        cancelar(); vuelo = null; sinControl(); suelto = null; break;
      case "tiro_fuera": cancelar(); vuelo = null; sinControl(); suelto = null; break;
      case "falta": acc(e.jugador).faltasCometidas.push(e.id); if (e.receptor) acc(e.receptor).faltasRecibidas.push(e.id); break;
      case "amarilla": acc(e.jugador).amarillas.push(e.id); break;
      case "roja": acc(e.jugador).rojas.push(e.id); if (e.jugador === controlador) sinControl(); break;
      case "cambio": if (e.sale === controlador) sinControl(); break;
      default: break; // plan_equipo, final_anticipado
    }
  }
  const pendientesPase = pase ? [(pase as EventoArena).id] : [];

  // ---- Fotogramas: un recorrido con puntero sobre los eventos (en orden de tick).
  const cortes = eventos.filter(e => e.tipo === "reinicio" || e.tipo === "cambio");
  let c = 0, finalizado = false;
  fotogramas.forEach((f, k) => {
    if (f.finalizado) finalizado = true;
    for (const j of f.jugadores) {
      const vel = Math.hypot(j.velocidad.x, j.velocidad.y) * ESTADISTICAS_ARENA.kmhPorMps, a = acc(j.id);
      a.velocidadMax = a.velocidadMax === null ? vel : Math.max(a.velocidadMax, vel);
    }
    if (k === 0) return;
    const a = fotogramas[k - 1]!, dt = f.tick - a.tick;
    while (c < cortes.length && cortes[c]!.tick <= a.tick) c++;
    let reinicio = false; const entran = new Set<string>();
    for (let i = c; i < cortes.length && cortes[i]!.tick <= f.tick; i++) { if (cortes[i]!.tipo === "reinicio") reinicio = true; else entran.add(cortes[i]!.jugador); }
    if (!reinicio) {
      const previas = new Map(a.jugadores.map(j => [j.id, j.posicion]));
      for (const j of f.jugadores) { const p = previas.get(j.id); if (p && !entran.has(j.id)) acc(j.id).distanciaM += Math.hypot(j.posicion.x - p.x, j.posicion.y - p.y); }
    }
    // § 7 · Balón parado (pausa o saque pendiente): ni se atribuye ni entra en el denominador.
    if (a.pausa && a.tick < a.pausa.hastaTick || a.saque && a.tick < a.saque.hastaTick) return;
    const b = a.balon;
    if (b.poseedor) acc(b.poseedor).posesionTicks += dt;
    const lado = b.poseedor ? ladoDe.get(b.poseedor) : b.vuelo ? b.vuelo.lado : b.manos ? ladoDe.get(b.manos.portero) : undefined;
    if (lado) porLado[lado].posesionTicks += dt;
  });

  // ---- Remates: «a puerta» exactamente como el 045 (§ 5 v1.1).
  const final = esFinal(registro, tick, eventos, finalizado);
  const rp = rematesPorLado(eventos, tick), tiros = new Map(eventos.filter(e => e.tipo === "tiro").map(e => [e.id, e]));
  const indice = new Map(eventos.map((e, i) => [e.id, i]));
  const cerrado = (t: EventoArena) => {
    if (final) return true;
    for (let i = indice.get(t.id)! + 1; i < eventos.length; i++) {
      const d = eventos[i]!;
      if (d.tipo === "tiro" || d.tipo === "gol" || d.tipo === "atajada" || d.tipo === "tiro_fuera") return true;
    }
    return false;
  };
  for (const l of lados) {
    const ids = rp[l].eventos;
    ids.forEach((id, i) => {
      const t = tiros.get(id); if (!t) return;
      const siguiente = ids[i + 1], a = acc(t.jugador);
      if (siguiente !== undefined && !tiros.has(siguiente)) { a.directos++; a.directosEv.push(id, siguiente); }
      else if (cerrado(t)) { a.indirectos++; a.indirectosEv.push(id); }
      else { a.pendientes++; a.pendientesEv.push(id); }
    });
  }

  return { tick, cubiertoHastaTick: fotogramas.at(-1)?.tick ?? 0, final, capacidades: capacidades(registro), lados: ladoDe, jugadores, porLado, pendientesPase, orden: indice, tickDe: new Map(eventos.map(e => [e.id, e.tick])), eventosPrefijo: eventos.length };
}

export type MemoAgregado = (registro: RegistroArena, tick: number) => AgregadoPrefijo;
/** § 11 · Guarda la última entrada (registro por identidad, tick). */
export function crearMemoAgregado(agregar: MemoAgregado = agregarPrefijo): MemoAgregado {
  let ultimo: { registro: RegistroArena; tick: number; agregado: AgregadoPrefijo } | null = null;
  return (registro, tick) => {
    if (ultimo && ultimo.registro === registro && ultimo.tick === tick) return ultimo.agregado;
    const agregado = agregar(registro, tick);
    ultimo = { registro, tick, agregado };
    return agregado;
  };
}
export const memoAgregado: MemoAgregado = crearMemoAgregado();

/** Revisión Codex (049) · Proyecciones memoizadas por agregado: con el mismo (registro, tick) el
 * memo devuelve el mismo agregado y las proyecciones salen de esta caché sin recalcular. Débil:
 * desaparece con el agregado. */
const proyecciones = new WeakMap<AgregadoPrefijo, { equipos?: CifrasEquipo; jugadores: Map<string, Record<ClaveCifraJugador, Cifra>>; destacados?: Destacado[]; intentos?: Record<Lado, number> }>();
const cacheDe = (ag: AgregadoPrefijo) => { let c = proyecciones.get(ag); if (!c) { c = { jugadores: new Map() }; proyecciones.set(ag, c); } return c; };

const enOrden = (ag: AgregadoPrefijo, ids: readonly string[]) => [...new Set(ids)].sort((x, y) => ag.orden.get(x)! - ag.orden.get(y)!);
const deFotogramas = (ag: AgregadoPrefijo): EvidenciaMesa => ({ eventos: [], intervalo: [0, ag.cubiertoHastaTick], fuente: "fotogramas" });
const pct = (num: number, den: number) => den ? Math.round(100 * num / den) : null;
const decimal = (x: number) => Math.round(x * 10) / 10;

function proyectarJugador(ag: AgregadoPrefijo, id: string): Record<ClaveCifraJugador, Cifra> {
  const cache = cacheDe(ag).jugadores, previa = cache.get(id);
  if (previa) return previa;
  const r = proyectarJugadorSinCache(ag, id); cache.set(id, r); return r;
}
function proyectarJugadorSinCache(ag: AgregadoPrefijo, id: string): Record<ClaveCifraJugador, Cifra> {
  const a = ag.jugadores.get(id) ?? vacio();
  const cifra = (clave: ClaveCifraJugador, valor: number | null, ids: readonly string[]): Cifra => {
    const cap = CAPACIDAD[clave];
    return { clave, valor: cap && !ag.capacidades[cap] ? null : valor, clase: "registrada", evidencia: { eventos: enOrden(ag, ids) } };
  };
  const muestreo = (clave: ClaveCifraJugador, valor: number | null): Cifra => ({ clave, valor, clase: "registrada", evidencia: deFotogramas(ag) });
  const media = a.distanciasPase.length ? Math.round(a.distanciasPase.reduce((s, d) => s + d, 0) / a.distanciasPase.length) : null;
  return {
    goles: cifra("goles", a.goles.length, a.goles),
    autogoles: cifra("autogoles", a.autogoles.length, a.autogoles),
    remates: cifra("remates", a.remates.length, a.remates),
    remates_directos: cifra("remates_directos", a.directos, a.directosEv),
    remates_indirectos: cifra("remates_indirectos", a.indirectos, a.indirectosEv),
    remates_pendientes: cifra("remates_pendientes", a.pendientes, a.pendientesEv),
    pases: cifra("pases", a.pases.length, a.pases),
    pases_completados: cifra("pases_completados", a.completados, a.completadosEv),
    precision_pase: cifra("precision_pase", pct(a.completados, a.completados + a.fallidos), [...a.completadosEv, ...a.fallidosEv]),
    distancia_media_pase: cifra("distancia_media_pase", media, a.pases),
    centros: cifra("centros", a.centros.length, a.centros),
    recuperaciones: cifra("recuperaciones", a.recuperaciones, a.recuperacionesEv),
    perdidas: cifra("perdidas", a.perdidas, a.perdidasEv),
    faltas_cometidas: cifra("faltas_cometidas", a.faltasCometidas.length, a.faltasCometidas),
    faltas_recibidas: cifra("faltas_recibidas", a.faltasRecibidas.length, a.faltasRecibidas),
    amarillas: cifra("amarillas", a.amarillas.length, a.amarillas),
    rojas: cifra("rojas", a.rojas.length, a.rojas),
    fueras_juego: cifra("fueras_juego", a.fuerasJuego.length, a.fuerasJuego),
    atajadas: cifra("atajadas", a.atajadas.length, a.atajadas),
    acciones_balon: cifra("acciones_balon", a.acciones.length, a.acciones),
    distancia_m: muestreo("distancia_m", Math.round(a.distanciaM)),
    velocidad_max_kmh: muestreo("velocidad_max_kmh", a.velocidadMax === null ? null : decimal(a.velocidadMax)),
    posesion_s: muestreo("posesion_s", decimal(a.posesionTicks * ARENA.pasoS)),
    igr: { clave: "igr", valor: Math.round(a.igr * 100) / 100, clase: "estimada", evidencia: { eventos: enOrden(ag, a.remates) } },
  };
}

/** Acumulados de un jugador en el agregado (vacíos si no intervino). Para la UI y las pruebas. */
export const acumuladoDe = (ag: AgregadoPrefijo, id: string): AcumuladoJugador => ag.jugadores.get(id) ?? vacio();

/** § 2.4 · Cifras de un jugador en `tick` (titular, suplente, sustituido o expulsado). */
export function cifrasJugador(registro: RegistroArena, tick: number, jugador: string, memo: MemoAgregado = memoAgregado): CifrasJugador {
  const ag = memo(registro, tick), lado = ag.lados.get(jugador);
  if (!lado) throw new Error(`Jugador desconocido: ${jugador}`);
  return { jugador, lado, tick, cubiertoHastaTick: ag.cubiertoHastaTick, cifras: proyectarJugador(ag, jugador) };
}

/** § 2.5 · `lider` según la columna «Mejor»; null en empate o con un valor null. */
export function liderFila(clave: ClaveCifraEquipo, local: number | null, visita: number | null): Lado | null {
  if (local === null || visita === null || local === visita) return null;
  const menor = (ESTADISTICAS_ARENA.mejorMenor as readonly string[]).includes(clave);
  return (local > visita) !== menor ? "local" : "visita";
}

/** § 2.5 · Panel por equipo, en el orden de ESTADISTICAS_ARENA.filasPanel. */
export function cifrasEquipos(registro: RegistroArena, tick: number, memo: MemoAgregado = memoAgregado): CifrasEquipo {
  const ag = memo(registro, tick), cache = cacheDe(ag);
  return cache.equipos ??= proyectarEquipos(ag, tick);
}
function proyectarEquipos(ag: AgregadoPrefijo, tick: number): CifrasEquipo {
  const del = (lado: Lado) => [...ag.lados].filter(([, l]) => l === lado).map(([id]) => ag.jugadores.get(id)).filter((a): a is AcumuladoJugador => !!a);
  const total = ag.porLado.local.posesionTicks + ag.porLado.visita.posesionTicks;
  const posLocal = total ? Math.round(100 * ag.porLado.local.posesionTicks / total) : null;
  const valor = (clave: ClaveCifraEquipo, lado: Lado): Cifra => {
    const js = del(lado), cap = CAPACIDAD[clave];
    const suma = (f: (a: AcumuladoJugador) => number) => js.reduce((s, a) => s + f(a), 0);
    const c = (v: number | null, ev: readonly string[]): Cifra => ({ clave, valor: cap && !ag.capacidades[cap] ? null : v, clase: "registrada", evidencia: { eventos: enOrden(ag, ev) } });
    const lista = (f: (a: AcumuladoJugador) => readonly string[]) => { const ids = js.flatMap(f); return c(ids.length, ids); };
    switch (clave) {
      case "igr": { const ids = js.flatMap(a => a.remates); return { clave, valor: Math.round(suma(a => a.igr) * 100) / 100, clase: "estimada", evidencia: { eventos: enOrden(ag, ids) } }; }
      case "remates_cercanos": { const ids = js.flatMap(a => a.cercanos); return { clave, valor: ids.length, clase: "estimada", evidencia: { eventos: enOrden(ag, ids) } }; }
      case "posesion_pct": return { clave, valor: posLocal === null ? null : lado === "local" ? posLocal : 100 - posLocal, clase: "registrada", evidencia: deFotogramas(ag) };
      case "remates": return lista(a => a.remates);
      case "remates_directos": return c(suma(a => a.directos), js.flatMap(a => a.directosEv));
      case "remates_indirectos": return c(suma(a => a.indirectos), js.flatMap(a => a.indirectosEv));
      case "esquinas": return c(ag.porLado[lado].esquinas.length, ag.porLado[lado].esquinas);
      case "fueras_juego": return lista(a => a.fuerasJuego);
      case "pases_completados": return c(suma(a => a.completados), js.flatMap(a => a.completadosEv));
      case "precision_pase": return c(pct(suma(a => a.completados), suma(a => a.completados + a.fallidos)), js.flatMap(a => [...a.completadosEv, ...a.fallidosEv]));
      case "recuperaciones": return c(suma(a => a.recuperaciones), js.flatMap(a => a.recuperacionesEv));
      case "perdidas": return c(suma(a => a.perdidas), js.flatMap(a => a.perdidasEv));
      case "faltas": return lista(a => a.faltasCometidas);
      case "amarillas": return lista(a => a.amarillas);
      case "rojas": return lista(a => a.rojas);
      case "atajadas": return lista(a => a.atajadas);
    }
  };
  const filas = (ESTADISTICAS_ARENA.filasPanel as readonly ClaveCifraEquipo[]).map((clave): FilaPanel => {
    const local = valor(clave, "local"), visita = valor(clave, "visita");
    return { clave, clase: local.clase, local, visita, lider: liderFila(clave, local.valor, visita.valor) };
  });
  return { tick, cubiertoHastaTick: ag.cubiertoHastaTick, filas, final: ag.final };
}

/** Pases intentados por lado (el «/ 640» de «597 / 640» en el panel). */
export function pasesIntentados(registro: RegistroArena, tick: number, memo: MemoAgregado = memoAgregado): Record<Lado, number> {
  const ag = memo(registro, tick);
  return cacheDe(ag).intentos ??= Object.fromEntries(lados.map(l => [l, [...ag.lados].filter(([, x]) => x === l).reduce((s, [id]) => s + (ag.jugadores.get(id)?.pases.length ?? 0), 0)])) as Record<Lado, number>;
}

/** Brief 049 § 4.2 (nivel 3) · «Destacados» del final: más remates a puerta, más recuperaciones y
 * más distancia. Empate: el primero en orden de plantilla (titulares y banco), local antes que
 * visita. Una línea solo si el máximo es > 0. */
export interface Destacado { clave: "remates_directos" | "recuperaciones" | "distancia_m"; jugador: string; lado: "local" | "visita"; valor: number; evidencia: EvidenciaMesa }
export function destacados(registro: RegistroArena, tick: number, memo: MemoAgregado = memoAgregado): Destacado[] {
  const ag = memo(registro, tick), cache = cacheDe(ag);
  return cache.destacados ??= calcularDestacados(registro, ag);
}
function calcularDestacados(registro: RegistroArena, ag: AgregadoPrefijo): Destacado[] {
  const orden = lados.flatMap(l => [...registro.inicial.jugadores, ...registro.inicial.banco ?? []].filter(j => j.lado === l).map(j => j.id));
  const lista: Destacado[] = [];
  for (const clave of ["remates_directos", "recuperaciones", "distancia_m"] as const) {
    let mejor: Destacado | null = null;
    for (const id of orden) {
      const c = proyectarJugador(ag, id)[clave];
      if (c.valor !== null && c.valor > 0 && (!mejor || c.valor > mejor.valor)) mejor = { clave, jugador: id, lado: ag.lados.get(id)!, valor: c.valor, evidencia: c.evidencia };
    }
    if (mejor) lista.push(mejor);
  }
  return lista.slice(0, ESTADISTICAS_ARENA.destacados);
}
