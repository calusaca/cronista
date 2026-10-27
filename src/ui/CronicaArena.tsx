"use client";
// Brief 064 § 4.9 · La página de la crónica de un partido de la arena, con el aspecto de la arena: cabecera (escudos,
// marcador, duración, reglas, quién jugó y su procedencia), redactor rotulado, barra de verificación, título y frases
// con su estado, «Ver proceso», línea de tiempo de eventos y límites honestos. Marco bilingüe completo: el ES/EN de la
// barra cambia frases, marco y línea de tiempo. Nunca recibe los fotogramas (solo lo que se muestra).
import { useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { CronicaVerificada } from "../cadena/tipos";
import type { MotivoActa } from "../arena/cronica";
import { eventosDeOracionArena, oracionesDeEventoArena, type FuenteCronica } from "../arena/cronica-vista";
import { identidadPartido } from "../arena/identidad";
import { IDENTIDAD_ARENA } from "../sim/limites";
import { estadoOracion, resumenVerificacion } from "../vista/evidencia";
import { BarraSitio } from "./BarraSitio";
import { BotonCronica } from "./BotonCronica";
import { HistoriaFrase, Proceso } from "./CajaDeCristal";
import Link from "./Enlace";
import { Escudo } from "./Escudo";
import { IconoActa, IconoCorregida, IconoHistoria, IconoVerificada } from "./Iconos";
import { IconoClase, type ClaseIcono } from "./IconosArena";
import { PieSitio } from "./PieSitio";
import { TEXTOS_CRONICA_ARENA as T } from "./textos-cronica-arena";

type Idioma = "es" | "en";
export interface HechoPagina { id: string; tipo: string; texto_es: string; texto_en: string; eventos: string[] }
export interface EventoLinea { id: string; reloj: string; clase: ClaseIcono | null; texto_es: string; texto_en: string; lado: "local" | "visita" }
export interface CabeceraCronica {
  local: string; visita: string; goles: { local: number; visita: number }; duracionS: number; finalAnticipado: boolean; reglas: string;
  modelos: Record<Idioma, { texto: string; procedencia: string }>;
  torneo: { id: string; n: number; fecha: Record<Idioma, string>; prueba: boolean } | null;
}
export interface RedactorPagina { id: string | null; etiqueta: string; fixture: boolean; modo: "llm" | "acta"; motivoActa?: MotivoActa; provisional: boolean; hechosVia?: "mcp" | "directo" }
export interface PropsCronicaArena {
  huella: string; idiomaInicial: Idioma; cabecera: CabeceraCronica;
  estado: "lista" | "sin-cronica" | "invalida" | "desactualizada";
  cronica?: CronicaVerificada; redactor?: RedactorPagina;
  hechos: HechoPagina[]; linea: EventoLinea[];
}

function IconoEstado({ estado }: { estado: ReturnType<typeof estadoOracion> }) {
  if (estado === "corregida") return <IconoCorregida />;
  if (estado === "acta") return <IconoActa />;
  return <IconoVerificada />;
}

function rotuloRedactor(r: RedactorPagina, idioma: Idioma): string {
  if (r.modo === "acta") return `${T.acta[idioma]}${r.motivoActa ? ` · ${T.motivos[r.motivoActa][idioma]}` : ""}`;
  const nombre = r.id === "stub" ? T.stub[idioma] : r.id === "ensayo" ? T.ensayo[idioma] : r.etiqueta;
  return `${T.redactor[idioma]}: ${nombre}`;
}

export function CronicaArena(p: PropsCronicaArena) {
  const [idioma, setIdioma] = useState<Idioma>(p.idiomaInicial);
  const [seleccionada, setSeleccionada] = useState<number | null>(null);
  const [eventoElegido, setEventoElegido] = useState<string | null>(null);
  const [historia, setHistoria] = useState<number | null>(null);
  const [proceso, setProceso] = useState(false);
  const es = idioma === "es";
  const identidad = useMemo(() => identidadPartido(p.cabecera.local, p.cabecera.visita), [p.cabecera.local, p.cabecera.visita]);
  const c = p.cronica;
  const eventosDe = useMemo(() => (c ? c.oraciones.map((_, i) => eventosDeOracionArena(c, p.hechos, i)) : []), [c, p.hechos]);
  const resaltados = new Set<string>(seleccionada !== null ? eventosDe[seleccionada] ?? [] : eventoElegido ? [eventoElegido] : []);
  const frasesResaltadas = new Set<number>(eventoElegido && c ? oracionesDeEventoArena(c, p.hechos, eventoElegido) : seleccionada !== null ? [seleccionada] : []);
  const elegirFrase = (i: number) => { setEventoElegido(null); setSeleccionada((s) => (s === i ? null : i)); };
  const elegirEvento = (id: string) => { setSeleccionada(null); setEventoElegido((e) => (e === id ? null : id)); };
  const teclado = (f: () => void) => (ev: KeyboardEvent) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); f(); } };
  const r = c ? resumenVerificacion(c) : null;
  const titulo = c ? (es ? c.titulo_es : c.titulo_en) : "";
  const hechoSel = seleccionada !== null && c ? p.hechos.find((h) => h.id === c.oraciones[seleccionada]?.hecho) : undefined;
  const fuente: FuenteCronica = { huella: p.huella };
  const { cabecera: k } = p;

  return <>
    <BarraSitio idioma={idioma} alCambiarIdioma={() => setIdioma(es ? "en" : "es")} seccion={null} />
    <main className="arena-shell arena-cronica" lang={idioma} data-testid="cronica-arena" style={identidad.variables as CSSProperties}>
      <div className="arena-intro arena-cronica-cabecera" data-testid="cronica-arena-cabecera">
        <p className="overline">{T.overline[idioma]}</p>
        <p className="arena-cronica-marcador tnum">
          <span><Escudo identidad={identidad.local} size={IDENTIDAD_ARENA.escudoPx.marcador} />{k.local}</span>
          <strong data-testid="cronica-arena-marcador">{k.goles.local} – {k.goles.visita}</strong>
          <span>{k.visita}<Escudo identidad={identidad.visita} size={IDENTIDAD_ARENA.escudoPx.marcador} /></span>
        </p>
        <p className="arena-cronica-datos tnum">
          <span>{k.duracionS} s</span>
          {k.finalAnticipado && <span data-testid="cronica-arena-final-anticipado">{T.finalAnticipado[idioma]}</span>}
          <span>{T.reglas[idioma]}: <code>{k.reglas}</code></span>
        </p>
        <p className="arena-models" data-testid="cronica-arena-modelos" data-procedencia={k.modelos[idioma].procedencia}><span className="overline">{T.quienJugo[idioma]}</span> {k.modelos[idioma].texto}</p>
        {k.torneo && <p className="arena-torneo-origen" data-testid="cronica-arena-torneo">{T.torneo[idioma](k.torneo.n, k.torneo.fecha[idioma])} · <Link href={`/arena/torneo/${k.torneo.id}${es ? "?lang=es" : ""}`} prefetch={false}>{T.volverTorneo[idioma]}</Link></p>}
      </div>

      <section className="arena-cronica-cuerpo" aria-labelledby="cronica-arena-titulo">
        {p.redactor && <p className="arena-cronica-redactor" data-testid="cronica-redactor" data-fixture={p.redactor.fixture ? "true" : "false"} data-modo={p.redactor.modo} data-motivo={p.redactor.motivoActa}>
          {rotuloRedactor(p.redactor, idioma)}{p.redactor.provisional && <span className="arena-muted"> · {T.provisional[idioma]}</span>}
        </p>}
        {p.redactor?.hechosVia === "mcp" && <p className="arena-muted arena-cronica-via" data-testid="cronica-hechos-via">{T.hechosMcp[idioma]}</p>}

        {c && r ? <>
          {r.modo === "llm" ? (
            <div className="verify-bar" data-testid="verify-bar" data-mode="llm">
              <span className="verify-main tnum"><IconoVerificada />{T.verificadas[idioma](r.oraciones)}</span>
              <span className="verify-item tnum"><strong>{r.intentos}</strong> {T.intentos[idioma](r.intentos)}</span>
              <span className="verify-item tnum"><strong>{r.corregidas}</strong> {T.corregidas[idioma]}</span>
              <span className="verify-item tnum"><strong>{r.omitidas}</strong> {T.omitidas[idioma]}</span>
              <button type="button" className="btn" onClick={() => setProceso(true)} data-testid="open-process"><IconoHistoria /> {T.verProceso[idioma]}</button>
            </div>
          ) : (
            <div className="acta-banner" data-testid="verify-bar" data-mode="acta">
              <strong>{T.actaBanner[idioma]}</strong>{T.actaDetalle[idioma]}
              {c.audit.length > 0 && <div className="arena-cronica-acciones"><button type="button" className="btn" onClick={() => setProceso(true)} data-testid="open-process"><IconoHistoria /> {T.verRechazos[idioma]}</button></div>}
            </div>
          )}
          <h1 className="chronicle-title" id="cronica-arena-titulo" lang={idioma} data-testid="chronicle-title">{titulo}</h1>
          <div className="sentences">
            {c.oraciones.map((o, i) => {
              const estado = estadoOracion(c, i);
              const elegida = seleccionada === i;
              return <div key={`${o.hecho}-${i}`} className="sentence" role="button" tabIndex={0} data-testid="sentence" data-index={i} data-hecho={o.hecho} data-state={estado}
                data-event-ids={(eventosDe[i] ?? []).join(" ")} data-highlighted={frasesResaltadas.has(i) ? "true" : "false"} data-selected={elegida ? "true" : "false"} aria-pressed={elegida}
                onClick={() => elegirFrase(i)} onKeyDown={teclado(() => elegirFrase(i))}>
                <span className="sentence-state" role="img" aria-label={T.estado[estado][idioma]} title={T.estado[estado][idioma]} data-testid="sentence-state"><IconoEstado estado={estado} /></span>
                <div>
                  <div className="sentence-text" lang={idioma} data-testid="sentence-text">{es ? o.texto_es : o.texto_en}</div>
                  {elegida && <div className="arena-cronica-detalle" data-testid="sentence-detail">
                    {hechoSel && <p className="arena-muted" data-testid="sentence-fact">{T.hecho[idioma]} {hechoSel.id} · {es ? hechoSel.texto_es : hechoSel.texto_en}</p>}
                    <div className="arena-cronica-acciones">
                      {estado === "corregida" && <button type="button" className="btn btn-quiet" data-testid="how-written" onClick={(ev) => { ev.stopPropagation(); setHistoria(i); }}><IconoHistoria /> {T.historia[idioma]}</button>}
                    </div>
                  </div>}
                </div>
              </div>;
            })}
          </div>
          <p className="arena-muted arena-cronica-leyenda">{T.leyenda[idioma]}</p>
        </> : <div className="arena-cronica-vacia" data-testid="cronica-arena-sin-prosa" data-estado={p.estado}>
          <p>{T.sinCronica[p.estado === "lista" ? "sin-cronica" : p.estado][idioma]}</p>
          <BotonCronica fuente={fuente} idioma={idioma} variante="boton" />
        </div>}
      </section>

      <section className="arena-cronica-linea" aria-labelledby="cronica-arena-linea-titulo" data-testid="cronica-arena-linea">
        <h2 id="cronica-arena-linea-titulo">{T.linea[idioma]}</h2>
        <p className="arena-muted">{T.lineaNota[idioma]}</p>
        <ol>
          {p.linea.map((e) => <li key={e.id}>
            <button type="button" className="arena-cronica-evento" data-testid="timeline-event" data-event-id={e.id} data-side={e.lado} data-highlighted={resaltados.has(e.id) ? "true" : "false"} aria-pressed={eventoElegido === e.id} onClick={() => elegirEvento(e.id)}>
              <span className="tnum arena-cronica-reloj">{e.reloj}</span>
              <span className="arena-event-icon" aria-hidden="true" data-kind={e.clase ?? undefined}>{e.clase && <IconoClase clase={e.clase} />}</span>
              <span>{es ? e.texto_es : e.texto_en}</span>
            </button>
          </li>)}
        </ol>
      </section>

      <details className="arena-cronica-limites" data-testid="cronica-arena-limites">
        <summary>{T.limites[idioma]}</summary>
        <p>{T.limitesComprueba[idioma]}</p>
        <p>{T.limitesNo[idioma]}</p>
        <p>{T.limitesLinea[idioma]}</p>
      </details>
      {c && historia !== null && <HistoriaFrase cronica={c} i={historia} lengua={idioma} idiomaMarco={idioma} onCerrar={() => setHistoria(null)} />}
      {c && proceso && <Proceso cronica={c} lengua={idioma} idiomaMarco={idioma} onCerrar={() => setProceso(false)} />}
    </main>
    <PieSitio idioma={idioma} />
  </>;
}
