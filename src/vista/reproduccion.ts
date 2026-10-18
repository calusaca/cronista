// Tiempo y posiciones ilustrativos: no son tracking ni el reloj del encuentro.
import type { CuadroTactico, PuntoCancha } from "./tactica";

export function interpolarCuadro(c: CuadroTactico, progreso: number) {
  const t = Number.isFinite(progreso) ? Math.max(0, Math.min(1, progreso)) : 0;
  const punto = (a: PuntoCancha, b: PuntoCancha): PuntoCancha => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const iniciales = new Map(c.antes.map(j => [`${j.lado}:${j.nombre}`, j.punto]));
  return {
    jugadores: c.jugadores.map(j => ({ ...j, punto: punto(iniciales.get(`${j.lado}:${j.nombre}`) ?? j.punto, j.punto) })),
    balon: punto(c.balon.desde, c.balon.hasta),
    mostrarBalon: c.paseCompletado !== false || t < 1,
  };
}

/** Ritmo de lectura acotado, independiente de minutos reales o velocidad física. */
export function duracionIlustrativa(texto: string): number {
  return Math.max(1800, Math.min(4800, texto.split(/\s+/).length * 140));
}
