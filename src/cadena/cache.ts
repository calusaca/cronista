// Caché en disco de crónicas verificadas (brief 003), por (seed, deployment, modo)
// — `modo` es la personalización del 007. Guarda la crónica CON su `audit` (006): la
// historia de una corrida real queda reproducible sin volver a llamar al LLM.
//
// Además de la clave se guarda un hash de los hechos de entrada: si el Analista cambia
// (o el partido no es el de configDeSemilla(seed)), la entrada vieja se ignora en vez
// de servir una crónica de otros hechos.
//
// Revisión 3.2 (robustez):
// - `escribir` JAMÁS lanza: rename atómico con reintentos (Windows da EPERM/EBUSY si otro
//   proceso tiene el destino abierto); si aun así falla, borra su temporal y devuelve false.
// - Al abrir la caché se borran los `.tmp` huérfanos (escrituras interrumpidas).
// - La lectura exige esquema zod COMPLETO y COHERENCIA del audit: una entrada que cuente
//   una historia imposible (n desordenados, «aprobado» en medio, modo/intentos que no
//   cuadran, apoyos repetidos) no se sirve: se regenera. La Caja de cristal no muestra
//   historia fabricada.

import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { Hecho } from "../analista/tipos";
import type { CronicaVerificada, ModoPersonalizacion } from "./tipos";
import { MAX_REINTENTOS, RENAME_ESPERA_MS, RENAME_REINTENTOS, TMP_HUERFANO_MS } from "./umbrales";
import { esquemaDraft, esquemaDraftAudit } from "./verificador";

export interface ClaveCache {
  seed: number;
  deployment: string;
  modo: ModoPersonalizacion;
}

export interface Cache {
  leer(clave: ClaveCache, hechos: Hecho[]): CronicaVerificada | undefined;
  /** Devuelve true si quedó guardada. Nunca lanza. */
  escribir(clave: ClaveCache, hechos: Hecho[], cronica: CronicaVerificada): boolean;
}

/** Versión del formato. 2 = contrato de la revisión 3.1 (oración con `hecho` principal). */
export const VERSION_CACHE = 2;

const esquemaMotivo = z.object({
  oracion: z.number().int(),
  regla: z.enum(["V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8"]),
  detalle: z.string(),
});

const esquemaCronica = esquemaDraft
  .extend({
    intentos: z.number().int().min(0).max(1 + MAX_REINTENTOS),
    frasesOmitidas: z.number().int().min(0),
    modo: z.enum(["llm", "acta"]),
    audit: z.array(
      z.object({
        n: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        borrador: esquemaDraftAudit,
        veredicto: z.array(esquemaMotivo),
        feedback: z.string().optional(),
        crudo: z.string().optional(),
      }),
    ),
  })
  .superRefine((c, ctx) => {
    const mal = (mensaje: string) => ctx.addIssue({ code: "custom", message: mensaje });
    // Historia: n secuencial desde 1; un «aprobado» (veredicto vacío) solo puede ser el último.
    c.audit.forEach((a, i) => {
      if (a.n !== i + 1) mal(`audit[${i}].n = ${a.n}, debía ser ${i + 1}`);
      if (a.veredicto.length === 0 && i !== c.audit.length - 1) mal(`audit[${i}] aprobado pero no es el último`);
    });
    if (c.intentos !== c.audit.length) mal(`intentos ${c.intentos} ≠ audit.length ${c.audit.length}`);
    const ultimo = c.audit[c.audit.length - 1];
    if (c.modo === "llm") {
      if (c.audit.length === 0) mal("modo llm sin ningún intento");
      else if (ultimo && ultimo.veredicto.length === 0) {
        if (c.frasesOmitidas !== 0) mal("aprobado a la primera pero con frases omitidas");
      } else if (c.intentos !== 1 + MAX_REINTENTOS) {
        // Llegó a modo llm sin un último aprobado: solo por omisión tras agotar reintentos.
        mal("modo llm sin aprobación ni reintentos agotados");
      }
    } else {
      if (c.frasesOmitidas !== 0) mal("el acta no omite frases");
      if (c.audit.some((a) => a.veredicto.length === 0)) mal("acta con un intento aprobado");
      if (c.audit.length !== 0 && c.audit.length !== 1 + MAX_REINTENTOS) mal("acta sin agotar reintentos");
    }
    // Apoyos sin repetidos.
    c.oraciones.forEach((o, i) => {
      if (o.apoyo && new Set(o.apoyo).size !== o.apoyo.length) mal(`oraciones[${i}].apoyo repetido`);
    });
  });

const esquemaEntrada = z.object({
  version: z.literal(VERSION_CACHE),
  clave: z.object({ seed: z.number(), deployment: z.string(), modo: z.literal("neutral") }),
  hechos: z.string(),
  cronica: esquemaCronica,
});

export function hashHechos(hechos: Hecho[]): string {
  return createHash("sha256").update(JSON.stringify(hechos)).digest("hex");
}

export function nombreArchivo(c: ClaveCache): string {
  const limpio = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, "_");
  return `${c.seed}__${limpio(c.deployment)}__${limpio(c.modo)}.json`;
}

interface Entrada {
  version: number;
  clave: ClaveCache;
  hechos: string;
  cronica: CronicaVerificada;
}

/** Directorio por defecto: CRONISTA_CACHE_DIR o .cache/cronicas (ignorado por git). */
export function directorioPorDefecto(env: Record<string, string | undefined> = process.env): string {
  return env.CRONISTA_CACHE_DIR?.trim() || join(".cache", "cronicas");
}

/** Espera síncrona corta (entre reintentos de rename) sin ocupar la CPU. */
function dormir(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export interface OpcionesCacheDisco {
  /** Solo para pruebas: el rename atómico (por defecto fs.renameSync). */
  renombrar?: (desde: string, hasta: string) => void;
  /** Antigüedad a partir de la cual un `.tmp` es huérfano (por defecto TMP_HUERFANO_MS). */
  edadHuerfanoMs?: number;
}

/** Borra los `.tmp` huérfanos (archivos, no directorios) más viejos que la edad dada. */
export function limpiarHuerfanos(dir: string, edadMs: number): number {
  let borrados = 0;
  let nombres: string[];
  try {
    nombres = readdirSync(dir);
  } catch {
    return 0; // el directorio aún no existe
  }
  const ahora = Date.now();
  for (const n of nombres) {
    if (!n.endsWith(".tmp")) continue;
    const ruta = join(dir, n);
    try {
      const st = statSync(ruta);
      if (st.isFile() && ahora - st.mtimeMs >= edadMs) {
        unlinkSync(ruta);
        borrados++;
      }
    } catch {
      // otro proceso lo movió o lo borró: no es nuestro problema
    }
  }
  return borrados;
}

export function crearCacheDisco(dir: string = directorioPorDefecto(), opciones: OpcionesCacheDisco = {}): Cache {
  const renombrar = opciones.renombrar ?? renameSync;
  limpiarHuerfanos(dir, opciones.edadHuerfanoMs ?? TMP_HUERFANO_MS);
  return {
    leer(clave, hechos) {
      let crudo: unknown;
      try {
        crudo = JSON.parse(readFileSync(join(dir, nombreArchivo(clave)), "utf8"));
      } catch {
        return undefined; // no existe, no es JSON, o está bloqueada en este instante: se regenera
      }
      const r = esquemaEntrada.safeParse(crudo);
      if (!r.success) return undefined;
      const e = r.data as Entrada;
      if (e.hechos !== hashHechos(hechos)) return undefined;
      if (e.clave.seed !== clave.seed || e.clave.deployment !== clave.deployment || e.clave.modo !== clave.modo) return undefined;
      return e.cronica;
    },
    escribir(clave, hechos, cronica) {
      const destino = join(dir, nombreArchivo(clave));
      // .tmp único: dos procesos que escriben la misma clave no se pisan el temporal.
      const tmp = `${destino}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
      try {
        mkdirSync(dir, { recursive: true });
        const e: Entrada = { version: VERSION_CACHE, clave, hechos: hashHechos(hechos), cronica };
        writeFileSync(tmp, JSON.stringify(e, null, 1));
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
          renombrar(tmp, destino); // escritura atómica: nunca queda un JSON a medias
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
