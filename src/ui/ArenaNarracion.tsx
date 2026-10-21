"use client";
import { useEffect, useRef, useState } from "react";
import type { construirRelato, relatoIntervencion } from "../arena/relato";
import { RELATO_INTERVALOS, type IntervencionArena } from "../arena/protocolo";
import { instanteNarrado, wavMono, type TramoTemporal } from "../arena/pista-audio";
import { segmentoVozValido } from "../arena/turnos";
import { VOZ_BUFFER } from "../arena/buffer";

type Segmento = (ReturnType<typeof construirRelato> | ReturnType<typeof relatoIntervencion>) & { audio: { base64: string; tipo: string } | null };
type Pista = { clave: string; blob: Blob; segmentos: Segmento[]; tramos: TramoTemporal[] };
const rolDe = (s: Segmento) => "rol" in s ? s.rol : "narrador";
/** Brief 045 v3.1: en `completo`, las intervenciones del diario se insertan en la pista, cada una
 * tras el primer tramo del narrador cuyo `hastaTick ≥ tick`, como un tramo de ancho cero en
 * ticks (el cursor se detiene mientras habla el invitado). Nunca se generan nuevas. */
export function ArenaNarracion({ sesion, archivo, alRegistrar, hastaTick, enDirecto, idioma, seleccionarTiempo, alActividadAudio, intervenciones = [] }: { sesion: string | null; archivo: "duelo" | "ejemplo-v3" | "ejemplo" | null; alRegistrar: (id: string) => void; hastaTick: number; enDirecto: boolean; idioma: "es" | "en"; seleccionarTiempo: (tick: number) => void; alActividadAudio: (activa: boolean) => void; intervenciones?: readonly IntervencionArena[] }) {
  const es = idioma === "es", t = (en: string, esp: string) => es ? esp : en;
  const [disponible, setDisponible] = useState(false), [modo, setModo] = useState<"apagado" | "vivo" | "completo">("apagado");
  const [segmento, setSegmento] = useState<Segmento | null>(null), [url, setUrl] = useState<string | null>(null), [version, setVersion] = useState(0), [estado, setEstado] = useState("listo");
  const [progreso, setProgreso] = useState({ listos: 0, total: 0 });
  const audio = useRef<HTMLAudioElement | null>(null), desde = useRef(0), ocupado = useRef(false), generacion = useRef(0), peticion = useRef<AbortController | null>(null);
  const pista = useRef<Pista | null>(null);
  const seleccionar = useRef(seleccionarTiempo); seleccionar.current = seleccionarTiempo;
  const diario = useRef(intervenciones); diario.current = intervenciones;
  const activarArchivo = async () => {
    if (!archivo || ocupado.current) return;
    ocupado.current = true; setEstado("preparando");
    const a = new AbortController(), g = generacion.current; peticion.current = a;
    try { const r = await fetch("/api/arena/grabaciones", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ archivo }), signal: a.signal }); if (!r.ok) throw new Error("Grabación"); const s = await r.json() as { id: string }; if (g === generacion.current && !a.signal.aborted) alRegistrar(s.id); }
    catch { if (!a.signal.aborted) setEstado("error"); } finally { if (g === generacion.current) ocupado.current = false; }
  };
  useEffect(() => { const a = new AbortController(); void fetch("/api/arena/herramientas", { signal: a.signal }).then(r => r.json()).then(r => setDisponible(r.voz)).catch(() => {}); return () => a.abort(); }, []);
  useEffect(() => { pista.current = null; setModo("apagado"); setSegmento(null); setEstado("listo"); }, [sesion, archivo, idioma]);
  useEffect(() => { alActividadAudio(modo === "completo"); return () => alActividadAudio(false); }, [modo, alActividadAudio]);
  useEffect(() => {
    generacion.current++; peticion.current?.abort(); ocupado.current = false; audio.current?.pause(); setUrl(null); if (modo !== "apagado") setSegmento(null);
    setProgreso({ listos: 0, total: 0 });
    const intervalo = RELATO_INTERVALOS.vivo;
    desde.current = modo === "vivo" ? Math.max(0, Math.floor(hastaTick / intervalo) * intervalo - intervalo) : 0;
    setEstado(anterior => modo === "apagado" ? anterior === "error" || anterior === "final" ? anterior : "listo" : "esperando");
    return () => { generacion.current++; peticion.current?.abort(); audio.current?.pause(); };
    // Cambiar el reloj no reinicia una solicitud o un audio ya en reproducción.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, idioma, sesion, archivo]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => {
    if (modo === "apagado" || !sesion || !disponible || ocupado.current || url) return;
    const intervalo = RELATO_INTERVALOS[modo];
    const fin = Math.min(desde.current + intervalo, hastaTick);
    if (fin <= desde.current || enDirecto && fin - desde.current < intervalo) { setEstado(enDirecto ? "esperando" : "final"); if (!enDirecto) setModo("apagado"); return; }
    ocupado.current = true; setEstado("preparando");
    const a = new AbortController(), g = generacion.current; peticion.current = a;
    const vigente = () => g === generacion.current && !a.signal.aborted;
    const solicitar = async (desdeTick: number, hasta: number) => {
      const r = await fetch(`/api/arena/sesiones/${sesion}/relato`, { method: "POST", headers: { "content-type": "application/json" }, signal: a.signal, body: JSON.stringify({ desdeTick, hastaTick: hasta, modo, idioma }) });
      if (!r.ok) throw new Error("Relato");
      const s = await r.json() as Segmento;
      if (s.desdeTick !== desdeTick || s.hastaTick !== hasta || s.idioma !== idioma) throw new Error("Tramo inconsistente");
      return s;
    };
    // La intervención se lee del diario por su id (modo buffer, sin memoria): nunca se regenera.
    // Brief 048: la repetición guardada pide siempre la variante completa.
    const solicitarInvitado = async (i: IntervencionArena) => {
      const r = await fetch(`/api/arena/sesiones/${sesion}/relato`, { method: "POST", headers: { "content-type": "application/json" }, signal: a.signal, body: JSON.stringify({ desdeTick: i.tick, hastaTick: i.tick, modo: "buffer", idioma, intervencion: i.id, variante: "completa" }) });
      if (!r.ok) throw new Error("Intervención");
      const s = await r.json() as Segmento;
      if (!segmentoVozValido(s, { desde: i.tick, hasta: i.tick, idioma, intervencion: { id: i.id, tick: i.tick, variante: "completa" } })) throw new Error("Intervención inconsistente");
      return s;
    };
    void (async () => {
      let decodificador: AudioContext | undefined;
      try {
        if (modo === "completo") {
          const invitados = diario.current.filter(i => i.tick <= hastaTick).sort((x, y) => x.tick - y.tick);
          const clave = `${sesion}:${idioma}:${hastaTick}:${invitados.map(i => i.id).join(",")}`;
          let lista = pista.current?.clave === clave ? pista.current : null;
          if (!lista) {
            decodificador = new AudioContext({ sampleRate: 24000 });
            const segmentos: Segmento[] = [], tramos: TramoTemporal[] = [], muestras: Float32Array[] = [];
            let duracion = 0;
            // Cada intervención va tras el primer tramo del narrador cuyo hastaTick ≥ tick.
            const piezas: ({ desde: number; hasta: number } | IntervencionArena)[] = [];
            for (let inicio = 0, k = 0; inicio < hastaTick; inicio += intervalo) {
              const hasta = Math.min(inicio + intervalo, hastaTick);
              piezas.push({ desde: inicio, hasta });
              while (k < invitados.length && invitados[k]!.tick <= hasta) piezas.push(invitados[k++]!);
            }
            let total = piezas.length; setProgreso({ listos: 0, total });
            const decodificar = async (s: Segmento) => {
              const bytes = Uint8Array.from(atob(s.audio!.base64), c => c.charCodeAt(0));
              const buffer = await decodificador!.decodeAudioData(bytes.buffer);
              if (!buffer.length || !Number.isFinite(buffer.duration) || buffer.duration <= 0 || buffer.numberOfChannels !== 1) throw new Error("Audio inválido");
              return buffer;
            };
            for (const pieza of piezas) {
              let s: Segmento, buffer: AudioBuffer;
              if ("id" in pieza) {
                // Una intervención cuyo audio falle o no valide se omite sin romper la pista.
                // Como en la emisión en directo, un clip más largo que duracionMaxS se omite (no se recorta).
                try {
                  s = await solicitarInvitado(pieza); if (!vigente()) return; buffer = await decodificar(s);
                  if (buffer.duration > VOZ_BUFFER.duracionMaxS) throw new Error("Intervención demasiado larga");
                } catch { if (!vigente()) return; total--; setProgreso({ listos: segmentos.length, total }); continue; }
              } else {
                s = await solicitar(pieza.desde, pieza.hasta);
                if (!vigente()) return;
                if (!s.audio) throw new Error("Falta audio completo");
                buffer = await decodificar(s);
              }
              if (!vigente()) return;
              muestras.push(buffer.getChannelData(0).slice());
              segmentos.push(s); tramos.push({ inicioS: duracion, finS: duracion + buffer.duration, desdeTick: s.desdeTick, hastaTick: s.hastaTick });
              duracion += buffer.duration;
              if (duracion * decodificador.sampleRate * 2 > 60_000_000) throw new Error("Pista demasiado larga");
              setProgreso({ listos: segmentos.length, total });
            }
            lista = { clave, segmentos, tramos, blob: wavMono(muestras, decodificador.sampleRate) };
            if (!vigente()) return;
            pista.current = lista;
          }
          setSegmento(lista.segmentos[0]!); seleccionar.current(0);
          setUrl(URL.createObjectURL(lista.blob)); setEstado("reproduciendo");
        } else {
          const s = await solicitar(desde.current, fin);
          if (!vigente()) return;
          setSegmento(s);
          if (!s.audio) { desde.current = fin; setVersion(v => v + 1); setEstado("esperando"); return; }
          const bytes = Uint8Array.from(atob(s.audio.base64), c => c.charCodeAt(0));
          setUrl(URL.createObjectURL(new Blob([bytes], { type: s.audio.tipo }))); setEstado("reproduciendo");
        }
      } catch { if (vigente()) { setEstado("error"); setModo("apagado"); } }
      finally { await decodificador?.close().catch(() => {}); if (g === generacion.current) ocupado.current = false; }
    })();
  }, [modo, sesion, disponible, hastaTick, enDirecto, idioma, version, url]);
  useEffect(() => { if (url) void audio.current?.play().catch(() => setEstado("pulsar")); }, [url]);
  const sincronizar = () => {
    if (modo !== "completo" || !pista.current || !audio.current) return;
    const instante = instanteNarrado(pista.current.tramos, audio.current.currentTime);
    setSegmento(pista.current.segmentos[instante.indice]!); seleccionar.current(instante.tick);
  };
  useEffect(() => {
    if (modo !== "completo" || !url) return;
    let frame = 0;
    const avanzar = () => {
      if (audio.current && !audio.current.paused) sincronizar();
      frame = requestAnimationFrame(avanzar);
    };
    frame = requestAnimationFrame(avanzar);
    return () => cancelAnimationFrame(frame);
    // El audio es el reloj maestro; los callbacks actualizados viven en refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, url]);
  const terminar = () => {
    if (modo === "completo" && pista.current) {
      seleccionar.current(hastaTick); setSegmento(pista.current.segmentos.at(-1)!); setEstado("final"); setModo("apagado");
    } else if (segmento) { desde.current = segmento.hastaTick; setUrl(null); setVersion(v => v + 1); }
  };
  const textos: Record<string, string> = { listo: t("Audio off", "Audio desactivado"), esperando: t("Waiting for confirmed play…", "Esperando jugadas confirmadas…"), preparando: modo === "completo" && progreso.total ? t(`Preparing narration: ${progreso.listos}/${progreso.total} passages`, `Preparando narración: ${progreso.listos}/${progreso.total} tramos`) : t("Preparing the next passage…", "Preparando el siguiente tramo…"), reproduciendo: t("Narration playing", "Narración en reproducción"), pulsar: t("Press play to listen", "Pulsa reproducir para escuchar"), final: t("End of narration", "Fin de la narración"), error: t("Narration unavailable or request budget reached", "Narración no disponible o presupuesto de consultas agotado") };
  return <section className="arena-intelligence" data-testid="arena-narration" aria-label={t("Match audio narration", "Narración del partido")}>
    <h2>{t("Listen to the match", "Escucha el partido")}</h2>
    <p className="arena-muted">{t("Listen to a continuous account of this recording. The pitch follows the voice; the account may take longer than the match.", "Escucha un relato continuo de esta grabación. La cancha sigue la voz; el relato puede durar más que el partido.")}</p>
    <div className="arena-live-controls">
      {!sesion && archivo && disponible && <button className="btn" disabled={ocupado.current} onClick={() => void activarArchivo()}>{t("Enable narration for this recording", "Activar narración de esta grabación")}</button>}
      {enDirecto && <button className="btn" disabled={!sesion || !disponible} aria-pressed={modo === "vivo"} onClick={() => setModo(modo === "vivo" ? "apagado" : "vivo")}>{t("Live narration", "Narración en vivo")}</button>}
      <button className="btn" disabled={!sesion || !disponible || enDirecto || modo === "completo"} aria-pressed={modo === "completo"} onClick={() => setModo("completo")}>{t("Listen from the start", "Escuchar desde el inicio")}</button>
      {modo !== "apagado" && <button className="btn" onClick={() => setModo("apagado")}>{t("Stop narration", "Detener narración")}</button>}
    </div>
    {!sesion && !archivo && <p className="arena-muted">{t("Generate a match to enable its narration.", "Genera un encuentro para activar su narración.")}</p>}
    {sesion && !disponible && <p className="arena-muted">{t("Audio is currently unavailable.", "El audio no está disponible en este momento.")}</p>}
    <p role="status" data-progress-ready={progreso.listos} data-progress-total={progreso.total}>{textos[estado]}</p>
    <audio ref={audio} controls src={url ?? undefined} aria-label={t("Match narration audio", "Audio de narración del partido")} onTimeUpdate={sincronizar} onSeeked={sincronizar} onEnded={terminar} onError={() => { if (url) { setEstado("error"); setModo("apagado"); } }} />
    {segmento && <details data-testid="arena-narration-transcript" data-narration-role={rolDe(segmento)} data-narration-tick={segmento.desdeTick} data-narration-variant={"variante" in segmento ? segmento.variante : undefined}><summary>{t("Transcript and match evidence", "Transcripción y evidencia del partido")} · {(segmento.desdeTick / 10).toFixed(0)}–{(segmento.hastaTick / 10).toFixed(0)} s</summary>{segmento.fragmentos.map((f, k) => <p key={k} data-narration-role={f.rol ?? "narrador"}>{f.texto}</p>)}<p className="arena-muted">{segmento.fuentes.join(" · ")}{!!segmento.fotogramas?.length && ` · ${t("Observed positions at", "Posiciones observadas a los")} ${segmento.fotogramas.map(tick => `${(tick / 10).toFixed(1)} s`).join(" · ")}`}</p></details>}
  </section>;
}
