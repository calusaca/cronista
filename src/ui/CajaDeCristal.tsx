"use client";
// La Caja de cristal (brief 006 §2): «cómo se escribió» una frase — sus versiones por
// intento, la rechazada tachada con la regla y su explicación, el feedback tal cual — y la
// vista global del proceso. Todo sale del `audit` que la cadena guarda; nada se fabrica.

import type { CronicaVerificada, Motivo, Oracion } from "../cadena/tipos";
import { historiaDeOracion } from "../vista/evidencia";
import { IconoCerrar, IconoCorregida, IconoVerificada } from "./Iconos";
import type { Lengua } from "./Cronica";
import { REGLA_EN, REGLA_ES } from "./textos";

/** Brief 064 § 4.9 · Idioma del marco: "en" por defecto (la crónica histórica no cambia); "es" en la crónica de arena. */
export type IdiomaMarco = "es" | "en";
const MARCO = {
  en: {
    nota: "Verifier note", titulo: "How this sentence was written", frase: (i: number, h: string | undefined) => `Sentence ${i + 1} · fact ${h}`, cerrar: "Close",
    sinHistoria: "This is the analyst's template for the fact — no language model wrote it, so there is no drafting history.",
    limpia: "Approved in attempt 1 — the verifier found nothing to correct.", intento: (n: number) => `Attempt ${n}`, aprobada: "Approved",
    rechazada: "Rejected", ilegible: "Unreadable output", noEscrita: "Not written", noLeida: "The writer's output could not be read.",
    noNarrada: "The writer did not narrate this fact in this attempt.", feedback: "Feedback sent back to the writer (verbatim)",
    proceso: "The process · every attempt, side by side", sinIntentos: "No attempts: the analyst's record was requested directly",
    aprobadaEn: (n: number) => `Approved in attempt ${n}`, rechazadaActa: (n: number) => `Rejected ${n} times — the analyst's record is shown instead`,
    omitidas: (n: number) => `Rejected sentences omitted after ${n} attempts`, motivos: (n: number) => `${n} ${n === 1 ? "reason" : "reasons"}`, ilegibleCorta: "Unreadable output.",
  },
  es: {
    nota: "Nota del verificador", titulo: "Cómo se escribió esta frase", frase: (i: number, h: string | undefined) => `Frase ${i + 1} · hecho ${h}`, cerrar: "Cerrar",
    sinHistoria: "Es la plantilla del analista para el hecho: no la escribió ningún modelo de lenguaje, así que no hay historia de redacción.",
    limpia: "Aprobada en el intento 1: el verificador no encontró nada que corregir.", intento: (n: number) => `Intento ${n}`, aprobada: "Aprobada",
    rechazada: "Rechazada", ilegible: "Salida ilegible", noEscrita: "No escrita", noLeida: "No se pudo leer la salida del redactor.",
    noNarrada: "El redactor no narró este hecho en este intento.", feedback: "Respuesta devuelta al redactor (literal)",
    proceso: "El proceso · todos los intentos, lado a lado", sinIntentos: "Sin intentos: se pidió directamente el acta del analista",
    aprobadaEn: (n: number) => `Aprobada en el intento ${n}`, rechazadaActa: (n: number) => `Rechazada ${n} veces: se muestra el acta del analista`,
    omitidas: (n: number) => `Frases rechazadas omitidas tras ${n} intentos`, motivos: (n: number) => `${n} ${n === 1 ? "motivo" : "motivos"}`, ilegibleCorta: "Salida ilegible.",
  },
} as const;

function Reglas({ motivos, marco = "en" }: { motivos: Motivo[]; marco?: IdiomaMarco }) {
  return (
    <>
      {motivos.map((m, k) => (
        <div className="rule" key={k} data-testid="rule" data-rule={m.regla}>
          <span className="rule-tag">{m.regla}</span>
          <span>
            {(marco === "es" ? REGLA_ES : REGLA_EN)[m.regla]}
            <span className="rule-note">{MARCO[marco].nota}: {m.detalle}</span>
          </span>
        </div>
      ))}
    </>
  );
}

const textoDe = (o: Oracion | undefined, l: Lengua) => (o ? (l === "es" ? o.texto_es : o.texto_en) : "");

export function HistoriaFrase({ cronica, i, lengua, onCerrar, idiomaMarco = "en" }: { cronica: CronicaVerificada; i: number; lengua: Lengua; onCerrar: () => void; idiomaMarco?: IdiomaMarco }) {
  const M = MARCO[idiomaMarco];
  const o = cronica.oraciones[i];
  const pasos = historiaDeOracion(cronica, i);
  const limpia = pasos.length === 1 && pasos[0]?.aprobada === true;
  return (
    <>
      <div className="scrim" onClick={onCerrar} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="caja-titulo" data-testid="glass-box">
        <div className="layer-head">
          <div>
            <div className="overline">{M.titulo}</div>
            <h2 className="layer-title" id="caja-titulo">
              {M.frase(i, o?.hecho)}
            </h2>
          </div>
          <button type="button" className="btn btn-quiet" onClick={onCerrar} aria-label={M.cerrar}>
            <IconoCerrar />
          </button>
        </div>
        <div className="layer-body">
          {cronica.modo === "acta" && pasos.length === 0 && (
            <p className="caption">{M.sinHistoria}</p>
          )}
          {limpia && (
            <p className="caption" data-testid="clean-pass">
              {M.limpia}
            </p>
          )}
          {pasos.map((p) => (
            <section className="attempt" key={p.n} data-testid="attempt" data-approved={p.aprobada ? "true" : "false"}>
              <div className="attempt-head">
                <span className="overline">{M.intento(p.n)}</span>
                {p.aprobada ? (
                  <span className="verdict ok">
                    <IconoVerificada size={14} /> {M.aprobada}
                  </span>
                ) : (
                  <span className="verdict rejected">
                    <IconoCorregida size={14} /> {p.version ? M.rechazada : p.ilegible ? M.ilegible : M.noEscrita}
                  </span>
                )}
              </div>
              {p.version ? (
                <div className={`attempt-text${p.aprobada ? "" : " struck"}`} lang={lengua}>
                  {textoDe(p.version, lengua)}
                </div>
              ) : (
                <div className="caption">{p.ilegible ? M.noLeida : M.noNarrada}</div>
              )}
              <Reglas motivos={p.ilegible && !p.version ? [p.ilegible] : p.motivos} marco={idiomaMarco} />
              {p.feedback && !p.aprobada && (
                <div className="feedback">
                  <div className="overline" style={{ marginBottom: 6 }}>
                    {M.feedback}
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

export function Proceso({ cronica, lengua, onCerrar, idiomaMarco = "en" }: { cronica: CronicaVerificada; lengua: Lengua; onCerrar: () => void; idiomaMarco?: IdiomaMarco }) {
  const M = MARCO[idiomaMarco];
  return (
    <>
      <div className="scrim" onClick={onCerrar} />
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="proceso-titulo" data-testid="process-view">
        <div className="layer-head">
          <div>
            <div className="overline">{M.proceso}</div>
            <h2 className="layer-title" id="proceso-titulo">
              {cronica.audit.length === 0
                ? M.sinIntentos
                : cronica.audit[cronica.audit.length - 1]?.veredicto.length === 0
                  ? M.aprobadaEn(cronica.audit.length)
                  : cronica.modo === "acta"
                    ? M.rechazadaActa(cronica.audit.length)
                    : M.omitidas(cronica.audit.length)}
            </h2>
          </div>
          <button type="button" className="btn btn-quiet" onClick={onCerrar} aria-label={M.cerrar}>
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
                    <span className="overline">{M.intento(a.n)}</span>
                    {a.veredicto.length === 0 ? (
                      <span className="verdict ok">
                        <IconoVerificada size={14} /> {M.aprobada}
                      </span>
                    ) : (
                      <span className="verdict rejected tnum">
                        <IconoCorregida size={14} /> {M.motivos(a.veredicto.length)}
                      </span>
                    )}
                  </div>
                  {a.borrador.oraciones.length === 0 && <div className="caption">{M.ilegibleCorta}</div>}
                  {a.borrador.oraciones.map((o, k) => (
                    <div key={k} className="process-row">
                      <div className="process-sentence" data-rejected={rechazadas.has(k) ? "true" : "false"} lang={lengua}>
                        {textoDe(o, lengua)}
                      </div>
                      {/* La regla va FUERA del texto tachado: se tacha la versión, no la explicación. */}
                      {rechazadas.has(k) && <Reglas motivos={a.veredicto.filter((m) => m.oracion === k)} marco={idiomaMarco} />}
                    </div>
                  ))}
                  {generales.length > 0 && <Reglas motivos={generales} marco={idiomaMarco} />}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
