"use client";
// La crónica (brief 004): título + oraciones, toggle ES/EN, barra de verificación y el
// estado de cada frase (✓ verificada · ↻ corregida · acta). El modo acta tiene su propio
// estado visual honesto: no se disfraza de crónica.
//
// Preparado para el 007: recibe un `modo` de render. Hoy solo existe "aficionado"; el
// modo «analista» (datos duros expuestos) llega con ese brief.

import type { KeyboardEvent } from "react";
import type { Hecho } from "../analista/tipos";
import type { CronicaVerificada } from "../cadena/tipos";
import type { Evento } from "../sim/tipos";
import { estadoOracion, type EstadoOracion, eventosDeOracion, fmtMinuto, historiaDeOracion, resumenVerificacion } from "../vista/evidencia";
import { datosDuros, hechosNoUsados } from "../vista/modoAnalista";
import { IconoActa, IconoCorregida, IconoEvento, IconoHistoria, IconoVerificada } from "./Iconos";
import { describirEvento } from "./textos";

/** Brief 007: «aficionado» = la crónica tal cual; «analista» = los datos duros expuestos. */
export type ModoRender = "aficionado" | "analista";
export type Lengua = "es" | "en";

interface Props {
  /** Brief 026: resuelve un micro-evento citado a su evento ancla (la línea de tiempo). */
  anclaDe?: (microId: string) => string | undefined;
  cronica: CronicaVerificada;
  hechos: Hecho[];
  eventos: Evento[];
  /** Brief 007 «mi equipo»: el equipo para el que se cuenta, y cuánto suben sus hechos. */
  equipoPerspectiva?: string;
  deltaMiEquipo: number;
  modo: ModoRender;
  onModo: (m: ModoRender) => void;
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

/** Lo que el modo Analista agrega bajo cada frase: hecho, datos duros, eventos citados, historia. */
function DetalleAnalista({ cronica, hechos, eventos, i, equipoPerspectiva, delta, anclaDe }: { cronica: CronicaVerificada; hechos: Hecho[]; eventos: Evento[]; i: number; equipoPerspectiva?: string; delta: number; anclaDe?: (microId: string) => string | undefined }) {
  const o = cronica.oraciones[i];
  const h = hechos.find((x) => x.id === o?.hecho);
  if (!o || !h) return null;
  const porId = new Map(eventos.map((e) => [e.id, e] as const));
  const citados = eventosDeOracion(cronica, hechos, i, anclaDe)
    .map((id) => porId.get(id))
    .filter((e): e is Evento => e !== undefined);
  const datos = datosDuros(h);
  const historia = historiaDeOracion(cronica, i);
  const rechazos = historia.filter((p) => p.motivos.length > 0);
  const subio = equipoPerspectiva !== undefined && h.datos.equipo === equipoPerspectiva;
  return (
    <div className="analyst" data-testid="analyst-detail">
      <div className="analyst-meta tnum">
        Fact {h.id} · {h.tipo.replace(/_/g, " ")} · relevance {h.relevancia}
        {subio ? ` (+${delta} for ${equipoPerspectiva})` : ""}
        {o.apoyo && o.apoyo.length > 0 ? ` · support ${o.apoyo.join(", ")}` : ""}
      </div>
      {datos.length > 0 && (
        <div className="analyst-data">
          {datos.map((d) => (
            <span key={d.clave} className={`chip tnum${d.esXg ? " chip-xg" : ""}`} data-testid={d.esXg ? "sentence-xg" : undefined}>
              <span className="chip-label">{d.etiqueta}</span> {d.valor}
            </span>
          ))}
        </div>
      )}
      <ol className="analyst-events" data-testid="sentence-evidence">
        {citados.map((e) => (
          <li key={e.id} className="tnum">
            <span className="ev-min">{fmtMinuto(e.minuto)}</span>
            <IconoEvento tipo={e.tipo} size={13} />
            <span>{describirEvento(e)}</span>
            <span className="analyst-id">{e.id}</span>
          </li>
        ))}
      </ol>
      {rechazos.length > 0 && (
        <div className="analyst-history">
          {rechazos.map((p) => `Rejected in attempt ${p.n} (${p.motivos.map((m) => m.regla).join(", ")})`).join(" · ")} → approved in attempt{" "}
          {[...historia].reverse().find((p) => p.aprobada)?.n ?? "—"}
        </div>
      )}
    </div>
  );
}

export function Cronica(props: Props) {
  const { anclaDe, cronica, hechos, eventos, equipoPerspectiva, deltaMiEquipo, modo, onModo, lengua, onLengua, resaltadas, seleccionada, onOracion, onHover, onHistoria, onProceso } = props;
  const r = resumenVerificacion(cronica);
  const titulo = lengua === "es" ? cronica.titulo_es : cronica.titulo_en;
  const noUsados = modo === "analista" ? hechosNoUsados(cronica, hechos) : [];

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
        <div className="lang-toggle" role="group" aria-label="View" data-testid="mode-toggle">
          {(
            [
              ["aficionado", "Fan"],
              ["analista", "Analyst"],
            ] as const
          ).map(([m, etiqueta]) => (
            <button key={m} type="button" aria-pressed={modo === m} data-mode={m} onClick={() => onModo(m)}>
              {etiqueta}
            </button>
          ))}
        </div>
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
                data-hecho={o.hecho}
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
                  {modo === "analista" && (
                    <DetalleAnalista cronica={cronica} hechos={hechos} eventos={eventos} i={i} {...(anclaDe ? { anclaDe } : {})} equipoPerspectiva={equipoPerspectiva} delta={deltaMiEquipo} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {modo === "analista" && (
          <section className="unused" data-testid="unused-facts">
            <div className="overline">Facts the report did not use · {noUsados.length}</div>
            {noUsados.length === 0 ? (
              <p className="caption">Every fact the analyst found is narrated above.</p>
            ) : (
              <ul>
                {noUsados.map((h) => (
                  <li key={h.id} className="tnum">
                    <span className="analyst-id">{h.id}</span> {lengua === "es" ? h.texto_es : h.texto_en} <span className="analyst-id">relevance {h.relevancia}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

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
