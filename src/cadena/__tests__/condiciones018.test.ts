// Brief 018 §3 — las condiciones en el Verificador. Las plantillas de los cuatro hechos nuevos
// pasan (con °C y temperaturas bajo cero); las cifras inventadas caen por V3; y la BATERÍA V8:
// cada frase de color de las condiciones (FRASES_EFECTO, recorrida frase por frase, ES y EN por
// separado) con la condición REGISTRADA pero SIN el efecto medido ⇒ rechazada; con el hecho de
// OTRO efecto como principal ⇒ rechazada; con SU hecho de efecto como principal ⇒ pasa.
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import type { Hecho, TipoHecho } from "../../analista/tipos";
import { LIGA_DESTACADA, TEMPORADA_ACTUAL } from "../../analista/umbrales";
import { borradorDesdeHechos } from "../../lib/llm-stub";
import { mundo } from "../../mundo/mundo";
import { configDePartidoLiga } from "../../mundo/temporada";
import { simular } from "../../sim/motor";
import type { Condiciones, Partido } from "../../sim/tipos";
import { medirCancha } from "../../analista/condiciones";
import { CANCHA_CORTOS_MAX, CANCHA_CORTOS_MUESTRA_MIN } from "../../analista/umbrales";
import { micro } from "../../sim/micro";
import { FRASES_EFECTO } from "../lexico";
import { mensajeInicial } from "../prompt";
import type { Motivo } from "../tipos";
import { verificarDraft, verificarOraciones } from "../verificador";

interface Caso {
  p: Partido;
  hs: Hecho[];
}
const liga = mundo().ligas.find((l) => l.id === LIGA_DESTACADA)!;
const corpus: Caso[] = Array.from({ length: 90 }, (_, k) => {
  const p = simular(configDePartidoLiga(liga, TEMPORADA_ACTUAL, Math.floor(k / 5) + 1, (k % 5) + 1));
  return { p, hs: analizar(p) };
});
const NUEVOS: TipoHecho[] = ["condiciones_del_partido", "efecto_calor", "cancha_incomoda", "presion_que_ahoga"];
const motivos = (c: Caso, h: Hecho, es: string, en: string): Motivo[] => verificarOraciones([{ texto_es: es, texto_en: en, hecho: h.id }], c.hs, c.p);
const sin = (t: string) => t.replace(/\.$/, "");
const reglas = (ms: Motivo[]) => [...new Set(ms.map((m) => m.regla))].sort();

/** La condición de cada efecto, sobre la config registrada. */
const CONDICION: Record<keyof typeof FRASES_EFECTO, (c: Condiciones) => boolean> = {
  efecto_calor: (c) => c.clima === "calor",
  cancha_incomoda: (c) => c.superficie === "natural" && c.cesped === "alto",
  presion_que_ahoga: (c) => c.presion.visita === "alta" || c.presion.local === "alta",
};
const TIPOS_EFECTO = Object.keys(FRASES_EFECTO) as (keyof typeof FRASES_EFECTO)[];
const tiene = (c: Caso, t: string) => c.hs.some((h) => h.tipo === t);
const hecho = (c: Caso, t: string) => c.hs.find((h) => h.tipo === t) as Hecho;

describe("018 · las plantillas nuevas pasan el Verificador (liga visible entera)", () => {
  it("cada hecho de condiciones, narrado con su plantilla, no tiene motivos (°C, temperaturas bajo cero, nombres)", () => {
    const fallas: string[] = [];
    let vistos = 0;
    for (const c of corpus) {
      for (const h of c.hs.filter((x) => NUEVOS.includes(x.tipo))) {
        vistos++;
        for (const m of motivos(c, h, h.texto_es, h.texto_en)) fallas.push(`${c.p.config.seed} ${h.tipo}: ${m.regla} ${m.detalle}`);
      }
    }
    expect(vistos).toBeGreaterThan(90);
    expect(corpus.some((c) => (c.p.config.condiciones?.temperaturaC ?? 0) < 0)).toBe(true);
    expect(fallas.slice(0, 10)).toEqual([]);
  });

  it("la crónica completa del stub (todos los hechos, título incluido) pasa en los partidos de liga", () => {
    const fallas: string[] = [];
    for (const c of corpus.slice(0, 30)) for (const m of verificarDraft(borradorDesdeHechos(mensajeInicial(c.hs)), c.hs, c.p)) fallas.push(`${c.p.config.seed}: ${m.regla} ${m.detalle}`);
    expect(fallas.slice(0, 10)).toEqual([]);
  });

  it("cifras inventadas ⇒ V3: temperatura, pases, porcentaje, pérdidas", () => {
    for (const t of NUEVOS) {
      const c = corpus.find((x) => tiene(x, t) && (t !== "condiciones_del_partido" || x.p.config.condiciones?.temperaturaC !== undefined))!;
      const h = hecho(c, t);
      const n = String(h.texto_es.match(/\d+/)?.[0]);
      const inflado = String(Number(n) + 7);
      expect(reglas(motivos(c, h, h.texto_es.replace(n, inflado), h.texto_en.replace(n, inflado))), t).toContain("V3");
    }
  });
});

describe("018 · batería V8: la condición registrada sola NO paga la frase", () => {
  for (const tipo of TIPOS_EFECTO) {
    // Un partido con la condición registrada y SIN el efecto medido, y otro con el efecto.
    const sinEfecto = corpus.find((c) => CONDICION[tipo](c.p.config.condiciones!) && !tiene(c, tipo))!;
    const conEfecto = corpus.find((c) => tiene(c, tipo))!;
    const otro = TIPOS_EFECTO.find((t) => t !== tipo && tiene(conEfecto, t)) ?? TIPOS_EFECTO.find((t) => t !== tipo && corpus.some((c) => tiene(c, t)))!;
    const casoOtro = tiene(conEfecto, otro) ? conEfecto : corpus.find((c) => tiene(c, otro))!;

    it(`${tipo}: los fixtures existen (condición sin efecto, con efecto)`, () => {
      expect(sinEfecto, "condición registrada sin efecto").toBeDefined();
      expect(conEfecto, "efecto medido").toBeDefined();
    });

    for (const lengua of ["es", "en"] as const) {
      for (const frase of FRASES_EFECTO[tipo][lengua]) {
        const L = lengua.toUpperCase();
        const conFrase = (h: Hecho) => (lengua === "es" ? [`${sin(h.texto_es)}; ${frase}.`, h.texto_en] : [h.texto_es, `${sin(h.texto_en)}; ${frase}.`]) as [string, string];
        it(`${tipo} · «${frase}» (${L})`, () => {
          // 1) mentira: principal = condiciones_del_partido, con la condición registrada y sin efecto
          const cond = hecho(sinEfecto, "condiciones_del_partido");
          const m1 = motivos(sinEfecto, cond, ...conFrase(cond));
          expect(m1.some((m) => m.regla === "V8" && m.detalle.includes(tipo) && m.detalle.endsWith(`(${L})`)), JSON.stringify(m1)).toBe(true);
          // 2) mentira: principal = el hecho de OTRO efecto
          const h2 = hecho(casoOtro, otro);
          const m2 = motivos(casoOtro, h2, ...conFrase(h2));
          expect(m2.some((m) => m.regla === "V8" && m.detalle.includes(tipo)), JSON.stringify(m2)).toBe(true);
          // 3) verdad: principal = SU hecho de efecto (la medición de ese partido) ⇒ pasa
          const h3 = hecho(conEfecto, tipo);
          expect(motivos(conEfecto, h3, ...conFrase(h3))).toEqual([]);
        });
      }
    }
  }
});

describe("018 · lluvia sobre césped alto: la caída medida NO paga «se le hizo de barro» (la lluvia podría explicarla)", () => {
  // Liga visible: lluvia, césped alto y la completación corta del visitante bajo el umbral. Con la
  // regla de Fable no hay cancha_incomoda, y cada frase suya con la condición como principal cae.
  const caso = corpus.find((c) => {
    const k = c.p.config.condiciones!;
    if (!(k.clima === "lluvia" && k.superficie === "natural" && k.cesped === "alto")) return false;
    const x = medirCancha(c.p, micro(c.p))!;
    return x.intentados >= CANCHA_CORTOS_MUESTRA_MIN && x.completados * 100 <= CANCHA_CORTOS_MAX * x.intentados;
  });
  it("el fixture existe y no tiene cancha_incomoda", () => {
    expect(caso).toBeDefined();
    expect(tiene(caso!, "cancha_incomoda")).toBe(false);
  });
  for (const lengua of ["es", "en"] as const) {
    for (const frase of FRASES_EFECTO.cancha_incomoda[lengua]) {
      it(`«${frase}» (${lengua.toUpperCase()}) con condiciones_del_partido como principal ⇒ V8`, () => {
        const h = hecho(caso!, "condiciones_del_partido");
        const [es, en] = lengua === "es" ? [`${sin(h.texto_es)}; ${frase}.`, h.texto_en] : [h.texto_es, `${sin(h.texto_en)}; ${frase}.`];
        expect(motivos(caso!, h, es, en).some((m) => m.regla === "V8" && m.detalle.includes("cancha_incomoda"))).toBe(true);
      });
    }
  }
});
