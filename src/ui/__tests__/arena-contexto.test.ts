// Brief 044: el panel del entrenador muestra TODOS los pares de una sustitución pendiente
// (forma objeto o arreglo) y los topes de cambios/ventanas salen de TECNICA_ARENA.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { crearConfigArena, MotorArena } from "../../arena/motor";
import type { ParSustitucion, RegistroArena } from "../../arena/tipos";
import { TECNICA_ARENA as T } from "../../sim/limites";
import { ArenaContexto } from "../ArenaContexto";

function panel(pendiente: ParSustitucion | ParSustitucion[]) {
  const motor = new MotorArena(crearConfigArena({ seed: 9, duracionS: 30 }));
  const registro = { version: motor.config.version, config: motor.config, inicial: motor.fotogramas[0], eventos: motor.eventos, fotogramas: motor.fotogramas, final: motor.estado, rondas: [] } as unknown as RegistroArena;
  const estado = structuredClone(motor.estado);
  estado.entrenadores!.local.pendiente = pendiente;
  const html = renderToStaticMarkup(createElement(ArenaContexto, { registro, estado, idioma: "es", seleccionar: () => {}, saltar: () => {} }));
  const aviso = /data-testid="arena-sub-pending"[^>]*>(.*?)<\/p>/.exec(html)?.[1] ?? "";
  return { html, aviso, estado };
}

describe("044 · ArenaContexto con sustituciones pendientes", () => {
  it("lista cada par de un arreglo pendiente", () => {
    const motor = new MotorArena(crearConfigArena({ seed: 9, duracionS: 30 }));
    const titulares = motor.estado.jugadores.filter(j => j.lado === "local" && j.puesto !== "POR");
    const banco = motor.estado.banco!.filter(j => j.lado === "local" && j.posicionNatural !== "POR");
    const pares = banco.slice(0, T.cambiosPorVentana).map((s, i) => ({ sale: titulares[i]!.id, entra: s.id }));
    expect(pares.length).toBeGreaterThan(1);
    const { aviso, estado } = panel(pares);
    const nombre = (id: string) => [...estado.jugadores, ...estado.banco!].find(j => j.id === id)!.nombre;
    for (const p of pares) { expect(aviso).toContain(`${nombre(p.entra)} ↑`); expect(aviso).toContain(`${nombre(p.sale)} ↓`); }
    const { aviso: unico } = panel(pares[0]!);
    expect(unico).toContain(`${nombre(pares[0]!.entra)} ↑ · ${nombre(pares[0]!.sale)} ↓`);
    expect(unico).not.toContain(nombre(pares[1]!.entra));
  });
  it("los topes de cambios y ventanas salen de TECNICA_ARENA", () => {
    const motor = new MotorArena(crearConfigArena({ seed: 9, duracionS: 30 }));
    const { html } = panel({ sale: motor.estado.jugadores[1]!.id, entra: motor.estado.banco![0]!.id });
    expect(html).toContain(`0/${T.maxCambios} · 0/${T.maxVentanas}`);
  });
});
