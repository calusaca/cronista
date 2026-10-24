"use client";

import { useEffect, useRef, useState } from "react";
import { BUFFER_ARENA, firmaEstadoVoz, golSuperado, planVozBuffer, RelojBuffer, VOZ_BUFFER } from "../arena/buffer";
import { estadoVisual } from "../arena/vista";
import type { RegistroArena } from "../arena/tipos";
import type { construirRelato } from "../arena/relato";
import { elegirReservaVoz, ordenPrimeraVuelta, recordarVoz, repetidaVoz, type RecuerdoVoz } from "../arena/editorial";
import { ARCHIVO_INDICE_RESERVAS, leerIndiceReservas, RUTA_RESERVAS } from "../arena/reservas-voz";
import { caducidadInvitadoS, calmaEnFotograma, candidatasAlReactivar, descartesTurno, esperaReintentoInvitado, estadoPorDuracion, estimarDuracionS, horizonteS, segmentoVozValido, siguienteTurno, varianteEfectiva, type EntradaTurno, type EstadoVariante, type FalloInvitado, type Rol } from "../arena/turnos";
import type { IntervencionArena, VarianteIntercambio } from "../arena/protocolo";
import { esPrevia } from "../arena/previa";
import { ARENA, MESA_ARENA, NARRACION_DIRECTO, RESERVAS_VOZ } from "../sim/limites";
import { guardarPreferenciaNarracion, narracionAutomatica, tomarAudioCebado } from "./audio-directo";

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
  invitados: Map<string, InvitadoLocal>; peticionesInvitado: Map<string, AbortController>; pedidas: Set<string>; sonadas: Set<string>; finUltimaNoticia: number | null; finUltimoInvitado: number | null; ultimoInvitado: { rol: Rol; tick: number; tema?: string } | null };

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
export function ArenaEmisionBuffer({ sesion, hastaTick, terminada, inicioTick, idioma, registro, alTiempo, alRepeticion, intervenciones = [] }: {
  sesion: string; registro: RegistroArena; hastaTick: number; terminada: boolean; inicioTick: number; idioma: "es" | "en"; intervenciones?: readonly IntervencionArena[];
  alTiempo: (tick: number) => void; alRepeticion: () => void;
}) {
  const es = idioma === "es", t = (en: string, esp: string) => es ? esp : en;
  const reloj = useRef(new RelojBuffer(inicioTick / 10));
  const [vista, setVista] = useState({ segundo: inicioTick / 10, estado: reloj.current.estado, reserva: 0 });
  const [voz, setVoz] = useState(false), [disponible, setDisponible] = useState(false), [error, setError] = useState(false), [pulsar, setPulsar] = useState(false), [version, setVersion] = useState(0);
  const [pasaje, setPasaje] = useState<Segmento | null>(null), [hablando, setHablando] = useState(false);
  const sonido = useRef<Sonido | null>(null), generacion = useRef(0), reanudando = useRef(false);
  // Brief 058 · A: activación automática (una vez por montaje) en una sesión propia, y nota fija.
  const [automatica, setAutomatica] = useState(false), autoIntentada = useRef(false);
  const vozRef = useRef(voz); vozRef.current = voz;
  const disponibleRef = useRef(disponible); disponibleRef.current = disponible;
  const actual = useRef({ hastaTick, terminada, registro, alTiempo, intervenciones }); actual.current = { hastaTick, terminada, registro, alTiempo, intervenciones };
  const limpiar = () => {
    generacion.current++; reanudando.current = false;
    const s = sonido.current; sonido.current = null;
    if (s) {
      for (const a of s.peticiones.values()) a.abort();
      for (const a of s.peticionesInvitado.values()) a.abort();
      s.cargaReservas.abort();
      try { s.activa?.fuente.stop(); } catch { /* Ya terminó. */ }
      void s.contexto.close().catch(() => {});
    }
  };
  useEffect(() => {
    const a = new AbortController();
    void fetch("/api/arena/herramientas", { signal: a.signal }).then(r => r.json()).then(r => setDisponible(r.voz === true)).catch(() => {});
    return () => a.abort();
  }, []);
  useEffect(() => {
    // Brief 058 § 3.1: al cambiar de idioma en una sesión propia, la narración vuelve a activarse sola en el
    // idioma nuevo si la preferencia sigue activa y la voz estaba activa antes del cambio.
    const reactivar = vozRef.current && narracionAutomatica(sesion, disponibleRef.current);
    limpiar(); setVoz(false); setAutomatica(false); setError(false); setPulsar(false); setPasaje(null); setHablando(false);
    if (reactivar) activarVoz(true);
    return limpiar;
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
    const encender = !(voz && sonido.current);
    if (encender) activarVoz(false); else apagarVoz();
    guardarPreferenciaNarracion(encender);
  };
  const apagarVoz = () => {
    setError(false); setPulsar(false); setPasaje(null); setHablando(false);
    const s = sonido.current;
    if (!s) return;
    s.silenciada = true;
    if (s.activa) s.activa.recuerdo.estado = "interrumpida";
    try { s.activa?.fuente.stop(); } catch { /* Ya terminó. */ }
    s.activa = undefined; void s.contexto.suspend(); vozRef.current = false; setVoz(false); setAutomatica(false);
  };
  const activarVoz = (automaticaAhora: boolean) => {
    setError(false); setPulsar(false); setPasaje(null); setHablando(false);
    let s = sonido.current;
    const tick = Math.floor(reloj.current.segundo * 10);
    if (!s) {
      // Brief 058 § 3.2: se adopta el contexto cebado en el clic de «Iniciar partido en vivo», si lo hay.
      const contexto = tomarAudioCebado() ?? new AudioContext({ sampleRate: 24000 });
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
    window.setTimeout(() => { if (sonido.current === armado && armado.activacion === activacion && !armado.silenciada && armado.contexto.state !== "running") setPulsar(true); }, NARRACION_DIRECTO.desbloqueoMs);
    vozRef.current = true; setVoz(true); setAutomatica(automaticaAhora); setVersion(v => v + 1);
  };
  useEffect(() => {
    if (!disponible || autoIntentada.current || sonido.current) return;
    autoIntentada.current = true;
    if (reloj.current.estado !== "final" && narracionAutomatica(sesion, disponible)) activarVoz(true);
    // Una sola vez por montaje, cuando /herramientas confirma la voz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disponible]);

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
          const r = await fetch(`/api/arena/sesiones/${sesion}/relato`, { method: "POST", headers: { "content-type": "application/json" }, signal, body: JSON.stringify({ desdeTick: desde, hastaTick: hasta, modo: "buffer", idioma, memoria: s.memoria, ...(cierre ? { cierre: true } : {}), ...(entradaTick === undefined ? {} : { entradaTick }) }) });
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
      setVista(v => v.estado === r.estado && Math.abs(v.segundo - segundo) < .1 && Math.abs(v.reserva - (datos.hastaTick / 10 - segundo)) < .1 ? v : { segundo, estado: r.estado, reserva: Math.max(0, datos.hastaTick / 10 - segundo) });
      if (s) {
        const detenido = document.hidden || r.estado === "pausada" || s.silenciada;
        if (detenido && s.contexto.state === "running") void s.contexto.suspend();
        if (!detenido) {
          if (s.contexto.state === "running") {
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
            const turno = siguienteTurno(entrada);
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
            const reserva = !s.activa && !s.cerrando && s.reservas.length && s.contexto.currentTime - s.ultimoFin >= VOZ_BUFFER.reservaTrasS
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
    const ocultar = () => { if (document.hidden) { reloj.current.pausar(); void sonido.current?.contexto.suspend(); } };
    document.addEventListener("visibilitychange", ocultar); frame = requestAnimationFrame(animar);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", ocultar); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pausar = () => {
    if (reloj.current.estado === "pausada") reloj.current.continuar();
    else { reloj.current.pausar(); void sonido.current?.contexto.suspend(); }
    setVersion(v => v + 1);
  };
  const estados = {
    preparando: t(`Preparing broadcast · ${Math.floor(vista.reserva)}/20 s ready`, `Preparando emisión · ${Math.floor(vista.reserva)}/20 s listos`),
    reproduciendo: t(`Live · ${Math.floor(vista.reserva)} s ready`, `En vivo · ${Math.floor(vista.reserva)} s listos`),
    recuperando: t("Rebuilding the buffer before continuing…", "Recuperando el búfer antes de continuar…"),
    pausada: t("Broadcast paused · generation continues", "Emisión pausada · la generación continúa"), final: t("End of broadcast", "Fin de la emisión"),
  };
  return <section className="arena-intelligence" data-testid="arena-buffer" aria-label={t("Live playback and audio", "Reproducción en vivo y audio")}>
    <h2>{t("Live match", "Partido en vivo")}</h2>
    <p className="arena-muted">{t("Continuous narration combines match action and commentary, with pauses under five seconds while audio is enabled.", "La narración continua combina jugadas y comentarios, con pausas de menos de cinco segundos mientras el audio está activado.")}</p>
    <p role="status" data-testid="arena-buffer-status" data-ready-seconds={vista.reserva.toFixed(2)}>{estados[vista.estado]}</p>
    <div className="arena-live-controls">
      <button className="btn" disabled={vista.estado === "final"} onClick={pausar}>{vista.estado === "pausada" ? t("Resume broadcast", "Continuar emisión") : t("Pause broadcast", "Pausar emisión")}</button>
      <button className="btn" disabled={!disponible || vista.estado === "final" && !voz} aria-pressed={voz} onClick={cambiarVoz}>{voz ? t("Turn narration off", "Desactivar narración") : t("Enable narration", "Activar narración")}</button>
      {pulsar && <button className="btn" onClick={() => reanudarAudio(true)}>{t("Enable audio playback", "Habilitar reproducción de audio")}</button>}
      {terminada && <button className="btn" onClick={alRepeticion}>{t("Open available replay", "Abrir repetición disponible")}</button>}
    </div>
    {voz && automatica && <p className="arena-muted" data-testid="arena-voice-default-note">{t("Narration started with the match. «Turn narration off» mutes it; this browser remembers your choice.", "La narración empezó con el partido. «Desactivar narración» la silencia; este navegador recuerda tu elección.")}</p>}
    {voz && <p role="status" data-testid="arena-voice-status">{hablando ? pasaje?.cierre ? t("Closing commentary", "Comentario de cierre") : t("Narration playing", "Narración en reproducción") : pasaje?.cierre ? t("End of narration", "Fin de la narración") : t("Preparing the next passage", "Preparando la siguiente intervención")}</p>}
    {pasaje && <details data-testid="arena-voice-transcript" data-narration-tick={pasaje.fragmentos[0]?.tick} data-narration-kind={"tipoRelato" in pasaje ? pasaje.tipoRelato : "comentario"} data-narration-role={pasaje.rol ?? "narrador"} data-narration-variant={pasaje.variante}><summary>{t("Narration transcript and evidence", "Transcripción y evidencia de la narración")}</summary>{pasaje.fragmentos.map((f, k) => <p key={k} data-narration-role={f.rol ?? "narrador"}>{f.texto}</p>)}<p className="arena-muted">{pasaje.fuentes.join(" · ")}</p></details>}
    {voz && error && <p role="alert">{t("A passage was unavailable. Backup commentary covers the wait while narration retries.", "Una intervención no estuvo disponible. Los comentarios de respaldo cubren la espera mientras la narración reintenta.")}</p>}
    {!disponible && <p className="arena-muted">{t("Audio is unavailable on this server. Follow the text description below.", "El audio no está disponible en este servidor. Sigue la descripción de texto abajo.")}</p>}
  </section>;
}
