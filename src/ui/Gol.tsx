"use client";
// «Cómo fue el gol» (brief 004; brief 011): la jugada paso a paso sacada de los eventos y
// una pizarra que dibuja SOLO lo registrado. Desde el 011 los eventos traen zona de origen,
// palo y altura del remate, y banda del córner: las posiciones salen de esos datos (una
// tabla zona → punto, en src/vista/pizarra.ts) y el balón se anima por la secuencia
// registrada hasta el palo registrado. Con prefers-reduced-motion, pizarra estática directa.
// Un partido sin detalle espacial cae a la pizarra convencional de antes, con su rótulo.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Evento } from "../sim/tipos";
import { EXPLICA_XG, formatoXg, type LenguaXg, type ModoXg } from "./textos";
import { fmtMinuto, jugadaDelGol, type PasoJugada } from "../vista/evidencia";
import { DURACION_ANIMACION_MS, geometriaJugada, type GeometriaJugada, MEDIO_CAMPO_M, posicionBalon, recorrido, type Punto, UNIDADES_POR_M } from "../vista/pizarra";
import { IconoCerrar, IconoEvento, IconoHistoria } from "./Iconos";
import { escenaDelGol } from "../vista/escena3d";
import { Pizarra3D } from "./Pizarra3D";
import { ALTURA_EN, BANDA_EN, DEFINICION_EN, DESTINO_EN, ZONA_EN } from "./textos";

const ROL: Record<PasoJugada["rol"], string> = {
  falta: "Foul in the box — penalty",
  corner: "Corner",
  pase_clave: "Key pass",
  tiro: "Shot",
  gol: "Goal",
  subida: "The goalkeeper goes up for the corner",
  atajada: "Saved",
};

/** Brief 015: las mediciones del tiro (son del evento, no coordenadas): « · 18 m · 97 km/h». */
const magnitudesTxt = (e: Evento) => `${e.distanciaM !== undefined ? ` · ${e.distanciaM} m` : ""}${e.velocidadKmh !== undefined ? ` · ${e.velocidadKmh} km/h` : ""}`;

const apellido = (n?: string) => (n ? n.split(" ").slice(1).join(" ") || n : "");

/** Lo que el paso agrega del detalle espacial registrado (texto, no dibujo). */
function detalleEspacial(p: PasoJugada): string {
  const e = p.evento;
  if (p.rol === "tiro" && e.zonaOrigen) {
    // Brief 020: la definición se nombra en el paso («Bicycle kick! · six-yard box · 4 m»).
    const def = e.definicion && e.definicion !== "jugada" ? `${DEFINICION_EN[e.definicion]} · ` : "";
    const partes = [e.definicion === "media_cancha" ? `${def}${magnitudesTxt(e).replace(/^ · /, "")}` : `${def}${ZONA_EN[e.zonaOrigen]}${magnitudesTxt(e)}`];
    if (e.destino) partes.push(`→ ${DESTINO_EN[e.destino]}${e.altura ? `, ${ALTURA_EN[e.altura]}` : ""}`);
    return ` · ${partes.join(" ")}`;
  }
  if (p.rol === "corner" && e.banda) return ` · ${BANDA_EN[e.banda]} side`;
  if (p.rol === "pase_clave" && e.zonaOrigen) return ` · from ${ZONA_EN[e.zonaOrigen]}`;
  return "";
}

/**
 * La cancha: el tercio de ataque. `alto` recorta la vista (la pizarra de datos llega hasta la
 * media distancia, así que no dibuja medio campo vacío).
 */
function Cancha({ children, rotulo, fuente, extra, alto = 72 }: { children: React.ReactNode; rotulo: string; fuente: "datos" | "convencional"; extra?: Record<string, string>; alto?: number }) {
  const linea = "var(--pitch-line)";
  return (
    <svg className="pitch" viewBox={`0 0 100 ${alto}`} role="img" aria-label="Diagram of the goal" data-testid="pitch-diagram" data-fuente={fuente} {...extra}>
      <rect x="2" y="2" width="96" height={alto - 4} fill="none" stroke={linea} strokeWidth="0.4" />
      <rect x="21" y="2" width="58" height="17" fill="none" stroke={linea} strokeWidth="0.4" />
      <rect x="37" y="2" width="26" height="6" fill="none" stroke={linea} strokeWidth="0.4" />
      <path d="M40 19 A11 11 0 0 0 60 19" fill="none" stroke={linea} strokeWidth="0.4" />
      <circle cx="50" cy="13" r="0.5" fill={linea} />
      <line x1="45" y1="2" x2="55" y2="2" stroke="var(--ink)" strokeWidth="1" />
      <text x="4" y={alto - 5} fontSize="2.6" fill="var(--muted)" letterSpacing="0.4">
        {rotulo}
      </text>
      {alto > 60 && (
        // Brief 020: con la cancha hasta el medio campo, la línea de medio campo a escala.
        <line x1="2" y1={2 + MEDIO_CAMPO_M * UNIDADES_POR_M} x2="98" y2={2 + MEDIO_CAMPO_M * UNIDADES_POR_M} stroke={linea} strokeWidth="0.4" />
      )}
      {children}
    </svg>
  );
}

/** ¿El usuario pidió menos movimiento? (la tarjeta solo existe en el cliente, tras un clic). */
function prefiereSinMovimiento(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** Pizarra desde los datos, con el balón animado por el recorrido registrado. */
function PizarraDatos({ geo, tirador, pasador, autor, fx }: { geo: GeometriaJugada; tirador?: Evento; pasador?: Evento; autor?: Evento; fx: (xg: number) => string }) {
  const [sinMovimiento] = useState(prefiereSinMovimiento);
  const [t, setT] = useState(sinMovimiento ? 1 : 0);
  const [ronda, setRonda] = useState(0);

  useEffect(() => {
    if (sinMovimiento) {
      setT(1);
      return;
    }
    setT(0);
    let raf = 0;
    const inicio = performance.now();
    const paso = (ahora: number) => {
      const f = Math.min(1, (ahora - inicio) / DURACION_ANIMACION_MS);
      setT(f);
      if (f < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [sinMovimiento, ronda, geo]);

  const ps = recorrido(geo);
  const balon = posicionBalon(geo, t);
  const tramos = ps.length - 1;
  const avance = t * tramos; // cuántos tramos lleva recorridos
  const llego = (k: number) => avance >= k - 1e-9; // el balón ya pasó por el punto k
  const terminada = t >= 1;
  const tramo = (k: number, ultimo: boolean) => {
    const a = ps[k] as Punto;
    const b = ps[k + 1] as Punto;
    const f = Math.max(0, Math.min(1, avance - k));
    if (f <= 0) return null;
    const fin = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    return ultimo ? (
      <line key={k} x1={a.x} y1={a.y} x2={fin.x} y2={fin.y} stroke="var(--accent)" strokeWidth="0.8" />
    ) : (
      <line key={k} x1={a.x} y1={a.y} x2={fin.x} y2={fin.y} stroke="var(--muted)" strokeWidth="0.5" strokeDasharray="1.4 1.2" />
    );
  };
  const iRemate = geo.origen ? 1 : 0;
  const etiquetaDef = geo.definicion ? DEFINICION_EN[geo.definicion] : "";
  // El rótulo del palo va del lado contrario a la jugada (el origen si hay; si no, el remate).
  const ladoRotulo = geo.origen && geo.origen.x !== 50 ? geo.origen.x : geo.remate.x;
  // Rótulo del remate (dos líneas): debajo del punto si está arriba en la cancha; si está lejos
  // del arco (la línea sube), al costado izquierdo, para no cruzar la trayectoria ni el pie.
  const rotulo: { x: number; y: number; anchor: "middle" | "end" } =
    geo.definicion === "olimpico"
      ? // Brief 025: el remate es el banderín; el rótulo va debajo de la curva, no encima.
        { x: Math.min(76, Math.max(24, geo.remate.x)), y: geo.remate.y + 13, anchor: "middle" }
      : geo.remate.y > 28
        ? { x: geo.remate.x - 3, y: geo.remate.y - 0.6, anchor: "end" }
        : { x: Math.min(76, Math.max(24, geo.remate.x)), y: geo.remate.y + 4.6, anchor: "middle" };

  return (
    <>
      <Cancha
        rotulo="POSITIONS BY ZONE, FROM MATCH DATA"
        fuente="datos"
        alto={geo.alto}
        extra={{ "data-anim": terminada ? "terminada" : "corriendo", "data-zona": geo.zona, "data-destino": geo.destino, ...(geo.definicion ? { "data-definicion": geo.definicion } : {}), ...(geo.autor ? { "data-autogol": "true" } : {}), ...(geo.palos ? { "data-palos": String(geo.palos) } : {}) }}
      >
        {Array.from({ length: tramos }, (_, k) => tramo(k, k === tramos - 1))}
        {geo.origen && (
          <>
            <circle cx={geo.origen.x} cy={geo.origen.y} r="1.4" fill="var(--surface)" stroke="var(--muted)" strokeWidth="0.5" />
            {pasador?.jugador && (
              <text
                x={geo.origen.x + (geo.origen.x > 50 ? -2 : 2)}
                y={geo.origen.y + 4}
                fontSize="2.8"
                fill="var(--muted)"
                textAnchor={geo.origen.x > 50 ? "end" : "start"}
              >
                {geo.origenRol === "corner" ? "Corner · " : ""}
                {apellido(pasador.jugador)}
              </text>
            )}
          </>
        )}
        {llego(iRemate) && (
          <>
            <circle cx={geo.remate.x} cy={geo.remate.y} r="1.6" fill="var(--accent)" />
            {tirador?.jugador && (
              // Brief 015: dos líneas centradas bajo el remate (quién · zona / mediciones), para
              // que las magnitudes no se salgan del dibujo.
              <text
                x={rotulo.x}
                y={rotulo.y}
                fontSize="2.8"
                fill="var(--ink)"
                textAnchor={rotulo.anchor}
                data-testid="pitch-zona"
              >
                <tspan>
                  {/* Brief 020: con definición, «¡Chilena! · Apellido» (la zona va en el paso: el rótulo no se alarga). */}
                  {etiquetaDef ? `${etiquetaDef} · ${apellido(tirador.jugador)}` : `${apellido(tirador.jugador)} · ${ZONA_EN[geo.zona]}`}
                </tspan>
                <tspan x={rotulo.x} dy="3.2" fill="var(--muted)">
                  {magnitudesTxt(tirador).replace(/^ · /, "")}
                  {tirador.xg !== undefined ? ` · ${fx(tirador.xg)}` : ""}
                </tspan>
              </text>
            )}
          </>
        )}
        {geo.autor && llego(iRemate + 1) && (
          // Brief 020: el autor del autogol, en señal (no acento): es del equipo que lo SUFRE.
          <>
            <circle cx={geo.autor.x} cy={geo.autor.y} r="1.5" fill="var(--danger)" data-testid="pitch-autor" />
            <text x={geo.autor.x + (geo.autor.x < 50 ? -2.4 : 2.4)} y={geo.autor.y + 4.2} fontSize="2.8" fill="var(--danger)" textAnchor={geo.autor.x < 50 ? "end" : "start"}>
              Own goal · {apellido(autor?.jugador)}
            </text>
          </>
        )}
        {terminada && (
          <>
            <circle cx={geo.arco.x} cy={geo.arco.y + 0.6} r="1.2" fill="none" stroke="var(--accent)" strokeWidth="0.5" data-testid="pitch-target" />
            {/* Al costado del arco, del lado CONTRARIO al remate (así no pisa la trayectoria). */}
            <text
              x={ladoRotulo > 50 ? 43 : 57}
              y={5.4}
              fontSize="2.6"
              fill="var(--ink)"
              textAnchor={ladoRotulo > 50 ? "end" : "start"}
              data-testid="pitch-destino"
            >
              {geo.palos === 2 ? "Both posts!" : geo.palos === 1 ? "Off the post" : DESTINO_EN[geo.destino]}
              {geo.altura ? ` · ${ALTURA_EN[geo.altura]}` : ""}
            </text>
          </>
        )}
        <circle cx={balon.x} cy={balon.y} r="1.1" fill="var(--ink)" stroke="var(--surface)" strokeWidth="0.3" data-testid="pitch-ball" />
      </Cancha>
      <div className="pitch-tools">
        <button type="button" className="btn btn-quiet" data-testid="pitch-replay" onClick={() => setRonda((r) => r + 1)} disabled={sinMovimiento}>
          <IconoHistoria /> Replay
        </button>
      </div>
    </>
  );
}

/**
 * Pizarra convencional (partidos sin detalle espacial): posiciones que NO son datos. Penal
 * en el punto penal; remate tras córner en el área chica; si no, más cerca cuanto mayor el
 * xG; el lado sale de la paridad del id. Se rotula como tal.
 */
function PizarraConvencional({ pasos, fx }: { pasos: PasoJugada[]; fx: (xg: number) => string }) {
  const tiro = pasos.find((p) => p.rol === "tiro")?.evento;
  const previo = pasos.find((p) => p.rol === "corner" || p.rol === "pase_clave" || p.rol === "falta");
  const lado = tiro && Number(tiro.id.slice(1)) % 2 === 0 ? 1 : -1;
  let remate: Punto = { x: 50, y: 14 };
  if (tiro && !tiro.penal) {
    if (previo?.rol === "corner") remate = { x: 50 + lado * 6, y: 7.5 };
    else {
      const lejos = Math.max(0, Math.min(1, 1 - (tiro.xg ?? 0.1) / 0.6));
      remate = { x: 50 + lado * (3 + lejos * 14), y: 8 + lejos * 26 };
    }
  }
  let origen: Punto | undefined;
  if (previo?.rol === "corner") origen = { x: lado > 0 ? 97 : 3, y: 3 };
  else if (previo?.rol === "falta") origen = { x: 50 - lado * 7, y: 17 };
  else if (previo?.rol === "pase_clave") origen = { x: 50 - lado * 22, y: Math.min(66, remate.y + 24) };
  const arco = { x: 50, y: 2.2 };
  return (
    <Cancha rotulo="SCHEMATIC · NOT TRACKING DATA" fuente="convencional">
      {origen && (
        <>
          <line x1={origen.x} y1={origen.y} x2={remate.x} y2={remate.y} stroke="var(--muted)" strokeWidth="0.5" strokeDasharray="1.4 1.2" />
          <circle cx={origen.x} cy={origen.y} r="1.4" fill="var(--surface)" stroke="var(--muted)" strokeWidth="0.5" />
        </>
      )}
      <line x1={remate.x} y1={remate.y} x2={arco.x} y2={arco.y} stroke="var(--accent)" strokeWidth="0.8" />
      <circle cx={remate.x} cy={remate.y} r="1.6" fill="var(--accent)" />
      {tiro?.jugador && (
        <text x={remate.x + 2.4} y={remate.y + 1} fontSize="2.8" fill="var(--ink)">
          {apellido(tiro.jugador)}
          {tiro.xg !== undefined ? ` · ${fx(tiro.xg)}` : ""}
        </text>
      )}
    </Cancha>
  );
}

export function TarjetaGol({
  eventos,
  golId,
  citas,
  onCerrar,
  modo,
  lengua,
}: {
  eventos: Evento[];
  golId: string;
  citas: number;
  onCerrar: () => void;
  /** Brief 017: cómo se muestra el xG (Aficionado «35% chance» / Analista «xG 0.35»). */
  modo: ModoXg;
  lengua: LenguaXg;
}) {
  const fx = (xg: number) => formatoXg(xg, modo, lengua);
  const pasos = jugadaDelGol(eventos, golId);
  const gol = pasos.find((p) => p.rol === "gol")?.evento;
  // Brief 025: la tarjeta de la subida del portero (abierta desde ella) y la de un tiro al palo.
  const subida = eventos.find((e) => e.id === golId)?.tipo === "subida_portero" ? pasos[0]?.evento : undefined;
  const alPalo = !gol ? pasos.find((p) => p.rol === "tiro")?.evento : undefined;
  const geo = geometriaJugada(pasos, eventos);
  // Brief 025: en el olímpico no hay tiro: el rótulo del remate nombra a quien sacó el córner.
  const tirador = pasos.find((p) => p.rol === "tiro")?.evento ?? (geo?.definicion === "olimpico" ? pasos.find((p) => p.rol === "corner")?.evento : undefined);
  const pasador = geo?.origenRol ? pasos.find((p) => p.rol === geo.origenRol)?.evento : undefined;
  // Brief 021: la vista 3D (opcional; la 2D es el default). Solo para goles con detalle espacial,
  // y la tarjeta solo existe para goles ya emitidos (en vivo, sin clarividencia).
  // Memo por el CONTENIDO de la jugada: en vivo los eventos crecen cada minuto, la jugada del gol no.
  const clavePasos = JSON.stringify(pasos);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const escena = useMemo(() => escenaDelGol(eventos, pasos), [clavePasos]);
  const [vista, setVista] = useState<"2d" | "3d">("2d");
  const [sinWebGL, setSinWebGL] = useState(false);
  const alSinWebGL = useCallback(() => setSinWebGL(true), []);
  const citado = citas > 0 ? ` Cited by ${citas} ${citas === 1 ? "sentence" : "sentences"} of the report.` : "";
  return (
    <>
      <div className="scrim" onClick={onCerrar} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="gol-titulo" data-testid="goal-card">
        <div className="layer-head">
          <div>
            <div className="overline">{subida ? "The goalkeeper goes up" : gol ? "How the goal happened" : "How the shot hit the woodwork"}</div>
            <h2 className="layer-title tnum" id="gol-titulo">
              {subida ? (
                <>
                  {subida.jugador} · up for the corner · {fmtMinuto(subida.minuto)}
                </>
              ) : gol ? (
                <>
                  {gol.jugador}
                  {gol.autogol ? " (own goal)" : ""} · {fmtMinuto(gol.minuto)}
                </>
              ) : alPalo ? (
                <>
                  {alPalo.jugador} · {alPalo.alPalo === 2 ? "hit both posts" : "off the post"} · {fmtMinuto(alPalo.minuto)}
                </>
              ) : null}
            </h2>
          </div>
          <button type="button" className="btn btn-quiet" onClick={onCerrar} aria-label="Close">
            <IconoCerrar />
          </button>
        </div>
        <div className="layer-body">
          <ol className="steps">
            {pasos.map((p) => (
              <li key={p.evento.id} data-testid="goal-step">
                <span className="tnum" style={{ color: "var(--muted)", fontSize: 12 }}>
                  {fmtMinuto(p.evento.minuto)}
                </span>
                <span style={{ color: "var(--muted)", display: "flex" }}>
                  <IconoEvento tipo={p.evento.tipo} />
                </span>
                <span>
                  {p.rol === "gol" && p.evento.autogol ? "Own goal — into his own net" : ROL[p.rol]}
                  {p.evento.jugador ? ` · ${p.evento.jugador}` : ""}
                  {p.rol === "tiro" && p.evento.xg !== undefined ? <span className="tnum"> · {fx(p.evento.xg)}</span> : null}
                  {detalleEspacial(p)}
                </span>
              </li>
            ))}
          </ol>
          {escena && (
            <div className="lang-toggle pitch-vistas" role="group" aria-label="Diagram view">
              <button type="button" className="perspective-option" aria-pressed={vista === "2d"} data-testid="pitch-2d" onClick={() => setVista("2d")}>
                2D
              </button>
              <button type="button" className="perspective-option" aria-pressed={vista === "3d"} data-testid="pitch-3d-btn" onClick={() => setVista("3d")}>
                3D
              </button>
            </div>
          )}
          {vista === "3d" && sinWebGL && (
            <p className="caption" data-testid="sin-webgl">
              3D needs WebGL, which this browser does not offer — showing the 2D board.
            </p>
          )}
          {vista === "3d" && escena && !sinWebGL ? (
            <Pizarra3D key={golId} escena={escena} onSinWebGL={alSinWebGL} />
          ) : geo ? <PizarraDatos key={golId} geo={geo} fx={fx} {...(tirador ? { tirador } : {})} {...(pasador ? { pasador } : {})} {...(gol?.autogol ? { autor: gol } : {})} /> : <PizarraConvencional pasos={pasos} fx={fx} />}
          <p className="caption">
            {geo
              ? "Schematic: positions by zone, from match data. Each event records its zone, the post and the height of the shot — zones, not exact coordinates."
              : `Schematic. The events record who, when and the shot's ${modo === "analista" ? "xG" : "goal chance"} — not where. Positions are conventional and drawn only from those facts.`}
            {citado}
          </p>
          {modo === "aficionado" && (
            <p className="caption" data-testid="xg-explica">
              {EXPLICA_XG[lengua]}
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
