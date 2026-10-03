"use client";
// Brief 021 — la vista 3D de la tarjeta del gol. Este componente NO importa three: lo pide con
// import() perezoso (render3d) solo cuando se monta, es decir, al tocar «3D». Sin WebGL no carga
// nada y avisa al padre, que se queda en la 2D (sin error). `data-anim-3d` lleva el estado de la
// animación: cargando → corriendo → terminada (o sin-webgl); la e2e graba la transición.

import { useEffect, useRef, useState } from "react";
import type { Escena3D } from "../vista/escena3d";
import { IconoHistoria } from "./Iconos";

type Estado = "cargando" | "corriendo" | "terminada" | "sin-webgl" | "error";

/** ¿Hay WebGL? (sin cargar three). */
export function hayWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

const token = (n: string, defecto: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || defecto;

export function Pizarra3D({ escena, onSinWebGL }: { escena: Escena3D; onSinWebGL: () => void }) {
  const caja = useRef<HTMLDivElement | null>(null);
  const [estado, setEstado] = useState<Estado>("cargando");
  const repetir = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!hayWebGL()) {
      setEstado("sin-webgl");
      onSinWebGL();
      return;
    }
    let vivo = true;
    let desmontar: (() => void) | undefined;
    import("./render3d")
      .then((m) => {
        if (!vivo || !caja.current) return;
        const sinMovimiento = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
        const r = m.montar(
          caja.current,
          escena,
          {
            suelo: token("--hl", "#dff0e5"),
            linea: token("--pitch-line", "#b9b7aa"),
            tinta: token("--ink", "#20281f"),
            acento: token("--accent", "#1c7a48"),
            peligro: token("--danger", "#b0392e"),
            apagado: token("--muted", "#647062"),
          },
          { sinMovimiento, onEstado: (e) => vivo && setEstado(e) },
        );
        repetir.current = r.repetir;
        desmontar = r.desmontar;
      })
      .catch(() => {
        if (!vivo) return;
        setEstado("error");
        onSinWebGL();
      });
    return () => {
      vivo = false;
      desmontar?.();
    };
  }, [escena, onSinWebGL]);

  return (
    <div className="pitch-3d" data-testid="pitch-3d" data-anim-3d={estado}>
      <div ref={caja} className="pitch-3d-lienzo" />
      {/* El rótulo honesto, SIEMPRE visible (el mismo de la pizarra 2D). */}
      <p className="pitch-3d-rotulo" data-testid="pitch-3d-rotulo">
        {escena.rotulo}
      </p>
      <div className="pitch-tools">
        <button type="button" className="btn btn-quiet" data-testid="pitch-3d-replay" onClick={() => repetir.current?.()} disabled={estado !== "terminada"}>
          <IconoHistoria /> Replay
        </button>
      </div>
    </div>
  );
}
