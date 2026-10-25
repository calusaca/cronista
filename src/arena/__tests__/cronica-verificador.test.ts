// Brief 064 § 8.1.6 · Verificador de la crónica de arena: V1–V8 sin cambios + la regla de tiempo de la arena (V3).
// Incluye la prueba de LÍMITE (pasa a propósito y queda documentada): el verificador no juzga persecuciones.
import { describe, expect, it } from "vitest";
import { borradorActa } from "../../cadena/acta";
import type { CronicaDraft, Motivo } from "../../cadena/tipos";
import type { HechoVerificable } from "../../cadena/verificador";
import { aMetros, arcoRival, conEventos, copia, ev, leerJson, registroEjemplos064 } from "../__fixtures__/cronica-064";
import { seleccionCronicaArena } from "../cronica-hechos";
import { reglasTiempoArena, verificarCronicaArena } from "../cronica-verificador";
import type { RegistroArena } from "../tipos";

function contexto(r: RegistroArena) {
  const hs = seleccionCronicaArena(r).hechos.map((h) => h.hecho);
  return { r, hs, acta: borradorActa(hs) };
}
/** Motivos de la oración que narra `hecho` con estos textos (el resto del acta intacto). */
function frase(c: ReturnType<typeof contexto>, hecho: HechoVerificable, es: string, en: string): Motivo[] {
  const draft: CronicaDraft = { ...c.acta, oraciones: c.acta.oraciones.map((o) => (o.hecho === hecho.id ? { ...o, texto_es: es, texto_en: en } : o)) };
  const i = draft.oraciones.findIndex((o) => o.hecho === hecho.id);
  return verificarCronicaArena(draft, c.hs, c.r.config.partido).filter((m) => m.oracion === i);
}
const titulo = (c: ReturnType<typeof contexto>, es: string, en: string) =>
  verificarCronicaArena({ ...c.acta, titulo_es: es, titulo_en: en }, c.hs, c.r.config.partido).filter((m) => m.oracion === -1);

const ej = contexto(registroEjemplos064());
const roja = ej.hs.find((h) => h.texto_es.startsWith("Roja"))!; // Fabio Valinera (6), 31 s
const resultado = ej.hs.find((h) => h.tipo === "resultado_final")!; // 2–1 en 60 s
const anaRuiz = ej.hs.find((h) => h.datos.jugador === "Ana Ruiz")!;

describe("064 · regla de tiempo de la arena", () => {
  it("el acta de ejemplo verifica entera", () => {
    expect(verificarCronicaArena(ej.acta, ej.hs, ej.r.config.partido)).toEqual([]);
    expect(roja.datos.segundo).toBe(31);
  });
  it("«a los 31 s» con segundo 31 pasa; con 34 falla (V3), en ES y en EN por separado", () => {
    expect(frase(ej, roja, "Roja para Fabio Valinera (6) a los 31 s.", "Red card for Fabio Valinera (6) after 31 s.")).toEqual([]);
    const es = frase(ej, roja, "Roja para Fabio Valinera (6) a los 34 s.", "Red card for Fabio Valinera (6) after 31 s.");
    expect(es.some((m) => m.regla === "V3" && /tiempo «34 s» no coincide con el segundo del hecho \(31\) \(ES\)/.test(m.detalle))).toBe(true);
    expect(es.some((m) => /\(EN\)$/.test(m.detalle) && /tiempo/.test(m.detalle))).toBe(false);
    const en = frase(ej, roja, "Roja para Fabio Valinera (6) a los 31 s.", "Red card for Fabio Valinera (6) after 34 s.");
    expect(en.some((m) => m.regla === "V3" && /tiempo «34 s».*\(EN\)/.test(m.detalle))).toBe(true);
    expect(en.some((m) => /tiempo.*\(ES\)$/.test(m.detalle))).toBe(false);
  });
  it("la regla sola detecta el segundo equivocado aunque la cifra esté en otro dato (dorsal 34)", () => {
    const h: HechoVerificable = { ...roja, datos: { ...roja.datos, dorsal: 34 } };
    const m = reglasTiempoArena({ titulo_es: "", titulo_en: "", oraciones: [{ texto_es: "Roja a los 34 s.", texto_en: "Red card after 34 s.", hecho: h.id }] }, [h]);
    expect(m.map((x) => x.regla)).toEqual(["V3", "V3"]);
  });
  it("«a los 31 segundos» / «after 31 seconds» pasan", () => {
    expect(frase(ej, roja, "Roja para Fabio Valinera (6) a los 31 segundos.", "Red card for Fabio Valinera (6) after 31 seconds.")).toEqual([]);
  });
  it("«en el segundo 31» falla (documentado: el V3 histórico lee «segundo» como el ordinal 2)", () => {
    const m = frase(ej, roja, "Roja para Fabio Valinera (6) en el segundo 31.", "Red card for Fabio Valinera (6) in second 31.");
    expect(m.some((x) => x.regla === "V3")).toBe(true);
  });
  it("«en el minuto 1» falla: la arena no tiene minutos", () => {
    const m = frase(ej, roja, "Roja para Fabio Valinera (6) en el minuto 31.", "Red card for Fabio Valinera (6) in minute 31.");
    expect(m.some((x) => x.regla === "V3" && /no en minutos \(ES\)/.test(x.detalle))).toBe(true);
    expect(m.some((x) => x.regla === "V3" && /no en minutos \(EN\)/.test(x.detalle))).toBe(true);
  });
  it("«en 60 s de juego» pasa con duracion_s del resultado", () => {
    expect(frase(ej, resultado, "Juventud Islaverde Sur ganó 2-1 en 60 s de juego.", "Juventud Islaverde Sur won 2-1 in 60 s of play.")).toEqual([]);
  });
  it("título: «… en 60 s» aceptado; «… a los 34 s» rechazado (el título solo admite duracion_s)", () => {
    expect(titulo(ej, "Juventud Islaverde Sur ganó 2-1 en 60 s", "Juventud Islaverde Sur won 2-1 in 60 s")).toEqual([]);
    const m = titulo(ej, "Juventud Islaverde Sur ganó 2-1 a los 34 s", "Juventud Islaverde Sur won 2-1 after 34 s");
    expect(m.some((x) => x.regla === "V3" && x.detalle.startsWith("título: tiempo «34 s»"))).toBe(true);
  });
});

describe("064 · V4, V8 y V3 histórico sobre hechos de arena", () => {
  it("entrenador, árbitro y nombre de modelo → V4", () => {
    const r = ej.r;
    const entrenador = r.config.entrenadores!.local.nombre;
    const arbitro = r.inicial.arbitro!.nombre;
    for (const intruso of [entrenador, arbitro, "GPT-6.1 Sol"]) {
      const m = frase(ej, roja, `Roja para Fabio Valinera (6) a los 31 s, según ${intruso}.`, `Red card for Fabio Valinera (6) after 31 s, according to ${intruso}.`);
      expect(m.some((x) => x.regla === "V4"), intruso).toBe(true);
    }
  });
  it("«desde fuera del área» pasa con el remate de fuera y falla con el a6 de v5 (de dentro, sin distancia_m)", () => {
    const base = leerJson("public/experimentos/arena-duelo-v3.json");
    const desde = aMetros("local", 28);
    const fuera = contexto(conEventos(base, [ev(100, "tiro", "local", "local-10", { desde, hasta: arcoRival("local"), distanciaM: 28.4 }), ev(105, "gol", "local", "local-10", { desde })]));
    const gF = fuera.hs.find((h) => h.tipo === "gol_anotado")!;
    const j = gF.datos.jugador;
    expect(frase(fuera, gF, `${j} marcó desde fuera del área a los 10 s.`, `${j} scored from outside the box after 10 s.`)).toEqual([]);

    const v5 = copia(leerJson("src/arena/__fixtures__/arena-reinicios-v5.json"));
    const a6 = v5.eventos.find((e) => e.id === "a6")!;
    const i = v5.eventos.findIndex((e) => e.id === "a7");
    v5.eventos[i] = { ...v5.eventos[i]!, tipo: "gol", desde: { ...a6.desde } };
    v5.final.marcador = { ...v5.inicial.marcador };
    for (const e of v5.eventos) if (e.tipo === "gol") v5.final.marcador[e.lado]++;
    const dentro = contexto(v5);
    const gD = dentro.hs.find((h) => h.tipo === "gol_anotado" && h.eventos.includes("a6"))!;
    expect(gD.datos).not.toHaveProperty("distancia_m");
    const m = frase(dentro, gD, `${gD.datos.jugador} marcó desde fuera del área a los ${gD.datos.segundo} s.`, `${gD.datos.jugador} scored from outside the box after ${gD.datos.segundo} s.`);
    expect(m.some((x) => x.regla === "V8")).toBe(true);
  });
  it("«al final del partido» → V8 (la arena no tiene minutos)", () => {
    const m = frase(ej, anaRuiz, "Gol de Ana Ruiz al final del partido.", "Goal by Ana Ruiz late on.");
    expect(m.some((x) => x.regla === "V8")).toBe(true);
  });
  it("«en el primer tiempo» → V3 (no hay periodos)", () => {
    const m = frase(ej, anaRuiz, "Gol de Ana Ruiz en el primer tiempo.", "Goal by Ana Ruiz in the first half.");
    expect(m.some((x) => x.regla === "V3")).toBe(true);
  });
  it("«goleada» con 3–0 pasa; con 2–1 falla", () => {
    const base = leerJson("public/experimentos/arena-duelo-v3.json");
    const tres = contexto(conEventos(base, [1, 2, 3].flatMap((k) => [ev(k * 100, "recuperacion", "local", "local-10"), ev(k * 100 + 2, "gol", "local", "local-10")])));
    const r3 = tres.hs.find((h) => h.tipo === "resultado_final")!;
    expect(frase(tres, r3, "Juventud Islaverde Sur ganó por goleada, 3-0.", "Juventud Islaverde Sur won by a rout, 3-0.")).toEqual([]);
    const m = frase(ej, resultado, "Juventud Islaverde Sur ganó por goleada, 2-1.", "Juventud Islaverde Sur won by a rout, 2-1.");
    expect(m.some((x) => x.regla === "V8")).toBe(true);
  });
});

describe("064 · prueba de LÍMITE (pasa a propósito, deuda D-1)", () => {
  it("«Ana Ruiz persiguió al rival hasta la línea.» con un hecho de Ana Ruiz pasa: el verificador no juzga persecuciones", () => {
    expect(frase(ej, anaRuiz, "Ana Ruiz persiguió al rival hasta la línea.", "Ana Ruiz chased the opponent to the line.")).toEqual([]);
  });
});
