// Brief 025 — los insólitos en el Analista y el Verificador.
// ORÁCULO: cada insólito registrado ⇒ su hecho (y ninguno sin su evento); la niebla, solo con la
// medición (recuento propio aquí). Las ocho plantillas pasan el Verificador.
// BATERÍA V8, frase por frase, ES y EN por separado: cada frase solo con SU hecho como principal;
// «doble palo / hit both posts» con un solo palo ⇒ V8; «la niebla / in the fog» en un partido con
// niebla pero sin el efecto medido ⇒ V8.
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import type { Hecho } from "../../analista/tipos";
import { NIEBLA_LARGOS_MAX, NIEBLA_LARGOS_MUESTRA_MIN } from "../../analista/umbrales";
import { PASE_M } from "../../sim/limites";
import { micro } from "../../sim/micro";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Condiciones, Evento, Partido } from "../../sim/tipos";
import { FRASES_INSOLITOS, INSOLITOS_JUICIO } from "../lexico";
import type { Motivo } from "../tipos";
import { verificarOraciones } from "../verificador";

interface Caso {
  p: Partido;
  hs: Hecho[];
}
const NIEBLA: Condiciones = { clima: "niebla", superficie: "natural", cesped: "corto", presion: { local: "baja", visita: "media" } };
const caso = (p: Partido): Caso => ({ p, hs: analizar(p) });
const conIns = (s: number, c?: Condiciones) => simular({ ...configDeSemilla(s), ...(c ? { condiciones: c } : {}), variantes: { insolitos: true } });
/** Casos forzados (semillas sueltas con la variante, buscadas en 1..6000; niebla en 1..80). */
const olimpico = caso(conIns(1079));
const subidaRemate = caso(conIns(363));
const subida = caso(conIns(130));
const doble = caso(conIns(36));
const interrupcion = caso(conIns(50));
const conNiebla = caso(conIns(8, NIEBLA));
const nieblaSinEfecto = caso(conIns(1, NIEBLA));
const normal = caso(conIns(1));
/**
 * Subida con GOL del portero: no apareció en 6000 semillas ni en la liga (0 goles de portero). Se
 * fuerza sobre la 363: el remate del portero (e085) se convierte en gol (el mismo xG, el mismo
 * detalle espacial) antes del fin del partido. Sirve SOLO a la plantilla y la batería.
 */
const subidaGol = ((): Caso => {
  const p = JSON.parse(JSON.stringify(subidaRemate.p)) as Partido;
  const k = p.eventos.findIndex((e) => e.id === "e085");
  const t = p.eventos[k] as Evento;
  const gol: Evento = { id: "e086", minuto: t.minuto, tipo: "gol", equipo: t.equipo, jugador: t.jugador, zona: "ataque", xg: t.xg, relacionadoCon: t.id, zonaOrigen: t.zonaOrigen, destino: t.destino, altura: t.altura, distanciaM: t.distanciaM, velocidadKmh: t.velocidadKmh, definicion: t.definicion };
  const resto = p.eventos.slice(k + 1).map((e, i) => ({ ...e, id: `e${String(87 + i).padStart(3, "0")}` }));
  return caso({ ...p, eventos: [...p.eventos.slice(0, k + 1), gol, ...resto] });
})();

const motivos = (c: Caso, h: Hecho, es: string, en: string): Motivo[] => verificarOraciones([{ texto_es: es, texto_en: en, hecho: h.id }], c.hs, c.p);
const sin = (t: string) => t.replace(/\.$/, "");
const de = (c: Caso, pred: (h: Hecho) => boolean): Hecho => {
  const h = c.hs.find(pred);
  if (!h) throw new Error("fixture inexistente");
  return h;
};

describe("025 · oráculo de los hechos insólitos", () => {
  it("cada insólito registrado ⇒ su hecho, con sus datos; ninguno sin su evento", () => {
    for (const c of [olimpico, subidaRemate, subida, doble, interrupcion, normal, subidaGol]) {
      const ev = c.p.eventos;
      const ol = ev.filter((e) => e.definicion === "olimpico");
      expect(c.hs.filter((h) => h.tipo === "gol_olimpico").map((h) => h.eventos.at(-1))).toEqual(ol.map((e) => e.id));
      expect(c.hs.filter((h) => h.tipo === "subida_portero").map((h) => h.eventos[0])).toEqual(ev.filter((e) => e.tipo === "subida_portero").map((e) => e.id));
      expect(c.hs.filter((h) => h.tipo === "tiro_al_palo").map((h) => `${h.eventos[0]}:${String(h.datos.palos)}`)).toEqual(ev.filter((e) => e.alPalo !== undefined).map((e) => `${e.id}:${e.alPalo}`));
      expect(c.hs.filter((h) => h.tipo === "interrupcion").map((h) => `${h.eventos[0]}:${String(h.datos.duracion)}`)).toEqual(ev.filter((e) => e.tipo === "interrupcion").map((e) => `${e.id}:${e.duracion}`));
      // el olímpico no es además un gol_anotado (no se narra dos veces)
      for (const e of ol) expect(c.hs.some((h) => h.tipo === "gol_anotado" && h.eventos.includes(e.id))).toBe(false);
    }
    expect(de(subidaRemate, (h) => h.tipo === "subida_portero").datos).toMatchObject({ remate: "si", gol: "no" });
    expect(de(subida, (h) => h.tipo === "subida_portero").datos).toMatchObject({ remate: "no", gol: "no" });
    expect(de(subidaGol, (h) => h.tipo === "subida_portero").datos).toMatchObject({ remate: "si", gol: "si" });
  });

  it("efecto_niebla ⇔ niebla registrada y la medición (recuento propio de los pases largos)", () => {
    for (let s = 1; s <= 40; s++) {
      for (const c of [caso(conIns(s, NIEBLA)), caso(conIns(s))]) {
        const largos = micro(c.p).eventos.filter((x) => x.tipo === "pase" && x.distanciaM !== undefined && x.distanciaM >= PASE_M.largo.min);
        const ok = largos.filter((x) => x.completado).length;
        const esperado = c.p.config.condiciones?.clima === "niebla" && largos.length >= NIEBLA_LARGOS_MUESTRA_MIN && ok * 100 <= NIEBLA_LARGOS_MAX * largos.length;
        const h = c.hs.find((x) => x.tipo === "efecto_niebla");
        expect(h !== undefined, `seed ${s} ${String(c.p.config.condiciones?.clima)}`).toBe(esperado);
        if (h) expect([h.datos.completados, h.datos.intentados]).toEqual([ok, largos.length]);
      }
    }
    expect(conNiebla.hs.some((h) => h.tipo === "efecto_niebla")).toBe(true);
    expect(nieblaSinEfecto.hs.some((h) => h.tipo === "efecto_niebla")).toBe(false);
  });

  it("las ocho plantillas pasan el Verificador (ES y EN)", () => {
    const plantillas: [Caso, (h: Hecho) => boolean][] = [
      [olimpico, (h) => h.tipo === "gol_olimpico"],
      [subida, (h) => h.tipo === "subida_portero"],
      [subidaRemate, (h) => h.tipo === "subida_portero"],
      [subidaGol, (h) => h.tipo === "subida_portero"],
      [olimpico, (h) => h.tipo === "tiro_al_palo" && h.datos.palos === 1],
      [doble, (h) => h.tipo === "tiro_al_palo" && h.datos.palos === 2],
      [interrupcion, (h) => h.tipo === "interrupcion"],
      [conNiebla, (h) => h.tipo === "efecto_niebla"],
    ];
    const textos = new Set<string>();
    for (const [c, pred] of plantillas) {
      const h = de(c, pred);
      textos.add(h.texto_en);
      expect(motivos(c, h, h.texto_es, h.texto_en), `${h.tipo}: ${h.texto_es}`).toEqual([]);
    }
    expect(textos.size).toBe(8);
  });
});

describe("025 · batería V8 (cada frase solo con SU hecho como principal)", () => {
  const habilitante: Record<keyof typeof FRASES_INSOLITOS, [Caso, (h: Hecho) => boolean]> = {
    olimpico: [olimpico, (h) => h.tipo === "gol_olimpico"],
    subida: [subidaRemate, (h) => h.tipo === "subida_portero"],
    palo: [olimpico, (h) => h.tipo === "tiro_al_palo" && h.datos.palos === 1],
    doblePalo: [doble, (h) => h.tipo === "tiro_al_palo" && h.datos.palos === 2],
    interrupcion: [interrupcion, (h) => h.tipo === "interrupcion"],
    niebla: [conNiebla, (h) => h.tipo === "efecto_niebla"],
  };
  const idJuicio: Record<keyof typeof FRASES_INSOLITOS, string> = { olimpico: "olimpico", subida: "subida", palo: "palo", doblePalo: "doble_palo", interrupcion: "interrupcion", niebla: "niebla" };
  const gol = de(normal, (h) => h.tipo === "gol_anotado");
  for (const k of Object.keys(FRASES_INSOLITOS) as (keyof typeof FRASES_INSOLITOS)[]) {
    const req = INSOLITOS_JUICIO.find((e) => e.id === idJuicio[k])!.requisito;
    for (const lengua of ["es", "en"] as const) {
      for (const f of FRASES_INSOLITOS[k][lengua]) {
        it(`${k} · «${f}» (${lengua.toUpperCase()}): con su hecho ⇒ pasa; con un gol cualquiera ⇒ V8`, () => {
          const con = (h: Hecho): [string, string] => (lengua === "es" ? [`${sin(h.texto_es)}; ${f}.`, h.texto_en] : [h.texto_es, `${sin(h.texto_en)}; ${f}.`]);
          const [c, pred] = habilitante[k];
          expect(motivos(c, de(c, pred), ...con(de(c, pred)))).toEqual([]);
          expect(motivos(normal, gol, ...con(gol)).some((m) => m.regla === "V8" && m.detalle.includes(req))).toBe(true);
        });
      }
    }
  }

  it("«doble palo / hit both posts» con UN solo palo registrado ⇒ V8 (ES y EN); «al palo» con dos ⇒ pasa", () => {
    const uno = de(olimpico, (h) => h.tipo === "tiro_al_palo" && h.datos.palos === 1);
    const req = INSOLITOS_JUICIO.find((e) => e.id === "doble_palo")!.requisito;
    for (const lengua of ["es", "en"] as const) {
      for (const f of FRASES_INSOLITOS.doblePalo[lengua]) {
        const ms = motivos(olimpico, uno, lengua === "es" ? `${sin(uno.texto_es)}; ${f}.` : uno.texto_es, lengua === "en" ? `${sin(uno.texto_en)}; ${f}.` : uno.texto_en);
        expect(ms.some((m) => m.regla === "V8" && m.detalle.includes(req)), f).toBe(true);
      }
    }
    // la plantilla del doble palo, citando el hecho de UN palo ⇒ V8
    const dos = de(doble, (h) => h.tipo === "tiro_al_palo" && h.datos.palos === 2);
    const falsa = (t: string) => t.replace(String(dos.datos.jugador), String(uno.datos.jugador)).replace(String(dos.datos.equipo), String(uno.datos.equipo)).replace(String(dos.datos.minuto), String(uno.datos.minuto));
    expect(motivos(olimpico, uno, falsa(dos.texto_es), falsa(dos.texto_en)).some((m) => m.regla === "V8")).toBe(true);
    expect(motivos(doble, dos, `${sin(dos.texto_es)}; dio en el palo.`, `${sin(dos.texto_en)}; off the post.`)).toEqual([]);
  });

  it("«la niebla / in the fog» en un partido CON niebla pero sin el efecto medido ⇒ V8 (ES y EN)", () => {
    const req = INSOLITOS_JUICIO.find((e) => e.id === "niebla")!.requisito;
    expect(nieblaSinEfecto.p.config.condiciones?.clima).toBe("niebla");
    const h = nieblaSinEfecto.hs.find((x) => x.tipo === "gol_anotado") ?? nieblaSinEfecto.hs.find((x) => x.tipo === "resultado_final")!;
    for (const lengua of ["es", "en"] as const) {
      for (const f of FRASES_INSOLITOS.niebla[lengua]) {
        const ms = motivos(nieblaSinEfecto, h, lengua === "es" ? `${sin(h.texto_es)}; ${f}.` : h.texto_es, lengua === "en" ? `${sin(h.texto_en)}; ${f}.` : h.texto_en);
        expect(ms.some((m) => m.regla === "V8" && m.detalle.includes(req)), f).toBe(true);
      }
    }
  });

  it("«Olímpico» como nombre de club no dispara la regla; «cruzó al palo izquierdo» en un gol, tampoco", () => {
    const re = INSOLITOS_JUICIO.find((e) => e.id === "olimpico")!.es;
    re.lastIndex = 0;
    expect(re.test("Olímpico Castana ganó en casa")).toBe(false);
    const palo = INSOLITOS_JUICIO.find((e) => e.id === "palo")!.es;
    for (const t of ["cruzó al palo izquierdo", "la puso al palo largo"]) {
      palo.lastIndex = 0;
      expect(palo.test(t), t).toBe(false);
    }
    for (const t of ["pegó en el palo izquierdo", "el remate fue al palo y salió"]) {
      palo.lastIndex = 0;
      expect(palo.test(t), t).toBe(true);
    }
  });

  it("en un partido con niebla (con y sin efecto), las plantillas de todos sus hechos pasan el Verificador", () => {
    for (const c of [conNiebla, nieblaSinEfecto]) for (const h of c.hs) expect(motivos(c, h, h.texto_es, h.texto_en), `${h.tipo}: ${h.texto_es} | ${h.texto_en}`).toEqual([]);
  });
});
