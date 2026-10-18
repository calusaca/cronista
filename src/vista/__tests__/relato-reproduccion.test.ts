import { describe, expect, it } from "vitest";
import type { MicroEvento } from "../../sim/micro";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Partido } from "../../sim/tipos";
import type { LenguaXg } from "../../ui/textos";
import { accionesCompletas, type AccionCompleta } from "../partido-completo";
import { construirRelato, exportarRelato, frasesDeJugada, introduccionFormaciones, type JugadaRelatada } from "../relato";
import { cuadrosTacticos } from "../tactica";
import { duracionIlustrativa, interpolarCuadro } from "../reproduccion";

const p = simular(configDeSemilla(246));
const a = p.config.local.jugadores[1]!.nombre;
const b = p.config.local.jugadores[2]!.nombre;
const c = p.config.local.jugadores[3]!.nombre;

function contexto(eventos: Partial<MicroEvento>[], partido = p) {
  const filas: AccionCompleta[] = eventos.map((e, i) => {
    const evento: MicroEvento = { id: `m${String(i + 1).padStart(4, "0")}`, tipo: "pase", minuto: 1, equipo: "local", jugador: a, receptor: b, completado: true, distanciaM: 12, canal: "centro", zona: "defensa", posesion: 1, ancla: p.eventos[1]!.id, ...e };
    return { id: evento.id, minuto: evento.minuto, equipo: evento.equipo, periodo: 1, marcador: { local: 0, visita: 0 }, registro: { capa: "micro", evento } };
  });
  const jugada: JugadaRelatada = { id: "prueba", equipo: "local", periodo: 1, desde: 1, hasta: 1, acciones: filas };
  const cuadros = cuadrosTacticos(partido, filas);
  return { filas, jugada, cuadros, narrar: (lengua: LenguaXg) => frasesDeJugada(partido, jugada, cuadros, lengua, "aficionado").map(f => f.texto) };
}

describe("031 · continuidad narrativa con evidencia", () => {
  it("enlaza la recepción únicamente con el receptor del pase completado", () => {
    const ctx = contexto([{}, { jugador: b, receptor: c }]);
    expect(ctx.narrar("es")[1]).toContain("recibe y");
    expect(ctx.narrar("en")[1]).toContain("receives and");
    const otro = contexto([{}, { jugador: c, receptor: a }]);
    expect(otro.narrar("es")[1]).not.toContain("recibe");
  });

  it("un pase fallido no produce una recepción ni una devolución", () => {
    for (const exitoPrev of [false, true]) for (const exitoActual of [false, true]) {
      const ctx = contexto([{ completado: exitoPrev }, { jugador: b, receptor: a, completado: exitoActual }]);
      for (const lengua of ["es", "en"] as const) {
        const texto = ctx.narrar(lengua);
        expect(texto[1]!.includes(lengua === "es" ? "recibe y" : "receives and")).toBe(exitoPrev);
        expect(texto[1]!.includes(lengua === "es" ? "devuelve" : "returns")).toBe(exitoPrev && exitoActual);
        if (!exitoActual) expect(texto[1]).toContain(lengua === "es" ? "no llega" : "does not reach");
      }
    }
  });

  it("no hereda una recepción de otra posesión, otro equipo o un evento que no es pase", () => {
    for (const cambio of [{ posesion: 2 }, { equipo: "visita" as const }]) {
      const ctx = contexto([{}, { jugador: b, receptor: a, ...cambio }]);
      expect(ctx.narrar("es")[1]).not.toMatch(/recibe y|devuelve/);
    }
    expect(contexto([{ tipo: "conduccion" }, { jugador: b }]).narrar("en")[1]).not.toContain("receives");
  });

  it("A→B→A es devolución, sin afirmar pared o primer toque", () => {
    const ctx = contexto([{}, { jugador: b, receptor: a }]);
    for (const l of ["es", "en"] as const) {
      expect(ctx.narrar(l)[1]).toContain(l === "es" ? "devuelve" : "returns");
      expect(ctx.narrar(l).join(" ")).not.toMatch(/pared|primer toque|primera intención|one.touch|one.two/);
    }
  });

  it("presenta nombre y dorsal al principio, y después abrevia únicamente apellidos únicos", () => {
    const ctx = contexto([{}, { jugador: b, receptor: a }]);
    const textos = ctx.narrar("es");
    expect(textos[0]).toContain(`${a} (#${p.config.local.jugadores[1]!.dorsal})`);
    expect(textos[0]).toContain(`${b} (#${p.config.local.jugadores[2]!.dorsal})`);
    expect(textos[1]).not.toContain("#");
    const duplicados = structuredClone(p);
    duplicados.config.local.jugadores[1]!.nombre = "Camilo Pérez";
    duplicados.config.local.jugadores[2]!.nombre = "Juan Pérez";
    const ambiguo = contexto([{ jugador: "Camilo Pérez", receptor: "Juan Pérez" }, { jugador: "Juan Pérez", receptor: "Camilo Pérez" }], duplicados).narrar("es");
    expect(ambiguo[1]).toContain("Juan Pérez recibe");
    expect(ambiguo[1]).toContain("a Camilo Pérez");
  });

  it("la memoria se reinicia en otra jugada y sus prefijos no dependen del futuro", () => {
    const ctx = contexto([{}, { jugador: b, receptor: c }, { jugador: c, receptor: a }]);
    for (const l of ["es", "en"] as const) {
      const entero = ctx.narrar(l);
      expect(frasesDeJugada(p, { ...ctx.jugada, acciones: ctx.filas.slice(0, 2) }, ctx.cuadros, l, "aficionado").map(f => f.texto)).toEqual(entero.slice(0, 2));
      expect(frasesDeJugada(p, { ...ctx.jugada, acciones: ctx.filas.slice(1) }, ctx.cuadros, l, "aficionado")[0]!.texto).toContain(`${b} (#`);
    }
  });

  it("las dos variantes y descargas conservan todos los IDs, orden, metros y fallos", () => {
    const filas = accionesCompletas(p);
    const { jugadas, cuadros } = construirRelato(p, filas);
    const antes = JSON.stringify({ p, filas });
    for (const l of ["es", "en"] as const) for (const estilo of ["fluido", "detallado"] as const) {
      const frases = jugadas.flatMap(j => frasesDeJugada(p, j, cuadros, l, "aficionado", estilo));
      expect(frases.map(f => f.accion.id)).toEqual(filas.map(f => f.id));
      expect([...exportarRelato(p, jugadas, cuadros, l, "aficionado", estilo).matchAll(/^\[([^\]]+)\]/gm)].map(m => m[1])).toEqual(filas.map(f => f.id));
      for (const f of frases) {
        expect(f.texto).not.toMatch(/undefined|NaN/);
        if (f.accion.registro.capa === "micro") {
          const e = f.accion.registro.evento;
          if (e.distanciaM !== undefined) expect(f.texto).toContain(`${e.distanciaM} ${l === "es" ? "metros" : "metres"}`);
          if (e.tipo === "pase" && !e.completado) expect(f.texto).toContain(l === "es" ? "no llega" : "does not reach");
        }
      }
    }
    expect(JSON.stringify({ p, filas })).toBe(antes);
  });

  it("el estilo fluido elimina confirmaciones redundantes y reduce repetición sin suprimir acciones", () => {
    const { jugadas, cuadros } = construirRelato(p, accionesCompletas(p));
    for (const l of ["es", "en"] as const) {
      const fluido = jugadas.flatMap(j => frasesDeJugada(p, j, cuadros, l, "aficionado")).map(f => f.texto).join(" ");
      const detallado = jugadas.flatMap(j => frasesDeJugada(p, j, cuadros, l, "aficionado", "detallado")).map(f => f.texto).join(" ");
      expect(fluido.length).toBeLessThan(detallado.length);
      expect(fluido).not.toContain(l === "es" ? "El balón llega a su compañero" : "The ball reaches the teammate");
    }
  });

  it("la introducción usa equipos, porteros y esquemas iniciales registrados", () => {
    for (const l of ["es", "en"] as const) {
      const texto = introduccionFormaciones(p, l);
      for (const lado of ["local", "visita"] as const) {
        expect(texto).toContain(p.config[lado].nombre);
        expect(texto).toContain(p.config[lado].jugadores[0]!.nombre);
      }
      expect(texto.match(/4-3-3/g)).toHaveLength(2);
      expect(texto).not.toMatch(/4-2-4|lateral invertido/);
    }
  });
});

describe("031 · reproducción de la misma geometría", () => {
  const ctx = contexto([{ tipo: "conduccion", distanciaM: 15 }, { jugador: b, receptor: c, completado: false }]);
  it("extremos exactos, identidad y dorsales estables, con movimiento de actor y balón", () => {
    const q = ctx.cuadros.get(ctx.filas[0]!.id)!;
    const inicio = interpolarCuadro(q, 0), mitad = interpolarCuadro(q, .5), fin = interpolarCuadro(q, 1);
    expect(inicio.balon).toEqual(q.balon.desde); expect(fin.balon).toEqual(q.balon.hasta);
    expect(mitad.balon.x).toBeCloseTo((inicio.balon.x + fin.balon.x) / 2, 10);
    const actor = (v: typeof inicio) => v.jugadores.find(j => j.nombre === a)!;
    expect(actor(inicio).punto).not.toEqual(actor(fin).punto);
    expect(actor(mitad).punto.x).toBeCloseTo((actor(inicio).punto.x + actor(fin).punto.x) / 2, 10);
    expect(fin.jugadores.map(j => [j.nombre, j.dorsal])).toEqual(q.jugadores.map(j => [j.nombre, j.dorsal]));
  });

  it("no muta cuadros; puntos finitos dentro de la cancha y entrada fuera de rango acotada", () => {
    for (const q of ctx.cuadros.values()) {
      const antes = JSON.stringify(q);
      for (const t of [-1, 0, .1, .5, .9, 1, 2, NaN]) {
        const cuadro = interpolarCuadro(q, t);
        for (const punto of [cuadro.balon, ...cuadro.jugadores.map(j => j.punto)]) {
          expect(punto.x).toBeGreaterThanOrEqual(0); expect(punto.x).toBeLessThanOrEqual(105);
          expect(punto.y).toBeGreaterThanOrEqual(0); expect(punto.y).toBeLessThanOrEqual(68);
        }
      }
      expect(interpolarCuadro(q, -1)).toEqual(interpolarCuadro(q, 0));
      expect(interpolarCuadro(q, 2)).toEqual(interpolarCuadro(q, 1));
      expect(JSON.stringify(q)).toBe(antes);
    }
  });

  it("un pase incompleto no acaba mostrando el balón recibido", () => {
    const q = ctx.cuadros.get(ctx.filas[1]!.id)!;
    expect(interpolarCuadro(q, 0).mostrarBalon).toBe(true);
    expect(interpolarCuadro(q, .5).mostrarBalon).toBe(true);
    expect(interpolarCuadro(q, 1).mostrarBalon).toBe(false);
  });

  it("el ritmo ilustrativo permite leer y está acotado sin fingir duración real", () => {
    expect(duracionIlustrativa("Gol")).toBeGreaterThanOrEqual(1800);
    expect(duracionIlustrativa("palabra ".repeat(500))).toBeLessThanOrEqual(4800);
    expect(duracionIlustrativa("palabra ".repeat(20))).toBeGreaterThan(duracionIlustrativa("Gol"));
  });
});
