// Brief 064 § 3.2 (D4) · La portada de crónicas (brief 004): el partido destacado YA cargado — un juez con 4 minutos no
// configura nada: el primer clic en una frase ya muestra la evidencia. Arriba, la barra única y la tira del simulador de
// 90 minutos. Vive en `/cronicas`; con `CRONISTA_RAIZ=cronicas`, la raíz la renderiza con `ruta="/"`.
// Brief 007: la perspectiva cuenta el partido para esa afición.
import { BarraHeredada } from "./BarraHeredada";
import Link from "./Enlace";
import { Pie } from "./Pie";
import { Simulador } from "./Simulador";
import { VistaPartido } from "./VistaPartido";
import { cargarPartido, type Perspectiva, presets, SEMILLA_DESTACADA } from "../vista/servidor";

export async function PortadaCronicas({ ruta, perspectiva, idiomaBarra = "en" }: { ruta: "/" | "/cronicas"; perspectiva: Perspectiva; idiomaBarra?: "es" | "en" }) {
  const datos = await cargarPartido(SEMILLA_DESTACADA, perspectiva);
  return (
    <>
      <BarraHeredada idiomaInicial={idiomaBarra} />
      <Simulador presets={presets()} semillaActual={SEMILLA_DESTACADA} seccion="cronicas" perspectivaActual={perspectiva} />
      <main data-testid="featured-match">
        {/* Brief 061 v1.1 § V3: enlace simple a la arena (push), no un «volver»; para eso está Atrás. */}
        <Link href="/arena" prefetch={false} className="volver-arena" data-testid="to-arena"><span aria-hidden="true">← </span>Arena</Link>
        <VistaPartido key={perspectiva} datos={datos} etiqueta="Featured match" ruta={ruta} />
      </main>
      <Pie datos={datos} />
    </>
  );
}
