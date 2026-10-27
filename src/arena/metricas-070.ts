// Brief 070 § 3 · métricas del tiro libre y el penal de un lote de programados (`reinicios-v11` frente a v10) y las
// bandas BANDAS_070 de limites.ts. Puro sobre los eventos y fotogramas del registro; el lote corre el motor con
// controladores programados (sin LLM). Aquí no hay umbrales propios.
import { ARENA, BANDAS_070 as B, LOTE_ARENA_046 as L } from "../sim/limites";
import { crearControladorProgramado } from "./controladores";
import { ejecutarArena } from "./coordinador";
import { distancia } from "./geometria";
import { crearConfigArena } from "./motor";
import type { EstadoArena, EventoArena, RegistroArena, ReglasArena } from "./tipos";

export interface Conteo070 {
  faltas: number;
  /** Métrica del § 1 del brief (la del diagnóstico): faltas tras las que el lado infractor (`falta.lado`) tiene una
   * `recuperacion` o comete otra `falta` con tick ≤ tick de la falta + BANDAS_070.ventanaRecuperacionS (sin contar los
   * `reinicio`; la ventana empieza en la falta e incluye la pausa). */
  recuperaInfractor: number;
  /** Informativa (sin banda): lo mismo contando también las `intercepcion` del infractor (un tiro libre es un pase). */
  recuperaInfractorAmplia: number;
  libres: number; directos: number; golesDirecto: number;
  /** Penales señalados (`reinicio` "penal"), lanzados (`tiro` con `motivo: "penal"`) y convertidos (`gol` con `fuentes`
   * al tiro del penal); atajados y fuera, por el desenlace. */
  penales: number; penalesLanzados: number; golesPenal: number; penalesAtajados: number; penalesFuera: number;
  /** Rivales a < ARENA.distanciaSaqueLibreM del balón en el tick de ejecución de cada tiro libre o penal (en el penal,
   * salvo el portero defensor); `ejecuciones`: cuántas se pudieron medir. */
  rivalesCerca: number; ejecuciones: number;
  /** Fueras de juego cuyo pase fue un tiro libre (informativa). */
  fuerasTrasLibre: number;
  goles: number; tiros: number; fuerasJuego: number;
}

/** Estado en el tick de ejecución: el último fotograma con tick ≤ `tick` (durante la pausa todos están quietos). */
function estadoEn(fotogramas: readonly EstadoArena[], tick: number): EstadoArena | undefined {
  let elegido: EstadoArena | undefined;
  for (const f of fotogramas) { if (f.tick <= tick) elegido = f; else break; }
  return elegido;
}

export function contarPartido070(registro: Pick<RegistroArena, "eventos" | "fotogramas">): Conteo070 {
  const { eventos, fotogramas } = registro;
  const c: Conteo070 = { faltas: 0, recuperaInfractor: 0, recuperaInfractorAmplia: 0, libres: 0, directos: 0, golesDirecto: 0, penales: 0, penalesLanzados: 0, golesPenal: 0, penalesAtajados: 0, penalesFuera: 0, rivalesCerca: 0, ejecuciones: 0, fuerasTrasLibre: 0, goles: 0, tiros: 0, fuerasJuego: 0 };
  const ventana = Math.round(B.ventanaRecuperacionS / ARENA.pasoS);
  const tirosPenal = new Set<string>(), tirosLibre = new Map<string, EventoArena>();
  eventos.forEach((e, i) => {
    if (e.tipo === "gol") { c.goles++; if (e.fuentes?.some(f => tirosPenal.has(f))) c.golesPenal++; }
    if (e.tipo === "tiro") {
      c.tiros++;
      if (e.motivo === "penal") { c.penalesLanzados++; tirosPenal.add(e.id); }
      if (e.motivo === "libre") { c.directos++; tirosLibre.set(e.jugador, e); }
    }
    if (e.tipo === "gol" && !e.autogol) { const t = tirosLibre.get(e.jugador); if (t && t.desde.x === e.desde.x && t.desde.y === e.desde.y) c.golesDirecto++; }
    if (e.tipo === "atajada" && eventos.slice(0, i).reverse().find(x => x.tipo === "tiro")?.motivo === "penal" && e.motivo !== "desvio") {
      const tiro = eventos.slice(0, i).reverse().find(x => x.tipo === "tiro")!;
      if (tiro.jugador === e.receptor) c.penalesAtajados++;
    }
    if (e.tipo === "tiro_fuera") { const tiro = eventos.slice(0, i).reverse().find(x => x.tipo === "tiro"); if (tiro?.motivo === "penal" && tiro.jugador === e.jugador) c.penalesFuera++; }
    if (e.tipo === "fuera_juego") {
      c.fuerasJuego++;
      const pase = eventos.slice(0, i).reverse().find(x => x.tipo === "pase" && x.lado === e.lado);
      if (pase?.reinicio === "libre") c.fuerasTrasLibre++;
    }
    if (e.tipo === "falta") {
      c.faltas++;
      const tras = eventos.slice(i + 1).filter(x => x.tick <= e.tick + ventana && x.tipo !== "reinicio" && x.lado === e.lado);
      if (tras.some(x => x.tipo === "recuperacion" || x.tipo === "falta")) c.recuperaInfractor++;
      if (tras.some(x => x.tipo === "recuperacion" || x.tipo === "falta" || x.tipo === "intercepcion")) c.recuperaInfractorAmplia++;
    }
    if (e.tipo === "reinicio" && (e.reinicio === "libre" || e.reinicio === "penal")) {
      if (e.reinicio === "libre") c.libres++; else c.penales++;
      const ejecucion = eventos.slice(i + 1).find(x => (x.tipo === "pase" || x.tipo === "tiro") && x.reinicio === e.reinicio && x.jugador === e.jugador);
      const estado = ejecucion ? estadoEn(fotogramas, ejecucion.tick - 1) : undefined;
      if (!ejecucion || !estado || estado.tick < e.tick) return;
      c.ejecuciones++;
      c.rivalesCerca += estado.jugadores.filter(j => j.lado !== e.lado && !(e.reinicio === "penal" && j.puesto === "POR") && distancia(j.posicion, estado.balon.posicion) < ARENA.distanciaSaqueLibreM).length;
    }
  });
  return c;
}

export interface Metricas070 {
  reglas: ReglasArena; duracionS: number; desde: number; partidos: number;
  faltasPorPartido: number;
  /** Fracción de faltas con recuperación del infractor (métrica del § 1); `null` sin faltas. */
  recuperacionInfractor: number | null; recuperacionInfractorAmplia: number | null;
  libresPorPartido: number; directosPorPartido: number; golesDirecto: number;
  penalesPorPartido: number; penalesLanzados: number; golesPenal: number; penalesAtajados: number; penalesFuera: number;
  /** Goles de penal / penales lanzados; `null` sin penales. */
  conversionPenales: number | null;
  rivalesCerca: number; ejecuciones: number; fuerasTrasLibre: number;
  golesPorPartido: number; tirosPorPartido: number; fuerasJuegoPorPartido: number;
}
export function agregar070(reglas: ReglasArena, duracionS: number, desde: number, conteos: readonly Conteo070[]): Metricas070 {
  const n = conteos.length, suma = (k: keyof Conteo070) => conteos.reduce((s, c) => s + c[k], 0);
  const faltas = suma("faltas"), lanzados = suma("penalesLanzados");
  return { reglas, duracionS, desde, partidos: n,
    faltasPorPartido: faltas / n,
    recuperacionInfractor: faltas ? suma("recuperaInfractor") / faltas : null, recuperacionInfractorAmplia: faltas ? suma("recuperaInfractorAmplia") / faltas : null,
    libresPorPartido: suma("libres") / n, directosPorPartido: suma("directos") / n, golesDirecto: suma("golesDirecto"),
    penalesPorPartido: suma("penales") / n, penalesLanzados: lanzados, golesPenal: suma("golesPenal"), penalesAtajados: suma("penalesAtajados"), penalesFuera: suma("penalesFuera"),
    conversionPenales: lanzados ? suma("golesPenal") / lanzados : null,
    rivalesCerca: suma("rivalesCerca"), ejecuciones: suma("ejecuciones"), fuerasTrasLibre: suma("fuerasTrasLibre"),
    golesPorPartido: suma("goles") / n, tirosPorPartido: suma("tiros") / n, fuerasJuegoPorPartido: suma("fuerasJuego") / n };
}

/** Lote de programados (por defecto LOTE_ARENA_046.duracionS = 120 s), semillas `desde`…`desde + semillas − 1`. Devuelve
 * también los conteos por partido (la conversión de penales se agrega sobre dos lotes). */
export async function medirLote070(o: { desde: number; semillas: number; reglas: ReglasArena; duracionS?: number }): Promise<{ metricas: Metricas070; conteos: Conteo070[] }> {
  const duracionS = o.duracionS ?? L.duracionS, conteos: Conteo070[] = [];
  for (let seed = o.desde; seed < o.desde + o.semillas; seed++) {
    const r = await ejecutarArena(crearConfigArena({ seed, duracionS, reglas: o.reglas }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
    conteos.push(contarPartido070(r));
  }
  return { metricas: agregar070(o.reglas, duracionS, o.desde, conteos), conteos };
}

/** Bandas BANDAS_070 incumplidas en el lote 1–100 (`m`) y la conversión de penales de 1–200 juntas (`conversion`). */
export function incumplimientos070(m: Metricas070, conversion: number | null): string[] {
  const fallos: string[] = [];
  if (!(m.recuperacionInfractor !== null && m.recuperacionInfractor <= B.recuperacionInfractorMax)) fallos.push(`recuperacionInfractor=${m.recuperacionInfractor} > ${B.recuperacionInfractorMax}`);
  if (!(m.ejecuciones > 0 && m.rivalesCerca <= B.rivalesCercaMax)) fallos.push(`rivalesCerca=${m.rivalesCerca} (ejecuciones ${m.ejecuciones}) > ${B.rivalesCercaMax}`);
  if (!(m.penalesPorPartido >= B.penalesPorPartido.min && m.penalesPorPartido <= B.penalesPorPartido.max)) fallos.push(`penalesPorPartido=${m.penalesPorPartido} ∉ [${B.penalesPorPartido.min}; ${B.penalesPorPartido.max}]`);
  if (!(conversion !== null && conversion >= B.conversionPenales.min && conversion <= B.conversionPenales.max)) fallos.push(`conversionPenales=${conversion} ∉ [${B.conversionPenales.min}; ${B.conversionPenales.max}]`);
  return fallos;
}
