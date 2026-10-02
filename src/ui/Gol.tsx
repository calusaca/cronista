"use client";
// «Cómo fue el gol» (brief 004, comprometido): la jugada paso a paso sacada de los eventos
// y un esquema tipo pizarra de periódico. Honesto: los eventos dicen quién, cuándo y el xG
// del remate — no dónde. Las posiciones son CONVENCIONALES y el dibujo lo dice.

import type { Evento } from "../sim/tipos";
import { fmtMinuto, jugadaDelGol, type PasoJugada } from "../vista/evidencia";
import { IconoCerrar, IconoEvento } from "./Iconos";

const ROL: Record<PasoJugada["rol"], string> = {
  falta: "Foul in the box — penalty",
  corner: "Corner",
  pase_clave: "Key pass",
  tiro: "Shot",
  gol: "Goal",
};

const apellido = (n?: string) => (n ? n.split(" ").slice(1).join(" ") || n : "");

interface Punto {
  x: number;
  y: number;
}

/**
 * Posiciones convencionales (no datos): penal en el punto penal; remate tras córner, en el
 * área chica; si no, más cerca del arco cuanto mayor el xG. El lado sale de la paridad del
 * id del evento: determinista y sin pretender nada.
 */
function posiciones(pasos: PasoJugada[]): { remate: Punto; origen?: Punto; origenRol?: PasoJugada["rol"] } {
  const tiro = pasos.find((p) => p.rol === "tiro")?.evento;
  const previo = pasos.find((p) => p.rol === "corner" || p.rol === "pase_clave" || p.rol === "falta");
  if (!tiro) return { remate: { x: 50, y: 14 } };
  const lado = Number(tiro.id.slice(1)) % 2 === 0 ? 1 : -1;
  let remate: Punto;
  if (tiro.penal) remate = { x: 50, y: 14 };
  else if (previo?.rol === "corner") remate = { x: 50 + lado * 6, y: 7.5 };
  else {
    const lejos = Math.max(0, Math.min(1, 1 - (tiro.xg ?? 0.1) / 0.6));
    remate = { x: 50 + lado * (3 + lejos * 14), y: 8 + lejos * 26 };
  }
  if (!previo) return { remate };
  if (previo.rol === "corner") return { remate, origen: { x: lado > 0 ? 97 : 3, y: 3 }, origenRol: "corner" };
  if (previo.rol === "falta") return { remate, origen: { x: 50 - lado * 7, y: 17 }, origenRol: "falta" };
  return { remate, origen: { x: 50 - lado * 22, y: Math.min(66, remate.y + 24) }, origenRol: "pase_clave" };
}

function Pizarra({ pasos }: { pasos: PasoJugada[] }) {
  const { remate, origen, origenRol } = posiciones(pasos);
  const tirador = pasos.find((p) => p.rol === "tiro")?.evento;
  const pasador = pasos.find((p) => p.rol === origenRol)?.evento;
  const arco = { x: 50, y: 2.2 };
  // Brief 010: sin colores en componentes — las líneas de la cancha usan el token --pitch-line.
  const linea = "var(--pitch-line)";
  return (
    <svg className="pitch" viewBox="0 0 100 72" role="img" aria-label="Schematic of the goal" data-testid="pitch-diagram">
      <rect x="2" y="2" width="96" height="68" fill="none" stroke={linea} strokeWidth="0.4" />
      <rect x="21" y="2" width="58" height="17" fill="none" stroke={linea} strokeWidth="0.4" />
      <rect x="37" y="2" width="26" height="6" fill="none" stroke={linea} strokeWidth="0.4" />
      <path d="M40 19 A11 11 0 0 0 60 19" fill="none" stroke={linea} strokeWidth="0.4" />
      <circle cx="50" cy="13" r="0.5" fill={linea} />
      <line x1="45" y1="2" x2="55" y2="2" stroke="var(--ink)" strokeWidth="1" />
      <text x="4" y="67" fontSize="2.6" fill="var(--muted)" letterSpacing="0.4">
        SCHEMATIC · NOT TRACKING DATA
      </text>
      {origen && (
        <>
          <line x1={origen.x} y1={origen.y} x2={remate.x} y2={remate.y} stroke="var(--muted)" strokeWidth="0.5" strokeDasharray="1.4 1.2" />
          <circle cx={origen.x} cy={origen.y} r="1.4" fill="var(--surface)" stroke="var(--muted)" strokeWidth="0.5" />
          {pasador?.jugador && (
            <text x={origen.x + (origen.x > 50 ? -2 : 2)} y={origen.y + 4} fontSize="2.8" fill="var(--muted)" textAnchor={origen.x > 50 ? "end" : "start"}>
              {apellido(pasador.jugador)}
            </text>
          )}
        </>
      )}
      <line x1={remate.x} y1={remate.y} x2={arco.x} y2={arco.y} stroke="var(--accent)" strokeWidth="0.8" />
      <circle cx={remate.x} cy={remate.y} r="1.6" fill="var(--accent)" />
      <circle cx={arco.x} cy={arco.y + 0.6} r="1.2" fill="none" stroke="var(--accent)" strokeWidth="0.5" />
      {tirador?.jugador && (
        <text x={remate.x + 2.4} y={remate.y + 1} fontSize="2.8" fill="var(--ink)">
          {apellido(tirador.jugador)}
          {tirador.xg !== undefined ? ` · xG ${tirador.xg.toFixed(2)}` : ""}
        </text>
      )}
    </svg>
  );
}

export function TarjetaGol({ eventos, golId, citas, onCerrar }: { eventos: Evento[]; golId: string; citas: number; onCerrar: () => void }) {
  const pasos = jugadaDelGol(eventos, golId);
  const gol = pasos.find((p) => p.rol === "gol")?.evento;
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
                </span>
              </li>
            ))}
          </ol>
          <Pizarra pasos={pasos} />
          <p className="caption">
            Schematic. The events record who, when and the shot&apos;s xG — not where. Positions are conventional and drawn only from those facts.
            {citas > 0 ? ` Cited by ${citas} ${citas === 1 ? "sentence" : "sentences"} of the report.` : ""}
          </p>
        </div>
      </aside>
    </>
  );
}
