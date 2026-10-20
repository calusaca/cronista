import { expect, it } from "vitest";
import { contextoCompetitivo } from "../competencia";
import { crearControladorLlm, esquemaRespuestaArena, planProgramado, SISTEMA_ARENA } from "../controladores";
import { ejecutarArena, observarArena, reproducirArena } from "../coordinador";
import { crearControladorProgramado } from "../controladores";
import { crearConfigArena, MotorArena } from "../motor";
import type { ObservacionArena } from "../tipos";

it("el objetivo depende del marcador y del tiempo restante, con lectura pública del rival", () => {
  const motor = new MotorArena(crearConfigArena({ duracionS: 60, entorno: { clima: "calor", temperaturaC: 35 } }));
  motor.estado.tick = 300; motor.estado.marcador.visita = 1;
  const obs = observarArena(motor, "local"), c = contextoCompetitivo(obs);
  expect(c.situacion).toBe("perdiendo"); expect(c.segundosRestantes).toBe(30);
  expect(c.objetivo).toContain("Ganar"); expect(c.rival.lado).toBe("visita");
  expect(c.efectosActuales!.propios.corto.desgaste).toBeGreaterThan(1);
  expect(SISTEMA_ARENA).toContain("TU OBJETIVO ES GANAR");
});

it("el esquema de respuesta fija observación y lado y sitúa gestión en la raíz", () => {
  const motor = new MotorArena(crearConfigArena({ duracionS: 60 })), obs = observarArena(motor, "local");
  const schema = esquemaRespuestaArena(obs) as { required: string[]; properties: Record<string, unknown> };
  expect(schema.required).toContain("gestion");
  expect(schema.properties.observacion).toEqual({ type: "string", enum: [obs.id] });
  expect(schema.properties.lado).toEqual({ type: "string", enum: ["local"] });
});

it("cada controlador conserva solo su última propuesta válida y no recibe planes privados rivales", async () => {
  const vistos: Array<ObservacionArena & { ultimaPropuestaValidaPropia: { tick: number } | null; competencia: unknown }> = [];
  const modelo = { id: "prueba", completar: async (_s: string, mensajes: { contenido: string }[]) => {
    const obs = JSON.parse(mensajes[0]!.contenido) as typeof vistos[number]; vistos.push(obs);
    return JSON.stringify(planProgramado(obs));
  } };
  const local = crearControladorLlm(modelo), visita = crearControladorLlm(modelo);
  const motor = new MotorArena(crearConfigArena({ duracionS: 60 })), signal = new AbortController().signal;
  await local.decidir(observarArena(motor, "local"), signal);
  await visita.decidir(observarArena(motor, "visita"), signal);
  await local.decidir(observarArena(motor, "local"), signal);
  expect(vistos[0]!.ultimaPropuestaValidaPropia).toBeNull(); expect(vistos[1]!.ultimaPropuestaValidaPropia).toBeNull();
  expect(vistos[2]!.ultimaPropuestaValidaPropia?.tick).toBe(0);
  expect(JSON.stringify(vistos[1])).not.toContain("ultimaPropuestaValidaRival");
});

it("corrige una orden inválida dentro de la misma observación y registra ambas llamadas", async () => {
  let llamadas = 0;
  const controlador = crearControladorLlm({ id: "prueba", completar: async (_s, mensajes, opciones) => {
    llamadas++; const obs = JSON.parse(mensajes[0]!.contenido) as ObservacionArena;
    expect(opciones?.maxTokens).toBe(2048); expect(opciones?.esquema?.nombre).toBe("ordenes_arena");
    const plan = planProgramado(obs);
    if (llamadas === 1) plan.ordenes[0]!.jugador = "rival-no-autorizado";
    else expect(mensajes.at(-1)?.contenido).toContain(obs.id);
    return JSON.stringify(plan);
  } });
  const registro = await ejecutarArena(crearConfigArena({ duracionS: 2 }), { local: controlador, visita: crearControladorProgramado() });
  expect(registro.rondas[0]!.decisiones.local.origen).toBe("controlador");
  expect(registro.rondas[0]!.decisiones.local.llamadas).toBe(2);
  expect(reproducirArena(registro)).toEqual(registro);
});
