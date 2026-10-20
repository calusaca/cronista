import { z } from "zod";
import { readFile } from "node:fs/promises";
import { reproducirArena } from "../../../../arena/coordinador";
import { leerJsonAcotado } from "../../../../arena/peticiones";
import { ErrorSesion, gestorSesiones, respuestaErrorSesion } from "../../../../arena/sesiones";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const archivos = {
  duelo: "arena-duelo-v3.json",
  "ejemplo-v3": "arena-llm-v3.json",
  ejemplo: "arena-llm-v1.json",
};
export async function POST(req: Request) {
  let etapa = "peticion";
  try {
    if (process.env.ARENA_VOZ !== "1" && process.env.ARENA_ANALISTA_LLM !== "1") throw new ErrorSesion("Consultas de grabaciones no habilitadas", 503);
    const { archivo } = z.strictObject({ archivo: z.enum(["duelo", "ejemplo-v3", "ejemplo"]) }).parse(await leerJsonAcotado(req));
    etapa = "importar";
    // El import de JSON del bundler puede reordenar propiedades; los hashes de
    // observación históricos requieren conservar la serialización del archivo.
    const ruta = `${process.cwd()}/public/experimentos/${archivos[archivo]}`;
    const datos: unknown = JSON.parse(await readFile(/* turbopackIgnore: true */ ruta, "utf8"));
    etapa = "reproducir";
    const registro = reproducirArena(datos);
    etapa = "persistir";
    return Response.json(await gestorSesiones().registrarGrabacion(registro, archivo), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.warn("CRONISTA: grabación no disponible", { etapa, tipo: error instanceof Error ? error.name : "Error", ...(error instanceof z.ZodError ? { campos: error.issues.map(i => ({ ruta: i.path.join("."), codigo: i.code })) } : {}) });
    return respuestaErrorSesion(error);
  }
}
