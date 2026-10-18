"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { estructura } from "../arena/catalogo";
import { formaciones, type FormacionArena, type RegistroArena } from "../arena/tipos";
import { estadoVisual, narrarEventoArena } from "../arena/vista";
import { ARENA } from "../sim/limites";
import { IndicadorCarga, useAvisoCarga } from "./Actividad";
import Link from "./Enlace";

const reloj = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export function Arena({ inicial }: { inicial: RegistroArena }) {
  const [registro, setRegistro] = useState(inicial), [tiempo, setTiempo] = useState(0);
  const [idioma, setIdioma] = useState<"es" | "en">("en");
  const [seed, setSeed] = useState(String(inicial.config.partido.seed));
  const [local, setLocal] = useState<FormacionArena>(inicial.config.formaciones.local);
  const [visita, setVisita] = useState<FormacionArena>(inicial.config.formaciones.visita);
  const [segundos, setSegundos] = useState(60), [velocidad, setVelocidad] = useState(2);
  const [reproduciendo, setReproduciendo] = useState(false), [reducido, setReducido] = useState(false);
  const [pendiente, setPendiente] = useState(false), [error, setError] = useState<string | null>(null);
  const [importado, setImportado] = useState(false);
  const solicitud = useRef<AbortController | null>(null), cursor = useRef(0);
  const ultimaPeticion = useRef<unknown>(null);
  const es = idioma === "es";
  const t = (en: string, esp: string) => es ? esp : en;
  useAvisoCarga(pendiente, t("Resolving the experiment…", "Resolviendo el experimento…"), t("Checking orders and preparing the recorded sequence.", "Validando órdenes y preparando la secuencia registrada."));
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const cambiar = () => setReducido(media.matches); cambiar();
    media.addEventListener("change", cambiar);
    return () => media.removeEventListener("change", cambiar);
  }, []);
  useEffect(() => () => solicitud.current?.abort(), []);
  useEffect(() => { cursor.current = tiempo; }, [tiempo]);
  useEffect(() => {
    if (!reproduciendo) return;
    let frame = 0, anterior: number | undefined;
    let actual = cursor.current;
    const animar = (ahora: number) => {
      if (anterior !== undefined) actual = Math.min(registro.config.duracionS, actual + Math.min((ahora - anterior) / 1000, 0.25) * velocidad);
      anterior = ahora; cursor.current = actual; setTiempo(actual);
      if (actual >= registro.config.duracionS) setReproduciendo(false);
      else frame = requestAnimationFrame(animar);
    };
    frame = requestAnimationFrame(animar);
    const ocultar = () => { if (document.hidden) setReproduciendo(false); };
    document.addEventListener("visibilitychange", ocultar);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", ocultar); };
  }, [reproduciendo, registro, velocidad]);
  const cancelar = () => { solicitud.current?.abort(); solicitud.current = null; setPendiente(false); };
  const ejecutar = async (payload: unknown) => {
    solicitud.current?.abort();
    const controlador = new AbortController(); solicitud.current = controlador;
    ultimaPeticion.current = payload;
    setPendiente(true); setError(null); setReproduciendo(false);
    try {
      let cuerpo = payload;
      if (payload === "ejemplo") {
        const archivo = await fetch("/experimentos/arena-llm-v1.json", { signal: controlador.signal });
        if (!archivo.ok) throw new Error("ejemplo");
        cuerpo = { accion: "reproducir", registro: await archivo.json() as unknown };
      }
      const respuesta = await fetch("/api/arena", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo), signal: controlador.signal });
      if (!respuesta.ok) throw new Error("respuesta");
      const siguiente = await respuesta.json() as RegistroArena;
      if (solicitud.current !== controlador) return;
      setRegistro(siguiente); setTiempo(0); cursor.current = 0;
      setImportado((cuerpo as { accion: string }).accion === "reproducir");
    } catch {
      if (!controlador.signal.aborted && solicitud.current === controlador) setError(t("Could not validate or run this experiment. Your previous run is still available.", "No se pudo validar o ejecutar el experimento. El anterior sigue disponible."));
    } finally {
      if (solicitud.current === controlador) { solicitud.current = null; setPendiente(false); }
    }
  };
  const simular = (ev: FormEvent) => {
    ev.preventDefault(); if (pendiente) return;
    if (!/^\d+$/.test(seed) || Number(seed) > 4294967295) { setError(t("Enter a whole seed from 0 to 4294967295.", "Escribe una semilla entera entre 0 y 4294967295.")); return; }
    void ejecutar({ accion: "simular", seed: Number(seed), segundos, local, visita });
  };
  const cargar = async (archivo: File | undefined) => {
    if (!archivo || pendiente) return;
    if (archivo.size > ARENA.archivoMaxBytes) { setError(t("The recording exceeds 8 MB.", "El registro supera los 8 MB.")); return; }
    try { await ejecutar({ accion: "reproducir", registro: JSON.parse(await archivo.text()) as unknown }); }
    catch { setError(t("Choose a valid JSON recording.", "Selecciona un registro JSON válido.")); }
  };
  const descargar = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(registro) + "\n"], { type: "application/json" }));
    const enlace = document.createElement("a"); enlace.href = url; enlace.download = `cronista-arena-${registro.config.partido.seed}.json`;
    enlace.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const estado = estadoVisual(registro, tiempo, reducido);
  const ronda = registro.rondas.find(r => tiempo / ARENA.pasoS >= r.inicioTick && tiempo / ARENA.pasoS < r.finTick) ?? registro.rondas.at(-1)!;
  const eventos = registro.eventos.filter(e => reducido ? e.tick <= estado.tick : e.tick * ARENA.pasoS <= tiempo + Number.EPSILON * ARENA.duracionMaxS);
  const decisiones = Object.values(ronda.decisiones);
  const tieneLlm = decisiones.some(d => d.tipo === "llm");
  const nombres = registro.config.partido;
  const saltar = (s: number) => { setReproduciendo(false); setTiempo(s); cursor.current = s; };
  return <>
    <header className="topbar arena-topbar">
      <Link href="/" className="brand" prefetch={false}><span className="brand-mark">CRONISTA</span><span className="brand-tag">{t("Team agents lab", "Laboratorio de equipos")}</span></Link>
      <nav className="topbar-links" aria-label={t("Sections", "Secciones")}><Link href="/" prefetch={false}>{t("Match reports", "Crónicas")}</Link><button className="btn" onClick={() => setIdioma(es ? "en" : "es")} aria-label={t("Switch to Spanish", "Cambiar a inglés")}>{es ? "EN" : "ES"}</button></nav>
    </header>
    <main className="arena-shell" lang={idioma} data-testid="arena">
      <div className="arena-intro"><p className="overline">{t("Experimental · simulated football", "Experimental · fútbol simulado")}</p>
        <h1>{t("Two teams. One shared pitch.", "Dos equipos. Una misma cancha.")}</h1>
        <p>{t("Each controller proposes a plan for eleven players. One shared engine resolves movement, the ball and the outcome.", "Cada controlador propone un plan para once jugadores. Un motor compartido resuelve movimientos, balón y resultados.")}</p>
      </div>
      <form className="arena-settings" onSubmit={simular} aria-busy={pendiente}>
        <label>{t("Seed", "Semilla")}<input className="field" value={seed} onChange={e => setSeed(e.target.value)} inputMode="numeric" disabled={pendiente} /></label>
        <label>{t("Home formation", "Formación local")}<select className="field" value={local} disabled={pendiente} onChange={e => setLocal(e.target.value as FormacionArena)}>{formaciones.map(f => <option key={f}>{f}</option>)}</select></label>
        <label>{t("Away formation", "Formación visitante")}<select className="field" value={visita} disabled={pendiente} onChange={e => setVisita(e.target.value as FormacionArena)}>{formaciones.map(f => <option key={f}>{f}</option>)}</select></label>
        <label>{t("Simulated duration", "Duración simulada")}<select className="field" value={segundos} disabled={pendiente} onChange={e => setSegundos(Number(e.target.value))}><option value="30">30 s</option><option value="60">60 s</option><option value="180">180 s</option></select></label>
        <button className="btn btn-primary" disabled={pendiente}>{t("Run programmed teams", "Ejecutar equipos programados")}</button>
      </form>
      <div className="arena-tools">
        <button className="btn" onClick={() => void ejecutar("ejemplo")} disabled={pendiente}>{t("Load recorded AI run", "Cargar ejemplo de IA grabado")}</button>
        <label className="btn arena-file">{t("Open saved run", "Abrir registro guardado")}<input type="file" accept="application/json,.json" disabled={pendiente} aria-label={t("Open saved run", "Abrir registro guardado")} onChange={e => { void cargar(e.target.files?.[0]); e.target.value = ""; }} /></label>
        <button className="btn" onClick={descargar} disabled={pendiente}>{t("Download run", "Descargar registro")}</button>
        <span className="arena-muted">{t("Programmed runs make no AI calls. Import runs generated by the model CLI.", "El modo programado no llama a IA. Puedes importar ejecuciones de la CLI con modelos.")}</span>
      </div>
      {pendiente && <div className="arena-notice" role="status"><IndicadorCarga />{t("Resolving orders and validating the sequence…", "Resolviendo órdenes y validando la secuencia…")}<button className="btn" onClick={cancelar}>{t("Cancel", "Cancelar")}</button></div>}
      {error && <div className="arena-notice" role="alert">{error}{ultimaPeticion.current !== null && <button className="btn" onClick={() => void ejecutar(ultimaPeticion.current)} disabled={pendiente}>{t("Retry", "Reintentar")}</button>}</div>}
      <div className="arena-grid">
        <section className="arena-board" aria-label={t("Simulated pitch", "Cancha simulada")}>
          <div className="arena-score"><span>{nombres.local.nombre}</span><strong className="tnum">{estado.marcador.local}–{estado.marcador.visita}</strong><span>{nombres.visita.nombre}</span></div>
          <div className="arena-pitch-wrap"><svg viewBox="-5 -5 115 78" role="img" aria-label={t("22 simulated players and the ball; home attacks right", "22 jugadores simulados y el balón; el local ataca hacia la derecha")} data-testid="arena-pitch">
            <rect className="arena-grass" x="0" y="0" width="105" height="68" />
            <g className="arena-lines"><path d="M52.5 0v68" /><circle cx="52.5" cy="34" r="9.15" /><rect x="0" y="13.84" width="16.5" height="40.32" /><rect x="88.5" y="13.84" width="16.5" height="40.32" /><rect x="0" y="24.84" width="5.5" height="18.32" /><rect x="99.5" y="24.84" width="5.5" height="18.32" /><path d="M0 30.34h-2v7.32h2 M105 30.34h2v7.32h-2" /></g>
            {estado.jugadores.map(j => <g key={j.id} data-testid="arena-player" data-player={j.id} transform={`translate(${j.posicion.x} ${j.posicion.y})`} className={`arena-player arena-${j.lado}`}><title>{`${j.nombre} · ${j.dorsal} · ${j.puesto}`}</title><circle r="1.9" /><text textAnchor="middle" dominantBaseline="central">{j.dorsal}</text></g>)}
            <circle className="arena-ball" cx={estado.balon.posicion.x} cy={estado.balon.posicion.y} r="0.8" data-testid="arena-ball" />
          </svg></div>
          <div className="arena-direction"><span>● {t("Home →", "Local →")}</span><span>{t("← Away", "← Visitante")} ○</span></div>
          <div className="arena-playback"><button className="btn btn-primary" onClick={() => { if (tiempo >= registro.config.duracionS) saltar(0); setReproduciendo(!reproduciendo); }} aria-pressed={reproduciendo} disabled={pendiente}>{reproduciendo ? t("Pause", "Pausar") : t("Play", "Reproducir")}</button>
            <button className="btn" onClick={() => saltar(0)}>{t("Restart", "Volver al inicio")}</button>
            <label>{t("Speed", "Velocidad")}<select className="field" value={velocidad} onChange={e => setVelocidad(Number(e.target.value))}><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
            <output className="tnum" data-testid="arena-clock">{reloj(tiempo)} / {reloj(registro.config.duracionS)}</output>
          </div>
          <input className="arena-seek" type="range" min="0" max={registro.config.duracionS} step="0.1" value={tiempo} onChange={e => saltar(Number(e.target.value))} aria-label={t("Match time", "Tiempo de juego")} />
          <p className="arena-muted">{t("Continuous simulated movement; explicit ball cuts at simplified restarts. Playback starts paused.", "Movimiento continuo simulado; el balón se recoloca en reinicios simplificados. La reproducción empieza pausada.")}{reducido && t(" Reduced motion: discrete states.", " Movimiento reducido: estados discretos.")}</p>
        </section>
        <aside className="arena-decisions" aria-label={t("Team decisions", "Decisiones de los equipos")}>
          <p className="overline">{t("Decision window", "Intervalo de decisión")} {reloj(ronda.inicioTick * ARENA.pasoS)}–{reloj(ronda.finTick * ARENA.pasoS)}</p>
          {(["local", "visita"] as const).map(lado => {
            const d = ronda.decisiones[lado];
            const propio = estado.jugadores.find(j => j.id === estado.balon.poseedor)?.lado ?? estado.balon.vuelo?.lado;
            return <section className="arena-team-plan" key={lado}><h2>{nombres[lado].nombre}</h2>
              <p className="arena-shape">{registro.config.formaciones[lado]} → {estructura(registro.config.formaciones[lado], propio === lado)}</p>
              <p className="arena-muted arena-controller">{d.tipo === "llm" ? "LLM" : t("Programmed", "Programado")} · {d.controlador}</p>
              <p>{!es && (d.tipo === "programado" || d.origen === "respaldo") ? d.ordenes.intencion.startsWith("Progresar") ? "Progress with staggered support and keep cover behind the ball." : "Send one player towards the ball, provide cover and keep the block connected." : d.ordenes.intencion}</p>
              <p className="arena-muted">{t("Width", "Amplitud")}: {es ? d.ordenes.amplitud : ({ estrecha: "narrow", media: "medium", amplia: "wide" })[d.ordenes.amplitud]} · {t("Block", "Bloque")}: {es ? d.ordenes.bloque : ({ bajo: "low", medio: "mid", alto: "high" })[d.ordenes.bloque]}</p>
              {d.origen === "respaldo" && <p className="arena-fallback">{t("Programmed fallback", "Respaldo programado")}: {d.motivo}</p>}
              <details><summary>{t("11 player orders", "11 órdenes individuales")}</summary><ol>{d.ordenes.ordenes.map(o => {
                const j = estado.jugadores.find(j => j.id === o.jugador)!;
                return <li key={o.jugador}><strong>{j.dorsal} · {j.nombre}</strong><span>{j.puesto} · {o.accion} → ({Math.round(o.destino.x)}, {Math.round(o.destino.y)}) m</span></li>;
              })}</ol></details>
            </section>;
          })}
          <p className="arena-muted">{importado ? t("Imported recording: the server recomputed and checked its sequence. Controller identity is supplied by the file, not independently authenticated.", "Registro importado: el servidor recalculó y comprobó su secuencia. La identidad del controlador procede del archivo y no está autenticada de forma independiente.") : t("Both teams received the same state before their new orders were resolved.", "Ambos equipos recibieron el mismo estado antes de resolver sus nuevas órdenes.")}</p>
          {tieneLlm && <p className="arena-muted">{t("Archived model decisions; playback makes no new AI calls.", "Decisiones archivadas de modelos; reproducir no vuelve a llamar a IA.")}</p>}
          {decisiones.every(d => d.tipo === "llm") && decisiones[0]!.controlador === decisiones[1]!.controlador && <p className="arena-muted">{t("Two independent controllers using the same model deployment.", "Dos controladores independientes usando el mismo deployment de modelo.")}</p>}
        </aside>
      </div>
      <section className="arena-events" aria-label={t("Event narration", "Narración de eventos")}><h2>{t("What happened", "Lo que ocurrió")}</h2>
        <p className="arena-muted">{t("Template narration from engine events. An attempted pass becomes a reception only after contact is resolved. These sentences do not pass through the recap's V1–V8 verifier.", "Narración por plantillas desde eventos del motor. Un intento de pase solo se convierte en recepción tras resolver el contacto. Estas frases no pasan por el verificador V1–V8 de la crónica.")}</p>
        {eventos.length === 0 ? <p>{t("Play or move the timeline to inspect the events.", "Reproduce o avanza en la línea de tiempo para ver los eventos.")}</p> : <ol>{eventos.slice(-8).map(e => <li key={e.id}><button onClick={() => saltar(e.tick * ARENA.pasoS)} className="arena-event-time">{reloj(e.tick * ARENA.pasoS)}</button><span>{narrarEventoArena(e, registro, idioma)}</span><code>{e.id}</code></li>)}</ol>}
      </section>
      <details className="arena-limits"><summary>{t("Prototype scope and limitations", "Alcance y límites del prototipo")}</summary><p>{t("Short 2D open-play scenarios with fictional teams. Movement parameters are synthetic and uncalibrated. Restarts are simplified; this is not a full regulation match. No aerial play, fouls, cards, injuries, substitutions or change of ends. Existing match reports use their original simulator.", "Escenarios cortos de juego abierto 2D con equipos ficticios. Parámetros de movimiento sintéticos por calibrar. Reinicios simplificados: no es un partido reglamentario completo. Sin juego aéreo, faltas, tarjetas, lesiones, sustituciones o cambio de campo. Las crónicas existentes utilizan su simulador original.")}</p></details>
    </main>
  </>;
}
