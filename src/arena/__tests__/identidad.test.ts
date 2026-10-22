// Brief 055 (v1.1) · Identidad de club derivada del nombre: determinismo, garantías de color medidas
// sobre los tokens REALES de globals.css, regla de choque de equipaciones, iniciales, distribución y
// variables. Ninguna cifra de IDENTIDAD_ARENA se repite a mano: los mínimos se leen de limites.ts.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrasteWcag, equipaciones, hashClub, identidadClub, identidadPartido, iniciales, variablesEquipacion, type IdentidadClub } from "../identidad";
import { IDENTIDAD_ARENA } from "../../sim/limites";
import { LUGARES, PREFIJOS } from "../../sim/plantillas";
import type { RegistroArena } from "../tipos";

const CSS = readFileSync("src/app/globals.css", "utf8");
const P = IDENTIDAD_ARENA.paleta;

/** Declaraciones `--x: valor;` del primer bloque cuyo selector es exactamente `selector`. */
function bloque(selector: string): Record<string, string> {
  const i = CSS.indexOf(`${selector} {`);
  if (i < 0) throw new Error(`Falta el bloque ${selector} en globals.css`);
  const cuerpo = CSS.slice(i + selector.length + 2, CSS.indexOf("}", i));
  return Object.fromEntries([...cuerpo.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(m => [m[1]!, m[2]!.trim()]));
}
const claro = bloque(":root:has(main.arena-shell)");
const oscuroMedia = { ...claro, ...bloque(':root:not([data-theme="light"]):has(main.arena-shell)') };
const oscuroAtributo = { ...claro, ...bloque(':root[data-theme="dark"]:has(main.arena-shell)') };
const TOKENS = ["--ar-grass-a", "--ar-grass-b", "--surface", "--ar-surface-2", "--ar-bug", "--ar-bug-2"] as const;
const token = (tema: Record<string, string>, nombre: string) => {
  const v = tema[nombre];
  if (!v || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`Token ${nombre} ausente o no es hex de 6 cifras: ${v}`);
  return v;
};
const sinNombre = ({ nombre: _nombre, ...resto }: IdentidadClub) => resto;
const leer = (ruta: string) => JSON.parse(readFileSync(ruta, "utf8")) as RegistroArena;
const PUBLICOS = ["public/experimentos/arena-llm-v1.json", "public/experimentos/arena-llm-v3.json", "public/experimentos/arena-duelo-v3.json"].map(leer);
const FIXTURE = leer("src/arena/__fixtures__/arena-reinicios-v3.json");
const nombresDe = (rs: RegistroArena[]) => [...new Set(rs.flatMap(r => [r.config.partido.local.nombre, r.config.partido.visita.nombre]))];

/** Un nombre sintético cuya equipación principal es P[i] (búsqueda determinista). */
function nombreConKit(i: number): string {
  for (let k = 0; k < 10_000; k++) { const n = `Club Ensayo ${k}`; if (identidadClub(n).principal.id === P[i]!.id) return n; }
  throw new Error(`Sin nombre para el kit ${P[i]!.id}`);
}

describe("055 · determinismo", () => {
  it("misma identidad en dos llamadas, con NFD, en mayúsculas y con espacios; `nombre` conserva lo recibido", () => {
    for (const n of [...nombresDe([...PUBLICOS, FIXTURE]), "Unión Ñandú Ávila"]) {
      const base = identidadClub(n);
      expect(identidadClub(n)).toEqual(base);
      for (const variante of [n.normalize("NFD"), n.toUpperCase(), `  ${n}  `]) {
        expect(sinNombre(identidadClub(variante))).toEqual(sinNombre(base));
        expect(identidadClub(variante).nombre).toBe(variante);
        expect(hashClub(variante)).toBe(base.hash);
      }
    }
  });

  it("los clubes distintos de los ejemplos públicos tienen identidades distintas (kit, patrón o forma)", () => {
    const nombres = nombresDe(PUBLICOS);
    expect(nombres.length).toBeGreaterThanOrEqual(4);
    const firmas = nombres.map(n => { const i = identidadClub(n); return `${i.principal.id}/${i.patron}/${i.forma}`; });
    expect(new Set(firmas).size).toBe(nombres.length);
  });

  // Datos dorados (v1.1 § 11), escritos tras la primera implementación: NO son umbrales. Si cambian,
  // cambian los escudos de clubes que el público ya vio; solo se tocan con un brief nuevo.
  it("identidades doradas de los ejemplos públicos y del fixture de reinicios v3", () => {
    const dorado: Record<string, [string, string, string, string]> = {
      "Sporting Montefrío Bajo": ["celeste", "liso", "escudo", "SMB"],
      "Olímpico Brezal": ["granate", "mitades", "redondo", "OB"],
      "Juventud Islaverde Sur": ["celeste", "rayas", "escudo", "JIS"],
      "Atlético Montefrío Bajo": ["naranja", "rayas", "escudo", "AMB"],
      "Club Nebrisa": ["negro", "liso", "escudo", "CN"],
      "Deportivo Brezal": ["celeste", "rayas", "escudo", "DB"],
    };
    expect(Object.keys(dorado).sort()).toEqual(nombresDe([...PUBLICOS, FIXTURE]).sort());
    for (const [n, [kit, patron, forma, ini]] of Object.entries(dorado)) {
      const i = identidadClub(n);
      expect([i.principal.id, i.patron, i.forma, i.iniciales], n).toEqual([kit, patron, forma, ini]);
    }
  });
});

describe("055 · garantías de color sobre los tokens leídos de globals.css", () => {
  it("los seis tokens existen en claro y en los dos bloques oscuros", () => {
    for (const tema of [claro, oscuroMedia, oscuroAtributo]) for (const t of TOKENS) expect(() => token(tema, t)).not.toThrow();
    // Los dos bloques oscuros (media y atributo) deben coincidir en estos tokens.
    for (const t of TOKENS) expect(token(oscuroMedia, t)).toBe(token(oscuroAtributo, t));
  });

  it("contrasteWcag: pares conocidos", () => {
    expect(contrasteWcag("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrasteWcag("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrasteWcag("#ffffff", "#777777")).toBeCloseTo(4.48, 2);
    expect(() => contrasteWcag("#fff", "#000000")).toThrow();
  });

  it.each(P.map(e => [e.id, e] as const))("%s: relleno y tinta frente al césped, dorsal, interfaz clara/oscura y pastilla líder", (_id, e) => {
    for (const franja of ["--ar-grass-a", "--ar-grass-b"]) {
      for (const tema of [claro, oscuroMedia]) {
        expect(contrasteWcag(e.fondo, token(tema, franja))).toBeGreaterThanOrEqual(IDENTIDAD_ARENA.minGrafico);
        expect(contrasteWcag(e.tinta, token(tema, franja))).toBeGreaterThanOrEqual(IDENTIDAD_ARENA.minGrafico);
      }
    }
    expect(contrasteWcag(e.tinta, e.fondo)).toBeGreaterThanOrEqual(IDENTIDAD_ARENA.minTexto);
    for (const sup of ["--surface", "--ar-surface-2"]) expect(contrasteWcag(e.uiClaro, token(claro, sup))).toBeGreaterThanOrEqual(IDENTIDAD_ARENA.minTexto);
    for (const tema of [oscuroMedia, oscuroAtributo]) for (const sup of TOKENS.slice(2)) {
      expect(contrasteWcag(e.uiOscuro, token(tema, sup))).toBeGreaterThanOrEqual(IDENTIDAD_ARENA.minTexto);
    }
    // v1.1 § 1 · Pastilla líder: texto --ar-bug sobre el uiOscuro del equipo.
    expect(contrasteWcag(token(claro, "--ar-bug"), e.uiOscuro)).toBeGreaterThanOrEqual(IDENTIDAD_ARENA.minTexto);
  });

  it("paleta: 0–4 familia oscura, 5–9 familia clara; entre familias siempre ≥ minEntreEquipos", () => {
    const mitad = P.length / 2;
    P.forEach((e, i) => expect(e.familia).toBe(i < mitad ? "oscura" : "clara"));
    for (const a of P.slice(0, mitad)) for (const b of P.slice(mitad)) expect(contrasteWcag(a.fondo, b.fondo)).toBeGreaterThanOrEqual(IDENTIDAD_ARENA.minEntreEquipos);
  });

  it("los valores de reserva del CSS de § 5.5 son copias de los tokens del 047", () => {
    const reserva = (v: string) => { const m = new RegExp(`var\\(${v}, (#[0-9a-f]{6})\\)`, "i").exec(CSS); if (!m) throw new Error(`Sin reserva para ${v}`); return m[1]!.toLowerCase(); };
    expect(reserva("--ar-home-ui-claro")).toBe(claro["--ar-home-ui"]);
    expect(reserva("--ar-away-ui-claro")).toBe(claro["--ar-away-ui"]);
    expect(reserva("--ar-home-ui-oscuro")).toBe(claro["--ar-home-ui-bug"]);
    expect(reserva("--ar-away-ui-oscuro")).toBe(claro["--ar-away-ui-bug"]);
    expect(oscuroMedia["--ar-home-ui"]).toBe(claro["--ar-home-ui-bug"]);
    expect(oscuroMedia["--ar-away-ui"]).toBe(claro["--ar-away-ui-bug"]);
  });
});

describe("055 · regla de equipaciones del partido", () => {
  const nombres = P.map((_, i) => nombreConKit(i));
  it("10×10 principales: contraste ≥ minEntreEquipos, el local nunca cambia y la alternativa solo con la misma familia", () => {
    for (const [i, local] of nombres.entries()) for (const [j, visita] of nombres.entries()) {
      const k = equipaciones(local, visita);
      expect(contrasteWcag(k.local.fondo, k.visita.fondo), `${P[i]!.id} × ${P[j]!.id}`).toBeGreaterThanOrEqual(IDENTIDAD_ARENA.minEntreEquipos);
      expect(k.local).toEqual(P[i]);
      expect(k.visitaAlternativa).toBe(P[i]!.familia === P[j]!.familia);
      expect(k.visita).toEqual(k.visitaAlternativa ? identidadClub(visita).alternativa : P[j]);
      expect(k.visita.familia === k.local.familia).toBe(false);
    }
  });
  it("con el mismo nombre en los dos lados también cumple (la visita viste la alternativa)", () => {
    for (const n of [...nombres, "Olímpico Brezal"]) {
      const k = equipaciones(n, n);
      expect(k.visitaAlternativa).toBe(true);
      expect(contrasteWcag(k.local.fondo, k.visita.fondo)).toBeGreaterThanOrEqual(IDENTIDAD_ARENA.minEntreEquipos);
    }
  });
  it("la alternativa de cada club es siempre de la familia opuesta a su principal", () => {
    for (const p of PREFIJOS) for (const l of LUGARES) { const i = identidadClub(`${p} ${l}`); expect(i.alternativa.familia).not.toBe(i.principal.familia); }
  });
});

describe("055 · iniciales", () => {
  it("palabras de ≥ minLetrasPalabra letras, hasta maxIniciales; una palabra → sus dos primeras letras", () => {
    expect(iniciales("Sporting Montefrío Bajo")).toBe("SMB");
    expect(iniciales("Olímpico Brezal")).toBe("OB");
    expect(iniciales("Club de la Vega")).toBe("CV");
    expect(iniciales("Ormidia")).toBe("OR");
    expect(iniciales("Unión Ñandú Ávila Sur")).toBe("UÑÁ");
    expect(Array.from(iniciales("Atlético Islaverde Sur Norte")).length).toBe(IDENTIDAD_ARENA.maxIniciales);
  });
});

describe("055 · distribución sobre todos los nombres posibles", () => {
  it("PREFIJOS × LUGARES usan los 10 kits, los 5 patrones y las 3 formas, sin que un kit supere maxFraccionPorKit", () => {
    const ids = PREFIJOS.flatMap(p => LUGARES.map(l => identidadClub(`${p} ${l}`)));
    const cuenta = (f: (i: IdentidadClub) => string) => ids.reduce((m, i) => m.set(f(i), (m.get(f(i)) ?? 0) + 1), new Map<string, number>());
    const kits = cuenta(i => i.principal.id);
    expect(new Set(kits.keys())).toEqual(new Set(P.map(e => e.id)));
    expect(new Set(cuenta(i => i.patron).keys())).toEqual(new Set(IDENTIDAD_ARENA.patrones));
    expect(new Set(cuenta(i => i.forma).keys())).toEqual(new Set(IDENTIDAD_ARENA.formas));
    for (const n of kits.values()) expect(n / ids.length).toBeLessThanOrEqual(IDENTIDAD_ARENA.maxFraccionPorKit);
  });
});

describe("055 · variables de equipación", () => {
  it("exactamente las 10 claves de § 5.5 con los valores de la paleta", () => {
    const k = equipaciones("Juventud Islaverde Sur", "Atlético Montefrío Bajo"), v = variablesEquipacion(k);
    expect(Object.keys(v).sort()).toEqual(["--ar-away", "--ar-away-ink", "--ar-away-ring", "--ar-away-ui-claro", "--ar-away-ui-oscuro", "--ar-home", "--ar-home-ink", "--ar-home-ring", "--ar-home-ui-claro", "--ar-home-ui-oscuro"]);
    expect(v).toEqual({
      "--ar-home": k.local.fondo, "--ar-home-ink": k.local.tinta, "--ar-home-ring": k.local.tinta, "--ar-home-ui-claro": k.local.uiClaro, "--ar-home-ui-oscuro": k.local.uiOscuro,
      "--ar-away": k.visita.fondo, "--ar-away-ink": k.visita.tinta, "--ar-away-ring": k.visita.tinta, "--ar-away-ui-claro": k.visita.uiClaro, "--ar-away-ui-oscuro": k.visita.uiOscuro,
    });
    expect(Object.values(v).every(c => P.some(e => [e.fondo, e.tinta, e.uiClaro, e.uiOscuro].includes(c as never)))).toBe(true);
    expect(identidadPartido("Juventud Islaverde Sur", "Atlético Montefrío Bajo").variables).toEqual(v);
  });
});

describe("055 · sin hex literales en los TSX", () => {
  it.each(["src/ui/Escudo.tsx", "src/ui/Emblema.tsx", "src/ui/IconosArena.tsx", "src/ui/Arena.tsx"])("%s", ruta => {
    const fuente = readFileSync(ruta, "utf8");
    const sinComentarios = fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
    expect(sinComentarios.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
});
