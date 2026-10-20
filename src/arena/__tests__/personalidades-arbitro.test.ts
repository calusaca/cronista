import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ARBITRO_ARENA, ARENA, PERSONALIDAD_ARENA } from "../../sim/limites";
import { configDeSemilla } from "../../sim/plantillas";
import { crearControladorLlm, crearControladorProgramado, planProgramado, validarOrdenes } from "../controladores";
import { ejecutarArena, observarArena, reproducirArena } from "../coordinador";
import { distancia } from "../geometria";
import { crearConfigArena as crearConfigBase, crearEstadoArena, MotorArena } from "../motor";
import { estadoVisual } from "../vista";
import type { Llm } from "../../lib/llm";
import type { ObservacionArena, PersonalidadJugador } from "../tipos";

const programados = () => ({ local: crearControladorProgramado(), visita: crearControladorProgramado() });
// Esta batería conserva el contrato v2; la gestión v3 tiene sus propios escenarios.
const crearConfigArena = (opciones: Parameters<typeof crearConfigBase>[0] = {}) => crearConfigBase({ ...opciones, version: ARENA.versionPersonalidades });
const perfil = (cambios: Partial<PersonalidadJugador> = {}): PersonalidadJugador => ({
  perfil: "equilibrado", defensiva: 50, ofensiva: 50, pase: 50, conduccion: 50, remate: 50,
  agresividad: 50, disciplina: 50, compostura: 50, liderazgo: 50, ...cambios,
});
function observacionPrueba(): ObservacionArena {
  const obs = structuredClone(observarArena(new MotorArena(crearConfigArena({ duracionS: 5 })), "local"));
  for (const j of obs.estado.jugadores) {
    j.posicion = { x: j.lado === "local" ? 5 : 100, y: j.lado === "local" ? 5 : 65 };
    j.velocidad = { x: 0, y: 0 }; j.personalidad = perfil();
  }
  const portador = obs.estado.jugadores.find(j => j.id === "local-5")!;
  portador.posicion = { x: 85, y: 34 };
  obs.estado.jugadores.find(j => j.id === "local-6")!.posicion = { x: 92, y: 45 };
  obs.estado.balon = { posicion: { ...portador.posicion }, poseedor: portador.id, vuelo: null };
  return obs;
}

describe("Arena v2: personalidades y capitanía", () => {
  it("genera perfiles combinables y un capitán por lado, sin cambiar el partido de origen", () => {
    const partido = configDeSemilla(42), antes = JSON.stringify(partido);
    const estado = crearEstadoArena(crearConfigArena({ partido }));
    expect(JSON.stringify(partido)).toBe(antes);
    expect(estado.jugadores).toHaveLength(22);
    for (const lado of ["local", "visita"] as const) {
      const propios = estado.jugadores.filter(j => j.lado === lado);
      const capitanes = propios.filter(j => j.capitan);
      expect(capitanes).toHaveLength(1);
      expect(capitanes[0]!.personalidad!.liderazgo).toBe(Math.max(...propios.map(j => j.personalidad!.liderazgo)));
      expect(new Set(propios.map(j => JSON.stringify(j.personalidad))).size).toBe(11);
    }
    for (const j of estado.jugadores) for (const [clave, valor] of Object.entries(j.personalidad!)) {
      if (clave === "perfil") continue;
      expect(Number.isInteger(valor)).toBe(true);
      expect(valor).toBeGreaterThanOrEqual(PERSONALIDAD_ARENA.min);
      expect(valor).toBeLessThanOrEqual(PERSONALIDAD_ARENA.max);
    }
  });
  it("conserva la identidad del mismo jugador al cambiar formación, semilla de partido y lado", () => {
    const partido = configDeSemilla(42);
    const a = crearEstadoArena(crearConfigArena({ partido }));
    const b = crearEstadoArena(crearConfigArena({ partido: { ...partido, seed: 78, local: partido.visita, visita: partido.local }, local: "4-4-2", visita: "4-4-2" }));
    for (const j of a.jugadores) {
      const otro = b.jugadores.find(p => p.nombre === j.nombre)!;
      expect(otro.personalidad).toEqual(j.personalidad);
      expect(otro.capitan).toBe(j.capitan);
    }
  });
  it("un pasador cede el balón y un rematador tira desde la misma oportunidad", () => {
    const obs = observacionPrueba(), portador = obs.estado.jugadores.find(j => j.id === "local-5")!;
    portador.personalidad = perfil({ perfil: "pasador", pase: 100, conduccion: 0, remate: 0 });
    expect(planProgramado(obs).ordenes.find(o => o.jugador === portador.id)!.accion).toBe("pasar");
    portador.personalidad = perfil({ perfil: "rematador", pase: 100, conduccion: 0, remate: 100 });
    expect(planProgramado(obs).ordenes.find(o => o.jugador === portador.id)!.accion).toBe("tirar");
    portador.personalidad = perfil({ perfil: "conductor", pase: 0, conduccion: 100, remate: 0 });
    expect(planProgramado(obs).ordenes.find(o => o.jugador === portador.id)!.accion).toBe("conducir");
  });
  it("la agresividad permite ofrecerse a presionar desde algo más lejos", () => {
    const obs = observacionPrueba(); obs.estado.balon.poseedor = "visita-5";
    const cerca = obs.estado.jugadores.find(j => j.id === "local-5")!, intenso = obs.estado.jugadores.find(j => j.id === "local-6")!;
    cerca.posicion = { x: 77, y: 34 }; cerca.personalidad = perfil({ agresividad: 0 });
    intenso.posicion = { x: 73, y: 34 }; intenso.personalidad = perfil({ agresividad: 100 });
    expect(planProgramado(obs).ordenes.find(o => o.accion === "presionar")!.jugador).toBe(intenso.id);
    intenso.personalidad.agresividad = 0;
    expect(planProgramado(obs).ordenes.find(o => o.accion === "presionar")!.jugador).toBe(cerca.id);
  });
  it("respeta una orden explícita de pase cerca del arco y entrega perfiles al modelo", async () => {
    const obs = observacionPrueba(), config = crearConfigArena({ duracionS: 5 });
    const motor = new MotorArena(config, obs.estado);
    const local = planProgramado(obs), visita = planProgramado({ ...obs, lado: "visita" });
    const orden = local.ordenes.find(o => o.jugador === "local-5")!;
    orden.accion = "pasar"; orden.receptor = "local-6";
    motor.avanzar({ local, visita }, 1);
    expect(motor.eventos[0]!.tipo).toBe("pase");
    const completar = vi.fn<Llm["completar"]>(async (_, mensajes) => JSON.stringify(planProgramado(JSON.parse(mensajes[0]!.contenido))));
    await crearControladorLlm({ id: "fixture", completar }).decidir(observarArena(motor, "local"), new AbortController().signal);
    const recibido = JSON.parse(completar.mock.calls[0]![1][0]!.contenido) as ObservacionArena;
    expect(recibido.estado.jugadores.every(j => !!j.personalidad)).toBe(true);
    expect(recibido.estado.jugadores.filter(j => j.capitan)).toHaveLength(2);
    const invalidas = planProgramado(recibido); invalidas.ordenes[0]!.jugador = "arbitro";
    expect(() => validarOrdenes(invalidas, recibido)).toThrow();
  });
});

describe("Arena v2: árbitro y archivos versionados", () => {
  it("mueve un árbitro separado, con velocidad acotada, y reproduce todos sus estados", async () => {
    const r = await ejecutarArena(crearConfigArena({ duracionS: 30, intervaloS: 5 }), programados());
    expect(r.version).toBe(ARENA.versionPersonalidades);
    expect(r.inicial.arbitro!.id).toBe("arbitro");
    expect(r.final.arbitro!.posicion).not.toEqual(r.inicial.arbitro!.posicion);
    for (const [i, f] of r.fotogramas.entries()) {
      expect(f.jugadores).toHaveLength(22);
      expect(f.jugadores.some(j => j.id === f.arbitro!.id)).toBe(false);
      const a = f.arbitro!;
      expect(Math.hypot(a.velocidad.x, a.velocidad.y)).toBeLessThanOrEqual(ARBITRO_ARENA.velocidadMps + 1e-9);
      expect(a.posicion.x).toBeGreaterThanOrEqual(0); expect(a.posicion.x).toBeLessThanOrEqual(ARENA.largoM);
      expect(a.posicion.y).toBeGreaterThanOrEqual(0); expect(a.posicion.y).toBeLessThanOrEqual(ARENA.anchoM);
      if (i) {
        const anterior = r.fotogramas[i - 1]!;
        expect(distancia(a.posicion, anterior.arbitro!.posicion)).toBeLessThanOrEqual(ARBITRO_ARENA.velocidadMps * (f.tick - anterior.tick) * ARENA.pasoS + 1e-9);
      }
    }
    expect(reproducirArena(JSON.parse(JSON.stringify(r))).fotogramas).toEqual(r.fotogramas);
    const v = estadoVisual(r, 1.25), a = r.fotogramas[2]!.arbitro!, b = r.fotogramas[3]!.arbitro!;
    expect(v.arbitro!.posicion.x).toBeCloseTo((a.posicion.x + b.posicion.x) / 2);
    expect(estadoVisual(r, 1.25, true)).toEqual(r.fotogramas[2]);
    const alterado = structuredClone(r); alterado.fotogramas[2]!.arbitro!.posicion.x++;
    expect(() => reproducirArena(alterado)).toThrow(/registro/);
    const otro = structuredClone(r); otro.inicial.jugadores[0]!.personalidad!.pase++;
    expect(() => reproducirArena(otro)).toThrow(/inicial/);
  });
  it("el árbitro visual no altera las acciones ni el resultado", () => {
    const config = crearConfigArena({ duracionS: 10, intervaloS: 5 });
    const a = new MotorArena(config), inicial = crearEstadoArena(config); delete inicial.arbitro;
    const b = new MotorArena(config, inicial);
    for (const motor of [a, b]) for (const hasta of [50, 100]) {
      motor.avanzar({ local: planProgramado(observarArena(motor, "local")), visita: planProgramado(observarArena(motor, "visita")) }, hasta);
    }
    expect(a.eventos).toEqual(b.eventos);
    expect(a.estado.jugadores).toEqual(b.estado.jugadores);
    expect(a.estado.balon).toEqual(b.estado.balon);
  });
  it("reproduce el ejemplo real v1 sin añadir personalidades, capitanes ni árbitro", () => {
    const archivo = JSON.parse(readFileSync("public/experimentos/arena-llm-v1.json", "utf8"));
    const r = reproducirArena(archivo);
    expect(r).toEqual(archivo);
    expect(r.inicial).not.toHaveProperty("arbitro");
    expect(r.inicial.jugadores.every(j => j.personalidad === undefined && j.capitan === undefined)).toBe(true);
    const alterado = structuredClone(archivo); alterado.version = ARENA.version;
    expect(() => reproducirArena(alterado)).toThrow(/versión/);
  });
  it("reproduce el registro v2 archivado antes de incorporar entrenadores", () => {
    const archivo = JSON.parse(readFileSync("src/arena/__fixtures__/arena-v2.json", "utf8"));
    expect(reproducirArena(archivo)).toEqual(archivo);
  });
});
