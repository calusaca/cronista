"use client";
// Barra superior: marca + simular otro partido (presets con historia, o una semilla).
// Sin configuración avanzada a la vista (brief 004).

import Link from "./Enlace";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import type { Perspectiva, Preset } from "../vista/servidor";
import { IconoDado } from "./Iconos";
import { useAvisoCarga } from "./Actividad";
import { EmblemaCronista } from "./Emblema";

/** Brief 011: rango del partido al azar (Math.random está bien aquí: es UI, no src/sim). */
const AZAR_MAX = 99999;

const SEED_MAX = 4294967295;

/** Brief 061 § 3 D4: sección del marco de las crónicas que marca `aria-current="page"` en la barra. */
export type SeccionCronicas = "cronicas" | "liga" | "datos";

/** Brief 016: `semillaActual` es opcional — en la liga el campo arranca vacío (su semilla no es un /match).
 *  Brief 061 v1.1 § V2: `perspectivaActual` (por defecto neutral) evita reabrir la crónica que ya se ve. */
export function Simulador({
  presets,
  semillaActual,
  seccion,
  perspectivaActual = "neutral",
}: {
  presets: Preset[];
  semillaActual?: number;
  seccion?: SeccionCronicas;
  perspectivaActual?: Perspectiva;
}) {
  const router = useRouter();
  const [semilla, setSemilla] = useState(semillaActual === undefined ? "" : String(semillaActual));
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciarTransicion] = useTransition();
  useAvisoCarga(pendiente, "Preparing your match…", "Generating the match and its report. This may take a little while.");

  const abrirPartido = (seed: number) => {
    if (pendiente) return;
    setError(null);
    // Brief 061 v1.1 § V2: si ya se ve la crónica neutral de esta semilla, no se apila otra entrada
    // idéntica (/ → /match/246). Desde local o visita sí se navega a la neutral, como antes.
    if (seed === semillaActual && perspectivaActual === "neutral") return;
    // La transición permanece pendiente hasta que el partido del servidor está listo.
    // No simulamos porcentajes ni etapas de una generación que no observamos aquí.
    iniciarTransicion(() => router.push(`/match/${seed}`));
  };

  const simular = (ev: FormEvent) => {
    ev.preventDefault();
    if (pendiente) return;
    const t = semilla.trim();
    // Brief 014 §3: el campo vacío no deja al usuario quieto — partido al azar, como Random match.
    if (t === "") {
      abrirPartido(1 + Math.floor(Math.random() * AZAR_MAX));
      return;
    }
    if (!/^[0-9]+$/.test(t) || Number(t) > SEED_MAX) {
      setError(`Seed must be a whole number from 0 to ${SEED_MAX}.`);
      return;
    }
    abrirPartido(Number(t));
  };

  return (
    // Brief 061 § 3 D3: la misma barra de rótulo que la arena (reglas Z1 del 047), ajustes propios en .topbar-cronicas.
    <header className="topbar arena-topbar topbar-cronicas">
      <Link href="/" className="brand" prefetch={false}>
        <EmblemaCronista />
        <span className="brand-mark">CRONISTA</span>
        <span className="brand-tag">Match reports where every sentence shows its evidence</span>
      </Link>
      <div className="topbar-acciones">
      <nav className="topbar-links" aria-label="Sections">
        {/* Brief 061 § 3 D4: las crónicas, con el mismo nombre que en la barra de la arena. */}
        <Link href="/" className="league-link" prefetch={false} data-testid="reports-link" aria-current={seccion === "cronicas" ? "page" : undefined}>
          Match reports
        </Link>
        {/* Brief 016: la liga ficticia completa. */}
        <Link href="/liga" className="league-link" prefetch={false} data-testid="league-mode" aria-current={seccion === "liga" ? "page" : undefined}>
          League mode
        </Link>
        {/* Brief 028: el dataset descargable. */}
        <Link href="/datos" className="league-link" prefetch={false} data-testid="data-link" aria-current={seccion === "datos" ? "page" : undefined}>
          Data
        </Link>
        <Link href="/arena" className="league-link" prefetch={false} data-testid="arena-link">
          Arena
        </Link>
      </nav>
      <form className="sim-form" onSubmit={simular} aria-label="Simulate a match" aria-busy={pendiente}>
        <select
          className="field"
          aria-label="Choose a story"
          value=""
          onChange={(e) => {
            if (e.target.value) abrirPartido(Number(e.target.value));
          }}
          disabled={pendiente}
          data-testid="preset-select"
        >
          <option value="">Pick a story…</option>
          {presets.map((p) => (
            <option key={p.seed} value={p.seed}>
              {p.historia} — {p.local} vs {p.visita}
            </option>
          ))}
        </select>
        <input
          className="field seed-input tnum"
          inputMode="numeric"
          aria-label="Seed"
          value={semilla}
          onChange={(e) => setSemilla(e.target.value)}
          data-testid="seed-input"
          disabled={pendiente}
        />
        <button type="submit" className="btn btn-primary" data-testid="simulate" disabled={pendiente}>
          Simulate match
        </button>
        <button
          type="button"
          className="btn random-match"
          data-testid="random-match"
          onClick={() => abrirPartido(1 + Math.floor(Math.random() * AZAR_MAX))}
          disabled={pendiente}
        >
          <IconoDado />
          Random match
        </button>
        {error && (
          <span role="alert" className="sim-error">
            {error}
          </span>
        )}
      </form>
      </div>
    </header>
  );
}
