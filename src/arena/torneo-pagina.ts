// Brief 062 § 7.1 · Datos de /arena/torneo y /arena/torneo/[id] (solo servidor): torneos archivados en el repositorio
// (`torneo-archivo.ts`, validados en CI) y lanzados en el sitio (`gestorTorneoSitio().leer/listarTorneosSitio`, que
// solo leen: no arrancan el latido ni escriben). Un id `sitio-…` se lee del almacén; los demás, del repositorio.
import { TORNEO_SITIO } from "../sim/limites";
import type { ClubesPlan } from "../ui/ArenaTorneo";
import { crearConfigArena } from "./motor";
import { planTorneo } from "./torneo-formatos";
import type { ReglasArena, VersionArena } from "./tipos";
import { listaTorneos, torneoAMostrar, type ResumenTorneo } from "../ui/torneo-lista";
import type { TorneoCualquiera } from "./torneo";
import { leerIndice, leerTorneo } from "./torneo-archivo";
import { gestorTorneoSitio } from "./torneo-sitio";

export type LecturaPagina = { estado: "ok"; torneo: TorneoCualquiera } | { estado: "incoherente"; id: string; errores: string[] };
export interface DatosPaginaTorneo { lectura: LecturaPagina | null; lista: ResumenTorneo[]; clubes: ClubesPlan }

/** § 7.3 · Clubes de cada partido del plan de un torneo 062 (para «En juego» antes de que el partido termine). */
export function clubesDelPlan(t: TorneoCualquiera): ClubesPlan {
  if (t.version === "059-v1.1") return {};
  const r: ClubesPlan = {};
  for (const p of planTorneo(t.formato, t.participantes.map(x => x.id), t.semilla, t)) {
    const c = crearConfigArena({ seed: p.seed, duracionS: t.duracionS, intervaloS: t.intervaloS, version: t.motor.version as VersionArena, reglas: t.motor.reglas as ReglasArena });
    r[p.n] = { local: c.partido.local.nombre, visita: c.partido.visita.nombre };
  }
  return r;
}
const conClubes = (d: Omit<DatosPaginaTorneo, "clubes">): DatosPaginaTorneo => ({ ...d, clubes: d.lectura?.estado === "ok" ? clubesDelPlan(d.lectura.torneo) : {} });

async function delSitio(): Promise<TorneoCualquiera[]> {
  try { return await gestorTorneoSitio().listarTorneosSitio(); }
  catch (error) { console.error(`[torneo-pagina] no se pudo listar los torneos del sitio: ${error instanceof Error ? error.message : "error"}`); return []; }
}

/** `id` null ⇒ la portada (el activo o el más reciente); un id desconocido ⇒ null (404). */
export async function datosPaginaTorneo(id: string | null): Promise<DatosPaginaTorneo | null> {
  const indice = await leerIndice();
  const lecturasRepo = await Promise.all(indice.map(e => leerTorneo(e.id)));
  const repo = lecturasRepo.flatMap(l => (l?.estado === "ok" ? [l.torneo] : []));
  const sitio = await delSitio();
  const lista = listaTorneos(repo, sitio);
  if (id !== null) {
    if (id.startsWith(TORNEO_SITIO.prefijoId) && !repo.some(t => t.id === id)) {
      const l = await gestorTorneoSitio().leer(id).catch(() => null);
      if (!l) return null;
      return conClubes({ lectura: l.estado === "ok" ? l : { estado: "incoherente", id, errores: [] }, lista });
    }
    const l = await leerTorneo(id);
    return l ? conClubes({ lectura: l, lista }) : null;
  }
  // Un archivado incoherente sigue pudiendo ser el más reciente (se muestra sin cifras, como en el 059).
  type Candidato = { id: string; inicioUtc: string; estado: string; tipo: "real" | "ensayo"; torneo: TorneoCualquiera | null };
  const candidatos: Candidato[] = [
    ...[...repo, ...sitio.filter(t => !repo.some(r => r.id === t.id))].map(t => ({ id: t.id, inicioUtc: t.inicioUtc, estado: t.estado as string, tipo: t.tipo, torneo: t })),
    ...indice.filter((_, i) => lecturasRepo[i]?.estado === "incoherente").map(e => ({ id: e.id, inicioUtc: e.inicioUtc, estado: "incoherente", tipo: "real" as const, torneo: null })),
  ];
  const elegido = torneoAMostrar(candidatos);
  if (!elegido) return conClubes({ lectura: null, lista });
  return conClubes({ lectura: elegido.torneo ? { estado: "ok", torneo: elegido.torneo } : { estado: "incoherente", id: elegido.id, errores: [] }, lista });
}
