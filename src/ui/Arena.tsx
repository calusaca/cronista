"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { estructura } from "../arena/catalogo";
import { formaciones, type FormacionArena, type RegistroArena } from "../arena/tipos";
import { estadoVisual, golEnCelebracion, narrarEventoArena, reconstruccionGol } from "../arena/vista";
import { etiquetasPerfil } from "../arena/personalidades";
import { ARENA, CLIMAS_PARTIDO, IDENTIDAD_ARENA, TEMPERATURA_C } from "../sim/limites";
import { identidadPartido } from "../arena/identidad";
import { Escudo } from "./Escudo";
import { EmblemaCronista } from "./Emblema";
import { IconoEventoArena } from "./IconosArena";
import { entornoDeFormulario } from "../arena/entorno-formulario";
import type { Condiciones } from "../sim/tipos";
import { IndicadorCarga, useAvisoCarga } from "./Actividad";
import Link from "./Enlace";
import { ArenaPlantilla } from "./ArenaPlantilla";
import { ArenaContexto } from "./ArenaContexto";
import { ArenaEnDirecto } from "./ArenaEnDirecto";
import { ArenaInteligencia } from "./ArenaInteligencia";
import { ArenaMesa } from "./ArenaMesa";
import { ArenaAsistente } from "./ArenaAsistente";
import { ArenaNarracion } from "./ArenaNarracion";
import { faseActiva, faseEspera, fasePista, transicionReloj, type AccionReloj, type ControlesNarracion, type DuenoReloj, type EstadoNarracion, type MotivoNarracion } from "./play-narrado";
import { ArenaDescargas } from "./ArenaDescargas";
import { ArenaPrevia } from "./ArenaPrevia";
import { previaPartido, previaVisual } from "../arena/previa";
import type { ComentarioArena } from "../arena/narrador";
import { aplicarPublicacion } from "../arena/protocolo";
import { rondaVisible } from "../arena/buffer";
import { ArenaDescripcion } from "./ArenaDescripcion";
import { ArenaEmisionBuffer } from "./ArenaEmisionBuffer";
import { ArenaCifras } from "./ArenaCifras";
import { ArenaMarcador, ArenaRotuloGol, ArenaVistaArco } from "./ArenaCelebracion";
import { AvisosFavoritos, EstrellaFavorito } from "./ArenaFavoritos";
import { memoAgregado } from "../arena/estadisticas";
import { almacenFavoritos, alternarClub, alternarJugador, FAVORITOS_VACIOS, favoritosEn, guardarFavoritos, leerFavoritos, preseleccionFavorita, type FavoritosArena } from "../arena/favoritos";
import type { IntervencionArena, PublicacionSesion, PresentacionArena, ReproduccionArena } from "../arena/protocolo";
import { cargarEncuentroTorneo, esPeticionTorneo, peticionDeUrl, SinDescompresion, type OrigenTorneo } from "./torneo-carga";

/** Brief 059 · Fecha (UTC) del torneo en la línea de procedencia. */
const fechaTorneo = (iso: string, idioma: "es" | "en") => new Intl.DateTimeFormat(idioma, { dateStyle: "long", timeZone: "UTC" }).format(new Date(iso));
const reloj = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
/** Brief 057 § 3.1 · Motivos de la degradación a reproducción muda (ES / EN). */
const MOTIVOS_NARRACION: Record<MotivoNarracion, { es: string; en: string }> = {
  "sin-voz": { es: "el audio no está disponible", en: "audio is unavailable" },
  "sin-sesion": { es: "no se pudo registrar la grabación", en: "the recording could not be registered" },
  red: { es: "fallo de red", en: "network error" },
  presupuesto: { es: "presupuesto de voz agotado", en: "voice budget exhausted" },
  caducada: { es: "la sesión compartida caducó", en: "the shared session expired" },
  ocupado: { es: "demasiadas grabaciones subidas", en: "too many uploaded recordings" },
};
export function Arena({ inicial }: { inicial: RegistroArena }) {
  const [registro, setRegistro] = useState(inicial), [tiempo, setTiempo] = useState(0);
  const [idioma, setIdioma] = useState<"es" | "en">("en");
  const [seed, setSeed] = useState("");
  const [vista, setVista] = useState<"live" | "guardados">("live");
  const [configurando, setConfigurando] = useState(true);
  const [local, setLocal] = useState<FormacionArena | "auto">("auto");
  const [visita, setVisita] = useState<FormacionArena | "auto">("auto");
  const [clima, setClima] = useState<Condiciones["clima"] | "auto">("auto");
  const [temperatura, setTemperatura] = useState(String(ARENA.temperaturaDefectoC.calor));
  const [superficie, setSuperficie] = useState<Condiciones["superficie"] | "auto">("auto");
  const [cesped, setCesped] = useState<"corto" | "alto">("corto");
  const [presion, setPresion] = useState<"auto" | "baja" | "media">("auto");
  const [segundos, setSegundos] = useState(60), [velocidad, setVelocidad] = useState(2);
  const [reproduciendo, setReproduciendo] = useState(false), [reducido, setReducido] = useState(false);
  const [pendiente, setPendiente] = useState(false), [error, setError] = useState<string | null>(null);
  const [importado, setImportado] = useState(false);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [enDirecto, setEnDirecto] = useState(false);
  const [preparandoPartido, setPreparandoPartido] = useState(false);
  // Brief 057 § 3.1 · La barra se gobierna por la fase de la pista (alActividadAudio sigue llegando, sin uso aquí).
  const [, setAudioActivo] = useState(false);
  const [estadoVoz, setEstadoVoz] = useState<EstadoNarracion>({ fase: "inactiva", listos: 0, total: 0, vozDisponible: false });
  const [conVoz, setConVoz] = useState(false), conVozIniciado = useRef(false);
  const [aviso, setAviso] = useState<{ motivo: MotivoNarracion; minutos?: number } | null>(null);
  /** v1.1 § 1 · Dueño del reloj: la cancha muda, la pista o nadie (la muda coincide con `reproduciendo`). */
  const dueno = useRef<DuenoReloj>(null);
  const controlesVoz = useRef<ControlesNarracion | null>(null);
  const alControles = useRef((c: ControlesNarracion) => { controlesVoz.current = c; }).current;
  const [bufferActivo, setBufferActivo] = useState(false), [bufferTerminada, setBufferTerminada] = useState(false), [bufferInicioTick, setBufferInicioTick] = useState(0);
  const presentacionActual = useRef<PresentacionArena>("preparada");
  const bufferRecibido = useRef(false);
  const [estadoDirecto, setEstadoDirecto] = useState("esperando");
  const [comentarios, setComentarios] = useState<ComentarioArena[]>([]);
  const [intervenciones, setIntervenciones] = useState<IntervencionArena[]>([]);
  const [sesionActual, setSesionActual] = useState<string | null>(null);
  const [archivoActual, setArchivoActual] = useState<"duelo" | "ejemplo-v3" | "ejemplo" | null>(null);
  // Brief 059 § 15.8 · Procedencia de una repetición del torneo (club y modelo por lado, de torneo.json). Solo se
  // fija si la solicitud sigue vigente y se limpia en cada ejecutar, recibirPreparado, actividadDirecto(true) y cargar.
  const [origenTorneo, setOrigenTorneo] = useState<OrigenTorneo | null>(null);
  const [errorTorneo, setErrorTorneo] = useState<"abrir" | "descompresion" | null>(null);
  const solicitud = useRef<AbortController | null>(null), cursor = useRef(0);
  const ultimaPeticion = useRef<unknown>(null);
  // Brief 049 (v1.1 § 10) · Favoritos: vacíos y sin hidratar en el primer render (SSR y cliente);
  // se leen una vez al montar y solo se escriben desde las estrellas y «Olvidar favorito».
  const [favoritos, setFavoritos] = useState<{ valor: FavoritosArena; error: boolean; hidratado: boolean }>({ valor: FAVORITOS_VACIOS, error: false, hidratado: false });
  /** Cada carga correcta (ejecutar, recibirPreparado, publicación inicio) la incrementa. */
  const [cargaId, setCargaId] = useState(0);
  const [modoInicial, setModoInicial] = useState<"fan" | "player">("fan");
  const [soloFavorito, setSoloFavorito] = useState(false);
  // Brief 056 (v1.1 § 12) · Tarjeta de alineaciones plegada: se reinicia con cada carga y al salir del tick 0.
  const [plegada, setPlegada] = useState(false);
  const es = idioma === "es";
  const bloqueado = pendiente || enDirecto || bufferActivo;
  // Defecto rev. 0000029 (Carlos): los ajustes del PRÓXIMO partido (formaciones, duración, clima, superficie, césped,
  // presión y semilla) solo se bloquean con una petición pendiente o mientras la sesión en curso se genera. Con la
  // sesión terminada se habilitan aunque la emisión siga en pantalla: no alteran la emisión ni el registro actual
  // (el reloj usa registro.config.duracionS), solo el siguiente «Start live match» o «Create recording without AI».
  const ajustesBloqueados = pendiente || enDirecto;
  const finS = registro.final.tick * ARENA.pasoS;
  const t = (en: string, esp: string) => es ? esp : en;
  useAvisoCarga(pendiente, t("Resolving the experiment…", "Resolviendo el experimento…"), t("Checking orders and preparing the recorded sequence.", "Validando órdenes y preparando la secuencia registrada."));
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const cambiar = () => setReducido(media.matches); cambiar();
    media.addEventListener("change", cambiar);
    return () => media.removeEventListener("change", cambiar);
  }, []);
  useEffect(() => () => solicitud.current?.abort(), []);
  useEffect(() => { const { favoritos: valor, error } = leerFavoritos(almacenFavoritos()); setFavoritos({ valor, error, hidratado: true }); }, []);
  // Preselección una vez por carga (y tras hidratar): el jugador favorito o el capitán del club
  // favorito, solo si nadie está seleccionado; las publicaciones «avance» no tocan cargaId.
  useEffect(() => {
    if (!favoritos.hidratado) return;
    if (seleccionado === null) { const id = preseleccionFavorita(registro, favoritos.valor); if (id) setSeleccionado(id); }
    setModoInicial(favoritosEn(registro, favoritos.valor).jugador ? "player" : "fan");
  }, [cargaId, favoritos.hidratado]);
  useEffect(() => { cursor.current = tiempo; }, [tiempo]);
  useEffect(() => {
    if (!reproduciendo) return;
    let frame = 0, anterior: number | undefined;
    let actual = cursor.current;
    const animar = (ahora: number) => {
      if (anterior !== undefined) actual = Math.min(finS, actual + Math.min((ahora - anterior) / 1000, 0.25) * velocidad);
      anterior = ahora; cursor.current = actual; setTiempo(actual);
      if (actual >= finS) setReproduciendo(false);
      else frame = requestAnimationFrame(animar);
    };
    frame = requestAnimationFrame(animar);
    const ocultar = () => { if (document.hidden) setReproduciendo(false); };
    document.addEventListener("visibilitychange", ocultar);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", ocultar); };
  }, [reproduciendo, registro, velocidad, finS]);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.has("partido") && q.get("vista") !== "buffer") { setVista("guardados"); setConfigurando(false); }
    // Brief 059 § 15.8 · ?torneo=<id>&encuentro=<nn> abre esa repetición (partido gana sobre torneo); ?lang=es.
    if (q.get("lang") === "es") setIdioma("es");
    const torneo = peticionDeUrl(q);
    if (torneo) { setVista("guardados"); setConfigurando(false); void ejecutar(torneo); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cancelar = () => { solicitud.current?.abort(); solicitud.current = null; setPendiente(false); };
  const recibirDirecto = (p: PublicacionSesion) => {
    if (p.tipo === "fin" && presentacionActual.current === "buffer") setBufferTerminada(true);
    if (p.tipo === "terminada" && presentacionActual.current === "buffer") { setBufferTerminada(true); if (p.estado !== "completa") setBufferActivo(false); }
    if (p.tipo === "sesion" && p.id) setSesionActual(p.id);
    if (p.tipo === "esperando" || p.tipo === "avance" || p.tipo === "fin") setEstadoDirecto(p.tipo === "avance" ? "jugando" : p.tipo === "fin" ? "finalizando" : "esperando");
    if (p.tipo === "inicio") { setCargaId(c => c + 1); setArchivoActual(null); setReproduciendo(false); setTiempo(0); cursor.current = 0; setSeleccionado(null); setImportado(false); setComentarios([]); setIntervenciones([]); }
    if (p.tipo === "comentario") setComentarios(anteriores => [...anteriores, p.comentario]);
    if (p.tipo === "intervencion") setIntervenciones(anteriores => anteriores.some(i => i.id === p.intervencion.id) ? anteriores : [...anteriores, p.intervencion]);
    if (p.tipo === "avance" && presentacionActual.current !== "buffer") { const s = p.estado.tick * ARENA.pasoS; setTiempo(s); cursor.current = s; }
    if (p.tipo === "inicio" || p.tipo === "ordenes" || p.tipo === "ronda" || p.tipo === "avance") setRegistro(anterior => aplicarPublicacion(anterior, p) ?? anterior);
  };
  const actividadDirecto = (activa: boolean, presentacion?: PresentacionArena) => {
    if (presentacion) { presentacionActual.current = presentacion; setBufferActivo(presentacion === "buffer"); if (presentacion === "buffer") setVelocidad(1); }
    setPreparandoPartido(activa && presentacion === "preparada"); setEnDirecto(activa);
    if (!activa && !bufferRecibido.current) setBufferActivo(false);
    if (activa) { setOrigenTorneo(null); bufferRecibido.current = false; setConfigurando(false); setBufferTerminada(false); setSesionActual(null); setArchivoActual(null); setReproduciendo(false); }
  };
  const recibirPreparado = (id: string, resultado: ReproduccionArena, buffer?: { inicioTick: number; terminada: boolean }) => {
    setOrigenTorneo(null);
    setRegistro(resultado.registro); setComentarios(resultado.comentarios); setIntervenciones(resultado.intervenciones ?? []); setSesionActual(id); setCargaId(c => c + 1);
    const inicio = (buffer?.inicioTick ?? 0) * ARENA.pasoS;
    setArchivoActual(null); setTiempo(inicio); cursor.current = inicio; setReproduciendo(false); setSeleccionado(null); setImportado(false);
    // Una instantánea que ya llega cancelada, interrumpida o con error no abre la emisión:
    // igual que el mensaje `terminada` equivalente, libera los controles (CI 39610110045).
    const fallida = "estado" in resultado && ["cancelada", "interrumpida", "error"].includes(String(resultado.estado));
    if (buffer && fallida) { bufferRecibido.current = false; setBufferActivo(false); return; }
    if (buffer) { bufferRecibido.current = true; setBufferInicioTick(buffer.inicioTick); setBufferTerminada(buffer.terminada || resultado.registro.final.tick * ARENA.pasoS >= resultado.registro.config.duracionS || Boolean(resultado.registro.final.finalizado)); setBufferActivo(true); }
  };
  const entornoElegido = entornoDeFormulario({ clima, temperatura, superficie, cesped, presion });
  const ejecutar = async (payload: unknown) => {
    setSesionActual(null); setBufferActivo(false); setOrigenTorneo(null); setErrorTorneo(null);
    solicitud.current?.abort();
    const controlador = new AbortController(); solicitud.current = controlador;
    ultimaPeticion.current = payload;
    setPendiente(true); setError(null); setReproduciendo(false);
    try {
      let cuerpo = payload, origen: OrigenTorneo | null = null;
      if (esPeticionTorneo(payload)) {
        const encuentro = await cargarEncuentroTorneo(payload, controlador.signal);
        cuerpo = { accion: "reproducir", registro: encuentro.registro }; origen = encuentro.origen;
      } else if (payload === "ejemplo" || payload === "ejemplo-v3" || payload === "duelo") {
        const archivo = await fetch(payload === "duelo" ? "/experimentos/arena-duelo-v3.json" : payload === "ejemplo-v3" ? "/experimentos/arena-llm-v3.json" : "/experimentos/arena-llm-v1.json", { signal: controlador.signal });
        if (!archivo.ok) throw new Error("ejemplo");
        cuerpo = { accion: "reproducir", registro: await archivo.json() as unknown };
      }
      const respuesta = await fetch("/api/arena", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo), signal: controlador.signal });
      if (!respuesta.ok) throw new Error("respuesta");
      const siguiente = await respuesta.json() as RegistroArena;
      if (solicitud.current !== controlador) return;
      setRegistro(siguiente); setTiempo(0); cursor.current = 0;
      setArchivoActual(payload === "duelo" || payload === "ejemplo-v3" || payload === "ejemplo" ? payload : null);
      setComentarios([]); setIntervenciones([]);
      setSeleccionado(null); setCargaId(c => c + 1);
      setImportado((cuerpo as { accion: string }).accion === "reproducir");
      setOrigenTorneo(origen);
    } catch (fallo) {
      if (!controlador.signal.aborted && solicitud.current === controlador && esPeticionTorneo(payload)) setErrorTorneo(fallo instanceof SinDescompresion ? "descompresion" : "abrir");
      else if (!controlador.signal.aborted && solicitud.current === controlador) setError(t("Could not validate or run this experiment. Your previous run is still available.", "No se pudo validar o ejecutar el experimento. El anterior sigue disponible."));
    } finally {
      if (solicitud.current === controlador) { solicitud.current = null; setPendiente(false); }
    }
  };
  const simular = (ev: FormEvent) => {
    ev.preventDefault(); if (bloqueado || vista !== "guardados") return;
    if (seed !== "" && (!/^\d+$/.test(seed) || Number(seed) > 4294967295)) { setError(t("Enter a whole seed from 0 to 4294967295.", "Escribe una semilla entera entre 0 y 4294967295.")); return; }
    void ejecutar({ accion: "simular", seed: seed === "" ? crypto.getRandomValues(new Uint32Array(1))[0] : Number(seed), segundos, local, visita, entorno: entornoElegido });
  };
  const cargar = async (archivo: File | undefined) => {
    if (!archivo || bloqueado) return;
    setOrigenTorneo(null);
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
  // Brief 050: la celebración se deriva del cursor visible, igual que el marcador.
  const gol = golEnCelebracion(registro, tiempo / ARENA.pasoS);
  // Brief 057 § 4.2 · Reconstrucción visual del gol (vuelo previo y balón en la red), derivada del cursor y
  // fuera de estadoVisual (la firma de voz del búfer no cambia). Con ella, los 22 y el árbitro del fotograma previo.
  const escena = reconstruccionGol(registro, tiempo, reducido);
  const jugadoresVista = escena?.congelado?.jugadores ?? estado.jugadores, arbitroVista = escena?.congelado ? escena.congelado.arbitro : estado.arbitro;
  const balonVista = escena?.balon ?? estado.balon.posicion;
  const ronda = rondaVisible(registro, tiempo / ARENA.pasoS);
  const eventos = registro.eventos.filter(e => reducido ? e.tick <= estado.tick : e.tick * ARENA.pasoS <= tiempo + Number.EPSILON * ARENA.duracionMaxS);
  const decisiones = ronda ? Object.values(ronda.decisiones) : [];
  const tieneLlm = decisiones.some(d => d.tipo === "llm");
  const nombres = registro.config.partido;
  // Brief 055 (v1.1 § 12) · Identidad de los dos clubes, una vez por par de nombres; los hijos la reciben.
  const identidad = useMemo(() => identidadPartido(nombres.local.nombre, nombres.visita.nombre), [nombres.local.nombre, nombres.visita.nombre]);
  const plantillaCompleta = [...estado.jugadores, ...estado.banco ?? [], ...estado.retirados ?? [], ...estado.expulsados ?? []];
  const jugadorActivo = plantillaCompleta.find(j => j.id === seleccionado) ?? estado.jugadores.find(j => j.lado === "local" && j.capitan) ?? estado.jugadores[0]!;
  const fase = estadoVoz.fase;
  // § 3.1 · Con pista (sonando/pausada) saltar busca en el audio: el cursor queda en el tick que la pista mapea.
  const saltar = (s: number) => { if (enDirecto || bufferActivo) return; if (fasePista(fase)) { controlesVoz.current?.buscar(s / ARENA.pasoS); return; } setReproduciendo(false); setTiempo(s); cursor.current = s; };
  const vozVisible = estadoVoz.vozDisponible && !enDirecto && !bufferActivo, vozActiva = vozVisible && conVoz;
  /** v1.1 § 1 · Aplica la transición pura del reloj: primero la exclusión (cancha muda), después la orden a la pista. */
  const aplicar = (accion: AccionReloj, desdeTick?: number) => {
    const actual: DuenoReloj = reproduciendo ? "mudo" : dueno.current === "mudo" ? null : dueno.current;
    const r = transicionReloj(actual, accion, fase);
    dueno.current = r.dueno; setReproduciendo(r.reproduciendo);
    // v1.3 (3) · La pista arranca en el cursor (en el final, desde 0).
    if (r.orden === "iniciar") controlesVoz.current?.iniciar(desdeTick);
    else if (r.orden) controlesVoz.current?.[r.orden]();
    return r;
  };
  const pulsarReproducir = () => {
    setAviso(null);
    const r = transicionReloj(reproduciendo ? "mudo" : dueno.current === "mudo" ? null : dueno.current, { tipo: "pulsar", conVoz: vozActiva }, fase);
    const alFinal = tiempo >= finS;
    if (alFinal && (r.orden === "iniciar" || r.reproduciendo)) { setTiempo(0); cursor.current = 0; }
    aplicar({ tipo: "pulsar", conVoz: vozActiva }, alFinal ? 0 : tiempo / ARENA.pasoS);
  };
  // v1.1 § 1 (c) · Un efecto único (de layout: antes del siguiente fotograma) reacciona a la fase de la pista:
  // activa → la cancha muda se apaga; error → degradación muda solo si la voz era la dueña; fin → sin dueño.
  useLayoutEffect(() => {
    if (faseActiva(fase)) aplicar({ tipo: "pista-activa" });
    else if (fase === "error") { const r = aplicar({ tipo: "fallo" }); if (r.reproduciendo && estadoVoz.motivo) setAviso({ motivo: estadoVoz.motivo, minutos: estadoVoz.minutos }); }
    else aplicar({ tipo: "fin" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);
  // El conmutador arranca marcado la primera vez que hay voz; no se persiste (§ 11).
  useEffect(() => { if (estadoVoz.vozDisponible && !conVozIniciado.current) { conVozIniciado.current = true; setConVoz(true); } }, [estadoVoz.vozDisponible]);
  useEffect(() => { setAviso(null); }, [cargaId]);
  // Brief 049 · Cifras del prefijo ≤ tick entero del cursor: una agregación por (registro, tick),
  // compartida por el panel y la ficha (memoAgregado guarda la última).
  const tickCifras = Math.floor(tiempo / ARENA.pasoS + 1e-9);
  useMemo(() => memoAgregado(registro, tickCifras), [registro, tickCifras]);
  // Brief 056 § 5.5 · Previa derivada del registro (config + inicial); un registro inconsistente no rompe la página.
  const previaCarta = useMemo(() => { try { return previaVisual(registro); } catch { return null; } }, [registro.config, registro.inicial]);
  const previaVisible = tickCifras === 0 && previaCarta !== null;
  // Brief 056 § 5.5 · Las tres piezas habladas, derivadas del registro y fusionadas con el diario (una sola fusión).
  const previa = useMemo(() => { try { return previaPartido(registro); } catch { return []; } }, [registro.config, registro.inicial]);
  const mesa = useMemo(() => [...previa, ...intervenciones], [previa, intervenciones]);
  useEffect(() => { setPlegada(false); }, [cargaId]);
  useEffect(() => { if (tickCifras > 0) setPlegada(false); }, [tickCifras > 0]);
  const presentes = useMemo(() => favoritos.hidratado ? favoritosEn(registro, favoritos.valor) : { lado: null, jugador: null }, [registro, favoritos]);
  const cambiarFavoritos = (valor: FavoritosArena) => { if (!favoritos.hidratado) return; const ok = guardarFavoritos(almacenFavoritos(), valor); setFavoritos({ valor, error: !ok, hidratado: true }); };
  const estrellaClub = (lado: "local" | "visita") => <EstrellaFavorito activo={presentes.lado === lado} nombre={nombres[lado].nombre} tipo="club" idioma={idioma} testId="arena-favorite-club" lado={lado} alternar={() => cambiarFavoritos(alternarClub(favoritos.valor, nombres[lado].nombre))} />;
  return <>
    <header className="topbar arena-topbar">
      <Link href="/" className="brand" prefetch={false}><EmblemaCronista /><span className="brand-mark">CRONISTA</span><span className="brand-tag">{t("Team agents lab", "Laboratorio de equipos")}</span></Link>
      <nav className="topbar-links" aria-label={t("Sections", "Secciones")}><Link href="/" prefetch={false}>{t("Match reports", "Crónicas")}</Link><Link href={`/arena/torneo${es ? "?lang=es" : ""}`} prefetch={false}>{t("Tournament", "Torneo")}</Link><button className="btn" onClick={() => setIdioma(es ? "en" : "es")} aria-label={t("Switch to Spanish", "Cambiar a inglés")}>{es ? "EN" : "ES"}</button></nav>
    </header>
    <main className="arena-shell" lang={idioma} data-testid="arena" style={identidad.variables as CSSProperties}>
      <div className="arena-intro"><p className="overline">{t("Experimental · simulated football", "Experimental · fútbol simulado")}</p>
        <h1>{t("Two teams. One shared pitch.", "Dos equipos. Una misma cancha.")}</h1>
        <p>{t("Each controller tries to win: create goals, defend its own goal and adapt to the opponent. One shared engine resolves movement, the ball and the outcome.", "Cada controlador intenta ganar: crear goles, defender su portería y adaptarse al rival. Un motor compartido resuelve movimientos, balón y resultados.")}</p>
        <a className="arena-intro-cta" href="#arena-control">{t("Set up or choose a match", "Configurar o elegir un partido")}</a>
        {origenTorneo && <p className="arena-torneo-origen" data-testid="arena-torneo-origen">{t(`Match ${origenTorneo.n} of the ${fechaTorneo(origenTorneo.inicioUtc, idioma)} tournament`, `Partido ${origenTorneo.n} del torneo del ${fechaTorneo(origenTorneo.inicioUtc, idioma)}`)} · {t("Home", "Local")}: {origenTorneo.local.club} ({origenTorneo.local.modelo}) · {t("Away", "Visita")}: {origenTorneo.visita.club} ({origenTorneo.visita.modelo}) · <Link href={`/arena/torneo/${origenTorneo.id}${es ? "?lang=es" : ""}`} prefetch={false}>{t("Back to the tournament", "Volver al torneo")}</Link></p>}
      </div>
      {pendiente && <div className="arena-notice" role="status"><IndicadorCarga />{t("Resolving orders and validating the sequence…", "Resolviendo órdenes y validando la secuencia…")}<button className="btn" onClick={cancelar}>{t("Cancel", "Cancelar")}</button></div>}
      {errorTorneo && <div className="arena-notice" role="alert" data-testid="arena-torneo-error">{errorTorneo === "descompresion" ? t("This browser cannot open the compressed record. The previous one is still available.", "Este navegador no puede abrir el registro comprimido. El anterior sigue disponible.") : t("Could not open this tournament match. The previous one is still available.", "No se pudo abrir este partido del torneo. El anterior sigue disponible.")}<button className="btn" onClick={() => void ejecutar(ultimaPeticion.current)} disabled={bloqueado}>{t("Retry", "Reintentar")}</button></div>}
      {error && <div className="arena-notice" role="alert">{error}{ultimaPeticion.current !== null && <button className="btn" onClick={() => void ejecutar(ultimaPeticion.current)} disabled={bloqueado}>{t("Retry", "Reintentar")}</button>}</div>}
      <div className="arena-grid" id="arena-watch">
        <section className="arena-board" aria-label={t("Simulated pitch", "Cancha simulada")}>
          {registro === inicial && !sesionActual && !enDirecto && <p className="arena-muted arena-empty">{t("Saved preview. Start a live match above or choose a recording.", "Vista previa guardada. Inicia un partido en vivo arriba o elige una grabación.")}</p>}
          <ArenaMarcador registro={registro} estado={estado} gol={gol} favorito={presentes.lado} estrella={estrellaClub} identidad={identidad} />
          <div className="arena-match-clock" data-en-vivo={enDirecto || bufferActivo || undefined}><output className="tnum" data-testid="arena-clock">{reloj(tiempo)} / {reloj(enDirecto ? registro.config.duracionS : finS)}</output></div>
          <div className="arena-pitch-wrap"><ArenaRotuloGol registro={registro} gol={gol} idioma={idioma} identidad={identidad} /><svg viewBox="-5 -5 115 78" role="group" aria-label={estado.arbitro ? t("22 simulated players, a referee and the ball; home attacks right", "22 jugadores simulados, un árbitro y el balón; el local ataca hacia la derecha") : t("22 simulated players and the ball; home attacks right", "22 jugadores simulados y el balón; el local ataca hacia la derecha")} data-testid="arena-pitch">
            <rect className="arena-runoff" x="-5" y="-5" width="115" height="78" rx="1.5" aria-hidden="true" />
            <rect className="arena-grass" x="0" y="0" width="105" height="68" />
            <g className="arena-stripes" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map(i => <rect key={i} className="arena-stripe" y="0" width="8.75" height="68" x={i * 17.5 + 8.75} />)}</g>
            <g className="arena-lines" aria-hidden="true"><path d="M52.5 0v68" /><circle cx="52.5" cy="34" r="9.15" /><rect x="0" y="13.84" width="16.5" height="40.32" /><rect x="88.5" y="13.84" width="16.5" height="40.32" /><rect x="0" y="24.84" width="5.5" height="18.32" /><rect x="99.5" y="24.84" width="5.5" height="18.32" /><path className="arena-goal" d="M0 30.34h-2v7.32h2 M105 30.34h2v7.32h-2" />
              <circle cx="52.5" cy="34" r="0.35" className="arena-spot" /><circle cx="11" cy="34" r="0.35" className="arena-spot" /><circle cx="94" cy="34" r="0.35" className="arena-spot" />
              <path d="M16.5 26.69 A9.15 9.15 0 0 1 16.5 41.31" /><path d="M88.5 26.69 A9.15 9.15 0 0 0 88.5 41.31" />
              <path d="M1 0 A1 1 0 0 1 0 1 M105 1 A1 1 0 0 1 104 0 M104 68 A1 1 0 0 1 105 67 M0 67 A1 1 0 0 1 1 68" /></g>
            {jugadoresVista.map(j => <g key={j.id} data-testid="arena-player" data-player={j.id} data-captain={j.capitan || undefined} data-favorite={presentes.jugador === j.id || undefined} data-gol={gol?.jugador === j.id || undefined} transform={`translate(${j.posicion.x} ${j.posicion.y})`} className={`arena-player arena-${j.lado}${jugadorActivo.id === j.id ? " arena-player-selected" : ""}`} role="button" tabIndex={0} aria-pressed={jugadorActivo.id === j.id} aria-label={`${j.nombre} · ${j.dorsal} · ${j.puesto}${j.capitan ? ` · ${t("Captain", "Capitán")}` : ""}${j.personalidad ? ` · ${etiquetasPerfil[j.personalidad.perfil][idioma]}` : ""}`} onClick={() => setSeleccionado(j.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSeleccionado(j.id); } }}>
              <title>{`${j.nombre} · ${j.dorsal} · ${j.puesto}${j.capitan ? " · C" : ""}`}</title><g className="arena-token"><circle className="arena-kit" r="1.9" /><text textAnchor="middle" dominantBaseline="central">{j.dorsal}</text>
              {/* Brief 055 (v1.1 §§ 2–3): anillos propios tras el dorsal; sólido = selección, punteado = favorito. */}
              {jugadorActivo.id === j.id && <circle className="arena-select-ring" r="2.6" aria-hidden="true" />}
              {presentes.jugador === j.id && <circle className="arena-fav-ring" r="3.05" aria-hidden="true" />}
              {j.capitan && <g className="arena-captain-mark" aria-hidden="true"><rect x="1.4" y="-3.3" width="2.5" height="2.5" rx="0.4" /><text x="2.65" y="-2" textAnchor="middle" dominantBaseline="central">C</text></g>}
              {!!j.amarillas && <rect className="arena-yellow-card" x="-3.5" y="-3" width="1.3" height="2" aria-hidden="true" />}
              {/* Brief 050 (P2): anillo del goleador, último hijo de la ficha y solo durante la celebración. */}
              {gol?.jugador === j.id && <circle className="arena-goal-ring" r="3.2" aria-hidden="true" />}</g>
            </g>)}
            {estado.arbitro && arbitroVista && <g className="arena-referee" data-testid="arena-referee" transform={`translate(${arbitroVista.posicion.x} ${arbitroVista.posicion.y})`} role="img" aria-label={`${t("Referee", "Árbitro")}: ${estado.arbitro.nombre}`}>
              <title>{`${t("Referee", "Árbitro")}: ${estado.arbitro.nombre}`}</title><rect x="-2.2" y="-2.2" width="4.4" height="4.4" rx="0.5" /><text textAnchor="middle" dominantBaseline="central">{es ? "A" : "R"}</text>
              {estado.arbitro.ultimaDecision && estado.tick - estado.arbitro.ultimaDecision.tick < 3 / ARENA.pasoS && estado.arbitro.ultimaDecision.tipo !== "falta" && <rect className={`arena-referee-card arena-card-${estado.arbitro.ultimaDecision.tipo}`} x="2.7" y="-4" width="1.8" height="2.8" />}
            </g>}
            <circle className="arena-ball" cx={balonVista.x} cy={balonVista.y} r="0.95" data-testid="arena-ball" data-reconstruccion={escena?.fase} />
          </svg>{/* Brief 057 § 5.2 · Vista frontal del arco batido mientras dura la celebración. */}<ArenaVistaArco registro={registro} gol={gol} tick={tiempo / ARENA.pasoS} idioma={idioma} identidad={identidad} reducido={reducido} /></div>
          <div className="arena-direction"><span>● {t("Home →", "Local →")}</span><span>{t("← Away", "← Visitante")} ○</span>{identidad.kits.visitaAlternativa && <span className="arena-kit-note">{t(`${nombres.visita.nombre} wears its change kit`, `${nombres.visita.nombre} viste su segunda equipación`)}</span>}</div>
          {previaVisible && <ArenaPrevia previa={previaCarta} identidad={identidad} idioma={idioma} plegada={plegada} alternar={() => setPlegada(p => !p)} seleccionado={seleccionado} seleccionar={setSeleccionado} />}
          {enDirecto && <p className="arena-muted" data-testid="arena-pitch-live-status">{bufferActivo ? t("The match is generating ahead of the broadcast.", "El partido se genera por delante de la emisión.") : preparandoPartido ? t("Preparing the complete match…", "Preparando el partido completo…") : estadoDirecto === "esperando" ? t("Coaches are deciding · simulation clock paused", "Los entrenadores están decidiendo · reloj simulado detenido") : estadoDirecto === "jugando" ? t("Live play · confirmed engine state", "Juego en vivo · estado confirmado por el motor") : t("Play finished · completing commentary", "Juego terminado · completando comentario")}</p>}
          {estado.saque && estado.pausa && estado.tick < estado.saque.hastaTick && escena?.fase !== "red" && <p role="status" data-testid="arena-restart">{({ centro: t("Kick-off", "Saque de centro"), banda: t("Throw-in", "Saque de banda"), esquina: t("Corner kick", "Saque de esquina"), meta: t("Goal kick", "Saque de meta") })[estado.saque.tipo]} · <Escudo identidad={identidad[estado.saque.lado]} size={IDENTIDAD_ARENA.escudoPx.reanudacion} />{registro.config.partido[estado.saque.lado].nombre}</p>}
          {estado.arbitro && <div className="arena-referee-info"><span className="arena-referee-swatch" aria-hidden="true" /><div><strong>{t("Referee", "Árbitro")}: {estado.arbitro.nombre}</strong><p>{estado.entrenadores ? t(`Contact criterion ${estado.arbitro.criterioContacto}/100. Calls synthetic contact fouls and cards; each restart appears in the description.`, `Criterio de contacto ${estado.arbitro.criterioContacto}/100. Sanciona contactos sintéticos con faltas y tarjetas; consulta cada reanudación en la descripción.`) : t("Follows play with its own movement. Visual official; fouls and cards are not simulated yet.", "Sigue la jugada con movimiento propio. Árbitro visual; todavía no se simulan faltas ni tarjetas.")}</p></div></div>}
          {!bufferActivo && <><div className="arena-playback"><button className="btn btn-primary" onClick={pulsarReproducir} aria-pressed={reproduciendo || fase === "sonando"} disabled={bloqueado}>{reproduciendo || fase === "sonando" ? t("Pause", "Pausar") : faseEspera(fase) ? t("Play without narration", "Reproducir sin narración") : t("Play", "Reproducir")}</button>
            {faseEspera(fase) && <span className="arena-play-progress" data-testid="arena-play-progress" aria-hidden="true">{fase === "registrando" ? t("Registering the recording…", "Registrando la grabación…") : t(`Preparing narration ${estadoVoz.listos}/${estadoVoz.total}`, `Preparando narración ${estadoVoz.listos}/${estadoVoz.total}`)}</span>}
            <button className="btn" onClick={() => fasePista(fase) ? controlesVoz.current?.buscar(0) : saltar(0)} disabled={enDirecto || faseEspera(fase)}>{t("Restart", "Volver al inicio")}</button>
            <label>{t("Speed", "Velocidad")}<select className="field" value={faseActiva(fase) ? 1 : velocidad} disabled={faseActiva(fase)} onChange={e => setVelocidad(Number(e.target.value))}><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
            {vozVisible && <label className="arena-with-voice"><input type="checkbox" data-testid="arena-play-voice" checked={conVoz} onChange={e => { const marcado = e.target.checked; setConVoz(marcado); if (!marcado) aplicar({ tipo: "conmutador-off" }); }} />{t("With narration", "Con narración")}</label>}
          </div>
          <input className="arena-seek" type="range" min="0" max={finS} disabled={enDirecto || faseEspera(fase)} step="0.1" value={tiempo} onChange={e => saltar(Number(e.target.value))} aria-label={t("Match time", "Tiempo de juego")} />
          {aviso && <p role="status" className="arena-muted" data-testid="arena-play-fallback">{aviso.motivo === "ocupado"
            ? t(`Too many uploaded recordings; narration returns in ${aviso.minutos ?? 1} min. Playing without voice.`, `Demasiadas grabaciones subidas; la narración vuelve en ${aviso.minutos ?? 1} min. Reproduciendo sin voz.`)
            : t(`Narration unavailable (${MOTIVOS_NARRACION[aviso.motivo].en}); playing without voice.`, `Narración no disponible (${MOTIVOS_NARRACION[aviso.motivo].es}); reproduciendo sin voz.`)}</p>}
          </>}
          <p className="arena-muted">{bufferActivo ? t("Live match at normal speed.", "Partido en vivo a velocidad normal.") : t("Continuous simulated movement; explicit ball cuts at simplified restarts. Playback starts paused.", "Movimiento continuo simulado; el balón se recoloca en reinicios simplificados. La reproducción empieza pausada.")}{reducido && t(" Reduced motion: discrete states.", " Movimiento reducido: estados discretos.")}{t(" After a goal the ball is drawn reaching the net and going in at the recorded crossing point, and the players hold still for a moment before returning to the centre: a visual reconstruction; the record places the kick-off at the goal tick.", " Tras un gol, el balón se dibuja llegando a la red y entrando en ella en el punto de cruce registrado, y los jugadores quedan quietos un instante antes de volver al centro: es una reconstrucción visual; el registro sitúa el saque en el mismo tick del gol.")}{vozActiva && t(" With narration, the audio sets the pace: speed is 1× and the slider seeks in the voice.", " Con narración, el audio marca el ritmo: la velocidad es 1× y el deslizador busca en la voz.")}</p>
          <ArenaCifras registro={registro} tick={tickCifras} idioma={idioma} favorito={presentes.lado} identidad={identidad} />
        </section>
        <aside className="arena-companion" aria-label={t("Narration and commentary", "Narración y comentarios")} data-testid="arena-companion">
          {/* Brief 055 § 4.1 · Sala de control: pestañas, configuración y panel en vivo, sin cambios internos,
              como primer hijo del acompañante (el tablero queda primero bajo la cabecera). */}
          <div className="arena-control-room" id="arena-control" tabIndex={-1}>
          <div className="arena-source-tabs" role="group" aria-label={t("Choose a match", "Elegir partido")}>
            <button className="btn" aria-pressed={vista === "live"} disabled={bloqueado} onClick={() => { setVista("live"); setConfigurando(true); }}>{t("Live", "En vivo")}</button>
            <button className="btn" aria-pressed={vista === "guardados"} disabled={bloqueado} onClick={() => { setVista("guardados"); setConfigurando(true); }}>{t("Saved matches", "Partidos guardados")}</button>
            <a href="#arena-watch">{t("Go to the pitch and narration", "Ir a la cancha y narración")}</a>
          </div>
          <details className="arena-setup" open={configurando} onToggle={e => setConfigurando(e.currentTarget.open)}>
            <summary>{vista === "live" ? t("Set up your live match", "Configura tu partido en vivo") : t("Choose a saved match or create a recording", "Elige un partido guardado o crea una grabación")}</summary>
            <p className="arena-muted">{t("Choose the starting shape for each team. By default, each coach selects and adapts its formation during play. Every new match generates different teams and conditions.", "Elige la formación inicial de cada equipo. Por defecto, cada entrenador la elige y adapta durante el juego. Cada nuevo partido genera equipos y condiciones diferentes.")}</p>
          <form className="arena-settings" onSubmit={simular} aria-busy={pendiente}>
            <label>{t("Home formation", "Formación local")}<select className="field" value={local} disabled={ajustesBloqueados} onChange={e => setLocal(e.target.value as FormacionArena | "auto")}><option value="auto">{t("Coach decides", "Decide el entrenador")}</option>{formaciones.map(f => <option key={f}>{f}</option>)}</select></label>
            <label>{t("Away formation", "Formación visitante")}<select className="field" value={visita} disabled={ajustesBloqueados} onChange={e => setVisita(e.target.value as FormacionArena | "auto")}><option value="auto">{t("Coach decides", "Decide el entrenador")}</option>{formaciones.map(f => <option key={f}>{f}</option>)}</select></label>
            <label>{t("Simulated duration", "Duración simulada")}<select className="field" value={segundos} disabled={ajustesBloqueados} onChange={e => setSegundos(Number(e.target.value))}><option value="30">30 s</option><option value="60">60 s</option><option value="180">180 s</option></select></label>
            {vista === "guardados" && <button className="btn" disabled={bloqueado}>{t("Create recording without AI", "Crear grabación sin IA")}</button>}
            <details className="arena-settings-more"><summary>{t("Choose weather, pitch and crowd pressure", "Elegir clima, cancha y presión del público")}</summary><div className="arena-environment-settings">
              <label>{t("Weather", "Clima")}<select className="field" value={clima} disabled={ajustesBloqueados} onChange={e => { const c = e.target.value as typeof clima; setClima(c); if (c === "calor" || c === "frio") setTemperatura(String(ARENA.temperaturaDefectoC[c])); }}><option value="auto">{t("Generated", "Generado")}</option>{CLIMAS_PARTIDO.map(c => <option key={c} value={c}>{({ despejado: t("Clear", "Despejado"), calor: t("Heat", "Calor"), lluvia: t("Rain", "Lluvia"), frio: t("Cold", "Frío"), niebla: t("Fog", "Niebla") })[c]}</option>)}</select></label>
              {(clima === "calor" || clima === "frio") && <label>{t("Temperature °C", "Temperatura °C")}<input className="field" type="number" required min={TEMPERATURA_C[clima].min} max={TEMPERATURA_C[clima].max} value={temperatura} disabled={ajustesBloqueados} onChange={e => setTemperatura(e.target.value)} /></label>}
              <label>{t("Surface", "Superficie")}<select className="field" value={superficie} disabled={ajustesBloqueados} onChange={e => setSuperficie(e.target.value as typeof superficie)}><option value="auto">{t("Home ground", "Cancha del local")}</option><option value="natural">{t("Natural", "Natural")}</option><option value="sintetica">{t("Artificial", "Sintética")}</option></select></label>
              {superficie === "natural" && <label>{t("Grass", "Césped")}<select className="field" value={cesped} disabled={ajustesBloqueados} onChange={e => setCesped(e.target.value as typeof cesped)}><option value="corto">{t("Short", "Corto")}</option><option value="alto">{t("Long", "Alto")}</option></select></label>}
              <label>{t("Crowd pressure: home / away", "Presión del público: local / visita")}<select className="field" value={presion} disabled={ajustesBloqueados} onChange={e => setPresion(e.target.value as typeof presion)}><option value="auto">{t("Generated", "Generada")}</option><option value="baja">{t("Low / medium", "Baja / media")}</option><option value="media">{t("Medium / high", "Media / alta")}</option></select></label>
            </div></details>
            <details className="arena-settings-more"><summary>{t("Reproduce a specific match (advanced)", "Repetir un partido específico (avanzado)")}</summary>
              <label>{t("Match seed (optional)", "Semilla del partido (opcional)")}<input className="field" value={seed} onChange={e => setSeed(e.target.value)} inputMode="numeric" pattern="[0-9]*" disabled={ajustesBloqueados} placeholder={t("Random", "Aleatoria")} aria-describedby="arena-seed-help" /></label>
              <p id="arena-seed-help" className="arena-muted">{t("A seed is a number used to generate teams, coaches and starting conditions. Leave it blank for a new draw. Reusing it with the same settings repeats the initial setup; AI decisions can vary. Example: 42.", "La semilla es un número que genera equipos, entrenadores y condiciones iniciales. Déjala vacía para un nuevo sorteo. Reutilizarla con los mismos ajustes repite la configuración inicial; las decisiones de IA pueden variar. Ejemplo: 42.")}</p>
              {seed !== "" && (!/^\d+$/.test(seed) || Number(seed) > 4294967295) && <p role="alert">{t("Enter a whole number between 0 and 4294967295, or leave it blank.", "Escribe un entero entre 0 y 4294967295 o déjala vacía.")}</p>}
            </details>
          </form>
          <div className="arena-tools" hidden={vista !== "guardados"}>
            <button className="btn btn-primary" onClick={() => void ejecutar("duelo")} disabled={bloqueado}>{t("Load recorded model duel", "Cargar duelo de modelos grabado")}</button>
            <button className="btn btn-primary" onClick={() => void ejecutar("ejemplo-v3")} disabled={bloqueado}>{t("Load AI coaches example", "Cargar ejemplo de entrenadores IA")}</button>
            <button className="btn" onClick={() => void ejecutar("ejemplo")} disabled={bloqueado}>{t("Load recorded AI run", "Cargar ejemplo de IA grabado")}</button>
            <label className="btn arena-file">{t("Open saved run", "Abrir registro guardado")}<input type="file" accept="application/json,.json" disabled={bloqueado} aria-label={t("Open saved run", "Abrir registro guardado")} onChange={e => { void cargar(e.target.files?.[0]); e.target.value = ""; }} /></label>
            <button className="btn" onClick={descargar} disabled={bloqueado || (registro.final.tick * ARENA.pasoS < registro.config.duracionS && !registro.final.finalizado)}>{t("Download run", "Descargar registro")}</button>
            <span className="arena-muted">{t("Programmed and recorded runs make no AI calls. Live model runs use the chosen controllers.", "Las ejecuciones programadas y grabadas no llaman a IA. Los partidos en vivo con modelos usan los controladores elegidos.")}</span>
          </div>
          </details>
          <ArenaEnDirecto ajustes={{ seed: seed === "" ? undefined : Number(seed), segundos, local, visita, entorno: entornoElegido }} presentacionVista={vista === "live" ? "buffer" : "preparada"} idioma={idioma} ocupado={pendiente || (seed !== "" && (!/^\d+$/.test(seed) || Number(seed) > 4294967295))} alMensaje={recibirDirecto} alActividad={actividadDirecto} alPreparado={recibirPreparado} />
          </div>
          {bufferActivo && sesionActual && <ArenaEmisionBuffer key={sesionActual} registro={registro} sesion={sesionActual} hastaTick={registro.final.tick} terminada={bufferTerminada} inicioTick={bufferInicioTick} idioma={idioma} intervenciones={mesa} alTiempo={tick => { setTiempo(tick * ARENA.pasoS); cursor.current = tick * ARENA.pasoS; }} alRepeticion={() => { setBufferActivo(false); setTiempo(0); cursor.current = 0; }} />}
          {!bufferActivo && <ArenaNarracion alActividadAudio={setAudioActivo} registro={registro} carga={cargaId} alEstado={setEstadoVoz} alControles={alControles} sinPartido={registro === inicial && !sesionActual && !enDirecto} seed={registro.config.partido.seed} sesion={sesionActual} archivo={archivoActual} alRegistrar={setSesionActual} hastaTick={registro.final.tick} enDirecto={enDirecto} idioma={idioma} intervenciones={mesa} seleccionarTiempo={tick => { setReproduciendo(false); setTiempo(tick * ARENA.pasoS); cursor.current = tick * ARENA.pasoS; }} />}
          <ArenaMesa comentarios={comentarios} intervenciones={mesa} tick={Math.floor(tiempo / ARENA.pasoS + 1e-9)} idioma={idioma} />
          {/* Brief 053 v1.1 § 4 · Corte en el cursor visible (tickCifras) en todas las vistas. */}
          <ArenaDescargas registro={registro} comentarios={comentarios} intervenciones={mesa} sesion={sesionActual} hastaTick={tickCifras} enCurso={enDirecto || bufferActivo} idioma={idioma} sinPartido={registro === inicial && !sesionActual && !enDirecto} />
          <section className="arena-live-feed" aria-label={t("Live text narration", "Narración de texto en vivo")} data-testid="arena-live-text">
            <h2>{t("Latest actions", "Últimas acciones")}</h2>
            <a href="#arena-description">{t(`Complete description · ${eventos.length} actions`, `Descripción completa · ${eventos.length} acciones`)}</a>
            <p className="arena-muted">{t("Confirmed actions, synchronized with the pitch. Text is available with audio off.", "Acciones confirmadas, sincronizadas con la cancha. Puedes leerlas con el audio apagado.")}</p>
            {presentes.jugador && <label className="arena-only-favourite"><input type="checkbox" checked={soloFavorito} onChange={e => setSoloFavorito(e.target.checked)} data-testid="arena-only-favourite" />{t("Only my player (and goals)", "Solo mi jugador (y los goles)")}</label>}
            {!eventos.length ? <p className="arena-empty">{t("Waiting for kick-off. Start a live match or play a saved match.", "Esperando el inicio. Inicia un partido en vivo o reproduce uno guardado.")}</p> : <ol>{(soloFavorito && presentes.jugador ? eventos.filter(e => e.jugador === presentes.jugador || e.receptor === presentes.jugador || e.sale === presentes.jugador || e.tipo === "gol") : eventos).slice(-5).reverse().map(e => <li key={e.id} data-event-tick={e.tick}><time>{reloj(e.tick * ARENA.pasoS)}</time><IconoEventoArena evento={e} /><span>{narrarEventoArena(e, registro, idioma)}</span></li>)}</ol>}
          </section>
          <ArenaInteligencia key={`${cargaId}-${modoInicial}`} modoInicial={modoInicial} registro={registro} estado={estado} idioma={idioma} jugador={jugadorActivo.id} />
        </aside>
      </div>
      <details className="arena-plans"><summary>{t("Team plans and player orders", "Planes de equipo y órdenes individuales")}</summary>
        <aside className="arena-decisions" aria-label={t("Team decisions", "Decisiones de los equipos")}>
          {!ronda ? <p role="status" className="arena-empty">{t("Waiting for the first plans…", "Esperando los primeros planes…")}</p> : <>
          <p className="overline">{t("Decision window", "Intervalo de decisión")} {reloj(ronda.inicioTick * ARENA.pasoS)}–{reloj(ronda.finTick * ARENA.pasoS)}</p>
          {(["local", "visita"] as const).map(lado => {
            const d = ronda.decisiones[lado];
            const propio = estado.jugadores.find(j => j.id === estado.balon.poseedor)?.lado ?? estado.balon.vuelo?.lado;
            const formacion = estado.entrenadores?.[lado].formacion ?? registro.config.formaciones[lado];
            return <section className="arena-team-plan" key={lado}><h2><Escudo identidad={identidad[lado]} size={IDENTIDAD_ARENA.escudoPx.plan} />{nombres[lado].nombre}</h2>
              <p className="arena-shape">{formacion} → {estructura(formacion, propio === lado, estado.jugadores.filter(j => j.lado === lado).map(j => j.puesto))}</p>
              <p className="arena-muted arena-controller">{d.tipo === "llm" ? "LLM" : t("Programmed", "Programado")} · {d.controlador}</p>
              <p>{!es && (d.tipo === "programado" || d.origen === "respaldo") ? d.ordenes.intencion.startsWith("Progresar") ? "Progress with staggered support and keep cover behind the ball." : "Send one player towards the ball, provide cover and keep the block connected." : d.ordenes.intencion}</p>
              <p className="arena-muted">{t("Width", "Amplitud")}: {es ? d.ordenes.amplitud : ({ estrecha: "narrow", media: "medium", amplia: "wide" })[d.ordenes.amplitud]} · {t("Block", "Bloque")}: {es ? d.ordenes.bloque : ({ bajo: "low", medio: "mid", alto: "high" })[d.ordenes.bloque]}</p>
              {d.origen === "respaldo" && <p className="arena-fallback">{t("Programmed fallback", "Respaldo programado")}: {d.motivo}</p>}
              <details><summary>{t(`${d.ordenes.ordenes.length} player orders`, `${d.ordenes.ordenes.length} órdenes individuales`)}</summary><ol>{d.ordenes.ordenes.map(o => {
                const j = plantillaCompleta.find(j => j.id === o.jugador)!;
                return <li key={o.jugador}><strong>{j.dorsal} · {j.nombre}</strong><span>{j.puesto} · {o.accion} → ({Math.round(o.destino.x)}, {Math.round(o.destino.y)}) m</span></li>;
              })}</ol></details>
            </section>;
          })}
          <p className="arena-muted">{importado ? t("Imported recording: the server recomputed and checked its sequence. Controller identity is supplied by the file, not independently authenticated.", "Registro importado: el servidor recalculó y comprobó su secuencia. La identidad del controlador procede del archivo y no está autenticada de forma independiente.") : t("Both teams received the same state before their new orders were resolved.", "Ambos equipos recibieron el mismo estado antes de resolver sus nuevas órdenes.")}</p>
          {tieneLlm && !enDirecto && <p className="arena-muted">{t("Archived model decisions; playback makes no new AI calls.", "Decisiones archivadas de modelos; reproducir no vuelve a llamar a IA.")}</p>}
          {!!decisiones.length && decisiones.every(d => d.tipo === "llm") && decisiones[0]!.controlador === decisiones[1]!.controlador && <p className="arena-muted">{t("Two independent controllers using the same model deployment.", "Dos controladores independientes usando el mismo deployment de modelo.")}</p>}
          </>}
        </aside>
      </details>
      <ArenaAsistente sesion={sesionActual} tick={estado.tick} jugador={jugadorActivo.id} idioma={idioma} comentarios={comentarios} />
      <ArenaContexto registro={registro} estado={estado} idioma={idioma} seleccionar={setSeleccionado} saltar={saltar} identidad={identidad} />
      <ArenaPlantilla estado={estado} registro={registro} seleccionado={seleccionado} seleccionar={setSeleccionado} idioma={idioma} tick={tickCifras} identidad={identidad}
        favorito={presentes.jugador !== null && presentes.jugador === jugadorActivo.id} alternarFavorito={j => cambiarFavoritos(alternarJugador(favoritos.valor, j))}
        avisos={favoritos.hidratado ? <AvisosFavoritos favoritos={favoritos.valor} presentes={presentes} error={favoritos.error} idioma={idioma} olvidar={que => cambiarFavoritos(que === "club" ? { ...favoritos.valor, club: null } : { ...favoritos.valor, jugador: null })} /> : null}
        transporte={!enDirecto && !bufferActivo && fase !== "preparando"} saltar={saltar} />
      <ArenaDescripcion eventos={eventos} registro={registro} idioma={idioma} saltar={saltar} />
      <details className="arena-limits"><summary>{t("Prototype scope and limitations", "Alcance y límites del prototipo")}</summary><p>{estado.entrenadores ? t("Short synthetic 2D encounters with coaches, substitutions at stoppages and simplified contact fouls/cards. New matches include simplified kick-offs, throw-ins, corner kicks and goal kicks; archives retain their original rules. No regulation penalties, injuries or change of ends. Crosses have a simplified aerial phase, with no heights or headers, contested only near the landing point; the goalkeeper cannot be challenged while holding the ball. Shots are placed inside the goal and can go over the bar with a modelled probability, with no simulated height; there are no posts or rebounds. Movement, personalities and environmental effects require calibration. This is not a full regulation match or evidence of professional tactical quality.", "Encuentros sintéticos cortos en 2D con entrenadores, sustituciones en interrupciones y faltas/tarjetas por contacto simplificadas. Los partidos nuevos incluyen saques de centro, banda, esquina y meta simplificados; los archivos conservan sus reglas originales. Sin penales reglamentarios, lesiones ni cambio de campo. Los centros tienen una fase aérea simplificada, sin alturas ni cabezazos, que solo se disputa cerca del punto de caída; el portero no puede ser disputado con el balón en las manos. El remate se coloca dentro del arco y puede irse por encima del travesaño por una probabilidad modelada, sin altura simulada; no hay palos ni rebotes. Movimiento, personalidades y efectos ambientales requieren calibración. No es un partido reglamentario completo ni evidencia de calidad táctica profesional.") : t("Archived short 2D open-play scenario. Simplified restarts; no fouls, cards, injuries, substitutions or change of ends.", "Escenario archivado corto de juego abierto 2D. Reinicios simplificados; sin faltas, tarjetas, lesiones, sustituciones ni cambio de campo.")}{t(" The ball in the net and the front view of the goal are reconstructions: the lateral position comes from the record; the height is illustrative.", " El balón en la red y la vista frontal del arco son reconstrucciones: la posición lateral viene del registro; la altura es ilustrativa.")}</p></details>
    </main>
  </>;
}
