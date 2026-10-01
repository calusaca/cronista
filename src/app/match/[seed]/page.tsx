// Vista de partido (brief 004): /match/[seed]. Todo se calcula en el server.
import { notFound } from "next/navigation";
import { validarSeedTexto } from "../../../sim/cli-args";
import { Pie } from "../../../ui/Pie";
import { Simulador } from "../../../ui/Simulador";
import { VistaPartido } from "../../../ui/VistaPartido";
import { cargarPartido, presets } from "../../../vista/servidor";

export const dynamic = "force-dynamic";

export default async function Partido({ params }: { params: Promise<{ seed: string }> }) {
  const { seed: crudo } = await params;
  const v = validarSeedTexto(crudo);
  if (!v.ok) notFound();
  const datos = await cargarPartido(v.seed);
  const historia = presets().find((p) => p.seed === v.seed)?.historia;
  return (
    <>
      <Simulador presets={presets()} semillaActual={v.seed} />
      <main>
        <VistaPartido datos={datos} etiqueta={historia ?? "Match"} />
      </main>
      <Pie datos={datos} />
    </>
  );
}
