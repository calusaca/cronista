"use client";
// Modo replay (brief 008): controles (×1 · ×5 · pausa · Skip to full-time) y el ticker de
// actualizaciones verificadas. El ticker consume EXACTAMENTE el JSON de /api/overlay/[seed]
// (validado con el mismo esquema zod): lo que ve el lector es lo que recibe un overlay.
// Rotulado «Replay»: es un partido simulado reproducido minuto a minuto, no streaming.

import type { KeyboardEvent } from "react";
import { fmtMinuto } from "../vista/evidencia";
import type { EntradaOverlay } from "../vivo/overlay";
import type { Velocidad } from "../vivo/umbrales";
import type { Lengua } from "./Cronica";
import type { Reaccion } from "../vista/grada";
import { ETIQUETA_REACCION, ROTULO_GRADA } from "./Grada";
import { IconoCorregida, IconoGrada, IconoVerificada, IconoActa } from "./Iconos";

const ETIQUETA_TIPO: Record<EntradaOverlay["tipo"], string> = { gol: "Goal", roja: "Red card", descanso: "Half-time", final: "Full time" };

export function ControlesReplay({
  reloj,
  terminado,
  velocidad,
  onVelocidad,
  onSkip,
}: {
  reloj: number;
  terminado: boolean;
  velocidad: Velocidad;
  onVelocidad: (v: Velocidad) => void;
  onSkip: () => void;
}) {
  return (
    <div className="replay-bar" data-testid="replay-controls">
      <span className="replay-badge" data-testid="replay-badge" title="A simulated match replayed minute by minute — not a live broadcast">
        Replay
      </span>
      <span className="replay-clock tnum" data-testid="replay-clock" data-minuto={reloj}>
        {terminado ? "FT" : fmtMinuto(reloj)}
      </span>
      <div className="lang-toggle" role="group" aria-label="Replay speed" data-testid="replay-speed">
        {(
          [
            ["x1", "×1"],
            ["x5", "×5"],
            ["pausa", "Pause"],
          ] as const
        ).map(([v, etiqueta]) => (
          <button key={v} type="button" aria-pressed={velocidad === v} data-speed={v} onClick={() => onVelocidad(v)} disabled={terminado && v !== "pausa"}>
            {etiqueta}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary" data-testid="skip-full-time" onClick={onSkip}>
        {terminado ? "Read the full report" : "Skip to full-time"}
      </button>
    </div>
  );
}

export function Ticker({
  actualizaciones,
  lengua,
  onLengua,
  seleccionada,
  resaltadas,
  onActualizacion,
  cargando,
  error,
  reacciones = [],
  reaccionSel = null,
  onReaccion,
}: {
  actualizaciones: EntradaOverlay[];
  /** Brief 026: la grada de lo visto, intercalada por minuto (no es una update verificada: se rotula). */
  reacciones?: Reaccion[];
  reaccionSel?: number | null;
  onReaccion?: (j: number) => void;
  lengua: Lengua;
  onLengua: (l: Lengua) => void;
  seleccionada: number | null;
  resaltadas: Set<number>;
  onActualizacion: (i: number) => void;
  cargando: boolean;
  error: string | null;
}) {
  const teclado = (i: number, f: (i: number) => void = onActualizacion) => (ev: KeyboardEvent) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      f(i);
    }
  };
  // Brief 026: updates y reacciones de la grada, en orden de minuto (a igual minuto, la update primero).
  const filas = [...actualizaciones.map((a, i) => ({ k: "u" as const, i, minuto: a.minuto })), ...reacciones.map((r, i) => ({ k: "r" as const, i, minuto: r.minuto }))].sort(
    (a, b) => a.minuto - b.minuto || (a.k === b.k ? a.i - b.i : a.k === "u" ? -1 : 1),
  );
  return (
    <div>
      <div className="panel-head">
        <span className="overline">Live updates · verified before they show</span>
        <div className="lang-toggle" role="group" aria-label="Update language" data-testid="ticker-lang">
          {(["es", "en"] as const).map((l) => (
            <button key={l} type="button" aria-pressed={lengua === l} data-lang={l} onClick={() => onLengua(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="ticker" data-testid="ticker">
        <p className="ticker-note">
          Each update knows only the minutes already played and passed the same verifier (V1–V8) as the full report. Click one to see the events behind it.
        </p>
        {cargando && <p className="ticker-empty" data-testid="ticker-loading">Preparing verified updates…</p>}
        {error && (
          <p className="ticker-empty" data-testid="ticker-error">
            Could not load the updates: {error}
          </p>
        )}
        {!cargando && !error && actualizaciones.length === 0 && reacciones.length === 0 && <p className="ticker-empty">Nothing yet — the first update arrives with the first goal, red card or half-time.</p>}
        <ol className="ticker-list">
          {filas.map((f) => {
            if (f.k === "r") {
              const r = reacciones[f.i] as Reaccion;
              const j = f.i;
              return (
                <li
                  key={`r-${r.tipo}-${r.disparo}-${j}`}
                  className="ticker-item ticker-crowd"
                  data-testid="ticker-reaccion"
                  data-tipo={r.tipo}
                  data-minuto={r.minuto}
                  data-selected={reaccionSel === j ? "true" : "false"}
                  role="button"
                  tabIndex={0}
                  aria-pressed={reaccionSel === j}
                  onClick={() => onReaccion?.(j)}
                  onKeyDown={teclado(j, (x) => onReaccion?.(x))}
                >
                  <span className="ticker-min tnum">{fmtMinuto(r.minuto)}</span>
                  <span className="ticker-body">
                    <span className="ticker-kind overline">
                      {ETIQUETA_REACCION[r.tipo]} · {ROTULO_GRADA}
                    </span>
                    <span className="ticker-text">{lengua === "es" ? r.texto_es : r.texto_en}</span>
                  </span>
                  <span className="ticker-state" title="Crowd reaction derived from the match data — not a verified sentence">
                    <IconoGrada />
                  </span>
                </li>
              );
            }
            const i = f.i;
            const a = actualizaciones[i] as EntradaOverlay;
            const corregida = a.verificacion === "llm" && a.intentos > 1;
            return (
              <li
                key={`${a.momento}-${a.hecho}`}
                className="ticker-item"
                data-testid="ticker-update"
                data-minuto={a.minuto}
                data-momento={a.momento}
                data-selected={seleccionada === i ? "true" : "false"}
                data-highlighted={resaltadas.has(i) ? "true" : "false"}
                data-verificacion={a.verificacion}
                role="button"
                tabIndex={0}
                aria-pressed={seleccionada === i}
                onClick={() => onActualizacion(i)}
                onKeyDown={teclado(i)}
              >
                <span className="ticker-min tnum">{fmtMinuto(a.minuto)}</span>
                <span className="ticker-body">
                  <span className="ticker-kind overline">{ETIQUETA_TIPO[a.tipo]}</span>
                  <span className="ticker-text">{lengua === "es" ? a.texto_es : a.texto_en}</span>
                </span>
                <span
                  className={`ticker-state${a.verificacion === "plantilla" ? " acta" : ""}`}
                  title={
                    a.verificacion === "plantilla"
                      ? "Analyst record: the writer's drafts were rejected, so the fact's template is shown"
                      : corregida
                        ? `Corrected — verified on attempt ${a.intentos}`
                        : "Verified on the first pass"
                  }
                >
                  {a.verificacion === "plantilla" ? <IconoActa /> : corregida ? <IconoCorregida /> : <IconoVerificada />}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
