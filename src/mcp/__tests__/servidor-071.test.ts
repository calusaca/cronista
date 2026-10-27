// Brief 071 § 3 · Servidor MCP de solo lectura y el cronista como cliente MCP. Todo por el cliente oficial del SDK
// conectado en memoria (el mismo `crearServidorMcp` que expone /api/mcp): las tres herramientas con entradas válidas e
// inválidas (`sesion`/`registro` rechazados, tope de lista), `get_match_report` nunca genera (espía del redactor con 0
// llamadas), equivalencia MCP = directo en la matriz del 064 y los registros v9–v11, y el respaldo del cronista
// (`hechosVia: "directo"` con su motivo) sin que la crónica cambie. Ninguna cifra de límites.ts se repite.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import type { Llm, Mensaje } from "../../lib/llm";
import { borradorDesdeHechos } from "../../lib/llm-stub";
import { MCP_ARENA } from "../../sim/limites";
import { FIXTURES_064, leerJson, registroEjemplos064, registroFinalAnticipado064 } from "../../arena/__fixtures__/cronica-064";
import { almacenTorneosLocal, type AlmacenTorneos } from "../../arena/almacen-torneos";
import { ServicioCronicas, type ArchivoCronica } from "../../arena/cronica";
import { archivosCronica, comprimirRegistro, huellaRegistro } from "../../arena/cronica-almacen";
import { reproducirArena } from "../../arena/coordinador";
import { resolverFuente, type DepsFuentes } from "../../arena/cronica-fuentes";
import { seleccionCronicaArena } from "../../arena/cronica-hechos";
import { esquemaTorneoCualquiera, type TorneoCualquiera } from "../../arena/torneo";
import type { RegistroArena } from "../../arena/tipos";
import { ErrorClienteMcp, hechosPorMcp } from "../cliente";
import { crearServidorMcp, NOMBRE_SERVIDOR_MCP, type DepsMcp, type HechosMcp } from "../servidor";

const RAIZ = join(__dirname, "..", "..", "..");
const ARCHIVADO = join(RAIZ, "src/arena/__fixtures__/torneos/ensayo-059");
const torneoEnsayo = (): TorneoCualquiera => esquemaTorneoCualquiera.parse(JSON.parse(readFileSync(join(ARCHIVADO, "torneo.json"), "utf8")));

/** Sesiones pedidas a las fuentes: el servidor MCP nunca debe pedir una (aunque la sesión existiera y estuviera completa). */
let sesionesPedidas = 0;
function fuentes(torneos: () => TorneoCualquiera[] = () => [torneoEnsayo()]): DepsFuentes {
  return {
    async torneo(id) { return torneos().find((t) => t.id === id) ?? null; },
    async bytesTorneo(_id, archivo) { try { return new Uint8Array(readFileSync(join(ARCHIVADO, archivo))); } catch { return null; } },
    async registroSesion() {
      sesionesPedidas++;
      return { registro: reproducirArena(JSON.parse(readFileSync(join(RAIZ, "public/experimentos/arena-duelo-v3.json"), "utf8"))), origen: { tipo: "sesion", contexto: { forma: "importado" } } };
    },
    async archivoEjemplo(nombre) { return JSON.parse(readFileSync(join(RAIZ, "public/experimentos", nombre), "utf8")); },
    async listarTorneos() { return torneos(); },
  };
}

interface Espia extends Llm { llamadas: number }
const espia = (): Espia => {
  const d: Espia = { id: "stub", llamadas: 0, async completar(_s: string, ms: Mensaje[]) { d.llamadas++; return JSON.stringify(borradorDesdeHechos(ms[0]!.contenido)); } };
  return d;
};

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

function montar(opts: { torneos?: () => TorneoCualquiera[]; llm?: Espia; hechosMcp?: ConstructorParameters<typeof ServicioCronicas>[0]["hechosMcp"] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "mcp-071-")); dirs.push(dir);
  const almacen = almacenTorneosLocal(dir);
  const abrir = async (): Promise<AlmacenTorneos> => { await almacen.iniciar(); return almacen; };
  const f = fuentes(opts.torneos);
  const servicio = new ServicioCronicas({
    almacen: abrir, ahora: () => Date.parse("2026-10-27T22:00:00Z"), env: () => ({ ARENA_CRONICA_LLM: "1" }), fuentes: f,
    ...(opts.llm ? { crearLlm: () => opts.llm! } : {}), ...(opts.hechosMcp ? { hechosMcp: opts.hechosMcp } : {}),
  });
  const deps: DepsMcp = { almacen: abrir, fuentes: f, cronicas: servicio };
  return { dir, almacen: abrir, servicio, deps, leerArchivo: (h: string) => JSON.parse(readFileSync(join(dir, archivosCronica.cronica(h)), "utf8")) as ArchivoCronica };
}

/** Cliente oficial del SDK conectado en memoria a un servidor nuevo. */
async function cliente(deps: DepsMcp): Promise<Client> {
  const [c, s] = InMemoryTransport.createLinkedPair();
  await crearServidorMcp(deps).connect(s);
  const cl = new Client({ name: "prueba-071", version: "0" });
  await cl.connect(c);
  return cl;
}
const texto = (r: Awaited<ReturnType<Client["callTool"]>>) => (r.content as { type: string; text: string }[]).map((x) => x.text).join(" ");

/** Guarda un registro en el almacén como lo hace el servicio antes de generar. */
async function guardarRegistro(almacen: () => Promise<AlmacenTorneos>, r: RegistroArena): Promise<string> {
  const h = huellaRegistro(r);
  await (await almacen()).escribirBytes(archivosCronica.registro(h), comprimirRegistro(r));
  return h;
}

describe("071 · servidor MCP: descubrimiento", () => {
  it("initialize con nombre y versión; tools/list con las 3 herramientas, todas readOnlyHint", async () => {
    const m = montar();
    const cl = await cliente(m.deps);
    expect(cl.getServerVersion()).toMatchObject({ name: NOMBRE_SERVIDOR_MCP, version: JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8")).version });
    const { tools } = await cl.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["get_match_facts", "get_match_report", "list_matches"]);
    for (const t of tools) expect(t.annotations?.readOnlyHint).toBe(true);
    // Ni recursos ni prompts (fuera de alcance): solo herramientas.
    expect(cl.getServerCapabilities()?.resources).toBeUndefined();
    expect(cl.getServerCapabilities()?.prompts).toBeUndefined();
  });
});

describe("071 · list_matches", () => {
  it("los tres ejemplos y los encuentros del torneo guardado; cada fuente sin sesion ni registro; structuredContent = texto JSON", async () => {
    const m = montar();
    const r = await (await cliente(m.deps)).callTool({ name: "list_matches", arguments: {} });
    expect(r.isError).toBeFalsy();
    const d = r.structuredContent as { partidos: { fuente: Record<string, string>; equipos: { local: string }; marcador: { local: number }; reglas: string; duracionS: number }[]; truncada: boolean };
    expect(JSON.parse(texto(r))).toEqual(d);
    expect(d.partidos.slice(0, 3).map((p) => p.fuente)).toEqual([{ archivo: "duelo" }, { archivo: "ejemplo-v3" }, { archivo: "ejemplo" }]);
    const t = torneoEnsayo();
    expect(d.partidos.filter((p) => "torneo" in p.fuente)).toHaveLength(t.encuentros.length);
    for (const p of d.partidos) {
      expect(Object.keys(p.fuente).some((k) => k === "sesion" || k === "registro")).toBe(false);
      expect(p.equipos.local).toBeTruthy(); expect(typeof p.marcador.local).toBe("number"); expect(p.reglas).toBeTruthy(); expect(p.duracionS).toBeGreaterThan(0);
    }
    const duelo = (await resolverFuente({ archivo: "duelo" }, fuentes())).registro;
    expect(d.partidos[0]).toMatchObject({ equipos: { local: duelo.config.partido.local.nombre, visita: duelo.config.partido.visita.nombre }, marcador: duelo.final.marcador, duracionS: duelo.config.duracionS });
    expect(d.truncada).toBe(false);
  });

  it("tope MCP_ARENA.maxPartidosLista con `truncada`; un torneo en curso no se lista", async () => {
    const base = torneoEnsayo();
    const muchos = { ...base, encuentros: Array.from({ length: MCP_ARENA.maxPartidosLista + 5 }, (_, i) => ({ ...base.encuentros[0]!, n: i + 1 })) } as TorneoCualquiera;
    const enCurso = { ...base, id: "en-curso-071", estado: "en_curso" } as unknown as TorneoCualquiera;
    const m = montar({ torneos: () => [muchos, enCurso] });
    const d = (await (await cliente(m.deps)).callTool({ name: "list_matches", arguments: {} })).structuredContent as { partidos: { fuente: { torneo?: string } }[]; truncada: boolean };
    expect(d.partidos).toHaveLength(MCP_ARENA.maxPartidosLista);
    expect(d.truncada).toBe(true);
    expect(d.partidos.some((p) => p.fuente.torneo === "en-curso-071")).toBe(false);
  });
});

describe("071 · get_match_facts", () => {
  it("archivo duelo: la selección de seleccionCronicaArena tal cual, con su huella, equipos, marcador y reglas", async () => {
    const m = montar();
    const r = await (await cliente(m.deps)).callTool({ name: "get_match_facts", arguments: { fuente: { archivo: "duelo" } } });
    expect(r.isError).toBeFalsy();
    const d = r.structuredContent as unknown as HechosMcp;
    const registro = (await resolverFuente({ archivo: "duelo" }, fuentes())).registro;
    const directa = seleccionCronicaArena(registro);
    expect(d.huella).toBe(huellaRegistro(registro));
    expect(d.hechos).toStrictEqual(directa.hechos);
    expect(d.cabe).toBe(directa.cabe);
    expect(d.hechos.every((h) => h.hecho.eventos.length > 0)).toBe(true);
    expect(d).toMatchObject({ equipos: { local: registro.config.partido.local.nombre }, marcador: registro.final.marcador });
    expect(JSON.parse(texto(r))).toEqual(JSON.parse(JSON.stringify(d)));
  });

  it("encuentro de torneo guardado (ensayo-059, 01) y huella de un registro guardado: idénticos a la llamada directa", async () => {
    const m = montar();
    const cl = await cliente(m.deps);
    const { registro } = await resolverFuente({ torneo: "ensayo-059", encuentro: "01" }, fuentes());
    const t = (await cl.callTool({ name: "get_match_facts", arguments: { fuente: { torneo: "ensayo-059", encuentro: "01" } } })).structuredContent as unknown as HechosMcp;
    expect(t.hechos).toStrictEqual(seleccionCronicaArena(registro).hechos);
    const h = await guardarRegistro(m.almacen, registro);
    expect(t.huella).toBe(h);
    const g = (await cl.callTool({ name: "get_match_facts", arguments: { fuente: { huella: h } } })).structuredContent as unknown as HechosMcp;
    expect(g.hechos).toStrictEqual(t.hechos);
  });

  it("memoria por partido terminado: repetir get_match_facts del mismo encuentro no lo vuelve a leer ni reproducir, y devuelve copias", async () => {
    const m = montar();
    let lecturas = 0;
    const base = m.deps.fuentes;
    const contadas: DepsFuentes = { ...base, async bytesTorneo(id, archivo) { lecturas++; return base.bytesTorneo(id, archivo); } };
    const cl = await cliente({ ...m.deps, fuentes: contadas });
    const fuente = { torneo: "ensayo-059", encuentro: "02" };
    const a = (await cl.callTool({ name: "get_match_facts", arguments: { fuente } })).structuredContent as unknown as HechosMcp;
    const b = (await cl.callTool({ name: "get_match_facts", arguments: { fuente } })).structuredContent as unknown as HechosMcp;
    expect(lecturas).toBe(1);
    expect(b).toStrictEqual(a);
    expect(b.hechos).not.toBe(a.hechos);
  });

  it("rechaza sesion, registro, archivos desconocidos, claves de más, huellas mal formadas o inexistentes y torneos en curso", async () => {
    const enCurso = { ...torneoEnsayo(), estado: "en_curso" } as unknown as TorneoCualquiera;
    const m = montar();
    const cl = await cliente(m.deps);
    const registro = leerJson("public/experimentos/arena-duelo-v3.json");
    const invalidas: unknown[] = [
      { sesion: "00000000-0000-0000-0000-000000000000" }, { registro }, { archivo: "otro" }, { archivo: "duelo", extra: 1 },
      { huella: "XYZ" }, { torneo: "ensayo-059" }, {},
    ];
    const antes = sesionesPedidas;
    for (const fuente of invalidas) {
      const r = await cl.callTool({ name: "get_match_facts", arguments: { fuente } });
      expect(r.isError, JSON.stringify(fuente).slice(0, 60)).toBe(true);
      expect(r.structuredContent).toBeUndefined();
      // Rechazo por el esquema de entrada (zod del SDK), antes de leer nada.
      expect(texto(r)).toMatch(/validation/i);
    }
    expect(sesionesPedidas).toBe(antes);
    const sinRegistro = await cl.callTool({ name: "get_match_facts", arguments: { fuente: { huella: "0".repeat(40) } } });
    expect(sinRegistro.isError).toBe(true);
    expect(texto(sinRegistro)).toContain("No saved match");
    const mc = montar({ torneos: () => [enCurso] });
    const r = await (await cliente(mc.deps)).callTool({ name: "get_match_facts", arguments: { fuente: { torneo: "ensayo-059", encuentro: "01" } } });
    expect(r.isError).toBe(true);
    expect(texto(r)).toContain("in progress");
  });
});

describe("071 · get_match_report nunca genera", () => {
  it("sin crónica: error legible con la URL de la página y 0 llamadas al redactor ni escrituras; con crónica guardada: frases ES/EN, autor y verificación sin llamar", async () => {
    const llm = espia();
    const m = montar({ llm });
    const h = await guardarRegistro(m.almacen, leerJson("src/arena/__fixtures__/arena-reinicios-v11.json"));
    const cl = await cliente(m.deps);
    const sin = await cl.callTool({ name: "get_match_report", arguments: { huella: h } });
    expect(sin.isError).toBe(true);
    expect(texto(sin)).toContain(`/arena/cronica/${h}`);
    expect(texto(sin)).toContain("never writes");
    expect(llm.llamadas).toBe(0);
    expect(() => readFileSync(join(m.dir, archivosCronica.cronica(h)))).toThrow();
    expect(() => readFileSync(join(m.dir, archivosCronica.reserva(h)))).toThrow();

    await m.servicio.generar({ huella: h });
    expect(llm.llamadas).toBe(1);
    const con = await cl.callTool({ name: "get_match_report", arguments: { huella: h } });
    expect(con.isError).toBeFalsy();
    const d = con.structuredContent as { estado: string; frases: { es: string; en: string; estado: string }[]; autor: { tipo: string; etiqueta: string }; verificacion: { frases: number }; hechosVia: string; url: string };
    expect(d.estado).toBe("lista");
    expect(d.frases.length).toBeGreaterThan(0);
    expect(d.frases.every((f) => f.es && f.en)).toBe(true);
    expect(d.autor.tipo).toBe("modelo");
    expect(d.verificacion.frases).toBe(d.frases.length);
    expect(d.hechosVia).toBe("mcp");
    expect(d.url).toBe(`/arena/cronica/${h}`);
    expect(llm.llamadas).toBe(1);
    const malformada = await cl.callTool({ name: "get_match_report", arguments: { huella: "nada" } });
    expect(malformada.isError).toBe(true);
    expect(llm.llamadas).toBe(1);
  });
});

describe("071 · equivalencia MCP = directo (matriz del 064 y registros v9–v11)", () => {
  const casos: [string, () => RegistroArena][] = [
    ...FIXTURES_064.map((f) => [f, () => leerJson(f)] as [string, () => RegistroArena]),
    ...[9, 10, 11].map((n) => [`arena-reinicios-v${n}`, () => leerJson(`src/arena/__fixtures__/arena-reinicios-v${n}.json`)] as [string, () => RegistroArena]),
    ["ejemplos normativos 064", registroEjemplos064], ["final anticipado 064", registroFinalAnticipado064],
  ];
  for (const [nombre, crear] of casos) {
    it(nombre, async () => {
      const m = montar();
      const registro = crear();
      const h = await guardarRegistro(m.almacen, registro);
      const porMcp = await hechosPorMcp(m.deps, h);
      const directa = seleccionCronicaArena(registro);
      expect(porMcp.hechos).toStrictEqual(directa.hechos);
      expect(porMcp.cabe).toBe(directa.cabe);
      expect(porMcp.huella).toBe(h);
    });
  }
});

describe("071 · el cronista como cliente MCP y su respaldo", () => {
  const V11 = "src/arena/__fixtures__/arena-reinicios-v11.json";
  async function generar(hechosMcp?: ConstructorParameters<typeof ServicioCronicas>[0]["hechosMcp"]) {
    const llm = espia();
    const m = montar({ llm, ...(hechosMcp ? { hechosMcp } : {}) });
    const r = await m.servicio.generar({ registro: leerJson(V11) });
    return { r, archivo: m.leerArchivo(r.huella), llm };
  }

  it("por defecto: hechos por MCP (hechosVia: mcp, sin motivo)", async () => {
    const { r, archivo } = await generar();
    expect(r.modo).toBe("llm");
    expect(archivo.hechosVia).toBe("mcp");
    expect(archivo.hechosViaMotivo).toBeUndefined();
  });

  it("si el MCP falla, tarda o no devuelve la misma selección: llamada directa con su motivo, y la misma crónica", async () => {
    const base = await generar();
    const conMotivo = {
      error: (async () => { throw new Error("caído"); }) as typeof hechosPorMcp,
      plazo: ((d: DepsMcp, h: string) => hechosPorMcp({ ...d, almacen: () => new Promise<never>(() => {}) }, h, 20)) as typeof hechosPorMcp,
      discrepancia: (async (d: DepsMcp, h: string) => { const x = await hechosPorMcp(d, h); return { ...x, hechos: x.hechos.slice(0, -1) }; }) as typeof hechosPorMcp,
      herramienta: ((d: DepsMcp, h: string) => hechosPorMcp({ ...d, almacen: async () => { throw new Error("almacén caído"); } }, h)) as typeof hechosPorMcp,
    } as const;
    for (const [motivo, f] of Object.entries(conMotivo)) {
      const { r, archivo, llm } = await generar(f);
      expect(r.modo, motivo).toBe("llm");
      expect(llm.llamadas).toBe(1);
      expect(archivo.hechosVia).toBe("directo");
      expect(archivo.hechosViaMotivo).toBe(motivo);
      expect(archivo.cronica.oraciones).toStrictEqual(base.archivo.cronica.oraciones);
      expect(archivo.hashHechos).toBe(base.archivo.hashHechos);
    }
  });

  it("hechosPorMcp lanza ErrorClienteMcp con motivo «plazo» pasado el plazo", async () => {
    const m = montar();
    const h = await guardarRegistro(m.almacen, leerJson(V11));
    await expect(hechosPorMcp({ ...m.deps, almacen: () => new Promise<never>(() => {}) }, h, 10)).rejects.toMatchObject({ motivo: "plazo" });
    await expect(hechosPorMcp(m.deps, "0".repeat(40))).rejects.toBeInstanceOf(ErrorClienteMcp);
  });
});
