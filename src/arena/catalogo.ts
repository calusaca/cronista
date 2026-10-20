// Doce estructuras; los siete perfiles originales conservan su geometría.
// Puestos estables; las fases reasignan
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
  "4-1-4-1": {
    base: [["LI", "DFC_I", "DFC_D", "LD"], ["PIV"], ["VOL_I", "INT_I", "INT_D", "VOL_D"], ["DC"]],
    ataque: [["DFC_I", "DFC_D"], ["LI", "PIV", "LD"], ["VOL_I", "INT_I", "DC", "INT_D", "VOL_D"]],
    defensa: [["LI", "DFC_I", "DFC_D", "LD"], ["PIV"], ["VOL_I", "INT_I", "INT_D", "VOL_D"], ["DC"]],
  },
  "4-1-2-1-2": {
    base: [["LI", "DFC_I", "DFC_D", "LD"], ["PIV"], ["INT_I", "INT_D"], ["MP"], ["DC_I", "DC_D"]],
    ataque: [["DFC_I", "DFC_D"], ["PIV", "INT_I", "INT_D"], ["LI", "MP", "DC_I", "DC_D", "LD"]],
    defensa: [["LI", "DFC_I", "DFC_D", "LD"], ["PIV", "INT_I", "INT_D"], ["MP"], ["DC_I", "DC_D"]],
  },
  "3-5-2": {
    base: [["DFC_I", "DFC_C", "DFC_D"], ["CAR_I", "INT_I", "PIV", "INT_D", "CAR_D"], ["DC_I", "DC_D"]],
    ataque: [["DFC_I", "DFC_C", "DFC_D"], ["PIV", "INT_I"], ["CAR_I", "INT_D", "CAR_D"], ["DC_I", "DC_D"]],
    defensa: [["CAR_I", "DFC_I", "DFC_C", "DFC_D", "CAR_D"], ["INT_I", "PIV", "INT_D"], ["DC_I", "DC_D"]],
  },
  "3-4-3": {
    base: [["DFC_I", "DFC_C", "DFC_D"], ["CAR_I", "MC_I", "MC_D", "CAR_D"], ["EI", "DC", "ED"]],
    ataque: [["DFC_I", "DFC_C", "DFC_D"], ["MC_I", "MC_D"], ["CAR_I", "EI", "DC", "ED", "CAR_D"]],
    defensa: [["CAR_I", "DFC_I", "DFC_C", "DFC_D", "CAR_D"], ["EI", "MC_I", "MC_D", "ED"], ["DC"]],
  },
  "4-3-1-2": {
    base: [["LI", "DFC_I", "DFC_D", "LD"], ["INT_I", "PIV", "INT_D"], ["MP"], ["DC_I", "DC_D"]],
    ataque: [["DFC_I", "DFC_D"], ["LI", "PIV", "LD"], ["INT_I", "MP", "INT_D"], ["DC_I", "DC_D"]],
    defensa: [["LI", "DFC_I", "DFC_D", "LD"], ["INT_I", "PIV", "INT_D"], ["MP"], ["DC_I", "DC_D"]],
  },
  "4-2-2-2": {
    base: [["LI", "DFC_I", "DFC_D", "LD"], ["PIV_I", "PIV_D"], ["MP_I", "MP_D"], ["DC_I", "DC_D"]],
    ataque: [["DFC_I", "DFC_D"], ["PIV_I", "PIV_D"], ["LI", "MP_I", "MP_D", "LD"], ["DC_I", "DC_D"]],
    defensa: [["LI", "DFC_I", "DFC_D", "LD"], ["MP_I", "PIV_I", "PIV_D", "MP_D"], ["DC_I", "DC_D"]],
  },
  "3-4-2-1": {
    base: [["DFC_I", "DFC_C", "DFC_D"], ["CAR_I", "MC_I", "MC_D", "CAR_D"], ["MP_I", "MP_D"], ["DC"]],
    ataque: [["DFC_I", "DFC_C", "DFC_D"], ["MC_I", "MC_D"], ["CAR_I", "MP_I", "MP_D", "CAR_D"], ["DC"]],
    defensa: [["CAR_I", "DFC_I", "DFC_C", "DFC_D", "CAR_D"], ["MC_I", "MC_D"], ["MP_I", "MP_D"], ["DC"]],
  },
  "5-3-2": {
    base: [["LI", "DFC_I", "DFC_C", "DFC_D", "LD"], ["INT_I", "PIV", "INT_D"], ["DC_I", "DC_D"]],
    ataque: [["DFC_I", "DFC_C", "DFC_D"], ["INT_I", "PIV", "INT_D"], ["LI", "DC_I", "DC_D", "LD"]],
    defensa: [["LI", "DFC_I", "DFC_C", "DFC_D", "LD"], ["INT_I", "PIV", "INT_D"], ["DC_I", "DC_D"]],
  },
  "5-4-1": {
    base: [["LI", "DFC_I", "DFC_C", "DFC_D", "LD"], ["VOL_I", "MC_I", "MC_D", "VOL_D"], ["DC"]],
    ataque: [["DFC_I", "DFC_C", "DFC_D"], ["MC_I", "MC_D"], ["LI", "VOL_I", "VOL_D", "LD"], ["DC"]],
    defensa: [["LI", "DFC_I", "DFC_C", "DFC_D", "LD"], ["VOL_I", "MC_I", "MC_D", "VOL_D"], ["DC"]],
  },
};
export function puestos(formacion: FormacionArena): string[] { return ["POR", ...perfiles[formacion].base.flat()]; }
export function estructuraBase(formacion: FormacionArena): string { return perfiles[formacion].base.map(l => l.length).join("-"); }
export function estructura(formacion: FormacionArena, conBalon: boolean, activos?: readonly string[]): string {
  return (conBalon ? perfiles[formacion].ataque : perfiles[formacion].defensa).map(l => activos ? l.filter(p => activos.includes(p)).length : l.length).filter(n => n > 0).join("-");
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
    const altura = lineas.length > alturas.length ? 0.25 + 0.6 * n / (lineas.length - 1) : alturas[n]!;
    resultado[slot] = transformar({ x: ARENA.largoM * altura, y: ARENA.anchoM * v }, lado);
  }));
  return resultado;
}
