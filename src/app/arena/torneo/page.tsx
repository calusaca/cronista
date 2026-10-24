// Brief 059 § 5.2 · /arena/torneo: el torneo archivado más reciente (o el estado vacío).
import type { Metadata } from "next";
import { leerIndice, leerTorneo } from "../../../arena/torneo-archivo";
import { ArenaTorneo } from "../../../ui/ArenaTorneo";

export const metadata: Metadata = { title: "Model tournament — CRONISTA" };
export const dynamic = "force-dynamic";

export default async function PaginaTorneo({ searchParams }: { searchParams: Promise<{ [clave: string]: string | string[] | undefined }> }) {
  const { lang } = await searchParams;
  const ediciones = await leerIndice();
  const lectura = ediciones[0] ? await leerTorneo(ediciones[0].id) : null;
  return <ArenaTorneo lectura={lectura} ediciones={ediciones} idiomaInicial={lang === "es" ? "es" : "en"} />;
}
