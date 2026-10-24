import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MESA_ARENA, PRIORIDAD_EVENTO_ARENA } from "../../sim/limites";
import { BUFFER_ARENA, firmaEstadoVoz, golSuperado, planVozBuffer, RelojBuffer, RitmoProduccionBuffer, rondaVisible, VOZ_BUFFER } from "../buffer";
import { GestorSesiones } from "../sesiones";
import { construirRelato } from "../relato";
import { reproducirArena } from "../coordinador";
import { aplicarPublicacion } from "../protocolo";
import { readFile } from "node:fs/promises";
import type { RegistroArena } from "../tipos";

const rutas: string[] = [];
afterEach(async () => { await Promise.all(rutas.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
async function directorio() { const p = await mkdtemp(join(tmpdir(), "cronista-buffer-")); rutas.push(p); return p; }
const ajustes = { seed: 42, segundos: 40, local: "auto", visita: "auto", seleccion: { modo: "programado" }, presentacion: "buffer" };

it("llena veinte segundos y usa plazos absolutos para absorber decisiones lentas", () => {
  let ahora = 1000;
  const productor = new RitmoProduccionBuffer(() => ahora);
  expect(productor.espera(195)).toBe(0);
  expect(productor.espera(200)).toBe(0);
  expect(productor.espera(205)).toBe(500);
  ahora += 10000;
  expect(productor.espera(300)).toBe(0);
  ahora += 4000; // El modelo tarda cuatro segundos: se consume reserva.
  expect(productor.espera(305)).toBe(0);
  expect(productor.espera(340)).toBe(0);
  expect(productor.espera(345)).toBe(500); // Recupera el reloj; no suma cuatro segundos.
});

it("arranca antes del final, no sigue las ráfagas y recupera reserva tras agotarla", () => {
  const r = new RelojBuffer();
  expect(r.avanzar(.1, 19.9, false)).toBe(0);
  expect(r.estado).toBe("preparando");
  expect(r.avanzar(.1, 20, false)).toBeCloseTo(.1);
  expect(r.estado).toBe("reproduciendo");
  r.avanzar(.1, 35, false);
  expect(r.segundo).toBeCloseTo(.2); // Llegar a 35 no salta la cancha a 35.
  for (let i = 0; i < 80; i++) r.avanzar(.25, 20, false);
  expect(r.estado).toBe("recuperando"); expect(r.segundo).toBe(20);
  for (let i = 0; i < 100; i++) r.avanzar(.25, 20, false);
  expect(r.segundo).toBe(20); // Una espera de 25 s no inventa movimiento.
  r.avanzar(.25, 29, false); expect(r.segundo).toBe(20);
  r.avanzar(.25, 30, false); expect(r.segundo).toBe(20.25);
});

it("el reloj conserva la pausa y drena un final menor que la reserva", () => {
  const r = new RelojBuffer();
  r.avanzar(.1, Math.min(30, 15), false); expect(r.segundo).toBe(0);
  r.avanzar(.1, Math.min(30, 20), false); expect(r.segundo).toBe(.1);
  r.pausar(); r.avanzar(10, 100, false); expect(r.segundo).toBe(.1);
  r.continuar(); r.avanzar(.1, 10, true); expect(r.segundo).toBe(.2);
  for (let i = 0; i < 50; i++) r.avanzar(.25, 10, true);
  expect(r.segundo).toBe(10); expect(r.estado).toBe("final");
});

it("la voz espera hechos visibles, conserva duración natural y no acumula comentarios atrasados", () => {
  expect(planVozBuffer(5, 15, 4.9, 10, 0, 10)).toBeNull();
  const larga = planVozBuffer(5, 15, 5, 10, 0, 10)!;
  expect(larga.velocidad).toBe(1); expect(larga.fin - larga.cuando).toBeCloseTo(15);
  expect(planVozBuffer(6, 10, 6, 11, larga.fin, 10, 10)).toBeNull();
  expect(planVozBuffer(6, 10, 15, 30, 0, 10)).toBeNull();
  const gol = planVozBuffer(7, 8, 7, 12, larga.fin, 100, 10)!;
  expect(gol.interrumpirAnterior).toBe(true); expect(gol.cuando).toBeCloseTo(12.03);
  expect(planVozBuffer(8, 8, 8, 13, gol.fin, 80, 100)).toBeNull();
  expect(planVozBuffer(8, Infinity, 8, 13, 0, 10)).toBeNull();
  expect(planVozBuffer(8, 25, 8, 13, 0, 10)).toBeNull();
  expect(planVozBuffer(60, 12, 60, 70, 80, 0, 10, true)).toBeNull();
  expect(planVozBuffer(60, 12, 60, 81, 0, 0, 0, true)).toMatchObject({ velocidad: 1, interrumpirAnterior: false });
  expect(planVozBuffer(6, 4, 6, 10, 15, 10, -1)).toMatchObject({ interrumpirAnterior: true });
});

it("la jugada caduca a los tres segundos y un remate o saque cede prioridad sobre el contexto", () => {
  for (const prioridad of [10, 35, 60, 100]) {
    expect(planVozBuffer(20, 4, 23, 100, 0, prioridad)).not.toBeNull();
    expect(planVozBuffer(20, 4, 23.01, 100, 0, prioridad)).toBeNull();
  }
  expect(planVozBuffer(23, 3, 23, 100, 110, 60, 10)?.interrumpirAnterior).toBe(true);
  expect(planVozBuffer(23, 3, 23, 100, 110, 35, 10)?.interrumpirAnterior).toBe(true);
  expect(planVozBuffer(23, 3, 23, 100, 110, 60, 100)).toBeNull();
});

it("la entrada se ancla al instante solicitado y omite el gol anterior de la misma ventana", async () => {
  const r = JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;
  expect(r.eventos.some(e => e.tipo === "gol" && e.tick === 231)).toBe(true);
  const entrada = construirRelato(r, 200, 250, "buffer", "es", { entradaTick: 237 });
  expect(entrada.fragmentos[0]?.tick).toBe(237); expect(entrada.fuentes).toEqual([]);
  expect(entrada.texto).not.toMatch(/¡Gol/);
  expect("tipoRelato" in entrada && entrada.tipoRelato).toBe("entrada");
  const prefijo = { ...r, eventos: r.eventos.filter(e => e.tick <= 237), fotogramas: r.fotogramas.filter(f => f.tick <= 237) };
  expect(construirRelato(prefijo, 200, 250, "buffer", "es", { entradaTick: 237 })).toEqual(entrada);
  const estado = prefijo.fotogramas.at(-1)!;
  expect("firmaEstado" in entrada && entrada.firmaEstado).toBe(firmaEstadoVoz(estado));
  const otro = structuredClone(estado); otro.balon.poseedor = "otro"; otro.balon.vuelo = null;
  expect(firmaEstadoVoz(otro)).not.toBe(firmaEstadoVoz(estado));
  expect(() => construirRelato(r, 200, 250, "buffer", "es", { entradaTick: 251 })).toThrow("Entrada");
  expect(() => construirRelato(r, 200, 250, "buffer", "es", { entradaTick: 237, cierre: true })).toThrow("Entrada");
});

it("una instantánea y su cursor permiten seguir el mismo partido sin perder publicaciones", async () => {
  const gestor = new GestorSesiones({ directorio: await directorio(), ritmoMsPorSegundo: 10 });
  const { id } = await gestor.crear(ajustes);
  // Esperar al prefijo inicial, que se publica de forma asíncrona.
  let instantanea;
  for (let i = 0; i < 100; i++) {
    try { instantanea = await gestor.emision(id); if (instantanea.registro.final.tick > 0) break; } catch { /* Todavía inicia. */ }
    await new Promise(r => setTimeout(r, 2));
  }
  expect(instantanea).toBeDefined();
  expect(instantanea!.registro.final.tick).toBeLessThan(400);
  expect(instantanea!.estado).toBe("ejecutando");
  const flujo = await gestor.escuchar(id, instantanea!.ultimoMensaje, new AbortController().signal);
  const texto = await flujo.text();
  await gestor.esperarFinal(id);
  let registro: RegistroArena | null = instantanea!.registro;
  const mensajes = texto.split("\n").filter(l => l.startsWith("data: ")).map(l => JSON.parse(l.slice(6)));
  expect(mensajes[0].id).toBe(instantanea!.ultimoMensaje + 1);
  for (const m of mensajes) registro = aplicarPublicacion(registro, m.publicacion);
  expect(registro).toEqual(await gestor.registro(id));
  expect(reproducirArena(registro)).toEqual(registro);
  const restaurado = new GestorSesiones({ directorio: gestor.directorio });
  expect((await restaurado.emision(id)).registro).toEqual(registro);
});

it("se puede cancelar mientras el productor espera sin finalizar el partido falsamente", async () => {
  const gestor = new GestorSesiones({ directorio: await directorio(), ritmoMsPorSegundo: 1000 });
  const { id } = await gestor.crear(ajustes);
  for (let i = 0; i < 200; i++) {
    try { if ((await gestor.emision(id)).registro.final.tick >= 200) break; } catch { /* Iniciando. */ }
    await new Promise(r => setTimeout(r, 2));
  }
  await gestor.detener(id); await gestor.esperarFinal(id);
  const parcial = await gestor.emision(id);
  expect(parcial.estado).toBe("cancelada");
  expect(parcial.registro.final.tick).toBeLessThan(400);
  await expect(gestor.reproduccion(id)).rejects.toMatchObject({ status: 409 });
});

it("el relato breve conserva el gol y sus fuentes sin narrar hechos futuros o todas las acciones", async () => {
  const registro = JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;
  let narrados = 0;
  for (let inicio = 0; inicio < registro.final.tick; inicio += BUFFER_ARENA.tramoTicks) {
    const fin = Math.min(inicio + BUFFER_ARENA.tramoTicks, registro.final.tick);
    const s = construirRelato(registro, inicio, fin, "buffer", "es");
    expect(s.fragmentos.length).toBeLessThanOrEqual(1);
    expect(s.fragmentos.every(f => f.tick <= fin && f.tick >= inicio)).toBe(true);
    expect(s.fuentes.every(id => registro.eventos.some(e => e.id === id && e.tick <= fin))).toBe(true);
    expect(s.texto.split(/\s+/).length).toBeLessThanOrEqual(100);
    narrados += s.eventosNarrados;
    if (registro.eventos.some(e => e.tipo === "gol" && e.tick > inicio && e.tick <= fin)) expect(s.fragmentos[0]?.emocion).toBe("jubilo");
    const prefijo = { ...registro, final: registro.fotogramas.find(f => f.tick === fin)!, fotogramas: registro.fotogramas.filter(f => f.tick <= fin), eventos: registro.eventos.filter(e => e.tick <= fin) };
    expect(construirRelato(prefijo, inicio, fin, "buffer", "es")).toEqual(s);
  }
  expect(narrados).toBeLessThan(registro.eventos.length);
  expect(rondaVisible(registro, -1)).toBeUndefined();
  expect(rondaVisible(registro, 1)?.inicioTick).toBe(0);
});

it("el comentario de contexto usa la ventana observada y no cada pase", async () => {
  const original = JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;
  const registro = { ...original, eventos: original.eventos.filter(e => ["pase", "recepcion", "recuperacion"].includes(e.tipo)) };
  const contexto = construirRelato(registro, 100, 150, "buffer", "es");
  expect(construirRelato(original, 100, 150, "buffer", "es").fuentes).toContain("a9"); // El fuera de juego prima sobre el comentario.
  expect(contexto.texto).toContain(original.inicial.jugadores.find(j => j.id === "local-2")!.nombre);
  expect(contexto.texto).not.toContain("intentos de pase");
  expect(contexto.fragmentos[0]?.tick).toBe(150);
  expect(contexto.fuentes.length).toBeGreaterThan(0);
  expect(contexto.fuentes.every(id => registro.eventos.find(e => e.id === id)!.tick <= 150)).toBe(true);
  const previo = construirRelato(registro, 50, 100, "buffer", "es");
  expect(previo.texto.length).toBeGreaterThan(0);
  expect(previo.fragmentos[0]?.tick).toBe(100);
  expect(previo.fuentes).toContain("a7"); // Reconstruye la recepción confirmada, no el pase intentado.
  expect(previo.fotogramas.every(t => t <= 100)).toBe(true);
  const prefijo = { ...registro, eventos: registro.eventos.filter(e => e.tick <= 150), final: registro.fotogramas.find(f => f.tick === 150)!, fotogramas: registro.fotogramas.filter(f => f.tick <= 150) };
  expect(construirRelato(prefijo, 100, 150, "buffer", "es")).toEqual(contexto);
});

it("el cierre usa el marcador confirmado y espera al final del encuentro", async () => {
  const r = JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;
  expect(() => construirRelato(r, 100, 150, "buffer", "es", { cierre: true })).toThrow("todavía");
  const cierre = construirRelato(r, 550, 600, "buffer", "es", { cierre: true });
  expect(cierre.texto).toContain("Final del partido"); expect(cierre.fragmentos[0]?.tick).toBe(600);
  expect("cierre" in cierre && cierre.cierre).toBe(true);
  expect(cierre.fuentes).toEqual(r.eventos.filter(e => e.tipo === "gol").map(e => e.id));
});

// Brief 045
describe("045 · planVozBuffer con la prioridad del invitado", () => {
  it("un invitado nunca interrumpe una fuente ≥ 0 y una noticia ≥ prioridadInterrupcion sí lo corta", () => {
    for (const anterior of [0, 10, MESA_ARENA.prioridadInvitado, VOZ_BUFFER.prioridadInterrupcion, 100]) {
      const plan = planVozBuffer(20, 3, 20, 100, 105, MESA_ARENA.prioridadInvitado, anterior);
      expect(plan?.interrumpirAnterior ?? false).toBe(false);
    }
    expect(planVozBuffer(20, 3, 20, 100, 105, VOZ_BUFFER.prioridadInterrupcion, MESA_ARENA.prioridadInvitado)?.interrumpirAnterior).toBe(true);
    expect(planVozBuffer(20, 3, 20, 100, 105, VOZ_BUFFER.prioridadInterrupcion - 1, MESA_ARENA.prioridadInvitado)).toBeNull();
    // Exención de atraso para invitados (cierre = true solo en el plan): una candidatura de
    // más de atrasoNormalS sigue siendo planificable; la caducidad la decide siguienteTurno.
    expect(planVozBuffer(20, 3, 20 + VOZ_BUFFER.atrasoNormalS + 1, 100, 0, MESA_ARENA.prioridadInvitado, 0)).toBeNull();
    expect(planVozBuffer(20, 3, 20 + VOZ_BUFFER.atrasoNormalS + 1, 100, 0, MESA_ARENA.prioridadInvitado, 0, true)).not.toBeNull();
  });
});

// Brief 050 v1.1 (1) · Prioridad del canto: nada lo corta salvo un gol posterior; los goles anteriores
// (o el mismo, llegado tarde) se descartan como superados; el cierre espera al canto.
describe("050 · canto de gol en planVozBuffer", () => {
  const GOL = PRIORIDAD_EVENTO_ARENA.gol!, ahora = 50, golS = 23.1, duracion = 9, finCanto = ahora + duracion;
  /** Plan de un clip en el segundo `eventoS` con el canto del gol de `golS` sonando. */
  const sobreCanto = (prioridad: number, eventoS = golS + 0.5, cierre = false) => planVozBuffer(eventoS, 1.5, eventoS, ahora, finCanto, prioridad, GOL, cierre, golS);

  it("reinicio, tiro, atajada, roja e invitado no cortan un canto en curso", () => {
    for (const p of [PRIORIDAD_EVENTO_ARENA.reinicio!, PRIORIDAD_EVENTO_ARENA.tiro!, PRIORIDAD_EVENTO_ARENA.atajada!, PRIORIDAD_EVENTO_ARENA.roja!, MESA_ARENA.prioridadInvitado]) expect(sobreCanto(p), String(p)).toBeNull();
  });

  it("un gol posterior corta el canto (c); un gol con el mismo instante o anterior no", () => {
    expect(sobreCanto(GOL, golS + 4)).toMatchObject({ interrumpirAnterior: true, velocidad: 1 });
    expect(sobreCanto(GOL, golS)).toBeNull();
    expect(planVozBuffer(golS - 4, duracion, golS, ahora, finCanto, GOL, GOL, false, golS)).toBeNull();
    // Sin el instante de la fuente activa, la igualdad nunca interrumpe.
    expect(planVozBuffer(golS + 4, duracion, golS + 4, ahora, finCanto, GOL, GOL)).toBeNull();
    expect(golSuperado(GOL, Math.round((golS + 4) * 10), { prioridad: GOL, tick: Math.round(golS * 10) })).toBe(false);
  });

  it("M7 (a) · dos cantos vigentes: arranca el más reciente y el anterior, aún dentro del atraso, no lo corta", () => {
    const clips = [{ clave: "viejo", tick: 245, prioridad: GOL }, { clave: "nuevo", tick: 251, prioridad: GOL }];
    // Orden del consumidor: prioridad descendente y, en empate, tick descendente.
    const orden = [...clips].sort((a, b) => b.prioridad - a.prioridad || b.tick - a.tick);
    expect(orden[0]!.clave).toBe("nuevo");
    // Cursor en el que los dos son vigentes: ambos alcanzados y el viejo dentro de atrasoImportanteS.
    const partidoS = orden[0]!.tick / 10 + .5;
    for (const c of clips) expect(partidoS - c.tick / 10).toBeLessThanOrEqual(VOZ_BUFFER.atrasoImportanteS);
    // Sin fuente activa, el viejo sí podría sonar: lo que lo frena es solo el canto más reciente.
    expect(planVozBuffer(orden[1]!.tick / 10, duracion, partidoS, ahora, 0, GOL, 0)).not.toBeNull();
    const primero = planVozBuffer(orden[0]!.tick / 10, duracion, partidoS, ahora, 0, GOL, 0)!;
    expect(primero.interrumpirAnterior).toBe(false);
    const activa = { prioridad: GOL, tick: orden[0]!.tick };
    // Fotograma siguiente: el canto viejo, vigente, no corta al nuevo (igualdad de prioridad con tick anterior).
    expect(planVozBuffer(orden[1]!.tick / 10, duracion, partidoS, ahora + .02, primero.fin, GOL, GOL, false, activa.tick / 10)).toBeNull();
    expect(golSuperado(GOL, orden[1]!.tick, activa)).toBe(true);
  });

  it("(b) respuesta fuera de orden: el clip del gol viejo que llega tras arrancar el nuevo queda superado", () => {
    const activa = { prioridad: GOL, tick: 290 };
    expect(golSuperado(GOL, 231, activa)).toBe(true);
    expect(golSuperado(GOL, 290, activa)).toBe(true);
    // Solo entre goles: otras prioridades y otras fuentes activas no se tocan.
    expect(golSuperado(PRIORIDAD_EVENTO_ARENA.tiro!, 231, activa)).toBe(false);
    expect(golSuperado(GOL, 231, { prioridad: PRIORIDAD_EVENTO_ARENA.tiro!, tick: 290 })).toBe(false);
    expect(golSuperado(GOL, 231, undefined)).toBe(false);
  });

  it("el cierre (prioridad 0) espera mientras suena el canto y arranca al liberarse, exento de atraso", () => {
    expect(planVozBuffer(60, 3, 60, ahora, finCanto, 0, GOL, true, golS)).toBeNull();
    expect(planVozBuffer(60, 3, 70, finCanto + .01, finCanto, 0, GOL, true, golS)).toMatchObject({ interrumpirAnterior: false });
  });
});

describe("058 · RelojBuffer con la antesala (§ 4.5 y v1.1 § 3)", () => {
  const reserva = BUFFER_ARENA.segundos + BUFFER_ARENA.recuperacionS;
  it("retenido no avanza con la reserva de sobra; soltar arranca al momento", () => {
    const r = new RelojBuffer();
    expect(r.retener()).toBe(true);
    for (let k = 0; k < 10; k++) expect(r.avanzar(.1, reserva, false)).toBe(0);
    expect(r.estado).toBe("preparando");
    r.soltar();
    expect(r.avanzar(.1, reserva, false)).toBeGreaterThan(0);
    expect(r.estado).toBe("reproduciendo");
  });
  it("retener con segundo > 0 o con el reloj en marcha no hace efecto", () => {
    const r = new RelojBuffer();
    r.avanzar(.1, reserva, false);
    expect(r.retener()).toBe(false);
    expect(r.avanzar(.1, reserva, false)).toBeGreaterThan(.1);
    const otro = new RelojBuffer(BUFFER_ARENA.tramoTicks / 10);
    expect(otro.retener()).toBe(false);
  });
  it("(a) en pausa en 0:00 retiene; continuar con retención vuelve a preparando y sigue sin avanzar", () => {
    const r = new RelojBuffer();
    r.pausar();
    expect(r.retener()).toBe(true);
    r.continuar();
    expect(r.estado).toBe("preparando");
    expect(r.avanzar(.1, reserva, false)).toBe(0);
    // Sin retención, continuar vuelve a recuperando como siempre.
    const s = new RelojBuffer(); s.pausar(); s.continuar();
    expect(s.estado).toBe("recuperando");
  });
  it("(c) retenido en el mismo fotograma en que saldría de preparando: sigue en 0:00 en el siguiente", () => {
    const r = new RelojBuffer();
    expect(r.avanzar(.1, BUFFER_ARENA.segundos - 1, false)).toBe(0);
    r.retener();
    expect(r.avanzar(.1, reserva, false)).toBe(0);
    expect(r.avanzar(.1, reserva, true)).toBe(0);
  });
});
