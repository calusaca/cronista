"use client";
// «Cómo fue el gol» (brief 004; brief 011): la jugada paso a paso sacada de los eventos y
// una pizarra que dibuja SOLO lo registrado. Desde el 011 los eventos traen zona de origen,
// palo y altura del remate, y banda del córner: las posiciones salen de esos datos (una
// tabla zona → punto, en src/vista/pizarra.ts) y el balón se anima por la secuencia
// registrada hasta el palo registrado. Con prefers-reduced-motion, pizarra estática directa.
// Un partido sin detalle espacial cae a la pizarra convencional de antes, con su rótulo.

import { useEffect, useState } from "react";
import type { Evento } from "../sim/tipos";
import { fmtMinuto, jugadaDelGol, type PasoJugada } from "../vista/evidencia";
import { DURACION_ANIMACION_MS, geometriaJugada, type GeometriaJugada, posicionBalon, recorrido, type Punto } from "../vista/pizarra";
import { IconoCerrar, IconoEvento, IconoHistoria } from "./Iconos";
import { ALTURA_EN, BANDA_EN, DESTINO_EN, ZONA_EN } from "./textos";

const ROL: Record<PasoJugada["rol"], string> = {
  falta: "Foul in the box — penalty",
  corner: "Corner",
  pase_clave: "Key pass",
  tiro: "Shot",
  gol: "Goal",
};

const apellido = (n?: string) => (n ? n.split(" ").slice(1).join(" ") || n : "");

/** Lo que el paso agrega del detalle espacial registrado (texto, no dibujo). */
function detalleEspacial(p: PasoJugada): string {
  const e = p.evento;
  if (p.rol === "tiro" && e.zonaOrigen) {
    const partes = [ZONA_EN[e.zonaOrigen]];
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
      {children}
    </svg>
  );
}

/** ¿El usuario pidió menos movimiento? (la tarjeta solo existe en el cliente, tras un clic). */
function prefiereSinMovimiento(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** Pizarra desde los datos, con el balón animado por el recorrido registrado. */
function PizarraDatos({ geo, tirador, pasador }: { geo: GeometriaJugada; tirador?: Evento; pasador?: Evento }) {
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

  return (
    <>
      <Cancha
        rotulo="POSITIONS BY ZONE, FROM MATCH DATA"
        fuente="datos"
        alto={48}
        extra={{ "data-anim": terminada ? "terminada" : "corriendo", "data-zona": geo.zona, "data-destino": geo.destino }}
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
              <text
                x={geo.remate.x + (geo.remate.x > 70 ? -2.4 : 2.4)}
                y={geo.remate.y + 1}
                fontSize="2.8"
                fill="var(--ink)"
                textAnchor={geo.remate.x > 70 ? "end" : "start"}
                data-testid="pitch-zona"
              >
                {apellido(tirador.jugador)} · {ZONA_EN[geo.zona]}
                {tirador.xg !== undefined ? ` · xG ${tirador.xg.toFixed(2)}` : ""}
              </text>
            )}
          </>
        )}
        {terminada && (
          <>
            <circle cx={geo.arco.x} cy={geo.arco.y + 0.6} r="1.2" fill="none" stroke="var(--accent)" strokeWidth="0.5" data-testid="pitch-target" />
            {/* Al costado del arco (no sobre la trayectoria): el palo y la altura registrados. */}
            <text x={57} y={5.4} fontSize="2.6" fill="var(--ink)" textAnchor="start" data-testid="pitch-destino">
              {DESTINO_EN[geo.destino]}
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
function PizarraConvencional({ pasos }: { pasos: PasoJugada[] }) {
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
          {tiro.xg !== undefined ? ` · xG ${tiro.xg.toFixed(2)}` : ""}
        </text>
      )}
    </Cancha>
  );
}

export function TarjetaGol({ eventos, golId, citas, onCerrar }: { eventos: Evento[]; golId: string; citas: number; onCerrar: () => void }) {
  const pasos = jugadaDelGol(eventos, golId);
  const gol = pasos.find((p) => p.rol === "gol")?.evento;
  const geo = geometriaJugada(pasos);
  const tirador = pasos.find((p) => p.rol === "tiro")?.evento;
  const pasador = geo?.origenRol ? pasos.find((p) => p.rol === geo.origenRol)?.evento : undefined;
  const citado = citas > 0 ? ` Cited by ${citas} ${citas === 1 ? "sentence" : "sentences"} of the report.` : "";
  return (
    <>
      <div className="scrim" onClick={onCerrar} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="gol-titulo" data-testid="goal-card">
        <div className="layer-head">
          <div>
            <div className="overline">How the goal happened</div>
            <h2 className="layer-title tnum" id="gol-titulo">
              {gol?.jugador} · {gol ? fmtMinuto(gol.minuto) : ""}
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
                  {ROL[p.rol]}
                  {p.evento.jugador ? ` · ${p.evento.jugador}` : ""}
                  {p.rol === "tiro" && p.evento.xg !== undefined ? <span className="tnum"> · xG {p.evento.xg.toFixed(2)}</span> : null}
                  {detalleEspacial(p)}
                </span>
              </li>
            ))}
          </ol>
          {geo ? <PizarraDatos key={golId} geo={geo} {...(tirador ? { tirador } : {})} {...(pasador ? { pasador } : {})} /> : <PizarraConvencional pasos={pasos} />}
          <p className="caption">
            {geo
              ? "Schematic: positions by zone, from match data. Each event records its zone, the post and the height of the shot — zones, not exact coordinates."
              : "Schematic. The events record who, when and the shot's xG — not where. Positions are conventional and drawn only from those facts."}
            {citado}
          </p>
        </div>
      </aside>
    </>
  );
}
