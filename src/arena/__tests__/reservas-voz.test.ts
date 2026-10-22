import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { elegirReservaVoz, normalizarVoz, ordenPrimeraVuelta, recordarVoz, type RecuerdoVoz, type ReservaRotable } from "../editorial";
import { leerIndiceReservas, type IndiceReservas } from "../reservas-voz";
import { asignarVoces } from "../voz";
import huellasTranscripts from "../__fixtures__/huellas-transcripts.json";
import { conjuntoHuellas, huellaTramo, normalizarTramo } from "../__fixtures__/huellas-transcripts";
import { RESERVAS_VOZ } from "../../sim/limites";

// Nota del 22 oct (043): la reserva se elige por la rotación de la emisión, no por la memoria de
// escucha (12 recuerdos de 60 s), que dejaba volver como nueva una reserva ya oída.
const catalogo = (n: number): ReservaRotable[] => [...Array.from({ length: n }, (_, i) => ({ texto: `Comentario general ${i}.`, orden: i })), { texto: "Final.", cierre: true, orden: n }];
const ventana = (n: number) => Math.ceil(n * RESERVAS_VOZ.fraccionNoRepeticion);
type Memoria = "vacia" | "narrador" | "reservas";

/** Simula el consumidor: cada reserva que suena entra en la rotación y, salvo con memoria vacía, en la
 * memoria de escucha; con «narrador», doce intervenciones del narrador llenan la memoria entre reservas. */
function emitir(reservas: readonly ReservaRotable[], semilla: number, cuantas: number, memoria: Memoria) {
  let recuerdos: RecuerdoVoz[] = [], tick = 0;
  const oidas: string[] = [];
  for (let k = 0; k < cuantas; k++) {
    if (memoria === "narrador") for (let j = 0; j < 12; j++) { tick += 4; recuerdos = recordarVoz(recuerdos, { tick, texto: `Narrador ${tick}.`, clave: `estado:${tick}`, tema: "posesion", estado: "completa" }); }
    const r = elegirReservaVoz(reservas, oidas, { semilla })!;
    tick += 40;
    if (memoria !== "vacia") recuerdos = recordarVoz(recuerdos, { tick, texto: r.texto, tema: "reserva", estado: "completa" });
    oidas.push(r.texto);
  }
  return { oidas, recuerdos };
}

/** Comprueba la rotación completa antes de repetir y la ventana de no repetición después. */
function comprobarRotacion(reservas: readonly ReservaRotable[], oidas: readonly string[]) {
  const generales = reservas.filter(r => !r.cierre).map(r => r.texto), n = generales.length, w = ventana(n);
  expect(oidas.some(t => reservas.find(r => r.texto === t)?.cierre)).toBe(false);
  expect(new Set(oidas.slice(0, n)).size).toBe(Math.min(n, oidas.length));
  if (oidas.length >= n) expect(new Set(oidas.slice(0, n))).toEqual(new Set(generales));
  for (let k = n; k < oidas.length; k++) {
    const recientes: string[] = [];
    for (let i = k - 1; i >= 0 && recientes.length < w; i--) if (!recientes.includes(oidas[i]!)) recientes.push(oidas[i]!);
    expect(recientes, `reserva ${k}: «${oidas[k]}»`).not.toContain(oidas[k]);
  }
}

describe("043 · nota del 22 oct · rotación de reservas por emisión", () => {
  for (const n of [12, 13, 30, 31]) for (const memoria of ["vacia", "narrador", "reservas"] as const) {
    it(`n = ${n}, memoria de escucha ${memoria}: ninguna se repite antes de sonar todas y después respeta la ventana`, () => {
      const reservas = catalogo(n);
      const { oidas, recuerdos } = emitir(reservas, 7, n * 5, memoria);
      if (memoria !== "vacia") expect(recuerdos).toHaveLength(12); // la memoria está llena y ya olvidó reservas oídas
      if (memoria === "vacia") expect(recuerdos).toEqual([]);
      comprobarRotacion(reservas, oidas);
    });
  }

  it("la memoria de escucha no cambia la elección: vacía o llena, la secuencia es la misma", () => {
    const reservas = catalogo(30);
    const base = emitir(reservas, 123, 100, "vacia").oidas;
    expect(emitir(reservas, 123, 100, "narrador").oidas).toEqual(base);
    expect(emitir(reservas, 123, 100, "reservas").oidas).toEqual(base);
    // Determinista: misma semilla, misma secuencia.
    expect(emitir(reservas, 123, 100, "vacia").oidas).toEqual(base);
  });

  it("caso del 22 oct: tras salir de la memoria de escucha, una reserva oída no vuelve antes de agotar el catálogo", () => {
    for (const n of [12, 30]) {
      const reservas = catalogo(n);
      // Doce intervenciones del narrador entre reservas: la primera reserva ya no está en la memoria.
      const { oidas, recuerdos } = emitir(reservas, 42, n, "narrador");
      expect(recuerdos.some(m => normalizarVoz(m.texto) === normalizarVoz(oidas[0]!))).toBe(false);
      expect(new Set(oidas).size).toBe(n);
    }
  });

  it("la primera vuelta es consecutiva desde un desfase determinista por semilla y dos partidos no empiezan igual", () => {
    const n = 30, reservas = catalogo(n);
    const primeras = new Set<string>();
    for (let semilla = 0; semilla < 40; semilla++) {
      const orden = ordenPrimeraVuelta(n, semilla);
      expect([...orden].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
      for (let k = 1; k < n; k++) expect(orden[k]).toBe((orden[0]! + k) % n);
      const { oidas } = emitir(reservas, semilla, n, "vacia");
      expect(oidas).toEqual(orden.map(i => reservas[i]!.texto));
      primeras.add(oidas[0]!);
    }
    expect(primeras.size).toBeGreaterThan(1);
    // Semillas vecinas no se limitan a desplazar la misma secuencia en una posición.
    expect(ordenPrimeraVuelta(n, 1)[0]).not.toBe((ordenPrimeraVuelta(n, 0)[0]! + 1) % n);
  });

  it("en las vueltas siguientes ninguna reserva queda relegada: todas vuelven a sonar", () => {
    const n = 30, reservas = catalogo(n);
    for (let semilla = 1; semilla <= 5; semilla++) {
      const { oidas } = emitir(reservas, semilla, n * 7, "vacia");
      expect(new Set(oidas.slice(n)), `semilla ${semilla}`).toEqual(new Set(reservas.filter(r => !r.cierre).map(r => r.texto)));
    }
  });

  it("las vueltas siguientes no copian el orden de la primera", () => {
    const n = 30, { oidas } = emitir(catalogo(n), 5, n * 3, "vacia");
    expect(oidas.slice(n, 2 * n)).not.toEqual(oidas.slice(0, n));
  });

  it("el cierre solo suena con el final; sin reservas disponibles no se inventa ninguna", () => {
    const reservas = catalogo(12);
    expect(elegirReservaVoz(reservas, [], { semilla: 3, cierre: true })!.texto).toBe("Final.");
    expect(elegirReservaVoz(reservas.filter(r => !r.cierre), [], { semilla: 3, cierre: true })).toBeUndefined();
    expect(elegirReservaVoz(reservas.filter(r => r.cierre), [], { semilla: 3 })).toBeUndefined();
    expect(elegirReservaVoz([], [], { semilla: 3 })).toBeUndefined();
  });

  it("si falta una reserva siguen las demás; si llega después, suena antes de repetir", () => {
    const completo = catalogo(12), faltante = completo[4]!;
    const parcial = completo.filter(r => r !== faltante);
    const { oidas } = emitir(parcial, 9, 11 + 6, "narrador");
    comprobarRotacion(parcial, oidas);
    expect(oidas).not.toContain(faltante.texto);
    expect(elegirReservaVoz(completo, oidas, { semilla: 9 })!.texto).toBe(faltante.texto);
  });

  it("con una o dos reservas disponibles se mantiene la voz: una se repite, dos alternan", () => {
    const una = catalogo(1);
    expect(emitir(una, 1, 3, "vacia").oidas).toEqual(Array(3).fill(una[0]!.texto));
    const dos = catalogo(2), { oidas } = emitir(dos, 1, 6, "vacia");
    for (let k = 1; k < oidas.length; k++) expect(oidas[k]).not.toBe(oidas[k - 1]);
  });

  it("con el catálogo cargado solo en parte, la primera vuelta sigue el desfase del catálogo completo", () => {
    const n = 30, completo = catalogo(n), semilla = 77, orden = ordenPrimeraVuelta(n, semilla);
    // Faltan también las últimas posiciones: el desfase debe salir del catálogo completo, no de lo cargado.
    const parcial = completo.filter(r => r.cierre || r.orden! % 3 !== 0 && r.orden! < n - 3);
    const oidas: string[] = [];
    for (let k = 0; k < parcial.length - 1; k++) oidas.push(elegirReservaVoz(parcial, oidas, { semilla, total: n })!.texto);
    expect(oidas).toEqual(orden.filter(i => i % 3 !== 0 && i < n - 3).map(i => completo[i]!.texto));
  });
});

const raizReservas = "public/voz-reserva";
const indice = JSON.parse(readFileSync(`${raizReservas}/indice.json`, "utf8")) as IndiceReservas;

describe("043 · nota del 22 oct · catálogo estático de reservas", () => {
  for (const idioma of ["es", "en"] as const) {
    it(`${idioma}: al menos RESERVAS_VOZ.minimoPorIdioma reservas y un cierre, con su MP3 íntegro y la voz del narrador`, () => {
      const { reservas, cierre } = leerIndiceReservas(indice, idioma);
      expect(reservas.length).toBeGreaterThanOrEqual(RESERVAS_VOZ.minimoPorIdioma);
      expect(reservas.length).toBe(indice[idioma === "es" ? "en" : "es"].reservas.length);
      expect(indice.voces[idioma]).toBe(asignarVoces(idioma, null).narrador.voz);
      for (const c of [...indice[idioma].reservas, indice[idioma].cierre]) {
        const bytes = readFileSync(`${raizReservas}/${c.archivo}`);
        expect(statSync(`${raizReservas}/${c.archivo}`).size, c.archivo).toBe(c.bytes);
        expect(createHash("sha256").update(bytes).digest("hex"), c.archivo).toBe(c.sha256);
        // Cabecera de trama MPEG (sincronía de 11 bits) o etiqueta ID3.
        expect(bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0 || bytes.subarray(0, 3).toString() === "ID3", c.archivo).toBe(true);
      }
      expect(cierre.texto).toMatch(idioma === "es" ? /terminado/ : /finished/);
    });
  }

  it("las reservas son generales y neutras: sin cifras, nombres propios ni hechos del partido", () => {
    const prohibidas = {
      es: ["dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "veinte", "cien", "gol", "goles", "marcador", "minuto", "minutos", "tarjeta", "amarilla", "roja", "penal", "penalti", "empate", "resultado", "ventaja"],
      en: ["two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "twenty", "hundred", "goal", "goals", "score", "scoreline", "minute", "minutes", "card", "yellow", "red", "penalty", "draw", "lead", "result"],
    } as const;
    for (const idioma of ["es", "en"] as const) for (const { texto } of indice[idioma].reservas) {
      expect(texto, texto).not.toMatch(/\d/);
      for (const w of normalizarTramo(texto).split(" ")) expect(prohibidas[idioma], `«${w}» en «${texto}»`).not.toContain(w);
      // Mayúscula solo al empezar una oración: ninguna reserva nombra a un jugador o a un equipo.
      for (const [, previo, palabra] of texto.matchAll(/(^|[.:;!?]\s+|\s)(\p{Lu}\p{L}*)/gu)) expect(previo === "" || /[.:;!?]/.test(previo!), `«${palabra}» en «${texto}»`).toBe(true);
    }
  });

  it("ningún tramo de cuatro palabras de una reserva aparece en los transcripts de referencia (huellas)", () => {
    const huellas = conjuntoHuellas(huellasTranscripts.huellas);
    const tramos: string[] = [];
    for (const idioma of ["es", "en"] as const) for (const { texto } of [...indice[idioma].reservas, indice[idioma].cierre]) {
      const palabras = normalizarTramo(texto).split(" ").filter(Boolean);
      for (let k = 0; k + 4 <= palabras.length; k++) tramos.push(palabras.slice(k, k + 4).join(" "));
    }
    expect(tramos.length).toBeGreaterThan(0);
    expect(tramos.filter(t => huellas.has(huellaTramo(t)))).toEqual([]);
    // Control: el detector reconoce un tramo que sí está en el corpus.
    expect(huellas.has(huellaTramo(normalizarTramo("por el sector izquierdo")))).toBe(true);
  });

  it("el índice rechaza rutas fuera del idioma, textos repetidos o un cierre ausente", () => {
    const valido = structuredClone(indice);
    expect(() => leerIndiceReservas(valido, "es")).not.toThrow();
    const roto = (cambiar: (i: IndiceReservas) => void) => { const i = structuredClone(indice); cambiar(i); return () => leerIndiceReservas(i, "es"); };
    expect(roto(i => { i.es.reservas[0]!.archivo = "../secreto.mp3"; })).toThrow();
    expect(roto(i => { i.es.reservas[0]!.archivo = "en/01.mp3"; })).toThrow();
    expect(roto(i => { i.es.reservas[1]!.texto = i.es.reservas[0]!.texto; })).toThrow();
    expect(roto(i => { delete (i.es as Partial<IndiceReservas["es"]>).cierre; })).toThrow();
    expect(roto(i => { (i as { version: number }).version = 2; })).toThrow();
    expect(roto(i => { i.es.reservas = []; })).toThrow();
  });
});
