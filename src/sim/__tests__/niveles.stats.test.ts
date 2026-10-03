// Brief 024 — los CINCO efectos del nivel, A/B DENTRO del equipo (N_AB_NIVELES partidos con la
// variante): el tercil alto del plantel (TERCIL_PLANTEL de más nivel) contra el bajo, en los MISMOS
// partidos, con las bandas de limites.AB_NIVELES (escritas aparte de parametros.NIVELES). Y el
// control: sin la variante, la misma medición da ~0. Luego, el corpus de liga completo: la figura
// en el tercil alto y las bandas GLOBALES de siempre (goles, xG, tarjetas): el nivel redistribuye
// dentro del equipo, no infla el total. Recuento propio: no se usa src/sim/niveles.ts salvo para
// poner los niveles en la config.
import { describe, expect, it } from "vitest";
import { figura } from "../../analista/valoracion";
import { mundo } from "../../mundo/mundo";
import { simularTemporada } from "../../mundo/temporada";
import { AB_NIVELES as B, AMARILLAS_MEDIA, FIGURA_TERCIL_ALTO_MIN, GOLES_MEDIA, N_AB_NIVELES, ROJA_MAX_FRACCION, ROJA_MIN_FRACCION, TERCIL_PLANTEL, XG_MEDIA } from "../limites";
import { micro } from "../micro";
import { simular } from "../motor";
import { conNiveles, nivelesDe } from "../niveles";
import { configDeSemilla } from "../plantillas";
import type { Lado, Partido, SimConfig } from "../tipos";

const informe = (k: string, v: string) => console.log(`[024] ${k}: ${v}`);
const conNiv = (c: SimConfig, on: boolean): SimConfig => ({ ...c, local: conNiveles(c.local, nivelesDe(c.local)), visita: conNiveles(c.visita, nivelesDe(c.visita)), ...(on ? { variantes: { niveles: true } } : {}) });
const media = (p: Partido, l: Lado) => (p.config[l].ataque + p.config[l].defensa) / 2;

/** Las cinco mediciones, tercil alto vs bajo de cada plantel, en los mismos partidos. */
function medir(on: boolean) {
  const par = (): [number, number] => [0, 0];
  const c = { pA: par(), pB: par(), rA: par(), rB: par(), tA: 0, tB: 0, xA: par(), xB: par(), gA: par(), gB: par() };
  for (let s = 1; s <= N_AB_NIVELES; s++) {
    const p = simular(conNiv(configDeSemilla(s), on));
    const tercil = new Map<string, "A" | "B">();
    for (const l of ["local", "visita"] as Lado[]) {
      const js = [...p.config[l].jugadores].sort((a, b) => (b.nivel as number) - (a.nivel as number) || a.nombre.localeCompare(b.nombre));
      js.slice(0, TERCIL_PLANTEL).forEach((j) => tercil.set(`${l}|${j.nombre}`, "A"));
      js.slice(-TERCIL_PLANTEL).forEach((j) => tercil.set(`${l}|${j.nombre}`, "B"));
    }
    for (const x of micro(p).eventos) {
      const t = tercil.get(`${x.equipo}|${x.jugador}`);
      if (!t) continue;
      if (x.tipo === "pase") ((a) => (a[1]++, x.completado && a[0]++))(t === "A" ? c.pA : c.pB);
      if (x.tipo === "regate" || x.tipo === "duelo") ((a) => (a[1]++, x.exito && a[0]++))(t === "A" ? c.rA : c.rB);
    }
    const goles = new Set(p.eventos.filter((e) => e.tipo === "gol").map((e) => e.relacionadoCon));
    const atajadas = new Set(p.eventos.filter((e) => e.tipo === "atajada").map((e) => e.relacionadoCon));
    for (const e of p.eventos) {
      if (e.tipo !== "tiro" || e.penal === true) continue;
      const t = tercil.get(`${e.equipo}|${e.jugador}`);
      if (t === "A") (c.tA++, (c.xA[0] += e.xg ?? 0), c.xA[1]++);
      if (t === "B") (c.tB++, (c.xB[0] += e.xg ?? 0), c.xB[1]++);
      if (goles.has(e.id)) continue;
      // el portero titular del que defiende (los porteros no se cambian salvo lesión: el titular es el del arco)
      const def: Lado = e.equipo === "local" ? "visita" : "local";
      const gk = p.config[def].jugadores.find((j) => j.posicion === "POR");
      const d = (gk?.nivel ?? 0) - media(p, def);
      const arr = d > 0 ? c.gA : d < 0 ? c.gB : undefined;
      if (arr) (arr[1]++, atajadas.has(e.id) && arr[0]++);
    }
  }
  const f = (a: [number, number]) => a[0] / a[1];
  return { pases: f(c.pA) - f(c.pB), regates: f(c.rA) - f(c.rB), remates: c.tA / c.tB, xg: f(c.xA) / f(c.xB), atajadas: f(c.gA) - f(c.gB) };
}

const enBanda = (x: number, b: { min: number; max: number }) => {
  expect(x).toBeGreaterThanOrEqual(b.min);
  expect(x).toBeLessThanOrEqual(b.max);
};

describe(`024 · A/B dentro del equipo, N = ${N_AB_NIVELES}`, () => {
  const con = medir(true);
  const sin = medir(false);
  const fmt = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => `${k} ${v.toFixed(3)}`).join(" · ");
  it("los cinco efectos, con signo y en banda; sin la variante, la misma medición da ~0", () => {
    informe("con la variante", fmt(con));
    informe("sin la variante (control)", fmt(sin));
    enBanda(con.pases, B.pases);
    enBanda(con.regates, B.regatesDuelos);
    enBanda(con.remates, B.remates);
    enBanda(con.xg, B.xgPorRemate);
    enBanda(con.atajadas, B.atajadas);
    for (const d of [sin.pases, sin.regates, sin.atajadas]) expect(Math.abs(d)).toBeLessThanOrEqual(B.controlDiferencia);
    for (const r of [sin.remates, sin.xg]) {
      expect(r).toBeGreaterThanOrEqual(1 / B.controlCociente);
      expect(r).toBeLessThanOrEqual(B.controlCociente);
    }
  });
});

describe("024 · corpus de liga completo (8 ligas)", () => {
  const partidos = mundo().ligas.flatMap((l) => simularTemporada(l, 1).configs.map((c) => simular(c)));
  it("la figura del partido cae en el tercil alto de su plantel en ≥ FIGURA_TERCIL_ALTO_MIN (sin tocar la nota)", () => {
    let alto = 0;
    let con = 0;
    for (const p of partidos) {
      const fg = figura(p);
      if (!fg) continue;
      con++;
      const js = [...p.config[fg.lado].jugadores].sort((a, b) => (b.nivel as number) - (a.nivel as number) || a.nombre.localeCompare(b.nombre));
      if (js.slice(0, TERCIL_PLANTEL).some((j) => j.nombre === fg.jugador)) alto++;
    }
    informe("figura en el tercil alto", `${((alto * 100) / con).toFixed(1)} % de ${con} partidos con figura`);
    expect(alto / con).toBeGreaterThanOrEqual(FIGURA_TERCIL_ALTO_MIN);
  });

  it("las bandas GLOBALES de siempre no se mueven: goles, xG, amarillas y rojas por partido", () => {
    const n = partidos.length;
    const goles = partidos.reduce((s, p) => s + p.eventos.filter((e) => e.tipo === "gol").length, 0) / n;
    const xg = partidos.reduce((s, p) => s + p.eventos.filter((e) => e.tipo === "tiro").reduce((a, e) => a + (e.xg ?? 0), 0), 0) / n;
    const am = partidos.reduce((s, p) => s + p.eventos.filter((e) => e.tipo === "tarjeta_amarilla").length, 0) / n;
    const rojas = partidos.filter((p) => p.eventos.some((e) => e.tipo === "tarjeta_roja")).length / n;
    informe("liga (720): goles · xG · amarillas por partido · partidos con roja", `${goles.toFixed(2)} · ${xg.toFixed(2)} · ${am.toFixed(2)} · ${(rojas * 100).toFixed(1)} %`);
    enBanda(goles, GOLES_MEDIA);
    enBanda(xg, XG_MEDIA);
    enBanda(am, AMARILLAS_MEDIA);
    expect(rojas).toBeGreaterThanOrEqual(ROJA_MIN_FRACCION);
    expect(rojas).toBeLessThanOrEqual(ROJA_MAX_FRACCION);
  });
});
