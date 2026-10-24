"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { BUFFER_ARENA, firmaEstadoVoz, golSuperado, planVozBuffer, RelojBuffer, VOZ_BUFFER } from "../arena/buffer";
import { estadoVisual } from "../arena/vista";
import type { RegistroArena } from "../arena/tipos";
import type { construirRelato } from "../arena/relato";
import { elegirReservaVoz, ordenPrimeraVuelta, recordarVoz, repetidaVoz, type RecuerdoVoz } from "../arena/editorial";
import { ARCHIVO_INDICE_RESERVAS, leerIndiceReservas, RUTA_RESERVAS } from "../arena/reservas-voz";
import { caducidadInvitadoS, calmaEnFotograma, candidatasAlReactivar, descartesTurno, esperaReintentoCierre, esperaReintentoInvitado, estadoPorDuracion, estimarDuracionS, horizonteS, segmentoVozValido, siguienteTurno, varianteEfectiva, type EntradaTurno, type EstadoVariante, type FalloInvitado, type Rol } from "../arena/turnos";
import type { IntervencionArena, VarianteIntercambio } from "../arena/protocolo";
import { esPrevia } from "../arena/previa";
import { ANTESALA_ARENA, ARENA, MESA_ARENA, NARRACION_DIRECTO, RESERVAS_VOZ } from "../sim/limites";
import { activarAntesala, antesalaPartido, elegirSolicitud, focoDeAntesala, iniciarAntesala, type FocoAntesala, pasoAntesala, siguientePedidoAntesala, todosPedidosAntesala, vencimientoAntesalaMs, type ClaseSolicitud, type EstadoAntesala, type RespuestaClip, type SalidaAntesala } from "../arena/antesala";
import { arranquePropio, asignacionDirecto, descartarAudioCebado, guardarPreferenciaNarracion, instanteArranquePropio, leerPreferenciaNarracion, narracionAutomatica, suscribirAsignacionDirecto, tomarAudioCebado } from "./audio-directo";

type Segmento = Omit<ReturnType<typeof construirRelato>, "tipoRelato"> & { audio: { base64: string; tipo: string } | null; prioridad?: number; cierre?: boolean; firmaEstado?: string; claveVoz?: string; temaVoz?: string; tipoRelato?: "jugada" | "comentario" | "estado" | "entrada" | "cierre" | "invitado"; rol?: Rol; intervencion?: string; variante?: VarianteIntercambio; turnos?: number };
type Clip = { segmento: Segmento; audio: AudioBuffer; consumido: boolean };
/** Brief 048 v1.1 · Estado explícito de cada variante de un intercambio en este consumidor.
 * Corrección 045/048: una variante a la espera de reintento vuelve a `sin-pedir` (pendiente para el
 * coordinador) con sus `reintentos` hechos y `noAntesDe` (performance.now(), ms), primer instante en
 * que puede volver a pedirse. */
type VarianteLocal = { estado: "inexistente" | "sin-pedir" | "pidiendo" | "valida" | "invalida" | "fallida"; clip?: Clip; reintentos?: number; noAntesDe?: number };
/** La variante puede pedirse ya: sin pedir y sin una espera de reintento vigente. */
const pedible = (v: VarianteLocal) => v.estado === "sin-pedir" && (v.noAntesDe === undefined || v.noAntesDe <= performance.now());
type InvitadoLocal = { intervencion: IntervencionArena; completa: VarianteLocal; breve: VarianteLocal };
const estadoCoordinador = (v: VarianteLocal): EstadoVariante => v.estado === "valida" ? { estado: "valida", duracionS: v.clip!.audio.duration } : v.estado === "sin-pedir" || v.estado === "pidiendo" ? { estado: "pendiente" } : { estado: v.estado };
/** Brief 050 v1.1 (1): `tick` del clip activo (evento del narrador, intervención o cursor de la reserva). */
type Activa = { fuente: AudioBufferSourceNode; fin: number; prioridad: number; recuerdo: RecuerdoVoz; rol: Rol; tick: number };
type Reserva = { texto: string; audio: AudioBuffer; cierre: boolean; orden: number };
/** Brief 045: los invitados tienen su propia preparación (una a la vez) y sus propios clips;
 * nunca ocupan la concurrencia del narrador. */
type Sonido = { silenciada: boolean; activacion: number; activadoTick: number; entradaPendiente: boolean; idioma: "es" | "en"; contexto: AudioContext; clips: Map<string, Clip>; peticiones: Map<string, AbortController>; desde: number; cierrePedido: boolean; cierreFallido: boolean; cerrando: boolean; ultimoFin: number; reservas: Reserva[]; memoria: RecuerdoVoz[]; activa?: Activa;
  /** Nota del 22 oct (043): reservas cuyo audio empezó en esta emisión, en orden; aparte de la memoria de escucha. */
  reservasOidas: string[]; cargaReservas: AbortController; totalReservas: number;
  /** 048: por id de intervención, sus dos variantes; peticiones por `${id}|${variante}`; `pedidas` = ids terminados
   * (arrancados, descartados o caducados); `sonadas` = eventos cuya noticia ya sonó. */
  invitados: Map<string, InvitadoLocal>; peticionesInvitado: Map<string, AbortController>; pedidas: Set<string>; sonadas: Set<string>; finUltimaNoticia: number | null; finUltimoInvitado: number | null; ultimoInvitado: { rol: Rol; tick: number; tema?: string } | null;
  /** Brief 058 · B: antesala en curso (estado puro, peticiones y audios por id, fuente propia) o en espera de audio. */
  antesala?: AntesalaLocal; antesalaEspera?: { t0Ms: number } };
type AntesalaLocal = { estado: EstadoAntesala; peticiones: Map<string, AbortController>; audios: Map<string, { segmento: Segmento; audio: AudioBuffer }>; activa?: Activa };

/** 048 · Una intervención termina en este consumidor (arrancó, se descartó o caducó): se abortan sus
 * peticiones, se sueltan sus dos variantes y no se vuelve a pedir. */
function terminarInvitado(s: Sonido, id: string) {
  for (const variante of ["completa", "breve"] as const) { const clave = `${id}|${variante}`; s.peticionesInvitado.get(clave)?.abort(); s.peticionesInvitado.delete(clave); }
  s.invitados.delete(id); s.pedidas.add(id);
}

/** Nota del 22 oct (043) · Descarga el catálogo de reservas del idioma: primero las de la primera vuelta
 * (en su orden desfasado por semilla) y el cierre tras la primera, con pocas descargas a la vez. Cada clip
 * entra en `s.reservas` en cuanto se decodifica; si uno falla, siguen los demás. Devuelve cuántos cargó. */
async function cargarReservas(s: Sonido, semilla: number): Promise<number> {
  const signal = s.cargaReservas.signal;
  let cargadas = 0;
  try {
    const r = await fetch(`${RUTA_RESERVAS}/${ARCHIVO_INDICE_RESERVAS}`, { signal });
    if (!r.ok) throw new Error("Índice de reservas no disponible");
    const { reservas, cierre } = leerIndiceReservas(await r.json(), s.idioma);
    s.totalReservas = reservas.length;
    const cola = ordenPrimeraVuelta(reservas.length, semilla).map(i => reservas[i]!);
    cola.splice(1, 0, cierre);
    await Promise.all(Array.from({ length: RESERVAS_VOZ.descargasSimultaneas }, async () => {
      for (let entrada = cola.shift(); entrada && !signal.aborted; entrada = cola.shift()) {
        try {
          const respuesta = await fetch(`${RUTA_RESERVAS}/${entrada.archivo}`, { signal });
          if (!respuesta.ok) throw new Error("Reserva no disponible");
          const audio = await s.contexto.decodeAudioData(await respuesta.arrayBuffer());
          if (signal.aborted || !Number.isFinite(audio.duration) || audio.duration <= 0 || audio.duration > VOZ_BUFFER.duracionMaxS) continue;
          s.reservas.push({ texto: entrada.texto, cierre: entrada.cierre, orden: entrada.orden, audio }); cargadas++;
        } catch { /* Una reserva que no carga no detiene las demás. */ }
      }
    }));
  } catch { /* Sin índice no hay reservas; el aviso de error lo muestra el consumidor. */ }
  return cargadas;
}

/** El partido tiene un reloj propio. La voz lee ese cursor, prepara contenido
 * por adelantado y solo reproduce hechos que ya alcanzó la presentación. */
/** Brief 060 § 4.1 · `ranura`: hueco de la barra de transporte bajo la cancha donde se pinta «Pause broadcast» (portal);
 * mientras es null no se pinta en ningún sitio (nunca hay dos). La lógica de pausa no cambia. */
export function ArenaEmisionBuffer({ sesion, hastaTick, terminada, inicioTick, idioma, registro, alTiempo, alRepeticion, intervenciones = [], ranura = null, alAntesala }: {
  sesion: string; registro: RegistroArena; hastaTick: number; terminada: boolean; inicioTick: number; idioma: "es" | "en"; intervenciones?: readonly IntervencionArena[];
  alTiempo: (tick: number) => void; alRepeticion: () => void; ranura?: HTMLElement | null;
  /** Brief 058 · C: foco del clip de la antesala que suena (null en huecos, esperas, reintentos y al terminar). */
  alAntesala?: (foco: FocoAntesala | null) => void;
}) {
  const es = idioma === "es", t = (en: string, esp: string) => es ? esp : en;
  const reloj = useRef(new RelojBuffer(inicioTick / 10));
  // Brief 058 § 4.5 · Retención inicial: si la narración automática puede llegar a activarse (preferencia, arranque
  // propio y tick 0), el reloj se retiene desde el primer fotograma; se suelta a los esperaHerramientasMs si no
  // empieza la antesala.
  const retencionInicial = useRef<boolean | null>(null), plazoInicialVencido = useRef(false), herramientas = useRef<"pendiente" | "voz" | "sin-voz">("pendiente");
  if (retencionInicial.current === null) {
    retencionInicial.current = inicioTick === 0 && arranquePropio(sesion) && leerPreferenciaNarracion() && ANTESALA_ARENA.topeS > 0;
    if (retencionInicial.current) reloj.current.retener();
  }
  const [vista, setVista] = useState({ segundo: inicioTick / 10, estado: reloj.current.estado, reserva: 0, retenido: reloj.current.retenido });
  const [voz, setVoz] = useState(false), [disponible, setDisponible] = useState(false), [error, setError] = useState(false), [pulsar, setPulsar] = useState(false), [version, setVersion] = useState(0);
  const [pasaje, setPasaje] = useState<Segmento | null>(null), [hablando, setHablando] = useState(false);
  const sonido = useRef<Sonido | null>(null), generacion = useRef(0), reanudando = useRef(false);
  // Brief 058 · A: activación automática (una vez por montaje) en una sesión propia, y nota fija.
  const [automatica, setAutomatica] = useState(false), autoIntentada = useRef(false);
  const vozRef = useRef(voz); vozRef.current = voz;
  const disponibleRef = useRef(disponible); disponibleRef.current = disponible;
  // Brief 058 · B: ids de la antesala derivados del registro y de la asignación pública de la sesión.
  const asignacion = useSyncExternalStore(suscribirAsignacionDirecto, () => asignacionDirecto(sesion), () => null);
  const piezasAntesala = useMemo(() => { try { return antesalaPartido(registro, asignacion, idioma); } catch { return []; } },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registro.config, registro.inicial, asignacion, idioma]);
  const idsAntesala = useMemo(() => piezasAntesala.map(i => i.id), [piezasAntesala]);
  /** Brief 058 · C · Fuente cuyo foco se muestra; al terminar ESA fuente (onended o stop) el foco vuelve a null. */
  const focoFuente = useRef<AudioBufferSourceNode | null>(null);
  /** Token de ejecución de la antesala (v1.1 § 4): sobrevive a limpiar(); cualquier final lo invalida. */
  const ejecucion = useRef(0), antesalaEjecutada = useRef(false), t0Antesala = useRef<number | null>(null), retencionAntesala = useRef(false);
  const [faseAntesala, setFaseAntesala] = useState(false);
  const saltarRef = useRef<HTMLButtonElement | null>(null), vozBotonRef = useRef<HTMLButtonElement | null>(null);
  const actual = useRef({ hastaTick, terminada, registro, alTiempo, intervenciones, idsAntesala, idioma, piezasAntesala, alAntesala }); actual.current = { hastaTick, terminada, registro, alTiempo, intervenciones, idsAntesala, idioma, piezasAntesala, alAntesala };
  /** Codex 058 #3 · Contexto desbloqueado que sobrevive al cambio de idioma: la limpieza del efecto
   * [sesion, idioma] lo deja aquí en lugar de cerrarlo; si nadie lo adopta en el mismo vaciado de efectos (la
   * reactivación en el idioma nuevo), se cierra en la siguiente microtarea (desmontaje o voz apagada). */
  const contextoPrevio = useRef<AudioContext | null>(null);
  /** Último fin de una suspensión propia (pausa o pestaña oculta), en performance.now(). */
  const finSuspensionPropia = useRef(0);
  const limpiar = (conservarContexto = false) => {
    generacion.current++; reanudando.current = false;
    const s = sonido.current; sonido.current = null;
    if (s?.antesala) {
      // v1.1 § 4: limpiar es un final: se invalida el token y se abortan sus peticiones. El reloj no se toca aquí:
      // lo decide quien llama (cambio de idioma: transferir o soltar).
      ejecucion.current++;
      for (const a of s.antesala.peticiones.values()) a.abort();
      s.antesala = undefined; setFaseAntesala(false);
      focoFuente.current = null; actual.current.alAntesala?.(null);
    }
    if (s) {
      for (const a of s.peticiones.values()) a.abort();
      for (const a of s.peticionesInvitado.values()) a.abort();
      s.cargaReservas.abort();
      try { s.activa?.fuente.stop(); } catch { /* Ya terminó. */ }
      if (conservarContexto && s.contexto.state !== "closed") {
        const c = s.contexto; contextoPrevio.current = c;
        queueMicrotask(() => { if (contextoPrevio.current === c) { contextoPrevio.current = null; void c.close().catch(() => {}); } });
      } else void s.contexto.close().catch(() => {});
    }
  };
  useEffect(() => {
    const a = new AbortController();
    // Smoke 058 (rev. 0000027): la retención inicial espera la respuesta; sin voz se suelta y el contexto cebado se cierra.
    const sinVoz = () => { herramientas.current = "sin-voz"; if (arranquePropio(sesion)) descartarAudioCebado(); if (retencionInicial.current && !retencionAntesala.current) reloj.current.soltar(); };
    void fetch("/api/arena/herramientas", { signal: a.signal }).then(r => r.json()).then(r => { if (r.voz === true) { herramientas.current = "voz"; setDisponible(true); } else sinVoz(); }).catch(() => { if (!a.signal.aborted) sinVoz(); });
    return () => a.abort();
  }, []);
  useEffect(() => {
    // Brief 058 § 3.1: al cambiar de idioma en una sesión propia, la narración vuelve a activarse sola en el
    // idioma nuevo si la preferencia sigue activa y la voz estaba activa antes del cambio.
    const reactivar = vozRef.current && narracionAutomatica(sesion, disponibleRef.current);
    // Brief 058 v1.1 § 4 / v1.2 (N1) · Transferencia atómica de la retención al idioma nuevo, con el mismo t0 y el
    // vencimiento en ms monotónicos; si no se transfiere, se suelta en este mismo efecto.
    const venceMs = t0Antesala.current === null ? -Infinity : vencimientoAntesalaMs(t0Antesala.current);
    const transferir = reloj.current.retenido && reactivar && performance.now() < venceMs;
    const habiaRetencion = retencionAntesala.current;
    limpiar(); setVoz(false); setAutomatica(false); setError(false); setPulsar(false); setPasaje(null); setHablando(false);
    if (transferir) antesalaEjecutada.current = false;
    else if (habiaRetencion) { retencionAntesala.current = false; reloj.current.soltar(); }
    if (reactivar) activarVoz(true, t0Antesala.current ?? undefined);
    // Se cancelan fuentes y solicitudes; el contexto desbloqueado queda para el idioma nuevo (Codex 058 #3).
    return () => limpiar(true);
    // La sesión tiene una key propia; los datos entrantes no reinician la voz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion, idioma]);

  const reanudarAudio = (forzar = false) => {
    const s = sonido.current;
    // Brief 058 · A4: un contexto que ya corre (p. ej. se desbloqueó en este clic) retira el aviso.
    if (s && forzar && s.contexto.state === "running") { setPulsar(false); return; }
    if (!s || reanudando.current && !forzar || s.contexto.state === "running") return;
    reanudando.current = true;
    void s.contexto.resume().then(() => {
      if (sonido.current === s) setPulsar(s.contexto.state !== "running");
    }).catch(() => { if (sonido.current === s) setPulsar(true); }).finally(() => { if (sonido.current === s) reanudando.current = false; });
  };
  /** Brief 058 · A: solo los gestos del usuario escriben la preferencia; la activación automática no. */
  const cambiarVoz = () => {
    const encender = !(voz && sonido.current), t0 = performance.now();
    if (encender) activarVoz(false, t0); else apagarVoz();
    guardarPreferenciaNarracion(encender);
  };
  const apagarVoz = () => {
    setError(false); setPulsar(false); setPasaje(null); setHablando(false);
    const s = sonido.current;
    if (!s) return;
    // Brief 058 § 4.6: «Desactivar narración» termina la antesala (motivo voz-apagada) y suelta el reloj.
    if (s.antesala) aplicarAntesala(s, pasoAntesala(s.antesala.estado, { tipo: "voz-apagada", token: s.antesala.estado.token }));
    if (s.antesalaEspera) soltarEspera(s);
    s.silenciada = true;
    if (s.activa) s.activa.recuerdo.estado = "interrumpida";
    try { s.activa?.fuente.stop(); } catch { /* Ya terminó. */ }
    s.activa = undefined; void s.contexto.suspend(); vozRef.current = false; setVoz(false); setAutomatica(false);
  };
  const activarVoz = (automaticaAhora: boolean, t0Ms?: number) => {
    setError(false); setPulsar(false); setPasaje(null); setHablando(false);
    let s = sonido.current;
    const tick = Math.floor(reloj.current.segundo * 10);
    if (!s) {
      // Brief 058 § 3.2: se adopta el contexto cebado en el clic de «Iniciar partido en vivo», si lo hay.
      // Codex 058 #3: al cambiar de idioma se reutiliza el contexto ya desbloqueado (nunca uno nuevo fuera del gesto).
      const previo = contextoPrevio.current; contextoPrevio.current = null;
      const contexto = previo ?? tomarAudioCebado() ?? new AudioContext({ sampleRate: 24000 });
      const desde = Math.floor(tick / BUFFER_ARENA.tramoTicks) * BUFFER_ARENA.tramoTicks;
      s = { silenciada: false, activacion: 0, activadoTick: tick, entradaPendiente: true, idioma, contexto, clips: new Map(), peticiones: new Map(), desde, cierrePedido: false, cierreFallido: false, cerrando: false, ultimoFin: contexto.currentTime, reservas: [], memoria: [], reservasOidas: [], cargaReservas: new AbortController(), totalReservas: 0,
        invitados: new Map(), peticionesInvitado: new Map(), pedidas: new Set(), sonadas: new Set(), finUltimaNoticia: null, finUltimoInvitado: null, ultimoInvitado: null };
      sonido.current = s;
      const nuevo = s;
      // Nota del 22 oct (043): reservas como archivos estáticos, descargadas al activar la voz.
      void cargarReservas(nuevo, actual.current.registro.config.partido.seed).then(cargadas => { if (sonido.current === nuevo && !cargadas) setError(true); });
    }
    s.silenciada = false; s.activacion++; s.activadoTick = tick; s.entradaPendiente = true; s.ultimoFin = s.contexto.currentTime;
    for (const [clave, a] of s.peticiones) if (clave.startsWith("entrada:")) { a.abort(); s.peticiones.delete(clave); }
    for (const [clave, c] of s.clips) if (c.segmento.fragmentos[0]!.tick < tick || clave.startsWith("entrada:")) s.clips.delete(clave);
    // Brief 056 v1.1 § 3: una pieza de la previa aún pendiente y vigente se conserva al reactivar.
    for (const id of candidatasAlReactivar([...s.invitados.values()].map(inv => inv.intervencion), tick, s.pedidas)) terminarInvitado(s, id);
    reanudarAudio(true);
    // Brief 058 § 3.2: si el contexto no corre tras `desbloqueoMs`, aparece «Habilitar reproducción de audio»
    // (también cuando la promesa de resume() no se resuelve nunca).
    const armado = s, activacion = s.activacion;
    const verificarDesbloqueo = () => {
      if (sonido.current !== armado || armado.activacion !== activacion || armado.silenciada || armado.contexto.state === "running") return;
      // Un contexto que suspendemos nosotros (emisión en pausa o pestaña oculta) no es audio bloqueado: se vuelve a
      // comprobar después, sin mostrar «Habilitar reproducción de audio» ni soltar la retención de la antesala.
      // Tras reanudar, resume() tiene desbloqueoMs de gracia antes de considerarse bloqueado.
      const gracia = finSuspensionPropia.current + NARRACION_DIRECTO.desbloqueoMs - performance.now();
      if (reloj.current.estado === "pausada" || document.hidden || gracia > 0) { window.setTimeout(verificarDesbloqueo, Math.max(gracia, 0) || NARRACION_DIRECTO.desbloqueoMs); return; }
      setPulsar(true);
      // § 4.5: sin audio a los desbloqueoMs, la antesala no retiene el reloj (empieza si se habilita en 0:00).
      if (armado.antesalaEspera) soltarEspera(armado);
    };
    window.setTimeout(verificarDesbloqueo, NARRACION_DIRECTO.desbloqueoMs);
    vozRef.current = true; setVoz(true); setAutomatica(automaticaAhora); setVersion(v => v + 1);
    // Brief 058 v1.1 §§ 2–3 · En el mismo manejador síncrono: decidir y aplicar la retención (t0 = clic).
    t0Antesala.current = t0Ms ?? (automaticaAhora ? instanteArranquePropio(sesion) : null) ?? performance.now();
    intentarAntesala(s, t0Antesala.current);
  };

  // ——— Brief 058 · Bloque B · Antesala (lógica pura en arena/antesala.ts; aquí solo se aplica) ———
  /** v1.1 § 3 · Transición atómica: con permiso, retiene en este mismo paso y empieza si el audio corre. */
  const intentarAntesala = (s: Sonido, t0Ms: number) => {
    if (s.antesala) return;
    const r = reloj.current, ids = actual.current.idsAntesala;
    const d = activarAntesala({ permitida: !s.silenciada && ids.length > 0 && !antesalaEjecutada.current, inicioTick, relojSegundo: r.segundo, relojEstado: r.estado, topeS: ANTESALA_ARENA.topeS, ahoraMs: performance.now(), venceMs: vencimientoAntesalaMs(t0Ms), contextoCorre: s.contexto.state === "running" });
    if (d.retener) { r.retener(); retencionAntesala.current = true; }
    if (d.iniciar) comenzarAntesala(s, t0Ms);
    else if (d.retener || d.motivo === "audio" || d.motivo === "pausada") s.antesalaEspera = { t0Ms };
  };
  const soltarEspera = (s: Sonido) => {
    s.antesalaEspera = undefined;
    if (!s.antesala && retencionAntesala.current) { retencionAntesala.current = false; reloj.current.soltar(); }
  };
  const comenzarAntesala = (s: Sonido, t0Ms: number) => {
    antesalaEjecutada.current = true; s.antesalaEspera = undefined;
    const estado = iniciarAntesala(actual.current.idsAntesala, ++ejecucion.current, t0Ms);
    retencionAntesala.current = estado.retiene;
    s.antesala = { estado, peticiones: new Map(), audios: new Map() };
    setFaseAntesala(true); setVersion(v => v + 1);
  };
  /** Aplica la salida de pasoAntesala: abortar, detener, terminar la previa del 056, arrancar y finalizar. */
  const aplicarAntesala = (s: Sonido, salida: SalidaAntesala) => {
    const a = s.antesala;
    if (!a) return;
    a.estado = salida.estado;
    for (const id of salida.abortar ?? []) { a.peticiones.get(id)?.abort(); a.peticiones.delete(id); }
    if (salida.detener && a.activa && s.activa === a.activa) {
      a.activa.recuerdo.estado = "interrumpida";
      try { a.activa.fuente.stop(); } catch { /* Ya terminó. */ }
    }
    if (salida.terminarPrevia) for (const i of actual.current.intervenciones) if (esPrevia(i)) terminarInvitado(s, i.id);
    if (salida.arrancar) arrancarAntesala(s, a, salida.arrancar.id);
    if (salida.estado.fase === "terminada") {
      // v1.1 § 4: cualquier final invalida el token, aborta y suelta (o la retención queda para el idioma nuevo).
      ejecucion.current++;
      for (const c of a.peticiones.values()) c.abort();
      s.antesala = undefined;
      if (salida.soltarReloj) { retencionAntesala.current = false; reloj.current.soltar(); }
      // v1.1 § 10: el foco nunca queda en <body> al desaparecer «Saltar al saque».
      if (typeof document !== "undefined" && document.activeElement === saltarRef.current) vozBotonRef.current?.focus();
      setFaseAntesala(false);
      focoFuente.current = null; actual.current.alAntesala?.(null);
    }
    setVersion(v => v + 1);
  };
  const arrancarAntesala = (s: Sonido, a: AntesalaLocal, id: string) => {
    const token = a.estado.token;
    let audio: AudioBuffer, segmento: Segmento, prioridad: number = MESA_ARENA.prioridadInvitado;
    if (id === "entrada") {
      const entrada = [...s.clips.entries()].find(([k, c]) => k.startsWith("entrada:") && !c.consumido);
      if (!entrada) return;
      entrada[1].consumido = true; audio = entrada[1].audio; segmento = entrada[1].segmento; prioridad = entrada[1].segmento.prioridad ?? 10;
    } else {
      const clip = a.audios.get(id);
      if (!clip) return;
      audio = clip.audio; segmento = clip.segmento;
    }
    const recuerdo: RecuerdoVoz = { tick: 0, texto: id, tema: "antesala", estado: "iniciada" };
    const fuente = s.contexto.createBufferSource(); fuente.buffer = audio; fuente.connect(s.contexto.destination);
    const activa: Activa = { fuente, fin: s.contexto.currentTime + audio.duration, prioridad, recuerdo, rol: "narrador", tick: 0 };
    s.activa = activa; a.activa = activa;
    fuente.onended = () => {
      const interrumpida = recuerdo.estado === "interrumpida";
      if (recuerdo.estado === "iniciada") recuerdo.estado = "completa"; fuente.disconnect();
      // Brief 058 · C (v1.1 § 10): durante huecos, esperas y reintentos no hay foco.
      if (focoFuente.current === fuente) { focoFuente.current = null; actual.current.alAntesala?.(null); }
      if (sonido.current === s && s.activa === activa) { s.activa = undefined; s.ultimoFin = s.contexto.currentTime; setHablando(false); }
      // v1.1 § 4: tras cada operación asíncrona se comprueba el token; una fuente vieja no toca el estado.
      const actualA = s.antesala;
      if (sonido.current === s && actualA && actualA.estado.token === token) aplicarAntesala(s, pasoAntesala(actualA.estado, { tipo: "fin-fuente", token, id, audioS: s.contexto.currentTime, interrumpida }));
    };
    fuente.start(); setPasaje(segmento); setHablando(true);
    // Brief 058 · C: el foco sale de la pieza efectiva que acaba de arrancar (la entrada no tiene bloque).
    const pieza = id === "entrada" ? undefined : actual.current.piezasAntesala.find(p => p.id === id);
    focoFuente.current = fuente; actual.current.alAntesala?.(pieza ? focoDeAntesala(pieza) : null);
  };
  /** Un fotograma de la antesala: tope de pared, huecos, clips tardíos, entrada final (§ 4.6, v1.1 § 2). */
  const fotogramaAntesala = (s: Sonido, corre: boolean, cursorS: number) => {
    const a = s.antesala;
    if (!a) return;
    const entrada = [...s.clips.entries()].find(([k, c]) => k.startsWith("entrada:") && !c.consumido)?.[1];
    aplicarAntesala(s, pasoAntesala(a.estado, { tipo: "fotograma", token: a.estado.token, ahoraMs: performance.now(), audioS: s.contexto.currentTime, corre, cursorS, fuenteAjena: !!s.activa && s.activa !== a.activa, entradaDuracionS: entrada ? entrada.audio.duration : null }));
  };
  /** Petición de un clip de la antesala (una a la vez; v1.1 § 1 para reintentos). */
  const pedirClipAntesala = (s: Sonido, id: string) => {
    const a = s.antesala!, token = a.estado.token, g = generacion.current, idioma = actual.current.idioma;
    a.estado = pasoAntesala(a.estado, { tipo: "pedido", token, id }).estado;
    const control = new AbortController(); a.peticiones.set(id, control);
    const signal = AbortSignal.any([control.signal, AbortSignal.timeout(15_000)]);
    const vigente = () => g === generacion.current && sonido.current === s && s.antesala === a && a.estado.token === token && a.estado.fase === "activa";
    void (async () => {
      let resultado: RespuestaClip = { tipo: "invalida" };
      try {
        const r = await fetch(`/api/arena/sesiones/${sesion}/relato`, { method: "POST", headers: { "content-type": "application/json" }, signal, body: JSON.stringify({ desdeTick: 0, hastaTick: 0, modo: "buffer", idioma, intervencion: id, variante: "completa" }) })
          .catch((e: unknown) => { resultado = { tipo: "red" }; throw e; });
        if (!r.ok) { resultado = { tipo: "http", estado: r.status }; throw new Error("Antesala no disponible"); }
        const segmento = await r.json() as Segmento;
        if (!vigente()) return;
        if (!segmentoVozValido(segmento, { desde: 0, hasta: 0, idioma, intervencion: { id, tick: 0, variante: "completa" } })) throw new Error("Clip inconsistente");
        const audio = await s.contexto.decodeAudioData(Uint8Array.from(atob(segmento.audio!.base64), c => c.charCodeAt(0)).buffer);
        if (!vigente()) return;
        if (audio.numberOfChannels !== 1 || estadoPorDuracion(audio.duration).estado !== "valida") throw new Error("Audio inválido");
        a.audios.set(id, { segmento, audio }); resultado = { tipo: "ok", duracionS: audio.duration };
      } catch {
        if (signal.aborted && !control.signal.aborted) resultado = { tipo: "red" }; // plazo agotado
      } finally {
        a.peticiones.delete(id);
        if (!control.signal.aborted && vigente()) {
          aplicarAntesala(s, pasoAntesala(a.estado, { tipo: "respuesta", token, id, ahoraMs: performance.now(), resultado }));
          // Un reintento programado despierta la preparación cuando vence su espera.
          const espera = a.estado.clips.find(c => c.id === id);
          if (espera?.estado === "pendiente") setTimeout(() => { if (vigente()) setVersion(v => v + 1); }, Math.max(0, espera.noAntesDeMs - performance.now()) + 5);
        }
      }
    })();
  };
  const saltarAntesala = () => {
    const s = sonido.current;
    if (s?.antesala) aplicarAntesala(s, pasoAntesala(s.antesala.estado, { tipo: "saltar", token: s.antesala.estado.token }));
  };
  useEffect(() => {
    if (!disponible || autoIntentada.current || sonido.current) return;
    autoIntentada.current = true;
    if (reloj.current.estado !== "final" && narracionAutomatica(sesion, disponible)) activarVoz(true, instanteArranquePropio(sesion) ?? undefined);
    // La retención inicial que esperaba a /herramientas se suelta si la antesala no la tomó y el plazo ya venció.
    if (retencionInicial.current && !retencionAntesala.current && plazoInicialVencido.current) reloj.current.soltar();
    // Una sola vez por montaje, cuando /herramientas confirma la voz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disponible]);
  useEffect(() => {
    if (!retencionInicial.current) return;
    // § 4.5: la retención inicial se suelta a los esperaHerramientasMs si la antesala no está en curso ni en espera y
    // /herramientas ya respondió; si aún no respondió, espera su respuesta (smoke 058, rev. 0000027) con el tope
    // topeS como salvaguarda.
    const plazo = window.setTimeout(() => {
      plazoInicialVencido.current = true;
      if (herramientas.current !== "pendiente" && !retencionAntesala.current) reloj.current.soltar();
    }, NARRACION_DIRECTO.esperaHerramientasMs);
    const tope = window.setTimeout(() => { if (!retencionAntesala.current) reloj.current.soltar(); }, ANTESALA_ARENA.topeS * 1000);
    return () => { window.clearTimeout(plazo); window.clearTimeout(tope); };
  }, []);

  const bloque = Math.floor(vista.segundo / 5);
  useEffect(() => {
    const s = sonido.current;
    if (!s) return;
    const g = generacion.current, tickVisible = reloj.current.segundo * 10;
    // Una síntesis vieja no retiene el turno de otra intervención.
    for (const [clave, peticion] of s.peticiones) {
      if (clave !== "cierre" && Number(clave) + BUFFER_ARENA.tramoTicks < tickVisible - VOZ_BUFFER.atrasoImportanteS * 10) { peticion.abort(); s.peticiones.delete(clave); }
    }
    s.desde = Math.max(s.desde, Math.floor(tickVisible / BUFFER_ARENA.tramoTicks) * BUFFER_ARENA.tramoTicks);
    const pedir = (desde: number, hasta: number, cierre = false, entradaTick?: number) => {
      const activacion = s.activacion;
      const clave = entradaTick !== undefined ? `entrada:${activacion}` : cierre ? "cierre" : String(desde), a = new AbortController(); s.peticiones.set(clave, a);
      const signal = AbortSignal.any([a.signal, AbortSignal.timeout(15_000)]);
      void (async () => {
        try {
          let r: Response;
          // CIERRE_VOZ · El cierre reintenta un 429 de concurrencia (con retry-after); el resto de fallos es final.
          for (let reintentos = 0; ; reintentos++) {
            r = await fetch(`/api/arena/sesiones/${sesion}/relato`, { method: "POST", headers: { "content-type": "application/json" }, signal, body: JSON.stringify({ desdeTick: desde, hastaTick: hasta, modo: "buffer", idioma, memoria: s.memoria, ...(cierre ? { cierre: true } : {}), ...(entradaTick === undefined ? {} : { entradaTick }) }) });
            const espera = cierre && !r.ok ? esperaReintentoCierre(r.status, r.headers.get("retry-after"), reintentos) : null;
            if (espera === null) break;
            await new Promise<void>((resolver, rechazar) => { const t = setTimeout(resolver, espera); signal.addEventListener("abort", () => { clearTimeout(t); rechazar(new Error("Cancelada")); }, { once: true }); });
          }
          if (!r.ok) throw new Error("Relato no disponible");
          const segmento = await r.json() as Segmento;
          if (!segmentoVozValido(segmento, { desde, hasta, idioma, entradaTick })) throw new Error("Ventana inconsistente");
          const audio = segmento.audio ? await s.contexto.decodeAudioData(Uint8Array.from(atob(segmento.audio.base64), c => c.charCodeAt(0)).buffer) : null;
          if (g !== generacion.current || signal.aborted || entradaTick !== undefined && activacion !== s.activacion) return;
          if (cierre && (!audio || !segmento.cierre) || audio && (!Number.isFinite(audio.duration) || audio.duration <= 0 || audio.duration > VOZ_BUFFER.duracionMaxS || audio.numberOfChannels !== 1)) throw new Error("Audio inválido");
          if (audio) s.clips.set(clave, { segmento, audio, consumido: false });
        } catch {
          if (g === generacion.current && !a.signal.aborted) { setError(true); if (cierre) s.cierreFallido = true; }
        } finally {
          s.peticiones.delete(clave);
          if (g === generacion.current) setVersion(v => v + 1);
        }
      })();
    };
    // Brief 058 v1.1 § 5 · Con la antesala activa, todas las peticiones pasan por el árbitro: como máximo
    // MAX_EN_VUELO_ANTESALA, antesala > entrada > tramo, una sola de la antesala y ningún invitado. La entrada y
    // los tramos esperan a que estén pedidos todos los clips del guion; nada de esto suena hasta el final.
    if (s.antesala) {
      const a = s.antesala;
      const enVuelo = () => [...[...s.peticiones.keys()].map(k => ({ clase: (k.startsWith("entrada:") ? "entrada" : "tramo") as ClaseSolicitud })),
        ...[...s.peticionesInvitado.keys()].map(() => ({ clase: "invitado" as const })), ...[...a.peticiones.keys()].map(() => ({ clase: "antesala" as const }))];
      for (let vueltas = 0; vueltas < 8 && s.antesala === a; vueltas++) {
        const pendientes: { clase: ClaseSolicitud; lanzar: () => void }[] = [];
        const siguiente = siguientePedidoAntesala(a.estado, performance.now());
        if (siguiente) pendientes.push({ clase: "antesala", lanzar: () => pedirClipAntesala(s, siguiente) });
        if (todosPedidosAntesala(a.estado)) {
          if (s.entradaPendiente && !s.silenciada && hastaTick > 0) {
            const tick = Math.min(Math.floor(tickVisible), hastaTick), desde = Math.floor(tick / BUFFER_ARENA.tramoTicks) * BUFFER_ARENA.tramoTicks, hasta = Math.min(desde + BUFFER_ARENA.tramoTicks, hastaTick);
            if (hasta > desde) pendientes.push({ clase: "entrada", lanzar: () => { s.entradaPendiente = false; pedir(desde, hasta, false, tick); } });
          }
          const desde = s.desde, hasta = Math.min(desde + BUFFER_ARENA.tramoTicks, hastaTick);
          if (desde < hastaTick && desde < tickVisible + BUFFER_ARENA.adelantoAudioS * 10 && (hasta - desde >= BUFFER_ARENA.tramoTicks || terminada)) pendientes.push({ clase: "tramo", lanzar: () => { s.desde = hasta; pedir(desde, hasta); } });
        }
        const elegida = elegirSolicitud(pendientes, enVuelo(), "activa");
        if (!elegida) break;
        elegida.lanzar();
      }
      return;
    }
    if (s.entradaPendiente && !s.silenciada && hastaTick > 0 && s.peticiones.size < VOZ_BUFFER.concurrencia) {
      const tick = Math.min(Math.floor(tickVisible), hastaTick);
      const desde = Math.floor(tick / BUFFER_ARENA.tramoTicks) * BUFFER_ARENA.tramoTicks;
      const hasta = Math.min(desde + BUFFER_ARENA.tramoTicks, hastaTick);
      if (hasta > desde) { s.entradaPendiente = false; pedir(desde, hasta, false, tick); }
    }
    while (s.peticiones.size < VOZ_BUFFER.concurrencia && s.desde < hastaTick && s.desde < tickVisible + BUFFER_ARENA.adelantoAudioS * 10) {
      const desde = s.desde, hasta = Math.min(desde + BUFFER_ARENA.tramoTicks, hastaTick);
      if (hasta - desde < BUFFER_ARENA.tramoTicks && !terminada) break;
      s.desde = hasta; pedir(desde, hasta);
    }
    // Brief 045: cada intervención publicada se pide por su id del diario, en orden de tick y antes de
    // que caduque; preparar o descartar no la marca como escuchada. 048 v1.1 (9): primero la breve
    // (si existe) y la completa solo si la ventana conocida admite su duración estimada.
    const pedirVariante = (inv: InvitadoLocal, variante: VarianteIntercambio) => {
      const { id, tick } = inv.intervencion, clave = `${id}|${variante}`, a = new AbortController(), reintentos = inv[variante].reintentos ?? 0;
      s.peticionesInvitado.set(clave, a); inv[variante] = { estado: "pidiendo", reintentos };
      const signal = AbortSignal.any([a.signal, AbortSignal.timeout(15_000)]);
      void (async () => {
        let fallo: FalloInvitado = { tipo: "invalida" };
        try {
          // v3.1: sin memoria; la intervención es la misma para todos los espectadores.
          const r = await fetch(`/api/arena/sesiones/${sesion}/relato`, { method: "POST", headers: { "content-type": "application/json" }, signal, body: JSON.stringify({ desdeTick: tick, hastaTick: tick, modo: "buffer", idioma, intervencion: id, variante }) })
            .catch((e: unknown) => { fallo = { tipo: "red" }; throw e; });
          if (!r.ok) { fallo = { tipo: "http", estado: r.status }; throw new Error("Intervención no disponible"); }
          const segmento = await r.json() as Segmento;
          if (!segmentoVozValido(segmento, { desde: tick, hasta: tick, idioma, intervencion: { id, tick, variante: varianteEfectiva(inv.intervencion, variante) } })) throw new Error("Intervención inconsistente");
          const audio = await s.contexto.decodeAudioData(Uint8Array.from(atob(segmento.audio!.base64), c => c.charCodeAt(0)).buffer);
          if (g !== generacion.current || signal.aborted) return;
          // Un clip demasiado largo queda inválido sin arrancar: no se recorta audio.
          inv[variante] = audio.numberOfChannels === 1 && estadoPorDuracion(audio.duration).estado === "valida" ? { estado: "valida", clip: { segmento, audio, consumido: false } } : { estado: "invalida" };
        } catch {
          // El narrador sigue; un invitado ausente no es un fallo de la emisión. Corrección 045/048: un 429
          // (el servidor rechaza antes de reservar) o un fallo de red/plazo se reintenta con espera mientras
          // la intervención no caduque y la generación siga; entretanto la variante sigue pendiente. El
          // reintento vuelve a pasar por la ruta (cuotas y bolsas de Speech incluidas) y no toca la memoria.
          if (!a.signal.aborted && g === generacion.current) {
            if (signal.aborted) fallo = { tipo: "red" }; // plazo agotado, también durante el cuerpo
            const espera = esperaReintentoInvitado(fallo, reintentos, reloj.current.segundo - tick * ARENA.pasoS, inv.intervencion.tema);
            if (espera === null) inv[variante] = { estado: "fallida" };
            else {
              inv[variante] = { estado: "sin-pedir", reintentos: reintentos + 1, noAntesDe: performance.now() + espera };
              setTimeout(() => { if (g === generacion.current) setVersion(v => v + 1); }, espera);
            }
          }
        } finally { s.peticionesInvitado.delete(clave); if (g === generacion.current) setVersion(v => v + 1); }
      })();
    };
    for (const intervencion of [...actual.current.intervenciones].sort((a, b) => a.tick - b.tick)) {
      if (s.peticionesInvitado.size >= 1) break;
      if (s.pedidas.has(intervencion.id) || intervencion.tick > hastaTick || intervencion.tick > tickVisible + BUFFER_ARENA.adelantoAudioS * 10) continue;
      if ((tickVisible - intervencion.tick) / 10 > caducidadInvitadoS(intervencion.tema)) { terminarInvitado(s, intervencion.id); continue; }
      let inv = s.invitados.get(intervencion.id);
      if (!inv) { inv = { intervencion, completa: { estado: "sin-pedir" }, breve: { estado: intervencion.turnosBreve?.length ? "sin-pedir" : "inexistente" } }; s.invitados.set(intervencion.id, inv); }
      // Brief 056 § 5.2: con el reloj detenido (preparando/recuperando), una pieza de la previa pide
      // directamente la completa (sin la breve antes); con el reloj en marcha, la regla del 048 v1.1 (9).
      const previaDetenida = esPrevia(intervencion) && (reloj.current.estado === "preparando" || reloj.current.estado === "recuperando");
      if (previaDetenida) {
        if (inv.completa.estado !== "sin-pedir") continue;
        if (pedible(inv.completa)) pedirVariante(inv, "completa");
        break;
      }
      // Una variante a la espera de su reintento conserva el orden: mientras tanto no se pide otra.
      if (inv.breve.estado === "sin-pedir") { if (pedible(inv.breve)) pedirVariante(inv, "breve"); break; }
      if (inv.completa.estado !== "sin-pedir") continue;
      if (!pedible(inv.completa)) break;
      // v1.2 (6–7): un diario del 045 pide su única variante; un intercambio del 048, solo si el mismo
      // horizonte de la selección (noticias pendientes incluidas) admite la duración estimada.
      const ventana = horizonteS(actual.current.registro, Math.max(tickVisible / 10, intervencion.tick * ARENA.pasoS), terminada, s.sonadas, s.activadoTick / 10, tickVisible / 10);
      const admite = ventana !== null && estimarDuracionS(intervencion.turnos ?? []) <= ventana;
      if (!intervencion.turnos?.length || admite || inv.breve.estado === "inexistente" && ventana === null) { pedirVariante(inv, "completa"); break; }
    }
    if (terminada && hastaTick > 0 && s.desde >= hastaTick && !s.cierrePedido && s.peticiones.size < VOZ_BUFFER.concurrencia) {
      s.cierrePedido = true;
      pedir(Math.floor((hastaTick - 1) / BUFFER_ARENA.tramoTicks) * BUFFER_ARENA.tramoTicks, hastaTick, true);
    }
    // La preparación depende de datos nuevos y del cursor, nunca del fin de un audio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion, hastaTick, terminada, idioma, voz, version, bloque, intervenciones.length, vista.estado]);

  useEffect(() => {
    let frame = 0, anterior = performance.now();
    const animar = (ahora: number) => {
      const r = reloj.current, datos = actual.current, s = sonido.current;
      const segundo = r.avanzar((ahora - anterior) / 1000, datos.hastaTick / 10, datos.terminada); anterior = ahora;
      datos.alTiempo(segundo * 10);
      setVista(v => v.estado === r.estado && v.retenido === r.retenido && Math.abs(v.segundo - segundo) < .1 && Math.abs(v.reserva - (datos.hastaTick / 10 - segundo)) < .1 ? v : { segundo, estado: r.estado, reserva: Math.max(0, datos.hastaTick / 10 - segundo), retenido: r.retenido });
      if (s) {
        const detenido = document.hidden || r.estado === "pausada" || s.silenciada;
        if (detenido && s.contexto.state === "running") void s.contexto.suspend();
        // Brief 058 · B: una antesala en espera empieza en cuanto el audio corre (y el reloj sigue en 0:00);
        // si ya no puede retener (tope o reloj en marcha), se suelta.
        if (s.antesalaEspera && !s.antesala) {
          const d = activarAntesala({ permitida: !s.silenciada && datos.idsAntesala.length > 0 && !antesalaEjecutada.current, inicioTick, relojSegundo: r.segundo, relojEstado: r.estado, topeS: ANTESALA_ARENA.topeS, ahoraMs: performance.now(), venceMs: vencimientoAntesalaMs(s.antesalaEspera.t0Ms), contextoCorre: s.contexto.state === "running" && !document.hidden });
          if (d.iniciar) comenzarAntesala(s, s.antesalaEspera.t0Ms);
          else if (!d.retener && d.motivo !== "audio" && d.motivo !== "pausada") soltarEspera(s);
        }
        const corre = !detenido && s.contexto.state === "running";
        // El tope de pared corre aunque el audio esté suspendido (v1.1 § 2).
        if (s.antesala && !corre) fotogramaAntesala(s, false, segundo);
        if (!detenido) {
          if (s.contexto.state === "running" && s.antesala?.estado.retiene) fotogramaAntesala(s, true, segundo);
          else if (s.contexto.state === "running") {
            // Brief 045: turno de invitados, antes de la rama de reservas. Con una noticia lista,
            // el narrador manda; frente al comentario editorial el invitado gana el hueco libre.
            const cursor = estadoVisual(datos.registro, segundo, true);
            const entrada: EntradaTurno = {
              partidoS: segundo, ahoraAudioS: s.contexto.currentTime,
              fuenteActiva: s.activa ? { rol: s.activa.rol, prioridad: s.activa.prioridad, finS: s.activa.fin } : null,
              finUltimaNoticiaS: s.finUltimaNoticia, finUltimoInvitadoS: s.finUltimoInvitado, ultimoInvitado: s.ultimoInvitado,
              // 048: pausa vigente o balón en las manos del portero.
              pausaVigente: calmaEnFotograma(cursor),
              // 048 v1.1 (5): horizonte conservador; una noticia alcanzada y aún pendiente lo anula.
              ventanaS: horizonteS(datos.registro, segundo, datos.terminada, s.sonadas, s.activadoTick / 10),
              terminada: r.estado === "final", cerrando: s.cerrando,
              // Brief 056 § 5.1 (4): reloj de presentación detenido (las previas no miran la ventana).
              relojDetenido: r.estado === "preparando" || r.estado === "recuperando",
              // v3.1: la entrada precede a todo invitado: pendiente de pedir, en vuelo o sin consumir.
              aperturaPendiente: s.entradaPendiente || [...s.peticiones.keys()].some(k => k.startsWith("entrada:")) || [...s.clips.entries()].some(([k, c]) => k.startsWith("entrada:") && !c.consumido),
              candidatas: [...s.invitados.values()].filter(inv => !s.pedidas.has(inv.intervencion.id)).map(inv => ({ id: inv.intervencion.id, rol: inv.intervencion.rol, tick: inv.intervencion.tick, origen: inv.intervencion.turnos?.length ? "048" as const : "045" as const, tema: inv.intervencion.tema, completa: estadoCoordinador(inv.completa), breve: estadoCoordinador(inv.breve) })),
            };
            for (const id of descartesTurno(entrada)) terminarInvitado(s, id);
            entrada.candidatas = entrada.candidatas.filter(c => s.invitados.has(c.id));
            // Brief 058 v1.1 § 5: ningún invitado durante la antesala.
            const turno = s.antesala ? null : siguienteTurno(entrada);
            const clips = [...s.clips.entries()].sort(([, a], [, b]) => (b.segmento.prioridad ?? 10) - (a.segmento.prioridad ?? 10) || b.segmento.fragmentos[0]!.tick - a.segmento.fragmentos[0]!.tick);
            for (const [clave, clip] of clips) {
              if (s.cerrando) break;
              const tick = clip.segmento.fragmentos[0]!.tick, prioridad = clip.segmento.prioridad ?? (clip.segmento.fragmentos[0]?.emocion === "jubilo" ? 100 : 10);
              if (!clip.segmento.cierre && (tick < s.activadoTick || segundo - tick / 10 > (prioridad >= 80 ? VOZ_BUFFER.atrasoImportanteS : VOZ_BUFFER.atrasoNormalS))) { s.clips.delete(clave); continue; }
              if (clip.consumido) continue;
              // Brief 050 v1.1 (1): con un canto sonando, un gol anterior (o el mismo, llegado tarde) queda superado.
              if (golSuperado(prioridad, tick, s.activa)) { s.clips.delete(clave); continue; }
              // La preferencia del invitado sobre el editorial no alcanza a la entrada ni al cierre.
              if (turno && prioridad < MESA_ARENA.prioridadInvitado && !clip.segmento.cierre && clip.segmento.tipoRelato !== "entrada") continue;
              const recuerdo: RecuerdoVoz = { tick: Math.floor(segundo * 10), texto: clip.segmento.texto, clave: clip.segmento.claveVoz, tema: clip.segmento.temaVoz, estado: "iniciada" };
              // La preparación adelantada puede no conocer la última frase oída.
              // Revalidar aquí evita reproducir la misma idea desde otra ventana.
              if (tick <= segundo * 10 && !clip.segmento.cierre && clip.segmento.tipoRelato !== "entrada" && (prioridad < 35 ? repetidaVoz(s.memoria, recuerdo) : recuerdo.clave && s.memoria.some(m => m.clave === recuerdo.clave))) { s.clips.delete(clave); continue; }
              if (clip.segmento.firmaEstado && tick <= segundo * 10 && clip.segmento.firmaEstado !== firmaEstadoVoz(estadoVisual(datos.registro, segundo))) { s.clips.delete(clave); continue; }
              const plan = planVozBuffer(tick / 10, clip.audio.duration, segundo, s.contexto.currentTime, s.activa?.fin ?? 0, prioridad, s.activa?.prioridad ?? 0, clip.segmento.cierre, s.activa ? s.activa.tick / 10 : undefined);
              if (!plan) continue;
              if (plan.interrumpirAnterior) {
                if (s.activa) { s.activa.recuerdo.estado = "interrumpida"; if (s.activa.rol !== "narrador") s.finUltimoInvitado = s.contexto.currentTime; }
                try { s.activa?.fuente.stop(); } catch { /* Ya terminó. */ }
              }
              const fuente = s.contexto.createBufferSource(); fuente.buffer = clip.audio; fuente.connect(s.contexto.destination);
              const activa: Activa = { fuente, fin: plan.fin, prioridad, recuerdo, rol: "narrador", tick }; s.activa = activa; clip.consumido = true;
              const noticia = prioridad >= VOZ_BUFFER.prioridadInterrupcion;
              if (noticia) { s.finUltimaNoticia = plan.fin; for (const e of clip.segmento.fuentes) s.sonadas.add(e); }
              if (clip.segmento.cierre) s.cerrando = true;
              fuente.onended = () => {
                if (recuerdo.estado === "iniciada") recuerdo.estado = "completa"; fuente.disconnect();
                if (sonido.current === s && noticia && s.finUltimaNoticia === plan.fin) s.finUltimaNoticia = Math.min(plan.fin, s.contexto.currentTime);
                if (sonido.current === s && s.activa === activa) { s.activa = undefined; s.ultimoFin = s.contexto.currentTime; setHablando(false); }
              };
              fuente.start(plan.cuando); s.memoria = recordarVoz(s.memoria, recuerdo); setPasaje(clip.segmento); setHablando(true); break;
            }
            // Brief 058 v1.1 § 2 (topeS = 0): la antesala va después del bucle del narrador y antes de las reservas.
            if (s.antesala) fotogramaAntesala(s, true, segundo);
            const invitado = turno && !s.activa && !s.cerrando ? s.invitados.get(turno.id)?.[turno.variante].clip : undefined;
            if (turno && invitado) {
              const tick = invitado.segmento.desdeTick, rol = invitado.segmento.rol ?? "comentarista";
              // Exención del atraso del narrador (cierre = true solo para el plan), sin activar el cierre.
              const plan = planVozBuffer(tick / 10, invitado.audio.duration, segundo, s.contexto.currentTime, s.activa?.fin ?? 0, MESA_ARENA.prioridadInvitado, s.activa?.prioridad ?? 0, true);
              if (plan) {
                // v3.1: el recuerdo devuelto por siguienteTurno, tal cual (`texto = id`).
                const recuerdo: RecuerdoVoz = turno.recuerdo;
                const fuente = s.contexto.createBufferSource(); fuente.buffer = invitado.audio; fuente.connect(s.contexto.destination);
                const activa: Activa = { fuente, fin: plan.fin, prioridad: MESA_ARENA.prioridadInvitado, recuerdo, rol, tick }; s.activa = activa;
                // 048: al arrancar una variante se descarta la otra.
                const tema = s.invitados.get(turno.id)?.intervencion.tema;
                invitado.consumido = true; terminarInvitado(s, turno.id);
                s.ultimoInvitado = { rol, tick, tema }; s.finUltimoInvitado = plan.fin;
                fuente.onended = () => {
                  if (recuerdo.estado === "iniciada") recuerdo.estado = "completa"; fuente.disconnect();
                  if (sonido.current === s && s.activa === activa) { s.activa = undefined; s.ultimoFin = s.contexto.currentTime; s.finUltimoInvitado = Math.min(plan.fin, s.contexto.currentTime); setHablando(false); }
                };
                // Solo si el audio arranca, el recuerdo entra en la memoria de escucha.
                fuente.start(plan.cuando); s.memoria = recordarVoz(s.memoria, recuerdo); setPasaje(invitado.segmento); setHablando(true);
              }
            }
            const cierreReserva = r.estado === "final" && s.cierreFallido;
            // Nota del 22 oct (043): rotación por emisión, no por la memoria de escucha.
            const reserva = !s.activa && !s.cerrando && !s.antesala && s.reservas.length && s.contexto.currentTime - s.ultimoFin >= VOZ_BUFFER.reservaTrasS
              ? elegirReservaVoz(s.reservas, s.reservasOidas, { semilla: datos.registro.config.partido.seed, cierre: cierreReserva, total: s.totalReservas }) : undefined;
            if (reserva) {
              const cierre = cierreReserva;
              const recuerdo: RecuerdoVoz = { tick: Math.floor(segundo * 10), texto: reserva.texto, tema: "reserva", estado: "iniciada" };
              const fuente = s.contexto.createBufferSource(); fuente.buffer = reserva.audio; fuente.connect(s.contexto.destination);
              const activa: Activa = { fuente, fin: s.contexto.currentTime + reserva.audio.duration, prioridad: -1, recuerdo, rol: "narrador", tick: Math.floor(segundo * 10) }; s.activa = activa;
              if (cierre) s.cerrando = true;
              fuente.onended = () => { if (recuerdo.estado === "iniciada") recuerdo.estado = "completa"; fuente.disconnect(); if (sonido.current === s && s.activa === activa) { s.activa = undefined; s.ultimoFin = s.contexto.currentTime; setHablando(false); } };
              fuente.start(); s.memoria = recordarVoz(s.memoria, recuerdo); if (!reserva.cierre) s.reservasOidas.push(reserva.texto);
              setPasaje({ desdeTick: Math.floor(segundo * 10), hastaTick: Math.floor(segundo * 10), modo: "buffer", idioma: s.idioma, texto: reserva.texto, fragmentos: [{ tick: Math.floor(segundo * 10), texto: reserva.texto, emocion: "serena", intensidad: .18, variante: 0, fuentes: [], fotogramas: [] }], fuentes: [], fotogramas: [], eventosDisponibles: 0, eventosNarrados: 0, conduccionesNarradas: 0, audio: null, prioridad: -1, cierre, tipoRelato: "comentario", firmaEstado: undefined, claveVoz: undefined, temaVoz: "reserva" });
              setHablando(true);
            }
          } else if (!reanudando.current) reanudarAudio();
        }
      }
      frame = requestAnimationFrame(animar);
    };
    const ocultar = () => { if (document.hidden) { reloj.current.pausar(); void sonido.current?.contexto.suspend(); } else finSuspensionPropia.current = performance.now(); };
    document.addEventListener("visibilitychange", ocultar); frame = requestAnimationFrame(animar);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", ocultar); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** «Habilitar reproducción de audio»: reanuda en el gesto y, con el reloj aún en 0:00, la antesala puede empezar
   * (v1.1 § 3: retención aplicada en este mismo manejador; t0 = este clic en una activación manual). */
  const habilitarAudio = () => {
    reanudarAudio(true);
    const s = sonido.current;
    if (s && !s.antesala && !s.silenciada) {
      if (!automatica || t0Antesala.current === null) t0Antesala.current = performance.now();
      intentarAntesala(s, t0Antesala.current);
    }
  };
  const pausar = () => {
    if (reloj.current.estado === "pausada") { reloj.current.continuar(); finSuspensionPropia.current = performance.now(); }
    else { reloj.current.pausar(); void sonido.current?.contexto.suspend(); }
    setVersion(v => v + 1);
  };
  const estados = {
    preparando: t(`Preparing broadcast · ${Math.floor(vista.reserva)}/20 s ready`, `Preparando emisión · ${Math.floor(vista.reserva)}/20 s listos`),
    reproduciendo: t(`Live · ${Math.floor(vista.reserva)} s ready`, `En vivo · ${Math.floor(vista.reserva)} s listos`),
    recuperando: t("Rebuilding the buffer before continuing…", "Recuperando el búfer antes de continuar…"),
    pausada: t("Broadcast paused · generation continues", "Emisión pausada · la generación continúa"), final: t("End of broadcast", "Fin de la emisión"),
  };
  // Brief 058 § 4.5 · Mientras dura la retención, la única región viva anuncia la presentación.
  const presentacion = vista.reserva + 1e-6 < BUFFER_ARENA.segundos
    ? t(`Pre-match presentation · ${Math.floor(vista.reserva)}/${BUFFER_ARENA.segundos} s ready`, `Presentación del partido · ${Math.floor(vista.reserva)}/${BUFFER_ARENA.segundos} s listos`)
    : t("Pre-match presentation · broadcast ready", "Presentación del partido · emisión lista");
  const textoEstado = vista.retenido && (vista.estado === "preparando" || vista.estado === "recuperando") ? presentacion : estados[vista.estado];
  return <section className="arena-intelligence" data-testid="arena-buffer" aria-label={t("Live playback and audio", "Reproducción en vivo y audio")}>
    {ranura && createPortal(<button className="btn" data-estado={vista.estado} aria-keyshortcuts="Space" disabled={vista.estado === "final"} onClick={pausar}>{vista.estado === "pausada" ? t("Resume broadcast", "Continuar emisión") : t("Pause broadcast", "Pausar emisión")}</button>, ranura)}
    <h2>{t("Live match", "Partido en vivo")}</h2>
    <p className="arena-muted">{t("Continuous narration combines match action and commentary, with pauses under five seconds while audio is enabled.", "La narración continua combina jugadas y comentarios, con pausas de menos de cinco segundos mientras el audio está activado.")}</p>
    <p role="status" data-testid="arena-buffer-status" data-ready-seconds={vista.reserva.toFixed(2)}>{textoEstado}</p>
    <div className="arena-live-controls">
      {faseAntesala && <button className="btn" ref={saltarRef} data-testid="arena-antesala-skip" onClick={saltarAntesala}>{t("Skip to kick-off", "Saltar al saque")}</button>}
      <button className="btn" ref={vozBotonRef} disabled={!disponible || vista.estado === "final" && !voz} aria-pressed={voz} onClick={cambiarVoz}>{voz ? t("Turn narration off", "Desactivar narración") : t("Enable narration", "Activar narración")}</button>
      {pulsar && <button className="btn" onClick={habilitarAudio}>{t("Enable audio playback", "Habilitar reproducción de audio")}</button>}
      {terminada && <button className="btn" onClick={alRepeticion}>{t("Open available replay", "Abrir repetición disponible")}</button>}
    </div>
    {voz && automatica && <p className="arena-muted" data-testid="arena-voice-default-note">{t("Narration started with the match. «Turn narration off» mutes it; this browser remembers your choice.", "La narración empezó con el partido. «Desactivar narración» la silencia; este navegador recuerda tu elección.")}</p>}
    {/* Codex 058 #4: durante la retención de la antesala la única región viva es arena-buffer-status; el estado de
        voz sigue visible, sin anuncios. */}
    {voz && <p role={vista.retenido || faseAntesala ? undefined : "status"} data-testid="arena-voice-status">{hablando ? pasaje?.cierre ? t("Closing commentary", "Comentario de cierre") : t("Narration playing", "Narración en reproducción") : pasaje?.cierre ? t("End of narration", "Fin de la narración") : t("Preparing the next passage", "Preparando la siguiente intervención")}</p>}
    {pasaje && <details data-testid="arena-voice-transcript" data-narration-tick={pasaje.fragmentos[0]?.tick} data-narration-kind={"tipoRelato" in pasaje ? pasaje.tipoRelato : "comentario"} data-narration-role={pasaje.rol ?? "narrador"} data-narration-variant={pasaje.variante} data-narration-intervention={pasaje.intervencion}><summary>{t("Narration transcript and evidence", "Transcripción y evidencia de la narración")}</summary>{pasaje.fragmentos.map((f, k) => <p key={k} data-narration-role={f.rol ?? "narrador"}>{f.texto}</p>)}<p className="arena-muted">{pasaje.fuentes.join(" · ")}</p></details>}
    {voz && error && <p role="alert">{t("A passage was unavailable. Backup commentary covers the wait while narration retries.", "Una intervención no estuvo disponible. Los comentarios de respaldo cubren la espera mientras la narración reintenta.")}</p>}
    {!disponible && <p className="arena-muted">{t("Audio is unavailable on this server. Follow the text description below.", "El audio no está disponible en este servidor. Sigue la descripción de texto abajo.")}</p>}
  </section>;
}
