// PRNG con semilla (mulberry32). Única fuente de azar de src/sim/.
// Math.random está prohibido en este módulo (lo vigila la suite de invariantes).

export interface Rng {
  /** Uniforme en [0, 1). */
  next(): number;
  /** Entero uniforme en [min, max], ambos incluidos. */
  int(min: number, max: number): number;
  /** true con probabilidad p. */
  chance(p: number): boolean;
  /** Normal estándar (Box–Muller). */
  normal(): number;
  /** Elemento uniforme de una lista no vacía. */
  pick<T>(items: readonly T[]): T;
  /** Elemento según pesos (>= 0); devuelve undefined si todos los pesos son 0. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T | undefined;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function crearRng(seed: number): Rng {
  const next = mulberry32(seed);
  const rng: Rng = {
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    chance(p) {
      return next() < p;
    },
    normal() {
      // 1 - next() ∈ (0, 1]: evita log(0).
      const u = 1 - next();
      const v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    pick(items) {
      if (items.length === 0) throw new Error("pick sobre lista vacía");
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    weighted(items, weight) {
      let total = 0;
      for (const it of items) total += Math.max(0, weight(it));
      if (total <= 0) return undefined;
      let r = next() * total;
      for (const it of items) {
        const w = Math.max(0, weight(it));
        if (w <= 0) continue;
        r -= w;
        if (r < 0) return it;
      }
      // Redondeo: devolver el último con peso positivo.
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i] as (typeof items)[number];
        if (weight(it) > 0) return it;
      }
      return undefined;
    },
  };
  return rng;
}
