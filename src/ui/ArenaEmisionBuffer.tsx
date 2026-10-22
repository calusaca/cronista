"use client";

import { useEffect, useRef, useState } from "react";
import { BUFFER_ARENA, firmaEstadoVoz, planVozBuffer, RelojBuffer, VOZ_BUFFER } from "../arena/buffer";
import { estadoVisual } from "../arena/vista";
import type { RegistroArena } from "../arena/tipos";
import type { construirRelato } from "../arena/relato";
import catalogoReserva from "../arena/voz-reserva.json";
import { elegirReservaVoz, recordarVoz, repetidaVoz, type RecuerdoVoz } from "../arena/editorial";
import { calmaEnFotograma, descartesTurno, esperaReintentoInvitado, estadoPorDuracion, estimarDuracionS, horizonteS, segmentoVozValido, siguienteTurno, varianteEfectiva, type EntradaTurno, type EstadoVariante, type FalloInvitado, type Rol } from "../arena/turnos";
import type { IntervencionArena, VarianteIntercambio } from "../arena/protocolo";
import { ARENA, MESA_ARENA } from "../sim/limites";

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
type Activa = { fuente: AudioBufferSourceNode; fin: number; prioridad: number; recuerdo: RecuerdoVoz; rol: Rol };
type Reserva = { texto: string; audio: AudioBuffer; cierre: boolean };
/** Brief 045: los invitados tienen su propia preparación (una a la vez) y sus propios clips;
 * nunca ocupan la concurrencia del narrador. */
type Sonido = { silenciada: boolean; activacion: number; activadoTick: number; entradaPendiente: boolean; idioma: "es" | "en"; contexto: AudioContext; clips: Map<string, Clip>; peticiones: Map<string, AbortController>; desde: number; cierrePedido: boolean; cierreFallido: boolean; cerrando: boolean; ultimoFin: number; reservas: Reserva[]; memoria: RecuerdoVoz[]; activa?: Activa;
  /** 048: por id de intervención, sus dos variantes; peticiones por `${id}|${variante}`; `pedidas` = ids terminados
   * (arrancados, descartados o caducados); `sonadas` = eventos cuya noticia ya sonó. */
  invitados: Map<string, InvitadoLocal>; peticionesInvitado: Map<string, AbortController>; pedidas: Set<string>; sonadas: Set<string>; finUltimaNoticia: number | null; finUltimoInvitado: number | null; ultimoInvitado: { rol: Rol; tick: number } | null };

/** 048 · Una intervención termina en este consumidor (arrancó, se descartó o caducó): se abortan sus
 * peticiones, se sueltan sus dos variantes y no se vuelve a pedir. */
function terminarInvitado(s: Sonido, id: string) {
  for (const variante of ["completa", "breve"] as const) { const clave = `${id}|${variante}`; s.peticionesInvitado.get(clave)?.abort(); s.peticionesInvitado.delete(clave); }
  s.invitados.delete(id); s.pedidas.add(id);
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
  const actual = useRef({ hastaTick, terminada, registro, alTiempo, intervenciones }); actual.current = { hastaTick, terminada, registro, alTiempo, intervenciones };
  const limpiar = () => {
    generacion.current++; reanudando.current = false;
    const s = sonido.current; sonido.current = null;
    if (s) {
      for (const a of s.peticiones.values()) a.abort();
      for (const a of s.peticionesInvitado.values()) a.abort();
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
    limpiar(); setVoz(false); setError(false); setPulsar(false); setPasaje(null); setHablando(false);
    return limpiar;
    // La sesión tiene una key propia; los datos entrantes no reinician la voz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion, idioma]);

  const reanudarAudio = (forzar = false) => {
    const s = sonido.current;
    if (!s || reanudando.current && !forzar || s.contexto.state === "running") return;
    reanudando.current = true;
    void s.contexto.resume().then(() => {
      if (sonido.current === s) setPulsar(s.contexto.state !== "running");
    }).catch(() => { if (sonido.current === s) setPulsar(true); }).finally(() => { if (sonido.current === s) reanudando.current = false; });
  };
  const cambiarVoz = () => {
    setError(false); setPulsar(false); setPasaje(null); setHablando(false);
    let s = sonido.current;
    if (voz && s) {
      s.silenciada = true;
      if (s.activa) s.activa.recuerdo.estado = "interrumpida";
      try { s.activa?.fuente.stop(); } catch { /* Ya terminó. */ }
      s.activa = undefined; void s.contexto.suspend(); setVoz(false); return;
    }
    const tick = Math.floor(reloj.current.segundo * 10);
    if (!s) {
      const contexto = new AudioContext({ sampleRate: 24000 });
      const desde = Math.floor(tick / BUFFER_ARENA.tramoTicks) * BUFFER_ARENA.tramoTicks;
      s = { silenciada: false, activacion: 0, activadoTick: tick, entradaPendiente: true, idioma, contexto, clips: new Map(), peticiones: new Map(), desde, cierrePedido: false, cierreFallido: false, cerrando: false, ultimoFin: contexto.currentTime, reservas: [], memoria: [],
        invitados: new Map(), peticionesInvitado: new Map(), pedidas: new Set(), sonadas: new Set(), finUltimaNoticia: null, finUltimoInvitado: null, ultimoInvitado: null };
      sonido.current = s;
      const nuevo = s;
      // Reserva incluida en la aplicación, sin dependencia de red o voces locales.
      void Promise.all(catalogoReserva[idioma].map(async (clip, i, todos) => ({ texto: clip.texto, cierre: i === todos.length - 1, audio: await contexto.decodeAudioData(Uint8Array.from(atob(clip.base64), c => c.charCodeAt(0)).buffer) })))
        .then(clips => { if (sonido.current === nuevo) nuevo.reservas = clips; })
        .catch(() => { if (sonido.current === nuevo) setError(true); });
    }
    s.silenciada = false; s.activacion++; s.activadoTick = tick; s.entradaPendiente = true; s.ultimoFin = s.contexto.currentTime;
    for (const [clave, a] of s.peticiones) if (clave.startsWith("entrada:")) { a.abort(); s.peticiones.delete(clave); }
    for (const [clave, c] of s.clips) if (c.segmento.fragmentos[0]!.tick < tick || clave.startsWith("entrada:")) s.clips.delete(clave);
    for (const [id, inv] of s.invitados) if (inv.intervencion.tick < tick) terminarInvitado(s, id);
    reanudarAudio(true);
    setVoz(true); setVersion(v => v + 1);
  };

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
            const espera = esperaReintentoInvitado(fallo, reintentos, reloj.current.segundo - tick * ARENA.pasoS);
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
      if ((tickVisible - intervencion.tick) / 10 > MESA_ARENA.caducidadInvitadoS) { terminarInvitado(s, intervencion.id); continue; }
      let inv = s.invitados.get(intervencion.id);
      if (!inv) { inv = { intervencion, completa: { estado: "sin-pedir" }, breve: { estado: intervencion.turnosBreve?.length ? "sin-pedir" : "inexistente" } }; s.invitados.set(intervencion.id, inv); }
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
  }, [sesion, hastaTick, terminada, idioma, voz, version, bloque, intervenciones.length]);

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
              // v3.1: la entrada precede a todo invitado: pendiente de pedir, en vuelo o sin consumir.
              aperturaPendiente: s.entradaPendiente || [...s.peticiones.keys()].some(k => k.startsWith("entrada:")) || [...s.clips.entries()].some(([k, c]) => k.startsWith("entrada:") && !c.consumido),
              candidatas: [...s.invitados.values()].filter(inv => !s.pedidas.has(inv.intervencion.id)).map(inv => ({ id: inv.intervencion.id, rol: inv.intervencion.rol, tick: inv.intervencion.tick, origen: inv.intervencion.turnos?.length ? "048" as const : "045" as const, completa: estadoCoordinador(inv.completa), breve: estadoCoordinador(inv.breve) })),
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
              // La preferencia del invitado sobre el editorial no alcanza a la entrada ni al cierre.
              if (turno && prioridad < MESA_ARENA.prioridadInvitado && !clip.segmento.cierre && clip.segmento.tipoRelato !== "entrada") continue;
              const recuerdo: RecuerdoVoz = { tick: Math.floor(segundo * 10), texto: clip.segmento.texto, clave: clip.segmento.claveVoz, tema: clip.segmento.temaVoz, estado: "iniciada" };
              // La preparación adelantada puede no conocer la última frase oída.
              // Revalidar aquí evita reproducir la misma idea desde otra ventana.
              if (tick <= segundo * 10 && !clip.segmento.cierre && clip.segmento.tipoRelato !== "entrada" && (prioridad < 35 ? repetidaVoz(s.memoria, recuerdo) : recuerdo.clave && s.memoria.some(m => m.clave === recuerdo.clave))) { s.clips.delete(clave); continue; }
              if (clip.segmento.firmaEstado && tick <= segundo * 10 && clip.segmento.firmaEstado !== firmaEstadoVoz(estadoVisual(datos.registro, segundo))) { s.clips.delete(clave); continue; }
              const plan = planVozBuffer(tick / 10, clip.audio.duration, segundo, s.contexto.currentTime, s.activa?.fin ?? 0, prioridad, s.activa?.prioridad ?? 0, clip.segmento.cierre);
              if (!plan) continue;
              if (plan.interrumpirAnterior) {
                if (s.activa) { s.activa.recuerdo.estado = "interrumpida"; if (s.activa.rol !== "narrador") s.finUltimoInvitado = s.contexto.currentTime; }
                try { s.activa?.fuente.stop(); } catch { /* Ya terminó. */ }
              }
              const fuente = s.contexto.createBufferSource(); fuente.buffer = clip.audio; fuente.connect(s.contexto.destination);
              const activa: Activa = { fuente, fin: plan.fin, prioridad, recuerdo, rol: "narrador" }; s.activa = activa; clip.consumido = true;
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
                const activa: Activa = { fuente, fin: plan.fin, prioridad: MESA_ARENA.prioridadInvitado, recuerdo, rol }; s.activa = activa;
                // 048: al arrancar una variante se descarta la otra.
                invitado.consumido = true; terminarInvitado(s, turno.id);
                s.ultimoInvitado = { rol, tick }; s.finUltimoInvitado = plan.fin;
                fuente.onended = () => {
                  if (recuerdo.estado === "iniciada") recuerdo.estado = "completa"; fuente.disconnect();
                  if (sonido.current === s && s.activa === activa) { s.activa = undefined; s.ultimoFin = s.contexto.currentTime; s.finUltimoInvitado = Math.min(plan.fin, s.contexto.currentTime); setHablando(false); }
                };
                // Solo si el audio arranca, el recuerdo entra en la memoria de escucha.
                fuente.start(plan.cuando); s.memoria = recordarVoz(s.memoria, recuerdo); setPasaje(invitado.segmento); setHablando(true);
              }
            }
            if (!s.activa && !s.cerrando && s.reservas.length && s.contexto.currentTime - s.ultimoFin >= VOZ_BUFFER.reservaTrasS) {
              const cierre = r.estado === "final" && s.cierreFallido;
              const reserva = elegirReservaVoz(s.reservas, s.memoria, cierre)!;
              const recuerdo: RecuerdoVoz = { tick: Math.floor(segundo * 10), texto: reserva.texto, tema: "reserva", estado: "iniciada" };
              const fuente = s.contexto.createBufferSource(); fuente.buffer = reserva.audio; fuente.connect(s.contexto.destination);
              const activa: Activa = { fuente, fin: s.contexto.currentTime + reserva.audio.duration, prioridad: -1, recuerdo, rol: "narrador" }; s.activa = activa;
              if (cierre) s.cerrando = true;
              fuente.onended = () => { if (recuerdo.estado === "iniciada") recuerdo.estado = "completa"; fuente.disconnect(); if (sonido.current === s && s.activa === activa) { s.activa = undefined; s.ultimoFin = s.contexto.currentTime; setHablando(false); } };
              fuente.start(); s.memoria = recordarVoz(s.memoria, recuerdo);
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
    {voz && <p role="status" data-testid="arena-voice-status">{hablando ? pasaje?.cierre ? t("Closing commentary", "Comentario de cierre") : t("Narration playing", "Narración en reproducción") : pasaje?.cierre ? t("End of narration", "Fin de la narración") : t("Preparing the next passage", "Preparando la siguiente intervención")}</p>}
    {pasaje && <details data-testid="arena-voice-transcript" data-narration-tick={pasaje.fragmentos[0]?.tick} data-narration-kind={"tipoRelato" in pasaje ? pasaje.tipoRelato : "comentario"} data-narration-role={pasaje.rol ?? "narrador"} data-narration-variant={pasaje.variante}><summary>{t("Narration transcript and evidence", "Transcripción y evidencia de la narración")}</summary>{pasaje.fragmentos.map((f, k) => <p key={k} data-narration-role={f.rol ?? "narrador"}>{f.texto}</p>)}<p className="arena-muted">{pasaje.fuentes.join(" · ")}</p></details>}
    {voz && error && <p role="alert">{t("A passage was unavailable. Backup commentary covers the wait while narration retries.", "Una intervención no estuvo disponible. Los comentarios de respaldo cubren la espera mientras la narración reintenta.")}</p>}
    {!disponible && <p className="arena-muted">{t("Audio is unavailable on this server. Follow the text description below.", "El audio no está disponible en este servidor. Sigue la descripción de texto abajo.")}</p>}
  </section>;
}
