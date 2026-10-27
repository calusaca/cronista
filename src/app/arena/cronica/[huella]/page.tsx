// Brief 064 § 4.9 · /arena/cronica/<huella>: la crónica verificada de un partido de la arena. Servidor: lee con
// `leerCronicaArena` (la misma función que el GET, sin HTTP), recalcula los hechos y re-verifica; nunca genera ni llama
// a un modelo (I7). 404 si la huella no tiene registro. Al cliente pasa solo lo que se muestra, nunca los fotogramas.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { leerCronicaArena } from "../../../../arena/cronica";
import { HUELLA } from "../../../../arena/cronica-almacen";
import { CronicaArena } from "../../../../ui/CronicaArena";
import { propsCronicaArena } from "../../../../ui/cronica-arena-props";

export const metadata: Metadata = { title: "Match report — CRONISTA" };
export const dynamic = "force-dynamic";

export default async function PaginaCronicaArena({ params, searchParams }: { params: Promise<{ huella: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ huella }, { lang }] = await Promise.all([params, searchParams]);
  if (!HUELLA.test(huella)) notFound();
  const l = await leerCronicaArena(huella);
  if (!l) notFound();
  return <CronicaArena {...propsCronicaArena(l, lang === "es" ? "es" : "en")} />;
}
