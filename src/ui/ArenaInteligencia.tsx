"use client";

import { useState } from "react";
import { inteligenciaArena } from "../arena/inteligencia";
import { ARENA } from "../sim/limites";
import type { EstadoArena, RegistroArena } from "../arena/tipos";

export function ArenaInteligencia({ registro, estado, idioma, jugador, modoInicial = "fan" }: { registro: RegistroArena; estado: EstadoArena; idioma: "es" | "en"; jugador: string; modoInicial?: "fan" | "player" }) {
  const [modo, setModo] = useState<"fan" | "analyst" | "player">(modoInicial);
  const [evidencia, setEvidencia] = useState<string | null>(null);
  const es = idioma === "es", t = (en: string, esp: string) => es ? esp : en;
  const analisis = inteligenciaArena(registro, estado);
  const elegidos = analisis.hechos.filter(h => modo === "player" ? h.jugadores.includes(jugador) : modo === "analyst" || ["gol", "tiro", "atajada", "falta", "amarilla", "roja", "cambio", "plan_equipo"].includes(h.tipo));
  const hechos = (modo === "fan" && !elegidos.length ? analisis.hechos : elegidos).slice(-5);
  const plantilla = [...registro.inicial.jugadores, ...registro.inicial.banco ?? []];
  const nombre = plantilla.find(j => j.id === jugador)?.nombre ?? jugador;
  const prueba = evidencia ? analisis.hechos.find(h => h.eventos.includes(evidencia)) : undefined;
  return <section className="arena-intelligence" aria-label={t("Match intelligence", "Inteligencia del partido")} data-testid="arena-intelligence">
    <p className="overline">{t("Confirmed play · clickable evidence", "Jugadas confirmadas · evidencia consultable")}</p>
    <h2>{t("Understand this moment", "Entender este momento")}</h2>
    <div className="arena-intelligence-controls"><label>{t("Audience", "Audiencia")}<select className="field" value={modo} onChange={e => { setModo(e.target.value as typeof modo); setEvidencia(null); }}><option value="fan">{t("Fan", "Aficionado")}</option><option value="analyst">{t("Analyst", "Analista")}</option><option value="player">{t("Follow selected player", "Seguir al jugador seleccionado")}</option></select></label></div>
    {modo === "player" && <p><strong>{nombre}</strong> · {t("Select another player on the pitch or team list.", "Selecciona otro jugador en la cancha o en la plantilla.")}</p>}
    {modo === "analyst" && <>
      <p>{t(`Observed window: last ${analisis.ventanaS.toFixed(1)} simulated seconds.`, `Ventana observada: últimos ${analisis.ventanaS.toFixed(1)} segundos simulados.`)}</p>
      <table><thead><tr><th>{t("Team", "Equipo")}</th><th>{t("Passes received / attempted", "Pases recibidos / intentados")}</th><th>{t("Shots", "Tiros")}</th><th>{t("Energy", "Energía")}</th></tr></thead><tbody>{(["local", "visita"] as const).map(lado => <tr key={lado}><th>{registro.config.partido[lado].nombre}</th><td>{analisis.resumen[lado].recepciones} / {analisis.resumen[lado].pases}</td><td>{analisis.resumen[lado].tiros}</td><td>{Math.round(analisis.resumen[lado].energiaMedia * 100)}%</td></tr>)}</tbody></table>
      <details><summary>{t("Inspect the events behind these counts", "Consultar los eventos de estos conteos")}</summary>{analisis.fuentes.map(id => <button className="arena-evidence-link" key={id} onClick={() => setEvidencia(id)}>{id}</button>)}<p className="arena-muted">{t("Energy comes from the current engine state. A pass in flight remains an attempt.", "La energía procede del estado actual del motor. Un pase en vuelo sigue siendo un intento.")}</p></details>
    </>}
    {!hechos.length ? <p className="arena-empty">{t("Waiting for confirmed actions in this view.", "Esperando acciones confirmadas para esta vista.")}</p> : <ul>{hechos.map(h => <li key={h.id}><span>{es ? h.texto_es : h.texto_en}</span> <button className="arena-evidence-link" aria-label={`${t("Evidence for", "Evidencia de")} ${h.id}`} onClick={() => setEvidencia(h.eventos[0]!)}>{t("Evidence", "Evidencia")} · {(h.tick * ARENA.pasoS).toFixed(1)} s</button></li>)}</ul>}
    {prueba && <div className="arena-intelligence-evidence" data-testid="arena-intelligence-evidence"><strong>{prueba.eventos.join(" · ")}</strong><p>{es ? prueba.texto_es : prueba.texto_en}</p><p className="arena-muted">{t("Confirmed engine event. Coach explanations report their declared intent.", "Evento confirmado por el motor. Las explicaciones del entrenador recogen su intención declarada.")}</p></div>}
  </section>;
}
