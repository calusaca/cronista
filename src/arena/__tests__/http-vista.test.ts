import { expect, it } from "vitest";
import { POST } from "../../app/api/arena/route";
import { crearControladorProgramado } from "../controladores";
import { ejecutarArena } from "../coordinador";
import { crearConfigArena } from "../motor";
import { estadoVisual, narrarEventoArena } from "../vista";

const pedir = (p: unknown) => POST(new Request("http://localhost/api/arena", { method: "POST", body: JSON.stringify(p) }));
it("HTTP permite ejecutar políticas y verificar archivos, sin habilitar inferencia", async () => {
  const respuesta = await pedir({ accion: "simular", seed: 42, segundos: 5, local: "4-3-3", visita: "4-4-2" });
  expect(respuesta.status).toBe(200);
  const registro = await respuesta.json();
  expect(registro.rondas[0].decisiones.local.tipo).toBe("programado");
  expect((await pedir({ accion: "reproducir", registro })).status).toBe(200);
  registro.final.marcador.local++;
  expect((await pedir({ accion: "reproducir", registro })).status).toBe(400);
  expect((await pedir({ accion: "simular", seed: 42, segundos: 5, local: "4-3-3", visita: "4-4-2", modo: "llm" })).status).toBe(400);
});
it("la vista interpola jugadores sin modificar el registro y ofrece estados discretos", async () => {
  const registro = await ejecutarArena(crearConfigArena({ duracionS: 5 }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
  const antes = JSON.stringify(registro);
  const f = estadoVisual(registro, 2.25), discreto = estadoVisual(registro, 2.25, true);
  expect(f.jugadores[1]!.posicion).not.toEqual(discreto.jugadores[1]!.posicion);
  expect(discreto).toEqual(registro.fotogramas.find(f => f.tick === 20));
  expect(JSON.stringify(registro)).toBe(antes);
  const pase = registro.eventos.find(e => e.tipo === "pase")!;
  expect(narrarEventoArena(pase, registro, "es")).toContain("intenta");
  expect(narrarEventoArena(pase, registro, "en")).toContain("attempts");
  const ejemplo = structuredClone(registro);
  ejemplo.eventos = [{ ...pase, tipo: "gol", tick: 3, lado: "local" }];
  expect(estadoVisual(ejemplo, 0.2).marcador.local).toBe(0);
  expect(estadoVisual(ejemplo, 0.3).marcador.local).toBe(1);
});
