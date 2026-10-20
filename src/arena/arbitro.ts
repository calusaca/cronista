import { ARBITRO_ARENA as R, ARBITRAJE_ARENA, ARENA } from "../sim/limites";
import { prngDerivado } from "../sim/prng";
import { limitar } from "./geometria";
import type { ArbitroArena, Punto } from "./tipos";

const nombres = ["Alex", "Ariel", "Noa", "Sam"] as const;
const apellidos = ["Dorena", "Velarín", "Quinel", "Brelosa", "Fenardi", "Ulvino"] as const;
function objetivo(balon: Punto): Punto {
  return {
    x: limitar(balon.x + (balon.x < ARENA.largoM / 2 ? R.distanciaLongitudM : -R.distanciaLongitudM), R.margenM, ARENA.largoM - R.margenM),
    y: limitar(balon.y + (balon.y < ARENA.anchoM / 2 ? R.distanciaLateralM : -R.distanciaLateralM), R.margenM, ARENA.anchoM - R.margenM),
  };
}
export function crearArbitro(seed: number, balon: Punto, arbitraje = false): ArbitroArena {
  const rng = prngDerivado(seed, "arbitro:arena-v2");
  return { id: "arbitro", nombre: `${rng.pick(nombres)} ${rng.pick(apellidos)}`, posicion: objetivo(balon), velocidad: { x: 0, y: 0 },
    ...(arbitraje ? { criterioContacto: rng.int(ARBITRAJE_ARENA.criterioMin, ARBITRAJE_ARENA.criterioMax), ultimaDecision: null } : {}),
  };
}

/** Sigue solo el balón actual, con aceleración acotada. No toca ni arbitra el juego. */
export function moverArbitro(arbitro: ArbitroArena, balon: Punto): void {
  const destino = objetivo(balon);
  const dx = destino.x - arbitro.posicion.x, dy = destino.y - arbitro.posicion.y, d = Math.hypot(dx, dy);
  const rapidez = Math.min(R.velocidadMps, Math.sqrt(2 * R.aceleracionMps2 * Math.max(0, d - ARENA.toleranciaM)));
  const vx = d ? dx / d * rapidez : 0, vy = d ? dy / d * rapidez : 0;
  const ax = vx - arbitro.velocidad.x, ay = vy - arbitro.velocidad.y, delta = Math.hypot(ax, ay);
  const factor = delta ? Math.min(1, R.aceleracionMps2 * ARENA.pasoS / delta) : 0;
  const x = limitar(arbitro.posicion.x + (arbitro.velocidad.x + ax * factor) * ARENA.pasoS, 0, ARENA.largoM);
  const y = limitar(arbitro.posicion.y + (arbitro.velocidad.y + ay * factor) * ARENA.pasoS, 0, ARENA.anchoM);
  arbitro.velocidad = { x: (x - arbitro.posicion.x) / ARENA.pasoS, y: (y - arbitro.posicion.y) / ARENA.pasoS };
  arbitro.posicion = { x, y };
}
