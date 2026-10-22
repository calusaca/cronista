// Brief 050 v1.1 · Celebración visual del gol: realce del marcador y rótulo sobre la cancha.
// Solo depende del gol que devuelve `golEnCelebracion` sobre el cursor visible: sin temporizadores
// ni estado propio. El rótulo es estático en P1 (sin animación) y no lleva `role="status"`.
import type { ReactNode } from "react";
import type { EstadoArena, EventoArena, RegistroArena } from "../arena/tipos";
import { CANTO_GOL, IDENTIDAD_ARENA } from "../sim/limites";
import type { IdentidadPartido } from "../arena/identidad";
import { Escudo } from "./Escudo";

type Lado = "local" | "visita";

/** `.arena-score`: el texto de `strong` es exactamente `{local}–{visita}` y siguen los dos `span`.
 * Brief 055: con la identidad del partido, escudo (aria-hidden) a cada extremo: [⛨ LOCAL ★ · 0–1 · ★ VISITA ⛨]. */
export function ArenaMarcador({ registro, estado, gol, favorito = null, estrella, identidad }: {
  registro: RegistroArena; estado: Pick<EstadoArena, "marcador">; gol: EventoArena | null; favorito?: Lado | null; estrella?: (lado: Lado) => ReactNode; identidad?: IdentidadPartido;
}) {
  const nombres = registro.config.partido;
  return <div className="arena-score" data-gol={gol?.lado}>
    <span data-favorite={favorito === "local" || undefined}>{identidad && <Escudo identidad={identidad.local} size={IDENTIDAD_ARENA.escudoPx.marcador} />}{nombres.local.nombre}{estrella?.("local")}</span>
    <strong className="tnum">{estado.marcador.local}–{estado.marcador.visita}</strong>
    <span data-favorite={favorito === "visita" || undefined}>{estrella?.("visita")}{nombres.visita.nombre}{identidad && <Escudo identidad={identidad.visita} size={IDENTIDAD_ARENA.escudoPx.marcador} />}</span>
  </div>;
}

/** Rótulo del gol: palabra («Gol»/«Goal», o «Autogol»/«Own goal»), equipo beneficiado y jugador. */
export function ArenaRotuloGol({ registro, gol, idioma, identidad }: { registro: RegistroArena; gol: EventoArena | null; idioma: "es" | "en"; identidad?: IdentidadPartido }) {
  if (!gol) return null;
  const jugador = [...registro.inicial.jugadores, ...registro.inicial.banco ?? []].find(j => j.id === gol.jugador)?.nombre;
  const palabra = gol.autogol ? CANTO_GOL.plantillas.rotulo.autogol[idioma] : idioma === "es" ? "Gol" : "Goal";
  return <p className="arena-goal-banner" data-lado={gol.lado} aria-live="polite">
    {identidad && <Escudo identidad={identidad[gol.lado]} size={IDENTIDAD_ARENA.escudoPx.rotuloGol} />}<span className="arena-goal-word">{palabra}</span> {registro.config.partido[gol.lado].nombre}{jugador ? ` · ${jugador}` : ""}
  </p>;
}
