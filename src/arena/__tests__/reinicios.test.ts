import { describe, expect, it } from "vitest";
import { crearConfigArena, crearEstadoArena, MotorArena, validarConfigArena } from "../motor";
import { observarArena } from "../coordinador";
import { planProgramado } from "../controladores";
import { cruceDeBanda } from "../reinicios";
import { distancia } from "../geometria";
import { transformar } from "../catalogo";
import { estadoVisual, narrarEventoArena } from "../vista";
import { lados, type OrdenesEquipo, type Punto, type RegistroArena } from "../tipos";
import type { Lado } from "../../sim/tipos";
import { readFile } from "node:fs/promises";
import { reproducirArena } from "../coordinador";
import { formaciones } from "../tipos";

function salida(desde: Punto, destino: Punto, ultimo: Lado, reinicio?: "banda" | "esquina") {
  const config = crearConfigArena({ seed: 7, duracionS: 10, intervaloS: 5 });
  const inicial = crearEstadoArena(config);
  inicial.saque = null; inicial.pausa = null; // Escenario de balón ya en juego.
  for (const j of inicial.jugadores) { j.posicion = { x: j.lado === "local" ? 45 : 65, y: 55 }; j.velocidad = { x: 0, y: 0 }; }
  const autor = inicial.jugadores.find(j => j.lado === ultimo && j.puesto !== "POR")!;
  inicial.balon = { posicion: desde, poseedor: null, ultimoToque: { jugador: autor.id, lado: ultimo }, vuelo: { tipo: "pase", autor: autor.id, lado: ultimo, receptor: null, origen: desde, destino, inicioTick: 0, adelantados: [], ...(reinicio ? { reinicio } : {}) } };
  const motor = new MotorArena(config, inicial);
  const planes = Object.fromEntries(lados.map(lado => {
    const p = planProgramado(observarArena(motor, lado));
    p.ordenes = inicial.jugadores.filter(j => j.lado === lado).map(j => ({ jugador: j.id, accion: "mover", destino: j.posicion, receptor: null }));
    return [lado, p];
  })) as Record<Lado, OrdenesEquipo>;
  motor.avanzar(planes, 1);
  return { motor, planes, autor };
}

describe("Reanudaciones por salida real del balón", () => {
  it.each(formaciones)("el inicio en %s conserva el punto central hasta el primer toque", formacion => {
    const motor = new MotorArena(crearConfigArena({ local: formacion, duracionS: 5 }));
    const saque = motor.estado.saque!;
    expect(saque).toMatchObject({ tipo: "centro", lado: "local", punto: { x: 52.5, y: 34 } });
    for (const j of motor.estado.jugadores) {
      if (j.id === saque.ejecutor) continue;
      expect(transformar(j.posicion, j.lado).x).toBeLessThanOrEqual(52.5);
      if (j.lado === "visita") expect(distancia(j.posicion, saque.punto)).toBeGreaterThanOrEqual(9.15);
    }
    const planes = Object.fromEntries(lados.map(lado => [lado, planProgramado(observarArena(motor, lado))])) as Record<Lado, OrdenesEquipo>;
    for (let tick = 1; tick <= saque.hastaTick; tick++) {
      motor.avanzar(planes, tick);
      expect(motor.estado.balon.posicion).toEqual({ x: 52.5, y: 34 });
      expect(motor.eventos.some(e => e.tipo === "pase")).toBe(false);
    }
    motor.avanzar(planes, saque.hastaTick + 1);
    expect(motor.eventos.find(e => e.tipo === "pase")).toMatchObject({ reinicio: "centro", lado: "local", desde: { x: 52.5, y: 34 } });
  });

  it("reproduce exactamente los saques v1 publicados antes del saque inicial", async () => {
    const registro = JSON.parse(await readFile("src/arena/__fixtures__/arena-reinicios-v1.json", "utf8"));
    expect(registro.config.reglas).toBe("reinicios-v1");
    expect(reproducirArena(registro)).toEqual(registro);
  });
  it("reproduce exactamente los registros v2 (desvío del portero y sustitución con forma objeto)", async () => {
    const registro = JSON.parse(await readFile("src/arena/__fixtures__/arena-reinicios-v2.json", "utf8"));
    expect(registro.config.reglas).toBe("reinicios-v2");
    expect(registro.eventos.some((e: { tipo: string; motivo?: string }) => e.tipo === "atajada" && e.motivo === "desvio")).toBe(true);
    expect(registro.rondas.some((r: RegistroArena["rondas"][number]) => lados.some(l => { const s = r.decisiones[l].ordenes.gestion?.sustitucion; return !!s && !Array.isArray(s); }))).toBe(true);
    expect(reproducirArena(registro)).toEqual(registro);
  });
  it("detecta la primera línea cruzada y exige salir del campo", () => {
    expect(cruceDeBanda({ x: 104, y: 67 }, { x: 108, y: 69 })).toMatchObject({ borde: "fondo", punto: { x: 105, y: 67.5 } });
    expect(cruceDeBanda({ x: 104, y: 67 }, { x: 106, y: 71 })).toMatchObject({ borde: "lateral", punto: { x: 104.5, y: 68 } });
    expect(cruceDeBanda({ x: 20, y: 1 }, { x: 20, y: 0 })).toBeNull();
    expect(cruceDeBanda({ x: 20, y: 0 }, { x: 20, y: -.1 })).toMatchObject({ borde: "lateral", punto: { x: 20, y: 0 } });
  });

  it.each(["local", "visita"] as const)("tras gol de %s saca el rival desde el centro, con sus compañeros en su mitad", ataca => {
    const defiende = ataca === "local" ? "visita" : "local", x = ataca === "local" ? 104.9 : .1;
    const { motor, planes } = salida({ x, y: 34 }, { x: ataca === "local" ? 106 : -1, y: 34 }, ataca);
    const estado = motor.estado, saque = estado.saque!;
    expect(estado.marcador[ataca]).toBe(1);
    expect(saque).toMatchObject({ tipo: "centro", lado: defiende, punto: { x: 52.5, y: 34 } });
    expect(estado.balon.posicion).toEqual(saque.punto);
    for (const j of estado.jugadores) {
      if (j.id === saque.ejecutor) continue;
      expect(transformar(j.posicion, j.lado).x).toBeLessThanOrEqual(52.5);
      if (j.lado === ataca) expect(distancia(j.posicion, saque.punto)).toBeGreaterThanOrEqual(9.15);
    }
    motor.avanzar(planes, saque.hastaTick);
    expect(motor.eventos.some(e => e.tipo === "pase")).toBe(false);
    motor.avanzar(planes, saque.hastaTick + 1);
    expect(motor.eventos.find(e => e.tipo === "pase")).toMatchObject({ reinicio: "centro", lado: defiende, jugador: saque.ejecutor, desde: { x: 52.5, y: 34 } });
    expect(motor.estado.saque).toBeNull();
  });

  it.each([0, 68])("saque de banda en y=%s para el rival del último toque", y => {
    const { motor, planes, autor } = salida({ x: 25, y: y === 0 ? .1 : 67.9 }, { x: 25, y: y === 0 ? -1 : 69 }, "local");
    const saque = motor.estado.saque!;
    expect(saque).toMatchObject({ tipo: "banda", lado: "visita", punto: { x: 25, y } });
    expect(motor.eventos[0]).toMatchObject({ tipo: "reinicio", reinicio: "banda", ultimoToque: autor.id });
    for (const j of motor.estado.jugadores.filter(j => j.lado === "local")) expect(distancia(j.posicion, saque.punto)).toBeGreaterThanOrEqual(2);
    motor.avanzar(planes, saque.hastaTick + 1);
    expect(motor.eventos.find(e => e.tipo === "pase")).toMatchObject({ reinicio: "banda", lado: "visita" });
    expect(motor.estado.balon.vuelo?.adelantados).toEqual([]);
  });

  it.each([0, 105])("esquina tras último toque defensor y meta tras toque atacante en x=%s", x => {
    const defiende = x === 0 ? "local" : "visita", ataca = x === 0 ? "visita" : "local";
    for (const y of [8, 60]) {
      const origen = { x: x === 0 ? .1 : 104.9, y }, destino = { x: x === 0 ? -1 : 106, y };
      const esquina = salida(origen, destino, defiende).motor;
      expect(esquina.estado.saque).toMatchObject({ tipo: "esquina", lado: ataca, punto: { x: x === 0 ? .3 : 104.7, y: y === 8 ? .3 : 67.7 } });
      for (const j of esquina.estado.jugadores.filter(j => j.lado === defiende)) expect(distancia(j.posicion, esquina.estado.saque!.punto)).toBeGreaterThanOrEqual(9.15);
      const meta = salida(origen, destino, ataca).motor;
      expect(meta.estado.saque).toMatchObject({ tipo: "meta", lado: defiende, punto: { x: x === 0 ? 5.5 : 99.5, y: 34 } });
      expect(meta.estado.jugadores.find(j => j.id === meta.estado.saque!.ejecutor)?.puesto).toBe("POR");
    }
  });

  it("un saque de banda directo a la portería no cuenta como gol", () => {
    const { motor } = salida({ x: 104.9, y: 34 }, { x: 106, y: 34 }, "local", "banda");
    expect(motor.estado.marcador).toEqual({ local: 0, visita: 0 });
    expect(motor.estado.saque).toMatchObject({ tipo: "meta", lado: "visita" });
  });

  it("corta la colocación visual del saque y lo describe en ambos idiomas", () => {
    const { motor } = salida({ x: 104.9, y: 34 }, { x: 106, y: 34 }, "local");
    const r = { config: motor.config, inicial: motor.fotogramas[0], final: motor.estado, fotogramas: motor.fotogramas, eventos: motor.eventos, rondas: [] } as unknown as RegistroArena;
    expect(estadoVisual(r, .05).jugadores).toEqual(r.inicial.jugadores);
    const e = motor.eventos.find(e => e.tipo === "reinicio")!;
    expect(narrarEventoArena(e, r, "es")).toContain("Saque de centro");
    expect(narrarEventoArena(e, r, "en")).toContain("Kick-off");
    expect(estadoVisual(r, .1).balon.posicion).toEqual({ x: 52.5, y: 34 });
  });

  it("las reglas nuevas son explícitas; los archivos sin marca conservan el motor anterior", () => {
    // Brief 063 § 3.3: la predeterminada de la publicación 1 es reinicios-v6 (literal).
    const config = crearConfigArena(); expect(config.reglas).toBe("reinicios-v6");
    delete config.reglas; expect(() => validarConfigArena(config)).not.toThrow();
    expect(() => validarConfigArena({ ...config, reglas: "otra" as never })).toThrow("Reglas");
  });
});
