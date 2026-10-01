// Home (brief 004): el partido destacado YA cargado — un juez con 4 minutos no configura
// nada: el primer clic en una frase ya muestra la evidencia. Arriba, simular otro.
import { Pie } from "../ui/Pie";
import { Simulador } from "../ui/Simulador";
import { VistaPartido } from "../ui/VistaPartido";
import { cargarPartido, presets, SEMILLA_DESTACADA } from "../vista/servidor";

export const dynamic = "force-dynamic"; // el trabajo corre en el server en cada visita (la caché lo hace instantáneo)

export default async function Home() {
  const datos = await cargarPartido(SEMILLA_DESTACADA);
  return (
    <>
      <Simulador presets={presets()} semillaActual={SEMILLA_DESTACADA} />
      <main data-testid="featured-match">
        <VistaPartido datos={datos} etiqueta="Featured match" />
      </main>
      <Pie datos={datos} />
    </>
  );
}
