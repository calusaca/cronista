// Rev. 0000035 · Los 429 llevan un `motivo` estable en el cuerpo: límite diario de encuentros con modelos (con su
// cupo), otro encuentro en curso y tope diario de Speech (final, sin retry-after). Las cifras salen de las constantes.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cuposDiarios, ErrorSesion, GestorSesiones, respuestaErrorSesion } from "../sesiones";
import { POST as relatoHttp } from "../../app/api/arena/sesiones/[id]/relato/route";
import { vozDiariaAgotada } from "../turnos";
import type { ModeloConfigurado } from "../modelos";
import { planProgramado } from "../controladores";
import { ENCUENTROS_LLM_DIARIOS, SPEECH_DIARIO } from "../../sim/limites";

const compartido = globalThis as typeof globalThis & { __cronistaSesiones?: GestorSesiones };
const previo = compartido.__cronistaSesiones, rutas: string[] = [];
afterEach(async () => { compartido.__cronistaSesiones = previo; vi.unstubAllEnvs(); vi.unstubAllGlobals(); await Promise.all(rutas.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
const directorio = async () => { const d = await mkdtemp(join(tmpdir(), "cronista-rechazos-")); rutas.push(d); vi.stubEnv("ARENA_BLOB_ENDPOINT", ""); return d; };
const rechazo = async (p: Promise<unknown>) => { try { await p; return null; } catch (e) { return respuestaErrorSesion(e); } };
const catalogo: ModeloConfigurado[] = [{ publico: { id: "p", nombre: "P", controlador: "p" }, crear: () => ({ id: "p", completar: async (_s, m) => JSON.stringify(planProgramado(JSON.parse(m[0]!.contenido))) }) }];
const manual = { seed: 1, segundos: 10, local: "auto", visita: "auto", seleccion: { modo: "manual", local: "p", visita: "p" }, presentacion: "preparada" };

describe("0000035 · motivos de los 429", () => {
  it("límite diario de encuentros con modelos: motivo «limite-diario» y el cupo (por defecto ENCUENTROS_LLM_DIARIOS)", async () => {
    const g = new GestorSesiones({ directorio: await directorio(), ritmoMsPorSegundo: 0, catalogo: () => catalogo, maxLlmDiarias: 0 });
    const r = (await rechazo(g.crear(manual)))!;
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ error: "Se alcanzó el límite diario de encuentros con modelos", motivo: "limite-diario", limite: 0 });
    expect(r.headers.get("retry-after")).toBeNull();
    // Sin opción, el cupo es la constante.
    const d = await directorio(), g2 = new GestorSesiones({ directorio: d, ritmoMsPorSegundo: 0, catalogo: () => catalogo });
    for (let k = 0; k < ENCUENTROS_LLM_DIARIOS; k++) await writeFile(join(d, `s${k}.meta.json`), JSON.stringify({ creada: Date.now(), asignacion: { modo: "manual" } }));
    expect(await (await rechazo(g2.crear(manual)))!.json()).toMatchObject({ motivo: "limite-diario", limite: ENCUENTROS_LLM_DIARIOS });
  });

  it("otro encuentro en curso: motivo «en-curso»", async () => {
    const r = respuestaErrorSesion(new ErrorSesion("Hay un encuentro en ejecución; espera a que termine", 429, undefined, { motivo: "en-curso" }));
    expect(await r.json()).toEqual({ error: "Hay un encuentro en ejecución; espera a que termine", motivo: "en-curso" });
    const g = new GestorSesiones({ directorio: await directorio(), ritmoMsPorSegundo: 0, maxActivas: 0 });
    expect(await (await rechazo(g.crear({ ...manual, seleccion: { modo: "programado" } })))!.json()).toMatchObject({ motivo: "en-curso" });
  });

  it("tope diario de Speech: el relato responde 429 con motivo «speech-diario» y sin retry-after", async () => {
    const d = await directorio();
    vi.stubEnv("ARENA_VOZ", "1"); vi.stubEnv("AZURE_SPEECH_ENDPOINT", "https://ejemplo.cognitiveservices.azure.com"); vi.stubEnv("AZURE_SPEECH_KEY", "prueba");
    const g = new GestorSesiones({ directorio: d, ritmoMsPorSegundo: 0 }); compartido.__cronistaSesiones = g;
    const { id } = await g.crear({ ...manual, seleccion: { modo: "programado" } });
    await g.esperarFinal(id);
    await writeFile(join(d, `servicios-${new Date().toISOString().slice(0, 10)}.json`), JSON.stringify({ audio: SPEECH_DIARIO.audios, caracteres: SPEECH_DIARIO.caracteres }));
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(new Uint8Array([1, 2, 3]))));
    const r = await relatoHttp(new Request("http://localhost/relato", { method: "POST", body: JSON.stringify({ desdeTick: 0, hastaTick: 50, modo: "buffer", idioma: "es" }) }), { params: Promise.resolve({ id }) });
    expect(r.status).toBe(429);
    const cuerpo = await r.json();
    expect(cuerpo).toEqual({ error: "Presupuesto diario de este servicio agotado", motivo: "speech-diario" });
    expect(vozDiariaAgotada(r.status, r.headers.get("retry-after"), cuerpo)).toBe(true);
  }, 60_000);

  it("vozDiariaAgotada distingue el tope diario de la concurrencia (retry-after) y de las bolsas por encuentro", () => {
    expect(vozDiariaAgotada(429, null, { motivo: "speech-diario" })).toBe(true);
    expect(vozDiariaAgotada(429, "1", { motivo: "speech-diario" })).toBe(false);
    expect(vozDiariaAgotada(429, null, { error: "Se alcanzó el límite de consultas de este encuentro" })).toBe(false);
    expect(vozDiariaAgotada(503, null, { motivo: "speech-diario" })).toBe(false);
    expect(vozDiariaAgotada(429, null, null)).toBe(false);
  });
});

describe("pruebas de Carlos · cupos diarios por entorno, leídos en cada uso", () => {
  it("válido sustituye, inválido o ausente usa la constante", () => {
    expect(cuposDiarios()).toEqual({ encuentrosLlm: ENCUENTROS_LLM_DIARIOS, speech: { audios: SPEECH_DIARIO.audios, caracteres: SPEECH_DIARIO.caracteres } });
    vi.stubEnv("ARENA_LIMITE_LLM_DIARIO", "500"); vi.stubEnv("ARENA_SPEECH_DIARIO_CARACTERES", "5000000"); vi.stubEnv("ARENA_SPEECH_DIARIO_AUDIOS", " 20000 ");
    expect(cuposDiarios()).toEqual({ encuentrosLlm: 500, speech: { audios: 20000, caracteres: 5_000_000 } });
    for (const malo of ["0", "-3", "1.5", "abc", "", "1e9", "99999999999999999999"]) {
      vi.stubEnv("ARENA_LIMITE_LLM_DIARIO", malo); vi.stubEnv("ARENA_SPEECH_DIARIO_CARACTERES", malo); vi.stubEnv("ARENA_SPEECH_DIARIO_AUDIOS", malo);
      expect(cuposDiarios(), malo).toEqual({ encuentrosLlm: ENCUENTROS_LLM_DIARIOS, speech: { audios: SPEECH_DIARIO.audios, caracteres: SPEECH_DIARIO.caracteres } });
    }
  });
  it("el límite de encuentros con modelos sigue al entorno en cada creación (sin reimportar)", async () => {
    const d = await directorio(), g = new GestorSesiones({ directorio: d, ritmoMsPorSegundo: 0, catalogo: () => catalogo });
    for (let k = 0; k < ENCUENTROS_LLM_DIARIOS; k++) await writeFile(join(d, `s${k}.meta.json`), JSON.stringify({ creada: Date.now(), asignacion: { modo: "manual" } }));
    expect(await (await rechazo(g.crear(manual)))!.json()).toMatchObject({ motivo: "limite-diario", limite: ENCUENTROS_LLM_DIARIOS });
    vi.stubEnv("ARENA_LIMITE_LLM_DIARIO", String(ENCUENTROS_LLM_DIARIOS + 1));
    const { id } = await g.crear(manual);
    await g.esperarFinal(id);
    expect(await (await rechazo(g.crear(manual)))!.json()).toMatchObject({ motivo: "limite-diario", limite: ENCUENTROS_LLM_DIARIOS + 1 });
  }, 60_000);
  it("el tope diario de Speech sigue al entorno: con más caracteres, el mismo relato ya no es 429", async () => {
    const d = await directorio();
    vi.stubEnv("ARENA_VOZ", "1"); vi.stubEnv("AZURE_SPEECH_ENDPOINT", "https://ejemplo.cognitiveservices.azure.com"); vi.stubEnv("AZURE_SPEECH_KEY", "prueba");
    const g = new GestorSesiones({ directorio: d, ritmoMsPorSegundo: 0 }); compartido.__cronistaSesiones = g;
    const { id } = await g.crear({ ...manual, seleccion: { modo: "programado" } });
    await g.esperarFinal(id);
    await writeFile(join(d, `servicios-${new Date().toISOString().slice(0, 10)}.json`), JSON.stringify({ audio: SPEECH_DIARIO.audios, caracteres: SPEECH_DIARIO.caracteres }));
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async url => String(url).includes("/voices/list") ? new Response("x", { status: 500 }) : new Response(new Uint8Array([1, 2, 3]))));
    const pedir = () => relatoHttp(new Request("http://localhost/relato", { method: "POST", body: JSON.stringify({ desdeTick: 0, hastaTick: 50, modo: "buffer", idioma: "es" }) }), { params: Promise.resolve({ id }) });
    expect((await pedir()).status).toBe(429);
    vi.stubEnv("ARENA_SPEECH_DIARIO_CARACTERES", String(SPEECH_DIARIO.caracteres * 10)); vi.stubEnv("ARENA_SPEECH_DIARIO_AUDIOS", String(SPEECH_DIARIO.audios * 10));
    expect((await pedir()).status).toBe(200);
  }, 60_000);
});
