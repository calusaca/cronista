// Brief 028 · propiedad 3 (completa) — regenerar la corrida de referencia (`npm run dataset`, con los
// experimentos al tamaño de la suite) da BYTE A BYTE lo commiteado en docs/dataset/: DATASHEET.md,
// ficha.json, partidos.jsonl y resumen.csv. Una cifra editada a mano en el DATASHEET (o un archivo
// de datos desactualizado) pone esto en rojo. `npm run test:stats`.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, describe, expect, it } from "vitest";
import { LIGA_DESTACADA, TEMPORADA_ACTUAL } from "../../analista/umbrales";
import { renderDatasheet } from "../datasheet";
import { erroresLinea } from "../esquema";
import { MARCA } from "../texto";
import { generarDataset, OPCIONES_POR_DEFECTO } from "../generar";
import { ARCHIVOS, N_PRUEBA_RAPIDA, SALIDA_POR_DEFECTO } from "../umbrales-dataset";

const tmp = mkdtempSync(join(tmpdir(), "cronista-dataset-ref-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const commiteado = (f: string) => readFileSync(join(process.cwd(), SALIDA_POR_DEFECTO, f));
const ejecutar = promisify(execFile);

describe("028 · la corrida de referencia, regenerada", async () => {
  const r = await generarDataset(OPCIONES_POR_DEFECTO, tmp);

  it.each([ARCHIVOS.datasheet, ARCHIVOS.ficha, ARCHIVOS.partidos, ARCHIVOS.resumen])("%s regenerado ⇒ idéntico al commiteado", (f) => {
    const nuevo = readFileSync(join(tmp, f));
    if (!nuevo.equals(commiteado(f))) {
      // el primer renglón distinto, para que el rojo diga dónde está la cifra a mano
      const a = nuevo.toString("utf8").split("\n");
      const b = commiteado(f).toString("utf8").split("\n");
      const i = a.findIndex((l, k) => l !== b[k]);
      expect(b[i], `${f}, renglón ${i + 1}`).toBe(a[i]);
    }
    expect(nuevo.equals(commiteado(f))).toBe(true);
  });

  it("cada línea commiteada es válida; ninguna banda de la corrida FUERA; todos los experimentos en banda; 0 violaciones", () => {
    const ls = commiteado(ARCHIVOS.partidos).toString("utf8").split("\n").filter(Boolean);
    expect(ls.flatMap((l) => erroresLinea(JSON.parse(l)))).toEqual([]);
    for (const m of r.modelo.mediciones) console.log(`[dataset 028] ${m.clave}: ${m.medido.toFixed(4)} ${m.veredicto}`);
    expect(r.modelo.mediciones.filter((m) => m.veredicto === "fuera").map((m) => m.clave)).toEqual([]);
    expect(r.modelo.experimentos.filter((m) => m.veredicto !== "en_banda").map((m) => m.clave)).toEqual([]);
    expect(r.modelo.estructura.violaciones).toBe(0);
    expect(r.modelo.estructura.lineasInvalidas).toBe(0);
  });
});

describe("028 · memoria de la regeneración completa", () => {
  it("el CLI con 512 MiB de heap regenera los cuatro archivos sin cambiar un byte", async () => {
    const dir = join(tmp, "heap-512");
    // Un proceso aparte fija el presupuesto incluso si el worker de Vitest tiene más memoria.
    // El código previo retenía los nueve brazos A/B y abortaba incluso con 2048 MiB.
    await ejecutar(process.execPath, [
      "--max-old-space-size=512", "--import", "tsx", "src/dataset/cli.ts", "--out", dir,
    ], { cwd: process.cwd(), timeout: 300_000 });
    for (const f of [ARCHIVOS.datasheet, ARCHIVOS.ficha, ARCHIVOS.partidos, ARCHIVOS.resumen]) {
      expect(readFileSync(join(dir, f)).equals(commiteado(f)), f).toBe(true);
    }
  });
});

// Una temporada completa de liga (90 partidos): fuera de la suite rápida por costo.
describe("028 · modo liga: DATASHEET sin cifras huérfanas, líneas válidas", () => {
  const TAM = { estilos: N_PRUEBA_RAPIDA.experimentos, ab: N_PRUEBA_RAPIDA.experimentos };
  const lineas = (texto: string): unknown[] => texto.split("\n").filter((l) => l.length > 0).map((l) => JSON.parse(l) as unknown);
  const huerfanas = (md: string) =>
    md
      .split("\n")
      .map((l) => l.replace(new RegExp(`${MARCA.abre}[^${MARCA.cierra}]*${MARCA.cierra}`, "g"), ""))
      .filter((l) => /\d/.test(l));
  const sinMarcas = (md: string) => md.replace(new RegExp(`[${MARCA.abre}${MARCA.cierra}]`, "g"), "");
  it("DATASHEET (liga): lo mismo, con condiciones, bajas y sanciones en la corrida", async () => {
    const r = await generarDataset({ modo: { tipo: "liga", liga: LIGA_DESTACADA, temporada: TEMPORADA_ACTUAL }, micro: false }, join(tmp, "liga"), TAM);
    const inst = renderDatasheet(r.modelo, true);
    expect(huerfanas(inst)).toEqual([]);
    expect(sinMarcas(inst)).toBe(r.datasheet);
    expect(r.modelo.composicion.conCondiciones).toBe(r.modelo.composicion.partidos);
    const ls = lineas(readFileSync(join(tmp, "liga", ARCHIVOS.partidos), "utf8"));
    expect(ls.flatMap((l) => erroresLinea(l))).toEqual([]);
  });

});
