// Brief 064 § 4.8 · POST /api/arena/cronicas: genera (o devuelve la guardada) la crónica verificada de un partido de la
// arena. Cuerpo estricto: una de las cinco fuentes. Tope del cuerpo: ARENA.archivoMaxBytes para `{ registro }` (con
// admisión por IP y global, decidida con el primer fragmento, como en grabaciones) y 1 KB para las demás.
// No usa `req.signal`: una vez reservada, la generación termina y se guarda aunque el espectador cierre la pestaña.
import { Admision } from "../../../../arena/admision";
import { servicioCronicas } from "../../../../arena/cronica";
import { ErrorCronica, esquemaFuente } from "../../../../arena/cronica-fuentes";
import { ErrorPeticion, leerJsonDeCuerpo } from "../../../../arena/peticiones";
import { ARENA, CRONICA_ARENA } from "../../../../sim/limites";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PEQUENO_MAX_BYTES = 1024;
/** Un cuerpo que empieza por una de las fuentes pequeñas se salta la admisión y queda en 1 KB; en la duda, admisión. */
const FUENTE_PEQUENA = /^\s*\{\s*"(?:sesion|torneo|encuentro|archivo|huella)"\s*:/;
const compartida = globalThis as typeof globalThis & { __cronistaAdmisionCronicas?: Admision };
const admision = () => compartida.__cronistaAdmisionCronicas ??= new Admision(CRONICA_ARENA.admision);

const sinCache = { "cache-control": "no-store" };
function respuestaError(error: unknown): Response {
  if (error instanceof ErrorCronica) {
    return Response.json({ error: error.message, ...(error.motivo ? { motivo: error.motivo } : {}) }, { status: error.status, headers: { ...sinCache, ...(error.retryAfterS ? { "retry-after": String(error.retryAfterS) } : {}) } });
  }
  if (error instanceof ErrorPeticion) return Response.json({ error: error.message }, { status: error.status, headers: sinCache });
  console.warn("CRONISTA: crónica de arena no disponible", { tipo: error instanceof Error ? error.name : "Error" });
  return Response.json({ error: "No se pudo escribir la crónica" }, { status: 503, headers: sinCache });
}

export async function POST(req: Request): Promise<Response> {
  let admitida: { liberar(): void } | undefined;
  try {
    const largo = Number(req.headers.get("content-length") ?? NaN);
    if (Number.isFinite(largo) && largo > ARENA.archivoMaxBytes) { await req.body?.cancel().catch(() => {}); throw new ErrorPeticion("Petición demasiado grande", 413); }
    if (!req.body) throw new ErrorPeticion("Petición vacía", 400);
    const lector = req.body.getReader();
    const primero = await lector.read();
    const pequena = !primero.done && FUENTE_PEQUENA.test(new TextDecoder().decode(primero.value.subarray(0, 64)));
    if (!pequena) {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida";
      const r = admision().admitir(ip);
      if (!r.ok) {
        await lector.cancel().catch(() => {});
        return Response.json({ error: "Demasiadas subidas; espera un momento", motivo: "subidas" }, { status: 429, headers: { ...sinCache, "retry-after": String(Math.max(1, Math.ceil(r.reintentarEnMs / 1000))) } });
      }
      admitida = r;
    }
    const cuerpo = new ReadableStream<Uint8Array>({
      start: (c) => { if (primero.done) c.close(); else c.enqueue(primero.value); },
      pull: async (c) => { const { done, value } = await lector.read(); if (done) c.close(); else c.enqueue(value); },
      cancel: (motivo) => lector.cancel(motivo),
    });
    const crudo = await leerJsonDeCuerpo(cuerpo, pequena ? PEQUENO_MAX_BYTES : ARENA.archivoMaxBytes);
    const fuente = esquemaFuente.safeParse(crudo);
    if (!fuente.success || (pequena && "registro" in fuente.data)) throw new ErrorCronica("Cuerpo inválido", 400);
    return Response.json(await servicioCronicas().generar(fuente.data), { headers: sinCache });
  } catch (error) {
    return respuestaError(error);
  } finally { admitida?.liberar(); }
}
