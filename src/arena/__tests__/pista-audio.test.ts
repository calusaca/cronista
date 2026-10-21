// Brief 045 v3.1 · Repetición guardada: una intervención es un tramo de ancho cero en ticks;
// mientras habla el invitado, el cursor se detiene en su instante.
import { describe, expect, it } from "vitest";
import { instanteNarrado, type TramoTemporal } from "../pista-audio";

describe("045 v3.1 · instanteNarrado con tramos de ancho cero", () => {
  it("un tramo { desdeTick: t, hastaTick: t } devuelve tick = t en todo su intervalo", () => {
    const t = 150;
    const tramos: TramoTemporal[] = [
      { inicioS: 0, finS: 1, desdeTick: 100, hastaTick: 200 },
      { inicioS: 1, finS: 1.5, desdeTick: t, hastaTick: t },
      { inicioS: 1.5, finS: 2.5, desdeTick: 200, hastaTick: 300 },
    ];
    for (let s = 1; s < 1.5; s += 0.05) expect(instanteNarrado(tramos, s)).toEqual({ indice: 1, tick: t });
    // Antes y después, los tramos del narrador siguen avanzando con el audio.
    expect(instanteNarrado(tramos, 0.5)).toEqual({ indice: 0, tick: 150 });
    expect(instanteNarrado(tramos, 1.5)).toEqual({ indice: 2, tick: 200 });
    // Un invitado al final de la pista mantiene su instante también al terminar el audio.
    const final: TramoTemporal[] = [{ inicioS: 0, finS: 1, desdeTick: 0, hastaTick: 100 }, { inicioS: 1, finS: 1.4, desdeTick: 100, hastaTick: 100 }];
    for (const s of [1, 1.2, 1.4, 3]) expect(instanteNarrado(final, s)).toEqual({ indice: 1, tick: 100 });
  });
});
