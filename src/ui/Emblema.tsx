// Brief 055 § 3.1 · Emblema de CRONISTA: balón abierto en forma de C con un punto «al aire» en la
// boca. Dibujo propio y genérico (pentágono de balón, C abierta, punto), sin texto ni <title>:
// va dentro del enlace .brand, cuyo nombre accesible no cambia. Color por currentColor; el punto
// usa --emblem-live si está definido. src/app/icon.svg repite ESTOS trazos (prueba de paridad).
export const TRAZOS_EMBLEMA = {
  contorno: "M24.6 8.4 A12 12 0 1 0 24.6 23.6",
  pentagono: "M16 10.1 l4.7 3.4 -1.8 5.6 h-5.8 l-1.8 -5.6 z",
  costuras: "M16 10.1 V6.2 M20.7 13.5 l3.4 -1.3 M11.3 13.5 l-3.4 -1.3 M18.9 19.1 l2.4 3.2 M13.1 19.1 l-2.4 3.2",
  punto: { cx: 26.6, cy: 16, r: 2.3 },
} as const;

export function EmblemaCronista({ size = 28, className }: { size?: number; className?: string }) {
  return <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" focusable="false" className={className ? `brand-emblem ${className}` : "brand-emblem"}>
    <path d={TRAZOS_EMBLEMA.contorno} fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
    <path d={TRAZOS_EMBLEMA.pentagono} fill="currentColor" />
    <path d={TRAZOS_EMBLEMA.costuras} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx={TRAZOS_EMBLEMA.punto.cx} cy={TRAZOS_EMBLEMA.punto.cy} r={TRAZOS_EMBLEMA.punto.r} fill="var(--emblem-live, currentColor)" />
  </svg>;
}
