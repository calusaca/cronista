"use client";
// Brief 056 (v1.2) · Tarjeta de alineaciones antes del saque. Todo sale de `previaVisual(registro)`;
// el dibujo SVG es aria-hidden y la lista `ol` es la versión legible. Sin hex: los colores llegan por
// los tokens del 047/055 (camisetas con las reglas .arena-local/.arena-visita .arena-token > .arena-kit).
// Sin transition, animation ni transform CSS; la escala de la marca de capitán es un atributo SVG.
import { useLayoutEffect, useRef } from "react";
import { etiquetasEntrenador } from "../arena/entrenadores";
import type { IdentidadPartido } from "../arena/identidad";
import { etiquetasPerfil, etiquetaTemperamento } from "../arena/personalidades";
import type { FocoAntesala } from "../arena/antesala";
import { claveSuperficie, GEOMETRIA_PREVIA, mayusculaInicial, type PreviaVisual } from "../arena/previa";
import { ANTESALA_ARENA, ARENA, ATRIBUTOS_ARENA, ESTILO_JUEGO_ARENA, IDENTIDAD_ARENA, PREVIA_ARENA } from "../sim/limites";
import { rasgoDistintivo } from "../arena/atributos";
import { Escudo } from "./Escudo";

const T = PREVIA_ARENA.tarjeta;
const LADOS = ["local", "visita"] as const;

/** Cancha de la formación (§ 4.2 con la geometría de v1.2): portería propia abajo, solo dorsales (los nombres
 * van en la lista de texto) y profundidad estirada para que ninguna ficha toque a otra. */
function MediaCancha({ equipo, enVoz }: { equipo: PreviaVisual["equipos"]["local"]; enVoz: ReadonlySet<string> }) {
  const { ancho, escala, alto, lineaFondo: fondo } = GEOMETRIA_PREVIA;
  const rival = T.margenSuperior, medio = fondo - ARENA.largoM / 2 * escala;
  const areaAncho = ARENA.areaAnchoM, areaLargo = ARENA.areaLargoM * escala, chicaAncho = 18.32, chicaLargo = 5.5 * escala;
  return <svg className="arena-lineup-pitch" viewBox={`0 0 ${ancho} ${alto}`} aria-hidden="true" focusable="false">
    <rect className="arena-grass" x="0" y="0" width={ancho} height={alto} />
    <g className="arena-lines">
      <rect x="0" y={rival} width={ancho} height={fondo - rival} />
      <path d={`M0 ${medio}H${ancho}`} />
      <circle cx={ancho / 2} cy={medio} r={9.15 * escala} />
      <rect x={(ancho - areaAncho) / 2} y={fondo - areaLargo} width={areaAncho} height={areaLargo} />
      <rect x={(ancho - chicaAncho) / 2} y={fondo - chicaLargo} width={chicaAncho} height={chicaLargo} />
      <rect x={(ancho - areaAncho) / 2} y={rival} width={areaAncho} height={areaLargo} />
      <rect x={(ancho - chicaAncho) / 2} y={rival} width={chicaAncho} height={chicaLargo} />
      <circle className="arena-spot" cx={ancho / 2} cy={fondo - 11 * escala} r="0.35" />
      <circle className="arena-spot" cx={ancho / 2} cy={medio} r="0.35" />
    </g>
    {equipo.puestos.map(p => <g key={p.jugador.id} className="arena-lineup-slot" data-slot={p.puesto} data-lineup-player={p.jugador.id} data-speaking={enVoz.has(p.jugador.id) || undefined} transform={`translate(${p.x} ${p.y})`}>
      <g className="arena-token"><circle className="arena-kit" r={T.radioFicha} /><text textAnchor="middle" dominantBaseline="central" style={{ fontSize: T.fuenteDorsal }}>{p.jugador.dorsal}</text>
        {p.jugador.capitan && <g className="arena-captain-mark" transform={`scale(${T.escalaCapitan})`}><rect x="1.4" y="-3.3" width="2.5" height="2.5" rx="0.4" /><text x="2.65" y="-2" textAnchor="middle" dominantBaseline="central">C</text></g>}
      </g>
    </g>)}
  </svg>;
}

/** Brief 058 · C · Tira «En voz»: perfil previo de los jugadores que la antesala nombra ahora. Solo campos que existen
 * en `inicial` (dorsal, nombre, puesto, nivel; perfil y temperamento con `personalidad`; rol natural si difiere;
 * capitanía). Brief 063 § 9.1: tras el nivel, el rasgo distintivo de `config.atributos` si lo hay. No es región viva:
 * la voz ya informa y arena-buffer-status anuncia la fase. */
function TiraEnVoz({ previa, foco, idioma }: { previa: PreviaVisual; foco: FocoAntesala; idioma: "es" | "en" }) {
  const t = (en: string, es: string) => idioma === "es" ? es : en;
  if (!foco.lado || foco.bloque === "apertura") return null;
  const e = previa.equipos[foco.lado];
  const porId = new Map(e.puestos.map(p => [p.jugador.id, p.jugador]));
  const jugadores = foco.jugadores.map(id => porId.get(id)).filter(j => j !== undefined);
  return <div data-testid="arena-lineups-now" className="arena-lineups-now" data-side={foco.lado} data-block={foco.bloque}>
    <p className="arena-lineups-now-title"><span className="overline">{t("On air", "En voz")}</span> · {e.nombre} · {ANTESALA_ARENA.bloquesRotulo[idioma][foco.bloque]}</p>
    {jugadores.length > 0 && <ul className="arena-lineups-now-list">{jugadores.map(j => <li key={j.id} className="arena-lineups-now-row" data-jugador={j.id}>
      <span className="tnum" data-campo="dorsal">{j.dorsal}</span> <strong data-campo="nombre">{j.nombre}</strong> <span data-campo="puesto">{j.puesto}</span>
      {" · "}<span data-campo="nivel">{t(`Ability ${j.nivel}`, `Nivel ${j.nivel}`)}</span>
      {(() => { const r = e.atributos?.[j.id] ? rasgoDistintivo(e.atributos[j.id]!) : null; return r && <>{" · "}<span data-campo="rasgo">{ATRIBUTOS_ARENA.rasgos[idioma][r.atributo]} {r.valor}</span></>; })()}
      {j.personalidad && <>{" · "}<span data-campo="perfil">{etiquetasPerfil[j.personalidad.perfil][idioma]}</span>{" · "}<span data-campo="temperamento">{etiquetaTemperamento(j.personalidad, idioma)}</span></>}
      {j.posicionNatural && j.posicionNatural !== j.puesto && <>{" · "}<span data-campo="rol-natural">{t(`Natural role: ${j.posicionNatural}`, `Rol natural: ${j.posicionNatural}`)}</span></>}
      {j.capitan && <>{" · "}<span data-campo="capitan">{t("Captain", "Capitán")}</span></>}
    </li>)}</ul>}
    <p className="arena-muted arena-lineups-now-note">{t("Pre-match profile: synthetic indices from the record; no match statistics yet.", "Perfil previo: índices sintéticos del registro; aún no hay estadísticas de juego.")}</p>
  </div>;
}

export function ArenaPrevia({ previa, identidad, idioma, plegada, alternar, seleccionado, seleccionar, foco = null }: {
  previa: PreviaVisual; identidad: IdentidadPartido; idioma: "es" | "en"; plegada: boolean; alternar: () => void;
  seleccionado: string | null; seleccionar: (id: string) => void;
  /** Brief 058 · C: clip de la antesala que suena ahora (null fuera de la antesala o entre clips). */
  foco?: FocoAntesala | null;
}) {
  const enVoz = new Set(foco?.jugadores ?? []);
  const t = (en: string, es: string) => idioma === "es" ? es : en;
  const textos = PREVIA_ARENA.textos;
  const raiz = useRef<HTMLElement>(null);
  // v1.1 § 12 · Al desmontarse (el cursor salió del tick 0) con el foco dentro, el foco pasa al primer
  // jugador de la cancha principal o, si no hay, a #arena-watch; nunca queda en <body>. Se hace en la
  // limpieza de useLayoutEffect, que corre antes de retirar el DOM.
  useLayoutEffect(() => {
    const nodo = raiz.current;
    return () => {
      if (!nodo || !nodo.contains(document.activeElement)) return;
      const destino = document.querySelector<SVGGElement>(".arena-pitch-wrap .arena-player") ?? document.getElementById("arena-watch");
      destino?.focus({ preventScroll: true });
    };
  }, []);
  const c = previa.condiciones;
  const chips: string[] = [];
  if (c) {
    chips.push(`${textos.clima[idioma][c.clima]}${c.temperaturaC !== undefined ? ` · ${c.temperaturaC} °C` : ""}`);
    chips.push(mayusculaInicial(textos.superficie[idioma][claveSuperficie(c)]));
  }
  if (previa.arbitro) chips.push(`${t("Referee", "Árbitro")}: ${previa.arbitro}`);
  return <section ref={raiz} className="arena-lineups" data-testid="arena-lineups" aria-labelledby="arena-lineups-title" data-collapsed={plegada || undefined}>
    <div className="arena-lineups-head">
      <h2 id="arena-lineups-title">{t("Starting line-ups", "Alineaciones")}</h2>
      {chips.length > 0 && <p className="arena-lineups-conditions">{chips.map(ch => <span className="arena-lineup-chip" key={ch}>{ch}</span>)}</p>}
      {foco && <TiraEnVoz previa={previa} foco={foco} idioma={idioma} />}
      <button type="button" className="btn" data-testid="arena-lineups-toggle" aria-expanded={!plegada} aria-controls="arena-lineups-body" onClick={alternar}>{plegada ? t("Show line-ups", "Mostrar alineaciones") : t("Hide line-ups", "Ocultar alineaciones")}</button>
    </div>
    <div className="arena-lineups-grid" id="arena-lineups-body" hidden={plegada}>
      {LADOS.map(lado => {
        const e = previa.equipos[lado];
        return <article className={`arena-lineup arena-${lado}`} data-testid="arena-lineup" data-side={lado} key={lado} data-speaking={foco?.lado === lado && foco.bloque === "cabecera" || undefined}>
          <div className="arena-lineup-head"><Escudo identidad={identidad[lado]} size={IDENTIDAD_ARENA.escudoPx.plan} /><h3>{e.nombre}</h3><span className="arena-lineup-shape tnum">{e.formacion}</span></div>
          {/* Brief 063 § 9.3 (reinicios-v8): la identidad de juego del club, de `config.estilosJuego`; la descripción es texto
              legible en un <details>, no solo un title. */}
          {e.estiloJuego && <div className="arena-lineup-identity">
            <p className="arena-lineup-identity-pill"><span className="arena-lineup-chip" data-testid="arena-lineup-identity" data-estilo={e.estiloJuego}>{t("Identity", "Identidad")}: {ESTILO_JUEGO_ARENA.etiquetas[idioma][e.estiloJuego]}</span></p>
            <details className="arena-lineup-identity-details" data-testid="arena-lineup-identity-details"><summary>{t("What this identity changes", "Qué cambia esta identidad")}</summary>
              <p>{ESTILO_JUEGO_ARENA.descripciones[idioma][e.estiloJuego]}</p>
              <p className="arena-muted">{t("Derived from the club name, so it is the same in every match. It adds to the coach's plan and to the simulator's style, which may contradict it.", "Se deriva del nombre del club, así que es la misma en todos sus partidos. Se suma al plan del entrenador y al estilo del simulador, que pueden contradecirla.")}</p>
            </details>
          </div>}
          <MediaCancha equipo={e} enVoz={foco?.lado === lado ? enVoz : new Set()} />
          <ol className="arena-lineup-list">{e.puestos.map(p => <li key={p.jugador.id}>
            <button type="button" className="arena-lineup-player" data-testid="arena-lineup-player" data-lineup-player={p.jugador.id} data-speaking={foco?.lado === lado && enVoz.has(p.jugador.id) || undefined} aria-pressed={seleccionado === p.jugador.id} onClick={() => seleccionar(p.jugador.id)}>
              <span className="tnum">{p.jugador.dorsal}</span>{" "}<strong>{p.jugador.nombre}</strong>{" "}<span className="arena-muted">{p.puesto}{p.jugador.capitan ? ` · ${t("Captain", "Capitán")}` : ""}</span>
            </button></li>)}</ol>
          {e.entrenador && <p className="arena-lineup-coach" data-speaking={foco?.lado === lado && foco.bloque === "arriba" && foco.entrenador || undefined}><span className="overline">{t("Coach", "DT")}</span> {e.entrenador.nombre} · {etiquetasEntrenador[e.entrenador.perfil][idioma]}{e.entrenador.preferidas.length > 1 && ` · ${t("Prefers", "Prefiere")} ${e.entrenador.preferidas.join(", ")}`}</p>}
          <p className="arena-lineup-traits"><span className="overline">{t("Key traits", "Rasgos")}</span> {t("Average ability", "Nivel medio")} {e.nivelMedio} · {t("Attack", "Ataque")} {e.ataque} · {t("Defence", "Defensa")} {e.defensa} · {textos.estilo[idioma][e.estilo]}{e.perfiles.slice(0, T.maxPerfilesMostrados).map(p => ` · ${etiquetasPerfil[p.perfil][idioma]} ×${p.n}`).join("")}</p>
          {e.banco.length > 0 && <details className="arena-lineup-bench"><summary>{t(`Bench (${e.banco.length})`, `Suplentes (${e.banco.length})`)}</summary><ul>{e.banco.map(j => <li key={j.id}>
            <button type="button" className="arena-lineup-player" data-lineup-player={j.id} onClick={() => seleccionar(j.id)}>{j.dorsal} · {j.nombre}{j.posicionNatural ? " " : ""}<span className="arena-muted">{j.posicionNatural ?? ""}</span></button></li>)}</ul></details>}
        </article>;
      })}
    </div>
    <p className="arena-muted arena-lineups-note">{t("Synthetic indices from the match run (1–100); fictional clubs and players.", "Índices sintéticos del registro (1–100); clubes y jugadores ficticios.")}</p>
  </section>;
}
