// Brief 048 (v1.1) · Diálogo entre voces: composición única, escalera de presupuesto, memoria de
// plantillas y comprobación D1–D5. Ninguna cifra ni texto de MESA_ARENA se repite a mano: se leen
// de MESA_ARENA. Las oraciones del comentarista salen de comentarArena con un LLM simulado (o del
// respaldo verificado), salvo en la escalera y los casos negativos, donde se simulan a propósito.
import huellasTranscripts from "../__fixtures__/huellas-transcripts.json";
import { conjuntoHuellas, huellaTramo, LONGITUD_HUELLA, normalizarTramo } from "../__fixtures__/huellas-transcripts";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { HechoVerificable } from "../../cadena/verificador";
import type { Llm, Mensaje } from "../../lib/llm";
import { MESA_ARENA } from "../../sim/limites";
import { VOZ_BUFFER } from "../buffer";
import { componerIntercambio, comprobarTurnos, confirmarMemoria, elegirPlantilla, memoriaDialogoVacia, principalEsperado, type MemoriaDialogo } from "../dialogo";
import { datosEstadista, intervencionEstadista } from "../estadista";
import { comentarArena } from "../narrador";
import type { IntervencionArena, TurnoMesa } from "../protocolo";
import type { EventoArena, RegistroArena } from "../tipos";
import { medirVentanas, umbralesVentana, VERSION_VENTANAS } from "../ventanas-dialogo";

const D = MESA_ARENA.dialogo;
const leer = (v: number) => JSON.parse(readFileSync(`src/arena/__fixtures__/arena-reinicios-v${v}.json`, "utf8")) as RegistroArena;
const v3 = leer(3), v4 = leer(4);
const prefijo = (r: RegistroArena, t: number): RegistroArena => ({ ...r, eventos: r.eventos.filter(e => e.tick <= t), fotogramas: r.fotogramas.filter(f => f.tick <= t), final: [...r.fotogramas].reverse().find(f => f.tick <= t)! });
const contexto = (m: Mensaje[]) => JSON.parse(m[0]!.contenido) as { hechos: HechoVerificable[]; principal: string; dato_mesa?: string };
/** LLM simulado: oración fiel del principal y, si se pide, una segunda sobre otro hecho de arena, con apoyos. */
const simulado = (opciones: { segunda?: (h: HechoVerificable[], principal: string) => HechoVerificable | undefined; apoyo?: (c: ReturnType<typeof contexto>) => string[] } = {}): Llm => ({ id: "modelo-prueba", completar: async (_s, m) => {
  const c = contexto(m), h = c.hechos.find(h => h.id === c.principal)!;
  const oraciones = [{ texto_es: h.texto_es, texto_en: h.texto_en, hecho: h.id, apoyo: opciones.apoyo?.(c) ?? [] }];
  const otro = opciones.segunda?.(c.hechos, c.principal);
  if (otro) oraciones.push({ texto_es: otro.texto_es, texto_en: otro.texto_en, hecho: otro.id, apoyo: [] });
  return JSON.stringify({ oraciones });
} });
const nombres = (rol: "comentarista" | "estadista", idioma: "es" | "en") => [MESA_ARENA.nombres[idioma][rol], MESA_ARENA.nombres[idioma][rol].split(" ")[0]!];
const jugadoresDe = (r: RegistroArena) => [...r.inicial.jugadores, ...r.inicial.banco ?? []];

/** Reconstrucción independiente de cada turno desde la plantilla, sus huecos y sus oraciones
 * (no usa dialogo.ts): devuelve los turnos que NO se reconstruyen. */
function noReconstruidos(i: IntervencionArena, r: RegistroArena, turnos: readonly TurnoMesa[]): number[] {
  const malos: number[] = [];
  turnos.forEach((t, k) => {
    for (const idioma of ["es", "en"] as const) {
      const texto = idioma === "es" ? t.texto_es : t.texto_en;
      if (t.rol !== "narrador") { if (t.oraciones.map(o => idioma === "es" ? i.oraciones[o]!.texto_es : i.oraciones[o]!.texto_en).join(" ") !== texto) malos.push(k); continue; }
      const [familia, indice] = t.plantilla!.split("#") as [string, string];
      const partes = familia.split(".");
      const lista: readonly string[] = partes[0] === "cierre" ? (partes[1] === "final" ? D.cierresFinal[idioma] : D.cierres[idioma]) : partes[0] === "cesion" ? MESA_ARENA.cesiones[idioma][partes[1] as "comentarista"]
        : partes[1] === "repaso" ? D.marcos[idioma].repaso : partes[1] === "final" ? D.marcos[idioma].final : D.marcos[idioma].estadista[partes[2] as "remates"];
      const plantilla = lista[Number(indice)]!;
      const destino = partes[0] === "cierre" ? turnos[k - 1]!.rol as "comentarista" : partes[1] === "repaso" || partes[1] === "comentarista" ? "comentarista" : "estadista";
      const e = r.eventos.find(e => `arena:${e.id}` === t.refiere?.[0]);
      const jugador = e ? jugadoresDe(r).find(j => j.id === e.jugador)?.nombre ?? "?" : "?";
      const accion = e ? (D.acciones[idioma] as Record<string, string>)[e.tipo]?.replace("{jugador}", jugador) ?? "?" : "?";
      const posibles = nombres(destino, idioma).map(n => plantilla.replace("{accion}", accion).replace("{jugador}", jugador).replace("{nombre}", n));
      if (!posibles.includes(texto)) malos.push(k);
    }
  });
  return [...new Set(malos)];
}
const roles = (ts: readonly TurnoMesa[] | undefined) => ts?.map(t => t.rol);

async function pregunta(r: RegistroArena, e: EventoArena, memoria = memoriaDialogoVacia(), llm: Llm = simulado()) {
  const p = prefijo(r, e.tick);
  const i = (await comentarArena(p, e.tick, llm, { principal: `arena:${e.id}`, tema: e.tipo }))!;
  return { p, i, x: componerIntercambio({ intervencion: i, registro: p, seed: r.config.partido.seed, forma: "pregunta", memoria }) };
}

describe("048 · formas sobre los fixtures reinicios-v3 y reinicios-v4", () => {
  it("`pregunta` con el disparador gol: marco `repaso`, respuesta y cierre; pasa D1–D5 y se reconstruye", async () => {
    for (const r of [v3, v4]) {
      const gol = r.eventos.find(e => e.tipo === "gol" && !e.autogol)!;
      const { p, i, x } = await pregunta(r, gol);
      expect(i.modo).toBe("llm");
      expect(x.intervencion.forma).toBe("pregunta");
      expect(roles(x.intervencion.turnos)).toEqual(["narrador", "comentarista", "narrador"]);
      expect(x.intervencion.turnos![0]!.plantilla).toMatch(/^marco\.repaso#\d$/);
      expect(x.intervencion.turnos![0]!.refiere).toEqual([`arena:${gol.id}`]);
      expect(x.intervencion.turnos![2]!.plantilla).toMatch(/^cierre#\d$/);
      expect(comprobarTurnos(x.intervencion, p)).toEqual([]);
      expect(noReconstruidos(x.intervencion, p, x.intervencion.turnos!)).toEqual([]);
      expect(noReconstruidos(x.intervencion, p, x.intervencion.turnosBreve!)).toEqual([]);
      // La breve: cesión genérica del 045 y la primera oración del comentarista.
      expect(roles(x.intervencion.turnosBreve)).toEqual(["narrador", "comentarista"]);
      expect(x.intervencion.turnosBreve![0]!.plantilla).toMatch(/^cesion\.comentarista#\d$/);
      expect(x.intervencion.oraciones[x.intervencion.turnosBreve![1]!.oraciones[0]!]).toEqual(i.oraciones[0]);
    }
  });

  it("{jugador} sale del evento referido: en la atajada, el portero (nunca el rematador)", async () => {
    const atajada = v4.eventos.find(e => e.tipo === "atajada")!;
    expect(atajada.receptor).toBeTruthy(); expect(atajada.receptor).not.toBe(atajada.jugador);
    const { p, x } = await pregunta(v4, atajada);
    const portero = jugadoresDe(v4).find(j => j.id === atajada.jugador)!.nombre, rematador = jugadoresDe(v4).find(j => j.id === atajada.receptor)!.nombre;
    const marco = x.intervencion.turnos![0]!;
    expect(marco.plantilla).toMatch(/^marco\.repaso#/);
    for (const texto of [marco.texto_es, marco.texto_en]) { expect(texto).toContain(portero); expect(texto).not.toContain(rematador); }
    expect(marco.texto_es).toContain(D.acciones.es.atajada.replace("{jugador}", portero));
    expect(comprobarTurnos(x.intervencion, p)).toEqual([]);
  });

  it("`ronda`: dato de mesa vigente sin cita y también citado en apoyo; el turno E lleva el dato con su evidencia", async () => {
    const gol = v4.eventos.find(e => e.tipo === "gol")!, p = prefijo(v4, gol.tick);
    const dato = datosEstadista(p, gol.tick).find(d => d.tema === D.temasPorDisparador.gol[0])!;
    for (const apoyo of [[], [dato.hecho.id]]) {
      const i = (await comentarArena(p, gol.tick, simulado({ apoyo: () => apoyo }), { principal: `arena:${gol.id}`, tema: "gol", datoMesa: dato.hecho.id }))!;
      expect(i.modo).toBe("llm"); expect(i.oraciones[0]!.apoyo).toEqual(apoyo);
      const x = componerIntercambio({ intervencion: i, registro: p, seed: v4.config.partido.seed, forma: "ronda", dato, memoria: memoriaDialogoVacia() });
      expect(x.intervencion.forma).toBe("ronda"); expect(x.conDato).toBe(true);
      expect(roles(x.intervencion.turnos)).toEqual(["narrador", "comentarista", "narrador", "estadista"]);
      expect(x.intervencion.turnos![2]!.plantilla).toMatch(new RegExp(`^marco\\.estadista\\.${dato.tema}#`));
      const e = x.intervencion.turnos![3]!;
      expect(x.intervencion.oraciones[e.oraciones[0]!]).toMatchObject({ hecho: dato.hecho.id, texto_es: dato.texto_es, texto_en: dato.texto_en });
      expect(x.intervencion.evidencia[e.oraciones[0]!]).toEqual(dato.evidencia);
      expect(comprobarTurnos(x.intervencion, p)).toEqual([]);
      expect(noReconstruidos(x.intervencion, p, x.intervencion.turnos!)).toEqual([]);
    }
  });

  it("D4 en la ronda: si el comentarista dijo el dato como principal, esa oración (nunca la primera) sale del turno C", async () => {
    const gol = v4.eventos.find(e => e.tipo === "gol")!, p = prefijo(v4, gol.tick);
    const dato = datosEstadista(p, gol.tick).find(d => d.tema === D.temasPorDisparador.gol[0])!;
    const base = (await comentarArena(p, gol.tick, simulado(), { principal: `arena:${gol.id}`, tema: "gol", datoMesa: dato.hecho.id }))!;
    // Segunda oración simulada con el dato como principal (lo que el prompt pide evitar).
    const i: IntervencionArena = { ...base, oraciones: [...base.oraciones, { texto_es: dato.texto_es, texto_en: dato.texto_en, hecho: dato.hecho.id, apoyo: [] }], evidencia: [...base.evidencia, dato.evidencia] };
    expect(i.oraciones.map(o => o.hecho)).toContain(dato.hecho.id);
    const x = componerIntercambio({ intervencion: i, registro: p, seed: v4.config.partido.seed, forma: "ronda", dato, memoria: memoriaDialogoVacia() });
    const principales = x.intervencion.turnos!.flatMap(t => t.oraciones.map(o => x.intervencion.oraciones[o]!.hecho));
    expect(principales.filter(h => h === dato.hecho.id)).toHaveLength(1);
    expect(comprobarTurnos(x.intervencion, p)).toEqual([]);
  });

  it("`estadista` y `final`: marco por el tema del primer dato (o la lista final), datos y cierre", () => {
    for (const r of [v3, v4]) for (const forma of ["estadista", "final"] as const) {
      const t = r.final.tick, datos = datosEstadista(r, t).filter(d => d.ocupaPlaza).slice(0, MESA_ARENA.maxDatosEstadista);
      const base = intervencionEstadista(datos, t);
      const x = componerIntercambio({ intervencion: base, registro: r, seed: r.config.partido.seed, forma, memoria: memoriaDialogoVacia() });
      expect(x.intervencion.forma).toBe(forma);
      expect(roles(x.intervencion.turnos)?.[0]).toBe("narrador");
      expect(x.intervencion.turnos![0]!.plantilla).toMatch(forma === "final" ? /^marco\.final#/ : new RegExp(`^marco\\.estadista\\.${datos[0]!.tema}#`));
      expect(x.intervencion.turnos![0]!.refiere).toEqual([datos[0]!.hecho.id]);
      expect(comprobarTurnos(x.intervencion, r)).toEqual([]);
      expect(noReconstruidos(x.intervencion, r, x.intervencion.turnos!)).toEqual([]);
      // La forma final fuera de la candidatura final no pasa D2.
      if (forma === "final") expect(comprobarTurnos({ ...x.intervencion, forma: "estadista" }, r).map(m => m.regla)).toContain("D2");
    }
  });

  it("autogol → marco genérico (cesión), con refiere[0] en el evento disparador", async () => {
    const r = structuredClone(v3), gol = r.eventos.find(e => e.tipo === "gol")!;
    gol.autogol = true;
    const { p, x } = await pregunta(r, gol);
    expect(x.intervencion.turnos![0]!.plantilla).toMatch(/^cesion\.comentarista#/);
    expect(x.intervencion.turnos![0]!.refiere).toEqual([`arena:${gol.id}`]);
    expect(comprobarTurnos(x.intervencion, p)).toEqual([]);
  });

  it("v1.2 (1) · un disparo por amarilla o roja (fuera del contexto del comentarista) produce marco genérico; el repaso exige que la respuesta cite el disparador", async () => {
    for (const tipo of ["amarilla", "roja"] as const) {
      const r = structuredClone(v3), t = v3.eventos.find(e => e.tipo === "gol")!.tick + 5, base = v3.eventos.find(e => e.tipo === "pase")!;
      r.eventos = [...r.eventos, { ...base, id: `t-${tipo}`, tipo, tick: t, motivo: undefined, receptor: null }].sort((a, b) => a.tick - b.tick);
      const p = prefijo(r, t);
      const i = (await comentarArena(p, t, simulado(), { principal: `arena:t-${tipo}`, tema: tipo }))!;
      // El contexto del comentarista no admite tarjetas: su primera oración es otro hecho.
      expect(i.oraciones[0]!.hecho).not.toBe(`arena:t-${tipo}`);
      expect(principalEsperado(i, p)).toBeUndefined();
      const x = componerIntercambio({ intervencion: i, registro: p, seed: r.config.partido.seed, forma: "pregunta", memoria: memoriaDialogoVacia() });
      expect(x.intervencion.turnos![0]!.plantilla).toMatch(/^cesion\.comentarista#/);
      expect(x.intervencion.turnos![0]!.refiere).toEqual([`arena:t-${tipo}`]);
      for (const turno of x.intervencion.turnos!) expect(turno.texto_es).not.toContain(D.acciones.es[tipo].split(" ")[1]!);
      expect(comprobarTurnos(x.intervencion, p)).toEqual([]);
      // Un repaso forzado sobre ese intercambio no pasa D2.
      const forzado = structuredClone(x.intervencion), jugador = jugadoresDe(r).find(j => j.id === base.jugador)!.nombre;
      forzado.turnos![0]!.plantilla = "marco.repaso#0";
      forzado.turnos![0]!.texto_es = D.marcos.es.repaso[0]!.replace("{accion}", D.acciones.es[tipo]).replace("{jugador}", jugador).replace("{nombre}", nombres("comentarista", "es")[0]!);
      forzado.turnos![0]!.texto_en = D.marcos.en.repaso[0]!.replace("{accion}", D.acciones.en[tipo]).replace("{jugador}", jugador).replace("{nombre}", nombres("comentarista", "en")[0]!);
      forzado.turnosBreve = undefined;
      expect([...new Set(comprobarTurnos(forzado, p).map(m => m.regla))]).toEqual(["D2"]);
    }
  });

  it("v1.2 (1) · con el disparador en el contexto pero una respuesta sobre otro hecho principal, no hay repaso", async () => {
    const gol = v3.eventos.find(e => e.tipo === "gol" && !e.autogol)!, p = prefijo(v3, gol.tick);
    const i = (await comentarArena(p, gol.tick, simulado(), { principal: `arena:${gol.id}`, tema: "gol" }))!;
    expect(principalEsperado(i, p)).toBe(`arena:${gol.id}`);
    const otro = i.hechos.find(h => h.id.startsWith("arena:") && h.id !== `arena:${gol.id}`)!;
    const desviada: IntervencionArena = { ...i, oraciones: [{ texto_es: otro.texto_es, texto_en: otro.texto_en, hecho: otro.id, apoyo: [] }], evidencia: [{ eventos: otro.eventos }] };
    const x = componerIntercambio({ intervencion: desviada, registro: p, seed: v3.config.partido.seed, forma: "pregunta", memoria: memoriaDialogoVacia() });
    expect(x.intervencion.turnos![0]!.plantilla).toMatch(/^cesion\.comentarista#/);
  });

  it("v1.2 (4) · la forma final cierra con sus propias plantillas; un cierre ordinario en el final no pasa D2", () => {
    const r = v4, t = r.final.tick, base = intervencionEstadista(datosEstadista(r, t).filter(d => d.ocupaPlaza).slice(0, 1), t);
    for (let k = 0; k < 6; k++) {
      const x = componerIntercambio({ intervencion: { ...base, id: `${base.id}-${k}` }, registro: r, seed: r.config.partido.seed, forma: "final", memoria: memoriaDialogoVacia() });
      const cierre = x.intervencion.turnos!.at(-1)!;
      expect(cierre.plantilla).toMatch(/^cierre\.final#\d$/);
      expect(comprobarTurnos(x.intervencion, r)).toEqual([]);
      const ordinario = structuredClone(x.intervencion), n = nombres("estadista", "es")[0]!;
      ordinario.turnos!.at(-1)!.plantilla = "cierre#0";
      ordinario.turnos!.at(-1)!.texto_es = D.cierres.es[0]!.replace("{nombre}", n);
      ordinario.turnos!.at(-1)!.texto_en = D.cierres.en[0]!.replace("{nombre}", nombres("estadista", "en")[0]!);
      expect([...new Set(comprobarTurnos(ordinario, r).map(m => m.regla))]).toEqual(["D2"]);
    }
    expect(D.cierresFinal.es.length).toBe(D.cierresFinal.en.length);
  });

  it("v1.2 (5) · la ronda recortada a pregunta conserva el cierre del narrador cuando cabe", async () => {
    const gol = v4.eventos.find(e => e.tipo === "gol")!, p = prefijo(v4, gol.tick);
    const dato = datosEstadista(p, gol.tick).find(d => d.tema === D.temasPorDisparador.gol[0])!;
    const i = (await comentarArena(p, gol.tick, simulado(), { principal: `arena:${gol.id}`, tema: "gol" }))!;
    const ronda = componerIntercambio({ intervencion: i, registro: p, seed: v4.config.partido.seed, forma: "ronda", dato, memoria: memoriaDialogoVacia() }).intervencion;
    const largo = (t: readonly TurnoMesa[]) => Math.max(t.map(x => x.texto_es).join(" ").length, t.map(x => x.texto_en).join(" ").length);
    // Se alarga la oración del comentarista hasta que la ronda no cabe pero pregunta + cierre sí.
    const exceso = MESA_ARENA.maxCaracteresIntervencion - largo(ronda.turnos!) + 1;
    const relleno = (t: string) => `${t.replace(/\.$/, "")}${", y otra vez".repeat(Math.ceil(exceso / 11))}.`;
    const larga: IntervencionArena = { ...i, oraciones: [{ ...i.oraciones[0]!, texto_es: relleno(i.oraciones[0]!.texto_es), texto_en: relleno(i.oraciones[0]!.texto_en) }] };
    const x = componerIntercambio({ intervencion: larga, registro: p, seed: v4.config.partido.seed, forma: "ronda", dato, memoria: memoriaDialogoVacia() });
    expect(x.intervencion.auditDialogo!.escalones).toContain("2:sin-estadista");
    expect(roles(x.intervencion.turnos)).toEqual(["narrador", "comentarista", "narrador"]);
    expect(x.intervencion.turnos!.at(-1)!.plantilla).toMatch(/^cierre#/);
    expect(largo(x.intervencion.turnos!)).toBeLessThanOrEqual(MESA_ARENA.maxCaracteresIntervencion);
    expect(comprobarTurnos(x.intervencion, p)).toEqual([]);
  });

  it("disparo por tiempo → marco genérico sin referencias; la forma `dato` nunca se produce y D2 la rechaza", async () => {
    const t = v3.final.tick;
    const i = (await comentarArena(v3, t, simulado()))!;
    const x = componerIntercambio({ intervencion: i, registro: v3, seed: v3.config.partido.seed, forma: "pregunta", memoria: memoriaDialogoVacia() });
    expect(x.intervencion.turnos![0]!.plantilla).toMatch(/^cesion\.comentarista#/);
    expect(x.intervencion.turnos![0]!.refiere).toBeUndefined();
    expect(comprobarTurnos(x.intervencion, v3)).toEqual([]);
    expect(comprobarTurnos({ ...x.intervencion, forma: "dato" }, v3).map(m => m.regla)).toContain("D2");
  });

  it("ES y EN tienen la misma estructura: mismas plantillas, oraciones y número de turnos en cada variante", async () => {
    const gol = v4.eventos.find(e => e.tipo === "gol")!, p = prefijo(v4, gol.tick);
    const dato = datosEstadista(p, gol.tick).find(d => d.tema === D.temasPorDisparador.gol[0])!;
    const i = (await comentarArena(p, gol.tick, simulado(), { principal: `arena:${gol.id}`, tema: "gol" }))!;
    // ES muy larga y EN corta: una escalera decidida por idioma daría estructuras distintas.
    const relleno = (t: string) => `${t} ${"x".repeat(MESA_ARENA.maxCaracteresOracion - t.length - 1)}`;
    const largaES: IntervencionArena = { ...i, oraciones: [{ ...i.oraciones[0]!, texto_es: relleno(i.oraciones[0]!.texto_es) }] };
    // Y al revés: EN muy larga y ES corta.
    const largaEN: IntervencionArena = { ...i, oraciones: [{ ...i.oraciones[0]!, texto_en: relleno(i.oraciones[0]!.texto_en) }] };
    for (const [forma, base] of [["ronda", largaES], ["pregunta", largaES], ["ronda", largaEN], ["pregunta", largaEN], ["ronda", i]] as const) {
      const x = componerIntercambio({ intervencion: base, registro: p, seed: v4.config.partido.seed, forma, dato, memoria: memoriaDialogoVacia() });
      for (const turnos of [x.intervencion.turnos!, x.intervencion.turnosBreve ?? []]) {
        expect(noReconstruidos(x.intervencion, p, turnos)).toEqual([]);
        for (const t of turnos) expect(!!t.texto_es && !!t.texto_en).toBe(true);
        // Medida independiente: cada idioma por separado cabe en el presupuesto.
        for (const idioma of ["texto_es", "texto_en"] as const) expect(turnos.map(t => t[idioma]).join(" ").length).toBeLessThanOrEqual(MESA_ARENA.maxCaracteresIntervencion);
      }
      expect(comprobarTurnos(x.intervencion, p)).toEqual([]);
    }
  });
});

describe("048 · escalera de presupuesto (§ 3.5)", () => {
  it("con oraciones largas simuladas deja ≤ maxCaracteresIntervencion en las dos variantes, anota los escalones y el último deja un turno con la primera oración", async () => {
    const gol = v4.eventos.find(e => e.tipo === "gol")!, p = prefijo(v4, gol.tick);
    const dato = datosEstadista(p, gol.tick).find(d => d.tema === D.temasPorDisparador.gol[0])!;
    const i = (await comentarArena(p, gol.tick, simulado(), { principal: `arena:${gol.id}`, tema: "gol" }))!;
    const principal = principalEsperado(i, p)!;
    const largo = (n: number, k: number) => ({ texto_es: `${"a".repeat(n - 1)}${k}`, texto_en: `${"b".repeat(n - 1)}${k}`, hecho: k ? `arena:${v4.eventos[k]!.id}` : principal, apoyo: [] });
    for (const n of [MESA_ARENA.maxCaracteresOracion, Math.floor(MESA_ARENA.maxCaracteresIntervencion / 2)]) {
      const base: IntervencionArena = { ...i, oraciones: [largo(n, 0), largo(n, 1)], evidencia: [{ eventos: [] }, { eventos: [] }] };
      for (const forma of ["ronda", "pregunta"] as const) {
        const x = componerIntercambio({ intervencion: base, registro: p, seed: v4.config.partido.seed, forma, dato, memoria: memoriaDialogoVacia() });
        for (const turnos of [x.intervencion.turnos!, x.intervencion.turnosBreve ?? []]) {
          const max = Math.max(turnos.map(t => t.texto_es).join(" ").length, turnos.map(t => t.texto_en).join(" ").length);
          expect(max).toBeLessThanOrEqual(MESA_ARENA.maxCaracteresIntervencion);
        }
        expect(x.intervencion.auditDialogo?.escalones.length).toBeGreaterThan(0);
        expect(comprobarTurnos(x.intervencion, p)).toEqual([]);
        if (n === MESA_ARENA.maxCaracteresOracion) {
          // Último escalón: un solo turno con la primera oración, nunca omitida.
          expect(x.intervencion.auditDialogo!.escalones).toContain("5:sin-marco");
          expect(roles(x.intervencion.turnos)).toEqual(["comentarista"]);
          expect(x.intervencion.oraciones[x.intervencion.turnos![0]!.oraciones[0]!]).toEqual(base.oraciones[0]);
          expect(x.conDato).toBe(false); expect(x.intervencion.forma).toBe("pregunta");
        }
      }
    }
  });

  it("invariantes calculadas desde las constantes", () => {
    expect(MESA_ARENA.maxCaracteresOracion).toBeLessThanOrEqual(MESA_ARENA.maxCaracteresIntervencion);
    expect(MESA_ARENA.maxCaracteresIntervencion / D.caracteresPorSegundoVoz).toBeLessThan(VOZ_BUFFER.duracionMaxS);
    expect(MESA_ARENA.maxCaracteresIntervencion / D.caracteresPorSegundoVoz + (D.maxTurnos - 1) * D.pausaTurnoS).toBeLessThanOrEqual(VOZ_BUFFER.duracionMaxS);
  });
});

describe("048 · memoria de plantillas y nombres (§ 3.6, v1.1 11–12)", () => {
  it("cuatro intercambios seguidos con la misma clave no repiten plantilla dentro de memoriaPlantillas; el primero usa el nombre completo y los siguientes el corto", async () => {
    const goles = [v3, v4].flatMap(r => r.eventos.filter(e => e.tipo === "gol" && !e.autogol).map(e => ({ r, e })));
    const memoria: MemoriaDialogo = memoriaDialogoVacia();
    const marcos: string[] = [], textos: string[] = [];
    for (let k = 0; k < 4; k++) {
      const { r, e } = goles[k % goles.length]!;
      // Mismo disparo, otro id (tick) en cada intercambio: la rotación arranca en otro índice.
      const p = prefijo(r, e.tick);
      const i = (await comentarArena(p, e.tick, simulado(), { principal: `arena:${e.id}`, tema: "gol" }))!;
      const x = componerIntercambio({ intervencion: { ...i, id: `${i.id}-${k}` }, registro: p, seed: r.config.partido.seed, forma: "pregunta", memoria });
      expect(comprobarTurnos(x.intervencion, p)).toEqual([]);
      marcos.push(x.intervencion.turnos![0]!.plantilla!); textos.push(x.intervencion.turnos![0]!.texto_es);
      confirmarMemoria(memoria, x);
    }
    expect(marcos.every(m => m.startsWith("marco.repaso#"))).toBe(true);
    marcos.forEach((m, k) => expect(marcos.slice(Math.max(0, k - D.memoriaPlantillas), k)).not.toContain(m));
    const [completo, corto] = nombres("comentarista", "es");
    expect(textos[0]).toContain(completo);
    for (const t of textos.slice(1)) { expect(t).toContain(corto); expect(t).not.toContain(completo); }
  });

  it("listas agotadas en la ventana de memoria: se toma la usada hace más tiempo", () => {
    const familia = `marco.estadista.${Object.keys(D.marcos.es.estadista)[0]}`, n = (D.marcos.es.estadista as Record<string, readonly string[]>)[familia.split(".")[2]!]!.length;
    expect(n).toBeLessThanOrEqual(D.memoriaPlantillas);
    const ids = Array.from({ length: n }, (_, k) => `${familia}#${k}`);
    for (const orden of [ids, [...ids].reverse()]) {
      const memoria: MemoriaDialogo = { recientes: { pregunta: [...orden] }, presentados: [] };
      expect(elegirPlantilla(familia, "pregunta", "estadista:x:1", 7, memoria)).toBe(orden[0]);
    }
    // Sin memoria, la rotación parte de varianteVoz; con una lista mayor que la ventana nunca repite en ella.
    const repaso = D.marcos.es.repaso.length;
    expect(repaso).toBeGreaterThan(D.memoriaPlantillas);
    const memoria = memoriaDialogoVacia(), vistos: string[] = [];
    for (let k = 0; k < repaso * 3; k++) {
      const p = elegirPlantilla("marco.repaso", "pregunta", `comentarista:gol:${k}`, 11, memoria);
      expect(vistos.slice(-D.memoriaPlantillas)).not.toContain(p);
      vistos.push(p); memoria.recientes.pregunta = [...vistos];
    }
  });

  it("ambas variantes parten del mismo estado previo; componer no consume memoria", async () => {
    const gol = v3.eventos.find(e => e.tipo === "gol")!, memoria = memoriaDialogoVacia();
    const { x } = await pregunta(v3, gol, memoria);
    expect(memoria).toEqual(memoriaDialogoVacia());
    const [completo] = nombres("comentarista", "es");
    expect(x.intervencion.turnos![0]!.texto_es).toContain(completo);
    expect(x.intervencion.turnosBreve![0]!.texto_es).toContain(completo);
  });
});

describe("048 · plantillas (MESA_ARENA.dialogo)", () => {
  type Lista = readonly string[];
  const pares = (): [string, Lista, Lista][] => [
    ["repaso", D.marcos.es.repaso, D.marcos.en.repaso], ["final", D.marcos.es.final, D.marcos.en.final], ["cierres", D.cierres.es, D.cierres.en],
    ...Object.keys(D.marcos.es.estadista).map(t => [`estadista.${t}`, (D.marcos.es.estadista as Record<string, Lista>)[t]!, (D.marcos.en.estadista as Record<string, Lista>)[t]!] as [string, Lista, Lista]),
    ...Object.keys(D.acciones.es).map(t => [`accion.${t}`, [(D.acciones.es as Record<string, string>)[t]!], [(D.acciones.en as Record<string, string>)[t]!]] as [string, Lista, Lista]),
  ];
  const huecos = (t: string) => [...t.matchAll(/\{[^}]*\}/g)].map(m => m[0]).sort();
  const todas = () => [...pares().flatMap(([, es, en]) => [...es, ...en]), ...(["es", "en"] as const).flatMap(i => [...MESA_ARENA.cesiones[i].comentarista, ...MESA_ARENA.cesiones[i].estadista])];

  it("ES/EN paralelas: misma longitud y mismos huecos por índice; huecos ⊆ {nombre, jugador, accion}; ningún dígito", () => {
    expect(Object.keys(D.marcos.en.estadista).sort()).toEqual(Object.keys(D.marcos.es.estadista).sort());
    expect(Object.keys(D.acciones.en).sort()).toEqual(Object.keys(D.acciones.es).sort());
    for (const [clave, es, en] of pares()) {
      expect([clave, es.length]).toEqual([clave, en.length]);
      es.forEach((t, k) => expect([clave, k, huecos(t)]).toEqual([clave, k, huecos(en[k]!)]));
    }
    for (const t of todas()) {
      for (const h of huecos(t)) expect(["{nombre}", "{jugador}", "{accion}"]).toContain(h);
      expect(t, t).not.toMatch(/\d/);
    }
  });

  it("v1.1 (3) · marcos neutrales: sin `secuencia` ni `centro` y sin presuponer causas", () => {
    for (const idioma of ["es", "en"] as const) expect(Object.keys(D.marcos[idioma]).sort()).toEqual(["estadista", "final", "repaso"]);
    const causales = /c[oó]mo naci[oó]|jugada previa|de d[oó]nde (viene|sale)|c[oó]mo se lleg[oó]|how did .* come about|where did .* come from|build-up|how did we get to/i;
    for (const t of todas()) expect(t, t).not.toMatch(causales);
  });

  it("v1.2 (9) F02 · lista blanca: toda palabra de las plantillas del narrador pertenece al léxico neutral aprobado", () => {
    // Léxico cerrado de la mesa (cesiones, marcos, acciones y cierres): nombrar, pedir, agradecer y
    // contar. Una palabra nueva (p. ej., un verbo causal) exige revisar este léxico con el brief.
    const LEXICO: Record<"es" | "en", readonly string[]> = {
      es: ["a", "acciones", "adelante", "amarilla", "anotado", "aquí", "así", "atajada", "atajadas", "bien", "cambios", "cerramos", "cerrar", "con", "cuántas", "cómo", "dato", "datos", "de", "del", "disciplina", "distancia", "el", "escucho", "está", "están", "faltas", "gol", "gracias", "hasta", "la", "las", "llevamos", "los", "marcador", "muy", "números", "para", "partido", "pase", "pases", "por", "quedan", "qué", "reinicios", "remate", "remates", "reparten", "reparto", "repasemos", "roja", "se", "seguimos", "sobre", "te", "tenemos", "vamos", "van", "ves", "y"],
      en: ["'s", "actions", "ahead", "all", "are", "back", "booking", "card", "close", "data", "discipline", "distance", "do", "does", "far", "for", "fouls", "go", "goal", "good", "have", "hear", "how", "is", "let's", "looking", "many", "match", "noted", "numbers", "of", "on", "over", "pass", "passes", "play", "red", "restarts", "save", "saves", "score", "see", "share", "shot", "shots", "so", "stand", "substitutions", "take", "thanks", "that", "the", "those", "through", "to", "us", "we", "what", "where", "with", "you"],
    };
    const palabras = (t: string) => t.replace(/\{[^}]*\}/g, " ").toLowerCase().split(/[^\p{L}']+/u).filter(Boolean);
    const porIdioma = (i: "es" | "en") => [...D.marcos[i].repaso, ...D.marcos[i].final, ...Object.values(D.marcos[i].estadista).flat(), ...D.cierres[i], ...D.cierresFinal[i], ...Object.values(D.acciones[i]), ...MESA_ARENA.cesiones[i].comentarista, ...MESA_ARENA.cesiones[i].estadista];
    for (const i of ["es", "en"] as const) for (const t of porIdioma(i)) for (const w of palabras(t)) expect(LEXICO[i], `«${w}» en «${t}»`).toContain(w);
    // v1.2 (4): los cierres del final nunca anuncian que el juego sigue.
    const sigue: Record<"es" | "en", readonly string[]> = { es: ["seguimos", "sigue", "vamos"], en: ["back", "play", "on"] };
    for (const i of ["es", "en"] as const) for (const t of D.cierresFinal[i]) for (const w of palabras(t)) expect(sigue[i], t).not.toContain(w);
  });

  it("ningún tramo literal de cuatro o más palabras aparece en los transcripts de referencia (huellas)", () => {
    // Los transcripts son material ajeno y no se versionan: se comparan huellas SHA-256 de tramos
    // normalizados de 4 palabras (src/arena/__fixtures__/generar-huellas-transcripts.ts).
    expect(huellasTranscripts.archivos).toBeGreaterThanOrEqual(6);
    const huellas = conjuntoHuellas(huellasTranscripts.huellas);
    expect(huellas.size * LONGITUD_HUELLA).toBe(huellasTranscripts.huellas.length);
    const tramos: string[] = [];
    for (const t of todas()) for (const segmento of t.split(/\{[^}]*\}/)) {
      const palabras = normalizarTramo(segmento).split(" ").filter(Boolean);
      for (let k = 0; k + 4 <= palabras.length; k++) tramos.push(palabras.slice(k, k + 4).join(" "));
    }
    expect(tramos.length).toBeGreaterThan(0);
    const presentes = tramos.filter(tr => huellas.has(huellaTramo(tr)));
    expect(presentes).toEqual([]);
    // Control: el detector sí reconoce una expresión genérica de ubicación que aparece en el corpus.
    expect(huellas.has(huellaTramo(normalizarTramo("por el sector izquierdo")))).toBe(true);
  });
});

describe("048 · D1–D5 con casos inválidos construidos (v1.1, 12)", () => {
  const reglas = (i: IntervencionArena, r: RegistroArena) => [...new Set(comprobarTurnos(i, r).map(m => m.regla))];
  const valido = async () => {
    const gol = v3.eventos.find(e => e.tipo === "gol")!;
    const { p, x } = await pregunta(v3, gol);
    expect(comprobarTurnos(x.intervencion, p)).toEqual([]);
    return { p, i: structuredClone(x.intervencion), gol };
  };

  it("D1 · texto alterado o `refiere` alterado: el turno no se reconstruye", async () => {
    const { p, i } = await valido();
    const alterado = structuredClone(i); alterado.turnos![0]!.texto_es += " Dato inventado.";
    expect(reglas(alterado, p)).toContain("D1");
    // refiere hacia otro evento con otro jugador: el texto ya no se reconstruye desde la plantilla.
    const otro = p.eventos.find(e => e.jugador && e.jugador !== p.eventos.find(x => `arena:${x.id}` === i.turnos![0]!.refiere![0])!.jugador)!;
    const refiere = structuredClone(i); refiere.turnos![0]!.refiere = [`arena:${otro.id}`];
    expect(reglas(refiere, p)).toContain("D1");
    expect(noReconstruidos(refiere, p, refiere.turnos!)).toContain(0);
    // Plantilla inexistente y referencia sin procedencia.
    const inexistente = structuredClone(i); inexistente.turnos![0]!.plantilla = "marco.secuencia#0";
    expect(reglas(inexistente, p)).toContain("D1");
    const sinProcedencia = structuredClone(i); sinProcedencia.turnos![0]!.refiere = ["arena:no-existe"];
    expect(reglas(sinProcedencia, p)).toContain("D1");
  });

  it("D2 · marco del estadista con otro tema (texto bien reconstruido): solo D2", () => {
    const t = v3.final.tick, datos = datosEstadista(v3, t).filter(d => d.ocupaPlaza).slice(0, 1);
    const x = componerIntercambio({ intervencion: intervencionEstadista(datos, t), registro: v3, seed: v3.config.partido.seed, forma: "estadista", memoria: memoriaDialogoVacia() });
    const i = structuredClone(x.intervencion), otroTema = Object.keys(D.marcos.es.estadista).find(k => k !== datos[0]!.tema)!;
    const lista = (D.marcos as unknown as Record<"es" | "en", { estadista: Record<string, readonly string[]> }>);
    i.turnos![0]!.plantilla = `marco.estadista.${otroTema}#0`;
    i.turnos![0]!.texto_es = lista.es.estadista[otroTema]![0]!.replace("{nombre}", nombres("estadista", "es")[0]!);
    i.turnos![0]!.texto_en = lista.en.estadista[otroTema]![0]!.replace("{nombre}", nombres("estadista", "en")[0]!);
    expect(reglas(i, v3)).toEqual(["D2"]);
  });

  it("D3 · v1.2 (8): cualquier conector se rechaza con motivo D3, también tras un turno E citado en apoyo", async () => {
    const { p, i } = await valido();
    i.turnos![1]!.conector = { plantilla: "conector#0", antesDe: i.turnos![1]!.oraciones[0]! };
    expect(reglas(i, p)).toContain("D3");
    // E → C con la oración de C citando en apoyo el dato que E acaba de decir: antes, la única
    // condición «válida» para un conector; ahora también D3.
    const gol = v4.eventos.find(e => e.tipo === "gol")!, pre = prefijo(v4, gol.tick);
    const dato = datosEstadista(pre, gol.tick).find(d => d.tema === D.temasPorDisparador.gol[0])!;
    const base = (await comentarArena(pre, gol.tick, simulado({ apoyo: () => [dato.hecho.id] }), { principal: `arena:${gol.id}`, tema: "gol" }))!;
    const ronda = componerIntercambio({ intervencion: base, registro: pre, seed: v4.config.partido.seed, forma: "ronda", dato, memoria: memoriaDialogoVacia() }).intervencion;
    const [marcoC, turnoC, marcoE, turnoE] = ronda.turnos!;
    const eAntes: IntervencionArena = { ...structuredClone(ronda), turnosBreve: undefined, turnos: [marcoE!, turnoE!, { ...turnoC!, conector: { plantilla: "conector#0", antesDe: turnoC!.oraciones[0]! } }] };
    expect(marcoC).toBeDefined();
    expect(ronda.oraciones[turnoC!.oraciones[0]!]!.apoyo).toEqual([dato.hecho.id]);
    expect(reglas(eAntes, pre)).toContain("D3");
  });

  it("v1.2 (9) A02 · una referencia sin procedencia en un turno sin huecos de evento: solo D1", async () => {
    const t = v3.final.tick, datos = datosEstadista(v3, t).filter(d => d.ocupaPlaza).slice(0, 1);
    const x = componerIntercambio({ intervencion: intervencionEstadista(datos, t), registro: v3, seed: v3.config.partido.seed, forma: "estadista", memoria: memoriaDialogoVacia() });
    const i = structuredClone(x.intervencion);
    i.turnos![0]!.refiere = [...i.turnos![0]!.refiere!, "estadista:inexistente:1"];
    expect(reglas(i, v3)).toEqual(["D1"]);
    const sinRegistro = structuredClone(x.intervencion); sinRegistro.turnos!.at(-1)!.refiere = ["arena:no-existe"];
    expect(reglas(sinRegistro, v3)).toEqual(["D1"]);
  });

  it("v1.2 (9) A03 · una referencia a un evento posterior al tick de la intervención: solo D1", () => {
    const t = Math.floor(v3.final.tick / 2), datos = datosEstadista(prefijo(v3, t), t).filter(d => d.ocupaPlaza).slice(0, 1);
    const x = componerIntercambio({ intervencion: intervencionEstadista(datos, t), registro: prefijo(v3, t), seed: v3.config.partido.seed, forma: "estadista", memoria: memoriaDialogoVacia() });
    const futuro = v3.eventos.find(e => e.tick > t)!;
    const i = structuredClone(x.intervencion); i.turnos![0]!.refiere = [...i.turnos![0]!.refiere!, `arena:${futuro.id}`];
    expect(reglas(i, v3)).toEqual(["D1"]);
  });

  it("v1.2 (9) A05 · una cesión seguida del turno de otro invitado: solo D2", async () => {
    const { p, i } = await valido();
    // La breve cede al comentarista; se cambia por una cesión al estadista (texto bien reconstruido).
    const breve = structuredClone(i), k = 0;
    breve.turnosBreve![0]!.plantilla = `cesion.estadista#${k}`;
    breve.turnosBreve![0]!.texto_es = MESA_ARENA.cesiones.es.estadista[k]!.replace("{nombre}", nombres("estadista", "es")[0]!);
    breve.turnosBreve![0]!.texto_en = MESA_ARENA.cesiones.en.estadista[k]!.replace("{nombre}", nombres("estadista", "en")[0]!);
    breve.turnosBreve![0]!.refiere = undefined;
    expect(reglas(breve, p)).toEqual(["D2"]);
  });

  it("D4 · el mismo hecho principal dicho dos veces en una variante: solo D4", async () => {
    const { p, i } = await valido();
    const c = i.turnos![1]!, k = c.oraciones[0]!;
    i.oraciones.push({ ...i.oraciones[k]!, texto_es: "Otra frase.", texto_en: "Another sentence." }); i.evidencia.push(i.evidencia[k]!);
    c.oraciones = [k, i.oraciones.length - 1];
    c.texto_es = `${i.oraciones[k]!.texto_es} Otra frase.`; c.texto_en = `${i.oraciones[k]!.texto_en} Another sentence.`;
    i.turnosBreve = undefined;
    expect(reglas(i, p)).toEqual(["D4"]);
  });

  it("D5 · presupuesto superado, dos turnos seguidos del mismo rol y principal que no es el disparador", async () => {
    const { p, i } = await valido();
    const largo = structuredClone(i), k = largo.turnos![1]!.oraciones[0]!;
    largo.oraciones[k]!.texto_es += ` ${"x".repeat(MESA_ARENA.maxCaracteresIntervencion)}`;
    largo.turnos = [{ ...largo.turnos![1]!, texto_es: largo.oraciones[k]!.texto_es }]; largo.turnosBreve = undefined;
    expect(reglas(largo, p)).toEqual(["D5"]);
    const repetido = structuredClone(i); repetido.turnos = [repetido.turnos![0]!, repetido.turnos![0]!, repetido.turnos![1]!]; repetido.turnosBreve = undefined;
    expect(reglas(repetido, p)).toContain("D5");
    const principal = structuredClone(i), otro = p.eventos.filter(e => e.tipo === "pase").at(-1)!;
    principal.oraciones[principal.turnos![1]!.oraciones[0]!]!.hecho = `arena:${otro.id}`; principal.turnosBreve = undefined;
    expect(reglas(principal, p)).toContain("D5");
  });
});

describe("048 v1.1 (13) · procedimiento versionado de medición de ventanas", () => {
  it("umbrales derivados de las constantes y medición reproducible (sin metas)", async () => {
    const u = umbralesVentana();
    expect(u.completaMaxS).toBeCloseTo(MESA_ARENA.maxCaracteresIntervencion / D.caracteresPorSegundoVoz + (D.maxTurnos - 1) * D.pausaTurnoS);
    expect(u.breveMaxS).toBeLessThanOrEqual(u.completaMaxS);
    expect(u.completaMaxS).toBeLessThanOrEqual(VOZ_BUFFER.duracionMaxS);
    expect(u.abreDesdePrioridad).toBeLessThanOrEqual(MESA_ARENA.comentaristaDesdePrioridad);
    expect(u.cierraDesdePrioridad).toBe(VOZ_BUFFER.prioridadInterrupcion);
    const a = await medirVentanas({ semillas: 2, duracionS: 30 }), b = await medirVentanas({ semillas: 2, duracionS: 30 });
    expect(b).toEqual(a);
    expect(a.version).toBe(VERSION_VENTANAS);
  });
});
