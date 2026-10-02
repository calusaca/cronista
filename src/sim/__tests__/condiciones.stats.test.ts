// Brief 018 — los seis efectos de las condiciones, cada uno con su A/B estadístico: N_AB
// partidos CON la condición contra los mismos N_AB SIN ella (semillas 1..N_AB, mismos equipos).
// Efecto presente, con el signo del brief y dentro de su banda (AB_CONDICIONES, limites.ts).
//
// Copia independiente: las bandas se escribieron en limites.ts como expectativa del brief, APARTE
// de los modificadores del generador (parametros.ts / CONDICIONES), que esta prueba NO importa. Si
// alguien mueve un modificador, el efecto sale de su banda. Las mediciones se recuentan aquí, por
// su cuenta, sobre los eventos y la capa micro (no se usa src/analista/condiciones.ts).
import { describe, expect, it } from "vitest";
import { verificarEspacial } from "../invariantes";
import { AB_CONDICIONES as B, N_AB, PASE_M, SALIDA_TEMPRANA_MIN, TEMPERATURA_C } from "../limites";
import { micro, type MicroPartido } from "../micro";
import { simular } from "../motor";
import { configDeSemilla } from "../plantillas";
import type { Condiciones, Partido } from "../tipos";

const NEUTRAS: Condiciones = { clima: "despejado", superficie: "natural", cesped: "corto", presion: { local: "baja", visita: "media" } };
interface Brazo {
  p: Partido;
  m: MicroPartido;
}
const brazo = (c?: Condiciones): Brazo[] =>
  Array.from({ length: N_AB }, (_, i) => {
    const cfg = configDeSemilla(i + 1);
    const p = simular(c ? { ...cfg, condiciones: c } : cfg);
    return { p, m: micro(p) };
  });
const informe = (k: string, v: string) => console.log(`[A/B 018] ${k}: ${v}`);
const enBanda = (x: number, b: { min: number; max: number }) => {
  expect(x).toBeGreaterThanOrEqual(b.min);
  expect(x).toBeLessThanOrEqual(b.max);
};

/** Periodo de cada evento macro (2 desde el segundo inicio_periodo), recontado aquí. */
function periodos(p: Partido): Map<string, 1 | 2> {
  const out = new Map<string, 1 | 2>();
  let inicios = 0;
  for (const e of p.eventos) {
    if (e.tipo === "inicio_periodo") inicios++;
    out.set(e.id, inicios >= 2 ? 2 : 1);
  }
  return out;
}
const suma = (xs: Brazo[], f: (b: Brazo) => number) => xs.reduce((s, b) => s + f(b), 0);
const pasesDel = (b: Brazo, per: 1 | 2) => {
  const pp = periodos(b.p);
  return b.m.eventos.filter((x) => x.tipo === "pase" && pp.get(x.ancla) === per).length;
};
const macroDel = (b: Brazo, tipo: string, per: 1 | 2) => {
  const pp = periodos(b.p);
  return b.p.eventos.filter((e) => e.tipo === tipo && pp.get(e.id) === per).length;
};
const completacion = (xs: Brazo[], filtro: (x: MicroPartido["eventos"][number]) => boolean) => {
  const ps = xs.flatMap((b) => b.m.eventos.filter((x) => x.tipo === "pase" && filtro(x)));
  return ps.filter((x) => x.completado).length / ps.length;
};

const control = brazo();

describe(`018 · A/B de las condiciones, N = ${N_AB} por brazo`, () => {
  it("1 · calor ⇒ cansancio: el 2.º tiempo cae (pases y tiros), el 1.º no cambia, y cae más con más calor", () => {
    const max = brazo({ ...NEUTRAS, clima: "calor", temperaturaC: TEMPERATURA_C.calor.max });
    const baja = brazo({ ...NEUTRAS, clima: "calor", temperaturaC: B.calorTemperaturaBaja });
    const p2 = (xs: Brazo[]) => suma(xs, (b) => pasesDel(b, 2)) / suma(control, (b) => pasesDel(b, 2));
    const t2 = suma(max, (b) => macroDel(b, "tiro", 2)) / suma(control, (b) => macroDel(b, "tiro", 2));
    informe("pases 2T (41 °C · 30 °C)", `${p2(max).toFixed(3)} · ${p2(baja).toFixed(3)}`);
    informe("tiros 2T (41 °C)", t2.toFixed(3));
    enBanda(p2(max), B.calorPases2T);
    enBanda(t2, B.calorTiros2T);
    expect(p2(baja)).toBeGreaterThan(p2(max));
    expect(p2(baja)).toBeLessThan(1);
    // El 1.er tiempo es exactamente el mismo partido: el calor no actúa antes del descanso.
    expect(suma(max, (b) => pasesDel(b, 1))).toBe(suma(control, (b) => pasesDel(b, 1)));
  });

  it("2 · calor ⇒ más faltas en el 2.º tiempo (piernas pesadas), ninguna de más en el 1.º", () => {
    const max = brazo({ ...NEUTRAS, clima: "calor", temperaturaC: TEMPERATURA_C.calor.max });
    const f2 = suma(max, (b) => macroDel(b, "falta", 2)) / suma(control, (b) => macroDel(b, "falta", 2));
    informe("faltas 2T (41 °C)", f2.toFixed(3));
    enBanda(f2, B.calorFaltas2T);
    expect(suma(max, (b) => macroDel(b, "falta", 1))).toBe(suma(control, (b) => macroDel(b, "falta", 1)));
  });

  it("3 · lluvia ⇒ pases más imprecisos y más atajadas sueltas (atajada ⇒ córner)", () => {
    const ll = brazo({ ...NEUTRAS, clima: "lluvia" });
    const dc = completacion(ll, () => true) - completacion(control, () => true);
    const sueltas = (xs: Brazo[]) => {
      let a = 0;
      let c = 0;
      for (const b of xs)
        b.p.eventos.forEach((e, i) => {
          if (e.tipo !== "atajada") return;
          a++;
          const sig = b.p.eventos[i + 1];
          if (sig?.tipo === "corner" && sig.equipo === e.equipo) c++;
        });
      return c / a;
    };
    const rc = sueltas(ll) / sueltas(control);
    informe("completación (diferencia) · atajada⇒córner (cociente)", `${dc.toFixed(4)} · ${rc.toFixed(3)}`);
    enBanda(dc, B.lluviaCompletacion);
    enBanda(rc, B.lluviaCornerTrasAtajada);
  });

  it("4 · sintética ⇒ tiro más rápido (bandas del 015 intactas) y más tiros de media distancia", () => {
    const si = brazo({ ...NEUTRAS, superficie: "sintetica", cesped: undefined });
    const tiros = (xs: Brazo[]) => xs.flatMap((b) => b.p.eventos.filter((e) => e.tipo === "tiro" && e.penal !== true));
    const vel = (xs: Brazo[]) => tiros(xs).reduce((s, e) => s + (e.velocidadKmh ?? 0), 0) / tiros(xs).length;
    const md = (xs: Brazo[]) => tiros(xs).filter((e) => e.zonaOrigen === "media_distancia").length / tiros(xs).length;
    const dv = vel(si) - vel(control);
    const rm = md(si) / md(control);
    informe("velocidad media (diferencia km/h) · media distancia (cociente)", `${dv.toFixed(2)} · ${rm.toFixed(3)}`);
    enBanda(dv, B.sinteticaVelocidadKmh);
    enBanda(rm, B.sinteticaMediaDistancia);
    // «bandas del 015 respetadas»: ni un tiro de la sintética fuera de su banda de credibilidad.
    expect(si.flatMap((b) => verificarEspacial(b.p)).slice(0, 5)).toEqual([]);
  });

  it("5 · césped alto ⇒ el VISITANTE completa menos pases cortos; el local (que entrena ahí), no", () => {
    const alto = brazo({ ...NEUTRAS, cesped: "alto" });
    const corto = (lado: "local" | "visita") => (x: MicroPartido["eventos"][number]) => x.equipo === lado && (x.distanciaM ?? 0) < PASE_M.corto.max;
    const dv = completacion(alto, corto("visita")) - completacion(control, corto("visita"));
    const dl = completacion(alto, corto("local")) - completacion(control, corto("local"));
    informe("cortos visita · local (diferencias)", `${dv.toFixed(4)} · ${dl.toFixed(4)}`);
    enBanda(dv, B.cespedVisitaCortos);
    expect(Math.abs(dl)).toBeLessThanOrEqual(B.cespedLocalTolerancia);
  });

  it(`6 · presión alta ⇒ más pérdidas en salida del presionado antes del ${SALIDA_TEMPRANA_MIN}', no después`, () => {
    const pr = brazo({ ...NEUTRAS, presion: { local: "media", visita: "alta" } });
    const perd = (xs: Brazo[], temprano: boolean) =>
      suma(xs, (b) => b.m.eventos.filter((x) => x.tipo === "perdida" && x.equipo === "visita" && x.zona === "defensa" && x.minuto < SALIDA_TEMPRANA_MIN === temprano).length);
    const rt = perd(pr, true) / perd(control, true);
    const rd = perd(pr, false) / perd(control, false);
    informe("pérdidas en salida tempranas · después (cocientes)", `${rt.toFixed(3)} · ${rd.toFixed(3)}`);
    enBanda(rt, B.presionSalidaTemprana);
    enBanda(rd, B.presionSalidaDespues);
  });
});
