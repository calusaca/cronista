import type { Metadata } from "next";
import { crearControladorProgramado } from "../../arena/controladores";
import { ejecutarArena } from "../../arena/coordinador";
import { crearConfigArena } from "../../arena/motor";
import { Arena } from "../../ui/Arena";

export const metadata: Metadata = { title: "Arena — CRONISTA" };
export const dynamic = "force-dynamic";
export default async function PaginaArena() {
  const inicial = await ejecutarArena(crearConfigArena({ duracionS: 60 }), { local: crearControladorProgramado(), visita: crearControladorProgramado() });
  return <Arena inicial={inicial} />;
}
