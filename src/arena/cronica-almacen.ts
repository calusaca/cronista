// Brief 064 § 4.7 · Almacén de las crónicas de arena (prefijo `cronicas-arena/` en Blob; `ARENA_CRONICAS_DIR` o
// `.cache/arena-cronicas` en local). Reutiliza `almacen-torneos.ts` sin modificarlo. Archivos (todos cumplen
// `nombreValidoTorneos`):
//   <h>.registro.json.gz        registro validado, gzip 9 (una vez)
//   <h>.origen.json             origen de la PRIMERA fuente (`nuevo: true`)
//   <h>.cronica.json            la crónica guardada (escritura atómica, sobrescritura)
//   <h>.reserva.json            { estado: "pendiente", desdeUtc } (`nuevo: true` antes de llamar; se borra al guardar)
//   idx-s-<uuid>.json · idx-t-<torneo>-<nn>.json · idx-a-<archivo>.json   { huella } (`nuevo: true`)
//   dia-AAAA-MM-DD.json         { generaciones, registros } (sobrescritura bajo el mutex del proceso)
// Identidad (D7): `huellaRegistro(r) = sha256(jsonEstable(r)).slice(0, 40)`.
import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { ARENA } from "../sim/limites";
import { almacenTorneosBlob, almacenTorneosLocal, noExiste, yaExiste, type AlmacenTorneos } from "./almacen-torneos";
import type { RegistroArena } from "./tipos";

type Env = Record<string, string | undefined>;

/** `JSON.stringify` con las claves de cada objeto ordenadas de forma recursiva (las listas conservan su orden). */
export function jsonEstable(x: unknown): string {
  if (x === null || typeof x !== "object") return JSON.stringify(x) ?? "null";
  if (Array.isArray(x)) return `[${x.map((v) => (v === undefined ? "null" : jsonEstable(v))).join(",")}]`;
  const o = x as Record<string, unknown>;
  return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${jsonEstable(o[k])}`).join(",")}}`;
}

/** D7 · Identidad de un partido: SHA-256 (40 hex) del registro serializado con claves ordenadas. */
export const huellaRegistro = (r: RegistroArena): string => createHash("sha256").update(jsonEstable(r)).digest("hex").slice(0, 40);
export const HUELLA = /^[a-f0-9]{40}$/;

export const archivosCronica = {
  registro: (h: string) => `${h}.registro.json.gz`,
  origen: (h: string) => `${h}.origen.json`,
  cronica: (h: string) => `${h}.cronica.json`,
  reserva: (h: string) => `${h}.reserva.json`,
  idxSesion: (id: string) => `idx-s-${id}.json`,
  idxTorneo: (torneo: string, nn: string) => `idx-t-${torneo}-${nn}.json`,
  idxArchivo: (archivo: string) => `idx-a-${archivo}.json`,
  dia: (dia: string) => `dia-${dia}.json`,
};

/** Día UTC `AAAA-MM-DD` de un instante. */
export const diaUtc = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

const compartido = globalThis as typeof globalThis & { __cronistaAlmacenCronicas?: { clave: string; almacen: Promise<AlmacenTorneos> } };
/** Almacén de crónicas del entorno (uno por proceso y configuración; `iniciar` una sola vez). */
export function almacenCronicasDesdeEnv(env: Env = process.env): Promise<AlmacenTorneos> {
  const clave = env.ARENA_BLOB_ENDPOINT ? `blob:${env.ARENA_BLOB_ENDPOINT}:${env.ARENA_BLOB_CONTENEDOR ?? "arena"}` : `local:${env.ARENA_CRONICAS_DIR || ".cache/arena-cronicas"}`;
  if (compartido.__cronistaAlmacenCronicas?.clave !== clave) {
    const almacen = (async () => {
      const a = env.ARENA_BLOB_ENDPOINT
        ? await almacenTorneosBlob(env.ARENA_BLOB_ENDPOINT, env.ARENA_BLOB_CONTENEDOR ?? "arena", "cronicas-arena/")
        : almacenTorneosLocal(env.ARENA_CRONICAS_DIR || ".cache/arena-cronicas");
      await a.iniciar();
      return a;
    })();
    // Un fallo al iniciar no queda memorizado: la próxima petición lo reintenta.
    almacen.catch(() => { if (compartido.__cronistaAlmacenCronicas?.almacen === almacen) delete compartido.__cronistaAlmacenCronicas; });
    compartido.__cronistaAlmacenCronicas = { clave, almacen };
  }
  return compartido.__cronistaAlmacenCronicas!.almacen;
}

/** Lectura de texto JSON; `null` si no existe. */
export async function leerJsonAlmacen<T>(a: AlmacenTorneos, nombre: string): Promise<T | null> {
  try { return JSON.parse(await a.leer(nombre)) as T; } catch (error) { if (noExiste(error)) return null; throw error; }
}
/** Creación exclusiva; `false` si ya existía. */
export async function crearSiNoExiste(a: AlmacenTorneos, nombre: string, texto: string): Promise<boolean> {
  try { await a.escribir(nombre, texto, true); return true; } catch (error) { if (yaExiste(error)) return false; throw error; }
}

export async function leerRegistroGuardado(a: AlmacenTorneos, huella: string): Promise<RegistroArena | null> {
  let bytes: Uint8Array;
  try { bytes = await a.leerBytes(archivosCronica.registro(huella)); } catch (error) { if (noExiste(error)) return null; throw error; }
  return JSON.parse(gunzipSync(bytes, { maxOutputLength: ARENA.archivoMaxBytes }).toString("utf8")) as RegistroArena;
}
export async function existeRegistro(a: AlmacenTorneos, huella: string): Promise<boolean> {
  try { await a.leerBytes(archivosCronica.registro(huella)); return true; } catch (error) { if (noExiste(error)) return false; throw error; }
}
export const comprimirRegistro = (r: RegistroArena): Uint8Array => gzipSync(JSON.stringify(r), { level: 9 });

export interface LibroDia { generaciones: number; registros: number }
/** Mutex en proceso del libro diario: cada operación lee, decide y escribe sin intercalarse con otra. */
export class LibroDiario {
  private cola: Promise<unknown> = Promise.resolve();
  constructor(private readonly almacen: () => Promise<AlmacenTorneos>) {}
  async leer(dia: string): Promise<LibroDia> {
    const a = await this.almacen();
    return (await leerJsonAlmacen<LibroDia>(a, archivosCronica.dia(dia))) ?? { generaciones: 0, registros: 0 };
  }
  /** Suma 1 a `campo` si queda cupo (`< max`); devuelve si se sumó. El total se escribe antes de devolver. */
  sumar(dia: string, campo: keyof LibroDia, max: number): Promise<boolean> {
    const tarea = this.cola.then(async () => {
      const libro = await this.leer(dia);
      if (libro[campo] >= max) return false;
      libro[campo]++;
      await (await this.almacen()).escribir(archivosCronica.dia(dia), JSON.stringify(libro));
      return true;
    });
    this.cola = tarea.catch(() => {});
    return tarea;
  }
}
