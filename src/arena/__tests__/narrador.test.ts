import { expect, it } from "vitest";
import { crearControladorProgramado } from "../controladores";
import { ejecutarArena } from "../coordinador";
import { crearConfigArena } from "../motor";
import { contextoNarradorArena, narrarArena } from "../narrador";
import { verificarUpdate } from "../../cadena/verificador";
import type { HechoVerificable } from "../../cadena/verificador";
import type { Mensaje } from "../../lib/llm";

const registro = await ejecutarArena(crearConfigArena({ duracionS: 60 }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
function respuesta(mensajes: Mensaje[]) {
  const ctx = JSON.parse(mensajes[0]!.contenido) as { hechos: HechoVerificable[]; principal: string };
  const h = ctx.hechos.find(h => h.id === ctx.principal)!;
  return { oraciones: [{ texto_es: h.texto_es, texto_en: h.texto_en, hecho: h.id, apoyo: [] }] };
}

it("el contexto del narrador solo contiene hechos disponibles en ese instante", () => {
  const hechos = contextoNarradorArena(registro, 100);
  const ids = new Set(registro.eventos.filter(e => e.tick <= 100).map(e => e.id));
  expect(hechos.length).toBeGreaterThan(0);
  expect(hechos.every(h => h.eventos.every(id => ids.has(id)))).toBe(true);
});

it("el comentario aprobado usa el mismo verificador y conserva la evidencia", async () => {
  const c = await narrarArena(registro, 200, { id: "modelo-prueba", completar: async (_s, mensajes) => JSON.stringify(respuesta(mensajes)) });
  expect(c?.modo).toBe("llm"); expect(c?.audit).toHaveLength(1);
  expect(c?.audit[0]?.motivos).toEqual([]);
  expect(verificarUpdate(JSON.stringify({ oraciones: c!.oraciones }), c!.hechos, { config: registro.config.partido }, c!.principal, 2).motivos).toEqual([]);
});

it("una cifra inventada recibe feedback y un segundo intento corrige el comentario", async () => {
  let llamadas = 0;
  const c = await narrarArena(registro, 200, { id: "modelo-prueba", completar: async (_s, mensajes) => {
    const r = respuesta(mensajes); llamadas++;
    if (llamadas === 1) { r.oraciones[0]!.texto_es += " Fueron 999 pases."; r.oraciones[0]!.texto_en += " There were 999 passes."; }
    else expect(mensajes.at(-1)?.contenido).toContain("V3");
    return JSON.stringify(r);
  } });
  expect(c?.modo).toBe("llm"); expect(llamadas).toBe(2);
  expect(c?.audit[0]?.motivos.some(m => m.regla === "V3")).toBe(true);
  expect(c?.oraciones.some(o => o.texto_es.includes("999"))).toBe(false);
});

it("una cita futura nunca se publica y activa el respaldo verificado", async () => {
  const c = await narrarArena(registro, 200, { id: "modelo-prueba", completar: async (_s, mensajes) => {
    const r = respuesta(mensajes); r.oraciones[0]!.hecho = "arena:futuro"; return JSON.stringify(r);
  } });
  expect(c?.modo).toBe("plantilla"); expect(c?.audit).toHaveLength(2);
  expect(c?.audit.every(a => a.motivos.some(m => m.regla === "V2"))).toBe(true);
  expect(c?.oraciones[0]?.hecho).toBe(c?.principal);
});

it("el plazo del narrador no depende de que el transporte atienda AbortSignal", async () => {
  const c = await narrarArena(registro, 200, { id: "modelo-lento", completar: () => new Promise(() => {}) }, { esperaMs: 5 });
  expect(c?.modo).toBe("plantilla"); expect(c?.audit[0]?.motivos[0]?.regla).toBe("V1");
});
