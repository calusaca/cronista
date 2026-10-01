// Suite estadística — props. 7–12 del brief 001. `npm run test:stats`.
// Corpus: semillas 1..N_ESTADISTICA. Todos los umbrales vienen de limites.ts.
import { describe, expect, it } from "vitest";
import {
  AMARILLAS_MEDIA,
  ESTILOS,
  GOLES_FRANJA,
  GOLES_MEDIA,
  N_ESTADISTICA,
  ROJA_MAX_FRACCION,
  ROJA_MIN_FRACCION,
  VENTAJA_FUERTE,
  XG_MEDIA,
} from "../limites";
import { simular } from "../motor";
import { configDeSemilla } from "../plantillas";
import { franjaDe, golesConPeriodo, resumir, type Resumen } from "../resumen";
import type { Estilo, Partido } from "../tipos";

const SEMILLAS = Array.from({ length: N_ESTADISTICA }, (_, i) => i + 1);
const ESTILOS_TODOS: readonly Estilo[] = ["posesion", "contragolpe", "presion"];

// Corpus general: equipos ficticios derivados de cada semilla (ratings y estilos variados).
const corpus: { p: Partido; r: Resumen }[] = SEMILLAS.map((s) => {
  const p = simular(configDeSemilla(s));
  return { p, r: resumir(p) };
});

const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function informe(etiqueta: string, valor: number | string): void {
  console.log(`[stats] ${etiqueta}: ${valor}`);
}

describe(`suite estadística, N = ${N_ESTADISTICA}`, () => {
  it("prop. 7 — media de goles por partido dentro de GOLES_MEDIA", () => {
    const m = media(corpus.map(({ r }) => r.local.goles + r.visita.goles));
    informe("goles/partido", m.toFixed(3));
    expect(m).toBeGreaterThanOrEqual(GOLES_MEDIA.min);
    expect(m).toBeLessThanOrEqual(GOLES_MEDIA.max);
  });

  it("prop. 8 — cada franja de 15' recibe una fracción de goles dentro de GOLES_FRANJA", () => {
    const cuenta = Array.from({ length: GOLES_FRANJA.franjas }, () => 0);
    for (const { p } of corpus) for (const g of golesConPeriodo(p)) cuenta[franjaDe(g.minuto, g.periodo)]! += 1;
    const total = cuenta.reduce((a, b) => a + b, 0);
    const frac = cuenta.map((c) => c / total);
    informe("fracción por franja", frac.map((f) => f.toFixed(3)).join(" | "));
    frac.forEach((f, i) => {
      expect(f, `franja ${i} por debajo del mínimo`).toBeGreaterThanOrEqual(GOLES_FRANJA.min);
      // La última franja incluye el descuento: puede ir por encima del máximo.
      if (i < GOLES_FRANJA.franjas - 1) expect(f, `franja ${i} por encima del máximo`).toBeLessThanOrEqual(GOLES_FRANJA.max);
    });
  });

  it("prop. 9 — media de xG total dentro de XG_MEDIA; el de más xG gana más de lo que pierde", () => {
    const m = media(corpus.map(({ r }) => r.local.xg + r.visita.xg));
    informe("xG total/partido", m.toFixed(3));
    expect(m).toBeGreaterThanOrEqual(XG_MEDIA.min);
    expect(m).toBeLessThanOrEqual(XG_MEDIA.max);

    let gana = 0;
    let empata = 0;
    let pierde = 0;
    for (const { r } of corpus) {
      if (r.local.xg === r.visita.xg) continue;
      const [mas, menos] = r.local.xg > r.visita.xg ? [r.local, r.visita] : [r.visita, r.local];
      if (mas.goles > menos.goles) gana++;
      else if (mas.goles < menos.goles) pierde++;
      else empata++;
    }
    informe("equipo con más xG G/E/P", `${gana}/${empata}/${pierde}`);
    expect(gana).toBeGreaterThan(pierde);
  });

  it("prop. 10 — el fuerte gana un porcentaje dentro de VENTAJA_FUERTE", () => {
    let gana = 0;
    let empata = 0;
    let pierde = 0;
    for (const s of SEMILLAS) {
      // Se alterna la localía y se rotan los estilos para no sesgar por ninguno de los dos.
      const fuerteLocal = s % 2 === 1;
      const fuerte = { ...VENTAJA_FUERTE.fuerte, estilo: ESTILOS_TODOS[s % 3] as Estilo };
      const debil = { ...VENTAJA_FUERTE.debil, estilo: ESTILOS_TODOS[(s + 1) % 3] as Estilo };
      const r = resumir(simular(fuerteLocal ? configDeSemilla(s, fuerte, debil) : configDeSemilla(s, debil, fuerte)));
      const gf = fuerteLocal ? r.local.goles : r.visita.goles;
      const gd = fuerteLocal ? r.visita.goles : r.local.goles;
      if (gf > gd) gana++;
      else if (gf === gd) empata++;
      else pierde++;
    }
    const frac = gana / SEMILLAS.length;
    informe("fuerte G/E/P", `${gana}/${empata}/${pierde} → gana ${(frac * 100).toFixed(1)} %`);
    expect(frac).toBeGreaterThanOrEqual(VENTAJA_FUERTE.min);
    expect(frac).toBeLessThanOrEqual(VENTAJA_FUERTE.max);
  });

  it("prop. 11 — amarillas por partido dentro de AMARILLAS_MEDIA; roja en menos de ROJA_MAX_FRACCION", () => {
    const m = media(corpus.map(({ r }) => r.local.amarillas + r.visita.amarillas));
    const conRoja = corpus.filter(({ r }) => r.local.rojas + r.visita.rojas > 0).length / corpus.length;
    informe("amarillas/partido", m.toFixed(3));
    informe("fracción de partidos con roja", conRoja.toFixed(3));
    expect(m).toBeGreaterThanOrEqual(AMARILLAS_MEDIA.min);
    expect(m).toBeLessThanOrEqual(AMARILLAS_MEDIA.max);
    expect(conRoja).toBeLessThan(ROJA_MAX_FRACCION);
    expect(conRoja).toBeGreaterThanOrEqual(ROJA_MIN_FRACCION);
  });

  it("prop. 12 — los tres estilos son distinguibles según ESTILOS", () => {
    const m: Record<Estilo, { pasesClave: number; xgPorTiro: number; faltas: number }> = {} as never;
    for (const estilo of ESTILOS_TODOS) {
      let pc = 0;
      let xg = 0;
      let tiros = 0;
      let faltas = 0;
      for (const s of SEMILLAS) {
        const r = resumir(
          simular(
            configDeSemilla(
              s,
              { ataque: ESTILOS.rating, defensa: ESTILOS.rating, estilo },
              { ataque: ESTILOS.rating, defensa: ESTILOS.rating, estilo: ESTILOS_TODOS[s % 3] as Estilo },
            ),
          ),
        );
        pc += r.local.pasesClave;
        xg += r.local.xg;
        tiros += r.local.tiros;
        faltas += r.local.faltas;
      }
      m[estilo] = { pasesClave: pc / SEMILLAS.length, xgPorTiro: xg / tiros, faltas: faltas / SEMILLAS.length };
      informe(
        `estilo ${estilo}`,
        `pases clave ${m[estilo].pasesClave.toFixed(2)}, xG/tiro ${m[estilo].xgPorTiro.toFixed(3)}, faltas ${m[estilo].faltas.toFixed(2)}`,
      );
    }
    const ratio = (estilo: Estilo, k: "pasesClave" | "xgPorTiro" | "faltas") =>
      m[estilo][k] / Math.max(...ESTILOS_TODOS.filter((e) => e !== estilo).map((e) => m[e][k]));
    const rPos = ratio("posesion", "pasesClave");
    const rCon = ratio("contragolpe", "xgPorTiro");
    const rPre = ratio("presion", "faltas");
    informe("ratios posesión/contragolpe/presión", `${rPos.toFixed(3)} / ${rCon.toFixed(3)} / ${rPre.toFixed(3)}`);
    expect(rPos).toBeGreaterThanOrEqual(ESTILOS.pasesClavePosesionRatioMin);
    expect(rCon).toBeGreaterThanOrEqual(ESTILOS.xgPorTiroContragolpeRatioMin);
    expect(rPre).toBeGreaterThanOrEqual(ESTILOS.faltasPresionRatioMin);
  });
});
