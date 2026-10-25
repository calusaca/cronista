// Brief 064 § 8.1.7 · Servicio de la crónica de arena con almacén local en un directorio temporal, reloj inyectable y
// dobles de `Llm` que cuentan llamadas. Cupos, reservas, caché re-verificada, promesa compartida, rótulos y cotas.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MAX_REINTENTOS } from "../../cadena/umbrales";
import type { Llm, Mensaje, OpcionesLlm } from "../../lib/llm";
import { crearLlmEnsayo } from "../../lib/llm-ensayo";
import { borradorDesdeHechos } from "../../lib/llm-stub";
import { CRONICA_ARENA } from "../../sim/limites";
import { conEventos, ev, leerJson, registroConGoles064 } from "../__fixtures__/cronica-064";
import { almacenTorneosLocal } from "../almacen-torneos";
import { archivosCronica, diaUtc, huellaRegistro, jsonEstable } from "../cronica-almacen";
import { cotaConversacion, esquemaCronicaArena, etiquetaRedactor, feedbackAcotado, ServicioCronicas, type ArchivoCronica } from "../cronica";
import { ErrorCronica, resolverFuente, type DepsFuentes } from "../cronica-fuentes";
import { hechosCronicaArena, seleccionCronicaArena } from "../cronica-hechos";
import type { RegistroArena } from "../tipos";

const RAIZ = join(__dirname, "..", "..", "..");
const fuentes: DepsFuentes = {
  async torneo() { return null; },
  async bytesTorneo() { return null; },
  async registroSesion() { throw new Error("sin sesiones"); },
  async archivoEjemplo(nombre) { return JSON.parse(readFileSync(join(RAIZ, "public/experimentos", nombre), "utf8")); },
};

interface Doble extends Llm { llamadas: number; opciones: (OpcionesLlm | undefined)[] }
/** Doble del stub (respuesta correcta) que cuenta llamadas; `antes` corre dentro de cada llamada. */
function doble(modo: "ok" | "lanza" | "rechaza" = "ok", antes?: () => Promise<void> | void, id = "stub"): Doble {
  const d: Doble = {
    id, llamadas: 0, opciones: [],
    async completar(_s: string, ms: Mensaje[], o?: OpcionesLlm) {
      d.llamadas++; d.opciones.push(o);
      await antes?.();
      if (modo === "lanza") throw new Error("proveedor caído");
      const borrador = borradorDesdeHechos(ms[0]!.contenido);
      if (modo === "rechaza") borrador.oraciones.forEach((x) => { x.texto_es += " Hubo 999 remates."; x.texto_en += " There were 999 shots."; });
      return JSON.stringify(borrador);
    },
  };
  return d;
}

const envAntes = { ...process.env };
afterEach(() => { for (const k of ["ARENA_CRONICA_DIARIA"]) { if (envAntes[k] === undefined) delete process.env[k]; else process.env[k] = envAntes[k]; } });

function montar(opts: { llm?: () => Llm; env?: Record<string, string | undefined>; ahora?: { t: number } } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "cronicas-064-"));
  const almacen = almacenTorneosLocal(dir);
  const reloj = opts.ahora ?? { t: Date.parse("2026-10-25T12:00:00Z") };
  let creados = 0;
  const servicio = new ServicioCronicas({
    almacen: async () => { await almacen.iniciar(); return almacen; },
    ahora: () => reloj.t,
    env: () => ({ ARENA_CRONICA_LLM: "1", ...opts.env }),
    fuentes,
    ...(opts.llm ? { crearLlm: () => { creados++; return opts.llm!(); } } : {}),
  });
  return { dir, almacen, servicio, reloj, creados: () => creados, leerArchivo: (h: string) => JSON.parse(readFileSync(join(dir, archivosCronica.cronica(h)), "utf8")) as ArchivoCronica };
}
const duelo = () => leerJson("public/experimentos/arena-duelo-v3.json");
const v8 = () => leerJson("src/arena/__fixtures__/arena-reinicios-v8.json");

describe("064 · huella (I6)", () => {
  it("estable ante reordenar claves; distinta si cambia un evento o un controlador declarado", () => {
    const r = v8();
    const reordenado = JSON.parse(jsonEstable(r)) as RegistroArena;
    const alReves = JSON.parse(JSON.stringify(r, Object.keys(r).reverse())) as RegistroArena;
    expect(huellaRegistro(reordenado)).toBe(huellaRegistro(r));
    expect(huellaRegistro({ ...alReves, ...r })).toBe(huellaRegistro(r));
    const evento = JSON.parse(JSON.stringify(r)) as RegistroArena;
    evento.eventos[0]!.distanciaM += 0.001;
    expect(huellaRegistro(evento)).not.toBe(huellaRegistro(r));
    const controlador = JSON.parse(JSON.stringify(r)) as RegistroArena;
    controlador.rondas[0]!.decisiones.local.controlador = "otro";
    expect(huellaRegistro(controlador)).not.toBe(huellaRegistro(r));
    expect(huellaRegistro(r)).toMatch(/^[a-f0-9]{40}$/);
  });
});

describe("064 · generación, caché y lectura", () => {
  it("primera petición genera (≤ 3 llamadas); la segunda: 0 llamadas y desdeAlmacen; la lectura no llama ni escribe (I7)", async () => {
    const llm = doble();
    const m = montar({ llm: () => llm });
    const a = await m.servicio.generar({ archivo: "duelo" });
    expect(a).toMatchObject({ modo: "llm", provisional: false, desdeAlmacen: false });
    expect(a.url).toBe(`/arena/cronica/${a.huella}`);
    expect(llm.llamadas).toBe(1);
    // Opciones de la llamada: plazo, maxTokens y esquema.
    expect(llm.opciones[0]!.maxTokens).toBe(CRONICA_ARENA.maxTokensSalida);
    expect(llm.opciones[0]!.esquema!.nombre).toBe("cronica_arena");
    expect(llm.opciones[0]!.signal).toBeInstanceOf(AbortSignal);
    const b = await m.servicio.generar({ archivo: "duelo" });
    expect(b).toMatchObject({ huella: a.huella, desdeAlmacen: true });
    expect(llm.llamadas).toBe(1);
    const antes = readFileSync(join(m.dir, archivosCronica.cronica(a.huella)), "utf8");
    const l = await m.servicio.leer(a.huella);
    expect(l!.estado).toBe("lista");
    expect(l!.archivo!.redactor).toMatchObject({ id: "stub", fixture: false });
    expect(l!.archivo!.redactor!.etiqueta).toMatch(/Offline stub/);
    expect(llm.llamadas).toBe(1);
    expect(readFileSync(join(m.dir, archivosCronica.cronica(a.huella)), "utf8")).toBe(antes);
    expect(await m.servicio.leer("0".repeat(40))).toBeNull();
    // La misma huella por la fuente { huella } y por el registro subido.
    expect((await m.servicio.generar({ huella: a.huella })).desdeAlmacen).toBe(true);
    expect((await m.servicio.generar({ registro: duelo() })).huella).toBe(a.huella);
    expect(llm.llamadas).toBe(1);
  });

  it("el ensayo deja una frase corregida (V3) con historia; rótulo de fixture", async () => {
    const m = montar({ llm: crearLlmEnsayo });
    const a = await m.servicio.generar({ archivo: "duelo" });
    const g = m.leerArchivo(a.huella);
    expect(g.cronica.intentos).toBe(2);
    expect(g.cronica.audit[0]!.veredicto.some((x) => x.regla === "V3")).toBe(true);
    expect(g.redactor).toMatchObject({ id: "ensayo", fixture: true });
    expect(g.redactor!.etiqueta).toMatch(/Rehearsal fixture/);
  });

  it("dos peticiones simultáneas de la misma huella = 1 generación (promesa compartida)", async () => {
    let soltar!: () => void;
    const espera = new Promise<void>((r) => { soltar = r; });
    const llm = doble("ok", () => espera);
    const m = montar({ llm: () => llm });
    const p1 = m.servicio.generar({ archivo: "duelo" });
    const p2 = m.servicio.generar({ registro: duelo() });
    await new Promise((r) => setTimeout(r, 50));
    soltar();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.huella).toBe(r2.huella);
    expect(llm.llamadas).toBe(1);
  });

  it("otra huella mientras una generación con modelo está en curso → 429 en-curso con retry-after", async () => {
    let soltar!: () => void;
    const espera = new Promise<void>((r) => { soltar = r; });
    const llm = doble("ok", () => espera);
    const m = montar({ llm: () => llm });
    const p1 = m.servicio.generar({ archivo: "duelo" });
    await new Promise((r) => setTimeout(r, 50));
    const e = await m.servicio.generar({ registro: v8() }).catch((x: ErrorCronica) => x);
    expect(e).toBeInstanceOf(ErrorCronica);
    expect(e).toMatchObject({ status: 429, motivo: "en-curso", retryAfterS: CRONICA_ARENA.reintentoOcupadoS });
    soltar();
    await p1;
  });

  it("la reserva del cupo se escribe ANTES de llamar (mutación: contar después)", async () => {
    let visto: { generaciones: number } | null = null, reservaVista = false;
    const m = montar({ llm: () => doble("ok", () => {
      visto = JSON.parse(readFileSync(join(m.dir, archivosCronica.dia(diaUtc(m.reloj.t))), "utf8"));
      reservaVista = readFileSync(join(m.dir, archivosCronica.reserva(huellaRegistro(duelo()))), "utf8").includes("pendiente");
    }) });
    const a = await m.servicio.generar({ archivo: "duelo" });
    expect(visto).toMatchObject({ generaciones: 1 });
    expect(reservaVista).toBe(true);
    // Al guardar, la reserva se borra.
    expect(() => readFileSync(join(m.dir, archivosCronica.reserva(a.huella)))).toThrow();
  });
});

describe("064 · cupos y actas (I8)", () => {
  it("cupo agotado → acta provisional `cupo` con 0 llamadas; al día siguiente la misma huella pasa a llm", async () => {
    process.env.ARENA_CRONICA_DIARIA = "1";
    const llm = doble();
    const m = montar({ llm: () => llm });
    await m.servicio.generar({ registro: v8() });
    expect(llm.llamadas).toBe(1);
    const b = await m.servicio.generar({ archivo: "duelo" });
    expect(b).toMatchObject({ modo: "acta", provisional: true, motivoActa: "cupo" });
    expect(llm.llamadas).toBe(1);
    expect(m.leerArchivo(b.huella).redactor).toBeNull();
    // Repetir el mismo día: el acta guardada, sin reescribir.
    expect(await m.servicio.generar({ archivo: "duelo" })).toMatchObject({ motivoActa: "cupo", desdeAlmacen: true });
    m.reloj.t += 24 * 3600 * 1000;
    const c = await m.servicio.generar({ archivo: "duelo" });
    expect(c).toMatchObject({ huella: b.huella, modo: "llm", provisional: false });
    expect(llm.llamadas).toBe(2);
  });

  it("ARENA_CRONICA_DIARIA=2 respetado: nunca más de 2 generaciones con modelo en el día", async () => {
    process.env.ARENA_CRONICA_DIARIA = "2";
    const llm = doble();
    const m = montar({ llm: () => llm });
    const fuentesDistintas = [{ archivo: "duelo" as const }, { registro: v8() }, { registro: leerJson("src/arena/__fixtures__/arena-reinicios-v7.json") }, { archivo: "ejemplo" as const }];
    const r = [];
    for (const f of fuentesDistintas) r.push(await m.servicio.generar(f));
    expect(r.map((x) => x.modo)).toEqual(["llm", "llm", "acta", "acta"]);
    expect(llm.llamadas).toBe(2);
    expect(JSON.parse(readFileSync(join(m.dir, archivosCronica.dia(diaUtc(m.reloj.t))), "utf8")).generaciones).toBe(2);
  });

  it("LLM que lanza → acta `error` (provisional) y el cupo contado; cada generación ≤ 1 + MAX_REINTENTOS llamadas", async () => {
    const llm = doble("lanza");
    const m = montar({ llm: () => llm });
    const a = await m.servicio.generar({ archivo: "duelo" });
    expect(a).toMatchObject({ modo: "acta", provisional: true, motivoActa: "error" });
    expect(llm.llamadas).toBe(1 + MAX_REINTENTOS);
    expect(JSON.parse(readFileSync(join(m.dir, archivosCronica.dia(diaUtc(m.reloj.t))), "utf8")).generaciones).toBe(1);
    expect(m.leerArchivo(a.huella).cronica.audit).toHaveLength(1 + MAX_REINTENTOS);
  });

  it("3 rechazos → acta `rechazos` definitiva; una nueva petición no llama", async () => {
    const llm = doble("rechaza");
    const m = montar({ llm: () => llm });
    const a = await m.servicio.generar({ archivo: "duelo" });
    expect(llm.llamadas).toBe(1 + MAX_REINTENTOS);
    expect(a).toMatchObject({ modo: "acta", provisional: false, motivoActa: "rechazos" });
    expect(await m.servicio.generar({ archivo: "duelo" })).toMatchObject({ desdeAlmacen: true, motivoActa: "rechazos" });
    expect(llm.llamadas).toBe(1 + MAX_REINTENTOS);
  });

  it("sin ARENA_CRONICA_LLM → `desactivado` sin crear el LLM", async () => {
    const m = montar({ llm: () => doble(), env: { ARENA_CRONICA_LLM: undefined } });
    const a = await m.servicio.generar({ archivo: "duelo" });
    expect(a).toMatchObject({ modo: "acta", provisional: true, motivoActa: "desactivado" });
    expect(m.creados()).toBe(0);
  });

  it("ARENA_CRONICA_MODELO fuera del catálogo → `redactor` (no tumba la petición)", async () => {
    const m = montar({ env: { ARENA_CRONICA_MODELO: "no-existe", ARENA_WEB_LLM: "1" } });
    expect(await m.servicio.generar({ archivo: "duelo" })).toMatchObject({ modo: "acta", motivoActa: "redactor", provisional: true });
  });

  it("los obligatorios no caben → acta `tamano` definitiva, sin reservar ni llamar", async () => {
    const llm = doble();
    const m = montar({ llm: () => llm });
    const r = registroConGoles064(40);
    expect(seleccionCronicaArena(r).cabe).toBe(false);
    const a = await m.servicio.generar({ registro: r }).catch((e) => e);
    // El registro sintético no pasa reproducirArena: se guarda por la vía interna del servicio.
    expect(a).toBeInstanceOf(ErrorCronica);
    const g = await (m.servicio as unknown as { procesar: (...x: unknown[]) => Promise<unknown> }).procesar(await m.almacen.iniciar().then(() => m.almacen), huellaRegistro(r), r, { tipo: "subida", contexto: { forma: "importado" } });
    expect(g).toMatchObject({ modo: "acta", provisional: false, motivoActa: "tamano" });
    expect(llm.llamadas).toBe(0);
    expect(m.creados()).toBe(0);
    expect(() => readFileSync(join(m.dir, archivosCronica.dia(diaUtc(m.reloj.t))), "utf8")).not.toThrow();
    expect(JSON.parse(readFileSync(join(m.dir, archivosCronica.dia(diaUtc(m.reloj.t))), "utf8")).generaciones).toBe(0);
  });
});

describe("064 · reservas, registros diarios y validez al leer (I9)", () => {
  it("reserva pendiente reciente → 429 en-curso; vieja → acta `abandonada`", async () => {
    const llm = doble();
    const m = montar({ llm: () => llm });
    await m.almacen.iniciar();
    const h = huellaRegistro((await resolverFuente({ archivo: "duelo" }, fuentes)).registro);
    writeFileSync(join(m.dir, archivosCronica.reserva(h)), JSON.stringify({ estado: "pendiente", desdeUtc: new Date(m.reloj.t - 1000).toISOString() }));
    expect(await m.servicio.generar({ archivo: "duelo" }).catch((e) => e)).toMatchObject({ status: 429, motivo: "en-curso" });
    expect(llm.llamadas).toBe(0);
    m.reloj.t += CRONICA_ARENA.reservaAbandonadaMs;
    expect(await m.servicio.generar({ archivo: "duelo" })).toMatchObject({ modo: "acta", provisional: true, motivoActa: "abandonada" });
    expect(llm.llamadas).toBe(0);
    // Sin reserva, la siguiente con redactor y cupo la sustituye.
    expect(await m.servicio.generar({ archivo: "duelo" })).toMatchObject({ modo: "llm" });
    expect(llm.llamadas).toBe(1);
  });

  it("registrosDiarios agotado → 429 solo con huella nueva", async () => {
    const m = montar({ llm: () => doble() });
    await m.almacen.iniciar();
    await m.servicio.generar({ archivo: "duelo" });
    writeFileSync(join(m.dir, archivosCronica.dia(diaUtc(m.reloj.t))), JSON.stringify({ generaciones: 0, registros: CRONICA_ARENA.registrosDiarios }));
    expect(await m.servicio.generar({ registro: v8() }).catch((e) => e)).toMatchObject({ status: 429, motivo: "registros-diarios" });
    expect((await m.servicio.generar({ archivo: "duelo" })).desdeAlmacen).toBe(true);
  });

  it("crónica guardada manipulada → `invalida` sin prosa; el POST no la sirve (mutación: servir sin re-verificar)", async () => {
    const llm = doble();
    const m = montar({ llm: () => llm });
    const a = await m.servicio.generar({ archivo: "duelo" });
    const g = m.leerArchivo(a.huella);
    g.cronica.oraciones[0]!.texto_es += " Hubo 999 remates.";
    g.cronica.oraciones[0]!.texto_en += " There were 999 shots.";
    writeFileSync(join(m.dir, archivosCronica.cronica(a.huella)), JSON.stringify(g));
    const l = await m.servicio.leer(a.huella);
    expect(l!.estado).toBe("invalida");
    expect(l!.archivo).toBeUndefined();
    const b = await m.servicio.generar({ archivo: "duelo" });
    expect(b.desdeAlmacen).toBe(false);
    expect(llm.llamadas).toBe(2);
    expect((await m.servicio.leer(a.huella))!.estado).toBe("lista");
  });

  it("`analista` distinto → `desactualizada`", async () => {
    const m = montar({ llm: () => doble() });
    const a = await m.servicio.generar({ archivo: "duelo" });
    const g = m.leerArchivo(a.huella);
    writeFileSync(join(m.dir, archivosCronica.cronica(a.huella)), JSON.stringify({ ...g, analista: "hechos-arena-v0" }));
    const l = await m.servicio.leer(a.huella);
    expect(l!.estado).toBe("desactualizada");
    expect(l!.archivo).toBeUndefined();
  });

  it("v1.2 · un registro que obliga a recortar: generar y releer → `lista` con los mismos ids", async () => {
    const base = leerJson("src/arena/__fixtures__/arena-reinicios-v8.json");
    const r = conEventos(base, [...base.eventos, ...Array.from({ length: 30 }, (_, k) => ev(10 + k * 12, "fuera_juego", k % 2 ? "local" : "visita", k % 2 ? "local-10" : "visita-9")),
      ...Array.from({ length: 6 }, (_, k) => ev(15 + k * 60, "amarilla", k % 2 ? "local" : "visita", k % 2 ? `local-${k + 1}` : `visita-${k + 1}`))]);
    const todos = hechosCronicaArena(r);
    const m = montar({ llm: () => doble() });
    await m.almacen.iniciar();
    const h = huellaRegistro(r);
    const g = await (m.servicio as unknown as { procesar: (...x: unknown[]) => Promise<{ modo: string }> }).procesar(m.almacen, h, r, { tipo: "subida", contexto: { forma: "importado" } });
    expect(g.modo).toBe("llm");
    const l = await m.servicio.leer(h);
    expect(l!.estado).toBe("lista");
    const ids = seleccionCronicaArena(r).hechos.map((x) => x.hecho.id);
    expect(l!.hechos.map((x) => x.hecho.id)).toEqual(ids);
    expect(new Set(l!.archivo!.cronica.oraciones.map((o) => o.hecho))).toEqual(new Set(ids));
    expect(ids.length).toBeLessThanOrEqual(todos.length);
  });
});

describe("064 · cotas ejecutables (§ 4.5)", () => {
  it("esquema con 24 hechos ≤ maxCaracteresEsquema; maxItems = hechos.length", () => {
    const hechos = Array.from({ length: CRONICA_ARENA.maxHechos }, (_, i) => ({ id: `c${String(i + 1).padStart(2, "0")}` }));
    const e = esquemaCronicaArena(hechos);
    expect(JSON.stringify(e).length).toBeLessThanOrEqual(CRONICA_ARENA.maxCaracteresEsquema);
    expect(((e.properties as Record<string, { maxItems?: number }>).oraciones!).maxItems).toBe(CRONICA_ARENA.maxHechos);
  });
  it("feedbackAcotado corta por línea y termina con «- … y N motivos más.»", () => {
    const motivos = Array.from({ length: 400 }, (_, i) => ({ oracion: i, regla: "V3" as const, detalle: `el número ${i} no está en el hecho` }));
    const f = feedbackAcotado(motivos);
    expect(f.length).toBeLessThanOrEqual(CRONICA_ARENA.maxCaracteresFeedback);
    expect(f).toMatch(/- … y \d+ motivos más\.\n/);
    expect(feedbackAcotado(motivos.slice(0, 2))).not.toMatch(/motivos más/);
  });
  it("cota de la conversación = entrada + esquema + 2 × (feedback + respuesta)", () => {
    expect(cotaConversacion()).toBe(CRONICA_ARENA.maxCaracteresEntrada + CRONICA_ARENA.maxCaracteresEsquema + 2 * (CRONICA_ARENA.maxCaracteresFeedback + CRONICA_ARENA.maxCaracteresRespuesta));
  });
  it("rótulos del redactor: nombre público del catálogo para modelos reales", () => {
    expect(etiquetaRedactor("azure-openai:cronista-sol61").etiqueta).toBe("GPT-6.1 Sol · Azure OpenAI");
    expect(etiquetaRedactor("azure-openai:cronista-sol61:reasoning-low").etiqueta).toBe("GPT-6.1 Sol · Azure OpenAI");
    expect(etiquetaRedactor("ensayo")).toMatchObject({ fixture: true });
    expect(etiquetaRedactor("stub").etiqueta).toMatch(/Offline stub/);
  });
});
