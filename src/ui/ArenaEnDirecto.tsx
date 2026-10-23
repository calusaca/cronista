"use client";

import { useEffect, useRef, useState } from "react";
import type { AsignacionModelos, InstantaneaEmision, MensajeSesion, MetricasSesion, ModeloPublico, PublicacionSesion, SeleccionModelos, PresentacionArena, ReproduccionArena } from "../arena/protocolo";

const claveSesion = "cronista:arena:sesion";
const clavePresentacion = "cronista:arena:presentacion";
export function ArenaEnDirecto({ ajustes, idioma, ocupado, alMensaje, alActividad, alPreparado, presentacionVista }: {
  presentacionVista: "buffer" | "preparada"; ajustes: unknown; idioma: "es" | "en"; ocupado: boolean;
  alMensaje: (p: PublicacionSesion) => void; alActividad: (activa: boolean, presentacion?: PresentacionArena) => void;
  alPreparado: (id: string, resultado: ReproduccionArena, buffer?: { inicioTick: number; terminada: boolean }) => void;
}) {
  const es = idioma === "es", t = (en: string, esp: string) => es ? esp : en;
  const [modelos, setModelos] = useState<ModeloPublico[]>([]), [modo, setModo] = useState<SeleccionModelos["modo"]>("programado");
  const [local, setLocal] = useState(""), [visita, setVisita] = useState("");
  const [estado, setEstado] = useState("lista"), [error, setError] = useState(false), [asignacion, setAsignacion] = useState<AsignacionModelos | null>(null);
  const [presentacion, setPresentacion] = useState<PresentacionArena>("buffer");
  const [grabacionLista, setGrabacionLista] = useState<string | null>(null);
  const [reintento, setReintento] = useState<string | null>(null);
  const [id, setId] = useState<string | null>(null), [iniciando, setIniciando] = useState(false);
  const [metricas, setMetricas] = useState<MetricasSesion | null>(null);
  const fuente = useRef<EventSource | null>(null), ultimoId = useRef(0), solicitud = useRef<AbortController | null>(null);
  const iniciandoRef = useRef(false);
  const callbacks = useRef({ alMensaje, alActividad, alPreparado });
  useEffect(() => { callbacks.current = { alMensaje, alActividad, alPreparado }; }, [alMensaje, alActividad, alPreparado]);
  useEffect(() => { if (!id && !iniciando) setPresentacion(presentacionVista); }, [presentacionVista]); // Session presentation stays fixed while connected.
  useEffect(() => {
    const abort = new AbortController();
    void fetch("/api/arena/modelos", { signal: abort.signal }).then(r => r.json()).then((r: { modelos: ModeloPublico[] }) => {
      setModelos(r.modelos); setLocal(r.modelos[0]?.id ?? ""); setVisita(r.modelos[1]?.id ?? r.modelos[0]?.id ?? "");
      if (r.modelos.length) setModo("azar");
    }).catch(() => {});
    const compartido = new URLSearchParams(window.location.search).get("partido");
    const anterior = compartido ?? sessionStorage.getItem(claveSesion);
    if (anterior && /^[a-f0-9-]{36}$/.test(anterior)) {
      const vista = new URLSearchParams(window.location.search).get("vista"), guardada = sessionStorage.getItem(clavePresentacion);
      setPresentacion(compartido !== null ? vista === "buffer" ? "buffer" : "preparada" : guardada === "buffer" ? "buffer" : guardada === "preparada" ? "preparada" : "directo"); setId(anterior);
    }
    return () => { abort.abort(); solicitud.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!id) return;
    callbacks.current.alActividad(true, presentacion); setEstado("conectando"); ultimoId.current = 0;
    const carga = new AbortController();
    let eventos: EventSource | null = null;
    const iniciar = async () => {
      if (presentacion === "buffer") {
        let respuesta: Response | undefined;
        for (let intento = 0; intento < 8 && !carga.signal.aborted; intento++) {
          respuesta = await fetch(`/api/arena/sesiones/${id}/emision`, { signal: carga.signal });
          if (respuesta.status !== 409) break;
          await new Promise<void>(r => setTimeout(r, 250));
        }
        if (!respuesta?.ok) throw new Error("Emisión");
        const instantanea = await respuesta.json() as InstantaneaEmision;
        if (carga.signal.aborted) return;
        ultimoId.current = instantanea.ultimoMensaje;
        setAsignacion(instantanea.asignacion);
        const inicioTick = Math.max(0, Math.floor((instantanea.registro.final.tick - 200) / 50) * 50);
        callbacks.current.alPreparado(id, instantanea, { inicioTick, terminada: instantanea.estado !== "ejecutando" });
        if (instantanea.estado !== "ejecutando") {
          setEstado(instantanea.estado); setMetricas(instantanea.metricas); setGrabacionLista(instantanea.estado === "completa" ? id : null);
          callbacks.current.alActividad(false); sessionStorage.removeItem(claveSesion); setId(null); return;
        }
      }
      if (carga.signal.aborted) return;
      const flujo = new EventSource(`/api/arena/sesiones/${id}/eventos?desde=${ultimoId.current}`); eventos = flujo; fuente.current = flujo;
      flujo.addEventListener("arena", async (ev: MessageEvent<string>) => {
      try {
        const m = JSON.parse(ev.data) as MensajeSesion;
        if (m.id <= ultimoId.current) return;
        if (m.id !== ultimoId.current + 1) throw new Error("Secuencia");
        ultimoId.current = m.id; const p = m.publicacion;
        if (p.tipo === "sesion") setAsignacion(p.asignacion);
        if (p.tipo === "esperando") setEstado(presentacion === "preparada" ? "preparando" : "esperando");
        if (p.tipo === "avance") setEstado(presentacion === "preparada" ? "preparando" : presentacion === "buffer" ? "buffer" : "jugando");
        if (p.tipo === "fin") setEstado("finalizando");
        if (presentacion !== "preparada") callbacks.current.alMensaje(p);
        if (p.tipo === "terminada") {
          flujo.close(); fuente.current = null;
          if (presentacion === "preparada" && p.estado === "completa") {
            setEstado("cargando");
            const respuesta = await fetch(`/api/arena/sesiones/${id}/reproduccion`, { signal: carga.signal });
            if (!respuesta.ok) throw new Error("Registro");
            const resultado = await respuesta.json() as ReproduccionArena;
            if (carga.signal.aborted) return;
            callbacks.current.alPreparado(id, resultado);
            setGrabacionLista(id);
          }
          if (p.estado === "completa" && presentacion === "buffer") setGrabacionLista(id);
          setMetricas(p.metricas);
          setEstado(p.estado === "completa" && presentacion === "preparada" ? "preparada" : p.estado); callbacks.current.alActividad(false); flujo.close(); fuente.current = null;
          sessionStorage.removeItem(claveSesion); setId(null);
        }
      } catch { if (carga.signal.aborted) return; setError(true); flujo.close(); fuente.current = null; callbacks.current.alActividad(false); setReintento(id); setId(null); }
      });
      flujo.onerror = () => {
      if (flujo.readyState === EventSource.CLOSED) {
        setError(true); callbacks.current.alActividad(false); setReintento(id); setId(null); return;
      }
      setEstado("reconectando");
      // EventSource conserva Last-Event-ID. La reconexión nunca crea una sesión.
      };
    };
    void iniciar().catch(() => { if (!carga.signal.aborted) { setError(true); callbacks.current.alActividad(false); setReintento(id); setId(null); } });
    return () => { carga.abort(); eventos?.close(); if (fuente.current === eventos) fuente.current = null; };
  }, [id, presentacion]);
  const comenzar = async () => {
    if (ocupado || id || iniciandoRef.current) return;
    iniciandoRef.current = true; callbacks.current.alActividad(true, presentacion);
    setIniciando(true); setError(false); setAsignacion(null); setMetricas(null); setGrabacionLista(null); setReintento(null);
    const abort = new AbortController(); solicitud.current = abort;
    try {
      const seleccion = modo === "manual" ? { modo, local, visita } : { modo };
      const r = await fetch("/api/arena/sesiones", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...(ajustes as object), seed: (ajustes as { seed?: number }).seed ?? crypto.getRandomValues(new Uint32Array(1))[0], seleccion, presentacion }), signal: abort.signal });
      if (!r.ok) throw new Error("Inicio");
      const s = await r.json() as { id: string; asignacion: AsignacionModelos };
      sessionStorage.setItem(clavePresentacion, presentacion); sessionStorage.setItem(claveSesion, s.id); setAsignacion(s.asignacion); setId(s.id);
    } catch { if (!abort.signal.aborted) { setError(true); callbacks.current.alActividad(false); } }
    finally { if (solicitud.current === abort) solicitud.current = null; iniciandoRef.current = false; setIniciando(false); }
  };
  const cancelar = async () => {
    if (!id) return;
    // El mensaje final del SSE puede llegar antes que la respuesta DELETE.
    // Nunca sobrescribir ese estado terminal con «Cancelando».
    const anterior = estado; setEstado("cancelando");
    try { const r = await fetch(`/api/arena/sesiones/${id}`, { method: "DELETE" }); if (!r.ok) throw new Error("Cancelar"); }
    catch { setError(true); setEstado(e => e === "cancelando" ? anterior : e); }
  };
  const bloqueado = ocupado || !!id || iniciando;
  const textos: Record<string, string> = {
    lista: t("Ready to start", "Listo para comenzar"),
    preparando: t("Generating and saving the match before playback…", "Generando y guardando el partido antes de reproducir…"),
    buffer: t("Live match · watch below", "Partido en vivo · mira la cancha más abajo"),
    cargando: t("Loading the finished recording…", "Cargando la grabación terminada…"),
    preparada: t("Match ready · press Play or listen from the start", "Partido listo · pulsa Reproducir o escucha desde el inicio"), conectando: t("Connecting to the match…", "Conectando con el partido…"),
    esperando: t("Coaches are deciding · simulation clock paused", "Los entrenadores están decidiendo · reloj simulado detenido"),
    jugando: t("Live · receiving play as it happens", "En vivo · recibiendo las jugadas mientras ocurren"),
    reconectando: t("Reconnecting to the same match…", "Reconectando al mismo partido…"),
    completa: t("Match complete · recording available", "Partido terminado · registro disponible"), cancelada: t("Match cancelled", "Partido cancelado"),
    finalizando: t("Play finished · completing commentary and recording", "Juego terminado · completando comentario y registro"),
    interrumpida: t("The server restarted; the match was interrupted", "El servidor se reinició; el partido quedó interrumpido"),
    error: t("The match stopped after a server error", "El partido se detuvo por un error del servidor"), cancelando: t("Cancelling…", "Cancelando…"),
  };
  return <section className="arena-live" aria-label={t("Live match", "Partido en vivo")} data-testid="arena-live">
    <div><h2>{presentacionVista === "buffer" ? t("Live match", "Partido en vivo") : t("Create a saved match", "Crear un partido guardado")}</h2>
      <p>{presentacionVista === "buffer" ? t("Choose who manages each team, then start. Watch the match and its narration together below.", "Elige quién dirige cada equipo e inicia. Mira el partido y su narración juntos más abajo.") : t("Or generate a complete recording with the settings above, ready to replay and share.", "También puedes generar una grabación completa con los ajustes anteriores para reproducirla y compartirla.")}</p></div>
    <div className="arena-live-controls">
      <label>{t("Controller selection", "Elección de controladores")}<select className="field" value={modo} disabled={bloqueado} onChange={e => setModo(e.target.value as typeof modo)}>
        <option value="azar" disabled={!modelos.length}>{t("Random models", "Modelos al azar")}</option><option value="manual" disabled={!modelos.length}>{t("Choose models", "Elegir modelos")}</option><option value="programado">{t("Programmed demonstration", "Demostración programada")}</option>
      </select></label>
      {modo === "manual" && <>{(["local", "visita"] as const).map(lado => <label key={lado}>{lado === "local" ? t("Home model", "Modelo local") : t("Away model", "Modelo visitante")}<select className="field" disabled={bloqueado} value={lado === "local" ? local : visita} onChange={e => (lado === "local" ? setLocal : setVisita)(e.target.value)}>{modelos.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></label>)}</>}
      <button className="btn btn-primary" disabled={bloqueado || (modo !== "programado" && !modelos.length)} onClick={() => void comenzar()}>{iniciando ? t("Starting…", "Iniciando…") : presentacion === "preparada" ? t("Generate match", "Generar partido") : t("Start live match", "Iniciar partido en vivo")}</button>
      {id && <button className="btn" onClick={() => void cancelar()} disabled={estado === "cancelando"}>{t("Cancel live match", "Cancelar partido en vivo")}</button>}
    </div>
    {!modelos.length && <p className="arena-muted">{t("Model play is not enabled on this server. The live programmed demonstration is available.", "Los modelos no están habilitados en este servidor. Puedes ejecutar la demostración programada en vivo.")}</p>}
    {asignacion && <p data-testid="arena-live-assignment"><strong>{t("Home", "Local")}:</strong> {asignacion.local.nombre} · <strong>{t("Away", "Visita")}:</strong> {asignacion.visita.nombre}{asignacion.modo !== "programado" && asignacion.local.controlador === asignacion.visita.controlador && t(" · Two independent instances of the same model", " · Dos instancias independientes del mismo modelo")}{/* Brief 057 v1.1 § 4 (b) */}{asignacion.procedencia === "declarada" && ` · ${t("controllers declared by the file, not verified", "controladores declarados por el archivo, no verificados")}`}</p>}
    <p role="status" data-testid="arena-live-status">{textos[estado] ?? estado}</p>
    {id && presentacion === "buffer" && <p><a href={`/arena?partido=${id}&vista=buffer`}>{t("Share this broadcast", "Compartir esta emisión")}</a></p>}
    {grabacionLista && <p><a href={`/arena?partido=${grabacionLista}`}>{t("Open or share this saved match", "Abrir o compartir este partido guardado")}</a> · {t("Available for up to 24 hours", "Disponible hasta 24 horas")}</p>}
    {reintento && !id && <button className="btn" onClick={() => { setError(false); setId(reintento); setReintento(null); }}>{t("Reconnect to this match", "Reconectar a este partido")}</button>}
    {metricas && <p className="arena-muted" data-testid="arena-live-metrics">{t(`${metricas.decisiones} team decisions · ${metricas.respaldos} programmed fallbacks · ${(metricas.duracionMs / 1000).toFixed(1)} s elapsed`, `${metricas.decisiones} decisiones de equipo · ${metricas.respaldos} respaldos programados · ${(metricas.duracionMs / 1000).toFixed(1)} s transcurridos`)}{metricas.respaldos > 0 && t(". This result includes programmed intervention.", ". Este resultado incluye intervención programada.")}</p>}
    {error && <p role="alert">{t("Could not start or update this match. Check availability and try again.", "No se pudo iniciar o actualizar el partido. Revisa la disponibilidad e inténtalo de nuevo.")}</p>}
  </section>;
}
