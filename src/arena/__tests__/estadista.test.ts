// Brief 045 · Estadista determinista: cada dato contra un conteo independiente sobre los
// fixtures v1, v2 y v3. Ninguna cifra de MESA_ARENA ni TECNICA_ARENA se repite a mano.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ARENA, MESA_ARENA, TECNICA_ARENA } from "../../sim/limites";
import { crearControladorProgramado } from "../controladores";
import { ejecutarArena } from "../coordinador";
import { datosEstadista, DisparadorEstadista, intervencionEstadista, rematesPorLado, type DatoEstadista } from "../estadista";
import { crearConfigArena } from "../motor";
import type { EventoArena, RegistroArena } from "../tipos";

const fixture = (v: 1 | 2 | 3) => JSON.parse(readFileSync(`src/arena/__fixtures__/arena-reinicios-v${v}.json`, "utf8")) as RegistroArena;
const prefijo = (r: RegistroArena, tick: number): RegistroArena => ({ ...r, eventos: r.eventos.filter(e => e.tick <= tick), fotogramas: r.fotogramas.filter(f => f.tick <= tick), final: [...r.fotogramas].reverse().find(f => f.tick <= tick)! });
const dato = (datos: DatoEstadista[], tema: string) => datos.find(d => d.tema === tema);

/** Conteo independiente de «a puerta»: un remate queda abierto hasta su desenlace; otro
 * remate lo cierra sin desenlace. */
function aPuertaIndependiente(eventos: EventoArena[]) {
  const n = { local: 0, visita: 0 }; let abierto: EventoArena | null = null;
  for (const e of eventos) {
    if (e.tipo === "tiro") { abierto = e; continue; }
    if (!abierto || !["gol", "atajada", "tiro_fuera"].includes(e.tipo)) continue;
    if (e.tipo === "atajada" ? e.receptor === abierto.jugador : e.tipo === "gol" && e.lado === abierto.lado && e.jugador === abierto.jugador) n[abierto.lado]++;
    abierto = null;
  }
  return n;
}

describe("045 · datos del estadista sobre los fixtures", () => {
  for (const v of [1, 2, 3] as const) it(`v${v}: cada dato coincide con un conteo independiente`, () => {
    const r = fixture(v), tick = r.final.tick, eventos = r.eventos.filter(e => e.tick <= tick);
    const datos = datosEstadista(r, tick), L = r.config.partido.local.nombre, V = r.config.partido.visita.nombre;
    // marcador
    const goles = { local: eventos.filter(e => e.tipo === "gol" && e.lado === "local").length + r.inicial.marcador.local, visita: eventos.filter(e => e.tipo === "gol" && e.lado === "visita").length + r.inicial.marcador.visita };
    expect(dato(datos, "marcador")!.valor).toEqual(goles);
    expect(goles).toEqual(r.final.marcador);
    // reloj
    expect(dato(datos, "reloj")!.valor).toBe(Math.floor(tick * ARENA.pasoS + 1e-9));
    // remates: solo `tiro`; a puerta por desenlace
    const tiros = (l: string) => eventos.filter(e => e.tipo === "tiro" && e.lado === l).length, ap = aPuertaIndependiente(eventos);
    expect(dato(datos, "remates")!.valor).toEqual({ local: [tiros("local"), ap.local], visita: [tiros("visita"), ap.visita] });
    expect(dato(datos, "remates")!.texto_es).toContain(`${L} ${tiros("local")}`);
    // atajadas por portero
    const porteros = [...new Set(eventos.filter(e => e.tipo === "atajada").map(e => e.jugador))];
    expect(dato(datos, "atajadas")!.valor).toEqual(porteros.map(p => [p, eventos.filter(e => e.tipo === "atajada" && e.jugador === p).length]));
    // proporción de acciones y pases en la ventana
    const desde = Math.max(0, tick - MESA_ARENA.ventanaAccionesS / ARENA.pasoS);
    const ventana = eventos.filter(e => e.tick > desde), acciones = ventana.filter(e => ["pase", "recepcion", "recuperacion", "intercepcion"].includes(e.tipo));
    if (acciones.length >= MESA_ARENA.minAcciones) {
      const local = Math.round(100 * acciones.filter(e => e.lado === "local").length / acciones.length);
      expect(dato(datos, "acciones")!.valor).toEqual({ local, visita: 100 - local });
      expect(dato(datos, "acciones")!.texto_es).toContain("proporción de acciones".replace("p", "P"));
      expect(dato(datos, "acciones")!.texto_es).not.toMatch(/posesi/i);
    } else expect(dato(datos, "acciones")).toBeUndefined();
    const pases = ventana.filter(e => e.tipo === "pase");
    if (pases.length >= MESA_ARENA.minAcciones) expect(dato(datos, "pases")!.valor).toBe(Math.round(pases.reduce((s, e) => s + e.distanciaM, 0) / pases.length));
    else expect(dato(datos, "pases")).toBeUndefined();
    // faltas, amarillas y rojas
    const c = (tipo: string, lado: string) => eventos.filter(e => e.tipo === tipo && e.lado === lado).length;
    expect(dato(datos, "faltas")!.valor).toEqual({ local: { faltas: c("falta", "local"), amarillas: c("amarilla", "local"), rojas: c("roja", "local") }, visita: { faltas: c("falta", "visita"), amarillas: c("amarilla", "visita"), rojas: c("roja", "visita") } });
    // cambios: contadores del entrenador en el último fotograma
    const e = r.final.entrenadores!;
    expect(dato(datos, "cambios")!.valor).toEqual({
      local: { usados: e.local.cambios, ventanas: e.local.ventanas, restantes: TECNICA_ARENA.maxCambios - e.local.cambios, ventanasRestantes: TECNICA_ARENA.maxVentanas - e.local.ventanas },
      visita: { usados: e.visita.cambios, ventanas: e.visita.ventanas, restantes: TECNICA_ARENA.maxCambios - e.visita.cambios, ventanasRestantes: TECNICA_ARENA.maxVentanas - e.visita.ventanas },
    });
    expect(dato(datos, "cambios")!.evidencia).toMatchObject({ eventos: eventos.filter(x => x.tipo === "cambio").map(x => x.id), fuente: `fotograma:${r.final.tick}` });
    // reinicios por tipo
    const reinicios = eventos.filter(x => x.tipo === "reinicio");
    expect((dato(datos, "reinicios")!.valor as [string, number][]).reduce((s, [, n]) => s + n, 0)).toBe(reinicios.length);
    expect(V).toBeTruthy();
  });

  it("un desvío pre-v3 con tiro_fuera posterior es un remate, y a puerta", () => {
    for (const v of [1, 2] as const) {
      const r = fixture(v), desvio = r.eventos.find(e => e.motivo === "desvio")!, i = r.eventos.indexOf(desvio);
      const fuera = r.eventos[i + 1]!; expect(fuera.tipo).toBe("tiro_fuera"); // el duplicado documentado en el 044
      const remate = r.eventos.slice(0, i).reverse().find(e => e.tipo === "tiro")!;
      const antes = r.eventos.filter(e => e.tick < remate.tick && e.tipo === "tiro" && e.lado === remate.lado).length;
      const res = rematesPorLado(r.eventos, fuera.tick)[remate.lado];
      expect(res.total).toBe(antes + 1);
      expect(res.aPuerta).toBe(aPuertaIndependiente(r.eventos.filter(e => e.tick <= fuera.tick))[remate.lado]);
      expect(res.eventos).toContain(desvio.id); expect(res.eventos).not.toContain(fuera.id);
    }
  });

  it("«a puerta» asocia la atajada por receptor, con remates de ambos lados seguidos", () => {
    const r = fixture(3), base = r.eventos[0]!;
    const ev = (id: string, tick: number, tipo: EventoArena["tipo"], lado: EventoArena["lado"], jugador: string, receptor: string | null = null): EventoArena => ({ ...base, id, tick, tipo, lado, jugador, receptor });
    // Remate local cortado por un remate visitante; la atajada (lado del portero local) es del visitante.
    const eventos = [ev("t1", 10, "tiro", "local", "local-9"), ev("t2", 12, "tiro", "visita", "visita-9"), ev("s1", 14, "atajada", "local", "local-0", "visita-9"),
      ev("t3", 20, "tiro", "local", "local-10"), ev("s2", 22, "atajada", "visita", "visita-0", "local-10"),
      ev("t4", 30, "tiro", "visita", "visita-8"), ev("s3", 32, "atajada", "local", "local-0", "visita-7")];
    const res = rematesPorLado(eventos, 40);
    expect(res.local).toMatchObject({ total: 2, aPuerta: 1 });
    expect(res.visita).toMatchObject({ total: 2, aPuerta: 1 });
    expect(aPuertaIndependiente(eventos)).toEqual({ local: res.local.aPuerta, visita: res.visita.aPuerta });
  });

  it("cambios lee los contadores del entrenador, no los eventos", () => {
    const r = structuredClone(fixture(3)), tick = r.final.tick;
    const ultimo = [...r.fotogramas].reverse().find(f => f.tick <= tick)!;
    ultimo.entrenadores!.local.cambios = TECNICA_ARENA.maxCambios; ultimo.entrenadores!.local.ventanas = TECNICA_ARENA.maxVentanas;
    const c = dato(datosEstadista(r, tick), "cambios")!;
    expect((c.valor as { local: { usados: number; restantes: number; ventanasRestantes: number } }).local).toMatchObject({ usados: TECNICA_ARENA.maxCambios, restantes: 0, ventanasRestantes: 0 });
    expect(c.evidencia.eventos.length).toBeLessThan(TECNICA_ARENA.maxCambios);
    const sinEntrenadores = structuredClone(fixture(3)); for (const f of sinEntrenadores.fotogramas) delete f.entrenadores;
    expect(dato(datosEstadista(sinEntrenadores, tick), "cambios")).toBeUndefined();
  });

  it("cada dato lista su evidencia: eventos de la fórmula o intervalo y fuente", () => {
    for (const v of [1, 2, 3] as const) {
      const r = fixture(v);
      for (const tick of [0, 100, 200, r.final.tick]) for (const d of datosEstadista(r, tick)) {
        expect(d.evidencia.eventos.length > 0 || !!d.evidencia.intervalo && !!d.evidencia.fuente).toBe(true);
        const conocidos = new Set(r.eventos.filter(e => e.tick <= tick).map(e => e.id));
        expect(d.evidencia.eventos.every(id => conocidos.has(id))).toBe(true);
        expect(d.hecho.eventos).toEqual(d.evidencia.eventos);
      }
      const d = datosEstadista(r, r.final.tick);
      // Los conteos con eventos citan exactamente los eventos que entran en la fórmula.
      expect(dato(d, "marcador")!.evidencia.eventos).toEqual(r.eventos.filter(e => e.tipo === "gol").map(e => e.id));
      expect(dato(d, "marcador")!.evidencia).toMatchObject({ intervalo: [0, r.final.tick], fuente: "inicial" });
      expect(dato(d, "reloj")!.evidencia).toMatchObject({ eventos: [], intervalo: [r.final.tick, r.final.tick], fuente: `fotograma:${r.final.tick}` });
      expect(dato(d, "remates")!.evidencia.eventos.filter(id => r.eventos.find(e => e.id === id)!.tipo === "tiro")).toEqual(r.eventos.filter(e => e.tipo === "tiro").map(e => e.id));
    }
  });

  it("con menos de minAcciones no hay proporción de acciones ni media de pases", () => {
    const r = structuredClone(fixture(3)), tick = r.final.tick;
    const accion = r.eventos.find(e => e.tipo === "pase")!;
    r.eventos = [...r.eventos.filter(e => !["pase", "recepcion", "recuperacion", "intercepcion"].includes(e.tipo)), ...Array.from({ length: MESA_ARENA.minAcciones - 1 }, (_, i) => ({ ...accion, id: `p${i}`, tick: tick - i }))].sort((a, b) => a.tick - b.tick);
    const datos = datosEstadista(r, tick);
    expect(dato(datos, "acciones")).toBeUndefined(); expect(dato(datos, "pases")).toBeUndefined();
    r.eventos.push({ ...accion, id: "pmas", tick });
    expect(dato(datosEstadista(r, tick), "acciones")).toBeDefined(); expect(dato(datosEstadista(r, tick), "pases")).toBeDefined();
  });

  it("solo usa el prefijo publicado: el futuro no cambia los datos de un instante", () => {
    const r = fixture(3);
    for (const tick of [100, 250]) expect(datosEstadista(prefijo(r, tick), tick)).toEqual(datosEstadista(r, tick));
  });
});

describe("045 · candidaturas del estadista", () => {
  const cada = Math.round(MESA_ARENA.estadistaCadaS / ARENA.pasoS);
  it("un valor sin cambio no produce candidatura y el temporizador se rearma", () => {
    const r = fixture(3), fijos = datosEstadista(r, r.final.tick).filter(d => d.tema !== "reloj");
    const disparador = new DisparadorEstadista(() => fijos);
    expect(disparador.evaluar(r, cada - 1)).toBeNull();
    expect(disparador.ultimaCandidaturaTick).toBe(0); // antes del vencimiento no se rearma
    const primera = disparador.evaluar(r, cada)!;
    expect(primera.oraciones).toHaveLength(MESA_ARENA.maxDatosEstadista);
    expect(primera.id).toBe(`estadista:${fijos.slice(0, MESA_ARENA.maxDatosEstadista).map(d => d.tema).join("+")}:${cada}`);
    // Los datos no emitidos todavía son nuevos; después ya nada cambió.
    let tick = cada, emitidos = primera.oraciones.length;
    while (emitidos < fijos.length) { tick += cada; emitidos += disparador.evaluar(r, tick)!.oraciones.length; }
    tick += cada;
    expect(disparador.evaluar(r, tick)).toBeNull();
    expect(disparador.ultimaCandidaturaTick).toBe(tick);
    expect(disparador.evaluar(r, tick + cada - 1)).toBeNull();
    expect(disparador.ultimaCandidaturaTick).toBe(tick);
    // Al cambiar un valor vuelve a emitirse ese tema, y solo ese.
    const cambiado = fijos.map(d => d.tema === "marcador" ? { ...d, valor: { local: 9, visita: 9 } } : d);
    const otro = new DisparadorEstadista(() => cambiado); (otro as unknown as { ultimos: Map<string, string> }).ultimos = new Map(fijos.map(d => [d.tema, JSON.stringify(d.valor)]));
    expect(otro.evaluar(r, cada)!.tema).toBe("marcador");
  });

  it("con datos reales: orden de la tabla, máximo por candidatura y una final en el último tick", () => {
    const r = fixture(3), disparador = new DisparadorEstadista(), vistas: string[][] = [];
    for (const f of r.fotogramas) { const i = disparador.evaluar(prefijo(r, f.tick), f.tick); if (i) vistas.push(i.tema.split("+")); }
    const final = disparador.evaluar(r, r.final.tick, true);
    if (final) vistas.push(final.tema.split("+"));
    expect(vistas.length).toBeGreaterThan(0);
    for (const temas of vistas) expect(temas.length).toBeLessThanOrEqual(MESA_ARENA.maxDatosEstadista);
    expect(vistas[0]![0]).toBe("marcador");
    // El marcador no se repite mientras no cambie.
    const golesTicks = r.eventos.filter(e => e.tipo === "gol").length;
    expect(vistas.filter(t => t.includes("marcador")).length).toBeLessThanOrEqual(golesTicks + 1);
    expect(disparador.evaluar(r, r.final.tick, true)).toBeNull();
  });
});

// v3.1 · Partidos programados para las pruebas de plazas y longitudes (script `temas` del auditor).
const SEMILLAS = 20, DURACION_S = 120;
const partidos = await Promise.all(Array.from({ length: SEMILLAS }, (_, i) => ejecutarArena(crearConfigArena({ seed: i + 1, duracionS: DURACION_S }), { local: crearControladorProgramado(), visita: crearControladorProgramado() })));

describe("045 v3.1 · correcciones del estadista", () => {
  it("C1 · cada texto de dato (ES y EN) cabe en maxCaracteresOracion: fixtures v1–v3 y 20 semillas × 120 s", () => {
    const cada = Math.round(MESA_ARENA.estadistaCadaS / ARENA.pasoS);
    let revisados = 0;
    const revisar = (r: RegistroArena, tick: number) => {
      for (const d of datosEstadista(prefijo(r, tick), tick)) {
        revisados++;
        expect(d.texto_es.length, `${d.tema}@${tick}: ${d.texto_es}`).toBeLessThanOrEqual(MESA_ARENA.maxCaracteresOracion);
        expect(d.texto_en.length, `${d.tema}@${tick}: ${d.texto_en}`).toBeLessThanOrEqual(MESA_ARENA.maxCaracteresOracion);
      }
    };
    for (const v of [1, 2, 3] as const) { const r = fixture(v); for (const f of r.fotogramas) revisar(r, f.tick); }
    for (const r of partidos) {
      for (let tick = cada; tick < r.final.tick; tick += cada) revisar(r, tick);
      revisar(r, r.final.tick);
    }
    expect(revisados).toBeGreaterThan(0);
  });

  it("C3 · el reloj no ocupa plaza: ninguna candidatura lo contiene, remates aparece y la primera de cada partido llena las plazas", () => {
    let conRemates = 0;
    for (const r of partidos) {
      const disparador = new DisparadorEstadista(), candidaturas: string[][] = [];
      for (const f of r.fotogramas) { const i = disparador.evaluar(prefijo(r, f.tick), f.tick); if (i) candidaturas.push(i.tema.split("+")); }
      const final = disparador.evaluar(r, r.final.tick, true); if (final) candidaturas.push(final.tema.split("+"));
      expect(candidaturas.length).toBeGreaterThan(0);
      expect(candidaturas[0]).toHaveLength(MESA_ARENA.maxDatosEstadista);
      for (const temas of candidaturas) expect(temas).not.toContain("reloj");
      if (candidaturas.some(t => t.includes("remates"))) conRemates++;
    }
    expect(conRemates).toBeGreaterThan(0);
  });

  it("C3 · el reloj sigue disponible como hecho de apoyo, sin plaza; intervencionEstadista lanza con un dato sin plaza", () => {
    const datos = datosEstadista(fixture(3), 100), reloj = dato(datos, "reloj")!;
    expect(reloj.ocupaPlaza).toBe(false);
    expect(reloj.hecho.id).toBe("estadista:reloj:100");
    expect(datos.filter(d => d.tema !== "reloj").every(d => d.ocupaPlaza)).toBe(true);
    expect(() => intervencionEstadista([reloj], 100)).toThrow();
    expect(() => intervencionEstadista([datos[0]!, reloj], 100)).toThrow();
    expect(intervencionEstadista([datos[0]!], 100).tema).toBe(datos[0]!.tema);
  });

  it("C12b · reinicios: el valor coincide por tipo con un conteo independiente; algún fixture tiene dos tipos", () => {
    let tiposMax = 0;
    for (const v of [1, 2, 3] as const) {
      const r = fixture(v), tick = r.final.tick, conteo: Record<string, number> = {};
      for (const e of r.eventos) {
        if (e.tipo !== "reinicio" || e.tick > tick) continue;
        // Registros pre-v3 sin `reinicio`: tras falta, la reanudación tras falta; si no, del portero.
        const tipo = e.reinicio ? e.reinicio : e.motivo === "falta" ? "falta" : "portero";
        conteo[tipo] = (conteo[tipo] ?? 0) + 1;
      }
      expect(Object.fromEntries(dato(datosEstadista(r, tick), "reinicios")!.valor as [string, number][])).toEqual(conteo);
      tiposMax = Math.max(tiposMax, Object.keys(conteo).length);
    }
    expect(tiposMax).toBeGreaterThanOrEqual(2);
  });

  it("C12c · «a puerta» exige el mismo jugador en el gol", () => {
    const base = fixture(3).eventos[0]!;
    const ev = (id: string, tick: number, tipo: EventoArena["tipo"], jugador: string): EventoArena => ({ ...base, id, tick, tipo, lado: "local", jugador, receptor: null });
    expect(rematesPorLado([ev("t1", 10, "tiro", "local-9"), ev("g1", 12, "gol", "local-10")], 20).local).toMatchObject({ total: 1, aPuerta: 0 });
    expect(rematesPorLado([ev("t1", 10, "tiro", "local-9"), ev("g1", 12, "gol", "local-9")], 20).local).toMatchObject({ total: 1, aPuerta: 1 });
  });
});
