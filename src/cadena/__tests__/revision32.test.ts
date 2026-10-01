// Revisión 3.2 del 003: pruebas que matan las 9 mutaciones supervivientes de la ronda 2
// (ids del harness mutar2.mjs del auditor), B6 bien definido (protocolo2.ts), robustez de
// la caché (rename que falla, huérfanos, audit incoherente) y el lado VERDADERO de las
// afirmaciones computables (que no se vuelvan falsos positivos).
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import type { Hecho } from "../../analista/tipos";
import { borradorDesdeHechos } from "../../lib/llm-stub";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Partido } from "../../sim/tipos";
import { indiceDeId, llmGuionado, type Corruptor } from "../__fixtures__/llms-falsos";
import { crearCacheDisco, nombreArchivo } from "../cache";
import { generarCronica } from "../cadena";
import { mensajeInicial } from "../prompt";
import type { CronicaDraft, Motivo } from "../tipos";
import { FINAL_MIN, MAX_REINTENTOS, TEMPRANO_MAX } from "../umbrales";
import { verificarDraft } from "../verificador";

const p = simular(configDeSemilla(246));
const hechos = analizar(p);
const J = "Juventud Islaverde Sur";
const A = "Atlético Montefrío Bajo";
const dirTemporal = () => mkdtempSync(join(tmpdir(), "cronista-r32-"));
const reglas = (ms: Motivo[]) => [...new Set(ms.map((m) => m.regla))].sort();

/** Reemplaza la oración del hecho `id` y verifica (por defecto, semilla 246). */
function con(id: string, es: string, en: string, partido: Partido = p, hs: Hecho[] = hechos): Motivo[] {
  const d = borradorDesdeHechos(mensajeInicial(hs));
  d.oraciones[indiceDeId(d, id)] = { texto_es: es, texto_en: en, hecho: id };
  return verificarDraft(d, hs, partido);
}
const enOracion = (ms: Motivo[]) => ms.filter((m) => m.oracion >= 0);

describe("mutaciones supervivientes de la ronda 2", () => {
  it("[N17] «ganó» invertido SOLO en español (el inglés es neutro) ⇒ V8", () => {
    const ms = con("h03", `${A} ganó: ${J} 4–1 ${A}.`, `Full time: ${J} 4–1 ${A}.`);
    expect(reglas(enOracion(ms))).toEqual(["V8"]);
  });
  it("[N09] «roja directa» SOLO en español con una doble amarilla ⇒ V8", () => {
    const ms = con("h01", "Leo Fenaido (Atlético Montefrío Bajo) vio la roja directa en el minuto 66.", "Leo Fenaido (Atlético Montefrío Bajo) was sent off in minute 66.");
    expect(reglas(enOracion(ms))).toEqual(["V8"]);
  });
  it("[N04] «primer tiempo» para un gol del minuto 67 ⇒ V3", () => {
    const ms = con("h08", "Dante Doraena marcó en el primer tiempo, en el minuto 67.", "Dante Doraena scored in the first half, in minute 67.");
    expect(reglas(enOracion(ms))).toEqual(["V3"]);
  });
  it("[N03] «goleada» con un margen de exactamente 2 (el 2–0 del descanso) ⇒ V8", () => {
    const ms = con("h11", `Al descanso, una goleada parcial: ${J} 2–0 ${A}.`, `At the break, a rout: ${J} 2–0 ${A}.`);
    expect(reglas(enOracion(ms))).toEqual(["V8"]);
  });
  it("[N06] el título no puede tomar cifras de un hecho que no es el resultado ni de un jugador que nombra ⇒ V3", () => {
    const d = borradorDesdeHechos(mensajeInicial(hechos));
    d.titulo_es = `${J} gana 4–1 con 1.75 de xG`;
    d.titulo_en = `${J} Win 4–1 With 1.75 xG`;
    expect(verificarDraft(d, hechos, p).some((m) => m.regla === "V3" && m.oracion === -1 && m.detalle.includes("1.75"))).toBe(true);
  });
  it("[N16] tras una COMA una palabra funcional con mayúscula no está permitida ⇒ V4", () => {
    const ms = con("h04", "Darío Mariosa marcó en el minuto 3, Tras un pase.", "Darío Mariosa scored in minute 3, After a pass.");
    expect(reglas(enOracion(ms))).toEqual(["V4"]);
  });
  it("[N02] un marcador de dos cifras cuyas cifras sueltas sí están en el hecho ⇒ V3", () => {
    const ms = con("h15", `${A} recibió 4 tarjetas amarillas (minutos 18, 33, 46, 48), un 18–4 de la tarde.`, `${A} received 4 yellow cards (minutes 18, 33, 46, 48), an 18–4 afternoon.`);
    expect(enOracion(ms).some((m) => m.regla === "V3" && m.detalle.includes("18–4"))).toBe(true);
  });
  it("[N14] una entrada copiada bajo la clave de OTRO deployment no se sirve ⇒ se regenera", async () => {
    const dir = dirTemporal();
    const cache = crearCacheDisco(dir);
    await generarCronica(p, { llm: llmGuionado(["ok"], "modelo-a"), cache });
    copyFileSync(join(dir, nombreArchivo({ seed: 246, deployment: "modelo-a", modo: "neutral" })), join(dir, nombreArchivo({ seed: 246, deployment: "modelo-b", modo: "neutral" })));
    const llmB = llmGuionado(["ok"], "modelo-b");
    const r = await generarCronica(p, { llm: llmB, cache });
    expect(r.desdeCache).toBe(false);
    expect(llmB.llamadas).toHaveLength(1);
  });
});

describe("casos que aíslan UN mecanismo (sin que otro lo tape en el otro idioma)", () => {
  it("sujeto = el equipo INMEDIATAMENTE antes del verbo, aunque el primero no lleve preposición: «J vio cómo A ganó» ⇒ V8", () => {
    const ms = con("h03", `${J} vio cómo ${A} ganó 4–1.`, `${J} watched as ${A} won 4–1.`);
    expect(reglas(enOracion(ms))).toEqual(["V8"]);
  });
  it("pasiva SOLO en español («fue superado por») con el inglés neutro ⇒ V8", () => {
    const ms = con("h03", `${J} fue superado por ${A}: ${J} 4–1 ${A}.`, `Full time: ${J} 4–1 ${A}.`);
    expect(reglas(enOracion(ms))).toEqual(["V8"]);
  });
  it("una pregunta sin ninguna palabra de juicio ⇒ V8", () => {
    const ms = con("h03", `¿${J} 4–1 ${A}?`, `${J} 4–1 ${A}?`);
    expect(reglas(enOracion(ms))).toEqual(["V8"]);
  });
  it("«card-free» SOLO en inglés ⇒ V7", () => {
    const ms = con("h03", `Resultado final: ${J} 4–1 ${A}.`, `Full time: ${J} 4–1 ${A}, a card-free match.`);
    expect(reglas(enOracion(ms))).toEqual(["V7"]);
  });
});

describe("[N15] B6 bien definido (protocolo2.ts del auditor)", () => {
  const sinGol: Corruptor = (d) => {
    d.oraciones.splice(indiceDeId(d, "h07"), 1);
    return d;
  };
  const mal =
    (id: string): Corruptor =>
    (d) => {
      const o = d.oraciones[indiceDeId(d, id)]!;
      o.texto_es += " Hubo 99 tiros.";
      o.texto_en += " There were 99 shots.";
      return d;
    };
  const roto: Corruptor = (d) => JSON.stringify(d).slice(0, -5);
  const resto = (sin: string) => hechos.map((h) => h.id).filter((id) => id !== sin);

  it("B6a [sinGol, mal(h14), roto] ⇒ rescata el intento de h14 (no el acta)", async () => {
    const { cronica } = await generarCronica(p, { llm: llmGuionado([sinGol, mal("h14"), roto]) });
    expect(cronica).toMatchObject({ modo: "llm", intentos: 1 + MAX_REINTENTOS, frasesOmitidas: 1 });
    expect(cronica.oraciones.map((o) => o.hecho)).toEqual(resto("h14"));
  });
  it("B6b [mal(h14), sinGol, roto] ⇒ rescata el intento 1", async () => {
    const { cronica } = await generarCronica(p, { llm: llmGuionado([mal("h14"), sinGol, roto]) });
    expect(cronica).toMatchObject({ modo: "llm", frasesOmitidas: 1 });
    expect(cronica.oraciones.map((o) => o.hecho)).toEqual(resto("h14"));
  });
  it("B6e costos DISTINTOS [mal(h14)+mal(h15), mal(h14), roto] ⇒ el de menor costo (1 omitida, no 2)", async () => {
    const dosMalas: Corruptor = (d, hs) => mal("h15")(mal("h14")(d, hs) as CronicaDraft, hs);
    const { cronica } = await generarCronica(p, { llm: llmGuionado([dosMalas, mal("h14"), roto]) });
    expect(cronica).toMatchObject({ modo: "llm", frasesOmitidas: 1 });
    expect(cronica.oraciones.map((o) => o.hecho)).toEqual(resto("h14"));
  });
  it("B6c [roto, roto, roto] ⇒ acta", async () => {
    const { cronica } = await generarCronica(p, { llm: llmGuionado([roto]) });
    expect(cronica.modo).toBe("acta");
  });
  it("B6d [mal(h14), error, error] ⇒ rescata el intento 1", async () => {
    const { cronica } = await generarCronica(p, { llm: llmGuionado([mal("h14"), new Error("red")]) });
    expect(cronica).toMatchObject({ modo: "llm", frasesOmitidas: 1 });
    expect(cronica.oraciones.map((o) => o.hecho)).toEqual(resto("h14"));
  });
});

describe("caché: coherencia del audit (una historia imposible se regenera)", () => {
  async function entrada(): Promise<{ archivo: string; dir: string }> {
    const dir = dirTemporal();
    await generarCronica(p, { llm: llmGuionado(["ok"], "stub"), cache: crearCacheDisco(dir) });
    return { dir, archivo: join(dir, nombreArchivo({ seed: 246, deployment: "stub", modo: "neutral" })) };
  }
  async function servida(dir: string): Promise<boolean> {
    const llm = llmGuionado(["ok"], "stub");
    const r = await generarCronica(p, { llm, cache: crearCacheDisco(dir) });
    return r.desdeCache;
  }

  it("el audit fabricado del auditor (n 3 y luego 1, modo/intentos falsos, apoyo repetido) ⇒ se regenera", async () => {
    const { dir, archivo } = await entrada();
    const e = JSON.parse(readFileSync(archivo, "utf8"));
    e.cronica.audit = [
      { n: 3, borrador: { titulo_es: "Gutiérrez 9–0", titulo_en: "Gutiérrez 9–0", oraciones: [{ texto_es: "x", texto_en: "x", hecho: "h03" }] }, veredicto: [], feedback: "inventado" },
      { n: 1, borrador: { titulo_es: "", titulo_en: "", oraciones: [] }, veredicto: [{ oracion: 0, regla: "V4", detalle: "rechazo fabricado" }] },
    ];
    e.cronica.modo = "acta";
    e.cronica.intentos = 0;
    e.cronica.frasesOmitidas = 9;
    e.cronica.oraciones[0].apoyo = ["h01", "h01", "h15"];
    writeFileSync(archivo, JSON.stringify(e));
    expect(await servida(dir)).toBe(false);
  });

  it.each([
    ["n no secuencial", (c: any) => (c.audit[0].n = 2)],
    ["intentos ≠ audit.length", (c: any) => (c.intentos = 2)],
    ["un «aprobado» que no es el último", (c: any) => c.audit.push({ n: 2, borrador: c.audit[0].borrador, veredicto: [{ oracion: 0, regla: "V3", detalle: "x" }] })],
    ["modo llm aprobado con frases omitidas", (c: any) => (c.frasesOmitidas = 1)],
    ["acta con un intento aprobado", (c: any) => (c.modo = "acta")],
    ["apoyo repetido", (c: any) => (c.oraciones[0].apoyo = ["h02", "h02"])],
  ])("%s ⇒ se regenera", async (_, romper) => {
    const { dir, archivo } = await entrada();
    const e = JSON.parse(readFileSync(archivo, "utf8"));
    romper(e.cronica);
    writeFileSync(archivo, JSON.stringify(e));
    expect(await servida(dir)).toBe(false);
  });

  it("la entrada sana sí se sirve (el control: las refinaciones no rechazan lo legítimo)", async () => {
    const { dir } = await entrada();
    expect(await servida(dir)).toBe(true);
  });

  it("una corrida legítima por omisión (reintentos agotados) se cachea y se sirve", async () => {
    const dir = dirTemporal();
    const mal14: Corruptor = (d) => {
      const o = d.oraciones[indiceDeId(d, "h14")]!;
      o.texto_es += " Hubo 99 tiros.";
      o.texto_en += " There were 99 shots.";
      return d;
    };
    const r1 = await generarCronica(p, { llm: llmGuionado([mal14], "stub"), cache: crearCacheDisco(dir) });
    expect(r1.cronica.frasesOmitidas).toBe(1);
    expect(await servida(dir)).toBe(true);
  });
});

describe("caché: robustez de escritura (Windows / multiproceso)", () => {
  const eperm = () => Object.assign(new Error("EPERM: operation not permitted, rename"), { code: "EPERM" });

  it("rename que falla SIEMPRE ⇒ se sirve la crónica sin cachear, no lanza, no deja .tmp", async () => {
    const dir = dirTemporal();
    const cache = crearCacheDisco(dir, {
      renombrar: () => {
        throw eperm();
      },
    });
    const r = await generarCronica(p, { llm: llmGuionado(["ok"], "stub"), cache });
    expect(r.cronica.modo).toBe("llm");
    expect(readdirSync(dir)).toEqual([]);
  });

  it("rename que falla dos veces y luego anda ⇒ queda cacheada (reintentos)", async () => {
    const dir = dirTemporal();
    let fallos = 0;
    const { renameSync } = await import("node:fs");
    const cache = crearCacheDisco(dir, {
      renombrar: (a, b) => {
        if (fallos++ < 2) throw eperm();
        renameSync(a, b);
      },
    });
    await generarCronica(p, { llm: llmGuionado(["ok"], "stub"), cache });
    expect(fallos).toBe(3);
    expect(readdirSync(dir)).toEqual([nombreArchivo({ seed: 246, deployment: "stub", modo: "neutral" })]);
  });

  it("aunque una caché LANCE al escribir, la cadena devuelve la crónica ya pagada (segunda capa)", async () => {
    const cacheQueLanza = {
      leer: () => undefined,
      escribir: () => {
        throw eperm();
      },
    };
    const r = await generarCronica(p, { llm: llmGuionado(["ok"], "stub"), cache: cacheQueLanza });
    expect(r.cronica.modo).toBe("llm");
    expect(verificarDraft(r.cronica, r.hechos, p)).toEqual([]);
  });

  it("al abrir la caché se borran los .tmp huérfanos viejos (no los directorios ni los recientes)", () => {
    const dir = dirTemporal();
    const viejo = join(dir, "246__stub__neutral.json.999.abc.tmp");
    const reciente = join(dir, "246__stub__neutral.json.998.def.tmp");
    writeFileSync(viejo, "{");
    writeFileSync(reciente, "{");
    mkdirSync(join(dir, "carpeta.tmp"));
    const hace = new Date(Date.now() - 3_600_000);
    utimesSync(viejo, hace, hace);
    crearCacheDisco(dir, { edadHuerfanoMs: 60_000 });
    expect(readdirSync(dir).sort()).toEqual(["246__stub__neutral.json.998.def.tmp", "carpeta.tmp"]);
  });
});

describe("afirmaciones computables: el lado VERDADERO pasa", () => {
  it("«gol de la victoria» para el gol que decidió (el 2–0 de Celeloya, con final 4–1)", () => {
    expect(con("h05", "Darío Celeloya marcó de penal el gol de la victoria en el minuto 31.", "Darío Celeloya scored the winning goal from the spot in minute 31.")).toEqual([]);
  });
  it(`«sobre el final» para un gol del minuto ≥ ${FINAL_MIN}; «temprano» para uno ≤ ${TEMPRANO_MAX}`, () => {
    const gol = hechos.find((h) => h.tipo === "gol_temprano") as Hecho;
    expect(con(gol.id, `${String(gol.datos.jugador)} marcó temprano, en el minuto ${gol.datos.minuto}.`, `${String(gol.datos.jugador)} scored early on, in minute ${gol.datos.minuto}.`)).toEqual([]);
    // Un gol tardío real en el corpus
    let hallado = false;
    for (let s = 1; s <= 80 && !hallado; s++) {
      const q = simular(configDeSemilla(s));
      const hs = analizar(q);
      const g = hs.find((h) => h.tipo === "gol_anotado" && Number(String(h.datos.minuto).split("+")[0]) >= FINAL_MIN && !String(h.datos.minuto).includes("+"));
      if (!g) continue;
      hallado = true;
      expect(con(g.id, `${String(g.datos.jugador)} marcó sobre el final, en el minuto ${g.datos.minuto}.`, `${String(g.datos.jugador)} scored late on, in minute ${g.datos.minuto}.`, q, hs)).toEqual([]);
    }
    expect(hallado).toBe(true);
  });
  it("«valla invicta» del ganador de un partido terminado sin goles en contra", () => {
    let hallado = false;
    for (let s = 1; s <= 200 && !hallado; s++) {
      const q = simular(configDeSemilla(s));
      const hs = analizar(q);
      const r = hs.find((h) => h.tipo === "resultado_final") as Hecho;
      const [gl, gv] = [r.datos.goles_local as number, r.datos.goles_visita as number];
      if (!((gl > 0 && gv === 0) || (gv > 0 && gl === 0))) continue;
      hallado = true;
      const ganador = String(gl > gv ? r.datos.local : r.datos.visita);
      expect(con(r.id, `${r.texto_es.replace(/\.$/, "")}; ${ganador} dejó su valla invicta.`, `${r.texto_en.replace(/\.$/, "")}; ${ganador} kept a clean sheet.`, q, hs)).toEqual([]);
    }
    expect(hallado).toBe(true);
  });
  it("V7 con respaldo: «A no marcó» se acepta si A hizo 0 y se rechaza si A hizo goles", () => {
    // Al descanso: J 2–0 A ⇒ A no marcó en el primer tiempo (cierto); J sí marcó.
    expect(con("h11", `Al descanso: ${J} 2–0 ${A}; ${A} no marcó.`, `Half time: ${J} 2–0 ${A}; ${A} did not score.`)).toEqual([]);
    expect(reglas(enOracion(con("h11", `Al descanso: ${J} 2–0 ${A}; ${J} no marcó.`, `Half time: ${J} 2–0 ${A}; ${J} did not score.`)))).toEqual(["V7"]);
  });
  it("una negación que NO es de goles no se respalda con ceros («sin tarjetas» con A en 0) ⇒ V7", () => {
    expect(reglas(enOracion(con("h11", `Al descanso: ${J} 2–0 ${A}, sin tarjetas para ${A}.`, `Half time: ${J} 2–0 ${A}, without cards for ${A}.`)))).toEqual(["V7"]);
  });
});

describe("normalización de la ronda 2", () => {
  it("guiones Unicode, «x a y» y «x to y» orientan el marcador igual que «x–y»", () => {
    for (const sep of ["‐", "‑", "‒", "−", "﹣", "－", " a "]) {
      const es = `Resultado final: ${J} 4${sep}1 ${A}.`;
      const en = `Full time: ${J} 4${sep === " a " ? " to " : sep}1 ${A}.`;
      expect(con("h03", es, en), `separador U+${sep.codePointAt(0)?.toString(16)}`).toEqual([]);
    }
  });
  it("«1.75 to 2.45» no es un marcador «75 to 2» (decimales intactos)", () => {
    expect(con("h10", `${J} ganó con menos xG que su rival: 1.75 contra 2.45.`, `${J} won with less xG than their opponent: 1.75 to 2.45.`)).toEqual([]);
  });
});
