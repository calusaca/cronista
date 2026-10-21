import { pathToFileURL } from "node:url";
import { ARENA, MESA_ARENA, PRIORIDAD_EVENTO_ARENA } from "../sim/limites";
import { VOZ_BUFFER } from "./buffer";
import { crearControladorProgramado } from "./controladores";
import { ejecutarArena } from "./coordinador";
import { crearConfigArena } from "./motor";
import { construirRelato } from "./relato";
import type { RegistroArena } from "./tipos";

/** Brief 048 v1.1 (13) · Procedimiento versionado de medición de ventanas sin noticia (apéndice del
 * brief). Las cifras del brief son medidas históricas, no reglas: este módulo las recalcula con
 * umbrales derivados de las constantes vigentes. No es una prueba estadística ni fija metas.
 *
 * Uso: `node --import tsx src/arena/ventanas-dialogo.ts [semillas] [segundos]`. */
export const VERSION_VENTANAS = "ventanas-048-v1";
const cps = MESA_ARENA.dialogo.caracteresPorSegundoVoz;
const prioridad = (tipo: string) => PRIORIDAD_EVENTO_ARENA[tipo as keyof typeof PRIORIDAD_EVENTO_ARENA] ?? 0;

/** Umbrales derivados de las constantes: el tope estimado de la breve (cesión más larga + una
 * oración, recortado al máximo del clip) y el de la completa (cuatro turnos al máximo). */
export function umbralesVentana() {
  const cesionMasLarga = Math.max(...(["es", "en"] as const).flatMap(i => (["comentarista", "estadista"] as const).flatMap(r => MESA_ARENA.cesiones[i][r].map(c => c.replace("{nombre}", MESA_ARENA.nombres[i][r]).length))));
  const breveMaxS = Math.min(MESA_ARENA.maxCaracteresIntervencion, cesionMasLarga + 1 + MESA_ARENA.maxCaracteresOracion) / cps + MESA_ARENA.dialogo.pausaTurnoS;
  const completaMaxS = MESA_ARENA.maxCaracteresIntervencion / cps + (MESA_ARENA.dialogo.maxTurnos - 1) * MESA_ARENA.dialogo.pausaTurnoS;
  return {
    /** Eventos que abren ventana: los que disparan al comentarista o al estadista (`cambio`). */
    abreDesdePrioridad: Math.min(MESA_ARENA.comentaristaDesdePrioridad, prioridad("cambio")),
    /** Eventos que la cierran: noticias del narrador. */
    cierraDesdePrioridad: VOZ_BUFFER.prioridadInterrupcion,
    breveMaxS, completaMaxS,
  };
}

/** Ventanas de un registro: para cada evento que abre, el tiempo hasta la siguiente noticia (o el
 * final), menos la duración estimada de su propia noticia (texto del narrador / caracteresPorSegundoVoz)
 * y calmaMinS. */
export function ventanasDe(registro: RegistroArena) {
  const u = umbralesVentana(), finS = registro.final.tick * ARENA.pasoS;
  return registro.eventos.filter(e => prioridad(e.tipo) >= u.abreDesdePrioridad).map(e => {
    const siguiente = registro.eventos.find(o => o.tick > e.tick && prioridad(o.tipo) >= u.cierraDesdePrioridad);
    const desde = Math.floor(Math.max(0, e.tick - 1) / 50) * 50, hasta = Math.min(registro.final.tick, desde + 50);
    let noticiaS = 0;
    try { const r = construirRelato(registro, desde, hasta, "buffer", "es"); if (r.fuentes.includes(e.id)) noticiaS = r.texto.length / cps; } catch { /* tramo no publicado */ }
    return { tipo: e.tipo, tick: e.tick, ventanaS: (siguiente ? siguiente.tick * ARENA.pasoS : finS) - e.tick * ARENA.pasoS - noticiaS - MESA_ARENA.calmaMinS };
  });
}

export async function medirVentanas(opciones: { semillas: number; duracionS: number }) {
  const u = umbralesVentana(), ventanas: ReturnType<typeof ventanasDe> = [];
  let manos = 0, centros = 0;
  for (let seed = 1; seed <= opciones.semillas; seed++) {
    const r = await ejecutarArena(crearConfigArena({ seed, duracionS: opciones.duracionS }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
    ventanas.push(...ventanasDe(r));
    centros += r.eventos.filter(e => e.tipo === "pase" && e.motivo === "centro").length;
    // Tramos de fotogramas con el balón en las manos del portero.
    let dentro = false;
    for (const f of r.fotogramas) { const ahora = !!f.balon.manos && f.balon.manos.hastaTick > f.tick; if (ahora && !dentro) manos++; dentro = ahora; }
  }
  const porTipo = Object.fromEntries([...new Set(ventanas.map(v => v.tipo))].map(tipo => {
    const vs = ventanas.filter(v => v.tipo === tipo);
    const prop = (s: number) => vs.filter(v => v.ventanaS >= s).length / vs.length;
    // Proporción acumulada por segundo entero hasta el tope de la completa, para comparar con las
    // cifras históricas del brief (medidas, no reglas).
    const acumulada = Object.fromEntries(Array.from({ length: Math.ceil(u.completaMaxS) }, (_, k) => [k + 1, Number(prop(k + 1).toFixed(3))]));
    return [tipo, { n: vs.length, breve: prop(u.breveMaxS), completa: prop(u.completaMaxS), acumulada }];
  }));
  return { version: VERSION_VENTANAS, umbrales: u, semillas: opciones.semillas, duracionS: opciones.duracionS, porTipo, manosPorPartido: manos / opciones.semillas, centrosPorPartido: centros / opciones.semillas };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [semillas = "30", segundos = "60"] = process.argv.slice(2);
  console.log(JSON.stringify(await medirVentanas({ semillas: Number(semillas), duracionS: Number(segundos) }), null, 2));
}
