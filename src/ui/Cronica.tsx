"use client";
// La crónica (brief 004): título + oraciones, toggle ES/EN, barra de verificación y el
// estado de cada frase (✓ verificada · ↻ corregida · acta). El modo acta tiene su propio
// estado visual honesto: no se disfraza de crónica.
//
// Preparado para el 007: recibe un `modo` de render. Hoy solo existe "aficionado"; el
// modo «analista» (datos duros expuestos) llega con ese brief.

import type { KeyboardEvent } from "react";
import type { CronicaVerificada } from "../cadena/tipos";
import { estadoOracion, type EstadoOracion, resumenVerificacion } from "../vista/evidencia";
import { IconoActa, IconoCorregida, IconoHistoria, IconoVerificada } from "./Iconos";

export type ModoRender = "aficionado";
export type Lengua = "es" | "en";

interface Props {
  cronica: CronicaVerificada;
  modo: ModoRender;
  lengua: Lengua;
  onLengua: (l: Lengua) => void;
  resaltadas: Set<number>;
  seleccionada: number | null;
  onOracion: (i: number) => void;
  onHover: (i: number | null) => void;
  onHistoria: (i: number) => void;
  onProceso: () => void;
}

const ETIQUETA_ESTADO: Record<EstadoOracion, string> = {
  verificada: "Verified on the first pass",
  corregida: "Corrected — a draft was rejected; open its history",
  acta: "Analyst record (no language-model prose)",
};

function IconoEstado({ estado }: { estado: EstadoOracion }) {
  if (estado === "corregida") return <IconoCorregida />;
  if (estado === "acta") return <IconoActa />;
  return <IconoVerificada />;
}

export function Cronica(props: Props) {
  const { cronica, lengua, onLengua, resaltadas, seleccionada, onOracion, onHover, onHistoria, onProceso } = props;
  const r = resumenVerificacion(cronica);
  const titulo = lengua === "es" ? cronica.titulo_es : cronica.titulo_en;

  const teclado = (i: number) => (ev: KeyboardEvent) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      onOracion(i);
    }
  };

  return (
    <div>
      <div className="panel-head">
        <span className="overline">Match report</span>
        <div className="lang-toggle" role="group" aria-label="Report language" data-testid="lang-toggle">
          {(["es", "en"] as const).map((l) => (
            <button key={l} type="button" aria-pressed={lengua === l} data-lang={l} onClick={() => onLengua(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="chronicle">
        {r.modo === "llm" ? (
          <div className="verify-bar" data-testid="verify-bar" data-mode="llm">
            <span className="verify-main tnum">
              <IconoVerificada />
              {r.oraciones}/{r.oraciones} sentences verified
            </span>
            <span className="verify-item tnum">
              <strong>{r.intentos}</strong> {r.intentos === 1 ? "attempt" : "attempts"}
            </span>
            <span className="verify-item tnum">
              <strong>{r.corregidas}</strong> corrected
            </span>
            <span className="verify-item tnum">
              <strong>{r.omitidas}</strong> omitted
            </span>
            <button type="button" className="btn" onClick={onProceso} data-testid="open-process">
              <IconoHistoria /> View process
            </button>
          </div>
        ) : (
          <div className="acta-banner" data-testid="verify-bar" data-mode="acta">
            <strong>Analyst record — not a written report</strong>
            {r.intentos === 0
              ? "Shown as requested: every sentence is the analyst's fixed template for one fact. Dry, and 100% faithful."
              : `The writer did not pass verification in ${r.intentos} attempts, so nothing it wrote is shown. This is the analyst's template record: dry, and 100% faithful.`}
            {cronica.audit.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <button type="button" className="btn" onClick={onProceso} data-testid="open-process">
                  <IconoHistoria /> See the rejected attempts
                </button>
              </div>
            )}
          </div>
        )}

        <h1 className="chronicle-title" lang={lengua} data-testid="chronicle-title">
          {titulo}
        </h1>

        <div className="sentences">
          {cronica.oraciones.map((o, i) => {
            const estado = estadoOracion(cronica, i);
            const texto = lengua === "es" ? o.texto_es : o.texto_en;
            return (
              <div
                key={`${o.hecho}-${i}`}
                className="sentence"
                role="button"
                tabIndex={0}
                data-testid="sentence"
                data-index={i}
                data-state={estado}
                data-highlighted={resaltadas.has(i) ? "true" : "false"}
                data-selected={seleccionada === i ? "true" : "false"}
                aria-pressed={seleccionada === i}
                onClick={() => onOracion(i)}
                onKeyDown={teclado(i)}
                onMouseEnter={() => onHover(i)}
                onMouseLeave={() => onHover(null)}
              >
                <button
                  type="button"
                  className="sentence-state"
                  aria-label={ETIQUETA_ESTADO[estado]}
                  title={ETIQUETA_ESTADO[estado]}
                  data-testid="sentence-state"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onHistoria(i);
                  }}
                >
                  <IconoEstado estado={estado} />
                </button>
                <div>
                  <div className="sentence-text" lang={lengua} data-testid="sentence-text">
                    {texto}
                  </div>
                  <div className="sentence-tools">
                    <button
                      type="button"
                      className="btn btn-quiet"
                      data-testid="how-written"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onHistoria(i);
                      }}
                    >
                      <IconoHistoria /> How it was written
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="legend">
          {cronica.modo === "llm" ? (
            <>
              <span>
                <IconoVerificada size={14} /> verified
              </span>
              <span>
                <IconoCorregida size={14} /> corrected after a rejection
              </span>
            </>
          ) : (
            <span>
              <IconoActa size={14} /> analyst template
            </span>
          )}
          <span>Click a sentence to light up its evidence.</span>
        </div>
      </div>
    </div>
  );
}
