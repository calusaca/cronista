// Defecto de producción (24 oct) · El cierre del directo recibía 429. Reproducción local con Speech simulado y los
// presupuestos reales: un directo programado de 60 s, sus tramos reales del narrador (ventanas buffer con la memoria
// encadenada) y, al final, el último tramo y el invitado final de la Mesa en vuelo cuando se pide el cierre.
// Causa: el tope de 2 síntesis simultáneas («Hay otras consultas en curso»), no el presupuesto por encuentro.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GestorSesiones, PRESUPUESTO_AUDIO_ENCUENTRO } from "../sesiones";
import { POST as relatoHttp } from "../../app/api/arena/sesiones/[id]/relato/route";
import { recordarVoz, type RecuerdoVoz } from "../editorial";
import { RELATO_INTERVALOS } from "../protocolo";
import { esperaReintentoCierre } from "../turnos";
import { CIERRE_VOZ } from "../../sim/limites";

const compartido = globalThis as typeof globalThis & { __cronistaSesiones?: GestorSesiones };
const previo = compartido.__cronistaSesiones, rutas: string[] = [];
afterEach(async () => { compartido.__cronistaSesiones = previo; vi.unstubAllEnvs(); vi.unstubAllGlobals(); await Promise.all(rutas.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
const pedir = (id: string, cuerpo: object) => relatoHttp(new Request("http://localhost/relato", { method: "POST", body: JSON.stringify(cuerpo) }), { params: Promise.resolve({ id }) });

/** Speech simulado: responde bytes; con `retener` activo, cada síntesis espera a que se suelte la barrera. */
function speech() {
  let soltar: () => void = () => {}, barrera: Promise<void> | null = null;
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async url => {
    if (String(url).includes("/voices/list")) return new Response("x", { status: 500 });
    if (barrera) await barrera;
    return new Response(new Uint8Array([1, 2, 3]));
  }));
  return { retener: () => { barrera = new Promise<void>(r => { soltar = r; }); }, soltar: () => { soltar(); barrera = null; } };
}

async function directo60() {
  vi.stubEnv("ARENA_BLOB_ENDPOINT", ""); vi.stubEnv("ARENA_VOZ", "1");
  vi.stubEnv("AZURE_SPEECH_ENDPOINT", "https://ejemplo.cognitiveservices.azure.com"); vi.stubEnv("AZURE_SPEECH_KEY", "prueba");
  const directorio = await mkdtemp(join(tmpdir(), "cronista-cierre-")); rutas.push(directorio);
  const g = new GestorSesiones({ directorio, ritmoMsPorSegundo: 0 }); compartido.__cronistaSesiones = g;
  const { id } = await g.crear({ seed: 60, segundos: 60, local: "auto", visita: "auto", seleccion: { modo: "programado" }, presentacion: "buffer" });
  await g.esperarFinal(id);
  return { g, id, r: await g.reproduccion(id) };
}

describe("cierre del directo · 429 al final de un partido de 60 s", () => {
  it("con el último tramo y el invitado final en vuelo, el cierre tiene plaza propia (200); otra síntesis recibe 429 con retry-after", async () => {
    const voz = speech(), { id, r } = await directo60(), fin = r.registro.final.tick, B = RELATO_INTERVALOS.buffer;
    // Tramos reales del narrador hasta el penúltimo, con la memoria encadenada como el cliente; se cuenta el SSML.
    let memoria: RecuerdoVoz[] = [], caracteres = 0, solicitudes = 0;
    for (let d = 0; d < fin - B; d += B) {
      const respuesta = await pedir(id, { desdeTick: d, hastaTick: d + B, modo: "buffer", idioma: "es", memoria });
      expect(respuesta.status, `tramo ${d}`).toBe(200);
      const s = await respuesta.json() as { texto: string; fragmentos: { tick: number }[]; claveVoz?: string; temaVoz?: string; audio: { caracteresPresupuestados: number } | null };
      if (s.audio) { caracteres += s.audio.caracteresPresupuestados; solicitudes++; }
      if (s.texto) memoria = recordarVoz(memoria, { tick: s.fragmentos[0]!.tick, texto: s.texto.slice(0, 500), clave: s.claveVoz, tema: s.temaVoz });
    }
    // El presupuesto del narrador está lejos de agotarse: no es la causa.
    expect(solicitudes).toBeLessThan(PRESUPUESTO_AUDIO_ENCUENTRO.solicitudes / 2); expect(caracteres).toBeLessThan(PRESUPUESTO_AUDIO_ENCUENTRO.caracteres / 2);
    const final = r.intervenciones.find(i => i.tick === fin);
    expect(final, "la Mesa publica un invitado en el tick final").toBeDefined();
    // Al terminar: último tramo e invitado final en vuelo (Speech retenido) y, a la vez, el cierre.
    voz.retener();
    const ultimo = pedir(id, { desdeTick: fin - B, hastaTick: fin, modo: "buffer", idioma: "es", memoria });
    const invitado = pedir(id, { desdeTick: fin, hastaTick: fin, modo: "buffer", idioma: "es", intervencion: final!.id, variante: "completa" });
    await vi.waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(c => !String(c[0]).includes("/voices/list")).length).toBeGreaterThanOrEqual(solicitudes + 2));
    const cierre = pedir(id, { desdeTick: fin - B, hastaTick: fin, modo: "buffer", idioma: "es", cierre: true, memoria });
    // El cierre llega a Speech (plaza propia) o, con el tope común (código anterior), se rechaza al momento.
    await Promise.race([cierre, vi.waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(c => !String(c[0]).includes("/voices/list")).length).toBeGreaterThanOrEqual(solicitudes + 3))]);
    // Una cuarta síntesis (no cierre) se rechaza por concurrencia y dice cuándo reintentar.
    const otra = await pedir(id, { desdeTick: fin, hastaTick: fin, modo: "buffer", idioma: "en", intervencion: final!.id, variante: "completa" });
    expect(otra.status).toBe(429);
    expect((await otra.json() as { error: string }).error).toBe("Hay otras consultas en curso; espera a que terminen");
    expect(otra.headers.get("retry-after")).toBe(String(CIERRE_VOZ.retryAfterS));
    voz.soltar();
    const [a, b, c] = await Promise.all([ultimo, invitado, cierre]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(c.status, `el cierre no se queda sin síntesis: ${c.status === 200 ? "" : (await c.clone().json() as { error: string }).error}`).toBe(200);
    expect((await c.json() as { cierre: boolean; audio: unknown }).audio).not.toBeNull();
  }, 60_000);

  it("un 429 de presupuesto no lleva retry-after (es final para el cliente)", async () => {
    speech();
    const { g, id } = await directo60();
    const respuesta = await (async () => { try { await g.extra(id, "audio", "x", async () => 1, PRESUPUESTO_AUDIO_ENCUENTRO.caracteres, "narrador"); return null; } catch (e) { return e as { status: number; retryAfterS?: number }; } })();
    expect(respuesta?.status).toBe(429); expect(respuesta?.retryAfterS).toBeUndefined();
  }, 60_000);
});

describe("esperaReintentoCierre", () => {
  it("solo un 429 con retry-after, hasta maxReintentos, con espera max(retry-after, reintentoMs · 2^k)", () => {
    expect(esperaReintentoCierre(429, "1", 0)).toBe(Math.max(1000, CIERRE_VOZ.reintentoMs));
    expect(esperaReintentoCierre(429, "0", 2)).toBe(CIERRE_VOZ.reintentoMs * 4);
    expect(esperaReintentoCierre(429, "5", 1)).toBe(Math.max(5000, CIERRE_VOZ.reintentoMs * 2));
    expect(esperaReintentoCierre(429, "1", CIERRE_VOZ.maxReintentos)).toBeNull();
    expect(esperaReintentoCierre(429, null, 0)).toBeNull();
    expect(esperaReintentoCierre(429, "x", 0)).toBeNull();
    for (const estado of [400, 404, 500, 503]) expect(esperaReintentoCierre(estado, "1", 0)).toBeNull();
  });
});
