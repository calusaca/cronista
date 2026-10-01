// Brief 004 (unit): eventosDeOracion y compañía, con datos reales de la cadena.
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import type { Hecho } from "../../analista/tipos";
import { borradorActa } from "../../cadena/acta";
import { generarCronica } from "../../cadena/cadena";
import type { CronicaVerificada } from "../../cadena/tipos";
import { crearLlmEnsayo } from "../../lib/llm-ensayo";
import { crearLlmStub } from "../../lib/llm-stub";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Evento } from "../../sim/tipos";
import {
  estadoOracion,
  eventosDeOracion,
  historiaDeOracion,
  jugadaDelGol,
  marcadorProgresivo,
  oracionesDeEvento,
  porPeriodo,
  resumenVerificacion,
} from "../evidencia";

const p = simular(configDeSemilla(246));
const hechos = analizar(p);
const porId = new Map(hechos.map((h) => [h.id, h] as const));

/** Crónica mínima a mano con una oración que cita dos hechos cuyos eventos se solapan. */
function conSolape(): { cronica: CronicaVerificada; h1: Hecho; h2: Hecho } {
  // h02 (doblete) y h05 (gol de penal del mismo jugador) comparten el evento del gol.
  const h1 = porId.get("h02") as Hecho;
  const h2 = porId.get("h05") as Hecho;
  const cronica: CronicaVerificada = {
    titulo_es: "t",
    titulo_en: "t",
    oraciones: [{ texto_es: "a", texto_en: "a", hecho: h1.id, apoyo: [h2.id, h1.id] }],
    intentos: 1,
    frasesOmitidas: 0,
    modo: "llm",
    audit: [],
  };
  return { cronica, h1, h2 };
}

describe("eventosDeOracion", () => {
  it("principal + apoyo con eventos solapados ⇒ la unión SIN duplicados, en orden del partido", () => {
    const { cronica, h1, h2 } = conSolape();
    const compartidos = h1.eventos.filter((e) => h2.eventos.includes(e));
    expect(compartidos.length).toBeGreaterThan(0); // el fixture de verdad solapa
    const evs = eventosDeOracion(cronica, hechos, 0);
    expect(new Set(evs).size).toBe(evs.length);
    expect(new Set(evs)).toEqual(new Set([...h1.eventos, ...h2.eventos]));
    expect(evs).toEqual([...evs].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))));
  });

  it("nunca vacío para una oración real: todo hecho cita ≥1 evento (contrato del 002)", () => {
    const acta = { ...borradorActa(hechos), intentos: 0, frasesOmitidas: 0, modo: "acta" as const, audit: [] };
    acta.oraciones.forEach((_, i) => expect(eventosDeOracion(acta, hechos, i).length).toBeGreaterThan(0));
  });

  it("todos los ids devueltos existen en el partido", () => {
    const acta = { ...borradorActa(hechos), intentos: 0, frasesOmitidas: 0, modo: "acta" as const, audit: [] };
    const ids = new Set(p.eventos.map((e) => e.id));
    for (let i = 0; i < acta.oraciones.length; i++) for (const e of eventosDeOracion(acta, hechos, i)) expect(ids.has(e)).toBe(true);
  });

  it("índice fuera de rango ⇒ []", () => {
    expect(eventosDeOracion(conSolape().cronica, hechos, 9)).toEqual([]);
  });
});

describe("oracionesDeEvento (la inversa)", () => {
  it("una oración aparece para cada uno de sus eventos, y solo esas", () => {
    const acta = { ...borradorActa(hechos), intentos: 0, frasesOmitidas: 0, modo: "acta" as const, audit: [] };
    for (const e of p.eventos) {
      for (const i of oracionesDeEvento(acta, hechos, e.id)) expect(eventosDeOracion(acta, hechos, i)).toContain(e.id);
    }
    const gol = p.eventos.find((e) => e.tipo === "gol") as Evento;
    expect(oracionesDeEvento(acta, hechos, gol.id).length).toBeGreaterThan(0);
  });
});

describe("estado y historia por frase (006)", () => {
  it("con el LLM de ensayo: la frase rechazada en el intento 1 queda «corregida» con su historia", async () => {
    const { cronica } = await generarCronica(p, { llm: crearLlmEnsayo() });
    expect(cronica.intentos).toBe(2);
    const estados = cronica.oraciones.map((_, i) => estadoOracion(cronica, i));
    expect(estados.filter((e) => e === "corregida")).toHaveLength(1);
    const i = estados.indexOf("corregida");
    const h = historiaDeOracion(cronica, i);
    expect(h.map((x) => x.n)).toEqual([1, 2]);
    expect(h[0]?.aprobada).toBe(false);
    expect(h[0]?.motivos.some((m) => m.regla === "V3")).toBe(true);
    expect(h[0]?.version?.texto_es).toContain("37");
    expect(h[0]?.feedback).toContain("V3");
    expect(h[1]?.aprobada).toBe(true);
    expect(h[1]?.version?.texto_es).toBe(cronica.oraciones[i]?.texto_es);
  });

  it("con el stub: todo «verificada», un intento", async () => {
    const { cronica } = await generarCronica(p, { llm: crearLlmStub() });
    expect(cronica.oraciones.every((_, i) => estadoOracion(cronica, i) === "verificada")).toBe(true);
    expect(resumenVerificacion(cronica)).toMatchObject({ oraciones: hechos.length, intentos: 1, omitidas: 0, corregidas: 0, modo: "llm" });
  });

  it("modo acta: estado «acta» (no se disfraza de crónica)", async () => {
    const { cronica } = await generarCronica(p, { forzarActa: true });
    expect(cronica.oraciones.every((_, i) => estadoOracion(cronica, i) === "acta")).toBe(true);
  });
});

describe("línea de tiempo y jugada del gol", () => {
  it("el marcador progresivo termina en el resultado final", () => {
    const m = marcadorProgresivo(p.eventos);
    const ultimo = m[p.eventos[p.eventos.length - 1]!.id]!;
    const res = porId.get("h03") as Hecho;
    expect(ultimo).toEqual({ local: res.datos.goles_local, visita: res.datos.goles_visita });
  });

  it("dos periodos, sin los eventos de inicio/fin dentro", () => {
    const ps = porPeriodo(p.eventos);
    expect(ps.map((x) => x.n)).toEqual([1, 2]);
    expect(ps.flatMap((x) => x.eventos).some((e) => e.tipo === "inicio_periodo" || e.tipo === "fin_periodo")).toBe(false);
  });

  it("cada gol: termina en tiro → gol del mismo jugador; un penal lleva la falta rival delante", () => {
    for (const g of p.eventos.filter((e) => e.tipo === "gol")) {
      const j = jugadaDelGol(p.eventos, g.id);
      expect(j.slice(-2).map((x) => x.rol)).toEqual(["tiro", "gol"]);
      expect(j[j.length - 2]?.evento.jugador).toBe(g.jugador);
      const tiro = j[j.length - 2]!.evento;
      if (tiro.penal) expect(j[0]?.rol).toBe("falta");
      // Todo paso previo es del minuto del tiro o del anterior.
      for (const x of j) expect(tiro.minuto - x.evento.minuto).toBeLessThanOrEqual(1);
    }
  });

  it("un id que no es gol ⇒ []", () => {
    expect(jugadaDelGol(p.eventos, p.eventos[0]!.id)).toEqual([]);
  });
});
