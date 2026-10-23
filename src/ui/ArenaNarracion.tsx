"use client";
import { useEffect, useRef, useState } from "react";
import type { construirRelato, relatoIntervencion } from "../arena/relato";
import { RELATO_INTERVALOS, type IntervencionArena } from "../arena/protocolo";
import { instanteAudio, instanteNarrado, PISTA_MAX_PCM_BYTES, wavMono, type TramoTemporal } from "../arena/pista-audio";
import { nombreDescarga } from "../arena/transcripcion";
import { descargarBlob } from "./ArenaDescargas";
import { esperaReintentoInvitado, segmentoVozValido, type FalloInvitado } from "../arena/turnos";
import { VOZ_BUFFER } from "../arena/buffer";
import { esPrevia } from "../arena/previa";
import type { RegistroArena } from "../arena/tipos";
import { ARENA, PLAY_NARRADO } from "../sim/limites";
import { consumirIntencion, decisionReintento429, motivoRelato, type ControlesNarracion, type EstadoNarracion, type FaseNarracion, type IntencionInicio, type MotivoNarracion } from "./play-narrado";

export type { ControlesNarracion, EstadoNarracion, FaseNarracion, MotivoNarracion } from "./play-narrado";

type Segmento = (ReturnType<typeof construirRelato> | ReturnType<typeof relatoIntervencion>) & { audio: { base64: string; tipo: string } | null };
/** Brief 053 v1.1 § 9 · La pista guarda el `hastaTick` y el idioma con que se construyó: el WAV los usa. */
type Pista = { clave: string; blob: Blob; segmentos: Segmento[]; tramos: TramoTemporal[]; hastaTick: number; idioma: "es" | "en" };
const rolDe = (s: Segmento) => "rol" in s ? s.rol : "narrador";
/** Brief 057 § 3.2 · Fallo HTTP de un tramo del narrador: su estado decide el motivo (v1.1 § 8). */
class FalloRelato extends Error { constructor(readonly status: number) { super("Relato"); } }
/** v1.3 (1) · Subida rechazada por cupo (429 con retry-after mayor que reintentoMaxS, o tras el único reintento). */
class FalloOcupado extends Error { constructor(readonly minutos: number) { super("Ocupado"); } }
/** Un registro completo cubre la duración configurada (o terminó antes por final anticipado). */
const registroCompleto = (r: RegistroArena) => r.final.tick >= Math.round(r.config.duracionS / ARENA.pasoS) || Boolean(r.final.finalizado);
/** Brief 045 v3.1: en `completo`, las intervenciones del diario se insertan en la pista, cada una
 * tras el primer tramo del narrador cuyo `hastaTick ≥ tick`, como un tramo de ancho cero en
 * ticks (el cursor se detiene mientras habla el invitado). Nunca se generan nuevas.
 * Brief 057 § 3.2 · `registro`, `carga`, `alEstado` y `alControles`: la barra de `Arena` gobierna la misma pista
 * (fases, controles estables) y cualquier grabación completa puede registrarse por subida. `sinPartido` oculta el
 * botón de registro sobre la vista previa inicial de la página (no es un partido elegido por el espectador). */
export function ArenaNarracion({ sesion, archivo, alRegistrar, hastaTick, enDirecto, idioma, seleccionarTiempo, alActividadAudio, intervenciones = [], seed, registro, carga = 0, alEstado, alControles, sinPartido = false }: { seed: number; sesion: string | null; archivo: "duelo" | "ejemplo-v3" | "ejemplo" | null; alRegistrar: (id: string) => void; hastaTick: number; enDirecto: boolean; idioma: "es" | "en"; seleccionarTiempo: (tick: number) => void; alActividadAudio: (activa: boolean) => void; intervenciones?: readonly IntervencionArena[]; registro?: RegistroArena; carga?: number; alEstado?: (e: EstadoNarracion) => void; alControles?: (c: ControlesNarracion) => void; sinPartido?: boolean }) {
  const es = idioma === "es", t = (en: string, esp: string) => es ? esp : en;
  const [disponible, setDisponible] = useState(false), [modo, setModo] = useState<"apagado" | "vivo" | "completo">("apagado");
  const [segmento, setSegmento] = useState<Segmento | null>(null), [url, setUrl] = useState<string | null>(null), [version, setVersion] = useState(0), [estado, setEstado] = useState("listo");
  const [progreso, setProgreso] = useState({ listos: 0, total: 0 });
  // Brief 057 · Registro de la grabación en curso, motivo del último fallo y estado del <audio> (play/pause).
  const [registrando, setRegistrando] = useState(false), [motivo, setMotivo] = useState<MotivoNarracion | null>(null), [pausado, setPausado] = useState(true);
  const [reRegistro, setReRegistro] = useState(0), [minutos, setMinutos] = useState<number | undefined>(undefined);
  /** v1.3 (3) · Tick del cursor con que se pidió la pista y segundo de audio pendiente de buscar al cargarla. */
  const inicioTick = useRef(0), inicioAudio = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null), desde = useRef(0), ocupado = useRef(false), generacion = useRef(0), peticion = useRef<AbortController | null>(null);
  const pista = useRef<Pista | null>(null);
  /** v1.1 § 2 · Intención de inicio mientras se registra; se consume al adoptar la sesión nueva. */
  const inicioPendiente = useRef<IntencionInicio | null>(null);
  /** v1.1 § 8 · Un solo re-registro por subida tras un 404 de `relato` por cada pulsación de Reproducir. */
  const reRegistrado = useRef(false);
  /** Codex 057 (impl., #1) · Identidad carga+idioma para la que se pidió la pista completa. La sellan solo los
   * arranques explícitos (Reproducir, «Escuchar desde el inicio», intención consumida) y el reinicio la borra: un
   * render invalidado por un cambio de carga o idioma nunca inicia una preparación. */
  const pistaPedida = useRef<IntencionInicio | null>(null);
  // Brief 053: el botón de WAV sigue a `pista.current` (se deriva tras cada asignación).
  const [pistaLista, setPistaLista] = useState(false);
  const seleccionar = useRef(seleccionarTiempo); seleccionar.current = seleccionarTiempo;
  const diario = useRef(intervenciones); diario.current = intervenciones;
  const actual = useRef({ sesion, archivo, registro, carga, idioma, disponible, modo, alRegistrar });
  actual.current = { sesion, archivo, registro, carga, idioma, disponible, modo, alRegistrar };
  const dormir = (ms: number, senal: AbortSignal) => new Promise<void>((resolver, rechazar) => {
    const espera = setTimeout(resolver, ms);
    senal.addEventListener("abort", () => { clearTimeout(espera); rechazar(new Error("Cancelada")); }, { once: true });
  });
  /** § 3.3 · Registra la grabación (archivo del repositorio o registro subido) y adopta su sesión. Un 429 se
   * se reintenta una sola vez si retry-after ≤ subida.reintentoMaxS; si no, `ocupado` al momento (v1.3 § 1).
   * Cualquier otro fallo → `sin-sesion`.
   * Toda respuesta tardía se descarta con `vigente()` (cambio de carga o idioma, detener). */
  const registrar = async () => {
    const { archivo, registro, sesion: previa } = actual.current;
    if (ocupado.current || (!archivo && !registro)) return;
    ocupado.current = true; setRegistrando(true); setMotivo(null); setEstado(e => e === "error" || e === "final" ? "listo" : e);
    const a = new AbortController(), g = generacion.current; peticion.current = a;
    const vigente = () => g === generacion.current && !a.signal.aborted;
    let adoptada = false;
    try {
      const cuerpo = JSON.stringify(archivo ? { archivo } : { registro });
      for (let intento = 0; ; intento++) {
        const r = await fetch("/api/arena/grabaciones", { method: "POST", headers: { "content-type": "application/json" }, body: cuerpo, signal: a.signal });
        if (!vigente()) return;
        // v1.3 (1) · Un solo reintento, y solo si retry-after ≤ reintentoMaxS; si no, degradación inmediata.
        if (r.status === 429) {
          const d = decisionReintento429(r.headers.get("retry-after"), PLAY_NARRADO.subida.reintentoMaxS, intento > 0);
          if (!d.reintentar) throw new FalloOcupado(d.minutos);
          await dormir(Math.max(PLAY_NARRADO.reintentoRegistroMs, d.esperaS * 1000), a.signal);
          if (!vigente()) return;
          continue;
        }
        if (!r.ok) throw new Error("Grabación");
        const s = await r.json() as { id: string };
        if (!vigente()) return;
        // Re-registro tras un 404 que devuelve la misma sesión: no hay nada nuevo que adoptar.
        if (s.id === previa) throw new FalloRelato(404);
        adoptada = inicioPendiente.current !== null;
        actual.current.alRegistrar(s.id);
        return;
      }
    } catch (error) {
      if (!vigente()) return;
      inicioPendiente.current = null;
      setEstado("error"); setModo("apagado"); setMinutos(error instanceof FalloOcupado ? error.minutos : undefined);
      setMotivo(error instanceof FalloRelato ? "caducada" : error instanceof FalloOcupado ? "ocupado" : "sin-sesion");
    } finally {
      // Con una intención pendiente, `registrando` sigue hasta que el reinicio la consume (sin fase intermedia).
      if (g === generacion.current) { ocupado.current = false; if (!adoptada) setRegistrando(false); }
    }
  };
  useEffect(() => { const a = new AbortController(); void fetch("/api/arena/herramientas", { signal: a.signal }).then(r => r.json()).then(r => setDisponible(r.voz)).catch(() => {}); return () => a.abort(); }, []);
  // v1.1 § 2 · Reinicio por sesión, archivo, idioma o carga: adopta la sesión nueva y consume la intención
  // pendiente solo si la carga y el idioma coinciden; si no, la descarta y la narración queda apagada.
  useEffect(() => {
    pista.current = null; setPistaLista(pista.current !== null); setSegmento(null); setEstado("listo"); setMotivo(null); setRegistrando(false);
    const intencion = consumirIntencion(inicioPendiente.current, carga, idioma); inicioPendiente.current = null;
    pistaPedida.current = intencion && sesion ? { carga, idioma } : null;
    setModo(intencion && sesion ? "completo" : "apagado");
  }, [sesion, archivo, idioma, carga]);
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
  }, [modo, idioma, sesion, archivo, carga]);
  // v1.1 § 8 · Re-registro único tras un 404 de `relato` (después del reinicio de generación de arriba).
  useEffect(() => {
    if (reRegistro) void registrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reRegistro]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => {
    if (modo === "apagado" || !sesion || !disponible || ocupado.current || url) return;
    if (modo === "completo" && (pistaPedida.current?.carga !== carga || pistaPedida.current.idioma !== idioma)) return;
    const intervalo = RELATO_INTERVALOS[modo];
    const fin = Math.min(desde.current + intervalo, hastaTick);
    if (fin <= desde.current || enDirecto && fin - desde.current < intervalo) { setEstado(enDirecto ? "esperando" : "final"); if (!enDirecto) setModo("apagado"); return; }
    ocupado.current = true; setEstado("preparando");
    const a = new AbortController(), g = generacion.current; peticion.current = a;
    const vigente = () => g === generacion.current && !a.signal.aborted;
    const solicitar = async (desdeTick: number, hasta: number) => {
      const r = await fetch(`/api/arena/sesiones/${sesion}/relato`, { method: "POST", headers: { "content-type": "application/json" }, signal: a.signal, body: JSON.stringify({ desdeTick, hastaTick: hasta, modo, idioma }) });
      if (!r.ok) throw new FalloRelato(r.status);
      const s = await r.json() as Segmento;
      if (s.desdeTick !== desdeTick || s.hastaTick !== hasta || s.idioma !== idioma) throw new Error("Tramo inconsistente");
      return s;
    };
    // La intervención se lee del diario por su id (modo buffer, sin memoria): nunca se regenera.
    // Brief 048: la repetición guardada pide siempre la variante completa.
    // Corrección 045/048: un 429 (p. ej. otras síntesis en curso en el servidor) o un fallo de red se
    // reintenta con espera (esperaReintentoInvitado, sin caducidad: la pista se prepara antes de sonar);
    // un 4xx/5xx distinto o un segmento inválido es final y la intervención se omite como antes.
    const solicitarInvitado = async (i: IntervencionArena): Promise<Segmento> => {
      for (let reintentos = 0; ; reintentos++) {
        let fallo: FalloInvitado = { tipo: "invalida" };
        try {
          const r = await fetch(`/api/arena/sesiones/${sesion}/relato`, { method: "POST", headers: { "content-type": "application/json" }, signal: a.signal, body: JSON.stringify({ desdeTick: i.tick, hastaTick: i.tick, modo: "buffer", idioma, intervencion: i.id, variante: "completa" }) })
            .catch((e: unknown) => { fallo = { tipo: "red" }; throw e; });
          if (!r.ok) { fallo = { tipo: "http", estado: r.status }; throw new Error("Intervención"); }
          const s = await r.json() as Segmento;
          if (!segmentoVozValido(s, { desde: i.tick, hasta: i.tick, idioma, intervencion: { id: i.id, tick: i.tick, variante: "completa" } })) throw new Error("Intervención inconsistente");
          return s;
        } catch (error) {
          const espera = vigente() ? esperaReintentoInvitado(fallo, reintentos, null, i.tema) : null;
          if (espera === null) throw error;
          await dormir(espera, a.signal);
        }
      }
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
            // Cada intervención va tras el primer tramo del narrador cuyo hastaTick ≥ tick. Brief 056 § 5.6: las
            // piezas de la previa van ANTES del primer tramo, como tramos de ancho cero [0, 0] (cursor en 0).
            const previas = invitados.filter(i => esPrevia(i)), resto = invitados.filter(i => !esPrevia(i));
            const piezas: ({ desde: number; hasta: number } | IntervencionArena)[] = [...previas];
            for (let inicio = 0, k = 0; inicio < hastaTick; inicio += intervalo) {
              const hasta = Math.min(inicio + intervalo, hastaTick);
              piezas.push({ desde: inicio, hasta });
              while (k < resto.length && resto[k]!.tick <= hasta) piezas.push(resto[k++]!);
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
              if (duracion * decodificador.sampleRate * 2 > PISTA_MAX_PCM_BYTES) throw new Error("Pista demasiado larga");
              setProgreso({ listos: segmentos.length, total });
            }
            lista = { clave, segmentos, tramos, blob: wavMono(muestras, decodificador.sampleRate), hastaTick, idioma };
            if (!vigente()) return;
            pista.current = lista; setPistaLista(pista.current !== null);
          }
          // v1.3 (3) · La pista empieza en el instante del cursor con que se pidió (0 en el tick 0: previa incluida).
          const inicio = instanteAudio(lista.tramos, inicioTick.current), instante = instanteNarrado(lista.tramos, inicio);
          inicioAudio.current = inicio;
          setSegmento(lista.segmentos[instante.indice]!); seleccionar.current(instante.tick);
          setUrl(URL.createObjectURL(lista.blob)); setEstado("reproduciendo");
        } else {
          const s = await solicitar(desde.current, fin);
          if (!vigente()) return;
          setSegmento(s);
          if (!s.audio) { desde.current = fin; setVersion(v => v + 1); setEstado("esperando"); return; }
          const bytes = Uint8Array.from(atob(s.audio.base64), c => c.charCodeAt(0));
          setUrl(URL.createObjectURL(new Blob([bytes], { type: s.audio.tipo }))); setEstado("reproduciendo");
        }
      } catch (error) {
        if (!vigente()) return;
        const status = error instanceof FalloRelato ? error.status : null;
        // v1.1 § 8 · Un 404 de la sesión (caducada o borrada): un único re-registro por subida, que adopta la
        // sesión nueva y retoma la pista; si vuelve a fallar, `caducada`.
        if (modo === "completo" && status === 404 && !reRegistrado.current && (actual.current.archivo || actual.current.registro)) {
          reRegistrado.current = true; inicioPendiente.current = { carga: actual.current.carga, idioma };
          setRegistrando(true); setModo("apagado"); setReRegistro(n => n + 1);
          return;
        }
        // v1.1 § 8 · 404 → caducada; 429 → presupuesto; 503 → sin-voz; otro 4xx/5xx o fallo de red/audio → red.
        setEstado("error"); setModo("apagado"); setMotivo(status === null ? "red" : motivoRelato(status));
      }
      finally { await decodificador?.close().catch(() => {}); if (g === generacion.current) ocupado.current = false; }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, sesion, disponible, hastaTick, enDirecto, idioma, version, url, carga]);
  /** Codex 057 (impl., #2) · Un resultado de audio.play() solo cuenta si la generación y la fuente siguen siendo
   * las del momento de la llamada: detener, cambiar de carga o idioma o reiniciar la pista lo descartan. */
  const reproducirAudio = (alResolver: (() => void) | null) => {
    const a = audio.current;
    if (!a?.src) return;
    const g = generacion.current, fuente = a.src;
    const vigente = () => g === generacion.current && audio.current === a && a.src === fuente;
    void a.play().then(() => { if (vigente()) alResolver?.(); }).catch(() => { if (vigente()) setEstado("pulsar"); });
  };
  /** v1.3 (3) · Búsqueda pendiente del inicio: se aplica ya y otra vez al cargar los metadatos. */
  const aplicarInicio = () => { const a = audio.current; if (a && inicioAudio.current > 0) { a.currentTime = inicioAudio.current; if (a.readyState >= 1) inicioAudio.current = 0; } };
  useEffect(() => { if (url) { aplicarInicio(); reproducirAudio(null); } else inicioAudio.current = 0; }, [url]);
  useEffect(() => { if (!url) setPausado(true); }, [url]);
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
  /** § 3.2 · `detener()`: cancela registro y peticiones en vuelo, pausa el <audio> y suelta la URL; nunca arranca nada. */
  const detener = () => {
    generacion.current++; peticion.current?.abort(); ocupado.current = false; inicioPendiente.current = null;
    audio.current?.pause(); setRegistrando(false); setUrl(null); setMotivo(null); setEstado("listo"); setModo("apagado");
  };
  // Brief 057 § 3.2 · Controles estables (un objeto por montaje) que leen siempre el último render.
  const impl = useRef({ detener, registrar, sincronizar, reproducirAudio });
  impl.current = { detener, registrar, sincronizar, reproducirAudio };
  const controles = useRef<ControlesNarracion>({
    iniciar: (desdeTick = 0) => {
      const { disponible, sesion, carga, idioma } = actual.current;
      inicioTick.current = Number.isFinite(desdeTick) ? Math.max(0, desdeTick) : 0;
      reRegistrado.current = false; setMotivo(null);
      if (!disponible) { setEstado("error"); setMotivo("sin-voz"); return; }
      if (!sesion) { inicioPendiente.current = { carga, idioma }; void impl.current.registrar(); return; }
      pistaPedida.current = { carga, idioma }; setModo("completo");
    },
    pausar: () => { audio.current?.pause(); },
    reanudar: () => impl.current.reproducirAudio(() => setEstado("reproduciendo")),
    buscar: tick => {
      const p = pista.current, a = audio.current;
      if (actual.current.modo !== "completo" || !p || !a || !a.src) return;
      a.currentTime = instanteAudio(p.tramos, tick);
      impl.current.sincronizar();
    },
    detener: () => impl.current.detener(),
  });
  useEffect(() => { alControles?.(controles.current); }, [alControles]);
  // § 3.2 · Fase derivada de lo que ya existe: modo, estado, progreso y los eventos del <audio>.
  const fase: FaseNarracion = registrando ? "registrando"
    : modo === "completo" ? estado === "reproduciendo" ? pausado ? "pausada" : "sonando" : estado === "pulsar" ? "pulsar" : "preparando"
    : estado === "error" ? "error" : estado === "final" ? "final" : "inactiva";
  const motivoVisible = fase === "error" ? motivo ?? undefined : undefined;
  const minutosVisibles = motivoVisible === "ocupado" ? minutos : undefined;
  useEffect(() => { alEstado?.({ fase, listos: progreso.listos, total: progreso.total, motivo: motivoVisible, minutos: minutosVisibles, vozDisponible: disponible }); }, [alEstado, fase, progreso.listos, progreso.total, motivoVisible, minutosVisibles, disponible]);
  const completa = registro ? registroCompleto(registro) : false;
  const registrable = !sesion && disponible && (archivo !== null || (!!registro && completa && !sinPartido));
  const textos: Record<string, string> = { listo: t("Audio off", "Audio desactivado"), esperando: t("Waiting for confirmed play…", "Esperando jugadas confirmadas…"), preparando: modo === "completo" && progreso.total ? t(`Preparing narration: ${progreso.listos}/${progreso.total} passages`, `Preparando narración: ${progreso.listos}/${progreso.total} tramos`) : t("Preparing the next passage…", "Preparando el siguiente tramo…"), reproduciendo: t("Narration playing", "Narración en reproducción"), pulsar: t("Press play to listen", "Pulsa reproducir para escuchar"), final: t("End of narration", "Fin de la narración"), error: t("Narration unavailable or request budget reached", "Narración no disponible o presupuesto de consultas agotado") };
  return <section className="arena-intelligence" data-testid="arena-narration" aria-label={t("Match audio narration", "Narración del partido")}>
    <h2>{t("Listen to the match", "Escucha el partido")}</h2>
    <p className="arena-muted">{t("Listen to a continuous account of this recording. The pitch follows the voice; the account may take longer than the match.", "Escucha un relato continuo de esta grabación. La cancha sigue la voz; el relato puede durar más que el partido.")}</p>
    <div className="arena-live-controls">
      {registrable && <button className="btn" disabled={registrando} onClick={() => void registrar()}>{t("Enable narration for this recording", "Activar narración de esta grabación")}</button>}
      {enDirecto && <button className="btn" disabled={!sesion || !disponible} aria-pressed={modo === "vivo"} onClick={() => setModo(modo === "vivo" ? "apagado" : "vivo")}>{t("Live narration", "Narración en vivo")}</button>}
      <button className="btn" disabled={!sesion || !disponible || enDirecto || modo === "completo"} aria-pressed={modo === "completo"} onClick={() => { inicioTick.current = 0; pistaPedida.current = { carga, idioma }; setModo("completo"); }}>{t("Listen from the start", "Escuchar desde el inicio")}</button>
      {(modo !== "apagado" || registrando) && <button className="btn" onClick={detener}>{t("Stop narration", "Detener narración")}</button>}
      {/* Brief 053 · El WAV es el mismo Blob de la pista: ninguna petición ni síntesis nueva. */}
      <button className="btn" data-testid="arena-narration-download" disabled={!pistaLista} onClick={() => { const p = pista.current; if (p) descargarBlob(nombreDescarga({ partido: { seed }, idioma: p.idioma, alcance: { hastaTick: p.hastaTick, parcial: false } }, "wav"), p.blob); }}>{t("Download audio (WAV)", "Descargar audio (WAV)")}</button>
    </div>
    {!pistaLista && sesion && disponible && <p className="arena-muted" data-testid="arena-narration-download-help">{t("Press “Listen from the start” to prepare the track; downloading does not generate new audio.", "Pulsa “Escuchar desde el inicio” para preparar la pista; la descarga no genera audio nuevo.")}</p>}
    {!sesion && !archivo && !registrable && <p className="arena-muted">{t("Generate a match to enable its narration.", "Genera un encuentro para activar su narración.")}</p>}
    {sesion && !disponible && <p className="arena-muted">{t("Audio is currently unavailable.", "El audio no está disponible en este momento.")}</p>}
    <p role="status" data-progress-ready={progreso.listos} data-progress-total={progreso.total}>{registrando ? t("Registering the recording…", "Registrando la grabación…") : textos[estado]}</p>
    <audio ref={audio} controls src={url ?? undefined} aria-label={t("Match narration audio", "Audio de narración del partido")} onTimeUpdate={sincronizar} onSeeked={sincronizar} onPlay={() => { setPausado(false); setEstado(e => e === "pulsar" ? "reproduciendo" : e); }} onLoadedMetadata={aplicarInicio} onPause={() => setPausado(true)} onEnded={() => { setPausado(true); terminar(); }} onError={() => { if (url) { setEstado("error"); setModo("apagado"); setMotivo("red"); } }} />
    {segmento && <details data-testid="arena-narration-transcript" data-narration-role={rolDe(segmento)} data-narration-tick={segmento.desdeTick} data-narration-variant={"variante" in segmento ? segmento.variante : undefined}><summary>{t("Transcript and match evidence", "Transcripción y evidencia del partido")} · {(segmento.desdeTick / 10).toFixed(0)}–{(segmento.hastaTick / 10).toFixed(0)} s</summary>{segmento.fragmentos.map((f, k) => <p key={k} data-narration-role={f.rol ?? "narrador"}>{f.texto}</p>)}<p className="arena-muted">{segmento.fuentes.join(" · ")}{!!segmento.fotogramas?.length && ` · ${t("Observed positions at", "Posiciones observadas a los")} ${segmento.fotogramas.map(tick => `${(tick / 10).toFixed(1)} s`).join(" · ")}`}</p></details>}
  </section>;
}
