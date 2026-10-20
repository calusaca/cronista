import { describe, expect, it, vi } from "vitest";
import { crearLlmEquipoDesdeEnv, type Llm } from "../../lib/llm";
import { crearLlmAzureOpenAI } from "../../lib/llm-azure-openai";
import { ARENA, TECNICA_ARENA } from "../../sim/limites";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import { anclas, puestos } from "../catalogo";
import { crearControladorLlm, crearControladorProgramado, planProgramado, validarOrdenes } from "../controladores";
import { ejecutarArena, observarArena, reproducirArena } from "../coordinador";
import { distancia } from "../geometria";
import { adelantados, crearConfigArena, crearEstadoArena, MotorArena } from "../motor";
import { formaciones, lados, type ControladorEquipo, type ObservacionArena, type OrdenesEquipo } from "../tipos";

const programados = () => ({ local: crearControladorProgramado(), visita: crearControladorProgramado() });
const configCorta = () => crearConfigArena({ duracionS: 10, intervaloS: 5 });

describe("Arena: sincronización y aislamiento", () => {
  it("inicia ambos controladores antes de esperar y entrega el mismo prefijo", async () => {
    let iniciados = 0;
    let liberar!: () => void;
    const barrera = new Promise<void>(r => { liberar = r; });
    const observaciones: ObservacionArena[] = [];
    const controlador: ControladorEquipo = { id: "prueba", tipo: "programado", async decidir(obs) {
      observaciones.push(obs); iniciados++;
      if (iniciados === 2) liberar();
      await barrera;
      return planProgramado(obs);
    } };
    const config = crearConfigArena({ duracionS: 2, intervaloS: 2 });
    const r = await ejecutarArena(config, { local: controlador, visita: controlador }, { esperaMs: 1000 });
    expect(observaciones).toHaveLength(2);
    expect(observaciones[0]!.id).toBe(observaciones[1]!.id);
    expect(observaciones[0]!.estado).toEqual(observaciones[1]!.estado);
    expect(observaciones[0]!.estado).not.toBe(observaciones[1]!.estado);
    expect(Object.isFrozen(observaciones[0]!.estado.jugadores[0]!.posicion)).toBe(true);
    expect(observaciones[0]).not.toHaveProperty("seed");
    expect(observaciones[0]).not.toHaveProperty("ordenesRivales");
    expect(r.rondas[0]!.decisiones.local.origen).toBe("controlador");
    expect(r.rondas[0]!.decisiones.visita.origen).toBe("controlador");
  });
  it("el orden de llegada de las respuestas no cambia el resultado", async () => {
    const retrasado = (esperar: boolean): ControladorEquipo => ({ id: "prueba", tipo: "programado", async decidir(obs) {
      if (esperar) await new Promise<void>(r => setTimeout(r, 2));
      return planProgramado(obs);
    } });
    const a = await ejecutarArena(configCorta(), { local: retrasado(true), visita: retrasado(false) });
    const b = await ejecutarArena(configCorta(), { local: retrasado(false), visita: retrasado(true) });
    expect(a.eventos).toEqual(b.eventos); expect(a.fotogramas).toEqual(b.fotogramas);
  });
  it("rechaza IDs rivales, duplicados, observaciones caducadas y resultados inventados", () => {
    const obs = observarArena(new MotorArena(configCorta()), "local");
    for (const modificar of [
      (p: OrdenesEquipo) => { p.ordenes[0]!.jugador = "visita-0"; },
      (p: OrdenesEquipo) => { p.ordenes[0]!.jugador = p.ordenes[1]!.jugador; },
      (p: OrdenesEquipo) => { p.observacion = "otra"; },
      (p: OrdenesEquipo) => { p.ordenes[0]!.destino.x = Infinity; },
      (p: OrdenesEquipo) => { p.ordenes[0]!.accion = "gol" as never; },
    ]) { const p = structuredClone(planProgramado(obs)); modificar(p); expect(() => validarOrdenes(p, obs)).toThrow(); }
    expect(() => validarOrdenes({ ...planProgramado(obs), marcador: { local: 99, visita: 0 } }, obs)).toThrow();
  });
  it("una respuesta malformada activa un respaldo registrado sin filtrar errores", async () => {
    const malo: ControladorEquipo = { id: "llm:prueba", tipo: "llm", async decidir() { throw new Error("material privado del proveedor"); } };
    const r = await ejecutarArena(configCorta(), { ...programados(), local: malo });
    expect(r.rondas.every(r => r.decisiones.local.motivo === "error_controlador")).toBe(true);
    expect(JSON.stringify(r)).not.toContain("material privado");
    expect(reproducirArena(r).final).toEqual(r.final);
    const invalido = { ...malo, async decidir() { return {}; } };
    const otro = await ejecutarArena(configCorta(), { ...programados(), local: invalido });
    expect(otro.rondas[0]!.decisiones.local.motivo).toBe("orden_invalida");
  });
  it("agota el plazo, aborta el controlador y no espera una promesa que nunca termina", async () => {
    vi.useFakeTimers();
    try {
      let senal: AbortSignal | undefined;
      const lento: ControladorEquipo = { id: "lento", tipo: "llm", async decidir(_, signal) { senal = signal; return new Promise(() => {}); } };
      const pendiente = ejecutarArena(crearConfigArena({ duracionS: 2, intervaloS: 2 }), { ...programados(), local: lento }, { esperaMs: 20 });
      await vi.advanceTimersByTimeAsync(21);
      const r = await pendiente;
      expect(senal?.aborted).toBe(true);
      expect(r.rondas[0]!.decisiones.local.motivo).toBe("plazo_agotado");
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it("cancelar el experimento interrumpe ambos controladores", async () => {
    const c = new AbortController(), senales: AbortSignal[] = [];
    const lento: ControladorEquipo = { id: "lento", tipo: "llm", async decidir(_, signal) { senales.push(signal); return new Promise(() => {}); } };
    const pendiente = ejecutarArena(configCorta(), { local: lento, visita: lento }, { signal: c.signal });
    await Promise.resolve(); c.abort();
    await expect(pendiente).rejects.toThrow();
    expect(senales).toHaveLength(2); expect(senales.every(s => s.aborted)).toBe(true);
  });
});

describe("Arena: mundo espacial y reproducción", () => {
  it.each(formaciones)("conserva once puestos y jugadores en %s y sus dos fases", f => {
    const ids = puestos(f);
    expect(new Set(ids).size).toBe(11);
    for (const lado of lados) for (const fase of ["base", "ataque", "defensa"] as const) expect(Object.keys(anclas(f, lado, fase)).sort()).toEqual([...ids].sort());
  });
  it("conserva el estado entre intervalos y no modifica el generador histórico", async () => {
    const config = configCorta(), antes = JSON.stringify(simular(config.partido));
    const a = await ejecutarArena(config, programados());
    const b = await ejecutarArena(config, programados());
    expect(a.fotogramas).toEqual(b.fotogramas);
    expect(a.eventos).toEqual(b.eventos);
    expect(JSON.stringify(simular(config.partido))).toBe(antes);
    expect(reproducirArena(JSON.parse(JSON.stringify(a))).fotogramas).toEqual(a.fotogramas);
    for (let i = 1; i < a.rondas.length; i++) expect(a.rondas[i]!.inicioTick).toBe(a.rondas[i - 1]!.finTick);
  });
  it("mantiene jugadores acotados y desplazamientos compatibles con el tiempo", async () => {
    const r = await ejecutarArena(crearConfigArena({ duracionS: 180 }), programados());
    const max = ARENA.velocidadMps * (ARENA.velocidadMinFactor + ARENA.velocidadNivelFactor) * Math.max(...Object.values(TECNICA_ARENA.ritmo));
    for (let i = 0; i < r.fotogramas.length; i++) {
      const f = r.fotogramas[i]!;
      expect(new Set(f.jugadores.map(j => j.id)).size).toBe(f.jugadores.length);
      for (const [n, j] of f.jugadores.entries()) {
        expect(j.posicion.x).toBeGreaterThanOrEqual(0); expect(j.posicion.x).toBeLessThanOrEqual(ARENA.largoM);
        expect(j.posicion.y).toBeGreaterThanOrEqual(0); expect(j.posicion.y).toBeLessThanOrEqual(ARENA.anchoM);
        expect(Math.hypot(j.velocidad.x, j.velocidad.y)).toBeLessThanOrEqual(max + 1e-9);
        if (i) {
          const anterior = r.fotogramas[i - 1]!, dt = (f.tick - anterior.tick) * ARENA.pasoS;
          const previo = anterior.jugadores.find(p => p.id === j.id);
          const recolocacion = r.eventos.some(e => e.tipo === "reinicio" && e.reinicio && e.tick > anterior.tick && e.tick <= f.tick);
          if (previo && !recolocacion) expect(distancia(j.posicion, previo.posicion)).toBeLessThanOrEqual(max * dt + 1e-9);
          else if (previo) { expect(f.saque).toBeDefined(); expect(j.velocidad).toEqual({ x: 0, y: 0 }); }
          else expect(r.eventos.some(e => e.tipo === "cambio" && e.jugador === j.id && e.tick > anterior.tick && e.tick <= f.tick)).toBe(true);
        }
      }
    }
    expect(r.final.tick * ARENA.pasoS).toBe(180);
  });
  it("reproducir detecta eventos, coordenadas, reloj y órdenes alterados", async () => {
    const r = await ejecutarArena(configCorta(), programados());
    for (const modificar of [
      (c: typeof r) => { c.final.marcador.local++; },
      (c: typeof r) => { c.fotogramas[0]!.jugadores[0]!.posicion.x++; },
      (c: typeof r) => { c.rondas[0]!.finTick++; },
      (c: typeof r) => { c.rondas[0]!.decisiones.local.ordenes.observacion = "falso"; },
    ]) { const copia = structuredClone(r); modificar(copia); expect(() => reproducirArena(copia)).toThrow(); }
  });
  it("alargar el escenario conserva los eventos y fotogramas del prefijo", async () => {
    const corto = await ejecutarArena(configCorta(), programados());
    const largo = await ejecutarArena(crearConfigArena({ duracionS: 20, intervaloS: 5 }), programados());
    expect(largo.fotogramas.filter(f => f.tick <= corto.final.tick)).toEqual(corto.fotogramas);
    expect(largo.eventos.filter(e => e.tick <= corto.final.tick)).toEqual(corto.eventos);
  });
  it("rechaza duraciones y frecuencias que exceden el presupuesto", () => {
    expect(() => crearConfigArena({ duracionS: ARENA.duracionMaxS + 1 })).toThrow();
    expect(() => crearConfigArena({ intervaloS: 0 })).toThrow();
    expect(() => crearConfigArena({ seed: NaN })).toThrow();
    const partido = configDeSemilla(42); partido.variantes = { lesiones: true };
    expect(() => crearConfigArena({ partido })).toThrow(/todavía no resuelve/);
  });
});

function escenarioPase(bloqueado: boolean, adelantado = false) {
  const config = crearConfigArena({ duracionS: 5, intervaloS: 5, version: ARENA.versionPersonalidades });
  const inicial = crearEstadoArena(config);
  for (const j of inicial.jugadores) { j.posicion = { x: j.lado === "local" ? 8 : adelantado ? 48 : 95, y: 5 }; j.nivel = 100; }
  const autor = inicial.jugadores.find(j => j.id === "local-5")!, receptor = inicial.jugadores.find(j => j.id === "local-6")!;
  autor.posicion = { x: 40, y: 34 }; receptor.posicion = { x: 60, y: 34 };
  if (bloqueado) inicial.jugadores.find(j => j.id === "visita-5")!.posicion = { x: 50, y: 34 };
  inicial.balon = { posicion: { ...autor.posicion }, poseedor: autor.id, vuelo: null };
  const motor = new MotorArena(config, inicial);
  const planes = Object.fromEntries(lados.map(lado => {
    const obs = observarArena(motor, lado), p = planProgramado(obs);
    p.ordenes = inicial.jugadores.filter(j => j.lado === lado).map(j => ({ jugador: j.id, accion: "mover", destino: { ...j.posicion }, receptor: null }));
    return [lado, p];
  })) as Record<"local" | "visita", OrdenesEquipo>;
  const orden = planes.local.ordenes.find(o => o.jugador === autor.id)!;
  orden.accion = "pasar"; orden.receptor = receptor.id; orden.destino = { ...receptor.posicion };
  return { motor, planes };
}
describe("Arena: resultados causados por la geometría", () => {
  it("el pase viaja antes de recibir y la oposición puede interceptarlo", () => {
    const libre = escenarioPase(false);
    libre.motor.avanzar(libre.planes, 1);
    expect(libre.motor.estado.balon.vuelo?.tipo).toBe("pase");
    expect(libre.motor.eventos.some(e => e.tipo === "recepcion")).toBe(false);
    libre.motor.avanzar(libre.planes, 15);
    expect(libre.motor.eventos.some(e => e.tipo === "recepcion" && e.jugador === "local-6")).toBe(true);
    const tapado = escenarioPase(true);
    tapado.motor.avanzar(tapado.planes, 15);
    expect(tapado.motor.eventos.some(e => e.tipo === "intercepcion" && e.jugador === "visita-5")).toBe(true);
    expect(tapado.motor.eventos.some(e => e.tipo === "recepcion" && e.jugador === "local-6")).toBe(false);
  });
  it("marca posición adelantada en el golpe y sanciona al intervenir", () => {
    const e = escenarioPase(false, true);
    expect(adelantados(e.motor.estado, "local")).toContain("local-6");
    expect(e.motor.eventos).toHaveLength(0);
    e.motor.avanzar(e.planes, 15);
    expect(e.motor.eventos.some(e => e.tipo === "fuera_juego")).toBe(true);
    expect(e.motor.eventos.some(e => e.tipo === "recepcion" && e.jugador === "local-6")).toBe(false);
  });
  it("un balón detenido conserva el fuera de juego pendiente hasta el contacto", () => {
    const e = escenarioPase(false, true);
    const receptor = e.motor.estado.jugadores.find(j => j.id === "local-6")!;
    receptor.posicion = { x: 65, y: 40 };
    e.motor.estado.balon = { posicion: { x: 60, y: 34 }, poseedor: null, vuelo: { tipo: "pase", autor: "local-5", lado: "local", receptor: receptor.id, origen: { x: 40, y: 34 }, destino: { x: 60, y: 34 }, inicioTick: 0, adelantados: [receptor.id] } };
    e.motor.avanzar(e.planes, 1);
    expect(e.motor.estado.balon.vuelo).not.toBeNull();
    e.motor.avanzar(e.planes, 30);
    expect(e.motor.eventos.some(e => e.tipo === "fuera_juego")).toBe(true);
  });
  it.each([false, true])("el tiro produce gol o atajada según la ubicación del portero: %s", porteroEnTrayectoria => {
    const e = escenarioPase(false), estado = e.motor.estado;
    const autor = estado.jugadores.find(j => j.id === "local-5")!;
    autor.posicion = { x: 90, y: 34 }; autor.nivel = 100;
    estado.jugadores.find(j => j.id === "local-6")!.posicion = { x: 8, y: 5 };
    const portero = estado.jugadores.find(j => j.id === "visita-0")!;
    portero.posicion = { x: 103, y: porteroEnTrayectoria ? 34 : 5 };
    estado.balon.posicion = { ...autor.posicion };
    e.planes.local.ordenes.find(o => o.jugador === autor.id)!.accion = "tirar";
    e.planes.visita.ordenes.find(o => o.jugador === portero.id)!.destino = { ...portero.posicion };
    e.motor.avanzar(e.planes, 10);
    expect(e.motor.eventos.some(e => e.tipo === "gol")).toBe(!porteroEnTrayectoria);
    expect(e.motor.eventos.some(e => e.tipo === "atajada")).toBe(porteroEnTrayectoria);
    expect(e.motor.estado.marcador.local).toBe(porteroEnTrayectoria ? 0 : 1);
    if (!porteroEnTrayectoria) expect(e.motor.eventos.find(e => e.tipo === "gol")!.hasta.x).toBe(ARENA.largoM);
  });
});

describe("Arena: costura de modelos", () => {
  it("valida JSON del LLM y transmite cancelación sin tocar el Writer", async () => {
    const obs = observarArena(new MotorArena(configCorta()), "local"), c = new AbortController();
    const completar = vi.fn<Llm["completar"]>(async (_, mensajes) => JSON.stringify(planProgramado(JSON.parse(mensajes[0]!.contenido))));
    const controlador = crearControladorLlm({ id: "fixture:solo-test", completar });
    expect(validarOrdenes(await controlador.decidir(obs, c.signal), obs).ordenes).toHaveLength(11);
    expect(completar.mock.calls[0]![2]?.signal).toBe(c.signal);
  });
  it("permite reutilizar el deployment o seleccionar otro por equipo", () => {
    const env = { CRONISTA_LLM: "azure-openai", AZURE_OPENAI_API_KEY: "prueba", AZURE_OPENAI_ENDPOINT: "https://ejemplo.openai.azure.com", AZURE_OPENAI_DEPLOYMENT: "a", ARENA_VISITA_AZURE_OPENAI_DEPLOYMENT: "b" };
    expect(crearLlmEquipoDesdeEnv("local", env).id).toBe("azure-openai:a");
    expect(crearLlmEquipoDesdeEnv("visita", env).id).toBe("azure-openai:b");
    expect(env.AZURE_OPENAI_DEPLOYMENT).toBe("a");
    expect(() => crearLlmEquipoDesdeEnv("local", { CRONISTA_LLM: "stub" })).toThrow();
  });
  it("el transporte Azure recibe la señal de aborto", async () => {
    const c = new AbortController();
    const transporte = vi.fn<typeof fetch>(async () => Response.json({ choices: [{ message: { content: "{}" }, finish_reason: "stop" }] }));
    const llm = crearLlmAzureOpenAI({ apiKey: "prueba", endpoint: "https://ejemplo.openai.azure.com", deployment: "a", fetch: transporte });
    await llm.completar("sistema", [], { signal: c.signal });
    expect(transporte.mock.calls[0]![1]?.signal).toBe(c.signal);
  });
});
