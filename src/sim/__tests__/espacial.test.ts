// Brief 011 (rev 1.1) — detalle espacial: no-regresión contra el baseline grabado por Fable,
// determinismo con los campos nuevos e invariantes de coherencia (vocabularios y bandas
// importados de limites.ts; ninguna cifra repetida a mano).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { proyeccionLegado } from "../espacial";
import { verificarEspacial, VERIFICADORES } from "../invariantes";
import { ALTURAS, BANDAS, DESTINOS, LADO_PORTERO_DE, LADOS_PORTERO, ZONA_XG_BANDAS, ZONAS_AREA, ZONAS_ORIGEN } from "../limites";
import { cornerDelTiro, enBanda } from "../espacial";
import { simular } from "../motor";
import { configDeSemilla } from "../plantillas";
import { prngDerivado } from "../prng";
import { CAMPOS_ESPACIALES, type Evento, type Partido } from "../tipos";

const sha256hex = (t: string) => createHash("sha256").update(t).digest("hex");
const FIXTURE = JSON.parse(readFileSync(fileURLToPath(new URL("../__fixtures__/hashes-legado.json", import.meta.url)), "utf8")) as {
  commit: string;
  corpus: string;
  total: string;
  porSemilla: string[];
};
const CORPUS_HASH = FIXTURE.porSemilla.length; // 1..1000 (lo fija el fixture, no esta prueba)
const CORPUS_INV = 500;

const partidos: Partido[] = Array.from({ length: CORPUS_HASH }, (_, i) => simular(configDeSemilla(i + 1)));
const clonar = (p: Partido) => JSON.parse(JSON.stringify(p)) as Partido;

describe("011 · los partidos de hoy no cambian (baseline de Fable desde ea12a2e)", () => {
  it("el fixture es el del brief: 1000 semillas y su total cuadra con su propia lista", () => {
    expect(FIXTURE.commit).toBe("ea12a2e");
    expect(FIXTURE.porSemilla).toHaveLength(1000);
    expect(sha256hex(FIXTURE.porSemilla.join("\n"))).toBe(FIXTURE.total);
  });

  it("proyección legado del corpus 1..1000 ⇒ EXACTAMENTE los hashes grabados (por semilla y total)", () => {
    const porSemilla = partidos.map((p) => sha256hex(JSON.stringify(proyeccionLegado(p))));
    const distintas = porSemilla.flatMap((h, i) => (h === FIXTURE.porSemilla[i] ? [] : [`seed ${i + 1}`]));
    expect(distintas).toEqual([]);
    expect(sha256hex(porSemilla.join("\n"))).toBe(FIXTURE.total);
  });

  it("segundo hash (informativo): el corpus CON campos nuevos es determinista entre dos corridas", () => {
    const conCampos = (ps: Partido[]) => sha256hex(ps.map((p) => sha256hex(JSON.stringify(p))).join("\n"));
    const a = conCampos(partidos.slice(0, 200));
    const b = conCampos(Array.from({ length: 200 }, (_, i) => simular(configDeSemilla(i + 1))));
    expect(b).toBe(a);
    // y los campos nuevos de verdad cambian el partido (si no, el hash informativo no vigila nada)
    expect(a).not.toBe(sha256hex(partidos.slice(0, 200).map((p) => sha256hex(JSON.stringify(proyeccionLegado(p)))).join("\n")));
  });

  it("la proyección legado borra exactamente los campos nuevos y nada más", () => {
    const p = partidos[245] as Partido;
    const l = proyeccionLegado(p);
    p.eventos.forEach((e, i) => {
      const sin = { ...e } as Record<string, unknown>;
      for (const k of CAMPOS_ESPACIALES) delete sin[k];
      expect(l.eventos[i]).toEqual(sin);
    });
  });
});

describe("011 · determinismo con los campos nuevos", () => {
  it.each([7, 42, 246, 1999])("semilla %i: mismo Partido byte a byte, campos incluidos", (s) => {
    expect(JSON.stringify(simular(configDeSemilla(s)))).toBe(JSON.stringify(simular(configDeSemilla(s))));
  });

  it("prngDerivado: misma (semilla, clave) ⇒ misma secuencia; otra clave u otra semilla ⇒ otra", () => {
    const seq = (s: number, k: string) => Array.from({ length: 5 }, ((r) => () => r.next())(prngDerivado(s, k)));
    expect(seq(246, "e004")).toEqual(seq(246, "e004"));
    expect(seq(246, "e004")).not.toEqual(seq(246, "e005"));
    expect(seq(246, "e004")).not.toEqual(seq(247, "e004"));
  });
});

describe(`011 · coherencia espacial sobre el corpus 1..${CORPUS_INV}`, () => {
  const corpus = partidos.slice(0, CORPUS_INV);
  const todos = corpus.flatMap((p) => p.eventos);

  it("verificarEspacial no encuentra violaciones (y está en VERIFICADORES: la guarda de entrada la aplica)", () => {
    expect(VERIFICADORES.espacial).toBe(verificarEspacial);
    const fallas = corpus.flatMap((p) => verificarEspacial(p).map((e) => `seed ${p.config.seed}: ${e}`));
    expect(fallas.slice(0, 10)).toEqual([]);
  });

  it("completitud: todo tiro y gol tiene zonaOrigen/destino/altura; atajada ladoPortero; córner banda; pase clave zonaOrigen", () => {
    const faltan = todos.filter(
      (e) =>
        ((e.tipo === "tiro" || e.tipo === "gol") && (!e.zonaOrigen || !e.destino || !e.altura)) ||
        (e.tipo === "atajada" && !e.ladoPortero) ||
        (e.tipo === "corner" && !e.banda) ||
        (e.tipo === "pase_clave" && !e.zonaOrigen),
    );
    expect(faltan.slice(0, 5)).toEqual([]);
    // y ningún otro tipo de evento gana campos
    const ajenos = todos.filter((e) => !["tiro", "gol", "atajada", "corner", "pase_clave"].includes(e.tipo) && CAMPOS_ESPACIALES.some((k) => e[k] !== undefined));
    expect(ajenos).toEqual([]);
  });

  it("el corpus ejercita las invariantes: aparecen todos los valores de cada vocabulario", () => {
    const vistos = (k: keyof Evento) => new Set(todos.map((e) => e[k]).filter((x) => x !== undefined));
    expect([...vistos("zonaOrigen")].sort()).toEqual([...ZONAS_ORIGEN].sort());
    expect([...vistos("destino")].sort()).toEqual([...DESTINOS].sort());
    expect([...vistos("altura")].sort()).toEqual([...ALTURAS].sort());
    expect([...vistos("ladoPortero")].sort()).toEqual([...LADOS_PORTERO].sort());
    expect([...vistos("banda")].sort()).toEqual([...BANDAS].sort());
  });

  it("los casos de cada regla existen: penales en el punto, cabezazos de córner en el área, área chica y media distancia en su banda de xG", () => {
    const penales = todos.filter((e) => e.tipo === "tiro" && e.penal);
    expect(penales.length).toBeGreaterThan(0);
    expect(penales.every((e) => e.zonaOrigen === "punto_penal")).toBe(true);
    const deCorner = corpus.flatMap((p) => p.eventos.filter((e, i) => cornerDelTiro(p.eventos, i) !== undefined));
    expect(deCorner.length).toBeGreaterThan(50);
    expect(deCorner.every((e) => ZONAS_AREA.includes(e.zonaOrigen!))).toBe(true);
    const chica = todos.filter((e) => e.tipo === "tiro" && e.zonaOrigen === "area_chica");
    const lejos = todos.filter((e) => e.tipo === "tiro" && e.zonaOrigen === "media_distancia");
    expect(chica.length).toBeGreaterThan(0);
    expect(lejos.length).toBeGreaterThan(0);
    expect(chica.every((e) => enBanda("area_chica", e.xg ?? 0))).toBe(true);
    expect(lejos.every((e) => enBanda("media_distancia", e.xg ?? 0))).toBe(true);
  });
});

describe("011 · la tabla del portero dice lo que dice el brief (escrito aparte, no contra sí misma)", () => {
  it("se miran de frente: palo izquierdo del tirador = derecha del portero; palo derecho = izquierda; centro = centro", () => {
    expect(LADO_PORTERO_DE).toEqual({ palo_izquierdo: "su_derecha", palo_derecho: "su_izquierda", centro_del_arco: "centro" });
  });
});

describe("011 · mutaciones de control sobre verificarEspacial", () => {
  const base = partidos[245] as Partido; // semilla 246
  const ev = (p: Partido, pred: (e: Evento, i: number) => boolean) => p.eventos.find(pred) as Evento;
  it("el partido base está limpio", () => expect(verificarEspacial(base)).toEqual([]));
  it("un partido SIN campos (proyección legado, como un fixture a mano) es válido", () => expect(verificarEspacial(proyeccionLegado(base))).toEqual([]));

  it("detecta un penal fuera del punto penal", () => {
    const p = clonar(base);
    const t = p.eventos.find((e) => e.tipo === "tiro" && e.penal) ?? ev(p, (e) => e.tipo === "tiro");
    t.penal = true;
    t.zonaOrigen = "frontal_del_area";
    expect(verificarEspacial(p).some((m) => m.includes("penal"))).toBe(true);
  });
  it("detecta un punto_penal en un tiro que no es penal", () => {
    const p = clonar(base);
    const t = ev(p, (e) => e.tipo === "tiro" && !e.penal);
    t.zonaOrigen = "punto_penal";
    expect(verificarEspacial(p).some((m) => m.includes("no es penal"))).toBe(true);
  });
  it("detecta un cabezazo de córner desde fuera del área", () => {
    const p = clonar(base);
    const t = ev(p, (_e, i) => cornerDelTiro(p.eventos, i) !== undefined);
    t.zonaOrigen = "banda_izquierda";
    expect(verificarEspacial(p).some((m) => m.includes("córner"))).toBe(true);
  });
  it("detecta area_chica con xG por debajo de la banda y media_distancia por encima", () => {
    const p = clonar(base);
    // Un tiro sin gol colgado: así el gol que copia su zona no da un motivo que se confunda.
    const conGol = new Set(p.eventos.filter((e) => e.tipo === "gol").map((e) => e.relacionadoCon));
    const t = ev(p, (e, i) => e.tipo === "tiro" && !e.penal && !conGol.has(e.id) && cornerDelTiro(p.eventos, i) === undefined);
    t.zonaOrigen = "area_chica";
    t.xg = ZONA_XG_BANDAS.area_chica.min - 0.01;
    expect(verificarEspacial(p)).toEqual([expect.stringContaining(`${t.id}: area_chica con xG ${t.xg} (banda`)]);
    t.zonaOrigen = "media_distancia";
    t.xg = ZONA_XG_BANDAS.media_distancia.max;
    expect(verificarEspacial(p)).toEqual([expect.stringContaining(`${t.id}: media_distancia con xG ${t.xg} (banda`)]);
  });
  it("detecta un portero tirado al lado equivocado", () => {
    const p = clonar(base);
    const a = ev(p, (e) => e.tipo === "atajada");
    const t = p.eventos.find((e) => e.id === a.relacionadoCon) as Evento;
    const otro = LADOS_PORTERO.find((l) => l !== LADO_PORTERO_DE[t.destino!])!;
    a.ladoPortero = otro;
    expect(verificarEspacial(p).some((m) => m.includes("portero"))).toBe(true);
  });
  it("detecta un gol sin destino y un gol que contradice a su tiro", () => {
    const p = clonar(base);
    const g = ev(p, (e) => e.tipo === "gol");
    delete g.destino;
    expect(verificarEspacial(p).some((m) => m.includes("gol sin destino"))).toBe(true);
    g.destino = DESTINOS.find((d) => d !== (p.eventos.find((e) => e.id === g.relacionadoCon) as Evento).destino)!;
    expect(verificarEspacial(p).some((m) => m.includes("≠ su tiro"))).toBe(true);
  });
  it("detecta un valor fuera de vocabulario y un campo en el tipo de evento equivocado", () => {
    const p = clonar(base);
    (ev(p, (e) => e.tipo === "corner") as unknown as Record<string, unknown>).banda = "centro";
    ev(p, (e) => e.tipo === "falta").destino = "palo_izquierdo";
    const m = verificarEspacial(p);
    expect(m.some((x) => x.includes("banda fuera de vocabulario"))).toBe(true);
    expect(m.some((x) => x.includes("destino en falta"))).toBe(true);
  });
});

describe("012 §E · P12 — bandas xG por zona, con COPIA INDEPENDIENTE de las del brief 012 §F1", () => {
  // Copia literal del brief (NO importada de limites.ts): si el generador y el invariante se
  // mueven juntos (los dos leen ZONA_XG_BANDAS), esta prueba se pone roja.
  // área chica [0.15, 1.0] · punto penal = xG del penal (0.76) · frontal [0.01, 0.50) (rev 1.1) ·
  // bandas [0.01, 0.30) · media distancia [0.01, 0.15)  — en centésimas.
  const BRIEF: Record<string, (c: number) => boolean> = {
    area_chica: (c) => c >= 15 && c <= 100,
    punto_penal: (c) => c === 76,
    frontal_del_area: (c) => c >= 1 && c < 50,
    banda_izquierda: (c) => c >= 1 && c < 30,
    banda_derecha: (c) => c >= 1 && c < 30,
    media_distancia: (c) => c >= 1 && c < 15,
  };

  it("todo tiro y gol del corpus 1..1000 cae en la banda que fija el brief para su zona", () => {
    const fuera: string[] = [];
    for (const p of partidos) {
      for (const e of p.eventos) {
        if ((e.tipo !== "tiro" && e.tipo !== "gol") || !e.zonaOrigen) continue;
        if (!BRIEF[e.zonaOrigen]!(Math.round((e.xg ?? 0) * 100))) fuera.push(`seed ${p.config.seed} ${e.id} ${e.zonaOrigen} xG ${e.xg}`);
      }
    }
    expect(fuera.slice(0, 10)).toEqual([]);
  });

  it("y la matriz de limites.ts dice lo mismo que el brief (contraste directo)", () => {
    expect(ZONA_XG_BANDAS).toEqual({
      area_chica: { min: 0.15, max: 1.0, incluyeMax: true },
      punto_penal: { min: 0.76, max: 0.76, incluyeMax: true },
      frontal_del_area: { min: 0.01, max: 0.5, incluyeMax: false },
      banda_izquierda: { min: 0.01, max: 0.3, incluyeMax: false },
      banda_derecha: { min: 0.01, max: 0.3, incluyeMax: false },
      media_distancia: { min: 0.01, max: 0.15, incluyeMax: false },
    });
  });
});

describe("012 · el sorteo respeta la intención, no solo la banda", () => {
  it("entre los tiros de jugada con xG de área chica, el área chica es la zona más frecuente (una ocasión clara nace cerca)", () => {
    const cuenta: Record<string, number> = {};
    for (const p of partidos.slice(0, 500)) {
      p.eventos.forEach((e, i) => {
        if (e.tipo !== "tiro" || e.penal || cornerDelTiro(p.eventos, i) || !enBanda("area_chica", e.xg ?? 0)) return;
        cuenta[e.zonaOrigen!] = (cuenta[e.zonaOrigen!] ?? 0) + 1;
      });
    }
    const orden = Object.entries(cuenta).sort((a, b) => b[1] - a[1]);
    expect(orden[0]?.[0]).toBe("area_chica");
  });
});
