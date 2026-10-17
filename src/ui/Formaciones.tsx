"use client";

import { useState } from "react";
import type { Partido } from "../sim/tipos";
import type { CuadroTactico } from "../vista/tactica";
import type { LenguaXg } from "./textos";
import { CanchaTactica } from "./CanchaTactica";

export function Formaciones({ partido, inicial, actual, lengua }: { partido: Partido; inicial: CuadroTactico; actual: CuadroTactico; lengua: LenguaXg }) {
  const es = lengua === "es";
  const [enAccion, setEnAccion] = useState(false);
  const [resaltado, setResaltado] = useState<string | undefined>();
  const cuadro = enAccion ? actual : inicial;
  const posiciones = es ? { POR: "Portería", DEF: "Defensa", MED: "Mediocampo", DEL: "Delantera" } : { POR: "Goalkeeper", DEF: "Defence", MED: "Midfield", DEL: "Attack" };
  return <section className="formations-view" data-testid="formations-view" aria-label={es ? "Formaciones de los equipos" : "Team formations"}>
    <div className="formations-toolbar">
      <div className="lang-toggle" role="group" aria-label={es ? "Alineación" : "Line-up"}>
        <button type="button" aria-pressed={!enAccion} onClick={() => { setEnAccion(false); setResaltado(undefined); }} data-testid="formation-initial">{es ? "Inicial" : "Starting line-up"}</button>
        <button type="button" aria-pressed={enAccion} onClick={() => { setEnAccion(true); setResaltado(undefined); }} data-testid="formation-current">{es ? "Acción seleccionada" : "Selected action"}</button>
      </div>
      <span className="caption">{enAccion ? `${es ? "Acción" : "Action"} ${actual.id} · ${actual.periodo}${es ? "T" : "H"}` : es ? "Distribución inicial calculada de los titulares" : "Starting shape calculated from the starting players"}</span>
    </div>
    <p className="full-match-note">{es ? "Las líneas salen de los jugadores en cancha; los cambios y las expulsiones modifican la distribución. El dibujo muestra puestos esquemáticos, no posiciones medidas." : "The shape comes from the players on the pitch; substitutions and sendings-off change the distribution. The diagram shows schematic roles, not measured positions."}</p>
    <CanchaTactica cuadro={cuadro} partido={partido} lengua={lengua} formacion resaltado={resaltado} />
    <div className="formation-rosters">
      {(["local", "visita"] as const).map(lado => <section key={lado} className={`formation-roster tactical-${lado}`} data-testid={`formation-${lado}`}>
        <h3>{partido.config[lado].nombre} <span className="tnum" data-testid="formation-shape">{cuadro.formaciones[lado].esquema}</span></h3>
        <p className="caption">{cuadro.formaciones[lado].jugadores.length} {es ? "jugadores en cancha" : "players on the pitch"}{cuadro.formaciones[lado].porteros === 0 ? (es ? " · sin portero registrado" : " · no recorded goalkeeper") : ""}</p>
        {(["POR", "DEF", "MED", "DEL"] as const).map(pos => <div className="formation-line" key={pos}>
          <h4>{posiciones[pos]}</h4>
          {cuadro.formaciones[lado].jugadores.filter(j => j.posicion === pos).map(j => <button type="button" key={j.nombre} className="formation-person" aria-pressed={resaltado === j.nombre} onClick={() => setResaltado(j.nombre)} data-testid="formation-person" data-name={j.nombre} data-shirt={j.dorsal}>
            <span className="formation-number tnum">{j.dorsal}</span><span>{j.nombre}</span><span className="caption">{j.posicion}</span>
          </button>)}
        </div>)}
      </section>)}
    </div>
  </section>;
}
