// Brief 064 § 4.6, § 4.9 y § 4.10 · La página de crónica de arena (props del servidor + `CronicaArena`) y el botón.
// Se genera con el servicio real (almacén local temporal, dobles de LLM, nunca un modelo real) y se renderiza a HTML
// estático: el autor SIEMPRE está rotulado (GPT-6.1 Sol · Azure OpenAI, fixture de ensayo o acta determinista con su
// motivo), sin prosa si la crónica no está «lista» (I9), el marco en ES/EN, nunca los fotogramas al cliente, y un solo
// POST por fuente en el documento.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {}, forward: () => {}, refresh: () => {} }),
  usePathname: () => "/arena/cronica",
  useSearchParams: () => new URLSearchParams(),
}));

import type { Llm, Mensaje } from "../../lib/llm";
import { crearLlmEnsayo } from "../../lib/llm-ensayo";
import { borradorDesdeHechos } from "../../lib/llm-stub";
import { leerJson } from "../../arena/__fixtures__/cronica-064";
import { almacenTorneosLocal } from "../../arena/almacen-torneos";
import { archivosCronica } from "../../arena/cronica-almacen";
import { ServicioCronicas, type MotivoActa } from "../../arena/cronica";
import type { DepsFuentes } from "../../arena/cronica-fuentes";
import { pedirUnaVez } from "../BotonCronica";
import { CronicaArena } from "../CronicaArena";
import { propsCronicaArena } from "../cronica-arena-props";
import { TEXTOS_CRONICA_ARENA as T } from "../textos-cronica-arena";

const fuentes: DepsFuentes = {
  async torneo() { return null; },
  async bytesTorneo() { return null; },
  async registroSesion() { throw new Error("sin sesiones"); },
  async archivoEjemplo() { throw new Error("sin ejemplos"); },
};
const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); vi.unstubAllGlobals(); });

function montar(env: Record<string, string | undefined>, llm?: () => Llm) {
  const dir = mkdtempSync(join(tmpdir(), "cronica-ui-064-")); dirs.push(dir);
  const almacen = almacenTorneosLocal(dir);
  const servicio = new ServicioCronicas({
    almacen: async () => { await almacen.iniciar(); return almacen; }, ahora: () => Date.parse("2026-10-27T12:00:00Z"), env: () => env, fuentes,
    ...(llm ? { crearLlm: llm } : {}),
  });
  return { dir, servicio };
}
/** Un doble del stub con el id de un modelo del catálogo (sin red). */
const dobleSol = (): Llm => ({ id: "azure-openai:cronista-sol61", async completar(_s: string, ms: Mensaje[]) { return JSON.stringify(borradorDesdeHechos(ms[0]!.contenido)); } });

const V11 = "src/arena/__fixtures__/arena-reinicios-v11.json";
async function pagina(env: Record<string, string | undefined>, llm?: () => Llm, idioma: "es" | "en" = "en", f = V11) {
  const m = montar(env, llm);
  const r = await m.servicio.generar({ registro: leerJson(f) });
  const l = (await m.servicio.leer(r.huella))!;
  const props = propsCronicaArena(l, idioma);
  return { ...m, r, l, props, html: renderToStaticMarkup(<CronicaArena {...props} />) };
}
const redactor = (html: string) => /<p[^>]*data-testid="cronica-redactor"[^>]*>(.*?)<\/p>/s.exec(html);
const texto = (s: string) => s.replace(/<[^>]*>/g, "").replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").trim();
const cuenta = (html: string, testid: string) => html.split(`data-testid="${testid}"`).length - 1;

describe("064 § 4.6 · rótulo del redactor (nunca sin autor)", () => {
  it("GPT-6.1 Sol: «Writer: GPT-6.1 Sol · Azure OpenAI» / «Redactor: …», sin fixture", async () => {
    const { html, props } = await pagina({ ARENA_CRONICA_LLM: "1" }, dobleSol);
    expect(props.estado).toBe("lista");
    const p = redactor(html)!;
    expect(texto(p[1]!)).toBe("Writer: GPT-6.1 Sol · Azure OpenAI");
    expect(p[0]).toContain('data-fixture="false"');
    expect(p[0]).toContain('data-modo="llm"');
    const es = renderToStaticMarkup(<CronicaArena {...props} idiomaInicial="es" />);
    expect(texto(redactor(es)![1]!)).toBe("Redactor: GPT-6.1 Sol · Azure OpenAI");
  });

  it("fixture de ensayo: rotulado como tal, una frase corregida y el proceso", async () => {
    const { html } = await pagina({ ARENA_CRONICA_LLM: "1" }, crearLlmEnsayo);
    const p = redactor(html)!;
    expect(texto(p[1]!)).toContain("Rehearsal fixture");
    expect(p[0]).toContain('data-fixture="true"');
    expect(cuenta(html, "sentence")).toBeGreaterThanOrEqual(2);
    expect(html).toContain('data-state="corregida"');
    expect(html).toContain('data-testid="open-process"');
    expect(html).toContain('data-mode="llm"');
  });

  it("sin redactor: «Deterministic record» / «Acta determinista» con su motivo y la marca provisional", async () => {
    const { html, props } = await pagina({});
    expect(props.redactor).toMatchObject({ modo: "acta", motivoActa: "desactivado", provisional: true });
    const en = texto(redactor(html)![1]!);
    expect(en).toContain(T.acta.en);
    expect(en).toContain(T.motivos.desactivado.en);
    expect(en).toContain(T.provisional.en);
    expect(html).toContain('data-mode="acta"');
    expect(html).toContain('data-state="acta"');
    const es = texto(redactor(renderToStaticMarkup(<CronicaArena {...props} idiomaInicial="es" />))![1]!);
    expect(es).toContain("Acta determinista");
    expect(es).toContain(T.motivos.desactivado.es);
  });

  it("todo motivo de acta tiene texto en los dos idiomas", () => {
    const motivos: MotivoActa[] = ["desactivado", "redactor", "cupo", "error", "abandonada", "rechazos", "tamano"];
    for (const m of motivos) for (const l of ["es", "en"] as const) expect(T.motivos[m][l].length).toBeGreaterThan(10);
  });
});

describe("064 § 4.9 · contenido de la página", () => {
  it("cabecera con clubes, marcador, reglas del motor y quién jugó; línea de tiempo en el idioma; nunca los fotogramas", async () => {
    const { html, props, l } = await pagina({ ARENA_CRONICA_LLM: "1" }, crearLlmEnsayo);
    const r = l.registro;
    expect(props.cabecera).toMatchObject({ local: r.config.partido.local.nombre, visita: r.config.partido.visita.nombre, goles: r.final.marcador, reglas: "reinicios-v11" });
    expect(html).toContain('data-testid="cronica-arena-cabecera"');
    expect(html).toContain("reinicios-v11");
    expect(cuenta(html, "timeline-event")).toBe(props.linea.length);
    // Toda oración cita eventos que están en la línea de tiempo.
    const enLinea = new Set(props.linea.map((e) => e.id));
    for (const [, ids] of html.matchAll(/data-event-ids="([^"]*)"/g)) for (const id of ids!.split(" ").filter(Boolean)) expect(enLinea.has(id)).toBe(true);
    const json = JSON.stringify(props);
    expect(json).not.toContain("fotogramas");
    expect(json.length).toBeLessThan(JSON.stringify(r).length / 5);
    expect(html).toContain('data-testid="cronica-arena-limites"');
    expect(html).not.toContain('data-testid="sentence-replay"');
  });

  it("ES: frases, «Ver proceso», línea de tiempo y límites en español", async () => {
    const { html, props } = await pagina({ ARENA_CRONICA_LLM: "1" }, crearLlmEnsayo, "es");
    expect(html).toContain('lang="es"');
    expect(html).toContain("Ver proceso");
    expect(html).toContain(T.limites.es);
    expect(html).toContain(props.linea[0]!.texto_es.replace(/'/g, "&#x27;"));
    expect(html).toContain(props.cronica!.oraciones[0]!.texto_es.replace(/'/g, "&#x27;"));
  });

  it("sin crónica guardada: sin prosa, sin rótulo de redactor y con el botón para escribirla", async () => {
    const { dir, servicio, r } = await pagina({});
    rmSync(join(dir, archivosCronica.cronica(r.huella)));
    const l = (await servicio.leer(r.huella))!;
    expect(l.estado).toBe("sin-cronica");
    const html = renderToStaticMarkup(<CronicaArena {...propsCronicaArena(l, "en")} />);
    expect(cuenta(html, "sentence")).toBe(0);
    expect(cuenta(html, "cronica-redactor")).toBe(0);
    expect(cuenta(html, "arena-cronica")).toBe(1);
    expect(html).toContain('data-estado="sin-cronica"');
  });

  it("crónica guardada manipulada: estado «invalida» y ninguna frase (I9), aunque el archivo exista", async () => {
    const { dir, servicio, r } = await pagina({});
    const ruta = join(dir, archivosCronica.cronica(r.huella));
    const a = JSON.parse(readFileSync(ruta, "utf8"));
    a.cronica.oraciones[0].texto_es += " Hubo 999 remates."; a.cronica.oraciones[0].texto_en += " There were 999 shots.";
    writeFileSync(ruta, JSON.stringify(a));
    const l = (await servicio.leer(r.huella))!;
    expect(l.estado).toBe("invalida");
    const props = propsCronicaArena(l, "en");
    expect(props.cronica).toBeUndefined();
    const html = renderToStaticMarkup(<CronicaArena {...props} />);
    expect(cuenta(html, "sentence")).toBe(0);
    expect(html).not.toContain("999");
    expect(html).toContain('data-estado="invalida"');
  });

  it("las props nunca llevan prosa si el estado no es «lista», aunque la lectura trajera el archivo (defensa en profundidad)", async () => {
    const { l } = await pagina({});
    for (const estado of ["invalida", "desactualizada", "sin-cronica"] as const) {
      const props = propsCronicaArena({ ...l, estado }, "en");
      expect(props.cronica).toBeUndefined();
      expect(props.redactor).toBeUndefined();
    }
  });
});

describe("064 § 4.10 · BotonCronica: un solo POST por fuente en el documento", () => {
  it("dos pulsaciones simultáneas de la misma fuente comparten la petición; otra fuente hace la suya", async () => {
    let llamadas = 0; let soltar!: () => void;
    const barrera = new Promise<void>((r) => { soltar = r; });
    vi.stubGlobal("fetch", vi.fn(async () => {
      llamadas++; await barrera;
      return new Response(JSON.stringify({ huella: "a".repeat(40), url: `/arena/cronica/${"a".repeat(40)}`, modo: "acta", provisional: true, desdeAlmacen: false }), { status: 200, headers: { "content-type": "application/json" } });
    }));
    const p1 = pedirUnaVez({ archivo: "duelo" });
    const p2 = pedirUnaVez({ archivo: "duelo" });
    const p3 = pedirUnaVez({ huella: "b".repeat(40) });
    soltar();
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    expect(llamadas).toBe(2);
    expect(r1).toBe(r2);
    expect(r1.ok && r1.respuesta.url).toBe(`/arena/cronica/${"a".repeat(40)}`);
    expect(r3.ok).toBe(true);
    // Terminada, una nueva pulsación vuelve a pedir (la segunda respuesta la sirve el almacén, sin modelo).
    await pedirUnaVez({ archivo: "duelo" });
    expect(llamadas).toBe(3);
  });

  it("429 en-curso trae el motivo y la espera; un fallo de red es recuperable (status 0)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "x", motivo: "en-curso" }), { status: 429, headers: { "retry-after": "5" } })));
    expect(await pedirUnaVez({ archivo: "ejemplo" })).toEqual({ ok: false, status: 429, motivo: "en-curso", retryAfterS: 5 });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("red caída"); }));
    expect(await pedirUnaVez({ archivo: "ejemplo" })).toEqual({ ok: false, status: 0 });
  });
});
