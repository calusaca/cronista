"use client";
// Brief 062 § 7.2 (con § 17.9: grupos visible y deshabilitado, «Disponible pronto») · Panel «Lanzar un torneo».
// Todas las cifras salen de `GET /api/arena/torneos/sitio` (la `Ficha` de cada formato), nunca escritas a mano. El
// botón deshabilitado es un `disabled` real con `aria-describedby` y el motivo visible. La confirmación va en la misma
// página (sin modal) con el foco en su h3; mientras la petición está en vuelo no hay doble envío.
import { useCallback, useEffect, useRef, useState } from "react";
import type { FichaFormato, FormatoTorneo } from "../arena/torneo-formatos";
import type { EstadoSitio, MotivoSitio } from "../arena/torneo-sitio";
import { TEXTOS_TORNEO_SITIO as T } from "./textos-torneo-sitio";
import Link from "./Enlace";

type Idioma = "es" | "en";
const FORMATOS: FormatoTorneo[] = ["liga", "grupos"];

const n1 = (micro: number, idioma: Idioma) => new Intl.NumberFormat(idioma, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(micro / 1_000_000);
const usdTope = (micro: number, idioma: Idioma) => new Intl.NumberFormat(idioma, { maximumFractionDigits: 1 }).format(micro / 1_000_000);
const rango = (r: { min: number; max: number }) => (r.min === r.max ? String(r.min) : `${r.min}–${r.max}`);
/** «≈ 3,5 USD» o «≈ 1,5–2,0 USD (hasta 2,7 con desempates)», desde la ficha. */
export function textoTipico(f: FichaFormato, idioma: Idioma): string {
  const { min, max, maxConDesempates } = f.tipicoMicroUsd;
  const base = min === max ? `≈ ${n1(min, idioma)} USD` : `≈ ${n1(min, idioma)}–${n1(max, idioma)} USD`;
  return maxConDesempates > max ? `${base} (${idioma === "es" ? "hasta" : "up to"} ${n1(maxConDesempates, idioma)} ${idioma === "es" ? "con desempates" : "with play-offs"})` : base;
}
/** La línea de cifras de un formato (partidos, típico, tope y duración). */
export function cifrasFormato(f: FichaFormato, idioma: Idioma): string {
  const es = idioma === "es";
  return [`${rango(f.partidos)} ${es ? "partidos" : "matches"}`, `${textoTipico(f, idioma)} ${es ? "típicos" : "typical"}`, `${es ? "tope" : "cap"} ${usdTope(f.topeMicroUsd, idioma)} USD`, `≈ ${rango(f.duracionMin)} min`].join(" · ");
}
/** § 7.2 · Texto del motivo por el que el botón está deshabilitado. */
export function textoMotivo(motivo: MotivoSitio | "error" | "formato", idioma: Idioma, proximoCupoUtc?: string): string {
  const es = idioma === "es";
  const hora = proximoCupoUtc ? new Intl.DateTimeFormat(idioma, { hour: "2-digit", minute: "2-digit" }).format(new Date(proximoCupoUtc)) : "";
  switch (motivo) {
    case "desactivado": case "commit": case "origen": return es ? "Lanzar torneos no está disponible en este momento." : "Launching tournaments is not available right now.";
    case "activo": return es ? "Hay un torneo en curso; espera a que termine." : "A tournament is in progress; wait for it to finish.";
    case "cupo": return es ? `Ya se lanzó el torneo de hoy (UTC). El próximo cupo se abre a las 00:00 UTC (${hora}).` : `Today's tournament (UTC) has already been launched. The next slot opens at 00:00 UTC (${hora}).`;
    case "bolsa": return es ? "Se agotó el presupuesto de torneos del sitio para este periodo." : "The site's tournament budget for this period is used up.";
    case "catalogo": return es ? "Faltan en el catálogo modelos del torneo; no se puede lanzar con los mismos modelos." : "Some tournament models are missing from the catalogue; it cannot be launched with the same models.";
    case "cancelacion": return es ? "La cancelación administrativa no está configurada." : "Administrative cancellation is not configured.";
    case "replicas": return es ? "Lanzar torneos exige una sola réplica del servidor." : "Launching tournaments requires a single server replica.";
    case "iniciando": return es ? "El servidor está iniciando; vuelve a intentarlo en un momento." : "The server is starting; try again in a moment.";
    case "relevo": return es ? "Despliegue en curso; vuelve a intentarlo en un minuto." : "Deployment in progress; try again in a minute.";
    case "cierre": return es ? "Hay un torneo anterior sin cerrar; el operador tiene que revisarlo." : "A previous tournament is not closed yet; the operator has to review it.";
    case "formato": return es ? "Este formato estará disponible pronto." : "This format will be available soon.";
    case "error": return es ? "No se pudo consultar el estado." : "Could not check the status.";
  }
}

export interface VistaPanel {
  idioma: Idioma; estado: EstadoSitio | null; error: boolean; formato: FormatoTorneo; confirmando: boolean; enviando: boolean;
  aviso: string | null;
  onFormato?: (f: FormatoTorneo) => void; onIniciar?: () => void; onConfirmar?: () => void; onCancelar?: () => void; onReintentar?: () => void;
  refConfirmar?: React.Ref<HTMLHeadingElement>;
}
/** Presentación pura (la prueba U1 la renderiza en cada estado). */
export function PanelLanzar(v: VistaPanel) {
  const { idioma, estado, formato } = v, es = idioma === "es";
  const ficha = estado?.formatos[formato];
  const motivo: MotivoSitio | "error" | "formato" | null = v.error ? "error" : !estado ? null : estado.motivo ?? (ficha && !ficha.disponible ? "formato" : null);
  const deshabilitado = !estado || motivo !== null || v.enviando;
  const conocido = estado?.bolsa.conocidoMicroUsd;
  return <section className="arena-torneo-panel arena-torneo-lanzar" aria-labelledby="arena-torneo-h-lanzar" data-testid="arena-torneo-lanzar">
    <h2 id="arena-torneo-h-lanzar">{T.lanzar[idioma]}</h2>
    {!estado && !v.error && <p className="arena-muted" aria-live="polite">{es ? "Comprobando el estado…" : "Checking the status…"}</p>}
    {estado && <fieldset className="arena-torneo-formatos">
      <legend>{T.formato[idioma]}</legend>
      {FORMATOS.map(f => {
        const fi = estado.formatos[f];
        return <label key={f} className="arena-torneo-opcion" data-testid={`arena-torneo-opcion-${f}`}>
          <input type="radio" name="arena-torneo-formato" value={f} checked={formato === f} disabled={!fi.disponible || v.enviando} onChange={() => v.onFormato?.(f)} aria-describedby={`arena-torneo-cifras-${f}`} />
          <span><strong>{T[f][idioma]}</strong> <span id={`arena-torneo-cifras-${f}`} className="arena-torneo-cifras" data-testid={`arena-torneo-cifras-${f}`}>{cifrasFormato(fi, idioma)}{fi.disponible ? "" : ` · ${T.pronto[idioma]}`}</span></span>
        </label>;
      })}
    </fieldset>}
    {!v.confirmando && <div className="arena-torneo-accion">
      <button type="button" className="btn btn-primary" disabled={deshabilitado} aria-describedby="arena-torneo-motivo" onClick={v.onIniciar} data-testid="arena-torneo-iniciar">{T.iniciar[idioma]}</button>
      <p id="arena-torneo-motivo" className="arena-torneo-motivo" data-testid="arena-torneo-motivo">
        {motivo ? textoMotivo(motivo, idioma, estado?.proximoCupoUtc) : ""}
        {motivo === "activo" && estado?.activo && <> <Link href={`/arena/torneo/${estado.activo.id}${es ? "?lang=es" : ""}`} prefetch={false}>{es ? "Ver el torneo en curso" : "Watch the tournament in progress"}</Link></>}
        {motivo === "error" && <> <button type="button" className="btn" onClick={v.onReintentar}>{es ? "Reintentar" : "Retry"}</button></>}
      </p>
    </div>}
    {v.confirmando && ficha && <div className="arena-torneo-confirmar" data-testid="arena-torneo-confirmar">
      <h3 tabIndex={-1} ref={v.refConfirmar}>{T.confirmarH[idioma]}</h3>
      <p>{es
        ? `Vas a lanzar el torneo de hoy para todo el sitio: ${T.formatosCorto[formato].es}, ${rango(ficha.partidos)} partidos, ${textoTipico(ficha, "es")} típicos (tope por estimación ${usdTope(ficha.topeMicroUsd, "es")} USD), ≈ ${rango(ficha.duracionMin)} min. Solo hay uno al día (UTC).`
        : `You are about to launch today's tournament for the whole site: ${T.formatosCorto[formato].en}, ${rango(ficha.partidos)} matches, ${textoTipico(ficha, "en")} typical (estimated cap ${usdTope(ficha.topeMicroUsd, "en")} USD), ≈ ${rango(ficha.duracionMin)} min. There is only one per day (UTC).`}</p>
      <div className="arena-torneo-botones">
        <button type="button" className="btn btn-primary" onClick={v.onConfirmar} disabled={v.enviando} data-testid="arena-torneo-confirmar-boton">{T.confirmar[idioma]}</button>
        <button type="button" className="btn" onClick={v.onCancelar} disabled={v.enviando}>{T.cancelar[idioma]}</button>
      </div>
    </div>}
    {v.aviso && <p role="alert" className="arena-torneo-banda" data-testid="arena-torneo-aviso-lanzar">{v.aviso}</p>}
    {estado && <p className="arena-muted" data-testid="arena-torneo-nota">{T.cupoNota[idioma]} {T.bolsaNota[idioma](conocido === null || conocido === undefined ? "—" : n1(conocido, idioma), usdTope(estado.bolsa.bolsaMicroUsd, idioma))} <span className="arena-torneo-leyenda">({T.bolsaLeyenda[idioma]})</span></p>}
  </section>;
}

/** El panel con su estado: consulta `GET /api/arena/torneos/sitio` y lanza con `POST`. */
export function ArenaTorneoLanzar({ idioma }: { idioma: Idioma }) {
  const [estado, setEstado] = useState<EstadoSitio | null>(null), [error, setError] = useState(false);
  const [formato, setFormato] = useState<FormatoTorneo>("liga"), [confirmando, setConfirmando] = useState(false), [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const h3 = useRef<HTMLHeadingElement>(null);
  const consultar = useCallback(async () => {
    setError(false);
    try {
      const r = await fetch("/api/arena/torneos/sitio", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setEstado(await r.json() as EstadoSitio);
    } catch { setError(true); }
  }, []);
  useEffect(() => { void consultar(); }, [consultar]);
  useEffect(() => { if (confirmando) h3.current?.focus(); }, [confirmando]);
  const confirmar = async () => {
    if (enviando) return;
    setEnviando(true); setAviso(null);
    try {
      const r = await fetch("/api/arena/torneos/sitio", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ formato }) });
      const cuerpo = await r.json().catch(() => ({})) as { id?: string; motivo?: MotivoSitio | "formato" | null; error?: string };
      if (r.status === 202 && cuerpo.id) { window.location.assign(`/arena/torneo/${cuerpo.id}${idioma === "es" ? "?lang=es" : ""}#arena-torneo-estado`); return; }
      setConfirmando(false);
      if (r.status === 429) setAviso(idioma === "es" ? "Demasiados intentos; espera un momento." : "Too many attempts; wait a moment.");
      else setAviso(cuerpo.motivo ? textoMotivo(cuerpo.motivo, idioma, estado?.proximoCupoUtc) : (idioma === "es" ? "No se pudo lanzar el torneo." : "Could not launch the tournament."));
      void consultar();
    } catch {
      setConfirmando(false); setAviso(idioma === "es" ? "No se pudo lanzar el torneo." : "Could not launch the tournament.");
    } finally { setEnviando(false); }
  };
  return <PanelLanzar idioma={idioma} estado={estado} error={error} formato={formato} confirmando={confirmando} enviando={enviando} aviso={aviso} refConfirmar={h3}
    onFormato={setFormato} onIniciar={() => { setAviso(null); setConfirmando(true); }} onConfirmar={() => void confirmar()} onCancelar={() => setConfirmando(false)} onReintentar={() => void consultar()} />;
}
