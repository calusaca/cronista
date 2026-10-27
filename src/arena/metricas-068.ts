// Brief 068 § 3 · métricas del fuera de juego y las faltas de un lote de programados (`reinicios-v10` frente a v9) y las
// bandas BANDAS_068 de limites.ts. Puro sobre los eventos del registro; el lote corre el motor con controladores
// programados (sin LLM). Aquí no hay umbrales propios.
import { BANDAS_068 as B, LOTE_ARENA_046 as L } from "../sim/limites";
import { crearControladorProgramado } from "./controladores";
import { ejecutarArena } from "./coordinador";
import { crearConfigArena } from "./motor";
import type { EventoArena, ReglasArena } from "./tipos";

export interface Conteo068 {
  fuerasJuego: number;
  /** Brief 068 v1.1 · fueras de juego cuyo infractor era el receptor previsto del pase RASO de campo que los provocó: el
   * último `pase` del mismo lado con el mismo origen (`desde`), sin `reinicio` (saques de banda, esquina, meta y centro)
   * y sin `motivo` (`largo`, `centro` y `saque_manos` quedan fuera: no se filtran o el forzado no tiene filtro). */
  fuerasJuegoPrevisto: number;
  faltas: number; amarillas: number; rojas: number; goles: number; tiros: number;
}
const mismoPunto = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x === b.x && a.y === b.y;
export function contarPartido068(eventos: readonly EventoArena[]): Conteo068 {
  const c: Conteo068 = { fuerasJuego: 0, fuerasJuegoPrevisto: 0, faltas: 0, amarillas: 0, rojas: 0, goles: 0, tiros: 0 };
  eventos.forEach((e, i) => {
    if (e.tipo === "falta") c.faltas++;
    else if (e.tipo === "amarilla") c.amarillas++;
    else if (e.tipo === "roja") c.rojas++;
    else if (e.tipo === "gol") c.goles++;
    else if (e.tipo === "tiro") c.tiros++;
    else if (e.tipo === "fuera_juego") {
      c.fuerasJuego++;
      for (let k = i - 1; k >= 0; k--) {
        const p = eventos[k]!;
        if (p.tipo !== "pase" || p.lado !== e.lado || !mismoPunto(p.desde, e.desde)) continue;
        if (p.receptor === e.jugador && p.reinicio === undefined && p.motivo === undefined) c.fuerasJuegoPrevisto++;
        break;
      }
    }
  });
  return c;
}

export interface Metricas068 {
  reglas: ReglasArena; duracionS: number; desde: number; partidos: number;
  fuerasJuegoPorPartido: number; fuerasJuegoPrevisto: number; faltasPorPartido: number;
  /** Fracción de partidos sin ninguna falta. */
  sinFalta: number;
  amarillasPorPartido: number; rojasPorPartido: number; golesPorPartido: number; tirosPorPartido: number;
}
export function agregar068(reglas: ReglasArena, duracionS: number, desde: number, conteos: readonly Conteo068[]): Metricas068 {
  const n = conteos.length, suma = (k: keyof Conteo068) => conteos.reduce((s, c) => s + c[k], 0);
  return { reglas, duracionS, desde, partidos: n,
    fuerasJuegoPorPartido: suma("fuerasJuego") / n, fuerasJuegoPrevisto: suma("fuerasJuegoPrevisto"), faltasPorPartido: suma("faltas") / n,
    sinFalta: conteos.filter(c => c.faltas === 0).length / n,
    amarillasPorPartido: suma("amarillas") / n, rojasPorPartido: suma("rojas") / n, golesPorPartido: suma("goles") / n, tirosPorPartido: suma("tiros") / n };
}

/** Lote de programados (por defecto LOTE_ARENA_046.duracionS = 120 s), semillas `desde`…`desde + semillas − 1`. */
export async function medirLote068(o: { desde: number; semillas: number; reglas: ReglasArena; duracionS?: number }): Promise<Metricas068> {
  const duracionS = o.duracionS ?? L.duracionS, conteos: Conteo068[] = [];
  for (let seed = o.desde; seed < o.desde + o.semillas; seed++) {
    const r = await ejecutarArena(crearConfigArena({ seed, duracionS, reglas: o.reglas }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
    conteos.push(contarPartido068(r.eventos));
  }
  return agregar068(o.reglas, duracionS, o.desde, conteos);
}

/** Bandas BANDAS_068 incumplidas (nombre y valor); `golesV9`: goles por partido de v9 en el mismo lote. */
export function incumplimientos068(m: Metricas068, golesV9: number): string[] {
  const fallos: string[] = [];
  const entre = (nombre: string, v: number, r: { min: number; max: number }) => { if (!(v >= r.min && v <= r.max)) fallos.push(`${nombre}=${v} ∉ [${r.min}; ${r.max}]`); };
  const max = (nombre: string, v: number, limite: number) => { if (!(v <= limite)) fallos.push(`${nombre}=${v} > ${limite}`); };
  entre("fuerasJuegoPorPartido", m.fuerasJuegoPorPartido, B.fuerasJuegoPorPartido);
  max("fuerasJuegoPrevisto", m.fuerasJuegoPrevisto, B.fuerasJuegoPrevistoMax);
  entre("faltasPorPartido", m.faltasPorPartido, B.faltasPorPartido);
  max("sinFalta", m.sinFalta, B.sinFaltaMax);
  max("rojasPorPartido", m.rojasPorPartido, B.rojasPorPartidoMax);
  if (!(m.golesPorPartido >= golesV9 * B.golesFactorV9)) fallos.push(`golesPorPartido=${m.golesPorPartido} < ${golesV9} × ${B.golesFactorV9}`);
  return fallos;
}
