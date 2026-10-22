// Brief 053 (v1.1) · Transcripción verificable de la transmisión. Las intervenciones y los
// comentarios salen de los productores reales (narrarArena, comentarArena, intervencionEstadista,
// componerIntercambio, MesaSesion) con LLM simulados; los valores esperados se calculan aparte
// (relato recalculado por ventanas, marcadores contados a mano en el fixture). Ninguna cifra de
// limites.ts se repite a mano.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { HechoVerificable } from "../../cadena/verificador";
import { verificarUpdate } from "../../cadena/verificador";
import type { Llm, Mensaje } from "../../lib/llm";
import { MESA_ARENA } from "../../sim/limites";
import { componerIntercambio, memoriaDialogoVacia } from "../dialogo";
import { datosEstadista, intervencionEstadista } from "../estadista";
import { hechosArena } from "../inteligencia";
import { MesaSesion } from "../mesa";
import { previaPartido } from "../previa";
import { comentarArena, narrarArena, type ComentarioArena } from "../narrador";
import { RELATO_INTERVALOS, type IntervencionArena } from "../protocolo";
import { catalogoGritos, construirRelato, gritosPartido } from "../relato";
import type { EventoArena, RegistroArena } from "../tipos";
import {
  construirTranscripcion, escaparMarkdown, finalDelPrefijo, nombreDescarga, ROTULOS_TRANSCRIPCION, transcripcionJson, transcripcionMarkdown,
  type EntradaTranscripcion, type LineaTranscripcion, type TranscripcionArena,
} from "../transcripcion";

const leer = (v: number) => JSON.parse(readFileSync(`src/arena/__fixtures__/arena-reinicios-v${v}.json`, "utf8")) as RegistroArena;
const v3 = leer(3), v4 = leer(4);
/** Helper de estadista.test.ts: sustituye `final` por el último fotograma ≤ t. */
const prefijo = (r: RegistroArena, t: number): RegistroArena => ({ ...r, eventos: r.eventos.filter(e => e.tick <= t), fotogramas: r.fotogramas.filter(f => f.tick <= t), final: [...r.fotogramas].reverse().find(f => f.tick <= t)! });
const GENERADO = "2026-10-22T12:00:00.000Z";
const D = MESA_ARENA.dialogo;

const contexto = (m: Mensaje[]) => JSON.parse(m[0]!.contenido) as { hechos: HechoVerificable[]; principal: string };
/** LLM fiel: una oración con el texto del hecho principal y los apoyos pedidos. */
const fiel = (apoyo: (c: ReturnType<typeof contexto>) => string[] = () => []): Llm => ({ id: "modelo-prueba", completar: async (_s, m) => {
  const c = contexto(m), h = c.hechos.find(h => h.id === c.principal)!;
  return JSON.stringify({ oraciones: [{ texto_es: h.texto_es, texto_en: h.texto_en, hecho: h.id, apoyo: apoyo(c) }] });
} });
/** Rechazado (no es JSON) los primeros `fallos` intentos; después, fiel. */
const fallaN = (fallos: number): Llm => { let n = 0; const ok = fiel(); return { id: "modelo-prueba", completar: async (s, m, o) => n++ < fallos ? "esto no es JSON" : ok.completar(s, m, o) }; };

const entrada = (registro: RegistroArena, comentarios: readonly ComentarioArena[] = [], intervenciones: readonly IntervencionArena[] = [], sesion: string | null = "sesion-prueba"): EntradaTranscripcion => ({ registro, comentarios, intervenciones, sesion, generado: GENERADO });
const proyeccion = (t: TranscripcionArena) => ({ lineas: t.lineas, diario: t.diario, marcador: t.partido.marcador, alcance: t.alcance, resumen: t.resumen, registro: t.registro });

// ——— Diario sintético con los productores reales (v4) ———
const gol = v4.eventos.find(e => e.tipo === "gol")!;
const pGol = prefijo(v4, gol.tick), seed = v4.config.partido.seed;
const conPlaza = (r: RegistroArena, t: number) => datosEstadista(prefijo(r, t), t).filter(d => d.ocupaPlaza);
// Comentarios del narrador: LLM aprobado al primer intento, rechazado→aprobado y rechazado×2 (respaldo).
const cLlm = (await narrarArena(prefijo(v4, 200), 200, fiel()))!;
const cReintento = (await narrarArena(prefijo(v4, 300), 300, fallaN(1)))!;
const cRespaldo = (await narrarArena(pGol, gol.tick, fallaN(2)))!;
// 048 · pregunta (comentarista rechazado→aprobado), ronda con dato de mesa y estadista con dos datos.
const comPregunta = (await comentarArena(pGol, gol.tick, fallaN(1), { principal: `arena:${gol.id}`, tema: "gol" }))!;
const pregunta = componerIntercambio({ intervencion: comPregunta, registro: pGol, seed, forma: "pregunta", memoria: memoriaDialogoVacia() }).intervencion;
const datoMesa = datosEstadista(pGol, gol.tick).find(d => d.tema === D.temasPorDisparador.gol[0])!;
const comRonda = (await comentarArena(pGol, gol.tick, fallaN(1), { principal: `arena:${gol.id}`, tema: "gol", datoMesa: datoMesa.hecho.id }))!;
const ronda = { ...componerIntercambio({ intervencion: comRonda, registro: pGol, seed, forma: "ronda", dato: datoMesa, memoria: memoriaDialogoVacia() }).intervencion, id: `${comRonda.id}:ronda` };
const est048 = componerIntercambio({ intervencion: intervencionEstadista(conPlaza(v4, 450).slice(0, 2), 450), registro: prefijo(v4, 450), seed, forma: "estadista", memoria: memoriaDialogoVacia() }).intervencion;
// 045 · estadista con el marcador 0–0 (eventos [] e intervalo, fuente «inicial») y comentarista sin LLM (audit []).
const est045 = intervencionEstadista(conPlaza(v4, 150).slice(0, 2), 150);
const com045 = (await comentarArena(prefijo(v4, 300), 300, undefined))!;
const comentarios = [cLlm, cReintento, cRespaldo];
const intervenciones = [est045, com045, pregunta, ronda, est048];

const completa = (idioma: "es" | "en" = "en", r = v4, c: readonly ComentarioArena[] = comentarios, i: readonly IntervencionArena[] = intervenciones, t = r.final.tick) => construirTranscripcion(entrada(r, c, i), t, idioma);
const lineasDe = (t: TranscripcionArena, id: string) => t.lineas.filter(l => l.intervencion?.id === id);

describe("053 · relato por plantillas", () => {
  it("con el diario vacío solo hay relato y coincide uno a uno con construirRelato por ventanas", () => {
    for (const r of [v3, v4]) for (const idioma of ["es", "en"] as const) for (const t of [r.final.tick, 0, 250]) {
      const tr = construirTranscripcion(entrada(r), t, idioma);
      expect(tr.lineas.every(l => l.origen === "relato" && l.rol === "narrador" && l.modo === "plantilla")).toBe(true);
      const esperado: string[] = [];
      for (let inicio = 0; inicio < t; inicio += RELATO_INTERVALOS.completo) esperado.push(...construirRelato(r, inicio, Math.min(inicio + RELATO_INTERVALOS.completo, t), "completo", idioma).fragmentos.map(f => f.texto));
      // Ronda 2 · Con corte 0 entran las líneas de tick 0: las mismas que abren la primera ventana.
      if (t === 0) esperado.push(...construirRelato(r, 0, RELATO_INTERVALOS.completo, "completo", idioma).fragmentos.filter(f => f.tick === 0).map(f => f.texto));
      expect(tr.lineas.map(l => l.texto)).toEqual(esperado);
      if (t === 0) { expect(tr.lineas.length).toBeGreaterThan(0); expect(tr.lineas.every(l => l.tick === 0)).toBe(true); expect(tr.lineas[0]!.texto_es).toMatch(/^Comienza el partido/); }
    }
  });

  it("registro de dos eventos hecho a mano: «Comienza…», el pase, el canto del gol y «Final…», en ese orden", () => {
    const pase = v4.eventos.find(e => e.tipo === "pase" && e.tick < gol.tick && !e.motivo)!;
    const r: RegistroArena = { ...v4, eventos: [pase, gol], fotogramas: [v4.fotogramas[0]!, v4.final] };
    const tr = construirTranscripcion(entrada(r), r.final.tick, "es");
    expect(tr.lineas).toHaveLength(4);
    expect(tr.lineas[0]!.texto_es).toMatch(/^Comienza el partido/);
    expect(tr.lineas[1]!.texto_es).toBe(hechosArena(r, r.final.tick).find(h => h.id === `arena:${pase.id}`)!.texto_es);
    expect(tr.lineas[1]!.evidencia.eventos).toEqual([pase.id]);
    // Brief 054: el canto empieza por el grito del mapa del partido (texto del catálogo).
    const grito = catalogoGritos().find(g => g.clave === gritosPartido(r, "es").get(gol.id))!;
    expect(tr.lineas[2]!.texto_es.startsWith(`${grito.es.texto} `)).toBe(true);
    expect(tr.lineas[2]!.texto_en.startsWith(`${grito.en.texto} `)).toBe(true);
    expect(tr.lineas[2]!.evidencia.eventos).toEqual([gol.id]);
    expect(tr.lineas[3]!.texto_es).toMatch(/^Final del partido/);
    expect(tr.lineas.map(l => l.tick)).toEqual([0, pase.tick, gol.tick, r.final.tick]);
    // Antes del gol: sin canto ni final, y el marcador cuenta goles ≤ corte (no registro.final.marcador).
    const antes = construirTranscripcion(entrada(r), gol.tick - 1, "es");
    expect(antes.lineas.map(l => l.evidencia.eventos)).toEqual([[], [pase.id]]);
    expect(antes.partido.marcador).toEqual({ local: 0, visita: 0 });
    expect(r.final.marcador).not.toEqual(antes.partido.marcador);
    expect(tr.partido.marcador).toEqual({ local: 0, visita: 1 });
  });
});

describe("053 · orden canónico", () => {
  it("comentarios e intervenciones desordenados y con ticks iguales salen por (tick, origen, posición, k) con n consecutivo", () => {
    const mismoTick = { ...intervencionEstadista(conPlaza(v4, 300).slice(0, 1), 300), id: "estadista:prueba:300" };
    const desordenadas = [ronda, est048, mismoTick, com045, est045, pregunta];
    const comentariosDesordenados = [cRespaldo, cReintento, cLlm];
    const tr = completa("es", v4, comentariosDesordenados, desordenadas);
    const rango = { relato: 0, comentario: 1, intervencion: 2 } as const;
    tr.lineas.forEach((l, k) => {
      expect(l.n).toBe(k + 1);
      const p = tr.lineas[k - 1];
      if (!p) return;
      expect(l.tick).toBeGreaterThanOrEqual(p.tick);
      if (l.tick === p.tick) expect(rango[l.origen]).toBeGreaterThanOrEqual(rango[p.origen]);
      if (l.tick === p.tick && l.origen === "intervencion" && p.origen === "intervencion") expect(desordenadas.findIndex(i => i.id === l.intervencion!.id)).toBeGreaterThanOrEqual(desordenadas.findIndex(i => i.id === p.intervencion!.id));
    });
    // A igual tick (300): el comentario antes que las intervenciones; mismoTick antes que com045 (orden del diario).
    const en300 = tr.lineas.filter(l => l.tick === 300 && l.origen !== "relato");
    expect(en300.map(l => l.intervencion?.id ?? "comentario")).toEqual(["comentario", mismoTick.id, ...com045.oraciones.map(() => com045.id)]);
    // Los turnos de un intercambio son consecutivos y en el orden de `turnos`.
    for (const i of [pregunta, ronda, est048]) {
      const idx = tr.lineas.flatMap((l, k) => l.intervencion?.id === i.id ? [k] : []);
      expect(idx).toEqual(idx.map((_, n) => idx[0]! + n));
      expect(idx.map(k => tr.lineas[k]!.texto_es)).toEqual(i.turnos!.map(t => t.texto_es));
      expect(idx.map(k => tr.lineas[k]!.intervencion!.turno)).toEqual(i.turnos!.map((_, n) => n));
    }
    // El orden por tiempo no depende del orden de llegada (solo los empates siguen al diario).
    const otra = completa("es", v4, comentarios, [est045, com045, mismoTick, pregunta, ronda, est048]);
    expect(otra.lineas.map(l => [l.tick, l.origen])).toEqual(tr.lineas.map(l => [l.tick, l.origen]));
    expect(otra.lineas.map(l => JSON.stringify([l.tick, l.texto])).sort()).toEqual(tr.lineas.map(l => JSON.stringify([l.tick, l.texto])).sort());
  });
});

describe("053 v1.1 · roles, modos y clases de verificación", () => {
  const tr = completa();
  it("tabla cerrada de clases: V y D separados", () => {
    for (const l of tr.lineas) {
      expect(["narrador", "comentarista", "estadista"]).toContain(l.rol);
      const v = l.verificacion;
      if (l.origen === "relato") expect(v).toEqual({ v: { estado: "no-aplica" }, d: { estado: "no-aplica" }, clase: "plantilla-sin-verificar" });
      if (l.origen === "comentario") { expect(v.v.estado).toBe("aprobada"); expect(v.d.estado).toBe("no-aplica"); expect(v.clase).toBe(l.modo === "llm" ? "llm-aprobado" : "respaldo-verificado"); }
      if (l.rol === "estadista") { expect(l.modo).toBe("determinista"); expect(v.clase).toBe("dato-determinista"); expect(v.v.estado).toBe("no-aplica"); expect(v.historial).toBeUndefined(); }
      if (l.origen === "intervencion" && l.rol === "narrador") { expect(v).toEqual({ v: { estado: "no-aplica" }, d: { estado: "aprobada" }, clase: "marco-de-dialogo" }); expect(l.modo).toBe("plantilla"); }
      if (l.origen === "intervencion" && l.rol === "comentarista") { expect(v.v.estado).toBe("aprobada"); expect(v.clase).toBe(l.modo === "llm" ? "llm-aprobado" : "respaldo-verificado"); }
      // D sale de la existencia de turnos.
      if (l.origen === "intervencion") expect(v.d.estado).toBe(l.intervencion!.turno !== undefined ? "aprobada" : "no-aplica");
    }
    // Todo turno del estadista (también el dato de la ronda, dentro de una candidatura del comentarista) es determinista.
    const e = lineasDe(tr, ronda.id).find(l => l.rol === "estadista")!;
    expect(ronda.modo).toBe("llm"); expect(e.modo).toBe("determinista"); expect(e.verificacion.historial).toBeUndefined();
    expect(e.modelo).toBeUndefined();
  });

  it("v = aprobada es verdad: cada texto publicado del narrador y del comentarista vuelve a pasar V1–V8", () => {
    for (const c of comentarios) expect(verificarUpdate(JSON.stringify({ oraciones: c.oraciones }), c.hechos, { config: v4.config.partido }, c.principal, 2).motivos).toEqual([]);
    for (const i of [comPregunta, comRonda, com045]) expect(verificarUpdate(JSON.stringify({ oraciones: i.oraciones }), i.hechos, { config: v4.config.partido }, i.oraciones[0]!.hecho, MESA_ARENA.maxOracionesComentarista).motivos).toEqual([]);
  });

  it("historial por los caminos reales: rechazado→aprobado, rechazado×2 y sin LLM", async () => {
    const linea = (c: ComentarioArena) => tr.lineas.find(l => l.origen === "comentario" && l.tick === c.tick && l.comentario!.principal === c.principal)!;
    // narrarArena
    expect(cLlm.modo).toBe("llm"); expect(linea(cLlm).verificacion.clase).toBe("llm-aprobado"); expect(linea(cLlm).verificacion.historial).toBeUndefined();
    expect(cReintento.modo).toBe("llm"); expect(linea(cReintento).verificacion).toMatchObject({ clase: "llm-aprobado", historial: { intentos: 2, rechazados: 1 } });
    expect(linea(cReintento).verificacion.historial!.motivos[0]).toMatch(/^intento 1 · V1: /);
    expect(cRespaldo.modo).toBe("plantilla"); expect(linea(cRespaldo).verificacion).toMatchObject({ clase: "respaldo-verificado", historial: { intentos: 2, rechazados: 2 } });
    expect(linea(cRespaldo).modo).toBe("plantilla");
    // comentarArena: rechazado→aprobado (llm-aprobado), rechazado×2 (respaldo) y sin LLM (respaldo sin historial).
    const c = lineasDe(tr, pregunta.id).find(l => l.rol === "comentarista")!;
    expect(c.verificacion).toMatchObject({ clase: "llm-aprobado", historial: { intentos: 2, rechazados: 1 } });
    expect(c.modelo).toBe("modelo-prueba");
    const dosFallos = (await comentarArena(pGol, gol.tick, fallaN(2), { principal: `arena:${gol.id}`, tema: "gol" }))!;
    const l2 = construirTranscripcion(entrada(v4, [], [dosFallos]), v4.final.tick, "es").lineas.filter(l => l.origen === "intervencion");
    expect(dosFallos.modo).toBe("plantilla");
    expect(l2.every(l => l.verificacion.clase === "respaldo-verificado" && l.verificacion.historial?.rechazados === 2 && l.verificacion.v.estado === "aprobada")).toBe(true);
    const sinLlm = lineasDe(tr, com045.id);
    expect(com045.audit).toEqual([]);
    expect(sinLlm.every(l => l.verificacion.clase === "respaldo-verificado" && l.verificacion.historial === undefined)).toBe(true);
    // El historial del comentarista nunca se copia a los marcos del narrador ni al estadista.
    for (const i of [pregunta, ronda]) for (const l of lineasDe(tr, i.id)) expect(l.verificacion.historial === undefined).toBe(l.rol !== "comentarista");
  });

  it("variantes: se transcriben los turnos de la completa, nunca los de turnosBreve", () => {
    const conBreve = intervenciones.filter(i => i.turnosBreve);
    expect(conBreve.length).toBeGreaterThan(0);
    for (const i of conBreve) {
      expect(JSON.stringify(i.turnosBreve)).not.toBe(JSON.stringify(i.turnos));
      const ls = lineasDe(tr, i.id);
      expect(ls.map(l => l.texto_en)).toEqual(i.turnos!.map(t => t.texto_en));
      expect(ls).toHaveLength(i.turnos!.length);
    }
    // Una breve con texto propio no aparece en ninguna línea.
    const marcada = { ...pregunta, id: "comentarista:breve:prueba", turnosBreve: pregunta.turnosBreve!.map(t => ({ ...t, texto_es: `BREVE ${t.texto_es}`, texto_en: `SHORT ${t.texto_en}` })) };
    const t2 = construirTranscripcion(entrada(v4, [], [marcada]), v4.final.tick, "en");
    expect(t2.lineas.some(l => l.texto_en.startsWith("SHORT ") || l.texto_es.startsWith("BREVE "))).toBe(false);
  });

  it("auditorías opcionales: 048 sin auditDialogo, con escalones y sin motivos, comentarista con audit []", () => {
    expect(pregunta.auditDialogo).toBeUndefined();
    expect(lineasDe(tr, pregunta.id).every(l => l.intervencion!.escalones === undefined && l.verificacion.d.estado === "aprobada")).toBe(true);
    const escalonada = { ...pregunta, id: "comentarista:escalones:prueba", auditDialogo: { motivos: [], escalones: ["1:cierre"] } };
    const ls = construirTranscripcion(entrada(v4, [], [escalonada]), v4.final.tick, "es").lineas.filter(l => l.origen === "intervencion");
    expect(ls.every(l => JSON.stringify(l.intervencion!.escalones) === JSON.stringify(["1:cierre"]) && l.verificacion.historial?.dialogo === undefined)).toBe(true);
    const sinAudit = { ...com045, id: "comentarista:sin-audit", audit: undefined as unknown as IntervencionArena["audit"] };
    expect(() => construirTranscripcion(entrada(v4, [], [sinAudit]), v4.final.tick, "es")).not.toThrow();
  });

  it("composición rechazada por D1–D5 (MesaSesion con componer forzado inválido): sin turnos, d no-aplica", async () => {
    const invalida = (e: Parameters<typeof componerIntercambio>[0]) => { const x = componerIntercambio(e); x.intervencion.turnos![0]!.texto_es += " Dato inventado."; return x; };
    const publicadas: IntervencionArena[] = [];
    const mesaE = new MesaSesion({ publicar: async i => { publicadas.push(i); }, componer: invalida });
    await mesaE.final(v4);
    const mesaC = new MesaSesion({ llm: fallaN(1), publicar: async i => { publicadas.push(i); }, componer: invalida });
    expect(mesaC.programarComentarista(pGol, v4.eventos.filter(e => e.tick === gol.tick))).toBe(true); await mesaC.esperar();
    const [e, c] = publicadas as [IntervencionArena, IntervencionArena];
    expect(e.rol).toBe("estadista"); expect(c.rol).toBe("comentarista");
    for (const i of [e, c]) { expect(i.turnos).toBeUndefined(); expect(i.auditDialogo!.motivos.some(m => m.regla === "D1")).toBe(true); }
    const t = construirTranscripcion(entrada(v4, [], publicadas), v4.final.tick, "es");
    // Ronda 2 · El rechazo D pertenece a esa composición: también el estadista lo conserva, sin
    // intentos V inventados ni historial LLM ajeno (reproducción de Codex: D1 y D5).
    const motivosD = e.auditDialogo!.motivos.map(m => `${m.regla}: ${m.detalle}`);
    expect(new Set(e.auditDialogo!.motivos.map(m => m.regla))).toEqual(new Set(["D1", "D5"]));
    expect(lineasDe(t, e.id)).toHaveLength(e.oraciones.length);
    for (const l of lineasDe(t, e.id)) expect(l.verificacion).toEqual({ v: { estado: "no-aplica" }, d: { estado: "no-aplica" }, clase: "dato-determinista", historial: { intentos: 0, rechazados: 0, motivos: [], dialogo: motivosD } });
    const json = JSON.parse(transcripcionJson(t)) as TranscripcionArena;
    for (const l of json.lineas.filter(x => x.intervencion?.id === e.id)) expect(l.verificacion.historial!.dialogo).toEqual(motivosD);
    for (const idioma of ["es", "en"] as const) {
      const md = transcripcionMarkdown(construirTranscripcion(entrada(v4, [], publicadas), v4.final.tick, idioma));
      const bloque = md.slice(md.indexOf(escaparMarkdown(e.id)));
      const fin = bloque.indexOf("\n### ", 1);
      const grupo = fin < 0 ? bloque : bloque.slice(0, fin);
      for (const m of motivosD) expect(grupo).toContain(escaparMarkdown(m));
      expect(grupo).toContain(ROTULOS_TRANSCRIPCION[idioma].dialogo);
      // Sin intentos V: no se rotula historial de generación para el estadista.
      expect(grupo).not.toContain(ROTULOS_TRANSCRIPCION[idioma].historial);
    }
    for (const l of lineasDe(t, c.id)) {
      expect(l.verificacion.d.estado).toBe("no-aplica"); expect(l.verificacion.v.estado).toBe("aprobada");
      expect(l.verificacion.historial!.dialogo!.some(m => m.startsWith("D1: "))).toBe(true);
      expect(l.verificacion.historial).toMatchObject({ intentos: 2, rechazados: 1 });
    }
    expect(lineasDe(t, c.id)).toHaveLength(c.oraciones.length);
  });
});

describe("053 v1.1 · evidencia", () => {
  const tr = completa();
  const ids = new Map(v4.eventos.map((e, k) => [e.id, { tick: e.tick, k }]));
  const hechosDe = (l: LineaTranscripcion) => l.origen === "comentario" ? comentarios.find(c => c.tick === l.tick && c.principal === l.comentario!.principal)!.hechos : intervenciones.find(i => i.id === l.intervencion!.id)!.hechos;
  it("toda oración de la mesa tiene eventos o intervalo; los ids existen ≤ corte, en orden del registro; los hechos existen", () => {
    for (const l of tr.lineas) {
      for (const id of l.evidencia.eventos) { expect(ids.has(id), id).toBe(true); expect(ids.get(id)!.tick).toBeLessThanOrEqual(tr.alcance.hastaTick); }
      const pos = l.evidencia.eventos.map(id => ids.get(id)!.k);
      expect(pos).toEqual([...pos].sort((a, b) => a - b)); expect(new Set(pos).size).toBe(pos.length);
      if (l.origen !== "relato") for (const h of l.evidencia.hechos) expect(hechosDe(l).some(x => x.id === h), h).toBe(true);
      const oracion = l.origen === "intervencion" && l.rol !== "narrador";
      if (oracion) expect(l.evidencia.eventos.length > 0 || !!l.evidencia.intervalo || !!l.evidencia.oraciones?.every(o => o.eventos.length > 0 || !!o.intervalo), JSON.stringify(l)).toBe(true);
    }
  });

  it("los turnos con oraciones llevan la unión de eventos de sus oraciones (calculada aparte)", () => {
    for (const i of [pregunta, ronda, est048]) i.turnos!.forEach((turno, k) => {
      const l = lineasDe(tr, i.id)[k]!;
      const esperados = new Set([...turno.oraciones.flatMap(o => i.evidencia[o]!.eventos), ...(turno.refiere ?? []).flatMap(r => i.hechos.find(h => h.id === r)?.eventos ?? [])]);
      expect(new Set(l.evidencia.eventos)).toEqual(esperados);
      if (turno.oraciones.length && turno.oraciones.some(o => i.evidencia[o]!.eventos.length)) expect(l.evidencia.eventos.length).toBeGreaterThan(0);
      if (turno.rol === "narrador" && !turno.refiere?.length) expect(l.evidencia).toEqual({ eventos: [], hechos: [], fotogramas: [] });
    });
    // El turno del comentarista siempre cita eventos de arena.
    for (const i of [pregunta, ronda]) expect(lineasDe(tr, i.id).find(l => l.rol === "comentarista")!.evidencia.eventos.length).toBeGreaterThan(0);
  });

  it("estadista: intervalo y fuente coinciden con i.evidencia[o]; el 0–0 sin eventos conserva fuente «inicial»", () => {
    const [marcador] = lineasDe(tr, est045.id);
    expect(est045.oraciones[0]!.hecho).toMatch(/^estadista:marcador:/);
    expect(marcador!.evidencia.eventos).toEqual([]);
    expect(marcador!.evidencia.intervalo).toEqual(est045.evidencia[0]!.intervalo);
    expect(marcador!.evidencia.fuente).toBe("inicial");
    // Turno E con dos datos: no se fusionan intervalos; una entrada por oración.
    const e = lineasDe(tr, est048.id).find(l => l.rol === "estadista")!, turno = est048.turnos!.find(t => t.rol === "estadista")!;
    expect(turno.oraciones.length).toBe(2);
    expect(e.evidencia.intervalo).toBeUndefined(); expect(e.evidencia.fuente).toBeUndefined();
    turno.oraciones.forEach((o, k) => { expect(e.evidencia.oraciones![k]!.intervalo).toEqual(est048.evidencia[o]!.intervalo); expect(e.evidencia.oraciones![k]!.fuente).toEqual(est048.evidencia[o]!.fuente); });
    // El dato de la ronda (una oración): campos planos.
    const r = lineasDe(tr, ronda.id).find(l => l.rol === "estadista")!, o = ronda.turnos!.find(t => t.rol === "estadista")!.oraciones[0]!;
    expect(r.evidencia.intervalo).toEqual(ronda.evidencia[o]!.intervalo); expect(r.evidencia.fuente).toEqual(ronda.evidencia[o]!.fuente);
  });

  it("v1.1 § 6 · oración con dos apoyos de procedencias distintas: citas por hecho y sin intervalo plano", async () => {
    const t = 450, p = prefijo(v4, t);
    const marcadorId = `estadista:marcador:${t}`;
    const i = (await comentarArena(p, t, fiel(c => [c.hechos.find(h => h.id.startsWith("arena:") && h.id !== c.principal)!.id, marcadorId])))!;
    expect(i.modo).toBe("llm"); expect(i.oraciones[0]!.apoyo).toHaveLength(2);
    const [l] = construirTranscripcion(entrada(v4, [], [i]), v4.final.tick, "es").lineas.filter(x => x.origen === "intervencion");
    expect(l!.evidencia.hechos).toEqual([i.oraciones[0]!.hecho, ...i.oraciones[0]!.apoyo!]);
    expect(l!.evidencia.citas).toEqual(i.evidencia[0]!.citas);
    expect(l!.evidencia.citas!.map(c => c.hecho)).toEqual([marcadorId]);
    expect(l!.evidencia.citas![0]!.intervalo).toEqual([0, t]);
    expect(l!.evidencia.intervalo).toBeUndefined(); expect(l!.evidencia.fuente).toBeUndefined();
  });
});

describe("053 v1.1 § 5 · nada posterior al corte", () => {
  const primerGol = v4.eventos.find(e => e.tipo === "gol")!;
  const trasGol = v4.fotogramas.find(f => f.tick >= primerGol.tick)!.tick;
  it("(a) igualdad con el prefijo en ticks con fotograma", () => {
    for (const t of [0, trasGol, v4.final.tick]) {
      expect(prefijo(v4, t).final.tick).toBe(t);
      for (const idioma of ["es", "en"] as const) expect(proyeccion(construirTranscripcion(entrada(prefijo(v4, t), comentarios, intervenciones), t, idioma))).toEqual(proyeccion(construirTranscripcion(entrada(v4, comentarios, intervenciones), t, idioma)));
    }
  });

  it("ronda 2 · propiedad de prefijo desde el comienzo: t' → t con t = 1..10 y en un tick sin fotograma > 100", () => {
    const frames = new Set(v4.fotogramas.map(f => f.tick));
    const sinFotograma = v4.eventos.find(x => !frames.has(x.tick) && x.tick > 100)!.tick;
    const pares: [number, number][] = [...Array.from({ length: 10 }, (_, k) => [k, k + 1] as [number, number]), [sinFotograma - 1, sinFotograma]];
    for (const [c, i] of [[[], []], [comentarios, intervenciones]] as const) for (const idioma of ["es", "en"] as const) {
      const de = (t: number) => construirTranscripcion(entrada(v4, c, i), t, idioma);
      for (const [tp, t] of pares) {
        const a = de(tp), b = de(t);
        expect(b.lineas.slice(0, a.lineas.length), `${tp}→${t}`).toEqual(a.lineas);
        expect(b.lineas.slice(a.lineas.length).every(l => l.tick > tp && l.tick <= t), `${tp}→${t}`).toBe(true);
        expect(a.lineas.every(l => l.tick <= tp)).toBe(true);
      }
      // Cadena completa 0..10: cada corte es prefijo del siguiente.
      for (let t = 0; t < 10; t++) expect(de(10).lineas.slice(0, de(t).lineas.length)).toEqual(de(t).lineas);
    }
  });

  it("(b) tick sin fotograma: lo de t' es prefijo exacto y lo extra cae en (t', t]", () => {
    const frames = new Set(v4.fotogramas.map(f => f.tick));
    const e = v4.eventos.find(x => !frames.has(x.tick) && x.tick > 100)!;
    const t = e.tick, tp = [...v4.fotogramas].reverse().find(f => f.tick <= t)!.tick;
    expect(tp).toBeLessThan(t);
    const extra = { ...intervencionEstadista(conPlaza(v4, t).slice(0, 1), t), id: `estadista:extra:${t}` };
    const lista = [...intervenciones, extra];
    const a = construirTranscripcion(entrada(v4, comentarios, lista), tp, "es"), b = construirTranscripcion(entrada(v4, comentarios, lista), t, "es");
    expect(b.lineas.slice(0, a.lineas.length)).toEqual(a.lineas);
    const nuevas = b.lineas.slice(a.lineas.length);
    expect(nuevas.length).toBeGreaterThan(0);
    expect(nuevas.every(l => l.tick > tp && l.tick <= t)).toBe(true);
    expect(nuevas.some(l => l.evidencia.eventos.includes(e.id))).toBe(true);
    expect(b.diario.intervenciones.filter(i => !a.diario.intervenciones.includes(i)).every(i => i.tick > tp && i.tick <= t)).toBe(true);
    expect(b.diario.intervenciones).toContain(extra);
    const goles = (x: number, y: number) => v4.eventos.filter(g => g.tipo === "gol" && g.tick > x && g.tick <= y).length;
    expect(b.partido.marcador.local + b.partido.marcador.visita - a.partido.marcador.local - a.partido.marcador.visita).toBe(goles(tp, t));
  });

  it("(c) futuro precargado en t + 1 (comentario, intervención y gol): nada cambia; marcador contado a mano", () => {
    for (const t of [primerGol.tick - 1, primerGol.tick, 450]) {
      const golExtra: EventoArena = { ...primerGol, id: "gol-futuro", tick: t + 1, lado: "local" };
      const r: RegistroArena = { ...v4, eventos: [...v4.eventos.filter(e => e.tick <= t + 1), golExtra, ...v4.eventos.filter(e => e.tick > t + 1)] };
      const cFuturo: ComentarioArena = { ...cLlm, tick: t + 1 }, iFuturo: IntervencionArena = { ...com045, id: "comentarista:futuro", tick: t + 1 };
      const conFuturo = construirTranscripcion(entrada(r, [cFuturo, ...comentarios], [iFuturo, ...intervenciones]), t, "es");
      const sin = construirTranscripcion(entrada(v4, comentarios, intervenciones), t, "es");
      expect(proyeccion(conFuturo)).toEqual(proyeccion(sin));
      expect(conFuturo.diario.comentarios).not.toContain(cFuturo); expect(conFuturo.diario.intervenciones).not.toContain(iFuturo);
      expect(conFuturo.lineas.every(l => l.tick <= t)).toBe(true);
      expect(conFuturo.diario.comentarios.every(c => c.tick <= t) && conFuturo.diario.intervenciones.every(i => i.tick <= t)).toBe(true);
      // Fixture v4: un único gol, del visitante, en el tick 367.
      expect(primerGol.tick).toBe(367); expect(primerGol.lado).toBe("visita");
      expect(conFuturo.partido.marcador).toEqual(t >= 367 ? { local: 0, visita: 1 } : { local: 0, visita: 0 });
    }
  });

  it("parcial salvo en el final de un registro completo; final anticipado, fotograma finalizado y registro interrumpido", () => {
    expect(completa("es", v4, comentarios, intervenciones, v4.final.tick).alcance).toEqual({ hastaTick: v4.final.tick, parcial: false });
    for (const t of [0, 300, v4.final.tick - 1]) expect(completa("es", v4, comentarios, intervenciones, t).alcance.parcial).toBe(true);
    // Interrumpido: el último fotograma publicado no es final (antes registro-incompleto).
    const cortado = prefijo(v4, 300);
    expect(construirTranscripcion(entrada(cortado), 300, "es").alcance).toEqual({ hastaTick: 300, parcial: true });
    expect(construirTranscripcion(entrada(cortado), 300, "es").registro).toEqual({ eventos: v4.eventos.filter(e => e.tick <= 300).length, fotogramas: v4.fotogramas.filter(f => f.tick <= 300).length, sesion: "sesion-prueba" });
    const anticipado: RegistroArena = { ...cortado, eventos: [...cortado.eventos, { ...gol, id: "fin", tipo: "final_anticipado", tick: 300 }] };
    expect(construirTranscripcion(entrada(anticipado), 300, "es").alcance.parcial).toBe(false);
    expect(construirTranscripcion(entrada(anticipado), 299, "es").alcance.parcial).toBe(true);
    const finalizado: RegistroArena = { ...cortado, fotogramas: cortado.fotogramas.map(f => f.tick === 300 ? { ...f, finalizado: { tick: 300, motivo: "menos_de_siete" as const } } : f) };
    expect(construirTranscripcion(entrada(finalizado), 300, "es").alcance.parcial).toBe(false);
    expect(finalDelPrefijo(finalizado, 295)).toBe(false);
  });

  it("entrada inválida: negativo, no entero, > final o NaN lanza", () => {
    for (const t of [-1, 1.5, v4.final.tick + 1, Number.NaN]) expect(() => construirTranscripcion(entrada(v4), t, "es")).toThrow();
  });
});

describe("053 · bilingüe, Markdown y nombres", () => {
  it("texto es el del idioma pedido; omitido con 6 entradas; rótulos completos en ES y EN", () => {
    for (const idioma of ["es", "en"] as const) {
      const tr = completa(idioma);
      expect(tr.lineas.every(l => l.texto === (idioma === "es" ? l.texto_es : l.texto_en))).toBe(true);
      expect(tr.omitido).toHaveLength(6);
      expect(tr.omitido.join(" ")).toContain(idioma === "es" ? "Orden canónico por tiempo; la pista de audio inserta a los invitados tras la ventana del narrador" : "Canonical order by time; the audio track inserts guests after the narrator's window");
    }
    const claves = (o: unknown, p = ""): string[] => typeof o === "object" && o !== null && !Array.isArray(o) ? Object.entries(o).flatMap(([k, v]) => claves(v, `${p}.${k}`)) : [p];
    expect(claves(ROTULOS_TRANSCRIPCION.es)).toEqual(claves(ROTULOS_TRANSCRIPCION.en));
    for (const idioma of ["es", "en"] as const) for (const c of claves(ROTULOS_TRANSCRIPCION[idioma])) {
      const v = c.split(".").slice(1).reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], ROTULOS_TRANSCRIPCION[idioma]);
      expect(Array.isArray(v) ? (v as string[]).every(s => s.length > 0) : typeof v === "string" && v.length > 0, `${idioma}${c}`).toBe(true);
    }
    const en = completa("en");
    for (const turno of pregunta.turnos!) expect(en.lineas.map(l => l.texto)).toContain(turno.texto_en);
  });

  it("Markdown: cabecera, parcial solo si corresponde, textos en orden, eventos por línea, un encabezado por intercambio, sin tablas", () => {
    for (const idioma of ["es", "en"] as const) for (const t of [v4.final.tick, 300]) {
      const tr = completa(idioma, v4, comentarios, intervenciones, t), md = transcripcionMarkdown(tr), R = ROTULOS_TRANSCRIPCION[idioma];
      expect(md.split("\n")[0]).toBe(`# ${escaparMarkdown(tr.partido.local)} ${tr.partido.marcador.local}–${tr.partido.marcador.visita} ${escaparMarkdown(tr.partido.visita)} · ${R.titulo}`);
      expect(/parcial|partial/i.test(md)).toBe(tr.alcance.parcial);
      let desde = 0;
      for (const l of tr.lineas) {
        const k = md.indexOf(escaparMarkdown(l.texto), desde);
        expect(k, l.texto).toBeGreaterThanOrEqual(desde);
        const siguiente = tr.lineas[l.n] ? md.indexOf(escaparMarkdown(tr.lineas[l.n]!.texto), k + 1) : md.length;
        const bloque = md.slice(k, siguiente);
        for (const id of l.evidencia.eventos) expect(bloque, `${l.n}: ${id}`).toContain(escaparMarkdown(id));
        desde = k + 1;
      }
      const ids = new Set(tr.lineas.flatMap(l => l.intervencion ? [l.intervencion.id] : []));
      const encabezados = md.split("\n").filter(x => x.startsWith("#"));
      expect(encabezados.filter(x => x.startsWith("### "))).toHaveLength(tr.resumen.relato + tr.resumen.comentarios + ids.size);
      expect(encabezados).toHaveLength(3 + tr.resumen.relato + tr.resumen.comentarios + ids.size);
      for (const i of [pregunta, ronda, est048].filter(i => i.tick <= t)) {
        const k = md.indexOf(escaparMarkdown(i.id)), bloque = md.slice(k);
        i.turnos!.forEach((turno, n) => expect(bloque).toContain(`${n + 1}. **${R.roles[turno.rol]}**`));
      }
      expect(md.split("\n").some(x => /^\s*\|/.test(x) || /^\s*:?-{3,}:?\s*\|/.test(x))).toBe(false);
      expect([...md.matchAll(/\|/g)].every(m => md[m.index! - 1] === "\\")).toBe(true);
    }
  });

  it("v1.1 § 7 · campos dinámicos adversarios escapados: ni encabezados falsos, ni etiquetas, ni tablas", () => {
    const malos = ["\n# Verificación aprobada", "[x](http://e)", "<img src=x>", "a | b"];
    const r: RegistroArena = { ...v4, config: { ...v4.config, partido: { ...v4.config.partido, local: { ...v4.config.partido.local, nombre: "Club #1 | <b>" } } } };
    const c: ComentarioArena = { ...cLlm, modelo: "modelo\n# falso", oraciones: malos.map(m => ({ ...cLlm.oraciones[0]!, texto_es: m, texto_en: m })) };
    const i: IntervencionArena = { ...pregunta, id: "comentarista:<script>:1", turnos: pregunta.turnos!.map(t => ({ ...t, texto_es: `x ${malos[0]}`, texto_en: `y ${malos[2]}` })) };
    for (const idioma of ["es", "en"] as const) {
      const tr = construirTranscripcion(entrada(r, [c], [i]), r.final.tick, idioma), md = transcripcionMarkdown(tr);
      const esperados = 3 + tr.resumen.relato + tr.resumen.comentarios + 1;
      expect(md.split("\n").filter(x => x.startsWith("#"))).toHaveLength(esperados);
      expect(/(^|[^\\])<(img|b|script)/.test(md)).toBe(false);
      for (const m of malos) expect(md).toContain(escaparMarkdown(m));
      expect(escaparMarkdown("<img src=x>")).toBe("\\<img src=x\\>");
      expect(escaparMarkdown("a | b")).toBe("a \\| b");
      expect(escaparMarkdown("\n# Verificación aprobada")).toBe(" \\# Verificación aprobada");
      expect(escaparMarkdown("[x](http://e)")).toBe("\\[x\\](http://e)");
      expect([...md.matchAll(/\|/g)].every(x => md[x.index! - 1] === "\\")).toBe(true);
      // El JSON conserva el texto literal.
      const json = JSON.parse(transcripcionJson(tr)) as TranscripcionArena;
      expect(json.lineas.filter(l => l.origen === "comentario").map(l => l.texto)).toEqual(malos);
    }
  });

  it("nombres de archivo por idioma, extensión y alcance; JSON con salto final", () => {
    const final = completa("es"), parcial = completa("en", v4, comentarios, intervenciones, 300);
    const s = v4.config.partido.seed;
    expect(nombreDescarga(final, "md")).toBe(`cronista-arena-${s}-comentarios-es.md`);
    expect(nombreDescarga(final, "json")).toBe(`cronista-arena-${s}-comentarios-es.json`);
    expect(nombreDescarga(parcial, "md")).toBe(`cronista-arena-${s}-comentarios-en-parcial-300.md`);
    expect(nombreDescarga(parcial, "json")).toBe(`cronista-arena-${s}-comentarios-en-parcial-300.json`);
    expect(nombreDescarga(final, "wav")).toBe(`cronista-arena-${s}-narracion-es-${v4.final.tick}.wav`);
    expect(nombreDescarga(parcial, "wav")).toBe(`cronista-arena-${s}-narracion-en-300.wav`);
    const texto = transcripcionJson(final);
    expect(texto).toBe(JSON.stringify(final, null, 1) + "\n");
    expect(JSON.parse(texto)).toMatchObject({ version: "transcripcion-arena-v1", generado: GENERADO, importable: false, idioma: "es" });
  });

  it("registro sin mesa (abierto desde archivo): solo relato y la cabecera lo muestra", () => {
    const tr = construirTranscripcion(entrada(v3, [], [], null), v3.final.tick, "es");
    expect(tr.resumen).toMatchObject({ comentarios: 0, intervenciones: 0, turnos: 0, relato: tr.lineas.length, lineas: tr.lineas.length });
    expect(tr.registro.sesion).toBeNull();
    expect(transcripcionMarkdown(tr).split("\n")[1]).toContain(`${ROTULOS_TRANSCRIPCION.es.sesion} —`);
  });
});

// Brief 056 § 5.7 (v1.1 § 11) · La previa en la transcripción: antes de «Comienza el partido…», dato
// determinista sin V ni D, forma «previa», funcion «dato», citas con las fuentes de la tabla y rótulos.
describe("056 · previa en la transcripción", () => {
  const FUENTE: Record<string, string> = { equipo: "config.partido", formacion: "config.formaciones", capitan: "inicial.jugadores", nivel: "inicial.jugadores", entrenador: "config.entrenadores", arbitro: "inicial.arbitro", condiciones: "config.partido.condiciones", perfiles: "config.partido" };
  const previa = previaPartido(v3);
  it("con hastaTick = 0 las líneas de la previa preceden a «Comienza el partido…», en orden de piezas y turnos", () => {
    for (const idioma of ["es", "en"] as const) {
      const tr = construirTranscripcion(entrada(v3, [], previa), 0, idioma);
      const deLaPrevia = tr.lineas.filter(l => l.intervencion?.forma === "previa");
      expect(deLaPrevia.length).toBe(previa.reduce((n, i) => n + i.turnos!.length, 0));
      expect(tr.lineas.slice(0, deLaPrevia.length)).toEqual(deLaPrevia);
      const relato0 = construirRelato({ ...v3, eventos: v3.eventos.filter(e => e.tick <= 0), fotogramas: v3.fotogramas.filter(f => f.tick <= 0) }, 0, 1, "completo", idioma).fragmentos[0]!.texto;
      expect(tr.lineas[deLaPrevia.length]).toMatchObject({ origen: "relato", texto: relato0 });
      expect(deLaPrevia.map(l => [l.intervencion!.id, l.intervencion!.turno])).toEqual(previa.flatMap(i => i.turnos!.map((_, k) => [i.id, k])));
      for (const l of deLaPrevia) {
        const i = previa.find(x => x.id === l.intervencion!.id)!, t = i.turnos![l.intervencion!.turno!]!;
        expect(l).toMatchObject({ tick: 0, rol: t.rol, origen: "intervencion", modo: "determinista", texto_es: t.texto_es, texto_en: t.texto_en });
        expect(l.verificacion).toEqual({ v: { estado: "no-aplica" }, d: { estado: "no-aplica" }, clase: "dato-determinista" });
        expect(l.intervencion).toMatchObject({ id: i.id, tema: "previa", forma: "previa", funcion: "dato" });
        const o = i.oraciones[t.oraciones[0]!]!;
        expect(l.evidencia.hechos).toEqual([o.hecho, ...o.apoyo ?? []]);
        expect(l.evidencia.fotogramas).toEqual([]);
        expect(l.evidencia.eventos).toEqual([]);
        expect(l.evidencia.intervalo).toEqual([0, 0]);
        expect(l.evidencia.citas!.map(c => c.hecho)).toEqual(l.evidencia.hechos);
        for (const c of l.evidencia.citas!) expect(c.fuente).toBe(FUENTE[c.hecho.split(":")[1]!]);
      }
      expect(tr.diario.intervenciones.filter(i => i.forma === "previa").map(i => i.id)).toEqual(previa.map(i => i.id));
    }
  });
  it("con el diario completo la previa sigue primero y ningún turno del narrador de la previa es «marco-de-dialogo»", () => {
    const tr = construirTranscripcion(entrada(v4, comentarios, [...previaPartido(v4), ...intervenciones]), v4.final.tick, "es");
    const n = previaPartido(v4).reduce((s, i) => s + i.turnos!.length, 0);
    expect(tr.lineas.slice(0, n).every(l => l.intervencion?.forma === "previa")).toBe(true);
    expect(tr.lineas.filter(l => l.intervencion?.forma === "previa" && l.verificacion.clase !== "dato-determinista")).toEqual([]);
    // Las cuentas sin previa no cambian: las demás líneas son las de siempre.
    const sin = construirTranscripcion(entrada(v4, comentarios, intervenciones), v4.final.tick, "es");
    expect(tr.lineas.slice(n).map(l => l.texto)).toEqual(sin.lineas.map(l => l.texto));
    expect(tr.resumen.lineas).toBe(sin.resumen.lineas + n);
  });
  it("Markdown rotula «previa» / «pre-match», la nota nueva y el orden con la excepción de la previa", () => {
    for (const idioma of ["es", "en"] as const) {
      const md = transcripcionMarkdown(construirTranscripcion(entrada(v3, [], previa), 0, idioma)), R = ROTULOS_TRANSCRIPCION[idioma];
      expect(md).toContain(`${R.conversacion} · ${R.formas.previa} · ${escaparMarkdown(previa[0]!.id)}`);
      expect(R.formas.previa).toBe(idioma === "es" ? "previa" : "pre-match");
      expect(md).toContain(idioma === "es" ? "La previa (alineaciones, técnicos y condiciones) se deriva del registro por plantilla determinista." : "The pre-match segment (line-ups, coaches and conditions) is derived from the match run by deterministic template.");
      expect(md).toContain(R.clases["dato-determinista"]);
      const excepcion = idioma === "es" ? "salvo la previa, que va antes del primer tramo." : "except the pre-match segment, which comes before the first passage.";
      expect(R.orden).toContain(excepcion);
      expect(R.omitido[4]).toContain(excepcion);
    }
  });
});
