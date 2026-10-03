// Brief 025 — la jugada y la pizarra de los insólitos, y los casos que miran el smoke y el e2e
// (si el mundo cambia, esto explica por qué).
import { describe, expect, it } from "vitest";
import { analizar } from "../../analista/analista";
import { TEMPORADA_ACTUAL } from "../../analista/umbrales";
import { mundo } from "../../mundo/mundo";
import { configDePartidoLiga } from "../../mundo/temporada";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Evento, Partido } from "../../sim/tipos";
import { describirEvento } from "../../ui/textos";
import { NIVELES_PRESION } from "../../sim/limites";
import { piezasChip } from "../condiciones";
import { jugadaDelGol } from "../evidencia";
import { ligaVisible } from "../liga";
import { geometriaJugada, POS_CORNER, POS_DESTINO, POS_POSTE, recorrido } from "../pizarra";

const conIns = (s: number) => simular({ ...configDeSemilla(s), variantes: { insolitos: true } });

describe("025 · la jugada y la pizarra", () => {
  it("gol olímpico (semilla 1079): [córner, gol], del banderín registrado al palo registrado, sin remate", () => {
    const p = conIns(1079);
    const g = p.eventos.find((e) => e.definicion === "olimpico")!;
    const pasos = jugadaDelGol(p.eventos, g.id);
    expect(pasos.map((x) => x.rol)).toEqual(["corner", "gol"]);
    const c = pasos[0]!.evento;
    const geo = geometriaJugada(pasos, p.eventos)!;
    expect(geo.definicion).toBe("olimpico");
    expect(geo.remate).toEqual(POS_CORNER[c.banda!]);
    expect(geo.arco).toEqual(POS_DESTINO[g.destino!]);
    // el palo de entrada es el del lado del córner
    expect(g.destino).toBe(c.banda === "derecha" ? "palo_derecho" : "palo_izquierdo");
    // del banderín al palo, cerrándose dentro del campo (un punto de curva, no por la línea de fondo)
    const r = recorrido(geo);
    expect([r[0], r.at(-1), r.length]).toEqual([geo.remate, geo.arco, 3]);
    expect(r[1]!.y).toBeGreaterThan(Math.max(geo.remate.y, geo.arco.y));
  });

  it("tiro al palo: la jugada termina en el tiro (sin gol) y la pizarra en el poste; con dos palos, rebota al otro", () => {
    const uno = conIns(1079);
    const t1 = uno.eventos.find((e) => e.alPalo === 1)!;
    const g1 = geometriaJugada(jugadaDelGol(uno.eventos, t1.id), uno.eventos)!;
    expect(jugadaDelGol(uno.eventos, t1.id).at(-1)?.rol).toBe("tiro");
    expect([g1.palos, g1.arco]).toEqual([1, POS_POSTE[t1.destino as "palo_izquierdo" | "palo_derecho"]]);
    expect(recorrido(g1).filter((x) => x.y === POS_POSTE.palo_izquierdo.y)).toHaveLength(1);

    const dos = conIns(36);
    const t2 = dos.eventos.find((e) => e.alPalo === 2)!;
    const g2 = geometriaJugada(jugadaDelGol(dos.eventos, t2.id), dos.eventos)!;
    const tr = recorrido(g2);
    const postes = tr.filter((x) => x.y === POS_POSTE.palo_izquierdo.y);
    expect(g2.palos).toBe(2);
    expect(postes.map((x) => x.x).sort()).toEqual([POS_POSTE.palo_izquierdo.x, POS_POSTE.palo_derecho.x]);
    // el primero es el registrado
    expect(postes[0]).toEqual(POS_POSTE[t2.destino as "palo_izquierdo" | "palo_derecho"]);
    // un tiro sin palo no abre jugada
    const otro = dos.eventos.find((e) => e.tipo === "tiro" && e.alPalo === undefined)!;
    expect(jugadaDelGol(dos.eventos, otro.id)).toEqual([]);
  });

  it("subida del portero: si su córner acaba en gol, la jugada empieza por la subida (caso forzado sobre la 363)", () => {
    const p = JSON.parse(JSON.stringify(conIns(363))) as Partido;
    const k = p.eventos.findIndex((e) => e.id === "e085");
    const t = p.eventos[k] as Evento;
    const gol: Evento = { ...t, id: "e900", tipo: "gol", relacionadoCon: t.id };
    p.eventos.splice(k + 1, 0, gol);
    expect(jugadaDelGol(p.eventos, gol.id).map((x) => x.rol)).toEqual(["subida", "corner", "tiro", "gol"]);
    expect(jugadaDelGol(p.eventos, "e083").map((x) => x.rol)).toEqual(["subida", "corner", "tiro", "gol"]);
  });

  it("la tarjeta de la subida (smoke: liga-del-sol-alto 7/5, e087): subida, su córner, el remate de ese córner y su atajada", () => {
    const l = mundo().ligas.find((x) => x.id === "liga-del-sol-alto")!;
    const p = simular(configDePartidoLiga(l, TEMPORADA_ACTUAL, 7, 5));
    const pasos = jugadaDelGol(p.eventos, "e087");
    expect(pasos.map((x) => `${x.rol}:${x.evento.id}`)).toEqual(["subida:e087", "corner:e088", "tiro:e089", "atajada:e090"]);
    expect(pasos[0]!.evento.jugador).toBe("Fabio Palido");
    // la pizarra: del banderín de ESE córner al remate
    expect(geometriaJugada(pasos, p.eventos)?.origenRol).toBe("corner");
    // sin remate tras el córner, la jugada son la subida y el córner
    const q = conIns(130);
    const s = q.eventos.find((e) => e.tipo === "subida_portero")!;
    const r = jugadaDelGol(q.eventos, s.id).map((x) => x.rol);
    expect(r.slice(0, 2)).toEqual(["subida", "corner"]);
  });

  it("textos de la línea: palos, subida, interrupción; el chip de la niebla", () => {
    const dos = conIns(36).eventos.find((e) => e.alPalo === 2)!;
    expect(describirEvento(dos)).toMatch(/hit both posts!$/);
    expect(describirEvento(conIns(1079).eventos.find((e) => e.alPalo === 1)!)).toMatch(/off the post$/);
    expect(describirEvento(conIns(363).eventos.find((e) => e.tipo === "subida_portero")!)).toBe("Goalkeeper goes up for the corner · Teo Galeloya");
    expect(describirEvento(conIns(50).eventos.find((e) => e.tipo === "interrupcion")!)).toBe("Play stopped · a dog on the pitch · +2′ added");
    expect(piezasChip({ clima: "niebla", superficie: "natural", cesped: "corto", presion: { local: "baja", visita: "media" } })[0]).toBe("Fog");
  });

  it("el chip de la presión (bug del 018, delta 025): inglés siempre, nunca el valor crudo de la config", () => {
    const base = { clima: "despejado" as const, superficie: "natural" as const, cesped: "corto" as const };
    expect(piezasChip({ ...base, presion: { local: "baja", visita: "media" } })[2]).toBe("low pressure at home, medium away");
    for (const local of NIVELES_PRESION)
      for (const visita of NIVELES_PRESION) {
        const t = piezasChip({ ...base, presion: { local, visita } })[2]!;
        expect(t, `${local}/${visita}`).not.toMatch(/\b(baja|media|alta)\b/);
      }
  });
});

describe("025 · los casos del smoke y del e2e (liga visible)", () => {
  it("7/4 e071: doble palo de Teo Rosiena, con su hecho", () => {
    const p = simular(configDePartidoLiga(ligaVisible(), TEMPORADA_ACTUAL, 7, 4));
    const t = p.eventos.find((e) => e.id === "e071")!;
    expect([t.tipo, t.alPalo, t.jugador]).toEqual(["tiro", 2, "Teo Rosiena"]);
    expect(analizar(p).some((h) => h.tipo === "doble_palo" && h.datos.palos === 2 && h.eventos.includes("e071"))).toBe(true);
    expect(geometriaJugada(jugadaDelGol(p.eventos, "e071"), p.eventos)?.palos).toBe(2);
  });
});
