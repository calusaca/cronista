// Brief 063 · publicaciones 1 (bloques 0 y A, reglas reinicios-v6) y 2 (bloques B y C, reinicios-v7): compatibilidad, repliegue de emergencia,
// persecución tras pérdida y su frenado, con gating por versión. Las cifras salen de limites.ts
// (PERSECUCION_ARENA, LOTE_ARENA_063, LOTE_ARENA_046/051, ARENA); los valores propios de cada escenario se
// nombran como tales en ESCENARIO. Cada prueba nombra la mutación que la pone en rojo.
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { isDeepStrictEqual as isDeepEqual } from "node:util";
import { ARENA, ATAQUE_ARENA as A46, ATRIBUTOS_ARENA as AT, ESTILO_JUEGO_ARENA as EJ, LARGO_ARENA as LA, LOTE_ARENA_046 as L, LOTE_ARENA_051 as L51, LOTE_ARENA_063 as L63, PERSECUCION_ARENA as PE, REMATE_ARENA as RM, REMATE_ARENA_V9 as RM9, TECNICA_ARENA as T, TORNEO_ARENA, TORNEO_SITIO } from "../../sim/limites";
import { prngDerivado } from "../../sim/prng";
import type { Llm } from "../../lib/llm";
import { ajusteDuelo, atributosDe, efectoAtributo, estiloJuegoDe, factorAceleracion, factorDesgaste, factorErrorPase, factorPotencia, factorVelocidadMax, lineaDePuesto } from "../atributos";
import { compatibilidadPuesto } from "../alineacion";
import { anclas, transformar } from "../catalogo";
import { contextoCompetitivo } from "../competencia";
import { esquemaRespuestaArena, evaluarPases, frasesAtributos, frasesFueraDeJuego, frasesIdentidad, frasesTiroLibre, frasesLargo, frasesPersecucion, opcionPase, planProgramado, SISTEMA_ARENA, crearControladorProgramado, validarOrdenes } from "../controladores";
import { ejecutarArena, observarArena, reproducirArena } from "../coordinador";
import { capacidadEfectiva } from "../entorno";
import { varianteVoz } from "../expresion";
import { condicionesFixtureV7, cumpleFixtureV7, DURACION_FIXTURE_V7_S } from "../__fixtures__/generar-reinicios-v7";
import { condicionesFixtureV8, cumpleFixtureV8, DURACION_FIXTURE_V8_S } from "../__fixtures__/generar-reinicios-v8";
import { condicionesFixtureV9, cumpleFixtureV9, DURACION_FIXTURE_V9_S } from "../__fixtures__/generar-reinicios-v9";
import { distancia } from "../geometria";
import { alcanceLargo, altoLejano, destinoTrayectoria, errorExtraLargo, factorErrorLejano, lejosRemate, opcionPaseLargo, probabilidadLejano, puedeRematarLejos } from "../largo";
import { narrarArena } from "../narrador";
import { personalidadDe } from "../personalidades";
import { RELATO_INTERVALOS } from "../protocolo";
import { construirRelato } from "../relato";
import { errorRemate, objetivoRemate, potenciaRemate, probabilidadAlto, REMATE_NEUTRO } from "../remate";
import { RUTA_ENTRADAS_SITIO } from "../torneo-entradas-cli";
import { estimarFormato, tipicoPartidoMaxMicroUsd, type EntradasSitio } from "../torneo-formatos";
import { narrarEventoArena } from "../vista";
import type { Lado } from "../../sim/tipos";
import { estadosOraculo, observacionOraculo, type EntradaOraculo063 } from "../__fixtures__/generar-opcion-pase-063";
import { condicionesFixtureV6, cumpleFixtureV6, DURACION_FIXTURE_V6_S } from "../__fixtures__/generar-reinicios-v6";
import { analizarPartido, bandasLote, cierreDeRemate, incumplimientos, incumplimientos063, incumplimientosBC, incumplimientosControlado, medirControlado, medirLote, muestrasPartido } from "../metricas-lote";
import { atributosPlantillas, crearConfigArena, crearEstadoArena, estilosPartido, MotorArena, reglasDesde, validarConfigArena } from "../motor";
import { apoyoPersecucion, destinoPersecucion, destinoRepliegue, duracionPersecucionS, hastaTickPersecucion, limitarPersecucion, limiteXPersecucion, perseguidoresDe, seleccionRepliegue, superadoPor } from "../persecucion";
import { validarRaizTorneos, validarTorneo } from "../torneo-validacion";
import { atributosJugador, estilosJuego, lados, reglasArena, type AtributoJugador, type EstiloJuego, type AtributosJugador, type ConfigArena, type ControladorEquipo, type EstadoArena, type FormacionArena, type JugadorArena, type OrdenesEquipo, type OrdenJugador, type PersecucionArena, type Punto, type RegistroArena, type ReglasArena, type Vuelo } from "../tipos";

const V8 = "reinicios-v8" as const, V7 = "reinicios-v7" as const, V6 = "reinicios-v6" as const, V5 = "reinicios-v5" as const;
/** Brief 065: ARENA.reglas es reinicios-v9 (REMATE_ARENA_V9); v8 pasa a literal. */
const V9 = "reinicios-v9" as const;
/** Brief 068: ARENA.reglas es reinicios-v10 (fuera de juego del pasador y FALTAS_ARENA_V10); v9 pasa a literal. */
const V10 = "reinicios-v10" as const;
/** Brief 070: ARENA.reglas es reinicios-v11 (tiro libre y penal); v10 pasa a literal. */
const V11 = "reinicios-v11" as const;
/** § 4.3: la configuración `base` con otras reglas; desde reinicios-v7, con sus atributos, y desde reinicios-v8, con la
 * identidad de juego. */
const conReglas = (base: ConfigArena, reglas: ReglasArena): ConfigArena => {
  const { atributos: _a, estilosJuego: _e, ...resto } = base, c: ConfigArena = { ...resto, reglas };
  if (reglasDesde(c, V7)) c.atributos = atributosPlantillas(base.partido);
  if (reglasDesde(c, V8)) c.estilosJuego = estilosPartido(base.partido);
  return c;
};
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
  // § 4.3: la configuración se crea con sus reglas (desde reinicios-v7 lleva atributos; antes, no).
  const config: ConfigArena = { ...crearConfigArena({ seed: opciones.seed ?? ESCENARIO.semilla, duracionS: ESCENARIO.duracionS, intervaloS: ESCENARIO.intervaloS, local: ESCENARIO.local, visita: ESCENARIO.visita, reglas: reglas ?? V5 }) };
  config.partido = structuredClone(config.partido);
  if (!reglas) delete config.reglas;
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
/** Brief 063 § 9.2 · fuerza la identidad de juego de un lado (solo existe desde reinicios-v8; antes no hace nada). */
const conEstilo = (c: ConfigArena, lado: Lado, estilo: EstiloJuego) => { if (c.estilosJuego) c.estilosJuego[lado] = estilo; };
/** Fija una persecución activa a mano (también en versiones sin la clave, para la matriz de gating). */
const fijarPersecucion = (e: EstadoArena, jugador: JugadorArena, ticks: number = ESCENARIO.previaTicks): PersecucionArena => (e.persecucion = { jugador: jugador.id, lado: jugador.lado, desdeTick: e.tick, hastaTick: e.tick + ticks });

// ---------------------------------------------------------------------------------------------
// Escenarios
// ---------------------------------------------------------------------------------------------
/** A2/A3 · atacante local superado; perseguidor visitante (medio) a 3 m; cuatro DEF y otro MED dentro del
 * radio a distintas distancias; un DEF a 35 m. */
function escenarioRepliegue(reglas: Reglas, ordenes: (roles: Record<string, JugadorArena>) => Record<string, OrdenEscenario> = () => ({}), estiloVisita?: EstiloJuego) {
  const b = ESCENARIO.balonRepliegue, R = ESCENARIO.repliegue;
  const roles: Record<string, JugadorArena> = {};
  const s = montar(reglas, (e, c) => {
    if (estiloVisita) conEstilo(c, "visita", estiloVisita);
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
function duracionReferencia(linea: "DEF" | "MED" | "DEL", agresividad: number, bloque: "bajo" | "medio" | "alto", energia: number, factorIdentidad = 1): number {
  const s = PE.segundos[linea] * (PE.agresividadMin + PE.agresividadRango * agresividad / 100) * factorIdentidad * PE.bloque[bloque] * (PE.energiaMin + (1 - PE.energiaMin) * energia);
  return Math.min(PE.maxS, Math.max(PE.minS, s));
}

// ---------------------------------------------------------------------------------------------
describe("063 · bloque 0 · compatibilidad", () => {
  const leer = async (nombre: string) => JSON.parse(await readFile(`src/arena/__fixtures__/${nombre}.json`, "utf8")) as RegistroArena;

  it("0.1 · reglasArena y la predeterminada (brief 070: reinicios-v11); v1–v11 válidas (v7 con sus atributos, v8–v11 además con su identidad), reinicios-v12 rechazada (mutación: olvidar el literal de la versión anterior)", () => {
    expect(reglasArena).toEqual(["reinicios-v1", "reinicios-v2", "reinicios-v3", "reinicios-v4", V5, V6, V7, V8, V9, V10, V11]);
    expect(ARENA.reglas).toBe(V11);
    expect(crearConfigArena().reglas).toBe(V11);
    const base = crearConfigArena({ reglas: V6 });
    for (const reglas of reglasArena) expect(() => validarConfigArena(conReglas(base, reglas))).not.toThrow();
    expect(() => validarConfigArena({ ...base, reglas: "reinicios-v12" as never })).toThrow("Reglas");
    for (const [i, reglas] of reglasArena.entries()) {
      expect(reglasDesde({ ...base, reglas }, V6)).toBe(i >= 5);
      expect(reglasDesde({ ...base, reglas }, V7)).toBe(i >= 6);
      expect(reglasDesde({ ...base, reglas }, V8)).toBe(i >= 7);
      expect(reglasDesde({ ...base, reglas }, V9)).toBe(i >= 8);
      expect(reglasDesde({ ...base, reglas }, V10)).toBe(i >= 9);
      expect(reglasDesde({ ...base, reglas }, V11)).toBe(i >= 10);
    }
    expect(RM9.desde).toBe(V9);
    expect(L63.desdeA).toBe(V6);
    expect(L63.desdeBC).toBe(V7);
    expect(L63.desdeD).toBe(V8);
    expect(L63.recalibracion046.desde).toBe(V7);
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
    const c6 = crearConfigArena({ reglas: V6 });
    expect(["atributos", "estilosJuego"].some(k => k in c6)).toBe(false);
    const inicial = crearEstadoArena(c6);
    expect(Object.hasOwn(inicial, "persecucion") && inicial.persecucion === null).toBe(true);
    expect(() => validarConfigArena({ ...c6, atributos: {} } as ConfigArena)).toThrow("Atributos fuera de su versión");
    expect(() => validarConfigArena({ ...c5, atributos: {} } as ConfigArena)).toThrow("Atributos fuera de su versión");
    expect(() => validarConfigArena({ ...c6, estilosJuego: { local: "presion", visita: "directo" } } as ConfigArena)).toThrow("Identidad de juego fuera de su versión");
    // v7: atributos sin identidad; v8: los dos, y sin la identidad se rechaza.
    const c7 = crearConfigArena({ reglas: V7 }), c8 = crearConfigArena({ reglas: V8 });
    expect(["atributos" in c7, "estilosJuego" in c7, "atributos" in c8, "estilosJuego" in c8]).toEqual([true, false, true, true]);
    expect(() => validarConfigArena({ ...c7, estilosJuego: { local: "presion", visita: "directo" } } as ConfigArena)).toThrow("Identidad de juego fuera de su versión");
    const { estilosJuego: _e, ...sinIdentidad } = c8;
    expect(() => validarConfigArena(sinIdentidad)).toThrow("Falta la identidad de juego");
    // Desde v6 (también en v7 y v8) la clave existe siempre.
    const registros = [await leer("arena-reinicios-v6"), ...await Promise.all(ESCENARIO.semillasEstado.flatMap(seed => [V6, V7, V8].map(reglas => ejecutarArena(crearConfigArena({ seed, duracionS: ESCENARIO.duracionEstadoS, reglas }), { local: crearControladorProgramado(), visita: crearControladorProgramado() }))))];
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

// =============================================================================================
// Publicación 2 · bloques B y C (reglas reinicios-v7)
// =============================================================================================
/** Valores propios de los escenarios de los bloques B y C (posiciones, atributos y duraciones). */
const BC = {
  /** Valores de un atributo para las parejas de integración (B4) y el atributo de un jugador «neutro». */
  bajo: 30, alto: 90, neutro: 50,
  /** Corredor (B4): carril, destino lejano, velocidad y energía iniciales para el desgaste, y ticks hasta saturar. */
  corredor: { x: 20, y: 60 }, destinoCorredor: { x: 95, y: 60 }, velocidadInicial: 6, energiaInicial: 0.8, ticksSaturar: 30,
  /** Pase (B4/C6): pasador, receptor quieto a 20 m y receptor de un balón largo a 40 m. */
  pasador: { x: 45, y: 50 }, receptorCorto: { x: 65, y: 50 }, receptorLargo: { x: 85, y: 50 },
  /** Remates (B4, C1–C3): distancias (m) al centro del arco rival. */
  remateCortoM: 20, remateLejanoM: 28, remateCercaM: 22, fueraDeAlcanceM: 0.1, remateLejisimosM: 100, remateConduceM: 35,
  /** C1: separación lateral para salir de la banda del área y un rival a esa distancia del rematador o de la línea. */
  fueraBandaY: 1, cercaM: 1,
  /** C5: visión alta y baja para el alcance; distancia de un balón largo y desplazamiento lateral del cambio. */
  visionAlta: 90, visionBaja: 40, largoM: 38, cambioY: 30, cortoM: 25,
  /** B3: semillas y duración de los partidos neutros, y cuántos deben cumplir la condición del bloque C. */
  semillasNeutral: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], duracionNeutralS: 5, minNeutrales: 6,
  /** C2/C3/B4: semillas a barrer. */
  semillas: 40, ticksMax: 60,
  /** 17.4/18.2: semillas del presupuesto del torneo. */
  semillasTorneo: 50,
} as const;
const conAtributos = (c: ConfigArena, id: string, cambios: Partial<AtributosJugador>) => { c.atributos![id] = { ...c.atributos![id]!, ...cambios }; };
const todosA = (c: ConfigArena, valor: number) => { for (const id of Object.keys(c.atributos!)) c.atributos![id] = Object.fromEntries(atributosJugador.map(a => [a, valor])) as AtributosJugador; };
const arcoVisita: Punto = { x: ARENA.largoM, y: MEDIO_Y };
const aDistancia = (m: number, dy = 0): Punto => ({ x: ARENA.largoM - Math.sqrt(m * m - dy * dy), y: MEDIO_Y + dy });
const deTipo = (m: MotorArena, tipo: string) => m.eventos.filter(e => e.tipo === tipo);
/** Rematador local (MED) con el balón en `origen`, orden `accion`, atributos `cambios` y sin entorno (error del 051 puro). */
function rematador(reglas: Reglas, origen: Punto, accion: OrdenJugador["accion"], cambios: Partial<AtributosJugador> = {}, o: { seed?: number; sinEntorno?: boolean; preparar?: (e: EstadoArena) => void; estilo?: EstiloJuego } = {}) {
  let id = "";
  const s = montar(reglas, (e, c) => {
    if (o.estilo) conEstilo(c, "local", o.estilo);
    const t = deLinea(e, "local", "MED")[0]!; colocar(t, origen); id = t.id;
    e.balon = { posicion: { ...origen }, poseedor: t.id, vuelo: null };
    if (c.atributos) conAtributos(c, t.id, cambios);
    if (o.sinEntorno ?? true) delete c.partido.condiciones;
    o.preparar?.(e);
  }, () => ({ [id]: { accion, destino: { ...arcoVisita } } }), { seed: o.seed });
  return { s, id };
}

describe("063 · bloque B · atributos (reinicios-v7)", () => {
  it("B1 · atributosDe: determinista, sin semilla, lado ni formación; enteros en [min, max]; personalidad y partido intactos; coherencia en 1–200 (mutación: usar la semilla del partido; quitar el perfil)", () => {
    const c = crearConfigArena({ seed: ESCENARIO.semilla, reglas: V7 });
    for (const lado of lados) c.partido[lado].jugadores.slice(0, ARENA.plantillaArena).forEach((j, n) => {
      const esperado = atributosDe(c.partido[lado].nombre, j.nombre, j.posicion, personalidadDe(c.partido[lado].nombre, j.nombre, j.posicion).perfil);
      expect(c.atributos![`${lado}-${n}`]).toEqual(esperado);
      expect(atributosDe(c.partido[lado].nombre, j.nombre, j.posicion, personalidadDe(c.partido[lado].nombre, j.nombre, j.posicion).perfil)).toEqual(esperado);
      for (const a of atributosJugador) expect(Number.isInteger(esperado[a]) && esperado[a] >= AT.min && esperado[a] <= AT.max).toBe(true);
    });
    // Otra formación, otra duración, otra semilla del partido y los lados invertidos: los mismos atributos por jugador.
    expect(crearConfigArena({ seed: ESCENARIO.semilla, reglas: V7, local: "4-4-2", visita: "3-5-2", duracionS: ESCENARIO.duracionS }).atributos).toEqual(c.atributos);
    expect(crearConfigArena({ partido: { ...structuredClone(c.partido), seed: c.partido.seed + 1 }, reglas: V7 }).atributos).toEqual(c.atributos);
    const invertida = crearConfigArena({ partido: { ...structuredClone(c.partido), local: c.partido.visita, visita: c.partido.local }, reglas: V7 });
    for (const [k, v] of Object.entries(c.atributos!)) expect(invertida.atributos![k.startsWith("local-") ? k.replace("local-", "visita-") : k.replace("visita-", "local-")]).toEqual(v);
    // Mutación «quitar el perfil»: el perfil cambia el resultado.
    const j0 = c.partido.local.jugadores[1]!;
    expect(atributosDe(c.partido.local.nombre, j0.nombre, j0.posicion, "pasador")).not.toEqual(atributosDe(c.partido.local.nombre, j0.nombre, j0.posicion, "rematador"));
    // La personalidad y el partido de v6 y v7 coinciden.
    const c6 = crearConfigArena({ seed: ESCENARIO.semilla, reglas: V6 });
    expect(c.partido).toEqual(c6.partido);
    expect(crearEstadoArena(c).jugadores.map(j => j.personalidad)).toEqual(crearEstadoArena(c6).jugadores.map(j => j.personalidad));
    // Coherencia: medias globales de los jugadores de campo de 1–200 y orden por línea (posición natural).
    const suma: Record<string, Record<string, { s: number; n: number }>> = {};
    const anotar = (grupo: string, a: AtributosJugador) => { for (const k of atributosJugador) { const g = (suma[grupo] ??= {}); const x = (g[k] ??= { s: 0, n: 0 }); x.s += a[k]; x.n++; } };
    for (let seed = 1; seed <= L63.coherenciaAtributos.semillas; seed++) {
      const cs = crearConfigArena({ seed, reglas: V7 });
      for (const lado of lados) cs.partido[lado].jugadores.slice(0, ARENA.plantillaArena).forEach((j, n) => { if (j.posicion !== "POR") { anotar("todos", cs.atributos![`${lado}-${n}`]!); anotar(j.posicion, cs.atributos![`${lado}-${n}`]!); } });
    }
    const media = (g: string, k: AtributoJugador) => suma[g]![k]!.s / suma[g]![k]!.n;
    for (const k of atributosJugador) expect({ k, media: media("todos", k) >= L63.coherenciaAtributos.media.min && media("todos", k) <= L63.coherenciaAtributos.media.max }).toEqual({ k, media: true });
    expect(media("DEL", "velocidad")).toBeGreaterThan(media("DEF", "velocidad"));
    expect(media("DEF", "entrada")).toBeGreaterThan(media("DEL", "entrada"));
    expect(media("MED", "vision")).toBeGreaterThan(media("DEF", "vision"));
    expect(media("DEL", "potencia")).toBeGreaterThan(media("DEF", "potencia"));
  });

  it("B2 · configuración v7 con exactamente los IDs de la plantilla; rechazo de clave faltante o sobrante, fuera de rango, no entero, campo de más o de menos (mutación: validación laxa)", () => {
    const c = crearConfigArena({ seed: ESCENARIO.semilla, reglas: V7 });
    const ids = lados.flatMap(lado => c.partido[lado].jugadores.slice(0, ARENA.plantillaArena).map((_, n) => `${lado}-${n}`));
    expect(Object.keys(c.atributos!).sort()).toEqual([...ids].sort());
    expect(() => validarConfigArena(c)).not.toThrow();
    const con = (f: (a: Record<string, AtributosJugador>) => void) => { const x = structuredClone(c); f(x.atributos!); return () => validarConfigArena(x); };
    expect(con(a => { delete a[ids[0]!]; })).toThrow();
    expect(con(a => { a["local-99"] = { ...a[ids[0]!]! }; })).toThrow();
    expect(con(a => { a[ids[0]!]!.velocidad = AT.max + 1; })).toThrow();
    expect(con(a => { a[ids[0]!]!.vision = AT.min - 1; })).toThrow();
    expect(con(a => { a[ids[0]!]!.potencia = AT.neutro + 0.5; })).toThrow();
    expect(con(a => { delete (a[ids[0]!] as Partial<AtributosJugador>).entrada; })).toThrow();
    expect(con(a => { (a[ids[0]!] as unknown as Record<string, number>).aereo = AT.neutro; })).toThrow();
    const { atributos: _a, ...sin } = c;
    expect(() => validarConfigArena(sin)).toThrow("Faltan los atributos de jugador");
    expect(() => validarConfigArena({ ...c, estilosJuego: { local: "presion", visita: "directo" } })).toThrow("Identidad de juego fuera de su versión");
  });

  it("B3 · neutralidad por multiplicador; con todo a 50 y sin remates a más de radioTiroM ni pases a más de paseMaxM, v7 da los mismos eventos y fotogramas que v6 (mutación: efecto no centrado)", async () => {
    expect([factorVelocidadMax(AT.neutro), factorAceleracion(AT.neutro), factorDesgaste(AT.neutro), factorErrorPase(AT.neutro), factorPotencia(AT.neutro)]).toEqual([1, 1, 1, 1, 1]);
    expect(ajusteDuelo(AT.neutro, AT.neutro)).toBe(0);
    expect(efectoAtributo(AT.neutro)).toBe(0);
    let comparados = 0;
    for (const seed of BC.semillasNeutral) {
      const c7 = crearConfigArena({ seed, duracionS: BC.duracionNeutralS, reglas: V7 }); todosA(c7, AT.neutro);
      const r7 = await ejecutarArena(c7, { local: crearControladorProgramado(), visita: crearControladorProgramado() });
      const intervieneC = r7.eventos.some(e => (e.tipo === "tiro" && distancia(transformar(e.desde, e.lado), arcoVisita) > ARENA.radioTiroM) || (e.tipo === "pase" && e.distanciaM > ARENA.paseMaxM && e.motivo !== "saque_manos" && !e.reinicio));
      if (intervieneC) continue;
      const r6 = await ejecutarArena(crearConfigArena({ seed, duracionS: BC.duracionNeutralS, reglas: V6 }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
      expect({ seed, eventos: r7.eventos, fotogramas: r7.fotogramas, final: r7.final }).toEqual({ seed, eventos: r6.eventos, fotogramas: r6.fotogramas, final: r6.final });
      comparados++;
    }
    expect(comparados).toBeGreaterThanOrEqual(BC.minNeutrales);
  });

  it("B4 · integración: un atributo de un jugador cambia exactamente su velocidad máxima y aceleración, su desgaste, el duelo, el error de su pase y la velocidad de su remate (mutación: ignorar un atributo)", () => {
    // Velocidad y resistencia: corredor local (MED) sin balón hacia un destino lejano; el portero local tiene el balón en las manos.
    const corredor = (cambios: Partial<AtributosJugador>, inicial?: { v: number; energia: number }) => {
      let id = "";
      const s = montar(V7, (e, c) => {
        const j = deLinea(e, "local", "MED")[0]!; colocar(j, BC.corredor, inicial ? { x: inicial.v, y: 0 } : { x: 0, y: 0 }); id = j.id;
        if (inicial) j.energia = inicial.energia;
        conAtributos(c, j.id, cambios);
        const k = portero(e, "local"); e.balon = { posicion: { ...k.posicion }, poseedor: k.id, vuelo: null, manos: { portero: k.id, desdeTick: 0, hastaTick: ticksDe(ARENA.duracionMaxS) } };
      }, () => ({ [id]: { accion: "mover", destino: { ...BC.destinoCorredor } } }), { parqueLocalX: ESCENARIO.parqueLejosX, parqueVisitaX: ESCENARIO.parqueLejosX });
      return { s, id };
    };
    const rapidez = (s: Escenario, id: string) => Math.hypot(s.j(id).velocidad.x, s.j(id).velocidad.y);
    const lento = corredor({ velocidad: BC.bajo }), rapido = corredor({ velocidad: BC.alto });
    lento.s.ticks(1); rapido.s.ticks(1);
    expect(rapidez(rapido.s, rapido.id) / rapidez(lento.s, lento.id)).toBeCloseTo(factorAceleracion(BC.alto) / factorAceleracion(BC.bajo), 9);
    let eL = 0, eR = 0;
    for (let k = 1; k < BC.ticksSaturar; k++) { eL = lento.s.j(lento.id).energia; eR = rapido.s.j(rapido.id).energia; lento.s.ticks(1); rapido.s.ticks(1); }
    const porEnergia = (v: number, e: number) => v / (ARENA.factorEnergiaMin + (1 - ARENA.factorEnergiaMin) * e);
    expect(porEnergia(rapidez(rapido.s, rapido.id), eR) / porEnergia(rapidez(lento.s, lento.id), eL)).toBeCloseTo(factorVelocidadMax(BC.alto) / factorVelocidadMax(BC.bajo), 6);
    // Resistencia: el mismo recorrido del primer paso con distinto desgaste por metro.
    const inicial = { v: BC.velocidadInicial, energia: BC.energiaInicial };
    const blando = corredor({ resistencia: BC.bajo }, inicial), duro = corredor({ resistencia: BC.alto }, inicial);
    blando.s.ticks(1); duro.s.ticks(1);
    expect(blando.s.j(blando.id).posicion).toEqual(duro.s.j(duro.id).posicion);
    expect((BC.energiaInicial - duro.s.j(duro.id).energia) / (BC.energiaInicial - blando.s.j(blando.id).energia)).toBeCloseTo(factorDesgaste(BC.alto) / factorDesgaste(BC.bajo), 9);
    // Duelo: la misma extracción de `arena:duelo` frente a dos p; entrada del defensor y aguante del portador.
    const duelo = (seed: number, entrada: number, aguante: number) => {
      let defensor = "";
      const s = montar(V7, (e, c) => {
        const p = deLinea(e, "local", "MED")[0]!, d = deLinea(e, "visita", "DEF")[0]!;
        colocar(p, ESCENARIO.portador); colocar(d, { x: ESCENARIO.portador.x + ESCENARIO.defensorDx, y: ESCENARIO.portador.y }); defensor = d.id;
        conAtributos(c, d.id, { entrada }); conAtributos(c, p.id, { aguante, vision: BC.visionBaja });
        e.balon = { posicion: { ...ESCENARIO.portador }, poseedor: p.id, vuelo: null };
      }, () => ({}), { seed });
      s.ticks(1);
      return { robo: s.motor.eventos.some(x => x.tipo === "recuperacion" && x.jugador === defensor), falta: s.motor.eventos.some(x => x.tipo === "falta") };
    };
    let cambiaEntrada = 0, cambiaAguante = 0;
    for (let seed = 1; seed <= ESCENARIO.semillaMax; seed++) {
      const bajo = duelo(seed, BC.bajo, AT.neutro), alto = duelo(seed, BC.alto, AT.neutro);
      if (bajo.falta || alto.falta) continue;
      expect({ seed, monotono: !bajo.robo || alto.robo }).toEqual({ seed, monotono: true });
      if (alto.robo && !bajo.robo) cambiaEntrada++;
      const debil = duelo(seed, AT.neutro, BC.bajo), fuerte = duelo(seed, AT.neutro, BC.alto);
      expect({ seed, monotono: !fuerte.robo || debil.robo }).toEqual({ seed, monotono: true });
      if (debil.robo && !fuerte.robo) cambiaAguante++;
    }
    expect(cambiaEntrada).toBeGreaterThan(0); expect(cambiaAguante).toBeGreaterThan(0);
    // Visión: el desvío lateral del pase al receptor quieto escala con factorErrorPase (misma extracción `arena:golpe`).
    const pase = (vision: number) => {
      let pasador = "", receptor = "";
      const s = montar(V7, (e, c) => {
        const [p, r] = deLinea(e, "local", "MED"); colocar(p!, BC.pasador); colocar(r!, BC.receptorCorto); pasador = p!.id; receptor = r!.id;
        conAtributos(c, p!.id, { vision }); e.balon = { posicion: { ...BC.pasador }, poseedor: p!.id, vuelo: null };
      }, () => ({ [pasador]: { accion: "pasar", receptor, destino: { ...BC.receptorCorto } } }));
      s.ticks(1);
      return deTipo(s.motor, "pase")[0]!;
    };
    const pv = pase(BC.alto), pb = pase(BC.bajo);
    expect(pv.motivo).toBeUndefined();
    expect((pv.hasta.y - BC.receptorCorto.y) / (pb.hasta.y - BC.receptorCorto.y)).toBeCloseTo(factorErrorPase(BC.alto) / factorErrorPase(BC.bajo), 9);
    // Potencia: el primer paso del remate (a 20 m: no es lejano) recorre velocidad·pasoS.
    const remate = (potencia: number) => { const { s } = rematador(V7, aDistancia(BC.remateCortoM), "tirar", { potencia }); s.ticks(1); return { s, tiro: deTipo(s.motor, "tiro")[0]! }; };
    const fuerte = remate(BC.alto), suave = remate(BC.bajo);
    expect(fuerte.tiro.motivo).toBeUndefined();
    const avance = (r: { s: Escenario; tiro: { desde: Punto } }) => distancia(r.s.motor.estado.balon.posicion, r.tiro.desde);
    expect(avance(fuerte) / avance(suave)).toBeCloseTo(factorPotencia(BC.alto) / factorPotencia(BC.bajo), 9);
  });

  it("B5 · observación v7: equipos[lado].atributos solo con los IDs de ese lado; esquema de respuesta y validarOrdenes como en v6 (mutación: mezclar lados)", () => {
    const m7 = new MotorArena(crearConfigArena({ seed: ESCENARIO.semilla, reglas: V7 })), m6 = new MotorArena(crearConfigArena({ seed: ESCENARIO.semilla, reglas: V6 }));
    for (const lado of lados) {
      const o7 = observarArena(m7, lado), o6 = observarArena(m6, lado);
      for (const l of lados) {
        const ids = Object.keys(o7.equipos[l].atributos!);
        expect(ids.length).toBe(Math.min(ARENA.plantillaArena, m7.config.partido[l].jugadores.length));
        expect(ids.every(id => id.startsWith(`${l}-`))).toBe(true);
        expect(o7.equipos[l].atributos).toEqual(Object.fromEntries(ids.map(id => [id, m7.config.atributos![id]])));
        expect("atributos" in o6.equipos[l]).toBe(false);
      }
      // El id de la observación es un hash que incluye `equipos`: el resto del esquema es idéntico.
      const sinId = (o: typeof o7) => { const e = esquemaRespuestaArena(o) as { properties: Record<string, unknown> }; return { ...e, properties: { ...e.properties, observacion: null } }; };
      expect(sinId(o7)).toEqual(sinId(o6));
      expect(() => validarOrdenes(planProgramado(o7), o7)).not.toThrow();
      expect(validarOrdenes(planProgramado(o6), o6).ordenes.map(o => o.jugador)).toEqual(validarOrdenes(planProgramado(o7), o7).ordenes.map(o => o.jugador));
    }
  });

  it("v1.1 § 17.4 y v1.2 § 18.2 · la petición completa v7 / v5 y v8 / v5 (semillas 1–50, tick 0 y mitad de partido) cabe en factorObservacion063 con un 10 % de margen; con el promptMax nuevo cada formato cabe en su tope", async () => {
    const sistemaV5 = SISTEMA_ARENA.replace(`${frasesPersecucion()}\n`, "").replace(`${frasesAtributos()}\n`, "").replace(`${frasesLargo()}\n`, "").replace(`${frasesIdentidad()}\n`, "").replace(`${frasesFueraDeJuego()}\n`, "").replace(`${frasesTiroLibre()}\n`, "");
    expect(sistemaV5.length).toBeLessThan(SISTEMA_ARENA.length);
    const peticiones = async (seed: number, reglas: ReglasArena, sistema: string) => {
      const vistas: number[] = [];
      let previa: { tick: number; ordenes: OrdenesEquipo } | null = null;
      const local: ControladorEquipo = { id: "captura", tipo: "programado", async decidir(obs) {
        vistas.push(sistema.length + JSON.stringify({ ...obs, competencia: contextoCompetitivo(obs), ultimaPropuestaValidaPropia: previa }).length);
        const plan = planProgramado(obs); previa = { tick: obs.estado.tick, ordenes: validarOrdenes(plan, obs) }; return plan;
      } };
      await ejecutarArena(crearConfigArena({ seed, duracionS: TORNEO_ARENA.duracionS, intervaloS: TORNEO_SITIO.intervaloS, reglas }), { local, visita: crearControladorProgramado() });
      return vistas;
    };
    // Publicación 3: las peticiones de reinicios-v8 llevan además `estiloJuego` y frasesIdentidad(). Brief 065: reinicios-v9
    // (ARENA.reglas) solo cambia dos cifras del remate; su petición tiene las mismas claves que v8 y se mide igual.
    // Brief 068: reinicios-v10 (ARENA.reglas) lleva además frasesFueraDeJuego() en el sistema y `fueraDeJuego` en la
    // observación; se mide igual. Brief 070: reinicios-v11 (ARENA.reglas) lleva además frasesTiroLibre() en el sistema
    // (la observación tiene las mismas claves que v10, con los saques "libre"/"penal"); se mide igual.
    expect(ARENA.reglas).toBe(V11);
    let mayor = 0;
    const mayores: Record<string, number> = {};
    for (let seed = 1; seed <= BC.semillasTorneo; seed++) {
      const v5 = await peticiones(seed, V5, sistemaV5);
      for (const reglas of [V7, V8, V9, V10, V11]) {
        const vn = await peticiones(seed, reglas, SISTEMA_ARENA);
        expect(vn.length).toBe(Math.ceil(TORNEO_ARENA.duracionS / TORNEO_SITIO.intervaloS));
        vn.forEach((n, k) => { mayor = Math.max(mayor, n / v5[k]!); mayores[reglas] = Math.max(mayores[reglas] ?? 0, n / v5[k]!); });
      }
    }
    console.log("[063 17.4 cociente de la petición]", JSON.stringify({ mayor, mayores, factor: TORNEO_SITIO.factorObservacion063 }));
    expect(TORNEO_SITIO.factorObservacion063).toBeGreaterThanOrEqual(1.1 * mayor);
    const entradas = JSON.parse(readFileSync(RUTA_ENTRADAS_SITIO, "utf8")) as EntradasSitio;
    expect(entradas.promptMax).toMatchObject({ factorObservacion063: TORNEO_SITIO.factorObservacion063, tokens: Math.ceil(entradas.promptMax.medido! * TORNEO_SITIO.factorObservacion063) });
    for (const formato of ["liga", "grupos"] as const) {
      const ficha = estimarFormato(formato, entradas);
      expect({ formato, cabe: ficha.tipicoMicroUsd.maxConDesempates - tipicoPartidoMaxMicroUsd(entradas) + ficha.reservaMaxPartidoMicroUsd <= ficha.topeMicroUsd }).toEqual({ formato, cabe: true });
    }
  }, 180_000); // 068: con la frase v10 la petición crece; en el runner de CI pasó de 60 s.
});

describe("063 · bloque C · remate lejano y balón largo (reinicios-v7)", () => {
  /** Estado de referencia de C1: rematador local con potencia alta a remateLejanoM en el eje, todos los demás lejos. */
  const baseC1 = () => {
    const c = crearConfigArena({ seed: ESCENARIO.semilla, reglas: V7, local: ESCENARIO.local, visita: ESCENARIO.visita });
    const e = crearEstadoArena(c); e.saque = null; e.pausa = null;
    for (const lado of lados) campo(e, lado).forEach((j, k) => colocar(j, { x: lado === "local" ? ESCENARIO.parqueLocalX : ESCENARIO.parqueVisitaX, y: ESCENARIO.filaY0 + ESCENARIO.filaDY * k }));
    const t = deLinea(e, "local", "MED")[0]!; colocar(t, aDistancia(BC.remateLejanoM));
    colocar(portero(e, "visita"), { x: ARENA.largoM - 1, y: MEDIO_Y });
    return { e, t, a: { ...c.atributos![t.id]!, potencia: BC.alto } };
  };
  it("C1 · puedeRematarLejos: cada condición alterna el resultado (potencia, distancia, banda, espacio, línea; el portero no tapa la línea) (mutación: quitar una condición)", () => {
    const { e, t, a } = baseC1();
    expect(puedeRematarLejos(t, a, e)).toBe(true);
    expect(puedeRematarLejos(t, { ...a, potencia: LA.remate.potenciaMin - 1 }, e)).toBe(false);
    expect(puedeRematarLejos(t, { ...a, potencia: LA.remate.potenciaMin }, e)).toBe(true);
    expect(puedeRematarLejos(t, undefined, e)).toBe(false);
    const en = (p: Punto) => { colocar(t, p); return puedeRematarLejos(t, a, e); };
    expect(en(aDistancia(ARENA.radioTiroM))).toBe(false);
    expect(en(aDistancia(ARENA.radioTiroM + BC.fueraDeAlcanceM))).toBe(true);
    expect(en(aDistancia(LA.remate.maxM))).toBe(true);
    expect(en(aDistancia(LA.remate.maxM + BC.fueraDeAlcanceM))).toBe(false);
    expect(en(aDistancia(BC.remateLejanoM, ARENA.areaAnchoM / 2 + BC.fueraBandaY))).toBe(false);
    expect(en(aDistancia(BC.remateLejanoM, ARENA.areaAnchoM / 2 - BC.fueraBandaY))).toBe(true);
    colocar(t, aDistancia(BC.remateLejanoM));
    const rival = deLinea(e, "visita", "MED")[0]!, guardado = { ...rival.posicion };
    colocar(rival, { x: t.posicion.x - LA.remate.espacioM + BC.cercaM, y: t.posicion.y }); expect(puedeRematarLejos(t, a, e)).toBe(false);
    colocar(rival, { x: t.posicion.x + LA.remate.espacioM + BC.cercaM, y: t.posicion.y + LA.remate.lineaM - BC.cercaM / 2 }); expect(puedeRematarLejos(t, a, e)).toBe(false);
    colocar(rival, { x: t.posicion.x + LA.remate.espacioM + BC.cercaM, y: t.posicion.y + LA.remate.lineaM + BC.cercaM }); expect(puedeRematarLejos(t, a, e)).toBe(true);
    colocar(rival, guardado);
    colocar(portero(e, "visita"), { x: t.posicion.x + LA.remate.espacioM + BC.cercaM, y: MEDIO_Y }); expect(puedeRematarLejos(t, a, e)).toBe(true);
    expect(puedeRematarLejos({ ...t, puesto: "POR" }, a, e)).toBe(false);
  });

  it("C2 · decisión local: PRNG arena:lejano con la probabilidad de la fórmula; una orden explícita no se sustituye (mutación: disparar sin PRNG)", () => {
    let si = 0, no = 0;
    for (let seed = 1; seed <= BC.semillas; seed++) {
      const { s, id } = rematador(V7, aDistancia(BC.remateLejanoM), "mover", { potencia: BC.alto, vision: BC.visionBaja }, { seed });
      const j = s.j(id), p = Math.min(1, LA.remate.probabilidad * (LA.remate.remateBase + (j.personalidad?.remate ?? REMATE_NEUTRO) / 100) * (LA.remate.potenciaBase + efectoAtributo(BC.alto)));
      expect(probabilidadLejano(j.personalidad?.remate ?? REMATE_NEUTRO, BC.alto)).toBeCloseTo(p, 12);
      const esperado = prngDerivado(seed, `arena:lejano:0:${id}`).chance(p);
      s.ticks(1);
      const tiro = deTipo(s.motor, "tiro")[0];
      expect({ seed, tiro: tiro?.motivo ?? null }).toEqual({ seed, tiro: esperado ? "lejano" : null });
      if (esperado) si++; else no++;
      if (esperado) for (const accion of ["conducir", "pasar"] as const) {
        const otro = rematador(V7, aDistancia(BC.remateLejanoM), accion, { potencia: BC.alto, vision: BC.visionBaja }, { seed, preparar: e => colocar(deLinea(e, "local", "MED")[1]!, { x: ARENA.largoM - BC.remateLejanoM - BC.remateCortoM / 2, y: MEDIO_Y }) });
        if (accion === "pasar") otro.s.planes.local.ordenes.find(o => o.jugador === otro.id)!.receptor = deLinea(otro.s.motor.estado, "local", "MED")[1]!.id;
        otro.s.ticks(1);
        expect({ seed, accion, tiro: deTipo(otro.s.motor, "tiro").length }).toEqual({ seed, accion, tiro: 0 });
      }
    }
    expect(si).toBeGreaterThan(0); expect(no).toBeGreaterThan(0);
  });

  it("C3 · ejecución de un tiro a d > radioTiroM: motivo lejano, vuelo.lejano, error × (1 + errorPorM·lejos), alto acotado; a d ≤ radioTiroM igual que v6; tirar del LLM a maxM sí, a maxM + 0,1 y a 100 m no; varios ticks con la orden pendiente o consumida (mutación: aplicarlo también a d ≤ 25 m; ejecutar el tirar a cualquier distancia)", () => {
    const comprobar = (metros: number, seed: number) => {
      const { s, id } = rematador(V7, aDistancia(metros), "tirar", {}, { seed });
      const antes = structuredClone(s.motor.estado), t = antes.jugadores.find(j => j.id === id)!;
      s.ticks(1);
      const tiro = deTipo(s.motor, "tiro")[0]!, nivel = capacidadEfectiva(t, compatibilidadPuesto(t, t.puesto)), d = distancia(t.posicion, arcoVisita), potencia = potenciaRemate(d);
      const lejos = Math.max(0, d - ARENA.radioTiroM);
      const ob = objetivoRemate(t.posicion, portero(antes, "visita").posicion, nivel, t.personalidad?.remate ?? REMATE_NEUTRO, "local");
      const rng = prngDerivado(seed, `arena:golpe:0:${id}`), lateral = rng.next() + rng.next() - 1;
      expect(tiro.hasta.y).toBeCloseTo(ob.y + lateral * errorRemate(nivel, d, potencia) * (1 + LA.remate.errorPorM * lejos), 9);
      const alto = prngDerivado(seed, `arena:remate:0:${id}`).chance(lejos > 0 ? Math.min(LA.remate.altoMax, probabilidadAlto(nivel, potencia) + LA.remate.altoPorM * lejos) : probabilidadAlto(nivel, potencia));
      expect(s.motor.estado.balon.vuelo?.alto === true).toBe(alto);
      return { s, tiro };
    };
    for (let seed = 1; seed <= BC.semillas / 4; seed++) {
      const lejano = comprobar(BC.remateLejanoM, seed);
      expect(lejano.tiro.motivo).toBe("lejano"); expect(lejano.s.motor.estado.balon.vuelo?.lejano).toBe(true);
      const maximo = comprobar(LA.remate.maxM, seed);
      expect(maximo.tiro.motivo).toBe("lejano");
      // A d ≤ radioTiroM, idéntico a v6 (evento y vuelo).
      const cerca7 = comprobar(BC.remateCercaM, seed);
      const cerca6 = rematador(V6, aDistancia(BC.remateCercaM), "tirar", {}, { seed }); cerca6.s.ticks(1);
      expect(cerca7.tiro).toEqual(deTipo(cerca6.s.motor, "tiro")[0]);
      expect(cerca7.s.motor.estado.balon.vuelo).toEqual(cerca6.s.motor.estado.balon.vuelo);
    }
    // El alto acotado y el multiplicador máximo del dominio.
    expect(altoLejano(1, LA.remate.maxM)).toBe(LA.remate.altoMax);
    expect(factorErrorLejano(lejosRemate(LA.remate.maxM))).toBeCloseTo(1 + LA.remate.errorPorM * (LA.remate.maxM - ARENA.radioTiroM), 12);
    expect(lejosRemate(ARENA.radioTiroM)).toBe(0);
    // Fuera de alcance: ningún tiro ese tick (decide en local); v6 sí lo ejecutaba.
    for (const metros of [LA.remate.maxM + BC.fueraDeAlcanceM, BC.remateLejisimosM]) {
      const lejos = rematador(V7, metros > ARENA.largoM ? { x: ARENA.largoM - metros + ARENA.largoM / 2, y: MEDIO_Y } : aDistancia(metros), "tirar", { vision: BC.visionBaja });
      lejos.s.ticks(1);
      expect({ metros, tiros: deTipo(lejos.s.motor, "tiro").length }).toEqual({ metros, tiros: 0 });
      const v6 = rematador(V6, aDistancia(Math.min(metros, LA.remate.maxM + BC.fueraDeAlcanceM)), "tirar"); v6.s.ticks(1);
      expect(deTipo(v6.s.motor, "tiro").length).toBe(1);
    }
    // Varios ticks en una sola ronda: sin opción de pase conduce, entra en maxM y remata por la orden pendiente.
    const conduce = rematador(V7, aDistancia(BC.remateConduceM), "tirar", { vision: BC.visionBaja, potencia: LA.remate.potenciaMin - 1 });
    conduce.s.motor.avanzar(conduce.s.planes, ticksDe(ESCENARIO.intervaloS));
    const t1 = deTipo(conduce.s.motor, "tiro")[0];
    expect(t1).toBeDefined();
    expect(distancia(transformar(t1!.desde, "local"), arcoVisita)).toBeLessThanOrEqual(LA.remate.maxM);
    expect(t1!.tick).toBeGreaterThan(1);
    // Con opción de pase: el pase local consume la orden y no hay remate en la ronda.
    const pasa = rematador(V7, aDistancia(BC.remateConduceM), "tirar", { vision: BC.visionBaja }, { preparar: e => colocar(deLinea(e, "local", "MED")[1]!, { x: ARENA.largoM - BC.remateConduceM + BC.remateCortoM / 2, y: MEDIO_Y + ESCENARIO.filaDY }) });
    pasa.s.motor.avanzar(pasa.s.planes, ticksDe(ESCENARIO.intervaloS));
    expect(deTipo(pasa.s.motor, "pase").find(e => e.jugador === pasa.id)?.tick).toBe(1);
    expect(deTipo(pasa.s.motor, "tiro").filter(e => e.jugador === pasa.id)).toEqual([]);
  });

  it("C4 · portero: ante un vuelo lejano va al punto de la trayectoria en su x; ante un remate no lejano, igual que v6 (mutación: aplicarlo a todos los remates)", () => {
    const vuelo = (reglas: Reglas, lejano: boolean) => montar(reglas, (e, c) => {
      if (c.atributos) todosA(c, AT.neutro);
      const t = deLinea(e, "local", "MED")[0]!, origen = aDistancia(BC.remateLejanoM), destino = { x: ARENA.largoM + ARENA.remateTrasLineaM, y: MEDIO_Y + ARENA.arcoM / 2 - BC.cercaM };
      colocar(t, origen);
      const v: Vuelo = { tipo: "tiro", autor: t.id, lado: "local", receptor: null, origen, destino, inicioTick: 0, adelantados: [], potencia: 1, ...(lejano ? { lejano: true as const } : {}) };
      e.balon = { posicion: { ...origen }, poseedor: null, ultimoToque: { jugador: t.id, lado: "local" }, vuelo: v };
    });
    const k7 = vuelo(V7, true), k = portero(k7.motor.estado, "visita"), p0 = { ...k.posicion };
    const objetivo = destinoTrayectoria(k7.motor.estado.balon.vuelo!, k);
    expect(objetivo.x).toBeCloseTo(p0.x, 12);
    k7.ticks(1);
    expect(coseno(k7.j(k.id).velocidad, p0, objetivo)).toBeGreaterThan(ESCENARIO.cosenoDireccion);
    // Sin `lejano`, v7 y v6 mueven igual al portero.
    const n7 = vuelo(V7, false), n6 = vuelo(V6, false);
    n7.ticks(3); n6.ticks(3);
    expect(n7.j(k.id).posicion).toEqual(n6.j(k.id).posicion);
    expect(n7.j(k.id).posicion).not.toEqual(k7.j(k.id).posicion);
  });

  it("C5 · opcionPaseLargo: ventana de distancia, avance o cambio de orientación, ventaja, puntuación y desempate; sin visión, conductor o portero nada; gana al corto solo si puntúa más (mutación: elegir siempre el largo)", () => {
    const c = crearConfigArena({ seed: ESCENARIO.semilla, reglas: V7, local: ESCENARIO.local, visita: ESCENARIO.visita });
    const e = crearEstadoArena(c); e.saque = null; e.pausa = null;
    const origen = { x: ARENA.largoM / 2 - BC.largoM / 2, y: MEDIO_Y };
    // Los compañeros que no intervienen, a menos de paseMaxM del pasador (nunca son candidatos de balón largo); los rivales, lejos.
    for (const lado of lados) campo(e, lado).forEach((j, k) => colocar(j, lado === "local" ? { x: origen.x - BC.cercaM, y: ESCENARIO.filaY0 + ESCENARIO.filaDY * k } : { x: ESCENARIO.parqueLocalX, y: ESCENARIO.filaY0 + ESCENARIO.filaDY * k }));
    const [j, r, r2] = deLinea(e, "local", "MED"); const a = { ...c.atributos![j!.id]!, vision: BC.visionAlta };
    colocar(j!, origen);
    for (const x of campo(e, "local")) expect(distancia(x.posicion, origen)).toBeLessThanOrEqual(ARENA.paseMaxM);
    const alcance = alcanceLargo(a)!;
    expect(alcance).toBeCloseTo(ARENA.paseMaxM + (LA.pase.maxM - ARENA.paseMaxM) * Math.min(1, (BC.visionAlta - LA.pase.visionMin) / (100 - LA.pase.visionMin)), 12);
    expect(alcanceLargo({ ...a, vision: LA.pase.visionMin - 1 })).toBeNull();
    colocar(r!, { x: origen.x + BC.largoM, y: MEDIO_Y });
    const op = opcionPaseLargo(j!, a, e)!;
    expect(op.receptor.id).toBe(r!.id);
    const rivalMasCerca = Math.min(...e.jugadores.filter(x => x.lado === "visita" && x.puesto !== "POR").map(x => distancia(x.posicion, op.destino)));
    expect(op.puntuacion).toBeCloseTo(BC.largoM + Math.min(rivalMasCerca - distancia(r!.posicion, op.destino), ARENA.margenUtilM) - BC.largoM * ARENA.pesoDistanciaPase * LA.pase.penalizacion, 9);
    // Ventana: a paseMaxM o menos, o por encima del alcance, nada.
    colocar(r!, { x: origen.x + ARENA.paseMaxM, y: MEDIO_Y }); expect(opcionPaseLargo(j!, a, e)).toBeUndefined();
    colocar(r!, { x: origen.x + alcance + BC.fueraDeAlcanceM, y: MEDIO_Y }); expect(opcionPaseLargo(j!, a, e)).toBeUndefined();
    // Sin avance suficiente: nada, salvo cambio de orientación.
    colocar(r!, { x: origen.x + LA.pase.avanceMinM - BC.cercaM, y: MEDIO_Y + ESCENARIO.filaDY }); expect(opcionPaseLargo(j!, a, e)).toBeUndefined();
    colocar(r!, { x: origen.x + Math.sqrt(BC.largoM ** 2 - BC.cambioY ** 2), y: MEDIO_Y - BC.cambioY }); expect(opcionPaseLargo(j!, a, e)?.receptor.id).toBe(r!.id);
    // Ventaja: un rival en la caída (ventaja 0, no positiva) lo impide.
    colocar(r!, { x: origen.x + BC.largoM, y: MEDIO_Y });
    const rival = deLinea(e, "visita", "MED")[0]!; colocar(rival, { ...r!.posicion }); expect(opcionPaseLargo(j!, a, e)).toBeUndefined();
    colocar(rival, { x: ESCENARIO.parqueLocalX, y: ESCENARIO.filaY0 });
    // Desempate: dos receptores simétricos → el id menor.
    colocar(r!, { x: origen.x + BC.largoM - 1, y: MEDIO_Y + ESCENARIO.filaDY }); colocar(r2!, { x: origen.x + BC.largoM - 1, y: MEDIO_Y - ESCENARIO.filaDY });
    for (const x of e.jugadores.filter(x => x.lado === "visita" && x.puesto !== "POR")) colocar(x, { x: ESCENARIO.parqueLocalX, y: MEDIO_Y });
    expect(opcionPaseLargo(j!, a, e)?.receptor.id).toBe([r!.id, r2!.id].sort()[0]);
    // Portero: nada.
    expect(opcionPaseLargo(portero(e, "local"), a, e)).toBeUndefined();
    // Motor: gana al corto solo si puntúa más; un conductor no lo lanza.
    const decide = (corto: boolean, conductor = false) => {
      let pasador = "";
      const s = montar(V7, (st, cf) => {
        const [p, l, k] = deLinea(st, "local", "MED"); colocar(p!, origen); pasador = p!.id;
        colocar(l!, { x: origen.x + BC.largoM, y: MEDIO_Y });
        if (corto) colocar(k!, { x: origen.x + BC.cortoM, y: MEDIO_Y + ESCENARIO.filaDY });
        conAtributos(cf, p!.id, { vision: BC.visionAlta, potencia: LA.remate.potenciaMin - 1 });
        if (conductor) p!.personalidad = { ...p!.personalidad!, conduccion: 100, pase: 0 };
        st.balon = { posicion: { ...origen }, poseedor: p!.id, vuelo: null };
      }, () => ({}), { parqueLocalX: ESCENARIO.parqueLocalX, parqueVisitaX: ESCENARIO.parqueLocalX });
      const antes = structuredClone(s.motor.estado), quien = antes.jugadores.find(x => x.id === pasador)!;
      const largo = opcionPaseLargo(quien, s.config.atributos![pasador], antes), mejorCorto = evaluarPases(quien, observarArena(s.motor, "local"))[0]?.puntuacion ?? -Infinity;
      s.ticks(1);
      return { largo, mejorCorto, pase: deTipo(s.motor, "pase")[0] };
    };
    const soloLargo = decide(false);
    expect(soloLargo.largo).toBeDefined(); expect(soloLargo.pase?.motivo).toBe("largo");
    const conCorto = decide(true);
    expect(conCorto.pase?.motivo === "largo").toBe(conCorto.largo!.puntuacion > conCorto.mejorCorto);
    expect(decide(false, true).pase?.motivo).not.toBe("largo");
  });

  it("C6 · vuelo del balón largo: aéreo, motivo largo, error extra por la fórmula y contacto solo a ≤ caidaM (mutación: sin fase aérea)", () => {
    let pasador = "", receptor = "", rival = "";
    const s = montar(V7, (e, c) => {
      const [p, r] = deLinea(e, "local", "MED"); colocar(p!, BC.pasador); colocar(r!, BC.receptorLargo); pasador = p!.id; receptor = r!.id;
      const v = deLinea(e, "visita", "MED")[0]!; colocar(v, { x: (BC.pasador.x + BC.receptorLargo.x) / 2, y: BC.pasador.y }); rival = v.id;
      conAtributos(c, p!.id, { vision: BC.visionAlta }); delete c.partido.condiciones;
      e.balon = { posicion: { ...BC.pasador }, poseedor: p!.id, vuelo: null };
    }, () => ({ [pasador]: { accion: "pasar", receptor, destino: { ...BC.receptorLargo } } }), { parqueVisitaX: ESCENARIO.parqueLejosX });
    const antes = structuredClone(s.motor.estado), j = antes.jugadores.find(x => x.id === pasador)!;
    s.ticks(1);
    const pase = deTipo(s.motor, "pase")[0]!, d = distancia(BC.pasador, BC.receptorLargo), nivel = capacidadEfectiva(j, compatibilidadPuesto(j, j.puesto));
    expect(pase).toMatchObject({ motivo: "largo", receptor });
    expect(s.motor.estado.balon.vuelo).toMatchObject({ tipo: "pase", aereo: true });
    const lateral = prngDerivado(ESCENARIO.semilla, `arena:golpe:0:${pasador}`).next() * 2 - 1;
    const error = (1 - nivel / 100) * ARENA.errorPaseM * factorErrorPase(BC.visionAlta) + errorExtraLargo(d, BC.visionAlta);
    expect(errorExtraLargo(d, BC.visionAlta)).toBeCloseTo(LA.pase.errorM * (d - ARENA.paseMaxM) / (LA.pase.maxM - ARENA.paseMaxM) * (LA.pase.errorVisionBase - BC.visionAlta / 100), 12);
    expect(pase.hasta.y).toBeCloseTo(BC.receptorLargo.y + lateral * error, 9);
    for (let k = 0; k < BC.ticksMax && s.motor.estado.balon.vuelo; k++) s.ticks(1);
    expect(s.motor.eventos.some(e => e.jugador === rival && ["intercepcion", "recuperacion"].includes(e.tipo))).toBe(false);
    const toque = s.motor.eventos.find(e => ["recepcion", "intercepcion", "recuperacion", "fuera_juego"].includes(e.tipo))!;
    expect(toque).toMatchObject({ tipo: "recepcion", jugador: receptor });
    expect(distancia(toque.hasta, pase.hasta)).toBeLessThanOrEqual(A46.caidaM + ARENA.controlM);
  });

  it("C7 · pasar del LLM a 40 m: con alcance ≥ 40 es un balón largo; con alcance < 40 la rama pasarImposible del 046 queda intacta (igual que v6 con todo a 50) (mutación: permitir cualquier distancia)", () => {
    const pasar = (reglas: Reglas, vision: number | null) => {
      let pasador = "", receptor = "";
      const s = montar(reglas, (e, c) => {
        const [p, r] = deLinea(e, "local", "MED"); colocar(p!, BC.pasador); colocar(r!, { x: BC.pasador.x + 40, y: BC.pasador.y }); pasador = p!.id; receptor = r!.id;
        if (c.atributos) { todosA(c, AT.neutro); if (vision !== null) conAtributos(c, p!.id, { vision }); }
        e.balon = { posicion: { ...BC.pasador }, poseedor: p!.id, vuelo: null };
      }, () => ({ [pasador]: { accion: "pasar", receptor, destino: { x: BC.pasador.x + 40, y: BC.pasador.y } } }));
      return { s, pasador, receptor };
    };
    const largo = pasar(V7, BC.visionAlta);
    expect(alcanceLargo({ ...largo.s.config.atributos![largo.pasador]! })!).toBeGreaterThanOrEqual(40);
    largo.s.ticks(1);
    expect(deTipo(largo.s.motor, "pase")[0]).toMatchObject({ jugador: largo.pasador, receptor: largo.receptor, motivo: "largo" });
    const corto7 = pasar(V7, null), corto6 = pasar(V6, null);
    expect(alcanceLargo(corto7.s.config.atributos![corto7.pasador])).toBe(ARENA.paseMaxM);
    for (let k = 0; k < ticksDe(ARENA.accionCadaS) + 1; k++) { corto7.s.ticks(1); corto6.s.ticks(1); }
    expect(corto7.s.motor.eventos).toEqual(corto6.s.motor.eventos);
    expect(corto7.s.motor.estado.jugadores).toEqual(corto6.s.motor.estado.jugadores);
    expect(corto7.s.motor.eventos.some(e => e.motivo === "largo")).toBe(false);
  });

  it("C8 · textos ES/EN de vista y relato; narrador de plantilla con un lejano como principal; estadista.ts y estadisticas.ts sin cambios (mutación: texto genérico)", async () => {
    const r = JSON.parse(await readFile("src/arena/__fixtures__/arena-reinicios-v7.json", "utf8")) as RegistroArena;
    const plantilla = [...r.inicial.jugadores, ...r.inicial.banco ?? []], de = (id: string | null) => plantilla.find(j => j.id === id)!;
    const lejano = r.eventos.find(e => e.tipo === "tiro" && e.motivo === "lejano")!, largo = r.eventos.find(e => e.tipo === "pase" && e.motivo === "largo")!;
    const jl = de(lejano.jugador), jp = de(largo.jugador), rp = de(largo.receptor);
    expect(narrarEventoArena(lejano, r, "es")).toBe(`${jl.nombre} (${jl.dorsal}) prueba desde lejos (${Math.round(lejano.distanciaM)} m).`);
    expect(narrarEventoArena(lejano, r, "en")).toBe(`${jl.nombre} (${jl.dorsal}) tries a long-range shot (${Math.round(lejano.distanciaM)} m).`);
    expect(narrarEventoArena(largo, r, "es")).toBe(`${jp.nombre} (${jp.dorsal}) lanza un balón largo hacia ${rp.nombre} (${Math.round(largo.distanciaM)} m).`);
    expect(narrarEventoArena(largo, r, "en")).toBe(`${jp.nombre} (${jp.dorsal}) plays a long ball towards ${rp.nombre} (${Math.round(largo.distanciaM)} m).`);
    const variantes = {
      es: [`¡Prueba desde lejos ${jl.nombre}!`, `¡Disparo lejano de ${jl.nombre}!`, `¡${jl.nombre} se anima desde fuera!`, `¡Le pega de lejos ${jl.nombre}!`],
      en: [`${jl.nombre} tries it from distance!`, `A long-range effort from ${jl.nombre}!`, `${jl.nombre} lets fly from range!`, `${jl.nombre} has a go from deep!`],
    };
    const intervalo = RELATO_INTERVALOS.vivo, desde = Math.floor((lejano.tick - 1) / intervalo) * intervalo;
    for (let k = 0; k < variantes.es.length; k++) {
      let n = 0; while (varianteVoz(r.config.partido.seed, `lejano-${n}`) !== k) n++;
      const id = `lejano-${n}`, renombrado = { ...r, eventos: r.eventos.map(e => e.id === lejano.id ? { ...e, id } : e) };
      for (const idioma of ["es", "en"] as const) {
        const texto = construirRelato(renombrado, desde, lejano.tick, "vivo", idioma).texto;
        expect({ idioma, k, esta: texto.includes(variantes[idioma][k]!), otras: variantes[idioma].filter((v, i) => i !== k && texto.includes(v)) }).toEqual({ idioma, k, esta: true, otras: [] });
      }
    }
    const caido: Llm = { id: "llm-caido", async completar() { throw new Error("sin servicio"); } };
    const c = await narrarArena(r, lejano.tick, caido, { principal: `arena:${lejano.id}` });
    expect(c).toMatchObject({ modo: "plantilla", principal: `arena:${lejano.id}` });
    expect(c!.oraciones[0]!.texto_es).toBe(narrarEventoArena(lejano, r, "es"));
    expect(c!.oraciones[0]!.texto_en).toBe(narrarEventoArena(lejano, r, "en"));
    for (const archivo of ["src/arena/estadista.ts", "src/arena/estadisticas.ts"]) {
      let diff: string | null = null;
      try { diff = execFileSync("git", ["-c", "safe.directory=*", "diff", "HEAD", "--", archivo], { encoding: "utf8" }); } catch { diff = null; }
      if (diff !== null) expect({ archivo, diff }).toEqual({ archivo, diff: "" });
    }
  });

  it("C9 · frasesAtributos() y frasesLargo() con constantes alteradas; SISTEMA_ARENA las incluye (mutación: cifras a mano)", () => {
    const alterada = frasesLargo({ paseMaxM: 31, largoMaxM: 57, radioTiroM: 23, remateMaxM: 37 });
    for (const t of ["entre 31 m", "hasta 57 m", "más de 23 m", "más de 37 m"]) expect(alterada).toContain(t);
    const real = frasesLargo();
    for (const t of [`entre ${ARENA.paseMaxM} m`, `hasta ${LA.pase.maxM} m`, `más de ${ARENA.radioTiroM} m`, `más de ${LA.remate.maxM} m`]) expect(real).toContain(t);
    for (const a of atributosJugador) expect(frasesAtributos()).toContain(a);
    expect(SISTEMA_ARENA).toContain(real); expect(SISTEMA_ARENA).toContain(frasesAtributos());
  });

  it("C10 · lote rápido v7: bandas `rapido` del 046 (recalibradas), del 051 (y su controlado de porteros), del bloque A y de los bloques B y C", { timeout: 300_000 }, async () => {
    const lote = { desde: L.rapido.semillaDesde, semillas: L.rapido.semillas, reglas: V7 };
    const m = await medirLote(lote);
    const { b046, b051, b063, bBC } = bandasLote(V7, "rapido");
    console.log("[063 v7 rápido]", JSON.stringify({ goles: m.golesPorPartido, centros: m.centros.porPartido, a: m.persecucion063, bc: m.largoLejano063 }));
    expect(b046.golesPorPartido).toEqual(L63.recalibracion046.rapido.golesPorPartido);
    expect(b046.centrosPorPartidoMin).toBe(L63.recalibracion046.rapido.centrosPorPartidoMin);
    expect(bandasLote(V6, "rapido").b046).toBe(L.rapido);
    expect(bandasLote(V6, "rapido").bBC).toBeNull();
    expect(incumplimientos(m, b046, b051)).toEqual([]);
    expect(incumplimientos063(m, b063!)).toEqual([]);
    expect(incumplimientosBC(m, bBC!)).toEqual([]);
    const porteros = await medirControlado({ ...lote, quien: "portero" });
    expect(incumplimientosControlado({ porteros: porteros.diferencia }, L51.rapido)).toEqual([]);
  });

  it("C11 · fixture v7 (45 s, búsqueda 1–400) con un balón largo, un remate lejano y config.atributos; reproducción exacta; tamaño con atributos: cota pura ≤ crecimientoMaxBytes y registros reales de 180 s", { timeout: 300_000 }, async () => {
    const r = JSON.parse(await readFile("src/arena/__fixtures__/arena-reinicios-v7.json", "utf8")) as RegistroArena;
    expect(r.config.duracionS).toBe(DURACION_FIXTURE_V7_S);
    expect(condicionesFixtureV7(r)).toEqual({ reglas: true, atributos: true, largo: true, lejano: true });
    expect(cumpleFixtureV7(r)).toBe(true);
    expect(r.rondas.flatMap(x => Object.values(x.decisiones)).every(d => d.tiempoMs === 0)).toBe(true);
    expect(reproducirArena(structuredClone(r))).toEqual(r);
    // Los fixtures anteriores siguen exactos.
    const r6 = JSON.parse(await readFile("src/arena/__fixtures__/arena-reinicios-v6.json", "utf8")) as RegistroArena;
    expect(reproducirArena(structuredClone(r6))).toEqual(r6);
    // Cota pura (v1.2 § 18.4) con fórmulas y constantes: persecución, atributos y los `motivo` nuevos.
    const idMasLargo = `visita-${ARENA.plantillaArena - 1}`, tickMax = Math.round(ARENA.duracionMaxS / ARENA.pasoS) + Math.round(PE.maxS / ARENA.pasoS);
    const clave = JSON.stringify({ persecucion: { jugador: idMasLargo, lado: "visita", desdeTick: tickMax, hastaTick: tickMax } }).length - 2 + 1;
    const fotogramas = Math.round(ARENA.duracionMaxS / ARENA.pasoS) + 1;
    const unAtributo = JSON.stringify(Object.fromEntries(atributosJugador.map(a => [a, AT.max])));
    const atributos = JSON.stringify({ atributos: Object.fromEntries(Array.from({ length: 2 * ARENA.plantillaArena }, (_, k) => [`${idMasLargo}${k}`.slice(0, idMasLargo.length), JSON.parse(unAtributo)])) }).length;
    const atributosCota = 2 * ARENA.plantillaArena * (JSON.stringify(idMasLargo).length + 1 + unAtributo.length + 1) + JSON.stringify("atributos").length + 3;
    expect(atributosCota).toBeGreaterThanOrEqual(atributos);
    const motivos = JSON.stringify({ motivo: "lejano" }).length - 2 + 1;
    const acciones = Math.ceil(ARENA.duracionMaxS * T.ritmo.alto / ARENA.accionCadaS);
    const cota = clave * fotogramas + 2 * clave + atributosCota + motivos * acciones;
    console.log("[063 C11 cota]", JSON.stringify({ clave, fotogramas, atributosCota, motivos, acciones, cota, maximo: L63.crecimientoMaxBytes }));
    expect(cota).toBeLessThanOrEqual(L63.crecimientoMaxBytes);
    let mayor = 0;
    for (const seed of ESCENARIO.semillasTamano) for (const intervaloS of ESCENARIO.intervalosTamano) {
      const tam = async (reglas: ReglasArena) => Buffer.byteLength(JSON.stringify(await ejecutarArena(crearConfigArena({ seed, duracionS: ARENA.duracionMaxS, intervaloS, reglas }), { local: crearControladorProgramado(), visita: crearControladorProgramado() })));
      const b7 = await tam(V7), b5 = await tam(V5);
      mayor = Math.max(mayor, b7);
      expect({ seed, intervaloS, dentroDeCota: b7 < b5 + cota, menorQueMaximo: b7 < ARENA.archivoMaxBytes }).toEqual({ seed, intervaloS, dentroDeCota: true, menorQueMaximo: true });
    }
    console.log("[063 C11 tamaño]", JSON.stringify({ mayorBytes: mayor, archivoMaxBytes: ARENA.archivoMaxBytes }));
  });
});

// ---------------------------------------------------------------------------------------------
describe("063 · revisión de Codex de la publicación 2 (sin cambio de comportamiento en v7)", () => {
  it("P2 · la métrica de potencia cuenta los ticks de vuelo desde vuelo.inicioTick (el evento `tiro` se fecha un tick después) (mutación: restar desde el tick del evento)", async () => {
    // El primer remate del `local` de las semillas barridas que termina sin contacto (alto o ancho).
    for (let seed = 1; seed <= BC.semillas; seed++) {
      const { muestras, eventos } = await muestrasPartido(seed, L.duracionS, V7);
      const porTick = new Map(muestras.map(s => [s.tick, s]));
      const i = eventos.findIndex((e, k) => e.tipo === "tiro" && e.lado === "local" && ["alto", "ancho"].includes(cierreDeRemate(eventos, k).desenlace) && porTick.has(e.tick) && porTick.has(e.tick - 1));
      if (i < 0) continue;
      const tiro = eventos[i]!, fin = cierreDeRemate(eventos, i).evento!;
      // Oráculo de las muestras: sin vuelo en el tick anterior al evento; en el del evento, el vuelo empezó en e.tick − 1.
      expect({ antes: porTick.get(tiro.tick - 1)!.vuelo, ahora: porTick.get(tiro.tick)!.vuelo, inicio: porTick.get(tiro.tick)!.vueloInicioTick }).toEqual({ antes: false, ahora: true, inicio: tiro.tick - 1 });
      const m = analizarPartido(seed, muestras, [tiro, fin]);
      expect(m.local063.ticksPorMN).toBe(1);
      expect(m.local063.ticksPorMSuma).toBeCloseTo((fin.tick - (tiro.tick - 1)) / distancia(tiro.desde, fin.hasta), 12);
      return;
    }
    throw new Error("Sin remate local sin contacto en el barrido");
  });
});

// =============================================================================================
// Publicación 3 · bloque D (reglas reinicios-v8)
// =============================================================================================
/** Valores propios de los escenarios del bloque D (semillas, ticks, atributos y distancias). */
const DD = {
  /** D1: semillas del recorrido de clubes. */
  semillasClubes: 200,
  /** D2 · bloque: ticks hasta que el jugador sin balón se asienta en su destino. */
  ticksBloque: 120,
  /** D2 · remate lejano: potencia algo por encima del umbral base y algo por debajo (dentro del umbral ofensivo). */
  potenciaSobreUmbral: LA.remate.potenciaMin + 2, potenciaBajoUmbral: LA.remate.potenciaMin - 5,
  /** D2 · balón largo: visión del pasador, receptor adelantado a esta distancia y visión del `pasar` del LLM. */
  visionLargo: 60, largoM: 40, visionPasar: 75,
} as const;
const idDe = (e: EstadoArena, f: (e: EstadoArena) => JugadorArena) => f(e).id;
/** D2 · bloque sin balón: balón en las manos del portero visitante; desplazamiento en x del jugador de campo local más
 * alejado del balón (sin perseguir ni replegar) tras `ticksBloque`. */
function desplazamientoBloque(reglas: Reglas, estilo?: EstiloJuego): number {
  let id = "";
  const s = montar(reglas, (e, c) => {
    if (estilo) conEstilo(c, "local", estilo);
    const k = portero(e, "visita");
    e.balon = { posicion: { ...k.posicion }, poseedor: k.id, vuelo: null, manos: { portero: k.id, desdeTick: 0, hastaTick: ticksDe(ARENA.duracionMaxS) } };
    id = idDe(e, x => campo(x, "local").sort((a, b) => distancia(b.posicion, k.posicion) - distancia(a.posicion, k.posicion) || a.id.localeCompare(b.id))[0]!);
  });
  const x0 = s.j(id).posicion.x;
  s.ticks(DD.ticksBloque);
  return s.j(id).posicion.x - x0;
}
/** D2 · duelo con la identidad del `local` (el que pierde el balón) forzada. */
function dueloConEstilo(reglas: Reglas, seed: number, estilo?: EstiloJuego) {
  let portador = "", defensor = "";
  const s = montar(reglas, (e, c) => {
    if (estilo) conEstilo(c, "local", estilo);
    const p = deLinea(e, "local", "MED")[0]!, d = deLinea(e, "visita", "DEF")[0]!;
    colocar(p, ESCENARIO.portador); colocar(d, { x: ESCENARIO.portador.x + ESCENARIO.defensorDx, y: ESCENARIO.portador.y });
    p.nivel = ESCENARIO.nivelBajo; d.nivel = ESCENARIO.nivelAlto; portador = p.id; defensor = d.id;
    e.balon = { posicion: { ...ESCENARIO.portador }, poseedor: p.id, vuelo: null };
  }, () => ({}), { seed });
  s.ticks(1);
  return { s, portador, defensor, robo: roboSinFalta(s, defensor) };
}
/** D2 · persecución previa del delantero local con el rival en posesión; un paso. */
function pasoApoyo(reglas: Reglas, estilo: EstiloJuego) {
  let perdedor = "";
  const s = montar(reglas, (e, c) => {
    conEstilo(c, "local", estilo);
    const v = deLinea(e, "visita", "MED")[0]!, p = deLinea(e, "local", "DEL")[0]!;
    colocar(v, ESCENARIO.limitePoseedor); colocar(p, ESCENARIO.limitePerseguidor);
    e.balon = { posicion: { ...v.posicion }, poseedor: v.id, vuelo: null };
    perdedor = p.id; fijarPersecucion(e, p, ticksDe(PE.maxS));
  }, () => ({}), { parqueLocalX: ESCENARIO.parqueLejosX, parqueVisitaX: ESCENARIO.parqueLejosX });
  const antes = structuredClone(s.motor.estado);
  s.ticks(1);
  return { s, antes, perdedor };
}
/** D2 · ¿el rol del repliegue corre hacia el destino del repliegue con la identidad visitante forzada? */
function repliegaCon(reglas: Reglas, estilo: EstiloJuego | undefined, rol: string): boolean {
  const { s, roles, b } = escenarioRepliegue(reglas, () => ({}), estilo);
  const j = roles[rol]!, p0 = { ...j.posicion };
  s.ticks(1);
  return coseno(s.j(j.id).velocidad, p0, destinoRepliegue(b, "visita")) > ESCENARIO.cosenoDireccion;
}
/** D2 · pasador local con visión `vision` y un compañero adelantado a `largoM`; orden `accion`. */
function pasadorLargo(reglas: Reglas, seed: number, estilo: EstiloJuego | undefined, vision: number, accion: OrdenJugador["accion"]) {
  let pasador = "", receptor = "";
  const s = montar(reglas, (e, c) => {
    if (estilo) conEstilo(c, "local", estilo);
    const [p, r] = deLinea(e, "local", "MED"); colocar(p!, BC.pasador); colocar(r!, { x: BC.pasador.x + DD.largoM, y: BC.pasador.y }); pasador = p!.id; receptor = r!.id;
    if (c.atributos) conAtributos(c, p!.id, { vision });
    e.balon = { posicion: { ...BC.pasador }, poseedor: p!.id, vuelo: null };
  }, () => ({ [pasador]: { accion, receptor: accion === "pasar" ? receptor : null, destino: { x: BC.pasador.x + DD.largoM, y: BC.pasador.y } } }), { seed });
  s.ticks(1);
  return { s, pasador, receptor, largo: deTipo(s.motor, "pase").find(e => e.motivo === "largo") };
}

describe("063 · bloque D · identidad de juego (reinicios-v8)", () => {
  it("D1 · estiloJuegoDe: determinista por claveClub (mayúsculas y espacios no cambian); los seis aparecen en 1–200; el mismo club tiene la misma identidad en todas sus semillas y lados; configuración v8 válida y rechazo fuera de versión o con valor desconocido (mutación: derivarla de la semilla)", () => {
    const c = crearConfigArena({ seed: ESCENARIO.semilla, reglas: V8 });
    expect(c.estilosJuego).toEqual({ local: estiloJuegoDe(c.partido.local.nombre), visita: estiloJuegoDe(c.partido.visita.nombre) });
    const nombre = c.partido.local.nombre;
    expect(estiloJuegoDe(`  ${nombre.toUpperCase()}  `)).toBe(estiloJuegoDe(nombre));
    expect(estiloJuegoDe(nombre.toLowerCase())).toBe(estiloJuegoDe(nombre));
    // Otra semilla del mismo partido y los lados invertidos: la identidad sigue al club.
    expect(crearConfigArena({ partido: { ...structuredClone(c.partido), seed: c.partido.seed + 1 }, reglas: V8 }).estilosJuego).toEqual(c.estilosJuego);
    expect(crearConfigArena({ partido: { ...structuredClone(c.partido), local: c.partido.visita, visita: c.partido.local }, reglas: V8 }).estilosJuego).toEqual({ local: c.estilosJuego!.visita, visita: c.estilosJuego!.local });
    // Recorrido de clubes: los seis aparecen y ningún club cambia de identidad entre semillas.
    const porClub = new Map<string, Set<EstiloJuego>>(), vistos = new Set<EstiloJuego>();
    for (let seed = 1; seed <= DD.semillasClubes; seed++) {
      const cs = crearConfigArena({ seed, reglas: V8 });
      for (const lado of lados) { const k = cs.partido[lado].nombre; (porClub.get(k) ?? porClub.set(k, new Set()).get(k)!).add(cs.estilosJuego![lado]); vistos.add(cs.estilosJuego![lado]); }
    }
    expect([...vistos].sort()).toEqual([...estilosJuego].sort());
    expect([...porClub.values()].every(v => v.size === 1)).toBe(true);
    expect(porClub.size).toBeGreaterThan(estilosJuego.length);
    // Validación: v8 válida; desconocido, campo de más o de menos, y fuera de versión rechazados.
    expect(() => validarConfigArena(c)).not.toThrow();
    expect(() => validarConfigArena({ ...c, estilosJuego: { local: "catenaccio" as never, visita: "directo" } })).toThrow();
    expect(() => validarConfigArena({ ...c, estilosJuego: { local: "presion" } as never })).toThrow();
    expect(() => validarConfigArena({ ...c, estilosJuego: { local: "presion", visita: "directo", neutral: "posesion" } as never })).toThrow();
    expect(() => validarConfigArena({ ...crearConfigArena({ seed: ESCENARIO.semilla, reglas: V7 }), estilosJuego: c.estilosJuego })).toThrow("Identidad de juego fuera de su versión");
    // La identidad no toca atributos, personalidades ni el partido.
    const c7 = crearConfigArena({ seed: ESCENARIO.semilla, reglas: V7 });
    expect(c.atributos).toEqual(c7.atributos);
    expect(c.partido).toEqual(c7.partido);
  });

  it("D2 · efectos, uno por escenario: bloqueM en el destino sin balón; factor de persecución en hastaTick; extra añade exactamente un perseguidor; repliegue cambia el máximo; umbrales y factores del remate lejano y del balón largo (mutación: ignorar un efecto)", () => {
    // bloqueM: el jugador sin balón se asienta a alturaBloqueM[medio] + bloqueM de su posición.
    for (const estilo of estilosJuego) expect({ estilo, dx: Math.abs(desplazamientoBloque(V8, estilo) - ARENA.alturaBloqueM.medio - EJ.efectos[estilo].bloqueM) <= ARENA.toleranciaM }).toEqual({ estilo, dx: true });
    expect(Math.abs(desplazamientoBloque(V7) - ARENA.alturaBloqueM.medio)).toBeLessThanOrEqual(ARENA.toleranciaM);
    // persecucion: la duración lleva el factor de la identidad del club del perdedor.
    const [alta, baja] = (["presion", "defensivo"] as const);
    let seed = 0;
    for (let k = 1; k <= ESCENARIO.semillaMax && !seed; k++) if (dueloConEstilo(V8, k, alta).robo && dueloConEstilo(V8, k, baja).robo) seed = k;
    expect(seed).toBeGreaterThan(0);
    const hasta: Record<string, number> = {};
    for (const estilo of [alta, baja]) {
      const { s, portador } = dueloConEstilo(V8, seed, estilo), p = s.motor.estado.persecucion!, j = s.j(portador);
      const ref = duracionReferencia(lineaDePuesto(j.puesto) as "MED", j.personalidad!.agresividad, s.motor.estado.entrenadores!.local.plan.bloque, j.energia, EJ.efectos[estilo].persecucion);
      expect({ estilo, jugador: p.jugador, ticks: p.hastaTick - p.desdeTick }).toEqual({ estilo, jugador: portador, ticks: Math.round(ref / ARENA.pasoS) });
      expect(p.hastaTick).toBe(hastaTickPersecucion(p.desdeTick, duracionPersecucionS(j, s.motor.estado.entrenadores!.local.plan.bloque, estilo)));
      hasta[estilo] = p.hastaTick - p.desdeTick;
    }
    expect(hasta[alta]!).toBeGreaterThan(hasta[baja]!);
    // extra: posesion (extra 1) frente a directo (extra 0), los dos con bloqueM y repliegue 0: difiere exactamente un
    // jugador local, el apoyo, que va al balón.
    const con = pasoApoyo(V8, "posesion"), sin = pasoApoyo(V8, "directo");
    expect([EJ.efectos.posesion.extra, EJ.efectos.directo.extra, EJ.efectos.posesion.bloqueM, EJ.efectos.directo.bloqueM]).toEqual([1, 0, 0, 0]);
    const apoyo = apoyoPersecucion(con.antes.jugadores, con.antes.balon.posicion, con.antes.persecucion!, perseguidoresDe(con.antes.jugadores, con.antes.balon.posicion))!;
    expect(apoyo.id).not.toBe(con.perdedor);
    const distintos = con.s.motor.estado.jugadores.filter(j => j.lado === "local" && !isDeepEqual(j, sin.s.motor.estado.jugadores.find(x => x.id === j.id))).map(j => j.id);
    expect(distintos).toEqual([apoyo.id]);
    expect(coseno(con.s.j(apoyo.id).velocidad, apoyo.posicion, destinoPersecucion(con.antes.balon.posicion, apoyo))).toBeGreaterThan(ESCENARIO.cosenoDireccion);
    // repliegue: el máximo del lado que defiende con su identidad (defensivo +1, ofensivo −1; directo 0).
    expect([EJ.efectos.defensivo.repliegue, EJ.efectos.directo.repliegue, EJ.efectos.ofensivo.repliegue]).toEqual([1, 0, -1]);
    expect({ quinto: repliegaCon(V8, "defensivo", "def3"), cuarto: repliegaCon(V8, "defensivo", "def2") }).toEqual({ quinto: true, cuarto: true });
    expect({ quinto: repliegaCon(V8, "directo", "def3"), cuarto: repliegaCon(V8, "directo", "def2") }).toEqual({ quinto: false, cuarto: true });
    expect({ cuarto: repliegaCon(V8, "ofensivo", "def2"), tercero: repliegaCon(V8, "ofensivo", "def1") }).toEqual({ cuarto: false, tercero: true });
    // Umbrales y factores, puros.
    const e = crearEstadoArena(crearConfigArena({ seed: ESCENARIO.semilla, reglas: V8, local: ESCENARIO.local, visita: ESCENARIO.visita })); e.saque = null; e.pausa = null;
    for (const lado of lados) campo(e, lado).forEach((j, k) => colocar(j, { x: lado === "local" ? ESCENARIO.parqueLocalX : ESCENARIO.parqueVisitaX, y: ESCENARIO.filaY0 + ESCENARIO.filaDY * k }));
    const t = deLinea(e, "local", "MED")[0]!; colocar(t, aDistancia(BC.remateLejanoM)); colocar(portero(e, "visita"), { x: ARENA.largoM - 1, y: MEDIO_Y });
    const a = { velocidad: AT.neutro, resistencia: AT.neutro, aguante: AT.neutro, entrada: AT.neutro, vision: AT.neutro, potencia: LA.remate.potenciaMin };
    expect([puedeRematarLejos(t, a, e), puedeRematarLejos(t, a, e, "contragolpe"), puedeRematarLejos(t, a, e, "defensivo")]).toEqual([true, true, false]);
    expect(puedeRematarLejos(t, { ...a, potencia: LA.remate.potenciaMin + EJ.efectos.defensivo.umbralLejano }, e, "defensivo")).toBe(true);
    expect(puedeRematarLejos(t, { ...a, potencia: LA.remate.potenciaMin + EJ.efectos.ofensivo.umbralLejano }, e, "ofensivo")).toBe(true);
    expect(puedeRematarLejos(t, { ...a, potencia: LA.remate.potenciaMin + EJ.efectos.ofensivo.umbralLejano - 1 }, e, "ofensivo")).toBe(false);
    for (const estilo of estilosJuego) expect(probabilidadLejano(REMATE_NEUTRO, BC.alto, estilo)).toBeCloseTo(probabilidadLejano(REMATE_NEUTRO, BC.alto) * EJ.efectos[estilo].lejano, 12);
    for (const estilo of estilosJuego) {
      const u = LA.pase.visionMin + EJ.efectos[estilo].umbralLargo;
      expect({ estilo, bajo: alcanceLargo({ ...a, vision: u - 1 }, estilo), justo: alcanceLargo({ ...a, vision: u }, estilo) }).toEqual({ estilo, bajo: null, justo: ARENA.paseMaxM });
      expect(alcanceLargo({ ...a, vision: u + (100 - LA.pase.visionMin) / 2 }, estilo)).toBeCloseTo(ARENA.paseMaxM + (LA.pase.maxM - ARENA.paseMaxM) / 2, 12);
    }
    // largo: la penalización por distancia del mejor balón largo se divide por el factor de la identidad.
    const pasador = deLinea(e, "local", "MED")[1]!, receptor = deLinea(e, "local", "DEL")[0]!;
    colocar(pasador, BC.pasador); colocar(receptor, { x: BC.pasador.x + BC.largoM, y: BC.pasador.y });
    const ver = { ...a, vision: BC.visionAlta };
    const base = opcionPaseLargo(pasador, ver, e)!;
    for (const estilo of estilosJuego) {
      const o = opcionPaseLargo(pasador, ver, e, estilo)!;
      expect({ estilo, receptor: o.receptor.id }).toEqual({ estilo, receptor: base.receptor.id });
      expect(o.puntuacion).toBeCloseTo(base.avance + Math.min(base.ventaja, ARENA.margenUtilM) - base.d * ARENA.pesoDistanciaPase * LA.pase.penalizacion / EJ.efectos[estilo].largo, 9);
    }
  });

  it("D2 · el motor pasa la identidad a las decisiones locales del remate lejano y del balón largo; las órdenes del LLM no la usan («por su cuenta») (mutación: ignorar la identidad en el motor; aplicarla al pasar del LLM)", () => {
    // Remate lejano: contragolpe (umbral 0, factor 1) = v7; defensivo sube el umbral por encima de la potencia; ofensivo
    // lo baja por debajo y multiplica la probabilidad.
    let si = 0, siOfensivo = 0;
    for (let seed = 1; seed <= BC.semillas; seed++) {
      const caso = (estilo: EstiloJuego, potencia: number) => {
        const { s, id } = rematador(V8, aDistancia(BC.remateLejanoM), "mover", { potencia, vision: BC.visionBaja }, { seed, estilo });
        const j = s.j(id), esperado = puedeRematarLejos(j, s.config.atributos![id], s.motor.estado, estilo) && prngDerivado(seed, `arena:lejano:0:${id}`).chance(Math.min(1, probabilidadLejano(j.personalidad?.remate ?? REMATE_NEUTRO, potencia, estilo)));
        s.ticks(1);
        return { real: deTipo(s.motor, "tiro").some(x => x.motivo === "lejano"), esperado };
      };
      const neutro = caso("contragolpe", DD.potenciaSobreUmbral), defensivo = caso("defensivo", DD.potenciaSobreUmbral), ofensivo = caso("ofensivo", DD.potenciaBajoUmbral);
      expect({ seed, neutro: neutro.real, defensivo: defensivo.real, ofensivo: ofensivo.real }).toEqual({ seed, neutro: neutro.esperado, defensivo: false, ofensivo: ofensivo.esperado });
      if (neutro.real) si++;
      if (ofensivo.real) siOfensivo++;
    }
    expect(si).toBeGreaterThan(0); expect(siOfensivo).toBeGreaterThan(0);
    // Balón largo local: con visión DD.visionLargo, el compañero a DD.largoM queda dentro del alcance de `directo` y fuera
    // del de v7 y del de `posesion`.
    expect([alcanceLargo({ ...AT.base.MED, vision: DD.visionLargo }, "directo")! >= DD.largoM, (alcanceLargo({ ...AT.base.MED, vision: DD.visionLargo }) ?? 0) < DD.largoM, alcanceLargo({ ...AT.base.MED, vision: DD.visionLargo }, "posesion")]).toEqual([true, true, null]);
    let semilla = 0;
    for (let seed = 1; seed <= BC.semillas && !semilla; seed++) if (pasadorLargo(V8, seed, "directo", DD.visionLargo, "mover").largo) semilla = seed;
    expect(semilla).toBeGreaterThan(0);
    expect(pasadorLargo(V8, semilla, "posesion", DD.visionLargo, "mover").largo).toBeUndefined();
    expect(pasadorLargo(V7, semilla, undefined, DD.visionLargo, "mover").largo).toBeUndefined();
    // El `pasar` del LLM a DD.largoM usa el alcance de la visión sin la identidad: también con `posesion` es un balón largo.
    expect(alcanceLargo({ ...AT.base.MED, vision: DD.visionPasar })! >= DD.largoM && (alcanceLargo({ ...AT.base.MED, vision: DD.visionPasar }, "posesion") ?? 0) < DD.largoM).toBe(true);
    const llm = pasadorLargo(V8, ESCENARIO.semilla, "posesion", DD.visionPasar, "pasar");
    expect(llm.largo).toMatchObject({ jugador: llm.pasador, receptor: llm.receptor, motivo: "largo" });
  });

  it("0.3 (D) · matriz: cada efecto de identidad solo existe con reinicios-v8 (v5, ausente, v6 y v7 sin cambio) (mutación: gating con la versión equivocada)", () => {
    const comportamientos: { nombre: string; medir: (r: Reglas) => boolean }[] = [
      { nombre: "bloqueM", medir: r => Math.abs(desplazamientoBloque(r, "presion") - ARENA.alturaBloqueM.medio) > ARENA.toleranciaM },
      { nombre: "repliegue +1", medir: r => repliegaCon(r, "defensivo", "def3") },
      // posesion (extra 1) frente a directo (extra 0), con el mismo bloque: algún jugador local distinto.
      { nombre: "apoyo de la persecución", medir: r => { const con = pasoApoyo(r, "posesion"), sin = pasoApoyo(r, "directo"); return !isDeepEqual(con.s.motor.estado.jugadores, sin.s.motor.estado.jugadores); } },
      { nombre: "umbral del lejano", medir: r => { for (let seed = 1; seed <= BC.semillas; seed++) { const { s } = rematador(r, aDistancia(BC.remateLejanoM), "mover", { potencia: DD.potenciaBajoUmbral, vision: BC.visionBaja }, { seed, estilo: "ofensivo" }); s.ticks(1); if (deTipo(s.motor, "tiro").some(x => x.motivo === "lejano")) return true; } return false; } },
    ];
    for (const c of comportamientos) {
      expect({ nombre: c.nombre, v8: c.medir(V8) }).toEqual({ nombre: c.nombre, v8: true });
      for (const r of [...ANTERIORES, V6, V7]) expect({ nombre: c.nombre, reglas: r ?? "ausente", cambia: c.medir(r) }).toEqual({ nombre: c.nombre, reglas: r ?? "ausente", cambia: false });
    }
  });

  it("D3 · observación v8: equipos[lado].estiloJuego de los dos clubes; ausente en v7; esquema de respuesta y validarOrdenes sin cambios (mutación: mezclar lados)", () => {
    const m8 = new MotorArena(crearConfigArena({ seed: ESCENARIO.semilla, reglas: V8 })), m7 = new MotorArena(crearConfigArena({ seed: ESCENARIO.semilla, reglas: V7 }));
    for (const lado of lados) {
      const o8 = observarArena(m8, lado), o7 = observarArena(m7, lado);
      for (const l of lados) {
        expect(o8.equipos[l].estiloJuego).toBe(m8.config.estilosJuego![l]);
        expect("estiloJuego" in o7.equipos[l]).toBe(false);
        expect(o8.equipos[l].atributos).toEqual(o7.equipos[l].atributos);
      }
      const sinId = (o: typeof o8) => { const e = esquemaRespuestaArena(o) as { properties: Record<string, unknown> }; return { ...e, properties: { ...e.properties, observacion: null } }; };
      expect(sinId(o8)).toEqual(sinId(o7));
      expect(() => validarOrdenes(planProgramado(o8), o8)).not.toThrow();
    }
  });

  it("D · frasesIdentidad() con otra lista; SISTEMA_ARENA la incluye con las seis identidades (mutación: lista a mano)", () => {
    expect(frasesIdentidad(["uno", "dos"])).toContain("(uno, dos)");
    for (const estilo of estilosJuego) expect(frasesIdentidad()).toContain(estilo);
    expect(SISTEMA_ARENA).toContain(frasesIdentidad());
  });

  it("D5 · lote rápido v8: bandas `rapido` del 046 (recalibradas), del 051 (y su controlado de porteros), del bloque A y de los bloques B y C", { timeout: 300_000 }, async () => {
    const lote = { desde: L.rapido.semillaDesde, semillas: L.rapido.semillas, reglas: V8 };
    const m = await medirLote(lote);
    const { b046, b051, b063, bBC } = bandasLote(V8, "rapido");
    console.log("[063 v8 rápido]", JSON.stringify({ goles: m.golesPorPartido, centros: m.centros.porPartido, a: m.persecucion063, bc: m.largoLejano063 }));
    expect(b046.golesPorPartido).toEqual(L63.recalibracion046.rapido.golesPorPartido);
    expect(incumplimientos(m, b046, b051)).toEqual([]);
    expect(incumplimientos063(m, b063!)).toEqual([]);
    expect(incumplimientosBC(m, bBC!)).toEqual([]);
    const porteros = await medirControlado({ ...lote, quien: "portero" });
    expect(incumplimientosControlado({ porteros: porteros.diferencia }, L51.rapido)).toEqual([]);
  });

  it("D5 · fixture v8 (45 s, búsqueda 1–400) con identidades distintas, atributos, un balón largo y una persecución; reproducción exacta; los fixtures v6 y v7 siguen exactos; tamaño: cota pura ≤ crecimientoMaxBytes con la identidad y registros reales de 180 s", { timeout: 300_000 }, async () => {
    const r = JSON.parse(await readFile("src/arena/__fixtures__/arena-reinicios-v8.json", "utf8")) as RegistroArena;
    expect(r.config.duracionS).toBe(DURACION_FIXTURE_V8_S);
    expect(condicionesFixtureV8(r)).toEqual({ reglas: true, identidades: true, atributos: true, largo: true, persecucion: true });
    expect(cumpleFixtureV8(r)).toBe(true);
    expect(r.rondas.flatMap(x => Object.values(x.decisiones)).every(d => d.tiempoMs === 0)).toBe(true);
    expect(reproducirArena(structuredClone(r))).toEqual(r);
    for (const v of ["v6", "v7"]) { const x = JSON.parse(await readFile(`src/arena/__fixtures__/arena-reinicios-${v}.json`, "utf8")) as RegistroArena; expect(reproducirArena(structuredClone(x))).toEqual(x); }
    // Cota pura: la del bloque C (persecución, atributos y `motivo`) más `estilosJuego` con la identidad más larga.
    const idMasLargo = `visita-${ARENA.plantillaArena - 1}`, tickMax = Math.round(ARENA.duracionMaxS / ARENA.pasoS) + Math.round(PE.maxS / ARENA.pasoS);
    const clave = JSON.stringify({ persecucion: { jugador: idMasLargo, lado: "visita", desdeTick: tickMax, hastaTick: tickMax } }).length - 2 + 1;
    const fotogramas = Math.round(ARENA.duracionMaxS / ARENA.pasoS) + 1;
    const unAtributo = JSON.stringify(Object.fromEntries(atributosJugador.map(a => [a, AT.max])));
    const atributosCota = 2 * ARENA.plantillaArena * (JSON.stringify(idMasLargo).length + 1 + unAtributo.length + 1) + JSON.stringify("atributos").length + 3;
    const masLarga = [...estilosJuego].sort((a, b) => b.length - a.length)[0]!;
    const identidadCota = JSON.stringify({ estilosJuego: { local: masLarga, visita: masLarga } }).length - 2 + 1;
    const motivos = JSON.stringify({ motivo: "lejano" }).length - 2 + 1, acciones = Math.ceil(ARENA.duracionMaxS * T.ritmo.alto / ARENA.accionCadaS);
    const cota = clave * fotogramas + 2 * clave + atributosCota + identidadCota + motivos * acciones;
    console.log("[063 D5 cota]", JSON.stringify({ clave, fotogramas, atributosCota, identidadCota, motivos, acciones, cota, maximo: L63.crecimientoMaxBytes }));
    expect(cota).toBeLessThanOrEqual(L63.crecimientoMaxBytes);
    let mayor = 0;
    for (const seed of ESCENARIO.semillasTamano) for (const intervaloS of ESCENARIO.intervalosTamano) {
      const tam = async (reglas: ReglasArena) => Buffer.byteLength(JSON.stringify(await ejecutarArena(crearConfigArena({ seed, duracionS: ARENA.duracionMaxS, intervaloS, reglas }), { local: crearControladorProgramado(), visita: crearControladorProgramado() })));
      const b8 = await tam(V8), b5 = await tam(V5);
      mayor = Math.max(mayor, b8);
      expect({ seed, intervaloS, dentroDeCota: b8 < b5 + cota, menorQueMaximo: b8 < ARENA.archivoMaxBytes }).toEqual({ seed, intervaloS, dentroDeCota: true, menorQueMaximo: true });
    }
    console.log("[063 D5 tamaño]", JSON.stringify({ mayorBytes: mayor, archivoMaxBytes: ARENA.archivoMaxBytes }));
  });
});

// Brief 065 § 2 · reinicios-v9 (REMATE_ARENA_V9): el remate del motor con el error base de v9, el lote rápido con las
// mismas bandas que v8 y el fixture v9; los fixtures v1–v8 se reproducen exactos (congelados).
describe("065 · reinicios-v9 (remate más preciso y portero con menos alcance)", () => {

  it("v9.4 · ejecución de un tiro (corto y lejano): error lateral con errorBaseM de REMATE_ARENA_V9 en v9 y de REMATE_ARENA en v8, el resto igual (mutación: el error base de v9 también en v8)", () => {
    for (const reglas of [V8, V9] as const) for (const metros of [BC.remateCortoM, BC.remateLejanoM]) for (let seed = 1; seed <= BC.semillas / 4; seed++) {
      const { s, id } = rematador(reglas, aDistancia(metros), "tirar", {}, { seed });
      const antes = structuredClone(s.motor.estado), t = antes.jugadores.find(j => j.id === id)!;
      s.ticks(1);
      const tiro = deTipo(s.motor, "tiro")[0]!, nivel = capacidadEfectiva(t, compatibilidadPuesto(t, t.puesto)), d = distancia(t.posicion, arcoVisita), potencia = potenciaRemate(d);
      const lejos = lejosRemate(d), base = reglas === V9 ? RM9.errorBaseM : RM.errorBaseM;
      const ob = objetivoRemate(t.posicion, portero(antes, "visita").posicion, nivel, t.personalidad?.remate ?? REMATE_NEUTRO, "local");
      const rng = prngDerivado(seed, `arena:golpe:0:${id}`), lateral = rng.next() + rng.next() - 1;
      const error = errorRemate(nivel, d, potencia, base) * (lejos > 0 ? factorErrorLejano(lejos) : 1);
      expect({ reglas, metros, seed, y: tiro.hasta.y }).toEqual({ reglas, metros, seed, y: expect.closeTo(ob.y + lateral * error, 9) });
    }
  });

  it("v9.5 · lote rápido v9: bandas `rapido` del 046 (recalibradas), del 051 (y su controlado de porteros), del bloque A y de los bloques B y C", { timeout: 300_000 }, async () => {
    const lote = { desde: L.rapido.semillaDesde, semillas: L.rapido.semillas, reglas: V9 };
    const m = await medirLote(lote);
    const { b046, b051, b063, bBC } = bandasLote(V9, "rapido");
    console.log("[065 v9 rápido]", JSON.stringify({ goles: m.golesPorPartido, conversion: m.remate.conversion, manoAMano: m.manoAMano.conversion, centros: m.centros.porPartido, a: m.persecucion063, bc: m.largoLejano063 }));
    expect(b046.golesPorPartido).toEqual(L63.recalibracion046.rapido.golesPorPartido);
    expect(incumplimientos(m, b046, b051)).toEqual([]);
    expect(incumplimientos063(m, b063!)).toEqual([]);
    expect(incumplimientosBC(m, bBC!)).toEqual([]);
    const porteros = await medirControlado({ ...lote, quien: "portero" });
    expect(incumplimientosControlado({ porteros: porteros.diferencia }, L51.rapido)).toEqual([]);
  });

  it("v9.6 · fixture v9 (45 s, búsqueda 1–400) con identidades distintas, atributos, balón largo, persecución, gol y atajada; reproducción exacta; los fixtures v1–v8 siguen exactos (mutación: cambiar el remate de v8)", { timeout: 300_000 }, async () => {
    const r = JSON.parse(await readFile("src/arena/__fixtures__/arena-reinicios-v9.json", "utf8")) as RegistroArena;
    expect(r.config.duracionS).toBe(DURACION_FIXTURE_V9_S);
    expect(condicionesFixtureV9(r)).toEqual({ reglas: true, identidades: true, atributos: true, largo: true, persecucion: true, gol: true, atajada: true });
    expect(cumpleFixtureV9(r)).toBe(true);
    expect(r.rondas.flatMap(x => Object.values(x.decisiones)).every(d => d.tiempoMs === 0)).toBe(true);
    expect(reproducirArena(structuredClone(r))).toEqual(r);
    expect(Buffer.byteLength(JSON.stringify(r))).toBeLessThan(ARENA.archivoMaxBytes);
    for (const v of ["v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8"]) {
      const x = JSON.parse(await readFile(`src/arena/__fixtures__/arena-reinicios-${v}.json`, "utf8")) as RegistroArena;
      expect({ v, exacto: isDeepEqual(reproducirArena(structuredClone(x)), x) }).toEqual({ v, exacto: true });
    }
  });
});
