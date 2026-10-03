// Brief 019 — rarezas de las consecuencias (`npm run test:stats`): lesiones por partido en banda
// (LESIONES_MEDIA, limites.ts) sobre el corpus de liga completo (8 ligas, temporada actual) y sobre
// las semillas sueltas con la variante encendida; severidad dentro de LESION_JORNADAS con todos sus
// niveles; e informe de sanciones y de los hechos nuevos. Nada repetido a mano.
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import { TEMPORADA_ACTUAL } from "../../analista/umbrales";
import { LESION_JORNADAS, LESIONES_MEDIA, N_ESTADISTICA } from "../../sim/limites";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import { mundo } from "../mundo";
import { partidosDeTemporada } from "../rating";
import { simularTemporada } from "../temporada";

const temporadas = mundo().ligas.map((l) => simularTemporada(l, TEMPORADA_ACTUAL));
const partidos = temporadas.flatMap((t) => partidosDeTemporada(t));
const informe = (k: string, v: string) => console.log(`[019] ${k}: ${v}`);
const pct = (a: number, b: number) => `${((a * 100) / b).toFixed(1)} %`;

describe(`019 · consecuencias en el corpus de liga (${partidos.length} partidos)`, () => {
  it("lesiones por partido dentro de LESIONES_MEDIA (liga y semillas sueltas con la variante)", () => {
    const liga = partidos.flatMap((p) => p.eventos.filter((e) => e.tipo === "lesion")).length / partidos.length;
    let n = 0;
    for (let s = 1; s <= N_ESTADISTICA; s++) n += simular({ ...configDeSemilla(s), variantes: { lesiones: true } }).eventos.filter((e) => e.tipo === "lesion").length;
    const sueltas = n / N_ESTADISTICA;
    informe("lesiones/partido (liga · sueltas con variante)", `${liga.toFixed(3)} · ${sueltas.toFixed(3)}`);
    for (const x of [liga, sueltas]) {
      expect(x).toBeGreaterThanOrEqual(LESIONES_MEDIA.min);
      expect(x).toBeLessThanOrEqual(LESIONES_MEDIA.max);
    }
  });

  it("severidad: toda baja en LESION_JORNADAS y cada nivel aparece", () => {
    const bajas = temporadas.flatMap((t) => t.lesiones.map((l) => l.jornadas));
    const porNivel = new Map<number, number>();
    for (const b of bajas) porNivel.set(b, (porNivel.get(b) ?? 0) + 1);
    informe("lesiones por jornadas de baja", [...porNivel.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}: ${v}`).join(" · "));
    for (let k = LESION_JORNADAS.min; k <= LESION_JORNADAS.max; k++) expect(porNivel.get(k) ?? 0, `nivel ${k}`).toBeGreaterThan(0);
    expect(bajas.every((b) => b >= LESION_JORNADAS.min && b <= LESION_JORNADAS.max)).toBe(true);
  });

  it("informe: sanciones y rareza de los hechos nuevos", () => {
    const s = temporadas.flatMap((t) => t.sanciones);
    informe("sanciones/partido (doble amarilla · roja directa)", `${(s.length / partidos.length).toFixed(3)} (${s.filter((x) => x.motivo === "doble_amarilla").length} · ${s.filter((x) => x.motivo === "roja_directa").length})`);
    const hs = partidos.map((p) => analizar(p));
    for (const t of ["lesion_en_partido", "bajas_del_partido"]) informe(t, `${pct(hs.filter((h) => h.some((x) => x.tipo === t)).length, partidos.length)} de los partidos`);
    const diezmados = hs.filter((h) => h.some((x) => x.tipo === "bajas_del_partido" && Number(x.datos.bajas) >= 2)).length;
    informe("partidos con un equipo de 2+ bajas («diezmado» habilitado)", pct(diezmados, partidos.length));
    expect(s.length).toBeGreaterThan(0);
  });
});
