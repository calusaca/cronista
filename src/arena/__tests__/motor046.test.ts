// Brief 046 (v1.1): portero con el balón en las manos, salida a achicar, centros, laterales y
// reglas reinicios-v4 con gating por versión. Las cifras salen de limites.ts; los valores propios
// de cada escenario se nombran como tales en ESCENARIO.
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { ARENA, ATAQUE_ARENA as A, ENTORNO_ARENA as E, LOTE_ARENA_046 as L, NIVEL, PERSONALIDAD_ARENA as P, PORTERO_ARENA as PO, TECNICA_ARENA as T } from "../../sim/limites";
import type { Lado } from "../../sim/tipos";
import type { Llm } from "../../lib/llm";
import { conduccionPorDefecto, destinosLlegada, objetivosCentro, opcionCentro, puntoGiro, receptorCentro } from "../ataque";
import { anclas, transformar } from "../catalogo";
import { crearControladorLlm, crearControladorProgramado, esquemaRespuestaArena, frasesCentroPortero, opcionPase, planProgramado, SISTEMA_ARENA, validarOrdenes } from "../controladores";
import { ejecutarArena, observarArena, reproducirArena } from "../coordinador";
import { cumpleFixtureV4, salidasEnFotogramas } from "../__fixtures__/generar-reinicios-v4";
import { distancia, proyeccion } from "../geometria";
import { incumplimientos, medirLote } from "../metricas-lote";
import { crearConfigArena, crearEstadoArena, MotorArena, reglasDesde, validarConfigArena } from "../motor";
import { narrarArena } from "../narrador";
import { prefiereConducir } from "../personalidades";
import { despejeManos, enAreaPropia, manoAMano, radioAtajada, respetarManos, saqueAdmisible, saqueForzado } from "../portero";
import { RELATO_INTERVALOS } from "../protocolo";
import { construirRelato } from "../relato";
import { lados, reglasArena, type ConfigArena, type EstadoArena, type EventoArena, type JugadorArena, type ObservacionArena, type OrdenesEquipo, type OrdenJugador, type Punto, type RegistroArena, type ReglasArena } from "../tipos";
import { narrarEventoArena } from "../vista";

const MEDIO_Y = ARENA.anchoM / 2;
const V4 = "reinicios-v4" as const;
type Reglas = ReglasArena | undefined;
/** Matriz de versiones (v1.1): v1, v2, v3 y archivos sin `reglas` frente a v4. */
const ANTERIORES: readonly Reglas[] = ["reinicios-v1", "reinicios-v2", "reinicios-v3", undefined];
const ticksDe = (segundos: number) => Math.round(segundos / ARENA.pasoS);
/** v1.2: radio que respetan los rivales del portero con manos (histéresis). */
const RADIO_MANOS = PO.distanciaManosM + PO.margenManosM;

/** Valores propios de los escenarios: posiciones y duraciones elegidas para aislar cada regla. */
const ESCENARIO = {
  semilla: 7, duracionS: 30, intervaloS: 10,
  /** Filas donde se aparcan los jugadores de campo que no intervienen. */
  parqueLocalX: 25, parqueVisitaX: 60, filaY0: 4, filaDY: 6,
  /** Remate al portero local: origen a ≥ PO.reaccionM (radio pleno) y balón a 2 m del portero. */
  remateM: 11, balonRemateM: 2,
  /** Rival pegado al portero con el balón en las manos: dentro de controlM y de separacionM aun
   * después de que la separación los aleje durante el paso. */
  pegadoM: 0.5,
  /** Mano a mano a 20 m del arco visitante: (largo − 16, centro + 12). */
  manoAMano: { dx: 16, dy: 12 },
  /** Extremo junto a la línea de fondo. */
  extremo: { x: 95, y: 5 },
  /** Centro desde la banda izquierda del ataque local. */
  origenCentro: { x: 88, y: 8 },
  /** Distancia del compañero al palo lejano en la prueba 11. */
  companeroCentroM: 8,
  /** Línea defensiva visitante de la prueba 13. */
  lineaDefensivaX: 92,
  /** Coseno mínimo entre el desplazamiento y la dirección al destino de llegada (prueba 13). */
  rumboCoseno: 0.99,
} as const;

// ---------------------------------------------------------------------------------------------
// Escenarios mínimos sobre crearEstadoArena + MotorArena (como en correcciones044).
// ---------------------------------------------------------------------------------------------
const portero = (e: EstadoArena, lado: Lado) => e.jugadores.find(j => j.lado === lado && j.puesto === "POR")!;
const campo = (e: EstadoArena, lado: Lado) => e.jugadores.filter(j => j.lado === lado && j.puesto !== "POR").sort((a, b) => a.id.localeCompare(b.id));
function colocar(j: JugadorArena, p: Punto, v: Punto = { x: 0, y: 0 }) { j.posicion = { ...p }; j.velocidad = { ...v }; }
type OrdenEscenario = { accion: OrdenJugador["accion"]; destino?: Punto; receptor?: string | null };

interface Escenario {
  motor: MotorArena; planes: Record<Lado, OrdenesEquipo>; config: ConfigArena;
  j(id: string): JugadorArena;
  /** Avanza tick a tick, con una intervención opcional antes de cada paso. */
  ticks(n: number, antes?: (m: MotorArena) => void): void;
  /** Avanza en una sola llamada (conserva el contexto de la ronda). */
  ronda(segundos: number): void;
}
function montar(reglas: Reglas, preparar: (e: EstadoArena, config: ConfigArena) => void, ordenes: (e: EstadoArena) => Record<string, OrdenEscenario> = () => ({}), seed: number = ESCENARIO.semilla): Escenario {
  const config: ConfigArena = { ...crearConfigArena({ seed, duracionS: ESCENARIO.duracionS, intervaloS: ESCENARIO.intervaloS }) };
  if (reglas) config.reglas = reglas; else delete config.reglas;
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
  return {
    motor, planes, config,
    j: id => motor.estado.jugadores.find(j => j.id === id)!,
    ticks(n, antes) { for (let i = 0; i < n; i++) { antes?.(motor); motor.avanzar(planes, motor.estado.tick + 1); } },
    ronda(segundos) { motor.avanzar(planes, motor.estado.tick + ticksDe(segundos)); },
  };
}
const ritmoDe = (m: MotorArena, lado: Lado) => T.ritmo[m.estado.entrenadores![lado].plan.ritmo];

/** Remate de la visita al portero local, que está en x = porX. */
function remate(reglas: Reglas, seed: number, porX: number = anclas("4-3-3", "local", "base").POR!.x, extra?: (e: EstadoArena) => void, ordenes?: (e: EstadoArena) => Record<string, OrdenEscenario>) {
  return montar(reglas, e => {
    const por = portero(e, "local"), tirador = campo(e, "visita")[0]!;
    colocar(por, { x: porX, y: MEDIO_Y });
    colocar(tirador, { x: porX + ESCENARIO.remateM, y: MEDIO_Y });
    e.balon = { posicion: { x: porX + ESCENARIO.balonRemateM, y: MEDIO_Y }, poseedor: null, ultimoToque: { jugador: tirador.id, lado: "visita" },
      vuelo: { tipo: "tiro", autor: tirador.id, lado: "visita", receptor: null, origen: { ...tirador.posicion }, destino: { x: -ARENA.remateTrasLineaM, y: MEDIO_Y }, inicioTick: 0, adelantados: [] } };
    extra?.(e);
  }, ordenes, seed);
}
/** Primera semilla con atajada sin desvío en el escenario de remate (barrido, como en 044). */
function semillaAtajada(reglas: Reglas, porX?: number): number {
  for (let seed = 1; seed < 400; seed++) {
    const s = remate(reglas, seed, porX); s.ticks(1);
    if (s.motor.eventos[0]?.tipo === "atajada" && !s.motor.eventos[0].motivo) return seed;
  }
  throw new Error("Sin atajada en el barrido");
}
/** Portero local con el balón en las manos desde el tick 0 (estado construido). */
function conManos(reglas: Reglas, preparar: (e: EstadoArena) => void = () => {}) {
  return montar(reglas, e => {
    const por = portero(e, "local");
    e.balon = { posicion: { ...por.posicion }, poseedor: por.id, vuelo: null, ultimoToque: { jugador: por.id, lado: "local" }, manos: { portero: por.id, desdeTick: 0, hastaTick: ticksDe(PO.manosMaxS) } };
    preparar(e);
  });
}
const pasesDe = (m: MotorArena, id: string) => m.eventos.filter(e => e.jugador === id && (e.tipo === "pase" || e.tipo === "tiro"));
/** Margen independiente (v1.1 #2): distancia del compañero a su rival más cercano. */
const margen = (e: EstadoArena, companero: Punto, lado: Lado) => Math.min(...e.jugadores.filter(r => r.lado !== lado).map(r => distancia(r.posicion, companero)));

// Escenarios de cada comportamiento nuevo, parametrizados por reglas (matriz v1.1 y pruebas).
function escenarioManoAMano(reglas: Reglas, defensorDelante: boolean) {
  const balon = { x: ARENA.largoM - ESCENARIO.manoAMano.dx, y: MEDIO_Y + ESCENARIO.manoAMano.dy };
  return montar(reglas, e => {
    const [atacante] = campo(e, "local"), [igual, perseguidor, delante] = campo(e, "visita");
    colocar(atacante!, balon);
    e.balon = { posicion: { ...balon }, poseedor: atacante!.id, vuelo: null, ultimoToque: { jugador: atacante!.id, lado: "local" } };
    // Defensor exactamente a la misma x que el poseedor (v1.1), lejos en y.
    colocar(igual!, { x: balon.x, y: ESCENARIO.filaY0 + ESCENARIO.filaDY });
    colocar(perseguidor!, { x: balon.x - ESCENARIO.balonRemateM - ARENA.separacionM * 2, y: balon.y });
    if (defensorDelante) colocar(delante!, { x: (balon.x + ARENA.largoM) / 2, y: (balon.y + MEDIO_Y) / 2 });
  }, e => {
    const atacante = campo(e, "local")[0]!, por = portero(e, "visita");
    // Órdenes fijas como las de un LLM: el poseedor conduce en paralelo a la línea de fondo
    // (su x no cambia) y el portero tiene `cubrir` en su ancla; nadie ordena presionar.
    return { [atacante.id]: { accion: "conducir", destino: { x: balon.x, y: MEDIO_Y } }, [por.id]: { accion: "cubrir", destino: { ...por.posicion } } };
  });
}
/** Proyección del movimiento del portero visitante sobre la dirección inicial portero → balón. */
function salidaDelPortero(s: Escenario, segundos: number): number {
  const k0 = { ...portero(s.motor.estado, "visita").posicion }, b0 = { ...s.motor.estado.balon.posicion };
  s.ronda(segundos);
  const k1 = portero(s.motor.estado, "visita").posicion, n = distancia(k0, b0);
  return ((k1.x - k0.x) * (b0.x - k0.x) + (k1.y - k0.y) * (b0.y - k0.y)) / n;
}
function escenarioExtremo(reglas: Reglas) {
  return montar(reglas, e => {
    const ext = campo(e, "local")[0]!;
    colocar(ext, ESCENARIO.extremo);
    e.balon = { posicion: { ...ESCENARIO.extremo }, poseedor: ext.id, vuelo: null, ultimoToque: { jugador: ext.id, lado: "local" } };
  }, e => ({ [campo(e, "local")[0]!.id]: { accion: "conducir", destino: { x: ARENA.largoM, y: ESCENARIO.extremo.y } } }));
}
/** Máxima x del extremo mientras conduce y reinicios ocurridos, durante `segundos`. */
function recorridoExtremo(s: Escenario, segundos: number) {
  const id = campo(s.motor.estado, "local")[0]!.id;
  let maxX = -Infinity;
  for (let i = 0; i < ticksDe(segundos); i++) {
    s.ticks(1);
    if (s.motor.estado.balon.poseedor === id) maxX = Math.max(maxX, s.j(id).posicion.x);
    if (s.motor.eventos.some(e => e.tipo === "reinicio")) break;
  }
  return { maxX, reinicios: s.motor.eventos.filter(e => e.tipo === "reinicio") };
}
function escenarioCentro(reglas: Reglas, conductor: boolean, x: number = ESCENARIO.origenCentro.x) {
  const origen = { x, y: ESCENARIO.origenCentro.y };
  const lejano = objetivosCentro(origen)[2];
  // Compañero a companeroCentroM del palo lejano, desplazado hacia la línea de fondo.
  const dx = ESCENARIO.balonRemateM, companero = { x: lejano.x - dx, y: lejano.y + Math.sqrt(ESCENARIO.companeroCentroM ** 2 - dx ** 2) };
  const s = montar(reglas, e => {
    const [pasador, receptor] = campo(e, "local");
    colocar(pasador!, origen); colocar(receptor!, companero);
    pasador!.personalidad = { ...pasador!.personalidad!, conduccion: conductor ? P.max : P.min, pase: conductor ? P.min : P.max };
    e.balon = { posicion: { ...origen }, poseedor: pasador!.id, vuelo: null, ultimoToque: { jugador: pasador!.id, lado: "local" } };
  }, e => ({ [campo(e, "local")[0]!.id]: { accion: "apoyar" } }));
  return { s, lejano, pasador: campo(s.motor.estado, "local")[0]!.id, receptor: campo(s.motor.estado, "local")[1]!.id };
}
const centros = (m: MotorArena) => m.eventos.filter(e => e.tipo === "pase" && e.motivo === "centro");
function escenarioLlegada(reglas: Reglas) {
  return montar(reglas, e => {
    const [pasador, apoyo] = campo(e, "local");
    colocar(pasador!, ESCENARIO.origenCentro); colocar(apoyo!, { x: ARENA.largoM / 2 + ESCENARIO.parqueLocalX / 2, y: MEDIO_Y });
    e.balon = { posicion: { ...ESCENARIO.origenCentro }, poseedor: pasador!.id, vuelo: null, ultimoToque: { jugador: pasador!.id, lado: "local" } };
  }, e => ({ [campo(e, "local")[0]!.id]: { accion: "apoyar" }, [campo(e, "local")[1]!.id]: { accion: "apoyar" } }));
}
/** Lateral A: `pasar` a un compañero fuera de alcance desde una posición de remate. */
function escenarioPasarImposible(reglas: Reglas) {
  const posicion = { x: ARENA.largoM - ARENA.radioTiroM + ESCENARIO.remateM / 2, y: MEDIO_Y };
  return montar(reglas, e => {
    const [poseedor, lejano] = campo(e, "local");
    colocar(poseedor!, posicion); colocar(lejano!, { x: posicion.x - ARENA.paseMaxM - ESCENARIO.remateM, y: MEDIO_Y });
    e.balon = { posicion: { ...posicion }, poseedor: poseedor!.id, vuelo: null, ultimoToque: { jugador: poseedor!.id, lado: "local" } };
  }, e => { const [poseedor, lejano] = campo(e, "local"); return { [poseedor!.id]: { accion: "pasar", destino: { ...lejano!.posicion }, receptor: lejano!.id } }; });
}
/** Lateral B: `conducir` con destino a menos de renovarConduccionM; velocidad tras 1 s. */
function velocidadConduccion(reglas: Reglas): number {
  const inicio = { x: ARENA.largoM / 2 - ESCENARIO.remateM, y: MEDIO_Y };
  const s = montar(reglas, e => {
    const poseedor = campo(e, "local")[0]!;
    colocar(poseedor, inicio);
    e.balon = { posicion: { ...inicio }, poseedor: poseedor.id, vuelo: null, ultimoToque: { jugador: poseedor.id, lado: "local" } };
  }, e => ({ [campo(e, "local")[0]!.id]: { accion: "conducir", destino: { x: inicio.x + A.renovarConduccionM * 0.75, y: MEDIO_Y } } }));
  s.ronda(1);
  const j = s.j(campo(s.motor.estado, "local")[0]!.id);
  return Math.hypot(j.velocidad.x, j.velocidad.y);
}
const errorMaximoPaseM = ARENA.errorPaseM + ARENA.errorLluviaM + E.presionErrorM + E.nieblaErrorM + E.cespedAltoErrorM;

// ---------------------------------------------------------------------------------------------
describe("046 · error 3: el portero con el balón en las manos", () => {
  it("1 · tras una atajada, un rival pegado (nivel máximo frente a mínimo) no recupera ni comete falta hasta que suelta", () => {
    const seed = semillaAtajada(V4);
    const s = remate(V4, seed, undefined, e => { portero(e, "local").nivel = NIVEL.min; campo(e, "visita")[1]!.nivel = NIVEL.max; });
    s.ticks(1);
    const por = portero(s.motor.estado, "local"), pegado = campo(s.motor.estado, "visita")[1]!.id;
    expect(s.motor.eventos[0]).toMatchObject({ tipo: "atajada", jugador: por.id });
    let soltado = false;
    for (let i = 0; i < ticksDe(PO.manosMaxS) + ticksDe(ARENA.accionCadaS) && !soltado; i++) {
      s.ticks(1, () => { const p = s.j(por.id).posicion; colocar(s.j(pegado), { x: p.x + ESCENARIO.pegadoM, y: p.y }); });
      soltado = pasesDe(s.motor, por.id).length > 0;
      if (!soltado) expect(s.motor.estado.balon.poseedor).toBe(por.id);
    }
    expect(soltado).toBe(true);
    expect(s.motor.eventos.filter(e => e.lado === "visita" && (e.tipo === "recuperacion" || e.tipo === "falta"))).toEqual([]);
  });

  it("2 · balon.manos se crea al recibir dentro del área (atajada y reiniciar) con hastaTick de manosMaxS; fuera del área no existe", () => {
    const seed = semillaAtajada(V4);
    const s = remate(V4, seed); s.ticks(1);
    const atajada = s.motor.eventos[0]!, por = portero(s.motor.estado, "local");
    expect(s.motor.estado.balon.manos).toEqual({ portero: por.id, desdeTick: atajada.tick, hastaTick: atajada.tick + Math.round(PO.manosMaxS / ARENA.pasoS) });
    // v1.1: al adquirir manos queda dentro del área, a ≥ controlM de su línea y sin velocidad.
    expect(enAreaPropia(por.posicion, "local")).toBe(true);
    expect(transformar(por.posicion, "local").x).toBeGreaterThanOrEqual(ARENA.controlM);
    expect(por.velocidad).toEqual({ x: 0, y: 0 });

    // Reanudación desde el portero tras un fuera de juego.
    const fj = montar(V4, e => {
      const [pasador, adelantado] = campo(e, "local"), destino = { x: ARENA.largoM - ARENA.areaLargoM, y: ESCENARIO.filaY0 * 5 };
      colocar(pasador!, { x: destino.x - ESCENARIO.remateM * 2, y: destino.y }); colocar(adelantado!, destino);
      e.balon = { posicion: { x: destino.x - ESCENARIO.pegadoM, y: destino.y }, poseedor: null, ultimoToque: { jugador: pasador!.id, lado: "local" },
        vuelo: { tipo: "pase", autor: pasador!.id, lado: "local", receptor: adelantado!.id, origen: { ...pasador!.posicion }, destino, inicioTick: 0, adelantados: [adelantado!.id] } };
    });
    fj.ticks(1);
    const porVisita = portero(fj.motor.estado, "visita"), reinicio = fj.motor.eventos.find(e => e.tipo === "reinicio")!;
    expect(fj.motor.eventos.map(e => e.tipo)).toEqual(["fuera_juego", "reinicio"]);
    expect(fj.motor.estado.balon.manos).toEqual({ portero: porVisita.id, desdeTick: reinicio.tick, hastaTick: reinicio.tick + Math.round(PO.manosMaxS / ARENA.pasoS) });

    // El portero que recibe fuera de su área tiene el balón en los pies.
    const fuera = montar(V4, e => {
      const por = portero(e, "local"), pasador = campo(e, "local")[0]!, punto = { x: ARENA.areaLargoM + ESCENARIO.remateM, y: MEDIO_Y };
      colocar(por, punto); colocar(pasador, { x: punto.x + ESCENARIO.remateM, y: MEDIO_Y });
      e.balon = { posicion: { x: punto.x + ESCENARIO.pegadoM, y: MEDIO_Y }, poseedor: null, ultimoToque: { jugador: pasador.id, lado: "local" },
        vuelo: { tipo: "pase", autor: pasador.id, lado: "local", receptor: por.id, origen: { ...pasador.posicion }, destino: { ...punto }, inicioTick: 0, adelantados: [] } };
    });
    fuera.ticks(1);
    expect(fuera.motor.eventos[0]).toMatchObject({ tipo: "recepcion", jugador: portero(fuera.motor.estado, "local").id });
    expect(fuera.motor.estado.balon.manos).toBeUndefined();
  });

  it("3 · no suelta antes de accionCadaS / ritmo; con un rival cerca espera; al vencer el plazo, saque forzado hacia el compañero de mayor margen", () => {
    // Sin rivales cerca: sale con motivo saque_manos, nunca antes de accionCadaS / ritmo.
    const seed = semillaAtajada(V4);
    const s = remate(V4, seed); s.ticks(1);
    const atajada = s.motor.eventos[0]!, por = portero(s.motor.estado, "local").id;
    s.ticks(ticksDe(PO.manosMaxS));
    const saque = pasesDe(s.motor, por)[0]!;
    expect(saque).toMatchObject({ tipo: "pase", motivo: "saque_manos" });
    expect(((saque.tick - 1) - atajada.tick) * ARENA.pasoS).toBeGreaterThanOrEqual(ARENA.accionCadaS / ritmoDe(s.motor, "local"));
    expect(saque.tick - 1).toBeLessThan(atajada.tick + ticksDe(PO.manosMaxS));

    // Con un rival a menos de distanciaManosM: espera hasta hastaTick y sale el saque forzado,
    // aunque exista un pase ordinario distinto (v1.1: el vencimiento tiene prioridad).
    const esperado = conManos(V4, e => {
      const por = portero(e, "local"), propios = campo(e, "local");
      colocar(propios[0]!, { x: por.posicion.x + ESCENARIO.balonRemateM * 2, y: ARENA.anchoM - ESCENARIO.filaY0 });
      propios.slice(1).forEach((j, k) => colocar(j, { x: ESCENARIO.parqueLocalX + ESCENARIO.filaY0, y: ESCENARIO.filaY0 + ESCENARIO.filaDY * k }));
    });
    const motor = esperado.motor, porId = portero(motor.estado, "local").id, hasta = motor.estado.balon.manos!.hastaTick;
    const cerca = campo(motor.estado, "visita")[0]!.id, detras = { x: portero(motor.estado, "local").posicion.x - PO.distanciaManosM * 0.75, y: MEDIO_Y };
    esperado.ticks(hasta, () => colocar(esperado.j(cerca), detras));
    expect(pasesDe(motor, porId)).toEqual([]);
    expect(motor.estado.balon.poseedor).toBe(porId);
    const yo = esperado.j(porId), candidatos = campo(motor.estado, "local");
    const margenes = candidatos.map(c => ({ id: c.id, m: margen(motor.estado, c.posicion, "local") })).sort((a, b) => b.m - a.m || a.id.localeCompare(b.id));
    const ordinario = opcionPase(yo, observarArena(motor, "local"));
    expect(ordinario).toBeDefined();
    expect(ordinario!.id).not.toBe(margenes[0]!.id);
    esperado.ticks(1, () => colocar(esperado.j(cerca), detras));
    expect(pasesDe(motor, porId)).toEqual([expect.objectContaining({ tipo: "pase", motivo: "saque_manos", tick: hasta + 1, receptor: margenes[0]!.id })]);
  });

  it("3c · v1.1 #2: el saque forzado elige el compañero más alejado de su rival más cercano, no la línea de pase más limpia", () => {
    // Contraejemplo de la revisión: portero (6,34), A (80,34), B (6,60), rival (20,34) → A.
    const e = structuredClone(conManos(V4).motor.estado);
    const por = portero(e, "local"), [a, b] = campo(e, "local"), rivalJ = campo(e, "visita")[0]!;
    colocar(por, { x: 6, y: MEDIO_Y }); colocar(a!, { x: 80, y: MEDIO_Y }); colocar(b!, { x: 6, y: 60 }); colocar(rivalJ, { x: 20, y: MEDIO_Y });
    e.jugadores = [por, a!, b!, rivalJ];
    // La línea portero → A pasa por encima del rival, pero A está a 60 m de él y B a 28,7 m.
    expect(margen(e, a!.posicion, "local")).toBeGreaterThan(margen(e, b!.posicion, "local"));
    expect(saqueForzado(por, e)?.id).toBe(a!.id);
  });

  it("3b · v1.1: sin compañeros a saqueManosMaxM el saque forzado no tiene límite de distancia; sin compañeros de campo, despeje sin receptor", () => {
    const s = conManos(V4, e => {
      const por = portero(e, "local");
      campo(e, "local").forEach((j, k) => colocar(j, { x: por.posicion.x + PO.saqueManosMaxM + ESCENARIO.remateM, y: ESCENARIO.filaY0 + ESCENARIO.filaDY * k }));
    });
    const por = portero(s.motor.estado, "local").id, hasta = s.motor.estado.balon.manos!.hastaTick;
    s.ticks(hasta + 1);
    const saque = pasesDe(s.motor, por);
    expect(saque).toHaveLength(1);
    expect(saque[0]).toMatchObject({ motivo: "saque_manos", tick: hasta + 1 });
    // Hay receptor (no es el despeje) y está más lejos que saqueManosMaxM.
    expect(saque[0]!.receptor).not.toBeNull();
    expect(distancia(saque[0]!.desde, s.j(saque[0]!.receptor!).posicion)).toBeGreaterThan(PO.saqueManosMaxM);
    // Sin compañeros de campo: función pura y destino del despeje.
    const solo = structuredClone(s.motor.estado);
    solo.jugadores = solo.jugadores.filter(j => j.lado === "visita" || j.puesto === "POR");
    expect(saqueForzado(portero(solo, "local"), solo)).toBeUndefined();
    const p = portero(solo, "local").posicion;
    expect(despejeManos(p)).toEqual({ x: ARENA.largoM / 2, y: p.y });
  });

  it("4 · con el balón en las manos en x = controlM + 0,1, órdenes conducir/tirar hacia atrás y un rival empujando, durante 3 s sigue en el área sin gol ni reinicio", () => {
    const porX = ARENA.controlM + 0.1, seed = semillaAtajada(V4, porX);
    for (const accion of ["conducir", "tirar"] as const) {
      const s = remate(V4, seed, porX, undefined, e => ({ [portero(e, "local").id]: { accion, destino: { x: 0, y: MEDIO_Y } } }));
      s.ticks(1);
      const por = portero(s.motor.estado, "local").id, empuja = campo(s.motor.estado, "visita")[1]!.id;
      expect(s.motor.estado.balon.manos?.portero).toBe(por);
      // Rival fijo (posición y velocidad) delante del portero, dentro de separacionM: lo empuja hacia su línea.
      s.ticks(ticksDe(3), () => { const p = s.j(por).posicion; colocar(s.j(empuja), { x: p.x + ESCENARIO.pegadoM, y: p.y }); });
      const p = s.j(por).posicion;
      expect(enAreaPropia(p, "local")).toBe(true);
      expect(p.x).toBeGreaterThanOrEqual(ARENA.controlM - 1e-9);
      expect(s.motor.eventos.filter(e => e.tipo === "gol" || e.tipo === "reinicio")).toEqual([]);
      expect(s.motor.estado.balon.poseedor).toBe(por);
    }
  });

  it("5 · los destinos rivales se proyectan a distanciaManosM + margenManosM (v1.2) (función pura y motor)", () => {
    const por = { x: ARENA.controlM * 5, y: MEDIO_Y };
    const cerca = respetarManos({ x: por.x + 1, y: por.y + 1 }, { x: por.x + 9, y: por.y }, por);
    expect(distancia(cerca, por)).toBeCloseTo(RADIO_MANOS, 9);
    expect(cerca.x - por.x).toBeCloseTo(cerca.y - por.y, 9);
    const encima = respetarManos({ ...por }, { x: por.x + 9, y: por.y }, por);
    expect(encima).toEqual({ x: por.x + RADIO_MANOS, y: por.y });
    const lejos = { x: por.x + RADIO_MANOS + 1, y: por.y };
    expect(respetarManos(lejos, lejos, por)).toEqual(lejos);
    // Junto a la línea de fondo y en una esquina el recorte al campo no puede devolver un punto
    // dentro del radio: es el punto del círculo dentro del campo más cercano al destino.
    const dentroDelCampo = (p: Punto) => p.x >= 0 && p.x <= ARENA.largoM && p.y >= 0 && p.y <= ARENA.anchoM;
    const casos: [Punto, Punto, Punto][] = [
      [{ x: 0, y: MEDIO_Y }, { x: 3, y: MEDIO_Y }, { x: ARENA.controlM, y: MEDIO_Y }], // contraejemplo de la revisión
      [{ x: ARENA.largoM, y: MEDIO_Y + 1 }, { x: ARENA.largoM - 3, y: MEDIO_Y }, { x: ARENA.largoM - ARENA.controlM, y: MEDIO_Y }],
      [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }],
      [{ x: ARENA.largoM, y: ARENA.anchoM }, { x: ARENA.largoM, y: ARENA.anchoM }, { x: ARENA.largoM - 1, y: ARENA.anchoM - 2 }],
    ];
    for (const [destino, jugador, porteroP] of casos) {
      const p = respetarManos(destino, jugador, porteroP);
      expect(dentroDelCampo(p)).toBe(true);
      expect(distancia(p, porteroP)).toBeGreaterThanOrEqual(RADIO_MANOS - 1e-9);
      // Ningún punto factible del círculo está más cerca del destino.
      for (let k = 0; k < 720; k++) {
        const a = k / 720 * 2 * Math.PI, q = { x: porteroP.x + Math.cos(a) * RADIO_MANOS, y: porteroP.y + Math.sin(a) * RADIO_MANOS };
        if (dentroDelCampo(q)) expect(distancia(p, destino)).toBeLessThanOrEqual(distancia(q, destino) + 1e-9);
      }
    }
    // Motor: un rival con orden de ir encima del portero no se acerca a menos de distanciaManosM
    // (sin opción de pase, el portero conserva el balón hasta el plazo).
    const s = conManos(V4, e => {
      const p = portero(e, "local");
      campo(e, "local").forEach((j, k) => colocar(j, { x: p.posicion.x + PO.saqueManosMaxM + ESCENARIO.remateM, y: ESCENARIO.filaY0 + ESCENARIO.filaDY * k }));
      colocar(campo(e, "visita")[0]!, { x: p.posicion.x + PO.distanciaManosM * 2, y: p.posicion.y });
    });
    const p = portero(s.motor.estado, "local"), rival = campo(s.motor.estado, "visita")[0]!.id;
    s.planes.visita.ordenes.find(o => o.jugador === rival)!.destino = { ...p.posicion };
    let minima = Infinity;
    for (let i = 0; i < s.motor.estado.balon.manos!.hastaTick - 1; i++) { s.ticks(1); minima = Math.min(minima, distancia(s.j(rival).posicion, s.j(p.id).posicion)); }
    expect(minima).toBeGreaterThanOrEqual(RADIO_MANOS - ARENA.toleranciaM);
  });

  it("6 · manosMaxS supera accionCadaS / min(ritmo): siempre hay ventana para soltar", () => {
    expect(PO.manosMaxS).toBeGreaterThan(ARENA.accionCadaS / Math.min(...Object.values(T.ritmo)));
  });

  it("v1.1 · 3: durante una pausa con inercia hacia la línea, el portero con manos no sale del área (ambas porterías)", () => {
    for (const lado of lados) {
      const s = montar(V4, e => {
        const por = portero(e, lado), dentro = transformar({ x: ARENA.controlM + ESCENARIO.pegadoM / 2, y: MEDIO_Y }, lado);
        // Velocidad hacia su propia línea de gol.
        colocar(por, dentro, { x: (lado === "local" ? -1 : 1) * ARENA.velocidadMps, y: 0 });
        e.balon = { posicion: { ...dentro }, poseedor: por.id, vuelo: null, manos: { portero: por.id, desdeTick: 0, hastaTick: ticksDe(PO.manosMaxS) } };
        e.pausa = { hastaTick: ticksDe(T.pausaS), lado, punto: { ...dentro }, motivo: "reinicio" };
      });
      const id = portero(s.motor.estado, lado).id;
      for (let i = 0; i < ticksDe(T.pausaS); i++) {
        s.ticks(1);
        const p = s.j(id).posicion;
        expect(enAreaPropia(p, lado)).toBe(true);
        expect(transformar(p, lado).x).toBeGreaterThanOrEqual(ARENA.controlM - 1e-9);
      }
      expect(s.motor.eventos.filter(e => e.tipo === "gol" || e.tipo === "reinicio")).toEqual([]);
    }
  });

  it("v1.1 · 4: falta sobre el portero con el balón en los pies dentro del área → reanudación en manos con plazo tras la pausa; la disputa posterior se rechaza", () => {
    const falta = (seed: number) => montar(V4, e => {
      const por = portero(e, "local"), rival = campo(e, "visita")[0]!;
      colocar(rival, { x: por.posicion.x + ESCENARIO.pegadoM, y: por.posicion.y });
      rival.personalidad = { ...rival.personalidad!, agresividad: P.max, disciplina: P.min };
      e.balon = { posicion: { ...por.posicion }, poseedor: por.id, vuelo: null, ultimoToque: { jugador: por.id, lado: "local" } };
    }, undefined, seed);
    let seed = 1;
    while (!(() => { const s = falta(seed); s.ticks(1); return s.motor.eventos.some(e => e.tipo === "falta"); })()) { seed++; expect(seed).toBeLessThan(2000); }
    const s = falta(seed);
    s.ticks(1);
    const por = portero(s.motor.estado, "local").id, rival = campo(s.motor.estado, "visita")[0]!.id;
    const reinicio = s.motor.eventos.find(e => e.tipo === "reinicio")!;
    expect(reinicio).toMatchObject({ motivo: "falta", jugador: por });
    const finPausa = s.motor.estado.pausa!.hastaTick;
    // El plazo entero (mínimo para soltar y máximo) empieza al terminar la pausa.
    expect(s.motor.estado.balon.manos).toEqual({ portero: por, desdeTick: finPausa, hastaTick: finPausa + Math.round(PO.manosMaxS / ARENA.pasoS) });
    expect(finPausa).toBeGreaterThan(reinicio.tick);
    // Sin rivales cerca: no suelta antes de finPausa + accionCadaS / ritmo.
    const libre = falta(seed);
    libre.ticks(1);
    libre.ticks(ticksDe(PO.manosMaxS + T.pausaS), () => { if (libre.motor.estado.jugadores.some(j => j.id === rival)) colocar(libre.j(rival), { x: ARENA.largoM / 2, y: MEDIO_Y }); });
    const suelta = pasesDe(libre.motor, por)[0]!;
    expect(suelta).toMatchObject({ motivo: "saque_manos" });
    expect(((suelta.tick - 1) - finPausa) * ARENA.pasoS).toBeGreaterThanOrEqual(ARENA.accionCadaS / ritmoDe(libre.motor, "local"));
    const antes = s.motor.eventos.length;
    // Tras la pausa, el rival pegado intenta disputar: no hay recuperación ni falta mientras dura.
    while (s.motor.estado.balon.manos && s.motor.estado.tick < s.motor.estado.balon.manos.hastaTick + 1) {
      s.ticks(1, () => { const p = s.j(por).posicion; if (s.motor.estado.jugadores.some(j => j.id === rival)) colocar(s.j(rival), { x: p.x + ESCENARIO.pegadoM, y: p.y }); });
    }
    expect(s.motor.eventos.slice(antes).filter(e => e.lado === "visita" && (e.tipo === "recuperacion" || e.tipo === "falta"))).toEqual([]);
    expect(pasesDe(s.motor, por).at(-1)).toMatchObject({ motivo: "saque_manos" });
  });
});

describe("046 · error 1: la salida a achicar", () => {
  it("7 · mano a mano a 20 m con órdenes fijas (portero con cubrir): sale sobre la línea arco–balón y queda en el área; con un defensor por delante no se mueve", () => {
    const s = escenarioManoAMano(V4, false);
    // Criterio con igualdad: un defensor exactamente a la misma x no impide el mano a mano.
    const atacante = campo(s.motor.estado, "local")[0]!, igual = campo(s.motor.estado, "visita")[0]!;
    expect(transformar(igual.posicion, "local").x).toBe(transformar(atacante.posicion, "local").x);
    expect(manoAMano(s.motor.estado, "visita", PO.manoAManoRadioM)?.id).toBe(atacante.id);
    const x0 = atacante.posicion.x;
    const desplazamiento = salidaDelPortero(s, 1);
    expect(desplazamiento).toBeGreaterThan(L.desplazamientoM);
    expect(enAreaPropia(portero(s.motor.estado, "visita").posicion, "visita")).toBe(true);
    // La x del poseedor no cambió: el defensor sigue a la misma x durante todo el segundo.
    expect(s.j(atacante.id).posicion.x).toBe(x0);

    const conDefensor = escenarioManoAMano(V4, true);
    expect(manoAMano(conDefensor.motor.estado, "visita", PO.manoAManoRadioM)).toBeNull();
    const ancla = { ...portero(conDefensor.motor.estado, "visita").posicion };
    conDefensor.ronda(1);
    expect(distancia(portero(conDefensor.motor.estado, "visita").posicion, ancla)).toBeLessThan(1e-9);
  });

  it("8 · radio de reacción: controlPorteroM desde reaccionM, cuerpoM a bocajarro, monótono; un remate a 2 m entre ambos radios es atajada en v3 y no en v4", () => {
    expect(radioAtajada(PO.reaccionM)).toBe(ARENA.controlPorteroM);
    expect(radioAtajada(PO.reaccionM * 3)).toBe(ARENA.controlPorteroM);
    expect(radioAtajada(0)).toBe(PO.cuerpoM);
    for (let d = 0; d < PO.reaccionM * 2; d += 0.25) expect(radioAtajada(d + 0.25)).toBeGreaterThanOrEqual(radioAtajada(d));
    const resultado = (reglas: Reglas) => remateBocajarro(reglas).motor.eventos.map(e => e.tipo);
    expect(resultado("reinicios-v3")).toContain("atajada");
    expect(resultado(V4)).not.toContain("atajada");
    expect(resultado(V4)).toContain("gol");
  });
});

/** Remate desde ESCENARIO.balonRemateM con desvío lateral entre cuerpoM y controlPorteroM. */
function remateBocajarro(reglas: Reglas): Escenario {
  const s = montar(reglas, e => {
    // La trayectoria pasa entre cuerpoM y controlPorteroM del portero; origen a balonRemateM.
    const por = portero(e, "local"), tirador = campo(e, "visita")[0]!, lateral = (PO.cuerpoM + ARENA.controlPorteroM) / 2;
    const origen = { x: por.posicion.x + ESCENARIO.balonRemateM, y: MEDIO_Y + lateral };
    colocar(tirador, { x: origen.x + ESCENARIO.remateM, y: origen.y });
    e.balon = { posicion: { ...origen }, poseedor: null, ultimoToque: { jugador: tirador.id, lado: "visita" },
      vuelo: { tipo: "tiro", autor: tirador.id, lado: "visita", receptor: null, origen, destino: { x: -ARENA.remateTrasLineaM, y: origen.y }, inicioTick: 0, adelantados: [] } };
  });
  s.ticks(ticksDe(1));
  return s;
}

describe("046 · error 2: conducción y centros", () => {
  it("9 · un extremo que conduce hacia la línea de fondo durante 4 s no provoca saque de meta ni de banda", () => {
    const { maxX, reinicios } = recorridoExtremo(escenarioExtremo(V4), 4);
    expect(reinicios.filter(e => e.reinicio === "meta" || e.reinicio === "banda")).toEqual([]);
    // El límite es del destino; al renovarse a renovarConduccionM, la inercia del giro puede
    // acercarlo algo más a la línea, nunca hasta ella (tolerancia = renovarConduccionM).
    expect(maxX).toBeLessThanOrEqual(ARENA.largoM - A.margenFondoM + A.renovarConduccionM);
    expect(maxX).toBeLessThan(ARENA.largoM);
  });

  it("10 · sin opción de centro, el poseedor en la zona de centro va hacia el punto de giro", () => {
    for (const lado of lados) {
      const j = { id: "x", lado, puesto: "DEL", posicion: transformar({ x: A.zonaCentroXM + 10, y: ESCENARIO.origenCentro.y }, lado) } as JugadorArena;
      expect(conduccionPorDefecto(j)).toEqual(transformar(puntoGiro(transformar(j.posicion, lado)), lado));
    }
    const s = montar(V4, e => {
      const p = campo(e, "local")[0]!, inicio = { x: A.zonaCentroXM + ESCENARIO.balonRemateM * 5, y: ESCENARIO.origenCentro.y };
      colocar(p, inicio);
      e.balon = { posicion: { ...inicio }, poseedor: p.id, vuelo: null, ultimoToque: { jugador: p.id, lado: "local" } };
    }, e => ({ [campo(e, "local")[0]!.id]: { accion: "apoyar" } }));
    const id = campo(s.motor.estado, "local")[0]!.id, antes = Math.abs(s.j(id).posicion.y - MEDIO_Y);
    s.ronda(1);
    expect(s.motor.estado.balon.poseedor).toBe(id);
    expect(antes - Math.abs(s.j(id).posicion.y - MEDIO_Y)).toBeGreaterThan(ARENA.toleranciaM);
  });

  it("11 · centro al palo lejano: pase con motivo centro, vuelo.centro, ese receptor y destino = objetivo ± error lateral; el conductor solo centra desde conductorCentroXM", () => {
    const { s, lejano, pasador, receptor } = escenarioCentro(V4, false);
    s.ticks(1);
    const [centro] = centros(s.motor);
    expect(centro).toMatchObject({ jugador: pasador, receptor, motivo: "centro" });
    expect(centro!.hasta.x).toBeCloseTo(lejano.x, 9);
    expect(Math.abs(centro!.hasta.y - lejano.y)).toBeLessThanOrEqual(errorMaximoPaseM);
    expect(s.motor.estado.balon.vuelo).toMatchObject({ centro: true, receptor, tipo: "pase" });

    const corto = escenarioCentro(V4, true);
    expect(prefiereConducir(corto.s.j(corto.pasador))).toBe(true);
    corto.s.ticks(1);
    expect(pasesDe(corto.s.motor, corto.pasador)).toEqual([]);
    const alto = escenarioCentro(V4, true, A.conductorCentroXM + 1);
    alto.s.ticks(1);
    expect(centros(alto.s.motor)).toHaveLength(1);
  });

  /** Vuelo de centro construido: desde ESCENARIO.origenCentro al palo lejano, con el balón a `restanteM` del destino. */
  function vueloCentro(destino: Punto, defensor: (o: Punto, d: Punto) => Punto | null, restanteM?: number) {
    const s = montar(V4, e => {
      const [autor, receptor] = campo(e, "local"), origen = { ...ESCENARIO.origenCentro };
      colocar(autor!, origen);
      const u = { x: (destino.x - origen.x) / distancia(origen, destino), y: (destino.y - origen.y) / distancia(origen, destino) };
      const balon = restanteM === undefined ? origen : { x: destino.x - u.x * restanteM, y: destino.y - u.y * restanteM };
      const punto = defensor(origen, destino);
      if (punto) colocar(campo(e, "visita")[0]!, punto);
      // Portero rival en su área, lejos de la trayectoria (solo se prueba al defensor de campo).
      colocar(portero(e, "visita"), { x: ARENA.largoM - 1, y: MEDIO_Y - ARENA.areaAnchoM / 2 + 1 });
      e.balon = { posicion: balon, poseedor: null, ultimoToque: { jugador: autor!.id, lado: "local" },
        vuelo: { tipo: "pase", autor: autor!.id, lado: "local", receptor: receptor!.id, origen, destino: { ...destino }, inicioTick: 0, adelantados: [], centro: true } };
    });
    return { s, defensor: campo(s.motor.estado, "visita")[0]!.id };
  }
  const enTrayectoria = (o: Punto, d: Punto, restanteM: number) => ({ x: d.x - (d.x - o.x) / distancia(o, d) * restanteM, y: d.y - (d.y - o.y) / distancia(o, d) * restanteM });
  const lejano = objetivosCentro(ESCENARIO.origenCentro)[2];

  it("12 · fase aérea: un defensor en la trayectoria lejos de la caída no intercepta; uno a menos de caidaM sí; v1.1: justo antes del límite con el extremo del paso ya dentro, tampoco", () => {
    const fijo = (x: ReturnType<typeof vueloCentro>) => { const p = { ...x.s.j(x.defensor).posicion }; return () => colocar(x.s.j(x.defensor), p); };
    const lejos = vueloCentro(lejano, (o, d) => enTrayectoria(o, d, distancia(o, d) * 0.6));
    lejos.s.ticks(ticksDe(3), fijo(lejos));
    expect(lejos.s.motor.eventos.filter(e => e.jugador === lejos.defensor)).toEqual([]);
    const cerca = vueloCentro(lejano, (o, d) => enTrayectoria(o, d, A.caidaM - 1));
    cerca.s.ticks(ticksDe(3), fijo(cerca));
    expect(cerca.s.motor.eventos[0]).toMatchObject({ tipo: "intercepcion", jugador: cerca.defensor });
    // El paso empieza a caidaM + 1 del destino y termina dentro; el defensor está a caidaM + 0,3.
    const borde = vueloCentro(lejano, (o, d) => enTrayectoria(o, d, A.caidaM + 0.3), A.caidaM + 1);
    borde.s.ticks(1, fijo(borde));
    expect(distancia(borde.s.motor.estado.balon.posicion, lejano)).toBeLessThan(A.caidaM);
    expect(borde.s.motor.eventos).toEqual([]);
  });

  it("v1.1 · 6: centro con caída fuera del campo → reinicio normal (banda o meta); un contacto válido antes del cruce prevalece", () => {
    const banda = vueloCentro({ x: ESCENARIO.origenCentro.x + ESCENARIO.remateM, y: -ESCENARIO.balonRemateM }, () => null);
    banda.s.ticks(ticksDe(2));
    expect(banda.s.motor.eventos.find(e => e.tipo === "reinicio")).toMatchObject({ reinicio: "banda", lado: "visita" });
    const fondo = { x: ARENA.largoM + ESCENARIO.balonRemateM, y: ESCENARIO.origenCentro.y + ESCENARIO.remateM };
    const meta = vueloCentro(fondo, () => null);
    meta.s.ticks(ticksDe(2));
    expect(meta.s.motor.eventos.find(e => e.tipo === "reinicio")).toMatchObject({ reinicio: "meta", lado: "visita" });
    // Defensor sobre la trayectoria, antes de la línea de fondo y a menos de caidaM del destino.
    const previo = enTrayectoria(ESCENARIO.origenCentro, fondo, A.caidaM - 1);
    expect(previo.x).toBeLessThan(ARENA.largoM);
    const antes = vueloCentro(fondo, () => previo);
    antes.s.ticks(ticksDe(2), () => colocar(antes.s.j(antes.defensor), previo));
    expect(antes.s.motor.eventos[0]).toMatchObject({ tipo: "intercepcion", jugador: antes.defensor });
    expect(antes.s.motor.eventos.filter(e => e.tipo === "reinicio")).toEqual([]);
  });

  it("v1.1 · 7: fuera de juego en el centro con la referencia del golpe (adelantado que vuelve, habilitado que rebasa, receptor incidental)", () => {
    const linea = ARENA.largoM - ARENA.areaLargoM / 2 - ESCENARIO.balonRemateM;
    const centrar = (receptor: Punto, destino: Punto, incidental?: Punto) => {
      const s = montar(V4, e => {
        const [pasador, r, y] = campo(e, "local"), [v0, v1] = campo(e, "visita");
        colocar(pasador!, ESCENARIO.origenCentro); colocar(r!, receptor);
        if (incidental) colocar(y!, incidental);
        // Línea defensiva: dos defensores a la misma x y el portero rival en su área, lejos del destino.
        colocar(v0!, { x: linea, y: ARENA.anchoM - ESCENARIO.filaY0 * 2 }); colocar(v1!, { x: linea, y: ARENA.anchoM - ESCENARIO.filaY0 });
        colocar(portero(e, "visita"), { x: ARENA.largoM - 1, y: MEDIO_Y - ARENA.areaAnchoM / 2 + 1 });
        e.balon = { posicion: { ...ESCENARIO.origenCentro }, poseedor: pasador!.id, vuelo: null, ultimoToque: { jugador: pasador!.id, lado: "local" } };
      }, e => { const [pasador, r] = campo(e, "local"); return { [pasador!.id]: { accion: "centrar", destino, receptor: r!.id } }; });
      const [, r, y] = campo(s.motor.estado, "local");
      return { s, r: r!.id, y: y!.id };
    };
    // Adelantado al golpe que vuelve a posición legal antes de recibir: sancionado.
    const vuelve = centrar({ x: linea + 1, y: lejano.y }, { x: linea - ESCENARIO.balonRemateM, y: lejano.y });
    vuelve.s.ticks(1);
    expect(vuelve.s.motor.estado.balon.vuelo?.adelantados).toContain(vuelve.r);
    vuelve.s.ticks(ticksDe(4));
    expect(vuelve.s.motor.eventos.find(e => e.tipo === "fuera_juego" || e.tipo === "recepcion")).toMatchObject({ tipo: "fuera_juego", jugador: vuelve.r });
    // Habilitado al golpe que rebasa la línea después: recibe.
    const rebasa = centrar({ x: linea - 1, y: lejano.y - ESCENARIO.filaDY }, { x: ARENA.largoM - A.paloXM, y: lejano.y - ESCENARIO.filaDY });
    rebasa.s.ticks(1);
    expect(rebasa.s.motor.estado.balon.vuelo?.adelantados).not.toContain(rebasa.r);
    rebasa.s.ticks(ticksDe(4));
    expect(rebasa.s.motor.eventos.find(e => e.tipo === "fuera_juego" || e.tipo === "recepcion")).toMatchObject({ tipo: "recepcion", jugador: rebasa.r });
    // Receptor incidental distinto del designado, adelantado al golpe: sancionado.
    const incidental = centrar({ x: ESCENARIO.parqueLocalX, y: MEDIO_Y }, { x: ARENA.largoM - A.paloXM, y: lejano.y }, { x: linea + 1, y: lejano.y + ESCENARIO.filaDY });
    incidental.s.ticks(1);
    const vuelo = incidental.s.motor.estado.balon.vuelo!;
    expect(vuelo.receptor).not.toBe(incidental.y);
    expect(vuelo.adelantados).toContain(incidental.y);
    const enCamino = { x: vuelo.destino.x - (vuelo.destino.x - vuelo.origen.x) / distancia(vuelo.origen, vuelo.destino), y: vuelo.destino.y - (vuelo.destino.y - vuelo.origen.y) / distancia(vuelo.origen, vuelo.destino) };
    incidental.s.ticks(ticksDe(4), () => colocar(incidental.s.j(incidental.y), enCamino));
    expect(incidental.s.motor.eventos.find(e => e.tipo === "fuera_juego" || e.tipo === "recepcion" || e.tipo === "intercepcion")).toMatchObject({ tipo: "fuera_juego", jugador: incidental.y });
  });

  it("13 · llegada al área: apoyar/profundidad reciben palo cercano, lejano y penal; cubrir no; la línea de fuera de juego limita la x; con cambio de posesión en la ronda entra cualquiera", () => {
    const s = escenarioLlegada(V4), e = structuredClone(s.motor.estado);
    const [, a, b, c, d] = campo(e, "local");
    colocar(a!, { x: ESCENARIO.origenCentro.x - 10, y: MEDIO_Y }); colocar(b!, { x: ESCENARIO.origenCentro.x - 12, y: MEDIO_Y });
    colocar(c!, { x: ESCENARIO.origenCentro.x - 14, y: MEDIO_Y }); colocar(d!, { x: ESCENARIO.origenCentro.x - 8, y: MEDIO_Y });
    const [v0, v1] = campo(e, "visita");
    colocar(v0!, { x: ESCENARIO.lineaDefensivaX, y: MEDIO_Y }); colocar(v1!, { x: ESCENARIO.lineaDefensivaX, y: MEDIO_Y + ESCENARIO.filaDY });
    colocar(portero(e, "visita"), { x: ARENA.largoM - 1, y: MEDIO_Y });
    const ordenes: OrdenJugador[] = [
      { jugador: a!.id, accion: "apoyar", destino: a!.posicion, receptor: null }, { jugador: b!.id, accion: "profundidad", destino: b!.posicion, receptor: null },
      { jugador: c!.id, accion: "apoyar", destino: c!.posicion, receptor: null }, { jugador: d!.id, accion: "cubrir", destino: d!.posicion, receptor: null },
    ];
    const [cercano, penal, lejanoPalo] = objetivosCentro(transformar(e.balon.posicion, "local"));
    const destinos = destinosLlegada(e, "local", ordenes, false);
    expect([...destinos.keys()].sort()).toEqual([a!.id, b!.id, c!.id].sort());
    expect(destinos.has(d!.id)).toBe(false);
    const tope = ESCENARIO.lineaDefensivaX - A.margenFueraJuegoM;
    expect(destinos.get(a!.id)).toEqual({ x: tope, y: cercano.y });
    expect(destinos.get(b!.id)).toEqual({ x: tope, y: lejanoPalo.y });
    expect(destinos.get(c!.id)).toEqual({ x: tope, y: penal.y });
    for (const p of destinos.values()) expect(p.x).toBeLessThanOrEqual(tope);
    // Con cambio de posesión, `cubrir` también es elegible (regla del prototipo, v1.1).
    expect(destinosLlegada(e, "local", ordenes, true).has(d!.id)).toBe(true);

    // Motor: la visita pierde el balón en la zona de centro dentro de la ronda y un jugador con
    // `cubrir` se dirige al área (destino del motor tras el cambio de posesión).
    const robo = (reglas: Reglas) => montar(reglas, est => {
      const [interceptor, cubre] = campo(est, "local"), autor = campo(est, "visita")[0]!;
      const punto = { x: A.zonaCentroXM + ESCENARIO.remateM, y: ESCENARIO.origenCentro.y };
      colocar(interceptor!, punto); colocar(cubre!, { x: punto.x + ESCENARIO.remateM, y: ARENA.anchoM - ESCENARIO.filaY0 }); colocar(autor, { x: punto.x + ESCENARIO.remateM, y: punto.y });
      est.balon = { posicion: { x: punto.x + ESCENARIO.pegadoM, y: punto.y }, poseedor: null, ultimoToque: { jugador: autor.id, lado: "visita" },
        vuelo: { tipo: "pase", autor: autor.id, lado: "visita", receptor: null, origen: { ...autor.posicion }, destino: { x: punto.x - ESCENARIO.remateM, y: punto.y }, inicioTick: 0, adelantados: [] } };
    }, est => ({ [campo(est, "local")[1]!.id]: { accion: "cubrir" } }));
    // Destino de llegada del jugador con `cubrir` justo después del robo (cambio de posesión).
    const paso = robo(V4); paso.ticks(1);
    expect(paso.motor.eventos[0]).toMatchObject({ tipo: "intercepcion", lado: "local" });
    const cubre = campo(paso.motor.estado, "local")[1]!.id;
    const objetivo = destinosLlegada(paso.motor.estado, "local", paso.planes.local.ordenes, true).get(cubre)!;
    expect(objetivo).toBeDefined();
    expect(destinosLlegada(paso.motor.estado, "local", paso.planes.local.ordenes, false).has(cubre)).toBe(false);
    // En una sola ronda (el cambio de posesión ocurre dentro de ella) se dirige a ese destino; en v3 no.
    // Coseno entre el desplazamiento y la dirección al destino de llegada.
    const ronda = (reglas: Reglas) => {
      const m = robo(reglas), p0 = { ...m.j(cubre).posicion }; m.ronda(1);
      const p1 = m.j(cubre).posicion, dx = p1.x - p0.x, dy = p1.y - p0.y, ox = objetivo.x - p0.x, oy = objetivo.y - p0.y;
      return { avance: distancia(p0, objetivo) - distancia(p1, objetivo), coseno: (dx * ox + dy * oy) / (Math.hypot(dx, dy) * Math.hypot(ox, oy)) };
    };
    const v4 = ronda(V4), v3 = ronda("reinicios-v3");
    expect(v4.avance).toBeGreaterThan(L.desplazamientoM);
    expect(v4.coseno).toBeGreaterThan(ESCENARIO.rumboCoseno);
    // En v3 va a su ancla de ataque, en otra dirección.
    expect(v3.coseno).toBeLessThan(ESCENARIO.rumboCoseno);
  });
});

describe("046 · laterales", () => {
  it("14 · lateral A: un pasar fuera de alcance no bloquea al poseedor en v4 (actúa en local dentro de accionCadaS); en v3 no actúa en toda la ronda", () => {
    const v4 = escenarioPasarImposible(V4);
    const id = campo(v4.motor.estado, "local")[0]!.id;
    v4.ronda(ARENA.accionCadaS);
    expect(pasesDe(v4.motor, id).length).toBeGreaterThan(0);
    const v3 = escenarioPasarImposible("reinicios-v3");
    v3.ronda(ESCENARIO.intervaloS);
    expect(pasesDe(v3.motor, id)).toEqual([]);
  });

  it("15 · lateral B: conducir con destino a menos de renovarConduccionM mantiene velocidad tras 1 s", () => {
    expect(velocidadConduccion(V4)).toBeGreaterThanOrEqual(2);
    expect(velocidadConduccion("reinicios-v3")).toBeLessThan(2);
  });
});

describe("046 · controladores LLM", () => {
  const obsDe = (m: MotorArena) => observarArena(m, "local");
  function planCentrar(obs: ObservacionArena, cambio: Partial<OrdenJugador>) {
    const plan = structuredClone(planProgramado(obs)) as OrdenesEquipo;
    const k = plan.ordenes.findIndex(o => o.jugador === campo(obs.estado, "local")[0]!.id);
    plan.ordenes[k] = { ...plan.ordenes[k]!, accion: "centrar", receptor: null, ...cambio };
    return plan;
  }

  it("16 · validarOrdenes, esquema, motor y prompt de centrar", () => {
    const { s, lejano: palo, receptor } = escenarioCentro(V4, false);
    const obs = obsDe(s.motor), porLocal = portero(s.motor.estado, "local").id, rivalId = campo(s.motor.estado, "visita")[0]!.id;
    const pasador = campo(s.motor.estado, "local")[0]!.id;
    expect(() => validarOrdenes(planCentrar(obs, { destino: palo }), obs)).not.toThrow();
    expect(() => validarOrdenes(planCentrar(obs, { destino: palo, receptor }), obs)).not.toThrow();
    expect(() => validarOrdenes(planCentrar(obs, { destino: { x: ARENA.largoM - ARENA.areaLargoM - 1, y: MEDIO_Y } }), obs)).toThrow("Centro fuera del área rival");
    expect(() => validarOrdenes(planCentrar(obs, { destino: { x: ARENA.largoM - 1, y: MEDIO_Y + ARENA.areaAnchoM / 2 + 1 } }), obs)).toThrow("Centro fuera del área rival");
    for (const malo of [pasador, rivalId, porLocal, "inexistente"]) expect(() => validarOrdenes(planCentrar(obs, { destino: palo, receptor: malo }), obs)).toThrow();
    // La orden de la visita usa sus coordenadas: su área rival está junto a x = 0.
    const obsVisita = observarArena(s.motor, "visita"), planVisita = structuredClone(planProgramado(obsVisita)) as OrdenesEquipo;
    planVisita.ordenes[0] = { ...planVisita.ordenes[0]!, accion: "centrar", destino: transformar(palo, "visita"), receptor: null };
    expect(() => validarOrdenes(planVisita, obsVisita)).not.toThrow();
    planVisita.ordenes[0]!.destino = palo;
    expect(() => validarOrdenes(planVisita, obsVisita)).toThrow("Centro fuera del área rival");
    expect(JSON.stringify(esquemaRespuestaArena(obs))).toContain('"centrar"');

    // Motor: desde la zona ejecuta el centro a ese destino; con receptor null, el compañero de campo más cercano.
    const enZona = escenarioCentro(V4, true);
    enZona.s.planes.local.ordenes.find(o => o.jugador === enZona.pasador)!.accion = "centrar";
    enZona.s.planes.local.ordenes.find(o => o.jugador === enZona.pasador)!.destino = { ...palo };
    enZona.s.ticks(1);
    expect(centros(enZona.s.motor)[0]).toMatchObject({ jugador: enZona.pasador, receptor: enZona.receptor });
    expect(centros(enZona.s.motor)[0]!.hasta.x).toBeCloseTo(palo.x, 9);
    // Fuera de la zona conduce y centra al llegar, con la orden pendiente.
    const fuera = escenarioCentro(V4, false, A.zonaCentroXM - ESCENARIO.balonRemateM * 2);
    Object.assign(fuera.s.planes.local.ordenes.find(o => o.jugador === fuera.pasador)!, { accion: "centrar", destino: { ...palo } });
    fuera.s.ticks(1);
    expect(pasesDe(fuera.s.motor, fuera.pasador)).toEqual([]);
    fuera.s.ronda(4);
    const tardio = centros(fuera.s.motor)[0]!;
    expect(tardio).toMatchObject({ jugador: fuera.pasador, motivo: "centro" });
    expect(tardio.desde.x).toBeGreaterThanOrEqual(A.zonaCentroXM);
    // Bajo v3, centrar se acepta pero se decide en local: no hay centro.
    const v3 = escenarioCentro("reinicios-v3", true);
    Object.assign(v3.s.planes.local.ordenes.find(o => o.jugador === v3.pasador)!, { accion: "centrar", destino: { ...palo } });
    v3.s.ronda(1);
    expect(centros(v3.s.motor)).toEqual([]);

    // Prompt: construido con constantes alteradas, recoge esas cifras (no hay cifras escritas a mano).
    const alteradas = { largoM: 111, zonaCentroXM: 77, centroMaxM: 43, accionCadaS: 3, manosMaxS: 7, distanciaManosM: 5 };
    const texto = frasesCentroPortero(alteradas);
    for (const fragmento of ["x>=77", "x<=34", "43 m", "a 5 m", "entre 3 y 7 s"]) expect(texto).toContain(fragmento);
    expect(SISTEMA_ARENA).toContain(frasesCentroPortero());
    expect(SISTEMA_ARENA).toContain("tirar|centrar");
  });

  it("v1.1 · 9: un centrar inválido del LLM activa el respaldo archivado (orden_invalida) y la reproducción es exacta; uno válido también se reproduce", async () => {
    const llm = (valido: boolean): Llm => ({ id: "llm-prueba-centrar", async completar(_s, mensajes) {
      const obs = JSON.parse(mensajes[0]!.contenido) as ObservacionArena, plan = structuredClone(planProgramado(obs)) as OrdenesEquipo;
      const k = plan.ordenes.findIndex(o => o.jugador === (obs.estado.balon.poseedor ?? plan.ordenes[1]!.jugador));
      const destino = valido ? transformar(objetivosCentro(transformar(obs.estado.balon.posicion, obs.lado))[1], obs.lado) : { x: ARENA.largoM / 2, y: MEDIO_Y };
      if (k >= 0) plan.ordenes[k] = { ...plan.ordenes[k]!, accion: "centrar", destino, receptor: null };
      return JSON.stringify(plan);
    } });
    for (const valido of [false, true]) {
      const r = await ejecutarArena(crearConfigArena({ seed: ESCENARIO.semilla, duracionS: ESCENARIO.intervaloS, intervaloS: ESCENARIO.intervaloS / 2 }), { local: crearControladorLlm(llm(valido)), visita: crearControladorProgramado() });
      for (const ronda of r.rondas) expect(ronda.decisiones.local).toMatchObject(valido ? { origen: "controlador", motivo: "valida" } : { origen: "respaldo", motivo: "orden_invalida" });
      if (valido) expect(r.rondas.some(ronda => ronda.decisiones.local.ordenes.ordenes.some(o => o.accion === "centrar"))).toBe(true);
      expect(reproducirArena(structuredClone(r))).toEqual(r);
    }
  });
});

describe("046 · versiones", () => {
  const leer = async (nombre: string) => JSON.parse(await readFile(`src/arena/__fixtures__/${nombre}.json`, "utf8")) as RegistroArena;

  it("17 · v1–v3 se reproducen exactos; el fixture v4 cumple sus condiciones y se reproduce; validación y valor por defecto", async () => {
    for (const v of ["v1", "v2", "v3"]) {
      const r = await leer(`arena-reinicios-${v}`);
      expect(r.config.reglas).toBe(`reinicios-${v}`);
      expect(reproducirArena(r)).toEqual(r);
    }
    const r = await leer("arena-reinicios-v4");
    expect(r.config.reglas).toBe(V4);
    expect(cumpleFixtureV4(r)).toBe(true);
    expect(salidasEnFotogramas(r).some(d => d > L.desplazamientoM)).toBe(true);
    expect(reproducirArena(r)).toEqual(r);
    expect(r.rondas.flatMap(x => Object.values(x.decisiones)).every(d => d.tiempoMs === 0)).toBe(true);

    // Brief 051: reinicios-v4 pasa a ser literal y la predeterminada es reinicios-v5.
    expect(reglasArena).toEqual(["reinicios-v1", "reinicios-v2", "reinicios-v3", V4, "reinicios-v5"]);
    expect(crearConfigArena().reglas).toBe("reinicios-v5");
    expect(ARENA.reglas).toBe("reinicios-v5");
    expect(crearConfigArena({ reglas: "reinicios-v3" }).reglas).toBe("reinicios-v3");
    expect(() => crearConfigArena({ version: ARENA.versionPersonalidades, reglas: "reinicios-v3" })).toThrow();
    const base = crearConfigArena();
    for (const reglas of reglasArena) expect(() => validarConfigArena({ ...base, reglas })).not.toThrow();
    expect(() => validarConfigArena({ ...base, reglas: "reinicios-v6" as never })).toThrow("Reglas");
    for (const [i, reglas] of reglasArena.entries()) {
      expect(reglasDesde({ ...base, reglas }, "reinicios-v3")).toBe(i >= 2);
      expect(reglasDesde({ ...base, reglas }, V4)).toBe(i >= 3);
    }
    const sin = { ...base }; delete sin.reglas;
    expect(reglasDesde(sin, "reinicios-v1")).toBe(false);
  });

  it("v1.1 · 10: matriz de versiones — cada comportamiento nuevo cambia solo con v4", () => {
    const seedAtajada = semillaAtajada(V4);
    const comportamientos: { nombre: string; medir: (r: Reglas) => boolean }[] = [
      { nombre: "manos tras atajada", medir: r => { const s = remate(r, seedAtajada); s.ticks(1); return s.motor.estado.balon.manos !== undefined; } },
      { nombre: "salida a achicar", medir: r => salidaDelPortero(escenarioManoAMano(r, false), 1) > L.desplazamientoM },
      { nombre: "radio de reacción", medir: r => !remateBocajarro(r).motor.eventos.some(e => e.tipo === "atajada") },
      { nombre: "conducción sin salida", medir: r => { const x = recorridoExtremo(escenarioExtremo(r), 4); return x.maxX < ARENA.largoM && !x.reinicios.some(e => e.reinicio === "meta" || e.reinicio === "banda"); } },
      { nombre: "centro", medir: r => { const { s } = escenarioCentro(r, false); s.ticks(1); return centros(s.motor).length > 0; } },
      { nombre: "llegada al área", medir: r => { const s = escenarioLlegada(r), id = campo(s.motor.estado, "local")[1]!.id, p = { ...s.j(id).posicion }; s.ronda(1); return distancia(p, s.j(id).posicion) > L.desplazamientoM; } },
      { nombre: "lateral A", medir: r => { const s = escenarioPasarImposible(r), id = campo(s.motor.estado, "local")[0]!.id; s.ronda(ARENA.accionCadaS); return pasesDe(s.motor, id).length > 0; } },
      { nombre: "lateral B", medir: r => velocidadConduccion(r) >= 2 },
    ];
    for (const c of comportamientos) {
      expect({ c: c.nombre, v4: c.medir(V4) }).toEqual({ c: c.nombre, v4: true });
      for (const r of ANTERIORES) expect({ c: c.nombre, reglas: r ?? "sin reglas", nuevo: c.medir(r) }).toEqual({ c: c.nombre, reglas: r ?? "sin reglas", nuevo: false });
    }
  });
});

describe("046 · relato y narración", () => {
  const leer = async () => JSON.parse(await readFile("src/arena/__fixtures__/arena-reinicios-v4.json", "utf8")) as RegistroArena;
  const nombre = (r: RegistroArena, id: string) => [...r.inicial.jugadores, ...r.inicial.banco ?? []].find(j => j.id === id)!;

  it("18 · textos ES/EN de centro y saque_manos (vista y modo breve) y narrador de plantilla con el centro como hecho principal", async () => {
    const r = await leer();
    const centro = r.eventos.find(e => e.tipo === "pase" && e.motivo === "centro")!, saque = r.eventos.find(e => e.tipo === "pase" && e.motivo === "saque_manos")!;
    const j = (e: EventoArena) => nombre(r, e.jugador), rc = (e: EventoArena) => nombre(r, e.receptor!);
    expect(narrarEventoArena(centro, r, "es")).toBe(`${j(centro).nombre} (${j(centro).dorsal}) centra al área hacia ${rc(centro).nombre} (${Math.round(centro.distanciaM)} m).`);
    expect(narrarEventoArena(centro, r, "en")).toBe(`${j(centro).nombre} (${j(centro).dorsal}) crosses into the box towards ${rc(centro).nombre} (${Math.round(centro.distanciaM)} m).`);
    expect(narrarEventoArena(saque, r, "es")).toBe(`${j(saque).nombre} (${j(saque).dorsal}) pone el balón en juego desde sus manos hacia ${rc(saque).nombre} (${Math.round(saque.distanciaM)} m).`);
    expect(narrarEventoArena(saque, r, "en")).toBe(`${j(saque).nombre} (${j(saque).dorsal}) puts the ball back in play from the hands towards ${rc(saque).nombre} (${Math.round(saque.distanciaM)} m).`);
    // Modo breve (vivo): la ventana termina en el evento, que es su último hecho.
    const ventana = (e: EventoArena, idioma: "es" | "en") => {
      const intervalo = RELATO_INTERVALOS.vivo, desde = Math.floor((e.tick - 1) / intervalo) * intervalo;
      const ultimo = r.eventos.filter(x => x.tick <= e.tick).at(-1)!;
      expect(ultimo.id).toBe(e.id);
      return construirRelato(r, desde, e.tick, "vivo", idioma).texto;
    };
    expect(ventana(centro, "es")).toContain(`¡Centro de ${j(centro).nombre}!`);
    expect(ventana(centro, "en")).toContain(`${j(centro).nombre} sends in a cross!`);
    expect(ventana(saque, "es")).toContain(narrarEventoArena(saque, r, "es"));
    expect(ventana(saque, "en")).toContain(narrarEventoArena(saque, r, "en"));
    // Narrador de plantilla (LLM caído): el centro como hecho principal pasa V1–V8.
    const caido: Llm = { id: "llm-caido", async completar() { throw new Error("sin servicio"); } };
    for (const e of [centro, saque]) {
      const c = await narrarArena(r, e.tick, caido, { principal: `arena:${e.id}` });
      expect(c).toMatchObject({ modo: "plantilla", principal: `arena:${e.id}` });
      expect(c!.oraciones[0]!.texto_es).toBe(narrarEventoArena(e, r, "es"));
    }
  });
});

describe("046 · v1.2: el saque del portero no regala el gol", () => {
  /** Portero local con manos en su ancla; el compañero `corto` (si se da) a `corto` del portero y el
   * resto de los compañeros de campo más allá de saqueManosMaxM (sin opción de pase ordinario). */
  function saqueEscenario(corto: Punto | null, extra: (e: EstadoArena) => void = () => {}) {
    return conManos(V4, e => {
      const por = portero(e, "local"), propios = campo(e, "local");
      propios.forEach((j, k) => colocar(j, { x: por.posicion.x + PO.saqueManosMaxM + ESCENARIO.remateM, y: ESCENARIO.filaY0 + ESCENARIO.filaDY * k }));
      if (corto) colocar(propios[0]!, { x: por.posicion.x + corto.x, y: por.posicion.y + corto.y });
      extra(e);
    });
  }
  /** Compañero corto en diagonal, a menos de saqueAereoMinM y de paseMaxM. */
  const DIAGONAL = { x: ESCENARIO.remateM + 4, y: -(ESCENARIO.remateM + 4) };

  it("1 · histéresis: los rivales respetan distanciaManosM + margenManosM y, con la tolerancia de llegada, nunca bloquean el saque voluntario", () => {
    expect(RADIO_MANOS - ARENA.toleranciaM).toBeGreaterThan(PO.distanciaManosM);
    const s = saqueEscenario(DIAGONAL, e => {
      const p = portero(e, "local").posicion;
      colocar(campo(e, "visita")[0]!, { x: p.x, y: p.y + RADIO_MANOS * 2 });
    });
    const por = portero(s.motor.estado, "local").id, rival = campo(s.motor.estado, "visita")[0]!.id, hasta = s.motor.estado.balon.manos!.hastaTick;
    s.planes.visita.ordenes.find(o => o.jugador === rival)!.destino = { ...s.j(por).posicion };
    let minima = Infinity;
    while (!pasesDe(s.motor, por).length && s.motor.estado.tick <= hasta) { s.ticks(1); minima = Math.min(minima, distancia(s.j(rival).posicion, s.j(por).posicion)); }
    expect(minima).toBeGreaterThanOrEqual(PO.distanciaManosM);
    const saque = pasesDe(s.motor, por)[0]!;
    // Saque voluntario (antes del plazo) hacia el compañero corto.
    expect(saque).toMatchObject({ motivo: "saque_manos", receptor: campo(s.motor.estado, "local")[0]!.id });
    expect(saque.tick - 1).toBeLessThan(hasta);
  });

  it("2 · un saque largo (> saqueAereoMinM) va por arriba: un rival plantado en mitad de la trayectoria no lo toca", () => {
    const largo = (PO.saqueAereoMinM + PO.saqueManosMaxM) / 2;
    const s = saqueEscenario(null, e => {
      const p = portero(e, "local").posicion;
      colocar(campo(e, "local")[0]!, { x: p.x + largo, y: p.y });
      colocar(campo(e, "visita")[0]!, { x: p.x + largo / 2, y: p.y });
    });
    const por = portero(s.motor.estado, "local").id, [receptor] = campo(s.motor.estado, "local"), plantado = campo(s.motor.estado, "visita")[0]!.id;
    Object.assign(s.planes.local.ordenes.find(o => o.jugador === por)!, { accion: "pasar", receptor: receptor!.id, destino: { ...receptor!.posicion } });
    const fijo = { ...s.j(plantado).posicion };
    s.ticks(ticksDe(PO.manosMaxS + 2), () => colocar(s.j(plantado), fijo));
    const saque = pasesDe(s.motor, por)[0]!;
    expect(saque).toMatchObject({ motivo: "saque_manos", receptor: receptor!.id });
    expect(saque.distanciaM).toBeGreaterThan(PO.saqueAereoMinM);
    expect(s.motor.eventos.filter(e => e.jugador === plantado && e.tipo !== "pase")).toEqual([]);
    expect(s.motor.eventos.find(e => e.tick > saque.tick && ["recepcion", "intercepcion"].includes(e.tipo))).toMatchObject({ tipo: "recepcion", jugador: receptor!.id });
  });

  it("3 · un saque corto exige línea limpia (el voluntario espera) y el forzado elige entre saques admisibles el de mayor margen", () => {
    // El compañero corto es el más aislado, pero un rival a 1 m de su línea (y a ≥ distanciaManosM
    // del portero) la ensucia: no es admisible.
    const s = saqueEscenario({ x: ESCENARIO.remateM + 4, y: 0 }, e => {
      const p = portero(e, "local").posicion;
      colocar(campo(e, "visita")[0]!, { x: p.x + PO.distanciaManosM + 1, y: p.y + 1 });
    });
    const por = portero(s.motor.estado, "local").id, corto = campo(s.motor.estado, "local")[0]!.id, sucio = campo(s.motor.estado, "visita")[0]!.id;
    const hasta = s.motor.estado.balon.manos!.hastaTick, fijo = { ...s.j(sucio).posicion };
    // Orden explícita de pasar al compañero corto: no sale porque su línea no está limpia.
    Object.assign(s.planes.local.ordenes.find(o => o.jugador === por)!, { accion: "pasar", receptor: corto, destino: { ...s.j(corto).posicion } });
    s.ticks(hasta, () => colocar(s.j(sucio), fijo));
    expect(pasesDe(s.motor, por)).toEqual([]);
    const e = s.motor.estado, yo = s.j(por), rivales = e.jugadores.filter(j => j.lado === "visita");
    expect(saqueAdmisible(yo.posicion, s.j(corto).posicion, rivales).admisible).toBe(false);
    const admisibles = campo(e, "local").filter(c => saqueAdmisible(yo.posicion, c.posicion, rivales).admisible)
      .map(c => ({ id: c.id, m: margen(e, c.posicion, "local") })).sort((a, b) => b.m - a.m || a.id.localeCompare(b.id));
    // El más aislado de todos es el corto (no admisible); el forzado elige el mejor admisible.
    expect(campo(e, "local").map(c => ({ id: c.id, m: margen(e, c.posicion, "local") })).sort((a, b) => b.m - a.m)[0]!.id).toBe(corto);
    s.ticks(1, () => colocar(s.j(sucio), fijo));
    const forzado = pasesDe(s.motor, por)[0]!;
    expect(forzado).toMatchObject({ motivo: "saque_manos", tick: hasta + 1, receptor: admisibles[0]!.id });
    expect(s.motor.estado.balon.vuelo?.aereo).toBe(true);
  });

  it("3b · sin saques admisibles, saqueForzado no devuelve receptor (despeje aéreo)", () => {
    const e = structuredClone(conManos(V4).motor.estado), por = portero(e, "local"), [corto] = campo(e, "local"), r = campo(e, "visita")[0]!;
    colocar(corto!, { x: por.posicion.x + PO.saqueAereoMinM / 2, y: por.posicion.y });
    colocar(r, { x: por.posicion.x + PO.saqueAereoMinM / 4, y: por.posicion.y + 1 });
    e.jugadores = [por, corto!, r];
    expect(saqueForzado(por, e)).toBeUndefined();
  });

  it("5 · validación de centrar: el portero no centra y el destino no queda a menos de margenLineaCentroM de la línea de gol", () => {
    const { s, lejano: palo } = escenarioCentro(V4, false);
    const obs = observarArena(s.motor, "local"), por = portero(s.motor.estado, "local").id;
    const plan = (jugador: string, destino: Punto) => { const p = structuredClone(planProgramado(obs)) as OrdenesEquipo; const k = p.ordenes.findIndex(o => o.jugador === jugador); p.ordenes[k] = { ...p.ordenes[k]!, accion: "centrar", destino, receptor: null }; return p; };
    expect(() => validarOrdenes(plan(por, palo), obs)).toThrow("El portero no puede centrar");
    const pasador = campo(s.motor.estado, "local")[0]!.id;
    expect(() => validarOrdenes(plan(pasador, { x: ARENA.largoM, y: MEDIO_Y }), obs)).toThrow("línea de gol");
    expect(() => validarOrdenes(plan(pasador, { x: ARENA.largoM - A.margenLineaCentroM + 0.1, y: MEDIO_Y }), obs)).toThrow("línea de gol");
    expect(() => validarOrdenes(plan(pasador, { x: ARENA.largoM - A.margenLineaCentroM, y: MEDIO_Y }), obs)).not.toThrow();
  });

  // Mutantes supervivientes de la auditoría (B2).
  it("M33 · un pasar del portero a más de saqueManosMaxM no se obedece: usa la opción ordinaria", () => {
    const s = saqueEscenario(DIAGONAL);
    const por = portero(s.motor.estado, "local").id, [corto, lejos] = campo(s.motor.estado, "local");
    expect(distancia(s.j(por).posicion, lejos!.posicion)).toBeGreaterThan(PO.saqueManosMaxM);
    Object.assign(s.planes.local.ordenes.find(o => o.jugador === por)!, { accion: "pasar", receptor: lejos!.id, destino: { ...lejos!.posicion } });
    s.ticks(ticksDe(PO.manosMaxS) - 1);
    expect(pasesDe(s.motor, por)[0]).toMatchObject({ motivo: "saque_manos", receptor: corto!.id });
  });

  it("M35 · receptorCentro nunca devuelve al portero aunque esté más cerca del destino", () => {
    const { s, pasador } = escenarioCentro(V4, false);
    const e = structuredClone(s.motor.estado), j = e.jugadores.find(x => x.id === pasador)!, destino = transformar(objetivosCentro(transformar(j.posicion, "local"))[1], "local");
    colocar(portero(e, "local"), { x: destino.x, y: destino.y + 1 });
    const masCercano = campo(e, "local").filter(c => c.id !== pasador).sort((a, b) => distancia(a.posicion, destino) - distancia(b.posicion, destino))[0]!;
    expect(receptorCentro(j, destino, e)?.id).toBe(masCercano.id);
    expect(receptorCentro(j, destino, e)?.puesto).not.toBe("POR");
  });

  it("M39 · el portero con el balón en las manos no obedece conducir", () => {
    const s = conManos(V4);
    const por = portero(s.motor.estado, "local"), inicio = { ...por.posicion };
    Object.assign(s.planes.local.ordenes.find(o => o.jugador === por.id)!, { accion: "conducir", destino: { x: inicio.x + A.renovarConduccionM * 3, y: inicio.y + A.renovarConduccionM * 3 } });
    s.ticks(ticksDe(1));
    expect(s.motor.estado.balon.manos?.portero).toBe(por.id);
    expect(distancia(s.j(por.id).posicion, inicio)).toBeLessThan(1e-9);
  });

  it("M40 · el borde del área cuenta como área (sin margen interior)", () => {
    for (const lado of lados) {
      const en = (x: number, y = MEDIO_Y) => enAreaPropia(transformar({ x, y }, lado), lado);
      expect(en(ARENA.areaLargoM)).toBe(true);
      expect(en(ARENA.areaLargoM - ARENA.toleranciaM)).toBe(true);
      expect(en(ARENA.areaLargoM + ARENA.toleranciaM)).toBe(false);
      expect(en(ARENA.controlM, MEDIO_Y + ARENA.areaAnchoM / 2)).toBe(true);
      expect(en(ARENA.controlM, MEDIO_Y + ARENA.areaAnchoM / 2 + ARENA.toleranciaM)).toBe(false);
    }
  });

  it("M42 · sin ventaja positiva en ningún objetivo no hay centro", () => {
    const { s, pasador } = escenarioCentro(V4, false);
    const e = structuredClone(s.motor.estado);
    // Un rival de campo entre los tres objetivos, más cerca de todos que el receptor.
    colocar(campo(e, "visita")[0]!, { x: ARENA.largoM - (A.paloXM + A.penalXM) / 2, y: MEDIO_Y });
    expect(opcionCentro(e.jugadores.find(x => x.id === pasador)!, e)).toBeUndefined();
  });
});

describe("046 · lote de 30 semillas (bandas rápidas de LOTE_ARENA_046)", () => {
  it("cumple todas las bandas rápidas", { timeout: 180_000 }, async () => {
    // Brief 051: el lote del 046 fija reinicios-v4 (las bandas sobre v5 las exige motor051).
    const m = await medirLote({ desde: L.rapido.semillaDesde, semillas: L.rapido.semillas, reglas: V4 });
    expect(m.partidos).toBe(L.rapido.semillas);
    expect(incumplimientos(m, L.rapido)).toEqual([]);
  });
});
