// Brief 014 — el panel «Match stats» dice lo mismo que los hechos del 013 (mismas reglas y
// umbrales importados), el relato jugada a jugada cita los micro-eventos exactos, y los
// presets son los que caza el script con sus criterios.
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import { DOMINIO_MIN } from "../../analista/umbrales";
import { micro } from "../../sim/micro";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Lado, Partido } from "../../sim/tipos";
import { CRITERIOS, cazarPresets, PRESETS, SEMILLA_DESTACADA } from "../presets";
import { estadisticas, relato } from "../stats";

const corpus: Partido[] = Array.from({ length: 200 }, (_, i) => simular(configDeSemilla(i + 1)));
const ladoDe = (p: Partido, equipo: unknown): Lado => (equipo === p.config.local.nombre ? "local" : "visita");

describe("014 · el panel coincide con los hechos del 013 (corpus 1..200)", () => {
  it("posesión destacada ⇔ dominio_global, con el mismo porcentaje", () => {
    for (const p of corpus) {
      const s = estadisticas(p);
      const h = analizar(p).find((x) => x.tipo === "dominio_global");
      if (h) {
        expect(s.posesion.destacado).toBe(ladoDe(p, h.datos.equipo));
        expect(s.posesion.porcentaje[ladoDe(p, h.datos.equipo)]).toBe(h.datos.porcentaje);
      } else expect(s.posesion.destacado).toBeUndefined();
    }
  });

  it("canal destacado ⇔ dominio_por_canal (por equipo, mismo canal y mismo %)", () => {
    for (const p of corpus) {
      const s = estadisticas(p);
      const hs = analizar(p).filter((x) => x.tipo === "dominio_por_canal");
      for (const l of ["local", "visita"] as const) {
        const h = hs.find((x) => ladoDe(p, x.datos.equipo) === l);
        expect(s.canales[l].destacado).toBe(h?.datos.canal);
        if (h) expect(s.canales[l].por[h.datos.canal as "centro"].porcentaje).toBe(h.datos.porcentaje);
      }
    }
  });

  it("duelo destacado ⇔ duelo_ganado, con los MISMOS micro-eventos citados", () => {
    for (const p of corpus) {
      const s = estadisticas(p);
      for (const h of analizar(p).filter((x) => x.tipo === "duelo_ganado")) {
        const d = s.duelos.find((x) => x.jugador === h.datos.jugador && x.rival === h.datos.rival);
        expect(d, `seed ${p.config.seed}`).toBeDefined();
        expect(d!.destacado).toBe(true);
        expect(d!.ids).toEqual(h.eventos);
      }
    }
  });

  it("pérdidas destacadas ⇔ perdidas_en_salida, con los MISMOS micro-eventos citados", () => {
    for (const p of corpus) {
      const s = estadisticas(p);
      for (const h of analizar(p).filter((x) => x.tipo === "perdidas_en_salida")) {
        const x = s.perdidas[ladoDe(p, h.datos.equipo)][h.datos.canal as "centro"];
        expect(x.destacado).toBe(true);
        expect(x.ids).toEqual(h.eventos);
      }
    }
  });

  it("también sobre prefijos cortos (el vivo): posesión y canal destacados ⇔ los hechos del prefijo (muestra mínima incluida)", () => {
    let conMuestraChica = 0;
    for (const p of corpus.slice(0, 120)) {
      for (const k of [8, 15, 30]) {
        const pre: Partido = { config: p.config, eventos: p.eventos.slice(0, k) };
        const s = estadisticas(pre);
        const hs = analizar(pre);
        const dom = hs.find((x) => x.tipo === "dominio_global");
        expect(s.posesion.destacado, `seed ${p.config.seed} k=${k}`).toBe(dom ? ladoDe(p, dom.datos.equipo) : undefined);
        for (const l of ["local", "visita"] as const) {
          const h = hs.find((x) => x.tipo === "dominio_por_canal" && ladoDe(p, x.datos.equipo) === l);
          expect(s.canales[l].destacado).toBe(h?.datos.canal);
        }
        if (s.posesion.pases.local + s.posesion.pases.visita > 0 && Math.max(s.posesion.porcentaje.local, s.posesion.porcentaje.visita) >= DOMINIO_MIN && !dom) conMuestraChica++;
      }
    }
    expect(conMuestraChica).toBeGreaterThan(0); // hubo prefijos con % alto y poca muestra: la regla se ejercitó
  });

  it("en vivo el panel es el del prefijo: nada de lo que viene después", () => {
    const p = corpus[45] as Partido;
    const pre: Partido = { config: p.config, eventos: p.eventos.slice(0, 40) };
    const s = estadisticas(pre);
    const idsPre = new Set(micro(pre).eventos.map((x) => x.id));
    for (const d of s.duelos) for (const id of d.ids) expect(idsPre.has(id)).toBe(true);
    expect(s.total).toBe(idsPre.size);
    expect(s.total).toBeLessThan(estadisticas(p).total);
  });
});

describe("014 · relato jugada a jugada (rev 1.1)", () => {
  const p = simular(configDeSemilla(PRESETS.duelo));
  const m = micro(p);
  const s = estadisticas(p, m);
  const d = s.duelos[0]!;
  const lineas = relato(p, m, d.ids);

  it("cada micro-evento citado aparece, marcado, con minuto y actor", () => {
    expect(lineas.filter((l) => l.citado).map((l) => l.id)).toEqual(d.ids);
    for (const l of lineas.filter((x) => x.citado)) {
      expect(l.minuto).toMatch(/′$/);
      expect(l.texto).toContain(d.jugador);
      expect(l.texto).toContain(d.rival);
    }
  });

  it("se lee como fútbol: un pase lleva distancia en metros y lo recibe quien actúa después", () => {
    const todas = relato(p, m, m.eventos.filter((x) => x.tipo === "pase" && x.completado).slice(0, 30).map((x) => x.id), 0);
    for (const l of todas) expect(l.texto).toMatch(/passes to .+ · .+ · \d+ m$/);
  });
});

describe("014 · presets curados", () => {
  it("PRESETS es exactamente lo que caza el script (determinista) y la portada sigue siendo la 246", () => {
    expect(cazarPresets()).toEqual(PRESETS);
    expect(PRESETS.noche_grande).toBe(SEMILLA_DESTACADA);
  });

  it("cada semilla cumple su historia, y son cinco partidos distintos", () => {
    for (const c of CRITERIOS) {
      const p = simular(configDeSemilla(PRESETS[c.id]));
      expect(c.cumple(analizar(p), p), c.id).toBe(true);
    }
    expect(new Set(Object.values(PRESETS)).size).toBe(5);
  });

  it("variedad: las cinco historias tienen cinco resultados distintos (el duelo evita los ya usados)", () => {
    const res = Object.values(PRESETS).map((seed) => {
      const r = analizar(simular(configDeSemilla(seed))).find((h) => h.tipo === "resultado_final")!;
      const [l, v] = [Number(r.datos.goles_local), Number(r.datos.goles_visita)];
      return `${Math.max(l, v)}-${Math.min(l, v)}`;
    });
    expect(new Set(res).size).toBe(5);
  });

  it("los textos dicen el tipo de historia, no el marcador", () => {
    for (const c of CRITERIOS) expect(c.historia).not.toMatch(/\d\s*[–-]\s*\d/);
  });
});
