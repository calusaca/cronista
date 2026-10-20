import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { ARENA, ARBITRAJE_ARENA, TECNICA_ARENA } from "../../sim/limites";
import { configDeSemilla } from "../../sim/plantillas";
import * as azar from "../../sim/prng";
import type { Condiciones } from "../../sim/tipos";
import { compatibilidadPuesto } from "../alineacion";
import { estructuraBase } from "../catalogo";
import { crearControladorProgramado, planProgramado, validarOrdenes } from "../controladores";
import { ejecutarArena, observarArena, reproducirArena } from "../coordinador";
import { gestionarProgramado } from "../entrenadores";
import { resumir } from "../entorno";
import { distancia } from "../geometria";
import { crearConfigArena, crearEstadoArena, MotorArena } from "../motor";
import { formaciones, type EstadoArena, type GestionEquipo, type ObservacionArena, type OrdenesEquipo, type ParSustitucion } from "../tipos";
import { estadoVisual, narrarEventoArena } from "../vista";

const programados = () => ({ local: crearControladorProgramado(), visita: crearControladorProgramado() });
const neutral: Condiciones = { clima: "despejado", superficie: "natural", cesped: "corto", presion: { local: "baja", visita: "media" } };

function revision(): ObservacionArena {
  const obs = structuredClone(observarArena(new MotorArena(crearConfigArena()), "local"));
  obs.estado.tick = 1200; obs.tiempoS = 120; obs.estado.marcador = { local: 0, visita: 1 };
  const s = obs.estado.entrenadores!.local;
  s.proximaRevisionTick = 1000; s.ultimoPlanTick = 0;
  obs.equipos.local.entrenador!.rotacion = 100; obs.equipos.local.entrenador!.adaptabilidad = 100;
  obs.resumen!.local.energiaMedia = 0.8; obs.resumen!.local.perdidas = 4; obs.resumen!.visita.tiros = 3;
  return obs;
}

function paseControlado(entorno: Partial<Condiciones> = {}) {
  const config = crearConfigArena({ duracionS: 10, entorno: { ...neutral, ...entorno } });
  const inicial = crearEstadoArena(config);
  inicial.saque = null; inicial.pausa = null; // El escenario comienza con un pase en juego.
  for (const j of inicial.jugadores) { j.posicion = { x: j.lado === "local" ? 5 : 100, y: j.lado === "local" ? 5 : 65 }; j.velocidad = { x: 0, y: 0 }; j.nivel = 100; }
  for (const s of Object.values(inicial.entrenadores!)) s.plan.ritmo = "normal";
  const propios = inicial.jugadores.filter(j => j.lado === "local" && j.puesto !== "POR");
  const autor = propios[0]!, receptor = propios[1]!;
  autor.posicion = { x: 40, y: 34 }; receptor.posicion = { x: 60, y: 34 };
  inicial.balon = { posicion: { ...autor.posicion }, poseedor: autor.id, vuelo: null };
  const motor = new MotorArena(config, inicial), obs = observarArena(motor, "local");
  const local = planProgramado(obs), visita = planProgramado(observarArena(motor, "visita"));
  for (const plan of [local, visita]) for (const o of plan.ordenes) {
    o.accion = "mover"; o.destino = { ...inicial.jugadores.find(j => j.id === o.jugador)!.posicion }; o.receptor = null;
  }
  const orden = local.ordenes.find(o => o.jugador === autor.id)!;
  orden.accion = "pasar"; orden.receptor = receptor.id; orden.destino = { ...receptor.posicion };
  return { motor, planes: { local, visita }, autor, receptor };
}

describe("Arena v3: entrenadores, banco y decisiones", () => {
  it("reproduce el ejemplo real de cuatro decisiones válidas sin llamar al modelo", () => {
    const archivo = JSON.parse(readFileSync("public/experimentos/arena-llm-v3.json", "utf8"));
    const r = reproducirArena(archivo);
    expect(r).toEqual(archivo);
    expect(r.rondas.flatMap(x => Object.values(x.decisiones)).every(d => d.tipo === "llm" && d.origen === "controlador")).toBe(true);
    expect(r.eventos.some(e => e.tipo === "plan_equipo")).toBe(true);
    expect(r.rondas[1]!.decisiones.local.ordenes.gestion!.mentalidad).toBe("buscar");
  });
  it("genera entrenador y niveles individuales, selecciona once compatibles y conserva 32 identidades", () => {
    const base = configDeSemilla(42), antes = structuredClone(base), config = crearConfigArena({ partido: base });
    const estado = crearEstadoArena(config);
    expect(base).toEqual(antes); expect(config.partido.variantes!.niveles).toBe(true);
    expect(new Set([...estado.jugadores, ...estado.banco!].map(j => j.id)).size).toBe(32);
    expect(estado.jugadores).toHaveLength(22); expect(estado.banco).toHaveLength(10);
    for (const lado of ["local", "visita"] as const) {
      expect(estado.jugadores.filter(j => j.lado === lado && j.puesto === "POR")).toHaveLength(1);
      expect(estado.jugadores.filter(j => j.lado === lado && j.capitan)).toHaveLength(1);
      expect(new Set(config.partido[lado].jugadores.map(j => j.nivel)).size).toBeGreaterThan(1);
      expect(config.entrenadores![lado].nombre).toBeTruthy();
      expect(estado.jugadores.filter(j => j.lado === lado).every(j => compatibilidadPuesto(j, j.puesto) > 0)).toBe(true);
    }
    const otro = crearConfigArena({ partido: { ...base, seed: 78 }, local: "3-5-2" });
    expect(otro.entrenadores).toEqual(config.entrenadores);
    expect(otro.partido.local.jugadores).toEqual(config.partido.local.jugadores);
  });
  it.each(formaciones)("asigna once identidades únicas y referencias válidas en %s", local => {
    const config = crearConfigArena({ local }), motor = new MotorArena(config);
    expect(estructuraBase(local)).toBe(local);
    expect(motor.estado.jugadores).toHaveLength(22);
    expect(motor.estado.jugadores.every(j => Number.isFinite(j.posicion.x) && Number.isFinite(j.posicion.y))).toBe(true);
    expect(new Set(motor.estado.jugadores.filter(j => j.lado === "local").map(j => j.puesto)).size).toBe(11);
    expect(validarOrdenes(planProgramado(observarArena(motor, "local")), observarArena(motor, "local")).ordenes).toHaveLength(11);
  });
  it("el entrenador responde a desventaja, calor y desgaste con una gestión reproducible", () => {
    const obs = revision(), gestion = gestionarProgramado(obs)!;
    expect(gestion).toEqual(gestionarProgramado(structuredClone(obs)));
    expect(gestion.mentalidad).toBe("buscar"); expect(gestion.motivo).toContain("desventaja"); expect(gestion.motivo).toContain("desgaste");
    expect(gestion.sustitucion).not.toBeNull();
    expect(validarOrdenes(planProgramado(obs), obs).gestion).toEqual(gestion);
    obs.estado.entrenadores!.local.proximaRevisionTick = obs.estado.tick + 1;
    expect(gestionarProgramado(obs)).toBeNull();
  });
  it("rechaza sustitutos rivales, reingresos, presupuestos agotados y citas futuras", () => {
    const obs = revision(), plan = planProgramado(obs);
    for (const modificar of [
      (p: OrdenesEquipo) => { (p.gestion!.sustitucion as ParSustitucion).entra = obs.estado.banco!.find(j => j.lado === "visita")!.id; },
      (p: OrdenesEquipo) => { (p.gestion!.sustitucion as ParSustitucion).entra = (p.gestion!.sustitucion as ParSustitucion).sale; },
      (p: OrdenesEquipo) => { p.gestion!.fuentes = ["a999999"]; },
      (p: OrdenesEquipo) => { p.ordenes[0]!.jugador = "arbitro"; },
    ]) { const copia = structuredClone(plan); modificar(copia); expect(() => validarOrdenes(copia, obs)).toThrow(); }
    for (const campo of ["cambios", "ventanas"] as const) {
      const copia = structuredClone(obs); copia.estado.entrenadores!.local[campo] = 100;
      expect(() => validarOrdenes(plan, copia)).toThrow(/presupuesto/);
    }
    const antes = structuredClone(obs); antes.estado.entrenadores!.local.proximaRevisionTick = antes.estado.tick + 1;
    expect(() => validarOrdenes(plan, antes)).toThrow(/corresponde/);
  });
  it("las observaciones son copias y congelarlas no congela el perfil de configuración", () => {
    const config = crearConfigArena(), motor = new MotorArena(config);
    const a = observarArena(motor, "local"), b = observarArena(motor, "visita");
    expect(a.id).toBe(b.id); expect(a.equipos.local.entrenador).not.toBe(b.equipos.local.entrenador);
    expect(Object.isFrozen(a.equipos.local.entrenador)).toBe(true);
    expect(Object.isFrozen(config.entrenadores!.local)).toBe(false);
    expect(a.resumen!.local.fuentes).toEqual([]); expect(a).not.toHaveProperty("seed");
  });
  it("ejecuta sustituciones en interrupciones, conserva el banco y reproduce el encuentro completo", async () => {
    const r = await ejecutarArena(crearConfigArena(), programados());
    expect(r.eventos.some(e => e.tipo === "plan_equipo")).toBe(true);
    const cambios = r.eventos.filter(e => e.tipo === "cambio"); expect(cambios.length).toBeGreaterThan(0);
    for (const cambio of cambios) {
      expect(r.eventos.some(e => e.tick === cambio.tick && (["gol", "tiro_fuera", "fuera_juego", "falta"].includes(e.tipo) || e.tipo === "reinicio" && e.reinicio))).toBe(true);
      expect(cambios.filter(e => e.jugador === cambio.jugador)).toHaveLength(1);
      expect(r.eventos.some(e => e.jugador === cambio.sale && e.tick > cambio.tick && !["plan_equipo"].includes(e.tipo))).toBe(false);
      expect(narrarEventoArena(cambio, r, "es")).toContain("entra");
    }
    for (const f of r.fotogramas) {
      const todos = [...f.jugadores, ...f.banco!, ...f.retirados!, ...f.expulsados!];
      expect(todos).toHaveLength(32); expect(new Set(todos.map(j => j.id)).size).toBe(32);
      for (const lado of ["local", "visita"] as const) {
        expect(f.jugadores.filter(j => j.lado === lado && j.capitan)).toHaveLength(1);
        expect(f.entrenadores![lado].cambios).toBeLessThanOrEqual(TECNICA_ARENA.maxCambios);
        expect(f.entrenadores![lado].ventanas).toBeLessThanOrEqual(TECNICA_ARENA.maxVentanas);
      }
    }
    for (const e of r.eventos.filter(e => e.tipo === "plan_equipo")) for (const id of e.fuentes!) expect(r.eventos.find(p => p.id === id)!.tick).toBeLessThan(e.tick);
    expect(reproducirArena(JSON.parse(JSON.stringify(r)))).toEqual(r);
    expect(Buffer.byteLength(JSON.stringify(r))).toBeLessThan(ARENA.archivoMaxBytes);
    const alterado = structuredClone(r); alterado.config.entrenadores!.local.ofensiva++;
    expect(() => reproducirArena(alterado)).toThrow();
    const cambio = cambios[0]!, antes = estadoVisual(r, cambio.tick * ARENA.pasoS - 0.01), despues = estadoVisual(r, cambio.tick * ARENA.pasoS);
    expect(antes.jugadores.some(j => j.id === cambio.sale)).toBe(true);
    expect(antes.jugadores.some(j => j.id === cambio.jugador)).toBe(false);
    expect(despues.jugadores.some(j => j.id === cambio.sale)).toBe(false);
    expect(despues.jugadores.some(j => j.id === cambio.jugador)).toBe(true);
  });
});

describe("Arena v3: los factores ambientales llegan al motor", () => {
  it("el resumen empareja los pases por intento y no cuenta recuperaciones propias como pérdida rival", () => {
    const e = paseControlado(), estado = e.motor.estado; estado.tick = 600;
    const evento = (id: string, tick: number, tipo: "pase" | "recepcion" | "recuperacion", jugador: string, receptor: string | null) => ({ id, tick, tipo, lado: "local" as const, jugador, receptor, desde: { x: 40, y: 34 }, hasta: { x: 60, y: 34 }, distanciaM: 20 });
    const eventos = [evento("p1", 295, "pase", e.autor.id, e.receptor.id), evento("r1", 305, "recepcion", e.receptor.id, e.autor.id),
      evento("rec", 310, "recuperacion", e.receptor.id, null), evento("p2", 350, "pase", e.autor.id, e.receptor.id), evento("r2", 360, "recepcion", e.receptor.id, e.autor.id)];
    const resumen = resumir(estado, eventos, 30);
    expect(resumen.local.pases).toBe(1); expect(resumen.local.recepciones).toBe(1);
    expect(resumen.visita.perdidas).toBe(0);
    expect(resumir(estado, [...eventos, evento("futuro", 601, "pase", e.autor.id, e.receptor.id)], 30)).toEqual(resumen);
  });
  it("la lluvia añade dispersión al mismo pase y la superficie cambia su recorrido", () => {
    const seco = paseControlado(), lluvia = paseControlado({ clima: "lluvia" }), sintetica = paseControlado({ superficie: "sintetica", cesped: undefined });
    for (const e of [seco, lluvia, sintetica]) e.motor.avanzar(e.planes, 5);
    const error = (e: ReturnType<typeof paseControlado>) => Math.abs(e.motor.eventos[0]!.hasta.y - 34);
    expect(error(lluvia)).toBeGreaterThan(error(seco));
    expect(distancia(sintetica.autor.posicion, sintetica.motor.estado.balon.posicion)).toBeGreaterThan(distancia(seco.autor.posicion, seco.motor.estado.balon.posicion));
  });
  it("el calor depende de la temperatura registrada y el frío afecta el arranque", () => {
    const templado = paseControlado(), calor = paseControlado({ clima: "calor", temperaturaC: 41 }), frio = paseControlado({ clima: "frio", temperaturaC: -8 });
    for (const e of [templado, calor, frio]) e.motor.avanzar(e.planes, 50);
    const energia = (e: ReturnType<typeof paseControlado>) => e.motor.estado.jugadores.reduce((s, j) => s + j.energia, 0);
    expect(energia(calor)).toBeLessThan(energia(templado));
    const movimiento = (e: ReturnType<typeof paseControlado>) => e.motor.estado.jugadores.reduce((s, j) => s + Math.hypot(j.velocidad.x, j.velocidad.y), 0);
    expect(movimiento(frio)).toBeLessThan(movimiento(templado));
  });
});

function contacto(amarillas = 0, jugadoresRivales = 11) {
  const e = paseControlado(), estado = e.motor.estado;
  const defensor = estado.jugadores.find(j => j.lado === "visita" && j.puesto !== "POR")!;
  const autor = estado.jugadores.find(j => j.id === e.autor.id)!;
  defensor.posicion = { x: autor.posicion.x + 0.1, y: autor.posicion.y }; defensor.amarillas = amarillas;
  if (jugadoresRivales < 11) {
    const ids = new Set([defensor.id, ...estado.jugadores.filter(j => j.lado === "visita" && j.id !== defensor.id).slice(0, jugadoresRivales - 1).map(j => j.id)]);
    estado.jugadores = estado.jugadores.filter(j => j.lado !== "visita" || ids.has(j.id));
  }
  const local = planProgramado(observarArena(e.motor, "local")), visita = planProgramado(observarArena(e.motor, "visita"));
  const orden = local.ordenes.find(o => o.jugador === autor.id)!; orden.accion = "conducir"; orden.receptor = null; orden.destino = { x: 55, y: 34 };
  return { motor: e.motor, planes: { local, visita }, defensor };
}
function fijarContacto(gravedad: number) {
  const original = azar.prngDerivado;
  return vi.spyOn(azar, "prngDerivado").mockImplementation((seed, clave) => clave.startsWith("falta:arena-v3:") ? { ...original(seed, clave), chance: () => true, next: () => gravedad } : original(seed, clave));
}
describe("Arena v3: arbitraje de contactos y jugadores activos", () => {
  it.each([{ valor: 0.2, tarjeta: null }, { valor: 0.8, tarjeta: "amarilla" }, { valor: 0.999, tarjeta: "roja" }])("distingue contacto sancionable y tarjeta: $tarjeta", ({ valor, tarjeta }) => {
    const e = contacto(), espia = fijarContacto(valor);
    try { e.motor.avanzar(e.planes, 1); } finally { espia.mockRestore(); }
    expect(e.motor.eventos.some(p => p.tipo === "falta")).toBe(true);
    expect(e.motor.eventos.some(p => p.tipo === "amarilla" || p.tipo === "roja")).toBe(!!tarjeta);
    if (tarjeta) expect(e.motor.eventos.some(p => p.tipo === tarjeta)).toBe(true);
    expect(e.motor.estado.pausa).not.toBeNull();
    expect(e.motor.estado.arbitro!.ultimaDecision!.evento).toBeTruthy();
  });
  it("una segunda amarilla expulsa, conserva la identidad y reduce las órdenes al equipo activo", () => {
    const e = contacto(1), espia = fijarContacto(0.8);
    try { e.motor.avanzar(e.planes, 1); } finally { espia.mockRestore(); }
    expect(e.motor.eventos.find(p => p.tipo === "roja")!.dobleAmarilla).toBe(true);
    expect(e.motor.estado.jugadores.some(j => j.id === e.defensor.id)).toBe(false);
    expect(e.motor.estado.expulsados!.some(j => j.id === e.defensor.id)).toBe(true);
    const obs = observarArena(e.motor, "visita"), p = planProgramado(obs);
    expect(p.ordenes).toHaveLength(10); expect(() => validarOrdenes(p, obs)).not.toThrow();
    const duplicado = structuredClone(p); duplicado.ordenes.push({ ...p.ordenes[0]! });
    expect(() => validarOrdenes(duplicado, obs)).toThrow();
    expect(e.motor.estado.jugadores.filter(j => j.lado === "visita" && j.puesto === "POR")).toHaveLength(1);
    e.motor.avanzar({ local: planProgramado(observarArena(e.motor, "local")), visita: p }, 10);
    expect(e.motor.eventos.some(p => p.jugador === e.defensor.id && p.tick > 1)).toBe(false);
  });
  it("detiene el motor si una expulsión deja menos de siete jugadores", () => {
    const e = contacto(0, ARBITRAJE_ARENA.minJugadores), espia = fijarContacto(0.999);
    try { e.motor.avanzar(e.planes, 20); } finally { espia.mockRestore(); }
    expect(e.motor.estado.tick).toBe(1);
    expect(e.motor.estado.finalizado!.motivo).toBe("menos_de_siete");
    expect(e.motor.eventos.at(-1)!.tipo).toBe("final_anticipado");
    expect(e.motor.estado.jugadores.filter(j => j.lado === "visita")).toHaveLength(6);
  });
  it("desacelera durante la pausa sin congelar de golpe a los jugadores", () => {
    const e = contacto(), espia = fijarContacto(0.2);
    const portador = e.motor.estado.jugadores.find(j => j.id === e.motor.estado.balon.poseedor)!;
    portador.velocidad = { x: 3, y: 0 }; e.defensor.velocidad = { x: 3, y: 0 };
    try { e.motor.avanzar(e.planes, 1); } finally { espia.mockRestore(); }
    expect(e.motor.estado.pausa).not.toBeNull();
    const anterior = structuredClone(e.motor.estado), eventos = e.motor.eventos.length;
    e.motor.avanzar(e.planes, 2);
    for (const j of e.motor.estado.jugadores) {
      const previo = anterior.jugadores.find(p => p.id === j.id)!;
      expect(Math.hypot(j.velocidad.x - previo.velocidad.x, j.velocidad.y - previo.velocidad.y)).toBeLessThanOrEqual(ARENA.aceleracionMps2 * ARENA.pasoS + 1e-9);
    }
    expect(e.motor.eventos).toHaveLength(eventos);
    expect(e.motor.estado.balon.posicion).toEqual(e.motor.estado.jugadores.find(j => j.id === e.motor.estado.balon.poseedor)!.posicion);
  });
});
