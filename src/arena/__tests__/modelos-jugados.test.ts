// Brief 060 § 5 + v1.1 (8)(10) · Nombres de controlador (catálogo empaquetado) y procedencia por lado. Los nombres
// esperados se leen del catálogo con una búsqueda local de la prueba; los rótulos son los literales de § 5.4.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ladoJugado, lineaModelos, nombreControlador, procedenciaLado, type ContextoModelos, type EntradaCatalogo } from "../modelos-jugados";
import type { AsignacionModelos } from "../protocolo";
import type { DecisionArena, RegistroArena } from "../tipos";

const catalogo = JSON.parse(readFileSync("infra/modelos-arena.json", "utf8")) as (EntradaCatalogo & { publicar: boolean })[];
/** Oráculo local: el deployment `d` por nombre; si no, por modelo con su sufijo. */
const esperado = (d: string) => { const n = catalogo.find(e => e.nombre === d); if (n) return n.nombrePublico; const m = catalogo.find(e => e.modelo === d); return m ? `${m.nombrePublico} (deployment ${d})` : null; };
const leer = (f: string) => JSON.parse(readFileSync(`public/experimentos/${f}`, "utf8")) as RegistroArena;
const decision = (controlador: string, tipo: "llm" | "programado" = "llm", origen: "controlador" | "respaldo" = "controlador") => ({ controlador, tipo, origen }) as unknown as DecisionArena;
/** Registro mínimo con rondas: `local` y `visita` son listas de decisiones por ronda. */
const conRondas = (local: DecisionArena[], visita: DecisionArena[]) => ({ rondas: local.map((d, i) => ({ decisiones: { local: d, visita: visita[i]! } })) }) as unknown as Pick<RegistroArena, "rondas">;
const id = (d: string) => `azure-openai:${d}:reasoning-low`;
const luna6 = catalogo.find(e => e.nombre === "cronista-luna6")!, rapido = catalogo.find(e => e.nombre === "cronista-rapido")!;
const asignacion = (local: string, visita: string, extra: Partial<AsignacionModelos> = {}): AsignacionModelos => ({ modo: "manual", local: { id: "l", nombre: esperado(local)!, controlador: id(local) }, visita: { id: "v", nombre: esperado(visita)!, controlador: id(visita) }, ...extra });

describe("060 § 5.1 · nombreControlador", () => {
  it("toda entrada publicar: true se resuelve por nombre", () => {
    for (const e of catalogo.filter(e => e.publicar)) for (const prefijo of ["azure-openai", "foundry", "foundry-modelos"]) {
      expect(nombreControlador(`${prefijo}:${e.nombre}:reasoning-low`, catalogo)).toBe(e.nombrePublico);
      expect(nombreControlador(`${prefijo}:${e.nombre}`, catalogo, "es")).toBe(e.nombrePublico);
    }
  });
  it("gpt-6.1-sol se resuelve por modelo con el sufijo de deployment (ejemplo-v3)", () => {
    expect(nombreControlador(id("gpt-6.1-sol"), catalogo)).toBe(esperado("gpt-6.1-sol"));
    expect(esperado("gpt-6.1-sol")).toMatch(/\(deployment gpt-6\.1-sol\)$/);
  });
  it("un id desconocido queda fuera del catálogo; programado y ensayo dan sus textos; otro id, literal", () => {
    expect(nombreControlador(id("no-existe"), catalogo)).toBe("deployment no-existe (not in the catalog)");
    expect(nombreControlador(id("no-existe"), catalogo, "es")).toBe("deployment no-existe (fuera del catálogo)");
    expect(nombreControlador("programado:geometria-v3", catalogo)).toBe("Programmed policy");
    expect(nombreControlador("programado:geometria-v3", catalogo, "es")).toBe("Política programada");
    expect(nombreControlador("ensayo:a", catalogo)).toBe("Rehearsal (no model)");
    expect(nombreControlador("stub", catalogo, "es")).toBe("Ensayo (sin modelo)");
    expect(nombreControlador("otro:raro", catalogo)).toBe("otro:raro");
  });
  it("v1.1 (8) · M19: con X por nombre y Y por modelo del mismo deployment, gana X", () => {
    const sintetico: EntradaCatalogo[] = [{ nombre: "otro", modelo: "dep-a", nombrePublico: "Y" }, { nombre: "dep-a", modelo: "m", nombrePublico: "X" }];
    expect(nombreControlador(id("dep-a"), sintetico)).toBe("X");
  });
  it("los duelos archivados dan los nombres del catálogo (leídos, no escritos a mano)", () => {
    for (const f of ["arena-duelo-v3.json", "arena-llm-v3.json", "arena-llm-v1.json"]) {
      const r = leer(f);
      for (const lado of ["local", "visita"] as const) {
        const d = /^azure-openai:([^:]+)/.exec(r.rondas[0]!.decisiones[lado].controlador)![1]!;
        expect(ladoJugado(r, lado, catalogo).nombre).toBe(esperado(d));
      }
    }
  });
});

describe("060 § 5.2 · mezcla y respaldos", () => {
  it("respaldos (M18) y mezcla con sus textos", () => {
    const r = conRondas([decision(id(luna6.nombre)), decision(id(luna6.nombre), "llm", "respaldo"), decision(id(luna6.nombre)), decision(id(luna6.nombre))], [decision(id(luna6.nombre)), decision(id(luna6.nombre)), decision(id(luna6.nombre)), decision("programado:geometria-v3", "programado")]);
    expect(ladoJugado(r, "local", catalogo).nombre).toBe(`${luna6.nombrePublico} (1 of 4 decisions by programmed fallback)`);
    expect(ladoJugado(r, "local", catalogo, "es").nombre).toBe(`${luna6.nombrePublico} (1 de 4 decisiones con respaldo programado)`);
    expect(ladoJugado(r, "visita", catalogo).nombre).toBe(`mixed: ${luna6.nombrePublico} ×3, Programmed policy ×1`);
    expect(ladoJugado(r, "visita", catalogo, "es").nombre).toBe(`mezcla: ${luna6.nombrePublico} ×3, Política programada ×1`);
  });
});

describe("060 § 5.3 + v1.1 (10) · procedencia por lado y línea", () => {
  const coherente = conRondas([decision(id(luna6.nombre)), decision(id(luna6.nombre))], [decision(id(rapido.nombre)), decision(id(rapido.nombre))]);
  const sesion = (a: AsignacionModelos): ContextoModelos => ({ forma: "sesion", asignacion: a });
  it("sesión del servidor coherente: verificada, con los nombres de la asignación", () => {
    const l = lineaModelos(coherente, sesion(asignacion(luna6.nombre, rapido.nombre)), catalogo, "en");
    expect(l).toEqual({ texto: `Home: ${luna6.nombrePublico} · Away: ${rapido.nombrePublico} · verified: assigned by this session's server`, procedencia: "verificada" });
    expect(lineaModelos(coherente, sesion(asignacion(luna6.nombre, rapido.nombre)), catalogo, "es").texto).toBe(`Local: ${luna6.nombrePublico} · Visita: ${rapido.nombrePublico} · verificada: la asignó el servidor de esta sesión`);
  });
  it("M16 · procedencia «declarada» en la asignación: nunca verificada", () => {
    const l = lineaModelos(coherente, sesion(asignacion(luna6.nombre, rapido.nombre, { procedencia: "declarada" })), catalogo, "en");
    expect(l.procedencia).toBe("declarada"); expect(l.texto).toMatch(/declared by the file, not verified$/);
  });
  it("M17 · incoherencia entre asignación y rondas: declarada, con «assignment and record differ»", () => {
    const l = procedenciaLado(coherente, "local", sesion(asignacion(rapido.nombre, rapido.nombre)), catalogo, "en");
    expect(l).toEqual({ nombre: `${luna6.nombrePublico} (assignment and record differ)`, procedencia: "declarada", fuente: "archivo" });
    expect(procedenciaLado(coherente, "local", sesion(asignacion(rapido.nombre, rapido.nombre)), catalogo, "es").nombre).toBe(`${luna6.nombrePublico} (la asignación y el registro difieren)`);
  });
  it("mixta: un lado verificado y el otro con respaldo y otro id → sufijo por lado y data-procedencia «mixta»", () => {
    const r = conRondas([decision(id(luna6.nombre)), decision(id(luna6.nombre))], [decision(id("otro-dep"), "llm", "respaldo"), decision(id("otro-dep"))]);
    const l = lineaModelos(r, sesion(asignacion(luna6.nombre, rapido.nombre)), catalogo, "en");
    expect(l.procedencia).toBe("mixta");
    expect(l.texto).toBe(`Home: ${luna6.nombrePublico} (verified: assigned by this session's server) · Away: deployment otro-dep (not in the catalog) (1 of 2 decisions by programmed fallback) (assignment and record differ) (declared by the file, not verified)`);
  });
  it("sin decisiones: nombre de la asignación con «no decisions yet»; sin sesión, «no recorded decisions»", () => {
    const vacio = conRondas([], []);
    expect(lineaModelos(vacio, sesion(asignacion(luna6.nombre, rapido.nombre)), catalogo, "en").texto).toBe(`Home: ${luna6.nombrePublico} (no decisions yet) · Away: ${rapido.nombrePublico} (no decisions yet) · verified: assigned by this session's server`);
    expect(lineaModelos(vacio, { forma: "importado" }, catalogo, "es").texto).toBe("Local: sin decisiones registradas · Visita: sin decisiones registradas · declarada por el archivo, no verificada");
  });
  it("sesión programada coherente: programado, sin IA; con un id que no es programado:* se rebaja", () => {
    const prog = conRondas([decision("programado:geometria-v3", "programado")], [decision("programado:geometria-v3", "programado")]);
    const a: AsignacionModelos = { modo: "programado", local: { id: "programado", nombre: "Programmed policy / Política programada", controlador: "programado:geometria-v3" }, visita: { id: "programado", nombre: "Programmed policy / Política programada", controlador: "programado:geometria-v3" } };
    expect(lineaModelos(prog, sesion(a), catalogo, "en")).toEqual({ texto: "Home: Programmed policy · Away: Programmed policy · programmed, no AI", procedencia: "programado" });
    const raro = conRondas([decision("programado:geometria-v3", "llm")], [decision("programado:geometria-v3", "programado")]);
    expect(procedenciaLado(raro, "local", sesion(a), catalogo).procedencia).toBe("declarada");
  });
  it("formas sin sesión: ejemplo, importado, torneo, simulado y ensayo", () => {
    const duelo = leer("arena-duelo-v3.json");
    expect(lineaModelos(duelo, { forma: "ejemplo" }, catalogo, "en").texto).toMatch(/ · declared by the project's archived file, not verified$/);
    expect(lineaModelos(duelo, { forma: "ejemplo" }, catalogo, "es").texto).toMatch(/ · declarada por el archivo archivado del proyecto, no verificada$/);
    expect(lineaModelos(duelo, { forma: "importado" }, catalogo, "en").procedencia).toBe("declarada");
    expect(lineaModelos(duelo, { forma: "torneo" }, catalogo, "en").texto).toMatch(/ · declared by the tournament runner, not verified$/);
    expect(lineaModelos(duelo, { forma: "torneo" }, catalogo, "es").texto).toMatch(/ · declarada por el ejecutor del torneo, no verificada$/);
    // Simulado con decisiones de modelo: declarada (no se finge un programado).
    expect(lineaModelos(duelo, { forma: "simulado" }, catalogo, "en").procedencia).toBe("declarada");
    const prog = conRondas([decision("programado:geometria-v3", "programado")], [decision("programado:geometria-v3", "programado")]);
    expect(lineaModelos(prog, { forma: "simulado" }, catalogo, "es")).toEqual({ texto: "Local: Política programada · Visita: Política programada · programado, sin IA", procedencia: "programado" });
    const ensayo = conRondas([decision("ensayo:a", "programado")], [decision("ensayo:c", "programado")]);
    for (const contexto of [{ forma: "torneo" }, { forma: "sesion", asignacion: asignacion(luna6.nombre, rapido.nombre) }] as ContextoModelos[])
      expect(lineaModelos(ensayo, contexto, catalogo, "en")).toEqual({ texto: "Home: Rehearsal (no model) · Away: Rehearsal (no model) · rehearsal: programmed coaches with test names", procedencia: "ensayo" });
    expect(lineaModelos(ensayo, { forma: "torneo" }, catalogo, "es").texto).toBe("Local: Ensayo (sin modelo) · Visita: Ensayo (sin modelo) · ensayo: entrenadores programados con nombre de prueba");
  });
  it("el texto no contiene «Imported recording:» ni «Two independent» (getByText de e2e existentes)", () => {
    for (const f of ["arena-duelo-v3.json", "arena-llm-v3.json"]) for (const forma of ["ejemplo", "importado", "torneo", "simulado"] as const) for (const idioma of ["es", "en"] as const) {
      const t = lineaModelos(leer(f), { forma }, catalogo, idioma).texto;
      expect(t).not.toContain("Imported recording:"); expect(t).not.toContain("Two independent");
    }
  });
});
