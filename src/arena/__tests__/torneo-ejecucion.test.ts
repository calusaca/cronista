// Brief 059 v1.2 — orquestador sin red: adaptador Azure OpenAI REAL con `fetch` falso que devuelve órdenes válidas
// de `planProgramado`. Transporte (M14, § 16.2, N18), anulación y repetición (M15), parada preventiva (M16),
// reanudación por archivos y libro (M17, N7, N9, N10), cerrojo (M18, N8), CLI en seco y árbol sucio (M19),
// redacción del registro (N15) y participantes del catálogo (§ 3.2, § 15.6).
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ARENA, TORNEO_ARENA as T } from "../../sim/limites";
import { crearControladorLlm, planProgramado } from "../controladores";
import { fabricaLlmReal } from "../smoke-modelos";
import { calendarioTorneo, causaTerminal, microMaxIntento, reservaPartido, resumenTorneo, rondasPartido, type ParticipanteTorneo } from "../torneo";
import { validarTorneo } from "../torneo-validacion";
import {
  ejecutarTorneo, ErrorTorneo, especDe, esperaReintento, jugarEncuentro, leerLibro, liberarCerrojo, nuevoRegistroTransporte, participantesReales, tomarCerrojo,
  transporteTorneo, type CrearControlador, type EntradaCatalogo, type OpcionesTorneo, type PreciosJson,
} from "../torneo-ejecucion";
import { principal, type DepsCli } from "../torneo-cli";
import type { ObservacionArena } from "../tipos";

const CLAVE = "clave-centinela-torneo-059";
const CATALOGO: EntradaCatalogo[] = ["x", "y", "z", "w"].map(id => ({ nombre: `cronista-${id}`, modelo: `modelo-${id}`, version: "1", id, nombrePublico: `GPT-${id.toUpperCase()} Prueba`, llm: "azure-openai", publicar: id !== "w" }));
const PRECIOS: PreciosJson = { fuente: "precios de prueba", consultadoUtc: "2026-10-22T05:39:56.892Z", modelos: ["x", "y", "z"].map((id, i) => ({ deployment: `cronista-${id}`, entrada: 1 + i, salida: 2 + i, cache: 0.1 })) };
const fabrica = fabricaLlmReal({ apiKey: CLAVE, endpointAzureOpenAI: "https://falso.openai.azure.com", baseFoundry: null });
const PARTICIPANTES = participantesReales(["x", "y", "z"], CATALOGO, PRECIOS, espec => fabrica(espec, fetch).id);
const P = 9928;
const MARCO = { duracionS: T.duracionS, intervaloS: T.intervalosS[0], motor: { version: ARENA.version, reglas: ARENA.reglas } };

const deploymentDe = (url: unknown) => decodeURIComponent(String(url).match(/deployments\/([^/]+)/)![1]!);
const ordenesDe = (init?: RequestInit) => {
  const cuerpo = JSON.parse(String(init?.body)) as { messages: { role: string; content: string }[] };
  return JSON.stringify(planProgramado(JSON.parse(cuerpo.messages[1]!.content) as ObservacionArena));
};
const ok = (init?: RequestInit, model = "modelo-devuelto") => Response.json({ model, choices: [{ message: { content: ordenesDe(init) }, finish_reason: "stop" }], usage: { prompt_tokens: 8000, completion_tokens: 400, total_tokens: 8400 } });
const abortError = () => new DOMException("Cancelado", "AbortError");
const crear: CrearControlador = (p, transporte) => crearControladorLlm(fabrica(especDe(p), transporte));

const dirs: string[] = [];
const tmp = () => { const d = mkdtempSync(join(tmpdir(), "torneo-059-")); dirs.push(d); return d; };
afterEach(() => { vi.useRealTimers(); for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

function opciones(base: string, extra: Partial<OpcionesTorneo> = {}): OpcionesTorneo {
  return {
    id: "prueba", tipo: "real", participantes: PARTICIPANTES, semilla: T.semillaDefecto, duracionS: MARCO.duracionS, intervaloS: MARCO.intervaloS, commit: "0123456789abcdef0123456789abcdef01234567",
    topeMicroUsd: 1_000_000_000, tipicoMicroUsd: 1, promptMax: P, dirTrabajo: join(base, "trabajo"), dirTorneos: join(base, "torneos"), dirEvidencia: join(base, "evidencia"),
    orden: "npm run arena:torneo -- prueba", reanudar: false, crearControlador: crear, fetch: (async (_u: unknown, i?: RequestInit) => ok(i)) as typeof fetch, secretos: [CLAVE],
    dormir: async () => {}, ...extra,
  };
}

describe("059 · transporte del torneo (M14, § 16.2)", () => {
  const respuestas = (lista: (() => Response | Promise<Response>)[]) => { let n = 0; const f = vi.fn(async () => { const r = lista[Math.min(n, lista.length - 1)]!; n++; return r(); }); return f; };
  it("respeta retry-after-ms, después retry-after (s) y la tabla; nunca más de esperaMaxMs", () => {
    expect(esperaReintento(new Response("", { status: 429, headers: { "retry-after-ms": "1234", "retry-after": "9" } }), 0)).toBe(1234);
    expect(esperaReintento(new Response("", { status: 429, headers: { "retry-after": "3" } }), 0)).toBe(3000);
    expect(esperaReintento(new Response("", { status: 503 }), 1)).toBe(T.http.esperasMs[1]);
    expect(esperaReintento(null, 0)).toBe(T.http.esperasMs[0]);
    expect(esperaReintento(new Response("", { status: 429, headers: { "retry-after-ms": String(T.http.esperaMaxMs * 10) } }), 0)).toBe(T.http.esperaMaxMs);
    expect(esperaReintento(new Response("", { status: 429, headers: { "retry-after": String(T.http.esperaMaxMs) } }), 0)).toBe(T.http.esperaMaxMs);
  });
  it("reintenta un 429 tras la espera y registra intentos y esperas; el 200 con usage cuenta tokens", async () => {
    vi.useFakeTimers();
    const base = respuestas([() => new Response("lento", { status: 429, headers: { "retry-after-ms": "700" } }), () => Response.json({ model: "m", choices: [], usage: { prompt_tokens: 10, completion_tokens: 3, prompt_tokens_details: { cached_tokens: 4 } } })]);
    const reg = nuevoRegistroTransporte(), f = transporteTorneo(base as unknown as typeof fetch, reg);
    const p = f("https://x", { signal: new AbortController().signal });
    await vi.advanceTimersByTimeAsync(700);
    expect((await p).status).toBe(200);
    expect(base).toHaveBeenCalledTimes(2);
    expect(reg.intentos.map(i => [i.naturaleza, i.status, i.conUso, i.entrada, i.salida, i.cache, i.modelo])).toEqual([["reintentable", 429, false, null, null, null, null], ["ok", 200, true, 10, 3, 4, "m"]]);
    expect(reg.esperas.map(e => [e.ms, e.interrumpida])).toEqual([[700, false]]);
  });
  it("como mucho http.reintentos reintentos; un 400 no se reintenta; un error de red sí", async () => {
    vi.useFakeTimers();
    const siempre503 = respuestas([() => new Response("x", { status: 503 })]);
    const reg = nuevoRegistroTransporte(), p = transporteTorneo(siempre503 as unknown as typeof fetch, reg)("https://x", {});
    await vi.advanceTimersByTimeAsync(T.http.esperaMaxMs * (T.http.reintentos + 1));
    expect((await p).status).toBe(503);
    expect(siempre503).toHaveBeenCalledTimes(1 + T.http.reintentos);
    const r400 = respuestas([() => new Response("x", { status: 400 })]), reg400 = nuevoRegistroTransporte();
    expect((await transporteTorneo(r400 as unknown as typeof fetch, reg400)("https://x", {})).status).toBe(400);
    expect(r400).toHaveBeenCalledTimes(1);
    expect(reg400.intentos.map(i => i.naturaleza)).toEqual(["http_otro"]);
    const red = respuestas([() => { throw new TypeError("fetch failed"); }, () => Response.json({ choices: [] })]), regRed = nuevoRegistroTransporte();
    const pr = transporteTorneo(red as unknown as typeof fetch, regRed)("https://x", {});
    await vi.advanceTimersByTimeAsync(T.http.esperasMs[0]);
    expect((await pr).status).toBe(200);
    expect(regRed.intentos.map(i => i.naturaleza)).toEqual(["red", "ok"]);
  });
  it("se detiene con el AbortSignal durante la espera: AbortError, espera interrumpida y ningún fetch más", async () => {
    vi.useFakeTimers();
    const base = respuestas([() => new Response("x", { status: 429, headers: { "retry-after-ms": "5000" } })]);
    const reg = nuevoRegistroTransporte(), ac = new AbortController();
    const p = transporteTorneo(base as unknown as typeof fetch, reg)("https://x", { signal: ac.signal });
    const fallo = expect(p).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(1000);
    ac.abort();
    await fallo;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(base).toHaveBeenCalledTimes(1);
    expect(reg.esperas).toEqual([expect.objectContaining({ ms: 5000, interrumpida: true })]);
    expect(reg.intentos.map(i => i.naturaleza)).toEqual(["reintentable"]);
  });

  it("§ 16.2 · 429 → espera → plazo: 1 intento reintentable, 1 espera interrumpida, ningún segundo fetch, plazo_agotado por infraestructura y partido anulado", async () => {
    vi.useFakeTimers();
    const marco = { ...MARCO, duracionS: MARCO.intervaloS }; // una sola ronda
    const plan = calendarioTorneo(PARTICIPANTES.map(p => p.id), T.semillaDefecto)[0]!;
    const local = PARTICIPANTES.find(p => p.id === plan.local)!;
    let delLocal = 0;
    const f = (async (url: unknown, init?: RequestInit) => {
      if (deploymentDe(url) !== local.deployment) return ok(init);
      delLocal++;
      return new Promise<Response>((resolver, rechazar) => {
        const t = setTimeout(() => resolver(new Response("lento", { status: 429, headers: { "retry-after-ms": "4000" } })), 2000);
        init?.signal?.addEventListener("abort", () => { clearTimeout(t); rechazar(abortError()); });
      });
    }) as typeof fetch;
    const p = jugarEncuentro({ plan, participantes: PARTICIPANTES, marco, intento: 1, crearControlador: crear, fetch: f, promptMax: P, secretos: [], esperaMs: 5000 });
    await vi.advanceTimersByTimeAsync(30_000); // de sobra: una espera que ignorase la señal llegaría a emitir más fetch
    const r = await p;
    if (r.resultado !== "anulado") throw new Error(`se esperaba anulado, fue ${r.resultado}`);
    expect(delLocal).toBe(1);
    expect(r.causas).toEqual(["ronda 1 · local · plazo_agotado"]);
    expect(r.declarado.local.motivos).toEqual(["plazo_agotado"]);
    expect(r.declarado.local.intentos).toEqual([{ naturaleza: "reintentable", status: 429, conUso: false, ronda: 1 }]);
    expect(r.declarado.local.esperas).toEqual([{ ronda: 1, desdeMs: 2000, ms: 4000, interrumpida: true }]);
    expect(causaTerminal("plazo_agotado", r.declarado.local.intentos, r.declarado.local.esperas)).toBe("infraestructura");
    expect(r.declarado.local.sinUso).toBe(1);
    expect(r.costoMicroUsd).toBeGreaterThanOrEqual(microMaxIntento(local.precio, P));
  });
});

describe("059 · un partido (N15) y participantes (§ 3.2)", () => {
  it("N15 · un registro con un secreto aborta sin redactarlo", async () => {
    const plan = calendarioTorneo(PARTICIPANTES.map(p => p.id), T.semillaDefecto)[0]!;
    const marco = { ...MARCO, duracionS: MARCO.intervaloS };
    const base = { plan, participantes: PARTICIPANTES, marco, intento: 1, crearControlador: crear, fetch: (async (_u: unknown, i?: RequestInit) => ok(i)) as typeof fetch, promptMax: P };
    const valido = await jugarEncuentro({ ...base, secretos: [CLAVE] });
    if (valido.resultado !== "valido") throw new Error("se esperaba un partido válido");
    // El nombre del club local aparece en el registro: tratado como secreto, el registro aborta.
    await expect(jugarEncuentro({ ...base, secretos: [valido.encuentro.local.club] })).rejects.toThrow(/conserva un secreto; se aborta sin redactarlo/);
  }, 30_000);
  it("un id fuera del catálogo, sin publicar o sin precio aborta; gpt-6.1-sol recibe el precio de gpt-6-sol declarado", () => {
    const id = () => "c";
    expect(() => participantesReales(["nada"], CATALOGO, PRECIOS, id)).toThrow(/no está en infra/);
    expect(() => participantesReales(["w"], CATALOGO, PRECIOS, id)).toThrow(/publicar: true/);
    const sinPrecio = { ...PRECIOS, modelos: PRECIOS.modelos.filter(m => m.deployment !== "cronista-y") };
    expect(() => participantesReales(["x", "y"], CATALOGO, sinPrecio, id)).toThrow(/no tiene precio/);
    const catalogo = JSON.parse(readFileSync("infra/modelos-arena.json", "utf8")) as EntradaCatalogo[];
    const precios = JSON.parse(readFileSync("docs/evidencia/modelos-052/precios.json", "utf8")) as PreciosJson;
    const [sol61, sol6] = participantesReales(["sol61", "sol6"], catalogo, precios, espec => fabrica(espec, fetch).id) as [ParticipanteTorneo, ParticipanteTorneo];
    expect(sol61.precio.estimadoDe).toBe("cronista-sol6");
    expect([sol61.precio.entrada, sol61.precio.salida, sol61.precio.cache]).toEqual([sol6.precio.entrada, sol6.precio.salida, sol6.precio.cache]);
    expect(sol6.precio.estimadoDe).toBeNull();
    expect([sol61.controlador, sol61.esfuerzo, sol61.corto, sol61.nombre, sol61.deployment]).toEqual(["azure-openai:cronista-sol61:reasoning-low", "low", "6.1 Sol", "GPT-6.1 Sol", "cronista-sol61"]);
  });
});

describe("059 · torneo completo con reanudación (M17, N7, N9, N10)", () => {
  it("se interrumpe tras 2 partidos; config distinto aborta; reanuda sin rejugar completos, rejuega un par incompleto y cuenta la reserva sin cierre", async () => {
    const base = tmp(), ac = new AbortController();
    let pausas = 0;
    const r1 = await ejecutarTorneo(opciones(base, { signal: ac.signal, dormir: async () => { if (++pausas === 2) { ac.abort(); throw abortError(); } } }));
    expect(r1.codigo).toBe(130);
    const trabajo = join(base, "trabajo");
    expect(["e01.json.gz", "e01.ejecutor.json", "e02.json.gz", "e02.ejecutor.json"].every(f => existsSync(join(trabajo, f)))).toBe(true);
    expect(existsSync(join(trabajo, "cerrojo"))).toBe(false);
    // N10 · config.json distinto aceptado al reanudar → aborta; sin --reanudar → aborta.
    await expect(ejecutarTorneo(opciones(base, { reanudar: true, semilla: T.semillaDefecto + 1 }))).rejects.toThrow(/config.json distinto/);
    await expect(ejecutarTorneo(opciones(base))).rejects.toThrow(/--reanudar/);
    // N9 · par incompleto (sin .gz) → se rejuega P2; N7 · una reserva sin cierre (proceso muerto en P3) cuenta entera.
    rmSync(join(trabajo, "e02.json.gz"));
    appendFileSync(join(trabajo, "gasto.ndjson"), JSON.stringify({ n: 3, intento: 1, tipo: "reserva", microUsd: 12_345 }) + "\n");
    const jugados: number[] = [];
    const r2 = await ejecutarTorneo(opciones(base, { reanudar: true, crearControlador: (p, t, c) => { if (c.lado === "local") jugados.push(c.plan.n); return crear(p, t, c); } }));
    expect(r2.codigo).toBe(0);
    expect(jugados).toEqual([2, 3, 4, 5, 6]);
    const libro = leerLibro(join(trabajo, "gasto.ndjson"));
    expect(libro.filter(m => m.n === 3).map(m => [m.intento, m.tipo])).toEqual([[1, "reserva"], [2, "reserva"], [2, "cierre"]]);
    const cierres = libro.filter(m => m.tipo === "cierre").reduce((s, m) => s + m.microUsd, 0);
    const t = r2.torneo!;
    expect(t.gasto.conocidoMicroUsd).toBe(cierres + 12_345);
    expect([t.estado, t.encuentros.length, t.pendientes]).toEqual(["completo", 6, []]);
    expect(t.encuentros.every(e => e.local.declarado.modelosDevueltos.join() === "modelo-devuelto" && e.local.declarado.intentos.every(i => i.naturaleza === "ok" && i.conUso))).toBe(true);
    // Lo publicado se valida de nuevo, con el índice y la evidencia generados por las mismas funciones.
    const destino = join(base, "torneos", "prueba");
    expect(validarTorneo(JSON.parse(readFileSync(join(destino, "torneo.json"), "utf8")), a => readFileSync(join(destino, a))).id).toBe("prueba");
    expect(JSON.parse(readFileSync(join(base, "torneos", "indice.json"), "utf8"))).toEqual([{ id: "prueba", inicioUtc: t.inicioUtc, titulo: t.titulo }]);
    expect(readFileSync(join(base, "evidencia", "resumen.md"), "utf8")).toBe(resumenTorneo(t));
    expect(readFileSync(join(destino, "torneo.json"), "utf8")).not.toContain(CLAVE);
    // El tope nunca puede bajar del gasto conocido.
    expect((await ejecutarTorneo(opciones(base, { reanudar: true, topeMicroUsd: t.gasto.conocidoMicroUsd - 1 }))).codigo).toBe(3);
  }, 120_000);
});

describe("059 · anulación, repeticiones y tope (M15, M16)", () => {
  const plan = calendarioTorneo(PARTICIPANTES.map(p => p.id), T.semillaDefecto);
  it("M16 · un partido que cabe en el típico pero no en la reserva no empieza: código 3 y cero llamadas", async () => {
    const base = tmp(), f = vi.fn(async (_u: unknown, i?: RequestInit) => ok(i));
    const rondas = rondasPartido(MARCO.duracionS, MARCO.intervaloS);
    const reserva = reservaPartido({ local: PARTICIPANTES.find(p => p.id === plan[0]!.local)!.precio, visita: PARTICIPANTES.find(p => p.id === plan[0]!.visita)!.precio }, P, rondas);
    const r = await ejecutarTorneo(opciones(base, { topeMicroUsd: reserva - 1, tipicoMicroUsd: 1, fetch: f as unknown as typeof fetch }));
    expect(r.codigo).toBe(3);
    expect(f).not.toHaveBeenCalled();
    expect(leerLibro(join(base, "trabajo", "gasto.ndjson"))).toEqual([]);
  });

  it("M15 · el último partido anulado por infraestructura se repite con la misma semilla y lados y queda pendiente; torneo incompleto", async () => {
    const base = tmp(), ultimo = plan.at(-1)!, local = PARTICIPANTES.find(p => p.id === ultimo.local)!;
    let actual = 0;
    const vistos: { n: number; seed: number; local: string; visita: string }[] = [];
    const f = (async (url: unknown, init?: RequestInit) => actual === ultimo.n && deploymentDe(url) === local.deployment ? new Response("rechazada", { status: 400 }) : ok(init)) as typeof fetch;
    const r = await ejecutarTorneo(opciones(base, { fetch: f, crearControlador: (p, t, c) => { actual = c.plan.n; if (c.lado === "local" && c.plan.n === ultimo.n) vistos.push({ n: c.plan.n, seed: c.plan.seed, local: c.plan.local, visita: c.plan.visita }); return crear(p, t, c); } }));
    expect(r.codigo).toBe(0);
    expect(vistos).toEqual(Array(1 + T.repeticionesMax).fill({ n: ultimo.n, seed: ultimo.seed, local: ultimo.local, visita: ultimo.visita }));
    expect([r.torneo!.estado, r.torneo!.pendientes, r.torneo!.encuentros.map(e => e.n)]).toEqual(["incompleto", [ultimo.n], plan.slice(0, -1).map(p => p.n)]);
    const libro = leerLibro(join(base, "trabajo", "gasto.ndjson")).filter(m => m.n === ultimo.n && m.tipo === "cierre");
    expect(libro.map(m => m.tipo === "cierre" && m.resultado)).toEqual(Array(1 + T.repeticionesMax).fill("anulado"));
    // Los anulados suman su coste (cada intento sin usage cuenta su máximo) al gasto conocido.
    expect(libro.every(m => m.microUsd >= microMaxIntento(local.precio, P))).toBe(true);
    expect(r.torneo!.gasto.conocidoMicroUsd).toBeGreaterThan(r.torneo!.encuentros.reduce((s, e) => s + e.local.declarado.costoMicroUsd + e.visita.declarado.costoMicroUsd, 0));
  }, 120_000);

  it("con anuladosSeguidosMax seguidos y trabajo pendiente se detiene con código 2", async () => {
    const base = tmp(), local = PARTICIPANTES.find(p => p.id === plan[0]!.local)!;
    const f = (async (url: unknown, init?: RequestInit) => deploymentDe(url) === local.deployment ? new Response("caída", { status: 400 }) : ok(init)) as typeof fetch;
    const r = await ejecutarTorneo(opciones(base, { fetch: f }));
    expect(r.codigo).toBe(2);
    expect(leerLibro(join(base, "trabajo", "gasto.ndjson")).filter(m => m.tipo === "cierre")).toHaveLength(T.anuladosSeguidosMax);
  }, 60_000);

  it("Ctrl+C dentro de un partido: cierre «interrumpido» con el uso conocido más el máximo del intento cortado, y código 130", async () => {
    const base = tmp(), ac = new AbortController();
    let actual = 0;
    const f = (async (_u: unknown, init?: RequestInit) => {
      if (actual !== 2) return ok(init);
      ac.abort();
      return new Promise<Response>((_, rechazar) => { if (init?.signal?.aborted) rechazar(abortError()); init?.signal?.addEventListener("abort", () => rechazar(abortError())); });
    }) as typeof fetch;
    const r = await ejecutarTorneo(opciones(base, { signal: ac.signal, fetch: f, crearControlador: (p, t, c) => { actual = c.plan.n; return crear(p, t, c); } }));
    expect(r.codigo).toBe(130);
    const cierre = leerLibro(join(base, "trabajo", "gasto.ndjson")).filter(m => m.n === 2 && m.tipo === "cierre");
    expect(cierre).toHaveLength(1);
    expect(cierre[0]).toMatchObject({ resultado: "interrumpido" });
    expect(cierre[0]!.microUsd).toBeGreaterThanOrEqual(Math.min(...PARTICIPANTES.map(p => microMaxIntento(p.precio, P))));
  }, 60_000);
});

describe("059 · cerrojo (M18, N8)", () => {
  it("un segundo proceso aborta; se libera solo con ESRCH; EPERM, vivo o contenido inválido rechazan", () => {
    const dir = tmp();
    const soltar = tomarCerrojo(dir, 4242, new Date());
    expect(() => tomarCerrojo(dir, 4343, new Date())).toThrow(ErrorTorneo);
    const errno = (code: string) => () => { throw Object.assign(new Error(code), { code }); };
    expect(() => liberarCerrojo(dir, errno("EPERM"))).toThrow(/no se puede comprobar/);
    expect(existsSync(join(dir, "cerrojo"))).toBe(true);
    expect(() => liberarCerrojo(dir, () => true)).toThrow(/sigue vivo/);
    expect(liberarCerrojo(dir, errno("ESRCH"))).toMatch(/liberado/);
    expect(existsSync(join(dir, "cerrojo"))).toBe(false);
    soltar();
    writeFileSync(join(dir, "cerrojo"), "no es json");
    expect(() => liberarCerrojo(dir, errno("ESRCH"))).toThrow(/contenido inválido/);
  });
});

describe("059 · CLI (M19)", () => {
  const deps = (argv: string[], extra: Partial<DepsCli> = {}) => {
    const out: string[] = [], err: string[] = [];
    const f = vi.fn(async () => { throw new Error("no debe llamarse"); });
    const base = tmp();
    const d: DepsCli = { argv, raiz: process.cwd(), fetch: f as unknown as typeof fetch, env: () => ({ AZURE_OPENAI_API_KEY: CLAVE, AZURE_OPENAI_ENDPOINT: "https://falso.openai.azure.com" }),
      git: () => ({ porcelana: "", head: "0123456789abcdef0123456789abcdef01234567" }), esTTY: false, preguntar: async () => "", out: s => out.push(s), err: s => err.push(s),
      dormir: async () => {}, dirTrabajoBase: join(base, "cache"), ...extra };
    return { d, f, out, err, base };
  };
  const SEIS = "--participantes equilibrado,rapido,luna6,sol6,astra6,sol61".split(" ");
  it("sin --confirmar imprime la estimación y el calendario de los 6 publicados y no llama a fetch", async () => {
    const { d, f, out, base } = deps(["--id", "2026-10-24", "--tope-usd", String(T.topePropuestoUsd), ...SEIS]);
    expect(await principal(d)).toBe(0);
    expect(f).not.toHaveBeenCalled();
    const texto = out.join("\n");
    expect(texto).toMatch(/6 participantes, 30 partidos/);
    expect(texto).toMatch(/GPT-6\.1 Sol \(† precio estimado con el de cronista-sol6\)/);
    expect(texto).toMatch(/Ensayo en seco/);
    expect(texto.match(/^ {2}J.*· P\d\d/gm)).toHaveLength(30);
    expect(existsSync(join(base, "cache"))).toBe(false);
  });
  it("rechaza un tope mayor que topeMaxUsd, un tope menor que el típico, ids desconocidos y 4 participantes", async () => {
    expect(await principal(deps(["--id", "a", "--tope-usd", String(T.topeMaxUsd + 1), ...SEIS]).d)).toBe(1);
    const bajo = deps(["--id", "a", "--tope-usd", "0.5", ...SEIS]);
    expect(await principal(bajo.d)).toBe(1);
    expect(bajo.out.join("\n")).toMatch(/el tope no alcanza para terminar/);
    expect(await principal(deps(["--id", "a", "--tope-usd", "16", "--participantes", "rapido,luna6,nada"]).d)).toBe(1);
    const cuatro = deps(["--id", "a", "--tope-usd", "16", "--participantes", "rapido,luna6,sol6,astra6"]);
    expect(await principal(cuatro.d)).toBe(1);
    expect(cuatro.err.join()).toMatch(/sin tabla/);
    expect(await principal(deps(["--id", "a", "--tope-usd", "16", "--participantes", "rapido,luna6,sol6"]).d)).toBe(0);
  });
  it("un torneo real con el árbol sucio aborta antes de crear controladores; el ensayo no exige árbol limpio", async () => {
    const sucio = deps(["--id", "real-sucio", "--tope-usd", "16", ...SEIS, "--confirmar"], { git: () => ({ porcelana: " M src/arena/torneo.ts\n?? .cache/x\n", head: "0123456789abcdef0123456789abcdef01234567" }) });
    expect(await principal(sucio.d)).toBe(1);
    expect(sucio.err.join()).toMatch(/Árbol de git con cambios/);
    expect(sucio.f).not.toHaveBeenCalled();
    expect(existsSync(join(sucio.base, "cache"))).toBe(false);
    const soloCache = deps(["--id", "real-cache", "--tope-usd", "16", ...SEIS, "--confirmar"], { git: () => ({ porcelana: "?? .cache/arena-torneos/x\n", head: "zz" }) });
    expect(await principal(soloCache.d)).toBe(1);
    expect(soloCache.err.join()).toMatch(/commit/); // pasó la guarda del árbol (solo .cache/) y se detiene por el commit inválido
    const e = deps(["--ensayo", "--id", "ensayo-cli", "--participantes", "a,b,c", "--segundos", String(T.ensayoSegundos.min), "--tope-usd", "1", "--confirmar"], { git: () => ({ porcelana: " M x\n", head: "0123456789abcdef0123456789abcdef01234567" }) });
    e.d.argv.push("--salida", join(e.base, "salida"));
    expect(await principal(e.d)).toBe(0);
    expect(e.f).not.toHaveBeenCalled();
    const t = validarTorneo(JSON.parse(readFileSync(join(e.base, "salida", "ensayo-cli", "torneo.json"), "utf8")), a => readFileSync(join(e.base, "salida", "ensayo-cli", a)));
    expect([t.tipo, t.estado, t.participantes.map(p => p.controlador)]).toEqual(["ensayo", "completo", ["ensayo:a", "ensayo:b", "ensayo:c"]]);
    expect(await principal(deps(["--ensayo", "--id", "x", "--participantes", "a,b,c", "--segundos", "20", "--tope-usd", "1", "--confirmar", "--salida", "public/torneos"]).d)).toBe(1);
  }, 60_000);
});
