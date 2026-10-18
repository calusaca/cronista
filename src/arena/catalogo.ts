// Primeros tres perfiles del brief 033. Puestos estables; las fases reasignan
// responsabilidades, nunca identidades. Anclas sintéticas de juego abierto.
import { ARENA } from "../sim/limites";
import type { Lado } from "../sim/tipos";
import type { FormacionArena, Punto } from "./tipos";

const perfiles: Record<FormacionArena, { base: string[][]; ataque: string[][]; defensa: string[][] }> = {
  "4-3-3": {
    base: [["LI", "DFC_I", "DFC_D", "LD"], ["INT_I", "PIV", "INT_D"], ["EI", "DC", "ED"]],
    ataque: [["DFC_I", "DFC_D", "LD"], ["LI", "PIV"], ["EI", "INT_I", "DC", "INT_D", "ED"]],
    defensa: [["LI", "DFC_I", "DFC_D", "LD"], ["PIV"], ["EI", "INT_I", "INT_D", "ED"], ["DC"]],
  },
  "4-2-3-1": {
    base: [["LI", "DFC_I", "DFC_D", "LD"], ["PIV_I", "PIV_D"], ["EI", "MP", "ED"], ["DC"]],
    ataque: [["DFC_I", "DFC_D", "LD"], ["PIV_I", "PIV_D"], ["LI", "EI", "MP", "ED"], ["DC"]],
    defensa: [["LI", "DFC_I", "DFC_D", "LD"], ["EI", "PIV_I", "PIV_D", "ED"], ["MP", "DC"]],
  },
  "4-4-2": {
    base: [["LI", "DFC_I", "DFC_D", "LD"], ["VOL_I", "MC_I", "MC_D", "VOL_D"], ["DC_I", "DC_D"]],
    ataque: [["DFC_I", "DFC_D"], ["LI", "MC_I", "MC_D", "LD"], ["VOL_I", "DC_I", "DC_D", "VOL_D"]],
    defensa: [["LI", "DFC_I", "DFC_D", "LD"], ["VOL_I", "MC_I", "MC_D", "VOL_D"], ["DC_I", "DC_D"]],
  },
};
export function puestos(formacion: FormacionArena): string[] { return ["POR", ...perfiles[formacion].base.flat()]; }
export function estructura(formacion: FormacionArena, conBalon: boolean): string {
  return (conBalon ? perfiles[formacion].ataque : perfiles[formacion].defensa).map(l => l.length).join("-");
}
export function transformar(p: Punto, lado: Lado): Punto {
  return lado === "local" ? { ...p } : { x: ARENA.largoM - p.x, y: ARENA.anchoM - p.y };
}
export function anclas(formacion: FormacionArena, lado: Lado, fase: "base" | "ataque" | "defensa"): Record<string, Punto> {
  const lineas = perfiles[formacion][fase];
  const resultado: Record<string, Punto> = { POR: transformar({ x: 6, y: ARENA.anchoM / 2 }, lado) };
  const alturas = fase === "ataque" ? [0.33, 0.5, 0.73, 0.83] : fase === "defensa" ? [0.25, 0.4, 0.52, 0.65] : [0.25, 0.47, 0.69, 0.8];
  lineas.forEach((linea, n) => linea.forEach((slot, i) => {
    const v = linea.length === 1 ? 0.5 : 0.1 + 0.8 * i / (linea.length - 1);
    resultado[slot] = transformar({ x: ARENA.largoM * alturas[n]!, y: ARENA.anchoM * v }, lado);
  }));
  return resultado;
}
