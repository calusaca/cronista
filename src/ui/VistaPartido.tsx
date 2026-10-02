"use client";
// Vista de partido (brief 004): línea de tiempo a la izquierda, crónica a la derecha, y la
// interacción estrella en los dos sentidos — oración → eventos que la respaldan (resaltado
// persistente al clic, transitorio al pasar el mouse, scroll al primero) y evento →
// oraciones que lo citan. Las capas: Caja de cristal (006), proceso, y el gol.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Evento } from "../sim/tipos";
import { eventosDeOracion, marcadorProgresivo, oracionesDeEvento } from "../vista/evidencia";
import type { DatosPartido } from "../vista/servidor";
import { esquemaOverlay, type Overlay } from "../vivo/overlay";
import { MS_POR_MINUTO, type Velocidad } from "../vivo/umbrales";
import { HistoriaFrase, Proceso } from "./CajaDeCristal";
import { Cronica, type Lengua, type ModoRender } from "./Cronica";
import { TarjetaGol } from "./Gol";
import { Linea } from "./Linea";
import { ControlesReplay, Ticker } from "./Vivo";
import { claveValoracion, Ratings } from "./Ratings";
import { Stats } from "./Stats";
import { EXPLICA_CONDICIONES, piezasChip } from "../vista/condiciones";
import { figura as figuraDe, valorar } from "../analista/valoracion";

type Capa = { tipo: "historia"; i: number } | { tipo: "proceso" } | { tipo: "gol"; id: string } | null;

const ESTILO: Record<string, string> = { posesion: "possession", contragolpe: "counter-attack", presion: "pressing" };

export function VistaPartido({
  datos,
  etiqueta,
  ruta,
  overlayUrl,
  origen,
}: {
  datos: DatosPartido;
  etiqueta: string;
  ruta: string;
  /** Brief 016: un partido de liga no se reconstruye desde su semilla; trae su propio endpoint. */
  overlayUrl?: string;
  /**
   * Brief 016 (cierre): rótulo del origen en la cabecera. Por defecto «Seed N»; un partido de
   * liga dice «League fixture», porque su semilla escrita en Simulate daría OTRO partido.
   */
  origen?: string;
}) {
  const { cronica, hechos, eventos, local, visita } = datos;
  // Jurado internacional: la crónica abre en inglés; el español queda en el toggle.
  const [lengua, setLengua] = useState<Lengua>("en");
  // Brief 007: Aficionado ↔ Analista es solo render (estado del cliente): cero llamadas al LLM.
  const [modo, setModo] = useState<ModoRender>("aficionado");
  const equipoPerspectiva = datos.perspectiva === "local" ? local.nombre : datos.perspectiva === "visita" ? visita.nombre : undefined;
  const [oracionSel, setOracionSel] = useState<number | null>(null);
  const [oracionHover, setOracionHover] = useState<number | null>(null);
  const [eventoSel, setEventoSel] = useState<string | null>(null);
  // Brief 009: nota seleccionada (clave lado|jugador).
  const [ratingSel, setRatingSel] = useState<string | null>(null);
  const [capa, setCapa] = useState<Capa>(null);
  const linea = useRef<HTMLDivElement | null>(null);

  // Brief 008 — modo replay. Las updates se piden SOLO al pulsar Watch live (con un LLM real
  // cuestan; nada de prefetch) y vienen del mismo endpoint que el overlay de broadcast.
  const [vivo, setVivo] = useState(false);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [errorOverlay, setErrorOverlay] = useState<string | null>(null);
  const [reloj, setReloj] = useState(0);
  const [velocidad, setVelocidad] = useState<Velocidad>("x1");
  const [updateSel, setUpdateSel] = useState<number | null>(null);
  const minutoFinal = eventos[eventos.length - 1]?.minuto ?? 0;
  const terminado = reloj >= minutoFinal;
  const eventosVisibles = useMemo(() => (vivo ? eventos.filter((e) => e.minuto <= reloj) : eventos), [vivo, eventos, reloj]);
  const updatesVisibles = useMemo(() => (vivo && overlay ? overlay.actualizaciones.filter((a) => a.minuto <= reloj) : []), [vivo, overlay, reloj]);

  const verEnVivo = useCallback(() => {
    setVivo(true);
    setReloj(0);
    setVelocidad("x1");
    setUpdateSel(null);
    setOracionSel(null);
    setEventoSel(null);
    setCapa(null);
    if (overlay) return;
    setErrorOverlay(null);
    const q = datos.perspectiva === "neutral" ? "" : `?perspectiva=${datos.perspectiva}`;
    fetch(`${overlayUrl ?? `/api/overlay/${datos.seed}`}${q}`)
      .then(async (r) => {
        const json: unknown = await r.json();
        if (!r.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${r.status}`);
        const v = esquemaOverlay.safeParse(json);
        if (!v.success) throw new Error("the overlay did not match its schema");
        setOverlay(v.data);
      })
      .catch((e: unknown) => setErrorOverlay((e as Error).message));
  }, [overlay, datos.perspectiva, datos.seed, overlayUrl]);

  const salirAlFinal = useCallback(() => {
    setVivo(false);
    setUpdateSel(null);
    setEventoSel(null);
    setCapa(null);
  }, []);

  // El reloj del replay: corre solo con las updates ya cargadas, y se detiene en pausa o al final.
  useEffect(() => {
    if (!vivo || !overlay || velocidad === "pausa" || terminado) return;
    const t = window.setInterval(() => setReloj((r) => Math.min(r + 1, minutoFinal)), MS_POR_MINUTO[velocidad]);
    return () => window.clearInterval(t);
  }, [vivo, overlay, velocidad, terminado, minutoFinal]);

  // Durante el replay, la línea de tiempo sigue al último evento salvo que haya algo seleccionado.
  useEffect(() => {
    const cont = linea.current;
    if (!vivo || !cont || updateSel !== null || eventoSel !== null) return;
    cont.scrollTo({ top: cont.scrollHeight });
  }, [vivo, eventosVisibles.length, updateSel, eventoSel]);

  // Brief 014: el partido tal como se ve (en el replay, el prefijo) para la capa micro.
  const partidoVisto = useMemo(() => ({ config: datos.config, eventos: eventosVisibles }), [datos.config, eventosVisibles]);
  // Brief 009: valoraciones de lo visto (en el replay, el prefijo): función pura de los eventos.
  const valoraciones = useMemo(() => valorar({ config: datos.config, eventos: eventosVisibles }), [datos.config, eventosVisibles]);
  const claveFigura = useMemo(() => {
    if (vivo && !terminado) return undefined; // «la figura del partido» es un hecho de cierre
    const f = figuraDe({ config: datos.config, eventos: eventosVisibles }, valoraciones);
    return f ? claveValoracion(f) : undefined;
  }, [vivo, terminado, datos.config, eventosVisibles, valoraciones]);
  const eventosDeRating = useMemo(
    () => (ratingSel ? [...new Set(valoraciones.find((v) => claveValoracion(v) === ratingSel)?.desglose.map((d) => d.evento) ?? [])] : []),
    [ratingSel, valoraciones],
  );

  const eventosResaltados = useMemo(() => {
    if (ratingSel) return new Set(eventosDeRating);
    if (vivo) {
      if (updateSel !== null) return new Set(updatesVisibles[updateSel]?.eventos ?? []);
      return new Set<string>(eventoSel ? [eventoSel] : []);
    }
    if (oracionSel !== null) return new Set(eventosDeOracion(cronica, hechos, oracionSel));
    if (eventoSel) return new Set([eventoSel]);
    return new Set<string>();
  }, [cronica, hechos, oracionSel, eventoSel, vivo, updateSel, updatesVisibles, ratingSel, eventosDeRating]);

  // Clic en una nota: lleva la línea de tiempo al primer evento de su desglose.
  useEffect(() => {
    const primero = eventosDeRating[0];
    const cont = linea.current;
    if (!ratingSel || !primero || !cont) return;
    const fila = cont.querySelector<HTMLElement>(`[data-event-id="${primero}"]`);
    if (fila) cont.scrollTo({ top: Math.max(0, fila.offsetTop - cont.clientHeight / 3), behavior: "smooth" });
  }, [ratingSel, eventosDeRating]);

  const alRating = useCallback((k: string) => {
    setOracionSel(null);
    setEventoSel(null);
    setUpdateSel(null);
    setRatingSel((prev) => (prev === k ? null : k));
  }, []);

  const updatesResaltadas = useMemo(() => {
    if (eventoSel) return new Set(updatesVisibles.flatMap((a, i) => (a.eventos.includes(eventoSel) ? [i] : [])));
    if (updateSel !== null) return new Set([updateSel]);
    return new Set<number>();
  }, [updatesVisibles, eventoSel, updateSel]);

  // Clic en una update: resalta sus eventos y lleva la línea de tiempo al primero.
  useEffect(() => {
    if (updateSel === null) return;
    const primero = updatesVisibles[updateSel]?.eventos[0];
    const cont = linea.current;
    if (!primero || !cont) return;
    const fila = cont.querySelector<HTMLElement>(`[data-event-id="${primero}"]`);
    if (fila) cont.scrollTo({ top: Math.max(0, fila.offsetTop - cont.clientHeight / 3), behavior: "smooth" });
  }, [updateSel, updatesVisibles]);

  const alUpdate = useCallback((i: number) => {
    setEventoSel(null);
    setRatingSel(null);
    setUpdateSel((prev) => (prev === i ? null : i));
  }, []);

  const eventosHover = useMemo(
    () => (oracionHover !== null && oracionHover !== oracionSel ? new Set(eventosDeOracion(cronica, hechos, oracionHover)) : new Set<string>()),
    [cronica, hechos, oracionHover, oracionSel],
  );

  const oracionesResaltadas = useMemo(() => {
    if (eventoSel) return new Set(oracionesDeEvento(cronica, hechos, eventoSel));
    if (oracionSel !== null) return new Set([oracionSel]);
    return new Set<number>();
  }, [cronica, hechos, eventoSel, oracionSel]);

  // Scroll al primer evento resaltado, DENTRO de la línea de tiempo (sin mover la página).
  useEffect(() => {
    if (oracionSel === null) return;
    const primero = eventosDeOracion(cronica, hechos, oracionSel)[0];
    const cont = linea.current;
    if (!primero || !cont) return;
    const fila = cont.querySelector<HTMLElement>(`[data-event-id="${primero}"]`);
    if (fila) cont.scrollTo({ top: Math.max(0, fila.offsetTop - cont.clientHeight / 3), behavior: "smooth" });
  }, [oracionSel, cronica, hechos]);

  // Escape cierra la capa abierta.
  useEffect(() => {
    const cerrar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCapa(null);
    };
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, []);

  const alOracion = useCallback((i: number) => {
    setEventoSel(null);
    setRatingSel(null);
    setOracionSel((prev) => (prev === i ? null : i));
  }, []);

  const alEvento = useCallback((e: Evento) => {
    setOracionSel(null);
    setUpdateSel(null);
    setRatingSel(null);
    setEventoSel((prev) => (prev === e.id && e.tipo !== "gol" ? null : e.id));
    if (e.tipo === "gol") setCapa({ tipo: "gol", id: e.id });
  }, []);

  const final = hechos.find((h) => h.tipo === "resultado_final")?.datos;
  // En el replay, el marcador es el del minuto del reloj: nada del futuro en pantalla.
  const ultimoVisible = eventosVisibles[eventosVisibles.length - 1];
  const enVivo = ultimoVisible ? marcadorProgresivo(eventosVisibles)[ultimoVisible.id] : undefined;
  const marcador = vivo ? { local: enVivo?.local ?? 0, visita: enVivo?.visita ?? 0 } : { local: final?.goles_local ?? 0, visita: final?.goles_visita ?? 0 };

  return (
    <div data-testid="match-view" data-seed={datos.seed}>
      <header className="match-head">
        <div className="overline tnum">
          {etiqueta} · {origen ?? `Seed ${datos.seed}`} · Simulated match{equipoPerspectiva ? ` · Told for ${equipoPerspectiva} supporters` : ""}
        </div>
        {/* Brief 018: las condiciones registradas, visibles desde el 0' (también en el replay). */}
        {datos.config.condiciones && (
          <div className="conditions" data-testid="conditions">
            <span className="conditions-chip tnum" data-testid="conditions-chip" data-clima={datos.config.condiciones.clima}>
              {piezasChip(datos.config.condiciones).join(" · ")}
            </span>
            <span className="conditions-note">{EXPLICA_CONDICIONES}</span>
          </div>
        )}
        <div className="scoreline">
          <div className="team home">
            {local.nombre}
            <span className="team-meta tnum">
              Home · {ESTILO[local.estilo]} · ATT {local.ataque} · DEF {local.defensa}
            </span>
          </div>
          <div className="score tnum" data-testid={vivo ? "live-score" : "final-score"}>
            {String(marcador.local)}
            <span className="score-sep">–</span>
            {String(marcador.visita)}
          </div>
          <div className="team">
            {visita.nombre}
            <span className="team-meta tnum">
              Away · {ESTILO[visita.estilo]} · ATT {visita.ataque} · DEF {visita.defensa}
            </span>
          </div>
        </div>
        <nav className="perspective" aria-label="Tell the match for" data-testid="perspective">
          <span className="overline">Tell it for</span>
          <div className="lang-toggle" role="group">
            {(
              [
                ["neutral", "Neutral"],
                ["local", local.nombre],
                ["visita", visita.nombre],
              ] as const
            ).map(([p, nombre]) => (
              <Link
                key={p}
                href={p === "neutral" ? ruta : `${ruta}?perspectiva=${p}`}
                className="perspective-option"
                aria-current={datos.perspectiva === p ? "true" : undefined}
                data-perspective={p}
                scroll={false}
                // Sin prefetch: cada perspectiva es una crónica que el server calcula (y con un LLM
                // real, una llamada que cuesta). Solo se pide si el usuario la elige.
                prefetch={false}
              >
                {nombre}
              </Link>
            ))}
          </div>
          {!vivo && (
            <button type="button" className="btn btn-primary watch-live" data-testid="watch-live" onClick={verEnVivo} title="Replay the match minute by minute, with verified updates at each key moment">
              Watch live
            </button>
          )}
        </nav>
        {vivo && <ControlesReplay reloj={reloj} terminado={terminado} velocidad={velocidad} onVelocidad={setVelocidad} onSkip={salirAlFinal} />}
      </header>

      <div className="panels">
        <section className="panel" aria-label="Match timeline">
          <div className="panel-head">
            <span className="overline">{vivo ? "Timeline · events so far" : "Timeline · every event of the match"}</span>
            {(oracionSel !== null || eventoSel || updateSel !== null || ratingSel) && (
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => {
                  setOracionSel(null);
                  setEventoSel(null);
                  setUpdateSel(null);
                  setRatingSel(null);
                }}
              >
                Clear selection
              </button>
            )}
          </div>
          <Linea
            eventos={eventosVisibles}
            local={local.nombre}
            visita={visita.nombre}
            resaltados={eventosResaltados}
            hover={eventosHover}
            seleccionado={eventoSel}
            onEvento={alEvento}
            contenedor={linea}
            modo={modo}
            lengua={lengua}
          />
        </section>
        <section className="panel" aria-label={vivo ? "Live updates" : "Match report"}>
          {vivo ? (
            <Ticker
              actualizaciones={updatesVisibles}
              lengua={lengua}
              onLengua={setLengua}
              seleccionada={updateSel}
              resaltadas={updatesResaltadas}
              onActualizacion={alUpdate}
              cargando={overlay === null && errorOverlay === null}
              error={errorOverlay}
            />
          ) : (
          <Cronica
            cronica={cronica}
            hechos={hechos}
            eventos={eventos}
            {...(equipoPerspectiva ? { equipoPerspectiva } : {})}
            deltaMiEquipo={datos.deltaMiEquipo}
            modo={modo}
            onModo={setModo}
            lengua={lengua}
            onLengua={setLengua}
            resaltadas={oracionesResaltadas}
            seleccionada={oracionSel}
            onOracion={alOracion}
            onHover={setOracionHover}
            onHistoria={(i) => setCapa({ tipo: "historia", i })}
            onProceso={() => setCapa({ tipo: "proceso" })}
          />
          )}
        </section>
      </div>

      <Ratings
        valoraciones={valoraciones}
        eventos={eventosVisibles}
        nombres={{ local: local.nombre, visita: visita.nombre }}
        {...(claveFigura ? { figura: claveFigura } : {})}
        seleccionada={ratingSel}
        onSeleccion={alRating}
        expandido={modo === "analista"}
        enVivo={vivo && !terminado}
        lengua={lengua}
      />

      {/* Brief 014: Match stats de la capa micro (lo visto: en el replay, el prefijo). */}
      <Stats partido={partidoVisto} nombres={{ local: local.nombre, visita: visita.nombre }} enVivo={vivo && !terminado} analista={modo === "analista"} lengua={lengua} />

      {capa?.tipo === "historia" && <HistoriaFrase cronica={cronica} i={capa.i} lengua={lengua} onCerrar={() => setCapa(null)} />}
      {capa?.tipo === "proceso" && <Proceso cronica={cronica} lengua={lengua} onCerrar={() => setCapa(null)} />}
      {capa?.tipo === "gol" && (
        <TarjetaGol eventos={eventosVisibles} golId={capa.id} citas={oracionesDeEvento(cronica, hechos, capa.id).length} onCerrar={() => setCapa(null)} modo={modo} lengua={lengua} />
      )}
    </div>
  );
}
