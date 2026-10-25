// Brief 064 § 3.2 (D4) · /cronicas: la portada de crónicas (partido destacado 246), que antes vivía en `/`.
import { PortadaCronicas } from "../../ui/PortadaCronicas";
import { idiomaDeLang } from "../../vista/raiz";
import { leerPerspectiva } from "../../vista/servidor";

export const dynamic = "force-dynamic"; // el trabajo corre en el server en cada visita (la caché lo hace instantáneo)

export default async function Cronicas({ searchParams }: { searchParams: Promise<{ perspectiva?: string; lang?: string }> }) {
  const q = await searchParams;
  return <PortadaCronicas ruta="/cronicas" perspectiva={leerPerspectiva(q.perspectiva)} idiomaBarra={idiomaDeLang(q.lang)} />;
}
