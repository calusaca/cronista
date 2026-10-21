// Brief 045 · Coordinador de turnos: entradas explícitas; ninguna cifra de MESA_ARENA,
// VOZ_BUFFER ni ARENA se repite a mano. Brief 048 (v1.1): variantes con estado explícito,
// ventana conocida, calma por las manos del portero y validación de 1 a maxTurnos fragmentos.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ARENA, MESA_ARENA, PRIORIDAD_EVENTO_ARENA } from "../../sim/limites";
import { VOZ_BUFFER } from "../buffer";
import { recordarVoz } from "../editorial";
import type { EventoArena, RegistroArena } from "../tipos";
import { calmaEnFotograma, descartesTurno, estadoPorDuracion, horizonteS, noticiaPendiente, segmentoVozValido, siguienteTurno, varianteElegible, varianteEfectiva, ventanaConocidaS, type CandidataTurno, type EntradaTurno, type EstadoVariante } from "../turnos";

const ahora = 100, partidoS = 30, tickCursor = Math.round(partidoS / ARENA.pasoS);
const valida = (d: number): EstadoVariante => ({ estado: "valida", duracionS: d });
const dur = VOZ_BUFFER.duracionMaxS / 4;
/** Candidata del 045: una sola variante (la breve no existe). */
const cand = (rol: CandidataTurno["rol"], tick = tickCursor, id = `${rol}:x:${tick}`): CandidataTurno => ({ id, rol, tick, origen: "045", completa: valida(dur), breve: { estado: "inexistente" } });
const base = (extra: Partial<EntradaTurno> = {}): EntradaTurno => ({
  partidoS, ahoraAudioS: ahora, fuenteActiva: null, finUltimaNoticiaS: null, finUltimoInvitadoS: null, ultimoInvitado: null,
  pausaVigente: false, terminada: false, cerrando: false, aperturaPendiente: false, ventanaS: null, candidatas: [cand("comentarista")], ...extra,
});

describe("045 · siguienteTurno", () => {
  it("un invitado no arranca con una fuente activa, incluida una reserva con prioridad −1", () => {
    expect(siguienteTurno(base({ fuenteActiva: { rol: "narrador", prioridad: -1, finS: ahora + 1 } }))).toBeNull();
    expect(siguienteTurno(base({ fuenteActiva: { rol: "narrador", prioridad: 10, finS: ahora + 1 } }))).toBeNull();
    expect(siguienteTurno(base({ fuenteActiva: { rol: "estadista", prioridad: MESA_ARENA.prioridadInvitado, finS: ahora + 1 } }))).toBeNull();
    expect(siguienteTurno(base())?.id).toBe("comentarista:x:" + tickCursor);
  });

  it("arranca sin noticia previa, con calma cumplida o con pausa vigente, y no antes", () => {
    expect(siguienteTurno(base({ finUltimaNoticiaS: null }))).not.toBeNull();
    expect(siguienteTurno(base({ finUltimaNoticiaS: ahora - MESA_ARENA.calmaMinS }))).not.toBeNull();
    expect(siguienteTurno(base({ finUltimaNoticiaS: ahora - MESA_ARENA.calmaMinS + 0.01 }))).toBeNull();
    expect(siguienteTurno(base({ finUltimaNoticiaS: ahora - MESA_ARENA.calmaMinS + 0.01, pausaVigente: true }))).not.toBeNull();
    // La calma se mide en audio, no en partido: aunque el cursor avance, sin calma no arranca.
    expect(siguienteTurno(base({ finUltimaNoticiaS: ahora, partidoS: partidoS + 5, candidatas: [cand("comentarista", tickCursor + 40)] }))).toBeNull();
  });

  it("respeta la separación entre invitados y la caducidad, sin arrancar nada futuro", () => {
    expect(siguienteTurno(base({ finUltimoInvitadoS: ahora - MESA_ARENA.separacionInvitadosS + 0.01 }))).toBeNull();
    expect(siguienteTurno(base({ finUltimoInvitadoS: ahora - MESA_ARENA.separacionInvitadosS }))).not.toBeNull();
    const limite = tickCursor - Math.round(MESA_ARENA.caducidadInvitadoS / ARENA.pasoS);
    expect(siguienteTurno(base({ candidatas: [cand("comentarista", limite)] }))).not.toBeNull();
    expect(siguienteTurno(base({ candidatas: [cand("comentarista", limite - 1)] }))).toBeNull();
    expect(descartesTurno(base({ candidatas: [cand("comentarista", limite - 1)] }))).toEqual([`comentarista:x:${limite - 1}`]);
    expect(siguienteTurno(base({ candidatas: [cand("comentarista", tickCursor + 1)] }))).toBeNull();
    expect(descartesTurno(base({ candidatas: [cand("comentarista", tickCursor + 1)] }))).toEqual([]);
    // Duración inválida: nunca arranca y se descarta (no se recorta audio).
    const larga = { ...cand("estadista"), completa: estadoPorDuracion(VOZ_BUFFER.duracionMaxS + 1) };
    expect(larga.completa.estado).toBe("invalida");
    expect(siguienteTurno(base({ candidatas: [larga] }))).toBeNull();
    expect(descartesTurno(base({ candidatas: [larga] }))).toEqual([larga.id]);
  });

  it("v1.1 (10) · una variante caducada nunca arranca, aunque su duración quepa en la ventana", () => {
    const limite = tickCursor - Math.round(MESA_ARENA.caducidadInvitadoS / ARENA.pasoS);
    const dos = (tick: number): CandidataTurno => ({ id: `comentarista:y:${tick}`, rol: "comentarista", tick, origen: "048", completa: valida(dur), breve: valida(dur / 2) });
    expect(siguienteTurno(base({ ventanaS: dur * 2, candidatas: [dos(limite)] }))?.variante).toBe("completa");
    expect(siguienteTurno(base({ ventanaS: dur * 2, candidatas: [dos(limite - 1)] }))).toBeNull();
    expect(siguienteTurno(base({ ventanaS: dur / 2, candidatas: [dos(limite - 1)] }))).toBeNull();
  });

  it("alterna comentarista y estadista y descarta las candidaturas superadas del mismo rol", () => {
    const viejo = cand("comentarista", tickCursor - 20), nuevo = cand("comentarista", tickCursor - 10), dato = cand("estadista", tickCursor - 5);
    const todas = [viejo, nuevo, dato];
    expect(siguienteTurno(base({ candidatas: todas }))?.id).toBe(nuevo.id); // sin invitado previo: comentarista
    expect(siguienteTurno(base({ candidatas: todas, ultimoInvitado: { rol: "comentarista", tick: 1 } }))?.id).toBe(dato.id);
    expect(siguienteTurno(base({ candidatas: todas, ultimoInvitado: { rol: "estadista", tick: 1 } }))?.id).toBe(nuevo.id);
    expect(siguienteTurno(base({ candidatas: [viejo, nuevo], ultimoInvitado: { rol: "comentarista", tick: 1 } }))?.id).toBe(nuevo.id);
    expect(descartesTurno(base({ candidatas: todas }))).toEqual([viejo.id]);
  });

  it("terminada o cerrando bloquean a todo invitado", () => {
    expect(siguienteTurno(base({ terminada: true }))).toBeNull();
    expect(siguienteTurno(base({ cerrando: true }))).toBeNull();
    expect(siguienteTurno(base({ cerrando: true, pausaVigente: true }))).toBeNull();
  });

  it("v3.1 · con la apertura del narrador pendiente no arranca ningún invitado, con todo lo demás favorable", () => {
    const favorable = { candidatas: [cand("comentarista"), cand("estadista")], pausaVigente: true };
    expect(siguienteTurno(base(favorable))).not.toBeNull();
    expect(siguienteTurno(base({ ...favorable, aperturaPendiente: true }))).toBeNull();
    // La apertura pendiente no descarta candidaturas: siguen esperando su turno.
    expect(descartesTurno(base({ ...favorable, aperturaPendiente: true }))).toEqual([]);
  });

  it("el recuerdo lleva rol y solo entra en la memoria cuando el consumidor arranca el audio", () => {
    const entrada = base({ candidatas: [cand("estadista")] }), memoria = [{ tick: 1, texto: "previo" }];
    const turno = siguienteTurno(entrada)!;
    expect(turno.recuerdo).toMatchObject({ rol: "estadista", estado: "iniciada", clave: turno.id, tick: tickCursor });
    // v3.1: el recuerdo del invitado lleva su id, nunca el texto hablado.
    expect(turno.recuerdo.texto).toBe(turno.id);
    // Función pura: decidir no toca la memoria ni la entrada.
    expect(memoria).toEqual([{ tick: 1, texto: "previo" }]);
    expect(entrada.candidatas).toHaveLength(1);
    expect(recordarVoz(memoria, turno.recuerdo).at(-1)?.rol).toBe("estadista");
  });
});

describe("048 · elección de variante (v1.1, 1)", () => {
  const completa = dur * 2, breve = dur;
  const c = (completaE: EstadoVariante, breveE: EstadoVariante, origen: CandidataTurno["origen"] = "048"): CandidataTurno => ({ id: "comentarista:gol:300", rol: "comentarista", tick: tickCursor, origen, completa: completaE, breve: breveE });
  const elegir = (cc: CandidataTurno, ventanaS: number | null) => siguienteTurno(base({ ventanaS, candidatas: [cc] }));

  it("completa si cabe; breve si la completa no cabe; ninguna si ninguna cabe", () => {
    expect(elegir(c(valida(completa), valida(breve)), completa)?.variante).toBe("completa");
    expect(elegir(c(valida(completa), valida(breve)), completa - 0.01)?.variante).toBe("breve");
    expect(elegir(c(valida(completa), valida(breve)), breve - 0.01)).toBeNull();
    // Ventana desconocida (límite exacto del prefijo): la breve.
    expect(elegir(c(valida(completa), valida(breve)), null)?.variante).toBe("breve");
  });

  it("espera a la breve mientras está pendiente si la completa no cabe; la completa sola cabe y arranca", () => {
    expect(elegir(c(valida(completa), { estado: "pendiente" }), breve)).toBeNull();
    expect(descartesTurno(base({ ventanaS: breve, candidatas: [c(valida(completa), { estado: "pendiente" })] }))).toEqual([]);
    expect(elegir(c(valida(completa), { estado: "pendiente" }), completa)?.variante).toBe("completa");
    expect(elegir(c({ estado: "pendiente" }, valida(breve)), completa)?.variante).toBe("breve");
  });

  it("completa inválida con breve válida, y al revés: solo se elige entre válidas", () => {
    expect(elegir(c(estadoPorDuracion(VOZ_BUFFER.duracionMaxS + 1), valida(breve)), VOZ_BUFFER.duracionMaxS * 2)?.variante).toBe("breve");
    expect(elegir(c(valida(completa), { estado: "invalida" }), completa)?.variante).toBe("completa");
    expect(elegir(c(valida(completa), { estado: "fallida" }), completa - 0.01)).toBeNull();
    // Sin ninguna variante posible, la candidata se descarta.
    expect(descartesTurno(base({ candidatas: [c({ estado: "fallida" }, { estado: "invalida" })] }))).toEqual(["comentarista:gol:300"]);
  });

  it("diario del 045 (origen 045, sin breve): la completa arranca aunque no quepa, como en el 045", () => {
    expect(elegir(c(valida(completa), { estado: "inexistente" }, "045"), breve)?.variante).toBe("completa");
    expect(elegir(c(valida(completa), { estado: "inexistente" }, "045"), 0)?.variante).toBe("completa");
    expect(elegir(c(valida(completa), { estado: "inexistente" }, "045"), null)?.variante).toBe("completa");
    expect(varianteElegible(c({ estado: "pendiente" }, { estado: "inexistente" }, "045"), completa)).toBeNull();
  });

  it("v1.2 (6) · un intercambio del 048 colapsado (sin breve) sigue la regla de la v1.1: no arranca si no cabe", () => {
    expect(elegir(c(valida(completa), { estado: "inexistente" }), completa)?.variante).toBe("completa");
    expect(elegir(c(valida(completa), { estado: "inexistente" }), completa - 0.01)).toBeNull();
    expect(elegir(c(valida(completa), { estado: "inexistente" }), 0)).toBeNull();
    // Ventana desconocida: se usaría la breve, que aquí es la misma completa.
    expect(elegir(c(valida(completa), { estado: "inexistente" }), null)?.variante).toBe("completa");
  });

  it("v1.2 (9) B13 · una candidata más reciente solo pendiente no desplaza a una válida del mismo rol", () => {
    const vieja: CandidataTurno = { ...c(valida(completa), valida(breve)), id: "comentarista:gol:290", tick: tickCursor - 10 };
    const nueva: CandidataTurno = { ...c({ estado: "pendiente" }, { estado: "pendiente" }), id: "comentarista:tiro_fuera:295", tick: tickCursor - 5 };
    expect(descartesTurno(base({ ventanaS: completa, candidatas: [vieja, nueva] }))).toEqual([]);
    expect(siguienteTurno(base({ ventanaS: completa, candidatas: [vieja, nueva] }))?.id).toBe(vieja.id);
    // En cuanto la nueva tiene una variante válida, la vieja queda superada.
    const lista = { ...nueva, breve: valida(breve) };
    expect(descartesTurno(base({ ventanaS: completa, candidatas: [vieja, lista] }))).toEqual([vieja.id]);
  });

  it("variante efectiva: la breve solo existe con turnosBreve", () => {
    expect(varianteEfectiva({}, "breve")).toBe("completa");
    expect(varianteEfectiva({ turnosBreve: [] }, "breve")).toBe("completa");
    expect(varianteEfectiva({ turnosBreve: [{ rol: "narrador", funcion: "cesion", texto_es: "a", texto_en: "a", oraciones: [] }] }, "breve")).toBe("breve");
    expect(varianteEfectiva({}, "completa")).toBe("completa");
  });
});

describe("048 · ventanaConocidaS y calmaEnFotograma", () => {
  const original = JSON.parse(readFileSync("src/arena/__fixtures__/arena-reinicios-v4.json", "utf8")) as RegistroArena;
  const plantilla = original.eventos.find(e => e.tipo === "pase")!;
  const con = (eventos: Partial<EventoArena>[]): RegistroArena => ({ ...original, eventos: eventos.map((e, k) => ({ ...plantilla, id: `v${k}`, ...e }) as EventoArena) });
  const s = (tick: number) => tick * ARENA.pasoS;
  const tipoUmbral = (Object.entries(PRIORIDAD_EVENTO_ARENA) as [EventoArena["tipo"], number][]).find(([, p]) => p === VOZ_BUFFER.prioridadInterrupcion)![0];

  it("cuenta un evento con prioridad igual a prioridadInterrupcion; un pase no cuenta", () => {
    expect(tipoUmbral).toBe("reinicio");
    const r = con([{ tipo: "pase", tick: 100 }, { tipo: tipoUmbral, tick: 200 }]);
    expect(ventanaConocidaS(r, s(50), false)).toBeCloseTo(s(200) - s(50));
    expect(ventanaConocidaS(con([{ tipo: "pase", tick: 100 }]), s(50), true)).toBeCloseTo(s(original.final.tick) - s(50));
  });

  it("sin noticias en el prefijo: hasta el final del prefijo; en su límite exacto, desconocida; fuera, null", () => {
    const r = con([{ tipo: "pase", tick: 10 }]);
    expect(ventanaConocidaS(r, s(50), false)).toBeCloseTo(s(r.final.tick) - s(50));
    expect(ventanaConocidaS(r, s(r.final.tick), false)).toBeNull();
    expect(ventanaConocidaS(r, s(r.final.tick), true)).toBe(0);
    expect(ventanaConocidaS(r, s(r.final.tick) + 1, false)).toBeNull();
    expect(ventanaConocidaS(r, -1, false)).toBeNull();
  });

  it("v1.1 (5) · una noticia alcanzada y aún pendiente de sonar anula la ventana", () => {
    const r = con([{ tipo: "atajada", tick: 100 }, { tipo: "gol", tick: 300 }]);
    expect(noticiaPendiente(r, s(105), new Set())).toBe(true);
    expect(noticiaPendiente(r, s(105), new Set(["v0"]))).toBe(false);
    // Fuera del atraso admitido o anterior a la activación de la voz, ya no puede sonar.
    expect(noticiaPendiente(r, s(100) + Math.max(VOZ_BUFFER.atrasoNormalS, VOZ_BUFFER.atrasoImportanteS) + 0.5, new Set())).toBe(false);
    expect(noticiaPendiente(r, s(105), new Set(), s(101))).toBe(false);
    expect(ventanaConocidaS(r, s(105), false, { pendiente: true })).toBe(0);
    expect(ventanaConocidaS(r, s(105), false, { pendiente: false })).toBeCloseTo(s(300) - s(105));
  });

  it("v1.2 (7) · horizonteS: el mismo horizonte para pedir y elegir; las pendientes se miden en el cursor", () => {
    const r = con([{ tipo: "gol", tick: 80 }, { tipo: "tiro", tick: 200 }]);
    // Pedir con el cursor antes del gol y la intervención en el tick del gol: el gol aún no está alcanzado.
    expect(horizonteS(r, s(80), false, new Set(), 0, s(5))).toBeCloseTo(s(200) - s(80));
    // Elegir con el cursor tras el gol sin que haya sonado: anula; ya sonado: la ventana normal.
    expect(horizonteS(r, s(85), false, new Set(), 0)).toBe(0);
    expect(horizonteS(r, s(85), false, new Set(["v0"]), 0)).toBeCloseTo(s(200) - s(85));
    // Pedir (punto futuro) con una noticia alcanzada y pendiente en el cursor: también anula.
    expect(horizonteS(r, s(150), false, new Set(), 0, s(85))).toBe(0);
  });

  it("calmaEnFotograma: con pausa vigente, con el balón en las manos y sin ninguna", () => {
    const f = structuredClone(original.fotogramas.find(x => !x.balon.manos && !(x.pausa && x.pausa.hastaTick > x.tick))!);
    expect(calmaEnFotograma(f)).toBe(false);
    expect(calmaEnFotograma({ ...f, pausa: { hastaTick: f.tick + 1, lado: "local", punto: { x: 0, y: 0 }, motivo: "reinicio" } })).toBe(true);
    expect(calmaEnFotograma({ ...f, pausa: { hastaTick: f.tick, lado: "local", punto: { x: 0, y: 0 }, motivo: "reinicio" } })).toBe(false);
    expect(calmaEnFotograma({ ...f, balon: { ...f.balon, manos: { portero: "local-0", desdeTick: f.tick, hastaTick: f.tick + 1 } } })).toBe(true);
    expect(calmaEnFotograma({ ...f, balon: { ...f.balon, manos: { portero: "local-0", desdeTick: f.tick - 5, hastaTick: f.tick } } })).toBe(false);
    // En el fixture v4 hay fotogramas con el balón en las manos.
    expect(original.fotogramas.some(x => calmaEnFotograma(x) && x.balon.manos && !(x.pausa && x.pausa.hastaTick > x.tick))).toBe(true);
  });
});

describe("045/048 · validación del consumidor", () => {
  const audio = { base64: "AA==", tipo: "audio/wav" };
  const roles = ["narrador", "comentarista", "narrador", "estadista", "narrador"];
  const invitado = (n: number, variante = "completa") => ({ desdeTick: 200, hastaTick: 200, idioma: "es", modo: "buffer", texto: "Cesión. Dato.", audio, tipoRelato: "invitado", intervencion: "estadista:reloj:200", variante, fragmentos: Array.from({ length: n }, (_, k) => ({ tick: 200, rol: roles[k % roles.length] })) });
  const esperado = { desde: 200, hasta: 200, idioma: "es", intervencion: { id: "estadista:reloj:200", tick: 200 } };
  it("acepta de 1 a maxTurnos fragmentos alternados; rechaza maxTurnos + 1, dos del mismo rol seguidos y otra variante", () => {
    for (let n = 1; n <= MESA_ARENA.dialogo.maxTurnos; n++) expect(segmentoVozValido(invitado(n), esperado)).toBe(true);
    expect(segmentoVozValido(invitado(MESA_ARENA.dialogo.maxTurnos + 1), esperado)).toBe(false);
    expect(segmentoVozValido({ ...invitado(2), fragmentos: [{ tick: 200, rol: "comentarista" }, { tick: 200, rol: "comentarista" }] }, esperado)).toBe(false);
    expect(segmentoVozValido(invitado(2, "breve"), esperado)).toBe(false);
    expect(segmentoVozValido(invitado(2, "breve"), { ...esperado, intervencion: { ...esperado.intervencion, variante: "breve" } })).toBe(true);
    expect(segmentoVozValido({ ...invitado(2), variante: undefined }, esperado)).toBe(false);
    expect(segmentoVozValido({ ...invitado(2), fragmentos: [{ tick: 200, rol: "narrador" }, { tick: 199, rol: "estadista" }] }, esperado)).toBe(false);
    expect(segmentoVozValido({ ...invitado(2), audio: null }, esperado)).toBe(false);
    expect(segmentoVozValido({ ...invitado(2), intervencion: "otra" }, esperado)).toBe(false);
    // Dos fragmentos de un tramo del narrador se rechazan, aunque coincidan ticks y audio.
    expect(segmentoVozValido({ ...invitado(2), tipoRelato: "jugada" }, { desde: 200, hasta: 200, idioma: "es" })).toBe(false);
    expect(segmentoVozValido({ ...invitado(2), tipoRelato: "invitado" }, { desde: 200, hasta: 200, idioma: "es" })).toBe(false);
    expect(segmentoVozValido({ ...invitado(1), tipoRelato: "jugada", intervencion: undefined, desdeTick: 150, fragmentos: [{ tick: 180 }] }, { desde: 150, hasta: 200, idioma: "es" })).toBe(true);
  });
});
