import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
// Revisión de Codex de la publicación 2 (P2): cociente de potencia de v1.2 § 18.3 con los ticks contados desde vuelo.inicioTick.
// `RAIZ=<árbol limpio> node --import tsx potencia-corregida.mts salida.json` (desde RAIZ, con node_modules).
const R = process.env.RAIZ!;
const { LOTE_ARENA_046: L, LOTE_ARENA_063: L63 } = await import(`${R}/src/sim/limites.ts`);
const { incumplimientosControladoAtributos, medirControladoAtributo } = await import(`${R}/src/arena/metricas-lote.ts`);
const git = (...a: string[]) => execFileSync("git", ["-c", `safe.directory=${R}`, "-C", R, ...a], { encoding: "utf8" }).trim();
const r = await medirControladoAtributo({ desde: L.completo.semillaDesde, semillas: L.completo.semillas, reglas: "reinicios-v7", atributo: "potencia", ...L63.sobreUmbral.potencia });
const salida = { generado: new Date().toISOString(), commit: git("rev-parse", "HEAD"), arbolConCambios: !!git("status", "--porcelain"),
  nota: "Revisión de Codex de la publicación 2 (P2): ticks de vuelo contados desde vuelo.inicioTick. Solo cambia la métrica del helper; el motor v7 no cambia.",
  reglas: "reinicios-v7", semillas: { desde: L.completo.semillaDesde, hasta: L.completo.semillaDesde + L.completo.semillas - 1 }, sobreUmbral: L63.sobreUmbral.potencia,
  cociente: r.cociente, incumplimientos: incumplimientosControladoAtributos({ diferencias: {}, cocientes: { potencia: r.cociente } }),
  bajo: { ticksPorMRemate: r.bajo.local063.ticksPorMRemate, lejanosPorPartido: r.bajo.local063.lejanosPorPartido, goles: r.bajo.golesPorPartido },
  alto: { ticksPorMRemate: r.alto.local063.ticksPorMRemate, lejanosPorPartido: r.alto.local063.lejanosPorPartido, goles: r.alto.golesPorPartido } };
writeFileSync(process.argv[2]!, JSON.stringify(salida, null, 1) + "\n");
console.log(JSON.stringify(salida, null, 1));
