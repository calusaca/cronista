"use client";
// Barra superior: marca + simular otro partido (presets con historia, o una semilla).
// Sin configuración avanzada a la vista (brief 004).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { Preset } from "../vista/servidor";

const SEED_MAX = 4294967295;

export function Simulador({ presets, semillaActual }: { presets: Preset[]; semillaActual: number }) {
  const router = useRouter();
  const [semilla, setSemilla] = useState(String(semillaActual));
  const [error, setError] = useState<string | null>(null);

  const simular = (ev: FormEvent) => {
    ev.preventDefault();
    const t = semilla.trim();
    if (!/^[0-9]+$/.test(t) || Number(t) > SEED_MAX) {
      setError(`Seed must be a whole number from 0 to ${SEED_MAX}.`);
      return;
    }
    setError(null);
    router.push(`/match/${Number(t)}`);
  };

  return (
    <header className="topbar">
      <Link href="/" className="brand" prefetch={false}>
        <span className="brand-mark">CRONISTA</span>
        <span className="brand-tag">Match reports where every sentence shows its evidence</span>
      </Link>
      <form className="sim-form" onSubmit={simular} aria-label="Simulate a match">
        <select
          className="field"
          aria-label="Choose a story"
          value=""
          onChange={(e) => {
            if (e.target.value) router.push(`/match/${e.target.value}`);
          }}
          data-testid="preset-select"
        >
          <option value="">Pick a story…</option>
          {presets.map((p) => (
            <option key={p.seed} value={p.seed}>
              {p.historia} — {p.local} {p.marcador} {p.visita}
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
        />
        <button type="submit" className="btn btn-primary" data-testid="simulate">
          Simulate match
        </button>
        {error && (
          <span role="alert" style={{ color: "var(--danger)", fontSize: 14 }}>
            {error}
          </span>
        )}
      </form>
    </header>
  );
}
