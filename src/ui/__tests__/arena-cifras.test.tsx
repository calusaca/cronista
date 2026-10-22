// Brief 049 · Panel «Cifras del partido», ficha del jugador y favoritos (renderToStaticMarkup).
// v1.1 § 12: los valores esperados se cuentan aquí con filtros sobre el JSON del fixture; nunca
// llamando a cifrasEquipos.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { rematesPorLado } from "../../arena/estadista";
import { agregarPrefijo, crearMemoAgregado, ETIQUETAS_CIFRAS } from "../../arena/estadisticas";
import { FAVORITOS_VACIOS, favoritosEn } from "../../arena/favoritos";
import type { RegistroArena } from "../../arena/tipos";
import { estadoVisual } from "../../arena/vista";
import { ARENA, ESTADISTICAS_ARENA } from "../../sim/limites";
import type { Lado } from "../../sim/tipos";
import { Arena } from "../Arena";
import { anchoBarra, ArenaCifras } from "../ArenaCifras";
import { AvisosFavoritos } from "../ArenaFavoritos";
import { ArenaPlantilla } from "../ArenaPlantilla";

const leer = (ruta: string) => JSON.parse(readFileSync(ruta, "utf8")) as RegistroArena;
const v3 = leer("src/arena/__fixtures__/arena-reinicios-v3.json");
const ejemplo = leer("public/experimentos/arena-llm-v3.json");
const prefijo = (r: RegistroArena, tick: number): RegistroArena => ({ ...r, eventos: r.eventos.filter(e => e.tick <= tick), fotogramas: r.fotogramas.filter(f => f.tick <= tick), final: [...r.fotogramas].reverse().find(f => f.tick <= tick)! });
const panel = (r: RegistroArena, tick: number, idioma: "es" | "en", favorito: Lado | null = null) => renderToStaticMarkup(<ArenaCifras registro={r} tick={tick} idioma={idioma} favorito={favorito} />);
const filas = (html: string) => [...html.matchAll(/class="arena-stat-row" data-stat="([^"]+)" data-leader="([^"]+)" data-class="([^"]+)"/g)].map(m => ({ clave: m[1]!, lider: m[2]!, clase: m[3]! }));
/** Líder contado aquí: mayor gana salvo en mejorMenor; empate ⇒ none. */
const lider = (clave: string, l: number, v: number) => l === v ? "none" : (l > v) !== (ESTADISTICAS_ARENA.mejorMenor as readonly string[]).includes(clave) ? "local" : "visita";

describe("049 · ArenaCifras", () => {
  const medio = 200, fin = v3.final.tick;
  it("ES y EN a un tick intermedio: orden de filasPanel, líderes contados aparte, clases, «en vivo»", () => {
    for (const idioma of ["es", "en"] as const) {
      const html = panel(v3, medio, idioma), f = filas(html);
      expect(f.map(x => x.clave)).toEqual([...ESTADISTICAS_ARENA.filasPanel]);
      for (const clave of ESTADISTICAS_ARENA.filasPanel) expect(html).toContain(ETIQUETAS_CIFRAS[clave][idioma].replace(/[()]/g, m => m));
      expect(f.filter(x => x.clase === "estimada").map(x => x.clave)).toEqual(["igr", "remates_cercanos"]);
      expect(f.filter(x => x.clase !== "estimada").every(x => x.clase === "registrada")).toBe(true);
      expect(html).toContain(idioma === "es" ? "estimado" : "estimated");
      expect(html).not.toMatch(/xG|goles esperados|expected goals/i);
      expect(html).toContain(idioma === "es" ? "Cifras del partido · en vivo" : "Match stats · live");
      expect(html).not.toContain("data-final");
      const ev = v3.eventos.filter(e => e.tick <= medio), n = (tipo: string, lado: Lado) => ev.filter(e => e.tipo === tipo && e.lado === lado).length;
      for (const [clave, tipo] of [["remates", "tiro"], ["atajadas", "atajada"], ["fueras_juego", "fuera_juego"], ["faltas", "falta"], ["amarillas", "amarilla"]] as const) {
        expect([clave, f.find(x => x.clave === clave)!.lider]).toEqual([clave, lider(clave, n(tipo, "local"), n(tipo, "visita"))]);
      }
      const rp = rematesPorLado(v3.eventos, medio);
      expect(f.find(x => x.clave === "remates_directos")!.lider).toBe(lider("remates_directos", rp.local.aPuerta, rp.visita.aPuerta));
    }
  });

  it("al final: «Cifras finales» y data-final; en el tick 0 del ejemplo público, «Esperando el inicio» sin filas", () => {
    const html = panel(v3, fin, "es");
    expect(html).toContain("Cifras finales"); expect(html).toContain('data-final="true"');
    const vacio = panel(ejemplo, 0, "es");
    expect(vacio).toContain("Esperando el inicio"); expect(filas(vacio)).toHaveLength(0);
    expect(panel(ejemplo, 0, "en")).toContain("Waiting for kick-off");
  });

  it("«Destacados» solo al final: el máximo de remates a puerta (del 045), con empate al primero de la plantilla", () => {
    expect(panel(v3, medio, "en")).not.toContain("arena-stats-highlights");
    const html = panel(v3, fin, "en");
    expect(html).toContain('data-testid="arena-stats-highlights"');
    const directos = new Map<string, number>();
    for (const lado of ["local", "visita"] as const) { const ids = rematesPorLado(v3.eventos, fin)[lado].eventos; ids.forEach((id, i) => { const t = v3.eventos.find(e => e.id === id)!; const sig = ids[i + 1]; if (t.tipo === "tiro" && sig && v3.eventos.find(e => e.id === sig)!.tipo !== "tiro") directos.set(t.jugador, (directos.get(t.jugador) ?? 0) + 1); }); }
    const orden = (["local", "visita"] as const).flatMap(l => [...v3.inicial.jugadores, ...v3.inicial.banco ?? []].filter(j => j.lado === l));
    const max = Math.max(...directos.values()), primero = orden.find(j => directos.get(j.id) === max)!;
    expect(html).toMatch(new RegExp(`data-stat="remates_directos"[^>]*><span>Most shots on target</span><strong>${primero.nombre} · ${primero.dorsal}`));
  });

  it("un registro sin entrenadores ni reglas marca faltas, tarjetas y esquinas como «no simulado»", () => {
    const v1 = leer("public/experimentos/arena-llm-v1.json"), html = panel(v1, v1.final.tick, "es");
    for (const clave of ["faltas", "amarillas", "rojas", "esquinas"]) expect(html).toMatch(new RegExp(`data-stat="${clave}"[^]*?no simulado en este registro`));
    expect(html).not.toMatch(/data-stat="remates"[^>]*>(?:(?!data-stat=).)*no simulado/);
  });

  it("columna del club favorito marcada; barras con el mínimo visible", () => {
    const html = panel(v3, fin, "en", "visita");
    expect(html).toMatch(/data-side="visita" data-favorite="true"/);
    expect(html).not.toMatch(/data-side="local" data-favorite/);
    const c = (v: number | null) => ({ clave: "remates" as const, valor: v, clase: "registrada" as const, evidencia: { eventos: [] } });
    expect(anchoBarra({ clave: "remates", local: c(1), visita: c(99) }, "local")).toBe(ESTADISTICAS_ARENA.barraMinPct);
    expect(anchoBarra({ clave: "remates", local: c(0), visita: c(3) }, "local")).toBe(0);
    expect(anchoBarra({ clave: "remates", local: c(null), visita: c(3) }, "visita")).toBe(100);
    expect(anchoBarra({ clave: "posesion_pct", local: c(62), visita: c(38) }, "local")).toBe(62);
  });
});

describe("049 · ficha del jugador", () => {
  const plantilla = (r: RegistroArena, tick: number, id: string, idioma: "es" | "en" = "es", extra: Record<string, unknown> = {}) =>
    renderToStaticMarkup(<ArenaPlantilla estado={estadoVisual(v3, tick * ARENA.pasoS, true)} registro={r} seleccionado={id} seleccionar={() => {}} idioma={idioma} tick={tick} {...extra} />);
  const stat = (html: string, clave: string) => html.match(new RegExp(`<div data-stat="${clave}"[^>]*><dt>[^<]*</dt><dd[^>]*>(.*?)</dd></div>`))?.[1];
  const tiros = new Map<string, number>(); for (const e of v3.eventos) if (e.tipo === "tiro") tiros.set(e.jugador, (tiros.get(e.jugador) ?? 0) + 1);
  const rematador = [...tiros].sort((a, b) => b[1] - a[1])[0]![0];
  it("las cifras del máximo rematador cambian entre un tick intermedio y el final; remates contados aparte", () => {
    const medio = 150, html = plantilla(v3, medio, rematador), final = plantilla(v3, v3.final.tick, rematador);
    expect(html).toContain('data-testid="arena-player-stats" data-tick="150"');
    expect(html).not.toBe(final);
    expect(stat(html, "remates")!.startsWith(String(v3.eventos.filter(e => e.tick <= medio && e.tipo === "tiro" && e.jugador === rematador).length))).toBe(true);
    expect(stat(final, "remates")!.startsWith(String(tiros.get(rematador)))).toBe(true);
    expect(stat(final, "atajadas")).toBeUndefined();
  });

  it("atajadas solo con puesto POR; el render con el registro completo es igual al del prefijo", () => {
    const portero = v3.inicial.jugadores.find(j => j.puesto === "POR" && j.lado === "visita")!;
    const html = plantilla(v3, v3.final.tick, portero.id);
    expect(stat(html, "atajadas")!.startsWith(String(v3.eventos.filter(e => e.tipo === "atajada" && e.jugador === portero.id).length))).toBe(true);
    for (const t of [0, 121, 177, 250, 336, v3.final.tick]) for (const id of [rematador, portero.id]) expect(plantilla(v3, t, id)).toBe(plantilla(prefijo(v3, t), t, id));
    // Los rasgos siguen siendo 9 medidores.
    expect(html.match(/<meter /g)).toHaveLength(9);
  });

  it("evidencia: botones de salto deshabilitados sin transporte y habilitados con él", () => {
    const sin = plantilla(v3, v3.final.tick, rematador), con = plantilla(v3, v3.final.tick, rematador, "es", { transporte: true, saltar: () => {} });
    expect(sin).toMatch(/class="arena-evidence-link" disabled=""/);
    expect(con).not.toMatch(/class="arena-evidence-link" disabled=""/);
    expect(con).toContain("Ver los eventos de estas cifras");
  });

  it("la ficha del favorito lleva data-favorite y su estrella pulsada", () => {
    const html = plantilla(v3, 100, rematador, "en", { favorito: true, alternarFavorito: () => {} });
    expect(html).toMatch(/data-testid="arena-player-card" data-favorite="true"/);
    expect(html).toMatch(/aria-pressed="true"[^>]*data-testid="arena-favorite-player"/);
    expect(plantilla(v3, 100, rematador, "en", { alternarFavorito: () => {} })).not.toMatch(/data-testid="arena-player-card" data-favorite/);
  });

  it("una sola agregación por (registro, tick) aunque el panel y la ficha se rendericen varias veces", () => {
    let n = 0; const memo = crearMemoAgregado((r, t) => { n++; return agregarPrefijo(r, t); });
    for (let i = 0; i < 3; i++) { renderToStaticMarkup(<ArenaCifras registro={v3} tick={200} idioma="es" favorito={null} memo={memo} />); plantilla(v3, 200, rematador, "es", { memo }); }
    expect(n).toBe(1);
  });
});

describe("049 · revisión Codex: rendimiento y notas de muestreo", () => {
  it("tres renders seguidos del panel y la ficha al mismo tick leen registro.eventos una sola vez", () => {
    let lecturas = 0;
    const r = new Proxy(v3, { get(t, k, rec) { if (k === "eventos") lecturas++; return Reflect.get(t, k, rec); } });
    const memo = crearMemoAgregado(), estado = estadoVisual(v3, 200 * ARENA.pasoS, true), id = v3.inicial.jugadores[3]!.id;
    for (let i = 0; i < 3; i++) renderToStaticMarkup(<><ArenaCifras registro={r} tick={200} idioma="es" favorito={null} memo={memo} />
      <ArenaPlantilla estado={estado} registro={r} seleccionado={id} seleccionar={() => {}} idioma="es" tick={200} memo={memo} /></>);
    expect(lecturas).toBe(1);
    // Otro tick: una lectura más (nueva agregación), nunca una por render.
    renderToStaticMarkup(<ArenaCifras registro={r} tick={201} idioma="es" favorito={null} memo={memo} />);
    expect(lecturas).toBe(2);
  });

  it("las notas declaran el descarte conservador de distancia y el balón parado según lo que simula el registro", () => {
    const v1 = leer("public/experimentos/arena-llm-v1.json");
    const conTodo = panel(v3, v3.final.tick, "es"), sinSaques = panel(ejemplo, ejemplo.final.tick, "es"), legado = panel(v1, v1.final.tick, "es");
    for (const html of [conTodo, sinSaques, legado]) expect(html).toContain("subestima el recorrido de forma conservadora");
    expect(conTodo).toContain("El balón parado (pausas y saques) no se atribuye");
    expect(sinSaques).toContain("el tiempo del portero que reanuda sí cuenta como posesión");
    expect(legado).toContain("Este registro no tiene pausas ni saques: el tiempo del ejecutor sí cuenta como posesión");
    expect(legado).not.toContain("no se atribuye a ningún equipo");
    expect(panel(v1, v1.final.tick, "en")).toContain("time does count as possession");
    const ficha = renderToStaticMarkup(<ArenaPlantilla estado={estadoVisual(v1, 1, true)} registro={v1} seleccionado={null} seleccionar={() => {}} idioma="es" tick={v1.final.tick} />);
    expect(ficha).toContain("subestima el recorrido de forma conservadora");
    expect(ficha).toContain("el tiempo del ejecutor sí cuenta como posesión");
  });
});

describe("049 · favoritos en la interfaz", () => {
  const L = v3.config.partido.local.nombre;
  it("«no juega este partido» con botón «Olvidar favorito» cuando el favorito no resuelve; nada si juega", () => {
    const fuera = { club: "Club Ausente", jugador: { club: "Club Ausente", dorsal: 9, nombre: "Nadie" } };
    const html = renderToStaticMarkup(<AvisosFavoritos favoritos={fuera} presentes={favoritosEn(v3, fuera)} error={false} idioma="es" olvidar={() => {}} />);
    expect(html).toContain("Tu club favorito, Club Ausente, no juega este partido");
    expect(html).toContain("no juega este partido");
    expect(html).toContain("Olvidar favorito");
    const dentro = { club: L, jugador: null };
    expect(renderToStaticMarkup(<AvisosFavoritos favoritos={dentro} presentes={favoritosEn(v3, dentro)} error={false} idioma="es" olvidar={() => {}} />)).toBe("");
    expect(renderToStaticMarkup(<AvisosFavoritos favoritos={FAVORITOS_VACIOS} presentes={{ lado: null, jugador: null }} error idioma="en" olvidar={() => {}} />)).toContain("Your favourite could not be saved in this browser");
  });

  it("el primer render de la arena (SSR) no muestra favoritos ni marca nada: sin desajuste de hidratación", () => {
    const html = renderToStaticMarkup(<Arena inicial={v3} />);
    expect(html).not.toContain("data-favorite");
    expect(html.match(/data-testid="arena-favorite-club"/g)).toHaveLength(2);
    expect(html).toContain('data-testid="arena-stats"');
    // El panel va dentro del tablero, tras el transporte.
    expect(html.indexOf('class="arena-seek"')).toBeLessThan(html.indexOf('data-testid="arena-stats"'));
    expect(html.indexOf('data-testid="arena-stats"')).toBeLessThan(html.indexOf('data-testid="arena-companion"'));
    // `.arena-score strong` sigue conteniendo solo el marcador.
    expect(html).toMatch(/<strong class="tnum">\d+–\d+<\/strong>/);
  });
});
