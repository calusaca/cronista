// Brief 045 · Mesa de transmisión: tres tarjetas, rótulos ES/EN y nada posterior al cursor.
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HechoVerificable } from "../../cadena/verificador";
import { datosEstadista, intervencionEstadista } from "../../arena/estadista";
import { comentarArena } from "../../arena/narrador";
import type { IntervencionArena } from "../../arena/protocolo";
import type { RegistroArena } from "../../arena/tipos";
import { ARENA, MESA_ARENA } from "../../sim/limites";
import { ArenaMesa } from "../ArenaMesa";

const registro = JSON.parse(readFileSync("src/arena/__fixtures__/arena-reinicios-v3.json", "utf8")) as RegistroArena;
const temprano = 150, tardio = 300;
const conPlaza = (tick: number) => datosEstadista(registro, tick).filter(d => d.ocupaPlaza);
const intervenciones = [
  intervencionEstadista(conPlaza(temprano).slice(0, 1), temprano),
  intervencionEstadista(conPlaza(tardio).slice(1, 2), tardio),
  (await comentarArena(registro, temprano, undefined))!,
  { ...(await comentarArena(registro, tardio, undefined))!, id: "comentarista:tiempo:300" },
];
const mesa = (tick: number, idioma: "es" | "en", lista: readonly IntervencionArena[] = intervenciones) => renderToStaticMarkup(createElement(ArenaMesa, { comentarios: [], intervenciones: lista, tick, idioma }));

describe("045 · ArenaMesa", () => {
  it("muestra tres tarjetas con sus rótulos en ES y EN", () => {
    const es = mesa(tardio, "es"), en = mesa(tardio, "en");
    for (const rol of ["narrador", "comentarista", "estadista"] as const) {
      expect(es).toContain(`data-mesa-role="${rol}"`); expect(es).toContain(MESA_ARENA.nombres.es[rol]); expect(en).toContain(MESA_ARENA.nombres.en[rol]);
    }
    expect(es).toContain("Mesa de transmisión"); expect(en).toContain("Broadcast desk");
    for (const r of ["relato", "análisis con hechos citados", "dato del partido"]) expect(es).toContain(r);
    for (const r of ["play-by-play", "analysis with cited facts", "match data"]) expect(en).toContain(r);
    expect(es).toContain("Determinista"); expect(es).toContain("Respaldo por plantilla"); expect(en).toContain("Template fallback");
    expect(es).toContain("Consultar hechos y verificaciones");
  });

  it("nunca muestra una intervención posterior al cursor visible", () => {
    for (const cursor of [temprano - 1, temprano, tardio - 1, tardio]) {
      const html = mesa(cursor, "es"), ticks = [...html.matchAll(/data-intervencion-tick="(\d+)"/g)].map(m => Number(m[1]));
      expect(ticks.every(t => t <= cursor)).toBe(true);
      expect(ticks.length).toBe(intervenciones.filter(i => i.tick <= cursor).length ? new Set(intervenciones.filter(i => i.tick <= cursor).map(i => i.rol)).size : 0);
    }
    const tarde = mesa(tardio, "es");
    expect(tarde).toContain('data-intervencion="comentarista:tiempo:300"');
    expect(tarde).toContain(`${(tardio * ARENA.pasoS).toFixed(1)} s`);
    expect(mesa(temprano - 1, "es")).not.toContain("data-intervencion=");
  });

  it("C7 · la tarjeta del comentarista lista por oración los hechos citados y la procedencia de los datos del estadista", async () => {
    const tick = registro.final.tick, datos = datosEstadista(registro, tick);
    const dato = datos.find(d => d.tema === "cambios") ?? datos.find(d => d.tema === "reloj")!;
    const i = (await comentarArena(registro, tick, { id: "modelo-prueba", completar: async (_s, m) => {
      const c = JSON.parse(m[0]!.contenido) as { hechos: HechoVerificable[]; principal: string }, h = c.hechos.find(h => h.id === c.principal)!;
      return JSON.stringify({ oraciones: [{ texto_es: h.texto_es, texto_en: h.texto_en, hecho: h.id, apoyo: [dato.hecho.id] }] });
    } }))!;
    expect(i.modo).toBe("llm");
    for (const idioma of ["es", "en"] as const) {
      const html = mesa(tick, idioma, [i]);
      expect(html).toContain("fotograma:");
      expect(html).toContain(dato.evidencia.fuente!);
      expect(html).toContain(idioma === "es" ? dato.texto_es : dato.texto_en);
      expect(html).toContain(`data-hecho-citado="${dato.hecho.id}"`);
      expect(html).toContain(`data-hecho-citado="${i.oraciones[0]!.hecho}"`);
    }
  });
});
