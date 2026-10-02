// Brief 013 (rev 1.1) — la capa micro: pura, determinista, con la propiedad de prefijo y
// coherente con el macro (plantilla en el tiempo, posesión del tiro, continuidad causal,
// magnitudes). Umbrales y vocabularios importados de limites.ts.
import { describe, expect, it } from "vitest";
import { verificarMicro, VERIFICADORES } from "../invariantes";
import { CONDUCCION_M, PASE_M } from "../limites";
import { micro, type MicroPartido } from "../micro";
import { simular } from "../motor";
import { configDeSemilla } from "../plantillas";
import type { Evento, Partido } from "../tipos";

const corpus: Partido[] = Array.from({ length: 300 }, (_, i) => simular(configDeSemilla(i + 1)));
const clonar = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Índices de los «momentos» del vivo (gol, roja, fin de periodo), calculados aquí sin importar el vivo. */
const momentos = (p: Partido) => p.eventos.flatMap((e, i) => (e.tipo === "gol" || e.tipo === "tarjeta_roja" || e.tipo === "fin_periodo" ? [i] : []));

describe("013 · pureza y determinismo", () => {
  it("micro no toca el Partido (mismo JSON antes y después)", () => {
    for (const p of corpus.slice(0, 50)) {
      const antes = JSON.stringify(p);
      micro(p);
      expect(JSON.stringify(p)).toBe(antes);
    }
  });

  it("micro(p) dos veces ⇒ byte a byte idéntico", () => {
    for (const p of corpus.slice(0, 100)) expect(JSON.stringify(micro(p))).toBe(JSON.stringify(micro(simular(configDeSemilla(p.config.seed)))));
  });

  it("IDs m0001… secuenciales y posesiones numeradas desde 1 sin huecos", () => {
    const m = micro(corpus[245] as Partido);
    m.eventos.forEach((x, i) => expect(x.id).toBe(`m${String(i + 1).padStart(4, "0")}`));
    m.posesiones.forEach((ps, i) => expect(ps.n).toBe(i + 1));
  });
});

describe("013 · propiedad de prefijo (sin clarividencia)", () => {
  it("corpus 1..200, todos los momentos: micro(prefijo) ≡ prefijo de micro(partido)", () => {
    const fallas: string[] = [];
    for (const p of corpus.slice(0, 200)) {
      const full = micro(p);
      for (const k of momentos(p)) {
        const pre: Partido = { config: p.config, eventos: p.eventos.slice(0, k + 1) };
        const mp = micro(pre);
        const esperado = full.eventos.slice(0, mp.eventos.length);
        const ultimoAncla = (p.eventos[k] as Evento).id;
        // el prefijo micro termina exactamente donde terminan las anclas del prefijo
        const siguiente = full.eventos[mp.eventos.length];
        if (JSON.stringify(mp.eventos) !== JSON.stringify(esperado)) fallas.push(`seed ${p.config.seed} k=${k}: eventos distintos`);
        if (siguiente && pre.eventos.some((e) => e.id === siguiente.ancla)) fallas.push(`seed ${p.config.seed} k=${k}: falta ${siguiente.id} (ancla ${siguiente.ancla} ≤ ${ultimoAncla})`);
        if (JSON.stringify(mp.posesiones) !== JSON.stringify(full.posesiones.slice(0, mp.posesiones.length))) fallas.push(`seed ${p.config.seed} k=${k}: posesiones distintas`);
      }
    }
    expect(fallas.slice(0, 10)).toEqual([]);
  });
});

describe("013 · consistencia con el macro (invariantes de la capa)", () => {
  it("corpus 1..300 sin violaciones; y la guarda de entrada la aplica (VERIFICADORES.micro)", () => {
    const fallas = corpus.flatMap((p) => verificarMicro(p, micro(p)).map((e) => `seed ${p.config.seed}: ${e}`));
    expect(fallas.slice(0, 10)).toEqual([]);
    expect(VERIFICADORES.micro(corpus[0] as Partido)).toEqual([]);
  });

  it("la capa ejercita lo que vigila: hay regates, duelos, pérdidas, pases largos y cortos, conducciones", () => {
    const m = micro(corpus[245] as Partido);
    for (const t of ["pase", "conduccion", "regate", "duelo", "perdida", "recuperacion"]) expect(m.eventos.some((x) => x.tipo === t), t).toBe(true);
    const d = m.eventos.filter((x) => x.tipo === "pase").map((x) => x.distanciaM as number);
    expect(d.some((x) => x < PASE_M.corto.max)).toBe(true);
    expect(d.some((x) => x >= PASE_M.largo.min)).toBe(true);
    const c = m.eventos.filter((x) => x.tipo === "conduccion").map((x) => x.distanciaM as number);
    expect(Math.min(...c)).toBeGreaterThanOrEqual(CONDUCCION_M.min);
    expect(Math.max(...c)).toBeLessThanOrEqual(CONDUCCION_M.max);
  });

  it("el feed se lee como fútbol: tras un pase completado actúa su receptor (muestra de la 246)", () => {
    const m = micro(corpus[245] as Partido);
    let cadenas = 0;
    m.eventos.forEach((x, i) => {
      const s = m.eventos[i + 1];
      if (x.tipo === "pase" && x.completado && s && s.posesion === x.posesion) {
        expect(s.jugador).toBe(x.receptor);
        cadenas++;
      }
    });
    expect(cadenas).toBeGreaterThan(100);
  });
});

describe("013 · mutaciones de control sobre verificarMicro", () => {
  const p = corpus[245] as Partido;
  const base = micro(p);
  const roja = p.eventos.find((e) => e.tipo === "tarjeta_roja") as Evento;
  const iRoja = p.eventos.indexOf(roja);

  it("el partido base está limpio", () => expect(verificarMicro(p, base)).toEqual([]));

  it("detecta un regate de un EXPULSADO (después de su roja)", () => {
    const m = clonar(base);
    const x = m.eventos.find((e) => e.tipo === "regate" && p.eventos.findIndex((a) => a.id === e.ancla) > iRoja && e.equipo === roja.equipo) as MicroPartido["eventos"][number];
    x.jugador = roja.jugador as string;
    expect(verificarMicro(p, m).some((e) => e.includes(`${roja.jugador} no está en cancha`))).toBe(true);
  });

  it("detecta a un suplente que juega ANTES de entrar", () => {
    const cambio = p.eventos.find((e) => e.tipo === "cambio") as Evento;
    const iCambio = p.eventos.indexOf(cambio);
    const m = clonar(base);
    const x = m.eventos.find((e) => e.equipo === cambio.equipo && p.eventos.findIndex((a) => a.id === e.ancla) < iCambio) as MicroPartido["eventos"][number];
    x.jugador = cambio.jugador as string;
    expect(verificarMicro(p, m).some((e) => e.includes("no está en cancha"))).toBe(true);
  });

  it("detecta una cadena rota (pasa A→B y actúa C)", () => {
    const m = clonar(base);
    const i = m.eventos.findIndex((x, k) => x.tipo === "pase" && x.completado && m.eventos[k + 1]?.posesion === x.posesion && m.eventos[k + 1]?.ancla === x.ancla);
    const pase = m.eventos[i] as MicroPartido["eventos"][number];
    const otro = p.config[pase.equipo].jugadores.slice(1, 11).find((j) => j.nombre !== pase.receptor && j.nombre !== pase.jugador && j.nombre !== m.eventos[i + 1]?.jugador)!;
    pase.receptor = otro.nombre;
    expect(verificarMicro(p, m).some((e) => e.includes("continuidad rota"))).toBe(true);
  });

  it("detecta una posesión de tiro que no termina en el tirador", () => {
    const m = clonar(base);
    const tiro = p.eventos.find((e, k) => e.tipo === "tiro" && m.eventos.some((x) => x.ancla === e.id) && k > 0) as Evento;
    const ult = [...m.eventos].reverse().find((x) => x.ancla === tiro.id) as MicroPartido["eventos"][number];
    if (ult.tipo === "pase") ult.receptor = p.config[ult.equipo].jugadores.slice(1, 11).find((j) => j.nombre !== tiro.jugador && j.nombre !== ult.jugador)!.nombre;
    else ult.jugador = p.config[ult.equipo].jugadores.slice(1, 11).find((j) => j.nombre !== tiro.jugador)!.nombre;
    expect(verificarMicro(p, m).some((e) => e.includes(`(tiro de ${tiro.jugador})`))).toBe(true);
  });

  it("detecta magnitudes fuera de banda y un pase largo desde la zona de ataque", () => {
    const m = clonar(base);
    const pase = m.eventos.find((x) => x.tipo === "pase") as MicroPartido["eventos"][number];
    pase.distanciaM = PASE_M.largo.max + 5;
    const cond = m.eventos.find((x) => x.tipo === "conduccion") as MicroPartido["eventos"][number];
    cond.distanciaM = CONDUCCION_M.max + 1;
    const arriba = m.eventos.find((x) => x.tipo === "pase" && x.zona === "ataque" && x !== pase) as MicroPartido["eventos"][number];
    arriba.distanciaM = PASE_M.largo.min;
    const err = verificarMicro(p, m);
    expect(err.some((e) => e.includes(`pase de ${PASE_M.largo.max + 5} m`))).toBe(true);
    expect(err.some((e) => e.includes("conducción de"))).toBe(true);
    expect(err.some((e) => e.includes("pase largo desde la zona de ataque"))).toBe(true);
  });

  it("detecta minutos que retroceden y un id fuera de secuencia", () => {
    const m = clonar(base);
    (m.eventos[10] as MicroPartido["eventos"][number]).minuto = 99;
    (m.eventos[20] as MicroPartido["eventos"][number]).id = "m9999";
    const err = verificarMicro(p, m);
    expect(err.some((e) => e.includes("< anterior"))).toBe(true);
    expect(err.some((e) => e.includes("id no secuencial"))).toBe(true);
  });
});
