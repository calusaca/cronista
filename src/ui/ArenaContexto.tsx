"use client";

import { etiquetasEntrenador } from "../arena/entrenadores";
import { efectosEntorno, resumir } from "../arena/entorno";
import { ARENA, TECNICA_ARENA } from "../sim/limites";
import { explicarMotivo } from "../arena/vista";
import type { EntrenadorArena, EstadoArena, RegistroArena } from "../arena/tipos";

export function ArenaContexto({ registro, estado, idioma, seleccionar, saltar }: { registro: RegistroArena; estado: EstadoArena; idioma: "es" | "en"; seleccionar: (id: string) => void; saltar: (segundos: number) => void }) {
  if (!estado.entrenadores) return null;
  const es = idioma === "es", t = (en: string, esp: string) => es ? esp : en;
  const c = registro.config.partido.condiciones!;
  const resumen = resumir(estado, registro.eventos, TECNICA_ARENA.ventanaMemoriaS);
  const climas = { despejado: t("Clear skies", "Despejado"), calor: t("Heat", "Calor"), lluvia: t("Rain", "Lluvia"), frio: t("Cold", "Frío"), niebla: t("Fog", "Niebla") };
  const mentalidades = { conservar: t("Protect the lead", "Conservar"), equilibrar: t("Balanced", "Equilibrar"), buscar: t("Push forward", "Buscar el gol") };
  const bloques = { bajo: t("Low", "Bajo"), medio: t("Mid", "Medio"), alto: t("High", "Alto") };
  const ritmos = { pausado: t("Measured", "Pausado"), normal: "Normal", alto: t("High", "Alto") };
  const reacciones = { atencion: t("Watching", "Atenta"), aliento: t("Backing the team", "Aliento"), rugido: t("Roaring", "Rugido"), silbidos: t("Whistling", "Silbidos"), silencio: t("Silent", "Silencio") };
  const atributos: { clave: Exclude<keyof EntrenadorArena, "nombre" | "perfil" | "preferidas">; etiqueta: string }[] = [
    { clave: "ofensiva", etiqueta: t("Attacking intent", "Vocación ofensiva") }, { clave: "defensiva", etiqueta: t("Defensive protection", "Resguardo defensivo") },
    { clave: "presion", etiqueta: t("Pressing", "Presión") }, { clave: "verticalidad", etiqueta: t("Directness", "Verticalidad") },
    { clave: "amplitud", etiqueta: t("Width", "Amplitud") }, { clave: "riesgo", etiqueta: t("Risk", "Riesgo") },
    { clave: "adaptabilidad", etiqueta: t("Adaptability", "Adaptabilidad") }, { clave: "paciencia", etiqueta: t("Patience", "Paciencia") },
    { clave: "rotacion", etiqueta: t("Rotation", "Rotación") }, { clave: "serenidad", etiqueta: t("Composure", "Serenidad") },
  ];
  return <section className="arena-context" aria-label={t("Coaches and match conditions", "Entrenadores y condiciones")} data-testid="arena-context">
    <h2>{t("The people and conditions behind the match", "Las personas y condiciones del encuentro")}</h2>
    <div className="arena-environment" data-testid="arena-environment"><div><span className="overline">{t("Weather", "Clima")}</span><strong>{climas[c.clima]}{c.temperaturaC !== undefined ? ` · ${c.temperaturaC} °C` : ""}</strong></div><div><span className="overline">{t("Pitch", "Cancha")}</span><strong>{c.superficie === "sintetica" ? t("Artificial surface", "Superficie sintética") : c.cesped === "alto" ? t("Long natural grass", "Césped natural alto") : t("Short natural grass", "Césped natural corto")}</strong></div><div><span className="overline">{t("Scale", "Escala")}</span><strong>105 × 68 m</strong><span className="arena-muted">{t("Short experimental encounter", "Encuentro experimental corto")}</span></div></div>
    <details className="arena-environment-effects"><summary>{t("What these conditions change", "Qué cambian estas condiciones")}</summary>
      <p className="arena-muted">{t("Programmed modifiers, not proof that a condition caused a particular missed pass. Figures describe this instant; long-pass effects are shown at 25 m.", "Modificadores programados; no prueban que una condición causara un pase fallido concreto. Las cifras corresponden a este instante; los efectos de pase largo se muestran a 25 m.")}</p>
      <div className="arena-effects-grid">{(["local", "visita"] as const).map(lado => {
        const e = efectosEntorno(registro.config, estado, lado, 25), corto = efectosEntorno(registro.config, estado, lado, 10);
        return <div key={lado}><h3>{registro.config.partido[lado].nombre}</h3><dl className="arena-factors">
          <div><dt>{t("Heat effort", "Desgaste por calor")}</dt><dd>×{e.desgaste.toFixed(2)}</dd></div>
          <div><dt>{t("Cold speed factor", "Velocidad por frío")}</dt><dd>×{e.velocidadJugador.toFixed(2)}</dd></div>
          <div><dt>{t("Ball speed / surface", "Velocidad del balón / superficie")}</dt><dd>×{e.velocidadBalon.toFixed(2)}</dd></div>
          <div><dt>{t("Rain: additional aim error", "Lluvia: error adicional del golpe")}</dt><dd>+{e.errorLluviaM.toFixed(2)} m</dd></div>
          <div><dt>{t("Fog: long-pass error", "Niebla: error en pase largo")}</dt><dd>+{e.errorNieblaM.toFixed(2)} m</dd></div>
          <div><dt>{t("Long grass: short-pass error", "Césped alto: error en pase corto")}</dt><dd>+{corto.errorCespedM.toFixed(2)} m</dd></div>
          <div><dt>{t("Crowd: additional aim error", "Afición: error adicional del golpe")}</dt><dd>+{e.errorPresionM.toFixed(2)} m</dd></div>
        </dl></div>;
      })}</div>
    </details>
    <div className="arena-coaches">{(["local", "visita"] as const).map(lado => {
      const e = registro.config.entrenadores![lado], s = estado.entrenadores![lado], publico = estado.aficion![lado];
      const plantilla = [...estado.jugadores, ...estado.banco ?? []];
      const sale = plantilla.find(j => j.id === s.pendiente?.sale), entra = plantilla.find(j => j.id === s.pendiente?.entra);
      return <article className="arena-coach" key={lado} data-testid={`arena-coach-${lado}`}>
        <p className="overline">{registro.config.partido[lado].nombre}</p><h3>{e.nombre}</h3><p className="arena-coach-profile">{etiquetasEntrenador[e.perfil][idioma]}</p>
        <dl className="arena-factors"><div><dt>{t("Formation", "Formación")}</dt><dd>{s.formacion}</dd></div><div><dt>{t("Intent", "Intención")}</dt><dd>{mentalidades[s.plan.mentalidad]}</dd></div><div><dt>{t("Block / pace", "Bloque / ritmo")}</dt><dd>{bloques[s.plan.bloque]} · {ritmos[s.plan.ritmo]}</dd></div><div><dt>{t("Substitutions / windows", "Cambios / ventanas")}</dt><dd>{s.cambios}/5 · {s.ventanas}/3</dd></div></dl>
        <p className="arena-muted">{t("Style", "Estilo")}: {t("Attack", "Ataque")} {e.ofensiva} · {t("Risk", "Riesgo")} {e.riesgo} · {t("Adaptability", "Adaptabilidad")} {e.adaptabilidad}</p>
        <div className="arena-coach-mood"><span>{t("Confidence", "Confianza")} <strong>{s.confianza}</strong></span><span>{t("Frustration", "Frustración")} <strong>{s.frustracion}</strong></span><span>{t("Urgency", "Urgencia")} <strong>{s.urgencia}</strong></span></div>
        <p className="arena-muted">{t("Confidence, frustration and urgency reflect the current match, not coach ability.", "Confianza, frustración y urgencia reflejan el partido actual, no la capacidad del entrenador.")}</p>
        <p className="arena-observed-window">{t("Last 30 s", "Últimos 30 s")}: {resumen[lado].recepciones}/{resumen[lado].pases} {t("passes", "pases")} · {resumen[lado].perdidas} {t("turnovers", "pérdidas")} · {resumen[lado].tiros} {t("shots", "tiros")} · {t("energy", "energía")} {Math.round(resumen[lado].energiaMedia * 100)}%</p>
        {s.ultimaDecision && <div className="arena-coach-decision"><strong>{t("Latest decision", "Última decisión")}</strong><p>{explicarMotivo(s.ultimaDecision.motivo, idioma)}</p><span className="arena-muted">{s.ultimaDecision.fuentes.length ? `${t("Evidence", "Evidencia")}: ` : t("Based on the observed match state", "Basada en el estado observado del partido")}</span>{s.ultimaDecision.fuentes.map(id => <button className="arena-evidence-link" key={id} type="button" aria-label={`${t("Inspect event", "Ver evento")} ${id}`} onClick={() => { const evento = registro.eventos.find(e => e.id === id); if (evento) saltar(evento.tick * ARENA.pasoS); }}>{id}</button>)}</div>}
        {s.pendiente && <p className="arena-sub-pending" data-testid="arena-sub-pending">{t("Waiting for a stoppage", "Espera una interrupción")}: {entra?.nombre} ↑ · {sale?.nombre} ↓</p>}
        <details><summary>{t("Coach traits", "Rasgos del entrenador")}</summary><div className="arena-traits">{atributos.map(a => <div className="arena-trait" key={a.clave}><label htmlFor={`coach-${lado}-${a.clave}`}>{a.etiqueta}<span>{e[a.clave]}</span></label><meter id={`coach-${lado}-${a.clave}`} min="0" max="100" value={e[a.clave]} /></div>)}</div><p className="arena-muted">{t("Stable synthetic preferences. Decisions also depend on the squad, weather and observed play.", "Preferencias sintéticas estables. Las decisiones también dependen de la plantilla, el clima y el juego observado.")}</p></details>
        <details><summary>{t("Formation with player names", "Formación con nombres")}</summary><div className="arena-lineup-names">{estado.jugadores.filter(j => j.lado === lado).map(j => <button type="button" key={j.id} onClick={() => seleccionar(j.id)}><span>{j.puesto}</span><strong>{j.dorsal} · {j.nombre}{j.capitan ? " · C" : ""}</strong></button>)}</div></details>
        <div className="arena-crowd"><strong>{registro.config.aficiones![lado].sector}</strong><p>{reacciones[publico.reaccion]} · {t("Mood", "Ánimo")} {publico.animo}/100</p>{["rugido", "aliento"].includes(publico.reaccion) && <p>«{registro.config.aficiones![lado].canto[idioma]}»</p>}<span className="arena-muted">{publico.evento ? `${t("Last reaction", "Última reacción")}: ${publico.evento}` : t("Initial atmosphere", "Ambiente inicial")}</span></div>
      </article>;
    })}</div>
  </section>;
}
