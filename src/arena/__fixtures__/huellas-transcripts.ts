import { createHash } from "node:crypto";

/** Longitud (hex) de cada huella SHA-256 truncada. */
export const LONGITUD_HUELLA = 12;
export const normalizarTramo = (t: string) => t.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
// Las marcas de tiempo («0:066 seconds», «1:02:031 hour, 2 minutes, 3 seconds») se retiran para no cortar frases.
export const quitarMarcasDeTiempo = (t: string) => t.replace(/\d+(?::\d+)+(?:\s*(?:\d+\s*)?(?:hours?|minutes?|seconds?),?)*/g, " ");
export const huellaTramo = (tramo: string) => createHash("sha256").update(tramo).digest("hex").slice(0, LONGITUD_HUELLA);
/** Conjunto de huellas a partir del JSON versionado (cadena concatenada de longitud fija). */
export function conjuntoHuellas(concatenadas: string): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i < concatenadas.length; i += LONGITUD_HUELLA) s.add(concatenadas.slice(i, i + LONGITUD_HUELLA));
  return s;
}
