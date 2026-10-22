// Brief 050 v1.1 · Celebración visual del gol: realce del marcador y rótulo sobre la cancha.
// Solo depende del gol que devuelve `golEnCelebracion` sobre el cursor visible: sin temporizadores
// ni estado propio. El rótulo es estático en P1 (sin animación) y no lleva `role="status"`.
import type { ReactNode } from "react";
import type { EstadoArena, EventoArena, RegistroArena } from "../arena/tipos";
import { CANTO_GOL } from "../sim/limites";

type Lado = "local" | "visita";

/** `.arena-score`: el texto de `strong` es exactamente `{local}–{visita}` y siguen los dos `span`. */
export function ArenaMarcador({ registro, estado, gol, favorito = null, estrella }: {
  registro: RegistroArena; estado: Pick<EstadoArena, "marcador">; gol: EventoArena | null; favorito?: Lado | null; estrella?: (lado: Lado) => ReactNode;
}) {
  const nombres = registro.config.partido;
  return <div className="arena-score" data-gol={gol?.lado}>
    <span data-favorite={favorito === "local" || undefined}>{nombres.local.nombre}{estrella?.("local")}</span>
    <strong className="tnum">{estado.marcador.local}–{estado.marcador.visita}</strong>
    <span data-favorite={favorito === "visita" || undefined}>{nombres.visita.nombre}{estrella?.("visita")}</span>
  </div>;
}

/** Rótulo del gol: palabra («Gol»/«Goal», o «Autogol»/«Own goal»), equipo beneficiado y jugador. */
export function ArenaRotuloGol({ registro, gol, idioma }: { registro: RegistroArena; gol: EventoArena | null; idioma: "es" | "en" }) {
  if (!gol) return null;
  const jugador = [...registro.inicial.jugadores, ...registro.inicial.banco ?? []].find(j => j.id === gol.jugador)?.nombre;
  const palabra = gol.autogol ? CANTO_GOL.plantillas.rotulo.autogol[idioma] : idioma === "es" ? "Gol" : "Goal";
  return <p className="arena-goal-banner" data-lado={gol.lado} aria-live="polite">
    <span className="arena-goal-word">{palabra}</span> {registro.config.partido[gol.lado].nombre}{jugador ? ` · ${jugador}` : ""}
  </p>;
}
