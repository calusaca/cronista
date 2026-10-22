// Brief 045 · Coordinador de turnos: entradas explícitas; ninguna cifra de MESA_ARENA,
// VOZ_BUFFER ni ARENA se repite a mano. Brief 048 (v1.1): variantes con estado explícito,
// ventana conocida, calma por las manos del portero y validación de 1 a maxTurnos fragmentos.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ARENA, CANTO_GOL, MESA_ARENA, PREVIA_ARENA, PRIORIDAD_EVENTO_ARENA } from "../../sim/limites";
import { VOZ_BUFFER } from "../buffer";
import { recordarVoz } from "../editorial";
import type { EventoArena, RegistroArena } from "../tipos";
import { caducidadInvitadoS, calmaEnFotograma, candidatasAlReactivar, descartesTurno, esperaReintentoInvitado, estadoPorDuracion, horizonteS, noticiaPendiente, segmentoVozValido, siguienteTurno, varianteElegible, varianteEfectiva, ventanaConocidaS, type CandidataTurno, type EntradaTurno, type EstadoVariante } from "../turnos";

const ahora = 100, partidoS = 30, tickCursor = Math.round(partidoS / ARENA.pasoS);
const valida = (d: number): EstadoVariante => ({ estado: "valida", duracionS: d });
const dur = VOZ_BUFFER.duracionMaxS / 4;
/** Candidata del 045: una sola variante (la breve no existe). */
const cand = (rol: CandidataTurno["rol"], tick = tickCursor, id = `${rol}:x:${tick}`): CandidataTurno => ({ id, rol, tick, origen: "045", tema: "tiempo", completa: valida(dur), breve: { estado: "inexistente" } });
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
    const dos = (tick: number): CandidataTurno => ({ id: `comentarista:y:${tick}`, rol: "comentarista", tick, origen: "048", tema: "tiempo", completa: valida(dur), breve: valida(dur / 2) });
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
  const c = (completaE: EstadoVariante, breveE: EstadoVariante, origen: CandidataTurno["origen"] = "048"): CandidataTurno => ({ id: "comentarista:gol:300", rol: "comentarista", tick: tickCursor, origen, tema: "tiempo", completa: completaE, breve: breveE });
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

describe("045/048 · reintento de una variante de invitado (corrección del consumidor)", () => {
  const { reintentoInvitadoMs: base, maxReintentosInvitado: max, caducidadInvitadoS: caduca } = MESA_ARENA;
  const http = (estado: number) => ({ tipo: "http" as const, estado });

  it("un 429 o un fallo de red se reintentan con espera exponencial desde la base", () => {
    for (const fallo of [http(429), { tipo: "red" as const }]) {
      for (let k = 0; k < max; k++) expect(esperaReintentoInvitado(fallo, k, 0)).toBe(base * 2 ** k);
      expect(esperaReintentoInvitado(fallo, 0, null)).toBe(base);
    }
  });

  it("agotados los reintentos, el fallo es final", () => {
    expect(esperaReintentoInvitado(http(429), max, 0)).toBeNull();
    expect(esperaReintentoInvitado({ tipo: "red" }, max + 1, null)).toBeNull();
    expect(esperaReintentoInvitado(http(429), -1, 0)).toBeNull();
    expect(esperaReintentoInvitado(http(429), 0.5, 0)).toBeNull();
  });

  it("400, 404, 409, 5xx o un segmento inválido son finales desde el primer intento", () => {
    for (const estado of [400, 404, 409, 500, 503]) expect(esperaReintentoInvitado(http(estado), 0, 0), String(estado)).toBeNull();
    expect(esperaReintentoInvitado({ tipo: "invalida" }, 0, 0)).toBeNull();
  });

  it("caducada la intervención contra el cursor no se reintenta; en el límite exacto, sí", () => {
    expect(esperaReintentoInvitado(http(429), 0, caduca)).toBe(base);
    expect(esperaReintentoInvitado(http(429), 0, caduca + ARENA.pasoS)).toBeNull();
    expect(esperaReintentoInvitado({ tipo: "red" }, 0, Number.NaN)).toBeNull();
  });

  it("la espera total de los reintentos cabe dentro de la caducidad del invitado", () => {
    let total = 0; for (let k = 0; k < max; k++) total += esperaReintentoInvitado(http(429), k, 0)!;
    expect(total / 1000).toBeLessThan(caduca);
  });
});

// Brief 050 v1.1 (3) · Caducidad por tema: tras un gol, CANTO_GOL.caducidadInvitadoTrasGolS en la
// selección, el descarte y el reintento; el resto de temas conserva MESA_ARENA.caducidadInvitadoS.
describe("050 · caducidad de la Mesa tras un gol", () => {
  const { caducidadInvitadoS: general } = MESA_ARENA, { caducidadInvitadoTrasGolS: trasGol } = CANTO_GOL;
  const conTema = (tema: string, edadS: number): CandidataTurno => ({ ...cand("comentarista", tickCursor - Math.round(edadS / ARENA.pasoS)), tema });

  it("caducidadInvitadoS(tema): gol → trasGol; cualquier otro tema → la general", () => {
    expect(caducidadInvitadoS("gol")).toBe(trasGol);
    for (const tema of ["atajada", "tiempo", "tiro_fuera", "roja", ""]) expect(caducidadInvitadoS(tema)).toBe(general);
    expect(trasGol).toBeGreaterThan(general);
  });

  it("M8 · una candidata `gol` arranca a general + 1 s y no a trasGol + 1 s; una `atajada` caduca a la general", () => {
    expect(siguienteTurno(base({ candidatas: [conTema("gol", general + 1)] }))).not.toBeNull();
    expect(siguienteTurno(base({ candidatas: [conTema("gol", trasGol + 1)] }))).toBeNull();
    expect(siguienteTurno(base({ candidatas: [conTema("atajada", general + 1)] }))).toBeNull();
    expect(siguienteTurno(base({ candidatas: [conTema("atajada", general)] }))).not.toBeNull();
  });

  it("descartesTurno conserva la candidatura `gol` entre ambas caducidades y descarta la `atajada`", () => {
    const medio = (general + trasGol) / 2, gol = conTema("gol", medio), atajada = { ...conTema("atajada", medio), id: "estadista:atajada", rol: "estadista" as const };
    expect(descartesTurno(base({ candidatas: [gol, atajada] }))).toEqual([atajada.id]);
    expect(descartesTurno(base({ candidatas: [conTema("gol", trasGol + 1)] }))).toHaveLength(1);
  });

  it("un 429 entre general y trasGol se reintenta para `gol` y no para `atajada`; límite exacto de trasGol", () => {
    const http429 = { tipo: "http" as const, estado: 429 }, medio = (general + trasGol) / 2;
    expect(esperaReintentoInvitado(http429, 0, medio, "gol")).toBe(MESA_ARENA.reintentoInvitadoMs);
    expect(esperaReintentoInvitado(http429, 0, medio, "atajada")).toBeNull();
    expect(esperaReintentoInvitado(http429, 0, medio)).toBeNull(); // sin tema: la general
    expect(esperaReintentoInvitado(http429, 0, trasGol, "gol")).toBe(MESA_ARENA.reintentoInvitadoMs);
    expect(esperaReintentoInvitado(http429, 0, trasGol + ARENA.pasoS, "gol")).toBeNull();
    // Mismo límite en la selección (edad medida desde el tick de la candidatura hasta el cursor).
    expect(siguienteTurno(base({ candidatas: [conTema("gol", trasGol)] }))).not.toBeNull();
    expect(siguienteTurno(base({ candidatas: [conTema("gol", trasGol + ARENA.pasoS)] }))).toBeNull();
  });

  it("segmentoVozValido acepta el canto (un fragmento con `canto`) y rechaza dos fragmentos del narrador", () => {
    const canto = { desdeTick: 200, hastaTick: 250, idioma: "es", modo: "buffer", texto: "¡Gooool! ¡Gol de X! …", tipoRelato: "jugada", audio: { base64: "x" },
      fragmentos: [{ tick: 231, canto: { tramos: [{ texto: "¡Gooool!", tipo: "grito" }] } }] };
    expect(segmentoVozValido(canto, { desde: 200, hasta: 250, idioma: "es" })).toBe(true);
    // Por esto el canto es UN fragmento con tramos y no tres fragmentos: el consumidor rechaza dos.
    expect(segmentoVozValido({ ...canto, fragmentos: [{ tick: 231 }, { tick: 231 }] }, { desde: 200, hasta: 250, idioma: "es" })).toBe(false);
  });
});

// Brief 056 (v1.1 § 5.1 y §§ 3, 5) · La previa en el coordinador: caducidad propia, separación corta
// solo entre previas, orden obligatorio por id, ventana infinita con el reloj detenido y 409 reintentable.
describe("056 · previa en el coordinador de turnos", () => {
  const P = PREVIA_ARENA;
  const previaId = (n: number) => `previa:${n}-${P.piezas[n - 1]}:0`;
  /** Pieza de la previa (tick 0) con dos variantes; el cursor en `partido` s. */
  const previa = (n: number, extra: Partial<CandidataTurno> = {}): CandidataTurno => ({ id: previaId(n), rol: "estadista", tick: 0, origen: "048", tema: "previa", completa: valida(dur), breve: valida(dur / 2), ...extra });
  const enCero = (extra: Partial<EntradaTurno> = {}) => base({ partidoS: 0, ...extra });

  it("caducidadInvitadoS(\"previa\") = PREVIA_ARENA.caducidadS; mayor que la general y la separación menor que la general", () => {
    expect(caducidadInvitadoS("previa")).toBe(P.caducidadS);
    expect(P.caducidadS).toBeGreaterThan(MESA_ARENA.caducidadInvitadoS);
    expect(P.separacionS).toBeLessThan(MESA_ARENA.separacionInvitadosS);
    expect(P.bolsaSpeech.solicitudes).toBeGreaterThanOrEqual(P.piezas.length * 2 * 2);
    // Una pieza arranca a caducidadS de partido y no un tick después.
    const enS = (s: number) => base({ partidoS: s, candidatas: [previa(1)], ventanaS: dur * 2 });
    expect(siguienteTurno(enS(P.caducidadS))?.id).toBe(previaId(1));
    expect(siguienteTurno(enS(P.caducidadS + ARENA.pasoS))).toBeNull();
    expect(descartesTurno(enS(P.caducidadS + ARENA.pasoS))).toEqual([previaId(1)]);
  });

  it("con el reloj detenido una previa completa de 19 s es elegible con ventanaS = 4; la misma candidata no previa elige la breve", () => {
    const larga = previa(1, { completa: valida(19), breve: valida(3) });
    expect(siguienteTurno(enCero({ relojDetenido: true, ventanaS: 4, candidatas: [larga] }))?.variante).toBe("completa");
    const ordinaria: CandidataTurno = { ...larga, id: "estadista:posesion:0", tema: "posesion" };
    expect(siguienteTurno(enCero({ relojDetenido: true, ventanaS: 4, candidatas: [ordinaria] }))?.variante).toBe("breve");
    // Con el reloj en marcha, la previa sigue la regla general del 048.
    expect(siguienteTurno(enCero({ relojDetenido: false, ventanaS: 4, candidatas: [larga] }))?.variante).toBe("breve");
    // Detenido, con la completa aún pendiente (el consumidor no pide la breve), no arranca nada.
    expect(siguienteTurno(enCero({ relojDetenido: true, ventanaS: 4, candidatas: [previa(1, { completa: { estado: "pendiente" }, breve: { estado: "pendiente" } })] }))).toBeNull();
  });

  it("separación PREVIA_ARENA.separacionS entre dos previas y la general entre una previa y un comentarista", () => {
    const tras = { ultimoInvitado: { rol: "estadista" as const, tick: 0, tema: "previa" } };
    expect(siguienteTurno(enCero({ ...tras, finUltimoInvitadoS: ahora - P.separacionS + 0.01, candidatas: [previa(2)] }))).toBeNull();
    expect(siguienteTurno(enCero({ ...tras, finUltimoInvitadoS: ahora - P.separacionS, candidatas: [previa(2)] }))?.id).toBe(previaId(2));
    // Tras una previa, un comentarista espera la separación general.
    const com = cand("comentarista", 0);
    expect(siguienteTurno(enCero({ ...tras, finUltimoInvitadoS: ahora - P.separacionS, candidatas: [com] }))).toBeNull();
    expect(siguienteTurno(enCero({ ...tras, finUltimoInvitadoS: ahora - MESA_ARENA.separacionInvitadosS, candidatas: [com] }))?.id).toBe(com.id);
    // Tras un invitado ordinario, una previa también espera la general.
    const trasOrdinario = { ultimoInvitado: { rol: "comentarista" as const, tick: 0, tema: "tiempo" } };
    expect(siguienteTurno(enCero({ ...trasOrdinario, finUltimoInvitadoS: ahora - P.separacionS, candidatas: [previa(1)] }))).toBeNull();
    expect(siguienteTurno(enCero({ ...trasOrdinario, finUltimoInvitadoS: ahora - MESA_ARENA.separacionInvitadosS, candidatas: [previa(1)] }))?.id).toBe(previaId(1));
  });

  it("empate de tick entre previas resuelto por id ascendente, sea cual sea el orden de entrada", () => {
    expect(siguienteTurno(enCero({ candidatas: [previa(3), previa(2), previa(1)] }))?.id).toBe(previaId(1));
    expect(siguienteTurno(enCero({ candidatas: [previa(3), previa(2)] }))?.id).toBe(previaId(2));
  });

  it("orden obligatorio: la pieza 2 válida espera a la 1 pendiente; si la 1 falló o caducó, pasa la 2", () => {
    const pendiente = previa(1, { completa: { estado: "pendiente" }, breve: { estado: "pendiente" } });
    expect(siguienteTurno(enCero({ candidatas: [previa(2), pendiente] }))).toBeNull();
    const fallida = previa(1, { completa: { estado: "fallida" }, breve: { estado: "fallida" } });
    expect(siguienteTurno(enCero({ candidatas: [previa(2), fallida] }))?.id).toBe(previaId(2));
    // Audio fuera de orden: la 2 llegó antes, la 1 decodificada después → suena la 1 primero.
    expect(siguienteTurno(enCero({ candidatas: [previa(2), previa(1)] }))?.id).toBe(previaId(1));
  });

  it("regresiones (v1.1 § 5): candidatas ordinarias del mismo rol y tick conservan el orden estable de hoy", () => {
    const a: CandidataTurno = { ...cand("estadista", tickCursor, `estadista:b:${tickCursor}`) }, b: CandidataTurno = { ...cand("estadista", tickCursor, `estadista:a:${tickCursor}`) };
    // Resultado de hoy (sort estable por tick): la primera de la lista, aunque su id sea mayor.
    expect(siguienteTurno(base({ candidatas: [a, b] }))?.id).toBe(a.id);
    expect(siguienteTurno(base({ candidatas: [b, a] }))?.id).toBe(b.id);
    const final: CandidataTurno = { ...cand("estadista", tickCursor, `estadista:final:${tickCursor}`) };
    expect(siguienteTurno(base({ candidatas: [final, a] }))?.id).toBe(final.id);
    expect(siguienteTurno(base({ candidatas: [a, final] }))?.id).toBe(a.id);
    // Mezcla previa + ordinaria: la ordinaria más reciente (mismo rol) sigue ganando por tick.
    const mezcla = base({ partidoS: 5, candidatas: [previa(1), cand("estadista", 50)] });
    expect(siguienteTurno(mezcla)?.id).toBe(cand("estadista", 50).id);
  });

  it("409 reintentable solo con tema previa; los demás estados no cambian", () => {
    const http = (estado: number) => ({ tipo: "http" as const, estado });
    expect(esperaReintentoInvitado(http(409), 0, 0, "previa")).toBeGreaterThan(0);
    expect(esperaReintentoInvitado(http(409), 0, 0, "tiempo")).toBeNull();
    expect(esperaReintentoInvitado(http(409), 0, 0)).toBeNull();
    expect(esperaReintentoInvitado(http(404), 0, 0, "previa")).toBeNull();
    // Caducidad de la previa en el reintento.
    expect(esperaReintentoInvitado(http(429), 0, P.caducidadS, "previa")).not.toBeNull();
    expect(esperaReintentoInvitado(http(429), 0, P.caducidadS + ARENA.pasoS, "previa")).toBeNull();
  });

  it("v1.1 § 3 · candidatasAlReactivar: previa pendiente a 5 s se conserva; a 31 s se termina; arrancada no aparece; ordinaria se termina", () => {
    const pieza = (n: number) => ({ id: previaId(n), tick: 0, forma: "previa" as const });
    const ordinaria = { id: "comentarista:tiempo:20", tick: 20, forma: "pregunta" as const };
    const enTick = (s: number) => Math.round(s / ARENA.pasoS);
    expect(candidatasAlReactivar([pieza(2)], enTick(5))).toEqual([]);
    expect(candidatasAlReactivar([pieza(2)], enTick(P.caducidadS + 1))).toEqual([pieza(2).id]);
    expect(candidatasAlReactivar([pieza(1), pieza(2)], enTick(5), new Set([pieza(1).id]))).toEqual([]);
    expect(candidatasAlReactivar([ordinaria, pieza(3)], enTick(5))).toEqual([ordinaria.id]);
    // Una candidatura no anterior a la activación nunca se termina.
    expect(candidatasAlReactivar([{ id: "estadista:x:60", tick: 60 }], enTick(5))).toEqual([]);
  });
});
