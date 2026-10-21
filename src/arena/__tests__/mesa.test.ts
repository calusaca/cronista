// Brief 045 · Comentarista y candidaturas en el servidor. Ninguna cifra de MESA_ARENA ni
// de PRIORIDAD_EVENTO_ARENA se repite a mano.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { verificarUpdate, type HechoVerificable } from "../../cadena/verificador";
import { conPresupuesto, type Llm, type Mensaje } from "../../lib/llm";
import { ARENA, MESA_ARENA, PRIORIDAD_EVENTO_ARENA } from "../../sim/limites";
import { almacenLocal } from "../almacen";
import { BUFFER_ARENA } from "../buffer";
import { crearControladorProgramado, planProgramado } from "../controladores";
import { ejecutarArena, reproducirArena } from "../coordinador";
import { datosEstadista } from "../estadista";
import { hechosArena } from "../inteligencia";
import { MesaSesion } from "../mesa";
import type { ModeloConfigurado } from "../modelos";
import { crearConfigArena } from "../motor";
import { comentarArena, contextoNarradorArena, narrarArena, respaldoComentarista, SISTEMA_COMENTARISTA_ARENA } from "../narrador";
import type { IntervencionArena } from "../protocolo";
import { GestorSesiones } from "../sesiones";
import type { EventoArena, RegistroArena } from "../tipos";
import { POST as relatoHttp } from "../../app/api/arena/sesiones/[id]/relato/route";

const registro = await ejecutarArena(crearConfigArena({ duracionS: 60 }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
const tick = registro.final.tick;
const prefijo = (r: RegistroArena, t: number): RegistroArena => ({ ...r, eventos: r.eventos.filter(e => e.tick <= t), fotogramas: r.fotogramas.filter(f => f.tick <= t), final: [...r.fotogramas].reverse().find(f => f.tick <= t)! });
const contexto = (mensajes: Mensaje[]) => JSON.parse(mensajes[0]!.contenido) as { hechos: HechoVerificable[]; principal: string };
const fiel = (mensajes: Mensaje[]) => { const c = contexto(mensajes), h = c.hechos.find(h => h.id === c.principal)!; return { oraciones: [{ texto_es: h.texto_es, texto_en: h.texto_en, hecho: h.id, apoyo: [] }] }; };
const llm = (completar: Llm["completar"]): Llm => ({ id: "modelo-prueba", completar });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("045 · comentarista", () => {
  it("una salida fiel pasa V1–V8 y cita hechos del contexto ampliado y del estadista", async () => {
    let sistema = "", hechos: HechoVerificable[] = [];
    const i = (await comentarArena(registro, tick, llm(async (s, m) => { sistema = s; hechos = contexto(m).hechos; return JSON.stringify(fiel(m)); })))!;
    expect(sistema).toBe(SISTEMA_COMENTARISTA_ARENA);
    expect(i).toMatchObject({ rol: "comentarista", modo: "llm", tick });
    expect(hechos.filter(h => h.id.startsWith("arena:")).length).toBe(Math.min(MESA_ARENA.hechosComentarista, contextoNarradorArena(registro, tick, Number.MAX_SAFE_INTEGER).length));
    expect(hechos.some(h => h.id.startsWith("estadista:"))).toBe(true);
    expect(verificarUpdate(JSON.stringify({ oraciones: i.oraciones }), i.hechos, { config: registro.config.partido }, i.oraciones[0]!.hecho, MESA_ARENA.maxOracionesComentarista).motivos).toEqual([]);
    expect(i.evidencia[0]!.eventos.length).toBeGreaterThan(0);
  });

  const malas: [string, (m: Mensaje[]) => object, string][] = [
    // Segunda oración neutra sin hecho: solo V2 la detiene.
    ["sin hecho", m => { const r = fiel(m); r.oraciones.push({ texto_es: "el juego sigue.", texto_en: "play goes on.", hecho: "", apoyo: [] }); return r; }, "V2"],
    ["con nombre inventado", m => { const r = fiel(m); r.oraciones[0]!.texto_es += " Zacarías Quintanilla aplaude."; r.oraciones[0]!.texto_en += " Zacarías Quintanilla applauds."; return r; }, "V4"],
    ["con predicción", m => { const r = fiel(m); r.oraciones[0]!.texto_es += " Pronto llegará el gol."; r.oraciones[0]!.texto_en += " A goal will come soon."; return r; }, "V8"],
    ["con juicio no pagado", m => { const r = fiel(m); const h = contexto(m).hechos.find(h => h.id === contexto(m).principal)!; r.oraciones[0]!.texto_es = `${h.datos.equipo} dominó el tramo.`; r.oraciones[0]!.texto_en = `${h.datos.equipo} dominated the spell.`; return r; }, "V8"],
  ];
  for (const [caso, salida, regla] of malas) it(`una oración ${caso} se rechaza y cae al respaldo`, async () => {
    let llamadas = 0;
    const i = (await comentarArena(registro, tick, llm(async (_s, m) => { llamadas++; return JSON.stringify(salida(m)); })))!;
    expect(llamadas).toBe(2); expect(i.modo).toBe("plantilla");
    expect(i.audit.every(a => a.motivos.some(m => m.regla === regla))).toBe(true);
    expect(verificarUpdate(JSON.stringify({ oraciones: i.oraciones }), i.hechos, { config: registro.config.partido }, i.oraciones[0]!.hecho, MESA_ARENA.maxOracionesComentarista).motivos).toEqual([]);
    const principal = i.hechos.find(h => h.id === i.oraciones[0]!.hecho)!;
    const plantillas = MESA_ARENA.respaldosComentarista.es.map((_, k) => respaldoComentarista(principal, k, tick)[0]);
    expect(plantillas).toContainEqual(i.oraciones[0]);
  });

  it("cada respaldo de MESA_ARENA pasa verificarUpdate con hechos reales en ES y EN", () => {
    const hechos = contextoNarradorArena(registro, tick, Number.MAX_SAFE_INTEGER);
    expect(new Set(hechos.map(h => h.tipo)).size).toBeGreaterThan(1);
    for (const principal of hechos) for (let k = 0; k < MESA_ARENA.respaldosComentarista.es.length; k++) {
      const oraciones = respaldoComentarista(principal, k, principal.datos.distancia as number);
      expect(oraciones[0]!.texto_es).toBe(MESA_ARENA.respaldosComentarista.es[k]!.replace("{jugador}", String(principal.datos.jugador)).replace("{equipo}", String(principal.datos.equipo)).replace("{distancia}", String(principal.datos.distancia)));
      expect(oraciones[0]!.texto_en).toBe(MESA_ARENA.respaldosComentarista.en[k]!.replace("{jugador}", String(principal.datos.jugador)).replace("{equipo}", String(principal.datos.equipo)).replace("{distancia}", String(principal.datos.distancia)));
      const r = verificarUpdate(JSON.stringify({ oraciones }), hechos, { config: registro.config.partido }, principal.id, MESA_ARENA.maxOracionesComentarista);
      expect([principal.tipo, k, r.motivos]).toEqual([principal.tipo, k, []]);
    }
  });

  it("sin LLM usa el respaldo verificado; con plazo agotado también", async () => {
    expect((await comentarArena(registro, tick, undefined))!.modo).toBe("plantilla");
    const inicio = Date.now();
    const lento = await comentarArena(registro, tick, llm(() => new Promise(() => {})));
    expect(lento!.modo).toBe("plantilla"); expect(lento!.audit[0]!.motivos[0]!.regla).toBe("V1");
    // El plazo efectivo es MESA_ARENA.plazoComentaristaMs aunque el transporte no atienda AbortSignal.
    expect(Date.now() - inicio).toBeGreaterThanOrEqual(MESA_ARENA.plazoComentaristaMs - 50);
    expect(Date.now() - inicio).toBeLessThan(MESA_ARENA.plazoComentaristaMs * 2);
  });
});

describe("045 · disparadores del comentarista (servidor)", () => {
  const tipos = Object.entries(PRIORIDAD_EVENTO_ARENA) as [EventoArena["tipo"], number][];
  const altos = tipos.filter(([, p]) => p >= MESA_ARENA.comentaristaDesdePrioridad).map(([t]) => t);
  const bajos = tipos.filter(([, p]) => p < MESA_ARENA.comentaristaDesdePrioridad).map(([t]) => t);
  const evento = (tipo: EventoArena["tipo"], t: number): EventoArena => ({ ...registro.eventos.find(e => e.tick <= t)!, id: `x-${tipo}-${t}`, tipo, tick: t });
  const cada = Math.round(MESA_ARENA.comentaristaCadaS / ARENA.pasoS);

  it("el disparo por evento usa PRIORIDAD_EVENTO_ARENA y el temporizador se rearma al publicar", async () => {
    expect(altos.length).toBeGreaterThan(0); expect(bajos.length).toBeGreaterThan(0);
    const publicadas: IntervencionArena[] = [];
    const mesa = new MesaSesion({ publicar: async i => { publicadas.push(i); } });
    const t0 = Math.round(cada / 2);
    for (const tipo of bajos) expect(mesa.programarComentarista(prefijo(registro, t0), [evento(tipo, t0)])).toBe(false);
    expect(mesa.programarComentarista(prefijo(registro, t0), [evento(altos[0]!, t0)])).toBe(true);
    await mesa.esperar();
    expect(publicadas).toHaveLength(1); expect(publicadas[0]!.tema).toBe(altos[0]);
    expect(mesa.ultimaCandidaturaComentaristaTick).toBe(t0);
    // Rearmado: el disparo por tiempo no vence antes de t0 + comentaristaCadaS.
    expect(mesa.programarComentarista(prefijo(registro, t0 + cada - 1), [])).toBe(false);
    expect(mesa.programarComentarista(prefijo(registro, t0 + cada), [])).toBe(true);
    await mesa.esperar();
    expect(publicadas.at(-1)!.tema).toBe("tiempo");
  });

  it("una generación lenta bloquea otra; el tope por sesión se respeta", async () => {
    let liberar!: () => void, llamadas = 0;
    const barrera = new Promise<void>(r => { liberar = r; });
    const publicadas: IntervencionArena[] = [];
    const mesa = new MesaSesion({ llm: llm(async (_s, m) => { llamadas++; await barrera; return JSON.stringify(fiel(m)); }), publicar: async i => { publicadas.push(i); } });
    const t1 = cada;
    expect(mesa.programarComentarista(prefijo(registro, t1), [])).toBe(true);
    expect(mesa.programarComentarista(prefijo(registro, t1 + 1), [evento(altos[0]!, t1 + 1)])).toBe(false);
    liberar(); await mesa.esperar();
    expect(llamadas).toBe(1); expect(publicadas).toHaveLength(1);
    for (let k = 0, t = t1; k < MESA_ARENA.maxComentaristaPorSesion * 2 && t <= tick; k++, t += 5) { mesa.programarComentarista(prefijo(registro, t), [evento(altos[k % altos.length]!, t)]); await mesa.esperar(); }
    expect(publicadas).toHaveLength(MESA_ARENA.maxComentaristaPorSesion);
    expect(new Set(publicadas.map(p => p.id)).size).toBe(publicadas.length);
  });
});

describe("045 · candidaturas en el servidor", () => {
  const rutas: string[] = [];
  afterEach(async () => { await Promise.all(rutas.splice(0).map(p => rm(p, { recursive: true, force: true }))); });

  it("se generan una vez; instantánea, reproducción, recuperación y audio no vuelven a llamar al LLM", async () => {
    const directorio = await mkdtemp(join(tmpdir(), "cronista-mesa-")); rutas.push(directorio);
    const compartido = globalThis as typeof globalThis & { __cronistaSesiones?: GestorSesiones };
    const previo = compartido.__cronistaSesiones;
    try {
      vi.stubEnv("ARENA_BLOB_ENDPOINT", ""); vi.stubEnv("ARENA_VOZ", "1");
      vi.stubEnv("AZURE_SPEECH_ENDPOINT", "https://ejemplo.cognitiveservices.azure.com"); vi.stubEnv("AZURE_SPEECH_KEY", "prueba");
      let narraciones = 0;
      const narrador = llm(async (_s, m) => { narraciones++; return JSON.stringify(fiel(m)); });
      const catalogo: ModeloConfigurado[] = [{ publico: { id: "p", nombre: "P", controlador: "p" }, crear: () => llm(async (_s, m) => JSON.stringify(planProgramado(JSON.parse(m[0]!.contenido)))) }];
      const g = new GestorSesiones({ directorio, ritmoMsPorSegundo: 0, catalogo: () => catalogo, narrador: () => narrador });
      compartido.__cronistaSesiones = g;
      const { id } = await g.crear({ seed: 42, segundos: 60, local: "auto", visita: "auto", seleccion: { modo: "manual", local: "p", visita: "p" }, presentacion: "buffer" });
      await g.esperarFinal(id);
      const llamadasTrasPartido = narraciones;
      const emision = await g.emision(id), reproduccion = await g.reproduccion(id);
      const recuperada = await new GestorSesiones({ directorio }).reproduccion(id);
      expect(emision.intervenciones.length).toBeGreaterThan(0);
      expect(emision.intervenciones.some(i => i.rol === "estadista")).toBe(true);
      expect(emision.intervenciones.some(i => i.rol === "comentarista")).toBe(true);
      expect(reproduccion.intervenciones).toEqual(emision.intervenciones);
      expect(recuperada.intervenciones).toEqual(emision.intervenciones);
      expect(new Set(emision.intervenciones.map(i => i.id)).size).toBe(emision.intervenciones.length);
      // Reconexión SSE: las mismas publicaciones, sin otra generación.
      const texto = await (await g.escuchar(id, 0, new AbortController().signal)).text();
      const sse = texto.split("\n").filter(l => l.startsWith("data: ")).map(l => JSON.parse(l.slice(6))).filter(m => m.publicacion.tipo === "intervencion").map(m => m.publicacion.intervencion);
      expect(sse).toEqual(emision.intervenciones);
      // Ninguna intervención entra en RegistroArena ni en hechosArena.
      const reg = await g.registro(id), serial = JSON.stringify(reg);
      for (const i of emision.intervenciones) expect(serial).not.toContain(i.id);
      expect(hechosArena(reg, reg.final.tick).every(h => h.id.startsWith("arena:"))).toBe(true);
      expect(reproducirArena(reg)).toEqual(reg);
      // Audio por id del diario: lectura, nunca regeneración.
      const transporte = vi.fn<typeof fetch>(async () => new Response(new Uint8Array([1, 2, 3]))); vi.stubGlobal("fetch", transporte);
      const intervencion = emision.intervenciones.find(i => i.rol === "estadista")!;
      const pedir = (cuerpo: object) => relatoHttp(new Request("http://localhost/relato", { method: "POST", body: JSON.stringify(cuerpo) }), { params: Promise.resolve({ id }) });
      const respuesta = await pedir({ desdeTick: intervencion.tick, hastaTick: intervencion.tick, modo: "buffer", idioma: "es", intervencion: intervencion.id, memoria: [{ tick: 1, texto: "x", rol: "estadista" }] });
      const datos = await respuesta.json();
      expect(respuesta.status).toBe(200);
      expect(datos).toMatchObject({ tipoRelato: "invitado", rol: "estadista", intervencion: intervencion.id, cierre: false, prioridad: MESA_ARENA.prioridadInvitado });
      expect(datos.fragmentos.length).toBeGreaterThanOrEqual(1); expect(datos.fragmentos.length).toBeLessThanOrEqual(MESA_ARENA.fragmentosPorIntervencion);
      expect(datos.fragmentos.at(-1).rol).toBe("estadista");
      expect(datos.audio.base64).toBeTruthy();
      // v3.1: la memoria del espectador se ignora; sin ella sale el mismo clip.
      const sinMemoria = await pedir({ desdeTick: intervencion.tick, hastaTick: intervencion.tick, modo: "buffer", idioma: "es", intervencion: intervencion.id });
      expect(sinMemoria.status).toBe(200);
      expect((await sinMemoria.json()).fragmentos).toEqual(datos.fragmentos);
      // Una memoria que el narrador rechazaría (texto de 501) no impide obtener el clip del invitado.
      const invalida = [{ tick: 1, texto: "y".repeat(501), rol: "comentarista" }];
      const larga = await pedir({ desdeTick: intervencion.tick, hastaTick: intervencion.tick, modo: "buffer", idioma: "es", intervencion: intervencion.id, memoria: invalida });
      expect(larga.status).toBe(200);
      expect((await larga.json()).fragmentos).toEqual(datos.fragmentos);
      // La rama del narrador conserva su validación estricta.
      expect((await pedir({ desdeTick: 0, hastaTick: BUFFER_ARENA.tramoTicks, modo: "buffer", idioma: "es", memoria: invalida })).status).toBe(400);
      expect((await pedir({ desdeTick: intervencion.tick, hastaTick: intervencion.tick, modo: "buffer", idioma: "es", intervencion: "estadista:inexistente:1" })).status).toBe(404);
      expect((await pedir({ desdeTick: 0, hastaTick: intervencion.tick, modo: "buffer", idioma: "es", intervencion: intervencion.id })).status).toBe(400);
      expect(narraciones).toBe(llamadasTrasPartido);
    } finally { compartido.__cronistaSesiones = previo; }
  });
});

describe("045 v3.1 · comentarista: longitud, procedencia, cierre y presupuesto", () => {
  const cada = Math.round(MESA_ARENA.comentaristaCadaS / ARENA.pasoS);

  it("C1 · escenario «largo»: una oración verificada pero más larga que maxCaracteresOracion se rechaza como V1 y sale el respaldo", async () => {
    let esquema: Record<string, unknown> | undefined, llamadas = 0, largo = 0;
    const repetir = (t: string) => Array.from({ length: 8 }, () => t.replace(/\.$/, "")).join(", y ") + ".";
    const i = (await comentarArena(registro, tick, llm(async (_s, m, o) => {
      llamadas++; esquema = o?.esquema?.json;
      const c = contexto(m), h = c.hechos.find(h => h.id === c.principal)!;
      largo = repetir(h.texto_es).length;
      return JSON.stringify({ oraciones: [{ texto_es: repetir(h.texto_es), texto_en: repetir(h.texto_en), hecho: h.id, apoyo: [] }] });
    })))!;
    expect(largo).toBeGreaterThan(MESA_ARENA.maxCaracteresOracion);
    expect(i.modo).toBe("plantilla"); expect(llamadas).toBe(2); expect(i.audit).toHaveLength(2);
    for (const a of i.audit) expect(a.motivos.some(m => m.regla === "V1" && m.detalle.includes(`${largo} caracteres`) && m.detalle.includes(String(MESA_ARENA.maxCaracteresOracion)))).toBe(true);
    // El esquema que recibe el LLM lleva maxLength en ES y EN; el del narrador no cambia.
    const props = (esquema as { properties: { oraciones: { items: { properties: Record<string, { maxLength?: number }> } } } }).properties.oraciones.items.properties;
    expect(props.texto_es!.maxLength).toBe(MESA_ARENA.maxCaracteresOracion); expect(props.texto_en!.maxLength).toBe(MESA_ARENA.maxCaracteresOracion);
    for (const o of i.oraciones) { expect(o.texto_es.length).toBeLessThanOrEqual(MESA_ARENA.maxCaracteresOracion); expect(o.texto_en.length).toBeLessThanOrEqual(MESA_ARENA.maxCaracteresOracion); }
  });

  it("C7 · cada oración cita la procedencia (intervalo y fuente) de los datos del estadista que usa", async () => {
    const datos = datosEstadista(registro, tick), tema = datos.some(d => d.tema === "cambios") ? "cambios" : "reloj";
    const dato = datos.find(d => d.tema === tema)!, apoyo = dato.hecho.id;
    const i = (await comentarArena(registro, tick, llm(async (_s, m) => {
      const c = contexto(m), h = c.hechos.find(h => h.id === c.principal)!;
      return JSON.stringify({ oraciones: [{ texto_es: h.texto_es, texto_en: h.texto_en, hecho: h.id, apoyo: [apoyo] }] });
    })))!;
    expect(i.modo).toBe("llm"); expect(i.oraciones[0]!.apoyo).toEqual([apoyo]);
    const citas = i.evidencia[0]!.citas!;
    expect(citas).toEqual([{ hecho: apoyo, eventos: dato.evidencia.eventos, intervalo: dato.evidencia.intervalo, fuente: dato.evidencia.fuente }]);
    expect(citas[0]).toMatchObject({ fuente: `fotograma:${tick}`, intervalo: tema === "cambios" ? [0, tick] : [tick, tick] });
    // `eventos` sigue siendo la unión de los hechos citados.
    const principal = i.hechos.find(h => h.id === i.oraciones[0]!.hecho)!;
    expect(new Set(i.evidencia[0]!.eventos)).toEqual(new Set([...principal.eventos, ...dato.evidencia.eventos]));
  });

  it("C4 · cerrar() descarta una generación que termina después: publicar no se llama", async () => {
    let liberar!: () => void;
    const barrera = new Promise<void>(r => { liberar = r; });
    const publicar = vi.fn(async (_i: IntervencionArena) => {});
    const mesa = new MesaSesion({ llm: llm(async (_s, m) => { await barrera; return JSON.stringify(fiel(m)); }), publicar });
    expect(mesa.programarComentarista(prefijo(registro, cada), [])).toBe(true);
    mesa.cerrar(); liberar(); await mesa.esperar();
    expect(publicar).not.toHaveBeenCalled();
    // Cerrada, tampoco programa otra generación ni publica el estadista final.
    expect(mesa.programarComentarista(prefijo(registro, tick), [])).toBe(false);
    await mesa.avanzar(prefijo(registro, tick), []); await mesa.final(registro);
    expect(publicar).not.toHaveBeenCalled();
  });

  it("C5 · con el presupuesto agotado, narrador y comentarista caen a plantilla sin llamar al modelo y lo dicen en audit", async () => {
    let llamadas = 0;
    const envuelto = conPresupuesto(llm(async (_s, m) => { llamadas++; return JSON.stringify(fiel(m)); }), 1);
    await envuelto.completar("s", [{ rol: "user", contenido: JSON.stringify({ hechos: contextoNarradorArena(registro, tick), principal: contextoNarradorArena(registro, tick).at(-1)!.id }) }]);
    expect(llamadas).toBe(1);
    const comentario = (await narrarArena(registro, tick, envuelto))!;
    const intervencion = (await comentarArena(registro, tick, envuelto))!;
    expect(llamadas).toBe(1);
    for (const r of [comentario, intervencion]) {
      expect(r.modo).toBe("plantilla");
      expect(r.audit).toHaveLength(1);
      expect(r.audit[0]!.motivos[0]!.detalle).toContain("Presupuesto de llamadas agotado");
    }
  });
});

describe("045 v3.1 · GestorSesiones: cierre antes de `terminada` y presupuesto compartido", () => {
  const rutas: string[] = [];
  afterEach(async () => { await Promise.all(rutas.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
  const catalogo: ModeloConfigurado[] = [{ publico: { id: "p", nombre: "P", controlador: "p" }, crear: () => llm(async (_s, m) => JSON.stringify(planProgramado(JSON.parse(m[0]!.contenido)))) }];
  const manual = (seed: number, segundos: number) => ({ seed, segundos, local: "auto", visita: "auto", seleccion: { modo: "manual", local: "p", visita: "p" }, presentacion: "buffer" });

  it("C4 · tras-terminada: con el registro final fallido y el narrador lento, el diario termina en `terminada` (estado error), también recuperado", async () => {
    vi.stubEnv("ARENA_BLOB_ENDPOINT", "");
    const directorio = await mkdtemp(join(tmpdir(), "cronista-mesa-cierre-")); rutas.push(directorio);
    const base = almacenLocal(directorio), demoraMs = 1500;
    let fallidos = 0, lentas = 0;
    // Fallo de disco al escribir el registro final del PRIMER encuentro; el resto funciona.
    const almacen = { ...base, escribir: async (n: string, t: string, nuevo?: boolean) => { if (/^[a-f0-9-]{36}\.json$/.test(n) && fallidos++ === 0) throw new Error("disco"); return base.escribir(n, t, nuevo); } };
    const lento = llm(async (_s, m) => { lentas++; await new Promise(r => setTimeout(r, demoraMs)); return JSON.stringify(fiel(m)); });
    const g = new GestorSesiones({ directorio, almacen, ritmoMsPorSegundo: 0, catalogo: () => catalogo, narrador: () => lento, plazoComentaristaMs: demoraMs * 2 });
    const { id } = await g.crear(manual(42, 60));
    await g.esperarFinal(id);
    expect((await g.obtener(id)).estado).toBe("error");
    expect(lentas).toBeGreaterThan(0); // había generaciones en vuelo
    // Otro encuentro retiene el permiso de escritura mientras resuelven las generaciones lentas del primero.
    const { id: otro } = await g.crear(manual(43, 60));
    await g.esperarFinal(otro);
    await new Promise(r => setTimeout(r, demoraMs / 3));
    const s = await g.obtener(id), tipos = s.mensajes.map(m => m.publicacion.tipo);
    expect(tipos.at(-1)).toBe("terminada"); expect(tipos.filter(t => t === "terminada")).toHaveLength(1);
    expect(s.estado).toBe("error"); expect((await g.emision(id)).estado).toBe("error");
    const recuperada = await new GestorSesiones({ directorio, almacen: base }).obtener(id);
    expect(recuperada.estado).toBe("error"); expect(recuperada.mensajes.at(-1)!.publicacion.tipo).toBe("terminada");
    expect((await g.obtener(otro)).estado).toBe("completa");
  });

  it("C5 · narrador y mesa comparten presupuestoLlamadasModelo llamadas por sesión (stub siempre rechazado por V4)", async () => {
    vi.stubEnv("ARENA_BLOB_ENDPOINT", "");
    const directorio = await mkdtemp(join(tmpdir(), "cronista-mesa-presupuesto-")); rutas.push(directorio);
    let llamadas = 0;
    const rechazado = llm(async (_s, m) => {
      llamadas++;
      const r = fiel(m); r.oraciones[0]!.texto_es += " Zacarías Quintanilla aplaude."; r.oraciones[0]!.texto_en += " Zacarías Quintanilla applauds.";
      return JSON.stringify(r);
    });
    const g = new GestorSesiones({ directorio, ritmoMsPorSegundo: 0, catalogo: () => catalogo, narrador: () => rechazado });
    const { id } = await g.crear(manual(42, 90));
    await g.esperarFinal(id);
    const s = await g.obtener(id);
    const comentarios = s.mensajes.filter(m => m.publicacion.tipo === "comentario").length;
    const comentaristas = s.mensajes.flatMap(m => m.publicacion.tipo === "intervencion" && m.publicacion.intervencion.rol === "comentarista" ? [m.publicacion.intervencion] : []);
    // Sin presupuesto, cada generación rechazada pediría dos llamadas: las oportunidades lo superan.
    expect((comentarios + comentaristas.length) * 2).toBeGreaterThan(MESA_ARENA.presupuestoLlamadasModelo);
    expect(llamadas).toBe(MESA_ARENA.presupuestoLlamadasModelo);
    expect(comentaristas.some(i => i.modo === "plantilla" && i.audit.some(a => a.motivos.some(m => m.detalle.includes("Presupuesto de llamadas agotado"))))).toBe(true);
  });
});
