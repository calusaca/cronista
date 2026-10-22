import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { comentarioEditorial, normalizarVoz, recordarVoz, repetidaVoz, zonaRelato, type RecuerdoVoz } from "../editorial";
import { construirRelato } from "../relato";
import { firmaEstadoVoz } from "../buffer";
import type { EventoArena, RegistroArena } from "../tipos";

const registro = JSON.parse(readFileSync("public/experimentos/arena-duelo-v3.json", "utf8")) as RegistroArena;

it("enlaza recepciones confirmadas y no convierte un pase intentado en completado", () => {
  const r = structuredClone(registro), jugadores = r.inicial.jugadores.filter(j => j.lado === "local").slice(0, 3);
  const [a, b, c] = jugadores;
  const evento = (id: string, tick: number, tipo: EventoArena["tipo"], jugador: string, receptor: string): EventoArena => ({ ...r.eventos[0]!, id, tick, tipo, lado: "local", jugador, receptor });
  r.eventos = [evento("r1", 70, "recepcion", b!.id, a!.id), evento("p1", 80, "pase", b!.id, c!.id), evento("r2", 90, "recepcion", c!.id, b!.id)];
  const texto = comentarioEditorial(r, 100, "es")!;
  expect(texto.fuentes).toEqual(["r1", "r2"]);
  for (const j of jugadores) expect(texto.texto).toContain(j.nombre);
  r.eventos.pop();
  expect(comentarioEditorial(r, 100, "es")!.texto).not.toContain(c!.nombre);
  r.eventos.splice(1, 0, { ...evento("corte", 75, "intercepcion", c!.id, a!.id), lado: "visita" });
  r.eventos.push(evento("r2", 90, "recepcion", c!.id, b!.id));
  expect(comentarioEditorial(r, 100, "es")!.texto).not.toMatch(/después|de ahí/);
});

it("la memoria de lo oído cambia la función y omite datos futuros", () => {
  const primero = comentarioEditorial(registro, 150, "es")!;
  const memoria: RecuerdoVoz[] = [{ tick: 150, texto: primero.texto, clave: primero.clave, tema: primero.tema }];
  const segundo = comentarioEditorial(registro, 150, "es", memoria)!;
  expect(segundo.clave).not.toBe(primero.clave); expect(segundo.tema).not.toBe(primero.tema);
  const prefijo = { ...registro, eventos: registro.eventos.filter(e => e.tick <= 150), fotogramas: registro.fotogramas.filter(f => f.tick <= 150) };
  expect(comentarioEditorial(prefijo, 150, "es", memoria)).toEqual(segundo);
  expect(comentarioEditorial(registro, 150, "es", [{ ...memoria[0]!, tick: 500 }])).toEqual(primero);
});

it("comenta el avance observado para ambos equipos, sin inventarlo si retroceden o pierden el balón", () => {
  for (const lado of ["local", "visita"] as const) {
    const r = structuredClone(registro), j = r.inicial.jugadores.find(j => j.lado === lado)!;
    r.eventos = [];
    r.fotogramas = Array.from({ length: 11 }, (_, i) => {
      const f = structuredClone(r.inicial); f.tick = i * 5; f.pausa = null; f.saque = null;
      f.balon.poseedor = j.id; f.balon.vuelo = null;
      const jugador = f.jugadores.find(jugador => jugador.id === j.id)!;
      jugador.posicion = { x: lado === "local" ? 40 + i : 65 - i, y: 34 }; f.balon.posicion = { ...jugador.posicion };
      return f;
    });
    expect(comentarioEditorial(r, 50, "es")!.tema).toBe("conduccion");
    const antes = comentarioEditorial(r, 50, "es")!; expect(antes.fotogramas).toEqual([0, 50]);
    r.fotogramas[5]!.balon.poseedor = null;
    for (const f of r.fotogramas) { f.jugadores.find(jugador => jugador.id === j.id)!.posicion.x = 50; f.balon.posicion.x = 50; }
    expect(comentarioEditorial(r, 50, "es")!.tema).not.toBe("conduccion");
  }
});

it("las ventanas conservan causalidad en ambos idiomas con memoria y hechos de gol", () => {
  for (const idioma of ["es", "en"] as const) {
    let memoria: RecuerdoVoz[] = [];
    for (let desde = 0; desde < 600; desde += 50) {
      const hasta = desde + 50, actual = construirRelato(registro, desde, hasta, "buffer", idioma, { memoria });
      const prefijo = { ...registro, final: registro.fotogramas.find(f => f.tick === hasta)!, eventos: registro.eventos.filter(e => e.tick <= hasta), fotogramas: registro.fotogramas.filter(f => f.tick <= hasta) };
      expect(construirRelato(prefijo, desde, hasta, "buffer", idioma, { memoria })).toEqual(actual);
      expect(actual.fuentes.every(id => registro.eventos.find(e => e.id === id)!.tick <= actual.fragmentos[0]!.tick)).toBe(true);
      if (actual.texto) memoria = recordarVoz(memoria, { tick: actual.fragmentos[0]!.tick, texto: actual.texto, ...("claveVoz" in actual ? { clave: actual.claveVoz, tema: actual.temaVoz } : {}) });
      if (registro.eventos.some(e => e.tipo === "gol" && e.tick > desde && e.tick <= hasta)) expect(actual.fragmentos[0]?.emocion).toBe("jubilo");
    }
  }
});

it("la entrada siempre describe el estado actual aunque ya se hubiera oído", () => {
  const primero = comentarioEditorial(registro, 237, "es", [], true)!;
  const memoria = [{ tick: 236, texto: primero.texto, clave: primero.clave, tema: primero.tema }];
  const entrada = construirRelato(registro, 200, 250, "buffer", "es", { entradaTick: 237, memoria });
  expect(entrada.texto).not.toMatch(/¡Gol|conectó|marcador/); expect(entrada.fragmentos[0]?.tick).toBe(237);
  expect("firmaEstado" in entrada && entrada.firmaEstado).toBe(firmaEstadoVoz(registro.fotogramas.filter(f => f.tick <= 237).at(-1)!));
});

it("ubica campo propio y rival simétricamente; una banda cambia la firma de vigencia", () => {
  const estado = structuredClone(registro.inicial); estado.balon.vuelo = null;
  estado.balon.posicion = { x: 20, y: 34 };
  expect(zonaRelato(estado, "local", true)).toBe("en campo propio");
  expect(zonaRelato(estado, "visita", true)).toBe("en campo rival");
  const firma = firmaEstadoVoz(estado); estado.balon.posicion.y = 10;
  expect(zonaRelato(estado, "local", true)).toContain("banda"); expect(firmaEstadoVoz(estado)).not.toBe(firma);
  estado.balon.posicion.x = 85; expect(zonaRelato(estado, "visita", false)).toContain("own half");
});

it("el consumidor detecta una misma idea preparada en ventanas distintas", () => {
  const memoria = [{ tick: 100, texto: "Uno recibió el balón.", clave: "secuencia:a1", tema: "secuencia" }];
  expect(repetidaVoz(memoria, { tick: 200, texto: "Ahora recibe otro.", clave: "secuencia:a2", tema: "secuencia" })).toBe(true);
  expect(repetidaVoz(memoria, { tick: 300, texto: "Otra frase.", clave: "secuencia:a1" })).toBe(true);
  expect(repetidaVoz(memoria, { tick: 300, texto: "¡UNO recibió el balón!" })).toBe(true);
  expect(repetidaVoz(memoria, { tick: 701, texto: memoria[0]!.texto, clave: "secuencia:a1" })).toBe(false);
});

it("normaliza mayúsculas, signos y tildes al comparar lo oído", () => {
  // La rotación de las reservas (nota del 22 oct, 043) tiene sus pruebas en reservas-voz.test.ts.
  expect(normalizarVoz("¡Balón!" )).toBe("balon");
});
