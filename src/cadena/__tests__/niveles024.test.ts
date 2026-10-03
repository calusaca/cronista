// Brief 024 — el nivel es atributo, no suceso: no hay hecho que lo respalde y la crónica NO lo
// menciona. Si un escritor dijera «Level 82» (o «nivel 82»), el Verificador lo rechaza (V3: la
// cifra no está en el hecho; y «Level» no es un nombre del hecho ni una palabra permitida: V4).
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import { TEMPORADA_ACTUAL } from "../../analista/umbrales";
import { mundo } from "../../mundo/mundo";
import { configDePartidoLiga } from "../../mundo/temporada";
import { simular } from "../../sim/motor";
import { verificarOraciones } from "../verificador";

describe("024 · la crónica no menciona niveles", () => {
  const p = simular(configDePartidoLiga(mundo().ligas[2]!, TEMPORADA_ACTUAL, 5, 2));
  const hs = analizar(p);
  const gol = hs.find((h) => h.tipo === "gol_anotado") ?? hs.find((h) => h.tipo === "resultado_final")!;
  const j = String(gol.datos.jugador ?? p.config.local.jugadores[9]!.nombre);
  const nivel = [...p.config.local.jugadores, ...p.config.visita.jugadores].find((x) => x.nombre === j)?.nivel ?? 82;
  const sin = (t: string) => t.replace(/\.$/, "");

  it("ningún hecho lleva el nivel en sus datos ni en sus textos", () => {
    for (const h of hs) expect(Object.keys(h.datos).some((k) => k.includes("nivel"))).toBe(false);
  });
  it("«Level N» / «nivel N» en una oración ⇒ rechazada (V3, y V4 por «Level»)", () => {
    const ms = verificarOraciones([{ texto_es: `${sin(gol.texto_es)}; tiene nivel ${nivel}.`, texto_en: `${sin(gol.texto_en)}; Level ${nivel} player.`, hecho: gol.id }], hs, p);
    const reglas = new Set(ms.map((m) => m.regla));
    expect(reglas.has("V3") || reglas.has("V4")).toBe(true);
    expect(ms.some((m) => m.regla === "V4" && m.detalle.includes("Level"))).toBe(true);
  });
});
