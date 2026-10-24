// Brief 059 § 5.2 + 062 § 7.1 · /arena/torneo/<id>: una edición archivada o un torneo lanzado en el sitio (`sitio-…`,
// leído del almacén); un id desconocido es 404.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { datosPaginaTorneo } from "../../../../arena/torneo-pagina";
import { ArenaTorneo } from "../../../../ui/ArenaTorneo";

export const metadata: Metadata = { title: "Model tournament — CRONISTA" };
export const dynamic = "force-dynamic";

export default async function PaginaEdicion({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ [clave: string]: string | string[] | undefined }> }) {
  const [{ id }, { lang }] = await Promise.all([params, searchParams]);
  const datos = await datosPaginaTorneo(id);
  if (!datos) notFound();
  return <ArenaTorneo lectura={datos.lectura} lista={datos.lista} clubes={datos.clubes} panel idiomaInicial={lang === "es" ? "es" : "en"} />;
}
