"use client";
// Brief 062 § 7.4 (P1-b) · Formato Grupos + eliminatoria: dos tablas de grupo con la columna «Pasa» EN TEXTO y la
// línea del criterio que decidió el corte (D6), dos matrices 3 × 3, el cuadro (semifinales y final, con el desempate de
// lados invertidos y el criterio del torneo rotulado como «no reglamentario») y los partidos por fase. Todo se recalcula
// con las funciones puras de `torneo-formatos.ts` desde la instantánea; ningún color lleva información por sí solo.
import { archivoEncuentro, type EncuentroTorneo062, type ParticipanteTorneo, type Torneo062 } from "../arena/torneo";
import {
  campeon, clasificarGrupo, cuadro, grupoCompleto, ordenGrupo, ordenGrupoDetalle, planTorneo, textoSignificacionFormato,
  type EncuentroPlan062, type Grupo, type Llave,
} from "../arena/torneo-formatos";
import { TEXTOS_TORNEO_SITIO as T } from "./textos-torneo-sitio";

type Idioma = "es" | "en";
const GRUPOS: Grupo[] = ["A", "B"];

function Modelo({ p }: { p: ParticipanteTorneo }) {
  return <span className="arena-torneo-modelo" title={p.nombre}><span className="arena-torneo-largo">{p.nombre}</span><span className="arena-torneo-corto" aria-hidden="true">{p.corto}</span></span>;
}
const firmar = (x: number) => (x > 0 ? `+${x}` : String(x));

/** § 7.4 + D6 · Las líneas de los dos cortes de un grupo completo (1.º|2.º y 2.º|3.º, el que decide quién pasa): el
 * criterio que separó a ESOS dos puestos y la cifra de cada uno en esa comparación (revisión Codex 062b #1). */
export function lineasCriterioGrupo(t: Torneo062, G: Grupo, idioma: Idioma): string[] {
  const { orden, cortes } = ordenGrupoDetalle(t, G), nombre = (id: string) => t.participantes.find(p => p.id === id)!.nombre;
  return cortes.slice(0, 2).flatMap((c, i) => {
    if (c.criterio === "resultado") return [];
    const detalle = c.arriba !== null && c.abajo !== null ? ` (${c.arriba} ${idioma === "es" ? "a" : "to"} ${c.abajo})` : "";
    return [`${nombre(orden[i]!.id)}: ${T.pasaComo[idioma](i + 1, T.criterios[c.criterio][idioma], detalle)} · ${T.criterio[idioma]}`];
  });
}

/** § 7.4 · Texto del criterio que hizo pasar a alguien (grupo o llave); null si decidió el resultado. */
export function textoCriterioLlave(l: Llave, nombre: (id: string) => string, idioma: Idioma): string | null {
  if (!l.ganador || !l.criterio || l.criterio === "resultado" || l.criterio === "desempate") return null;
  const d = l.detalle, ganaLocal = l.ganador === l.local;
  let cifra = "";
  if (d && (d.criterio === "remates_directos" || d.criterio === "remates")) cifra = ` (${(ganaLocal ? d.a : d.b)[0]}–${(ganaLocal ? d.b : d.a)[0]})`;
  if (d && d.criterio === "coeficiente") { const [g, p] = ganaLocal ? [d.a, d.b] : [d.b, d.a]; cifra = ` (${idioma === "es" ? "pts, DG, GF" : "pts, GD, GF"}: ${g[0]}, ${firmar(g[1]!)}, ${g[2]} – ${p[0]}, ${firmar(p[1]!)}, ${p[2]})`; }
  return `${T.pasaLlave[idioma](nombre(l.ganador), T.criterios[l.criterio][idioma], cifra)} · ${T.criterio[idioma]}`;
}

export function ArenaTorneoGrupos({ t, idioma, enlace, descarga, enCursoN }: { t: Torneo062; idioma: Idioma; enlace: (n: number) => string; descarga: (archivo: string) => string; enCursoN: number | null }) {
  const es = idioma === "es";
  const part = new Map(t.participantes.map(p => [p.id, p])), p = (id: string) => part.get(id)!;
  const plan = planTorneo("grupos", t.participantes.map(x => x.id), t.semilla, t), porN = new Map(t.encuentros.map(e => [e.n, e]));
  const llaves = cuadro(t), ganador = campeon(t);
  const pendienteTexto = (n: number) => (enCursoN === n ? <strong>{T.enJuego[idioma]}</strong> : <>{T.porJugar[idioma]}</>);
  const lineaPartido = (x: EncuentroPlan062, e: EncuentroTorneo062 | undefined) => e
    ? <><span className="arena-torneo-linea">P{x.n} · {e.local.club} <span className="arena-torneo-paren" data-testid="arena-torneo-paren">(<Modelo p={p(x.local)} />)</span> <strong className="tnum">{e.local.goles}–{e.visita.goles}</strong> {e.visita.club} <span className="arena-torneo-paren" data-testid="arena-torneo-paren">(<Modelo p={p(x.visita)} />)</span></span>
      <span className="arena-torneo-acciones"><a href={enlace(x.n)}>{es ? "Ver repetición" : "Watch replay"}<span className="arena-torneo-oculto">{es ? ` del partido ${x.n}` : ` of match ${x.n}`}</span></a>
        <a href={descarga(archivoEncuentro(x.n))} download>{es ? "Descargar registro" : "Download record"}<span className="arena-torneo-oculto">{es ? ` del partido ${x.n}` : ` of match ${x.n}`}</span></a></span></>
    : <span className="arena-torneo-linea">P{x.n} · {p(x.local).corto} – {p(x.visita).corto} · {pendienteTexto(x.n)}</span>;

  const tablaGrupo = (G: Grupo) => {
    const filas = clasificarGrupo(t, G), orden = ordenGrupo(t, G), completo = grupoCompleto(t, G), fila = (id: string) => filas.find(f => f.id === id)!;
    const lineas = completo ? lineasCriterioGrupo(t, G, idioma) : [];
    return <div key={G} className="arena-torneo-grupo" data-testid={`arena-torneo-grupo-${G}`}>
      <h3 id={`arena-torneo-h-grupo-${G}`}>{T.grupo[idioma](G)}</h3>
      <table className="arena-torneo-tabla arena-torneo-tabla-grupo" data-testid={`arena-torneo-tabla-${G}`} aria-labelledby={`arena-torneo-h-grupo-${G}`}>
        <thead><tr>
          <th scope="col"><abbr title={es ? "Posición" : "Position"}>Pos</abbr></th><th scope="col">{es ? "Modelo" : "Model"}</th>
          <th scope="col"><abbr title={es ? "Partidos jugados" : "Played"}>{es ? "PJ" : "P"}</abbr></th>
          <th scope="col"><abbr title={es ? "Diferencia de goles" : "Goal difference"}>{es ? "DG" : "GD"}</abbr></th>
          <th scope="col"><abbr title={es ? "Puntos" : "Points"}>Pts</abbr></th><th scope="col">{T.pasa[idioma]}</th>
        </tr></thead>
        <tbody>{orden.map((x, i) => { const f = fila(x.id); return <tr key={x.id} data-testid="arena-torneo-fila-grupo" data-participante={x.id}>
          <td className="tnum">{f.empatada ? <><span aria-hidden="true">{f.pos}=</span><span className="arena-torneo-oculto">{es ? `empatado en el ${f.pos}.º puesto` : `tied for position ${f.pos}`}</span></> : f.pos}</td>
          <th scope="row"><Modelo p={p(x.id)} /></th><td className="tnum">{f.pj}</td><td className="tnum">{firmar(f.dg)}</td><td className="tnum"><strong>{f.pts}</strong></td>
          <td data-testid="arena-torneo-pasa">{!completo ? T.porDecidir[idioma] : i < 2 ? T.pasaSi[idioma](i + 1) : T.pasaNo[idioma]}</td>
        </tr>; })}</tbody>
      </table>
      {lineas.map(l => <p key={l} className="arena-muted" data-testid="arena-torneo-criterio-grupo">{l}</p>)}
      <table className="arena-torneo-matriz" data-testid={`arena-torneo-matriz-${G}`}>
        <caption>{es ? `${T.grupo.es(G)}: local en filas, visita en columnas` : `${T.grupo.en(G)}: home in rows, away in columns`}</caption>
        <thead><tr><td />{orden.map(x => <th scope="col" key={x.id}><abbr title={p(x.id).nombre}>{p(x.id).corto}</abbr></th>)}</tr></thead>
        <tbody>{orden.map(l => <tr key={l.id}><th scope="row"><abbr title={p(l.id).nombre}>{p(l.id).corto}</abbr></th>{orden.map(v => {
          if (l.id === v.id) return <td key={v.id}><span aria-hidden="true">—</span><span className="arena-torneo-oculto">{es ? "no aplica" : "not applicable"}</span></td>;
          const x = plan.find(q => q.fase === `grupo-${G}` && q.local === l.id && q.visita === v.id)!, e = porN.get(x.n);
          return <td key={v.id}>{e ? <a href={enlace(x.n)} data-testid="arena-torneo-celda"><span aria-hidden="true">{e.local.goles}–{e.visita.goles}</span><span className="arena-torneo-oculto">{`${p(l.id).nombre} ${e.local.goles}, ${p(v.id).nombre} ${e.visita.goles}. ${es ? `Ver la repetición del partido ${x.n}` : `Watch the replay of match ${x.n}`}`}</span></a>
            : <><span aria-hidden="true">s/d</span><span className="arena-torneo-oculto">{es ? "sin disputar" : "not played"}</span></>}</td>;
        })}</tr>)}</tbody>
      </table>
    </div>;
  };

  const tarjeta = (fase: Llave["fase"], provisional: string) => {
    const l = llaves.find(x => x.fase === fase), titulo = fase === "final" ? T.fases.final[idioma] : T.fases[fase][idioma];
    if (!l) return <li key={fase} className="arena-torneo-llave" data-testid={`arena-torneo-llave-${fase}`}><h4>{titulo}</h4><p>{provisional} · {T.porJugar[idioma]}</p></li>;
    const [m1, m2] = l.partidos, e1 = porN.get(m1!), e2 = m2 ? porN.get(m2) : undefined;
    const x1 = plan.find(q => q.n === m1)!, x2 = m2 ? plan.find(q => q.n === m2) : undefined;
    const criterio = textoCriterioLlave(l, id => p(id).nombre, idioma);
    return <li key={fase} className="arena-torneo-llave" data-testid={`arena-torneo-llave-${fase}`}>
      <h4>{titulo}</h4>
      <p>{lineaPartido(x1, e1)}</p>
      {x2 && <p data-testid="arena-torneo-desempate">{T.desempate[idioma]}: {lineaPartido(x2, e2)}</p>}
      {criterio && <p className="arena-muted" data-testid="arena-torneo-criterio-llave">{criterio}</p>}
      {l.ganador && !criterio && <p className="arena-muted">{es ? `Pasa ${p(l.ganador).nombre}` : `${p(l.ganador).nombre} advances`}{l.criterio === "desempate" ? ` (${T.criterios.desempate[idioma]})` : ""}</p>}
    </li>;
  };
  const fases: EncuentroPlan062["fase"][] = ["grupo-A", "grupo-B", "semifinal-1", "semifinal-2", "final"];
  return <>
    <section className="arena-torneo-panel" aria-labelledby="arena-torneo-h-grupos" data-testid="arena-torneo-grupos">
      <h2 id="arena-torneo-h-grupos">{es ? "Fase de grupos" : "Group stage"}</h2>
      <p className="arena-muted">{es ? "Puntos 3/1/0, DG, GF y la liguilla entre empatados; si el empate cruza el corte: remates directos, remates y sorteo por semilla (criterios del torneo, no reglamentarios)." : "Points 3/1/0, GD, GF and a mini-league among the tied; if a tie crosses the cut: shots on target, shots and a seeded draw (tournament criteria, not football rules)."}</p>
      {GRUPOS.map(tablaGrupo)}
    </section>
    <section className="arena-torneo-panel" aria-labelledby="arena-torneo-h-cuadro" data-testid="arena-torneo-cuadro">
      <h2 id="arena-torneo-h-cuadro">{T.eliminatoria[idioma]}</h2>
      <h3>{T.semifinales[idioma]}</h3>
      <ol className="arena-torneo-cuadro" data-testid="arena-torneo-llaves">
        {tarjeta("semifinal-1", es ? "1.º A – 2.º B" : "1st A – 2nd B")}
        {tarjeta("semifinal-2", es ? "1.º B – 2.º A" : "1st B – 2nd A")}
        {tarjeta("final", es ? "Ganador de la semifinal 1 – ganador de la semifinal 2" : "Semi-final 1 winner – semi-final 2 winner")}
      </ol>
      {ganador && <p className="arena-torneo-aviso" data-testid="arena-torneo-campeon"><strong>{T.gana[idioma](p(ganador).nombre)}</strong> {textoSignificacionFormato(t, idioma)}</p>}
    </section>
    <section className="arena-torneo-panel" aria-labelledby="arena-torneo-h-partidos">
      <h2 id="arena-torneo-h-partidos">{T.partidosFase[idioma]}</h2>
      {fases.filter(f => plan.some(x => x.fase === f)).map(f => <div key={f} className="arena-torneo-jornada"><h3>{T.fases[f][idioma]}</h3>
        <ol>{plan.filter(x => x.fase === f).map(x => <li key={x.n} data-testid="arena-torneo-partido" data-n={x.n}>{x.desempate && <span className="arena-muted">{T.desempate[idioma]}: </span>}{lineaPartido(x, porN.get(x.n))}</li>)}</ol>
      </div>)}
    </section>
  </>;
}
