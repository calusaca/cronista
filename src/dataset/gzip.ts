// Brief 028 — gzip DETERMINISTA. gzip de Node escribe la cabecera con el código del sistema
// operativo de la compilación de zlib (otro byte en Windows que en Linux); y otras herramientas
// ponen la hora en MTIME. Aquí el contenedor RFC 1952 se escribe a mano — MTIME = 0, OS = 255
// («desconocido») — y adentro va un deflate crudo de nivel fijo: dos corridas, mismos bytes.

import { createWriteStream } from "node:fs";
import { constants, crc32, createDeflateRaw } from "node:zlib";
import { GZIP } from "./umbrales-dataset";

/** Cabecera gzip de 10 bytes: ID1 ID2, CM = deflate, FLG = 0, MTIME (LE), XFL, OS. */
export function cabeceraGzip(): Buffer {
  const b = Buffer.alloc(10);
  b[0] = 0x1f;
  b[1] = 0x8b;
  b[2] = 8;
  b[3] = 0;
  b.writeUInt32LE(GZIP.mtime, 4);
  b[8] = GZIP.nivel === constants.Z_BEST_COMPRESSION ? 2 : 0;
  b[9] = GZIP.os;
  return b;
}

/** Escribe `trozos` (texto UTF-8, en orden) como un .gz determinista en `ruta`. */
export async function escribirGzip(ruta: string, trozos: Iterable<string>): Promise<void> {
  const salida = createWriteStream(ruta);
  const deflate = createDeflateRaw({ level: GZIP.nivel });
  let crc = 0;
  let tam = 0;
  salida.write(cabeceraGzip());
  const terminado = new Promise<void>((ok, mal) => {
    deflate.on("data", (d: Buffer) => salida.write(d));
    deflate.on("error", mal);
    deflate.on("end", () => {
      const cola = Buffer.alloc(8);
      cola.writeUInt32LE(crc >>> 0, 0);
      cola.writeUInt32LE(tam >>> 0, 4);
      salida.end(cola, () => ok());
    });
    salida.on("error", mal);
  });
  for (const t of trozos) {
    const buf = Buffer.from(t, "utf8");
    crc = crc32(buf, crc);
    tam = (tam + buf.length) % 0x100000000;
    if (!deflate.write(buf)) await new Promise<void>((ok) => deflate.once("drain", () => ok()));
  }
  deflate.end();
  await terminado;
}
