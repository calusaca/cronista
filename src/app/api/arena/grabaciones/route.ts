import { createHash } from "node:crypto";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { Admision, admisionSubidas } from "../../../../arena/admision";
import { contenidoCanonico, reproducirArena } from "../../../../arena/coordinador";
import { registroCompleto } from "../../../../arena/cronica-hechos";
import { ErrorPeticion, leerJsonDeCuerpo } from "../../../../arena/peticiones";
import { ErrorSesion, gestorSesiones, respuestaErrorSesion } from "../../../../arena/sesiones";
import type { RegistroArena } from "../../../../arena/tipos";
import { ARENA, PLAY_NARRADO } from "../../../../sim/limites";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const archivos = {
  duelo: "arena-duelo-v3.json",
  "ejemplo-v3": "arena-llm-v3.json",
  ejemplo: "arena-llm-v1.json",
};
const esquemaArchivo = z.strictObject({ archivo: z.enum(["duelo", "ejemplo-v3", "ejemplo"]) });
/** Brief 057 § 3.3 · Dos formas: un archivo del repositorio o un registro subido por el espectador. */
const esquemaCuerpo = z.union([esquemaArchivo, z.strictObject({ registro: z.unknown() })]);
/** Un registro completo cubre la duración configurada (o terminó antes por final anticipado). Brief 064: vive en
 * `cronica-hechos.ts` (la misma expresión), que también la usa la crónica. */
const completo = registroCompleto;
/** Comprobación previa sobre el JSON crudo, solo si tiene la forma esperada; lo demás lo rechaza el validador. */
function incompletoCrudo(crudo: unknown): boolean {
  const r = crudo as { config?: { duracionS?: unknown }; final?: { tick?: unknown; finalizado?: unknown } } | null;
  return typeof r?.config?.duracionS === "number" && typeof r.final?.tick === "number" && !completo(r as Pick<RegistroArena, "config" | "final">);
}

export async function POST(req: Request) {
  let etapa = "peticion";
  let admitida: { liberar(): void } | undefined;
  try {
    if (process.env.ARENA_VOZ !== "1" && process.env.ARENA_ANALISTA_LLM !== "1") throw new ErrorSesion("Consultas de grabaciones no habilitadas", 503);
    // v1.1 § 3 · Un content-length mayor que el tope se rechaza sin leer; el lector sigue siendo la garantía real.
    const largo = Number(req.headers.get("content-length") ?? NaN);
    if (Number.isFinite(largo) && largo > ARENA.archivoMaxBytes) { await req.body?.cancel().catch(() => {}); throw new ErrorPeticion("Petición demasiado grande", 413); }
    if (!req.body) throw new ErrorPeticion("Petición vacía", 400);
    // v1.1 § 3 · La admisión se decide con el primer fragmento, ANTES de leer el resto y de validar:
    // un cuerpo que empieza por {"archivo" se salta la admisión y solo puede ser un archivo; en la duda, admisión.
    const lector = req.body.getReader();
    const primero = await lector.read();
    const archivoPrimero = !primero.done && /^\s*\{\s*"archivo"\s*:/.test(new TextDecoder().decode(primero.value.subarray(0, 64)));
    if (!archivoPrimero) {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida";
      const r = admisionSubidas(() => new Admision(PLAY_NARRADO.subida, Date.now, PLAY_NARRADO.reintentoRegistroMs)).admitir(ip);
      if (!r.ok) {
        await lector.cancel().catch(() => {});
        return Response.json({ error: r.motivo === "en-curso" ? "Hay otra subida en curso" : "Demasiadas subidas; espera un momento" }, { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil(r.reintentarEnMs / 1000))), "cache-control": "no-store" } });
      }
      admitida = r;
    }
    const cuerpo = new ReadableStream<Uint8Array>({
      start: c => { if (primero.done) c.close(); else c.enqueue(primero.value); },
      pull: async c => { const { done, value } = await lector.read(); if (done) c.close(); else c.enqueue(value); },
      cancel: motivo => lector.cancel(motivo),
    });
    // v1.3 (5) · Un cuerpo que empieza por {"archivo" no pasó por la admisión: vuelve al tope de 16 KB del lector.
    const crudo = await leerJsonDeCuerpo(cuerpo, archivoPrimero ? undefined : ARENA.archivoMaxBytes);
    const leido = (archivoPrimero ? esquemaArchivo : esquemaCuerpo).safeParse(crudo);
    if (!leido.success) throw new ErrorSesion("Cuerpo inválido", 400);
    const datos = leido.data;
    if ("archivo" in datos) {
      etapa = "importar";
      // El import de JSON del bundler puede reordenar propiedades; los hashes de
      // observación históricos requieren conservar la serialización del archivo.
      const ruta = `${process.cwd()}/public/experimentos/${archivos[datos.archivo]}`;
      const archivo: unknown = JSON.parse(await readFile(/* turbopackIgnore: true */ ruta, "utf8"));
      etapa = "reproducir";
      const registro = reproducirArena(archivo);
      etapa = "persistir";
      return Response.json(await gestorSesiones().registrarGrabacion(registro, datos.archivo), { headers: { "cache-control": "no-store" } });
    }
    // Brief 057 § 3.3 · Rama `registro`: el validador real (el mismo de «Abrir registro guardado»), solo
    // registros completos, referencia por el hash del contenido canónico y procedencia declarada.
    etapa = "validar";
    if (incompletoCrudo(datos.registro)) throw new ErrorSesion("Registro incompleto", 400);
    let registro: RegistroArena;
    try { registro = reproducirArena(datos.registro); }
    catch (error) { throw new ErrorSesion(error instanceof Error && error.message === "Registro incompleto" ? "Registro incompleto" : "Registro inválido", 400); }
    if (!completo(registro)) throw new ErrorSesion("Registro incompleto", 400);
    const referencia = "subida-" + createHash("sha256").update(JSON.stringify(contenidoCanonico(registro))).digest("hex").slice(0, 40);
    etapa = "persistir";
    return Response.json(await gestorSesiones().registrarGrabacion(registro, referencia, "declarada"), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.warn("CRONISTA: grabación no disponible", { etapa, tipo: error instanceof Error ? error.name : "Error", ...(error instanceof z.ZodError ? { campos: error.issues.map(i => ({ ruta: i.path.join("."), codigo: i.code })) } : {}) });
    return respuestaErrorSesion(error);
  } finally { admitida?.liberar(); }
}
