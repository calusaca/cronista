// Brief 062 § 6.2 · R2: `torneo-sitio-entradas.json` se regenera igual byte a byte, y la extracción de
// `entradasEstimacion` no cambia la salida de `estimarTorneo` (el ensayo en seco del 24 oct reproduce
// `docs/evidencia/torneo-059/2026-10-24/estimacion.json`, sin los campos que añade el CLI).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TORNEO_ARENA as T } from "../../sim/limites";
import { esquemaTorneo } from "../torneo";
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
    const e = estimarTorneo({ participantes: t.participantes, evidencias: leerEvidencias(process.cwd()), duracionS: t.duracionS, intervaloS: t.intervaloS, semilla: t.semilla,
      topeMicroUsd: archivada.topeMicroUsd, topeUsd: archivada.topeMicroUsd / 1_000_000 });
    expect(JSON.parse(JSON.stringify(e))).toEqual(esperada);
  });
});
