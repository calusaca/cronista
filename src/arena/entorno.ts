import { ARENA, ENTORNO_ARENA as E, TECNICA_ARENA, TEMPERATURA_C } from "../sim/limites";
import { intensidadCalor, nivelSiguiente } from "../sim/condiciones";
import { conNiveles, nivelesDe } from "../sim/niveles";
import { prngDerivado } from "../sim/prng";
import type { Condiciones, Lado, SimConfig } from "../sim/tipos";
import type { ConfigArena, EstadoArena, EventoArena, JugadorArena, ResumenEquipo } from "./tipos";

export function prepararPartido(partido: SimConfig): SimConfig {
  const rng = prngDerivado(partido.seed, "condiciones:arena-v3");
  const cancha = prngDerivado(0, `cancha:arena-v3:${partido.local.nombre}`);
  const clima = rng.pick(["despejado", "calor", "lluvia", "frio", "niebla"] as const);
  const superficie = cancha.pick(["natural", "sintetica"] as const), presionLocal = cancha.pick(["baja", "media"] as const);
  const condiciones: Condiciones = partido.condiciones ?? {
    clima, ...(clima === "calor" || clima === "frio" ? { temperaturaC: rng.int(TEMPERATURA_C[clima].min, TEMPERATURA_C[clima].max) } : {}),
    superficie, ...(superficie === "natural" ? { cesped: cancha.pick(["corto", "alto"] as const) } : {}),
    presion: { local: presionLocal, visita: nivelSiguiente(presionLocal) },
  };
  const niveles = partido.variantes?.niveles ?? true;
  const asignar = niveles && partido.variantes?.niveles !== true;
  return { ...structuredClone(partido), condiciones, variantes: { ...partido.variantes, niveles },
    local: asignar ? conNiveles(partido.local, nivelesDe(partido.local)) : structuredClone(partido.local),
    visita: asignar ? conNiveles(partido.visita, nivelesDe(partido.visita)) : structuredClone(partido.visita),
  };
}

export function presionAficion(c: Condiciones | undefined, estado: EstadoArena, lado: Lado): number {
  if (!c) return 0;
  const inicial = Math.max(0, 1 - estado.tick * ARENA.pasoS / E.presionInicialS);
  const animo = estado.aficion?.[lado].animo ?? E.animoInicial;
  return Math.min(1, E.presion[c.presion[lado]] * inicial + Math.max(0, E.animoInicial - animo) / 100);
}

export function efectosEntorno(config: { partido: Pick<SimConfig, "condiciones"> }, estado: EstadoArena, lado: Lado, distanciaM = 0) {
  const c = config.partido.condiciones;
  const calor = intensidadCalor(c);
  const frio = c?.clima === "frio" ? (TEMPERATURA_C.frio.max - c.temperaturaC!) / (TEMPERATURA_C.frio.max - TEMPERATURA_C.frio.min) : 0;
  return {
    desgaste: 1 + E.calorFactor * calor,
    velocidadJugador: 1 - E.frioVelocidad * frio * Math.max(0, 1 - estado.tick * ARENA.pasoS / E.frioHastaS),
    velocidadBalon: c?.superficie === "sintetica" ? E.sinteticaBalon : c?.cesped === "alto" ? E.cespedAltoBalon : 1,
    errorLluviaM: c?.clima === "lluvia" ? ARENA.errorLluviaM : 0,
    errorNieblaM: c?.clima === "niebla" && distanciaM >= E.nieblaDesdeM ? E.nieblaErrorM : 0,
    errorCespedM: c?.superficie === "natural" && c.cesped === "alto" && lado === "visita" && distanciaM <= E.paseCortoM ? E.cespedAltoErrorM : 0,
    errorPresionM: presionAficion(c, estado, lado) * E.presionErrorM,
  };
}

/** Una reacción solo puede influir en pasos posteriores al evento que la causa. */
export function reaccionarAficion(estado: EstadoArena, evento: EventoArena): void {
  if (!estado.aficion) return;
  const propia = estado.aficion[evento.lado], otra = estado.aficion[evento.lado === "local" ? "visita" : "local"];
  const variar = (n: number, delta: number) => Math.max(0, Math.min(100, n + delta));
  if (evento.tipo === "gol") {
    propia.animo = variar(propia.animo, E.animoGol); propia.reaccion = "rugido"; propia.evento = evento.id;
    otra.animo = variar(otra.animo, -E.animoGol); otra.reaccion = "silencio"; otra.evento = evento.id;
  } else if (evento.tipo === "tiro") {
    propia.animo = variar(propia.animo, E.animoTiro); propia.reaccion = "aliento"; propia.evento = evento.id;
  } else if (evento.tipo === "intercepcion") {
    otra.animo = variar(otra.animo, -E.animoPerdida); otra.reaccion = otra.animo < 40 ? "silbidos" : "atencion"; otra.evento = evento.id;
  }
}

export function resumir(estado: EstadoArena, eventos: readonly EventoArena[], ventanaS: number): Record<Lado, ResumenEquipo> {
  const recientes = eventos.filter(e => e.tick > estado.tick - ventanaS / ARENA.pasoS && e.tick <= estado.tick);
  const completados = { local: 0, visita: 0 }, perdidas = { local: 0, visita: 0 };
  let pase: EventoArena | null = null, ultimoLado: Lado = "local";
  for (const e of eventos) {
    if (e.tick > estado.tick) break;
    if (e.tipo === "pase") { pase = e; ultimoLado = e.lado; }
    else if (e.tipo === "recepcion") {
      if (pase && pase.lado === e.lado && pase.jugador === e.receptor && pase.tick > estado.tick - ventanaS / ARENA.pasoS) completados[e.lado]++;
      pase = null; ultimoLado = e.lado;
    } else if (e.tipo === "intercepcion" || e.tipo === "recuperacion") {
      if (e.tick > estado.tick - ventanaS / ARENA.pasoS && ultimoLado !== e.lado) perdidas[ultimoLado]++;
      pase = null; ultimoLado = e.lado;
    } else if (e.tipo === "tiro" || e.tipo === "reinicio") { pase = null; ultimoLado = e.lado; }
  }
  return Object.fromEntries((["local", "visita"] as const).map(lado => {
    const propios = recientes.filter(e => e.lado === lado), jugadores = estado.jugadores.filter(j => j.lado === lado);
    return [lado, { pases: propios.filter(e => e.tipo === "pase").length, recepciones: completados[lado],
      perdidas: perdidas[lado],
      tiros: propios.filter(e => e.tipo === "tiro").length, goles: propios.filter(e => e.tipo === "gol").length,
      energiaMedia: jugadores.reduce((s, j) => s + j.energia, 0) / Math.max(1, jugadores.length),
      fuentes: recientes.filter(e => ["pase", "recepcion", "intercepcion", "recuperacion", "tiro", "gol"].includes(e.tipo)).slice(-8).map(e => e.id),
    }];
  })) as Record<Lado, ResumenEquipo>;
}

export function capacidadEfectiva(j: JugadorArena, compatibilidad: number): number {
  return j.nivel * (TECNICA_ARENA.compatibilidadMinFactor + (1 - TECNICA_ARENA.compatibilidadMinFactor) * compatibilidad / 100);
}
