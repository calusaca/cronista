// Brief 062 v1.3 — Gestor del torneo del sitio con almacén falso en memoria y atómico, reloj controlado y
// controladores programados (ensayo) o el adaptador Azure OpenAI real con `fetch` falso. Pruebas S de § 9 con las
// sustituciones de § 17.8, § 18.5 y § 19 (P1-a: liga). Cada mutación de docs/evidencia/torneo-sitio-062 pone en rojo
// la prueba que nombra.
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { ARENA, TORNEO_ARENA as T, TORNEO_SITIO as S } from "../../sim/limites";
import { planProgramado } from "../controladores";
import type { ModeloConfigurado } from "../modelos";
import { GestorSesiones } from "../sesiones";
import { esquemaTorneo062, gastoConocido, esquemaMovimiento, reservaPartido, rondasPartido, validarCoherencia, type ParticipanteTorneo, type Torneo062 } from "../torneo";
import { diaUtc, idDelDia, partidosFormato, planTorneo, semillaDelDia, topeFormatoMicroUsd, tipicoPorDecision } from "../torneo-formatos";
import { participantesEnsayo } from "../torneo-ejecucion";
import { configuracionSitio, ErrorSitio, esquemaManifiesto, type GestorTorneoSitio, type Manifiesto } from "../torneo-sitio";
import { principal, type DepsCli } from "../torneo-cli";
import { validarTorneo } from "../torneo-validacion";
import type { ObservacionArena, RegistroArena } from "../tipos";
import { AlmacenFalso, arrancar, COMMIT, ENTRADAS, envEnsayo, envReal, nuevoGestor, RelojFalso, vaciar, vista } from "./torneo-sitio-ayuda";

const MICRO = 1_000_000, BOLSA = S.bolsaUsd * MICRO, TOPE_LIGA = topeFormatoMicroUsd("liga");
const instantanea = (a: AlmacenFalso, id: string) => esquemaTorneo062.parse(a.json(`${id}.torneo.json`)) as Torneo062;
const libro = (a: AlmacenFalso, id: string) => (a.texto(`${id}.gasto.ndjson`) ?? "").split("\n").filter(Boolean).map(l => esquemaMovimiento.parse(JSON.parse(l)));
const hasta = async (cond: () => boolean, vueltas = 4000) => { for (let i = 0; i < vueltas && !cond(); i++) await vaciar(1); if (!cond()) throw new Error("condición no alcanzada"); };
const motivo = async (p: Promise<unknown>) => { try { await p; return "admitido"; } catch (e) { return e instanceof ErrorSitio ? `${e.status} ${e.motivo}` : `error ${(e as Error).message}`; } };
const conPlazo = <X>(p: Promise<X>, ms: number) => Promise.race([p, new Promise<never>((_, r) => setTimeout(() => r(new Error(`sin terminar en ${ms} ms`)), ms))]);

// --- Inferencia falsa con el adaptador real (como el 059) -----------------------------------------------------------
const deploymentDe = (url: unknown) => decodeURIComponent(String(url).match(/deployments\/([^/]+)/)![1]!);
const ordenesDe = (init?: RequestInit) => {
  const cuerpo = JSON.parse(String(init?.body)) as { messages: { role: string; content: string }[] };
  return JSON.stringify(planProgramado(JSON.parse(cuerpo.messages[1]!.content) as ObservacionArena));
};
/** `fetch` falso: órdenes válidas; `entradaPorLlamada(deployment)` fija los tokens de entrada de cada respuesta. */
function fetchFalso(entradaPorLlamada: (deployment: string) => number = () => 8000) {
  const cuenta = { n: 0 };
  const f = (async (url: unknown, init?: RequestInit) => {
    cuenta.n++;
    const entrada = entradaPorLlamada(deploymentDe(url));
    return Response.json({ model: "m", choices: [{ message: { content: ordenesDe(init) }, finish_reason: "stop" }], usage: { prompt_tokens: entrada, completion_tokens: 0, total_tokens: entrada } });
  }) as typeof fetch;
  return { f, cuenta };
}
const lanzadorCaido = (p: ParticipanteTorneo) => ({ id: p.controlador, tipo: "llm" as const, async decidir(): Promise<never> { throw new Error("infraestructura caída"); } });

// --- Siembra de un almacén con torneos anteriores (manifiesto + instantánea + libro) ------------------------------------
function sembrar(a: AlmacenFalso, o: { id: string; tipo?: "real" | "ensayo"; creadoUtc: string; estado: "cancelado" | "en_curso"; libro?: object[]; libroCrudo?: string }) {
  const prueba = o.id.startsWith("sitio-prueba-"), tipo = o.tipo ?? "real";
  const participantes: ParticipanteTorneo[] = tipo === "real" ? ENTRADAS.participantes : participantesEnsayo(["a", "b", "c", "d", "e", "f"]);
  const m: Manifiesto = esquemaManifiesto.parse({
    version: S.version, id: o.id, formato: "liga", tipo, lanzamiento: prueba ? "prueba" : "publico", participantes, semilla: semillaDelDia(o.creadoUtc.slice(0, 10)),
    duracionS: tipo === "real" ? T.duracionS : T.ensayoSegundos.min, intervaloS: S.intervaloS, motor: { version: ARENA.version, reglas: ARENA.reglas }, commit: COMMIT,
    topeMicroUsd: TOPE_LIGA, tipicoMicroUsd: 0, reservaMaxPartidoMicroUsd: 0, promptMax: ENTRADAS.promptMax.tokens, operacion: randomUUID(), creadoUtc: o.creadoUtc,
  });
  a.archivos.set(prueba ? `prueba-${o.id.slice("sitio-prueba-".length)}.json` : `dia-${o.id.slice("sitio-".length)}.json`, JSON.stringify(m));
  const lineas = (o.libro ?? []).map(x => JSON.stringify(x)).join("\n");
  a.archivos.set(`${o.id}.gasto.ndjson`, o.libroCrudo ?? (lineas ? lineas + "\n" : ""));
  const conocido = o.libroCrudo ? 0 : gastoConocido((o.libro ?? []) as never);
  const t: Torneo062 = {
    version: S.version, id: o.id, tipo, titulo: { es: "Sembrado", en: "Seeded" }, inicioUtc: o.creadoUtc, finUtc: o.estado === "en_curso" ? null : o.creadoUtc, commit: COMMIT, motor: m.motor,
    duracionS: m.duracionS, intervaloS: m.intervaloS, semilla: m.semilla, participantes, pendientes: [], gasto: { conocidoMicroUsd: conocido, tipicoMicroUsd: 0, topeMicroUsd: TOPE_LIGA, reservaMaxPartidoMicroUsd: 0 },
    formato: "liga", origen: "sitio", lanzamiento: m.lanzamiento, estado: o.estado, motivoFin: o.estado === "cancelado" ? "cancelado" : null, enCurso: null, encuentros: [],
  };
  expect(validarCoherencia(esquemaTorneo062.parse(t))).toEqual([]);
  a.archivos.set(`${o.id}.torneo.json`, JSON.stringify(t));
  return m;
}
const latidoAjeno = (a: AlmacenFalso, utcMs: number, proceso = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa") => a.archivos.set(`latido-${proceso}.json`, JSON.stringify({ proceso, utc: new Date(utcMs).toISOString() }));
const reserva = (n: number, microUsd: number) => ({ n, intento: 1, tipo: "reserva", microUsd });

async function preparado(o: { env?: Record<string, string | undefined>; almacen?: AlmacenFalso; reloj?: RelojFalso; deps?: Parameters<typeof nuevoGestor>[0]["deps"] } = {}) {
  const almacen = o.almacen ?? new AlmacenFalso(), reloj = o.reloj ?? new RelojFalso();
  const r = nuevoGestor({ almacen, env: o.env ?? envEnsayo(), reloj, deps: o.deps });
  await arrancar(r.g);
  return { ...r, almacen, reloj };
}
const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map(d => rm(d, { recursive: true, force: true }))); });

// =====================================================================================================================
describe("062 · S17 · liga completa en ensayo", () => {
  it("30 encuentros (partidosFormato), instantánea final completa y coherente, pares en el almacén", async () => {
    const { g, almacen, reloj } = await preparado();
    const parar = reloj.auto();
    try {
      const { id } = await g.lanzar({ formato: "liga", prueba: false });
      expect(id).toBe(idDelDia(diaUtc(reloj.t)));
      await g.esperarActivo();
      const t = instantanea(almacen, id);
      expect(t.estado).toBe("completo");
      expect(t.motivoFin).toBeNull();
      expect(t.encuentros).toHaveLength(partidosFormato("liga").max);
      expect(t.encuentros.map(e => e.n)).toEqual(planTorneo("liga", t.participantes.map(p => p.id), t.semilla, t).map(p => p.n));
      expect(validarCoherencia(t)).toEqual([]);
      for (const e of t.encuentros) expect(almacen.archivos.has(`${id}.${e.archivo}`)).toBe(true);
      expect(g.idActivo).toBeNull();
      // validarTorneo 062 (rama del plan reconstruido) sobre lo escrito: pasa; un gol o unos lados alterados no.
      const leer = (archivo: string) => almacen.archivos.get(`${id}.${archivo}`) as Uint8Array;
      expect(validarTorneo(JSON.parse(almacen.texto(`${id}.torneo.json`)!), leer).id).toBe(id);
      const gol = { ...t, encuentros: t.encuentros.map(e => e.n === 5 ? { ...e, local: { ...e.local, goles: e.local.goles + 1 } } : e) };
      expect(() => validarTorneo(gol, leer)).toThrow();
      const lados = { ...t, encuentros: t.encuentros.map(e => e.n === 16 ? { ...e, local: e.visita, visita: e.local } : e) };
      expect(() => validarTorneo(lados, leer)).toThrow();
    } finally { parar(); }
  });
});

// =====================================================================================================================
describe("062 · S1/S3 · admisión concurrente y torneo activo de ayer", () => {
  it("(a) dos lanzar simultáneos con todo libre ⇒ 1 admitido y 1 × 409", async () => {
    const { g } = await preparado();
    const r = await Promise.all([motivo(g.lanzar({ formato: "liga", prueba: false })), motivo(g.lanzar({ formato: "liga", prueba: false }))]);
    expect(r.filter(x => x === "admitido")).toHaveLength(1);
    expect(r.filter(x => x.startsWith("409"))).toHaveLength(1);
    await g.cancelar();
  });
  it("(a') dos gestores (dos réplicas) sobre el mismo almacén ⇒ exactamente un torneo y un dia-", async () => {
    const almacen = new AlmacenFalso(), reloj = new RelojFalso();
    const a = nuevoGestor({ almacen: vista(almacen, "A"), env: envEnsayo(), reloj }), b = nuevoGestor({ almacen: vista(almacen, "B"), env: envEnsayo(), reloj });
    await arrancar(a.g); b.g.iniciar(); await vaciar(20);
    const r = await Promise.all([motivo(a.g.lanzar({ formato: "liga", prueba: false })), motivo(b.g.lanzar({ formato: "liga", prueba: false }))]);
    expect(r.filter(x => x === "admitido")).toHaveLength(1);
    expect([...almacen.archivos.keys()].filter(n => /^dia-/.test(n))).toHaveLength(1);
    expect([...almacen.archivos.keys()].filter(n => n.endsWith(".torneo.json"))).toHaveLength(1);
    await a.g.cancelar();
  });
  it("(b) S3 · un torneo activo de AYER (reloj pasada la medianoche) ⇒ 409 activo y NO existe dia-<hoy>", async () => {
    const reloj = new RelojFalso("2026-10-26T23:59:58.000Z");
    const { g, almacen } = await preparado({ reloj, env: envEnsayo({ ARENA_TORNEO_SITIO_SIN_RITMO: undefined }) });
    await g.lanzar({ formato: "liga", prueba: false });
    reloj.t += 3_000; // 00:00:01 del 27, sin dejar vencer el latido
    expect(diaUtc(reloj.t)).toBe("2026-10-27");
    expect(await motivo(g.lanzar({ formato: "liga", prueba: false }))).toBe("409 activo");
    expect(almacen.archivos.has("dia-2026-10-27.json")).toBe(false);
    await g.cancelar();
  });
});

// =====================================================================================================================
describe("062 · S2 · día UTC", () => {
  it("23:59:59Z y 00:00:01Z del día siguiente ⇒ admitidos; un segundo lanzamiento el mismo día, aunque el primero terminó ⇒ 409 cupo", async () => {
    const reloj = new RelojFalso("2026-10-26T23:59:59.000Z");
    const { g } = await preparado({ reloj });
    expect((await g.lanzar({ formato: "liga", prueba: false })).id).toBe("sitio-2026-10-26");
    expect((await g.cancelar()).estado).toBe("cancelado");
    reloj.t += 2_000;
    expect((await g.lanzar({ formato: "liga", prueba: false })).id).toBe("sitio-2026-10-27");
    await g.cancelar();
    expect(await motivo(g.lanzar({ formato: "liga", prueba: false }))).toBe("409 cupo");
    expect(g.estado().motivo).toBe("cupo");
  });
});

// =====================================================================================================================
describe("062 · S6 · arranque tras una caída en P7", () => {
  it("el gestor nuevo espera la barrera, cierra «interrumpido» con P1–P6 y la reserva de P7 entera, sin llamar a fetch", async () => {
    const base = new AlmacenFalso(), reloj = new RelojFalso();
    let muertoA = false;
    base.antes = (op, nombre, datos) => { if (op === "anexar" && nombre.endsWith(".gasto.ndjson") && datos?.includes('"n":7,') && datos.includes('"reserva"')) muertoA = true; };
    const fa = fetchFalso();
    const a = nuevoGestor({ almacen: vista(base, "A", () => muertoA), env: envReal(), reloj, deps: { fetch: fa.f } });
    const parar = reloj.auto();
    await arrancar(a.g);
    const { id } = await a.g.lanzar({ formato: "liga", prueba: false });
    await hasta(() => muertoA, 200_000);
    parar();
    const fb = fetchFalso();
    const b = nuevoGestor({ almacen: vista(base, "B"), env: envReal(), reloj, deps: { fetch: fb.f } });
    b.g.iniciar(); await vaciar(30);
    expect(b.g.barrera).toBe("relevo");
    expect(await motivo(b.g.lanzar({ formato: "liga", prueba: false }))).toBe("503 relevo");
    expect(instantanea(base, id).estado).toBe("en_curso");
    for (let i = 0; i < 12 && b.g.barrera; i++) await reloj.avanzar(S.relevoSondeoMs);
    expect(b.g.barrera).toBeNull();
    const t = instantanea(base, id);
    expect([t.estado, t.motivoFin]).toEqual(["interrumpido", "reinicio"]);
    expect(t.encuentros.map(e => e.n)).toEqual([1, 2, 3, 4, 5, 6]);
    const l = libro(base, id), res7 = l.find(x => x.n === 7 && x.tipo === "reserva")!;
    expect(l.some(x => x.n === 7 && x.tipo === "cierre")).toBe(false);
    const cierres = l.filter(x => x.tipo === "cierre").reduce((s, x) => s + x.microUsd, 0);
    expect(t.gasto.conocidoMicroUsd).toBe(cierres + res7.microUsd);
    expect(fb.cuenta.n).toBe(0);
    // Después del cierre, el cupo de ese día queda consumido.
    expect(await motivo(b.g.lanzar({ formato: "liga", prueba: false }))).toBe("409 cupo");
  });
});

// =====================================================================================================================
describe("062 · S6b · cortes entre escrituras", () => {
  it("tras crear dia- y antes de la primera instantánea ⇒ el arranque cierra con 0 partidos y el cupo queda consumido", async () => {
    const base = new AlmacenFalso(), reloj = new RelojFalso();
    let muertoA = false;
    base.antes = (op, nombre) => { if (!muertoA && op === "escribir" && nombre.endsWith(".torneo.json")) { muertoA = true; return new Promise<void>(() => {}); } };
    const a = nuevoGestor({ almacen: vista(base, "A", () => muertoA), env: envEnsayo(), reloj });
    await arrancar(a.g);
    void a.g.lanzar({ formato: "liga", prueba: false });
    await hasta(() => muertoA);
    const b = nuevoGestor({ almacen: vista(base, "B"), env: envEnsayo(), reloj });
    b.g.iniciar();
    for (let i = 0; i < 12 && b.g.barrera; i++) await reloj.avanzar(S.relevoSondeoMs);
    const id = idDelDia(diaUtc(reloj.t)), t = instantanea(base, id);
    expect([t.estado, t.motivoFin, t.encuentros.length]).toEqual(["interrumpido", "reinicio", 0]);
    expect(await motivo(b.g.lanzar({ formato: "liga", prueba: false }))).toBe("409 cupo");
  });
  it("una creación de dia- que persiste pero lanza ⇒ se relee con la misma operación y el torneo sigue", async () => {
    const almacen = new AlmacenFalso();
    let una = true;
    almacen.despues = (op, nombre) => { if (una && op === "crear" && nombre.startsWith("dia-")) { una = false; throw Object.assign(new Error("respuesta perdida"), { statusCode: 500 }); } };
    const { g } = await preparado({ almacen });
    const { id } = await g.lanzar({ formato: "liga", prueba: false });
    expect(instantanea(almacen, id).estado).toBe("en_curso");
    await g.cancelar();
  });
  it("la misma creación con OTRA operación en el almacén ⇒ 409 cupo", async () => {
    const almacen = new AlmacenFalso(), reloj = new RelojFalso();
    almacen.antes = (op, nombre) => {
      if (op === "crear" && nombre.startsWith("dia-") && !almacen.archivos.has(nombre)) {
        const otro = sembrar(new AlmacenFalso(), { id: idDelDia(diaUtc(reloj.t)), tipo: "ensayo", creadoUtc: new Date(reloj.t).toISOString(), estado: "en_curso" });
        almacen.archivos.set(nombre, JSON.stringify(otro));
      }
    };
    const { g } = await preparado({ almacen, reloj });
    expect(await motivo(g.lanzar({ formato: "liga", prueba: false }))).toBe("409 cupo");
    expect(g.idActivo).toBeNull();
  });
  it("un anexo del libro que lanza ⇒ el torneo se detiene: interrumpido / almacen", async () => {
    const almacen = new AlmacenFalso();
    let una = true;
    almacen.antes = op => { if (una && op === "anexar") { una = false; throw new Error("anexo ambiguo"); } };
    const { g } = await preparado({ almacen });
    const { id } = await g.lanzar({ formato: "liga", prueba: false });
    await g.esperarActivo();
    const t = instantanea(almacen, id);
    expect([t.estado, t.motivoFin, t.encuentros.length]).toEqual(["interrumpido", "almacen", 0]);
    expect(g.idActivo).toBeNull();
  });
});

// =====================================================================================================================
describe("062 · S6c · SIGTERM en el solapamiento", () => {
  it("el viejo no escribe nada después de SIGTERM; el nuevo cierra cuando su latido caduca", async () => {
    const base = new AlmacenFalso(), reloj = new RelojFalso();
    const a = nuevoGestor({ almacen: vista(base, "A"), env: envEnsayo(), reloj });
    const parar = reloj.auto();
    await arrancar(a.g);
    const { id } = await a.g.lanzar({ formato: "liga", prueba: false });
    await hasta(() => (base.json<Torneo062>(`${id}.torneo.json`)?.encuentros.length ?? 0) >= 2, 200_000);
    parar();
    a.sigterm();
    const marca = base.ops.length;
    const b = nuevoGestor({ almacen: vista(base, "B"), env: envEnsayo(), reloj });
    b.g.iniciar();
    for (let i = 0; i < 14 && b.g.barrera; i++) await reloj.avanzar(S.relevoSondeoMs);
    await reloj.avanzar(S.latidoMs * 3);
    expect(base.escrituras(marca, o => o.etiqueta === "A")).toEqual([]);
    expect(b.g.barrera).toBeNull();
    const t = instantanea(base, id);
    expect([t.estado, t.motivoFin]).toEqual(["interrumpido", "reinicio"]);
    expect(t.encuentros.length).toBeGreaterThanOrEqual(2);
  });
});

// =====================================================================================================================
describe("062 · S7 · exclusión directa del mutex (sin pasar por el cupo)", () => {
  it("la sección 2 (admisión de prueba) no toca el almacén mientras la 1 (admisión del día) está suspendida", async () => {
    const almacen = new AlmacenFalso();
    let soltar!: () => void;
    const diferido = new Promise<void>(r => { soltar = r; });
    almacen.antes = (op, nombre) => (op === "crear" && nombre.startsWith("dia-") ? diferido : undefined);
    const { g } = await preparado({ almacen });
    const p1 = motivo(g.lanzar({ formato: "liga", prueba: false }));
    await vaciar(10);
    const marca = almacen.ops.length;
    let p2Hecha = false;
    const p2 = motivo(g.lanzar({ formato: "liga", prueba: true })).finally(() => { p2Hecha = true; });
    await vaciar(30);
    expect(almacen.ops.slice(marca)).toEqual([]);
    expect(p2Hecha).toBe(false);
    soltar();
    expect(await p1).toBe("admitido");
    expect(await p2).toBe("409 activo");
    await g.cancelar();
  });
});

// =====================================================================================================================
describe("062 · S7b · barrera de relevo", () => {
  it("con un latido ajeno fresco: motivo relevo, sin cierre ni escrituras salvo el propio latido; al caducar relee los libros y rechaza la bolsa", async () => {
    const base = new AlmacenFalso(), reloj = new RelojFalso(), ahora = reloj.t;
    const ayer = new Date(ahora - 86_400_000).toISOString();
    sembrar(base, { id: idDelDia(ayer.slice(0, 10)), creadoUtc: ayer, estado: "cancelado", libro: [reserva(1, BOLSA - TOPE_LIGA - 2 * MICRO)] });
    const prueba = sembrar(base, { id: "sitio-prueba-0123456789ab", creadoUtc: new Date(ahora - 60_000).toISOString(), estado: "en_curso", libro: [] });
    latidoAjeno(base, ahora);
    const b = nuevoGestor({ almacen: vista(base, "B"), env: envReal(), reloj, deps: { fetch: fetchFalso().f } });
    b.g.iniciar(); await vaciar(30);
    expect(b.g.estado().motivo).toBe("relevo");
    expect(await motivo(b.g.lanzar({ formato: "liga", prueba: false }))).toBe("503 relevo");
    // El proceso viejo sigue: anexa gasto de su prueba y renueva su latido.
    await reloj.avanzar(10_000);
    base.archivos.set(`${prueba.id}.gasto.ndjson`, JSON.stringify(reserva(1, 3 * MICRO)) + "\n");
    latidoAjeno(base, reloj.t);
    await reloj.avanzar(S.latidoCaducoMs - 5_000);
    expect(b.g.barrera).toBe("relevo");
    expect(base.escrituras(0, o => o.etiqueta === "B" && o.nombre !== `latido-${b.g.proceso}.json`)).toEqual([]);
    expect(instantanea(base, prueba.id).estado).toBe("en_curso");
    for (let i = 0; i < 6 && b.g.barrera; i++) await reloj.avanzar(S.relevoSondeoMs);
    expect(b.g.barrera).toBeNull();
    expect(instantanea(base, prueba.id).estado).toBe("interrumpido");
    expect(await motivo(b.g.lanzar({ formato: "liga", prueba: false }))).toBe("422 bolsa");
  });

  /** § 19 · El proceso A juega un torneo; su latido deja de renovarse a partir de `tCorte`. */
  async function escritorQuePierdeElLatido(modo: "falla" | "cuelga") {
    const base = new AlmacenFalso(), reloj = new RelojFalso(), registro: { t: number; op: string; nombre: string; etiqueta: string }[] = [];
    let cortado = false;
    base.antes = (op, nombre) => {
      registro.push({ t: reloj.t, op, nombre, etiqueta: base.etiquetaActual });
      if (cortado && nombre.startsWith("latido-") && base.etiquetaActual === "A") { if (modo === "falla") throw new Error("Blob no responde"); return new Promise<void>(() => {}); }
    };
    const a = nuevoGestor({ almacen: vista(base, "A"), env: envEnsayo({ ARENA_TORNEO_SITIO_SIN_RITMO: undefined }), reloj });
    await arrancar(a.g);
    await a.g.lanzar({ formato: "liga", prueba: false });
    await reloj.avanzar(45_000);
    cortado = true;
    const tCorte = reloj.t;
    const ultimoLatidoA = Math.max(...registro.filter(x => x.etiqueta === "A" && x.nombre.startsWith("latido-") && x.t < tCorte).map(x => x.t));
    const b = nuevoGestor({ almacen: vista(base, "B"), env: envEnsayo(), reloj });
    b.g.iniciar(); await vaciar(20);
    const liberacion: number[] = [];
    for (let i = 0; i < 200; i++) { await reloj.avanzar(1_000); if (b.g.barrera === null && !liberacion.length) liberacion.push(reloj.t); }
    const escriturasA = registro.filter(x => x.etiqueta === "A" && ["crear", "escribir", "anexar", "bytes", "borrar"].includes(x.op) && !x.nombre.startsWith("latido-"));
    return { a, b, escriturasA, ultimoLatidoA, tCorte, liberacion: liberacion[0]! };
  }
  it("§ 19 · una renovación que FALLA silencia al escritor: nada después; la revisión nueva libera la barrera a los 45 s", async () => {
    const r = await escritorQuePierdeElLatido("falla");
    expect(r.a.g.motivoSilencio).toMatch(/renovación/);
    expect(r.escriturasA.filter(x => x.t >= r.tCorte + S.latidoMs)).toEqual([]);
    expect(r.liberacion - r.ultimoLatidoA).toBeGreaterThanOrEqual(S.latidoCaducoMs);
  });
  it("§ 19 · una renovación que se CUELGA: el escritor deja de escribir antes de latidoSilencioS y no escribe nada después", async () => {
    const r = await escritorQuePierdeElLatido("cuelga");
    expect(r.escriturasA.filter(x => x.t >= r.ultimoLatidoA + S.latidoSilencioS * 1000)).toEqual([]);
    expect(r.escriturasA.some(x => x.t >= r.tCorte)).toBe(true); // siguió escribiendo con el latido aún vigente
    expect(r.a.g.motivoSilencio).toMatch(/vencido/);
    expect(r.liberacion - r.ultimoLatidoA).toBeGreaterThanOrEqual(S.latidoCaducoMs);
  });
});

// =====================================================================================================================
describe("062 · S7c · cierre de arranque con reintentos", () => {
  const sembrado = () => {
    const base = new AlmacenFalso(), reloj = new RelojFalso();
    const m = sembrar(base, { id: "sitio-prueba-00000000aaaa", creadoUtc: new Date(reloj.t - 600_000).toISOString(), estado: "en_curso", libro: [reserva(1, 1000)] });
    return { base, reloj, m };
  };
  it("el primer intento falla; a los cierreReintentoMs se reintenta y cierra", async () => {
    const { base, reloj, m } = sembrado();
    let falla = true;
    base.antes = (op, nombre) => { if (falla && op === "escribir" && nombre === `${m.id}.torneo.json`) throw new Error("Blob 503"); };
    const { g } = await preparado({ almacen: base, reloj });
    expect(instantanea(base, m.id).estado).toBe("en_curso");
    expect(g.estado().motivo).toBe("activo");
    falla = false;
    await reloj.avanzar(S.cierreReintentoMs);
    expect(instantanea(base, m.id).estado).toBe("interrumpido");
    expect(instantanea(base, m.id).gasto.conocidoMicroUsd).toBe(1000);
    expect(g.estado().motivo).toBeNull();
  });
  it("Codex #3 · una lectura de la instantánea que falla UNA vez (al recargar): el cierre la relee, la valida y cierra", async () => {
    const { base, reloj, m } = sembrado();
    let fallos = 0;
    base.antes = (op, nombre) => { if (op === "leer" && nombre === `${m.id}.torneo.json` && fallos === 0) { fallos++; throw new Error("Blob 503 transitorio"); } };
    const { g } = await preparado({ almacen: base, reloj });
    expect(fallos).toBe(1);
    expect(instantanea(base, m.id).estado).toBe("interrumpido");
    expect(g.estado().motivo).toBeNull();
  });
  it("Codex #3 · si también falla el primer intento, el reintento o /cerrar la releen y cierran", async () => {
    for (const via of ["reintento", "cerrar"] as const) {
      const { base, reloj, m } = sembrado();
      let fallos = 0;
      base.antes = (op, nombre) => { if (op === "leer" && nombre === `${m.id}.torneo.json` && fallos < 2) { fallos++; throw new Error("Blob 503 transitorio"); } };
      const { g } = await preparado({ almacen: base, reloj });
      expect(fallos).toBe(2);
      expect(instantanea(base, m.id).estado).toBe("en_curso");
      expect(g.estado().motivo).toBe("activo");
      if (via === "reintento") await reloj.avanzar(S.cierreReintentoMs); else expect(await g.cerrar()).toEqual({ pendientes: 0 });
      expect(instantanea(base, m.id).estado).toBe("interrumpido");
      expect(g.estado().motivo).toBeNull();
    }
  });
  it("con fallos durante más de cierrePlazoMs ⇒ motivo cierre y sin más reintentos; POST …/cerrar con token reintenta", async () => {
    const { base, reloj, m } = sembrado();
    let falla = true, intentos = 0;
    base.antes = (op, nombre) => { if (op === "escribir" && nombre === `${m.id}.torneo.json`) { intentos++; if (falla) throw new Error("Blob 503"); } };
    const { g } = await preparado({ almacen: base, reloj });
    for (let t = 0; t <= S.cierrePlazoMs + S.cierreReintentoMs; t += S.latidoMs) await reloj.avanzar(S.latidoMs);
    expect(g.estado().motivo).toBe("cierre");
    const n = intentos;
    for (let t = 0; t < 3 * S.cierreReintentoMs; t += S.latidoMs) await reloj.avanzar(S.latidoMs);
    expect(intentos).toBe(n);
    falla = false;
    expect(await g.cerrar()).toEqual({ pendientes: 0 });
    expect(instantanea(base, m.id).estado).toBe("interrumpido");
    expect(g.estado().motivo).toBeNull();
  });
});

// =====================================================================================================================
describe("062 · S7d · sin el primer latido confirmado", () => {
  it("motivo iniciando, lanzamiento rechazado y ninguna otra escritura", async () => {
    const almacen = new AlmacenFalso();
    almacen.antes = (_op, nombre) => (nombre.startsWith("latido-") ? new Promise<void>(() => {}) : undefined);
    const reloj = new RelojFalso(), { g } = nuevoGestor({ almacen, env: envEnsayo(), reloj });
    g.iniciar(); await vaciar(30);
    expect(g.estado().motivo).toBe("iniciando");
    expect(await motivo(g.lanzar({ formato: "liga", prueba: false }))).toBe("503 iniciando");
    expect(almacen.escrituras(0, o => !o.nombre.startsWith("latido-"))).toEqual([]);
  });
});

// =====================================================================================================================
describe("062 · S8 · tope por estimación", () => {
  it("el partido cuya reserva no cabe NO empieza (fetch = 0 en ese partido): incompleto / tope", async () => {
    const reloj = new RelojFalso(), dia = diaUtc(reloj.t), ids = ENTRADAS.participantes.map(p => p.id);
    const plan = planTorneo("liga", ids, semillaDelDia(dia), { encuentros: [], pendientes: [] }), [p1, p2] = plan;
    const precio = (id: string) => ENTRADAS.participantes.find(p => p.id === id)!.precio, rondas = rondasPartido(T.duracionS, S.intervaloS);
    const res2 = reservaPartido({ local: precio(p2!.local), visita: precio(p2!.visita) }, ENTRADAS.promptMax.tokens, rondas);
    const tip = tipicoPorDecision(ENTRADAS), tip2 = rondas * (tip.get(p2!.local)! + tip.get(p2!.visita)!);
    // P1 cuesta c: con la reserva de P2 no cabe; con su típico sí cabría (la guarda usa la reserva).
    const c = TOPE_LIGA - res2 + Math.floor((res2 - tip2) / 2), porLlamada = c / (2 * rondas);
    const f = fetchFalso(dep => Math.round(porLlamada / ENTRADAS.participantes.find(p => p.deployment === dep)!.precio.entrada));
    const { g, almacen } = await preparado({ reloj, env: envReal(), deps: { fetch: f.f } });
    const parar = reloj.auto();
    try {
      const { id } = await g.lanzar({ formato: "liga", prueba: false });
      await g.esperarActivo();
      const t = instantanea(almacen, id);
      expect([t.estado, t.motivoFin, t.encuentros.map(e => e.n)]).toEqual(["incompleto", "tope", [p1!.n]]);
      expect(f.cuenta.n).toBe(2 * rondas);
      expect(t.gasto.conocidoMicroUsd + res2).toBeGreaterThan(TOPE_LIGA);
      expect(t.gasto.conocidoMicroUsd + tip2).toBeLessThanOrEqual(TOPE_LIGA);
    } finally { parar(); }
  });
});

// =====================================================================================================================
describe("062 · S9 · bolsa", () => {
  const ayer = (reloj: RelojFalso) => new Date(reloj.t - 86_400_000).toISOString();
  it("conocido acumulado + tope > bolsa ⇒ 422 bolsa", async () => {
    const almacen = new AlmacenFalso(), reloj = new RelojFalso();
    sembrar(almacen, { id: idDelDia(ayer(reloj).slice(0, 10)), creadoUtc: ayer(reloj), estado: "cancelado", libro: [reserva(1, BOLSA - TOPE_LIGA + 1)] });
    const { g } = await preparado({ almacen, reloj, env: envReal(), deps: { fetch: fetchFalso().f } });
    expect(g.estado().motivo).toBe("bolsa");
    expect(await motivo(g.lanzar({ formato: "liga", prueba: false }))).toBe("422 bolsa");
  });
  it("justo en la bolsa se admite, y los ensayos no cuentan", async () => {
    const almacen = new AlmacenFalso(), reloj = new RelojFalso();
    sembrar(almacen, { id: idDelDia(ayer(reloj).slice(0, 10)), creadoUtc: ayer(reloj), estado: "cancelado", libro: [reserva(1, BOLSA - TOPE_LIGA)] });
    sembrar(almacen, { id: "sitio-prueba-eeeeeeeeeeee", tipo: "ensayo", creadoUtc: ayer(reloj), estado: "cancelado", libro: [reserva(1, 10 * BOLSA)] });
    const { g } = await preparado({ almacen, reloj, env: envReal(), deps: { fetch: fetchFalso().f } });
    expect(g.estado().bolsa.conocidoMicroUsd).toBe(BOLSA - TOPE_LIGA);
    expect(await motivo(g.lanzar({ formato: "liga", prueba: false }))).toBe("admitido");
    await g.cancelar();
  });
});

describe("062 · S9b · carrera de la bolsa con el cierre", () => {
  it("una admisión que empieza mientras el cierre de A escribe el libro lee el gasto FINAL de A ⇒ 422 bolsa", async () => {
    const almacen = new AlmacenFalso(), reloj = new RelojFalso();
    const previo = new Date(reloj.t - 86_400_000).toISOString();
    sembrar(almacen, { id: idDelDia(previo.slice(0, 10)), creadoUtc: previo, estado: "cancelado", libro: [reserva(1, BOLSA - TOPE_LIGA - 1)] });
    let soltar!: () => void, retenido = false;
    const diferido = new Promise<void>(r => { soltar = r; });
    almacen.antes = (op, nombre, datos) => { if (op === "anexar" && datos?.includes('"interrumpido"')) { retenido = true; return diferido; } };
    const { g } = await preparado({ almacen, reloj, env: envReal(), deps: { fetch: fetchFalso().f } });
    const parar = reloj.auto();
    try {
      // A: liga de prueba (no consume el cupo); se cancela durante un partido.
      const a = await g.lanzar({ formato: "liga", prueba: true });
      await hasta(() => libro(almacen, a.id).some(x => x.tipo === "reserva"), 200_000);
      const cancelada = g.cancelar();
      await hasta(() => retenido, 200_000);
      // B empieza con la escritura del libro de A retenida.
      const b = motivo(g.lanzar({ formato: "liga", prueba: false }));
      await vaciar(20);
      soltar();
      expect(await b).toBe("422 bolsa");
      expect((await cancelada).estado).toBe("cancelado");
      expect(instantanea(almacen, a.id).gasto.conocidoMicroUsd).toBeGreaterThan(0);
    } finally { parar(); }
  });
});

describe("062 · S9c · libro ilegible", () => {
  it("⇒ 503 sin lanzamiento (nunca equivale a gasto cero)", async () => {
    const almacen = new AlmacenFalso(), reloj = new RelojFalso();
    const ayer = new Date(reloj.t - 86_400_000).toISOString();
    sembrar(almacen, { id: idDelDia(ayer.slice(0, 10)), creadoUtc: ayer, estado: "cancelado", libroCrudo: "{esto no es json\n" });
    const { g } = await preparado({ almacen, reloj, env: envReal(), deps: { fetch: fetchFalso().f } });
    expect(g.estado().bolsa.conocidoMicroUsd).toBeNull();
    expect(await motivo(g.lanzar({ formato: "liga", prueba: false }))).toBe("503 bolsa_ilegible");
    expect(almacen.archivos.has(`dia-${diaUtc(reloj.t)}.json`)).toBe(false);
  });
});

// =====================================================================================================================
describe("062 · S10 · cancelación en cada espera", () => {
  /** Reloj cuyas esperas se registran; ninguna avanza sola: si la cancelación no corta una espera, no termina. */
  async function cancelarEn(o: { env: Record<string, string | undefined>; deps?: Parameters<typeof nuevoGestor>[0]["deps"]; espera: (ms: number[]) => boolean; pasos?: number }) {
    const reloj = new RelojFalso(), esperas: number[] = [], dormir = reloj.dormir;
    reloj.dormir = (ms, signal) => { esperas.push(ms); return dormir(ms, signal); };
    const { g, almacen } = await preparado({ reloj, env: o.env, deps: o.deps });
    const { id } = await g.lanzar({ formato: "liga", prueba: false });
    // Solo se avanza en saltos de latido (la espera buscada es más larga) hasta que aparece.
    for (let i = 0; i < 400 && !o.espera(esperas); i++) { if (o.pasos === 0) await vaciar(1); else await reloj.avanzar(S.latidoMs / 2); }
    expect(o.espera(esperas)).toBe(true);
    const t0 = reloj.t;
    const r = await conPlazo(g.cancelar(), 3_000);
    expect(reloj.t - t0).toBeLessThanOrEqual(1_000);
    expect(r).toEqual({ id, estado: "cancelado" });
    const t = instantanea(almacen, id);
    expect([t.estado, t.motivoFin, t.enCurso]).toEqual(["cancelado", "cancelado", null]);
    return { t, almacen, id };
  }
  it("durante el ritmo de reloj", async () => {
    await cancelarEn({ env: envEnsayo({ ARENA_TORNEO_SITIO_SIN_RITMO: undefined }), espera: e => e.some(ms => ms > S.intervaloS * 1000 / 2 && ms <= S.intervaloS * 1000), pasos: 0 });
  });
  it("durante la pausa entre partidos", async () => {
    const { almacen, id } = await cancelarEn({ env: envEnsayo(), espera: e => e.includes(T.pausaEntrePartidosMs), pasos: 0 });
    expect(libro(almacen, id).filter(x => x.tipo === "cierre").map(x => x.resultado)).toEqual(["valido"]);
  });
  it("durante el enfriamiento largo de 10 min (anulados seguidos)", async () => {
    const { almacen, id } = await cancelarEn({ env: envEnsayo(), deps: { crearControlador: lanzadorCaido }, espera: e => e.includes(S.enfriamientoLargoMs) });
    expect(libro(almacen, id).filter(x => x.tipo === "cierre").every(x => x.resultado === "anulado")).toBe(true);
  });
  it("durante una espera del transporte (429 con retry-after largo, reloj real)", async () => {
    const f = (async () => new Response("lento", { status: 429, headers: { "retry-after-ms": String(T.http.esperaMaxMs) } })) as typeof fetch;
    const reloj = new RelojFalso(), { g, almacen } = await preparado({ reloj, env: envReal(), deps: { fetch: f } });
    const { id } = await g.lanzar({ formato: "liga", prueba: false });
    await new Promise(r => setTimeout(r, 200));
    const t0 = Date.now();
    expect((await conPlazo(g.cancelar(), 3_000)).estado).toBe("cancelado");
    expect(Date.now() - t0).toBeLessThan(1_000);
    expect(libro(almacen, id).find(x => x.tipo === "cierre")?.resultado).toBe("interrumpido");
  });
  it("durante una decisión que no termina", async () => {
    const colgado = (p: ParticipanteTorneo) => ({ id: p.controlador, tipo: "llm" as const, decidir: (_o: ObservacionArena, signal?: AbortSignal) => new Promise<never>((_, r) => signal?.addEventListener("abort", () => r(new Error("abortada")))) });
    const reloj = new RelojFalso(), { g, almacen } = await preparado({ reloj, env: envEnsayo(), deps: { crearControlador: colgado } });
    const { id } = await g.lanzar({ formato: "liga", prueba: false });
    await vaciar(20);
    expect((await conPlazo(g.cancelar(), 3_000)).estado).toBe("cancelado");
    expect(libro(almacen, id).find(x => x.tipo === "cierre")?.resultado).toBe("interrumpido");
  });
  it("sin token configurado ⇒ lanzamientos deshabilitados (cancelacion)", async () => {
    const { g } = await preparado({ env: envEnsayo({ ARENA_ADMIN_TOKEN: "corto" }) });
    expect(g.estado().motivo).toBe("cancelacion");
    expect(await motivo(g.lanzar({ formato: "liga", prueba: false }))).toBe("503 cancelacion");
  });
});

// =====================================================================================================================
describe("062 · S10b · liga de prueba con identidad propia", () => {
  const nombresDe = (a: AlmacenFalso, id: string, manifiesto: string) => [...a.archivos.keys()].filter(n => n.startsWith(`${id}.`) || n === manifiesto);
  it("(b) prueba cancelada y después liga pública el mismo día: ids distintos, archivos disjuntos, cupo libre y la bolsa suma los dos", async () => {
    const reloj = new RelojFalso(), { g, almacen } = await preparado({ reloj, env: envReal(), deps: { fetch: fetchFalso().f } });
    const parar = reloj.auto();
    try {
      const prueba = await g.lanzar({ formato: "liga", prueba: true });
      expect(prueba.id).toMatch(/^sitio-prueba-[0-9a-f]{12}$/);
      expect(almacen.archivos.has(`dia-${diaUtc(reloj.t)}.json`)).toBe(false);
      await hasta(() => instantanea(almacen, prueba.id).encuentros.length >= 1, 200_000);
      await g.cancelar();
      const publico = await g.lanzar({ formato: "liga", prueba: false });
      expect(publico.id).toBe(idDelDia(diaUtc(reloj.t)));
      await hasta(() => instantanea(almacen, publico.id).encuentros.length >= 1, 200_000);
      await g.cancelar();
      const a = nombresDe(almacen, prueba.id, `prueba-${prueba.id.slice(-12)}.json`), b = nombresDe(almacen, publico.id, `dia-${diaUtc(reloj.t)}.json`);
      expect(a.length).toBeGreaterThan(3); expect(b.length).toBeGreaterThan(3);
      expect(a.filter(x => b.includes(x))).toEqual([]);
      expect(g.estado().bolsa.conocidoMicroUsd).toBe(gastoConocido(libro(almacen, prueba.id)) + gastoConocido(libro(almacen, publico.id)));
      expect(instantanea(almacen, prueba.id).lanzamiento).toBe("prueba");
    } finally { parar(); }
  });
  it("(c) caída durante la prueba: el gestor nuevo la cierra con la reserva abierta; después se admite la pública y los dos gastos cuentan", async () => {
    const base = new AlmacenFalso(), reloj = new RelojFalso();
    let muertoA = false;
    base.antes = (op, nombre, datos) => { if (op === "anexar" && datos?.includes('"n":2,') && datos.includes('"reserva"')) muertoA = true; };
    const a = nuevoGestor({ almacen: vista(base, "A", () => muertoA), env: envReal(), reloj, deps: { fetch: fetchFalso().f } });
    const parar = reloj.auto();
    await arrancar(a.g);
    const prueba = await a.g.lanzar({ formato: "liga", prueba: true });
    await hasta(() => muertoA, 200_000);
    parar();
    const b = nuevoGestor({ almacen: vista(base, "B"), env: envReal(), reloj, deps: { fetch: fetchFalso().f } });
    b.g.iniciar();
    for (let i = 0; i < 14 && b.g.barrera; i++) await reloj.avanzar(S.relevoSondeoMs);
    const t = instantanea(base, prueba.id), l = libro(base, prueba.id);
    expect([t.estado, t.motivoFin, t.encuentros.length]).toEqual(["interrumpido", "reinicio", 1]);
    expect(t.gasto.conocidoMicroUsd).toBe(gastoConocido(l));
    expect(l.filter(x => x.n === 2).map(x => x.tipo)).toEqual(["reserva"]);
    const publico = await b.g.lanzar({ formato: "liga", prueba: false });
    const nombresPrueba = nombresDe(base, prueba.id, `prueba-${prueba.id.slice(-12)}.json`), nombresPublico = nombresDe(base, publico.id, `dia-${diaUtc(reloj.t)}.json`);
    expect(nombresPrueba.filter(x => nombresPublico.includes(x))).toEqual([]);
    expect(b.g.estado().bolsa.conocidoMicroUsd).toBe(gastoConocido(l) + gastoConocido(libro(base, publico.id)));
    await b.g.cancelar();
  });
  it("(d) una prueba con un torneo público activo ⇒ 409 activo", async () => {
    const { g } = await preparado();
    await g.lanzar({ formato: "liga", prueba: false });
    expect(await motivo(g.lanzar({ formato: "liga", prueba: true }))).toBe("409 activo");
    await g.cancelar();
  });
});

// =====================================================================================================================
describe("062 · S12 · réplica única e interruptor", () => {
  it("ARENA_MAX_REPLICAS ≠ \"1\" con Blob ⇒ motivo replicas; con \"1\" no; con el almacén local no aplica", async () => {
    const blob = new AlmacenFalso(); blob.tipo = "blob";
    const sin = await preparado({ almacen: blob, env: envEnsayo({ ARENA_TORNEO_SITIO_ENSAYO: undefined, ...envReal() }) });
    expect(sin.g.estado().motivo).toBe("replicas");
    expect(await motivo(sin.g.lanzar({ formato: "liga", prueba: false }))).toBe("503 replicas");
    expect(configuracionSitio({ ...envReal(), ARENA_MAX_REPLICAS: "2" }, "blob").motivo).toBe("replicas");
    expect(configuracionSitio({ ...envReal(), ARENA_MAX_REPLICAS: "1" }, "blob").motivo).toBeNull();
    expect(configuracionSitio(envReal(), "local").motivo).toBeNull();
  });
  it("interruptor apagado ⇒ desactivado", async () => {
    expect(configuracionSitio(envEnsayo({ ARENA_TORNEO_SITIO: "0" }), "local").motivo).toBe("desactivado");
    expect(configuracionSitio(envEnsayo({ ARENA_TORNEO_SITIO: undefined }), "local").motivo).toBe("desactivado");
    expect(configuracionSitio(envEnsayo({ CRONISTA_COMMIT: "no-hex" }), "local").motivo).toBe("commit");
    expect(configuracionSitio(envEnsayo({ ARENA_ORIGEN_PUBLICO: undefined }), "local").motivo).toBe("origen");
  });
  it("catálogo: si falta un participante o cambia su deployment ⇒ catalogo", async () => {
    const { g } = await preparado({ env: envReal({ ARENA_SOL61_AZURE_OPENAI_DEPLOYMENT: "otro" }) });
    expect(g.estado().motivo).toBe("catalogo");
    expect(await motivo(g.lanzar({ formato: "liga", prueba: false }))).toBe("422 catalogo");
  });
  it("el formato grupos no se admite en P1-a", async () => {
    const { g } = await preparado();
    expect(await motivo(g.lanzar({ formato: "grupos", prueba: false }))).toBe("422 formato");
    expect(g.estado().formatos.grupos.disponible).toBe(false);
  });
});

// =====================================================================================================================
describe("062 · S13 · intentos por partido y plazo total", () => {
  it("un partido se intenta 1 + repeticionesMax veces y queda pendiente", async () => {
    const reloj = new RelojFalso(), { g, almacen } = await preparado({ reloj, deps: { crearControlador: lanzadorCaido } });
    const parar = reloj.auto();
    try {
      const { id } = await g.lanzar({ formato: "liga", prueba: false });
      await g.esperarActivo();
      const t = instantanea(almacen, id), l = libro(almacen, id);
      expect(l.filter(x => x.n === 1 && x.tipo === "reserva")).toHaveLength(1 + T.repeticionesMax);
      expect(t.pendientes[0]).toBe(1);
      expect([t.estado, t.motivoFin]).toEqual(["incompleto", "infraestructura"]);
    } finally { parar(); }
  });
  it("pasado plazoTotalMs ⇒ incompleto / plazo", async () => {
    const almacen = new AlmacenFalso(), reloj = new RelojFalso();
    let soltar!: () => void, retenido = false;
    const diferido = new Promise<void>(r => { soltar = r; });
    almacen.antes = op => { if (op === "leerBytes" && !retenido) { retenido = true; return diferido; } };
    const { g } = await preparado({ almacen, reloj });
    const { id } = await g.lanzar({ formato: "liga", prueba: false });
    await hasta(() => retenido);
    for (let t = 0; t <= S.plazoTotalMs; t += S.latidoMs) await reloj.avanzar(S.latidoMs);
    soltar();
    await reloj.avanzar(T.pausaEntrePartidosMs);
    await g.esperarActivo();
    const t = instantanea(almacen, id);
    expect([t.estado, t.motivoFin, t.encuentros.length]).toEqual(["incompleto", "plazo", 1]);
  });
});

// =====================================================================================================================
describe("062 · S14 · ritmo de reloj", () => {
  it("cada ronda dura ≥ intervaloS de reloj y tiempoMs es la latencia del controlador, sin la espera", async () => {
    const LATENCIA_MS = 25;
    const lento = (p: ParticipanteTorneo) => ({ id: p.controlador, tipo: "programado" as const, async decidir(obs: ObservacionArena) { await new Promise(r => setTimeout(r, LATENCIA_MS)); return planProgramado(obs); } });
    const almacen = new AlmacenFalso(), reloj = new RelojFalso(), marcas = new Map<string, number>();
    almacen.antes = (op, nombre) => { if (op === "bytes") marcas.set(nombre, reloj.t); };
    const { g } = await preparado({ almacen, reloj, env: envEnsayo({ ARENA_TORNEO_SITIO_SIN_RITMO: undefined }), deps: { crearControlador: lento } });
    const { id } = await g.lanzar({ formato: "liga", prueba: false });
    // El reloj falso está parado: las decisiones (latencia real) terminan, pero el partido no se confirma hasta que el
    // reloj alcanza inicio + intervaloS (una ronda por partido en el ensayo de 10 s).
    await new Promise(r => setTimeout(r, 400));
    const inicio = Date.parse(almacen.json<Torneo062>(`${id}.torneo.json`)!.enCurso!.inicioUtc);
    expect(marcas.size).toBe(0);
    await reloj.avanzar(S.intervaloS * 1000 - 2_000);
    expect(marcas.size).toBe(0);
    await reloj.avanzar(3_000);
    await hasta(() => marcas.size === 1);
    const [nombre, marca] = [...marcas][0]!;
    expect(marca - inicio).toBeGreaterThanOrEqual(S.intervaloS * 1000);
    await g.cancelar();
    const registro = JSON.parse(gunzipSync(almacen.archivos.get(nombre) as Uint8Array).toString("utf8")) as RegistroArena;
    expect(registro.rondas).toHaveLength(rondasPartido(T.ensayoSegundos.min, S.intervaloS));
    for (const r of registro.rondas) for (const d of Object.values(r.decisiones)) { expect(d.tiempoMs).toBeGreaterThanOrEqual(LATENCIA_MS - 5); expect(d.tiempoMs).toBeLessThan(S.intervaloS * 1000 / 2); }
  });
});

// =====================================================================================================================
describe("062 · S15 · convivencia con las sesiones públicas", () => {
  it("con el torneo jugando, GestorSesiones.crear con modelos se admite; ambos terminan; sesiones/ no recibe nada del torneo", async () => {
    const dirSesiones = await mkdtemp(join(tmpdir(), "cronista-062-sesiones-")); dirs.push(dirSesiones);
    const catalogo: ModeloConfigurado[] = [{ publico: { id: "a", nombre: "A", controlador: "a" }, crear: () => ({ id: "a", completar: async (_s, mensajes) => JSON.stringify(planProgramado(JSON.parse(mensajes[0]!.contenido))) }) }];
    const sesiones = new GestorSesiones({ directorio: dirSesiones, ritmoMsPorSegundo: 0, maxLlmDiarias: 1, catalogo: () => catalogo });
    // El torneo «lento» es el del ritmo de reloj (reloj falso parado): sigue en juego mientras la sesión corre en tiempo real.
    const reloj = new RelojFalso(), { g, almacen } = await preparado({ reloj, env: envEnsayo({ ARENA_TORNEO_SITIO_SIN_RITMO: undefined }) });
    const { id } = await g.lanzar({ formato: "liga", prueba: false });
    await reloj.avanzar(1_000);
    expect(g.idActivo).toBe(id);
    const s = await sesiones.crear({ seed: 7, segundos: 1, local: "auto", visita: "auto", seleccion: { modo: "manual", local: "a", visita: "a" } });
    expect(g.idActivo).toBe(id);
    await sesiones.esperarFinal(s.id);
    expect((await sesiones.obtener(s.id)).estado).toBe("completa");
    const parar = reloj.auto();
    try { await g.esperarActivo(); } finally { parar(); }
    const final = instantanea(almacen, id);
    expect([final.estado, final.motivoFin, final.pendientes]).toEqual(["completo", null, []]);
    expect((await readdir(dirSesiones)).filter(n => !n.startsWith(s.id) && !n.startsWith("servicios-"))).toEqual([]);
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("src/arena/torneo-sitio.ts", "utf8")).not.toMatch(/from "\.\/sesiones"/);
  });
});

// =====================================================================================================================
describe("062 · R3 · ensayo nunca con Blob; R4 · el CLI rechaza sitio-", () => {
  it("R3 · ARENA_TORNEO_SITIO_ENSAYO con ARENA_BLOB_ENDPOINT ⇒ desactivado", () => {
    expect(configuracionSitio(envEnsayo(), "local").motivo).toBeNull();
    expect(configuracionSitio(envEnsayo({ ARENA_BLOB_ENDPOINT: "https://cuenta.blob.core.windows.net" }), "local").motivo).toBe("desactivado");
  });
  it("R4 · torneo-cli --id sitio-x ⇒ rechazo antes de nada", async () => {
    const err: string[] = [];
    const d: DepsCli = { argv: ["--id", "sitio-x", "--tope-usd", "1", "--participantes", "a,b,c", "--ensayo"], raiz: process.cwd(), fetch: (async () => { throw new Error("no"); }) as unknown as typeof fetch,
      env: () => ({}), git: () => ({ porcelana: "", head: COMMIT }), esTTY: false, preguntar: async () => "", out: () => {}, err: s => err.push(s) };
    expect(await principal(d)).toBe(1);
    expect(err.join()).toMatch(/sitio-/);
  });
});

void (null as unknown as GestorTorneoSitio);
