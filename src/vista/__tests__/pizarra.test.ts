// Brief 011 + 012 §F — la pizarra dibuja solo lo registrado: geometría desde los campos
// espaciales, animación que termina EXACTAMENTE en el palo registrado, caída a la pizarra
// convencional sin detalle, y (012) origen = paso de ataque inmediato, penal sin córner,
// una sola definición de «tras córner».
import { describe, expect, it } from "vitest";
import { cornerDelTiro, enBanda, proyeccionLegado } from "../../sim/espacial";
import { DESTINOS } from "../../sim/limites";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Evento, Partido } from "../../sim/tipos";
import { jugadaDelGol } from "../evidencia";
import { geometriaJugada, posicionBalon, POS_CORNER, POS_DESTINO, POS_ZONA, recorrido, UNIDADES_POR_M } from "../pizarra";

const corpus: Partido[] = Array.from({ length: 1000 }, (_, i) => simular(configDeSemilla(i + 1)));
const goles = corpus.flatMap((p) => p.eventos.filter((e) => e.tipo === "gol").map((g) => ({ p, g })));
const tiroDe = (p: Partido, g: Evento) => p.eventos.find((e) => e.id === g.relacionadoCon) as Evento;
const geoDe = (p: Partido, g: Evento) => geometriaJugada(jugadaDelGol(p.eventos, g.id), p.eventos);

function buscar(pred: (p: Partido, g: Evento) => boolean) {
  const r = goles.find(({ p, g }) => pred(p, g));
  if (!r) throw new Error("fixture: no hay un gol así en el corpus");
  return { ...r, pasos: jugadaDelGol(r.p.eventos, r.g.id) };
}

describe("011 · geometría desde los datos", () => {
  it("gol de penal ⇒ el remate está en el punto penal y no hay origen dibujado (la falta no tiene zona)", () => {
    const { p, g } = buscar((p, g) => tiroDe(p, g).penal === true);
    const geo = geoDe(p, g)!;
    expect(geo.zona).toBe("punto_penal");
    expect(geo.remate).toEqual(POS_ZONA.punto_penal);
    expect(geo.origen).toBeUndefined();
    expect(geo.destino).toBe(tiroDe(p, g).destino);
  });

  it("gol tras córner (LA definición) ⇒ origen en el banderín de la banda registrada", () => {
    const { p, g } = buscar((p, g) => cornerDelTiro(p.eventos, p.eventos.indexOf(tiroDe(p, g))) !== undefined && geoDe(p, g)?.origenRol === "corner");
    const corner = cornerDelTiro(p.eventos, p.eventos.indexOf(tiroDe(p, g)))!;
    const geo = geoDe(p, g)!;
    expect(geo.origen).toEqual(POS_CORNER[corner.banda!]);
  });

  it("gol con pase clave inmediato ⇒ el origen sale de la zona registrada del pase", () => {
    const { p, g, pasos } = buscar((p, g) => jugadaDelGol(p.eventos, g.id).filter((s) => s.rol !== "tiro" && s.rol !== "gol").pop()?.rol === "pase_clave");
    const pase = pasos.find((s) => s.rol === "pase_clave")!.evento;
    const geo = geoDe(p, g)!;
    expect(geo.origenRol).toBe("pase_clave");
    expect(geo.origen!.x).toBe(POS_ZONA[pase.zonaOrigen!].x);
  });

  it("todo gol del corpus: el remate es el punto de SU zona (la media cancha, a su distancia real) y el arco el de SU destino; máximo 3 pasos", () => {
    for (const { p, g } of goles) {
      const geo = geoDe(p, g)!;
      const t = tiroDe(p, g);
      // Brief 020: la media cancha se dibuja a su distancia REAL (más lejos que la media distancia).
      if (t.definicion === "media_cancha") {
        expect(geo.remate.y).toBeCloseTo(2 + t.distanciaM! * UNIDADES_POR_M, 6);
        expect(geo.remate.y).toBeGreaterThan(POS_ZONA.media_distancia.y);
        expect(geo.remate.y).toBeLessThan(geo.alto);
      } else expect(geo.remate).toEqual(POS_ZONA[t.zonaOrigen!]);
      expect(geo.arco).toEqual(POS_DESTINO[t.destino!]);
      expect(recorrido(geo).length).toBeLessThanOrEqual(3);
    }
  });

  it("sin detalle espacial (proyección legado) ⇒ sin geometría: la UI cae a la pizarra convencional", () => {
    const p = proyeccionLegado(goles[0]!.p);
    const g = p.eventos.find((e) => e.tipo === "gol")!;
    expect(geometriaJugada(jugadaDelGol(p.eventos, g.id), p.eventos)).toBeUndefined();
  });
});

describe("012 §F · re-conteo de pizarras en el corpus 1..1000 (aceptación del brief)", () => {
  const geos = goles.map(({ p, g }) => ({ p, g, geo: geoDe(p, g)! }));

  it("0 banderín → punto penal", () => {
    expect(geos.filter(({ geo }) => geo.origenRol === "corner" && geo.zona === "punto_penal").map(({ p, g }) => `${p.config.seed} ${g.id}`)).toEqual([]);
  });

  it("§F2: la jugada de un penal es falta → tiro → gol (nunca un córner ni un pase en los pasos)", () => {
    const penales = goles.filter(({ p, g }) => tiroDe(p, g).penal === true);
    expect(penales.length).toBeGreaterThan(0);
    for (const { p, g } of penales) {
      const roles = jugadaDelGol(p.eventos, g.id).map((s) => s.rol);
      expect(roles.filter((r) => r === "corner" || r === "pase_clave"), `${p.config.seed} ${g.id}`).toEqual([]);
    }
  });

  it("0 banderín → media distancia", () => {
    expect(geos.filter(({ geo }) => geo.origenRol === "corner" && geo.zona === "media_distancia").map(({ p, g }) => `${p.config.seed} ${g.id}`)).toEqual([]);
  });

  it("0 banderín → banda (rev 1.1: todo tiro tras córner sale del área, sin excepciones)", () => {
    expect(
      geos.filter(({ geo }) => geo.origenRol === "corner" && (geo.zona === "banda_izquierda" || geo.zona === "banda_derecha")).map(({ p, g }) => `${p.config.seed} ${g.id}`),
    ).toEqual([]);
  });

  it("0 goles fuera de la banda xG de su zona", () => {
    expect(geos.filter(({ p, g, geo }) => !enBanda(geo.zona, tiroDe(p, g).xg ?? 0)).map(({ p, g }) => `${p.config.seed} ${g.id}`)).toEqual([]);
  });

  it("pizarra y generador no divergen: el banderín se dibuja SI Y SOLO SI el tiro es «tras córner» y nada más inmediato lo precede", () => {
    for (const { p, g, geo } of geos) {
      const i = p.eventos.indexOf(tiroDe(p, g));
      if (geo.origenRol === "corner") expect(cornerDelTiro(p.eventos, i)).toBeDefined();
      if (cornerDelTiro(p.eventos, i)) expect(geo.origenRol).toBe("corner");
    }
  });

  it("si hay un pase clave entre el córner y el tiro, se dibuja el pase (el córner queda en los pasos de texto)", () => {
    const caso = goles.find(({ p, g }) => {
      const r = jugadaDelGol(p.eventos, g.id).map((s) => s.rol);
      return r.indexOf("corner") >= 0 && r.indexOf("pase_clave") > r.indexOf("corner");
    });
    if (!caso) return; // el corpus puede no tenerlo; la regla la cubre también la prueba de abajo
    expect(geoDe(caso.p, caso.g)!.origenRol).toBe("pase_clave");
  });

  it("fixture: córner → pase clave → tiro → gol dibuja el pase, no el banderín", () => {
    const { p, g } = goles.find(({ p, g }) => jugadaDelGol(p.eventos, g.id).some((s) => s.rol === "pase_clave"))!;
    const ev = JSON.parse(JSON.stringify(p.eventos)) as Evento[];
    const pi = ev.findIndex((e) => e.id === jugadaDelGol(p.eventos, g.id).find((s) => s.rol === "pase_clave")!.evento.id);
    const pase = ev[pi]!;
    // un córner del mismo equipo, en el mismo minuto, justo antes del pase
    ev.splice(pi, 0, { id: "e999", minuto: pase.minuto, tipo: "corner", equipo: pase.equipo, banda: "izquierda" });
    const geo = geometriaJugada(jugadaDelGol(ev, g.id), ev)!;
    expect(jugadaDelGol(ev, g.id).map((s) => s.rol)).toEqual(["corner", "pase_clave", "tiro", "gol"]);
    expect(geo.origenRol).toBe("pase_clave");
  });
});

describe("011 · animación conectada al dato", () => {
  it("t = 0 arranca en el primer punto registrado; t = 1 termina EXACTAMENTE en el destino registrado", () => {
    for (const { p, g } of goles.slice(0, 400)) {
      const geo = geoDe(p, g)!;
      expect(posicionBalon(geo, 0)).toEqual(recorrido(geo)[0]);
      expect(posicionBalon(geo, 1)).toEqual(POS_DESTINO[tiroDe(p, g).destino!]);
    }
  });

  it("los tres destinos terminan en puntos distintos: palo izquierdo a la izquierda, derecho a la derecha", () => {
    const base = geoDe(goles[0]!.p, goles[0]!.g)!;
    const fin = Object.fromEntries(DESTINOS.map((d) => [d, posicionBalon({ ...base, arco: POS_DESTINO[d], destino: d }, 1).x]));
    expect(fin.palo_izquierdo).toBeLessThan(fin.centro_del_arco!);
    expect(fin.palo_derecho).toBeGreaterThan(fin.centro_del_arco!);
  });

  it("a mitad de recorrido el balón está entre puntos registrados (no inventa desvíos)", () => {
    const { p, g } = goles[0]!;
    const geo = geoDe(p, g)!;
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
