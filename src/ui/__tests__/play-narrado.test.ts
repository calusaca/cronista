// Brief 057 v1.1 §§ 1, 2 y 8 · Funciones puras de «Reproducir con narración»: el dueño del reloj
// (exclusión cancha muda / pista antes de registrar, preparar o reproducir), la intención de inicio
// pendiente y el motivo por la respuesta de `relato`.
import { describe, expect, it } from "vitest";
import { consumirIntencion, decisionReintento429, faseActiva, motivoRelato, transicionReloj, type FaseNarracion } from "../play-narrado";
import { PLAY_NARRADO } from "../../sim/limites";

const FASES: FaseNarracion[] = ["inactiva", "registrando", "preparando", "sonando", "pausada", "pulsar", "final", "error"];

describe("057 v1.1 § 1 · transicionReloj (tabla de § 3.1)", () => {
  it("Reproducir con el conmutador marcado: inactiva/final/error → iniciar (sin muda); registrando/preparando → detener + muda; sonando → pausar; pausada/pulsar → reanudar", () => {
    const pulsar = { tipo: "pulsar", conVoz: true } as const;
    for (const fase of ["inactiva", "final", "error"] as const) expect(transicionReloj(null, pulsar, fase), fase).toEqual({ dueno: "voz", reproduciendo: false, orden: "iniciar" });
    for (const fase of ["registrando", "preparando"] as const) expect(transicionReloj("voz", pulsar, fase), fase).toEqual({ dueno: "mudo", reproduciendo: true, orden: "detener" });
    expect(transicionReloj("voz", pulsar, "sonando")).toEqual({ dueno: "voz", reproduciendo: false, orden: "pausar" });
    for (const fase of ["pausada", "pulsar"] as const) expect(transicionReloj("voz", pulsar, fase), fase).toEqual({ dueno: "voz", reproduciendo: false, orden: "reanudar" });
  });

  it("sin conmutador: inactiva → cancha muda como hoy, sin órdenes; con la muda en marcha, Reproducir la pausa", () => {
    expect(transicionReloj(null, { tipo: "pulsar", conVoz: false }, "inactiva")).toEqual({ dueno: "mudo", reproduciendo: true, orden: null });
    for (const conVoz of [true, false]) expect(transicionReloj("mudo", { tipo: "pulsar", conVoz }, "inactiva")).toEqual({ dueno: null, reproduciendo: false, orden: null });
  });

  it("la cancha muda nunca coincide con una orden que activa la pista", () => {
    for (const dueno of ["mudo", "voz", null] as const) for (const fase of FASES) for (const conVoz of [true, false]) {
      const r = transicionReloj(dueno, { tipo: "pulsar", conVoz }, fase);
      if (r.orden === "iniciar" || r.orden === "reanudar") expect(r.reproduciendo, `${dueno} ${fase}`).toBe(false);
      if (r.reproduciendo && faseActiva(fase)) expect(r.orden, `${dueno} ${fase}`).toBe("detener");
    }
  });

  it("conmutador off: con la pista activa → detener sin arrancar la muda; inactiva → nada cambia", () => {
    for (const fase of ["registrando", "preparando", "sonando", "pausada", "pulsar"] as const) expect(transicionReloj("voz", { tipo: "conmutador-off" }, fase), fase).toEqual({ dueno: null, reproduciendo: false, orden: "detener" });
    expect(transicionReloj(null, { tipo: "conmutador-off" }, "inactiva")).toEqual({ dueno: null, reproduciendo: false, orden: null });
    expect(transicionReloj("mudo", { tipo: "conmutador-off" }, "inactiva")).toEqual({ dueno: "mudo", reproduciendo: true, orden: null });
  });

  it("«Escuchar desde el inicio» (pista activa) apaga la muda; un fallo degrada a muda solo si la voz era la dueña; el fin suelta el reloj", () => {
    expect(transicionReloj("mudo", { tipo: "pista-activa" }, "preparando")).toEqual({ dueno: "voz", reproduciendo: false, orden: null });
    expect(transicionReloj("voz", { tipo: "fallo" }, "error")).toEqual({ dueno: "mudo", reproduciendo: true, orden: null });
    expect(transicionReloj(null, { tipo: "fallo" }, "error")).toEqual({ dueno: null, reproduciendo: false, orden: null });
    expect(transicionReloj("voz", { tipo: "fin" }, "final")).toEqual({ dueno: null, reproduciendo: false, orden: null });
    expect(transicionReloj("mudo", { tipo: "fin" }, "inactiva")).toEqual({ dueno: "mudo", reproduciendo: true, orden: null });
  });
});

describe("057 v1.1 § 2 · consumirIntencion", () => {
  it("misma carga e idioma → la intención; carga o idioma distintos, o sin intención → null", () => {
    const p = { carga: 3, idioma: "en" } as const;
    expect(consumirIntencion(p, 3, "en")).toEqual(p);
    expect(consumirIntencion(p, 4, "en")).toBeNull();
    expect(consumirIntencion(p, 3, "es")).toBeNull();
    expect(consumirIntencion(null, 3, "en")).toBeNull();
  });
});

describe("057 v1.1 § 8 · motivoRelato", () => {
  it("404 → caducada; 429 → presupuesto; 503 → sin-voz; cualquier otro 4xx/5xx → red", () => {
    expect(motivoRelato(404)).toBe("caducada");
    expect(motivoRelato(429)).toBe("presupuesto");
    expect(motivoRelato(503)).toBe("sin-voz");
    for (const s of [400, 409, 500, 502]) expect(motivoRelato(s), String(s)).toBe("red");
  });
});

describe("057 § 3.1 · conmutador «Con narración» en el primer render (M17)", () => {
  it("sin voz confirmada por /herramientas (primer render, voz: false) el conmutador no existe y Reproducir es el de siempre", async () => {
    const { readFileSync } = await import("node:fs");
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { Arena } = await import("../Arena");
    const inicial = JSON.parse(readFileSync("src/arena/__fixtures__/arena-reinicios-v3.json", "utf8"));
    const html = renderToStaticMarkup(createElement(Arena, { inicial }));
    expect(html).not.toContain("arena-play-voice");
    expect(html).not.toContain("arena-play-progress");
    expect(html).not.toContain("arena-play-fallback");
    expect(html).toMatch(/<button class="btn btn-primary" aria-pressed="false">Play<\/button>/);
  });
});

describe("057 v1.3 (1) · decisionReintento429", () => {
  const max = PLAY_NARRADO.subida.reintentoMaxS;
  it("retry-after ≤ máximo: un reintento con esa espera; mayor: ocupado con minutos hacia arriba; tras el reintento, nunca otro", () => {
    expect(decisionReintento429(String(max), max, false)).toEqual({ reintentar: true, esperaS: max });
    expect(decisionReintento429(null, max, false)).toEqual({ reintentar: true, esperaS: 0 });
    expect(decisionReintento429(String(max + 1), max, false)).toEqual({ reintentar: false, minutos: 1 });
    expect(decisionReintento429("3600", max, false)).toEqual({ reintentar: false, minutos: 60 });
    expect(decisionReintento429("61", max, false)).toEqual({ reintentar: false, minutos: 2 });
    expect(decisionReintento429("1", max, true)).toEqual({ reintentar: false, minutos: 1 });
  });
});
