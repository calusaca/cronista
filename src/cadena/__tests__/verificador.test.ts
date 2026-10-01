// El Verificador (brief 003, revisión 3.1), regla por regla, sobre partidos reales y la
// crónica correcta del stub. Cada prueba corrompe UNA cosa. La batería de la auditoría
// vive aparte, en mentiras.test.ts.
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import type { Hecho } from "../../analista/tipos";
import { borradorDesdeHechos } from "../../lib/llm-stub";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import { borradorActa } from "../acta";
import { mensajeInicial } from "../prompt";
import type { CronicaDraft, Motivo, Oracion } from "../tipos";
import { COBERTURA, GOLEADA_MARGEN_MIN } from "../umbrales";
import { normalizar, numeros, parsear, verificar, verificarDraft } from "../verificador";

const p = simular(configDeSemilla(42));
const hechos = analizar(p);
const correcto = (): CronicaDraft => borradorDesdeHechos(mensajeInicial(hechos));
const idDe = (tipo: string) => (hechos.find((h) => h.tipo === tipo) as Hecho).id;
const reglas = (ms: Motivo[]) => [...new Set(ms.map((m) => m.regla))].sort();
/** Reemplaza la oración del hecho dado por otra, y devuelve los motivos. */
function con(tipo: string, es: string, en: string, apoyo?: string[], partido = p, hs = hechos): Motivo[] {
  const d = borradorDesdeHechos(mensajeInicial(hs));
  const id = (hs.find((h) => h.tipo === tipo) as Hecho).id;
  const i = d.oraciones.findIndex((o) => o.hecho === id);
  const o: Oracion = { texto_es: es, texto_en: en, hecho: id, ...(apoyo ? { apoyo } : {}) };
  d.oraciones[i] = o;
  return verificarDraft(d, hs, partido);
}
const goleador = (hechos.find((h) => h.tipo === "gol_anotado") as Hecho).datos.jugador as string; // Vicente Oreales, 2', 0–1
const L = p.config.local.nombre; // Sporting Montefrío Bajo
const V = p.config.visita.nombre; // Olímpico Brezal

// Semilla 246: tiene expulsión, doblete, goleada 4–1 y justicia contra la corriente.
const p246 = simular(configDeSemilla(246));
const h246 = analizar(p246);

describe("la crónica correcta pasa", () => {
  it("el borrador del stub (semilla 42) no tiene motivos", () => {
    expect(verificar(JSON.stringify(correcto()), hechos, p).motivos).toEqual([]);
  });

  it("el acta pasa en el corpus 1..300 (el último recurso nunca puede fallar)", () => {
    const fallas: string[] = [];
    for (let s = 1; s <= 300; s++) {
      const q = simular(configDeSemilla(s));
      const hs = analizar(q);
      for (const m of verificarDraft(borradorActa(hs), hs, q)) fallas.push(`seed ${s}: ${m.regla} ${m.detalle}`);
    }
    expect(fallas.slice(0, 5)).toEqual([]);
  });
});

describe("V1 — salida ilegible", () => {
  it.each([
    ["JSON roto", JSON.stringify(correcto()).slice(0, -5)],
    ["texto antes del JSON", `Aquí va la crónica: ${JSON.stringify(correcto())}`],
    ["sin oraciones", JSON.stringify({ ...correcto(), oraciones: [] })],
    ["falta la clave oraciones", JSON.stringify({ titulo_es: "x", titulo_en: "x" })],
    ["no es un objeto", JSON.stringify([correcto()])],
    ["contrato viejo (hechos: [] en vez de hecho)", JSON.stringify({ ...correcto(), oraciones: [{ texto_es: "a", texto_en: "a", hechos: ["h01"] }] })],
    ["apoyo no es lista", JSON.stringify({ ...correcto(), oraciones: [{ texto_es: "a", texto_en: "a", hecho: "h01", apoyo: "h02" }] })],
    ["falta titulo_en", JSON.stringify({ titulo_es: "x", oraciones: correcto().oraciones })],
  ])("%s ⇒ V1", (_, salida) => {
    const v = verificar(salida, hechos, p);
    expect(v.draft).toBeNull();
    expect(reglas(v.motivos)).toEqual(["V1"]);
  });

  it("un único bloque ```json … ``` alrededor del JSON se acepta", () => {
    expect(parsear("```json\n" + JSON.stringify(correcto()) + "\n```").draft).not.toBeNull();
  });
});

describe("V2 — hecho principal y apoyo", () => {
  it("sin hecho principal ⇒ V2 en esa oración, con el motivo exacto (es lo que lee el Cronista)", () => {
    const d = correcto();
    d.oraciones[2]!.hecho = "  ";
    const v2 = verificarDraft(d, hechos, p).filter((m) => m.regla === "V2");
    expect(v2).toEqual([{ oracion: 2, regla: "V2", detalle: "no tiene hecho principal" }]);
  });
  it("principal inexistente ⇒ V2", () => {
    const d = correcto();
    d.oraciones[0]!.hecho = "h99";
    expect(verificarDraft(d, hechos, p).some((m) => m.regla === "V2" && m.detalle.includes("h99"))).toBe(true);
  });
  it("apoyo inexistente ⇒ V2", () => {
    const d = correcto();
    d.oraciones[0]!.apoyo = ["h98"];
    expect(verificarDraft(d, hechos, p).some((m) => m.regla === "V2" && m.detalle.includes("h98"))).toBe(true);
  });
  it("un apoyo válido no cambia nada", () => {
    const d = correcto();
    d.oraciones[0]!.apoyo = [idDe("justicia_xg")];
    expect(verificarDraft(d, hechos, p)).toEqual([]);
  });
});

describe("V3 — cifras contra el hecho PRINCIPAL", () => {
  it("número que no está en el principal ⇒ V3", () => {
    expect(reglas(con("gol_anotado", `${goleador} marcó en el minuto 37.`, `${goleador} scored in minute 37.`))).toEqual(["V3"]);
  });
  it("un número cierto de un hecho de APOYO no habilita nada (mata la recombinación)", () => {
    const xgVisita = (hechos.find((h) => h.tipo === "justicia_xg") as Hecho).datos.xg_visita as string;
    const ms = con("resultado_final", `Resultado final: ${L} 1–1 ${V}, con ${xgVisita} de xG.`, `Full time: ${L} 1–1 ${V}, with ${xgVisita} xG.`, [idDe("justicia_xg")]);
    expect(reglas(ms)).toEqual(["V3"]);
  });
  it("números en palabras 0–99, compuestos incluidos («treinta y siete», thirty-seven)", () => {
    expect(numeros("treinta y siete", "es")).toEqual(["37"]);
    expect(numeros("thirty-seven", "en")).toEqual(["37"]);
    expect(numeros("thirty seven", "en")).toEqual(["37"]);
    expect(numeros("noventa y nueve", "es")).toEqual(["99"]);
    expect(numeros("veintidós", "es")).toEqual(["22"]);
    expect(numeros("once", "es")).toEqual(["11"]);
    expect(numeros("scored once", "en")).toEqual([]);
  });
  it("ordinales, docena, par, ambos/both cuentan; un/una/one no (son artículos)", () => {
    expect(numeros("su tercer gol", "es")).toEqual(["3"]);
    expect(numeros("his third goal", "en")).toEqual(["3"]);
    expect(numeros("una docena", "es")).toEqual(["12"]);
    expect(numeros("half a dozen", "en")).toEqual(["6"]);
    expect(numeros("un par de goles", "es")).toEqual(["2"]);
    expect(numeros("ambos goles", "es")).toEqual(["2"]);
    expect(numeros("both goals", "en")).toEqual(["2"]);
    expect(numeros("un gol de una jugada", "es")).toEqual([]);
    expect(numeros("one goal", "en")).toEqual([]);
  });
  it("frases fijas sin cifra: «los 90 minutos», «one-two», «ambos equipos»", () => {
    expect(numeros("los 90 minutos", "es")).toEqual([]);
    expect(numeros("after a one-two", "en")).toEqual([]);
    expect(numeros("ambos equipos", "es")).toEqual([]);
    expect(numeros("both teams", "en")).toEqual([]);
  });
  it("dígitos Unicode normalizados: fullwidth ７ y arábigo-índico ٣ son 7 y 3", () => {
    expect(normalizar("７–０ y ٣")).toBe("7–0 y 3");
    expect(numeros("ganó ７–０", "es")).toEqual(["7", "0"]);
  });
  it("superíndices y dígitos encerrados (no son \\p{Nd}) también se ven: «minuto ³⁰», «①» ⇒ V3", () => {
    expect(numeros("minuto ³⁰ y ①", "es")).toEqual(["30", "1"]);
    expect(reglas(con("gol_anotado", `${goleador} marcó en el minuto ³⁰.`, `${goleador} scored in minute ³⁰.`))).toEqual(["V3"]);
  });
  it("coma decimal = punto; 0.30 = 0.3", () => {
    expect(numeros("xG 0,23 y 0.30", "es")).toEqual(["0.23", "0.3"]);
  });
  it("marcador «A x–y B» invertido ⇒ V3 aunque las cifras existan", () => {
    expect(reglas(con("resultado_final", `Resultado final: ${V} 1–1 ${L}.`, `Full time: ${V} 1–1 ${L}.`))).toEqual([]); // 1–1 es simétrico
    const ms = con("marcador_por_periodo", `Al descanso: ${L} 1–0 ${V}.`, `Half time: ${L} 1–0 ${V}.`);
    expect(reglas(ms)).toEqual(["V3"]);
  });
  it("«55-64» es un rango de minutos, no un marcador (sus números se verifican sueltos)", () => {
    const pr = h246.find((h) => h.tipo === "presion_sostenida") as Hecho;
    const ms = con("presion_sostenida", `${String(pr.datos.equipo)} remató 6 veces entre el 55-64.`, `${String(pr.datos.equipo)} had 6 shots in the 55-64 spell.`, undefined, p246, h246);
    expect(ms).toEqual([]);
  });
  it("margen dicho ≠ diferencia del marcador ⇒ V3; el margen cierto pasa", () => {
    const res = (h246.find((h) => h.tipo === "resultado_final") as Hecho).datos;
    const gan = String(res.local);
    expect(reglas(con("resultado_final", `${gan} ganó 4–1, por un gol de diferencia.`, `${gan} won 4–1, by a single goal.`, undefined, p246, h246))).toContain("V3");
    expect(con("resultado_final", `${gan} ganó 4–1, por tres goles de diferencia.`, `${gan} won 4–1, by three goals.`, undefined, p246, h246)).toEqual([]);
  });
  it("periodo: «segundo tiempo» para un gol del minuto 2 ⇒ V3; «primer tiempo» pasa", () => {
    expect(reglas(con("gol_temprano", `${goleador} marcó en el minuto 2 del segundo tiempo.`, `${goleador} scored in minute 2 of the second half.`))).toEqual(["V3"]);
    expect(con("gol_temprano", `${goleador} marcó en el minuto 2 del primer tiempo.`, `${goleador} scored in minute 2 of the first half.`)).toEqual([]);
  });
  it("cuenta de goles: «triplete» con un doblete ⇒ V3; «doblete» pasa", () => {
    const db = h246.find((h) => h.tipo === "doblete_o_mas") as Hecho;
    const j = String(db.datos.jugador);
    expect(reglas(con("doblete_o_mas", `${j} firmó un triplete (minutos 31, 48).`, `${j} scored a hat-trick (minutes 31, 48).`, undefined, p246, h246))).toEqual(["V3"]);
    expect(con("doblete_o_mas", `${j} firmó un doblete (minutos 31, 48).`, `${j} scored a brace (minutes 31, 48).`, undefined, p246, h246)).toEqual([]);
  });
});

describe("V4 — nombres contra el hecho PRINCIPAL", () => {
  it("jugador inventado ⇒ V4", () => {
    expect(reglas(con("gol_anotado", `${goleador} marcó en el minuto 2. Asistió Rodrigo Fantasmín.`, `${goleador} scored in minute 2. Rodrigo Fantasmín assisted.`))).toEqual(["V4"]);
  });
  it("posición 0 también se controla: un apellido inventado abriendo la oración ⇒ V4", () => {
    expect(reglas(con("gol_anotado", `Gutiérrez vio marcar a ${goleador} en el minuto 2.`, `Gutiérrez watched ${goleador} score in minute 2.`))).toEqual(["V4"]);
  });
  it("tras puntuación: solo nombres del hecho o palabras funcionales", () => {
    expect(con("gol_anotado", `${goleador} marcó en el minuto 2. Después, el partido siguió.`, `${goleador} scored in minute 2. After that, play went on.`)).toEqual([]);
    expect(reglas(con("gol_anotado", `${goleador} marcó en el minuto 2. Ramírez lo vio.`, `${goleador} scored in minute 2. Ramírez saw it.`))).toEqual(["V4"]);
  });
  it("apellido de un jugador del principal es válido, también en posesivo inglés", () => {
    const ap = goleador.split(" ").slice(1).join(" ");
    expect(con("gol_anotado", `${ap} marcó en el minuto 2.`, `${ap}'s goal came in minute 2.`)).toEqual([]);
  });
  it("nombre compuesto con piezas de dos jugadores ⇒ V4", () => {
    const otro = (hechos.filter((h) => h.tipo === "gol_anotado")[1] as Hecho).datos.jugador as string; // Emilio Valarón
    const mezcla = `${otro.split(" ")[0]} ${goleador.split(" ").slice(1).join(" ")}`;
    expect(reglas(con("gol_anotado", `${mezcla} marcó en el minuto 2.`, `${mezcla} scored in minute 2.`))).toEqual(["V4"]);
  });
  it("«Jugador (Equipo)» con el equipo equivocado ⇒ V4", () => {
    expect(reglas(con("gol_anotado", `${goleador} (${L}) marcó en el minuto 2.`, `${goleador} (${L}) scored in minute 2.`))).toEqual(["V4"]);
  });
});

describe("V5 — narración obligatoria", () => {
  it(`un hecho con relevancia ≥ ${COBERTURA} que no es principal de ninguna oración ⇒ V5`, () => {
    const d = correcto();
    const id = idDe("gol_anotado");
    d.oraciones = d.oraciones.filter((o) => o.hecho !== id);
    d.oraciones[0]!.apoyo = [id]; // citarlo de apoyo NO basta
    expect(verificarDraft(d, hechos, p).some((m) => m.regla === "V5" && m.detalle.includes(id))).toBe(true);
  });
  it(`un hecho con relevancia < ${COBERTURA} puede faltar`, () => {
    const d = correcto();
    const id = idDe("gol_temprano");
    d.oraciones = d.oraciones.filter((o) => o.hecho !== id);
    expect(verificarDraft(d, hechos, p)).toEqual([]);
  });
  it("una oración que no nombra a nadie ni dice ninguna cifra de su principal ⇒ V5 en esa oración", () => {
    expect(reglas(con("resultado_final", "Fue una tarde intensa.", "It was an intense afternoon."))).toEqual(["V5"]);
  });
});

describe("V6 — paridad ES/EN", () => {
  it("cifras distintas entre ES y EN ⇒ V6", () => {
    const d = correcto();
    const o = d.oraciones.find((x) => x.hecho === idDe("resultado_final"))!;
    o.texto_en = o.texto_en.replace("1–1", "1–0");
    expect(verificarDraft(d, hechos, p).some((m) => m.regla === "V6")).toBe(true);
  });
  it("V6 también compara números en palabras: «dos» vs «four» ⇒ V6 aunque 2 y 4 estén en el hecho", () => {
    // El primer marcador_por_periodo de la semilla 246 es el del descanso (2–0)… se usa el 2T (2–1 en el periodo, 4–1 total).
    const h2t = h246.filter((h) => h.tipo === "marcador_por_periodo")[1] as Hecho;
    const d = borradorDesdeHechos(mensajeInicial(h246));
    const equipo = String(h2t.datos.local);
    d.oraciones[d.oraciones.findIndex((o) => o.hecho === h2t.id)] = {
      texto_es: `Segundo tiempo: ${equipo} marcó dos.`,
      texto_en: `Second half: ${equipo} scored four.`,
      hecho: h2t.id,
    };
    const ms = verificarDraft(d, h246, p246);
    expect(reglas(ms)).toEqual(["V6"]); // V3 no salta: 2 y 4 están en el hecho; solo la paridad lo delata
  });
  it("texto vacío en un idioma ⇒ V6", () => {
    const d = correcto();
    d.oraciones[0]!.texto_en = "   ";
    expect(verificarDraft(d, hechos, p).some((m) => m.regla === "V6" && m.oracion === 0)).toBe(true);
  });
});

describe("V7 — negaciones", () => {
  it.each([
    ["sin", `Resultado final: ${L} 1–1 ${V}, sin tarjetas rojas.`, `Full time: ${L} 1–1 ${V}, with red cards absent.`],
    ["no hubo", `Resultado final: ${L} 1–1 ${V}; no hubo penales.`, `Full time: ${L} 1–1 ${V}; there were no penalties.`],
    ["ni", `Resultado final: ${L} 1–1 ${V}, ni un gol más.`, `Full time: ${L} 1–1 ${V}, nothing more.`],
    ["without (EN)", `Resultado final: ${L} 1–1 ${V}.`, `Full time: ${L} 1–1 ${V}, without a red card.`],
    ["never (EN)", `Resultado final: ${L} 1–1 ${V}.`, `Full time: ${L} 1–1 ${V}; ${V} never trailed.`],
  ])("%s ⇒ V7", (_, es, en) => {
    expect(con("resultado_final", es, en).some((m) => m.regla === "V7")).toBe(true);
  });
  it("«sin embargo» es un conector, no una negación", () => {
    expect(con("resultado_final", `Resultado final: ${L} 1–1 ${V}; sin embargo, el partido terminó parejo.`, `Full time: ${L} 1–1 ${V}; nevertheless, it ended level.`)).toEqual([]);
  });
});

describe("V8 — vocabulario de juicio y verbos de resultado", () => {
  const res = h246.find((h) => h.tipo === "resultado_final") as Hecho;
  const gan = String(res.datos.local); // Juventud Islaverde Sur (4–1)
  const per = String(res.datos.visita);
  it(`«goleada» con margen ≥ ${GOLEADA_MARGEN_MIN} pasa; con el 1–1 ⇒ V8`, () => {
    expect(con("resultado_final", `${gan} goleó 4–1 a ${per}.`, `${gan} thrashed ${per} 4–1.`, undefined, p246, h246)).toEqual([]);
    expect(reglas(con("resultado_final", `Goleada: ${L} 1–1 ${V}.`, `Rout: ${L} 1–1 ${V}.`))).toEqual(["V8"]);
  });
  it("verbo de resultado con el perdedor como sujeto ⇒ V8 (ganador invertido con tokens legítimos)", () => {
    expect(reglas(con("resultado_final", `${per} ganó 4–1 a ${gan}.`, `${per} beat ${gan} 4–1.`, undefined, p246, h246))).toContain("V8");
    expect(con("resultado_final", `${per} perdió 4–1 con ${gan}.`, `${per} lost 4–1 to ${gan}.`, undefined, p246, h246)).toEqual([]);
  });
  it("«empató» en una victoria ⇒ V8; en el 1–1 pasa", () => {
    expect(reglas(con("resultado_final", `${gan} empató 4–1 con ${per}.`, `${gan} drew 4–1 with ${per}.`, undefined, p246, h246))).toContain("V8");
    expect(con("resultado_final", `${L} empató 1–1 con ${V}.`, `${L} drew 1–1 with ${V}.`)).toEqual([]);
  });
  it("«ganó» con un hecho que no dice resultados (un gol) ⇒ V8", () => {
    expect(reglas(con("gol_anotado", `${goleador} marcó en el minuto 2 y ${V} ganó.`, `${goleador} scored in minute 2 and ${V} won.`))).toContain("V8");
  });
  it("«ganó un penal» no es un verbo de resultado", () => {
    const g = h246.find((h) => h.tipo === "gol_anotado" && h.datos.penal === "si") as Hecho;
    const j = String(g.datos.jugador);
    const d = borradorDesdeHechos(mensajeInicial(h246));
    d.oraciones[d.oraciones.findIndex((o) => o.hecho === g.id)] = {
      texto_es: `${j} ganó un penal y lo marcó en el minuto ${g.datos.minuto}.`,
      texto_en: `${j} won a penalty and scored it in minute ${g.datos.minuto}.`,
      hecho: g.id,
    };
    expect(verificarDraft(d, h246, p246)).toEqual([]);
  });
  it.each([
    ["dominó", "dominated"],
    ["mereció", "deserved"],
    ["remontó", "came back"],
  ])("«%s» sin el hecho que lo habilita ⇒ V8", (es, en) => {
    expect(reglas(con("resultado_final", `Resultado final: ${L} 1–1 ${V}; ${V} ${es}.`, `Full time: ${L} 1–1 ${V}; ${V} ${en}.`))).toContain("V8");
  });
  it("«contra la corriente» pasa con justicia_xg contra la corriente; «más xG» ahí ⇒ V8", () => {
    expect(con("justicia_xg", `${gan} ganó contra la corriente: 1.75 contra 2.45 de xG.`, `${gan} won against the run of play: 1.75 to 2.45 xG.`, undefined, p246, h246)).toEqual([]);
    expect(reglas(con("justicia_xg", `${gan} ganó con más xG: 2.45 contra 1.75.`, `${gan} won with more xG: 2.45 to 1.75.`, undefined, p246, h246))).toContain("V8");
  });
  it("«doble amarilla» ≠ «roja directa» según el motivo del hecho", () => {
    const e = h246.find((h) => h.tipo === "expulsion_y_efecto") as Hecho;
    const j = String(e.datos.jugador);
    expect(con("expulsion_y_efecto", `${j} vio la segunda amarilla en el minuto 66.`, `${j} picked up a second yellow in minute 66.`, undefined, p246, h246)).toEqual([]);
    expect(reglas(con("expulsion_y_efecto", `${j} vio la roja directa en el minuto 66.`, `${j} saw a straight red in minute 66.`, undefined, p246, h246))).toEqual(["V8"]);
  });
  it("«con diez» / «ten men» exige una expulsión como principal", () => {
    expect(reglas(con("resultado_final", `${L} terminó con diez: ${L} 1–1 ${V}.`, `${L} finished with ten men: ${L} 1–1 ${V}.`))).toEqual(["V8"]);
  });
  it.each(["monólogo", "paliza", "épico"])("«%s» está fuera de tabla ⇒ V8 siempre", (w) => {
    expect(reglas(con("resultado_final", `Resultado final: ${L} 1–1 ${V}, un ${w}.`, `Full time: ${L} 1–1 ${V}.`))).toContain("V8");
  });
});

describe("el título también se verifica (contra el resultado + los hechos de los jugadores que nombra)", () => {
  it("número inventado ⇒ V3 con oracion −1 y «título» en el detalle", () => {
    const d = correcto();
    d.titulo_es += " (37 remates)";
    d.titulo_en += " (37 shots)";
    expect(verificarDraft(d, hechos, p).some((m) => m.regla === "V3" && m.oracion === -1 && m.detalle.startsWith("título"))).toBe(true);
  });
  it("Title Case en inglés con palabras comunes pasa", () => {
    const d = correcto();
    d.titulo_es = `${L} y ${V} empatan 1–1`;
    d.titulo_en = `${L} And ${V} Share The Spoils In 1–1 Draw`;
    expect(verificarDraft(d, hechos, p)).toEqual([]);
  });
  it("un nombre inventado en Title Case ⇒ V4", () => {
    const d = correcto();
    d.titulo_en = `${L} Hold ${V} As Gutiérrez Shines`;
    expect(verificarDraft(d, hechos, p).some((m) => m.regla === "V4" && m.oracion === -1)).toBe(true);
  });
});
