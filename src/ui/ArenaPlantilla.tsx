"use client";

import type { ReactNode } from "react";
import { etiquetaTemperamento, etiquetasPerfil } from "../arena/personalidades";
import type { EstadoArena, PersonalidadJugador, RegistroArena } from "../arena/tipos";
import { memoAgregado, type MemoAgregado } from "../arena/estadisticas";
import { ArenaCifrasJugador } from "./ArenaCifrasJugador";
import { EstrellaFavorito } from "./ArenaFavoritos";
import type { IdentidadPartido } from "../arena/identidad";
import { IDENTIDAD_ARENA } from "../sim/limites";
import { Escudo } from "./Escudo";

export function ArenaPlantilla({ estado, registro, seleccionado, seleccionar, idioma, tick, favorito, alternarFavorito, avisos, transporte = false, saltar, memo = memoAgregado, identidad }: {
  estado: EstadoArena; registro: RegistroArena; seleccionado: string | null;
  seleccionar: (id: string) => void; idioma: "es" | "en";
  /** Brief 049: tick entero del cursor (cifras del prefijo ≤ tick). */
  tick?: number;
  /** Brief 049: el jugador seleccionado es el favorito; la estrella lo alterna. */
  favorito?: boolean; alternarFavorito?: (j: { club: string; dorsal: number; nombre: string }) => void;
  avisos?: ReactNode; transporte?: boolean; saltar?: (s: number) => void; memo?: MemoAgregado;
  /** Brief 055: identidad del partido (escudos en los botones de equipo y en la ficha). */
  identidad?: IdentidadPartido;
}) {
  const es = idioma === "es", t = (en: string, esp: string) => es ? esp : en;
  const plantilla = [...estado.jugadores, ...estado.banco ?? [], ...estado.retirados ?? [], ...estado.expulsados ?? []];
  const j = plantilla.find(j => j.id === seleccionado) ?? estado.jugadores.find(j => j.lado === "local" && j.capitan) ?? estado.jugadores[0]!;
  const propios = estado.jugadores.filter(p => p.lado === j.lado);
  const p = j.personalidad;
  const rasgos: { clave: Exclude<keyof PersonalidadJugador, "perfil">; nombre: string; efecto: string }[] = [
    { clave: "defensiva", nombre: t("Defensive tendency", "Vocación defensiva"), efecto: t("Keeps support further back.", "Conserva apoyos más retrasados.") },
    { clave: "ofensiva", nombre: t("Attacking tendency", "Vocación ofensiva"), efecto: t("Advances support and favours forward passes.", "Adelanta apoyos y favorece pases hacia delante.") },
    { clave: "pase", nombre: t("Passing preference", "Preferencia de pase"), efecto: t("Favours passing and open passing lanes.", "Favorece pasar y buscar líneas despejadas.") },
    { clave: "conduccion", nombre: t("Carrying preference", "Preferencia de conducción"), efecto: t("Favours carrying over passing.", "Favorece conducir frente a pasar.") },
    { clave: "remate", nombre: t("Shooting preference", "Preferencia de remate"), efecto: t("Shoots from further out when a pass is available.", "Remata desde más lejos cuando también podría pasar.") },
    { clave: "agresividad", nombre: t("Aggression", "Agresividad"), efecto: estado.entrenadores ? t("More willing to press; close duels carry a higher foul risk.", "Más dispuesto a presionar; aumenta el riesgo de falta en duelos cercanos.") : t("Volunteers for pressure from further away; no fouls are simulated.", "Se ofrece a presionar desde más lejos; no se simulan faltas.") },
    { clave: "disciplina", nombre: t("Positional discipline", "Disciplina posicional"), efecto: t("Stays closer to the team's support positions.", "Mantiene mejor las referencias de apoyo del equipo.") },
    { clave: "compostura", nombre: t("Composure", "Compostura"), efecto: t("Favours shorter, more cautious passing options.", "Favorece opciones de pase más cortas y prudentes.") },
    { clave: "liderazgo", nombre: t("Leadership", "Liderazgo"), efecto: t("Selects the team's captain; does not add playing skill.", "Determina la capitanía; no añade habilidad de juego.") },
  ];
  return <section className="arena-rosters" aria-label={t("Squads and personalities", "Plantillas y personalidades")}>
    <div className="arena-roster-heading"><h2>{t("Meet the players", "Conoce a los jugadores")}</h2><p className="arena-muted">{t("Select a player on the pitch or in the squad to explore their profile.", "Selecciona un jugador en la cancha o en la plantilla para conocer su perfil.")}</p></div>
    <div className="arena-team-switch" role="group" aria-label={t("Choose a squad", "Elegir plantilla")}>
      {(["local", "visita"] as const).map(lado => <button key={lado} className="btn" type="button" aria-pressed={j.lado === lado} onClick={() => seleccionar((estado.jugadores.find(p => p.lado === lado && p.capitan) ?? estado.jugadores.find(p => p.lado === lado))!.id)}>{identidad && <Escudo identidad={identidad[lado]} size={IDENTIDAD_ARENA.escudoPx.plantilla} />}{registro.config.partido[lado].nombre}</button>)}
    </div>
    <div className="arena-roster-grid">
      <div><div className="arena-roster-list" role="group" aria-label={t("Players", "Jugadores")}>
        {propios.map(jugador => <button type="button" key={jugador.id} className={`arena-roster-person arena-roster-${jugador.lado}`} aria-pressed={jugador.id === j.id} onClick={() => seleccionar(jugador.id)} data-testid="arena-roster-person" data-person={jugador.id}>
          <span className="arena-shirt tnum">{jugador.dorsal}</span><span className="arena-person-name"><strong>{jugador.nombre}{jugador.capitan && <span className="arena-captain-badge" aria-label={t("Captain", "Capitán")}>C</span>}{!!jugador.amarillas && <span className="arena-yellow-badge" aria-label={t("Yellow card", "Tarjeta amarilla")}>▮</span>}</strong><span className="arena-muted">{jugador.puesto}{jugador.personalidad && ` · ${etiquetasPerfil[jugador.personalidad.perfil][idioma]}`}</span></span>
          <span className="arena-energy tnum" aria-label={`${t("Energy", "Energía")}: ${Math.round(jugador.energia * 100)}%`}>{Math.round(jugador.energia * 100)}%</span>
        </button>)}
      </div>{estado.banco && <div className="arena-bench"><h3>{t("Bench", "Suplentes")}</h3>{estado.banco.filter(p => p.lado === j.lado).map(p => <button type="button" key={p.id} className="arena-bench-person" aria-pressed={p.id === j.id} onClick={() => seleccionar(p.id)} data-testid="arena-bench-person">{p.dorsal} · {p.nombre}<span>{p.posicionNatural}</span></button>)}</div>}
      {!![...estado.retirados ?? [], ...estado.expulsados ?? []].filter(p => p.lado === j.lado).length && <details className="arena-departed"><summary>{t("Substituted / sent off", "Sustituidos / expulsados")}</summary>{[...estado.retirados ?? [], ...estado.expulsados ?? []].filter(p => p.lado === j.lado).map(p => <button type="button" key={p.id} className="arena-bench-person" onClick={() => seleccionar(p.id)}>{p.dorsal} · {p.nombre}<span>{estado.expulsados?.some(e => e.id === p.id) ? t("Sent off", "Expulsado") : t("Substituted", "Sustituido")}</span></button>)}</details>}
      </div>
      <section className="arena-player-card" data-testid="arena-player-card" data-favorite={favorito || undefined} aria-label={t("Selected player", "Jugador seleccionado")}>
        <p className="overline">{identidad && <><Escudo identidad={identidad[j.lado]} size={IDENTIDAD_ARENA.escudoPx.ficha} />{registro.config.partido[j.lado].nombre} · </>}{j.puesto} · {t("Shirt", "Dorsal")} {j.dorsal}</p>
        <div className="arena-player-title"><h3>{j.nombre}{j.capitan && <span className="arena-captain-badge">{t("Captain", "Capitán")}</span>}</h3>
          {alternarFavorito && <EstrellaFavorito activo={!!favorito} nombre={j.nombre} tipo="jugador" idioma={idioma} testId="arena-favorite-player" alternar={() => alternarFavorito({ club: registro.config.partido[j.lado].nombre, dorsal: j.dorsal, nombre: j.nombre })} />}</div>
        {avisos}
        {estado.banco && <p className="arena-muted">{estado.banco.some(p => p.id === j.id) ? t("Available substitute", "Suplente disponible") : estado.retirados?.some(p => p.id === j.id) ? t("Substituted — cannot return", "Sustituido — sin reingreso") : estado.expulsados?.some(p => p.id === j.id) ? t("Sent off — cannot be replaced", "Expulsado — no puede ser reemplazado") : t("On the pitch", "En cancha")}{j.posicionNatural ? ` · ${t("Natural role", "Puesto natural")}: ${j.posicionNatural}` : ""}{j.amarillas ? ` · ${j.amarillas} ${t("yellow card(s)", "amarilla(s)")}` : ""}</p>}
        {p && <p className="arena-profile-tags" data-testid="arena-profile-tags"><span>{etiquetasPerfil[p.perfil][idioma]}</span><span>{etiquetaTemperamento(p, idioma)}</span></p>}
        <dl className="arena-player-metrics"><div><dt>{t("Ability", "Nivel")}</dt><dd>{j.nivel}<small>/100</small></dd></div><div><dt>{t("Current energy", "Energía actual")}</dt><dd>{Math.round(j.energia * 100)}<small>%</small></dd></div></dl>
        {tick !== undefined && <ArenaCifrasJugador registro={registro} tick={tick} jugador={j} idioma={idioma} transporte={transporte} saltar={saltar} memo={memo} />}
        {p ? <>
          <p className="arena-muted">{t("Independent traits: a passer can be aggressive and captain. These synthetic preferences guide programmed decisions and local choices; model controllers receive them as context. Ability determines execution.", "Rasgos independientes: un pasador puede ser agresivo y capitán. Estas preferencias sintéticas orientan decisiones programadas y elecciones locales; los modelos las reciben como contexto. El nivel determina la capacidad de ejecución.")}</p>
          <div className="arena-traits">{rasgos.map(r => <div className="arena-trait" key={r.clave}>
            <label htmlFor={`rasgo-${j.id}-${r.clave}`}>{r.nombre}<span className="tnum">{p[r.clave]}</span></label><meter id={`rasgo-${j.id}-${r.clave}`} min="0" max="100" value={p[r.clave]} />
          </div>)}</div>
          <details className="arena-profile-help"><summary>{t("How traits affect decisions", "Cómo influyen los rasgos")}</summary><dl>{rasgos.map(r => <div key={r.clave}><dt>{r.nombre}</dt><dd>{r.efecto}</dd></div>)}</dl></details>
        </> : <p className="arena-muted" data-testid="arena-legacy-profile">{t("This archived v1 run does not contain personalities or captaincy.", "Esta grabación v1 no contiene personalidades ni capitanía.")}</p>}
      </section>
    </div>
  </section>;
}
