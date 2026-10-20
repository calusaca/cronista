import { appendFile, mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";

export interface BloqueoAlmacen { vigente: () => boolean; liberar: () => Promise<void> }
export interface AlmacenArena {
  iniciar(): Promise<void>;
  leer(nombre: string): Promise<string>;
  escribir(nombre: string, texto: string, nuevo?: boolean): Promise<void>;
  anexar(nombre: string, texto: string): Promise<void>;
  listar(): Promise<string[]>;
  borrar(nombre: string): Promise<void>;
  bloquear(): Promise<BloqueoAlmacen>;
}
const nombreValido = (n: string) => /^[a-zA-Z0-9_.-]{1,160}$/.test(n);

export function almacenLocal(directorio: string): AlmacenArena {
  const archivo = (nombre: string) => { if (!nombreValido(nombre)) throw new Error("Nombre de archivo inválido"); return `${directorio}/${nombre}`; };
  return {
    iniciar: () => mkdir(directorio, { recursive: true }).then(() => {}),
    leer: nombre => readFile(/* turbopackIgnore: true */ archivo(nombre), "utf8"),
    escribir: (nombre, texto, nuevo = false) => writeFile(archivo(nombre), texto, { flag: nuevo ? "wx" : "w" }),
    anexar: (nombre, texto) => appendFile(archivo(nombre), texto),
    listar: () => readdir(/* turbopackIgnore: true */ directorio),
    borrar: nombre => unlink(archivo(nombre)),
    // El adaptador local mantiene el alcance histórico de un proceso/réplica.
    bloquear: async () => ({ vigente: () => true, liberar: async () => {} }),
  };
}

export async function almacenBlob(endpoint: string, contenedor: string, prefijo = "sesiones/"): Promise<AlmacenArena> {
  const { BlobServiceClient } = await import("@azure/storage-blob");
  const { credencialAzure, endpointAzure } = await import("../lib/azure");
  if (!/^[a-z0-9-]{3,63}$/.test(contenedor) || !/^[a-z0-9/-]{0,80}$/.test(prefijo) || (prefijo && !prefijo.endsWith("/"))) throw new Error("Ubicación Blob inválida");
  const container = new BlobServiceClient(endpointAzure(endpoint, ".blob.core.windows.net"), credencialAzure(), { retryOptions: { maxTries: 1 }, keepAliveOptions: { enable: true } }).getContainerClient(contenedor);
  const blob = (nombre: string) => { if (!nombreValido(nombre)) throw new Error("Nombre de blob inválido"); return container.getBlockBlobClient(prefijo + nombre); };
  return {
    iniciar: async () => { await container.getProperties(); },
    leer: async nombre => (await blob(nombre).downloadToBuffer()).toString("utf8"),
    escribir: async (nombre, texto, nuevo = false) => { await blob(nombre).upload(texto, Buffer.byteLength(texto), { ...(nuevo ? { conditions: { ifNoneMatch: "*" } } : {}), blobHTTPHeaders: { blobContentType: "application/json; charset=utf-8" } }); },
    anexar: async (nombre, texto) => {
      if (!nombreValido(nombre)) throw new Error("Nombre de blob inválido");
      const append = container.getAppendBlobClient(prefijo + nombre);
      await append.createIfNotExists({ blobHTTPHeaders: { blobContentType: "application/x-ndjson; charset=utf-8" } });
      // Un único escritor posee el lease del coordinador; no reintentar un append
      // ambiguo: podría duplicar una publicación cuyo ACK se perdió.
      await append.appendBlock(texto, Buffer.byteLength(texto), { abortSignal: AbortSignal.timeout(15_000) });
    },
    listar: async () => { const nombres = []; for await (const item of container.listBlobsFlat({ prefix: prefijo })) { const nombre = item.name.slice(prefijo.length); if (nombreValido(nombre)) nombres.push(nombre); } return nombres; },
    borrar: async nombre => { await blob(nombre).deleteIfExists(); },
    bloquear: async () => {
      const lock = blob("coordinador.lock");
      await lock.upload("", 0, { conditions: { ifNoneMatch: "*" } }).catch(error => { if (error.statusCode !== 409 && error.statusCode !== 412) throw error; });
      const lease = lock.getBlobLeaseClient(); await lease.acquireLease(60);
      let valido = true;
      const timer = setInterval(() => { void lease.renewLease().catch(() => { valido = false; }); }, 20_000); timer.unref();
      return { vigente: () => valido, liberar: async () => { clearInterval(timer); valido = false; await lease.releaseLease().catch(() => {}); } };
    },
  };
}

export async function almacenDesdeEnv(directorio: string): Promise<AlmacenArena> {
  return process.env.ARENA_BLOB_ENDPOINT
    ? almacenBlob(process.env.ARENA_BLOB_ENDPOINT, process.env.ARENA_BLOB_CONTENEDOR ?? "arena")
    : almacenLocal(directorio);
}
