// Brief 050 v1.1 · Celebración visual del gol: realce del marcador y rótulo sobre la cancha.
// Solo depende del gol que devuelve `golEnCelebracion` sobre el cursor visible: sin temporizadores
// ni estado propio. El rótulo es estático en P1 (sin animación) y no lleva `role="status"`.
import type { ReactNode } from "react";
import type { EstadoArena, EventoArena, RegistroArena } from "../arena/tipos";
import { ARCO_3D, ARENA, CANTO_GOL, GOL_VISUAL, IDENTIDAD_ARENA } from "../sim/limites";
import { vistaArco } from "../arena/vista";
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

/** Brief 057 § 5.2 · Vista frontal del arco batido mientras dura la celebración (el gol de golEnCelebracion):
 * palos, travesaño y red esquemáticos (1 unidad = 0,1 m) y el balón entrando donde dice el registro. La
 * posición lateral es dato (`gol.hasta.y`); la altura es ilustrativa y se rotula. La entrada es la fase del
 * cursor (`tick`), nunca un temporizador; con movimiento reducido el balón ya está en su destino. */
export function ArenaVistaArco({ registro, gol, tick, idioma, identidad, reducido = false }: { registro: RegistroArena; gol: EventoArena | null; tick: number; idioma: "es" | "en"; identidad?: IdentidadPartido; reducido?: boolean }) {
  if (!gol) return null;
  const es = idioma === "es", t = (en: string, esp: string) => es ? esp : en;
  const v = vistaArco(registro, gol), V = GOL_VISUAL.vista;
  const linea = 42, semiancho = ARENA.arcoM / 2 * 10, alto = ARCO_3D.altoM * 10, travesano = linea - alto, llegada = linea - V.llegadaAltaM * 10;
  const u = reducido ? 1 : Math.min(1, Math.max(0, (tick - gol.tick) / (GOL_VISUAL.entradaRedS / ARENA.pasoS)));
  const destino = { cx: 50 + v.lateralM * 10, cy: linea - v.altura.metros * 10 };
  const cx = 50 + u * (destino.cx - 50), cy = llegada - u * (llegada - destino.cy), r = V.radioBalonM * 10 * (0.5 + 0.5 * u);
  const equipo = registro.config.partido[v.defiende].nombre;
  const banda = { raso: { es: "rasa", en: "low" }, media: { es: "media", en: "mid" }, alta: { es: "alta", en: "high" } }[v.altura.banda][idioma];
  const altura = v.altura.derivada ? t(`illustrative height (${banda})`, `altura ilustrativa (${banda})`) : t(`illustrative height (${banda}, no recorded distance)`, `altura ilustrativa (${banda}, sin distancia registrada)`);
  const lado = v.lateralM >= 0 ? t("right", "derecha") : t("left", "izquierda"), metros = Math.abs(v.lateralM).toFixed(1);
  const etiqueta = t(`Front view of ${equipo}'s goal: the ball goes in ${metros} m from the centre, to the viewer's ${lado}; ${altura}`, `Vista frontal del arco de ${equipo}: el balón entra a ${metros} m del centro, a la ${lado} del espectador; ${altura}`);
  return <figure className="arena-goal-view" data-testid="arena-goal-view" data-arco={v.defiende} data-altura={v.altura.banda} data-lado={gol.lado} data-autogol={gol.autogol || undefined}>
    <svg viewBox="0 0 100 46" role="img" aria-label={etiqueta}>
      <defs><pattern id="arena-goal-net" width="2" height="2" patternUnits="userSpaceOnUse"><path className="arena-goal-view-net" d="M2 0H0V2" fill="none" /></pattern></defs>
      <rect x={50 - semiancho} y={travesano} width={2 * semiancho} height={alto} fill="url(#arena-goal-net)" />
      <path className="arena-goal-view-posts" d={`M${50 - semiancho} ${linea}V${travesano}H${50 + semiancho}V${linea}`} fill="none" />
      <path className="arena-goal-view-line" d={`M4 ${linea}H96`} />
      <circle className="arena-goal-view-ball" cx={cx} cy={cy} r={r} />
    </svg>
    <figcaption>{gol.autogol && <>{CANTO_GOL.plantillas.rotulo.autogol[idioma]} · </>}<strong>{t("Goal view", "Vista del arco")}</strong> · {equipo} · {t("lateral from the record", "lateral del registro")} · {altura}</figcaption>
  </figure>;
}
