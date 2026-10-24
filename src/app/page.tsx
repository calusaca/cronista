// Home (brief 004): el partido destacado YA cargado — un juez con 4 minutos no configura
// nada: el primer clic en una frase ya muestra la evidencia. Arriba, simular otro.
// Brief 007: ?perspectiva=local|visita cuenta el partido para esa afición.
import Link from "../ui/Enlace";
import { Pie } from "../ui/Pie";
import { Simulador } from "../ui/Simulador";
import { VistaPartido } from "../ui/VistaPartido";
import { cargarPartido, leerPerspectiva, presets, SEMILLA_DESTACADA } from "../vista/servidor";

export const dynamic = "force-dynamic"; // el trabajo corre en el server en cada visita (la caché lo hace instantáneo)

export default async function Home({ searchParams }: { searchParams: Promise<{ perspectiva?: string }> }) {
  const perspectiva = leerPerspectiva((await searchParams).perspectiva);
  const datos = await cargarPartido(SEMILLA_DESTACADA, perspectiva);
  return (
    <>
      <Simulador presets={presets()} semillaActual={SEMILLA_DESTACADA} seccion="cronicas" perspectivaActual={perspectiva} />
      <main data-testid="featured-match">
        {/* Brief 061 v1.1 § V3: enlace simple a la arena (push), no un «volver»; para eso está Atrás. */}
        <Link href="/arena" prefetch={false} className="volver-arena" data-testid="to-arena"><span aria-hidden="true">← </span>Arena</Link>
        <VistaPartido key={perspectiva} datos={datos} etiqueta="Featured match" ruta="/" />
      </main>
      <Pie datos={datos} />
    </>
  );
}
