// Brief 049 (v1.1) · Cifras del partido y por jugador. Cada cifra contra un recuento escrito
// aparte (sin llamar a estadisticas.ts), invarianza de prefijo, cada fila de la máquina de § 3
// en secuencias sintéticas razonadas a mano, fotogramas construidos a mano y memo de la
// agregación. Ninguna cifra de ESTADISTICAS_ARENA, ARENA ni TECNICA_ARENA se repite a mano;
// los desplazamientos 3–4–5 y las secuencias son datos de prueba, no normativos.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ARENA, ESTADISTICAS_ARENA, IGR_ARENA, TECNICA_ARENA } from "../../sim/limites";
import type { Lado } from "../../sim/tipos";
import { crearControladorProgramado } from "../controladores";
import { ejecutarArena } from "../coordinador";
import { rematesPorLado } from "../estadista";
import { acumuladoDe, agregarPrefijo, capacidades, destacados, igrRemate, reglasDesdeCliente, CLAVES_JUGADOR, cifrasEquipos, cifrasJugador, crearMemoAgregado, ETIQUETAS_CIFRAS, liderFila, type ClaveCifraEquipo, type MemoAgregado } from "../estadisticas";
import { crearConfigArena, reglasDesde } from "../motor";
import { lados, reglasArena, type EstadoArena, type EventoArena, type JugadorArena, type RegistroArena } from "../tipos";

type NombreFixture = "v1" | "v2" | "v3" | "v4" | "legado";
const archivo: Record<NombreFixture, string> = { v1: "arena-reinicios-v1", v2: "arena-reinicios-v2", v3: "arena-reinicios-v3", v4: "arena-reinicios-v4", legado: "arena-v2" };
const fixture = (n: NombreFixture) => JSON.parse(readFileSync(`src/arena/__fixtures__/${archivo[n]}.json`, "utf8")) as RegistroArena;
const FIXTURES = Object.keys(archivo) as NombreFixture[];
/** Helper del estadista.test.ts (045), copiado tal cual. */
const prefijo = (r: RegistroArena, tick: number): RegistroArena => ({ ...r, eventos: r.eventos.filter(e => e.tick <= tick), fotogramas: r.fotogramas.filter(f => f.tick <= tick), final: [...r.fotogramas].reverse().find(f => f.tick <= tick)! });
/** Sin memo: cada llamada agrega de nuevo (las pruebas de prefijo no deben depender de la caché). */
const fresco: MemoAgregado = agregarPrefijo;

// ---------------------------------------------------------------------------------------------
// Recuento independiente (§ 3 v1.1 reformulada por eventos vecinos, sin máquina compartida).
// ---------------------------------------------------------------------------------------------
const BALON = ["pase", "tiro", "recepcion", "intercepcion", "recuperacion", "atajada", "reinicio", "fuera_juego", "gol", "tiro_fuera"];
/** Un pase lo cierra SIEMPRE el siguiente evento de balón; su tipo decide la categoría. */
function cierrePase(ev: EventoArena[], i: number): { tipo: "completado" | "fallido" | "cancelado" | "pendiente"; cierre?: EventoArena } {
  const p = ev[i]!, d = ev.slice(i + 1).find(e => BALON.includes(e.tipo));
  if (!d) return { tipo: "pendiente" };
  if (d.tipo === "recepcion" && d.receptor === p.jugador) return { tipo: "completado", cierre: d };
  if (d.tipo === "intercepcion" && d.receptor === p.jugador) return { tipo: "fallido", cierre: d };
  if (d.tipo === "fuera_juego" && d.lado === p.lado) return { tipo: "fallido", cierre: d };
  if (d.tipo === "reinicio" && d.lado !== p.lado) return { tipo: "fallido", cierre: d };
  return { tipo: "cancelado", cierre: d };
}
/** Quién controlaba el balón justo antes de `i`, mirando hacia atrás. */
function controlAntes(r: RegistroArena, ev: EventoArena[], i: number): { id: string; lado: Lado } | null {
  const plantilla = [...r.inicial.jugadores, ...r.inicial.banco ?? []];
  for (let k = i - 1; k >= 0; k--) {
    const e = ev[k]!;
    if (["fuera_juego", "gol", "tiro_fuera"].includes(e.tipo) || e.tipo === "atajada" && e.motivo === "desvio") return null;
    if (BALON.includes(e.tipo)) {
      // Una roja o un cambio posteriores que retiran a ese jugador lo dejan sin control.
      if (ev.slice(k + 1, i).some(x => x.tipo === "roja" && x.jugador === e.jugador || x.tipo === "cambio" && x.sale === e.jugador)) return null;
      return { id: e.jugador, lado: e.lado };
    }
  }
  const id = r.inicial.balon.poseedor;
  if (!id || ev.slice(0, i).some(x => x.tipo === "roja" && x.jugador === id || x.tipo === "cambio" && x.sale === id)) return null;
  return { id, lado: plantilla.find(j => j.id === id)!.lado };
}
const previoBalon = (ev: EventoArena[], i: number, saltar = 0) => ev.slice(0, i).filter(e => BALON.includes(e.tipo)).at(-1 - saltar);
function finalIndependiente(r: RegistroArena, tick: number) {
  return tick * ARENA.pasoS >= r.config.duracionS - 1e-9 || r.eventos.some(e => e.tipo === "final_anticipado" && e.tick <= tick) || r.fotogramas.some(f => f.tick <= tick && !!f.finalizado);
}
/** Regla del 045 copiada: primer gol/atajada/tiro_fuera sin otro tiro en medio. */
function claseRemate(ev: EventoArena[], i: number, final: boolean): "directo" | "indirecto" | "pendiente" {
  const t = ev[i]!;
  for (const d of ev.slice(i + 1)) {
    if (d.tipo === "tiro") return "indirecto";
    if (d.tipo === "gol" || d.tipo === "atajada" || d.tipo === "tiro_fuera") return d.tipo === "gol" && d.lado === t.lado && d.jugador === t.jugador || d.tipo === "atajada" && d.receptor === t.jugador ? "directo" : "indirecto";
  }
  return final ? "indirecto" : "pendiente";
}

function independiente(r: RegistroArena, tick: number) {
  const ev = r.eventos.filter(e => e.tick <= tick), fs = r.fotogramas.filter(f => f.tick <= tick);
  const plantilla = [...r.inicial.jugadores, ...r.inicial.banco ?? []], ladoDe = (id: string) => plantilla.find(j => j.id === id)!.lado;
  const cap = capacidadesIndependientes(r), v12 = !reglasDesde(r.config, "reinicios-v3"), final = finalIndependiente(r, tick);
  const recuperaciones: { jugador: string; perdio?: string }[] = [];
  ev.forEach((e, i) => {
    if (e.tipo === "intercepcion") {
      const prev = previoBalon(ev, i), antes = prev?.tipo === "atajada" && prev.motivo === "desvio" && v12 ? previoBalon(ev, i, 1) : prev;
      const pase = prev?.tipo === "pase" && e.receptor === prev.jugador;
      const tiro = antes?.tipo === "tiro" && e.receptor === antes.jugador;
      if (pase || tiro || controlAntes(r, ev, i)?.lado !== e.lado) recuperaciones.push({ jugador: e.jugador });
    }
    if (e.tipo === "recuperacion") {
      const prev = previoBalon(ev, i);
      if (prev?.tipo === "atajada" && prev.motivo === "desvio") { if (prev.lado === e.lado) recuperaciones.push({ jugador: e.jugador }); return; }
      const c = controlAntes(r, ev, i);
      if (c && c.lado !== e.lado) recuperaciones.push({ jugador: e.jugador, perdio: c.id });
    }
  });
  const jugador = (id: string) => {
    const mios = ev.filter(e => e.jugador === id), n = (tipo: string) => mios.filter(e => e.tipo === tipo).length;
    const cierres = ev.map((e, i) => e.tipo === "pase" && e.jugador === id ? cierrePase(ev, i).tipo : null).filter(Boolean);
    const completados = cierres.filter(c => c === "completado").length, fallidos = cierres.filter(c => c === "fallido").length;
    const tiros = ev.map((e, i) => e.tipo === "tiro" && e.jugador === id ? claseRemate(ev, i, final) : null).filter(Boolean);
    const pases = mios.filter(e => e.tipo === "pase");
    let distancia = 0, posesion = 0, velocidad: number | null = null;
    for (let k = 0; k < fs.length; k++) {
      const b = fs[k]!, jb = b.jugadores.find(j => j.id === id);
      if (jb) velocidad = Math.max(velocidad ?? 0, Math.hypot(jb.velocidad.x, jb.velocidad.y) * ESTADISTICAS_ARENA.kmhPorMps);
      if (k === 0) continue;
      const a = fs[k - 1]!, ja = a.jugadores.find(j => j.id === id);
      const dentro = (e: EventoArena) => e.tick > a.tick && e.tick <= b.tick;
      if (ja && jb && !ev.some(e => dentro(e) && (e.tipo === "reinicio" || e.tipo === "cambio" && e.jugador === id))) distancia += Math.hypot(jb.posicion.x - ja.posicion.x, jb.posicion.y - ja.posicion.y);
      const parado = a.pausa && a.tick < a.pausa.hastaTick || a.saque && a.tick < a.saque.hastaTick;
      if (!parado && a.balon.poseedor === id) posesion += (b.tick - a.tick) * ARENA.pasoS;
    }
    const f = (x: number) => cap.faltas ? x : null;
    return {
      goles: ev.filter(e => e.tipo === "gol" && e.jugador === id && e.lado === ladoDe(id)).length,
      autogoles: ev.filter(e => e.tipo === "gol" && e.jugador === id && e.autogol).length,
      remates: tiros.length, remates_directos: tiros.filter(c => c === "directo").length, remates_indirectos: tiros.filter(c => c === "indirecto").length, remates_pendientes: tiros.filter(c => c === "pendiente").length,
      pases: pases.length, pases_completados: completados,
      precision_pase: completados + fallidos ? Math.round(100 * completados / (completados + fallidos)) : null,
      distancia_media_pase: pases.length ? Math.round(pases.reduce((s, p) => s + p.distanciaM, 0) / pases.length) : null,
      centros: cap.centros ? pases.filter(p => p.motivo === "centro").length : null,
      recuperaciones: recuperaciones.filter(x => x.jugador === id).length, perdidas: fallidos + recuperaciones.filter(x => x.perdio === id).length,
      faltas_cometidas: f(n("falta")), faltas_recibidas: f(ev.filter(e => e.tipo === "falta" && e.receptor === id).length),
      amarillas: f(n("amarilla")), rojas: f(n("roja")), fueras_juego: n("fuera_juego"), atajadas: n("atajada"),
      acciones_balon: mios.filter(e => ["pase", "recepcion", "intercepcion", "recuperacion", "tiro", "atajada", "reinicio"].includes(e.tipo)).length,
      igr: Math.round(mios.filter(e => e.tipo === "tiro").reduce((s, t) => s + igrIndependiente(t.desde.x, t.desde.y, t.lado), 0) * 100) / 100,
      distancia_m: Math.round(distancia), velocidad_max_kmh: velocidad === null ? null : Math.round(velocidad * 10) / 10, posesion_s: Math.round(posesion * 10) / 10,
    };
  };
  const equipo = (lado: Lado) => {
    const propios = plantilla.filter(j => j.lado === lado).map(j => jugador(j.id));
    const s = (k: keyof ReturnType<typeof jugador>) => propios.reduce((t, c) => t + (c[k] ?? 0), 0);
    const delLado = (tipo: string) => ev.filter(e => e.tipo === tipo && e.lado === lado).length;
    let propio = 0, total = 0;
    for (let k = 1; k < fs.length; k++) {
      const a = fs[k - 1]!, dt = fs[k]!.tick - a.tick;
      if (a.pausa && a.tick < a.pausa.hastaTick || a.saque && a.tick < a.saque.hastaTick) continue;
      const l = a.balon.poseedor ? ladoDe(a.balon.poseedor) : a.balon.vuelo?.lado ?? (a.balon.manos ? ladoDe(a.balon.manos.portero) : null);
      if (!l) continue;
      total += dt; if (l === "local") propio += dt;
    }
    const posLocal = total ? Math.round(100 * propio / total) : null;
    const pasesLado = ev.map((e, i) => e.tipo === "pase" && e.lado === lado ? cierrePase(ev, i).tipo : null).filter(Boolean);
    const res = pasesLado.filter(c => c === "completado" || c === "fallido").length, comp = pasesLado.filter(c => c === "completado").length;
    const f = (x: number) => cap.faltas ? x : null;
    return {
      posesion_pct: posLocal === null ? null : lado === "local" ? posLocal : 100 - posLocal,
      igr: Math.round(ev.filter(e => e.tipo === "tiro" && e.lado === lado).reduce((t, e) => t + igrIndependiente(e.desde.x, e.desde.y, lado), 0) * 100) / 100,
      remates_cercanos: ev.filter(e => e.tipo === "tiro" && e.lado === lado && igrIndependiente(e.desde.x, e.desde.y, lado) >= IGR_ARENA.umbralCercano).length,
      remates: delLado("tiro"), remates_directos: s("remates_directos"), remates_indirectos: s("remates_indirectos"),
      esquinas: cap.reinicios ? ev.filter(e => e.tipo === "reinicio" && e.reinicio === "esquina" && e.lado === lado).length : null,
      fueras_juego: delLado("fuera_juego"), pases_completados: comp, precision_pase: res ? Math.round(100 * comp / res) : null,
      recuperaciones: s("recuperaciones"), perdidas: s("perdidas"),
      faltas: f(delLado("falta")), amarillas: f(delLado("amarilla")), rojas: f(delLado("roja")), atajadas: delLado("atajada"),
    } as Record<string, number | null>;
  };
  return { jugador, equipo, final };
}
/** IGR escrito aparte: ángulo por ley de cosenos entre los dos postes. */
function igrIndependiente(x: number, y: number, lado: Lado) {
  const gx = lado === "local" ? ARENA.largoM : 0;
  if (lado === "local" ? x >= gx : x <= gx) return 0;
  const p1 = Math.hypot(gx - x, ARENA.anchoM / 2 - ARENA.arcoM / 2 - y), p2 = Math.hypot(gx - x, ARENA.anchoM / 2 + ARENA.arcoM / 2 - y);
  const theta = Math.acos(Math.min(1, Math.max(-1, (p1 * p1 + p2 * p2 - ARENA.arcoM * ARENA.arcoM) / (2 * p1 * p2))));
  if (!(theta > 0)) return 0;
  const d = Math.hypot(gx - x, ARENA.anchoM / 2 - y), t0 = 2 * Math.atan(ARENA.arcoM / 2 / IGR_ARENA.puntoPenalM);
  return Math.min(IGR_ARENA.max, Math.max(IGR_ARENA.min, IGR_ARENA.base * theta / t0 * Math.exp(-Math.max(0, d - IGR_ARENA.distanciaLibreM) / IGR_ARENA.escalaM)));
}
const capacidadesIndependientes = (r: RegistroArena) => ({ faltas: !!r.inicial.entrenadores, reinicios: !!r.config.reglas, centros: r.config.reglas === "reinicios-v4" });

/** Los dos porteros, el máximo rematador y el primer suplente que entró (si existe). */
function cuatroJugadores(r: RegistroArena): string[] {
  const porteros = lados.map(l => r.inicial.jugadores.find(j => j.lado === l && j.puesto === "POR")!.id);
  const tiros = new Map<string, number>(); for (const e of r.eventos) if (e.tipo === "tiro") tiros.set(e.jugador, (tiros.get(e.jugador) ?? 0) + 1);
  const rematador = [...tiros].sort((a, b) => b[1] - a[1])[0]?.[0];
  const suplente = r.eventos.find(e => e.tipo === "cambio")?.jugador;
  return [...new Set([...porteros, ...rematador ? [rematador] : [], ...suplente ? [suplente] : []])];
}
const valores = (r: RegistroArena, tick: number, id: string) => Object.fromEntries(Object.entries(cifrasJugador(r, tick, id, fresco).cifras).map(([k, c]) => [k, c.valor]));
/** Partición de los pases: cada uno en exactamente una categoría y nunca en dos cierres. */
function particionPases(r: RegistroArena, tick: number) {
  const ag = agregarPrefijo(r, tick), pasesPrefijo = r.eventos.filter(e => e.tick <= tick && e.tipo === "pase");
  for (const [id] of ag.lados) {
    const a = acumuladoDe(ag, id), paseIds = new Set(pasesPrefijo.map(p => p.id));
    const completados = a.completadosEv.filter(x => paseIds.has(x)), fallidos = a.fallidosEv.filter(x => paseIds.has(x));
    const pendientes = ag.pendientesPase.filter(x => pasesPrefijo.find(p => p.id === x)?.jugador === id);
    const todos = [...completados, ...fallidos, ...a.cancelados, ...pendientes];
    expect([id, todos.length]).toEqual([id, a.pases.length]);
    expect(new Set(todos).size).toBe(todos.length);
    expect([a.completados, a.fallidos]).toEqual([completados.length, fallidos.length]);
  }
}

describe("049 · recuento independiente sobre los fixtures", () => {
  for (const n of FIXTURES) it(`${n}: equipo y cuatro jugadores en el último tick y en el del último gol`, () => {
    const r = fixture(n), ultimoGol = [...r.eventos].reverse().find(e => e.tipo === "gol");
    const ids = cuatroJugadores(r);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    for (const tick of [r.final.tick, ...ultimoGol ? [ultimoGol.tick] : []]) {
      const panel = cifrasEquipos(r, tick, fresco), ind = independiente(r, tick);
      expect(panel.filas.map(f => f.clave)).toEqual([...ESTADISTICAS_ARENA.filasPanel]);
      expect(panel.final).toBe(ind.final);
      for (const fila of panel.filas) for (const lado of lados) expect([fila.clave, lado, fila[lado].valor]).toEqual([fila.clave, lado, ind.equipo(lado)[fila.clave]]);
      for (const id of ids) expect(valores(r, tick, id)).toEqual(ind.jugador(id));
      particionPases(r, tick);
    }
  });

  it("los fixtures ejercitan las cifras: pases, recuperaciones, pérdidas y posesión no nulas", () => {
    for (const n of ["v1", "v3", "v4"] as const) {
      const r = fixture(n), p = cifrasEquipos(r, r.final.tick, fresco), v = (k: ClaveCifraEquipo) => p.filas.find(f => f.clave === k)!;
      for (const k of ["pases_completados", "recuperaciones", "perdidas"] as const) expect(v(k).local.valor! + v(k).visita.valor!).toBeGreaterThan(0);
      expect(v("posesion_pct").local.valor! + v("posesion_pct").visita.valor!).toBe(100);
      expect(p.final).toBe(true);
    }
    expect(cifrasEquipos(fixture("v1"), 100, fresco).final).toBe(false);
  });

  it("ninguna pareja de atajadas comparte `desde` (límite declarado del desvío v1/v2)", () => {
    for (const n of FIXTURES) {
      const desdes = fixture(n).eventos.filter(e => e.tipo === "atajada").map(e => `${e.desde.x}:${e.desde.y}`);
      expect(new Set(desdes).size).toBe(desdes.length);
    }
  });
});

describe("049 · invarianza de prefijo, final y sin futuro", () => {
  for (const n of FIXTURES) it(`${n}: el registro completo y el prefijo dan las mismas cifras`, () => {
    const r = fixture(n), ids = cuatroJugadores(r), fin = r.final.tick;
    const ticks = [...new Set([...r.eventos.map(e => e.tick), ...Array.from({ length: 10 }, (_, k) => Math.round((k + 0.5) * fin / 10))])];
    const base = r.eventos.find(e => e.tipo === "tiro") ?? r.eventos[0]!;
    for (const t of ticks) {
      const p = prefijo(r, t);
      expect(cifrasEquipos(r, t, fresco)).toEqual(cifrasEquipos(p, t, fresco));
      for (const id of ids) expect(cifrasJugador(r, t, id, fresco)).toEqual(cifrasJugador(p, t, id, fresco));
      // Un gol futuro (t + 1) añadido al registro no cambia nada.
      const conFuturo: RegistroArena = { ...r, eventos: [...r.eventos, { ...base, id: "futuro", tick: t + 1, tipo: "gol" }] };
      expect(cifrasEquipos(conFuturo, t, fresco)).toEqual(cifrasEquipos(r, t, fresco));
      for (const id of ids) expect(cifrasJugador(conFuturo, t, id, fresco)).toEqual(cifrasJugador(r, t, id, fresco));
    }
  });

  it("final solo desde el prefijo: duración, cursor entre muestras y final anticipado", () => {
    const r = fixture("v1"), duracion = Math.round(r.config.duracionS / ARENA.pasoS);
    // (a) t = duración: final; igual en el registro completo y en su prefijo.
    expect(cifrasEquipos(r, duracion, fresco)).toEqual(cifrasEquipos(prefijo(r, duracion), duracion, fresco));
    expect(cifrasEquipos(r, duracion, fresco).final).toBe(true);
    // (b) t entre dos muestras: cubiertoHastaTick = la muestra anterior; mismas cifras que en ella salvo `tick`.
    const anterior = r.fotogramas.at(-2)!.tick, entre = anterior + 1;
    const c = cifrasEquipos(r, entre, fresco);
    expect([c.final, c.cubiertoHastaTick]).toEqual([false, anterior]);
    expect(c).toEqual(cifrasEquipos(prefijo(r, entre), entre, fresco));
    // (c) final_anticipado sintético con su fotograma `finalizado`: final en ese tick, sin leer registro.final.
    const corte = 300, ultimo = r.fotogramas.filter(f => f.tick <= corte).at(-1)!;
    const sint: RegistroArena = structuredClone({ ...r, eventos: r.eventos.filter(e => e.tick <= corte), fotogramas: r.fotogramas.filter(f => f.tick <= corte) });
    sint.eventos.push({ ...sint.eventos.at(-1)!, id: "fa", tick: corte, tipo: "final_anticipado" });
    sint.fotogramas.push({ ...structuredClone(ultimo), tick: corte, finalizado: { tick: corte, motivo: "menos_de_siete" } });
    sint.final = r.final; // un `final` del registro que NO es el anticipado: no debe leerse
    const ca = cifrasEquipos(sint, corte, fresco);
    expect([ca.final, ca.cubiertoHastaTick]).toEqual([true, corte]);
    expect(ca).toEqual(cifrasEquipos(prefijo(sint, corte), corte, fresco));
    expect(cifrasEquipos(sint, corte - 1, fresco).final).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// Secuencias sintéticas sobre la plantilla del fixture v3 (reinicios-v3: el rechace no es vuelo).
// ---------------------------------------------------------------------------------------------
const v3 = fixture("v3"), v1 = fixture("v1");
const plantillaV3 = [...v3.inicial.jugadores, ...v3.inicial.banco ?? []];
const ladoV3 = (id: string) => plantillaV3.find(j => j.id === id)!.lado;
let secuencia = 0;
const ev = (tick: number, tipo: EventoArena["tipo"], jugador: string, receptor: string | null = null, extra: Partial<EventoArena> = {}): EventoArena =>
  ({ id: `s${++secuencia}`, tick, tipo, lado: ladoV3(jugador), jugador, receptor, desde: { x: 50, y: 34 }, hasta: { x: 60, y: 34 }, distanciaM: 10, ...extra });
/** Registro sintético: misma plantilla que v3; `base` decide las reglas (familia del desvío). El
 * balón inicial lo tiene `inicial` (por defecto, nadie, para que la máquina arranque sin control). */
const sintetico = (eventos: EventoArena[], fotogramas?: EstadoArena[], base: RegistroArena = v3, inicial: string | null = null): RegistroArena => {
  const ini = { ...base.inicial, balon: { ...base.inicial.balon, poseedor: inicial } };
  const fs = fotogramas ?? [ini];
  return { ...base, inicial: ini, eventos, fotogramas: fs, final: fs.at(-1)! };
};
const T = 1e6;
const fila = (r: RegistroArena, clave: ClaveCifraEquipo, tick = T) => cifrasEquipos(r, tick, fresco).filas.find(f => f.clave === clave)!;
const del = (r: RegistroArena, id: string, tick = T) => cifrasJugador(r, tick, id, fresco).cifras;
const acum = (r: RegistroArena, id: string, tick = T) => acumuladoDe(agregarPrefijo(r, tick), id);

describe("049 · remates como el 045", () => {
  /** Directos con su evidencia [tiro, desenlace] concatenada == lista del 045 sin los tiros sueltos. */
  function equivalencia(r: RegistroArena, tick: number) {
    const rp = rematesPorLado(r.eventos, tick), panel = cifrasEquipos(r, tick, fresco), tiros = new Set(r.eventos.filter(e => e.tipo === "tiro").map(e => e.id));
    const ag = agregarPrefijo(r, tick);
    for (const lado of lados) {
      expect(panel.filas.find(f => f.clave === "remates_directos")?.[lado].valor ?? rp[lado].aPuerta).toBe(rp[lado].aPuerta);
      const ids = rp[lado].eventos, pares = ids.flatMap((id, i) => tiros.has(id) && ids[i + 1] !== undefined && !tiros.has(ids[i + 1]!) ? [id, ids[i + 1]!] : []);
      const directos = [...ag.lados].filter(([, l]) => l === lado).flatMap(([id]) => { const a = acumuladoDe(ag, id); return a.directosEv.map((x, k) => [x, k, id] as const); });
      // Orden del registro: los pares de todos los jugadores del lado, ordenados por el id del tiro.
      const orden = new Map(r.eventos.map((e, i) => [e.id, i]));
      const porTiro = new Map<string, string>(); for (const [x, k, id] of directos) if (k % 2 === 0) porTiro.set(x, acumuladoDe(ag, id).directosEv[k + 1]!);
      const concatenados = [...porTiro.keys()].sort((a, b) => orden.get(a)! - orden.get(b)!).flatMap(t => [t, porTiro.get(t)!]);
      expect(concatenados).toEqual(pares);
    }
  }

  it("asocia la atajada por receptor con remates seguidos de ambos lados", () => {
    // t1 local; t2 visitante lo «cierra» sin desenlace (indirecto); la atajada del portero LOCAL
    // tiene receptor visita-9 ⇒ directo del visitante. Asociar por `lado` se lo daría al local.
    const r = sintetico([ev(10, "tiro", "local-9"), ev(12, "tiro", "visita-9"), ev(14, "atajada", "local-0", "visita-9")]);
    expect([fila(r, "remates").local.valor, fila(r, "remates_directos").local.valor, fila(r, "remates_indirectos").local.valor]).toEqual([1, 0, 1]);
    expect([fila(r, "remates").visita.valor, fila(r, "remates_directos").visita.valor, fila(r, "remates_indirectos").visita.valor]).toEqual([1, 1, 0]);
    expect(del(r, "visita-9").remates_directos.evidencia.eventos).toEqual([r.eventos[1]!.id, r.eventos[2]!.id]);
    equivalencia(r, T);
    // Atajada del portero local cuyo receptor (visita-7) no es el rematador (visita-8): no es directo
    // de visita-8 aunque el lado de la atajada sea el rival del tirador.
    const otro = sintetico([ev(30, "tiro", "visita-8"), ev(32, "atajada", "local-0", "visita-7")]);
    expect([del(otro, "visita-8").remates_directos.valor, del(otro, "visita-8").remates_indirectos.valor]).toEqual([0, 1]);
    equivalencia(otro, T);
    // Dos remates seguidos del MISMO lado: en la lista del 045 el primero va seguido de otro tiro,
    // que no es su desenlace ⇒ indirecto; el segundo, atajado, directo.
    const seguidos = sintetico([ev(40, "tiro", "local-9"), ev(42, "tiro", "local-10"), ev(44, "atajada", "visita-0", "local-10")]);
    expect([del(seguidos, "local-9").remates_directos.valor, del(seguidos, "local-9").remates_indirectos.valor, del(seguidos, "local-10").remates_directos.valor]).toEqual([0, 1, 1]);
    equivalencia(seguidos, T);
  });

  it("desvío pre-v3 (atajada + tiro_fuera del mismo vuelo): un remate, directo, un solo desenlace", () => {
    const tiro = ev(10, "tiro", "local-9"), atajada = ev(14, "atajada", "visita-0", "local-9", { motivo: "desvio" }), fuera = ev(16, "tiro_fuera", "local-9");
    const r = sintetico([tiro, atajada, fuera], undefined, v1);
    expect([fila(r, "remates").local.valor, fila(r, "remates_directos").local.valor, fila(r, "remates_indirectos").local.valor]).toEqual([1, 1, 0]);
    expect(fila(r, "remates_directos").local.evidencia.eventos).toEqual([tiro.id, atajada.id]);
    equivalencia(r, T);
  });

  it("bloqueo: queda en juego hasta el siguiente remate, un desenlace o el final; sin desenlace: pendiente", () => {
    // El 045 no cierra un remate con intercepcion/recepcion/reinicio: el bloqueo sigue «en juego».
    const bloqueo = [ev(10, "tiro", "local-9"), ev(12, "intercepcion", "visita-4", "local-9")];
    const r = sintetico(bloqueo);
    // Antes del final (tick 100 < duración): en juego.
    expect([del(r, "local-9", 100).remates_directos.valor, del(r, "local-9", 100).remates_indirectos.valor, del(r, "local-9", 100).remates_pendientes.valor]).toEqual([0, 0, 1]);
    const cerrado = sintetico([...bloqueo, ev(20, "tiro", "visita-8")]);
    expect([del(cerrado, "local-9").remates_indirectos.valor, del(cerrado, "local-9").remates_pendientes.valor]).toEqual([1, 0]);
    // Con el final del prefijo (duración cumplida) el bloqueo es indirecto.
    const duracion = Math.round(v3.config.duracionS / ARENA.pasoS);
    expect([del(r, "local-9", duracion).remates_indirectos.valor, del(r, "local-9", duracion).remates_pendientes.valor]).toEqual([1, 0]);
    const pendiente = sintetico([ev(10, "tiro", "local-9")]);
    expect([del(pendiente, "local-9", 100).remates.valor, del(pendiente, "local-9", 100).remates_directos.valor, del(pendiente, "local-9", 100).remates_indirectos.valor, del(pendiente, "local-9", 100).remates_pendientes.valor]).toEqual([1, 0, 0, 1]);
    for (const x of [r, cerrado, pendiente]) { equivalencia(x, 100); equivalencia(x, T); }
  });

  it("el tiro_fuera no es remate", () => {
    const r = sintetico([ev(10, "tiro", "local-9"), ev(14, "tiro_fuera", "local-9")]);
    expect([fila(r, "remates").local.valor, fila(r, "remates_indirectos").local.valor]).toEqual([1, 1]);
  });

  const programados = Promise.all(Array.from({ length: 20 }, (_, i) => ejecutarArena(crearConfigArena({ seed: 4900 + i, duracionS: 60 }), { local: crearControladorProgramado(), visita: crearControladorProgramado() })));
  it("equivalencia con rematesPorLado en los cinco fixtures y 20 semillas programadas", async () => {
    let remates = 0;
    for (const r of [...FIXTURES.map(fixture), ...await programados]) {
      for (const tick of [...new Set(r.eventos.filter(e => ["tiro", "gol", "atajada", "tiro_fuera"].includes(e.tipo)).map(e => e.tick)), r.final.tick]) equivalencia(r, tick);
      remates += r.eventos.filter(e => e.tipo === "tiro").length;
      particionPases(r, r.final.tick);
    }
    expect(remates).toBeGreaterThan(20);
  });
});

describe("049 · máquina de pases (§ 3 v1.1), fila por fila", () => {
  const A = "local-5", B = "local-15", C = "local-9";
  it("completado (también el pase detenido que recoge un compañero), fallido y cancelado", () => {
    const eventos = [
      ev(10, "pase", A, B), ev(14, "recepcion", B, A),                    // completado de A [pase, recepcion]
      ev(20, "pase", B, C), ev(40, "recepcion", C, B),                    // detenido y controlado por C (el vuelo seguía): completado de B
      ev(50, "pase", C, A), ev(54, "intercepcion", "visita-4", C),        // fallido de C (interceptado); recupera visita-4
      ev(60, "pase", "visita-4", "visita-8"), ev(64, "fuera_juego", "visita-8"), // fallido de visita-4 (fuera de juego)
      ev(70, "reinicio", "local-0"),
      ev(71, "pase", "local-0", A), ev(75, "pase", A, C),                 // el de local-0 queda cancelado por otro pase
      ev(80, "reinicio", "visita-3", null, { reinicio: "banda" }),        // fallido de A (fuera: reinicio rival)
      ev(81, "pase", "visita-3", "visita-7"), ev(90, "reinicio", "visita-7", null, { reinicio: "banda" }), // reinicio propio: cancelado
      ev(91, "pase", "visita-7", "visita-9"), ev(95, "gol", "visita-7", null, { lado: "visita" }),         // pase que cruza la línea: cancelado (y gol)
      ev(100, "reinicio", "local-5", null, { reinicio: "centro" }),
      ev(101, "pase", A, B),                                               // pendiente
    ];
    const r = sintetico(eventos);
    expect([acum(r, A).completados, acum(r, A).fallidos, acum(r, A).cancelados.length, del(r, A).pases.valor, del(r, A).precision_pase.valor]).toEqual([1, 1, 0, 3, 50]);
    expect(del(r, A).pases_completados.evidencia.eventos).toEqual([eventos[0]!.id, eventos[1]!.id]);
    expect([acum(r, B).completados, del(r, B).precision_pase.valor]).toEqual([1, 100]);
    expect(del(r, B).pases_completados.evidencia.eventos).toEqual([eventos[2]!.id, eventos[3]!.id]);
    expect([acum(r, C).fallidos, del(r, C).perdidas.valor, del(r, C).precision_pase.valor]).toEqual([1, 1, 0]);
    expect(del(r, C).perdidas.evidencia.eventos).toEqual([eventos[4]!.id, eventos[5]!.id]);
    expect([del(r, "visita-4").recuperaciones.valor, del(r, "visita-4").perdidas.valor]).toEqual([1, 1]);
    expect(del(r, "visita-4").perdidas.evidencia.eventos).toEqual([eventos[6]!.id, eventos[7]!.id]);
    expect([acum(r, "local-0").cancelados.length, del(r, "local-0").precision_pase.valor]).toEqual([1, null]);
    expect(del(r, A).perdidas.evidencia.eventos).toEqual([eventos[10]!.id, eventos[11]!.id]);
    expect([acum(r, "visita-3").cancelados.length, acum(r, "visita-7").cancelados.length, del(r, "visita-7").goles.valor]).toEqual([1, 1, 1]);
    expect(agregarPrefijo(r, T).pendientesPase).toEqual([eventos[17]!.id]);
    particionPases(r, T);
    // Por equipo: local 2 completados (A, B) de 4 resueltos (A×2, B, C); visita 0 de 1.
    expect([fila(r, "pases_completados").local.valor, fila(r, "precision_pase").local.valor]).toEqual([2, 50]);
    expect([fila(r, "pases_completados").visita.valor, fila(r, "precision_pase").visita.valor]).toEqual([0, 0]);
    expect(fila(sintetico([ev(10, "pase", A, B)]), "precision_pase").local.valor).toBeNull();
  });

  it("un tiro, una atajada o una recuperación cancelan el pase abierto", () => {
    const r = sintetico([ev(10, "pase", A, C), ev(12, "tiro", C), ev(20, "pase", B, C), ev(22, "atajada", "visita-0", B), ev(30, "pase", "visita-0", "visita-4"), ev(32, "recuperacion", "local-9")]);
    expect([acum(r, A).cancelados.length, acum(r, B).cancelados.length, acum(r, "visita-0").cancelados.length]).toEqual([1, 1, 1]);
    particionPases(r, T);
  });
});

describe("049 · pérdidas y recuperaciones", () => {
  it("desposesión en duelo: pérdida del que controlaba y recuperación del rival", () => {
    const r = sintetico([ev(10, "pase", "local-5", "local-15"), ev(14, "recepcion", "local-15", "local-5"), ev(20, "recuperacion", "visita-4")]);
    expect([del(r, "local-15").perdidas.valor, del(r, "visita-4").recuperaciones.valor]).toEqual([1, 1]);
    expect(del(r, "local-15").perdidas.evidencia.eventos).toEqual([r.eventos[2]!.id]);
    // Balón suelto propio (mismo lado) o sin control: nada.
    const propio = sintetico([ev(10, "pase", "local-5", "local-15"), ev(14, "recepcion", "local-15", "local-5"), ev(20, "recuperacion", "local-9")]);
    expect([del(propio, "local-15").perdidas.valor, del(propio, "local-9").recuperaciones.valor]).toEqual([0, 0]);
    const sinControl = sintetico([ev(10, "fuera_juego", "local-9"), ev(12, "recuperacion", "visita-4")]);
    expect(del(sinControl, "visita-4").recuperaciones.valor).toBe(0);
    // Estado inicial: controla quien tiene el balón en `inicial` (local-5); un duelo ganado por visita-4 es pérdida suya.
    const inicial = sintetico([ev(5, "recuperacion", "visita-4")], undefined, v3, "local-5");
    expect([del(inicial, "local-5").perdidas.valor, del(inicial, "visita-4").recuperaciones.valor]).toEqual([1, 1]);
    // Una roja o un cambio del que controlaba lo dejan sin control: la recuperación posterior no es desposesión.
    const roja = sintetico([ev(10, "recepcion", "local-15", "local-5"), ev(12, "roja", "local-15"), ev(14, "recuperacion", "visita-4")]);
    expect(del(roja, "visita-4").recuperaciones.valor).toBe(0);
    const cambio = sintetico([ev(10, "recepcion", "local-15", "local-5"), ev(12, "cambio", "local-4", null, { sale: "local-15" }), ev(14, "recuperacion", "visita-4")]);
    expect(del(cambio, "visita-4").recuperaciones.valor).toBe(0);
  });

  it("intercepción: de un pase, bloqueo de un remate y balón del rival; la propia no recupera", () => {
    const r = sintetico([
      ev(10, "tiro", "local-9"), ev(12, "intercepcion", "visita-4", "local-9"),   // bloqueo: recupera visita-4, nada para el rematador
      ev(20, "pase", "visita-4", "visita-8"), ev(24, "recepcion", "visita-8", "visita-4"),
      ev(30, "intercepcion", "local-5", "visita-2"),                               // sin pase que case: recupera porque controlaba el rival
      ev(40, "intercepcion", "local-15", "visita-2"),                              // controlaba su propio equipo (local-5): no recupera
    ]);
    expect([del(r, "visita-4").recuperaciones.valor, del(r, "local-9").perdidas.valor]).toEqual([1, 0]);
    expect([del(r, "local-5").recuperaciones.valor, del(r, "local-15").recuperaciones.valor]).toEqual([1, 0]);
  });

  it("desvío v3/v4: el equipo del portero recoge el rechace ⇒ recuperación [atajada, recuperación]; el atacante ⇒ nada", () => {
    const atajada = ev(14, "atajada", "visita-0", "local-9", { motivo: "desvio" });
    const propio = sintetico([ev(10, "tiro", "local-9"), atajada, ev(18, "recuperacion", "visita-4")]);
    expect(del(propio, "visita-4").recuperaciones.valor).toBe(1);
    expect(del(propio, "visita-4").recuperaciones.evidencia.eventos).toEqual([atajada.id, propio.eventos[2]!.id]);
    expect(del(propio, "visita-0").perdidas.valor).toBe(0);
    const rival = sintetico([ev(10, "tiro", "local-9"), atajada, ev(18, "recuperacion", "local-10")]);
    expect([del(rival, "local-10").recuperaciones.valor, del(rival, "visita-0").perdidas.valor]).toEqual([0, 0]);
    expect([del(rival, "visita-0").atajadas.valor, acum(rival, "visita-0").desvios.length]).toEqual([1, 1]);
  });

  it("desvío v1/v2: el vuelo del remate sigue; intercepción rival del rechace recupera, recepción del compañero no", () => {
    const tiro = ev(10, "tiro", "local-9"), atajada = ev(14, "atajada", "visita-0", "local-9", { motivo: "desvio" });
    const intercepta = sintetico([tiro, atajada, ev(18, "intercepcion", "visita-4", "local-9")], undefined, v1);
    expect([del(intercepta, "visita-4").recuperaciones.valor, del(intercepta, "local-9").perdidas.valor]).toEqual([1, 0]);
    const compa = sintetico([tiro, atajada, ev(18, "recepcion", "local-10", "local-9")], undefined, v1);
    expect([del(compa, "local-10").recuperaciones.valor, del(compa, "local-9").pases_completados.valor]).toEqual([0, 0]);
  });
});

// ---------------------------------------------------------------------------------------------
// Fotogramas construidos a mano.
// ---------------------------------------------------------------------------------------------
const J = (id: string, x: number, y: number, vx = 0, vy = 0): JugadorArena => ({ ...plantillaV3.find(j => j.id === id)!, posicion: { x, y }, velocidad: { x: vx, y: vy } });
const foto = (tick: number, jugadores: JugadorArena[], balon: Partial<EstadoArena["balon"]> = {}, extra: Partial<EstadoArena> = {}): EstadoArena =>
  ({ ...v3.inicial, tick, jugadores, balon: { posicion: { x: 50, y: 34 }, poseedor: null, vuelo: null, ...balon }, pausa: null, saque: null, ...extra });

describe("049 · distancia y velocidad por muestreo", () => {
  it("(3, 4) m dos veces ⇒ 10 m; reinicio en medio ⇒ 5 m; cambio: solo el que entra; ausente ⇒ solo sus pares", () => {
    const fs = [foto(0, [J("local-5", 10, 10, 1, 0), J("local-4", 0, 0)]), foto(5, [J("local-5", 13, 14, 3, 4), J("local-4", 3, 4)]), foto(10, [J("local-5", 16, 18, 0, 2), J("local-4", 6, 8)])];
    expect(del(sintetico([], fs), "local-5").distancia_m.valor).toBe(10);
    expect(del(sintetico([ev(8, "reinicio", "local-0")], fs), "local-5").distancia_m.valor).toBe(5);
    const cambio = sintetico([ev(8, "cambio", "local-4", null, { sale: "local-9" })], fs);
    expect([del(cambio, "local-5").distancia_m.valor, del(cambio, "local-4").distancia_m.valor]).toEqual([10, 5]);
    const ausente = [fs[0]!, foto(5, []), fs[2]!, foto(15, [J("local-5", 19, 22)])];
    expect(del(sintetico([], ausente), "local-5").distancia_m.valor).toBe(5);
    expect(del(sintetico([], fs), "local-5").velocidad_max_kmh.valor).toBe(Math.round(Math.hypot(3, 4) * ESTADISTICAS_ARENA.kmhPorMps * 10) / 10);
    expect(del(sintetico([], fs), "local-5").distancia_m.evidencia).toEqual({ eventos: [], intervalo: [0, 10], fuente: "fotogramas" });
    expect(del(sintetico([], fs), "local-9").velocidad_max_kmh.valor).toBeNull();
  });

  it("en los cinco fixtures ninguna velocidad muestreada supera la cota teórica del motor", () => {
    const cotaKmh = ARENA.velocidadMps * (ARENA.velocidadMinFactor + ARENA.velocidadNivelFactor) * Math.max(...Object.values(TECNICA_ARENA.ritmo)) * ESTADISTICAS_ARENA.kmhPorMps;
    for (const n of FIXTURES) {
      const r = fixture(n);
      for (const j of [...r.inicial.jugadores, ...r.inicial.banco ?? []]) {
        const v = cifrasJugador(r, r.final.tick, j.id, fresco).cifras.velocidad_max_kmh.valor;
        if (v !== null) expect([n, j.id, v <= cotaKmh + 1e-6]).toEqual([n, j.id, true]);
      }
    }
  });
});

describe("049 · posesión por fotogramas", () => {
  const L = J("local-5", 50, 34), V = J("visita-0", 100, 34);
  const vuelo = (tipo: "pase" | "tiro" | "rechace", lado: Lado, autor: string) => ({ tipo, lado, autor, receptor: null, origen: { x: 0, y: 0 }, destino: { x: 1, y: 1 }, inicioTick: 0, adelantados: [] });
  it("poseedor, vuelo (rechace con el lado del remate), manos, sin atribución, pausa y saque; ponderado por ticks", () => {
    const fs = [
      foto(0, [L, V], { poseedor: "local-5" }),                                          // 5 ticks local
      foto(5, [L, V], { vuelo: vuelo("rechace", "local", "visita-0") }),                // 1 tick local (rechace: lado del remate)
      foto(6, [L, V], { manos: { portero: "visita-0", desdeTick: 6, hastaTick: 20 } }), // 5 ticks visita
      foto(11, [L, V]),                                                                 // 4 ticks sin atribución: fuera del denominador
      foto(15, [L, V], { poseedor: "visita-0" }, { pausa: { hastaTick: 20, lado: "visita", punto: { x: 0, y: 0 }, motivo: "falta" } }), // en pausa: no cuenta
      foto(20, [L, V], { poseedor: "local-5" }, { saque: { tipo: "banda", lado: "local", ejecutor: "local-5", punto: { x: 0, y: 0 }, hastaTick: 25 } }), // saque pendiente: no cuenta
      foto(25, [L, V], { poseedor: "visita-0" }),                                       // 1 tick visita
      foto(26, [L, V]),
    ];
    const r = sintetico([], fs), pos = fila(r, "posesion_pct");
    const local = Math.round(100 * 6 / 12);
    expect([pos.local.valor, pos.visita.valor]).toEqual([local, 100 - local]);
    expect(del(r, "local-5").posesion_s.valor).toBe(Math.round(5 * ARENA.pasoS * 10) / 10);
    expect(del(r, "visita-0").posesion_s.valor).toBe(Math.round(1 * ARENA.pasoS * 10) / 10);
    // Cursor entre muestras: mismo resultado que en la muestra anterior.
    expect(cifrasEquipos(r, 23, fresco).filas).toEqual(cifrasEquipos(r, 20, fresco).filas);
  });

  it("pares de 0,5 s y 0,1 s pesan distinto; poseedor expulsado (ausente en b) sigue contando por la plantilla; sin tiempo ⇒ null", () => {
    const pond = sintetico([], [foto(0, [L, V], { poseedor: "local-5" }), foto(5, [V], { poseedor: "visita-0" }), foto(6, [V])]);
    const p = fila(pond, "posesion_pct"), esperado = Math.round(100 * 5 / 6);
    expect([p.local.valor, p.visita.valor]).toEqual([esperado, 100 - esperado]);
    const expulsado = sintetico([], [foto(0, [V], { poseedor: "local-5" }), foto(5, [V])]);
    expect(fila(expulsado, "posesion_pct").local.valor).toBe(100);
    const nada = fila(sintetico([], [foto(0, [L, V]), foto(5, [L, V])]), "posesion_pct");
    expect([nada.local.valor, nada.visita.valor, nada.lider]).toEqual([null, null, null]);
    for (const n of FIXTURES) { const r = fixture(n), f = fila(r, "posesion_pct", r.final.tick); expect(f.local.valor! + f.visita.valor!).toBe(100); }
  });
});

describe("049 · capacidades: null «no simulado» frente a cero observado", () => {
  it("arena-v2 sin faltas ni esquinas; reinicios-v1 con faltas y sin centros; reinicios-v4 con centros", () => {
    const legado = fixture("legado"), r1 = fixture("v1"), r4 = fixture("v4");
    expect(capacidades(legado)).toEqual({ faltas: false, reinicios: false, centros: false });
    for (const k of ["faltas", "amarillas", "rojas", "esquinas"] as const) expect([k, fila(legado, k, legado.final.tick).local.valor]).toEqual([k, null]);
    expect(fila(r1, "faltas", r1.final.tick).local.valor! + fila(r1, "faltas", r1.final.tick).visita.valor!).toBe(r1.eventos.filter(e => e.tipo === "falta").length);
    const portero1 = r1.inicial.jugadores.find(j => j.puesto === "POR")!.id;
    expect([del(r1, portero1, r1.final.tick).centros.valor, typeof del(r1, portero1, r1.final.tick).faltas_cometidas.valor]).toEqual([null, "number"]);
    const r4id = r4.inicial.jugadores[0]!.id;
    expect(typeof del(r4, r4id, r4.final.tick).centros.valor).toBe("number");
    expect(fila(r4, "faltas", r4.final.tick).local.valor).toBe(r4.eventos.filter(e => e.tipo === "falta" && e.lado === "local").length);
  });
});

describe("049 · índice geométrico de remate (nivel 3, estimado)", () => {
  const cy = ARENA.anchoM / 2;
  it("anclas: punto penal, junto al arco (max), propia línea de fondo (min) y sobre la línea rival (0)", () => {
    const penal = IGR_ARENA.base * Math.exp(-(IGR_ARENA.puntoPenalM - IGR_ARENA.distanciaLibreM) / IGR_ARENA.escalaM);
    expect(igrRemate({ x: ARENA.largoM - IGR_ARENA.puntoPenalM, y: cy }, "local")).toBeCloseTo(penal, 12);
    expect(igrRemate({ x: IGR_ARENA.puntoPenalM, y: cy }, "visita")).toBeCloseTo(penal, 12);
    expect(igrRemate({ x: ARENA.largoM - 0.5, y: cy }, "local")).toBe(IGR_ARENA.max);
    expect(igrRemate({ x: 0, y: cy }, "local")).toBe(IGR_ARENA.min);
    expect(igrRemate({ x: ARENA.largoM, y: cy }, "local")).toBe(0);
    expect(igrRemate({ x: ARENA.largoM + 1, y: cy }, "local")).toBe(0);
    expect(igrRemate({ x: 0, y: cy }, "visita")).toBe(0);
  });
  it("simétrico en y, en [0, max], no creciente al alejarse por el eje y no decreciente al centrarse", () => {
    let previo = Infinity;
    for (let x = ARENA.largoM - 1; x > 0; x -= 3) {
      const v = igrRemate({ x, y: cy }, "local");
      expect(v).toBeLessThanOrEqual(previo); previo = v;
      for (const dy of [3, 9, 20]) {
        const arriba = igrRemate({ x, y: cy - dy }, "local"), abajo = igrRemate({ x, y: cy + dy }, "local");
        expect(arriba).toBeCloseTo(abajo, 12);
        expect(arriba).toBeLessThanOrEqual(v + 1e-12);
        expect(arriba).toBeGreaterThanOrEqual(0); expect(arriba).toBeLessThanOrEqual(IGR_ARENA.max);
        expect(arriba).toBeCloseTo(igrIndependiente(x, cy - dy, "local"), 12);
      }
    }
  });
  it("la fila de equipo suma sus remates; remates cercanos usan umbralCercano", () => {
    const cerca = ev(10, "tiro", "local-9", null, { desde: { x: ARENA.largoM - 0.5, y: cy } }), lejos = ev(20, "tiro", "local-10", null, { desde: { x: 40, y: 5 } });
    const r = sintetico([cerca, lejos]);
    const suma = Math.round((igrRemate(cerca.desde, "local") + igrRemate(lejos.desde, "local")) * 100) / 100;
    expect(fila(r, "igr").local.valor).toBe(suma);
    expect(fila(r, "igr").clase).toBe("estimada");
    expect(fila(r, "remates_cercanos").local.valor).toBe([cerca, lejos].filter(t => igrRemate(t.desde, "local") >= IGR_ARENA.umbralCercano).length);
    expect(fila(r, "remates_cercanos").local.evidencia.eventos).toEqual([cerca.id]);
  });
});

describe("049 · destacados del final (nivel 3)", () => {
  it("más remates a puerta, recuperaciones y distancia; empate: primero en plantilla, local antes que visita", () => {
    const r = fixture("v3"), d = destacados(r, r.final.tick, fresco);
    expect(d.length).toBeLessThanOrEqual(ESTADISTICAS_ARENA.destacados);
    const orden = lados.flatMap(l => [...r.inicial.jugadores, ...r.inicial.banco ?? []].filter(j => j.lado === l).map(j => j.id));
    for (const x of d) {
      const valoresDe = orden.map(id => cifrasJugador(r, r.final.tick, id, fresco).cifras[x.clave].valor ?? 0), max = Math.max(...valoresDe);
      expect([x.clave, x.valor, x.jugador]).toEqual([x.clave, max, orden[valoresDe.indexOf(max)]]);
    }
    // Empate a un remate directo: gana el local (antes en la plantilla).
    const emp = sintetico([ev(10, "tiro", "visita-9"), ev(12, "atajada", "local-0", "visita-9"), ev(20, "tiro", "local-9"), ev(22, "atajada", "visita-0", "local-9")]);
    expect(destacados(emp, T, fresco).find(x => x.clave === "remates_directos")!.jugador).toBe("local-9");
  });
});

describe("049 · reglasDesdeCliente", () => {
  it("coincide con reglasDesde del motor para todas las reglas y su ausencia", () => {
    for (const reglas of [undefined, ...reglasArena]) for (const desde of reglasArena) expect([reglas, desde, reglasDesdeCliente({ reglas }, desde)]).toEqual([reglas, desde, reglasDesde({ ...v3.config, reglas }, desde)]);
  });
});

describe("049 · líder", () => {
  it("mejorMenor invierte el sentido; empate ⇒ null; null en un lado ⇒ null", () => {
    for (const clave of ESTADISTICAS_ARENA.filasPanel) {
      const menor = (ESTADISTICAS_ARENA.mejorMenor as readonly string[]).includes(clave);
      expect([clave, liderFila(clave, 3, 1)]).toEqual([clave, menor ? "visita" : "local"]);
      expect([clave, liderFila(clave, 1, 3)]).toEqual([clave, menor ? "local" : "visita"]);
      expect(liderFila(clave, 2, 2)).toBeNull();
      expect(liderFila(clave, null, 2)).toBeNull();
      expect(liderFila(clave, 2, null)).toBeNull();
    }
    // En el panel: más faltas no lidera.
    const r = sintetico([ev(10, "falta", "local-5", "visita-9"), ev(20, "falta", "local-9", "visita-9"), ev(30, "falta", "visita-4", "local-9")]);
    expect(fila(r, "faltas").lider).toBe("visita");
    expect([del(r, "visita-9").faltas_recibidas.valor, del(r, "local-9").faltas_recibidas.valor]).toEqual([2, 1]);
  });
});

describe("049 · etiquetas ES/EN", () => {
  it("toda clave del panel y de la ficha tiene ES y EN; las estimadas lo dicen; sin «xG» ni «goles esperados»", () => {
    for (const clave of [...ESTADISTICAS_ARENA.filasPanel, ...CLAVES_JUGADOR]) {
      const e = ETIQUETAS_CIFRAS[clave];
      expect([clave, typeof e?.es, typeof e?.en]).toEqual([clave, "string", "string"]);
      expect(e.es.length * e.en.length).toBeGreaterThan(0);
      expect(`${e.es} ${e.en}`).not.toMatch(/xG|goles esperados|expected goals/i);
    }
    const r = fixture("v3");
    for (const f of cifrasEquipos(r, r.final.tick, fresco).filas) if (f.clase === "estimada") { expect(ETIQUETAS_CIFRAS[f.clave].es).toMatch(/estimado/); expect(ETIQUETAS_CIFRAS[f.clave].en).toMatch(/estimated/); }
  });
});

describe("049 · una sola agregación por prefijo", () => {
  it("dos proyecciones con el mismo (registro, tick) cuestan una agregación; otro tick u otra identidad, otra", () => {
    let n = 0;
    const memo = crearMemoAgregado((r, t) => { n++; return agregarPrefijo(r, t); });
    const r = fixture("v3");
    cifrasEquipos(r, 200, memo); cifrasJugador(r, 200, "local-0", memo); cifrasEquipos(r, 200, memo);
    expect(n).toBe(1);
    cifrasEquipos(r, 201, memo); expect(n).toBe(2);
    cifrasEquipos({ ...r }, 201, memo); expect(n).toBe(3); // aplicarPublicacion crea un objeto nuevo en cada avance
  });
});
