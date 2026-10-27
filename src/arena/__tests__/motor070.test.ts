// Brief 070 · tiro libre real (A), penal (B) y texto/voz/prompt (C) de reinicios-v11. Las cifras de las reglas se leen
// de limites.ts (ARENA.distanciaSaqueLibreM, LIBRE_ARENA, PENAL_ARENA); los valores de ESCENARIO son posiciones elegidas
// para aislar cada regla, no reglas.
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual as isDeepEqual } from "node:util";
import { describe, expect, it } from "vitest";
import { ARENA, BANDAS_070 as B70, CANTO_GOL, LARGO_ARENA as LA, LIBRE_ARENA as LI, LOTE_ARENA_046 as L, LOTE_ARENA_051 as L51, LOTE_ARENA_063 as L63, PENAL_ARENA as PE, TECNICA_ARENA as T } from "../../sim/limites";
import { bandasLote, incumplimientos, incumplimientos063, incumplimientosBC, incumplimientosControlado, medirControlado, medirLote } from "../metricas-lote";
import { prngDerivado } from "../../sim/prng";
import type { Lado } from "../../sim/tipos";
import { probabilidadFalta } from "../arbitro";
import { anclas, transformar } from "../catalogo";
import { frasesTiroLibre, SISTEMA_ARENA } from "../controladores";
import { ejecutarArena, reproducirArena } from "../coordinador";
import { hechosCronicaArena } from "../cronica-hechos";
import { datosEstadista } from "../estadista";
import { distancia, enCancha } from "../geometria";
import { colocacionPenal, desenlacePenal, ejecutorPenal, opcionDirecto, probabilidadPenal, puntoPenal } from "../libre";
import { contarPartido070, incumplimientos070, agregar070 } from "../metricas-070";
import { adelantados, crearConfigArena, crearEstadoArena, MotorArena, reglasDesde } from "../motor";
import { enAreaPropia } from "../portero";
import { cantoGol, construirRelato, penalDe } from "../relato";
import { RELATO_INTERVALOS } from "../protocolo";
import { lados, reglasArena, type ConfigArena, type EstadoArena, type EventoArena, type JugadorArena, type OrdenesEquipo, type OrdenJugador, type Punto, type RegistroArena, type ReglasArena } from "../tipos";
import { narrarEventoArena } from "../vista";
import { claseIcono } from "../../ui/IconosArena";
import { condicionesFixtureV11, cumpleFixtureV11, DURACION_FIXTURE_V11_S } from "../__fixtures__/generar-reinicios-v11";
import { crearControladorProgramado } from "../controladores";

const V10 = "reinicios-v10" as const, V11 = "reinicios-v11" as const;
const MEDIO_Y = ARENA.anchoM / 2;

const ESCENARIO = {
  semilla: 7, duracionS: 30, intervaloS: 10,
  /** Jugadores de campo que no intervienen: locales junto a su línea de gol, visitantes en x = 30. */
  parqueLocalX: 2, parqueVisitaX: 30, filaY0: 4, filaDY: 6,
  /** Falta fuera del área visitante, en el pasillo central y a ≤ directoMaxM (tiro directo posible). */
  faltaDirecto: { x: 84, y: 36 },
  /** Falta fuera del pasillo central (sin tiro directo) y a ≤ LARGO_ARENA.remate.maxM del arco. */
  faltaBanda: { x: 82, y: 12 },
  /** Falta en el medio campo (sin tiro directo). */
  faltaMedio: { x: 55, y: 40 },
  /** Falta dentro del área visitante. */
  faltaArea: { x: 95, y: 30 },
  /** Corrimientos de los rivales que rodean el punto (todos a menos de 9,15 m). */
  cerco: [{ x: 1, y: 0 }, { x: 3, y: 2 }, { x: -2, y: 4 }, { x: 5, y: -5 }, { x: 0, y: -8 }],
  /** Compañero para un pase explícito, a ≤ paseMaxM del punto y en línea. */
  companero: { dx: -10, dy: 6 },
  /** Compañero adelantado a ≤ paseMaxM de faltaMedio (más allá del balón y de los visitantes apartados). */
  adelantadoLibre: { x: 75, y: 40 },
  /** Ticks de búsqueda de la falta forzada y de los desenlaces. */
  ticksBusqueda: 280, ticksVuelo: 40, muestraDesenlaces: 60,
} as const;

const campo = (e: EstadoArena, lado: Lado) => e.jugadores.filter(j => j.lado === lado && j.puesto !== "POR").sort((a, b) => a.id.localeCompare(b.id));
const portero = (e: EstadoArena, lado: Lado) => e.jugadores.find(j => j.lado === lado && j.puesto === "POR")!;
function colocar(j: JugadorArena, p: Punto) { j.posicion = { ...p }; j.velocidad = { x: 0, y: 0 }; }
type OrdenEscenario = { accion: OrdenJugador["accion"]; destino?: Punto; receptor?: string | null };
interface Privado {
  resolverFalta(d: JugadorArena, p: JugadorArena): boolean;
  prepararSaque(tipo: string, lado: Lado, punto: Punto, ultimoToque?: string, falta?: { ejecutor: JugadorArena; id: string }): void;
}
interface Escenario { motor: MotorArena; privado: Privado; planes: Record<Lado, OrdenesEquipo>; j(id: string): JugadorArena; ticks(n: number): void; eventos(tipo: EventoArena["tipo"]): EventoArena[]; ordenes(o: Record<string, OrdenEscenario>): void }
/** Estado sin saque ni pausa; los jugadores de campo aparcados; `preparar` coloca a los protagonistas. */
function montar(reglas: ReglasArena, preparar: (e: EstadoArena) => void): Escenario {
  const config: ConfigArena = crearConfigArena({ seed: ESCENARIO.semilla, duracionS: ESCENARIO.duracionS, intervaloS: ESCENARIO.intervaloS, local: "4-3-3", visita: "5-3-2", reglas });
  const inicial = crearEstadoArena(config);
  inicial.saque = null; inicial.pausa = null;
  for (const lado of lados) {
    campo(inicial, lado).forEach((j, k) => colocar(j, { x: lado === "local" ? ESCENARIO.parqueLocalX : ESCENARIO.parqueVisitaX, y: ESCENARIO.filaY0 + ESCENARIO.filaDY * k }));
    colocar(portero(inicial, lado), anclas(config.formaciones[lado], lado, "base").POR!);
  }
  preparar(inicial);
  const motor = new MotorArena(config, inicial);
  const planes = {} as Record<Lado, OrdenesEquipo>;
  const s: Escenario = {
    motor, privado: motor as unknown as Privado, planes,
    j: id => motor.estado.jugadores.find(j => j.id === id)!,
    ticks(n) { for (let i = 0; i < n && !motor.estado.finalizado; i++) motor.avanzar(planes, motor.estado.tick + 1); },
    eventos: tipo => motor.eventos.filter(e => e.tipo === tipo),
    ordenes(o) {
      for (const lado of lados) planes[lado] = { observacion: `escenario:${lado}`, lado, intencion: "Escenario de prueba", amplitud: "media", bloque: "medio", gestion: null,
        ordenes: motor.estado.jugadores.filter(j => j.lado === lado).map(j => ({ jugador: j.id, accion: o[j.id]?.accion ?? "mover", destino: o[j.id]?.destino ?? { ...j.posicion }, receptor: o[j.id]?.receptor ?? null }))
          .sort((a, b) => a.jugador.localeCompare(b.jugador)) };
    },
  };
  s.ordenes({});
  return s;
}
/** Víctima local (primer delantero) con el balón en `punto`, el infractor visitante (primer medio) pegado y el resto de
 * visitantes de campo alrededor del punto (`cerco`). */
function falta(reglas: ReglasArena, punto: Punto, extra: (e: EstadoArena) => void = () => {}) {
  let ids = { v: "", d: "" };
  const s = montar(reglas, e => {
    const v = campo(e, "local").find(j => j.posicionNatural === "DEL")!, rivales = campo(e, "visita");
    const d = rivales.find(j => j.posicionNatural === "MED")!;
    ids = { v: v.id, d: d.id };
    colocar(v, punto); colocar(d, { x: punto.x + 0.5, y: punto.y });
    rivales.filter(j => j.id !== d.id).slice(0, ESCENARIO.cerco.length).forEach((j, k) => colocar(j, enCancha({ x: punto.x + ESCENARIO.cerco[k]!.x, y: punto.y + ESCENARIO.cerco[k]!.y })));
    e.balon = { posicion: { ...punto }, poseedor: v.id, vuelo: null };
    extra(e);
  });
  return { s, ...ids };
}
/** Fuerza la falta: el primer tick (desde el actual) en el que el PRNG de `resolverFalta` la señala, y la resuelve. */
function forzarFalta(s: Escenario, defensor: string, portador: string): number {
  const e = s.motor.estado, d = s.j(defensor);
  const p = probabilidadFalta(d.personalidad!, e.arbitro!.criterioContacto!, true);
  let t = e.tick;
  while (!prngDerivado(ESCENARIO.semilla, `falta:arena-v3:${t}:${defensor}`).chance(p)) t++;
  expect(t).toBeLessThan(ESCENARIO.ticksBusqueda);
  e.tick = t;
  expect(s.privado.resolverFalta(d, s.j(portador))).toBe(true);
  return t;
}
const reinicios = (s: Escenario) => s.motor.eventos.filter(e => e.tipo === "reinicio");
const ticksPausa = Math.round(T.pausaS / ARENA.pasoS);

describe("070 · A · tiro libre (reinicios-v11)", () => {
  it("A1 · punto de la falta, ejecutor = quien la recibió, rivales a ≥ distanciaSaqueLibreM con el empuje de los saques, compañeros sin mover, pausa y evento con `fuentes` (mutación: sin distancia de barrera)", () => {
    const { s, v, d } = falta(V11, ESCENARIO.faltaMedio);
    const antes = structuredClone(s.motor.estado.jugadores);
    expect(s.motor.estado.jugadores.filter(j => j.lado === "visita" && distancia(j.posicion, ESCENARIO.faltaMedio) < ARENA.distanciaSaqueLibreM).length).toBeGreaterThan(2);
    const t = forzarFalta(s, d, v);
    const f = s.eventos("falta")[0]!, r = reinicios(s)[0]!, e = s.motor.estado;
    expect(r).toMatchObject({ tick: t, jugador: v, lado: "local", reinicio: "libre", fuentes: [f.id], hasta: enCancha(f.hasta) });
    expect(r.motivo).toBeUndefined();
    expect(e.saque).toMatchObject({ tipo: "libre", lado: "local", ejecutor: v, punto: enCancha(f.hasta), hastaTick: t + ticksPausa, falta: f.id });
    expect(e.pausa).toMatchObject({ hastaTick: t + ticksPausa, motivo: "reinicio" });
    expect(e.balon).toMatchObject({ poseedor: v, posicion: enCancha(f.hasta), vuelo: null });
    for (const j of e.jugadores) {
      if (j.lado === "visita") expect({ id: j.id, cerca: distancia(j.posicion, e.saque!.punto) < ARENA.distanciaSaqueLibreM }).toEqual({ id: j.id, cerca: false });
      else if (j.id !== v) expect(j.posicion).toEqual(antes.find(x => x.id === j.id)!.posicion);
    }
    // Durante la pausa nadie se mueve: en el tick de ejecución siguen igual de lejos.
    const quietos = structuredClone(e.jugadores);
    s.ticks(ticksPausa);
    expect(e.jugadores.map(j => j.posicion)).toEqual(quietos.map(j => j.posicion));
    s.ticks(1);
    expect(s.motor.eventos.find(x => (x.tipo === "pase" || x.tipo === "tiro") && x.reinicio === "libre")).toMatchObject({ jugador: v });
  });

  it("A2 · v10 sin cambios: la falta se reanuda en los pies de quien la recibió, sin distancia y con `motivo: \"falta\"`", () => {
    const { s, v, d } = falta(V10, ESCENARIO.faltaMedio);
    const antes = structuredClone(s.motor.estado.jugadores.filter(j => j.lado === "visita" && j.id !== d));
    forzarFalta(s, d, v);
    const f = s.eventos("falta")[0]!;
    expect(reinicios(s)[0]).toMatchObject({ jugador: v, motivo: "falta", fuentes: [f.id] });
    expect(reinicios(s)[0]!.reinicio).toBeUndefined();
    expect(s.motor.estado.saque).toBeNull();
    for (const j of antes) expect(s.j(j.id).posicion).toEqual(j.posicion);
  });

  it("A3 · si quien recibió la falta sale en la misma pausa (sustitución), ejecuta el compañero de campo más cercano", () => {
    const { s, v, d } = falta(V11, ESCENARIO.faltaMedio);
    const e = s.motor.estado, entra = e.banco!.find(j => j.lado === "local")!;
    e.entrenadores!.local.pendiente = { sale: v, entra: entra.id };
    forzarFalta(s, d, v);
    expect(e.jugadores.some(j => j.id === v)).toBe(false);
    const punto = enCancha(s.eventos("falta")[0]!.hasta);
    const esperado = e.jugadores.filter(j => j.lado === "local" && j.puesto !== "POR").sort((a, b) => distancia(a.posicion, punto) - distancia(b.posicion, punto) || a.id.localeCompare(b.id))[0]!;
    expect(e.saque).toMatchObject({ tipo: "libre", ejecutor: esperado.id });
  });

  it("A4 · el fuera de juego se aplica: el tiro libre NO limpia `adelantados` (al revés que banda, esquina y meta)", () => {
    const { s, v, d } = falta(V11, ESCENARIO.faltaMedio, e => {
      // El compañero más cercano al punto, adelantado: más allá de todos los visitantes salvo el portero.
      const c = campo(e, "local").find(j => j.posicionNatural === "MED")!;
      colocar(c, { x: 99, y: 40 });
      for (const j of campo(e, "local")) if (j.posicionNatural !== "DEL" && j.id !== c.id) colocar(j, { x: ESCENARIO.parqueLocalX, y: j.posicion.y });
    });
    forzarFalta(s, d, v);
    const fuera = adelantados(s.motor.estado, "local");
    s.ticks(ticksPausa + 1);
    const pase = s.motor.eventos.find(x => x.tipo === "pase" && x.reinicio === "libre")!;
    expect(fuera).toContain(pase.receptor);
    expect(s.motor.estado.balon.vuelo?.adelantados).toContain(pase.receptor);
    s.ticks(ESCENARIO.ticksVuelo * 2);
    expect(s.eventos("fuera_juego").map(x => x.jugador)).toContain(pase.receptor);
  });

  it("A5 · opcionDirecto: ≤ directoMaxM del arco rival y en el pasillo central, por lado; con constantes alteradas", () => {
    const arco = { x: ARENA.largoM, y: MEDIO_Y };
    expect(opcionDirecto({ x: arco.x - LI.directoMaxM, y: MEDIO_Y }, "local")).toBe(true);
    expect(opcionDirecto({ x: arco.x - LI.directoMaxM - 0.1, y: MEDIO_Y }, "local")).toBe(false);
    expect(opcionDirecto({ x: arco.x - 5, y: MEDIO_Y + LI.pasilloM }, "local")).toBe(true);
    expect(opcionDirecto({ x: arco.x - 5, y: MEDIO_Y + LI.pasilloM + 0.1 }, "local")).toBe(false);
    expect(opcionDirecto({ x: LI.directoMaxM - 1, y: MEDIO_Y }, "visita")).toBe(true);
    expect(opcionDirecto({ x: LI.directoMaxM - 1, y: MEDIO_Y }, "local")).toBe(false);
    expect(opcionDirecto({ x: arco.x - 30, y: MEDIO_Y }, "local", { directoMaxM: 31, pasilloM: 1 })).toBe(true);
    expect(opcionDirecto(ESCENARIO.faltaDirecto, "local")).toBe(true);
    expect(opcionDirecto(ESCENARIO.faltaBanda, "local")).toBe(false);
  });

  it("A6 · sin orden explícita, el tiro directo sale con probabilidad LIBRE_ARENA.probDirecto (PRNG `libre:{tick}:{ejecutor}`) dentro del pasillo, y nunca fuera; si no, pase al compañero más cercano (mutación: ignorar el punto o la probabilidad)", () => {
    const resultados: { directo: boolean; esperado: boolean }[] = [];
    for (let k = 0; k < ESCENARIO.muestraDesenlaces; k += 3) {
      for (const [punto, admite] of [[ESCENARIO.faltaDirecto, true], [ESCENARIO.faltaBanda, false]] as const) {
        const { s, v } = falta(V11, punto);
        s.motor.estado.tick = k;
        s.privado.prepararSaque("libre", "local", punto, undefined, { ejecutor: s.j(v), id: "falta-prueba" });
        const ejecucion = s.motor.estado.saque!.hastaTick;
        s.ticks(ticksPausa + 1);
        const golpe = s.motor.eventos.find(x => (x.tipo === "pase" || x.tipo === "tiro") && x.reinicio === "libre")!;
        const esperado = admite && prngDerivado(ESCENARIO.semilla, `libre:${ejecucion}:${v}`).chance(LI.probDirecto);
        if (admite) resultados.push({ directo: golpe.tipo === "tiro", esperado });
        expect({ k, punto, tipo: golpe.tipo, motivo: golpe.motivo }).toEqual(esperado ? { k, punto, tipo: "tiro", motivo: "libre" } : { k, punto, tipo: "pase", motivo: undefined });
      }
    }
    expect(resultados.some(r => r.directo)).toBe(true);
    expect(resultados.some(r => !r.directo)).toBe(true);
  });

  it("A7 · una orden explícita vigente del ejecutor se respeta con las validaciones del juego: `tirar` a ≤ remate.maxM aunque esté fuera del pasillo; `pasar` a un compañero válido; un `pasar` a un adelantado no", () => {
    const tirar = falta(V11, ESCENARIO.faltaBanda);
    expect(distancia(ESCENARIO.faltaBanda, { x: ARENA.largoM, y: MEDIO_Y })).toBeLessThanOrEqual(LA.remate.maxM);
    tirar.s.privado.prepararSaque("libre", "local", ESCENARIO.faltaBanda, undefined, { ejecutor: tirar.s.j(tirar.v), id: "falta-prueba" });
    tirar.s.ordenes({ [tirar.v]: { accion: "tirar", destino: { x: ARENA.largoM, y: MEDIO_Y } } });
    tirar.s.ticks(ticksPausa + 1);
    expect(tirar.s.eventos("tiro")[0]).toMatchObject({ jugador: tirar.v, motivo: "libre", reinicio: "libre" });

    let companero = "";
    const pasar = falta(V11, ESCENARIO.faltaDirecto, e => {
      const c = campo(e, "local").find(j => j.posicionNatural === "DEF")!; companero = c.id;
      colocar(c, { x: ESCENARIO.faltaDirecto.x + ESCENARIO.companero.dx, y: ESCENARIO.faltaDirecto.y + ESCENARIO.companero.dy });
    });
    pasar.s.privado.prepararSaque("libre", "local", ESCENARIO.faltaDirecto, undefined, { ejecutor: pasar.s.j(pasar.v), id: "falta-prueba" });
    pasar.s.ordenes({ [pasar.v]: { accion: "pasar", receptor: companero, destino: pasar.s.j(companero).posicion } });
    pasar.s.ticks(ticksPausa + 1);
    expect(pasar.s.eventos("pase")[0]).toMatchObject({ jugador: pasar.v, receptor: companero, reinicio: "libre" });
    expect(pasar.s.eventos("tiro")).toEqual([]);

    let adelantado = "", enLinea = "";
    const fuera = falta(V11, ESCENARIO.faltaMedio, e => {
      const [c, m] = campo(e, "local").filter(j => j.posicionNatural === "MED"); adelantado = c!.id; enLinea = m!.id;
      colocar(c!, ESCENARIO.adelantadoLibre);
      // Un compañero en línea, el más cercano al punto: la regla anterior (sin la orden) le pasa a él.
      colocar(m!, { x: ESCENARIO.faltaMedio.x - 5, y: ESCENARIO.faltaMedio.y });
    });
    fuera.s.privado.prepararSaque("libre", "local", ESCENARIO.faltaMedio, undefined, { ejecutor: fuera.s.j(fuera.v), id: "falta-prueba" });
    expect(adelantados(fuera.s.motor.estado, "local")).toContain(adelantado);
    fuera.s.ordenes({ [fuera.v]: { accion: "pasar", receptor: adelantado, destino: { ...ESCENARIO.adelantadoLibre } } });
    fuera.s.ticks(ticksPausa + 1);
    expect(distancia(ESCENARIO.faltaMedio, ESCENARIO.adelantadoLibre)).toBeLessThanOrEqual(ARENA.paseMaxM);
    expect(fuera.s.eventos("pase")[0]).toMatchObject({ receptor: enLinea, reinicio: "libre" });
  });

  it("A8 · la falta sobre el portero en su área sigue reanudándose con el balón en las manos (brief 046 v1.1), igual que en v10", () => {
    for (const reglas of [V10, V11]) {
      let ids = { g: "", d: "" };
      const s = montar(reglas, e => {
        const g = portero(e, "local"), d = campo(e, "visita").find(j => j.posicionNatural === "DEL")!;
        ids = { g: g.id, d: d.id };
        colocar(g, { x: 8, y: 34 }); colocar(d, { x: 8.5, y: 34 });
        e.balon = { posicion: { x: 8, y: 34 }, poseedor: g.id, vuelo: null };
      });
      forzarFalta(s, ids.d, ids.g);
      expect({ reglas, r: reinicios(s)[0] }).toMatchObject({ reglas, r: { jugador: ids.g, motivo: "falta" } });
      expect(s.motor.estado.saque).toBeNull();
      expect(s.motor.estado.balon.manos?.portero).toBe(ids.g);
    }
  });
});

describe("070 · B · penal (reinicios-v11)", () => {
  it("B1 · falta dentro del área del infractor (geometría de enAreaPropia) → penal desde el punto penal; justo fuera → tiro libre (mutación: penal tratado como libre)", () => {
    const fuera = { x: ARENA.largoM - ARENA.areaLargoM - 0.5, y: MEDIO_Y };
    expect(enAreaPropia(ESCENARIO.faltaArea, "visita")).toBe(true);
    expect(enAreaPropia(fuera, "visita")).toBe(false);
    const dentro = falta(V11, ESCENARIO.faltaArea);
    forzarFalta(dentro.s, dentro.d, dentro.v);
    const f = dentro.s.eventos("falta")[0]!;
    expect(reinicios(dentro.s)[0]).toMatchObject({ reinicio: "penal", jugador: dentro.v, fuentes: [f.id], hasta: puntoPenal("local") });
    expect(puntoPenal("local")).toEqual({ x: ARENA.largoM - PE.puntoM, y: MEDIO_Y });
    expect(puntoPenal("visita")).toEqual({ x: PE.puntoM, y: MEDIO_Y });
    const borde = falta(V11, fuera);
    forzarFalta(borde.s, borde.d, borde.v);
    expect(reinicios(borde.s)[0]).toMatchObject({ reinicio: "libre", hasta: fuera });
  });

  it("B2 · colocación: todos salvo el ejecutor fuera del área y a ≥ distanciaSaqueLibreM del punto; el portero defensor en su línea, en el centro", () => {
    const { s, v, d } = falta(V11, ESCENARIO.faltaArea, e => {
      // Más jugadores de los dos lados dentro del área y en la medialuna.
      campo(e, "local").filter(j => j.posicionNatural === "MED").forEach((j, k) => colocar(j, { x: 90 + k, y: 28 + 3 * k }));
      campo(e, "visita").filter(j => j.posicionNatural === "DEF").forEach((j, k) => colocar(j, { x: 100 - k, y: 25 + 4 * k }));
    });
    forzarFalta(s, d, v);
    const e = s.motor.estado, punto = puntoPenal("local"), g = portero(e, "visita");
    expect(e.saque).toMatchObject({ tipo: "penal", ejecutor: v, punto });
    expect(g.posicion).toEqual(transformar({ x: 0, y: MEDIO_Y }, "visita"));
    for (const j of e.jugadores) {
      if (j.id === v || j.id === g.id) continue;
      expect({ id: j.id, area: enAreaPropia(j.posicion, "visita"), cerca: distancia(j.posicion, punto) < ARENA.distanciaSaqueLibreM }).toEqual({ id: j.id, area: false, cerca: false });
    }
    // Pura: un jugador en el punto penal sale del área y a la distancia; uno lejos no se mueve.
    const lejos = { lado: "local" as const, puesto: "MED", posicion: { x: 50, y: 10 } };
    expect(colocacionPenal(lejos, "visita")).toEqual(lejos.posicion);
    const enPunto = colocacionPenal({ lado: "local", puesto: "MED", posicion: punto }, "visita");
    expect(enAreaPropia(enPunto, "visita")).toBe(false);
    expect(distancia(enPunto, punto)).toBeGreaterThanOrEqual(ARENA.distanciaSaqueLibreM);
  });

  it("B3 · ejecutorPenal sin la víctima: el compañero de campo con más potencia; desempata el nivel", () => {
    const e = crearEstadoArena(crearConfigArena({ seed: ESCENARIO.semilla, reglas: V11 }));
    const propios = e.jugadores.filter(j => j.lado === "local"), [a, b] = campo(e, "local");
    const atributos = (id: string) => ({ velocidad: 50, resistencia: 50, aguante: 50, entrada: 50, vision: 50, potencia: id === a!.id || id === b!.id ? 99 : 10 });
    a!.nivel = 60; b!.nivel = 70;
    expect(ejecutorPenal(propios, atributos)!.id).toBe(b!.id);
    b!.nivel = 60;
    expect(ejecutorPenal(propios, atributos)!.id).toBe([a!.id, b!.id].sort()[0]);
    expect(ejecutorPenal(propios, () => ({ velocidad: 50, resistencia: 50, aguante: 50, entrada: 50, vision: 50, potencia: 100 }))!.puesto).not.toBe("POR");
  });

  it("B4 · probabilidadPenal lee PENAL_ARENA: conversión con ejecutor y portero iguales, ± ajusteMax acotado, sin datos sin ajuste; con constantes alteradas; la conversión de la regla cabe en la banda (mutación: conversión fija a 1)", () => {
    expect(probabilidadPenal(70, 70)).toBe(PE.conversion);
    expect(probabilidadPenal(undefined, 70)).toBe(PE.conversion);
    expect(probabilidadPenal(100, 0)).toBeCloseTo(PE.conversion + PE.ajusteMax, 12);
    expect(probabilidadPenal(0, 100)).toBeCloseTo(PE.conversion - PE.ajusteMax, 12);
    expect(probabilidadPenal(80, 70)).toBeCloseTo(PE.conversion + PE.ajusteMax * 10 / PE.diferenciaPlena, 12);
    expect(probabilidadPenal(80, 70, { conversion: 0.5, ajusteMax: 0.2, diferenciaPlena: 20 })).toBeCloseTo(0.6, 12);
    expect(PE.conversion + PE.ajusteMax).toBeLessThan(1);
    expect(PE.conversion).toBeGreaterThanOrEqual(B70.conversionPenales.min);
    expect(PE.conversion).toBeLessThanOrEqual(B70.conversionPenales.max);
  });

  it("B5 · desenlacePenal: determinista; gol dentro de los palos tras la línea, fuera por fuera del palo, atajada en el portero; sin portero no hay atajada", () => {
    const g = { x: 105, y: MEDIO_Y }, vistos = new Set<string>();
    for (let tick = 0; tick < 400; tick++) {
      const o = { seed: ESCENARIO.semilla, tick, ejecutor: "local-9", lado: "local" as const, p: PE.conversion, portero: g };
      const r = desenlacePenal(o);
      expect(desenlacePenal(o)).toEqual(r);
      vistos.add(r.desenlace);
      const lateral = Math.abs(r.destino.y - MEDIO_Y);
      if (r.desenlace === "gol") { expect(r.destino.x).toBeGreaterThan(ARENA.largoM); expect(lateral).toBeLessThanOrEqual(ARENA.arcoM / 2); }
      if (r.desenlace === "fuera") { expect(r.destino.x).toBeGreaterThan(ARENA.largoM); expect(lateral).toBeGreaterThan(ARENA.arcoM / 2); }
      if (r.desenlace === "atajada") expect(r.destino).toEqual(g);
      expect(desenlacePenal({ ...o, portero: null }).desenlace).not.toBe("atajada");
      expect(desenlacePenal({ ...o, lado: "visita" }).destino.x).toBeLessThan(r.desenlace === "atajada" ? Infinity : 0);
    }
    expect([...vistos].sort()).toEqual(["atajada", "fuera", "gol"]);
  });

  it("B6 · el motor remata el penal al terminar la pausa con el desenlace de desenlacePenal y probabilidadPenal (potencia frente al nivel efectivo del portero): gol con `fuentes` al tiro y el tiro a la falta; atajada en las manos; fuera con saque de meta (mutación: conversión fija a 1)", () => {
    const vistos = new Set<string>();
    for (let k = 0; k < ESCENARIO.muestraDesenlaces; k++) {
      const { s, v, d } = falta(V11, ESCENARIO.faltaArea);
      s.motor.estado.tick = k * 3;
      forzarFalta(s, d, v);
      const f = s.eventos("falta")[0]!, e = s.motor.estado, ejecucion = e.saque!.hastaTick;
      const g = portero(e, "visita"), nivel = (s.motor as unknown as { nivelEfectivo(j: JugadorArena): number }).nivelEfectivo(g);
      const esperado = desenlacePenal({ seed: ESCENARIO.semilla, tick: ejecucion, ejecutor: v, lado: "local", p: probabilidadPenal(s.motor.config.atributos![v]!.potencia, nivel), portero: { ...g.posicion } });
      s.ticks(ticksPausa + 1);
      const tiro = s.eventos("tiro")[0]!;
      expect(tiro).toMatchObject({ jugador: v, motivo: "penal", reinicio: "penal", fuentes: [f.id], desde: puntoPenal("local"), hasta: esperado.destino });
      s.ticks(ESCENARIO.ticksVuelo);
      vistos.add(esperado.desenlace);
      if (esperado.desenlace === "gol") {
        expect(s.eventos("gol")[0]).toMatchObject({ jugador: v, lado: "local", fuentes: [tiro.id] });
        expect(reinicios(s).at(-1)).toMatchObject({ reinicio: "centro", lado: "visita" });
      } else if (esperado.desenlace === "atajada") {
        expect(s.eventos("atajada")[0]).toMatchObject({ jugador: g.id, receptor: v });
        expect(s.eventos("gol")).toEqual([]);
      } else {
        expect(s.eventos("tiro_fuera")[0]).toMatchObject({ jugador: v });
        expect(reinicios(s).at(-1)).toMatchObject({ reinicio: "meta", lado: "visita" });
      }
      // Nadie toca el balón en vuelo: entre el tiro y su desenlace no hay intercepciones, recuperaciones ni recepciones.
      const i = s.motor.eventos.indexOf(tiro), fin = s.motor.eventos.findIndex((x, k) => k > i && ["gol", "atajada", "tiro_fuera"].includes(x.tipo));
      expect(fin).toBeGreaterThan(i);
      expect(s.motor.eventos.slice(i + 1, fin).filter(x => ["intercepcion", "recuperacion", "recepcion"].includes(x.tipo))).toEqual([]);
    }
    expect([...vistos].sort()).toEqual(["atajada", "fuera", "gol"]);
  });
});

describe("070 · C · prompt, textos, estadista e iconos", () => {
  it("C1 · frasesTiroLibre() con constantes alteradas; SISTEMA_ARENA la incluye (mutación: cifras a mano)", () => {
    const real = frasesTiroLibre(), otra = frasesTiroLibre({ distanciaM: 7.5, directoMaxM: 19, pasilloM: 6, mitadY: 30, areaLargoM: 14, areaAnchoM: 33, puntoM: 9 });
    expect(real).toContain(`a al menos ${ARENA.distanciaSaqueLibreM} m del balón`);
    expect(real).toContain(`a ${LI.directoMaxM} m o menos`);
    expect(real).toContain(`≤ ${LI.pasilloM})`);
    expect(real).toContain(`a ${PE.puntoM} m`);
    expect(real).toContain(`(${ARENA.areaLargoM} m desde la línea de fondo y ${ARENA.areaAnchoM} m de ancho)`);
    for (const x of ["7.5 m del balón", "a 19 m o menos", "(|y−30| ≤ 6)", "(14 m desde la línea de fondo y 33 m de ancho)", "a 9 m,"]) expect(otra).toContain(x);
    expect(otra).not.toBe(real);
    expect(SISTEMA_ARENA).toContain(real);
    expect(real).toContain("es penal");
  });

  it("C2 · fixture v11: textos de vista ES/EN del tiro libre, del penal señalado y del lanzamiento; relato en vivo con el penal señalado, su remate y el canto «de penal»; tamaños acotados", async () => {
    const r = JSON.parse(await readFile("src/arena/__fixtures__/arena-reinicios-v11.json", "utf8")) as RegistroArena;
    const plantilla = [...r.inicial.jugadores, ...r.inicial.banco ?? []], de = (id: string | null) => plantilla.find(j => j.id === id)!;
    const libre = r.eventos.find(e => e.tipo === "reinicio" && e.reinicio === "libre")!, senalado = r.eventos.find(e => e.tipo === "reinicio" && e.reinicio === "penal")!;
    const tiro = r.eventos.find(e => e.tipo === "tiro" && e.motivo === "penal")!, gol = r.eventos.find(e => e.tipo === "gol" && e.fuentes?.includes(tiro.id))!;
    const nombre = (id: string) => `${de(id).nombre} (${de(id).dorsal})`, equipo = (l: Lado) => r.config.partido[l].nombre;
    expect(narrarEventoArena(libre, r, "es")).toBe(`Tiro libre para ${equipo(libre.lado)}; ejecuta ${nombre(libre.jugador)}.`);
    expect(narrarEventoArena(libre, r, "en")).toBe(`Free kick for ${equipo(libre.lado)}; ${nombre(libre.jugador)} takes it.`);
    expect(narrarEventoArena(senalado, r, "es")).toBe(`Penal para ${equipo(senalado.lado)}; ejecuta ${nombre(senalado.jugador)}.`);
    expect(narrarEventoArena(tiro, r, "es")).toBe(`${nombre(tiro.jugador)} lanza el penal.`);
    expect(narrarEventoArena(tiro, r, "en")).toBe(`${nombre(tiro.jugador)} takes the penalty.`);
    expect(penalDe(gol, r)).toBe(tiro);
    const intervalo = RELATO_INTERVALOS.vivo, desde = Math.floor((senalado.tick - 1) / intervalo) * intervalo;
    for (const idioma of ["es", "en"] as const) {
      const texto = construirRelato(r, desde, Math.min(r.final.tick, desde + intervalo), "vivo", idioma).texto;
      expect(texto).toContain(idioma === "es" ? equipo(senalado.lado) : equipo(senalado.lado));
      expect(texto).toMatch(idioma === "es" ? /¡Penal/ : /Penalty/);
      const canto = cantoGol(gol, r, idioma, 0)!;
      const goleador = canto.tramos.find(t => t.tipo === "goleador")!.texto;
      expect(CANTO_GOL.plantillas.goleadorPenal[idioma].map(p => p.replace("{goleador}", de(gol.jugador).nombre))).toContain(goleador);
    }
    // Tamaño acotado: cada plantilla «de penal» mide como mucho la más larga del tramo goleador (presupuesto del canto).
    for (const idioma of ["es", "en"] as const) {
      const max = Math.max(...CANTO_GOL.plantillas.goleador[idioma].map(p => p.length));
      for (const p of CANTO_GOL.plantillas.goleadorPenal[idioma]) expect({ p, cabe: p.length <= max }).toEqual({ p, cabe: true });
    }
  });

  it("C3 · estadista cuenta tiros libres y penales; el icono del penal es el de la falta; la crónica dice «de penal» y cita la falta", async () => {
    const r = JSON.parse(await readFile("src/arena/__fixtures__/arena-reinicios-v11.json", "utf8")) as RegistroArena;
    const dato = datosEstadista(r, r.final.tick).find(d => d.tema === "reinicios")!;
    expect(dato.texto_es).toMatch(/1 tiro libre/);
    expect(dato.texto_es).toMatch(/1 penal/);
    expect(dato.texto_en).toMatch(/1 free kick/);
    expect(dato.texto_en).toMatch(/1 penalty/);
    expect(claseIcono({ tipo: "reinicio", reinicio: "penal" })).toBe("falta");
    expect(claseIcono({ tipo: "reinicio", reinicio: "libre" })).toBe("reinicio");
    const tiro = r.eventos.find(e => e.tipo === "tiro" && e.motivo === "penal")!;
    const h = hechosCronicaArena(r).find(x => x.hecho.texto_es.startsWith("Gol de"))!;
    expect(h.hecho.texto_es).toContain(", de penal, con un remate de");
    expect(h.hecho.texto_en).toContain("from the penalty spot");
    expect(h.evidencia.eventos).toEqual(expect.arrayContaining([...tiro.fuentes!, tiro.id]));
  });
});

describe("070 · versión, fixture y métricas", () => {
  it("V0 · lote rápido v11: bandas `rapido` del 046 (recalibradas), del 051 (y su controlado de porteros), del bloque A y de los bloques B y C", { timeout: 300_000 }, async () => {
    const lote = { desde: L.rapido.semillaDesde, semillas: L.rapido.semillas, reglas: V11 };
    const m = await medirLote(lote);
    const { b046, b051, b063, bBC } = bandasLote(V11, "rapido");
    console.log("[070 v11 rápido]", JSON.stringify({ goles: m.golesPorPartido, conversion: m.remate.conversion, manoAMano: m.manoAMano.conversion, centros: m.centros.porPartido, a: m.persecucion063, bc: m.largoLejano063 }));
    expect(b046.golesPorPartido).toEqual(L63.recalibracion046.rapido.golesPorPartido);
    expect(incumplimientos(m, b046, b051)).toEqual([]);
    expect(incumplimientos063(m, b063!)).toEqual([]);
    expect(incumplimientosBC(m, bBC!)).toEqual([]);
    const porteros = await medirControlado({ ...lote, quien: "portero" });
    expect(incumplimientosControlado({ porteros: porteros.diferencia }, L51.rapido)).toEqual([]);
  });

  it("V1 · ARENA.reglas es reinicios-v11 y v10 literal; LIBRE_ARENA y PENAL_ARENA rigen desde v11", () => {
    expect(ARENA.reglas).toBe(V11);
    expect(reglasArena.slice(-2)).toEqual([V10, V11]);
    expect(LI.desde).toBe(V11);
    expect(PE.desde).toBe(V11);
    expect(reglasDesde(crearConfigArena({ reglas: V10 }), V11)).toBe(false);
  });

  it("V2 · fixture v11 (45 s, búsqueda 1–200) con identidades, atributos, falta, tiro libre, penal y gol; reproducción exacta; los fixtures v1–v10 siguen exactos (mutación: activar algo de v11 en v10)", { timeout: 300_000 }, async () => {
    const r = JSON.parse(await readFile("src/arena/__fixtures__/arena-reinicios-v11.json", "utf8")) as RegistroArena;
    expect(r.config.duracionS).toBe(DURACION_FIXTURE_V11_S);
    expect(condicionesFixtureV11(r)).toEqual({ reglas: true, identidades: true, atributos: true, falta: true, libre: true, penal: true, gol: true });
    expect(cumpleFixtureV11(r)).toBe(true);
    expect(reproducirArena(structuredClone(r))).toEqual(r);
    for (const v of ["v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8", "v9", "v10"]) {
      const x = JSON.parse(await readFile(`src/arena/__fixtures__/arena-reinicios-${v}.json`, "utf8")) as RegistroArena;
      expect({ v, exacto: isDeepEqual(reproducirArena(structuredClone(x)), x) }).toEqual({ v, exacto: true });
    }
  });

  it("V3 · contarPartido070 sobre partidos reales: cada falta (salvo el portero en su área) tiene su tiro libre o penal en el mismo tick con `fuentes`; ningún rival a menos de la distancia en la ejecución; incumplimientos070 lee BANDAS_070", { timeout: 120_000 }, async () => {
    const conteos = [];
    for (let seed = 1; seed <= 10; seed++) {
      const r = await ejecutarArena(crearConfigArena({ seed, duracionS: 60, reglas: V11 }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
      for (const f of r.eventos.filter(e => e.tipo === "falta")) {
        if (r.eventos.some(e => e.tipo === "final_anticipado" && e.tick === f.tick)) continue;
        const sig = r.eventos.find(e => e.tipo === "reinicio" && e.tick === f.tick && e.fuentes?.includes(f.id))!;
        expect(sig.reinicio === "libre" || sig.reinicio === "penal" || sig.motivo === "falta").toBe(true);
      }
      conteos.push(contarPartido070(r));
    }
    const m = agregar070(V11, 60, 1, conteos);
    expect(m.ejecuciones).toBeGreaterThan(0);
    expect(m.rivalesCerca).toBe(0);
    expect(incumplimientos070({ ...m, recuperacionInfractor: 1, penalesPorPartido: 0, rivalesCerca: 1 }, 1).length).toBe(4);
  });
});
