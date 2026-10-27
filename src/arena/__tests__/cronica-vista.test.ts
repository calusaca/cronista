// Brief 064 § 8.1.9 · Funciones puras de la página de crónica de arena: la cadena oración → hechos → eventos con ids
// de arena (`a12`), su inversa, la línea de tiempo (todo evento citado aunque sea un pase normal), el segundo del salto
// (con `antesDelEventoS` y 0 como cota), el enlace a la repetición (torneo y huella, ES/EN) y la visibilidad del botón
// (§ 4.10). Las cifras salen de `src/sim/limites.ts`; ninguna se repite a mano.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { borradorActa } from "../../cadena/acta";
import { ARENA, CRONICA_ARENA } from "../../sim/limites";
import { registroCompleto, seleccionCronicaArena } from "../cronica-hechos";
import { claveFuente, enlaceRepeticionCronica, eventosDeOracionArena, lineaTiempoCronica, mostrarBotonCronica, oracionesDeEventoArena, relojArena, segundoDeSalto } from "../cronica-vista";
import type { EventoArena, RegistroArena } from "../tipos";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (f: string) => JSON.parse(readFileSync(join(RAIZ, f), "utf8")) as RegistroArena;
const HUELLA = "0123456789abcdef0123456789abcdef01234567";

describe("064 · eventosDeOracionArena / oracionesDeEventoArena", () => {
  const hechos = [
    { id: "c01", eventos: ["a12", "a3"] },
    { id: "c02", eventos: ["a3", "a40", "e7", "m0042"] },
    { id: "c03", eventos: [] as string[] },
  ];
  const cronica = { oraciones: [
    { hecho: "c01", apoyo: ["c02"], texto_es: "", texto_en: "" },
    { hecho: "c02", texto_es: "", texto_en: "" },
    { hecho: "c03", texto_es: "", texto_en: "" },
  ] };

  it("acepta ids de arena, deduplica y ordena por su número (orden del registro); ignora ids que no son de arena", () => {
    expect(eventosDeOracionArena(cronica, hechos, 0)).toEqual(["a3", "a12", "a40"]);
    expect(eventosDeOracionArena(cronica, hechos, 1)).toEqual(["a3", "a40"]);
    expect(eventosDeOracionArena(cronica, hechos, 2)).toEqual([]);
    expect(eventosDeOracionArena(cronica, hechos, 9)).toEqual([]);
  });

  it("la inversa devuelve las oraciones que citan un evento", () => {
    expect(oracionesDeEventoArena(cronica, hechos, "a3")).toEqual([0, 1]);
    expect(oracionesDeEventoArena(cronica, hechos, "a12")).toEqual([0]);
    expect(oracionesDeEventoArena(cronica, hechos, "a99")).toEqual([]);
  });

  it("con un registro real (v8 y v11) toda oración del acta con eventos los resuelve y están en el registro, en su orden", () => {
    for (const f of ["src/arena/__fixtures__/arena-reinicios-v8.json", "src/arena/__fixtures__/arena-reinicios-v11.json"]) {
      const r = leer(f);
      const hs = seleccionCronicaArena(r).hechos.map((h) => h.hecho);
      const acta = borradorActa(hs);
      const orden = new Map(r.eventos.map((e, i) => [e.id, i] as const));
      let conEventos = 0;
      acta.oraciones.forEach((_, i) => {
        const ids = eventosDeOracionArena(acta, hs, i);
        if (ids.length > 0) conEventos++;
        for (const id of ids) expect(orden.has(id), `${f} ${id}`).toBe(true);
        expect(ids.map((id) => orden.get(id)!)).toEqual([...ids.map((id) => orden.get(id)!)].sort((a, b) => a - b));
      });
      expect(conEventos, f).toBeGreaterThan(0);
    }
  });
});

describe("064 · segundoDeSalto y relojArena", () => {
  const tickDe = (s: number) => Math.round(s / ARENA.pasoS);
  it("resta antesDelEventoS al primer evento y no baja de 0; sin eventos es null", () => {
    expect(segundoDeSalto([])).toBeNull();
    expect(segundoDeSalto([{ tick: tickDe(31) }])).toBe(31 - CRONICA_ARENA.antesDelEventoS);
    expect(segundoDeSalto([{ tick: tickDe(40) }, { tick: tickDe(31) }])).toBe(31 - CRONICA_ARENA.antesDelEventoS);
    expect(segundoDeSalto([{ tick: tickDe(CRONICA_ARENA.antesDelEventoS) - 1 }])).toBe(0);
    expect(segundoDeSalto([{ tick: 0 }])).toBe(0);
  });
  it("relojArena da m:ss", () => {
    expect(relojArena(0)).toBe("0:00");
    expect(relojArena(31)).toBe("0:31");
    expect(relojArena(125)).toBe("2:05");
  });
});

describe("064 · lineaTiempoCronica", () => {
  it("incluye los tipos de la lista, los pases largos y TODO evento citado aunque sea un pase normal", () => {
    const r = leer("src/arena/__fixtures__/arena-reinicios-v8.json");
    const pasesNormales = r.eventos.filter((e) => e.tipo === "pase" && e.motivo !== "largo");
    expect(pasesNormales.length).toBeGreaterThan(1);
    const citado = pasesNormales[0]!, noCitado = pasesNormales[1]!;
    const linea = lineaTiempoCronica(r, [{ eventos: [citado.id] }]).map((e) => e.id);
    expect(linea).toContain(citado.id);
    expect(linea).not.toContain(noCitado.id);
    for (const e of r.eventos.filter((x) => x.tipo === "gol" || (x.tipo === "pase" && x.motivo === "largo"))) expect(linea).toContain(e.id);
    // En el orden del registro.
    const orden = new Map(r.eventos.map((e, i) => [e.id, i] as const));
    expect(linea.map((id) => orden.get(id)!)).toEqual([...linea.map((id) => orden.get(id)!)].sort((a, b) => a - b));
  });
  it("sin hechos, ningún pase normal", () => {
    const eventos = [{ id: "a1", tipo: "pase", tick: 1 }, { id: "a2", tipo: "gol", tick: 2 }] as unknown as EventoArena[];
    expect(lineaTiempoCronica({ eventos }, []).map((e) => e.id)).toEqual(["a2"]);
  });
});

describe("064 · enlaceRepeticionCronica", () => {
  const torneo = { torneo: { id: "ensayo-059", n: 3 } } as unknown as Parameters<typeof enlaceRepeticionCronica>[1];
  it("partido de torneo: torneo, encuentro con dos cifras y t; ES añade lang", () => {
    expect(enlaceRepeticionCronica(HUELLA, torneo, 28, "en")).toBe("/arena?torneo=ensayo-059&encuentro=03&t=28");
    expect(enlaceRepeticionCronica(HUELLA, torneo, 28, "es")).toBe("/arena?torneo=ensayo-059&encuentro=03&t=28&lang=es");
  });
  it("cualquier otro partido: por huella", () => {
    expect(enlaceRepeticionCronica(HUELLA, null, 0, "en")).toBe(`/arena?cronica=${HUELLA}&t=0`);
    expect(enlaceRepeticionCronica(HUELLA, { }, 5, "es")).toBe(`/arena?cronica=${HUELLA}&t=5&lang=es`);
  });
});

describe("064 § 4.10 · el botón «Crónica»", () => {
  it("solo con el partido completo, fuera del directo, sin emisión del búfer en curso y no sobre el partido de muestra", () => {
    const base = { completo: true, enDirecto: false, bufferActivo: false, finEmision: false, sinPartido: false };
    expect(mostrarBotonCronica(base)).toBe(true);
    expect(mostrarBotonCronica({ ...base, completo: false })).toBe(false);
    expect(mostrarBotonCronica({ ...base, enDirecto: true })).toBe(false);
    expect(mostrarBotonCronica({ ...base, bufferActivo: true })).toBe(false);
    // La vista del búfer sigue montada al acabar la emisión: entonces sí.
    expect(mostrarBotonCronica({ ...base, bufferActivo: true, finEmision: true })).toBe(true);
    expect(mostrarBotonCronica({ ...base, bufferActivo: true, finEmision: true, completo: false })).toBe(false);
    expect(mostrarBotonCronica({ ...base, enDirecto: true, finEmision: true })).toBe(false);
    expect(mostrarBotonCronica({ ...base, sinPartido: true })).toBe(false);
  });
  it("un prefijo de un directo no es un partido completo", () => {
    const r = leer("public/experimentos/arena-duelo-v3.json");
    expect(registroCompleto(r)).toBe(true);
    const corte = Math.floor(r.final.tick / 2);
    const prefijo = { ...r, final: { ...r.fotogramas.find((f) => f.tick === corte)!, finalizado: undefined } } as RegistroArena;
    expect(registroCompleto(prefijo)).toBe(false);
  });
  it("claveFuente distingue las fuentes", () => {
    const claves = [{ sesion: "s" }, { torneo: "t", encuentro: "01" }, { torneo: "t", encuentro: "02" }, { archivo: "duelo" as const }, { huella: HUELLA }].map(claveFuente);
    expect(new Set(claves).size).toBe(claves.length);
  });
});
