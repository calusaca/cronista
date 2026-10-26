"use client";

import { useEffect, useRef, useState } from "react";
import type { AsignacionModelos, InstantaneaEmision, MensajeSesion, MetricasSesion, ModeloPublico, PublicacionSesion, SeleccionModelos, PresentacionArena, ReproduccionArena } from "../arena/protocolo";
import { ENCUENTROS_LLM_DIARIOS } from "../sim/limites";
import { cebarAudioDirecto, descartarAudioCebado, fijarAsignacionDirecto, guardarPreferenciaNarracion, leerPreferenciaNarracion, marcarArranquePropio } from "./audio-directo";
import { conservarAlTerminar, decidirAlMontar, guardarSesionDirecto, leerSegundo, olvidarDirecto, sesionCaducada, tickInicial } from "./retomar-directo";
import { TEXTOS_RETOMAR } from "./textos-retomar";

/** Brief 060 § 4.1 + v1.1 (4) · `alCancelar(fn)`: registra en `Arena` la función de cancelar (la misma petición, estados
 * y errores que «Cancel live match»), que «Stop match» llama desde la barra de la cancha. */
export function ArenaEnDirecto({ ajustes, idioma, ocupado, alMensaje, alActividad, alPreparado, presentacionVista, alCancelar }: {
  presentacionVista: "buffer" | "preparada"; ajustes: unknown; idioma: "es" | "en"; ocupado: boolean;
  alMensaje: (p: PublicacionSesion) => void; alActividad: (activa: boolean, presentacion?: PresentacionArena) => void;
  alPreparado: (id: string, resultado: ReproduccionArena, buffer?: { inicioTick: number; terminada: boolean; retomar?: { narracion: boolean } }) => void;
  alCancelar?: (cancelar: () => void) => void;
}) {
  const es = idioma === "es", t = (en: string, esp: string) => es ? esp : en;
  const [modelos, setModelos] = useState<ModeloPublico[]>([]), [modo, setModo] = useState<SeleccionModelos["modo"]>("programado");
  const [local, setLocal] = useState(""), [visita, setVisita] = useState("");
  /** Smoke 0000031 (D1) · El catálogo de /api/arena/modelos solo fija el modo por defecto («Random models») si el
   * espectador no eligió ninguno; un modo elegido que deja de ser válido (sin modelos) se convierte y se avisa. */
  const modoElegido = useRef(false), [modoConvertido, setModoConvertido] = useState(false);
  const modoActual = useRef(modo); modoActual.current = modo;
  /** Rev. 0000035 · Motivo del rechazo al crear la sesión (cuerpo del 429): sin él, el error genérico de siempre. */
  const [rechazo, setRechazo] = useState<{ motivo: "en-curso" | "limite-diario"; limite?: number } | null>(null);
  const [estado, setEstado] = useState("lista"), [error, setError] = useState(false), [asignacion, setAsignacion] = useState<AsignacionModelos | null>(null);
  const [presentacion, setPresentacion] = useState<PresentacionArena>("buffer");
  const [grabacionLista, setGrabacionLista] = useState<string | null>(null);
  const [reintento, setReintento] = useState<string | null>(null);
  const [id, setId] = useState<string | null>(null), [iniciando, setIniciando] = useState(false);
  const [metricas, setMetricas] = useState<MetricasSesion | null>(null);
  // Brief 058 · A: casilla «Narrar el partido» (solo en búfer y con voz en el servidor). Su valor inicial sale
  // de la preferencia después de hidratar, en un efecto, para no romper el SSR.
  // Smoke 058 (rev. 0000027): `null` mientras /herramientas no responde; un clic en ese intervalo ceba igualmente.
  const [vozDisponible, setVozDisponible] = useState<boolean | null>(null), [narrar, setNarrar] = useState(true);
  useEffect(() => { setNarrar(leerPreferenciaNarracion()); }, []);
  const fuente = useRef<EventSource | null>(null), ultimoId = useRef(0), solicitud = useRef<AbortController | null>(null);
  const iniciandoRef = useRef(false);
  /** v1.1 (4) · Bandera única de detención por el espectador («Stop match» o «Cancel live match»): un inicio pendiente
   * se cancela al llegar su id (sin adoptarlo) y un directo preparado ignora cualquier `terminada` posterior. */
  const detenidoPorUsuario = useRef(false);
  /** Codex 060 (impl., #1) · Generación de la conexión: Detener la invalida, y toda respuesta que llega después de un
   * `await` (instantánea de /emision o /reproduccion del preparado) se descarta antes de adoptar resultados, abrir el
   * SSE o publicar el enlace; la sesión queda «cancelada» sin cargar nada. */
  const generacion = useRef(0);
  /** Brief 066 · A · La conexión en curso retoma una sesión guardada (montaje o «Reconnect»), no un partido nuevo. */
  const retomando = useRef(false), [noDisponible, setNoDisponible] = useState(false), avisoNoDisponible = useRef<HTMLParagraphElement | null>(null);
  // El aviso queda a la vista aunque el inicio de la reconexión bajara a la cancha (móvil): después de ese desplazamiento.
  useEffect(() => { if (noDisponible) requestAnimationFrame(() => avisoNoDisponible.current?.scrollIntoView?.({ block: "nearest" })); }, [noDisponible]);
  const callbacks = useRef({ alMensaje, alActividad, alPreparado });
  useEffect(() => { callbacks.current = { alMensaje, alActividad, alPreparado }; }, [alMensaje, alActividad, alPreparado]);
  useEffect(() => { if (!id && !iniciando) setPresentacion(presentacionVista); }, [presentacionVista]); // Session presentation stays fixed while connected.
  useEffect(() => {
    const abort = new AbortController();
    void fetch("/api/arena/modelos", { signal: abort.signal }).then(r => r.json()).then((r: { modelos: ModeloPublico[] }) => {
      setModelos(r.modelos); setLocal(r.modelos[0]?.id ?? ""); setVisita(r.modelos[1]?.id ?? r.modelos[0]?.id ?? "");
      if (r.modelos.length && !modoElegido.current) setModo("azar");
      if (!r.modelos.length && modoActual.current !== "programado") { setModo("programado"); setModoConvertido(true); }
    }).catch(() => {});
    void fetch("/api/arena/herramientas", { signal: abort.signal }).then(r => r.json()).then((r: { voz?: unknown }) => { setVozDisponible(r.voz === true); if (r.voz !== true) descartarAudioCebado(); }).catch(() => { if (!abort.signal.aborted) { setVozDisponible(false); descartarAudioCebado(); } });
    // Brief 066 · A: el enlace compartido se comporta como siempre; la sesión guardada se retoma en su segundo.
    const montaje = decidirAlMontar(window.location.search);
    if (montaje) { retomando.current = montaje.retomar; setPresentacion(montaje.presentacion); setId(montaje.id); }
    return () => { abort.abort(); solicitud.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!id) return;
    detenidoPorUsuario.current = false;
    callbacks.current.alActividad(true, presentacion); setEstado("conectando"); ultimoId.current = 0;
    const carga = new AbortController(), g = generacion.current;
    let eventos: EventSource | null = null;
    const detenida = () => g !== generacion.current;
    /** Detenida tras un `await`: no se adopta nada y la conexión termina como cancelada (sin SSE ni enlace). */
    const cerrarDetenida = () => {
      detenidoPorUsuario.current = false; eventos?.close(); if (fuente.current === eventos) fuente.current = null;
      setEstado("cancelada"); callbacks.current.alActividad(false); olvidarDirecto(id); setId(null);
    };
    const iniciar = async () => {
      if (presentacion === "buffer") {
        let respuesta: Response | undefined;
        for (let intento = 0; intento < 8 && !carga.signal.aborted; intento++) {
          respuesta = await fetch(`/api/arena/sesiones/${id}/emision`, { signal: carga.signal });
          if (detenida()) { cerrarDetenida(); return; }
          if (respuesta.status !== 409) break;
          await new Promise<void>(r => setTimeout(r, 250));
        }
        if (carga.signal.aborted) return;
        if (detenida()) { cerrarDetenida(); return; }
        // Brief 066 · A: una sesión guardada que caducó o no existe se olvida, con un aviso breve.
        if (respuesta && retomando.current && sesionCaducada(respuesta.status)) {
          olvidarDirecto(id); retomando.current = false; setNoDisponible(true); setEstado("lista");
          callbacks.current.alActividad(false); setId(null); return;
        }
        if (!respuesta?.ok) throw new Error("Emisión");
        const instantanea = await respuesta.json() as InstantaneaEmision;
        if (carga.signal.aborted) return;
        if (detenida()) { cerrarDetenida(); return; }
        ultimoId.current = instantanea.ultimoMensaje;
        setAsignacion(instantanea.asignacion); fijarAsignacionDirecto(id, instantanea.asignacion);
        // Brief 066 · A: al retomar, en el segundo guardado y en pausa (no en final − 20 s).
        const guardado = retomando.current ? leerSegundo(id) : null;
        const inicioTick = tickInicial(instantanea.registro.final.tick, guardado);
        callbacks.current.alPreparado(id, instantanea, { inicioTick, terminada: instantanea.estado !== "ejecutando", ...(retomando.current ? { retomar: { narracion: guardado?.narracion ?? false } } : {}) });
        retomando.current = false;
        if (instantanea.estado !== "ejecutando") {
          setEstado(instantanea.estado); setMetricas(instantanea.metricas); setGrabacionLista(instantanea.estado === "completa" ? id : null);
          if (!conservarAlTerminar(presentacion, instantanea.estado)) olvidarDirecto(id);
          callbacks.current.alActividad(false); setId(null); return;
        }
      }
      if (carga.signal.aborted) return;
      if (detenida()) { cerrarDetenida(); return; }
      const flujo = new EventSource(`/api/arena/sesiones/${id}/eventos?desde=${ultimoId.current}`); eventos = flujo; fuente.current = flujo;
      flujo.addEventListener("arena", async (ev: MessageEvent<string>) => {
      try {
        const m = JSON.parse(ev.data) as MensajeSesion;
        if (m.id <= ultimoId.current) return;
        if (m.id !== ultimoId.current + 1) throw new Error("Secuencia");
        ultimoId.current = m.id; const p = m.publicacion;
        if (p.tipo === "sesion") { setAsignacion(p.asignacion); fijarAsignacionDirecto(id, p.asignacion); }
        if (p.tipo === "esperando") setEstado(presentacion === "preparada" ? "preparando" : "esperando");
        if (p.tipo === "avance") setEstado(presentacion === "preparada" ? "preparando" : presentacion === "buffer" ? "buffer" : "jugando");
        if (p.tipo === "fin") setEstado("finalizando");
        if (presentacion !== "preparada") callbacks.current.alMensaje(p);
        if (p.tipo === "terminada") {
          flujo.close(); fuente.current = null;
          // v1.1 (4) · Preparado detenido por el espectador: no se carga nada (tampoco una `completa` que ganó la carrera).
          if (presentacion === "preparada" && detenidoPorUsuario.current) {
            detenidoPorUsuario.current = false; setEstado("cancelada"); setMetricas(p.metricas);
            callbacks.current.alActividad(false); olvidarDirecto(id); setId(null); return;
          }
          if (presentacion === "preparada" && p.estado === "completa") {
            setEstado("cargando");
            const respuesta = await fetch(`/api/arena/sesiones/${id}/reproduccion`, { signal: carga.signal });
            if (carga.signal.aborted) return;
            if (detenida()) { cerrarDetenida(); return; }
            if (!respuesta.ok) throw new Error("Registro");
            const resultado = await respuesta.json() as ReproduccionArena;
            if (carga.signal.aborted) return;
            if (detenida()) { cerrarDetenida(); return; }
            callbacks.current.alPreparado(id, resultado);
            setGrabacionLista(id);
          }
          if (p.estado === "completa" && presentacion === "buffer") setGrabacionLista(id);
          setMetricas(p.metricas);
          setEstado(p.estado === "completa" && presentacion === "preparada" ? "preparada" : p.estado); callbacks.current.alActividad(false); flujo.close(); fuente.current = null;
          // Brief 066 · A: una emisión del búfer completa conserva la sesión hasta que la emisión llegue al final.
          if (!conservarAlTerminar(presentacion, p.estado)) olvidarDirecto(id);
          setId(null);
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
    // Brief 058 · A: el cebado del audio va ANTES de cualquier await, dentro del gesto del clic.
    const t0 = performance.now(), narrada = presentacion === "buffer" && vozDisponible !== false && narrar;
    if (narrada) cebarAudioDirecto();
    iniciandoRef.current = true; detenidoPorUsuario.current = false; retomando.current = false; callbacks.current.alActividad(true, presentacion);
    setIniciando(true); setError(false); setNoDisponible(false); setRechazo(null); setAsignacion(null); setMetricas(null); setGrabacionLista(null); setReintento(null);
    const abort = new AbortController(); solicitud.current = abort;
    try {
      const seleccion = modo === "manual" ? { modo, local, visita } : { modo };
      const r = await fetch("/api/arena/sesiones", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...(ajustes as object), seed: (ajustes as { seed?: number }).seed ?? crypto.getRandomValues(new Uint32Array(1))[0], seleccion, presentacion }), signal: abort.signal });
      if (!r.ok) {
        const cuerpo = await r.json().catch(() => null) as { motivo?: string; limite?: number } | null;
        if (r.status === 429 && (cuerpo?.motivo === "en-curso" || cuerpo?.motivo === "limite-diario")) setRechazo({ motivo: cuerpo.motivo, ...(Number.isInteger(cuerpo.limite) ? { limite: cuerpo.limite } : {}) });
        throw new Error("Inicio");
      }
      const s = await r.json() as { id: string; asignacion: AsignacionModelos };
      // v1.1 (4) · Detenido con el POST en vuelo: el servidor pudo crear la sesión; se cancela ya y no se adopta.
      if (detenidoPorUsuario.current) {
        detenidoPorUsuario.current = false;
        void fetch(`/api/arena/sesiones/${s.id}`, { method: "DELETE" }).catch(() => {});
        setEstado("cancelada"); callbacks.current.alActividad(false); return;
      }
      if (narrada) marcarArranquePropio(s.id, t0);
      fijarAsignacionDirecto(s.id, s.asignacion);
      guardarSesionDirecto(s.id, presentacion); setAsignacion(s.asignacion); setId(s.id);
    } catch {
      // v1.1 (4) · Detenido con el POST en vuelo y el POST falló: no hay nada que cancelar.
      if (detenidoPorUsuario.current) { detenidoPorUsuario.current = false; setEstado("cancelada"); callbacks.current.alActividad(false); }
      else if (!abort.signal.aborted) { setError(true); callbacks.current.alActividad(false); }
    }
    finally { if (solicitud.current === abort) solicitud.current = null; iniciandoRef.current = false; setIniciando(false); }
  };
  const cancelar = async () => {
    // Brief 066 · A: «Cancel live match» y «Stop match» olvidan la sesión guardada.
    olvidarDirecto();
    if (!id) { if (iniciandoRef.current) { detenidoPorUsuario.current = true; setEstado("cancelando"); } return; }
    detenidoPorUsuario.current = true; generacion.current++;
    // El mensaje final del SSE puede llegar antes que la respuesta DELETE.
    // Nunca sobrescribir ese estado terminal con «Cancelando».
    const anterior = estado; setEstado("cancelando");
    try { const r = await fetch(`/api/arena/sesiones/${id}`, { method: "DELETE" }); if (!r.ok) throw new Error("Cancelar"); }
    catch { setError(true); setEstado(e => e === "cancelando" ? anterior : e); }
  };
  const cancelarRef = useRef(cancelar); cancelarRef.current = cancelar;
  useEffect(() => { alCancelar?.(() => void cancelarRef.current()); }, [alCancelar]);
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
      <label>{t("Controller selection", "Elección de controladores")}<select className="field" value={modo} disabled={bloqueado} onChange={e => { modoElegido.current = true; setModoConvertido(false); setModo(e.target.value as typeof modo); }}>
        <option value="azar" disabled={!modelos.length}>{t("Random models", "Modelos al azar")}</option><option value="manual" disabled={!modelos.length}>{t("Choose models", "Elegir modelos")}</option><option value="programado">{t("Programmed demonstration", "Demostración programada")}</option>
      </select></label>
      {modo === "manual" && <>{(["local", "visita"] as const).map(lado => <label key={lado}>{lado === "local" ? t("Home model", "Modelo local") : t("Away model", "Modelo visitante")}<select className="field" disabled={bloqueado} value={lado === "local" ? local : visita} onChange={e => (lado === "local" ? setLocal : setVisita)(e.target.value)}>{modelos.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></label>)}</>}
      <button className="btn btn-primary" disabled={bloqueado || (modo !== "programado" && !modelos.length)} onClick={() => void comenzar()}>{iniciando ? t("Starting…", "Iniciando…") : presentacion === "preparada" ? t("Generate match", "Generar partido") : t("Start live match", "Iniciar partido en vivo")}</button>
      {presentacionVista === "buffer" && vozDisponible === true && <label className="arena-live-voice" data-testid="arena-live-voice"><input type="checkbox" checked={narrar} disabled={bloqueado} onChange={e => { setNarrar(e.target.checked); guardarPreferenciaNarracion(e.target.checked); }} /> {t("Narrate the match", "Narrar el partido")}</label>}
      {id && <button className="btn" onClick={() => void cancelar()} disabled={estado === "cancelando"}>{t("Cancel live match", "Cancelar partido en vivo")}</button>}
    </div>
    {modoConvertido && <p role="status" className="arena-muted" data-testid="arena-live-mode-note">{t("No models are available: the selection changed to the programmed demonstration.", "No hay modelos disponibles: la elección pasó a la demostración programada.")}</p>}
    {!modelos.length && <p className="arena-muted">{t("Model play is not enabled on this server. The live programmed demonstration is available.", "Los modelos no están habilitados en este servidor. Puedes ejecutar la demostración programada en vivo.")}</p>}
    {asignacion && <p data-testid="arena-live-assignment"><strong>{t("Home", "Local")}:</strong> {asignacion.local.nombre} · <strong>{t("Away", "Visita")}:</strong> {asignacion.visita.nombre}{asignacion.modo !== "programado" && asignacion.local.controlador === asignacion.visita.controlador && t(" · Two independent instances of the same model", " · Dos instancias independientes del mismo modelo")}{/* Brief 057 v1.1 § 4 (b) */}{asignacion.procedencia === "declarada" && ` · ${t("controllers declared by the file, not verified", "controladores declarados por el archivo, no verificados")}`}</p>}
    <p role="status" data-testid="arena-live-status">{textos[estado] ?? estado}</p>
    {id && presentacion === "buffer" && <p><a href={`/arena?partido=${id}&vista=buffer`}>{t("Share this broadcast", "Compartir esta emisión")}</a></p>}
    {grabacionLista && <p><a href={`/arena?partido=${grabacionLista}`}>{t("Open or share this saved match", "Abrir o compartir este partido guardado")}</a> · {t("Available for up to 24 hours", "Disponible hasta 24 horas")}</p>}
    {noDisponible && <p ref={avisoNoDisponible} role="status" className="arena-muted" data-testid="arena-live-gone">{TEXTOS_RETOMAR[idioma].noDisponible}</p>}
    {reintento && !id && <button className="btn" onClick={() => { setError(false); retomando.current = presentacion === "buffer"; setId(reintento); setReintento(null); }}>{t("Reconnect to this match", "Reconectar a este partido")}</button>}
    {metricas && <p className="arena-muted" data-testid="arena-live-metrics">{t(`${metricas.decisiones} team decisions · ${metricas.respaldos} programmed fallbacks · ${(metricas.duracionMs / 1000).toFixed(1)} s elapsed`, `${metricas.decisiones} decisiones de equipo · ${metricas.respaldos} respaldos programados · ${(metricas.duracionMs / 1000).toFixed(1)} s transcurridos`)}{metricas.respaldos > 0 && t(". This result includes programmed intervention.", ". Este resultado incluye intervención programada.")}</p>}
    {error && <p role="alert" data-testid="arena-live-error" data-motivo={rechazo?.motivo}>{rechazo?.motivo === "limite-diario" ? (() => {
      const n = rechazo.limite ?? ENCUENTROS_LLM_DIARIOS, ahora = Date.now(), medianoche = Date.UTC(new Date(ahora).getUTCFullYear(), new Date(ahora).getUTCMonth(), new Date(ahora).getUTCDate() + 1), horas = Math.max(1, Math.ceil((medianoche - ahora) / 3_600_000));
      return <>{t(`The daily limit of matches with models has been reached (${n} per day, UTC). It is available again at 00:00 UTC (in ~${horas}h). Meanwhile you can use the programmed demonstration.`, `Se alcanzó el límite diario de partidos con modelos (${n} por día, UTC). Vuelve a estar disponible a las 00:00 UTC (en ~${horas}h). Mientras tanto puedes usar la demostración programada.`)} <button className="btn" onClick={() => { modoElegido.current = true; setModo("programado"); setError(false); setRechazo(null); }}>{t("Use the programmed demonstration", "Usar la demostración programada")}</button></>;
    })() : rechazo?.motivo === "en-curso" ? t("Another match is already running on the server. Wait for it to finish and try again.", "Ya hay otro partido en curso en el servidor. Espera a que termine e inténtalo de nuevo.")
      : t("Could not start or update this match. Check availability and try again.", "No se pudo iniciar o actualizar el partido. Revisa la disponibilidad e inténtalo de nuevo.")}</p>}
  </section>;
}
