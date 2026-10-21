// Brief 045 · Coordinador de turnos: entradas explícitas; ninguna cifra de MESA_ARENA,
// VOZ_BUFFER ni ARENA se repite a mano.
import { describe, expect, it } from "vitest";
import { ARENA, MESA_ARENA } from "../../sim/limites";
import { VOZ_BUFFER } from "../buffer";
import { recordarVoz } from "../editorial";
import { descartesTurno, segmentoVozValido, siguienteTurno, type CandidataTurno, type EntradaTurno } from "../turnos";

const ahora = 100, partidoS = 30, tickCursor = Math.round(partidoS / ARENA.pasoS);
const cand = (rol: CandidataTurno["rol"], tick = tickCursor, id = `${rol}:x:${tick}`): CandidataTurno => ({ id, rol, tick, duracionS: VOZ_BUFFER.duracionMaxS / 4 });
const base = (extra: Partial<EntradaTurno> = {}): EntradaTurno => ({
  partidoS, ahoraAudioS: ahora, fuenteActiva: null, finUltimaNoticiaS: null, finUltimoInvitadoS: null, ultimoInvitado: null,
  pausaVigente: false, terminada: false, cerrando: false, aperturaPendiente: false, candidatas: [cand("comentarista")], ...extra,
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
    expect(siguienteTurno(base({ candidatas: [{ ...cand("estadista"), duracionS: VOZ_BUFFER.duracionMaxS + 1 }] }))).toBeNull();
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

describe("045 · validación del consumidor", () => {
  const audio = { base64: "AA==", tipo: "audio/wav" };
  const invitado = (n: number) => ({ desdeTick: 200, hastaTick: 200, idioma: "es", modo: "buffer", texto: "Cesión. Dato.", audio, tipoRelato: "invitado", intervencion: "estadista:reloj:200", fragmentos: Array.from({ length: n }, () => ({ tick: 200 })) });
  const esperado = { desde: 200, hasta: 200, idioma: "es", intervencion: { id: "estadista:reloj:200", tick: 200 } };
  it("acepta uno o dos fragmentos solo con tipoRelato invitado", () => {
    expect(segmentoVozValido(invitado(1), esperado)).toBe(true);
    expect(segmentoVozValido(invitado(2), esperado)).toBe(true);
    expect(segmentoVozValido(invitado(MESA_ARENA.fragmentosPorIntervencion + 1), esperado)).toBe(false);
    expect(segmentoVozValido({ ...invitado(2), fragmentos: [{ tick: 200 }, { tick: 199 }] }, esperado)).toBe(false);
    expect(segmentoVozValido({ ...invitado(2), audio: null }, esperado)).toBe(false);
    expect(segmentoVozValido({ ...invitado(2), intervencion: "otra" }, esperado)).toBe(false);
    // Dos fragmentos de un tramo del narrador se rechazan, aunque coincidan ticks y audio.
    expect(segmentoVozValido({ ...invitado(2), tipoRelato: "jugada" }, { desde: 200, hasta: 200, idioma: "es" })).toBe(false);
    expect(segmentoVozValido({ ...invitado(2), tipoRelato: "invitado" }, { desde: 200, hasta: 200, idioma: "es" })).toBe(false);
    expect(segmentoVozValido({ ...invitado(1), tipoRelato: "jugada", intervencion: undefined, desdeTick: 150, fragmentos: [{ tick: 180 }] }, { desde: 150, hasta: 200, idioma: "es" })).toBe(true);
  });
});
