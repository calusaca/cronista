// Brief 020 (rev 1.1) — definiciones del tiro y autogoles en el simulador.
// - Fixture de ORDEN (hashes-015.json, grabado desde 90d37a0): la definición se sortea DESPUÉS de
//   los sorteos del 015, así que las magnitudes de todo tiro no reescrito a propósito son las de la
//   referencia; los reescritos (cabezazo, vaselina, media cancha) quedan dentro de sus bandas.
// - Coherencias duras (verificarEspacial) en el corpus y el invariante cazando cada violación.
// - Autogoles gated por config.variantes.autogoles: ausente ⇒ byte a byte el de siempre.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { origenDelTiro } from "../espacial";
import { verificarContrato, verificarEspacial, verificarJugadores, VERIFICADORES } from "../invariantes";
import { DEF_CABEZAZO, DEF_MEDIA_CANCHA, DEF_VASELINA, DEFINICIONES, DISTANCIA_ZONA, VELOCIDAD } from "../limites";
import { enCancha } from "../micro";
import { simular } from "../motor";
import { configDeSemilla } from "../plantillas";
import { ladoDelJugador, type Evento, type Partido } from "../tipos";

const sha = (t: string) => createHash("sha256").update(t).digest("hex");
const json = (x: unknown) => JSON.stringify(x);
const FX = JSON.parse(readFileSync(fileURLToPath(new URL("../__fixtures__/hashes-015.json", import.meta.url)), "utf8")) as { commit: string; total: string; porSemilla: string[] };
const corpus: Partido[] = Array.from({ length: 1000 }, (_, i) => simular(configDeSemilla(i + 1)));
const REESCRITAS = new Set(["cabezazo", "vaselina", "media_cancha"]);
const clonar = (p: Partido) => JSON.parse(json(p)) as Partido;

describe("020 · fixture de orden: la definición va DESPUÉS del 015", () => {
  it("el fixture es el grabado desde 90d37a0 y su total cuadra con su lista", () => {
    expect(FX.commit).toBe("90d37a0");
    expect(sha(FX.porSemilla.join("\n"))).toBe(FX.total);
  });

  it("semillas 1..300: toda magnitud del 015 es la de la referencia, salvo los tiros que el 020 reescribe a propósito (y sus gol/atajada)", () => {
    const distintas: string[] = [];
    let comparadas = 0;
    corpus.slice(0, FX.porSemilla.length).forEach((p, s) => {
      const reesc = new Set(p.eventos.filter((e) => e.tipo === "tiro" && REESCRITAS.has(e.definicion ?? "")).map((e) => e.id));
      const antes = new Map((FX.porSemilla[s] as string).split(" ").filter(Boolean).map((x) => [x.split(":")[0] as string, x] as const));
      for (const e of p.eventos) {
        if (e.distanciaM === undefined && e.velocidadKmh === undefined) continue;
        if (reesc.has(e.id) || reesc.has(e.relacionadoCon ?? "")) continue;
        comparadas++;
        if (antes.get(e.id) !== `${e.id}:${e.distanciaM ?? ""}:${e.velocidadKmh ?? ""}`) distintas.push(`seed ${s + 1} ${e.id}`);
      }
    });
    expect(comparadas).toBeGreaterThan(5000);
    expect(distintas.slice(0, 10)).toEqual([]);
  });
});

describe("020 · coherencias duras de cada definición (corpus 1..1000)", () => {
  it("toda definición del vocabulario existe en el corpus (ninguna banda vacía, ni en tiros ni en goles)", () => {
    const tiros = new Set(corpus.flatMap((p) => p.eventos.filter((e) => e.tipo === "tiro").map((e) => e.definicion)));
    const goles = new Set(corpus.flatMap((p) => p.eventos.filter((e) => e.tipo === "gol").map((e) => e.definicion)));
    // Brief 025: el olímpico solo existe con la variante de insólitos (liga): aquí, jamás.
    expect(tiros.has("olimpico") || goles.has("olimpico")).toBe(false);
    for (const d of DEFINICIONES.filter((x) => x !== "olimpico")) {
      expect(tiros.has(d), `tiro ${d}`).toBe(true);
      if (d !== "tijera") expect(goles.has(d), `gol ${d}`).toBe(true);
    }
    expect(goles.has("chilena") || goles.has("tijera")).toBe(true);
  });

  it("verificarEspacial (con las coherencias del 020) sin violaciones, y todas las velocidades dentro del 015", () => {
    const fallas = corpus.flatMap((p) => verificarEspacial(p).map((e) => `${p.config.seed} ${e}`));
    expect(fallas.slice(0, 10)).toEqual([]);
    for (const p of corpus) for (const e of p.eventos) if (e.tipo === "tiro" && e.penal !== true) {
      expect(e.velocidadKmh!).toBeGreaterThanOrEqual(VELOCIDAD.min);
      expect(e.velocidadKmh!).toBeLessThanOrEqual(VELOCIDAD.max);
    }
  });

  it("la cola nueva de distancia es SOLO de la media cancha", () => {
    for (const p of corpus) for (const e of p.eventos) {
      if (e.tipo !== "tiro" || e.distanciaM === undefined) continue;
      const lejos = e.distanciaM > DISTANCIA_ZONA.media_distancia.max;
      expect(lejos, `${p.config.seed} ${e.id}`).toBe(e.definicion === "media_cancha");
    }
  });

  it("gol y atajada heredan la definición de su tiro", () => {
    for (const p of corpus.slice(0, 300)) {
      const porId = new Map(p.eventos.map((e) => [e.id, e] as const));
      for (const e of p.eventos) if ((e.tipo === "gol" || e.tipo === "atajada") && e.relacionadoCon) expect(e.definicion).toBe(porId.get(e.relacionadoCon)!.definicion);
    }
  });

  // El invariante caza cada coherencia rota (sobre un tiro real del corpus, mutado).
  const buscar = (pred: (e: Evento, i: number, p: Partido) => boolean) => {
    for (const p of corpus) {
      const i = p.eventos.findIndex((e, k) => pred(e, k, p));
      if (i >= 0) return { p: clonar(p), i };
    }
    throw new Error("fixture inexistente");
  };
  const caza = (p: Partido, texto: string) => expect(verificarEspacial(p).some((m) => m.includes(texto)), JSON.stringify(verificarEspacial(p))).toBe(true);

  it("chilena sin centro (pase filtrado o sin pase) ⇒ invariante", () => {
    const { p, i } = buscar((e, k, q) => e.tipo === "tiro" && e.zonaOrigen === "area_chica" && e.altura === "alta" && !origenDelTiro(q.eventos, k).centro && e.penal !== true);
    p.eventos[i]!.definicion = "chilena";
    caza(p, "chilena sin centro alto");
  });
  it("cabezazo a ras del suelo o fuera de su velocidad ⇒ invariante", () => {
    const { p, i } = buscar((e) => e.tipo === "tiro" && e.definicion === "cabezazo");
    p.eventos[i]!.altura = "raso";
    p.eventos[i]!.velocidadKmh = DEF_CABEZAZO.velocidad.max + 1;
    caza(p, "a ras del suelo");
    caza(p, `a ${DEF_CABEZAZO.velocidad.max + 1} km/h`);
  });
  it("vaselina sin altura alta ⇒ invariante; media cancha cerca o con xG alto ⇒ invariante", () => {
    const v = buscar((e) => e.tipo === "tiro" && e.definicion === "vaselina");
    v.p.eventos[v.i]!.altura = "media";
    caza(v.p, "vaselina con altura media");
    const m = buscar((e) => e.tipo === "tiro" && e.definicion === "media_cancha");
    m.p.eventos[m.i]!.distanciaM = DEF_MEDIA_CANCHA.distancia.min - 1;
    caza(m.p, "media cancha a");
    expect(DEF_VASELINA.velocidad.min).toBeGreaterThanOrEqual(VELOCIDAD.min);
  });
  it("una distancia de la cola nueva SIN media cancha ⇒ invariante (la cola es solo suya)", () => {
    const m = buscar((e) => e.tipo === "tiro" && e.definicion === "media_cancha");
    m.p.eventos[m.i]!.definicion = "jugada";
    caza(m.p, "media_distancia a");
  });
});

describe("020 · autogoles, gated por config.variantes.autogoles", () => {
  const con = corpus.slice(0, 600).map((p) => simular({ ...configDeSemilla(p.config.seed), variantes: { autogoles: true } }));

  it("sin la variante (o `variantes: undefined`) ⇒ byte a byte el de siempre, y jamás un autogol", () => {
    for (let s = 1; s <= 150; s++) {
      const cfg = configDeSemilla(s);
      expect(json(simular({ ...cfg, variantes: undefined }))).toBe(json(corpus[s - 1]));
      expect(json(simular({ ...cfg, variantes: { autogoles: false } }).eventos)).toBe(json(corpus[s - 1]!.eventos));
    }
    expect(corpus.some((p) => p.eventos.some((e) => e.autogol !== undefined))).toBe(false);
  });

  it("con la variante: hay autogoles; un partido sin autogol es el de siempre (sorteo derivado)", () => {
    expect(con.some((p) => p.eventos.some((e) => e.autogol === true))).toBe(true);
    con.forEach((p, k) => {
      if (!p.eventos.some((e) => e.autogol === true)) expect(json(p.eventos)).toBe(json(corpus[k]!.eventos));
    });
  });

  it("el autor es del equipo que LO SUFRE, estaba en cancha, viene de un tiro rival no penal; y todas las invariantes pasan", () => {
    const fallas: string[] = [];
    for (const p of con) {
      const porId = new Map(p.eventos.map((e) => [e.id, e] as const));
      p.eventos.forEach((e, i) => {
        if (e.autogol !== true) return;
        const sufre = ladoDelJugador(e);
        if (sufre === e.equipo) fallas.push(`${p.config.seed} ${e.id}: el autor es del que suma`);
        const tiro = porId.get(e.relacionadoCon ?? "");
        if (!tiro || tiro.tipo !== "tiro" || tiro.equipo !== e.equipo || tiro.penal === true) fallas.push(`${p.config.seed} ${e.id}: sin tiro rival`);
        // En cancha en ese instante (titulares, cambios hechos, sin expulsados): la plantilla en el tiempo de la capa micro.
        if (!enCancha(p, i)[sufre].some((j) => j.nombre === e.jugador)) fallas.push(`${p.config.seed} ${e.id}: el autor no estaba en cancha`);
        if (e.definicion !== undefined) fallas.push(`${p.config.seed} ${e.id}: un autogol con la definición del tirador`);
      });
      for (const [n, v] of Object.entries(VERIFICADORES)) for (const x of v(p)) fallas.push(`${p.config.seed} ${n}: ${x}`);
    }
    expect(fallas.slice(0, 10)).toEqual([]);
  });

  it("el contrato caza un autogol sin la variante, y el de jugadores un autor del equipo equivocado", () => {
    const p = clonar(con.find((x) => x.eventos.some((e) => e.autogol === true))!);
    const g = p.eventos.find((e) => e.autogol === true)!;
    const sin = clonar(p);
    delete sin.config.variantes;
    expect(verificarContrato(sin).some((m) => m.includes("autogol sin la variante"))).toBe(true);
    g.jugador = p.config[g.equipo].jugadores[5]!.nombre; // un jugador del que SUMA el gol
    expect(verificarJugadores(p).some((m) => m.includes(g.jugador!))).toBe(true);
  });
});
