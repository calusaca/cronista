// Brief 012 — cierre de la auditoría consolidada 008–011, lado vivo y crónica:
// A (cierre / balance / futuro en vivo), B (figura), C (empate computable), D (definitivo),
// E (pruebas para P05–P08 y P10). Las mentiras son LÉXICAS: sin cifras inventadas (V3 no
// las atrapa), así que solo pasan por la regla que se prueba. Cada una, por idioma y por
// separado: la mentira en un idioma con el otro limpio.
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import type { Hecho } from "../../analista/tipos";
import { borradorDesdeHechos } from "../../lib/llm-stub";
import { mensajeInicial } from "../../cadena/prompt";
import type { Motivo, Oracion } from "../../cadena/tipos";
import { verificarDraft } from "../../cadena/verificador";
import { FUTURO } from "../../cadena/lexico";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Partido } from "../../sim/tipos";
import { hechoEnVivo } from "../enVivo";
import { detectarMomentos, hechosDelMomento, prefijo } from "../momentos";
import { contextoDelMomento, verificarOracionesUpdate } from "../updates";

const partidoDe = (s: number) => simular(configDeSemilla(s));
const sinPunto = (t: string) => t.replace(/\.$/, "");

/** Contexto de una update: su principal, sus hechos y el prefijo. */
function momento(seed: number, id: string) {
  const p = partidoDe(seed);
  const m = detectarMomentos(p).find((x) => x.id === id);
  if (!m) throw new Error(`fixture: la semilla ${seed} no tiene el momento ${id}`);
  const c = contextoDelMomento(p, m, "neutral");
  const motivos = (es: string, en: string) => verificarOracionesUpdate([{ texto_es: es, texto_en: en, hecho: c.principal.id }], c.hechos, c.pre, c.principal.id, m.tipo === "final");
  return { p, m, ...c, motivos };
}

type Familia = "cierre" | "balance" | "futuro";
const MARCA: Record<Familia, string> = { cierre: "cierre en vivo", balance: "balance posterior", futuro: "tiempo futuro" };

/** Mentiras léxicas del informe (A1/A2), con su familia. Sufijos sin cifras. */
const MENTIRAS: { familia: Familia; es: string; en: string }[] = [
  // A1 — partido terminado antes del final
  { familia: "cierre", es: "; resultado final", en: "; full time" },
  { familia: "cierre", es: "; el partido terminó así", en: "; the match ended that way" },
  { familia: "cierre", es: "; así cerró el marcador", en: "; that completed the scoring" },
  // A2 — decidido / sentenciado
  { familia: "cierre", es: "; con eso sentenció el partido", en: "; that sealed it" },
  { familia: "cierre", es: "; el gol encaminó la victoria", en: "; on course for victory" },
  { familia: "cierre", es: "; un tanto definitivo", en: "; a decisive strike" },
  { familia: "cierre", es: "; fue el gol del triunfo", en: "; that sealed the win" },
  // A2 — balance posterior
  { familia: "balance", es: "; luego resistió", en: "; from there they held on" },
  { familia: "balance", es: "; a continuación aguantó", en: "; subsequently they held firm" },
  { familia: "balance", es: "; y en lo que quedaba aguantó", en: "; and for the remainder they held firm" },
  { familia: "balance", es: "; posteriormente resistió", en: "; later they held on" },
  // A2 — futuro / condicional / perífrasis
  { familia: "futuro", es: "; terminaría imponiéndose", en: "; they would go on to win" },
  { familia: "futuro", es: "; el equipo va a ganar", en: "; the side looks set to win" },
  { familia: "futuro", es: "; sería suficiente", en: "; they are on course to win" },
];

/** Momentos del informe: semilla 1 (gol-e039 al 39'), 2 (gol-e022) y 7 (gol-e046). */
const MOMENTOS: [number, string][] = [
  [1, "gol-e039"],
  [2, "gol-e022"],
  [7, "gol-e046"],
];

describe("012 §A · cierre, balance y futuro en vivo — la batería del informe, por idioma", () => {
  for (const [seed, id] of MOMENTOS) {
    const c = momento(seed, id);
    const es0 = sinPunto(c.principal.texto_es);
    const en0 = sinPunto(c.principal.texto_en);

    it(`semilla ${seed} ${id}: la plantilla limpia pasa (punto de partida)`, () => {
      expect(c.motivos(c.principal.texto_es, c.principal.texto_en)).toEqual([]);
    });

    it.each(MENTIRAS.map((x) => [x.familia, x.es, x] as const))(`semilla ${seed} ${id} · %s · ES sola «%s» ⇒ rechazada en ES`, (_f, _e, x) => {
      const ms = c.motivos(`${es0}${x.es}.`, c.principal.texto_en);
      expect(ms.some((m) => m.detalle.includes(MARCA[x.familia]) && m.detalle.includes("(ES)")), JSON.stringify(ms)).toBe(true);
    });

    it.each(MENTIRAS.map((x) => [x.familia, x.en, x] as const))(`semilla ${seed} ${id} · %s · EN sola «%s» ⇒ rechazada en EN`, (_f, _e, x) => {
      const ms = c.motivos(c.principal.texto_es, `${en0}${x.en}.`);
      expect(ms.some((m) => m.detalle.includes(MARCA[x.familia]) && m.detalle.includes("(EN)")), JSON.stringify(ms)).toBe(true);
    });
  }

  it("A1 literal: «Resultado final» al minuto 39 de la semilla 1 (cifras correctas del prefijo) ⇒ rechazado por cierre", () => {
    const c = momento(1, "gol-e039");
    const L = c.p.config.local.nombre;
    const V = c.p.config.visita.nombre;
    const ms = c.motivos(`Resultado final: ${L} 2–0 ${V}.`, `Full time: ${L} 2–0 ${V}.`);
    expect(ms.filter((m) => m.detalle.startsWith("cierre en vivo")).map((m) => m.detalle.slice(-4))).toEqual(["(ES)", "(EN)"]);
  });

  describe("verdades de control", () => {
    it("en el momento FINAL, «sentenció / sealed it» y «resultado final» SÍ pasan", () => {
      const c = momento(246, "final-e118");
      expect(c.principal.tipo).toBe("resultado_final");
      const ms = c.motivos(`${sinPunto(c.principal.texto_es)}; con eso sentenció el partido.`, `${sinPunto(c.principal.texto_en)}; that sealed it.`);
      expect(ms).toEqual([]);
    });

    it("en el DESCANSO, «el primer tiempo terminó / the first half ended» SÍ pasa (no declara el partido terminado)", () => {
      const c = momento(246, "descanso-e042");
      const ms = c.motivos(`${sinPunto(c.principal.texto_es)}; así el primer tiempo terminó.`, `${sinPunto(c.principal.texto_en)}; so the first half ended.`);
      expect(ms).toEqual([]);
    });

    it("la plantilla de cada momento del corpus 1..60 pasa (cero falsos positivos de las reglas nuevas en el camino del stub)", () => {
      const fallas: string[] = [];
      for (let s = 1; s <= 60; s++) {
        const p = partidoDe(s);
        for (const m of detectarMomentos(p)) {
          const c = contextoDelMomento(p, m, "neutral");
          const ms = verificarOracionesUpdate([{ texto_es: c.principal.texto_es, texto_en: c.principal.texto_en, hecho: c.principal.id }], c.hechos, c.pre, c.principal.id, m.tipo === "final");
          if (ms.length) fallas.push(`${s} ${m.id}: ${ms.map((x) => x.detalle).join(" | ")}`);
        }
      }
      expect(fallas).toEqual([]);
    });

    it("el condicional es una lista de verbos: «categoría, mayoría, galería, alegría» no son futuro", () => {
      const re = new RegExp(FUTURO.es.source, "iu");
      for (const w of ["la categoría", "la mayoría", "la galería", "la alegría", "una teoría"]) expect(re.test(w), w).toBe(false);
      for (const w of ["terminaría", "va a ganar", "sería"]) expect(re.test(w), w).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------------
// B, C, D — en la crónica completa (y C también en vivo)
// ---------------------------------------------------------------------------------

/** Motivos de la crónica completa con la oración del hecho `id` reemplazada. */
function cronicaCon(p: Partido, hechos: Hecho[], id: string, es: string, en: string): Motivo[] {
  const d = borradorDesdeHechos(mensajeInicial(hechos));
  const i = d.oraciones.findIndex((o) => o.hecho === id);
  const o: Oracion = { texto_es: es, texto_en: en, hecho: id };
  d.oraciones[i] = o;
  return verificarDraft(d, hechos, p).filter((m) => m.oracion === i);
}

describe("012 §B · figura: léxico ampliado, ES y EN por separado (semilla 246)", () => {
  const p = partidoDe(246);
  const hs = analizar(p);
  const portero = hs.find((h) => h.tipo === "portero_destacado")!;
  const doraena = hs.find((h) => h.tipo === "gol_anotado" && h.datos.jugador === "Dante Doraena")!;
  const fig = hs.find((h) => h.tipo === "figura_del_partido")!;
  const FRASES: [string, string][] = [
    ["fue el mejor de la cancha", "was the best player on the pitch"],
    ["fue el mejor hombre", "was the star man"],
    ["fue el hombre más destacado", "was the man of the hour"],
    ["fue la estrella del partido", "was the best player"],
  ];

  for (const principal of [portero, doraena]) {
    it.each(FRASES)(`${principal.tipo}: ES sola «%s» ⇒ V8 (ES)`, (es) => {
      const ms = cronicaCon(p, hs, principal.id, `${sinPunto(principal.texto_es)}; ${principal.datos.jugador ?? principal.datos.portero} ${es}.`, principal.texto_en);
      expect(ms.some((m) => m.regla === "V8" && m.detalle.includes("(ES)")), JSON.stringify(ms)).toBe(true);
    });
    it.each(FRASES)(`${principal.tipo}: EN sola «%s» ⇒ V8 (EN)`, (_es, en) => {
      const ms = cronicaCon(p, hs, principal.id, principal.texto_es, `${sinPunto(principal.texto_en)}; ${principal.datos.jugador ?? principal.datos.portero} ${en}.`);
      expect(ms.some((m) => m.regla === "V8" && m.detalle.includes("(EN)")), JSON.stringify(ms)).toBe(true);
    });
  }

  it.each(FRASES)("con figura_del_partido como principal, «%s / %s» SÍ pasa", (es, en) => {
    const j = fig.datos.jugador as string;
    const n = fig.datos.nota as string;
    expect(cronicaCon(p, hs, fig.id, `${j} ${es} (nota ${n}).`, `${j} ${en} (rating ${n}).`)).toEqual([]);
  });
});

describe("012 §C · «empató / equalised» computable con un gol como principal (semilla 7)", () => {
  const p = partidoDe(7);
  const hs = analizar(p);
  const goles = hs.filter((h) => h.tipo === "gol_anotado");
  const igualador = goles.find((h) => h.datos.marcador_local === h.datos.marcador_visita)!;
  const otro = goles.find((h) => h.datos.marcador_local !== h.datos.marcador_visita)!;
  const frase = (h: Hecho, es: string, en: string) =>
    [
      `${h.datos.jugador} (${h.datos.equipo}) ${es} en el minuto ${h.datos.minuto}; ${h.datos.local} ${h.datos.marcador_local}–${h.datos.marcador_visita} ${h.datos.visita}.`,
      `${h.datos.jugador} (${h.datos.equipo}) ${en} in minute ${h.datos.minuto}; ${h.datos.local} ${h.datos.marcador_local}–${h.datos.marcador_visita} ${h.datos.visita}.`,
    ] as const;

  it("el gol del 1–1 existe (fixture del informe: gol-e046)", () => {
    expect(igualador.eventos).toContain("e046");
  });

  it.each([
    ["empató", "equalised"],
    ["igualó", "drew level"],
  ])("«%s / %s» con el gol que iguala ⇒ pasa en la crónica", (es, en) => {
    const [tes, ten] = frase(igualador, es, en);
    expect(cronicaCon(p, hs, igualador.id, tes, ten)).toEqual([]);
  });

  it("y pasa en vivo, en el momento gol-e046", () => {
    const c = momento(7, "gol-e046");
    const [tes, ten] = frase(c.principal, "empató", "equalised");
    expect(c.motivos(tes, ten)).toEqual([]);
  });

  it("la misma frase con un gol que NO iguala ⇒ V8", () => {
    const [tes, ten] = frase(otro, "empató", "equalised");
    expect(cronicaCon(p, hs, otro.id, tes, ten).some((m) => m.regla === "V8")).toBe(true);
  });
});

describe("012 §D · «definitivo / settled the match» computable (semilla 246, final 4–1)", () => {
  const p = partidoDe(246);
  const hs = analizar(p);
  const goles = hs.filter((h) => h.tipo === "gol_anotado");
  const ultimo = goles.find((h) => h.eventos.includes("e079"))!; // Doraena 67', 4–1
  const primero = goles.find((h) => h.eventos.includes("e005"))!; // Mariosa 3', 1–0
  const frase = (h: Hecho) =>
    [
      `${sinPunto(h.texto_es)}: el gol definitivo.`,
      `${sinPunto(h.texto_en)}: that settled the match.`,
    ] as const;

  it("el último gol del partido, del ganador ⇒ pasa", () => {
    const [es, en] = frase(ultimo);
    expect(cronicaCon(p, hs, ultimo.id, es, en)).toEqual([]);
  });

  it("un gol anterior ⇒ V8 en ES y en EN", () => {
    const [es, en] = frase(primero);
    const ms = cronicaCon(p, hs, primero.id, es, en);
    expect(ms.filter((m) => m.regla === "V8").map((m) => m.detalle.slice(-4)).sort()).toEqual(["(EN)", "(ES)"]);
  });

  it("en vivo, antes del final, ni siquiera el último gol puede ser «definitivo» (cierre)", () => {
    const c = momento(246, "gol-e079");
    const ms = c.motivos(`${sinPunto(c.principal.texto_es)}: el gol definitivo.`, c.principal.texto_en);
    expect(ms.some((m) => m.detalle.startsWith("cierre en vivo"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------------
// E — pruebas para las mutaciones supervivientes P05 y P10 (P06–P08 las cubre §A por
// idioma; P12 vive en src/sim/__tests__/espacial.test.ts)
// ---------------------------------------------------------------------------------

describe("012 §E · P05 y P10", () => {
  it("P05: semilla 7, gol-e046 — el análisis del prefijo tiene una remontada, pero NO llega al Cronista", () => {
    const p = partidoDe(7);
    const m = detectarMomentos(p).find((x) => x.id === "gol-e046")!;
    expect(analizar(prefijo(p, m)).some((h) => h.tipo === "remontada")).toBe(true);
    expect(contextoDelMomento(p, m, "neutral").hechos.some((h) => h.tipo === "remontada")).toBe(false);
  });

  it("P10: hechoEnVivo recorta la evidencia posterior a la roja (defensa en profundidad, con un hecho fabricado)", () => {
    const p = partidoDe(246);
    const exp = analizar(p).find((h) => h.tipo === "expulsion_y_efecto")!;
    expect(exp.eventos).toContain("e079"); // el del partido entero cita el gol posterior
    const vivo = hechoEnVivo(exp, p);
    const idx = new Map(p.eventos.map((e, i) => [e.id, i]));
    const roja = idx.get("e077")!;
    expect(vivo.eventos).not.toContain("e079");
    for (const e of vivo.eventos) expect(idx.get(e)!).toBeLessThanOrEqual(roja);
  });

  it("P10 en el corpus 1..200: ninguna expulsión en vivo cita un evento con id posterior al de su roja", () => {
    const fallas: string[] = [];
    for (let s = 1; s <= 200; s++) {
      const p = partidoDe(s);
      for (const m of detectarMomentos(p).filter((x) => x.tipo !== "final")) {
        for (const h of hechosDelMomento(p, m).filter((x) => x.tipo === "expulsion_y_efecto")) {
          const roja = h.eventos.find((id) => p.eventos.find((e) => e.id === id)?.tipo === "tarjeta_roja")!;
          for (const id of h.eventos) if (id > roja) fallas.push(`${s} ${m.id} ${h.id}: ${id} > ${roja}`);
        }
      }
    }
    expect(fallas).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------
// Rev 1.1 — las frases LITERALES del informe del auditor (A1–A4), tal cual las citó Fable.
// Cada una en su idioma con el otro texto limpio (la plantilla del principal).
// ---------------------------------------------------------------------------------

describe("012 rev 1.1 · frases literales del informe del auditor", () => {
  type Caso = { nombre: string; es?: string; en?: string; familia: Familia };
  const correr = (seed: number, id: string, casos: Caso[]) => {
    const c = momento(seed, id);
    for (const k of casos) {
      if (k.es) {
        it(`semilla ${seed} ${id} · ES «${k.nombre}» ⇒ rechazada (${k.familia}, ES)`, () => {
          const ms = c.motivos(k.es!, c.principal.texto_en);
          expect(ms.some((m) => m.detalle.includes(MARCA[k.familia]) && m.detalle.includes("(ES)")), JSON.stringify(ms)).toBe(true);
        });
      }
      if (k.en) {
        it(`semilla ${seed} ${id} · EN «${k.nombre}» ⇒ rechazada (${k.familia}, EN)`, () => {
          const ms = c.motivos(c.principal.texto_es, k.en!);
          expect(ms.some((m) => m.detalle.includes(MARCA[k.familia]) && m.detalle.includes("(EN)")), JSON.stringify(ms)).toBe(true);
        });
      }
    }
  };

  // A1 — semilla 1, gol-e039 (minuto 39), principal el gol de Ulvelueta.
  correr(1, "gol-e039", [
    {
      nombre: "el partido terminó / the match ended",
      familia: "cierre",
      es: "Ismael Ulvelueta (Deportivo Valdecristal) marcó en el minuto 39 y el partido terminó Deportivo Valdecristal 2–0 Sporting Ventolera.",
      en: "Ismael Ulvelueta (Deportivo Valdecristal) scored in minute 39 and the match ended Deportivo Valdecristal 2–0 Sporting Ventolera.",
    },
    {
      nombre: "Resultado final / Full time",
      familia: "cierre",
      es: "Resultado final: Deportivo Valdecristal 2–0 Sporting Ventolera, con gol de Ismael Ulvelueta (Deportivo Valdecristal) en el minuto 39.",
      en: "Full time: Deportivo Valdecristal 2–0 Sporting Ventolera, with a goal from Ismael Ulvelueta (Deportivo Valdecristal) in minute 39.",
    },
    {
      nombre: "el gol que cerró el marcador / to complete the scoring",
      familia: "cierre",
      es: "Ismael Ulvelueta (Deportivo Valdecristal) marcó en el minuto 39 el gol que cerró el marcador: Deportivo Valdecristal 2–0 Sporting Ventolera.",
      en: "Ismael Ulvelueta (Deportivo Valdecristal) scored in minute 39 to complete the scoring: Deportivo Valdecristal 2–0 Sporting Ventolera.",
    },
    // A2 — semilla 1, minuto 39
    {
      nombre: "sentenció el partido / sealed the win",
      familia: "cierre",
      es: "Ismael Ulvelueta (Deportivo Valdecristal) marcó en el minuto 39 y sentenció el partido.",
      en: "Ismael Ulvelueta (Deportivo Valdecristal) scored in minute 39 and sealed the win.",
    },
    {
      nombre: "encaminó la victoria / on course for victory",
      familia: "cierre",
      es: "Ismael Ulvelueta (Deportivo Valdecristal) marcó en el minuto 39 y encaminó la victoria.",
      en: "Ismael Ulvelueta (Deportivo Valdecristal) scored in minute 39 and put his side on course for victory.",
    },
    {
      nombre: "terminaría siendo definitivo / would prove decisive",
      familia: "futuro",
      es: "Ismael Ulvelueta (Deportivo Valdecristal) marcó en el minuto 39, un resultado que terminaría siendo definitivo.",
      en: "Ismael Ulvelueta (Deportivo Valdecristal) scored in minute 39, a result that would prove decisive.",
    },
  ]);

  // A2 — semilla 1, descanso
  correr(1, "descanso-e051", [
    {
      nombre: "sentenció el partido / sealed the win",
      familia: "cierre",
      es: "Al descanso: Deportivo Valdecristal 2–0 Sporting Ventolera; Deportivo Valdecristal sentenció el partido.",
      en: "Half time: Deportivo Valdecristal 2–0 Sporting Ventolera; Deportivo Valdecristal sealed the win.",
    },
    {
      nombre: "encaminó la victoria / on course for victory",
      familia: "cierre",
      es: "Al descanso: Deportivo Valdecristal 2–0 Sporting Ventolera; Deportivo Valdecristal encaminó la victoria.",
      en: "Half time: Deportivo Valdecristal 2–0 Sporting Ventolera; Deportivo Valdecristal are on course for victory.",
    },
    {
      nombre: "terminaría siendo definitivo / would prove decisive",
      familia: "futuro",
      es: "Al descanso: Deportivo Valdecristal 2–0 Sporting Ventolera, un resultado que terminaría siendo definitivo.",
      en: "Half time: Deportivo Valdecristal 2–0 Sporting Ventolera, a result that would prove decisive.",
    },
  ]);

  // A2 — semilla 2, roja (minuto 39)
  const roja2 = "Gael Mendinánez (Racing Arenablanca) vio la roja directa en el minuto 39, con Racing Arenablanca 1–0 Deportivo Pradoalto";
  const red2 = "Gael Mendinánez (Racing Arenablanca) was shown a straight red card in minute 39, with Racing Arenablanca 1–0 Deportivo Pradoalto";
  correr(2, "roja-e044", [
    { nombre: "y luego … resistió / subsequently held on", familia: "balance", es: `${roja2}, y luego Racing Arenablanca resistió.`, en: `${red2}; Racing Arenablanca subsequently held on.` },
    { nombre: "en lo que quedaba / for the remainder", familia: "balance", es: `${roja2}; Racing Arenablanca aguantó con diez en lo que quedaba.`, en: `${red2}; Racing Arenablanca held on with ten men for the remainder.` },
    { nombre: "va a sufrir con diez / looks set to suffer", familia: "futuro", es: `${roja2}; Racing Arenablanca va a sufrir con diez.`, en: `${red2}; Racing Arenablanca looks set to suffer with ten men.` },
    { nombre: "a continuación … se replegó / from there … sat deep", familia: "balance", es: `${roja2}; a continuación Racing Arenablanca se replegó.`, en: `${red2}; from there Racing Arenablanca sat deep.` },
  ]);

  // A3 — semilla 246, figura con otros principales (crónica completa)
  describe("A3 · semilla 246", () => {
    const p = partidoDe(246);
    const hs = analizar(p);
    const portero = hs.find((h) => h.tipo === "portero_destacado")!;
    const doraena = hs.find((h) => h.tipo === "gol_anotado" && h.datos.jugador === "Dante Doraena")!;
    const v8 = (ms: Motivo[], lengua: string) => ms.some((m) => m.regla === "V8" && m.detalle.endsWith(`(${lengua})`));

    it("portero principal: «fue el mejor de la cancha con 8 atajadas» (ES) ⇒ V8", () => {
      expect(v8(cronicaCon(p, hs, portero.id, "Aarón Celoón (Juventud Islaverde Sur) fue el mejor de la cancha con 8 atajadas.", portero.texto_en), "ES")).toBe(true);
    });
    it("portero principal: «was the best player on the pitch with 8 saves» (EN) ⇒ V8", () => {
      expect(v8(cronicaCon(p, hs, portero.id, portero.texto_es, "Aarón Celoón (Juventud Islaverde Sur) was the best player on the pitch with 8 saves."), "EN")).toBe(true);
    });
    it("Doraena principal: «el mejor hombre de la cancha» (ES) ⇒ V8", () => {
      expect(v8(cronicaCon(p, hs, doraena.id, "Dante Doraena, el mejor hombre de la cancha, marcó en el minuto 67.", doraena.texto_en), "ES")).toBe(true);
    });
    it("Doraena principal: «the star man» (EN) ⇒ V8", () => {
      expect(v8(cronicaCon(p, hs, doraena.id, doraena.texto_es, "Dante Doraena, the star man, scored in minute 67."), "EN")).toBe(true);
    });
    it("«el hombre más destacado» en ES con el EN limpio (hoy pasaba sola) ⇒ V8", () => {
      expect(v8(cronicaCon(p, hs, doraena.id, "Dante Doraena, el hombre más destacado, marcó en el minuto 67.", doraena.texto_en), "ES")).toBe(true);
    });
    it("verdades de control del auditor: «MVP» sigue cayendo en V4 y «standout» en V8 (EN)", () => {
      expect(cronicaCon(p, hs, doraena.id, "Dante Doraena, el MVP, marcó en el minuto 67.", doraena.texto_en).some((m) => m.regla === "V4")).toBe(true);
      expect(v8(cronicaCon(p, hs, doraena.id, doraena.texto_es, "Dante Doraena, the standout, scored in minute 67."), "EN")).toBe(true);
    });
  });

  // A4 — «gol definitivo»
  describe("A4 · gol definitivo", () => {
    const es18 = "Teo Paloido (Deportivo Pradoalto) marcó en el minuto 87 el gol definitivo; Deportivo Pradoalto 3–2 Racing Solcanto.";
    const en18 = "Teo Paloido (Deportivo Pradoalto) scored in minute 87 to settle the match; Deportivo Pradoalto 3–2 Racing Solcanto.";

    it("semilla 18, gol del 87' (el último, del ganador 3–2): pasa en la crónica completa", () => {
      const p = partidoDe(18);
      const hs = analizar(p);
      const g = hs.find((h) => h.tipo === "gol_anotado" && h.datos.minuto === "87")!;
      const fin = hs.find((h) => h.tipo === "resultado_final")!;
      // independiente de la regla: es el último gol y del ganador
      expect([g.datos.marcador_local, g.datos.marcador_visita]).toEqual([fin.datos.goles_local, fin.datos.goles_visita]);
      expect(cronicaCon(p, hs, g.id, es18, en18)).toEqual([]);
    });
    it("y en vivo, en su momento (gol-e077, antes del final), la misma frase se rechaza por cierre en ES y en EN", () => {
      const c = momento(18, "gol-e077");
      expect(c.motivos(es18, c.principal.texto_en).some((m) => m.detalle.startsWith("cierre en vivo") && m.detalle.endsWith("(ES)"))).toBe(true);
      expect(c.motivos(c.principal.texto_es, en18).some((m) => m.detalle.startsWith("cierre en vivo") && m.detalle.endsWith("(EN)"))).toBe(true);
    });
    it("246, crónica completa: «el gol definitivo / to settle the match» solo con el último gol del ganador", () => {
      const p = partidoDe(246);
      const hs = analizar(p);
      const goles = hs.filter((h) => h.tipo === "gol_anotado");
      const ultimo = goles.find((h) => h.eventos.includes("e079"))!;
      const otro = goles.find((h) => h.eventos.includes("e031"))!;
      const con = (h: Hecho) => cronicaCon(p, hs, h.id, `${sinPunto(h.texto_es)}: el gol definitivo.`, `${sinPunto(h.texto_en)}, to settle the match.`);
      expect(con(ultimo)).toEqual([]);
      expect(con(otro).filter((m) => m.regla === "V8").map((m) => m.detalle.slice(-4)).sort()).toEqual(["(EN)", "(ES)"]);
    });
  });
});
