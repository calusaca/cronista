// Brief 065 § 3 · Duración por defecto de la web: el selector de `/arena` ofrece ARENA_WEB.duracionesS y abre con
// ARENA_WEB.duracionDefectoS; ese valor pasa por todas las validaciones de la web (directo y búfer, grabación sin IA).
// El torneo conserva su duración. Ninguna cifra se repite a mano.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ajustesArena, peticionSesion } from "../../arena/peticiones";
import type { RegistroArena } from "../../arena/tipos";
import { ARENA, ARENA_WEB, TORNEO_ARENA } from "../../sim/limites";
import { Arena } from "../Arena";

const inicial = JSON.parse(readFileSync("src/arena/__fixtures__/arena-reinicios-v3.json", "utf8")) as RegistroArena;

describe("065 § 3 · duración por defecto de la web", () => {
  it("el selector «Simulated duration» lista ARENA_WEB.duracionesS y abre con ARENA_WEB.duracionDefectoS (mutación: volver a useState(60); opción a mano)", () => {
    const html = renderToStaticMarkup(<Arena inicial={inicial} />);
    const select = /<label>Simulated duration<select[^>]*>(.*?)<\/select>/.exec(html)?.[1];
    expect(select).toBeDefined();
    const opciones = [...select!.matchAll(/<option value="(\d+)"( selected="")?>(\d+) s<\/option>/g)].map(m => ({ valor: Number(m[1]), elegida: !!m[2], texto: Number(m[3]) }));
    expect(opciones.map(o => o.valor)).toEqual([...ARENA_WEB.duracionesS]);
    expect(opciones.every(o => o.texto === o.valor)).toBe(true);
    expect(opciones.filter(o => o.elegida).map(o => o.valor)).toEqual([ARENA_WEB.duracionDefectoS]);
  });

  it("todas las opciones (y el valor por defecto) pasan las validaciones del directo, el búfer y la grabación sin IA; el torneo conserva su duración", () => {
    expect(ARENA_WEB.duracionesS).toContain(ARENA_WEB.duracionDefectoS);
    for (const segundos of ARENA_WEB.duracionesS) {
      expect(segundos).toBeLessThanOrEqual(ARENA.duracionMaxS);
      const ajustes = { seed: 42, segundos, local: "auto", visita: "auto" };
      expect(ajustesArena.safeParse(ajustes).success).toBe(true);
      for (const presentacion of ["buffer", "directo", "preparada"]) expect(peticionSesion.safeParse({ ...ajustes, presentacion, seleccion: { modo: "programado" } }).success).toBe(true);
    }
    expect(TORNEO_ARENA.duracionS).not.toBe(ARENA_WEB.duracionDefectoS);
  });
});
