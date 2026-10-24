// Brief 059 § 5.2 + 062 § 7.1 · /arena/torneo: panel «Lanzar un torneo», el torneo activo del sitio si lo hay (si no,
// el más reciente de cualquier origen) y la lista «Torneos» separada por origen.
import type { Metadata } from "next";
import { datosPaginaTorneo } from "../../../arena/torneo-pagina";
import { ArenaTorneo } from "../../../ui/ArenaTorneo";

export const metadata: Metadata = { title: "Model tournament — CRONISTA" };
export const dynamic = "force-dynamic";

export default async function PaginaTorneo({ searchParams }: { searchParams: Promise<{ [clave: string]: string | string[] | undefined }> }) {
  const { lang } = await searchParams;
  const datos = (await datosPaginaTorneo(null))!;
  return <ArenaTorneo lectura={datos.lectura} lista={datos.lista} clubes={datos.clubes} panel idiomaInicial={lang === "es" ? "es" : "en"} />;
}
