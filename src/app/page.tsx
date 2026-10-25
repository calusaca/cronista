// Brief 064 § 3.2 (D2/D3) · `/` lleva a la arena con una redirección 307 que conserva la query (con `perspectiva`, a la
// portada de crónicas en `/cronicas`). En el host de la demo de crónicas, `CRONISTA_RAIZ=cronicas` mantiene `/` como
// portada, para no romper los enlaces ya entregados. `redirect` va fuera de cualquier `try`.
import { redirect } from "next/navigation";
import { PortadaCronicas } from "../ui/PortadaCronicas";
import { destinoRaiz, idiomaDeLang, raizEsCronicas } from "../vista/raiz";
import { leerPerspectiva } from "../vista/servidor";

export const dynamic = "force-dynamic";

export default async function Raiz({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  if (raizEsCronicas()) {
    const perspectiva = typeof q.perspectiva === "string" ? q.perspectiva : undefined;
    return <PortadaCronicas ruta="/" perspectiva={leerPerspectiva(perspectiva)} idiomaBarra={idiomaDeLang(q.lang)} />;
  }
  redirect(destinoRaiz(q));
}
