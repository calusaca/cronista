// Brief 062 § 6.2 · R2: `torneo-sitio-entradas.json` se regenera igual byte a byte, y la extracción de
// `entradasEstimacion` no cambia la salida de `estimarTorneo` (el ensayo en seco del 24 oct reproduce
// `docs/evidencia/torneo-059/2026-10-24/estimacion.json`, sin los campos que añade el CLI).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TORNEO_ARENA as T, TORNEO_SITIO } from "../../sim/limites";
import { esquemaTorneo, rondasPartido, reservaPartido } from "../torneo";
import { estimarFormato, type EntradasSitio } from "../torneo-formatos";
import { leerEvidencias } from "../torneo-cli";
import { generarEntradasSitio, RUTA_ENTRADAS_SITIO, TORNEO_ORIGEN_SITIO } from "../torneo-entradas-cli";
import { estimarTorneo } from "../torneo-ejecucion";

describe("062 · R2 · entradas generadas", () => {
  it("`npm run arena:torneo-entradas` regenera el JSON idéntico byte a byte", () => {
    expect(generarEntradasSitio(process.cwd())).toBe(readFileSync(RUTA_ENTRADAS_SITIO, "utf8"));
  });
  it("los participantes son los 6 del torneo del 24 oct, con precio de lista propio (sin estimadoDe)", () => {
    const e = JSON.parse(readFileSync(RUTA_ENTRADAS_SITIO, "utf8"));
    const archivado = esquemaTorneo.parse(JSON.parse(readFileSync(`public/torneos/${TORNEO_ORIGEN_SITIO}/torneo.json`, "utf8")));
    expect(e.participantes.map((p: { id: string }) => p.id)).toEqual(archivado.participantes.map(p => p.id));
    expect(e.participantes.every((p: { precio: { estimadoDe: string | null } }) => p.precio.estimadoDe === null)).toBe(true);
    expect(e.participantes).toHaveLength(T.participantes.max);
  });
  it("estimarTorneo, tras la extracción, reproduce la estimación archivada del 24 oct", () => {
    const archivada = JSON.parse(readFileSync(`docs/evidencia/torneo-059/${TORNEO_ORIGEN_SITIO}/estimacion.json`, "utf8"));
    const { orden: _o, commit: _c, ...esperada } = archivada;
    const t = esquemaTorneo.parse(JSON.parse(readFileSync(`public/torneos/${TORNEO_ORIGEN_SITIO}/torneo.json`, "utf8")));
    // La estimación archivada es anterior al brief 063: se reproduce con factor 1 (y declara el medido y ese factor).
    const e = estimarTorneo({ participantes: t.participantes, evidencias: leerEvidencias(process.cwd()), duracionS: t.duracionS, intervaloS: t.intervaloS, semilla: t.semilla,
      topeMicroUsd: archivada.topeMicroUsd, topeUsd: archivada.topeMicroUsd / 1_000_000, factorObservacion: 1 });
    expect(JSON.parse(JSON.stringify(e))).toEqual({ ...esperada, promptMax: { ...esperada.promptMax, medido: esperada.promptMax.tokens, factorObservacion063: 1 } });
  });
  it("063 · revisión de Codex de la publicación 2 (P2): el CLI y el sitio reservan con el mismo prompt máximo y la misma reserva por partido (mutación: aplicar factorObservacion063 solo en el sitio)", () => {
    const entradas = JSON.parse(readFileSync(RUTA_ENTRADAS_SITIO, "utf8")) as EntradasSitio;
    expect(entradas.promptMax.factorObservacion063).toBe(TORNEO_SITIO.factorObservacion063);
    const participantes = entradas.participantes.slice(0, T.participantes.min);
    const e = estimarTorneo({ participantes, evidencias: leerEvidencias(process.cwd()), duracionS: T.duracionS, intervaloS: TORNEO_SITIO.intervaloS, semilla: T.semillaDefecto,
      topeMicroUsd: T.topeMaxUsd * 1_000_000, topeUsd: T.topeMaxUsd });
    expect(e.promptMax).toEqual(entradas.promptMax);
    const precio = (id: string) => participantes.find(p => p.id === id)!.precio, rondas = rondasPartido(T.duracionS, TORNEO_SITIO.intervaloS);
    // La reserva del sitio (`torneo-sitio.ts`: `reservaPartido` con `entradas.promptMax.tokens`) por cada cruce del CLI.
    for (const p of e.partidos) expect({ n: p.n, reserva: p.reservaMicroUsd }).toEqual({ n: p.n, reserva: reservaPartido({ local: precio(p.local), visita: precio(p.visita) }, entradas.promptMax.tokens, rondas) });
    expect(e.reservaMaxPartidoMicroUsd).toBe(estimarFormato("liga", { ...entradas, participantes }).reservaMaxPartidoMicroUsd);
    console.log("[063 P2 reservas CLI = sitio]", JSON.stringify({ promptMax: e.promptMax, reservaMaxPartidoMicroUsd: e.reservaMaxPartidoMicroUsd }));
  });
});
