// Brief 062 § 6.3 + § 6.8 + § 17.7 · Estado y lanzamiento del torneo del sitio.
// POST: las comprobaciones van EN ESTE ORDEN y ninguna de las cuatro primeras toca el almacén:
//   1. interruptor (`ARENA_TORNEO_SITIO`) y `CRONISTA_COMMIT` ⇒ 503;
//   2. `Origin` igual a `ARENA_ORIGEN_PUBLICO` (esquema, host y puerto) ⇒ 403, y `content-type: application/json` ⇒ 415;
//   3. limitador en memoria con el ÚLTIMO salto de x-forwarded-for ⇒ 429 (solo protege la carga de la ruta);
//   4. cuerpo leído de forma incremental (1 KB, 2 s) ⇒ 413 / 408, `{ formato }` estricto ⇒ 400;
// después, la admisión del gestor dentro del mutex (cupo, bolsa y torneo activo persistidos). `liberar()` va en
// `finally`. `?prueba=1` solo existe con un token de administración válido; sin token se ignora.
import { TORNEO_SITIO as S } from "../../../../../sim/limites";
import {
  claveLimitador, debeIniciarGestor, ErrorSitio, esquemaPeticionLanzar, gestorTorneoSitio, leerCuerpoAcotado, origenCoincide, respuestaErrorSitio, TEXTO_MOTIVO,
} from "../../../../../arena/torneo-sitio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const sinCache = { "cache-control": "no-store" };

export async function GET(): Promise<Response> {
  try {
    const g = gestorTorneoSitio();
    if (debeIniciarGestor()) g.iniciar();
    return Response.json(g.estado(), { headers: sinCache });
  } catch (error) { return respuestaErrorSitio(error); }
}

export async function POST(req: Request): Promise<Response> {
  const g = gestorTorneoSitio(), cfg = g.config();
  if (cfg.motivo === "desactivado" || cfg.motivo === "commit") return respuestaErrorSitio(new ErrorSitio(TEXTO_MOTIVO[cfg.motivo], 503, cfg.motivo));
  if (!cfg.origen) return respuestaErrorSitio(new ErrorSitio(TEXTO_MOTIVO.origen, 503, "origen"));
  if (!origenCoincide(req.headers.get("origin"), cfg.origen)) return respuestaErrorSitio(new ErrorSitio("Origen no admitido", 403));
  if (!/^application\/json(\s*;|$)/i.test(req.headers.get("content-type") ?? "")) return respuestaErrorSitio(new ErrorSitio("Se espera application/json", 415));
  const admitida = g.admisionHttp.admitir(claveLimitador(req.headers.get("x-forwarded-for")));
  if (!admitida.ok) return respuestaErrorSitio(new ErrorSitio("Demasiados intentos; espera un momento.", 429, null, Math.ceil(admitida.reintentarEnMs / 1000)));
  try {
    const cuerpo = esquemaPeticionLanzar.safeParse(await leerCuerpoAcotado(req, S.admision.cuerpoMaxBytes, S.cuerpoPlazoMs));
    if (!cuerpo.success) throw new ErrorSitio("Cuerpo inválido: se espera { \"formato\": \"liga\" | \"grupos\" }", 400);
    const prueba = new URL(req.url).searchParams.get("prueba") === "1" && req.headers.has("authorization");
    if (prueba) g.verificarAdmin(req.headers.get("authorization"));
    g.iniciar();
    const { id } = await g.lanzar({ formato: cuerpo.data.formato, prueba });
    return Response.json({ id }, { status: 202, headers: sinCache });
  } catch (error) { return respuestaErrorSitio(error); }
  finally { admitida.liberar(); }
}
