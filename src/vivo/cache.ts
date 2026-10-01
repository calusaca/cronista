// Caché en disco de las actualizaciones en vivo (brief 008), por (seed, momento, deployment,
// modo). Mismas reglas que la caché de crónicas (003, rev. 3.2): hash de los hechos de
// entrada (los del PREFIJO), esquema zod completo con coherencia del audit, escritura
// atómica con reintentos que jamás lanza, limpieza de `.tmp` huérfanos. Y la barrera de
// fondo: quien lee (generarUpdate) RE-VERIFICA la entrada; si no pasa, se regenera.

import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { Hecho } from "../analista/tipos";
import { directorioPorDefecto, hashHechos, limpiarHuerfanos } from "../cadena/cache";
import { MODOS_PERSONALIZACION } from "../cadena/tipos";
import { MAX_REINTENTOS, RENAME_ESPERA_MS, RENAME_REINTENTOS, TMP_HUERFANO_MS } from "../cadena/umbrales";
import { esquemaOracion } from "../cadena/verificador";
import type { CacheUpdates, ClaveUpdate, UpdateGuardada } from "./updates";
import { MAX_ORACIONES_UPDATE } from "./umbrales";

export const VERSION_CACHE_UPDATES = 1;

const esquemaMotivo = z.object({
  oracion: z.number().int(),
  regla: z.enum(["V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8"]),
  detalle: z.string(),
});

const esquemaGuardada = z
  .object({
    oraciones: z.array(esquemaOracion).min(1).max(MAX_ORACIONES_UPDATE),
    intentos: z.number().int().min(1).max(1 + MAX_REINTENTOS),
    modo: z.enum(["llm", "plantilla"]),
    audit: z.array(
      z.object({
        n: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        oraciones: z.array(esquemaOracion),
        veredicto: z.array(esquemaMotivo),
        feedback: z.string().optional(),
        crudo: z.string().optional(),
      }),
    ),
  })
  .superRefine((u, ctx) => {
    const mal = (m: string) => ctx.addIssue({ code: "custom", message: m });
    u.audit.forEach((a, i) => {
      if (a.n !== i + 1) mal(`audit[${i}].n = ${a.n}, debía ser ${i + 1}`);
      if (a.veredicto.length === 0 && i !== u.audit.length - 1) mal(`audit[${i}] aprobado pero no es el último`);
    });
    if (u.intentos !== u.audit.length) mal(`intentos ${u.intentos} ≠ audit.length ${u.audit.length}`);
    const ultimo = u.audit[u.audit.length - 1];
    if (u.modo === "llm" && !(ultimo && ultimo.veredicto.length === 0)) mal("modo llm sin un último intento aprobado");
    if (u.modo === "plantilla") {
      if (u.audit.length !== 1 + MAX_REINTENTOS) mal("plantilla sin agotar reintentos");
      if (u.audit.some((a) => a.veredicto.length === 0)) mal("plantilla con un intento aprobado");
    }
  });

const esquemaEntrada = z.object({
  version: z.literal(VERSION_CACHE_UPDATES),
  clave: z.object({ seed: z.number(), momento: z.string(), deployment: z.string(), modo: z.enum(MODOS_PERSONALIZACION) }),
  hechos: z.string(),
  update: esquemaGuardada,
});

export function nombreArchivoUpdate(c: ClaveUpdate): string {
  const limpio = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, "_");
  return `${c.seed}__${limpio(c.momento)}__${limpio(c.deployment)}__${limpio(c.modo)}.json`;
}

/** Subdirectorio `vivo/` de la caché de crónicas (CRONISTA_CACHE_DIR o .cache/cronicas). */
export function directorioUpdatesPorDefecto(env: Record<string, string | undefined> = process.env): string {
  return join(directorioPorDefecto(env), "vivo");
}

function dormir(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export interface OpcionesCacheUpdates {
  /** Solo para pruebas: el rename atómico (por defecto fs.renameSync). */
  renombrar?: (desde: string, hasta: string) => void;
}

export function crearCacheUpdates(dir: string = directorioUpdatesPorDefecto(), opciones: OpcionesCacheUpdates = {}): CacheUpdates {
  const renombrar = opciones.renombrar ?? renameSync;
  limpiarHuerfanos(dir, TMP_HUERFANO_MS);
  return {
    leer(clave, hechos) {
      let crudo: unknown;
      try {
        crudo = JSON.parse(readFileSync(join(dir, nombreArchivoUpdate(clave)), "utf8"));
      } catch {
        return undefined;
      }
      const r = esquemaEntrada.safeParse(crudo);
      if (!r.success) return undefined;
      const e = r.data;
      if (e.hechos !== hashHechos(hechos)) return undefined;
      if (e.clave.seed !== clave.seed || e.clave.momento !== clave.momento || e.clave.deployment !== clave.deployment || e.clave.modo !== clave.modo) return undefined;
      return e.update as UpdateGuardada;
    },
    escribir(clave, hechos, update) {
      const destino = join(dir, nombreArchivoUpdate(clave));
      const tmp = `${destino}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
      try {
        mkdirSync(dir, { recursive: true });
        writeFileSync(tmp, JSON.stringify({ version: VERSION_CACHE_UPDATES, clave, hechos: hashHechos(hechos), update }, null, 1));
      } catch {
        try {
          unlinkSync(tmp);
        } catch {
          /* no llegó a existir */
        }
        return false;
      }
      for (let k = 0; k <= RENAME_REINTENTOS; k++) {
        try {
          renombrar(tmp, destino);
          return true;
        } catch {
          if (k < RENAME_REINTENTOS) dormir(RENAME_ESPERA_MS * (k + 1));
        }
      }
      try {
        unlinkSync(tmp);
      } catch {
        /* lo limpiará limpiarHuerfanos */
      }
      return false;
    },
  };
}
