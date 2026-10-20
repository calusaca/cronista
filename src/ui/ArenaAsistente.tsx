"use client";
import { useEffect, useRef, useState } from "react";
import type { ResultadoAnalista, PreguntaArena } from "../arena/agente";
import type { ComentarioArena } from "../arena/narrador";

export function ArenaAsistente({ sesion, tick, jugador, idioma, comentarios }: { sesion: string | null; tick: number; jugador: string; idioma: "es" | "en"; comentarios: ComentarioArena[] }) {
  const es = idioma === "es", t = (en: string, esp: string) => es ? esp : en;
  const [habilitado, setHabilitado] = useState({ analista: false, voz: false });
  const [pregunta, setPregunta] = useState<PreguntaArena>("momento"), [audiencia, setAudiencia] = useState("fan");
  const [resultado, setResultado] = useState<ResultadoAnalista | null>(null), [pendiente, setPendiente] = useState(false), [error, setError] = useState(false);
  const [audio, setAudio] = useState<string | null>(null);
  const peticion = useRef<AbortController | null>(null), bloqueado = useRef(false);
  const tickAudio = useRef(0);
  useEffect(() => { const a = new AbortController(); void fetch("/api/arena/herramientas", { signal: a.signal }).then(r => r.json()).then(setHabilitado).catch(() => {}); return () => a.abort(); }, []);
  useEffect(() => { setResultado(null); setError(false); peticion.current?.abort(); bloqueado.current = false; setPendiente(false); }, [sesion]);
  useEffect(() => { setAudio(null); }, [sesion, idioma]);
  useEffect(() => { if (tick < tickAudio.current) setAudio(null); }, [tick]);
  useEffect(() => () => { if (audio) URL.revokeObjectURL(audio); }, [audio]);
  useEffect(() => () => peticion.current?.abort(), []);
  const visible = resultado && resultado.tick <= tick ? resultado : null;
  const comentario = visible?.comentario ?? comentarios.filter(c => c.tick <= tick).at(-1);
  const solicitar = async (tipo: "analisis" | "voz") => {
    if (!sesion || bloqueado.current) return;
    bloqueado.current = true; setPendiente(true); setError(false);
    const a = new AbortController(); peticion.current = a;
    try {
      const payload = tipo === "analisis" ? { tick, pregunta, jugador: pregunta === "jugador" ? jugador : null, audiencia } : { tick: comentario!.tick, principal: comentario!.principal, idioma };
      const r = await fetch(`/api/arena/sesiones/${sesion}/${tipo}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: a.signal });
      if (!r.ok) throw new Error("Servicio");
      if (tipo === "analisis") { setResultado(await r.json() as ResultadoAnalista); setAudio(null); }
      else { tickAudio.current = comentario!.tick; setAudio(URL.createObjectURL(await r.blob())); }
    } catch { if (!a.signal.aborted) setError(true); }
    finally { if (peticion.current === a) { peticion.current = null; bloqueado.current = false; setPendiente(false); } }
  };
  return <section className="arena-intelligence" data-testid="arena-assistant" aria-label={t("Ask about this match", "Pregunta sobre este partido")}>
    <p className="overline">{t("Your questions, with evidence", "Tus preguntas, con evidencia")}</p>
    <h2>{t("Ask the match analyst", "Consulta al analista")}</h2>
    <p>{t("Explore confirmed actions or listen to an approved comment. Questions and audio request AI services when you choose them.", "Explora acciones confirmadas o escucha un comentario aprobado. Las preguntas y el audio solicitan servicios de IA cuando los eliges.")}</p>
    <div className="arena-live-controls">
      <label>{t("Question", "Pregunta")}<select className="field" value={pregunta} disabled={pendiente} onChange={e => setPregunta(e.target.value as PreguntaArena)}>
        <option value="momento">{t("What just happened?", "¿Qué acaba de pasar?")}</option><option value="jugador">{t("What has my selected player done?", "¿Qué ha hecho el jugador seleccionado?")}</option><option value="ocasiones">{t("Which chances have there been?", "¿Qué ocasiones hubo?")}</option>
      </select></label>
      <label>{t("Explanation style", "Estilo de explicación")}<select className="field" value={audiencia} disabled={pendiente} onChange={e => setAudiencia(e.target.value)}><option value="fan">Fan</option><option value="analyst">Analyst</option></select></label>
      <button className="btn" disabled={!sesion || !habilitado.analista || pendiente || tick === 0} onClick={() => void solicitar("analisis")}>{t("Ask analyst", "Consultar analista")}</button>
      <button className="btn" disabled={!sesion || !habilitado.voz || !comentario || pendiente} onClick={() => void solicitar("voz")}>{t("Prepare comment audio", "Preparar audio del comentario")}</button>
    </div>
    {!sesion && <p className="arena-muted">{t("Start a live match to ask about its confirmed play.", "Inicia un partido en vivo para consultar sus jugadas confirmadas.")}</p>}
    {sesion && !habilitado.analista && !habilitado.voz && <p className="arena-muted">{t("Questions and audio are currently unavailable.", "Las consultas y el audio no están disponibles en este momento.")}</p>}
    {pendiente && <p role="status">{t("Preparing your answer…", "Preparando tu respuesta…")}</p>}
    {visible && <article data-testid="arena-assistant-answer"><p className="arena-muted">{(visible.tick / 10).toFixed(1)} s · {visible.comentario?.modo === "llm" ? t("AI explanation", "Explicación IA") : t("Verified template fallback", "Respaldo por plantilla verificada")}</p>
      {visible.comentario?.oraciones.map((o, i) => <p key={i}>{es ? o.texto_es : o.texto_en}</p>)}
      {!visible.comentario && <p>{t("There are no confirmed actions to explain yet.", "Todavía no hay acciones confirmadas para explicar.")}</p>}
      <details><summary>{t("Inspect tools and evidence", "Consultar herramientas y evidencia")}</summary>
        {visible.herramientas.map((h, i) => <p key={i}><code>{h.nombre}</code> · {h.error ?? h.hechos.join(" · ")}</p>)}
        {visible.comentario?.hechos.filter(h => visible.comentario!.oraciones.some(o => o.hecho === h.id)).map(h => <p key={h.id}>{h.eventos.join(" · ")} · {es ? h.texto_es : h.texto_en}</p>)}
        {visible.comentario?.audit.map(a => <p key={a.intento}>{a.intento}: {a.motivos.length ? a.motivos.map(m => `${m.regla}: ${m.detalle}`).join(" · ") : t("Passed V1–V8", "Aprobado por V1–V8")}</p>)}
      </details>
    </article>}
    {audio && <audio controls src={audio} aria-label={t("Approved comment audio", "Audio del comentario aprobado")} />}
    {error && <p role="alert">{t("This service is unavailable or its request limit was reached. Confirmed match events remain available.", "El servicio no está disponible o alcanzó su límite de consultas. Los eventos confirmados siguen disponibles.")}</p>}
  </section>;
}
