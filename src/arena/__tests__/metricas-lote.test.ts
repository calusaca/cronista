// Brief 046 v1.1 · 12: el helper de métricas muestrea todos los ticks (pausas incluidas), mide la
// continuidad de los episodios por diferencia de ticks y trata un denominador cero como «sin muestra».
import { describe, expect, it } from "vitest";
import { ARENA, LOTE_ARENA_046 as L, TECNICA_ARENA as T } from "../../sim/limites";
import { agregarLote, analizarPartido, incumplimientos, muestrasPartido, type MuestraTick } from "../metricas-lote";
import { MotorArena } from "../motor";
import type { EventoArena, Punto } from "../tipos";

const MEDIO_Y = ARENA.anchoM / 2;
/** Valores propios de las muestras sintéticas. */
const ATACANTE = "local-5", PORTERO = "visita-0", DEFENSOR = "visita-1";
function muestra(tick: number, o: { manoAMano?: string | null; porteroX?: number; poseedor?: string | null; manos?: string | null; eventos?: number; pausado?: boolean } = {}): MuestraTick {
  const balon: Punto = { x: ARENA.largoM - ARENA.radioTiroM / 2, y: MEDIO_Y };
  return { tick, eventos: o.eventos ?? 0, poseedor: o.poseedor === undefined ? ATACANTE : o.poseedor, balon, manos: o.manos ?? null, pausado: o.pausado ?? false,
    manoAMano: o.manoAMano ?? null, conducir: null,
    jugadores: [
      { id: ATACANTE, lado: "local", puesto: "DEL", x: balon.x, y: balon.y },
      { id: PORTERO, lado: "visita", puesto: "POR", x: o.porteroX ?? ARENA.largoM - ARENA.areaLargoM / 2, y: MEDIO_Y },
      { id: DEFENSOR, lado: "visita", puesto: "DEF", x: ARENA.largoM / 2, y: MEDIO_Y },
      { id: "local-0", lado: "local", puesto: "POR", x: ARENA.areaLargoM / 2, y: MEDIO_Y },
    ] };
}
const evento = (id: string, tick: number, tipo: EventoArena["tipo"], jugador: string, lado: EventoArena["lado"], extra: Partial<EventoArena> = {}): EventoArena =>
  ({ id, tick, tipo, lado, jugador, receptor: null, desde: { x: 0, y: 0 }, hasta: { x: 0, y: 0 }, distanciaM: 0, ...extra });

describe("046 · helper de métricas de lote", () => {
  it("muestrea todos los ticks de un partido, pausas incluidas, y restaura el motor", async () => {
    const original = (MotorArena.prototype as unknown as Record<string, unknown>).planesActivos;
    const duracionS = ARENA.intervaloMinS * 2;
    const { muestras } = await muestrasPartido(1, duracionS);
    expect(muestras.map(m => m.tick)).toEqual(Array.from({ length: Math.round(duracionS / ARENA.pasoS) + 1 }, (_, i) => i));
    // El saque inicial abre con una pausa de TECNICA_ARENA.pausaS: también se muestrea.
    expect(muestras.filter(m => m.pausado).length).toBeGreaterThanOrEqual(Math.round(T.pausaS / ARENA.pasoS));
    expect((MotorArena.prototype as unknown as Record<string, unknown>).planesActivos).toBe(original);
  });

  it("un episodio de mano a mano exige manoAManoTicks consecutivos por diferencia de tick; mide desplazamiento y desenlace", () => {
    const paso = 0.5;
    const seguidos = Array.from({ length: L.manoAManoTicks }, (_, i) => muestra(10 + i, { manoAMano: ATACANTE, porteroX: ARENA.largoM - ARENA.areaLargoM / 2 - i * paso }));
    const gol = [evento("a1", 10 + L.manoAManoTicks, "tiro", ATACANTE, "local"), evento("a2", 10 + L.manoAManoTicks + 1, "gol", ATACANTE, "local")];
    const m = analizarPartido(1, seguidos, gol);
    expect(m.episodios).toHaveLength(1);
    expect(m.episodios[0]!.gol).toBe(true);
    expect(m.episodios[0]!.desplazamientoM).toBeCloseTo(paso * (L.manoAManoTicks - 1), 9);
    // Un hueco de un tick rompe la continuidad aunque el poseedor sea el mismo.
    const conHueco = seguidos.map((s, i) => ({ ...s, tick: s.tick + (i === seguidos.length - 1 ? 1 : 0) }));
    expect(analizarPartido(1, conHueco, gol).episodios).toEqual([]);
    // Un desenlace fuera de la ventana desenlaceS no es gol del episodio.
    const tarde = Math.round(L.desenlaceS / ARENA.pasoS) + 10 + L.manoAManoTicks;
    expect(analizarPartido(1, seguidos, [evento("a1", tarde + 1, "gol", ATACANTE, "local")]).episodios[0]!.gol).toBe(false);
  });

  it("robo duro solo con el balón en las manos y antes de soltar; pérdida tras atajada y amplia", () => {
    const a = muestra(5, { poseedor: PORTERO, manos: PORTERO, eventos: 0 }), b = muestra(6, { poseedor: ATACANTE, eventos: 1 });
    expect(analizarPartido(1, [a, b], [evento("a1", 6, "recuperacion", ATACANTE, "local")]).robosEnManos).toBe(1);
    const tras = analizarPartido(1, [a, { ...b, eventos: 2 }], [evento("a1", 6, "pase", PORTERO, "visita"), evento("a2", 6, "recuperacion", ATACANTE, "local")]);
    expect(tras.robosEnManos).toBe(0);
    // Pérdida amplia: del portero dentro de su área a un rival entre dos ticks.
    expect(tras.perdidasArea).toBe(1);
    const atajada = [evento("a1", 3, "atajada", PORTERO, "visita", { receptor: ATACANTE }), evento("a2", 6, "recuperacion", ATACANTE, "local")];
    expect(analizarPartido(1, [a, b], atajada)).toMatchObject({ atajadasConPosesion: 1, perdidasTrasAtajada: 1 });
    const soltada = [atajada[0]!, evento("a2", 5, "pase", PORTERO, "visita", { motivo: "saque_manos" }), evento("a3", 6, "recuperacion", ATACANTE, "local")];
    expect(analizarPartido(1, [a, b], soltada)).toMatchObject({ atajadasConPosesion: 1, perdidasTrasAtajada: 0, saquesManos: 1 });
  });

  it("M44 · una falta de un rival sobre el portero con manos cuenta como robo duro", () => {
    const a = muestra(5, { poseedor: PORTERO, manos: PORTERO, eventos: 0 }), b = muestra(6, { poseedor: PORTERO, eventos: 1 });
    expect(analizarPartido(1, [a, b], [evento("a1", 6, "falta", ATACANTE, "local", { receptor: PORTERO })]).robosEnManos).toBe(1);
  });

  it("v1.2 · saque perdido, intercepción inmediata y gol tras saque (también con la definición sin motivo, para v3)", () => {
    const inmediato = Math.round(L.saqueInmediataS / ARENA.pasoS), ventana = Math.round(L.golTrasSaqueS / ARENA.pasoS);
    const saque = (extra: Partial<EventoArena> = {}) => evento("a2", 10, "pase", PORTERO, "visita", { motivo: "saque_manos", ...extra });
    const s = [muestra(0, { poseedor: null })];
    // Interceptado al instante y gol rival sin toque defensor dentro de la ventana.
    const perdido = analizarPartido(1, s, [saque(), evento("a3", 10 + inmediato, "intercepcion", ATACANTE, "local"), evento("a4", 10 + ventana, "gol", ATACANTE, "local")]);
    expect(perdido).toMatchObject({ saquesManos: 1, saquesPerdidos: 1, intercepcionesInmediatas: 1, golesTrasSaque: 1 });
    // Perdido más tarde que saqueInmediataS; el gol fuera de la ventana no cuenta.
    const tarde = analizarPartido(1, s, [saque(), evento("a3", 10 + inmediato + 1, "intercepcion", ATACANTE, "local"), evento("a4", 10 + ventana + 1, "gol", ATACANTE, "local")]);
    expect(tarde).toMatchObject({ saquesPerdidos: 1, intercepcionesInmediatas: 0, golesTrasSaque: 0 });
    // Recibido por un compañero: ni pérdida ni gol tras saque, aunque luego marque el rival.
    const bien = analizarPartido(1, s, [saque(), evento("a3", 12, "recepcion", DEFENSOR, "visita"), evento("a4", 20, "gol", ATACANTE, "local")]);
    expect(bien).toMatchObject({ saquesManos: 1, saquesPerdidos: 0, golesTrasSaque: 0 });
    // Sin motivo (reglas sin balon.manos): el primer pase del portero tras recibir en su área.
    const enArea = { x: ARENA.largoM - ARENA.areaLargoM / 2, y: MEDIO_Y };
    const v3 = analizarPartido(1, s, [evento("a1", 5, "atajada", PORTERO, "visita", { hasta: enArea }), evento("a2", 10, "pase", PORTERO, "visita"), evento("a3", 11, "intercepcion", ATACANTE, "local")]);
    expect(v3).toMatchObject({ saquesManos: 1, saquesPerdidos: 1, intercepcionesInmediatas: 1 });
    const fuera = analizarPartido(1, s, [evento("a1", 5, "recepcion", PORTERO, "visita", { hasta: { x: ARENA.largoM / 2, y: MEDIO_Y } }), evento("a2", 10, "pase", PORTERO, "visita")]);
    expect(fuera.saquesManos).toBe(0);
  });

  it("un denominador cero es «sin muestra» y siempre incumple", () => {
    const vacio = agregarLote("reinicios-v4", L.duracionS, [analizarPartido(1, [muestra(0, { poseedor: null })], [])]);
    expect(vacio.manoAMano.conversion).toBeNull();
    expect(vacio.centros.proporcion).toBeNull();
    expect(vacio.conducir.fraccion).toBeNull();
    const fallos = incumplimientos(vacio, L.completo);
    for (const nombre of ["perdidasTrasAtajada", "desplazamientoMedianaM", "fraccionDesplazado", "conversion", "proporcionCentros", "conducirFrenado", "saquesManos"]) {
      expect(fallos.some(f => f.startsWith(`${nombre}=sin muestra`))).toBe(true);
    }
  });
});
