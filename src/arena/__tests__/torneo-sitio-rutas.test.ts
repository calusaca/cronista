// Brief 062 v1.3 · Rutas del torneo del sitio llamadas como funciones (sin servidor): S4 (limitador con el último salto
// de XFF), S5 (orden de las comprobaciones sin tocar el almacén), H1 (origen completo, cuerpo lento y `liberar` en
// `finally`), R1 (archivo solo desde el manifiesto, caché e ids), la cancelación y el cierre con token, S10b (a) y R5
// (bicep: réplica única, gracia y ninguna variable de ensayo).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { TORNEO_ARENA as T, TORNEO_SITIO as S } from "../../sim/limites";
import { GET as getEstado, POST as postLanzar } from "../../app/api/arena/torneos/sitio/route";
import { GET as getTorneo } from "../../app/api/arena/torneos/sitio/[id]/route";
import { GET as getArchivo } from "../../app/api/arena/torneos/sitio/[id]/[archivo]/route";
import { POST as postCancelar } from "../../app/api/arena/torneos/sitio/cancelar/route";
import { POST as postCerrar } from "../../app/api/arena/torneos/sitio/cerrar/route";
import type { Torneo062 } from "../torneo";
import { diaUtc } from "../torneo-formatos";
import { claveLimitador, GestorTorneoSitio } from "../torneo-sitio";
import { AlmacenFalso, arrancar, envEnsayo, nuevoGestor, ORIGEN, RelojFalso, TOKEN, vaciar } from "./torneo-sitio-ayuda";

const global = globalThis as typeof globalThis & { __cronistaTorneoSitio?: GestorTorneoSitio };
afterEach(() => { delete global.__cronistaTorneoSitio; });
function instalar(env: Record<string, string | undefined> = envEnsayo(), reloj = new RelojFalso()) {
  const almacen = new AlmacenFalso(), r = nuevoGestor({ almacen, env, reloj });
  global.__cronistaTorneoSitio = r.g;
  return { ...r, almacen, reloj };
}
const URL_SITIO = `${ORIGEN}/api/arena/torneos/sitio`;
const post = (o: { cuerpo?: BodyInit | null; origin?: string | null; tipo?: string | null; xff?: string; consulta?: string; auth?: string } = {}) => {
  const headers = new Headers();
  if (o.origin !== null) headers.set("origin", o.origin ?? ORIGEN);
  if (o.tipo !== null) headers.set("content-type", o.tipo ?? "application/json");
  if (o.xff) headers.set("x-forwarded-for", o.xff);
  if (o.auth) headers.set("authorization", o.auth);
  return postLanzar(new Request(`${URL_SITIO}${o.consulta ?? ""}`, { method: "POST", headers, body: o.cuerpo === undefined ? JSON.stringify({ formato: "liga" }) : o.cuerpo, ...(o.cuerpo instanceof ReadableStream ? { duplex: "half" } : {}) } as RequestInit));
};
const ctx = <P extends object>(p: P) => ({ params: Promise.resolve(p) });

describe("062 · S5 · orden de las comprobaciones: ninguna de las previas toca el almacén", () => {
  const casos: [string, Record<string, string | undefined>, Parameters<typeof post>[0], number][] = [
    ["interruptor apagado", { ARENA_TORNEO_SITIO: "0" }, {}, 503],
    ["sin CRONISTA_COMMIT", { CRONISTA_COMMIT: undefined }, {}, 503],
    ["sin ARENA_ORIGEN_PUBLICO", { ARENA_ORIGEN_PUBLICO: undefined }, {}, 503],
    ["origen ajeno", {}, { origin: "https://evil.example" }, 403],
    ["sin Origin", {}, { origin: null }, 403],
    ["sin JSON", {}, { tipo: "text/plain" }, 415],
    ["cuerpo > 1 KB", {}, { cuerpo: JSON.stringify({ formato: "liga", relleno: "x".repeat(S.admision.cuerpoMaxBytes) }) }, 413],
    ["cuerpo con otro formato", {}, { cuerpo: JSON.stringify({ formato: "copa" }) }, 400],
    ["cuerpo con un campo extra", {}, { cuerpo: JSON.stringify({ formato: "liga", semilla: 1 }) }, 400],
    ["cuerpo vacío", {}, { cuerpo: "" }, 400],
  ];
  for (const [nombre, env, peticion, status] of casos) it(`${nombre} ⇒ ${status} y 0 operaciones de almacén`, async () => {
    const { almacen } = instalar(envEnsayo(env));
    expect((await post(peticion)).status).toBe(status);
    await vaciar(5);
    expect(almacen.ops).toEqual([]);
  });
});

describe("062 · S4 · limitador con el ÚLTIMO salto de x-forwarded-for", () => {
  it("claveLimitador toma el último salto (el que añade el ingreso) o «desconocida»", () => {
    expect(claveLimitador("6.6.6.6, 1.1.1.1")).toBe("1.1.1.1");
    expect(claveLimitador(" 1.1.1.1 ")).toBe("1.1.1.1");
    expect(claveLimitador(null)).toBe("desconocida");
  });
  it("un primer salto falsificado no cambia la clave: el 4.º intento por hora ⇒ 429 con retry-after", async () => {
    instalar();
    for (const falso of ["6.6.6.6", "7.7.7.7", "8.8.8.8"]) expect((await post({ cuerpo: "{}", xff: `${falso}, 1.1.1.1` })).status).toBe(400);
    const r = await post({ cuerpo: "{}", xff: "9.9.9.9, 1.1.1.1" });
    expect(r.status).toBe(429);
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await post({ cuerpo: "{}", xff: "9.9.9.9, 1.1.1.2" })).status).toBe(400);
  });
});

describe("062 · H1 · origen completo y cuerpo lento", () => {
  it("otro esquema u otro puerto ⇒ 403", async () => {
    instalar();
    expect((await post({ origin: ORIGEN.replace("http:", "https:") })).status).toBe(403);
    expect((await post({ origin: ORIGEN.replace(":3000", ":3001") })).status).toBe(403);
    expect((await post({ origin: "null" })).status).toBe(403);
  });
  it("un cuerpo lento ⇒ 408 a los cuerpoPlazoMs y la petición siguiente se admite (el limitador quedó libre)", async () => {
    instalar();
    const lento = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode('{"formato":')); } });
    const t0 = Date.now(), r = await post({ cuerpo: lento, xff: "2.2.2.2" });
    expect(r.status).toBe(408);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(S.cuerpoPlazoMs - 50);
    expect((await post({ cuerpo: "{}", xff: "2.2.2.2" })).status).toBe(400);
  });
});

describe("062 · Codex #4 · cancelación del cuerpo que no termina", () => {
  it("vence el plazo con un flujo cuya cancelación nunca resuelve ⇒ 408 a tiempo y el limitador queda libre", async () => {
    instalar();
    const colgado = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode('{"formato":')); }, cancel: () => new Promise<void>(() => {}) });
    const t0 = Date.now(), r = await Promise.race([post({ cuerpo: colgado, xff: "4.4.4.4" }), new Promise<never>((_, x) => setTimeout(() => x(new Error("la ruta no respondió")), S.cuerpoPlazoMs + 2_000))]);
    expect(r.status).toBe(408);
    expect(Date.now() - t0).toBeLessThan(S.cuerpoPlazoMs + 1_000);
    expect((await post({ cuerpo: "{}", xff: "4.4.4.4" })).status).toBe(400);
  });
});

describe("062 · Codex #5 · el despliegue vuelve a comprobar el torneo activo justo antes de ARM", () => {
  it("una comprobación antes de compilar en ACR y otra inmediatamente antes de deployment group create", () => {
    const script = readFileSync("scripts/deploy-azure-arena.mjs", "utf8");
    const acr = script.indexOf('az(["acr", "build"'), arm = script.indexOf('az(["deployment", "group", "create"');
    const llamadas = [...script.matchAll(/await comprobarTorneoActivo\(\);/g)].map(x => x.index!);
    expect(llamadas.some(i => i < acr)).toBe(true);
    const ultima = Math.max(...llamadas.filter(i => i < arm));
    expect(ultima).toBeGreaterThan(acr);
    expect(script.slice(ultima, arm).split("\n").length).toBeLessThanOrEqual(2);
  });
});

describe("062 · rutas de lectura (R1) y estado", () => {
  it("GET estado: fichas de los dos formatos calculadas, motivo y no-store", async () => {
    const { g } = instalar();
    await arrancar(g);
    const r = await getEstado();
    expect(r.headers.get("cache-control")).toBe("no-store");
    const e = await r.json();
    expect(e.motivo).toBeNull();
    expect(e.formatos.liga.partidos).toEqual({ min: 30, max: 30 });
    expect(e.formatos.grupos.disponible).toBe(false);
    expect(e.bolsa.bolsaMicroUsd).toBe(S.bolsaUsd * 1_000_000);
  });
  it("R1 · [archivo] fuera del manifiesto ⇒ 404; bytes con la huella; [id] inválido o inexistente ⇒ 404; caché según el estado", async () => {
    const { g, almacen, reloj } = instalar();
    await arrancar(g);
    const parar = reloj.auto();
    let id: string;
    try {
      const r = await post();
      expect(r.status).toBe(202);
      id = (await r.json()).id;
      await g.esperarActivo();
    } finally { parar(); }
    const rt = await getTorneo(new Request(`${URL_SITIO}/${id}`), ctx({ id }));
    expect(rt.status).toBe(200);
    expect(rt.headers.get("cache-control")).toBe("public, max-age=300");
    const t = await rt.json() as Torneo062;
    expect(t.estado).toBe("completo");
    const e1 = t.encuentros[0]!, ra = await getArchivo(new Request(`${URL_SITIO}/${id}/${e1.archivo}`), ctx({ id, archivo: e1.archivo }));
    expect(ra.status).toBe(200);
    expect(ra.headers.get("content-type")).toBe("application/gzip");
    expect(ra.headers.get("cache-control")).toBe("public, max-age=86400, immutable");
    expect(createHash("sha256").update(new Uint8Array(await ra.arrayBuffer())).digest("hex")).toBe(e1.archivoSha256);
    // Un .gz plantado que no está en el manifiesto no se sirve, aunque exista en el almacén.
    almacen.archivos.set(`${id}.e31.json.gz`, new Uint8Array([1, 2, 3]));
    for (const archivo of ["..", "e7", "e99.json.gz", "torneo.json", "e31.json.gz", `../${id}.e01.json.gz`]) expect((await getArchivo(new Request(`${URL_SITIO}/${id}/x`), ctx({ id, archivo }))).status).toBe(404);
    for (const otro of ["../x", "sitio-x", "2026-10-24", "sitio-2020-01-01"]) expect((await getTorneo(new Request(`${URL_SITIO}/x`), ctx({ id: otro }))).status).toBe(404);
    // Un torneo en curso se sirve sin caché.
    const prueba = await post({ consulta: "?prueba=1", auth: `Bearer ${TOKEN}` });
    expect(prueba.status).toBe(202);
    const idPrueba = (await prueba.json()).id as string;
    expect(idPrueba).toMatch(/^sitio-prueba-/);
    const enCurso = await getTorneo(new Request(`${URL_SITIO}/${idPrueba}`), ctx({ id: idPrueba }));
    expect([enCurso.status, enCurso.headers.get("cache-control"), (await enCurso.json()).estado]).toEqual([200, "no-store", "en_curso"]);
    await g.cancelar();
  });
  it("una instantánea que no supera la coherencia ⇒ 409 sin cifras", async () => {
    const { almacen } = instalar();
    almacen.archivos.set("sitio-2026-10-20.torneo.json", JSON.stringify({ version: S.version, id: "sitio-2026-10-20" }));
    const r = await getTorneo(new Request(`${URL_SITIO}/sitio-2026-10-20`), ctx({ id: "sitio-2026-10-20" }));
    expect(r.status).toBe(409);
    expect(Object.keys(await r.json())).toEqual(["error"]);
  });
});

describe("062 · cancelación y cierre con token (§ 17.6, § 18.2) y S10b (a)", () => {
  it("sin token o con uno incorrecto ⇒ 401; sin torneo ⇒ 404; con torneo ⇒ 200 cancelado; los fallos se limitan por hora", async () => {
    const { g } = instalar();
    await arrancar(g);
    const cancelar = (auth?: string) => postCancelar(new Request(`${URL_SITIO}/cancelar`, { method: "POST", headers: auth ? { authorization: auth } : {} }));
    expect((await cancelar()).status).toBe(401);
    expect((await cancelar(`Bearer ${TOKEN}x`)).status).toBe(401);
    expect((await cancelar(`Bearer ${TOKEN}`)).status).toBe(404);
    expect((await post()).status).toBe(202);
    const r = await cancelar(`Bearer ${TOKEN}`);
    expect(r.status).toBe(200);
    expect((await r.json()).estado).toBe("cancelado");
    for (let i = 2; i < S.admin.fallosPorHora; i++) expect((await cancelar("Bearer malo")).status).toBe(401);
    const bloqueado = await cancelar(`Bearer ${TOKEN}`);
    expect(bloqueado.status).toBe(429);
    expect(Number(bloqueado.headers.get("retry-after"))).toBeGreaterThan(0);
  });
  it("sin ARENA_ADMIN_TOKEN configurado ⇒ la ruta responde 503 cancelacion y los lanzamientos se deshabilitan", async () => {
    const { g } = instalar(envEnsayo({ ARENA_ADMIN_TOKEN: undefined }));
    await arrancar(g);
    const r = await postCancelar(new Request(`${URL_SITIO}/cancelar`, { method: "POST", headers: { authorization: `Bearer ${TOKEN}` } }));
    expect([r.status, (await r.json()).motivo]).toEqual([503, "cancelacion"]);
    const l = await post();
    expect([l.status, (await l.json()).motivo]).toEqual([503, "cancelacion"]);
    expect((await (await getEstado()).json()).motivo).toBe("cancelacion");
  });
  it("POST …/cerrar con token responde los pendientes", async () => {
    const { g } = instalar();
    await arrancar(g);
    const r = await postCerrar(new Request(`${URL_SITIO}/cerrar`, { method: "POST", headers: { authorization: `Bearer ${TOKEN}` } }));
    expect([r.status, await r.json()]).toEqual([200, { pendientes: 0 }]);
  });
  it("S10b (a) · sin token, ?prueba=1 se ignora: lanzamiento público con el cupo consumido; con token incorrecto ⇒ 401", async () => {
    const { g, almacen, reloj } = instalar();
    await arrancar(g);
    expect((await post({ consulta: "?prueba=1", auth: "Bearer malo", xff: "3.3.3.3" })).status).toBe(401);
    const r = await post({ consulta: "?prueba=1", xff: "3.3.3.4" });
    expect(r.status).toBe(202);
    expect((await r.json()).id).toBe(`sitio-${diaUtc(reloj.t)}`);
    expect(almacen.archivos.has(`dia-${diaUtc(reloj.t)}.json`)).toBe(true);
    await g.cancelar();
  });
});

describe("062 · R5 · bicep: réplica única, gracia e interruptor apagado por defecto", () => {
  const bicep = readFileSync("infra/arena-preview.bicep", "utf8");
  it("una sola `var maxReplicas` alimenta scale.maxReplicas y ARENA_MAX_REPLICAS; gracia de 30 s", () => {
    expect(bicep.match(/^var maxReplicas = 1$/gm)).toHaveLength(1);
    expect(bicep).toMatch(/scale: \{ minReplicas: minReplicas, maxReplicas: maxReplicas \}/);
    expect(bicep).toMatch(/\{ name: 'ARENA_MAX_REPLICAS', value: string\(maxReplicas\) \}/);
    expect(bicep).not.toMatch(/maxReplicas: \d/);
    expect(bicep).toMatch(/^\s*terminationGracePeriodSeconds: 30$/m);
  });
  it("ninguna variable de ensayo ni de e2e; ARENA_TORNEO_SITIO sale de un parámetro con '0' por defecto; commit y origen completos", () => {
    for (const v of ["ARENA_TORNEO_SITIO_ENSAYO", "ARENA_TORNEO_SITIO_SIN_RITMO", "ARENA_TORNEO_SITIO_SEGUNDOS", "ARENA_TORNEOS_SITIO_DIR"]) expect(bicep).not.toContain(v);
    expect(bicep).toMatch(/^param torneoSitio string = '0'$/m);
    expect(bicep).toMatch(/\{ name: 'ARENA_TORNEO_SITIO', value: torneoSitio \}/);
    expect(bicep).toMatch(/\{ name: 'CRONISTA_COMMIT', value: commit \}/);
    expect(bicep).toMatch(/\{ name: 'ARENA_ORIGEN_PUBLICO', value: 'https:\/\/cronista-arena\.\$\{environment\.properties\.defaultDomain\}' \}/);
    expect(bicep).toMatch(/secretRef: 'arena-admin'/);
  });
  it("el ensayo de e2e queda dentro de los límites del 059", () => {
    expect(T.ensayoSegundos.min).toBeLessThanOrEqual(T.ensayoSegundos.max);
  });
});
