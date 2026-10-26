// Experimentos controlados de potencia (lejanos del local) e identidad con overrides.
import * as L from "/home/calusaca/cronista/src/sim/limites.ts";
import { medirControladoAtributo, medirControladoIdentidad, incumplimientosIdentidad } from "/home/calusaca/cronista/src/arena/metricas-lote.ts";
const [ovS, etiqueta] = process.argv.slice(2);
const ov: Record<string, unknown> = ovS ? JSON.parse(ovS) : {};
for (const [ruta, valor] of Object.entries(ov)) { const p = ruta.split("."); let o: any = (L as any)[p.shift()!]; while (p.length > 1) o = o[p.shift()!]; o[p[0]!] = valor; }
const pot = await medirControladoAtributo({ desde: 1, semillas: 100, reglas: "reinicios-v8", atributo: "potencia", ...L.LOTE_ARENA_063.controlado.valores });
const id = await medirControladoIdentidad({ desde: 1, semillas: 100, reglas: "reinicios-v8" });
console.log(JSON.stringify({ etiqueta, potenciaDif: pot.diferencia, potenciaMin: L.LOTE_ARENA_063.controlado.diferenciaMin.potencia, identidad: id.diferencias, incIdentidad: incumplimientosIdentidad(id.diferencias) }));
