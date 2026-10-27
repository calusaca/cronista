// Brief 064 § 2 D2 (P2 de Codex sobre el bloque A) · La redirección de `/` vive en el proxy: los `searchParams` de una
// página agrupan las claves repetidas (`/?a=1&b=2&a=3` se leería como `a=1&a=3&b=2`), y D2 pide la query «íntegra y
// en su orden». Aquí se lee la URL original (`nextUrl.searchParams`, en su orden) con la misma función pura
// `destinoRaiz`. Con `CRONISTA_RAIZ=cronicas` (leída en cada petición; el proxy corre en Node.js) no se redirige y
// `/` renderiza la portada (D3). `src/app/page.tsx` conserva su `redirect` como respaldo, con el mismo criterio.
import { NextResponse, type NextRequest } from "next/server";
import { destinoRaiz, raizEsCronicas } from "./vista/raiz";

// La URL original solo llega íntegra con `skipProxyUrlNormalize: true` en `next.config.ts` (sin ella Next agrupa las
// claves repetidas antes del proxy). Esa opción también deja pasar `_rsc`, el parámetro interno de las navegaciones del
// cliente, que Next quitaba por defecto: se descarta aquí para que el destino lleve solo la query del usuario.
// El destino se resuelve contra `request.url` (con esa opción, la URL tal cual) y no contra `nextUrl`, que reescribe
// 127.0.0.1 como `localhost`: Next vuelve relativo el `Location` solo si su origen coincide con el de la petición, y
// con `localhost` saldría absoluto hacia un host interno.
const PARAMETRO_RSC = "_rsc";

export function proxy(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname !== "/" || raizEsCronicas()) return NextResponse.next();
  const query = new URLSearchParams(request.nextUrl.searchParams);
  query.delete(PARAMETRO_RSC);
  return NextResponse.redirect(new URL(destinoRaiz(query), request.url), 307);
}

export const config = { matcher: ["/"] };
