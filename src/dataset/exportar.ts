// Brief 028 §1 — de un partido simulado a sus tres formas exportables: la línea de partidos.jsonl,
// la línea de micro.jsonl.gz y la fila de resumen.csv. Todo es función pura de la Entrada: el
// orden de las claves es el del código, así que dos corridas dan los mismos bytes.

import { analizar } from "../analista/analista";
import { rachasOle } from "../analista/grada";
import type { Hecho } from "../analista/tipos";
import { micro, type MicroPartido } from "../sim/micro";
import { simular } from "../sim/motor";
import { resumir, type Resumen } from "../sim/resumen";
import type { Lado, Partido } from "../sim/tipos";
import type { Entrada } from "./fuente";
import { CSV_DECIMALES_XG, ESQUEMA } from "./umbrales-dataset";

export interface Procesado {
  entrada: Entrada;
  partido: Partido;
  micro: MicroPartido;
  hechos: Hecho[];
  resumen: Resumen;
}

export function procesar(entrada: Entrada): Procesado {
  const partido = simular(entrada.config);
  const m = micro(partido);
  return { entrada, partido, micro: m, hechos: analizar(partido), resumen: resumir(partido) };
}

/** La línea de partidos.jsonl (objeto; `JSON.stringify` la serializa). */
export function lineaPartido(x: Procesado) {
  const citados = new Set(x.hechos.flatMap((h) => h.eventos));
  return {
    esquema: ESQUEMA,
    id: x.entrada.id,
    fuente: x.entrada.fuente,
    config: x.partido.config,
    eventos: x.partido.eventos,
    hechos: x.hechos,
    microCitados: x.micro.eventos.filter((m) => citados.has(m.id)),
    capaMicro: { eventos: x.micro.eventos.length, posesiones: x.micro.posesiones.length },
  };
}

export function lineaMicro(x: Procesado) {
  return { esquema: ESQUEMA, id: x.entrada.id, eventos: x.micro.eventos, posesiones: x.micro.posesiones };
}

/** La racha más larga de pases COMPLETADOS seguidos de un equipo dentro de una misma posesión. */
export function rachaMaxima(m: MicroPartido, lado: Lado): number {
  let max = 0;
  let actual = 0;
  let previo: MicroPartido["eventos"][number] | undefined;
  for (const x of m.eventos) {
    if (x.tipo !== "pase") continue;
    if (x.equipo === lado && x.completado === true) {
      actual = previo && previo.equipo === lado && previo.completado === true && previo.posesion === x.posesion ? actual + 1 : 1;
      max = Math.max(max, actual);
    } else actual = 0;
    previo = x;
  }
  return max;
}

/** Columnas de resumen.csv, en orden. */
export const COLUMNAS_CSV = [
  "id",
  "semilla",
  "local",
  "visita",
  "goles_local",
  "goles_visita",
  "xg_local",
  "xg_visita",
  "tiros_local",
  "tiros_visita",
  "amarillas_local",
  "amarillas_visita",
  "rojas_local",
  "rojas_visita",
  "clima",
  "temperatura_c",
  "superficie",
  "cesped",
  "presion_local",
  "presion_visita",
  "racha_pases_max_local",
  "racha_pases_max_visita",
  "oles",
  "olimpicos",
  "al_palo",
  "doble_palo",
  "subidas_portero",
  "interrupciones",
  "autogoles",
  "lesiones",
  "micro_eventos",
  "hechos",
] as const;
export type ColumnaCsv = (typeof COLUMNAS_CSV)[number];

export function filaCsv(x: Procesado): Record<ColumnaCsv, string | number> {
  const { partido: p, resumen: r, micro: m } = x;
  const c = p.config.condiciones;
  const cuenta = (f: (e: Partido["eventos"][number]) => boolean) => p.eventos.filter(f).length;
  return {
    id: x.entrada.id,
    semilla: p.config.seed,
    local: p.config.local.nombre,
    visita: p.config.visita.nombre,
    goles_local: r.local.goles,
    goles_visita: r.visita.goles,
    xg_local: r.local.xg.toFixed(CSV_DECIMALES_XG),
    xg_visita: r.visita.xg.toFixed(CSV_DECIMALES_XG),
    tiros_local: r.local.tiros,
    tiros_visita: r.visita.tiros,
    amarillas_local: r.local.amarillas,
    amarillas_visita: r.visita.amarillas,
    rojas_local: r.local.rojas,
    rojas_visita: r.visita.rojas,
    clima: c?.clima ?? "",
    temperatura_c: c?.temperaturaC ?? "",
    superficie: c?.superficie ?? "",
    cesped: c?.cesped ?? "",
    presion_local: c?.presion.local ?? "",
    presion_visita: c?.presion.visita ?? "",
    racha_pases_max_local: rachaMaxima(m, "local"),
    racha_pases_max_visita: rachaMaxima(m, "visita"),
    oles: rachasOle(p, m).length,
    olimpicos: cuenta((e) => e.tipo === "gol" && e.definicion === "olimpico"),
    al_palo: cuenta((e) => e.alPalo !== undefined),
    doble_palo: cuenta((e) => e.alPalo === 2),
    subidas_portero: cuenta((e) => e.tipo === "subida_portero"),
    interrupciones: cuenta((e) => e.tipo === "interrupcion"),
    autogoles: cuenta((e) => e.tipo === "gol" && e.autogol === true),
    lesiones: cuenta((e) => e.tipo === "lesion"),
    micro_eventos: m.eventos.length,
    hechos: x.hechos.length,
  };
}

/** Celda CSV (RFC 4180): entre comillas solo si lleva coma, comillas o salto de línea. */
export function celda(v: string | number): string {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** BOM de UTF-8 al principio del CSV: Excel lo abre con los acentos bien (pandas lo ignora). */
export const BOM = "﻿";

export function csv(filas: readonly Record<ColumnaCsv, string | number>[]): string {
  const lineas = [COLUMNAS_CSV.join(","), ...filas.map((f) => COLUMNAS_CSV.map((k) => celda(f[k])).join(","))];
  return `${BOM}${lineas.join("\n")}\n`;
}

/** Parser mínimo del CSV que escribimos (para las pruebas: comillas RFC 4180, sin saltos dentro de celdas). */
export function leerCsv(texto: string): Record<string, string>[] {
  const lineas = texto.replace(/^﻿/, "").split("\n").filter((l) => l.length > 0);
  const partir = (l: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i] as string;
      if (q) {
        if (ch === '"' && l[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const cab = partir(lineas[0] ?? "");
  return lineas.slice(1).map((l) => {
    const v = partir(l);
    return Object.fromEntries(cab.map((k, i) => [k, v[i] ?? ""]));
  });
}
