// Brief 027 — la cara de las sanciones en la UI (funciones puras): la nota de la fila sancionada
// de la tabla y los chips de la cabecera, sobre los casos reales de la temporada (fiordos T1:
// deducción + puerta cerrada; cumbres T2: banco limitado). Los fija también para el smoke.
import { describe, expect, it } from "vitest";
import { mundo } from "../../mundo/mundo";
import { simularTemporada } from "../../mundo/temporada";
import type { Liga } from "../../mundo/tipos";
import { BANCO_LIMITADO } from "../../sim/limites";
import { configDeSemilla } from "../../sim/plantillas";
import { CAUSA_SANCION_EN, chipsSancion, notaDeduccion } from "../sanciones";

const liga = (id: string) => mundo().ligas.find((l) => l.id === id) as Liga;
const fiordos1 = simularTemporada(liga("liga-de-los-fiordos"), 1);
const cumbres2 = simularTemporada(liga("liga-de-las-cumbres"), 2);

describe("027 · la tabla muestra la deducción", () => {
  it("fiordos T1: Olímpico Dorosa −8 por alineación indebida, con su nota; las demás filas sin nota", () => {
    const f = fiordos1.tabla.find((x) => x.deduccion)!;
    expect([f.equipo, f.deduccion]).toEqual(["Olímpico Dorosa", { puntos: 8, causa: "alineacion_indebida" }]);
    expect(notaDeduccion(f)).toBe("−8 pts · fielding an ineligible player");
    for (const x of fiordos1.tabla.filter((y) => !y.deduccion)) expect(notaDeduccion(x)).toBeUndefined();
  });
});

describe("027 · los chips de la cabecera", () => {
  it("puerta cerrada (fiordos j8, Unión Orena de local): «Behind closed doors», partido 1 de 2, su causa", () => {
    const c = fiordos1.configs.find((x) => (x.sancionesClub ?? []).some((s) => s.tipo === "puerta_cerrada"))!;
    expect(chipsSancion(c)).toEqual([{ tipo: "puerta_cerrada", texto: `Behind closed doors · Unión Orena · match 1 of 2 · ${CAUSA_SANCION_EN.incidentes_de_publico}` }]);
    expect(c.local.nombre).toBe("Unión Orena");
  });

  it("banco limitado (cumbres T2) y deducción: sus chips; sin sanción (o sin la variante), ninguno", () => {
    const b = cumbres2.configs.find((x) => (x.sancionesClub ?? []).some((s) => s.tipo === "limite_banco"))!;
    expect(chipsSancion(b).some((x) => x.tipo === "limite_banco" && x.texto.includes(`bench limited to ${BANCO_LIMITADO} substitutes`))).toBe(true);
    const d = fiordos1.configs.find((x) => (x.sancionesClub ?? []).some((s) => s.tipo === "deduccion"))!;
    expect(chipsSancion(d).map((x) => x.texto)).toEqual(["Olímpico Dorosa: docked 8 points · fielding an ineligible player"]);
    expect(chipsSancion(configDeSemilla(4))).toEqual([]);
    expect(chipsSancion({ ...d, variantes: { ...d.variantes, sanciones: false } })).toEqual([]);
  });
});
