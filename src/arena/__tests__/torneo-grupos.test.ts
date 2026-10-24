// Brief 062 § 3 + § 17.4 · Funciones puras del formato Grupos + eliminatoria (P1-b, sin exponer: el servidor solo
// admite la liga). G1–G7 y la parte de grupos de G8, con fixtures construidos a mano en TS sobre los 6 ids del torneo
// del 24 oct y la semilla 20261025. Los vectores literales son los de § 17.4; los resultados de los fixtures se
// eligieron a mano para que cada criterio decida (y para que su mutación cambie el ganador).
import { describe, expect, it } from "vitest";
import { ARENA, TORNEO_ARENA as T, TORNEO_SITIO as S } from "../../sim/limites";
import { claveCruce, esquemaTorneo062, semillasCruce, validarCoherencia, type CifrasLado, type EncuentroTorneo062, type Torneo062 } from "../torneo";
import {
  barajar, campeon, clasificarGrupo, cuadro, ordenGrupo, planGrupos, planTorneo, resolverLlave, siguientePartido, sorteoGrupos, sorteoSubconjunto, u32,
  type EncuentroPlan062, type ResultadosPlan,
} from "../torneo-formatos";
import entradasJson from "../torneo-sitio-entradas.json";

const PARTICIPANTES = (entradasJson as { participantes: Torneo062["participantes"] }).participantes;
const IDS = PARTICIPANTES.map(p => p.id), SEM = 20261025;
type C = { rd?: number | null; r?: number | null };
type Res = [number, number, C?, C?];
const cifras = (c: C = {}): CifrasLado => ({ posesionPct: null, remates: c.r === undefined ? 0 : c.r, rematesDirectos: c.rd === undefined ? 0 : c.rd, pasesCompletados: null, pasesIntentados: null, recuperaciones: null });
const partido = (p: EncuentroPlan062, [gl, gv, cl, cv]: Res) => ({ n: p.n, local: { participante: p.local, goles: gl, cifras: cifras(cl) }, visita: { participante: p.visita, goles: gv, cifras: cifras(cv) } }) as unknown as EncuentroTorneo062;
/** Juega el plan en orden con los resultados dados (por n); se detiene en el primero sin resultado. */
function jugar(resultados: Record<number, Res>, pendientes: number[] = [], semilla = SEM): ResultadosPlan & { plan: EncuentroPlan062[]; encuentros: EncuentroTorneo062[]; pendientes: number[] } {
  const encuentros: EncuentroTorneo062[] = [], pend: number[] = [];
  for (let i = 0; i < 40; i++) {
    const sig = siguientePartido("grupos", IDS, semilla, { encuentros, pendientes: pend });
    if (!sig) break;
    if (pendientes.includes(sig.n)) { pend.push(sig.n); continue; }
    const r = resultados[sig.n];
    if (!r) break;
    encuentros.push(partido(sig, r));
  }
  return { encuentros, pendientes: pend, plan: planTorneo("grupos", IDS, semilla, { encuentros, pendientes: pend }) };
}
const contexto = (encuentros: EncuentroTorneo062[]) => ({ participantes: PARTICIPANTES, semilla: SEM, encuentros });

// Con la semilla 20261025: A = [sol61, sol6, equilibrado], B = [rapido, luna6, astra6] (vector de § 17.4).
// F1 · Sin empates; B es el espejo de A: sol61 y rapido 12 pts (7:0), sol6 y luna6 6 pts (3:3), equilibrado y astra6 0.
const F1: Record<number, Res> = {
  1: [2, 0], 2: [2, 0], 3: [0, 1], 4: [0, 1], 5: [1, 0], 6: [1, 0], 7: [0, 1], 8: [0, 1], 9: [3, 0], 10: [3, 0], 11: [0, 2], 12: [0, 2],
};
// F3 · sol6 2.º de A con 6 pts (6:3); rapido 1.º de B con 6 pts (1:0); astra6 2.º de B.
const F3: Record<number, Res> = {
  1: [2, 0], 3: [0, 1], 5: [3, 0], 7: [0, 1], 9: [3, 0], 11: [0, 3], 2: [1, 0], 4: [0, 0], 6: [0, 0], 8: [0, 0], 10: [0, 0], 12: [0, 0],
};

describe("062 · G1 · sorteo de grupos (D1, § 17.4)", () => {
  it("vectores literales de § 17.4 con las semillas 20261025, 20261026 y 0", () => {
    expect(sorteoGrupos(IDS, 20261025)).toEqual({ A: ["sol61", "sol6", "equilibrado"], B: ["rapido", "luna6", "astra6"] });
    expect(sorteoGrupos(IDS, 20261026)).toEqual({ A: ["sol6", "astra6", "rapido"], B: ["sol61", "equilibrado", "luna6"] });
    expect(sorteoGrupos(IDS, 0)).toEqual({ A: ["astra6", "rapido", "sol61"], B: ["equilibrado", "luna6", "sol6"] });
  });
  it("3 + 3, los 6 usados, determinista e independiente del orden de entrada; las 10 particiones aparecen con 0–999", () => {
    const g = sorteoGrupos(IDS, SEM);
    expect([g.A.length, g.B.length]).toEqual([S.formatos.grupos.porGrupo, S.formatos.grupos.porGrupo]);
    expect([...g.A, ...g.B].sort()).toEqual([...IDS].sort());
    expect(sorteoGrupos([...IDS].reverse(), SEM)).toEqual(g);
    expect(sorteoGrupos([IDS[3]!, IDS[0]!, IDS[5]!, IDS[1]!, IDS[4]!, IDS[2]!], SEM)).toEqual(g);
    const particiones = new Set<string>();
    for (let s = 0; s < 1000; s++) { const x = sorteoGrupos(IDS, s); particiones.add([[...x.A].sort().join(","), [...x.B].sort().join(",")].sort().join(" / ")); }
    expect(particiones.size).toBe(10);
  });
  it("sorteo de un subconjunto: vectores de § 17.4, igual con la entrada permutada; u32 y semillasCruce", () => {
    expect(sorteoSubconjunto(["sol61", "sol6", "equilibrado"], SEM, "grupo-A")).toEqual(["equilibrado", "sol61", "sol6"]);
    expect(sorteoSubconjunto(["equilibrado", "sol6", "sol61"], SEM, "grupo-A")).toEqual(["equilibrado", "sol61", "sol6"]);
    expect(sorteoSubconjunto(["sol6", "sol61"], SEM, "grupo-A")).toEqual(["sol6", "sol61"]);
    expect(sorteoSubconjunto(["astra6", "sol61"], SEM, "final")).toEqual(["astra6", "sol61"]);
    expect(semillasCruce(IDS, SEM).get(claveCruce("astra6", "sol6"))).toBe(897463770);
    expect(u32(SEM, `torneo-062:ko:semifinal-1:${claveCruce("luna6", "sol61")}`)).toBe(661284285);
    expect(u32(SEM, `torneo-062:ko:semifinal-1:${claveCruce("astra6", "sol6")}`)).toBe(2833494293);
    expect(barajar(["b", "a"], SEM, "x")).toEqual(barajar(["a", "b"], SEM, "x"));
  });
});

describe("062 · G2 · plan de la fase de grupos (D4, D8)", () => {
  const plan = planGrupos(IDS, SEM), { A, B } = sorteoGrupos(IDS, SEM);
  it("la tabla intercalada literal de D4 (fase, local y visita por índice), jornadas, cruces y vuelta", () => {
    const g = (G: "A" | "B", i: number) => (G === "A" ? A : B)[i - 1]!;
    const D4: ["A" | "B", number, number][] = [["A", 1, 2], ["B", 1, 2], ["A", 3, 1], ["B", 3, 1], ["A", 2, 3], ["B", 2, 3], ["A", 2, 1], ["B", 2, 1], ["A", 1, 3], ["B", 1, 3], ["A", 3, 2], ["B", 3, 2]];
    expect(plan.map(p => [p.n, p.fase, p.local, p.visita])).toEqual(D4.map(([G, x, y], i) => [i + 1, `grupo-${G}`, g(G, x), g(G, y)]));
    expect(plan.map(p => p.jornada)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
    expect(plan.map(p => p.cruce)).toEqual([1, 4, 2, 5, 3, 6, 1, 4, 2, 5, 3, 6]);
    expect(plan.map(p => p.vuelta)).toEqual([false, false, false, false, false, false, true, true, true, true, true, true]);
    expect(plan.every(p => !p.desempate)).toBe(true);
  });
  it("cada pareja juega dos veces con los lados invertidos y la MISMA semilla (la de semillasCruce sobre los 6); semillas únicas", () => {
    const todas = semillasCruce(IDS, SEM);
    for (const p of plan.slice(0, 6)) {
      const v = plan.find(x => x.vuelta && x.local === p.visita && x.visita === p.local)!;
      expect(v.seed).toBe(p.seed);
      expect(p.seed).toBe(todas.get(claveCruce(p.local, p.visita)));
    }
    expect(new Set(plan.slice(0, 6).map(p => p.seed)).size).toBe(6);
  });
  it("colisión inyectada: dos cruces de grupos distintos con la misma semilla derivada ⇒ siguen siendo únicas (semillasCruce sobre los 6)", () => {
    // Encontrados por búsqueda (semilla 1): c61|c573 (grupo A) y c91|c99 (grupo B) derivan los dos 4122824158.
    const ids = ["c61", "c573", "a", "c91", "c99", "d"], g = sorteoGrupos(ids, 1);
    expect(g).toEqual({ A: ["c61", "a", "c573"], B: ["c99", "d", "c91"] });
    expect(semillasCruce(["c61", "c573"], 1).get(claveCruce("c61", "c573"))).toBe(semillasCruce(["c91", "c99"], 1).get(claveCruce("c91", "c99")));
    const p = planGrupos(ids, 1);
    expect(new Set(p.slice(0, 6).map(x => x.seed)).size).toBe(6);
  });
});

describe("062 · G3 · clasificarGrupo usa solo los partidos de su grupo", () => {
  it("con las llaves ya jugadas, cada miembro sigue con 4 partidos y los puntos del grupo", () => {
    const { encuentros } = jugar({ ...F1, 13: [2, 1], 14: [0, 1], 15: [1, 0] });
    expect(encuentros).toHaveLength(15);
    const a = clasificarGrupo(contexto(encuentros), "A");
    expect(a.map(f => [f.id, f.pj, f.pts, f.gf, f.gc])).toEqual([["sol61", 4, 12, 7, 0], ["sol6", 4, 6, 3, 3], ["equilibrado", 4, 0, 0, 7]]);
    expect(clasificarGrupo(contexto(encuentros), "B").map(f => f.id)).toEqual(["rapido", "luna6", "astra6"]);
  });
});

describe("062 · G4 · orden estricto de un grupo (D6, § 17.4)", () => {
  const empateA = (cA: Record<number, [C, C]>) => {
    const r: Record<number, Res> = { ...F1 };
    for (const n of [1, 3, 5, 7, 9, 11]) r[n] = [0, 0, ...(cA[n] ?? [{}, {}])];
    return jugar(r).encuentros;
  };
  it("sin empates: el orden de clasificar y el criterio «resultado»", () => {
    expect(ordenGrupo(contexto(jugar(F1).encuentros), "A")).toEqual([{ id: "sol61", criterio: "resultado" }, { id: "sol6", criterio: "resultado" }, { id: "equilibrado", criterio: "resultado" }]);
  });
  it("tres 0–0: remates directos separan a uno; los otros dos, iguales en remates, van al sorteo del subconjunto", () => {
    // equilibrado suma 5 remates directos; sol6 y sol61, 3 cada uno; todos 4 remates por partido.
    const r = 4;
    // P1 sol61–sol6, P3 equilibrado–sol61, P5 sol6–equilibrado, P7 sol6–sol61, P9 sol61–equilibrado, P11 equilibrado–sol6.
    const enc = empateA({ 1: [{ rd: 1, r }, { rd: 1, r }], 3: [{ rd: 2, r }, { rd: 1, r }], 5: [{ rd: 1, r }, { rd: 1, r }], 7: [{ rd: 1, r }, { rd: 1, r }], 9: [{ rd: 0, r }, { rd: 1, r }], 11: [{ rd: 1, r }, { rd: 0, r }] });
    expect(ordenGrupo(contexto(enc), "A")).toEqual([{ id: "equilibrado", criterio: "remates_directos" }, { id: "sol6", criterio: "sorteo" }, { id: "sol61", criterio: "sorteo" }]);
  });
  it("tres 0–0 sin nada que los separe ⇒ sorteo de los tres (vector de § 17.4)", () => {
    expect(ordenGrupo(contexto(empateA({})), "A")).toEqual([{ id: "equilibrado", criterio: "sorteo" }, { id: "sol61", criterio: "sorteo" }, { id: "sol6", criterio: "sorteo" }]);
  });
  it("remates directos iguales y remates distintos ⇒ «remates»; una cifra null salta el criterio", () => {
    const enc = empateA({ 1: [{ r: 9 }, { r: 2 }], 3: [{ r: 1 }, { r: 3 }], 5: [{ r: 2 }, { r: 2 }], 7: [{ r: 2 }, { r: 2 }], 9: [{ r: 2 }, { r: 2 }], 11: [{ r: 2 }, { r: 2 }] });
    // sol61: 9+3+2+2 = 16; sol6: 2+2+2+2 = 8; equilibrado: 1+2+2+2 = 7.
    expect(ordenGrupo(contexto(enc), "A")).toEqual([{ id: "sol61", criterio: "remates" }, { id: "sol6", criterio: "remates" }, { id: "equilibrado", criterio: "remates" }]);
    const conNull = empateA({ 1: [{ rd: null, r: 9 }, { rd: 5, r: 2 }], 3: [{ rd: 9, r: 1 }, { r: 3 }], 5: [{ r: 2 }, { r: 2 }], 7: [{ r: 2 }, { r: 2 }], 9: [{ r: 2 }, { r: 2 }], 11: [{ r: 2 }, { r: 2 }] });
    expect(ordenGrupo(contexto(conNull), "A").map(x => [x.id, x.criterio])).toEqual([["sol61", "remates"], ["sol6", "remates"], ["equilibrado", "remates"]]);
  });
});

describe("062 · G5 · cuadro (D7)", () => {
  it("semifinal 1 = 1A–2B y semifinal 2 = 1B–2A con el 1.º de local; la final con el ganador de la semifinal 1 de local", () => {
    const t = jugar({ ...F1, 13: [2, 1], 14: [0, 1], 15: [1, 0] });
    const llaves = cuadro({ participantes: PARTICIPANTES, semilla: SEM, ...t });
    expect(llaves.map(l => [l.fase, l.local, l.visita, l.ganador, l.criterio])).toEqual([
      ["semifinal-1", "sol61", "luna6", "sol61", "resultado"], ["semifinal-2", "rapido", "sol6", "sol6", "resultado"], ["final", "sol61", "sol6", "sol61", "resultado"],
    ]);
    expect(campeon({ participantes: PARTICIPANTES, semilla: SEM, ...t })).toBe("sol61");
    expect(t.plan.slice(12).map(p => [p.n, p.jornada, p.cruce, p.vuelta])).toEqual([[13, 7, 7, false], [14, 7, 8, false], [15, 8, 9, false]]);
  });
});

describe("062 · G6 · desempate de una llave (D5, § 17.4)", () => {
  const p = (n: number, local: string, visita: string) => ({ n, local, visita }) as EncuentroPlan062;
  const t1 = contexto(jugar(F1).encuentros), t3 = contexto(jugar(F3).encuentros);
  it("empate ⇒ desempate con la MISMA semilla y los lados invertidos; si se gana, pasa; nunca un segundo desempate", () => {
    const t = jugar({ ...F1, 13: [1, 1], 14: [2, 1], 15: [0, 0], 16: [0, 0], 17: [0, 0], 18: [0, 0] });
    const [sf1, des1, sf2, des2, fin, des3] = t.plan.slice(12);
    expect([des1!.desempate, des1!.seed, des1!.local, des1!.visita, des1!.fase]).toEqual([true, sf1!.seed, sf1!.visita, sf1!.local, "semifinal-1"]);
    expect([sf2!.fase, sf2!.desempate, des2!.desempate, fin!.fase, des3!.desempate]).toEqual(["semifinal-2", false, true, "final", true]);
    expect(t.plan).toHaveLength(18);
    expect(siguientePartido("grupos", IDS, SEM, t)).toBeNull();
    const llaves = cuadro({ participantes: PARTICIPANTES, semilla: SEM, ...t });
    // La semifinal 1 la gana el visitante del primer partido (local en el desempate).
    expect([llaves[0]!.ganador, llaves[0]!.criterio, llaves[0]!.partidos]).toEqual(["luna6", "desempate", [13, 14]]);
    expect(llaves.every(l => l.ganador)).toBe(true);
    // Semillas únicas por cruce en el torneo: 6 de grupos (ida y vuelta comparten) + 3 llaves.
    expect(new Set(t.plan.filter(x => !x.desempate).map(x => x.seed)).size).toBe(6 + 3);
  });
  it("0–0 y 1–1 ⇒ remates directos sumados sobre los DOS partidos con los lados invertidos", () => {
    // Solo en el desempate ganaría luna6 (3 a 1); sobre los dos, sol61 (5 + 1 = 6 a 0 + 3 = 3).
    const r = resolverLlave(t1, "semifinal-1", "sol61", "luna6", [partido(p(13, "sol61", "luna6"), [0, 0, { rd: 5 }, { rd: 0 }]), partido(p(14, "luna6", "sol61"), [1, 1, { rd: 3 }, { rd: 1 }])]);
    expect(r).toEqual({ ganador: "sol61", criterio: "remates_directos", detalle: { criterio: "remates_directos", a: [6], b: [3] } });
  });
  it("remates directos iguales ⇒ remates", () => {
    const r = resolverLlave(t1, "semifinal-1", "sol61", "luna6", [partido(p(13, "sol61", "luna6"), [0, 0, { rd: 2, r: 4 }, { rd: 2, r: 9 }]), partido(p(14, "luna6", "sol61"), [0, 0, { rd: 1, r: 1 }, { rd: 1, r: 3 }])]);
    expect(r).toEqual({ ganador: "luna6", criterio: "remates", detalle: { criterio: "remates", a: [7], b: [10] } });
  });
  it("remates directos y remates iguales ⇒ coeficiente de grupo (pts, DG, GF)", () => {
    const r = resolverLlave(t3, "semifinal-2", "rapido", "sol6", [partido(p(15, "rapido", "sol6"), [0, 0]), partido(p(16, "sol6", "rapido"), [0, 0])]);
    expect(r).toEqual({ ganador: "sol6", criterio: "coeficiente", detalle: { criterio: "coeficiente", a: [6, 1, 1], b: [6, 3, 6] } });
    expect(sorteoSubconjunto(["rapido", "sol6"], SEM, "semifinal-2")[0]).toBe("rapido"); // el sorteo habría elegido al otro
  });
  it("todo igual (coeficiente incluido) ⇒ sorteo por semilla, rotulado", () => {
    const r = resolverLlave(t1, "final", "rapido", "sol61", [partido(p(17, "rapido", "sol61"), [1, 1]), partido(p(18, "sol61", "rapido"), [2, 2])]);
    expect(r).toEqual({ ganador: sorteoSubconjunto(["rapido", "sol61"], SEM, "final")[0], criterio: "sorteo", detalle: null });
    expect(r.ganador).toBe("sol61");
  });
  it("una cifra null en un partido salta ese criterio", () => {
    const r = resolverLlave(t1, "semifinal-1", "sol61", "luna6", [partido(p(13, "sol61", "luna6"), [0, 0, { rd: null, r: 1 }, { rd: 9, r: 5 }]), partido(p(14, "luna6", "sol61"), [0, 0, { rd: 0, r: 0 }, { rd: 0, r: 0 }])]);
    expect([r.ganador, r.criterio]).toEqual(["luna6", "remates"]);
  });
  it("las semillas de las llaves: u32 de la fase y la pareja; el desempate la comparte", () => {
    const t = jugar({ ...F1, 13: [1, 1], 14: [2, 1] });
    expect(t.plan[12]!.seed).toBe(u32(SEM, `torneo-062:ko:semifinal-1:${claveCruce("sol61", "luna6")}`));
    expect(t.plan[13]!.seed).toBe(t.plan[12]!.seed);
  });
});

describe("062 · G7 · plan de grupos y siguiente partido", () => {
  it("sin resultados: los 12 de grupos; con los grupos completos: 13 = semifinal 1; numeración 15–18", () => {
    expect(planTorneo("grupos", IDS, SEM, { encuentros: [], pendientes: [] })).toHaveLength(12);
    const g = jugar(F1);
    expect(g.plan.map(p => p.fase).slice(12)).toEqual(["semifinal-1"]);
    expect(jugar({ ...F1, 13: [2, 1], 14: [0, 1], 15: [1, 0] }).plan).toHaveLength(15);
    expect(jugar({ ...F1, 13: [1, 1], 14: [2, 1], 15: [0, 0], 16: [0, 0], 17: [0, 0], 18: [0, 0] }).plan).toHaveLength(18);
  });
  it("un pendiente en la fase de grupos ⇒ sin cuadro: el torneo termina al acabar los 12", () => {
    const t = jugar(F1, [5]);
    expect(t.pendientes).toEqual([5]);
    expect(t.encuentros).toHaveLength(11);
    expect(t.plan).toHaveLength(12);
    expect(siguientePartido("grupos", IDS, SEM, t)).toBeNull();
  });
  it("un pendiente en una llave ⇒ el plan se detiene ahí", () => {
    const t = jugar({ ...F1 }, [13]);
    expect(t.plan).toHaveLength(13);
    expect(siguientePartido("grupos", IDS, SEM, t)).toBeNull();
  });
});

describe("062 · G8 (grupos) · coherencia contra el plan reconstruido", () => {
  /** Un torneo 062 de grupos válido por esquema a partir de los resultados (cifras y declarado mínimos). */
  function torneo(resultados: Record<number, Res>): Torneo062 {
    const t = jugar(resultados), plan = t.plan;
    const declarado = { tiemposMs: [1], llamadas: [1], motivos: ["valida" as const], intentos: [], esperas: [], entrada: 0, salida: 0, cache: 0, sinUso: 0, costoMicroUsd: 0, modelosDevueltos: [] };
    const encuentros = t.encuentros.map((e, i) => {
      const p = plan[e.n - 1]!;
      return { n: e.n, jornada: p.jornada, cruce: p.cruce, vuelta: p.vuelta, seed: p.seed, archivo: `e${String(e.n).padStart(2, "0")}.json.gz`, archivoSha256: i.toString(16).padStart(64, "0"), intento: 1,
        local: { ...e.local, club: "Club Local", declarado }, visita: { ...e.visita, club: "Club Visita", declarado }, fase: p.fase, desempate: p.desempate };
    });
    return esquemaTorneo062.parse({
      version: S.version, id: "sitio-2026-10-25", tipo: "real", titulo: { es: "Fixture", en: "Fixture" }, inicioUtc: "2026-10-25T00:00:00.000Z", finUtc: "2026-10-25T00:30:00.000Z", commit: "0123456",
      motor: { version: ARENA.version, reglas: ARENA.reglas }, duracionS: T.duracionS, intervaloS: S.intervaloS, semilla: SEM, participantes: PARTICIPANTES, pendientes: [],
      gasto: { conocidoMicroUsd: 0, tipicoMicroUsd: 0, topeMicroUsd: 0, reservaMaxPartidoMicroUsd: 0 }, formato: "grupos", origen: "sitio", lanzamiento: "publico",
      estado: "completo", motivoFin: null, enCurso: null, encuentros,
    });
  }
  it("un torneo de grupos completo (18 partidos, tres desempates) es coherente", () => {
    expect(validarCoherencia(torneo({ ...F1, 13: [1, 1], 14: [2, 1], 15: [0, 0], 16: [0, 0], 17: [0, 0], 18: [0, 0] }))).toEqual([]);
    expect(validarCoherencia(torneo({ ...F1, 13: [2, 1], 14: [0, 1], 15: [1, 0] }))).toEqual([]);
  });
  it("una semifinal que contradice los grupos (2A en vez de 2B) o un desempate ausente tras un empate ⇒ incoherente", () => {
    const t = torneo({ ...F1, 13: [2, 1], 14: [0, 1], 15: [1, 0] });
    const sf1 = t.encuentros[12]!;
    const contra = { ...t, encuentros: t.encuentros.map(e => e.n === 13 ? { ...e, visita: { ...e.visita, participante: "sol6" } } : e) };
    expect(validarCoherencia(contra).join()).toMatch(/P13: no coincide con planTorneo/);
    const conEmpate = torneo({ ...F1, 13: [1, 1], 14: [2, 1], 15: [0, 1], 16: [1, 0] });
    // Se quita el desempate (P14) y se renumera: la semifinal 2 ocuparía el lugar del desempate.
    const sinDesempate = { ...conEmpate, encuentros: conEmpate.encuentros.filter(e => e.n !== 14).map(e => e.n > 14 ? { ...e, n: e.n - 1, archivo: `e${String(e.n - 1).padStart(2, "0")}.json.gz` } : e) } as Torneo062;
    expect(validarCoherencia(sinDesempate).join()).toMatch(/P14: no coincide con planTorneo/);
    expect(sf1.fase).toBe("semifinal-1");
  });
  it("grupos con un pendiente en la fase de grupos ⇒ incompleto sin cuadro es coherente; «completo» no", () => {
    const t = torneo(F1);
    const incompleto = { ...t, encuentros: t.encuentros.filter(e => e.n !== 5).map(e => e) , pendientes: [5], estado: "incompleto" as const, motivoFin: "infraestructura" as const };
    expect(validarCoherencia(incompleto).filter(x => !/prefijo/.test(x))).toEqual([]);
    expect(validarCoherencia({ ...t, estado: "completo" }).join()).toMatch(/completo con pendientes o con partidos por jugar/);
  });
});
