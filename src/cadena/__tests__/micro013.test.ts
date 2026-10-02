// Brief 013 — los 4 hechos de la capa micro en el Verificador: su plantilla pasa; V8 liga el
// léxico nuevo a SU hecho (regate ⇒ duelo_ganado, «se desangró» ⇒ perdidas_en_salida,
// «dominó» también con dominio_global); el canal nombrado es computable; cifras por V3.
// Y en vivo: un dominio parcial no se vende como del partido entero (regla de cierre del 012).
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import type { Hecho, TipoHecho } from "../../analista/tipos";
import { borradorDesdeHechos } from "../../lib/llm-stub";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Partido } from "../../sim/tipos";
import { detectarMomentos } from "../../vivo/momentos";
import { contextoDelMomento, verificarOracionesUpdate } from "../../vivo/updates";
import { mensajeInicial } from "../prompt";
import type { Motivo, Oracion } from "../tipos";
import { verificarDraft } from "../verificador";

/** La primera semilla del corpus con un hecho de ese tipo. */
function conHecho(tipo: TipoHecho, extra: (h: Hecho) => boolean = () => true): { p: Partido; hs: Hecho[]; h: Hecho } {
  for (let s = 1; s <= 400; s++) {
    const p = simular(configDeSemilla(s));
    const hs = analizar(p);
    const h = hs.find((x) => x.tipo === tipo && extra(x));
    if (h) return { p, hs, h };
  }
  throw new Error(`fixture: no hay ${tipo} en 1..400`);
}

/** Motivos de la oración del hecho `id` reemplazada (crónica completa del stub). */
function con(p: Partido, hs: Hecho[], id: string, es: string, en: string): Motivo[] {
  const d = borradorDesdeHechos(mensajeInicial(hs));
  const i = d.oraciones.findIndex((o) => o.hecho === id);
  const o: Oracion = { texto_es: es, texto_en: en, hecho: id };
  d.oraciones[i] = o;
  return verificarDraft(d, hs, p).filter((m) => m.oracion === i);
}
const reglas = (ms: Motivo[]) => [...new Set(ms.map((m) => m.regla))].sort();
const sin = (t: string) => t.replace(/\.$/, "");

describe("013 · duelo_ganado", () => {
  const { p, hs, h } = conHecho("duelo_ganado");
  const gol = hs.find((x) => x.tipo === "gol_anotado") ?? hs.find((x) => x.tipo === "resultado_final")!;
  const N = Number(h.datos.regates);

  it("la plantilla pasa", () => expect(con(p, hs, h.id, h.texto_es, h.texto_en)).toEqual([]));
  it("conteo inflado ⇒ V3", () => {
    expect(reglas(con(p, hs, h.id, h.texto_es.replace(`${N} veces`, `${N + 3} veces`), h.texto_en.replace(`${N} times`, `${N + 3} times`)))).toContain("V3");
  });
  it("«dribló / beat his man» con otro hecho como principal ⇒ V8 (ES y EN por separado)", () => {
    expect(con(p, hs, gol.id, `${sin(gol.texto_es)}; antes dribló a su marcador.`, gol.texto_en).some((m) => m.regla === "V8" && m.detalle.endsWith("(ES)"))).toBe(true);
    expect(con(p, hs, gol.id, gol.texto_es, `${sin(gol.texto_en)}; he beat his man first.`).some((m) => m.regla === "V8" && m.detalle.endsWith("(EN)"))).toBe(true);
  });
  it("el duelo atribuido a otro defensor (nombre que no es del hecho) ⇒ V4", () => {
    const otro = p.config[h.datos.equipo_rival === p.config.local.nombre ? "local" : "visita"].jugadores.find((j) => j.nombre !== h.datos.rival && j.posicion !== "POR")!.nombre;
    expect(reglas(con(p, hs, h.id, h.texto_es.replace(String(h.datos.rival), otro), h.texto_en.replace(String(h.datos.rival), otro)))).toContain("V4");
  });
  it("«se fue de / skipped past» con el duelo como principal SÍ pasa", () => {
    const es = `${h.datos.jugador} (${h.datos.equipo}) se fue de ${h.datos.rival} (${h.datos.equipo_rival}) ${N} veces.`;
    const en = `${h.datos.jugador} (${h.datos.equipo}) skipped past ${h.datos.rival} (${h.datos.equipo_rival}) ${N} times.`;
    expect(con(p, hs, h.id, es, en)).toEqual([]);
  });
});

describe("013 · perdidas_en_salida", () => {
  const { p, hs, h } = conHecho("perdidas_en_salida", (x) => x.datos.canal !== "centro");
  const gol = hs.find((x) => x.tipo === "gol_anotado") ?? hs.find((x) => x.tipo === "resultado_final")!;
  const N = Number(h.datos.perdidas);
  const otroCanal = h.datos.canal === "banda_izquierda" ? ["la banda derecha", "the right flank"] : ["la banda izquierda", "the left flank"];

  it("la plantilla pasa", () => expect(con(p, hs, h.id, h.texto_es, h.texto_en)).toEqual([]));
  it("canal equivocado ⇒ V8 (canal computable), ES y EN por separado", () => {
    const es = h.texto_es.replace(String(h.datos.canal_es), otroCanal[0] as string);
    const en = h.texto_en.replace(String(h.datos.canal_en), otroCanal[1] as string);
    expect(con(p, hs, h.id, es, h.texto_en).some((m) => m.regla === "V8" && m.detalle.includes("canal") && m.detalle.endsWith("(ES)"))).toBe(true);
    expect(con(p, hs, h.id, h.texto_es, en).some((m) => m.regla === "V8" && m.detalle.includes("canal") && m.detalle.endsWith("(EN)"))).toBe(true);
  });
  it("conteo inflado ⇒ V3", () => {
    expect(reglas(con(p, hs, h.id, h.texto_es.replace(`${N} veces`, `${N + 4} veces`), h.texto_en.replace(`${N} times`, `${N + 4} times`)))).toContain("V3");
  });
  it("«se desangró por / bled down» con otro hecho como principal ⇒ V8", () => {
    expect(con(p, hs, gol.id, `${sin(gol.texto_es)}; el rival se desangró por ${h.datos.canal_es}.`, gol.texto_en).some((m) => m.regla === "V8" && m.detalle.endsWith("(ES)"))).toBe(true);
    expect(con(p, hs, gol.id, gol.texto_es, `${sin(gol.texto_en)}; the rival bled down ${h.datos.canal_en}.`).some((m) => m.regla === "V8" && m.detalle.endsWith("(EN)"))).toBe(true);
  });
  it("«se desangró por / bled down» con su hecho y su canal SÍ pasa", () => {
    expect(con(p, hs, h.id, `${h.datos.equipo} se desangró por ${h.datos.canal_es}: perdió el balón ${N} veces.`, `${h.datos.equipo} bled down ${h.datos.canal_en}, losing the ball ${N} times.`)).toEqual([]);
  });
});

describe("013 · dominio_global", () => {
  const { p, hs, h } = conHecho("dominio_global");
  const gol = hs.find((x) => x.tipo === "gol_anotado") ?? hs.find((x) => x.tipo === "resultado_final")!;
  const pc = Number(h.datos.porcentaje);

  it("la plantilla pasa y sus cifras están en datos (con el desglose por periodo)", () => {
    expect(con(p, hs, h.id, h.texto_es, h.texto_en)).toEqual([]);
    expect(Number(h.datos.pases_equipo_p1) + Number(h.datos.pases_equipo_p2 ?? 0)).toBe(Number(h.datos.pases_equipo));
    expect(Number(h.datos.pases_total_p1) + Number(h.datos.pases_total_p2 ?? 0)).toBe(Number(h.datos.pases_total));
  });
  it("porcentaje inventado ⇒ V3", () => {
    expect(reglas(con(p, hs, h.id, h.texto_es.replace(`${pc} %`, `${pc + 9} %`), h.texto_en.replace(`${pc}%`, `${pc + 9}%`)))).toContain("V3");
  });
  it("«dominó / dominated» con un gol como principal ⇒ V8", () => {
    expect(con(p, hs, gol.id, `${sin(gol.texto_es)}; ${h.datos.equipo} dominó.`, gol.texto_en).some((m) => m.regla === "V8")).toBe(true);
  });
});

describe("013 · dominio_por_canal", () => {
  const { p, hs, h } = conHecho("dominio_por_canal", (x) => x.datos.canal !== "centro");
  const pc = Number(h.datos.porcentaje);
  const otro = h.datos.canal === "banda_izquierda" ? ["la banda derecha", "the right flank"] : ["la banda izquierda", "the left flank"];

  it("la plantilla pasa y el desglose por canal suma el total", () => {
    expect(con(p, hs, h.id, h.texto_es, h.texto_en)).toEqual([]);
    expect(Number(h.datos.avances_izquierda) + Number(h.datos.avances_centro) + Number(h.datos.avances_derecha)).toBe(Number(h.datos.avances_total));
  });
  it("canal equivocado ⇒ V8; porcentaje inventado ⇒ V3", () => {
    expect(reglas(con(p, hs, h.id, h.texto_es.replace(String(h.datos.canal_es), otro[0] as string), h.texto_en.replace(String(h.datos.canal_en), otro[1] as string)))).toContain("V8");
    expect(reglas(con(p, hs, h.id, h.texto_es.replace(`${pc} %`, `${pc + 7} %`), h.texto_en.replace(`${pc}%`, `${pc + 7}%`)))).toContain("V3");
  });
});

describe("013 · en vivo: el dominio vale «hasta ahora», nunca como veredicto del partido entero", () => {
  // Un momento NO final (≈ minuto 30 o el primero disponible) de la semilla 246.
  const p = simular(configDeSemilla(246));
  const m = detectarMomentos(p).find((x) => x.tipo !== "final" && x.minuto >= 30) ?? detectarMomentos(p)[0]!;
  const c = contextoDelMomento(p, m, "neutral");
  const motivos = (es: string, en: string) => verificarOracionesUpdate([{ texto_es: es, texto_en: en, hecho: c.principal.id }], c.hechos, c.pre, c.principal.id, false);
  const L = p.config.local.nombre;

  it("«dominó el partido entero» ⇒ rechazado por cierre (ES)", () => {
    const ms = motivos(`${sin(c.principal.texto_es)}; ${L} dominó el partido entero.`, c.principal.texto_en);
    expect(ms.some((x) => x.detalle.startsWith("cierre en vivo") && x.detalle.endsWith("(ES)"))).toBe(true);
  });
  it("«dominated the whole match» ⇒ rechazado por cierre (EN)", () => {
    const ms = motivos(c.principal.texto_es, `${sin(c.principal.texto_en)}; ${L} dominated the whole match.`);
    expect(ms.some((x) => x.detalle.startsWith("cierre en vivo") && x.detalle.endsWith("(EN)"))).toBe(true);
  });
  it("los hechos micro del prefijo NO son hechos de cierre: llegan al Cronista en momentos no finales", () => {
    let vistos = 0;
    for (let s = 1; s <= 40; s++) {
      const q = simular(configDeSemilla(s));
      for (const mm of detectarMomentos(q).filter((x) => x.tipo !== "final")) {
        vistos += contextoDelMomento(q, mm, "neutral").hechos.filter((h) => ["dominio_global", "dominio_por_canal", "duelo_ganado", "perdidas_en_salida"].includes(h.tipo)).length;
      }
    }
    expect(vistos).toBeGreaterThan(0);
  });
});
