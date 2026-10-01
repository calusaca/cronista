// Brief 008 — partido en vivo (replay). Propiedades:
// 1. Sin clarividencia (fixtures + corpus 1..100).
// 2. Determinismo: mismo seed ⇒ mismos momentos, mismas updates.
// 3. Toda update mostrada pasó V1–V8; el cronista malicioso cae a la plantilla del hecho.
// 4. El overlay JSON valida contra su esquema zod y sale de las mismas updates.
// (+ la caché por (seed, momento, deployment, modo) y la regla «primero el hecho del momento».)

import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import type { Hecho } from "../../analista/tipos";
import type { ModoPersonalizacion } from "../../cadena/tipos";
import { CIFRA_ENSAYO, crearLlmEnsayo } from "../../lib/llm-ensayo";
import { crearLlmStub } from "../../lib/llm-stub";
import type { Llm } from "../../lib/llm";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Partido } from "../../sim/tipos";
import { balancePosterior, citaFutura, clarividente, MENTIRAS_BALANCE, demasiadoLarga, FUTURO_EN, FUTURO_ES, llmVivoGuionado, noJson, otroHechoPrimero } from "../__fixtures__/cronistas-vivo";
import { crearCacheUpdates, nombreArchivoUpdate } from "../cache";
import { hechoEnVivo } from "../enVivo";
import { BALANCE_POSTERIOR } from "../../cadena/lexico";
import { detectarMomentos, hechoDeMomento, hechosDelMomento } from "../momentos";
import { construirOverlay, esquemaOverlay } from "../overlay";
import { CAMPOS_DE_EFECTO, HECHO_DEL_MOMENTO, HECHOS_DE_CIERRE, MAX_ORACIONES_UPDATE, MOMENTOS_CLAVE } from "../umbrales";
import { generarUpdate, generarUpdates, type UpdateVerificada, verificarOracionesUpdate } from "../updates";

const CORPUS = Array.from({ length: 100 }, (_, i) => i + 1);
const partidoDe = (s: number) => simular(configDeSemilla(s));
const cacheTemporal = () => {
  const dir = mkdtempSync(join(tmpdir(), "cronista-vivo-"));
  return { dir, cache: crearCacheUpdates(dir) };
};
const NUM = /\d+(?:[.,]\d+)?/g;
const numeros = (t: string) => t.match(NUM) ?? [];
const sinDesdeCache = (us: UpdateVerificada[]) => us.map(({ desdeCache: _, ...u }) => u);

/** Cuenta llamadas al LLM (para probar que la caché no llama). */
function contador(llm: Llm): Llm & { n: number } {
  const c = {
    id: llm.id,
    n: 0,
    completar: async (s: string, m: Parameters<Llm["completar"]>[1]) => {
      c.n++;
      return llm.completar(s, m);
    },
  };
  return c;
}

/**
 * El oráculo de «sin clarividencia», INDEPENDIENTE del código que se prueba: el análisis del
 * prefijo hecho a mano (slice del stream hasta el evento del momento), no hechosDelMomento.
 */
function oraculo(p: Partido, u: UpdateVerificada) {
  const pre: Partido = { config: p.config, eventos: p.eventos.slice(0, u.momento.indice + 1) };
  // F1: el oráculo aplica la misma transformación en vivo (antes del final) que la cadena.
  const hechos = u.momento.tipo === "final" ? analizar(pre) : analizar(pre).map((h) => hechoEnVivo(h, pre));
  const pasados = new Set(pre.eventos.map((e) => e.id));
  const numerosPasados = new Set([String(u.momento.minuto), ...hechos.flatMap((h) => [...numeros(h.texto_es), ...numeros(h.texto_en)])]);
  return { pre, hechos, pasados, numerosPasados };
}

function marcadorFinal(p: Partido): { local: number; visita: number } {
  const m = { local: 0, visita: 0 };
  for (const e of p.eventos) if (e.tipo === "gol") m[e.equipo]++;
  return m;
}

function marcadorEn(p: Partido, indice: number): { local: number; visita: number } {
  const m = { local: 0, visita: 0 };
  for (const e of p.eventos.slice(0, indice + 1)) if (e.tipo === "gol") m[e.equipo]++;
  return m;
}

/** Comprueba la propiedad estrella sobre una update; devuelve las violaciones (vacío = sin clarividencia). */
function violaciones(p: Partido, u: UpdateVerificada): string[] {
  const out: string[] = [];
  const o = oraculo(p, u);
  const porIdOraculo = new Map(o.hechos.map((h) => [h.id, h]));
  const porIdUpdate = new Map(u.hechos.map((h) => [h.id, h]));
  // (a) Todo hecho que se le dio al Cronista es el del análisis del prefijo, idéntico, y solo cita eventos pasados.
  for (const h of u.hechos) {
    const ref = porIdOraculo.get(h.id);
    if (!ref || ref.texto_es !== h.texto_es || ref.texto_en !== h.texto_en || JSON.stringify(ref.eventos) !== JSON.stringify(h.eventos)) {
      out.push(`${u.momento.id}: el hecho ${h.id} (${h.tipo}) no es el del prefijo`);
    }
    for (const e of h.eventos) if (!o.pasados.has(e)) out.push(`${u.momento.id}: ${h.id} cita el evento futuro ${e}`);
  }
  // (b) Antes del final, ningún hecho de cierre (afirman el resultado del partido entero).
  if (u.momento.tipo !== "final") {
    for (const h of u.hechos) if (HECHOS_DE_CIERRE.includes(h.tipo)) out.push(`${u.momento.id}: hecho de cierre ${h.tipo} antes del final`);
    // F1: ni balances posteriores dentro de un hecho (campos de efecto), ni en el texto.
    for (const h of u.hechos) for (const k of CAMPOS_DE_EFECTO) if (k in h.datos) out.push(`${u.momento.id}: ${h.id} trae el campo de efecto ${k}`);
    for (const s of u.oraciones) {
      for (const [l, t] of [["es", s.texto_es], ["en", s.texto_en]] as const) {
        const m = t.match(new RegExp(BALANCE_POSTERIOR[l].source, "iu"));
        if (m) out.push(`${u.momento.id}: balance posterior «${m[0]}» en vivo`);
      }
    }
  }
  for (const [i, s] of u.oraciones.entries()) {
    // (c) Todo hecho citado (principal y apoyo) existe en el prefijo; sus eventos tienen minuto ≤ M.
    for (const id of [s.hecho, ...(s.apoyo ?? [])]) {
      const h = porIdUpdate.get(id);
      if (!h) {
        out.push(`${u.momento.id}[${i}]: cita ${id}, que no es un hecho del prefijo`);
        continue;
      }
      for (const eid of h.eventos) {
        const ev = p.eventos.find((e) => e.id === eid);
        if (!ev || !o.pasados.has(eid) || ev.minuto > u.momento.minuto) out.push(`${u.momento.id}[${i}]: evento ${eid} del futuro`);
      }
    }
    // (d) Ningún número del futuro: toda cifra del texto está en los hechos del prefijo (o es el minuto M).
    for (const n of [...numeros(s.texto_es), ...numeros(s.texto_en)]) {
      if (!o.numerosPasados.has(n)) out.push(`${u.momento.id}[${i}]: número ${n} que el prefijo no conoce`);
    }
    // (e) Antes del final, el marcador final no aparece si todavía no es el marcador.
    if (u.momento.tipo !== "final") {
      const f = marcadorFinal(p);
      const ahora = marcadorEn(p, u.momento.indice);
      if (f.local !== ahora.local || f.visita !== ahora.visita) {
        const fin = `${f.local}–${f.visita}`;
        if (s.texto_es.includes(fin) || s.texto_en.includes(fin)) out.push(`${u.momento.id}[${i}]: anuncia el marcador final ${fin}`);
      }
    }
  }
  return out;
}

describe("008 · momentos clave", () => {
  it("corpus 1..100: un momento por gol, por roja y por fin de periodo (descanso y final), en orden del stream", () => {
    for (const s of CORPUS) {
      const p = partidoDe(s);
      const ms = detectarMomentos(p);
      const goles = p.eventos.filter((e) => e.tipo === "gol").length;
      const rojas = p.eventos.filter((e) => e.tipo === "tarjeta_roja").length;
      expect(ms.filter((m) => m.tipo === "gol")).toHaveLength(goles);
      expect(ms.filter((m) => m.tipo === "roja")).toHaveLength(rojas);
      expect(ms.filter((m) => m.tipo === "descanso")).toHaveLength(1);
      expect(ms.filter((m) => m.tipo === "final")).toHaveLength(1);
      expect(ms[ms.length - 1]?.tipo).toBe("final");
      expect(new Set(ms.map((m) => m.id)).size).toBe(ms.length);
      for (let i = 1; i < ms.length; i++) {
        expect(ms[i]!.indice).toBeGreaterThan(ms[i - 1]!.indice);
        expect(ms[i]!.minuto).toBeGreaterThanOrEqual(ms[i - 1]!.minuto);
      }
      for (const m of ms) {
        expect(MOMENTOS_CLAVE).toContain(m.tipo);
        const h = hechoDeMomento(m, hechosDelMomento(p, m));
        expect(h?.tipo, `${s} ${m.id}`).toBe(HECHO_DEL_MOMENTO[m.tipo]);
      }
    }
  });

  it("009: «la figura del partido» no existe antes del final (escrito aparte: no contra la lista de umbrales)", () => {
    for (const s of CORPUS.slice(0, 40)) {
      const p = partidoDe(s);
      for (const m of detectarMomentos(p)) {
        const tipos = hechosDelMomento(p, m).map((h) => h.tipo);
        if (m.tipo !== "final") {
          expect(tipos, `${s} ${m.id}`).not.toContain("figura_del_partido");
          expect(tipos, `${s} ${m.id}`).not.toContain("resultado_final");
        } else expect(tipos).toContain("figura_del_partido");
      }
    }
  });

  it("los hechos de cierre solo aparecen en el momento final; un dominio de periodo solo con el periodo terminado", () => {
    for (const s of CORPUS.slice(0, 40)) {
      const p = partidoDe(s);
      for (const m of detectarMomentos(p)) {
        const hs = hechosDelMomento(p, m);
        if (m.tipo !== "final") expect(hs.filter((h) => HECHOS_DE_CIERRE.includes(h.tipo))).toEqual([]);
        else expect(hs.some((h) => h.tipo === "resultado_final")).toBe(true);
        const fines = p.eventos.slice(0, m.indice + 1).filter((e) => e.tipo === "fin_periodo").length;
        for (const h of hs.filter((x) => x.tipo === "dominio_periodo")) expect(Number(h.datos.periodo)).toBeLessThanOrEqual(fines);
      }
    }
  });
});

describe("008 · sin clarividencia (la propiedad estrella)", () => {
  it("corpus 1..100 con stub: ninguna update cita un evento futuro ni un número del futuro", async () => {
    const llm = crearLlmStub();
    let total = 0;
    const todas: string[] = [];
    for (const s of CORPUS) {
      const p = partidoDe(s);
      const us = await generarUpdates(p, { llm });
      total += us.length;
      for (const u of us) todas.push(...violaciones(p, u).map((v) => `seed ${s} · ${v}`));
    }
    expect(todas).toEqual([]);
    expect(total).toBeGreaterThan(300); // el corpus de verdad recorrió los momentos (no pasó vacío)
  });

  it("corpus 1..100, «mi equipo» (local y visita): tampoco", async () => {
    const llm = crearLlmStub();
    const todas: string[] = [];
    for (const s of CORPUS.slice(0, 30)) {
      const p = partidoDe(s);
      for (const modo of ["equipo:local", "equipo:visita"] as ModoPersonalizacion[]) {
        for (const u of await generarUpdates(p, { llm, modoPersonalizacion: modo })) todas.push(...violaciones(p, u).map((v) => `seed ${s} ${modo} · ${v}`));
      }
    }
    expect(todas).toEqual([]);
  });

  it("fixture: el update del primer gol de la semilla 246 (1–0) no menciona el resultado final (4–1)", async () => {
    const p = partidoDe(246);
    const us = await generarUpdates(p, { llm: crearLlmStub() });
    const primero = us[0]!;
    expect(primero.momento.tipo).toBe("gol");
    const f = marcadorFinal(p);
    const texto = primero.oraciones.map((o) => `${o.texto_es} ${o.texto_en}`).join(" ");
    expect(texto).toContain("1–0");
    expect(texto).not.toContain(`${f.local}–${f.visita}`);
    expect(primero.hechos.some((h) => h.tipo === "resultado_final")).toBe(false);
  });

  it("fixture: la expulsión de la 246 cuenta lo que pasó DESPUÉS solo hasta su minuto (el análisis del partido entero diría otra cosa)", async () => {
    const p = partidoDe(246);
    const roja = (await generarUpdates(p, { llm: crearLlmStub() })).find((u) => u.momento.tipo === "roja")!;
    const delPartidoEntero = analizar(p).find((h) => h.tipo === "expulsion_y_efecto")!;
    expect(roja.oraciones[0]!.texto_es).not.toBe(delPartidoEntero.texto_es);
    expect(violaciones(p, roja)).toEqual([]);
    // Y el oráculo SÍ detecta la clarividencia por los hechos: si al Cronista se le diera el
    // hecho del partido entero, (a) lo marca. (Ojo: el chequeo de números SOLO no alcanza aquí:
    // «marcó 1 y 0» usa cifras que el prefijo también conoce. Por eso el oráculo compara hechos.)
    const conHechoFuturo: UpdateVerificada = { ...roja, hechos: roja.hechos.map((h) => (h.tipo === "expulsion_y_efecto" ? { ...delPartidoEntero, id: h.id } : h)) };
    expect(violaciones(p, conHechoFuturo).length).toBeGreaterThan(0);
    expect(roja.oraciones[0]!.texto_es).toBe(roja.hechos.find((h) => h.tipo === "expulsion_y_efecto")!.texto_es);
  });

  it("F1: la update de la roja de la 246 no hace balance posterior (al 67' cae gol): quién, motivo, minuto y marcador del momento", async () => {
    const p = partidoDe(246);
    const roja = (await generarUpdates(p, { llm: crearLlmStub() })).find((u) => u.momento.tipo === "roja")!;
    const o = roja.oraciones[0]!;
    expect(o.texto_en).not.toMatch(/afterwards/i);
    expect(o.texto_es).not.toMatch(/después/i);
    expect(o.texto_en).toContain(`minute ${roja.momento.minuto}`);
    expect(o.texto_en).toContain("3–1");
    const h = roja.hechos.find((x) => x.id === o.hecho)!;
    for (const k of CAMPOS_DE_EFECTO) expect(h.datos).not.toHaveProperty(k);
    // Y la evidencia no va más allá de la roja.
    const idx = new Map(p.eventos.map((e, i) => [e.id, i]));
    for (const e of h.eventos) expect(idx.get(e)!).toBeLessThanOrEqual(roja.momento.indice);
  });

  it("F1: en el momento final, la expulsión vuelve a su hecho completo del 002 (el balance ya es verdad)", async () => {
    const p = partidoDe(246);
    const fin = detectarMomentos(p).find((m) => m.tipo === "final")!;
    const h = hechosDelMomento(p, fin).find((x) => x.tipo === "expulsion_y_efecto")!;
    expect(h.texto_es).toBe(analizar(p).find((x) => x.tipo === "expulsion_y_efecto")!.texto_es);
  });

  it("F1: un hecho que no es expulsión no cambia en vivo", () => {
    const p = partidoDe(246);
    for (const h of analizar(p).filter((x) => x.tipo !== "expulsion_y_efecto")) expect(hechoEnVivo(h, p)).toEqual(h);
  });
});

describe("008 · toda update mostrada pasó V1–V8 (cronista malicioso)", () => {
  const p = partidoDe(246);
  const momento = detectarMomentos(p)[0]!; // gol del 1–0

  it("el que anuncia el futuro («terminará 7–5») en los 3 intentos: la mentira no llega; cae a la plantilla del hecho", async () => {
    const u = await generarUpdate(p, momento, { llm: llmVivoGuionado([clarividente]) });
    expect(u.modo).toBe("plantilla");
    expect(u.intentos).toBe(3);
    expect(u.audit.every((a) => a.veredicto.length > 0)).toBe(true);
    expect(u.audit[0]!.veredicto.some((m) => m.regla === "V3")).toBe(true);
    const h = hechoDeMomento(momento, u.hechos)!;
    expect(u.oraciones).toEqual([{ texto_es: h.texto_es, texto_en: h.texto_en, hecho: h.id }]);
    const texto = JSON.stringify(u.oraciones);
    expect(texto).not.toContain(FUTURO_ES.trim());
    expect(texto).not.toContain(FUTURO_EN.trim());
    // Y en el overlay (lo que ve el ticker y el estudio) tampoco.
    const ov = construirOverlay({ seed: 246, llm: "x", modo: "neutral", local: "a", visita: "b" }, [u], p.eventos.map((e) => e.id));
    expect(JSON.stringify(ov)).not.toContain("7–5");
    expect(ov.actualizaciones[0]!.verificacion).toBe("plantilla");
  });

  it("corrige a la segunda: el reintento recibe feedback y la update sale del Cronista (modo llm, 2 intentos)", async () => {
    const llm = llmVivoGuionado([clarividente, "ok"]);
    const u = await generarUpdate(p, momento, { llm });
    expect(u.modo).toBe("llm");
    expect(u.intentos).toBe(2);
    expect(u.audit[0]!.feedback).toBeTruthy();
    expect(llm.llamadas[1]!.length).toBe(3); // user, assistant (la mentira), user (feedback)
  });

  it.each([
    ["cita un hecho futuro (ID fuera del prefijo)", citaFutura, "V2"],
    ["narra primero otro hecho", otroHechoPrimero, "V5"],
    ["update demasiado larga", demasiadoLarga, "V1"],
    ["salida que no es JSON", noJson, "V1"],
  ] as const)("%s: rechazada (%s) y cae a plantilla", async (_n, corruptor, regla) => {
    const u = await generarUpdate(p, momento, { llm: llmVivoGuionado([corruptor]) });
    expect(u.modo).toBe("plantilla");
    expect(u.audit[0]!.veredicto.map((m) => m.regla)).toContain(regla);
    expect(verificarOracionesUpdate(u.oraciones, u.hechos, { config: p.config, eventos: p.eventos.slice(0, momento.indice + 1) }, hechoDeMomento(momento, u.hechos)!.id)).toEqual([]);
  });

  it.each(MENTIRAS_BALANCE.map((m) => [m.nombre, m] as const))(
    "F1 · batería del balance posterior «%s»: toda roja del corpus 1..100 la rechaza con V7 y cae a plantilla",
    async (_n, mentira) => {
      let rojas = 0;
      for (const s of CORPUS) {
        const pp = partidoDe(s);
        for (const m of detectarMomentos(pp).filter((x) => x.tipo === "roja")) {
          rojas++;
          const u = await generarUpdate(pp, m, { llm: llmVivoGuionado([balancePosterior(mentira, pp.config.local.nombre, pp.config.visita.nombre)]) });
          const v7 = u.audit[0]!.veredicto.filter((x) => x.regla === "V7" && x.detalle.startsWith("balance posterior"));
          expect(v7.length, `seed ${s} ${m.id}`).toBeGreaterThan(0);
          expect(u.modo).toBe("plantilla");
          expect(JSON.stringify(u.oraciones)).not.toMatch(/afterwards|después|since then|desde entonces|rest of the match|resto del partido|until the end|hasta el final/i);
        }
      }
      expect(rojas).toBeGreaterThan(5);
    },
  );

  it("un error del LLM cuenta como intento fallido; si se agotan, plantilla (nunca lanza)", async () => {
    const u = await generarUpdate(p, momento, { llm: llmVivoGuionado([new Error("red")]) });
    expect(u.modo).toBe("plantilla");
    expect(u.audit[0]!.veredicto[0]!.detalle).toContain("red");
  });

  it("ensayo: el primer intento trae la cifra inventada, el Verificador la rechaza y el segundo pasa", async () => {
    const us = await generarUpdates(p, { llm: crearLlmEnsayo() });
    for (const u of us) {
      expect(u.modo).toBe("llm");
      expect(u.intentos).toBe(2);
      expect(u.audit[0]!.oraciones[0]!.texto_es).toContain(String(CIFRA_ENSAYO));
      expect(u.oraciones[0]!.texto_es).not.toContain(String(CIFRA_ENSAYO));
    }
  });

  it("la regla de longitud sale de umbrales (máximo MAX_ORACIONES_UPDATE oraciones)", async () => {
    const dos = llmVivoGuionado([
      (u, { hechos, hechoMomento }) => {
        const otro = hechos.find((h) => h.id !== hechoMomento)!;
        return { oraciones: [...u.oraciones, { texto_es: otro.texto_es, texto_en: otro.texto_en, hecho: otro.id }].slice(0, MAX_ORACIONES_UPDATE) };
      },
    ]);
    const u = await generarUpdate(p, momento, { llm: dos });
    expect(u.modo).toBe("llm");
    expect(u.oraciones).toHaveLength(MAX_ORACIONES_UPDATE);
  });
});

describe("008 · determinismo", () => {
  it("mismo seed ⇒ mismos momentos y mismas updates (stub y ensayo)", async () => {
    for (const s of [7, 42, 246, 1999]) {
      const a = await generarUpdates(partidoDe(s), { llm: crearLlmStub() });
      const b = await generarUpdates(partidoDe(s), { llm: crearLlmStub() });
      expect(sinDesdeCache(b)).toEqual(sinDesdeCache(a));
      const c = await generarUpdates(partidoDe(s), { llm: crearLlmEnsayo() });
      const d = await generarUpdates(partidoDe(s), { llm: crearLlmEnsayo() });
      expect(sinDesdeCache(d)).toEqual(sinDesdeCache(c));
    }
  });
});

describe("008 · overlay", () => {
  it("corpus 1..100: valida contra el esquema zod, en orden de minuto, una entrada por oración verificada, eventos ≤ minuto", async () => {
    for (const s of CORPUS) {
      const p = partidoDe(s);
      const us = await generarUpdates(p, { llm: crearLlmStub() });
      const ov = construirOverlay({ seed: s, llm: "stub", modo: "neutral", local: p.config.local.nombre, visita: p.config.visita.nombre }, us, p.eventos.map((e) => e.id));
      expect(esquemaOverlay.safeParse(JSON.parse(JSON.stringify(ov))).success).toBe(true);
      expect(ov.replay).toBe(true);
      expect(ov.actualizaciones).toHaveLength(us.reduce((n, u) => n + u.oraciones.length, 0));
      const minutoDe = new Map(p.eventos.map((e) => [e.id, e.minuto]));
      ov.actualizaciones.forEach((a, i) => {
        if (i > 0) expect(a.minuto).toBeGreaterThanOrEqual(ov.actualizaciones[i - 1]!.minuto);
        for (const e of a.eventos) expect(minutoDe.get(e)!).toBeLessThanOrEqual(a.minuto);
      });
      // Coincide con las updates (la UI pinta este mismo JSON).
      const planas = us.flatMap((u) => u.oraciones.map((o) => ({ minuto: u.momento.minuto, texto_es: o.texto_es, texto_en: o.texto_en, hecho: o.hecho })));
      expect(ov.actualizaciones.map(({ minuto, texto_es, texto_en, hecho }) => ({ minuto, texto_es, texto_en, hecho }))).toEqual(planas);
    }
  });

  it("el esquema rechaza un overlay desordenado o sin el rótulo de replay", () => {
    const base = { seed: 1, replay: true, llm: "stub", modo: "neutral", local: "a", visita: "b" };
    const e = (minuto: number) => ({ minuto, texto_es: "x", texto_en: "x", hecho: "h1", eventos: ["e001"], momento: "gol-e001", tipo: "gol", verificacion: "llm", intentos: 1 });
    expect(esquemaOverlay.safeParse({ ...base, actualizaciones: [e(10), e(20)] }).success).toBe(true);
    expect(esquemaOverlay.safeParse({ ...base, actualizaciones: [e(20), e(10)] }).success).toBe(false);
    expect(esquemaOverlay.safeParse({ ...base, replay: false, actualizaciones: [] }).success).toBe(false);
    expect(esquemaOverlay.safeParse({ ...base, actualizaciones: [{ ...e(1), eventos: [] }] }).success).toBe(false);
  });
});

describe("008 · caché por (seed, momento, deployment, modo)", () => {
  it("la segunda corrida sale de la caché: cero llamadas al LLM, mismas updates", async () => {
    const { cache } = cacheTemporal();
    const p = partidoDe(246);
    const l1 = contador(crearLlmEnsayo());
    const a = await generarUpdates(p, { llm: l1, cache });
    expect(l1.n).toBeGreaterThan(0);
    const l2 = contador(crearLlmEnsayo());
    const b = await generarUpdates(p, { llm: l2, cache });
    expect(l2.n).toBe(0);
    expect(b.every((u) => u.desdeCache)).toBe(true);
    expect(sinDesdeCache(b)).toEqual(sinDesdeCache(a));
  });

  it("un archivo por momento; deployment y modo separan entradas", async () => {
    const { dir, cache } = cacheTemporal();
    const p = partidoDe(246);
    await generarUpdates(p, { llm: crearLlmStub(), cache });
    const n = detectarMomentos(p).length;
    expect(readdirSync(dir).filter((f) => f.endsWith(".json"))).toHaveLength(n);
    const l = contador(crearLlmStub());
    await generarUpdates(p, { llm: l, cache, modoPersonalizacion: "equipo:local" });
    expect(l.n).toBe(n);
    const e = contador(crearLlmEnsayo());
    await generarUpdates(p, { llm: e, cache });
    expect(e.n).toBeGreaterThan(0);
  });

  it("una entrada manipulada (la mentira del futuro escrita en disco) no se sirve: se regenera", async () => {
    const { dir, cache } = cacheTemporal();
    const p = partidoDe(246);
    const m = detectarMomentos(p)[0]!;
    await generarUpdate(p, m, { llm: crearLlmStub(), cache });
    const ruta = join(dir, nombreArchivoUpdate({ seed: 246, momento: m.id, deployment: "stub", modo: "neutral" }));
    const entrada = JSON.parse(readFileSync(ruta, "utf8"));
    entrada.update.oraciones[0].texto_es += FUTURO_ES;
    entrada.update.oraciones[0].texto_en += FUTURO_EN;
    writeFileSync(ruta, JSON.stringify(entrada));
    const l = contador(crearLlmStub());
    const u = await generarUpdate(p, m, { llm: l, cache });
    expect(u.desdeCache).toBe(false);
    expect(l.n).toBe(1);
    expect(JSON.stringify(u.oraciones)).not.toContain("7–5");
  });

  it("si el disco falla (rename imposible), la update se sirve igual sin cachear", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cronista-vivo-"));
    const cache = crearCacheUpdates(dir, {
      renombrar: () => {
        throw new Error("EPERM");
      },
    });
    const p = partidoDe(246);
    const u = await generarUpdate(p, detectarMomentos(p)[0]!, { llm: crearLlmStub(), cache });
    expect(u.modo).toBe("llm");
    expect(readdirSync(dir)).toEqual([]);
  });
});

/** Utilidad de lectura: los hechos de un momento no cambian con la personalización (solo el orden). */
describe("008 · personalización", () => {
  it("«mi equipo» cambia el orden de los hechos, no los hechos", async () => {
    const p = partidoDe(246);
    const ids = (hs: Hecho[]) => hs.map((h) => `${h.id}|${h.texto_es}`).sort();
    const n = await generarUpdates(p, { llm: crearLlmStub() });
    const l = await generarUpdates(p, { llm: crearLlmStub(), modoPersonalizacion: "equipo:local" });
    n.forEach((u, i) => expect(ids(l[i]!.hechos)).toEqual(ids(u.hechos)));
  });
});
