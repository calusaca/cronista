// Brief 062 § 7.1 + § 7.5 · Lista «Torneos» (dos orígenes) y elección del torneo que muestra /arena/torneo. Puro: lo
// usan las páginas (servidor) y las pruebas.
import { clasificar, type TorneoCualquiera } from "../arena/torneo";
import type { FormatoTorneo } from "../arena/torneo-formatos";

export interface ResumenTorneo {
  id: string; inicioUtc: string; titulo: { es: string; en: string };
  origen: "repositorio" | "sitio"; lanzamiento: "publico" | "prueba"; tipo: "real" | "ensayo";
  formato: FormatoTorneo; estado: TorneoCualquiera["estado"];
  /** Nombre del 1.º de la clasificación (con «=» si es compartido); null sin partidos. */
  primero: string | null; primeroCompartido: boolean;
}

export function resumenDe(t: TorneoCualquiera): ResumenTorneo {
  const filas = t.encuentros.length ? clasificar(t) : [], nombre = (id: string) => t.participantes.find(p => p.id === id)!.nombre;
  const es062 = t.version !== "059-v1.1";
  return {
    id: t.id, inicioUtc: t.inicioUtc, titulo: t.titulo, tipo: t.tipo, estado: t.estado,
    origen: es062 ? t.origen : "repositorio", lanzamiento: es062 ? t.lanzamiento : "publico", formato: es062 ? t.formato : "liga",
    primero: filas[0] ? nombre(filas[0].id) : null, primeroCompartido: !!filas[0]?.empatada,
  };
}

/** Del más reciente al más antiguo (por inicioUtc y, a igualdad, por id). Un promovido (mismo id en los dos orígenes)
 * aparece una sola vez, como del repositorio. */
export function listaTorneos(repositorio: readonly TorneoCualquiera[], sitio: readonly TorneoCualquiera[]): ResumenTorneo[] {
  const ids = new Set(repositorio.map(t => t.id));
  return [...repositorio, ...sitio.filter(t => !ids.has(t.id))].map(resumenDe).sort((a, b) => b.inicioUtc.localeCompare(a.inicioUtc) || a.id.localeCompare(b.id));
}

/** § 7.1 · El torneo que muestra /arena/torneo: el activo (`en_curso`) si lo hay; si no, el más reciente, prefiriendo
 * los reales a los de ensayo (en producción no hay ensayos: el servidor los rechaza con Blob). */
export function torneoAMostrar<T extends { id: string; inicioUtc: string; estado: string; tipo: "real" | "ensayo" }>(candidatos: readonly T[]): T | null {
  const orden = [...candidatos].sort((a, b) => b.inicioUtc.localeCompare(a.inicioUtc) || a.id.localeCompare(b.id));
  return orden.find(t => t.estado === "en_curso") ?? orden.find(t => t.tipo === "real") ?? orden[0] ?? null;
}
