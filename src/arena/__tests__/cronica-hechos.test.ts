// Brief 064 § 8.1.5 · Analista de arena: I4 (el acta siempre verifica) e I5 (hechos) sobre los registros archivados y
// los torneos; los ejemplos normativos del § 4.2, literalmente; distancia del remate por geometría; tiro del gol por
// posición; nombres de club; «gol de la victoria» / «definitivo»; versiones; 0–0; final anticipado; recortes y exceso
// deliberado de tamaño. La matriz de 200 semillas × {10, 60, 180} s vive en `cronica-hechos-matriz-*.test.ts`.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { borradorActa } from "../../cadena/acta";
import { COBERTURA } from "../../cadena/umbrales";
import type { CronicaDraft } from "../../cadena/tipos";
import { ARENA, CRONICA_ARENA } from "../../sim/limites";
import {
  aMetros, arcoRival, conEventos, copia, ev, FIXTURES_064, incumplimientosI4I5, leerJson, registroConGoles064, registroEjemplos064, registroFinalAnticipado064,
} from "../__fixtures__/cronica-064";
import { enAreaRival } from "../ataque";
import { caracteresEntrada, hechosCronicaArena, registroCompleto, seleccionCronicaArena, SISTEMA_CRONICA_ARENA } from "../cronica-hechos";
import { verificarCronicaArena } from "../cronica-verificador";
import { golDeRemate, tiroDelGol } from "../relato";
import type { RegistroArena } from "../tipos";

const hechos = (r: RegistroArena) => hechosCronicaArena(r).map((h) => h.hecho);
const actaOk = (r: RegistroArena) => {
  const hs = seleccionCronicaArena(r).hechos.map((h) => h.hecho);
  return verificarCronicaArena(borradorActa(hs), hs, r.config.partido);
};
/** Verifica UNA oración (con título del acta) contra los hechos del registro. */
function verificarFrase(r: RegistroArena, hecho: string, es: string, en: string) {
  const hs = seleccionCronicaArena(r).hechos.map((h) => h.hecho);
  const acta = borradorActa(hs);
  const draft: CronicaDraft = { ...acta, oraciones: acta.oraciones.map((o) => (o.hecho === hecho ? { ...o, texto_es: es, texto_en: en } : o)) };
  const i = draft.oraciones.findIndex((o) => o.hecho === hecho);
  return verificarCronicaArena(draft, hs, r.config.partido).filter((m) => m.oracion === i);
}

const RAIZ = join(__dirname, "..", "..", "..");
function registrosDeTorneos(): { nombre: string; registro: RegistroArena }[] {
  const out: { nombre: string; registro: RegistroArena }[] = [];
  for (const dir of ["public/torneos/2026-10-24", "src/arena/__fixtures__/torneos/ensayo-059", "src/arena/__fixtures__/torneos-sitio"]) {
    for (const f of readdirSync(join(RAIZ, dir)).filter((x) => x.endsWith(".json.gz"))) {
      out.push({ nombre: `${dir}/${f}`, registro: JSON.parse(gunzipSync(readFileSync(join(RAIZ, dir, f))).toString("utf8")) as RegistroArena });
    }
  }
  return out;
}

describe("064 · I4 e I5 sobre registros archivados", () => {
  for (const f of FIXTURES_064) {
    it(`${f}`, () => {
      const r = leerJson(f);
      expect(registroCompleto(r)).toBe(true);
      expect(incumplimientosI4I5(r)).toEqual([]);
    });
  }
  it("torneos archivados (24 oct, ensayo-059 y sitio): todos los partidos completos", () => {
    const ts = registrosDeTorneos();
    expect(ts.length).toBeGreaterThanOrEqual(30);
    for (const { nombre, registro } of ts) {
      if (!registroCompleto(registro)) continue;
      expect(incumplimientosI4I5(registro), nombre).toEqual([]);
    }
  });
  it("lanza con un registro incompleto", () => {
    const r = copia(leerJson("public/experimentos/arena-duelo-v3.json"));
    r.final.tick = 10;
    expect(() => hechosCronicaArena(r)).toThrow(/no está completo/);
  });
});

describe("064 · ejemplos normativos del § 4.2 (literales) y nombres de club", () => {
  const r = registroEjemplos064();
  const hs = hechos(r);
  const de = (tipo: string, f: (h: (typeof hs)[number]) => boolean = () => true) => hs.find((h) => h.tipo === tipo && f(h))!;
  it("textos literales ES/EN", () => {
    expect(de("resultado_final")).toMatchObject({
      texto_es: "Final: Juventud Islaverde Sur 2, Atlético Montefrío Bajo 1, en 60 s de juego.",
      texto_en: "Final score: Juventud Islaverde Sur 2, Atlético Montefrío Bajo 1, after 60 s of play.",
    });
    expect(de("gol_anotado", (h) => h.datos.jugador === "Ana Ruiz")).toMatchObject({
      texto_es: "Gol de Ana Ruiz (9) para Juventud Islaverde Sur a los 34 s; marcador: Juventud Islaverde Sur 1, Atlético Montefrío Bajo 0.",
      texto_en: "Goal by Ana Ruiz (9) for Juventud Islaverde Sur after 34 s; score: Juventud Islaverde Sur 1, Atlético Montefrío Bajo 0.",
    });
    const ag = de("autogol");
    expect(ag.texto_es.startsWith("Gol en propia puerta de Pablo Gil (4), de Atlético Montefrío Bajo, a los 50 s: ")).toBe(true);
    expect(ag.texto_en.startsWith("An own goal by Pablo Gil (4), of Atlético Montefrío Bajo, after 50 s: ")).toBe(true);
    const textos = hs.map((h) => [h.texto_es, h.texto_en]);
    expect(textos).toContainEqual(["Juventud Islaverde Sur remató 5 veces, 2 a puerta; Atlético Montefrío Bajo remató 3 veces, 1 a puerta.",
      "Juventud Islaverde Sur had 5 shots, 2 on target; Atlético Montefrío Bajo had 3 shots, 1 on target."]);
    expect(textos).toContainEqual(["Atajadas de Luis Paz (1), de Atlético Montefrío Bajo: 3.", "Saves by Luis Paz (1), of Atlético Montefrío Bajo: 3."]);
    expect(hs.some((h) => h.texto_es.startsWith("Roja para ") && h.texto_en.startsWith("Red card for "))).toBe(true);
    expect(hs.some((h) => h.texto_es.startsWith("Amarilla para ") && h.texto_en.startsWith("Yellow card for "))).toBe(true);
    const cambio = hs.find((h) => h.datos.entra !== undefined)!;
    expect(cambio.texto_es).toMatch(/^En Juventud Islaverde Sur entró .+ por .+ a los 45 s\.$/);
    expect(cambio.texto_en).toMatch(/^In Juventud Islaverde Sur, .+ replaced .+ after 45 s\.$/);
    const fin = hechos(registroFinalAnticipado064()).find((h) => h.datos.jugadores !== undefined)!;
    expect(fin.texto_es).toBe("Final anticipado a los 120 s: Atlético Montefrío Bajo se quedó con 6 jugadores.");
    expect(fin.texto_en).toBe("Final whistle after 120 s: Atlético Montefrío Bajo were left with 6 players.");
  });
  it("como acta pasan verificarCronicaArena (I4) e I5", () => {
    expect(actaOk(r)).toEqual([]);
    expect(incumplimientosI4I5(r)).toEqual([]);
    expect(incumplimientosI4I5(registroFinalAnticipado064())).toEqual([]);
  });
  it("local, visita, equipo y beneficiado son nombres de club; autogol: equipo = autor, beneficiado = lado del evento", () => {
    const L = r.config.partido.local.nombre, V = r.config.partido.visita.nombre;
    for (const h of hs) {
      for (const k of ["local", "visita", "equipo", "beneficiado"]) if (k in h.datos) expect([L, V], `${h.id}.${k}`).toContain(h.datos[k]);
      if ("local" in h.datos) expect(h.datos.local).toBe(L);
      if ("visita" in h.datos) expect(h.datos.visita).toBe(V);
    }
    const ag = de("autogol");
    expect(ag.datos.equipo).toBe(V);
    expect(ag.datos.beneficiado).toBe(L);
    expect(de("gol_anotado", (h) => h.datos.jugador === "Bruno Toroino").datos.equipo).toBe(V);
  });
  it("relevancias e ids: obligatorios primero, c01… por relevancia", () => {
    const rel = hs.map((h) => h.relevancia);
    expect([...rel].sort((a, b) => b - a)).toEqual(rel);
    expect(hs.filter((h) => h.relevancia >= COBERTURA).map((h) => h.tipo).sort()).toEqual(["accion_arena", "autogol", "gol_anotado", "gol_anotado", "resultado_final"]);
  });
  it("expulsión: roja + falta del mismo jugador y tick como evidencia", () => {
    const roja = hs.find((h) => h.texto_es.startsWith("Roja"))!;
    expect(roja.eventos.map((id) => r.eventos.find((e) => e.id === id)!.tipo)).toEqual(["falta", "roja"]);
  });
  it("prueba de mutación: una plantilla que abre con «Remates» falla V4", () => {
    const remates = hs.find((h) => h.datos.remates_local !== undefined)!;
    const m = verificarFrase(r, remates.id, `Remates: ${remates.texto_es}`, `Shots: ${remates.texto_en}`);
    expect(m.some((x) => x.regla === "V4")).toBe(true);
  });
  it("prueba de mutación: «Sin …» del estadista como oración falla V7", () => {
    const remates = hs.find((h) => h.datos.remates_local !== undefined)!;
    const m = verificarFrase(r, remates.id, "Sin remates en los primeros 34 segundos.", "No shots in the first 34 seconds.");
    expect(m.some((x) => x.regla === "V7")).toBe(true);
  });
  it("prueba de mutación: con «local»/«visita» en lugar de nombres de club, el verbo de resultado ya no se respalda", () => {
    const res = de("resultado_final");
    const conLado = hs.map((h) => (h.id === res.id ? { ...h, datos: { ...h.datos, local: "local", visita: "visita" } } : h));
    const draft: CronicaDraft = { ...borradorActa(conLado), oraciones: [{ texto_es: "Juventud Islaverde Sur ganó 2-1 a Atlético Montefrío Bajo.", texto_en: "Juventud Islaverde Sur beat Atlético Montefrío Bajo 2-1.", hecho: res.id }] };
    const conNombres: CronicaDraft = { ...borradorActa(hs), oraciones: draft.oraciones };
    expect(verificarCronicaArena(conNombres, hs, r.config.partido).filter((m) => m.oracion === 0)).toEqual([]);
    expect(verificarCronicaArena(draft, conLado, r.config.partido).filter((m) => m.oracion === 0).length).toBeGreaterThan(0);
  });
});

describe("064 · tiro del gol por posición y «desde fuera del área» por geometría", () => {
  /** v5: el `a6` sale de DENTRO del área y recorre 18,9 m; aquí su desenlace pasa a ser gol. */
  function v5ConGolDeDentro(): RegistroArena {
    const r = copia(leerJson("src/arena/__fixtures__/arena-reinicios-v5.json"));
    const i = r.eventos.findIndex((e) => e.id === "a7");
    const a6 = r.eventos.find((e) => e.id === "a6")!;
    r.eventos[i] = { ...r.eventos[i]!, tipo: "gol", desde: { ...a6.desde } };
    r.final.marcador = { ...r.inicial.marcador };
    for (const e of r.eventos) if (e.tipo === "gol") r.final.marcador[e.lado]++;
    return r;
  }
  it("gol desde dentro del área (a6 de v5): metros = recorrido, sin distancia_m", () => {
    const r = v5ConGolDeDentro();
    const a6 = r.eventos.find((e) => e.id === "a6")!;
    expect(enAreaRival(a6.desde, a6.lado)).toBe(true);
    expect(a6.distanciaM).toBeGreaterThan(ARENA.areaLargoM);
    const g = hechos(r).find((h) => h.tipo === "gol_anotado" && h.eventos.includes("a6"))!;
    expect(g.datos.metros).toBe(Math.round(a6.distanciaM));
    expect(g.datos).not.toHaveProperty("distancia_m");
    expect(g.eventos).toEqual(["a6", "a7"]);
    expect(incumplimientosI4I5(r)).toEqual([]);
  });
  it("gol desde fuera del área: metros y distancia_m (= metros)", () => {
    const base = leerJson("public/experimentos/arena-duelo-v3.json");
    const desde = aMetros("local", 28);
    const r = conEventos(base, [ev(100, "tiro", "local", "local-10", { desde, hasta: arcoRival("local"), distanciaM: 28.4 }), ev(105, "gol", "local", "local-10", { desde, hasta: arcoRival("local"), distanciaM: 28.4 })]);
    const g = hechos(r).find((h) => h.tipo === "gol_anotado")!;
    expect(g.datos.metros).toBe(28);
    expect(g.datos.distancia_m).toBe(28);
    expect(actaOk(r)).toEqual([]);
  });
  it("gol de rechace (sin tiro del goleador): ni metros ni distancia_m", () => {
    const g = hechos(registroEjemplos064()).find((h) => h.datos.jugador === "Ana Ruiz")!;
    expect(g.datos).not.toHaveProperty("metros");
    expect(g.datos).not.toHaveProperty("distancia_m");
  });
  it("dos tiros del mismo goleador con distancias distintas: se cita el último antes del gol (tiroDelGol), no el primero", () => {
    const base = leerJson("public/experimentos/arena-duelo-v3.json");
    const lejos = aMetros("local", 30), cerca = aMetros("local", 10);
    const r = conEventos(base, [
      ev(100, "tiro", "local", "local-10", { desde: lejos, distanciaM: 30 }), ev(102, "tiro_fuera", "local", "local-10", { desde: lejos }),
      ev(200, "tiro", "local", "local-10", { desde: cerca, distanciaM: 10 }), ev(203, "gol", "local", "local-10", { desde: cerca }),
    ]);
    const gol = r.eventos.find((e) => e.tipo === "gol")!;
    expect(tiroDelGol(gol, r)!.distanciaM).toBe(10);
    expect(golDeRemate(gol, r)).toBe(true);
    const g = hechos(r).find((h) => h.tipo === "gol_anotado")!;
    expect(g.datos.metros).toBe(10);
    expect(g.datos).not.toHaveProperty("distancia_m");
    expect(g.eventos).toEqual([r.eventos[2]!.id, gol.id]);
  });
});

describe("064 · «gol de la victoria» y «definitivo»", () => {
  const base = leerJson("public/experimentos/arena-duelo-v3.json");
  const conGoles = (lados: ("local" | "visita")[], autogolFinal?: "local" | "visita") => conEventos(base, [
    ...lados.flatMap((lado, k) => {
      const j = lado === "local" ? "local-10" : "visita-8";
      return [ev(50 + k * 100, "recuperacion", lado, j), ev(52 + k * 100, "gol", lado, j)];
    }),
    ...(autogolFinal ? [ev(500, "gol", autogolFinal, autogolFinal === "local" ? "visita-3" : "local-3", { autogol: true })] : []),
  ]);
  const ultimoGol = (r: RegistroArena) => hechos(r).filter((h) => h.tipo === "gol_anotado").sort((a, b) => Number(b.datos.segundo) - Number(a.datos.segundo))[0]!;
  for (const [nombre, lados] of [["local gana 2–1", ["local", "visita", "local"]], ["visita gana 1–2", ["local", "visita", "visita"]]] as const) {
    it(`${nombre}: aceptados en el gol que decide`, () => {
      const r = conGoles([...lados]);
      const g = ultimoGol(r);
      expect(verificarFrase(r, g.id, `${g.datos.jugador} firmó el gol de la victoria a los ${g.datos.segundo} s.`, `${g.datos.jugador} scored the winning goal after ${g.datos.segundo} s.`)).toEqual([]);
      expect(verificarFrase(r, g.id, `El gol de ${g.datos.jugador} a los ${g.datos.segundo} s fue el definitivo.`, `${g.datos.jugador}'s goal after ${g.datos.segundo} s settled the match.`)).toEqual([]);
    });
  }
  it("rechazados en un autogol del perdedor (no es un gol_anotado)", () => {
    const r = conGoles(["local", "visita"], "local"); // 2–1 para local por autogol de un jugador de visita
    const ag = hechos(r).find((h) => h.tipo === "autogol")!;
    const m = verificarFrase(r, ag.id, `El gol en propia puerta de ${ag.datos.jugador} fue el gol de la victoria.`, `${ag.datos.jugador}'s own goal was the winning goal.`);
    expect(m.some((x) => x.regla === "V8")).toBe(true);
  });
});

describe("064 · versiones, 0–0, final anticipado y recortes", () => {
  it("registro arena-v1 (sin banco ni entrenadores): catálogo reducido sin lanzar", () => {
    const r = leerJson("public/experimentos/arena-llm-v1.json");
    expect(r.inicial.banco ?? []).toEqual([]);
    expect(r.config.entrenadores).toBeUndefined();
    expect(() => hechos(r)).not.toThrow();
    expect(incumplimientosI4I5(r)).toEqual([]);
  });
  it("v7/v8: remate lejano y balón largo", () => {
    const v7 = hechos(leerJson("src/arena/__fixtures__/arena-reinicios-v7.json"));
    const v8 = hechos(leerJson("src/arena/__fixtures__/arena-reinicios-v8.json"));
    const todos = [...v7, ...v8];
    expect(todos.some((h) => h.datos.balones_largos !== undefined)).toBe(true);
    // Remate lejano sintético sobre v8 (fuera del área, 30 m) y otro desde dentro con recorrido largo.
    const r8 = leerJson("src/arena/__fixtures__/arena-reinicios-v8.json");
    const lejano = conEventos(r8, [...r8.eventos, ev(r8.final.tick - 5, "tiro", "local", "local-10", { motivo: "lejano", desde: aMetros("local", 30), distanciaM: 30.2 })]);
    const h = hechos(lejano).find((x) => x.datos.metros === 30 && x.tipo === "accion_arena")!;
    expect(h.texto_es).toMatch(/remató desde 30 m a los \d+ s\.$/);
    expect(h.datos.distancia_m).toBe(30);
    expect(incumplimientosI4I5(lejano)).toEqual([]);
  });
  it("0–0: el resultado con eventos vacíos, intervalo [0, final.tick] y fuente inicial", () => {
    const r = leerJson("src/arena/__fixtures__/arena-reinicios-v8.json");
    expect(r.final.marcador).toEqual({ local: 0, visita: 0 });
    const res = hechosCronicaArena(r).find((h) => h.hecho.tipo === "resultado_final")!;
    expect(res.hecho.eventos).toEqual([]);
    expect(res.evidencia).toEqual({ eventos: [], intervalo: [0, r.final.tick], fuente: "inicial" });
  });
  it("final anticipado: obligatorio, con los jugadores que le quedan", () => {
    const r = registroFinalAnticipado064();
    const f = hechos(r).find((h) => h.datos.jugadores !== undefined)!;
    expect(f.relevancia).toBe(CRONICA_ARENA.relevancia.finalAnticipado);
    expect(f.relevancia).toBeGreaterThanOrEqual(COBERTURA);
    expect(f.datos.jugadores).toBe(r.final.jugadores.filter((j) => j.lado === "visita").length);
  });
  it("recorte a maxHechos con todos los obligatorios presentes", () => {
    // Muchos no obligatorios (amarillas, cambios, fueras de juego, atajadas) + pocos goles.
    const r = registroConGoles064(4, () => [
      ...Array.from({ length: 12 }, (_, k) => ev(100 + k * 50, "fuera_juego", k % 2 ? "local" : "visita", k % 2 ? "local-10" : "visita-9")),
      ...Array.from({ length: 10 }, (_, k) => ev(130 + k * 50, "amarilla", k % 2 ? "local" : "visita", k % 2 ? `local-${k}` : `visita-${k}`)),
      ...Array.from({ length: 10 }, (_, k) => ev(140 + k * 50, "cambio", k % 2 ? "local" : "visita", k % 2 ? "local-9" : "visita-10", { sale: k % 2 ? `local-${k}` : `visita-${k}` })),
      ...Array.from({ length: 9 }, (_, k) => [ev(160 + k * 60, "tiro", "local", "local-8", { desde: aMetros("local", 12) }), ev(161 + k * 60, "atajada", "visita", "visita-0", { receptor: "local-8" })]).flat(),
      ...Array.from({ length: 9 }, (_, k) => [ev(170 + k * 60, "tiro", "visita", "visita-8", { desde: aMetros("visita", 12) }), ev(171 + k * 60, "atajada", "local", "local-0", { receptor: "visita-8" })]).flat(),
    ]);
    const todos = hechosCronicaArena(r);
    const { hechos: sel, cabe } = seleccionCronicaArena(r);
    expect(cabe).toBe(true);
    expect(sel.length).toBeLessThanOrEqual(CRONICA_ARENA.maxHechos);
    const oblig = todos.filter((h) => h.hecho.relevancia >= COBERTURA).map((h) => h.hecho.id);
    for (const id of oblig) expect(sel.map((h) => h.hecho.id)).toContain(id);
    expect(sel.map((h) => h.hecho.id)).toEqual(todos.slice(0, sel.length).map((h) => h.hecho.id));
    expect(incumplimientosI4I5(r)).toEqual([]);
  });
  it("exceso deliberado: con tantos goles que los obligatorios no caben, cabe = false y solo quedan los obligatorios", () => {
    const r = registroConGoles064(40);
    const { hechos: sel, cabe } = seleccionCronicaArena(r);
    expect(cabe).toBe(false);
    expect(sel.every((h) => h.hecho.relevancia >= COBERTURA)).toBe(true);
    expect(caracteresEntrada(sel)).toBeGreaterThan(CRONICA_ARENA.maxCaracteresEntrada);
    expect(actaOk(r)).toEqual([]);
  });
  it("no obligatorios de sobra: se quitan los de menor relevancia hasta caber", () => {
    // Nombres de club largos (ficticios): con los 24 primeros hechos la entrada no cabe; con los obligatorios, sí.
    const r = registroConGoles064(8, () => [
      ...Array.from({ length: 6 }, (_, k) => ev(100 + k * 50, "fuera_juego", k % 2 ? "local" : "visita", k % 2 ? "local-10" : "visita-9")),
      ...Array.from({ length: 4 }, (_, k) => ev(130 + k * 50, "amarilla", k % 2 ? "local" : "visita", k % 2 ? `local-${k + 1}` : `visita-${k + 1}`)),
      ...Array.from({ length: 4 }, (_, k) => ev(140 + k * 50, "cambio", k % 2 ? "local" : "visita", k % 2 ? "local-9" : "visita-10", { sale: k % 2 ? `local-${k + 1}` : `visita-${k + 1}` })),
      ...Array.from({ length: 4 }, (_, k) => [ev(160 + k * 60, "tiro", "local", "local-8", { desde: aMetros("local", 12) }), ev(161 + k * 60, "atajada", "visita", "visita-0", { receptor: "local-8" })]).flat(),
      ...Array.from({ length: 4 }, (_, k) => [ev(170 + k * 60, "tiro", "visita", "visita-8", { motivo: "lejano", desde: aMetros("visita", 26 + k), distanciaM: 26 + k }), ev(171 + k * 60, "atajada", "local", "local-0", { receptor: "visita-8" })]).flat(),
      ev(180, "pase", "local", "local-4", { motivo: "largo", receptor: "local-10" }), ev(190, "pase", "visita", "visita-4", { motivo: "largo", receptor: "visita-9" }),
    ]);
    r.config.partido.local.nombre = "Juventud Islaverde Sur de los Montes Altos y Valles Profundos del Noroeste Lejano y las Sierras Nevadas del Poniente";
    r.config.partido.visita.nombre = "Atlético Montefrío Bajo de las Riberas Anchas y Lagunas Quietas del Sureste Remoto y los Llanos Dorados del Levante";
    const todos = hechosCronicaArena(r);
    const recortados = todos.slice(0, Math.min(todos.length, CRONICA_ARENA.maxHechos));
    expect(caracteresEntrada(recortados)).toBeGreaterThan(CRONICA_ARENA.maxCaracteresEntrada);
    const { hechos: sel, cabe } = seleccionCronicaArena(r);
    expect(cabe).toBe(true);
    expect(caracteresEntrada(sel)).toBeLessThanOrEqual(CRONICA_ARENA.maxCaracteresEntrada);
    expect(sel.length).toBeLessThan(recortados.length);
    expect(sel.length).toBeGreaterThan(todos.filter((h) => h.hecho.relevancia >= COBERTURA).length);
    // Lo que se quita es la cola de menor relevancia.
    const minSel = Math.min(...sel.map((h) => h.hecho.relevancia));
    for (const h of recortados.slice(sel.length)) expect(h.hecho.relevancia).toBeLessThanOrEqual(minSel);
    expect(SISTEMA_CRONICA_ARENA.length).toBeLessThan(CRONICA_ARENA.maxCaracteresEntrada);
  });
});
