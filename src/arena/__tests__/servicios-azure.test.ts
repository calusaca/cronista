import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { almacenLocal } from "../almacen";
import { analizarArena, herramientasAnalista, type TransporteAgente } from "../agente";
import { crearControladorProgramado } from "../controladores";
import { ejecutarArena } from "../coordinador";
import { crearConfigArena } from "../motor";
import { contextoNarradorArena } from "../narrador";
import { construirRelato } from "../relato";
import { GestorSesiones } from "../sesiones";
import { sintetizarComentario, ssmlComentario } from "../voz";
import { ejecutarLote } from "../lote";

const rutas: string[] = [];
afterEach(async () => { vi.unstubAllEnvs(); await Promise.all(rutas.splice(0).map(p => rm(p, { force: true, recursive: true }))); });
async function carpeta() { const ruta = await mkdtemp(join(tmpdir(), "cronista-azure-")); rutas.push(ruta); return ruta; }
const config = { seed: 42, segundos: 2, local: "auto", visita: "auto", seleccion: { modo: "programado" } };
const registro = await ejecutarArena(crearConfigArena({ duracionS: 60 }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });

it("el adaptador local conserva el diario y rechaza rutas fuera de su directorio", async () => {
  const a = almacenLocal(await carpeta()); await a.iniciar(); await a.escribir("a.json", "uno", true);
  await expect(a.escribir("a.json", "otro", true)).rejects.toThrow();
  await a.anexar("a.ndjson", "1\n"); await a.anexar("a.ndjson", "2\n");
  expect(await a.leer("a.ndjson")).toBe("1\n2\n"); expect(() => a.leer("../secreto")).toThrow();
});

it("un segundo coordinador no puede crear encuentros mientras otro retiene escritura", async () => {
  const a = almacenLocal(await carpeta()); let ocupado = false;
  a.bloquear = async () => { if (ocupado) throw new Error("Lease existente"); ocupado = true; return { vigente: () => ocupado, liberar: async () => { ocupado = false; } }; };
  const uno = new GestorSesiones({ almacen: a, ritmoMsPorSegundo: 100 }), dos = new GestorSesiones({ almacen: a, ritmoMsPorSegundo: 0 });
  const s = await uno.crear({ ...config, segundos: 30 });
  await expect(dos.crear(config)).rejects.toThrow("Otro proceso");
  await expect(dos.obtener(s.id)).rejects.toThrow("Otro proceso");
  await uno.detener(s.id); await uno.esperarFinal(s.id);
  const otra = await dos.crear(config); await dos.esperarFinal(otra.id); expect(ocupado).toBe(false);
});

it("reserva, caché y límite de consultas sobreviven a reinicios sin volver a pagar", async () => {
  const ruta = await carpeta(); let llamadas = 0;
  const g = new GestorSesiones({ directorio: ruta, ritmoMsPorSegundo: 0 });
  const s = await g.crear(config); await g.esperarFinal(s.id);
  const pedir = () => { llamadas++; return Promise.resolve({ texto: "respuesta" }); };
  expect(await g.extra(s.id, "analisis", "uno", pedir)).toEqual({ texto: "respuesta" });
  const otro = new GestorSesiones({ directorio: ruta });
  expect(await otro.extra(s.id, "analisis", "uno", pedir)).toEqual({ texto: "respuesta" });
  await otro.extra(s.id, "analisis", "dos", pedir);
  await expect(otro.extra(s.id, "analisis", "tres", pedir)).rejects.toThrow("límite"); expect(llamadas).toBe(2);
  await expect(otro.extra(s.id, "audio", "fallo", async () => { llamadas++; throw new Error("Fallo proveedor"); }, 20)).rejects.toThrow();
  await expect(otro.extra(s.id, "audio", "fallo", pedir, 20)).rejects.toThrow("no se repetirá"); expect(llamadas).toBe(3);
});

// Defecto visto al grabar el video (27 oct): tras un directo narrado de 120 s, el analista respondía 429 porque su
// comprobación sumaba todo el audio de la sesión (narrador, invitados, antesala) contra PRESUPUESTO_AUDIO_ENCUENTRO.
// Desde el 048 v1.3 cada clase de voz tiene su bolsa; el analista solo cuenta sus 2 consultas por encuentro.
it("el audio reservado de la sesión (narrador e invitados, más de 24.000 c en total) no agota las consultas del analista", async () => {
  const g = new GestorSesiones({ directorio: await carpeta(), ritmoMsPorSegundo: 0 });
  const s = await g.crear(config); await g.esperarFinal(s.id);
  const audio = () => Promise.resolve({ ok: true });
  for (let i = 0; i < 18; i++) await g.extra(s.id, "audio", `narrador-${i}`, audio, 1_000, "narrador");
  for (let i = 0; i < 10; i++) await g.extra(s.id, "audio", `invitado-${i}`, audio, 1_000, "invitado");
  expect(await g.extra(s.id, "analisis", "uno", () => Promise.resolve({ texto: "respuesta" }))).toEqual({ texto: "respuesta" });
  await g.extra(s.id, "analisis", "dos", () => Promise.resolve({ texto: "otra" }));
  await expect(g.extra(s.id, "analisis", "tres", () => Promise.resolve({ texto: "no" }))).rejects.toThrow("límite");
});

it("las herramientas no permiten consultar el futuro, otro jugador ni mutar el motor", () => {
  const h = herramientasAnalista(registro, 200), antes = JSON.stringify(registro);
  expect(() => h.ejecutar("consultar_eventos", JSON.stringify({ desdeTick: 0, hastaTick: 201, tipo: "todos" }))).toThrow("futuro");
  expect(() => h.ejecutar("consultar_jugador", JSON.stringify({ jugadorId: "inventado", hastaTick: 200 }))).toThrow();
  expect(() => h.ejecutar("cambiar_marcador", "{}")).toThrow("no permitida"); expect(JSON.stringify(registro)).toBe(antes);
  const encontrados = h.ejecutar("consultar_eventos", JSON.stringify({ desdeTick: 0, hastaTick: 200, tipo: "todos" }));
  expect(encontrados.length).toBeGreaterThan(0); expect(encontrados.every(x => x.eventos.every(id => registro.eventos.find(e => e.id === id)!.tick <= 200))).toBe(true);
});

it("la retención no elimina un encuentro mientras se está preparando su audio", async () => {
  const g = new GestorSesiones({ directorio: await carpeta(), ritmoMsPorSegundo: 0, maxRetenidas: 1 });
  const s = await g.crear(config); await g.esperarFinal(s.id);
  let continuar!: () => void, iniciada!: () => void;
  const inicio = new Promise<void>(r => { iniciada = r; });
  const audio = g.extra(s.id, "audio", "en-curso", async () => { iniciada(); await new Promise<void>(r => { continuar = r; }); return { audio: "válido" }; }, 10);
  await inicio;
  try { const nueva = await g.crear(config); await g.esperarFinal(nueva.id); expect((await g.obtener(s.id)).estado).toBe("completa"); }
  finally { continuar(); }
  expect(await audio).toEqual({ audio: "válido" });
});

it("el límite de dos servicios se reserva antes de la primera espera asíncrona", async () => {
  const g = new GestorSesiones({ directorio: await carpeta(), ritmoMsPorSegundo: 0 }), s = await g.crear(config); await g.esperarFinal(s.id);
  let liberar!: () => void; const barrera = new Promise<void>(r => { liberar = r; });
  const uno = g.extra(s.id, "audio", "uno", async () => { await barrera; return 1; }, 10);
  const dos = g.extra(s.id, "audio", "dos", async () => { await barrera; return 2; }, 10);
  try { await expect(g.extra(s.id, "audio", "tres", async () => 3, 10)).rejects.toThrow("otras consultas"); }
  finally { liberar(); }
  expect(await Promise.all([uno, dos])).toEqual([1, 2]);
});

it("el agente consulta herramientas y verifica su respuesta citando solo lo recuperado", async () => {
  let llamadas = 0;
  const transporte: TransporteAgente = { id: "agente-prueba", responder: async (input, forzar) => {
    llamadas++;
    if (llamadas === 1) { expect(forzar).toBe(true); return { id: "r1", output: [{ type: "function_call", name: "consultar_eventos", call_id: "f1", arguments: JSON.stringify({ desdeTick: 0, hastaTick: 200, tipo: "todos" }) }] }; }
    expect(forzar).toBe(false);
    const tool = input.at(-1) as { output: string }, h = JSON.parse(tool.output).hechos.at(-1);
    return { id: "r2", output: [], output_text: JSON.stringify({ oraciones: [{ texto_es: h.texto_es, texto_en: h.texto_en, hecho: h.id, apoyo: [] }] }), usage: { input_tokens: 10, output_tokens: 20 } };
  } };
  const r = await analizarArena(registro, { tick: 200, pregunta: "momento", jugador: null, audiencia: "fan" }, transporte);
  expect(r.comentario?.modo).toBe("llm"); expect(r.solicitudes).toBe(2); expect(r.herramientas[0]?.hechos).toContain(r.comentario?.principal); expect(r.comentario?.audit.at(-1)?.motivos).toEqual([]);
});

it("un agente bloqueado respeta cancelación y entrega respaldo sin solicitudes adicionales", async () => {
  const r = await analizarArena(registro, { tick: 200, pregunta: "momento", jugador: null, audiencia: "fan" }, { id: "lento", responder: () => new Promise(() => {}) }, AbortSignal.timeout(5));
  expect(r.solicitudes).toBe(1); expect(r.comentario?.modo).toBe("plantilla");
});

it("la voz escapa SSML y transmite exclusivamente el comentario seleccionado", async () => {
  vi.stubEnv("AZURE_SPEECH_ENDPOINT", "https://ejemplo.cognitiveservices.azure.com"); vi.stubEnv("AZURE_SPEECH_KEY", "clave-prueba");
  const h = contextoNarradorArena(registro, 200).at(-1)!;
  const c = { tick: 200, modelo: "prueba", modo: "plantilla" as const, principal: h.id, hechos: [h], audit: [], oraciones: [{ texto_es: "A < B & C", texto_en: "A < B & C", hecho: h.id, apoyo: [] }] };
  expect(ssmlComentario(c, "es").ssml).toContain("A &lt; B &amp; C");
  const f = vi.fn<typeof fetch>(async (_url, options) => { expect(options?.body).toBe(ssmlComentario(c, "es").ssml); return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/mpeg" } }); });
  const audio = await sintetizarComentario(c, "es", { fetch: f }); expect(audio.base64).toBe("AQID"); expect(f).toHaveBeenCalledTimes(1);
});

it("el relato completo cubre todos los eventos, sin adelantar el resultado", () => {
  const fuentes = new Set<string>();
  for (let t = 0; t < 600; t += 100) { const s = construirRelato(registro, t, t + 100, "completo", "es"); s.fuentes.forEach(id => fuentes.add(id)); expect(s.eventosNarrados).toBe(s.eventosDisponibles); }
  expect([...fuentes].sort()).toEqual(registro.eventos.map(e => e.id).sort());
  const primero = construirRelato({ ...registro, final: registro.fotogramas.find(f => f.tick === 100)! }, 0, 100, "completo", "en");
  expect(primero.texto).toContain("begins"); expect(primero.texto).not.toContain("Full time");
  expect(construirRelato(registro, 500, 600, "completo", "en").texto).toContain("Full time");
  expect(() => construirRelato(registro, 500, 601, "completo", "es")).toThrow();
});

it("adjuntar una grabación no la vuelve a ejecutar y conserva prefijos sin datos futuros", async () => {
  const ruta = await carpeta(), g = new GestorSesiones({ directorio: ruta, ritmoMsPorSegundo: 0 });
  const s = await g.registrarGrabacion(registro, "ejemplo-prueba");
  expect(await g.registro(s.id)).toEqual(registro);
  expect(await g.registrarGrabacion(registro, "ejemplo-prueba")).toEqual(s);
  const prefijo = await g.vistaPublicada(s.id, 105);
  expect(prefijo.final.tick).toBe(105); expect(prefijo.eventos.every(e => e.tick <= 105)).toBe(true);
  expect(prefijo.fotogramas.every(f => f.tick <= 105)).toBe(true); expect(prefijo.rondas.every(r => r.inicioTick <= 105)).toBe(true);
  await expect(g.vistaPublicada(s.id, 601)).rejects.toThrow("no publicado");
});

it("un lote reanudado conserva resultados y rechaza repetir una inferencia ambigua", async () => {
  const ruta = await carpeta(), a = almacenLocal(ruta);
  const p = { id: "lote-prueba", semillas: [42, 43], segundos: 30, ventanas: 2, narrar: false, maxSolicitudes: 0 };
  const primero = await ejecutarLote(p, a), segundo = await ejecutarLote(p, a);
  expect(segundo.informes).toEqual(primero.informes); expect(primero.informes.every(i => i.modo === "sin_inferencia")).toBe(true);
  const m = JSON.parse(await readFile(join(ruta, "manifiesto.json"), "utf8")); m.semillas[42] = "pendiente";
  await writeFile(join(ruta, "manifiesto.json"), JSON.stringify(m));
  await expect(ejecutarLote(p, a)).rejects.toThrow("interrumpida");
  await expect(ejecutarLote({ ...p, narrar: true }, a)).rejects.toThrow("presupuesto");
});

it("la ruta de grabaciones activa el duelo real sin inferencia y preserva sus hashes", async () => {
  vi.stubEnv("ARENA_VOZ", "1");
  const global = globalThis as typeof globalThis & { __cronistaSesiones?: GestorSesiones };
  const anterior = global.__cronistaSesiones;
  global.__cronistaSesiones = new GestorSesiones({ directorio: await carpeta(), ritmoMsPorSegundo: 0 });
  try {
    const { POST } = await import("../../app/api/arena/grabaciones/route");
    const r = await POST(new Request("http://localhost/api/arena/grabaciones", { method: "POST", body: JSON.stringify({ archivo: "duelo" }) }));
    expect(r.status).toBe(200); const { id } = await r.json();
    const grabacion = await global.__cronistaSesiones.registro(id);
    expect(grabacion).toEqual(JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")));
  } finally { global.__cronistaSesiones = anterior; }
});
