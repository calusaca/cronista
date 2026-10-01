// Vista de partido (brief 004): /match/[seed]. Todo se calcula en el server.
// Brief 007: ?perspectiva=local|visita cuenta el partido para esa afición.
import { notFound } from "next/navigation";
import { validarSeedTexto } from "../../../sim/cli-args";
import { Pie } from "../../../ui/Pie";
import { Simulador } from "../../../ui/Simulador";
import { VistaPartido } from "../../../ui/VistaPartido";
import { cargarPartido, leerPerspectiva, presets } from "../../../vista/servidor";

export const dynamic = "force-dynamic";

export default async function Partido({
  params,
  searchParams,
}: {
  params: Promise<{ seed: string }>;
  searchParams: Promise<{ perspectiva?: string }>;
}) {
  const { seed: crudo } = await params;
  const v = validarSeedTexto(crudo);
  if (!v.ok) notFound();
  const perspectiva = leerPerspectiva((await searchParams).perspectiva);
  const datos = await cargarPartido(v.seed, perspectiva);
  const historia = presets().find((p) => p.seed === v.seed)?.historia;
  return (
    <>
      <Simulador presets={presets()} semillaActual={v.seed} />
      <main>
        <VistaPartido key={perspectiva} datos={datos} etiqueta={historia ?? "Match"} ruta={`/match/${v.seed}`} />
      </main>
      <Pie datos={datos} />
    </>
  );
}
