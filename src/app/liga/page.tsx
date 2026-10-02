// Brief 016 §4 — /liga: la liga ficticia completa. Tabla de posiciones, selector de jornada con
// sus 5 partidos (marcador + link a la vista de partido de siempre) y goleadores. Todo sale de
// la temporada simulada en el server; los números son funciones puras de los resultados.
import Link from "next/link";
import { CLIMA_EN } from "../../ui/textos";
import { Simulador } from "../../ui/Simulador";
import { mundo } from "../../mundo/mundo";
import { jornadasDe } from "../../mundo/temporada";
import { ligaVisible, rutaPartidoLiga, temporadaVisible } from "../../vista/liga";
import { presets } from "../../vista/servidor";

export const dynamic = "force-dynamic";

const GOLEADORES_VISIBLES = 10;

export default async function PaginaLiga({ searchParams }: { searchParams: Promise<{ j?: string }> }) {
  const liga = ligaVisible();
  const pais = mundo().paises.find((p) => p.id === liga.pais);
  const t = temporadaVisible();
  const total = jornadasDe(liga);
  const crudo = Number((await searchParams).j);
  const j = Number.isInteger(crudo) && crudo >= 1 && crudo <= total ? crudo : 1;
  const partidos = t.partidos.filter((p) => p.jornada === j);
  const top = t.goleadores.slice(0, GOLEADORES_VISIBLES);

  return (
    <>
      <Simulador presets={presets()} />
      <main className="liga" data-testid="league-page">
        <header className="liga-head">
          <div className="overline">League mode · A fully simulated fictional league</div>
          <h1 className="liga-titulo" data-testid="league-name">
            {liga.nombre}
          </h1>
          <p className="liga-sub tnum">
            {pais?.nombre} · {pais ? CLIMA_EN[pais.clima] : ""} climate · Season {t.temporada} · {liga.equipos.length} teams · {total} matchdays,
            home and away
          </p>
        </header>

        <div className="liga-grid">
          <section className="liga-panel" aria-labelledby="tabla-titulo">
            <div className="panel-head">
              <h2 className="overline" id="tabla-titulo">
                Standings
              </h2>
              <span className="ratings-note">3 points a win, 1 a draw · ties: goal difference, goals scored, name</span>
            </div>
            <div className="tabla-scroll" data-testid="league-table-scroll">
              <table className="tabla tnum" data-testid="league-table">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col" className="tabla-equipo">
                      Team
                    </th>
                    <th scope="col" title="Played">
                      P
                    </th>
                    <th scope="col" title="Won">
                      W
                    </th>
                    <th scope="col" title="Drawn">
                      D
                    </th>
                    <th scope="col" title="Lost">
                      L
                    </th>
                    <th scope="col" title="Goals for">
                      GF
                    </th>
                    <th scope="col" title="Goals against">
                      GA
                    </th>
                    <th scope="col" title="Goal difference">
                      GD
                    </th>
                    <th scope="col" title="Points">
                      Pts
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {t.tabla.map((f, i) => (
                    <tr key={f.equipo} data-testid="league-row" data-equipo={f.equipo} data-pts={f.pts} data-dg={f.dg}>
                      <td>{i + 1}</td>
                      <td className="tabla-equipo">{f.equipo}</td>
                      <td>{f.pj}</td>
                      <td>{f.g}</td>
                      <td>{f.e}</td>
                      <td>{f.p}</td>
                      <td>{f.gf}</td>
                      <td>{f.gc}</td>
                      <td>{f.dg > 0 ? `+${f.dg}` : f.dg < 0 ? `−${-f.dg}` : "0"}</td>
                      <td className="tabla-pts">{f.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="liga-panel" aria-labelledby="jornada-titulo">
            <div className="panel-head">
              <h2 className="overline" id="jornada-titulo">
                Matchday {j}
              </h2>
              <span className="ratings-note">Each match opens the full report: chronicle, stats, goal diagrams, ratings, live replay.</span>
            </div>
            <nav className="jornadas" aria-label="Choose a matchday" data-testid="matchday-nav">
              {Array.from({ length: total }, (_, k) => k + 1).map((n) => (
                <Link
                  key={n}
                  href={`/liga?j=${n}`}
                  className="jornada-pill tnum"
                  aria-current={n === j ? "page" : undefined}
                  data-testid="matchday-link"
                  data-jornada={n}
                  prefetch={false}
                  scroll={false}
                >
                  {n}
                </Link>
              ))}
            </nav>
            <ol className="jornada-partidos" data-testid="matchday-matches" data-jornada={j}>
              {partidos.map((p) => (
                <li key={p.indice}>
                  <Link
                    href={rutaPartidoLiga(p)}
                    className="jornada-partido tnum"
                    data-testid="league-match"
                    data-jornada={p.jornada}
                    data-indice={p.indice}
                    prefetch={false}
                  >
                    <span className="jp-local">{p.local}</span>
                    <span className="jp-marcador">
                      {p.golesLocal}–{p.golesVisita}
                    </span>
                    <span className="jp-visita">{p.visita}</span>
                  </Link>
                </li>
              ))}
            </ol>

            <div className="panel-head goleadores-head">
              <h2 className="overline">Top scorers</h2>
            </div>
            <ol className="goleadores tnum" data-testid="scorers">
              {top.map((g) => (
                <li key={`${g.equipo}|${g.jugador}`} data-testid="scorer" data-goles={g.goles}>
                  <span className="gol-jugador">{g.jugador}</span>
                  <span className="gol-equipo">{g.equipo}</span>
                  <span className="gol-n">{g.goles}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </main>
      <footer className="footer">
        <span>Every match is simulated. Countries, leagues, teams and players are fictitious; no real match data is used.</span>
      </footer>
    </>
  );
}
