import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { amenazaConBalon, expresionEvento, varianteVoz, type FragmentoVoz } from "../expresion";
import { cantoGol, construirRelato } from "../relato";
import { CANTO_GOL } from "../../sim/limites";
import { claveAudio, prepararVoz, sintetizarVoz } from "../voz";
import { GestorSesiones } from "../sesiones";
import { POST as relatoHttp } from "../../app/api/arena/sesiones/[id]/relato/route";
import type { EstadoArena, RegistroArena } from "../tipos";

const duelo = JSON.parse(readFileSync("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function carrera(lado: "local" | "visita" = "local", sentido = 1) {
  const registro = structuredClone(duelo), jugador = registro.inicial.jugadores.find(j => j.lado === lado)!;
  registro.eventos = []; registro.rondas = []; registro.config.duracionS = 60;
  registro.fotogramas = Array.from({ length: 21 }, (_, i) => {
    const f = structuredClone(registro.inicial), tick = i * 5;
    f.tick = tick; f.marcador = { local: 0, visita: 0 }; delete f.pausa;
    f.balon.poseedor = jugador.id; f.balon.vuelo = null;
    const j = f.jugadores.find(j => j.id === jugador.id)!;
    const x = 78 + sentido * tick * 0.2;
    j.posicion = { x: lado === "local" ? x : 105 - x, y: 34 };
    j.velocidad = { x: sentido * (lado === "local" ? 2 : -2), y: 0 };
    f.balon.posicion = { ...j.posicion };
    return f;
  });
  registro.inicial = registro.fotogramas[0]!; registro.final = registro.fotogramas.at(-1)!;
  return registro;
}
const frase = (emocion: FragmentoVoz["emocion"], texto = "Una jugada confirmada."): FragmentoVoz => ({ tick: 30, texto, emocion, intensidad: emocion === "jubilo" ? 0.95 : 0.6, variante: 1, fuentes: [], fotogramas: [] });

it("narra las conducciones peligrosas de ambos equipos con estados, sin fabricar eventos", () => {
  for (const lado of ["local", "visita"] as const) {
    const r = carrera(lado), antes = JSON.stringify(r);
    const relato = construirRelato(r, 0, 100, "completo", "es");
    const avances = relato.fragmentos.filter(f => f.emocion === "tension");
    expect(avances.length).toBeGreaterThan(0);
    expect(avances.every(f => f.fuentes.length === 0 && f.fotogramas.length === 2 && f.fotogramas.every(t => t <= f.tick))).toBe(true);
    expect(avances.every((f, i) => !i || f.tick - avances[i - 1]!.tick >= 40)).toBe(true);
    expect(relato.eventosNarrados).toBe(0); expect(r.eventos).toEqual([]);
    expect(JSON.stringify(r)).toBe(antes);
  }
});

it("evita emoción de ataque por correr hacia la portería propia, estar quieto o perder posesión", () => {
  const regreso = carrera("local", -1);
  expect(construirRelato(regreso, 0, 100, "completo", "es").conduccionesNarradas).toBe(0);
  const quieto = carrera();
  for (const f of quieto.fotogramas) { const j = f.jugadores.find(j => j.id === f.balon.poseedor)!; j.velocidad.x = 0; j.posicion.x = 80; }
  expect(construirRelato(quieto, 0, 100, "completo", "es").conduccionesNarradas).toBe(0);
  const alterno = carrera();
  alterno.fotogramas.forEach((f, i) => { if (i % 2) f.balon.poseedor = f.jugadores.find(j => j.lado === "visita")!.id; });
  expect(construirRelato(alterno, 0, 100, "completo", "es").conduccionesNarradas).toBe(0);
});

it("es simétrica la tensión al avanzar hacia cada portería", () => {
  const l = carrera(), v = carrera("visita");
  // Retirar defensores del corredor para comparar solo geometría y velocidad.
  for (const r of [l, v]) for (const j of r.final.jugadores) if (j.id !== r.final.balon.poseedor) j.posicion.y = 0;
  expect(amenazaConBalon(l.final, "local")).toBeCloseTo(amenazaConBalon(v.final, "visita"));
  expect(amenazaConBalon(l.final, "visita")).toBe(0);
});

it("añadir un gol y posiciones futuras no modifica las frases ni su emoción anteriores", () => {
  const original = carrera(), antes = construirRelato(original, 0, 30, "vivo", "es");
  const futuro = structuredClone(original), gol = structuredClone(duelo.eventos.find(e => e.tipo === "gol")!);
  gol.tick = 50; futuro.eventos.push(gol);
  for (const f of futuro.fotogramas) if (f.tick > 30) { f.marcador.local = 9; f.jugadores[0]!.posicion.x = 104; }
  futuro.final = futuro.fotogramas.at(-1)!;
  expect(construirRelato(futuro, 0, 30, "vivo", "es")).toEqual(antes);
  expect(antes.fragmentos.some(f => f.emocion === "jubilo")).toBe(false);
  expect(() => construirRelato({ ...original, final: original.fotogramas.find(f => f.tick === 25)! }, 0, 30, "vivo", "es")).toThrow();
});

it("el gol cambia de interpretación justo al confirmarse y el relato completo conserva todos los eventos", () => {
  const gol = duelo.eventos.find(e => e.tipo === "gol")!, desde = Math.floor((gol.tick - 1) / 100) * 100;
  const relato = construirRelato(duelo, desde, desde + 100, "completo", "es");
  expect(relato.fragmentos.find(f => f.fuentes.includes(gol.id))?.emocion).toBe("jubilo");
  const ids = new Set<string>();
  for (let t = 0; t < 600; t += 100) {
    const s = construirRelato(duelo, t, t + 100, "completo", "en");
    expect(s.eventosNarrados).toBe(s.eventosDisponibles); s.fuentes.forEach(id => ids.add(id));
    expect(s.fragmentos.every(f => f.fotogramas.every(t => t <= f.tick))).toBe(true);
  }
  expect([...ids].sort()).toEqual(duelo.eventos.map(e => e.id).sort());
});

it("la tensión se disipa y un reinicio vuelve al tono sereno", () => {
  const e = structuredClone(duelo.eventos[0]!), estado = structuredClone(duelo.inicial);
  estado.balon.poseedor = null;
  const memoria = { tick: 0, intensidad: 0.85, lado: e.lado };
  expect(expresionEvento({ ...e, tipo: "pase", tick: 5 }, estado, memoria, 60).emocion).toBe("tension");
  expect(expresionEvento({ ...e, tipo: "pase", tick: 80 }, estado, memoria, 60).emocion).toBe("serena");
  expect(expresionEvento({ ...e, tipo: "reinicio", tick: 5 }, estado, memoria, 60).emocion).toBe("serena");
});

it("la variación depende de semilla y acción; repetir la grabación no cambia su locución", () => {
  expect(construirRelato(duelo, 0, 100, "completo", "es")).toEqual(construirRelato(duelo, 0, 100, "completo", "es"));
  expect(new Set(Array.from({ length: 20 }, (_, seed) => varianteVoz(seed, "a1"))).size).toBeGreaterThanOrEqual(3);
});

it("el SSML cambia por frase, escapa texto y solo utiliza estilos comprobados", () => {
  const es = prepararVoz([frase("serena", '<voice name="otro"> & texto'), frase("tension"), frase("jubilo")], "es");
  expect(es.voz).toBe("es-MX-JorgeNeural"); expect(es.ssml).toContain("&lt;voice");
  expect(es.ssml).toContain('style="cheerful"'); expect(es.ssml).not.toContain('style="excited"');
  expect(es.ssml.match(/<s>/g)).toHaveLength(3); expect(es.caracteresPresupuestados).toBeGreaterThan(es.texto.length);
  expect(prepararVoz([frase("jubilo")], "en").ssml).toContain('style="excited"');
  vi.stubEnv("ARENA_VOZ_ES", "es-MX-DaliaNeural");
  expect(prepararVoz([frase("jubilo")], "es").ssml).not.toContain("<mstts:express-as");
  vi.stubEnv("ARENA_VOZ_ES", '<voice name="invalida">'); expect(() => prepararVoz([frase("serena")], "es")).toThrow();
});

it("cambiar emoción, voz o tick invalida la caché de audio neutro", () => {
  const neutra = prepararVoz([frase("serena")], "es"), alegre = prepararVoz([frase("jubilo")], "es");
  expect(claveAudio(neutra, 30)).not.toBe(claveAudio(alegre, 30));
  expect(claveAudio(alegre, 30)).not.toBe(claveAudio(alegre, 60));
  expect(claveAudio(alegre, 30)).toBe(claveAudio(prepararVoz([frase("jubilo")], "es"), 30));
  vi.stubEnv("ARENA_VOZ_ES", "es-MX-DaliaNeural");
  expect(claveAudio(alegre, 30)).not.toBe(claveAudio(prepararVoz([frase("jubilo")], "es"), 30));
});

it("un tramo expresivo hace una sola llamada y conserva sus metadatos de consumo", async () => {
  vi.stubEnv("AZURE_SPEECH_ENDPOINT", "https://ejemplo.cognitiveservices.azure.com"); vi.stubEnv("AZURE_SPEECH_KEY", "prueba");
  const preparada = prepararVoz([frase("serena"), frase("jubilo")], "es");
  const transporte = vi.fn<typeof fetch>(async (_url, opciones) => { expect(opciones?.body).toBe(preparada.ssml); return new Response(new Uint8Array([1, 2, 3])); });
  const audio = await sintetizarVoz(preparada, 30, { fetch: transporte });
  expect(transporte).toHaveBeenCalledTimes(1); expect(audio.caracteresPresupuestados).toBe(preparada.ssml.length); expect(audio.version).toBe("voz-expresiva-v1");
});

it("HTTP reserva texto y marcas antes de Speech y reutiliza el audio sin otra llamada", async () => {
  const directorio = await mkdtemp(join(tmpdir(), "cronista-voz-"));
  const compartido = globalThis as typeof globalThis & { __cronistaSesiones?: GestorSesiones };
  const previo = compartido.__cronistaSesiones;
  try {
    vi.stubEnv("ARENA_BLOB_ENDPOINT", ""); vi.stubEnv("ARENA_VOZ", "1");
    vi.stubEnv("AZURE_SPEECH_ENDPOINT", "https://ejemplo.cognitiveservices.azure.com"); vi.stubEnv("AZURE_SPEECH_KEY", "prueba");
    const g = new GestorSesiones({ directorio }); compartido.__cronistaSesiones = g;
    const { id } = await g.registrarGrabacion(duelo, "voz-prueba"), extra = vi.spyOn(g, "extra");
    const transporte = vi.fn<typeof fetch>(async () => new Response(new Uint8Array([1, 2, 3]))); vi.stubGlobal("fetch", transporte);
    const pedir = () => relatoHttp(new Request("http://localhost/relato", { method: "POST", body: JSON.stringify({ desdeTick: 0, hastaTick: 30, modo: "vivo", idioma: "es" }) }), { params: Promise.resolve({ id }) });
    const primera = await pedir(), datos = await primera.json();
    expect(primera.status).toBe(200); expect(datos.hastaTick).toBe(30);
    expect(extra.mock.calls[0]![4]).toBe(datos.audio.caracteresPresupuestados);
    expect(datos.audio.caracteresPresupuestados).toBeGreaterThan(datos.audio.caracteres);
    expect((await pedir()).status).toBe(200); expect(transporte).toHaveBeenCalledTimes(1);
  } finally { compartido.__cronistaSesiones = previo; await rm(directorio, { recursive: true, force: true }); }
});

// Brief 050 v1.1 · Canto de gol: un solo <s>, tres tramos, cifras y estilos de CANTO_GOL.
describe("050 · prepararVoz con canto", () => {
  const gol = duelo.eventos.find(e => e.tipo === "gol")!;
  const fragmentoCanto = (idioma: "es" | "en", variante = 0, registro = duelo, evento = gol): FragmentoVoz => {
    const c = cantoGol(evento, registro, idioma, variante)!;
    return { tick: evento.tick, texto: c.texto, emocion: "jubilo", intensidad: 0.92, variante, fuentes: [evento.id], fotogramas: [], canto: { tramos: c.tramos } };
  };
  const porciento = (n: number) => `${n >= 0 ? "+" : ""}${n}%`;
  const prosodia = (tipo: keyof typeof CANTO_GOL.tramos) => { const p = CANTO_GOL.tramos[tipo]; return `<prosody rate="${porciento(p.rate)}" pitch="${porciento(p.pitch)}" volume="${porciento(p.volume)}">`; };
  const expresiones = (ssml: string) => [...ssml.matchAll(/<mstts:express-as style="([^"]+)" styledegree="([^"]+)">/g)].map(m => ({ estilo: m[1]!, grado: m[2]! }));

  it("M5/M6 · ES (Jorge): un <s>, tres express-as cheerful con la prosodia y el styledegree de CANTO_GOL y un solo break final", () => {
    const f = fragmentoCanto("es"), { ssml, texto } = prepararVoz([f], "es");
    expect(texto).toBe(f.texto);
    expect(ssml.match(/<s>/g)).toHaveLength(1); expect(ssml.match(/<\/s>/g)).toHaveLength(1);
    expect(ssml.match(/<break /g)).toHaveLength(1);
    expect(ssml).toContain(`<break time="${CANTO_GOL.pausaFinalMs}ms"/></s>`);
    const tipos = f.canto!.tramos.map(t => t.tipo);
    expect(expresiones(ssml)).toEqual(tipos.map(t => ({ estilo: CANTO_GOL.estilos.es[t], grado: CANTO_GOL.tramos[t].grado.toFixed(2) })));
    expect(expresiones(ssml).every(x => x.estilo === "cheerful")).toBe(true);
    for (const t of f.canto!.tramos) expect(ssml).toContain(`${prosodia(t.tipo)}${t.texto.replace(/'/g, "&apos;")}</prosody>`);
    // Sin <s> ni <break> entre tramos: el cierre de un express-as va directo al siguiente.
    expect(ssml).toMatch(/<\/prosody><\/mstts:express-as><mstts:express-as/);
  });

  it("EN (Jenny): shouting en el grito y excited en goleador y hechos", () => {
    const { ssml, voz } = prepararVoz([fragmentoCanto("en", 1)], "en");
    expect(voz).toBe("en-US-JennyNeural");
    expect(expresiones(ssml).map(x => x.estilo)).toEqual(["shouting", "excited", "excited"]);
    expect(expresiones(ssml).map(x => x.estilo)).toEqual((["grito", "goleador", "hechos"] as const).map(t => CANTO_GOL.estilos.en[t]));
    expect(ssml.match(/<s>/g)).toHaveLength(1);
  });

  it("voz efectiva: Guy (catálogo real: shouting y excited) canta como Jenny; Jorge, cheerful en todo; una voz sin estilos solo lleva <prosody>", () => {
    // v1.1 (5): catalogo-estilos.json lista shouting y excited para en-US-GuyNeural.
    vi.stubEnv("ARENA_VOZ_EN", "en-US-GuyNeural");
    const guy = prepararVoz([fragmentoCanto("en")], "en");
    expect(guy.voz).toBe("en-US-GuyNeural");
    expect(expresiones(guy.ssml).map(x => x.estilo)).toEqual(["shouting", "excited", "excited"]);
    expect(guy.ssml).toContain(`<s><mstts:express-as style="shouting" styledegree="${CANTO_GOL.tramos.grito.grado.toFixed(2)}">${prosodia("grito")}`);
    expect(expresiones(prepararVoz([fragmentoCanto("es")], "es").ssml).map(x => x.estilo)).toEqual(["cheerful", "cheerful", "cheerful"]);
    vi.stubEnv("ARENA_VOZ_ES", "es-MX-DaliaNeural");
    const dalia = prepararVoz([fragmentoCanto("es")], "es");
    expect(dalia.ssml).not.toContain("<mstts:express-as");
    expect(dalia.ssml.match(/<prosody /g)).toHaveLength(3); expect(dalia.ssml.match(/<s>/g)).toHaveLength(1);
  });

  it("autogol: dos tramos (autogol y hechos) con su prosodia", () => {
    const r = structuredClone(duelo), e = r.eventos.find(e => e.tipo === "gol")!;
    e.autogol = true; e.jugador = r.inicial.jugadores.find(j => j.lado !== e.lado && j.puesto !== "POR")!.id;
    const { ssml } = prepararVoz([fragmentoCanto("es", 0, r, e)], "es");
    expect(expresiones(ssml)).toEqual((["autogol", "hechos"] as const).map(t => ({ estilo: CANTO_GOL.estilos.es[t], grado: CANTO_GOL.tramos[t].grado.toFixed(2) })));
    expect(ssml).toContain(prosodia("autogol")); expect(ssml).not.toContain(prosodia("grito"));
  });

  it("lanza con rol de invitado, con emoción distinta de jubilo o con texto distinto de la unión", () => {
    const f = fragmentoCanto("es");
    expect(() => prepararVoz([{ ...f, rol: "comentarista" }], "es")).toThrow("Interpretación de voz inválida");
    expect(() => prepararVoz([{ ...f, emocion: "emocion" }], "es")).toThrow("Interpretación de voz inválida");
    expect(() => prepararVoz([{ ...f, texto: f.texto + " Extra." }], "es")).toThrow("Interpretación de voz inválida");
    expect(() => prepararVoz([{ ...f, canto: { tramos: [] } }], "es")).toThrow("Interpretación de voz inválida");
    expect(() => prepararVoz([{ ...f, rol: "narrador" }], "es")).not.toThrow();
  });

  it("claveAudio estable por canto, idioma y voz; otra variante cambia la clave", () => {
    const a = prepararVoz([fragmentoCanto("es", 0)], "es");
    expect(claveAudio(a, gol.tick)).toBe(claveAudio(prepararVoz([fragmentoCanto("es", 0)], "es"), gol.tick));
    expect(claveAudio(a, gol.tick)).not.toBe(claveAudio(prepararVoz([fragmentoCanto("es", 1)], "es"), gol.tick));
    expect(claveAudio(a, gol.tick)).not.toBe(claveAudio(prepararVoz([fragmentoCanto("en", 0)], "en"), gol.tick));
  });

  it("la ruta de emisión sintetiza el canto del gol del duelo con canto en el fragmento", () => {
    const desde = Math.floor((gol.tick - 1) / 50) * 50;
    for (const idioma of ["es", "en"] as const) {
      const relato = construirRelato(duelo, desde, desde + 50, "buffer", idioma), { ssml } = prepararVoz(relato.fragmentos, idioma);
      expect(relato.fragmentos[0]!.canto).toBeDefined();
      expect(ssml.match(/<s>/g)).toHaveLength(1);
      expect(expresiones(ssml)).toHaveLength(3);
    }
  });
});

// Brief 050 v1.1 (10b) · Coste de Speech del canto frente al control anterior (la etiqueta «¡Gol de X!» /
// «Goal by X!» del 049, variante 0, con la interpretación `jubilo` sin canto), por gol de v3/v4 en ES y EN.
// La banda no se escribe a mano: el delta de cada gol se deriva de las constantes (marcas de tres tramos
// de CANTO_GOL frente a las marcas del control medidas en su propio SSML) más la diferencia de texto.
describe("050 · coste de SSML del canto (integración)", () => {
  const leerF = (v: string) => JSON.parse(readFileSync(`src/arena/__fixtures__/arena-reinicios-${v}.json`, "utf8")) as RegistroArena;
  const esc = (t: string) => t.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
  const porciento = (n: number) => `${n >= 0 ? "+" : ""}${n}%`;
  /** Marcas del canto según CANTO_GOL para la voz efectiva (todas las voces del narrador por defecto admiten sus estilos). */
  const marcasCanto = (idioma: "es" | "en", tipos: (keyof typeof CANTO_GOL.tramos)[]) => "<s>".length + tipos.reduce((n, t) => {
    const p = CANTO_GOL.tramos[t];
    return n + `<mstts:express-as style="${CANTO_GOL.estilos[idioma][t]}" styledegree="${p.grado.toFixed(2)}">`.length + `<prosody rate="${porciento(p.rate)}" pitch="${porciento(p.pitch)}" volume="${porciento(p.volume)}">`.length + "</prosody></mstts:express-as>".length;
  }, 0) + `<break time="${CANTO_GOL.pausaFinalMs}ms"/></s>`.length;

  it("delta = marcas(CANTO_GOL) − marcas(control) + Δtexto para cada gol de v3/v4 en ES y EN; siempre positivo y sin solicitudes nuevas", () => {
    const deltas: number[] = [];
    for (const r of [leerF("v3"), leerF("v4")]) for (const e of r.eventos.filter(e => e.tipo === "gol")) for (const idioma of ["es", "en"] as const) {
      const desde = Math.floor((e.tick - 1) / 50) * 50, relato = construirRelato(r, desde, Math.min(desde + 50, r.final.tick), "buffer", idioma);
      const base = relato.fragmentos[0]!, nombre = [...r.inicial.jugadores, ...r.inicial.banco ?? []].find(j => j.id === e.jugador)!.nombre;
      expect(base.canto).toBeDefined();
      for (let v = 0; v < 4; v++) {
      const c = cantoGol(e, r, idioma, v)!, f: FragmentoVoz = { ...base, texto: c.texto, canto: { tramos: c.tramos } };
      const canto = prepararVoz([f], idioma);
      const textoControl = idioma === "es" ? `¡Gol de ${nombre}!` : `Goal by ${nombre}!`;
      const control = prepararVoz([{ ...f, texto: textoControl, canto: undefined }], idioma);
      expect(canto.caracteresPresupuestados).toBe(canto.ssml.length);
      // Marcas del control medidas en su SSML: el contenido de <voice> menos su texto.
      const interiorControl = control.ssml.match(/<voice name="[^"]+">(.*)<\/voice>/)![1]!;
      const marcasControl = interiorControl.length - esc(textoControl).length;
      const esperado = marcasCanto(idioma, f.canto!.tramos.map(t => t.tipo)) - marcasControl + f.canto!.tramos.reduce((n, t) => n + esc(t.texto).length, 0) - esc(textoControl).length; // los tramos van juntos, sin el espacio de `texto`
      const delta = canto.caracteresPresupuestados - control.caracteresPresupuestados;
      expect(delta, `${e.id} ${idioma}`).toBe(esperado);
      expect(delta).toBeGreaterThan(0);
      deltas.push(delta);
      }
    }
    expect(deltas).toHaveLength([leerF("v3"), leerF("v4")].flatMap(r => r.eventos.filter(e => e.tipo === "gol")).length * 2 * 4);
    // Un solo fragmento y un solo documento por gol: el canto no añade solicitudes.
    console.log(`050 · delta de SSML por gol (v3/v4, ES y EN): +${Math.min(...deltas)}…+${Math.max(...deltas)} caracteres`);
  });
});
