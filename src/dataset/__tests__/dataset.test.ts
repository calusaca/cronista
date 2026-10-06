// Brief 028 — el dataset (suite rápida). Propiedades del brief:
//   1 · determinismo (dos corridas ⇒ bytes idénticos, incl. el gz);
//   2 · validez (zod + citas que resuelven DENTRO de la línea), con casos negativos;
//   3 · el DATASHEET sin cifras huérfanas (toda cifra marcada como venida del código o de la corrida);
//   4 · la muestra de public/ es exactamente la salida del CLI para sus semillas.
// La regeneración completa del DATASHEET commiteado (corrida de referencia + experimentos con N de la
// suite) vive en dataset.stats.test.ts.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { afterAll, describe, expect, it } from "vitest";
import { LIGA_DESTACADA, TEMPORADA_ACTUAL } from "../../analista/umbrales";
import { SEED_MAX } from "../../sim/tipos";
import { parsearArgsDataset } from "../cli-args";
import { renderDatasheet } from "../datasheet";
import {
  CAMPOS_EVENTO,
  CAMPOS_HECHO,
  CAMPOS_LINEA,
  CAMPOS_MICRO,
  clavesDe,
  erroresLinea,
  esquemaEvento,
  esquemaHecho,
  esquemaLinea,
  esquemaLineaMicro,
  esquemaMicro,
} from "../esquema";
import { COLUMNAS_CSV, csv, filaCsv, leerCsv, lineaPartido, procesar } from "../exportar";
import { entradasPorSemilla } from "../fuente";
import { generarDataset, jsonl, muestra, type OpcionesDataset } from "../generar";
import { dentro, veredicto, wilson, type Medicion } from "../medir";
import { MARCA } from "../texto";
import { ARCHIVOS, CONFIANZA, CSV_DECIMALES_XG, GZIP, MUESTRA_ARCHIVO, MUESTRA_SEMILLAS, N_PRUEBA_RAPIDA, SALIDA_POR_DEFECTO } from "../umbrales-dataset";

const RAIZ = process.cwd();
const tmp = mkdtempSync(join(tmpdir(), "cronista-dataset-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const lineas = (texto: string): unknown[] => texto.split("\n").filter((l) => l.length > 0).map((l) => JSON.parse(l) as unknown);
const TAM = { estilos: N_PRUEBA_RAPIDA.experimentos, ab: N_PRUEBA_RAPIDA.experimentos };
const PEQUENA: OpcionesDataset = { modo: { tipo: "semillas", n: N_PRUEBA_RAPIDA.partidos }, micro: true };

describe("028 · CLI: argumentos", () => {
  it("defaults, liga sin id = la de /liga, y errores claros", () => {
    const d = parsearArgsDataset([]);
    expect(d.ok && d.tipo === "dataset" && d.out).toBe(SALIDA_POR_DEFECTO);
    const l = parsearArgsDataset(["--liga"]);
    expect(l.ok && l.tipo === "dataset" && l.opciones.modo).toEqual({ tipo: "liga", liga: LIGA_DESTACADA, temporada: TEMPORADA_ACTUAL });
    expect(parsearArgsDataset(["--muestra"])).toEqual({ ok: true, tipo: "muestra" });
    for (const malo of [["--n"], ["--n", "0"], ["--n", "1e3"], ["--n", "5", "--n", "6"], ["--liga", "--n", "5"], ["--temporada", "2"], ["--muestra", "--micro"], ["--x"], ["suelto"]])
      expect(parsearArgsDataset(malo).ok, malo.join(" ")).toBe(false);
  });
});

describe("028 · esquema: el diccionario documenta exactamente los campos del zod", () => {
  it.each([
    ["línea", esquemaLinea, CAMPOS_LINEA],
    ["evento", esquemaEvento, CAMPOS_EVENTO],
    ["hecho", esquemaHecho, CAMPOS_HECHO],
    ["micro", esquemaMicro, CAMPOS_MICRO],
  ] as const)("%s", (_, esquema, campos) => {
    expect(campos.map((c) => c.campo).sort()).toEqual(clavesDe(esquema).sort());
  });
});

describe("028 · propiedad 4 — la muestra de public/ ES la salida del CLI", () => {
  const publicada = readFileSync(join(RAIZ, "public", MUESTRA_ARCHIVO), "utf8");
  it("regenerada para sus semillas ⇒ byte a byte el archivo commiteado", () => {
    expect(muestra() === publicada).toBe(true);
  });
  it("y son las primeras líneas de la corrida de referencia (docs/dataset/partidos.jsonl)", () => {
    const ref = readFileSync(join(RAIZ, SALIDA_POR_DEFECTO, ARCHIVOS.partidos), "utf8").split("\n");
    expect(publicada.split("\n").filter(Boolean)).toEqual(ref.slice(0, MUESTRA_SEMILLAS.length));
  });
  it("cada línea anota su semilla (fuente) y es la de MUESTRA_SEMILLAS, en orden", () => {
    const xs = lineas(publicada).map((l) => esquemaLinea.parse(l));
    expect(xs.map((x) => (x.fuente.tipo === "semilla" ? x.fuente.semilla : -1))).toEqual([...MUESTRA_SEMILLAS]);
    expect(xs.every((x) => x.config.seed === (x.fuente as { semilla: number }).semilla)).toBe(true);
  });
});

describe("028 · propiedad 2 — validez de cada línea", () => {
  const xs = lineas(readFileSync(join(RAIZ, "public", MUESTRA_ARCHIVO), "utf8"));
  it("cada línea de la muestra parsea contra el zod y todas sus citas resuelven en la misma línea", () => {
    expect(xs.flatMap((x) => erroresLinea(x))).toEqual([]);
    // el corpus ejercita lo que valida: hay hechos que citan micro-eventos
    expect(xs.some((x) => (x as { microCitados: unknown[] }).microCitados.length > 0)).toBe(true);
  });

  it("lo que exporta el código AHORA (no solo lo commiteado): cada línea válida, citas resueltas", () => {
    const ls = entradasPorSemilla(MUESTRA_SEMILLAS).map((e) => JSON.parse(JSON.stringify(lineaPartido(procesar(e)))) as unknown);
    expect(ls.flatMap((x) => erroresLinea(x))).toEqual([]);
  });

  const base = () => JSON.parse(JSON.stringify(xs.find((x) => (x as { microCitados: unknown[] }).microCitados.length > 0))) as ReturnType<typeof esquemaLinea.parse>;
  it("negativo: un hecho que cita un evento ausente se denuncia", () => {
    const l = base();
    (l.hechos[0] as { eventos: string[] }).eventos.push("e999");
    expect(erroresLinea(l).some((e) => e.includes("e999"))).toBe(true);
  });
  it("negativo: un micro-evento citado que falta en microCitados se denuncia", () => {
    const l = base();
    l.microCitados.pop();
    expect(erroresLinea(l).some((e) => e.includes("ausente"))).toBe(true);
  });
  it("negativo: un micro-evento de más (sin hecho que lo cite) se denuncia", () => {
    const l = base();
    l.microCitados.push({ ...(l.microCitados[0] as (typeof l.microCitados)[number]), id: "m9999" });
    expect(erroresLinea(l).some((e) => e.includes("m9999"))).toBe(true);
  });
  it("negativo: un campo que el esquema no conoce, o un esquema de otra versión, no pasa", () => {
    expect(erroresLinea({ ...base(), extra: 1 }).length).toBeGreaterThan(0);
    expect(erroresLinea({ ...base(), esquema: "cronista/0" }).length).toBeGreaterThan(0);
    const l = base();
    (l.eventos[0] as Record<string, unknown>).inventado = true;
    expect(erroresLinea(l).length).toBeGreaterThan(0);
  });
});

describe("028 · resumen.csv contra el JSONL (recuento propio desde los eventos)", () => {
  const comparar = (filas: Record<string, string>[], ls: ReturnType<typeof esquemaLinea.parse>[]) => {
    expect(filas.length).toBe(ls.length);
    filas.forEach((f, i) => {
      const l = ls[i] as (typeof ls)[number];
      const de = (tipo: string, lado: string) => l.eventos.filter((e) => e.tipo === tipo && e.equipo === lado);
      expect(f.id).toBe(l.id);
      expect(Number(f.semilla)).toBe(l.config.seed);
      for (const lado of ["local", "visita"] as const) {
        expect(Number(f[`goles_${lado}`]), `${l.id} goles ${lado}`).toBe(de("gol", lado).length);
        expect(f[`xg_${lado}`], `${l.id} xg ${lado}`).toBe(de("tiro", lado).reduce((a, e) => a + (e.xg ?? 0), 0).toFixed(CSV_DECIMALES_XG));
        expect(Number(f[`tiros_${lado}`])).toBe(de("tiro", lado).length);
        expect(Number(f[`amarillas_${lado}`])).toBe(de("tarjeta_amarilla", lado).length);
        expect(Number(f[`rojas_${lado}`])).toBe(de("tarjeta_roja", lado).length);
      }
      expect(Number(f.lesiones)).toBe(l.eventos.filter((e) => e.tipo === "lesion").length);
      expect(Number(f.autogoles)).toBe(l.eventos.filter((e) => e.autogol === true).length);
      expect(Number(f.micro_eventos)).toBe(l.capaMicro.eventos);
      expect(Number(f.hechos)).toBe(l.hechos.length);
      expect(f.clima).toBe(l.config.condiciones?.clima ?? "");
    });
  };
  it("las columnas son las documentadas, en orden", () => {
    const texto = csv(entradasPorSemilla([1]).map((e) => filaCsv(procesar(e))));
    expect(Object.keys(leerCsv(texto)[0] as object)).toEqual([...COLUMNAS_CSV]);
    expect(texto.startsWith("﻿")).toBe(true);
  });
  it("lo que exporta el código: CSV y JSONL coinciden (muestra + un autogol de cada lado)", () => {
    // Las semillas de la muestra más, de la corrida de referencia, la primera con autogol de cada lado
    // (elegidas por los datos; el recuento de abajo sale del código, no del archivo).
    const ref = lineas(readFileSync(join(RAIZ, SALIDA_POR_DEFECTO, ARCHIVOS.partidos), "utf8")).map((l) => esquemaLinea.parse(l));
    const conAutogol = (lado: string) => ref.find((l) => l.eventos.some((e) => e.autogol === true && e.equipo === lado))?.config.seed ?? -1;
    const semillas = [...new Set([...MUESTRA_SEMILLAS, conAutogol("local"), conAutogol("visita")])].filter((x) => x >= 0);
    const ps = entradasPorSemilla(semillas).map(procesar);
    const ls = ps.map((p) => esquemaLinea.parse(JSON.parse(JSON.stringify(lineaPartido(p)))));
    // no vacía: un recuento que confunda «equipo que suma» con «equipo del autor» tiene con qué fallar
    for (const lado of ["local", "visita"]) expect(ls.some((l) => l.eventos.some((e) => e.autogol === true && e.equipo === lado)), lado).toBe(true);
    comparar(leerCsv(csv(ps.map(filaCsv))), ls);
  });
  it("lo commiteado: docs/dataset/resumen.csv contra docs/dataset/partidos.jsonl", () => {
    const dir = join(RAIZ, SALIDA_POR_DEFECTO);
    comparar(leerCsv(readFileSync(join(dir, ARCHIVOS.resumen), "utf8")), lineas(readFileSync(join(dir, ARCHIVOS.partidos), "utf8")).map((l) => esquemaLinea.parse(l)));
  });
  it("una celda con coma o comillas se cita según RFC 4180 y se relee igual", async () => {
    const { celda } = await import("../exportar");
    expect(celda('Club "A", B')).toBe('"Club ""A"", B"');
    expect(leerCsv(`a,b\n${celda('x, "y"')},z\n`)).toEqual([{ a: 'x, "y"', b: "z" }]);
  });
});

describe("028 · propiedades 1 y 3 — corrida pequeña: determinismo, gz, DATASHEET sin cifras huérfanas", async () => {
  const r1 = await generarDataset(PEQUENA, join(tmp, "a"), TAM);
  const r2 = await generarDataset(PEQUENA, join(tmp, "b"), TAM);
  const bytes = (dir: string, f: string) => readFileSync(join(tmp, dir, f));

  it("dos corridas ⇒ los mismos bytes en TODOS los archivos (gz incluido)", () => {
    for (const f of Object.values(ARCHIVOS)) expect(bytes("a", f).equals(bytes("b", f)), f).toBe(true);
    expect(r1.archivos.map((a) => a.nombre)).toEqual([ARCHIVOS.partidos, ARCHIVOS.resumen, ARCHIVOS.micro]);
  });

  it("gz: cabecera con MTIME y OS fijos; descomprime a una línea micro válida por partido, alineada con partidos.jsonl", () => {
    const gz = bytes("a", ARCHIVOS.micro);
    expect([gz[0], gz[1], gz[2]]).toEqual([0x1f, 0x8b, 8]);
    expect(gz.readUInt32LE(4)).toBe(GZIP.mtime);
    expect(gz[9]).toBe(GZIP.os);
    const micro = lineas(gunzipSync(gz).toString("utf8")).map((l) => esquemaLineaMicro.parse(l));
    const partidos = lineas(bytes("a", ARCHIVOS.partidos).toString("utf8")).map((l) => esquemaLinea.parse(l));
    expect(micro.map((m) => m.id)).toEqual(partidos.map((p) => p.id));
    micro.forEach((m, i) => {
      const p = partidos[i] as (typeof partidos)[number];
      expect(m.eventos.length).toBe(p.capaMicro.eventos);
      expect(m.posesiones.length).toBe(p.capaMicro.posesiones);
      // lo citado en la línea del partido es exactamente un subconjunto de la capa completa
      const porId = new Map(m.eventos.map((x) => [x.id, JSON.stringify(x)]));
      for (const c of p.microCitados) expect(porId.get(c.id)).toBe(JSON.stringify(c));
    });
  });

  it("el JSONL escrito es el de jsonl(lineaPartido) — sin pasos ocultos", () => {
    const esperado = jsonl(entradasPorSemilla(Array.from({ length: N_PRUEBA_RAPIDA.partidos }, (_, i) => i + 1)).map((e) => lineaPartido(procesar(e))));
    expect(bytes("a", ARCHIVOS.partidos).toString("utf8") === esperado).toBe(true);
  });

  const huerfanas = (md: string) =>
    md
      .split("\n")
      .map((l) => l.replace(new RegExp(`${MARCA.abre}[^${MARCA.cierra}]*${MARCA.cierra}`, "g"), ""))
      .filter((l) => /\d/.test(l));
  const sinMarcas = (md: string) => md.replace(new RegExp(`[${MARCA.abre}${MARCA.cierra}]`, "g"), "");

  it("DATASHEET (semillas): toda cifra viene marcada — borradas, no queda ni un dígito; marcar no cambia el texto", () => {
    const inst = renderDatasheet(r1.modelo, true);
    expect(huerfanas(inst)).toEqual([]);
    expect(sinMarcas(inst)).toBe(r1.datasheet);
    expect(r1.datasheet).toBe(r2.datasheet);
    // el archivo escrito es el render
    expect(bytes("a", ARCHIVOS.datasheet).toString("utf8")).toBe(r1.datasheet);
  });

  it("el espacio de semillas se enuncia como tamaño, calculado de SEED_MAX, y sin afirmar unicidad", () => {
    expect(r1.datasheet).toContain(`2^${Math.log2(SEED_MAX + 1)}`);
    expect(r1.datasheet).not.toMatch(/\bunique (matches|inputs)\b|\bguarantee(s|d)? (unique|distinct)\b/i);
  });
});

describe("028 · intervalos y veredictos del DATASHEET", () => {
  it("Wilson: con 0 éxitos el techo es z²/(n+z²); con todos, el piso es n/(n+z²); siempre contiene al valor puntual", () => {
    const z2 = CONFIANZA.z ** 2;
    for (const n of [MUESTRA_SEMILLAS.length, N_PRUEBA_RAPIDA.partidos * MUESTRA_SEMILLAS.length]) {
      expect(wilson(0, n)[0]).toBe(0);
      expect(wilson(0, n)[1]).toBeCloseTo(z2 / (n + z2), 12);
      expect(wilson(n, n)[0]).toBeCloseTo(n / (n + z2), 12);
      for (let k = 0; k <= n; k++) {
        const [lo, hi] = wilson(k, n);
        expect(lo).toBeLessThanOrEqual(k / n);
        expect(hi).toBeGreaterThanOrEqual(k / n);
      }
    }
  });
  it("veredicto: dentro ⇒ en banda; fuera con intervalo que toca ⇒ consistente; fuera sin tocar o sin intervalo ⇒ fuera", () => {
    const m = (medido: number, intervalo?: [number, number]): Omit<Medicion, "veredicto"> => ({ clave: "x", medida: [], fuente: "X", min: 0.4, max: 0.6, medido, formato: { tipo: "int" }, n: 1, unidad: "u", ...(intervalo ? { intervalo } : {}) });
    expect(veredicto(m(0.5))).toBe("en_banda");
    expect(veredicto(m(0.3, [0.2, 0.45]))).toBe("consistente");
    expect(veredicto(m(0.7, [0.55, 0.8]))).toBe("consistente");
    expect(veredicto(m(0.3, [0.2, 0.35]))).toBe("fuera");
    expect(veredicto(m(0.3))).toBe("fuera");
    expect(dentro(0.6, { max: 0.6, maxEstricto: true })).toBe(false);
    expect(dentro(0.6, { max: 0.6 })).toBe(true);
  });
});
