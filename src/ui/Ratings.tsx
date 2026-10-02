"use client";
// Panel de Ratings (brief 009): nota 1–10 por jugador, computada desde los eventos (no una
// opinión de la IA). Clic en una nota ⇒ su desglose (cada delta con su evento) y esos
// eventos resaltados en la línea de tiempo. En modo Analista los desgloses van abiertos.
// En el replay (008) las notas son las del prefijo visto: función pura de los eventos.

import type { KeyboardEvent } from "react";
import type { Valoracion } from "../analista/valoracion";
import { VALORACION } from "../analista/umbrales";
import type { Evento, Lado } from "../sim/tipos";
import { fmtMinuto } from "../vista/evidencia";
import { IconoEvento } from "./Iconos";
import { describirEvento, type LenguaXg, type ModoXg, motivoValoracion, POSICION_EN } from "./textos";

export const claveValoracion = (v: Pick<Valoracion, "lado" | "jugador">) => `${v.lado}|${v.jugador}`;

interface Props {
  valoraciones: Valoracion[];
  eventos: Evento[];
  nombres: Record<Lado, string>;
  /** Clave de la figura (undefined: sin figura, o replay en curso). */
  figura?: string;
  seleccionada: string | null;
  onSeleccion: (clave: string) => void;
  expandido: boolean;
  enVivo: boolean;
  /** Brief 017: idioma del formateador de xG (el modo sale de `expandido`: Analista). */
  lengua: LenguaXg;
}

const fmtDelta = (d: number) => `${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(2)}`;

function Desglose({ v, eventos, modo, lengua }: { v: Valoracion; eventos: Evento[]; modo: ModoXg; lengua: LenguaXg }) {
  // Brief 017: el desglose se abre en ambos modos (selección o Analista); el xG pasa por el formateador.
  const porId = new Map(eventos.map((e) => [e.id, e] as const));
  return (
    <div className="rating-breakdown" data-testid="rating-breakdown">
      <div className="rating-base tnum">Base {VALORACION.base.toFixed(1)}</div>
      {v.desglose.length === 0 && <div className="rating-base">No rated actions — the base stands.</div>}
      <ol>
        {v.desglose.map((d, i) => {
          const e = porId.get(d.evento);
          return (
            <li key={`${d.evento}-${d.motivo}-${i}`} className="tnum" data-testid="breakdown-event" data-event-id={d.evento}>
              <span className={`rating-delta${d.delta < 0 ? " neg" : ""}`}>{fmtDelta(d.delta)}</span>
              <span>{motivoValoracion(d.motivo, modo)}</span>
              {e && (
                <span className="rating-ev">
                  {fmtMinuto(e.minuto)} <IconoEvento tipo={e.tipo} size={13} /> {describirEvento(e, modo, lengua)}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div className="rating-base tnum">
        = {v.nota.toFixed(1)} (scale {VALORACION.min.toFixed(1)}–{VALORACION.max.toFixed(1)})
      </div>
    </div>
  );
}

export function Ratings({ valoraciones, eventos, nombres, figura, seleccionada, onSeleccion, expandido, enVivo, lengua }: Props) {
  const teclado = (k: string) => (ev: KeyboardEvent) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      onSeleccion(k);
    }
  };
  return (
    <section className="ratings" aria-label="Player ratings" data-testid="ratings-panel">
      <div className="panel-head">
        <span className="overline">Ratings · computed from match events{enVivo ? " · so far" : ""}</span>
        <span className="ratings-note">Base {VALORACION.base.toFixed(1)} plus or minus each action. Click a rating to see why.</span>
      </div>
      <div className="ratings-cols">
        {(["local", "visita"] as const).map((lado) => (
          <div key={lado} className="ratings-col">
            <div className="ratings-team">{nombres[lado]}</div>
            <ol className="ratings-list">
              {valoraciones
                .filter((v) => v.lado === lado)
                .sort((a, b) => b.nota - a.nota)
                .map((v) => {
                  const k = claveValoracion(v);
                  const sel = seleccionada === k;
                  const esFigura = figura === k;
                  return (
                    <li key={k}>
                      <div
                        className="rating-row"
                        role="button"
                        tabIndex={0}
                        aria-pressed={sel}
                        aria-expanded={sel || expandido}
                        data-testid="rating"
                        data-jugador={v.jugador}
                        data-lado={v.lado}
                        data-nota={v.nota.toFixed(1)}
                        data-selected={sel ? "true" : "false"}
                        data-figura={esFigura ? "true" : "false"}
                        onClick={() => onSeleccion(k)}
                        onKeyDown={teclado(k)}
                      >
                        <span className={`rating-nota tnum${esFigura ? " figura" : ""}`}>{v.nota.toFixed(1)}</span>
                        <span className="rating-name">
                          {v.jugador}
                          {esFigura && <span className="rating-potm"> · Player of the match</span>}
                        </span>
                        <span className="rating-pos">{POSICION_EN[v.posicion] ?? v.posicion}</span>
                      </div>
                      {(sel || expandido) && <Desglose v={v} eventos={eventos} modo={expandido ? "analista" : "aficionado"} lengua={lengua} />}
                    </li>
                  );
                })}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
