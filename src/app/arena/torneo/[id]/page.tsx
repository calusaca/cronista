// Brief 059 § 5.2 · /arena/torneo/<id>: una edición archivada; un id desconocido es 404.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { leerIndice, leerTorneo } from "../../../../arena/torneo-archivo";
import { ArenaTorneo } from "../../../../ui/ArenaTorneo";

export const metadata: Metadata = { title: "Model tournament — CRONISTA" };
export const dynamic = "force-dynamic";

export default async function PaginaEdicion({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ [clave: string]: string | string[] | undefined }> }) {
  const [{ id }, { lang }] = await Promise.all([params, searchParams]);
  const lectura = await leerTorneo(id);
  if (!lectura) notFound();
  return <ArenaTorneo lectura={lectura} ediciones={await leerIndice()} idiomaInicial={lang === "es" ? "es" : "en"} />;
}
