// Brief 064 § 2 D2 (P2 de Codex sobre el bloque A) · La redirección de `/` vive en el proxy: los `searchParams` de una
// página agrupan las claves repetidas (`/?a=1&b=2&a=3` se leería como `a=1&a=3&b=2`), y D2 pide la query «íntegra y
// en su orden». Aquí se lee la URL original (`nextUrl.searchParams`, en su orden) con la misma función pura
// `destinoRaiz`. Con `CRONISTA_RAIZ=cronicas` (leída en cada petición; el proxy corre en Node.js) no se redirige y
// `/` renderiza la portada (D3). `src/app/page.tsx` conserva su `redirect` como respaldo, con el mismo criterio.
import { NextResponse, type NextRequest } from "next/server";
import { destinoRaiz, raizEsCronicas } from "./vista/raiz";

export function proxy(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname !== "/" || raizEsCronicas()) return NextResponse.next();
  return NextResponse.redirect(new URL(destinoRaiz(request.nextUrl.searchParams), request.nextUrl), 307);
}

export const config = { matcher: ["/"] };
