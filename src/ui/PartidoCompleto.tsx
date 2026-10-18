"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MicroPartido } from "../sim/micro";
import type { Partido } from "../sim/tipos";
import { ACCIONES_POR_PAGINA, accionesCompletas, explicarAccion, exportarPartido, filtrarAcciones, nombreAccion, paginaDelMinuto, ubicacionAccion, type FiltroAcciones } from "../vista/partido-completo";
import { fmtMinuto } from "../vista/evidencia";
import { IconoCerrar } from "./Iconos";
import type { LenguaXg, ModoXg } from "./textos";
import { construirRelato, exportarRelato } from "../vista/relato";
import { cuadroInicial } from "../vista/tactica";
import { RelatoPartido } from "./RelatoPartido";
import { Formaciones } from "./Formaciones";

export type VistaCompleta = "relato" | "acciones" | "formaciones";

const SIN_FILTROS: FiltroAcciones = { periodo: "todos", equipo: "todos", tipo: "todos", buscar: "" };

export function PartidoCompleto({ partido, m, lengua, modo, onLengua, onCerrar, vistaInicial = "relato", accionInicial }: {
  partido: Partido; m: MicroPartido; lengua: LenguaXg; modo: ModoXg;
  onLengua: (l: LenguaXg) => void; onCerrar: () => void;
  vistaInicial?: VistaCompleta; accionInicial?: string;
}) {
  const es = lengua === "es";
  const dialogo = useRef<HTMLDialogElement>(null);
  const lista = useRef<HTMLOListElement>(null);
  const [filtro, setFiltro] = useState<FiltroAcciones>(SIN_FILTROS);
  const [pagina, setPagina] = useState(0);
  const [minuto, setMinuto] = useState("0");
  const [destino, setDestino] = useState<string | null>(null);
  const filas = useMemo(() => accionesCompletas(partido, m), [partido, m]);
  const [vista, setVista] = useState<VistaCompleta>(vistaInicial);
  const [seleccion, setSeleccion] = useState(accionInicial ?? filas[0]?.id ?? "");
  const relato = useMemo(() => construirRelato(partido, filas), [partido, filas]);
  const inicial = useMemo(() => cuadroInicial(partido), [partido]);
  const filtradas = useMemo(() => filtrarAcciones(filas, filtro, partido), [filas, filtro, partido]);
  const tipos = useMemo(() => [...new Map(filas.map((a) => [a.registro.evento.tipo, a])).values()], [filas]);
  const paginas = Math.max(1, Math.ceil(filtradas.length / ACCIONES_POR_PAGINA));
  const actual = Math.min(pagina, paginas - 1);
  const desde = actual * ACCIONES_POR_PAGINA;
  const visibles = filtradas.slice(desde, desde + ACCIONES_POR_PAGINA);
  const final = filas.at(-1)?.minuto ?? 0;

  useEffect(() => {
    const antes = document.activeElement;
    const overflow = document.body.style.overflow;
    const el = dialogo.current;
    el?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      el?.close();
      document.body.style.overflow = overflow;
      if (antes instanceof HTMLElement && antes.isConnected) antes.focus({ preventScroll: true });
      else document.querySelector<HTMLElement>('[data-testid="open-full-match"]')?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const cont = lista.current;
    if (!cont) return;
    const fila = destino ? cont.querySelector<HTMLElement>(`[data-action-id="${destino}"]`) : null;
    cont.scrollTop = fila ? fila.offsetTop - 10 : 0;
  }, [actual, filtro, destino, vista]);

  function filtrar(cambio: Partial<FiltroAcciones>) {
    setFiltro((f) => ({ ...f, ...cambio }));
    setPagina(0);
    setDestino(null);
  }
  function irAlMinuto() {
    const n = Number(minuto);
    if (!minuto.trim() || !Number.isInteger(n) || n < 0 || n > final) return;
    setFiltro({ ...SIN_FILTROS });
    setPagina(paginaDelMinuto(filas, n));
    setDestino((filas.find((a) => a.minuto >= n) ?? filas.at(-1))?.id ?? null);
  }
  function descargar() {
    guardar(exportarPartido(partido, filas, lengua, modo), `cronista-partido-${partido.config.seed}-${lengua}.txt`);
  }
  function guardar(texto: string, archivo: string) {
    const blob = new Blob([texto], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = archivo;
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <dialog ref={dialogo} className={`full-match full-match-${vista}`} aria-labelledby="full-match-title" data-testid="full-match" lang={lengua}
      onCancel={(e) => { e.preventDefault(); onCerrar(); }}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const controles = e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [href], [tabindex="0"]');
        const primero = controles[0];
        const ultimo = controles[controles.length - 1];
        if (e.shiftKey && document.activeElement === primero && ultimo) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo && primero) { e.preventDefault(); primero.focus(); }
      }}>
      <header className="layer-head">
        <div>
          <div className="overline">{es ? "Pase por pase · movimiento por movimiento" : "Pass by pass · movement by movement"}</div>
          <h2 className="layer-title" id="full-match-title">{es ? "Partido completo" : "Full match"}</h2>
          <p className="full-match-teams">{partido.config.local.nombre} <span aria-hidden="true">—</span> {partido.config.visita.nombre}</p>
        </div>
        <button type="button" className="btn btn-quiet" onClick={onCerrar} aria-label={es ? "Cerrar" : "Close"} data-testid="full-match-close"><IconoCerrar /></button>
      </header>

      <nav className="full-match-views" aria-label={es ? "Vista del partido" : "Match view"}>
        {(["relato", "acciones", "formaciones"] as const).map(v => <button key={v} type="button" aria-pressed={vista === v} onClick={() => setVista(v)} data-testid={`full-view-${v}`}>
          {(es ? { relato: "Relato por jugadas", acciones: "Cada acción", formaciones: "Formaciones" } : { relato: "Commentary", acciones: "Every action", formaciones: "Formations" })[v]}
        </button>)}
      </nav>

      <div className="full-match-tools">
        <div className="full-match-summary">
          <p className="caption">{es ? `${filas.length.toLocaleString("es")} acciones registradas, del saque inicial al final.` : `${filas.length.toLocaleString("en")} recorded actions, from kick-off to full time.`}</p>
          <div className="lang-toggle" role="group" aria-label={es ? "Idioma del relato" : "Commentary language"} data-testid="full-match-language">
            {(["es", "en"] as const).map((l) => <button type="button" key={l} aria-pressed={lengua === l} onClick={() => onLengua(l)}>{l.toUpperCase()}</button>)}
          </div>
          <button type="button" className="btn" onClick={descargar} data-testid="full-match-download">{es ? "Descargar partido completo" : "Download full match"}</button>
        </div>
        <p className="full-match-note" data-testid="full-match-limit">{es ? "Minutos, zonas y acciones con balón del registro. Cancha, direcciones y apoyos: reconstrucción esquemática, sin tracking ni segundos exactos." : "Recorded minutes, zones and on-ball actions. Pitch, directions and support runs: schematic reconstruction, without tracking or exact seconds."}</p>

        {vista === "acciones" && <>
        <div className="full-match-filters">
          <label className="full-match-search">{es ? "Buscar jugador o equipo" : "Find a player or team"}
            <input type="search" value={filtro.buscar} placeholder={es ? "Nombre, receptor o rival…" : "Name, receiver or opponent…"} onChange={(e) => filtrar({ buscar: e.target.value })} data-testid="full-match-search" />
          </label>
          <label>{es ? "Tiempo" : "Half"}<select value={filtro.periodo} onChange={(e) => filtrar({ periodo: e.target.value as FiltroAcciones["periodo"] })} data-testid="full-match-half">
            <option value="todos">{es ? "Todo el partido" : "Whole match"}</option><option value="1">{es ? "Primer tiempo" : "First half"}</option><option value="2">{es ? "Segundo tiempo" : "Second half"}</option>
          </select></label>
          <label>{es ? "Equipo" : "Team"}<select value={filtro.equipo} onChange={(e) => filtrar({ equipo: e.target.value as FiltroAcciones["equipo"] })} data-testid="full-match-team">
            <option value="todos">{es ? "Ambos equipos" : "Both teams"}</option><option value="local">{partido.config.local.nombre}</option><option value="visita">{partido.config.visita.nombre}</option>
          </select></label>
          <label>{es ? "Acción" : "Action"}<select value={filtro.tipo} onChange={(e) => filtrar({ tipo: e.target.value as FiltroAcciones["tipo"] })} data-testid="full-match-type">
            <option value="todos">{es ? "Todas las acciones" : "Every action"}</option>{tipos.map((a) => <option key={a.registro.evento.tipo} value={a.registro.evento.tipo}>{nombreAccion(a, lengua)}</option>)}
          </select></label>
        </div>
        <div className="full-match-navigation">
          <form className="full-match-jump" onSubmit={(e) => { e.preventDefault(); irAlMinuto(); }}>
            <label htmlFor="full-match-minute">{es ? "Ir al minuto" : "Go to minute"}</label>
            <input id="full-match-minute" type="number" min={0} max={final} step={1} required value={minuto} onChange={(e) => setMinuto(e.target.value)} data-testid="full-match-minute" />
            <button type="submit" className="btn" data-testid="full-match-go">{es ? "Ir" : "Go"}</button>
          </form>
          <button type="button" className="btn btn-quiet" onClick={() => { setFiltro({ ...SIN_FILTROS }); setPagina(0); setDestino(null); }} data-testid="full-match-reset">{es ? "Mostrar todo" : "Show everything"}</button>
          <output className="caption tnum" aria-live="polite" data-testid="full-match-count" data-total={filtradas.length}>
            {filtradas.length ? desde + 1 : 0}–{Math.min(desde + ACCIONES_POR_PAGINA, filtradas.length)} {es ? "de" : "of"} {filtradas.length} {es ? "acciones" : "actions"}
          </output>
        </div>
        </>}
      </div>

      {vista === "relato" && <RelatoPartido partido={partido} filas={filas} jugadas={relato.jugadas} cuadros={relato.cuadros} lengua={lengua} modo={modo} seleccion={seleccion} onSeleccion={setSeleccion} onDescargar={estilo => guardar(exportarRelato(partido, relato.jugadas, relato.cuadros, lengua, modo, estilo), `cronista-relato-${partido.config.seed}-${lengua}.txt`)} />}
      {vista === "formaciones" && <Formaciones partido={partido} inicial={inicial} actual={relato.cuadros.get(seleccion) ?? inicial} lengua={lengua} />}
      {vista === "acciones" && <>
      <ol className="full-match-list" ref={lista} start={desde + 1} data-testid="full-match-list" aria-label={es ? "Relato completo de las acciones" : "Complete play-by-play commentary"}>
        {visibles.map((a) => {
          const e = a.registro.evento;
          const ubicacion = ubicacionAccion(a, lengua);
          return <li key={a.id} className={`full-match-row${e.tipo === "gol" ? " full-match-goal" : ""}${a.id === destino ? " full-match-target" : ""}`} data-testid="full-match-action" data-action-id={a.id} data-kind={e.tipo} data-half={a.periodo} data-minute={a.minuto} data-side={a.equipo} data-layer={a.registro.capa}>
            <div className="full-match-clock tnum"><strong>{fmtMinuto(a.minuto)}</strong><span>{a.periodo}{es ? "T" : "H"}</span></div>
            <div className="full-match-action-body">
              <div className="full-match-meta"><span className="chip">{nombreAccion(a, lengua)}</span><span>{partido.config[a.equipo].nombre}</span>
                {(e.tipo === "gol" || e.tipo === "fin_periodo") && <strong className="full-match-score tnum">{a.marcador.local}–{a.marcador.visita}</strong>}
              </div>
              <p>{explicarAccion(a, partido, lengua, modo)}</p>
              <div className="full-match-location">{ubicacion}{a.registro.capa === "micro" ? ` · ${es ? "Posesión" : "Possession"} ${a.registro.evento.posesion}` : ""}</div>
              <button type="button" className="btn btn-quiet full-match-see-pitch" onClick={() => { setSeleccion(a.id); setVista("relato"); }} data-testid="show-action-pitch">{es ? "Seguir en cancha →" : "Follow on pitch →"}</button>
            </div>
          </li>;
        })}
        {filtradas.length === 0 && <li className="full-match-empty">{es ? "No hay acciones con estos filtros. Prueba otro nombre o muestra todo el partido." : "No actions match these filters. Try another name or show the whole match."}</li>}
      </ol>
      <footer className="full-match-pages">
        <button type="button" className="btn" disabled={actual === 0} onClick={() => { setPagina(0); setDestino(null); }} data-testid="full-match-first">{es ? "Inicio" : "First"}</button>
        <button type="button" className="btn" disabled={actual === 0} onClick={() => { setPagina(actual - 1); setDestino(null); }} data-testid="full-match-previous">{es ? "Anterior" : "Previous"}</button>
        <span className="tnum" data-testid="full-match-page">{actual + 1} / {paginas}</span>
        <button type="button" className="btn" disabled={actual === paginas - 1} onClick={() => { setPagina(actual + 1); setDestino(null); }} data-testid="full-match-next">{es ? "Siguiente" : "Next"}</button>
        <button type="button" className="btn" disabled={actual === paginas - 1} onClick={() => { setPagina(paginas - 1); setDestino(null); }} data-testid="full-match-last">{es ? "Final" : "Last"}</button>
      </footer>
      </>}
    </dialog>
  );
}
