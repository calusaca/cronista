// Brief 063 · publicación 1 (bloques 0 y A, reglas reinicios-v6): compatibilidad, repliegue de emergencia,
// persecución tras pérdida y su frenado, con gating por versión. Las cifras salen de limites.ts
// (PERSECUCION_ARENA, LOTE_ARENA_063, LOTE_ARENA_046/051, ARENA); los valores propios de cada escenario se
// nombran como tales en ESCENARIO. Cada prueba nombra la mutación que la pone en rojo.
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ARENA, LOTE_ARENA_046 as L, LOTE_ARENA_051 as L51, LOTE_ARENA_063 as L63, PERSECUCION_ARENA as PE } from "../../sim/limites";
import type { Lado } from "../../sim/tipos";
import { lineaDePuesto } from "../atributos";
import { anclas } from "../catalogo";
import { evaluarPases, frasesPersecucion, opcionPase, SISTEMA_ARENA, crearControladorProgramado } from "../controladores";
import { ejecutarArena, reproducirArena } from "../coordinador";
import { estadosOraculo, observacionOraculo, type EntradaOraculo063 } from "../__fixtures__/generar-opcion-pase-063";
import { condicionesFixtureV6, cumpleFixtureV6, DURACION_FIXTURE_V6_S } from "../__fixtures__/generar-reinicios-v6";
import { bandasLote, incumplimientos, incumplimientos063, incumplimientosControlado, medirControlado, medirLote } from "../metricas-lote";
import { crearConfigArena, crearEstadoArena, MotorArena, reglasDesde, validarConfigArena } from "../motor";
import { destinoPersecucion, destinoRepliegue, duracionPersecucionS, hastaTickPersecucion, limitarPersecucion, limiteXPersecucion, perseguidoresDe, seleccionRepliegue, superadoPor } from "../persecucion";
import { validarRaizTorneos, validarTorneo } from "../torneo-validacion";
import { lados, reglasArena, type ConfigArena, type EstadoArena, type FormacionArena, type JugadorArena, type OrdenesEquipo, type OrdenJugador, type PersecucionArena, type Punto, type RegistroArena, type ReglasArena, type Vuelo } from "../tipos";

const V6 = "reinicios-v6" as const, V5 = "reinicios-v5" as const;
type Reglas = ReglasArena | undefined;
/** Matriz de versiones: v1–v5 y archivos sin `reglas` frente a v6. */
const ANTERIORES: readonly Reglas[] = ["reinicios-v1", "reinicios-v2", "reinicios-v3", "reinicios-v4", V5, undefined];
const MEDIO_Y = ARENA.anchoM / 2;
const EPS = 1e-9;

/** Valores propios de los escenarios: posiciones, niveles y duraciones elegidos para aislar cada regla. */
const ESCENARIO = {
  semilla: 7, duracionS: 30, intervaloS: 10, semillaMax: 400,
  /** Formaciones de los escenarios: la visita con cinco defensas para el repliegue. */
  local: "4-3-3" as FormacionArena, visita: "5-3-2" as FormacionArena,
  /** Filas donde se aparcan los jugadores de campo que no intervienen. */
  parqueLocalX: 15, parqueVisitaX: 30, filaY0: 4, filaDY: 6,
  /** Repliegue (A2/A3): balón del atacante local; distancias (m) y ángulos (rad) de los visitantes respecto
   * del balón, hacia su propio campo. El perseguidor es el más cercano; el último está fuera del radio. */
  balonRepliegue: { x: 70, y: 34 },
  repliegue: { perseguidor: [3, 0], def0: [6, 0.6], med1: [7, -0.6], def1: [9, 1.2], def2: [11, -1.2], def3: [13, 0.2], lejos: [35, 0] },
  /** Coseno mínimo entre la velocidad tras un paso desde el reposo y la dirección al destino. */
  cosenoDireccion: 0.9995,
  /** Movimiento mínimo (m) hacia su arco en un segundo para contar como «se mueve». */
  avanceMinM: 1,
  /** Duelo y pérdidas (A4): posiciones del portador local y del defensor visitante a ≤ controlM. */
  portador: { x: 50, y: 34 }, defensorDx: 0.8, nivelAlto: 100, nivelBajo: 1,
  /** Pase interceptado: pasador, receptor y defensor sobre la línea. */
  pasador: { x: 40, y: 34 }, receptor: { x: 60, y: 34 }, interceptor: { x: 50, y: 34.3 },
  /** Balón suelto junto a un jugador. */
  suelto: { x: 60, y: 20 }, sueltoDx: 0.5, sueltoArea: { x: 100, y: 34 }, sueltoAreaLocal: { x: 5, y: 34 },
  /** Pase que sale por la banda. */
  bandaOrigen: { x: 50, y: 66 }, bandaDestino: { x: 50, y: 74 },
  /** Persecución previa activa (fijada a mano) y su duración (ticks). */
  previaTicks: 50,
  /** Límite (A6): poseedor visitante que conduce hacia el campo local y perseguidor detrás. */
  limitePoseedor: { x: 58, y: 34 }, limitePerseguidor: { x: 64, y: 34 }, limiteMedio: { x: 45, y: 34 }, limitePerseguidorMedio: { x: 50, y: 34 },
  limiteTicks: 60, parqueLejosX: 100, cotaPorDebajoM: 1, energiaBaja: 0.4,
  /** Medio perdedor dentro del repliegue (A6): balón visitante y posiciones locales. */
  medioRepliegue: { balon: { x: 36, y: 34 }, medio: { x: 50, y: 50 }, cercano: { x: 40, y: 34 } },
  /** Frenado (A7): poseedor lejos; perseguidor y control corriendo en sentido contrario. */
  frenadoPoseedor: { x: 42, y: 34 }, frenadoPerseguidor: { x: 60, y: 34 }, frenadoControl: { x: 60, y: 60 }, frenadoControlDestino: { x: 20, y: 60 }, velocidadContraria: 6, ticksFrenado: 20,
  /** 0.5: semillas y duración de las corridas frescas. */
  semillasEstado: [3, 11], duracionEstadoS: 60,
  /** A10: semillas e intervalos de los registros reales de 180 s. */
  semillasTamano: [1, 2, 3, 4, 5], intervalosTamano: [15, ARENA.intervaloMinS],
} as const;

const ticksDe = (segundos: number) => Math.round(segundos / ARENA.pasoS);
const campo = (e: EstadoArena, lado: Lado) => e.jugadores.filter(j => j.lado === lado && j.puesto !== "POR").sort((a, b) => a.id.localeCompare(b.id));
const deLinea = (e: EstadoArena, lado: Lado, linea: string) => campo(e, lado).filter(j => lineaDePuesto(j.puesto) === linea);
const portero = (e: EstadoArena, lado: Lado) => e.jugadores.find(j => j.lado === lado && j.puesto === "POR")!;
function colocar(j: JugadorArena, p: Punto, v: Punto = { x: 0, y: 0 }) { j.posicion = { ...p }; j.velocidad = { ...v }; }
const polar = (b: Punto, [d, a]: readonly [number, number]): Punto => ({ x: b.x - d * Math.cos(a), y: b.y + d * Math.sin(a) });
const coseno = (v: Punto, a: Punto, b: Punto) => { const dx = b.x - a.x, dy = b.y - a.y; return (v.x * dx + v.y * dy) / (Math.hypot(v.x, v.y) * Math.hypot(dx, dy)); };

type OrdenEscenario = { accion: OrdenJugador["accion"]; destino?: Punto; receptor?: string | null };
interface Escenario {
  motor: MotorArena; planes: Record<Lado, OrdenesEquipo>; config: ConfigArena;
  j(id: string): JugadorArena;
  ticks(n: number, cada?: (m: MotorArena) => void): void;
}
function montar(reglas: Reglas, preparar: (e: EstadoArena, config: ConfigArena) => void, ordenes: (e: EstadoArena) => Record<string, OrdenEscenario> = () => ({}), opciones: { seed?: number; parqueLocalX?: number; parqueVisitaX?: number } = {}): Escenario {
  const config: ConfigArena = { ...crearConfigArena({ seed: opciones.seed ?? ESCENARIO.semilla, duracionS: ESCENARIO.duracionS, intervaloS: ESCENARIO.intervaloS, local: ESCENARIO.local, visita: ESCENARIO.visita }) };
  config.partido = structuredClone(config.partido);
  if (reglas) config.reglas = reglas; else delete config.reglas;
  const inicial = crearEstadoArena(config);
  inicial.saque = null; inicial.pausa = null;
  for (const lado of lados) {
    const x = lado === "local" ? opciones.parqueLocalX ?? ESCENARIO.parqueLocalX : opciones.parqueVisitaX ?? ESCENARIO.parqueVisitaX;
    campo(inicial, lado).forEach((j, k) => colocar(j, { x, y: ESCENARIO.filaY0 + ESCENARIO.filaDY * k }));
    colocar(portero(inicial, lado), anclas(config.formaciones[lado], lado, "base").POR!);
  }
  preparar(inicial, config);
  const motor = new MotorArena(config, inicial);
  const o = ordenes(motor.estado);
  const planes = Object.fromEntries(lados.map(lado => [lado, { observacion: `escenario:${lado}`, lado, intencion: "Escenario de prueba", amplitud: "media", bloque: "medio", gestion: null,
    ordenes: motor.estado.jugadores.filter(j => j.lado === lado).map(j => ({ jugador: j.id, accion: o[j.id]?.accion ?? "mover", destino: o[j.id]?.destino ?? { ...j.posicion }, receptor: o[j.id]?.receptor ?? null }))
      .sort((a, b) => a.jugador.localeCompare(b.jugador)) } satisfies OrdenesEquipo])) as Record<Lado, OrdenesEquipo>;
  return {
    motor, planes, config,
    j: id => motor.estado.jugadores.find(j => j.id === id)!,
    ticks(n, cada) { for (let i = 0; i < n; i++) { motor.avanzar(planes, motor.estado.tick + 1); cada?.(motor); } },
  };
}
/** Fija una persecución activa a mano (también en versiones sin la clave, para la matriz de gating). */
const fijarPersecucion = (e: EstadoArena, jugador: JugadorArena, ticks: number = ESCENARIO.previaTicks): PersecucionArena => (e.persecucion = { jugador: jugador.id, lado: jugador.lado, desdeTick: e.tick, hastaTick: e.tick + ticks });

// ---------------------------------------------------------------------------------------------
// Escenarios
// ---------------------------------------------------------------------------------------------
/** A2/A3 · atacante local superado; perseguidor visitante (medio) a 3 m; cuatro DEF y otro MED dentro del
 * radio a distintas distancias; un DEF a 35 m. */
function escenarioRepliegue(reglas: Reglas, ordenes: (roles: Record<string, JugadorArena>) => Record<string, OrdenEscenario> = () => ({})) {
  const b = ESCENARIO.balonRepliegue, R = ESCENARIO.repliegue;
  const roles: Record<string, JugadorArena> = {};
  const s = montar(reglas, e => {
    const atacante = deLinea(e, "local", "MED")[0]!; colocar(atacante, b); roles.atacante = atacante;
    e.balon = { posicion: { ...b }, poseedor: atacante.id, vuelo: null };
    const def = deLinea(e, "visita", "DEF"), med = deLinea(e, "visita", "MED");
    const asignar = (nombre: keyof typeof R, j: JugadorArena) => { colocar(j, polar(b, R[nombre])); roles[nombre] = j; };
    asignar("perseguidor", med[0]!); asignar("def0", def[0]!); asignar("med1", med[1]!); asignar("def1", def[1]!); asignar("def2", def[2]!); asignar("def3", def[3]!); asignar("lejos", def[4]!);
  }, e => ordenes(Object.fromEntries(Object.entries(roles).map(([k, j]) => [k, e.jugadores.find(x => x.id === j.id)!]))));
  return { s, roles, b };
}
const seleccionados = ["def0", "med1", "def1", "def2"] as const;

/** A4 · duelo: portador local (nivel bajo) con un defensor visitante (nivel alto) a ≤ controlM. */
function escenarioDuelo(reglas: Reglas, seed: number, previa?: (e: EstadoArena) => void) {
  let portador = "", defensor = "";
  const s = montar(reglas, e => {
    const p = deLinea(e, "local", "MED")[0]!, d = deLinea(e, "visita", "DEF")[0]!;
    colocar(p, ESCENARIO.portador); colocar(d, { x: ESCENARIO.portador.x + ESCENARIO.defensorDx, y: ESCENARIO.portador.y });
    p.nivel = ESCENARIO.nivelBajo; d.nivel = ESCENARIO.nivelAlto; portador = p.id; defensor = d.id;
    e.balon = { posicion: { ...ESCENARIO.portador }, poseedor: p.id, vuelo: null };
    previa?.(e);
  }, () => ({}), { seed });
  return { s, portador, defensor };
}
/** Primera semilla cuyo duelo del primer paso cumple `cumple` (barrido; las semillas las busca la prueba). */
function semillaDuelo(cumple: (s: Escenario, defensor: string) => boolean, reglas: Reglas = V6): number {
  for (let seed = 1; seed <= ESCENARIO.semillaMax; seed++) {
    const { s, defensor } = escenarioDuelo(reglas, seed); s.ticks(1);
    if (cumple(s, defensor)) return seed;
  }
  throw new Error("Sin semilla de duelo en el barrido");
}
const roboSinFalta = (s: Escenario, defensor: string) => s.motor.eventos.some(e => e.tipo === "recuperacion" && e.jugador === defensor) && !s.motor.eventos.some(e => e.tipo === "falta");
const conFalta = (s: Escenario) => s.motor.eventos.some(e => e.tipo === "falta");

/** A4 · pase local hacia un compañero, con o sin un defensor visitante sobre la línea. */
function escenarioPase(reglas: Reglas, interceptor: boolean, previa?: (e: EstadoArena) => void) {
  let pasador = "", receptor = "", defensor = "";
  const s = montar(reglas, e => {
    const [p, r] = deLinea(e, "local", "MED"); colocar(p!, ESCENARIO.pasador); colocar(r!, ESCENARIO.receptor); pasador = p!.id; receptor = r!.id;
    if (interceptor) { const d = deLinea(e, "visita", "DEF")[0]!; colocar(d, ESCENARIO.interceptor); defensor = d.id; }
    e.balon = { posicion: { ...ESCENARIO.pasador }, poseedor: p!.id, vuelo: null };
    previa?.(e);
  }, e => ({ [pasador]: { accion: "pasar", receptor, destino: { ...e.jugadores.find(j => j.id === receptor)!.posicion } } }));
  return { s, pasador, receptor, defensor };
}
/** A4 · balón suelto (sin poseedor ni vuelo) junto a `quien`; último toque de `ultimo` (o ninguno). */
function escenarioSuelto(reglas: Reglas, o: { punto: Point; quien: (e: EstadoArena) => JugadorArena; ultimo?: (e: EstadoArena) => JugadorArena; previa?: (e: EstadoArena) => void }) {
  let quien = "", ultimo: string | undefined;
  const s = montar(reglas, e => {
    const q = o.quien(e); colocar(q, { x: o.punto.x + ESCENARIO.sueltoDx, y: o.punto.y }); quien = q.id;
    const u = o.ultimo?.(e); ultimo = u?.id;
    e.balon = { posicion: { ...o.punto }, poseedor: null, vuelo: null, ...(u ? { ultimoToque: { jugador: u.id, lado: u.lado } } : {}) };
    o.previa?.(e);
  });
  return { s, quien, ultimo };
}
type Point = Punto;

/** A6 · poseedor visitante que conduce hacia el campo local; `perdedor` local detrás con una persecución. */
function escenarioLimite(reglas: Reglas, o: { linea: "DEL" | "MED" | "DEF"; presionar?: boolean; perdedorEsOtro?: boolean; poseedor?: Punto; perseguidor?: Punto }) {
  let perdedor = "", poseedor = "";
  const s = montar(reglas, e => {
    const v = deLinea(e, "visita", "MED")[0]!, p = deLinea(e, "local", o.linea)[0]!;
    colocar(v, o.poseedor ?? ESCENARIO.limitePoseedor); colocar(p, o.perseguidor ?? ESCENARIO.limitePerseguidor);
    v.nivel = ESCENARIO.nivelAlto; p.nivel = ESCENARIO.nivelBajo; p.energia = ESCENARIO.energiaBaja;
    e.balon = { posicion: { ...v.posicion }, poseedor: v.id, vuelo: null };
    poseedor = v.id; perdedor = p.id;
    // El «otro» perdedor queda aparcado lejos: el que presiona no perdió el balón.
    fijarPersecucion(e, o.perdedorEsOtro ? campo(e, "local").find(j => j.id !== p.id)! : p, ticksDe(PE.maxS));
  }, () => (o.presionar ? { [perdedor]: { accion: "presionar" } } : {}), { parqueLocalX: ESCENARIO.parqueLejosX, parqueVisitaX: ESCENARIO.parqueLejosX });
  return { s, perdedor, poseedor };
}
/** Recorrido de x de un jugador y su mayor rapidez en `n` pasos. */
function recorrido(s: Escenario, id: string, n: number): { xs: number[]; vmax: number; balonXs: number[] } {
  const xs: number[] = [], balonXs: number[] = []; let vmax = 0;
  s.ticks(n, m => { const j = m.estado.jugadores.find(x => x.id === id); if (j) { xs.push(j.posicion.x); vmax = Math.max(vmax, Math.hypot(j.velocidad.x, j.velocidad.y)); } balonXs.push(m.estado.balon.posicion.x); });
  return { xs, vmax, balonXs };
}

/** A7 · perseguidor local (DEF) que corre en sentido contrario al balón; control fuera de los conjuntos. */
function escenarioFrenado(reglas: Reglas, conPersecucion = true) {
  let perseguidor = "", control = "";
  const s = montar(reglas, e => {
    const v = deLinea(e, "visita", "MED")[0]!; colocar(v, ESCENARIO.frenadoPoseedor);
    e.balon = { posicion: { ...ESCENARIO.frenadoPoseedor }, poseedor: v.id, vuelo: null };
    const [f, c] = deLinea(e, "local", "DEF");
    colocar(f!, ESCENARIO.frenadoPerseguidor, { x: ESCENARIO.velocidadContraria, y: 0 }); colocar(c!, ESCENARIO.frenadoControl, { x: ESCENARIO.velocidadContraria, y: 0 });
    perseguidor = f!.id; control = c!.id;
    if (conPersecucion) fijarPersecucion(e, f!, ticksDe(PE.maxS));
  }, () => ({ [control]: { accion: "mover", destino: { ...ESCENARIO.frenadoControlDestino } } }), { parqueLocalX: ESCENARIO.parqueLejosX, parqueVisitaX: ESCENARIO.parqueLejosX });
  return { s, perseguidor, control };
}
/** Ticks hasta que la componente x de la velocidad deja de ser positiva (o null). */
function ticksHastaParar(s: Escenario, id: string, max: number): number | null {
  for (let k = 1; k <= max; k++) { s.ticks(1); if (s.j(id).velocidad.x <= EPS) return k; }
  return null;
}

/** Duración de referencia (§ 6.3), independiente de persecucion.ts. */
function duracionReferencia(linea: "DEF" | "MED" | "DEL", agresividad: number, bloque: "bajo" | "medio" | "alto", energia: number): number {
  const s = PE.segundos[linea] * (PE.agresividadMin + PE.agresividadRango * agresividad / 100) * PE.bloque[bloque] * (PE.energiaMin + (1 - PE.energiaMin) * energia);
  return Math.min(PE.maxS, Math.max(PE.minS, s));
}

// ---------------------------------------------------------------------------------------------
describe("063 · bloque 0 · compatibilidad", () => {
  const leer = async (nombre: string) => JSON.parse(await readFile(`src/arena/__fixtures__/${nombre}.json`, "utf8")) as RegistroArena;

  it("0.1 · reglasArena y la predeterminada de la publicación 1; v1–v6 válidas, reinicios-v7 rechazada (mutación: olvidar el literal de la versión anterior)", () => {
    expect(reglasArena).toEqual(["reinicios-v1", "reinicios-v2", "reinicios-v3", "reinicios-v4", V5, V6]);
    expect(ARENA.reglas).toBe(V6);
    expect(crearConfigArena().reglas).toBe(V6);
    const base = crearConfigArena();
    for (const reglas of reglasArena) expect(() => validarConfigArena({ ...base, reglas })).not.toThrow();
    expect(() => validarConfigArena({ ...base, reglas: "reinicios-v7" as never })).toThrow("Reglas");
    for (const [i, reglas] of reglasArena.entries()) expect(reglasDesde({ ...base, reglas }, V6)).toBe(i >= 5);
    expect(L63.desdeA).toBe(V6);
  });

  it("0.2 · los fixtures v1–v5 se reproducen exactos y los torneos archivados validan (mutación: activar algo con v5 o conReinicios)", { timeout: 300_000 }, async () => {
    for (const v of ["v1", "v2", "v3", "v4", "v5"]) {
      const r = await leer(`arena-reinicios-${v}`);
      expect(r.config.reglas).toBe(`reinicios-${v}`);
      expect(reproducirArena(structuredClone(r))).toEqual(r);
    }
    expect(validarRaizTorneos("src/arena/__fixtures__/torneos").length).toBeGreaterThan(0);
    const DS = "src/arena/__fixtures__/torneos-sitio";
    for (const id of ["sitio-2026-10-20", "sitio-prueba-aaaaaa660000"]) {
      const t = validarTorneo(JSON.parse(readFileSync(join(DS, `${id}.torneo.json`), "utf8")), archivo => readFileSync(join(DS, `${id}.${archivo}`)));
      expect(t.encuentros.length).toBeGreaterThan(0);
    }
  });

  it("0.3 · matriz: repliegue, persecución, límite y frenado cambian solo con v6 (mutación: gating con la versión equivocada)", () => {
    const comportamientos: { nombre: string; medir: (r: Reglas) => boolean }[] = [
      { nombre: "repliegue", medir: r => { const { s, roles, b } = escenarioRepliegue(r); const j = roles.def0!, p0 = { ...j.posicion }; s.ticks(1); return coseno(s.j(j.id).velocidad, p0, destinoRepliegue(b, "visita")) > ESCENARIO.cosenoDireccion; } },
      { nombre: "persecución creada", medir: r => { const { s, ultimo } = escenarioSuelto(r, { punto: ESCENARIO.suelto, quien: e => deLinea(e, "visita", "DEF")[0]!, ultimo: e => deLinea(e, "local", "MED")[0]! }); s.ticks(1); return s.motor.estado.persecucion?.jugador === ultimo; } },
      { nombre: "límite del delantero", medir: r => { const { s, perdedor } = escenarioLimite(r, { linea: "DEL" }); const { xs } = recorrido(s, perdedor, ESCENARIO.limiteTicks); return Math.min(...xs) >= limiteXPersecucion({ puesto: s.j(perdedor).puesto }) - ESCENARIO.cotaPorDebajoM; } },
      { nombre: "frenado", medir: r => { const { s, perseguidor } = escenarioFrenado(r); const k = ticksHastaParar(s, perseguidor, ESCENARIO.ticksFrenado); return k !== null && k <= Math.ceil(ESCENARIO.velocidadContraria / PE.frenadoMps2 / ARENA.pasoS) + 1; } },
    ];
    for (const c of comportamientos) {
      expect({ nombre: c.nombre, v6: c.medir(V6) }).toEqual({ nombre: c.nombre, v6: true });
      for (const r of ANTERIORES) expect({ nombre: c.nombre, reglas: r ?? "ausente", cambia: c.medir(r) }).toEqual({ nombre: c.nombre, reglas: r ?? "ausente", cambia: false });
    }
  });

  it("0.4 · oráculo previo al refactor: opcionPase y evaluarPases(...)[0] dan exactamente los ids guardados (mutación: cambiar el orden, el filtro o la puntuación)", () => {
    const oraculo = JSON.parse(readFileSync("src/arena/__fixtures__/opcion-pase-063.json", "utf8")) as EntradaOraculo063[];
    const calculado: EntradaOraculo063[] = [];
    for (const { fixture, fotograma, registro, estado } of estadosOraculo()) for (const lado of lados) {
      const obs = observacionOraculo(registro, estado, lado);
      for (const j of estado.jugadores.filter(p => p.lado === lado && p.puesto !== "POR")) {
        const candidatos = evaluarPases(j, obs);
        for (let k = 1; k < candidatos.length; k++) expect(candidatos[k - 1]!.puntuacion).toBeGreaterThanOrEqual(candidatos[k]!.puntuacion);
        expect(candidatos[0]?.p.id ?? null).toBe(opcionPase(j, obs)?.id ?? null);
        calculado.push({ fixture, fotograma, jugador: j.id, opcion: opcionPase(j, obs)?.id ?? null });
      }
    }
    expect(calculado).toEqual(oraculo);
    expect(oraculo.some(e => e.opcion === null) && oraculo.some(e => e.opcion !== null)).toBe(true);
  });

  it("0.5 · v5 sin claves nuevas; v6 con `persecucion` siempre presente (null o válida, nunca undefined); atributos e identidad fuera de versión se rechazan (mutación: undefined en vez de null; claves fuera de versión)", async () => {
    const c5 = crearConfigArena({ reglas: V5 });
    expect(["atributos", "estilosJuego"].some(k => k in c5)).toBe(false);
    expect("persecucion" in crearEstadoArena(c5)).toBe(false);
    const r5 = await leer("arena-reinicios-v5");
    expect([r5.inicial, r5.final, ...r5.fotogramas].some(f => "persecucion" in f)).toBe(false);
    const c6 = crearConfigArena();
    expect(["atributos", "estilosJuego"].some(k => k in c6)).toBe(false);
    const inicial = crearEstadoArena(c6);
    expect(Object.hasOwn(inicial, "persecucion") && inicial.persecucion === null).toBe(true);
    expect(() => validarConfigArena({ ...c6, atributos: {} } as ConfigArena)).toThrow("Atributos fuera de su versión");
    expect(() => validarConfigArena({ ...c5, atributos: {} } as ConfigArena)).toThrow("Atributos fuera de su versión");
    expect(() => validarConfigArena({ ...c6, estilosJuego: { local: "presion", visita: "directo" } } as ConfigArena)).toThrow("Identidad de juego fuera de su versión");
    const registros = [await leer("arena-reinicios-v6"), ...await Promise.all(ESCENARIO.semillasEstado.map(seed => ejecutarArena(crearConfigArena({ seed, duracionS: ESCENARIO.duracionEstadoS }), { local: crearControladorProgramado(), visita: crearControladorProgramado() })))];
    let activas = 0;
    for (const r of registros) for (const f of [r.inicial, ...r.fotogramas, r.final]) {
      expect(Object.hasOwn(f, "persecucion")).toBe(true);
      expect(f.persecucion).not.toBeUndefined();
      const p = f.persecucion;
      if (p === null || p === undefined) continue;
      activas++;
      const presente = [...f.jugadores, ...(f.retirados ?? []), ...(f.expulsados ?? [])].find(j => j.id === p.jugador);
      expect({ presente: !!presente, lado: presente?.lado, enCancha: f.jugadores.some(j => j.id === p.jugador) || (f.retirados ?? []).some(j => j.id === p.jugador) }).toEqual({ presente: true, lado: p.lado, enCancha: true });
      expect(p.desdeTick <= f.tick && f.tick <= p.hastaTick).toBe(true);
      expect(Object.keys(p).sort()).toEqual(["desdeTick", "hastaTick", "jugador", "lado"]);
    }
    expect(activas).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------------
describe("063 · bloque A · persecución (reinicios-v6)", () => {
  it("A1 · superadoPor: más allá de todos los rivales de campo en ambos sentidos; el portero no cuenta; empate, manos o poseedor portero → null (mutación: contar al portero; >=)", () => {
    const e = crearEstadoArena(crearConfigArena({ seed: ESCENARIO.semilla, local: ESCENARIO.local, visita: ESCENARIO.visita }));
    e.saque = null; e.pausa = null;
    const local = campo(e, "local"), visita = campo(e, "visita"), a = local[0]!, v = visita[0]!;
    // Local con el balón a x = 80; los visitantes de campo detrás (x < 80); el portero visitante delante.
    for (const [k, j] of visita.entries()) colocar(j, { x: 40 + k, y: 10 + 4 * k });
    for (const [k, j] of local.entries()) colocar(j, { x: 30 + k, y: 10 + 4 * k });
    colocar(a, { x: 80, y: MEDIO_Y }); colocar(portero(e, "visita"), { x: 100, y: MEDIO_Y });
    e.balon = { posicion: { ...a.posicion }, poseedor: a.id, vuelo: null };
    expect(superadoPor(e)?.id).toBe(a.id);
    // Empate exacto en x orientada con un defensor de campo → null.
    colocar(visita[1]!, { x: 80, y: 10 }); expect(superadoPor(e)).toBeNull();
    colocar(visita[1]!, { x: 41, y: 14 });
    // Con el balón en las manos (aunque sea absurdo para un jugador de campo) → null.
    e.balon.manos = { portero: a.id, desdeTick: 0, hastaTick: 1 }; expect(superadoPor(e)).toBeNull(); delete e.balon.manos;
    // Sentido contrario: la visita ataca hacia x = 0; local de campo detrás (x > 25), portero local delante.
    colocar(v, { x: 25, y: MEDIO_Y }); for (const [k, j] of local.entries()) colocar(j, { x: 40 + k, y: 10 + 4 * k });
    colocar(portero(e, "local"), { x: 5, y: MEDIO_Y });
    e.balon = { posicion: { ...v.posicion }, poseedor: v.id, vuelo: null };
    expect(superadoPor(e)?.id).toBe(v.id);
    // El portero no cuenta: aunque esté detrás del poseedor (más cerca de su arco no; aquí, por delante).
    colocar(portero(e, "local"), { x: 30, y: MEDIO_Y }); expect(superadoPor(e)?.id).toBe(v.id);
    // Poseedor portero → null.
    e.balon = { posicion: { ...portero(e, "visita").posicion }, poseedor: portero(e, "visita").id, vuelo: null }; expect(superadoPor(e)).toBeNull();
    // Sin rivales de campo → null.
    e.balon = { posicion: { ...a.posicion }, poseedor: a.id, vuelo: null }; colocar(a, { x: 80, y: MEDIO_Y });
    e.jugadores = e.jugadores.filter(j => j.lado === "local" || j.puesto === "POR"); expect(superadoPor(e)).toBeNull();
  });

  it("A2 · repliegue: los `max` más cercanos sin el perseguidor, destino a adelantoM sobre la recta, se mueven hacia su arco; el de 35 m queda igual que en v5 (mutación: sin radio; sin máximo; destino al balón)", () => {
    const v6 = escenarioRepliegue(V6), v5 = escenarioRepliegue(V5);
    const { roles, b } = v6;
    expect(perseguidoresDe(v6.s.motor.estado.jugadores, b).visita).toBe(roles.perseguidor!.id);
    expect(seleccionRepliegue(v6.s.motor.estado, perseguidoresDe(v6.s.motor.estado.jugadores, b)).map(j => j.id)).toEqual(seleccionados.map(k => roles[k]!.id));
    expect(seleccionados.length).toBe(PE.repliegue.max);
    // Con solo dos candidatos dentro del radio, el DEF a 35 m (y los aparcados) siguen fuera.
    const pocos = structuredClone(v6.s.motor.estado);
    for (const k of ["def1", "def2", "def3"]) pocos.jugadores.find(j => j.id === roles[k]!.id)!.posicion = { x: ESCENARIO.parqueVisitaX, y: ARENA.anchoM - ESCENARIO.filaY0 };
    expect(seleccionRepliegue(pocos, perseguidoresDe(pocos.jugadores, b)).map(j => j.id)).toEqual([roles.def0!.id, roles.med1!.id]);
    // Destino puro: a adelantoM del balón hacia el centro del arco visitante.
    const destino = destinoRepliegue(b, "visita");
    expect(Math.hypot(destino.x - b.x, destino.y - b.y)).toBeCloseTo(PE.repliegue.adelantoM, 9);
    expect(destino.y).toBeCloseTo(MEDIO_Y, 9); expect(destino.x).toBeGreaterThan(b.x);
    expect(destinoRepliegue({ x: ARENA.largoM - 1, y: MEDIO_Y }, "visita")).toEqual({ x: ARENA.largoM, y: MEDIO_Y });
    const inicio = Object.fromEntries(Object.entries(roles).map(([k, j]) => [k, { ...j.posicion }]));
    v6.s.ticks(1);
    for (const k of seleccionados) expect({ k, cos: coseno(v6.s.j(roles[k]!.id).velocidad, inicio[k]!, destino) > ESCENARIO.cosenoDireccion }).toEqual({ k, cos: true });
    v6.s.ticks(ticksDe(1) - 1); v5.s.ticks(ticksDe(1));
    for (const k of seleccionados) {
      expect({ k, v6: v6.s.j(roles[k]!.id).posicion.x - inicio[k]!.x >= ESCENARIO.avanceMinM }).toEqual({ k, v6: true });
      expect({ k, v5: Math.abs(v5.s.j(roles[k]!.id).posicion.x - inicio[k]!.x) < ARENA.toleranciaM }).toEqual({ k, v5: true });
    }
    for (const k of ["lejos", "def3"]) expect(v6.s.j(roles[k]!.id).posicion).toEqual(v5.s.j(roles[k]!.id).posicion);
  });

  it("A3 · presionar gana al repliegue; mover y cubrir no lo impiden (mutación: orden que anula la regla)", () => {
    const lejano = { x: 30, y: 60 };
    const { s, roles, b } = escenarioRepliegue(V6, r => ({ [r.def0!.id]: { accion: "presionar" }, [r.def1!.id]: { accion: "cubrir", destino: lejano }, [r.med1!.id]: { accion: "mover", destino: lejano } }));
    const inicio = Object.fromEntries(Object.entries(roles).map(([k, j]) => [k, { ...j.posicion }]));
    s.ticks(1);
    expect(coseno(s.j(roles.def0!.id).velocidad, inicio.def0!, b)).toBeGreaterThan(ESCENARIO.cosenoDireccion);
    for (const k of ["def1", "med1"]) expect({ k, cos: coseno(s.j(roles[k]!.id).velocidad, inicio[k]!, destinoRepliegue(b, "visita")) > ESCENARIO.cosenoDireccion }).toEqual({ k, cos: true });
  });

  it("A4 · creación (duelo, intercepción, balón suelto) y lista cerrada de cancelaciones sobre una persecución previa activa, con los tres finales de la v1.2 (mutación: perdedor equivocado; no borrar)", () => {
    const tickEsperado = (s: Escenario, jugador: string, desde: number) => {
      const j = s.j(jugador), linea = lineaDePuesto(j.puesto) as "DEF" | "MED" | "DEL";
      return desde + Math.round(duracionReferencia(linea, j.personalidad?.agresividad ?? 50, s.motor.estado.entrenadores!.local.plan.bloque, j.energia) / ARENA.pasoS);
    };
    // Robo en duelo: el perdedor es el portador.
    const seedRobo = semillaDuelo(roboSinFalta);
    const duelo = escenarioDuelo(V6, seedRobo); duelo.s.ticks(1);
    expect(duelo.s.motor.estado.persecucion).toEqual({ jugador: duelo.portador, lado: "local", desdeTick: 1, hastaTick: tickEsperado(duelo.s, duelo.portador, 1) });
    // Final 18.1 (2): la visita perseguía y roba a un jugador de campo local → nueva persecución del local.
    const previaVisita = (e: EstadoArena) => { fijarPersecucion(e, deLinea(e, "visita", "MED")[0]!); };
    const duelo2 = escenarioDuelo(V6, seedRobo, previaVisita); duelo2.s.ticks(1);
    expect(duelo2.s.motor.estado.persecucion?.jugador).toBe(duelo2.portador);
    // Intercepción: el perdedor es el autor del pase (y sobre una persecución previa de la visita).
    for (const previa of [undefined, previaVisita]) {
      const pase = escenarioPase(V6, true, previa);
      for (let k = 0; k < ticksDe(3) && !pase.s.motor.eventos.some(e => e.tipo === "intercepcion"); k++) pase.s.ticks(1);
      const ev = pase.s.motor.eventos.find(e => e.tipo === "intercepcion")!;
      expect({ jugador: ev.jugador, receptor: ev.receptor }).toEqual({ jugador: pase.defensor, receptor: pase.pasador });
      expect(pase.s.motor.estado.persecucion).toMatchObject({ jugador: pase.pasador, lado: "local", desdeTick: ev.tick });
    }
    // Balón suelto: el perdedor es el último toque rival.
    const suelto = escenarioSuelto(V6, { punto: ESCENARIO.suelto, quien: e => deLinea(e, "visita", "DEF")[0]!, ultimo: e => deLinea(e, "local", "MED")[0]! });
    suelto.s.ticks(1);
    expect(suelto.s.motor.eventos.at(-1)).toMatchObject({ tipo: "recuperacion", jugador: suelto.quien });
    expect(suelto.s.motor.estado.persecucion?.jugador).toBe(suelto.ultimo);
    // Final 18.1 (3): la visita perseguía y recoge un balón suelto sin perdedor local → null.
    const sinPerdedor = escenarioSuelto(V6, { punto: ESCENARIO.suelto, quien: e => deLinea(e, "visita", "DEF")[0]!, ultimo: e => deLinea(e, "visita", "MED")[1]!, previa: previaVisita });
    sinPerdedor.s.ticks(1);
    expect(sinPerdedor.s.motor.eventos.at(-1)).toMatchObject({ tipo: "recuperacion", jugador: sinPerdedor.quien });
    expect(sinPerdedor.s.motor.estado.persecucion).toBeNull();
    // Perdedor portero: sin persecución.
    const desdePortero = escenarioSuelto(V6, { punto: ESCENARIO.suelto, quien: e => deLinea(e, "visita", "DEF")[0]!, ultimo: e => portero(e, "local") });
    desdePortero.s.ticks(1); expect(desdePortero.s.motor.estado.persecucion).toBeNull();
    // Portero que recibe en su área, de cualquier lado, sobre una persecución previa del OTRO lado → null.
    const previaLocal = (e: EstadoArena) => { fijarPersecucion(e, deLinea(e, "local", "DEL")[0]!); };
    for (const [punto, lado, previa] of [[ESCENARIO.sueltoArea, "visita", previaLocal], [ESCENARIO.sueltoAreaLocal, "local", previaVisita]] as const) {
      const otro = lado === "visita" ? "local" : "visita";
      const k = escenarioSuelto(V6, { punto: { x: punto.x - ESCENARIO.sueltoDx, y: punto.y }, quien: e => portero(e, lado), ultimo: e => deLinea(e, otro, "MED")[0]!, previa });
      expect(k.s.motor.estado.persecucion?.lado).toBe(otro);
      k.s.ticks(1);
      expect(k.s.motor.eventos.at(-1)).toMatchObject({ tipo: "recuperacion", jugador: k.quien });
      expect(k.s.motor.estado.persecucion).toBeNull();
    }
    // Reinicio (saque de banda): un pase local que sale por la banda con una persecución previa → null.
    const banda = montar(V6, e => {
      const p = deLinea(e, "local", "MED")[0]!; colocar(p, { x: 40, y: 60 });
      const vuelo: Vuelo = { tipo: "pase", autor: p.id, lado: "local", receptor: null, origen: { ...ESCENARIO.bandaOrigen }, destino: { ...ESCENARIO.bandaDestino }, inicioTick: 0, adelantados: [] };
      e.balon = { posicion: { ...ESCENARIO.bandaOrigen }, poseedor: null, ultimoToque: { jugador: p.id, lado: "local" }, vuelo };
      previaVisita(e);
    });
    for (let k = 0; k < ticksDe(1) && !banda.motor.eventos.some(e => e.tipo === "reinicio"); k++) banda.ticks(1);
    expect(banda.motor.eventos.find(e => e.tipo === "reinicio")?.reinicio).toBe("banda");
    expect(banda.motor.estado.persecucion).toBeNull();
    // Reinicio por fuera de juego (reiniciar): pase al receptor adelantado con una persecución previa → null.
    const fuera = escenarioPase(V6, false, previaVisita);
    for (let k = 0; k < ticksDe(3) && !fuera.s.motor.eventos.some(e => e.tipo === "fuera_juego"); k++) fuera.s.ticks(1);
    expect(fuera.s.motor.eventos.some(e => e.tipo === "fuera_juego")).toBe(true);
    expect(fuera.s.motor.estado.persecucion).toBeNull();
    // Falta en el duelo con una persecución previa → null.
    const seedFalta = semillaDuelo(conFalta);
    const falta = escenarioDuelo(V6, seedFalta, previaVisita);
    expect(falta.s.motor.estado.persecucion).not.toBeNull();
    falta.s.ticks(1);
    expect(falta.s.motor.eventos.some(e => e.tipo === "falta")).toBe(true);
    expect(falta.s.motor.estado.persecucion).toBeNull();
    // Vencimiento: al empezar el paso del tick hastaTick.
    const vence = montar(V6, e => { const p = deLinea(e, "local", "MED")[0]!; colocar(p, ESCENARIO.portador); e.balon = { posicion: { ...ESCENARIO.portador }, poseedor: p.id, vuelo: null }; fijarPersecucion(e, deLinea(e, "visita", "MED")[0]!, 2); });
    vence.ticks(2); expect(vence.motor.estado.persecucion).not.toBeNull();
    vence.ticks(1); expect(vence.motor.estado.persecucion).toBeNull();
  });

  it("A5 · duración: monótona en agresividad, energía y bloque, acotada, y hastaTick con la fórmula (mutación: ignorar un factor)", () => {
    const j = (puesto: string, agresividad: number, energia: number) => ({ puesto, energia, personalidad: { agresividad } as JugadorArena["personalidad"] });
    for (const [puesto, linea] of [["DC", "DEL"], ["PIV", "MED"], ["DFC_I", "DEF"]] as const) {
      for (const bloque of ["bajo", "medio", "alto"] as const) for (const agresividad of [0, 37, 100]) for (const energia of [ARENA.energiaMin, 0.7, 1])
        expect(duracionPersecucionS(j(puesto, agresividad, energia), bloque)).toBeCloseTo(duracionReferencia(linea, agresividad, bloque, energia), 12);
      expect(duracionPersecucionS(j(puesto, 30, 0.8), "medio")).toBeLessThan(duracionPersecucionS(j(puesto, 70, 0.8), "medio"));
      expect(duracionPersecucionS(j(puesto, 50, 0.6), "medio")).toBeLessThan(duracionPersecucionS(j(puesto, 50, 0.9), "medio"));
      expect(duracionPersecucionS(j(puesto, 50, 0.8), "bajo")).toBeLessThan(duracionPersecucionS(j(puesto, 50, 0.8), "medio"));
      expect(duracionPersecucionS(j(puesto, 50, 0.8), "medio")).toBeLessThan(duracionPersecucionS(j(puesto, 50, 0.8), "alto"));
    }
    expect(duracionPersecucionS({ puesto: "DFC_I", energia: 1, personalidad: { agresividad: 100 } as JugadorArena["personalidad"] }, "alto")).toBe(PE.maxS);
    expect(duracionPersecucionS({ puesto: "DC", energia: ARENA.energiaMin, personalidad: { agresividad: 0 } as JugadorArena["personalidad"] }, "bajo")).toBe(PE.minS);
    expect(duracionPersecucionS({ puesto: "PIV", energia: 1 })).toBeCloseTo(duracionReferencia("MED", 50, "medio", 1), 12);
    expect(hastaTickPersecucion(10, 2.34)).toBe(10 + Math.round(2.34 / ARENA.pasoS));
  });

  it("A6 · límite por línea: delantero en la mitad, medio en su tercio, defensa sin límite; también con presionar y dentro del repliegue; un presionador que no perdió el balón no se limita (mutación: sin límite; solo en la rama de persecución; a quien no perdió el balón)", () => {
    const margen = (vmax: number) => vmax ** 2 / (2 * PE.frenadoMps2) + ARENA.toleranciaM;
    // Delantero perdedor (con y sin orden presionar, siendo el más cercano): nunca baja del límite menos el margen.
    for (const presionar of [false, true]) {
      const { s, perdedor } = escenarioLimite(V6, { linea: "DEL", presionar });
      const limite = limiteXPersecucion({ puesto: s.j(perdedor).puesto });
      expect(limite).toBe(PE.limiteFraccion.DEL * ARENA.largoM);
      const { xs, vmax, balonXs } = recorrido(s, perdedor, ESCENARIO.limiteTicks);
      expect({ presionar, respeta: Math.min(...xs) >= limite - margen(vmax) }).toEqual({ presionar, respeta: true });
      expect({ presionar, llega: Math.min(...xs) <= limite + ESCENARIO.cotaPorDebajoM, balonPasa: Math.min(...balonXs) < limite - ESCENARIO.cotaPorDebajoM }).toEqual({ presionar, llega: true, balonPasa: true });
    }
    // Destino puro: un delantero con el balón en su campo se queda en la mitad, a la altura y del balón.
    expect(destinoPersecucion({ x: 20, y: 50 }, { puesto: "DC", lado: "local" })).toEqual({ x: PE.limiteFraccion.DEL * ARENA.largoM, y: 50 });
    expect(destinoPersecucion({ x: 90, y: 50 }, { puesto: "DC", lado: "visita" })).toEqual({ x: ARENA.largoM - PE.limiteFraccion.DEL * ARENA.largoM, y: 50 });
    expect(limitarPersecucion({ x: 10, y: 5 }, { puesto: "DFC_I", lado: "local" })).toEqual({ x: 10, y: 5 });
    // Medio perdedor: su límite; defensa perdedor: sin límite (llega más abajo que el límite del medio).
    const medio = escenarioLimite(V6, { linea: "MED", poseedor: ESCENARIO.limiteMedio, perseguidor: ESCENARIO.limitePerseguidorMedio });
    const limiteMedio = limiteXPersecucion({ puesto: medio.s.j(medio.perdedor).puesto });
    expect(limiteMedio).toBe(PE.limiteFraccion.MED * ARENA.largoM);
    const rm = recorrido(medio.s, medio.perdedor, ESCENARIO.limiteTicks);
    expect(Math.min(...rm.xs)).toBeGreaterThanOrEqual(limiteMedio - margen(rm.vmax));
    const defensa = escenarioLimite(V6, { linea: "DEF", poseedor: ESCENARIO.limiteMedio, perseguidor: ESCENARIO.limitePerseguidorMedio });
    expect(limiteXPersecucion({ puesto: defensa.s.j(defensa.perdedor).puesto })).toBe(0);
    expect(Math.min(...recorrido(defensa.s, defensa.perdedor, ESCENARIO.limiteTicks).xs)).toBeLessThan(limiteMedio - ESCENARIO.cotaPorDebajoM);
    // Presionador que no perdió el balón: sin límite (sigue al balón por debajo de la mitad).
    const otro = escenarioLimite(V6, { linea: "DEL", presionar: true, perdedorEsOtro: true });
    expect(Math.min(...recorrido(otro.s, otro.perdedor, ESCENARIO.limiteTicks).xs)).toBeLessThan(PE.limiteFraccion.DEL * ARENA.largoM - ESCENARIO.cotaPorDebajoM);
    // Medio perdedor dentro del repliegue: el destino del repliegue también se acota a su límite.
    const MR = ESCENARIO.medioRepliegue;
    const repliegue = (conPersecucion: boolean) => {
      let medioId = "";
      const s = montar(V6, e => {
        const v = deLinea(e, "visita", "MED")[0]!; colocar(v, MR.balon); e.balon = { posicion: { ...MR.balon }, poseedor: v.id, vuelo: null };
        const m = deLinea(e, "local", "MED")[0]!; colocar(m, MR.medio); medioId = m.id;
        colocar(deLinea(e, "local", "DEL")[0]!, MR.cercano);
        if (conPersecucion) fijarPersecucion(e, m);
      }, () => ({}), { parqueLocalX: ESCENARIO.parqueLejosX, parqueVisitaX: ESCENARIO.parqueLejosX });
      expect(seleccionRepliegue(s.motor.estado, perseguidoresDe(s.motor.estado.jugadores, MR.balon)).map(j => j.id)).toContain(medioId);
      s.ticks(1);
      return s.j(medioId).velocidad;
    };
    const libre = destinoRepliegue(MR.balon, "local"), acotado = limitarPersecucion(libre, { puesto: "PIV", lado: "local" });
    expect(acotado.x).toBeGreaterThan(libre.x);
    expect(coseno(repliegue(true), MR.medio, acotado)).toBeGreaterThan(ESCENARIO.cosenoDireccion);
    expect(coseno(repliegue(false), MR.medio, libre)).toBeGreaterThan(ESCENARIO.cosenoDireccion);
  });

  it("A7 · frenado: un perseguidor que corre en sentido contrario se detiene en ≤ ⌈v/frenadoMps2/pasoS⌉ + 1 ticks; fuera de los conjuntos, 3 m/s² como en v5 (mutación: frenado para todos)", () => {
    const limite = Math.ceil(ESCENARIO.velocidadContraria / PE.frenadoMps2 / ARENA.pasoS) + 1;
    const f6 = escenarioFrenado(V6);
    expect(ticksHastaParar(f6.s, f6.perseguidor, ESCENARIO.ticksFrenado)).toBeLessThanOrEqual(limite);
    // Control: misma física que v5, con cambios de velocidad ≤ aceleracionMps2·pasoS por paso.
    const c6 = escenarioFrenado(V6), c5 = escenarioFrenado(V5, false);
    let previa = { ...c6.s.j(c6.control).velocidad };
    for (let k = 0; k < ESCENARIO.ticksFrenado; k++) {
      c6.s.ticks(1); c5.s.ticks(1);
      const v = c6.s.j(c6.control).velocidad;
      expect(Math.hypot(v.x - previa.x, v.y - previa.y)).toBeLessThanOrEqual(ARENA.aceleracionMps2 * ARENA.pasoS + EPS);
      expect(c6.s.j(c6.control).posicion).toEqual(c5.s.j(c5.control).posicion);
      previa = { ...v };
    }
    expect(Math.ceil(ESCENARIO.velocidadContraria / ARENA.aceleracionMps2 / ARENA.pasoS)).toBeGreaterThan(limite);
  });

  it("A8 · frasesPersecucion() con constantes alteradas; SISTEMA_ARENA la incluye (mutación: cifras a mano)", () => {
    const alterada = frasesPersecucion({ max: 7, radioM: 41, minS: 2.5, maxS: 9.5 });
    for (const t of ["hasta 7 ", "≤ 41 m", "entre 2.5 y 9.5 s"]) expect(alterada).toContain(t);
    const real = frasesPersecucion();
    for (const t of [`hasta ${PE.repliegue.max} `, `≤ ${PE.repliegue.radioM} m`, `entre ${PE.minS} y ${PE.maxS} s`]) expect(real).toContain(t);
    expect(SISTEMA_ARENA).toContain(real);
  });

  it("A9 · lote rápido v6: bandas `rapido` del 046, del 051 (y su controlado de porteros) y del bloque A", { timeout: 300_000 }, async () => {
    const lote = { desde: L.rapido.semillaDesde, semillas: L.rapido.semillas, reglas: V6 };
    const m = await medirLote(lote);
    const { b046, b051, b063 } = bandasLote(V6, "rapido");
    console.log("[063 v6 rápido]", JSON.stringify({ goles: m.golesPorPartido, a: m.persecucion063 }));
    expect(m.partidos).toBe(L.rapido.semillas);
    expect(incumplimientos(m, b046, b051)).toEqual([]);
    expect(b063).toBe(L63.rapido);
    expect(incumplimientos063(m, b063!)).toEqual([]);
    expect(bandasLote(V5, "rapido").b063).toBeNull();
    const porteros = await medirControlado({ ...lote, quien: "portero" });
    expect(incumplimientosControlado({ porteros: porteros.diferencia }, L51.rapido)).toEqual([]);
  });

  it("A10 · fixture v6 (45 s) con persecución y repliegue, reproducción exacta y tamaño: cota pura ≤ crecimientoMaxBytes y registros reales de 180 s", { timeout: 300_000 }, async () => {
    const r = JSON.parse(await readFile("src/arena/__fixtures__/arena-reinicios-v6.json", "utf8")) as RegistroArena;
    expect(r.config.duracionS).toBe(DURACION_FIXTURE_V6_S);
    expect(condicionesFixtureV6(r)).toEqual({ reglas: true, persecucion: true, repliegue: true });
    expect(cumpleFixtureV6(r)).toBe(true);
    expect(r.rondas.flatMap(x => Object.values(x.decisiones)).every(d => d.tiempoMs === 0)).toBe(true);
    expect(reproducirArena(structuredClone(r))).toEqual(r);
    // Cota pura (v1.2 § 18.4): la clave `persecucion` con el id más largo y los ticks mayores en un
    // fotograma por tick, más inicial y final. Los atributos y los `motivo` nuevos llegan con reinicios-v7.
    const idMasLargo = `visita-${ARENA.plantillaArena - 1}`, tickMax = Math.round(ARENA.duracionMaxS / ARENA.pasoS) + Math.round(PE.maxS / ARENA.pasoS);
    const clave = JSON.stringify({ persecucion: { jugador: idMasLargo, lado: "visita", desdeTick: tickMax, hastaTick: tickMax } }).length - 2 + 1;
    const fotogramas = Math.round(ARENA.duracionMaxS / ARENA.pasoS) + 1;
    const cota = clave * fotogramas + 2 * clave;
    console.log("[063 A10 cota]", JSON.stringify({ clave, fotogramas, cota, maximo: L63.crecimientoMaxBytes }));
    expect(cota).toBeLessThanOrEqual(L63.crecimientoMaxBytes);
    let mayor = 0;
    for (const seed of ESCENARIO.semillasTamano) for (const intervaloS of ESCENARIO.intervalosTamano) {
      const tam = async (reglas: ReglasArena) => Buffer.byteLength(JSON.stringify(await ejecutarArena(crearConfigArena({ seed, duracionS: ARENA.duracionMaxS, intervaloS, reglas }), { local: crearControladorProgramado(), visita: crearControladorProgramado() })));
      const b6 = await tam(V6), b5 = await tam(V5);
      mayor = Math.max(mayor, b6);
      expect({ seed, intervaloS, dentroDeCota: b6 < b5 + cota, menorQueMaximo: b6 < ARENA.archivoMaxBytes }).toEqual({ seed, intervaloS, dentroDeCota: true, menorQueMaximo: true });
    }
    console.log("[063 A10 tamaño]", JSON.stringify({ mayorBytes: mayor, archivoMaxBytes: ARENA.archivoMaxBytes }));
  });
});
