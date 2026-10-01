// Revisión 1.1 — pruebas unitarias directas de funciones puras (sin estadística):
// [B4] fatiga, [B5] expulsados y límite de cambios, [B6]/[B7] validación y semilla,
// [B8] CLI estricto (parser puro + el binario real como subproceso).
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parsearArgs, SEED_POR_DEFECTO } from "../cli-args";
import {
  cambiosEjecutables,
  factoresAtaque,
  fatiga,
  normalizarSeed,
  simular,
  validarConfig,
  validarPlanCambios,
  type SituacionEquipo,
} from "../motor";
import { configDeSemilla } from "../plantillas";
import { MAX_CAMBIOS, SEED_MAX, type SimConfig } from "../tipos";

const equipo = (ataque: number, defensa: number, expulsados = 0, goles = 0): SituacionEquipo => ({
  eq: { ataque, defensa, estilo: "posesion" },
  expulsados,
  goles,
});

describe("[B4] la fatiga reduce el rendimiento (defensivo) con el minuto", () => {
  it("la fatiga es 0 al principio, 1 al final y nunca decrece con el minuto", () => {
    expect(fatiga(0)).toBe(0);
    expect(fatiga(30)).toBe(0);
    expect(fatiga(90)).toBe(1);
    expect(fatiga(95)).toBe(1);
    let anterior = -1;
    for (let m = 0; m <= 96; m++) {
      expect(fatiga(m)).toBeGreaterThanOrEqual(anterior);
      anterior = fatiga(m);
    }
    expect(fatiga(85)).toBeGreaterThan(fatiga(65));
  });

  it("una defensa cansada concede más: el rival llega más y con ocasiones más claras al final", () => {
    const atk = equipo(60, 60);
    const def = equipo(60, 60);
    const temprano = factoresAtaque(atk, def, 30);
    const tarde = factoresAtaque(atk, def, 85);
    expect(tarde.pAtaque).toBeGreaterThan(temprano.pAtaque);
    expect(tarde.xgShift).toBeGreaterThan(temprano.xgShift);
  });
});

describe("[B5] expulsados y límite de cambios", () => {
  it("un equipo con un expulsado pierde peso ofensivo, y con dos pierde más", () => {
    const rival = equipo(70, 70);
    const once = factoresAtaque(equipo(70, 70, 0), rival, 30).pAtaque;
    const diez = factoresAtaque(equipo(70, 70, 1), rival, 30).pAtaque;
    const nueve = factoresAtaque(equipo(70, 70, 2), rival, 30).pAtaque;
    expect(diez).toBeLessThan(once);
    expect(nueve).toBeLessThan(diez);
  });

  it("el rival de un equipo con expulsado gana llegadas y calidad de ocasión", () => {
    const atk = equipo(70, 70);
    const contraOnce = factoresAtaque(atk, equipo(70, 70, 0), 30);
    const contraDiez = factoresAtaque(atk, equipo(70, 70, 1), 30);
    expect(contraDiez.pAtaque).toBeGreaterThan(contraOnce.pAtaque);
    expect(contraDiez.xgShift).toBeGreaterThan(contraOnce.xgShift);
  });

  it(`el límite de ${MAX_CAMBIOS} cambios rechaza un plan de ${MAX_CAMBIOS + 1}`, () => {
    const planLargo = Array.from({ length: MAX_CAMBIOS + 1 }, (_, i) => 60 + i);
    expect(() => validarPlanCambios(planLargo)).toThrow(/plan de cambios/);
    expect(() => validarPlanCambios(planLargo.slice(0, MAX_CAMBIOS))).not.toThrow();
  });

  it("aun con un plan largo, nunca se ejecutan más cambios que el máximo", () => {
    const planLargo = Array.from({ length: MAX_CAMBIOS + 2 }, (_, i) => 60 + i);
    expect(cambiosEjecutables(planLargo, 0, 90)).toBe(MAX_CAMBIOS);
    expect(cambiosEjecutables(planLargo, MAX_CAMBIOS - 1, 90)).toBe(1);
    expect(cambiosEjecutables(planLargo, MAX_CAMBIOS, 90)).toBe(0);
    expect(cambiosEjecutables(planLargo, 0, 59)).toBe(0);
    expect(cambiosEjecutables(planLargo, 0, 61)).toBe(2);
  });
});

describe("[B6] [B7] semilla normalizada y config inválida", () => {
  it("normalizarSeed lleva cualquier entero a [0, SEED_MAX] y lanza con no enteros", () => {
    expect(normalizarSeed(0)).toBe(0);
    expect(normalizarSeed(SEED_MAX)).toBe(SEED_MAX);
    expect(normalizarSeed(SEED_MAX + 1)).toBe(0);
    expect(normalizarSeed(-1)).toBe(SEED_MAX);
    for (const malo of [1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => normalizarSeed(malo)).toThrow(/seed/);
    }
  });

  const base = (): SimConfig => configDeSemilla(42);

  it("una config válida no lanza", () => {
    expect(() => validarConfig(base())).not.toThrow();
  });

  it.each([1.5, 0, 101, -5, Number.NaN, Number.POSITIVE_INFINITY])("simular lanza con ataque = %s", (v) => {
    const c = base();
    c.local.ataque = v;
    expect(() => simular(c)).toThrow(/ataque/);
  });

  it.each([50.5, 0, 101, Number.NaN, Number.NEGATIVE_INFINITY])("simular lanza con defensa = %s", (v) => {
    const c = base();
    c.visita.defensa = v;
    expect(() => simular(c)).toThrow(/defensa/);
  });

  it("los extremos 1 y 100 son válidos", () => {
    const c = base();
    c.local.ataque = 1;
    c.local.defensa = 100;
    c.visita.ataque = 100;
    c.visita.defensa = 1;
    expect(() => simular(c)).not.toThrow();
  });

  it.each([4.2, Number.NaN, Number.POSITIVE_INFINITY])("simular lanza con seed = %s", (seed) => {
    expect(() => simular({ ...base(), seed })).toThrow(/seed/);
  });

  it("simular lanza con una fuerza que no es número (p. ej. texto)", () => {
    const c = base() as unknown as { local: { ataque: unknown } };
    c.local.ataque = "70";
    expect(() => simular(c as unknown as SimConfig)).toThrow(/ataque/);
  });

  it("simular lanza con plantilla incompleta o nombres repetidos", () => {
    const corta = base();
    corta.local.jugadores = corta.local.jugadores.slice(0, 10);
    expect(() => simular(corta)).toThrow(/jugadores/);
    const repetida = base();
    (repetida.visita.jugadores[3] as { nombre: string }).nombre = (repetida.local.jugadores[0] as { nombre: string }).nombre;
    expect(() => simular(repetida)).toThrow(/repetido/);
  });
});

describe("[B8] parser del CLI", () => {
  it("sin argumentos usa la semilla por defecto", () => {
    expect(parsearArgs([])).toEqual({ ok: true, opciones: { seed: SEED_POR_DEFECTO, todo: false, json: false } });
  });

  it("acepta semillas decimales válidas y los flags conocidos", () => {
    expect(parsearArgs(["--seed", "7"])).toEqual({ ok: true, opciones: { seed: 7, todo: false, json: false } });
    expect(parsearArgs(["--seed", "0", "--todo"])).toEqual({ ok: true, opciones: { seed: 0, todo: true, json: false } });
    expect(parsearArgs(["--json", "--seed", String(SEED_MAX)])).toEqual({
      ok: true,
      opciones: { seed: SEED_MAX, todo: false, json: true },
    });
  });

  it.each([
    [["--seed"], "sin valor"],
    [["--seed", ""], "vacío"],
    [["--seed", "0x2A"], "hex"],
    [["--seed", "4.2"], "decimal"],
    [["--seed", "1e3"], "exponente"],
    [["--seed", "-1"], "negativo"],
    [["--seed", "+7"], "con signo"],
    [["--seed", " 7"], "con espacio"],
    [["--seed", String(SEED_MAX + 1)], "fuera de rango"],
    [["--seed", "99999999999999999999"], "fuera de rango enorme"],
    [["--seed", "--todo"], "flag en lugar de valor"],
    [["--seed", "7", "--seed", "8"], "repetido"],
    [["--semilla", "7"], "flag desconocido"],
    [["-s", "7"], "flag corto desconocido"],
    [["42"], "posicional"],
  ] as [string[], string][])("rechaza %j (%s)", (args) => {
    const r = parsearArgs(args);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });
});

describe("[B8] el CLI real (subproceso) sale con código 1 ante argumentos inválidos", () => {
  const cli = fileURLToPath(new URL("../cli.ts", import.meta.url));
  const correr = (args: string[]) =>
    spawnSync(process.execPath, ["--import", "tsx", cli, ...args], { encoding: "utf8", timeout: 60_000 });

  it("--seed sin valor ⇒ exit 1 y mensaje de error", () => {
    const r = correr(["--seed"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/--seed necesita un valor/);
  });

  it("flag desconocido ⇒ exit 1 y mensaje de error", () => {
    const r = correr(["--seed", "7", "--rapido"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/flag desconocido/);
  });

  it("--seed 7 ⇒ exit 0 e imprime el resumen", () => {
    const r = correr(["--seed", "7"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/semilla 7/);
  });
});
