"use client";
// La Caja de cristal (brief 006 §2): «cómo se escribió» una frase — sus versiones por
// intento, la rechazada tachada con la regla y su explicación, el feedback tal cual — y la
// vista global del proceso. Todo sale del `audit` que la cadena guarda; nada se fabrica.

import type { CronicaVerificada, Motivo, Oracion } from "../cadena/tipos";
import { historiaDeOracion } from "../vista/evidencia";
import { IconoCerrar, IconoCorregida, IconoVerificada } from "./Iconos";
import type { Lengua } from "./Cronica";
import { REGLA_EN } from "./textos";

function Reglas({ motivos }: { motivos: Motivo[] }) {
  return (
    <>
      {motivos.map((m, k) => (
        <div className="rule" key={k} data-testid="rule" data-rule={m.regla}>
          <span className="rule-tag">{m.regla}</span>
          <span>
            {REGLA_EN[m.regla]}
            <span className="rule-note">Verifier note: {m.detalle}</span>
          </span>
        </div>
      ))}
    </>
  );
}

const textoDe = (o: Oracion | undefined, l: Lengua) => (o ? (l === "es" ? o.texto_es : o.texto_en) : "");

export function HistoriaFrase({ cronica, i, lengua, onCerrar }: { cronica: CronicaVerificada; i: number; lengua: Lengua; onCerrar: () => void }) {
  const o = cronica.oraciones[i];
  const pasos = historiaDeOracion(cronica, i);
  const limpia = pasos.length === 1 && pasos[0]?.aprobada === true;
  return (
    <>
      <div className="scrim" onClick={onCerrar} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="caja-titulo" data-testid="glass-box">
        <div className="layer-head">
          <div>
            <div className="overline">How this sentence was written</div>
            <h2 className="layer-title" id="caja-titulo">
              Sentence {i + 1} · fact {o?.hecho}
            </h2>
          </div>
          <button type="button" className="btn btn-quiet" onClick={onCerrar} aria-label="Close">
            <IconoCerrar />
          </button>
        </div>
        <div className="layer-body">
          {cronica.modo === "acta" && pasos.length === 0 && (
            <p className="caption">This is the analyst&apos;s template for the fact — no language model wrote it, so there is no drafting history.</p>
          )}
          {limpia && (
            <p className="caption" data-testid="clean-pass">
              Approved in attempt 1 — the verifier found nothing to correct.
            </p>
          )}
          {pasos.map((p) => (
            <section className="attempt" key={p.n} data-testid="attempt" data-approved={p.aprobada ? "true" : "false"}>
              <div className="attempt-head">
                <span className="overline">Attempt {p.n}</span>
                {p.aprobada ? (
                  <span className="verdict ok">
                    <IconoVerificada size={14} /> Approved
                  </span>
                ) : (
                  <span className="verdict rejected">
                    <IconoCorregida size={14} /> {p.version ? "Rejected" : p.ilegible ? "Unreadable output" : "Not written"}
                  </span>
                )}
              </div>
              {p.version ? (
                <div className={`attempt-text${p.aprobada ? "" : " struck"}`} lang={lengua}>
                  {textoDe(p.version, lengua)}
                </div>
              ) : (
                <div className="caption">{p.ilegible ? "The writer's output could not be read." : "The writer did not narrate this fact in this attempt."}</div>
              )}
              <Reglas motivos={p.ilegible && !p.version ? [p.ilegible] : p.motivos} />
              {p.feedback && !p.aprobada && (
                <div className="feedback">
                  <div className="overline" style={{ marginBottom: 6 }}>
                    Feedback sent back to the writer (verbatim)
                  </div>
                  {p.feedback}
                </div>
              )}
            </section>
          ))}
        </div>
      </aside>
    </>
  );
}

export function Proceso({ cronica, lengua, onCerrar }: { cronica: CronicaVerificada; lengua: Lengua; onCerrar: () => void }) {
  return (
    <>
      <div className="scrim" onClick={onCerrar} />
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="proceso-titulo" data-testid="process-view">
        <div className="layer-head">
          <div>
            <div className="overline">The process · every attempt, side by side</div>
            <h2 className="layer-title" id="proceso-titulo">
              {cronica.audit.length === 0
                ? "No attempts: the analyst's record was requested directly"
                : cronica.audit[cronica.audit.length - 1]?.veredicto.length === 0
                  ? `Approved in attempt ${cronica.audit.length}`
                  : cronica.modo === "acta"
                    ? `Rejected ${cronica.audit.length} times — the analyst's record is shown instead`
                    : `Rejected sentences omitted after ${cronica.audit.length} attempts`}
            </h2>
          </div>
          <button type="button" className="btn btn-quiet" onClick={onCerrar} aria-label="Close">
            <IconoCerrar />
          </button>
        </div>
        <div className="layer-body">
          <div className="process-grid">
            {cronica.audit.map((a) => {
              const rechazadas = new Set(a.veredicto.filter((m) => m.oracion >= 0).map((m) => m.oracion));
              const generales = a.veredicto.filter((m) => m.oracion < 0);
              return (
                <div key={a.n} className="attempt" data-testid="process-attempt">
                  <div className="attempt-head">
                    <span className="overline">Attempt {a.n}</span>
                    {a.veredicto.length === 0 ? (
                      <span className="verdict ok">
                        <IconoVerificada size={14} /> Approved
                      </span>
                    ) : (
                      <span className="verdict rejected tnum">
                        <IconoCorregida size={14} /> {a.veredicto.length} {a.veredicto.length === 1 ? "reason" : "reasons"}
                      </span>
                    )}
                  </div>
                  {a.borrador.oraciones.length === 0 && <div className="caption">Unreadable output.</div>}
                  {a.borrador.oraciones.map((o, k) => (
                    <div key={k} className="process-row">
                      <div className="process-sentence" data-rejected={rechazadas.has(k) ? "true" : "false"} lang={lengua}>
                        {textoDe(o, lengua)}
                      </div>
                      {/* La regla va FUERA del texto tachado: se tacha la versión, no la explicación. */}
                      {rechazadas.has(k) && <Reglas motivos={a.veredicto.filter((m) => m.oracion === k)} />}
                    </div>
                  ))}
                  {generales.length > 0 && <Reglas motivos={generales} />}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
