import { describe, expect, it } from "vitest";
import { enCancha, micro } from "../../sim/micro";
import { simular } from "../../sim/motor";
import { configDeSemilla } from "../../sim/plantillas";
import type { Partido } from "../../sim/tipos";
import { accionesCompletas } from "../partido-completo";
import { agruparJugadas, buscarJugadas, construirRelato, exportarRelato, frasesDeJugada, nombreConDorsal, textoApoyos } from "../relato";
import { cuadroInicial, cuadrosTacticos, destinoModelado, distancia, orientar, sentidoAtaque } from "../tactica";

const p = simular(configDeSemilla(246));
const m = micro(p);
const filas = accionesCompletas(p, m);
const { jugadas, cuadros } = construirRelato(p, filas);

describe("030 · cuadros espaciales con procedencia y sin cambiar el partido", () => {
  it("la formación inicial sale de los titulares y excluye a los suplentes", () => {
    const c = cuadroInicial(p);
    expect(c.formaciones.local.esquema).toBe("4-3-3");
    expect(c.formaciones.visita.esquema).toBe("4-3-3");
    for (const lado of ["local", "visita"] as const) {
      expect(c.jugadores.filter(j => j.lado === lado).map(j => j.nombre).sort()).toEqual(p.config[lado].jugadores.slice(0, 11).map(j => j.nombre).sort());
      expect(c.formaciones[lado].porteros).toBe(1);
      expect(c.jugadores.filter(j => j.lado === lado).every(j => orientar(j.punto, lado, 1).x <= 52.5)).toBe(true);
    }
  });

  it("geometría determinista, acotada y con un cuadro por cada ID, en seis partidos", () => {
    for (const seed of [1, 7, 18, 29, 246, 999]) {
      const partido = simular(configDeSemilla(seed));
      const capa = micro(partido);
      const acciones = accionesCompletas(partido, capa);
      const antes = JSON.stringify({ partido, capa, acciones });
      const cs = cuadrosTacticos(partido, acciones);
      expect([...cs.keys()]).toEqual(acciones.map(a => a.id));
      expect(cs).toEqual(cuadrosTacticos(partido, acciones));
      for (const c of cs.values()) {
        expect(c.fuente).toBe("reconstruccion-zonal");
        for (const punto of [c.balon.desde, c.balon.hasta, ...c.antes.map(j => j.punto), ...c.jugadores.map(j => j.punto)]) {
          expect(Number.isFinite(punto.x) && Number.isFinite(punto.y)).toBe(true);
          expect(punto.x).toBeGreaterThanOrEqual(0); expect(punto.x).toBeLessThanOrEqual(105);
          expect(punto.y).toBeGreaterThanOrEqual(0); expect(punto.y).toBeLessThanOrEqual(68);
        }
      }
      expect(JSON.stringify({ partido, capa, acciones })).toBe(antes);
    }
  });

  it("el trayecto de pases y conducciones conserva los metros originales, también cerca de los bordes", () => {
    for (const a of filas) if (a.registro.capa === "micro" && ["pase", "conduccion"].includes(a.registro.evento.tipo)) {
      const c = cuadros.get(a.id)!;
      expect(distancia(c.balon.desde, c.balon.hasta)).toBeCloseTo(a.registro.evento.distanciaM!, 8);
    }
    for (const desde of [{ x: 0, y: 0 }, { x: 105, y: 68 }, { x: 52.5, y: 34 }]) for (const metros of [2, 11, 25, 55]) for (const angulo of [0, Math.PI / 4, Math.PI]) {
      expect(distancia(desde, destinoModelado(desde, metros, angulo))).toBeCloseTo(metros, 8);
    }
  });

  it("izquierda, derecha y sentido de avance se invierten con los arcos en el segundo tiempo", () => {
    expect(sentidoAtaque("local", 1)).toBe(1); expect(sentidoAtaque("visita", 1)).toBe(-1);
    expect(sentidoAtaque("local", 2)).toBe(-1); expect(sentidoAtaque("visita", 2)).toBe(1);
    expect(orientar({ x: 20, y: 12 }, "local", 2)).toEqual({ x: 85, y: 56 });
    for (const c of cuadros.values()) if (c.direccion) {
      const dx = (c.balon.hasta.x - c.balon.desde.x) * sentidoAtaque(c.equipo, c.periodo);
      expect(c.direccion).toBe(dx > 2 ? "adelante" : dx < -2 ? "atras" : "lateral");
      expect(c.cruzaMedio).toBe(orientar(c.balon.desde, c.equipo, c.periodo).x < 52.5 && orientar(c.balon.hasta, c.equipo, c.periodo).x > 52.5);
    }
  });

  it("cada apoyo modelado avanza en su propio cuadro y es un compañero activo distinto del actor y receptor", () => {
    const apoyos = [...cuadros.values()].filter(c => c.apoyos.length);
    expect(apoyos.length).toBeGreaterThan(0);
    for (const c of apoyos) for (const apoyo of c.apoyos) {
      expect(apoyo.jugador.lado).toBe(c.equipo);
      expect(apoyo.jugador.posicion).not.toBe("POR");
      expect([c.actor, c.receptor]).not.toContain(apoyo.jugador.nombre);
      expect(c.antes.find(j => j.nombre === apoyo.jugador.nombre)?.punto).toEqual(apoyo.desde);
      expect(c.jugadores.find(j => j.nombre === apoyo.jugador.nombre)?.punto).toEqual(apoyo.hasta);
      expect((apoyo.hasta.x - apoyo.desde.x) * sentidoAtaque(c.equipo, c.periodo)).toBeGreaterThan(1);
    }
  });

  it("cambios y rojas actualizan tanto los números como las líneas del dibujo", () => {
    const cfg = configDeSemilla(3);
    const sale = cfg.local.jugadores[0]!;
    const entra = cfg.local.jugadores[11]!;
    const expulsado = cfg.visita.jugadores[1]!;
    const partido: Partido = { config: cfg, eventos: [
      { id: "e001", tipo: "inicio_periodo", minuto: 0, equipo: "local" },
      { id: "e002", tipo: "cambio", minuto: 12, equipo: "local", jugador: entra.nombre, sale: sale.nombre },
      { id: "e003", tipo: "tarjeta_roja", minuto: 14, equipo: "visita", jugador: expulsado.nombre },
      { id: "e004", tipo: "fin_periodo", minuto: 45, equipo: "local" },
    ] };
    const cs = cuadrosTacticos(partido, accionesCompletas(partido, { eventos: [], posesiones: [] }));
    expect(cs.get("e001")!.jugadores.some(j => j.nombre === sale.nombre)).toBe(true);
    expect(cs.get("e001")!.jugadores.some(j => j.nombre === entra.nombre)).toBe(false);
    expect(cs.get("e002")!.jugadores.some(j => j.nombre === sale.nombre)).toBe(false);
    expect(cs.get("e002")!.jugadores.find(j => j.nombre === entra.nombre)?.dorsal).toBe(entra.dorsal);
    expect(cs.get("e003")!.formaciones.visita.esquema).toBe("3-3-3");
    expect(cs.get("e003")!.jugadores.some(j => j.nombre === expulsado.nombre)).toBe(false);
    expect(cs.get("e004")!.jugadores.map(j => j.nombre).sort()).toEqual([...enCancha(partido, 4).local, ...enCancha(partido, 4).visita].map(j => j.nombre).sort());
  });

  it("los cuadros de un prefijo no consultan futuras acciones ni cambios", () => {
    const prefijo = { config: p.config, eventos: p.eventos.filter(e => e.minuto <= 35) };
    const parcial = cuadrosTacticos(prefijo, accionesCompletas(prefijo));
    expect(parcial.size).toBeGreaterThan(0);
    for (const [id, c] of parcial) expect(c).toEqual(cuadros.get(id));
  });
});

describe("030 · narración completa, con dorsales y fuentes", () => {
  it("agrupa posesiones y cierres sin perder, duplicar ni reordenar ningún evento", () => {
    expect(jugadas.flatMap(j => j.acciones.map(a => a.id))).toEqual(filas.map(a => a.id));
    expect(new Set(jugadas.flatMap(j => j.acciones.map(a => a.id))).size).toBe(filas.length);
    for (const j of jugadas) expect(j.acciones.every(a => a.periodo === j.periodo)).toBe(true);
    const gol = filas.find(a => a.registro.evento.tipo === "gol")!;
    const j = jugadas.find(j => j.acciones.includes(gol))!;
    const idTiro = gol.registro.capa === "macro" ? gol.registro.evento.relacionadoCon : undefined;
    expect(j.acciones.map(a => a.id)).toContain(idTiro);
    expect(j.acciones.some(a => a.registro.capa === "micro")).toBe(true);
  });

  it("agrupar no modifica los arrays originales ni los registros", () => {
    const previo = JSON.stringify(filas);
    expect(agruparJugadas([])).toEqual([]);
    agruparJugadas(filas);
    expect(JSON.stringify(filas)).toBe(previo);
  });

  it("los dorsales pertenecen a las plantillas de este partido, incluidos suplentes", () => {
    for (const j of [...p.config.local.jugadores, ...p.config.visita.jugadores]) expect(nombreConDorsal(p, j.nombre, "es")).toBe(`${j.nombre} (#${j.dorsal})`);
    expect(nombreConDorsal(p, undefined, "en")).toBe("the recorded player");
  });

  it("describe el inicio sin inventar quién ejecutó un toque que el registro no identifica", () => {
    const texto = frasesDeJugada(p, jugadas[0]!, cuadros, "es", "aficionado")[0]!.texto;
    expect(texto).toContain("¡Comienza el encuentro!");
    expect(texto).toContain(p.config.local.nombre);
    expect(texto).not.toContain("#");
    expect(texto).not.toMatch(/primer toque|hacia atrás/);
  });

  it("cada acción tiene frase ES/EN, y los pases conservan autor, receptor, metros y resultado", () => {
    for (const lengua of ["es", "en"] as const) {
      const frases = jugadas.flatMap(j => frasesDeJugada(p, j, cuadros, lengua, "aficionado", "detallado"));
      expect(frases.map(f => f.accion.id)).toEqual(filas.map(a => a.id));
      for (const f of frases) {
        expect(f.texto).not.toMatch(/undefined|NaN/);
        if (f.accion.registro.capa === "micro") {
          const e = f.accion.registro.evento;
          if (e.tipo === "pase") {
            expect(f.texto).toContain(nombreConDorsal(p, e.receptor, lengua));
            expect(f.texto).toContain(`${e.distanciaM} ${lengua === "es" ? "metros" : "metres"}`);
            expect(f.texto).toContain(lengua === "es" ? (e.completado ? "El balón llega" : "El envío no llega") : (e.completado ? "The ball reaches" : "The pass does not reach"));
          }
        }
      }
    }
  });

  it("la descripción espacial y el cruce del medio son los del cuadro que se dibuja", () => {
    const frases = jugadas.flatMap(j => frasesDeJugada(p, j, cuadros, "es", "aficionado"));
    for (const f of frases) if (f.accion.registro.capa === "micro" && f.accion.registro.evento.tipo === "conduccion") {
      const q = cuadros.get(f.accion.id)!;
      expect(f.texto.includes("cruzando la línea de medio campo en el esquema")).toBe(q.cruzaMedio);
      expect(f.texto).toContain(q.direccion === "adelante" ? "hacia adelante" : q.direccion === "atras" ? "hacia atrás" : "en lateral");
    }
  });

  it("los apoyos declaran su origen simulado y solo nombran a sus jugadores modelados", () => {
    const conApoyo = [...cuadros.values()].find(c => c.apoyos.length)!;
    const sinApoyo = [...cuadros.values()].find(c => !c.apoyos.length)!;
    for (const l of ["es", "en"] as const) {
      expect(textoApoyos(sinApoyo, p, l)).toBe("");
      const texto = textoApoyos(conApoyo, p, l);
      expect(texto).toContain(l === "es" ? "pizarra simulada" : "simulated shape");
      for (const a of conApoyo.apoyos) expect(texto).toContain(nombreConDorsal(p, a.jugador.nombre, l));
    }
  });

  it("buscar receptor/jugador con o sin tildes conserva la jugada completa", () => {
    const receptor = m.eventos.find(e => e.tipo === "pase")!.receptor!;
    const consulta = receptor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const resultados = buscarJugadas(jugadas, consulta, p);
    expect(resultados.length).toBeGreaterThan(0);
    expect(resultados.every(j => j.acciones.some(a => a.registro.evento.jugador === receptor || (a.registro.capa === "micro" && [a.registro.evento.receptor, a.registro.evento.rival].includes(receptor))))).toBe(true);
    expect(buscarJugadas(jugadas, "Jugador totalmente inexistente", p)).toEqual([]);
    expect(buscarJugadas(jugadas, "", p)).toBe(jugadas);
  });

  it("la descarga bilingüe incluye todos los IDs únicos, marcador final y precisión declarada", () => {
    for (const lengua of ["es", "en"] as const) {
      const texto = exportarRelato(p, jugadas, cuadros, lengua, "aficionado");
      expect([...texto.matchAll(/^\[([^\]]+)\]/gm)].map(m => m[1])).toEqual(filas.map(a => a.id));
      expect(texto).toContain("4–1");
      expect(texto).toContain(lengua === "es" ? "reconstrucción esquemática" : "schematic reconstruction");
      expect(texto).toContain(lengua === "es" ? "sin tracking ni segundos exactos" : "without tracking or exact seconds");
    }
  });
});
