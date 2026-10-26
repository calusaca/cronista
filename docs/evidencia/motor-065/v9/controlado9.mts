// Experimentos controlados (051 porteros/campo, 063 potencia e identidad) con overrides en tiempo de ejecución.
// uso: node --import tsx controlado9.mts <reglas> <experimento: potencia|identidad|porteros|campo> [overridesJSON] [etiqueta]
import * as L from "/home/calusaca/cronista/src/sim/limites.ts";
import { incumplimientosControlado, incumplimientosControladoAtributos, incumplimientosIdentidad, medirControlado, medirControladoAtributo, medirControladoIdentidad } from "/home/calusaca/cronista/src/arena/metricas-lote.ts";
const [reglas, exp, ovS, etiqueta] = process.argv.slice(2);
const ov: Record<string, unknown> = ovS ? JSON.parse(ovS) : {};
for (const [ruta, valor] of Object.entries(ov)) { const p = ruta.split("."); let o: any = (L as any)[p.shift()!]; while (p.length > 1) o = o[p.shift()!]; o[p[0]!] = valor; }
const lote = { desde: L.LOTE_ARENA_046.completo.semillaDesde, semillas: L.LOTE_ARENA_046.completo.semillas, reglas: reglas as any };
let out: unknown;
if (exp === "potencia") {
  const r = await medirControladoAtributo({ ...lote, atributo: "potencia", ...L.LOTE_ARENA_063.controlado.valores });
  out = { diferencia: r.diferencia, min: L.LOTE_ARENA_063.controlado.diferenciaMin.potencia, inc: incumplimientosControladoAtributos({ diferencias: { potencia: r.diferencia } }) };
} else if (exp === "identidad") {
  const r = await medirControladoIdentidad(lote);
  out = { diferencias: r.diferencias, inc: incumplimientosIdentidad(r.diferencias) };
} else {
  const r = await medirControlado({ ...lote, quien: exp === "porteros" ? "portero" : "campo" });
  out = { diferencia: r.diferencia, inc: incumplimientosControlado(exp === "porteros" ? { porteros: r.diferencia } : { porteros: 1, campo: r.diferencia }, L.LOTE_ARENA_051.completo).filter(x => exp === "porteros" ? x.includes("Porteros") : x.includes("Campo")) };
}
console.log(JSON.stringify({ etiqueta, reglas, exp, ov, ...(out as object) }));
