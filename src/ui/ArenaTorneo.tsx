"use client";
// Brief 059 § 5.2–5.5 + § 15.7/15.10 · Página del torneo entre modelos (cliente). Todo número sale de
// `torneo.json` (validado por el servidor con el esquema y la coherencia; los registros, en CI) y de funciones
// puras de `torneo.ts`; las cifras que declara el ejecutor llevan «†». El público no lanza torneos (D1).
import { useMemo, useState } from "react";
import { identidadPartido } from "../arena/identidad";
import { ETIQUETAS_CIFRAS } from "../arena/estadisticas";
import {
  archivoEncuentro, calendarioTorneo, clasificar, cruces, matrizResultados, metricasParticipante, TEXTO_PAREO, textoSignificacion,
  type IndiceTorneos, type Metrica, type ParticipanteTorneo, type TorneoArchivado,
} from "../arena/torneo";
import type { LecturaTorneo } from "../arena/torneo-archivo";
import { IDENTIDAD_ARENA } from "../sim/limites";
import { EmblemaCronista } from "./Emblema";
import Link from "./Enlace";
import { Escudo } from "./Escudo";

type Idioma = "es" | "en";
const REPO = "https://github.com/calusaca/cronista";

/** § 5.5 · Lista cerrada de textos (con la redacción de § 15.7 para la significación y el pareo). */
export const TEXTOS_TORNEO = {
  titulo: { es: "Torneo entre modelos", en: "Model tournament" },
  overline: { es: "Experimental · torneo entre modelos", en: "Experimental · model tournament" },
  resumen: { es: (n: number, s: number) => `${n} entrenadores de IA, todos contra todos, ida y vuelta, ${s} s por partido`, en: (n: number, s: number) => `${n} AI coaches, double round robin, ${s} s per match` },
  tabla: { es: "Tabla de posiciones", en: "Standings" },
  matriz: { es: "Resultados (local en filas, visita en columnas)", en: "Results (home in rows, away in columns)" },
  partidos: { es: "Partidos por jornada", en: "Matches by round" },
  metricas: { es: "Cómo jugaron los entrenadores", en: "How the coaches played" },
  procedencia: { es: "Procedencia y coste", en: "Provenance and cost" },
  limites: { es: "Lo que este torneo no demuestra", en: "What this tournament does not show" },
  repeticion: { es: "Ver repetición", en: "Watch replay" },
  descargar: { es: "Descargar registro", en: "Download record" },
  declarado: { es: "† declarado por el CLI; no se puede comprobar con el registro", en: "† declared by the CLI; not verifiable from the record" },
  ensayo: { es: "Torneo de ensayo · sin IA", en: "Rehearsal tournament · no AI" },
  incompleto: { es: (k: number) => `Torneo incompleto: ${k} partidos sin disputar`, en: (k: number) => `Incomplete tournament: ${k} matches not played` },
  vacio: { es: "Aún no hay torneos archivados", en: "No tournaments archived yet" },
  incoherente: { es: "Este torneo no supera la comprobación de coherencia; no se muestran sus cifras", en: "This tournament fails its consistency check; its figures are not shown" },
  nav: { es: "Torneo", en: "Tournament" },
} as const;

type ClaveTexto = { [K in keyof typeof TEXTOS_TORNEO]: (typeof TEXTOS_TORNEO)[K]["es"] extends string ? K : never }[keyof typeof TEXTOS_TORNEO];
const fechaDe = (iso: string, idioma: Idioma) => new Intl.DateTimeFormat(idioma, { dateStyle: "long", timeZone: "UTC" }).format(new Date(iso));
const numero = (x: number, idioma: Idioma, decimales = 0) => new Intl.NumberFormat(idioma, { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(x);
const usd = (micro: number, idioma: Idioma) => `${numero(micro / 1_000_000, idioma, 4)} USD`;
const ordinal = (n: number, idioma: Idioma) => idioma === "es" ? `${n}.º` : `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
const nn = (n: number) => String(n).padStart(2, "0");
export const enlaceRepeticion = (id: string, n: number, idioma: Idioma) => `/arena?torneo=${id}&encuentro=${nn(n)}${idioma === "es" ? "&lang=es" : ""}`;

function Barra({ idioma, cambiar }: { idioma: Idioma; cambiar: () => void }) {
  const es = idioma === "es";
  return <header className="topbar arena-topbar">
    <Link href="/" className="brand" prefetch={false}><EmblemaCronista /><span className="brand-mark">CRONISTA</span><span className="brand-tag">{es ? "Torneo entre modelos" : "Model tournament"}</span></Link>
    <nav className="topbar-links" aria-label={es ? "Secciones" : "Sections"}>
      <Link href="/" prefetch={false}>{es ? "Crónicas" : "Match reports"}</Link>
      <Link href={es ? "/arena?lang=es" : "/arena"} prefetch={false}>{es ? "Laboratorio" : "Lab"}</Link>
      <button className="btn" onClick={cambiar} aria-label={es ? "Cambiar a inglés" : "Switch to Spanish"}>{es ? "EN" : "ES"}</button>
    </nav>
  </header>;
}

/** Nombre completo; a ≤ 520 px se ve el corto y el completo queda en `title` y en texto oculto. */
function Modelo({ p }: { p: ParticipanteTorneo }) {
  return <span className="arena-torneo-modelo" title={p.nombre}><span className="arena-torneo-largo">{p.nombre}</span><span className="arena-torneo-corto" aria-hidden="true">{p.corto}</span></span>;
}
const Valor = ({ m, idioma, decimales = 0, sufijo = "" }: { m: Metrica; idioma: Idioma; decimales?: number; sufijo?: string }) =>
  <>{m.valor === null ? "—" : `${numero(m.valor, idioma, decimales)}${sufijo}`}{m.fuente === "declarada" ? " †" : ""}</>;

export function ArenaTorneo({ lectura, ediciones, idiomaInicial }: { lectura: LecturaTorneo | null; ediciones: IndiceTorneos; idiomaInicial: Idioma }) {
  const [idioma, setIdioma] = useState<Idioma>(idiomaInicial);
  const es = idioma === "es", tx = (k: ClaveTexto) => TEXTOS_TORNEO[k][idioma] as string;
  const cambiar = () => setIdioma(es ? "en" : "es");
  const cuerpo = !lectura ? <section className="arena-torneo-vacio" aria-labelledby="arena-torneo-h1">
      <p className="overline">{tx("overline")}</p><h1 id="arena-torneo-h1">{tx("vacio")}</h1>
      <p>{es ? "Los torneos se juegan fuera del sitio, con un tope de gasto propio, y se publican ya archivados y comprobados en CI: desde aquí no se puede lanzar ninguno." : "Tournaments are played off-site with their own spending cap and published already archived and checked in CI: none can be launched from here."}</p>
    </section>
    : lectura.estado === "incoherente" ? <section aria-labelledby="arena-torneo-h1"><p className="overline">{tx("overline")}</p><h1 id="arena-torneo-h1">{tx("titulo")}</h1>
      <p role="alert" className="arena-torneo-banda" data-testid="arena-torneo-incoherente">{tx("incoherente")}</p></section>
    : <Contenido torneo={lectura.torneo} idioma={idioma} />;
  return <>
    <Barra idioma={idioma} cambiar={cambiar} />
    <main className="arena-shell arena-torneo" lang={idioma} data-testid="arena-torneo">
      {cuerpo}
      {ediciones.length > 1 && <section className="arena-torneo-panel" aria-labelledby="arena-torneo-ediciones"><h2 id="arena-torneo-ediciones">{es ? "Otras ediciones" : "Other editions"}</h2>
        <ul>{ediciones.map(e => <li key={e.id}><Link href={`/arena/torneo/${e.id}${es ? "?lang=es" : ""}`} prefetch={false}>{e.titulo[idioma]}</Link></li>)}</ul></section>}
    </main>
  </>;
}

function Contenido({ torneo: t, idioma }: { torneo: TorneoArchivado; idioma: Idioma }) {
  const es = idioma === "es", tx = (k: ClaveTexto) => TEXTOS_TORNEO[k][idioma] as string;
  const part = useMemo(() => new Map(t.participantes.map(p => [p.id, p])), [t]);
  const filas = useMemo(() => clasificar(t), [t]), matriz = useMemo(() => matrizResultados(t), [t]);
  const plan = useMemo(() => calendarioTorneo(t.participantes.map(p => p.id), t.semilla), [t]), globales = useMemo(() => cruces(t), [t]);
  const porN = new Map(t.encuentros.map(e => [e.n, e]));
  const p = (id: string) => part.get(id)!;
  const jornadas = [...new Set(plan.map(x => x.jornada))];
  const metricas = filas.map(f => metricasParticipante(t, f.id));
  const devueltos = (id: string) => [...new Set(t.encuentros.flatMap(e => [e.local, e.visita]).filter(l => l.participante === id).flatMap(l => l.declarado.modelosDevueltos))].sort();
  const estimados = t.participantes.filter(x => x.precio.estimadoDe);
  const etiqueta = (clave: keyof typeof ETIQUETAS_CIFRAS) => ETIQUETAS_CIFRAS[clave][idioma];
  return <>
    <section className="arena-torneo-cabecera" aria-labelledby="arena-torneo-h1">
      <p className="overline">{tx("overline")}</p>
      <h1 id="arena-torneo-h1">{tx("titulo")}</h1>
      <p>{TEXTOS_TORNEO.resumen[idioma](t.participantes.length, t.duracionS)}</p>
      <dl className="arena-torneo-datos">
        <div><dt>{es ? "Fecha (UTC)" : "Date (UTC)"}</dt><dd>{fechaDe(t.inicioUtc, idioma)}</dd></div>
        <div><dt>{es ? "Modelos" : "Models"}</dt><dd className="tnum">{t.participantes.length}</dd></div>
        <div><dt>{es ? "Partidos jugados" : "Matches played"}</dt><dd className="tnum">{t.encuentros.length} / {plan.length}</dd></div>
        <div><dt>{es ? "Coste total" : "Total cost"}</dt><dd className="tnum">{usd(t.gasto.conocidoMicroUsd, idioma)} †</dd></div>
      </dl>
      {t.tipo === "ensayo" && <p className="arena-torneo-banda" data-testid="arena-torneo-ensayo"><strong>{tx("ensayo")}</strong>{es ? ": entrenadores programados con nombre de prueba." : ": programmed coaches with test names."}</p>}
      {t.estado === "incompleto" && <p className="arena-torneo-banda" data-testid="arena-torneo-incompleto"><strong>{TEXTOS_TORNEO.incompleto[idioma](t.pendientes.length)}</strong></p>}
      <p className="arena-torneo-aviso" data-testid="arena-torneo-significacion">{textoSignificacion(t, idioma)} {TEXTO_PAREO[idioma]}</p>
    </section>

    <section className="arena-torneo-panel" aria-labelledby="arena-torneo-h-tabla">
      <h2 id="arena-torneo-h-tabla">{tx("tabla")}</h2>
      <table className="arena-torneo-tabla" data-testid="arena-torneo-tabla">
        <caption>{es ? "Puntos 3/1/0; desempate por diferencia de goles, goles a favor y liguilla entre los empatados; «=» es posición compartida." : "Points 3/1/0; ties broken by goal difference, goals for and a mini-league among the tied; “=” is a shared position."}</caption>
        <thead><tr>
          <th scope="col"><abbr title={es ? "Posición" : "Position"}>Pos</abbr></th><th scope="col">{es ? "Modelo" : "Model"}</th>
          <th scope="col"><abbr title={es ? "Partidos jugados" : "Played"}>{es ? "PJ" : "P"}</abbr></th>
          <th scope="col"><abbr title={es ? "Ganados, empatados y perdidos" : "Won, drawn and lost"}>{es ? "G-E-P" : "W-D-L"}</abbr></th>
          <th scope="col"><abbr title={es ? "Goles a favor y en contra" : "Goals for and against"}>{es ? "Goles" : "Goals"}</abbr></th>
          <th scope="col"><abbr title={es ? "Diferencia de goles" : "Goal difference"}>{es ? "DG" : "GD"}</abbr></th>
          <th scope="col"><abbr title={es ? "Puntos" : "Points"}>Pts</abbr></th>
        </tr></thead>
        <tbody>{filas.map(f => <tr key={f.id} data-testid="arena-torneo-fila" data-participante={f.id}>
          <td className="tnum">{f.empatada ? <><span aria-hidden="true">{f.pos}=</span><span className="arena-torneo-oculto">{es ? `empatado en el ${ordinal(f.pos, idioma)} puesto` : `tied for ${ordinal(f.pos, idioma)} place`}</span></> : f.pos}</td>
          <th scope="row"><Modelo p={p(f.id)} /></th>
          <td className="tnum">{f.pj}</td><td className="tnum">{f.g}-{f.e}-{f.p}</td><td className="tnum">{f.gf}:{f.gc}</td><td className="tnum">{f.dg > 0 ? `+${f.dg}` : f.dg}</td><td className="tnum"><strong>{f.pts}</strong></td>
        </tr>)}</tbody>
      </table>
    </section>

    <section className="arena-torneo-panel" aria-labelledby="arena-torneo-h-matriz">
      <h2 id="arena-torneo-h-matriz">{tx("matriz")}</h2>
      <table className="arena-torneo-matriz" data-testid="arena-torneo-matriz">
        <caption>{es ? "Cada celda abre la repetición del partido." : "Each cell opens the match replay."}</caption>
        <thead><tr><td />{matriz.ids.map(id => <th scope="col" key={id}><abbr title={p(id).nombre}>{p(id).corto}</abbr></th>)}</tr></thead>
        <tbody>{matriz.ids.map((local, i) => <tr key={local}><th scope="row"><abbr title={p(local).nombre}>{p(local).corto}</abbr></th>
          {matriz.celdas[i]!.map((c, j) => <td key={matriz.ids[j]}>{c.tipo === "diagonal" ? <><span aria-hidden="true">—</span><span className="arena-torneo-oculto">{es ? "no aplica" : "not applicable"}</span></>
            : c.tipo === "pendiente" ? <><span aria-hidden="true">s/d</span><span className="arena-torneo-oculto">{es ? "sin disputar" : "not played"}</span></>
            : <a href={enlaceRepeticion(t.id, c.n, idioma)} data-testid="arena-torneo-celda"><span aria-hidden="true">{c.gl}–{c.gv}</span><span className="arena-torneo-oculto">{`${p(local).nombre} ${c.gl}, ${p(matriz.ids[j]!).nombre} ${c.gv}. ${es ? `Ver la repetición del partido ${c.n}` : `Watch the replay of match ${c.n}`}`}</span></a>}</td>)}
        </tr>)}</tbody>
      </table>
    </section>

    <section className="arena-torneo-panel" aria-labelledby="arena-torneo-h-partidos">
      <h2 id="arena-torneo-h-partidos">{tx("partidos")}</h2>
      {jornadas.map(j => <div key={j} className="arena-torneo-jornada"><h3>{es ? `Jornada ${j}` : `Round ${j}`}{plan.find(x => x.jornada === j)!.vuelta ? (es ? " · vuelta" : " · second leg") : ""}</h3>
        <ol>{plan.filter(x => x.jornada === j).map(x => {
          const e = porN.get(x.n), g = globales.find(c => c.cruce === x.cruce)!;
          const identidad = e ? identidadPartido(e.local.club, e.visita.club) : null;
          return <li key={x.n} data-testid="arena-torneo-partido" data-n={x.n}>
            {e && identidad ? <span className="arena-torneo-linea">J{x.jornada} · P{x.n} · <Escudo identidad={identidad.local} size={IDENTIDAD_ARENA.escudoPx.cifras} /> {e.local.club} ({p(x.local).corto}) <strong className="tnum">{e.local.goles}–{e.visita.goles}</strong> <Escudo identidad={identidad.visita} size={IDENTIDAD_ARENA.escudoPx.cifras} /> {e.visita.club} ({p(x.visita).corto})</span>
              : <span className="arena-torneo-linea">J{x.jornada} · P{x.n} · {p(x.local).corto} – {p(x.visita).corto} · {es ? "sin disputar" : "not played"}</span>}
            {x.vuelta && g.completo && <span className="arena-muted"> · {es ? "Global" : "Aggregate"}: {p(g.a).corto} {g.golesA}–{g.golesB} {p(g.b).corto}</span>}
            {e && <span className="arena-torneo-acciones"><a href={enlaceRepeticion(t.id, x.n, idioma)}>{tx("repeticion")}<span className="arena-torneo-oculto">{es ? ` del partido ${x.n}` : ` of match ${x.n}`}</span></a>
              <a href={`/torneos/${t.id}/${archivoEncuentro(x.n)}`} download>{tx("descargar")}<span className="arena-torneo-oculto">{es ? ` del partido ${x.n}` : ` of match ${x.n}`}</span></a></span>}
          </li>;
        })}</ol></div>)}
    </section>

    <section className="arena-torneo-panel" aria-labelledby="arena-torneo-h-metricas">
      <h2 id="arena-torneo-h-metricas">{tx("metricas")}</h2>
      <div className="arena-torneo-scroll" tabIndex={0} role="region" aria-label={es ? "Métricas por modelo" : "Metrics by model"}>
        <table className="arena-torneo-metricas" data-testid="arena-torneo-metricas">
          <caption>{es ? "En el orden de la clasificación. Media por partido salvo indicación." : "In standings order. Per-match average unless stated."}</caption>
          <thead><tr>
            <th scope="col">{es ? "Modelo" : "Model"}</th><th scope="col">{es ? "Decisiones válidas" : "Valid decisions"} †</th><th scope="col">{es ? "Respaldos programados" : "Programmed fallbacks"} †</th>
            <th scope="col">{es ? "Solicitudes" : "Requests"} †</th><th scope="col">{es ? "Latencia mediana" : "Median latency"} †</th><th scope="col">{es ? "Tokens (entrada / salida / caché)" : "Tokens (in / out / cached)"} †</th>
            <th scope="col">{es ? "Coste" : "Cost"} †</th><th scope="col">{etiqueta("posesion_pct")}</th><th scope="col">{etiqueta("remates")}</th><th scope="col">{etiqueta("remates_directos")}</th>
            <th scope="col">{etiqueta("precision_pase")}</th><th scope="col">{etiqueta("recuperaciones")}</th>
          </tr></thead>
          <tbody>{metricas.map(m => <tr key={m.id} data-testid="arena-torneo-metrica" data-participante={m.id}>
            <th scope="row"><Modelo p={p(m.id)} /></th>
            <td className="tnum"><Valor m={m.validas} idioma={idioma} /> / {m.decisiones.valor ?? "—"}</td>
            <td className="tnum"><Valor m={{ valor: (m.respaldos.orden_invalida.valor ?? 0) + (m.respaldos.error_controlador.valor ?? 0) + (m.respaldos.plazo_agotado.valor ?? 0), fuente: "declarada" }} idioma={idioma} /></td>
            <td className="tnum"><Valor m={m.solicitudes} idioma={idioma} /></td>
            <td className="tnum"><Valor m={m.latenciaMedianaS} idioma={idioma} decimales={1} sufijo=" s" />{m.decisionesConReintentoHttp.valor ? <span className="arena-muted"> ({es ? `sin ${m.decisionesConReintentoHttp.valor} con reintento HTTP` : `excl. ${m.decisionesConReintentoHttp.valor} with HTTP retry`})</span> : null}</td>
            <td className="tnum">{m.tokensEntrada.valor === null ? "—" : `${numero(m.tokensEntrada.valor, idioma)} / ${numero(m.tokensSalida.valor ?? 0, idioma)} / ${numero(m.tokensCache.valor ?? 0, idioma)}`} †</td>
            <td className="tnum">{m.costoMicroUsd.valor === null ? "—" : usd(m.costoMicroUsd.valor, idioma)} †</td>
            <td className="tnum"><Valor m={m.posesionMediaPct} idioma={idioma} decimales={1} sufijo=" %" /></td>
            <td className="tnum"><Valor m={m.rematesPorPartido} idioma={idioma} decimales={1} /></td>
            <td className="tnum"><Valor m={m.rematesDirectosPorPartido} idioma={idioma} decimales={1} /></td>
            <td className="tnum"><Valor m={m.precisionPasePct} idioma={idioma} decimales={1} sufijo=" %" /></td>
            <td className="tnum"><Valor m={m.recuperacionesPorPartido} idioma={idioma} decimales={1} /></td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="arena-muted">{tx("declarado")}. {es ? "Goles, clubes, configuración, semilla y cifras de juego los recalcula el motor desde cada registro." : "Goals, clubs, configuration, seed and play figures are recomputed by the engine from each record."}</p>
    </section>

    <section className="arena-torneo-panel" aria-labelledby="arena-torneo-h-procedencia">
      <h2 id="arena-torneo-h-procedencia">{tx("procedencia")}</h2>
      <dl className="arena-torneo-procedencia">
        {t.participantes.map(x => <div key={x.id}><dt>{x.nombre}</dt><dd>{x.llm === "ensayo" ? (es ? "política programada (sin IA)" : "programmed policy (no AI)") : `${x.deployment} · ${x.modelo} ${x.version} · ${es ? "esfuerzo" : "effort"} ${x.esfuerzo ?? "—"}`}{devueltos(x.id).length ? ` · ${es ? "modelo devuelto" : "returned model"}: ${devueltos(x.id).join(", ")} †` : ""}{x.precio.estimadoDe ? ` · † ${es ? `precio estimado con el de ${x.precio.estimadoDe} al jugar el torneo (sin precio de lista entonces); su coste declarado usa esa estimación` : `price estimated from ${x.precio.estimadoDe} when the tournament was played (no list price then); its declared cost uses that estimate`}` : ""}</dd></div>)}
        <div><dt>{es ? "Motor y reglas" : "Engine and rules"}</dt><dd>{t.motor.version} · {t.motor.reglas} · {t.duracionS} s · {es ? "intervalo" : "interval"} {t.intervaloS} s · {es ? "semilla" : "seed"} {t.semilla}</dd></div>
        <div><dt>Commit</dt><dd><a href={`${REPO}/commit/${t.commit}`}>{t.commit.slice(0, 12)}</a></dd></div>
        <div><dt>{es ? "Precios" : "Prices"}</dt><dd>{t.participantes[0]!.precio.fuente} · {t.participantes[0]!.precio.consultadoUtc.slice(0, 10)}{estimados.length ? ` · † ${estimados.map(x => x.nombre).join(", ")}` : ""}</dd></div>
        <div><dt>{es ? "Gasto (tope por estimación)" : "Spending (estimated cap)"}</dt><dd className="tnum">{es ? "conocido" : "known"} {usd(t.gasto.conocidoMicroUsd, idioma)} † · {es ? "típico estimado" : "typical estimate"} {usd(t.gasto.tipicoMicroUsd, idioma)} · {es ? "tope" : "cap"} {usd(t.gasto.topeMicroUsd, idioma)} · {es ? "reserva del partido más caro" : "largest match reserve"} {usd(t.gasto.reservaMaxPartidoMicroUsd, idioma)}</dd></div>
      </dl>
      <p className="arena-muted">{es ? "Precio de lista por los tokens que informa la API, no la factura; el control real del gasto es la facturación de Azure." : "List price for the tokens the API reports, not the invoice; actual spending is controlled by Azure billing."}</p>
    </section>

    <section className="arena-torneo-panel" aria-labelledby="arena-torneo-h-limites">
      <h2 id="arena-torneo-h-limites">{tx("limites")}</h2>
      <ul>{(es ? [
        `Pocos partidos: ${t.encuentros.length} partidos de ${t.duracionS} s y ${t.participantes.length - 1} cruces por modelo; la tabla describe este torneo.`,
        "La semilla fija clubes, niveles, condiciones y grada, no la suerte de cada jugada: con órdenes distintas, el azar del motor diverge.",
        "Motor 2D sintético con parámetros por calibrar y reglas simplificadas; no es un partido reglamentario y los goles no son la única medida de calidad.",
        "La reproducción prueba que las órdenes archivadas producen el registro, no quién las escribió: la identidad del modelo, los tokens y el coste los declara el CLI.",
        "Mismo prompt y esfuerzo «low» para todos; las latencias dependen de la carga de deployments compartidos con la arena pública.",
      ] : [
        `Few matches: ${t.encuentros.length} matches of ${t.duracionS} s and ${t.participantes.length - 1} pairings per model; the table describes this tournament.`,
        "The seed fixes clubs, levels, conditions and crowd, not the luck of each play: with different orders, the engine's randomness diverges.",
        "Synthetic 2D engine with uncalibrated parameters and simplified rules; not a regulation match, and goals are not the only measure of quality.",
        "Replay proves that the archived orders produce the record, not who wrote them: model identity, tokens and cost are declared by the CLI.",
        "Same prompt and “low” effort for everyone; latencies depend on the load of deployments shared with the public arena.",
      ]).map(x => <li key={x}>{x}</li>)}</ul>
    </section>
  </>;
}
