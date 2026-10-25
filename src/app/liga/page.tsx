// Brief 016 §4 — /liga: la liga ficticia completa. Tabla de posiciones, selector de jornada con
// sus 5 partidos (marcador + link a la vista de partido de siempre) y goleadores. Todo sale de
// la temporada simulada en el server; los números son funciones puras de los resultados.
import { BarraHeredada } from "../../ui/BarraHeredada";
import Link from "../../ui/Enlace";
import { CLIMA_EN } from "../../ui/textos";
import { Simulador } from "../../ui/Simulador";
import { mundo } from "../../mundo/mundo";
import { jornadasDe } from "../../mundo/temporada";
import { bajasDeJornada, jugadoresVisibles, ligaVisible, rutaPartidoLiga, temporadaVisible } from "../../vista/liga";
import { idiomaDeLang } from "../../vista/raiz";
import { presets } from "../../vista/servidor";
import { notaDeduccion } from "../../vista/sanciones";

export const dynamic = "force-dynamic";

const GOLEADORES_VISIBLES = 10;

export default async function PaginaLiga({ searchParams }: { searchParams: Promise<{ j?: string; tab?: string; lang?: string }> }) {
  const liga = ligaVisible();
  const pais = mundo().paises.find((p) => p.id === liga.pais);
  const t = temporadaVisible();
  const total = jornadasDe(liga);
  const sp = await searchParams;
  const crudo = Number(sp.j);
  const tab = sp.tab === "players" ? "players" : "liga";
  const j = Number.isInteger(crudo) && crudo >= 1 && crudo <= total ? crudo : 1;
  const partidos = t.partidos.filter((p) => p.jornada === j);
  const top = t.goleadores.slice(0, GOLEADORES_VISIBLES);

  return (
    <>
      <BarraHeredada idiomaInicial={idiomaDeLang(sp.lang)} />
      <Simulador presets={presets()} seccion="liga" />
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

        <nav className="liga-tabs" aria-label="League sections" data-testid="league-tabs">
          <Link href={`/liga?j=${j}`} className="liga-tab" aria-current={tab === "liga" ? "page" : undefined} data-testid="tab-league" prefetch={false} scroll={false}>
            Standings &amp; matchdays
          </Link>
          <Link href={`/liga?tab=players&j=${j}`} className="liga-tab" aria-current={tab === "players" ? "page" : undefined} data-testid="tab-players" prefetch={false} scroll={false}>
            Players
          </Link>
        </nav>

        {tab === "players" ? (
          <Jugadores j={j} total={total} />
        ) : (
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
                    <tr key={f.equipo} data-testid="league-row" data-equipo={f.equipo} data-pts={f.pts} data-dg={f.dg} {...(f.deduccion ? { "data-deduccion": f.deduccion.puntos } : {})}>
                      <td>{i + 1}</td>
                      <td className="tabla-equipo">
                        {f.equipo}
                        {f.deduccion && (
                          <>
                            <span className="tabla-asterisco" aria-hidden="true">
                              *
                            </span>
                            <span className="tabla-nota" data-testid="league-deduction">
                              {notaDeduccion(f)}
                            </span>
                          </>
                        )}
                      </td>
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
            {t.tabla.some((f) => f.deduccion) && (
              <p className="ratings-note" data-testid="league-deduction-legend">
                * Points deducted by a club sanction this season (fictional cause): the points shown are already net of the deduction.
              </p>
            )}
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
        )}
      </main>
      <footer className="footer">
        <span>Every match is simulated. Countries, leagues, teams and players are fictitious; no real match data is used.</span>
      </footer>
    </>
  );
}

/** Brief 019 §3 — la pestaña Players: top del rating (con su desglose por partido), tarjetas y bajas de la jornada. */
function Jugadores({ j, total }: { j: number; total: number }) {
  const { top, tarjetas, minPartidos } = jugadoresVisibles();
  const bajas = bajasDeJornada(j);
  return (
    <div className="liga-grid" data-testid="players-tab">
      <section className="liga-panel" aria-labelledby="rating-titulo">
        <div className="panel-head">
          <h2 className="overline" id="rating-titulo">
            Season rating
          </h2>
          <span className="ratings-note">
            The average of each player&apos;s match ratings (minimum {minPartidos} matches). Open a player to see every rating behind it; each links to its match.
          </span>
        </div>
        <ol className="rating-temporada tnum" data-testid="season-ratings">
          {top.map((r) => (
            <li key={`${r.equipo}|${r.jugador}`} data-testid="rating-row" data-rating={r.rating.toFixed(1)} data-partidos={r.partidos}>
              <details>
                <summary>
                  <span className="rt-nota">{r.rating.toFixed(1)}</span>
                  <span className="rt-jugador">{r.jugador}</span>
                  <span className="rt-equipo">{r.equipo}</span>
                  <span className="rt-partidos">in {r.partidos} matches</span>
                </summary>
                <ol className="rt-desglose" data-testid="rating-breakdown">
                  {r.notas.map((n) => (
                    <li key={`${n.jornada}-${n.indice}`}>
                      <Link href={rutaPartidoLiga(n)} data-testid="rating-match-link" data-nota={n.nota.toFixed(1)} prefetch={false}>
                        <span>Matchday {n.jornada} · vs {n.rival}</span>
                        <span className="rt-nota-partido">{n.nota.toFixed(1)}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </details>
            </li>
          ))}
        </ol>
      </section>

      <section className="liga-panel" aria-labelledby="bajas-titulo">
        <div className="panel-head">
          <h2 className="overline" id="bajas-titulo">
            Unavailable for matchday {j}
          </h2>
          <span className="ratings-note">Red card: one matchday for a second yellow, two for a straight red. Injuries: 1–4 matchdays.</span>
        </div>
        <nav className="jornadas" aria-label="Choose a matchday" data-testid="players-matchday-nav">
          {Array.from({ length: total }, (_, k) => k + 1).map((n) => (
            <Link key={n} href={`/liga?tab=players&j=${n}`} className="jornada-pill tnum" aria-current={n === j ? "page" : undefined} prefetch={false} scroll={false}>
              {n}
            </Link>
          ))}
        </nav>
        {bajas.length === 0 ? (
          <p className="stats-vacio">Every squad is complete for this matchday.</p>
        ) : (
          <ul className="bajas-lista" data-testid="unavailable">
            {bajas.map((b) => (
              <li key={`${b.equipo}|${b.jugador}`} data-testid="unavailable-player" data-motivo={b.motivo}>
                <span className="gol-jugador">{b.jugador}</span>
                <span className="gol-equipo">{b.equipo}</span>
                <span className="gol-n">
                  {b.motivo === "suspension" ? "Suspended" : "Injured"} · {b.jornadas === 1 ? "this matchday" : `${b.jornadas} matchdays`}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="panel-head goleadores-head">
          <h2 className="overline">Cards</h2>
        </div>
        <ol className="goleadores tnum" data-testid="cards">
          {tarjetas.slice(0, 10).map((x) => (
            <li key={`${x.equipo}|${x.jugador}`}>
              <span className="gol-jugador">{x.jugador}</span>
              <span className="gol-equipo">{x.equipo}</span>
              <span className="gol-n">
                {x.amarillas} Y · {x.rojas} R
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
