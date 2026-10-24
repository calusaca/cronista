// Brief 059 § 5.1 + § 15.5 · Lector de los torneos archivados para la página (solo servidor). Lee
// `torneo.json` e `indice.json` de `ARENA_TORNEOS_DIR` (absoluto) o de `<cwd>/public/torneos`; aplica la
// regex del id, el esquema estricto y la coherencia interna. Los registros (.gz) NO se validan aquí: los valida
// CI (`torneos-archivados.test.ts`) y el despliegue solo sale de un commit con CI en verde (requisito de
// proceso, § 15.5). Sin rutas de servidor nuevas (§ 15.8).
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { esquemaIndice, esquemaTorneo, ID_TORNEO, validarCoherencia, type IndiceTorneos, type TorneoArchivado } from "./torneo";

export type LecturaTorneo = { estado: "ok"; torneo: TorneoArchivado } | { estado: "incoherente"; id: string; errores: string[] };

export const dirTorneos = () => process.env.ARENA_TORNEOS_DIR || join(process.cwd(), "public", "torneos");

async function leerJson(ruta: string): Promise<unknown | undefined> {
  let texto: string;
  try { texto = await readFile(/* turbopackIgnore: true */ ruta, "utf8"); }
  catch { return undefined; }
  try { return JSON.parse(texto) as unknown; } catch { return null; }
}

/** Índice de ediciones (vacío si no existe o no cumple el esquema). */
export async function leerIndice(): Promise<IndiceTorneos> {
  const v = esquemaIndice.safeParse(await leerJson(join(dirTorneos(), "indice.json")));
  return v.success ? v.data : [];
}

/** null = id inválido o sin archivo (404). «incoherente» = existe pero no supera esquema o coherencia: sin cifras. */
export async function leerTorneo(id: string): Promise<LecturaTorneo | null> {
  if (!ID_TORNEO.test(id)) return null;
  const raw = await leerJson(join(dirTorneos(), id, "torneo.json"));
  if (raw === undefined) return null;
  const v = esquemaTorneo.safeParse(raw);
  if (!v.success) return { estado: "incoherente", id, errores: ["esquema"] };
  if (v.data.id !== id) return { estado: "incoherente", id, errores: ["id distinto del directorio"] };
  const errores = validarCoherencia(v.data);
  return errores.length ? { estado: "incoherente", id, errores } : { estado: "ok", torneo: v.data };
}
