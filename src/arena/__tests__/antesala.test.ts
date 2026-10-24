// Brief 058 · Bloque B · Antesala (§ 8, v1.1 §§ 1–8 y 14, v1.3). Ninguna cifra de ANTESALA_ARENA, MESA_ARENA,
// PREVIA_ARENA ni VOZ_BUFFER se repite a mano: se leen de limites.ts y buffer.ts. Los ORÁCULOS de las pruebas del
// guion (formación en palabras, líneas, apellidos, entrenador y controlador) se calculan aquí SIN importar
// antesala.ts ni previa.ts: solo el registro, la asignación y el catálogo de formaciones.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import huellasTranscripts from "../__fixtures__/huellas-transcripts.json";
import { conjuntoHuellas, huellaTramo, normalizarTramo } from "../__fixtures__/huellas-transcripts";
import {
  activarAntesala, antesalaPartido, bloqueAntesala, comprobarAntesala, controladorVerificado, duracionEstimadaAntesalaS, elegirSolicitud, esAntesala,
  guionAntesala, iniciarAntesala, jugadoresDelBloque, longitudEscapada, MAX_EN_VUELO_ANTESALA, pasoAntesala, siguientePedidoAntesala, todosPedidosAntesala,
  vencimientoAntesalaMs, type EntradaAntesala, type EstadoAntesala, type SalidaAntesala,
} from "../antesala";
import { VOZ_BUFFER } from "../buffer";
import { estructuraBase, puestos } from "../catalogo";
import { crearConfigArena, crearEstadoArena } from "../motor";
import type { AsignacionModelos, IntervencionArena } from "../protocolo";
import { formaciones, type FormacionArena, type RegistroArena } from "../tipos";
import { prepararVoz } from "../voz";
import { ANTESALA_ARENA, MESA_ARENA, NARRACION_DIRECTO, PREVIA_ARENA } from "../../sim/limites";

const A = ANTESALA_ARENA;
const leer = (ruta: string) => JSON.parse(readFileSync(ruta, "utf8")) as RegistroArena;
const FIXTURES = {
  "arena-reinicios-v3": leer("src/arena/__fixtures__/arena-reinicios-v3.json"),
  "arena-llm-v1": leer("public/experimentos/arena-llm-v1.json"),
  "arena-llm-v3": leer("public/experimentos/arena-llm-v3.json"),
  "arena-duelo-v3": leer("public/experimentos/arena-duelo-v3.json"),
};
const registroDe = (opciones: Parameters<typeof crearConfigArena>[0]): RegistroArena => {
  const config = crearConfigArena({ duracionS: 60, ...opciones }), inicial = crearEstadoArena(config);
  return { version: config.version!, config, inicial, rondas: [], eventos: [], fotogramas: [inicial], final: inicial };
};
const SEMILLAS = Array.from({ length: 60 }, (_, i) => 1000 + i * 7919);
const DOCE = formaciones.map((f, k) => [`formación ${f}`, registroDe({ seed: 77 + k, local: f, visita: formaciones[(k + 5) % formaciones.length] })] as [string, RegistroArena]);
const TODOS: [string, RegistroArena][] = [...Object.entries(FIXTURES), ...SEMILLAS.map(s => [`semilla ${s}`, registroDe({ seed: s })] as [string, RegistroArena]), ...DOCE];
const IDIOMAS = ["es", "en"] as const;
const LADOS = ["local", "visita"] as const;
type Idioma = (typeof IDIOMAS)[number];

/** Nombres públicos del catálogo real (infra/modelos-arena.json, publicar: true); no se fija cuántos son. */
const CATALOGO = (JSON.parse(readFileSync("infra/modelos-arena.json", "utf8")) as { id: string; nombrePublico: string; publicar?: boolean }[]).filter(m => m.publicar);
const modelo = (k: number) => { const m = CATALOGO[k % CATALOGO.length]!; return { id: m.id, nombre: m.nombrePublico, controlador: `azure-openai:${m.id}` }; };
const PROGRAMADO = { id: "programado", nombre: "Programmed policy / Política programada", controlador: "programado" };
const asignaciones: Record<string, AsignacionModelos | null> = {
  azar: { modo: "azar", local: modelo(0), visita: modelo(1) },
  manual: { modo: "manual", local: modelo(2), visita: modelo(3) },
  programado: { modo: "programado", local: PROGRAMADO, visita: PROGRAMADO },
  declarada: { modo: "manual", local: modelo(0), visita: modelo(1), procedencia: "declarada" },
  grabacion: { modo: "programado", local: { id: "local", nombre: "Archivo A", controlador: "x" }, visita: { id: "visita", nombre: "Archivo B", controlador: "y" } },
  nula: null,
};

// ——— Oráculos independientes (no importan antesala.ts ni previa.ts) ———
const PALABRAS: Record<Idioma, string[]> = { es: ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis"], en: ["zero", "one", "two", "three", "four", "five", "six"] };
const formacionOraculo = (f: string, i: Idioma) => f.split("-").map(d => PALABRAS[i][Number(d)]!).join("-");
function lineasOraculo(f: FormacionArena) {
  const ps = puestos(f), cuentas = estructuraBase(f).split("-").map(Number), lineas: string[][] = [];
  let k = 1;
  for (const n of cuentas) { lineas.push(ps.slice(k, k + n)); k += n; }
  return { atras: [ps[0]!, ...lineas[0]!], medio: lineas.slice(1, -1).flat(), arriba: lineas[lineas.length - 1]! };
}
function habladoOraculo(r: RegistroArena, lado: string, id: string) {
  const propios = r.inicial.jugadores.filter(j => j.lado === lado), ultima = (n: string) => n.trim().split(/\s+/).pop()!;
  const j = propios.find(x => x.id === id)!;
  return propios.filter(x => ultima(x.nombre) === ultima(j.nombre)).length > 1 ? j.nombre : ultima(j.nombre);
}
/** Tabla de v1.1 § 8 (b), escrita a mano. */
function clausulaOraculo(a: AsignacionModelos | null, lado: "local" | "visita"): "modelo" | "programado" | "ninguna" {
  if (a === null || a.procedencia === "declarada") return "ninguna";
  if (a.modo === "azar" || a.modo === "manual") return "modelo";
  return a[lado].id === "programado" ? "programado" : "ninguna";
}
const textoDe = (i: IntervencionArena, idioma: Idioma) => idioma === "es" ? i.turnos![0]!.texto_es : i.turnos![0]!.texto_en;
const hecho = (i: IntervencionArena, prefijo: string) => i.hechos.find(h => h.id.startsWith(prefijo));

describe("058 · constantes (§ 7 y v1.1 § 14)", () => {
  it("invariantes desde las constantes", () => {
    expect(A.topeS).toBeGreaterThan(A.objetivoS);
    expect(A.huecoS + A.esperaClipS).toBeLessThan(VOZ_BUFFER.silencioMaxS);
    expect(NARRACION_DIRECTO.desbloqueoMs).toBeLessThanOrEqual(NARRACION_DIRECTO.esperaHerramientasMs);
    const clipsPorIdioma = antesalaPartido(FIXTURES["arena-llm-v3"], asignaciones.manual!, "es").length;
    expect(A.bolsaSpeech.solicitudes).toBeGreaterThanOrEqual(clipsPorIdioma * IDIOMAS.length);
    expect(A.maxSsmlClipC * clipsPorIdioma * IDIOMAS.length).toBeLessThanOrEqual(A.bolsaSpeech.caracteres);
    // Siempre caben un clip de la antesala y la entrada.
    expect(MAX_EN_VUELO_ANTESALA).toBe(VOZ_BUFFER.concurrencia);
    expect(MAX_EN_VUELO_ANTESALA).toBeGreaterThanOrEqual((["antesala", "entrada"] as const).length);
    expect(Object.keys(A.plantillas.es).sort()).toEqual(Object.keys(A.plantillas.en).sort());
    expect(Object.keys(A.bloquesRotulo.es).sort()).toEqual(Object.keys(A.bloquesRotulo.en).sort());
  });
  it("objetivoS y topeS no se repiten como literales en las pruebas del 058", () => {
    for (const archivo of ["src/arena/__tests__/antesala.test.ts", "e2e/arena-antesala.spec.ts", "src/arena/__tests__/buffer.test.ts"]) {
      const texto = readFileSync(archivo, "utf8");
      for (const n of [A.topeS, A.objetivoS]) expect(new RegExp(`(?<![\\d.])${n}(?![\\d.])`).test(texto), `${archivo}: ${n}`).toBe(false);
    }
  });
});

describe("058 · guion (§ 4.1, § 8 y oráculos de v1.1 § 8 a)", () => {
  it("ids, orden y bloques sobre fixtures, 60 semillas y las doce formaciones; jugadores, nombres, formación y entrenador según los oráculos", () => {
    for (const [nombre, r] of TODOS) for (const idioma of IDIOMAS) {
      const piezas = antesalaPartido(r, asignaciones.manual!, idioma);
      const ids = piezas.map(p => p.id);
      const esperado = [...ids[0] === "antesala:01-apertura:0" ? ["antesala:01-apertura:0"] : [],
        "antesala:02-local-cabecera:0", "antesala:03-local-atras:0", "antesala:04-local-medio:0", "antesala:05-local-arriba:0",
        "antesala:06-visita-cabecera:0", "antesala:07-visita-atras:0", "antesala:08-visita-medio:0", "antesala:09-visita-arriba:0"];
      expect(ids, nombre).toEqual(esperado);
      for (const p of piezas) {
        expect(esAntesala(p)).toBe(true);
        expect(p).toMatchObject({ rol: "estadista", tick: 0, tema: "antesala", forma: "previa", modo: "determinista" });
        expect(p.turnos).toHaveLength(1);
        expect(p.turnos![0]).toMatchObject({ rol: "narrador", funcion: "dato" });
        expect(p.turnosBreve).toBeUndefined();
        const b = bloqueAntesala(p.id)!;
        if (b.bloque === "apertura") continue;
        const lado = b.lado!, f = r.config.formaciones[lado];
        if (b.bloque === "cabecera") {
          const h = hecho(p, `antesala:formacion:${lado}`)!;
          expect(h.datos).toMatchObject({ formacion: f, formacion_hablada: formacionOraculo(f, idioma) });
          expect(textoDe(p, idioma), nombre).toContain(formacionOraculo(f, idioma));
          continue;
        }
        const puestosEsperados = lineasOraculo(f)[b.bloque];
        const jugadores = puestosEsperados.map(pu => r.inicial.jugadores.find(j => j.lado === lado && j.puesto === pu)!);
        expect(jugadoresDelBloque(r, lado, b.bloque).map(j => j.id)).toEqual(jugadores.map(j => j.id));
        const d = hecho(p, `antesala:linea:${lado}:${b.bloque}`)!.datos;
        expect(d.n).toBe(jugadores.length);
        const dorsales = p.auditDialogo!.escalones.includes("dorsales");
        jugadores.forEach((j, k) => {
          expect(d[`jugador_${k + 1}`], `${nombre} ${p.id}`).toBe(j.id);
          expect(d[`puesto_${k + 1}`]).toBe(j.puesto);
          expect(d[`orden_${k + 1}`]).toBe(puestos(f).indexOf(j.puesto) + 1);
          expect(d[`hablado_${k + 1}`]).toBe(dorsales ? (idioma === "es" ? `el ${j.dorsal}` : `number ${j.dorsal}`) : habladoOraculo(r, lado, j.id));
        });
        // Los nombres hablados aparecen en el texto, en orden.
        let desde = 0;
        for (let k = 1; k <= jugadores.length; k++) { const at = textoDe(p, idioma).indexOf(String(d[`hablado_${k}`]), desde); expect(at, `${p.id} ${k}`).toBeGreaterThanOrEqual(0); desde = at + 1; }
        if (b.bloque === "arriba") {
          const e = r.config.entrenadores?.[lado]?.nombre;
          const he = hecho(p, `antesala:entrenador:${lado}`);
          if (he) { expect(he.datos.entrenador).toBe(e); expect(textoDe(p, idioma)).toContain(e!); }
          if (!e) expect(he).toBeUndefined();
        }
      }
    }
  });

  it("v1 (arena-llm-v1): sin sufijo de entrenador; el guion existe y cabe en objetivoS", () => {
    const r = FIXTURES["arena-llm-v1"];
    expect(r.config.entrenadores).toBeUndefined();
    for (const idioma of IDIOMAS) {
      const g = guionAntesala(r, asignaciones.manual!, idioma);
      expect(g.intervenciones.length).toBeGreaterThan(0);
      expect(g.intervenciones.some(i => i.hechos.some(h => h.id.startsWith("antesala:entrenador")))).toBe(false);
      expect(g.duracionEstimadaS).toBeLessThanOrEqual(A.objetivoS);
    }
  });

  it("la duración estimada cabe en objetivoS sobre fixtures y semillas", () => {
    for (const [nombre, r] of TODOS) for (const idioma of IDIOMAS) {
      const g = guionAntesala(r, asignaciones.azar!, idioma);
      expect(g.duracionEstimadaS, nombre).toBeLessThanOrEqual(A.objetivoS);
      expect(duracionEstimadaAntesalaS(g.intervenciones)).toBe(g.duracionEstimadaS);
    }
  });

  it("colisión de apellido en el mismo equipo: esos dos se nombran completos; en equipos distintos, no", () => {
    const r = structuredClone(FIXTURES["arena-llm-v3"]);
    const loc = r.inicial.jugadores.filter(j => j.lado === "local"), vis = r.inicial.jugadores.find(j => j.lado === "visita")!;
    loc[1]!.nombre = "Ana Igual"; loc[2]!.nombre = "Bea Igual"; vis.nombre = "Cora Igual";
    for (const idioma of IDIOMAS) {
      const todos = antesalaPartido(r, null, idioma).filter(p => p.id.includes("-atras") || p.id.includes("-medio") || p.id.includes("-arriba"));
      const hablados = new Map(todos.flatMap(p => { const d = p.hechos[0]!.datos; return Array.from({ length: Number(d.n) }, (_, k) => [String(d[`jugador_${k + 1}`]), String(d[`hablado_${k + 1}`])] as [string, string]); }));
      expect(hablados.get(loc[1]!.id)).toBe("Ana Igual");
      expect(hablados.get(loc[2]!.id)).toBe("Bea Igual");
      expect(hablados.get(vis.id)).toBe("Igual");
    }
  });

  it("un cambio de nombre en el registro cambia el clip de su línea", () => {
    const r = structuredClone(FIXTURES["arena-llm-v3"]);
    const antes = antesalaPartido(r, null, "es");
    const j = jugadoresDelBloque(r, "visita", "medio")[0]!;
    r.inicial.jugadores.find(x => x.id === j.id)!.nombre = "Zoe Distinta";
    const despues = antesalaPartido(r, null, "es");
    const cambiados = despues.filter((p, k) => JSON.stringify(p) !== JSON.stringify(antes[k])).map(p => p.id);
    expect(cambiados).toEqual(["antesala:08-visita-medio:0"]);
    expect(textoDe(despues.find(p => p.id === "antesala:08-visita-medio:0")!, "es")).toContain("Distinta");
  });
});

describe("058 · controlador (v1.1 § 8 b) con los nombres del catálogo real", () => {
  it("las cuatro ramas de cabecera y la tabla de la cláusula; nunca un modelo declarado", () => {
    expect(CATALOGO.length).toBeGreaterThan(0);
    const r = FIXTURES["arena-llm-v3"];
    for (const [nombre, a] of Object.entries(asignaciones)) for (const idioma of IDIOMAS) for (const lado of LADOS) {
      const esperada = clausulaOraculo(a, lado);
      expect(controladorVerificado(a, lado).clausula, nombre).toBe(esperada);
      const cab = antesalaPartido(r, a, idioma).find(p => p.id === `antesala:0${lado === "local" ? 2 : 6}-${lado}-cabecera:0`)!;
      const texto = textoDe(cab, idioma), h = hecho(cab, `antesala:controlador:${lado}`);
      if (esperada === "modelo") {
        expect(texto, nombre).toContain(a![lado].nombre);
        // La cabecera local nombra al controlador LOCAL (nunca el de la visita).
        if (a![lado].nombre !== a![lado === "local" ? "visita" : "local"].nombre) expect(texto).not.toContain(a![lado === "local" ? "visita" : "local"].nombre);
        expect(h!.datos).toEqual({ equipo: r.config.partido[lado].nombre, modo: a!.modo, clausula: "modelo", controlador_id: a![lado].id, controlador_nombre: a![lado].nombre });
      } else if (esperada === "programado") {
        expect(texto).toBe(`${r.config.partido[lado].nombre} ${idioma === "es" ? "sale en" : "line up in a"} ${formacionOraculo(r.config.formaciones[lado], idioma)}, ${idioma === "es" ? "con un plan programado." : "on a programmed plan."}`);
        expect(h!.datos.clausula).toBe("programado");
      } else {
        expect(h, nombre).toBeUndefined();
        for (const m of CATALOGO) expect(texto, nombre).not.toContain(m.nombrePublico);
        if (a) for (const l of LADOS) expect(texto).not.toContain(a[l].nombre);
      }
    }
  });
});

/** Registro con nombres al máximo admitido (motor.ts: club 100, personas 80) y caracteres XML. */
function registroLargo(caracter?: string): RegistroArena {
  const r = structuredClone(FIXTURES["arena-reinicios-v3"]);
  const persona = (prefijo: string) => caracter ? caracter.repeat(80) : (() => { const base = `${prefijo} & <Lía> "Q" 'O' `; return base + "Z".repeat(80 - base.length); })();
  r.config.partido.local.nombre = caracter ? caracter.repeat(100) : ("Club Atlético & <" + "Ñ".repeat(100)).slice(0, 100);
  r.config.partido.visita.nombre = caracter ? caracter.repeat(100) : ("Unión Deportiva \"" + "Á".repeat(100)).slice(0, 100);
  for (const lado of LADOS) {
    r.inicial.jugadores.filter(j => j.lado === lado).forEach((j, k) => { j.nombre = persona(`Jugadora ${lado} ${k}`); });
    r.config.entrenadores![lado].nombre = persona(`Técnica ${lado}`);
  }
  return r;
}

describe("058 · escaleras (§ 4.3 y v1.1 § 6)", () => {
  it("con nombres de 100 y 80 c y caracteres XML: cada clip ≤ maxCaracteresIntervencion, cada oración ≤ maxCaracteresOracion y el texto escapado ≤ maxTextoEscapadoC", () => {
    for (const r of [registroLargo(), registroLargo("&"), registroLargo("'")]) for (const idioma of IDIOMAS) {
      const g = guionAntesala(r, asignaciones.azar!, idioma);
      for (const p of g.intervenciones) for (const i of IDIOMAS) {
        const texto = textoDe(p, i);
        expect(texto.length, p.id).toBeLessThanOrEqual(MESA_ARENA.maxCaracteresIntervencion);
        expect(longitudEscapada(texto), p.id).toBeLessThanOrEqual(A.maxTextoEscapadoC);
        for (const o of p.oraciones) expect((i === "es" ? o.texto_es : o.texto_en).length).toBeLessThanOrEqual(MESA_ARENA.maxCaracteresOracion);
        expect(() => prepararVoz([{ tick: 0, texto, emocion: "serena", intensidad: .25, variante: 0, fuentes: [], fotogramas: [], rol: "narrador" }], i)).not.toThrow();
      }
      // La apertura no cabe y se omite; las líneas pasan a dorsales; la cabecera pierde el controlador y usa la referencia.
      expect(g.intervenciones.some(p => p.id === "antesala:01-apertura:0")).toBe(false);
      for (const p of g.intervenciones.filter(x => /-(atras|medio|arriba):/.test(x.id))) {
        const e = p.auditDialogo!.escalones;
        // Con tres o más nombres de 80 c, la línea solo cabe en dorsales.
        if (Number(p.hechos[0]!.datos.n) >= 3) expect(e, p.id).toContain("dorsales");
        if (p.id.includes("arriba") && e.includes("sin-entrenador") && e.includes("dorsales")) expect(e.indexOf("sin-entrenador")).toBeLessThan(e.indexOf("dorsales"));
      }
      for (const p of g.intervenciones.filter(x => x.id.includes("cabecera"))) {
        const e = p.auditDialogo!.escalones;
        // Con clubes de 100 «&» o «'» (500–600 c escapados) solo cabe la referencia genérica.
        if (r.config.partido.local.nombre.startsWith("&") || r.config.partido.local.nombre.startsWith("'")) expect(e).toContain("equipo-referencia");
        if (!e.includes("equipo-referencia")) continue;
        // El controlador se quitó antes: en la escalera del clip (primer escalón) o en la del guion.
        expect(e.includes("sin-controlador") ? e.indexOf("sin-controlador") < e.indexOf("equipo-referencia") : e.includes("guion:sin-controlador")).toBe(true);
        expect(p.oraciones[0]!.apoyo).toEqual([]);
        expect(textoDe(p, "es")).toMatch(/^(El local|La visita) sale en /);
        expect(textoDe(p, "en")).toMatch(/^The (home|away) side line up in a /);
      }
    }
  });

  it("prepararVoz escapa: la longitud del SSML crece exactamente como longitudEscapada", () => {
    const voz = (texto: string) => prepararVoz([{ tick: 0, texto, emocion: "serena", intensidad: .25, variante: 0, fuentes: [], fotogramas: [], rol: "narrador" }], "es").ssml.length;
    for (const adversaria of ["&&&&", "<<>>", "\"'\"'", "A & B < C > D \" E ' F", "Ñandú & Lía", "&".repeat(80), "'".repeat(80)]) {
      const base = "x".repeat([...adversaria].length);
      expect(voz(adversaria) - voz(base), adversaria).toBe(longitudEscapada(adversaria) - longitudEscapada(base));
      expect(prepararVoz([{ tick: 0, texto: adversaria, emocion: "serena", intensidad: .25, variante: 0, fuentes: [], fotogramas: [], rol: "narrador" }], "es").ssml).not.toContain(`>${adversaria}<`);
    }
  });

  it("escalera del guion: un registro forzado por encima de objetivoS aplica 1 → 3 en orden y lo anota", () => {
    // Nombres de 30 c sin colisiones: los clips caben, pero el guion supera la duración objetivo.
    const r = structuredClone(FIXTURES["arena-llm-v3"]);
    for (const lado of LADOS) {
      r.inicial.jugadores.filter(j => j.lado === lado).forEach((j, k) => { j.nombre = `Nombre Apellidolargo${lado}${String.fromCharCode(97 + k)}${"o".repeat(12)}`; });
      r.config.entrenadores![lado].nombre = "Entrenadora Con Un Nombre Bastante Largo";
    }
    r.config.partido.local.nombre = "Club Deportivo de los Llanos del Norte"; r.config.partido.visita.nombre = "Asociación Atlética Puerto Alto";
    for (const idioma of IDIOMAS) {
      const g = guionAntesala(r, asignaciones.manual!, idioma);
      expect(g.escalonesGuion.length).toBeGreaterThan(0);
      expect(g.escalonesGuion).toEqual(["guion:sin-apertura", "guion:sin-controlador", "guion:sin-entrenador"].slice(0, g.escalonesGuion.length));
      if (g.escalonesGuion.includes("guion:sin-apertura")) expect(g.intervenciones[0]!.id).not.toBe("antesala:01-apertura:0");
      for (const p of g.intervenciones) for (const e of g.escalonesGuion.filter(x => x === "guion:sin-apertura")) expect(p.auditDialogo!.escalones).toContain(e);
      // Nunca se quitan las líneas: siempre hay atrás, medio y arriba de los dos equipos.
      expect(g.intervenciones.filter(p => /-(atras|medio|arriba):/.test(p.id))).toHaveLength(6);
    }
  });
});

describe("058 · hechos por clip e idioma (v1.1 § 7 y v1.3)", () => {
  const CLAVES: Record<string, (n: number) => string[]> = {
    equipos: () => ["local", "visita"],
    formacion: () => ["equipo", "formacion", "formacion_hablada"],
    controlador: () => ["equipo", "modo", "clausula", "controlador_id", "controlador_nombre"],
    linea: n => ["equipo", "n", ...Array.from({ length: n }, (_, k) => ["jugador", "dorsal", "puesto", "nombre", "hablado", "orden"].map(c => `${c}_${k + 1}`)).flat()],
    entrenador: () => ["equipo", "entrenador"],
  };
  const FUENTES: Record<string, string> = { equipos: "config.partido", formacion: "config.formaciones", controlador: "sesion.asignacion", linea: "inicial.jugadores", entrenador: "config.entrenadores" };
  it("claves canónicas de la tabla, fuente exacta en las citas y cada valor dicho en `datos`, en el idioma del clip", () => {
    for (const [nombre, r] of [...Object.entries(FIXTURES), ["largo", registroLargo()] as [string, RegistroArena]]) for (const a of Object.values(asignaciones)) for (const idioma of IDIOMAS) {
      for (const p of antesalaPartido(r, a, idioma)) {
        for (const h of p.hechos) {
          const tipo = h.id.split(":")[1]!;
          expect(Object.keys(h.datos).sort(), `${nombre} ${h.id}`).toEqual(CLAVES[tipo]!(Number(h.datos.n ?? 0)).sort());
          for (const ev of p.evidencia) for (const c of ev.citas ?? []) if (c.hecho === h.id) expect(c.fuente).toBe(FUENTES[tipo]);
        }
        const texto = textoDe(p, idioma), valores = p.hechos.flatMap(h => Object.entries(h.datos).filter(([k]) => /^(local|visita|formacion_hablada|hablado_\d+|entrenador)$/.test(k) || k === "controlador_nombre" && h.datos.clausula === "modelo").map(([, v]) => String(v)));
        const cab = p.id.includes("cabecera"), equipoDicho = !p.auditDialogo!.escalones.includes("equipo-referencia");
        if (cab && equipoDicho) expect(texto).toContain(String(hecho(p, "antesala:formacion")!.datos.equipo));
        for (const v of valores) expect(texto, `${nombre} ${p.id} ${idioma}`).toContain(v);
      }
    }
  });
  it("v1.3 · formacion_hablada y hablado_k guardan la forma del idioma del clip (mutación: el otro idioma da rojo)", () => {
    const r = FIXTURES["arena-duelo-v3"];
    for (const idioma of IDIOMAS) for (const p of antesalaPartido(r, null, idioma).filter(x => x.id.includes("cabecera"))) {
      const lado = bloqueAntesala(p.id)!.lado!;
      expect(hecho(p, "antesala:formacion")!.datos.formacion_hablada).toBe(formacionOraculo(r.config.formaciones[lado], idioma));
    }
    const largo = registroLargo();
    for (const idioma of IDIOMAS) for (const p of antesalaPartido(largo, null, idioma).filter(x => x.id.includes("-atras"))) {
      const d = p.hechos[0]!.datos;
      expect(d.hablado_1).toBe(idioma === "es" ? `el ${d.dorsal_1}` : `number ${d.dorsal_1}`);
    }
  });
});

describe("058 · comprobarAntesala (§ 4.4 y § 8)", () => {
  const r = FIXTURES["arena-llm-v3"], a = asignaciones.manual!;
  it("la copia intacta da []; cada campo mutado da exactamente un motivo P1 con su ruta", () => {
    for (const idioma of IDIOMAS) {
      const piezas = antesalaPartido(r, a, idioma);
      for (const p of piezas) expect(comprobarAntesala(structuredClone(p), r, a, idioma)).toEqual([]);
      const linea = piezas.find(p => p.id === "antesala:04-local-medio:0")!, cab = piezas.find(p => p.id === "antesala:02-local-cabecera:0")!;
      const casos: [IntervencionArena, string, (x: IntervencionArena) => void][] = [
        [linea, "oraciones[0].texto_es", x => { x.oraciones[0]!.texto_es += " "; }],
        [linea, "oraciones[0].texto_en", x => { x.oraciones[0]!.texto_en += " "; }],
        [linea, "hechos[0].datos.hablado_1", x => { x.hechos[0]!.datos.hablado_1 = "Otro"; }],
        [cab, "evidencia[0].citas[0].fuente", x => { x.evidencia[0]!.citas![0]!.fuente = "config.partido"; }],
        [linea, "tema", x => { x.tema = "previa"; }],
        [linea, "forma", x => { x.forma = "estadista"; }],
      ];
      for (const [base, ruta, mutar] of casos) {
        const x = structuredClone(base); mutar(x);
        const motivos = comprobarAntesala(x, r, a, idioma);
        expect(motivos, ruta).toHaveLength(1);
        expect(motivos[0]!.detalle.startsWith(`${ruta}:`), motivos[0]!.detalle).toBe(true);
      }
      // Orden de dos jugadores de una línea: dos rutas de datos, un motivo por campo distinto.
      const x = structuredClone(linea), d = x.hechos[0]!.datos;
      [d.jugador_1, d.jugador_2] = [d.jugador_2!, d.jugador_1!];
      expect(comprobarAntesala(x, r, a, idioma).map(m => m.detalle.split(":")[0])).toEqual(["hechos[0].datos.jugador_1", "hechos[0].datos.jugador_2"]);
      const otroId = structuredClone(linea); otroId.id = "antesala:99-local-medio:0";
      expect(comprobarAntesala(otroId, r, a, idioma)).toHaveLength(1);
      // Con otra asignación, la cabecera ya no coincide (la ruta usa la asignación de la sesión).
      expect(comprobarAntesala(structuredClone(cab), r, asignaciones.declarada!, idioma).length).toBeGreaterThan(0);
      // Con el idioma equivocado, los datos hablados no coinciden.
      expect(comprobarAntesala(structuredClone(cab), r, a, idioma === "es" ? "en" : "es").length).toBeGreaterThan(0);
    }
  });
});

describe("058 · huellas de los transcripts (§ 4.2)", () => {
  it("ningún tramo literal de cuatro palabras de las plantillas aparece en los transcripts de referencia", () => {
    const huellas = conjuntoHuellas(huellasTranscripts.huellas);
    const tramos: string[] = [];
    for (const idioma of IDIOMAS) for (const t of Object.values(A.plantillas[idioma])) for (const segmento of t.split(/\{[^}]*\}/)) {
      const palabras = normalizarTramo(segmento).split(" ").filter(Boolean);
      for (let k = 0; k + 4 <= palabras.length; k++) tramos.push(palabras.slice(k, k + 4).join(" "));
    }
    // También los textos enteros generados (con nombres ficticios) del fixture.
    for (const idioma of IDIOMAS) for (const p of antesalaPartido(FIXTURES["arena-llm-v3"], asignaciones.manual!, idioma)) {
      const palabras = normalizarTramo(textoDe(p, idioma)).split(" ").filter(Boolean);
      for (let k = 0; k + 4 <= palabras.length; k++) tramos.push(palabras.slice(k, k + 4).join(" "));
    }
    expect(tramos.length).toBeGreaterThan(0);
    expect(tramos.filter(tr => huellas.has(huellaTramo(tr)))).toEqual([]);
  });
});

// ——— Reproductor puro ———
const IDS = antesalaPartido(FIXTURES["arena-llm-v3"], asignaciones.manual!, "es").map(p => p.id);
const T0 = 5000;
const VENCE = vencimientoAntesalaMs(T0);
const marco = (e: EstadoAntesala, x: Partial<Extract<EntradaAntesala, { tipo: "fotograma" }>>): Extract<EntradaAntesala, { tipo: "fotograma" }> =>
  ({ tipo: "fotograma", token: e.token, ahoraMs: T0, audioS: 0, corre: true, cursorS: 0, fuenteAjena: false, entradaDuracionS: null, ...x });
/** Pide y resuelve con éxito los clips indicados. */
function preparar(e: EstadoAntesala, ids: readonly string[], duracionS = 1): EstadoAntesala {
  for (const id of ids) {
    e = pasoAntesala(e, { tipo: "pedido", token: e.token, id }).estado;
    e = pasoAntesala(e, { tipo: "respuesta", token: e.token, id, ahoraMs: T0, resultado: { tipo: "ok", duracionS } }).estado;
  }
  return e;
}
/** Hace sonar el clip activo hasta su fin y devuelve el estado tras el fin-fuente. */
function sonar(e: EstadoAntesala, audioS: number): { e: EstadoAntesala; s: SalidaAntesala; finS: number } {
  const s = pasoAntesala(e, marco(e, { audioS }));
  const finS = s.estado.sonando!.finS;
  return { e: pasoAntesala(s.estado, { tipo: "fin-fuente", token: e.token, id: s.arrancar!.id, audioS: finS, interrumpida: false }).estado, s, finS };
}

describe("058 · pasoAntesala (§ 4.6, v1.1 §§ 1, 2, 4)", () => {
  it("orden, hueco y piezas del 056 terminadas solo cuando suena el primer clip; entrada al final presente", () => {
    let e = preparar(iniciarAntesala(IDS, 1, T0), IDS);
    expect(siguientePedidoAntesala(e, T0)).toBeNull();
    expect(todosPedidosAntesala(e)).toBe(true);
    let audio = 10, primero = true;
    for (const id of IDS) {
      // Antes del hueco no arranca.
      if (!primero) expect(pasoAntesala(e, marco(e, { audioS: audio + A.huecoS / 2 })).arrancar).toBeUndefined();
      const t = primero ? audio : audio + A.huecoS;
      const { e: siguiente, s, finS } = sonar(e, t);
      expect(s.arrancar).toEqual({ id });
      expect(!!s.terminarPrevia).toBe(primero);
      expect(s.soltarReloj).toBe(false);
      e = siguiente; audio = finS; primero = false;
    }
    const conEntrada = pasoAntesala(e, marco(e, { audioS: audio + A.huecoS, entradaDuracionS: 0.3 }));
    expect(conEntrada.arrancar).toEqual({ id: "entrada" });
    const fin = pasoAntesala(conEntrada.estado, { tipo: "fin-fuente", token: 1, id: "entrada", audioS: audio + 1, interrumpida: false });
    expect(fin.estado).toMatchObject({ fase: "terminada", motivo: "completa", entrada: "sonada" });
    expect(fin.soltarReloj).toBe(true);
  });

  it("entrada ausente: se espera esperaClipS y se termina sin ella", () => {
    let e = preparar(iniciarAntesala(IDS.slice(0, 1), 1, T0), IDS.slice(0, 1));
    const { e: tras, finS } = sonar(e, 0); e = tras;
    const inicio = finS + A.huecoS;
    let s = pasoAntesala(e, marco(e, { audioS: inicio }));
    expect(s.estado.fase).toBe("activa");
    s = pasoAntesala(s.estado, marco(e, { audioS: inicio + A.esperaClipS - 0.01 }));
    expect(s.estado.fase).toBe("activa");
    s = pasoAntesala(s.estado, marco(e, { audioS: inicio + A.esperaClipS }));
    expect(s.estado).toMatchObject({ fase: "terminada", motivo: "completa", entrada: "omitida" });
  });

  it("clip tardío saltado a los esperaClipS (cuenta como fallo) y su petición se aborta", () => {
    let e = iniciarAntesala(IDS, 1, T0);
    e = pasoAntesala(e, { tipo: "pedido", token: 1, id: IDS[0]! }).estado;
    let s = pasoAntesala(e, marco(e, { audioS: 2 }));
    s = pasoAntesala(s.estado, marco(e, { audioS: 2 + A.esperaClipS }));
    expect(s.abortar).toEqual([IDS[0]]);
    expect(s.estado.clips[0]!.estado).toBe("fallido");
    expect(s.estado.indice).toBe(1);
    expect(s.estado.fallosSeguidos).toBe(1);
  });

  it("reintentos: 429 y red una vez a los reintentoMs; 409 hasta maxReintentos409; 404 final", () => {
    const id = IDS[0]!;
    const pedir = (e: EstadoAntesala) => pasoAntesala(e, { tipo: "pedido", token: 1, id }).estado;
    const responder = (e: EstadoAntesala, resultado: Extract<EntradaAntesala, { tipo: "respuesta" }>["resultado"], ahoraMs = T0) => pasoAntesala(e, { tipo: "respuesta", token: 1, id, ahoraMs, resultado }).estado;
    for (const resultado of [{ tipo: "http", estado: 429 } as const, { tipo: "red" } as const]) {
      let e = responder(pedir(iniciarAntesala(IDS, 1, T0)), resultado);
      expect(e.clips[0]).toMatchObject({ estado: "pendiente", reintentos: 1, noAntesDeMs: T0 + A.reintentoMs });
      expect(siguientePedidoAntesala(e, T0 + A.reintentoMs - 1)).toBeNull();
      expect(siguientePedidoAntesala(e, T0 + A.reintentoMs)).toBe(id);
      e = responder(pedir(e), resultado);
      expect(e.clips[0]!.estado).toBe("fallido");
    }
    let e = iniciarAntesala(IDS, 1, T0);
    for (let k = 0; k < A.maxReintentos409; k++) { e = responder(pedir(e), { tipo: "http", estado: 409 }); expect(e.clips[0]!.estado).toBe("pendiente"); }
    e = responder(pedir(e), { tipo: "http", estado: 409 });
    expect(e.clips[0]!.estado).toBe("fallido");
    for (const final of [{ tipo: "http", estado: 404 } as const, { tipo: "http", estado: 400 } as const, { tipo: "invalida" } as const]) {
      expect(responder(pedir(iniciarAntesala(IDS, 1, T0)), final).clips[0]!.estado).toBe("fallido");
    }
  });

  it("abandono tras maxFallosSeguidos: suelta el reloj; las piezas del 056 no se terminan", () => {
    let e = iniciarAntesala(IDS, 1, T0), s: SalidaAntesala = { estado: e, soltarReloj: false };
    for (let k = 0; k < A.maxFallosSeguidos; k++) {
      e = pasoAntesala(s.estado, { tipo: "pedido", token: 1, id: IDS[k]! }).estado;
      s = pasoAntesala(e, { tipo: "respuesta", token: 1, id: IDS[k]!, ahoraMs: T0, resultado: { tipo: "http", estado: 404 } });
    }
    expect(s.estado).toMatchObject({ fase: "terminada", motivo: "fallos", sonoAlguno: false });
    expect(s.soltarReloj).toBe(true);
    expect(s.terminarPrevia).toBeUndefined();
  });

  it("v1.1 § 2 · tope de pared: se suelta exactamente en t0 + topeS con la fuente cortada; corre aunque el audio esté suspendido", () => {
    let e = preparar(iniciarAntesala(IDS, 1, T0), IDS, 10);
    e = pasoAntesala(e, marco(e, { audioS: 0, ahoraMs: VENCE - 3000 })).estado;
    expect(e.sonando).not.toBeNull();
    expect(pasoAntesala(e, marco(e, { audioS: 1, ahoraMs: VENCE - 1 })).estado.fase).toBe("activa");
    // Audio suspendido (pausa o pestaña oculta): el límite de pared sigue contando.
    const s = pasoAntesala(e, marco(e, { audioS: 1, ahoraMs: VENCE, corre: false }));
    expect(s.estado).toMatchObject({ fase: "terminada", motivo: "tope", sonando: null });
    expect(s.detener).toBe(true);
    expect(s.soltarReloj).toBe(true);
  });

  it("v1.1 § 2 · un clip de 10 s que empieza a t0 + topeS − 3 s se corta a los 3 s; uno decodificado después del límite no arranca", () => {
    let e = preparar(iniciarAntesala(IDS, 1, T0), IDS.slice(0, 1), 10);
    const arranca = pasoAntesala(e, marco(e, { audioS: 0, ahoraMs: VENCE - 3000 }));
    expect(arranca.arrancar).toEqual({ id: IDS[0] });
    const corte = pasoAntesala(arranca.estado, marco(e, { audioS: 3, ahoraMs: VENCE }));
    expect(corte).toMatchObject({ detener: true, soltarReloj: true });
    e = preparar(iniciarAntesala(IDS, 1, T0), IDS.slice(0, 1), 1);
    expect(pasoAntesala(e, marco(e, { audioS: 0, ahoraMs: VENCE + 1 })).arrancar).toBeUndefined();
  });

  it("saltar y voz apagada: detienen la fuente y sueltan; con un token distinto toda entrada es nula", () => {
    const e = pasoAntesala(preparar(iniciarAntesala(IDS, 1, T0), IDS), marco(iniciarAntesala(IDS, 1, T0), { audioS: 0 })).estado;
    expect(e.sonando).not.toBeNull();
    expect(pasoAntesala(e, { tipo: "saltar", token: 1 })).toMatchObject({ detener: true, soltarReloj: true, estado: { fase: "terminada", motivo: "saltada" } });
    expect(pasoAntesala(e, { tipo: "voz-apagada", token: 1 })).toMatchObject({ detener: true, soltarReloj: true, estado: { fase: "terminada", motivo: "voz-apagada" } });
    const viejo = 0;
    for (const x of [marco(e, { token: viejo, audioS: 99, ahoraMs: VENCE + 1 }), { tipo: "saltar", token: viejo }, { tipo: "fin-fuente", token: viejo, id: IDS[0]!, audioS: 9, interrumpida: false }, { tipo: "respuesta", token: viejo, id: IDS[1]!, ahoraMs: T0, resultado: { tipo: "ok", duracionS: 1 } }] as EntradaAntesala[]) {
      expect(pasoAntesala(e, x)).toEqual({ estado: e, soltarReloj: false });
    }
    // Terminada, también nula (fase terminal: no se repite).
    const fin = pasoAntesala(e, { tipo: "saltar", token: 1 }).estado;
    expect(pasoAntesala(fin, marco(fin, { audioS: 50 }))).toEqual({ estado: fin, soltarReloj: false });
  });

  it("v1.1 § 2 · topeS = 0: nunca retiene; una noticia corta el clip y el siguiente arranca en el hueco; a los caducidadS de cursor no arranca nada", () => {
    let e = preparar(iniciarAntesala(IDS, 1, T0, 0), IDS);
    expect(e.retiene).toBe(false);
    // Con una fuente ajena (el narrador) no arranca.
    expect(pasoAntesala(e, marco(e, { fuenteAjena: true })).arrancar).toBeUndefined();
    let s = pasoAntesala(e, marco(e, { audioS: 0, ahoraMs: vencimientoAntesalaMs(T0) + 99_000 }));
    expect(s.arrancar).toEqual({ id: IDS[0] });
    e = pasoAntesala(s.estado, { tipo: "fin-fuente", token: 1, id: IDS[0]!, audioS: 0.4, interrumpida: true }).estado;
    expect(e.clips[0]!.estado).toBe("cortado");
    s = pasoAntesala(e, marco(e, { audioS: 0.4 + A.huecoS, cursorS: 5 }));
    expect(s.arrancar).toEqual({ id: IDS[1] });
    expect(s.soltarReloj).toBe(false);
    const caducada = pasoAntesala(s.estado, marco(e, { audioS: 9, cursorS: PREVIA_ARENA.caducidadS + 0.1 }));
    expect(caducada.estado).toMatchObject({ fase: "terminada", motivo: "caducada" });
    expect(caducada.soltarReloj).toBe(false);
  });
});

describe("058 · activarAntesala (v1.1 § 3)", () => {
  const base = { permitida: true, inicioTick: 0, relojSegundo: 0, relojEstado: "preparando" as const, topeS: A.topeS, ahoraMs: T0, venceMs: VENCE, contextoCorre: true };
  it("(a) en pausa en 0:00 retiene sin iniciar; (c) con la reserva completa en preparando retiene e inicia; (d) con el reloj en marcha, nada", () => {
    expect(activarAntesala({ ...base, relojEstado: "pausada" })).toMatchObject({ retener: true, iniciar: false });
    expect(activarAntesala(base)).toEqual({ retener: true, iniciar: true });
    expect(activarAntesala({ ...base, relojEstado: "reproduciendo" })).toMatchObject({ retener: false, iniciar: false });
    expect(activarAntesala({ ...base, relojSegundo: 0.1 })).toMatchObject({ retener: false, iniciar: false });
  });
  it("sin antesala si inicioTick > 0, sin permiso, tras el límite o con el contexto parado (retiene sin iniciar)", () => {
    expect(activarAntesala({ ...base, inicioTick: 50 })).toMatchObject({ retener: false, iniciar: false });
    expect(activarAntesala({ ...base, permitida: false })).toMatchObject({ retener: false, iniciar: false });
    expect(activarAntesala({ ...base, ahoraMs: VENCE })).toMatchObject({ retener: false, iniciar: false });
    expect(activarAntesala({ ...base, contextoCorre: false })).toMatchObject({ retener: true, iniciar: false, motivo: "audio" });
  });
  it("topeS = 0: retener nunca vale true, e inicia", () => {
    expect(activarAntesala({ ...base, topeS: 0, venceMs: T0 })).toEqual({ retener: false, iniciar: true });
  });
  it("v1.2 (N1): el vencimiento es t0 + topeS en ms monotónicos, con t0 distinto de cero", () => {
    for (const t0 of [1, 12_345.5, 9_999_999]) {
      const vence = vencimientoAntesalaMs(t0);
      expect(vence - t0).toBe(A.topeS * 1000);
      expect(activarAntesala({ ...base, ahoraMs: vence - 1, venceMs: vence }).retener).toBe(true);
      expect(activarAntesala({ ...base, ahoraMs: vence, venceMs: vence }).retener).toBe(false);
    }
  });
});

describe("058 · elegirSolicitud (v1.1 § 5)", () => {
  const p = (clase: "antesala" | "entrada" | "tramo" | "invitado", clave: string = clase) => ({ clase, clave });
  it("prioridades, tope de MAX_EN_VUELO_ANTESALA, nunca dos de la antesala y ningún invitado durante la antesala", () => {
    const todas = [p("invitado"), p("tramo"), p("entrada"), p("antesala")];
    expect(elegirSolicitud(todas, [], "activa")!.clase).toBe("antesala");
    expect(elegirSolicitud(todas, [{ clase: "antesala" }], "activa")!.clase).toBe("entrada");
    expect(elegirSolicitud([p("tramo"), p("invitado")], [{ clase: "antesala" }], "activa")!.clase).toBe("tramo");
    expect(elegirSolicitud([p("invitado")], [], "activa")).toBeNull();
    const llenos = Array.from({ length: MAX_EN_VUELO_ANTESALA }, () => ({ clase: "tramo" as const }));
    expect(elegirSolicitud(todas, llenos, "activa")).toBeNull();
    expect(elegirSolicitud([p("antesala", "b")], [{ clase: "antesala" }], "activa")).toBeNull();
    // Sin antesala no interviene.
    expect(elegirSolicitud([p("invitado")], llenos, "inactiva")!.clase).toBe("invitado");
  });
});

describe("058 · bloqueAntesala", () => {
  it("lee lado y bloque de los ids canónicos y rechaza los demás", () => {
    expect(bloqueAntesala("antesala:01-apertura:0")).toEqual({ lado: null, bloque: "apertura" });
    expect(bloqueAntesala("antesala:07-visita-atras:0")).toEqual({ lado: "visita", bloque: "atras" });
    for (const malo of ["antesala:03-visita-atras:0", "antesala:01-local-apertura:0", "previa:1-local:0", "antesala:02-local-cabecera:1"]) expect(bloqueAntesala(malo)).toBeNull();
  });
});
