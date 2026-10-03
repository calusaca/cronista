// Brief 025 — eventos insólitos (suite rápida). Regla de oro: sin la variante, el partido de
// siempre (byte a byte); con ella, sorteos DERIVADOS: un partido en el que no ocurre ningún
// insólito es idéntico al de sin variante. Invariantes con la variante en 1..400, y cada invariante
// nuevo caza su corrupción a mano (casos forzados: semillas sueltas en las que el insólito ocurre).
import { describe, expect, it } from "vitest";
import { TEMPORADA_ACTUAL } from "../../analista/umbrales";
import { mundo } from "../../mundo/mundo";
import { configDePartidoLiga } from "../../mundo/temporada";
import { verificarInsolitos, verificarRelaciones, VERIFICADORES } from "../invariantes";
import { CAUSAS_INTERRUPCION, DURACION_INTERRUPCION, SUBIDA_MINUTO_MIN } from "../limites";
import { micro } from "../micro";
import { simular } from "../motor";
import { P } from "../parametros";
import { configDeSemilla } from "../plantillas";
import type { Evento, Partido, SimConfig } from "../tipos";

const json = (x: unknown) => JSON.stringify(x);
const conIns = (s: number): SimConfig => ({ ...configDeSemilla(s), variantes: { insolitos: true } });
const insolito = (e: Evento) => e.tipo === "subida_portero" || e.tipo === "interrupcion" || e.alPalo !== undefined || e.definicion === "olimpico";
/** Casos forzados (semillas sueltas con la variante; buscados en 1..6000, ver el informe del 025). */
const SEMILLA = { olimpico: 1079, subidaConRemate: 363, doblePalo: 36, interrupcion2T: 50 } as const;
const copia = (p: Partido): Partido => JSON.parse(json(p)) as Partido;

describe("025 · regla de oro y sorteos derivados", () => {
  it("sin la variante (ausente, undefined o false) ⇒ Partido y capa micro idénticos (1..200)", () => {
    for (let s = 1; s <= 200; s++) {
      const cfg = configDeSemilla(s);
      const a = simular(cfg);
      for (const v of [undefined, { insolitos: false }]) {
        const b = simular({ ...cfg, variantes: v });
        expect(json(b.eventos), `seed ${s}`).toBe(json(a.eventos));
        if (s <= 40) expect(json(micro(b).eventos)).toBe(json(micro(a).eventos));
      }
    }
  });

  it("sin la variante, las semillas de los casos forzados no traen NINGÚN insólito (ni niebla de la nada)", () => {
    for (const s of Object.values(SEMILLA)) {
      expect(simular(configDeSemilla(s)).eventos.some(insolito), `seed ${s}`).toBe(false);
      expect(simular(conIns(s)).eventos.some(insolito), `seed ${s} con la variante`).toBe(true);
    }
  });

  it("con la variante y SIN ningún insólito en el partido ⇒ los mismos eventos que sin ella (el stream principal no se toca)", () => {
    let iguales = 0;
    for (let s = 1; s <= 300; s++) {
      const on = simular(conIns(s));
      if (on.eventos.some(insolito)) continue;
      expect(json(on.eventos), `seed ${s}`).toBe(json(simular(configDeSemilla(s)).eventos));
      iguales++;
    }
    // ~la mitad de los partidos tiene algún tiro al palo; el resto debe ser idéntico.
    expect(iguales).toBeGreaterThan(100);
  });

  it("con la variante y un insólito, todo lo ANTERIOR a él es el partido de siempre (prefijo)", () => {
    for (const s of Object.values(SEMILLA)) {
      // El palo es un campo añadido en la pasada final (no mueve nada): se quita y se compara el
      // prefijo hasta el primer insólito que SÍ es un evento (o el partido entero si no hay).
      const on = simular(conIns(s)).eventos.map(({ alPalo: _a, ...e }) => e as Evento);
      const off = simular(configDeSemilla(s)).eventos;
      const k = on.findIndex(insolito);
      const n = k < 0 ? on.length : k;
      expect(n, `seed ${s}`).toBeGreaterThan(0);
      expect(json(on.slice(0, n)), `seed ${s}`).toBe(json(off.slice(0, n)));
      if (k < 0) expect(json(on)).toBe(json(off));
    }
  });

  it("las interrupciones solo en el 2.º tiempo (1..2000 con la variante)", () => {
    let vistas = 0;
    for (let s = 1; s <= 2000; s++) {
      const ev = simular(conIns(s)).eventos;
      const segundo = ev.findIndex((e, i) => i > 0 && e.tipo === "inicio_periodo");
      ev.forEach((e, i) => {
        if (e.tipo !== "interrupcion") return;
        vistas++;
        expect(i, `seed ${s}`).toBeGreaterThan(segundo);
      });
    }
    expect(vistas).toBeGreaterThan(0);
  });

  it("misma semilla con la variante dos veces ⇒ idéntico", () => {
    for (const s of Object.values(SEMILLA)) expect(json(simular(conIns(s)))).toBe(json(simular(conIns(s))));
  });
});

describe("025 · con la variante: contrato e invariantes", () => {
  const corpus: Partido[] = Array.from({ length: 400 }, (_, i) => simular(conIns(i + 1)));

  it("todas las invariantes (incluida la de insólitos) en 1..400 y en los casos forzados", () => {
    expect(VERIFICADORES.insolitos).toBe(verificarInsolitos);
    const casos = [...corpus, ...Object.values(SEMILLA).map((s) => simular(conIns(s)))];
    const fallas = casos.flatMap((p) => Object.entries(VERIFICADORES).flatMap(([n, v]) => v(p).map((x) => `${p.config.seed} ${n}: ${x}`)));
    expect(fallas.slice(0, 10)).toEqual([]);
  });

  it("los casos forzados traen su insólito con los campos de lista cerrada", () => {
    const ol = simular(conIns(SEMILLA.olimpico)).eventos;
    const g = ol.find((e) => e.definicion === "olimpico")!;
    const c = ol[ol.indexOf(g) - 1]!;
    expect([g.tipo, c.tipo, c.id, c.jugador, g.zonaOrigen]).toEqual(["gol", "corner", g.relacionadoCon, g.jugador, "area_chica"]);

    const sub = simular(conIns(SEMILLA.subidaConRemate)).eventos;
    const k = sub.findIndex((e) => e.tipo === "subida_portero");
    expect(sub[k + 1]!.tipo).toBe("corner");
    expect(sub[k]!.minuto).toBeGreaterThanOrEqual(SUBIDA_MINUTO_MIN);
    expect(sub.some((e, i) => i > k && e.tipo === "tiro" && e.jugador === sub[k]!.jugador)).toBe(true);

    expect(simular(conIns(SEMILLA.doblePalo)).eventos.some((e) => e.alPalo === 2)).toBe(true);

    const it2 = simular(conIns(SEMILLA.interrupcion2T)).eventos.find((e) => e.tipo === "interrupcion")!;
    expect(CAUSAS_INTERRUPCION).toContain(it2.causa);
    expect(it2.duracion).toBeGreaterThanOrEqual(DURACION_INTERRUPCION.min);
    expect(it2.duracion).toBeLessThanOrEqual(DURACION_INTERRUPCION.max);
    expect(it2.minuto).toBeGreaterThanOrEqual(45);
  });

  it("propiedad de prefijo de la capa micro con insólitos (olímpico, subida, palos, interrupción)", () => {
    const fallas: string[] = [];
    for (const p of [...corpus.slice(0, 20), ...Object.values(SEMILLA).map((s) => simular(conIns(s)))]) {
      const full = micro(p);
      p.eventos.forEach((e, k) => {
        if (e.tipo !== "gol" && e.tipo !== "fin_periodo" && !insolito(e)) return;
        const mp = micro({ config: p.config, eventos: p.eventos.slice(0, k + 1) });
        if (json(mp.eventos) !== json(full.eventos.slice(0, mp.eventos.length))) fallas.push(`${p.config.seed} k=${k}`);
      });
    }
    expect(fallas).toEqual([]);
  });

  it("la liga enciende la variante", () => {
    for (const l of mundo().ligas.slice(0, 3)) expect(configDePartidoLiga(l, TEMPORADA_ACTUAL, 4, 2).variantes?.insolitos).toBe(true);
  });
});

describe("025 · cada invariante caza su corrupción", () => {
  it("olímpico con un tiro intermedio ⇒ invariante (y con el córner de otro jugador también)", () => {
    const p = copia(simular(conIns(SEMILLA.olimpico)));
    const i = p.eventos.findIndex((e) => e.definicion === "olimpico");
    const corner = p.eventos[i - 1]!;
    const tiro: Evento = { id: "e999", minuto: corner.minuto, tipo: "tiro", equipo: corner.equipo, jugador: corner.jugador, xg: 0.05 };
    const conTiro: Partido = { ...p, eventos: [...p.eventos.slice(0, i), tiro, ...p.eventos.slice(i)] };
    expect(verificarInsolitos(conTiro).some((x) => x.includes("olímpico"))).toBe(true);
    const otro = copia(p);
    otro.eventos[i]!.jugador = otro.config[corner.equipo].jugadores.find((j) => j.nombre !== corner.jugador && j.posicion === "DEL")!.nombre;
    expect(verificarInsolitos(otro).some((x) => x.includes("olímpico"))).toBe(true);
    expect(verificarInsolitos(p)).toEqual([]);
  });

  it("el portero remata sin subida registrada ⇒ invariante (quitar la subida, o darle un tiro cualquiera)", () => {
    const p = copia(simular(conIns(SEMILLA.subidaConRemate)));
    const sinSubida: Partido = { ...p, eventos: p.eventos.filter((e) => e.tipo !== "subida_portero") };
    expect(verificarInsolitos(sinSubida).some((x) => x.includes("sin subida registrada"))).toBe(true);
    const q = copia(simular(conIns(7)));
    const t = q.eventos.find((e) => e.tipo === "tiro")!;
    t.jugador = q.config[t.equipo].jugadores.find((j) => j.posicion === "POR")!.nombre;
    expect(verificarInsolitos(q).some((x) => x.includes("sin subida registrada"))).toBe(true);
  });

  it("subida fuera de su situación (antes del 88' o sin ir perdiendo por uno) ⇒ invariante", () => {
    const p = copia(simular(conIns(SEMILLA.subidaConRemate)));
    const s = p.eventos.find((e) => e.tipo === "subida_portero")!;
    s.minuto = SUBIDA_MINUTO_MIN - 1;
    expect(verificarInsolitos(p).some((x) => x.includes("fuera de su situación") || x.includes("sin su córner"))).toBe(true);
  });

  it("la interrupción que NO se suma al descuento ⇒ invariante del reloj", () => {
    const p = copia(simular(conIns(SEMILLA.interrupcion2T)));
    const it2 = p.eventos.find((e) => e.tipo === "interrupcion")!;
    expect(verificarInsolitos(p)).toEqual([]);
    // Sin sumarla: el 2.º tiempo termina en 90 + el descuento mínimo ⇒ al restar la interrupción
    // (≥ 1') queda bajo el mínimo. (Con un descuento sorteado alto puede no notarse en UN partido;
    // la mutación del motor la caza sobre el corpus.)
    const fin = [...p.eventos].reverse().find((e) => e.tipo === "fin_periodo")!;
    expect(it2.duracion).toBeGreaterThanOrEqual(1);
    fin.minuto = 90 + P.descuento2.min;
    expect(verificarInsolitos(p).some((x) => x.startsWith("reloj"))).toBe(true);
    const dos = copia(simular(conIns(SEMILLA.interrupcion2T)));
    const k = dos.eventos.findIndex((e) => e.tipo === "interrupcion");
    dos.eventos.splice(k + 1, 0, { ...dos.eventos[k]!, id: "e998" });
    expect(verificarInsolitos(dos).some((x) => x.includes("más de una interrupción") || x.startsWith("reloj"))).toBe(true);
    // en el 1.er tiempo ⇒ invariante (su descuento no se ve: el 1.º se sella en el 45)
    const t1 = copia(simular(conIns(SEMILLA.interrupcion2T)));
    const j = t1.eventos.findIndex((e) => e.tipo === "interrupcion");
    const [parada] = t1.eventos.splice(j, 1);
    t1.eventos.splice(3, 0, { ...parada!, minuto: t1.eventos[2]!.minuto });
    expect(verificarInsolitos(t1).some((x) => x.includes("1.er tiempo"))).toBe(true);
  });

  it("palos incoherentes (en un gol, en un tiro atajado, fuera de 1|2, o sin apuntar al palo) ⇒ invariante", () => {
    const p = simular(conIns(SEMILLA.doblePalo));
    const malos: ((q: Partido) => void)[] = [
      (q) => void (q.eventos.find((e) => e.tipo === "gol")!.alPalo = 1),
      (q) => {
        const a = q.eventos.find((e) => e.tipo === "atajada")!;
        q.eventos.find((e) => e.id === a.relacionadoCon)!.alPalo = 1;
      },
      (q) => void ((q.eventos.find((e) => e.alPalo === 2)! as { alPalo: number }).alPalo = 3),
      (q) => void (q.eventos.find((e) => e.alPalo === 2)!.destino = "centro_del_arco"),
    ];
    for (const m of malos) {
      const q = copia(p);
      m(q);
      expect(verificarInsolitos(q).some((x) => x.includes("alPalo")), m.toString()).toBe(true);
    }
  });

  it("insólitos sin la variante ⇒ invariante; el olímpico cuelga de un córner (relaciones del 001 extendidas)", () => {
    const p = copia(simular(conIns(SEMILLA.olimpico)));
    expect(verificarInsolitos({ ...p, config: { ...p.config, variantes: undefined } }).some((x) => x.includes("sin la variante"))).toBe(true);
    const niebla = { ...configDeSemilla(3), condiciones: { clima: "niebla" as const, superficie: "natural" as const, cesped: "corto" as const, presion: { local: "baja" as const, visita: "media" as const } } };
    expect(verificarInsolitos(simular(niebla)).some((x) => x.includes("niebla"))).toBe(true);
    expect(verificarInsolitos(simular({ ...niebla, variantes: { insolitos: true } }))).toEqual([]);
    expect(verificarRelaciones(p)).toEqual([]);
    const g = p.eventos.find((e) => e.definicion === "olimpico")!;
    g.relacionadoCon = p.eventos.find((e) => e.tipo === "tiro" && e.equipo === g.equipo)?.id;
    expect(verificarRelaciones(p).length + verificarInsolitos(p).length).toBeGreaterThan(0);
  });
});
