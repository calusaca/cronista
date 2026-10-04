// Brief 026 — la grada (suite rápida). Pureza (mismos eventos ⇒ mismas reacciones, sin RNG
// propio), ORÁCULO independiente de las seis reacciones (las rachas del olé recontadas por otro
// camino), propiedad de prefijo (macro y por minuto del vivo), citas que existen, umbrales, y la
// identidad de la afición derivada (el mundo no cambia; el cántico sale solo de las plantillas).
import { describe, expect, it } from "vitest";
import {
  AFICION_COLECTIVOS,
  AFICION_FINALES,
  AFICION_SILABAS,
  ALIENTO_DIFERENCIA,
  ALIENTO_MINUTO,
  CANTICOS,
  OLE_MINUTO_MIN,
  OLE_RACHA_MIN,
  OVACION_NOTA_MIN,
  TEMPORADA_ACTUAL,
  TIPOS_REACCION,
} from "../../analista/umbrales";
import { valorar } from "../../analista/valoracion";
import { crearMundo, mundo } from "../../mundo/mundo";
import { configDePartidoLiga } from "../../mundo/temporada";
import { micro, type MicroPartido } from "../../sim/micro";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Lado, Partido } from "../../sim/tipos";
import { aficionDe, nombrePropio, reacciones, type Reaccion } from "../grada";

const json = (x: unknown) => JSON.stringify(x);
const otro = (l: Lado): Lado => (l === "local" ? "visita" : "local");
const sueltos: Partido[] = Array.from({ length: 160 }, (_, i) => simular(configDeSemilla(i + 1)));
const liga: Partido[] = mundo()
  .ligas.slice(0, 2)
  .flatMap((l) => Array.from({ length: 30 }, (_, k) => simular(configDePartidoLiga(l, TEMPORADA_ACTUAL, Math.floor(k / 5) + 1, (k % 5) + 1))));
const corpus = [...sueltos, ...liga];

/**
 * ORÁCULO de las rachas del olé, por otro camino: posesión por posesión, se cortan los pases en
 * tramos de completados consecutivos que cumplen minuto y ventaja (marcador recontado de los
 * goles con índice anterior al ancla). Devuelve los ids de cada racha ≥ OLE_RACHA_MIN.
 */
function oraculoOle(p: Partido, m: MicroPartido): string[][] {
  const out: string[][] = [];
  for (const ps of m.posesiones) {
    let tramo: string[] = [];
    const cortar = () => {
      if (tramo.length >= OLE_RACHA_MIN) out.push(tramo);
      tramo = [];
    };
    for (const x of m.eventos.filter((y) => y.posesion === ps.n && y.tipo === "pase")) {
      const k = p.eventos.findIndex((e) => e.id === x.ancla);
      const g: Record<Lado, number> = { local: 0, visita: 0 };
      for (const e of p.eventos.slice(0, k)) if (e.tipo === "gol") g[e.equipo]++;
      if (x.completado === true && x.minuto >= OLE_MINUTO_MIN && g[x.equipo] > g[otro(x.equipo)]) tramo.push(x.id);
      else cortar();
    }
    cortar();
  }
  return out;
}

describe("026 · pureza: mismos eventos ⇒ mismas reacciones, sin RNG propio", () => {
  it("dos veces, y sobre una copia profunda de los eventos, byte a byte (1..160 + 60 de liga)", () => {
    for (const p of corpus) {
      const a = reacciones(p);
      expect(json(reacciones(JSON.parse(json(p)) as Partido))).toBe(json(a));
      expect(json(reacciones(p, micro(p)))).toBe(json(a));
    }
  });

  it("no toca el partido (lee, no escribe)", () => {
    const p = sueltos[5]!;
    const antes = json(p);
    reacciones(p);
    expect(json(p)).toBe(antes);
  });
});

describe("026 · oráculo independiente de las seis reacciones", () => {
  it("olé: las mismas rachas que el oráculo, con los mismos pases, en su minuto, y nunca antes del 60'", () => {
    let oles = 0;
    for (const p of corpus) {
      const m = micro(p);
      const rs = reacciones(p, m).filter((r) => r.tipo === "ole");
      const esp = oraculoOle(p, m);
      expect(rs.map((r) => r.micro.join()).sort(), `${p.config.seed}`).toEqual(esp.map((x) => x.join()).sort());
      const porId = new Map(m.eventos.map((x) => [x.id, x] as const));
      for (const r of rs) {
        oles++;
        const pases = r.micro.map((id) => porId.get(id)!);
        expect(pases.length).toBeGreaterThanOrEqual(OLE_RACHA_MIN);
        expect(pases.every((x) => x.tipo === "pase" && x.completado === true && x.equipo === r.lado && x.minuto >= OLE_MINUTO_MIN)).toBe(true);
        expect(r.minuto).toBe(pases[pases.length - 1]!.minuto);
        expect(r.disparo).toBe(pases[0]!.ancla);
      }
    }
    expect(oles).toBeGreaterThan(20);
  });

  it("rugido / grito visitante: exactamente uno por gol, del sector que lo SUMA; el que lo sufre calla", () => {
    for (const p of corpus) {
      const rs = reacciones(p).filter((r) => r.tipo === "rugido" || r.tipo === "grito_visitante");
      const goles = p.eventos.filter((e) => e.tipo === "gol");
      expect(rs.map((r) => `${r.tipo}:${r.eventos.join()}`)).toEqual(goles.map((g) => `${g.equipo === "local" ? "rugido" : "grito_visitante"}:${g.id}`));
    }
  });

  it("silbidos al descanso ⇔ el local pierde al primer pitazo; aliento ⇔ pierde por uno al llegar al 75'", () => {
    let silbidos = 0;
    let aliento = 0;
    for (const p of corpus) {
      const ev = p.eventos;
      const golesHasta = (k: number) => ev.slice(0, k).filter((e) => e.tipo === "gol");
      const cuenta = (gs: typeof ev) => ({ local: gs.filter((g) => g.equipo === "local").length, visita: gs.filter((g) => g.equipo === "visita").length });
      const k45 = ev.findIndex((e) => e.tipo === "fin_periodo");
      const g45 = cuenta(golesHasta(k45));
      const rs = reacciones(p);
      const s = rs.filter((r) => r.tipo === "silbidos_descanso");
      expect(s.length, `${p.config.seed}`).toBe(g45.local < g45.visita ? 1 : 0);
      if (s[0]) {
        silbidos++;
        expect(s[0].eventos).toEqual([ev[k45]!.id, ...golesHasta(k45).map((g) => g.id)]);
      }
      const k75 = ev.findIndex((e) => e.minuto >= ALIENTO_MINUTO);
      const g75 = cuenta(golesHasta(k75));
      const a = rs.filter((r) => r.tipo === "aliento");
      expect(a.length, `${p.config.seed}`).toBe(g75.visita - g75.local === ALIENTO_DIFERENCIA ? 1 : 0);
      if (a[0]) {
        aliento++;
        expect([a[0].minuto, a[0].eventos.join()]).toEqual([ALIENTO_MINUTO, golesHasta(k75).map((g) => g.id).join()]);
      }
    }
    expect(silbidos).toBeGreaterThan(0);
    expect(aliento).toBeGreaterThan(0);
  });

  it("ovación ⇔ sale sustituido el mejor valorado hasta ese momento con nota ≥ OVACION_NOTA_MIN (recálculo propio de la «figura» del prefijo)", () => {
    let vistas = 0;
    for (const p of corpus) {
      const esperadas: string[] = [];
      p.eventos.forEach((e, k) => {
        if (e.tipo !== "cambio" || !e.sale) return;
        const vals = valorar({ config: p.config, eventos: p.eventos.slice(0, k + 1) }).filter((v) => v.desglose.length > 0);
        const max = Math.max(...vals.map((v) => v.nota));
        const top = vals.filter((v) => v.nota === max);
        const sale = vals.find((v) => v.jugador === e.sale && v.lado === e.equipo);
        // sin empate en la cima (si empata, decide el desempate del 009, que la vista usa: se omite aquí)
        if (top.length === 1 && sale && top[0] === sale && sale.nota >= OVACION_NOTA_MIN) esperadas.push(e.id);
      });
      const rs = reacciones(p).filter((r) => r.tipo === "ovacion");
      for (const id of esperadas) expect(rs.some((r) => r.disparo === id), `${p.config.seed} ${id}`).toBe(true);
      for (const r of rs) {
        vistas++;
        const k = p.eventos.findIndex((e) => e.id === r.disparo);
        const v = valorar({ config: p.config, eventos: p.eventos.slice(0, k + 1) }).find((x) => x.jugador === p.eventos[k]!.sale && x.lado === r.lado)!;
        expect(v.nota).toBeGreaterThanOrEqual(OVACION_NOTA_MIN);
        expect(r.eventos[0]).toBe(r.disparo);
      }
    }
    expect(vistas).toBeGreaterThan(0);
  });
});

describe("026 · propiedad de prefijo (sin clarividencia)", () => {
  it("sobre cada prefijo macro, las reacciones son exactamente las primeras del partido", () => {
    const fallas: string[] = [];
    for (const p of corpus.slice(0, 40)) {
      const todas = reacciones(p);
      p.eventos.forEach((_, k) => {
        const pre = reacciones({ config: p.config, eventos: p.eventos.slice(0, k + 1) });
        if (json(pre) !== json(todas.slice(0, pre.length))) fallas.push(`${p.config.seed} k=${k}`);
      });
    }
    expect(fallas.slice(0, 5)).toEqual([]);
  });

  it("como en el vivo (eventos ≤ minuto M): todo pase del olé y todo evento citado tienen minuto ≤ M", () => {
    for (const p of corpus.slice(0, 60)) {
      for (const M of [30, 45, 61, 70, 80, 88]) {
        const visto: Partido = { config: p.config, eventos: p.eventos.filter((e) => e.minuto <= M) };
        const m = micro(visto);
        const minMicro = new Map(m.eventos.map((x) => [x.id, x.minuto] as const));
        const minMacro = new Map(visto.eventos.map((e) => [e.id, e.minuto] as const));
        for (const r of reacciones(visto, m)) {
          expect(r.minuto).toBeLessThanOrEqual(M);
          for (const id of r.micro) expect(minMicro.get(id)!).toBeLessThanOrEqual(M);
          for (const id of r.eventos) expect(minMacro.get(id)!).toBeLessThanOrEqual(M);
        }
      }
    }
  });
});

describe("026 · citas, umbrales y la afición", () => {
  it("cada reacción cita ids que existen, es de la lista cerrada y el cántico sale solo en el olé y el aliento", () => {
    for (const p of corpus) {
      const m = micro(p);
      const macro = new Set(p.eventos.map((e) => e.id));
      const mic = new Set(m.eventos.map((x) => x.id));
      for (const r of reacciones(p, m)) {
        expect(TIPOS_REACCION).toContain(r.tipo);
        expect(macro.has(r.disparo)).toBe(true);
        for (const id of r.eventos) expect(macro.has(id)).toBe(true);
        for (const id of r.micro) expect(mic.has(id)).toBe(true);
        expect(r.eventos.length + r.micro.length).toBeGreaterThan(0);
        const a = aficionDe(p.config[r.lado].nombre);
        expect(r.canto !== undefined).toBe(r.tipo === "ole" || r.tipo === "aliento");
        if (r.canto) {
          expect(r.canto).toEqual(a.canto);
          expect(r.texto_es).toContain(a.canto.es);
          expect(r.texto_en).toContain(a.canto.en);
        } else {
          expect(r.texto_es).not.toContain(a.canto.es);
          expect(r.texto_en).not.toContain(a.canto.en);
        }
      }
    }
  });

  it("las seis reacciones aparecen en el corpus (ningún detector muerto)", () => {
    const vistas = new Set(corpus.flatMap((p) => reacciones(p).map((r) => r.tipo)));
    expect([...vistas].sort()).toEqual([...TIPOS_REACCION].sort());
  });

  it("afición de los 80 equipos del mundo: derivada (dos veces igual), de las listas cerradas, y el mundo no cambia", () => {
    const equipos = mundo().ligas.flatMap((l) => l.equipos.map((e) => e.equipo.nombre));
    expect(equipos).toHaveLength(80);
    const antes = json(mundo());
    const silaba = `(?:${AFICION_SILABAS.join("|")})`;
    for (const n of equipos) {
      const a = aficionDe(n);
      expect(aficionDe(n)).toEqual(a);
      const [colectivo, palabra] = a.sector.split(" ") as [string, string];
      expect(AFICION_COLECTIVOS as readonly string[]).toContain(colectivo);
      expect(new RegExp(`^${silaba}{2,3}(?:${AFICION_FINALES.join("|")})$`).test(palabra.toLowerCase()), a.sector).toBe(true);
      // el cántico es UNA de las plantillas cerradas, con el nombre del equipo y/o su sector
      const de = CANTICOS.filter((c) => c.es.replaceAll("{n}", nombrePropio(n)).replaceAll("{s}", a.sector) === a.canto.es && c.en.replaceAll("{n}", nombrePropio(n)).replaceAll("{s}", a.sector) === a.canto.en);
      expect(de, n).toHaveLength(1);
    }
    expect(json(mundo())).toBe(antes);
    expect(json(crearMundo())).toBe(antes);
  });

  it("los casos del smoke y del e2e (semilla 246, la portada): rugido al 3' y UN olé de 16 pases al 81'", () => {
    const p = simular(configDeSemilla(246));
    const rs = reacciones(p);
    expect([rs[0]!.tipo, rs[0]!.minuto]).toEqual(["rugido", 3]);
    const oles = rs.filter((r) => r.tipo === "ole");
    expect(oles.map((r) => [r.minuto, r.micro.length, p.config[r.lado].nombre])).toEqual([[81, 16, "Juventud Islaverde Sur"]]);
  });

  it("el umbral abrazado por los dos lados: semilla 23 (racha máxima EXACTA 15) ⇒ olé; semilla 35 (máxima 14) ⇒ ningún olé", () => {
    // La racha máxima se recuenta SIN umbral (tramos que cumplen minuto, ventaja y posesión), así el
    // caso no depende de la constante que prueba: si el umbral baja a 14, la 35 gana un olé; si sube a
    // 16, la 23 lo pierde.
    const maxima = (p: Partido) => {
      const m = micro(p);
      let max = 0;
      for (const ps of m.posesiones) {
        let n = 0;
        for (const x of m.eventos.filter((y) => y.posesion === ps.n && y.tipo === "pase")) {
          const k = p.eventos.findIndex((e) => e.id === x.ancla);
          const g: Record<Lado, number> = { local: 0, visita: 0 };
          for (const e of p.eventos.slice(0, k)) if (e.tipo === "gol") g[e.equipo]++;
          if (x.completado === true && x.minuto >= OLE_MINUTO_MIN && g[x.equipo] > g[otro(x.equipo)]) n++;
          else n = 0;
          max = Math.max(max, n);
        }
      }
      return max;
    };
    const si = simular(configDeSemilla(23));
    const no = simular(configDeSemilla(35));
    expect([maxima(si), maxima(no)]).toEqual([15, 14]);
    expect(reacciones(si).filter((r) => r.tipo === "ole").map((r) => r.micro.length)).toEqual([15]);
    expect(reacciones(no).filter((r) => r.tipo === "ole")).toEqual([]);
  });

  it("el nombre propio quita la palabra de club (también con lugares de dos palabras)", () => {
    expect(nombrePropio("Racing Torarido")).toBe("Torarido");
    expect(nombrePropio("Juventud Islaverde Sur")).toBe("Islaverde Sur");
    expect(nombrePropio("Ormidia")).toBe("Ormidia");
  });

  it("el olé y el aliento nombran al equipo correcto; el tipo de cada reacción es coherente con su sector", () => {
    for (const p of corpus) {
      for (const r of reacciones(p) as Reaccion[]) {
        if (r.tipo === "rugido") expect(r.lado).toBe("local");
        if (r.tipo === "grito_visitante") expect(r.lado).toBe("visita");
        if (r.tipo === "silbidos_descanso" || r.tipo === "aliento") expect(r.lado).toBe("local");
        if (r.tipo === "ole") expect(r.texto_en).toContain(p.config[r.lado].nombre);
      }
    }
  });
});
