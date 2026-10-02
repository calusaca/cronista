"use client";
// Panel «Match stats» (brief 014 §1): la cara visible de la capa micro del 013. Posesión,
// ataques por canal, duelos y pérdidas en salida — todo calculado de los micro-eventos de lo
// visto (en el replay, el prefijo: «so far»), con los mismos umbrales que los hechos del
// Analista para destacar. Cada cifra abre su evidencia: el relato jugada a jugada de los
// micro-eventos exactos (acotados) o el desglose recomputable (agregados).

import { useEffect, useMemo, useState } from "react";
import { CANALES, type Canal } from "../sim/limites";
import { micro } from "../sim/micro";
import type { Lado, Partido } from "../sim/tipos";
import { CANAL_TXT, estadisticas, relato } from "../vista/stats";
import { efectosMedidos } from "../vista/condiciones";
import { IconoCerrar } from "./Iconos";
import { EXPLICA_XG, formatoXg, type LenguaXg } from "./textos";

type Evidencia =
  | { tipo: "posesion" }
  | { tipo: "canal"; lado: Lado }
  | { tipo: "duelo"; i: number }
  | { tipo: "perdidas"; lado: Lado; canal: Canal }
  | { tipo: "efecto"; i: number }
  | null;

const LADOS: readonly Lado[] = ["local", "visita"];
const fmtN = (n: number) => n.toLocaleString("en-US");

export function Stats({
  partido,
  nombres,
  enVivo,
  analista,
  lengua,
}: {
  partido: Partido;
  nombres: Record<Lado, string>;
  enVivo: boolean;
  analista: boolean;
  /** Brief 017: idioma del formateador de xG del relato. */
  lengua: LenguaXg;
}) {
  const fx = (xg: number) => formatoXg(xg, analista ? "analista" : "aficionado", lengua);
  const m = useMemo(() => micro(partido), [partido]);
  const s = useMemo(() => estadisticas(partido, m), [partido, m]);
  // Brief 018: las mediciones de los efectos de las condiciones (solo partidos de liga).
  const efectos = useMemo(() => (partido.config.condiciones ? efectosMedidos(partido, nombres, m) : undefined), [partido, nombres, m]);
  const [ev, setEv] = useState<Evidencia>(null);

  useEffect(() => {
    const cerrar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEv(null);
    };
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, []);

  return (
    <section className="stats" aria-label="Match stats" data-testid="stats-panel">
      <div className="panel-head">
        <span className="overline">
          Match stats · computed from {fmtN(s.total)} simulated match events{enVivo ? " · so far" : ""}
        </span>
        <span className="ratings-note">Click any figure to see the plays behind it.</span>
        {!analista && (
          <span className="ratings-note" data-testid="xg-explica">
            {EXPLICA_XG[lengua]}
          </span>
        )}
      </div>

      <div className="stats-grid">
        {/* Posesión */}
        <div className="stats-block">
          <div className="stats-title">Possession (by passes)</div>
          <button type="button" className="stats-row" data-testid="stat-posesion" data-destacado={s.posesion.destacado ?? ""} onClick={() => setEv({ tipo: "posesion" })}>
            {LADOS.map((l) => (
              <span key={l} className="stats-bar-line">
                <span className="stats-team">{nombres[l]}</span>
                <span className="stats-bar" aria-hidden="true">
                  <span className={`stats-fill ${l}`} style={{ width: `${s.posesion.porcentaje[l]}%` }} />
                </span>
                <span className={`stats-num tnum${s.posesion.destacado === l ? " destacado" : ""}`}>{s.posesion.porcentaje[l]}%</span>
              </span>
            ))}
          </button>
          {analista && (
            <div className="stats-periodos tnum" data-testid="stat-posesion-periodos">
              {s.posesion.porPeriodo.map((pp) => (
                <span key={pp.periodo}>
                  {pp.periodo === 1 ? "1st half" : "2nd half"}: {pp.porcentaje.local}% – {pp.porcentaje.visita}%
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Ataques por canal */}
        <div className="stats-block">
          <div className="stats-title">Attacks by channel</div>
          {LADOS.map((l) => (
            <button key={l} type="button" className="stats-row" data-testid={`stat-canal-${l}`} data-destacado={s.canales[l].destacado ?? ""} onClick={() => setEv({ tipo: "canal", lado: l })}>
              <span className="stats-team">{nombres[l]}</span>
              <span className="stats-canales tnum">
                {CANALES.map((c) => (
                  <span key={c} className={`stats-canal${s.canales[l].destacado === c ? " destacado" : ""}`} data-canal={c}>
                    <span className="stats-canal-label">{c === "banda_izquierda" ? "Left" : c === "centro" ? "Middle" : "Right"}</span>
                    <span className="stats-bar" aria-hidden="true">
                      <span className={`stats-fill ${l}`} style={{ width: `${s.canales[l].por[c].porcentaje}%` }} />
                    </span>
                    <span className="stats-num">{s.canales[l].por[c].porcentaje}%</span>
                  </span>
                ))}
              </span>
            </button>
          ))}
        </div>

        {/* Duelos */}
        <div className="stats-block">
          <div className="stats-title">Duels: successful dribbles on the same defender</div>
          {s.duelos.length === 0 && <p className="stats-vacio">No player has beaten the same defender twice yet.</p>}
          {s.duelos.map((d, i) => (
            <button key={`${d.jugador}-${d.rival}`} type="button" className="stats-row stats-duelo" data-testid="stat-duelo" data-destacado={d.destacado ? "true" : "false"} onClick={() => setEv({ tipo: "duelo", i })}>
              <span className={`stats-num tnum${d.destacado ? " destacado" : ""}`}>{d.n}×</span>
              <span>
                {d.jugador} <span className="stats-sobre">over</span> {d.rival}
              </span>
            </button>
          ))}
        </div>

        {/* Pérdidas en salida */}
        <div className="stats-block">
          <div className="stats-title">Ball losses playing out (own third)</div>
          {LADOS.map((l) => (
            <div key={l} className="stats-row stats-perdidas">
              <span className="stats-team">{nombres[l]}</span>
              <span className="stats-chips tnum">
                {CANALES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`stats-chip${s.perdidas[l][c].destacado ? " destacado" : ""}`}
                    data-testid="stat-perdida"
                    data-lado={l}
                    data-canal={c}
                    data-destacado={s.perdidas[l][c].destacado ? "true" : "false"}
                    disabled={s.perdidas[l][c].n === 0}
                    onClick={() => setEv({ tipo: "perdidas", lado: l, canal: c })}
                  >
                    {CANAL_TXT[c]} {s.perdidas[l][c].n}
                  </button>
                ))}
              </span>
            </div>
          ))}
        </div>

        {/* Brief 018: efectos de las condiciones, medidos en este partido (lo visto). */}
        {efectos && (
          <div className="stats-block" data-testid="stats-conditions">
            <div className="stats-title">Conditions: measured effects</div>
            {efectos.length === 0 && <p className="stats-vacio">None of these conditions has a per-match measurement.</p>}
            {efectos.map((x, i) => (
              <button key={x.tipo} type="button" className="stats-row stats-efecto" data-testid="stat-efecto" data-tipo={x.tipo} data-destacado={x.destacado ? "true" : "false"} onClick={() => setEv({ tipo: "efecto", i })}>
                <span className="stats-efecto-titulo">{x.titulo}</span>
                <span className={`stats-num tnum${x.destacado ? " destacado" : ""}`}>{x.valor}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {ev && <EvidenciaStats ev={ev} partido={partido} m={m} s={s} nombres={nombres} fx={fx} efectos={efectos ?? []} onCerrar={() => setEv(null)} />}
    </section>
  );
}

function EvidenciaStats({
  ev,
  partido,
  m,
  s,
  nombres,
  fx,
  efectos,
  onCerrar,
}: {
  ev: NonNullable<Evidencia>;
  efectos: ReturnType<typeof efectosMedidos>;
  partido: Partido;
  m: ReturnType<typeof micro>;
  s: ReturnType<typeof estadisticas>;
  nombres: Record<Lado, string>;
  fx: (xg: number) => string;
  onCerrar: () => void;
}) {
  let titulo = "";
  let ids: string[] = [];
  let desglose: { etiqueta: string; valor: string }[] = [];
  if (ev.tipo === "posesion") {
    titulo = "Possession, by passes attempted";
    desglose = [
      ...LADOS.map((l) => ({ etiqueta: `${nombres[l]} passes`, valor: fmtN(s.posesion.pases[l]) })),
      ...s.posesion.porPeriodo.flatMap((pp) => LADOS.map((l) => ({ etiqueta: `${pp.periodo === 1 ? "1st" : "2nd"} half · ${nombres[l]}`, valor: `${fmtN(pp.pases[l])} (${pp.porcentaje[l]}%)` }))),
    ];
  } else if (ev.tipo === "canal") {
    titulo = `${nombres[ev.lado]}: attacks by channel`;
    desglose = [
      ...CANALES.map((c) => ({ etiqueta: CANAL_TXT[c], valor: `${s.canales[ev.lado].por[c].n} (${s.canales[ev.lado].por[c].porcentaje}%)` })),
      { etiqueta: "Attacks (possessions reaching the final third)", valor: String(s.canales[ev.lado].avances) },
    ];
  } else if (ev.tipo === "duelo") {
    const d = s.duelos[ev.i];
    titulo = d ? `${d.jugador} beat ${d.rival} ${d.n} times` : "";
    ids = d?.ids ?? [];
  } else if (ev.tipo === "efecto") {
    const x = efectos[ev.i];
    titulo = x ? `${x.titulo}: ${x.valor}` : "";
    ids = x?.ids ?? [];
    desglose = x?.desglose ?? [];
  } else {
    const x = s.perdidas[ev.lado][ev.canal];
    titulo = `${nombres[ev.lado]} lost the ball ${x.n} times playing out down the ${CANAL_TXT[ev.canal]}`;
    ids = x.ids;
  }
  const lineas = ids.length > 0 ? relato(partido, m, ids, 2, fx) : [];
  return (
    <>
      <div className="scrim" onClick={onCerrar} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="stats-ev-titulo" data-testid="stats-evidence">
        <div className="layer-head">
          <div>
            <div className="overline">{ids.length > 0 ? "Play by play · the events behind the figure" : "Breakdown · recomputable from the events"}</div>
            <h2 className="layer-title" id="stats-ev-titulo">
              {titulo}
            </h2>
          </div>
          <button type="button" className="btn btn-quiet" onClick={onCerrar} aria-label="Close">
            <IconoCerrar />
          </button>
        </div>
        <div className="layer-body">
          {desglose.length > 0 && (
            <dl className="stats-desglose tnum" data-testid="stats-desglose">
              {desglose.map((d) => (
                <div key={d.etiqueta}>
                  <dt>{d.etiqueta}</dt>
                  <dd>{d.valor}</dd>
                </div>
              ))}
            </dl>
          )}
          {lineas.length > 0 && (
            <ol className="pbp">
              {lineas.map((l) => (
                <li key={l.id} className={`pbp-line${l.citado ? " citado" : ""}`} data-testid="pbp-line" data-citado={l.citado ? "true" : "false"} data-id={l.id}>
                  <span className="pbp-min tnum">{l.minuto}</span>
                  <span>{l.texto}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="caption">
            Simulated micro-events (passes, carries, dribbles, duels, losses) derived from the match data. Highlighted lines are the events counted; the others show the play that led to them.
          </p>
        </div>
      </aside>
    </>
  );
}
