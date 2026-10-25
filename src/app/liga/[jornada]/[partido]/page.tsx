// Brief 016 §4 — un partido de liga: la vista de partido de SIEMPRE (crónica, stats, pizarra,
// ratings, replay), con su config fabricada por la temporada, más un breadcrumb y la
// navegación anterior/siguiente por el calendario.
import { BarraHeredada } from "../../../../ui/BarraHeredada";
import Link from "../../../../ui/Enlace";
import { notFound } from "next/navigation";
import { Pie } from "../../../../ui/Pie";
import { Simulador } from "../../../../ui/Simulador";
import { VistaPartido } from "../../../../ui/VistaPartido";
import { cargarPartidoLiga, contextoDe, leerRefPartido, rutaPartidoLiga } from "../../../../vista/liga";
import { idiomaDeLang } from "../../../../vista/raiz";
import { leerPerspectiva, presets } from "../../../../vista/servidor";

export const dynamic = "force-dynamic";

export default async function PartidoDeLiga({
  params,
  searchParams,
}: {
  params: Promise<{ jornada: string; partido: string }>;
  searchParams: Promise<{ perspectiva?: string; lang?: string }>;
}) {
  const { jornada, partido } = await params;
  const ref = leerRefPartido(jornada, partido);
  if (!ref) notFound();
  const q = await searchParams;
  const perspectiva = leerPerspectiva(q.perspectiva);
  const datos = await cargarPartidoLiga(ref, perspectiva);
  const c = contextoDe(ref);
  const ruta = rutaPartidoLiga(ref);
  return (
    <>
      <BarraHeredada idiomaInicial={idiomaDeLang(q.lang)} />
      <Simulador presets={presets()} seccion="liga" />
      <main>
        <nav className="breadcrumb" aria-label="League" data-testid="league-breadcrumb">
          <Link href={`/liga?j=${c.jornada}`} className="breadcrumb-back" data-testid="league-back" prefetch={false}>
            ← {c.liga} · Matchday {c.jornada}
          </Link>
          <span className="breadcrumb-meta tnum">
            Match {c.indice} of the matchday · {c.pais}
          </span>
          <span className="breadcrumb-nav">
            {c.anterior ? (
              <Link href={rutaPartidoLiga(c.anterior)} className="btn btn-quiet" data-testid="league-prev" prefetch={false}>
                ← Previous
              </Link>
            ) : null}
            {c.siguiente ? (
              <Link href={rutaPartidoLiga(c.siguiente)} className="btn btn-quiet" data-testid="league-next" prefetch={false}>
                Next →
              </Link>
            ) : null}
          </span>
        </nav>
        <VistaPartido
          key={`${ruta}|${perspectiva}`}
          datos={datos}
          etiqueta={`${c.liga} · Matchday ${c.jornada}`}
          ruta={ruta}
          overlayUrl={`/api/liga/${ref.jornada}/${ref.indice}/overlay`}
          origen="League fixture"
        />
      </main>
      <Pie datos={datos} />
    </>
  );
}
