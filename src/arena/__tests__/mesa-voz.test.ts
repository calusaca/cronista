// Brief 045 · Voz por rol: un SSML con hasta dos <voice>, cesión decidida por caracteres,
// degradación según el catálogo y su declaración en /api/arena/herramientas.
import { readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { planProgramado } from "../controladores";
import type { ModeloConfigurado } from "../modelos";
import { GestorSesiones, PRESUPUESTO_AUDIO_ENCUENTRO, rechazoCuotaVoz } from "../sesiones";
import { POST as relatoHttp } from "../../app/api/arena/sesiones/[id]/relato/route";
import { afterEach, describe, expect, it, vi } from "vitest";
import { verificarUpdate, type HechoVerificable } from "../../cadena/verificador";
import type { Llm } from "../../lib/llm";
import { MESA_ARENA, PREVIA_ARENA } from "../../sim/limites";
import { previaPartido } from "../previa";
import { crearConfigArena, crearEstadoArena } from "../motor";
import { datosEstadista, intervencionEstadista } from "../estadista";
import { varianteVoz } from "../expresion";
import { comentarArena, contextoNarradorArena } from "../narrador";
import type { IntervencionArena } from "../protocolo";
import { relatoIntervencion } from "../relato";
import { VOZ_BUFFER } from "../buffer";
import { componerIntercambio, comprobarTurnos, memoriaDialogoVacia } from "../dialogo";
import { estimarDuracionS, segmentoVozValido, varianteEfectiva } from "../turnos";
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

  it("C1 (048) · invariantes de § 3.5 desde las constantes: el último escalón siempre cabe y el clip máximo dura menos que duracionMaxS", () => {
    expect(MESA_ARENA.maxCaracteresOracion).toBeLessThanOrEqual(MESA_ARENA.maxCaracteresIntervencion);
    expect(MESA_ARENA.maxCaracteresIntervencion / MESA_ARENA.dialogo.caracteresPorSegundoVoz).toBeLessThan(VOZ_BUFFER.duracionMaxS);
    // Camino del 045 (diarios sin turnos): dos oraciones al máximo superan el clip; queda la primera
    // (si la cesión ya no cabe, se omite la cesión, nunca el dato).
    for (const idioma of ["es", "en"] as const) {
      const relato = relatoIntervencion(conTexto(estadista, MESA_ARENA.maxCaracteresOracion), seed, idioma);
      expect(relato.fragmentos.at(-1)!.rol).toBe("estadista");
      expect(relato.fragmentos.at(-1)!.texto).toHaveLength(MESA_ARENA.maxCaracteresOracion);
      expect(relato.fragmentos.map(f => f.texto).join(" ").length).toBeLessThanOrEqual(MESA_ARENA.maxCaracteresIntervencion);
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
    // 048 · El recorte es el escalón 3 de la escalera: la completa conserva solo la primera oración,
    // que es la verificada arriba, y la composición pasa D1–D5.
    const x = componerIntercambio({ intervencion: i, registro, seed, forma: "pregunta", memoria: memoriaDialogoVacia() });
    expect(x.intervencion.auditDialogo!.escalones).toContain("3:primera-oracion");
    const turnoC = x.intervencion.turnos!.find(t => t.rol === "comentarista")!;
    expect(turnoC.oraciones.map(k => x.intervencion.oraciones[k])).toEqual([i.oraciones[0]]);
    expect(comprobarTurnos(x.intervencion, registro)).toEqual([]);
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

describe("048 · SSML de un intercambio", () => {
  const v4 = JSON.parse(readFileSync("src/arena/__fixtures__/arena-reinicios-v4.json", "utf8")) as RegistroArena;
  const t4 = v4.eventos.find(e => e.tipo === "gol")!.tick;
  const pre = { ...v4, eventos: v4.eventos.filter(e => e.tick <= t4), fotogramas: v4.fotogramas.filter(f => f.tick <= t4), final: [...v4.fotogramas].reverse().find(f => f.tick <= t4)! };
  const gol = v4.eventos.find(e => e.tipo === "gol")!;
  const componer = async (forma: "pregunta" | "ronda") => {
    const i = (await comentarArena(pre, t4, undefined, { principal: `arena:${gol.id}`, tema: "gol" }))!;
    const dato = datosEstadista(pre, t4).find(d => d.tema === "marcador")!;
    return componerIntercambio({ intervencion: i, registro: pre, seed: v4.config.partido.seed, forma, dato, memoria: memoriaDialogoVacia() }).intervencion;
  };

  it("tantos <voice> como turnos (3 y 4), en el orden de los roles; un fragmento por turno", async () => {
    for (const forma of ["pregunta", "ronda"] as const) {
      const i = await componer(forma);
      expect(comprobarTurnos(i, pre)).toEqual([]);
      expect(i.turnos!.length).toBe(forma === "pregunta" ? 3 : 4);
      for (const idioma of ["es", "en"] as const) {
        const relato = relatoIntervencion(i, v4.config.partido.seed, idioma);
        expect(relato.variante).toBe("completa"); expect(relato.turnos).toBe(i.turnos!.length);
        expect(relato.fragmentos.map(f => f.rol)).toEqual(i.turnos!.map(t => t.rol));
        expect(relato.fragmentos.map(f => f.texto)).toEqual(i.turnos!.map(t => idioma === "es" ? t.texto_es : t.texto_en));
        expect(relato.fragmentos.every(f => f.tick === i.tick)).toBe(true);
        const asignadas = asignarVoces(idioma), p = prepararVoz(relato.fragmentos, idioma);
        expect(voces(p.ssml)).toEqual(i.turnos!.map(t => asignadas[t.rol].voz));
        expect(p.ssml.match(/<speak /g)).toHaveLength(1);
      }
    }
  });

  it("mismo SSML y misma claveAudio para el mismo id, idioma y variante; distintos entre variantes", async () => {
    const i = await componer("ronda");
    expect(i.turnosBreve).toBeDefined();
    for (const idioma of ["es", "en"] as const) {
      const clave = (variante: "completa" | "breve") => { const r = relatoIntervencion(i, v4.config.partido.seed, idioma, variante); return { r, p: prepararVoz(r.fragmentos, idioma) }; };
      const a = clave("completa"), b = clave("completa"), c = clave("breve"), d = clave("breve");
      expect(b.p.ssml).toBe(a.p.ssml); expect(claveAudio(b.p, i.tick)).toBe(claveAudio(a.p, i.tick));
      expect(d.p.ssml).toBe(c.p.ssml); expect(claveAudio(d.p, i.tick)).toBe(claveAudio(c.p, i.tick));
      expect(c.p.ssml).not.toBe(a.p.ssml); expect(claveAudio(c.p, i.tick)).not.toBe(claveAudio(a.p, i.tick));
      expect(c.r.variante).toBe("breve"); expect(c.r.fragmentos.map(f => f.rol)).toEqual(i.turnosBreve!.map(t => t.rol));
    }
    // `breve` sobre una intervención sin turnosBreve sirve la completa y lo declara.
    const sinBreve = { ...i, turnosBreve: undefined };
    expect(relatoIntervencion(sinBreve, v4.config.partido.seed, "es", "breve")).toMatchObject({ variante: "completa", turnos: i.turnos!.length });
  });

  it("v1.1 (8) · los textos más largos posibles en ES y EN con cuatro turnos caben en duracionMaxS según la estimación", () => {
    const estimacion = MESA_ARENA.maxCaracteresIntervencion / MESA_ARENA.dialogo.caracteresPorSegundoVoz + (MESA_ARENA.dialogo.maxTurnos - 1) * MESA_ARENA.dialogo.pausaTurnoS;
    expect(estimacion).toBeLessThanOrEqual(VOZ_BUFFER.duracionMaxS);
    // La medida que usa la escalera: cuatro turnos que suman exactamente el máximo en ES y EN.
    const largo = MESA_ARENA.maxCaracteresIntervencion - (MESA_ARENA.dialogo.maxTurnos - 1);
    const partes = [Math.floor(largo / 4), Math.floor(largo / 4), Math.floor(largo / 4), largo - 3 * Math.floor(largo / 4)];
    const turnos = partes.map(n => ({ texto_es: "a".repeat(n), texto_en: "b".repeat(n) }));
    expect(turnos.map(t => t.texto_es).join(" ")).toHaveLength(MESA_ARENA.maxCaracteresIntervencion);
    expect(estimarDuracionS(turnos)).toBeCloseTo(estimacion);
    expect(estimarDuracionS(turnos)).toBeLessThanOrEqual(VOZ_BUFFER.duracionMaxS);
  });
});

describe("048 · ruta de relato con variantes (lectura del diario, nunca composición)", () => {
  const rutas: string[] = [];
  const compartido = globalThis as typeof globalThis & { __cronistaSesiones?: GestorSesiones };
  let previo: GestorSesiones | undefined;
  afterEach(async () => { compartido.__cronistaSesiones = previo; await Promise.all(rutas.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
  const llmDe = (completar: Llm["completar"]): Llm => ({ id: "modelo-prueba", completar });
  const fielLlm = (contador: { n: number }) => llmDe(async (_s, m) => { contador.n++; const c = JSON.parse(m[0]!.contenido) as { hechos: HechoVerificable[]; principal: string }, h = c.hechos.find(h => h.id === c.principal)!; return JSON.stringify({ oraciones: [{ texto_es: h.texto_es, texto_en: h.texto_en, hecho: h.id, apoyo: [] }] }); });
  const preparar = async (contador: { n: number }, segundos = 60) => {
    previo = compartido.__cronistaSesiones;
    vi.stubEnv("ARENA_BLOB_ENDPOINT", ""); vi.stubEnv("ARENA_VOZ", "1");
    vi.stubEnv("AZURE_SPEECH_ENDPOINT", "https://ejemplo.cognitiveservices.azure.com"); vi.stubEnv("AZURE_SPEECH_KEY", "prueba");
    const directorio = await mkdtemp(join(tmpdir(), "cronista-voz-048-")); rutas.push(directorio);
    const catalogo: ModeloConfigurado[] = [{ publico: { id: "p", nombre: "P", controlador: "p" }, crear: () => llmDe(async (_s, m) => JSON.stringify(planProgramado(JSON.parse(m[0]!.contenido)))) }];
    const g = new GestorSesiones({ directorio, ritmoMsPorSegundo: 0, catalogo: () => catalogo, narrador: () => fielLlm(contador) });
    compartido.__cronistaSesiones = g;
    const { id } = await g.crear({ seed: 42, segundos, local: "auto", visita: "auto", seleccion: { modo: "manual", local: "p", visita: "p" }, presentacion: "buffer" });
    await g.esperarFinal(id);
    // Speech simulado: el catálogo falla (sin degradación) y la síntesis devuelve bytes.
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async url => String(url).includes("/voices/list") ? new Response("x", { status: 500 }) : new Response(new Uint8Array([1, 2, 3]))));
    return { g, id, directorio };
  };
  const pedir = (id: string, cuerpo: object) => relatoHttp(new Request("http://localhost/relato", { method: "POST", body: JSON.stringify(cuerpo) }), { params: Promise.resolve({ id }) });

  it("sirve exactamente los turnos guardados (texto y SSML) en las dos variantes, sin llamar al LLM; `breve` sin turnosBreve sirve la completa", async () => {
    const contador = { n: 0 }, { g, id } = await preparar(contador);
    const tras = contador.n, r = await g.reproduccion(id);
    const con = r.intervenciones.filter(i => i.turnos?.length);
    expect(con.length).toBeGreaterThan(1);
    // Una recomposición desde cero (memoria vacía) cambiaría al menos un nombre ya presentado.
    expect(con.some(i => i.turnos!.some(t => t.rol === "narrador" && !t.texto_es.includes(MESA_ARENA.nombres.es.comentarista) && !t.texto_es.includes(MESA_ARENA.nombres.es.estadista)))).toBe(true);
    let comprobadas = 0, agotadas = 0;
    // Primero las completas (ES y después EN), luego las breves.
    for (const variante of ["completa", "breve"] as const) for (const idioma of ["es", "en"] as const) for (const i of con) {
      const respuesta = await pedir(id, { desdeTick: i.tick, hastaTick: i.tick, modo: "buffer", idioma, intervencion: i.id, variante });
      // v1.3 (1): pedir todo en dos idiomas agota la bolsa de los invitados; solo ese 429 se admite.
      if (respuesta.status === 429) { expect((await respuesta.json()).error).toBe("Bolsa de voz de los invitados agotada"); agotadas++; continue; }
      expect(respuesta.status).toBe(200); comprobadas++;
      const datos = await respuesta.json();
      const efectiva = variante === "breve" && i.turnosBreve ? "breve" : "completa", turnos = efectiva === "breve" ? i.turnosBreve! : i.turnos!;
      expect(datos).toMatchObject({ variante: efectiva, turnos: turnos.length, tipoRelato: "invitado", intervencion: i.id });
      expect(datos.fragmentos.map((f: { texto: string }) => f.texto)).toEqual(turnos.map(t => idioma === "es" ? t.texto_es : t.texto_en));
      expect(datos.fragmentos.map((f: { rol: string }) => f.rol)).toEqual(turnos.map(t => t.rol));
      const esperado = prepararVoz(relatoIntervencion(i, r.registro.config.partido.seed, idioma, variante).fragmentos, idioma);
      expect(prepararVoz(datos.fragmentos, idioma).ssml).toBe(esperado.ssml);
      // v1.2 (9) D04 · cada fragmento lleva como fuentes los eventos de las oraciones de su turno.
      turnos.forEach((t, k) => {
        const fuentes = [...new Set(t.oraciones.flatMap(o => i.evidencia[o]!.eventos))];
        expect(datos.fragmentos[k].fuentes).toEqual(fuentes);
        if (t.rol !== "narrador" && i.evidencia[t.oraciones[0]!]!.eventos.length) expect(datos.fragmentos[k].fuentes.length).toBeGreaterThan(0);
      });
    }
    // Dentro de la cuota se comprueban al menos todas las completas en ES (las primeras pedidas).
    expect(comprobadas).toBeGreaterThanOrEqual(con.length);
    expect(comprobadas + agotadas).toBe(con.length * 4);
    expect(contador.n).toBe(tras);
    // `variante` sin `intervencion` no se admite en la rama del narrador.
    expect((await pedir(id, { desdeTick: 0, hastaTick: 50, modo: "buffer", idioma: "es", variante: "breve" })).status).toBe(400);
  });

  it("v1.1 (2) · un diario del 045 (sin turnos) se sirve como una sola variante completa, también si se pide la breve", async () => {
    const contador = { n: 0 }, { g, id, directorio } = await preparar(contador);
    const r = await g.reproduccion(id);
    const objetivo = r.intervenciones.find(i => i.rol === "comentarista" && i.turnos)!;
    // Se reescribe el diario quitando los campos del 048 a una intervención, como en un diario del 045.
    const archivo = join(directorio, `${id}.ndjson`);
    const lineas = readFileSync(archivo, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l) as { publicacion: { tipo: string; intervencion?: IntervencionArena } });
    for (const m of lineas) if (m.publicacion.intervencion?.id === objetivo.id) {
      const { forma: _f, turnos: _t, turnosBreve: _b, auditDialogo: _a, ...resto } = m.publicacion.intervencion;
      m.publicacion.intervencion = { ...resto, oraciones: resto.oraciones.filter(o => !o.hecho.startsWith("estadista:")), evidencia: resto.evidencia.filter((_, k) => !resto.oraciones[k]!.hecho.startsWith("estadista:")) };
    }
    writeFileSync(archivo, lineas.map(l => JSON.stringify(l)).join("\n") + "\n");
    compartido.__cronistaSesiones = new GestorSesiones({ directorio });
    for (const variante of ["completa", "breve"] as const) {
      const datos = await (await pedir(id, { desdeTick: objetivo.tick, hastaTick: objetivo.tick, modo: "buffer", idioma: "es", intervencion: objetivo.id, variante })).json();
      expect(datos.variante).toBe("completa");
      expect(datos.fragmentos.at(-1).rol).toBe("comentarista");
      expect(segmentoVozValido(datos, { desde: objetivo.tick, hasta: objetivo.tick, idioma: "es", intervencion: { id: objetivo.id, tick: objetivo.tick, variante: varianteEfectiva({}, variante) } })).toBe(true);
    }
  });

  /** Recorrido en orden temporal como el consumidor: por tick, apertura, tramos del narrador, las
   * intervenciones de ese tramo (breve y completa) y, al final, el cierre; por cada idioma. */
  const recorrido = async (segundos: number, idiomas: readonly ("es" | "en")[], conInvitados: boolean) => {
    const contador = { n: 0 }, { g, id } = await preparar(contador, segundos);
    const r = await g.reproduccion(id), fin = r.registro.final.tick;
    type Paso = { tick: number; orden: number; clave: string; tipo: "narrador" | "invitado" | "cierre"; cuerpo: object };
    const plan: Paso[] = [];
    for (const idioma of idiomas) {
      plan.push({ tick: 0, orden: 0, clave: `${idioma}:entrada`, tipo: "narrador", cuerpo: { desdeTick: 0, hastaTick: Math.min(50, fin), modo: "buffer", idioma, entradaTick: 0 } });
      for (let desde = 0; desde < fin; desde += 50) plan.push({ tick: desde, orden: 1, clave: `${idioma}:${desde}`, tipo: "narrador", cuerpo: { desdeTick: desde, hastaTick: Math.min(desde + 50, fin), modo: "buffer", idioma } });
      if (conInvitados) for (const i of r.intervenciones) for (const variante of ["breve", "completa"] as const) if (variante === "completa" || i.turnosBreve)
        plan.push({ tick: i.tick, orden: 2, clave: `${idioma}:${i.id}:${variante}`, tipo: "invitado", cuerpo: { desdeTick: i.tick, hastaTick: i.tick, modo: "buffer", idioma, intervencion: i.id, variante } });
      plan.push({ tick: fin + 1, orden: 3, clave: `${idioma}:cierre`, tipo: "cierre", cuerpo: { desdeTick: Math.floor((fin - 1) / 50) * 50, hastaTick: fin, modo: "buffer", idioma, cierre: true } });
    }
    plan.sort((a, b) => a.tick - b.tick || a.orden - b.orden);
    const estado = new Map<string, number>(), errores = new Map<string, string>();
    for (const p of plan) { const res = await pedir(id, p.cuerpo); estado.set(p.clave, res.status); if (res.status !== 200) errores.set(p.clave, (await res.json()).error); }
    const de = (tipo: Paso["tipo"]) => plan.filter(p => p.tipo === tipo).map(p => p.clave);
    return { estado, errores, narrador: de("narrador"), invitados: de("invitado"), cierres: de("cierre") };
  };

  // v1.3 (1–2) · Cada recorrido se comprueba por separado (sin mezclar estados entre recorridos).
  const recorridos = [[60, ["es"]], [60, ["es", "en"]], [120, ["es"]], [120, ["es", "en"]], [180, ["es"]], [180, ["es", "en"]]] as const;
  for (const [segundos, idiomas] of recorridos) it(`v1.3 (1) · ${segundos} s ${idiomas.join("+")}, ambas variantes intercaladas: los rechazos del narrador son idénticos con y sin invitados; los cierres, 200 donde lo eran sin invitados; los invitados solo gastan su bolsa`, async () => {
    const B = MESA_ARENA.dialogo.bolsaSpeechInvitados;
    const sin = await recorrido(segundos, idiomas, false), con = await recorrido(segundos, idiomas, true);
    const rechazos = (x: typeof sin) => x.narrador.map(k => [k, x.estado.get(k)!] as const).filter(([, s]) => s !== 200);
    expect(rechazos(con)).toEqual(rechazos(sin));
    for (const k of sin.cierres) expect([k, "sin", sin.estado.get(k)]).toEqual([k, "sin", 200]);
    for (const k of con.cierres) expect([k, "con", con.estado.get(k)]).toEqual([k, "con", sin.estado.get(k)]);
    expect(con.invitados.length).toBeGreaterThan(0);
    expect(con.invitados.filter(k => con.estado.get(k) === 200).length).toBeLessThanOrEqual(B.solicitudes);
    for (const k of con.invitados.filter(k => con.estado.get(k) !== 200)) expect([k, con.estado.get(k), con.errores.get(k)]).toEqual([k, 429, "Bolsa de voz de los invitados agotada"]);
    // v1.3 (2): a 180 s ES+EN el narrador solo ya supera su presupuesto (límite anterior al 048, declarado).
    if (segundos === 180 && idiomas.length === 2) expect(rechazos(sin).length).toBeGreaterThan(0);
    else expect(rechazos(sin)).toEqual([]);
  }, 120_000);

  it("v1.3 (1) · rechazoCuotaVoz: con la bolsa de invitados llena, el narrador conserva todas sus solicitudes (repro de Codex)", () => {
    const P = PRESUPUESTO_AUDIO_ENCUENTRO, B = MESA_ARENA.dialogo.bolsaSpeechInvitados;
    const admitidos = (conInvitados: boolean) => {
      const r: { tipo: string; caracteres: number; clase: "narrador" | "invitado" }[] = [];
      if (conInvitados) for (let k = 0; k < B.solicitudes; k++) if (!rechazoCuotaVoz(r, Math.floor(B.caracteres / B.solicitudes), "invitado")) r.push({ tipo: "audio", caracteres: Math.floor(B.caracteres / B.solicitudes), clase: "invitado" });
      let n = 0;
      for (let k = 0; k < P.solicitudes; k++) if (!rechazoCuotaVoz(r, 250, "narrador")) { r.push({ tipo: "audio", caracteres: 250, clase: "narrador" }); n++; }
      return { n, cierre: rechazoCuotaVoz(r, 335, "cierre") };
    };
    const sin = admitidos(false), con = admitidos(true);
    expect(con).toEqual(sin);
    expect(sin.n).toBe(P.solicitudes - MESA_ARENA.dialogo.reservaSpeechCierreSolicitudes);
    expect(sin.cierre).toBeNull();
    expect(rechazoCuotaVoz(Array.from({ length: B.solicitudes }, () => ({ tipo: "audio", caracteres: 1, clase: "invitado" as const })), 1, "invitado")).toBe("Bolsa de voz de los invitados agotada");
  });
});

// Brief 056 (§§ 5.3–5.4 y v1.1 §§ 1, 9, 11) · Previa hablada: ruta /relato con ventana [0, 0] y lectura
// re-derivada (nunca del diario), bolsa de Speech propia, suficiencia con SSML real y aislamiento.
describe("056 · previa en la ruta /relato y en el presupuesto de voz", () => {
  const rutas: string[] = [];
  const compartido = globalThis as typeof globalThis & { __cronistaSesiones?: GestorSesiones };
  let previo: GestorSesiones | undefined;
  afterEach(async () => { compartido.__cronistaSesiones = previo; await Promise.all(rutas.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
  const llmDe = (completar: Llm["completar"]): Llm => ({ id: "modelo-prueba", completar });
  const fielLlm = () => llmDe(async (_s, m) => { const c = JSON.parse(m[0]!.contenido) as { hechos: HechoVerificable[]; principal: string }, h = c.hechos.find(h => h.id === c.principal)!; return JSON.stringify({ oraciones: [{ texto_es: h.texto_es, texto_en: h.texto_en, hecho: h.id, apoyo: [] }] }); });
  const entorno = async () => {
    previo = compartido.__cronistaSesiones;
    vi.stubEnv("ARENA_BLOB_ENDPOINT", ""); vi.stubEnv("ARENA_VOZ", "1");
    vi.stubEnv("AZURE_SPEECH_ENDPOINT", "https://ejemplo.cognitiveservices.azure.com"); vi.stubEnv("AZURE_SPEECH_KEY", "prueba");
    const directorio = await mkdtemp(join(tmpdir(), "cronista-previa-056-")); rutas.push(directorio);
    return directorio;
  };
  const speechSimulado = () => vi.stubGlobal("fetch", vi.fn<typeof fetch>(async url => String(url).includes("/voices/list") ? new Response("x", { status: 500 }) : new Response(new Uint8Array([1, 2, 3]))));
  const grabacion = async () => {
    const directorio = await entorno();
    const g = new GestorSesiones({ directorio }); compartido.__cronistaSesiones = g;
    const { id } = await g.registrarGrabacion(registro, "previa-056");
    speechSimulado();
    return { g, id, directorio };
  };
  const pedir = (id: string, cuerpo: object) => relatoHttp(new Request("http://localhost/relato", { method: "POST", body: JSON.stringify(cuerpo) }), { params: Promise.resolve({ id }) });
  const pieza = (intervencion: string, idioma: "es" | "en" = "es", variante?: "completa" | "breve") => ({ desdeTick: 0, hastaTick: 0, modo: "buffer", idioma, intervencion, ...variante ? { variante } : {} });
  const reservas = (directorio: string, id: string) => Object.values(JSON.parse(readFileSync(join(directorio, `${id}.extras.json`), "utf8")) as Record<string, { tipo: string; clase?: string }>);

  it("sesión de registrarGrabacion (sin diario de intervenciones): la pieza 1 se sirve con 200, tipoRelato invitado y reserva de clase previa; un previa:x desconocido es 404", async () => {
    const { g, id, directorio } = await grabacion();
    expect((await g.reproduccion(id)).intervenciones).toEqual([]);
    const respuesta = await pedir(id, pieza("previa:1-local:0"));
    expect(respuesta.status).toBe(200);
    const datos = await respuesta.json();
    expect(datos).toMatchObject({ tipoRelato: "invitado", intervencion: "previa:1-local:0", desdeTick: 0, hastaTick: 0, variante: "completa" });
    expect(reservas(directorio, id).filter(r => r.tipo === "audio").map(r => r.clase)).toEqual(["previa"]);
    for (const desconocido of ["previa:x", "previa:4-otra:0"]) {
      const r = await pedir(id, pieza(desconocido));
      expect([desconocido, r.status, (await r.json()).error]).toEqual([desconocido, 404, "Intervención no publicada"]);
    }
    // Nunca en el diario: la grabación sigue sin intervenciones tras servir la previa.
    expect((await g.reproduccion(id)).intervenciones).toEqual([]);
    expect((await g.emision(id)).intervenciones).toEqual([]);
  });

  it("cliente frente a ruta: las tres piezas y las dos variantes coinciden con relatoIntervencion(previaPartido(registro)[k])", async () => {
    const { id } = await grabacion();
    const piezas = previaPartido(registro);
    for (const variante of ["completa", "breve"] as const) for (const idioma of ["es", "en"] as const) for (const i of piezas) {
      const respuesta = await pedir(id, pieza(i.id, idioma, variante));
      expect([i.id, variante, idioma, respuesta.status]).toEqual([i.id, variante, idioma, 200]);
      const datos = await respuesta.json(), esperado = relatoIntervencion(i, seed, idioma, variante);
      expect(datos.fragmentos).toEqual(esperado.fragmentos);
      expect([datos.texto, datos.variante, datos.turnos, datos.tipoRelato]).toEqual([esperado.texto, esperado.variante, esperado.turnos, "invitado"]);
      expect(segmentoVozValido(datos, { desde: 0, hasta: 0, idioma, intervencion: { id: i.id, tick: 0, variante: varianteEfectiva(i, variante) } })).toBe(true);
    }
  });

  it("v1.1 § 1 · ventanas: previa [0,0] → 200; narrador [0,0] y [50,50] → 400 «Ventana de relato vacía»; intervención ordinaria con [tick, tick+1] → 400; hastaTick −1 → 400", async () => {
    const directorio = await entorno();
    const catalogo: ModeloConfigurado[] = [{ publico: { id: "p", nombre: "P", controlador: "p" }, crear: () => llmDe(async (_s, m) => JSON.stringify(planProgramado(JSON.parse(m[0]!.contenido)))) }];
    const g = new GestorSesiones({ directorio, ritmoMsPorSegundo: 0, catalogo: () => catalogo, narrador: () => fielLlm() }); compartido.__cronistaSesiones = g;
    const { id } = await g.crear({ seed: 42, segundos: 60, local: "auto", visita: "auto", seleccion: { modo: "manual", local: "p", visita: "p" }, presentacion: "buffer" });
    await g.esperarFinal(id); speechSimulado();
    expect((await pedir(id, pieza("previa:3-condiciones:0"))).status).toBe(200);
    for (const [desde, hasta] of [[0, 0], [50, 50]]) {
      const r = await pedir(id, { desdeTick: desde, hastaTick: hasta, modo: "buffer", idioma: "es" });
      expect([desde, hasta, r.status, (await r.json()).error]).toEqual([desde, hasta, 400, "Ventana de relato vacía"]);
    }
    const ordinaria = (await g.reproduccion(id)).intervenciones[0]!;
    const r = await pedir(id, { desdeTick: ordinaria.tick, hastaTick: ordinaria.tick + 1, modo: "buffer", idioma: "es", intervencion: ordinaria.id });
    expect([r.status, (await r.json()).error]).toEqual([400, "Ventana de intervención inválida"]);
    expect((await pedir(id, { desdeTick: 0, hastaTick: -1, modo: "buffer", idioma: "es" })).status).toBe(400);
    // v1.1 § 11 · Nunca en el diario: ningún mensaje publicado lleva una pieza de la previa.
    const diario = readFileSync(join(directorio, `${id}.ndjson`), "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l) as { publicacion: { tipo: string; intervencion?: IntervencionArena } });
    expect(diario.some(m => m.publicacion.tipo === "intervencion")).toBe(true);
    expect(diario.filter(m => m.publicacion.tipo === "intervencion" && (m.publicacion.intervencion!.id.startsWith("previa:") || m.publicacion.intervencion!.forma === "previa"))).toEqual([]);
  }, 60_000);

  it("rechazoCuotaVoz con clase previa: se agota en bolsaSpeech y no altera al narrador, el cierre ni los invitados", () => {
    const B = PREVIA_ARENA.bolsaSpeech, P = PRESUPUESTO_AUDIO_ENCUENTRO, I = MESA_ARENA.dialogo.bolsaSpeechInvitados;
    type Reserva = { tipo: string; caracteres: number; clase: "narrador" | "invitado" | "previa" | "cierre" };
    const llenar = (r: Reserva[], clase: Reserva["clase"], n: number, c: number) => { for (let k = 0; k < n; k++) if (!rechazoCuotaVoz(r, c, clase)) r.push({ tipo: "audio", caracteres: c, clase }); return r; };
    const conPrevia = llenar([], "previa", B.solicitudes, Math.floor(B.caracteres / B.solicitudes));
    expect(conPrevia).toHaveLength(B.solicitudes);
    expect(rechazoCuotaVoz(conPrevia, 1, "previa")).toBe("Bolsa de voz de la previa agotada");
    expect(rechazoCuotaVoz([], B.caracteres + 1, "previa")).toBe("Bolsa de voz de la previa agotada");
    // Con la previa llena, narrador, cierre e invitados admiten exactamente lo mismo que sin ella.
    const admitidos = (base: Reserva[]) => {
      const r = [...base];
      const narrador = llenar(r, "narrador", P.solicitudes, 250).filter(x => x.clase === "narrador").length;
      const invitados = llenar(r, "invitado", I.solicitudes + 2, Math.floor(I.caracteres / I.solicitudes)).filter(x => x.clase === "invitado").length;
      return { narrador, invitados, cierre: rechazoCuotaVoz(r, 335, "cierre") };
    };
    expect(admitidos(conPrevia)).toEqual(admitidos([]));
    // Y al revés: narrador e invitados llenos no quitan nada a la previa.
    const lleno = llenar(llenar([], "narrador", P.solicitudes, 250), "invitado", I.solicitudes, Math.floor(I.caracteres / I.solicitudes));
    expect(llenar(lleno, "previa", B.solicitudes + 1, Math.floor(B.caracteres / B.solicitudes)).filter(x => x.clase === "previa")).toHaveLength(B.solicitudes);
  });

  it("v1.1 § 9 · suficiencia: fixtures, 60 semillas y nombres máximos, ES y EN, catálogo completo y degradado: las 12 síntesis caben en bolsaSpeech", () => {
    const B = PREVIA_ARENA.bolsaSpeech;
    const leerPublico = (n: string) => JSON.parse(readFileSync(`public/experimentos/${n}`, "utf8")) as RegistroArena;
    const largo = structuredClone(registro);
    const persona = (p: string) => { const b = `${p} & <Lía> "Q" 'O' `; return b + "Z".repeat(80 - b.length); };
    largo.config.partido.local.nombre = ("Club Atlético " + "Ñ".repeat(100)).slice(0, 100); largo.config.partido.visita.nombre = ("Unión Deportiva " + "Á".repeat(100)).slice(0, 100);
    for (const lado of ["local", "visita"] as const) { largo.inicial.jugadores.find(j => j.lado === lado && j.capitan)!.nombre = persona("Capitana"); largo.config.entrenadores![lado].nombre = persona("Técnica"); }
    largo.inicial.arbitro!.nombre = persona("Árbitra");
    const semillas = Array.from({ length: 60 }, (_, i) => { const config = crearConfigArena({ seed: 1000 + i * 7919, duracionS: 60 }), inicial = crearEstadoArena(config); return { version: config.version!, config, inicial, rondas: [], eventos: [], fotogramas: [inicial], final: inicial } as RegistroArena; });
    const registros = [registro, leerPublico("arena-llm-v1.json"), leerPublico("arena-llm-v3.json"), leerPublico("arena-duelo-v3.json"), largo, ...semillas];
    let maximo = 0;
    for (const r of registros) for (const degradacion of ["completo", "sin-estadista", "solo-narrador"] as const) {
      let caracteres = 0, solicitudes = 0;
      for (const idioma of ["es", "en"] as const) {
        const a = asignarVoces(idioma);
        const catalogo = degradacion === "completo" ? null : new Set(degradacion === "sin-estadista" ? [a.narrador.voz, a.comentarista.voz] : [a.narrador.voz]);
        const voces = vocesDe(asignarVoces(idioma, catalogo));
        for (const i of previaPartido(r)) for (const variante of ["completa", "breve"] as const) {
          caracteres += prepararVoz(relatoIntervencion(i, r.config.partido.seed, idioma, variante).fragmentos, idioma, voces).caracteresPresupuestados; solicitudes++;
        }
      }
      maximo = Math.max(maximo, caracteres);
      expect(solicitudes).toBeLessThanOrEqual(B.solicitudes);
      expect(caracteres, `${r.config.partido.seed} ${degradacion}`).toBeLessThanOrEqual(B.caracteres);
    }
    expect(maximo).toBeGreaterThan(0);
  });

  /** Recorrido del consumidor (como el del 048) con o sin las 12 síntesis de la previa al principio. */
  const recorrido = async (segundos: number, idiomas: readonly ("es" | "en")[], conPrevia: boolean) => {
    const directorio = await entorno();
    const catalogo: ModeloConfigurado[] = [{ publico: { id: "p", nombre: "P", controlador: "p" }, crear: () => llmDe(async (_s, m) => JSON.stringify(planProgramado(JSON.parse(m[0]!.contenido)))) }];
    const g = new GestorSesiones({ directorio, ritmoMsPorSegundo: 0, catalogo: () => catalogo, narrador: () => fielLlm() }); compartido.__cronistaSesiones = g;
    const { id } = await g.crear({ seed: 42, segundos, local: "auto", visita: "auto", seleccion: { modo: "manual", local: "p", visita: "p" }, presentacion: "buffer" });
    await g.esperarFinal(id); speechSimulado();
    const r = await g.reproduccion(id), fin = r.registro.final.tick;
    type Paso = { tick: number; orden: number; clave: string; tipo: "narrador" | "invitado" | "cierre" | "previa"; cuerpo: object };
    const plan: Paso[] = [];
    for (const idioma of idiomas) {
      plan.push({ tick: 0, orden: 0, clave: `${idioma}:entrada`, tipo: "narrador", cuerpo: { desdeTick: 0, hastaTick: Math.min(50, fin), modo: "buffer", idioma, entradaTick: 0 } });
      if (conPrevia) for (const i of previaPartido(r.registro)) for (const variante of ["completa", "breve"] as const) plan.push({ tick: 0, orden: 0.5, clave: `${idioma}:${i.id}:${variante}`, tipo: "previa", cuerpo: pieza(i.id, idioma, variante) });
      for (let desde = 0; desde < fin; desde += 50) plan.push({ tick: desde, orden: 1, clave: `${idioma}:${desde}`, tipo: "narrador", cuerpo: { desdeTick: desde, hastaTick: Math.min(desde + 50, fin), modo: "buffer", idioma } });
      for (const i of r.intervenciones) for (const variante of ["breve", "completa"] as const) if (variante === "completa" || i.turnosBreve)
        plan.push({ tick: i.tick, orden: 2, clave: `${idioma}:${i.id}:${variante}`, tipo: "invitado", cuerpo: { desdeTick: i.tick, hastaTick: i.tick, modo: "buffer", idioma, intervencion: i.id, variante } });
      plan.push({ tick: fin + 1, orden: 3, clave: `${idioma}:cierre`, tipo: "cierre", cuerpo: { desdeTick: Math.floor((fin - 1) / 50) * 50, hastaTick: fin, modo: "buffer", idioma, cierre: true } });
    }
    plan.sort((a, b) => a.tick - b.tick || a.orden - b.orden);
    const estado = new Map<string, number>();
    for (const p of plan) estado.set(p.clave, (await pedir(id, p.cuerpo)).status);
    const de = (tipo: Paso["tipo"]) => plan.filter(p => p.tipo === tipo).map(p => [p.clave, estado.get(p.clave)] as const);
    return { narrador: de("narrador"), invitados: de("invitado"), cierres: de("cierre"), previa: de("previa") };
  };
  const recorridos = [[60, ["es"]], [60, ["es", "en"]], [120, ["es"]], [120, ["es", "en"]], [180, ["es"]], [180, ["es", "en"]]] as const;
  for (const [segundos, idiomas] of recorridos) it(`v1.1 § 9 · aislamiento ${segundos} s ${idiomas.join("+")}: narrador, cierres e invitados idénticos con y sin previa; la previa entera cabe en su bolsa`, async () => {
    const sin = await recorrido(segundos, idiomas, false), con = await recorrido(segundos, idiomas, true);
    expect(con.narrador).toEqual(sin.narrador);
    expect(con.cierres).toEqual(sin.cierres);
    expect(con.invitados).toEqual(sin.invitados);
    expect(con.previa).toHaveLength(PREVIA_ARENA.piezas.length * 2 * idiomas.length);
    expect(con.previa.filter(([, s]) => s !== 200)).toEqual([]);
  }, 120_000);
});
