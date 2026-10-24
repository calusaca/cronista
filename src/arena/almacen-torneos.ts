// Brief 062 § 6.1 + § 17.1 + § 18.1 · Almacén de los torneos del sitio (nuevo; `almacen.ts` no se toca).
//
// Solo persistencia: no hay *lease* ni cerrojo (la exclusión es el mutex en proceso del gestor, la réplica única y la
// barrera de relevo). Texto, anexo de solo anexión y bytes (`.json.gz`). En Blob, cada operación lleva
// `abortSignal: AbortSignal.timeout(TORNEO_SITIO.opPlazoMs)`: una operación del proceso viejo termina, del lado del
// cliente, como mucho `opPlazoMs` después de emitirse (§ 18.1). Se implementa aquí con su propio cliente (en vez de
// delegar en `almacenBlob`) porque `almacen.ts` no admite plazos por operación y no se toca.
//
// Disposición (prefijo `torneos-sitio/` en Blob; `ARENA_TORNEOS_SITIO_DIR` o `.cache/arena-torneos-sitio/` en local):
//   dia-AAAA-MM-DD.json · prueba-<hex12>.json   manifiesto (punto de confirmación, `nuevo: true`)
//   <id>.gasto.ndjson                           libro de gasto (anexo)
//   <id>.eNN.ejecutor.json · <id>.eNN.json.gz   par de cada partido (primero el ejecutor, después los bytes)
//   <id>.torneo.json                            instantánea 062 (sobrescritura atómica)
//   latido-<proceso>.json                       latido de presencia de cada proceso
import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { TORNEO_SITIO } from "../sim/limites";

export interface AlmacenTorneos {
  readonly tipo: "local" | "blob";
  iniciar(): Promise<void>;
  leer(nombre: string): Promise<string>;
  /** `nuevo: true` crea solo si no existe (`ifNoneMatch: "*"` / `wx`); si existe lanza un error con `yaExiste`. */
  escribir(nombre: string, texto: string, nuevo?: boolean): Promise<void>;
  anexar(nombre: string, texto: string): Promise<void>;
  listar(): Promise<string[]>;
  borrar(nombre: string): Promise<void>;
  leerBytes(nombre: string): Promise<Uint8Array>;
  escribirBytes(nombre: string, datos: Uint8Array): Promise<void>;
}

export const nombreValidoTorneos = (n: string) => /^[a-zA-Z0-9_.-]{1,160}$/.test(n) && !n.startsWith(".tmp-");
/** El archivo no existe (local ENOENT o Blob 404). */
export const noExiste = (e: unknown) => (e as { code?: string })?.code === "ENOENT" || (e as { statusCode?: number })?.statusCode === 404;
/** La creación `nuevo: true` chocó con un archivo existente (local EEXIST o Blob 409/412). */
export const yaExiste = (e: unknown) => (e as { code?: string })?.code === "EEXIST" || [409, 412].includes((e as { statusCode?: number })?.statusCode ?? 0);

export function almacenTorneosLocal(directorio: string): AlmacenTorneos {
  const ruta = (nombre: string) => { if (!nombreValidoTorneos(nombre)) throw new Error("Nombre de archivo inválido"); return `${directorio}/${nombre}`; };
  /** Escritura atómica (temporal + rename): una lectura nunca ve un archivo a medias. */
  const atomica = async (nombre: string, datos: string | Uint8Array) => {
    const destino = ruta(nombre), tmp = `${directorio}/.tmp-${randomUUID()}`;
    await writeFile(tmp, datos); await rename(tmp, destino);
  };
  return {
    tipo: "local",
    iniciar: () => mkdir(directorio, { recursive: true }).then(() => {}),
    leer: nombre => readFile(/* turbopackIgnore: true */ ruta(nombre), "utf8"),
    escribir: (nombre, texto, nuevo = false) => nuevo ? writeFile(ruta(nombre), texto, { flag: "wx" }) : atomica(nombre, texto),
    anexar: (nombre, texto) => appendFile(ruta(nombre), texto),
    listar: async () => {
      try { return (await readdir(/* turbopackIgnore: true */ directorio)).filter(nombreValidoTorneos); }
      catch (error) { if (noExiste(error)) return []; throw error; }
    },
    borrar: nombre => unlink(ruta(nombre)).catch(error => { if (!noExiste(error)) throw error; }),
    leerBytes: async nombre => new Uint8Array(await readFile(/* turbopackIgnore: true */ ruta(nombre))),
    escribirBytes: (nombre, datos) => atomica(nombre, datos),
  };
}

export async function almacenTorneosBlob(endpoint: string, contenedor: string, prefijo = "torneos-sitio/"): Promise<AlmacenTorneos> {
  const { BlobServiceClient } = await import("@azure/storage-blob");
  const { credencialAzure, endpointAzure } = await import("../lib/azure");
  if (!/^[a-z0-9-]{3,63}$/.test(contenedor) || !/^[a-z0-9/-]{1,80}$/.test(prefijo) || !prefijo.endsWith("/")) throw new Error("Ubicación Blob inválida");
  const container = new BlobServiceClient(endpointAzure(endpoint, ".blob.core.windows.net"), credencialAzure(), { retryOptions: { maxTries: 1 }, keepAliveOptions: { enable: true } }).getContainerClient(contenedor);
  const nombreBlob = (nombre: string) => { if (!nombreValidoTorneos(nombre)) throw new Error("Nombre de blob inválido"); return prefijo + nombre; };
  const plazo = () => AbortSignal.timeout(TORNEO_SITIO.opPlazoMs);
  return {
    tipo: "blob",
    iniciar: async () => { await container.getProperties({ abortSignal: plazo() }); },
    leer: async nombre => (await container.getBlockBlobClient(nombreBlob(nombre)).downloadToBuffer(0, undefined, { abortSignal: plazo() })).toString("utf8"),
    escribir: async (nombre, texto, nuevo = false) => {
      await container.getBlockBlobClient(nombreBlob(nombre)).upload(texto, Buffer.byteLength(texto), {
        ...(nuevo ? { conditions: { ifNoneMatch: "*" } } : {}), blobHTTPHeaders: { blobContentType: "application/json; charset=utf-8" }, abortSignal: plazo(),
      });
    },
    anexar: async (nombre, texto) => {
      const append = container.getAppendBlobClient(nombreBlob(nombre));
      await append.createIfNotExists({ blobHTTPHeaders: { blobContentType: "application/x-ndjson; charset=utf-8" }, abortSignal: plazo() });
      // Sin reintento: un anexo ambiguo (ACK perdido) podría duplicarse; el gestor detiene el torneo (§ 17.2).
      await append.appendBlock(texto, Buffer.byteLength(texto), { abortSignal: plazo() });
    },
    listar: async () => {
      const nombres: string[] = [];
      for await (const item of container.listBlobsFlat({ prefix: prefijo, abortSignal: plazo() })) { const n = item.name.slice(prefijo.length); if (nombreValidoTorneos(n)) nombres.push(n); }
      return nombres;
    },
    borrar: async nombre => { await container.getBlockBlobClient(nombreBlob(nombre)).deleteIfExists({ abortSignal: plazo() }); },
    leerBytes: async nombre => new Uint8Array(await container.getBlockBlobClient(nombreBlob(nombre)).downloadToBuffer(0, undefined, { abortSignal: plazo() })),
    escribirBytes: async (nombre, datos) => {
      await container.getBlockBlobClient(nombreBlob(nombre)).uploadData(datos, { blobHTTPHeaders: { blobContentType: "application/gzip" }, abortSignal: plazo() });
    },
  };
}

export const dirTorneosSitio = (env: Record<string, string | undefined> = process.env) => (env.ARENA_TORNEOS_SITIO_DIR || ".cache/arena-torneos-sitio").replace(/\/$/, "");
export async function almacenTorneosDesdeEnv(env: Record<string, string | undefined> = process.env): Promise<AlmacenTorneos> {
  return env.ARENA_BLOB_ENDPOINT
    ? almacenTorneosBlob(env.ARENA_BLOB_ENDPOINT, env.ARENA_BLOB_CONTENEDOR ?? "arena")
    : almacenTorneosLocal(dirTorneosSitio(env));
}
