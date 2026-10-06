// Brief 028 — la corrida completa: entradas → partidos procesados → archivos (JSONL, CSV, gz) →
// mediciones → DATASHEET.md y ficha.json. Pura salvo la escritura en `dir`: dos corridas con las
// mismas opciones dan los mismos bytes (sin fechas, sin rutas absolutas, sin azar sin semilla).

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TEMPORADA_ACTUAL } from "../analista/umbrales";
import { renderDatasheet, type Modelo } from "./datasheet";
import { experimentos, TAMANO_SUITE, type TamanoExperimentos } from "./experimentos";
import { entradasDeLiga, entradasPorSemilla, type Entrada } from "./fuente";
import { escribirGzip } from "./gzip";
import { csv, filaCsv, lineaMicro, lineaPartido, procesar } from "./exportar";
import { componer, controlar, medirCorrida } from "./medir";
import { ARCHIVOS, MUESTRA_ARCHIVO, MUESTRA_SEMILLAS, N_POR_DEFECTO } from "./umbrales-dataset";

export type Modo = { tipo: "semillas"; n: number } | { tipo: "liga"; liga: string; temporada: number };

export interface OpcionesDataset {
  modo: Modo;
  micro: boolean;
}

export const OPCIONES_POR_DEFECTO: OpcionesDataset = { modo: { tipo: "semillas", n: N_POR_DEFECTO }, micro: false };

export function entradasDe(modo: Modo): Entrada[] {
  return modo.tipo === "semillas" ? entradasPorSemilla(Array.from({ length: modo.n }, (_, i) => i + 1)) : entradasDeLiga(modo.liga, modo.temporada);
}

/** El comando que reproduce la corrida (sin --out: la ruta no cambia el contenido). */
export function comandoDe(op: OpcionesDataset): string {
  const base = "npm run dataset";
  const args: string[] = [];
  if (op.modo.tipo === "semillas" && op.modo.n !== N_POR_DEFECTO) args.push(`--n ${op.modo.n}`);
  if (op.modo.tipo === "liga") args.push(`--liga ${op.modo.liga}`, ...(op.modo.temporada !== TEMPORADA_ACTUAL ? [`--temporada ${op.modo.temporada}`] : []));
  if (op.micro) args.push("--micro");
  return args.length > 0 ? `${base} -- ${args.join(" ")}` : base;
}

export const jsonl = (lineas: readonly unknown[]): string => lineas.map((l) => JSON.stringify(l)).join("\n") + (lineas.length > 0 ? "\n" : "");

export const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

export interface ArchivoGenerado {
  nombre: string;
  bytes: number;
  lineas: number;
  sha256: string;
}

export interface Resultado {
  modelo: Modelo;
  datasheet: string;
  ficha: string;
  archivos: ArchivoGenerado[];
}

function describir(nombre: string, b: Buffer, lineas: number): ArchivoGenerado {
  return { nombre, bytes: b.length, lineas, sha256: sha256(b) };
}

export async function generarDataset(op: OpcionesDataset, dir: string, tam: TamanoExperimentos = TAMANO_SUITE): Promise<Resultado> {
  mkdirSync(dir, { recursive: true });
  const xs = entradasDe(op.modo).map(procesar);
  const archivos: ArchivoGenerado[] = [];

  const partidos = Buffer.from(jsonl(xs.map(lineaPartido)), "utf8");
  writeFileSync(join(dir, ARCHIVOS.partidos), partidos);
  archivos.push(describir(ARCHIVOS.partidos, partidos, xs.length));

  const resumen = Buffer.from(csv(xs.map(filaCsv)), "utf8");
  writeFileSync(join(dir, ARCHIVOS.resumen), resumen);
  archivos.push(describir(ARCHIVOS.resumen, resumen, xs.length + 1));

  if (op.micro) {
    const ruta = join(dir, ARCHIVOS.micro);
    await escribirGzip(
      ruta,
      xs.map((x) => `${JSON.stringify(lineaMicro(x))}\n`),
    );
    archivos.push(describir(ARCHIVOS.micro, readFileSync(ruta), xs.length));
  }

  const modelo: Modelo = {
    opciones: op,
    comando: comandoDe(op),
    archivos,
    composicion: componer(xs),
    estructura: controlar(xs),
    mediciones: medirCorrida(xs),
    experimentos: experimentos(tam),
    tamano: tam,
  };
  const datasheet = renderDatasheet(modelo);
  writeFileSync(join(dir, ARCHIVOS.datasheet), datasheet, "utf8");
  const ficha = `${JSON.stringify(fichaDe(modelo), null, 2)}\n`;
  writeFileSync(join(dir, ARCHIVOS.ficha), ficha, "utf8");
  return { modelo, datasheet, ficha, archivos };
}

/** Las cifras de cabecera que muestra /datos (la página no escribe ninguna a mano). */
export function fichaDe(m: Modelo) {
  const enBanda = m.mediciones.filter((x) => x.veredicto === "en_banda").length;
  const consistentes = m.mediciones.filter((x) => x.veredicto === "consistente").length;
  return {
    comando: m.comando,
    modo: m.opciones.modo,
    partidos: m.composicion.partidos,
    eventosPorPartido: Number((m.composicion.eventos / m.composicion.partidos).toFixed(1)),
    microPorPartido: Math.round(m.composicion.micro.media),
    hechosPorPartido: Number((m.composicion.hechos / m.composicion.partidos).toFixed(1)),
    golesPorPartido: Number((m.composicion.goles / m.composicion.partidos).toFixed(2)),
    bandasCorrida: { total: m.mediciones.length, enBanda, consistentes, fuera: m.mediciones.length - enBanda - consistentes },
    experimentos: { total: m.experimentos.length, enBanda: m.experimentos.filter((x) => x.veredicto === "en_banda").length },
    comprobaciones: { total: m.estructura.comprobaciones, violaciones: m.estructura.violaciones, lineasInvalidas: m.estructura.lineasInvalidas },
    muestra: { archivo: MUESTRA_ARCHIVO, semillas: [...MUESTRA_SEMILLAS] },
  };
}
export type Ficha = ReturnType<typeof fichaDe>;

/** La muestra de /datos: las semillas de MUESTRA_SEMILLAS, exactamente como las exporta el CLI. */
export function muestra(): string {
  return jsonl(entradasPorSemilla(MUESTRA_SEMILLAS).map((e) => lineaPartido(procesar(e))));
}
