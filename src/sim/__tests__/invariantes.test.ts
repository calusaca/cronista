// Suite rápida — invariantes 1–6 del brief 001. Corre en cada `npm test`.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  verificarCambiosYPeriodos,
  verificarContrato,
  verificarDesenlaces,
  verificarExpulsados,
  verificarJugadores,
  verificarMinutos,
  verificarRelaciones,
  verificarSalidas,
} from "../invariantes";
import { DESCUENTO_FINAL_FRACCION_MIN } from "../limites";
import { simular } from "../motor";
import { configDeSemilla } from "../plantillas";
import { MAX_CAMBIOS, SUPLENTES, TITULARES, type Evento, type Partido } from "../tipos";

/** Semillas fijas del smoke del brief (también las de la prop. 1). */
const SEMILLAS_FIJAS = [7, 42, 1999];
/** Corpus de la suite rápida: semillas 1..CORPUS (la estadística usa 1..1000). */
const CORPUS = 300;

const partidos: Partido[] = [];
for (let s = 1; s <= CORPUS; s++) partidos.push(simular(configDeSemilla(s)));

function clonar(p: Partido): Partido {
  return JSON.parse(JSON.stringify(p)) as Partido;
}

function sinViolaciones(verificar: (p: Partido) => string[]): void {
  const fallas: string[] = [];
  for (const p of partidos) {
    for (const e of verificar(p)) fallas.push(`seed ${p.config.seed}: ${e}`);
  }
  expect(fallas.slice(0, 10)).toEqual([]);
}

function buscar(p: Partido, pred: (e: Evento, i: number) => boolean): number {
  return p.eventos.findIndex(pred);
}

describe("prop. 1 — determinismo", () => {
  it.each(SEMILLAS_FIJAS)("semilla %i: misma semilla ⇒ mismo Partido byte a byte", (seed) => {
    const a = JSON.stringify(simular(configDeSemilla(seed)));
    const b = JSON.stringify(simular(configDeSemilla(seed)));
    expect(a).toBe(b);
  });

  it(`prop. 13 — el corpus completo 1..${CORPUS} simulado DOS veces da el mismo hash por partido`, () => {
    // Segunda pasada en orden inverso: detecta además estado que se filtre entre simulaciones.
    const hash = (p: Partido) => createHash("sha256").update(JSON.stringify(p)).digest("hex");
    const primera = partidos.map(hash);
    const segunda: string[] = [];
    for (let s = CORPUS; s >= 1; s--) segunda[s - 1] = hash(simular(configDeSemilla(s)));
    const distintas = primera.flatMap((h, i) => (h === segunda[i] ? [] : [`seed ${i + 1}`]));
    expect(distintas).toEqual([]);
    const total = (hs: string[]) => createHash("sha256").update(hs.join("")).digest("hex");
    expect(total(segunda)).toBe(total(primera));
  });

  it("el Partido guarda la semilla normalizada y simular(p.config) lo reproduce", () => {
    for (const seed of [-1, 2 ** 32, 2 ** 32 + 7, 7]) {
      const p = simular({ ...configDeSemilla(7), seed });
      expect(p.config.seed).toBe(seed >>> 0);
      expect(p.config.seed).toBeGreaterThanOrEqual(0);
      expect(JSON.stringify(simular(p.config))).toBe(JSON.stringify(p));
    }
    // 2³² + 7 y 7 son la misma semilla normalizada ⇒ mismos eventos.
    const a = simular({ ...configDeSemilla(7), seed: 2 ** 32 + 7 });
    const b = simular(configDeSemilla(7));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("semillas distintas ⇒ partidos distintos", () => {
    const jsons = SEMILLAS_FIJAS.map((s) => JSON.stringify(simular(configDeSemilla(s)).eventos));
    expect(new Set(jsons).size).toBe(SEMILLAS_FIJAS.length);
  });

  it("simular no muta la configuración recibida", () => {
    const cfg = configDeSemilla(42);
    const antes = JSON.stringify(cfg);
    simular(cfg);
    expect(JSON.stringify(cfg)).toBe(antes);
  });

  it("Math.random no aparece en ningún archivo de src/sim/", () => {
    const raiz = fileURLToPath(new URL("..", import.meta.url));
    // Se quitan comentarios y literales de texto (que pueden nombrar la prohibición)
    // y se busca acceso real en código: Math.random, Math . random o Math[...].
    const sinComentarios = (src: string) =>
      src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "")
        .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, '""');
    const acceso = /\bMath\s*(?:\.\s*random\b|\[)/;
    const culpables: string[] = [];
    const propio = fileURLToPath(import.meta.url);
    const recorrer = (dir: string): void => {
      for (const nombre of readdirSync(dir)) {
        const ruta = join(dir, nombre);
        if (statSync(ruta).isDirectory()) recorrer(ruta);
        // Se exime solo a este archivo: contiene el detector y sus casos de prueba.
        else if (ruta === propio) continue;
        else if (nombre.endsWith(".ts") && acceso.test(sinComentarios(readFileSync(ruta, "utf8")))) culpables.push(ruta);
      }
    };
    // El detector mismo tiene que funcionar (si no, esta prueba no protege nada).
    expect(acceso.test(sinComentarios("const x = Math.random();"))).toBe(true);
    expect(acceso.test(sinComentarios('const x = Math["random"]();'))).toBe(true);
    expect(acceso.test(sinComentarios("// Math.random está prohibido"))).toBe(false);
    recorrer(raiz);
    expect(culpables).toEqual([]);
  });
});

describe(`props. 2–6 sobre el corpus 1..${CORPUS}`, () => {
  it("prop. 2 — minutos monótonos y dentro de [0, fin_periodo final]", () => sinViolaciones(verificarMinutos));
  it("prop. 3 — gol/atajada → tiro anterior del mismo equipo; tarjeta → falta previa", () =>
    sinViolaciones(verificarRelaciones));
  it("prop. 4 — un expulsado no aparece en eventos posteriores", () => sinViolaciones(verificarExpulsados));
  it("prop. 5 — jugadores de su plantilla; suplente solo tras su cambio", () => sinViolaciones(verificarJugadores));
  it(`prop. 6 — máximo ${MAX_CAMBIOS} cambios; 2 inicios y 2 fines`, () => sinViolaciones(verificarCambiosYPeriodos));
  it("contrato — ids secuenciales, xg/penal/sale donde corresponde, gol y tarjeta coherentes", () =>
    sinViolaciones(verificarContrato));
  it("prop. 14 — cada tiro tiene a lo sumo un desenlace; relacionadoCon de gol/atajada no se repite", () =>
    sinViolaciones(verificarDesenlaces));
  it("prop. 15 — quien sale en un cambio no aparece en eventos posteriores", () => sinViolaciones(verificarSalidas));
  it(`prop. 16 — al menos DESCUENTO_FINAL_FRACCION_MIN de los partidos termina después del 90`, () => {
    const conDescuento = partidos.filter((p) => (p.eventos[p.eventos.length - 1] as Evento).minuto > 90).length;
    expect(conDescuento / partidos.length).toBeGreaterThanOrEqual(DESCUENTO_FINAL_FRACCION_MIN);
  });
});

describe("el corpus ejercita las invariantes (no son vacías)", () => {
  const todos = partidos.flatMap((p) => p.eventos);
  it.each(["gol", "atajada", "tarjeta_amarilla", "tarjeta_roja", "cambio", "pase_clave", "corner", "fuera_de_juego", "falta"] as const)(
    "aparece al menos un evento %s",
    (tipo) => {
      expect(todos.some((e) => e.tipo === tipo)).toBe(true);
    },
  );
  it("aparece al menos un penal", () => expect(todos.some((e) => e.penal === true)).toBe(true));
  it("aparece al menos una expulsión por doble amarilla (roja a un amonestado)", () => {
    const hay = partidos.some((p) =>
      p.eventos.some(
        (r, i) =>
          r.tipo === "tarjeta_roja" &&
          p.eventos.slice(0, i).some((a) => a.tipo === "tarjeta_amarilla" && a.jugador === r.jugador && a.equipo === r.equipo),
      ),
    );
    expect(hay).toBe(true);
  });
  it("todo cambio lleva sale, y algún jugador que sale había protagonizado acciones antes", () => {
    const cambios = partidos.flatMap((p) => p.eventos.filter((e) => e.tipo === "cambio"));
    expect(cambios.length).toBeGreaterThan(0);
    expect(cambios.every((c) => typeof c.sale === "string" && c.sale !== "")).toBe(true);
    const hay = partidos.some((p) =>
      p.eventos.some(
        (c, i) => c.tipo === "cambio" && p.eventos.slice(0, i).some((e) => e.equipo === c.equipo && e.jugador === c.sale),
      ),
    );
    expect(hay).toBe(true);
  });
  it("un suplente llega a protagonizar una acción después de entrar", () => {
    const hay = partidos.some((p) => {
      const entraron = new Set(p.eventos.filter((e) => e.tipo === "cambio").map((e) => `${e.equipo}|${e.jugador}`));
      return p.eventos.some((e) => e.tipo !== "cambio" && entraron.has(`${e.equipo}|${e.jugador}`));
    });
    expect(hay).toBe(true);
  });
});

describe("plantillas ficticias", () => {
  it.each(SEMILLAS_FIJAS)("semilla %i: dos equipos distintos, 16 jugadores, nombres únicos", (seed) => {
    const { local, visita } = configDeSemilla(seed);
    expect(local.nombre).not.toBe(visita.nombre);
    for (const eq of [local, visita]) {
      expect(eq.jugadores).toHaveLength(TITULARES + SUPLENTES);
      expect(eq.jugadores[0]?.posicion).toBe("POR");
    }
    const nombres = [...local.jugadores, ...visita.jugadores].map((j) => j.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
  });
});

// Mutaciones de control: cada verificador debe detectar un partido roto a mano.
// Si alguno siguiera verde con la mutación, esa prueba no protegería nada.
describe("mutaciones de control sobre los verificadores", () => {
  const base = partidos.find(
    (p) =>
      p.eventos.some((e) => e.tipo === "gol") &&
      p.eventos.some((e) => e.tipo === "tarjeta_roja") &&
      p.eventos.some((e) => e.tipo === "cambio"),
  ) as Partido;

  it("el partido base existe y está limpio", () => {
    expect(base).toBeDefined();
    for (const v of [verificarMinutos, verificarRelaciones, verificarExpulsados, verificarJugadores, verificarCambiosYPeriodos, verificarDesenlaces, verificarSalidas, verificarContrato]) {
      expect(v(base)).toEqual([]);
    }
  });

  it("prop. 3 detecta un gol cuyo relacionadoCon no apunta a un tiro", () => {
    const p = clonar(base);
    const i = buscar(p, (e) => e.tipo === "gol");
    (p.eventos[i] as Evento).relacionadoCon = (p.eventos[0] as Evento).id;
    expect(verificarRelaciones(p).length).toBeGreaterThan(0);
  });

  it("prop. 3 detecta un gol sin relacionadoCon", () => {
    const p = clonar(base);
    const i = buscar(p, (e) => e.tipo === "gol");
    delete (p.eventos[i] as Evento).relacionadoCon;
    expect(verificarRelaciones(p).length).toBeGreaterThan(0);
  });

  it("prop. 3 detecta un gol que apunta a un tiro del otro equipo", () => {
    const p = clonar(base);
    const i = buscar(p, (e) => e.tipo === "gol");
    const gol = p.eventos[i] as Evento;
    const ajeno = p.eventos.slice(0, i).find((e) => e.tipo === "tiro" && e.equipo !== gol.equipo);
    expect(ajeno).toBeDefined();
    gol.relacionadoCon = (ajeno as Evento).id;
    expect(verificarRelaciones(p).length).toBeGreaterThan(0);
  });

  it("prop. 3 detecta una tarjeta que apunta a un evento que no es falta", () => {
    const p = clonar(base);
    const i = buscar(p, (e) => e.tipo === "tarjeta_roja");
    (p.eventos[i] as Evento).relacionadoCon = (p.eventos[0] as Evento).id;
    expect(verificarRelaciones(p).length).toBeGreaterThan(0);
  });

  it("prop. 2 detecta un minuto que retrocede", () => {
    const p = clonar(base);
    const i = buscar(p, (e) => e.minuto > 50);
    (p.eventos[i] as Evento).minuto = 10;
    expect(verificarMinutos(p).length).toBeGreaterThan(0);
  });

  it("prop. 2 detecta un evento después del fin_periodo final", () => {
    const p = clonar(base);
    const ultimo = p.eventos[p.eventos.length - 2] as Evento;
    ultimo.minuto = (p.eventos[p.eventos.length - 1] as Evento).minuto + 5;
    expect(verificarMinutos(p).length).toBeGreaterThan(0);
  });

  it("prop. 4 detecta a un expulsado que vuelve a aparecer", () => {
    const p = clonar(base);
    const i = buscar(p, (e) => e.tipo === "tarjeta_roja");
    const roja = p.eventos[i] as Evento;
    const despues = p.eventos.findIndex((e, j) => j > i && e.equipo === roja.equipo && e.jugador !== undefined);
    expect(despues).toBeGreaterThan(i);
    (p.eventos[despues] as Evento).jugador = roja.jugador as string;
    expect(verificarExpulsados(p).length).toBeGreaterThan(0);
  });

  it("prop. 4 detecta a un jugador con dos amarillas que vuelve a aparecer", () => {
    const p = clonar(base);
    const fin = p.eventos.length - 1;
    const atk = p.eventos.find((e) => e.tipo === "tiro") as Evento;
    const mk = (id: string, tipo: Evento["tipo"]): Evento => ({ id, minuto: (p.eventos[fin] as Evento).minuto, tipo, equipo: atk.equipo, jugador: atk.jugador as string });
    p.eventos.splice(fin, 0, mk("x1", "tarjeta_amarilla"), mk("x2", "tarjeta_amarilla"), mk("x3", "falta"));
    expect(verificarExpulsados(p).length).toBeGreaterThan(0);
  });

  it("prop. 5 detecta un jugador que no está en la plantilla", () => {
    const p = clonar(base);
    const i = buscar(p, (e) => e.jugador !== undefined);
    (p.eventos[i] as Evento).jugador = "Jugador Inexistente";
    expect(verificarJugadores(p).length).toBeGreaterThan(0);
  });

  it("prop. 5 detecta un suplente que aparece antes de su cambio", () => {
    const p = clonar(base);
    const i = buscar(p, (e) => e.tipo === "cambio");
    const cambio = p.eventos[i] as Evento;
    const antes = p.eventos.findIndex((e, j) => j < i && e.equipo === cambio.equipo && e.jugador !== undefined);
    expect(antes).toBeGreaterThanOrEqual(0);
    (p.eventos[antes] as Evento).jugador = cambio.jugador as string;
    expect(verificarJugadores(p).length).toBeGreaterThan(0);
  });

  it(`prop. 6 detecta más de ${MAX_CAMBIOS} cambios`, () => {
    const p = clonar(base);
    const i = buscar(p, (e) => e.tipo === "cambio");
    const c = p.eventos[i] as Evento;
    for (let k = 0; k <= MAX_CAMBIOS; k++) p.eventos.splice(i, 0, { ...c });
    expect(verificarCambiosYPeriodos(p).length).toBeGreaterThan(0);
  });

  it("prop. 6 detecta un fin_periodo faltante", () => {
    const p = clonar(base);
    p.eventos = p.eventos.filter((e, j) => !(e.tipo === "fin_periodo" && j < p.eventos.length - 1));
    expect(verificarCambiosYPeriodos(p).length).toBeGreaterThan(0);
  });

  it("prop. 14 detecta un tiro con dos desenlaces (gol + atajada)", () => {
    const p = clonar(base);
    const i = buscar(p, (e) => e.tipo === "gol");
    const gol = p.eventos[i] as Evento;
    p.eventos.splice(i + 1, 0, { id: "x1", minuto: gol.minuto, tipo: "atajada", equipo: gol.equipo, relacionadoCon: gol.relacionadoCon as string });
    expect(verificarDesenlaces(p).length).toBeGreaterThan(0);
    // Y las demás invariantes no lo veían: la 3 sigue verde con el doble desenlace.
    expect(verificarRelaciones(p)).toEqual([]);
  });

  it("prop. 14 detecta dos goles colgados del mismo tiro", () => {
    const p = clonar(base);
    const i = buscar(p, (e) => e.tipo === "gol");
    const gol = p.eventos[i] as Evento;
    p.eventos.splice(i + 1, 0, { ...gol, id: "x1" });
    expect(verificarDesenlaces(p).length).toBeGreaterThan(0);
  });

  it("prop. 15 detecta a un jugador que reaparece después de salir", () => {
    const p = clonar(base);
    const i = buscar(p, (e) => e.tipo === "cambio");
    const cambio = p.eventos[i] as Evento;
    const despues = p.eventos.findIndex((e, j) => j > i && e.equipo === cambio.equipo && e.jugador !== undefined && e.tipo !== "cambio");
    expect(despues).toBeGreaterThan(i);
    (p.eventos[despues] as Evento).jugador = cambio.sale as string;
    expect(verificarSalidas(p).length).toBeGreaterThan(0);
  });

  it("prop. 15 detecta que sale alguien que no está en la plantilla", () => {
    const p = clonar(base);
    const i = buscar(p, (e) => e.tipo === "cambio");
    (p.eventos[i] as Evento).sale = "Jugador Inexistente";
    expect(verificarSalidas(p).length).toBeGreaterThan(0);
  });

  it("contrato detecta un cambio sin sale y un sale fuera de un cambio", () => {
    const p = clonar(base);
    const i = buscar(p, (e) => e.tipo === "cambio");
    delete (p.eventos[i] as Evento).sale;
    expect(verificarContrato(p).length).toBeGreaterThan(0);
    const q = clonar(base);
    (q.eventos[buscar(q, (e) => e.tipo === "falta")] as Evento).sale = "alguien";
    expect(verificarContrato(q).length).toBeGreaterThan(0);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 0, 1, 1.5, -0.2])("prop. 17 — contrato rechaza un tiro con xg %s", (xg) => {
    const p = clonar(base);
    const i = buscar(p, (e) => e.tipo === "tiro" && !p.eventos.some((g) => g.tipo === "gol" && g.relacionadoCon === e.id));
    (p.eventos[i] as Evento).xg = xg;
    expect(verificarContrato(p).length).toBeGreaterThan(0);
  });

  it("prop. 17 — contrato rechaza un gol (y su tiro) con xg NaN", () => {
    const p = clonar(base);
    const i = buscar(p, (e) => e.tipo === "gol");
    const gol = p.eventos[i] as Evento;
    gol.xg = Number.NaN;
    (p.eventos.find((e) => e.id === gol.relacionadoCon) as Evento).xg = Number.NaN;
    expect(verificarContrato(p).length).toBeGreaterThan(0);
  });

  it("contrato detecta un gol que no hereda el xg de su tiro", () => {
    const p = clonar(base);
    const i = buscar(p, (e) => e.tipo === "gol");
    (p.eventos[i] as Evento).xg = 0.99;
    expect(verificarContrato(p).length).toBeGreaterThan(0);
  });
});
