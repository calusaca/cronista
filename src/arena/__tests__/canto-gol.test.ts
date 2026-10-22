// Brief 050 v1.1 · Canto de gol del narrador: hechos (goleador, equipo, marcador ≤ tick, segundos),
// situaciones, «sobre el final», autogol, números, presupuesto y lista negra. Ninguna cifra ni texto
// de CANTO_GOL se repite a mano: se leen del módulo de límites.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { ARENA, CANTO_GOL, MESA_ARENA, PRIORIDAD_EVENTO_ARENA } from "../../sim/limites";
import { RELATO_INTERVALOS } from "../protocolo";
import type { Lado } from "../../sim/tipos";
import { VOZ_BUFFER } from "../buffer";
import { expresionEvento } from "../expresion";
import { crearConfigArena, crearEstadoArena } from "../motor";
import { cantoGol, construirRelato, golTardio, marcadorHablado, marcadorTrasGol, situacionGol, type SituacionGol } from "../relato";
import type { EventoArena, RegistroArena } from "../tipos";

const leer = (ruta: string) => JSON.parse(readFileSync(ruta, "utf8")) as RegistroArena;
const fixtures = Object.fromEntries(["v1", "v2", "v3", "v4"].map(v => [v, leer(`src/arena/__fixtures__/arena-reinicios-${v}.json`)])) as Record<string, RegistroArena>;
const duelo = leer("public/experimentos/arena-duelo-v3.json");
const P = CANTO_GOL.plantillas;
const idiomas = ["es", "en"] as const;
const claves = Object.keys(P.situacion.es) as SituacionGol[];
const otro = (l: Lado): Lado => l === "local" ? "visita" : "local";
const nombreDe = (r: RegistroArena, id: string) => [...r.inicial.jugadores, ...r.inicial.banco ?? []].find(j => j.id === id)!.nombre;
const segundos = (tick: number) => Math.floor(tick * ARENA.pasoS + 1e-9);
/** Número hablado leído de las plantillas (palabra hasta numerosEnPalabrasHasta). */
const num = (n: number, idioma: "es" | "en") => n <= CANTO_GOL.numerosEnPalabrasHasta ? P.numeros[idioma][n]! : String(n);
const marcadorEsperado = (m: { local: number; visita: number }, idioma: "es" | "en") => P.marcador[idioma].replace("{local}", num(m.local, idioma)).replace("{visita}", num(m.visita, idioma));
const situacionEsperada = (clave: SituacionGol, equipo: string, idioma: "es" | "en") => (P.situacion[idioma][clave] as string).replace("{equipo}", equipo);
const hechosEsperados = (situacion: string, m: { local: number; visita: number }, tick: number, idioma: "es" | "en") =>
  P.hechos[idioma].replace("{situacion}", situacion).replace("{marcador}", marcadorEsperado(m, idioma)).replace("{segundos}", String(segundos(tick)));

/** Registro sintético sobre v3: marcador inicial `antes` y un solo gol de `lado` en `tick`. */
function conGol(lado: Lado, antes: { local: number; visita: number }, tick: number, extra: Partial<EventoArena> = {}, base = fixtures.v3!): { r: RegistroArena; gol: EventoArena } {
  const r = structuredClone(base);
  const plantilla = r.inicial.jugadores.find(j => j.lado === lado && j.puesto !== "POR")!;
  const gol: EventoArena = { ...structuredClone(base.eventos.find(e => e.tipo === "gol")!), id: `gol-sintetico-${tick}`, tick, lado, jugador: plantilla.id, ...extra };
  r.inicial.marcador = { ...antes };
  r.eventos = [gol];
  return { r, gol };
}

afterEach(() => {
  // M4: la prueba de la constante restaura el valor original.
  (CANTO_GOL as { tardioDesdeFraccion: number }).tardioDesdeFraccion = original.tardio;
});
const original = { tardio: CANTO_GOL.tardioDesdeFraccion };

describe("050 · hechos del canto", () => {
  it("goleador de `jugador` (nunca receptor ni último toque), equipo de config.partido[lado], marcador ≤ tick y segundos", () => {
    let goles = 0;
    for (const [nombre, r] of Object.entries({ ...fixtures, duelo })) {
      for (const e of r.eventos.filter(e => e.tipo === "gol")) {
        goles++;
        // Marcador contado aquí con un filtro sobre el JSON.
        const m = { ...r.inicial.marcador };
        for (const g of r.eventos.filter(g => g.tipo === "gol" && g.tick <= e.tick)) m[g.lado]++;
        expect(marcadorTrasGol(r, e.tick), nombre).toEqual(m);
        for (const idioma of idiomas) for (let v = 0; v < 4; v++) {
          const c = cantoGol(e, r, idioma, v)!;
          const goleador = nombreDe(r, e.jugador), equipo = r.config.partido[e.lado].nombre;
          expect(c.tramos.map(t => t.tipo)).toEqual(["grito", "goleador", "hechos"]);
          expect(c.tramos[0]!.texto).toBe(P.grito[idioma]);
          expect(c.tramos[1]!.texto).toBe(P.goleador[idioma][v]!.replace("{goleador}", goleador));
          const hechos = c.tramos[2]!.texto;
          expect(hechos).toContain(equipo);
          expect(hechos).toContain(`, ${marcadorEsperado(m, idioma)}, `);
          expect(hechos.endsWith(P.hechos[idioma].split("{segundos}")[0]!.split("{marcador}")[1]! + segundos(e.tick) + P.hechos[idioma].split("{segundos}")[1]!)).toBe(true);
          expect(c.texto).toBe(c.tramos.map(t => t.texto).join(" "));
        }
      }
    }
    expect(goles).toBeGreaterThanOrEqual(7);
  });

  it("M1 · con receptor y último toque de otros jugadores, el goleador sigue siendo `jugador`", () => {
    const r = structuredClone(fixtures.v3!), e = r.eventos.find(e => e.tipo === "gol")!;
    const otros = r.inicial.jugadores.filter(j => j.id !== e.jugador);
    e.receptor = otros[0]!.id; e.ultimoToque = otros[1]!.id;
    for (const idioma of idiomas) {
      const c = cantoGol(e, r, idioma, 0)!;
      expect(c.tramos[1]!.texto).toBe(P.goleador[idioma][0]!.replace("{goleador}", nombreDe(r, e.jugador)));
      expect(c.texto).not.toContain(otros[0]!.nombre); expect(c.texto).not.toContain(otros[1]!.nombre);
    }
  });

  it("M2 · un gol añadido en tick + 1 no cambia el texto del canto", () => {
    for (const r of [fixtures.v1!, fixtures.v3!, duelo]) {
      const e = r.eventos.find(e => e.tipo === "gol")!;
      const futuro = structuredClone(r);
      futuro.eventos.push({ ...structuredClone(e), id: "gol-futuro", tick: e.tick + 1, lado: otro(e.lado) });
      for (const idioma of idiomas) for (let v = 0; v < 4; v++) expect(cantoGol(e, futuro, idioma, v)!.texto).toBe(cantoGol(e, r, idioma, v)!.texto);
    }
  });

  it("los segundos son ⌊tick · pasoS⌋ (no minutos)", () => {
    for (const tick of [9, 10, 231, 239, 599]) {
      const { r, gol } = conGol("local", { local: 0, visita: 0 }, tick);
      for (const idioma of idiomas) expect(cantoGol(gol, r, idioma, 0)!.tramos[2]!.texto).toContain(` ${segundos(tick)} `);
    }
  });
});

describe("050 · situaciones del marcador", () => {
  // Marcador ANTES del gol de `lado`, construido a mano para cada clave (después = antes + 1 para `lado`).
  const g = CANTO_GOL.goleadaDesde;
  const casos: { clave: SituacionGol; lado: Lado; antes: { local: number; visita: number } }[] = [
    { clave: "empate", lado: "local", antes: { local: 0, visita: 1 } },
    { clave: "empate", lado: "visita", antes: { local: 2, visita: 1 } },
    { clave: "recorte", lado: "local", antes: { local: 0, visita: 2 } },
    { clave: "recorte", lado: "visita", antes: { local: 3, visita: 1 } },
    { clave: "goleada", lado: "local", antes: { local: g - 1, visita: 0 } },
    { clave: "goleada", lado: "visita", antes: { local: 1, visita: g } },
    { clave: "ampliacion", lado: "local", antes: { local: g - 2, visita: 0 } },
    { clave: "apertura", lado: "local", antes: { local: 0, visita: 0 } },
    { clave: "apertura", lado: "visita", antes: { local: 0, visita: 0 } },
    { clave: "ventaja", lado: "local", antes: { local: 1, visita: 1 } },
    { clave: "ventaja", lado: "visita", antes: { local: 2, visita: 2 } },
  ];

  it("tabla: cada clave con su marcador antes/después y el texto leído de CANTO_GOL.plantillas", () => {
    expect(new Set(casos.map(c => c.clave))).toEqual(new Set(claves));
    for (const { clave, lado, antes } of casos) {
      const despues = { ...antes, [lado]: antes[lado] + 1 };
      expect(situacionGol(lado, despues), `${clave} ${lado}`).toBe(clave);
      const { r, gol } = conGol(lado, antes, 50);
      for (const idioma of idiomas) {
        const equipo = r.config.partido[lado].nombre;
        expect(cantoGol(gol, r, idioma, 0)!.tramos[2]!.texto).toBe(hechosEsperados(situacionEsperada(clave, equipo, idioma), despues, 50, idioma));
      }
    }
  });

  it("orden: goleada antes que ampliación con un caso que cumple las dos; empate y recorte son excluyentes", () => {
    const antes = { local: g - 1, visita: 0 }, despues = { local: g, visita: 0 };
    expect(antes.local > antes.visita).toBe(true); // también cumple «ampliación»
    expect(situacionGol("local", despues)).toBe("goleada");
    // Un empate nunca se lee como recorte ni como ventaja.
    expect(situacionGol("visita", { local: 2, visita: 2 })).toBe("empate");
    expect(situacionGol("visita", { local: 3, visita: 2 })).toBe("recorte");
  });
});

describe("050 · «sobre el final» y expresionEvento", () => {
  const r0 = fixtures.v3!, dur = r0.config.duracionS;
  /** Primer tick con tick · pasoS ≥ fracción · duración (calculado, no escrito a mano). */
  const umbral = () => { let t = Math.floor(CANTO_GOL.tardioDesdeFraccion * dur / ARENA.pasoS) - 2; while (t * ARENA.pasoS < CANTO_GOL.tardioDesdeFraccion * dur) t++; return t; };
  const prefijo = (r: RegistroArena, gol: EventoArena, idioma: "es" | "en") => cantoGol(gol, r, idioma, 0)!.tramos[2]!.texto.startsWith(P.tardio[idioma]);
  const intensidad = (r: RegistroArena, gol: EventoArena) => expresionEvento(gol, { ...r.inicial, tick: gol.tick, marcador: marcadorTrasGol(r, gol.tick) }, null, r.config.duracionS).intensidad;

  it("en el umbral sí, un tick antes no, y con diferencia mayor que tardioDiferenciaMax tampoco; intensidad 1 en los mismos casos", () => {
    const t = umbral(), d = CANTO_GOL.tardioDiferenciaMax;
    const casos = [
      { tick: t, antes: { local: 0, visita: 0 }, aplica: true },
      { tick: t - 1, antes: { local: 0, visita: 0 }, aplica: false },
      { tick: t, antes: { local: d, visita: 0 }, aplica: false }, // diferencia d + 1 tras el gol
      { tick: t, antes: { local: 0, visita: d }, aplica: true },  // diferencia d − 1
    ];
    for (const { tick, antes, aplica } of casos) {
      const { r, gol } = conGol("local", antes, tick);
      for (const idioma of idiomas) expect(prefijo(r, gol, idioma), `${tick} ${JSON.stringify(antes)}`).toBe(aplica);
      expect(intensidad(r, gol) === 1).toBe(aplica);
      expect(golTardio(tick, dur, marcadorTrasGol(r, tick))).toBe(aplica);
    }
  });

  it("el prefijo deja la plantilla que empieza por palabra en minúscula y la del equipo intacta", () => {
    const t = umbral();
    const goleada = conGol("local", { local: CANTO_GOL.goleadaDesde - 1, visita: 0 }, t);
    // Goleada no es tardía (diferencia > tardioDiferenciaMax); con la diferencia admitida la plantilla de equipo queda igual.
    const empate = conGol("local", { local: 0, visita: 1 }, t);
    for (const idioma of idiomas) {
      expect(prefijo(goleada.r, goleada.gol, idioma)).toBe(false);
      const hechos = cantoGol(empate.gol, empate.r, idioma, 0)!.tramos[2]!.texto;
      expect(hechos.startsWith(P.tardio[idioma] + situacionEsperada("empate", empate.r.config.partido.local.nombre, idioma))).toBe(true);
    }
  });

  it("sobre los fixtures, el prefijo coincide con la intensidad 1 de expresionEvento", () => {
    for (const r of [...Object.values(fixtures), duelo]) {
      for (const e of r.eventos.filter(e => e.tipo === "gol")) {
        const estado = [...r.fotogramas].reverse().find(f => f.tick <= e.tick) ?? r.inicial;
        for (const idioma of idiomas) expect(prefijo(r, e, idioma)).toBe(expresionEvento(e, estado, null, r.config.duracionS).intensidad === 1);
      }
    }
  });

  it("M4 · expresionEvento y el prefijo leen tardioDesdeFraccion en tiempo de ejecución", () => {
    const t = Math.round(0.5 * dur / ARENA.pasoS) + 1; // mitad del partido: no tardío con el valor real
    const { r, gol } = conGol("local", { local: 0, visita: 0 }, t);
    expect(intensidad(r, gol)).not.toBe(1); expect(prefijo(r, gol, "es")).toBe(false);
    (CANTO_GOL as { tardioDesdeFraccion: number }).tardioDesdeFraccion = 0.5;
    expect(intensidad(r, gol)).toBe(1); expect(prefijo(r, gol, "es")).toBe(true); expect(prefijo(r, gol, "en")).toBe(true);
  });
});

describe("050 · autogol", () => {
  /** Autogol de un jugador de `propio`: el gol (y `lado`) es del rival. */
  const autogol = (propio: Lado, antes: { local: number; visita: number }) => {
    const base = conGol(otro(propio), antes, 120);
    const defensor = base.r.inicial.jugadores.find(j => j.lado === propio && j.puesto !== "POR")!;
    base.gol.autogol = true; base.gol.jugador = defensor.id;
    return { ...base, defensor };
  };

  it("sin grito, tipo `autogol`, goleador = jugador y el equipo es el beneficiado (`lado`)", () => {
    const { r, gol, defensor } = autogol("local", { local: 0, visita: 0 });
    for (const idioma of idiomas) {
      const c = cantoGol(gol, r, idioma, 2)!;
      expect(c.tramos.map(t => t.tipo)).toEqual(["autogol", "hechos"]);
      expect(c.tramos[0]!.texto).toBe(P.autogol[idioma].replace("{goleador}", defensor.nombre));
      expect(c.texto).not.toContain(P.grito[idioma]);
      expect(c.tramos[1]!.texto).toContain(r.config.partido.visita.nombre);
      expect(c.tramos[1]!.texto).not.toContain(r.config.partido.local.nombre);
    }
  });

  it("autogol que empata y autogol que pone por delante al rival (apertura o ventaja según el marcador previo)", () => {
    const empata = autogol("visita", { local: 0, visita: 1 }); // beneficia al local: 1–1
    const abre = autogol("local", { local: 0, visita: 0 });     // beneficia a la visita: 0–1
    const pone = autogol("local", { local: 1, visita: 1 });     // 1–2
    for (const [x, clave] of [[empata, "empate"], [abre, "apertura"], [pone, "ventaja"]] as const) {
      const despues = marcadorTrasGol(x.r, x.gol.tick);
      expect(situacionGol(x.gol.lado, despues)).toBe(clave);
      for (const idioma of idiomas) expect(cantoGol(x.gol, x.r, idioma, 0)!.tramos[1]!.texto).toBe(hechosEsperados(situacionEsperada(clave, x.r.config.partido[x.gol.lado].nombre, idioma), despues, x.gol.tick, idioma));
    }
  });

  it("un gol con motivo «desvio» canta normal (el desvío no se verbaliza)", () => {
    const { r, gol } = conGol("local", { local: 0, visita: 0 }, 80, { motivo: "desvio" });
    for (const idioma of idiomas) expect(cantoGol(gol, r, idioma, 0)!.tramos.map(t => t.tipo)).toEqual(["grito", "goleador", "hechos"]);
    // Ningún fixture tiene un gol con motivo «desvio»: el caso es sintético.
    expect([...Object.values(fixtures), duelo].flatMap(r => r.eventos).some(e => e.tipo === "gol" && e.motivo === "desvio")).toBe(false);
  });
});

describe("050 · números y orden del marcador", () => {
  it("0 → «cero»/«nil», el último en palabras → palabra, el siguiente → cifras; siempre local–visita", () => {
    const n = CANTO_GOL.numerosEnPalabrasHasta;
    for (const idioma of idiomas) {
      expect(marcadorHablado({ local: 0, visita: n }, idioma)).toBe(P.marcador[idioma].replace("{local}", P.numeros[idioma][0]!).replace("{visita}", P.numeros[idioma][n]!));
      expect(marcadorHablado({ local: n + 1, visita: 0 }, idioma)).toBe(P.marcador[idioma].replace("{local}", String(n + 1)).replace("{visita}", P.numeros[idioma][0]!));
      expect(marcadorHablado({ local: 2, visita: 0 }, idioma)).not.toBe(marcadorHablado({ local: 0, visita: 2 }, idioma));
    }
    expect(P.numeros.es[0]).toBe("cero"); expect(P.numeros.en[0]).toBe("nil");
    expect(P.numeros.es).toHaveLength(n + 1); expect(P.numeros.en).toHaveLength(n + 1);
  });
});

describe("050 · presupuesto, estructura y lista negra", () => {
  // Nombres más largos de los fixtures v1–v4 y de 20 semillas del generador.
  const plantillas = [
    ...Object.values(fixtures).map(r => ({ equipos: [r.config.partido.local.nombre, r.config.partido.visita.nombre], jugadores: [...r.inicial.jugadores, ...r.inicial.banco ?? []].map(j => j.nombre) })),
    ...Array.from({ length: 20 }, (_, i) => { const c = crearConfigArena({ seed: 5000 + i }), e = crearEstadoArena(c); return { equipos: [c.partido.local.nombre, c.partido.visita.nombre], jugadores: [...e.jugadores, ...e.banco ?? []].map(j => j.nombre) }; }),
  ];
  const masLargo = (xs: string[]) => xs.reduce((a, b) => b.length > a.length ? b : a);
  const equipo = masLargo(plantillas.flatMap(p => p.equipos)), jugador = masLargo(plantillas.flatMap(p => p.jugadores));
  /** Todos los cantos: 4 variantes × marcadores 0..12 × lado × tardío × autogol × ES/EN, con los nombres más largos. */
  function todos() {
    const r = structuredClone(fixtures.v3!);
    r.config.duracionS = ARENA.duracionMaxS; r.config.partido.local.nombre = equipo; r.config.partido.visita.nombre = equipo;
    r.inicial.jugadores[1]!.nombre = jugador; r.inicial.jugadores[12]!.nombre = jugador;
    const fin = Math.round(ARENA.duracionMaxS / ARENA.pasoS) - 1, temprano = Math.floor(CANTO_GOL.tardioDesdeFraccion * ARENA.duracionMaxS / ARENA.pasoS) - 1;
    const salida: { idioma: "es" | "en"; situacion: SituacionGol; tardio: boolean; texto: string; hechos: string; tipos: string[] }[] = [];
    for (const lado of ["local", "visita"] as const) for (let l = 0; l <= 12; l++) for (let v = 0; v <= 12; v++) {
      const antes = { local: l, visita: v }, despues = { ...antes, [lado]: antes[lado] + 1 };
      for (const tick of [fin, temprano]) for (const autogol of [false, true]) {
        const jugadorId = r.inicial.jugadores[lado === "local" ? (autogol ? 12 : 1) : (autogol ? 1 : 12)]!.id;
        const x = structuredClone(r); x.inicial.marcador = antes;
        const gol = { ...structuredClone(fixtures.v3!.eventos.find(e => e.tipo === "gol")!), id: "g", tick, lado, jugador: jugadorId, ...autogol ? { autogol: true } : {} };
        x.eventos = [gol];
        for (const idioma of idiomas) for (let k = 0; k < 4; k++) {
          const c = cantoGol(gol, x, idioma, k)!;
          salida.push({ idioma, situacion: situacionGol(lado, despues), tardio: golTardio(tick, x.config.duracionS, despues), texto: c.texto, hechos: c.tramos.at(-1)!.texto, tipos: c.tramos.map(t => t.tipo) });
        }
      }
    }
    return salida;
  }
  const cantos = todos();

  it("todas las combinaciones con los nombres más largos caben en maxCaracteres; la estimación queda bajo duracionMaxS", () => {
    expect(new Set(cantos.map(c => c.situacion))).toEqual(new Set(claves));
    expect(cantos.some(c => c.tardio)).toBe(true); expect(cantos.some(c => !c.tardio)).toBe(true);
    const largo = Math.max(...cantos.map(c => c.texto.length));
    expect(largo).toBeLessThanOrEqual(CANTO_GOL.maxCaracteres);
    expect(CANTO_GOL.maxCaracteres / MESA_ARENA.dialogo.caracteresPorSegundoVoz + CANTO_GOL.pausaFinalMs / 1000).toBeLessThan(VOZ_BUFFER.duracionMaxS);
  });

  it("M12 · ningún tramo de hechos dice nada sobre el resultado final", () => {
    const prohibidas = ["gana", "victoria", "winner", "decisivo", "wins", "triunfo"];
    for (const c of cantos) for (const p of prohibidas) expect(c.hechos.toLowerCase(), c.hechos).not.toContain(p);
  });

  it("texto === tramos unidos en todo fragmento con canto; ES y EN con la misma estructura", () => {
    for (const r of [...Object.values(fixtures), duelo]) {
      const fin = r.final.tick;
      for (const modo of ["completo", "vivo"] as const) {
        const paso = RELATO_INTERVALOS[modo], ventanas = Array.from({ length: Math.ceil(fin / paso) }, (_, k) => [k * paso, Math.min((k + 1) * paso, fin)] as const);
        const porIdioma = idiomas.map(idioma => ventanas.flatMap(([d, h]) => construirRelato(r, d, h, modo, idioma).fragmentos.filter(f => f.canto)));
        expect(porIdioma[0]!.length).toBe(r.eventos.filter(e => e.tipo === "gol").length);
        expect(porIdioma[0]!.map(f => f.canto!.tramos.map(t => t.tipo))).toEqual(porIdioma[1]!.map(f => f.canto!.tramos.map(t => t.tipo)));
        for (const f of porIdioma.flat()) expect(f.texto).toBe(f.canto!.tramos.map(t => t.texto).join(" "));
      }
      for (const e of r.eventos.filter(e => e.tipo === "gol")) {
        const desde = Math.floor((e.tick - 1) / RELATO_INTERVALOS.buffer) * RELATO_INTERVALOS.buffer, hasta = Math.min(desde + RELATO_INTERVALOS.buffer, fin);
        const porIdioma = idiomas.map(idioma => construirRelato(r, desde, hasta, "buffer", idioma) as ReturnType<typeof construirRelato> & { prioridad?: number; claveVoz?: string });
        for (const b of porIdioma) {
          expect(b.prioridad).toBe(PRIORIDAD_EVENTO_ARENA.gol);
          expect(b.fragmentos).toHaveLength(1);
          const f = b.fragmentos[0]!;
          expect(f.fuentes).toEqual([e.id]); expect(f.emocion).toBe("jubilo"); expect(b.claveVoz).toBe(`evento:${e.id}`);
          expect(f.texto).toBe(f.canto!.tramos.map(t => t.texto).join(" "));
        }
        expect(porIdioma[0]!.fragmentos[0]!.canto!.tramos.map(t => t.tipo)).toEqual(porIdioma[1]!.fragmentos[0]!.canto!.tramos.map(t => t.tipo));
      }
    }
  });

  it("elegirVarianteVoz: con la memoria que ya oyó la variante elegida, el canto usa otra", () => {
    const r = duelo, e = r.eventos.find(e => e.tipo === "gol")!, desde = Math.floor((e.tick - 1) / RELATO_INTERVALOS.buffer) * RELATO_INTERVALOS.buffer;
    for (const idioma of idiomas) {
      const primero = construirRelato(r, desde, desde + RELATO_INTERVALOS.buffer, "buffer", idioma).fragmentos[0]!;
      const segundo = construirRelato(r, desde, desde + RELATO_INTERVALOS.buffer, "buffer", idioma, { memoria: [{ tick: e.tick, texto: primero.texto, estado: "completa" }] }).fragmentos[0]!;
      expect(segundo.texto).not.toBe(primero.texto);
      expect(segundo.canto!.tramos[1]!.texto).not.toBe(primero.canto!.tramos[1]!.texto);
      expect(segundo.texto).toBe(segundo.canto!.tramos.map(t => t.texto).join(" "));
    }
  });

  it("límite declarado (v1.1, 2): dos goles en el mismo tramo de cinco segundos cantan solo el último, con el marcador de ambos", () => {
    const r = structuredClone(duelo), e = r.eventos.find(e => e.tipo === "gol")!, desde = Math.floor((e.tick - 1) / RELATO_INTERVALOS.buffer) * RELATO_INTERVALOS.buffer;
    const segundo: EventoArena = { ...structuredClone(e), id: "gol-mismo-tramo", tick: e.tick + 5, lado: otro(e.lado) };
    r.eventos = [...r.eventos.filter(x => x.tick <= e.tick), segundo, ...r.eventos.filter(x => x.tick > e.tick)];
    const b = construirRelato(r, desde, desde + RELATO_INTERVALOS.buffer, "buffer", "es");
    expect(b.fragmentos).toHaveLength(1);
    expect(b.fragmentos[0]!.fuentes).toEqual([segundo.id]);
    expect(b.fragmentos[0]!.texto).toContain(marcadorEsperado(marcadorTrasGol(r, segundo.tick), "es"));
  });
});
