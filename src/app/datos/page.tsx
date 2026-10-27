// Brief 028 §3 — /datos: la historia del dataset en una pantalla. Cifras de cabecera de la corrida
// de referencia (ficha.json, escrita por el CLI), el esquema en una tabla corta (el diccionario del
// código), la descarga de la muestra REAL de public/ y el DATASHEET. Nada a mano.
import { BarraHeredada } from "../../ui/BarraHeredada";
import Link from "../../ui/Enlace";
import { CAMPOS_LINEA } from "../../dataset/esquema";
import { dec, miles } from "../../dataset/texto";
import { ESQUEMA, MUESTRA_ARCHIVO } from "../../dataset/umbrales-dataset";
import { Simulador } from "../../ui/Simulador";
import { DescargaMuestra } from "../../ui/DescargaMuestra";
import { kbMuestra, leerFicha, RUTA_DATASHEET } from "../../vista/datos";
import { idiomaDeLang, origenArenaPublica } from "../../vista/raiz";
import { presets } from "../../vista/servidor";

export const dynamic = "force-dynamic";

export default async function PaginaDatos({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { lang } = await searchParams;
  const f = leerFicha();
  const kb = kbMuestra();
  const semillas = f.muestra.semillas;
  const primera = semillas[0] as number;
  const ultima = semillas[semillas.length - 1] as number;
  const b = f.bandasCorrida;
  return (
    <>
      <BarraHeredada idiomaInicial={idiomaDeLang(lang)} origenArena={origenArenaPublica()} />
      <Simulador presets={presets()} seccion="datos" />
      <main className="liga datos" data-testid="data-page">
        <header className="liga-head">
          <div className="overline">Dataset · Synthetic, reproducible, validated</div>
          <h1 className="liga-titulo">The CRONISTA match dataset</h1>
          <p className="liga-sub">
            Complete simulated matches — macro events, the micro layer of play behind them, and the Analyst&apos;s facts with citations to the events that support
            them. One command regenerates every byte: <code className="datos-code">{f.comando}</code>.
          </p>
        </header>

        <section className="datos-cifras" aria-label="Reference run" data-testid="data-figures">
          <div className="datos-cifra" data-testid="data-figure" data-clave="partidos" data-valor={f.partidos}>
            <span className="datos-num tnum">{miles(f.partidos)}</span>
            <span className="datos-etq">matches in the reference run (any seed works: the generator has no fixed size)</span>
          </div>
          <div className="datos-cifra" data-testid="data-figure" data-clave="micro" data-valor={f.microPorPartido}>
            <span className="datos-num tnum">{miles(f.microPorPartido)}</span>
            <span className="datos-etq">
              micro-events per match, on {dec(f.eventosPorPartido, 1)} macro events and {dec(f.hechosPorPartido, 1)} cited facts
            </span>
          </div>
          <div className="datos-cifra" data-testid="data-figure" data-clave="bandas" data-valor={b.enBanda}>
            <span className="datos-num tnum">
              {miles(b.enBanda)}/{miles(b.total)}
            </span>
            <span className="datos-etq">
              plausibility bands in range on this run · {miles(b.consistentes)} not resolvable at this size · {miles(b.fuera)} out
            </span>
          </div>
          <div className="datos-cifra" data-testid="data-figure" data-clave="experimentos" data-valor={f.experimentos.enBanda}>
            <span className="datos-num tnum">
              {miles(f.experimentos.enBanda)}/{miles(f.experimentos.total)}
            </span>
            <span className="datos-etq">
              controlled experiments in band (styles, weather, pitch, pressure) · {miles(f.comprobaciones.total)} invariant checks, {miles(f.comprobaciones.violaciones)}{" "}
              violations
            </span>
          </div>
        </section>

        <div className="liga-grid">
          <section className="liga-panel datos-panel" aria-labelledby="muestra-titulo">
            <h2 className="overline" id="muestra-titulo">
              Try it
            </h2>
            <p>
              A real {miles(semillas.length)}-match sample — seeds {miles(primera)}–{miles(ultima)}, exactly what <code className="datos-code">npm run dataset -- --muestra</code> writes
              (one JSON object per line, schema <code className="datos-code">{ESQUEMA}</code>).
            </p>
            <DescargaMuestra href={`/${MUESTRA_ARCHIVO}`}>
              Download the sample · JSONL · {miles(kb)} KB
            </DescargaMuestra>
            <p className="ratings-note">
              Seed matches carry every engine variant (player levels, rare events, injuries, own goals), so seed {miles(primera)} here is a different match from{" "}
              <Link href={`/match/${primera}`} prefetch={false}>
                /match/{primera}
              </Link>
              , which shows the base engine.
            </p>
            <p>
              <a href="/datos/datasheet" data-testid="datasheet-link">
                Read the datasheet
              </a>{" "}
              — motivation, composition, generation, validation, limitations; generated by the same command (<code className="datos-code">{RUTA_DATASHEET}</code> in the
              repository).
            </p>
          </section>

          <section className="liga-panel datos-panel" aria-labelledby="esquema-titulo">
            <h2 className="overline" id="esquema-titulo">
              One line per match
            </h2>
            <div className="tabla-scroll">
              <table className="tabla datos-tabla" data-testid="schema-table">
                <thead>
                  <tr>
                    <th scope="col">Field</th>
                    <th scope="col">Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {CAMPOS_LINEA.map((c) => (
                    <tr key={c.campo} data-testid="schema-field">
                      <td>
                        <code className="datos-code">{c.campo}</code>
                      </td>
                      <td>{c.en.replace(/`/g, "")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <p className="datos-pie ratings-note" data-testid="data-honesty">
          Every match is simulated. Teams, players and leagues are fictitious; no real match data is used. Field names are the code&apos;s own (Spanish), documented in
          English.
        </p>
      </main>
    </>
  );
}
