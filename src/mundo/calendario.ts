// Brief 016 §2 — calendario round-robin ida y vuelta por el algoritmo del círculo.
// n equipos (par): el 0 queda fijo, los demás rotan. Ida = n−1 jornadas; la vuelta repite la
// ida con la localía invertida. Determinista: no usa azar.

import type { Calendario, Cruce } from "./tipos";

export function calendarioCirculo(n: number): Calendario {
  if (n < 2 || n % 2 !== 0) throw new Error(`calendarioCirculo: n debe ser par y ≥ 2 (recibido ${n})`);
  const rueda = Array.from({ length: n - 1 }, (_, i) => i + 1);
  const ida: Cruce[][] = [];
  for (let r = 0; r < n - 1; r++) {
    const fila = [0, ...rueda];
    const jornada: Cruce[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = fila[i] as number;
      const b = fila[n - 1 - i] as number;
      // El fijo alterna localía por jornada; el resto alterna por posición y jornada, para que
      // nadie encadene demasiadas localías seguidas.
      const aLocal = i === 0 ? r % 2 === 0 : (i + r) % 2 === 1;
      jornada.push(aLocal ? { local: a, visita: b } : { local: b, visita: a });
    }
    ida.push(jornada);
    rueda.unshift(rueda.pop() as number);
  }
  const vuelta = ida.map((j) => j.map((c) => ({ local: c.visita, visita: c.local })));
  return [...ida, ...vuelta];
}
