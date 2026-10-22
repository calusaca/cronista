// Brief 056 (v1.1–v1.2) · Previa del partido derivada del registro. Ninguna cifra de PREVIA_ARENA, ARENA ni
// MESA_ARENA se repite a mano: se leen de limites.ts. Los valores esperados se cuentan aquí sobre el JSON.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { anclas, puestos } from "../catalogo";
import { crearConfigArena, crearEstadoArena } from "../motor";
import { apellidoCorto, claveSuperficie, comprobarPrevia, esPrevia, formacionHablada, GEOMETRIA_PREVIA, previaPartido, previaVisual, proyectarPrevia } from "../previa";
import { formaciones, perfilesJugador, type RegistroArena } from "../tipos";
import { ARENA, MESA_ARENA, PREVIA_ARENA } from "../../sim/limites";
import { VOZ_BUFFER } from "../buffer";
import { comprobarTurnos } from "../dialogo";
import type { IntervencionArena, TurnoMesa } from "../protocolo";
import { relatoIntervencion } from "../relato";
import { estimarDuracionS, segmentoVozValido, varianteEfectiva } from "../turnos";
import { prepararVoz } from "../voz";

const leer = (ruta: string) => JSON.parse(readFileSync(ruta, "utf8")) as RegistroArena;
const FIXTURES = {
  "arena-reinicios-v3": leer("src/arena/__fixtures__/arena-reinicios-v3.json"),
  "arena-llm-v1": leer("public/experimentos/arena-llm-v1.json"),
  "arena-llm-v3": leer("public/experimentos/arena-llm-v3.json"),
  "arena-duelo-v3": leer("public/experimentos/arena-duelo-v3.json"),
};
/** Registro mínimo de una semilla: config + estado inicial (sin jugar). */
const registroSemilla = (seed: number): RegistroArena => {
  const config = crearConfigArena({ seed, duracionS: 60 }), inicial = crearEstadoArena(config);
  return { version: config.version!, config, inicial, rondas: [], eventos: [], fotogramas: [inicial], final: inicial };
};
const SEMILLAS = Array.from({ length: 60 }, (_, i) => 1000 + i * 7919);
const TODOS: [string, RegistroArena][] = [...Object.entries(FIXTURES), ...SEMILLAS.map(s => [`semilla ${s}`, registroSemilla(s)] as [string, RegistroArena])];
const T = PREVIA_ARENA.tarjeta;

describe("056 · constantes de la tarjeta", () => {
  it("geometría derivada (v1.2): línea de fondo propia y alto desde escalaProfundidad y los márgenes", () => {
    expect(GEOMETRIA_PREVIA.escala).toBe(T.escalaProfundidad);
    expect(GEOMETRIA_PREVIA.lineaFondo - ARENA.largoM * GEOMETRIA_PREVIA.escala).toBeCloseTo(T.margenSuperior, 9);
    expect(GEOMETRIA_PREVIA.alto - GEOMETRIA_PREVIA.lineaFondo).toBeCloseTo(T.margenInferior, 9);
    expect(GEOMETRIA_PREVIA.ancho).toBe(ARENA.anchoM);
  });
  it("toda ancla de las doce formaciones cae dentro del viewBox con su ficha y la marca de capitán", () => {
    for (const f of formaciones) for (const [puesto, p] of Object.entries(anclas(f, "local", "base"))) {
      const q = proyectarPrevia(p);
      expect(q.x - T.radioFicha, `${f} ${puesto}`).toBeGreaterThanOrEqual(0);
      expect(q.x + T.radioFicha, `${f} ${puesto}`).toBeLessThanOrEqual(ARENA.anchoM);
      expect(q.y + T.radioFicha, `${f} ${puesto}`).toBeLessThanOrEqual(GEOMETRIA_PREVIA.alto);
      // Marca «C»: rect y = -3,3 de la ficha principal, escalada.
      expect(q.y - 3.3 * T.escalaCapitan, `${f} ${puesto}`).toBeGreaterThanOrEqual(0);
    }
  });
  it("v1.2 · en las doce formaciones, cualquier par de fichas dista ≥ diámetro + separacionMinFichas", () => {
    const minimo = 2 * T.radioFicha + T.separacionMinFichas;
    for (const f of formaciones) {
      const ps = Object.entries(anclas(f, "local", "base")).map(([puesto, a]) => ({ puesto, ...proyectarPrevia(a) }));
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const d = Math.hypot(ps[i]!.x - ps[j]!.x, ps[i]!.y - ps[j]!.y);
        expect(d, `${f} ${ps[i]!.puesto}–${ps[j]!.puesto}`).toBeGreaterThanOrEqual(minimo);
      }
    }
  });
  it("textos ES/EN con las mismas claves", () => {
    for (const grupo of Object.values(PREVIA_ARENA.textos)) expect(Object.keys(grupo.en).sort()).toEqual(Object.keys(grupo.es).sort());
  });
});

describe("056 · apellidoCorto y superficie", () => {
  it("última palabra, sin truncar; una sola palabra se conserva", () => {
    expect(apellidoCorto("Nombre Apellido")).toBe("Apellido");
    expect(apellidoCorto("Nombre")).toBe("Nombre");
    expect(apellidoCorto("Germán  Breliino ")).toBe("Breliino");
    expect(apellidoCorto("Ñandú Ávila")).toBe("Ávila");
  });
  it("superficie: sintética, natural corta/alta y natural sin longitud (v1.1 § 8)", () => {
    expect(claveSuperficie({ superficie: "sintetica" })).toBe("sintetica");
    expect(claveSuperficie({ superficie: "natural", cesped: "corto" })).toBe("natural_corto");
    expect(claveSuperficie({ superficie: "natural", cesped: "alto" })).toBe("natural_alto");
    expect(claveSuperficie({ superficie: "natural" })).toBe("natural");
  });
});

describe("056 · previaVisual", () => {
  it.each(TODOS)("%s: 11 puestos por lado en el orden de puestos(formación), jugador correcto y proyección de anclas", (_, r) => {
    const p = previaVisual(r);
    for (const lado of ["local", "visita"] as const) {
      const e = p.equipos[lado], f = r.config.formaciones[lado];
      expect(e.formacion).toBe(f);
      expect(e.nombre).toBe(r.config.partido[lado].nombre);
      expect(e.puestos.map(x => x.puesto)).toEqual(puestos(f));
      const a = anclas(f, "local", "base");
      for (const x of e.puestos) {
        expect(x.jugador).toEqual(r.inicial.jugadores.find(j => j.lado === lado && j.puesto === x.puesto));
        expect(x.x).toBeCloseTo(a[x.puesto]!.y, 9);
        expect(x.y).toBeCloseTo(GEOMETRIA_PREVIA.lineaFondo - a[x.puesto]!.x * GEOMETRIA_PREVIA.escala, 9);
      }
      const once = r.inicial.jugadores.filter(j => j.lado === lado);
      expect(e.nivelMedio).toBe(Math.round(once.reduce((s, j) => s + j.nivel, 0) / once.length));
      expect(e.capitan).toEqual(once.find(j => j.capitan) ?? null);
      expect(e.banco).toEqual(r.inicial.banco?.filter(j => j.lado === lado) ?? []);
      expect(e.entrenador?.nombre ?? null).toBe(r.config.entrenadores?.[lado].nombre ?? null);
      expect([e.ataque, e.defensa, e.estilo]).toEqual([r.config.partido[lado].ataque, r.config.partido[lado].defensa, r.config.partido[lado].estilo]);
      // Perfiles: conteo desc. y, a igual n, orden de perfilesJugador.
      const n = e.perfiles.reduce((s, x) => s + x.n, 0);
      expect(n).toBe(once.filter(j => j.personalidad).length);
      for (let k = 1; k < e.perfiles.length; k++) {
        const [a1, b1] = [e.perfiles[k - 1]!, e.perfiles[k]!];
        expect(a1.n > b1.n || (a1.n === b1.n && perfilesJugador.indexOf(a1.perfil) < perfilesJugador.indexOf(b1.perfil))).toBe(true);
      }
    }
    expect(p.arbitro).toBe(r.inicial.arbitro?.nombre ?? null);
    const c = r.config.partido.condiciones;
    expect(p.condiciones).toEqual(c ? { clima: c.clima, ...(c.temperaturaC !== undefined ? { temperaturaC: c.temperaturaC } : {}), superficie: c.superficie, ...(c.cesped ? { cesped: c.cesped } : {}) } : null);
  });

  it("v1 (arena-llm-v1): sin capitán, técnico, banco, árbitro ni condiciones; perfiles vacíos", () => {
    const p = previaVisual(FIXTURES["arena-llm-v1"]);
    for (const e of Object.values(p.equipos)) {
      expect(e.capitan).toBeNull();
      expect(e.entrenador).toBeNull();
      expect(e.banco).toEqual([]);
      expect(e.perfiles).toEqual([]);
    }
    expect(p.arbitro).toBeNull();
    expect(p.condiciones).toBeNull();
  });

  it("dos jugadores en el mismo puesto o uno de menos lanzan «Alineación inconsistente»", () => {
    const r = structuredClone(FIXTURES["arena-reinicios-v3"]);
    const [a, b] = r.inicial.jugadores.filter(j => j.lado === "local");
    b!.puesto = a!.puesto;
    expect(() => previaVisual(r)).toThrow("Alineación inconsistente");
    const r2 = structuredClone(FIXTURES["arena-reinicios-v3"]);
    r2.inicial.jugadores = r2.inicial.jugadores.filter((_, i) => i !== 3);
    expect(() => previaVisual(r2)).toThrow("Alineación inconsistente");
  });

  it("es determinista y no depende de avances publicados", () => {
    const r = FIXTURES["arena-duelo-v3"];
    const prefijo: RegistroArena = { ...r, eventos: r.eventos.filter(e => e.tick <= 50), fotogramas: r.fotogramas.filter(f => f.tick <= 50), final: r.fotogramas.filter(f => f.tick <= 50).at(-1)! };
    expect(previaVisual(r)).toEqual(previaVisual(structuredClone(r)));
    expect(previaVisual(prefijo)).toEqual(previaVisual(r));
  });
});

// ——— Bloque B · Previa hablada (§ 7 y v1.1 §§ 4, 7, 8, 11, 13) ———
const PL = PREVIA_ARENA.plantillas;
const prefijoDe = (r: RegistroArena, t: number): RegistroArena => ({ ...r, eventos: r.eventos.filter(e => e.tick <= t), fotogramas: r.fotogramas.filter(f => f.tick <= t), final: r.fotogramas.filter(f => f.tick <= t).at(-1) ?? r.inicial });
const lados = ["local", "visita"] as const;
const datosDe = (i: IntervencionArena, id: string) => i.hechos.find(h => h.id === id)?.datos;
/** Fuente esperada de cada hecho (tabla de v1.1 § 7). */
const FUENTE: Record<string, string> = { equipo: "config.partido", formacion: "config.formaciones", capitan: "inicial.jugadores", nivel: "inicial.jugadores", entrenador: "config.entrenadores", arbitro: "inicial.arbitro", condiciones: "config.partido.condiciones", perfiles: "config.partido" };
const fuenteEsperada = (hecho: string) => FUENTE[hecho.split(":")[1]!]!;
const textoVariante = (turnos: readonly TurnoMesa[], idioma: "es" | "en") => turnos.map(t => idioma === "es" ? t.texto_es : t.texto_en).join(" ");
/** Registro con nombres al máximo admitido (motor.ts: club 100, personas 80) y caracteres XML. */
const registroLargo = (): RegistroArena => {
  const r = structuredClone(FIXTURES["arena-reinicios-v3"]);
  const persona = (prefijo: string) => { const base = `${prefijo} & <Lía> "Q" 'O' `; return base + "Z".repeat(80 - base.length); };
  r.config.partido.local.nombre = ("Club Atlético " + "Ñ".repeat(100)).slice(0, 100);
  r.config.partido.visita.nombre = ("Unión Deportiva " + "Á".repeat(100)).slice(0, 100);
  for (const lado of lados) {
    r.inicial.jugadores.find(j => j.lado === lado && j.capitan)!.nombre = persona(`Capitana ${lado}`);
    r.config.entrenadores![lado].nombre = persona(`Técnica ${lado}`);
  }
  r.inicial.arbitro!.nombre = persona("Árbitra");
  return r;
};

describe("056 · previaPartido: determinismo y procedencia", () => {
  it.each(TODOS)("%s: igual en dos llamadas y tras avances (prefijo recortado y completo); cada valor sale del registro", (_, r) => {
    const p = previaPartido(r);
    expect(previaPartido(structuredClone(r))).toEqual(p);
    expect(previaPartido(prefijoDe(r, Math.min(50, r.final.tick)))).toEqual(p);
    expect(p.map(i => i.id)).toEqual(PREVIA_ARENA.piezas.map((c, k) => `previa:${k + 1}-${c}:0`));
    lados.forEach((lado, k) => {
      const i = p[k]!, capitan = r.inicial.jugadores.find(j => j.lado === lado && j.capitan), e = r.config.entrenadores?.[lado];
      const once = r.inicial.jugadores.filter(j => j.lado === lado);
      expect(datosDe(i, `previa:formacion:${lado}`)?.formacion).toBe(r.config.formaciones[lado]);
      expect(datosDe(i, `previa:equipo:${lado}`)?.equipo).toBe(r.config.partido[lado].nombre);
      expect(datosDe(i, `previa:capitan:${lado}`)?.capitan).toBe(capitan?.nombre);
      expect(datosDe(i, `previa:entrenador:${lado}`)?.entrenador).toBe(e?.nombre);
      expect(datosDe(i, `previa:entrenador:${lado}`)?.perfil).toBe(e?.perfil);
      expect(datosDe(i, `previa:nivel:${lado}`)?.nivel).toBe(Math.round(once.reduce((s, j) => s + j.nivel, 0) / once.length));
      // Sin escalones, el texto lleva literalmente los valores del registro.
      expect(i.auditDialogo!.escalones).toEqual([]);
      for (const idioma of ["es", "en"] as const) {
        const texto = textoVariante(i.turnos!, idioma);
        expect(texto).toContain(r.config.partido[lado].nombre);
        expect(texto).toContain(formacionHablada(r.config.formaciones[lado], idioma));
        if (capitan) expect(texto).toContain(capitan.nombre);
        if (e) expect(texto).toContain(e.nombre);
        expect(texto).toContain(String(datosDe(i, `previa:nivel:${lado}`)!.nivel));
      }
    });
    const c3 = p[2]!;
    expect(datosDe(c3, "previa:arbitro")?.arbitro).toBe(r.inicial.arbitro?.nombre);
    for (const lado of lados) expect([datosDe(c3, `previa:perfiles:${lado}`)?.ataque, datosDe(c3, `previa:perfiles:${lado}`)?.defensa]).toEqual([r.config.partido[lado].ataque, r.config.partido[lado].defensa]);
    const t3 = textoVariante(c3.turnos!, "es");
    for (const lado of lados) expect(t3).toContain(`ataque ${r.config.partido[lado].ataque} y defensa ${r.config.partido[lado].defensa}`);
    if (r.inicial.arbitro) expect(t3).toContain(r.inicial.arbitro.nombre);
  });

  it("mutaciones del registro: capitán distinto, nombres intercambiados, otra formación u otro clima cambian la pieza y comprobarPrevia lo detecta", () => {
    const r = FIXTURES["arena-reinicios-v3"], original = previaPartido(r);
    const capitanDistinto = structuredClone(r);
    const propios = capitanDistinto.inicial.jugadores.filter(j => j.lado === "local");
    const actual = propios.find(j => j.capitan)!, otro = propios.find(j => !j.capitan)!;
    actual.capitan = false; otro.capitan = true;
    const nombres = structuredClone(r);
    const [a, b] = [nombres.inicial.jugadores.find(j => j.lado === "local" && j.capitan)!, nombres.inicial.jugadores.find(j => j.lado === "local" && !j.capitan)!];
    [a.nombre, b.nombre] = [b.nombre, a.nombre];
    const formacion = structuredClone(r), nueva = formaciones.find(f => f !== r.config.formaciones.local)!;
    const viejos = puestos(r.config.formaciones.local), nuevos = puestos(nueva);
    for (const j of formacion.inicial.jugadores.filter(j => j.lado === "local")) j.puesto = nuevos[viejos.indexOf(j.puesto)]!;
    formacion.config.formaciones.local = nueva;
    const clima = structuredClone(r); clima.config.partido.condiciones!.clima = r.config.partido.condiciones!.clima === "niebla" ? "despejado" : "niebla";
    for (const [nombre, mutado, pieza] of [["capitán", capitanDistinto, 0], ["nombres", nombres, 0], ["formación", formacion, 0], ["clima", clima, 2]] as const) {
      expect(previaPartido(mutado)[pieza], nombre).not.toEqual(original[pieza]);
      expect(comprobarPrevia(original[pieza]!, mutado).length, nombre).toBeGreaterThan(0);
      expect(comprobarPrevia(original[pieza]!, r), nombre).toEqual([]);
    }
  });
});

describe("056 · previaPartido: presupuestos y escalera", () => {
  const comprobarPresupuesto = (i: IntervencionArena) => {
    for (const turnos of [i.turnos!, ...i.turnosBreve ? [i.turnosBreve] : []]) {
      expect(Math.max(textoVariante(turnos, "es").length, textoVariante(turnos, "en").length), i.id).toBeLessThanOrEqual(MESA_ARENA.maxCaracteresIntervencion);
      expect(estimarDuracionS(turnos), i.id).toBeLessThanOrEqual(VOZ_BUFFER.duracionMaxS);
      for (const t of turnos) expect(t.texto_es.length && t.texto_en.length, i.id).toBeGreaterThan(0);
    }
    for (const o of i.oraciones) expect(Math.max(o.texto_es.length, o.texto_en.length), i.id).toBeLessThanOrEqual(MESA_ARENA.maxCaracteresOracion);
  };
  it.each(TODOS)("%s: cada variante ≤ maxCaracteresIntervencion, cada oración ≤ maxCaracteresOracion y la estimación ≤ duracionMaxS", (_, r) => {
    for (const i of previaPartido(r)) comprobarPresupuesto(i);
  });

  it("nombres al máximo admitido con & < y comillas: la escalera recorta en orden, lo anota y nada queda vacío; prepararVoz escapa", () => {
    const r = registroLargo(), p = previaPartido(r);
    for (const i of p) comprobarPresupuesto(i);
    const [local, visita, condiciones] = p as [IntervencionArena, IntervencionArena, IntervencionArena];
    // Orden fijado (v1.1 § 4): cada escalón aplicado aparece una vez y en el orden de la tabla.
    const ordenEquipo = ["sin-perfil", "sin-estadista", "capitan-apellido", "equipo-generico", "sin-capitan"], ordenCond = ["sin-temperatura", "sin-arbitro", "sin-narrador", "equipos-genericos"];
    for (const [i, orden] of [[local, ordenEquipo], [visita, ordenEquipo], [condiciones, ordenCond]] as const) {
      const e = i.auditDialogo!.escalones;
      expect(e.length, i.id).toBeGreaterThan(0);
      expect(e.map(x => orden.indexOf(x)), i.id).toEqual([...e.map(x => orden.indexOf(x))].sort((a, b) => a - b));
      expect(e.every(x => orden.includes(x)), i.id).toBe(true);
    }
    expect(local.auditDialogo!.escalones).toEqual(["sin-perfil", "sin-estadista", "capitan-apellido", "equipo-generico"]);
    expect(condiciones.auditDialogo!.escalones).toEqual(["sin-arbitro", "sin-narrador", "equipos-genericos"]);
    // Cada escalón anotado se ve en el texto.
    const capitan = r.inicial.jugadores.find(j => j.lado === "local" && j.capitan)!.nombre;
    expect(local.turnos).toHaveLength(1);
    expect(local.turnosBreve).toBeUndefined();
    expect(local.turnos![0]!.texto_es).toContain(apellidoCorto(capitan));
    expect(local.turnos![0]!.texto_es).not.toContain(capitan);
    expect(local.turnos![0]!.texto_es).toContain(PL.es.referencias.local);
    expect(local.turnos![0]!.texto_en).toContain(PL.en.referencias.local);
    expect(condiciones.turnos!.map(t => t.rol)).toEqual(["estadista"]);
    expect(condiciones.turnos![0]!.texto_es).toContain(PL.es.referencias.visita);
    for (const i of p) for (const idioma of ["es", "en"] as const) for (const variante of ["completa", "breve"] as const) {
      const relato = relatoIntervencion(i, r.config.partido.seed, idioma, variante);
      const preparada = prepararVoz(relato.fragmentos, idioma);
      if (/[&<"']/.test(relato.texto)) expect(preparada.ssml).toMatch(/&amp;|&lt;|&quot;|&apos;/);
      expect(preparada.ssml).not.toContain("<Lía>");
    }
    // Con clubes cortos la capitana de 80 caracteres sigue en la frase: su & y su <Lía> llegan escapados al SSML.
    const solo = registroLargo(); solo.config.partido.local.nombre = "Club Corto"; solo.config.partido.visita.nombre = "Unión Corta";
    const p1 = previaPartido(solo)[0]!;
    const ssml = prepararVoz(relatoIntervencion(p1, solo.config.partido.seed, "es").fragmentos, "es").ssml;
    expect(ssml).toContain("&amp;"); expect(ssml).toContain("&lt;Lía&gt;");
  });

  it("cota por construcción del último escalón: pieza de equipo ≤ 60 y pieza de condiciones ≤ 110 caracteres en ES y EN", () => {
    const rellenar = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k]));
    for (const idioma of ["es", "en"] as const) {
      for (const f of formaciones) for (const lado of lados)
        expect(rellenar(PL[idioma].alineacionSinCapitan, { equipo: PL[idioma].referencias[lado], formacion: formacionHablada(f, idioma) }).length, `${idioma} ${f}`).toBeLessThanOrEqual(60);
      expect(rellenar(PL[idioma].perfiles, { local: PL[idioma].referencias.local, visita: PL[idioma].referencias.visita, a1: 100, d1: 100, a2: 100, d2: 100 }).length).toBeLessThanOrEqual(110);
    }
    expect(formacionHablada("4-1-2-1-2", "es")).toBe("cuatro-uno-dos-uno-dos");
    expect(formacionHablada("4-3-3", "en")).toBe("four-three-three");
  });
});

describe("056 · previaPartido: degradación, superficie y estructura", () => {
  it("v1 (arena-llm-v1): piezas 1–2 con alineacionSinCapitan y plantelSinEntrenador; pieza 3 solo con perfiles", () => {
    const r = FIXTURES["arena-llm-v1"], p = previaPartido(r);
    lados.forEach((lado, k) => {
      const i = p[k]!;
      expect(i.turnos!.map(t => t.texto_es)).toEqual([
        PL.es.alineacionSinCapitan.replace("{equipo}", r.config.partido[lado].nombre).replace("{formacion}", formacionHablada(r.config.formaciones[lado], "es")),
        PL.es.plantelSinEntrenador.replace("{nivel}", String(previaVisual(r).equipos[lado].nivelMedio)),
      ]);
      expect(i.hechos.map(h => h.id)).toEqual([`previa:formacion:${lado}`, `previa:equipo:${lado}`, `previa:nivel:${lado}`]);
    });
    expect(p[2]!.turnos!.map(t => t.rol)).toEqual(["estadista"]);
    expect(p[2]!.turnosBreve).toBeUndefined();
  });

  it("superficie (v1.1 § 8): sintética, natural corta, natural alta y natural sin longitud; sin condiciones se omite la frase", () => {
    const r = FIXTURES["arena-reinicios-v3"];
    const con = (c: RegistroArena["config"]["partido"]["condiciones"]) => { const x = structuredClone(r); x.config.partido.condiciones = c; return previaPartido(x)[2]!; };
    const base = { clima: "despejado" as const, presion: r.config.partido.condiciones!.presion };
    expect(con({ ...base, superficie: "sintetica" }).turnos![0]!.texto_es).toContain(PREVIA_ARENA.textos.superficie.es.sintetica);
    expect(con({ ...base, superficie: "natural", cesped: "corto" }).turnos![0]!.texto_en).toContain(PREVIA_ARENA.textos.superficie.en.natural_corto);
    expect(con({ ...base, superficie: "natural", cesped: "alto" }).turnos![0]!.texto_es).toContain(PREVIA_ARENA.textos.superficie.es.natural_alto);
    const sinLongitud = con({ ...base, superficie: "natural" });
    expect(sinLongitud.turnos![0]!.texto_es).toMatch(new RegExp(`${PREVIA_ARENA.textos.superficie.es.natural}\\.$`));
    expect(datosDe(sinLongitud, "previa:condiciones")).not.toHaveProperty("cesped");
    const sin = con(undefined);
    expect(sin.turnos![0]!.texto_es).toBe(PL.es.arbitro.replace("{arbitro}", r.inicial.arbitro!.nombre));
    expect(sin.hechos.map(h => h.id)).not.toContain("previa:condiciones");
    // Temperatura solo si existe.
    expect(con({ ...base, clima: "calor", temperaturaC: 35, superficie: "sintetica" }).turnos![0]!.texto_es).toContain(PL.es.temperatura.replace("{n}", "35"));
  });

  it.each(Object.entries(FIXTURES))("%s: estructura, turnos alternos, D1–D5 delegada, relato válido y evidencia con citas", (_, r) => {
    for (const i of previaPartido(r)) {
      expect(i).toMatchObject({ rol: "estadista", tick: 0, forma: "previa", tema: "previa", modo: "determinista", audit: [] });
      expect(esPrevia(i)).toBe(true);
      for (const turnos of [i.turnos!, ...i.turnosBreve ? [i.turnosBreve] : []]) {
        turnos.forEach((t, k) => { expect(t.funcion).toBe("dato"); if (k) expect(t.rol).not.toBe(turnos[k - 1]!.rol); });
        expect(turnos.length).toBeGreaterThanOrEqual(1);
      }
      expect(comprobarTurnos(i, r)).toEqual([]);
      const alterada = { ...i, turnos: i.turnos!.map((t, k) => k ? t : { ...t, texto_es: t.texto_es + " Inventado." }) };
      const motivos = comprobarTurnos(alterada, r);
      expect(motivos).toHaveLength(1);
      expect(motivos[0]!.regla).toBe("D1");
      expect(motivos[0]!.detalle).toMatch(/^previa: turnos\[0\]\.texto_es/);
      for (const variante of ["completa", "breve"] as const) for (const idioma of ["es", "en"] as const) {
        const relato = relatoIntervencion(i, r.config.partido.seed, idioma, variante);
        expect(segmentoVozValido({ ...relato, audio: { base64: "x", tipo: "audio/mpeg" } }, { desde: 0, hasta: 0, idioma, intervencion: { id: i.id, tick: 0, variante: varianteEfectiva(i, variante) } })).toBe(true);
      }
      i.oraciones.forEach((o, k) => {
        const ev = i.evidencia[k]!, citados = [o.hecho, ...o.apoyo ?? []];
        expect(ev.eventos).toEqual([]);
        expect(ev.intervalo).toEqual([0, 0]);
        expect(ev.citas!.map(c => c.hecho)).toEqual(citados);
        for (const c of ev.citas!) { expect(c.fuente).toBe(fuenteEsperada(c.hecho)); expect(c.intervalo).toEqual([0, 0]); }
        const fuentes = new Set(ev.citas!.map(c => c.fuente));
        if (fuentes.size === 1) expect(ev.fuente).toBe([...fuentes][0]); else expect(ev).not.toHaveProperty("fuente");
        for (const id of citados) expect(i.hechos.some(h => h.id === id)).toBe(true);
      });
    }
  });

  it("v1.1 § 11 · mutación por campo: exactamente un motivo con la ruta del campo; la copia intacta da []", () => {
    const r = FIXTURES["arena-reinicios-v3"], i = previaPartido(r)[0]!;
    expect(comprobarPrevia(structuredClone(i), r)).toEqual([]);
    const mutar = (f: (x: IntervencionArena) => void) => { const x = structuredClone(i); f(x); return comprobarPrevia(x, r); };
    const casos: [string, (x: IntervencionArena) => void, string][] = [
      ["texto_es", x => { x.turnos![0]!.texto_es += "!"; }, "turnos[0].texto_es"],
      ["texto_en", x => { x.turnos![1]!.texto_en += "!"; }, "turnos[1].texto_en"],
      ["oraciones[k].hecho", x => { x.oraciones[0]!.hecho = "previa:nivel:local"; }, "oraciones[0].hecho"],
      ["apoyo", x => { x.oraciones[0]!.apoyo = [...x.oraciones[0]!.apoyo!, "previa:arbitro"]; }, "oraciones[0].apoyo"],
      ["hechos[k].datos", x => { x.hechos[0]!.datos.formacion = "4-4-2"; }, "hechos[0].datos.formacion"],
      ["evidencia[k].citas[j].fuente", x => { x.evidencia[0]!.citas![1]!.fuente = "config.formaciones"; }, "evidencia[0].citas[1].fuente"],
      ["turnosBreve", x => { delete x.turnosBreve; }, "turnosBreve"],
      ["forma", x => { x.forma = "estadista"; }, "forma"],
      ["tema", x => { x.tema = "posesion"; }, "tema"],
      ["tick", x => { x.tick = 1; }, "tick"],
      ["rol", x => { (x as { rol: string }).rol = "comentarista"; }, "rol"],
      ["id", x => { x.id = "previa:9-otra:0"; }, "id"],
    ];
    for (const [nombre, f, ruta] of casos) {
      const m = mutar(f);
      expect(m, nombre).toHaveLength(1);
      expect(m[0]!.detalle.split(":")[0], nombre).toBe(ruta);
    }
  });
});
