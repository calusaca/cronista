// Brief 064 § 4.7 · Fuentes de una crónica de arena: de dónde sale el registro validado y su origen.
//   { sesion }               gestorSesiones().registro(id) (409 sin registro completo; 404 si caducó)
//   { torneo, encuentro }    instantánea coherente → encuentro n → bytes (estático archivado en public/torneos o el
//                            almacén del sitio) → SHA-256 = archivoSha256 → descomprimir → registroDelEncuentro →
//                            reproducirArena
//   { archivo }              public/experimentos/<archivo> → reproducirArena
//   { registro }             (admisión en la ruta) → reproducirArena → registroCompleto
//   { huella }               lo resuelve el servicio desde el almacén
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { TORNEO_SITIO } from "../sim/limites";
import { registroDelEncuentro } from "../ui/torneo-carga";
import { reproducirArena } from "./coordinador";
import { registroCompleto } from "./cronica-hechos";
import type { FuenteCronica, OrigenCronica } from "./cronica-vista";
import { gestorSesiones } from "./sesiones";
import { archivoEncuentro, ID_TORNEO, origenDeEncuentro, type TorneoCualquiera } from "./torneo";
import { leerIndice, leerTorneo } from "./torneo-archivo";
import { datosPaginaTorneo } from "./torneo-pagina";
import { gestorTorneoSitio } from "./torneo-sitio";
import { descomprimirRegistro, sha256 } from "./torneo-validacion";
import type { RegistroArena } from "./tipos";

/** Error con estado HTTP (y motivo del 429, si lo es). */
export class ErrorCronica extends Error {
  constructor(mensaje: string, readonly status: 400 | 404 | 409 | 413 | 429 | 503, readonly motivo?: "en-curso" | "subidas" | "registros-diarios", readonly retryAfterS?: number) { super(mensaje); }
}

export const ARCHIVOS_EJEMPLO = { duelo: "arena-duelo-v3.json", "ejemplo-v3": "arena-llm-v3.json", ejemplo: "arena-llm-v1.json" } as const;
/** Brief 071 · Las fuentes de partidos terminados, por separado: el servidor MCP solo acepta estas tres. */
export const fuenteTorneo = z.strictObject({ torneo: z.string().regex(ID_TORNEO), encuentro: z.string().regex(/^\d{2}$/) });
export const fuenteArchivo = z.strictObject({ archivo: z.enum(["duelo", "ejemplo-v3", "ejemplo"]) });
export const fuenteHuella = z.strictObject({ huella: z.string().regex(/^[a-f0-9]{40}$/) });
export const esquemaFuente = z.union([
  z.strictObject({ sesion: z.string().regex(/^[0-9a-f-]{36}$/) }),
  fuenteTorneo,
  fuenteArchivo,
  z.strictObject({ registro: z.unknown() }),
  fuenteHuella,
]);

/** Dependencias de lectura (las pruebas las sustituyen por fixtures). */
export interface DepsFuentes {
  torneo(id: string): Promise<TorneoCualquiera | null>;
  bytesTorneo(id: string, archivo: string): Promise<Uint8Array | null>;
  registroSesion(id: string): Promise<{ registro: RegistroArena; origen: OrigenCronica }>;
  archivoEjemplo(nombre: string): Promise<unknown>;
  /** Brief 071 · Torneos guardados (archivados y del sitio) para `list_matches`; sin ella, solo los ejemplos. */
  listarTorneos?(): Promise<TorneoCualquiera[]>;
}

const noExisteFs = (e: unknown) => (e as { code?: string })?.code === "ENOENT";
export const depsFuentesReales: DepsFuentes = {
  async torneo(id) {
    const d = await datosPaginaTorneo(id);
    return d?.lectura?.estado === "ok" ? d.lectura.torneo : null;
  },
  async bytesTorneo(id, archivo) {
    if (id.startsWith(TORNEO_SITIO.prefijoId)) return gestorTorneoSitio().leerArchivo(id, archivo);
    try { return new Uint8Array(await readFile(/* turbopackIgnore: true */ join(process.cwd(), "public", "torneos", id, archivo))); }
    catch (error) { if (noExisteFs(error)) return null; throw error; }
  },
  async registroSesion(id) {
    const g = gestorSesiones();
    const registro = await g.registro(id);
    return { registro, origen: { tipo: "sesion", contexto: { forma: "sesion", asignacion: await g.asignacionPublicada(id) } } };
  },
  async archivoEjemplo(nombre) {
    // Como en grabaciones: se lee en tiempo de ejecución (el import del bundler puede reordenar propiedades).
    return JSON.parse(await readFile(/* turbopackIgnore: true */ join(process.cwd(), "public", "experimentos", nombre), "utf8")) as unknown;
  },
  async listarTorneos() {
    // Las mismas lecturas que `datosPaginaTorneo` (solo leen): los archivados válidos y los del sitio.
    const repo = (await Promise.all((await leerIndice()).map((e) => leerTorneo(e.id)))).flatMap((l) => (l?.estado === "ok" ? [l.torneo] : []));
    const sitio = await gestorTorneoSitio().listarTorneosSitio().catch(() => []);
    return [...repo, ...sitio.filter((t) => !repo.some((r) => r.id === t.id))];
  },
};

function reproducir(raw: unknown): RegistroArena {
  let r: RegistroArena;
  try { r = reproducirArena(raw); } catch { throw new ErrorCronica("Registro inválido", 400); }
  if (!registroCompleto(r)) throw new ErrorCronica("Registro incompleto", 400);
  return r;
}

/** Resuelve una fuente (salvo `{ huella }`, que vive en el almacén) a un registro validado y su origen. */
export async function resolverFuente(fuente: Exclude<FuenteCronica, { huella: string }>, deps: DepsFuentes = depsFuentesReales): Promise<{ registro: RegistroArena; origen: OrigenCronica }> {
  if ("sesion" in fuente) {
    try { return await deps.registroSesion(fuente.sesion); }
    catch (error) {
      const status = (error as { status?: number })?.status;
      if (status === 409) throw new ErrorCronica("El encuentro aún no tiene un registro completo", 409);
      throw new ErrorCronica("Sesión inexistente o caducada", 404);
    }
  }
  if ("torneo" in fuente) {
    const torneo = await deps.torneo(fuente.torneo);
    if (!torneo || torneo.id !== fuente.torneo) throw new ErrorCronica("Torneo inexistente", 404);
    const n = Number(fuente.encuentro), e = torneo.encuentros.find((x) => x.n === n);
    if (!e || e.archivo !== archivoEncuentro(n)) throw new ErrorCronica("Encuentro inexistente", 404);
    const bytes = await deps.bytesTorneo(torneo.id, e.archivo).catch((error) => { if ((error as { status?: number })?.status === 409) return "alterado" as const; throw error; });
    if (bytes === null) throw new ErrorCronica("Registro del encuentro inexistente", 404);
    if (bytes === "alterado" || sha256(bytes) !== e.archivoSha256) throw new ErrorCronica("La huella del registro no coincide con el encuentro", 400);
    let raw: unknown;
    try { raw = descomprimirRegistro(bytes); } catch { throw new ErrorCronica("Registro inválido", 400); }
    const participante = (id: string) => torneo.participantes.find((x) => x.id === id);
    const pl = participante(e.local.participante), pv = participante(e.visita.participante);
    if (!pl || !pv || !registroDelEncuentro(raw, e, pl.controlador, pv.controlador)) throw new ErrorCronica("El registro no corresponde a este encuentro", 400);
    return { registro: reproducir(raw), origen: { tipo: "torneo", contexto: { forma: "torneo" }, torneo: origenDeEncuentro(torneo, n) } };
  }
  if ("archivo" in fuente) {
    const nombre = ARCHIVOS_EJEMPLO[fuente.archivo];
    if (!nombre) throw new ErrorCronica("Archivo inexistente", 404);
    let raw: unknown;
    try { raw = await deps.archivoEjemplo(nombre); } catch { throw new ErrorCronica("Archivo inexistente", 404); }
    return { registro: reproducir(raw), origen: { tipo: "ejemplo", contexto: { forma: "ejemplo" } } };
  }
  return { registro: reproducir(fuente.registro), origen: { tipo: "subida", contexto: { forma: "importado" } } };
}
