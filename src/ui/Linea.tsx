"use client";
// Línea de tiempo (brief 004): minuto, icono por tipo, marcador progresivo, separadores de
// periodo. El resaltado es estado del DOM (data-highlighted) — así lo verifica el e2e.

import { type RefObject } from "react";
import type { Evento } from "../sim/tipos";
import { fmtMinuto, marcadorProgresivo, porPeriodo } from "../vista/evidencia";
import { IconoEvento } from "./Iconos";
import { CHIP_EVENTO, describirEvento, siglas } from "./textos";

const CLAVE = new Set<Evento["tipo"]>(["gol", "tarjeta_amarilla", "tarjeta_roja", "cambio"]);

interface Props {
  eventos: Evento[];
  local: string;
  visita: string;
  resaltados: Set<string>;
  hover: Set<string>;
  seleccionado: string | null;
  onEvento: (e: Evento) => void;
  contenedor: RefObject<HTMLDivElement | null>;
}

export function Linea({ eventos, local, visita, resaltados, hover, seleccionado, onEvento, contenedor }: Props) {
  const marcador = marcadorProgresivo(eventos);
  const periodos = porPeriodo(eventos);
  const finales = eventos.filter((e) => e.tipo === "fin_periodo");
  const nombre = { local: siglas(local), visita: siglas(visita) };

  return (
    <div className="timeline" ref={contenedor} data-testid="timeline">
      {periodos.map((p, k) => {
        const fin = finales[k];
        const m = fin ? marcador[fin.id] : undefined;
        return (
          <div key={p.n}>
            <div className="period-sep overline">{p.n === 1 ? "First half" : "Second half"}</div>
            {p.eventos.map((e) => {
              const esGol = e.tipo === "gol";
              const tras = marcador[e.id];
              return (
                <button
                  key={e.id}
                  type="button"
                  className={`ev${CLAVE.has(e.tipo) || e.penal ? " key" : ""}${esGol ? " goal" : ""}`}
                  data-testid="timeline-event"
                  data-event-id={e.id}
                  data-tipo={e.tipo}
                  data-minuto={e.minuto}
                  data-highlighted={resaltados.has(e.id) ? "true" : "false"}
                  data-hover={hover.has(e.id) ? "true" : "false"}
                  data-selected={seleccionado === e.id ? "true" : "false"}
                  onClick={() => onEvento(e)}
                  aria-pressed={seleccionado === e.id}
                  title={esGol ? "Show how the goal happened" : "Show the sentences that cite this event"}
                >
                  <span className="ev-min tnum">{fmtMinuto(e.minuto)}</span>
                  {/* Brief 010: el chip escaneable del tipo de evento (único cambio de markup). */}
                  <span className="chip">{CHIP_EVENTO[e.tipo]}</span>
                  <span className="ev-ico">
                    <IconoEvento tipo={e.tipo} />
                  </span>
                  <span className="ev-body">
                    <span className="ev-team">{nombre[e.equipo]}</span>
                    {describirEvento(e)}
                  </span>
                  <span className="ev-score tnum">{esGol && tras ? `${tras.local}–${tras.visita}` : ""}</span>
                </button>
              );
            })}
            {m && (
              <div className="period-sep overline tnum">
                {p.n === 1 ? "Half-time" : "Full time"} · {m.local}–{m.visita}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
