"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Partido } from "../sim/tipos";
import { explicarAccion, nombreAccion, type AccionCompleta } from "../vista/partido-completo";
import { buscarJugadas, frasesDeJugada, introduccionFormaciones, JUGADAS_POR_PAGINA, textoApoyos, type EstiloRelato, type JugadaRelatada } from "../vista/relato";
import type { CuadroTactico } from "../vista/tactica";
import { fmtMinuto } from "../vista/evidencia";
import type { LenguaXg, ModoXg } from "./textos";
import { ReproductorCancha } from "./ReproductorCancha";

export function RelatoPartido({ partido, filas, jugadas, cuadros, lengua, modo, seleccion, onSeleccion, onDescargar }: {
  partido: Partido; filas: AccionCompleta[]; jugadas: JugadaRelatada[]; cuadros: Map<string, CuadroTactico>;
  lengua: LenguaXg; modo: ModoXg; seleccion: string; onSeleccion: (id: string) => void; onDescargar: (estilo: EstiloRelato) => void;
}) {
  const es = lengua === "es";
  const [buscar, setBuscar] = useState("");
  const [minuto, setMinuto] = useState("0");
  const [canchaVisible, setCanchaVisible] = useState(false);
  const [movil, setMovil] = useState(false);
  const [estilo, setEstilo] = useState<EstiloRelato>("fluido");
  const [revisionManual, setRevisionManual] = useState(0);
  const lista = useRef<HTMLDivElement>(null);
  const panelCancha = useRef<HTMLElement>(null);
  const primeraVista = useRef(true);
  const filtradas = useMemo(() => buscarJugadas(jugadas, buscar, partido), [jugadas, buscar, partido]);
  const indiceJugada = filtradas.findIndex(j => j.acciones.some(a => a.id === seleccion));
  const pagina = Math.floor(Math.max(0, indiceJugada) / JUGADAS_POR_PAGINA);
  const paginas = Math.max(1, Math.ceil(filtradas.length / JUGADAS_POR_PAGINA));
  const visibles = filtradas.slice(pagina * JUGADAS_POR_PAGINA, (pagina + 1) * JUGADAS_POR_PAGINA);
  const indiceAccion = filas.findIndex(a => a.id === seleccion);
  const accion = filas[indiceAccion];
  const cuadro = cuadros.get(seleccion);
  const final = filas.at(-1)?.minuto ?? 0;
  const jugadaActual = jugadas.find(j => j.acciones.some(a => a.id === seleccion));
  const textoActual = useMemo(() => jugadaActual ? frasesDeJugada(partido, jugadaActual, cuadros, lengua, modo, estilo).find(f => f.accion.id === seleccion)?.texto ?? "" : "", [partido, jugadaActual, cuadros, lengua, modo, estilo, seleccion]);
  const avanzarReproduccion = useCallback((id: string) => { setBuscar(""); onSeleccion(id); }, [onSeleccion]);
  function seleccionar(id: string) { setRevisionManual(n => n + 1); onSeleccion(id); }

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const actualizar = () => setMovil(media.matches);
    actualizar(); media.addEventListener("change", actualizar);
    return () => media.removeEventListener("change", actualizar);
  }, []);

  useEffect(() => {
    // El diálogo del padre se abre en un efecto: medir después de showModal().
    const frame = requestAnimationFrame(() => {
      const cont = lista.current;
      if (!cont) return;
      const frase = cont.querySelector<HTMLElement>(`[data-relato-id="${seleccion}"]`);
      // Al entrar desde un gol, mostrar su elaboración desde el comienzo de la posesión.
      const destino = primeraVista.current ? frase?.closest<HTMLElement>("article") : frase;
      const mostrarIntroduccion = seleccion === filas[0]?.id;
      primeraVista.current = false;
      if (mostrarIntroduccion) cont.scrollTop = 0;
      else if (destino) cont.scrollTop = destino.getBoundingClientRect().top - cont.getBoundingClientRect().top + cont.scrollTop - 24;
      else cont.scrollTop = 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [pagina, seleccion, buscar, canchaVisible, lengua, estilo, filas]);

  useEffect(() => {
    if (!canchaVisible || !window.matchMedia("(max-width: 760px)").matches) return;
    const frame = requestAnimationFrame(() => panelCancha.current?.querySelector("svg")?.scrollIntoView({ block: "center" }));
    return () => cancelAnimationFrame(frame);
  }, [canchaVisible]);

  function cambiarPagina(n: number) {
    const id = filtradas[n * JUGADAS_POR_PAGINA]?.acciones[0]?.id;
    if (id) seleccionar(id);
  }
  function ir() {
    const n = Number(minuto);
    if (!minuto.trim() || !Number.isInteger(n) || n < 0 || n > final) return;
    const destino = filas.find(a => a.minuto >= n) ?? filas.at(-1);
    setBuscar("");
    if (destino) seleccionar(destino.id);
  }
  function moverAccion(delta: number) {
    const siguiente = filas[indiceAccion + delta];
    if (siguiente) { setBuscar(""); seleccionar(siguiente.id); }
  }

  return <section className="commentary-view" data-testid="commentary-view" aria-label={es ? "Relato por jugadas" : "Play-by-play commentary"}>
    <div className="commentary-toolbar">
      <label className="commentary-search">{es ? "Buscar jugador o equipo" : "Find a player or team"}
        <input type="search" value={buscar} placeholder={es ? "Nombre, receptor o rival…" : "Name, receiver or opponent…"} data-testid="commentary-search" onChange={e => {
          setBuscar(e.target.value);
          setRevisionManual(n => n + 1);
          const primera = buscarJugadas(jugadas, e.target.value, partido)[0]?.acciones[0];
          if (primera) onSeleccion(primera.id);
        }} />
      </label>
      <form className="full-match-jump" onSubmit={e => { e.preventDefault(); ir(); }}>
        <label htmlFor="commentary-minute">{es ? "Ir al minuto" : "Go to minute"}</label>
        <input id="commentary-minute" type="number" min={0} max={final} step={1} required value={minuto} onChange={e => setMinuto(e.target.value)} data-testid="commentary-minute" />
        <button type="submit" className="btn" data-testid="commentary-go">{es ? "Ir" : "Go"}</button>
      </form>
      <label className="commentary-style">{es ? "Estilo" : "Style"}<select value={estilo} onChange={e => setEstilo(e.target.value as EstiloRelato)} data-testid="commentary-style"><option value="fluido">{es ? "Fluido" : "Flowing"}</option><option value="detallado">{es ? "Detallado" : "Detailed"}</option></select></label>
      <button type="button" className="btn" onClick={() => onDescargar(estilo)} data-testid="download-commentary">{es ? "Descargar relato" : "Download commentary"}</button>
      <output className="caption" aria-live="polite" data-testid="commentary-count" data-total={filtradas.length}>{filtradas.length} {es ? "jugadas" : "sequences"} · {filtradas.reduce((n, j) => n + j.acciones.length, 0)} {es ? "acciones" : "actions"}</output>
    </div>
    <div className={`commentary-layout${canchaVisible ? " pitch-expanded" : ""}`}>
      <div className="commentary-story" ref={lista} data-testid="commentary-story">
        <p className="caption commentary-hint">{es ? "Pulsa una frase para seguir esa acción en la cancha. Cada jugada conserva todos sus registros. Izquierda y derecha desde el equipo que ataca." : "Select a sentence to follow that action on the pitch. Every sequence keeps all its records. Left and right are from the attacking team's perspective."}</p>
        {pagina === 0 && !buscar && <p className="commentary-lineups" data-testid="commentary-lineups">{introduccionFormaciones(partido, lengua)}</p>}
        {visibles.map(j => {
          const frases = frasesDeJugada(partido, j, cuadros, lengua, modo, estilo);
          const apoyo = j.acciones.map(a => cuadros.get(a.id)).find(c => c && c.apoyos.length > 0);
          return <article className="commentary-sequence" key={j.id} data-testid="commentary-sequence" data-sequence-id={j.id}>
            <header><span className="chip tnum">{fmtMinuto(j.desde)}{j.hasta !== j.desde ? `–${fmtMinuto(j.hasta)}` : ""} · {j.periodo}{es ? "T" : "H"}</span><strong>{partido.config[j.equipo].nombre}</strong><span className="caption">{j.acciones.length} {es ? "registros" : "records"}</span></header>
            {Array.from({ length: Math.ceil(frases.length / 5) }, (_, i) => <p key={i}>
              {frases.slice(i * 5, i * 5 + 5).map(f => <span key={f.accion.id}><button type="button" className="commentary-sentence" data-testid="commentary-sentence" data-relato-id={f.accion.id} aria-pressed={seleccion === f.accion.id} onClick={() => { seleccionar(f.accion.id); setCanchaVisible(true); }}>{f.texto}</button>{" "}</span>)}
            </p>)}
            {apoyo && <p className="commentary-support"><span className="chip">{es ? "Apoyos modelados" : "Modelled support"}</span>{" "}<button type="button" className="commentary-sentence" onClick={() => { seleccionar(apoyo.id); setCanchaVisible(true); }} data-testid="commentary-support">{textoApoyos(apoyo, partido, lengua)}</button></p>}
          </article>;
        })}
        {filtradas.length === 0 && <p className="full-match-empty">{es ? "No hay jugadas con ese nombre. Prueba otro jugador o equipo." : "No sequences match that name. Try another player or team."}</p>}
      </div>
      <aside ref={panelCancha} className={`commentary-pitch${canchaVisible ? " pitch-open" : ""}`} aria-label={es ? "Cancha de la acción seleccionada" : "Pitch for the selected action"}>
        <button type="button" className="btn commentary-pitch-toggle" aria-expanded={canchaVisible} onClick={() => setCanchaVisible(v => !v)} data-testid="commentary-pitch-toggle">{es ? (canchaVisible ? "← Volver al relato" : "Ver cancha de esta acción") : (canchaVisible ? "← Back to commentary" : "Show this action on pitch")}</button>
        {cuadro && accion && <>
          <div className="commentary-selected" aria-live="polite"><strong>{nombreAccion(accion, lengua)} · {fmtMinuto(accion.minuto)} · {cuadro.periodo}{es ? "T" : "H"}</strong><span className="caption" data-testid="commentary-selected-id">{es ? "Registro" : "Record"} {seleccion}</span></div>
          <p className="caption commentary-score" data-testid="commentary-running-score">{partido.config.local.nombre} <strong className="tnum">{accion.marcador.local}–{accion.marcador.visita}</strong> {partido.config.visita.nombre}</p>
          <ReproductorCancha key={`${lengua}:${estilo}:${revisionManual}`} partido={partido} filas={filas} jugadas={jugadas} cuadros={cuadros} seleccion={seleccion} texto={textoActual} lengua={lengua} visible={!movil || canchaVisible} onSeleccion={avanzarReproduccion} />
          <p className="commentary-record-detail" data-testid="commentary-record-detail"><span className="chip">{es ? "Dato registrado" : "Recorded action"}</span>{" "}{explicarAccion(accion, partido, lengua, modo)}</p>
          <div className="commentary-step">
            <button type="button" className="btn" disabled={indiceAccion <= 0} onClick={() => moverAccion(-1)} data-testid="commentary-action-previous">{es ? "← Acción anterior" : "← Previous action"}</button>
            <button type="button" className="btn" disabled={indiceAccion >= filas.length - 1} onClick={() => moverAccion(1)} data-testid="commentary-action-next">{es ? "Siguiente acción →" : "Next action →"}</button>
          </div>
          <p className="caption tactical-provenance" data-testid="tactical-provenance">{es ? "Cancha, direcciones y apoyos: reconstrucción esquemática. Dorsales, zonas, distancias y resultados: datos del registro." : "Pitch, directions and support runs: schematic reconstruction. Shirt numbers, zones, distances and outcomes: recorded data."}</p>
        </>}
      </aside>
    </div>
    <footer className="full-match-pages">
      <button type="button" className="btn" disabled={pagina === 0} onClick={() => cambiarPagina(0)} data-testid="commentary-first">{es ? "Inicio" : "First"}</button>
      <button type="button" className="btn" disabled={pagina === 0} onClick={() => cambiarPagina(pagina - 1)}>{es ? "Anterior" : "Previous"}</button>
      <span className="tnum" data-testid="commentary-page">{pagina + 1} / {paginas}</span>
      <button type="button" className="btn" disabled={pagina === paginas - 1} onClick={() => cambiarPagina(pagina + 1)} data-testid="commentary-next">{es ? "Siguiente" : "Next"}</button>
      <button type="button" className="btn" disabled={pagina === paginas - 1} onClick={() => cambiarPagina(paginas - 1)} data-testid="commentary-last">{es ? "Final" : "Last"}</button>
    </footer>
  </section>;
}
