// Brief 016 §2 — la temporada: cada partido de liga ES un partido normal. Su semilla sale de
// `semillaDePartido` (hash determinista) y su config es la estándar { seed, local, visita }
// con los equipos del mundo; se simula con el `simular` de siempre.
//
// Brief 019 — la temporada es VIVA: se juega jornada a jornada y lleva un registro. Una roja
// (directa o por doble amarilla) suspende; una lesión deja fuera N jornadas. La alineación de la
// jornada siguiente se arma sin las bajas (entra el suplente de su posición, o una reserva del
// plantel extendido) y el partido lleva sus bajas en la config (dato del registro, citable).

import { CAUSAS_POR_TIPO, DEDUCCION_PUNTOS, LIMITE_BANCO_JORNADAS, PRESION_LOCAL_POR_LIGA, PROB_CLIMA, PROB_CLUBES_SANCIONADOS, PUERTA_CERRADA_PARTIDOS, SANCION_JORNADAS } from "../analista/umbrales";
import { nivelSiguiente } from "../sim/condiciones";
import { TEMPERATURA_C, TIPOS_SANCION_CLUB, type ClimaPartido } from "../sim/limites";
import { simular } from "../sim/motor";
import { conNiveles, nivelesDe } from "../sim/niveles";
import { prngDerivado } from "../sim/prng";
import { SUPLENTES, TITULARES, type Baja, type Condiciones, type Equipo, type Jugador, type Partido, type SancionClubPartido, type SimConfig } from "../sim/tipos";
import { calendarioCirculo } from "./calendario";
import { goleadores, tablaDePosiciones } from "./tabla";
import type { Calendario, Cruce, EquipoMundo, LesionLiga, Liga, PartidoLiga, Sancion, SancionClub, Temporada } from "./tipos";

/**
 * Semilla de un partido de liga: FNV-1a de 32 bits sobre la clave, con un mezclado final
 * (avalancha) para que jornadas o índices vecinos no den semillas vecinas. Jornada e índice
 * son 1-based, como en la UI.
 */
export function semillaDePartido(liga: string, temporada: number, jornada: number, indice: number): number {
  const clave = `liga:${liga}|temporada:${temporada}|jornada:${jornada}|partido:${indice}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < clave.length; i++) {
    h ^= clave.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

const calendarios = new Map<number, Calendario>();
export function calendarioDeLiga(liga: Liga): Calendario {
  const n = liga.equipos.length;
  let c = calendarios.get(n);
  if (!c) {
    c = calendarioCirculo(n);
    calendarios.set(n, c);
  }
  return c;
}

export const jornadasDe = (liga: Liga) => calendarioDeLiga(liga).length;
export const partidosPorJornada = (liga: Liga) => liga.equipos.length / 2;

/** El cruce (jornada e índice 1-based) o undefined si no existe. */
export function cruceDe(liga: Liga, jornada: number, indice: number): Cruce | undefined {
  return calendarioDeLiga(liga)[jornada - 1]?.[indice - 1];
}

/**
 * Brief 018 §1 — las condiciones de un partido de liga: clima sorteado del perfil del país
 * (flujo derivado por la semilla del partido: reproducible y sin tocar el stream del motor),
 * la cancha del local y la presión de la liga (visitante un nivel arriba).
 */
export function condicionesDePartido(liga: Liga, cruce: Cruce, seed: number): Condiciones {
  const rng = prngDerivado(seed, "condiciones:clima");
  const p = PROB_CLIMA[liga.clima];
  const u = rng.next();
  const clima: ClimaPartido =
    u < p.calor ? "calor" : u < p.calor + p.lluvia ? "lluvia" : u < p.calor + p.lluvia + p.frio ? "frio" : u < p.calor + p.lluvia + p.frio + p.niebla ? "niebla" : "despejado";
  const cancha = (liga.equipos[cruce.local] as Liga["equipos"][number]).cancha;
  const local = PRESION_LOCAL_POR_LIGA[liga.id];
  if (!local) throw new Error(`liga sin presión definida: ${liga.id} (PRESION_LOCAL_POR_LIGA)`);
  return {
    clima,
    ...(clima === "calor" || clima === "frio" ? { temperaturaC: rng.int(TEMPERATURA_C[clima].min, TEMPERATURA_C[clima].max) } : {}),
    superficie: cancha.superficie,
    ...(cancha.superficie === "natural" ? { cesped: cancha.cesped } : {}),
    presion: { local, visita: nivelSiguiente(local) },
  };
}

/**
 * Brief 019 — la alineación de un partido sin las bajas `fuera`: cada titular de baja lo
 * reemplaza el primer disponible de SU posición del banco (suplentes, luego reservas); si no
 * hay, el primer disponible de campo (o cualquiera, para el arco). El banco son los 5 primeros
 * disponibles que quedan. Sin bajas: exactamente los 16 de siempre, en su orden.
 */
export function alineacion(eq: EquipoMundo, fuera: ReadonlySet<string>): Equipo {
  const base = eq.equipo.jugadores;
  let banco: Jugador[] = [...base.slice(TITULARES), ...eq.reservas].filter((j) => !fuera.has(j.nombre));
  const titulares = base.slice(0, TITULARES).map((t) => {
    if (!fuera.has(t.nombre)) return t;
    const r = banco.find((j) => j.posicion === t.posicion) ?? (t.posicion === "POR" ? banco[0] : banco.find((j) => j.posicion !== "POR"));
    if (!r) throw new Error(`${eq.equipo.nombre}: no hay quién reemplace a ${t.nombre}`);
    banco = banco.filter((j) => j.nombre !== r.nombre);
    return r;
  });
  if (banco.length < SUPLENTES) throw new Error(`${eq.equipo.nombre}: banco incompleto (${banco.length})`);
  return { ...eq.equipo, jugadores: [...titulares, ...banco.slice(0, SUPLENTES)] };
}

/** Una baja activa del registro: fuera hasta la jornada `hasta` (inclusive). */
interface Activa {
  motivo: Baja["motivo"];
  hasta: number;
}

/** Bajas de un equipo en la jornada j (la de fecha más lejana manda; a igualdad, la suspensión). */
function bajasEn(registro: Map<string, Activa[]>, equipo: string, j: number): Baja[] {
  const out: Baja[] = [];
  for (const [clave, xs] of registro) {
    const [eq, jugador] = clave.split("|") as [string, string];
    if (eq !== equipo) continue;
    const vivas = xs.filter((x) => x.hasta >= j);
    if (vivas.length === 0) continue;
    const manda = [...vivas].sort((a, b) => b.hasta - a.hasta || (a.motivo === "suspension" ? -1 : 1))[0] as Activa;
    out.push({ jugador, motivo: manda.motivo, jornadas: manda.hasta - j + 1 });
  }
  return out.sort((a, b) => a.jugador.localeCompare(b.jugador));
}

/**
 * Brief 027 — el sorteo de las sanciones de club de una temporada (antes de jugarla): 0–2 clubes,
 * a lo sumo una sanción por club, tipo y causa de listas cerradas. Flujo derivado propio por liga
 * y temporada: no toca ningún otro sorteo.
 */
export function sorteoSancionesClub(liga: Liga, temporada: number): SancionClub[] {
  const rng = prngDerivado(temporada, `sanciones-club:${liga.id}`);
  const cal = calendarioDeLiga(liga);
  const total = cal.length;
  const u = rng.next();
  let n = 0;
  let acum = 0;
  for (let k = 0; k < PROB_CLUBES_SANCIONADOS.length; k++) {
    acum += PROB_CLUBES_SANCIONADOS[k] as number;
    if (u < acum) {
      n = k;
      break;
    }
  }
  const libres = liga.equipos.map((_, i) => i);
  const out: SancionClub[] = [];
  for (let s = 0; s < n; s++) {
    const idx = libres.splice(rng.int(0, libres.length - 1), 1)[0] as number;
    const equipo = (liga.equipos[idx] as EquipoMundo).equipo.nombre;
    const tipo = rng.pick(TIPOS_SANCION_CLUB);
    const causa = rng.pick(CAUSAS_POR_TIPO[tipo]);
    if (tipo === "deduccion") {
      out.push({ equipo, tipo, causa, jornadas: [rng.int(1, total)], puntos: rng.int(DEDUCCION_PUNTOS.min, DEDUCCION_PUNTOS.max) });
    } else if (tipo === "puerta_cerrada") {
      const deLocal = cal.flatMap((jj, k) => (jj.some((c) => c.local === idx) ? [k + 1] : []));
      const k = rng.int(PUERTA_CERRADA_PARTIDOS.min, PUERTA_CERRADA_PARTIDOS.max);
      const desde = rng.int(0, deLocal.length - k);
      out.push({ equipo, tipo, causa, jornadas: deLocal.slice(desde, desde + k) });
    } else {
      const k = rng.int(LIMITE_BANCO_JORNADAS.min, LIMITE_BANCO_JORNADAS.max);
      const desde = rng.int(1, total - k + 1);
      out.push({ equipo, tipo, causa, jornadas: Array.from({ length: k }, (_, x) => desde + x) });
    }
  }
  return out;
}

/** Brief 027: a puerta cerrada no hay público ⇒ la presión del 018 pasa a baja para AMBOS. */
export function sinPublico(c: Condiciones): Condiciones {
  return { ...c, presion: { local: "baja", visita: "baja" } };
}

/** Las sanciones de club de un partido (el lado sancionado y su dato citable). */
function sancionesDelPartido(registro: readonly SancionClub[], nombres: Record<"local" | "visita", string>, j: number): SancionClubPartido[] {
  const out: SancionClubPartido[] = [];
  for (const s of registro) {
    const k = s.jornadas.indexOf(j);
    if (k < 0) continue;
    const lado = s.equipo === nombres.local ? "local" : s.equipo === nombres.visita ? "visita" : undefined;
    if (!lado) continue;
    // (la puerta cerrada solo trae jornadas de LOCAL del club: el sorteo lo garantiza y el invariante lo exige)
    out.push({ lado, tipo: s.tipo, causa: s.causa, ...(s.tipo === "deduccion" ? { puntos: s.puntos as number } : { partido: k + 1, de: s.jornadas.length }) });
  }
  return out;
}

/** Opciones de la temporada (brief 027): las sanciones de club, encendidas por defecto en la liga. */
export interface OpcionesTemporada {
  sanciones?: boolean;
}

/**
 * La temporada completa, jornada a jornada, con su registro (brief 019). Pura y determinista:
 * dos veces ⇒ idéntica, sanciones y lesiones incluidas. Brief 027: con `sanciones: false`, la
 * temporada es byte a byte la de antes de las sanciones de club (fixture reina temporada-026).
 */
export function simularTemporada(liga: Liga, temporada: number, opciones: OpcionesTemporada = {}): Temporada {
  const conSanciones = opciones.sanciones !== false;
  const sancionesClub = conSanciones ? sorteoSancionesClub(liga, temporada) : [];
  const partidos: PartidoLiga[] = [];
  const configs: SimConfig[] = [];
  const sanciones: Sancion[] = [];
  const lesiones: LesionLiga[] = [];
  const registro = new Map<string, Activa[]>(); // equipo|jugador → bajas
  // Brief 024: los niveles de cada equipo del mundo (plantel de 16 con tope + reservas), una vez.
  const niveles = new Map(liga.equipos.map((e) => [e.equipo.nombre, nivelesDe(e.equipo, e.reservas)] as const));
  const conSusNiveles = (eq: EquipoMundo, fuera: Set<string>) => conNiveles(alineacion(eq, fuera), niveles.get(eq.equipo.nombre) as Map<string, number>);
  const anotar = (equipo: string, jugador: string, a: Activa) => registro.set(`${equipo}|${jugador}`, [...(registro.get(`${equipo}|${jugador}`) ?? []), a]);
  calendarioDeLiga(liga).forEach((jornada, jIdx) => {
    const j = jIdx + 1;
    jornada.forEach((cruce, iIdx) => {
      const i = iIdx + 1;
      const seed = semillaDePartido(liga.id, temporada, j, i);
      const eqL = liga.equipos[cruce.local] as EquipoMundo;
      const eqV = liga.equipos[cruce.visita] as EquipoMundo;
      const bl = bajasEn(registro, eqL.equipo.nombre, j);
      const bv = bajasEn(registro, eqV.equipo.nombre, j);
      const bajas = { ...(bl.length > 0 ? { local: bl } : {}), ...(bv.length > 0 ? { visita: bv } : {}) };
      // Brief 027: las sanciones de club de este partido; a puerta cerrada, presión baja para AMBOS.
      const sc = conSanciones ? sancionesDelPartido(sancionesClub, { local: eqL.equipo.nombre, visita: eqV.equipo.nombre }, j) : [];
      const cond = condicionesDePartido(liga, cruce, seed);
      const config: SimConfig = {
        seed,
        local: conSusNiveles(eqL, new Set(bl.map((b) => b.jugador))),
        visita: conSusNiveles(eqV, new Set(bv.map((b) => b.jugador))),
        condiciones: sc.some((x) => x.tipo === "puerta_cerrada") ? sinPublico(cond) : cond,
        variantes: { lesiones: true, autogoles: true, niveles: true, insolitos: true, ...(conSanciones ? { sanciones: true } : {}) },
        ...(bl.length > 0 || bv.length > 0 ? { bajas } : {}),
        ...(sc.length > 0 ? { sancionesClub: sc } : {}),
      };
      const p = simular(config);
      configs.push(p.config);
      partidos.push(resultadoDe(p, j, i));
      // El registro: rojas y lesiones de este partido pesan desde la jornada siguiente.
      p.eventos.forEach((e, k) => {
        if (!e.jugador) return;
        const equipo = p.config[e.equipo].nombre;
        if (e.tipo === "tarjeta_roja") {
          const doble = p.eventos.slice(0, k).some((a) => a.tipo === "tarjeta_amarilla" && a.equipo === e.equipo && a.jugador === e.jugador);
          const motivo = doble ? "doble_amarilla" : "roja_directa";
          const n = SANCION_JORNADAS[motivo];
          sanciones.push({ jugador: e.jugador, equipo, motivo, jornada: j, jornadas: n, evento: e.id });
          anotar(equipo, e.jugador, { motivo: "suspension", hasta: j + n });
        }
        if (e.tipo === "lesion" && e.baja !== undefined) {
          lesiones.push({ jugador: e.jugador, equipo, jornada: j, minuto: e.minuto, jornadas: e.baja, evento: e.id });
          anotar(equipo, e.jugador, { motivo: "lesion", hasta: j + e.baja });
        }
      });
    });
  });
  return {
    liga: liga.id,
    temporada,
    partidos,
    tabla: tablaDePosiciones(
      liga.equipos.map((e) => e.equipo.nombre),
      partidos,
      sancionesClub.filter((s) => s.tipo === "deduccion").map((s) => ({ equipo: s.equipo, puntos: s.puntos as number, causa: s.causa })),
    ),
    goleadores: goleadores(partidos),
    configs,
    sanciones,
    lesiones,
    ...(conSanciones ? { sancionesClub } : {}),
  };
}

const temporadas = new WeakMap<Liga, Map<number, Temporada>>();
/** La temporada memorizada (es inmutable): la usan las configs de cada partido y la UI. */
export function temporadaDe(liga: Liga, temporada: number): Temporada {
  let m = temporadas.get(liga);
  if (!m) {
    m = new Map();
    temporadas.set(liga, m);
  }
  let t = m.get(temporada);
  if (!t) {
    t = simularTemporada(liga, temporada);
    m.set(temporada, t);
  }
  return t;
}

/**
 * La config de un partido de liga: la de la temporada jugada hasta ahí (brief 019: alineaciones
 * sin las bajas, condiciones del 018, lesiones encendidas, bajas del registro).
 */
export function configDePartidoLiga(liga: Liga, temporada: number, jornada: number, indice: number): SimConfig {
  const c = cruceDe(liga, jornada, indice);
  if (!c) throw new Error(`partido inexistente: ${liga.id} jornada ${jornada} partido ${indice}`);
  const t = temporadaDe(liga, temporada);
  const k = t.partidos.findIndex((p) => p.jornada === jornada && p.indice === indice);
  return JSON.parse(JSON.stringify(t.configs[k])) as SimConfig;
}

/** Resultado de liga de un partido simulado. */
export function resultadoDe(partido: Partido, jornada: number, indice: number): PartidoLiga {
  const { local, visita } = partido.config;
  const nombre = { local: local.nombre, visita: visita.nombre };
  const goles = partido.eventos
    .filter((e) => e.tipo === "gol")
    .map((e) => ({ jugador: e.jugador ?? "", equipo: nombre[e.equipo], minuto: e.minuto, ...(e.autogol ? { autogol: true as const } : {}) }));
  return {
    jornada,
    indice,
    seed: partido.config.seed,
    local: local.nombre,
    visita: visita.nombre,
    golesLocal: goles.filter((g) => g.equipo === local.nombre).length,
    golesVisita: goles.filter((g) => g.equipo === visita.nombre).length,
    goles,
  };
}

