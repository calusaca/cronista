"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Partido } from "../sim/tipos";
import type { AccionCompleta } from "../vista/partido-completo";
import type { JugadaRelatada } from "../vista/relato";
import type { CuadroTactico } from "../vista/tactica";
import { duracionIlustrativa } from "../vista/reproduccion";
import type { LenguaXg } from "./textos";
import { CanchaTactica } from "./CanchaTactica";

export function ReproductorCancha({ partido, filas, jugadas, cuadros, seleccion, texto, lengua, visible, onSeleccion }: {
  partido: Partido; filas: AccionCompleta[]; jugadas: JugadaRelatada[]; cuadros: Map<string, CuadroTactico>;
  seleccion: string; texto: string; lengua: LenguaXg; visible: boolean; onSeleccion: (id: string) => void;
}) {
  const es = lengua === "es";
  const [reproduciendo, setReproduciendo] = useState(false);
  const [velocidad, setVelocidad] = useState(1);
  const [alcance, setAlcance] = useState("jugada");
  const [reducido, setReducido] = useState(false);
  const [momento, setMomento] = useState({ id: seleccion, t: 0 });
  const avanceEsperado = useRef<string | null>(null);
  const progresoRef = useRef({ id: seleccion, t: 0 });
  const cuadro = cuadros.get(seleccion);
  const jugada = useMemo(() => jugadas.find(j => j.acciones.some(a => a.id === seleccion)), [jugadas, seleccion]);
  const acciones = alcance === "partido" ? filas : jugada?.acciones ?? [];
  const indice = acciones.findIndex(a => a.id === seleccion);
  const siguiente = acciones[indice + 1]?.id;
  const progreso = momento.id === seleccion ? momento.t : 0;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const actualizar = () => setReducido(media.matches);
    actualizar(); media.addEventListener("change", actualizar);
    return () => media.removeEventListener("change", actualizar);
  }, []);

  useEffect(() => {
    if (avanceEsperado.current !== seleccion) setReproduciendo(false);
    avanceEsperado.current = null;
    progresoRef.current = { id: seleccion, t: 0 };
    setMomento({ id: seleccion, t: 0 });
  }, [seleccion]);

  useEffect(() => {
    const ocultar = () => { if (document.hidden) setReproduciendo(false); };
    document.addEventListener("visibilitychange", ocultar);
    if (!visible) setReproduciendo(false);
    return () => document.removeEventListener("visibilitychange", ocultar);
  }, [visible]);

  useEffect(() => {
    if (!reproduciendo || !visible || document.hidden) return;
    let frame = 0;
    const inicial = progresoRef.current.id === seleccion ? progresoRef.current.t : 0;
    let inicio: number | undefined;
    const duracion = duracionIlustrativa(texto) / velocidad;
    const actualizar = (ahora: number) => {
      inicio ??= ahora;
      const t = Math.min(1, inicial + (ahora - inicio) / duracion);
      progresoRef.current = { id: seleccion, t };
      setMomento({ id: seleccion, t });
      if (t < 1) frame = requestAnimationFrame(actualizar);
      else if (siguiente) { avanceEsperado.current = siguiente; onSeleccion(siguiente); }
      else setReproduciendo(false);
    };
    frame = requestAnimationFrame(actualizar);
    return () => cancelAnimationFrame(frame);
  }, [reproduciendo, visible, seleccion, siguiente, texto, velocidad, onSeleccion]);

  function situar(id: string, t: number) {
    setReproduciendo(false);
    progresoRef.current = { id, t }; setMomento({ id, t });
    if (id !== seleccion) onSeleccion(id);
  }
  function reproducir() {
    if (reproduciendo) { setReproduciendo(false); return; }
    if (progresoRef.current.t >= 1 && !siguiente && acciones[0]) {
      const id = acciones[0].id;
      avanceEsperado.current = id;
      progresoRef.current = { id, t: 0 }; setMomento({ id, t: 0 });
      if (id !== seleccion) onSeleccion(id);
    }
    setReproduciendo(true);
  }

  if (!cuadro) return null;
  return <div className="pitch-player" data-testid="pitch-player" data-playing={String(reproduciendo)} data-progress={progreso.toFixed(4)} data-action-id={seleccion}>
    <div className="pitch-player-controls" role="group" aria-label={es ? "Reproducción de la cancha" : "Pitch playback"}>
      <button type="button" className="btn" onClick={reproducir} data-testid="pitch-play" aria-pressed={reproduciendo}>{reproduciendo ? (es ? "Pausar" : "Pause") : alcance === "partido" ? (es ? "Reproducir partido" : "Play match") : (es ? "Reproducir jugada" : "Play sequence")}</button>
      <button type="button" className="btn btn-quiet" onClick={() => { const id = jugada?.acciones[0]?.id; if (id) situar(id, 0); }} data-testid="pitch-restart">{es ? "Reiniciar jugada" : "Restart sequence"}</button>
      <label>{es ? "Alcance" : "Scope"}<select value={alcance} onChange={e => { setReproduciendo(false); setAlcance(e.target.value); }} data-testid="pitch-scope"><option value="jugada">{es ? "Esta jugada" : "This sequence"}</option><option value="partido">{es ? "Todo el partido" : "Whole match"}</option></select></label>
      <label>{es ? "Velocidad" : "Speed"}<select value={velocidad} onChange={e => setVelocidad(Number(e.target.value))} data-testid="pitch-speed">{[.5, 1, 2].map(v => <option key={v} value={v}>{v}×</option>)}</select></label>
    </div>
    <CanchaTactica cuadro={cuadro} partido={partido} lengua={lengua} progreso={reducido ? (progreso === 0 ? 0 : 1) : progreso} onMomento={t => situar(seleccion, t)} />
    <progress value={progreso} max={1} aria-label={es ? "Progreso de la acción" : "Action progress"} />
    <p className="pitch-player-narration" data-testid="pitch-current-commentary">{texto}</p>
    <p className="caption pitch-player-note" data-testid="pitch-timing-note">{es ? "Ritmo ilustrativo de lectura. Movimiento reconstruido dentro de cada acción; puede haber cortes entre zonas." : "Illustrative reading pace. Reconstructed movement within each action; cuts may occur between zones."}{reducido ? (es ? " Movimiento reducido: se muestran pasos, sin interpolación." : " Reduced motion: steps are shown without interpolation.") : ""}</p>
  </div>;
}
