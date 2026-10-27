// Brief 064 § 4.9 · Del resultado de `leerCronicaArena` a las props de `CronicaArena` (servidor, puro). Al cliente
// pasa solo lo que se muestra —nunca los fotogramas—: cabecera, crónica (solo si su estado es «lista», I9), rótulo del
// redactor, hechos sin `datos` y la línea de tiempo narrada en los dos idiomas. Fuera de la página para probarlo.
import catalogoPublico from "../arena/catalogo-publico.json";
import type { LecturaCronica } from "../arena/cronica";
import { lineaTiempoCronica, relojArena } from "../arena/cronica-vista";
import { lineaModelos, type EntradaCatalogo } from "../arena/modelos-jugados";
import { narrarEventoArena } from "../arena/vista";
import { ARENA } from "../sim/limites";
import type { PropsCronicaArena } from "./CronicaArena";
import { claseIcono } from "./IconosArena";

const fecha = (iso: string, idioma: "es" | "en") => new Intl.DateTimeFormat(idioma, { dateStyle: "long", timeZone: "UTC" }).format(new Date(iso));

export function propsCronicaArena(l: LecturaCronica, idiomaInicial: "es" | "en"): PropsCronicaArena {
  const { registro, origen, archivo, huella } = l;
  const hechos = l.hechos.map((h) => h.hecho);
  const contexto = origen?.contexto ?? { forma: "importado" as const };
  const catalogo = catalogoPublico as readonly EntradaCatalogo[];
  const modelos = { en: lineaModelos(registro, contexto, catalogo, "en"), es: lineaModelos(registro, contexto, catalogo, "es") };
  // I9 · Solo una crónica en estado «lista» (verificada al leer) llega al cliente.
  const cronica = l.estado === "lista" ? archivo?.cronica : undefined;
  // «Watch in the replay · 0:31» (§ 4.9.4) necesita `?cronica`/`?t` en la arena, que es el bloque C (§ 5): hasta
  // entonces la página no lo ofrece, para no prometer un salto que la arena aún no hace.
  return {
    huella, idiomaInicial, estado: l.estado,
    cabecera: {
      local: registro.config.partido.local.nombre, visita: registro.config.partido.visita.nombre, goles: registro.final.marcador,
      duracionS: Math.floor(registro.final.tick * ARENA.pasoS + 1e-9), finalAnticipado: Boolean(registro.final.finalizado),
      reglas: registro.config.reglas ?? registro.version, modelos,
      torneo: origen?.torneo ? { id: origen.torneo.id, n: origen.torneo.n, fecha: { es: fecha(origen.torneo.inicioUtc, "es"), en: fecha(origen.torneo.inicioUtc, "en") }, prueba: Boolean(origen.torneo.prueba) } : null,
    },
    ...(cronica && archivo ? {
      cronica,
      redactor: { id: archivo.redactor?.id ?? null, etiqueta: archivo.redactor?.etiqueta ?? "", fixture: archivo.redactor?.fixture ?? false, modo: cronica.modo, ...(archivo.motivoActa ? { motivoActa: archivo.motivoActa } : {}), provisional: archivo.provisional, ...(archivo.hechosVia ? { hechosVia: archivo.hechosVia } : {}) },
    } : {}),
    hechos: hechos.map((h) => ({ id: h.id, tipo: h.tipo, texto_es: h.texto_es, texto_en: h.texto_en, eventos: h.eventos })),
    linea: lineaTiempoCronica(registro, hechos).map((e) => ({ id: e.id, reloj: relojArena(e.tick * ARENA.pasoS), clase: claseIcono(e), texto_es: narrarEventoArena(e, registro, "es"), texto_en: narrarEventoArena(e, registro, "en"), lado: e.lado })),
  };
}
