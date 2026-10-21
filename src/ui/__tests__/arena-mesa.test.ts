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
import { componerIntercambio, memoriaDialogoVacia } from "../../arena/dialogo";

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

// 048 · Fixture de la conversación: una ronda tras el gol del v4 y la forma final.
const v4 = JSON.parse(readFileSync("src/arena/__fixtures__/arena-reinicios-v4.json", "utf8")) as RegistroArena;
const gol = v4.eventos.find(e => e.tipo === "gol")!, T = gol.tick;
const pre: RegistroArena = { ...v4, eventos: v4.eventos.filter(e => e.tick <= T), fotogramas: v4.fotogramas.filter(f => f.tick <= T), final: [...v4.fotogramas].reverse().find(f => f.tick <= T)! };
const fiel = { id: "modelo-prueba", completar: async (_s: string, m: { contenido: string }[]) => { const c = JSON.parse(m[0]!.contenido) as { hechos: HechoVerificable[]; principal: string }, h = c.hechos.find(h => h.id === c.principal)!; return JSON.stringify({ oraciones: [{ texto_es: h.texto_es, texto_en: h.texto_en, hecho: h.id, apoyo: [] }] }); } };
const dato = datosEstadista(pre, T).find(d => d.tema === MESA_ARENA.dialogo.temasPorDisparador.gol[0])!;
const base = (await comentarArena(pre, T, fiel, { principal: `arena:${gol.id}`, tema: "gol" }))!;
const ronda = componerIntercambio({ intervencion: base, registro: pre, seed: v4.config.partido.seed, forma: "ronda", dato, memoria: memoriaDialogoVacia() }).intervencion;
const posterior = componerIntercambio({ intervencion: intervencionEstadista(datosEstadista(v4, v4.final.tick).filter(d => d.ocupaPlaza).slice(0, 1), v4.final.tick), registro: v4, seed: v4.config.partido.seed, forma: "final", memoria: memoriaDialogoVacia() }).intervencion;
const html = (tick: number, idioma: "es" | "en", lista: readonly IntervencionArena[] = [ronda, posterior]) => renderToStaticMarkup(createElement(ArenaMesa, { comentarios: [], intervenciones: lista, tick, idioma }));

describe("048 · Última conversación", () => {

  it("una `ronda`: roles en orden, nombres y `details` de plantilla y referencia", () => {
    expect(ronda.forma).toBe("ronda");
    for (const idioma of ["es", "en"] as const) {
      const h = html(T, idioma), bloque = h.slice(h.indexOf('data-testid="arena-mesa-dialogo"'), h.indexOf('data-testid="arena-mesa-narrador"'));
      expect(bloque.length).toBeGreaterThan(0);
      expect([...bloque.matchAll(/data-turno-rol="(\w+)"/g)].map(m => m[1])).toEqual(["narrador", "comentarista", "narrador", "estadista"]);
      expect([...bloque.matchAll(/data-turno-funcion="(\w+)"/g)].map(m => m[1])).toEqual(ronda.turnos!.map(t => t.funcion));
      for (const rol of ["narrador", "comentarista", "estadista"] as const) expect(bloque).toContain(MESA_ARENA.nombres[idioma][rol]);
      for (const t of ronda.turnos!) expect(bloque).toContain((idioma === "es" ? t.texto_es : t.texto_en).replace(/'/g, "&#x27;"));
      expect(bloque).toContain(`data-plantilla="${ronda.turnos![0]!.plantilla}"`);
      expect(bloque).toContain(`data-refiere="arena:${gol.id}"`);
      expect(bloque).toContain(`data-refiere="${dato.hecho.id}"`);
      // El texto del hecho referido acompaña a la referencia.
      const referido = ronda.hechos.find(x => x.id === `arena:${gol.id}`)!;
      expect(bloque).toContain(idioma === "es" ? referido.texto_es : referido.texto_en);
      // v1.2 (9) E04 · el texto del hecho referido está en el propio párrafo de la referencia.
      const parrafo = (id: string) => new RegExp(`<p data-refiere="${id}">[^<]*<strong>${id}</strong>([^<]*)</p>`).exec(bloque)?.[1];
      expect(parrafo(`arena:${gol.id}`)).toBe(` · ${idioma === "es" ? referido.texto_es : referido.texto_en}`.replace(/'/g, "&#x27;"));
      expect(parrafo(dato.hecho.id)).toBe(` · ${idioma === "es" ? dato.texto_es : dato.texto_en}`);
      expect(bloque).toContain(idioma === "es" ? "Última conversación" : "Latest exchange");
      expect(bloque).toContain(idioma === "es" ? "la voz puede emitir su versión breve" : "the voice may play its short version");
    }
  });

  it("ningún intercambio posterior al cursor; sin turnos no hay bloque", () => {
    expect(html(T - 1, "es")).not.toContain("arena-mesa-dialogo");
    expect(html(T, "es")).toContain(`data-dialogo-intervencion="${ronda.id}"`);
    expect(html(v4.final.tick - 1, "es")).not.toContain(`data-dialogo-intervencion="${posterior.id}"`);
    expect(html(v4.final.tick, "es")).toContain(`data-dialogo-intervencion="${posterior.id}"`);
    expect(html(T, "es", [{ ...ronda, turnos: undefined, turnosBreve: undefined, forma: undefined }])).not.toContain("arena-mesa-dialogo");
  });

  it("la tarjeta del estadista muestra el turno E de la `ronda`; la del comentarista no muestra la oración E", () => {
    const h = html(T, "es", [ronda]);
    const tarjeta = (rol: string) => { const ini = h.indexOf(`data-testid="arena-mesa-${rol}"`); return h.slice(ini, h.indexOf("</article>", ini)); };
    const e = ronda.oraciones[ronda.turnos!.find(t => t.rol === "estadista")!.oraciones[0]!]!;
    expect(tarjeta("estadista")).toContain(e.texto_es);
    expect(tarjeta("estadista")).toContain(`data-intervencion="${ronda.id}"`);
    expect(tarjeta("estadista")).toContain("Determinista");
    expect(tarjeta("comentarista")).not.toContain(e.texto_es);
    expect(tarjeta("comentarista")).toContain(ronda.oraciones[0]!.texto_es);
  });
});
