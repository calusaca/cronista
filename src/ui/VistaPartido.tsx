"use client";
// Vista de partido (brief 004): línea de tiempo a la izquierda, crónica a la derecha, y la
// interacción estrella en los dos sentidos — oración → eventos que la respaldan (resaltado
// persistente al clic, transitorio al pasar el mouse, scroll al primero) y evento →
// oraciones que lo citan. Las capas: Caja de cristal (006), proceso, y el gol.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Evento } from "../sim/tipos";
import { eventosDeOracion, oracionesDeEvento } from "../vista/evidencia";
import type { DatosPartido } from "../vista/servidor";
import { HistoriaFrase, Proceso } from "./CajaDeCristal";
import { Cronica, type Lengua, type ModoRender } from "./Cronica";
import { TarjetaGol } from "./Gol";
import { Linea } from "./Linea";

type Capa = { tipo: "historia"; i: number } | { tipo: "proceso" } | { tipo: "gol"; id: string } | null;

const ESTILO: Record<string, string> = { posesion: "possession", contragolpe: "counter-attack", presion: "pressing" };

export function VistaPartido({ datos, etiqueta, modo = "aficionado" }: { datos: DatosPartido; etiqueta: string; modo?: ModoRender }) {
  const { cronica, hechos, eventos, local, visita } = datos;
  const [lengua, setLengua] = useState<Lengua>("es");
  const [oracionSel, setOracionSel] = useState<number | null>(null);
  const [oracionHover, setOracionHover] = useState<number | null>(null);
  const [eventoSel, setEventoSel] = useState<string | null>(null);
  const [capa, setCapa] = useState<Capa>(null);
  const linea = useRef<HTMLDivElement | null>(null);

  const eventosResaltados = useMemo(() => {
    if (oracionSel !== null) return new Set(eventosDeOracion(cronica, hechos, oracionSel));
    if (eventoSel) return new Set([eventoSel]);
    return new Set<string>();
  }, [cronica, hechos, oracionSel, eventoSel]);

  const eventosHover = useMemo(
    () => (oracionHover !== null && oracionHover !== oracionSel ? new Set(eventosDeOracion(cronica, hechos, oracionHover)) : new Set<string>()),
    [cronica, hechos, oracionHover, oracionSel],
  );

  const oracionesResaltadas = useMemo(() => {
    if (eventoSel) return new Set(oracionesDeEvento(cronica, hechos, eventoSel));
    if (oracionSel !== null) return new Set([oracionSel]);
    return new Set<number>();
  }, [cronica, hechos, eventoSel, oracionSel]);

  // Scroll al primer evento resaltado, DENTRO de la línea de tiempo (sin mover la página).
  useEffect(() => {
    if (oracionSel === null) return;
    const primero = eventosDeOracion(cronica, hechos, oracionSel)[0];
    const cont = linea.current;
    if (!primero || !cont) return;
    const fila = cont.querySelector<HTMLElement>(`[data-event-id="${primero}"]`);
    if (fila) cont.scrollTo({ top: Math.max(0, fila.offsetTop - cont.clientHeight / 3), behavior: "smooth" });
  }, [oracionSel, cronica, hechos]);

  // Escape cierra la capa abierta.
  useEffect(() => {
    const cerrar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCapa(null);
    };
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, []);

  const alOracion = useCallback((i: number) => {
    setEventoSel(null);
    setOracionSel((prev) => (prev === i ? null : i));
  }, []);

  const alEvento = useCallback((e: Evento) => {
    setOracionSel(null);
    setEventoSel((prev) => (prev === e.id && e.tipo !== "gol" ? null : e.id));
    if (e.tipo === "gol") setCapa({ tipo: "gol", id: e.id });
  }, []);

  const final = hechos.find((h) => h.tipo === "resultado_final")?.datos;

  return (
    <div data-testid="match-view" data-seed={datos.seed}>
      <header className="match-head">
        <div className="overline tnum">
          {etiqueta} · Seed {datos.seed} · Simulated match
        </div>
        <div className="scoreline">
          <div className="team home">
            {local.nombre}
            <span className="team-meta tnum">
              Home · {ESTILO[local.estilo]} · ATT {local.ataque} · DEF {local.defensa}
            </span>
          </div>
          <div className="score tnum" data-testid="final-score">
            {String(final?.goles_local ?? 0)}
            <span className="score-sep">–</span>
            {String(final?.goles_visita ?? 0)}
          </div>
          <div className="team">
            {visita.nombre}
            <span className="team-meta tnum">
              Away · {ESTILO[visita.estilo]} · ATT {visita.ataque} · DEF {visita.defensa}
            </span>
          </div>
        </div>
      </header>

      <div className="panels">
        <section className="panel" aria-label="Match timeline">
          <div className="panel-head">
            <span className="overline">Timeline · every event of the match</span>
            {(oracionSel !== null || eventoSel) && (
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => {
                  setOracionSel(null);
                  setEventoSel(null);
                }}
              >
                Clear selection
              </button>
            )}
          </div>
          <Linea
            eventos={eventos}
            local={local.nombre}
            visita={visita.nombre}
            resaltados={eventosResaltados}
            hover={eventosHover}
            seleccionado={eventoSel}
            onEvento={alEvento}
            contenedor={linea}
          />
        </section>
        <section className="panel" aria-label="Match report">
          <Cronica
            cronica={cronica}
            modo={modo}
            lengua={lengua}
            onLengua={setLengua}
            resaltadas={oracionesResaltadas}
            seleccionada={oracionSel}
            onOracion={alOracion}
            onHover={setOracionHover}
            onHistoria={(i) => setCapa({ tipo: "historia", i })}
            onProceso={() => setCapa({ tipo: "proceso" })}
          />
        </section>
      </div>

      {capa?.tipo === "historia" && <HistoriaFrase cronica={cronica} i={capa.i} lengua={lengua} onCerrar={() => setCapa(null)} />}
      {capa?.tipo === "proceso" && <Proceso cronica={cronica} lengua={lengua} onCerrar={() => setCapa(null)} />}
      {capa?.tipo === "gol" && (
        <TarjetaGol eventos={eventos} golId={capa.id} citas={oracionesDeEvento(cronica, hechos, capa.id).length} onCerrar={() => setCapa(null)} />
      )}
    </div>
  );
}
