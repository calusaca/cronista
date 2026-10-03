// Brief 021 — la pizarra 3D: la función pura evento → parámetros de escena. Determinista; cada
// parámetro cita su campo; el arco termina en el palo + altura REGISTRADOS; la duración sale de la
// velocidad y la distancia registradas; las fichas están donde las pone la 2D (geometría
// compartida); la definición del 020 ajusta el arco. El render no se testea por píxeles.
import { describe, expect, it } from "vitest";
import { ALTURA_DESTINO_M, CAMARA_LENTA, COMBA_M, DURACION_3D_TOLERANCIA_S, PASE_3D_S } from "../../sim/limites";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Evento, Partido } from "../../sim/tipos";
import { enMetros, escenaDelGol, puntoDelTramo, ROTULO_3D, type Escena3D } from "../escena3d";
import { jugadaDelGol } from "../evidencia";
import { geometriaJugada, POS_DESTINO } from "../pizarra";

const corpus: Partido[] = Array.from({ length: 300 }, (_, i) => simular(configDeSemilla(i + 1)));
const goles = corpus.flatMap((p) => p.eventos.filter((e) => e.tipo === "gol").map((g) => ({ p, g })));
const escenaDe = (p: Partido, g: Evento) => escenaDelGol(p.eventos, jugadaDelGol(p.eventos, g.id));
const tiroDe = (p: Partido, g: Evento) => p.eventos.find((e) => e.id === g.relacionadoCon)!;
const cerca = (a: number, b: number) => Math.abs(a - b) < 1e-9;

describe("021 · evento → parámetros de escena (pura)", () => {
  it("determinista: los mismos eventos ⇒ los mismos parámetros, byte a byte; y no muta los eventos", () => {
    for (const { p, g } of goles.slice(0, 200)) {
      const antes = JSON.stringify(p.eventos);
      const a = JSON.stringify(escenaDe(p, g));
      expect(JSON.stringify(escenaDe(simular(configDeSemilla(p.config.seed)), g))).toBe(a);
      expect(JSON.stringify(p.eventos)).toBe(antes);
    }
  });

  it("todo gol con detalle espacial tiene escena, con el rótulo honesto", () => {
    for (const { p, g } of goles) {
      const e = escenaDe(p, g)!;
      expect(e, `${p.config.seed} ${g.id}`).toBeDefined();
      expect(e.rotulo).toBe(ROTULO_3D);
      expect(e.gol).toBe(g.id);
    }
  });

  it("cada parámetro cita su campo (comba, duración, destino, fichas): nada sin fuente", () => {
    for (const { p, g } of goles) {
      const e = escenaDe(p, g) as Escena3D;
      expect(e.destino.cita).toContain("tiro.destino");
      for (const t of e.tramos) {
        expect(t.comba.cita.length).toBeGreaterThan(0);
        expect(t.duracionS.cita.length).toBeGreaterThan(0);
      }
      for (const f of e.fichas) expect(f.cita.length).toBeGreaterThan(0);
    }
  });

  it("el arco del balón termina EXACTAMENTE en el palo + altura registrados", () => {
    for (const { p, g } of goles) {
      const t = tiroDe(p, g);
      const e = escenaDe(p, g) as Escena3D;
      const ultimo = e.tramos[e.tramos.length - 1]!;
      const fin = puntoDelTramo(ultimo, 1);
      const esperado = enMetros(POS_DESTINO[t.destino!]);
      expect(cerca(fin.x, esperado.x), `${p.config.seed} ${g.id}`).toBe(true);
      expect(cerca(fin.y, ALTURA_DESTINO_M[t.altura!]), `${p.config.seed} ${g.id}`).toBe(true);
      expect(fin.z).toBe(0);
      // y el palo es el registrado: izquierdo a la izquierda (x < 0), derecho a la derecha.
      if (t.destino === "palo_izquierdo") expect(fin.x).toBeLessThan(0);
      if (t.destino === "palo_derecho") expect(fin.x).toBeGreaterThan(0);
    }
  });

  it("la duración del remate = distanciaM / velocidad (m/s) × CAMARA_LENTA (tolerancia en limites)", () => {
    for (const { p, g } of goles) {
      const t = tiroDe(p, g);
      const e = escenaDe(p, g) as Escena3D;
      const remate = e.tramos.find((x) => x.rol === "remate")!;
      const esperado = (t.distanciaM! / (t.velocidadKmh! / 3.6)) * CAMARA_LENTA;
      expect(Math.abs(remate.duracionS.valor - esperado)).toBeLessThanOrEqual(DURACION_3D_TOLERANCIA_S);
    }
    // más rápido ⇒ más corto, a igual distancia (la velocidad no se ignora)
    const { p, g } = goles.find(({ p: q, g: x }) => !tiroDe(q, x).penal)!;
    const evs = JSON.parse(JSON.stringify(p.eventos)) as Evento[];
    const t = evs.find((x) => x.id === g.relacionadoCon)!;
    const lento = escenaDelGol(evs, jugadaDelGol(evs, g.id))!.tramos.find((x) => x.rol === "remate")!.duracionS.valor;
    t.velocidadKmh = (t.velocidadKmh ?? 90) + 20;
    const rapido = escenaDelGol(evs, jugadaDelGol(evs, g.id))!.tramos.find((x) => x.rol === "remate")!.duracionS.valor;
    expect(rapido).toBeLessThan(lento);
  });

  it("las fichas están donde las pone la pizarra 2D (misma geometría, compartida) y el pase dura su convención", () => {
    for (const { p, g } of goles) {
      const pasos = jugadaDelGol(p.eventos, g.id);
      const geo = geometriaJugada(pasos, p.eventos)!;
      const e = escenaDe(p, g) as Escena3D;
      const tirador = e.fichas.find((f) => f.rol === "tirador")!;
      const r = enMetros(geo.remate);
      expect([tirador.x, tirador.z]).toEqual([r.x, r.z]);
      if (geo.origen) {
        const pase = e.tramos.find((x) => x.rol === "pase")!;
        expect(pase.duracionS.valor).toBe(PASE_3D_S);
        expect([pase.desde.x, pase.desde.z]).toEqual([enMetros(geo.origen).x, enMetros(geo.origen).z]);
      }
    }
  });

  it("la definición ajusta el arco: vaselina con comba alta; media cancha desde su distancia real; cabezazo desde la cabeza", () => {
    const de = (def: string) => goles.find(({ p, g }) => tiroDe(p, g).definicion === def);
    const vas = de("vaselina");
    if (vas) expect(escenaDe(vas.p, vas.g)!.tramos.find((x) => x.rol === "remate")!.comba.valor).toBe(COMBA_M.vaselina);
    const mc = goles.find(({ p, g }) => tiroDe(p, g).definicion === "media_cancha") ?? { p: simular(configDeSemilla(246)), g: simular(configDeSemilla(246)).eventos.find((e) => e.id === "e050")! };
    const rem = escenaDe(mc.p, mc.g)!.tramos.find((x) => x.rol === "remate")!;
    expect(rem.desde.z).toBeCloseTo(tiroDe(mc.p, mc.g).distanciaM!, 6);
    expect(rem.comba.valor).toBe(COMBA_M.media_cancha);
    const cab = de("cabezazo")!;
    expect(escenaDe(cab.p, cab.g)!.tramos.find((x) => x.rol === "remate")!.desde.y).toBeGreaterThan(1.5);
  });
});
