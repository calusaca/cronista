// Brief 013 (rev 1.1) — la capa de micro-eventos: el partido por dentro.
//
// `micro(partido)` es una función PURA: no toca el Partido, no consume ni un sorteo del
// stream principal y no guarda nada. Corta el partido en SEGMENTOS — el tramo de juego que
// termina en cada evento macro (su «ancla») — y sortea cada segmento con
// prngDerivado(semilla, "micro:" + id del ancla). Un segmento solo depende de los eventos
// macro hasta su ancla, así que micro(prefijo(p, m)) es EXACTAMENTE el prefijo de micro(p):
// el modo en vivo y las stats «so far» no ven el futuro.
//
// Reglas de coherencia con el macro:
// - la posesión que termina en un tiro es del equipo del tirador y su último poseedor es el
//   tirador (el pase clave: el asistente); la falta corta la posesión del que la sufre; el
//   córner y el fuera de juego son del equipo atacante;
// - solo juegan los que están en cancha en ese tramo (titulares, cambios ya hechos, sin
//   expulsados);
// - continuidad causal (rev 1.1): dentro de una posesión, el receptor de un pase es el
//   actor del evento siguiente; la conducción, el regate ganado y el duelo ganado siguen con
//   el mismo actor; la pérdida cierra la posesión y el rival recupera;
// - magnitudes (rev 1.1): distancia de cada pase y metros de cada conducción, en las bandas
//   de limites.ts y coherentes con la zona (un pase largo no sale de la zona de ataque).

import { CANALES, CONDUCCION_M, PASE_M, type Canal, type TipoMicro } from "./limites";
import { castigoPase, factorRitmo } from "./condiciones";
import { MICRO } from "./parametros";
import { prngDerivado, type Rng } from "./prng";
import type { Evento, Jugador, Lado, Partido, Posicion, Zona } from "./tipos";

export interface MicroEvento {
  id: string; // "m0001", en orden de minuto
  minuto: number;
  tipo: TipoMicro;
  equipo: Lado;
  jugador: string;
  canal: Canal;
  /** Zona desde la perspectiva del equipo del evento (defensa = su tercio propio: la «salida»). */
  zona: Zona;
  /** Evento macro que cierra el segmento de este micro-evento. */
  ancla: string;
  /** Número de posesión (desde 1). */
  posesion: number;
  /** pase: a quién y si llegó; distancia en metros. conducción: metros recorridos. */
  receptor?: string;
  completado?: boolean;
  distanciaM?: number;
  /** regate / duelo: el rival enfrentado y si lo ganó `jugador`. */
  rival?: string;
  exito?: boolean;
}

export interface Posesion {
  n: number;
  equipo: Lado;
  /** Canal dominante: el más frecuente entre sus micro-eventos (a igualdad, el primero). */
  canal: Canal;
  ancla: string;
  desde: number;
  hasta: number;
  /** "ancla": termina en el evento macro; "perdida": el rival recupera. */
  termina: "ancla" | "perdida";
  /** ¿Llegó a la zona de ataque (o terminó en un ancla de ataque)? Un «avance». */
  avance: boolean;
  eventos: string[];
}

export interface MicroPartido {
  eventos: MicroEvento[];
  posesiones: Posesion[];
}

const rival = (l: Lado): Lado => (l === "local" ? "visita" : "local");
const espejoCanal = (c: Canal): Canal => (c === "banda_izquierda" ? "banda_derecha" : c === "banda_derecha" ? "banda_izquierda" : "centro");
const espejoZona = (z: Zona): Zona => (z === "defensa" ? "ataque" : z === "ataque" ? "defensa" : "medio");
const subir = (z: Zona): Zona => (z === "defensa" ? "medio" : "ataque");
/** Anclas de ataque: la posesión que termina en ellas es del equipo atacante. */
const ANCLAS_ATAQUE = new Set(["tiro", "pase_clave", "corner", "fuera_de_juego"]);

/**
 * Plantilla en cancha ANTES del evento `hasta` (titulares; los cambios ya hechos; sin los
 * expulsados). Orden: el de la plantilla original, el que entra ocupa el lugar del que sale.
 */
export function enCancha(p: Partido, hasta: number): Record<Lado, Jugador[]> {
  const out: Record<Lado, Jugador[]> = { local: p.config.local.jugadores.slice(0, 11), visita: p.config.visita.jugadores.slice(0, 11) };
  for (const e of p.eventos.slice(0, hasta)) {
    if (e.tipo === "cambio" && e.jugador && e.sale) {
      const entra = p.config[e.equipo].jugadores.find((j) => j.nombre === e.jugador);
      if (entra) out[e.equipo] = out[e.equipo].map((j) => (j.nombre === e.sale ? entra : j));
    }
    if (e.tipo === "tarjeta_roja" && e.jugador) out[e.equipo] = out[e.equipo].filter((j) => j.nombre !== e.jugador);
  }
  return out;
}

/** Canal de cada jugador en cancha: por línea, el primero a la izquierda y el último a la derecha. */
export function canalesDe(plantel: Jugador[]): Map<string, Canal> {
  const m = new Map<string, Canal>();
  for (const pos of ["POR", "DEF", "MED", "DEL"] as Posicion[]) {
    const linea = plantel.filter((j) => j.posicion === pos);
    linea.forEach((j, i) => {
      const n = linea.length;
      m.set(j.nombre, n === 1 || pos === "POR" ? "centro" : i === 0 ? "banda_izquierda" : i === n - 1 ? "banda_derecha" : "centro");
    });
  }
  return m;
}

function elegir(rng: Rng, js: Jugador[], peso: (j: Jugador) => number): Jugador {
  return rng.weighted(js, peso) ?? (js[0] as Jugador);
}

function sortearCanal(rng: Rng, pref: Canal): Canal {
  return rng.weighted([...CANALES], (c) => MICRO.canalBase[c] + (c === pref ? MICRO.canalPreferido : 0)) ?? "centro";
}

/** Canal preferido de cada equipo: un sorteo derivado por (semilla, lado), igual en cualquier prefijo. */
export function canalPreferido(semilla: number, lado: Lado): Canal {
  return prngDerivado(semilla, `micro:canal:${lado}`).pick(CANALES);
}

interface Estado {
  equipo: Lado;
  actor: string;
  zona: Zona;
  canal: Canal;
}

/** Quién tiene la pelota al empezar el tramo que sigue al evento macro `prev` (k−1). */
function inicioTras(p: Partido, k: number): { equipo: Lado; zona: Zona; actor?: string } {
  for (let i = k - 1; i >= 0; i--) {
    const e = p.eventos[i] as Evento;
    switch (e.tipo) {
      case "inicio_periodo":
        return { equipo: e.equipo, zona: "medio" };
      case "gol":
        return { equipo: rival(e.equipo), zona: "medio" }; // saca de centro el que recibió
      case "tiro":
      case "atajada":
        return { equipo: rival(e.equipo), zona: "defensa" }; // saque de arco / el portero
      case "falta":
      case "tarjeta_amarilla":
      case "tarjeta_roja":
        return { equipo: rival(e.equipo), zona: espejoZona(e.zona ?? "medio") };
      case "corner":
        return { equipo: e.equipo, zona: "ataque", ...(e.jugador ? { actor: e.jugador } : {}) };
      case "pase_clave":
        return { equipo: e.equipo, zona: "ataque" };
      case "fuera_de_juego":
        return { equipo: rival(e.equipo), zona: "defensa" };
      case "fin_periodo":
        return { equipo: e.equipo, zona: "medio" };
      default:
        continue; // cambio: no cambia quién tiene la pelota
    }
  }
  return { equipo: "local", zona: "medio" };
}

/** Un segmento vacío: el ancla es consecuencia directa del ancla anterior (gol tras tiro, tiro tras pase clave…). */
function segmentoVacio(ancla: Evento, prev: Evento | undefined): boolean {
  if (ancla.tipo === "inicio_periodo") return true;
  if (!prev) return false;
  // Brief 019: la lesión es consecuencia directa de su falta (o un instante del juego): tramo vacío.
  if (["gol", "atajada", "tarjeta_amarilla", "tarjeta_roja", "lesion"].includes(ancla.tipo)) return true;
  const directo = ancla.minuto - prev.minuto <= 1;
  if (ancla.tipo === "tiro" && directo && ["pase_clave", "corner", "falta", "tarjeta_amarilla", "tarjeta_roja"].includes(prev.tipo)) return true;
  if (ancla.tipo === "corner" && directo && ["tiro", "atajada"].includes(prev.tipo)) return true;
  if (ancla.tipo === "cambio" && ancla.minuto === prev.minuto) return true;
  return false;
}

interface Borrador extends Omit<MicroEvento, "id" | "minuto" | "posesion"> {
  /** Índice de posesión local al segmento. */
  pos: number;
}

/** Genera el tramo que termina en el evento macro k. */
function segmento(p: Partido, k: number, semilla: number): { eventos: Borrador[]; posesiones: { equipo: Lado; termina: "ancla" | "perdida" }[] } {
  const ancla = p.eventos[k] as Evento;
  const prev = k > 0 ? p.eventos[k - 1] : undefined;
  if (segmentoVacio(ancla, prev)) return { eventos: [], posesiones: [] };
  const rng = prngDerivado(semilla, `micro:${ancla.id}`);
  const cancha = enCancha(p, k);
  const canales: Record<Lado, Map<string, Canal>> = { local: canalesDe(cancha.local), visita: canalesDe(cancha.visita) };
  const pref: Record<Lado, Canal> = { local: canalPreferido(semilla, "local"), visita: canalPreferido(semilla, "visita") };
  const cfg = p.config;
  const fuerza = (l: Lado) => (cfg[l].ataque - cfg[rival(l)].defensa) / 100;
  // Brief 018: el periodo del tramo (el de su ancla) para el cansancio del calor.
  const periodo: 1 | 2 = p.eventos.slice(0, k + 1).filter((x) => x.tipo === "inicio_periodo").length >= 2 ? 2 : 1;

  const eventos: Borrador[] = [];
  const posesiones: { equipo: Lado; termina: "ancla" | "perdida" }[] = [];
  const ini = inicioTras(p, k);
  const actorInicial = (l: Lado, zona: Zona): string => {
    const js = cancha[l];
    const peso = (j: Jugador) => (zona === "defensa" && j.posicion === "POR" ? 3 : MICRO.actor[j.posicion]);
    return elegir(rng, js, peso).nombre;
  };
  const enJuego = (l: Lado, nombre: string) => cancha[l].some((j) => j.nombre === nombre);
  let e: Estado = {
    equipo: ini.equipo,
    zona: ini.zona,
    canal: sortearCanal(rng, pref[ini.equipo]),
    actor: ini.actor && enJuego(ini.equipo, ini.actor) ? ini.actor : "",
  };
  if (!e.actor) e.actor = actorInicial(e.equipo, e.zona);
  posesiones.push({ equipo: e.equipo, termina: "perdida" });

  const emitir = (b: Omit<Borrador, "pos" | "equipo" | "canal" | "zona" | "ancla"> & Partial<Pick<Borrador, "equipo" | "canal" | "zona">>) => {
    eventos.push({ equipo: e.equipo, canal: e.canal, zona: e.zona, ancla: ancla.id, pos: posesiones.length - 1, ...b });
  };
  /** Defensor que enfrenta al actor: el rival en cancha del canal espejo (defensas y medios primero). */
  const defensor = (): string => {
    const r = rival(e.equipo);
    const espejo = espejoCanal(e.canal);
    return elegir(rng, cancha[r].filter((j) => j.posicion !== "POR"), (j) => (canales[r].get(j.nombre) === espejo ? 6 : 1) * (j.posicion === "DEF" ? 3 : j.posicion === "MED" ? 2 : 0.5)).nombre;
  };
  /** Pérdida del actor y recuperación del rival `quien`: abre otra posesión. */
  const perder = (quien?: string) => {
    emitir({ tipo: "perdida", jugador: e.actor });
    const r = rival(e.equipo);
    posesiones[posesiones.length - 1]!.termina = "perdida";
    const zonaR = espejoZona(e.zona);
    const canalR = espejoCanal(e.canal);
    const recupera = quien && enJuego(r, quien) ? quien : actorInicial(r, zonaR);
    posesiones.push({ equipo: r, termina: "perdida" });
    e = { equipo: r, actor: recupera, zona: zonaR, canal: canalR };
    emitir({ tipo: "recuperacion", jugador: recupera });
  };
  const pase = (receptor: string, forzarCompletado = false) => {
    const mezcla = MICRO.paseMezcla[e.zona];
    const r = rng.next();
    const clase = r < mezcla.corto ? "corto" : r < mezcla.corto + mezcla.medio ? "medio" : "largo"; // en ataque la mezcla no tiene largos (parametros)
    const banda = PASE_M[clase];
    const distanciaM = clase === "largo" ? rng.int(banda.min, banda.max) : rng.int(banda.min, banda.max - 1);
    const ajuste = clase === "corto" ? 0.06 : clase === "largo" ? -0.2 : -0.03;
    // Brief 018 · efectos 3, 5 y 6: lluvia, césped alto (visitante, cortos) y presión alta en la
    // salida temprana restan completación; sin condiciones el castigo es 0 exacto.
    const pc = MICRO.paseBase + MICRO.paseKFuerza * fuerza(e.equipo) + MICRO.paseEstilo[cfg[e.equipo].estilo] + MICRO.paseZona[e.zona] + ajuste - castigoPase(cfg.condiciones, e.equipo, e.zona, clase, ancla.minuto);
    const completado = forzarCompletado || rng.chance(pc);
    emitir({ tipo: "pase", jugador: e.actor, receptor, completado, distanciaM });
    if (!completado) return perder();
    e.actor = receptor;
    if (clase === "largo" && rng.chance(0.4)) e.canal = rng.pick(CANALES.filter((c) => c !== e.canal));
    if (e.zona !== "ataque" && rng.chance(MICRO.avance[e.zona][clase])) e.zona = subir(e.zona);
  };
  const companero = (): string => {
    const js = cancha[e.equipo].filter((j) => j.nombre !== e.actor);
    return elegir(rng, js, (j) => MICRO.actor[j.posicion] * (canales[e.equipo].get(j.nombre) === e.canal ? 2 : 1)).nombre;
  };

  // El juego del tramo: acciones ∝ minutos de reloj, más la elaboración si el ancla es de ataque.
  const delta = prev ? Math.max(0, ancla.minuto - prev.minuto) : 0;
  const deAtaque = ANCLAS_ATAQUE.has(ancla.tipo) || ancla.tipo === "falta";
  // Brief 018 · efecto 1: con calor, el 2.º tiempo tiene menos acciones (factor 1 exacto sin calor).
  const n = Math.max(0, Math.round((MICRO.accionesPorMinuto * delta + (deAtaque ? MICRO.accionesAncla : 0)) * factorRitmo(cfg.condiciones, periodo) + rng.int(-2, 2)));
  let recienRegateo = false; // nadie regatea dos veces seguidas al mismo rival en la misma jugada
  for (let i = 0; i < n; i++) {
    const pos = cancha[e.equipo].find((j) => j.nombre === e.actor)?.posicion ?? "MED";
    const r = rng.next();
    const riesgo = MICRO.riesgoZona[e.zona];
    const pReg = recienRegateo ? 0 : (MICRO.pRegate * MICRO.regateador[pos] * riesgo) / 2;
    recienRegateo = false;
    if (r < pReg) {
      recienRegateo = true;
      const d = defensor();
      const exito = rng.chance(MICRO.regateBase + MICRO.regateKFuerza * fuerza(e.equipo));
      emitir({ tipo: "regate", jugador: e.actor, rival: d, exito });
      if (!exito) perder(d);
      else if (e.zona !== "ataque" && rng.chance(0.4)) e.zona = subir(e.zona);
    } else if (r < pReg + MICRO.pDuelo * riesgo) {
      const d = defensor();
      const exito = rng.chance(MICRO.dueloBase);
      emitir({ tipo: "duelo", jugador: e.actor, rival: d, exito });
      if (!exito) perder(d);
    } else if (r < pReg + MICRO.pDuelo * riesgo + MICRO.pConduccion) {
      emitir({ tipo: "conduccion", jugador: e.actor, distanciaM: Math.min(CONDUCCION_M.max, CONDUCCION_M.min + Math.floor(rng.next() * rng.next() * (CONDUCCION_M.max - CONDUCCION_M.min + 1))) });
      if (e.zona !== "ataque" && rng.chance(MICRO.avance[e.zona].conduccion)) e.zona = subir(e.zona);
    } else {
      pase(companero());
    }
  }

  // El cierre del tramo: el equipo (y el actor) que exige el ancla.
  const equipoFinal: Lado | undefined = ANCLAS_ATAQUE.has(ancla.tipo) ? ancla.equipo : ancla.tipo === "falta" ? rival(ancla.equipo) : undefined;
  // Si el ancla exige al otro equipo, el que tiene la pelota la pierde: un pase que no llega.
  if (equipoFinal !== undefined && equipoFinal !== e.equipo) {
    const mezcla = MICRO.paseMezcla[e.zona];
    emitir({ tipo: "pase", jugador: e.actor, receptor: companero(), completado: false, distanciaM: rng.int(PASE_M.corto.min, (e.zona === "ataque" || rng.chance(mezcla.corto + mezcla.medio) ? PASE_M.medio.max : PASE_M.largo.max) - 1) });
    perder();
  }
  const actorFinal = ancla.tipo === "tiro" || ancla.tipo === "pase_clave" ? ancla.jugador : undefined;
  if (actorFinal && actorFinal !== e.actor && enJuego(e.equipo, actorFinal)) {
    e.zona = ancla.tipo === "tiro" ? "ataque" : e.zona;
    pase(actorFinal, true);
  }
  if (equipoFinal !== undefined && posesiones.length > 0) posesiones[posesiones.length - 1]!.termina = "ancla";
  return { eventos, posesiones };
}

/** La capa micro del partido (o de su prefijo). Pura y determinista. */
export function micro(p: Partido): MicroPartido {
  const semilla = p.config.seed;
  const eventos: MicroEvento[] = [];
  const posesiones: Posesion[] = [];
  let nPos = 0;
  p.eventos.forEach((ancla, k) => {
    const prev = k > 0 ? (p.eventos[k - 1] as Evento) : undefined;
    const seg = segmento(p, k, semilla);
    if (seg.eventos.length === 0) return;
    const desde = prev ? prev.minuto : ancla.minuto;
    const delta = Math.max(0, ancla.minuto - desde);
    const base = nPos;
    const usadas = new Set<number>();
    seg.eventos.forEach((b, j) => {
      const minuto = Math.min(ancla.minuto, desde + Math.floor((delta * (j + 1)) / (seg.eventos.length + 1)));
      const { pos, ...resto } = b;
      usadas.add(pos);
      eventos.push({ id: `m${String(eventos.length + 1).padStart(4, "0")}`, minuto, posesion: base + pos + 1, ...resto });
    });
    seg.posesiones.forEach((ps, i) => {
      if (!usadas.has(i)) return;
      const evs = eventos.filter((m) => m.posesion === base + i + 1);
      const cuenta = new Map<Canal, number>();
      for (const m of evs) cuenta.set(m.canal, (cuenta.get(m.canal) ?? 0) + 1);
      const canal = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "centro";
      posesiones.push({
        n: base + i + 1,
        equipo: ps.equipo,
        canal,
        ancla: ancla.id,
        desde: evs[0]?.minuto ?? ancla.minuto,
        hasta: evs[evs.length - 1]?.minuto ?? ancla.minuto,
        termina: ps.termina,
        avance: evs.some((m) => m.zona === "ataque" && m.equipo === ps.equipo) || (ps.termina === "ancla" && ANCLAS_ATAQUE.has(ancla.tipo)),
        eventos: evs.map((m) => m.id),
      });
    });
    nPos = base + seg.posesiones.length;
  });
  // Renumerar posesiones de forma compacta (sin huecos de posesiones vacías).
  const mapa = new Map(posesiones.map((ps, i) => [ps.n, i + 1]));
  for (const ps of posesiones) ps.n = mapa.get(ps.n) as number;
  for (const m of eventos) m.posesion = mapa.get(m.posesion) as number;
  return { eventos, posesiones };
}
