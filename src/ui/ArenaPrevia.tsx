"use client";
// Brief 056 (v1.2) · Tarjeta de alineaciones antes del saque. Todo sale de `previaVisual(registro)`;
// el dibujo SVG es aria-hidden y la lista `ol` es la versión legible. Sin hex: los colores llegan por
// los tokens del 047/055 (camisetas con las reglas .arena-local/.arena-visita .arena-token > .arena-kit).
// Sin transition, animation ni transform CSS; la escala de la marca de capitán es un atributo SVG.
import { useLayoutEffect, useRef } from "react";
import { etiquetasEntrenador } from "../arena/entrenadores";
import type { IdentidadPartido } from "../arena/identidad";
import { etiquetasPerfil } from "../arena/personalidades";
import { claveSuperficie, GEOMETRIA_PREVIA, mayusculaInicial, type PreviaVisual } from "../arena/previa";
import { ARENA, IDENTIDAD_ARENA, PREVIA_ARENA } from "../sim/limites";
import { Escudo } from "./Escudo";

const T = PREVIA_ARENA.tarjeta;
const LADOS = ["local", "visita"] as const;

/** Cancha de la formación (§ 4.2 con la geometría de v1.2): portería propia abajo, solo dorsales (los nombres
 * van en la lista de texto) y profundidad estirada para que ninguna ficha toque a otra. */
function MediaCancha({ equipo }: { equipo: PreviaVisual["equipos"]["local"] }) {
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
    {equipo.puestos.map(p => <g key={p.jugador.id} className="arena-lineup-slot" data-slot={p.puesto} data-lineup-player={p.jugador.id} transform={`translate(${p.x} ${p.y})`}>
      <g className="arena-token"><circle className="arena-kit" r={T.radioFicha} /><text textAnchor="middle" dominantBaseline="central" style={{ fontSize: T.fuenteDorsal }}>{p.jugador.dorsal}</text>
        {p.jugador.capitan && <g className="arena-captain-mark" transform={`scale(${T.escalaCapitan})`}><rect x="1.4" y="-3.3" width="2.5" height="2.5" rx="0.4" /><text x="2.65" y="-2" textAnchor="middle" dominantBaseline="central">C</text></g>}
      </g>
    </g>)}
  </svg>;
}

export function ArenaPrevia({ previa, identidad, idioma, plegada, alternar, seleccionado, seleccionar }: {
  previa: PreviaVisual; identidad: IdentidadPartido; idioma: "es" | "en"; plegada: boolean; alternar: () => void;
  seleccionado: string | null; seleccionar: (id: string) => void;
}) {
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
      <button type="button" className="btn" data-testid="arena-lineups-toggle" aria-expanded={!plegada} aria-controls="arena-lineups-body" onClick={alternar}>{plegada ? t("Show line-ups", "Mostrar alineaciones") : t("Hide line-ups", "Ocultar alineaciones")}</button>
    </div>
    <div className="arena-lineups-grid" id="arena-lineups-body" hidden={plegada}>
      {LADOS.map(lado => {
        const e = previa.equipos[lado];
        return <article className={`arena-lineup arena-${lado}`} data-testid="arena-lineup" data-side={lado} key={lado}>
          <div className="arena-lineup-head"><Escudo identidad={identidad[lado]} size={IDENTIDAD_ARENA.escudoPx.plan} /><h3>{e.nombre}</h3><span className="arena-lineup-shape tnum">{e.formacion}</span></div>
          <MediaCancha equipo={e} />
          <ol className="arena-lineup-list">{e.puestos.map(p => <li key={p.jugador.id}>
            <button type="button" className="arena-lineup-player" data-testid="arena-lineup-player" data-lineup-player={p.jugador.id} aria-pressed={seleccionado === p.jugador.id} onClick={() => seleccionar(p.jugador.id)}>
              <span className="tnum">{p.jugador.dorsal}</span>{" "}<strong>{p.jugador.nombre}</strong>{" "}<span className="arena-muted">{p.puesto}{p.jugador.capitan ? ` · ${t("Captain", "Capitán")}` : ""}</span>
            </button></li>)}</ol>
          {e.entrenador && <p className="arena-lineup-coach"><span className="overline">{t("Coach", "DT")}</span> {e.entrenador.nombre} · {etiquetasEntrenador[e.entrenador.perfil][idioma]}{e.entrenador.preferidas.length > 1 && ` · ${t("Prefers", "Prefiere")} ${e.entrenador.preferidas.join(", ")}`}</p>}
          <p className="arena-lineup-traits"><span className="overline">{t("Key traits", "Rasgos")}</span> {t("Average ability", "Nivel medio")} {e.nivelMedio} · {t("Attack", "Ataque")} {e.ataque} · {t("Defence", "Defensa")} {e.defensa} · {textos.estilo[idioma][e.estilo]}{e.perfiles.slice(0, T.maxPerfilesMostrados).map(p => ` · ${etiquetasPerfil[p.perfil][idioma]} ×${p.n}`).join("")}</p>
          {e.banco.length > 0 && <details className="arena-lineup-bench"><summary>{t(`Bench (${e.banco.length})`, `Suplentes (${e.banco.length})`)}</summary><ul>{e.banco.map(j => <li key={j.id}>
            <button type="button" className="arena-lineup-player" data-lineup-player={j.id} onClick={() => seleccionar(j.id)}>{j.dorsal} · {j.nombre}{j.posicionNatural ? " " : ""}<span className="arena-muted">{j.posicionNatural ?? ""}</span></button></li>)}</ul></details>}
        </article>;
      })}
    </div>
    <p className="arena-muted arena-lineups-note">{t("Synthetic indices from the match run (1–100); fictional clubs and players.", "Índices sintéticos del registro (1–100); clubes y jugadores ficticios.")}</p>
  </section>;
}
