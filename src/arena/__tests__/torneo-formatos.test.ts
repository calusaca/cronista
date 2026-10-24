// Brief 062 v1.3 · Funciones puras de formato (P1-a: liga): G7 (liga), G8, G9, G10 y G12 de § 9 / § 17.8.
// Los valores literales (µUSD de § 5.1 y su mitad a 30 s, 30/15/18 partidos, 33 y 16–20 min) están calculados a mano
// y comprueban el cálculo; los umbrales se importan de limites.ts (§ 8).
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { TORNEO_ARENA as T, TORNEO_SITIO as S } from "../../sim/limites";
import {
  calendarioTorneo, esquemaEncuentro, esquemaTorneo, esquemaTorneo059, esquemaTorneoCualquiera, pSignosBilateral, validarCoherencia,
  type EncuentroTorneo, type Torneo059, type Torneo062,
} from "../torneo";
import {
  diaUtc, duracionMinFormato, estimarFormato, ID_SITIO, idDelDia, partidosFormato, planTorneo, proximoCupoUtc, semillaDelDia, siguientePartido,
  textoSignificacionFormato, tipicoPartidoMaxMicroUsd, validarMetadatos062, type EntradasSitio,
} from "../torneo-formatos";
import { validarEncuentro } from "../torneo-validacion";
import entradasJson from "../torneo-sitio-entradas.json";

const ENTRADAS = entradasJson as EntradasSitio;
const DIR = "src/arena/__fixtures__/torneos/ensayo-059";
const t059 = () => esquemaTorneo059.parse(JSON.parse(readFileSync(`${DIR}/torneo.json`, "utf8")));
/** El fixture 059 de ensayo como torneo 062 de liga archivado en el repositorio (coherente). */
function a062(t: Torneo059, extra: Partial<Torneo062> = {}): Torneo062 {
  return { ...t, version: S.version, formato: "liga", origen: "repositorio", lanzamiento: "publico", motivoFin: null, enCurso: null,
    encuentros: t.encuentros.map(e => ({ ...e, fase: "liga" as const, desempate: false })), ...extra } as Torneo062;
}
const ids = (t: { participantes: { id: string }[] }) => t.participantes.map(p => p.id);

describe("062 · G7 (liga) · plan y siguiente partido", () => {
  it("liga = calendarioTorneo con fase «liga» y desempate false; siguientePartido avanza y termina en null", () => {
    const t = t059(), plan = planTorneo("liga", ids(t), t.semilla, { encuentros: [], pendientes: [] });
    expect(plan).toEqual(calendarioTorneo(ids(t), t.semilla).map(p => ({ ...p, fase: "liga", desempate: false })));
    expect(siguientePartido("liga", ids(t), t.semilla, { encuentros: [], pendientes: [] })?.n).toBe(1);
    expect(siguientePartido("liga", ids(t), t.semilla, { encuentros: t.encuentros.slice(0, 2), pendientes: [3] })?.n).toBe(4);
    expect(siguientePartido("liga", ids(t), t.semilla, t)).toBeNull();
  });
  it("partidosFormato calculado: liga 30/30 y grupos 15/18; grupos exige 6 participantes", () => {
    expect(partidosFormato("liga")).toEqual({ min: 30, max: 30 });
    expect(partidosFormato("grupos")).toEqual({ min: 15, max: 18 });
    expect(() => planTorneo("grupos", ids(t059()), 1, { encuentros: [], pendientes: [] })).toThrow(/6 participantes/);
  });
  it("D2 · día UTC, id, semilla y próximo cupo", () => {
    const ms = Date.parse("2026-10-25T23:59:59.000Z");
    expect([diaUtc(ms), idDelDia(diaUtc(ms)), semillaDelDia(diaUtc(ms)), proximoCupoUtc(ms)]).toEqual(["2026-10-25", "sitio-2026-10-25", 20261025, "2026-10-26T00:00:00.000Z"]);
    expect(ID_SITIO.test("sitio-2026-10-25") && ID_SITIO.test("sitio-prueba-0123456789ab")).toBe(true);
    expect(["sitio-x", "2026-10-24", "sitio-prueba-0123", "sitio-2026-10-25/..", "sitio-prueba-0123456789aB"].some(x => ID_SITIO.test(x))).toBe(false);
  });
  it("§ 5.4 · duración mostrada: liga ≈ 33 min; grupos ≈ 16–20 min", () => {
    expect(duracionMinFormato("liga")).toEqual({ min: 33, max: 33 });
    expect(duracionMinFormato("grupos")).toEqual({ min: 16, max: 20 });
  });
});

describe("062 · G8 · coherencia de la rama 062 (liga)", () => {
  it("el fixture como 062 es coherente; el archivo 059-v1.1 del 24 oct sigue válido con el esquema y la unión", () => {
    expect(validarCoherencia(esquemaTorneoCualquiera.parse(a062(t059())))).toEqual([]);
    const archivado = JSON.parse(readFileSync("public/torneos/2026-10-24/torneo.json", "utf8"));
    expect(validarCoherencia(esquemaTorneo.parse(archivado))).toEqual([]);
    expect(esquemaTorneoCualquiera.parse(archivado).version).toBe(T.version);
  });
  it("fase o desempate cambiados, hueco en el prefijo, enCurso con un estado final, completo con partidos por jugar ⇒ incoherente", () => {
    const t = a062(t059());
    const conE = (n: number, cambio: object) => ({ ...t, encuentros: t.encuentros.map(e => e.n === n ? { ...e, ...cambio } : e) }) as Torneo062;
    expect(validarCoherencia(conE(2, { fase: "grupo-A" })).join()).toMatch(/P2: no coincide con planTorneo/);
    expect(validarCoherencia(conE(3, { desempate: true })).join()).toMatch(/P3: no coincide con planTorneo/);
    expect(validarCoherencia(conE(1, { seed: t.encuentros[0]!.seed + 1 })).join()).toMatch(/P1: no coincide/);
    expect(validarCoherencia({ ...t, encuentros: t.encuentros.filter(e => e.n !== 2) }).join()).toMatch(/prefijo/);
    expect(validarCoherencia({ ...t, enCurso: { n: 1, local: t.encuentros[0]!.local.participante, visita: t.encuentros[0]!.visita.participante, inicioUtc: t.inicioUtc } }).join()).toMatch(/enCurso con un estado final/);
    expect(validarCoherencia({ ...t, encuentros: t.encuentros.slice(0, -1) }).join()).toMatch(/completo con pendientes o con partidos por jugar/);
    expect(validarCoherencia({ ...t, estado: "incompleto" }).join()).toMatch(/motivoFin/);
    expect(validarCoherencia({ ...t, estado: "en_curso" }).join()).toMatch(/finUtc/);
  });
  it("`sitio-` con origen repositorio (y al revés), o una prueba sin su prefijo ⇒ incoherente", () => {
    const t = a062(t059());
    expect(validarCoherencia({ ...t, id: "sitio-2026-10-25" }).join()).toMatch(/origen y prefijo/);
    expect(validarCoherencia({ ...t, origen: "sitio" }).join()).toMatch(/origen y prefijo/);
    expect(validarCoherencia({ ...t, id: "sitio-2026-10-25", origen: "sitio", lanzamiento: "prueba" }).join()).toMatch(/lanzamiento de prueba/);
    expect(validarCoherencia({ ...t, id: "sitio-2026-10-25", origen: "sitio" })).toEqual([]);
  });
  it("el esquema 059 rechaza `formato` (y cualquier campo 062); la unión exige la versión correcta", () => {
    const t = t059();
    expect(esquemaTorneo059.safeParse({ ...t, formato: "liga" }).success).toBe(false);
    expect(esquemaTorneoCualquiera.safeParse({ ...t, formato: "liga" }).success).toBe(false);
    expect(esquemaTorneoCualquiera.safeParse({ ...a062(t), version: T.version }).success).toBe(false);
    expect(esquemaTorneoCualquiera.safeParse(a062(t)).success).toBe(true);
  });
});

describe("062 · G9 · estimación por formato con las entradas reales", () => {
  it("a 15 s reproduce § 5.1: liga 7.076.840 µUSD y grupos 3.006.304 / 4.070.536 / 5.310.336", () => {
    const liga = estimarFormato("liga", ENTRADAS, T.duracionS, T.intervalosS[0]), grupos = estimarFormato("grupos", ENTRADAS, T.duracionS, T.intervalosS[0]);
    expect(liga.tipicoMicroUsd).toEqual({ min: 7_076_840, max: 7_076_840, maxConDesempates: 7_076_840 });
    expect(grupos.tipicoMicroUsd).toEqual({ min: 3_006_304, max: 4_070_536, maxConDesempates: 5_310_336 });
  });
  it("a 30 s (§ 17.5) la mitad: liga 3.538.420; grupos 1.503.152 / 2.035.268 / 2.655.168", () => {
    expect(estimarFormato("liga", ENTRADAS).tipicoMicroUsd).toEqual({ min: 3_538_420, max: 3_538_420, maxConDesempates: 3_538_420 });
    expect(estimarFormato("grupos", ENTRADAS).tipicoMicroUsd).toEqual({ min: 1_503_152, max: 2_035_268, maxConDesempates: 2_655_168 });
  });
  it("en los dos formatos: tope ≥ típicoMáx − último partido + reservaMáx; tope ≤ topeMaxUsd; los dos formatos están disponibles (P1-b)", () => {
    for (const f of ["liga", "grupos"] as const) {
      const ficha = estimarFormato(f, ENTRADAS);
      expect(ficha.topeMicroUsd).toBe(S.formatos[f].topeUsd * 1_000_000);
      expect(ficha.topeMicroUsd).toBeGreaterThanOrEqual(ficha.tipicoMicroUsd.maxConDesempates - tipicoPartidoMaxMicroUsd(ENTRADAS) + ficha.reservaMaxPartidoMicroUsd);
      expect(ficha.topeMicroUsd).toBeLessThanOrEqual(T.topeMaxUsd * 1_000_000);
      expect(ficha.partidos).toEqual(partidosFormato(f));
    }
    expect([estimarFormato("liga", ENTRADAS).disponible, estimarFormato("grupos", ENTRADAS).disponible]).toEqual([true, true]);
  });
});

describe("062 · G10 · frase de significación por formato", () => {
  it("liga p = 0,0625 (5 cruces) y grupos p = 0,125 (4 cruces y llaves), calculadas", () => {
    const participantes = JSON.parse(readFileSync("public/torneos/2026-10-24/torneo.json", "utf8")).participantes;
    expect(pSignosBilateral(5, 0)).toBe(0.0625); expect(pSignosBilateral(4, 0)).toBe(0.125);
    expect(textoSignificacionFormato({ formato: "liga", participantes }, "en")).toMatch(/all 5 pairings would not reach p < 0\.05 \(p = 0\.0625\)/);
    expect(textoSignificacionFormato({ formato: "grupos", participantes }, "en")).toMatch(/all 4 pairings and ties would not reach p < 0\.05 \(p = 0\.125\)/);
    expect(textoSignificacionFormato({ formato: "grupos", participantes }, "es")).toMatch(/ni ganar sus 4 cruces y llaves alcanzaría p < 0,05 \(p = 0,125\)/);
    expect(textoSignificacionFormato({ formato: "grupos", participantes }, "es")).toMatch(/no ordena los modelos por calidad/);
  });
});

describe("062 · G12 · metadatos 062 frente al plan", () => {
  const t = t059(), plan = planTorneo("liga", ids(t), t.semilla, { encuentros: [], pendientes: [] }), e1 = t.encuentros[0]!;
  const bytes = readFileSync(`${DIR}/${e1.archivo}`);
  it("un 062 coherente devuelve su base 059, que validarEncuentro acepta", () => {
    const base = validarMetadatos062({ ...e1, fase: "liga", desempate: false }, plan[0]!);
    expect(base).toEqual(e1);
    expect(() => validarEncuentro(base, plan[0]!, t.participantes, bytes, t)).not.toThrow();
  });
  it("un encuentro 059 con `fase` añadida: el esquema estricto 059 y validarEncuentro lo siguen rechazando", () => {
    const con = { ...e1, fase: "liga" } as unknown as EncuentroTorneo;
    expect(esquemaEncuentro.safeParse(con).success).toBe(false);
    expect(() => validarEncuentro(con, plan[0]!, t.participantes, bytes, t)).toThrow();
  });
  it("un 062 con fase, desempate, semilla o lados distintos del plan ⇒ rechazo", () => {
    expect(() => validarMetadatos062({ ...e1, fase: "final", desempate: false }, plan[0]!)).toThrow(/plan/);
    expect(() => validarMetadatos062({ ...e1, fase: "liga", desempate: true }, plan[0]!)).toThrow(/plan/);
    expect(() => validarMetadatos062({ ...e1, fase: "liga", desempate: false }, plan[1]!)).toThrow(/plan/);
    expect(() => validarMetadatos062({ ...e1, fase: "liga", desempate: false, extra: 1 }, plan[0]!)).toThrow();
  });
  it("el registro del fixture es un .gz legible (control del fixture)", () => {
    expect(JSON.parse(gunzipSync(bytes).toString("utf8")).rondas.length).toBeGreaterThan(0);
  });
});
