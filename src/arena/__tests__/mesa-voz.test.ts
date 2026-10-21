// Brief 045 · Voz por rol: un SSML con hasta dos <voice>, cesión decidida por caracteres,
// degradación según el catálogo y su declaración en /api/arena/herramientas.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { verificarUpdate, type HechoVerificable } from "../../cadena/verificador";
import type { Llm } from "../../lib/llm";
import { MESA_ARENA } from "../../sim/limites";
import { datosEstadista, intervencionEstadista } from "../estadista";
import { varianteVoz } from "../expresion";
import { comentarArena, contextoNarradorArena } from "../narrador";
import type { IntervencionArena } from "../protocolo";
import { relatoIntervencion } from "../relato";
import type { RegistroArena } from "../tipos";
import { asignarVoces, catalogoVoces, claveAudio, olvidarCatalogoVoces, prepararVoz, vocesDe } from "../voz";
import { GET as herramientas } from "../../app/api/arena/herramientas/route";

const registro = JSON.parse(readFileSync("src/arena/__fixtures__/arena-reinicios-v3.json", "utf8")) as RegistroArena;
const seed = registro.config.partido.seed, tick = registro.final.tick;
const voces = (ssml: string) => [...ssml.matchAll(/<voice name="([^"]+)">/g)].map(m => m[1]);
const conTexto = (i: IntervencionArena, largo: number, n = 2): IntervencionArena => ({ ...i, oraciones: Array.from({ length: n }, (_, k) => ({ ...i.oraciones[0]!, texto_es: `${"a".repeat(largo - 1)}${k}`, texto_en: `${"b".repeat(largo - 1)}${k}` })), evidencia: Array.from({ length: n }, (_, k) => ({ eventos: [`e${k}`] })) });
const cesionesDe = (idioma: "es" | "en", rol: "comentarista" | "estadista") => MESA_ARENA.cesiones[idioma][rol].map(c => c.replace("{nombre}", MESA_ARENA.nombres[idioma][rol]));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); olvidarCatalogoVoces(); });

describe("045 · SSML de una intervención", () => {
  const estadista = intervencionEstadista(datosEstadista(registro, tick).filter(d => d.ocupaPlaza).slice(0, 1), tick);
  it("con cesión: dos <voice> hermanos (narrador → invitado) en un documento", () => {
    for (const idioma of ["es", "en"] as const) {
      const relato = relatoIntervencion(estadista, seed, idioma);
      expect(relato.fragmentos.map(f => f.rol)).toEqual(["narrador", "estadista"]);
      expect(relato.fragmentos[0]!.texto).toContain(MESA_ARENA.nombres[idioma].estadista);
      expect(cesionesDe(idioma, "estadista")).toContain(relato.fragmentos[0]!.texto);
      const p = prepararVoz(relato.fragmentos, idioma);
      const asignadas = asignarVoces(idioma);
      expect(voces(p.ssml)).toEqual([asignadas.narrador.voz, asignadas.estadista.voz]);
      expect(p.voz).toBe(asignadas.estadista.voz);
      expect(p.ssml.match(/<speak /g)).toHaveLength(1);
    }
  });

  it("todas las oraciones del invitado van en un fragmento; sin cesión hay un solo <voice>", () => {
    const largo = Math.floor(MESA_ARENA.maxCaracteresIntervencion / 2) - 5;
    const dos = conTexto(estadista, largo);
    const relato = relatoIntervencion(dos, seed, "es");
    // Las dos oraciones caben juntas, pero no con la cesión: se omite la cesión, no el dato.
    expect(relato.fragmentos).toHaveLength(1);
    expect(relato.fragmentos[0]!.texto).toBe(dos.oraciones.map(o => o.texto_es).join(" "));
    expect(relato.cesion).toBe(false);
    expect(voces(prepararVoz(relato.fragmentos, "es").ssml)).toHaveLength(1);
  });

  it("C1 · maxCaracteresOracion más la cesión más larga cabe en maxCaracteresIntervencion: el recorte siempre conserva la cesión", () => {
    const cesiones = (["es", "en"] as const).flatMap(idioma => (["comentarista", "estadista"] as const).flatMap(rol => cesionesDe(idioma, rol)));
    expect(MESA_ARENA.maxCaracteresOracion + Math.max(...cesiones.map(c => c.length))).toBeLessThanOrEqual(MESA_ARENA.maxCaracteresIntervencion);
    // Dos oraciones al máximo superan el clip: queda la primera, con su cesión.
    for (const idioma of ["es", "en"] as const) {
      const relato = relatoIntervencion(conTexto(estadista, MESA_ARENA.maxCaracteresOracion), seed, idioma);
      expect(relato.fragmentos.map(f => f.rol)).toEqual(["narrador", "estadista"]);
      expect(relato.fragmentos[1]!.texto).toHaveLength(MESA_ARENA.maxCaracteresOracion);
    }
  });

  it("C12a · recorte real: la primera oración de una intervención llm de dos oraciones sigue verificada y es la que suena", async () => {
    const max = MESA_ARENA.maxCaracteresOracion;
    // Cada oración repite su hecho (fiel) hasta el máximo por oración: la primera, el principal;
    // la segunda, otro hecho de jugada. Juntas superan maxCaracteresIntervencion.
    const reforzar = (texto: string, union: string) => {
      const base = texto.replace(/\.$/, ""); let r = texto;
      for (let k = 2; ; k++) { const s = Array.from({ length: k }, () => base).join(union) + "."; if (s.length > max) return r; r = s; }
    };
    const principal = [...contextoNarradorArena(registro, tick, MESA_ARENA.hechosComentarista)].sort((a, b) => b.texto_es.length - a.texto_es.length)[0]!;
    const llm: Llm = { id: "modelo-prueba", completar: async (_s, m) => {
      const c = JSON.parse(m[0]!.contenido) as { hechos: HechoVerificable[]; principal: string };
      const p = c.hechos.find(h => h.id === c.principal)!;
      const otro = c.hechos.filter(h => h.id !== p.id && h.id.startsWith("arena:")).sort((a, b) => b.texto_es.length + b.texto_en.length - a.texto_es.length - a.texto_en.length)[0]!;
      return JSON.stringify({ oraciones: [p, otro].map(h => ({ texto_es: reforzar(h.texto_es, ", y "), texto_en: reforzar(h.texto_en, ", and "), hecho: h.id, apoyo: [] })) });
    } };
    const i = (await comentarArena(registro, tick, llm, { principal: principal.id }))!;
    expect(i.modo).toBe("llm"); expect(i.oraciones).toHaveLength(2);
    expect(i.oraciones[1]!.hecho).not.toBe(i.oraciones[0]!.hecho);
    // El recorte a la primera oración sigue pasando V1–V8 con los mismos hechos.
    expect(verificarUpdate(JSON.stringify({ oraciones: [i.oraciones[0]] }), i.hechos, { config: registro.config.partido }, i.oraciones[0]!.hecho, MESA_ARENA.maxOracionesComentarista).motivos).toEqual([]);
    for (const idioma of ["es", "en"] as const) {
      const textos = i.oraciones.map(o => idioma === "es" ? o.texto_es : o.texto_en);
      expect(textos.join(" ").length).toBeGreaterThan(MESA_ARENA.maxCaracteresIntervencion);
      const relato = relatoIntervencion(i, seed, idioma);
      expect(relato.fragmentos.at(-1)!.texto).toBe(textos[0]);
      expect(relato.fragmentos.at(-1)!.rol).toBe("comentarista");
      expect(relato.fuentes).toEqual([...new Set(i.evidencia[0]!.eventos)]);
      expect(relato.fragmentos.map(f => f.texto).join("").length).toBeLessThanOrEqual(MESA_ARENA.maxCaracteresIntervencion);
    }
  });

  it("C2 · sin memoria: dos llamadas para la misma intervención e idioma producen el mismo SSML (misma claveAudio)", async () => {
    const comentarista = (await comentarArena(registro, tick, undefined))!;
    const otras = datosEstadista(registro, tick).filter(d => d.ocupaPlaza).map(d => intervencionEstadista([d], tick));
    for (const i of [comentarista, ...otras]) for (const idioma of ["es", "en"] as const) {
      const a = relatoIntervencion(i, seed, idioma), b = relatoIntervencion(i, seed, idioma);
      expect(b).toEqual(a);
      const pa = prepararVoz(a.fragmentos, idioma), pb = prepararVoz(b.fragmentos, idioma);
      expect(pb.ssml).toBe(pa.ssml);
      expect(claveAudio(pb, i.tick)).toBe(claveAudio(pa, i.tick));
    }
  });

  it("C8 · la cesión sale de cesiones[idioma][rol] y nombra al invitado, para todo idioma, rol y variante", () => {
    for (const idioma of ["es", "en"] as const) for (const rol of ["comentarista", "estadista"] as const) {
      const usadas = new Set<string>(), variantes = new Set<number>();
      for (let n = 0; n < 200; n++) {
        const id = `${rol}:prueba-${n}:${tick}`;
        variantes.add(varianteVoz(seed, id));
        const cesion = relatoIntervencion({ ...estadista, id, rol }, seed, idioma).fragmentos[0]!;
        expect(cesion.rol).toBe("narrador");
        expect(cesionesDe(idioma, rol)).toContain(cesion.texto);
        expect(cesion.texto).toContain(MESA_ARENA.nombres[idioma][rol]);
        usadas.add(cesion.texto);
      }
      // Todas las variantes de varianteVoz aparecen y cada cesión del rol es alcanzable.
      expect(variantes.size).toBeGreaterThanOrEqual(MESA_ARENA.cesiones[idioma][rol].length);
      expect(usadas.size).toBe(MESA_ARENA.cesiones[idioma][rol].length);
    }
    // Al comentarista nunca se le cede «con el dato».
    expect(cesionesDe("es", "comentarista").some(c => c.includes("con el dato"))).toBe(false);
    expect(cesionesDe("en", "comentarista").some(c => c.includes("with the numbers"))).toBe(false);
  });

  it("la voz y el estilo se eligen por rol e idioma", () => {
    const frag = (rol: "comentarista" | "estadista", texto = "Un dato confirmado.") => ({ tick: 1, texto, emocion: "serena" as const, intensidad: 0.2, variante: 1, fuentes: [], fotogramas: [], rol });
    expect(voces(prepararVoz([frag("comentarista")], "es").ssml)).toEqual(["es-MX-DaliaNeural"]);
    expect(prepararVoz([frag("comentarista")], "es").ssml).not.toContain("express-as");
    expect(prepararVoz([frag("comentarista")], "en").ssml).toContain('<voice name="en-US-DavisNeural"><s><mstts:express-as style="chat"');
    expect(voces(prepararVoz([frag("estadista")], "es").ssml)).toEqual(["es-MX-GerardoNeural"]);
    expect(prepararVoz([frag("estadista")], "en").ssml).toContain('<voice name="en-US-GuyNeural"><s><mstts:express-as style="newscast"');
    // Fragmentos contiguos del mismo rol comparten <voice>; el escape se conserva.
    const p = prepararVoz([frag("comentarista", "uno"), frag("comentarista", '<voice name="x"> & dos')], "es");
    expect(voces(p.ssml)).toEqual(["es-MX-DaliaNeural"]); expect(p.ssml).toContain("&lt;voice");
    vi.stubEnv("ARENA_VOZ_ES_COMENTARISTA", "es-MX-GerardoNeural");
    expect(voces(prepararVoz([frag("comentarista")], "es").ssml)).toEqual(["es-MX-GerardoNeural"]);
    vi.stubEnv("ARENA_VOZ_ES_ESTADISTA", "en-US-GuyNeural");
    expect(() => prepararVoz([frag("estadista")], "es")).toThrow();
  });
});

describe("045 · degradación de voces", () => {
  const todas = new Set(["es-MX-JorgeNeural", "es-MX-DaliaNeural", "es-MX-GerardoNeural", "en-US-JennyNeural", "en-US-GuyNeural", "en-US-DavisNeural"]);
  const sin = (...v: string[]) => new Set([...todas].filter(x => !v.includes(x)));
  it("sigue la precedencia: comentarista → narrador; estadista → comentarista → narrador", () => {
    expect(asignarVoces("es", todas)).toEqual({ narrador: { voz: "es-MX-JorgeNeural", motivo: "predeterminada" }, comentarista: { voz: "es-MX-DaliaNeural", motivo: "predeterminada" }, estadista: { voz: "es-MX-GerardoNeural", motivo: "predeterminada" } });
    expect(asignarVoces("es", sin("es-MX-DaliaNeural")).comentarista).toEqual({ voz: "es-MX-JorgeNeural", motivo: "degradada:narrador" });
    expect(asignarVoces("es", sin("es-MX-GerardoNeural")).estadista).toEqual({ voz: "es-MX-DaliaNeural", motivo: "degradada:comentarista" });
    expect(asignarVoces("en", sin("en-US-GuyNeural", "en-US-DavisNeural")).estadista).toEqual({ voz: "en-US-JennyNeural", motivo: "degradada:narrador" });
    expect(asignarVoces("en", null).estadista.motivo).toBe("predeterminada");
    vi.stubEnv("ARENA_VOZ_EN_COMENTARISTA", "en-US-GuyNeural");
    expect(asignarVoces("en", todas).comentarista).toEqual({ voz: "en-US-GuyNeural", motivo: "entorno" });
    const p = prepararVoz([{ tick: 1, texto: "Dato.", emocion: "serena", intensidad: .1, variante: 0, fuentes: [], fotogramas: [], rol: "comentarista" }], "es", vocesDe(asignarVoces("es", sin("es-MX-DaliaNeural"))));
    expect(voces(p.ssml)).toEqual(["es-MX-JorgeNeural"]);
  });

  it("/api/arena/herramientas declara la asignación efectiva con el catálogo simulado", async () => {
    vi.stubEnv("ARENA_VOZ", "1"); vi.stubEnv("AZURE_SPEECH_ENDPOINT", "https://ejemplo.cognitiveservices.azure.com"); vi.stubEnv("AZURE_SPEECH_KEY", "prueba");
    const lista = [...sin("es-MX-GerardoNeural", "es-MX-DaliaNeural")].map(ShortName => ({ ShortName }));
    const transporte = vi.fn<typeof fetch>(async url => { expect(String(url)).toContain("/voices/list"); return Response.json(lista); }); vi.stubGlobal("fetch", transporte);
    const r = await (await herramientas()).json();
    expect(r.voz).toBe(true); expect(r.catalogo).toBe("consultado");
    expect(r.voces.es.comentarista).toEqual({ voz: "es-MX-JorgeNeural", motivo: "degradada:narrador" });
    expect(r.voces.es.estadista).toEqual({ voz: "es-MX-JorgeNeural", motivo: "degradada:narrador" });
    expect(r.voces.en.estadista).toEqual({ voz: "en-US-GuyNeural", motivo: "predeterminada" });
    await herramientas(); expect(transporte).toHaveBeenCalledTimes(1); // catálogo en caché
    olvidarCatalogoVoces(); vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 500 })));
    expect(await catalogoVoces()).toBeNull();
    const sinCatalogo = await (await herramientas()).json();
    expect(sinCatalogo.catalogo).toBe("no disponible"); expect(sinCatalogo.voces.es.comentarista.motivo).toBe("predeterminada");
  });

  it("C6 · un fallo del catálogo se guarda catalogoVocesReintentoS y una respuesta catalogoVocesCacheS", async () => {
    vi.stubEnv("AZURE_SPEECH_ENDPOINT", "https://ejemplo.cognitiveservices.azure.com"); vi.stubEnv("AZURE_SPEECH_KEY", "prueba");
    vi.useFakeTimers({ toFake: ["Date"] });
    const inicio = new Date("2026-10-21T12:00:00Z").getTime(); vi.setSystemTime(inicio);
    let respuesta: () => Promise<Response> = async () => new Response("x", { status: 500 });
    const transporte = vi.fn<typeof fetch>(async () => respuesta()); vi.stubGlobal("fetch", transporte);
    // Fallo HTTP: dos consultas seguidas, una sola llamada.
    expect(await catalogoVoces()).toBeNull(); expect(await catalogoVoces()).toBeNull();
    expect(transporte).toHaveBeenCalledTimes(1);
    vi.setSystemTime(inicio + MESA_ARENA.catalogoVocesReintentoS * 1000 - 1);
    expect(await catalogoVoces()).toBeNull(); expect(transporte).toHaveBeenCalledTimes(1);
    // Pasado el reintento vuelve a consultar; un error de transporte también se guarda.
    vi.setSystemTime(inicio + MESA_ARENA.catalogoVocesReintentoS * 1000 + 1);
    respuesta = async () => { throw new Error("red caída"); };
    expect(await catalogoVoces()).toBeNull(); expect(await catalogoVoces()).toBeNull();
    expect(transporte).toHaveBeenCalledTimes(2);
    // Lista vacía: también es un fallo guardado.
    vi.setSystemTime(inicio + 2 * (MESA_ARENA.catalogoVocesReintentoS * 1000 + 1));
    respuesta = async () => Response.json([]);
    expect(await catalogoVoces()).toBeNull(); expect(await catalogoVoces()).toBeNull();
    expect(transporte).toHaveBeenCalledTimes(3);
    // Una respuesta válida se guarda el tiempo largo.
    const exito = inicio + 3 * (MESA_ARENA.catalogoVocesReintentoS * 1000 + 1); vi.setSystemTime(exito);
    respuesta = async () => Response.json([...todas].map(ShortName => ({ ShortName })));
    expect(await catalogoVoces()).toEqual(todas);
    vi.setSystemTime(exito + MESA_ARENA.catalogoVocesCacheS * 1000 - 1);
    expect(await catalogoVoces()).toEqual(todas); expect(transporte).toHaveBeenCalledTimes(4);
    vi.setSystemTime(exito + MESA_ARENA.catalogoVocesCacheS * 1000 + 1);
    await catalogoVoces(); expect(transporte).toHaveBeenCalledTimes(5);
  });
});
