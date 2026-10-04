"use client";
// Brief 026 — la grada en la UI: el bloque «Crowd» del panel de stats y el cajón de evidencia de
// cada reacción (los pases del olé, resaltados en su jugada; o los eventos macro que la pagan).
// Rotulado honesto: la afición es ficción DERIVADA de los datos — solo reacciona a lo registrado.

import { useMemo } from "react";
import type { MicroPartido } from "../sim/micro";
import type { Partido } from "../sim/tipos";
import { fmtMinuto } from "../vista/evidencia";
import type { Reaccion, TipoReaccion } from "../vista/grada";
import { relato } from "../vista/stats";
import { IconoCerrar, IconoGrada } from "./Iconos";
import { describirEvento, type LenguaXg } from "./textos";

export const ETIQUETA_REACCION: Record<TipoReaccion, string> = {
  ole: "Olé",
  rugido: "Roar",
  grito_visitante: "Away section",
  silbidos_descanso: "Whistles",
  ovacion: "Ovation",
  aliento: "Backing",
};

export const ROTULO_GRADA = "Crowd · derived from match data";

export const textoReaccion = (r: Reaccion, lengua: LenguaXg) => (lengua === "es" ? r.texto_es : r.texto_en);

/** Bloque «Crowd» del panel de stats: las reacciones de lo visto, cada una abre su evidencia. */
export function BloqueGrada({ lista, lengua, onReaccion }: { lista: Reaccion[]; lengua: LenguaXg; onReaccion: (i: number) => void }) {
  return (
    <div className="stats-block" data-testid="stats-crowd">
      <div className="stats-title">Crowd · derived from match data</div>
      {lista.length === 0 && <p className="stats-vacio">The crowd has had nothing in the data to react to yet.</p>}
      {lista.map((r, i) => (
        <button key={`${r.tipo}-${r.disparo}-${i}`} type="button" className="stats-row stats-crowd" data-testid="stat-reaccion" data-tipo={r.tipo} data-minuto={r.minuto} onClick={() => onReaccion(i)}>
          <span className="stats-crowd-etiqueta overline">
            <span className="tnum">{fmtMinuto(r.minuto)}</span> · {ETIQUETA_REACCION[r.tipo]}
          </span>
          <span className="stats-crowd-texto">{textoReaccion(r, lengua)}</span>
        </button>
      ))}
    </div>
  );
}

/** El cajón de evidencia de una reacción: la jugada con lo citado resaltado. */
export function EvidenciaGrada({
  reaccion,
  partido,
  m,
  lengua,
  fx,
  onCerrar,
}: {
  reaccion: Reaccion;
  partido: Partido;
  m: MicroPartido;
  lengua: LenguaXg;
  fx: (xg: number) => string;
  onCerrar: () => void;
}) {
  const lineas = useMemo(() => (reaccion.micro.length > 0 ? relato(partido, m, reaccion.micro, 2, fx) : []), [reaccion, partido, m, fx]);
  const citados = useMemo(() => {
    const ids = new Set(reaccion.eventos);
    return partido.eventos.filter((e) => ids.has(e.id));
  }, [reaccion, partido]);
  return (
    <>
      <div className="scrim" onClick={onCerrar} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="grada-titulo" data-testid="crowd-evidence" data-tipo={reaccion.tipo}>
        <div className="layer-head">
          <div>
            <div className="overline">
              <IconoGrada size={13} /> {ROTULO_GRADA} · {fmtMinuto(reaccion.minuto)}
            </div>
            <h2 className="layer-title" id="grada-titulo">
              {textoReaccion(reaccion, lengua)}
            </h2>
          </div>
          <button type="button" className="btn btn-quiet" onClick={onCerrar} aria-label="Close">
            <IconoCerrar />
          </button>
        </div>
        <div className="layer-body">
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
          {citados.length > 0 && (
            <ol className="pbp">
              {citados.map((e) => (
                <li key={e.id} className="pbp-line citado" data-testid="crowd-event" data-citado="true" data-id={e.id}>
                  <span className="pbp-min tnum">{fmtMinuto(e.minuto)}</span>
                  <span>{describirEvento(e, "aficionado", lengua)}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="caption">
            {reaccion.micro.length > 0
              ? `The highlighted lines are the ${reaccion.micro.length} completed passes the crowd reacted to; the others show the play around them.`
              : "The highlighted events are the ones the crowd reacted to."}{" "}
            The crowd, its section name and its chant are fiction derived from the match data: it only reacts to what the events record.
          </p>
        </div>
      </aside>
    </>
  );
}
