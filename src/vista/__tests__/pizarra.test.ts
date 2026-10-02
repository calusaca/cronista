// Brief 011 — la pizarra dibuja solo lo registrado: geometría desde los campos espaciales,
// animación que termina EXACTAMENTE en el palo registrado, y caída a la pizarra
// convencional cuando el partido no tiene detalle (proyección legado).
import { describe, expect, it } from "vitest";
import { proyeccionLegado } from "../../sim/espacial";
import { DESTINOS } from "../../sim/limites";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Evento, Partido } from "../../sim/tipos";
import { jugadaDelGol } from "../evidencia";
import { geometriaJugada, posicionBalon, POS_CORNER, POS_DESTINO, POS_ZONA, recorrido } from "../pizarra";

const corpus: Partido[] = Array.from({ length: 300 }, (_, i) => simular(configDeSemilla(i + 1)));
const goles = corpus.flatMap((p) => p.eventos.filter((e) => e.tipo === "gol").map((g) => ({ p, g })));
const tiroDe = (p: Partido, g: Evento) => p.eventos.find((e) => e.id === g.relacionadoCon) as Evento;

function buscar(pred: (p: Partido, g: Evento) => boolean) {
  const r = goles.find(({ p, g }) => pred(p, g));
  if (!r) throw new Error("fixture: no hay un gol así en el corpus");
  return { ...r, pasos: jugadaDelGol(r.p.eventos, r.g.id) };
}

describe("011 · geometría desde los datos", () => {
  it("gol de penal ⇒ el remate está en el punto penal (dato: zonaOrigen = punto_penal)", () => {
    const { p, g, pasos } = buscar((p, g) => tiroDe(p, g).penal === true);
    const geo = geometriaJugada(pasos)!;
    expect(geo.zona).toBe("punto_penal");
    expect(geo.remate).toEqual(POS_ZONA.punto_penal);
    expect(geo.destino).toBe(tiroDe(p, g).destino);
  });

  it("gol tras córner ⇒ el origen está en el banderín de la banda registrada y el remate en el área", () => {
    const { pasos } = buscar((_p, g) => jugadaDelGol(_p.eventos, g.id).some((s) => s.rol === "corner"));
    const corner = pasos.find((s) => s.rol === "corner")!.evento;
    const geo = geometriaJugada(pasos)!;
    expect(geo.origenRol).toBe("corner");
    expect(geo.origen).toEqual(POS_CORNER[corner.banda!]);
    expect(["area_chica", "frontal_del_area"]).toContain(geo.zona);
  });

  it("gol de jugada con pase clave ⇒ el origen sale de la zona registrada del pase", () => {
    const { pasos } = buscar((p, g) => jugadaDelGol(p.eventos, g.id).some((s) => s.rol === "pase_clave"));
    const pase = pasos.find((s) => s.rol === "pase_clave")!.evento;
    const geo = geometriaJugada(pasos)!;
    expect(geo.origenRol).toBe("pase_clave");
    const z = POS_ZONA[pase.zonaOrigen!];
    expect(geo.origen!.x).toBe(z.x);
  });

  it("todo gol del corpus: el remate es el punto de SU zona y el arco el de SU destino", () => {
    for (const { p, g } of goles) {
      const geo = geometriaJugada(jugadaDelGol(p.eventos, g.id))!;
      const t = tiroDe(p, g);
      expect(geo.remate).toEqual(POS_ZONA[t.zonaOrigen!]);
      expect(geo.arco).toEqual(POS_DESTINO[t.destino!]);
      expect(recorrido(geo).length).toBeLessThanOrEqual(3);
    }
  });

  it("sin detalle espacial (proyección legado) ⇒ sin geometría: la UI cae a la pizarra convencional", () => {
    const p = proyeccionLegado(goles[0]!.p);
    const g = p.eventos.find((e) => e.tipo === "gol")!;
    expect(geometriaJugada(jugadaDelGol(p.eventos, g.id))).toBeUndefined();
  });
});

describe("011 · animación conectada al dato", () => {
  it("t = 0 arranca en el primer punto registrado; t = 1 termina EXACTAMENTE en el destino registrado", () => {
    for (const { p, g } of goles.slice(0, 200)) {
      const geo = geometriaJugada(jugadaDelGol(p.eventos, g.id))!;
      expect(posicionBalon(geo, 0)).toEqual(recorrido(geo)[0]);
      expect(posicionBalon(geo, 1)).toEqual(POS_DESTINO[tiroDe(p, g).destino!]);
    }
  });

  it("los tres destinos terminan en puntos distintos: palo izquierdo a la izquierda, derecho a la derecha", () => {
    const base = geometriaJugada(jugadaDelGol(goles[0]!.p.eventos, goles[0]!.g.id))!;
    const fin = Object.fromEntries(DESTINOS.map((d) => [d, posicionBalon({ ...base, arco: POS_DESTINO[d], destino: d }, 1).x]));
    expect(fin.palo_izquierdo).toBeLessThan(fin.centro_del_arco!);
    expect(fin.palo_derecho).toBeGreaterThan(fin.centro_del_arco!);
  });

  it("a mitad de recorrido el balón está entre puntos registrados (no inventa desvíos)", () => {
    const { p, g } = goles[0]!;
    const geo = geometriaJugada(jugadaDelGol(p.eventos, g.id))!;
    const ps = recorrido(geo);
    const m = posicionBalon(geo, 0.5);
    const xs = ps.map((q) => q.x);
    const ys = ps.map((q) => q.y);
    expect(m.x).toBeGreaterThanOrEqual(Math.min(...xs));
    expect(m.x).toBeLessThanOrEqual(Math.max(...xs));
    expect(m.y).toBeGreaterThanOrEqual(Math.min(...ys));
    expect(m.y).toBeLessThanOrEqual(Math.max(...ys));
  });
});
