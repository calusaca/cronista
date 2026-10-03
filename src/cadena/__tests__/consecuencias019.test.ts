// Brief 019 — hechos de consecuencias en el Analista y en el Verificador. ORÁCULO: cada lesión del
// partido ⇒ un lesion_en_partido que la cita (con su cambio y su falta); cada equipo con bajas en
// la config ⇒ un bajas_del_partido con sus cuentas. BATERÍA V8 (frase por frase, ES y EN por
// separado): «lesionado / injured» solo con su hecho; «suspendido / suspended» solo con un
// suspendido entre las bajas; «llegó sin / were without» solo con bajas_del_partido; «diezmado /
// depleted» solo con BAJAS_DIEZMADO_MIN bajas o más.
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import type { Hecho } from "../../analista/tipos";
import { TEMPORADA_ACTUAL } from "../../analista/umbrales";
import { borradorDesdeHechos } from "../../lib/llm-stub";
import { mundo } from "../../mundo/mundo";
import { configDePartidoLiga } from "../../mundo/temporada";
import { simular } from "../../sim/motor";
import type { Partido } from "../../sim/tipos";
import { FRASES_CONSECUENCIA } from "../lexico";
import { mensajeInicial } from "../prompt";
import type { Motivo } from "../tipos";
import { BAJAS_DIEZMADO_MIN } from "../umbrales";
import { verificarDraft, verificarOraciones } from "../verificador";

interface Caso {
  ref: string;
  p: Partido;
  hs: Hecho[];
}
const corpus: Caso[] = mundo()
  .ligas.slice(0, 3)
  .flatMap((liga) =>
    Array.from({ length: 90 }, (_, k) => {
      const j = Math.floor(k / 5) + 1;
      const i = (k % 5) + 1;
      const p = simular(configDePartidoLiga(liga, TEMPORADA_ACTUAL, j, i));
      return { ref: `${liga.id} ${j}/${i}`, p, hs: analizar(p) };
    }),
  );
const motivos = (c: Caso, h: Hecho, es: string, en: string): Motivo[] => verificarOraciones([{ texto_es: es, texto_en: en, hecho: h.id }], c.hs, c.p);
const sin = (t: string) => t.replace(/\.$/, "");
const de = (c: Caso, t: string) => c.hs.filter((h) => h.tipo === t);
const buscar = (pred: (h: Hecho) => boolean) => {
  for (const c of corpus) {
    const h = c.hs.find(pred);
    if (h) return { c, h };
  }
  throw new Error("fixture inexistente en el corpus de liga");
};

describe("019 · oráculo de los hechos de consecuencias (3 ligas)", () => {
  it("lesion_en_partido ⇔ cada evento lesion; cita la lesión, su cambio forzado y su falta (si la hubo)", () => {
    for (const c of corpus) {
      const ls = c.p.eventos.map((e, i) => ({ e, i })).filter(({ e }) => e.tipo === "lesion");
      const hs = de(c, "lesion_en_partido");
      expect(hs.length, c.ref).toBe(ls.length);
      for (const { e, i } of ls) {
        const h = hs.find((x) => x.eventos.includes(e.id))!;
        expect(h, `${c.ref} ${e.id}`).toBeDefined();
        const esperados = [e.id, c.p.eventos[i + 1]!.id, ...(e.relacionadoCon ? [e.relacionadoCon] : [])].sort();
        expect([...h.eventos].sort()).toEqual(esperados);
        expect([h.datos.jugador, h.datos.jornadas]).toEqual([e.jugador, e.baja]);
      }
    }
    expect(corpus.some((c) => de(c, "lesion_en_partido").length > 0)).toBe(true);
  });

  it("bajas_del_partido ⇔ el equipo trae bajas en la config; cuentas = las de la config", () => {
    for (const c of corpus) {
      for (const lado of ["local", "visita"] as const) {
        const bs = c.p.config.bajas?.[lado] ?? [];
        const h = de(c, "bajas_del_partido").find((x) => x.datos.equipo === c.p.config[lado].nombre);
        if (bs.length === 0) {
          expect(h, c.ref).toBeUndefined();
          continue;
        }
        expect([h?.datos.bajas, h?.datos.suspendidos, h?.datos.lesionados], c.ref).toEqual([bs.length, bs.filter((b) => b.motivo === "suspension").length, bs.filter((b) => b.motivo === "lesion").length]);
        for (const b of bs) expect(h!.texto_es.includes(b.jugador) && h!.texto_en.includes(b.jugador)).toBe(true);
      }
    }
  });
});

describe("019 · las plantillas pasan el Verificador (los ausentes son nombres del partido)", () => {
  it("cada lesion_en_partido y cada bajas_del_partido, con su plantilla, sin motivos", () => {
    const fallas: string[] = [];
    let vistos = 0;
    for (const c of corpus) {
      for (const h of c.hs.filter((x) => x.tipo === "lesion_en_partido" || x.tipo === "bajas_del_partido")) {
        vistos++;
        for (const m of motivos(c, h, h.texto_es, h.texto_en)) fallas.push(`${c.ref} ${h.tipo}: ${m.regla} ${m.detalle}`);
      }
    }
    expect(vistos).toBeGreaterThan(20);
    expect(fallas.slice(0, 10)).toEqual([]);
  });

  it("la crónica completa del stub pasa en los partidos con lesión o con bajas", () => {
    const fallas: string[] = [];
    for (const c of corpus.filter((x) => de(x, "lesion_en_partido").length + de(x, "bajas_del_partido").length > 0).slice(0, 25)) {
      for (const m of verificarDraft(borradorDesdeHechos(mensajeInicial(c.hs)), c.hs, c.p)) fallas.push(`${c.ref}: ${m.regla} ${m.detalle}`);
    }
    expect(fallas.slice(0, 10)).toEqual([]);
  });

  it("nombrar como baja a quien NO lo es ⇒ V4; inflar las jornadas de la lesión ⇒ V3", () => {
    const { c, h } = buscar((x) => x.tipo === "bajas_del_partido" && Number(x.datos.bajas) === 1);
    const lado = c.p.config.local.nombre === h.datos.equipo ? "visita" : "local";
    const ajeno = c.p.config[lado].jugadores[4]!.nombre;
    const baja = (c.p.config.bajas?.local ?? []).concat(c.p.config.bajas?.visita ?? []).find((b) => h.texto_es.includes(b.jugador))!.jugador;
    expect(motivos(c, h, h.texto_es.replace(baja, ajeno), h.texto_en.replace(baja, ajeno)).some((m) => m.regla === "V4")).toBe(true);
    const l = buscar((x) => x.tipo === "lesion_en_partido");
    const n = Number(l.h.datos.jornadas);
    const es = l.h.texto_es.replace(/baja de \d+/, `baja de ${n + 5}`);
    const en = l.h.texto_en.replace(/out for \d+/, `out for ${n + 5}`);
    expect(motivos(l.c, l.h, es, en).some((m) => m.regla === "V3")).toBe(true);
  });
});

describe("019 · batería V8 de consecuencias", () => {
  const lesion = buscar((x) => x.tipo === "lesion_en_partido");
  const gol = buscar((x) => x.tipo === "gol_anotado");
  const unaSusp = buscar((x) => x.tipo === "bajas_del_partido" && Number(x.datos.bajas) === 1 && Number(x.datos.suspendidos) === 1);
  const unaLes = buscar((x) => x.tipo === "bajas_del_partido" && Number(x.datos.bajas) === 1 && Number(x.datos.lesionados) === 1);
  const varias = buscar((x) => x.tipo === "bajas_del_partido" && Number(x.datos.bajas) >= BAJAS_DIEZMADO_MIN);
  const frase = (lengua: "es" | "en", h: Hecho, f: string): [string, string] => (lengua === "es" ? [`${sin(h.texto_es)}; ${f}.`, h.texto_en] : [h.texto_es, `${sin(h.texto_en)}; ${f}.`]);
  const v8 = (ms: Motivo[], id: string) => ms.some((m) => m.regla === "V8" && m.detalle.includes(id));

  for (const lengua of ["es", "en"] as const) {
    const L = lengua.toUpperCase();
    for (const f of FRASES_CONSECUENCIA.lesion[lengua]) {
      it(`lesión · «${f}» (${L}): con un gol ⇒ V8; con lesion_en_partido o bajas con un lesionado ⇒ pasa; con bajas solo de suspendidos ⇒ V8`, () => {
        expect(v8(motivos(gol.c, gol.h, ...frase(lengua, gol.h, f)), "lesion")).toBe(true);
        expect(motivos(lesion.c, lesion.h, ...frase(lengua, lesion.h, f))).toEqual([]);
        expect(motivos(unaLes.c, unaLes.h, ...frase(lengua, unaLes.h, f))).toEqual([]);
        expect(v8(motivos(unaSusp.c, unaSusp.h, ...frase(lengua, unaSusp.h, f)), "lesion")).toBe(true);
      });
    }
    for (const f of FRASES_CONSECUENCIA.suspension[lengua]) {
      it(`sanción · «${f}» (${L}): con un suspendido ⇒ pasa; con bajas solo de lesionados o con la lesión ⇒ V8`, () => {
        expect(motivos(unaSusp.c, unaSusp.h, ...frase(lengua, unaSusp.h, f))).toEqual([]);
        expect(v8(motivos(unaLes.c, unaLes.h, ...frase(lengua, unaLes.h, f)), "suspendido")).toBe(true);
        expect(v8(motivos(lesion.c, lesion.h, ...frase(lengua, lesion.h, f)), "suspendido")).toBe(true);
      });
    }
    for (const f of FRASES_CONSECUENCIA.sin[lengua]) {
      it(`«${f}» (${L}): con bajas_del_partido ⇒ pasa (no es una negación); con otro principal ⇒ V8`, () => {
        expect(motivos(unaSusp.c, unaSusp.h, ...frase(lengua, unaSusp.h, f))).toEqual([]);
        expect(v8(motivos(gol.c, gol.h, ...frase(lengua, gol.h, f)), "bajas_del_partido")).toBe(true);
      });
    }
    for (const f of FRASES_CONSECUENCIA.diezmado[lengua]) {
      it(`«${f}» (${L}): con ${BAJAS_DIEZMADO_MIN}+ bajas ⇒ pasa; con UNA baja ⇒ V8; con un gol ⇒ V8`, () => {
        expect(motivos(varias.c, varias.h, ...frase(lengua, varias.h, f))).toEqual([]);
        expect(v8(motivos(unaSusp.c, unaSusp.h, ...frase(lengua, unaSusp.h, f)), "diezmado")).toBe(true);
        expect(v8(motivos(gol.c, gol.h, ...frase(lengua, gol.h, f)), "diezmado")).toBe(true);
      });
    }
  }
});
