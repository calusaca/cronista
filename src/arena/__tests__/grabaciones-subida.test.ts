// Brief 057 § 3.3 y v1.1 §§ 3, 4 y 9 · Subida validada de registros a /api/arena/grabaciones (patrón de
// servicios-azure.test.ts:144): validador real, solo registros completos, mismo id para el mismo contenido
// canónico, procedencia declarada, lector de ARENA.archivoMaxBytes con 413 tipificado y admisión por IP,
// global y en curso decidida antes de leer el cuerpo. Ninguna cifra de PLAY_NARRADO ni ARENA se repite.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Admision } from "../admision";
import { crearControladorProgramado } from "../controladores";
import * as coordinador from "../coordinador";
import { crearConfigArena } from "../motor";
import { GestorSesiones } from "../sesiones";
import type { RegistroArena } from "../tipos";
import { ARENA, PLAY_NARRADO } from "../../sim/limites";

vi.mock("../coordinador", async importOriginal => {
  const real = await importOriginal<typeof import("../coordinador")>();
  return { ...real, reproducirArena: vi.fn(real.reproducirArena) };
});
const reproducir = vi.mocked(coordinador.reproducirArena);

const RUTA_V5 = "src/arena/__fixtures__/arena-reinicios-v5.json";
const textoV5 = await readFile(RUTA_V5, "utf8");
const v5 = () => JSON.parse(textoV5) as RegistroArena;
const rutas: string[] = [];
const compartido = globalThis as typeof globalThis & { __cronistaSesiones?: GestorSesiones; __cronistaAdmisionSubidas?: Admision };
let anterior: GestorSesiones | undefined, admisionAnterior: Admision | undefined;
beforeEach(async () => {
  vi.stubEnv("ARENA_VOZ", "1");
  anterior = compartido.__cronistaSesiones; admisionAnterior = compartido.__cronistaAdmisionSubidas;
  const ruta = await mkdtemp(join(tmpdir(), "cronista-subida-")); rutas.push(ruta);
  compartido.__cronistaSesiones = new GestorSesiones({ directorio: ruta, ritmoMsPorSegundo: 0 });
  compartido.__cronistaAdmisionSubidas = new Admision(PLAY_NARRADO.subida);
  reproducir.mockClear();
});
afterEach(async () => {
  vi.unstubAllEnvs(); vi.restoreAllMocks();
  compartido.__cronistaSesiones = anterior; compartido.__cronistaAdmisionSubidas = admisionAnterior;
  await Promise.all(rutas.splice(0).map(p => rm(p, { force: true, recursive: true })));
});
const ruta = async () => (await import("../../app/api/arena/grabaciones/route")).POST;
const pedir = async (cuerpo: unknown, cabeceras: Record<string, string> = {}) => (await ruta())(new Request("http://localhost/api/arena/grabaciones", { method: "POST", headers: { "content-type": "application/json", ...cabeceras }, body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo) }));

describe("057 · rama { registro }", () => {
  it("v5 completo → 200 y el registro guardado es el archivo; la segunda subida devuelve el mismo id (M13)", async () => {
    const r = await pedir({ registro: v5() });
    expect(r.status).toBe(200);
    const { id } = await r.json() as { id: string };
    expect(await compartido.__cronistaSesiones!.registro(id)).toEqual(v5());
    const otra = await pedir({ registro: v5() });
    expect(otra.status).toBe(200);
    expect((await otra.json()).id).toBe(id);
    expect(reproducir).toHaveBeenCalledTimes(2);
  });

  it("procedencia declarada: el mismo partido con otros controladores declarados → mismo id y asignacion.procedencia", async () => {
    const a = v5(), b = v5();
    for (const r of a.rondas) for (const d of Object.values(r.decisiones)) d.controlador = "GPT-6 Sol";
    for (const r of b.rondas) for (const d of Object.values(r.decisiones)) d.controlador = "Mi modelo";
    const { id } = await (await pedir({ registro: a })).json() as { id: string };
    const segunda = await pedir({ registro: b });
    expect(segunda.status).toBe(200);
    expect((await segunda.json()).id).toBe(id);
    const reproduccion = await compartido.__cronistaSesiones!.reproduccion(id);
    expect(reproduccion.asignacion.procedencia).toBe("declarada");
    // El primer metadato subido es el que queda (y es declarado).
    expect(reproduccion.asignacion.local.nombre).toBe("GPT-6 Sol");
    const emision = await compartido.__cronistaSesiones!.emision(id);
    expect(emision.asignacion.procedencia).toBe("declarada");
  });

  it("alteraciones (M12): (i) observación de rondas[0], (ii) destino de una orden de rondas[1], (iii) la y de un evento → 400 «Registro inválido»", async () => {
    const i = v5(); i.rondas[0]!.observacion = "0".repeat(64);
    const ii = v5(); const orden = (ii.rondas[1]!.decisiones.local.ordenes as unknown as { ordenes: { destino: { x: number } }[] }).ordenes[0]!; orden.destino.x += 5;
    const iii = v5(); const evento = iii.eventos.find(e => e.tipo === "pase")!; evento.desde = { ...evento.desde, y: evento.desde.y + 1 };
    for (const [nombre, registro] of [["observacion", i], ["orden", ii], ["evento", iii]] as const) {
      const r = await pedir({ registro });
      expect(r.status, nombre).toBe(400);
      expect((await r.json()).error, nombre).toBe("Registro inválido");
    }
  });

  it("registro truncado (final.tick < duración, sin finalizado) → 400 «Registro incompleto» sin ejecutar el validador", async () => {
    const r = v5(), corte = r.rondas[1]!.finTick;
    const truncado = { ...r, rondas: r.rondas.filter(x => x.finTick <= corte), eventos: r.eventos.filter(e => e.tick <= corte), fotogramas: r.fotogramas.filter(f => f.tick <= corte), final: r.fotogramas.filter(f => f.tick <= corte).at(-1)! };
    expect(truncado.final.tick).toBeLessThan(Math.round(r.config.duracionS / ARENA.pasoS));
    const respuesta = await pedir({ registro: truncado });
    expect(respuesta.status).toBe(400);
    expect((await respuesta.json()).error).toBe("Registro incompleto");
    expect(reproducir).not.toHaveBeenCalled();
  });

  it("sin ARENA_VOZ ni ARENA_ANALISTA_LLM → 503", async () => {
    vi.stubEnv("ARENA_VOZ", "0"); vi.stubEnv("ARENA_ANALISTA_LLM", "0");
    expect((await pedir({ registro: v5() })).status).toBe(503);
    expect(reproducir).not.toHaveBeenCalled();
  });

  it("{ archivo: \"duelo\" } sigue funcionando, sin procedencia y sin consumir cupo de subida", async () => {
    // Admisión de prueba con un solo cupo por IP: si el archivo lo gastara, la subida siguiente sería 429.
    compartido.__cronistaAdmisionSubidas = new Admision({ ...PLAY_NARRADO.subida, porIpPorHora: 1 });
    const admitir = vi.spyOn(compartido.__cronistaAdmisionSubidas, "admitir");
    const r = await pedir({ archivo: "duelo" });
    expect(r.status).toBe(200);
    const { id } = await r.json() as { id: string };
    expect(await compartido.__cronistaSesiones!.registro(id)).toEqual(JSON.parse(await readFile("public/experimentos/arena-duelo-v3.json", "utf8")));
    expect((await compartido.__cronistaSesiones!.reproduccion(id)).asignacion.procedencia).toBeUndefined();
    expect(admitir).not.toHaveBeenCalled();
    expect((await pedir({ registro: {} })).status).toBe(400);
    const tercera = await pedir({ registro: {} });
    expect(tercera.status).toBe(429);
    expect(admitir).toHaveBeenCalledTimes(2);
  });
});

describe("057 v1.3 (5) · rama { archivo } con tope de 16 KB y cuerpo inválido", () => {
  it("un cuerpo que empieza por {\"archivo\" y supera 16 KB → 413 sin consumir cupo ni validar", async () => {
    const admitir = vi.spyOn(compartido.__cronistaAdmisionSubidas!, "admitir");
    const r = await pedir(`{"archivo":"duelo","relleno":"${"x".repeat(20_000)}"}`);
    expect(r.status).toBe(413);
    expect(admitir).not.toHaveBeenCalled(); expect(reproducir).not.toHaveBeenCalled();
  });
  it("esquema inválido (ZodError) → 400 «Cuerpo inválido», no el mensaje de configuración", async () => {
    for (const cuerpo of [{ archivo: "otro" }, { archivo: "duelo", extra: 1 }, {}, { registro: 1, archivo: "duelo" }]) {
      const r = await pedir(cuerpo);
      expect(r.status, JSON.stringify(cuerpo)).toBe(400);
      expect((await r.json()).error, JSON.stringify(cuerpo)).toBe("Cuerpo inválido");
    }
  });
});

describe("057 v1.1 § 9 · lector de ARENA.archivoMaxBytes y 413 tipificado", () => {
  it("cuerpo { registro } en fragmentos de 64 KB hasta archivoMaxBytes + 1 → 413 antes de JSON.parse y de reproducirArena", async () => {
    const parse = vi.spyOn(JSON, "parse");
    const fragmento = 64 * 1024, total = ARENA.archivoMaxBytes + 1, cabeza = new TextEncoder().encode('{"registro":"');
    let enviados = 0;
    const cuerpo = new ReadableStream<Uint8Array>({
      pull: c => {
        if (enviados >= total) { c.close(); return; }
        const n = Math.min(fragmento, total - enviados);
        const parte = new Uint8Array(n).fill(0x61); if (enviados === 0) parte.set(cabeza);
        enviados += n; c.enqueue(parte);
      },
    });
    const POST = await ruta();
    const r = await POST(new Request("http://localhost/api/arena/grabaciones", { method: "POST", body: cuerpo, duplex: "half" } as RequestInit));
    expect(r.status).toBe(413);
    // Antes de leer la respuesta (que se decodifica con JSON.parse): la ruta no llegó a parsear nada.
    expect(parse).not.toHaveBeenCalled();
    expect(reproducir).not.toHaveBeenCalled();
    expect(enviados).toBeLessThanOrEqual(total);
    expect((await r.json()).error).toBe("Petición demasiado grande");
  });

  it("content-length mayor que el tope → 413 sin leer el cuerpo", async () => {
    const r = await pedir({ registro: {} }, { "content-length": String(ARENA.archivoMaxBytes + 1) });
    expect(r.status).toBe(413);
  });

  it("el fixture v5 entra (200) y un partido programado de ARENA.duracionMaxS mide menos que archivoMaxBytes y también entra (M14)", async () => {
    expect(Buffer.byteLength(JSON.stringify({ registro: v5() }))).toBeGreaterThan(16_384);
    expect((await pedir({ registro: v5() })).status).toBe(200);
    const largo = await coordinador.ejecutarArena(crearConfigArena({ seed: 57, duracionS: ARENA.duracionMaxS }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
    const cuerpo = JSON.stringify({ registro: largo });
    expect(Buffer.byteLength(cuerpo)).toBeLessThan(ARENA.archivoMaxBytes);
    expect((await pedir(cuerpo)).status).toBe(200);
  });
});

describe("057 v1.1 § 3 · admisión", () => {
  it("Admision con reloj inyectado: la subida porIpPorHora + 1 de una IP → ip; la globalPorHora + 1 → global; una ventana después vuelve a admitir", () => {
    let ahora = 1_000_000;
    const a = new Admision(PLAY_NARRADO.subida, () => ahora);
    for (let k = 0; k < PLAY_NARRADO.subida.porIpPorHora; k++) { const r = a.admitir("10.0.0.1"); expect(r.ok).toBe(true); if (r.ok) r.liberar(); ahora += 1000; }
    const rechazo = a.admitir("10.0.0.1");
    expect(rechazo).toMatchObject({ ok: false, motivo: "ip" });
    if (!rechazo.ok) expect(rechazo.reintentarEnMs).toBeGreaterThan(0);
    for (let k = PLAY_NARRADO.subida.porIpPorHora; k < PLAY_NARRADO.subida.globalPorHora; k++) { const r = a.admitir(`10.0.1.${k}`); expect(r.ok).toBe(true); if (r.ok) r.liberar(); }
    expect(a.admitir("10.0.2.1")).toMatchObject({ ok: false, motivo: "global" });
    ahora += PLAY_NARRADO.subida.ventanaMs;
    const otra = a.admitir("10.0.0.1"); expect(otra.ok).toBe(true);
  });

  it("en curso: un trabajo sin liberar bloquea el siguiente; liberar dos veces no abre dos plazas", () => {
    const a = new Admision(PLAY_NARRADO.subida, () => 0);
    const uno = a.admitir("a"); expect(uno.ok).toBe(true);
    expect(a.admitir("b")).toMatchObject({ ok: false, motivo: "en-curso" });
    if (uno.ok) { uno.liberar(); uno.liberar(); }
    const dos = a.admitir("b"); expect(dos.ok).toBe(true);
    expect(a.admitir("c")).toMatchObject({ ok: false, motivo: "en-curso" });
  });

  it("dos subidas concurrentes: la segunda → 429 en-curso con retry-after, sin llamar a reproducirArena; la primera termina en 200", async () => {
    const POST = await ruta();
    const bytes = new TextEncoder().encode(JSON.stringify({ registro: v5() }));
    let soltar!: () => void; const barrera = new Promise<void>(r => { soltar = r; });
    let enviado = 0;
    const retenido = new ReadableStream<Uint8Array>({
      pull: async c => {
        if (enviado === 0) { c.enqueue(bytes.subarray(0, 1024)); enviado = 1024; return; }
        await barrera;
        if (enviado >= bytes.length) { c.close(); return; }
        c.enqueue(bytes.subarray(enviado, enviado + 65536)); enviado += 65536;
      },
    });
    const primera = POST(new Request("http://localhost/api/arena/grabaciones", { method: "POST", body: retenido, duplex: "half", headers: { "x-forwarded-for": "10.1.1.1, 10.0.0.9" } } as RequestInit));
    await new Promise(r => setTimeout(r, 50));
    const segunda = await pedir({ registro: v5() }, { "x-forwarded-for": "10.2.2.2" });
    expect(segunda.status).toBe(429);
    expect(Number(segunda.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await segunda.json()).error).toBe("Hay otra subida en curso");
    expect(reproducir).not.toHaveBeenCalled();
    soltar();
    expect((await primera).status).toBe(200);
    expect(reproducir).toHaveBeenCalledTimes(1);
    // Liberada en finally: otra subida vuelve a entrar.
    expect((await pedir({ registro: v5() }, { "x-forwarded-for": "10.2.2.2" })).status).toBe(200);
  });
});
