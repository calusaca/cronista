// Brief 062 § 17.6 · Cancelación administrativa con `authorization: Bearer <token>` (`ARENA_ADMIN_TOKEN`). Aborta el
// torneo activo (todas las esperas escuchan la señal) y responde `{ id, estado }` cuando la instantánea final está
// escrita. Token incorrecto ⇒ 401 (limitador global de fallos ⇒ 429); sin torneo activo ⇒ 404.
import { gestorTorneoSitio, respuestaErrorSitio } from "../../../../../../arena/torneo-sitio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  try {
    const g = gestorTorneoSitio();
    g.verificarAdmin(req.headers.get("authorization"));
    return Response.json(await g.cancelar(), { headers: { "cache-control": "no-store" } });
  } catch (error) { return respuestaErrorSitio(error); }
}
