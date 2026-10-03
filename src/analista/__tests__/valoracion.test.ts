// Brief 009 — valoración de jugadores. Pesos importados de umbrales (U.VALORACION): ninguna
// cifra de peso se repite aquí a mano.

import { describe, expect, it } from "vitest";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Evento, Partido } from "../../sim/tipos";
import { Constructor } from "../__fixtures__/constructor";
import { analizar } from "../index";
import * as U from "../umbrales";
import { figura, notaTxt, valorar, type MotivoValoracion, type Valoracion } from "../valoracion";

const V = U.VALORACION;
const C = (x: number) => Math.round(x * 100);
const CORPUS = Array.from({ length: 300 }, (_, i) => simular(configDeSemilla(i + 1)));
const de = (vs: Valoracion[], jugador: string) => vs.find((v) => v.jugador === jugador) as Valoracion;

/** Tipo de evento que justifica cada motivo y de quién es el evento (del jugador o del rival). */
const EVENTO_DE: Record<MotivoValoracion, { tipo: Evento["tipo"]; delJugador: boolean }> = {
  gol: { tipo: "gol", delJugador: true },
  gol_dificil: { tipo: "gol", delJugador: true },
  tiro_atajado: { tipo: "tiro", delJugador: true },
  pase_clave: { tipo: "pase_clave", delJugador: true },
  corner: { tipo: "corner", delJugador: true },
  amarilla: { tipo: "tarjeta_amarilla", delJugador: true },
  roja: { tipo: "tarjeta_roja", delJugador: true },
  falta: { tipo: "falta", delJugador: true },
  fuera_de_juego: { tipo: "fuera_de_juego", delJugador: true },
  atajada: { tipo: "atajada", delJugador: false },
  xg_atajado: { tipo: "atajada", delJugador: false },
  gol_recibido: { tipo: "gol", delJugador: false },
  // Brief 020: el bonus de definición es del goleador; el autogol, del AUTOR (equipo que lo sufre: se revisa aparte).
  definicion: { tipo: "gol", delJugador: true },
  autogol: { tipo: "gol", delJugador: true },
};

/** Peso esperado de cada motivo (desde umbrales); el xG atajado depende del tiro. */
function pesoEsperado(m: MotivoValoracion, e: Evento, p: Partido): number {
  if (m === "xg_atajado") return Math.round(C(p.eventos.find((x) => x.id === e.relacionadoCon)?.xg ?? 0) * V.xg_atajado_factor);
  if (m === "definicion") return C(e.definicion === "vaselina" ? V.definicion_vaselina : V.definicion_legendaria);
  const pesos: Record<Exclude<MotivoValoracion, "xg_atajado" | "definicion">, number> = {
    gol: V.gol, gol_dificil: V.gol_dificil, tiro_atajado: V.tiro_atajado, pase_clave: V.pase_clave, corner: V.corner, amarilla: V.amarilla,
    roja: V.roja, falta: V.falta, fuera_de_juego: V.fuera_de_juego, atajada: V.atajada, gol_recibido: V.gol_recibido, autogol: V.autogol,
  };
  return C(pesos[m]);
}

describe("009 · cálculo", () => {
  it("determinismo: mismos eventos ⇒ mismas notas, byte a byte (corpus 1..300)", () => {
    for (const p of CORPUS) {
      const a = JSON.stringify(valorar(p));
      const b = JSON.stringify(valorar(simular(configDeSemilla(p.config.seed))));
      expect(b).toBe(a);
    }
  });

  it("la nota es exactamente base + suma del desglose, acotada y a un decimal; cada delta cita un evento real del jugador con el peso de umbrales", () => {
    const fallas: string[] = [];
    for (const p of CORPUS) {
      const porId = new Map(p.eventos.map((e) => [e.id, e] as const));
      for (const v of valorar(p)) {
        const total = C(V.base) + v.desglose.reduce((s, d) => s + C(d.delta), 0);
        const esperada = Math.min(V.max, Math.max(V.min, Math.round(total / 10) / 10));
        if (v.nota !== esperada) fallas.push(`${p.config.seed} ${v.jugador}: nota ${v.nota} ≠ ${esperada}`);
        if (Math.round(v.nota * 10) / 10 !== v.nota) fallas.push(`${p.config.seed} ${v.jugador}: nota sin redondear ${v.nota}`);
        for (const d of v.desglose) {
          const e = porId.get(d.evento);
          const regla = EVENTO_DE[d.motivo];
          if (!e) {
            fallas.push(`${p.config.seed} ${v.jugador}: ${d.evento} no existe`);
            continue;
          }
          if (e.tipo !== regla.tipo) fallas.push(`${p.config.seed} ${v.jugador}: ${d.motivo} cita un ${e.tipo}`);
          const ladoEv = e.autogol === true ? (e.equipo === "local" ? "visita" : "local") : e.equipo;
          if (regla.delJugador && (e.jugador !== v.jugador || ladoEv !== v.lado)) fallas.push(`${p.config.seed} ${v.jugador}: ${d.evento} no es suyo`);
          if (!regla.delJugador && (e.equipo === v.lado || v.posicion === undefined)) fallas.push(`${p.config.seed} ${v.jugador}: ${d.evento} debía ser del rival`);
          if (C(d.delta) !== pesoEsperado(d.motivo, e, p)) fallas.push(`${p.config.seed} ${v.jugador}: ${d.motivo} vale ${d.delta}`);
        }
      }
    }
    expect(fallas.slice(0, 10)).toEqual([]);
  });

  it("todo partido del corpus tiene figura (es descriptivo: sin rareza) y su hecho cita su desglose con la nota en datos", () => {
    for (const p of CORPUS) {
      const f = figura(p);
      expect(f, `seed ${p.config.seed}`).toBeDefined();
      const h = analizar(p).filter((x) => x.tipo === "figura_del_partido");
      expect(h).toHaveLength(1);
      expect(h[0]!.datos).toEqual({ jugador: f!.jugador, equipo: f!.equipo, nota: notaTxt(f!.nota) });
      expect(h[0]!.relevancia).toBe(U.RELEVANCIA.figura_del_partido);
      expect(new Set(h[0]!.eventos)).toEqual(new Set(f!.desglose.map((d) => d.evento)));
      expect(h[0]!.texto_es).toContain(notaTxt(f!.nota));
      expect(h[0]!.texto_en).toContain(notaTxt(f!.nota));
      // y es de verdad la mayor nota
      expect(Math.max(...valorar(p).map((v) => v.nota))).toBe(f!.nota);
    }
  });

  it("sin clarividencia en vivo: la valoración del prefijo solo cita eventos del prefijo, y al final coincide con la del partido", () => {
    for (const p of CORPUS.slice(0, 40)) {
      for (const k of [10, 40, 80, p.eventos.length]) {
        const pre: Partido = { config: p.config, eventos: p.eventos.slice(0, k) };
        const ids = new Set(pre.eventos.map((e) => e.id));
        for (const v of valorar(pre)) for (const d of v.desglose) expect(ids.has(d.evento)).toBe(true);
      }
      expect(valorar({ config: p.config, eventos: p.eventos.slice(0) })).toEqual(valorar(p));
    }
  });
});

describe("009 · fixtures", () => {
  it("hat-trick ⇒ figura", () => {
    const c = new Constructor().abrir();
    const goleador = c.jugador("local", 9);
    c.gol(10, "local", 9, 0.3);
    c.paseClave(20, "visita", 6);
    c.gol(30, "local", 9, 0.4);
    c.descanso();
    c.atajada(55, "visita", 8, 0.2);
    c.gol(70, "local", 9, 0.5);
    const p = c.cerrar();
    expect(figura(p)?.jugador).toBe(goleador);
    const h = analizar(p).find((x) => x.tipo === "figura_del_partido");
    expect(h?.datos.jugador).toBe(goleador);
  });

  it("un portero con 7 atajadas supera a un jugador de campo mediocre", () => {
    const c = new Constructor().abrir();
    const portero = c.jugador("local", 0);
    const mediocre = c.jugador("local", 6);
    c.paseClave(5, "local", 6);
    c.falta(12, "local", 6);
    for (let k = 0; k < 7; k++) c.atajada(15 + k * 8, "visita", 8 + (k % 3), 0.08);
    c.descanso();
    const p = c.cerrar();
    const vs = valorar(p);
    expect(de(vs, portero).nota).toBeGreaterThan(de(vs, mediocre).nota);
    expect(de(vs, portero).desglose.filter((d) => d.motivo === "atajada")).toHaveLength(7);
    expect(figura(p)?.jugador).toBe(portero);
  });

  it("el expulsado temprano queda bajo y conserva su nota al salir", () => {
    const c = new Constructor().abrir();
    const expulsado = c.jugador("visita", 3);
    c.roja(9, "visita", 3);
    c.descanso();
    c.gol(60, "local", 9);
    const p = c.cerrar();
    const v = de(valorar(p), expulsado);
    expect(v.nota).toBeLessThan(V.base);
    expect(v.nota).toBe(Math.round((C(V.base) + C(V.falta) + C(V.roja)) / 10) / 10);
    expect(v.desglose.map((d) => d.motivo)).toEqual(["falta", "roja"]);
  });

  it("un partido sin eventos de campo no tiene figura (no se inventa) y solo valora a los porteros titulares, con la base", () => {
    const c = new Constructor().abrir();
    c.descanso();
    const p = c.cerrar();
    expect(figura(p)).toBeUndefined();
    expect(analizar(p).some((h) => h.tipo === "figura_del_partido")).toBe(false);
    const vs = valorar(p);
    expect(vs.map((v) => v.posicion)).toEqual(["POR", "POR"]);
    expect(vs.every((v) => v.nota === V.base && v.desglose.length === 0)).toBe(true);
  });

  it("gol de definición difícil (xG < umbral) suma el extra; el de xG en el umbral no", () => {
    const c = new Constructor().abrir();
    const a = c.jugador("local", 9);
    const b = c.jugador("local", 10);
    c.gol(10, "local", 9, V.gol_dificil_xg_max - 0.01);
    c.gol(20, "local", 10, V.gol_dificil_xg_max);
    const vs = valorar(c.cerrar());
    expect(de(vs, a).desglose.map((d) => d.motivo)).toEqual(["gol", "gol_dificil"]);
    expect(de(vs, b).desglose.map((d) => d.motivo)).toEqual(["gol"]);
  });

  it("el portero suplente se valora desde que entra: el gol de antes es del titular, el de después del suplente", () => {
    const c = new Constructor().abrir();
    const titular = c.jugador("visita", 0);
    const suplente = c.jugador("visita", 11);
    c.gol(20, "local", 9);
    c.cambio(50, "visita", 11, 0);
    c.gol(70, "local", 9);
    const vs = valorar(c.cerrar());
    expect(de(vs, titular).desglose.map((d) => d.motivo)).toEqual(["gol_recibido"]);
    expect(de(vs, suplente).desglose.map((d) => d.motivo)).toEqual(["gol_recibido"]);
  });

  it("tras una roja al portero, nadie recibe esas atajadas (no se atribuyen al expulsado)", () => {
    const c = new Constructor().abrir();
    const portero = c.jugador("visita", 0);
    c.roja(30, "visita", 0);
    c.atajada(40, "local", 9, 0.3);
    const vs = valorar(c.cerrar());
    expect(de(vs, portero).desglose.map((d) => d.motivo)).toEqual(["falta", "roja"]);
  });

  it("la escala se acota: muchos goles ⇒ máximo; muchas faltas ⇒ mínimo", () => {
    const c = new Constructor().abrir();
    const crack = c.jugador("local", 9);
    const rudo = c.jugador("visita", 2);
    for (let k = 0; k < 10; k++) c.gol(5 + k * 4, "local", 9, 0.5);
    for (let k = 0; k < 40; k++) c.falta(50 + k, "visita", 2);
    const vs = valorar(c.cerrar());
    expect(de(vs, crack).nota).toBe(V.max);
    expect(de(vs, rudo).nota).toBe(V.min);
  });

  it("desempate de la figura: a igual nota, más delta de goles", () => {
    const c = new Constructor().abrir();
    const goleador = c.jugador("visita", 9);
    const asistidor = c.jugador("local", 5);
    // goleador: un gol fácil (+gol); asistidor: pases clave hasta igualar la misma suma.
    c.gol(10, "visita", 9, 0.5);
    const pases = Math.round(C(V.gol) / C(V.pase_clave));
    for (let k = 0; k < pases; k++) c.paseClave(20 + k, "local", 5);
    const p = c.cerrar();
    const vs = valorar(p);
    // el portero local recibió el gol: no compite
    expect(de(vs, goleador).nota).toBe(de(vs, asistidor).nota);
    expect(figura(p)?.jugador).toBe(goleador);
  });
});
