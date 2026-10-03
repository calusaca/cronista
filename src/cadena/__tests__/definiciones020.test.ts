// Brief 020 — definiciones y autogoles en el Analista y el Verificador.
// ORÁCULO del autogol (liga): cada gol en propia puerta ⇒ un hecho `autogol` (el autor y SU equipo,
// el que lo sufre), ningún gol_anotado/doblete/gol temprano-tardío para él, y goleadores sin él.
// BATERÍA V8, frase por frase, ES y EN por separado: cada frase de definición solo con ESA
// definición registrada; «en propia puerta / own goal» solo con el autogol; con el autogol como
// principal, «marcó / scored» solo seguido de la propia puerta; acreditárselo al delantero ⇒ V4.
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import type { Hecho } from "../../analista/tipos";
import { valorar } from "../../analista/valoracion";
import { TEMPORADA_ACTUAL, VALORACION } from "../../analista/umbrales";
import { mundo } from "../../mundo/mundo";
import { configDePartidoLiga, simularTemporada } from "../../mundo/temporada";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import { ladoDelJugador, type Partido } from "../../sim/tipos";
import { FRASES_DEFINICION, PROPIA_PUERTA } from "../lexico";
import type { Motivo } from "../tipos";
import { verificarOraciones } from "../verificador";

interface Caso {
  ref: string;
  p: Partido;
  hs: Hecho[];
}
const liga = mundo().ligas[2]!;
const corpusLiga: Caso[] = Array.from({ length: 90 }, (_, k) => {
  const j = Math.floor(k / 5) + 1;
  const i = (k % 5) + 1;
  const p = simular(configDePartidoLiga(liga, TEMPORADA_ACTUAL, j, i));
  return { ref: `${j}/${i}`, p, hs: analizar(p) };
});
const sueltos: Caso[] = Array.from({ length: 800 }, (_, s) => {
  const p = simular(configDeSemilla(s + 1));
  return { ref: `seed ${s + 1}`, p, hs: analizar(p) };
});
const motivos = (c: Caso, h: Hecho, es: string, en: string): Motivo[] => verificarOraciones([{ texto_es: es, texto_en: en, hecho: h.id }], c.hs, c.p);
const sin = (t: string) => t.replace(/\.$/, "");
const buscar = (cs: Caso[], pred: (h: Hecho) => boolean) => {
  for (const c of cs) {
    const h = c.hs.find(pred);
    if (h) return { c, h };
  }
  throw new Error("fixture inexistente");
};

describe("020 · oráculo del autogol (liga)", () => {
  it("cada autogol ⇒ un hecho autogol con el autor y su equipo (el que lo sufre); ningún hecho de goleador para él", () => {
    let vistos = 0;
    for (const c of corpusLiga) {
      for (const g of c.p.eventos.filter((e) => e.tipo === "gol" && e.autogol === true)) {
        vistos++;
        const h = c.hs.find((x) => x.tipo === "autogol" && x.eventos.includes(g.id));
        expect(h, `${c.ref} ${g.id}`).toBeDefined();
        expect([h!.datos.jugador, h!.datos.equipo, h!.datos.beneficiado]).toEqual([g.jugador, c.p.config[ladoDelJugador(g)].nombre, c.p.config[g.equipo].nombre]);
        expect(h!.eventos).toContain(g.relacionadoCon);
        for (const t of ["gol_anotado", "doblete_o_mas", "gol_temprano", "gol_tardio"]) expect(c.hs.some((x) => x.tipo === t && x.eventos.includes(g.id)), `${c.ref} ${t}`).toBe(false);
        // valoración: el autor resta VALORACION.autogol
        const v = valorar(c.p).find((x) => x.jugador === g.jugador && x.lado === ladoDelJugador(g))!;
        expect(v.desglose.some((d) => d.evento === g.id && d.motivo === "autogol" && d.delta === VALORACION.autogol)).toBe(true);
      }
    }
    expect(vistos).toBeGreaterThan(0);
  });

  it("goleadores de la temporada: el autogol no cuenta (regla FIFA); la tabla sí lo cuenta para el que suma", () => {
    const t = simularTemporada(liga, TEMPORADA_ACTUAL);
    const autogoles = t.partidos.flatMap((r) => r.goles.filter((g) => g.autogol));
    expect(autogoles.length).toBeGreaterThan(0);
    const total = t.goleadores.reduce((s, g) => s + g.goles, 0);
    const marcadores = t.partidos.reduce((s, r) => s + r.golesLocal + r.golesVisita, 0);
    expect(total + autogoles.length).toBe(marcadores);
  });

  it("la plantilla del autogol pasa el Verificador; atribuírselo al tirador rival ⇒ V4; «marcó X» ⇒ V8; «marcó en propia puerta» pasa", () => {
    const { c, h } = buscar(corpusLiga, (x) => x.tipo === "autogol");
    expect(motivos(c, h, h.texto_es, h.texto_en)).toEqual([]);
    const g = c.p.eventos.find((e) => h.eventos.includes(e.id) && e.tipo === "gol")!;
    const tirador = c.p.eventos.find((e) => e.id === g.relacionadoCon)!.jugador!;
    const autor = String(h.datos.jugador);
    expect(motivos(c, h, h.texto_es.replace(autor, tirador), h.texto_en.replace(autor, tirador)).some((m) => m.regla === "V4")).toBe(true);
    const m = motivos(c, h, `${autor} (${h.datos.equipo}) marcó en el minuto ${h.datos.minuto}.`, `${autor} (${h.datos.equipo}) scored in minute ${h.datos.minuto}.`);
    expect(m.some((x) => x.regla === "V8" && x.detalle.endsWith("(ES)"))).toBe(true);
    expect(m.some((x) => x.regla === "V8" && x.detalle.endsWith("(EN)"))).toBe(true);
    expect(motivos(c, h, `${autor} (${h.datos.equipo}) marcó en propia puerta en el minuto ${h.datos.minuto}.`, `${autor} (${h.datos.equipo}) scored an own goal in minute ${h.datos.minuto}.`)).toEqual([]);
  });

  for (const lengua of ["es", "en"] as const) {
    for (const f of PROPIA_PUERTA[lengua]) {
      it(`«${f}» (${lengua.toUpperCase()}): con el autogol ⇒ pasa; con un gol normal ⇒ V8`, () => {
        const a = buscar(corpusLiga, (x) => x.tipo === "autogol");
        const g = buscar(sueltos, (x) => x.tipo === "gol_anotado");
        const con = (h: Hecho): [string, string] => (lengua === "es" ? [`${sin(h.texto_es)}; ${f}.`, h.texto_en] : [h.texto_es, `${sin(h.texto_en)}; ${f}.`]);
        expect(motivos(a.c, a.h, ...con(a.h))).toEqual([]);
        expect(motivos(g.c, g.h, ...con(g.h)).some((m) => m.regla === "V8" && m.detalle.includes("autogol"))).toBe(true);
      });
    }
  }
});

describe("020 · batería V8 de definiciones (la frase solo con ESA definición registrada)", () => {
  const defs = Object.keys(FRASES_DEFINICION) as (keyof typeof FRASES_DEFINICION)[];
  const jugada = buscar(sueltos, (x) => x.tipo === "gol_anotado" && x.datos.definicion === "jugada");
  for (const def of defs) {
    const conDef = buscar(sueltos, (x) => x.tipo === "gol_anotado" && x.datos.definicion === def);
    const otra = buscar(sueltos, (x) => x.tipo === "gol_anotado" && x.datos.definicion !== def && x.datos.definicion !== "jugada" && !(def === "chilena" && x.datos.definicion === "tijera") && !(def === "tijera" && x.datos.definicion === "chilena"));
    for (const lengua of ["es", "en"] as const) {
      for (const f of FRASES_DEFINICION[def][lengua]) {
        it(`${def} · «${f}» (${lengua.toUpperCase()}): con ${def} ⇒ pasa; con jugada ⇒ V8; con otra definición ⇒ V8`, () => {
          const con = (h: Hecho): [string, string] => (lengua === "es" ? [`${sin(h.texto_es)}; ${f}.`, h.texto_en] : [h.texto_es, `${sin(h.texto_en)}; ${f}.`]);
          expect(motivos(conDef.c, conDef.h, ...con(conDef.h))).toEqual([]);
          expect(motivos(jugada.c, jugada.h, ...con(jugada.h)).some((m) => m.regla === "V8" && m.detalle.includes(def))).toBe(true);
          expect(motivos(otra.c, otra.h, ...con(otra.h)).some((m) => m.regla === "V8" && m.detalle.includes(def))).toBe(true);
        });
      }
    }
  }
});
