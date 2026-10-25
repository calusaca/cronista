// Brief 064 § 8.1.8 · Fuentes de la crónica: torneo de fixture (archivado y del sitio) con huella correcta, alterada y
// encuentro inexistente; archivo desconocido; sesión incompleta → 409; precedencia del cliente (fuenteCronica).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { leerJson } from "../__fixtures__/cronica-064";
import { ErrorCronica, esquemaFuente, resolverFuente, type DepsFuentes } from "../cronica-fuentes";
import { fuenteCronica } from "../cronica-vista";
import { ErrorSesion } from "../sesiones";
import { esquemaTorneoCualquiera } from "../torneo";

const RAIZ = join(__dirname, "..", "..", "..");
const ARCHIVADO = join(RAIZ, "src/arena/__fixtures__/torneos/ensayo-059");
const SITIO = join(RAIZ, "src/arena/__fixtures__/torneos-sitio");
const ID_SITIO = "sitio-prueba-aaaaaa660000";

function deps(over: Partial<DepsFuentes> = {}): DepsFuentes {
  return {
    async torneo(id) {
      if (id === "ensayo-059") return esquemaTorneoCualquiera.parse(JSON.parse(readFileSync(join(ARCHIVADO, "torneo.json"), "utf8")));
      if (id === ID_SITIO) return esquemaTorneoCualquiera.parse(JSON.parse(readFileSync(join(SITIO, `${ID_SITIO}.torneo.json`), "utf8")));
      return null;
    },
    async bytesTorneo(id, archivo) {
      try { return new Uint8Array(readFileSync(id === ID_SITIO ? join(SITIO, `${id}.${archivo}`) : join(ARCHIVADO, archivo))); } catch { return null; }
    },
    async registroSesion() { throw new ErrorSesion("El encuentro aún no tiene un registro completo", 409); },
    async archivoEjemplo(nombre) { return JSON.parse(readFileSync(join(RAIZ, "public/experimentos", nombre), "utf8")); },
    ...over,
  };
}
async function errorDe(p: Promise<unknown>): Promise<ErrorCronica> {
  try { await p; } catch (e) { return e as ErrorCronica; }
  throw new Error("no lanzó");
}

describe("064 · fuente torneo", () => {
  it("archivado (ensayo-059, encuentro 01): registro validado y origen del torneo", async () => {
    const { registro, origen } = await resolverFuente({ torneo: "ensayo-059", encuentro: "01" }, deps());
    expect(registro.final.tick).toBeGreaterThan(0);
    expect(origen).toMatchObject({ tipo: "torneo", contexto: { forma: "torneo" }, torneo: { id: "ensayo-059", n: 1 } });
    expect(origen.torneo!.local.club).toBe(registro.config.partido.local.nombre);
  });
  it("del sitio (sitio-prueba-…, encuentro 02): registro validado; liga de prueba rotulada", async () => {
    const { registro, origen } = await resolverFuente({ torneo: ID_SITIO, encuentro: "02" }, deps());
    expect(origen.torneo).toMatchObject({ id: ID_SITIO, n: 2, prueba: true });
    expect(origen.torneo!.visita.club).toBe(registro.config.partido.visita.nombre);
  });
  it("huella alterada → 400 (rechazo)", async () => {
    const alterado = deps({ async bytesTorneo(id, archivo) { const b = new Uint8Array(readFileSync(join(ARCHIVADO, archivo))); b[b.length - 9] = (b[b.length - 9] ?? 0) ^ 1; void id; return b; } });
    const e = await errorDe(resolverFuente({ torneo: "ensayo-059", encuentro: "01" }, alterado));
    expect(e).toBeInstanceOf(ErrorCronica);
    expect(e.status).toBe(400);
    expect(e.message).toMatch(/huella/);
  });
  it("el almacén del sitio que detecta la alteración (409) también es un rechazo 400", async () => {
    const e = await errorDe(resolverFuente({ torneo: ID_SITIO, encuentro: "01" }, deps({ async bytesTorneo() { throw Object.assign(new Error("huella"), { status: 409 }); } })));
    expect(e.status).toBe(400);
  });
  it("encuentro inexistente o torneo inexistente → 404", async () => {
    expect((await errorDe(resolverFuente({ torneo: "ensayo-059", encuentro: "99" }, deps()))).status).toBe(404);
    expect((await errorDe(resolverFuente({ torneo: "no-existe", encuentro: "01" }, deps()))).status).toBe(404);
    expect((await errorDe(resolverFuente({ torneo: "ensayo-059", encuentro: "01" }, deps({ async bytesTorneo() { return null; } })))).status).toBe(404);
  });
});

describe("064 · fuentes archivo, sesión y registro", () => {
  it("archivo conocido: el duelo se reproduce; desconocido: el esquema lo rechaza", async () => {
    const { origen } = await resolverFuente({ archivo: "duelo" }, deps());
    expect(origen).toEqual({ tipo: "ejemplo", contexto: { forma: "ejemplo" } });
    expect(esquemaFuente.safeParse({ archivo: "otro" }).success).toBe(false);
    expect(esquemaFuente.safeParse({ archivo: "duelo", extra: 1 }).success).toBe(false);
  });
  it("sesión incompleta → 409; caducada → 404", async () => {
    const id = "00000000-0000-4000-8000-000000000000";
    expect((await errorDe(resolverFuente({ sesion: id }, deps()))).status).toBe(409);
    expect((await errorDe(resolverFuente({ sesion: id }, deps({ async registroSesion() { throw new ErrorSesion("Sesión inexistente o caducada", 404); } })))).status).toBe(404);
  });
  it("registro subido: válido → importado; alterado o incompleto → 400", async () => {
    const r = leerJson("src/arena/__fixtures__/arena-reinicios-v8.json");
    expect((await resolverFuente({ registro: r }, deps())).origen).toEqual({ tipo: "subida", contexto: { forma: "importado" } });
    const alterado = JSON.parse(JSON.stringify(r));
    alterado.eventos[0].tick += 1;
    expect((await errorDe(resolverFuente({ registro: alterado }, deps()))).status).toBe(400);
    expect((await errorDe(resolverFuente({ registro: { hola: 1 } }, deps()))).status).toBe(400);
  });
});

describe("064 · precedencia del cliente (fuenteCronica)", () => {
  const base = { origenTorneo: null, archivoActual: null, contextoModelos: { forma: "importado" } as const, sesionActual: null, registro: { r: 1 } };
  const torneo = { id: "ensayo-059", n: 3, inicioUtc: "2026-10-24T00:00:00.000Z", local: { club: "A", modelo: "a" }, visita: { club: "B", modelo: "b" } };
  it("torneo > archivo > sesión verificada > registro", () => {
    expect(fuenteCronica({ ...base, origenTorneo: torneo, archivoActual: "duelo", sesionActual: "s" })).toEqual({ torneo: "ensayo-059", encuentro: "03" });
    expect(fuenteCronica({ ...base, archivoActual: "duelo", sesionActual: "s", contextoModelos: { forma: "ejemplo" } })).toEqual({ archivo: "duelo" });
    const asignacion = { modo: "programado" } as never;
    expect(fuenteCronica({ ...base, sesionActual: "s-1", contextoModelos: { forma: "sesion", asignacion } })).toEqual({ sesion: "s-1" });
    expect(fuenteCronica(base)).toEqual({ registro: { r: 1 } });
  });
  it("una grabación registrada solo para la voz (sesión sin forma «sesion») no se presenta como sesión verificada", () => {
    expect(fuenteCronica({ ...base, sesionActual: "s-2", contextoModelos: { forma: "importado" } })).toEqual({ registro: { r: 1 } });
  });
});
