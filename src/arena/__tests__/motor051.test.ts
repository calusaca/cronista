// Brief 051 (v1.1): realismo del remate bajo reglas reinicios-v5 con gating por versión. Las cifras
// salen de limites.ts (REMATE_ARENA, PORTERO_ARENA, ARENA, LOTE_ARENA_046/051); los valores propios de
// cada escenario se nombran como tales en ESCENARIO. Cada prueba nombra la mutación que la pone en rojo.
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { ARENA, LOTE_ARENA_046 as L, LOTE_ARENA_051 as L51, PORTERO_ARENA as PO, REMATE_ARENA as RM } from "../../sim/limites";
import type { Lado, SimConfig } from "../../sim/tipos";
import { prngDerivado } from "../../sim/prng";
import type { Llm } from "../../lib/llm";
import { compatibilidadPuesto } from "../alineacion";
import { anclas, transformar } from "../catalogo";
import { esquemaRespuestaArena } from "../controladores";
import { observarArena, reproducirArena } from "../coordinador";
import { capacidadEfectiva, efectosEntorno } from "../entorno";
import { rematesPorLado } from "../estadista";
import { agregarPrefijo } from "../estadisticas";
import { condicionesFixtureV5, cumpleFixtureV5, DURACION_FIXTURE_V5_S } from "../__fixtures__/generar-reinicios-v5";
import { distancia, proyeccion } from "../geometria";
import { agregarLote, analizarPartido, desenlaceFisico, incumplimientos, incumplimientosControlado, incumplimientosSaques, medirControlado, medirLote, partidoConNiveles, type MuestraTick } from "../metricas-lote";
import { atributosPlantillas, crearConfigArena, crearEstadoArena, MotorArena, reglasDesde, validarConfigArena } from "../motor";
import { narrarArena } from "../narrador";
import { destinoSalida, enAreaPropia } from "../portero";
import { RELATO_INTERVALOS } from "../protocolo";
import { varianteVoz } from "../expresion";
import { construirRelato } from "../relato";
import { alcancePortero, destinoPosicionamiento, errorRemate, estiradaPortero, objetivoRemate, potenciaRemate, probabilidadAlto, probabilidadDesvio, reaccionS, REMATE_NEUTRO, velocidadRemate } from "../remate";
import { esquemaOrdenes, lados, reglasArena, type ConfigArena, type EstadoArena, type EventoArena, type JugadorArena, type OrdenesEquipo, type OrdenJugador, type Punto, type RegistroArena, type ReglasArena, type Vuelo } from "../tipos";
import { narrarEventoArena } from "../vista";

const MEDIO_Y = ARENA.anchoM / 2;
const C_LOCAL: Punto = { x: 0, y: MEDIO_Y };
const V5 = "reinicios-v5" as const;
/** Brief 063 § 4.3: la configuración `base` con otras reglas; desde reinicios-v7, con sus atributos. */
const conReglas = (base: ConfigArena, reglas: ReglasArena): ConfigArena => { const { atributos: _a, ...resto } = base; return reglasDesde({ ...resto, reglas }, "reinicios-v7") ? { ...resto, reglas, atributos: atributosPlantillas(base.partido) } : { ...resto, reglas }; };
type Reglas = ReglasArena | undefined;
/** Matriz de versiones: v1–v4 y archivos sin `reglas` frente a v5. */
const ANTERIORES: readonly Reglas[] = ["reinicios-v1", "reinicios-v2", "reinicios-v3", "reinicios-v4", undefined];
const ticksDe = (segundos: number) => Math.round(segundos / ARENA.pasoS);
const EPS = 1e-9;

/** Valores propios de los escenarios: posiciones, niveles y duraciones elegidos para aislar cada regla. */
const ESCENARIO = {
  semilla: 7, duracionS: 30, intervaloS: 10, semillaMax: 400,
  /** Filas donde se aparcan los jugadores de campo que no intervienen. */
  parqueLocalX: 25, parqueVisitaX: 60, filaY0: 4, filaDY: 6,
  /** Remate local: distancia del rematador a la línea de gol rival y desplazamiento lateral del portero. */
  remateM: 14, remateLejosM: 22, porteroLineaM: 3, porteroLateralM: 1.5, rematadorLateralM: 3,
  /** Remate a 8 m (potencia 0) y nivel máximo: error nulo sin entorno. */
  cercaM: 8, nivelMaximo: 100,
  /** Nivel del rematador en la prueba del error (lejos de 0 y de 100). */
  nivelRematador: 60,
  /** Prueba 5: el balón pasa a lateralAlcanceM del portero; nivel alto lo ataja, nivel bajo no. */
  lateralAlcanceM: 2.1, nivelPorteroAlto: 100, nivelPorteroBajo: 30, balonAdelanteM: 2, origenM: 11,
  /** Prueba 6: nivel con el que el contacto es atrapada y nivel con el que es desvío. */
  nivelAtrapa: 90, nivelDesvia: 10, nivelMedio: 50,
  /** Contacto geométrico: ángulo (rad) de la línea centro del arco–portero, distancia balón–portero. */
  anguloContacto: 0.3, balonPorteroM: 2, estiradaLateralM: 1.5,
  /** v1.1 #3: portero a 4 m del origen (alcance no saturado). */
  origenNoSaturadoM: 4,
  /** Margen mínimo entre la extracción del PRNG y la probabilidad, para que el resultado no dependa de
   * redondeos ni del desplazamiento residual del portero. */
  margenPrng: 0.02,
  /** Prueba 7: poseedor rival a 20 m del centro del arco y 15 m del eje; defensor por delante. */
  posesion: { distanciaM: 20, ejeM: 15 }, defensor: { x: 9, y: 46 }, lejosM: 33,
  /** v1.1 #6: balón cercano y lateral (coordenadas del portero), donde la bisectriz y la línea difieren > 1 m. */
  lateralCercano: { x: 2, y: 45 }, diferenciaBisectrizMinM: 1,
  /** v1.1 #5: posiciones del portero a lo largo de la recta (antes, dentro y después del segmento). */
  tramos: [-0.5, 0.5, 1.5], separacionM: 2,
} as const;

// ---------------------------------------------------------------------------------------------
// Escenarios mínimos sobre crearEstadoArena + MotorArena (como motor046.test.ts).
// ---------------------------------------------------------------------------------------------
const portero = (e: EstadoArena, lado: Lado) => e.jugadores.find(j => j.lado === lado && j.puesto === "POR")!;
const campo = (e: EstadoArena, lado: Lado) => e.jugadores.filter(j => j.lado === lado && j.puesto !== "POR").sort((a, b) => a.id.localeCompare(b.id));
function colocar(j: JugadorArena, p: Punto, v: Punto = { x: 0, y: 0 }) { j.posicion = { ...p }; j.velocidad = { ...v }; }
type OrdenEscenario = { accion: OrdenJugador["accion"]; destino?: Punto; receptor?: string | null };
interface Escenario {
  motor: MotorArena; planes: Record<Lado, OrdenesEquipo>; config: ConfigArena;
  j(id: string): JugadorArena;
  ticks(n: number, antes?: (m: MotorArena) => void): void;
  /** Avanza tick a tick hasta que `fin` sea cierto o se agoten `max` ticks. */
  hasta(fin: (m: MotorArena) => boolean, max: number, antes?: (m: MotorArena) => void): void;
}
function montar(reglas: Reglas, preparar: (e: EstadoArena, config: ConfigArena) => void, ordenes: (e: EstadoArena) => Record<string, OrdenEscenario> = () => ({}), seed: number = ESCENARIO.semilla, partido?: SimConfig): Escenario {
  // Brief 063 § 4.3: la configuración se crea con sus reglas (los atributos de reinicios-v7 no existen antes).
  const config: ConfigArena = { ...crearConfigArena({ seed, duracionS: ESCENARIO.duracionS, intervaloS: ESCENARIO.intervaloS, reglas: reglas ?? V5, ...(partido ? { partido } : {}) }) };
  config.partido = structuredClone(config.partido);
  if (!reglas) delete config.reglas;
  const inicial = crearEstadoArena(config);
  inicial.saque = null; inicial.pausa = null;
  for (const lado of lados) {
    campo(inicial, lado).forEach((j, k) => colocar(j, { x: lado === "local" ? ESCENARIO.parqueLocalX : ESCENARIO.parqueVisitaX, y: ESCENARIO.filaY0 + ESCENARIO.filaDY * k }));
    colocar(portero(inicial, lado), anclas(config.formaciones[lado], lado, "base").POR!);
  }
  preparar(inicial, config);
  const motor = new MotorArena(config, inicial);
  const o = ordenes(motor.estado);
  const planes = Object.fromEntries(lados.map(lado => [lado, { observacion: `escenario:${lado}`, lado, intencion: "Escenario de prueba", amplitud: "media", bloque: "medio", gestion: null,
    ordenes: motor.estado.jugadores.filter(j => j.lado === lado).map(j => ({ jugador: j.id, accion: o[j.id]?.accion ?? "mover", destino: o[j.id]?.destino ?? { ...j.posicion }, receptor: o[j.id]?.receptor ?? null }))
      .sort((a, b) => a.jugador.localeCompare(b.jugador)) } satisfies OrdenesEquipo])) as Record<Lado, OrdenesEquipo>;
  const s: Escenario = {
    motor, planes, config,
    j: id => motor.estado.jugadores.find(j => j.id === id)!,
    ticks(n, antes) { for (let i = 0; i < n; i++) { antes?.(motor); motor.avanzar(planes, motor.estado.tick + 1); } },
    hasta(fin, max, antes) { for (let i = 0; i < max && !fin(motor); i++) s.ticks(1, antes); },
  };
  return s;
}
const de = (m: MotorArena, tipo: EventoArena["tipo"]) => m.eventos.filter(e => e.tipo === tipo);
const nivelDe = (j: JugadorArena) => capacidadEfectiva(j, compatibilidadPuesto(j, j.puesto));
/** Primer jugador de campo local con compatibilidad plena en su puesto (su nivel efectivo es su nivel). */
const tiradorDe = (e: EstadoArena) => campo(e, "local").find(j => compatibilidadPuesto(j, j.puesto) === 100)!;
const sinFinRemate = (m: MotorArena) => m.eventos.some(e => ["gol", "atajada", "tiro_fuera", "intercepcion"].includes(e.tipo));

/** Escenario A: el rematador local tiene el balón en `origen`; portero visitante en `porteroEn`. */
interface Disparo { origen: Punto; porteroEn?: Punto; nivel?: number; accion?: "tirar" | "mover"; seed?: number; sinEntorno?: boolean }
function disparo(reglas: Reglas, o: Disparo): Escenario {
  return montar(reglas, (e, config) => {
    const t = tiradorDe(e); colocar(t, o.origen);
    if (o.nivel !== undefined) t.nivel = o.nivel;
    if (o.porteroEn) colocar(portero(e, "visita"), o.porteroEn);
    e.balon = { posicion: { ...o.origen }, poseedor: t.id, vuelo: null };
    if (o.sinEntorno) delete config.partido.condiciones;
  }, e => ({ [tiradorDe(e).id]: { accion: o.accion ?? "tirar" } }), o.seed ?? ESCENARIO.semilla);
}
/** Rematador en el eje a `metros` de la línea de gol visitante; portero visitante desplazado a +y. */
const enEje = (metros: number): Punto => ({ x: ARENA.largoM - metros, y: MEDIO_Y });
const porteroDesplazado: Punto = { x: ARENA.largoM - ESCENARIO.porteroLineaM, y: MEDIO_Y + ESCENARIO.porteroLateralM };

/** Escenario B: remate visitante ya en vuelo hacia el portero local. */
interface VueloTiro { origen: Punto; balon: Punto; destino: Punto; potencia: number; alto?: boolean; porteroEn: Punto; seed?: number; partido?: SimConfig; condiciones?: (c: NonNullable<SimConfig["condiciones"]>) => void; sinEntorno?: boolean }
function vueloTiro(reglas: Reglas, o: VueloTiro): Escenario {
  return montar(reglas, (e, config) => {
    const t = campo(e, "visita")[0]!;
    colocar(portero(e, "local"), o.porteroEn); colocar(t, o.origen);
    const vuelo: Vuelo = { tipo: "tiro", autor: t.id, lado: "visita", receptor: null, origen: { ...o.origen }, destino: { ...o.destino }, inicioTick: 0, adelantados: [], potencia: o.potencia, ...(o.alto ? { alto: true as const } : {}) };
    e.balon = { posicion: { ...o.balon }, poseedor: null, ultimoToque: { jugador: t.id, lado: "visita" }, vuelo };
    if (o.sinEntorno) delete config.partido.condiciones;
    if (o.condiciones) o.condiciones(config.partido.condiciones!);
  }, () => ({}), o.seed ?? ESCENARIO.semilla, o.partido);
}
/** Contacto geométrico: portero local quieto en su destino de posicionamiento C + u·posicionamientoM;
 * el balón, a `aM` del portero sobre la misma recta, pasa a `lateralM` de él; el origen queda a
 * `origenM` del portero. Devuelve también la geometría para calcular el radio y la estirada. */
function contacto(reglas: Reglas, o: { lateralM: number; origenM: number; potencia: number; aM?: number; seed?: number; partido?: SimConfig; condiciones?: VueloTiro["condiciones"]; sinEntorno?: boolean }) {
  const aM = o.aM ?? ESCENARIO.balonPorteroM, u = { x: Math.cos(ESCENARIO.anguloContacto), y: Math.sin(ESCENARIO.anguloContacto) };
  const balon = { x: C_LOCAL.x + (RM.posicionamientoM + aM) * u.x, y: C_LOCAL.y + (RM.posicionamientoM + aM) * u.y };
  const porteroEn = destinoPosicionamiento(balon, "local");
  const theta = Math.asin(o.lateralM / aM), w = { x: -u.x * Math.cos(theta) + u.y * Math.sin(theta), y: -u.y * Math.cos(theta) - u.x * Math.sin(theta) };
  const pie = { x: balon.x + w.x * Math.sqrt(aM ** 2 - o.lateralM ** 2), y: balon.y + w.y * Math.sqrt(aM ** 2 - o.lateralM ** 2) };
  const atras = Math.sqrt(o.origenM ** 2 - o.lateralM ** 2), origen = { x: pie.x - w.x * atras, y: pie.y - w.y * atras };
  const largo = (balon.x + ARENA.remateTrasLineaM) / -w.x, destino = { x: balon.x + w.x * largo, y: balon.y + w.y * largo };
  const s = vueloTiro(reglas, { origen, balon, destino, potencia: o.potencia, porteroEn, seed: o.seed, partido: o.partido, condiciones: o.condiciones, sinEntorno: o.sinEntorno });
  return { s, origen, balon, porteroEn, destino };
}
/** Desenlace del primer contacto de un remate al portero local: "desvio", "atrapada" o "ninguno". */
function desenlace(s: Escenario): "desvio" | "atrapada" | "ninguno" {
  s.ticks(1);
  const a = de(s.motor, "atajada")[0];
  return !a ? "ninguno" : a.motivo === "desvio" ? "desvio" : "atrapada";
}
const extraccionDesvio = (seed: number, tick: number, id: string) => prngDerivado(seed, `desvio:${tick}:${id}`).next();
/** Fórmula de referencia de la prueba (independiente de remate.ts) con un término opcional anulado. */
function desvioReferencia(nivel: number, potencia: number, estirada: number, sin?: "potencia" | "nivel" | "estirada"): number {
  const p = RM.desvioBase + (sin === "potencia" ? 0 : RM.desvioPotencia * (potencia - 0.5)) - (sin === "nivel" ? 0 : RM.desvioNivel * (nivel - 50) / 50) + (sin === "estirada" ? 0 : RM.desvioEstirada * estirada);
  return Math.max(RM.desvioMin, Math.min(RM.desvioMax, p));
}

/** Primera semilla en la que el remate del escenario sale alto (barrido, como semillaAtajada del 046). */
const escenarioAlto = (reglas: Reglas, seed: number, accion: "tirar" | "mover" = "tirar") => disparo(reglas, { origen: enEje(ESCENARIO.remateLejosM), porteroEn: porteroDesplazado, nivel: ESCENARIO.nivelMaximo, sinEntorno: true, seed, accion });
let semillaAltoCache: number | undefined;
function semillaAlto(): number {
  if (semillaAltoCache !== undefined) return semillaAltoCache;
  for (let seed = 1; seed <= ESCENARIO.semillaMax; seed++) {
    const s = escenarioAlto(V5, seed); s.ticks(1);
    if (s.motor.estado.balon.vuelo?.alto) return (semillaAltoCache = seed);
  }
  throw new Error("Sin remate alto en el barrido");
}

/** Barrido de semillas: la primera cuyo escenario `crear(seed)` tiene una extracción del PRNG
 * `desvio` (tick 1, portero local del escenario) que cumple `cumple(u)`. */
function semillaDesvio(crear: (seed: number) => Escenario, cumple: (u: number, seed: number) => boolean): { seed: number; u: number } {
  for (let seed = 1; seed <= ESCENARIO.semillaMax; seed++) {
    const u = extraccionDesvio(seed, 1, portero(crear(seed).motor.estado, "local").id);
    if (cumple(u, seed)) return { seed, u };
  }
  throw new Error("Sin semilla de desvío en el barrido");
}
const enIntervalo = (u: number, a: number, b: number) => u >= Math.min(a, b) + ESCENARIO.margenPrng && u < Math.max(a, b) - ESCENARIO.margenPrng;

/** Prueba 7: poseedor visitante a `distanciaM` del centro del arco local y `ejeM` del eje. */
function escenarioPosicion(reglas: Reglas, o: { defensor: boolean; lejos?: boolean; porteroEn?: Punto }) {
  const d = o.lejos ? ESCENARIO.lejosM : ESCENARIO.posesion.distanciaM, eje = ESCENARIO.posesion.ejeM;
  const b = { x: Math.sqrt(d ** 2 - eje ** 2), y: MEDIO_Y + eje }, ancla = anclas("4-3-3", "local", "base").POR!;
  let atacante = "", defensor = "", k = "";
  const s = montar(reglas, e => {
    const a = campo(e, "visita")[0]!; atacante = a.id; colocar(a, b);
    const df = campo(e, "local")[0]!; defensor = df.id;
    if (o.defensor) colocar(df, ESCENARIO.defensor);
    const por = portero(e, "local"); k = por.id; colocar(por, o.porteroEn ?? ancla);
    e.balon = { posicion: { ...b }, poseedor: a.id, vuelo: null };
  }, e => ({ [campo(e, "visita")[0]!.id]: { accion: "conducir", destino: { ...b } }, [portero(e, "local").id]: { accion: "mover", destino: { ...ancla } } }));
  const fijar = (m: MotorArena) => {
    colocar(m.estado.jugadores.find(j => j.id === atacante)!, b); m.estado.balon.posicion = { ...b };
    if (o.defensor) colocar(m.estado.jugadores.find(j => j.id === defensor)!, ESCENARIO.defensor);
  };
  return { s, b, k, ancla, fijar };
}

// ---------------------------------------------------------------------------------------------
describe("051 · funciones puras del remate (remate.ts)", () => {
  it("1 · objetivoRemate: lado contrario al portero en ambos lados del campo; centrado → palo lejano; margen monótono y acotado (mutación: ignorar al portero; quitar la cota)", () => {
    for (const lado of lados) {
      const abs = (p: Punto) => transformar(p, lado);
      const origen = abs({ x: ARENA.largoM - ESCENARIO.remateM, y: MEDIO_Y });
      const arriba = abs({ x: ARENA.largoM - ESCENARIO.porteroLineaM, y: MEDIO_Y + ESCENARIO.porteroLateralM });
      const abajo = abs({ x: ARENA.largoM - ESCENARIO.porteroLineaM, y: MEDIO_Y - ESCENARIO.porteroLateralM });
      expect(objetivoRemate(origen, arriba, ESCENARIO.nivelMedio, REMATE_NEUTRO, lado)).toMatchObject({ lado: -1 });
      expect(objetivoRemate(origen, arriba, ESCENARIO.nivelMedio, REMATE_NEUTRO, lado).y).toBeLessThan(MEDIO_Y);
      expect(objetivoRemate(origen, abajo, ESCENARIO.nivelMedio, REMATE_NEUTRO, lado)).toMatchObject({ lado: 1 });
      expect(objetivoRemate(origen, abajo, ESCENARIO.nivelMedio, REMATE_NEUTRO, lado).y).toBeGreaterThan(MEDIO_Y);
      // Portero sobre la recta → palo lejano respecto de la y del rematador.
      for (const dy of [-ESCENARIO.rematadorLateralM, ESCENARIO.rematadorLateralM]) {
        const o = { x: ARENA.largoM - ESCENARIO.remateM, y: MEDIO_Y + dy }, t = 1 - ESCENARIO.porteroLineaM / ESCENARIO.remateM;
        const enRecta = { x: o.x + (ARENA.largoM - o.x) * t, y: o.y + (MEDIO_Y - o.y) * t };
        expect(objetivoRemate(abs(o), abs(enRecta), ESCENARIO.nivelMedio, REMATE_NEUTRO, lado).lado).toBe(dy < 0 ? 1 : -1);
      }
    }
    // Margen: monótono decreciente en nivel y en `remate`, acotado a [margenPaloM, arcoM/2]; el objetivo
    // siempre queda a ≥ margenPaloM del palo.
    const o = enEje(ESCENARIO.remateM), margen = (n: number, r: number) => objetivoRemate(o, null, n, r, "local").margenM;
    const valores = [-1000, 0, 25, 50, 75, 100, 1000];
    for (let i = 1; i < valores.length; i++) {
      expect(margen(valores[i]!, REMATE_NEUTRO)).toBeLessThanOrEqual(margen(valores[i - 1]!, REMATE_NEUTRO));
      expect(margen(ESCENARIO.nivelMedio, valores[i]!)).toBeLessThanOrEqual(margen(ESCENARIO.nivelMedio, valores[i - 1]!));
    }
    expect(margen(0, 0)).toBeGreaterThan(margen(100, 100));
    for (const n of valores) for (const r of valores) {
      const ob = objetivoRemate(o, null, n, r, "local");
      expect(ob.margenM).toBeGreaterThanOrEqual(RM.margenPaloM);
      expect(ob.margenM).toBeLessThanOrEqual(ARENA.arcoM / 2);
      expect(Math.abs(ob.y - MEDIO_Y)).toBeLessThanOrEqual(ARENA.arcoM / 2 - RM.margenPaloM + EPS);
    }
    expect(margen(1000, 1000)).toBe(RM.margenPaloM);
    expect(margen(-1000, -1000)).toBe(ARENA.arcoM / 2);
  });

  it("v1.1 #5 · distancia perpendicular a la RECTA: antes, dentro y después del segmento dan el mismo lado; casos degenerados", () => {
    for (const lado of lados) {
      const abs = (p: Punto) => transformar(p, lado);
      const o = { x: ARENA.largoM - ESCENARIO.remateM, y: MEDIO_Y - ESCENARIO.rematadorLateralM }, arco = { x: ARENA.largoM, y: MEDIO_Y };
      const largo = distancia(o, arco), dir = { x: (arco.x - o.x) / largo, y: (arco.y - o.y) / largo }, normal = { x: -dir.y, y: dir.x };
      for (const signo of [1, -1]) {
        const lados051 = ESCENARIO.tramos.map(t => {
          const k = { x: o.x + dir.x * largo * t + normal.x * ESCENARIO.separacionM * signo, y: o.y + dir.y * largo * t + normal.y * ESCENARIO.separacionM * signo };
          return objetivoRemate(abs(o), abs(k), ESCENARIO.nivelMedio, REMATE_NEUTRO, lado).lado;
        });
        // normal apunta a +y (portero hacia +y de la recta) → se apunta a −y.
        expect(lados051).toEqual(ESCENARIO.tramos.map(() => -signo));
      }
      // |arco − o| = 0: se ignora al portero y aplica el palo lejano (y = 34 → +y).
      const sobreArco = abs(arco);
      expect(objetivoRemate(sobreArco, abs({ x: arco.x - 1, y: MEDIO_Y + ESCENARIO.porteroLateralM }), ESCENARIO.nivelMedio, REMATE_NEUTRO, lado).lado).toBe(1);
      // cruz = 0 (portero exactamente sobre la recta) y lateral ≤ indiferenciaM → palo lejano.
      expect(objetivoRemate(abs(o), abs({ x: o.x + dir.x * largo / 2, y: o.y + dir.y * largo / 2 }), ESCENARIO.nivelMedio, REMATE_NEUTRO, lado).lado).toBe(1);
      // Umbral indiferenciaM (inclusivo) sobre una recta horizontal (separación exacta): rematador en
      // y = 34 (palo lejano → +y) y portero hacia +y (lado contrario → −y). Las dos ramas discrepan, así
      // que solo la separación decide: por debajo y en el umbral, palo lejano; por encima, lado contrario.
      const horizontal = enEje(ESCENARIO.remateM), porteroA = (sep: number) => ({ x: ARENA.largoM - ESCENARIO.porteroLineaM, y: MEDIO_Y + sep });
      const ladoCon = (sep: number) => objetivoRemate(abs(horizontal), abs(porteroA(sep)), ESCENARIO.nivelMedio, REMATE_NEUTRO, lado).lado;
      const separacion = (sep: number) => { const k = porteroA(sep); return Math.abs((k.x - horizontal.x) * 0 - (k.y - horizontal.y) * (ARENA.largoM - horizontal.x)) / (ARENA.largoM - horizontal.x); };
      expect(separacion(RM.indiferenciaM)).toBe(RM.indiferenciaM);
      expect(ladoCon(RM.indiferenciaM / 2)).toBe(1);
      expect(ladoCon(RM.indiferenciaM)).toBe(1);
      expect(ladoCon(RM.indiferenciaM * 2)).toBe(-1);
      // Rematador exactamente en y = 34 con el portero centrado → +y; sin portero, igual.
      expect(objetivoRemate(abs(enEje(ESCENARIO.remateM)), abs({ x: ARENA.largoM - ESCENARIO.porteroLineaM, y: MEDIO_Y }), ESCENARIO.nivelMedio, REMATE_NEUTRO, lado).lado).toBe(1);
      expect(objetivoRemate(abs(enEje(ESCENARIO.remateM)), null, ESCENARIO.nivelMedio, REMATE_NEUTRO, lado).lado).toBe(1);
    }
  });

  it("2 (pura) · errorRemate: nulo a nivel 100; escala con la distancia dentro de las cotas y con la potencia (mutación: quitar el factor de distancia)", () => {
    for (const d of [0, RM.referenciaM, ESCENARIO.remateLejosM]) for (const p of [0, 1]) expect(errorRemate(100, d, p)).toBe(0);
    const n = ESCENARIO.nivelRematador, base = errorRemate(n, RM.referenciaM, 0);
    expect(base).toBeCloseTo(RM.errorBaseM * (1 - n / 100), 12);
    expect(errorRemate(n, RM.referenciaM * RM.factorDistanciaMin / 2, 0)).toBeCloseTo(base * RM.factorDistanciaMin, 12);
    expect(errorRemate(n, RM.referenciaM * (RM.factorDistanciaMin + 1) / 2, 0)).toBeCloseTo(base * (RM.factorDistanciaMin + 1) / 2, 12);
    expect(errorRemate(n, RM.referenciaM * RM.factorDistanciaMax * 2, 0)).toBeCloseTo(base * RM.factorDistanciaMax, 12);
    expect(errorRemate(n, RM.referenciaM, 1) / base).toBeCloseTo(1 + RM.errorPotencia, 12);
  });

  it("3 (pura) · potencia 0 hasta colocadoHastaM y 1 desde potenteDesdeM; velocidad creciente con la potencia", () => {
    expect(potenciaRemate(0)).toBe(0);
    expect(potenciaRemate(RM.colocadoHastaM)).toBe(0);
    expect(potenciaRemate(RM.potenteDesdeM)).toBe(1);
    expect(potenciaRemate(RM.potenteDesdeM * 2)).toBe(1);
    const medio = potenciaRemate((RM.colocadoHastaM + RM.potenteDesdeM) / 2);
    expect(medio).toBeCloseTo(0.5, 12);
    expect(velocidadRemate(0)).toBeLessThan(velocidadRemate(medio));
    expect(velocidadRemate(medio)).toBeCloseTo(ARENA.velocidadTiroMps, 12);
    expect(velocidadRemate(1)).toBeGreaterThan(velocidadRemate(medio));
  });

  it("4 (pura) · probabilidadAlto crece con la potencia y con la falta de nivel", () => {
    expect(probabilidadAlto(100, 0)).toBeCloseTo(RM.altoBase, 12);
    expect(probabilidadAlto(ESCENARIO.nivelMedio, 1)).toBeGreaterThan(probabilidadAlto(ESCENARIO.nivelMedio, 0));
    expect(probabilidadAlto(0, ESCENARIO.nivelMedio / 100)).toBeGreaterThan(probabilidadAlto(100, ESCENARIO.nivelMedio / 100));
  });

  it("5 (pura) · alcancePortero: alcanceMinM a nivel 0, alcanceMaxM a 100, × min(1, t/reaccionS), nunca < cuerpoM (mutación: ignorar el nivel; devolver controlPorteroM)", () => {
    expect(reaccionS()).toBeCloseTo(PO.reaccionM / ARENA.velocidadTiroMps, 12);
    expect(alcancePortero(0, reaccionS())).toBeCloseTo(RM.alcanceMinM, 12);
    expect(alcancePortero(100, reaccionS())).toBeCloseTo(RM.alcanceMaxM, 12);
    expect(alcancePortero(100, reaccionS() * 3)).toBeCloseTo(RM.alcanceMaxM, 12);
    expect(alcancePortero(100, reaccionS() / 2)).toBeCloseTo(Math.max(PO.cuerpoM, RM.alcanceMaxM / 2), 12);
    expect(alcancePortero(100, 0)).toBe(PO.cuerpoM);
    expect(alcancePortero(0, reaccionS() / 100)).toBe(PO.cuerpoM);
    for (let n = 0; n <= 100; n += 10) {
      expect(alcancePortero(n, reaccionS())).toBeGreaterThanOrEqual(PO.cuerpoM);
      if (n) expect(alcancePortero(n, reaccionS())).toBeGreaterThan(alcancePortero(n - 10, reaccionS()));
    }
  });

  it("6 (pura) · probabilidadDesvio crece con potencia y estirada, decrece con el nivel, acotada y finita; v1.1 #2: estirada sin división por cero", () => {
    const p = (n: number, pot: number, e: number) => probabilidadDesvio(n, pot, e);
    expect(p(ESCENARIO.nivelMedio, 1, 0)).toBeGreaterThan(p(ESCENARIO.nivelMedio, 0, 0));
    expect(p(ESCENARIO.nivelMedio, 0.5, 1)).toBeGreaterThan(p(ESCENARIO.nivelMedio, 0.5, 0));
    expect(p(ESCENARIO.nivelAtrapa, 0.5, 0)).toBeLessThan(p(ESCENARIO.nivelDesvia, 0.5, 0));
    expect(p(ESCENARIO.nivelMedio, 0.5, 0)).toBeCloseTo(RM.desvioBase, 12);
    expect(p(-1000, 1, 1)).toBe(RM.desvioMax);
    expect(p(1000, 0, 0)).toBe(RM.desvioMin);
    // v1.1 #2: alcance = cuerpoM (bocajarro) con la distancia lateral menor e igual al radio → estirada 0.
    for (const lateral of [PO.cuerpoM / 2, PO.cuerpoM]) {
      const e = estiradaPortero(lateral, PO.cuerpoM);
      expect(e).toBe(0);
      const q = p(ESCENARIO.nivelMedio, 1, e);
      expect(Number.isFinite(q)).toBe(true);
      expect(q).toBeGreaterThanOrEqual(RM.desvioMin); expect(q).toBeLessThanOrEqual(RM.desvioMax);
    }
    expect(estiradaPortero(PO.cuerpoM, RM.alcanceMaxM)).toBe(0);
    expect(estiradaPortero(RM.alcanceMaxM, RM.alcanceMaxM)).toBe(1);
    expect(estiradaPortero(RM.alcanceMaxM * 2, RM.alcanceMaxM)).toBe(1);
    for (const raro of [Number.NaN, Infinity, -Infinity]) expect(Number.isFinite(p(ESCENARIO.nivelMedio, 0.5, raro))).toBe(true);
  });

  it("v1.1 #6 · posicionamiento sobre la línea balón–centro del arco, no sobre la bisectriz del ángulo entre los postes", () => {
    for (const lado of lados) {
      const b = transformar({ x: ESCENARIO.lateralCercano.x, y: ESCENARIO.lateralCercano.y }, lado);
      const k = transformar(destinoPosicionamiento(b, lado), lado), bo = ESCENARIO.lateralCercano, d = Math.hypot(bo.x, bo.y - MEDIO_Y);
      expect(k.x).toBeCloseTo(bo.x / d * RM.posicionamientoM, 12);
      expect(k.y).toBeCloseTo(MEDIO_Y + (bo.y - MEDIO_Y) / d * RM.posicionamientoM, 12);
      // La bisectriz del ángulo de tiro (desde el balón hacia los postes) corta la línea de gol a más de
      // diferenciaBisectrizMinM del centro, por donde pasa la línea balón–centro.
      const u = (p: Punto) => { const n = distancia(p, bo); return { x: (p.x - bo.x) / n, y: (p.y - bo.y) / n }; };
      const a = u({ x: 0, y: MEDIO_Y + ARENA.arcoM / 2 }), c = u({ x: 0, y: MEDIO_Y - ARENA.arcoM / 2 }), bis = { x: a.x + c.x, y: a.y + c.y };
      const corte = bo.y + bis.y * (-bo.x / bis.x);
      expect(Math.abs(corte - MEDIO_Y)).toBeGreaterThan(ESCENARIO.diferenciaBisectrizMinM);
    }
  });
});

// ---------------------------------------------------------------------------------------------
describe("051 · motor bajo reinicios-v5", () => {
  it("2 · error triangular: hasta.y = objetivo + (r₁ + r₂ − 1)·semiancho con el PRNG arena:golpe; nivel 100 a 8 m sin entorno → error 0 (mutación: una sola extracción)", () => {
    for (const seed of [ESCENARIO.semilla, ESCENARIO.semilla + 1, ESCENARIO.semilla + 2]) {
      const origen = { x: ARENA.largoM - ESCENARIO.remateLejosM, y: MEDIO_Y + ESCENARIO.rematadorLateralM };
      const s = disparo(V5, { origen, porteroEn: porteroDesplazado, nivel: ESCENARIO.nivelRematador, seed });
      const antes = structuredClone(s.motor.estado), t = tiradorDe(antes), arco = { x: ARENA.largoM, y: MEDIO_Y };
      s.ticks(1);
      const tiro = de(s.motor, "tiro")[0]!, nivel = nivelDe(t), d = distancia(origen, arco), potencia = potenciaRemate(d);
      const ob = objetivoRemate(origen, porteroDesplazado, nivel, t.personalidad?.remate ?? REMATE_NEUTRO, "local");
      const entorno = efectosEntorno(s.config, antes, "local", d);
      const semiancho = errorRemate(nivel, d, potencia) + entorno.errorLluviaM + entorno.errorPresionM;
      const rng = prngDerivado(seed, `arena:golpe:0:${t.id}`), r1 = rng.next(), r2 = rng.next();
      expect(tiro.hasta.x).toBeCloseTo(ARENA.largoM + ARENA.remateTrasLineaM, 12);
      expect(tiro.hasta.y).toBeCloseTo(ob.y + (r1 + r2 - 1) * semiancho, 9);
      expect(s.motor.estado.balon.vuelo).toMatchObject({ tipo: "tiro", potencia });
    }
    const cero = disparo(V5, { origen: enEje(ESCENARIO.cercaM), porteroEn: porteroDesplazado, nivel: ESCENARIO.nivelMaximo, sinEntorno: true });
    const t = tiradorDe(cero.motor.estado);
    expect(nivelDe(t)).toBe(ESCENARIO.nivelMaximo);
    cero.ticks(1);
    expect(de(cero.motor, "tiro")[0]!.hasta.y).toBe(objetivoRemate(enEje(ESCENARIO.cercaM), porteroDesplazado, ESCENARIO.nivelMaximo, t.personalidad?.remate ?? REMATE_NEUTRO, "local").y);
  });

  it("3 · el vuelo con potencia 0 tarda más ticks que con potencia 1 a la misma distancia (mutación: velocidad fija)", () => {
    const ticks = (potencia: number) => {
      const origen = { x: ARENA.largoM - ESCENARIO.remateLejosM, y: MEDIO_Y }, destino = { x: -ARENA.remateTrasLineaM, y: MEDIO_Y };
      // Remate visitante hacia el arco local con el portero apartado de la trayectoria (fuera del área no ataja).
      const s = vueloTiro(V5, { origen: transformar(origen, "visita"), balon: transformar(origen, "visita"), destino, potencia, porteroEn: { x: ARENA.areaLargoM / 2, y: MEDIO_Y + ARENA.areaAnchoM / 2 }, sinEntorno: true });
      s.hasta(sinFinRemate, ticksDe(ESCENARIO.duracionS));
      return { tick: s.motor.eventos.find(e => e.tipo === "gol")?.tick, gol: de(s.motor, "gol").length };
    };
    const lento = ticks(0), rapido = ticks(1);
    expect(lento.gol).toBe(1); expect(rapido.gol).toBe(1);
    expect(lento.tick!).toBeGreaterThan(rapido.tick!);
  });


  it("4 · remate alto: nadie lo toca, entre los palos es tiro_fuera con motivo alto, sin gol, y sigue saque de meta; por la banda, saque de banda sin tiro_fuera (mutación: permitir contacto; quitar la condición de resolverSalida)", () => {
    const seed = semillaAlto();
    const correr = (quitarAlto: boolean) => {
      const s = escenarioAlto(V5, seed);
      s.ticks(1);
      const vuelo = s.motor.estado.balon.vuelo!, k = portero(s.motor.estado, "visita").id;
      expect(vuelo.alto).toBe(true);
      expect(prngDerivado(seed, `arena:remate:0:${vuelo.autor}`).next()).toBeLessThan(probabilidadAlto(ESCENARIO.nivelMaximo, potenciaRemate(ESCENARIO.remateLejosM)));
      expect(Math.abs(vuelo.destino.y - MEDIO_Y)).toBeLessThan(ARENA.arcoM / 2);
      if (quitarAlto) delete vuelo.alto;
      // Portero plantado en la trayectoria, dentro de su área, a porteroLineaM de su línea.
      const t = (ARENA.largoM - ESCENARIO.porteroLineaM - vuelo.origen.x) / (vuelo.destino.x - vuelo.origen.x);
      const enTrayectoria = { x: vuelo.origen.x + (vuelo.destino.x - vuelo.origen.x) * t, y: vuelo.origen.y + (vuelo.destino.y - vuelo.origen.y) * t };
      s.hasta(sinFinRemate, ticksDe(ESCENARIO.duracionS), m => colocar(m.estado.jugadores.find(j => j.id === k)!, enTrayectoria));
      return s;
    };
    const alto = correr(false), m = alto.motor;
    expect(de(m, "atajada")).toEqual([]);
    expect(de(m, "intercepcion")).toEqual([]);
    expect(de(m, "gol")).toEqual([]);
    const fuera = de(m, "tiro_fuera")[0]!;
    expect(fuera.motivo).toBe("alto");
    expect(Math.abs(fuera.hasta.y - MEDIO_Y)).toBeLessThanOrEqual(ARENA.arcoM / 2);
    expect(m.eventos.find(e => e.tipo === "reinicio" && e.tick === fuera.tick)).toMatchObject({ reinicio: "meta", lado: "visita" });
    expect(m.estado.marcador).toEqual({ local: 0, visita: 0 });
    // Control: el mismo remate sin `alto` lo toca el portero plantado.
    expect(de(correr(true).motor, "atajada")).toHaveLength(1);
    // Por la banda: saque de banda y ningún tiro_fuera.
    const banda = vueloTiro(V5, { origen: { x: ESCENARIO.remateM, y: 1 }, balon: { x: ESCENARIO.remateM, y: 1 }, destino: { x: -ARENA.remateTrasLineaM, y: -ESCENARIO.remateM / 2 }, potencia: 1, alto: true, porteroEn: anclas("4-3-3", "local", "base").POR! });
    banda.hasta(b => b.eventos.some(e => e.tipo === "reinicio"), ticksDe(ESCENARIO.duracionS));
    expect(de(banda.motor, "reinicio")[0]).toMatchObject({ reinicio: "banda" });
    expect(de(banda.motor, "tiro_fuera")).toEqual([]);
  });

  it("5 · con variantes.niveles, el remate que pasa a 2,1 m del portero lo ataja con nivel 100 y entra con nivel 30 (mutación: ignorar el nivel; devolver controlPorteroM)", () => {
    const t = Math.hypot(ESCENARIO.origenM, ESCENARIO.lateralAlcanceM) / velocidadRemate(1);
    expect(alcancePortero(ESCENARIO.nivelPorteroAlto, t)).toBeGreaterThan(ESCENARIO.lateralAlcanceM);
    expect(alcancePortero(ESCENARIO.nivelPorteroBajo, t)).toBeLessThan(ESCENARIO.lateralAlcanceM);
    const k = anclas("4-3-3", "local", "base").POR!, y = k.y + ESCENARIO.lateralAlcanceM;
    expect(Math.abs(y - MEDIO_Y)).toBeLessThan(ARENA.arcoM / 2);
    const pasar = (reglas: Reglas, nivel: number) => {
      const s = vueloTiro(reglas, { origen: { x: k.x + ESCENARIO.origenM, y }, balon: { x: k.x + ESCENARIO.balonAdelanteM, y }, destino: { x: -ARENA.remateTrasLineaM, y }, potencia: 1, porteroEn: k,
        partido: partidoConNiveles(ESCENARIO.semilla, nivel, null), sinEntorno: true });
      expect(portero(s.motor.estado, "local").nivel).toBe(nivel);
      s.hasta(sinFinRemate, ticksDe(ESCENARIO.duracionS));
      return s.motor;
    };
    expect(de(pasar(V5, ESCENARIO.nivelPorteroAlto), "atajada")).toHaveLength(1);
    const bajo = pasar(V5, ESCENARIO.nivelPorteroBajo);
    expect(de(bajo, "atajada")).toEqual([]);
    expect(de(bajo, "gol")).toHaveLength(1);
  });

  it("v1.1 #3 · una sola velocidad efectiva: con sintética y césped alto el alcance cambia en el factor del entorno a 4 m del origen; saturado no cambia (mutación d: ignorar el entorno en la reacción)", () => {
    const nivel = ESCENARIO.nivelPorteroAlto, potencia = 0.5, v = velocidadRemate(potencia);
    const entornos = {
      corto: (c: NonNullable<SimConfig["condiciones"]>) => { c.clima = "despejado"; delete c.temperaturaC; c.superficie = "natural"; c.cesped = "corto"; },
      sintetica: (c: NonNullable<SimConfig["condiciones"]>) => { c.clima = "despejado"; delete c.temperaturaC; c.superficie = "sintetica"; delete c.cesped; },
      alto: (c: NonNullable<SimConfig["condiciones"]>) => { c.clima = "despejado"; delete c.temperaturaC; c.superficie = "natural"; c.cesped = "alto"; },
    };
    const factor = { corto: 1, sintetica: efectosEntorno({ partido: { condiciones: { clima: "despejado", superficie: "sintetica", presion: { local: "baja", visita: "media" } } } }, crearEstadoArena(crearConfigArena()), "visita").velocidadBalon,
      alto: efectosEntorno({ partido: { condiciones: { clima: "despejado", superficie: "natural", cesped: "alto", presion: { local: "baja", visita: "media" } } } }, crearEstadoArena(crearConfigArena()), "visita").velocidadBalon };
    expect(factor.sintetica).toBeGreaterThan(1); expect(factor.alto).toBeLessThan(1);
    const alcance = (f: number) => alcancePortero(nivel, ESCENARIO.origenNoSaturadoM / (v * f));
    // El alcance no saturado cambia exactamente por el factor de velocidad del balón.
    expect(alcance(factor.sintetica) / alcance(1)).toBeCloseTo(1 / factor.sintetica, 12);
    const toca = (clave: keyof typeof entornos, lateralM: number, origenM: number) => {
      const { s } = contacto(V5, { lateralM, origenM, potencia, partido: partidoConNiveles(ESCENARIO.semilla, nivel, null), condiciones: entornos[clave] });
      return desenlace(s) !== "ninguno";
    };
    const entreSintetica = (alcance(factor.sintetica) + alcance(1)) / 2, entreAlto = (alcance(1) + alcance(factor.alto)) / 2;
    expect(toca("corto", entreSintetica, ESCENARIO.origenNoSaturadoM)).toBe(true);
    expect(toca("sintetica", entreSintetica, ESCENARIO.origenNoSaturadoM)).toBe(false);
    expect(toca("corto", entreAlto, ESCENARIO.origenNoSaturadoM)).toBe(false);
    expect(toca("alto", entreAlto, ESCENARIO.origenNoSaturadoM)).toBe(true);
    // Saturado (origen lejano): el mismo contacto en los tres entornos.
    const saturado = (RM.alcanceMaxM + entreAlto) / 2;
    for (const clave of Object.keys(entornos) as (keyof typeof entornos)[]) expect(toca(clave, saturado, ESCENARIO.origenM)).toBe(true);
  });


  it("6 · un contacto que es atrapada con nivel 90 es desvío con nivel 10 con la misma semilla (mutación: constante desvioProbabilidad)", () => {
    const crear = (nivel: number) => (seed: number) => contacto(V5, { lateralM: 0, origenM: ESCENARIO.origenM, potencia: 0.5, seed, partido: partidoConNiveles(seed, nivel, null) }).s;
    // El nivel cambia la plantilla elegida: la semilla debe servir con ambos niveles (mismo portero).
    const mismoPortero = (seed: number) => portero(crear(ESCENARIO.nivelAtrapa)(seed).motor.estado, "local").id === portero(crear(ESCENARIO.nivelDesvia)(seed).motor.estado, "local").id;
    const { seed } = semillaDesvio(crear(ESCENARIO.nivelAtrapa), (u, seed) => mismoPortero(seed) && enIntervalo(u, desvioReferencia(ESCENARIO.nivelAtrapa, 0.5, 0), desvioReferencia(ESCENARIO.nivelDesvia, 0.5, 0)));
    expect(portero(crear(ESCENARIO.nivelAtrapa)(seed).motor.estado, "local").id).toBe(portero(crear(ESCENARIO.nivelDesvia)(seed).motor.estado, "local").id);
    expect(desenlace(crear(ESCENARIO.nivelAtrapa)(seed))).toBe("atrapada");
    expect(desenlace(crear(ESCENARIO.nivelDesvia)(seed))).toBe("desvio");
  });

  it("v1.1 #7 (a)–(c) · cada término del desvío cambia el desenlace al quitarlo (mutaciones 15–17: sin potencia, sin nivel, sin estirada)", () => {
    const casos = [
      { sin: "potencia" as const, nivel: ESCENARIO.nivelMedio, potencia: 1, lateralM: 0 },
      { sin: "nivel" as const, nivel: ESCENARIO.nivelAtrapa, potencia: 0.5, lateralM: 0 },
      { sin: "estirada" as const, nivel: ESCENARIO.nivelMedio, potencia: 0.5, lateralM: ESCENARIO.estiradaLateralM },
    ];
    for (const c of casos) {
      const radio = alcancePortero(c.nivel, ESCENARIO.origenM / velocidadRemate(c.potencia)), estirada = c.lateralM ? Math.min(1, Math.max(0, (c.lateralM - PO.cuerpoM) / (radio - PO.cuerpoM))) : 0;
      const completo = desvioReferencia(c.nivel, c.potencia, estirada), sin = desvioReferencia(c.nivel, c.potencia, estirada, c.sin);
      const crear = (seed: number) => contacto(V5, { lateralM: c.lateralM, origenM: ESCENARIO.origenM, potencia: c.potencia, seed, partido: partidoConNiveles(seed, c.nivel, null) }).s;
      const { seed, u } = semillaDesvio(crear, x => enIntervalo(x, completo, sin));
      const r = desenlace(crear(seed));
      expect({ termino: c.sin, r }).toEqual({ termino: c.sin, r: u < completo ? "desvio" : "atrapada" });
      expect(u < completo).not.toBe(u < sin);
    }
  });


  it("7 · posicionamiento: sin mano a mano el portero va hacia C + u·posicionamientoM y queda en su área; lejos vuelve al ancla; en mano a mano manda destinoSalida (mutación: quitar la rama; aplicarla en mano a mano)", () => {
    const { s, b, k, fijar } = escenarioPosicion(V5, { defensor: true });
    const objetivo = destinoPosicionamiento(b, "local"), inicio = { ...s.j(k).posicion };
    s.ticks(ticksDe(1), fijar);
    expect(de(s.motor, "tiro")).toEqual([]);
    expect(distancia(inicio, objetivo) - distancia(s.j(k).posicion, objetivo)).toBeGreaterThan(L.desplazamientoM);
    expect(enAreaPropia(s.j(k).posicion, "local")).toBe(true);
    // Balón a más de manoAManoRadioM: vuelve a su ancla (orden mover).
    const lejos = escenarioPosicion(V5, { defensor: true, lejos: true, porteroEn: objetivo });
    expect(distancia(lejos.b, C_LOCAL)).toBeGreaterThan(PO.manoAManoRadioM);
    lejos.s.ticks(ticksDe(1), lejos.fijar);
    expect(distancia(lejos.s.j(lejos.k).posicion, lejos.ancla)).toBeLessThan(distancia(objetivo, lejos.ancla) - L.desplazamientoM);
    // Mano a mano (sin defensor por delante): sale sobre la línea hacia destinoSalida, más allá del posicionamiento.
    const mam = escenarioPosicion(V5, { defensor: false });
    const u = { x: (mam.b.x - C_LOCAL.x) / ESCENARIO.posesion.distanciaM, y: (mam.b.y - C_LOCAL.y) / ESCENARIO.posesion.distanciaM };
    const proyeccionU = (p: Punto) => (p.x - C_LOCAL.x) * u.x + (p.y - C_LOCAL.y) * u.y;
    const p0 = proyeccionU(mam.s.j(mam.k).posicion);
    mam.s.ticks(ticksDe(1), mam.fijar);
    expect(proyeccionU(destinoSalida(mam.b, "local"))).toBeGreaterThan(p0);
    expect(proyeccionU(mam.s.j(mam.k).posicion) - p0).toBeGreaterThan(L.desplazamientoM);
  });

  it("v1.1 #7 (e) · un pase rival en vuelo a ≤ manoAManoRadioM mueve al portero aunque no haya poseedor (mutación 19)", () => {
    const medir = (reglas: Reglas) => {
      const { s, b, k } = escenarioPosicion(reglas, { defensor: true });
      const autor = s.motor.estado.balon.poseedor!, objetivo = destinoPosicionamiento(b, "local"), inicio = { ...s.j(k).posicion };
      // Pase visitante hacia un compañero aparcado lejos, retenido en b durante el escenario.
      const lejos = campo(s.motor.estado, "visita")[1]!;
      const pase = (m: MotorArena) => { m.estado.balon = { posicion: { ...b }, poseedor: null, ultimoToque: { jugador: autor, lado: "visita" }, vuelo: { tipo: "pase", autor, lado: "visita", receptor: lejos.id, origen: { ...b }, destino: { ...lejos.posicion }, inicioTick: m.estado.tick, adelantados: [] } }; };
      pase(s.motor);
      s.ticks(ticksDe(1), pase);
      return distancia(inicio, objetivo) - distancia(s.j(k).posicion, objetivo);
    };
    expect(medir(V5)).toBeGreaterThan(L.desplazamientoM);
    expect(medir("reinicios-v4")).toBeLessThan(L.desplazamientoM);
  });

  it("8 · la orden tirar sigue la misma ruta que la decisión local: mismo objetivo, potencia y alto; el esquema no cambia (mutación: ruta distinta para la orden)", () => {
    const seed = semillaAlto();
    const vuelo = (accion: "tirar" | "mover") => {
      const s = escenarioAlto(V5, seed, accion); s.ticks(1);
      return { tiro: de(s.motor, "tiro")[0], vuelo: s.motor.estado.balon.vuelo };
    };
    const orden = vuelo("tirar"), local = vuelo("mover");
    expect(orden.tiro).toBeDefined();
    expect(orden.vuelo?.alto).toBe(true);
    expect(local).toEqual(orden);
    // El esquema de órdenes no gana campos: sin lado del remate (§ 11, corte decidido).
    expect(esquemaOrdenes.shape.ordenes.element.shape.accion.options).toEqual(["mover", "apoyar", "profundidad", "cubrir", "presionar", "conducir", "pasar", "tirar", "centrar"]);
    const s = escenarioAlto(V5, seed), esquema = esquemaRespuestaArena(observarArena(s.motor, "local")) as { properties: { ordenes: { items: { properties: Record<string, unknown> } } } };
    expect(Object.keys(esquema.properties.ordenes.items.properties)).toEqual(["jugador", "accion", "destino", "receptor"]);
  });

  it("v1.1 #7 (f) · la velocidad del remate depende de la potencia: más ticks de vuelo hasta el portero con potencia 0 (mutación 20)", () => {
    const hastaContacto = (potencia: number) => {
      const { s } = contacto(V5, { lateralM: 0, origenM: ESCENARIO.origenM, potencia, aM: ESCENARIO.origenM - 1 });
      s.hasta(m => de(m, "atajada").length > 0, ticksDe(ESCENARIO.duracionS));
      return de(s.motor, "atajada")[0]!.tick;
    };
    expect(hastaContacto(0)).toBeGreaterThan(hastaContacto(1));
  });
});

// ---------------------------------------------------------------------------------------------
describe("051 · versiones", () => {
  const leer = async (nombre: string) => JSON.parse(await readFile(`src/arena/__fixtures__/${nombre}.json`, "utf8")) as RegistroArena;

  it("9 · v1–v4 exactos; el fixture v5 cumple sus condiciones y se reproduce; validación y valor por defecto", async () => {
    for (const v of ["v1", "v2", "v3", "v4"]) {
      const r = await leer(`arena-reinicios-${v}`);
      expect(r.config.reglas).toBe(`reinicios-${v}`);
      expect(reproducirArena(r)).toEqual(r);
    }
    const r = await leer("arena-reinicios-v5");
    expect(r.config.reglas).toBe(V5);
    expect(r.config.duracionS).toBe(DURACION_FIXTURE_V5_S);
    expect(condicionesFixtureV5(r)).toEqual({ reglas: true, alto: true, ancho: true, desvio: true, atrapada: true, golColocado: true });
    expect(cumpleFixtureV5(r)).toBe(true);
    expect(r.rondas.flatMap(x => Object.values(x.decisiones)).every(d => d.tiempoMs === 0)).toBe(true);
    expect(reproducirArena(structuredClone(r))).toEqual(r);

    // Brief 063 § 3.3: reinicios-v5 pasa a ser literal; la lista completa y la predeterminada de cada
    // publicación las fija motor063.test.ts (0.1).
    expect(reglasArena.slice(0, 5)).toEqual(["reinicios-v1", "reinicios-v2", "reinicios-v3", "reinicios-v4", V5]);
    expect(crearConfigArena({ reglas: V5 }).reglas).toBe(V5);
    const base = crearConfigArena({ reglas: V5 });
    // Brief 063 § 4.3: desde reinicios-v7 la configuración lleva además sus atributos.
    for (const reglas of reglasArena) expect(() => validarConfigArena(conReglas(base, reglas))).not.toThrow();
    expect(() => validarConfigArena({ ...base, reglas: "reinicios-otra" as never })).toThrow("Reglas");
    for (const [i, reglas] of reglasArena.entries()) expect(reglasDesde({ ...base, reglas }, V5)).toBe(i >= 4);
  });

  it("9 · matriz: cada comportamiento nuevo cambia el resultado solo con v5 (mutación: activar una regla con v4 o conReinicios)", () => {
    const seedAlto = (() => { for (let seed = 1; seed <= ESCENARIO.semillaMax; seed++) { const s = escenarioAltoM(V5, seed); s.ticks(1); if (s.motor.estado.balon.vuelo?.alto) return seed; } throw new Error("Sin alto"); })();
    function escenarioAltoM(reglas: Reglas, seed: number) { return disparo(reglas, { origen: enEje(ESCENARIO.remateLejosM), porteroEn: porteroDesplazado, nivel: ESCENARIO.nivelMaximo, sinEntorno: true, seed }); }
    const { seed: seedDesvio } = semillaDesvio(seed => contacto(V5, { lateralM: 0, origenM: ESCENARIO.origenM, potencia: 0.5, seed, partido: partidoConNiveles(seed, ESCENARIO.nivelDesvia, null) }).s,
      u => enIntervalo(u, ARENA.desvioProbabilidad, desvioReferencia(ESCENARIO.nivelDesvia, 0.5, 0)));
    const k = anclas("4-3-3", "local", "base").POR!, yAlcance = k.y + ESCENARIO.lateralAlcanceM;
    const comportamientos: { nombre: string; medir: (r: Reglas) => boolean }[] = [
      { nombre: "objetivo", medir: r => { const s = disparo(r, { origen: enEje(ESCENARIO.remateM), porteroEn: porteroDesplazado, nivel: ESCENARIO.nivelMaximo, sinEntorno: true }); s.ticks(1); return Math.abs(de(s.motor, "tiro")[0]!.hasta.y - MEDIO_Y) > ARENA.arcoM / 4; } },
      { nombre: "error", medir: r => {
        const origen = { x: ARENA.largoM - ESCENARIO.remateLejosM, y: MEDIO_Y }, s = disparo(r, { origen, nivel: ESCENARIO.nivelRematador, sinEntorno: true });
        const t = tiradorDe(s.motor.estado), porteroEn = { ...portero(s.motor.estado, "visita").posicion }; s.ticks(1);
        const y = de(s.motor, "tiro")[0]!.hasta.y, rng = prngDerivado(ESCENARIO.semilla, `arena:golpe:0:${t.id}`), r1 = rng.next(), r2 = rng.next();
        const d = distancia(origen, { x: ARENA.largoM, y: MEDIO_Y }), nivel = nivelDe(t), v5 = r === V5;
        const centro = v5 ? objetivoRemate(origen, porteroEn, nivel, t.personalidad?.remate ?? REMATE_NEUTRO, "local").y : MEDIO_Y;
        const semiancho = v5 ? errorRemate(nivel, d, potenciaRemate(d)) : (1 - nivel / 100) * ARENA.errorTiroM;
        return Math.abs(y - (centro + (r1 + r2 - 1) * semiancho)) < EPS && Math.abs(y - (centro + (2 * r1 - 1) * semiancho)) > EPS;
      } },
      { nombre: "alto", medir: r => { const s = escenarioAltoM(r, seedAlto); s.hasta(sinFinRemate, ticksDe(ESCENARIO.duracionS)); return s.motor.eventos.some(e => e.tipo === "tiro_fuera" && e.motivo === "alto"); } },
      { nombre: "alcance", medir: r => { const s = vueloTiro(r, { origen: { x: k.x + ESCENARIO.origenM, y: yAlcance }, balon: { x: k.x + ESCENARIO.balonAdelanteM, y: yAlcance }, destino: { x: -ARENA.remateTrasLineaM, y: yAlcance }, potencia: 1, porteroEn: k, partido: partidoConNiveles(ESCENARIO.semilla, ESCENARIO.nivelPorteroAlto, null), sinEntorno: true }); s.hasta(sinFinRemate, ticksDe(ESCENARIO.duracionS)); return de(s.motor, "atajada").length > 0; } },
      { nombre: "desvío", medir: r => desenlace(contacto(r, { lateralM: 0, origenM: ESCENARIO.origenM, potencia: 0.5, seed: seedDesvio, partido: partidoConNiveles(seedDesvio, ESCENARIO.nivelDesvia, null) }).s) === "desvio" },
      { nombre: "posicionamiento", medir: r => { const { s, b, k: id, fijar } = escenarioPosicion(r, { defensor: true }); const o = destinoPosicionamiento(b, "local"), p0 = { ...s.j(id).posicion }; s.ticks(ticksDe(1), fijar); return distancia(p0, o) - distancia(s.j(id).posicion, o) > L.desplazamientoM; } },
      { nombre: "velocidad", medir: r => {
        const ticks = (potencia: number) => { const { s } = contacto(r, { lateralM: 0, origenM: ESCENARIO.origenM, potencia, aM: ESCENARIO.origenM - 1 }); s.hasta(m => de(m, "atajada").length > 0 || sinFinRemate(m), ticksDe(ESCENARIO.duracionS)); return s.motor.eventos.find(e => ["atajada", "gol", "tiro_fuera"].includes(e.tipo))!.tick; };
        return ticks(0) !== ticks(1);
      } },
    ];
    for (const c of comportamientos) {
      expect({ c: c.nombre, v5: c.medir(V5) }).toEqual({ c: c.nombre, v5: true });
      for (const r of ANTERIORES) expect({ c: c.nombre, reglas: r ?? "sin reglas", nuevo: c.medir(r) }).toEqual({ c: c.nombre, reglas: r ?? "sin reglas", nuevo: false });
    }
  });
});

// ---------------------------------------------------------------------------------------------
describe("051 · relato, narración y 049", () => {
  const leer = async () => JSON.parse(await readFile("src/arena/__fixtures__/arena-reinicios-v5.json", "utf8")) as RegistroArena;
  const nombre = (r: RegistroArena, id: string) => [...r.inicial.jugadores, ...r.inicial.banco ?? []].find(j => j.id === id)!;

  it("10 · textos ES/EN del remate alto (vista y modo breve), narrador de plantilla V1–V8 y conteo 049 como fuera o bloqueado (mutación: texto genérico; contar el alto a puerta)", async () => {
    const r = await leer();
    const alto = r.eventos.find(e => e.tipo === "tiro_fuera" && e.motivo === "alto")!, ancho = r.eventos.find(e => e.tipo === "tiro_fuera" && !e.motivo)!;
    const j = nombre(r, alto.jugador), n = `${j.nombre} (${j.dorsal})`, na = `${nombre(r, ancho.jugador).nombre} (${nombre(r, ancho.jugador).dorsal})`;
    expect(narrarEventoArena(alto, r, "es")).toBe(`El remate de ${n} se va por encima del travesaño.`);
    expect(narrarEventoArena(alto, r, "en")).toBe(`${n}'s shot goes over the bar.`);
    expect(narrarEventoArena(ancho, r, "es")).toBe(`El remate de ${na} sale fuera.`);
    expect(narrarEventoArena(ancho, r, "en")).toBe(`${na}'s shot goes wide.`);
    // Modo breve (vivo): las cuatro variantes por idioma. La variante sale de varianteVoz(semilla, id del
    // evento): se renombra el evento hasta obtener cada índice y se exige exactamente esa frase.
    const variantes = {
      es: [`¡Alto el remate de ${j.nombre}!`, `¡Se va por encima el disparo de ${j.nombre}!`, `¡${j.nombre} la manda por encima del travesaño!`, `¡Por encima! Remate de ${j.nombre}.`],
      en: [`${j.nombre} blazes it over!`, `${j.nombre}'s shot sails over the bar!`, `Over the bar from ${j.nombre}!`, `${j.nombre} lifts it over!`],
    };
    const intervalo = RELATO_INTERVALOS.vivo, desde = Math.floor((alto.tick - 1) / intervalo) * intervalo;
    for (let k = 0; k < variantes.es.length; k++) {
      let n = 0; while (varianteVoz(r.config.partido.seed, `alto-${n}`) !== k) n++;
      const id = `alto-${n}`, renombrado = { ...r, eventos: r.eventos.map(e => e.id === alto.id ? { ...e, id } : e) };
      for (const idioma of ["es", "en"] as const) {
        const texto = construirRelato(renombrado, desde, alto.tick, "vivo", idioma).texto;
        expect({ idioma, k, frase: variantes[idioma][k], esta: texto.includes(variantes[idioma][k]!), otras: variantes[idioma].filter((v, i) => i !== k && texto.includes(v)) })
          .toEqual({ idioma, k, frase: variantes[idioma][k], esta: true, otras: [] });
      }
    }
    // Narrador de plantilla (LLM caído) con el alto como hecho principal: pasa V1–V8.
    const caido: Llm = { id: "llm-caido", async completar() { throw new Error("sin servicio"); } };
    const c = await narrarArena(r, alto.tick, caido, { principal: `arena:${alto.id}` });
    expect(c).toMatchObject({ modo: "plantilla", principal: `arena:${alto.id}` });
    expect(c!.oraciones[0]!.texto_es).toBe(narrarEventoArena(alto, r, "es"));
    // 045/049: el alto no es «a puerta»; es «fuera o bloqueado» (indirecto).
    const tiro = r.eventos.filter(e => e.tipo === "tiro" && e.jugador === alto.jugador && e.tick <= alto.tick).at(-1)!;
    const rp = rematesPorLado(r.eventos, alto.tick), ids = rp[tiro.lado].eventos, i = ids.indexOf(tiro.id);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(ids[i + 1] === undefined || r.eventos.find(e => e.id === ids[i + 1])!.tipo === "tiro").toBe(true);
    expect(agregarPrefijo(r, alto.tick).jugadores.get(alto.jugador)!.indirectosEv).toContain(tiro.id);
    const sintetico: EventoArena[] = [{ ...tiro, id: "s1" }, { ...alto, id: "s2" }];
    expect(rematesPorLado(sintetico, alto.tick)[tiro.lado]).toMatchObject({ total: 1, aPuerta: 0 });
    // estadista.ts sin cambios (git diff vacío) cuando hay repositorio git.
    let diff: string | null = null;
    try { diff = execFileSync("git", ["-c", "safe.directory=*", "diff", "HEAD", "--", "src/arena/estadista.ts"], { encoding: "utf8" }); } catch { diff = null; }
    if (diff !== null) expect(diff).toBe("");
  });
});

// ---------------------------------------------------------------------------------------------
describe("051 · helper de métricas: desenlace físico, lectura 045 e intercepciones (v1.1 #1 y #4)", () => {
  const A = "local-5", B = "visita-3", K = "visita-0", COMP = "local-6";
  const ev = (id: string, tick: number, tipo: EventoArena["tipo"], jugador: string, lado: Lado, extra: Partial<EventoArena> = {}): EventoArena =>
    ({ id, tick, tipo, lado, jugador, receptor: null, desde: { x: 0, y: 0 }, hasta: { x: 0, y: 0 }, distanciaM: 0, ...extra });
  const muestras: MuestraTick[] = [{ tick: 0, eventos: 0, poseedor: null, balon: { x: 0, y: 0 }, manos: null, pausado: false, manoAMano: null, conducir: null, vuelo: false, vueloInicioTick: null, superado: null, seleccion: null, persecucion: null,
    jugadores: [{ id: A, lado: "local", puesto: "DEL", x: 0, y: 0, vx: 0, vy: 0 }, { id: K, lado: "visita", puesto: "POR", x: ARENA.largoM, y: MEDIO_Y, vx: 0, vy: 0 }, { id: "local-0", lado: "local", puesto: "POR", x: 0, y: MEDIO_Y, vx: 0, vy: 0 }] }];
  const tiro = ev("t", 1, "tiro", A, "local", { hasta: { x: ARENA.largoM, y: MEDIO_Y } });

  it("v1.1 #1 · listas sintéticas: desenlace físico frente a rematesPorLado y discrepancias", () => {
    const casos: { nombre: string; eventos: EventoArena[]; fisico: string; aPuerta: number; discrepancias: number }[] = [
      { nombre: "tiro → intercepción → gol", eventos: [tiro, ev("i", 2, "intercepcion", B, "visita", { receptor: A }), ev("g", 5, "gol", A, "local")], fisico: "bloqueado", aPuerta: 1, discrepancias: 1 },
      { nombre: "tiro → recuperación → gol", eventos: [tiro, ev("r", 2, "recuperacion", B, "visita"), ev("g", 5, "gol", A, "local")], fisico: "otro", aPuerta: 1, discrepancias: 1 },
      { nombre: "tiro → falta → reinicio", eventos: [tiro, ev("f", 2, "falta", B, "visita", { receptor: A }), ev("x", 2, "reinicio", A, "local")], fisico: "otro", aPuerta: 0, discrepancias: 0 },
      { nombre: "tiro → recepción de un compañero", eventos: [tiro, ev("c", 2, "recepcion", COMP, "local", { receptor: A })], fisico: "otro", aPuerta: 0, discrepancias: 0 },
      { nombre: "tiro → tiro_fuera alto", eventos: [tiro, ev("o", 3, "tiro_fuera", A, "local", { motivo: "alto" })], fisico: "alto", aPuerta: 0, discrepancias: 0 },
      { nombre: "tiro → tiro_fuera ancho", eventos: [tiro, ev("o", 3, "tiro_fuera", A, "local")], fisico: "ancho", aPuerta: 0, discrepancias: 0 },
      { nombre: "tiro → atajada desvío", eventos: [tiro, ev("a", 3, "atajada", K, "visita", { receptor: A, motivo: "desvio" })], fisico: "desvio", aPuerta: 1, discrepancias: 0 },
      { nombre: "tiro → gol", eventos: [tiro, ev("g", 3, "gol", A, "local")], fisico: "gol", aPuerta: 1, discrepancias: 0 },
    ];
    for (const c of casos) {
      const m = analizarPartido(1, muestras, c.eventos);
      expect({ c: c.nombre, fisico: desenlaceFisico(c.eventos, 0), aPuerta: m.aPuerta045, discrepancias: m.discrepancias045, aPuerta045: rematesPorLado(c.eventos, Infinity).local.aPuerta })
        .toEqual({ c: c.nombre, fisico: c.fisico, aPuerta: c.aPuerta, discrepancias: c.discrepancias, aPuerta045: c.aPuerta });
    }
    // Goles sin remate: tras conducción (sin tiro previo) cuenta; tras tiro o desvío no.
    expect(analizarPartido(1, muestras, [ev("p", 1, "pase", A, "local"), ev("g", 4, "gol", A, "local")]).golesSinRemate).toBe(1);
    expect(analizarPartido(1, muestras, [tiro, ev("a", 2, "atajada", K, "visita", { receptor: A, motivo: "desvio" }), ev("g", 3, "gol", K, "local", { autogol: true })]).golesSinRemate).toBe(0);
  });

  it("14 · intercepciones inmediatas: temporal (046) y cercana (≤ inmediataRadioM) con límites inclusivos (mutación: ignorar el radio)", () => {
    const desde: Punto = { x: ARENA.areaLargoM / 2, y: MEDIO_Y }, saqueTick = 10;
    const saque = ev("s", saqueTick, "pase", "local-0", "local", { motivo: "saque_manos", desde, receptor: COMP });
    const caso = (metros: number, segundos: number) => {
      const toque = ev("i", saqueTick + Math.round(segundos / ARENA.pasoS), "intercepcion", B, "visita", { receptor: "local-0", hasta: { x: desde.x + metros, y: desde.y } });
      const m = analizarPartido(1, muestras, [saque, toque]);
      return { temporal: m.intercepcionesInmediatas, cercana: m.intercepcionesInmediatasCercanas };
    };
    const r = L.inmediataRadioM, t = L.saqueInmediataS;
    expect(caso(r / 3, t * 0.6)).toEqual({ temporal: 1, cercana: 1 });      // saque corto defectuoso
    expect(caso(r * 2 / 3, t * 0.6)).toEqual({ temporal: 1, cercana: 1 });  // saque largo defectuoso
    expect(caso(r * 1.4, t)).toEqual({ temporal: 1, cercana: 0 });          // disputa aérea legal lejana
    expect(caso(r, t)).toEqual({ temporal: 1, cercana: 1 });                // límites inclusivos
    expect(caso(r / 3, t + ARENA.pasoS)).toEqual({ temporal: 0, cercana: 0 });
    // Bandas: cercanas = 0 en ambos lotes; temporal ≤ 1 en `rapido` y ≤ 0,01 por partido en `completo`.
    const lote = (temporal: number, cercana: number, partidos: number) => {
      const ps = Array.from({ length: partidos }, (_, i) => analizarPartido(i + 1, muestras, i < temporal ? [saque, ev("i", saqueTick + 1, "intercepcion", B, "visita", { receptor: "local-0", hasta: { x: desde.x + (i < cercana ? r / 3 : r * 2), y: desde.y } })] : [saque]));
      return agregarLote(V5, L.duracionS, ps);
    };
    expect(incumplimientosSaques(lote(1, 0, L.rapido.semillas), L.rapido).filter(f => f.startsWith("intercepciones"))).toEqual([]);
    expect(incumplimientosSaques(lote(2, 0, L.rapido.semillas), L.rapido).some(f => f.startsWith("intercepcionesInmediatas="))).toBe(true);
    expect(incumplimientosSaques(lote(1, 1, L.rapido.semillas), L.rapido).some(f => f.startsWith("intercepcionesInmediatasCercanas="))).toBe(true);
    const n = L.completo.semillas, permitidas = Math.floor(L.completo.intercepcionesInmediatasPorPartidoMax * n + EPS);
    expect(incumplimientosSaques(lote(permitidas, 0, n), L.completo).filter(f => f.startsWith("intercepciones"))).toEqual([]);
    expect(incumplimientosSaques(lote(permitidas + 1, 0, n), L.completo).some(f => f.startsWith("intercepcionesInmediatasPorPartido="))).toBe(true);
    expect(incumplimientosSaques(lote(1, 1, n), L.completo).some(f => f.startsWith("intercepcionesInmediatasCercanas="))).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
describe("051 · lote rápido (bandas `rapido` de LOTE_ARENA_051 y LOTE_ARENA_046 sobre v5)", () => {
  it("12 · cumple las bandas rápidas, con el experimento controlado de porteros", { timeout: 300_000 }, async () => {
    const lote = { desde: L.rapido.semillaDesde, semillas: L.rapido.semillas, reglas: V5 };
    const m = await medirLote(lote);
    console.log("[051 v5 rápido]", JSON.stringify(m.remate));
    expect(m.partidos).toBe(L.rapido.semillas);
    expect(m.reglas).toBe(V5);
    expect(incumplimientos(m, L.rapido, L51.rapido)).toEqual([]);
    const porteros = await medirControlado({ ...lote, quien: "portero" });
    console.log("[051 v5 rápido · controlado porteros]", porteros.diferencia);
    expect(incumplimientosControlado({ porteros: porteros.diferencia }, L51.rapido)).toEqual([]);
  });
});
