// Brief 062 § 7.1 · Datos de /arena/torneo y /arena/torneo/[id]: el repositorio (public/torneos) más el almacén del
// sitio (aquí, el fixture como almacén local de solo lectura). Leer no arranca el latido ni escribe.
import { readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { datosPaginaTorneo } from "../torneo-pagina";

const DS = "src/arena/__fixtures__/torneos-sitio";
const g = globalThis as typeof globalThis & { __cronistaTorneoSitio?: unknown };
let antes: string | undefined;
beforeAll(() => { antes = process.env.ARENA_TORNEOS_SITIO_DIR; process.env.ARENA_TORNEOS_SITIO_DIR = DS; delete g.__cronistaTorneoSitio; });
afterAll(() => { if (antes === undefined) delete process.env.ARENA_TORNEOS_SITIO_DIR; else process.env.ARENA_TORNEOS_SITIO_DIR = antes; delete g.__cronistaTorneoSitio; });

describe("062 · datos de la página del torneo", () => {
  it("portada: sin torneo activo, el más reciente real (el archivado del 24 oct) y la lista con los dos orígenes", async () => {
    const archivos = readdirSync(DS).sort();
    const d = (await datosPaginaTorneo(null))!;
    expect(d.lectura?.estado === "ok" && d.lectura.torneo.id).toBe("2026-10-24");
    expect(d.lista.map(r => [r.id, r.origen, r.lanzamiento])).toEqual([["2026-10-24", "repositorio", "publico"], ["sitio-prueba-aaaaaa660000", "sitio", "prueba"], ["sitio-2026-10-20", "sitio", "publico"]]);
    expect(readdirSync(DS).sort()).toEqual(archivos);
  });
  it("[id]: un torneo del sitio se lee del almacén; un id del sitio inexistente o inválido es 404", async () => {
    const d = (await datosPaginaTorneo("sitio-2026-10-20"))!;
    expect(d.lectura?.estado === "ok" && d.lectura.torneo.version).toBe("062-v1");
    expect(await datosPaginaTorneo("sitio-2020-01-01")).toBeNull();
    expect(await datosPaginaTorneo("sitio-x")).toBeNull();
    expect(await datosPaginaTorneo("no-existe")).toBeNull();
  });
});
