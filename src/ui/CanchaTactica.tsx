"use client";

import { useId, useState } from "react";
import type { Partido } from "../sim/tipos";
import { sentidoAtaque, type CuadroTactico } from "../vista/tactica";
import type { LenguaXg } from "./textos";

export function CanchaTactica({ cuadro, partido, lengua, formacion = false, resaltado }: {
  cuadro: CuadroTactico; partido: Partido; lengua: LenguaXg; formacion?: boolean; resaltado?: string;
}) {
  const es = lengua === "es";
  const marker = `tactica-${useId().replace(/:/g, "")}`;
  const [antes, setAntes] = useState(false);
  const jugadores = antes ? cuadro.antes : cuadro.jugadores;
  const balon = antes ? cuadro.balon.desde : cuadro.balon.hasta;
  const actor = jugadores.find(j => j.nombre === cuadro.actor);
  return <figure className="tactical-board" data-testid="tactical-board" data-action-id={cuadro.id} data-period={cuadro.periodo}>
    <div className="tactical-directions">
      {(["local", "visita"] as const).map(lado => <span key={lado} className={`tactical-team tactical-${lado}`}>
        <strong>{partido.config[lado].nombre}</strong> <span className="tnum">{cuadro.formaciones[lado].esquema}</span>
        <span aria-label={es ? "Sentido de ataque" : "Attacking direction"}>{sentidoAtaque(lado, cuadro.periodo) === 1 ? " →" : " ←"}</span>
      </span>)}
    </div>
    <svg viewBox="-4 -4 113 76" role="img" aria-label={es ? `Cancha esquemática, ${cuadro.periodo}T. ${jugadores.length} jugadores. ${actor ? `${actor.nombre}, dorsal ${actor.dorsal}, participa en la acción.` : "Formaciones de los dos equipos."}` : `Schematic pitch, half ${cuadro.periodo}. ${jugadores.length} players. ${actor ? `${actor.nombre}, shirt ${actor.dorsal}, takes part in the action.` : "Both team formations."}`} data-testid="tactical-pitch">
      <defs><marker id={marker} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="currentColor" /></marker></defs>
      <g className="tactical-lines" fill="none" strokeWidth=".4">
        <rect x="0" y="0" width="105" height="68" rx=".5" /><path d="M52.5 0v68" /><circle cx="52.5" cy="34" r="9.15" />
        <path d="M0 13.84h16.5v40.32H0 M105 13.84H88.5v40.32H105 M0 24.84h5.5v18.32H0 M105 24.84h-5.5v18.32H105" />
        <path d="M0 30.34h-2v7.32h2 M105 30.34h2v7.32h-2" /><circle cx="11" cy="34" r=".5" /><circle cx="94" cy="34" r=".5" />
      </g>
      {!formacion && <g className="tactical-paths" fill="none" strokeWidth=".75" style={{ color: "var(--accent)" }}>
        {cuadro.apoyos.map(a => <path key={a.jugador.nombre} className="tactical-support" d={`M${a.desde.x} ${a.desde.y}L${a.hasta.x} ${a.hasta.y}`} markerEnd={`url(#${marker})`} data-testid="tactical-support" />)}
        <path d={`M${cuadro.balon.desde.x} ${cuadro.balon.desde.y}L${cuadro.balon.hasta.x} ${cuadro.balon.hasta.y}`} markerEnd={`url(#${marker})`} className="tactical-ball-path" strokeDasharray={cuadro.paseCompletado === false ? "2 1.5" : undefined} />
      </g>}
      {jugadores.map(j => <g key={`${j.lado}-${j.nombre}`} className={`tactical-player tactical-${j.lado}${j.nombre === (resaltado ?? cuadro.actor) ? " tactical-active" : ""}`} transform={`translate(${j.punto.x} ${j.punto.y})`} data-testid="tactical-player" data-name={j.nombre} data-shirt={j.dorsal} data-side={j.lado}>
        <title>{j.nombre} · #{j.dorsal} · {j.posicion}</title>
        {j.lado === "local" ? <circle r="2.65" /> : <rect x="-2.65" y="-2.65" width="5.3" height="5.3" rx=".7" />}
        <text textAnchor="middle" dominantBaseline="central" fontSize="3.1" fontWeight="700">{j.dorsal}</text>
      </g>)}
      {!formacion && (cuadro.paseCompletado !== false || antes) && <circle cx={balon.x + (balon.x > 101 ? -3 : 3)} cy={balon.y + (balon.y > 64 ? -2 : 2)} r="1.2" className="tactical-ball" data-testid="tactical-ball"><title>{es ? "Balón (esquema)" : "Ball (schematic)"}</title></circle>}
    </svg>
    <figcaption>
      {!formacion && <div className="tactical-phase" role="group" aria-label={es ? "Momento del esquema" : "Moment in schematic view"}>
        <button type="button" className="btn btn-quiet" aria-pressed={antes} onClick={() => setAntes(true)}>{es ? "Antes" : "Before"}</button>
        <button type="button" className="btn btn-quiet" aria-pressed={!antes} onClick={() => setAntes(false)}>{es ? "Después" : "After"}</button>
        <span className="caption">{actor ? `#${actor.dorsal} ${actor.nombre}` : es ? "Balón y distribución" : "Ball and team shape"}</span>
      </div>}
      <p className="caption">{es ? "Círculos: local · cuadrados: visitante. Izquierda/derecha desde el equipo que ataca; los arcos cambian en el 2T." : "Circles: home · squares: away. Left/right from the attacking team; ends switch in the second half."}</p>
      {!formacion && cuadro.paseCompletado === false && <p className="caption" data-testid="tactical-incomplete">{es ? "Pase incompleto: la flecha discontinua señala el destino intentado, sin atribuir la recepción." : "Incomplete pass: the dashed arrow shows the intended target, without claiming a reception."}</p>}
    </figcaption>
  </figure>;
}
