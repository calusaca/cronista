// Brief 007 — modo Analista: la misma crónica con los datos duros expuestos.
// «Aficionado ↔ Analista no dispara llamadas LLM»: se prueba espiando la costura.
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import { generarCronica } from "../../cadena/cadena";
import type { Llm, Mensaje } from "../../lib/llm";
import { crearLlmStub } from "../../lib/llm-stub";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import { eventosDeOracion, hechosDeOracion, historiaDeOracion } from "../evidencia";
import { datosDuros, hechosNoUsados } from "../modoAnalista";

const p = simular(configDeSemilla(246));

/** La costura espiada: cuenta cada llamada al LLM. */
function espia(): Llm & { llamadas: number } {
  const stub = crearLlmStub();
  const e = {
    id: "stub",
    llamadas: 0,
    async completar(system: string, mensajes: Mensaje[]) {
      e.llamadas++;
      return stub.completar(system, mensajes);
    },
  };
  return e;
}

describe("modo Analista", () => {
  it("renderizar Aficionado y Analista sobre la misma crónica NO llama al LLM (costura espiada)", async () => {
    const llm = espia();
    const { cronica, hechos } = await generarCronica(p, { llm });
    expect(llm.llamadas).toBe(1);
    const antes = JSON.stringify(cronica);
    // Todo lo que el modo Analista calcula, para cada frase y para el pie:
    for (let i = 0; i < cronica.oraciones.length; i++) {
      const h = hechos.find((x) => x.id === cronica.oraciones[i]!.hecho)!;
      datosDuros(h);
      eventosDeOracion(cronica, hechos, i);
      historiaDeOracion(cronica, i);
    }
    hechosNoUsados(cronica, hechos);
    expect(llm.llamadas).toBe(1);
    // Y no cambia nada de la crónica (los números entre modos son los mismos por construcción).
    expect(JSON.stringify(cronica)).toBe(antes);
  });

  it("xG por frase: cada gol expone su xG, igual al del hecho", () => {
    for (const h of analizar(p).filter((x) => x.tipo === "gol_anotado")) {
      const xg = datosDuros(h).find((d) => d.esXg);
      expect(xg?.valor).toBe(h.datos.xg);
    }
  });

  it("los valores internos se muestran en palabras (nada de «doble_amarilla» en pantalla)", () => {
    const e = analizar(p).find((h) => h.tipo === "expulsion_y_efecto")!;
    expect(datosDuros(e).find((d) => d.clave === "motivo")?.valor).toBe("second yellow");
    const pen = analizar(p).find((h) => h.tipo === "gol_anotado" && h.datos.penal === "si")!;
    expect(datosDuros(pen).find((d) => d.clave === "penal")?.valor).toBe("yes");
  });

  it("la justicia xG expone el xG de ambos equipos; el portero, el xG atajado", () => {
    const hs = analizar(p);
    expect(datosDuros(hs.find((h) => h.tipo === "justicia_xg")!).filter((d) => d.esXg)).toHaveLength(2);
    expect(datosDuros(hs.find((h) => h.tipo === "portero_destacado")!).some((d) => d.clave === "xg_atajado")).toBe(true);
  });

  it("hechos no usados = los que no son principal ni apoyo de ninguna frase", async () => {
    const { cronica, hechos } = await generarCronica(p, { llm: crearLlmStub() });
    const recortada = { ...cronica, oraciones: cronica.oraciones.slice(0, 5) };
    const usados = new Set(recortada.oraciones.flatMap(hechosDeOracion));
    expect(hechosNoUsados(recortada, hechos).map((h) => h.id)).toEqual(hechos.filter((h) => !usados.has(h.id)).map((h) => h.id));
    expect(hechosNoUsados(cronica, hechos)).toEqual([]);
  });
});
