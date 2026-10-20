// Esta ruta conserva políticas programadas y reproducción. La ejecución incremental
// con inferencia explícita y acotada vive en /api/arena/sesiones.
import { z } from "zod";
import { crearControladorProgramado } from "../../../arena/controladores";
import { ejecutarArena, reproducirArena } from "../../../arena/coordinador";
import { crearConfigArena } from "../../../arena/motor";
import { entornoArena } from "../../../arena/peticiones";
import { formaciones } from "../../../arena/tipos";
import { ARENA } from "../../../sim/limites";

export const dynamic = "force-dynamic";
const peticion = z.discriminatedUnion("accion", [
  z.strictObject({ accion: z.literal("simular"), seed: z.number().int().min(0).max(4294967295), segundos: z.number().int().min(1).max(ARENA.duracionMaxS), local: z.enum([...formaciones, "auto"]), visita: z.enum([...formaciones, "auto"]),
    // superRefine de temperatura por clima (brief 044) compartido con /api/arena/sesiones.
    entorno: entornoArena.optional(),
  }),
  z.strictObject({ accion: z.literal("reproducir"), registro: z.unknown() }),
]);
async function leerAcotado(req: Request): Promise<unknown> {
  if (!req.body) throw new Error("Petición vacía");
  const lector = req.body.getReader(); let bytes = 0;
  const partes: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await lector.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > ARENA.archivoMaxBytes) { await lector.cancel(); throw new Error("Petición demasiado grande"); }
      partes.push(value);
    }
  } finally { lector.releaseLock(); }
  return JSON.parse(Buffer.concat(partes).toString("utf8")) as unknown;
}
export async function POST(req: Request): Promise<Response> {
  try {
    const p = peticion.parse(await leerAcotado(req));
    const registro = p.accion === "reproducir" ? reproducirArena(p.registro) : await ejecutarArena(
      crearConfigArena({ seed: p.seed, duracionS: p.segundos, ...(p.local !== "auto" ? { local: p.local } : {}), ...(p.visita !== "auto" ? { visita: p.visita } : {}), entorno: p.entorno }),
      { local: crearControladorProgramado(), visita: crearControladorProgramado() }, { signal: req.signal },
    );
    return Response.json(registro, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "Invalid experiment or recording. Check the settings or use an unmodified arena-v1, arena-v2 or arena-v3 file." }, { status: 400 });
  }
}
