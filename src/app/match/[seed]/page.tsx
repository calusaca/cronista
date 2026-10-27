// Vista de partido (brief 004): /match/[seed]. Todo se calcula en el server.
// Brief 007: ?perspectiva=local|visita cuenta el partido para esa afición.
import { notFound } from "next/navigation";
import { validarSeedTexto } from "../../../sim/cli-args";
import { BarraHeredada } from "../../../ui/BarraHeredada";
import Link from "../../../ui/Enlace";
import { Pie } from "../../../ui/Pie";
import { Simulador } from "../../../ui/Simulador";
import { VistaPartido } from "../../../ui/VistaPartido";
import { enlaceArena, idiomaDeLang, origenArenaPublica } from "../../../vista/raiz";
import { cargarPartido, leerPerspectiva, presets } from "../../../vista/servidor";

export const dynamic = "force-dynamic";

export default async function Partido({
  params,
  searchParams,
}: {
  params: Promise<{ seed: string }>;
  searchParams: Promise<{ perspectiva?: string; lang?: string }>;
}) {
  const { seed: crudo } = await params;
  const v = validarSeedTexto(crudo);
  if (!v.ok) notFound();
  const q = await searchParams;
  const perspectiva = leerPerspectiva(q.perspectiva);
  const datos = await cargarPartido(v.seed, perspectiva);
  const historia = presets().find((p) => p.seed === v.seed)?.historia;
  const origenArena = origenArenaPublica(); // brief 069: en el servidor, en cada petición
  return (
    <>
      <BarraHeredada idiomaInicial={idiomaDeLang(q.lang)} origenArena={origenArena} />
      <Simulador key={v.seed} presets={presets()} semillaActual={v.seed} seccion="cronicas" perspectivaActual={perspectiva} />
      <main>
        {/* Brief 061 v1.1 § V3: enlace simple a la arena (push), no un «volver»; para eso está Atrás. */}
        <Link href={enlaceArena("/arena", origenArena)} prefetch={false} className="volver-arena" data-testid="to-arena"><span aria-hidden="true">← </span>Arena</Link>
        <VistaPartido key={`${v.seed}:${perspectiva}`} datos={datos} etiqueta={historia ?? "Match"} ruta={`/match/${v.seed}`} />
      </main>
      <Pie datos={datos} />
    </>
  );
}
