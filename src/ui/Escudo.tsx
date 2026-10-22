// Brief 055 (v1.1 §§ 4 y 11) · Escudo PERMANENTE del club, derivado de su identidad: forma, patrón
// en la segunda equipación, campo sólido con las iniciales y contorno. Siempre `aria-hidden` (va junto
// al nombre del club, que ya lo nombra): ningún nombre accesible cambia. Sin hex en este archivo: los
// colores llegan de IDENTIDAD_ARENA a través de la identidad.
import { useId, type JSX } from "react";
import type { Forma, IdentidadClub, Patron } from "../arena/identidad";

const FORMAS: Record<Forma, (p: { className: string; fill: string; stroke?: string; strokeWidth?: number }) => JSX.Element> = {
  escudo: p => <path d="M16 2 L29 6 V18 C29 27 22.5 32.5 16 34 C9.5 32.5 3 27 3 18 V6 Z" {...p} />,
  redondo: p => <circle cx="16" cy="18" r="14" {...p} />,
  estandarte: p => <path d="M4 2 H28 V26 L16 34 L4 26 Z" {...p} />,
};

const PATRONES: Record<Patron, (fill: string) => JSX.Element[]> = {
  liso: () => [],
  rayas: fill => [6.5, 14.5, 22.5].map(x => <rect key={x} className="arena-crest-patron" x={x} y="0" width="3" height="36" fill={fill} />),
  mitades: fill => [<rect key="m" className="arena-crest-patron" x="16" y="0" width="16" height="36" fill={fill} />],
  banda: fill => [<polygon key="b" className="arena-crest-patron" points="3,2 11,2 29,24 29,34" fill={fill} />],
  aros: fill => [9, 23].map(y => <rect key={y} className="arena-crest-patron" x="0" y={y} width="32" height="4" fill={fill} />),
};

export function Escudo({ identidad, size = 24, className }: { identidad: IdentidadClub; size?: number; className?: string }) {
  // useId es estable entre SSR y cliente; se limpian los caracteres que no sirven en url(#…).
  const clip = `arena-crest-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const c1 = identidad.principal.fondo, c2 = identidad.alternativa.fondo, tinta = identidad.principal.tinta;
  const redondo = identidad.forma === "redondo";
  const letras = Array.from(identidad.iniciales).length;
  const Forma = FORMAS[identidad.forma];
  const patron = PATRONES[identidad.patron](c2);
  return <svg viewBox="0 0 32 36" width={size} height={size * 36 / 32} aria-hidden="true" focusable="false"
    className={className ? `arena-crest ${className}` : "arena-crest"} data-kit={identidad.principal.id} data-patron={identidad.patron} data-forma={identidad.forma}>
    <clipPath id={clip}>{Forma({ className: "arena-crest-clip", fill: c1 })}</clipPath>
    {Forma({ className: "arena-crest-forma", fill: c1 })}
    <g clipPath={`url(#${clip})`}>
      {patron}
      {redondo
        ? <circle className="arena-crest-campo" cx="16" cy="18" r="8.5" fill={c1} />
        : <rect className="arena-crest-campo" x="3" y="19" width="26" height="10" fill={c1} />}
    </g>
    {/* Centro del campo con dominantBaseline central (escudo y estandarte: campo 19–29 → 24). */}
    <text className="arena-crest-iniciales" x="16" y={redondo ? 18 : 24} textAnchor="middle" dominantBaseline="central"
      fontSize={letras >= 3 ? 7.2 : letras === 2 ? 9 : 8} fill={tinta}>{identidad.iniciales}</text>
    {Forma({ className: "arena-crest-contorno", fill: "none", stroke: tinta, strokeWidth: 1.2 })}
  </svg>;
}
