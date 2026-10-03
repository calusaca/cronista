// Iconos de trazo (un solo grosor, currentColor). Sin emoji: skill diseno-profesional.
import type { TipoEvento } from "../sim/tipos";

type P = { size?: number };
const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export function IconoEvento({ tipo, size = 16 }: { tipo: TipoEvento } & P) {
  switch (tipo) {
    case "gol":
      // balón
      return (
        <svg {...base(size)}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5l3.2 2.3-1.2 3.8H10l-1.2-3.8z" />
          <path d="M12 3v4.5M21 10.5l-5.8-.7M18 19l-4-5.4M6 19l4-5.4M3 10.5l5.8-.7" />
        </svg>
      );
    case "tiro":
      return (
        <svg {...base(size)}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3.5" />
        </svg>
      );
    case "atajada":
      // guante: palma abierta
      return (
        <svg {...base(size)}>
          <path d="M7 11V6.5a1.5 1.5 0 013 0V11M10 10V5a1.5 1.5 0 013 0v5M13 10V6a1.5 1.5 0 013 0v6" />
          <path d="M16 11.5V9.5a1.5 1.5 0 013 0V14a7 7 0 01-7 7h-.5A6.5 6.5 0 015 15.5V12a1.5 1.5 0 013 0" />
        </svg>
      );
    case "pase_clave":
      return (
        <svg {...base(size)}>
          <path d="M4 17c4-8 9-10 15-10" />
          <path d="M15 4l4 3-3 4" />
        </svg>
      );
    case "corner":
      return (
        <svg {...base(size)}>
          <path d="M6 21V4" />
          <path d="M6 4l11 3.5L6 11" />
        </svg>
      );
    case "falta":
      // silbato
      return (
        <svg {...base(size)}>
          <path d="M3 9h11.5a4.5 4.5 0 11-4.4 5.5H6.5A3.5 3.5 0 013 11z" />
          <path d="M14 6v3" />
        </svg>
      );
    case "tarjeta_amarilla":
      return (
        <svg {...base(size)}>
          <rect x="7" y="4" width="10" height="15" rx="1.5" fill="var(--card-yellow)" stroke="var(--card-yellow)" />
        </svg>
      );
    case "tarjeta_roja":
      return (
        <svg {...base(size)}>
          <rect x="7" y="4" width="10" height="15" rx="1.5" fill="var(--danger)" stroke="var(--danger)" />
        </svg>
      );
    case "fuera_de_juego":
      return (
        <svg {...base(size)}>
          <path d="M5 21V4" />
          <path d="M5 4h12l-2.5 4L17 12H5" />
        </svg>
      );
    case "cambio":
      return (
        <svg {...base(size)}>
          <path d="M7 4v14M3.5 14.5L7 18l3.5-3.5" />
          <path d="M17 20V6M13.5 9.5L17 6l3.5 3.5" />
        </svg>
      );
    case "lesion":
      // cruz de asistencia (brief 019)
      return (
        <svg {...base(size)}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      );
    default:
      return (
        <svg {...base(size)}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l2.5 2" />
        </svg>
      );
  }
}

export function IconoVerificada({ size = 16 }: P) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.7 2.7L16 9.5" />
    </svg>
  );
}

export function IconoCorregida({ size = 16 }: P) {
  return (
    <svg {...base(size)}>
      <path d="M20 11a8 8 0 10-2.3 5.7" />
      <path d="M20 5v6h-6" />
    </svg>
  );
}

export function IconoActa({ size = 16 }: P) {
  return (
    <svg {...base(size)}>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M10 12h5M10 16h5" />
    </svg>
  );
}

export function IconoCerrar({ size = 18 }: P) {
  return (
    <svg {...base(size)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconoHistoria({ size = 14 }: P) {
  return (
    <svg {...base(size)}>
      <path d="M4 12a8 8 0 108-8 8 8 0 00-5.7 2.3L4 8.5" />
      <path d="M4 4v4.5h4.5M12 8v4l3 2" />
    </svg>
  );
}

/** Brief 011: dado (partido al azar). */
export function IconoDado({ size = 16 }: P) {
  return (
    <svg {...base(size)}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="9" cy="9" r="0.9" fill="currentColor" />
      <circle cx="15" cy="15" r="0.9" fill="currentColor" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" />
    </svg>
  );
}
